import { ClientResponseError } from 'pocketbase';
import { pb } from './pocketbase';
import { defaultLimit, defaultStudents } from './demoData';
import { activePasses, dueTimeFrom, foldEvents } from './passes';
import { passesToCsv } from './csv';
import { displayName, planImport } from './roster';
import type { ImportPlan } from './roster';
import type { ActiveClass, Class, Destination, Modal, Notice, Pass, PassEvent, Student, TeacherTab, View } from './types';

/**
 * Everything the screens read. It is a single reactive object so that any
 * component can import it and stay in sync automatically.
 */
export const app = $state({
  activeClass: { limit: defaultLimit, students: [], passes: [] } as ActiveClass,
  /** Every Class this teacher still runs, in the order their day goes. */
  classes: [] as Class[],
  /** The Class the door screen is showing. Lives on the account, not the browser. */
  activeClassId: '',
  /** Where students may go. One account-wide list, each with its expected minutes. */
  destinations: [] as Destination[],
  /** The roster the teacher is editing, including Former Students. */
  roster: [] as Student[],
  /** The Class whose roster is open for editing, which is not the Active Class. */
  editingClassId: '',
  /**
   * The Class the dashboard is looking at. Browsing here deliberately does not
   * move the door screen: opening Period 4's history must not change what the
   * Period 2 students in front of you are seeing.
   */
  viewingClassId: '',
  /** The student whose pass could still be undone at the door, for a few seconds. */
  cancellable: null as Student | null,
  view: 'teacher-login' as View,
  teacherTab: 'live' as TeacherTab,
  /** Shown in the kiosk header, e.g. "Room 214 door". */
  kioskLabel: '',
  /** A startup problem that should be explained on the sign-in screen. */
  startupError: '',
  notice: null as Notice | null,
  modal: null as Modal | null,
  /** True while a form is talking to the server, so buttons can disable themselves. */
  submitting: false,
  /** Set when PocketBase asks for a second factor during teacher sign-in. */
  pendingMfa: null as { id: string; email: string; password: string; otpId?: string } | null,
});

let noticeTimer = 0;
let refreshTimer = 0;

export function out() {
  return activePasses(app.activeClass);
}

function teacherId() {
  const id = pb.authStore.record?.id;
  if (!id) throw new Error('Teacher authentication required');
  return id;
}

export function teacherName() {
  return String(pb.authStore.record?.displayName || 'the teacher');
}

// ---------------------------------------------------------------------------
// Teacher workspace
// ---------------------------------------------------------------------------

/** Every Class the teacher still runs. Archived ones keep their history but drop out here. */
function readDestinations() {
  const raw = pb.authStore.record?.destinations;
  app.destinations = Array.isArray(raw)
    ? raw.map((item) => ({ label: String(item.label || ''), minutes: Number(item.minutes) || 1 })).filter((item) => item.label)
    : [];
}

export async function saveDestinations(destinations: Destination[]) {
  app.destinations = destinations;
  await pb.collection('teachers').update(teacherId(), { destinations });
}

export async function loadClasses() {
  const teacher = teacherId();
  readDestinations();
  const records = await pb.collection('classes').getFullList({
    filter: pb.filter('teacher = {:teacher} && archived = false', { teacher }),
    sort: 'position',
  });
  app.classes = records.map((record) => ({
    id: record.id,
    name: record.name as string,
    position: Number(record.position) || 0,
    archived: Boolean(record.archived),
  }));
  // The account is the authority. Falling back to the first Class only covers a
  // teacher whose Active Class was archived out from under them.
  if (!app.activeClassId) {
    app.activeClassId = String(pb.authStore.record?.activeClass || '');
  }
  if (!app.classes.some((room) => room.id === app.activeClassId)) {
    app.activeClassId = app.classes[0]?.id ?? '';
  }
  if (!app.classes.some((room) => room.id === app.viewingClassId)) {
    app.viewingClassId = app.activeClassId;
  }
}

/** The door screen always shows the Active Class; the dashboard shows whatever the teacher is browsing. */
function shownClassId() {
  return app.view === 'kiosk' ? app.activeClassId : app.viewingClassId || app.activeClassId;
}

export function browseClass(id: string) {
  app.viewingClassId = id;
  return loadActiveClass();
}

