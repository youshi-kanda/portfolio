/**
 * Structural validation. Shape only — whether a claim may ship is truth-gate
 * territory and is tested separately.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { loadAll } from '../src/lib/content/load.ts';
import {
  caseStudySchema,
  copySchema,
  evidenceSchema,
  uiCopySchema,
  workSchema,
} from '../src/lib/content/schema.ts';
import { workFigure, workVisual } from '../src/lib/content/derive.ts';
import { site } from '../src/lib/content/site.ts';
import { clone, sampleWork } from './helpers.ts';

describe('content schema', () => {
  it('accepts the shipping content as it stands', () => {
    const { works, evidence, copy } = loadAll();
    // counted from the directory rather than written down: the assertion is
    // that the loader finds every record, which is what it was always for
    const onDisk = readdirSync(new URL('../src/content/work/', import.meta.url)).filter((f) =>
      f.endsWith('.json'),
    );
    assert.equal(works.length, onDisk.length);
    for (const w of works) assert.doesNotThrow(() => workSchema.parse(w));
    for (const e of evidence) assert.doesNotThrow(() => evidenceSchema.parse(e));
    for (const c of copy) assert.doesNotThrow(() => copySchema.parse(c));
  });

  it('keeps claimType on strings and off records', () => {
    // claimType asks whether a SENTENCE asserts or presents. A work is not a
    // sentence, and a field defaulted onto every record to answer a question
    // it was never asked is a field a reader still has to check.
    const { works, caseStudies, copy, uiCopy } = loadAll();

    for (const w of works) assert.equal('claimType' in w.publication, false);
    for (const c of caseStudies) assert.equal('claimType' in c.publication, false);
    for (const c of [...copy, ...uiCopy]) assert.equal('claimType' in c.publication, true);

    // and the schemas, not just today's data: a claimType written onto a work
    // does not survive the parse, so it cannot start meaning something later.
    const stamped = clone(sampleWork()) as Record<string, unknown>;
    stamped['publication'] = { ...sampleWork().publication, claimType: 'presentation' };
    assert.equal('claimType' in workSchema.parse(stamped).publication, false);

    // a copy row that omits it is read as making a claim, never as presenting
    const row = clone(copy[0]!) as Record<string, unknown>;
    const pub = { ...copy[0]!.publication } as Record<string, unknown>;
    delete pub['claimType'];
    row['publication'] = pub;
    assert.equal(copySchema.parse(row).publication.claimType, 'fact');
  });

  it('holds every record schema to one publication shape or the other', () => {
    const { caseStudies, uiCopy } = loadAll();
    for (const c of caseStudies) assert.doesNotThrow(() => caseStudySchema.parse(c));
    for (const c of uiCopy) assert.doesNotThrow(() => uiCopySchema.parse(c));
  });

  it('requires the entry figure of a work that ships, and only of one', () => {
    // A figure is the work's rendering. Demanding one from a work that does
    // not render would mean the only way to register it is to point at
    // somebody else's image or invent one.
    const w = clone(sampleWork()) as Record<string, unknown>;
    delete w['image'];

    assert.throws(() => workSchema.parse({ ...w, shipping: true }), /image/);
    assert.doesNotThrow(() => workSchema.parse({ ...w, shipping: false }));

    // and the accessor is total for everything a renderer can reach
    assert.equal(workFigure(sampleWork()).src, sampleWork().image?.src);
    assert.throws(
      () => workFigure(workSchema.parse({ ...w, shipping: false })),
      /描画された/,
    );
  });

  it('requires the art direction of a work that ships, and only of one', () => {
    // The pigment set has three members assigned to three works. A fourth is
    // a decision someone makes looking at the page, not a default a schema
    // can supply — so a work that does not render is not asked for one.
    const w = clone(sampleWork()) as Record<string, unknown>;
    delete w['visual'];

    assert.throws(() => workSchema.parse({ ...w, shipping: true }), /visual/);
    assert.doesNotThrow(() => workSchema.parse({ ...w, shipping: false }));

    assert.equal(workVisual(sampleWork()).entryVariant, sampleWork().visual?.entryVariant);
    assert.throws(
      () => workVisual(workSchema.parse({ ...w, shipping: false })),
      /描画された/,
    );
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
    assert.equal(site.sections.length > 0, true);
    assert.equal(typeof site.hero.stackLine, 'string');
  });
});

/**
 * V4 fields. Additive: every one is optional or defaulted, so the V3 content
 * on disk parses unchanged.
 */
