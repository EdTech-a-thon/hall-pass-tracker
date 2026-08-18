migrate((app) => {
  const teachers = app.findCollectionByNameOrId("teachers");
  // PocketBase initializes verified=false and emailVisibility=false server-side.
  // Omitting either field must not make an otherwise safe registration fail.
  teachers.createRule = "@request.body.verified:isset = false && @request.body.emailVisibility:isset = false && @request.body.displayName != ''";
  app.save(teachers);
}, (app) => {
  const teachers = app.findCollectionByNameOrId("teachers");
  teachers.createRule = "@request.body.emailVisibility = false && @request.body.verified = false && @request.body.displayName != ''";
  app.save(teachers);
});