/**
 * Students still in the hallway in a given Class. Asked for directly rather than
 * read from what is loaded, because the teacher may be browsing a different
 * Class entirely when they decide to move the door screen.
 */
export async function stillOutIn(classId: string) {
  if (!classId) return [];
  const teacher = teacherId();
  const events = await pb.collection('pass_events').getFullList({
    filter: pb.filter('teacher = {:teacher} && class = {:room}', { teacher, room: classId }),
    sort: 'at',
  });
  const passes = foldEvents(events as unknown as PassEvent[]);
  return passes.filter((pass) => !pass.inAt).map((pass) => pass.studentName);
}

/**
 * Moves the door screen. The server closes the outgoing Class's open trips and
 * moves the Active Class together, so the two can never disagree.
 */
export async function switchActiveClass(classId: string) {
  const result = await pb.send<{ class: string; closed: string[] }>('/api/hallway/class/switch', {
    method: 'POST',
    body: { class: classId },
  });
  app.activeClassId = result.class;
  if (app.view === 'kiosk') app.viewingClassId = result.class;
  app.kioskLabel = app.classes.find((room) => room.id === result.class)?.name || app.kioskLabel;
  await loadActiveClass();
  return result.closed;
}

/** Reads the Active Class's roster and pass log, which only the signed-in teacher may do. */
export async function loadActiveClass() {
  const teacher = teacherId();
  await loadClasses();
  const limit = Number(pb.authStore.record?.passLimit) || defaultLimit;
  const room = shownClassId();
  if (!room) {
    app.activeClass = { limit, students: [], passes: [] };
    return;
  }
  const [roster, events] = await Promise.all([
    pb.collection('students').getFullList({ filter: pb.filter('teacher = {:teacher} && class = {:room}', { teacher, room }), sort: 'name' }),
    pb.collection('pass_events').getFullList({ filter: pb.filter('teacher = {:teacher} && class = {:room}', { teacher, room }), sort: 'at' }),
  ]);
  app.activeClass = {
    limit,
    students: roster.filter((record) => record.status !== 'former').map(toStudent),
    passes: foldEvents(events as unknown as PassEvent[]),
  };
}

function toStudent(record: { id: string; firstName?: unknown; lastPrefix?: unknown; status?: unknown }): Student {
  const firstName = String(record.firstName || '');
  const lastPrefix = String(record.lastPrefix || '');
  return {
    recordId: record.id,
    firstName,
    lastPrefix,
    status: record.status === 'former' ? 'former' : 'current',
    name: displayName({ firstName, lastPrefix }),
  };
}

/** The roster of one Class, Former Students included, for the teacher to edit. */
export async function loadRoster(classId: string) {
  const teacher = teacherId();
  app.editingClassId = classId;
  const records = await pb.collection('students').getFullList({
    filter: pb.filter('teacher = {:teacher} && class = {:room}', { teacher, room: classId }),
    sort: 'firstName',
  });
  app.roster = records.map(toStudent);
}

export function previewImport(text: string) {
  return planImport(text, app.roster);
}

/**
 * Saves a previewed import. Nothing is written when the plan carries an error,
 * because two students who cannot be told apart would sign out as each other.
 */
export async function applyImport(classId: string, plan: ImportPlan, removeMissing: string[]) {
  if (plan.error) return plan.error;
  const teacher = teacherId();
  for (const entry of plan.added) {
    await pb.collection('students').create({
      teacher,
      class: classId,
      firstName: entry.firstName,
      lastPrefix: entry.lastPrefix,
      status: 'current',
    });
  }
  for (const change of plan.matched) {
    if (change.student.lastPrefix === change.lastPrefix) continue;
    await pb.collection('students').update(change.student.recordId, { lastPrefix: change.lastPrefix });
  }
  for (const recordId of removeMissing) {
    await pb.collection('students').update(recordId, { status: 'former' });
  }
  await loadRoster(classId);
  await loadActiveClass();
  return '';
}

export async function addStudent(classId: string, firstName: string, lastName: string) {
  const teacher = teacherId();
  await pb.collection('students').create({
    teacher,
    class: classId,
    firstName,
    lastPrefix: lastName.slice(0, 3),
    status: 'current',
  });
  await loadRoster(classId);
  await loadActiveClass();
}

