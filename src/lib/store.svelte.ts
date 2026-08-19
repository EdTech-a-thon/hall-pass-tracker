import { ClientResponseError } from 'pocketbase';
import { kioskTokenKey, kioskTokenParam, pb } from './pocketbase';
import { defaultLimit, defaultStudents } from './demoData';
import { activePasses, dueTimeFrom, foldEvents } from './passes';
import type { AppState, KioskLink, Modal, Notice, PassEvent, Student, TeacherTab, View } from './types';

/**
 * Everything the screens read. It is a single reactive object so that any
 * component can import it and stay in sync automatically.
 */
export const app = $state({
  classroom: { limit: defaultLimit, students: [], passes: [] } as AppState,
  view: 'teacher-login' as View,
  teacherTab: 'live' as TeacherTab,
  /** Shown in the kiosk header, e.g. "Room 214 door". */
  kioskLabel: '',
  /** Set when a saved kiosk link has been revoked, so the device says why. */
  startupError: '',
  kioskLinks: [] as KioskLink[],
  notice: null as Notice | null,
  modal: null as Modal | null,
  /** True while a form is talking to the server, so buttons can disable themselves. */
  submitting: false,
  /** Set when PocketBase asks for a second factor during teacher sign-in. */
  pendingMfa: null as { id: string; email: string; password: string; otpId?: string } | null,
});

/** Kept out of the reactive object: the kiosk token never belongs in the UI. */
let kioskToken = '';
let noticeTimer = 0;
let refreshTimer = 0;

