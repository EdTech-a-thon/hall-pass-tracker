import type { DataConnection, Peer } from 'peerjs';
import { account, doorSetup, keepToSchedule, receivePasses, setActiveClass, setLine } from './account.svelte';
import { destinationCounts, passesLeftText, usedBy, usedUpText } from './allowance';
import { connectionReport, watchConnection, type ConnectionWatch } from './diagnostics';
import { dueTime, endUnseen, mergeInto, newId, now } from './passes';
import { createPeer, keepAlive, pairingPrefix } from './peer';
import { formatClock, noPassAt, scheduledClassAt } from './schedule';
import type { ActiveClass, Block, DoorSetup, KioskMessage, LaptopMessage, LineSpot, Pass, PassRequest } from './types';

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
  /** The Line. The kiosk is in charge of it and tells the laptop. */
  line?: LineSpot[];
  /** Waiting Requests. The kiosk is in charge of them and tells the laptop. */
  requests?: PassRequest[];
};

export type DoorNotice = {
  kind: 'approved' | 'denied' | 'returned';
  /** The small heading above the title, when the kind's usual one doesn't fit. */
  eyebrow?: string;
  title: string;
  message: string;
  /** A pass that a mis-tap can still undo, for a few seconds. */
  undoPassId?: string;
  /** Offered when the destination is full (or it's No-Pass Time) and lines are on. */
  offerLine?: { studentId: string; destination: string };
  /** Offered whenever a rule stops a student: they may ask the teacher, or the teacher may let them go with the PIN. */
  offerTeacher?: { studentId: string; destination: string };
};

const storageKey = 'hallway.door';

function loadDevice(): PairedDevice | null {
  try {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return null;
    const device: PairedDevice = JSON.parse(saved);
    device.setup = fromOlderLaptop(device.setup);
    return device;
  } catch {
    return null;
  }
}

/**
 * A laptop still on the version before per-destination limits (until it
 * refreshes) sends one Pass Limit for every destination. Read it the new way,
 * so the door keeps its old limits rather than having none.
 */
function fromOlderLaptop(setup: DoorSetup): DoorSetup {
  for (const destination of setup.destinations) {
    if (destination.limit === undefined) destination.limit = setup.passLimit ?? 1;
  }
  return setup;
}

