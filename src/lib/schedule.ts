import type { NoPassTime } from './types';

/** Local clock time as "HH:MM", the same shape as a time input's value. */
function clockOf(at: number) {
  const date = new Date(at);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** The No-Pass Time in effect at `at`, if any. Its end is when passes open again. */
export function noPassTimeAt(times: NoPassTime[], at = Date.now()): NoPassTime | null {
  const clock = clockOf(at);
  return times.find((time) => time.start <= clock && clock < time.end) ?? null;
}

/** "9:15 AM" from "09:15". */
export function formatClock(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return new Intl.DateTimeFormat([], { hour: 'numeric', minute: '2-digit' }).format(date);
}
