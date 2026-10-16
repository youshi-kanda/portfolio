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
 * WHAT CHANGED AFTER THE FIRST STAGING VIDEO. The square used to be drawn only
 * on the current link, so it appeared instantly while the underline beside it
 * took .18s to travel, and for that moment the two marks named different
 * sections. The square is now on every homepage link, collapsed at `scaleX(0)`,
 * and the current link opens it — the same mechanism, duration and easing the
 * frozen sheet gives the underline.
 *
 * So the rule this file used to enforce — "no pseudo-element exists on an
 * inactive link" — is gone, because it was a statement about the mechanism and
 * the mechanism is what changed. It is REPLACED, not relaxed: what a reader can
 * see is still exactly one square, and that is now asserted about `scaleX`
 * rather than about `content`. The timing is not hard-coded here either; it is
 * read off the underline's own rule in `components.css`, so the two cannot
 * drift apart without this failing.
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
/** The frozen sheet, read so the square's timing can be compared with the
 *  underline's actual declaration instead of a literal copied into this file. */
const COMPONENTS = readFileSync(
  new URL('../src/styles/components.css', import.meta.url),
  'utf8',
);
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

/** The rule that seats it — the one that says `position`. Also the rule that
 *  collapses it, since a square that is generated is generated collapsed. */
const seat = (): Rule => {
  const r = squareRules().find((x) => declared(x, 'position') !== undefined);
  assert.ok(r, 'nav の現在地 square を座らせている規則が無い');
  return r;
};

/** The rule that OPENS the square — the one that sets a non-zero `transform`. */
const opener = (): Rule => {
  const r = squareRules().find((x) => {
    const t = declared(x, 'transform');
    return t !== undefined && !/scale[xX]?\(\s*0\s*\)/.test(t);
  });
  assert.ok(r, 'square を開いている規則が無い');
  return r;
};

/** The underline in the frozen sheet, whose timing the square has to match. */
const underline = (): Rule => {
  const r = parse(COMPONENTS).find(
    (x) =>
      x.selector.split(',').some((sel) => /\.nav\b/.test(sel) && /\bol\s+a\b/.test(sel) && /:{1,2}after$/.test(sel.trim())) &&
      declared(x, 'transition') !== undefined,
  );
  assert.ok(r, 'components.css に nav 下線の transition が見つからない');
  return r;
};

/** `.18s` と `0.18s`、`cubic-bezier(.2,0,0,1)` と `cubic-bezier(0.2, 0, 0, 1)` は
 *  同じ値の別表記。片方に揃えてから比べる。 */
