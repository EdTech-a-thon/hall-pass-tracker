/// <reference path="../pb_data/types.d.ts" />

// A teacher does not teach one group, they teach five or six across a day.
// Every Student, and every Pass Event, now belongs to a Class, and the teacher's
// account remembers which Class the door screen is showing. Keeping the Active
// Class on the account rather than in a browser is what lets the dashboard and
// the door screen agree, and what makes closing a Class's open passes on a
// switch something the server can guarantee.
migrate((app) => {
  const classes = new Collection({
    type: "base", name: "classes",
    listRule: "teacher = @request.auth.id", viewRule: "teacher = @request.auth.id",
    createRule: "@request.body.teacher = @request.auth.id",
    updateRule: "teacher = @request.auth.id && @request.body.teacher:isset = false",
    deleteRule: "teacher = @request.auth.id",
    fields: [
      { type: "text", name: "teacher", required: true, min: 15, max: 15 },
      { type: "text", name: "name", required: true, min: 1, max: 60 },
      { type: "number", name: "position", min: 0 },
      // Archived, never deleted: a Class that is over keeps its Students and
      // its history, it just stops appearing in the switcher.
      { type: "bool", name: "archived" },
      { type: "autodate", name: "at", onCreate: true },
    ],
    indexes: ["CREATE INDEX idx_classes_teacher ON classes (teacher, position)"],
  });
  app.save(classes);

  // Added permissively first so existing rows stay valid, then tightened once
  // every row has been given a Class below.
  const students = app.findCollectionByNameOrId("students");
  students.fields.add(new TextField({ name: "class", max: 15 }));
  app.save(students);

  const events = app.findCollectionByNameOrId("pass_events");
  events.fields.add(new TextField({ name: "class", max: 15 }));
  app.save(events);

  const teachers = app.findCollectionByNameOrId("teachers");
  teachers.fields.add(new TextField({ name: "activeClass", max: 15 }));
  app.save(teachers);

  // Every existing teacher keeps what they have, inside a single Class.
  const existing = app.findAllRecords("teachers");
  for (const teacher of existing) {
    const room = new Record(classes);
    room.set("teacher", teacher.id);
    room.set("name", "My class");
    room.set("position", 0);
    room.set("archived", false);
    app.save(room);

    teacher.set("activeClass", room.id);
    app.save(teacher);

    for (const student of app.findAllRecords("students", $dbx.hashExp({ teacher: teacher.id }))) {
      student.set("class", room.id);
      app.save(student);
    }
    for (const entry of app.findAllRecords("pass_events", $dbx.hashExp({ teacher: teacher.id }))) {
      entry.set("class", room.id);
      app.save(entry);
    }
  }

  // Now that nothing is unassigned, a Class becomes mandatory.
  const assignedStudents = app.findCollectionByNameOrId("students");
  assignedStudents.fields.getByName("class").required = true;
  assignedStudents.fields.getByName("class").min = 15;
  app.save(assignedStudents);

  const assignedEvents = app.findCollectionByNameOrId("pass_events");
  assignedEvents.fields.getByName("class").required = true;
  assignedEvents.fields.getByName("class").min = 15;
  app.save(assignedEvents);
}, (app) => {
  const students = app.findCollectionByNameOrId("students");
  students.fields.removeByName("class");
  app.save(students);

  const events = app.findCollectionByNameOrId("pass_events");
  events.fields.removeByName("class");
  app.save(events);

  const teachers = app.findCollectionByNameOrId("teachers");
  teachers.fields.removeByName("activeClass");
  app.save(teachers);

  try { app.delete(app.findCollectionByNameOrId("classes")); } catch (_) {}
});
