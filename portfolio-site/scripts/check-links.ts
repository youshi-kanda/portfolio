/**
 * `node scripts/check-links.ts` — the dead-link and DOM-contract check.
 *
 * Runs over `dist/` after a build. It is deliberately a check of the OUTPUT
 * rather than of the source: the defects it exists to catch — an anchor whose
 * section was dropped as empty, a permalink to a page that was never emitted —
 * are properties of what shipped, and every one of them looks fine in the
 * component that produced it.
 *
 * Exit 0 = no dead internal links, no dead anchors, and every accessibility
 * contract below holds.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const DIST = new URL('../dist/', import.meta.url).pathname;

/**
 * The production origin, read out of the Astro config rather than repeated.
 *
 * This script's job in §2–§4 of the release contract is to prove that every
 * absolute URL in the artifact points at one origin and that the origin is the
 * declared one. Typing the origin here as well would mean the check and the
 * thing being checked share a source, so it would pass on a build that emitted
 * the wrong domain everywhere consistently.
 */
const CONFIG = readFileSync(new URL('../astro.config.mjs', import.meta.url), 'utf8');
const ORIGIN = /\bsite:\s*'([^']+)'/.exec(CONFIG)?.[1];
if (!ORIGIN) {
  console.error('astro.config.mjs から site を読めない — canonical / og:url を検査できない');
  process.exit(1);
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : full.endsWith('.html') ? [full] : [];
  });
}

const pages = walk(DIST);
/** `/work/crm/index.html` → `/work/crm/` — the URL a visitor actually types. */
const route = (file: string): string =>
  `/${relative(DIST, file)}`.replace(/index\.html$/, '').replace(/\/\/+/g, '/');

/**
 * The 404 document. A file in the artifact, but not a URL of this site: nginx
 * serves it under whatever address the visitor typed. Every page contract below
 * still applies to it — one h1, a title, a description, no dead link, no
 * residual `noindex`. Two do not, and both for the same reason:
 *
 *   - it is not in the sitemap, and must not be. A sitemap is a list of URLs
 *     that exist; the error document is the answer given when one does not.
 *   - it declares no canonical and no og:url, because it has no URL to name.
 *     Their ABSENCE is asserted, not tolerated — a canonical that reappears
 *     here would be pointing a crawler at `/404/` as a page worth indexing.
 */
const ERROR_DOCUMENT = '/404.html';

const routes = new Set(pages.map(route));
const failures: string[] = [];
const fail = (page: string, message: string) => failures.push(`${route(page)} — ${message}`);

const attrs = (html: string, re: RegExp): string[] =>
  [...html.matchAll(re)].map((m) => m[1] ?? '');

/** `<meta property="og:title" content="…">` in either attribute order. */
const meta = (html: string, kind: 'name' | 'property', key: string): string | null => {
  const k = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (
    /* content after the key */
    new RegExp(`<meta[^>]*\\s${kind}="${k}"[^>]*\\scontent="([^"]*)"`).exec(html)?.[1] ??
    /* content before it */
    new RegExp(`<meta[^>]*\\scontent="([^"]*)"[^>]*\\s${kind}="${k}"`).exec(html)?.[1] ??
    null
  );
};

/** Every title, so duplicates across routes can be caught (§3). */
const titles = new Map<string, string[]>();

