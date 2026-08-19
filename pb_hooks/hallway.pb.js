/// <reference path="../pb_data/types.d.ts" />

// A kiosk is a link, not an account. The teacher opens the link once on the
// device by the door; the token inside it lets that device do exactly two
// things — read the class roster, and append to the hall pass log. It can
// never read the log it writes to, edit an entry, or reach another class.
//
// PocketBase runs each route handler in its own isolated VM, so these handlers
// cannot share helper functions. The token lookup is repeated on purpose.

routerAdd("POST", "/api/hallway/kiosk/links", (e) => {
  const body = new DynamicModel({ label: "" });
  e.bindBody(body);
  const token = $security.randomString(40);
  const record = new Record(e.app.findCollectionByNameOrId("kiosk_links"));
  record.set("teacher", e.auth.id);
  record.set("label", (body.label || "Classroom door").substring(0, 80));
  record.set("tokenHash", $security.sha256(token));
  record.set("active", true);
  e.app.save(record);
  // The only time the raw token exists. It is shown once, then only its hash remains.
  return e.json(200, { id: record.id, label: record.getString("label"), token });
}, $apis.requireAuth("teachers"), $apis.bodyLimit(1024));

routerAdd("POST", "/api/hallway/kiosk/links/revoke", (e) => {
  const body = new DynamicModel({ linkId: "" });
  e.bindBody(body);
  const link = e.app.findFirstRecordByFilter("kiosk_links", "id = {:id} && teacher = {:teacher}", { id: body.linkId, teacher: e.auth.id });
  link.set("active", false);
  e.app.save(link);
  return e.noContent(204);
}, $apis.requireAuth("teachers"), $apis.bodyLimit(1024));

// What the door device is allowed to read: the roster, and how many students
// may be out at once. No history, no other classroom.
routerAdd("POST", "/api/hallway/kiosk/session", (e) => {
  const body = new DynamicModel({ token: "" });
  e.bindBody(body);
  if (!/^[a-zA-Z0-9]{40}$/.test(body.token)) throw new BadRequestError("This kiosk link is not valid");
  let link;
  try {
    link = e.app.findFirstRecordByFilter("kiosk_links", "tokenHash = {:hash} && active = true", { hash: $security.sha256(body.token) });
  } catch (_) { throw new BadRequestError("This kiosk link is not valid"); }

  const teacherId = link.getString("teacher");
  const teacher = e.app.findRecordById("teachers", teacherId);
  const roster = e.app.findRecordsByFilter("students", "teacher = {:teacher}", "name", 500, 0, { teacher: teacherId });
  return e.json(200, {
    label: link.getString("label"),
    limit: teacher.getInt("passLimit") || 2,
    students: roster.map((student) => ({ id: student.getString("studentId"), name: student.getString("name") })),
  });
}, $apis.bodyLimit(1024));

// The only way a kiosk writes anything. Whether a pass is allowed is decided
// here, from the log, because the kiosk itself may not read it.
routerAdd("POST", "/api/hallway/kiosk/events", (e) => {
  const body = new DynamicModel({ token: "", studentId: "", kind: "", reason: "", minutes: 0 });
  e.bindBody(body);
  if (!/^[a-zA-Z0-9]{40}$/.test(body.token)) throw new BadRequestError("This kiosk link is not valid");
  if (body.kind !== "out" && body.kind !== "in") throw new BadRequestError("Unknown kiosk action");

  let response;
  e.app.runInTransaction((tx) => {
    let link;
    try {
      link = tx.findFirstRecordByFilter("kiosk_links", "tokenHash = {:hash} && active = true", { hash: $security.sha256(body.token) });
    } catch (_) { throw new BadRequestError("This kiosk link is not valid"); }
    const teacherId = link.getString("teacher");

    let student;
    try {
      student = tx.findFirstRecordByFilter("students", "teacher = {:teacher} && studentId = {:studentId}", { teacher: teacherId, studentId: body.studentId });
    } catch (_) { throw new BadRequestError("We could not find that student ID. Please try again."); }

    // Each student's most recent entry says whether they are out right now. Only
    // the recent past is read: nobody is still in the hallway after a month, and
    // it keeps this scan from growing with the whole school year.
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const log = tx.findRecordsByFilter("pass_events", "teacher = {:teacher} && at > {:since}", "at", 5000, 0, { teacher: teacherId, since: since });
    const latest = {};
    for (let index = 0; index < log.length; index++) latest[log[index].getString("studentId")] = log[index].getString("kind");
    let outNow = 0;
    for (const id in latest) if (latest[id] === "out") outNow++;
    const alreadyOut = latest[body.studentId] === "out";
    const limit = tx.findRecordById("teachers", teacherId).getInt("passLimit") || 2;

    if (body.kind === "out" && alreadyOut) throw new BadRequestError("You are already signed out. Tap \"I am back\" instead.");
    if (body.kind === "in" && !alreadyOut) throw new BadRequestError("You are not signed out right now.");
    if (body.kind === "out" && outNow >= limit) {
      response = { status: "denied", name: student.getString("name"), out: outNow, limit: limit };
      return;
    }

    const entry = new Record(tx.findCollectionByNameOrId("pass_events"));
    entry.set("teacher", teacherId);
    entry.set("studentId", body.studentId);
    entry.set("studentName", student.getString("name"));
    entry.set("kind", body.kind);
    entry.set("reason", body.kind === "out" ? String(body.reason || "").substring(0, 40) : "");
    entry.set("minutes", body.kind === "out" ? Math.min(120, Math.max(1, Math.round(body.minutes))) : 0);
    entry.set("source", "kiosk");
    tx.save(entry);

    response = {
      status: body.kind === "out" ? "approved" : "returned",
      name: student.getString("name"),
      reason: entry.getString("reason"),
      minutes: entry.getInt("minutes"),
      outAt: entry.getString("at"),
      out: body.kind === "out" ? outNow + 1 : outNow - 1,
      limit: limit,
    };
  });
  return e.json(200, response);
}, $apis.bodyLimit(1024));
