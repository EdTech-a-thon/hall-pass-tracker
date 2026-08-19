import { expect, test } from '@playwright/test';
import PocketBase, { BaseAuthStore, ClientResponseError } from 'pocketbase';

const backendUrl = process.env.PB_E2E_URL || '';
const backendTest = backendUrl ? test : test.skip;

function client() {
  return new PocketBase(backendUrl, new BaseAuthStore());
}

/**
 * PocketBase rate-limits sign-ins to two every three seconds, which a test run
 * hits easily. Wait out a "too many requests" answer instead of failing on it.
 */
async function patiently<T>(attempt: () => Promise<T>): Promise<T> {
  for (let remaining = 5; ; remaining -= 1) {
    try {
      return await attempt();
    } catch (caught) {
      const rateLimited = caught instanceof ClientResponseError && caught.status === 429;
      if (!rateLimited || remaining === 0) throw caught;
      await new Promise((resume) => setTimeout(resume, 3100));
    }
  }
}

function account(label: string) {
  const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return { email: `${label.replaceAll(' ', '').toLowerCase()}-${unique}@example.com`, password: `Secure-${unique}-Password!`, displayName: label };
}

async function registerTeacher(label: string) {
  const pb = client();
  const credentials = account(label);
  await patiently(() => pb.collection('teachers').create({ ...credentials, passwordConfirm: credentials.password }));
  await patiently(() => pb.collection('teachers').authWithPassword(credentials.email, credentials.password));
  return { pb, credentials };
}

backendTest('real PocketBase registration is public but records remain private', async () => {
  const first = await registerTeacher('Teacher One');
  const second = await registerTeacher('Teacher Two');
  expect(first.pb.authStore.record?.id).not.toBe(second.pb.authStore.record?.id);
  await expect(first.pb.collection('teachers').getOne(second.pb.authStore.record!.id)).rejects.toMatchObject({ status: 404 });
  await expect(client().collection('teachers').getFullList()).resolves.toEqual([]);
});

async function classroom(label: string) {
  const teacher = await registerTeacher(label);
  const id = teacher.pb.authStore.record!.id;
  await teacher.pb.collection('teachers').update(id, { passLimit: 1 });
  await teacher.pb.collection('students').create({ teacher: id, studentId: '5620', name: 'Avery Brooks' });
  const link = await teacher.pb.send<{ id: string; token: string }>('/api/hallway/kiosk/links', { method: 'POST', body: { label: 'Door' } });
  return { ...teacher, id, link };
}

backendTest('a kiosk link reads its own roster and nothing else', async () => {
  const room = await classroom('Roster Teacher');
  const other = await classroom('Other Teacher');
  const kiosk = client();
  const session = await kiosk.send<{ label: string; limit: number; students: { id: string; name: string }[] }>(
    '/api/hallway/kiosk/session', { method: 'POST', body: { token: room.link.token } });
  expect(session.students).toEqual([{ id: '5620', name: 'Avery Brooks' }]);
  expect(session.limit).toBe(1);
  // The token names the classroom, so one link can never reach another teacher's class.
  const strangerSession = await kiosk.send<{ students: unknown[] }>('/api/hallway/kiosk/session', { method: 'POST', body: { token: other.link.token } });
  expect(strangerSession.students).toHaveLength(1);
  await expect(kiosk.send('/api/hallway/kiosk/session', { method: 'POST', body: { token: 'z'.repeat(40) } })).rejects.toMatchObject({ status: 400 });
});

