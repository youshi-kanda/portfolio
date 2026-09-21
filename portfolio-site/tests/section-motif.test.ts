/**
 * THE SECTION MOTIF CONTRACT (#46).
 *
 * The five chapter marks are decoration, and decoration has to be provably
 * harmless rather than observably harmless: a browser pass says "it did not
 * cover the text this time, at this width, on this engine", and a property of
 * the stylesheet says it cannot. So the rules that keep the layer in its place
 * are asserted here, and the browser checks are recorded in the PR.
 *
 * Four of them, and each is a defect that has an author behind it:
 *
 *   THE PIN CANNOT LEAVE ITS SECTION. This one was real in the first pass, not
 *   hypothetical. `--smo-lead` was written as `margin-top` on `.smo-fig`, a top
 *   margin collapses through a parent with no top border and no top padding,
 *   and the parent IS the sticky constraint rectangle — so the box grew 296px
 *   past `#work`'s bottom edge and the motif reached into 02. Measured at 1440
 *   before the fix. The lead is padding on `.smo-page` for that reason, and
 *   nothing may put a top margin back on `.smo-fig`.
 *
 *   NOTHING IS FIXED. A `position:fixed` graphic outlives the section it
 *   belongs to, which is the whole thing this layer exists not to be: the
 *   boundary is legible because the drawing is released by its own section.
 *
 *   THE LAYER IS UNDER THE PAGE AND TAKES NO INPUT. `z-index:-1` and
 *   `pointer-events:none`, stated once, on the wrapper.
 *
 *   REDUCED MOTION GETS A STILL DRAWING. Not a missing one: the pin is
 *   released and every animation declaration in the sheet is inside a
 *   `no-preference` query, so a reader who asked for no movement gets the same
 *   page with the same ink and nothing that moves.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const CSS = readFileSync(new URL('../src/styles/section-motif.css', import.meta.url), 'utf8');
const MARKUP = readFileSync(
  new URL('../src/components/home/SectionMotif.astro', import.meta.url),
  'utf8',
);

/* ---------------------------------------------------------------------- parse

   The sheet is one flat `@layer utilities { … }` with `@media` / `@supports`
   nested inside it, one top-level `@keyframes`, and no CSS nesting (no `&`),
   so brace matching is enough and a CSS parser would be a dependency bought
   for nothing. `no CSS nesting` is asserted below so the assumption stays
   honest. */

interface Rule {
  selector: string;
  decls: [string, string][];
  /** enclosing at-rule preludes, outermost first */
  context: string[];
}

const stripComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');

function declarations(body: string): [string, string][] {
  const out: [string, string][] = [];
  for (const part of body.split(';')) {
    const at = part.indexOf(':');
    if (at === -1) continue;
    const prop = part.slice(0, at).trim().toLowerCase();
    const value = part.slice(at + 1).trim().replace(/\s+/g, ' ');
    if (prop) out.push([prop, value]);
  }
  return out;
}

function parse(css: string): Rule[] {
  const src = stripComments(css);
  const rules: Rule[] = [];
  const context: string[] = [];
  let prelude = '';

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '{') {
      const head = prelude.trim().replace(/\s+/g, ' ');
      prelude = '';
      if (head.startsWith('@')) {
        context.push(head);
        continue;
      }
      const end = src.indexOf('}', i);
      assert.notEqual(end, -1, `section-motif.css: 閉じない宣言ブロック — ${head}`);
      rules.push({ selector: head, decls: declarations(src.slice(i + 1, end)), context: [...context] });
      i = end;
      continue;
    }
    if (ch === '}') {
      context.pop();
      prelude = '';
      continue;
    }
    prelude += ch;
  }
  return rules;
}

const rules = parse(CSS);
/** `@keyframes` blocks parse as rules whose selector is a percentage. */
const styleRules = rules.filter((r) => !/^\d|^from$|^to$/.test(r.selector));
const matching = (needle: string): Rule[] =>
  styleRules.filter((r) => r.selector.split(',').some((s) => s.trim().endsWith(needle)));
const declared = (r: Rule, prop: string): string | undefined =>
  r.decls.filter(([p]) => p === prop).at(-1)?.[1];
/* `prefers-reduced-motion` contains the substring `reduce` in BOTH of its
   values, so the match has to be on the value and not on the prelude. The
   loose version reported the `no-preference` branch as a `reduce` branch and
   failed this file's own test with the right answer. */
const inQuery = (r: Rule, value: 'reduce' | 'no-preference'): boolean =>
  r.context.some((c) => new RegExp(`prefers-reduced-motion:\\s*${value}\\s*\\)`).test(c));

describe('#46 背景モチーフ — パーサの前提', () => {
  it('CSS ネストを使っていない（ブレース対応だけで読めること）', () => {
    assert.equal(stripComments(CSS).includes('&'), false, 'ネストが入ると上のパーサが嘘になる');
  });

  it('モチーフの規則を実際に拾えている', () => {
    assert.ok(matching('.smo').length > 0);
    assert.ok(matching('.smo-fig').length > 0);
    assert.ok(matching('.smo-page').length > 0);
  });
});

