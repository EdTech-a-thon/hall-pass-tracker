import type { AppState, Pass } from './types';

export function activePasses(state: AppState) {
  return state.passes.filter((pass) => !pass.inAt);
}

/** Formats an ISO timestamp as a short local clock time, e.g. "2:05 PM". */
export function time(value: string) {
  return new Intl.DateTimeFormat([], { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

/** How many minutes a pass has lasted so far, or lasted in total once returned. */
export function duration(pass: Pass) {
  const end = pass.inAt ? new Date(pass.inAt).getTime() : Date.now();
  return Math.max(1, Math.round((end - new Date(pass.outAt).getTime()) / 60_000));
}

export function dueTime(pass: Pass) {
  return time(new Date(new Date(pass.outAt).getTime() + pass.minutes * 60_000).toISOString());
}
