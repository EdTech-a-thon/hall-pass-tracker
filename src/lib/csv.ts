import { dayKey, duration, hasRealDuration, isOverdue, time } from './passes';
import type { Pass } from './types';

/** Wraps a value so a comma, quote or newline inside it cannot break the row. */
function cell(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const headings = ['Date', 'Student', 'Destination', 'Left', 'Returned', 'Minutes out', 'Expected', 'Overdue', 'Ended by', 'Corrected'];

function endedBy(pass: Pass) {
  if (!pass.inAt) return 'still out';
  if (pass.endedBy === 'switch') return 'class change';
  if (pass.endedBy === 'cancelled') return 'cancelled at the door';
  if (pass.endedBy === 'teacher') return `teacher (${pass.signedInBy || 'the teacher'})`;
  return 'student';
}

/**
 * A spreadsheet of the corrected view, so the file a teacher hands to an
 * administrator agrees with what their dashboard shows. Trips whose return was
 * never observed say so rather than reporting a duration nobody measured.
 */
export function passesToCsv(passes: Pass[]) {
  const rows = passes.map((pass) => [
    dayKey(pass.outAt),
    pass.studentName,
    pass.destination,
    time(pass.outAt),
    pass.inAt ? time(pass.inAt) : '',
    pass.inAt && hasRealDuration(pass) ? duration(pass) : '',
    pass.minutes || '',
    isOverdue(pass) ? 'yes' : '',
    endedBy(pass),
    pass.corrected ? 'yes' : '',
  ]);
  return [headings, ...rows].map((row) => row.map(cell).join(',')).join('\n');
}
