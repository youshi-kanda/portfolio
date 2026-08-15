/**
 * Review gate.
 *
 * This is the point of the pipeline. Extraction produces candidate values;
 * the gate decides which of them a human has to look at before anyone acts on
 * them. Three outcomes, in order of severity:
 *
 *   blocked          the page is too poor to review field by field — re-capture it
 *   review_required  usable extraction, but specific fields need confirming
 *   passed           every field is reliable and every required field is present
 *
 * Extraction output is treated as a candidate until a person confirms it. The
 * gate never promotes a value on its own.
 */

import { CONFIDENCE, REVIEW_REASON, REVIEW_STATUS } from './config.js';
import { REQUIRED_FIELD_NAMES } from './field-definitions.js';
import { detectLowConfidenceFields } from './confidence.js';

/**
 * True when too large a share of fields fall below the review threshold.
 *
 * A handful of weak fields is a review task. Most of the page being weak is a
 * capture problem, and routing it to a reviewer field by field just moves the
 * problem onto a person who also cannot read the scan.
 */
export function isQualityInsufficient(fieldConfidences, totalCount) {
  if (totalCount <= 0) return false;
  const lowCount = Object.values(fieldConfidences).filter(
    (score) => score < CONFIDENCE.MEDIUM_MIN,
  ).length;
  return lowCount / totalCount > CONFIDENCE.LOW_RATIO_THRESHOLD;
}

/**
 * Decide the document's review status.
 *
 * Reasons are returned as `{ code, field }` pairs so a reviewer UI can point
 * at the exact field that caused the hold, and so the decision is auditable
 * without re-running the pipeline.
 */
export function evaluate({
  fieldConfidences,
  missingFields = [],
  requiredFields = REQUIRED_FIELD_NAMES,
}) {
  const fieldNames = Object.keys(fieldConfidences);
  const totalCount = fieldNames.length;
  const lowConfidenceFields = detectLowConfidenceFields(fieldConfidences);
  const missingRequiredFields = requiredFields.filter((name) => missingFields.includes(name));

  if (isQualityInsufficient(fieldConfidences, totalCount)) {
    return Object.freeze({
      status: REVIEW_STATUS.BLOCKED,
      reasons: Object.freeze([Object.freeze({ code: REVIEW_REASON.LOW_OCR_QUALITY, field: null })]),
      low_confidence_fields: Object.freeze(lowConfidenceFields),
      missing_required_fields: Object.freeze(missingRequiredFields),
      confirm_allowed: false,
    });
  }

  const reasons = [];

  for (const name of missingRequiredFields) {
    reasons.push({ code: REVIEW_REASON.REQUIRED_FIELD_MISSING, field: name });
  }

  for (const name of lowConfidenceFields) {
    // A missing required field is already reported above; do not report it twice.
    if (missingRequiredFields.includes(name)) continue;
    const code =
      fieldConfidences[name] <= 0 ? REVIEW_REASON.UNREADABLE_FIELD : REVIEW_REASON.LOW_CONFIDENCE;
    reasons.push({ code, field: name });
  }

  const status = reasons.length === 0 ? REVIEW_STATUS.PASSED : REVIEW_STATUS.REVIEW_REQUIRED;

  return Object.freeze({
    status,
    reasons: Object.freeze(reasons.map((reason) => Object.freeze(reason))),
    low_confidence_fields: Object.freeze(lowConfidenceFields),
    missing_required_fields: Object.freeze(missingRequiredFields),
    // Nothing is auto-confirmed. `passed` means "no reviewer attention needed",
    // not "already confirmed".
    confirm_allowed: status === REVIEW_STATUS.PASSED,
  });
}
