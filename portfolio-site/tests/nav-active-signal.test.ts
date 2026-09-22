/**
 * THE NAV ACTIVE SIGNAL CONTRACT (#46 B').
 *
 * The masthead has always known which section the reader is in. What #46 asked
 * for was that it be legible without reading — so one 7px signal square is
 * drawn beside the current link, and nothing else about the masthead changes.
 *
 * WHAT THIS FILE IS FOR, AND WHAT IT DELIBERATELY IS NOT. Three of the four
 * mocked options (signal number, square on every link, thicker underline) were
 * rejected, and each of them was rejected for a reason a browser screenshot
 * cannot re-check on every commit: the number one competes with the chapter
 * marker's own green numeral, the square-on-every-link one widens the `<ol>` by
 * 80px, the underline one is the hover state made heavier. So this file asserts
 * the SHAPE of what shipped — one square, active only, homepage only, drawn in
 * a pseudo-element that costs no layout — and leaves how it looks to the eye.
 *
 * It is not a screenshot in prose. The square's exact inset is not asserted;
 * only that it stays inside the padding the link already has, which is the
 * property that keeps the layout still. A future adjustment of 4px to 3px is a
 * visual decision and should not have to argue with a test.
 *
 * THE SCROLL SPY IS THE OTHER HALF OF THE CONTRACT. This change is CSS, and its
 * correctness rests entirely on an attribute somebody else writes. If the
 * observer's parameters move, or `setCurrent` starts writing a different value,
 * the square silently stops meaning "the section you are in" — so the parts of
 * `Nav.astro` this depends on are pinned here, in the file that depends on them
 * rather than only in the file that owns them.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const CSS = readFileSync(new URL('../src/styles/polish.css', import.meta.url), 'utf8');
const NAV = readFileSync(
  new URL('../src/components/navigation/Nav.astro', import.meta.url),
  'utf8',
);

/** The component minus its prose: the doc comment discusses `aria-current` and
 *  the two lists at length, so a literal search over the raw file would find
 *  the explanation instead of the code. */
const NAV_CODE = NAV.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

/* ---------------------------------------------------------------------- parse

   polish.css is one flat `@layer utilities { … }` with `@media` nested inside
   and no CSS nesting, so brace matching reads it exactly. The no-nesting
   assumption is asserted below rather than trusted. */

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
      assert.notEqual(end, -1, `polish.css: 閉じない宣言ブロック — ${head}`);
      rules.push({
        selector: head,
        decls: declarations(src.slice(i + 1, end)),
        context: [...context],
      });
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

/** Every rule that paints the nav square, at any breakpoint. A rule qualifies
 *  by drawing on a `::before` of a masthead link — not by naming the square,
 *  because the square has no class to name. */
const squareRules = (): Rule[] =>
  rules.filter((r) =>
    selectorsOf(r).some((s) => /\.nav\b/.test(s) && /\bol\s+a\b/.test(s) && s.endsWith('::before')),
  );

/** The rule that seats it — the one that says `position`. */
const seat = (): Rule => {
  const r = squareRules().find((x) => declared(x, 'position') !== undefined);
  assert.ok(r, 'nav の現在地 square を座らせている規則が無い');
  return r;
};

describe("#46 B' nav 現在地 square — パーサの前提", () => {
  it('polish.css は CSS ネストを使っていない（ブレース対応だけで読めること）', () => {
    assert.equal(stripComments(CSS).includes('&'), false, 'ネストが入ると上のパーサが嘘になる');
  });

  it('square の規則を実際に拾えている', () => {
    assert.ok(squareRules().length > 0, 'nav link の ::before を描く規則が 1 本も無い');
  });
});

