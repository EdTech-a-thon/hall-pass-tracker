migrate((app) => {
  const teachers = app.findCollectionByNameOrId("teachers");
  teachers.authRule = "";
  teachers.createRule = "@request.body.emailVisibility = false && @request.body.verified = false && @request.body.displayName != ''";
  teachers.otp.enabled = false;
  teachers.mfa.enabled = false;
  app.save(teachers);
}, (app) => {
  const teachers = app.findCollectionByNameOrId("teachers");
  teachers.authRule = "verified = true";
  teachers.createRule = null;
  teachers.otp.enabled = true;
  teachers.mfa.enabled = true;
  app.save(teachers);
});