export const door = $state({
  device: loadDevice(),
  /** Only meaningful on a paired device. */
  status: 'offline' as 'offline' | 'live' | 'replaced',
  pairing: {
    state: 'idle' as 'idle' | 'connecting' | 'error',
    message: '',
    slow: false,
    /** Technical details of a failed attempt, for the teacher to send to support. */
    problem: null as null | { code: string; text: string },
  },
  notice: null as DoorNotice | null,
  /** Students the teacher just said no to, and when, so their name says so for a minute. */
  denied: {} as Record<string, number>,
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

function currentActiveClass() {
  return isLocal() ? account.activeClass : door.device?.activeClass;
}

function activeClassId() {
  return currentActiveClass()?.id;
}

/** Whether the kiosk is following the Current Schedule. */
export function onSchedule() {
  return !!currentActiveClass()?.onSchedule && !!setup()?.schedule;
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

export function destinationNamed(label: string) {
  return setup()?.destinations.find((each) => each.label === label);
}

/** How many students from the class on the kiosk are at one destination right now. */
export function outAt(destination: string) {
  const classId = activeClassId();
  return allPasses().filter((pass) => pass.classId === classId && pass.destination === destination && !pass.inAt).length;
}

/** Whether a destination has reached its Pass Limit. One with no limit is never full. */
export function isFull(destination: string) {
  const limit = destinationNamed(destination)?.limit;
  return limit != null && outAt(destination) >= limit;
}

/**
 * The Lines for the class on the kiosk, first in line first. Each destination
 * has its own: pass a destination to get just its line.
 */
export function line(destination?: string): LineSpot[] {
  const classId = activeClassId();
  const all = isLocal() ? account.line : (door.device?.line ?? []);
  return all.filter((spot) => spot.classId === classId && (!destination || spot.destination === destination));
}

/** Where a student is waiting, if anywhere, with their place in that destination's line. */
export function lineSpotFor(studentId: string) {
  const spot = line().find((each) => each.studentId === studentId);
  if (!spot) return null;
  return { ...spot, position: line(spot.destination).indexOf(spot) + 1 };
}

/** The No-Pass Time the class on the kiosk is in right now, if any. */
export function noPassNow(at = Date.now()) {
  const current = setup();
  return noPassAt(
    { schedule: current?.schedule, activeClass: currentActiveClass(), manualNoPass: current?.manualNoPass },
    activeClassId(),
    at,
  );
}

/** "Passes open again at 9:15 AM", or, for one the teacher started, that the teacher will open them. */
export function whenPassesOpen(noPass: { end: string | null }) {
  return noPass.end ? `Passes open at ${formatClock(noPass.end)}.` : 'Your teacher will open passes again.';
}

/**
 * Whether a student may go to a destination without waiting: it has no limit,
 * or there is a spot free once those ahead of them in its line have theirs.
 */
function hasRoom(studentId: string, destination: string) {
  const limit = destinationNamed(destination)?.limit;
  if (limit == null) return true;
  const waiting = line(destination);
  const place = waiting.findIndex((spot) => spot.studentId === studentId);
  const ahead = place === -1 ? waiting.length : place;
  return outAt(destination) + ahead < limit;
}

/**
 * Students in line who may go now, and are **Up Next**: a spot has opened for
 * them at their destination, and passes are allowed.
 */
export function upNext(at = Date.now()): LineSpot[] {
  if (noPassNow(at)) return [];
  return line().filter((spot) => hasRoom(spot.studentId, spot.destination));
}

/**
 * Where one student stands with the Pass Allowance, or null when it doesn't
 * apply to them (it's off, or they're an Exempt Student). The kiosk counts the
 * laptop's list plus its own passes, so it stays right while the laptop is closed.
 */
export function allowanceFor(studentId: string) {
  const current = setup();
  const cls = activeDoorClass();
  const allowance = current?.passAllowance;
  const student = cls?.students.find((each) => each.id === studentId);
  if (!current || !cls || !allowance?.enabled || !student || student.exempt) return null;
  const used = usedBy(allowance, cls.id, studentId, [...(current.countedPasses ?? []), ...allPasses()]);
  const left = Math.max(0, allowance.passes - used);
  return {
    left,
    usedUp: left === 0,
    text: left ? passesLeftText(allowance, left) : usedUpText(allowance),
    whenUsedUp: allowance.whenUsedUp,
  };
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
  // The spot they leave is held for whoever is first in that destination's line.
  const next = upNext().find((spot) => spot.destination === pass.destination);
  showNotice(
    {
      kind: 'returned',
      title: `Welcome back, ${pass.studentName}`,
      message: next ? `${next.studentName}, it's your turn. Tap your name to go.` : 'You are signed back in.',
    },
    4,
  );
}

function saveLine(next: LineSpot[]) {
  const snapshot = $state.snapshot(next);
  if (isLocal()) {
    setLine(snapshot);
    return;
  }
  const device = door.device;
  if (!device) return;
  device.line = snapshot;
  saveDevice();
  send({ type: 'line', line: snapshot });
}

/**
 * What stops a student going to a destination right now, if anything:
 * - a used-up Pass Allowance (unless it only warns)
 * - No-Pass Time
 * - a full destination, or others ahead of them in its line
 * A student already in that destination's line was checked against their
 * allowance when they joined, so it never stops them there.
 */
export function blocksFor(studentId: string, destination: string): Block[] {
  const place = destinationNamed(destination);
  if (!place) return [];
  const inThisLine = lineSpotFor(studentId)?.destination === destination;
  const allowance = destinationCounts(place) ? allowanceFor(studentId) : null;
  const blocks: Block[] = [];
  if (allowance?.usedUp && allowance.whenUsedUp === 'stop' && !inThisLine) blocks.push('allowance');
  if (noPassNow()) blocks.push('no-pass');
  if (!hasRoom(studentId, destination)) blocks.push('full');
  return blocks;
}

/**
 * Grants a pass if nothing stops the student, or turns them away with the
 * reason, offering the line where there is one, and a way to ask the teacher.
 * Once the teacher has approved (on Home, or with the PIN here) nothing stops
 * them, and the pass is marked with each rule it went past. A refusal gives a
 * count, never who is out.
 */
export function requestPass(studentId: string, destination: string, approvedBy?: 'home' | 'pin') {
  const cls = activeDoorClass();
  const student = cls?.students.find((each) => each.id === studentId);
  const place = destinationNamed(destination);
  if (!cls || !student || !place || openPassFor(studentId)) return;
  const spot = lineSpotFor(studentId);
  const inThisLine = spot?.destination === destination;
  const offerTeacher = { studentId, destination };
  const blocks = blocksFor(studentId, destination);
  const allowance = destinationCounts(place) ? allowanceFor(studentId) : null;

  if (!approvedBy && blocks.includes('allowance')) {
    showNotice(
      { kind: 'denied', eyebrow: 'Out of passes', title: allowance!.text, message: 'Ask your teacher.', offerTeacher },
      15,
    );
    return;
  }

  const blocked = noPassNow();
  if (!approvedBy && blocked) {
    const opens = whenPassesOpen(blocked);
    // During a No-Pass Time, a destination with a limit offers a place in its line.
    const mayLineUp = setup()?.lineEnabled && place.limit !== null && !inThisLine;
    showNotice(
      mayLineUp
        ? {
            kind: 'denied',
            eyebrow: 'No-pass time',
            title: 'Join the line?',
            message: `${opens} Join the line to go as soon as they do.`,
            offerLine: { studentId, destination },
            offerTeacher,
          }
        : { kind: 'denied', eyebrow: 'No-pass time', title: 'No passes right now', message: opens, offerTeacher },
      15,
    );
    return;
  }

  // A free spot is held for whoever is first in that destination's line.
  if (!approvedBy && blocks.includes('full')) {
    const out = outAt(destination);
    const waiting = line(destination).length;
    const someone = (count: number) => `${count} ${count === 1 ? 'student is' : 'students are'}`;
    showNotice(
      setup()?.lineEnabled && !inThisLine
        ? {
            kind: 'denied',
            title: 'Join the line?',
            message: isFull(destination)
              ? `${destination} is full${waiting ? `, and ${waiting} ${waiting === 1 ? 'is' : 'are'} waiting` : ''}.`
              : `${someone(waiting)} already waiting for ${destination}.`,
            offerLine: { studentId, destination },
            offerTeacher,
          }
        : {
            kind: 'denied',
            title: 'Please wait in class',
            message: `${someone(out)} already at ${destination}. Try again when someone comes back.`,
            offerTeacher,
          },
      15,
    );
    return;
  }

  // A student can only be in one place: starting a pass takes them out of any line, and ends their Request.
  if (spot) saveLine(line().filter((each) => each.studentId !== studentId));
  if (requestFor(studentId)) saveRequests(requests().filter((each) => each.studentId !== studentId));
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
  if (!allowance) pass.counts = false;
  if (allowance?.usedUp) pass.extra = true;
  if (blocked) pass.noPassException = true;
  if (blocks.includes('full')) pass.lineSkip = true;
  if (approvedBy && blocks.length) pass.approvedBy = approvedBy;
  record([pass]);
  // Approved from Home, the student may be back at their seat, and someone else may be at the screen.
  if (approvedBy === 'home') return;
  const back = pass.minutes ? `Back by ${dueTime(pass)}.` : 'Come straight back to class.';
  const onlyWarned = allowance?.usedUp && !approvedBy;
  showNotice(
    {
      kind: 'approved',
      title: `${student.name}: ${destination}`,
      message: onlyWarned
        ? `${allowance!.text} You can still go, and your teacher will see it was an extra pass. ${back}`
        : pass.minutes
          ? `Back by ${dueTime(pass)}`
          : back,
      undoPassId: pass.id,
    },
    8,
  );
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

/** Students can ask only while the laptop can hear them. Otherwise the PIN is the only way past. */
export function canAsk() {
  return !!door.device && door.status === 'live';
}

/** The waiting Requests from the class on the kiosk. */
export function requests(): PassRequest[] {
  const classId = activeClassId();
  return (door.device?.requests ?? []).filter((request) => request.classId === classId);
}

export function requestFor(studentId: string) {
  return requests().find((request) => request.studentId === studentId);
}

function saveRequests(next: PassRequest[]) {
  const device = door.device;
  if (!device) return;
  device.requests = $state.snapshot(next);
  saveDevice();
  send({ type: 'requests', requests: device.requests });
}

/** "Ask my teacher": a student has at most one Request, so asking again replaces it. */
export function askTeacher(studentId: string, destination: string) {
  const cls = activeDoorClass();
  const student = cls?.students.find((each) => each.id === studentId);
  if (!cls || !student || !canAsk()) return;
  const blocks = blocksFor(studentId, destination);
  if (!blocks.length) {
    requestPass(studentId, destination);
    return;
  }
  const request: PassRequest = {
    id: newId(),
    classId: cls.id,
    studentId,
    studentName: student.name,
    destination,
    blocks,
    askedAt: now(),
  };
  saveRequests([...requests().filter((each) => each.studentId !== studentId), request]);
  delete door.denied[studentId];
  showNotice(
    {
      kind: 'returned',
      eyebrow: 'Asked your teacher',
      title: `${student.name}: ${destination}`,
      message: 'If your teacher says yes, your name will say you’re out. Then go.',
    },
    6,
  );
}

export function cancelRequest(studentId: string) {
  saveRequests(requests().filter((each) => each.studentId !== studentId));
}

/** A Request ends by itself once nothing stops the student any more, so they can just tap their name. */
export function settleRequests() {
  const all = door.device?.requests ?? [];
  const still = requests().filter((request) => blocksFor(request.studentId, request.destination).length);
  if (still.length !== all.length) saveRequests(still);
}

/** The teacher answered on Home. */
function answer(requestId: string, approve: boolean) {
  const request = requests().find((each) => each.id === requestId);
  if (!request) return;
  cancelRequest(request.studentId);
  if (approve) requestPass(request.studentId, request.destination, 'home');
  else door.denied[request.studentId] = Date.now();
}

/** Joins a destination's line. A student waits in one line at a time, so joining another leaves the first. */
export function joinLine(studentId: string, destination: string) {
  const cls = activeDoorClass();
  const student = cls?.students.find((each) => each.id === studentId);
  if (!cls || !student || lineSpotFor(studentId)?.destination === destination) return;
  const spot: LineSpot = { studentId, studentName: student.name, classId: cls.id, destination, joinedAt: now() };
  saveLine([...line().filter((each) => each.studentId !== studentId), spot]);
  const position = line(destination).length;
  showNotice(
    {
      kind: 'returned',
      eyebrow: 'In line',
      title: `You're ${ordinal(position)} in line for ${destination}`,
      message: 'Watch for your name. When it turns green, tap it to go.',
    },
    5,
  );
}

export function leaveLine(studentId: string) {
  saveLine(line().filter((spot) => spot.studentId !== studentId));
}

export function clearLine() {
  saveLine([]);
}

function ordinal(position: number) {
  if (position === 1) return '1st';
  if (position === 2) return '2nd';
  if (position === 3) return '3rd';
  return `${position}th`;
}

/** "That's not me": undoes a pass given to the wrong student moments ago. */
export function undoPass(passId: string) {
  const pass = allPasses().find((each) => each.id === passId);
  if (pass && !pass.inAt) record([endUnseen($state.snapshot(pass), 'cancelled')]);
  dismissNotice();
}

/**
 * Changing class at the door ends every pass still open in the class being
 * left. Changing it by hand takes the teacher off schedule.
 */
export function changeClass(classId: string | null, byTheSchedule = false) {
  const activeClass = { id: classId, changedAt: now(), ...(byTheSchedule ? { onSchedule: true } : {}) };
  if (isLocal()) {
    setActiveClass(activeClass);
    return;
  }
  adoptActiveClass(activeClass);
  send({ type: 'active-class', activeClass });
}

/**
 * On Schedule, the kiosk moves itself to whatever class the clock says, even
 * while the laptop is closed. The door screen calls this as the clock ticks.
 */
export function followSchedule(at = Date.now()) {
  if (isLocal()) {
    keepToSchedule();
    return;
  }
  if (!onSchedule()) return;
  const id = scheduledClassAt(setup()?.schedule, at);
  if (id !== activeClassId()) changeClass(id, true);
}

/** The Current Schedule, as the kiosk last heard it from the laptop. */
export function doorSchedule() {
  return setup()?.schedule;
}

function adoptActiveClass(activeClass: ActiveClass) {
  const device = door.device;
  if (!device) return;
  const leaving = device.activeClass?.id;
  device.activeClass = activeClass;
  // The Line and Requests belong to the class at the door; a new class starts with none.
  if (leaving !== activeClass.id) {
    device.line = [];
    device.requests = [];
  }
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
    device.setup = fromOlderLaptop(message.setup);
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
  if (message.type === 'answer') answer(message.requestId, message.approve);
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
    send({ type: 'line', line: $state.snapshot(device.line ?? []) });
    send({ type: 'requests', requests: $state.snapshot(device.requests ?? []) });
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
  door.pairing = { state: 'connecting', message: '', slow: false, problem: null };
  // A wrong code is only reported once the matchmaking server gives up on it,
  // which can take a while; meanwhile, suggest checking the code.
  const slowTimer = setTimeout(() => (door.pairing.slow = true), 6000);
  door.status = 'offline';
  const temporary = await createPeer();
  let done = false;
  let attempt: DataConnection | null = null;
  let watch: ConnectionWatch | null = null;
  let peerError = '';
  /** `report` is off for a mistyped code: the message already says what to do. */
  const fail = async (message: string, report = true) => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    clearTimeout(slowTimer);
    // Read the connection's details before destroying it closes it.
    const problem = !report ? null : await connectionReport({
      problem: `Pairing with code ${code}: ${message}`,
      side: 'door device',
      connection: attempt?.peerConnection,
      watch,
      peerError,
    });
    temporary.destroy();
    door.pairing = { state: 'error', message, slow: false, problem };
  };
  const timer = setTimeout(
    () =>
      fail(
        "This network won't let the two devices connect directly. Use the teacher's computer as the kiosk instead.",
      ),
    25_000,
  );
  temporary.on('error', (error) => {
    peerError = `${error.type}: ${error.message}`;
    if (error.type === 'peer-unavailable') {
      fail("That code didn't match. Check the code on the teacher's screen. Codes expire after 10 minutes.", false);
    } else if (error.type === 'network' || error.type === 'server-error' || error.type === 'socket-error') {
      fail("Couldn't reach the internet to look up that code. Check this device's connection and try again.");
    }
  });
  temporary.on('open', () => {
    attempt = temporary.connect(pairingPrefix + code, { reliable: true });
    watch = watchConnection(attempt.peerConnection);
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
        setup: fromOlderLaptop(message.setup),
        activeClass: message.setup.activeClass,
        passes: message.setup.passes.filter((pass) => !pass.inAt),
        outbox: [],
      };
      saveDevice();
      door.pairing = { state: 'idle', message: '', slow: false, problem: null };
      setTimeout(() => temporary.destroy(), 500);
      connectToLaptop();
    });
  });
}
