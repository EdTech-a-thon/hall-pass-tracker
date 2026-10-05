import type { DataConnection, Peer } from 'peerjs';
import { account, doorSetup, receivePasses, setActiveClass, setLine } from './account.svelte';
import { destinationCounts, passesLeftText, usedBy, usedUpText } from './allowance';
import { dueTime, endOfDay, endUnseen, mergeInto, newId, now, permissionsUsedBy } from './passes';
import { createPeer, keepAlive, pairingPrefix } from './peer';
import { formatClock, noPassTimeAt } from './schedule';
import type { ActiveClass, DoorSetup, KioskMessage, LaptopMessage, LineSpot, Pass, PermissionKind } from './types';

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
  /** Permissions from the laptop already used here, until the laptop hears and stops offering them. */
  usedPermissions?: string[];
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
  /** Offered whenever a rule stops a student: the teacher may let them go with the PIN. */
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
 * refreshes) sends one Pass Limit for every destination and a list of Extra
 * Passes. Read them the new way, so the door keeps its old limits rather than
 * having none.
 */
function fromOlderLaptop(setup: DoorSetup): DoorSetup {
  for (const destination of setup.destinations) {
    if (destination.limit === undefined) destination.limit = setup.passLimit ?? 1;
  }
  setup.permissions ??= (setup.extraPassGifts ?? []).map((gift) => ({
    ...gift,
    kind: 'extra-pass',
    expiresAt: endOfDay(gift.givenAt),
  }));
  return setup;
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
  return noPassTimeAt(activeDoorClass()?.noPassTimes ?? [], at);
}

/** A Permission from the laptop that the student may still use here, if they have one of that kind. */
export function permissionFor(studentId: string, kind: PermissionKind, at = Date.now()) {
  const classId = activeClassId();
  const spent = new Set([...(door.device?.usedPermissions ?? []), ...allPasses().flatMap(permissionsUsedBy)]);
  const time = new Date(at).toISOString();
  return (setup()?.permissions ?? []).find(
    (each) =>
      each.kind === kind &&
      each.classId === classId &&
      each.studentId === studentId &&
      each.expiresAt > time &&
      !spent.has(each.id),
  );
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
 * them at their destination, or the teacher let them skip the line, and
 * passes are allowed (or the teacher let them past the No-Pass Time).
 */
export function upNext(at = Date.now()): LineSpot[] {
  const blocked = !!noPassNow(at);
  return line().filter(
    (spot) =>
      (!blocked || permissionFor(spot.studentId, 'no-pass-exception', at)) &&
      (hasRoom(spot.studentId, spot.destination) || permissionFor(spot.studentId, 'line-skip', at)),
  );
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
    gift: permissionFor(studentId, 'extra-pass'),
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
 * Grants a pass if the destination has room, or turns the student away with
 * the reason. Three rules can stop a student, each lifted on its own:
 * - a used-up Pass Allowance, by an Extra Pass (or an allowance that only warns)
 * - No-Pass Time, by a No-Pass Exception
 * - a full destination, or others ahead in its Line, by a Line Skip
 * The teacher gives those from the laptop ahead of time. `teacherLetGo` (after
 * the PIN at the kiosk) lifts all three at once. Either way, each rule lifted
 * is marked on the pass. A refusal gives a count, never who is out.
 */
export function requestPass(studentId: string, destination: string, teacherLetGo = false) {
  const cls = activeDoorClass();
  const student = cls?.students.find((each) => each.id === studentId);
  const place = destinationNamed(destination);
  if (!cls || !student || !place) return;
  const spot = lineSpotFor(studentId);
  const inThisLine = spot?.destination === destination;
  const offerTeacher = { studentId, destination };

  const counts = destinationCounts(place);
  const allowance = counts ? allowanceFor(studentId) : null;
  const usedUp = !!allowance?.usedUp;
  const extraPass = usedUp && !teacherLetGo ? allowance?.gift : undefined;
  const onlyWarned = usedUp && !teacherLetGo && !extraPass && allowance?.whenUsedUp === 'warn';
  // A student already in this line was checked when they joined, so is never stopped here.
  if (usedUp && !teacherLetGo && !extraPass && !onlyWarned && !inThisLine) {
    showNotice(
      { kind: 'denied', eyebrow: 'Out of passes', title: allowance!.text, message: 'Ask your teacher.', offerTeacher },
      15,
    );
    return;
  }

  const blocked = noPassNow();
  const exception = blocked && !teacherLetGo ? permissionFor(studentId, 'no-pass-exception') : undefined;
  if (blocked && !teacherLetGo && !exception) {
    const opens = formatClock(blocked.end);
    // During a No-Pass Time, a destination with a limit offers a place in its line.
    const mayLineUp = setup()?.lineEnabled && place.limit !== null && !inThisLine;
    showNotice(
      mayLineUp
        ? {
            kind: 'denied',
            eyebrow: 'No-pass time',
            title: 'Join the line?',
            message: `Passes open at ${opens}. Join the line to go as soon as they do.`,
            offerLine: { studentId, destination },
            offerTeacher,
          }
        : {
            kind: 'denied',
            eyebrow: 'No-pass time',
            title: 'No passes right now',
            message: `Passes open again at ${opens}.`,
            offerTeacher,
          },
      10,
    );
    return;
  }

  // A free spot is held for whoever is first in that destination's line.
  const full = !hasRoom(studentId, destination);
  const lineSkip = full && !teacherLetGo ? permissionFor(studentId, 'line-skip') : undefined;
  if (full && !teacherLetGo && !lineSkip) {
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
      10,
    );
    return;
  }

  // A student can only be in one place: starting a pass takes them out of any line.
  if (spot) saveLine(line().filter((each) => each.studentId !== studentId));
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
  if (!counts) pass.counts = false;
  if (usedUp) pass.extra = true;
  if (blocked) pass.noPassException = true;
  if (full) pass.lineSkip = true;
  const used = [extraPass, exception, lineSkip].flatMap((permission) => (permission ? [permission.id] : []));
  if (used.length) {
    pass.permissionIds = used;
    if (door.device) door.device.usedPermissions = [...(door.device.usedPermissions ?? []), ...used];
  }
  record([pass]);
  const back = pass.minutes ? `Back by ${dueTime(pass)}.` : 'Come straight back to class.';
  showNotice(
    {
      kind: 'approved',
      title: `${student.name}: ${destination}`,
      message:
        onlyWarned
          ? `${allowance!.text} You can still go, and your teacher will see it was an extra pass. ${back}`
          : pass.minutes
            ? `Back by ${dueTime(pass)}`
            : back,
      undoPassId: pass.id,
    },
    8,
  );
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
  // The Line belongs to the class at the door; a new class starts with none.
  if (leaving !== activeClass.id) device.line = [];
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
    // A used Permission the laptop no longer offers needs no remembering.
    const offered = new Set((message.setup.permissions ?? []).map((permission) => permission.id));
    device.usedPermissions = (device.usedPermissions ?? []).filter((id) => offered.has(id));
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
    send({ type: 'line', line: $state.snapshot(device.line ?? []) });
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
        setup: fromOlderLaptop(message.setup),
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
