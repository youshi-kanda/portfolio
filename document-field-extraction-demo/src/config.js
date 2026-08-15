/**
 * Pipeline thresholds and status vocabulary.
 *
 * The confidence bands and the low-confidence ratio threshold are the values
 * used by the original production workflow this demo is derived from.
 */

export const CONFIDENCE = Object.freeze({
  /** A field at or above this score is treated as reliable. */
  HIGH: 0.9,
  /** A field below this score is flagged for human review. */
  MEDIUM_MIN: 0.7,
  /**
   * If more than this share of fields fall below MEDIUM_MIN, the page itself
   * is considered too poor to review field-by-field and the whole document is
   * blocked instead.
   */
  LOW_RATIO_THRESHOLD: 0.3,
});

/** Confidence band assigned to a single field. */
export const CONFIDENCE_LEVEL = Object.freeze({
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
  UNREADABLE: 'UNREADABLE',
});

/** Terminal decision of the review gate for one document. */
export const REVIEW_STATUS = Object.freeze({
  /** Every field is reliable and every required field is present. */
  PASSED: 'passed',
  /** Usable extraction, but at least one field needs a human to confirm it. */
  REVIEW_REQUIRED: 'review_required',
  /** Page quality is too low to route field-by-field; re-capture the document. */
  BLOCKED: 'blocked',
  /** No usable OCR response, so no fields were produced at all. */
  EXTRACTION_FAILED: 'extraction_failed',
});

/** Machine-readable reasons attached to a non-passing review decision. */
export const REVIEW_REASON = Object.freeze({
  REQUIRED_FIELD_MISSING: 'required_field_missing',
  LOW_CONFIDENCE: 'low_confidence',
  UNREADABLE_FIELD: 'unreadable_field',
  LOW_OCR_QUALITY: 'low_ocr_quality',
});

/** Confidence used when a page carries no per-symbol confidence at all. */
export const NEUTRAL_CONFIDENCE = 0.5;

/**
 * How far past a field label the extractor will look for that field's value,
 * when no later field label cuts the window short first.
 */
export const KEYWORD_WINDOW_CHARS = 200;
