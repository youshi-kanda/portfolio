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
 *   FEATURED_TIERS        #30 — every FEATURED block carries the tier its record
 *                         declares, and the two sets are the ones the owner
 *                         decided (HD-G). Read off `data-featured-tier` rather
 *                         than off the content, so a component that stopped
 *                         emitting the attribute fails here instead of shipping
 *                         five blocks with no hierarchy in them.
 *   FEATURED_ORDER        the running order of the blocks, as the artifact has
 *                         them. `featuredOrder` is one number per file and
 *                         nothing in a single record can see the sequence.
 *   FEATURED_SOURCE_LINKS one public-code CTA per linkable FEATURED work, and
 *                         no more. The count is derived from the source model,
 *                         so the day a `linkPolicy` flips this check moves with
 *                         it rather than having to be remembered.
 *   SOURCE_WITHHELD       the works with no source link carry the owner's
 *                         approved explanation — exactly once each. A block
 *                         that ends in silence is what HD-I exists to prevent.
 *   PUBLIC_CODE_LINKS     CONTACT names every shipping work whose source is
 *                         linkable, and only those.
 *   WITHHELD_URLS         no URL of a withheld or private source is anywhere in
 *                         the artifact. The scan is the other half of #7 C-8:
 *                         `linkPolicy` decides, and this proves the decision
 *                         survived rendering.
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
 *   HOW_DECISION_CASES    #31 — /how-i-build/ draws exactly the two decision
 *                         cases Issue #31 fixed, and the QA record is exactly
 *                         one. These four are stated as LITERALS, which nothing
 *                         else in this file is: everywhere else a count is
 *                         derived, because the content is allowed to grow and a
 *                         literal would be a second copy of an editorial
 *                         decision. Here the count IS the editorial decision —
 *                         #31 §6 says two cases and one supplement, and PR #19
 *                         being promoted to a third case is precisely the drift
 *                         this should refuse. Deriving these from site.json
 *                         would check that the page renders what the file says
 *                         while letting the file say anything.
 *   HOW_QA_RECORDS        one, on the same terms.
 *   HOW_PR_LINKS          three — one per case plus the QA record — and every
 *                         one built by `publicPrUrl` from `site.repo`. A PR URL
 *                         typed into a component would pass a count check and
 *                         fail this one.
 *   HOW_TOP_LINKS         one `href="#top"` against one `id="top"`, and the
 *                         control is an `<a>`. A button calling `scrollTo` is
 *                         the regression: it looks identical in a screenshot
 *                         and stops existing when the script does not run.
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
import {
  featuredHomepageWorks,
  linkableSourceWorks,
  publicPrUrl,
  shippingWorks,
  workPublicSourceUrl,
} from '../src/lib/content/derive.ts';
import { workSourceIsLinkable } from '../src/lib/content/compat.ts';
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

/**
 * The CONTACT band's own HTML. A function rather than a constant because two
 * checks now slice it and they are written far apart in this file; computing it
 * twice with two hand-written indexOf pairs is how they would come to disagree
 * about where the section ends.
 */
const contactSection = (): string => {
  const at = home.indexOf('id="contact"');
  return at < 0 ? '' : home.slice(at, home.indexOf('</section>', at));
};

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

// ---- FEATURED_TIERS / FEATURED_ORDER ----
// #30 HD-G. The blocks are matched in ONE pass so that the order the artifact
// has them in is the order the tiers are read off — two separate scans could
// each pass while disagreeing about which block is which.
const featuredBlocks = [
  ...home.matchAll(/<article class="fw"[^>]*\sdata-w="([^"]+)"[^>]*\sdata-featured-tier="([^"]+)"/g),
].map((m) => ({ slug: m[1] as string, tier: m[2] as string }));

const featuredContent = featuredHomepageWorks(works);
expect('FEATURED_TIERED', featuredBlocks.length, featuredContent.length);
expect(
  'FEATURED_ORDER',
  featuredBlocks.map((b) => b.slug).join(' → '),
  featuredContent.map((w) => w.slug).join(' → '),
);
for (const block of featuredBlocks) {
  const declared = featuredContent.find((w) => w.slug === block.slug)?.featuredTier;
  if (declared !== block.tier) {
    failures.push(
      `FEATURED_TIERS: ${block.slug} は data-featured-tier="${block.tier}" だが ` +
        `record は ${declared ?? '(なし)'}`,
    );
  }
}
const tierOf = (tier: string): string =>
  featuredBlocks.filter((b) => b.tier === tier).map((b) => b.slug).sort().join(' ');
