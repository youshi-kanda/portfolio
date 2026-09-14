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
import {
  ARCHIVE_HREF,
  METHOD_HREF,
  shippingWorks,
  technicalHref,
  workHasTechnical,
  workHref,
} from './derive.ts';

/**
 * `_evidence` is kept in the signature and no longer read. The route list stops
 * depending on Evidence with this checkpoint; the parameter stays so that every
 * caller (the sitemap, `check-links`, the tests) is not rewritten in the same
 * change that rewrites the rule, and so the next person sees that the argument
 * was removed from the DECISION rather than never having been there.
 */
export interface PublicRoutes {
  /** Root-relative, trailing-slashed, in the order a reader meets them. */
  paths: string[];
}

export function publicRoutes(
  works: readonly Work[],
  _evidence: readonly Evidence[],
  caseStudies: readonly CaseStudy[],
): PublicRoutes {
  const shipping = shippingWorks(works);

  const paths = ['/', ARCHIVE_HREF, METHOD_HREF];

  // `/work/<slug>/` mirrors its getStaticPaths: EVERY shipping work, since the
  // Overview checkpoint. It used to also require the work's first Evidence id
  // to resolve, which meant the sitemap listed three of ten works — accurately,
  // because only three pages existed.
  for (const work of shipping) paths.push(workHref(work.slug, false));

  // `/work/<slug>/technical/` mirrors its own: Case Study or no page.
  for (const work of shipping) {
    if (workHasTechnical(work, caseStudies)) paths.push(technicalHref(work.slug));
  }

  return { paths };
}