export async function renameStudent(recordId: string, firstName: string, lastPrefix: string) {
  await pb.collection('students').update(recordId, { firstName, lastPrefix: lastPrefix.slice(0, 3) });
  await loadRoster(app.editingClassId);
  await loadActiveClass();
}

/** A Student who has left keeps every Pass they took, so the Class's history stays whole. */
export async function archiveStudent(recordId: string) {
  await pb.collection('students').update(recordId, { status: 'former' });
  await loadRoster(app.editingClassId);
  await loadActiveClass();
}

/** Only ever for a Student added by mistake who has no history to lose. */
export async function deleteStudent(recordId: string) {
  await pb.collection('students').delete(recordId);
  await loadRoster(app.editingClassId);
  await loadActiveClass();
}

export async function createClass(name: string) {
  const teacher = teacherId();
  const created = await pb.collection('classes').create({ teacher, name, position: app.classes.length, archived: false });
  // The very first Class a teacher makes is the one the door screen shows;
  // after that, moving it is a deliberate act rather than a side effect.
  if (!app.activeClassId) {
    app.activeClassId = created.id;
    await pb.collection('teachers').update(teacher, { activeClass: created.id });
  }
  await loadActiveClass();
}

export async function renameClass(id: string, name: string) {
  await pb.collection('classes').update(id, { name });
  await loadClasses();
}

/** Archived, never deleted: the Class stops appearing but keeps its Students and history. */
export async function archiveClass(id: string) {
  await pb.collection('classes').update(id, { archived: true });
  if (app.activeClassId === id) app.activeClassId = '';
  await loadActiveClass();
}

export async function moveClass(id: string, direction: -1 | 1) {
  const order = [...app.classes];
  const from = order.findIndex((room) => room.id === id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= order.length) return;
  [order[from], order[to]] = [order[to], order[from]];
  await Promise.all(order.map((room, index) => pb.collection('classes').update(room.id, { position: index })));
  await loadClasses();
}

/**
 * Both screens are live views of the same log. The door screen watches it too
 * now, so a student who was signed back in from the teacher's desk stops being
 * shown as out. See docs/adr/0003.
 */
function watchActiveClass() {
  clearInterval(refreshTimer);
  refreshTimer = window.setInterval(() => {
    if (app.view === 'teacher' || app.view === 'kiosk') void loadActiveClass().catch(() => {});
  }, 10_000);
}

async function finishTeacherLogin() {
  if (pb.authStore.record?.collectionName !== 'teachers') throw new Error('Wrong principal type');
  await loadActiveClass();
  app.pendingMfa = null;
  app.view = 'teacher';
  watchActiveClass();
}

/** Signs a teacher in. Returns an error message to show, or an empty string on success. */
export async function signInTeacher(email: string, password: string) {
  try {
    await pb.collection('teachers').authWithPassword(email, password);
    await finishTeacherLogin();
  } catch (caught) {
    const response = caught instanceof ClientResponseError ? (caught.response as { mfaId?: string }) : {};
    if (!response.mfaId) {
      pb.authStore.clear();
      return 'Sign-in failed. Check your credentials and try again.';
    }
    const otp = await pb.collection('teachers').requestOTP(email);
    app.pendingMfa = { id: response.mfaId, email, password, otpId: otp.otpId };
  }
  return '';
}

export async function verifyMfa(code: string) {
  const pending = app.pendingMfa;
  if (!pending) return '';
  try {
    await pb.collection('teachers').authWithOTP(pending.otpId!, code, { mfaId: pending.id });
    await finishTeacherLogin();
    return '';
  } catch {
    pb.authStore.clear();
    return 'That code is invalid or expired.';
  }
}

export async function registerTeacher(fields: { displayName: string; email: string; password: string; passwordConfirm: string }) {
  try {
    await pb.collection('teachers').create(fields);
    await pb.collection('teachers').authWithPassword(fields.email, fields.password);
    // A brand-new account starts with one Class holding a sample roster, so the
    // kiosk has names to greet before the teacher has imported anything.
    const room = await pb.collection('classes').create({ teacher: teacherId(), name: 'My class', position: 0, archived: false });
    await pb.collection('teachers').update(teacherId(), { passLimit: defaultLimit, activeClass: room.id });
    app.activeClassId = room.id;
    for (const student of defaultStudents) {
      await pb.collection('students').create({
        teacher: teacherId(),
        class: room.id,
        firstName: student.firstName,
        lastPrefix: student.lastPrefix,
        status: 'current',
      });
    }
    await finishTeacherLogin();
    return '';
  } catch (caught) {
    pb.authStore.clear();
    const response = caught instanceof ClientResponseError ? (caught.response as { data?: Record<string, { message?: string }> }) : {};
    return (
      response.data?.email?.message ||
      response.data?.password?.message ||
      response.data?.displayName?.message ||
      'The account could not be created. Check your details and try again.'
    );
  }
}

