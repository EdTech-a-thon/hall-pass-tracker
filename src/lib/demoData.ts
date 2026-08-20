import type { Student } from './types';

/** The roster a brand-new Class starts with, so the prototype is never empty. */
export const defaultStudents = [
  { id: '1042', firstName: 'Maya', lastPrefix: 'C' },
  { id: '2381', firstName: 'Jordan', lastPrefix: 'E' },
  { id: '3077', firstName: 'Sofia', lastPrefix: 'R' },
  { id: '4419', firstName: 'Noah', lastPrefix: 'W' },
  { id: '5620', firstName: 'Avery', lastPrefix: 'B' },
] satisfies Pick<Student, 'id' | 'firstName' | 'lastPrefix'>[];

/** How many students a new Class lets into the hallway at once. */
export const defaultLimit = 2;
