/**
 * The Editorial Band's count rule.
 *
 * The band is a composition of three panels across the full bleed. That is a
 * shape, not a capacity: two panels is a different object and four is a grid,
 * and neither is a thing this design draws. So the number of featured works is
 * a content decision the build has an opinion about.
 *
 *   B-BAND-COUNT     more featured works than the band can compose. An ERROR,
 *                    because the alternative is a renderer silently picking
 *                    three of them — which is an editorial decision, and not
 *                    one a component gets to make.
 *   W-BAND-PARTIAL   one or two featured works. The band is not drawn and the
 *                    homepage loses a section, which is a legitimate state
 *                    while works are being added — so it is reported and not
 *                    failed.
 *
 * Zero is silent. A site with no featured work has nothing to say here, and the
 * band's own empty state says it.
 */
import type { Work } from '../content/schema.ts';
import type { Finding } from './finding.ts';

/** What the band composes. Change it here and the gate follows. */
export const BAND_PANELS = 3;

export function bandGate(featured: readonly Work[]): Finding[] {
  const n = featured.length;
  const slugs = featured.map((w) => w.slug).join(' / ');

  if (n > BAND_PANELS) {
    return [
      {
        level: 'ERROR',
        code: 'B-BAND-COUNT',
        message:
          `featured な出荷作品が ${n} 件ある（${slugs}）。Editorial Band は ${BAND_PANELS} 枚の構成で、` +
          `${n} 件から ${BAND_PANELS} 件を選ぶのは編集判断であって renderer の仕事ではない。\n` +
          `    どれを band に載せるかを work レコードの featured で決めること。`,
      },
    ];
  }

  if (n > 0 && n < BAND_PANELS) {
    return [
      {
        level: 'WARN',
        code: 'W-BAND-PARTIAL',
        message:
          `featured な出荷作品が ${n} 件しかない（${slugs}）。Editorial Band は ${BAND_PANELS} 枚で` +
          `構成されるので描画されず、Homepage からこの節が 1 つ落ちる。`,
      },
    ];
  }

  return [];
}
