/// <reference path="../pb_data/types.d.ts" />

// A kiosk stops being an account and becomes a link. Because the door device
// now needs the class roster to greet students by name, the roster and the
// hall pass log move out of the teacher's encrypted vault and into real
// collections, where per-collection rules can grant the kiosk exactly two
// powers: read the roster, append to the log.
migrate((app) => {
  for (const name of ["kiosk_devices", "device_link_codes", "class_vaults"]) {
    try { app.delete(app.findCollectionByNameOrId(name)); } catch (_) {}
  }

  const teachers = app.findCollectionByNameOrId("teachers");
  teachers.fields.add(new NumberField({ name: "passLimit", min: 1, max: 5 }));
  app.save(teachers);

  const links = new Collection({
    type: "base", name: "kiosk_links",
    // A teacher can see which of their links exist and revoke them from the
    // workspace, but only the server routes below mint one, and the token
    // itself is hashed here so a database leak cannot reopen a kiosk.
    listRule: "teacher = @request.auth.id", viewRule: "teacher = @request.auth.id",
    createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { type: "text", name: "teacher", required: true, min: 15, max: 15 },
      { type: "text", name: "label", required: true, min: 1, max: 80 },
      { type: "text", name: "tokenHash", required: true, min: 64, max: 64, hidden: true },
      { type: "bool", name: "active" },
      { type: "autodate", name: "at", onCreate: true },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_kiosk_link_token ON kiosk_links (tokenHash)"],
  });
  app.save(links);

  const students = new Collection({
    type: "base", name: "students",
    listRule: "teacher = @request.auth.id", viewRule: "teacher = @request.auth.id",
    createRule: "@request.body.teacher = @request.auth.id",
    updateRule: "teacher = @request.auth.id && @request.body.teacher:isset = false",
    deleteRule: "teacher = @request.auth.id",
    fields: [
      { type: "text", name: "teacher", required: true, min: 15, max: 15 },
      { type: "text", name: "studentId", required: true, min: 4, max: 12, pattern: "^[0-9]+$" },
      { type: "text", name: "name", required: true, min: 1, max: 80 },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_student_per_teacher ON students (teacher, studentId)"],
  });
  app.save(students);

  const events = new Collection({
    type: "base", name: "pass_events",
    // An append-only log of exits and returns. Nothing may edit or erase an
    // entry once written, which is what makes an insert-only kiosk safe: the
    // worst a compromised door device can do is add noise, never rewrite or
    // read the class's history.
    listRule: "teacher = @request.auth.id", viewRule: "teacher = @request.auth.id",
    createRule: "@request.body.teacher = @request.auth.id",
    updateRule: null, deleteRule: null,
    fields: [
      { type: "text", name: "teacher", required: true, min: 15, max: 15 },
      { type: "text", name: "studentId", required: true, min: 4, max: 12 },
      { type: "text", name: "studentName", required: true, min: 1, max: 80 },
      { type: "text", name: "kind", required: true, max: 3, pattern: "^(out|in)$" },
      { type: "text", name: "reason", max: 40 },
      { type: "number", name: "minutes", min: 0, max: 120 },
      { type: "text", name: "source", required: true, max: 7, pattern: "^(kiosk|teacher)$" },
      { type: "text", name: "signedInBy", max: 80 },
      { type: "autodate", name: "at", onCreate: true },
    ],
    indexes: ["CREATE INDEX idx_pass_events_teacher ON pass_events (teacher, at)"],
  });
  app.save(events);
}, (app) => {
  for (const name of ["pass_events", "students", "kiosk_links"]) {
    try { app.delete(app.findCollectionByNameOrId(name)); } catch (_) {}
  }
  const teachers = app.findCollectionByNameOrId("teachers");
  teachers.fields.removeByName("passLimit");
  app.save(teachers);
});
