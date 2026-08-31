/**
 * The public route list — the sitemap's source.
 *
 * A sitemap is a claim about what exists. Two ways that claim goes wrong, and
 * both are the same defect from opposite sides: a URL listed that was never
 * emitted (a 404 offered to a crawler), and a page emitted that is not listed
 * (a route the site publishes but does not admit to). Neither shows up in a
 * page that renders fine.
 *
 * So the rules here restate `getStaticPaths` rather than approximating it — a
 * work page needs resolvable Evidence, a Technical page needs a Case Study —
 * and `check-links` then holds the emitted sitemap against the HTML files that
 * are actually in `dist/`, set against set. If this file and the two page
 * files ever drift apart, that comparison fails the build. The derivation is
 * here so there is something to check; the check is what makes it true.
 */
import type { CaseStudy, Evidence, Work } from './schema.ts';
import { shippingWorks, technicalHref, workHref } from './derive.ts';

export interface PublicRoutes {
  /** Root-relative, trailing-slashed, in the order a reader meets them. */
  paths: string[];
}

export function publicRoutes(
  works: readonly Work[],
  evidence: readonly Evidence[],
  caseStudies: readonly CaseStudy[],
): PublicRoutes {
  const shipping = shippingWorks(works);
  const evidenceIds = new Set(evidence.map((e) => e.id));
  const caseSlugs = new Set(caseStudies.map((c) => c.slug));

  const paths = ['/', '/work/'];

  for (const work of shipping) {
    // `/work/<slug>/` mirrors its getStaticPaths: the page is only emitted when
    // the work's first Evidence id resolves to a record.
    const first = work.evidence[0];
    if (first && evidenceIds.has(first)) paths.push(workHref(work.slug, false));
  }

  for (const work of shipping) {
    // `/work/<slug>/technical/` mirrors its own: Case Study or no page.
    if (caseSlugs.has(work.slug)) paths.push(technicalHref(work.slug));
  }

  return { paths };
}
