/**
 * The Case Study CTA contract — #7 review.
 *
 * The defect this pins: #7 first rendered the gallery's and the register's
 * "Case Study を読む" from `workHasDetailPage`, because for the three works
 * shipping at the time the two answers coincided. They are different
 * questions, and the coincidence was load-bearing by accident.
 *
 *   /work/<slug>/ exists   when the work's first Evidence id resolves. The
 *                          route renders the ENTRY SCREEN with or without a
 *                          Case Study body — deliberately, so a work is
 *                          reachable as soon as its facts are sourced.
 *   "Case Study" may be    only when `caseStudyPublished`. Anything else
 *   printed                promises CS-1…CS-16 and delivers the entry screen.
 *
 * The state that breaks the old rule — Evidence resolved, Case Study not
 * written — is not hypothetical. It is the state every work added by #7 enters
 * the moment #8 gives it an Evidence record.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  workHasDetailPage,
  workShowsCaseStudyCta,
  publishedCaseStudies,
  shippingWorks,
} from '../src/lib/content/derive.ts';
import type { Evidence, Work } from '../src/lib/content/schema.ts';
import { clone, realContent, sampleWork } from './helpers.ts';

const evidenceRecord = (id: string): Evidence => ({ id } as unknown as Evidence);

describe('Case Study CTA contract', () => {
  it('THE REGRESSION: Evidence resolves, Case Study does not exist — no CTA', () => {
    const w = clone(sampleWork()) as Work;
    w.evidence = ['EV-1'];
    w.caseStudyPublished = false;
    const evidence = [evidenceRecord('EV-1')];

    // the row may link: the entry screen is really there
    assert.equal(workHasDetailPage(w, evidence), true);
    // and it must NOT call that link a Case Study
    assert.equal(workShowsCaseStudyCta(w), false);
  });

  it('a published Case Study shows the CTA', () => {
    const w = clone(sampleWork()) as Work;
    w.evidence = ['EV-1'];
    w.caseStudyPublished = true;
    assert.equal(workShowsCaseStudyCta(w), true);
    assert.equal(workHasDetailPage(w, [evidenceRecord('EV-1')]), true);
  });

  it('no Evidence: no page to link, and no CTA either', () => {
    const w = clone(sampleWork()) as Work;
    w.evidence = [];
    w.caseStudyPublished = false;
    assert.equal(workHasDetailPage(w, []), false);
    assert.equal(workShowsCaseStudyCta(w), false);
  });

  it('the CTA never depends on the evidence collection it is passed', () => {
    // The whole point of the split: varying Evidence must not move the label.
    const w = clone(sampleWork()) as Work;
    w.caseStudyPublished = false;
    for (const ev of [[], [evidenceRecord('EV-1')], [evidenceRecord('OTHER')]]) {
      w.evidence = ['EV-1'];
      assert.equal(workShowsCaseStudyCta(w), false, `evidence=${ev.length}`);
    }
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

  it('the works #7 added claim no Case Study', () => {
    const { works } = realContent();
    const added = ['ins-ai', 'hire', 'assist', 'ops', 'minio', 'docai', 'agri'];
    for (const slug of added) {
      const w = works.find((x) => x.slug === slug);
      assert.ok(w, `${slug} が無い`);
      assert.equal(workShowsCaseStudyCta(w), false, `${slug} が Case Study を主張している`);
    }
  });
});
