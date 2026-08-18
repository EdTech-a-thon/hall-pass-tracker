import './style.css';
import sodium from 'libsodium-wrappers-sumo';
import PocketBase, { BaseAuthStore, ClientResponseError } from 'pocketbase';

type Student = { id: string; name: string };
type Pass = {
  id: string;
  studentId: string;
  studentName: string;
  reason: string;
  minutes: number;
  outAt: string;
  inAt?: string;
  signedInBy?: string;
};
type AppState = { limit: number; students: Student[]; passes: Pass[] };
type View = 'kiosk-login' | 'kiosk' | 'teacher-login' | 'teacher-register' | 'teacher';

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090', new BaseAuthStore());
const kioskPb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090', new BaseAuthStore());
pb.autoCancellation(false);

const kioskSessionKey = 'hallpass.kiosk.session';
const vaultKeyPrefix = 'hallpass.encrypted.vault.';
const authKey = 'hallpass.prototype.auth';
const defaultStudents: Student[] = [
  { id: '1042', name: 'Maya Chen' },
  { id: '2381', name: 'Jordan Ellis' },
  { id: '3077', name: 'Sofia Ramirez' },
  { id: '4419', name: 'Noah Williams' },
  { id: '5620', name: 'Avery Brooks' },
];
const now = Date.now();
const defaultState: AppState = {
  limit: 2,
  students: defaultStudents,
  passes: [
    { id: 'p1', studentId: '2381', studentName: 'Jordan Ellis', reason: 'Restroom', minutes: 8, outAt: new Date(now - 18 * 60_000).toISOString(), inAt: new Date(now - 10 * 60_000).toISOString() },
    { id: 'p2', studentId: '3077', studentName: 'Sofia Ramirez', reason: 'Counselor', minutes: 15, outAt: new Date(now - 70 * 60_000).toISOString(), inAt: new Date(now - 52 * 60_000).toISOString(), signedInBy: 'Maya Chen' },
    { id: 'p3', studentId: '1042', studentName: 'Maya Chen', reason: 'Water', minutes: 5, outAt: new Date(now - 25 * 60_000).toISOString(), inAt: new Date(now - 21 * 60_000).toISOString() },
    { id: 'p4', studentId: '4419', studentName: 'Noah Williams', reason: 'Main office', minutes: 10, outAt: new Date(now - 6 * 60_000).toISOString() },
  ],
};

let state: AppState = structuredClone(defaultState);
let view: View = 'kiosk-login';
let teacherTab: 'live' | 'analytics' | 'security' = 'live';
let pendingStudent: Student | null = null;
let noticeTimer = 0;
let pendingMfa: { id: string; email: string; password: string; otpId?: string } | null = null;
let submitting = false;
let vaultPassword = '';
let kioskDeviceId = '';

function vaultKey() {
  const teacherId = pb.authStore.record?.id;
  if (!teacherId) throw new Error('Teacher authentication required');
  return `${vaultKeyPrefix}${teacherId}`;
}

function bytesToBase64(bytes: Uint8Array) {
  return sodium.to_base64(bytes, sodium.base64_variants.ORIGINAL);
}

function base64ToBytes(value: string) {
  return sodium.from_base64(value, sodium.base64_variants.ORIGINAL);
}

async function deriveKey(password: string, salt: Uint8Array) {
  await sodium.ready;
  return sodium.crypto_pwhash(
    sodium.crypto_secretbox_KEYBYTES,
    password,
    salt,
    sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_ALG_ARGON2ID13,
  );
}

async function encryptVault(password: string, value: AppState) {
  await sodium.ready;
  const salt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const key = await deriveKey(password, salt);
  const cipher = sodium.crypto_secretbox_easy(JSON.stringify(value), nonce, key);
  return JSON.stringify({ version: 1, salt: bytesToBase64(salt), nonce: bytesToBase64(nonce), cipher: bytesToBase64(cipher) });
}

async function decryptVault(password: string, stored: string): Promise<AppState> {
  await sodium.ready;
  const box = JSON.parse(stored) as { salt: string; nonce: string; cipher: string };
  const key = await deriveKey(password, base64ToBytes(box.salt));
  const clear = sodium.crypto_secretbox_open_easy(base64ToBytes(box.cipher), base64ToBytes(box.nonce), key, 'text');
  return JSON.parse(clear) as AppState;
}

