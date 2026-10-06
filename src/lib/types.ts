import type { DestinationColor, DestinationIcon } from './destinations';

/**
 * One child on one Class's roster. The same child taught in two Classes is two
 * unrelated Students, deliberately — see docs/adr/0002.
 */
export type Student = {
  id: string;
  firstName: string;
  /** As many leading letters of the last name as it takes to be unique. Never the whole name. */
  lastPrefix: string;
  /** A Former Student has left the class but keeps every trip they took. */
  status: 'current' | 'former';
  /** An Exempt Student: the Pass Allowance never applies to them. */
  exempt?: boolean;
};

/**
 * A place a student may go. One list serves all the teacher's classes. A trip
 * with no expected minutes is never Overdue.
 */
export type Destination = {
  id: string;
  label: string;
  /** Minutes the trip should take, or null for no time limit. */
  minutes: number | null;
  color: DestinationColor;
  icon: DestinationIcon;
  /** Whether a trip here uses up the Pass Allowance. Missing means it does. */
  countsTowardAllowance?: boolean;
  /** The Pass Limit: the most students here at once, or null for no limit (and so no Line). */
  limit: number | null;
};

/**
 * The Pass Allowance: how many passes each student may take in a stretch of
 * time, counted separately in each class.
 */
export type PassAllowance = {
  enabled: boolean;
  passes: number;
  /** "reset" counts from `since`, the last time the teacher pressed Reset. */
  per: 'day' | 'week' | 'reset';
  /** What the kiosk does once a student has used them all. */
  whenUsedUp: 'stop' | 'warn';
  since: string;
};

/**
 * The teacher's go-ahead from the laptop, for one student's next pass at the
 * kiosk. Each kind lifts one rule and is recorded on its own: an Extra Pass
 * lifts the Pass Allowance, a No-Pass Exception the No-Pass Time, and a Line
 * Skip a destination's Pass Limit and Line.
 */
export type Permission = {
  id: string;
  kind: 'extra-pass' | 'no-pass-exception' | 'line-skip';
  classId: string;
  studentId: string;
  givenAt: string;
  /** Unused, it stops working at this time: the end of the day, or of the No-Pass Time it was for. */
  expiresAt: string;
};

export type PermissionKind = Permission['kind'];

/** A stretch of the clock, as "HH:MM" (24-hour) times, from `start` up to (not including) `end`. */
export type ClockRange = { start: string; end: string };

/** One stretch of the clock in a Schedule, belonging to one class, or to none (lunch, planning). */
export type Period = ClockRange & { id: string; classId: string | null };

/** "First 10 minutes of every class": a No-Pass Time at the start or end of a schedule's periods. */
export type EdgeRule = {
  id: string;
  edge: 'first' | 'last';
  minutes: number;
  /** The one class it applies to, or null for every class. */
  classId: string | null;
};

/**
 * A plan for one kind of school day ("A Day", "Early Release"): its Periods
 * and its No-Pass Times. See docs/adr/0008.
 */
export type Schedule = {
  id: string;
  name: string;
  periods: Period[];
  rules: EdgeRule[];
  /** Fixed No-Pass Times drawn on this schedule. They apply to whichever class is on the kiosk. */
  noPassTimes: (ClockRange & { id: string })[];
};

/** A No-Pass Time the teacher started by hand. It lasts until they end it or the class on the kiosk changes. */
export type ManualNoPass = { classId: string; startedAt: string };

/** A group of students a teacher sees together during one period. */
export type Class = {
  id: string;
  name: string;
  students: Student[];
  createdAt: string;
};

/** How a pass ended. Everything except "student" and "teacher" means nobody saw the return. */
export type EndedBy = 'student' | 'teacher' | 'switch' | 'cancelled' | 'removed';

/** One round trip: a student left for a destination and has, or has not yet, come back. */
export type Pass = {
  id: string;
  classId: string;
  studentId: string;
  /** "Maya C.", frozen when the student left so history reads the same after a rename. */
  studentName: string;
  destination: string;
  /** The destination's expected minutes, frozen when the student left. 0 means no time limit. */
  minutes: number;
  /** False when the destination didn't use up the Pass Allowance, frozen when the student left. */
  counts?: boolean;
  /** An Extra Pass: taken after the student had used up their Pass Allowance. */
  extra?: boolean;
  /** Taken during No-Pass Time, with the teacher's permission. */
  noPassException?: boolean;
  /** Taken while the destination was full, ahead of its Line, with the teacher's permission. */
  lineSkip?: boolean;
  /** The laptop's Permissions this pass used up, if any. */
  permissionIds?: string[];
  /** The one Extra Pass an older kiosk recorded using, from before there were Permissions. */
  giftId?: string;
  outAt: string;
  inAt?: string;
  endedBy?: EndedBy;
  /** Set once a teacher has corrected this pass on the laptop. */
  corrected?: boolean;
  /** When this copy last changed, so the kiosk and the laptop can tell which copy is newer. */
  updatedAt: string;
};

