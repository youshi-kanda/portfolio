/**
 * THE SECTION MARKER CONTRACT (#46 A').
 *
 * The five chapter openings are decoration, and decoration has to be provably
 * harmless rather than observably harmless: a browser pass says "it did not
 * cover the CTA this time, at this width, on this engine", and a property of
 * the stylesheet says it cannot. The browser numbers are in the PR; the rules
 * that make them true are here.
 *
 * WHAT THIS FILE REPLACES. `tests/section-motif.test.ts` asserted the shape of
 * PR #47's five SVG drawings — the sticky pin, the view timeline, the reduced
 * motion fallback. That layer was rejected in staging review and is deleted,
 * so its contract is not relaxed or skipped: it is re-written against what
 * actually ships. Three of its rules survive because they were about the layer
 * and not about the drawing (under the page, takes no input, carries no text);
 * the rest are gone with the thing they described, and two new ones take their
 * place.
 *
 * THE ZONE IS THE NEW RULE, and it is the one that matters. `z-index:-1` is
 * not a safety property: a reader sees grey letterforms through a paragraph
 * whether they are behind it or not, and #46's review asked for the marker not
 * to be there at all. So `.smk` states a fixed HEIGHT with `overflow:hidden`
 * and a `clip-path` that cuts its left edge at the measure's right line. The
 * marker cannot reach the body text, the CTA or the Evidence plate because
 * there is no geometry in which it is drawn that far — not because the numbers
 * happened to work out at 1440.
 *
 * NOTHING MOVES is the other new rule. #46 A' adds no sticky, no fixed, no
 * animation and no scroll timeline; whether the boundary needs motion is a
 * question for staging review, and a stylesheet that quietly grew an animation
 * would answer it without being asked.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const CSS = readFileSync(new URL('../src/styles/section-marker.css', import.meta.url), 'utf8');
const MARKUP = readFileSync(
  new URL('../src/components/home/SectionMarker.astro', import.meta.url),
  'utf8',
);

/** The five homepage chapters, in running order. */
const MARKER_SECTIONS = ['work', 'more', 'capabilities', 'about', 'contact'] as const;

/* ---------------------------------------------------------------------- parse

   The sheet is one flat `@layer utilities { … }` with `@media` nested inside
   it and no CSS nesting (no `&`), so brace matching is enough and a CSS parser
   would be a dependency bought for nothing. `no CSS nesting` is asserted below
   so the assumption stays honest. */

interface Rule {
  selector: string;
  decls: [string, string][];
  /** enclosing at-rule preludes, outermost first */
  context: string[];
}

const stripComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');
/** The component minus its prose. The doc comment names the labels it must not
 *  hard-code and draws the `<svg>` it must not contain, so a literal search
 *  over the raw file finds the explanation instead of the defect. */
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
      assert.notEqual(end, -1, `section-marker.css: 閉じない宣言ブロック — ${head}`);
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
const matching = (needle: string): Rule[] =>
  rules.filter((r) => selectorsOf(r).some((s) => s.endsWith(needle)));
const declared = (r: Rule, prop: string): string | undefined =>
  r.decls.filter(([p]) => p === prop).at(-1)?.[1];
/** the base `.smk` rule — the one that seats the layer */
const base = (): Rule => {
  const r = matching('.smk').find((x) => declared(x, 'position') !== undefined);
  assert.ok(r, '.smk の座席を決めている規則が無い');
  return r;
};

describe('#46 A\' 章標 — パーサの前提', () => {
  it('CSS ネストを使っていない（ブレース対応だけで読めること）', () => {
    assert.equal(stripComments(CSS).includes('&'), false, 'ネストが入ると上のパーサが嘘になる');
  });

  it('章標の規則を実際に拾えている', () => {
    assert.ok(matching('.smk').length > 0);
    assert.ok(matching('.smk-n').length > 0);
    assert.ok(matching('.smk-l').length > 0);
  });
});

