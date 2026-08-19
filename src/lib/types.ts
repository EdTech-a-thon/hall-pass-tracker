export type Student = { id: string; name: string };

/**
 * One line in the append-only hall pass log: a student left, or a student came
 * back. Nothing ever edits an entry, so the log is safe for a kiosk to add to.
 */
export type PassEvent = {
  id: string;
  studentId: string;
  studentName: string;
  kind: 'out' | 'in';
  reason: string;
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
  reason: string;
  minutes: number;
  outAt: string;
  inAt?: string;
  signedInBy?: string;
};

export type AppState = { limit: number; students: Student[]; passes: Pass[] };

export type View = 'kiosk' | 'teacher-login' | 'teacher-register' | 'teacher';

export type TeacherTab = 'live' | 'analytics' | 'security';

/** A full-screen message shown on the kiosk after a student action. */
export type Notice = {
  kind: 'approved' | 'denied' | 'returned';
  title: string;
  message: string;
  /** Second line, only used by the approval notice. */
  detail?: string;
};

/** A kiosk link as the teacher sees it listed. The token is never stored. */
export type KioskLink = { id: string; label: string; active: boolean; at: string };

/** Whatever dialog is open on top of the current view, if any. */
export type Modal =
  | { kind: 'request'; student: Student }
  | { kind: 'kiosk-link'; url: string; label: string }
  | { kind: 'export' };