for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  const here = route(page);
  const ids = new Set(attrs(html, /\sid="([^"]+)"/g));
  const hrefs = attrs(html, /<a\b[^>]*\shref="([^"]*)"/g);

  for (const href of hrefs) {
    if (/^(https?:|mailto:|tel:)/.test(href)) continue;

    if (href.startsWith('#')) {
      const id = decodeURIComponent(href.slice(1));
      if (id && !ids.has(id)) fail(page, `dead anchor ${href}`);
      continue;
    }

    const [path, hash] = href.split('#');
    const target = path?.startsWith('/') ? path : new URL(path ?? '', `http://x${here}`).pathname;
    const normalised = target.endsWith('/') ? target : `${target}/`;
    if (!routes.has(normalised) && !routes.has(target)) {
      fail(page, `dead internal link ${href}`);
      continue;
    }
    if (hash) {
      const targetFile = pages.find((p) => route(p) === normalised);
      const targetIds = targetFile
        ? new Set(attrs(readFileSync(targetFile, 'utf8'), /\sid="([^"]+)"/g))
        : new Set<string>();
      if (!targetIds.has(decodeURIComponent(hash))) fail(page, `dead anchor ${href}`);
    }
  }

  // ---- document metadata (IMPLEMENT-03 §3). ----
  //
  // Checked in the output for the same reason the links are: `BaseLayout` looks
  // correct whatever it produces, and the defects that matter here — a canonical
  // on the wrong origin, a description that resolved to an empty string, two
  // routes sharing a title — are only visible once the page is a file.

  const expected = `${ORIGIN}${here}`;
  const isErrorDocument = here === ERROR_DOCUMENT;

  const title = /<title>([\s\S]*?)<\/title>/.exec(html)?.[1]?.trim();
  if (!title) fail(page, 'title が無い、または空');
  else titles.set(title, [...(titles.get(title) ?? []), here]);

  const description = meta(html, 'name', 'description');
  if (!description?.trim()) fail(page, 'meta description が無い、または空');

  if (!/<html[^>]*\slang="ja"/.test(html)) fail(page, 'html lang="ja" が無い');
  if (!meta(html, 'name', 'viewport')) fail(page, 'viewport が無い');
  if (!/<link[^>]*\srel="icon"/.test(html)) fail(page, 'favicon の link が無い');

  const canonical = /<link[^>]*\srel="canonical"[^>]*\shref="([^"]*)"/.exec(html)?.[1];
  if (isErrorDocument) {
    if (canonical !== undefined) {
      fail(page, `error document が canonical ${canonical} を宣言している — URL を持たない文書`);
    }
    if (meta(html, 'property', 'og:url') !== null) fail(page, 'error document に og:url がある');
  } else if (canonical !== expected) {
    fail(page, `canonical が ${canonical} — 期待は ${expected}`);
  }

  // og:image is intentionally absent (BaseLayout says why), so it is not
  // required here — but if one is ever added it has to resolve to a real file
  // in the artifact rather than to a path that only looks right.
  const openGraph = isErrorDocument
    ? []
    : ([
        ['og:type', 'website'],
        ['og:url', expected],
        ['og:title', title],
        ['og:description', description],
      ] as const);
  for (const [key, want] of openGraph) {
    const got = meta(html, 'property', key);
    if (got === null) fail(page, `${key} が無い`);
    else if (!got.trim()) fail(page, `${key} が空`);
    else if (want !== undefined && got !== want) {
      fail(page, `${key} が「${got}」— ページ本体の値「${want}」と一致しない`);
    }
  }

  const ogImage = meta(html, 'property', 'og:image');
  if (ogImage !== null) {
    const path = ogImage.startsWith(ORIGIN) ? ogImage.slice(ORIGIN.length) : ogImage;
    if (!ogImage.startsWith(`${ORIGIN}/`)) fail(page, `og:image が絶対 URL でない: ${ogImage}`);
    else if (!existsSync(join(DIST, path))) fail(page, `og:image の asset が無い: ${path}`);
  }

  // Residual prototype noindex (§4). The prototype screens were never meant to
  // be indexed and a leftover marker would silently unpublish a live route.
  if (/<meta[^>]*\bname="robots"[^>]*\bnoindex/i.test(html) || /\bnoindex\b/i.test(html)) {
    fail(page, 'noindex が残っている');
  }

  // ---- accessibility contract (§17). Structure, not a colour audit. ----

  // exactly one h1, and it is not empty
  const h1 = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)];
  if (h1.length !== 1) fail(page, `h1 が ${h1.length} 個（1 個であること）`);
  if (h1[0] && h1[0][1]!.replace(/<[^>]*>/g, '').trim() === '') fail(page, 'h1 が空');

  // Heading levels never skip: h2 → h4 hides a level from a screen reader.
  //
  // `aria-level` wins over the tag, because it is what the accessibility tree
  // actually exposes. The frozen stylesheet selects on element names (`.dec h5`,
  // `.notclaim h4`), so several headings take a tag for its styling and declare
  // their real depth here — that keeps the rendered page identical to the frozen
  // screens while giving a screen reader the correct outline.
  let previous = 1;
  for (const m of html.matchAll(/<h([1-6])\b([^>]*)>/g)) {
    const declared = /aria-level="(\d)"/.exec(m[2] ?? '');
    const level = Number(declared ? declared[1] : m[1]);
    if (level > previous + 1) fail(page, `見出しが h${previous} → h${level} で飛んでいる`);
    previous = level;
  }

  // ---- aria-current names THIS page, and at most once (#11 §9) ----
  //
  // The defect this replaces was invisible to every other check on this
  // repository: `/work/`, `/work/<slug>/` and `/work/<slug>/technical/` each
  // emitted `aria-current="page"` on a link to `/#work` — three separate pages
  // telling a screen reader they were a fourth. Nothing was broken, nothing was
  // dead, and the statement was simply false.
  //
  // Two rules, and they are different rules. A page has one current position,
  // so more than one marker is a contradiction whatever the markers point at;
  // and a marker ON A LINK is a claim about that link's href, so the href has
  // to be this page. A marker on a non-link (the breadcrumb's last crumb, which
  // is a span precisely because it is not a link to anywhere) makes no claim
  // about a destination and is checked only by the count.
  //
  // Being under something is not being it: an ancestor entry in the nav takes
  // `data-section`, which draws the same underline and asserts nothing.
  const current = [...html.matchAll(/<(\w+)\b([^>]*\baria-current="page"[^>]*)>/g)];
  if (current.length > 1) {
    fail(page, `aria-current="page" が ${current.length} 個（現在地は 1 つであること）`);
  }
  for (const [, tag, tagAttrs] of current) {
    if (tag !== 'a') continue;
    const href = /\shref="([^"]*)"/.exec(tagAttrs ?? '')?.[1];
    if (href !== here) {
      fail(page, `aria-current="page" が ${href} を指している — このページは ${here}`);
    }
  }

  // landmarks
  if (!/<main\b/.test(html)) fail(page, 'main ランドマークが無い');
  if (!/<nav\b|class="nav"/.test(html)) fail(page, 'nav ランドマークが無い');

  // Every image carries alt and intrinsic dimensions (alt="" is a valid
  // decorative declaration; a missing attribute is not a declaration at all).
  //
  // The viewer's <img> has neither src nor size until a screenshot is copied
  // into it on open. Declaring dimensions there would state the wrong ones for
  // every image but the first, and it reserves no layout: it lives inside a
  // closed <dialog>, outside flow, so it cannot shift anything.
  for (const tag of html.match(/<img\b[^>]*>/g) ?? []) {
    if (!/\salt=/.test(tag)) fail(page, `alt の無い img: ${tag.slice(0, 90)}`);
    if (!/\ssrc=/.test(tag)) continue;
    if (!/\swidth=/.test(tag) || !/\sheight=/.test(tag)) {
      fail(page, `width/height の無い img: ${tag.slice(0, 90)}`);
    }
  }

  // a <details> with no <summary> cannot be opened from the keyboard
  const details = (html.match(/<details\b/g) ?? []).length;
  const summary = (html.match(/<summary\b/g) ?? []).length;
  if (details !== summary) fail(page, `details ${details} / summary ${summary} が不一致`);

  // the zoom control must be a real button, not a click-handled div
  if (html.includes('class="shot"') && !/<button[^>]*class="shot"/.test(html)) {
    fail(page, '.shot が button ではない');
  }

  // tables carry a header row
  for (const table of html.match(/<table\b[\s\S]*?<\/table>/g) ?? []) {
    if (!/<th\b/.test(table)) fail(page, 'th の無い table');
  }
}

