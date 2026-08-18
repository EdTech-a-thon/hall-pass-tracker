import type { AppState, Student } from './types';

export const defaultStudents: Student[] = [
  { id: '1042', name: 'Maya Chen' },
  { id: '2381', name: 'Jordan Ellis' },
  { id: '3077', name: 'Sofia Ramirez' },
  { id: '4419', name: 'Noah Williams' },
  { id: '5620', name: 'Avery Brooks' },
];

const now = Date.now();

/** The classroom a brand-new workspace starts with, so the prototype is never empty. */
export const defaultState: AppState = {
  limit: 2,
  students: defaultStudents,
  passes: [
    { id: 'p1', studentId: '2381', studentName: 'Jordan Ellis', reason: 'Restroom', minutes: 8, outAt: new Date(now - 18 * 60_000).toISOString(), inAt: new Date(now - 10 * 60_000).toISOString() },
    { id: 'p2', studentId: '3077', studentName: 'Sofia Ramirez', reason: 'Counselor', minutes: 15, outAt: new Date(now - 70 * 60_000).toISOString(), inAt: new Date(now - 52 * 60_000).toISOString(), signedInBy: 'Maya Chen' },
    { id: 'p3', studentId: '1042', studentName: 'Maya Chen', reason: 'Water', minutes: 5, outAt: new Date(now - 25 * 60_000).toISOString(), inAt: new Date(now - 21 * 60_000).toISOString() },
    { id: 'p4', studentId: '4419', studentName: 'Noah Williams', reason: 'Main office', minutes: 10, outAt: new Date(now - 6 * 60_000).toISOString() },
  ],
};
