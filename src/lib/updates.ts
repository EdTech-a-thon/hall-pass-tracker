/**
 * "What's changed": the news a returning teacher sees once, the first time they
 * open Happy Hallways after an update. A brand-new account starts having seen
 * them all, since nothing changed under that teacher. Add new entries at the end.
 */
export type UpdateArt = 'destination-limits' | 'let-go' | 'check-destinations';

export type Update = {
  id: string;
  items: { title: string; text: string; art: UpdateArt }[];
};

export const updates: Update[] = [
  {
    id: '2026-10-destination-limits',
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
  },
];

export const latestUpdate = updates[updates.length - 1].id;

/** The entries a teacher hasn't seen yet, oldest first. */
export function unseenUpdates(seen: string | undefined) {
  return updates.slice(updates.findIndex((update) => update.id === seen) + 1);
}
