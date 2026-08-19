import type { Student } from './types';

/** The roster a brand-new classroom starts with, so the prototype is never empty. */
export const defaultStudents: Student[] = [
  { id: '1042', name: 'Maya Chen' },
  { id: '2381', name: 'Jordan Ellis' },
  { id: '3077', name: 'Sofia Ramirez' },
  { id: '4419', name: 'Noah Williams' },
  { id: '5620', name: 'Avery Brooks' },
];

/** How many students a new classroom lets into the hallway at once. */
export const defaultLimit = 2;
