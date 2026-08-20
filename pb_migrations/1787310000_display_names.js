/// <reference path="../pb_data/types.d.ts" />

// A Student's name is stored as a first name plus only as many leading letters
// of the last name as it takes to tell them apart inside their Class. The rest
// of the last name is discarded at import and never written down. See
// docs/adr/0001-store-only-first-name-and-last-name-prefix.md - this is a
// one-way door, because letters we never stored cannot be recovered later.
migrate((app) => {
  const students = app.findCollectionByNameOrId("students");
  students.fields.add(new TextField({ name: "firstName", max: 40 }));
  students.fields.add(new TextField({ name: "lastPrefix", max: 3 }));
  // A Student who has left keeps their history; they simply stop appearing.
  students.fields.add(new TextField({ name: "status", max: 7, pattern: "^(current|former)$" }));
  app.save(students);

  // Existing rosters hold a single "name". Split it, then hand out the shortest
  // prefix that separates everyone sharing a first name within a Class.
  const all = app.findAllRecords("students");
  const groups = {};
  for (const student of all) {
    const whole = String(student.getString("name") || "").trim();
    const parts = whole.length ? whole.split(" ") : [];
    const first = parts.shift() || "Student";
    const last = parts.join(" ");
    student.set("firstName", first);
    student.set("status", "current");
    const key = student.getString("class") + " " + first.toLowerCase();
    if (!groups[key]) groups[key] = [];
    groups[key].push({ student: student, last: last });
  }

  for (const key in groups) {
    const members = groups[key];
    let width = 1;
    while (width < 3) {
      const seen = {};
      let clash = false;
      for (const member of members) {
        const seed = member.last.substring(0, width).toLowerCase();
        if (seen[seed]) { clash = true; break; }
        seen[seed] = true;
      }
      if (!clash) break;
      width++;
    }
    for (const member of members) {
      member.student.set("lastPrefix", member.last.substring(0, width));
      app.save(member.student);
    }
  }

  // "name" was the only place a full last name could survive. It goes.
  const stripped = app.findCollectionByNameOrId("students");
  stripped.fields.removeByName("name");
  app.save(stripped);
}, (app) => {
  const students = app.findCollectionByNameOrId("students");
  students.fields.add(new TextField({ name: "name", max: 80 }));
  app.save(students);
  for (const student of app.findAllRecords("students")) {
    const prefix = student.getString("lastPrefix");
    const first = student.getString("firstName");
    student.set("name", prefix ? first + " " + prefix : first);
    app.save(student);
  }
  const reverted = app.findCollectionByNameOrId("students");
  reverted.fields.removeByName("firstName");
  reverted.fields.removeByName("lastPrefix");
  reverted.fields.removeByName("status");
  app.save(reverted);
});
