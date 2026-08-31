/**
 * `/sitemap.xml` — one file, eight URLs, no index wrapper.
 *
 * A sitemap index exists to shard a list that has outgrown 50,000 URLs or 50MB.
 * This list is the whole site, and it fits in a paragraph; wrapping it in an
 * index would add a document whose only content is a pointer to the document
 * that has the content.
 *
 * No `<lastmod>`. The honest value is the commit date of each page's content,
 * and this build does not have it — every alternative (build time, today's
 * date) says "changed just now" about pages that did not change, which is
 * exactly the signal `lastmod` exists to carry. An absent `lastmod` is
 * well-formed and tells a crawler nothing false. Same reasoning for
 * `<changefreq>` and `<priority>`, which are declarations about future
 * behaviour that nothing here can support.
 */
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { publicRoutes } from '../lib/content/routes.ts';

/** `&` first, or it re-escapes the ampersands the other replacements emit. */
const xml = (s: string): string =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

export const GET: APIRoute = async ({ site }) => {
  if (!site) {
    throw new Error('astro.config.mjs に site が無い（sitemap は絶対 URL を要求する）');
  }

  const { paths } = publicRoutes(
    (await getCollection('work')).map((e) => e.data),
    (await getCollection('evidence')).map((e) => e.data),
    (await getCollection('caseStudy')).map((e) => e.data),
  );

  const urls = paths
    .map((path) => `  <url><loc>${xml(new URL(path, site).href)}</loc></url>`)
    .join('\n');

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
