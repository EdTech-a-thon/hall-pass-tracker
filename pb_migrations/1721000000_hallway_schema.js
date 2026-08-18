migrate((app) => {
  const teachers = new Collection({
    type: "auth", name: "teachers", authRule: "verified = true",
    listRule: "id = @request.auth.id", viewRule: "id = @request.auth.id",
    createRule: null, updateRule: "id = @request.auth.id && @request.body.verified:changed = false",
    deleteRule: null, manageRule: null,
    passwordAuth: { enabled: true, identityFields: ["email"] },
    otp: { enabled: true, duration: 300, length: 8 },
    mfa: { enabled: true, duration: 300, rule: "" },
    fields: [{ type: "text", name: "displayName", required: true, min: 1, max: 80 }],
  });
  app.save(teachers);

  const devices = new Collection({
    type: "auth", name: "kiosk_devices", authRule: "active = true",
    listRule: null, viewRule: "id = @request.auth.id && active = true",
    createRule: null, updateRule: null, deleteRule: null, manageRule: null,
    passwordAuth: { enabled: false },
    fields: [
      { type: "text", name: "name", required: true, min: 1, max: 80 },
      { type: "bool", name: "active" },
      { type: "text", name: "teacher", required: true, min: 15, max: 15 },
    ],
  });
  app.save(devices);

  const links = new Collection({
    type: "base", name: "device_link_codes",
    listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { type: "text", name: "codeHash", required: true, min: 64, max: 64, hidden: true },
      { type: "text", name: "teacher", required: true, min: 15, max: 15 },
      { type: "date", name: "expiresAt", required: true },
      { type: "bool", name: "used" },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_device_link_code_hash ON device_link_codes (codeHash)"],
  });
  app.save(links);

  const vaults = new Collection({
    type: "base", name: "class_vaults",
    listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { type: "text", name: "teacher", required: true, min: 15, max: 15 },
      { type: "text", name: "payload", required: true, max: 1048576 },
      { type: "number", name: "version", required: true, min: 1 },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_class_vault_teacher ON class_vaults (teacher)"],
  });
  app.save(vaults);

  const settings = app.settings();
  settings.meta.appName = "Hallway";
  settings.logs.maxDays = 7;
  settings.logs.logIP = false;
  settings.logs.logAuthId = true;
  settings.rateLimits.enabled = true;
  app.save(settings);
}, (app) => {
  for (const name of ["class_vaults", "device_link_codes", "kiosk_devices", "teachers"]) {
    try { app.delete(app.findCollectionByNameOrId(name)); } catch (_) {}
  }
});
