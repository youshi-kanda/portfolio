import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createMockProvider, MOCK_SCENARIOS, MockOcrProvider } from '../src/providers/mock-provider.js';
import { FORM_BLOCKS } from '../scripts/generate-synthetic-document.js';
import { collectBlocks, readOcrResponse } from '../src/ocr-response.js';

describe('MockOcrProvider', () => {
  it('identifies itself as synthetic', () => {
    const provider = createMockProvider();
    assert.equal(provider.id, 'mock');
    assert.equal(provider.mode, 'synthetic');
  });

  it('refuses an unknown scenario', () => {
    assert.throws(() => createMockProvider('live'), /scenario is not supported/);
    assert.throws(() => new MockOcrProvider('anything'), /scenario is not supported/);
  });

  it('returns byte-identical responses across calls and instances', () => {
    const a = JSON.stringify(createMockProvider().annotate());
    const b = JSON.stringify(createMockProvider().annotate());
    const provider = createMockProvider();
    const c = JSON.stringify(provider.annotate());
    const d = JSON.stringify(provider.annotate());

    assert.equal(a, b);
    assert.equal(c, d);
    assert.equal(a, c);
  });

  it('hands out an independent copy each call, so one caller cannot affect the next', () => {
    const provider = createMockProvider();
    const first = provider.annotate();
    first.responses[0].fullTextAnnotation.text = 'mutated';
    assert.notEqual(provider.annotate().responses[0].fullTextAnnotation.text, 'mutated');
  });

  it('offers a failure scenario for every error path the pipeline handles', () => {
    assert.deepEqual([...MOCK_SCENARIOS], [
      'success',
      'provider_error',
      'invalid_response',
      'empty_text',
      'throws',
    ]);
  });
});

describe('the committed fixture matches the generator spec', () => {
  const read = readOcrResponse(createMockProvider().annotate());
  const blocks = collectBlocks(read.pages);

  it('has one block per entry in the form spec', () => {
    assert.equal(blocks.length, FORM_BLOCKS.length);
  });

  it('carries the confidence the spec assigns to each block', () => {
    // Block confidence is a mean over symbols, so compare within tolerance.
    FORM_BLOCKS.forEach((spec, index) => {
      assert.ok(
        Math.abs(blocks[index].confidence - spec.confidence) < 1e-9,
        `block ${index}: ${blocks[index].confidence} != ${spec.confidence}`,
      );
    });
  });

  it('carries the document text the spec describes', () => {
    const expectedText = FORM_BLOCKS.map((block) => block.lines.join('\n')).join('\n\n');
    assert.equal(read.text, expectedText);
  });
});
