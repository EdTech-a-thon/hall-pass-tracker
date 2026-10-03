import type { DataConnection, Peer } from 'peerjs';
import { account, doorSetup, receivePasses, setActiveClass } from './account.svelte';
import { dueTime, endUnseen, mergeInto, newId, now } from './passes';
import { createPeer, keepAlive, pairingPrefix } from './peer';
import type { ActiveClass, DoorSetup, KioskMessage, LaptopMessage, Pass } from './types';

/**
 * The kiosk: the student-facing screen by the door. It runs either on a paired
 * device, talking to the teacher's laptop, or on the laptop itself. Either way
 * it decides who may leave right now, and it keeps working while the laptop is
 * away. See docs/adr/0005.
 */

/** What a paired device remembers between reloads. */
type PairedDevice = {
  laptopPeerId: string;
  kioskId: string;
  secret: string;
  /** The laptop's latest roster, destinations, limits and PIN. */
  setup: DoorSetup;
  /** May be newer than setup.activeClass if the class was changed here while offline. */
  activeClass: ActiveClass | null;
  /** Passes still open, and any the laptop has not yet confirmed receiving. */
  passes: Pass[];
  /** Ids of passes changed here that the laptop has not confirmed yet. */
  outbox: string[];
};

export type DoorNotice = {
  kind: 'approved' | 'denied' | 'returned';
  title: string;
  message: string;
  /** A pass that a mis-tap can still undo, for a few seconds. */
  undoPassId?: string;
};

const storageKey = 'hallway.door';

