import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { detectCheckbox, normalizeDate, normalizeEnum, normalizeWhitespace } from '../src/normalizer.js';
import { getFieldDefinition } from '../src/field-definitions.js';

const CONDITION_TOKENS = getFieldDefinition('condition').tokens;
const ROLE_TOKENS = getFieldDefinition('inspector_role').tokens;

describe('normalizeDate', () => {
  it('normalises the three accepted separators to YYYY-MM-DD', () => {
    assert.equal(normalizeDate('2026-08-15'), '2026-08-15');
    assert.equal(normalizeDate('2026/08/15'), '2026-08-15');
    assert.equal(normalizeDate('2026.08.15'), '2026-08-15');
  });

  it('zero-pads single-digit month and day', () => {
    assert.equal(normalizeDate('2026-8-5'), '2026-08-05');
  });

  it('finds a date embedded in surrounding text', () => {
    assert.equal(normalizeDate('  inspected on 2026-08-15 by shift lead '), '2026-08-15');
  });

  it('rejects a date that does not exist on the calendar', () => {
    // A regex-only check would accept this. The round-trip through Date does not.
    assert.equal(normalizeDate('2026-02-31'), null);
    assert.equal(normalizeDate('2026-13-01'), null);
    assert.equal(normalizeDate('2026-00-10'), null);
  });

  it('returns null rather than guessing when there is no date', () => {
    assert.equal(normalizeDate('not a date'), null);
    assert.equal(normalizeDate(''), null);
    assert.equal(normalizeDate(null), null);
    assert.equal(normalizeDate(undefined), null);
  });
});

describe('normalizeEnum', () => {
  it('maps known tokens onto canonical values', () => {
    assert.equal(normalizeEnum('Needs Review', CONDITION_TOKENS), 'needs_review');
    assert.equal(normalizeEnum('GOOD', CONDITION_TOKENS), 'good');
    assert.equal(normalizeEnum('Out of service', CONDITION_TOKENS), 'failed');
    assert.equal(normalizeEnum('Internal Technician', ROLE_TOKENS), 'internal');
    assert.equal(normalizeEnum('Third-party vendor', ROLE_TOKENS), 'contractor');
  });

  it('reports unrecognised text as unknown, not as a missing value', () => {
    assert.equal(normalizeEnum('scheduled for teardown', CONDITION_TOKENS), 'unknown');
  });

  it('reports absent text as null, which is not the same as unknown', () => {
    assert.equal(normalizeEnum('', CONDITION_TOKENS), null);
    assert.equal(normalizeEnum(null, CONDITION_TOKENS), null);
  });
});

describe('detectCheckbox', () => {
  it('reads a ticked box as true', () => {
    assert.equal(detectCheckbox('\n[x] Passed\n'), true);
    assert.equal(detectCheckbox('\n[X] Yes\n'), true);
    assert.equal(detectCheckbox('\n☑ confirmed\n'), true);
  });

  it('reads an explicitly unticked box as false', () => {
    assert.equal(detectCheckbox('\n[ ] No\n'), false);
    assert.equal(detectCheckbox('\n☐ not attached\n'), false);
  });

  it('reads a box with no marker as undetermined, not as false', () => {
    // The distinction matters: a safety check nobody filled in must not be
    // recorded as a safety check that failed.
    assert.equal(detectCheckbox('\nsee attached sheet\n'), null);
    assert.equal(detectCheckbox(''), null);
    assert.equal(detectCheckbox(null), null);
  });

  it('lets the earlier marker win when both appear', () => {
    assert.equal(detectCheckbox('[x] Yes   [ ] No'), true);
    assert.equal(detectCheckbox('[ ] Yes   [x] No'), false);
  });

  it('does not read a word marker out of the middle of another word', () => {
    // "Normal" contains "no"; "Bypass" contains "pass".
    assert.equal(detectCheckbox('\nNormal operation\n'), null);
    assert.equal(detectCheckbox('\nBypass installed\n'), null);
  });
});

describe('normalizeWhitespace', () => {
  it('collapses OCR whitespace runs', () => {
    assert.equal(normalizeWhitespace('  Warehouse   A \n'), 'Warehouse A');
  });

  it('treats a whitespace-only value as absent', () => {
    assert.equal(normalizeWhitespace('   \n '), null);
  });
});
