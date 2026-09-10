/**
 * Two readings of the shipping copy that report rather than refuse. REPORT ONLY.
 *
 * Both are heuristics, and that is exactly why neither can be an error. A gate
 * that fails the build on a regular expression's opinion about a sentence
 * teaches people to write around the regular expression. These are here to put
 * a number and a list in front of a person, who then decides.
 *
 *   W-CLAIM-SUSPECT   a string classified as `presentation` that reads like it
 *                     asserts something checkable. The classification is the
 *                     thing under suspicion, not the string: presentation buys
 *                     an exemption from FACT provenance, so a fact wearing that
 *                     label is a claim that shipped without one.
 *   W-LITERAL-COUNT   a literal count of works typed into copy. Today's 3 is
 *                     the day a fourth work lands, and by then the page is
 *                     lying — which is the defect `derive.ts` exists to
 *                     prevent, working only for the strings that go through it.
 */
import type { CopyItem, UiCopyItem } from '../content/schema.ts';
import type { SiteString } from '../content/site.ts';
import type { Finding } from './finding.ts';

/**
 * A digit that is being used as a number, rather than one that happens to sit
 * inside an identifier. Without this, `L3 作品固有トークン` reads as "3 作品" —
 * which it is not, and a heuristic that cries wolf on its first real input is
 * one nobody will read the output of again.
 */
const COUNT = '(?<![0-9A-Za-z_])(\\d+)';

/** Markers of a statement that can be checked against the world. */
export const CHECKABLE_PATTERNS: readonly { re: RegExp; what: string }[] = [
  { re: new RegExp(`${COUNT}\\s*(件|作品|本|回|人|枚|%|passed|tests|steps)`), what: '数量' },
  { re: /(すべて|全て|全部|常に|必ず|一切|唯一|最も|最大|最小|初めて)/, what: '全称・最上級' },
];

/** A count of works, typed out instead of derived. */
const LITERAL_WORK_COUNT = new RegExp(`${COUNT}\\s*(作品|つの動くデモ)`, 'g');

export interface ClaimsInput {
  copy: readonly CopyItem[];
  uiCopy: readonly UiCopyItem[];
  site: readonly SiteString[];
  /** Shipping works, for saying whether a literal is even right today. */
  workCount: number;
  /**
   * Registry ids whose text is rendered from a template and held to the
   * approval snapshot. The literal in the SNAPSHOT is the recorded output of a
   * derivation, not a count someone typed into copy, so it is not the defect
   * this check is looking for.
   */
  derivedIds?: readonly string[];
}

export function claimsGate({
  copy,
  uiCopy,
  site,
  workCount,
  derivedIds = [],
}: ClaimsInput): Finding[] {
  const out: Finding[] = [];

  for (const row of [...copy, ...uiCopy]) {
    if (row.publication.claimType !== 'presentation') continue;
    const hit = CHECKABLE_PATTERNS.find((p) => p.re.test(row.text));
    if (!hit) continue;
    out.push({
      level: 'WARN',
      code: 'W-CLAIM-SUSPECT',
      message:
        `copy/${row.id} は presentation だが ${hit.what} を述べている。\n` +
        `      text: ${row.text}\n` +
        `    presentation は FACT provenance を免除される。` +
        `照合できる主張なら claimType = fact にする。`,
    });
  }

  const derived = new Set(derivedIds);
  const sources: { where: string; text: string }[] = [
    ...site.map((s) => ({ where: `site.${s.path}`, text: s.text })),
    ...[...copy, ...uiCopy]
      .filter((c) => !derived.has(c.id))
      .map((c) => ({ where: `copy/${c.id}`, text: c.text })),
  ];

  for (const { where, text } of sources) {
    for (const m of text.matchAll(LITERAL_WORK_COUNT)) {
      const n = Number(m[1]);
      out.push({
        level: 'WARN',
        code: 'W-LITERAL-COUNT',
        message:
          `${where} に作品数が literal で入っている（「${m[0]}」）。` +
          `${n === workCount ? '現在は正しい' : `現在の出荷作品数は ${workCount} 件で、既に食い違っている`}。\n` +
          `      text: ${text}\n` +
          `    4 件目が入った日に、この文だけが古いまま残る。`,
      });
    }
  }

  return out;
}