describe('#46 A\' 章標は章扉から出られない', () => {
  it('.smk は高さを持ち、overflow で切られている — 本文まで届く幾何が存在しない', () => {
    const r = base();
    const height = declared(r, 'height');
    assert.ok(height, '.smk に height が無い — 章扉領域が無いということ');
    assert.notEqual(height, 'auto', '.smk の高さが auto — 中身の分だけ伸びる');
    assert.equal(height!.includes('%'), false, `.smk の高さが割合（${height}）— 節の高さに比例して伸びる`);
    assert.equal(declared(r, 'overflow'), 'hidden', '.smk が overflow:hidden で切っていない');
  });

  it('左端は clip-path で measure の外に留めてある', () => {
    const clip = declared(base(), 'clip-path');
    assert.ok(clip, '.smk に clip-path が無い — 左の境界が宣言されていない');
    assert.match(clip!, /^inset\(/, `clip-path が inset() ではない: ${clip}`);
    assert.match(clip!, /--smk-zone-w/, 'clip-path が章扉の幅を参照していない');
  });

  it('章扉の高さは 1 か所でだけ決まる', () => {
    const declaredAt = rules.filter((r) => declared(r, '--smk-zone-h') !== undefined);
    assert.equal(declaredAt.length, 1, `--smk-zone-h が ${declaredAt.length} 箇所 — 章ごとに違う扉にしない`);
  });

  it('どこにも position:fixed / sticky が無い — 章標は節より長生きしない', () => {
    const pinned = rules
      .filter((r) => ['fixed', 'sticky'].includes(declared(r, 'position') ?? ''))
      .map((r) => `${r.selector} (${declared(r, 'position')})`);
    assert.deepEqual(pinned, []);
  });
});

describe('#46 A\' 章標は本文の下にあり、入力を受けない', () => {
  it('.smk は z-index:-1 と pointer-events:none を宣言する', () => {
    const r = base();
    assert.equal(declared(r, 'z-index'), '-1');
    assert.equal(declared(r, 'pointer-events'), 'none');
  });

  it('本文より前に出る z-index をどこにも足していない', () => {
    for (const r of rules) {
      const z = declared(r, 'z-index');
      if (z === undefined || z === 'auto') continue;
      assert.ok(Number(z) < 0, `${r.selector} が z-index:${z} — 装飾は負の層だけ`);
    }
  });
});

describe('#46 A\' 今回は動かさない', () => {
  it('animation / transition / scroll timeline をこの層に足していない', () => {
    const moving = [
      'animation', 'animation-name', 'animation-timeline', 'animation-range',
      'transition', 'transition-property',
      'view-timeline-name', 'view-timeline-axis', 'scroll-timeline-name',
    ];
    for (const r of rules) {
      for (const [prop] of r.decls) {
        assert.equal(
          moving.includes(prop), false,
          `${r.selector} の ${prop} — A' は静止で成立させる。動きは staging レビューの後の判断`,
        );
      }
    }
    assert.equal(/@keyframes/.test(CSS), false, 'この層に @keyframes がある');
  });
});

describe('#46 A\' 既存 folio を置き換える（二重に出さない）', () => {
  const suppression = rules.find((r) =>
    declared(r, 'content') === 'none' && r.selector.includes('::before'),
  );

  it('5 つの章すべてで folio の ::before を落としている', () => {
    assert.ok(suppression, 'folio を落とす規則が無い — 大きい数字が 2 つ出る');
    const ids = selectorsOf(suppression!).map((s) => s.replace(/^\.ad #/, '').replace(/::before$/, ''));
    assert.deepEqual([...ids].sort(), [...MARKER_SECTIONS].sort());
  });

  it('00 HERO の folio には触れていない — 章標ではなくポスターの裏面', () => {
    assert.equal(/\.hero::before/.test(stripComments(CSS)), false);
  });
});

describe('#46 A\' 既存の色と既存のグリッドだけを使う', () => {
  it('新しい色を導入していない — 値はすべて --tx 由来', () => {
    for (const r of rules) {
      for (const [prop, value] of r.decls) {
        if (!/(^|-)color$/.test(prop) && prop !== 'background' && prop !== 'fill') continue;
        if (value === 'var(--tx)') continue;
        assert.match(
          value, /var\(--tx\)/,
          `${r.selector} の ${prop}: ${value} — 既存トークン以外の色を足さない`,
        );
        assert.equal(
          /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/i.test(value), false,
          `${r.selector} の ${prop} が生の色値を持っている: ${value}`,
        );
      }
    }
  });

  it('画像も filter も読み込まない — 図形は 1 つも無い', () => {
    const src = stripComments(CSS);
    assert.equal(/url\(/i.test(src), false, 'url() がある');
    assert.equal(/\bfilter\s*:/i.test(src), false, 'filter がある');
    assert.equal(/\bbackground-image\s*:/i.test(src), false, 'background-image がある');
  });

  it('自分の名前以外を restyle していない（folio を落とす 1 規則を除く）', () => {
    for (const r of rules) {
      for (const s of selectorsOf(r)) {
        if (s.includes('.smk')) continue;
        if (s.endsWith('::before') && declared(r, 'content') === 'none') continue;
        assert.fail(`section-marker.css が ${s} を restyle している`);
      }
    }
  });
});

describe('#46 A\' 章標は JS も独自の文章も持たない', () => {
  it('コンポーネントは script を出さない', () => {
    assert.equal(/<script/i.test(MARKUP), false, 'SectionMarker が script を持っている');
  });

  it('装飾レイヤに aria-hidden が付いている', () => {
    assert.match(
      MARKUP,
      /<div class="smk" data-section-marker=\{section\} aria-hidden="true">/,
      'rail と heading が同じことを言っている以上、章標は読み上げさせない',
    );
  });

  it('描くのは番号と label の 2 つだけで、どちらも式である（文字を打っていない）', () => {
    const body = MARKUP.slice(MARKUP.lastIndexOf('---') + 3);
    const spans = [...body.matchAll(/<span class="(smk-[a-z])">([^<]*)<\/span>/g)];
    assert.deepEqual(
      spans.map((m) => [m[1], (m[2] ?? '').trim()]),
      [['smk-l', '{label}'], ['smk-n', '{index}']],
      '章標の中身は {label} と {index} だけ',
    );
    /* テンプレートに素のテキストノードが無いこと。1 語でも直接書けば、
       それは承認を通っていない公開コピーになる。 */
    const text = body.replace(/<[^>]*>/g, '').replace(/\{[^}]*\}/g, '').replace(/\s+/g, '');
    assert.equal(text, '', `章標が直書きの文字を持っている: ${text.slice(0, 40)}`);
  });

  it('番号も label も SSOT から取る — どちらもこのファイルには書かれていない', () => {
    assert.match(MARKUP, /import \{ sectionNumber \} from '\.\.\/\.\.\/lib\/content\/derive\.ts';/);
    assert.match(MARKUP, /import \{ site \} from '\.\.\/\.\.\/lib\/content\/site\.ts';/);
    assert.match(MARKUP, /sectionNumber\(section\)/, '番号が sectionNumber 由来でない');
    assert.match(MARKUP, /site\.sections\.find\(\(s\) => s\.id === section\)/, 'label が site.sections 由来でない');
    for (const label of ['WORK', 'MORE', 'CAPABILITIES', 'ABOUT', 'CONTACT']) {
      assert.equal(
        new RegExp(`['"\`]${label}['"\`]`).test(CODE), false,
        `SectionMarker に ${label} が直書きされている`,
      );
    }
  });

  it('PR #47 の SVG モチーフの語彙が 1 つも残っていない', () => {
    for (const dead of ['<svg', '<path', '<rect', 'viewBox', 'smo-', 'data-smo', 'vector-effect']) {
      assert.equal(CODE.includes(dead), false, `SectionMarker に ${dead} が残っている`);
      assert.equal(SHEET().includes(dead), false, `section-marker.css に ${dead} が残っている`);
    }
  });
});
