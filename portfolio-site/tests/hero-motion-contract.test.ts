/**
 * THE HERO MOTION CONTRACT.
 *
 * #9 Major: on a first load and on reload the hero's display, role, lede and
 * both CTAs were blank — not late, BLANK — for up to 0.96s, and were still
 * blank at first-contentful-paint. The cause was structural rather than a bad
 * number: motion.css gave the elements that CARRY THE SENTENCE a hidden
 * initial state (`clip-path: inset(0 0 100% 0)`) and handed the only way out of
 * it to a CSS animation. Anything that delayed the animation delayed the
 * sentence, and the reader waited on an opening to be told what the page is.
 *
 * So the fix is a contract, not a retuning, and this file is the contract:
 *
 *   MEANINGFUL HERO CONTENT IS VISIBLE AT FIRST PAINT, ALWAYS.
 *
 *   No JavaScript, a late module, an IntersectionObserver that never fires, an
 *   engine with no CSS animations at all — none of them is a precondition for
 *   reading the hero. Motion is decoration laid OVER content that can already
 *   be read.
 *
 * WHY A STYLESHEET IS PARSED HERE rather than a browser driven. The invariant
 * is a property of the source — "this stylesheet contains no rule that can
 * hide the sentence" — and that is stronger than any number of passing page
 * loads, which only ever say "it did not hide it this time, on this engine, at
 * this speed". The browser checks were run by hand against the real build and
 * are recorded in the PR; this is the one that runs on every commit.
 *
 * The allowlist is of DECORATION, deliberately inverted: a new element added
 * inside the hero is meaningful until someone says otherwise, so a future
 * `.hero .tagline` is covered by this test the day it is written and does not
 * need anyone to remember to add it.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const CSS_PATH = new URL('../src/styles/motion.css', import.meta.url);

/* --------------------------------------------------------------------- parse

   motion.css is one flat `@layer motion { … }` with at-rules nested inside it
   and no CSS nesting anywhere (no `&`), so brace matching is enough and a real
   CSS parser would be a dependency bought for nothing. `assertNoNesting` below
   is what keeps that assumption honest. */

interface Rule {
  /** the selector list, comments stripped and whitespace collapsed */
  selector: string;
  /** the declaration block, `prop: value` pairs */
  decls: [string, string][];
  /** the enclosing at-rule preludes, outermost first */
  context: string[];
}

/** Strips `/* … *\/` comments without touching string literals (there are none
    in this sheet beyond `content:''`, which holds no slash). */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
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
      // a style rule: read to the matching brace. No nesting, so the first
      // `}` closes it.
      const end = src.indexOf('}', i);
      assert.notEqual(end, -1, `motion.css: 閉じない宣言ブロック — ${head}`);
      const body = src.slice(i + 1, end);
      rules.push({ selector: head, decls: declarations(body), context: [...context] });
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

/* ------------------------------------------------------------------- hiding

   Five ways a stylesheet can make an element unreadable, and the one that
   caused #9 is the least obvious of them: `clip-path: inset(0 0 100% 0)` is a
   box clipped to zero height and reads, in a diff, like a layout nicety.

   #10 ADDS THE FIFTH: a zero scale. `transform: scaleX(0)` collapses the box
   to no area exactly as the clip did, and it is the gesture this sheet reaches
   for most — every plane in the opening arrives by being scaled up from zero.
   That is correct FOR DECORATION, and the allowlist keeps it legal there; what
   the contract could not see until now is the same gesture applied to the
   sentence. A future `.hero .dsp { transform: scaleY(0) }` would have
   reproduced #9 with a different property and passed this file.

   The axes are treated independently because either one at zero is enough:
   `scale(1, 0)` is as invisible as `scale(0)`. */

