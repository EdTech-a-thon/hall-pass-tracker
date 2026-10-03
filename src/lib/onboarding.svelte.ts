/**
 * Getting started, remembered in this browser: whether the teacher has seen
 * the welcome page, whether the checklist shows, whether they've looked at
 * Destinations, and any checklist items ticked or unticked by hand (which win
 * over the automatic ticks). It isn't part of a backup.
 */
const storageKey = 'happy-hallways.onboarding';

type Onboarding = {
  welcomed: boolean;
  showChecklist: boolean;
  visitedDestinations: boolean;
  checked: Record<string, boolean>;
};

function load(): Onboarding {
  const blank: Onboarding = { welcomed: false, showChecklist: false, visitedDestinations: false, checked: {} };
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) return { ...blank, ...JSON.parse(saved) };
  } catch {
    // Storage blocked or unreadable: show the welcome again rather than fail.
  }
  return blank;
}

export const onboarding: Onboarding = $state(load());

export function updateOnboarding(changes: Partial<Onboarding>) {
  Object.assign(onboarding, changes);
  try {
    localStorage.setItem(storageKey, JSON.stringify(onboarding));
  } catch {
    // Not saved; the checklist simply comes back next time.
  }
}
