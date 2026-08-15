import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  aggregateSymbolConfidence,
  classifyLevel,
  detectLowConfidenceFields,
  findBlockForKeywords,
  scoreFields,
  toScore,
} from '../src/confidence.js';
import { CONFIDENCE, CONFIDENCE_LEVEL, NEUTRAL_CONFIDENCE } from '../src/config.js';
import { collectBlocks, readOcrResponse } from '../src/ocr-response.js';
import { extractFields } from '../src/extractor.js';
import { createMockProvider } from '../src/providers/mock-provider.js';

/** Symbol confidences are averaged, so exact equality is the wrong assertion. */
function assertCloseTo(actual, expected, message) {
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    message ?? `expected ${actual} to be close to ${expected}`,
  );
}

function pageWithSymbols(confidences) {
  return [
    {
      blocks: [
        {
          paragraphs: [{ words: [{ symbols: confidences.map((c) => ({ text: 'x', confidence: c })) }] }],
        },
      ],
    },
  ];
}

describe('toScore', () => {
  it('rounds to two decimals and clamps into [0, 1]', () => {
    assert.equal(toScore(0.8739), 0.87);
    assert.equal(toScore(1.4), 1);
    assert.equal(toScore(-0.2), 0);
    assert.equal(toScore(Number.NaN), 0);
  });
});

describe('aggregateSymbolConfidence', () => {
  it('averages every symbol confidence on the page', () => {
    assertCloseTo(aggregateSymbolConfidence(pageWithSymbols([0.9, 0.7, 0.8])), 0.8);
  });

  it('falls back to neutral when the response carries no confidences', () => {
    // "Undecided" is the safe reading of a provider that reports nothing.
    // Treating it as perfect would let unscored pages skip review entirely.
    assert.equal(aggregateSymbolConfidence([]), NEUTRAL_CONFIDENCE);
    assert.equal(aggregateSymbolConfidence(pageWithSymbols([])), NEUTRAL_CONFIDENCE);
  });
});

describe('classifyLevel', () => {
  it('places scores in the right band', () => {
    assert.equal(classifyLevel(0.95), CONFIDENCE_LEVEL.HIGH);
    assert.equal(classifyLevel(CONFIDENCE.HIGH), CONFIDENCE_LEVEL.HIGH);
    assert.equal(classifyLevel(0.8), CONFIDENCE_LEVEL.MEDIUM);
    assert.equal(classifyLevel(CONFIDENCE.MEDIUM_MIN), CONFIDENCE_LEVEL.MEDIUM);
    assert.equal(classifyLevel(0.4), CONFIDENCE_LEVEL.LOW);
    assert.equal(classifyLevel(0), CONFIDENCE_LEVEL.UNREADABLE);
  });
});

describe('findBlockForKeywords', () => {
  const blocks = [
    { text: 'Inspection Date 2026-08-15', confidence: 0.96 },
    { text: 'Next Inspection Date 2026-11-15', confidence: 0.88 },
  ];

  it('returns the first block whose text carries the label', () => {
    assert.equal(findBlockForKeywords(blocks, ['Inspection Date']).confidence, 0.96);
    assert.equal(findBlockForKeywords(blocks, ['Next Inspection Date']).confidence, 0.88);
  });

  it('returns null when no block carries any spelling of the label', () => {
    assert.equal(findBlockForKeywords(blocks, ['Inspector Role']), null);
  });
});

describe('scoreFields on the synthetic document', () => {
  const read = readOcrResponse(createMockProvider().annotate());
  const extraction = extractFields(read.text);
  const blocks = collectBlocks(read.pages);
  const baseline = aggregateSymbolConfidence(read.pages);
  const { fieldConfidences, fieldSources } = scoreFields({ blocks, baseline, extraction });

  it('scores each field from its own block rather than the page average', () => {
    // The page averages 0.86. The handwritten remark sits in a 0.58 block and
    // must not inherit the page's optimism.
    assert.equal(toScore(baseline), 0.86);
    assert.equal(fieldConfidences.issue_description, 0.49);
    assert.equal(fieldConfidences.document_id, 0.98);
    assert.ok(Object.values(fieldSources).every((source) => source === 'block'));
  });

  it('applies the per-field multiplier', () => {
    // location sits in a 0.94 block and carries a 0.95 multiplier.
    assert.equal(fieldConfidences.location, 0.89);
  });

  it('flags exactly the two weak fields', () => {
    assert.deepEqual(detectLowConfidenceFields(fieldConfidences), [
      'issue_description',
      'inspector_role',
    ]);
  });
});

describe('scoreFields with a missing value', () => {
  it('scores a field with no value at zero instead of inheriting the baseline', () => {
    // Reporting high confidence in a value that does not exist is the one
    // outcome a review gate must never produce.
    const extraction = { values: { location: null }, rawValues: {}, missingFields: ['location'] };
    const definitions = [{ name: 'location', keywords: ['Location'], multiplier: 1 }];
    const { fieldConfidences, fieldLevels, fieldSources } = scoreFields({
      blocks: [{ text: 'Location Warehouse A', confidence: 0.99 }],
      baseline: 0.99,
      extraction,
      definitions,
    });

    assert.equal(fieldConfidences.location, 0);
    assert.equal(fieldLevels.location, CONFIDENCE_LEVEL.UNREADABLE);
    assert.equal(fieldSources.location, 'missing');
  });

  it('falls back to the page baseline when no block matches the label', () => {
    const extraction = { values: { location: 'Bay 3' }, rawValues: {}, missingFields: [] };
    const definitions = [{ name: 'location', keywords: ['Location'], multiplier: 1 }];
    const { fieldConfidences, fieldSources } = scoreFields({
      blocks: [{ text: 'unrelated block', confidence: 0.99 }],
      baseline: 0.8,
      extraction,
      definitions,
    });

    assert.equal(fieldConfidences.location, 0.8);
    assert.equal(fieldSources.location, 'page_baseline');
  });
});
