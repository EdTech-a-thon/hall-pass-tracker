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
};

/** A stretch of the clock when a class may not start passes, as "HH:MM" (24-hour) times. */
export type NoPassTime = { start: string; end: string };

/** A group of students a teacher sees together during one period. */
export type Class = {
  id: string;
  name: string;
  students: Student[];
  noPassTimes: NoPassTime[];
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
  outAt: string;
  inAt?: string;
  endedBy?: EndedBy;
  /** Set once a teacher has corrected this pass on the laptop. */
  corrected?: boolean;
  /** When this copy last changed, so the kiosk and the laptop can tell which copy is newer. */
  updatedAt: string;
};

/** One student waiting in the Line at the kiosk, with where they want to go. */
export type LineSpot = {
  studentId: string;
  studentName: string;
  classId: string;
  destination: string;
  joinedAt: string;
};

/** Which class the kiosk is showing, and when someone last deliberately changed it. */
export type ActiveClass = { id: string; changedAt: string };

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
  /** The Pass Limit: how many students may be out at once, in every class. */
  passLimit: number;
  /** Whether students may join a Line once the Pass Limit is reached. */
  lineEnabled: boolean;
  /** The Line as the kiosk last reported it. The kiosk is in charge of it. */
  line: LineSpot[];
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
  students: { id: string; name: string }[];
  noPassTimes: NoPassTime[];
};

/** Everything the laptop hands the kiosk so it can run the door on its own. */
export type DoorSetup = {
  classes: DoorClass[];
  destinations: Destination[];
  passLimit: number;
  lineEnabled: boolean;
  activeClass: ActiveClass | null;
  pin: string;
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
