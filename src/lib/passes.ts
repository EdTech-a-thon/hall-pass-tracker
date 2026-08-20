import type { ActiveClass, Pass, PassEvent } from './types';

export function activePasses(state: ActiveClass) {
  return state.passes.filter((pass) => !pass.inAt);
}

/**
 * Turns the append-only log into round trips. Each "out" opens a pass and the
 * next "in" from the same student closes it, so a student whose latest entry is
 * an exit is still in the hallway.
 */
export function foldEvents(events: PassEvent[]): Pass[] {
  const passes: Pass[] = [];
  const open = new Map<string, Pass>();
  for (const event of [...events].sort((first, second) => first.at.localeCompare(second.at))) {
    if (event.kind === 'out') {
      const pass: Pass = {
        id: event.id,
        studentId: event.studentId,
        studentName: event.studentName,
        destination: event.destination,
        minutes: event.minutes,
        outAt: event.at,
      };
      passes.push(pass);
      open.set(event.studentId, pass);
      continue;
    }
    const pass = open.get(event.studentId);
    if (!pass) continue;
    pass.inAt = event.at;
    if (event.source === 'teacher') pass.signedInBy = event.signedInBy || 'the teacher';
    open.delete(event.studentId);
  }
  return passes;
}

/**
 * PocketBase writes timestamps as "2026-08-19 10:03:12.123Z". Some browsers
 * refuse that space, so every reading of a stored time goes through here.
 */
function toDate(value: string) {
  return new Date(value.replace(' ', 'T'));
}

/** Formats a stored timestamp as a short local clock time, e.g. "2:05 PM". */
export function time(value: string) {
  return new Intl.DateTimeFormat([], { hour: 'numeric', minute: '2-digit' }).format(toDate(value));
}

/** How many minutes a pass has lasted so far, or lasted in total once returned. */
export function duration(pass: Pass) {
  const end = pass.inAt ? toDate(pass.inAt).getTime() : Date.now();
  return Math.max(1, Math.round((end - toDate(pass.outAt).getTime()) / 60_000));
}

export function dueTime(pass: Pass) {
  return dueTimeFrom(pass.outAt, pass.minutes);
}

/** The same calculation for a pass the kiosk has just been granted. */
export function dueTimeFrom(outAt: string, minutes: number) {
  return time(new Date(toDate(outAt).getTime() + minutes * 60_000).toISOString());
}
