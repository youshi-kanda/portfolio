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
 * `image` is optional on the record and required of every shipping work by the
 * schema, so this is total for anything a page can reach: every renderer draws
 * from `shippingWorks`. The throw states that invariant rather than defending
 * against it — reaching it means a non-shipping work was handed to a renderer,
 * which is a routing defect and not a missing image.
 */
export function workFigure(work: Work): NonNullable<Work['image']> {
  if (!work.image) {
    throw new Error(
      `work/${work.slug} に image が無いのに描画された。` +
        `描画されるのは shipping の作品だけで、shipping なら image は schema が要求する。`,
    );
  }
  return work.image;
}

/**
 * How a work being rendered is drawn.
 *
 * Total on the same terms as `workFigure`: `visual` is required of every
 * shipping work by the schema, and only shipping works reach a renderer.
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
 */
export function caseSections(work: Work, caseStudy: CaseStudy): CaseSectionEntry[] {
  const s = ui.caseStudy.sections;
  const present: [string, string, string, boolean][] = [
    ['cs2', 'CS-2', s.problem, work.problem.length > 0],
    ['cs3', 'CS-3', s.currentPractice, true],
    ['cs4', 'CS-4', s.requirements, true],
    ['cs5', 'CS-5', s.built, caseStudy.built.length > 0],
    ['cs6', 'CS-6', s.decisions, caseStudy.decisions.length > 0],
    ['cs7', 'CS-7', s.highlights, caseStudy.highlights.length > 0],
    ['cs8', 'CS-8', s.role, true],
    ['cs9', 'CS-9', s.quality, caseStudy.quality.length > 0],
    ['cs10', 'CS-10', s.safety, caseStudy.safety.length > 0],
    ['cs11', 'CS-11', s.delivery, caseStudy.delivery.length > 0],
    ['cs12', 'CS-12', s.scope, caseStudy.scope.length > 0],
    ['cs13', 'CS-13', s.scale, caseStudy.scale.length > 0],
    ['cs14', 'CS-14', s.capabilities, caseStudy.capabilities.length > 0],
    ['cs15', 'CS-15', s.technical, true],
    ['cs16', 'CS-16', s.repository, caseStudy.repository.length > 0],
  ];
  return present.filter(([, , , on]) => on).map(([id, index, title]) => ({ id, index, title }));
}

/** Two digits, matching the register's numbering. */
export const pad2 = (n: number): string => String(n).padStart(2, '0');
