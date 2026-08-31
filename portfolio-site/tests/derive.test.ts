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
  heroCapability,
  heroLede,
  navItems,
  shippingWorks,
  workHref,
} from '../src/lib/content/derive.ts';
import { loadEvidence } from '../src/lib/content/load.ts';
import { site } from '../src/lib/content/site.ts';
import { clone, nWorks, realContent } from './helpers.ts';

describe('homepage derivation at 0 / 1 / 3 works', () => {
  it('renders a hero lede at every count, and never a stale number', () => {
    assert.equal(heroLede(0), site.derived.heroLede.empty);
    assert.match(heroLede(1), /1 つの動くデモ/);
    assert.match(heroLede(3), /3 つの動くデモ/);
    assert.match(heroLede(20), /20 つの動くデモ/);
  });

  it('quotes real test counts while they fit the rail, and summarises after', () => {
    const zero = heroCapability([]);
    assert.equal(zero.at(-1)?.value, site.derived.capabilityVerify.empty);

    const three = heroCapability(nWorks(3));
    assert.match(three.at(-1)!.value, /484\/77\/157/);
    assert.equal(three.length, site.hero.capability.length + 1);

    // past the limit the rail stops listing per-work counts and totals them
    // instead — 200px cannot carry twenty of them
    const many = heroCapability(nWorks(6));
    assert.match(many.at(-1)!.value, /6 作品/);
    assert.match(many.at(-1)!.value, /1436 tests/);
    assert.doesNotMatch(many.at(-1)!.value, /484\/77\/157/);
  });

  it('drops 05 FEATURED EVIDENCE — and its nav anchor — at zero works', () => {
    const evidence = loadEvidence();
    assert.equal(featuredEvidence([], evidence), null);

    const withoutWorks = navItems(false).map((n) => n.href);
    assert.equal(withoutWorks.includes('#evidence'), false);

    const withWorks = navItems(true).map((n) => n.href);
    assert.equal(withWorks.includes('#evidence'), true);
  });

  it('never offers a nav anchor for a section that is not on the page', () => {
    // every anchor the nav can emit is one the homepage renders
    const alwaysPresent = ['#work', '#build', '#stack', '#principles', '#about'];
    assert.deepEqual(
      navItems(false).map((n) => n.href),
      alwaysPresent,
    );
    assert.deepEqual(
      navItems(true).map((n) => n.href),
      ['#work', '#build', '#stack', '#principles', '#evidence', '#about'],
    );
  });

  it('rewrites section anchors to the homepage when the nav is not on it', () => {
    // /work/ and /work/<slug>/ carry the same nav but none of those sections.
    // A bare "#build" there resolves to nothing — this is the dead-anchor
    // defect the browser probe caught.
    const offHome = navItems(true, false).map((n) => n.href);
    assert.deepEqual(offHome, ['/#work', '/#build', '/#stack', '/#principles', '/#evidence', '/#about']);
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
    // list rather than keeping the stale screenshot it was just showing
    const reordered = shippingWorks(works).slice(1);
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
    assert.deepEqual(order, ['crm', 'ppm', 'dfe']);
  });

  it('links in-page on the homepage and by permalink everywhere else', () => {
    assert.equal(workHref('crm', true), '#w-crm');
    assert.equal(workHref('crm', false), '/work/crm/');
  });

  it('keeps 1 work and 3 works on the same code path', () => {
    for (const n of [0, 1, 3]) {
      const works = nWorks(n);
      assert.equal(shippingWorks(works).length, n);
      assert.equal(typeof heroLede(n), 'string');
      assert.equal(heroCapability(works).length, site.hero.capability.length + 1);
    }
  });
});
