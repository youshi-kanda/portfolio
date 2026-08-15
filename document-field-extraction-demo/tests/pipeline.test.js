import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { runExtractionPipeline, SYNTHETIC_CLOCK } from '../src/index.js';
import { createMockProvider } from '../src/providers/mock-provider.js';
import { loadOutputSchema } from '../src/schema.js';
import { REVIEW_STATUS } from '../src/config.js';
import { FIELD_NAMES } from '../src/field-definitions.js';

const schema = loadOutputSchema();

const EXPECTED = JSON.parse(
  readFileSync(new URL('../fixtures/expected-output.json', import.meta.url), 'utf8'),
);

describe('runExtractionPipeline on the synthetic document', () => {
  const result = runExtractionPipeline({ provider: createMockProvider(), schema });

  it('produces exactly the committed expected output', () => {
    assert.equal(result.ok, true);
    assert.deepEqual(result.output, EXPECTED);
  });

  it('validates against the output schema', () => {
    assert.deepEqual(result.validation, { valid: true, errors: [] });
  });

  it('holds the document for review and names the two weak fields', () => {
    assert.equal(result.review.status, REVIEW_STATUS.REVIEW_REQUIRED);
    assert.equal(result.review.confirm_allowed, false);
    assert.deepEqual(
      result.review.reasons.map((reason) => reason.field),
      ['issue_description', 'inspector_role'],
    );
  });

  it('scores every field in the catalogue', () => {
    assert.deepEqual(
      Object.keys(result.output.extraction_metadata.field_confidences),
      [...FIELD_NAMES],
    );
  });

  it('records provenance for the run', () => {
    const metadata = result.output.extraction_metadata;
    assert.equal(metadata.provider_id, 'mock');
    assert.equal(metadata.provider_mode, 'synthetic');
    assert.equal(metadata.extracted_at, SYNTHETIC_CLOCK);
  });
});

describe('runExtractionPipeline determinism', () => {
  it('produces identical output across runs', () => {
    const first = runExtractionPipeline({ provider: createMockProvider(), schema });
    const second = runExtractionPipeline({ provider: createMockProvider(), schema });
    assert.equal(JSON.stringify(first.output), JSON.stringify(second.output));
  });

  it('produces identical output across separate provider instances', () => {
    const a = runExtractionPipeline({ provider: createMockProvider('success'), schema });
    const b = runExtractionPipeline({ provider: createMockProvider('success'), schema });
    assert.deepEqual(a.output, b.output);
  });

  it('records the clock the caller supplies', () => {
    const now = '2030-06-01T12:00:00.000Z';
    const result = runExtractionPipeline({ provider: createMockProvider(), schema, now });
    assert.equal(result.output.extraction_metadata.extracted_at, now);
  });
});

describe('runExtractionPipeline failure paths', () => {
  it('returns extraction_failed with no output when the provider throws', () => {
    const result = runExtractionPipeline({ provider: createMockProvider('throws'), schema });
    assert.equal(result.ok, false);
    assert.equal(result.output, null);
    assert.equal(result.review.status, REVIEW_STATUS.EXTRACTION_FAILED);
    assert.equal(result.validation, null);
  });

  it('returns extraction_failed when the response carries no text', () => {
    const result = runExtractionPipeline({ provider: createMockProvider('empty_text'), schema });
    assert.equal(result.ok, false);
    assert.equal(result.error.error_code, 'ocr_text_empty');
  });

  it('reports schema violations instead of returning invalid output as ok', () => {
    // A provider whose page carries a confidence outside [0, 1] would otherwise
    // produce an out-of-range score that silently escapes the contract.
    const tightened = structuredClone(schema);
    tightened.properties.review.properties.status.enum = ['passed'];

    const result = runExtractionPipeline({ provider: createMockProvider(), schema: tightened });
    assert.equal(result.ok, false);
    assert.equal(result.error.error_code, 'schema_validation_failed');
    assert.equal(result.validation.valid, false);
    assert.ok(result.output, 'output is still returned so the failure can be inspected');
  });

  it('runs without a schema when none is supplied', () => {
    const result = runExtractionPipeline({ provider: createMockProvider() });
    assert.equal(result.ok, true);
    assert.equal(result.validation, null);
  });
});
