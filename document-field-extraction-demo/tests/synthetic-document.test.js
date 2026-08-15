/**
 * Checks on the generated synthetic document.
 *
 * The PDF is written byte by byte, and its cross-reference table stores the
 * offset of every object. If an offset is wrong the file still looks fine to
 * a text editor and fails only in a reader, so the offsets are verified here.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  buildDocumentText,
  buildSyntheticOcrResponse,
  buildSyntheticPdf,
  FORM_BLOCKS,
} from '../scripts/generate-synthetic-document.js';

const COMMITTED_PDF = readFileSync(
  new URL('../fixtures/synthetic-equipment-inspection.pdf', import.meta.url),
).toString('latin1');

const COMMITTED_OCR = JSON.parse(
  readFileSync(new URL('../fixtures/synthetic-ocr-response.json', import.meta.url), 'utf8'),
);

describe('synthetic PDF structure', () => {
  const pdf = buildSyntheticPdf();

  it('starts with a PDF header and ends with an end-of-file marker', () => {
    assert.ok(pdf.startsWith('%PDF-1.4\n'));
    assert.ok(pdf.trimEnd().endsWith('%%EOF'));
  });

  it('points startxref at the cross-reference table', () => {
    const offset = Number(pdf.match(/startxref\n(\d+)\n/)[1]);
    assert.equal(pdf.slice(offset, offset + 4), 'xref');
  });

  it('points every cross-reference entry at its object', () => {
    // Search for the table itself, not the "xref" inside the later "startxref".
    const table = pdf.slice(pdf.indexOf('\nxref\n'));
    const entries = [...table.matchAll(/^(\d{10}) \d{5} n /gm)].map((m) => Number(m[1]));

    assert.equal(entries.length, 5);
    entries.forEach((offset, index) => {
      assert.ok(
        pdf.startsWith(`${index + 1} 0 obj`, offset),
        `entry ${index + 1} points at ${offset}, which is not the start of that object`,
      );
    });
  });

  it('declares a content stream length that matches the stream', () => {
    const declared = Number(pdf.match(/\/Length (\d+) >>\nstream\n/)[1]);
    const start = pdf.indexOf('stream\n') + 'stream\n'.length;
    const end = pdf.indexOf('\nendstream');
    assert.equal(end - start, declared);
  });

  it('contains ASCII only, because the offsets are computed from string indices', () => {
    assert.equal(/[^\x20-\x7E\n]/.test(pdf), false);
  });

  it('is reproducible and matches the committed fixture', () => {
    assert.equal(pdf, buildSyntheticPdf());
    assert.equal(pdf, COMMITTED_PDF);
  });
});

describe('synthetic document content', () => {
  it('carries only invented values', () => {
    const text = buildDocumentText();
    assert.ok(text.includes('EQ-1001'));
    assert.ok(text.includes('Warehouse A'));
    assert.ok(text.includes('Abnormal vibration detected'));
  });

  it('includes one ticked box, one unticked box, and a free-text remark', () => {
    const text = buildDocumentText();
    assert.ok(text.includes('[x] Passed'));
    assert.ok(text.includes('[ ] No'));
    assert.ok(text.includes('Issue Description'));
  });

  it('has two deliberately weak blocks so the review gate has something to catch', () => {
    const weak = FORM_BLOCKS.filter((block) => block.confidence < 0.7);
    assert.equal(weak.length, 2);
    assert.deepEqual(
      weak.map((block) => block.lines[0]),
      ['Issue Description', 'Inspector Role'],
    );
  });
});

describe('synthetic OCR response', () => {
  it('is reproducible and matches the committed fixture', () => {
    assert.deepEqual(buildSyntheticOcrResponse(), COMMITTED_OCR);
  });

  it('assigns a confidence to every symbol', () => {
    const response = buildSyntheticOcrResponse();
    for (const block of response.responses[0].fullTextAnnotation.pages[0].blocks) {
      for (const paragraph of block.paragraphs) {
        for (const word of paragraph.words) {
          assert.ok(word.symbols.length > 0);
          for (const symbol of word.symbols) {
            assert.equal(typeof symbol.confidence, 'number');
            assert.ok(symbol.confidence > 0 && symbol.confidence <= 1);
          }
        }
      }
    }
  });

  it('keeps the document text and the page tree in step', () => {
    const response = buildSyntheticOcrResponse();
    assert.equal(response.responses[0].fullTextAnnotation.text, buildDocumentText());
    assert.equal(
      response.responses[0].fullTextAnnotation.pages[0].blocks.length,
      FORM_BLOCKS.length,
    );
  });
});
