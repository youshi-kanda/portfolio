/**
 * `npm run validate:content` — run the Truth Gate without building.
 *
 * Same code path the build uses (`runGates`), same content on disk. It exists
 * so an author can check content before waiting on a build, and so CI can
 * report the content result separately from a compile failure.
 *
 * Exit 0 = publishable. Exit 1 = would fail `npm run build`.
 *
 *     node scripts/validate-content.ts [--dev] [--strict]
 *
 *   --dev     report as development: pending content warns instead of failing
 *   --strict  promote W-ADJACENT to an error (authoring review, never the build)
 */
import { loadAll } from '../src/lib/content/load.ts';
import { uiStrings } from '../src/lib/content/ui.ts';
import { format, runGates, type Mode } from '../src/lib/validation/index.ts';

const argv = process.argv.slice(2);
const mode: Mode = argv.includes('--dev') ? 'development' : 'production';
const strict = argv.includes('--strict');

const content = loadAll();
const { errors, warnings, ok } = runGates(content, { mode, strict });

const pending = [...content.copy, ...content.uiCopy].filter(
  (c) => c.publication.reviewStatus !== 'approved',
);

console.log(
  `content: works ${content.works.length} / evidence ${content.evidence.length} / ` +
    `approved copy ${content.copy.length}  [${mode}${strict ? ' --strict' : ''}]`,
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
