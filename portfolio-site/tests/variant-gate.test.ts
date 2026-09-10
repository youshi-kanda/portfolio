/**
 * The entry-variant gate — art-direction §12 as revised 2026-08-26.
 *
 * The revision this suite pins down: two neighbours sharing a variant is a
 * WARNING, not a failure. Failing on it forced authors to declare a variant
 * they did not mean in order to get a green build, and the variant is a claim
 * about what the work is.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ENTRY_VARIANTS } from '../src/lib/content/schema.ts';
import { variantFloor, variantGate } from '../src/lib/validation/variant.ts';
import { codes } from './helpers.ts';

const list = (...variants: string[]) =>
  variants.map((entryVariant, i) => ({ slug: `w${i + 1}`, entryVariant }));

const errorsOf = (f: ReturnType<typeof variantGate>) => f.filter((x) => x.level === 'ERROR');
const warningsOf = (f: ReturnType<typeof variantGate>) => f.filter((x) => x.level === 'WARN');

describe('variant gate', () => {
  it('passes the shipping assignment (stage / split / terminal)', () => {
    const f = variantGate(list('v-stage', 'v-split', 'v-terminal'));
    assert.deepEqual(errorsOf(f), []);
    assert.deepEqual(warningsOf(f), []);
  });

  it('fails an unknown variant and names the implemented ones', () => {
    const f = variantGate(list('v-stage', 'v-carousel', 'v-terminal'));
    const e = errorsOf(f);
    assert.deepEqual(codes(e), ['E-UNKNOWN']);
    for (const known of ENTRY_VARIANTS) assert.match(e[0]!.message, new RegExp(known));
  });

  it('warns — but does not fail — on two adjacent works sharing a variant', () => {
    const f = variantGate(list('v-stage', 'v-stage', 'v-split'));
    assert.deepEqual(errorsOf(f), []);
    assert.deepEqual(codes(warningsOf(f)), ['W-ADJACENT']);
  });

  it('promotes the adjacency warning to an error only under --strict', () => {
    const f = variantGate(list('v-stage', 'v-stage', 'v-split'), { strict: true });
    assert.deepEqual(codes(errorsOf(f)), ['W-ADJACENT']);
  });

  it('fails three or more consecutive works sharing a variant', () => {
    const f = variantGate(list('v-stage', 'v-stage', 'v-stage', 'v-split'));
    assert.equal(codes(errorsOf(f)).includes('E-RUN'), true);
  });

  it('fails a list that has collapsed to too few distinct variants', () => {
    // 4 works alternating between 2 variants: no run, no monotony at this
    // length — the floor is 2 up to 7 works
    const ok = variantGate(list('v-stage', 'v-split', 'v-stage', 'v-split'));
    assert.deepEqual(errorsOf(ok), []);

    // 8 works need 3 distinct; this list offers 2
    const tooFew = variantGate(
      list('v-stage', 'v-split', 'v-stage', 'v-split', 'v-stage', 'v-split', 'v-stage', 'v-split'),
    );
    assert.deepEqual(codes(errorsOf(tooFew)), ['E-MONOTONY']);
  });

  it('accepts 0, 1 and 2 works without demanding variety', () => {
    for (const l of [list(), list('v-stage'), list('v-stage', 'v-split')]) {
      assert.deepEqual(errorsOf(variantGate(l)), []);
    }
    // two works sharing one variant is a warning at most, never a failure
    assert.deepEqual(errorsOf(variantGate(list('v-stage', 'v-stage'))), []);
  });

  it('states the diversity floor: 1–2 → 1, 3–7 → 2, 8+ → 3', () => {
    const size = ENTRY_VARIANTS.length;
    assert.equal(variantFloor(0, size), 0);
    assert.equal(variantFloor(1, size), 1);
    assert.equal(variantFloor(2, size), 1);
    assert.equal(variantFloor(3, size), 2);
    assert.equal(variantFloor(7, size), 2);
    assert.equal(variantFloor(8, size), 3);
    assert.equal(variantFloor(20, size), 3);
  });

  it('never asks for more variants than the palette holds', () => {
    assert.equal(variantFloor(20, 2), 2);
  });
});
