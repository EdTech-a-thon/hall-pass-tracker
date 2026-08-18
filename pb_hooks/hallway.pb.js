routerAdd("POST", "/api/hallway/devices/link-code", (e) => {
  const code = $security.randomStringWithAlphabet(8, "0123456789");
  const record = new Record(e.app.findCollectionByNameOrId("device_link_codes"));
  record.set("codeHash", $security.sha256(code));
  record.set("teacher", e.auth.id);
  record.set("expiresAt", new DateTime(new Date(Date.now() + 300 * 1000).toISOString()));
  record.set("used", false);
  e.app.save(record);
  return e.json(200, { code, expiresAt: record.getString("expiresAt") });
}, $apis.requireAuth("teachers"), $apis.bodyLimit(1024));

routerAdd("POST", "/api/hallway/devices/pair", (e) => {
  const body = new DynamicModel({ pairingCode: "" });
  e.bindBody(body);
  if (!/^\d{8}$/.test(body.pairingCode)) throw new BadRequestError("Invalid or expired link code");
  let response;
  e.app.runInTransaction((tx) => {
    let link;
    try {
      link = tx.findFirstRecordByFilter("device_link_codes", "codeHash = {:hash} && used = false && expiresAt > @now", { hash: $security.sha256(body.pairingCode) });
    } catch (_) { throw new BadRequestError("Invalid or expired link code"); }
    link.set("used", true);
    tx.save(link);
    const device = new Record(tx.findCollectionByNameOrId("kiosk_devices"));
    device.set("email", `${$security.randomString(20)}@device.invalid`);
    device.set("name", "Classroom kiosk");
    device.set("teacher", link.getString("teacher"));
    device.set("active", true);
    device.setRandomPassword();
    tx.save(device);
    response = { token: device.newAuthToken(), record: { id: device.id, collectionName: "kiosk_devices", name: device.getString("name"), active: true } };
  });
  return e.json(200, response);
}, $apis.requireGuestOnly(), $apis.bodyLimit(1024));

routerAdd("POST", "/api/hallway/devices/revoke", (e) => {
  const body = new DynamicModel({ deviceId: "" });
  e.bindBody(body);
  const device = e.app.findFirstRecordByFilter("kiosk_devices", "id = {:id} && teacher = {:teacher}", { id: body.deviceId, teacher: e.auth.id });
  device.set("active", false);
  device.refreshTokenKey();
  e.app.save(device);
  return e.noContent(204);
}, $apis.requireAuth("teachers"), $apis.bodyLimit(1024));

routerAdd("PUT", "/api/hallway/vault", (e) => {
  const body = new DynamicModel({ payload: "", version: 0 });
  e.bindBody(body);
  if (body.payload.length < 40 || body.payload.length > 1048576 || body.version !== 1) throw new BadRequestError("Invalid encrypted vault");
  let vault;
  try { vault = e.app.findFirstRecordByData("class_vaults", "teacher", e.auth.id); }
  catch (_) { vault = new Record(e.app.findCollectionByNameOrId("class_vaults")); }
  vault.set("teacher", e.auth.id);
  vault.set("payload", body.payload);
  vault.set("version", body.version);
  e.app.save(vault);
  return e.noContent(204);
}, $apis.requireAuth("teachers"), $apis.bodyLimit(1100000));

routerAdd("GET", "/api/hallway/vault", (e) => {
  const vault = e.app.findFirstRecordByData("class_vaults", "teacher", e.auth.id);
  return e.json(200, { payload: vault.getString("payload"), version: vault.getInt("version") });
}, $apis.requireAuth("teachers"));
