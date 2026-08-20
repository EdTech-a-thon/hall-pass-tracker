/// <reference path="../pb_data/types.d.ts" />

// A student who taps the wrong name gets a few seconds to undo it. The log is
// append-only, so the undo cannot delete anything - it writes a return marked
// "cancelled". Naming it rather than reusing "kiosk" is what lets analytics
// leave it out: the trip never really happened, so its duration is not a real
// duration and must not reach the average.
migrate((app) => {
  const events = app.findCollectionByNameOrId("pass_events");
  const source = events.fields.getByName("source");
  source.pattern = "^(kiosk|teacher|cancelled)$";
  source.max = 9;
  app.save(events);
}, (app) => {
  const events = app.findCollectionByNameOrId("pass_events");
  const source = events.fields.getByName("source");
  source.pattern = "^(kiosk|teacher)$";
  source.max = 7;
  app.save(events);
});
