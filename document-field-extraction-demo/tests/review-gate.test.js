import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { evaluate, isQualityInsufficient } from '../src/review-gate.js';
import { REVIEW_REASON, REVIEW_STATUS } from '../src/config.js';

/** Ten fields at `high`, then `lowCount` fields at 0.4. */
function confidences(lowCount, total = 10, high = 0.95) {
  const map = {};
  for (let i = 0; i < total; i += 1) {
    map[`field_${i}`] = i < lowCount ? 0.4 : high;
  }
  return map;
}

describe('isQualityInsufficient', () => {
  it('is false when a minority of fields are weak', () => {
    assert.equal(isQualityInsufficient(confidences(3), 10), false);
  });

  it('is true once more than 30% of fields are weak', () => {
    assert.equal(isQualityInsufficient(confidences(4), 10), true);
  });

  it('is false for an empty field set rather than dividing by zero', () => {
    assert.equal(isQualityInsufficient({}, 0), false);
  });
});

describe('evaluate', () => {
  it('passes when every field is reliable and present', () => {
    const result = evaluate({ fieldConfidences: confidences(0), requiredFields: [] });

    assert.equal(result.status, REVIEW_STATUS.PASSED);
    assert.equal(result.confirm_allowed, true);
    assert.deepEqual(result.reasons, []);
  });

  it('sends a document with a few weak fields to review, naming each one', () => {
    const result = evaluate({ fieldConfidences: confidences(2), requiredFields: [] });

    assert.equal(result.status, REVIEW_STATUS.REVIEW_REQUIRED);
    assert.equal(result.confirm_allowed, false);
    assert.deepEqual(result.reasons, [
      { code: REVIEW_REASON.LOW_CONFIDENCE, field: 'field_0' },
      { code: REVIEW_REASON.LOW_CONFIDENCE, field: 'field_1' },
    ]);
  });

  it('blocks the page when most of it is weak instead of routing it field by field', () => {
    // Handing a reviewer a scan they also cannot read is not a review task.
    const result = evaluate({ fieldConfidences: confidences(8), requiredFields: [] });

    assert.equal(result.status, REVIEW_STATUS.BLOCKED);
    assert.equal(result.confirm_allowed, false);
    assert.deepEqual(result.reasons, [{ code: REVIEW_REASON.LOW_OCR_QUALITY, field: null }]);
  });

  it('holds a document whose required field is missing, even when the rest is clean', () => {
    // Enough healthy fields that the one gap stays under the blocking ratio;
    // otherwise this would be a capture problem rather than a review task.
    const result = evaluate({
      fieldConfidences: { ...confidences(0), equipment_id: 0 },
      missingFields: ['equipment_id'],
      requiredFields: ['equipment_id'],
    });

    assert.equal(result.status, REVIEW_STATUS.REVIEW_REQUIRED);
    assert.deepEqual(result.reasons, [
      { code: REVIEW_REASON.REQUIRED_FIELD_MISSING, field: 'equipment_id' },
    ]);
    assert.deepEqual(result.missing_required_fields, ['equipment_id']);
  });

  it('ignores a missing optional field', () => {
    const result = evaluate({
      fieldConfidences: { location: 0.99 },
      missingFields: ['photo_attached'],
      requiredFields: ['location'],
    });

    assert.equal(result.status, REVIEW_STATUS.PASSED);
  });

  it('reports a zero-confidence field as unreadable rather than merely low', () => {
    const result = evaluate({
      fieldConfidences: { a: 0, b: 0.99, c: 0.99, d: 0.99 },
      missingFields: ['a'],
      requiredFields: [],
    });

    assert.deepEqual(result.reasons, [{ code: REVIEW_REASON.UNREADABLE_FIELD, field: 'a' }]);
  });

  it('does not report the same field twice', () => {
    const result = evaluate({
      fieldConfidences: { a: 0, b: 0.99, c: 0.99, d: 0.99 },
      missingFields: ['a'],
      requiredFields: ['a'],
    });

    assert.equal(result.reasons.length, 1);
    assert.equal(result.reasons[0].code, REVIEW_REASON.REQUIRED_FIELD_MISSING);
  });

  it('never auto-confirms: passing means no attention needed, not confirmed', () => {
    const result = evaluate({ fieldConfidences: confidences(0), requiredFields: [] });
    assert.equal(result.confirm_allowed, true);
    assert.equal(Object.hasOwn(result, 'confirmed'), false);
  });
});
