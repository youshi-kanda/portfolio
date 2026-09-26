/**
 * #33 Phase 9-5 — Case Study 冒頭の「3分概要」。
 *
 * この Issue のいちばん静かな失敗は、ブロックが出ないことではない。**出るが、
 * 中身が本文と別の正本になる**ことである。3分概要を書くいちばん素直な方法は
 * 各 Case Study JSON に `quickSummary` を足すことで、それをやると同じ事実の
 * 正本が Work / Case Study 本文 / 概要 の 3 か所になる。3 つは書いた日は
 * 一致していて、そのあと毎日ずれていき、いちばん読み返されないのが概要である。
 *
 * なのでここで守るのは 3 つ。
 *
 *   1. 表示される値が、既存の正本から導出されていること（新しい本文が無い）
 *   2. 3 件が同じ component・同じ項目・同じ順序で描かれること
 *   3. 内部 enum が公開面に出ないこと。未知の enum は fallback せず throw
 *
 * 見ているのは DATA / REGISTRY / COMPONENT SOURCE である。描画された HTML 側
 * （CASE_QUICK_SUMMARIES / CASE_QUICK_ITEMS / CASE_QUICK_INTERNAL_STATUS /
 * CASE_QUICK_DEAD_ANCHORS / CASE_QUICK_ORDER）は `check:structure` が dist に
 * 対して持っている——`npm run qa` は test を build より先に走らせるので、
 * ここで dist を読めば前回のビルドを検査することになりうる。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { workVerification } from '../src/lib/content/compat.ts';
import {
  caseSections,
  developmentBackground,
  implementationStatusLabel,
  workPublicSourceUrl,
} from '../src/lib/content/derive.ts';
import { loadCaseStudies, loadUiCopy, loadWorks } from '../src/lib/content/load.ts';
import { IMPLEMENTATION_STATUSES, type PortfolioProfile } from '../src/lib/content/schema.ts';
import { ui, uiStrings } from '../src/lib/content/ui.ts';

const src = (path: string): string =>
  readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');

const COMPONENT = src('components/case/CaseQuickSummary.astro');
/**
 * The component with its comments removed.
 *
 * Every "this string is not written here" assertion below runs against THIS,
 * not against the file. The design decisions in this component are recorded as
 * prose above the code — why the ledger is not reused, why `--stop` is wrong
 * here, why no slug appears — and a substring search cannot tell an argument
 * about a string from a use of it. Checking the file would mean the component
 * fails its own tests for explaining itself, and the fix would be to delete the
 * explanation, which is the wrong thing to be incentivised to do.
 */
const CODE = COMPONENT.replace(/\/\*[\s\S]*?\*\//g, '');
const CASE_PAGE = src('pages/work/[slug]/index.astro');
const TECHNICAL_PAGE = src('pages/work/[slug]/technical.astro');

const COMPONENTS_CSS = src('styles/components.css');
const RESPONSIVE_CSS = src('styles/responsive.css');

/**
 * Is `needle` written at the top level of this stylesheet — i.e. NOT inside an
 * `@media` block?
 *
 * Searching for the declaration alone cannot answer the question this file has
 * to answer, because the bug being fixed is a rule that EXISTED and applied at
 * one range of widths only. Brace depth is the property that distinguishes
 * them: at depth 0 the rule applies at every width, and inside `@media` it does
 * not. Comments are stripped first, since a brace inside prose is not a block.
 */
const atTopLevel = (css: string, needle: string): boolean => {
  const at = css.indexOf(needle);
  if (at < 0) return false;
  const before = css.slice(0, at).replace(/\/\*[\s\S]*?\*\//g, '');
  const open = (before.match(/\{/g) ?? []).length;
  const close = (before.match(/\}/g) ?? []).length;
  return open === close;
};

const works = loadWorks();
const caseStudies = loadCaseStudies();
const bySlug = new Map(works.map((w) => [w.slug, w]));
const caseBySlug = new Map(caseStudies.map((c) => [c.slug, c]));

/** The published Case Studies, derived — never a hand-written list of three. */
const published = works.filter((w) => w.shipping && w.caseStudyPublished);
const pairs = published.map((work) => ({
  work,
  caseStudy: caseBySlug.get(work.slug)!,
}));

const Q = ui.caseStudy.quick;

/**
 * `[slug, value]` rows sorted by slug — the load order of `work/` is the file
 * order, which is not an editorial decision and should not be asserted as one.
 */
const bySlugTable = (value: (p: (typeof pairs)[number]) => unknown): unknown[][] =>
  pairs
    .map((p) => [p.work.slug, value(p)])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));