describe("#46 B' square は HOME の現在 section だけに出る", () => {
  it('どの breakpoint の規則も [data-home-nav] で閉じている — off-home には届かない', () => {
    for (const r of squareRules()) {
      for (const s of selectorsOf(r)) {
        assert.match(
          s,
          /\[data-home-nav\]/,
          `[data-home-nav] が無い選択子は /work/ や /how-i-build/ にも届く — ${s}`,
        );
      }
    }
  });

  it("どの規則も aria-current='location' に限定されている", () => {
    for (const r of squareRules()) {
      for (const s of selectorsOf(r)) {
        assert.match(
          s,
          /\[aria-current=['"]location['"]\]/,
          `scroll 位置以外の状態まで拾う選択子 — ${s}`,
        );
      }
    }
  });

  it('`aria-current="page"` と `data-section` には出ない — 節ではなく route の主張だから', () => {
    for (const r of squareRules()) {
      for (const s of selectorsOf(r)) {
        assert.doesNotMatch(s, /\[aria-current=['"]page['"]\]/, `page 状態まで描いている — ${s}`);
        assert.doesNotMatch(s, /\[data-section\]/, `data-section まで描いている — ${s}`);
      }
    }
  });

  it('`.page ol` の中に限定されている — mobile の `.mob-panel` は兄弟なので構造的に届かない', () => {
    for (const r of squareRules()) {
      for (const s of selectorsOf(r)) {
        assert.match(s, /\.page\s+ol\b/, `.page を経由しない選択子は mobile index も掴む — ${s}`);
        assert.doesNotMatch(s, /\.mob/, `mobile 側を名指ししている — ${s}`);
      }
    }
  });

  it('inactive link には何も描かない — 規則は active 限定のものしか無い', () => {
    const unguarded = rules.filter(
      (r) =>
        selectorsOf(r).some((s) => /\.nav\b/.test(s) && /\bol\s+a\b/.test(s)) &&
        r.decls.some(([p]) => p === 'content') &&
        !selectorsOf(r).every((s) => /\[aria-current=['"]location['"]\]/.test(s)),
    );
    assert.deepEqual(unguarded.map((r) => r.selector), [], 'active 以外に content を描く規則がある');
  });
});

describe("#46 B' square は装飾であって、レイアウトでも情報でもない", () => {
  it('pseudo-element だけで描かれている — DOM も aria も足していない', () => {
    for (const r of squareRules()) {
      for (const s of selectorsOf(r)) {
        assert.ok(s.endsWith('::before'), `pseudo-element 以外を触っている — ${s}`);
      }
    }
    assert.doesNotMatch(NAV_CODE, /class="sq"/, 'nav markup に square 要素が足されている');
    assert.doesNotMatch(
      NAV_CODE,
      /aria-(hidden|label|describedby)/,
      'square のために aria 属性が足されている — aria-current が既に意味を担当している',
    );
  });

  it('flow から外れている — link 幅も nav 幅も当たり判定も動かない', () => {
    assert.equal(declared(seat(), 'position'), 'absolute', 'absolute でないと link 幅が増える');
    for (const r of squareRules()) {
      for (const prop of ['margin', 'margin-left', 'margin-right', 'padding', 'flex', 'float']) {
        assert.equal(declared(r, prop), undefined, `${prop} は箱を動かす — ${r.selector}`);
      }
    }
  });

  it('link が既に持つ左 padding の中に収まっている', () => {
    /* 18px は components.css の padding、12px は responsive.css の ≤1023px。
       inset の正確な値は視覚判断なので固定しない。「padding をはみ出さない」
       だけが、レイアウトが動かないことを保証している性質。 */
    const paddingAt = (r: Rule): number =>
      r.context.some((c) => /max-width:\s*1023px/.test(c)) ? 12 : 18;
    for (const r of squareRules()) {
      const left = declared(r, 'left');
      if (left === undefined) continue;
      const inset = Number.parseFloat(left);
      assert.ok(Number.isFinite(inset), `left が px の数値でない — ${left}`);
      const size = Number.parseFloat(declared(seat(), 'width') ?? '0');
      assert.ok(
        inset >= 0 && inset + size <= paddingAt(r),
        `square が padding をはみ出す: left ${inset} + ${size}px > ${paddingAt(r)}px`,
      );
    }
  });

  it('7px の signal square、それ以上の視覚要素は無い', () => {
    const r = seat();
    assert.equal(declared(r, 'width'), '7px');
    assert.equal(declared(r, 'height'), '7px');
    assert.match(declared(r, 'background') ?? '', /var\(--sig\)/, '--sig 以外の色で塗っている');
    for (const prop of [
      'border',
      'border-radius',
      'box-shadow',
      'filter',
      'backdrop-filter',
      'outline',
      'background-image',
    ]) {
      for (const rule of squareRules()) {
        assert.equal(declared(rule, prop), undefined, `${prop} は #46 が足さないと決めた要素`);
      }
    }
  });

  it('動かない — transform も transition も animation も持たない', () => {
    /* 同じ link の `:after`（下線）が transform を遷移させている。square を
       その property から完全に外しておくと、2 つが 1 つの動く物として合成
       される余地が無い。 */
    for (const r of squareRules()) {
      for (const prop of ['transform', 'transition', 'animation', 'animation-timeline']) {
        assert.equal(declared(r, prop), undefined, `${prop} を持っている — ${r.selector}`);
      }
    }
  });
});

describe("#46 B' が寄りかかっている scroll spy は動いていない", () => {
  it('観測の設定は #46 以前のまま', () => {
    assert.match(NAV_CODE, /rootMargin:\s*'-18% 0px -62% 0px'/, 'rootMargin が変わっている');
    assert.match(
      NAV_CODE,
      /threshold:\s*\[0, 0\.01, 0\.25, 0\.5, 0\.75, 1\]/,
      'threshold が変わっている',
    );
  });

  it("setCurrent は今も `aria-current='location'` を 1 本にだけ書く", () => {
    assert.match(
      NAV_CODE,
      /link\.setAttribute\('aria-current', 'location'\)/,
      'square が待っている属性を書かなくなっている',
    );
    assert.match(
      NAV_CODE,
      /getAttribute\('aria-current'\) === 'location'\) link\.removeAttribute\('aria-current'\)/,
      "外すときに 'location' を確認しなくなると、route の 'page' まで消える",
    );
  });

  it('spy は [data-home-nav] の中しか見ていない — square の gate と同じ根拠', () => {
    assert.match(NAV_CODE, /\[data-home-nav\] \[data-nav-target\]/, 'spy の探索範囲が広がっている');
  });

  it('#46 は script を足していない', () => {
    /* 2 本 = mobile disclosure と scroll spy。3 本目が増えたということは、
       CSS だけで済ませるという #46 の前提が崩れたということ。 */
    assert.equal((NAV.match(/<script>/g) ?? []).length, 2, 'Nav.astro の script 本数が変わった');
  });
});
