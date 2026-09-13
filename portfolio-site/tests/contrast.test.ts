/**
 * THE TEXT CONTRAST CONTRACT.
 *
 * #10 Minor, and it was the whole tertiary layer rather than one label:
 * `--tx3` and `--held` were #8A8E93, which is 2.95:1 on `--paper`. Every
 * supporting string on the site is set in it — the rail labels, the register
 * numbers and their meta lines, the figure captions, the footer, the HOLD
 * marks — most of them at 10.5–11px. The separators were worse: `.sep` was
 * painted with `--hair2`, a HAIRLINE token, at 2.24:1.
 *
 * Nothing about that is visible in a diff, and "it looks a bit light" is not a
 * finding anyone can act on. So the ratios are computed here, from the tokens
 * themselves, and the build fails below AA.
 *
 * WHY THE TOKENS AND NOT THE PAGE. A rendered-page sweep is what FOUND this —
 * every visible text node across ten routes, measured against its resolved
 * background — but it needs a browser and a server, so it cannot run on every
 * commit. The tokens are where the values live and where a regression would be
 * introduced, and a pairing table is small enough to state exactly. The browser
 * sweep stays the discovery tool; this is the guard.
 *
 * The pairings below are the ones the sweep actually observed, not every
 * combination the cascade could theoretically produce.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const TOKENS = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');

/* ------------------------------------------------------------------ colour */

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function hex(value: string): Rgb {
  const h = value.trim().replace('#', '');
  assert.match(h, /^[0-9a-fA-F]{6}$/, `6 桁の hex ではない: ${value}`);
  return {
    r: Number.parseInt(h.slice(0, 2), 16),
    g: Number.parseInt(h.slice(2, 4), 16),
    b: Number.parseInt(h.slice(4, 6), 16),
  };
}

/** WCAG 2.x relative luminance. */
function luminance({ r, g, b }: Rgb): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(hex(a)), luminance(hex(b))].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/* ------------------------------------------------------------------ tokens

   Read out of the stylesheet rather than restated here. A table of colours
   copied into a test is a table that goes stale silently: it would keep
   asserting the old value's ratio while the sheet shipped a new one. */

/** The value of `--name` inside the block opened by `selector`. */
function token(selector: string, name: string): string {
  const at = TOKENS.indexOf(selector);
  assert.notEqual(at, -1, `tokens.css に ${selector} が無い`);
  const open = TOKENS.indexOf('{', at);
  const close = TOKENS.indexOf('}', open);
  const block = TOKENS.slice(open, close);
  const found = new RegExp(`--${name}\\s*:\\s*(#[0-9a-fA-F]{6})`).exec(block);
  assert.ok(found, `${selector} に --${name} が無い`);
  return found![1]!;
}

const light = (name: string) => token('.ad{', name);
const dark = (name: string) => token('.ad[data-t="dark"]{', name);
const inv = (name: string) => token('.ad .inv{', name);

const AA_NORMAL = 4.5;
const AA_NON_TEXT = 3; // WCAG 1.4.11 — focus rings and other UI boundaries

describe('text contrast — tokens.css', () => {
  /* The canary: if `contrast` itself broke, every assertion below would pass
     vacuously, which is the one failure a contract test cannot afford. */
  it('computes known ratios correctly', () => {
    assert.equal(Number(contrast('#000000', '#FFFFFF').toFixed(2)), 21);
    assert.equal(Number(contrast('#FFFFFF', '#FFFFFF').toFixed(2)), 1);
    // the value that failed in #10, kept as a fixture so the number stays real
    assert.equal(Number(contrast('#8A8E93', '#F4F2ED').toFixed(2)), 2.95);
  });

  it('sets every light text token above AA on the grounds it is used on', () => {
    const paper = light('paper');
    const failures: string[] = [];
    for (const name of ['tx', 'tx2', 'tx3', 'held']) {
      const ratio = contrast(light(name), paper);
      if (ratio < AA_NORMAL) failures.push(`--${name} ${light(name)} on --paper ${paper}: ${ratio.toFixed(2)}:1`);
    }
    assert.deepEqual(failures, [], `light の本文トークンが AA (${AA_NORMAL}:1) を下回っている`);
  });

  it('sets every dark text token above AA on the grounds it is used on', () => {
    const failures: string[] = [];
    for (const [label, get] of [['dark', dark], ['inv', inv]] as const) {
      const paper = get('paper');
      for (const name of ['tx', 'tx2', 'tx3', 'held']) {
        const ratio = contrast(get(name), paper);
        if (ratio < AA_NORMAL) failures.push(`${label} --${name} ${get(name)} on --paper ${paper}: ${ratio.toFixed(2)}:1`);
      }
    }
    assert.deepEqual(failures, [], `dark / inv の本文トークンが AA (${AA_NORMAL}:1) を下回っている`);
  });

  /* The hierarchy the fix had to preserve. Darkening `--tx3` until it passed
     was easy; darkening it past `--tx2` would have flattened the type system
     the tertiary layer exists to express, and the page would have lost a
     distinction while gaining a ratio. */
  it('keeps the three text weights distinguishable', () => {
    for (const [label, get] of [['light', light], ['dark', dark]] as const) {
      const paper = get('paper');
      const [tx, tx2, tx3] = [contrast(get('tx'), paper), contrast(get('tx2'), paper), contrast(get('tx3'), paper)];
      assert.ok(tx > tx2!, `${label}: --tx (${tx!.toFixed(2)}) は --tx2 (${tx2!.toFixed(2)}) より強いこと`);
      assert.ok(tx2! > tx3!, `${label}: --tx2 (${tx2!.toFixed(2)}) は --tx3 (${tx3!.toFixed(2)}) より強いこと`);
    }
  });

  /* `--hair2` is a hairline token at 2.24:1 on paper, which is the intended
     weight for a 1px rule and is NOT text. It stayed where it was; what moved
     was `.sep`, which had been borrowing it. This asserts the borrowing does
     not come back. */
  it('never paints text with a hairline token', () => {
    const components = readFileSync(new URL('../src/styles/components.css', import.meta.url), 'utf8');
    const offenders = [...components.matchAll(/([^{}]+)\{([^}]*)\}/g)]
      .filter(([, , body]) => /(?:^|;)\s*color\s*:\s*var\(--hair2?\)/.test(body!))
      .map(([, selector]) => selector!.trim().replace(/\s+/g, ' '));
    assert.deepEqual(
      offenders,
      [],
      'color に --hair / --hair2 を使わないこと（罫線用のトークンで、text としては AA を満たさない）',
    );
  });

  it('keeps the focus ring visible against every ground it is drawn on', () => {
    // `--sig` in all its work pigments; the ring is `2px solid var(--sig)`
    const pigments = [...TOKENS.matchAll(/--sig\s*:\s*(#[0-9a-fA-F]{6})/g)].map(([, c]) => c!);
    assert.ok(pigments.length >= 8, `--sig の値が ${pigments.length} 件しか読めていない`);
    const grounds = [light('paper'), light('paper2'), light('plate'), dark('paper'), dark('paper2'), dark('plate')];
    const failures: string[] = [];
    for (const sig of pigments) {
      // each pigment belongs to one theme; it only has to clear the best of
      // the two grounds it can legitimately appear on
      const best = Math.max(...grounds.map((g) => contrast(sig, g)));
      if (best < AA_NON_TEXT) failures.push(`--sig ${sig}: best ${best.toFixed(2)}:1`);
    }
    assert.deepEqual(failures, [], `focus ring が非テキスト最低比 (${AA_NON_TEXT}:1) を満たしていない`);
  });
});