describe('#33 3分概要 — 冒頭だけで読み切れる索引', () => {
  it('対象は公開済み Case Study の crm / ppm / dfe の 3 件', () => {
    assert.deepEqual(published.map((w) => w.slug).sort(), ['crm', 'dfe', 'ppm']);
    for (const { work, caseStudy } of pairs) {
      assert.ok(caseStudy, `case-study/${work.slug}.json が無い`);
    }
  });

  it('3 件とも同じ component から描かれ、slug 分岐を持たない', () => {
    // ONE COMPONENT, NO BRANCH. 3 つのテンプレートが 1 つの component の名前を
    // 着ているのがこの Issue の失敗形で、その入口が slug 判定である。
    for (const slug of ['crm', 'ppm', 'dfe']) {
      assert.equal(
        CODE.includes(slug),
        false,
        `CaseQuickSummary に ${slug} が書かれている`,
      );
    }
    assert.doesNotMatch(CODE, /work\.slug\s*===/);
    assert.doesNotMatch(CODE, /caseStudy\.slug\s*===/);
    assert.doesNotMatch(CODE, /switch\s*\(\s*work\.slug/);

    // Case Study ページが 1 回だけ描画する。
    assert.match(CASE_PAGE, /import CaseQuickSummary from/);
    assert.equal(
      (CASE_PAGE.match(/<CaseQuickSummary\b/g) ?? []).length,
      1,
      'Case Study ページが 3分概要 を 1 回だけ描いていない',
    );
  });

  it('項目の順序が component に 1 つだけ定義されている', () => {
    // 描画順は component の DOM 順そのもの。3 件が同じ順序で出ることは
    // check:structure が artifact 側で突き合わせるので、ここで見るのは
    // 「順序の定義が 1 か所にある」こと。
    const items = [...COMPONENT.matchAll(/data-quick-item="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(items, [
      'problem',
      'targetUser',
      'background',
      'role',
      'status',
      'built',
      'source',
      'evidence',
      'limitations',
      'details',
    ]);
    assert.equal(new Set(items).size, items.length, '同じ項目が 2 回出ている');
  });

  it('Case Study JSON に 3分概要用の重複フィールドを足していない', () => {
    const FORBIDDEN = [
      'quickSummary',
      'summary',
      'summaryProblem',
      'summaryRole',
      'builtSummary',
      'quick',
    ];
    for (const c of caseStudies) {
      for (const key of FORBIDDEN) {
        assert.equal(key in c, false, `case-study/${c.slug}.json に ${key} がある`);
      }
    }
    // 概要の正本を work 側へ移したときの逃げ道も塞ぐ。Case Study 側に
    // 「概要用の built」を足すのは、まさにこの Issue が禁じた 3 つ目の正本。
    for (const c of caseStudies) {
      assert.equal('implementationScope' in c, false, `case-study/${c.slug}.json に implementationScope がある`);
      assert.equal('builtScope' in c, false, `case-study/${c.slug}.json に builtScope がある`);
    }
    // schema 側も同じ。`.strict()` ではないなら、足しても静かに通ってしまう。
    for (const key of ['quickSummary', 'builtSummary']) {
      assert.equal(
        src('lib/content/schema.ts').includes(key),
        false,
        `caseStudySchema に ${key} が追加されている`,
      );
    }
  });

  it('解決する課題 / 想定利用者 は work レコードの値そのもの', () => {
    for (const { work } of pairs) {
      assert.ok(work.problem.length > 0, `work/${work.slug} に problem が無い`);
      assert.ok(work.targetUser.trim().length > 0);
    }
    // component は work から読む。別の短縮文を作る余地を持たない。
    assert.match(COMPONENT, /work\.problem\.map/);
    assert.match(COMPONENT, /\{work\.targetUser\}/);
  });

  it('開発背景は #30 の developmentBackground() と一致する', () => {
    assert.match(COMPONENT, /developmentBackground\(work\.portfolioProfile\)/);
    assert.deepEqual(
      bySlugTable(({ work }) => developmentBackground(work.portfolioProfile)),
      [
        ['crm', '個人開発 / 技術デモ'],
        ['dfe', '個人開発 / 公開用再構成'],
        ['ppm', '個人開発 / 技術デモ'],
      ],
    );
  });

  it('担当範囲は work.role で、caseStudy.role の文章を要約していない', () => {
    assert.match(COMPONENT, /work\.role\.join/);
    assert.deepEqual(
      bySlugTable(({ work }) => work.role.join(' / ')),
      [
        ['crm', 'Frontend / Backend / AI Integration / Database / Testing / CI-CD'],
        ['dfe', 'Backend / Architecture / Testing'],
        ['ppm', 'Automation / Architecture / Testing'],
      ],
    );
    // 本文側の自由記述は概要に持ち込まない。
    for (const { caseStudy } of pairs) {
      assert.equal(CODE.includes(caseStudy.role), false);
    }
  });

  it('実装状況は enum を表示語へ変換した値で、3 件の値が #29 と一致する', () => {
    assert.deepEqual(
      bySlugTable(({ work }) => implementationStatusLabel(work.portfolioProfile)),
      [
        ['crm', '公開デモとして動作'],
        ['dfe', '公開デモとして動作'],
        ['ppm', '実装済み'],
      ],
    );
    assert.deepEqual(ui.caseStudy.statusLabels, {
      'public-demo': '公開デモとして動作',
      implemented: '実装済み',
      poc: 'PoC',
    });
    // 対応表は enum を全て覆う。member を足して表示語を決め忘れたら落ちる。
    for (const member of IMPLEMENTATION_STATUSES) {
      assert.ok(
        member in ui.caseStudy.statusLabels,
        `${member} の表示語が決まっていない`,
      );
    }
  });

  it('未知の実装状況は raw enum へ fallback せず throw する', () => {
    // MUTATION. fallback を返す実装なら、内部 enum がそのまま読者の前に出て、
    // 「何かは描画された」ことしか見ていないテストは全部通る。
    const profile = {
      ...pairs[0]!.work.portfolioProfile,
      implementationStatus: 'shipped-to-production',
    } as unknown as PortfolioProfile;
    assert.throws(
      () => implementationStatusLabel(profile),
      /shipped-to-production/,
      '未知の enum で throw していない',
    );
    // 空文字も値ではない。
    const empty = {
      ...pairs[0]!.work.portfolioProfile,
      implementationStatus: '',
    } as unknown as PortfolioProfile;
    assert.throws(() => implementationStatusLabel(empty));
    // 変換は 1 か所。component が独自の対応表を持っていない。
    assert.equal(CODE.includes('public-demo'), false);
    assert.equal(CODE.includes('implemented'), false);
  });

  it('実装したものの正本は work.implementationScope で、caseStudy.built ではない', () => {
    assert.match(COMPONENT, /work\.implementationScope\.map/);
    for (const { work } of pairs) {
      assert.ok(
        work.implementationScope.length > 0,
        `work/${work.slug} に implementationScope が無い`,
      );
      for (const item of work.implementationScope) {
        assert.ok(item.trim().length > 0, `work/${work.slug} の implementationScope に空行`);
      }
    }
    // 3分概要は built を読まない。読んでいたら、下の「未実装が混ざる」テストが
    // 守っている性質はデータ側の偶然に戻る。
    assert.doesNotMatch(CODE, /caseStudy\.built/);
    assert.doesNotMatch(CODE, /\bb\.name\b/);
    assert.doesNotMatch(CODE, /\bb\.what\b/);
    // 件数を人手で固定していない。
    assert.doesNotMatch(CODE, /implementationScope\.slice\(/);
  });

  it('実装したものに未実装の行が混ざらない — built はそれを持ちうる', () => {
    // WHY THIS SPLIT EXISTS, stated as data rather than as a comment.
    // `caseStudy.built` は本文側の台帳で、読者がその作品を開いたときに出会う
    // ものを並べる——だから「まだ作っていない画面」や「含めていません」の行を
    // 正当に持つ。それを 実装したもの という見出しの下に、名前と説明を — で
    // つないだ 1 行として出すと、意味が反転する。
    const UNBUILT = ['まだ作っていない', '実装予定', '含めていません', '未実装'];
    const unbuiltRow = (b: { name: string; what: string }): boolean =>
      UNBUILT.some((t) => b.name.includes(t) || b.what.includes(t));

    // 危険が実在すること。built 側から未実装行が消えたらこのテストは用済みに
    // 見えるが、そのときは本文の台帳が変わっているので気づく側でありたい。
    const hazards = pairs.filter(({ caseStudy }) => caseStudy.built.some(unbuiltRow));
    assert.ok(
      hazards.length > 0,
      'built に未実装行を持つ Case Study が 1 件も無い — この契約が守る対象が消えた',
    );
    const ppm = caseBySlug.get('ppm')!;
    assert.ok(
      ppm.built.some((b) => b.name.includes('まだ作っていない画面')),
      'PPM の built から「まだ作っていない画面」が消えている',
    );

    // 正本側には 1 件も無い。slug を名指しせず 3 件すべてに効かせる。
    for (const { work } of pairs) {
      for (const item of work.implementationScope) {
        for (const t of UNBUILT) {
          assert.equal(
            item.includes(t),
            false,
            `work/${work.slug} の implementationScope に未実装の語「${t}」がある`,
          );
        }
      }
    }

    // そして概要に出る値は、その未実装行と一致しない。
    for (const { work, caseStudy } of pairs) {
      for (const b of caseStudy.built.filter(unbuiltRow)) {
        assert.equal(
          work.implementationScope.includes(b.name),
          false,
          `${work.slug}: 未実装行「${b.name}」が 3分概要に出る`,
        );
      }
    }
  });

  it('本文の 作ったもの は従来どおり caseStudy.built を描く', () => {
    // 役割分担であって置き換えではない。詳細本文は未実装の画面を名指しする
    // 必要があり、概要はしてはならない——両方が真であってはじめて分担になる。
    const body = src('components/case/CaseBody.astro');
    assert.match(body, /c\.built\.map/);
    assert.match(body, /id="cs5"/);
    for (const { caseStudy } of pairs) {
      assert.ok(caseStudy.built.length > 0, `${caseStudy.slug} に built が無い`);
      for (const b of caseStudy.built) {
        assert.ok(b.name.trim().length > 0);
        assert.ok(b.what.trim().length > 0);
      }
    }
  });

  it('3分概要のリンクの 44px は breakpoint に閉じていない', () => {
    // THE BUG THIS FIXES. 指の当たり判定は `responsive.css` の
    // `max-width:767px` に置くのが普通で、この 1 本だけはそれが誤りだった——
    // 1440px 実測で 30.2px。タッチ対応ラップトップもスタイラスも、同じ幅で
    // 同じリンクに触る。
    const RULE = '.ad .csq .lk{min-height:44px;display:inline-flex;align-items:center}';
    assert.ok(
      COMPONENTS_CSS.includes(RULE),
      'components.css に .ad .csq .lk の 44px 指定が無い',
    );
    assert.ok(
      atTopLevel(COMPONENTS_CSS, RULE),
      '.ad .csq .lk の 44px 指定が @media の中にある — desktop / tablet に効かない',
    );

    // 同じ宣言を 2 か所に持たない。2 本あれば、片方だけ直した日から両者は
    // 黙ってずれる。
    assert.equal(
      RESPONSIVE_CSS.includes('.csq .lk'),
      false,
      'responsive.css に .csq .lk が残っている',
    );
    const declared = [COMPONENTS_CSS, RESPONSIVE_CSS, src('styles/evidence.css')]
      .join('\n')
      .match(/\.ad \.csq \.lk\s*\{/g);
    assert.equal((declared ?? []).length, 1, '.ad .csq .lk が 1 か所だけではない');

    // サイト全体の `.lk` は変えていない。基本形は今までどおり inline-block。
    assert.match(COMPONENTS_CSS, /\.ad \.lk\{display:inline-block;/);
    // 他ブロックの 44px 指定は responsive のまま——今回の対象は .csq だけ。
    assert.match(RESPONSIVE_CSS, /\.ad \.dc-l \.lk\{min-height:44px;/);
  });

  it('公開コードは workPublicSourceUrl() で、URL を直書きしていない', () => {
    assert.match(COMPONENT, /workPublicSourceUrl\(work\)/);
    assert.doesNotMatch(CODE, /https:\/\/github\.com/);
    for (const { work } of pairs) {
      const url = workPublicSourceUrl(work);
      assert.ok(url, `work/${work.slug} に公開 source が無い`);
      assert.match(url, /^https:\/\/github\.com\/.+\/tree\/main\/.+$/);
    }
    // CTA は #30 の既存語を再利用する。
    assert.match(COMPONENT, /ui\.work\.sourceCta/);
    assert.equal(ui.work.sourceCta, '公開コードを見る');
  });

  it('確認できるものは caseStudy.repository の既存 URL だけで、公開コードと重複しない', () => {
    const canonical = (href: string): string => href.replace(/\/+$/, '');
    for (const { work, caseStudy } of pairs) {
      const sourceUrl = workPublicSourceUrl(work)!;
      const shown = caseStudy.repository.filter(
        (r) => canonical(r.href) !== canonical(sourceUrl),
      );
      // 重複が実際に 1 件取り除かれている（除外ロジックが空振りしていない）。
      assert.equal(
        shown.length,
        caseStudy.repository.length - 1,
        `${work.slug}: 公開コードと同一 URL の repository 行が 1 件だけ除かれていない`,
      );
      assert.equal(
        shown.some((r) => canonical(r.href) === canonical(sourceUrl)),
        false,
      );
      // 残りは README / CI 設定 / CI 実行ログ。新しい URL を作っていない。
      for (const r of shown) {
        assert.ok(caseStudy.repository.some((o) => o.href === r.href));
      }
      assert.ok(shown.length > 0);
    }
    // 位置依存でなく URL 比較であること。`slice(1)` は今日だけ正しい。
    assert.doesNotMatch(CODE, /repository\.slice\(/);
    assert.match(COMPONENT, /canonical\(r\.href\) !== canonical\(sourceUrl\)/);
  });

  it('テスト要約は workVerification() の値で、数値を直書きしていない', () => {
    assert.match(COMPONENT, /workVerification\(work\)/);
    assert.deepEqual(
      bySlugTable(({ work }) => workVerification(work)?.summary),
      [
        ['crm', 'backend 静的 480 件 / CI 実測 484 passed'],
        ['dfe', '157 passed / 40 suites'],
        ['ppm', '77 passed / 0 failed'],
      ],
    );
    // 実測値が component に書き写されていない。
    for (const { work } of pairs) {
      const summary = workVerification(work)?.summary ?? '';
      assert.equal(CODE.includes(summary), false);
    }
    assert.doesNotMatch(CODE, /\d{2,} passed/);
  });

  it('未実装・対象外は work.limitations で、scope 表の複製ではない', () => {
    assert.match(COMPONENT, /work\.limitations\.map/);
    for (const { work, caseStudy } of pairs) {
      assert.ok(work.limitations.length > 0, `work/${work.slug} に limitations が無い`);
      // scope 表の行は概要へコピーされていない。
      for (const row of caseStudy.scope) {
        assert.equal(CODE.includes(row.notIncluded), false);
        assert.equal(CODE.includes(row.why), false);
      }
    }
  });

  it('DFE の OCR 境界が limitations として維持されている', () => {
    const dfe = bySlug.get('dfe')!;
    assert.ok(
      dfe.limitations.some((t) => t.includes('この作品は OCR を実行していない')),
      'DFE の OCR 境界が limitations から消えている',
    );
    assert.ok(dfe.limitations.some((t) => t.includes('OCR の精度の証拠にはならない')));
    // leadDisclosure 側も無傷。
    const dfeCase = caseBySlug.get('dfe')!;
    assert.ok(dfeCase.leadDisclosure?.includes('この作品は OCR を実行していない'));
  });

  it('DFE の leadDisclosure が 3分概要より前に描かれる', () => {
    // 順序が内容である。CaseHead が leadDisclosure を持ち、ページは CaseHead を
    // 先に置く——両方が真であってはじめて、訂正が誤解より先に届く。
    assert.match(src('components/case/CaseHead.astro'), /caseStudy\.leadDisclosure/);
    const head = CASE_PAGE.indexOf('<CaseHead');
    const quick = CASE_PAGE.indexOf('<CaseQuickSummary');
    assert.ok(head >= 0 && quick >= 0);
    assert.ok(head < quick, 'CaseQuickSummary が CaseHead より前にある');
    assert.equal(
      CODE.includes('leadDisclosure'),
      false,
      '3分概要が leadDisclosure を自分で描いている（2 か所になる）',
    );
  });

  it('詳しく見るのリンクは caseSections が持つ section だけ', () => {
    for (const { work, caseStudy } of pairs) {
      const sections = caseSections(work, caseStudy);
      const ids = new Set(sections.map((s) => s.id));
      for (const id of ['cs6', 'cs9', 'cs12']) {
        assert.ok(ids.has(id), `${work.slug} に ${id} が無い（リンクは出さない側になる）`);
      }
      // タイトルは caseSections が返す語。component に二重定義しない。
      for (const s of sections) {
        assert.equal(CODE.includes(s.title), false, `${s.title} が component にある`);
      }
    }
    assert.match(COMPONENT, /caseSections\(work, caseStudy\)/);
    // 存在しない section へはリンクしない。
    assert.match(COMPONENT, /rendered\.find\(\(s\) => s\.id === id\)/);
  });

  it('公開ラベル 12 件が UI registry にあり、既存語を再利用している', () => {
    const paths = new Set(uiStrings().map((s) => s.path));
    const rows = new Map(loadUiCopy().map((r) => [r.path, r]));
    const NEW = [
      ['caseStudy.quick.head', '3分概要'],
      ['caseStudy.quick.problem', '解決する課題'],
      ['caseStudy.quick.targetUser', '想定利用者'],
      ['caseStudy.quick.role', '担当範囲'],
      ['caseStudy.quick.status', '実装状況'],
      ['caseStudy.quick.built', '実装したもの'],
      ['caseStudy.quick.source', '公開コード'],
      ['caseStudy.quick.limitations', '未実装・対象外'],
      ['caseStudy.quick.details', '詳しく見る'],
      ['caseStudy.statusLabels.public-demo', '公開デモとして動作'],
      ['caseStudy.statusLabels.implemented', '実装済み'],
      ['caseStudy.statusLabels.poc', 'PoC'],
    ] as const;
    for (const [path, text] of NEW) {
      assert.ok(paths.has(path), `ui.${path} が ui object に無い`);
      const row = rows.get(path);
      assert.ok(row, `ui.${path} が ui.json に無い`);
      assert.equal(row.text, text);
      assert.equal(row.publication.reviewStatus, 'approved');
      assert.equal(row.publication.sourceType, 'source-derived');
      assert.ok(row.publication.sourceRefs.length > 0, `${path} に出所が無い`);
      assert.ok(
        row.publication.sourceRefs.some((r) => r.includes('5749344650')),
        `${path} が HD-O の決定記録を挙げていない`,
      );
    }

    // ラベルは presentation、enum の表示語は fact。#30 が引いたのと同じ線で、
    // 「欄の名前」と「作品について述べる値」を同じ分類に落とさない。
    for (const [path] of NEW.filter(([p]) => p.startsWith('caseStudy.quick.'))) {
      assert.equal(rows.get(path)!.publication.claimType, 'presentation', path);
    }
    for (const [path] of NEW.filter(([p]) => p.startsWith('caseStudy.statusLabels.'))) {
      assert.equal(rows.get(path)!.publication.claimType, 'fact', path);
    }

    // 再利用: 開発背景 / 確認できるもの / 公開コードを見る は #30 の語のまま。
    assert.equal(ui.work.background, '開発背景');
    assert.equal(ui.work.evidenceHead, '確認できるもの');
    assert.match(COMPONENT, /ui\.work\.background/);
    assert.match(COMPONENT, /ui\.work\.evidenceHead/);
    assert.equal(paths.has('caseStudy.quick.background'), false, '開発背景 を 2 か所に持っている');
    assert.equal(paths.has('caseStudy.quick.evidence'), false, '確認できるもの を 2 か所に持っている');
    // GitHub Actions の注意書きも既存行を使う。
    assert.match(COMPONENT, /ui\.caseStudy\.repositoryAuthNote/);
  });

  it('見出しは実 h2 で、section が aria-labelledby で参照する', () => {
    assert.match(COMPONENT, /<h2 id="cs-quick-h">\{Q\.head\}<\/h2>/);
    assert.match(COMPONENT, /aria-labelledby="cs-quick-h"/);
    // 見た目だけの heading 指定ではない。
    assert.doesNotMatch(CODE, /aria-level=/);
    // 折りたたまない。JS も要らない。
    assert.doesNotMatch(CODE, /<details|<summary|<script/);
  });

  it('警告として描かれていない', () => {
    // 3分概要は索引であって alert ではない。--stop で塗れば、読み手は本文を
    // 読む前に作品を割り引いて読む。
    for (const token of ['--stop', 'alert', 'banner']) {
      assert.equal(CODE.includes(token), false, `component に ${token} がある`);
    }
  });

  it('Technical page と既存 Case Study 本文に手を入れていない', () => {
    assert.equal(
      TECHNICAL_PAGE.includes('CaseQuickSummary'),
      false,
      'Technical page に 3分概要 が入っている',
    );
    // 本文側の節は今までどおり CaseBody が描く。
    const body = src('components/case/CaseBody.astro');
    assert.match(body, /id="cs12"/);
    assert.match(body, /id="cs6"/);
    assert.match(body, /id="cs9"/);
    assert.equal(body.includes('cs-quick'), false);
  });
});
