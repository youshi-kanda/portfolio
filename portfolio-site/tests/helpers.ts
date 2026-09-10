/**
 * Fixtures built from the real content rather than hand-written literals.
 *
 * A test that invents its own valid Work stops testing the schema the moment
 * the schema and the content drift apart. Starting from the shipping data and
 * mutating a clone means the fixtures cannot rot silently.
 */
import { loadAll, loadWorks, type ContentBundle } from '../src/lib/content/load.ts';
import type { Work } from '../src/lib/content/schema.ts';

export const clone = <T>(value: T): T => structuredClone(value);

export const realContent = () => loadAll();

/** The first shipping work, deep-cloned so a test can mutate it freely. */
export function sampleWork(overrides: Partial<Work> = {}): Work {
  const works = loadWorks().sort((a, b) => a.featuredOrder - b.featuredOrder);
  const base = works[0];
  if (!base) throw new Error('fixture: src/content/work が空');
  return { ...clone(base), ...overrides };
}

/**
 * The sample work with its V4 record stripped — a Legacy-only fixture.
 *
 * Needed from the moment the first work went Dual: a test that means "a work
 * that has not migrated" cannot get one by reading the disk any more, and
 * would otherwise quietly start testing a Dual record instead.
 */
export function legacyWork(overrides: Partial<Work> = {}): Work {
  const { showcase: _v4, ...legacy } = sampleWork();
  return { ...legacy, ...overrides } as Work;
}

/** n works with distinct slugs, cycling the real entries so variants differ. */
export function nWorks(n: number): Work[] {
  const works = loadWorks().sort((a, b) => a.featuredOrder - b.featuredOrder);
  return Array.from({ length: n }, (_, i) => {
    const base = works[i % works.length];
    if (!base) throw new Error('fixture: src/content/work が空');
    return { ...clone(base), slug: `w${i}`, featuredOrder: i + 1 };
  });
}

export type Bundle = ContentBundle;

/**
 * A bundle whose Evidence and copy are real, with the work list replaced.
 *
 * The Case Studies are filtered to the works being passed in. Keeping all three
 * would leave records pointing at works this bundle does not contain, and the
 * gate would report `T-ORPHAN-CASE` in tests that are about something else.
 */
export function bundleWith(works: Work[]): Bundle {
  const { caseStudies, evidence, copy, uiCopy, site } = loadAll();
  const slugs = new Set(works.map((w) => w.slug));
  return {
    works,
    caseStudies: caseStudies.filter((c) => slugs.has(c.slug)),
    evidence,
    copy,
    uiCopy,
    site,
  };
}

export const codes = (findings: readonly { code: string }[]): string[] =>
  findings.map((f) => f.code);
