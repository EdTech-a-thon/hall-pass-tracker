import sodium from 'libsodium-wrappers-sumo';
import { ClientResponseError } from 'pocketbase';
import { authKey, kioskPb, kioskSessionKey, pb, vaultKey } from './pocketbase';
import { defaultState } from './demoData';
import { activePasses, dueTime } from './passes';
import { decryptVault, encryptVault } from './vault';
import type { AppState, Modal, Notice, Pass, Student, TeacherTab, View } from './types';

/**
 * Everything the screens read. It is a single reactive object so that any
 * component can import it and stay in sync automatically.
 */
export const app = $state({
  classroom: structuredClone(defaultState) as AppState,
  view: 'kiosk-login' as View,
  teacherTab: 'live' as TeacherTab,
  kioskDeviceId: '',
  notice: null as Notice | null,
  modal: null as Modal | null,
  /** True while a form is talking to the server, so buttons can disable themselves. */
  submitting: false,
  /** Set when PocketBase asks for a second factor during teacher sign-in. */
  pendingMfa: null as { id: string; email: string; password: string; otpId?: string } | null,
});

/** Kept out of the reactive object: the encryption password never belongs in the UI. */
let vaultPassword = '';
let noticeTimer = 0;

export function out() {
  return activePasses(app.classroom);
}

/** Encrypts the classroom and stores it locally, mirroring the ciphertext to PocketBase. */
export async function persist() {
  if (!vaultPassword) return;
  const encrypted = await encryptVault(vaultPassword, app.classroom);
  localStorage.setItem(vaultKey(), encrypted);
  try {
    if (pb.authStore.isValid) {
      await pb.send('/api/hallway/vault', { method: 'PUT', body: { payload: encrypted, version: 1 } });
    }
  } catch {
    // PocketBase is optional in the standalone demo. The exact same ciphertext stays local.
  }
}

async function finishTeacherLogin(password: string) {
  if (pb.authStore.record?.collectionName !== 'teachers') throw new Error('Wrong principal type');
  vaultPassword = password;
  const encrypted = localStorage.getItem(vaultKey());
  if (encrypted) app.classroom = await decryptVault(password, encrypted);
  else await persist();
  localStorage.setItem(authKey, 'configured');
  app.pendingMfa = null;
  app.view = 'teacher';
}

/** Signs a teacher in. Returns an error message to show, or an empty string on success. */
export async function signInTeacher(email: string, password: string) {
  try {
    await pb.collection('teachers').authWithPassword(email, password);
    await finishTeacherLogin(password);
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
    await finishTeacherLogin(pending.password);
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
    app.classroom = structuredClone(defaultState);
    await finishTeacherLogin(fields.password);
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

/** Redeems a one-time link code so this device becomes a kiosk. */
export async function pairKiosk(pairingCode: string) {
  try {
    const result = await pb.send<{ token: string; record: Record<string, unknown> }>('/api/hallway/devices/pair', {
      method: 'POST',
      body: { pairingCode },
    });
    localStorage.setItem(kioskSessionKey, JSON.stringify({ token: result.token, record: result.record }));
    app.kioskDeviceId = String(result.record.id || '');
    app.view = 'kiosk';
    return '';
  } catch {
    pb.authStore.clear();
    return 'That link code is invalid or expired.';
  }
}

export async function requestLinkCode() {
  try {
    const result = await pb.send<{ code: string; expiresAt: string }>('/api/hallway/devices/link-code', { method: 'POST' });
    app.modal = { kind: 'pairing', code: result.code };
  } catch {
    window.alert('A link code could not be created. Try again.');
  }
}

export function lockKiosk() {
  localStorage.removeItem(kioskSessionKey);
  kioskPb.authStore.clear();
  vaultPassword = '';
  app.view = 'kiosk-login';
}

export function signOutTeacher() {
  pb.authStore.clear();
  vaultPassword = '';
  app.view = 'teacher-login';
}

function showNotice(notice: Notice) {
  clearTimeout(noticeTimer);
  app.notice = notice;
  noticeTimer = window.setTimeout(() => {
    app.notice = null;
  }, notice.kind === 'approved' ? 4500 : 5500);
}

/**
 * Handles a student typing their ID: returning students check straight back in,
 * everyone else is offered the pass request form.
 */
export async function submitStudentId(id: string) {
  const student = app.classroom.students.find((item) => item.id === id);
  if (!student) return 'We could not find that student ID. Please try again.';
  const ownPass = out().find((pass) => pass.studentId === id);
  if (ownPass) {
    ownPass.inAt = new Date().toISOString();
    await persist();
    showNotice({ kind: 'returned', title: student.name, message: 'You are signed back in.' });
    return '';
  }
  app.modal = { kind: 'request', student };
  return '';
}

export async function requestPass(student: Student, reason: string, minutes: number) {
  app.modal = null;
  if (out().length >= app.classroom.limit) {
    showNotice({
      kind: 'denied',
      title: 'Please wait in class',
      message: 'The hallway limit has been reached. Someone currently out needs to sign back in before another pass can be approved.',
    });
    return;
  }
  const pass: Pass = {
    id: crypto.randomUUID(),
    studentId: student.id,
    studentName: student.name,
    reason,
    minutes,
    outAt: new Date().toISOString(),
  };
  app.classroom.passes.push(pass);
  await persist();
  showNotice({
    kind: 'approved',
    title: student.name,
    message: pass.reason,
    detail: `Return in ${pass.minutes} minutes · by ${dueTime(pass)}`,
  });
}

/** Marks a student as returned from the teacher workspace. */
export async function markReturned(passId: string) {
  const pass = app.classroom.passes.find((item) => item.id === passId);
  if (!pass) return;
  pass.inAt = new Date().toISOString();
  pass.signedInBy = 'Ms. Rivera';
  await persist();
}

export async function setLimit(limit: number) {
  app.classroom.limit = limit;
  await persist();
}

/** Restores a previously linked kiosk before the first screen is shown. */
export async function bootstrap() {
  await sodium.ready;
  const storedDevice = localStorage.getItem(kioskSessionKey);
  if (!storedDevice) return;
  try {
    const session = JSON.parse(storedDevice) as { token: string; record: Record<string, unknown> };
    kioskPb.authStore.save(session.token, session.record as never);
    const refreshed = await kioskPb.collection('kiosk_devices').authRefresh();
    localStorage.setItem(kioskSessionKey, JSON.stringify(refreshed));
    app.kioskDeviceId = refreshed.record.id;
    app.view = 'kiosk';
  } catch {
    kioskPb.authStore.clear();
    localStorage.removeItem(kioskSessionKey);
  }
}