async function persist() {
  if (!vaultPassword) return;
  const encrypted = await encryptVault(vaultPassword, state);
  localStorage.setItem(vaultKey(), encrypted);
  try {
    if (pb.authStore.isValid) {
      await pb.send('/api/hallway/vault', { method: 'PUT', body: { payload: encrypted, version: 1 } });
    }
  } catch {
    // PocketBase is optional in the standalone demo. The exact same ciphertext stays local.
  }
}

function escapeHtml(value: string) {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

function activePasses() {
  return state.passes.filter((pass) => !pass.inAt);
}

function time(value: string) {
  return new Intl.DateTimeFormat([], { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

function duration(pass: Pass) {
  const end = pass.inAt ? new Date(pass.inAt).getTime() : Date.now();
  return Math.max(1, Math.round((end - new Date(pass.outAt).getTime()) / 60_000));
}

function shell(content: string, mode: 'kiosk' | 'teacher') {
  return `<div class="app-shell ${mode}">
    <header class="topbar">
      <a class="brand" href="#" data-action="home"><span class="brand-mark">H</span><span>Hallway</span></a>
      <div class="mode-badge"><span></span>${mode === 'kiosk' ? 'Student kiosk' : 'Teacher workspace'}</div>
    </header>${content}<footer class="test-footer">Test environment · no production student data</footer>
  </div>`;
}

function loginView(mode: 'kiosk' | 'teacher') {
  const teacher = mode === 'teacher';
  return shell(`<main class="login-wrap">
    <section class="login-copy">
      <p class="eyebrow">${teacher ? 'PRIVATE TEACHER ACCESS' : 'CLASSROOM DEVICE'}</p>
      <h1>${teacher ? 'Your class, at a glance.' : 'Ready for the hallway?'}</h1>
      <p>${teacher ? 'Review passes, spot patterns, and keep student information protected.' : 'A teacher must unlock this kiosk before students can request a pass.'}</p>
      <div class="privacy-note"><span class="lock-icon">▣</span><div><strong>Encrypted by design</strong><br><span>Student information is encrypted before it leaves this device.</span></div></div>
    </section>
    <section class="login-card" aria-labelledby="login-title">
      <div class="login-icon">${teacher ? 'T' : 'K'}</div>
      <p class="eyebrow">${teacher ? 'TEACHER SIGN IN' : 'UNLOCK KIOSK'}</p>
      <h2 id="login-title">Welcome back</h2>
      <p class="muted">${teacher ? 'Use your verified school account. Teacher sessions end on refresh.' : 'Enter the one-time link code shown in the teacher workspace. Never enter a teacher password on a kiosk.'}</p>
      <form id="login-form" data-mode="${mode}">
        ${teacher ? '<label>Email address<input name="email" type="email" autocomplete="username" maxlength="254" required></label><label>Password<input name="password" type="password" autocomplete="current-password" minlength="12" maxlength="128" required></label>' : '<label>One-time link code<input name="pairingCode" inputmode="numeric" pattern="[0-9]{8}" minlength="8" maxlength="8" autocomplete="off" placeholder="00000000" required></label>'}
        <p id="login-error" class="form-error" role="alert"></p>
        <button class="button primary full" type="submit">${teacher ? 'Open teacher workspace' : 'Unlock this kiosk'}</button>
      </form>
      ${teacher ? '<div class="switch-login">New to Hallway? <button class="link-button" data-action="register">Create a classroom account</button></div>' : ''}
      <div class="switch-login">${teacher ? 'Setting up a classroom device?' : 'Need reports and settings?'} <button class="link-button" data-action="switch-login">${teacher ? 'Open kiosk linking' : 'Teacher sign in'}</button></div>
    </section>
  </main>`, mode);
}

function registerView() {
  return shell(`<main class="login-wrap">
    <section class="login-copy"><p class="eyebrow">NEW CLASSROOM</p><h1>Create your private workspace.</h1><p>Each account represents one teacher and one classroom. Its student information is encrypted separately from every other workspace.</p><div class="privacy-note"><span class="lock-icon">▣</span><div><strong>Your password protects the encryption key</strong><br><span>We cannot recover classroom data without your password or recovery key.</span></div></div></section>
    <section class="login-card" aria-labelledby="register-title"><div class="login-icon">+</div><p class="eyebrow">PUBLIC REGISTRATION</p><h2 id="register-title">Create an account</h2><p class="muted">No email messages are sent. Use an address you control and a unique password.</p>
      <form id="register-form">
        <label>Your name<input name="displayName" autocomplete="name" minlength="2" maxlength="80" required></label>
        <label>Email address<input name="email" type="email" autocomplete="username" maxlength="254" required></label>
        <label>Password<input name="password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required></label>
        <label>Confirm password<input name="passwordConfirm" type="password" autocomplete="new-password" minlength="12" maxlength="128" required></label>
        <div class="warning-box"><strong>Important:</strong> If you lose both this password and your recovery key, your classroom data cannot be recovered.</div>
        <p id="login-error" class="form-error" role="alert"></p><button class="button primary full" type="submit">Create private workspace</button>
      </form><div class="switch-login">Already registered? <button class="link-button" data-action="teacher-login">Teacher sign in</button></div>
    </section></main>`, 'teacher');
}

function kioskView() {
  const out = activePasses();
  return shell(`<main class="kiosk-main">
    <section class="kiosk-intro">
      <p class="eyebrow">ROOM 214 · PERIOD 3</p>
      <h1>Where are you headed?</h1>
      <p>Enter your student ID to request a pass or check back in.</p>
    </section>
    <section class="id-card">
      <form id="student-id-form">
        <label for="student-id">Student ID</label>
        <div class="id-row"><input id="student-id" name="studentId" type="password" inputmode="numeric" pattern="[0-9]{4}" minlength="4" maxlength="4" autocomplete="off" placeholder="••••" aria-describedby="id-help" required><button class="button dark" type="submit">Continue →</button></div>
        <p id="id-help" class="muted">Your ID is hidden while you type.</p><p id="student-error" class="form-error" role="alert"></p>
      </form>
    </section>
    <section class="currently-out" aria-labelledby="out-title">
      <div><p class="eyebrow">LIVE STATUS</p><h2 id="out-title">Currently out <span>${out.length} / ${state.limit}</span></h2></div>
      <div class="out-chips">${out.length ? out.map((pass) => `<span><i>${escapeHtml(pass.studentName.charAt(0))}</i>${escapeHtml(pass.studentName)} · due ${time(new Date(new Date(pass.outAt).getTime() + pass.minutes * 60_000).toISOString())}</span>`).join('') : '<span class="empty-chip">Everyone is in class</span>'}</div>
    </section>
    <button class="corner-link" data-action="lock-kiosk">Lock kiosk</button>
  </main>`, 'kiosk');
}

function requestModal(student: Student) {
  return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="request-title">
    <button class="modal-close" data-action="close-modal" aria-label="Close">×</button><p class="eyebrow">PASS FOR</p><h2 id="request-title">${escapeHtml(student.name)}</h2>
    <form id="pass-form"><fieldset><legend>Where are you going?</legend><div class="choice-grid">
      ${['Restroom', 'Water', 'Main office', 'Counselor'].map((reason, index) => `<label class="choice"><input type="radio" name="reason" value="${reason}" ${index === 0 ? 'checked' : ''}><span>${reason}</span></label>`).join('')}
    </div></fieldset><label>How long do you expect to be gone?<select name="minutes"><option value="5">5 minutes</option><option value="8" selected>8 minutes</option><option value="10">10 minutes</option><option value="15">15 minutes</option></select></label>
    <button class="button primary full" type="submit">Request hall pass</button></form>
  </section></div>`;
}

function teacherNav() {
  return `<nav class="teacher-nav" aria-label="Teacher workspace"><button class="${teacherTab === 'live' ? 'active' : ''}" data-tab="live">Live class</button><button class="${teacherTab === 'analytics' ? 'active' : ''}" data-tab="analytics">Analytics</button><button class="${teacherTab === 'security' ? 'active' : ''}" data-tab="security">Security</button></nav>`;
}

function livePanel() {
  const out = activePasses();
  return `<section class="workspace-head"><div><p class="eyebrow">TUESDAY · PERIOD 3</p><h1>Good morning, Ms. Rivera.</h1><p>Here is what is happening in Room 214.</p></div><button class="button outline" data-action="export">Export to Google Sheets</button></section>
    <section class="stat-grid"><article><span class="stat-icon green">↗</span><p>Students out now</p><strong>${out.length}<small> of ${state.limit} allowed</small></strong></article><article><span class="stat-icon amber">◷</span><p>Passes today</p><strong>${state.passes.length}<small> total trips</small></strong></article><article><span class="stat-icon blue">≈</span><p>Average trip</p><strong>${Math.round(state.passes.reduce((sum, pass) => sum + duration(pass), 0) / state.passes.length)}<small> minutes</small></strong></article></section>
    <section class="panel"><div class="panel-head"><div><p class="eyebrow">RIGHT NOW</p><h2>Students in the hallway</h2></div><label class="limit-control">Maximum out at once <select id="limit-select">${[1, 2, 3, 4, 5].map((number) => `<option ${state.limit === number ? 'selected' : ''}>${number}</option>`).join('')}</select></label></div>
    <div class="student-cards">${out.length ? out.map((pass) => `<article><div class="avatar">${escapeHtml(pass.studentName.charAt(0))}</div><div><h3>${escapeHtml(pass.studentName)}</h3><p>${escapeHtml(pass.reason)} · out ${duration(pass)} min</p></div><button class="button small" data-signin="${pass.id}">Mark returned</button></article>`).join('') : '<div class="empty-state">Everyone is back in class.</div>'}</div></section>`;
}

function analyticsPanel() {
  const rows = [...state.passes].reverse();
  return `<section class="workspace-head"><div><p class="eyebrow">PASS INSIGHTS</p><h1>Hall pass analytics</h1><p>Review patterns and verify how each student returned.</p></div><button class="button outline" data-action="export">Export to Google Sheets</button></section>
  <section class="analytics-layout"><article class="panel chart-card"><div class="panel-head"><div><p class="eyebrow">THIS WEEK</p><h2>Passes by day</h2></div><strong>24 total</strong></div><div class="bar-chart" aria-label="Passes by day: Monday 4, Tuesday 7, Wednesday 5, Thursday 6, Friday 2">${[['M', 40], ['T', 76], ['W', 54], ['T', 64], ['F', 24]].map(([day, height]) => `<div><span style="height:${height}%"></span><small>${day}</small></div>`).join('')}</div></article>
  <article class="panel reasons"><p class="eyebrow">TOP DESTINATIONS</p><h2>Where students go</h2><div><span><i class="dot blue-dot"></i>Restroom</span><strong>42%</strong></div><div><span><i class="dot green-dot"></i>Water</span><strong>29%</strong></div><div><span><i class="dot amber-dot"></i>Main office</span><strong>17%</strong></div><div><span><i class="dot gray-dot"></i>Counselor</span><strong>12%</strong></div></article></section>
  <section class="panel history"><div class="panel-head"><div><p class="eyebrow">RECENT ACTIVITY</p><h2>Pass history</h2></div><span class="privacy-pill">Decrypted on this device</span></div><div class="table-wrap"><table><thead><tr><th>Student</th><th>Destination</th><th>Out</th><th>Duration</th><th>Return verification</th></tr></thead><tbody>${rows.map((pass) => `<tr><td><strong>${escapeHtml(pass.studentName)}</strong></td><td>${escapeHtml(pass.reason)}</td><td>${time(pass.outAt)}</td><td>${duration(pass)} min</td><td>${pass.inAt ? pass.signedInBy ? `<span class="flag">Signed in by ${escapeHtml(pass.signedInBy)}</span>` : '<span class="verified">Self check-in</span>' : '<span class="out-status">Still out</span>'}</td></tr>`).join('')}</tbody></table></div></section>`;
}

function securityPanel() {
  return `<section class="workspace-head"><div><p class="eyebrow">ACCOUNT & DEVICES</p><h1>Security</h1><p>Teacher and kiosk access are isolated from one another.</p></div></section>
  <section class="security-grid"><article class="panel"><span class="stat-icon green">✓</span><h2>Encryption is active</h2><p>Student records are encrypted in this browser with libsodium secretbox and an Argon2id password-derived key. PocketBase receives ciphertext only.</p><button class="button outline" data-action="recovery">Send recovery key to Google Drive</button><p class="danger-copy"><strong>If you lose both your password and recovery key, your student records cannot be recovered.</strong></p></article>
  <article class="panel"><p class="eyebrow">ACTIVE DEVICES</p><h2>Signed-in sessions</h2><div class="device"><div><strong>This teacher workspace</strong><span>Held in memory · ends on refresh</span></div><span class="current">Current</span></div><div class="device"><div><strong>${kioskDeviceId ? 'Linked kiosk' : 'No linked kiosk'}</strong><span>${kioskDeviceId ? 'Separate restricted device identity · refreshable' : 'Create a one-time code to link a classroom device.'}</span></div></div><button class="button outline full pair-button" data-action="pair-device">Link a new kiosk</button></article></section>`;
}

function teacherView() {
  const panel = teacherTab === 'live' ? livePanel() : teacherTab === 'analytics' ? analyticsPanel() : securityPanel();
  return shell(`${teacherNav()}<main class="teacher-main">${panel}</main><button class="corner-link" data-action="teacher-logout">Sign out teacher</button>`, 'teacher');
}

function render() {
  const app = document.querySelector<HTMLDivElement>('#app')!;
  app.innerHTML = view === 'kiosk-login' ? loginView('kiosk') : view === 'teacher-login' ? loginView('teacher') : view === 'teacher-register' ? registerView() : view === 'kiosk' ? kioskView() : teacherView();
}

function showNotice(kind: 'approved' | 'denied' | 'returned', title: string, message: string) {
  clearTimeout(noticeTimer);
  const out = activePasses();
  document.body.insertAdjacentHTML('beforeend', `<div class="notice ${kind}" role="status"><div class="notice-symbol">${kind === 'denied' ? '×' : '✓'}</div><p>${kind === 'denied' ? 'PASS PAUSED' : kind === 'returned' ? 'WELCOME BACK' : 'PASS APPROVED'}</p><h2>${escapeHtml(title)}</h2><div class="notice-message">${message}</div>${kind === 'denied' ? `<div class="notice-out"><strong>Currently out</strong>${out.map((pass) => `<span>${escapeHtml(pass.studentName)}</span>`).join('')}</div>` : ''}<div class="notice-countdown">Returning to kiosk…</div></div>`);
  noticeTimer = window.setTimeout(() => { document.querySelector('.notice')?.remove(); render(); }, kind === 'approved' ? 4500 : 5500);
}

async function handleLogin(form: HTMLFormElement) {
  const data = new FormData(form);
  const error = document.querySelector<HTMLParagraphElement>('#login-error')!;
  const mode = form.dataset.mode as 'teacher' | 'kiosk';
  if (submitting) return;
  submitting = true;
  form.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled = true;
  try {
    if (mode === 'kiosk') {
      const pairingCode = String(data.get('pairingCode')).trim();
      const result = await pb.send<{ token: string; record: Record<string, unknown> }>('/api/hallway/devices/pair', { method: 'POST', body: { pairingCode } });
      localStorage.setItem(kioskSessionKey, JSON.stringify({ token: result.token, record: result.record }));
      kioskDeviceId = String(result.record.id || '');
      view = 'kiosk';
      render();
      return;
    }
    const email = String(data.get('email')).trim().toLowerCase();
    const password = String(data.get('password'));
    try {
      await pb.collection('teachers').authWithPassword(email, password);
      await finishTeacherLogin(password);
    } catch (caught) {
      const response = caught instanceof ClientResponseError ? caught.response as { mfaId?: string } : {};
      if (!response.mfaId) throw caught;
      const otp = await pb.collection('teachers').requestOTP(email);
      pendingMfa = { id: response.mfaId, email, password, otpId: otp.otpId };
      showMfaForm();
    }
  } catch {
    pb.authStore.clear();
    error.textContent = mode === 'teacher' ? 'Sign-in failed. Check your credentials and try again.' : 'That link code is invalid or expired.';
  } finally {
    submitting = false;
    form.querySelector<HTMLButtonElement>('button[type="submit"]')?.removeAttribute('disabled');
  }
}

function showMfaForm() {
  const card = document.querySelector<HTMLElement>('.login-card')!;
  card.innerHTML = `<div class="login-icon">2</div><p class="eyebrow">SECOND FACTOR</p><h2>Check your school email</h2><p class="muted">PocketBase sent a one-time verification code. Authenticator-app TOTP is not enabled in this prototype because PocketBase does not provide it natively.</p><form id="mfa-form"><label>One-time code<input name="code" inputmode="numeric" pattern="[0-9]{6,10}" minlength="6" maxlength="10" autocomplete="one-time-code" required autofocus></label><p id="login-error" class="form-error" role="alert"></p><button class="button primary full" type="submit">Verify and continue</button></form>`;
}

async function finishTeacherLogin(password: string) {
  if (pb.authStore.record?.collectionName !== 'teachers') throw new Error('Wrong principal type');
  vaultPassword = password;
  const encrypted = localStorage.getItem(vaultKey());
  if (encrypted) state = await decryptVault(password, encrypted);
  else await persist();
  localStorage.setItem(authKey, 'configured');
  view = 'teacher';
  render();
}

document.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target as HTMLFormElement;
  if (form.id === 'login-form') await handleLogin(form);
  if (form.id === 'register-form') {
    if (submitting) return;
    const data = new FormData(form);
    const displayName = String(data.get('displayName')).trim();
    const email = String(data.get('email')).trim().toLowerCase();
    const password = String(data.get('password'));
    const passwordConfirm = String(data.get('passwordConfirm'));
    const error = document.querySelector<HTMLParagraphElement>('#login-error')!;
    if (password !== passwordConfirm) { error.textContent = 'The passwords do not match.'; return; }
    submitting = true;
    form.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled = true;
    try {
      await pb.collection('teachers').create({ email, password, passwordConfirm, displayName });
      await pb.collection('teachers').authWithPassword(email, password);
      state = structuredClone(defaultState);
      await finishTeacherLogin(password);
    } catch (caught) {
      pb.authStore.clear();
      const response = caught instanceof ClientResponseError ? caught.response as { data?: Record<string, { message?: string }> } : {};
      error.textContent = response.data?.email?.message || response.data?.password?.message || response.data?.displayName?.message || 'The account could not be created. Check your details and try again.';
    } finally {
      submitting = false;
      form.querySelector<HTMLButtonElement>('button[type="submit"]')?.removeAttribute('disabled');
    }
  }
  if (form.id === 'mfa-form' && pendingMfa) {
    const code = String(new FormData(form).get('code'));
    const error = document.querySelector<HTMLParagraphElement>('#login-error')!;
    try {
      await pb.collection('teachers').authWithOTP(pendingMfa.otpId!, code, { mfaId: pendingMfa.id });
      const password = pendingMfa.password;
      pendingMfa = null;
      await finishTeacherLogin(password);
    } catch { pb.authStore.clear(); error.textContent = 'That code is invalid or expired.'; }
  }
  if (form.id === 'student-id-form') {
    const id = String(new FormData(form).get('studentId'));
    const student = state.students.find((item) => item.id === id);
    const error = document.querySelector<HTMLParagraphElement>('#student-error')!;
    if (!student) { error.textContent = 'We could not find that student ID. Please try again.'; form.reset(); return; }
    const ownPass = activePasses().find((pass) => pass.studentId === id);
    if (ownPass) {
      ownPass.inAt = new Date().toISOString();
      await persist();
      showNotice('returned', student.name, 'You are signed back in.');
      return;
    }
    pendingStudent = student;
    document.body.insertAdjacentHTML('beforeend', requestModal(student));
  }
  if (form.id === 'pass-form' && pendingStudent) {
    const data = new FormData(form);
    document.querySelector('.modal-backdrop')?.remove();
    if (activePasses().length >= state.limit) {
      showNotice('denied', 'Please wait in class', 'The hallway limit has been reached. Someone currently out needs to sign back in before another pass can be approved.');
      pendingStudent = null;
      return;
    }
    const pass: Pass = { id: crypto.randomUUID(), studentId: pendingStudent.id, studentName: pendingStudent.name, reason: String(data.get('reason')), minutes: Number(data.get('minutes')), outAt: new Date().toISOString() };
    state.passes.push(pass);
    await persist();
    showNotice('approved', pendingStudent.name, `<strong>${escapeHtml(pass.reason)}</strong><span>Return in ${pass.minutes} minutes · by ${time(new Date(Date.now() + pass.minutes * 60_000).toISOString())}</span>`);
    pendingStudent = null;
  }
});

document.addEventListener('change', async (event) => {
  const select = event.target as HTMLSelectElement;
  if (select.id === 'limit-select') { state.limit = Number(select.value); await persist(); render(); }
});

document.addEventListener('click', async (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action], [data-tab], [data-signin]');
  if (!target) return;
  if (target.dataset.tab) { teacherTab = target.dataset.tab as typeof teacherTab; render(); return; }
  if (target.dataset.signin) { const pass = state.passes.find((item) => item.id === target.dataset.signin); if (pass) { pass.inAt = new Date().toISOString(); pass.signedInBy = 'Ms. Rivera'; await persist(); render(); } return; }
  const action = target.dataset.action;
  if (action === 'switch-login') { view = view === 'kiosk-login' ? 'teacher-login' : 'kiosk-login'; render(); }
  if (action === 'register') { view = 'teacher-register'; render(); }
  if (action === 'teacher-login') { view = 'teacher-login'; render(); }
  if (action === 'close-modal') { document.querySelector('.modal-backdrop')?.remove(); pendingStudent = null; }
  if (action === 'lock-kiosk') { localStorage.removeItem(kioskSessionKey); kioskPb.authStore.clear(); vaultPassword = ''; view = 'kiosk-login'; render(); }
  if (action === 'teacher-logout') { pb.authStore.clear(); vaultPassword = ''; view = 'teacher-login'; render(); }
  if (action === 'pair-device') { try { const result = await pb.send<{ code: string; expiresAt: string }>('/api/hallway/devices/link-code', { method: 'POST' }); document.body.insertAdjacentHTML('beforeend', `<div class="modal-backdrop"><section class="modal export-modal"><button class="modal-close" data-action="close-modal" aria-label="Close">×</button><p class="eyebrow">ONE-TIME KIOSK LINK</p><h2 class="pairing-code">${escapeHtml(result.code)}</h2><p>Enter this code on the kiosk. It expires in 5 minutes and can be used once.</p><div class="warning-box">Do not enter your teacher password or verification code on a classroom kiosk.</div></section></div>`); } catch { window.alert('A link code could not be created. Try again.'); } }
  if (action === 'export') document.body.insertAdjacentHTML('beforeend', `<div class="modal-backdrop"><section class="modal export-modal"><button class="modal-close" data-action="close-modal" aria-label="Close">×</button><div class="google-mark">G</div><p class="eyebrow">DEMO GOOGLE WORKSPACE</p><h2>Hallway analytics exported</h2><p>A Google Sheet with encrypted-source pass analytics has been created in <strong>Ms. Rivera's Drive</strong>.</p><div class="fake-sheet"><span></span><strong>Room 214 Hall Passes · July 2026</strong><small>Google Sheets · Demo connection</small></div><button class="button primary full" data-action="close-modal">Return to analytics</button></section></div>`);
  if (action === 'recovery') document.body.insertAdjacentHTML('beforeend', `<div class="modal-backdrop"><section class="modal export-modal"><button class="modal-close" data-action="close-modal" aria-label="Close">×</button><div class="google-mark">G</div><p class="eyebrow">DEMO GOOGLE DRIVE</p><h2>Recovery key saved</h2><p>The recovery key was sent directly to a private Google Drive folder. This prototype does not download it to this device.</p><div class="warning-box"><strong>Critical:</strong> If you lose both your password and this recovery key, you cannot regain access to student records.</div><button class="button primary full" data-action="close-modal">I understand</button></section></div>`);
  if (action === 'home') { event.preventDefault(); }
});

async function start() {
  await sodium.ready;
  const storedDevice = localStorage.getItem(kioskSessionKey);
  if (storedDevice) {
    try {
      const session = JSON.parse(storedDevice) as { token: string; record: Record<string, unknown> };
      kioskPb.authStore.save(session.token, session.record as never);
      const refreshed = await kioskPb.collection('kiosk_devices').authRefresh();
      localStorage.setItem(kioskSessionKey, JSON.stringify(refreshed));
      kioskDeviceId = refreshed.record.id;
      view = 'kiosk';
    } catch {
      kioskPb.authStore.clear();
      localStorage.removeItem(kioskSessionKey);
    }
  }
  render();
}

void start();
