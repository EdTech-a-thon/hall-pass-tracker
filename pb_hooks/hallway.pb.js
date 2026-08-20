/// <reference path="../pb_data/types.d.ts" />

// The teacher signs in on the classroom device, then locks the interface in
// kiosk mode. Only a salted password hash is stored; the six-digit PIN itself
// is never written to the database or returned to the browser.
routerAdd("GET", "/api/hallway/kiosk/pin/status", (e) => {
  return e.json(200, { hasPin: e.auth.getString("kioskPin:hash") !== "" });
}, $apis.requireAuth("teachers"));

routerAdd("POST", "/api/hallway/kiosk/pin", (e) => {
  const body = new DynamicModel({ pin: "" });
  e.bindBody(body);
  if (!/^[0-9]{6}$/.test(body.pin)) throw new BadRequestError("Enter exactly six numbers.");
  e.auth.set("kioskPin", body.pin);
  e.app.save(e.auth);
  return e.noContent(204);
}, $apis.requireAuth("teachers"), $apis.bodyLimit(1024));

routerAdd("POST", "/api/hallway/kiosk/pin/verify", (e) => {
  const body = new DynamicModel({ pin: "" });
  e.bindBody(body);
  const savedPin = e.auth.getRaw("kioskPin");
  if (!savedPin || !/^[0-9]{6}$/.test(body.pin) || !savedPin.validate(body.pin)) {
    throw new BadRequestError("That PIN is incorrect.");
  }
  return e.noContent(204);
}, $apis.requireAuth("teachers"), $apis.bodyLimit(1024));

// The only way a kiosk writes anything. Whether a pass is allowed is decided
// here, from the log, and always within the Active Class: one period's records
// must never block the students standing in the room.
routerAdd("POST", "/api/hallway/kiosk/events", (e) => {
  const body = new DynamicModel({ studentId: "", kind: "", destination: "", cancel: false });
  e.bindBody(body);
  if (body.kind !== "out" && body.kind !== "in") throw new BadRequestError("Unknown kiosk action");

  let response;
  e.app.runInTransaction((tx) => {
    const teacherId = e.auth.id;
    const teacher = tx.findRecordById("teachers", teacherId);
    const activeClass = teacher.getString("activeClass");
    if (!activeClass) throw new BadRequestError("No class has been set up yet. Please ask your teacher.");

    let student;
    try {
      student = tx.findFirstRecordByFilter("students", "teacher = {:teacher} && class = {:class} && status = 'current' && studentId = {:studentId}", { teacher: teacherId, class: activeClass, studentId: body.studentId });
    } catch (_) { throw new BadRequestError("We could not find that student ID. Please try again."); }

    // The Display Name is composed, never stored whole: the database holds a
    // first name and a last-name prefix and nothing more. See docs/adr/0001.
    const prefix = student.getString("lastPrefix");
    const shownName = prefix ? student.getString("firstName") + " " + prefix + "." : student.getString("firstName");

    // Each student's most recent entry says whether they are out right now. Only
    // the recent past is read: nobody is still in the hallway after a month, and
    // it keeps this scan from growing with the whole school year.
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const log = tx.findRecordsByFilter("pass_events", "teacher = {:teacher} && class = {:class} && at > {:since}", "at", 5000, 0, { teacher: teacherId, class: activeClass, since: since });
    const latest = {};
    for (let index = 0; index < log.length; index++) latest[log[index].getString("studentId")] = log[index].getString("kind");
    let outNow = 0;
    for (const id in latest) if (latest[id] === "out") outNow++;
    const alreadyOut = latest[body.studentId] === "out";
    const limit = teacher.getInt("passLimit") || 2;

    // How long a trip should take is the teacher's setting, never the browser's,
    // and it is frozen onto the Pass here so that editing the Destination later
    // cannot reach back and rewrite months of history.
    let minutes = 0;
    if (body.kind === "out") {
      const allowed = teacher.get("destinations") || [];
      let match = null;
      for (let index = 0; index < allowed.length; index++) {
        if (allowed[index].label === body.destination) match = allowed[index];
      }
      if (!match) throw new BadRequestError("That is not somewhere you can go right now.");
      minutes = Math.min(120, Math.max(1, Math.round(match.minutes)));
    }

    if (body.kind === "out" && alreadyOut) throw new BadRequestError("You are already signed out. Tap your name to sign back in.");
    if (body.kind === "in" && !alreadyOut) throw new BadRequestError("You are not signed out right now.");
    if (body.kind === "out" && outNow >= limit) {
      response = { status: "denied", name: shownName, out: outNow, limit: limit };
      return;
    }

    const entry = new Record(tx.findCollectionByNameOrId("pass_events"));
    entry.set("teacher", teacherId);
    entry.set("class", activeClass);
    entry.set("studentId", body.studentId);
    entry.set("studentName", shownName);
    entry.set("kind", body.kind);
    entry.set("destination", body.kind === "out" ? String(body.destination || "").substring(0, 40) : "");
    entry.set("minutes", minutes);
    // An undo is still an entry. Nothing in this log is ever rewritten.
    entry.set("source", body.kind === "in" && body.cancel ? "cancelled" : "kiosk");
    tx.save(entry);

    response = {
      status: body.kind === "out" ? "approved" : (body.cancel ? "cancelled" : "returned"),
      name: shownName,
      destination: entry.getString("destination"),
      minutes: entry.getInt("minutes"),
      outAt: entry.getString("at"),
      out: body.kind === "out" ? outNow + 1 : outNow - 1,
      limit: limit,
    };
  });
  return e.json(200, response);
}, $apis.requireAuth("teachers"), $apis.bodyLimit(1024));
