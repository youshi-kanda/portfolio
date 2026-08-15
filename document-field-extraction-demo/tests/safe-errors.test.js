import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  assertSafeErrorShape,
  createSafeError,
  isSafeError,
  mapHttpStatusToSafeCode,
  SAFE_ERROR_CODES,
  SAFE_MESSAGES,
} from '../src/safe-errors.js';
import { readOcrResponse } from '../src/ocr-response.js';
import { createMockProvider } from '../src/providers/mock-provider.js';
import { runExtractionPipeline } from '../src/index.js';
import { loadOutputSchema } from '../src/schema.js';

/**
 * Obviously synthetic stand-ins for the kinds of value that must never leave
 * the pipeline inside an error. They are repeated characters, not credentials.
 */
const SYNTHETIC_SECRETS = Object.freeze({
  token: `TOKEN_${'A'.repeat(40)}`,
  resource: `projects/${'B'.repeat(20)}/locations/${'C'.repeat(10)}`,
  ocrText: `OCR_TEXT_${'D'.repeat(60)}`,
});

describe('createSafeError', () => {
  it('returns a fixed message for a known code', () => {
    const error = createSafeError('ocr_response_invalid');
    assert.equal(error.error_code, 'ocr_response_invalid');
    assert.equal(error.safe_message, SAFE_MESSAGES.ocr_response_invalid);
    assert.equal(error.status_code, null);
  });

  it('keeps a numeric status code and drops anything else', () => {
    assert.equal(createSafeError('ocr_forbidden', 403).status_code, 403);
    assert.equal(createSafeError('ocr_forbidden', SYNTHETIC_SECRETS.token).status_code, null);
    assert.equal(createSafeError('ocr_forbidden', { leak: 1 }).status_code, null);
  });

  it('falls back rather than echoing an unknown code', () => {
    const error = createSafeError(SYNTHETIC_SECRETS.token);
    assert.equal(error.error_code, 'unknown_error');
    assert.equal(error.safe_message.includes('A'.repeat(10)), false);
  });

  it('carries no keys beyond the safe shape', () => {
    for (const code of SAFE_ERROR_CODES) {
      assertSafeErrorShape(createSafeError(code));
    }
  });

  it('is frozen, so nothing can attach a payload to it later', () => {
    const error = createSafeError('extraction_failed');
    assert.throws(() => {
      'use strict';
      error.detail = SYNTHETIC_SECRETS.ocrText;
    }, TypeError);
  });
});

describe('mapHttpStatusToSafeCode', () => {
  it('maps the statuses that mean different things to an operator', () => {
    assert.equal(mapHttpStatusToSafeCode(401), 'ocr_unauthorized');
    assert.equal(mapHttpStatusToSafeCode(403), 'ocr_forbidden');
    assert.equal(mapHttpStatusToSafeCode(429), 'ocr_rate_limited');
    assert.equal(mapHttpStatusToSafeCode(500), 'ocr_provider_error');
    assert.equal(mapHttpStatusToSafeCode(418), 'ocr_provider_error');
  });
});

describe('errors leaving the OCR boundary', () => {
  it('reports a malformed response without quoting any of it', () => {
    const error = readOcrResponse({ responses: [{ fullTextAnnotation: SYNTHETIC_SECRETS }] });

    assert.equal(isSafeError(error), true);
    assertSafeErrorShape(error);
    const serialized = JSON.stringify(error);
    for (const secret of Object.values(SYNTHETIC_SECRETS)) {
      assert.equal(serialized.includes(secret), false);
    }
  });

  it('reports a provider error without quoting the provider payload', () => {
    const error = readOcrResponse({
      responses: [{ error: { message: SYNTHETIC_SECRETS.resource } }],
    });

    assert.equal(error.error_code, 'ocr_provider_error');
    assert.equal(JSON.stringify(error).includes(SYNTHETIC_SECRETS.resource), false);
  });
});

describe('errors leaving the pipeline', () => {
  it('discards a thrown provider error rather than wrapping it', () => {
    // A provider exception may carry a URL, a payload fragment or a
    // credential. None of it belongs in a value that will be logged.
    const provider = {
      id: 'exploding',
      mode: 'synthetic',
      annotate() {
        throw new Error(`${SYNTHETIC_SECRETS.token} ${SYNTHETIC_SECRETS.resource}`);
      },
    };

    const result = runExtractionPipeline({ provider, schema: loadOutputSchema() });

    assert.equal(result.ok, false);
    assert.equal(result.output, null);
    assert.equal(result.review.status, 'extraction_failed');
    assertSafeErrorShape(result.error);
    const serialized = JSON.stringify(result);
    assert.equal(serialized.includes(SYNTHETIC_SECRETS.token), false);
    assert.equal(serialized.includes(SYNTHETIC_SECRETS.resource), false);
  });

  it('produces a safe error for every failing mock scenario', () => {
    const schema = loadOutputSchema();
    const expected = {
      throws: 'extraction_failed',
      provider_error: 'ocr_provider_error',
      invalid_response: 'ocr_response_invalid',
      empty_text: 'ocr_text_empty',
    };

    for (const [scenario, code] of Object.entries(expected)) {
      const result = runExtractionPipeline({ provider: createMockProvider(scenario), schema });
      assert.equal(result.ok, false, scenario);
      assert.equal(result.error.error_code, code, scenario);
      assertSafeErrorShape(result.error);
    }
  });
});