expect(
  'FEATURED_PRIMARY',
  tierOf('primary'),
  featuredContent.filter((w) => w.featuredTier === 'primary').map((w) => w.slug).sort().join(' '),
);
expect(
  'FEATURED_SUPPORTING',
  tierOf('supporting'),
  featuredContent.filter((w) => w.featuredTier === 'supporting').map((w) => w.slug).sort().join(' '),
);

// ---- FEATURED_SOURCE_LINKS / SOURCE_WITHHELD ----
// The CTA count is derived from the source model, never from a literal: it is
// 1 today because `crm` is the only linkable FEATURED work, and it becomes 2
// on its own the day HD-D resolves.
const FEATURED_SOURCE_LINKS = [...home.matchAll(/\sdata-featured-source-link="([^"]+)"/g)].map(
  (m) => m[1] as string,
);
const linkableFeatured = featuredContent.filter((w) => workSourceIsLinkable(w)).map((w) => w.slug);
expect('FEATURED_SOURCE_LINKS', FEATURED_SOURCE_LINKS.join(' '), linkableFeatured.join(' '));

// HD-I. Every FEATURED work with no source link explains why, once. Counted
// against the blocks rather than against a number, and the sentence is read
// from the registry — copying it here would leave the approved text and the
// gate's copy of it to be kept in step by hand.
const withheldText = loadCopy().find((c) => c.id === 'home.works.sourceWithheld')?.text ?? '';
if (withheldText === '') {
  failures.push('SOURCE_WITHHELD: copy registry に home.works.sourceWithheld が無い');
}
const SOURCE_WITHHELD = withheldText === '' ? 0 : home.split(withheldText).length - 1;
expect(
  'SOURCE_WITHHELD',
  SOURCE_WITHHELD,
  featuredContent.length - linkableFeatured.length,
);

// ---- PUBLIC_CODE_LINKS ----
// CONTACT names the works a reader can actually read the code of. Derived from
// every SHIPPING work, not from the FEATURED five: `ppm` and `dfe` are not on
// that tier and their code is just as public.
const PUBLIC_CODE_LINKS = [...contactSection().matchAll(/\sdata-public-code-link="([^"]+)"/g)].map(
  (m) => m[1] as string,
);
expect(
  'PUBLIC_CODE_LINKS',
  PUBLIC_CODE_LINKS.join(' '),
  linkableSourceWorks(works).map((w) => w.slug).join(' '),
);

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

// ---- WITHHELD_URLS ----
// #7 C-8, checked on the artifact rather than in the component that decided it.
//
// STATED AS A WHITELIST, WHICH IS THE ONLY WAY IT CAN BE STATED. A blacklist
// would have to name the URL a withheld work WOULD have, and that string is
// precisely what the record refuses to hold: `sourceSchema` forbids a path on
// anything not linkable, so there is nothing to search for. So the check runs
// the other way — every `/tree/main/…` the site emits must be one
// `workPublicSourceUrl` built for a work the source model calls linkable, and
// any other is a URL nobody derived and therefore nobody checked.
//
// That catches the real failure mode: a component reading `access` directly
// would emit a tree URL for `hire`, which is genuinely `public-repo`, and no
// blacklist could have been written for it in advance.
const allowedTreeUrls = new Set(
  shipping.flatMap((w) => {
    const url = workPublicSourceUrl(w);
    return url ? [url] : [];
  }),
);
let WITHHELD_URLS = 0;
for (const route of PUBLIC_ROUTES) {
  const html = read(route);
  for (const m of html.matchAll(/href="(https:\/\/github\.com\/[^"]*\/tree\/[^"]*)"/g)) {
    const url = m[1] as string;
    if (allowedTreeUrls.has(url)) continue;
    WITHHELD_URLS += 1;
    failures.push(
      `WITHHELD_URLS: /${route.replace(/index\.html$/, '')} の ${url} は ` +
        `linkable な作品の source ではない`,
    );
  }
}

