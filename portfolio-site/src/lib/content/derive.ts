/**
 * Everything the homepage computes from the work list instead of storing.
 *
 * The rule these functions exist to enforce: no literal count is ever typed
 * into copy or markup. A hard-coded "3" in a heading is a defect that only
 * shows up the day a fourth work lands — and by then the page is lying.
 *
 * The hero used to compute two of its strings here, and no longer does. V4
 * rewrote both so that neither states a count: the lede says what this engineer
 * designs rather than how many demos are published, and the capability rail
 * names three capabilities rather than quoting per-work test counts. A sentence
 * that does not depend on the work list has nothing to derive — it is authored
 * copy, and it belongs in the registry where an approval covers it.
 *
 * All of it is pure. The components read it, and the tests exercise it at
 * 0, 1 and 3 works without rendering anything.
 */
import type { Work, CaseStudy, Evidence } from './schema.ts';
import { site } from './site.ts';
import { ui } from './ui.ts';

/** featuredOrder is the running order; the collection's own order is not stable. */
export function orderWorks(works: readonly Work[]): Work[] {
  return [...works].sort((a, b) => a.featuredOrder - b.featuredOrder);
}

export function shippingWorks(works: readonly Work[]): Work[] {
  return orderWorks(works.filter((w) => w.shipping && w.status === 'published'));
}

/**
 * The works the Editorial Band draws from.
 *
 * `featured` is an editorial decision and `shipping` is a publication one, and
 * a work needs both: promoting something the site does not publish would put a
 * panel in front of a page that is not there.
 */
export function featuredWorks(works: readonly Work[]): Work[] {
  return shippingWorks(works).filter((w) => w.featured);
}

/**
 * The one entry the homepage leads with, or none.
 *
 * `T-MULTI-LEAD` has already refused more than one by the time anything renders,
 * so taking the first is not a tie-break — there is no tie to break.
 */
export function leadWork(works: readonly Work[]): Work | null {
  return shippingWorks(works).find((w) => w.homepageRole === 'lead') ?? null;
}

/**
 * The entry figure of a work that is being rendered.
 *
 * `image` is optional on the record and required by the schema of exactly the
 * works that are DRAWN with one — featured blocks, and works whose Evidence
 * resolves and so get an entry screen at /work/<slug>/. That is the same set
 * every caller here draws from, which is what makes this total.
 *
 * #7 narrowed that rule from `shipping`: a MORE PROJECTS row and an
 * archive-only work both ship and neither has anywhere to put a figure. So
 * reaching this throw now means a figure-less work was handed to a renderer
 * that draws one — a routing defect, not a missing image.
 */
export function workFigure(work: Work): NonNullable<Work['image']> {
  if (!work.image) {
    throw new Error(
      `work/${work.slug} に image が無いのに描画された。` +
        `図版付きで描画されるのは featured か Evidence を持つ作品だけで、` +
        `その場合 image は schema が要求する。`,
    );
  }
  return work.image;
}

/**
 * How a work being rendered is drawn.
 *
 * `visual` is still required of every SHIPPING work, not narrowed the way
 * `image` was. A pigment and a variant are assigned when a work is prepared
 * for the page, and every shipping work is on a page — the archive draws the
 * ones the homepage does not.
 */
export function workVisual(work: Work): NonNullable<Work['visual']> {
  if (!work.visual) {
    throw new Error(
      `work/${work.slug} に visual が無いのに描画された。` +
        `描画されるのは shipping の作品だけで、shipping なら visual は schema が要求する。`,
    );
  }
  return work.visual;
}

/**
 * 05 FEATURED EVIDENCE follows the work list rather than naming a work in the
 * markup. With no works there is nothing to feature and the section — and its
 * nav anchor — are dropped rather than left pointing at nothing.
 *
 * Only a record with established provenance can be featured: the featured slot
 * renders the full Evidence component, provenance expander included.
 */
