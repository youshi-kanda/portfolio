/**
 * The Truth Policy. Semantic rules — whether a claim may be published given
 * what is known about where it came from.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runGates } from '../src/lib/validation/index.ts';
import { truthGate } from '../src/lib/validation/truth.ts';
import {
  bundleWith,
  codes,
  exceptPendingApproval,
  pendingApprovalOnly,
  realContent,
  sampleWork,
} from './helpers.ts';

const run = (works: ReturnType<typeof sampleWork>[], mode: 'production' | 'development' = 'production') =>
  runGates(bundleWith(works), { mode });

describe('truth gate', () => {
  /*
   * WAS "passes the shipping content in production", AND NO LONGER DOES.
   *
   * #8 changed four public strings and has no approval event for them, so the
   * production build is blocked — correctly. Asserting `errors === []` here
   * would mean either faking the approvals or deleting the copy, so the test
   * now states the stronger thing it always meant: the ONLY thing standing
   * between this content and a production build is those four approvals.
   *
   * A fifth error of any kind still fails. When the owner approves the wording,
   * `pendingApprovalOnly` returns nothing and both lists are empty again.
   */
  it('is blocked in production by exactly the four pending approvals, and nothing else', () => {
    const result = runGates(realContent(), { mode: 'production' });
    assert.deepEqual(
      exceptPendingApproval(result.errors),
      [],
      JSON.stringify(exceptPendingApproval(result.errors), null, 2),
    );
    assert.equal(pendingApprovalOnly(result.errors).length, 4);
    // The build does NOT pass, and the suite says so out loud.
    assert.equal(result.ok, false);
  });

  it('fails a shipping work that is not approved', () => {
    const w = sampleWork();
    w.publication.reviewStatus = 'in_review';
    const result = run([w]);
    assert.equal(result.ok, false);
    assert.equal(codes(result.errors).includes('T-UNAPPROVED'), true);
  });

  it('passes an approved shipping work', () => {
    const w = sampleWork();
    w.publication.reviewStatus = 'approved';
    assert.deepEqual(
      exceptPendingApproval(run([w]).errors).filter((e) => e.code === 'T-UNAPPROVED'),
      [],
    );
  });

  it('does not fail an unapproved work that is not shipping', () => {
    const w = sampleWork();
    w.publication.reviewStatus = 'draft';
    w.shipping = false;
    // shippingWorks() drops it from the page entirely, so it cannot ship
    // unreviewed copy — and runGates only gates what renders
    const result = runGates(bundleWith([w]), { mode: 'production' });
    assert.deepEqual(
      result.errors.filter((e) => e.code === 'T-UNAPPROVED' && e.message.includes(w.slug)),
      [],
    );
  });

  it('fails source-derived content with no cited source', () => {
    const w = sampleWork();
    w.publication.sourceType = 'source-derived';
    w.publication.sourceRefs = [];
    assert.equal(codes(run([w]).errors).includes('T-NO-SOURCE'), true);
  });

  it('fails an empty user-fact', () => {
    const findings = truthGate({
      works: [],
      evidence: [],
      copy: [
        {
          id: 'home.footer.contact',
          text: '   ',
          route: '/',
          section: '07 CONTACT',
          slot: '連絡先',
          purpose: 'test',
          publication: {
            reviewStatus: 'approved',
            sourceType: 'user-fact',
            claimType: 'fact',
            sourceRefs: [],
            approvedBy: 'user',
            approvedAt: '2026-08-28T21:20:25Z',
          },
        },
      ],
      mode: 'production',
    });
    assert.equal(codes(findings).includes('T-EMPTY-FACT'), true);
  });

  it('fails authored copy approved without an approver or a date', () => {
    const { works, evidence, copy } = realContent();
    const broken = structuredClone(copy);
    broken[0]!.publication.approvedBy = null;
    const findings = truthGate({ works, evidence, copy: broken, mode: 'production' });
    assert.equal(codes(findings).includes('T-NO-APPROVER'), true);
  });

  it('fails a work pointing at an Evidence record that does not exist', () => {
    const w = sampleWork();
    w.evidence = ['CRM-V99'];
    assert.equal(codes(run([w]).errors).includes('T-DEAD-REF'), true);
  });

  it('reports rather than fails in development', () => {
    // the real content, with one work knocked back to draft — so the only
    // thing that differs between the two modes is the pending review
    const content = realContent();
    content.works[0]!.publication.reviewStatus = 'draft';

    const dev = runGates(content, { mode: 'development' });
    assert.equal(dev.ok, true, 'development build shows pending content');
    assert.equal(codes(dev.warnings).includes('T-UNAPPROVED'), true);

    const prod = runGates(content, { mode: 'production' });
    assert.equal(prod.ok, false);
    assert.equal(codes(prod.errors).includes('T-UNAPPROVED'), true);
  });

  it('holds approved-copy drift to an error in every mode', () => {
    // Development leniency is about *pending* content — content that has not
    // been reviewed yet. A string that no longer matches its own approval is a
    // different thing: the record is wrong, and it is wrong in dev too.
    const content = realContent();
    content.copy[0]!.text = `${content.copy[0]!.text}（改）`;
    for (const mode of ['production', 'development'] as const) {
      assert.equal(codes(runGates(content, { mode }).errors).includes('A-CHANGED'), true);
    }
  });
});
