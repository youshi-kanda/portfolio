/**
 * The entry-variant build gate — art-direction §12, as revised 2026-08-26.
 *
 * What the gate protects is the property the art direction actually cares
 * about: that a growing index does not collapse into one uniform tile grid.
 * That is a property of the whole list, not of a single adjacency.
 *
 * An earlier version failed the build whenever two *adjacent* works declared
 * the same variant. That made a presentation-rhythm preference override the
 * content: an author whose 07 and 08 both genuinely read as terminal work had
 * to mis-declare one to get a green build. The variant is a claim about what
 * the work IS, so the gate must not force a false claim.
 *
 *   ERROR  E-UNKNOWN    a variant with no renderer. Nothing can draw it.
 *   ERROR  E-MONOTONY   fewer distinct variants than the list length requires.
 *   ERROR  E-RUN        three or more consecutive works share a variant.
 *   WARN   W-ADJACENT   exactly two neighbours share a variant. Reported every
 *                       build, fails nothing.
 *
 * `strict` promotes W-ADJACENT to an error. It is for an authoring review pass,
 * never for the production build.
 */
import { ENTRY_VARIANTS } from '../content/schema.ts';
import type { Finding } from './finding.ts';

export const RUN_LIMIT = 3;

export interface VariantInput {
  slug: string;
  entryVariant: string;
}

/**
 * How many distinct variants a list of n works must use.
 *
 *     n         1–2   3–7   8+
 *     distinct   1     2     3     (capped by the palette, and by n)
 *
 * Deliberately loose. At 1–2 works there is no rhythm to collapse. From 3 the
 * page has to show it owns more than one shape; only from 8 must it use three.
 */
export function variantFloor(n: number, paletteSize: number): number {
  if (n <= 0) return 0;
  const need = n <= 2 ? 1 : n <= 7 ? 2 : 3;
  return Math.min(paletteSize, n, need);
}

export function variantGate(
  works: readonly VariantInput[],
  options: { strict?: boolean; palette?: readonly string[] } = {},
): Finding[] {
  const palette = options.palette ?? ENTRY_VARIANTS;
  const strict = options.strict ?? false;
  const found: Finding[] = [];

  for (const w of works) {
    if (!palette.includes(w.entryVariant)) {
      found.push({
        level: 'ERROR',
        code: 'E-UNKNOWN',
        message:
          `${w.slug} の entry variant ${w.entryVariant} には renderer が無い。` +
          `実装済みの変種は ${palette.join(' / ')}。`,
      });
    }
  }

  const known = works.filter((w) => palette.includes(w.entryVariant));
  if (known.length > 0) {
    const distinct = new Set(known.map((w) => w.entryVariant)).size;
    const need = variantFloor(known.length, palette.length);
    if (distinct < need) {
      found.push({
        level: 'ERROR',
        code: 'E-MONOTONY',
        message:
          `${known.length} 件で使っている変種が ${distinct} 種しかない。` +
          `${need} 種以上を使うこと（一様なタイル格子への退化を拒否する）。`,
      });
    }
  }

  // walk the runs, with a sentinel so the final run is flushed
  let runVariant: string | null = null;
  let run: string[] = [];
  for (const w of [...known, { slug: '', entryVariant: null as string | null }]) {
    if (w.entryVariant === runVariant) {
      run.push(w.slug);
      continue;
    }
    if (run.length >= RUN_LIMIT) {
      found.push({
        level: 'ERROR',
        code: 'E-RUN',
        message:
          `${run.join(' → ')} の ${run.length} 件が連続して ${runVariant} を取っている。` +
          `連続は ${RUN_LIMIT - 1} 件まで。`,
      });
    } else if (run.length === 2) {
      found.push({
        level: strict ? 'ERROR' : 'WARN',
        code: 'W-ADJACENT',
        message:
          `${run[0]} と ${run[1]} が隣接して同じ変種 ${runVariant} を取っている。` +
          `${strict ? 'strict: 拒否' : '内容がそう読めるなら許容する'}。`,
      });
    }
    runVariant = w.entryVariant;
    run = [w.slug];
  }

  return found;
}
