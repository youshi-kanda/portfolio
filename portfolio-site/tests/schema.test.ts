/**
 * Structural validation. Shape only — whether a claim may ship is truth-gate
 * territory and is tested separately.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadAll } from '../src/lib/content/load.ts';
import { copySchema, evidenceSchema, workSchema } from '../src/lib/content/schema.ts';
import { site } from '../src/lib/content/site.ts';
import { clone, sampleWork } from './helpers.ts';

describe('content schema', () => {
  it('accepts the shipping content as it stands', () => {
    const { works, evidence, copy } = loadAll();
    assert.equal(works.length, 3);
    for (const w of works) assert.doesNotThrow(() => workSchema.parse(w));
    for (const e of evidence) assert.doesNotThrow(() => evidenceSchema.parse(e));
    for (const c of copy) assert.doesNotThrow(() => copySchema.parse(c));
  });

  it('rejects a work missing a required field', () => {
    const broken = clone(sampleWork()) as Record<string, unknown>;
    delete broken['purpose'];
    assert.throws(() => workSchema.parse(broken));
  });

  it('rejects a work whose required array is empty', () => {
    // "no problem stated" is not a work description, it is an omission
    assert.throws(() => workSchema.parse({ ...sampleWork(), problem: [] }));
  });

  it('rejects a field of the wrong type', () => {
    assert.throws(() =>
      workSchema.parse({ ...sampleWork(), tests: { summary: 'x', count: 'many', source: 'y' } }),
    );
  });

  it('rejects an unknown frame, ground or texture token', () => {
    const w = sampleWork();
    assert.throws(() => workSchema.parse({ ...w, visual: { ...w.visual, frame: 'fr-glow' } }));
    assert.throws(() => workSchema.parse({ ...w, visual: { ...w.visual, ground: 'neon' } }));
    assert.throws(() => workSchema.parse({ ...w, visual: { ...w.visual, texture: 'noise' } }));
  });

  it('lets an unknown ENTRY variant through to the variant gate', () => {
    // Deliberate: the closed set is defined by which renderers exist, so an
    // unknown variant must surface as E-UNKNOWN naming the implemented ones,
    // not as a type error that says nothing about renderers.
    const w = sampleWork();
    assert.doesNotThrow(() =>
      workSchema.parse({ ...w, visual: { ...w.visual, entryVariant: 'v-carousel' } }),
    );
  });

  it('rejects an invalid review record', () => {
    const w = sampleWork();
    assert.throws(() =>
      workSchema.parse({ ...w, publication: { ...w.publication, reviewStatus: 'looks-fine' } }),
    );
    assert.throws(() =>
      workSchema.parse({ ...w, publication: { ...w.publication, sourceType: 'vibes' } }),
    );
  });

  it('validates the singleton site content at module load', () => {
    // site.ts parses on import; reaching this line means it passed
    assert.equal(site.nav.length > 0, true);
    assert.equal(typeof site.derived.heroLede.template, 'string');
  });
});
