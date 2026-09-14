/**
 * Wayfinding — #11.
 *
 * The defect these exist to prevent is not a broken link; `check-links` finds
 * those. It is a page that resolves perfectly and still leaves a reader with no
 * way up: `/work/<slug>/` had a working nav, a working footer and zero links to
 * the archive, and every gate on this repository passed. So what is pinned here
 * is REACHABILITY and TRUTHFULNESS — that the trail exists at every depth, that
 * it is derived rather than typed, and that `aria-current` names the page it is
 * on and no other.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ARCHIVE_HREF,
  METHOD_HREF,
  SITE_NAV_KEYS,
  shippingWorks,
  siteNavItems,
  technicalHref,
  workCrumbs,
  workHasFigure,
  workHasOverview,
  workHasTechnical,
  workHref,
  workShowsCaseStudyCta,
} from '../src/lib/content/derive.ts';
import type { Work } from '../src/lib/content/schema.ts';
import { publicRoutes } from '../src/lib/content/routes.ts';
import { site } from '../src/lib/content/site.ts';
import { ui } from '../src/lib/content/ui.ts';
import { realContent } from './helpers.ts';

describe('site-level navigation', () => {
  it('names routes, not homepage sections', () => {
    const hrefs = siteNavItems().map((i) => i.href);
    assert.deepEqual(hrefs, [ARCHIVE_HREF, METHOD_HREF, '/#contact']);
  });

  it('offers the archive, which the section nav never could', () => {
    // The whole reason this list exists. `site.sections` holds bands of the
    // homepage, and `/work/` is not one — so no derivation over that list can
    // ever produce a link to it.
    assert.ok(!site.sections.some((s) => s.anchor === ARCHIVE_HREF));
    assert.ok(siteNavItems().some((i) => i.href === ARCHIVE_HREF));
  });

  it('writes no label of its own — every one is already approved elsewhere', () => {
    const labels = siteNavItems().map((i) => i.label);
    const approvedElsewhere = [
      ui.register.railLabels[0],
      site.howIBuild.railLabels[0],
      site.sections.find((s) => s.id === 'contact')?.label,
    ];
    assert.deepEqual(labels, approvedElsewhere);
  });

  it('marks the archive as the page only when the archive IS the page', () => {
    const work = siteNavItems(ARCHIVE_HREF).find((i) => i.key === 'work');
    assert.equal(work?.isCurrentPage, true);
    assert.equal(work?.isSection, false);
    assert.equal(siteNavItems(ARCHIVE_HREF).filter((i) => i.isCurrentPage).length, 1);
  });

  it('marks a descendant as a section and NOT as the page', () => {
    // The regression this file exists for. `/work/crm/` lives under the
    // archive without being it, and the first cut of the API — a `section`
    // key each page passed about itself — had every work page claiming
    // `aria-current="page"` on a link to `/work/`, which is the exact defect
    // #11 was opened on.
    for (const path of ['/work/crm/', '/work/ppm/technical/']) {
      const item = siteNavItems(path).find((i) => i.key === 'work');
      assert.equal(item?.isSection, true, path);
      assert.equal(item?.isCurrentPage, false, path);
      assert.equal(siteNavItems(path).filter((i) => i.isCurrentPage).length, 0, path);
    }
  });

  it('marks the method page when it is the page', () => {
    const m = siteNavItems(METHOD_HREF).find((i) => i.key === 'method');
    assert.equal(m?.isCurrentPage, true);
  });

  it('never marks CONTACT at all, because an anchor is not a page', () => {
    for (const path of [null, '/', ARCHIVE_HREF, '/work/crm/', '/how-i-build/']) {
      const c = siteNavItems(path).find((i) => i.key === 'contact');
      assert.equal(c?.isCurrentPage, false, String(path));
      assert.equal(c?.isSection, false, String(path));
    }
  });

  it('marks nothing on a page that is under nothing — the 404', () => {
    for (const path of [null, '/404']) {
      assert.deepEqual(
        siteNavItems(path).filter((i) => i.isCurrentPage || i.isSection),
        [],
        String(path),
      );
    }
  });

  it('does not care whether the caller kept the trailing slash', () => {
    assert.deepEqual(siteNavItems('/work'), siteNavItems('/work/'));
  });

  it('never marks more than one entry as the page, at any route', () => {
    const { works, evidence, caseStudies } = realContent();
    for (const path of publicRoutes(works, evidence, caseStudies).paths) {
      assert.ok(siteNavItems(path).filter((i) => i.isCurrentPage).length <= 1, path);
    }
  });

  it('numbers from 01 in order', () => {
    assert.deepEqual(siteNavItems().map((i) => i.index), ['01', '02', '03']);
    assert.deepEqual(siteNavItems().map((i) => i.key), [...SITE_NAV_KEYS]);
  });
});

describe('breadcrumb', () => {
  const A = 'WORK INDEX';

  it('roots at the archive and ends on the work', () => {
    assert.deepEqual(workCrumbs(A, 'Project Progress Manager', 'ppm'), [
      { label: A, href: ARCHIVE_HREF },
      { label: 'Project Progress Manager', href: null },
    ]);
  });

  it('adds the technical level with the work made a link', () => {
    assert.deepEqual(workCrumbs(A, 'AI CRM Demo', 'crm', 'TECHNICAL'), [
      { label: A, href: ARCHIVE_HREF },
      { label: 'AI CRM Demo', href: workHref('crm', false) },
      { label: 'TECHNICAL', href: null },
    ]);
  });

  it('never links the last crumb', () => {
    for (const trail of [workCrumbs(A, 'x', 'x'), workCrumbs(A, 'x', 'x', 'T')]) {
      assert.equal(trail.at(-1)?.href, null);
      assert.equal(trail.slice(0, -1).every((c) => c.href !== null), true);
    }
  });

  it('points every intermediate crumb at a route the site emits', () => {
    const { works, evidence, caseStudies } = realContent();
    const emitted = new Set(publicRoutes(works, evidence, caseStudies).paths);
    for (const work of works.filter((w) => w.caseStudyPublished)) {
      const trail = workCrumbs(A, work.title, work.slug, 'TECHNICAL');
      for (const crumb of trail) {
        if (crumb.href) assert.ok(emitted.has(crumb.href), `${crumb.href} は emit されない`);
      }
    }
  });
});

describe('return navigation does not depend on page content', () => {
  /**
   * The Technical page's way back used to live inside its Links section, under
   * `has('t8')`. Every published work happens to cite links, so the defect was
   * invisible: the assertion is over the ROUTE set, not over the three records
   * that currently pass.
   */
  it('gives every emitted work page a route to the archive and vice versa', () => {
    const { works, evidence, caseStudies } = realContent();
    const emitted = publicRoutes(works, evidence, caseStudies).paths;

    for (const route of emitted.filter((p) => /^\/work\/[^/]+\/$/.test(p))) {
      const slug = route.split('/')[2] as string;
      // up: the archive. down: the technical page, when the site emits one.
      assert.ok(emitted.includes(ARCHIVE_HREF));
      const deeper = technicalHref(slug);
      if (emitted.includes(deeper)) {
        // the technical page's two returns both resolve
        assert.ok(emitted.includes(workHref(slug, false)));
      }
    }
  });

  it('has a label for the parent that names it', () => {
    // `作品一覧へ` would have been reusable and would have said the destination
    // without saying the direction. The distinction is the reason #11 asked for
    // two new strings rather than none.
    assert.ok(ui.work.backToIndex.includes('戻る'));
    assert.ok(ui.work.backToWork.includes('{title}'));
    assert.ok(ui.work.backToWork.includes('戻る'));
  });
});

