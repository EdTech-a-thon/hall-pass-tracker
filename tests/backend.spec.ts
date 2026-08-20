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
  const room = await patiently(() => teacher.pb.collection('classes').create({ teacher: id, name: 'Period 1', position: 0, archived: false }));
  await patiently(() => teacher.pb.collection('teachers').update(id, {
    passLimit: 1,
    activeClass: room.id,
    destinations: [{ label: 'Water', minutes: 5 }],
  }));
  const avery = await patiently(() => teacher.pb.collection('students').create({
    teacher: id, class: room.id, firstName: 'Avery', lastPrefix: 'B', status: 'current',
  }));
  return { ...teacher, id, room: room.id, avery: avery.id };
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
  const approved = await room.pb.send<{ status: string; name: string; minutes: number }>('/api/hallway/kiosk/events', {
    method: 'POST', body: { student: room.avery, kind: 'out', destination: 'Water' },
  });
  // The name is composed from a first name and a prefix; no full last name exists.
  expect(approved).toMatchObject({ status: 'approved', name: 'Avery B.' });
  // The expected minutes come from the teacher's own list, not from this request.
  expect(approved.minutes).toBe(5);
  const entries = await room.pb.collection('pass_events').getFullList();
  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({ student: room.avery, kind: 'out', source: 'kiosk', class: room.room });
});

backendTest('the pass log refuses to be rewritten, even by the teacher who owns it', async () => {
  const room = await classroom('Append Only Teacher');
  await room.pb.send('/api/hallway/kiosk/events', {
    method: 'POST', body: { student: room.avery, kind: 'out', destination: 'Water' },
  });
  const [entry] = await room.pb.collection('pass_events').getFullList();
  // This is the guarantee the whole correction design rests on. See docs/adr/0004.
  await expect(room.pb.collection('pass_events').update(entry.id, { destination: 'Nurse' })).rejects.toThrow();
  await expect(room.pb.collection('pass_events').delete(entry.id)).rejects.toThrow();
  // Refused, and unchanged: the entry is still there and still says what it said.
  const after = await room.pb.collection('pass_events').getFullList();
  expect(after).toHaveLength(1);
  expect(after[0]).toMatchObject({ id: entry.id, destination: 'Water' });
});

backendTest('a destination the teacher has not set up is refused', async () => {
  const room = await classroom('Destination Teacher');
  await expect(room.pb.send('/api/hallway/kiosk/events', {
    method: 'POST', body: { student: room.avery, kind: 'out', destination: 'Rooftop' },
  })).rejects.toMatchObject({ status: 400 });
});

backendTest('the server decides when the hallway is full', async () => {
  const room = await classroom('Limit Teacher');
  const noah = await room.pb.collection('students').create({
    teacher: room.id, class: room.room, firstName: 'Noah', lastPrefix: 'W', status: 'current',
  });
  const send = (student: string, kind: string) => room.pb.send<{ status: string; out: number; limit: number }>('/api/hallway/kiosk/events', {
    method: 'POST', body: { student, kind, destination: 'Water' },
  });
  await expect(send(room.avery, 'out')).resolves.toMatchObject({ status: 'approved', out: 1, limit: 1 });
  await expect(send(noah.id, 'out')).resolves.toMatchObject({ status: 'denied', out: 1, limit: 1 });
  await expect(send(room.avery, 'in')).resolves.toMatchObject({ status: 'returned', out: 0 });
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

backendTest('a correction is a new entry, and cannot reach another teacher\'s log', async () => {
  const mine = await classroom('Correcting Teacher');
  const theirs = await classroom('Other Teacher');
  await mine.pb.send('/api/hallway/kiosk/events', {
    method: 'POST', body: { student: mine.avery, kind: 'out', destination: 'Water' },
  });
  const [entry] = await mine.pb.collection('pass_events').getFullList();

  const noah = await mine.pb.collection('students').create({
    teacher: mine.id, class: mine.room, firstName: 'Noah', lastPrefix: 'W', status: 'current',
  });
  await mine.pb.send('/api/hallway/passes/correct', {
    method: 'POST', body: { event: entry.id, student: noah.id, at: '' },
  });

  // Two entries now: the original, untouched, and the correction laid over it.
  const after = await mine.pb.collection('pass_events').getFullList({ sort: 'at' });
  expect(after).toHaveLength(2);
  expect(after[0]).toMatchObject({ id: entry.id, student: mine.avery, kind: 'out' });
  expect(after[1]).toMatchObject({ kind: 'fix', corrects: entry.id, newStudent: noah.id, studentName: 'Noah W.' });

  // Another teacher cannot correct an entry that is not theirs.
  await expect(theirs.pb.send('/api/hallway/passes/correct', {
    method: 'POST', body: { event: entry.id, student: theirs.avery, at: '' },
  })).rejects.toMatchObject({ status: 400 });
});

backendTest('switching class closes open trips and moves the door together', async () => {
  const room = await classroom('Switching Teacher');
  const next = await room.pb.collection('classes').create({ teacher: room.id, name: 'Period 2', position: 1, archived: false });
  await room.pb.send('/api/hallway/kiosk/events', {
    method: 'POST', body: { student: room.avery, kind: 'out', destination: 'Water' },
  });

  const result = await room.pb.send<{ class: string; closed: string[] }>('/api/hallway/class/switch', {
    method: 'POST', body: { class: next.id },
  });
  expect(result).toMatchObject({ class: next.id, closed: ['Avery B.'] });

  // The Active Class moved and the open trip was closed, in one go.
  const teacher = await room.pb.collection('teachers').getOne(room.id);
  expect(teacher.activeClass).toBe(next.id);
  const entries = await room.pb.collection('pass_events').getFullList({ sort: 'at' });
  expect(entries).toHaveLength(2);
  // Marked as ended by the switch, not as a student walking back in.
  expect(entries[1]).toMatchObject({ kind: 'in', source: 'switch', class: room.room });
});
