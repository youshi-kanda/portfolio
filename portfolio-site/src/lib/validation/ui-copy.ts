/**
 * The UI chrome coverage gate — content-model §2.1, last row:
 * "item が inventory に無いのにページに文字列が出ている → 失敗".
 *
 * This is the rule that closes the gap §4 of that document recorded. The
 * prototype's `要確認` marker only covered strings registered in COPY_SLOTS, so
 * the ~78 strings written straight into the renderers shipped with no review
 * record at all — not marked draft, not marked approved, simply absent from the
 * ledger. Counting them once would not have fixed that. What fixes it is making
 * absence fail the build, so the count cannot climb back off zero unnoticed.
 *
 *   U-UNMANAGED  a string in `ui` that no registry row claims.
 *   U-ORPHAN     a registry row whose path `ui` no longer has.
 *   U-DRIFT      registry text and live text have diverged. Whichever one was
 *                edited, the review record no longer describes what ships.
 *   U-REFTARGET  an ADAPTED string names a path in this repo that is not there.
 *
 * U-DRIFT is deliberately symmetric with the approved-copy gate's A-CHANGED:
 * both refuse to let a string ship under a record that was written about a
 * different string. The difference is only what approval means for each —
 * authored copy needs a person, a transcription needs its source to still say
 * the same thing.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { UiCopyItem } from '../content/schema.ts';
import { uiStrings, type UiString } from '../content/ui.ts';
import type { Finding } from './finding.ts';

/** Repo root, for resolving the reference targets ADAPTED strings name. */
const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

/**
 * Paths an ADAPTED string points a reader at. IMPLEMENT-01 repointed two
 * sentences away from `positioning.WORKS`, which does not exist here; if the
 * replacement ever stops existing too, the sentence is false again and the
 * build should say so rather than keep instructing the reader to edit nothing.
 */
export const REFERENCE_TARGETS = ['src/content/work/'] as const;

export interface UiCopyOptions {
  /** Injectable for the tests; defaults to the live `ui` object. */
  strings?: readonly UiString[];
  /** Injectable for the tests; defaults to a real filesystem check. */
  exists?: (relPath: string) => boolean;
}

export function uiCopyGate(
  rows: readonly UiCopyItem[],
  options: UiCopyOptions = {},
): Finding[] {
  const strings = options.strings ?? uiStrings();
  const exists = options.exists ?? ((p: string) => existsSync(REPO_ROOT + p));
  const out: Finding[] = [];

  const byPath = new Map(rows.map((r) => [r.path, r]));
  const live = new Map(strings.map((s) => [s.path, s.text]));

  for (const s of strings) {
    const row = byPath.get(s.path);
    if (!row) {
      out.push({
        level: 'ERROR',
        code: 'U-UNMANAGED',
        message:
          `ui.${s.path} が copy inventory に無い（src/content/copy/ui.json）。\n` +
          `    text: ${s.text}\n` +
          `    出荷する文字列は、出所と分類を持つ行を 1 つ持つこと。`,
      });
      continue;
    }
    if (row.text !== s.text) {
      out.push({
        level: 'ERROR',
        code: 'U-DRIFT',
        message:
          `登録された文と実際に出る文が違う\n` +
          `    path:      ${s.path}\n` +
          `    registry:  ${row.text}\n` +
          `    ui.ts:     ${s.text}\n` +
          `    文言を変えるなら、その行の出所と reviewStatus を取り直すこと。`,
      });
    }
  }

  for (const row of rows) {
    if (!live.has(row.path)) {
      out.push({
        level: 'ERROR',
        code: 'U-ORPHAN',
        message:
          `copy inventory の ${row.id} が指す ui.${row.path} は既に無い。` +
          `使われない承認記録は残さないこと。`,
      });
    }
  }

  // ADAPTED strings name a path in this repository. Check it is really there.
  const adapted = rows.filter((r) =>
    r.publication.sourceRefs.some((s) => s.startsWith('ADAPTED')),
  );
  for (const row of adapted) {
    for (const target of REFERENCE_TARGETS) {
      if (row.text.includes(target) && !exists(target)) {
        out.push({
          level: 'ERROR',
          code: 'U-REFTARGET',
          message:
            `${row.id} は読者に ${target} を参照させるが、その path が存在しない。` +
            `存在しないファイルを指す指示は、置換前と同じ誤りである。`,
        });
      }
    }
  }

  return out;
}