describe('V4 fields', () => {
  const showcase = {
    source: { access: 'public-repo', path: 'ai-crm-demo/' },
    demoScope: ['AI provider の既定は mock'],
    verification: { tests: { summary: 'x', count: 484, source: 'CI ログ' } },
  };

  it('accepts a work carrying both the legacy fields and showcase', () => {
    const w = workSchema.parse({ ...sampleWork(), showcase });
    assert.equal(w.showcase?.source.path, 'ai-crm-demo/');
    assert.equal(w.showcase?.verification.tests?.count, 484);
    // defaulted, not written by the author
    assert.equal(w.showcase?.verification.verificationId, null);
  });

  it('refuses a source that claims to be public with nowhere to look', () => {
    assert.throws(() =>
      workSchema.parse({
        ...sampleWork(),
        showcase: { ...showcase, source: { access: 'public-repo', path: null } },
      }),
    );
  });

  it('refuses to record a path for a source that is not public', () => {
    // the private path is exactly what must never enter this repository
    assert.throws(() =>
      workSchema.parse({
        ...sampleWork(),
        showcase: { ...showcase, source: { access: 'private-repo', path: 'client/secret/' } },
      }),
    );
  });

  it('accepts a private source that names no path', () => {
    const w = workSchema.parse({
      ...sampleWork(),
      showcase: {
        source: { access: 'private-repo' },
        demoScope: [],
        verification: { tests: null, verificationId: 'rin-authority-v1' },
      },
    });
    assert.equal(w.showcase?.source.path, null);
    assert.equal(w.showcase?.demoScope.length, 0);
  });

  it('accepts a palette key and refuses a colour value', () => {
    // Content names the slot. What the slot resolves to — and how it resolves
    // in light, dark and inverse — is the design system's, and a hex here
    // would be the same colour written down in two places.
    const w = sampleWork();
    assert.doesNotThrow(() => workSchema.parse({ ...w, visual: { ...w.visual, palette: 'a' } }));
    assert.throws(() =>
      workSchema.parse({ ...w, visual: { ...w.visual, palette: { name: '常磐', hex: '#14654A' } } }),
    );
    assert.throws(() => workSchema.parse({ ...w, visual: { ...w.visual, palette: '#14654A' } }));
  });

  it('accepts homepageRole = lead and nothing else', () => {
    assert.doesNotThrow(() => workSchema.parse({ ...sampleWork(), homepageRole: 'lead' }));
    assert.throws(() => workSchema.parse({ ...sampleWork(), homepageRole: 'hero' }));
  });

  it('has every Evidence record SAY what it is, rather than defaulting to one', () => {
    // `screenshot` is the schema default, so a record that says nothing parses
    // as a capture. That was harmless while every record WAS a capture; the day
    // a drawn record arrived it stopped being harmless, because the difference
    // between "this is a photograph of the thing" and "this is a drawing of the
    // idea" is the whole provenance question.
    //
    // Counted from disk rather than pinned at a number: this states the
    // invariant — every record declares its kind, and only a drawing carries a
    // diagram record — at whatever the collection currently holds.
    const { evidence } = loadAll();
    assert.ok(evidence.length > 0);

    for (const e of evidence) {
      const raw = JSON.parse(
        readFileSync(new URL(`../src/content/evidence/${e.id}.json`, import.meta.url), 'utf8'),
      ) as Record<string, unknown>;
      assert.ok(
        raw.kind === 'screenshot' || raw.kind === 'diagram',
        `${e.id} states its kind rather than relying on the default`,
      );
      assert.equal(raw.kind, e.kind);
      assert.equal(e.diagram === null, e.kind !== 'diagram', `${e.id}: diagram ⇔ kind=diagram`);
    }

    // The V3 captures, named: a screenshot silently becoming a diagram is the
    // one change this check would otherwise wave through.
    const byId = new Map(evidence.map((e) => [e.id, e]));
    for (const id of ['CRM-V06', 'DFE-V01', 'PPM-V02']) {
      assert.equal(byId.get(id)?.kind, 'screenshot', `${id} is a capture`);
    }
  });

  it('requires a diagram record on a diagram, and forbids one on a screenshot', () => {
    const base = clone(loadAll().evidence[0]!) as Record<string, unknown>;
    const diagram = {
      verificationId: 'rin-authority-v1',
      publicBasis: '公開できる範囲の記述',
      generalizes: ['実案件の権限モデル'],
      omits: ['顧客名', 'Private Repository の所在'],
    };
    assert.throws(() => evidenceSchema.parse({ ...base, kind: 'diagram' }));
    assert.throws(() => evidenceSchema.parse({ ...base, kind: 'screenshot', diagram }));
    assert.doesNotThrow(() => evidenceSchema.parse({ ...base, kind: 'diagram', diagram }));
  });

});