/** x and y scale factors of a transform list, or null where none is stated. */
function scaleFactors(value: string): { x: number; y: number } | null {
  let x: number | null = null;
  let y: number | null = null;
  const num = (s: string) => {
    const n = Number(s.trim());
    return Number.isFinite(n) ? n : null;
  };
  for (const [, fn, argstr] of value.matchAll(/([a-z0-9]+)\(([^)]*)\)/gi)) {
    const args = argstr!.split(',').map((s) => s.trim());
    switch (fn!.toLowerCase()) {
      case 'scale': {
        const a = num(args[0] ?? '');
        const b = args.length > 1 ? num(args[1]!) : a;
        if (a !== null) x = a;
        if (b !== null) y = b;
        break;
      }
      case 'scalex': { const a = num(args[0] ?? ''); if (a !== null) x = a; break; }
      case 'scaley': { const a = num(args[0] ?? ''); if (a !== null) y = a; break; }
      case 'scale3d': {
        const a = num(args[0] ?? ''); const b = num(args[1] ?? '');
        if (a !== null) x = a;
        if (b !== null) y = b;
        break;
      }
      // matrix(a, b, c, d, e, f): a and d are the axis scales. Only the plain
      // axis-aligned case is judged — a rotated matrix has a non-zero
      // determinant even with a === 0, and guessing at one would be a test
      // that fails on correct CSS.
      case 'matrix': {
        if (args.length !== 6) break;
        const [a, b, c, d] = [num(args[0]!), num(args[1]!), num(args[2]!), num(args[3]!)];
        if (b !== 0 || c !== 0) break;
        if (a !== null) x = a;
        if (d !== null) y = d;
        break;
      }
      default: break;
    }
  }
  if (x === null && y === null) return null;
  return { x: x ?? 1, y: y ?? 1 };
}

function hidesCompletely(prop: string, value: string): string | null {
  const v = value.toLowerCase();
  if (prop === 'opacity' && /^0(\.0+)?$/.test(v)) return 'opacity: 0';
  if (prop === 'visibility' && (v === 'hidden' || v === 'collapse')) return `visibility: ${v}`;
  if (prop === 'display' && v === 'none') return 'display: none';
  if (prop === 'content-visibility' && v === 'hidden') return 'content-visibility: hidden';
  if (prop === 'transform' || prop === 'scale') {
    // `scale: 0` / `scale: 1 0` — the standalone property takes bare numbers
    const s = prop === 'scale' ? scaleFactors(`scale(${v.split(/\s+/).join(', ')})`) : scaleFactors(v);
    if (s && (s.x === 0 || s.y === 0)) return `${prop}: ${value}`;
  }
  if (prop === 'clip-path') {
    const inset = /^inset\(([^)]*)\)/.exec(v);
    if (!inset) return null;
    // one side at 100% (or more) collapses the box whatever the other three are
    const sides = inset[1]!.split(/\s+/).filter((s) => !/^round$/i.test(s));
    for (const side of sides) {
      const pct = /^(\d+(?:\.\d+)?)%$/.exec(side);
      if (pct && Number(pct[1]) >= 100) return `clip-path: ${value}`;
    }
  }
  return null;
}

/* --------------------------------------------------------------- keyframes

   A rule can hide an element without naming a hiding property: it can name a
   keyframe that starts at nothing. With any fill mode at all — and `both` was
   what shipped — the element is that first frame for the whole of its
   `animation-delay`, and is it again for the first instant of every play. So a
   keyframe whose 0% hides is treated exactly like a hiding declaration. */

function hidingKeyframes(rules: Rule[]): Map<string, string> {
  const found = new Map<string, string>();
  for (const rule of rules) {
    const at = rule.context[rule.context.length - 1];
    if (!at?.startsWith('@keyframes ')) continue;
    const name = at.slice('@keyframes '.length).trim();
    const stops = rule.selector.split(',').map((s) => s.trim().toLowerCase());
    if (!stops.some((s) => s === 'from' || s === '0%')) continue;
    for (const [prop, value] of rule.decls) {
      const how = hidesCompletely(prop, value);
      if (how) found.set(name, how);
    }
  }
  return found;
}

/** Every keyframe name a rule plays, from `animation` or `animation-name`. */
function animationNames(rule: Rule, known: Set<string>): string[] {
  const out: string[] = [];
  for (const [prop, value] of rule.decls) {
    if (prop !== 'animation' && prop !== 'animation-name') continue;
    for (const token of value.split(/[\s,]+/)) {
      if (known.has(token)) out.push(token);
    }
  }
  return out;
}

/* ------------------------------------------------------------ hero subjects

   DECORATION IS THE ALLOWLIST. A selector inside the hero is treated as
   carrying meaning unless its subject — the rightmost compound — is one of the
   furniture elements below or a pseudo-element. Getting it this way round is
   the point: the test covers hero content that does not exist yet.

     .hf / .hf-plate / .hf-base   the poster's back plane (aria-hidden)
     .mx-stage / .mx-rule /
     .mx-tick                     the fixed instrument layer (aria-hidden)
     ::before / ::after           generated content, by definition not the copy
     :empty                       an element with no content in it. Row 2's
                                  rail is the grid spacer that keeps the lede
                                  aligned under the display, and at one track
                                  it is 56px of nothing; `:empty` is the
                                  selector saying so, so the rule cannot reach
                                  a rail that has something in it.

   `.hero` itself and its layout containers (`.page`, `.tr`) are NOT on the
   list: hiding one of them hides everything inside it. */
