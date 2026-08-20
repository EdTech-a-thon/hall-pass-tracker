import type { Student } from './types';

/** The roster a brand-new Class starts with, so the prototype is never empty. */
export const defaultStudents = [
  { firstName: 'Maya', lastPrefix: 'C' },
  { firstName: 'Jordan', lastPrefix: 'E' },
  { firstName: 'Sofia', lastPrefix: 'R' },
  { firstName: 'Noah', lastPrefix: 'W' },
  { firstName: 'Avery', lastPrefix: 'B' },
] satisfies Pick<Student, 'firstName' | 'lastPrefix'>[];

/** How many students a new Class lets into the hallway at once. */
export const defaultLimit = 2;
