# Document Field Extraction Demo

**This is a portfolio demo using synthetic data only.**

Reading text off a scanned form is the easy half. The hard half is deciding
which of the values you just read a human still has to check.

This demo takes an OCR response for an equipment inspection form, pulls out
twelve business fields, works out how much each one can be trusted, and routes
the weak ones to a person. It runs offline, with no dependencies, no API key
and no network access of any kind.

```
npm test     # 157 tests, no network
npm run demo # runs the pipeline and prints the result
```

## Scope

The original workflow this is derived from integrates an OCR provider. **This
demo does not implement OCR** — it focuses on the post-OCR half: field
extraction, normalisation, confidence scoring, validation and the review gate.

The default path uses a **deterministic synthetic OCR response**. The pipeline
never calls a service, and the OCR response is authored alongside the sample
document rather than produced by running OCR over it.

## What it does

```
Synthetic Document   (visual sample only — the pipeline never reads it)

Synthetic OCR Response -> Mock OCR Provider
   -> Field Extractor -> Normalizer -> Confidence Scoring
   -> Review Gate -> Schema Validator -> Structured JSON
```

`npm run demo` prints:

```
Extracted fields
----------------
document_id           0.98  HIGH       DOC-2026-0142
equipment_id          0.97  HIGH       EQ-1001
inspection_date       0.96  HIGH       2026-08-15
location              0.89  MEDIUM     Warehouse A
equipment_type        0.87  MEDIUM     Packaging Machine
condition             0.90  HIGH       needs_review
safety_check_passed   0.95  HIGH       true
repair_required       0.93  HIGH       true
photo_attached        0.91  HIGH       false
issue_description     0.49  LOW        Abnormal vibration detected
next_inspection_date  0.88  MEDIUM     2026-11-15
inspector_role        0.56  LOW        internal

Review gate
-----------
page baseline     0.86
status            review_required
confirm allowed   false
reason            low_confidence -> issue_description
reason            low_confidence -> inspector_role
```

Ten of the twelve fields are ready to use. Two are not, and the pipeline says
which two and why.

## The interesting parts

**Confidence is scored per block, not per page.** The page averages 0.86. The
handwritten remark sits in a 0.58 block and scores 0.49 after its multiplier.
A page-wide average would have said the same thing about the printed serial
number and the smudged note beside it, and the review gate would have had
nothing to catch.

**A missing value scores zero, not the page baseline.** Reporting high
confidence in a value that does not exist is the one outcome a review gate must
never produce.

**Extraction windows stop at the next field label.** The three tick boxes sit
one under another. A fixed-width window after "Photo Attached" reaches the
"[x]" belonging to "Repair Required" above it, and the form comes back saying a
photo was attached when it was not. Bounding the window at the next label is
what prevents that; there is a test for it.

**Tick boxes are tri-state.** Ticked, explicitly unticked, or undetermined.
Collapsing the last two into `false` is how a safety check nobody filled in gets
recorded as a safety check that failed.

**Dates are refused, not repaired.** `2026-02-31` returns `null`. A silently
corrected value is worse than a missing one, because the reviewer never learns
it needed checking.

**Nothing is auto-confirmed.** `passed` means "no reviewer attention needed",
not "confirmed". Extracted values stay candidates until a person accepts them.

**Errors carry a code and a fixed message, and nothing else.** No response
body, no OCR text, no input echo — errors are the values most likely to end up
in a log or a bug report. A provider exception is discarded rather than
wrapped, for the same reason.

## Review gate outcomes

| Status | When |
| --- | --- |
| `passed` | every field reliable, every required field present |
| `review_required` | usable extraction, named fields need confirming |
| `blocked` | more than 30% of fields below threshold — re-capture the page |
| `extraction_failed` | no usable OCR response |

`blocked` exists because handing a reviewer a scan they also cannot read is not
a review task.

## Running it

Node 20 or newer. There is nothing to install.

```bash
npm run demo                          # the healthy path
npm run demo -- --scenario throws     # provider failure
npm run demo -- --scenario empty_text # OCR returned nothing readable
npm test                              # 157 tests across 40 suites
npm run check                         # syntax, module loading, network scan
npm run fixtures:generate             # regenerate the synthetic PDF and OCR response
```

`npm run demo` exits 0 when the run produced schema-valid output — including
when the gate says `review_required` or `blocked`, which are successful
outcomes of the pipeline doing its job. It exits 1 when no output could be
produced at all.

## No network access

The demo claims it never reaches the network, so that claim is checked rather
than asserted:

- `tests/no-network.test.js` poisons `fetch`, `XMLHttpRequest` and `WebSocket`,
  runs every pipeline scenario against the traps, and fails if any is touched.
- The same file scans every source file for network APIs and socket modules.
- It also asserts that `package.json` declares no dependencies, and that every
  import is either relative or a `node:` builtin.
- `npm run check` repeats the source scan as a standalone gate.

There are no dependencies, so `npm install` fetches nothing.

## Synthetic data

Everything in `fixtures/` is invented and generated by
`scripts/generate-synthetic-document.js` from a specification in that file:

- `synthetic-equipment-inspection.pdf` — a one-page form, written byte by byte
  including its cross-reference table, so the demo needs no PDF library
- `synthetic-ocr-response.json` — an OCR-shaped response for that page, with a
  confidence on every symbol
- `expected-output.json` — the pipeline's output, committed as a golden file
  and compared on every test run

The PDF and the OCR response come from the same specification, so they cannot
drift apart. No OCR engine ever ran over the PDF.

The demo and the tests both run on a fixed clock, so output is byte-identical
across runs and can be committed as a golden file. A real deployment passes an
actual timestamp.

## Layout

```
src/
  index.js              pipeline orchestration
  config.js             thresholds, statuses, reason codes
  field-definitions.js  the form: labels, patterns, multipliers, required flags
  extractor.js          keyword-anchored extraction with bounded windows
  normalizer.js         dates, enums, tri-state tick boxes
  confidence.js         symbol aggregation, block matching, per-field scoring
  review-gate.js        passed / review_required / blocked
  schema-validator.js   dependency-free JSON Schema subset
  safe-errors.js        codes and fixed messages
  ocr-response.js       provider boundary
  schema.js             schema loader
  providers/
    mock-provider.js    deterministic synthetic responses
schema/                 output JSON Schema
fixtures/               synthetic PDF, OCR response, golden output
scripts/                demo, static check, fixture generator
tests/                  157 tests
docs/architecture.md    per-stage input/output
```

## Extending it

Swapping in a different business document means editing
`src/field-definitions.js` and the JSON Schema. Nothing else in the pipeline
knows what the document is.

Swapping in a real OCR provider means writing one object with an `annotate()`
method. Everything downstream consumes the validated shape from
`src/ocr-response.js` rather than a provider payload.

## Tech stack

JavaScript (ES modules) · Node.js 20+ · `node:test` · JSON Schema 2020-12 ·
zero runtime dependencies
