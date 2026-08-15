/**
 * OCR response boundary.
 *
 * Everything downstream of this module works on a small, validated shape:
 * a text string and a list of blocks with confidences. Nothing else in the
 * pipeline knows what a provider response looks like, so swapping providers
 * is a change here and nowhere else.
 *
 * The response shape mirrors a document-text-detection response: a document
 * text blob plus a page tree of blocks, paragraphs, words and per-symbol
 * confidences.
 */

import { createSafeError } from './safe-errors.js';

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Validate a provider response and reduce it to the shape the pipeline uses.
 *
 * Returns either `{ ok: true, text, pages }` or a safe error. Every rejection
 * path yields a code, never a fragment of the response.
 */
export function readOcrResponse(response) {
  if (!isPlainObject(response)) {
    return createSafeError('ocr_response_invalid');
  }
  if (!Array.isArray(response.responses) || response.responses.length !== 1) {
    return createSafeError('ocr_response_invalid');
  }

  const first = response.responses[0];
  if (!isPlainObject(first)) {
    return createSafeError('ocr_response_invalid');
  }
  if (first.error) {
    return createSafeError('ocr_provider_error');
  }

  const annotation = first.fullTextAnnotation;
  if (!isPlainObject(annotation)) {
    return createSafeError('ocr_response_invalid');
  }
  if (typeof annotation.text !== 'string') {
    return createSafeError('ocr_response_invalid');
  }
  if (annotation.text.trim() === '') {
    return createSafeError('ocr_text_empty');
  }

  const pages = Array.isArray(annotation.pages) ? annotation.pages : [];

  return Object.freeze({
    ok: true,
    text: annotation.text,
    pages,
    pageCount: pages.length || 1,
  });
}

/** Flatten every symbol confidence on the page tree, in reading order. */
export function collectSymbolConfidences(pages) {
  const confidences = [];
  for (const page of pages ?? []) {
    for (const block of page?.blocks ?? []) {
      for (const paragraph of block?.paragraphs ?? []) {
        for (const word of paragraph?.words ?? []) {
          for (const symbol of word?.symbols ?? []) {
            if (typeof symbol?.confidence === 'number') {
              confidences.push(symbol.confidence);
            }
          }
        }
      }
    }
  }
  return confidences;
}

/**
 * Reduce the page tree to one entry per block: its text and its mean symbol
 * confidence.
 *
 * Block text is reconstructed by joining words with a single space. That is
 * enough for label matching, which is all the confidence scorer needs it for.
 */
export function collectBlocks(pages) {
  const blocks = [];
  let pageIndex = 0;

  for (const page of pages ?? []) {
    pageIndex += 1;
    let blockIndex = 0;

    for (const block of page?.blocks ?? []) {
      blockIndex += 1;
      const words = [];
      const confidences = [];

      for (const paragraph of block?.paragraphs ?? []) {
        for (const word of paragraph?.words ?? []) {
          const symbols = word?.symbols ?? [];
          const text = symbols.map((symbol) => symbol?.text ?? '').join('');
          if (text !== '') words.push(text);
          for (const symbol of symbols) {
            if (typeof symbol?.confidence === 'number') {
              confidences.push(symbol.confidence);
            }
          }
        }
      }

      blocks.push({
        page_index: pageIndex,
        block_index: blockIndex,
        text: words.join(' '),
        confidence: mean(confidences),
        symbol_count: confidences.length,
      });
    }
  }

  return blocks;
}

function mean(values) {
  if (values.length === 0) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}
