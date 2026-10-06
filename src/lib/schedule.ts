import type { ActiveClass, ClockRange, ManualNoPass, Period, Schedule } from './types';

/**
 * Reading a Schedule against the clock: which class belongs on the kiosk right
 * now, and whether it's No-Pass Time. Times are "HH:MM" strings, as a time
 * input gives them. See docs/adr/0008.
 */

/** Minutes since midnight, from "09:15". */
export function toMinutes(clock: string) {
  const [hours, minutes] = clock.split(':').map(Number);
  return hours * 60 + minutes;
}

/** "09:15" from minutes since midnight. */
export function toClock(minutes: number) {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(minutes)));
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
}

/** Local clock time as "HH:MM". */
export function clockOf(at: number | string) {
  const date = new Date(at);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** "9:15 AM" from "09:15". */
export function formatClock(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return new Intl.DateTimeFormat([], { hour: 'numeric', minute: '2-digit' }).format(date);
}

/** "9:15 AM – 10:00 AM" */
export function formatRange(range: ClockRange) {
  return `${formatClock(range.start)} – ${formatClock(range.end)}`;
}

export function blankSchedule(id: string, name: string): Schedule {
  return { id, name, periods: [], rules: [], noPassTimes: [] };
}

/** The periods in order of the clock. */
export function sortedPeriods(schedule: Schedule) {
  return [...schedule.periods].sort((a, b) => a.start.localeCompare(b.start));
}

/** The period the clock is in, if any. */
export function periodAt(schedule: Schedule | undefined, at = Date.now()): Period | null {
  const clock = clockOf(at);
  return schedule?.periods.find((period) => period.start <= clock && clock < period.end) ?? null;
}

/** The class the schedule puts on the kiosk at `at`: null between periods. */
export function scheduledClassAt(schedule: Schedule | undefined, at = Date.now()) {
  return periodAt(schedule, at)?.classId ?? null;
}

/** The next period with a class in it, later today. */
export function nextClassPeriod(schedule: Schedule | undefined, at = Date.now()) {
  const clock = clockOf(at);
  return schedule ? (sortedPeriods(schedule).find((period) => period.classId && period.start > clock) ?? null) : null;
}

/** Whether two stretches of the clock share any minute. */
export function overlaps(a: ClockRange, b: ClockRange) {
  return a.start < b.end && b.start < a.end;
}

/** Why a period can't go where it is, or null if it can. Periods never overlap. */
export function periodProblem(schedule: Schedule, period: ClockRange & { id?: string }) {
  if (!period.start || !period.end || period.start >= period.end) return 'A period needs to start before it ends.';
  const clash = schedule.periods.find((other) => other.id !== period.id && overlaps(other, period));
  return clash ? `That overlaps the period from ${formatRange(clash)}.` : null;
}

/** One stretch of No-Pass Time a schedule makes, and where it came from. */
export type ScheduledNoPass = ClockRange & {
  /** A rule's stretch applies only to its period's class; a drawn one to whichever class is on the kiosk. */
  classId: string | null;
  from: { rule: string } | { drawn: string };
};

/**
 * Every No-Pass Time a schedule makes in a day: each rule laid over the
 * periods it covers, plus the times drawn on it. A rule longer than its
 * period covers the whole period and no more.
 */
export function scheduledNoPassTimes(schedule: Schedule): ScheduledNoPass[] {
  const fromRules = schedule.periods.flatMap((period) => {
    if (!period.classId) return [];
    const start = toMinutes(period.start);
    const end = toMinutes(period.end);
    return schedule.rules
      .filter((rule) => rule.minutes > 0 && (rule.classId === null || rule.classId === period.classId))
      .map((rule) => ({
        start: rule.edge === 'first' ? period.start : toClock(Math.max(start, end - rule.minutes)),
        end: rule.edge === 'first' ? toClock(Math.min(end, start + rule.minutes)) : period.end,
        classId: period.classId,
        from: { rule: rule.id },
      }));
  });
  const drawn = schedule.noPassTimes.map((time) => ({
    start: time.start,
    end: time.end,
    classId: null,
    from: { drawn: time.id },
  }));
  return [...fromRules, ...drawn];
}

/** What decides No-Pass Time, as the laptop and the kiosk each hold it. */
export type NoPassSources = {
  schedule?: Schedule;
  activeClass: ActiveClass | null | undefined;
  manualNoPass?: ManualNoPass | null;
};

/** The No-Pass Time a class is in at `at`, if any. `end` is when passes open again, or null if only the teacher can end it. */
export type NoPassNow = { start: string; end: string | null };

/**
 * The No-Pass Time in effect for a class on the kiosk. One the teacher started
 * by hand applies until they end it; the schedule's apply only On Schedule.
 * Back-to-back or overlapping stretches count as one, so the end is when
 * passes really open.
 */
export function noPassAt(sources: NoPassSources, classId: string | null | undefined, at = Date.now()): NoPassNow | null {
  if (!classId) return null;
  const manual = sources.manualNoPass;
  if (manual?.classId === classId) return { start: clockOf(manual.startedAt), end: null };
  if (!sources.activeClass?.onSchedule || !sources.schedule) return null;
  const clock = clockOf(at);
  const applying = scheduledNoPassTimes(sources.schedule).filter(
    (time) => time.classId === null || time.classId === classId,
  );
  const current = applying.find((time) => time.start <= clock && clock < time.end);
  if (!current) return null;
  let end = current.end;
  for (let next = applying.find((time) => time.start <= end && end < time.end); next; ) {
    end = next.end;
    next = applying.find((time) => time.start <= end && end < time.end);
  }
  return { start: current.start, end };
}
