/// <reference path="../pb_data/types.d.ts" />

// The contract half of the expand-contract begun when Display Names arrived.
// Students identify themselves by tapping a name now, so the four-digit number
// has no reader left. A Pass Event points at the roster row instead, which also
// means a Student's history survives them being renamed.
migrate((app) => {
  const events = app.findCollectionByNameOrId("pass_events");
  events.fields.add(new TextField({ name: "student", max: 15 }));
  app.save(events);

  // Re-point each entry at its roster row. An entry whose Student cannot be
  // found is dropped rather than contorting the schema to keep it: the affected
  // rows are prototype demo data, confirmed with the developer.
  const orphaned = [];
  for (const entry of app.findAllRecords("pass_events")) {
    let student = null;
    try {
      student = app.findFirstRecordByFilter(
        "students",
        "teacher = {:teacher} && class = {:class} && studentId = {:studentId}",
        { teacher: entry.getString("teacher"), class: entry.getString("class"), studentId: entry.getString("studentId") },
      );
    } catch (_) { student = null; }
    if (!student) { orphaned.push(entry); continue; }
    entry.set("student", student.id);
    app.save(entry);
  }
  for (const entry of orphaned) app.delete(entry);

  const repointed = app.findCollectionByNameOrId("pass_events");
  repointed.fields.getByName("student").required = true;
  repointed.fields.getByName("student").min = 15;
  repointed.fields.removeByName("studentId");
  repointed.indexes = ["CREATE INDEX idx_pass_events_teacher ON pass_events (teacher, at)"];
  app.save(repointed);

  const students = app.findCollectionByNameOrId("students");
  students.fields.removeByName("studentId");
  // The uniqueness that mattered was never the number; it is the Display Name,
  // and the importer is what enforces it.
  students.indexes = [];
  students.fields.getByName("firstName").required = true;
  students.fields.getByName("firstName").min = 1;
  app.save(students);
}, (app) => {
  const students = app.findCollectionByNameOrId("students");
  students.fields.add(new TextField({ name: "studentId", max: 12 }));
  app.save(students);
  let next = 1000;
  for (const student of app.findAllRecords("students")) {
    next += 1;
    student.set("studentId", String(next));
    app.save(student);
  }

  const events = app.findCollectionByNameOrId("pass_events");
  events.fields.add(new TextField({ name: "studentId", max: 12 }));
  app.save(events);
  for (const entry of app.findAllRecords("pass_events")) {
    try {
      entry.set("studentId", app.findRecordById("students", entry.getString("student")).getString("studentId"));
      app.save(entry);
    } catch (_) {}
  }
  const reverted = app.findCollectionByNameOrId("pass_events");
  reverted.fields.removeByName("student");
  app.save(reverted);
});