// ---- CONTACT_EMAIL ----
// U-01. The address ships on one approval covering one email, so the rendered
// section must carry exactly that: one visible address, reachable, once. Two
// would mean a second channel nobody approved; zero would mean the conversion
// point regressed to "read the code" while the copy still promises a reply.
const contactHtml = contactSection();
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

// ---- HOW_DECISION_CASES / HOW_QA_RECORDS / HOW_PR_LINKS / HOW_TOP_LINKS ----
// #31. The one place in this file that asserts literals — the header says why.
const method = read('how-i-build/index.html');

const HOW_DECISION_CASES = [...method.matchAll(/\sdata-decision-case="([^"]+)"/g)].map(
  (m) => m[1] as string,
);
expect('HOW_DECISION_CASES', HOW_DECISION_CASES.length, 2);

const HOW_QA_RECORDS = [...method.matchAll(/\sdata-qa-record\b/g)].length;
expect('HOW_QA_RECORDS', HOW_QA_RECORDS, 1);

// The PR each block cites, read off the artifact. Checked as a SET against the
// numbers #31 fixed, so a case pointing at the wrong PR fails here rather than
// passing a count of three.
const citedPrs = [...method.matchAll(/\sdata-pr="(\d+)"/g)].map((m) => Number(m[1]));
expect('HOW_CITED_PRS', [...citedPrs].sort((a, b) => a - b).join(' '), '18 19 20');

// Every PR link is the URL `publicPrUrl` builds from `site.repo`. This is what
// makes HOW_PR_LINKS more than arithmetic: a literal `https://github.com/...`
// typed into the component would still be three links and would not be these.
const HOW_PR_LINKS = [...method.matchAll(/<a\b[^>]*\shref="([^"]+)"[^>]*\sdata-decision-pr="(\d+)"/g)];
expect('HOW_PR_LINKS', HOW_PR_LINKS.length, 3);
for (const [, href, n] of HOW_PR_LINKS) {
  const expected = publicPrUrl(Number(n));
  if (href !== expected) {
    failures.push(`HOW_PR_LINKS: PR #${n} のリンクが ${href} — 期待は ${expected}`);
  }
}

// ---- HOW_TOP_LINKS ----
const HOW_TOP_LINKS = [...method.matchAll(/\shref="#top"/g)].length;
expect('HOW_TOP_LINKS', HOW_TOP_LINKS, 1);
expect('HOW_TOP_ANCHORS', [...method.matchAll(/\sid="top"/g)].length, 1);
// It is an anchor. The whole point of #31 §9 is that the control works with no
// script, and a `<button>` here would look the same and do nothing.
if (!/<a\b[^>]*\shref="#top"/.test(method)) {
  failures.push('HOW_TOP_LINKS: #top へ送る要素が <a> ではない — JS 無しで動かない');
}
// The existing landmark id is not renamed by the addition.
if (!/<main\b[^>]*\sid="how-i-build"/.test(method)) {
  failures.push('HOW_TOP_LINKS: <main id="how-i-build"> が無い');
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
    `CONTACT_HELPER = ${CONTACT_HELPER} / ` +
    `FEATURED_TIERS = ${featuredBlocks.map((b) => `${b.slug}:${b.tier}`).join(' ')} / ` +
    `FEATURED_SOURCE_LINKS = ${FEATURED_SOURCE_LINKS.length} / ` +
    `SOURCE_WITHHELD = ${SOURCE_WITHHELD} / ` +
    `PUBLIC_CODE_LINKS = ${PUBLIC_CODE_LINKS.length} / ` +
    `WITHHELD_URLS = ${WITHHELD_URLS} / ` +
    `HOW_DECISION_CASES = ${HOW_DECISION_CASES.length} (${HOW_DECISION_CASES.join(' ')}) / ` +
    `HOW_QA_RECORDS = ${HOW_QA_RECORDS} / ` +
    `HOW_PR_LINKS = ${HOW_PR_LINKS.length} / ` +
    `HOW_TOP_LINKS = ${HOW_TOP_LINKS}`,
);

if (failures.length > 0) {
  console.error(`\nSTRUCTURE_CONTRACT = FAIL（${failures.length}）`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}

console.log('STRUCTURE_CONTRACT = PASS');
