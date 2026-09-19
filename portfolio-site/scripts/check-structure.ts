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
import { loadCopy, loadWorks } from '../src/lib/content/load.ts';
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
  // #8 — the editorial voice. Each of these was a note from whoever wrote the
  // record to whoever reviews it, printed to the reader inside a table of
  // measurements or a scope boundary. They are checked as literals because
  // that is what they were: fixed phrases, not a style to be detected.
  '推定値を書かない', '作品全体の性質として書かない',
  // A shell command is how a number was obtained, not what it means. The
  // Case Study says the count and where it came from in a sentence instead.
  'grep -rho', 'wc -l', 'find src -name',
  // The publication review's own verdict. A record clearing its own review is
  // not a fact about the work (spec §11.1).
  'PUBLISH READY',
  // The /work/ header's own implementation talk, removed at the #7 visual
  // review. The strings stay registered in ui.json; what must not come back is
  // this page RENDERING them. Each literal below is a fragment of one of the
  // three: the h1's growth promise, the lede's degeneracy rule, the rail note.
  '20 件まで', '一様な格子', '0 → 20 works',
];
//
// SCANNED OVER EVERY PUBLIC ROUTE, NOT TWO. The check used to read the homepage
// and the archive, which is where #7's leaks were; #8 found the rest of them on
// the Case Study and Technical pages, which nothing was looking at. A gate that
// covers the pages a previous pass happened to fix is a record of that pass,
// not a contract.
const CASE_ROUTES = shipping
  .filter((w) => w.caseStudyPublished)
  .flatMap((w) => [`work/${w.slug}/index.html`, `work/${w.slug}/technical/index.html`]);
const PUBLIC_ROUTES = ['index.html', 'work/index.html', 'how-i-build/index.html', ...CASE_ROUTES];

let PUBLIC_INTERNAL = 0;
for (const route of PUBLIC_ROUTES) {
  const html = read(route);
  for (const token of INTERNAL_TOKENS) {
    if (html.includes(token)) {
      PUBLIC_INTERNAL += 1;
      failures.push(`PUBLIC_INTERNAL: /${route.replace(/index\.html$/, '')} に内部語 ${token} が出ている`);
    }
  }
}

// ---- CONTACT_EMAIL ----
// U-01. The address ships on one approval covering one email, so the rendered
// section must carry exactly that: one visible address, reachable, once. Two
// would mean a second channel nobody approved; zero would mean the conversion
// point regressed to "read the code" while the copy still promises a reply.
const contactAt = home.indexOf('id="contact"');
const contactHtml = contactAt < 0 ? '' : home.slice(contactAt, home.indexOf('</section>', contactAt));
const visibleEmails = [...contactHtml.matchAll(/>([^<>@\s]+@[a-z0-9.-]+\.[a-z]{2,})</gi)].map(
  (m) => m[1] as string,
);
const CONTACT_EMAIL = new Set(visibleEmails).size;
expect('CONTACT_EMAIL', CONTACT_EMAIL, 1);
expect('CONTACT_EMAIL_SHOWN', visibleEmails.length, 1);

const MAILTO_LINKS = [...contactHtml.matchAll(/href="mailto:([^"]+)"/g)].map((m) => m[1] as string);
if (MAILTO_LINKS.length === 0) {
  failures.push('CONTACT_EMAIL: 住所は出ているが mailto: リンクが無い — 読めるだけで送れない');
}
for (const to of MAILTO_LINKS) {
  if (!visibleEmails.includes(to)) {
    failures.push(`CONTACT_EMAIL: mailto:${to} が画面に出ている住所と違う`);
  }
}
// ---- CONTACT_HELPER ----
// #34. 補助文は 1 回だけ出る。0 なら「何を書けばよいか」の案内が落ちており、
// 2 回以上なら同じ案内を二度読ませている。文字列は registry から取る——ここに
// 書き写せば、承認済みの文と gate の中の文の 2 か所を合わせ続けることになる。
const helperText = loadCopy().find((c) => c.id === 'home.contact.helper')?.text ?? '';
if (helperText === '') {
  failures.push('CONTACT_HELPER: copy registry に home.contact.helper が無い');
}
const CONTACT_HELPER = helperText === '' ? 0 : contactHtml.split(helperText).length - 1;
expect('CONTACT_HELPER', CONTACT_HELPER, 1);

// The GitHub route must survive alongside it. The two channels have different
// jobs (#8 §1) and collapsing either into the other is the regression.
if (!/href="https:\/\/github\.com\/youshi-kanda"/.test(contactHtml)) {
  failures.push('CONTACT_EMAIL: GitHub 導線が CONTACT から消えている');
}

// ---- CASE_SPEC_IDS ----
// The case-study and technical specs number their sections CS-1…CS-16 and
// T-0…T-8. Those are filing references for documents a reader does not have,
// and #8 replaced them with the section's position. The pattern is anchored to
// the rail and the table of contents — the two places an index is PRINTED — so
// a work whose own content legitimately names a test id (`T-09` in PPM's test
// breakdown) does not trip it.
let CASE_SPEC_IDS = 0;
for (const route of [...CASE_ROUTES, 'index.html']) {
  const html = read(route);
  for (const m of html.matchAll(/<span class="(?:ix|mo)">((?:CS|T)-\d+)<\/span>/g)) {
    CASE_SPEC_IDS += 1;
    failures.push(`CASE_SPEC_IDS: /${route.replace(/index\.html$/, '')} の節番号が spec id ${m[1]} のまま`);
  }
}

console.log(
  `HERO_DISPLAY_LINES = ${HERO_DISPLAY_LINES} / ` +
    `FEATURED_BLOCKS = ${FEATURED_BLOCKS} / ` +
    `MORE_ROWS = ${MORE_ROWS} / ` +
    `CAPABILITY_CATEGORIES = ${CAPABILITY_CATEGORIES} / ` +
    `ARCHIVE_ROWS = ${ARCHIVE_ROWS} (shipping ${shipping.length}) / ` +
    `BAND_RESIDUE = ${BAND_RESIDUE} / LEAD_ENTRIES = ${LEAD_ENTRIES} / ` +
    `WORK_ENTRIES = ${WORK_ENTRIES} / PUBLIC_INTERNAL = ${PUBLIC_INTERNAL} / ` +
    `CASE_SPEC_IDS = ${CASE_SPEC_IDS} (routes ${PUBLIC_ROUTES.length}) / ` +
    `CONTACT_EMAIL = ${CONTACT_EMAIL} (mailto ${MAILTO_LINKS.length}) / ` +
    `CONTACT_HELPER = ${CONTACT_HELPER}`,
);

if (failures.length > 0) {
  console.error(`\nSTRUCTURE_CONTRACT = FAIL（${failures.length}）`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}

console.log('STRUCTURE_CONTRACT = PASS');