export function featuredEvidence(
  works: readonly Work[],
  evidence: readonly Evidence[],
): { work: Work; evidence: Evidence } | null {
  const ordered = shippingWorks(works);
  if (ordered.length === 0) return null;
  const byId = new Map(evidence.map((e) => [e.id, e]));

  const preferred = site.evidenceSection.featured;
  for (const w of ordered) {
    for (const id of w.evidence) {
      const e = byId.get(id);
      if (!e || !e.provenanceComplete) continue;
      // the section's declared pick wins when the work that owns it is present
      if (id === preferred) return { work: w, evidence: e };
    }
  }
  for (const w of ordered) {
    for (const id of w.evidence) {
      const e = byId.get(id);
      if (e?.provenanceComplete) return { work: w, evidence: e };
    }
  }
  return null;
}

/**
 * Whether `/work/<slug>/` is actually emitted for this work.
 *
 * Restates the page's own `getStaticPaths`: the route exists exactly when the
 * work's first Evidence id resolves to a record. A row that links without
 * asking this is a dead link the moment a work ships before its Evidence does
 * — which is the state every work added by #7 is in, deliberately, because
 * their Case Studies belong to #8.
 *
 * The alternative — linking anyway and letting `check:links` catch it — moves
 * the decision from the component that knows the answer to a script that finds
 * out afterwards.
 */
export function workHasDetailPage(
  work: Work,
  evidence: readonly Evidence[],
): boolean {
  const first = work.evidence[0];
  if (!first) return false;
  return evidence.some((e) => e.id === first);
}

/**
 * Whether anything may render the words "Case Study" for this work.
 *
 * ONE FIELD, AND DELIBERATELY NOT THE OTHER. `caseStudyPublished` is the whole
 * condition — the same one `EntryCta` has always used. `workHasDetailPage` asks
 * a different question, and #7 first wrote the gallery and the register against
 * that one because for the three works shipping at the time the two answers
 * happened to coincide.
 *
 * They are not the same question. A work whose Evidence resolves gets a page at
 * /work/<slug>/ whether or not its Case Study body exists — the route renders
 * the entry screen either way, on purpose, so a work is reachable from the
 * moment its facts are sourced. Labelling that link "Case Study を読む" would
 * promise CS-1…CS-16 and deliver the entry screen.
 *
 * So: this decides the LABEL. `workHasDetailPage` decides whether a row is a
 * link at all. Keeping them in two functions is what stops the coincidence
 * from being rediscovered as a rule.
 */
export const workShowsCaseStudyCta = (work: Work): boolean => work.caseStudyPublished;

/**
 * The technologies the page shows for a work, in the order the record states.
 *
 * `selectedTech` is the editorial pick (4–6, spec §5.0); `languages` is what
 * the code is written in. A V3 record has only the second, so it answers with
 * that rather than showing nothing — the fallback is what lets the field be
 * added to ten records one at a time instead of all at once.
 */
export const workSelectedTech = (work: Work): readonly string[] =>
  work.selectedTech.length > 0 ? work.selectedTech : work.languages;

/**
 * The homepage tiers. `featured` and `more` are disjoint by schema refinement,
 * and a shipping work in neither is archive-only — reachable from /work/ and
 * from nowhere else, which is where `dfe` now lives.
 */
export const featuredHomepageWorks = (works: readonly Work[]): Work[] =>
  shippingWorks(works).filter((w) => w.homepage === 'featured');

export const moreHomepageWorks = (works: readonly Work[]): Work[] =>
  shippingWorks(works).filter((w) => w.homepage === 'more');

/**
 * A section's displayed number: its position in the running order.
 *
 * The number is derived and never stored, which is the whole point. V3 wrote
 * `00`–`07` onto the sections and `01`–`06` onto their nav entries, so moving a
 * section meant renumbering it, renumbering everything after it, and doing the
 * same again in the nav — two lists that had to agree and no check that they
 * did. Here the order IS the numbering; `site.sections` is the one place a
 * section's place is stated.
 *
 * Unknown ids throw. A section asking for its own number and not being in the
 * running order is a page rendering something the site does not list, which
 * would otherwise show up as a silent `undefined` in the rail.
 */
