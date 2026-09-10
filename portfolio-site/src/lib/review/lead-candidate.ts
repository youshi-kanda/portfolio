/**
 * The Lead A/B — a review-only composition of the homepage's work list.
 *
 * "Which work should the homepage lead with" is a question about the PICTURE
 * the page makes, and it cannot be settled from the records. Both candidates
 * have to be drawn and photographed, so this replaces the works array the
 * homepage receives — and nothing else.
 *
 * WHAT THIS IS NOT. It is not a preview framework and it publishes nothing:
 *
 *   production path   `shippingWorks()` is untouched, and so is every page
 *                     that calls it. This module is imported by the homepage
 *                     and by nothing else.
 *   dist/             a review build cannot write it. `astro.config.mjs`
 *                     demands an explicit REVIEW_OUT and refuses `dist`.
 *   content           no file under `src/content/` is read, written or
 *                     re-parsed. The candidate is an in-memory reordering.
 *   approval          no approval state is created, moved or implied. A
 *                     screenshot is not a publication.
 *
 * WITH `REVIEW_LEAD` UNSET THIS IS THE IDENTITY. `composition()` returns null,
 * the homepage falls through to exactly the expression it had before, and the
 * public build's output is unchanged byte for byte. That is what makes an
 * env-gated branch acceptable in a page that ships: the gate is read at BUILD
 * time in a static site, so there is no runtime switch to get wrong and nothing
 * about the review path reaches a visitor.
 */
import type { Work } from '../content/schema.ts';
import { shippingWorks } from '../content/derive.ts';

export interface Composition {
  candidate: string;
  /** What 01 WORK renders: the Lead entry, then the index. */
  works: Work[];
  /** What the Editorial Band renders. Three panels or none. */
  band: Work[];
}

const BAND_PANELS = 3;

/**
 * The composition for this build, or null when there is no review to draw.
 *
 * The candidate is named by slug and must be a work that ships: a review frame
 * is taken through the REAL renderers, and a record without a figure or a
 * variant has nothing for them to draw. Refusing here says which of the two it
 * was; falling through would draw a page missing its Lead and call it a
 * comparison.
 */
export function composition(all: readonly Work[]): Composition | null {
  const candidate = process.env.REVIEW_LEAD?.trim();
  if (!candidate) return null;

  const shipping = shippingWorks(all);
  const lead = shipping.find((w) => w.slug === candidate);
  if (!lead) {
    throw new Error(
      `REVIEW_LEAD=${candidate} は出荷中の作品ではない。` +
        `候補にできるのは ${shipping.map((w) => w.slug).join(' / ')}。`,
    );
  }

  const rest = shipping
    .filter((w) => w.slug !== candidate)
    .map((w) => {
      if (w.homepageRole !== 'lead') return w;
      const { homepageRole: _dropped, ...without } = w;
      return without as Work;
    });

  const works: Work[] = [{ ...lead, featured: true, homepageRole: 'lead' }, ...rest];
  const featured = works.filter((w) => w.featured);
  return { candidate, works, band: featured.slice(0, BAND_PANELS) };
}
