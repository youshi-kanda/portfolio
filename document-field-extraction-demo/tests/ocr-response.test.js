import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { collectBlocks, collectSymbolConfidences, readOcrResponse } from '../src/ocr-response.js';
import { isSafeError } from '../src/safe-errors.js';
import { createMockProvider } from '../src/providers/mock-provider.js';

describe('readOcrResponse on a well-formed response', () => {
  const read = readOcrResponse(createMockProvider().annotate());

  it('reduces the provider payload to text plus pages', () => {
    assert.equal(read.ok, true);
    assert.equal(typeof read.text, 'string');
    assert.equal(read.pageCount, 1);
    assert.equal(read.pages.length, 1);
  });

  it('carries the whole document text', () => {
    assert.ok(read.text.startsWith('EQUIPMENT INSPECTION FORM'));
    assert.ok(read.text.includes('Inspector Role'));
  });
});

describe('readOcrResponse on malformed input', () => {
  const cases = [
    ['not an object', 'ocr_response_invalid'],
    [null, 'ocr_response_invalid'],
    [{}, 'ocr_response_invalid'],
    [{ responses: [] }, 'ocr_response_invalid'],
    [{ responses: [{}, {}] }, 'ocr_response_invalid'],
    [{ responses: [null] }, 'ocr_response_invalid'],
    [{ responses: [{ error: { code: 3 } }] }, 'ocr_provider_error'],
    [{ responses: [{ fullTextAnnotation: null }] }, 'ocr_response_invalid'],
    [{ responses: [{ fullTextAnnotation: { text: 42 } }] }, 'ocr_response_invalid'],
    [{ responses: [{ fullTextAnnotation: { text: '   ' } }] }, 'ocr_text_empty'],
  ];

  for (const [input, code] of cases) {
    it(`rejects ${JSON.stringify(input)?.slice(0, 44) ?? String(input)} as ${code}`, () => {
      const result = readOcrResponse(input);
      assert.equal(isSafeError(result), true);
      assert.equal(result.error_code, code);
    });
  }

  it('tolerates a response with text but no page tree', () => {
    const result = readOcrResponse({ responses: [{ fullTextAnnotation: { text: 'Location\nBay 3' } }] });
    assert.equal(result.ok, true);
    assert.deepEqual(result.pages, []);
    assert.equal(result.pageCount, 1);
  });
});

describe('collectSymbolConfidences', () => {
  it('flattens every symbol confidence in reading order', () => {
    const pages = [
      {
        blocks: [
          { paragraphs: [{ words: [{ symbols: [{ confidence: 0.9 }, { confidence: 0.8 }] }] }] },
          { paragraphs: [{ words: [{ symbols: [{ confidence: 0.7 }] }] }] },
        ],
      },
    ];
    assert.deepEqual(collectSymbolConfidences(pages), [0.9, 0.8, 0.7]);
  });

  it('skips symbols that carry no confidence', () => {
    const pages = [
      { blocks: [{ paragraphs: [{ words: [{ symbols: [{ text: 'x' }, { confidence: 0.5 }] }] }] }] },
    ];
    assert.deepEqual(collectSymbolConfidences(pages), [0.5]);
  });

  it('returns nothing for an absent or empty page tree', () => {
    assert.deepEqual(collectSymbolConfidences(undefined), []);
    assert.deepEqual(collectSymbolConfidences([]), []);
  });
});

describe('collectBlocks', () => {
  const read = readOcrResponse(createMockProvider().annotate());
  const blocks = collectBlocks(read.pages);

  /** Block confidence is a mean, so exact equality is the wrong assertion. */
  const assertCloseTo = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9);

  it('produces one entry per block, with text and mean confidence', () => {
    assert.equal(blocks.length, 13);
    assert.equal(blocks[0].text, 'EQUIPMENT INSPECTION FORM');
    assertCloseTo(blocks[0].confidence, 0.99);
    assert.equal(blocks[0].page_index, 1);
    assert.equal(blocks[0].symbol_count, 23);
  });

  it('reconstructs block text well enough to match a field label', () => {
    const remark = blocks.find((block) => block.text.startsWith('Issue Description'));
    assert.equal(remark.text, 'Issue Description Abnormal vibration detected');
    assertCloseTo(remark.confidence, 0.58);
  });

  it('preserves tick-box glyphs when reconstructing text', () => {
    const photo = blocks.find((block) => block.text.startsWith('Photo Attached'));
    assert.equal(photo.text, 'Photo Attached [ ] No');
  });
});
