/**
 * "What's changed": the news a returning teacher sees once, the first time they
 * open Happy Hallways after an update. A brand-new account starts having seen
 * them all, since nothing changed under that teacher. Add new entries at the end.
 */
export type UpdateArt = 'destination-limits' | 'let-go' | 'check-destinations' | 'schedule' | 'no-pass-rules';

export type Update = {
  id: string;
  /** Heads this news when it's shown along with older news the teacher hasn't seen. */
  title: string;
  items: { title: string; text: string; art: UpdateArt }[];
  /** Where the teacher should go to act on the news. */
  action: { label: string; href: string };
};

export const updates: Update[] = [
  {
    id: '2026-10-destination-limits',
    title: 'Destinations and letting students go',
    items: [
      {
        title: 'Each destination has its own limit',
        text: 'The Restroom can stay one at a time while the Nurse and the Counselor have no limit. Only destinations with a limit get a line, so nobody waits behind a trip to the Nurse.',
        art: 'destination-limits',
      },
      {
        title: 'Let a student go with one click',
        text: 'Sometimes a student really needs to go when they normally couldn’t: during the times you’ve blocked passes (like the first and last ten minutes of class), when their destination is full, or after they’ve used up their passes. From the Now tab, let them go in one click. It’s marked in their history, so your records stay complete.',
        art: 'let-go',
      },
      {
        title: 'Check your destinations',
        text: 'We copied your old limit onto each of your destinations. Set the ones like the Nurse to “No limit”.',
        art: 'check-destinations',
      },
    ],
    action: { label: 'Review destinations', href: '/destinations' },
  },
  {
    id: '2026-10-schedule',
    title: 'Your schedule',
    items: [
      {
        title: 'The kiosk can follow your schedule',
        text: 'Enter your periods once in the new Schedule tab, and the kiosk switches to each class by itself as the period starts. Rotating days? Make a schedule for each (A Day, B Day…) and pick the right one in the morning.',
        art: 'schedule',
      },
      {
        title: 'No-pass times live in your schedule now',
        text: 'Block the first or last few minutes of every class in one line, or draw a no-pass time right on the calendar. They work while the kiosk is following your schedule. If you’d set no-pass times on a class, we moved them to your schedule: turn it on to use them. Off schedule, start a no-pass time by hand from the Now tab.',
        art: 'no-pass-rules',
      },
    ],
    action: { label: 'Set up your schedule', href: '/schedule' },
  },
];

export const latestUpdate = updates[updates.length - 1].id;

/** The entries a teacher hasn't seen yet, oldest first. */
export function unseenUpdates(seen: string | undefined) {
  return updates.slice(updates.findIndex((update) => update.id === seen) + 1);
}
