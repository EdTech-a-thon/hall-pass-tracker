import { guides, guideUrl, siteUrl } from '#lib/guides.ts';

// Tells search engines which pages to read. Built once, into a plain file.
export const prerender = true;

export function GET() {
  const pages = [
    { url: `${siteUrl}/welcome` },
    { url: `${siteUrl}/guides` },
    ...guides.map((guide) => ({ url: guideUrl(guide), updated: guide.updated })),
  ];
  const urls = pages
    .map((page) => `  <url><loc>${page.url}</loc>${'updated' in page ? `<lastmod>${page.updated}</lastmod>` : ''}</url>`)
    .join('\n');
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    { headers: { 'Content-Type': 'application/xml' } },
  );
}
