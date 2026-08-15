# Architecture

## Pipeline

```
Synthetic Document        fixtures/synthetic-equipment-inspection.pdf
        |
        v
Mock OCR Provider         src/providers/mock-provider.js
        |
        v
OCR Response Reader       src/ocr-response.js
        |
        v
Field Extractor           src/extractor.js
        |
        v
Normalizer                src/normalizer.js
        |
        v
Confidence Scoring        src/confidence.js
        |
        v
Review Gate               src/review-gate.js
        |
        v
Schema Validator          src/schema-validator.js
        |
        v
Structured JSON           conforms to schema/equipment-inspection-output.schema.json
```

`src/index.js` wires the stages together. Every stage after the provider call
is a pure function of the previous stage's output, which is what makes a run
reproducible: same response plus same clock produces byte-identical JSON.

## Stages

### Synthetic Document

**In:** the `FORM_BLOCKS` specification in `scripts/generate-synthetic-document.js`
**Out:** a one-page PDF, written byte by byte including its cross-reference table

The PDF exists so the demo has a document you can open. The default pipeline
does **not** read it — see the note under *Mock OCR Provider*. Both the PDF and
the OCR response are generated from the same specification, so they cannot
drift apart.

### Mock OCR Provider

**In:** a scenario name
**Out:** an OCR-shaped response object, or a thrown error

Reads `fixtures/synthetic-ocr-response.json` from disk and returns it. There is
no network call, no SDK, no credential and no environment variable involved.

The response is authored from the same `FORM_BLOCKS` specification as the PDF;
no OCR engine ever ran over the PDF. Five scenarios are available — one healthy
and four failure shapes — so the error paths are exercised rather than assumed.

### OCR Response Reader

**In:** a raw provider response
**Out:** `{ ok, text, pages, pageCount }`, or a safe error

The only module that knows what a provider payload looks like. It validates the
shape and reduces it to document text plus a page tree. Two helpers flatten that
tree: `collectSymbolConfidences` for the page-level average and `collectBlocks`
for one entry per block with its text and mean confidence.

Every rejection returns a code, never a fragment of the response.

### Field Extractor

**In:** document text
**Out:** `{ values, rawValues, missingFields }`

Keyword-anchored. For each field in the catalogue, find its label, take the text
window that follows, and read the value out of that window.

The window is cut short at the next field label. That bound is what keeps a
value from being read out of the field below it — the failure that matters most
on a form where three tick boxes sit one under another and a naive fixed-width
window would see all three.

Two reading strategies:

- **pattern** — the first capture inside the window wins, used for identifiers
  and dates
- **first line** — the first non-empty line wins, used where OCR emits the label
  and its value on separate lines, which is how a scanned form usually reads

A field whose window yields nothing becomes `null` and is listed in
`missingFields`.

### Normalizer

**In:** one raw string
**Out:** one canonical value, or `null`

Refuses rather than guesses.

- **dates** parse from `YYYY-MM-DD`, `YYYY/MM/DD` or `YYYY.MM.DD` and round-trip
  through a calendar check, so `2026-02-31` is rejected rather than repaired
- **enums** map onto a closed set; text that matches nothing becomes `unknown`,
  which is a different outcome from the field being absent (`null`)
- **tick boxes** are tri-state: ticked, explicitly unticked, or undetermined.
  Word markers match on word boundaries, so "Normal" is not read as a "No"

### Confidence Scoring

**In:** blocks, page baseline, extraction result
**Out:** per-field score and band

Three steps:

1. Average every symbol confidence on the page into a baseline.
2. For each field, prefer the confidence of the block its label sits in; fall
   back to the baseline when no block matches.
3. Apply a per-field multiplier for how much the extraction step itself is
   trusted for that field.

Step 2 is what makes the score useful. A page-wide average says the same thing
about a crisp printed serial number and a smudged handwritten remark beside it.
On the synthetic document the page averages 0.86 while the handwritten remark
scores 0.49, and only the block-level view can tell them apart.

A field with no extracted value scores 0 rather than inheriting the baseline.
Reporting high confidence in a value that does not exist is the one outcome a
review gate must never produce.

Bands: `HIGH` at or above 0.90, `MEDIUM` from 0.70, `LOW` below that,
`UNREADABLE` at 0.

### Review Gate

**In:** field confidences and missing fields
**Out:** a status, and a reason per triggering field

| Status | Meaning |
| --- | --- |
| `blocked` | more than 30% of fields are below the review threshold — the page is too poor to review field by field, so re-capture it |
| `review_required` | usable extraction, but named fields need confirming |
| `passed` | every field is reliable and every required field is present |
| `extraction_failed` | no usable OCR response, so no fields were produced |

The `blocked` case exists because handing a reviewer a scan they also cannot
read is not a review task. Below that ratio, weak fields are a review task;
above it, the capture is the problem.

Reasons come back as `{ code, field }` pairs so a reviewer interface can point
at the exact field that caused the hold, and so the decision can be audited
without re-running the pipeline.

Nothing is auto-confirmed. `passed` means "no reviewer attention needed", not
"confirmed" — extracted values stay candidates until a person accepts them.

### Schema Validator

**In:** the structured output and the JSON Schema
**Out:** `{ valid, errors }` with a path per error

A dependency-free validator covering the subset of JSON Schema the output
schema uses. `assertSupportedSchema` fails loudly if the schema grows a keyword
the validator does not implement, so an unsupported keyword can never be
silently treated as satisfied.

Validation failure is reported as a failed run, and the output is still
returned so the mismatch can be inspected.

## Safe errors

Errors carry a stable code and a fixed message, and nothing else:

```js
{ ok: false, error_code: 'ocr_response_invalid',
  safe_message: 'OCR provider response is invalid.', status_code: null }
```

Raw OCR text, provider response bodies, credentials, file names and user input
never travel inside an error, because errors are the values most likely to end
up in a log line, a bug report or a support ticket. A provider exception is
discarded rather than wrapped, for the same reason. The error objects are frozen
so nothing can attach a payload to one later, and the tests assert the exact key
set to catch a future change that starts adding a `detail` field.

## Extending it

Swapping in a different business document means editing two files:
`src/field-definitions.js` and the JSON Schema. Nothing else in the pipeline
knows what the document is.

Swapping in a real OCR provider means writing one object with an `annotate()`
method. Everything downstream consumes the validated shape from
`ocr-response.js` rather than a provider payload, so no other module changes.
