/**
 * The homepage at 0, 1 and 3 works — with no component change between them.
 *
 * These are pure functions, so the counts can be exercised without rendering.
 * What they pin down is that nothing on the page carries a literal count and
 * that no section survives the disappearance of the data it describes.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  brandHref,
  featuredEvidence,
  navItems,
  sectionNumber,
  shippingWorks,
  workHref,
} from '../src/lib/content/derive.ts';
import { loadEvidence } from '../src/lib/content/load.ts';
import { site } from '../src/lib/content/site.ts';
import { clone, nWorks, realContent } from './helpers.ts';

describe('homepage derivation at 0 / 1 / 3 works', () => {
  // The hero lede and the capability rail used to be computed here, because
  // both stated a count. V4 states neither, so both are registry copy now and
  // are covered by the approval gate (`tests/approved-copy.test.ts`) instead.

  it('has nothing to feature at zero works', () => {
    // 05 FEATURED EVIDENCE left the homepage in Phase 4 and the component did
    // not: it still refuses to name a work when there is none to name, which
    // is what makes it safe to place anywhere Phase 5 decides to put it.
    assert.equal(featuredEvidence([], loadEvidence()), null);
  });

  it('never offers a nav anchor for a section that is not on the page', () => {
    // Every anchor the nav can emit is one the homepage renders. #7's running
    // order is seven sections and offers five: the intro is reached by the
    // masthead and the footer is the page's own foot.
    const withWorks = ['#work', '#more', '#capabilities', '#about', '#contact'];
    assert.deepEqual(navItems(true).map((n) => n.href), withWorks);
    // 01 and 02 both depend on the work list, so at zero works the nav drops
    // them rather than offering an anchor to a section that is not drawn.
    assert.deepEqual(
      navItems(false).map((n) => n.href),
      ['#capabilities', '#about', '#contact'],
    );
  });

  it('drops a nav entry whose section needs works, when there are none', () => {
    const needy = site.sections.filter((s) => s.needsWorks && s.label !== null);
    for (const s of needy) {
      assert.equal(navItems(false).some((n) => n.href === s.anchor), false);
      assert.equal(navItems(true).some((n) => n.href === s.anchor), true);
    }
  });

  it('numbers sections by their place in the running order', () => {
    // The number is derived, so this reads the order rather than restating it:
    // a section's index IS its position, whatever the order becomes.
    site.sections.forEach((s, i) => {
      assert.equal(sectionNumber(s.id), String(i).padStart(2, '0'));
    });
    assert.throws(() => sectionNumber('not-a-section'), /site\.sections/);
  });

  it('rewrites section anchors to the homepage when the nav is not on it', () => {
    // /work/ and /work/<slug>/ carry the same nav but none of those sections.
    // A bare "#build" there resolves to nothing — this is the dead-anchor
    // defect the browser probe caught.
    const offHome = navItems(true, false).map((n) => n.href);
    assert.deepEqual(offHome, ['/#work', '/#more', '/#capabilities', '/#about', '/#contact']);
    for (const href of offHome) assert.equal(href.startsWith('#'), false);
  });

  it('points the masthead at this page on the homepage, and at / elsewhere', () => {
    assert.equal(brandHref(true), '#top');
    assert.equal(brandHref(false), '/');
  });

  it('picks the featured Evidence from the data, not from a hard-coded CRM id', () => {
    const { works, evidence } = realContent();
    const featured = featuredEvidence(works, evidence);
    assert.ok(featured);
    assert.equal(featured.evidence.id, site.evidenceSection.featured);

    // drop the work that owns the declared pick, and the section follows the
    // list rather than keeping the stale screenshot it was just showing.
    // Only works WITH evidence can be picked, so the list is narrowed to those
    // first — #7 added seven works that carry none, and slicing the full list
    // would only have removed a work that was never a candidate.
    const withEvidence = shippingWorks(works).filter((w) => w.evidence.length > 0);
    const reordered = withEvidence.slice(1);
    const next = featuredEvidence(reordered, evidence);
    assert.ok(next);
    assert.equal(next.work.slug, reordered[0]!.slug);
    assert.notEqual(next.evidence.id, site.evidenceSection.featured);
  });

  it('features only Evidence whose provenance is established', () => {
    const { works, evidence } = realContent();
    const complete = evidence.filter((e) => e.provenanceComplete).map((e) => e.id);
    const featured = featuredEvidence(works, evidence);
    assert.ok(featured);
    assert.equal(complete.includes(featured.evidence.id), true);
  });

  it('features nothing when no record has provenance yet', () => {
    // The full component prints a SHA256 heading. A record whose hash is 未取得
    // must not reach it — showing an absence under that heading presents the
    // absence as a record. Keyed on the flag, not on whichever id happens to
    // be incomplete this week.
    const { works, evidence } = realContent();
    const pending = evidence.map((e) => ({ ...clone(e), provenanceComplete: false }));
    assert.equal(featuredEvidence(works, pending), null);
  });

  it('orders works by featuredOrder, not by collection order', () => {
    const { works } = realContent();
    const order = shippingWorks(works).map((w) => w.slug);
    assert.deepEqual(order, [
      'ins-ai', 'hire', 'assist', 'ops', 'crm',   // 01 FEATURED WORK
      'ppm', 'minio', 'docai', 'agri',            // 02 MORE PROJECTS
      'dfe',                                      // archive only
    ]);
  });

  it('links in-page on the homepage and by permalink everywhere else', () => {
    assert.equal(workHref('crm', true), '#w-crm');
    assert.equal(workHref('crm', false), '/work/crm/');
  });

  it('keeps 1 work and 3 works on the same code path', () => {
    for (const n of [0, 1, 3]) {
      assert.equal(shippingWorks(nWorks(n)).length, n);
    }
  });
});
