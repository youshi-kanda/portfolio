/**
 * Fixtures built from the real content rather than hand-written literals.
 *
 * A test that invents its own valid Work stops testing the schema the moment
 * the schema and the content drift apart. Starting from the shipping data and
 * mutating a clone means the fixtures cannot rot silently.
 */
import { PENDING_APPROVAL } from '../src/lib/content/approved-text.ts';
import { loadAll, loadWorks, type ContentBundle } from '../src/lib/content/load.ts';
import type { Work } from '../src/lib/content/schema.ts';

export const clone = <T>(value: T): T => structuredClone(value);

export const realContent = () => loadAll();

/**
 * A shipping work that still carries the legacy fields, deep-cloned.
 *
 * PREFERS A DUAL RECORD, and that is the whole point. These are MIGRATE-period
 * fixtures: a test that means "a work with both field sets" used to get one by
 * taking the first work in the running order, because every work had both. #7
 * added seven V4-only records and put four of them ahead of `crm`, so the plain
 * "first work" now answers with a record that has no legacy half — and the
 * migration tests would have gone on passing while silently testing nothing.
 *
 * Falls back to the first work when no Dual record is left, which is the state
 * at CONTRACT; the tests that need the legacy half will fail loudly then, which
 * is the correct moment for them to be deleted.
 */
export function sampleWork(overrides: Partial<Work> = {}): Work {
  const works = loadWorks().sort((a, b) => a.featuredOrder - b.featuredOrder);
  const base = works.find((w) => w.repoPath !== undefined) ?? works[0];
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

/**
 * The four `T-UNAPPROVED` errors #8 left behind on purpose.
 *
 * #8 changed four public strings and has no approval event for any of them, so
 * the live content genuinely does not pass a production build. Tests that were
 * written to mean "nothing ELSE is wrong" have to say that, and `bundleWith`
 * hands every fixture the real copy registries, so they all inherit these four.
 *
 * THIS IS NOT A SUPPRESSION. `validate:content` and `astro build` still fail on
 * them, which is the whole point; what this does is stop four known, wanted
 * errors from drowning out a fifth unknown one. It is pinned to the exact ids
 * in `PENDING_APPROVAL`, so an unrelated `T-UNAPPROVED` still fails, and the
 * day those four are approved this filter matches nothing and every caller goes
 * back to asserting an empty list without being edited.
 */
const isPendingApproval = (f: { code: string; message: string }): boolean =>
  f.code === 'T-UNAPPROVED' &&
  PENDING_APPROVAL.some((p) => f.message.startsWith(`copy/${p.id} `));

export const pendingApprovalOnly = <T extends { code: string; message: string }>(
  findings: readonly T[],
): T[] => findings.filter(isPendingApproval);

export const exceptPendingApproval = <T extends { code: string; message: string }>(
  findings: readonly T[],
): T[] => findings.filter((f) => !isPendingApproval(f));
