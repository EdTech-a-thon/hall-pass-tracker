export type Student = { id: string; name: string };

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

export type View = 'kiosk-login' | 'kiosk' | 'teacher-login' | 'teacher-register' | 'teacher';

export type TeacherTab = 'live' | 'analytics' | 'security';

/** A full-screen message shown on the kiosk after a student action. */
export type Notice = {
  kind: 'approved' | 'denied' | 'returned';
  title: string;
  message: string;
  /** Second line, only used by the approval notice. */
  detail?: string;
};

/** Whatever dialog is open on top of the current view, if any. */
export type Modal =
  | { kind: 'request'; student: Student }
  | { kind: 'pairing'; code: string }
  | { kind: 'export' }
  | { kind: 'recovery' };
