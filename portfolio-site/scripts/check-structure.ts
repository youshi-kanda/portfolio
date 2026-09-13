/**
 * `node scripts/check-structure.ts` — the rendering contract check.
 *
 * A companion to `check-links.ts`, and deliberately not part of it. That script
 * answers one question — does every link and anchor in the artifact resolve? —
 * and a row count is not a link. Putting DOM shape assertions in a link checker
 * would leave the tool's name disagreeing with what it enforces, and the next
 * person would have to read it to find out which.
 *
 * What belongs here: invariants about the SHAPE of what shipped, which no
 * component can see from the inside because each one only knows its own part.
 *
 *   CAPABILITY_CATEGORIES 03 CAPABILITIES draws every category the content
 *                         declares. The capability rail left the hero in #7 and
 *                         was re-cut here into four things a reader can hand
 *                         over, so the check followed it: the expected number is
 *                         computed from `site.capabilities`, which holds the
 *                         rendered section against the editorial decision rather
 *                         than against a number typed twice.
 *   FEATURED_BLOCKS       01 FEATURED WORK draws one block per featured work.
 *                         Not "some": a work promoted in the content and missing
 *                         from the page is a decision the page silently
 *                         overruled.
 *   MORE_ROWS             02 MORE PROJECTS draws one row per `more` work, on the
 *                         same terms.
 *   HERO_DISPLAY_LINES    the display is cut into lines by hand, and each
 *                         line is an element carrying `data-hero-line`. V3
 *                         counted `<br>`, which measures the authoring and not
 *                         the result: the V4 copy shipped three `<br>`s and
 *                         rendered five lines, and this check passed. Counting
 *                         elements does not prove the visual line count either
 *                         — nothing reading static HTML can — but the elements
 *                         are blocks sized to the measure, so a line that no
 *                         longer fits wraps inside its own box where a viewport
 *                         check finds it, instead of disappearing into the
 *                         line after it.
 *   LEAD_ENTRIES          zero. The Lead was retired in #7; a residual one would
 *                         mean a work introduced twice on one page.
 *   ARCHIVE_ROWS          /work/ lists every shipping work. It is the archive,
 *                         so a work missing HERE is a work reachable from
 *                         nowhere — which is the defect the old WORK_INDEX_ROWS
 *                         guarded when the homepage was the index.
 *   WORK_ENTRIES          every work on the homepage is in the archive. A
 *                         SUBSET now, not an equality: `dfe` ships, keeps its
 *                         page, and is deliberately on neither homepage tier,
 *                         so the archive is allowed to hold more. What is still
 *                         refused is the other direction — a work the homepage
 *                         shows and the archive does not.
 *
 * Run over `dist/` for the same reason the link check is: these are properties
 * of the artifact, and every one of them looks correct in the component that
 * produced it.
 */
import { readFileSync } from 'node:fs';
import { shippingWorks } from '../src/lib/content/derive.ts';
import { loadWorks } from '../src/lib/content/load.ts';
import { site } from '../src/lib/content/site.ts';

const DIST = new URL('../dist/', import.meta.url).pathname;
const read = (route: string): string => readFileSync(`${DIST}${route}`, 'utf8');

const failures: string[] = [];
const expect = (label: string, actual: unknown, wanted: unknown): void => {
  if (String(actual) !== String(wanted)) {
    failures.push(`${label} = ${String(actual)} — 期待は ${String(wanted)}`);
  }
};

const home = read('index.html');

// ---- CAPABILITY_CATEGORIES ----
const CAPABILITY_CATEGORIES = [...home.matchAll(/<div class="cap-i">/g)].length;
expect('CAPABILITY_CATEGORIES', CAPABILITY_CATEGORIES, site.capabilities.categories.length);

// ---- HERO_DISPLAY_LINES ----
const display = /<h1 class="dsp">([\s\S]*?)<\/h1>/.exec(home)?.[1] ?? '';
const HERO_DISPLAY_LINES = [...display.matchAll(/\sdata-hero-line\b/g)].length;
expect('HERO_DISPLAY_LINES', HERO_DISPLAY_LINES, 2);
// A line forced onto one row by `white-space:nowrap` would satisfy the count
// while running past the measure — the defect this check exists to catch,
// wearing the check's own answer. The display may not carry it.
if (/white-space\s*:\s*nowrap/.test(display)) {
  failures.push('HERO_DISPLAY_LINES: display に white-space:nowrap がある — 収まっていないものを収まって見せている');
}

