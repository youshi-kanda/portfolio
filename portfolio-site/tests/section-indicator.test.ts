/**
 * THE CURRENT-SECTION INDICATOR CONTRACT (#46).
 *
 * The small readout is decoration that MOVES, and movement is the part that has
 * to be proved rather than observed. A browser pass says "01 did not survive
 * into 02 at this width, on this engine, on this scroll"; a property of the
 * stylesheet says it cannot. The browser numbers are in the PR; the rules that
 * make them true are here.
 *
 * WHAT THIS IS NOT ALLOWED TO BECOME, and why each rule exists:
 *
 *   NOT FIXED. `position:fixed` pins to the viewport, and a viewport-pinned
 *   readout has to be told which section it is in — which is a scroll handler,
 *   an observer and an active-section variable, none of which #46 asked for and
 *   all of which can be wrong. `position:sticky` inside the section is the
 *   whole mechanism: the containing block IS the answer.
 *
 *   NOT SCRIPTED. No `<script>` in the component, no timeline in the sheet.
 *   Five sticky boxes in five containing blocks produce 01 → 02 → 03 → 04 → 05
 *   with nothing to keep in sync.
 *
 *   NOT A SECOND CHAPTER OPENING. This file does not assert type sizes — that
 *   is art direction — but it does assert that this layer never reaches into
 *   `.smk`. #46 §3 froze the chapter marker's geometry for this change, and the
 *   cheapest way to break that freeze by accident is a selector in the new
 *   sheet that happens to match the old layer.
 *
 *   NOT TEXT. Same rule as the marker: the number is `sectionNumber()` and the
 *   word is the `site.sections` label the nav prints. If this layer could say
 *   something the page does not already say, it would be public copy, it would
 *   need approval, and it would stop being deletable.
 *
 *   NOT BELOW ITS BREAKPOINT. The layer is switched ON by a width, never off by
 *   one, so a media query an engine fails to apply leaves the page without the
 *   indicator instead of with an unplaceable one.
 *
 * `tests/section-marker.test.ts` is untouched and still asserts that the
 * chapter opening has no sticky and no motion. The two files are the two
 * layers, and neither relaxes the other.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const CSS = readFileSync(new URL('../src/styles/section-indicator.css', import.meta.url), 'utf8');
const MARKUP = readFileSync(
  new URL('../src/components/home/SectionIndicator.astro', import.meta.url),
  'utf8',
);
const LAYOUT = readFileSync(new URL('../src/layouts/BaseLayout.astro', import.meta.url), 'utf8');

/** The five homepage chapters, in running order. */
const INDICATOR_SECTIONS = ['work', 'more', 'capabilities', 'about', 'contact'] as const;
/** The lowest width at which #46 §13 allows the layer to be drawn at all. */
const FLOOR = 1024;

/* ---------------------------------------------------------------------- parse

   Same shape as section-marker.css: one flat `@layer utilities { … }` with
   `@media` nested inside it and no CSS nesting, so brace matching is enough.
   `no CSS nesting` is asserted below so the assumption stays honest. */

interface Rule {
  selector: string;
  decls: [string, string][];
  /** enclosing at-rule preludes, outermost first */
  context: string[];
}

const stripComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');
/** The component minus its prose: the doc comment names the labels it must not
 *  hard-code, so a literal search over the raw file finds the explanation
 *  instead of the defect. */
const CODE = MARKUP.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const SHEET = () => stripComments(CSS);

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
      assert.notEqual(end, -1, `section-indicator.css: 閉じない宣言ブロック — ${head}`);
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
const selectorsOf = (r: Rule): string[] => r.selector.split(',').map((s) => s.trim());
const declared = (r: Rule, prop: string): string | undefined =>
  r.decls.filter(([p]) => p === prop).at(-1)?.[1];
