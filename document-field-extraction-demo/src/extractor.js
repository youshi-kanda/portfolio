/**
 * Field extraction from OCR text.
 *
 * The strategy is keyword-anchored: find a field's label in the text, take the
 * window that follows it, and read the value out of that window. The window is
 * cut short at the next field label, which is what keeps a value from being
 * picked up out of the field below it — the failure mode that matters most on
 * a form where several tick boxes sit one under another.
 */

import { KEYWORD_WINDOW_CHARS } from './config.js';
import {
  BOUNDARY_KEYWORDS,
  DATE_PATTERN,
  FIELD_DEFINITIONS,
  FIELD_KIND,
} from './field-definitions.js';
import { detectCheckbox, normalizeDate, normalizeEnum, normalizeWhitespace } from './normalizer.js';

/**
 * Return the text that follows `keyword`, bounded by the nearest later label.
 *
 * Returns null when the keyword is absent. Returns a possibly empty string
 * when the keyword is present but nothing follows it, which the caller reads
 * as "label seen, value missing".
 */
export function sliceAfterKeyword(text, keyword, options = {}) {
  const { boundaries = [], maxChars = KEYWORD_WINDOW_CHARS } = options;

  const index = text.indexOf(keyword);
  if (index === -1) return null;

  const start = index + keyword.length;
  let end = Math.min(text.length, start + maxChars);

  for (const boundary of boundaries) {
    const boundaryIndex = text.indexOf(boundary, start);
    if (boundaryIndex !== -1 && boundaryIndex < end) end = boundaryIndex;
  }

  return text.slice(start, end);
}

/**
 * Read the first value that appears after any of `keywords`.
 *
 * With a `pattern`, the first capture inside the window wins. Without one, the
 * first non-empty line wins, which is how a scanned form reads when OCR emits
 * the label and its value on separate lines.
 */
export function extractNearKeyword(text, keywords, options = {}) {
  const { pattern = null, boundaries = BOUNDARY_KEYWORDS, maxChars } = options;

  for (const keyword of keywords) {
    const segment = sliceAfterKeyword(text, keyword, { boundaries, maxChars });
    if (segment === null) continue;

    if (pattern) {
      const match = segment.match(pattern);
      if (match) return (match[1] ?? match[0]).trim();
      continue;
    }

    const line = segment
      .split('\n')
      .map((candidate) => candidate.trim())
      .find((candidate) => candidate !== '');
    if (line) return line;
  }

  return null;
}

/** Read one field, following the strategy its `kind` implies. */
export function extractField(text, definition) {
  const boundaries = BOUNDARY_KEYWORDS;

  if (definition.kind === FIELD_KIND.CHECKBOX) {
    for (const keyword of definition.keywords) {
      const segment = sliceAfterKeyword(text, keyword, { boundaries });
      if (segment === null) continue;
      const value = detectCheckbox(segment);
      return { value, raw: value === null ? null : normalizeWhitespace(segment) };
    }
    return { value: null, raw: null };
  }

  if (definition.kind === FIELD_KIND.DATE) {
    const raw = extractNearKeyword(text, definition.keywords, { pattern: DATE_PATTERN });
    return { value: normalizeDate(raw), raw };
  }

  if (definition.kind === FIELD_KIND.ENUM) {
    const raw = extractNearKeyword(text, definition.keywords);
    return { value: normalizeEnum(raw, definition.tokens), raw };
  }

  const raw = extractNearKeyword(text, definition.keywords, {
    pattern: definition.pattern ?? null,
  });
  return { value: normalizeWhitespace(raw), raw };
}

/**
 * Extract every field in the catalogue.
 *
 * `missingFields` lists fields whose value came back null. It is reported
 * separately from the values themselves so the review gate can distinguish a
 * field that is absent from a field that is present but low confidence — the
 * two need different things from a human.
 */
export function extractFields(text, definitions = FIELD_DEFINITIONS) {
  const values = {};
  const rawValues = {};
  const missingFields = [];

  for (const definition of definitions) {
    const { value, raw } = extractField(text, definition);
    values[definition.name] = value;
    rawValues[definition.name] = raw;
    if (value === null) missingFields.push(definition.name);
  }

  return { values, rawValues, missingFields };
}