backendTest('a kiosk can append to the pass log but never read, edit, or delete it', async () => {
  const room = await classroom('Log Teacher');
  const kiosk = client();
  const approved = await kiosk.send<{ status: string; name: string }>('/api/hallway/kiosk/events', {
    method: 'POST', body: { token: room.link.token, studentId: '5620', kind: 'out', reason: 'Water', minutes: 5 },
  });
  expect(approved).toMatchObject({ status: 'approved', name: 'Avery Brooks' });

  const entries = await room.pb.collection('pass_events').getFullList();
  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({ studentId: '5620', kind: 'out', source: 'kiosk' });

  // Everything the kiosk is not allowed to do, attempted with the link in hand.
  await expect(kiosk.collection('pass_events').getFullList()).resolves.toEqual([]);
  await expect(kiosk.collection('students').getFullList()).resolves.toEqual([]);
  await expect(kiosk.collection('pass_events').update(entries[0].id, { kind: 'in' })).rejects.toMatchObject({ status: 403 });
  await expect(kiosk.collection('pass_events').delete(entries[0].id)).rejects.toMatchObject({ status: 403 });
  await expect(kiosk.collection('pass_events').create({ teacher: room.id, studentId: '5620', studentName: 'Avery Brooks', kind: 'in', source: 'kiosk' })).rejects.toMatchObject({ status: 400 });
  await expect(kiosk.send('/api/hallway/kiosk/links', { method: 'POST', body: {} })).rejects.toMatchObject({ status: 401 });
});

backendTest('the server, not the kiosk, decides when the hallway is full', async () => {
  const room = await classroom('Limit Teacher');
  await room.pb.collection('students').create({ teacher: room.id, studentId: '4419', name: 'Noah Williams' });
  const kiosk = client();
  const send = (studentId: string, kind: string) =>
    kiosk.send<{ status: string; out: number; limit: number }>('/api/hallway/kiosk/events', {
      method: 'POST', body: { token: room.link.token, studentId, kind, reason: 'Water', minutes: 5 },
    });

  await expect(send('5620', 'out')).resolves.toMatchObject({ status: 'approved', out: 1, limit: 1 });
  // The limit lives on the teacher record; a kiosk cannot talk its way past it.
  await expect(send('4419', 'out')).resolves.toMatchObject({ status: 'denied', out: 1, limit: 1 });
  await expect(send('5620', 'out')).rejects.toMatchObject({ status: 400 });
  await expect(send('5620', 'in')).resolves.toMatchObject({ status: 'returned', out: 0 });
  await expect(send('4419', 'out')).resolves.toMatchObject({ status: 'approved', out: 1 });
  await expect(send('0000', 'out')).rejects.toMatchObject({ status: 400 });
  expect(await room.pb.collection('pass_events').getFullList()).toHaveLength(3);
});

backendTest('only the owning teacher can revoke a kiosk link, and revoking stops it at once', async () => {
  const room = await classroom('Revoke Teacher');
  const stranger = await registerTeacher('Nosy Teacher');
  await expect(stranger.pb.send('/api/hallway/kiosk/links/revoke', { method: 'POST', body: { linkId: room.link.id } })).rejects.toBeInstanceOf(ClientResponseError);
  await room.pb.send('/api/hallway/kiosk/links/revoke', { method: 'POST', body: { linkId: room.link.id } });
  await expect(client().send('/api/hallway/kiosk/session', { method: 'POST', body: { token: room.link.token } })).rejects.toMatchObject({ status: 400 });
  await expect(client().send('/api/hallway/kiosk/events', { method: 'POST', body: { token: room.link.token, studentId: '5620', kind: 'out' } })).rejects.toMatchObject({ status: 400 });
});

backendTest('the raw kiosk token is never stored or handed back', async () => {
  const room = await classroom('Token Teacher');
  const stored = await room.pb.collection('kiosk_links').getFullList();
  expect(stored).toHaveLength(1);
  expect(JSON.stringify(stored[0])).not.toContain(room.link.token);
});

backendTest('custom routes enforce authentication and body validation', async () => {
  const guest = client();
  await expect(guest.send('/api/hallway/kiosk/links', { method: 'POST', body: {} })).rejects.toMatchObject({ status: 401 });
  await expect(guest.send('/api/hallway/kiosk/links/revoke', { method: 'POST', body: { linkId: 'anything' } })).rejects.toMatchObject({ status: 401 });
  await expect(guest.send('/api/hallway/kiosk/session', { method: 'POST', body: { token: 'short' } })).rejects.toMatchObject({ status: 400 });
  await expect(guest.send('/api/hallway/kiosk/events', { method: 'POST', body: { token: 'a'.repeat(40), studentId: '5620', kind: 'sideways' } })).rejects.toMatchObject({ status: 400 });
});