/** the narrowest `min-width` any of a rule's enclosing media queries states */
const minWidthOf = (r: Rule): number | null => {
  let best: number | null = null;
  for (const at of r.context) {
    const m = /@media\s*\(\s*min-width:\s*(\d+(?:\.\d+)?)px\s*\)/.exec(at);
    if (m) best = best === null ? Number(m[1]) : Math.max(best, Number(m[1]));
  }
  return best;
};
/** the base `.sid-t` rule — the one outside every media query */
const base = (): Rule => {
  const r = rules.find((x) => selectorsOf(x).some((s) => s.endsWith('.sid-t')) && x.context.every((c) => !c.startsWith('@media')));
  assert.ok(r, '.sid-t の既定を決めている（@media の外の）規則が無い');
  return r;
};

describe('#46 現在地表示 — パーサの前提', () => {
  it('CSS ネストを使っていない（ブレース対応だけで読めること）', () => {
    assert.equal(stripComments(CSS).includes('&'), false, 'ネストが入ると上のパーサが嘘になる');
  });

  it('現在地表示の規則を実際に拾えている', () => {
    for (const name of ['.sid-t', '.sid', '.sid-n', '.sid-l']) {
      assert.ok(
        rules.some((r) => selectorsOf(r).some((s) => s.endsWith(name))),
        `${name} の規則が 1 つも無い`,
      );
    }
  });
});