/**
 * The Overview checkpoint's route contract.
 *
 * What broke before was not a link but an absence: seven of ten shipping works
 * had no page, because the route asked whether a SCREENSHOT was published in
 * order to decide whether a WORK was. Every gate passed — there was nothing
 * dead to find, only something missing.
 *
 * So these assert over the route SET and over the four questions being separate,
 * rather than over the three records that happen to be complete.
 */
describe('Overview route contract', () => {
  const content = () => realContent();

  it('gives every shipping work a page', () => {
    const { works, evidence, caseStudies } = content();
    const emitted = new Set(publicRoutes(works, evidence, caseStudies).paths);
    for (const w of shippingWorks(works)) {
      assert.equal(workHasOverview(w), true, w.slug);
      assert.ok(emitted.has(workHref(w.slug, false)), `${w.slug} の route が無い`);
    }
    assert.equal(shippingWorks(works).length, 10);
  });

  it('does not ask about Evidence — the regression, stated directly', () => {
    const { works } = content();
    const noEvidence = shippingWorks(works).filter((w) => w.evidence.length === 0);
    // seven works, none of which had a page before this checkpoint
    assert.equal(noEvidence.length, 7);
    for (const w of noEvidence) assert.equal(workHasOverview(w), true, w.slug);
  });

  it('does not ask about an image either', () => {
    const { works } = content();
    const noImage = shippingWorks(works).filter((w) => !workHasFigure(w));
    assert.deepEqual(noImage.map((w) => w.slug), ['minio', 'docai', 'agri']);
    for (const w of noImage) assert.equal(workHasOverview(w), true, w.slug);
  });

  it('keeps the four questions apart on the shipped content', () => {
    const { works, caseStudies } = content();
    const shipping = shippingWorks(works);
    const count = (f: (w: (typeof shipping)[number]) => boolean) => shipping.filter(f).length;

    assert.equal(count(workHasOverview), 10);
    assert.equal(count((w) => w.evidence.length > 0), 3);
    assert.equal(count(workShowsCaseStudyCta), 3);
    assert.equal(count((w) => workHasTechnical(w, caseStudies)), 3);
    // A figure is its own question again: four works have an image and no Evidence.
    assert.equal(count(workHasFigure), 7);
  });

  it('offers Technical only where Technical is emitted', () => {
    const { works, evidence, caseStudies } = content();
    const emitted = new Set(publicRoutes(works, evidence, caseStudies).paths);
    for (const w of shippingWorks(works)) {
      const claimed = workHasTechnical(w, caseStudies);
      assert.equal(claimed, emitted.has(technicalHref(w.slug)), w.slug);
    }
  });

  it('every archive row can link, because every row has somewhere to go', () => {
    // `Register` decides `linked` with this predicate; the structure contract
    // then counts the anchors in the built artifact.
    const { works } = content();
    assert.equal(shippingWorks(works).every(workHasOverview), true);
  });

  it('still refuses a work that is not published', () => {
    const { works } = content();
    const w = { ...(works[0] as Work), status: 'draft' as const };
    assert.equal(workHasOverview(w), false);
  });
});
