import { defaultAllowance, passCounts, windowStart } from './allowance';
import { defaultDestinations, knownIcon } from './destinations';
import type { IconName } from './icons';
import { endUnseen, mergeInto, newId, now } from './passes';
import { displayName, type ImportPlan } from './roster';
import { blankSchedule, noPassAt, scheduledClassAt, withRulesOnPeriods } from './schedule';
import type {
  Account,
  ActiveClass,
  Class,
  Destination,
  DoorSetup,
  LineSpot,
  Pass,
  PassAllowance,
  PassRequest,
  Schedule,
  Student,
} from './types';
import { newsIds, seenBefore } from './popups';

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
    lineEnabled: false,
    line: [],
    passAllowance: defaultAllowance(),
    schedules: [],
    currentScheduleId: null,
    manualNoPass: null,
    requests: [],
    deniedRequests: [],
    // Nothing changed under a brand-new teacher, so there is no news to show them.
    seenPopups: Object.fromEntries(newsIds().map((id) => [id, now()])),
    pin: '',
    kiosk: null,
    activeClass: null,
    replacedKiosks: [],
    networkBlocked: false,
  };
}

/**
 * Accounts saved by older versions are shaped differently, and are brought up
 * to date here so nothing the teacher set is lost:
 * - Destinations used to be a list on each class; they became one shared list.
 * - The Pass Limit used to be one number for every destination (and before
 *   that, one per class); each destination now has its own. See docs/adr/0007.
 * - The teacher used to give Permissions from the laptop ahead of time;
 *   students now send Requests instead, so unused ones are dropped. See
 *   docs/adr/0009.
 * - "What's changed" used to remember only the newest news seen.
 * - No-pass times used to be clock times on each class; they moved to the
 *   teacher's first schedule. See docs/adr/0008.
 * - "First N minutes of every class" used to be rules across a schedule; each
 *   period now has its own. See EdgeRule.
 */
type SavedAccount = Omit<Account, 'destinations' | 'classes' | 'schedules' | 'seenPopups'> & {
  schedules?: Schedule[];
  destinations?: (Omit<Destination, 'limit'> & { limit?: number | null })[];
  passLimit?: number;
  permissions?: unknown[];
  extraPassGifts?: unknown[];
  seenUpdate?: string;
  seenPopups?: Record<string, string>;
  classes: (Class & {
    destinations?: { label: string; minutes: number }[];
    limit?: number;
    noPassTimes?: { start: string; end: string }[];
  })[];
};

function upgrade(saved: SavedAccount): Account {
  const oldLimit = saved.passLimit ?? saved.classes[0]?.limit ?? 1;
  if (!saved.destinations) {
    const old = saved.classes.find((cls) => cls.destinations?.length)?.destinations;
    const defaults = defaultDestinations(newId);
    saved.destinations = old
      ? old.map((each): Destination => ({
          ...(defaults.find((preset) => preset.label === each.label) ?? defaults[defaults.length - 1]),
          id: newId(),
          label: each.label,
          minutes: each.minutes || null,
          limit: oldLimit,
        }))
      : defaults;
  }
  for (const destination of saved.destinations) {
    destination.icon = knownIcon(destination.icon);
    if (destination.limit === undefined) destination.limit = oldLimit;
  }
  delete saved.passLimit;
  saved.passAllowance ??= defaultAllowance();
  delete saved.permissions;
  delete saved.extraPassGifts;
  saved.requests ??= [];
  saved.deniedRequests ??= [];
  saved.seenPopups ??= seenBefore(saved.seenUpdate, now());
  delete saved.seenUpdate;
  if (!saved.schedules) {
    const schedule = blankSchedule(newId(), 'My Schedule');
    const copied = new Set<string>();
    for (const time of saved.classes.flatMap((cls) => cls.noPassTimes ?? [])) {
      if (copied.has(time.start + time.end)) continue;
      copied.add(time.start + time.end);
      schedule.noPassTimes.push({ id: newId(), start: time.start, end: time.end });
    }
    saved.schedules = schedule.noPassTimes.length ? [schedule] : [];
  }
  saved.schedules = saved.schedules.map(withRulesOnPeriods);
  if (!saved.schedules.some((schedule) => schedule.id === saved.currentScheduleId)) {
    saved.currentScheduleId = saved.schedules[0]?.id ?? null;
  }
  saved.manualNoPass ??= null;
  for (const cls of saved.classes) {
    delete cls.destinations;
    delete cls.limit;
    delete cls.noPassTimes;
  }
  return saved as Account;
}

