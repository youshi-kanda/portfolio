/**
 * THE WAYFINDING CONTRACT.
 *
 * What this exists to stop, stated as it was measured on the built artifact
 * before the change:
 *
 *   - `/work/` and `/how-i-build/` each had ONE inbound link on the whole site,
 *     the homepage's. From inside a work, neither was reachable.
 *   - `aria-current="page"` was emitted on seven pages, on a link whose href
 *     was `/#work` — three kinds of page each claiming to be a fourth.
 *   - the Technical page's only route to its parent lived inside the Links
 *     section, under `has('t8')`.
 *
 * None of the three was visible to any other gate on this repository. Nothing
 * was dead, nothing was broken, and the site simply could not be got out of.
 *
 * Everything here runs against the pure derivations rather than a rendered
 * page, so the shapes are exercised at every depth without a work record, a
 * server or a browser. The artifact-level half of the contract — one
 * `aria-current` per page, and on a link only when the href IS the page — is in
 * `scripts/check-links.ts`, because it is a statement about emitted HTML.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ARCHIVE_HREF,
  METHOD_HREF,
  contactHref,
  siteNavItems,
  workCrumbs,
  workHref,
  technicalHref,
} from '../src/lib/content/derive.ts';
import { site } from '../src/lib/content/site.ts';
import { ui } from '../src/lib/content/ui.ts';

describe('site-level navigation', () => {
  it('names routes, not homepage sections', () => {
    const hrefs = siteNavItems('/work/').map((i) => i.href);
    assert.deepEqual(hrefs, [ARCHIVE_HREF, METHOD_HREF, contactHref()]);
  });

  it('offers the archive, which the section nav never could', () => {
    // `site.sections` is the homepage's running order and every entry in it is
    // a BAND. `/work/` is a page, so no derivation over that list can produce
    // it — which is the whole reason this second list exists.
    assert.equal(
      site.sections.some((s) => s.anchor === ARCHIVE_HREF),
      false,
      '/work/ が site.sections から出るなら、この関数は要らない',
    );
    assert.ok(siteNavItems('/work/crm/').some((i) => i.href === ARCHIVE_HREF));
  });

  it('writes no label of its own — every one is already approved elsewhere', () => {
    const labels = siteNavItems(null).map((i) => i.label);
    assert.deepEqual(labels, [
      ui.register.pageTitle,
      site.howIBuild.railLabels[0],
      site.sections.find((s) => s.id === 'contact')?.label,
    ]);
  });

  it('marks the archive as the page only when the archive IS the page', () => {
    const at = (p: string) => siteNavItems(p).find((i) => i.key === 'work')!;
    assert.equal(at('/work/').isCurrentPage, true);
    assert.equal(at('/work/').isSection, false);
  });

  it('marks a descendant as a section and NOT as the page', () => {
    // The defect, exactly: /work/crm/ used to emit aria-current="page" on a
    // link that was not /work/crm/.
    for (const path of ['/work/crm/', '/work/crm/technical/']) {
      const work = siteNavItems(path).find((i) => i.key === 'work')!;
      assert.equal(work.isCurrentPage, false, `${path} は /work/ ではない`);
      assert.equal(work.isSection, true, `${path} は /work/ の配下`);
    }
  });

  it('marks the method page when it is the page', () => {
    const method = siteNavItems(METHOD_HREF).find((i) => i.key === 'method')!;
    assert.equal(method.isCurrentPage, true);
  });

  it('never marks CONTACT at all, because an anchor is not a page', () => {
    for (const path of ['/work/', '/work/crm/', METHOD_HREF, '/', '/nope/']) {
      const contact = siteNavItems(path).find((i) => i.key === 'contact')!;
      assert.equal(contact.isCurrentPage, false);
      assert.equal(contact.isSection, false);
    }
  });

  it('marks nothing on a page that is under nothing — the 404', () => {
    // The error document is served under whatever address was typed, so it is
    // not at a route and may not claim one.
    for (const item of siteNavItems('/404.html')) {
      assert.equal(item.isCurrentPage, false);
      assert.equal(item.isSection, false);
    }
  });

  it('does not care whether the caller kept the trailing slash', () => {
    assert.equal(siteNavItems('/work').find((i) => i.key === 'work')!.isCurrentPage, true);
  });

  it('never marks more than one entry as the page, at any route', () => {
    const routes = ['/', '/work/', '/work/crm/', '/work/crm/technical/', METHOD_HREF, '/404.html'];
    for (const path of routes) {
      const marked = siteNavItems(path).filter((i) => i.isCurrentPage);
      assert.ok(marked.length <= 1, `${path} が ${marked.length} 個を current にしている`);
    }
  });

  it('numbers from 01 in order', () => {
    assert.deepEqual(siteNavItems(null).map((i) => i.index), ['01', '02', '03']);
  });

  it('addresses CONTACT as a homepage anchor, never a bare fragment', () => {
    // A bare `#contact` on /work/crm/ is a fragment that is not on the current
    // document — a dead link, not a shortcut.
    assert.ok(contactHref().startsWith('/'));
    assert.equal(contactHref(), `/${site.sections.find((s) => s.id === 'contact')!.anchor}`);
  });
});

describe('breadcrumb', () => {
  const ARCHIVE = ui.register.pageTitle;
  const TECH = ui.technical.railLabels[0] as string;

  it('roots at the archive and ends on the work', () => {
    const trail = workCrumbs(ARCHIVE, 'AI CRM Demo', 'crm');
    assert.deepEqual(trail, [
      { label: ARCHIVE, href: ARCHIVE_HREF },
      { label: 'AI CRM Demo', href: null },
    ]);
  });

  it('adds the technical level with the work made a link', () => {
    const trail = workCrumbs(ARCHIVE, 'AI CRM Demo', 'crm', TECH);
    assert.deepEqual(trail, [
      { label: ARCHIVE, href: ARCHIVE_HREF },
      { label: 'AI CRM Demo', href: workHref('crm', false) },
      { label: TECH, href: null },
    ]);
  });

  it('never links the last crumb', () => {
    // A link to the page you are already on is a control that does nothing,
    // and on a long Case Study it looks like the way out.
    for (const trail of [
      workCrumbs(ARCHIVE, 'x', 'x'),
      workCrumbs(ARCHIVE, 'x', 'x', TECH),
    ]) {
      assert.equal(trail.at(-1)!.href, null);
      assert.ok(trail.slice(0, -1).every((c) => c.href !== null));
    }
  });

  it('is not rooted at the homepage', () => {
    // The masthead is the way home and is on every page already. Spending the
    // trail's shortest, most-scanned slot on it would say nothing.
    assert.ok(workCrumbs(ARCHIVE, 'x', 'x', TECH).every((c) => c.href !== '/'));
  });

  it('points every intermediate crumb at a route the site emits', () => {
    const trail = workCrumbs(ARCHIVE, 'AI CRM Demo', 'crm', TECH);
    const hrefs = trail.flatMap((c) => (c.href ? [c.href] : []));
    assert.deepEqual(hrefs, [ARCHIVE_HREF, '/work/crm/']);
    assert.ok(hrefs.every((h) => h.startsWith('/') && h.endsWith('/')));
  });
});

describe('return navigation does not depend on page content', () => {
  /*
   * The Technical page's return link used to render under `has('t8')` — the
   * Links section. A work whose Case Study cites no source links would have
   * shipped a page with no route to its parent at all, latent today only
   * because all three published works happen to cite some.
   *
   * These assert the ROUTES exist and are distinct; that the band renders them
   * outside every section is held by the page's own markup and by check-links
   * finding the hrefs on every emitted page.
   */
  it('gives a work page a route up and a route onward that are different pages', () => {
    const up = ARCHIVE_HREF;
    const down = technicalHref('crm');
    assert.notEqual(up, down);
    assert.equal(down, '/work/crm/technical/');
  });

  it('gives the technical page a route to its own parent, not to the archive alone', () => {
    assert.equal(workHref('crm', false), '/work/crm/');
    assert.notEqual(workHref('crm', false), ARCHIVE_HREF);
  });

  it('has a label for the parent that names it', () => {
    // 「戻る」 alone does not say where to. The work names itself in the link.
    assert.match(ui.work.backToWork, /\{title\}/);
  });

  it('labels the way out as a return, not as the homepage CTA', () => {
    // `register.allWorksCta` is a FORWARD move from the homepage.
    assert.notEqual(ui.work.backToIndex, ui.register.allWorksCta);
  });

  it('reaches CONTACT from inside a work without a label written for it', () => {
    // Below 768px the masthead's route list is display:none, so the band is the
    // only route to CONTACT from inside a work. The label is the homepage
    // band's own.
    const contact = site.sections.find((s) => s.id === 'contact');
    assert.ok(contact?.label);
    assert.equal(siteNavItems(null).find((i) => i.key === 'contact')!.label, contact!.label);
  });
});

describe('rail index — digits are homepage sections, letters are page types', () => {
  it('gives the Case Study a letter, not the hero index it used to share', () => {
    assert.equal(ui.caseStudy.railIndex, 'C');
    assert.notEqual(ui.caseStudy.railIndex, '00');
  });

  it('keeps C / T / M distinct', () => {
    const letters = [ui.caseStudy.railIndex, 'T', 'M'];
    assert.equal(new Set(letters).size, 3);
    assert.ok(letters.every((l) => /^[A-Z]$/.test(l)));
  });
});
