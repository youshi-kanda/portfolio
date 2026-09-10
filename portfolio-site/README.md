# portfolio-site

The production implementation of the portfolio. Static Astro, no server runtime.

Design and content are not decided here. They are decided in `portfolio-planning`
(`portfolio-art-direction.md`, `portfolio-design-freeze.md`,
`portfolio-content-model.md`, `portfolio-positioning.md`) and this repository
implements what those records froze.

---

## Stack

| | |
|---|---|
| Framework | Astro 7 (static output) |
| Language | TypeScript, `strict` |
| Styling | Tailwind CSS v4 via `@tailwindcss/vite`, plus the frozen design system |
| Tests | `node:test` (Node's built-in runner) |
| Runtime | none — the output is HTML, CSS and 521 bytes of JavaScript |

No React, no UI component library, no SSR.

### Why Astro static

Nothing on this site varies per request. The content is a fixed set of works,
and every visitor gets the same page — so there is no request to render on and
no reason to operate a server. Static output means the site is a directory of
files: it can be hosted anywhere, it cannot fall over under load, and there is
no runtime to patch.

React is not installed. The homepage is native HTML, CSS and Astro; the one
piece of behaviour on the page (opening a screenshot at full size) is a native
`<dialog>` driven by 521 bytes of inline script. A React island would be added
only where a genuine client interaction needs one, and none does yet.

### Why Tailwind is here but not doing the layout

Tailwind v4 is wired in as the CSS pipeline, with its theme and utility layers
available. **Preflight is deliberately not imported.** The frozen stylesheet was
authored against browser defaults and does not restate all of them; preflight
would strip default margins on `h4`/`h5`/`ul`/`dl` and silently change a frozen
composition. The prototype shipped no reset either, so omitting it is what
preserves parity.

The four widths and four section densities are exposed through `@theme`. The
colour palette is not, and that is a decision rather than an omission: its whole
design is scope-swapping (`[data-t="dark"]`, `.inv`, per-work pigment) and
`@theme` emits a single `:root` set, which cannot express that.

---

## Directory responsibilities

```
src/
  components/
    layout/       page furniture — rail, section head, synthetic bar, footer
    navigation/   the sticky nav and the mobile bottom bar
    work/         work entries, the three layout variants, the register
    evidence/     the Evidence component and its full-size viewer
    home/         one component per homepage section (00 … 06)
  content/        the content itself — work/, evidence/, copy/, site.json
  layouts/        the page shell
  lib/
    content/      schemas, loaders, derivation, the approval snapshot
    validation/   the gates: truth policy, approved copy, entry variants
  pages/          routes: /, /work/, /work/<slug>/, /work/<slug>/technical/
                  plus the generated sitemap.xml and robots.txt
  styles/         the frozen design system, split by responsibility
scripts/          validate:content, check-links, check-structure
tests/            unit tests for the gates and the derivation
```

`src/styles/` is generated from the frozen prototype stylesheet and split by
responsibility: `tokens` (colour, faces), `base` (element defaults, type scale),
`layout` (the four widths, the four densities), `components`, `evidence` (kept
separate because the freeze forbids the art direction from reaching inside it),
`responsive` (the breakpoints). **Do not restyle in these files.** A visual
change needs the freeze reopened — see `portfolio-art-direction.md` §14.

---

## Content model

Three collections plus one singleton.

| | what it holds |
|---|---|
| `work` | one file per work. `src/content/work/<slug>.json` |
| `evidence` | Evidence records, with their own provenance and review state |
| `copy` | the approval registry for authored site copy |
| `site.json` | singleton section content (workflow, stack rows, principles) |

Adding a work is adding one file to `src/content/work/`. No component changes at
0, 1, 3 or 20 works.

A work declares three groups of fields, kept deliberately apart:

- **what it is** — `productType`, `targetUser`, `problem`, `purpose`
- **what was built** — `implementationScope`, `publicDemoScope`, `limitations`,
  `originalProductScope`, `languages`, `frameworks`
- **how it is presented** — `visual.{entryVariant, caseVariant, signal, frame,
  ground, texture, displayCut}`

`keyDecision` says what was interesting to build. It is never used as the
product description, and it renders in its own block.

Every record also carries `publication`: `reviewStatus`, `sourceType`,
`sourceRefs`, `approvedBy`, `approvedAt`.

| `sourceType` | meaning | how it gets approved |
|---|---|---|
| `source-derived` | a transcription with a cited locator | by comparison against the cited source; there is no approver name to record, so `approvedBy`/`approvedAt` stay null and `sourceRefs` must be non-empty |
| `authored` | written for this site | only a person can approve it; `approvedBy` and `approvedAt` are required |
| `user-fact` | only the subject knows it | the fact has to be provided; it is never filled in with a placeholder |

---

## Truth Gate

Structural and semantic validation are separate on purpose.

- **Schema** (`lib/content/schema.ts`) asks *is this field a string?*
- **Truth policy** (`lib/validation/`) asks *is this claim allowed to be
  published, given where it came from?*

The gate runs at `astro:build:start` — before any page is rendered, so a failure
means nothing was written to `dist/`. There is no `--force`.

| code | fails when |
|---|---|
| `T-UNAPPROVED` | a shipping item is not `approved` |
| `T-NO-SOURCE` | `source-derived` with no `sourceRefs` |
| `T-EMPTY-FACT` | `user-fact` with an empty value |
| `T-NO-APPROVER` | authored copy approved with no approver or date |
| `T-DEAD-REF` | a work points at an Evidence id that does not exist |
| `A-CHANGED` | an approved string no longer matches the frozen snapshot |
| `A-MISSING` / `A-UNKNOWN` | the registry and the snapshot disagree |
| `A-DERIVED` | a computed string no longer renders to its approved form |
| `E-UNKNOWN` | an entry variant with no renderer |
| `E-MONOTONY` | fewer distinct variants than the list length requires |
| `E-RUN` | three or more consecutive works share a variant |
| `W-ADJACENT` | *warning only* — two neighbours share a variant |

In development every truth-policy error is reported as a warning instead, so
pending content can be seen on the page. Approved-copy drift is an error in
both: a string that no longer matches its own approval is a broken record, not
unfinished work.

### Approved copy is immutable

`lib/content/approved-text.ts` holds a frozen snapshot of the twelve strings
approved on 2026-08-28. The gate compares the registry against it on every
production build. An approval covers the sentence that was read, not the slot it
sat in, so rewording an approved string fails the build and prints the content
id, the approved text and the current text. Changing one means recording a new
approval, deliberately.

### UI chrome is registered too

UI chrome — column headings, button labels, table headers — lives in
`lib/content/ui.ts`, and every string in it has a row in
`src/content/copy/ui.json` carrying its classification, its slot and the
`file:line` it was transcribed from. `uiCopyGate` walks the object on each build
and fails on a string with no row (`U-UNMANAGED`), a row pointing at a path that
no longer exists (`U-ORPHAN`), or the two texts having drifted apart
(`U-DRIFT`).

That closes the gap `portfolio-content-model.md` §4 records: the prototype's
pending marker only ever covered registered slots, so the renderer-embedded
strings shipped without one. Counting them would not have fixed it — making
absence fail the build is what keeps `UNMANAGED_SHIPPING_COPY` at zero.

---

## Images

The three screenshots in `public/img/` are byte-identical copies of the audited
derivatives in `portfolio-planning`. They are served as-is rather than passed
through `astro:assets`: provenance is a first-class concern here (PUBLISH-MAP,
SHA256, 等倍), and re-encoding would produce another derivative that no record
describes.

---

## Development

```bash
npm run qa                # the release gate: all six, in order
npm run dev               # dev server
npm run build             # production build — runs the Truth Gate first
npm run preview           # serve the build
npm run check             # astro check (TypeScript + Astro diagnostics)
npm run validate:content  # the Truth Gate on its own
npm test                  # unit tests
npm run check:links       # checks dist/ — must run after a build
npm run check:structure   # the rendering contract — also reads dist/
```

`check:links` reads the built artifact rather than the source, because the
defects it exists to catch are properties of what shipped and every one of them
looks fine in the component that produced it: an anchor whose section was
dropped as empty, a permalink to a page never emitted, a canonical on the wrong
origin, two routes sharing a `<title>`, a sitemap listing a URL that does not
exist or omitting one that does, a `robots.txt` that blocks a published route, a
residual prototype `noindex`. It also holds the accessibility contract —
exactly one non-empty `h1`, no skipped heading levels (reading `aria-level`,
which is what the accessibility tree exposes), landmarks, `alt` and intrinsic
dimensions on every image, `<details>`/`<summary>` pairing, header rows on
tables. `npm run qa` runs it after `build`.

`check:structure` is the other half of that, kept apart on purpose: it holds
invariants about the SHAPE of what shipped, and a row count is not a link. A
link checker that also enforced DOM contracts would have a name that disagrees
with what it does. It currently pins the hero capability rail at three rows
(V4's three capability axes — so a copy migration has to hand over three rows in
the same commit, never passing through a two-row state), the display at its
three authored lines, and the homepage and the register at the same set of
works.

`scan:public` reads what this repository publishes — every tracked file, and
everything the build emits — for secrets, credentials, absolute paths from the
machine it was built on, and service identifiers. It is generic on purpose:
every rule in it is a defect in ANY public repository, which is what makes the
rules safe to state in one. The allowances are listed with their reasons beside
them, so an allowance is a decision someone can read rather than a rule quietly
weakened.

What it deliberately does NOT hold is the other half: the customer names,
private repository names and internal identifiers of a private engagement.
Those cannot be checked from a public repository — not as plaintext and not as
hashes, since a hash of a short identifier is a dictionary away from the
identifier. They live in `review-private/` (gitignored) and are read only by
`scan:local`, on a machine that has them. CI runs `scan:public` and can prove
what a public artifact does not contain; it cannot prove anything about a
private repository, and does not claim to.

**Prose in a tracked file can change the shipped stylesheet.** Tailwind scans
every tracked file for class-name candidates, not just the templates, so an
English word in a comment or a test name that happens to be a utility name adds
that utility to `BaseLayout.<hash>.css` — which changes the hash, which changes
every page that links it. It was found the way it is meant to be found: the
byte comparison against the previous phase's `dist/` failed, on a build whose
only change was a sentence. Narrowing the scan with an explicit `@source` would
fix it properly, and would itself change the stylesheet, so it is a decision to
take on its own rather than a side effect of a phase that has to hold the
output still.

`validate:content` takes `--dev` (report pending instead of failing) and
`--strict` (promote `W-ADJACENT` to an error — an authoring review pass, never
the production build).

There is no separate linter. `astro check` runs the TypeScript compiler over
`.astro`, `.ts` and the content schemas with `strict` plus
`noUncheckedIndexedAccess`, which is what a lint step would mostly be checking
for; adding ESLint would mean a dependency tree and a config to maintain for
rules the compiler already enforces.

---

## Deployment model

`npm run build` writes `dist/` — static HTML, one CSS file, no JavaScript
bundle. It can be served by any static host or CDN. There is no Node process in
production, no database, and no environment configuration.

`trailingSlash: 'always'`, so `/work/` and `/work/crm/` are the canonical forms.

The public origin is declared once, as `site` in `astro.config.mjs`. Every
absolute URL in the artifact is derived from it — the canonical link, `og:url`,
`sitemap.xml`, and the `Sitemap:` line in `robots.txt` — and `check-links` reads
the value back out of the config to verify that nothing in `dist/` points
somewhere else. Moving the site is a one-line change.

`/sitemap.xml` and `/robots.txt` are generated routes
(`src/pages/sitemap.xml.ts`, `src/pages/robots.txt.ts`) rather than files in
`public/`, so the origin is not written down a second time.

**The deploy procedure is [`DEPLOY.md`](DEPLOY.md)** — build gate, backup, copy,
permissions, nginx test, HTTP/HTTPS/route smoke, rollback.

---

## Status

Implemented: the homepage (00 HERO through 07 CONTACT), the work register at
`/work/`, the Case Study at `/work/<slug>/` (CS-1 … CS-16) and the Technical
page at `/work/<slug>/technical/` (T-0 … T-8). Eight routes.

Profile facts (経歴・稼働条件・料金・連絡先) have not been provided, and the
site does not mention them. 06 ABOUT lists only rows carrying a `sourceRef`, and
07 CONTACT lists only links this repository confirms. Nothing is shown as
未記入 or 未定義: on a public page those read as the site describing what it
lacks, and no source backs them either way. Facts that arrive later get a row
with its locator filled in, which is the only way anything gets one.
`PROFILE_INVENTED = NO`.

Also emitted: `404.html`. Not a ninth route — it is the document nginx serves
for an address this site does not have, so it is deliberately absent from the
sitemap and declares no canonical and no `og:url`, having no URL of its own to
name. `check-links` knows it by name, asserts it is in the artifact, and holds
it to every other page contract. `DEPLOY.md` §4 has the `error_page` line that
puts it to use.
