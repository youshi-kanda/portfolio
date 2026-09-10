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
 *   HERO_CAPABILITY_ROWS  the capability rail is three capability axes, each a
 *                         name and the line under it, and all six strings are
 *                         registry copy. A migration that changes the copy must
 *                         hand over three rows in the same commit — the rail is
 *                         never allowed to pass through a two-row state, which
 *                         is what it would do if the rows were moved one at a
 *                         time out of the two places V3 kept them (site.json,
 *                         and a derivation over the work list).
 *   HERO_DISPLAY_LINES    the display is cut into three lines by hand, and each
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
 *   EDITORIAL_BAND_PANELS the band composes three panels or is not drawn. The
 *                         expected number is computed from the content — the
 *                         featured shipping works — so this holds the RENDERED
 *                         band against the editorial decision rather than
 *                         against a number typed twice. `B-BAND-COUNT` has
 *                         already refused four or more before a build gets
 *                         here; this catches the other direction, a band that
 *                         drew a different number than the content asked for.
 *   LEAD_ENTRIES          the homepage leads with one work entry or with none.
 *                         `T-MULTI-LEAD` has already refused two claimants in
 *                         the content; this is the rendered side of the same
 *                         rule, and it is a separate question — content naming
 *                         one Lead and the page drawing two would satisfy the
 *                         gate and still be two.
 *   WORK_INDEX_ROWS       the index lists every shipping work. Not "some" and
 *                         not "the featured ones": the Editorial Band is the
 *                         selection, and an index that quietly dropped a work
 *                         would leave it reachable from nowhere on this page.
 *   WORK_ENTRIES          the homepage and the register list the same works.
 *                         They are rendered by different components from one
 *                         list, so a set that differs means one of them dropped
 *                         a work rather than that the site has fewer.
 *
 * Run over `dist/` for the same reason the link check is: these are properties
 * of the artifact, and every one of them looks correct in the component that
 * produced it.
 */
import { readFileSync } from 'node:fs';
import { featuredWorks, shippingWorks } from '../src/lib/content/derive.ts';
import { loadWorks } from '../src/lib/content/load.ts';
import { BAND_PANELS } from '../src/lib/validation/band.ts';

const DIST = new URL('../dist/', import.meta.url).pathname;
const read = (route: string): string => readFileSync(`${DIST}${route}`, 'utf8');

const failures: string[] = [];
const expect = (label: string, actual: unknown, wanted: unknown): void => {
  if (String(actual) !== String(wanted)) {
    failures.push(`${label} = ${String(actual)} — 期待は ${String(wanted)}`);
  }
};

const home = read('index.html');

// ---- HERO_CAPABILITY_ROWS ----
const cap3 = /<div class="cap3">([\s\S]*?)<\/div>/.exec(home)?.[1] ?? '';
const HERO_CAPABILITY_ROWS = [...cap3.matchAll(/<span class="cb">/g)].length;
expect('HERO_CAPABILITY_ROWS', HERO_CAPABILITY_ROWS, 3);

// ---- HERO_DISPLAY_LINES ----
const display = /<h1 class="dsp">([\s\S]*?)<\/h1>/.exec(home)?.[1] ?? '';
const HERO_DISPLAY_LINES = [...display.matchAll(/\sdata-hero-line\b/g)].length;
expect('HERO_DISPLAY_LINES', HERO_DISPLAY_LINES, 3);
// A line forced onto one row by `white-space:nowrap` would satisfy the count
// while running past the measure — the defect this check exists to catch,
// wearing the check's own answer. The display may not carry it.
if (/white-space\s*:\s*nowrap/.test(display)) {
  failures.push('HERO_DISPLAY_LINES: display に white-space:nowrap がある — 収まっていないものを収まって見せている');
}

// ---- EDITORIAL_BAND_PANELS ----
const works = loadWorks();
const featured = featuredWorks(works);
const EDITORIAL_BAND_PANELS = [...home.matchAll(/\sdata-band-panel\b/g)].length;
expect(
  'EDITORIAL_BAND_PANELS',
  EDITORIAL_BAND_PANELS,
  featured.length === BAND_PANELS ? BAND_PANELS : 0,
);

// ---- LEAD_ENTRIES ----
const LEAD_ENTRIES = [...home.matchAll(/\sdata-homepage-role="lead"/g)].length;
if (LEAD_ENTRIES > 1) {
  failures.push(`LEAD_ENTRIES = ${LEAD_ENTRIES} — Homepage が先頭に置く entry は 1 件か 0 件`);
}

// ---- WORK_INDEX_ROWS ----
// The index is one section, and `data-w` is on more than one kind of element,
// so the count is taken inside that section rather than over the document.
// Nothing on this page nests a <section>, which is what makes the slice sound.
const shipping = shippingWorks(works);
const indexAt = home.indexOf('data-homepage-role="index"');
const indexHtml =
  indexAt < 0 ? '' : home.slice(indexAt, home.indexOf('</section>', indexAt));
const WORK_INDEX_ROWS = [...indexHtml.matchAll(/<a class="r"[^>]*\sdata-w="/g)].length;
expect('WORK_INDEX_ROWS', WORK_INDEX_ROWS, shipping.length);

// ---- WORK_ENTRIES ----
const marked = (html: string): Set<string> =>
  new Set([...html.matchAll(/\sdata-w="([^"]+)"/g)].map((m) => m[1] as string));
const onHome = marked(home);
const inRegister = marked(read('work/index.html'));
const WORK_ENTRIES = onHome.size;

if (WORK_ENTRIES === 0) failures.push('WORK_ENTRIES = 0 — homepage に作品が 1 件も出ていない');
const missing = [...onHome].filter((slug) => !inRegister.has(slug));
const extra = [...inRegister].filter((slug) => !onHome.has(slug));
if (missing.length > 0 || extra.length > 0) {
  failures.push(
    `WORK_ENTRIES: / と /work/ の作品集合が違う` +
      `${missing.length > 0 ? ` — /work/ に無い: ${missing.join(' ')}` : ''}` +
      `${extra.length > 0 ? ` — / に無い: ${extra.join(' ')}` : ''}`,
  );
}

console.log(
  `HERO_CAPABILITY_ROWS = ${HERO_CAPABILITY_ROWS} / ` +
    `HERO_DISPLAY_LINES = ${HERO_DISPLAY_LINES} / ` +
    `EDITORIAL_BAND_PANELS = ${EDITORIAL_BAND_PANELS} (featured ${featured.length}) / ` +
    `LEAD_ENTRIES = ${LEAD_ENTRIES} / ` +
    `WORK_INDEX_ROWS = ${WORK_INDEX_ROWS} (shipping ${shipping.length}) / ` +
    `WORK_ENTRIES = ${WORK_ENTRIES}`,
);

if (failures.length > 0) {
  console.error(`\nSTRUCTURE_CONTRACT = FAIL（${failures.length}）`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}

console.log('STRUCTURE_CONTRACT = PASS');
