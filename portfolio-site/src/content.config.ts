import { defineCollection } from 'astro:content';
import { glob, file } from 'astro/loaders';
import {
  workSchema,
  caseStudySchema,
  evidenceSchema,
  copySchema,
  uiCopySchema,
} from './lib/content/schema.ts';

/**
 * Three collections, one responsibility each.
 *
 *   work      the works themselves. Adding a work is adding a file here — no
 *             component changes, at 0, 1, 3 or 20 entries.
 *   evidence  the Evidence records the works point at. Kept separate because an
 *             Evidence record has its own provenance and its own review state.
 *   copy      the approval registry for authored site copy. One row per
 *             approved string; `approved-copy.ts` holds the frozen snapshot the
 *             rows are checked against.
 *
 * Singleton section content (the HOW I BUILD workflow, the STACK rows, the
 * PRINCIPLES list) lives in src/content/site.json instead of a collection: it
 * is one heterogeneous record, not a queryable set, so a loader would add
 * indirection without adding anything. It is schema-validated all the same —
 * see lib/content/site.ts.
 */
const work = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/work' }),
  schema: workSchema,
});

/**
 * The Case Study bodies (CS-1 … CS-16). Kept apart from `work` because they are
 * published independently: a work ships on the homepage from the moment its
 * facts are sourced, while its Case Study ships only once the whole body is
 * written. One collection would have forced the two to move together.
 */
const caseStudy = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/case-study' }),
  schema: caseStudySchema,
});

const evidence = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/evidence' }),
  schema: evidenceSchema,
});

const copy = defineCollection({
  loader: file('./src/content/copy/shipping.json'),
  schema: copySchema,
});

/**
 * The UI chrome inventory — labels, headings and button text, each with the
 * `file:line` in the frozen prototype it was transcribed from. Kept apart from
 * `copy` because the two are approved by different means: an authored sentence
 * needs a person, a transcription needs its source to still read the same.
 */
const uiCopy = defineCollection({
  loader: file('./src/content/copy/ui.json'),
  schema: uiCopySchema,
});

export const collections = { work, caseStudy, evidence, copy, uiCopy };
