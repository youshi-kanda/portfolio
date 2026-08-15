#!/usr/bin/env node
/**
 * Generate the synthetic fixtures.
 *
 *   fixtures/synthetic-equipment-inspection.pdf   a one-page PDF, built byte by byte
 *   fixtures/synthetic-ocr-response.json          an OCR-shaped response for that page
 *
 * Both are derived from the single FORM_BLOCKS spec below, so the document and
 * the response can never drift apart. Everything in the spec is invented: the
 * equipment, the site, the dates and the remark are all fictional.
 *
 * The PDF is written directly rather than through a library so the demo has no
 * dependencies and no network access at any point. The OCR response is written
 * by hand from the same spec — the demo never runs OCR over the PDF, and the
 * README says so plainly.
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * The synthetic form.
 *
 * `confidence` is the per-symbol confidence assigned to every symbol in that
 * block. Two blocks are deliberately weak — the handwritten remark and the
 * inspector role — so the review gate has something real to catch.
 */
const FORM_BLOCKS = Object.freeze([
  { lines: ['EQUIPMENT INSPECTION FORM'], confidence: 0.99 },
  { lines: ['Document ID', 'DOC-2026-0142'], confidence: 0.98 },
  { lines: ['Equipment ID', 'EQ-1001'], confidence: 0.97 },
  { lines: ['Inspection Date', '2026-08-15'], confidence: 0.96 },
  { lines: ['Location', 'Warehouse A'], confidence: 0.94 },
  { lines: ['Equipment Type', 'Packaging Machine'], confidence: 0.92 },
  { lines: ['Condition', 'Needs Review'], confidence: 0.9 },
  { lines: ['Safety Check', '[x] Passed'], confidence: 0.95 },
  { lines: ['Repair Required', '[x] Yes'], confidence: 0.93 },
  { lines: ['Photo Attached', '[ ] No'], confidence: 0.91 },
  // Handwritten remark: legible enough to transcribe, not enough to trust.
  { lines: ['Issue Description', 'Abnormal vibration detected'], confidence: 0.58 },
  { lines: ['Next Inspection Date', '2026-11-15'], confidence: 0.88 },
  // Faint carbon-copy line.
  { lines: ['Inspector Role', 'Internal Technician'], confidence: 0.62 },
]);

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const FONT_SIZE = 12;
const LINE_LEADING = 18;
const TEXT_ORIGIN_X = 72;
const TEXT_ORIGIN_Y = 740;

const PDF_URL = new URL('../fixtures/synthetic-equipment-inspection.pdf', import.meta.url);
const OCR_URL = new URL('../fixtures/synthetic-ocr-response.json', import.meta.url);

/** Full document text, with a blank line between blocks. */
export function buildDocumentText() {
  return FORM_BLOCKS.map((block) => block.lines.join('\n')).join('\n\n');
}

/** Flat line list for the PDF, preserving the blank separators. */
function buildPdfLines() {
  const lines = [];
  FORM_BLOCKS.forEach((block, index) => {
    if (index > 0) lines.push('');
    lines.push(...block.lines);
  });
  return lines;
}

/** Escape the three characters that are special inside a PDF literal string. */
function escapePdfText(text) {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/**
 * Build a minimal one-page PDF as a byte string.
 *
 * Object offsets go into the cross-reference table, so the objects have to be
 * laid out before the table can be written — hence the two passes.
 */
export function buildSyntheticPdf() {
  const lines = buildPdfLines();

  const textOperators = lines
    .map((line, index) => {
      const move = index === 0 ? `${TEXT_ORIGIN_X} ${TEXT_ORIGIN_Y} Td` : `0 -${LINE_LEADING} Td`;
      return `${move} (${escapePdfText(line)}) Tj`;
    })
    .join('\n');

  const contentStream = `BT\n/F1 ${FONT_SIZE} Tf\n${textOperators}\nET`;

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj',
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
      '/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj',
    `5 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream\nendobj`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const body of objects) {
    offsets.push(pdf.length);
    pdf += `${body}\n`;
  }

  const xrefOffset = pdf.length;
  pdf += 'xref\n';
  pdf += `0 ${objects.length + 1}\n`;
  pdf += `${'0'.repeat(10)} 65535 f \n`;
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} ${'0'.repeat(5)} n \n`;
  }
  pdf += 'trailer\n';
  pdf += `<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += 'startxref\n';
  pdf += `${xrefOffset}\n`;
  pdf += '%%EOF\n';

  // Offsets are computed from string indices, so a non-ASCII byte would make
  // the cross-reference table point at the wrong place.
  if (/[^\x20-\x7E\n]/.test(pdf)) {
    throw new Error('synthetic PDF must contain ASCII only');
  }

  return pdf;
}

/** Split a line into whitespace-separated words. */
function toWords(line) {
  return line.split(/\s+/).filter((word) => word !== '');
}

/**
 * Build an OCR-shaped response: document text plus a page tree carrying a
 * confidence on every symbol.
 */
export function buildSyntheticOcrResponse() {
  const blocks = FORM_BLOCKS.map((block) => ({
    paragraphs: [
      {
        words: block.lines.flatMap((line) =>
          toWords(line).map((word) => ({
            symbols: [...word].map((character) => ({
              text: character,
              confidence: block.confidence,
            })),
          })),
        ),
      },
    ],
  }));

  return {
    responses: [
      {
        fullTextAnnotation: {
          text: buildDocumentText(),
          pages: [
            {
              width: PAGE_WIDTH,
              height: PAGE_HEIGHT,
              blocks,
            },
          ],
        },
      },
    ],
  };
}

function main() {
  const pdf = buildSyntheticPdf();
  writeFileSync(fileURLToPath(PDF_URL), Buffer.from(pdf, 'latin1'));

  const response = buildSyntheticOcrResponse();
  writeFileSync(fileURLToPath(OCR_URL), `${JSON.stringify(response, null, 2)}\n`, 'utf8');

  process.stdout.write(
    `wrote fixtures/synthetic-equipment-inspection.pdf (${pdf.length} bytes)\n` +
      `wrote fixtures/synthetic-ocr-response.json (${FORM_BLOCKS.length} blocks)\n`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

export { FORM_BLOCKS };
