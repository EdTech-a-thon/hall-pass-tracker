/// <reference path="../pb_data/types.d.ts" />

// The glossary settled on "Destination" for the place a student is going.
// "Reason" described a justification, which is not what students choose here,
// and the two words were already drifting apart across the interface.
migrate((app) => {
  const events = app.findCollectionByNameOrId("pass_events");
  events.fields.getByName("reason").name = "destination";
  app.save(events);
}, (app) => {
  const events = app.findCollectionByNameOrId("pass_events");
  events.fields.getByName("destination").name = "reason";
  app.save(events);
});