// ---- one title per route (§3) ----
//
// Case Study and Technical pages for the same work are the pair most likely to
// collide: same work title, different section. Duplicated titles are a real
// defect and not a style note — two results in a list that are indistinguishable
// are two results a reader cannot choose between.
for (const [title, where] of titles) {
  if (where.length > 1) {
    failures.push(`title が重複: 「${title}」 — ${where.sort().join(' ')}`);
  }
}

// ---- sitemap (§4) ----
//
// Set against set, both directions. A listed URL that was never emitted sends a
// crawler to a 404; an emitted page missing from the list is a route the site
// publishes without admitting to. `routes.ts` derives the list and this is what
// proves the derivation still matches what `getStaticPaths` actually built.
//
// The error document is held out of both directions of the comparison, and its
// presence is asserted separately: a build that stops emitting it would
// otherwise pass silently, and the site would be back to nginx's default error
// page without anything saying so.
if (!routes.has(ERROR_DOCUMENT)) {
  failures.push(`${ERROR_DOCUMENT} が dist に無い（src/pages/404.astro）`);
}
const publicRoutes = [...routes].filter((r) => r !== ERROR_DOCUMENT);

const sitemapFile = join(DIST, 'sitemap.xml');
if (!existsSync(sitemapFile)) {
  failures.push('sitemap.xml が dist に無い');
} else {
  const xml = readFileSync(sitemapFile, 'utf8');
  const locs = attrs(xml, /<loc>([^<]*)<\/loc>/g);

  if (locs.length === 0) failures.push('sitemap.xml に <loc> が 1 件も無い');

  const listed = new Set<string>();
  for (const loc of locs) {
    if (!loc.startsWith(`${ORIGIN}/`)) {
      failures.push(`sitemap: 本番 origin でない URL ${loc}`);
      continue;
    }
    if (listed.has(loc)) failures.push(`sitemap: URL が重複 ${loc}`);
    listed.add(loc);
  }

  for (const loc of listed) {
    const path = loc.slice(ORIGIN.length);
    if (path === ERROR_DOCUMENT) {
      failures.push(`sitemap: error document を公開 URL として載せている ${loc}`);
      continue;
    }
    if (!routes.has(path)) failures.push(`sitemap: 出力されていない URL を載せている ${loc}`);
  }
  for (const r of publicRoutes) {
    if (!listed.has(`${ORIGIN}${r}`)) failures.push(`sitemap: 公開 route ${r} が載っていない`);
  }
}

