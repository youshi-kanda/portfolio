/**
 * Safe error construction.
 *
 * The rule this module enforces: an error that leaves the pipeline carries a
 * stable code and a fixed message, and nothing else. Raw OCR text, provider
 * response bodies, credentials, file names and user input never travel inside
 * an error, because errors are the values most likely to end up in a log line,
 * a bug report, or a support ticket.
 */

/** Fixed messages. Each is safe to show to anyone, in any context. */
export const SAFE_MESSAGES = Object.freeze({
  invalid_document_blob: 'Document input is invalid.',
  invalid_document_mime_type: 'Document input MIME type is invalid.',
  invalid_document_signature: 'Document signature is invalid.',
  empty_document: 'Document input is empty.',
  invalid_pages: 'Page selection is invalid.',
  page_limit_exceeded: 'Page selection exceeds the maximum allowed pages.',
  duplicate_pages: 'Page selection contains duplicate pages.',
  ocr_unauthorized: 'OCR authorization failed.',
  ocr_forbidden: 'OCR request is forbidden.',
  ocr_rate_limited: 'OCR request was rate limited.',
  ocr_provider_error: 'OCR provider request failed.',
  ocr_response_invalid: 'OCR provider response is invalid.',
  ocr_network_error: 'OCR network request failed.',
  ocr_page_error: 'OCR failed for a page of the document.',
  ocr_page_number_missing: 'OCR response is missing a page number.',
  ocr_text_empty: 'OCR response contains no readable text.',
  extraction_failed: 'Field extraction could not be completed.',
  schema_validation_failed: 'Structured output did not match the schema.',
});

const FALLBACK_MESSAGE = 'Document processing failed.';
const FALLBACK_CODE = 'unknown_error';

/** Every code the pipeline is allowed to emit. */
export const SAFE_ERROR_CODES = Object.freeze(Object.keys(SAFE_MESSAGES));

export function isSafeErrorCode(code) {
  return typeof code === 'string' && Object.hasOwn(SAFE_MESSAGES, code);
}

/**
 * Build a safe error result.
 *
 * `statusCode` is the only caller-supplied value that survives, and only when
 * it is a plain number. Anything else a caller tries to attach is dropped.
 */
export function createSafeError(errorCode, statusCode = null) {
  const code = isSafeErrorCode(errorCode) ? errorCode : FALLBACK_CODE;
  return Object.freeze({
    ok: false,
    error_code: code,
    safe_message: SAFE_MESSAGES[code] ?? FALLBACK_MESSAGE,
    status_code: Number.isFinite(statusCode) ? statusCode : null,
  });
}

/** Map an HTTP status onto a safe code without echoing the response body. */
export function mapHttpStatusToSafeCode(statusCode) {
  if (statusCode === 401) return 'ocr_unauthorized';
  if (statusCode === 403) return 'ocr_forbidden';
  if (statusCode === 429) return 'ocr_rate_limited';
  return 'ocr_provider_error';
}

export function isSafeError(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    value.ok === false &&
    isSafeErrorCode(value.error_code)
  );
}

/**
 * Assert that a value carries no keys beyond the safe error shape.
 *
 * Used by the tests as an executable statement of the invariant, so a future
 * change that starts attaching a `detail` or `raw` field fails loudly.
 */
export function assertSafeErrorShape(value) {
  if (!isSafeError(value)) {
    throw new Error('value is not a safe error');
  }
  const allowed = new Set(['ok', 'error_code', 'safe_message', 'status_code']);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new Error(`safe error carries a disallowed key: ${key}`);
    }
  }
  return true;
}
