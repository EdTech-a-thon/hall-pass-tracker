/// <reference path="../pb_data/types.d.ts" />

// The teacher signs in on the classroom device, then locks the interface in
// kiosk mode. Only a salted password hash is stored; the six-digit PIN itself
// is never written to the database or returned to the browser.
routerAdd("GET", "/api/hallway/kiosk/pin/status", (e) => {
  return e.json(200, { hasPin: e.auth.getString("kioskPin:hash") !== "" });
}, $apis.requireAuth("teachers"));

routerAdd("POST", "/api/hallway/kiosk/pin", (e) => {
  const body = new DynamicModel({ pin: "", current: "" });
  e.bindBody(body);
  if (!/^[0-9]{6}$/.test(body.pin)) throw new BadRequestError("Enter exactly six numbers.");

  // Replacing a PIN requires proving the old one. The PIN is the only thing
  // between kiosk mode and the teacher workspace, and the door browser holds a
  // live teacher session -- so without this, the gate could be reset from the
  // very screen it is meant to hold shut, rather than passed.
  // An unset password field is still an object, so "has a PIN" is the presence
  // of a stored hash -- the same check the status route makes.
  if (e.auth.getString("kioskPin:hash") !== "") {
    const savedPin = e.auth.getRaw("kioskPin");
    if (!/^[0-9]{6}$/.test(body.current) || !savedPin.validate(body.current)) {
      throw new BadRequestError("That is not your current PIN.");
    }
  }

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
  const body = new DynamicModel({ student: "", kind: "", destination: "", cancel: false });
  e.bindBody(body);
  if (body.kind !== "out" && body.kind !== "in") throw new BadRequestError("Unknown kiosk action");

  let response;
  e.app.runInTransaction((tx) => {
    const teacherId = e.auth.id;
    const teacher = tx.findRecordById("teachers", teacherId);
    const activeClass = teacher.getString("activeClass");
    if (!activeClass) throw new BadRequestError("No class has been set up yet. Please ask your teacher.");

    // Identified by roster row, and only ever a current Student in the Class the
    // door screen is actually showing.
    let student;
    try {
      student = tx.findFirstRecordByFilter("students", "id = {:id} && teacher = {:teacher} && class = {:class} && status = 'current'", { id: body.student, teacher: teacherId, class: activeClass });
    } catch (_) { throw new BadRequestError("We could not find that student. Please ask your teacher."); }

    // The Display Name is composed, never stored whole: the database holds a
    // first name and a last-name prefix and nothing more. See docs/adr/0001.
    const prefix = student.getString("lastPrefix");
    const shownName = prefix ? student.getString("firstName") + " " + prefix + "." : student.getString("firstName");

    const state = require(`${__hooks}/class_state.js`).readClassState(tx, teacherId, activeClass);
    let outNow = 0;
    for (const id in state.latest) if (state.latest[id] === "out") outNow++;
    const alreadyOut = state.latest[body.student] === "out";
    const limit = teacher.getInt("passLimit") || 2;

    // How long a trip should take is the teacher's setting, never the browser's,
    // and it is frozen onto the Pass here so that editing the Destination later
    // cannot reach back and rewrite months of history.
    let minutes = 0;
    if (body.kind === "out") {
      // PocketBase hands a JSON field to a hook as raw bytes, not a parsed
      // array, so it has to be decoded before it can be read.
      const stored = teacher.get("destinations");
      let allowed = [];
      if (stored) {
        try {
          allowed = JSON.parse(typeof stored === "string" ? stored : stored.string());
        } catch (_) { allowed = []; }
      }
      if (!allowed || typeof allowed.length !== "number") allowed = [];
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
    entry.set("student", student.id);
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

// Moving the door screen to another Class. Closing the outgoing Class's open
// passes and moving the Active Class happen in one transaction, so a failure
// can never leave the door showing one Class while another's trips hang open.
routerAdd("POST", "/api/hallway/class/switch", (e) => {
  const body = new DynamicModel({ class: "" });
  e.bindBody(body);

  let response;
  e.app.runInTransaction((tx) => {
    const teacherId = e.auth.id;
    const teacher = tx.findRecordById("teachers", teacherId);

    let target;
    try {
      target = tx.findFirstRecordByFilter("classes", "id = {:id} && teacher = {:teacher} && archived = false", { id: body.class, teacher: teacherId });
    } catch (_) { throw new BadRequestError("That class is not available."); }

    const leaving = teacher.getString("activeClass");
    const closed = [];
    if (leaving && leaving !== target.id) {
      const state = require(`${__hooks}/class_state.js`).readClassState(tx, teacherId, leaving);
      const latest = state.latest;
      const names = state.names;
      const collection = tx.findCollectionByNameOrId("pass_events");
      for (const student in latest) {
        if (latest[student] !== "out") continue;
        const entry = new Record(collection);
        entry.set("teacher", teacherId);
        entry.set("class", leaving);
        entry.set("student", student);
        entry.set("studentName", names[student]);
        entry.set("kind", "in");
        entry.set("source", "switch");
        tx.save(entry);
        closed.push(names[student]);
      }
    }

    teacher.set("activeClass", target.id);
    tx.save(teacher);
    response = { class: target.id, closed: closed };
  });
  return e.json(200, response);
}, $apis.requireAuth("teachers"), $apis.bodyLimit(1024));

// Records a Correction. Nothing is updated and nothing is deleted: this writes
// a new entry that amends an earlier one, which is what keeps the log worth
// trusting. See docs/adr/0004.
routerAdd("POST", "/api/hallway/passes/correct", (e) => {
  const body = new DynamicModel({ event: "", student: "", at: "" });
  e.bindBody(body);

  let response;
  e.app.runInTransaction((tx) => {
    const teacherId = e.auth.id;

    let target;
    try {
      target = tx.findFirstRecordByFilter("pass_events", "id = {:id} && teacher = {:teacher}", { id: body.event, teacher: teacherId });
    } catch (_) { throw new BadRequestError("That entry is not yours to correct."); }

    let name = target.getString("studentName");
    if (body.student) {
      // Reassignment stays inside the Class: a trip cannot move to a student
      // who was never in the room.
      let student;
      try {
        student = tx.findFirstRecordByFilter("students", "id = {:id} && teacher = {:teacher} && class = {:class}", { id: body.student, teacher: teacherId, class: target.getString("class") });
      } catch (_) { throw new BadRequestError("That student is not in this class."); }
      const prefix = student.getString("lastPrefix");
      name = prefix ? student.getString("firstName") + " " + prefix + "." : student.getString("firstName");
    }

    const fix = new Record(tx.findCollectionByNameOrId("pass_events"));
    fix.set("teacher", teacherId);
    fix.set("class", target.getString("class"));
    fix.set("student", target.getString("student"));
    fix.set("studentName", name);
    fix.set("kind", "fix");
    fix.set("source", "teacher");
    fix.set("signedInBy", e.auth.getString("displayName"));
    fix.set("corrects", target.id);
    if (body.student) fix.set("newStudent", body.student);
    if (body.at) fix.set("newAt", body.at);
    tx.save(fix);

    response = { id: fix.id };
  });
  return e.json(200, response);
}, $apis.requireAuth("teachers"), $apis.bodyLimit(1024));
