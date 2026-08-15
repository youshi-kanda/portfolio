/**
 * Pipeline orchestration.
 *
 *   provider -> OCR response -> extraction -> normalisation
 *            -> confidence scoring -> review gate -> structured output
 *
 * Each stage is a pure function over the previous stage's output, except the
 * provider call itself. That is what makes the whole run reproducible: given
 * the same response and the same clock, the output is byte-identical.
 */

import { REVIEW_STATUS } from './config.js';
import { DOCUMENT_TYPE, FIELD_DEFINITIONS, SCHEMA_VERSION } from './field-definitions.js';
import { extractFields } from './extractor.js';
import { aggregateSymbolConfidence, scoreFields, toScore } from './confidence.js';
import { collectBlocks, readOcrResponse } from './ocr-response.js';
import { evaluate } from './review-gate.js';
import { createSafeError, isSafeError } from './safe-errors.js';
import { validate } from './schema-validator.js';

/**
 * Clock used when the caller does not supply one.
 *
 * The demo and the tests both run on this fixed value so their output is
 * reproducible and can be committed as a golden file. A real deployment passes
 * an actual timestamp.
 */
export const SYNTHETIC_CLOCK = '2026-01-01T00:00:00.000Z';

/**
 * Run the full pipeline.
 *
 * @param {object}  options
 * @param {object}  options.provider  object exposing `annotate()`, plus `id` and `mode`
 * @param {string} [options.now]      ISO timestamp recorded in the output
 * @param {object} [options.schema]   output schema; when given, the result is validated
 * @returns {{ok: boolean, output: object|null, review: object, validation: object|null, error: object|null}}
 */
export function runExtractionPipeline({ provider, now = SYNTHETIC_CLOCK, schema = null }) {
  let response;
  try {
    response = provider.annotate();
  } catch {
    // The provider's own error is discarded rather than wrapped: it may carry
    // a URL, a payload fragment or a credential, and none of that belongs in
    // an error that will be logged.
    return failure(createSafeError('extraction_failed'));
  }

  const read = readOcrResponse(response);
  if (isSafeError(read)) return failure(read);

  const extraction = extractFields(read.text, FIELD_DEFINITIONS);
  const blocks = collectBlocks(read.pages);
  const baseline = aggregateSymbolConfidence(read.pages);
  const { fieldConfidences, fieldLevels } = scoreFields({ blocks, baseline, extraction });

  const review = evaluate({
    fieldConfidences,
    missingFields: extraction.missingFields,
  });

  const output = {
    extraction_metadata: {
      document_type: DOCUMENT_TYPE,
      schema_version: SCHEMA_VERSION,
      provider_id: provider.id,
      provider_mode: provider.mode,
      extracted_at: now,
      page_count: read.pageCount,
      page_baseline_confidence: toScore(baseline),
      field_confidences: fieldConfidences,
      field_levels: fieldLevels,
      low_confidence_fields: [...review.low_confidence_fields],
      missing_fields: [...extraction.missingFields],
    },
    fields: extraction.values,
    review: {
      status: review.status,
      confirm_allowed: review.confirm_allowed,
      reasons: review.reasons.map((reason) => ({ code: reason.code, field: reason.field })),
      missing_required_fields: [...review.missing_required_fields],
    },
  };

  const validation = schema ? validate(output, schema) : null;

  if (validation && !validation.valid) {
    return {
      ok: false,
      output,
      review: output.review,
      validation,
      error: createSafeError('schema_validation_failed'),
    };
  }

  return { ok: true, output, review: output.review, validation, error: null };
}

function failure(error) {
  return {
    ok: false,
    output: null,
    review: {
      status: REVIEW_STATUS.EXTRACTION_FAILED,
      confirm_allowed: false,
      reasons: [],
      missing_required_fields: [],
    },
    validation: null,
    error,
  };
}

export { REVIEW_STATUS, DOCUMENT_TYPE, SCHEMA_VERSION };