describe('#46 sticky はセクションの外へ出られない', () => {
  it('`--smo-lead` は .smo-page の padding であって .smo-fig の margin ではない', () => {
    const page = matching('.smo-page').map((r) => declared(r, 'padding-top')).filter(Boolean);
    assert.deepEqual(page, ['var(--smo-lead)'], '.smo-page が lead を padding で持っていない');
  });

  it('.smo-fig に上マージンを付けない — 親を突き抜けて sticky の拘束枠を伸ばす', () => {
    for (const r of matching('.smo-fig')) {
      const top = declared(r, 'margin-top');
      if (top !== undefined) {
        assert.equal(top, '0', `.smo-fig の margin-top: ${top} — ${r.context.join(' ')}`);
      }
      const short = declared(r, 'margin');
      if (short !== undefined) {
        const first = short.split(' ')[0];
        assert.equal(first, '0', `.smo-fig の margin 一括指定の上が ${first} — ${r.context.join(' ')}`);
      }
    }
  });

  it('下マージンでセクション末尾より手前に解放する', () => {
    const pinned = matching('.smo-fig').find((r) => declared(r, 'position') === 'sticky');
    assert.ok(pinned, 'sticky な .smo-fig が無い');
    assert.match(declared(pinned, 'margin') ?? '', /var\(--smo-tail\)/);
  });

  it('どこにも position:fixed が無い — 装飾はセクションより長生きしない', () => {
    const fixedAt = styleRules
      .filter((r) => declared(r, 'position') === 'fixed')
      .map((r) => r.selector);
    assert.deepEqual(fixedAt, []);
  });
});

describe('#46 装飾は本文の下にあり、入力を受けない', () => {
  it('.smo は z-index:-1 と pointer-events:none を宣言する', () => {
    const base = matching('.smo').find((r) => declared(r, 'z-index') !== undefined);
    assert.ok(base, '.smo に z-index が無い');
    assert.equal(declared(base, 'z-index'), '-1');
    assert.equal(declared(base, 'pointer-events'), 'none');
  });

  it('本文より前に出る z-index をどこにも足していない', () => {
    for (const r of styleRules) {
      const z = declared(r, 'z-index');
      if (z === undefined || z === 'auto') continue;
      assert.ok(Number(z) < 0, `${r.selector} が z-index:${z} — 装飾は負の層だけ`);
    }
  });
});

describe('#46 reduced-motion は静止画を受け取る', () => {
  it('reduce では pin を解除する', () => {
    const off = matching('.smo-fig')
      .filter((r) => inQuery(r, 'reduce'))
      .map((r) => declared(r, 'position'));
    assert.ok(off.length > 0, 'reduce の分岐が無い');
    assert.ok(off.every((p) => p === 'static'), `reduce で position が ${off.join('/')}`);
  });

  it('animation / timeline の宣言は no-preference の中にしか無い', () => {
    const animated = ['animation', 'animation-timeline', 'animation-range', 'view-timeline-name', 'view-timeline-axis'];
    for (const r of styleRules) {
      for (const [prop] of r.decls) {
        if (!animated.includes(prop)) continue;
        assert.ok(
          inQuery(r, 'no-preference'),
          `${r.selector} の ${prop} が reduced-motion ゲートの外にある`,
        );
      }
    }
  });

  it('scroll 駆動は @supports の中にあり、未対応なら静止画に落ちる', () => {
    const timelines = styleRules.filter((r) => declared(r, 'animation-timeline') !== undefined);
    assert.ok(timelines.length > 0);
    for (const r of timelines) {
      assert.ok(
        r.context.some((c) => c.startsWith('@supports') && c.includes('animation-timeline')),
        `${r.selector} の animation-timeline が @supports の外にある`,
      );
    }
  });

  it('`animation` 一括指定より後に animation-timeline を書く', () => {
    // 一括指定は animation-timeline を auto に戻す。順序が逆だと
    // scroll timeline は静かに消える（motion.css と同じ罠）。
    for (const r of styleRules) {
      const props = r.decls.map(([p]) => p);
      const short = props.lastIndexOf('animation');
      const timeline = props.lastIndexOf('animation-timeline');
      if (short === -1 || timeline === -1) continue;
      assert.ok(timeline > short, `${r.selector}: animation 一括指定が animation-timeline を打ち消す`);
    }
  });
});

describe('#46 装飾は JS も文章も持たない', () => {
  it('コンポーネントは script を出さない', () => {
    assert.equal(/<script/i.test(MARKUP), false, 'SectionMotif が script を持っている');
  });

  it('装飾レイヤに aria-hidden が付いている', () => {
    assert.match(MARKUP, /<div class="smo" data-smo=\{motif\} aria-hidden="true">/);
  });

  it('SVG は focusable=false で、外部画像を読まない', () => {
    assert.match(MARKUP, /focusable="false"/);
    assert.equal(/<image\b|url\(/i.test(MARKUP), false, 'SVG が外部リソースを参照している');
  });
});
