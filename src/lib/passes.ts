import type { ActiveClass, Pass, PassEvent } from './types';

export function activePasses(state: ActiveClass) {
  return state.passes.filter((pass) => !pass.inAt);
}

/**
 * Lays every Correction over the entry it amends. The base entries are never
 * changed -- they cannot be, the database refuses it -- so this is where the
 * corrected view comes from. A Correction can itself be corrected, and because
 * they are applied oldest to newest, the most recent one wins. See
 * docs/adr/0004.
 */
function applyCorrections(events: PassEvent[]) {
  const corrections = events.filter((event) => event.kind === 'fix' && event.corrects);
  const base = events.filter((event) => event.kind !== 'fix');
  if (!corrections.length) return { entries: base, corrected: new Set<string>() };

  const byTarget = new Map<string, PassEvent[]>();
  for (const fix of corrections) {
    const group = byTarget.get(fix.corrects!);
    if (group) group.push(fix);
    else byTarget.set(fix.corrects!, [fix]);
  }

  const corrected = new Set<string>();
  const entries = base.map((event) => {
    const fixes = byTarget.get(event.id);
    if (!fixes) return event;
    corrected.add(event.id);
    let next = { ...event };
    for (const fix of [...fixes].sort((first, second) => first.at.localeCompare(second.at))) {
      if (fix.newStudent) next = { ...next, student: fix.newStudent, studentName: fix.studentName };
      if (fix.newAt) next = { ...next, at: fix.newAt };
    }
    return next;
  });
  return { entries, corrected };
}

/**
 * Turns the append-only log into round trips. Each "out" opens a pass and the
 * next "in" from the same student closes it, so a student whose latest entry is
 * an exit is still in the hallway.
 */
export function foldEvents(events: PassEvent[]): Pass[] {
  const { entries, corrected } = applyCorrections(events);
  const passes: Pass[] = [];
  const open = new Map<string, Pass>();
  for (const event of [...entries].sort((first, second) => first.at.localeCompare(second.at))) {
    if (event.kind === 'out') {
      const pass: Pass = {
        id: event.id,
        student: event.student,
        studentName: event.studentName,
        destination: event.destination,
        minutes: event.minutes,
        outAt: event.at,
        corrected: corrected.has(event.id),
      };
      passes.push(pass);
      open.set(event.student, pass);
      continue;
    }
    const pass = open.get(event.student);
    if (!pass) continue;
    pass.inAt = event.at;
    pass.inId = event.id;
    pass.endedBy = event.source === 'teacher' ? 'teacher' : event.source === 'switch' ? 'switch' : event.source === 'cancelled' ? 'cancelled' : 'student';
    if (event.source === 'teacher') pass.signedInBy = event.signedInBy || 'the teacher';
    if (corrected.has(event.id)) pass.corrected = true;
    open.delete(event.student);
  }
  return passes;
}

/**
 * A trip whose end we invented rather than observed: the bell rang, or a student
 * undid a mis-tap. Its duration is not a real duration, so it must stay out of
 * averages and out of the overdue count.
 */
export function hasRealDuration(pass: Pass) {
  return pass.endedBy !== 'switch' && pass.endedBy !== 'cancelled';
}

/**
 * PocketBase writes timestamps as "2026-08-19 10:03:12.123Z". Some browsers
 * refuse that space, so every reading of a stored time goes through here.
 */
function toDate(value: string) {
  return new Date(value.replace(' ', 'T'));
}

/** The local calendar day a stored timestamp falls on, as "2026-08-19". */
export function dayKey(value: string) {
  const local = toDate(value);
  return new Date(local.getTime() - local.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
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

/**
 * A Pass that has lasted longer than the minutes frozen onto it when the student
 * left. There is no grace period: the teacher set the number, so the app does
 * not quietly pad it. This is a judgement for the teacher's dashboard only --
 * kiosk mode never shows it. See docs/adr/0003.
 */
export function isOverdue(pass: Pass) {
  return pass.minutes > 0 && hasRealDuration(pass) && duration(pass) > pass.minutes;
}

export function dueTime(pass: Pass) {
  return dueTimeFrom(pass.outAt, pass.minutes);
}

/** The same calculation for a pass the kiosk has just been granted. */
export function dueTimeFrom(outAt: string, minutes: number) {
  return time(new Date(toDate(outAt).getTime() + minutes * 60_000).toISOString());
}