describe('#46 現在地表示は節より長生きしない', () => {
  it('position:fixed がどこにも無い — viewport に留まる readout は状態を持つことになる', () => {
    const pinned = rules
      .filter((r) => declared(r, 'position') === 'fixed')
      .map((r) => r.selector);
    assert.deepEqual(pinned, [], 'fixed があると、今どの節かを JS に教えてもらう必要が出る');
  });

  it('動くのは 1 つだけで、それは sticky である', () => {
    const sticky = rules.filter((r) => declared(r, 'position') === 'sticky');
    assert.equal(sticky.length, 1, `sticky が ${sticky.length} 箇所 — 動く箱は 1 つ`);
    assert.ok(selectorsOf(sticky[0]!).every((s) => s.endsWith('.sid')), sticky[0]!.selector);
  });

  it('sticky の入れ物は節に貼り付いた absolute で、上端と下端の両方を宣言している', () => {
    const track = rules.find((r) => selectorsOf(r).some((s) => s.endsWith('.sid-t')) && declared(r, 'position') === 'absolute');
    assert.ok(track, '.sid-t が absolute になっていない — 節が sticky の containing block にならない');
    assert.ok(declared(track!, 'top'), '.sid-t に top が無い');
    assert.equal(
      declared(track!, 'bottom'), '0',
      '.sid-t の下端が節の底で止まっていない — 01 が 02 まで残るのはここが緩んだとき',
    );
    assert.equal(
      declared(track!, 'height'), undefined,
      '.sid-t に height を与えると、節の底ではなくその数字が終端になる',
    );
  });

  it('sticky の停止位置は既存の nav 高さトークンから作る（新しい数字を置かない）', () => {
    const sticky = rules.find((r) => declared(r, 'position') === 'sticky')!;
    const top = declared(sticky, 'top');
    assert.ok(top, 'sticky に top が無い');
    assert.match(top!, /var\(--mx-nav/, `sticky の top が --mx-nav 由来でない: ${top}`);
  });
});

describe('#46 現在地表示は本文の下にあり、入力を受けない', () => {
  it('負の層に置き、pointer-events を切っている', () => {
    const track = rules.find((r) => selectorsOf(r).some((s) => s.endsWith('.sid-t')) && declared(r, 'position') === 'absolute')!;
    assert.equal(declared(track, 'z-index'), '-1');
    assert.equal(declared(track, 'pointer-events'), 'none');
  });

  it('本文より前に出る z-index をどこにも足していない', () => {
    for (const r of rules) {
      const z = declared(r, 'z-index');
      if (z === undefined || z === 'auto') continue;
      assert.ok(Number(z) < 0, `${r.selector} が z-index:${z} — 装飾は負の層だけ`);
    }
  });
});

describe('#46 現在地表示は幅で「点ける」— 消し忘れが起きない形にする', () => {
  it('既定は display:none で、描画は min-width の中にしかない', () => {
    assert.equal(declared(base(), 'display'), 'none', '.sid-t の既定が none でない');
    for (const r of rules) {
      const d = declared(r, 'display');
      if (d === undefined || d === 'none') continue;
      const min = minWidthOf(r);
      assert.ok(
        min !== null,
        `${r.selector} が @media の外で display:${d} — 幅の条件なしに描かれる`,
      );
      assert.ok(
        min! >= FLOOR,
        `${r.selector} の描画が ${min}px から — #46 §13 の下限は ${FLOOR}px`,
      );
    }
  });

  it('描画に使う規則はすべて同じ 1 つの min-width の下にある', () => {
    const widths = new Set<number>();
    for (const r of rules) {
      const min = minWidthOf(r);
      if (min !== null) widths.add(min);
    }
    assert.equal(
      widths.size, 1,
      `描画の breakpoint が ${[...widths].join('/')} と複数ある — 1 つの幅で点けて 1 つの幅で消す`,
    );
  });
});

describe('#46 現在地表示は動かない（sticky はレイアウトであって motion ではない）', () => {
  it('animation / transition / scroll timeline をこの層に足していない', () => {
    const moving = [
      'animation', 'animation-name', 'animation-timeline', 'animation-range',
      'transition', 'transition-property', 'transition-duration',
      'view-timeline-name', 'view-timeline-axis', 'scroll-timeline-name',
    ];
    for (const r of rules) {
      for (const [prop] of r.decls) {
        assert.equal(
          moving.includes(prop), false,
          `${r.selector} の ${prop} — #46 §15 はこの層に新しい動きを足さない`,
        );
      }
    }
    assert.equal(/@keyframes/.test(CSS), false, 'この層に @keyframes がある');
  });
});

describe('#46 現在地表示は既存の色と既存のグリッドだけを使う', () => {
  it('新しい色を導入していない — 値はすべて既存トークン', () => {
    const allowed = /var\(--(?:sig|tx|tx2|tx3)\)/;
    for (const r of rules) {
      for (const [prop, value] of r.decls) {
        if (!/(^|-)color$/.test(prop) && prop !== 'background' && prop !== 'fill') continue;
        assert.match(
          value, allowed,
          `${r.selector} の ${prop}: ${value} — 既存トークン以外の色を足さない`,
        );
        assert.equal(
          /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/i.test(value), false,
          `${r.selector} の ${prop} が生の色値を持っている: ${value}`,
        );
      }
    }
  });

  it('箱も影も画像も足していない — 静かな 1 行であること', () => {
    const src = stripComments(CSS);
    for (const [name, re] of [
      ['url()', /url\(/i],
      ['background-image', /background-image\s*:/i],
      ['box-shadow', /box-shadow\s*:/i],
      ['text-shadow', /text-shadow\s*:/i],
      ['filter', /\bfilter\s*:/i],
      ['backdrop-filter', /backdrop-filter\s*:/i],
      ['border', /\bborder(?:-(?:top|right|bottom|left|width|style|color))?\s*:/i],
      ['border-radius', /border-radius\s*:/i],
    ] as const) {
      assert.equal(re.test(src), false, `section-indicator.css に ${name} がある — #46 §9`);
    }
    /* `background` だけは「箱を足さない」の本体なので、宣言そのものを禁じる */
    assert.equal(/\bbackground\s*:/i.test(src), false, 'background を宣言している — 下地の箱は足さない');
  });

  it('自分の名前以外を restyle していない（章標には指一本触れない）', () => {
    for (const r of rules) {
      for (const s of selectorsOf(r)) {
        assert.ok(/\.sid(?:-[a-z])?$/.test(s), `section-indicator.css が ${s} を restyle している`);
      }
    }
    for (const dead of ['.smk', '--smk-', '.page', '.tr', '.ins', '.msr', '.fld', '.nav']) {
      assert.equal(
        SHEET().includes(dead), false,
        `section-indicator.css が ${dead} に触れている — #46 §3 は章標と凍結シートを触らせない`,
      );
    }
  });
});

describe('#46 現在地表示は JS も独自の文章も持たない', () => {
  it('コンポーネントは script を出さない', () => {
    assert.equal(/<script/i.test(MARKUP), false, 'SectionIndicator が script を持っている');
    for (const dead of ['IntersectionObserver', 'addEventListener', 'requestAnimationFrame', 'scroll']) {
      assert.equal(CODE.includes(dead), false, `SectionIndicator に ${dead} がある — #46 §6`);
    }
  });

  it('装飾レイヤに aria-hidden が付いている', () => {
    assert.match(
      MARKUP,
      /<div class="sid-t" data-section-indicator=\{section\} aria-hidden="true">/,
      'rail と nav が同じことを言っている以上、現在地表示は読み上げさせない',
    );
  });

  it('リンクにもボタンにもフォーカス対象にもしていない', () => {
    for (const dead of ['<a ', '<button', 'href', 'tabindex', 'role=']) {
      assert.equal(CODE.includes(dead), false, `SectionIndicator に ${dead} がある — 操作できるものにしない`);
    }
  });

  it('描くのは番号と label の 2 つだけで、どちらも式である（文字を打っていない）', () => {
    const body = MARKUP.slice(MARKUP.lastIndexOf('---') + 3);
    const spans = [...body.matchAll(/<span class="(sid-[a-z])">([^<]*)<\/span>/g)];
    assert.deepEqual(
      spans.map((m) => [m[1], (m[2] ?? '').trim()]),
      [['sid-n', '{index}'], ['sid-l', '{label}']],
      '現在地表示の中身は {index} と {label} だけ',
    );
    const text = body.replace(/<[^>]*>/g, '').replace(/\{[^}]*\}/g, '').replace(/\s+/g, '');
    assert.equal(text, '', `現在地表示が直書きの文字を持っている: ${text.slice(0, 40)}`);
  });

  it('番号も label も SSOT から取る — どちらもこのファイルには書かれていない', () => {
    assert.match(MARKUP, /import \{ sectionNumber \} from '\.\.\/\.\.\/lib\/content\/derive\.ts';/);
    assert.match(MARKUP, /import \{ site \} from '\.\.\/\.\.\/lib\/content\/site\.ts';/);
    assert.match(MARKUP, /sectionNumber\(section\)/, '番号が sectionNumber 由来でない');
    assert.match(MARKUP, /site\.sections\.find\(\(s\) => s\.id === section\)/, 'label が site.sections 由来でない');
    for (const label of ['WORK', 'MORE', 'CAPABILITIES', 'ABOUT', 'CONTACT']) {
      assert.equal(
        new RegExp(`['"\`]${label}['"\`]`).test(CODE), false,
        `SectionIndicator に ${label} が直書きされている`,
      );
    }
    for (const n of ['01', '02', '03', '04', '05']) {
      assert.equal(
        new RegExp(`['"\`]${n}['"\`]`).test(CODE), false,
        `SectionIndicator に章番号 ${n} が直書きされている`,
      );
    }
  });
});

describe('#46 5 つの章すべてが同じ 1 つのコンポーネントを呼ぶ', () => {
  it('節ごとの実装になっていない — 呼び出しは section prop だけが違う', () => {
    const seen: string[] = [];
    for (const file of ['FeaturedWork', 'MoreProjects', 'Capabilities', 'About', 'Contact']) {
      const src = readFileSync(
        new URL(`../src/components/home/${file}.astro`, import.meta.url),
        'utf8',
      );
      const calls = [...src.matchAll(/<SectionIndicator section="([a-z]+)" \/>/g)].map((m) => m[1]!);
      assert.equal(calls.length, 1, `${file}.astro の呼び出しが ${calls.length} 個`);
      assert.match(
        src,
        /import SectionIndicator from '\.\/SectionIndicator\.astro';/,
        `${file}.astro が共通コンポーネントを import していない`,
      );
      seen.push(calls[0]!);
    }
    assert.deepEqual([...seen].sort(), [...INDICATOR_SECTIONS].sort());
  });

  it('スタイルシートは 1 枚で、BaseLayout が読んでいる', () => {
    assert.match(LAYOUT, /import '\.\.\/styles\/section-indicator\.css';/);
    assert.match(
      LAYOUT, /import '\.\.\/styles\/section-marker\.css';/,
      '章標のシートを外していない（#46 §3）',
    );
  });
});