export function sectionNumber(id: string): string {
  const at = site.sections.findIndex((s) => s.id === id);
  if (at < 0) {
    throw new Error(
      `site.sections に節 ${id} が無い。` +
        `番号は order から導出するので、順序に載っていない節には番号が無い。`,
    );
  }
  return pad2(at);
}

export interface NavItem {
  index: string;
  label: string;
  href: string;
}

/**
 * The nav only offers sections this page actually contains.
 *
 * Two ways an entry can go dead, and both are handled here:
 *
 *   1. the section is not on ANY page — 05 FEATURED EVIDENCE at zero works.
 *      The entry is dropped.
 *   2. the section is on the homepage but not on THIS one. The nav sits on
 *      /work/ and /work/<slug>/ too, where `#build` resolves to nothing, so
 *      off the homepage every section anchor is rewritten to `/#build`.
 *
 * The second case is the defect the prototype's own nav carried: it emitted
 * the same six fragments on every screen. A fragment that is not on the
 * current document is a dead link, not a shortcut.
 */
export function navItems(hasWorks: boolean, onHomepage = true): NavItem[] {
  return site.sections
    .filter((s) => s.label !== null && (!s.needsWorks || hasWorks))
    .map((s) => ({
      index: sectionNumber(s.id),
      label: s.label as string,
      href: onHomepage || !s.anchor.startsWith('#') ? s.anchor : `/${s.anchor}`,
    }));
}

/** The masthead returns to the top of this page, or to the homepage. */
export const brandHref = (onHomepage: boolean): string => (onHomepage ? '#top' : '/');

/**
 * The two routes that are pages rather than sections of one.
 *
 * They were written as literals in three places — `routes.ts`'s path list,
 * `MoreProjects`'s archive link, and nothing at all on the subpages, which is
 * the defect #11 opened on. A route named in several files is a route that can
 * be renamed in some of them.
 */
export const ARCHIVE_HREF = '/work/';
export const METHOD_HREF = '/how-i-build/';

/**
 * The site-level navigation — #11 §1.
 *
 * WHY THIS EXISTS AT ALL. `navItems` above is the homepage's TABLE OF CONTENTS:
 * `site.sections` is one list doing three jobs (the running order, the
 * numbering, the nav), and every entry in it is a band of the homepage. Off the
 * homepage that list was still what the masthead drew, with the anchors
 * rewritten to `/#work` — so every subpage carried the contents of a document
 * the reader was not reading, and carried no way to the page above it.
 *
 * Two consequences, both of which #11 measured on the built artifact:
 *
 *   - `/work/` had exactly one inbound link on the whole site (the homepage's
 *     02 MORE PROJECTS). From a work page, the archive was unreachable.
 *   - `01 WORK` was marked `aria-current="page"` on three different pages, on
 *     a link pointing at `/#work` — a page that is none of them.
 *
 * So a subpage now names ROUTES. Three of them, which is all this site has:
 * the archive, the method page, and the way to make contact — and that last one
 * is still an anchor, because CONTACT is a band of the homepage and pretending
 * otherwise would be inventing a page to make the list tidy.
 *
 * NO STRING HERE IS NEW. Each label is already registered and approved
 * somewhere else on the site, and is read from there rather than retyped:
 * rewording the archive's own name in one place should not leave the nav
 * calling it something else.
 */
export const SITE_NAV_KEYS = ['work', 'method', 'contact'] as const;
export type SiteNavKey = (typeof SITE_NAV_KEYS)[number];

