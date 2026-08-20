/**
 * One child on one Class's roster. The same child taught in two Classes is two
 * unrelated Students, deliberately — see docs/adr/0002.
 */
export type Student = {
  /** The numeric id students used to type. Vestigial; removed in ticket 07. */
  id: string;
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
  studentId: string;
  studentName: string;
  kind: 'out' | 'in';
  destination: string;
  minutes: number;
  source: 'kiosk' | 'teacher';
  signedInBy: string;
  at: string;
};

/** A completed round trip, worked out by pairing each exit with its return. */
export type Pass = {
  id: string;
  studentId: string;
  studentName: string;
  destination: string;
  minutes: number;
  outAt: string;
  inAt?: string;
  signedInBy?: string;
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
  | { kind: 'kiosk-pin'; purpose: 'setup' | 'exit' | 'change' }
  | { kind: 'export' };
