/**
 * The Guides: short how-tos for teachers, at /guides. Each guide is its own
 * page under src/routes/guides/, listed here so the Guides page and the
 * sitemap find it. Its screenshots come from scripts/guides/ (see README).
 */

/** Where the site lives, for links that search engines and social sites read. */
export const siteUrl = 'https://happyhallways.com';

export type Guide = {
  slug: string;
  title: string;
  /** One or two sentences: shown in search results and on the Guides page. */
  description: string;
  /** The day the guide was last checked against the app, as YYYY-MM-DD. */
  updated: string;
};

export const guides: Guide[] = [
  {
    slug: 'separate-bathroom-lines',
    title: 'Separate lines for the girls’ and boys’ bathrooms',
    description:
      'Set up a separate hall pass line for each bathroom, so a girl waiting for the girls’ bathroom never holds up a boy, and the other way around.',
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
