/**
 * Output schema loader.
 *
 * Read from disk rather than embedded in code so the schema stays a reviewable
 * artefact in its own right, and so the demo and the tests validate against the
 * exact file a consumer would be handed.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SCHEMA_URL = new URL('../schema/equipment-inspection-output.schema.json', import.meta.url);

export function loadOutputSchema() {
  return JSON.parse(readFileSync(fileURLToPath(SCHEMA_URL), 'utf8'));
}

export const OUTPUT_SCHEMA_PATH = 'schema/equipment-inspection-output.schema.json';
