import { defaultDestinations } from './destinations';
import { endUnseen, mergeInto, newId, now } from './passes';
import { displayName, type ImportPlan } from './roster';
import type { Account, ActiveClass, Class, Destination, DoorSetup, Pass, Student } from './types';

/**
 * The teacher's whole Account, kept in this browser's local storage. There is
 * no server: this object is the record. See docs/adr/0005.
 */
const storageKey = 'hallway.account';

function blankAccount(): Account {
  return {
    version: 1,
    laptopPeerId: `hallway-${newId()}`,
    classes: [],
    destinations: defaultDestinations(newId),
    passes: [],
    pin: '',
    kiosk: null,
    activeClass: null,
    replacedKiosks: [],
    networkBlocked: false,
  };
}

/**
 * Accounts saved before destinations became one shared list kept a list on
 * each class. Those become the shared list, so nothing the teacher set is lost.
 */
type SavedAccount = Omit<Account, 'destinations' | 'classes'> & {
  destinations?: Destination[];
  classes: (Class & { destinations?: { label: string; minutes: number }[] })[];
};

function upgrade(saved: SavedAccount): Account {
  if (!saved.destinations) {
    const old = saved.classes.find((cls) => cls.destinations?.length)?.destinations;
    const defaults = defaultDestinations(newId);
    saved.destinations = old
      ? old.map((each): Destination => ({
          ...(defaults.find((preset) => preset.label === each.label) ?? defaults[defaults.length - 1]),
          id: newId(),
          label: each.label,
          minutes: each.minutes || null,
        }))
      : defaults;
  }
  for (const cls of saved.classes) delete cls.destinations;
  return saved as Account;
}

function load(): Account {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) return upgrade({ ...blankAccount(), destinations: undefined, ...JSON.parse(saved) });
  } catch {
    // Storage blocked or unreadable: start empty rather than not at all.
  }
  return blankAccount();
}

export const account: Account = $state(load());

/** Called after every save, so a connected kiosk hears about the change. */
let afterSave = () => {};
export function onSave(listener: () => void) {
  afterSave = listener;
}

function save() {
  localStorage.setItem(storageKey, JSON.stringify(account));
  afterSave();
}

export function findClass(id: string) {
  return account.classes.find((cls) => cls.id === id);
}

export function classPasses(classId: string) {
  return account.passes.filter((pass) => pass.classId === classId);
}

export function openPasses(classId?: string) {
  return account.passes.filter((pass) => !pass.inAt && (!classId || pass.classId === classId));
}

// ---------------------------------------------------------------------------
// Classes
// ---------------------------------------------------------------------------

/** A new class copies the Pass Limit of the most recent one. */
export function createClass(name: string) {
  const previous = account.classes.at(-1);
  const cls: Class = {
    id: newId(),
    name,
    limit: previous?.limit ?? 1,
    students: [],
    createdAt: now(),
  };
  account.classes.push(cls);
  if (!account.activeClass) account.activeClass = { id: cls.id, changedAt: now() };
  save();
  return cls.id;
}

export function updateClass(id: string, changes: Partial<Pick<Class, 'name' | 'limit'>>) {
  const cls = findClass(id);
  if (!cls) return;
  Object.assign(cls, changes);
  save();
}

/** Deleting a class deletes its history too. The page asks before calling this. */
export function deleteClass(id: string) {
  account.classes = account.classes.filter((cls) => cls.id !== id);
  account.passes = account.passes.filter((pass) => pass.classId !== id);
  if (account.activeClass?.id === id) {
    const next = account.classes[0];
    account.activeClass = next ? { id: next.id, changedAt: now() } : null;
  }
  save();
}

// ---------------------------------------------------------------------------
// Destinations
// ---------------------------------------------------------------------------

export function saveDestination(destination: Destination) {
  const index = account.destinations.findIndex((each) => each.id === destination.id);
  if (index === -1) account.destinations.push(destination);
  else account.destinations[index] = destination;
  save();
}

/** Past passes keep the name, so removing a destination never rewrites history. */
export function deleteDestination(id: string) {
  account.destinations = account.destinations.filter((each) => each.id !== id);
  save();
}

// ---------------------------------------------------------------------------
// Roster
// ---------------------------------------------------------------------------

export function applyImport(classId: string, plan: ImportPlan, removeIds: string[]) {
  const cls = findClass(classId);
  if (!cls || plan.error) return;
  for (const change of plan.matched) {
    const student = cls.students.find((each) => each.id === change.student.id);
    if (student) student.lastPrefix = change.lastPrefix;
  }
  for (const entry of plan.added) {
    cls.students.push({ id: newId(), firstName: entry.firstName, lastPrefix: entry.lastPrefix, status: 'current' });
  }
  for (const id of removeIds) removeStudentFrom(cls, id);
  save();
}

export function renameStudent(classId: string, studentId: string, firstName: string, lastPrefix: string) {
  const student = findClass(classId)?.students.find((each) => each.id === studentId);
  if (!student) return;
  student.firstName = firstName;
  student.lastPrefix = lastPrefix;
  save();
}

/**
 * A student with history becomes a Former Student, so the class's record stays
 * whole. One who is out right now has that pass ended with an unknown return.
 */
