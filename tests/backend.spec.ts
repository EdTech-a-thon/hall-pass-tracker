import { expect, test } from '@playwright/test';
import PocketBase, { BaseAuthStore, ClientResponseError } from 'pocketbase';

const backendUrl = process.env.PB_E2E_URL || '';
const backendTest = backendUrl ? test : test.skip;
const client = () => new PocketBase(backendUrl, new BaseAuthStore());

async function patiently<T>(attempt: () => Promise<T>): Promise<T> {
  for (let remaining = 5; ; remaining -= 1) {
    try { return await attempt(); } catch (caught) {
      if (!(caught instanceof ClientResponseError) || caught.status !== 429 || remaining === 0) throw caught;
      await new Promise((resume) => setTimeout(resume, 3100));
    }
  }
}

async function registerTeacher(label: string) {
  const pb = client();
  const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const credentials = { email: `${label.replaceAll(' ', '').toLowerCase()}-${unique}@example.com`, password: `Secure-${unique}-Password!`, displayName: label };
  await patiently(() => pb.collection('teachers').create({ ...credentials, passwordConfirm: credentials.password }));
  await patiently(() => pb.collection('teachers').authWithPassword(credentials.email, credentials.password));
  return { pb, credentials };
}

async function classroom(label: string) {
  const teacher = await registerTeacher(label);
  const id = teacher.pb.authStore.record!.id;
  await teacher.pb.collection('teachers').update(id, { passLimit: 1 });
  await teacher.pb.collection('students').create({ teacher: id, studentId: '5620', name: 'Avery Brooks' });
  return { ...teacher, id };
}

backendTest('real PocketBase registration is public but records remain private', async () => {
  const first = await registerTeacher('Teacher One');
  const second = await registerTeacher('Teacher Two');
  expect(first.pb.authStore.record?.id).not.toBe(second.pb.authStore.record?.id);
  await expect(first.pb.collection('teachers').getOne(second.pb.authStore.record!.id)).rejects.toMatchObject({ status: 404 });
  await expect(client().collection('teachers').getFullList()).resolves.toEqual([]);
});

backendTest('an authenticated kiosk action appends to the teacher pass log', async () => {
  const room = await classroom('Log Teacher');
  const approved = await room.pb.send<{ status: string; name: string }>('/api/hallway/kiosk/events', {
    method: 'POST', body: { studentId: '5620', kind: 'out', destination: 'Water', minutes: 5 },
  });
  expect(approved).toMatchObject({ status: 'approved', name: 'Avery Brooks' });
  const entries = await room.pb.collection('pass_events').getFullList();
  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({ studentId: '5620', kind: 'out', source: 'kiosk' });
});

backendTest('the server decides when the hallway is full', async () => {
  const room = await classroom('Limit Teacher');
  await room.pb.collection('students').create({ teacher: room.id, studentId: '4419', name: 'Noah Williams' });
  const send = (studentId: string, kind: string) => room.pb.send<{ status: string; out: number; limit: number }>('/api/hallway/kiosk/events', {
    method: 'POST', body: { studentId, kind, destination: 'Water', minutes: 5 },
  });
  await expect(send('5620', 'out')).resolves.toMatchObject({ status: 'approved', out: 1, limit: 1 });
  await expect(send('4419', 'out')).resolves.toMatchObject({ status: 'denied', out: 1, limit: 1 });
  await expect(send('5620', 'in')).resolves.toMatchObject({ status: 'returned', out: 0 });
});

backendTest('the kiosk PIN is remembered as a hidden hash', async () => {
  const room = await classroom('PIN Teacher');
  await expect(room.pb.send<{ hasPin: boolean }>('/api/hallway/kiosk/pin/status', {})).resolves.toEqual({ hasPin: false });
  await room.pb.send('/api/hallway/kiosk/pin', { method: 'POST', body: { pin: '123456' } });
  await expect(room.pb.send<{ hasPin: boolean }>('/api/hallway/kiosk/pin/status', {})).resolves.toEqual({ hasPin: true });
  await expect(room.pb.send('/api/hallway/kiosk/pin/verify', { method: 'POST', body: { pin: '000000' } })).rejects.toMatchObject({ status: 400 });
  await expect(room.pb.send('/api/hallway/kiosk/pin/verify', { method: 'POST', body: { pin: '123456' } })).resolves.toEqual({});
  const record = await room.pb.collection('teachers').getOne(room.id);
  expect(JSON.stringify(record)).not.toContain('123456');
  expect(record).not.toHaveProperty('kioskPinHash');
});

backendTest('kiosk routes require a teacher account and validate the PIN', async () => {
  const guest = client();
  await expect(guest.send('/api/hallway/kiosk/pin/status', {})).rejects.toMatchObject({ status: 401 });
  await expect(guest.send('/api/hallway/kiosk/pin', { method: 'POST', body: { pin: '123456' } })).rejects.toMatchObject({ status: 401 });
  const room = await classroom('Validation Teacher');
  await expect(room.pb.send('/api/hallway/kiosk/pin', { method: 'POST', body: { pin: '12345' } })).rejects.toMatchObject({ status: 400 });
});