/** Fields a saved account must not borrow from a blank one, so upgrade() can tell an older account by their absence. */
const fromOlderVersions = {
  destinations: undefined,
  seenPopups: undefined,
  schedules: undefined,
  currentScheduleId: undefined,
};

function load(): Account {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) return upgrade({ ...blankAccount(), ...fromOlderVersions, ...JSON.parse(saved) });
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

/**
 * Teachers often have Happy Hallways open in more than one tab. Each save
 * writes the whole Account, so a tab working from an old copy would undo the
 * others' changes, and only one tab can hold the laptop's address for the
 * kiosk. So when another tab saves, this one takes its copy straight away.
 */
let afterReload = () => {};
export function onReload(listener: () => void) {
  afterReload = listener;
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== storageKey || event.newValue === null) return;
    const fresh = load();
    for (const key of Object.keys(account)) if (!(key in fresh)) delete account[key as keyof Account];
    Object.assign(account, fresh);
    afterReload();
  });
}

export function findClass(id: string | null | undefined) {
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

export function createClass(name: string) {
  const cls: Class = {
    id: newId(),
    name,
    students: [],
    createdAt: now(),
  };
  account.classes.push(cls);
  if (!account.activeClass) account.activeClass = { id: cls.id, changedAt: now() };
  save();
  return cls.id;
}

export function updateClass(id: string, changes: Partial<Pick<Class, 'name'>>) {
  const cls = findClass(id);
  if (!cls) return;
  Object.assign(cls, changes);
  save();
}

/**
 * Deleting a class deletes its history too. The page asks before calling
 * this. Its periods stay, with no class in them.
 */
export function deleteClass(id: string) {
  account.classes = account.classes.filter((cls) => cls.id !== id);
  account.passes = account.passes.filter((pass) => pass.classId !== id);
  for (const schedule of account.schedules) {
    for (const period of schedule.periods) {
      if (period.classId !== id) continue;
      period.classId = null;
      delete period.noPass;
    }
  }
  if (account.activeClass?.onSchedule) {
    account.activeClass = { id: scheduledClassAt(currentSchedule()), changedAt: now(), onSchedule: true };
  } else if (account.activeClass?.id === id) {
    const next = account.classes[0];
    account.activeClass = next ? { id: next.id, changedAt: now() } : null;
  }
  save();
}

// ---------------------------------------------------------------------------
// Schedules
// ---------------------------------------------------------------------------

/** The schedule the teacher last picked, if they have any. */
export function currentSchedule(): Schedule | undefined {
  return account.schedules.find((schedule) => schedule.id === account.currentScheduleId) ?? account.schedules[0];
}

/** The schedule the kiosk is following right now, if any. */
export function liveSchedule() {
  return account.activeClass?.onSchedule ? currentSchedule() : undefined;
}

export function findSchedule(id: string) {
  return account.schedules.find((schedule) => schedule.id === id);
}

/** A brand-new, empty schedule. Returns its id. */
export function addSchedule(name: string) {
  const schedule = blankSchedule(newId(), name);
  account.schedules.push(schedule);
  save();
  return schedule.id;
}

/** A copy of a schedule with all its periods and No-Pass Times, quickest way to make B Day from A Day. */
export function duplicateSchedule(id: string) {
  const original = findSchedule(id);
  if (!original) return id;
  const copy: Schedule = {
    ...$state.snapshot(original),
    id: newId(),
    name: `${original.name} (copy)`,
  };
  for (const each of [...copy.periods, ...copy.noPassTimes]) each.id = newId();
  account.schedules.push(copy);
  save();
  return copy.id;
}

/** Replaces a schedule with an edited copy. On Schedule, the kiosk follows the change. */
export function saveSchedule(schedule: Schedule) {
  const index = account.schedules.findIndex((each) => each.id === schedule.id);
  if (index === -1) return;
  account.schedules[index] = schedule;
  if (schedule.id === account.currentScheduleId) followSchedule();
  save();
}

/** Deleting the schedule the kiosk follows takes the kiosk off schedule, on the class it has now. */
export function deleteSchedule(id: string) {
  if (liveSchedule()?.id === id) stopFollowingSchedule();
  account.schedules = account.schedules.filter((schedule) => schedule.id !== id);
  if (account.currentScheduleId === id) account.currentScheduleId = account.schedules[0]?.id ?? null;
  save();
}

/** Off schedule: the kiosk keeps the class it has, and the teacher changes it by hand. */
export function stopFollowingSchedule() {
  const active = account.activeClass;
  if (!active?.onSchedule) return;
  setActiveClass({ id: active.id, changedAt: now() });
}

/** The class a schedule would put on the kiosk right now. */
export function classScheduledNow(scheduleId = account.currentScheduleId) {
  return scheduledClassAt(scheduleId ? findSchedule(scheduleId) : undefined);
}

/**
 * Picks a schedule and puts the kiosk On Schedule, at whatever period the
 * clock is in now, not wherever the teacher left off.
 */
export function useSchedule(id: string) {
  if (!findSchedule(id)) return;
  account.currentScheduleId = id;
  setActiveClass({ id: classScheduledNow(id), changedAt: now(), onSchedule: true });
}

/**
 * On Schedule, moves the kiosk to whatever class the clock says, ending
 * passes still open in the class it leaves. The device acting as the kiosk
 * calls this as the clock ticks. Returns whether anything changed; the caller saves.
 */
function followSchedule() {
  const active = account.activeClass;
  if (!active?.onSchedule) return false;
  const id = scheduledClassAt(currentSchedule());
  if (id === active.id) return false;
  moveActiveClass({ id, changedAt: now(), onSchedule: true });
  return true;
}

/** Called regularly on the laptop when no paired device is in charge of the door. */
export function keepToSchedule() {
  if (followSchedule()) save();
}

/** Starts a No-Pass Time by hand for the class on the kiosk. It lasts until ended, or the class changes. */
export function startNoPassTime() {
  const classId = account.activeClass?.id;
  if (!classId) return;
  account.manualNoPass = { classId, startedAt: now() };
  save();
}

export function endNoPassTime() {
  account.manualNoPass = null;
  save();
}

/** The class on the kiosk, as the teacher should read it. */
export function activeClassLabel() {
  const active = account.activeClass;
  if (active?.onSchedule && !active.id) return 'No class right now';
  return findClass(active?.id)?.name ?? 'No class chosen';
}

/**
 * Whether students may leave right now, in a word: passes are open, it's a
 * No-Pass Time, it's between periods, or no class is on the kiosk.
 */
export type PassStatus = 'open' | 'no-pass' | 'between' | 'no-class';

export function passStatus(at = Date.now()): PassStatus {
  const active = account.activeClass;
  if (!active?.id) return active?.onSchedule ? 'between' : 'no-class';
  return noPassNow(active.id, at) ? 'no-pass' : 'open';
}

export const passStatusText: Record<PassStatus, string> = {
  open: 'Passes open',
  'no-pass': 'No passes',
  between: 'Between classes',
  'no-class': 'No class',
};

/** Each status's icon, for the badge on Home and the corner of the sidebar box. */
export const passStatusIcon: Record<PassStatus, IconName> = {
  open: 'door',
  'no-pass': 'ban',
  between: 'pause',
  'no-class': 'circle-slash',
};

/** Whose passes picking a schedule would end, when it moves the kiosk to another class. */
export function useWarning(scheduleId: string) {
  const leaving = findClass(account.activeClass?.id);
  if (!leaving || classScheduledNow(scheduleId) === leaving.id) return null;
  const out = openPasses(leaving.id).length;
  if (!out) return null;
  return `The kiosk will move from ${leaving.name} now. ${out} ${out === 1 ? 'student is' : 'students are'} still out there; their passes will end with an unknown return time.`;
}

/** What decides No-Pass Time, as the laptop knows it. */
function noPassSources() {
  return { schedule: currentSchedule(), activeClass: account.activeClass, manualNoPass: account.manualNoPass };
}

/** The No-Pass Time a class is in right now, if it's on the kiosk and in one. */
export function noPassNow(classId: string, at = Date.now()) {
  return account.activeClass?.id === classId ? noPassAt(noPassSources(), classId, at) : null;
}

/**
 * What the teacher should know before moving the kiosk by hand: that it takes
 * them off schedule, and whose passes it ends. Null when there's nothing to say.
 */
export function moveWarning(toClassId: string) {
  const warnings: string[] = [];
  if (account.activeClass?.onSchedule) {
    warnings.push(
      "This takes the kiosk off your schedule. It won't switch classes or keep your scheduled no-pass times until you turn the schedule back on.",
    );
  }
  const leaving = findClass(account.activeClass?.id);
  const out = leaving && leaving.id !== toClassId ? openPasses(leaving.id).length : 0;
  if (leaving && out) {
    warnings.push(
      `${out} ${out === 1 ? 'student is' : 'students are'} still out in ${leaving.name}. Their passes will end with an unknown return time.`,
    );
  }
  return warnings.length ? warnings.join(' ') : null;
}

// ---------------------------------------------------------------------------
// Pass Options and the Line
// ---------------------------------------------------------------------------

export function setPassOptions(options: { lineEnabled?: boolean }) {
  Object.assign(account, options);
  if (account.lineEnabled === false) account.line = [];
  save();
}

/**
 * Changing the number never resets anyone's count. Switching to "until I reset
 * it" starts counting from now, as pressing Reset does.
 */
export function setPassAllowance(changes: Partial<Omit<PassAllowance, 'since'>>) {
  const startsCounting = changes.per === 'reset' && account.passAllowance.per !== 'reset';
  Object.assign(account.passAllowance, changes);
  if (startsCounting) account.passAllowance.since = now();
  save();
}

/** Starts a fresh count for every student in every class, say at the start of a quarter. */
export function resetPassAllowance() {
  account.passAllowance.since = now();
  save();
}

/** The kiosk reports its Line here; the laptop only shows it. */
export function setLine(line: LineSpot[]) {
  account.line = line;
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

export function setExempt(classId: string, studentId: string, exempt: boolean) {
  const student = findClass(classId)?.students.find((each) => each.id === studentId);
  if (!student) return;
  student.exempt = exempt || undefined;
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

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

/** The kiosk reports its waiting Requests here; the laptop shows and answers them. */
export function setRequests(requests: PassRequest[]) {
  account.requests = requests;
  save();
}

/** The waiting Requests from the class on the kiosk, oldest first. */
export function waitingRequests() {
  return account.requests
    .filter((request) => request.classId === account.activeClass?.id)
    .sort((a, b) => a.askedAt.localeCompare(b.askedAt));
}

/**
 * The teacher answered. The kiosk does what was decided; the laptop drops the
 * Request straight away rather than waiting to hear back, and keeps a "no".
 */
export function answered(request: PassRequest, approve: boolean) {
  account.requests = account.requests.filter((each) => each.id !== request.id);
  if (!approve) account.deniedRequests.push({ ...$state.snapshot(request), deniedAt: now() });
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
 * Moves the kiosk to another class (or, between periods, to none). Every pass
 * still open in the class being left ends with an unknown return: those
 * students are no longer in front of the door screen that could sign them
 * back in. Moving it by hand takes the teacher off schedule; pass
 * `onSchedule` when the schedule moved it.
 */
export function setActiveClass(activeClass: ActiveClass) {
  if (account.activeClass && account.activeClass.changedAt >= activeClass.changedAt) return;
  moveActiveClass(activeClass);
  save();
}

function moveActiveClass(activeClass: ActiveClass) {
  const leaving = account.activeClass?.id;
  if (leaving && leaving !== activeClass.id) {
    mergeInto(account.passes, openPasses(leaving).map((pass) => endUnseen(pass, 'switch')));
  }
  account.activeClass = activeClass;
  if (leaving !== activeClass.id) {
    // The Line and Requests belong to the class at the door; a new class starts with none.
    account.line = [];
    account.requests = [];
    account.manualNoPass = null;
  }
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
      students: cls.students
        .filter((student) => student.status === 'current')
        .map((student) => ({ id: student.id, name: displayName(student), exempt: student.exempt })),
    })),
    destinations: account.destinations,
    lineEnabled: account.lineEnabled,
    passAllowance: account.passAllowance,
    countedPasses: account.passAllowance.enabled ? countedPasses() : [],
    activeClass: account.activeClass,
    schedule: currentSchedule(),
    manualNoPass: account.manualNoPass,
    pin: account.pin,
    ...forOlderKiosks(),
    passes: account.passes.filter((pass) => !pass.inAt || pass.outAt >= since),
  });
}

/**
 * A kiosk still on the version before per-destination limits enforces one
 * limit on everyone out at once. The largest destination limit keeps it working
 * as it did before the update, until the teacher changes a destination or the
 * kiosk refreshes.
 */
function forOlderKiosks() {
  const limits = account.destinations.flatMap((destination) => (destination.limit === null ? [] : [destination.limit]));
  return { passLimit: limits.length ? Math.max(...limits) : 99 };
}

function countedPasses() {
  const since = windowStart(account.passAllowance).toISOString();
  return account.passes
    .filter((pass) => pass.outAt >= since && passCounts(pass))
    .map(({ id, classId, studentId, outAt }) => ({ id, classId, studentId, outAt }));
}

/** The teacher closed a Popup, so it won't show again. */
export function markPopupsSeen(ids: string[]) {
  for (const id of ids) account.seenPopups[id] ??= now();
  save();
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
    throw new Error('That file is not a Happy Hallways backup.');
  }
  delete parsed.app;
  localStorage.setItem(storageKey, JSON.stringify(upgrade({ ...blankAccount(), ...fromOlderVersions, ...parsed })));
}
