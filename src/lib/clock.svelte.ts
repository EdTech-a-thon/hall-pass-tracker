/**
 * The time, re-read every 15 seconds, for anything on the teacher's pages that
 * changes as the clock moves: periods, No-Pass Times, minutes out.
 */
export const clock = $state({ now: Date.now() });

if (typeof window !== 'undefined') setInterval(() => (clock.now = Date.now()), 15_000);