export interface SiteNavItem extends NavItem {
  key: SiteNavKey;
  /**
   * Whether this entry names the page being rendered — `aria-current="page"`
   * territory, and nothing else gets it.
   */
  isCurrentPage: boolean;
  /**
   * Whether the page being rendered lives UNDER this entry. `/work/crm/` is
   * inside the archive's branch without being the archive.
   *
   * Kept apart from `isCurrentPage` on purpose. Both draw the same underline,
   * and V3 expressed both with `aria-current="page"` — which is how three
   * pages came to claim to be `/#work`. `aria-current` is a statement about
   * the URL, so a section marker has to be a different attribute, or the
   * accessibility tree is simply told something untrue.
   */
  isSection: boolean;
}

/** Compare routes without caring whether the caller kept the trailing slash. */
const slashed = (p: string): string => (p.endsWith('/') ? p : `${p}/`);

/**
 * The site nav, marked against the URL BEING RENDERED.
 *
 * It takes the pathname rather than a key the page states about itself, and
 * that is the correction rather than a matter of taste. The first cut of this
 * took a `section` prop, and both `/work/` and `/work/<slug>/` passed
 * `"work"` — perfectly reasonably, since both do live under the archive — so
 * the work pages went back to emitting `aria-current="page"` on a link to
 * `/work/`. That is the identical defect #11 opened on, reintroduced by an API
 * that let a page assert its own identity.
 *
 * Derived from the URL, a page cannot get this wrong: `isCurrentPage` is href
 * equality and nothing else.
 */
export function siteNavItems(pathname: string | null = null): SiteNavItem[] {
  const contact = site.sections.find((s) => s.id === 'contact');
  if (!contact?.label) {
    throw new Error(
      'site.sections に label 付きの contact が無い。' +
        'site nav はラベルを新規に書かず、承認済みの文字列を読む。',
    );
  }

  const here = pathname === null ? null : slashed(pathname);

  const rows: { key: SiteNavKey; label: string; href: string; route: boolean }[] = [
    // The archive's own name, as its h1 and its rail already print it.
    { key: 'work', label: ui.register.railLabels[0], href: ARCHIVE_HREF, route: true },
    // The method page's own rail label.
    { key: 'method', label: site.howIBuild.railLabels[0] as string, href: METHOD_HREF, route: true },
    // Still a band of the homepage, and still says so — an anchor is never a
    // page, so it is never current and never an ancestor of anything.
    { key: 'contact', label: contact.label, href: `/${contact.anchor}`, route: false },
  ];

  return rows.map(({ route, ...row }, i) => {
    const isCurrentPage = route && here !== null && here === row.href;
    return {
      ...row,
      index: pad2(i + 1),
      isCurrentPage,
      isSection: route && here !== null && !isCurrentPage && here.startsWith(row.href),
    };
  });
}

export interface Crumb {
  label: string;
  /** Null on the last crumb: the page you are on is not a link to itself. */
  href: string | null;
}

/**
 * The trail from the archive down to the page being rendered — #11 §2.
 *
 * Deliberately NOT rooted at the homepage. The masthead is the way home and is
 * on every page already; repeating it as a first crumb would spend the trail's
 * shortest, most-scanned slot on the one destination that never moves.
 *
 * `technicalLabel` is passed in rather than imported so this stays a pure
 * function of its arguments — the tests exercise the shape at every depth
 * without a work record or a rendered page.
 */
export function workCrumbs(
  archiveLabel: string,
  title: string,
  slug: string,
  technicalLabel: string | null = null,
): Crumb[] {
  const trail: Crumb[] = [{ label: archiveLabel, href: ARCHIVE_HREF }];
  if (technicalLabel === null) {
    trail.push({ label: title, href: null });
    return trail;
  }
  trail.push({ label: title, href: workHref(slug, false) });
  trail.push({ label: technicalLabel, href: null });
  return trail;
}

/**
 * Where a work lives. The homepage links to its own in-page entry; every other
 * page must use the permalink, because a fragment that is not on the current
 * document is a dead link, not a shortcut.
 */
