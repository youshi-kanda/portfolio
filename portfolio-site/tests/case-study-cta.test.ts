/**
 * The Case Study CTA contract — #7 review, restated after the Overview
 * checkpoint.
 *
 * The defect this pins: #7 first rendered the gallery's and the register's
 * "Case Study を読む" from the route-existence question, because for the three
 * works shipping at the time the two answers coincided. They are different
 * questions, and the coincidence was load-bearing by accident.
 *
 *   /work/<slug>/ exists   for every shipping work. `workHasOverview`.
 *   "Case Study" may be    only when `caseStudyPublished`. Anything else
 *   printed                promises CS-1…CS-16 and delivers an Overview.
 *
 * THE TWO ANSWERS NOW DIFFER SEVEN TIMES OUT OF TEN, which is the point: the
 * old coincidence is not merely broken in principle, it is broken in the
 * shipped content, so a renderer that conflates them fails here rather than
 * the next time somebody publishes a record.
 *
 * The Evidence argument is gone from the route question entirely — publication
 * of a screenshot no longer decides publication of a work.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  workHasOverview,
  workShowsCaseStudyCta,
  publishedCaseStudies,
  shippingWorks,
} from '../src/lib/content/derive.ts';
import type { Work } from '../src/lib/content/schema.ts';
import { clone, realContent, sampleWork } from './helpers.ts';

describe('Case Study CTA contract', () => {
  it('THE REGRESSION: page exists, Case Study does not — link, but no CTA', () => {
    const w = clone(sampleWork()) as Work;
    w.evidence = ['EV-1'];
    w.caseStudyPublished = false;

    // the row may link: the Overview is really there
    assert.equal(workHasOverview(w), true);
    // and it must NOT call that link a Case Study
    assert.equal(workShowsCaseStudyCta(w), false);
  });

  it('a published Case Study shows the CTA', () => {
    const w = clone(sampleWork()) as Work;
    w.caseStudyPublished = true;
    assert.equal(workShowsCaseStudyCta(w), true);
    assert.equal(workHasOverview(w), true);
  });

  it('no Evidence at all still gets a page — and still no CTA', () => {
    // The Overview checkpoint's whole change, as one assertion. This was
    // `false / false`: a work without a screenshot had no page to link to.
    const w = clone(sampleWork()) as Work;
    w.evidence = [];
    w.image = undefined;
    w.caseStudyPublished = false;
    assert.equal(workHasOverview(w), true);
    assert.equal(workShowsCaseStudyCta(w), false);
  });

  it('neither answer moves when the Evidence list changes', () => {
    const w = clone(sampleWork()) as Work;
    w.caseStudyPublished = false;
    for (const ids of [[], ['EV-1'], ['OTHER', 'EV-1']]) {
      w.evidence = ids;
      assert.equal(workShowsCaseStudyCta(w), false, `evidence=${ids.length}`);
      assert.equal(workHasOverview(w), true, `evidence=${ids.length}`);
    }
  });

  it('a work that is not published gets no page', () => {
    // The predicate still asks something. Replacing it with `true` would ship
    // a link to a route `getStaticPaths` never emitted.
    const draft = clone(sampleWork()) as Work;
    draft.status = 'draft';
    assert.equal(workHasOverview(draft), false);

    const unshipped = clone(sampleWork()) as Work;
    unshipped.shipping = false;
    assert.equal(workHasOverview(unshipped), false);
  });

  it('every work claiming a CTA has a Case Study record behind it', () => {
    // The shipped side of the same rule: `caseStudyPublished` is what every
    // renderer reads, so a work setting it without a record would offer a link
    // to a page whose body does not exist.
    const { works, caseStudies } = realContent();
    const claiming = shippingWorks(works).filter(workShowsCaseStudyCta).map((w) => w.slug);
    const paired = publishedCaseStudies(works, caseStudies).map((p) => p.work.slug);
    assert.deepEqual(claiming, paired);
    assert.deepEqual(claiming, ['crm', 'ppm', 'dfe']);
  });

  it('the works #7 added have a page and claim no Case Study', () => {
    const { works } = realContent();
    const added = ['ins-ai', 'hire', 'assist', 'ops', 'minio', 'docai', 'agri'];
    for (const slug of added) {
      const w = works.find((x) => x.slug === slug);
      assert.ok(w, `${slug} が無い`);
      assert.equal(workHasOverview(w), true, `${slug} に Overview が無い`);
      assert.equal(workShowsCaseStudyCta(w), false, `${slug} が Case Study を主張している`);
    }
  });
});