/** One student waiting in a destination's Line at the kiosk. Each destination's line is the spots that name it. */
export type LineSpot = {
  studentId: string;
  studentName: string;
  classId: string;
  destination: string;
  joinedAt: string;
};

/**
 * Which class the kiosk is showing, and when it last changed. On Schedule it
 * changes by itself as each period starts, and between periods there is none.
 */
export type ActiveClass = { id: string | null; changedAt: string; onSchedule?: boolean };

/** The teacher's one kiosk: either a paired device, or this computer itself. */
export type Kiosk =
  | { kind: 'this-computer'; locked: boolean }
  | { kind: 'device'; kioskId: string; secret: string; pairedAt: string; lastSeenAt?: string };

/** Everything the teacher's laptop holds. A Backup is exactly this, written to a file. */
export type Account = {
  version: 1;
  /** The fixed address a paired kiosk uses to find this laptop again. */
  laptopPeerId: string;
  classes: Class[];
  destinations: Destination[];
  passes: Pass[];
  /** Whether students may join a destination's Line once its Pass Limit is reached. */
  lineEnabled: boolean;
  /** Every destination's Line as the kiosk last reported it. The kiosk is in charge of them. */
  line: LineSpot[];
  passAllowance: PassAllowance;
  /** Always at least one. */
  schedules: Schedule[];
  /** The schedule the teacher last picked. It stays picked until they pick another. */
  currentScheduleId: string;
  manualNoPass: ManualNoPass | null;
  /** Permissions given from the laptop and not used yet. */
  permissions: Permission[];
  /** The newest "What's changed" entry this teacher has seen. Missing on accounts from before there was one. */
  seenUpdate?: string;
  /** The teacher's PIN, needed at the kiosk to change class or unpair. */
  pin: string;
  kiosk: Kiosk | null;
  activeClass: ActiveClass | null;
  /** Kiosks that were replaced while offline. Their last passes are still welcome. */
  replacedKiosks: { kioskId: string; secret: string }[];
  /** Set when a pairing attempt showed that this network blocks device-to-device connections. */
  networkBlocked: boolean;
  lastExportedAt?: string;
};

/** A class as the kiosk sees it: current students only, names already composed. */
export type DoorClass = {
  id: string;
  name: string;
  students: { id: string; name: string; exempt?: boolean }[];
};

/** Just enough of a past pass for the kiosk to count it against the Pass Allowance. */
export type CountedPass = { id: string; classId: string; studentId: string; outAt: string };

/** Everything the laptop hands the kiosk so it can run the door on its own. */
export type DoorSetup = {
  classes: DoorClass[];
  destinations: Destination[];
  lineEnabled: boolean;
  passAllowance: PassAllowance;
  /** Every pass that uses up the Pass Allowance in its current window, so the kiosk can count without the laptop. */
  countedPasses: CountedPass[];
  permissions: Permission[];
  activeClass: ActiveClass | null;
  /** The Current Schedule. Missing from a laptop on the version before schedules. */
  schedule?: Schedule;
  manualNoPass?: ManualNoPass | null;
  pin: string;
  /**
   * What a kiosk still running the version before per-destination limits
   * reads, until it refreshes: one Pass Limit for every destination, and the
   * Extra Passes. A laptop on that version sends these instead of `limit` and
   * `permissions`.
   */
  passLimit?: number;
  extraPassGifts?: { id: string; classId: string; studentId: string; givenAt: string }[];
  /** Passes still open, plus today's, so both sides agree on who is out. */
  passes: Pass[];
};

/** Messages that travel between the kiosk and the laptop. */
export type KioskMessage =
  | { type: 'passes'; passes: Pass[] }
  | { type: 'active-class'; activeClass: ActiveClass }
  | { type: 'line'; line: LineSpot[] }
  | { type: 'ping' };

export type LaptopMessage =
  | { type: 'paired'; laptopPeerId: string; kioskId: string; secret: string; setup: DoorSetup }
  | { type: 'setup'; setup: DoorSetup }
  | { type: 'ack'; passes: { id: string; updatedAt: string }[] }
  | { type: 'replaced' }
  | { type: 'ping' };
