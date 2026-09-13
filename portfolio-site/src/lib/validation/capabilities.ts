/**
 * 03 CAPABILITIES names its evidence by work slug — this is what stops it from
 * naming evidence that is not there.
 *
 *   C-CAP-SLUG   a category cites a work the site does not ship. The section's
 *                whole argument is that each capability points at something the
 *                reader can scroll to, so a slug that resolves to nothing is
 *                not a broken link — it is a capability claimed with no example
 *                behind it, which is the one thing this section must not do.
 *
 * The renderer drops unknown slugs rather than printing them raw, so without
 * this the failure mode is silent: a category quietly loses an example and the
 * claim stays. That is exactly the shape of defect the gates exist to refuse.
 */
import type { Work } from '../content/schema.ts';
import { shippingWorks } from '../content/derive.ts';
import { siteStrings } from '../content/site.ts';
import type { Finding } from './finding.ts';
import { site } from '../content/site.ts';

export function capabilitiesGate(works: readonly Work[]): Finding[] {
  const shipping = new Set(shippingWorks(works).map((w) => w.slug));
  const out: Finding[] = [];

  for (const cat of site.capabilities.categories) {
    for (const slug of cat.examples) {
      if (!shipping.has(slug)) {
        out.push({
          level: 'ERROR',
          code: 'C-CAP-SLUG',
          message:
            `capabilities.${cat.key} が実例に ${slug} を挙げているが、出荷している作品に無い。` +
            `能力の裏付けとして挙げられるのは、同じページで読者が辿り着ける作品だけ。`,
        });
      }
    }
    if (cat.examples.length === 0) {
      out.push({
        level: 'ERROR',
        code: 'C-CAP-SLUG',
        message: `capabilities.${cat.key} に実例が 1 件も無い。裏付けの無い能力は載せない。`,
      });
    }
  }
  return out;
}

/** Kept for symmetry with the other gate modules. */
export const capabilitiesStrings = siteStrings;
