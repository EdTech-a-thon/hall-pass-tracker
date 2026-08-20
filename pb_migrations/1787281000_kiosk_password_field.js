/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const teachers = app.findCollectionByNameOrId("teachers");
  teachers.fields.removeByName("kioskPinHash");
  teachers.fields.add(new PasswordField({
    name: "kioskPin",
    hidden: true,
    min: 6,
    max: 6,
    pattern: "^[0-9]{6}$",
  }));
  app.save(teachers);
}, (app) => {
  const teachers = app.findCollectionByNameOrId("teachers");
  teachers.fields.removeByName("kioskPin");
  teachers.fields.add(new TextField({ name: "kioskPinHash", max: 255, hidden: true }));
  app.save(teachers);
});