function removeStudentFrom(cls: Class, studentId: string) {
  const open = account.passes.filter((pass) => pass.studentId === studentId && !pass.inAt);
  mergeInto(account.passes, open.map((pass) => endUnseen(pass, 'removed')));
  const hasHistory = account.passes.some((pass) => pass.studentId === studentId);
  if (hasHistory) {
    const student = cls.students.find((each) => each.id === studentId);
    if (student) student.status = 'former';
  } else {
    cls.students = cls.students.filter((each) => each.id !== studentId);
  }
}

export function removeStudent(classId: string, studentId: string) {
  const cls = findClass(classId);
  if (!cls) return;
  removeStudentFrom(cls, studentId);
  save();
}

export function restoreStudent(classId: string, studentId: string) {
  const student = findClass(classId)?.students.find((each) => each.id === studentId);
  if (!student) return;
  student.status = 'current';
  save();
}

// ---------------------------------------------------------------------------
// Passes
// ---------------------------------------------------------------------------

/** Takes passes from the kiosk (or from this computer's own door screen). */
export function receivePasses(passes: Pass[]) {
  mergeInto(account.passes, passes);
  save();
}

export function markReturned(passId: string) {
  const pass = account.passes.find((each) => each.id === passId);
  if (!pass || pass.inAt) return;
  const at = now();
  Object.assign(pass, { inAt: at, endedBy: 'teacher', updatedAt: at });
  save();
}

/** A Correction changes the pass in place and marks it. See docs/adr/0006. */
export function correctPass(passId: string, changes: { student?: Student; outAt?: string; inAt?: string }) {
  const pass = account.passes.find((each) => each.id === passId);
  if (!pass) return;
  if (changes.student) {
    pass.studentId = changes.student.id;
    pass.studentName = displayName(changes.student);
  }
  if (changes.outAt) pass.outAt = changes.outAt;
  if (changes.inAt) {
    pass.inAt = changes.inAt;
    pass.endedBy ??= 'teacher';
  }
  pass.corrected = true;
  pass.updatedAt = now();
  save();
}

// ---------------------------------------------------------------------------
// The kiosk
// ---------------------------------------------------------------------------

/**
 * Moves the kiosk to another class. Every pass still open in the class being
 * left ends with an unknown return: those students are no longer in front of
 * the door screen that could sign them back in.
 */
export function setActiveClass(activeClass: ActiveClass) {
  const leaving = account.activeClass?.id;
  if (account.activeClass && account.activeClass.changedAt >= activeClass.changedAt) return;
  if (leaving && leaving !== activeClass.id) {
    mergeInto(account.passes, openPasses(leaving).map((pass) => endUnseen(pass, 'switch')));
  }
  account.activeClass = activeClass;
  save();
}

export function setPin(pin: string) {
  account.pin = pin;
  save();
}

export function useThisComputer() {
  retireDevice();
  account.kiosk = { kind: 'this-computer', locked: false };
  save();
}

export function setDoorLocked(locked: boolean) {
  if (account.kiosk?.kind !== 'this-computer') return;
  account.kiosk.locked = locked;
  save();
}

export function pairDevice(kioskId: string, secret: string) {
  retireDevice();
  account.kiosk = { kind: 'device', kioskId, secret, pairedAt: now() };
  account.networkBlocked = false;
  save();
}

/** A replaced device may still be holding passes; it is allowed to hand them over once. */
function retireDevice() {
  if (account.kiosk?.kind === 'device') {
    account.replacedKiosks.push({ kioskId: account.kiosk.kioskId, secret: account.kiosk.secret });
  }
}

export function forgetReplacedKiosk(kioskId: string) {
  account.replacedKiosks = account.replacedKiosks.filter((each) => each.kioskId !== kioskId);
  save();
}

export function removeKiosk() {
  retireDevice();
  account.kiosk = null;
  save();
}

export function markKioskSeen() {
  if (account.kiosk?.kind !== 'device') return;
  account.kiosk.lastSeenAt = now();
  localStorage.setItem(storageKey, JSON.stringify(account));
}

export function setNetworkBlocked(blocked: boolean) {
  account.networkBlocked = blocked;
  save();
}

/** What the kiosk needs to run the door on its own. */
export function doorSetup(): DoorSetup {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const since = today.toISOString();
  return $state.snapshot({
    classes: account.classes.map((cls) => ({
      id: cls.id,
      name: cls.name,
      limit: cls.limit,
      students: cls.students
        .filter((student) => student.status === 'current')
        .map((student) => ({ id: student.id, name: displayName(student) })),
    })),
    destinations: account.destinations,
    activeClass: account.activeClass,
    pin: account.pin,
    passes: account.passes.filter((pass) => !pass.inAt || pass.outAt >= since),
  });
}

// ---------------------------------------------------------------------------
// Export and import
// ---------------------------------------------------------------------------

export function exportAccount() {
  account.lastExportedAt = now();
  save();
  return JSON.stringify({ app: 'hallway', ...$state.snapshot(account) }, null, 2);
}

/**
 * Replaces everything in this browser with an exported file, including the
 * kiosk pairing, so the teacher is back exactly where they were.
 */
export function importAccount(text: string) {
  const parsed = JSON.parse(text);
  if (parsed?.app !== 'hallway' || parsed.version !== 1 || !Array.isArray(parsed.classes)) {
    throw new Error('That file is not a Hallway export.');
  }
  delete parsed.app;
  localStorage.setItem(storageKey, JSON.stringify(upgrade({ ...blankAccount(), destinations: undefined, ...parsed })));
}
