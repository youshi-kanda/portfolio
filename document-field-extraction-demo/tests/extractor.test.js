import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { extractField, extractFields, extractNearKeyword, sliceAfterKeyword } from '../src/extractor.js';
import { BOUNDARY_KEYWORDS, FIELD_DEFINITIONS, getFieldDefinition } from '../src/field-definitions.js';
import { createMockProvider } from '../src/providers/mock-provider.js';
import { readOcrResponse } from '../src/ocr-response.js';

function syntheticText() {
  const read = readOcrResponse(createMockProvider().annotate());
  assert.equal(read.ok, true);
  return read.text;
}

describe('sliceAfterKeyword', () => {
  const text = 'Location\nWarehouse A\n\nCondition\nNeeds Review\n';

  it('returns the text between a label and the next label', () => {
    const slice = sliceAfterKeyword(text, 'Location', { boundaries: BOUNDARY_KEYWORDS });
    assert.equal(slice, '\nWarehouse A\n\n');
  });

  it('returns null when the label is absent', () => {
    assert.equal(sliceAfterKeyword(text, 'Inspector Role', { boundaries: BOUNDARY_KEYWORDS }), null);
  });

  it('caps the window when no later label cuts it short', () => {
    const long = `Condition\n${'x'.repeat(500)}`;
    const slice = sliceAfterKeyword(long, 'Condition', { boundaries: [], maxChars: 10 });
    assert.equal(slice.length, 10);
  });
});

describe('extractNearKeyword', () => {
  const text = 'Equipment ID\nEQ-1001\n\nLocation\nWarehouse A\n';

  it('returns the first non-empty line after the label when no pattern is given', () => {
    assert.equal(extractNearKeyword(text, ['Location']), 'Warehouse A');
  });

  it('returns the captured group when a pattern is given', () => {
    const definition = getFieldDefinition('equipment_id');
    assert.equal(extractNearKeyword(text, definition.keywords, { pattern: definition.pattern }), 'EQ-1001');
  });

  it('falls through to the next spelling of the label', () => {
    const aliased = 'Asset ID\nEQ-2002\n\nLocation\nBay 3\n';
    const definition = getFieldDefinition('equipment_id');
    assert.equal(
      extractNearKeyword(aliased, definition.keywords, { pattern: definition.pattern }),
      'EQ-2002',
    );
  });

  it('returns null when no spelling of the label is present', () => {
    assert.equal(extractNearKeyword(text, ['Inspector Role']), null);
  });
});

describe('extractFields on the synthetic document', () => {
  const text = syntheticText();
  const result = extractFields(text);

  it('reads every field on the form', () => {
    assert.deepEqual(result.values, {
      document_id: 'DOC-2026-0142',
      equipment_id: 'EQ-1001',
      inspection_date: '2026-08-15',
      location: 'Warehouse A',
      equipment_type: 'Packaging Machine',
      condition: 'needs_review',
      safety_check_passed: true,
      repair_required: true,
      photo_attached: false,
      issue_description: 'Abnormal vibration detected',
      next_inspection_date: '2026-11-15',
      inspector_role: 'internal',
    });
  });

  it('reports nothing as missing', () => {
    assert.deepEqual(result.missingFields, []);
  });

  it('keeps the two dates apart even though one label contains the other', () => {
    assert.notEqual(result.values.inspection_date, result.values.next_inspection_date);
    assert.equal(result.values.inspection_date, '2026-08-15');
    assert.equal(result.values.next_inspection_date, '2026-11-15');
  });

  it('does not let one tick box bleed into the next', () => {
    // The three boxes sit one under another. Without the window bound, the
    // "[x]" of Repair Required is close enough to be read as Photo Attached.
    assert.equal(result.values.repair_required, true);
    assert.equal(result.values.photo_attached, false);
  });

  it('does not let one identifier be read from the neighbouring field', () => {
    // "DOC-2026-0142" also satisfies the equipment_id pattern in places.
    assert.equal(result.values.equipment_id, 'EQ-1001');
  });
});

describe('extractFields with fields absent', () => {
  it('returns null values and lists them as missing', () => {
    const partial = 'Equipment ID\nEQ-1001\n\nLocation\nWarehouse A\n';
    const result = extractFields(partial);

    assert.equal(result.values.equipment_id, 'EQ-1001');
    assert.equal(result.values.location, 'Warehouse A');
    assert.equal(result.values.inspection_date, null);
    assert.equal(result.values.safety_check_passed, null);
    assert.ok(result.missingFields.includes('inspection_date'));
    assert.ok(result.missingFields.includes('safety_check_passed'));
    assert.equal(result.missingFields.length, FIELD_DEFINITIONS.length - 2);
  });

  it('treats a label with no value below it as missing', () => {
    const definition = getFieldDefinition('location');
    const { value } = extractField('Location\n\nCondition\nGood\n', definition);
    assert.equal(value, null);
  });
});
