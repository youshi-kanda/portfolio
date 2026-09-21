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
 *   HOW_PREMISES          #31 — 開発の前提 draws one item per id the section
 *                         content lists, and every one of them is the APPROVED
 *                         sentence that id names. Counted against site.json
 *                         rather than against a literal: the count is content,
 *                         and what #31 fixed was that these sentences had no
 *                         approval record, not that there are two of them.
 *   HOW_OUTLINE           the document outline this page ships, as levels.
 *                         `h1 → h2 開発の前提 → h2 判断事例 → h3 h3 h3` is a
 *                         decision (#31), not an accident of which component
 *                         happens to render first: a decision case that drifts
 *                         back under 開発の前提 reads as a thing this site is
 *                         not claiming, which is the opposite of what it is.
 *   RETIRED_PUBLIC_COPY   zero. Copy the owner has replaced may not still be on
 *                         a page. A replaced string is not caught by any other
 *                         gate here — it is valid, it was once approved, and
 *                         every count still adds up with it present.
 *   ABOUT_RETIRED_COPY    the #32 half of the same list, counted on its own so
 *                         the contract Issue #32 asked for has a name: the
 *                         three sentences ABOUT used to end on may not be
 *                         anywhere on a public page — plus the one sentence
 *                         this branch approved and then narrowed, which is the
 *                         only retired string here that never shipped.
 *   ABOUT_EXPERIENCE      #32 — 06 ABOUT draws one profile-fact block per entry
 *                         the section content declares, each carrying the
 *                         APPROVED label and body its ids name. Derived from
 *                         `site.about.profile`, so the count is content; what
 *                         is held against a literal is only the editorial
 *                         decision itself (one 業務経験 block, two disclosure
 *                         rows), for the reason HOW_DECISION_CASES states.
 *   ABOUT_DISCLOSURE_ROWS #32 — the compliance block, on the same terms. TWO,
 *                         inside ONE container: 掲載内容について and 公開データ
 *                         are read together, and a third row appearing here is
 *                         ABOUT drifting back toward a column of caveats.
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
 *   CASE_QUICK_SUMMARIES  #33 — every published Case Study opens with the 3分概要
 *                         block, and the expected number is the number of
 *                         published Case Studies, computed from the work
 *                         records. A ledger saying "three" would be the same
 *                         editorial fact written twice.
 *   CASE_QUICK_ITEMS      the item keys and their visible labels, in artifact
 *                         order, IDENTICAL across the three. The whole promise
 *                         of the block is that a reader can compare works, and
 *                         a component that grew one slug-shaped branch would
 *                         still render, still count right, and quietly stop
 *                         being comparable.
 *   CASE_QUICK_INTERNAL_STATUS
 *                         zero. `public-demo` / `implemented` / `poc` are
 *                         internal enum members; a reader sees the display word
 *                         or the build stops. This is PUBLIC_INTERNAL's rule
 *                         aimed at the one field #33 newly publishes.
 *   CASE_QUICK_DEAD_ANCHORS
 *                         zero. Every in-page href the block emits resolves to
 *                         an id in the same document. The 詳しく見る rows are
 *                         built from `caseSections`, so a dead one means the
 *                         section list and the page disagree.
 *   CASE_QUICK_ORDER      DFE's `leadDisclosure` appears before the summary.
 *                         Order is the whole content of that rule: 「この作品は
 *                         OCR を実行していない」 after 実装したもの is a
 *                         correction arriving after the belief it corrects.
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
import { loadCaseStudies, loadCopy, loadUiCopy, loadWorks } from '../src/lib/content/load.ts';
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

// ---- RETIRED_PUBLIC_COPY ----
// Public copy the owner has REPLACED. Held as literals because that is what
// they are — the exact sentences that were on the page before the decision
// that removed them — and because nothing else here would notice: a retired
// string is well-formed, was approved once, and leaves every count correct.
//
// #31 replaced the 「主張しないこと」 block. The heading and its two refusals
// were the whole of it, and the boundary they drew is not gone — it is stated
// by `method.premise.02` instead. What may not survive is the old wording
// sitting somewhere this pass did not look.
//
// #32 retired ABOUT's three closing rows. Only the SENTENCES are listed, not
// their labels: 実装形態 is also `ui.technical.aboutFields.role` and still ships
// on every Technical page, and 「データ」 is a substring of half the synthetic
// data copy on the site — a literal that matches a string which is still
// correct somewhere else does not check retirement, it just fails.
//
// The boundary those three drew is not gone either. `home.about.disclosure`
// states the publication scope and `home.about.syntheticData` states the
// synthetic data; what is retired is the wording, including the claim that the
// whole portfolio is 個人開発, which #29 established it is not.
// #44 retired the HERO display's second line and the lede. Only TWO of the
// three reworded strings are listed, and the omission is the point.
//
// 旧 `home.hero.display.01` は「業務課題を、」——6 文字で、述語も無い。これを
// `includes` に入れると、当たるかどうかがこの 6 文字の並びだけで決まる断片検査に
// なる。同じ語はいま公開面に別の意味で実在していて（`想定業務課題` の節見出し、
// CONTACT の「業務課題の整理から、」）、どちらも退役とは無関係に正しい文である。
// 今日は「業務課題を、」という並びには当たらないが、当たらない理由が読点の位置
// だけというのは検査ではなく偶然である。
//
// 代わりに display の相方で見る。この 2 行は 1 つの display として一緒に出ていた
// ものなので、旧 display が戻ってくれば 2 行目が必ず一緒に戻る。長くて一意な側で
// 組を検出できるなら、短い側を断片で見る理由は無い。
//
// なお 3 件とも id は registry に残っていて、`approvedCopyGate` の `A-CHANGED`
// が snapshot との不一致を先に捕まえる。ここが足すのはその外側——snapshot ごと
// 巻き戻された場合と、承認registryを経由せずに文字列が公開面へ現れた場合だけで
// ある。#31 / #32 の行が site.json の節内容（registry の外）だったのとは違い、
// これは二重化であって唯一の防波堤ではない。
const RETIRED_PUBLIC_COPY: readonly {
  text: string;
  why: string;
  issue: '#31' | '#32' | '#44';
}[] = [
  { text: '主張しないこと', why: '#31 — 見出しは 開発の前提 に置き換わった', issue: '#31' },
  {
    text: '完全自動の Multi-Agent 開発をしているとは主張しない。',
    why: '#31 — method.premise.02 が同じ境界を述べている',
    issue: '#31',
  },
  {
    text: 'Harness を構築済みであるとは主張しない。',
    why: '#31 — 同上',
    issue: '#31',
  },
  {
    text: '個人開発。AI CRM Demo は画面・API・データベース・AI 呼び出し・権限・テストまで 1 人で実装している。',
    why: '#32 — Portfolio 全体を個人開発と言う行。#29 が共同プロジェクトを記録した時点で成り立たない',
    issue: '#32',
  },
  {
    text: '私的に開発中のプロダクトから公開可能な範囲を切り出したもの。外部配信・代理店管理・本番インフラは含めていない。',
    why: '#32 — home.about.disclosure が公開範囲を述べている',
    issue: '#32',
  },
  {
    text: '掲載している画面はすべて合成データ。実顧客・実案件・本番運用の記録ではない。',
    why: '#32 — home.about.syntheticData が同じ表明を持っている',
    issue: '#32',
  },
  /*
   * この 1 件だけ性格が違う: この BRANCH が承認して書いた文で、同じ PR の
   * レビュー中に本人が短くしたものである（Issue #32 comment 5749023659）。
   * 落ちたのは 2 文目「担当範囲と到達状態は作品ごとに記載しています。」で、
   * 到達状態はどの公開ページにも出ていなかった。
   *
   * 現在の文は旧文の PREFIX なので、`includes` は正しい向きにしか当たらない
   * ——新しい文だけが出ていれば旧文は含まれず、旧文が戻ってくれば当たる。
   */
  {
    text: '担当範囲と到達状態は作品ごとに記載しています。',
    why: '#32 — 到達状態は公開面に出ていない。Issue #32 comment 5749023659 で削除',
    issue: '#32',
  },
  /*
   * #44 の 2 件。退役の理由が #31 / #32 とは違う——これらは事実として誤りに
   * なったのではなく、書き直されただけである。#6 §4.1 が「業務で使える」を
   * 選んだ判断（稼働実績ではなく適合の主張に留める）は今も有効で、新しい
   * 「現場で使える仕組みをつくる。」も同じ境界の内側にいる。
   *
   * それでも公開面から締め出すのは、旧文と新文が同時に出ている状態が
   * 「どちらが現在の HERO か」を読者に対して曖昧にするからである。
   */
  {
    text: '業務で使える Web・AI システムへ。',
    why: '#44 — 旧 display 2 行目。home.hero.display.02 が 現場で使える仕組みをつくる。 に置き換わった',
    issue: '#44',
  },
  {
    text: '業務フローを整理し、画面・API・データ・AI・自動処理へ落とし込み、実際に運用できる仕組みとして設計・実装します。',
    why: '#44 — 旧 lede。home.hero.lede が Webシステム・AI・業務自動化を、要件整理から設計・実装まで。 に置き換わった',
    issue: '#44',
  },
];
let RETIRED_COPY_HITS = 0;
let ABOUT_RETIRED_COPY = 0;
for (const route of PUBLIC_ROUTES) {
  const html = read(route);
  for (const retired of RETIRED_PUBLIC_COPY) {
    if (html.includes(retired.text)) {
      RETIRED_COPY_HITS += 1;
      if (retired.issue === '#32') ABOUT_RETIRED_COPY += 1;
      failures.push(
        `RETIRED_PUBLIC_COPY: /${route.replace(/index\.html$/, '')} に「${retired.text}」が残っている — ${retired.why}`,
      );
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

// ---- ABOUT_EXPERIENCE / ABOUT_DISCLOSURE_ROWS ----
// #32. 06 ABOUT reads 現在の開発姿勢 → 業務経験 → 公開境界, and each block is
// drawn from registry ids rather than from a sentence in the section content.
// So there are two ways this can break that no count alone would see: a block
// could render the right NUMBER of rows from text nobody approved, and the
// visual order could disagree with the DOM order. The first is checked by
// holding every rendered label and body against the registry row its id names;
// the second cannot be checked here at all and is a viewport check — what IS
// checked is that the DOM has label before body, and 業務経験 before the
// disclosure block.
const aboutAt = home.indexOf('id="about"');
const aboutHtml = aboutAt < 0 ? '' : home.slice(aboutAt, home.indexOf('</section>', aboutAt));
if (aboutHtml === '') failures.push('ABOUT: 06 ABOUT の section が artifact に無い');

const strip = (html: string): string => html.replace(/<[^>]*>/g, '').trim();

/** The rows one ABOUT block rendered, in artifact order, label and body apart. */
const aboutRows = (attr: string): { id: string; label: string; body: string }[] =>
  [
    ...aboutHtml.matchAll(
      new RegExp(`<div class="r"[^>]*\\s${attr}="([^"]+)"[^>]*>([\\s\\S]*?)</div>`, 'g'),
    ),
  ].map((m) => {
    const inner = m[2] as string;
    return {
      id: m[1] as string,
      label: strip(/<span class="k">([\s\S]*?)<\/span>/.exec(inner)?.[1] ?? ''),
      body: strip(/<span class="v">([\s\S]*?)<\/span>/.exec(inner)?.[1] ?? ''),
    };
  });

const aboutCopy = loadCopy();
const aboutUiCopy = loadUiCopy();
/** What the section content says a block must render — resolved the same way. */
const aboutExpected = (
  blocks: readonly { id: string; labelId: string; copyId: string }[],
): { id: string; label: string; body: string }[] =>
  blocks.map((b) => ({
    id: b.id,
    label: aboutUiCopy.find((r) => r.id === b.labelId)?.text ?? `(ui registry に ${b.labelId} が無い)`,
    body: aboutCopy.find((r) => r.id === b.copyId)?.text ?? `(registry に ${b.copyId} が無い)`,
  }));

const renderedFacts = aboutRows('data-about-fact');
const renderedDisclosure = aboutRows('data-about-disclosure');
const ABOUT_EXPERIENCE = renderedFacts.length;
const ABOUT_DISCLOSURE_ROWS = renderedDisclosure.length;

expect('ABOUT_EXPERIENCE', ABOUT_EXPERIENCE, site.about.profile.length);
expect('ABOUT_DISCLOSURE_ROWS', ABOUT_DISCLOSURE_ROWS, site.about.disclosure.length);
expect(
  'ABOUT_EXPERIENCE_TEXT',
  JSON.stringify(renderedFacts),
  JSON.stringify(aboutExpected(site.about.profile)),
);
expect(
  'ABOUT_DISCLOSURE_TEXT',
  JSON.stringify(renderedDisclosure),
  JSON.stringify(aboutExpected(site.about.disclosure)),
);

// THE ONE LITERAL PAIR HERE, and it is the editorial decision rather than a
// count. Issue #32 §6 fixes the shape: ONE 業務経験 block, and TWO rows inside
// ONE compact disclosure container. The checks above prove the page renders
// what the content declares; these prove the content still declares what was
// decided — without them the file could say "four disclosure rows" and every
// assertion above would pass on a section that had drifted back into a column
// of caveats.
expect('ABOUT_PROFILE_DECLARED', site.about.profile.length, 1);
expect('ABOUT_DISCLOSURE_DECLARED', site.about.disclosure.length, 2);

// One container, not two. The disclosure rows are read together, so a second
// `.ab-disc` block would be the compression #32 asked for coming undone.
expect('ABOUT_DISCLOSURE_BLOCKS', [...aboutHtml.matchAll(/class="spx wide ab-disc"/g)].length, 1);

// Reading order, as the DOM has it: the profile fact comes before the
// disclosure block, and inside every row the label comes before the body. The
// visual order is not reordered in CSS — `.spx.wide .r` is a single-column grid
// in source order at every width — so DOM order is reading order.
if (aboutHtml.indexOf('data-about-fact') > aboutHtml.indexOf('data-about-disclosure')) {
  failures.push('ABOUT_ORDER: 業務経験 が公開境界ブロックより後に出ている');
}
if (aboutHtml.indexOf('class="ab-now"') > aboutHtml.indexOf('data-about-fact')) {
  failures.push('ABOUT_ORDER: about.now が業務経験より後に出ている');
}

// #32 — 業務経験 is a profile fact and is not drawn as a warning. `--stop` is
// the site's alert pigment; ABOUT may not reach for it, and a large card or
// banner class appearing in this section is the same regression in another
// spelling.
for (const forbidden of ['--stop', 'var(--stop)', 'class="alert', 'class="banner']) {
  if (aboutHtml.includes(forbidden)) {
    failures.push(`ABOUT_TONE: 06 ABOUT に ${forbidden} がある — 業務経験は警告ではない`);
  }
}

// 年数表現。HD-C の決定は「ABOUT に年数を出さない」であって、書き方を変えれば
// 通るものではない。数字 + 年 / ヶ月 の形を節ごと見る。
for (const m of aboutHtml.matchAll(/(?<![0-9A-Za-z_])(約\s*)?\d+\s*(年間|年|ヶ月|か月)/g)) {
  failures.push(`ABOUT_NO_TENURE: 06 ABOUT に年数表現「${m[0]}」がある（HD-C）`);
}

// ---- HOW_DECISION_CASES / HOW_QA_RECORDS / HOW_PR_LINKS / HOW_TOP_LINKS ----
// #31. The one place in this file that asserts literals — the header says why.
const method = read('how-i-build/index.html');

// ---- HOW_PREMISES ----
// 開発の前提. Derived from the content, and then each rendered item is held
// against the APPROVED sentence its id names — a block that rendered the right
// NUMBER of premises from somewhere other than the approval registry is the
// failure #31 exists to prevent.
const HOW_PREMISES = [...method.matchAll(/<li data-premise>([\s\S]*?)<\/li>/g)].map(
  (m) => (m[1] as string).replace(/<[^>]*>/g, '').trim(),
);
const premiseCopy = loadCopy();
const premiseText = site.howIBuild.premises.map(
  (id) => premiseCopy.find((c) => c.id === id)?.text ?? `(registry に ${id} が無い)`,
);
expect('HOW_PREMISES', HOW_PREMISES.length, site.howIBuild.premises.length);
expect('HOW_PREMISES_TEXT', HOW_PREMISES.join(' | '), premiseText.join(' | '));

// ---- HOW_OUTLINE ----
// `aria-level` wins over the tag, exactly as check-links reads it: what is
// under contract is the outline a screen reader is given, not the spelling of
// the element. Both are true here — every heading below is its own tag — and
// reading it this way keeps the two checks from disagreeing about what h-level
// means.
const HOW_OUTLINE = [...method.matchAll(/<h([1-6])\b([^>]*)>/g)].map(([, tag, attrs]) => {
  const declared = /aria-level="(\d)"/.exec(attrs ?? '');
  return Number(declared ? declared[1] : tag);
});
expect('HOW_OUTLINE', HOW_OUTLINE.join(' '), '1 2 2 3 3 3');
// The two h2s are the ones #31 named, and they are `<h2>` elements rather than
// a smaller tag declaring its depth. The section is named once: `aria-label`
// repeating a heading is the double announcement the decision ruled out.
for (const heading of ['開発の前提', '判断事例']) {
  if (!new RegExp(`<h2\\b[^>]*>(?:<[^>]*>)*${heading}`).test(method)) {
    failures.push(`HOW_OUTLINE: 「${heading}」が <h2> として出ていない`);
  }
}
if (/\saria-label="判断事例"/.test(method)) {
  failures.push('HOW_OUTLINE: 判断事例 が aria-label と heading の両方で読み上げられる');
}

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

// ---- CASE_QUICK_SUMMARIES / CASE_QUICK_ITEMS / CASE_QUICK_INTERNAL_STATUS ----
// #33. The 3分概要 block, checked on the artifact because every one of these
// properties looks correct in the component that produced it: one component
// renders all three, so "does it render" is answered once and says nothing
// about whether the three pages ended up comparable.
const caseRoutes = shipping
  .filter((w) => w.caseStudyPublished)
  .map((w) => ({ slug: w.slug, route: `work/${w.slug}/index.html` }));

/** The quick-summary block of one Case Study, or '' when the page has none. */
const quickBlock = (html: string): string => {
  const at = html.indexOf('id="cs-quick"');
  if (at < 0) return '';
  const from = html.lastIndexOf('<section', at);
  return html.slice(from, html.indexOf('</section>', at));
};

const stripTags = (html: string): string => html.replace(/<[^>]*>/g, '').trim();

let CASE_QUICK_SUMMARIES = 0;
let CASE_QUICK_INTERNAL_STATUS = 0;
let CASE_QUICK_DEAD_ANCHORS = 0;
const quickItemLists: { slug: string; items: string }[] = [];

for (const { slug, route } of caseRoutes) {
  const html = read(route);
  const block = quickBlock(html);
  if (block === '') {
    failures.push(`CASE_QUICK_SUMMARIES: /work/${slug}/ に 3分概要 が無い`);
    continue;
  }
  CASE_QUICK_SUMMARIES += 1;

  // The block names itself with a real h2, and the section points at it.
  if (!/<h2\b[^>]*\sid="cs-quick-h"/.test(block)) {
    failures.push(`CASE_QUICK_ITEMS: /work/${slug}/ の 3分概要 が <h2 id="cs-quick-h"> を持たない`);
  }
  if (!/\saria-labelledby="cs-quick-h"/.test(block)) {
    failures.push(`CASE_QUICK_ITEMS: /work/${slug}/ の 3分概要 section が h2 を参照していない`);
  }

  // Item keys AND their visible labels, in artifact order. Reading both in one
  // pass is what keeps a page from having the right keys under the wrong names.
  const items = [
    ...block.matchAll(/<div class="r"\s+data-quick-item="([^"]+)">([\s\S]*?)<div class="v">/g),
  ].map((m) => `${m[1]}=${stripTags(m[2] as string)}`);
  quickItemLists.push({ slug, items: items.join(' | ') });

  // Internal enum members, inside this block only. The scope table elsewhere on
  // the page legitimately prints the column head `Implemented`, which is not
  // this — so the scan is the block, and the match is the enum spelling.
  for (const member of ['public-demo', 'implemented', 'poc']) {
    const hit = new RegExp(`(?<![A-Za-z0-9-])${member}(?![A-Za-z0-9-])`).test(stripTags(block));
    if (hit) {
      CASE_QUICK_INTERNAL_STATUS += 1;
      failures.push(
        `CASE_QUICK_INTERNAL_STATUS: /work/${slug}/ の 3分概要に内部 enum ${member} が出ている`,
      );
    }
  }

  // Every in-page link the block emits lands on an id this document has.
  for (const m of block.matchAll(/href="#([^"]+)"/g)) {
    const id = m[1] as string;
    if (!new RegExp(`\\sid="${id}"`).test(html)) {
      CASE_QUICK_DEAD_ANCHORS += 1;
      failures.push(`CASE_QUICK_DEAD_ANCHORS: /work/${slug}/ の 3分概要 が #${id} を指すが無い`);
    }
  }
}

expect('CASE_QUICK_SUMMARIES', CASE_QUICK_SUMMARIES, caseRoutes.length);

// SAME ITEMS, SAME ORDER, SAME LABELS — the comparability contract. Compared
// against each other rather than against a literal list: the item set is an
// editorial decision recorded in the component, and a list here would be that
// decision written a second time, in the file least likely to be reread.
const distinctItemLists = new Set(quickItemLists.map((q) => q.items));
if (distinctItemLists.size > 1) {
  failures.push(
    `CASE_QUICK_ITEMS: 3分概要の項目が Case Study 間で揃っていない\n` +
      quickItemLists.map((q) => `      ${q.slug}: ${q.items}`).join('\n'),
  );
}

// ---- CASE_QUICK_ORDER ----
// The disclosure comes first where there is one. Derived from the content, so
// the check follows `leadDisclosure` rather than naming the work that has one.
const caseStudyBySlug = new Map(loadCaseStudies().map((c) => [c.slug, c]));
for (const { slug, route } of caseRoutes) {
  const disclosure = caseStudyBySlug.get(slug)?.leadDisclosure;
  if (!disclosure) continue;
  const html = read(route);
  const at = html.indexOf(disclosure);
  const quickAt = html.indexOf('id="cs-quick"');
  if (at < 0) {
    failures.push(`CASE_QUICK_ORDER: /work/${slug}/ に leadDisclosure が出ていない`);
    continue;
  }
  if (quickAt >= 0 && at > quickAt) {
    failures.push(
      `CASE_QUICK_ORDER: /work/${slug}/ の leadDisclosure が 3分概要より後にある — ` +
        `訂正は誤解のあとに届いても遅い`,
    );
  }
}

// ---- SECTION_MOTIFS ----
// #46 — the five chapter marks, and the fact that they are decoration.
//
// Three properties, and the count is the least interesting of them:
//
//   one per section, five in all. The layer's whole job is to make a boundary
//   legible, so a section that lost its motif is a boundary that stopped being
//   one — and a section that gained a second is two drawings pinned in the
//   same place.
//   `aria-hidden` on every one. A background graphic that reaches the
//   accessibility tree is a page reading its own wallpaper aloud.
//   no text inside any of them, ever. This is the rule that matters: the
//   moment a motif carries a word, the page says something only sighted
//   readers with CSS get, and this whole layer stops being deletable. Checked
//   against the artifact, because a component cannot see what it renders.
//
// Homepage only. The five are the homepage's own sections; a motif on a work
// page would be this layer leaking into a composition that never asked for it.
const MOTIF_SECTIONS = ['work', 'more', 'capabilities', 'about', 'contact'] as const;
const motifs = [...home.matchAll(/<div class="smo" data-smo="([a-z]+)"([^>]*)>([\s\S]*?)<\/svg>/g)];
const SECTION_MOTIFS = motifs.length;
expect('SECTION_MOTIFS', SECTION_MOTIFS, MOTIF_SECTIONS.length);
for (const section of MOTIF_SECTIONS) {
  const n = motifs.filter((m) => m[1] === section).length;
  if (n !== 1) failures.push(`SECTION_MOTIFS: #${section} の背景モチーフが ${n} 個 — 各セクション 1 個`);
}
for (const [, name, attrs = '', body = ''] of motifs) {
  if (!attrs.includes('aria-hidden="true"')) {
    failures.push(`SECTION_MOTIFS: ${name} のモチーフに aria-hidden が無い — 装飾が読み上げられる`);
  }
  const text = body.replace(/<[^>]*>/g, '').replace(/\s+/g, '');
  if (text !== '') {
    failures.push(`SECTION_MOTIFS: ${name} のモチーフが文字を持っている（${text.slice(0, 40)}）— 装飾に意味を載せない`);
  }
}
let MOTIFS_OFF_HOME = 0;
for (const route of PUBLIC_ROUTES.filter((r) => r !== 'index.html')) {
  const n = [...read(route).matchAll(/<div class="smo"/g)].length;
  if (n > 0) {
    MOTIFS_OFF_HOME += n;
    failures.push(`SECTION_MOTIFS: /${route.replace(/index\.html$/, '')} に背景モチーフが ${n} 個 — HOME 専用の層`);
  }
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
    `SECTION_MOTIFS = ${SECTION_MOTIFS} (off-home ${MOTIFS_OFF_HOME}) / ` +
    `CASE_QUICK_SUMMARIES = ${CASE_QUICK_SUMMARIES} / ` +
    `CASE_QUICK_INTERNAL_STATUS = ${CASE_QUICK_INTERNAL_STATUS} / ` +
    `CASE_QUICK_DEAD_ANCHORS = ${CASE_QUICK_DEAD_ANCHORS} / ` +
    `CASE_QUICK_ITEMS = ${distinctItemLists.size} 種 / ` +
    `CONTACT_EMAIL = ${CONTACT_EMAIL} (mailto ${MAILTO_LINKS.length}) / ` +
    `CONTACT_HELPER = ${CONTACT_HELPER} / ` +
    `FEATURED_TIERS = ${featuredBlocks.map((b) => `${b.slug}:${b.tier}`).join(' ')} / ` +
    `FEATURED_SOURCE_LINKS = ${FEATURED_SOURCE_LINKS.length} / ` +
    `SOURCE_WITHHELD = ${SOURCE_WITHHELD} / ` +
    `PUBLIC_CODE_LINKS = ${PUBLIC_CODE_LINKS.length} / ` +
    `WITHHELD_URLS = ${WITHHELD_URLS} / ` +
    `RETIRED_PUBLIC_COPY = ${RETIRED_COPY_HITS} / ` +
    `ABOUT_RETIRED_COPY = ${ABOUT_RETIRED_COPY} / ` +
    `ABOUT_EXPERIENCE = ${ABOUT_EXPERIENCE} / ` +
    `ABOUT_DISCLOSURE_ROWS = ${ABOUT_DISCLOSURE_ROWS} / ` +
    `HOW_PREMISES = ${HOW_PREMISES.length} / ` +
    `HOW_OUTLINE = ${HOW_OUTLINE.join(' ')} / ` +
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