/** Marks a student as returned from the teacher workspace: another line in the log. */
export async function markReturned(passId: string) {
  const pass = app.activeClass.passes.find((item) => item.id === passId);
  if (!pass) return;
  await pb.collection('pass_events').create({
    teacher: teacherId(),
    student: pass.student,
    studentName: pass.studentName,
    kind: 'in',
    source: 'teacher',
    signedInBy: teacherName(),
  });
  await loadActiveClass();
}

/**
 * Records a Correction. Nothing is overwritten -- this asks the server to add an
 * entry that amends an earlier one, so the original reading survives.
 */
async function amend(eventId: string, changes: { student?: string; at?: string }) {
  await pb.send('/api/hallway/passes/correct', {
    method: 'POST',
    body: { event: eventId, student: changes.student || '', at: changes.at || '' },
  });
}

export async function correctPass(pass: Pass, changes: { student?: string; outAt?: string; inAt?: string }) {
  // A reassignment has to move both ends of the trip. Correcting only the exit
  // would leave the return paired with the student it was taken from, and the
  // fold would show two broken halves instead of one moved trip.
  if (changes.student) {
    await amend(pass.id, { student: changes.student });
    if (pass.inId) await amend(pass.inId, { student: changes.student });
  }
  if (changes.outAt) await amend(pass.id, { at: changes.outAt });
  if (changes.inAt && pass.inId) await amend(pass.inId, { at: changes.inAt });
  await loadActiveClass();
}

/** Every Correction made in a window, so a teacher can review what was changed. */
export async function correctionsBetween(from: string, to: string) {
  const teacher = teacherId();
  const events = await pb.collection('pass_events').getFullList({
    filter: pb.filter("teacher = {:teacher} && kind = 'fix' && at >= {:from} && at <= {:to}", { teacher, from, to: `${to} 23:59:59` }),
    sort: '-at',
  });
  return events as unknown as PassEvent[];
}

/**
 * Hands the teacher a spreadsheet of the Class they are looking at. A real file
 * rather than the mock Google Sheet this used to draw: a prototype that breaks
 * its promise in front of an audience is worse than one that does something
 * small honestly.
 */