/**
 * The three states a work may be in for the length of the migration.
 * Which one it is in is a question of shape, so it is settled here; whether a
 * Dual work's two records AGREE is a question of claims, and is settled by the
 * Truth Gate — see tests/migration-gate.test.ts.
 */
describe('transitional work schema (MIGRATE)', () => {
  const showcase = {
    source: { access: 'public-repo', path: 'ai-crm-demo/' },
    demoScope: ['AI provider の既定は mock'],
    verification: { tests: { summary: 'x', count: 484, source: 'CI ログ' } },
  };

  /**
   * Fixtures start from a work with the legacy set and NO showcase, whatever
   * state the sample work happens to be in on disk. Deriving them from the
   * live record is what made these tests assert "nothing has migrated yet" —
   * a fact about the calendar, not about the schema.
   */
  const legacyOnly = (): Record<string, unknown> => {
    const w = clone(sampleWork()) as Record<string, unknown>;
    delete w['showcase'];
    return w;
  };

  const without = (...fields: string[]): Record<string, unknown> => {
    const w = legacyOnly();
    for (const f of fields) delete w[f];
    return w;
  };

  /** Which of the three states a record is in, by shape alone. */
  const stateOf = (w: Record<string, unknown>): string => {
    const legacy = ['repoPath', 'publicDemoScope', 'tests'].filter((f) => w[f] !== undefined);
    if (legacy.length === 3 && w['showcase']) return 'Dual';
    if (legacy.length === 3) return 'Legacy-only';
    if (legacy.length === 0 && w['showcase']) return 'V4-only';
    return `illegal (legacy ${legacy.length}/3, showcase ${w['showcase'] ? 'yes' : 'no'})`;
  };

  it('holds every work on disk in one of the three legal states', () => {
    const LEGAL = new Set(['Legacy-only', 'V4-only', 'Dual']);
    for (const w of loadAll().works) {
      assert.doesNotThrow(() => workSchema.parse(w));
      const state = stateOf(w as unknown as Record<string, unknown>);
      assert.ok(LEGAL.has(state), `work/${w.slug}: ${state}`);
    }
  });

  it('accepts V4-only', () => {
    const v4Only = { ...without('repoPath', 'publicDemoScope', 'tests'), showcase };
    const parsed = workSchema.parse(v4Only);
    assert.equal(parsed.repoPath, undefined);
    assert.equal(parsed.showcase?.source.path, 'ai-crm-demo/');
  });

  it('accepts Dual', () => {
    assert.doesNotThrow(() => workSchema.parse({ ...legacyOnly(), showcase }));
  });

  it('refuses a partial legacy set', () => {
    // two of the three is not a migration state, it is a work that lost a fact
    assert.throws(() => workSchema.parse(without('tests')));
    assert.throws(() => workSchema.parse(without('repoPath', 'publicDemoScope')));
    assert.throws(() => workSchema.parse({ ...without('tests'), showcase }));
  });

  it('refuses a work that states neither', () => {
    assert.throws(() => workSchema.parse(without('repoPath', 'publicDemoScope', 'tests')));
  });
});