// The band is gone (#7 C-1). A residual panel would mean a work introduced
// twice on one page, which is the defect its removal exists to prevent.
const works = loadWorks();
const BAND_RESIDUE = [...home.matchAll(/\sdata-band-panel\b/g)].length;
expect('BAND_RESIDUE', BAND_RESIDUE, 0);

// ---- LEAD_ENTRIES ----
const LEAD_ENTRIES = [...home.matchAll(/\sdata-homepage-role="lead"/g)].length;
expect('LEAD_ENTRIES', LEAD_ENTRIES, 0);

// ---- FEATURED_BLOCKS / MORE_ROWS ----
const shipping = shippingWorks(works);
const FEATURED_BLOCKS = [...home.matchAll(/\sdata-featured-block\b/g)].length;
expect('FEATURED_BLOCKS', FEATURED_BLOCKS, works.filter((w) => w.homepage === 'featured').length);

const moreAt = home.indexOf('id="more"');
const moreHtml = moreAt < 0 ? '' : home.slice(moreAt, home.indexOf('</section>', moreAt));
const MORE_ROWS = [...moreHtml.matchAll(/class="r[^"]*"[^>]*\sdata-w="/g)].length;
expect('MORE_ROWS', MORE_ROWS, works.filter((w) => w.homepage === 'more').length);

// ---- ARCHIVE_ROWS ----
const archive = read('work/index.html');
const ARCHIVE_ROWS = [...archive.matchAll(/class="r[^"]*"[^>]*\sdata-w="/g)].length;
expect('ARCHIVE_ROWS', ARCHIVE_ROWS, shipping.length);

// ---- WORK_ENTRIES ----
const marked = (html: string): Set<string> =>
  new Set([...html.matchAll(/\sdata-w="([^"]+)"/g)].map((m) => m[1] as string));
const onHome = marked(home);
const inRegister = marked(archive);
const WORK_ENTRIES = onHome.size;

if (WORK_ENTRIES === 0) failures.push('WORK_ENTRIES = 0 — homepage に作品が 1 件も出ていない');
const missing = [...onHome].filter((slug) => !inRegister.has(slug));
if (missing.length > 0) {
  failures.push(
    `WORK_ENTRIES: homepage にあって /work/ に無い作品がある — ${missing.join(' ')}。` +
      `archive は homepage の上位集合であること`,
  );
}

// ---- PUBLIC_INTERNAL ----
// Internal vocabulary must not reach a reader. These are renderer names, gate
// field values and review bookkeeping: each is checkable as a literal, and each
// leaked onto a public page before #7.
const INTERNAL_TOKENS = [
  'v-stage', 'v-split', 'v-terminal',
  'sourceRef', 'reviewStatus', 'publicDemoScope', 'spec CS-',
  'public-repo', 'private-repo', 'linkPolicy',
  'data-homepage-role="lead"',
];
let PUBLIC_INTERNAL = 0;
for (const route of ['index.html', 'work/index.html']) {
  const html = read(route);
  for (const token of INTERNAL_TOKENS) {
    if (html.includes(token)) {
      PUBLIC_INTERNAL += 1;
      failures.push(`PUBLIC_INTERNAL: /${route === 'index.html' ? '' : route.replace('index.html', '')} に内部語 ${token} が出ている`);
    }
  }
}

console.log(
  `HERO_DISPLAY_LINES = ${HERO_DISPLAY_LINES} / ` +
    `FEATURED_BLOCKS = ${FEATURED_BLOCKS} / ` +
    `MORE_ROWS = ${MORE_ROWS} / ` +
    `CAPABILITY_CATEGORIES = ${CAPABILITY_CATEGORIES} / ` +
    `ARCHIVE_ROWS = ${ARCHIVE_ROWS} (shipping ${shipping.length}) / ` +
    `BAND_RESIDUE = ${BAND_RESIDUE} / LEAD_ENTRIES = ${LEAD_ENTRIES} / ` +
    `WORK_ENTRIES = ${WORK_ENTRIES} / PUBLIC_INTERNAL = ${PUBLIC_INTERNAL}`,
);

if (failures.length > 0) {
  console.error(`\nSTRUCTURE_CONTRACT = FAIL（${failures.length}）`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}

console.log('STRUCTURE_CONTRACT = PASS');
