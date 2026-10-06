import type { Pass } from './types';

/** A fresh, unguessable id for a class, student, pass or kiosk. */
export function newId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function now() {
  return new Date().toISOString();
}

/** The last moment of the day `at` falls on, as an ISO time. */
export function endOfDay(at: string | Date) {
  const end = new Date(at);
  end.setHours(23, 59, 59, 999);
  return end.toISOString();
}

/**
 * A pass whose end we invented rather than observed: the class changed, the
 * student undid a mis-tap, or they left the roster while out. Its duration is
 * not a real one, so it stays out of minutes-missed and overdue figures.
 */
export function hasRealDuration(pass: Pass) {
  return !pass.endedBy || pass.endedBy === 'student' || pass.endedBy === 'teacher';
}

/** How many minutes a pass has lasted so far (as of `at`), or lasted in total once returned. */
export function duration(pass: Pass, at = Date.now()) {
  const end = pass.inAt ? new Date(pass.inAt).getTime() : at;
  return Math.max(1, Math.round((end - new Date(pass.outAt).getTime()) / 60_000));
}

/**
 * A pass that lasted longer than its destination's expected minutes. There is
 * no grace period: the teacher set the number. Only the laptop ever says this;
 * the kiosk never does. See docs/adr/0003.
 */
export function isOverdue(pass: Pass, at = Date.now()) {
  return pass.minutes > 0 && hasRealDuration(pass) && duration(pass, at) > pass.minutes;
}

/** The local calendar day of a timestamp, as "2026-10-02". */
export function dayKey(value: string | Date) {
  const local = new Date(value);
  return new Date(local.getTime() - local.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

/** A short local clock time, e.g. "2:05 PM". */
export function time(value: string) {
  return new Intl.DateTimeFormat([], { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

/** "Mon, Oct 2" */
export function shortDate(value: string) {
  return new Intl.DateTimeFormat([], { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(value));
}

export function dueTime(pass: Pass) {
  return time(new Date(new Date(pass.outAt).getTime() + pass.minutes * 60_000).toISOString());
}

/**
 * Combines the kiosk's copy of a pass with the laptop's. A teacher's correction
 * is deliberate, so the latest corrected copy wins outright. Otherwise the copies
 * agree on everything except perhaps the return, and the earlier return wins:
 * the student was back from that moment, whichever device heard it first.
 * See docs/adr/0005.
 */
export function mergePass(first: Pass, second: Pass): Pass {
  const byNewest = [first, second].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const corrected = byNewest.find((pass) => pass.corrected);
  const base = corrected ?? byNewest[0];
  if (corrected?.inAt) return base;
  const ended = byNewest.filter((pass) => pass.inAt).sort((a, b) => a.inAt!.localeCompare(b.inAt!))[0];
  if (!ended) return base;
  return { ...base, inAt: ended.inAt, endedBy: ended.endedBy };
}

/** Folds incoming copies into a list of passes, in place. */
export function mergeInto(list: Pass[], incoming: Pass[]) {
  const byId = new Map(list.map((pass, index) => [pass.id, index]));
  for (const pass of incoming) {
    const index = byId.get(pass.id);
    if (index === undefined) {
      byId.set(pass.id, list.length);
      list.push(pass);
    } else {
      list[index] = mergePass(list[index], pass);
    }
  }
}

/** Ends a pass without anyone seeing the student come back. */
export function endUnseen(pass: Pass, endedBy: 'switch' | 'cancelled' | 'removed'): Pass {
  const at = now();
  return { ...pass, inAt: at, endedBy, updatedAt: at };
}
