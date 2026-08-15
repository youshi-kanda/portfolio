/**
 * Field catalogue for the Equipment Inspection Form.
 *
 * This is the only module that knows what the business document looks like.
 * The extractor, the confidence scorer and the review gate all read this
 * catalogue, so swapping in a different form means editing this file and the
 * output schema, and nothing else.
 *
 * Everything here is synthetic and describes a fictional inspection form.
 */

export const DOCUMENT_TYPE = 'equipment_inspection_form';
export const SCHEMA_VERSION = '1.0.0';

/** How a field's value is read out of the OCR text. */
export const FIELD_KIND = Object.freeze({
  /** Free or semi-structured text, optionally constrained by a pattern. */
  TEXT: 'text',
  /** A calendar date, normalised to YYYY-MM-DD. */
  DATE: 'date',
  /** A closed set of tokens, normalised to a canonical value. */
  ENUM: 'enum',
  /** A tri-state tick box: ticked, explicitly not ticked, or undetermined. */
  CHECKBOX: 'checkbox',
});

/**
 * Canonical values for the two enum fields.
 * `unknown` means "text was found but it matched none of the known tokens",
 * which is different from the field being absent (that yields null).
 */
export const CONDITION_VALUES = Object.freeze([
  'good',
  'needs_review',
  'failed',
  'unknown',
]);

export const INSPECTOR_ROLE_VALUES = Object.freeze([
  'internal',
  'contractor',
  'unknown',
]);

const CONDITION_TOKENS = Object.freeze([
  ['good', ['good', 'ok', 'normal', 'pass', 'passed', 'serviceable']],
  ['needs_review', ['needs review', 'need review', 'review', 'attention', 'monitor']],
  ['failed', ['failed', 'fail', 'defective', 'defect', 'out of service', 'unserviceable']],
]);

const INSPECTOR_ROLE_TOKENS = Object.freeze([
  ['internal', ['internal', 'in-house', 'staff', 'employee', 'technician']],
  ['contractor', ['contractor', 'external', 'vendor', 'third party', 'third-party']],
]);

/**
 * A date written as YYYY-MM-DD, YYYY/MM/DD or YYYY.MM.DD.
 *
 * Two forms, because they are used for different jobs. The extractor pulls a
 * whole date out of a text window, so its pattern captures the date as one
 * group. The normaliser needs year, month and day separately.
 */
export const DATE_PATTERN = /(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/;
export const DATE_PARTS_PATTERN = /(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/;

/**
 * Field catalogue.
 *
 * - `keywords`      label spellings the extractor searches for, in priority order
 * - `pattern`       optional capture applied inside the field's text window
 * - `multiplier`    per-field confidence adjustment (see confidence.js)
 * - `required`      a missing value here sends the document to human review
 *
 * `multiplier` encodes how much the extraction step itself is trusted for a
 * given field. A printed identifier read by a pattern is trusted as-is (1.0);
 * a free-text remark copied verbatim is trusted less (0.85), because a clean
 * OCR read of an ambiguous handwritten note is still an ambiguous note.
 */
export const FIELD_DEFINITIONS = Object.freeze([
  {
    name: 'document_id',
    kind: FIELD_KIND.TEXT,
    label: 'Document ID',
    keywords: ['Document ID', 'Doc ID'],
    pattern: /([A-Z]{2,4}-\d{4}-\d{3,4})/,
    multiplier: 1.0,
    required: true,
  },
  {
    name: 'equipment_id',
    kind: FIELD_KIND.TEXT,
    label: 'Equipment ID',
    keywords: ['Equipment ID', 'Asset ID'],
    pattern: /([A-Z]{2}-\d{3,5})/,
    multiplier: 1.0,
    required: true,
  },
  {
    name: 'inspection_date',
    kind: FIELD_KIND.DATE,
    label: 'Inspection Date',
    keywords: ['Inspection Date'],
    multiplier: 1.0,
    required: true,
  },
  {
    name: 'location',
    kind: FIELD_KIND.TEXT,
    label: 'Location',
    keywords: ['Location', 'Site'],
    multiplier: 0.95,
    required: true,
  },
  {
    name: 'equipment_type',
    kind: FIELD_KIND.TEXT,
    label: 'Equipment Type',
    keywords: ['Equipment Type', 'Asset Type'],
    multiplier: 0.95,
    required: false,
  },
  {
    name: 'condition',
    kind: FIELD_KIND.ENUM,
    label: 'Condition',
    keywords: ['Condition', 'Overall Condition'],
    values: CONDITION_VALUES,
    tokens: CONDITION_TOKENS,
    multiplier: 1.0,
    required: true,
  },
  {
    name: 'safety_check_passed',
    kind: FIELD_KIND.CHECKBOX,
    label: 'Safety Check',
    keywords: ['Safety Check'],
    multiplier: 1.0,
    required: true,
  },
  {
    name: 'repair_required',
    kind: FIELD_KIND.CHECKBOX,
    label: 'Repair Required',
    keywords: ['Repair Required'],
    multiplier: 1.0,
    required: true,
  },
  {
    name: 'photo_attached',
    kind: FIELD_KIND.CHECKBOX,
    label: 'Photo Attached',
    keywords: ['Photo Attached'],
    multiplier: 1.0,
    required: false,
  },
  {
    name: 'issue_description',
    kind: FIELD_KIND.TEXT,
    label: 'Issue Description',
    keywords: ['Issue Description', 'Findings', 'Issue'],
    multiplier: 0.85,
    required: false,
  },
  {
    name: 'next_inspection_date',
    kind: FIELD_KIND.DATE,
    label: 'Next Inspection Date',
    keywords: ['Next Inspection Date'],
    multiplier: 1.0,
    required: false,
  },
  {
    name: 'inspector_role',
    kind: FIELD_KIND.ENUM,
    label: 'Inspector Role',
    keywords: ['Inspector Role'],
    values: INSPECTOR_ROLE_VALUES,
    tokens: INSPECTOR_ROLE_TOKENS,
    multiplier: 0.9,
    required: true,
  },
]);

export const FIELD_NAMES = Object.freeze(FIELD_DEFINITIONS.map((f) => f.name));

export const REQUIRED_FIELD_NAMES = Object.freeze(
  FIELD_DEFINITIONS.filter((f) => f.required).map((f) => f.name),
);

/**
 * Every label spelling in the catalogue.
 *
 * The extractor uses this set to stop reading at the next field label, so a
 * value can never be picked up from the field below it. Without this bound,
 * two adjacent tick boxes bleed into each other.
 */
export const BOUNDARY_KEYWORDS = Object.freeze(
  FIELD_DEFINITIONS.flatMap((f) => f.keywords),
);

export function getFieldDefinition(name) {
  return FIELD_DEFINITIONS.find((f) => f.name === name) ?? null;
}