const DECORATIVE_SUBJECT =
  /(?:\.hf|\.hf-plate|\.hf-base|\.mx-stage|\.mx-rule|\.mx-tick|:empty|::before|::after|:before|:after)$/;

/** Does this selector list contain a complex selector that (a) is scoped to the
    hero and (b) has a meaningful subject? Returns the offending parts. */
function heroMeaningfulParts(selector: string): string[] {
  return selector
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.includes('.hero'))
    .filter((s) => !DECORATIVE_SUBJECT.test(s));
}

const rules = parse(readFileSync(CSS_PATH, 'utf8'));
const hiders = hidingKeyframes(rules);
const known = new Set(hiders.keys());

describe('hero motion contract — motion.css', () => {
  /* The parser's assumptions, asserted rather than trusted. If motion.css ever
     grows CSS nesting these tests would silently start reading half the file,
     and a contract test that passes by not looking is worse than no test. */
  it('parses the whole sheet — no CSS nesting, at least one rule per section', () => {
    const raw = stripComments(readFileSync(CSS_PATH, 'utf8'));
    assert.equal(/^\s*&/m.test(raw), false, 'motion.css に CSS nesting が入った — parser を書き直すこと');
    /* #10 — this was `rules.length > 200`, and the cap3 cleanup took the sheet
       to 195 and failed a test that had found nothing wrong. A magic number
       here is a guard that has to be renumbered every time the sheet is
       legitimately edited, and one that is renumbered on a red build is not a
       guard. Counting the blocks in the source says the same thing exactly —
       "the parser reached every rule" — and needs no maintenance. */
    const blocks = (raw.match(/\{/g) ?? []).length;
    const atRules = (raw.match(/@[a-z-]+[^{;]*\{/gi) ?? []).length;
    assert.equal(
      rules.length,
      blocks - atRules,
      `rules=${rules.length} だが style rule は ${blocks - atRules} 件ある — parse が途中で止まっている`,
    );
  });

  /* The canary. Without it this file could pass because `hidesCompletely` had
     been broken, which is the failure mode a contract test cannot afford. */
  it('recognises a hiding keyframe when it sees one', () => {
    assert.equal(
      hiders.get('mx-draw-in'),
      'clip-path: inset(0 0 100% 0)',
      'mx-draw-in は 0% で全隠しする keyframe。これを検出できないなら detector が壊れている',
    );
    assert.equal(hidesCompletely('opacity', '0'), 'opacity: 0');
    assert.equal(hidesCompletely('visibility', 'hidden'), 'visibility: hidden');
    assert.equal(hidesCompletely('display', 'none'), 'display: none');
    assert.equal(hidesCompletely('clip-path', 'inset(0 0 100% 0)'), 'clip-path: inset(0 0 100% 0)');
    assert.equal(hidesCompletely('clip-path', 'inset(-30% -8%)'), null);
    assert.equal(hidesCompletely('opacity', '1'), null);
  });

  /* #10 — the same canary for the zero-scale detector. Each of these is a way
     the sheet could collapse the sentence to nothing, and each of the last
     four is a transform this sheet legitimately uses on decoration, so the
     detector has to separate "zero" from "moves" rather than from "transform". */
  it('recognises a zero scale, on either axis, however it is written', () => {
    assert.equal(hidesCompletely('transform', 'scale(0)'), 'transform: scale(0)');
    assert.equal(hidesCompletely('transform', 'scaleX(0)'), 'transform: scaleX(0)');
    assert.equal(hidesCompletely('transform', 'scaleY(0)'), 'transform: scaleY(0)');
    assert.equal(hidesCompletely('transform', 'scale(1, 0)'), 'transform: scale(1, 0)');
    assert.equal(hidesCompletely('transform', 'scale3d(0, 1, 1)'), 'transform: scale3d(0, 1, 1)');
    assert.equal(hidesCompletely('transform', 'matrix(0, 0, 0, 1, 0, 0)'), 'transform: matrix(0, 0, 0, 1, 0, 0)');
    assert.equal(hidesCompletely('transform', 'translate3d(0, 6px, 0) scaleX(0)'), 'transform: translate3d(0, 6px, 0) scaleX(0)');
    assert.equal(hidesCompletely('scale', '0'), 'scale: 0');
    assert.equal(hidesCompletely('scale', '1 0'), 'scale: 1 0');

    // …and does not fire on the transforms the hero actually uses
    assert.equal(hidesCompletely('transform', 'translate3d(0, 6px, 0)'), null);
    assert.equal(hidesCompletely('transform', 'scale(1)'), null);
    assert.equal(hidesCompletely('transform', 'scaleX(1)'), null);
    assert.equal(hidesCompletely('transform', 'none'), null);
    assert.equal(hidesCompletely('transform', 'translate3d(0, 120px, 0)'), null);
    assert.equal(hidesCompletely('scale', '1'), null);
  });

  /* The allowlist has to keep doing its job now that scale is a hiding
     property: the opening is BUILT out of planes scaled up from zero, and if
     this test could not tell them from the sentence it would have to be
     deleted the day it shipped. */
  it('still allows the decorative planes to arrive from a zero scale', () => {
    const zeroScaled = rules.filter((r) =>
      r.decls.some(([p, v]) => (p === 'transform' || p === 'scale') && hidesCompletely(p, v)),
    );
    assert.ok(
      zeroScaled.length >= 3,
      `zero-scale の装飾規則が ${zeroScaled.length} 件しか無い — 検出器か allowlist のどちらかが壊れている`,
    );
    assert.deepEqual(
      zeroScaled.flatMap((r) => heroMeaningfulParts(r.selector)),
      [],
      '装飾の zero scale は許可されるが、meaningful hero content の zero scale は許可しない',
    );
  });

  it('finds the hero rules it is supposed to be guarding', () => {
    const guarded = rules.filter((r) => heroMeaningfulParts(r.selector).length > 0);
    assert.ok(
      guarded.length >= 8,
      `hero の meaningful rule が ${guarded.length} 件しか見つからない — selector matcher が壊れている`,
    );
  });

  /* ------------------------------------------------------------ the invariant */

  it('never gives meaningful hero content a hidden initial state', () => {
    const violations: string[] = [];
    for (const rule of rules) {
      for (const part of heroMeaningfulParts(rule.selector)) {
        for (const [prop, value] of rule.decls) {
          const how = hidesCompletely(prop, value);
          if (how) violations.push(`${part} { ${how} }`);
        }
      }
    }
    assert.deepEqual(
      violations,
      [],
      'HERO の意味を持つ要素は初期状態で可視でなければならない（#9 motion contract）',
    );
  });

  it('never plays a keyframe that starts hidden on meaningful hero content', () => {
    const violations: string[] = [];
    for (const rule of rules) {
      const parts = heroMeaningfulParts(rule.selector);
      if (parts.length === 0) continue;
      for (const name of animationNames(rule, known)) {
        for (const part of parts) {
          violations.push(`${part} { animation: ${name} } — ${name} の 0% は ${hiders.get(name)}`);
        }
      }
    }
    assert.deepEqual(
      violations,
      [],
      'HERO 本文の表示を animation の完了に依存させないこと（#9 motion contract）',
    );
  });

  /* A visible element that spends a second travelling is not blank, but it is
     not settled either, and the reader is still being asked to wait on the
     opening. The settle is allowed to be a settle and nothing more. */
  it('keeps the hero settle short — no long delay on meaningful content', () => {
    const slow: string[] = [];
    for (const rule of rules) {
      const parts = heroMeaningfulParts(rule.selector);
      if (parts.length === 0) continue;
      for (const [prop, value] of rule.decls) {
        const times = [...value.matchAll(/(\d+(?:\.\d+)?)(m?s)/g)].map(([, n, unit]) =>
          unit === 'ms' ? Number(n) / 1000 : Number(n),
        );
        if (prop === 'animation-delay' && times.some((t) => t > 0.2)) {
          slow.push(`${part(parts)} { animation-delay: ${value} }`);
        }
        if (prop === 'animation' && times.length > 1 && times[1]! > 0.2) {
          slow.push(`${part(parts)} { animation: ${value} }`);
        }
      }
    }
    assert.deepEqual(slow, [], 'HERO 本文に 0.2s を超える animation-delay を付けないこと');
  });
});

const part = (parts: string[]) => parts[0]!;
