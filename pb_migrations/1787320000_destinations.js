/// <reference path="../pb_data/types.d.ts" />

// Where a student may go stops being four places chosen in the code and becomes
// the teacher's own list, account-wide. Each Destination carries the number of
// minutes that trip is expected to take, so "Restroom" and "Counsellor" are not
// held to the same standard. The student no longer picks a duration at all.
migrate((app) => {
  const teachers = app.findCollectionByNameOrId("teachers");
  teachers.fields.add(new JSONField({ name: "destinations", maxSize: 4096 }));
  app.save(teachers);

  // Every existing teacher starts from the list the app used to hardcode, so
  // nobody opens the app to an empty kiosk.
  const starting = [
    { label: "Restroom", minutes: 8 },
    { label: "Water", minutes: 5 },
    { label: "Main office", minutes: 10 },
    { label: "Counselor", minutes: 20 },
  ];
  for (const teacher of app.findAllRecords("teachers")) {
    teacher.set("destinations", starting);
    app.save(teacher);
  }
}, (app) => {
  const teachers = app.findCollectionByNameOrId("teachers");
  teachers.fields.removeByName("destinations");
  app.save(teachers);
});