export function workHref(slug: string, samePage: boolean): string {
  return samePage ? `#w-${slug}` : site.workPermalink.replace('{id}', slug);
}

/**
 * The Technical page for a work. Derived from the slug for the same reason
 * `workHref` is: a route typed into a component is a work name typed into a
 * component, and the next work added would not get one.
 */
export const technicalHref = (slug: string): string =>
  `${site.workPermalink.replace('{id}', slug)}technical/`;

/**
 * Pair each work with its Case Study, dropping works that have none.
 *
 * A work without a Case Study record is not an error — it ships on the homepage
 * from the moment its facts are sourced. It simply has no Case Study page, and
 * `caseStudyPublished` on the work is what decides whether anything offers a
 * link to one.
 */
export function publishedCaseStudies(
  works: readonly Work[],
  caseStudies: readonly CaseStudy[],
): { work: Work; caseStudy: CaseStudy }[] {
  const byslug = new Map(caseStudies.map((c) => [c.slug, c]));
  return shippingWorks(works).flatMap((work) => {
    const caseStudy = byslug.get(work.slug);
    return caseStudy ? [{ work, caseStudy }] : [];
  });
}

export interface CaseSectionEntry {
  id: string;
  index: string;
  title: string;
}

/**
 * Which Case Study sections this work actually has content for.
 *
 * One list, two consumers: the body renders these and the table of contents
 * links to them. Deriving both from here is what stops the index from offering
 * an anchor to a section that was dropped for being empty — computing the two
 * separately is exactly how that goes wrong, because the drop condition then
 * lives in two places and only one of them gets updated.
 *
 * `index` IS NO LONGER `CS-2`. The CS numbers are the case-study
 * specification's own section ids — an internal coordinate, useful to whoever
 * maintains this and meaningless to a reader, who sees a page whose sections
 * are labelled from the middle of a numbering they were never shown the start
 * of. Spec §11.1 and #8 §7 both put `spec CS-*` on the list of internal
 * vocabulary that must not reach a public page, and this was the last place it
 * did.
 *
 * What replaces it is the section's POSITION, counted over the sections that
 * actually rendered — the same `01, 02, 03…` the homepage and the register use,
 * so a Case Study is numbered the way every other index on this site is. A work
 * that drops an empty section is numbered 01…n with no gap, rather than
 * advertising the absence of CS-11.
 *
 * THE ANCHORS DO NOT CHANGE. `id` stays `cs2` … `cs16`: it is the fragment in
 * `/work/crm/#cs9`, it is not rendered as text, and renumbering it would break
 * every link anyone has saved while removing nothing a reader can see.
 */
export function caseSections(work: Work, caseStudy: CaseStudy): CaseSectionEntry[] {
  const s = ui.caseStudy.sections;
  const present: [string, string, boolean][] = [
    ['cs2', s.problem, work.problem.length > 0],
    ['cs3', s.currentPractice, true],
    ['cs4', s.requirements, true],
    ['cs5', s.built, caseStudy.built.length > 0],
    ['cs6', s.decisions, caseStudy.decisions.length > 0],
    ['cs7', s.highlights, caseStudy.highlights.length > 0],
    ['cs8', s.role, true],
    ['cs9', s.quality, caseStudy.quality.length > 0],
    ['cs10', s.safety, caseStudy.safety.length > 0],
    ['cs11', s.delivery, caseStudy.delivery.length > 0],
    ['cs12', s.scope, caseStudy.scope.length > 0],
    ['cs13', s.scale, caseStudy.scale.length > 0],
    ['cs14', s.capabilities, caseStudy.capabilities.length > 0],
    ['cs15', s.technical, true],
    ['cs16', s.repository, caseStudy.repository.length > 0],
  ];
  return present
    .filter(([, , on]) => on)
    .map(([id, title], i) => ({ id, index: pad2(i + 1), title }));
}

/** Two digits, matching the register's numbering. */
export const pad2 = (n: number): string => String(n).padStart(2, '0');