function loadDevice(): PairedDevice | null {
  try {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

export const door = $state({
  device: loadDevice(),
  /** Only meaningful on a paired device. */
  status: 'offline' as 'offline' | 'live' | 'replaced',
  pairing: { state: 'idle' as 'idle' | 'connecting' | 'error', message: '', slow: false },
  notice: null as DoorNotice | null,
});

/** True when this browser is the teacher's laptop acting as its own kiosk. */
export function isLocal() {
  return account.kiosk?.kind === 'this-computer';
}

/** True when this browser is a paired kiosk device. Such a browser is never a teacher workspace. */
export function isPairedDevice() {
  return !!door.device;
}

function saveDevice() {
  if (door.device) localStorage.setItem(storageKey, JSON.stringify(door.device));
  else localStorage.removeItem(storageKey);
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export function setup(): DoorSetup | null {
  if (isLocal()) return doorSetup();
  return door.device?.setup ?? null;
}

function activeClassId() {
  return isLocal() ? account.activeClass?.id : door.device?.activeClass?.id;
}

export function activeDoorClass() {
  const id = activeClassId();
  return setup()?.classes.find((cls) => cls.id === id) ?? null;
}

function allPasses(): Pass[] {
  return isLocal() ? account.passes : (door.device?.passes ?? []);
}

export function openPassFor(studentId: string) {
  return allPasses().find((pass) => pass.studentId === studentId && !pass.inAt);
}

export function outCount(classId: string) {
  return allPasses().filter((pass) => pass.classId === classId && !pass.inAt).length;
}

export function checkPin(pin: string) {
  return pin === setup()?.pin;
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

/** Every change made at the door goes through here, on its way to the laptop. */
function record(passes: Pass[]) {
  if (isLocal()) {
    receivePasses(passes);
    return;
  }
  const device = door.device;
  if (!device) return;
  mergeInto(device.passes, passes);
  device.outbox = [...new Set([...device.outbox, ...passes.map((pass) => pass.id)])];
  saveDevice();
  flush();
}

let noticeTimer = 0;
function showNotice(notice: DoorNotice, seconds: number) {
  clearTimeout(noticeTimer);
  door.notice = notice;
  noticeTimer = window.setTimeout(() => (door.notice = null), seconds * 1000);
}

export function dismissNotice() {
  clearTimeout(noticeTimer);
  door.notice = null;
}

export function signBackIn(studentId: string) {
  const pass = openPassFor(studentId);
  if (!pass) return;
  const at = now();
  record([{ ...$state.snapshot(pass), inAt: at, endedBy: 'student', updatedAt: at }]);
  showNotice({ kind: 'returned', title: `Welcome back, ${pass.studentName}`, message: 'You are signed back in.' }, 4);
}

/**
 * Grants a pass if the class is under its Pass Limit. A refusal gives a count,
 * never the names of who is out.
 */
export function requestPass(studentId: string, destination: string) {
  const cls = activeDoorClass();
  const student = cls?.students.find((each) => each.id === studentId);
  const place = setup()?.destinations.find((each) => each.label === destination);
  if (!cls || !student || !place) return;
  const out = outCount(cls.id);
  if (out >= cls.limit) {
    showNotice(
      {
        kind: 'denied',
        title: 'Please wait in class',
        message: `${out} of ${cls.limit} ${cls.limit === 1 ? 'student is' : 'students are'} already out. Try again when someone comes back.`,
      },
      6,
    );
    return;
  }
  const at = now();
  const pass: Pass = {
    id: newId(),
    classId: cls.id,
    studentId,
    studentName: student.name,
    destination,
    minutes: place.minutes ?? 0,
    outAt: at,
    updatedAt: at,
  };
  record([pass]);
  showNotice(
    {
      kind: 'approved',
      title: `${student.name}: ${destination}`,
      message: pass.minutes ? `Back by ${dueTime(pass)}` : 'Come straight back to class.',
      undoPassId: pass.id,
    },
    8,
  );
}

/** "That's not me": undoes a pass given to the wrong student moments ago. */
export function undoPass(passId: string) {
  const pass = allPasses().find((each) => each.id === passId);
  if (pass && !pass.inAt) record([endUnseen($state.snapshot(pass), 'cancelled')]);
  dismissNotice();
}

/** Changing class at the door ends every pass still open in the class being left. */
export function changeClass(classId: string) {
  const activeClass = { id: classId, changedAt: now() };
  if (isLocal()) {
    setActiveClass(activeClass);
    return;
  }
  adoptActiveClass(activeClass);
  send({ type: 'active-class', activeClass });
}

function adoptActiveClass(activeClass: ActiveClass) {
  const device = door.device;
  if (!device) return;
  const leaving = device.activeClass?.id;
  device.activeClass = activeClass;
  saveDevice();
  if (leaving && leaving !== activeClass.id) {
    const open = device.passes.filter((pass) => pass.classId === leaving && !pass.inAt);
    record(open.map((pass) => endUnseen($state.snapshot(pass), 'switch')));
  }
}

// ---------------------------------------------------------------------------
// Talking to the laptop
// ---------------------------------------------------------------------------

let peer: Peer | null = null;
let connection: DataConnection | null = null;
let retryTimer = 0;

function send(message: KioskMessage) {
  if (connection?.open) connection.send(message);
}

/** Sends every pass the laptop has not confirmed yet. */
function flush() {
  const device = door.device;
  if (!device?.outbox.length) return;
  const waiting = device.passes.filter((pass) => device.outbox.includes(pass.id));
  send({ type: 'passes', passes: $state.snapshot(waiting) });
}

/** How many passes are saved here waiting for the laptop. */
export function waitingCount() {
  return door.device?.outbox.length ?? 0;
}

/** Keeps open passes and unsent ones; everything else already lives on the laptop. */
function prune(device: PairedDevice) {
  device.passes = device.passes.filter((pass) => !pass.inAt || device.outbox.includes(pass.id));
}

function receive(message: LaptopMessage) {
  const device = door.device;
  if (!device) return;
  if (message.type === 'setup') {
    device.setup = message.setup;
    mergeInto(device.passes, message.setup.passes);
    const theirs = message.setup.activeClass;
    if (theirs && (!device.activeClass || theirs.changedAt > device.activeClass.changedAt)) adoptActiveClass(theirs);
    prune(device);
    saveDevice();
  }
  if (message.type === 'ack') {
    for (const acked of message.passes) {
      const pass = device.passes.find((each) => each.id === acked.id);
      // Changed again since it was sent? Then it still needs sending.
      if (!pass || pass.updatedAt <= acked.updatedAt) device.outbox = device.outbox.filter((id) => id !== acked.id);
    }
    prune(device);
    saveDevice();
  }
  if (message.type === 'replaced') {
    forgetDevice();
    door.status = 'replaced';
  }
}

function dial() {
  const device = door.device;
  // While the matchmaking server is unreachable, createPeer is already retrying.
  if (!peer || peer.destroyed || peer.disconnected || !device) return;
  connection?.close();
  const attempt = peer.connect(device.laptopPeerId, {
    metadata: { kioskId: device.kioskId, secret: device.secret },
    reliable: true,
  });
  connection = attempt;
  attempt.on('open', () => {
    keepAlive(attempt);
    door.status = 'live';
    flush();
    if (device.activeClass) send({ type: 'active-class', activeClass: $state.snapshot(device.activeClass) });
  });
  attempt.on('data', (data) => receive(data as LaptopMessage));
  attempt.on('close', () => {
    if (connection !== attempt) return;
    connection = null;
    if (door.status === 'live') door.status = 'offline';
  });
}

/** Finds the laptop, and keeps trying for as long as this device is the kiosk. */
export async function connectToLaptop() {
  if (!door.device || peer) return;
  door.status = 'offline';
  peer = await createPeer();
  peer.on('open', dial);
  peer.on('error', () => {
    if (!connection?.open) door.status = door.status === 'replaced' ? 'replaced' : 'offline';
  });
  clearInterval(retryTimer);
  retryTimer = window.setInterval(() => {
    if (door.device && door.status === 'offline') dial();
  }, 4000);
}

/** Stops being a kiosk. Anything not yet handed over is lost, so the page warns first. */
export function forgetDevice() {
  clearInterval(retryTimer);
  connection?.close();
  connection = null;
  peer?.destroy();
  peer = null;
  door.device = null;
  saveDevice();
}

/**
 * Dials the short code shown on the teacher's laptop. If the code is found but
 * the two devices cannot open a direct connection, this network blocks them,
 * and only the teacher's own computer can be the kiosk.
 */
export async function pairWithCode(code: string) {
  door.pairing = { state: 'connecting', message: '', slow: false };
  // A wrong code is only reported once the matchmaking server gives up on it,
  // which can take a while; meanwhile, suggest checking the code.
  const slowTimer = setTimeout(() => (door.pairing.slow = true), 6000);
  door.status = 'offline';
  const temporary = await createPeer();
  let done = false;
  const fail = (message: string) => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    clearTimeout(slowTimer);
    temporary.destroy();
    door.pairing = { state: 'error', message, slow: false };
  };
  const timer = setTimeout(
    () =>
      fail(
        "This network won't let the two devices connect directly. Use the teacher's computer as the kiosk instead.",
      ),
    25_000,
  );
  temporary.on('error', (error) => {
    if (error.type === 'peer-unavailable') {
      fail("That code didn't match. Check the code on the teacher's screen. Codes expire after 10 minutes.");
    } else if (error.type === 'network' || error.type === 'server-error' || error.type === 'socket-error') {
      fail("Couldn't reach the internet to look up that code. Check this device's connection and try again.");
    }
  });
  temporary.on('open', () => {
    const attempt = temporary.connect(pairingPrefix + code, { reliable: true });
    attempt.on('data', (data) => {
      const message = data as LaptopMessage;
      if (message.type !== 'paired' || done) return;
      done = true;
      clearTimeout(timer);
      clearTimeout(slowTimer);
      door.device = {
        laptopPeerId: message.laptopPeerId,
        kioskId: message.kioskId,
        secret: message.secret,
        setup: message.setup,
        activeClass: message.setup.activeClass,
        passes: message.setup.passes.filter((pass) => !pass.inAt),
        outbox: [],
      };
      saveDevice();
      door.pairing = { state: 'idle', message: '', slow: false };
      setTimeout(() => temporary.destroy(), 500);
      connectToLaptop();
    });
  });
}