export function downloadCsv() {
  const room = app.classes.find((item) => item.id === (app.viewingClassId || app.activeClassId));
  const name = (room?.name || 'class').toLowerCase().replaceAll(/[^a-z0-9]+/g, '-');
  const blob = new Blob([passesToCsv(app.activeClass.passes)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `hallway-${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function setLimit(limit: number) {
  app.activeClass.limit = limit;
  await pb.collection('teachers').update(teacherId(), { passLimit: limit });
}

export function signOutTeacher() {
  clearInterval(refreshTimer);
  pb.authStore.clear();
  app.activeClass = { limit: defaultLimit, students: [], passes: [] };
  app.classes = [];
  app.activeClassId = '';
  app.viewingClassId = '';
  app.view = 'teacher-login';
}

// ---------------------------------------------------------------------------
// Kiosk mode
// ---------------------------------------------------------------------------

export async function beginKioskMode() {
  const status = await pb.send<{ hasPin: boolean }>('/api/hallway/kiosk/pin/status', {});
  if (!status.hasPin) {
    app.modal = { kind: 'kiosk-pin', purpose: 'setup' };
    return;
  }
  enterKiosk();
}

export function enterKiosk() {
  app.kioskLabel = app.classes.find((room) => room.id === app.activeClassId)?.name || `${teacherName()}'s classroom`;
  app.modal = null;
  app.view = 'kiosk';
  void loadActiveClass().catch(() => {});
  watchActiveClass();
}

export function requestKioskExit() {
  app.modal = { kind: 'kiosk-pin', purpose: 'exit' };
}

export function requestKioskSwitch() {
  app.modal = { kind: 'kiosk-pin', purpose: 'switch' };
}

export async function saveKioskPin(pin: string) {
  try {
    await pb.send('/api/hallway/kiosk/pin', { method: 'POST', body: { pin } });
    return '';
  } catch (caught) {
    return serverMessage(caught, 'The PIN could not be saved. Please try again.');
  }
}

export async function verifyKioskPin(pin: string, purpose: 'exit' | 'switch' = 'exit') {
  try {
    await pb.send('/api/hallway/kiosk/pin/verify', { method: 'POST', body: { pin } });
    if (purpose === 'switch') {
      app.modal = { kind: 'class-switch' };
      return '';
    }
    app.modal = null;
    app.view = 'teacher';
    app.viewingClassId = app.activeClassId;
    watchActiveClass();
    return '';
  } catch (caught) {
    return serverMessage(caught, 'That PIN is incorrect.');
  }
}

function showNotice(notice: Notice) {
  clearTimeout(noticeTimer);
  app.notice = notice;
  noticeTimer = window.setTimeout(() => {
    app.notice = null;
    app.cancellable = null;
  }, notice.kind === 'approved' ? 6000 : 5500);
}

/** Whether this student is in the hallway right now, so the door screen can say so. */
export function passFor(student: Student) {
  return out().find((pass) => pass.student === student.recordId);
}

/**
 * One tap on a name. A student who is out is signed back in immediately; anyone
 * else is asked where they are going, which is the second and final tap.
 */
export function chooseStudent(student: Student) {
  if (passFor(student)) return signBackIn(student);
  app.modal = { kind: 'request', student };
  return Promise.resolve();
}

/** Undoes a pass a student has just been given, by adding a line saying so. */
export function cancelLastPass() {
  const student = app.cancellable;
  if (!student) return Promise.resolve();
  app.cancellable = null;
  app.notice = null;
  return sendKioskEvent(student, 'in', '', true);
}

function serverMessage(caught: unknown, fallback: string) {
  const response = caught instanceof ClientResponseError ? (caught.response as { message?: string }) : {};
  return response.message || fallback;
}

/**
 * Sends one line to the hall pass log. Whether the pass is allowed is decided by
 * the server, because a kiosk may not read the log it writes to.
 */
async function sendKioskEvent(student: Student, kind: 'out' | 'in', destination = '', cancel = false) {
  app.modal = null;
  try {
    // How long the trip should take is the teacher's setting, so the kiosk sends
    // only where the student is going and the server decides the rest.
    const result = await pb.send<{ status: string; name: string; destination: string; minutes: number; outAt: string; out: number; limit: number }>(
      '/api/hallway/kiosk/events',
      { method: 'POST', body: { student: student.recordId, kind, destination, cancel } },
    );
    if (result.status === 'denied') {
      showNotice({
        kind: 'denied',
        title: 'Please wait in class',
        message: 'The hallway limit has been reached. Someone currently out needs to sign back in before another pass can be approved.',
        detail: `${result.out} of ${result.limit} students are out right now`,
      });
      return;
    }
    await loadActiveClass().catch(() => {});
    if (result.status === 'cancelled') {
      showNotice({ kind: 'returned', title: result.name, message: 'That pass has been cancelled.' });
      return;
    }
    if (result.status === 'returned') {
      showNotice({ kind: 'returned', title: result.name, message: 'You are signed back in.' });
      return;
    }
    app.cancellable = student;
    showNotice({
      kind: 'approved',
      title: result.name,
      message: result.destination,
      detail: `Back by ${dueTimeFrom(result.outAt, result.minutes)}`,
      undo: true,
    });
  } catch (caught) {
    showNotice({ kind: 'denied', title: student.name, message: serverMessage(caught, 'That could not be saved. Please ask your teacher.') });
  }
}

export function requestPass(student: Student, destination: string) {
  return sendKioskEvent(student, 'out', destination);
}

export function signBackIn(student: Student) {
  return sendKioskEvent(student, 'in');
}

export async function bootstrap() {
  // Teacher sessions intentionally remain memory-only, so every fresh browser
  // session begins at sign-in rather than silently reopening a kiosk.
}
