/**
 * The MIGRATE-period gate: does a work's V4 record say the same thing as the
 * legacy fields it is replacing?
 *
 * The schema fixes which of the three states a work is in — Legacy-only,
 * V4-only, Dual. It cannot ask the question that matters in the Dual state,
 * because that one is about claims rather than shapes:
 *
 *     tests.count                       484
 *     showcase.verification.tests.count 500
 *
 * Both parse. Both are the same shape. One of them is false, and the site has
 * no way to know which — so this is not a state to warn about and render past.
 * It is an ERROR, and the build stops:
 *
 *   agree     W-DUAL-SOURCE   both records present while the work is being
 *                             moved across. Expected, and reported so that a
 *                             half-finished migration cannot go quiet.
 *   disagree  T-DUAL-CONFLICT the two records make different claims. The page
 *                             would print one of them with nothing to say why
 *                             that one.
 *
 * T-DUAL-CONFLICT is NOT downgraded in development, and it is the second rule
 * on this site that is not (A-CHANGED is the first). The development
 * downgrade exists so an author can look at a page whose content is not
 * approved YET — it is about review state, and the content is still coherent.
 * This is a different animal: two records in the repository assert different
 * things and nothing can say which is true. Letting that warn while someone
 * keeps working is how the repository ends up carrying a fact and its
 * contradiction, with the disagreement no longer visible to anyone.
 *
 * The comparison is of MEANING, not of objects: text is compared with its
 * whitespace normalised, and the scope list as a set, because reordering the
 * list or re-wrapping a sentence does not change what is being claimed — and
 * through MIGRATE the legacy field is what renders anyway, so order on the V4
 * side decides nothing. A count is compared exactly. A count is the claim.
 *
 * Deleted at CONTRACT with the legacy fields.
 */
import type { Work } from '../content/schema.ts';
import type { Finding, Level } from './finding.ts';
import type { Mode } from './truth.ts';

const norm = (s: string): string => s.trim().replace(/\s+/g, ' ');
const sameText = (a: string, b: string): boolean => norm(a) === norm(b);

const key = (list: readonly string[]): string => [...list].map(norm).sort().join('␟');
const sameSet = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && key(a) === key(b);

interface Mismatch {
  field: string;
  legacy: string;
  v4: string;
}

/** Whether the work is carrying both records at once. */
export const isDual = (w: Work): boolean =>
  w.showcase !== undefined &&
  (w.repoPath !== undefined || w.publicDemoScope !== undefined || w.tests !== undefined);

/** What the two records disagree about. Empty when they say the same thing. */
export function dualMismatches(w: Work): Mismatch[] {
  const v4 = w.showcase;
  if (!v4) return [];
  const out: Mismatch[] = [];

  if (w.repoPath !== undefined) {
    const s = v4.source;
    const shown = s.path ? `${s.access} ${s.path}` : s.access;
    if (s.access !== 'public-repo' || !s.path || !sameText(s.path, w.repoPath)) {
      out.push({ field: 'repoPath ↔ showcase.source', legacy: w.repoPath, v4: shown });
    }
  }

  if (w.publicDemoScope !== undefined && !sameSet(w.publicDemoScope, v4.demoScope)) {
    const legacyOnly = w.publicDemoScope.filter((t) => !v4.demoScope.some((u) => sameText(t, u)));
    const v4Only = v4.demoScope.filter((t) => !w.publicDemoScope!.some((u) => sameText(t, u)));
    out.push({
      field: 'publicDemoScope ↔ showcase.demoScope',
      legacy: `${w.publicDemoScope.length} 件${legacyOnly.length > 0 ? ` / legacy にだけある: ${legacyOnly.join(' · ')}` : ''}`,
      v4: `${v4.demoScope.length} 件${v4Only.length > 0 ? ` / showcase にだけある: ${v4Only.join(' · ')}` : ''}`,
    });
  }

  if (w.tests !== undefined) {
    const t = v4.verification.tests;
    if (!t) {
      out.push({
        field: 'tests ↔ showcase.verification.tests',
        legacy: `${w.tests.count} 件（${w.tests.summary}）`,
        v4: 'null（検証を主張しない）',
      });
    } else {
      if (t.count !== w.tests.count) {
        out.push({ field: 'tests.count', legacy: String(w.tests.count), v4: String(t.count) });
      }
      if (!sameText(t.summary, w.tests.summary)) {
        out.push({ field: 'tests.summary', legacy: w.tests.summary, v4: t.summary });
      }
      if (!sameText(t.source, w.tests.source)) {
        out.push({ field: 'tests.source', legacy: w.tests.source, v4: t.source });
      }
    }
  }

  return out;
}

export function migrationGate(works: readonly Work[], mode: Mode): Finding[] {
  const level: Level = mode === 'production' ? 'ERROR' : 'WARN';
  const out: Finding[] = [];

  for (const w of works) {
    if (!isDual(w)) continue;
    const mismatches = dualMismatches(w);

    if (mismatches.length === 0) {
      out.push({
        level: 'WARN',
        code: 'W-DUAL-SOURCE',
        message:
          `work/${w.slug} は legacy と showcase を両方持っている（移行途中）。` +
          `両者の主張は一致している。描画は legacy 側。CONTRACT で showcase へ一本化する。`,
      });
      continue;
    }

    for (const m of mismatches) {
      out.push({
        // never downgraded — see the note at the top of this file
        level: 'ERROR',
        code: 'T-DUAL-CONFLICT',
        message:
          `work/${w.slug} の ${m.field} が食い違っている。` +
          `legacy = ${m.legacy} / showcase = ${m.v4}。` +
          `どちらを正として描画するかを曖昧にしたまま出さない。`,
      });
    }
  }

  // The homepage leads with one entry or with none. Two works claiming the
  // role is not a layout question that a renderer can settle for itself.
  const leads = works.filter((w) => w.homepageRole === 'lead');
  if (leads.length > 1) {
    out.push({
      level,
      code: 'T-MULTI-LEAD',
      message:
        `homepageRole = lead が ${leads.length} 件ある（${leads.map((w) => w.slug).join(' / ')}）。` +
        `Lead は 1 件か 0 件。`,
    });
  }

  // Lead ⇒ featured. The Editorial Band is drawn from the featured works and
  // the Lead entry is the one the band leads with, so a lead that is not
  // featured is an entry the homepage promotes to a position it never occupies.
  // A consistency condition of the information architecture, not a preference.
  for (const w of leads) {
    if (!w.featured) {
      out.push({
        level,
        code: 'T-LEAD-NOT-FEATURED',
        message:
          `work/${w.slug} は homepageRole = lead だが featured = false。` +
          `Homepage が先頭に置く作品が、Homepage に載らない作品であってはならない。`,
      });
    }
  }

  return out;
}