// ---- robots (§4) ----
const robotsFile = join(DIST, 'robots.txt');
if (!existsSync(robotsFile)) {
  failures.push('robots.txt が dist に無い');
} else {
  const robots = readFileSync(robotsFile, 'utf8');
  // `Disallow:` with a value is a rule; with nothing after it, it is the
  // explicit allow-all. Only the first kind can unpublish a route.
  for (const line of robots.split('\n')) {
    const value = /^\s*Disallow:\s*(\S.*)$/i.exec(line)?.[1];
    if (value) failures.push(`robots.txt が公開 route を塞いでいる: Disallow: ${value}`);
    if (/^\s*Noindex:/i.test(line)) failures.push(`robots.txt に Noindex 行がある: ${line.trim()}`);
  }
  const sitemapLine = /^\s*Sitemap:\s*(\S+)\s*$/im.exec(robots)?.[1];
  if (sitemapLine !== `${ORIGIN}/sitemap.xml`) {
    failures.push(`robots.txt の Sitemap 行が ${sitemapLine} — 期待は ${ORIGIN}/sitemap.xml`);
  }
}

console.log(`checked ${pages.length} page(s): ${[...routes].sort().join(' ')}`);
console.log(`public routes: ${publicRoutes.length} / error document: ${ERROR_DOCUMENT}`);
console.log(`origin: ${ORIGIN}`);

if (failures.length > 0) {
  console.error(`\n${failures.length} failure(s):`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log(
  '\nDEAD_LINKS = 0 / DEAD_ANCHORS = 0 / ACCESSIBILITY_CONTRACT = PASS\n' +
    'SEO_METADATA = PASS / CANONICAL_URLS = PASS / SITEMAP = PASS / ROBOTS = PASS / NOINDEX_RESIDUAL = 0\n' +
    'ERROR_DOCUMENT = PASS',
);
