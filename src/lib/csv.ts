import { dayKey, duration, hasRealDuration, isOverdue, time } from './passes';
import type { Pass } from './types';

/** Wraps a value so a comma, quote or newline inside it cannot break the row. */
function cell(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const headings = ['Date', 'Student', 'Destination', 'Left', 'Returned', 'Minutes out', 'Expected', 'Overdue', 'Extra', 'No-Pass Exception', 'Line Skip', 'Ended by', 'Corrected'];

const endings: Record<string, string> = {
  student: 'student',
  teacher: 'teacher',
  switch: 'class change',
  cancelled: 'cancelled at the door',
  removed: 'left the roster',
};

/**
 * A spreadsheet of a class's passes. Trips whose return nobody saw leave the
 * duration blank rather than reporting minutes nobody measured.
 */
export function passesToCsv(passes: Pass[]) {
  const rows = [...passes]
    .sort((a, b) => a.outAt.localeCompare(b.outAt))
    .map((pass) => [
      dayKey(pass.outAt),
      pass.studentName,
      pass.destination,
      time(pass.outAt),
      pass.inAt ? time(pass.inAt) : '',
      pass.inAt && hasRealDuration(pass) ? duration(pass) : '',
      pass.minutes || '',
      isOverdue(pass) ? 'yes' : '',
      pass.extra ? 'yes' : '',
      pass.noPassException ? 'yes' : '',
      pass.lineSkip ? 'yes' : '',
      pass.inAt ? endings[pass.endedBy ?? 'student'] : 'still out',
      pass.corrected ? 'yes' : '',
    ]);
  return [headings, ...rows].map((row) => row.map(cell).join(',')).join('\n');
}

/** Hands the browser a file to save. */
export function download(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
