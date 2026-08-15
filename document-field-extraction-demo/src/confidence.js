/**
 * Confidence scoring.
 *
 * OCR reports confidence per symbol. A reviewer needs it per field. This
 * module bridges the two in three steps:
 *
 *   1. Aggregate symbol confidences into a page-level baseline.
 *   2. Prefer the confidence of the block a field's label actually sits in,
 *      falling back to the baseline when no block matches.
 *   3. Apply a per-field multiplier for how much the extraction step itself
 *      is trusted for that field.
 *
 * Step 2 is what makes the score useful. A page-wide average says the same
 * thing about a crisp printed serial number and a smudged handwritten remark
 * beside it; a block-level score does not.
 */

import { CONFIDENCE, CONFIDENCE_LEVEL, NEUTRAL_CONFIDENCE } from './config.js';
import { FIELD_DEFINITIONS } from './field-definitions.js';
import { collectSymbolConfidences } from './ocr-response.js';

/** Round to two decimals and clamp into [0, 1]. */
export function toScore(value) {
  if (!Number.isFinite(value)) return 0;
  const clamped = Math.min(1, Math.max(0, value));
  return Math.round(clamped * 100) / 100;
}

/**
 * Mean confidence across every symbol on the page.
 *
 * Falls back to a neutral 0.5 when the response carries no confidences at all,
 * so a provider that omits them yields "undecided" rather than "perfect".
 */
export function aggregateSymbolConfidence(pages) {
  const confidences = collectSymbolConfidences(pages);
  if (confidences.length === 0) return NEUTRAL_CONFIDENCE;
  const total = confidences.reduce((sum, value) => sum + value, 0);
  return total / confidences.length;
}

/** First block whose reconstructed text contains one of the field's labels. */
export function findBlockForKeywords(blocks, keywords) {
  for (const keyword of keywords) {
    const match = blocks.find((block) => block.text.includes(keyword));
    if (match && typeof match.confidence === 'number') return match;
  }
  return null;
}

/** Assign a confidence band to a single field score. */
export function classifyLevel(score) {
  if (typeof score !== 'number' || Number.isNaN(score)) return CONFIDENCE_LEVEL.UNREADABLE;
  if (score >= CONFIDENCE.HIGH) return CONFIDENCE_LEVEL.HIGH;
  if (score >= CONFIDENCE.MEDIUM_MIN) return CONFIDENCE_LEVEL.MEDIUM;
  if (score <= 0) return CONFIDENCE_LEVEL.UNREADABLE;
  return CONFIDENCE_LEVEL.LOW;
}

/** Field names scoring below the review threshold, in catalogue order. */
export function detectLowConfidenceFields(fieldConfidences) {
  return Object.keys(fieldConfidences).filter(
    (name) => fieldConfidences[name] < CONFIDENCE.MEDIUM_MIN,
  );
}

/**
 * Score every field in the catalogue.
 *
 * A field with no extracted value scores 0 rather than inheriting the page
 * baseline. Reporting high confidence in a value that does not exist is the
 * one outcome a review gate must never produce.
 */
export function scoreFields({ blocks, baseline, extraction, definitions = FIELD_DEFINITIONS }) {
  const fieldConfidences = {};
  const fieldLevels = {};
  const fieldSources = {};

  for (const definition of definitions) {
    const name = definition.name;

    if (extraction.values[name] === null || extraction.values[name] === undefined) {
      fieldConfidences[name] = 0;
      fieldLevels[name] = CONFIDENCE_LEVEL.UNREADABLE;
      fieldSources[name] = 'missing';
      continue;
    }

    const block = findBlockForKeywords(blocks, definition.keywords);
    const base = block ? block.confidence : baseline;
    const score = toScore(base * definition.multiplier);

    fieldConfidences[name] = score;
    fieldLevels[name] = classifyLevel(score);
    fieldSources[name] = block ? 'block' : 'page_baseline';
  }

  return { fieldConfidences, fieldLevels, fieldSources };
}
