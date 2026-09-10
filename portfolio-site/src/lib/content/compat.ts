/**
 * The three fields that are moving, read through one door. TRANSITIONAL.
 *
 * V4 restates `repoPath`, `publicDemoScope` and `tests` as `showcase`. During
 * MIGRATE a work may carry either set or both, and the question every consumer
 * would otherwise have to answer for itself is which one to believe.
 *
 * The answer is fixed here, in one place, because it is a contract and not a
 * preference:
 *
 *   Legacy-only  read the legacy field
 *   V4-only      read showcase
 *   Dual         read the LEGACY field — the gate has already proved the two
 *                say the same thing, and Phases 1–3 keep the V3 presentation
 *                unchanged, so the field that produced today's page is the
 *                field that keeps producing it
 *
 * Written 11 times across 7 components, that rule would drift the first time
 * one of them was edited, and a drift here is not a rendering inconsistency —
 * it is the page stating a number that no longer has authority behind it.
 *
 * This module is deleted at CONTRACT, when `showcase` becomes the only source
 * and the callers read it directly. It exists to hold a migration open, not to
 * abstract the content model: it adds no concept the schema does not have, and
 * nothing but these three fields belongs in it.
 */
import type { Tests, Work, WorkSource } from './schema.ts';

/**
 * Where this work's source can be seen — or that it cannot be seen, which is
 * itself a fact about the work rather than the absence of one.
 *
 * Null only when the work states nothing at all about its source.
 */
export function workSource(work: Work): WorkSource | null {
  if (work.repoPath) return { access: 'public-repo', path: work.repoPath };
  return work.showcase?.source ?? null;
}

/** The public path, when there is one to give. */
export const workRepoPath = (work: Work): string | null => workSource(work)?.path ?? null;

/** What a visitor can actually run in public. Empty when nothing is public. */
export function workDemoScope(work: Work): readonly string[] {
  if (work.publicDemoScope) return work.publicDemoScope;
  return work.showcase?.demoScope ?? [];
}

/** The test record, or null when no public count can be cited for this work. */
export function workVerification(work: Work): Tests | null {
  if (work.tests) return work.tests;
  return work.showcase?.verification.tests ?? null;
}
