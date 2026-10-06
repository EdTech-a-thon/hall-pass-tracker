/**
 * The Guides: short how-tos for teachers, at /guides. Each guide is its own
 * page under src/routes/guides/, listed here so the Guides page and the
 * sitemap find it. Its screenshots come from scripts/guides/ (see README).
 */

/** Where the site lives, for links that search engines and social sites read. */
export const siteUrl = 'https://happyhallways.com';

export type Guide = {
  slug: string;
  /** The guide's heading, on its page and on the Guides page. */
  title: string;
  /** One or two sentences, on the Guides page. */
  description: string;
  /**
   * What search engines show, worded the way teachers search. It can differ
   * from what the page says: teachers search for "girls' and boys' bathrooms",
   * but the guide itself doesn't assume how a school divides its bathrooms.
   */
  search: { title: string; description: string };
  /** The day the guide was last checked against the app, as YYYY-MM-DD. */
  updated: string;
};

export const guides: Guide[] = [
  {
    slug: 'separate-bathroom-lines',
    title: 'Give each bathroom its own line',
    description:
      'Set up a separate hall pass line for each bathroom, so a student waiting for one bathroom never holds up a student headed to another.',
    search: {
      title: 'Separate hall pass lines for the girls’ and boys’ bathrooms',
      description:
        'Give the girls’ and boys’ bathrooms (or any two bathrooms) their own hall pass line in Happy Hallways, so students waiting for one never hold up the other.',
    },
    updated: '2026-10-06',
  },
  {
    slug: 'schedule-no-pass-times',
    title: 'Set up your schedule with no-pass times',
    description:
      'Enter your bell schedule once: the kiosk switches classes by itself, and nobody can leave in the first or last minutes of class.',
    search: {
      title: 'Block hall passes in the first and last minutes of class',
      description:
        'Set no-pass times in Happy Hallways, the free digital hall pass: block passes at the start and end of each period, or during an assembly, and let the kiosk follow your bell schedule.',
    },
    updated: '2026-10-06',
  },
];

export function guideNamed(slug: string): Guide {
  const guide = guides.find((each) => each.slug === slug);
  if (!guide) throw new Error(`No guide called ${slug} in src/lib/guides.ts`);
  return guide;
}

export function guideUrl(guide: Guide) {
  return `${siteUrl}/guides/${guide.slug}`;
}
