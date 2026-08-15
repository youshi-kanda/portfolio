import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { assertSupportedSchema, validate } from '../src/schema-validator.js';
import { loadOutputSchema } from '../src/schema.js';

const schema = loadOutputSchema();

describe('assertSupportedSchema', () => {
  it('accepts the project schema', () => {
    // Guards against the schema growing a keyword this validator silently ignores.
    assert.doesNotThrow(() => assertSupportedSchema(schema));
  });

  it('rejects a keyword the validator does not implement', () => {
    assert.throws(
      () => assertSupportedSchema({ type: 'object', oneOf: [] }),
      /unsupported schema keyword/,
    );
  });

  it('rejects a format the validator does not implement', () => {
    assert.throws(
      () => assertSupportedSchema({ type: 'string', format: 'uri' }),
      /unsupported schema format/,
    );
  });
});

describe('validate: types', () => {
  it('accepts a union type including null', () => {
    const sub = { type: ['string', 'null'] };
    assert.equal(validate('a', sub).valid, true);
    assert.equal(validate(null, sub).valid, true);
    assert.equal(validate(1, sub).valid, false);
  });

  it('separates integer from number', () => {
    assert.equal(validate(3, { type: 'integer' }).valid, true);
    assert.equal(validate(3.5, { type: 'integer' }).valid, false);
    assert.equal(validate(3.5, { type: 'number' }).valid, true);
  });

  it('does not treat an array as an object', () => {
    assert.equal(validate([], { type: 'object' }).valid, false);
    assert.equal(validate([], { type: 'array' }).valid, true);
  });
});

describe('validate: constraints', () => {
  it('checks enum, const and pattern', () => {
    assert.equal(validate('good', { enum: ['good', 'failed'] }).valid, true);
    assert.equal(validate('other', { enum: ['good', 'failed'] }).valid, false);
    assert.equal(validate('x', { const: 'x' }).valid, true);
    assert.equal(validate('y', { const: 'x' }).valid, false);
    assert.equal(validate('EQ-1001', { type: 'string', pattern: '^[A-Z]{2}-[0-9]{3,5}$' }).valid, true);
    assert.equal(validate('eq-1', { type: 'string', pattern: '^[A-Z]{2}-[0-9]{3,5}$' }).valid, false);
  });

  it('ignores a string constraint when the value is null', () => {
    const sub = { type: ['string', 'null'], pattern: '^[A-Z]+$', minLength: 3 };
    assert.equal(validate(null, sub).valid, true);
  });

  it('checks numeric bounds', () => {
    const sub = { type: 'number', minimum: 0, maximum: 1 };
    assert.equal(validate(0.5, sub).valid, true);
    assert.equal(validate(1.5, sub).valid, false);
    assert.equal(validate(-0.1, sub).valid, false);
  });

  it('rejects a date that does not exist on the calendar', () => {
    const sub = { type: 'string', format: 'date' };
    assert.equal(validate('2026-08-15', sub).valid, true);
    assert.equal(validate('2026-02-31', sub).valid, false);
    assert.equal(validate('15-08-2026', sub).valid, false);
  });
});

describe('validate: objects', () => {
  const sub = {
    type: 'object',
    required: ['a'],
    additionalProperties: false,
    properties: { a: { type: 'string' } },
  };

  it('reports a missing required property with its path', () => {
    const result = validate({}, sub);
    assert.equal(result.valid, false);
    assert.deepEqual(result.errors, [{ path: '/a', message: 'required property is missing' }]);
  });

  it('rejects an unexpected property', () => {
    const result = validate({ a: 'x', b: 'y' }, sub);
    assert.equal(result.valid, false);
    assert.equal(result.errors[0].path, '/b');
  });

  it('applies a schema-valued additionalProperties to every extra key', () => {
    const map = { type: 'object', additionalProperties: { type: 'number', maximum: 1 } };
    assert.equal(validate({ x: 0.5, y: 0.9 }, map).valid, true);
    assert.equal(validate({ x: 0.5, y: 2 }, map).valid, false);
  });
});

describe('validate: the project output schema', () => {
  it('accepts the committed expected output', async () => {
    const { readFile } = await import('node:fs/promises');
    const expected = JSON.parse(
      await readFile(new URL('../fixtures/expected-output.json', import.meta.url), 'utf8'),
    );
    assert.deepEqual(validate(expected, schema), { valid: true, errors: [] });
  });

  it('rejects output whose confidence is outside [0, 1]', async () => {
    const { readFile } = await import('node:fs/promises');
    const expected = JSON.parse(
      await readFile(new URL('../fixtures/expected-output.json', import.meta.url), 'utf8'),
    );
    expected.extraction_metadata.field_confidences.location = 1.7;
    assert.equal(validate(expected, schema).valid, false);
  });

  it('rejects output that invents a review status', async () => {
    const { readFile } = await import('node:fs/promises');
    const expected = JSON.parse(
      await readFile(new URL('../fixtures/expected-output.json', import.meta.url), 'utf8'),
    );
    expected.review.status = 'auto_confirmed';
    assert.equal(validate(expected, schema).valid, false);
  });

  it('rejects output missing a field the form defines', async () => {
    const { readFile } = await import('node:fs/promises');
    const expected = JSON.parse(
      await readFile(new URL('../fixtures/expected-output.json', import.meta.url), 'utf8'),
    );
    delete expected.fields.equipment_id;
    assert.equal(validate(expected, schema).valid, false);
  });
});
