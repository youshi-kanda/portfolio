/**
 * Minimal JSON Schema validator (dependency-free).
 *
 * This implements the subset of JSON Schema that the output schema in
 * `schema/` actually uses. It is deliberately not a complete implementation —
 * a real deployment would use a full validator. It exists here so the demo
 * runs with `npm install` doing nothing and with no code from the network,
 * which is the property this project is trying to demonstrate.
 *
 * Supported keywords:
 *   type (including union arrays), enum, const, required, properties,
 *   additionalProperties (false or a schema), items, minItems, maxItems,
 *   minLength, maxLength, pattern, minimum, maximum,
 *   format ("date" and "date-time" only)
 *
 * Anything else in a schema document is ignored rather than silently treated
 * as satisfied, so `assertSupportedSchema` is provided to fail loudly if the
 * schema grows past what this validator understands.
 */

const SUPPORTED_KEYWORDS = new Set([
  '$schema',
  '$id',
  'title',
  'description',
  'examples',
  'type',
  'enum',
  'const',
  'required',
  'properties',
  'additionalProperties',
  'items',
  'minItems',
  'maxItems',
  'minLength',
  'maxLength',
  'pattern',
  'minimum',
  'maximum',
  'format',
]);

const SUPPORTED_FORMATS = new Set(['date', 'date-time']);

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Validate `value` against `schema`.
 * Returns `{ valid, errors }` where each error is `{ path, message }`.
 */
export function validate(value, schema) {
  const errors = [];
  walk(value, schema, '', errors);
  return { valid: errors.length === 0, errors };
}

/** Throw if a schema uses a keyword this validator does not implement. */
export function assertSupportedSchema(schema, path = '#') {
  if (!isPlainObject(schema)) return;

  for (const keyword of Object.keys(schema)) {
    if (!SUPPORTED_KEYWORDS.has(keyword)) {
      throw new Error(`unsupported schema keyword at ${path}: ${keyword}`);
    }
  }
  if (schema.format !== undefined && !SUPPORTED_FORMATS.has(schema.format)) {
    throw new Error(`unsupported schema format at ${path}: ${schema.format}`);
  }
  if (isPlainObject(schema.properties)) {
    for (const [key, sub] of Object.entries(schema.properties)) {
      assertSupportedSchema(sub, `${path}/properties/${key}`);
    }
  }
  if (isPlainObject(schema.additionalProperties)) {
    assertSupportedSchema(schema.additionalProperties, `${path}/additionalProperties`);
  }
  if (isPlainObject(schema.items)) {
    assertSupportedSchema(schema.items, `${path}/items`);
  }
}

function walk(value, schema, path, errors) {
  if (!isPlainObject(schema)) return;

  if (schema.type !== undefined && !matchesType(value, schema.type)) {
    errors.push({ path: path || '/', message: `expected type ${formatType(schema.type)}` });
    return;
  }

  if (schema.const !== undefined && !deepEqual(value, schema.const)) {
    errors.push({ path: path || '/', message: 'value does not match const' });
  }

  if (Array.isArray(schema.enum) && !schema.enum.some((option) => deepEqual(option, value))) {
    errors.push({ path: path || '/', message: 'value is not one of the allowed values' });
  }

  if (typeof value === 'string') validateString(value, schema, path, errors);
  if (typeof value === 'number') validateNumber(value, schema, path, errors);
  if (Array.isArray(value)) validateArray(value, schema, path, errors);
  if (isPlainObject(value)) validateObject(value, schema, path, errors);
}

function validateString(value, schema, path, errors) {
  if (typeof schema.minLength === 'number' && value.length < schema.minLength) {
    errors.push({ path, message: `string shorter than minLength ${schema.minLength}` });
  }
  if (typeof schema.maxLength === 'number' && value.length > schema.maxLength) {
    errors.push({ path, message: `string longer than maxLength ${schema.maxLength}` });
  }
  if (typeof schema.pattern === 'string' && !new RegExp(schema.pattern, 'u').test(value)) {
    errors.push({ path, message: 'string does not match pattern' });
  }
  if (schema.format === 'date' && !isValidDateOnly(value)) {
    errors.push({ path, message: 'string is not a valid date' });
  }
  if (schema.format === 'date-time' && !DATE_TIME.test(value)) {
    errors.push({ path, message: 'string is not a valid date-time' });
  }
}

function validateNumber(value, schema, path, errors) {
  if (typeof schema.minimum === 'number' && value < schema.minimum) {
    errors.push({ path, message: `number below minimum ${schema.minimum}` });
  }
  if (typeof schema.maximum === 'number' && value > schema.maximum) {
    errors.push({ path, message: `number above maximum ${schema.maximum}` });
  }
}

function validateArray(value, schema, path, errors) {
  if (typeof schema.minItems === 'number' && value.length < schema.minItems) {
    errors.push({ path, message: `array shorter than minItems ${schema.minItems}` });
  }
  if (typeof schema.maxItems === 'number' && value.length > schema.maxItems) {
    errors.push({ path, message: `array longer than maxItems ${schema.maxItems}` });
  }
  if (isPlainObject(schema.items)) {
    value.forEach((item, index) => walk(item, schema.items, `${path}/${index}`, errors));
  }
}

function validateObject(value, schema, path, errors) {
  if (Array.isArray(schema.required)) {
    for (const key of schema.required) {
      if (!Object.hasOwn(value, key)) {
        errors.push({ path: `${path}/${key}`, message: 'required property is missing' });
      }
    }
  }

  const properties = isPlainObject(schema.properties) ? schema.properties : {};

  for (const [key, sub] of Object.entries(properties)) {
    if (Object.hasOwn(value, key)) walk(value[key], sub, `${path}/${key}`, errors);
  }

  if (schema.additionalProperties === undefined) return;

  for (const key of Object.keys(value)) {
    if (Object.hasOwn(properties, key)) continue;
    if (schema.additionalProperties === false) {
      errors.push({ path: `${path}/${key}`, message: 'additional property is not allowed' });
    } else if (isPlainObject(schema.additionalProperties)) {
      walk(value[key], schema.additionalProperties, `${path}/${key}`, errors);
    }
  }
}

function matchesType(value, type) {
  const types = Array.isArray(type) ? type : [type];
  return types.some((candidate) => matchesSingleType(value, candidate));
}

function matchesSingleType(value, type) {
  switch (type) {
    case 'null':
      return value === null;
    case 'boolean':
      return typeof value === 'boolean';
    case 'string':
      return typeof value === 'string';
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'array':
      return Array.isArray(value);
    case 'object':
      return isPlainObject(value);
    default:
      return false;
  }
}

function isValidDateOnly(value) {
  if (!DATE_ONLY.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function formatType(type) {
  return Array.isArray(type) ? type.join('|') : String(type);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (typeof a !== 'object') return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) => Object.hasOwn(b, key) && deepEqual(a[key], b[key]));
}
