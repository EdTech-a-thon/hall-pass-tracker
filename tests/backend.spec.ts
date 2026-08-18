import { expect, test } from '@playwright/test';
import PocketBase, { BaseAuthStore, ClientResponseError } from 'pocketbase';

const backendUrl = process.env.PB_E2E_URL || '';
const backendTest = backendUrl ? test : test.skip;

function client() {
  return new PocketBase(backendUrl, new BaseAuthStore());
}

function account(label: string) {
  const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return { email: `${label.replaceAll(' ', '').toLowerCase()}-${unique}@example.com`, password: `Secure-${unique}-Password!`, displayName: label };
}

async function registerTeacher(label: string) {
  const pb = client();
  const credentials = account(label);
  await pb.collection('teachers').create({ ...credentials, passwordConfirm: credentials.password });
  await pb.collection('teachers').authWithPassword(credentials.email, credentials.password);
  return { pb, credentials };
}

backendTest('real PocketBase registration is public but records remain private', async () => {
  const first = await registerTeacher('Teacher One');
  const second = await registerTeacher('Teacher Two');
  expect(first.pb.authStore.record?.id).not.toBe(second.pb.authStore.record?.id);
  await expect(first.pb.collection('teachers').getOne(second.pb.authStore.record!.id)).rejects.toMatchObject({ status: 404 });
  await expect(client().collection('teachers').getFullList()).resolves.toEqual([]);
});

backendTest('encrypted classroom vaults are isolated by authenticated owner', async () => {
  const first = await registerTeacher('Vault One');
  const second = await registerTeacher('Vault Two');
  const payloadOne = JSON.stringify({ version: 1, cipher: 'A'.repeat(64) });
  const payloadTwo = JSON.stringify({ version: 1, cipher: 'B'.repeat(64) });
  await first.pb.send('/api/hallway/vault', { method: 'PUT', body: { payload: payloadOne, version: 1 } });
  await second.pb.send('/api/hallway/vault', { method: 'PUT', body: { payload: payloadTwo, version: 1 } });
  await expect(first.pb.send('/api/hallway/vault')).resolves.toMatchObject({ payload: payloadOne });
  await expect(second.pb.send('/api/hallway/vault')).resolves.toMatchObject({ payload: payloadTwo });
});

backendTest('kiosk link code is single use and creates a restricted refreshable device', async () => {
  const teacher = await registerTeacher('Pairing Teacher');
  const link = await teacher.pb.send<{ code: string }>('/api/hallway/devices/link-code', { method: 'POST' });
  expect(link.code).toMatch(/^\d{8}$/);
  const kiosk = client();
  const paired = await kiosk.send<{ token: string; record: { id: string; collectionName: string } }>('/api/hallway/devices/pair', { method: 'POST', body: { pairingCode: link.code } });
  expect(paired.record.collectionName).toBe('kiosk_devices');
  kiosk.authStore.save(paired.token, paired.record as never);
  await expect(kiosk.collection('kiosk_devices').authRefresh()).resolves.toMatchObject({ record: { id: paired.record.id } });
  await expect(client().send('/api/hallway/devices/pair', { method: 'POST', body: { pairingCode: link.code } })).rejects.toBeInstanceOf(ClientResponseError);
  await expect(kiosk.send('/api/hallway/devices/link-code', { method: 'POST' })).rejects.toMatchObject({ status: 403 });
});

backendTest('only the owning teacher can revoke a kiosk and copied tokens stop refreshing', async () => {
  const owner = await registerTeacher('Device Owner');
  const stranger = await registerTeacher('Other Teacher');
  const link = await owner.pb.send<{ code: string }>('/api/hallway/devices/link-code', { method: 'POST' });
  const paired = await client().send<{ token: string; record: { id: string } }>('/api/hallway/devices/pair', { method: 'POST', body: { pairingCode: link.code } });
  await expect(stranger.pb.send('/api/hallway/devices/revoke', { method: 'POST', body: { deviceId: paired.record.id } })).rejects.toBeInstanceOf(ClientResponseError);
  await owner.pb.send('/api/hallway/devices/revoke', { method: 'POST', body: { deviceId: paired.record.id } });
  const copied = client();
  copied.authStore.save(paired.token, paired.record as never);
  await expect(copied.collection('kiosk_devices').authRefresh()).rejects.toMatchObject({ status: 401 });
});

backendTest('custom routes enforce authentication and body validation', async () => {
  const guest = client();
  await expect(guest.send('/api/hallway/devices/link-code', { method: 'POST' })).rejects.toMatchObject({ status: 401 });
  await expect(guest.send('/api/hallway/vault', { method: 'PUT', body: { payload: 'plain student data', version: 1 } })).rejects.toMatchObject({ status: 401 });
  await expect(guest.send('/api/hallway/devices/pair', { method: 'POST', body: { pairingCode: '1234' } })).rejects.toMatchObject({ status: 400 });
  const teacher = await registerTeacher('Validation Teacher');
  await expect(teacher.pb.send('/api/hallway/vault', { method: 'PUT', body: { payload: 'too short', version: 1 } })).rejects.toMatchObject({ status: 400 });
});
