/**
 * One child on one Class's roster. The same child taught in two Classes is two
 * unrelated Students, deliberately — see docs/adr/0002.
 */
export type Student = {
  recordId: string;
  firstName: string;
  /** As many leading letters of the last name as it takes to be unique. Never the whole name. */
  lastPrefix: string;
  status: 'current' | 'former';
  /** "Maya C." — composed, never stored. */
  name: string;
};

/**
 * One line in the append-only hall pass log: a student left, or a student came
 * back. Nothing ever edits an entry, so the log is safe for a kiosk to add to.
 */
export type PassEvent = {
  id: string;
  /** The roster row this entry belongs to. */
  student: string;
  studentName: string;
  kind: 'out' | 'in' | 'fix';
  destination: string;
  minutes: number;
  source: 'kiosk' | 'teacher' | 'switch' | 'cancelled';
  signedInBy: string;
  at: string;
  /** On a Correction, the entry it amends. */
  corrects?: string;
  /** On a Correction, the Student the trip really belonged to. */
  newStudent?: string;
  /** On a Correction, a replacement time for the entry it amends. */
  newAt?: string;
};

/** A completed round trip, worked out by pairing each exit with its return. */
export type Pass = {
  id: string;
  student: string;
  studentName: string;
  destination: string;
  minutes: number;
  outAt: string;
  inAt?: string;
  /** The log entry that closed this trip, so a return time can be corrected too. */
  inId?: string;
  signedInBy?: string;
  /**
   * How the trip ended. "switch" and "cancelled" mean the end was invented
   * rather than observed, so the duration is not a real one.
   */
  endedBy?: 'student' | 'teacher' | 'switch' | 'cancelled';
  /** True when a Correction has been laid over this trip. */
  corrected: boolean;
};

/**
 * A place a student may go. The teacher owns the list for their whole account,
 * and the expected minutes are frozen onto a Pass when the student leaves.
 */
export type Destination = { label: string; minutes: number };

/** A group of students a teacher sees together during one period. */
export type Class = { id: string; name: string; position: number; archived: boolean };

export type ActiveClass = { limit: number; students: Student[]; passes: Pass[] };

export type View = 'kiosk' | 'teacher-login' | 'teacher-register' | 'teacher';

export type TeacherTab = 'live' | 'classes' | 'analytics' | 'security';

/** A full-screen message shown on the kiosk after a student action. */
export type Notice = {
  kind: 'approved' | 'denied' | 'returned';
  title: string;
  message: string;
  /** Second line, only used by the approval notice. */
  detail?: string;
  /** Offers a few seconds to undo a pass given to the wrong student. */
  undo?: boolean;
};

/** Whatever dialog is open on top of the current view, if any. */
export type Modal =
  | { kind: 'request'; student: Student }
  | { kind: 'kiosk-pin'; purpose: 'setup' | 'exit' | 'change' | 'switch' }
  | { kind: 'class-switch' }
  | { kind: 'correct'; pass: Pass }
  | { kind: 'export' };
