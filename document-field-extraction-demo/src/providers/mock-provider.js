/**
 * Mock OCR provider.
 *
 * Returns a fixed, synthetic OCR-shaped response read from disk. It performs
 * no network access of any kind: there is no fetch, no socket, no SDK, no
 * credential, and no environment variable. Running the demo twice produces
 * byte-identical output.
 *
 * A real deployment substitutes a provider that calls a document-text-detection
 * service. The rest of the pipeline is unchanged by that swap, because every
 * module downstream consumes the validated shape from `ocr-response.js` rather
 * than a provider payload.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FIXTURE_URL = new URL('../../fixtures/synthetic-ocr-response.json', import.meta.url);

/**
 * Failure shapes the pipeline has to survive. They exist so the error paths
 * are exercised by tests rather than assumed to work.
 */
export const MOCK_SCENARIOS = Object.freeze([
  'success',
  'provider_error',
  'invalid_response',
  'empty_text',
  'throws',
]);

export class MockOcrProvider {
  constructor(scenario = 'success') {
    if (!MOCK_SCENARIOS.includes(scenario)) {
      throw new Error('scenario is not supported');
    }
    this.id = 'mock';
    this.mode = 'synthetic';
    this.scenario = scenario;
  }

  /** Return an OCR-shaped response. Never reaches the network. */
  annotate() {
    if (this.scenario === 'throws') {
      throw new Error('synthetic provider failure');
    }
    if (this.scenario === 'provider_error') {
      return { responses: [{ error: { code: 3 } }] };
    }
    if (this.scenario === 'invalid_response') {
      return { responses: [] };
    }

    const response = loadSyntheticResponse();

    if (this.scenario === 'empty_text') {
      response.responses[0].fullTextAnnotation.text = '';
      return response;
    }

    return response;
  }
}

/** Read and parse the committed synthetic response. */
export function loadSyntheticResponse() {
  return JSON.parse(readFileSync(fileURLToPath(FIXTURE_URL), 'utf8'));
}

export function createMockProvider(scenario = 'success') {
  return new MockOcrProvider(scenario);
}
