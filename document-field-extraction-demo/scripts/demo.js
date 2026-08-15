#!/usr/bin/env node
/**
 * Demo runner.
 *
 * Runs the pipeline end to end against the synthetic fixture and prints what
 * a reviewer would see: which fields were read, how much each is trusted, and
 * which ones a person has to confirm.
 *
 * No network, no credentials, no environment variables. Exit code 0 when the
 * run produced schema-valid output, non-zero otherwise.
 */

import { pathToFileURL } from 'node:url';

import { CONFIDENCE, REVIEW_STATUS } from '../src/config.js';
import { FIELD_DEFINITIONS } from '../src/field-definitions.js';
import { runExtractionPipeline } from '../src/index.js';
import { createMockProvider, MOCK_SCENARIOS } from '../src/providers/mock-provider.js';
import { loadOutputSchema } from '../src/schema.js';

const RESET = '\u001B[0m';
const BOLD = '\u001B[1m';
const DIM = '\u001B[2m';

const LEVEL_COLOR = {
  HIGH: '\u001B[32m',
  MEDIUM: '\u001B[33m',
  LOW: '\u001B[31m',
  UNREADABLE: '\u001B[35m',
};

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;

function paint(code, text) {
  return useColor ? `${code}${text}${RESET}` : text;
}

function heading(text) {
  return `\n${paint(BOLD, text)}\n${'-'.repeat(text.length)}`;
}

function formatValue(value) {
  if (value === null) return paint(DIM, '(not read)');
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

function parseScenario(argv) {
  const flagIndex = argv.indexOf('--scenario');
  if (flagIndex === -1) return 'success';
  const scenario = argv[flagIndex + 1];
  if (!MOCK_SCENARIOS.includes(scenario)) {
    throw new Error(`unknown scenario: ${scenario}. one of: ${MOCK_SCENARIOS.join(', ')}`);
  }
  return scenario;
}

function main() {
  const scenario = parseScenario(process.argv.slice(2));
  const provider = createMockProvider(scenario);
  const schema = loadOutputSchema();

  process.stdout.write(heading('Document Field Extraction Demo'));
  process.stdout.write(
    `\nprovider          ${provider.id} (${provider.mode}, scenario=${scenario})\n` +
      `document          Equipment Inspection Form (synthetic)\n` +
      `network access    none\n` +
      `review threshold  field < ${CONFIDENCE.MEDIUM_MIN} needs review; ` +
      `> ${CONFIDENCE.LOW_RATIO_THRESHOLD * 100}% of fields low blocks the page\n`,
  );

  const result = runExtractionPipeline({ provider, schema });

  if (!result.ok && result.output === null) {
    process.stdout.write(heading('Result'));
    process.stdout.write(
      `\nreview status     ${result.review.status}\n` +
        `error code        ${result.error.error_code}\n` +
        `message           ${result.error.safe_message}\n` +
        `\n${paint(DIM, 'The error carries a code and a fixed message only — no response body, no input echo.')}\n`,
    );
    return 1;
  }

  const { output } = result;
  const { field_confidences: confidences, field_levels: levels } = output.extraction_metadata;

  process.stdout.write(heading('Extracted fields'));
  process.stdout.write('\n');
  const labelWidth = Math.max(...FIELD_DEFINITIONS.map((f) => f.name.length)) + 2;
  for (const definition of FIELD_DEFINITIONS) {
    const name = definition.name.padEnd(labelWidth);
    const score = confidences[definition.name].toFixed(2);
    const level = levels[definition.name];
    const banner = paint(LEVEL_COLOR[level] ?? '', level.padEnd(11));
    process.stdout.write(`${name}${score}  ${banner}${formatValue(output.fields[definition.name])}\n`);
  }

  process.stdout.write(heading('Review gate'));
  process.stdout.write(
    `\npage baseline     ${output.extraction_metadata.page_baseline_confidence.toFixed(2)}\n` +
      `status            ${output.review.status}\n` +
      `confirm allowed   ${output.review.confirm_allowed}\n`,
  );
  if (output.review.reasons.length === 0) {
    process.stdout.write('reasons           none\n');
  } else {
    for (const reason of output.review.reasons) {
      process.stdout.write(`reason            ${reason.code} -> ${reason.field ?? '(document)'}\n`);
    }
  }
  if (output.review.status === REVIEW_STATUS.REVIEW_REQUIRED) {
    process.stdout.write(
      `\n${paint(DIM, 'Those fields go to a person. Everything else is ready to use as a candidate value.')}\n`,
    );
  }

  process.stdout.write(heading('Schema validation'));
  const validation = result.validation;
  if (validation?.valid) {
    process.stdout.write(`\nvalid against     ${'schema/equipment-inspection-output.schema.json'}\n`);
  } else {
    process.stdout.write('\ninvalid output:\n');
    for (const error of validation?.errors ?? []) {
      process.stdout.write(`  ${error.path} ${error.message}\n`);
    }
  }

  process.stdout.write(heading('Structured output'));
  process.stdout.write(`\n${JSON.stringify(output, null, 2)}\n`);

  return result.ok ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}

export { main };