export function out() {
  return activePasses(app.classroom);
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

/** Reads the roster and the pass log, which only the signed-in teacher may do. */
export async function loadClassroom() {
  const teacher = teacherId();
  const [roster, events] = await Promise.all([
    pb.collection('students').getFullList({ filter: pb.filter('teacher = {:teacher}', { teacher }), sort: 'name' }),
    pb.collection('pass_events').getFullList({ filter: pb.filter('teacher = {:teacher}', { teacher }), sort: 'at' }),
  ]);
  app.classroom = {
    limit: Number(pb.authStore.record?.passLimit) || defaultLimit,
    students: roster.map((record) => ({ id: record.studentId as string, name: record.name as string })),
    passes: foldEvents(events as unknown as PassEvent[]),
  };
}

/** The teacher's screen is a live view of a log the kiosk keeps appending to. */
function watchClassroom() {
  clearInterval(refreshTimer);
  refreshTimer = window.setInterval(() => {
    if (app.view === 'teacher') void loadClassroom().catch(() => {});
  }, 10_000);
}

async function finishTeacherLogin() {
  if (pb.authStore.record?.collectionName !== 'teachers') throw new Error('Wrong principal type');
  await loadClassroom();
  await loadKioskLinks();
  app.pendingMfa = null;
  app.view = 'teacher';
  watchClassroom();
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
    await pb.collection('teachers').update(teacherId(), { passLimit: defaultLimit });
    // A brand-new classroom starts with a sample roster so the kiosk has names to greet.
    for (const student of defaultStudents) {
      await pb.collection('students').create({ teacher: teacherId(), studentId: student.id, name: student.name });
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
  const pass = app.classroom.passes.find((item) => item.id === passId);
  if (!pass) return;
  await pb.collection('pass_events').create({
    teacher: teacherId(),
    studentId: pass.studentId,
    studentName: pass.studentName,
    kind: 'in',
    source: 'teacher',
    signedInBy: teacherName(),
  });
  await loadClassroom();
}

export async function setLimit(limit: number) {
  app.classroom.limit = limit;
  await pb.collection('teachers').update(teacherId(), { passLimit: limit });
}

export function signOutTeacher() {
  clearInterval(refreshTimer);
  pb.authStore.clear();
  app.classroom = { limit: defaultLimit, students: [], passes: [] };
  app.kioskLinks = [];
  app.view = 'teacher-login';
}

// ---------------------------------------------------------------------------
// Kiosk links
// ---------------------------------------------------------------------------

export async function loadKioskLinks() {
  const filter = pb.filter('teacher = {:teacher}', { teacher: teacherId() });
  const links = await pb.collection('kiosk_links').getFullList({ filter, sort: '-at' });
  app.kioskLinks = links.map((record) => ({
    id: record.id,
    label: record.label as string,
    active: record.active as boolean,
    at: record.at as string,
  }));
}

/**
 * Creates a link for a classroom device. The token comes back exactly once, so
 * the teacher sends the link now or makes a new one later.
 */
export async function createKioskLink(label: string) {
  try {
    const link = await pb.send<{ id: string; label: string; token: string }>('/api/hallway/kiosk/links', {
      method: 'POST',
      body: { label },
    });
    const url = `${window.location.origin}${window.location.pathname}?${kioskTokenParam}=${link.token}`;
    app.modal = { kind: 'kiosk-link', url, label: link.label };
    await loadKioskLinks();
  } catch {
    window.alert('A kiosk link could not be created. Try again.');
  }
}

export async function revokeKioskLink(linkId: string) {
  await pb.send('/api/hallway/kiosk/links/revoke', { method: 'POST', body: { linkId } });
  await loadKioskLinks();
}

// ---------------------------------------------------------------------------
// Kiosk
// ---------------------------------------------------------------------------

function showNotice(notice: Notice) {
  clearTimeout(noticeTimer);
  app.notice = notice;
  noticeTimer = window.setTimeout(() => {
    app.notice = null;
  }, notice.kind === 'approved' ? 4500 : 5500);
}

/** Looks the student up in the roster the kiosk is allowed to read. */
export function submitStudentId(id: string) {
  const student = app.classroom.students.find((item) => item.id === id);
  if (!student) return 'We could not find that student ID. Please try again.';
  app.modal = { kind: 'request', student };
  return '';
}

function serverMessage(caught: unknown, fallback: string) {
  const response = caught instanceof ClientResponseError ? (caught.response as { message?: string }) : {};
  return response.message || fallback;
}

/**
 * Sends one line to the hall pass log. Whether the pass is allowed is decided by
 * the server, because a kiosk may not read the log it writes to.
 */
async function sendKioskEvent(student: Student, kind: 'out' | 'in', reason = '', minutes = 0) {
  app.modal = null;
  try {
    const result = await pb.send<{ status: string; name: string; reason: string; minutes: number; outAt: string; out: number; limit: number }>(
      '/api/hallway/kiosk/events',
      { method: 'POST', body: { token: kioskToken, studentId: student.id, kind, reason, minutes } },
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
    if (result.status === 'returned') {
      showNotice({ kind: 'returned', title: result.name, message: 'You are signed back in.' });
      return;
    }
    showNotice({
      kind: 'approved',
      title: result.name,
      message: result.reason,
      detail: `Return in ${result.minutes} minutes · by ${dueTimeFrom(result.outAt, result.minutes)}`,
    });
  } catch (caught) {
    showNotice({ kind: 'denied', title: student.name, message: serverMessage(caught, 'That could not be saved. Please ask your teacher.') });
  }
}

export function requestPass(student: Student, reason: string, minutes: number) {
  return sendKioskEvent(student, 'out', reason, minutes);
}

export function signBackIn(student: Student) {
  return sendKioskEvent(student, 'in');
}

/**
 * Takes this device back out of kiosk mode. Revoking the link in the teacher
 * workspace is the way to stop a device you no longer hold.
 */
export function forgetKiosk() {
  if (!window.confirm('Stop using this device as a kiosk? You will need the link again to set it back up.')) return;
  localStorage.removeItem(kioskTokenKey);
  kioskToken = '';
  app.classroom = { limit: defaultLimit, students: [], passes: [] };
  app.view = 'teacher-login';
}

/**
 * Starts the kiosk from its link. The token arrives in the URL the first time
 * and is kept on the device afterwards, so the door screen survives a reboot.
 */
export async function bootstrap() {
  const url = new URL(window.location.href);
  const fromLink = url.searchParams.get(kioskTokenParam);
  const token = fromLink || localStorage.getItem(kioskTokenKey) || '';
  if (!token) return;

  if (fromLink) {
    // Keep the token out of the address bar, browser history, and screenshots.
    url.searchParams.delete(kioskTokenParam);
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  }

  try {
    const session = await pb.send<{ label: string; limit: number; students: Student[] }>('/api/hallway/kiosk/session', {
      method: 'POST',
      body: { token },
    });
    kioskToken = token;
    localStorage.setItem(kioskTokenKey, token);
    app.kioskLabel = session.label;
    app.classroom = { limit: session.limit, students: session.students, passes: [] };
    app.view = 'kiosk';
  } catch {
    localStorage.removeItem(kioskTokenKey);
    app.startupError = 'This kiosk link is no longer active. Ask your teacher for a new one.';
  }
}
