/**
 * Read the content collections straight off disk.
 *
 * `astro:content` is only available inside the Astro runtime, but the gates
 * have to run in two places it is not: the `validate:content` CLI, and the
 * unit tests. Rather than keep a second copy of the data, this reads the same
 * files the collections read and parses them with the same schemas — so a
 * schema change cannot make the CLI and the site disagree.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  workSchema,
  caseStudySchema,
  evidenceSchema,
  copySchema,
  uiCopySchema,
} from './schema.ts';
import type { Work, CaseStudy, Evidence, CopyItem, UiCopyItem } from './schema.ts';

export const CONTENT_DIR = fileURLToPath(new URL('../../content/', import.meta.url));

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));

function readDir<T>(dir: string, parse: (value: unknown) => T): T[] {
  const base = join(CONTENT_DIR, dir);
  return readdirSync(base)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => {
      try {
        return parse(readJson(join(base, f)));
      } catch (cause) {
        throw new Error(`${dir}/${f} がスキーマに適合しない: ${String(cause)}`, { cause });
      }
    });
}

export const loadWorks = (): Work[] => readDir('work', (v) => workSchema.parse(v));

export const loadCaseStudies = (): CaseStudy[] =>
  readDir('case-study', (v) => caseStudySchema.parse(v));

export const loadEvidence = (): Evidence[] => readDir('evidence', (v) => evidenceSchema.parse(v));

function readArray<T>(file: string, parse: (value: unknown) => T): T[] {
  const raw = readJson(join(CONTENT_DIR, 'copy', file));
  if (!Array.isArray(raw)) throw new Error(`copy/${file} は配列であること`);
  return raw.map((v) => parse(v));
}

export const loadCopy = (): CopyItem[] =>
  readArray('shipping.json', (v) => copySchema.parse(v));

export const loadUiCopy = (): UiCopyItem[] =>
  readArray('ui.json', (v) => uiCopySchema.parse(v));

export interface ContentBundle {
  works: Work[];
  caseStudies: CaseStudy[];
  evidence: Evidence[];
  copy: CopyItem[];
  uiCopy: UiCopyItem[];
}

export const loadAll = (): ContentBundle => ({
  works: loadWorks(),
  caseStudies: loadCaseStudies(),
  evidence: loadEvidence(),
  copy: loadCopy(),
  uiCopy: loadUiCopy(),
});