const normalise = (value: string): string =>
  /* 先頭 0 の補完が先。空白を落としてからだと `transform .18s` が
     `transform.18s` になり、`.` の手前が英字に見えて補完されない。 */
  value
    .replace(/(^|[^0-9a-zA-Z.])\./g, '$10.')
    .replace(/\s+/g, '')
    .toLowerCase();

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

  it("square を開くのは aria-current='location' だけ", () => {
    for (const s of selectorsOf(opener())) {
      assert.match(
        s,
        /\[aria-current=['"]location['"]\]/,
        `scroll 位置以外の状態まで開いてしまう選択子 — ${s}`,
      );
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

  it('inactive link の square は畳まれている — 生成はされても描かれない', () => {
    /* 契約は「pseudo-element が存在しない」ではなく「見えるものが無い」。
       素の規則は全 link に square を生成するが、それは scaleX(0) で、
       塗る面積を持たない。 */
    const t = declared(seat(), 'transform');
    assert.ok(t, '素の規則が square を畳んでいない — inactive にも見えてしまう');
    assert.match(t, /scale[xX]?\(\s*0\s*\)/, `inactive の transform が畳んでいない — ${t}`);
  });

  it('square を開く規則は 1 本だけ — 見える square は常に 1 個', () => {
    const openers = squareRules().filter((r) => {
      const t = declared(r, 'transform');
      return t !== undefined && !/scale[xX]?\(\s*0\s*\)/.test(t);
    });
    assert.equal(openers.length, 1, `square を開く規則が ${openers.length} 本ある`);
    assert.equal(
      selectorsOf(openers[0]!).length,
      1,
      '開く規則が複数の選択子を持つと、同時に 2 個開く形が作れてしまう',
    );
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

  it('square が動かすのは transform だけ — animation も scroll timeline も無い', () => {
    for (const r of squareRules()) {
      for (const prop of ['animation', 'animation-name', 'animation-timeline']) {
        assert.equal(declared(r, prop), undefined, `${prop} を持っている — ${r.selector}`);
      }
      const t = declared(r, 'transition');
      if (t !== undefined) {
        assert.match(t, /^transform\b/, `transform 以外まで遷移させている — ${t}`);
      }
    }
  });
});

describe("#46 B' square は下線と同じ動き方をする（staging 動画で出たずれ）", () => {
  /* square だけ即時だと、切替の一瞬「square は次の節、下線はまだ前の節から
     遷移中」になる。2 つの印が別の事実を指している状態なので、square を下線の
     timing に合わせる ── 下線を即時化するのではなく。数値はここに書かず
     components.css の下線の宣言から読むので、片方だけ動かすと落ちる。 */

  it('下線と同じ duration / easing', () => {
    const mine = declared(seat(), 'transition');
    assert.ok(mine, 'square に transition が無い — 下線と同時に切り替われない');
    assert.equal(
      normalise(mine),
      normalise(underline().decls.filter(([p]) => p === 'transition').at(-1)![1]),
      'square と下線の transition が一致しない',
    );
  });

  it('下線と同じ transform-origin — 同じ向きに開いて閉じる', () => {
    assert.equal(
      normalise(declared(seat(), 'transform-origin') ?? ''),
      normalise(declared(underline(), 'transform-origin') ?? ''),
      'square と下線の transform-origin が一致しない',
    );
  });

  it('下線と同じ畳み方 — どちらも scaleX(0) から開く', () => {
    assert.match(declared(seat(), 'transform') ?? '', /scale[xX]?\(\s*0\s*\)/);
    assert.match(declared(underline(), 'transform') ?? '', /scale[xX]?\(\s*0\s*\)/);
  });

  it('reduced motion に独自規則を足していない — 凍結シートの 1 本が両方に効く', () => {
    /* components.css の motion 節末尾:
         @media (prefers-reduced-motion: reduce){
           .ad *,.ad *:before,.ad *:after{animation:none!important;
                                          transition-duration:.01ms!important} }
       `!important` は layer 順を反転させるので、`components` のこの宣言が
       `utilities` のこちらに勝つ。square と下線は同じ 1 本で同じ長さに
       詰められる ── それが「reduce でも 2 つが揃っている」ことの根拠。 */
    const frozen = stripComments(COMPONENTS).replace(/\s+/g, '');
    assert.ok(
      frozen.includes('@media(prefers-reduced-motion:reduce)') &&
        frozen.includes('.ad*:before') &&
        frozen.includes('transition-duration:.01ms!important'),
      '凍結シートの reduced-motion 規則が変わっている — square の前提が崩れる',
    );
    for (const r of squareRules()) {
      assert.equal(
        r.context.some((c) => /prefers-reduced-motion/.test(c)),
        false,
        `square が独自の reduced-motion 分岐を持っている — ${r.selector}`,
      );
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

describe('#46 ABOUT → CONTACT の間合い', () => {
  /* staging の scroll 動画で、ABOUT の終わりから CONTACT の罫までが
     「区切り」ではなく「間」に読めた。`components.css:862` の 120px は
     隣り合う節の中で最も広い。88px は新しく選んだ数ではなく `.s-tight`
     ── この組版が既に「詰めた継ぎ目」に使っている刻み。 */
  const LAYOUT = readFileSync(new URL('../src/styles/layout.css', import.meta.url), 'utf8');

  const contactOverride = (): Rule => {
    const r = rules.find(
      (x) =>
        selectorsOf(x).some((sel) => /\.contact$/.test(sel)) &&
        declared(x, 'margin-top') !== undefined,
    );
    assert.ok(r, 'polish.css に .contact の間合いの上書きが無い');
    return r;
  };

  it('88px は新しい数ではなく .s-tight の刻み', () => {
    const tight = parse(LAYOUT).find((r) => selectorsOf(r).some((sel) => /\.s-tight$/.test(sel)));
    assert.ok(tight, 'layout.css に .s-tight が無い');
    const padding = declared(tight, 'padding') ?? '';
    assert.ok(
      padding.split(/\s+/).includes(declared(contactOverride(), 'margin-top') ?? ''),
      `.contact の値が .s-tight（${padding}）の刻みではない`,
    );
  });

  it('desktop / tablet だけを動かし、mobile の既存値は上書きしない', () => {
    const ctx = contactOverride().context.join(' ');
    assert.match(ctx, /min-width:\s*768px/, 'mobile まで一緒に動かしている');
    assert.doesNotMatch(ctx, /max-width/, '上限を切ると広い幅で 120px に戻ってしまう');
  });

  it('CONTACT 自身の箱は動かしていない — 動くのは手前の距離だけ', () => {
    for (const prop of ['padding', 'padding-top', 'padding-bottom', 'border-top', 'margin-bottom']) {
      assert.equal(
        declared(contactOverride(), prop),
        undefined,
        `${prop} は節の中身の話で、ABOUT との間合いではない`,
      );
    }
  });
});
