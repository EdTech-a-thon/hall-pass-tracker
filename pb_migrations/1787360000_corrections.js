/// <reference path="../pb_data/types.d.ts" />

// Teachers need to give a trip to the student it really belonged to and to
// adjust when it started or ended. The log cannot be updated or deleted -- that
// is the guarantee the whole design rests on -- so a Correction is a *new*
// entry that amends an earlier one. The dashboard, analytics and exports read
// the corrected view; the original stays underneath, untouched.
//
// Notice what this buys: the teacher asked for edits and for a record of the
// edits, and under this shape those are the same thing. The audit trail is not
// a second system to keep in step, it is the log doing what it already does.
// See docs/adr/0004-corrections-are-new-entries-never-edits.md.
migrate((app) => {
  const events = app.findCollectionByNameOrId("pass_events");

  const kind = events.fields.getByName("kind");
  kind.pattern = "^(out|in|fix)$";
  kind.max = 3;

  // Which entry this one amends. Empty on an ordinary exit or return.
  events.fields.add(new TextField({ name: "corrects", max: 15 }));
  // The Student the trip really belonged to, when that is what was wrong.
  events.fields.add(new TextField({ name: "newStudent", max: 15 }));
  // A replacement time for the entry being amended.
  events.fields.add(new DateField({ name: "newAt" }));
  app.save(events);
}, (app) => {
  const events = app.findCollectionByNameOrId("pass_events");
  events.fields.removeByName("corrects");
  events.fields.removeByName("newStudent");
  events.fields.removeByName("newAt");
  const kind = events.fields.getByName("kind");
  kind.pattern = "^(out|in)$";
  app.save(events);
});
