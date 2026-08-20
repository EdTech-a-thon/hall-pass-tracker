/// <reference path="../pb_data/types.d.ts" />

// Moving the door screen to the next Class ends any trip still open in the one
// being left. That is not the same event as a student walking back in, and the
// difference matters: we do not know when they actually returned. Recording it
// as its own source is what lets analytics leave those trips out of average
// times and overdue counts instead of inventing a duration for them.
migrate((app) => {
  const events = app.findCollectionByNameOrId("pass_events");
  const source = events.fields.getByName("source");
  source.pattern = "^(kiosk|teacher|cancelled|switch)$";
  app.save(events);
}, (app) => {
  const events = app.findCollectionByNameOrId("pass_events");
  const source = events.fields.getByName("source");
  source.pattern = "^(kiosk|teacher|cancelled)$";
  app.save(events);
});
