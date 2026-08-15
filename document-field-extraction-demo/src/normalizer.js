/**
 * Value normalisation.
 *
 * Each function turns one raw OCR string into a canonical value, and refuses
 * rather than guesses. A malformed date returns null instead of a plausible
 * date, because a silently repaired value is worse than a missing one: the
 * reviewer never learns it needs checking.
 */

import { DATE_PARTS_PATTERN } from './field-definitions.js';

/**
 * Tick-box markers.
 *
 * Symbol markers are matched literally. Word markers are matched on word
 * boundaries and case-insensitively, so "Normal" is not read as a "No" and
 * "Bypass" is not read as a "pass".
 */
const YES_SYMBOLS = Object.freeze(['[x]', '[X]', '[✓]', '[v]', '☑', '✔', '✓']);
const NO_SYMBOLS = Object.freeze(['[ ]', '[]', '☐', '□']);

const YES_WORDS = /\b(yes|passed|pass|ok)\b/i;
const NO_WORDS = /\b(no|failed|fail|n\/a)\b/i;

/**
 * Parse a date and normalise it to YYYY-MM-DD.
 *
 * Returns null unless the text contains a well-formed calendar date. The
 * round-trip check rejects impossible days such as 2026-02-31, which a plain
 * regex would happily accept.
 */
export function normalizeDate(text) {
  if (typeof text !== 'string' || text.trim() === '') return null;

  const match = text.match(DATE_PARTS_PATTERN);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Map free text onto one of a field's canonical enum values.
 *
 * Returns null when there was no text to look at, and 'unknown' when there was
 * text but none of the known tokens matched. Keeping those two cases apart is
 * what lets the review gate tell "the inspector left this blank" from "the
 * inspector wrote something we do not recognise".
 */
export function normalizeEnum(text, tokens) {
  if (typeof text !== 'string' || text.trim() === '') return null;

  const haystack = text.toLowerCase();
  for (const [canonical, variants] of tokens) {
    for (const variant of variants) {
      if (haystack.includes(variant)) return canonical;
    }
  }
  return 'unknown';
}

/**
 * Read a tick box as true / false / null.
 *
 * null means "no marker was found in this field's window" — an undetermined
 * box, not an unticked one. Collapsing those two into false is how a safety
 * check that nobody filled in gets recorded as a safety check that failed.
 */
export function detectCheckbox(segment) {
  if (typeof segment !== 'string' || segment === '') return null;

  const yesIndex = firstMarkerIndex(segment, YES_SYMBOLS, YES_WORDS);
  const noIndex = firstMarkerIndex(segment, NO_SYMBOLS, NO_WORDS);

  if (yesIndex === -1 && noIndex === -1) return null;
  if (noIndex === -1) return true;
  if (yesIndex === -1) return false;
  // Both appear (for example "[x] Yes  [ ] No"): the earlier marker wins.
  return yesIndex <= noIndex;
}

function firstMarkerIndex(segment, symbols, wordPattern) {
  let best = -1;
  for (const marker of symbols) {
    const index = segment.indexOf(marker);
    if (index !== -1 && (best === -1 || index < best)) best = index;
  }
  const wordMatch = segment.match(wordPattern);
  if (wordMatch && (best === -1 || wordMatch.index < best)) best = wordMatch.index;
  return best;
}

/** Collapse OCR whitespace runs so downstream comparisons are stable. */
export function normalizeWhitespace(text) {
  if (typeof text !== 'string') return null;
  const collapsed = text.replace(/\s+/g, ' ').trim();
  return collapsed === '' ? null : collapsed;
}

export const CHECKBOX_MARKERS = Object.freeze({
  yesSymbols: YES_SYMBOLS,
  noSymbols: NO_SYMBOLS,
  yesWords: YES_WORDS,
  noWords: NO_WORDS,
});
