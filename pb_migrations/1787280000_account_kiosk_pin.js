/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const teachers = app.findCollectionByNameOrId("teachers");
  teachers.fields.add(new TextField({ name: "kioskPinHash", max: 255, hidden: true }));
  app.save(teachers);

  try { app.delete(app.findCollectionByNameOrId("kiosk_links")); } catch (_) {}
}, (app) => {
  const teachers = app.findCollectionByNameOrId("teachers");
  teachers.fields.removeByName("kioskPinHash");
  app.save(teachers);
});
