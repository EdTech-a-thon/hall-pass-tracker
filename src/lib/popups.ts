/**
 * Popups: what Happy Hallways tells a teacher once, on the laptop only, never
 * on the kiosk. Each is shown until the teacher closes it, and the Account
 * remembers which ones they have closed.
 * - News is "What's changed": a big window, shown once on whatever page the
 *   teacher opens, to teachers who were using Happy Hallways before the change.
 * - A Tip points at one thing on one page, the first time the teacher sees
 *   it. A page's tips show one after another, as a short tour.
 * Add new news at the end of `news`.
 */

export type PopupArt = 'destination-limits' | 'check-destinations' | 'schedule' | 'no-pass-rules' | 'home' | 'requests';

export type News = {
  id: string;
  /** Heads this news when it's shown along with older news the teacher hasn't seen. */
  title: string;
  items: { title: string; text: string; art: PopupArt }[];
  /** Where the teacher should go to act on the news. */
  action: { label: string; href: string };
};

export type Tip = {
  id: string;
  /** The page it belongs on: an exact path, or a pattern for one like a class page. */
  page: string | RegExp;
  /** It points at the element marked `data-tip="{id}"`, and waits until there is one. */
  title: string;
  text: string;
};

export const news: News[] = [
  {
    id: '2026-10-destination-limits',
    title: 'Destinations',
    items: [
      {
        title: 'Each destination has its own limit',
        text: 'The Restroom can stay one at a time while the Nurse and the Counselor have no limit. Only destinations with a limit get a line, so nobody waits behind a trip to the Nurse.',
        art: 'destination-limits',
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
        text: 'Enter your periods once in the Schedule tab, and the kiosk switches to each class by itself as the period starts. Rotating days? Make a schedule for each (A Day, B Day…) and pick the right one on Home in the morning.',
        art: 'schedule',
      },
      {
        title: 'No-pass times live in your schedule',
        text: 'Block the first or last few minutes of a period, or draw a no-pass time right on the calendar. They work while the kiosk is following your schedule. Off schedule, stop passes by hand from Home.',
        art: 'no-pass-rules',
      },
    ],
    action: { label: 'Set up your schedule', href: '/schedule' },
  },
  {
    id: '2026-10-home',
    title: 'Home, and students asking you',
    items: [
      {
        title: 'Everything for the day is on Home',
        text: 'Who’s out, who’s waiting, and which class and schedule the kiosk is on, all on one page you can leave open all day. The box at the top of the sidebar always brings you back. Classes are just your rosters now, and every pass is in History.',
        art: 'home',
      },
      {
        title: 'Students ask, you say yes or no',
        text: 'When something stops a student (they’re out of passes, it’s a no-pass time, or their destination is full), they can tap “Ask my teacher” at the kiosk. Their request shows up on Home. Approve it and their pass starts right away. You can still let them go at the kiosk with your PIN.',
        art: 'requests',
      },
    ],
    action: { label: 'Go to Home', href: '/' },
  },
];

export const tips: Tip[] = [
  {
    id: 'tip-status',
    page: '/',
    title: 'Always one click away',
    text: 'This box shows your class, schedule, kiosk and requests at a glance. Click it from any page to come back to Home.',
  },
  {
    id: 'tip-requests',
    page: '/',
    title: 'Students’ requests land here',
    text: 'When something stops a student at the kiosk, they can ask you. Approve, and their pass starts right away; deny, and the kiosk tells them “not right now”.',
  },
  {
    id: 'tip-switch',
    page: '/',
    title: 'Early release? Switch here',
    text: 'Pick a different schedule for today, or choose a class by hand. “Back to schedule” puts the kiosk back on track.',
  },
  {
    id: 'tip-roster',
    page: /^\/classes\/(?!new)[^/]+$/,
    title: 'Classes are your rosters',
    text: 'Add and edit students here. Their passes moved to History: click a student to see theirs.',
  },
];

export function newsIds() {
  return news.map((each) => each.id);
}

/**
 * Older versions remembered only the newest news a teacher had seen, so
 * everything up to it counts as seen.
 */
export function seenBefore(newestSeen: string | undefined, at: string): Record<string, string> {
  const upTo = news.findIndex((each) => each.id === newestSeen);
  return Object.fromEntries(news.slice(0, upTo + 1).map((each) => [each.id, at]));
}

export function unseenNews(seen: Record<string, string>) {
  return news.filter((each) => !seen[each.id]);
}

/** This page's tips not seen yet, in tour order. */
export function unseenTips(path: string, seen: Record<string, string>) {
  return tips.filter(
    (tip) => !seen[tip.id] && (typeof tip.page === 'string' ? tip.page === path : tip.page.test(path)),
  );
}

/** Any popup by id, for `?popup=` and the Help menu. */
export function popupNamed(id: string) {
  return news.find((each) => each.id === id) ?? tips.find((each) => each.id === id);
}
