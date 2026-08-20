import { ClientResponseError } from 'pocketbase';
import { pb } from './pocketbase';
import { defaultLimit, defaultStudents } from './demoData';
import { activePasses, dueTimeFrom, foldEvents } from './passes';
import type { ActiveClass, Modal, Notice, PassEvent, Student, TeacherTab, View } from './types';

/**
 * Everything the screens read. It is a single reactive object so that any
 * component can import it and stay in sync automatically.
 */
export const app = $state({
  activeClass: { limit: defaultLimit, students: [], passes: [] } as ActiveClass,
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

/** Reads the roster and the pass log, which only the signed-in teacher may do. */
export async function loadActiveClass() {
  const teacher = teacherId();
  const [roster, events] = await Promise.all([
    pb.collection('students').getFullList({ filter: pb.filter('teacher = {:teacher}', { teacher }), sort: 'name' }),
    pb.collection('pass_events').getFullList({ filter: pb.filter('teacher = {:teacher}', { teacher }), sort: 'at' }),
  ]);
  app.activeClass = {
    limit: Number(pb.authStore.record?.passLimit) || defaultLimit,
    students: roster.map((record) => ({ id: record.studentId as string, name: record.name as string })),
    passes: foldEvents(events as unknown as PassEvent[]),
  };
}

/** The teacher's screen is a live view of a log the kiosk keeps appending to. */
function watchActiveClass() {
  clearInterval(refreshTimer);
  refreshTimer = window.setInterval(() => {
    if (app.view === 'teacher') void loadActiveClass().catch(() => {});
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
    await pb.collection('teachers').update(teacherId(), { passLimit: defaultLimit });
    // A brand-new account starts with a sample roster so the kiosk has names to greet.
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
  const pass = app.activeClass.passes.find((item) => item.id === passId);
  if (!pass) return;
  await pb.collection('pass_events').create({
    teacher: teacherId(),
    studentId: pass.studentId,
    studentName: pass.studentName,
    kind: 'in',
    source: 'teacher',
    signedInBy: teacherName(),
  });
  await loadActiveClass();
}

export async function setLimit(limit: number) {
  app.activeClass.limit = limit;
  await pb.collection('teachers').update(teacherId(), { passLimit: limit });
}

export function signOutTeacher() {
  clearInterval(refreshTimer);
  pb.authStore.clear();
  app.activeClass = { limit: defaultLimit, students: [], passes: [] };
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
  clearInterval(refreshTimer);
  app.kioskLabel = `${teacherName()}'s classroom`;
  app.modal = null;
  app.view = 'kiosk';
}

export function requestKioskExit() {
  app.modal = { kind: 'kiosk-pin', purpose: 'exit' };
}

export async function saveKioskPin(pin: string) {
  try {
    await pb.send('/api/hallway/kiosk/pin', { method: 'POST', body: { pin } });
    return '';
  } catch (caught) {
    return serverMessage(caught, 'The PIN could not be saved. Please try again.');
  }
}

export async function verifyKioskPin(pin: string) {
  try {
    await pb.send('/api/hallway/kiosk/pin/verify', { method: 'POST', body: { pin } });
    app.modal = null;
    app.view = 'teacher';
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
  }, notice.kind === 'approved' ? 4500 : 5500);
}

/** Looks the student up in the roster the kiosk is allowed to read. */
export function submitStudentId(id: string) {
  const student = app.activeClass.students.find((item) => item.id === id);
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
async function sendKioskEvent(student: Student, kind: 'out' | 'in', destination = '', minutes = 0) {
  app.modal = null;
  try {
    const result = await pb.send<{ status: string; name: string; destination: string; minutes: number; outAt: string; out: number; limit: number }>(
      '/api/hallway/kiosk/events',
      { method: 'POST', body: { studentId: student.id, kind, destination, minutes } },
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
      message: result.destination,
      detail: `Return in ${result.minutes} minutes · by ${dueTimeFrom(result.outAt, result.minutes)}`,
    });
  } catch (caught) {
    showNotice({ kind: 'denied', title: student.name, message: serverMessage(caught, 'That could not be saved. Please ask your teacher.') });
  }
}

export function requestPass(student: Student, destination: string, minutes: number) {
  return sendKioskEvent(student, 'out', destination, minutes);
}

export function signBackIn(student: Student) {
  return sendKioskEvent(student, 'in');
}

export async function bootstrap() {
  // Teacher sessions intentionally remain memory-only, so every fresh browser
  // session begins at sign-in rather than silently reopening a kiosk.
}
