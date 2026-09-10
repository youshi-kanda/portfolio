/**
 * The FACT provenance matrix.
 *
 * The point of holding the requirement as a table is that the table can be
 * checked: every combination decided exactly once, nothing left to a default,
 * and the two axes actually independent — which is the property V3 did not
 * have and could not have had with one field.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CLAIM_TYPES,
  SOURCE_TYPES,
  type ClaimType,
  type Publication,
} from '../src/lib/content/schema.ts';
import { loadAll } from '../src/lib/content/load.ts';
import {
  PROVENANCE_MATRIX,
  matrixCell,
  provenanceFindings,
  type BasisResolver,
} from '../src/lib/validation/provenance.ts';
import { codes } from './helpers.ts';

const publication = (over: Partial<Publication> = {}): Publication => ({
  reviewStatus: 'approved',
  sourceType: 'source-derived',
  sourceRefs: ['some/file.md:12'],
  approvedBy: null,
  approvedAt: null,
  ...over,
});

/**
 * `claimType` is an argument here for the same reason it is one in the gate:
 * it is a property of the statement being made, not of the publication record,
 * and only a registered string stores it.
 */
const run = (
  p: Publication,
  claimType: ClaimType = 'fact',
  value?: string,
  resolve?: BasisResolver,
) => codes(provenanceFindings({ id: 'copy/x', claimType, publication: p, value, resolve }, 'ERROR'));

/** An `authored` fact that already carries everything its cell asks for. */
const authoredFact = (over: Partial<Publication> = {}): Publication =>
  publication({
    sourceType: 'authored',
    approvedBy: 'user',
    approvedAt: '2026-09-06',
    ...over,
  });

describe('provenance matrix', () => {
  it('decides every claimType × sourceType exactly once', () => {
    assert.equal(PROVENANCE_MATRIX.length, CLAIM_TYPES.length * SOURCE_TYPES.length);
    for (const claimType of CLAIM_TYPES) {
      for (const sourceType of SOURCE_TYPES) {
        const rows = PROVENANCE_MATRIX.filter(
          (c) => c.claimType === claimType && c.sourceType === sourceType,
        );
        assert.equal(rows.length, 1, `${claimType} × ${sourceType}`);
        assert.ok(rows[0]!.why.length > 0, 'every cell states why');
      }
    }
  });

  it('asks a fact for its source, its basis, its approver, or its value', () => {
    assert.deepEqual(run(publication({ sourceType: 'source-derived', sourceRefs: [] })), [
      'T-NO-SOURCE',
    ]);
    // authored is asked for BOTH: the approval record and the grounds. An
    // approval on its own was the hole — it made "someone approved it" the
    // reason a claim was true.
    assert.deepEqual(run(publication({ sourceType: 'authored', sourceRefs: [] })), [
      'T-NO-BASIS',
      'T-NO-APPROVER',
    ]);
    assert.deepEqual(run(publication({ sourceType: 'user-fact' }), 'fact', '   '), [
      'T-EMPTY-FACT',
      'T-NO-APPROVER',
    ]);
  });

  it('refuses an authored fact whose only credential is that it was approved', () => {
    // the case this cell exists for: a claim about the world, written here,
    // carrying an approval and no grounds whatsoever.
    assert.deepEqual(run(authoredFact({ sourceRefs: [] })), ['T-NO-BASIS']);
    assert.deepEqual(run(authoredFact({ sourceRefs: ['', '   '] })), ['T-NO-BASIS']);
  });

  it('accepts an external locator as a basis, and a resolved record too', () => {
    // a planning document section is a real basis this repository cannot check
    assert.deepEqual(run(authoredFact({ sourceRefs: ['portfolio-positioning.md §4'] })), []);
    const resolve: BasisResolver = (ref) => (ref === 'work/crm' ? 'resolved' : 'external');
    assert.deepEqual(run(authoredFact({ sourceRefs: ['work/crm'] }), 'fact', undefined, resolve), []);
  });

  it('refuses a basis that names a record and points at nothing', () => {
    // worse than no basis: it reads as evidenced while resolving to nothing
    const resolve: BasisResolver = () => 'dangling';
    assert.deepEqual(
      run(authoredFact({ sourceRefs: ['evidence/CRM-V99'] }), 'fact', undefined, resolve),
      ['T-NO-BASIS'],
    );
  });

  it('asks nothing of a basis on a source-derived row', () => {
    // sourceRefs is read as a transcription locator there, not as grounds, so
    // a dangling-looking ref is not this cell's business
    const resolve: BasisResolver = () => 'dangling';
    assert.deepEqual(
      run(publication({ sourceRefs: ['evidence/CRM-V99'] }), 'fact', undefined, resolve),
      [],
    );
  });

  it('asks a presentation string for none of them', () => {
    assert.deepEqual(
      run(publication({ sourceType: 'source-derived', sourceRefs: [] }), 'presentation'),
      [],
    );
    assert.deepEqual(run(publication({ sourceType: 'authored' }), 'presentation'), []);
  });

  it('still refuses an empty user-fact even as presentation', () => {
    // an empty value is not a lighter claim, it is a hole in the page
    assert.deepEqual(run(publication({ sourceType: 'user-fact' }), 'presentation', ''), [
      'T-EMPTY-FACT',
    ]);
  });

  it('is satisfied by a record that carries what its cell asks for', () => {
    assert.deepEqual(run(publication()), []);
    assert.deepEqual(run(authoredFact()), []);
  });

  it('keeps shipping approval out of the table', () => {
    // T-UNAPPROVED is truth.ts's, and applies to every cell. The matrix never
    // reports it — conflating "publishable" with "true" is the thing the two
    // axes exist to stop.
    for (const cell of PROVENANCE_MATRIX) {
      assert.ok(
        !cell.requires.includes('sourceRefs' as never) || cell.claimType === 'fact',
        'only facts are asked for provenance',
      );
    }
    const draft = publication({ reviewStatus: 'draft' });
    assert.deepEqual(run(draft, 'presentation'), []);
  });

  it('refuses to guess when a combination has no row', () => {
    assert.throws(() => matrixCell('editorial' as never, 'authored'), /provenance matrix/);
  });

  it('classifies the shipping registries: 120 presentation, the rest fact', () => {
    // 24 facts before V4 Phase 3; the capability rail added six shipping
    // strings, each a claim about what this engineer can do and so each a fact.
    const { copy, uiCopy } = loadAll();
    const all = [...copy, ...uiCopy];
    const presentation = all.filter((c) => c.publication.claimType === 'presentation');
    const fact = all.filter((c) => c.publication.claimType === 'fact');
    assert.equal(presentation.length, 120);
    assert.equal(fact.length, 30);
    // ui-system is the registry's own word for label / heading / button, which
    // is what presentation means on this axis. Nothing else was reclassified.
    assert.equal(
      uiCopy.every((c) => (c.kind === 'ui-system') === (c.publication.claimType === 'presentation')),
      true,
    );
  });
});
