/**
 * `/robots.txt`.
 *
 * Generated rather than dropped in `public/`, for one reason: the `Sitemap:`
 * line has to be an absolute URL, and a static file would be the second place
 * in the repository that states the production origin. It is resolved from
 * `Astro.site` here, so there is still only one.
 *
 * Every route on this site is meant to be indexed, so there is nothing to
 * disallow. `Disallow:` with an empty value is the spec's way of saying that
 * explicitly — an empty group with no rule at all is technically allow-all too,
 * but it reads like an unfinished file.
 */
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  if (!site) {
    throw new Error('astro.config.mjs に site が無い（robots.txt は絶対 URL を要求する）');
  }

  const body = `User-agent: *
Disallow:

Sitemap: ${new URL('/sitemap.xml', site).href}
`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
