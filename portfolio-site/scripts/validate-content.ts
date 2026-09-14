/**
 * `npm run validate:content` — run the Truth Gate without building.
 *
 * Same code path the build uses (`runGates`), same content on disk. It exists
 * so an author can check content before waiting on a build, and so CI can
 * report the content result separately from a compile failure.
 *
 * Exit 0 = publishable. Exit 1 = would fail `npm run build`.
 *
 *     node scripts/validate-content.ts [--dev]
 *
 *   --dev     report as development: pending content warns instead of failing
 *
 * `--strict` is gone with the entry-variant gate. Its only effect was to
 * promote that gate's `W-ADJACENT` to an error, so with the gate retired the
 * flag would have accepted the argument and changed nothing — a control that
 * looks like it does something and does not.
 */
import { loadAll } from '../src/lib/content/load.ts';
import { siteStrings } from '../src/lib/content/site.ts';
import { uiStrings } from '../src/lib/content/ui.ts';
import { format, runGates, type Mode } from '../src/lib/validation/index.ts';
import { siteCopyCoverage } from '../src/lib/validation/site-copy.ts';

const argv = process.argv.slice(2);
const mode: Mode = argv.includes('--dev') ? 'development' : 'production';

const content = loadAll();
const { findings, errors, warnings, ok } = runGates(content, { mode });
const siteCopy = siteCopyCoverage(content.copy, content.uiCopy, siteStrings());
const count = (code: string): number => findings.filter((f) => f.code === code).length;

const pending = [...content.copy, ...content.uiCopy].filter(
  (c) => c.publication.reviewStatus !== 'approved',
);

console.log(
  `content: works ${content.works.length} / evidence ${content.evidence.length} / ` +
    `approved copy ${content.copy.length}  [${mode}]`,
);
console.log(
  `UI chrome: ${content.uiCopy.length} registered ` +
    `(ui-system ${content.uiCopy.filter((c) => c.kind === 'ui-system').length} / ` +
    `editorial ${content.uiCopy.filter((c) => c.kind === 'editorial').length} / ` +
    `user-fact ${content.uiCopy.filter((c) => c.kind === 'user-fact').length})`,
);
console.log(
  `UNMANAGED_SHIPPING_COPY = ${uiStrings().filter((s) => !new Set(content.uiCopy.map((c) => c.path)).has(s.path)).length} / ` +
    `PENDING_SHIPPING_COPY = ${pending.length}`,
);
console.log(
  `claim.kind: fact ${[...content.copy, ...content.uiCopy].filter((c) => c.publication.claimType === 'fact').length} / ` +
    `presentation ${[...content.copy, ...content.uiCopy].filter((c) => c.publication.claimType === 'presentation').length}`,
);
/**
 * WHO signed off, not WHETHER anything did. Every record counted here is
 * already `approved` — the Truth Gate would have refused the build otherwise.
 * What this measures is whether the approval names a person and a date.
 *
 * The gap is historical and is not backfilled. Guessing who approved a record
 * in 2026-08 would be inventing the exact kind of fact this site exists to
 * avoid inventing, so the number is reported and left alone.
 *
 * It does not grow. New and re-approved shipping copy is attributed by
 * construction: an `approved` row in the copy collection must appear in
 * APPROVED_TEXT (A-UNKNOWN), that id must belong to an approval batch
 * (A-BATCH), and the row's approvedBy / approvedAt must equal that batch's
 * (A-BATCH again). The unattributed rows are the two registries that predate
 * batches, plus the records whose provenance is a locator rather than a
 * person — for which the matrix asks sourceRefs, not an approver.
 */
const attribution = (rows: readonly { publication: { reviewStatus: string; approvedBy: string | null; approvedAt: string | null } }[]) => {
  const approved = rows.filter((r) => r.publication.reviewStatus === 'approved');
  const named = approved.filter((r) => r.publication.approvedBy && r.publication.approvedAt);
  return { approved: approved.length, named: named.length, unnamed: approved.length - named.length };
};
const byCollection = {
  copy: attribution(content.copy),
  uiCopy: attribution(content.uiCopy),
  work: attribution(content.works),
  'case-study': attribution(content.caseStudies),
};
const named = Object.values(byCollection).reduce((n, a) => n + a.named, 0);
const unnamed = Object.values(byCollection).reduce((n, a) => n + a.unnamed, 0);

console.log(
  `APPROVAL_ATTRIBUTION: attributed ${named} / unattributed ${unnamed}  ` +
    `[report only — 承認者の帰属であって承認状態ではない]`,
);
console.log(
  `  ${Object.entries(byCollection)
    .map(([k, a]) => `${k} ${a.named}/${a.approved}`)
    .join(' · ')}`,
);
console.log(
  `site.json copy: MANAGED = ${siteCopy.managed.length} / ` +
    `UNMANAGED = ${siteCopy.unmanaged.length}  [report only]`,
);
console.log(
  `W-CLAIM-SUSPECT = ${count('W-CLAIM-SUSPECT')} / ` +
    `W-LITERAL-COUNT = ${count('W-LITERAL-COUNT')} / ` +
    `W-DUAL-SOURCE = ${count('W-DUAL-SOURCE')}  [report only]`,
);

if (warnings.length > 0) {
  console.log(`\n${warnings.length} warning(s):`);
  console.log(format(warnings));
}

if (!ok) {
  console.error(`\n${errors.length} error(s) — production build は通りません:`);
  console.error(format(errors));
  process.exit(1);
}

console.log('\nTruth Gate: PASS');
