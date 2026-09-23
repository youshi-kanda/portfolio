/**
 * #31 Phase 9-3 — HOW I BUILD の判断事例 / QA 補足 / TOP 導線。
 *
 * この Issue が固定したのは、書いてよいことの範囲である。主事例は PR #18 と
 * PR #20 の 2 件、PR #19 は 3 件目の事例ではなく補足、そして **PR 本文が
 * 言っていないことを Portfolio 側で言わない**。最後の 1 つがこのファイルの
 * 中心で、いちばん静かに壊れる: 事例の文章は読みやすくする過程でいくらでも
 * 滑らかになり、滑らかにした結果 PR には無い断定が 1 行増えても、リンク先を
 * 開く人がいなければ誰も気づかない。
 *
 * 見ているのは DATA と COMPONENT SOURCE である。描画された HTML 側の件数契約
 * （HOW_DECISION_CASES / HOW_QA_RECORDS / HOW_PR_LINKS / HOW_TOP_LINKS）は
 * `check:structure` が dist に対して持っている——`npm run qa` は test を build
 * より先に走らせるので、ここで dist を読めば前回のビルドを検査することに
 * なりうる。同じ契約を、確実に今の入力を見られる側でそれぞれ置いている。
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, it } from 'node:test';
import { APPROVED_TEXT, APPROVAL_BATCHES } from '../src/lib/content/approved-text.ts';
import { publicPrUrl } from '../src/lib/content/derive.ts';
import { loadCopy, loadUiCopy } from '../src/lib/content/load.ts';
import { site, siteStrings } from '../src/lib/content/site.ts';
import { ui, uiStrings } from '../src/lib/content/ui.ts';

const h = site.howIBuild;
const cases = h.decisionCases;
const qa = h.qaRecord;

const src = (path: string): string =>
  readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');

const CASES_COMPONENT = src('components/home/HowIBuildCases.astro');
/** #52 — PR #19 の記録は独立 component になった。判断事例とは別 section。 */
const QA_COMPONENT = src('components/home/HowIBuildQaRecord.astro');
const TOP_COMPONENT = src('components/navigation/ScrollToTop.astro');
const METHOD_COMPONENT = src('components/home/HowIBuild.astro');
const PAGE = src('pages/how-i-build.astro');

/** Everything one case states, as one string — the body a reader gets. */
const caseText = (c: (typeof cases)[number]): string =>
  [c.title, c.problem, c.observed, c.decision, c.result, ...c.verification].join('\n');

const caseOf = (prNumber: number) => {
  const c = cases.find((x) => x.prNumber === prNumber);
  if (!c) throw new Error(`PR #${prNumber} の事例が無い`);
  return c;
};

/** The `<script>` body of an Astro component, without its frontmatter or markup. */
const scriptOf = (component: string): string =>
  component.slice(component.indexOf('<script>'), component.lastIndexOf('</script>'));

/**
 * The rendered half of an Astro file: frontmatter and comments removed.
 *
 * Needed because these components EXPLAIN themselves — `ScrollToTop` says in
 * prose that it is not a `<button>` calling `scrollTo()`, and a check that
 * greps the raw file finds the sentence and calls it the defect. What is under
 * test is what the component emits, so that is what is read.
 */
const markupOf = (component: string): string => {
  const open = component.indexOf('---');
  const close = component.indexOf('---', open + 3);
  const body = open === 0 && close > 0 ? component.slice(close + 3) : component;
  return body.replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
};

const CASES_MARKUP = markupOf(CASES_COMPONENT);
const QA_MARKUP = markupOf(QA_COMPONENT);
const TOP_MARKUP = markupOf(TOP_COMPONENT);
const METHOD_MARKUP = markupOf(METHOD_COMPONENT);
const PAGE_MARKUP = markupOf(PAGE);

describe('#31 判断事例 — 件数と PR の割り当て', () => {
  it('主事例は 2 件で、PR #20 と PR #18', () => {
    assert.equal(cases.length, 2);
    assert.deepEqual(
      cases.map((c) => c.prNumber),
      [20, 18],
    );
  });

  it('PR #19 は qaRecord であって主事例ではない — HD-J', () => {
    assert.equal(qa.prNumber, 19);
    assert.equal(
      cases.some((c) => c.prNumber === 19),
      false,
      'PR #19 が主事例に昇格している。HD-J は補足として置くことを決めている',
    );
    // 形が違うことも契約のうち。case の形に押し込めば、この記録に無い
    // 「問題」と「判断」を書く場所ができてしまう。
    assert.equal('problem' in qa, false);
    assert.equal('decision' in qa, false);
  });

  it('それぞれの事例が id と本文 4 欄と検証と sourceRefs を持つ', () => {
    for (const c of cases) {
      assert.ok(c.id.length > 0);
      for (const field of ['title', 'problem', 'observed', 'decision', 'result'] as const) {
        assert.ok(c[field].trim().length > 0, `${c.id}.${field} が空`);
      }
      assert.ok(c.verification.length > 0, `${c.id} に検証が無い`);
      assert.ok(c.sourceRefs.length > 0, `${c.id} に sourceRefs が無い`);
    }
    assert.ok(qa.facts.length > 0);
    assert.ok(qa.sourceRefs.length > 0);
  });

  it('各事例の sourceRefs が、根拠にした PR を名指ししている', () => {
    for (const record of [...cases, qa]) {
      for (const ref of record.sourceRefs) {
        assert.match(
          ref,
          new RegExp(`PR #${record.prNumber}\\b`),
          `sourceRef が PR #${record.prNumber} を名指ししていない: ${ref}`,
        );
      }
    }
  });
});

describe('#31 公開 PR の URL — site.repo から導出する', () => {
  it('publicPrUrl が site.repo と番号から組み立てる', () => {
    assert.equal(publicPrUrl(20), `${site.repo}/pull/20`);
    assert.equal(publicPrUrl(20), 'https://github.com/youshi-kanda/portfolio/pull/20');
    assert.equal(publicPrUrl(18), `${site.repo}/pull/18`);
    assert.equal(publicPrUrl(19), `${site.repo}/pull/19`);
  });

  it('site.repo が変われば PR URL も変わる — host を二重に持っていない', () => {
    // 実装が `site.repo` を読んでいることの確認。literal を書いていれば、
    // repo を差し替えても URL は動かない。
    assert.ok(
      publicPrUrl(20).startsWith(site.repo),
      'PR URL が site.repo から始まっていない',
    );
  });

  it('component が GitHub の URL を直書きしていない', () => {
    for (const [name, component] of [
      ['HowIBuildCases.astro', CASES_COMPONENT],
      ['HowIBuildQaRecord.astro', QA_COMPONENT],
      ['ScrollToTop.astro', TOP_COMPONENT],
      ['how-i-build.astro', PAGE],
    ] as const) {
      assert.equal(
        /href=["'`]https:\/\/github\.com/.test(component),
        false,
        `${name} が GitHub の URL を直書きしている`,
      );
    }
    assert.match(CASES_COMPONENT, /publicPrUrl\(/);
    assert.match(QA_COMPONENT, /publicPrUrl\(/);
  });

  it('本文データが PR の URL を保存していない — 持つのは番号だけ', () => {
    for (const record of [...cases, qa]) {
      assert.equal(
        JSON.stringify(record).includes('github.com'),
        false,
        `${'id' in record ? record.id : 'qaRecord'} が URL を保存している`,
      );
      assert.equal(typeof record.prNumber, 'number');
    }
  });
});

describe('#31 PR #18 — 実測値を丸めない', () => {
  const hero = caseOf(18);
  const text = caseText(hero);

  it('1,828ms がそのまま残っている', () => {
    assert.match(text, /1,828ms/);
  });

  it('「約2秒」等に置き換えられていない', () => {
    // 丸めた瞬間、この数値は「計測した値」ではなく「印象」になる。
    for (const rounded of ['約2秒', '約 2 秒', '2秒', '約2000ms', '1.8秒']) {
      assert.equal(text.includes(rounded), false, `${rounded} に丸められている`);
    }
  });

  it('計測条件が書いてある — 20x CPU と Slow 3G', () => {
    assert.match(text, /20 ?倍|20x/);
    assert.match(text, /Slow 3G/);
  });

  it('原因が数値ではなく構造だったことを述べている', () => {
    assert.match(hero.observed, /構造/);
  });

  it('再確認した条件が結果に並んでいる', () => {
    for (const condition of ['BFCache', 'JavaScript']) {
      assert.ok(text.includes(condition), `${condition} の確認が書かれていない`);
    }
    assert.match(text, /blank 0ms/);
  });
});

describe('#31 PR #20 — テストの本数を根拠として持つ', () => {
  const deploy = caseOf(20);
  const text = caseText(deploy);

  it('contract test 22 本', () => {
    assert.match(text, /contract test 22 ?本/);
  });

  it('mutation 10 種', () => {
    assert.match(text, /mutation 10 ?種/);
  });

  it('事前確認 → 当初案の棄却 → 方式変更 の順で書かれている', () => {
    assert.match(deploy.observed, /事前/);
    assert.match(deploy.observed, /運用できない/);
    assert.match(deploy.decision, /管理者/);
  });

  it('rollback が 2 条件であることを述べている', () => {
    assert.match(deploy.result, /切り替え処理が成功し/);
    assert.match(deploy.result, /実際に切り替えが起きた/);
  });
});

describe('#31 AI と Human の境界 — 出所を推測しない', () => {
  /**
   * 「この案を AI が出した」と述べる表現。PR #18 / #20 の本文は、最初にあった
   * 設計を誰が提案したかを書いていない。書いていないことをラベルにすれば、
   * それは転記ではなく Portfolio 側が足した主張である。
   */
  const AI_ORIGIN = /AI\s*案|AI が(提案|出した|考えた)|AI の(案|提案)|AI 提案/;

  const shipping = (): { where: string; text: string }[] => [
    ...siteStrings().map((s) => ({ where: `site.${s.path}`, text: s.text })),
    ...uiStrings().map((s) => ({ where: `ui.${s.path}`, text: s.text })),
    ...loadCopy().map((c) => ({ where: `copy/${c.id}`, text: c.text })),
    ...loadUiCopy().map((c) => ({ where: `copy/${c.id}`, text: c.text })),
  ];

  it('出荷文字列のどこにも根拠のない「AI案」ラベルが無い', () => {
    const offenders = shipping().filter((s) => AI_ORIGIN.test(s.text));
    assert.deepEqual(offenders.map((s) => `${s.where}: ${s.text}`), []);
  });

  it('component も日本語ラベルを直書きしていない — registry 経由で出る', () => {
    for (const component of [CASES_COMPONENT, QA_COMPONENT]) {
      assert.equal(AI_ORIGIN.test(component.replace(/\/\*[\s\S]*?\*\//g, '')), false);
    }
    for (const label of [
      ui.howIBuild.casesLabel,
      ui.howIBuild.casesLead,
      ui.howIBuild.caseProblem,
      ui.howIBuild.caseObserved,
      ui.howIBuild.caseDecision,
      ui.howIBuild.caseResult,
      ui.howIBuild.caseVerification,
      ui.howIBuild.openPr,
      ui.howIBuild.qaLabel,
    ]) {
      for (const [name, component] of [
        ['HowIBuildCases.astro', CASES_COMPONENT],
        ['HowIBuildQaRecord.astro', QA_COMPONENT],
      ] as const) {
        assert.equal(
          component.includes(`>${label}<`),
          false,
          `${label} が ${name} に直書きされている`,
        );
      }
    }
    assert.equal(TOP_COMPONENT.includes(`"${ui.howIBuild.toTop}"`), false);
    assert.match(TOP_COMPONENT, /ui\.howIBuild\.toTop/);
  });

  it('#31 が決めた 9 語が registry にある', () => {
    assert.deepEqual(
      [
        ui.howIBuild.casesLabel,
        ui.howIBuild.caseProblem,
        ui.howIBuild.caseObserved,
        ui.howIBuild.caseDecision,
        ui.howIBuild.caseResult,
        ui.howIBuild.caseVerification,
        ui.howIBuild.openPr,
        ui.howIBuild.qaLabel,
        ui.howIBuild.toTop,
      ],
      ['判断事例', '問題', '確認した事実', '判断', '結果', '検証', '公開PRで確認する', 'QA / 検証記録', 'ページ上部へ戻る'],
    );
  });

  it('既存の工程表・役割・intent が維持されている', () => {
    // #31 §2 / §13。前提の節は置き換わったが、その上の 3 つは触っていない。
    assert.equal(h.workflow.length, 8);
    assert.equal(h.roles.length, 3);
    assert.equal(h.intent.length, 3);
  });
});

/**
 * #31 追加 Human Decision（comment 5747908981）— 「開発の前提」。
 *
 * 置き換えたのは framing であって境界ではない、というのがこの Issue の主張で、
 * 主張である以上は固定しておく対象である。旧 `notClaimed` の 2 文は
 * 「…とは主張しない。」という否定の宣言で、site.json に座っていて承認記録を
 * 持てなかった。新しい 2 文は、実際の体制を述べてから公開内容の範囲を区切り、
 * 本人の承認を持つ copy registry の行として出る。
 *
 * ここで守るのは 3 つ: 旧文言が公開面に残っていないこと、新しい 2 文が
 * 一字一句そのままであること、そして 2 文目が旧 2 文の境界——完全自動の
 * Multi-Agent 開発と構築済み Harness——を今も対象外にしていること。
 */
describe('#31 開発の前提 — 否定の宣言から、体制と範囲の説明へ', () => {
  const PREMISE_IDS = ['method.premise.01', 'method.premise.02'];
  const APPROVED_AT = '2026-09-20T05:37:32Z';
  /** 本人承認コメントの文言そのまま（Issue #31 comment 5747908981）。 */
  const PREMISE_TEXT = [
    'Human が調査・判断・検証を担当し、AI を設計・実装の支援に利用しています。',
    '現在の公開内容は、完全自動の Multi-Agent 開発や専用 Harness の構築済み運用を前提としたものではありません。',
  ];
  /** 置き換えられた公開文言。どれも公開面に残っていてはならない。 */
  const RETIRED = [
    '主張しないこと',
    '完全自動の Multi-Agent 開発をしているとは主張しない。',
    'Harness を構築済みであるとは主張しない。',
  ];

  const shippingStrings = (): { where: string; text: string }[] => [
    ...siteStrings().map((s) => ({ where: `site.${s.path}`, text: s.text })),
    ...uiStrings().map((s) => ({ where: `ui.${s.path}`, text: s.text })),
    ...loadCopy().map((c) => ({ where: `copy/${c.id}`, text: c.text })),
    ...loadUiCopy().map((c) => ({ where: `copy/${c.id}`, text: c.text })),
  ];

  it('premises は 2 件で、copy registry の id を持つ', () => {
    assert.deepEqual([...h.premises], PREMISE_IDS);
    assert.equal('notClaimed' in h, false, 'notClaimed が schema に残っている');
  });

  it('本人承認済みの 2 文が完全一致で registry にある', () => {
    const rows = loadCopy();
    for (const [i, id] of PREMISE_IDS.entries()) {
      const row = rows.find((r) => r.id === id);
      assert.ok(row, `${id} が shipping registry に無い`);
      assert.equal(row.text, PREMISE_TEXT[i], `${id} の文言が承認済みの文と違う`);
      assert.equal(APPROVED_TEXT[id], PREMISE_TEXT[i], `${id} が承認スナップショットと違う`);
    }
  });

  it('2 文とも authored fact として、根拠と承認者を持つ', () => {
    const rows = loadCopy();
    for (const id of PREMISE_IDS) {
      const p = rows.find((r) => r.id === id)!.publication;
      assert.equal(p.claimType, 'fact');
      assert.equal(p.sourceType, 'authored');
      assert.equal(p.reviewStatus, 'approved');
      assert.equal(p.approvedBy, 'user');
      assert.equal(p.approvedAt, APPROVED_AT);
      assert.ok(p.sourceRefs.length > 0, `${id} に根拠が無い`);
      assert.ok(
        p.sourceRefs.some((r) => r.includes('5747908981')),
        `${id} が承認コメントを根拠に挙げていない`,
      );
    }
  });

  it('承認バッチが 3 件をこの 1 回の機会として記録している', () => {
    const batch = APPROVAL_BATCHES.find((b) => b.ids.includes('method.premise.01'));
    assert.ok(batch);
    assert.equal(batch.by, 'user');
    assert.equal(batch.at, APPROVED_AT);
    assert.deepEqual([...batch.ids], [...PREMISE_IDS, 'ui.howIBuild.premises']);
    assert.match(batch.task, /Issue #31 comment 5747908981/);
  });

  it('公開見出しが「開発の前提」である', () => {
    assert.equal(ui.howIBuild.premises, '開発の前提');
    assert.equal('notClaimed' in ui.howIBuild, false, 'notClaimed のラベルが残っている');
    const row = loadUiCopy().find((r) => r.path === 'howIBuild.premises');
    assert.ok(row);
    assert.equal(row.text, '開発の前提');
    assert.equal(row.publication.approvedBy, 'user');
    assert.equal(row.publication.approvedAt, APPROVED_AT);
  });

  it('置き換えられた公開文言が、出荷文字列のどこにも残っていない', () => {
    const offenders = shippingStrings().filter((s) =>
      RETIRED.some((r) => s.text.includes(r)),
    );
    assert.deepEqual(offenders.map((s) => `${s.where}: ${s.text}`), []);
  });

  it('誇張防止の境界は消えていない — 2 文目が同じ 2 つを対象外にしている', () => {
    // 見出しを変えたぶん、境界が一緒に落ちていないかを見る。#31 の決定は
    // 「否定形だけを前面に出す構成から置き換える」であって、削除ではない。
    const bound = PREMISE_TEXT[1]!;
    assert.match(bound, /完全自動の Multi-Agent 開発/);
    assert.match(bound, /Harness/);
    assert.match(bound, /前提としたものではありません。/);
  });

  it('component は本文を直書きせず、id を registry で解決する', () => {
    for (const text of PREMISE_TEXT) {
      assert.equal(
        METHOD_COMPONENT.includes(text),
        false,
        '承認済みの文が component に直書きされている',
      );
    }
    assert.match(METHOD_COMPONENT, /copyText\(id\)/);
    assert.match(METHOD_COMPONENT, /site\.howIBuild\.premises/);
  });
});

/**
 * #31 追加 Human Decision — document outline。
 *
 * 期待する形は 1 つしかない:
 *
 *   h1 HOW I BUILD
 *   ├─ h2 開発の前提
 *   └─ h2 判断事例
 *      ├─ h3 PR #20
 *      ├─ h3 PR #18
 *      └─ h3 PR #19 QA
 *
 * 判断事例が h2 でなければ、その下の 3 件は「開発の前提」——この site が
 * 主張していないことを述べる節——の配下として読まれる。見出しの深さが 1 段
 * ずれているだけに見えて、意味は反転する。
 *
 * 描画後の実レベルは `check:structure` の HOW_OUTLINE が dist に対して数える。
 * ここで見るのは source 側の契約である。
 */
describe('#31 見出し階層 — 判断事例は開発の前提の配下ではない', () => {
  it('「開発の前提」が実 h2 として出る', () => {
    assert.match(METHOD_MARKUP, /<h2 aria-level=\{heading \? 3 : undefined\}>\{ui\.howIBuild\.premises\}<\/h2>/);
    // 見た目は変えない: `.premise h2` が mono 10.5px を宣言し直しているので
    // `.ad h2` の 40px display は当たらない。
    const css = src('styles/components.css');
    assert.match(css, /\.ad \.premise h2\{font-family:var\(--f-mono\);font-size:10\.5px/);
  });

  it('「判断事例」が実 h2 として出て、aria-label と二重にならない', () => {
    assert.match(CASES_MARKUP, /<h2 class="mo" id=\{HEADING_ID\}><b>\{ui\.howIBuild\.casesLabel\}<\/b><\/h2>/);
    assert.equal(
      /aria-label=\{ui\.howIBuild\.casesLabel\}/.test(CASES_MARKUP),
      false,
      '同じ語が aria-label と heading の両方にある',
    );
    assert.match(CASES_MARKUP, /aria-labelledby=\{HEADING_ID\}/);
    // rail から重複した語が外れ、件数だけが残っている
    assert.equal(
      /<span class="lb">\{ui\.howIBuild\.casesLabel\}<\/span>/.test(CASES_MARKUP),
      false,
      'rail が heading と同じ語を繰り返している',
    );
    assert.match(CASES_MARKUP, /<span class="lb">\{fill\(ui\.howIBuild\.casesCount/);
  });

  it('事例は h3 で、h2 の後に出る', () => {
    // source の `<h3` は 1 つ（`cases.map` の中）で、描画されると 2 つになる。
    // 描画後の outline は check:structure の HOW_OUTLINE が dist に対して
    // 数えており、ここで見るのは「h3 しか使っていないこと」と「h2 より後に
    // あること」——つまり事例がこの節の配下であること。
    const h3s = [...CASES_MARKUP.matchAll(/<h3\b/g)];
    assert.equal(h3s.length, 1);
    assert.equal([...CASES_MARKUP.matchAll(/<h([1-6])\b/g)].length, 2, 'h2 1 つ + h3 1 つ');
    assert.equal([...CASES_MARKUP.matchAll(/<h2\b/g)].length, 1);
    const h2at = CASES_MARKUP.indexOf('<h2');
    for (const m of h3s) assert.ok(m.index! > h2at, 'h3 が h2 より前に出ている');
  });

  it('#52 QA は自分の h2 を持ち、その配下の h3 が qa.title である', () => {
    // 判断事例の配下ではない。ここが #52 の主眼で、レベルが 1 段深いままなら
    // 「3 件目の事例」という読みが outline に残る。
    assert.equal([...QA_MARKUP.matchAll(/<h2\b/g)].length, 1);
    assert.equal([...QA_MARKUP.matchAll(/<h3\b/g)].length, 1);
    assert.equal([...QA_MARKUP.matchAll(/<h([1-6])\b/g)].length, 2);
    assert.ok(QA_MARKUP.indexOf('<h3') > QA_MARKUP.indexOf('<h2'));
    // 判断事例と同じ道具で描かれている: rule の上の mono ラベル。
    assert.match(QA_MARKUP, /<div class="shead">/);
    assert.match(QA_MARKUP, /<h2 class="mo" id=\{HEADING_ID\}><b>\{ui\.howIBuild\.qaLabel\}<\/b><\/h2>/);
    assert.match(QA_MARKUP, /aria-labelledby=\{HEADING_ID\}/);
    // 語は 1 回だけ。aria-label と heading の二重読み上げを持ち込まない。
    assert.equal(/aria-label=\{ui\.howIBuild\.qaLabel\}/.test(QA_MARKUP), false);
  });

  it('ページの h1 は 1 つだけで、node は追加していない', () => {
    assert.equal([...PAGE_MARKUP.matchAll(/<h1\b/g)].length, 1);
    assert.equal([...PAGE_MARKUP.matchAll(/<h2\b/g)].length, 0);
  });
});

/**
 * #31 — `casesCount` の根拠。
 *
 * 本人が §8 で列挙した 9 語は公開ラベルであり、`{count} 件` はその中に無い。
 * 列挙されていないものを「列挙された」と書けば、それは出所の捏造である——
 * この PR が事例本文について守っているのと同じ規則が、自分の registry 行にも
 * 適用される。
 */
describe('#31 casesCount — 本人指定のラベル一覧を根拠にしない', () => {
  const row = () => {
    const r = loadUiCopy().find((x) => x.path === 'howIBuild.casesCount');
    assert.ok(r, 'ui.howIBuild.casesCount の行が無い');
    return r;
  };

  it('§8 の label 一覧を sourceRef に挙げていない', () => {
    for (const ref of row().publication.sourceRefs) {
      assert.equal(
        /5747573639/.test(ref),
        false,
        `casesCount が §8 の label 一覧を根拠にしている: ${ref}`,
      );
    }
  });

  it('既存の count UI パターンを根拠にしている', () => {
    const refs = row().publication.sourceRefs;
    assert.ok(refs.length > 0);
    assert.ok(
      refs.some((r) => r.includes('stack.count') && r.includes('principles.count')),
      '既存の導出 UI パターンを根拠に挙げていない',
    );
  });

  it('本人指定の 9 語の側は、その根拠を持ったままである', () => {
    const rows = loadUiCopy();
    const NAMED = [
      'casesLabel', 'caseProblem', 'caseObserved', 'caseDecision',
      'caseResult', 'caseVerification', 'openPr', 'qaLabel', 'toTop',
    ];
    for (const key of NAMED) {
      const r = rows.find((x) => x.path === `howIBuild.${key}`);
      assert.ok(r, `howIBuild.${key} の行が無い`);
      assert.ok(
        r.publication.sourceRefs.some((ref) => ref.includes('5747573639')),
        `howIBuild.${key} が §8 の label 一覧を根拠に挙げていない`,
      );
    }
    assert.equal(NAMED.length, 9);
  });
});

describe('#31 PR #19 — 確認済みと未確認を分けて残す', () => {
  const text = [qa.title, qa.summary, ...qa.facts].join('\n');

  it('計測範囲が書いてある', () => {
    assert.match(text, /10 ?公開ルート/);
    assert.match(text, /11 ?viewport/);
    assert.match(text, /110 ?組合せ/);
    assert.match(text, /anchor 160 ?件/);
  });

  it('確認できなかった範囲を隠していない', () => {
    assert.match(text, /Firefox/);
    assert.match(text, /WebKit/);
    assert.match(text, /Safari/);
    assert.match(text, /一致するとは主張していない/);
  });

  it('直さなかったものを理由付きで記録したことを述べている', () => {
    assert.match(text, /直さなかった/);
    assert.match(text, /理由/);
  });
});

describe('#31 公開してよい範囲 — 運用情報を持ち込まない', () => {
  /**
   * #31 §9 が公開面へ出さないと決めたもの。PR #20 の本文には実在する運用情報が
   * あり、この事例はその PR からの転記なので、転記の途中で一緒に来るのが
   * いちばんありそうな壊れ方である。
   */
  const CONFIDENTIAL: readonly { re: RegExp; what: string }[] = [
    { re: /\b\d{1,3}(?:\.\d{1,3}){3}\b/, what: 'IP アドレス' },
    { re: /\/var\/www|portfolio-live|portfolio-stg/, what: 'filesystem の実パス' },
    { re: /deployer|known_hosts|StrictHostKeyChecking|ssh-keyscan/i, what: 'deploy user / SSH 設定' },
    { re: /\bsudo\b|passwordless/i, what: '権限設定の実体' },
    { re: /secrets?\.[A-Z_]+|SSH_[A-Z_]+/, what: 'secret 名' },
    { re: /nginx|neppepe|portfolio\.neppepe/i, what: 'host / 公開サーバ構成' },
    { re: /symlink|rsync|mv -T|ln -s/i, what: '実行コマンド' },
  ];

  it('事例本文と QA 補足に運用情報が入っていない', () => {
    const body = [...cases.map(caseText), qa.title, qa.summary, ...qa.facts].join('\n');
    for (const { re, what } of CONFIDENTIAL) {
      const hit = re.exec(body);
      assert.equal(hit, null, `公開本文に ${what} が入っている: ${hit?.[0]}`);
    }
  });

  it('新しい UI ラベルにも入っていない', () => {
    const labels = Object.values(ui.howIBuild).join('\n');
    for (const { re, what } of CONFIDENTIAL) {
      assert.equal(re.test(labels), false, `UI ラベルに ${what} が入っている`);
    }
  });

  it('sourceRefs は節名だけで、環境を持ち込んでいない', () => {
    const refs = [...cases.flatMap((c) => c.sourceRefs), ...qa.sourceRefs].join('\n');
    for (const { re, what } of CONFIDENTIAL) {
      assert.equal(re.test(refs), false, `sourceRef に ${what} が入っている`);
    }
  });
});

describe('#31 TOP 導線 — JavaScript が無くても動く', () => {
  it('操作要素は <a href="#top"> であって button ではない', () => {
    assert.match(TOP_MARKUP, /<a\b[\s\S]*?href="#top"/);
    assert.equal(/<button\b/.test(TOP_MARKUP), false, 'button + JS になっている');
  });

  it('href="#top" は 1 つ、id="top" は page 側に 1 つ', () => {
    assert.equal([...TOP_MARKUP.matchAll(/href="#top"/g)].length, 1);
    assert.equal([...PAGE_MARKUP.matchAll(/\sid="top"/g)].length, 1);
    assert.match(PAGE_MARKUP, /<section class="hero" id="top">/);
    // 既存のランドマーク id は変えない（#31 §12）
    assert.match(PAGE_MARKUP, /<main id="how-i-build">/);
  });

  it('アクセシブル名と操作面の契約', () => {
    assert.match(TOP_MARKUP, /aria-label=\{ui\.howIBuild\.toTop\}/);
    const css = src('styles/components.css');
    assert.match(css, /\.ad \.totop\{[\s\S]*?min-width:48px;min-height:48px/);
    assert.match(css, /env\(safe-area-inset-right\)/);
    assert.match(css, /env\(safe-area-inset-bottom\)/);
  });

  it('JS は表示制御だけ — scroll / wheel / touchmove を一切聞かない', () => {
    const script = scriptOf(TOP_COMPONENT);
    assert.ok(script.length > 0, '<script> が見つからない');
    assert.match(script, /IntersectionObserver/);
    for (const forbidden of [
      'addEventListener',
      'onscroll',
      'scrollY',
      'pageYOffset',
      'scrollTo',
      'scrollIntoView',
      'requestAnimationFrame',
      'preventDefault',
      'getBoundingClientRect',
    ]) {
      assert.equal(
        script.includes(forbidden),
        false,
        `TOP component が ${forbidden} を使っている — 表示制御だけという契約に反する`,
      );
    }
  });

  it('JS が無い経路では隠れない — 隠す CSS は is-managed に紐づく', () => {
    const css = src('styles/components.css');
    // `.is-managed` は script が付ける。これが付くまでは visibility を触る規則が
    // 1 つも当たらないので、no-JS では常時表示になる。
    assert.match(css, /\.ad \.totop\.is-managed\{opacity:0;visibility:hidden/);
    assert.match(TOP_COMPONENT, /classList\.add\('is-managed'\)/);
    const hiding = [...css.matchAll(/([^{}]*\.totop[^{}]*)\{([^}]*)\}/g)].filter(([, , body]) =>
      /visibility\s*:\s*hidden|display\s*:\s*none/.test(body ?? ''),
    );
    for (const [, selector] of hiding) {
      assert.match(
        selector ?? '',
        /\.is-managed/,
        `is-managed を条件にしない規則が TOP リンクを隠している: ${selector?.trim()}`,
      );
    }
  });

  it('reduced-motion で transition を止めている', () => {
    const css = src('styles/components.css');
    assert.match(
      css,
      /@media \(prefers-reduced-motion: reduce\)\{\s*\.ad \.totop\.is-managed\{transition:none\}/,
    );
  });

  it('global な smooth scroll を追加していない', () => {
    const styles = new URL('../src/styles/', import.meta.url);
    for (const file of readdirSync(styles).filter((f) => f.endsWith('.css'))) {
      const sheet = readFileSync(new URL(file, styles), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      const smooth = [...sheet.matchAll(/scroll-behavior\s*:\s*smooth/g)];
      assert.deepEqual(
        smooth.map((m) => m[0]),
        [],
        `${file} が scroll-behavior:smooth を宣言している — アンカーの標準挙動を上書きしない`,
      );
    }
  });
});

describe('#31 二層構造 — 結論は折りたたみの外', () => {
  it('問題 / 確認した事実 / 判断 / 結果 は details の外に出る', () => {
    const detailsStart = CASES_MARKUP.indexOf('<details');
    const detailsEnd = CASES_MARKUP.indexOf('</details>');
    assert.ok(detailsStart > 0 && detailsEnd > detailsStart, 'details が見つからない');
    const folded = CASES_MARKUP.slice(detailsStart, detailsEnd);
    for (const field of ['c.problem', 'c.observed', 'c.decision', 'c.result']) {
      assert.equal(folded.includes(field), false, `${field} が折りたたみの中にある`);
    }
    // 折りたたまれてよいのは検証だけ
    assert.match(folded, /c\.verification/);
  });

  it('公開 PR へのリンクも折りたたみの外に出る', () => {
    const detailsEnd = CASES_MARKUP.indexOf('</details>');
    assert.ok(CASES_MARKUP.indexOf('data-decision-pr', detailsEnd) > detailsEnd);
    assert.equal(
      CASES_MARKUP.slice(
        CASES_MARKUP.indexOf('<details'),
        detailsEnd,
      ).includes('data-decision-pr'),
      false,
      'PR リンクが折りたたみの中にある — 確認する手段自体を隠さない',
    );
  });

  it('component は 3 件ぶんの目印を出す — 主事例 2 / QA 1 / PR リンク 1 本ずつ', () => {
    // 描画後の件数は check:structure が dist に対して数える
    // （HOW_DECISION_CASES / HOW_QA_RECORDS / HOW_PR_LINKS / HOW_TOP_LINKS）。
    // ここで見るのは、数える対象の目印を component が実際に書いていること。
    //
    // #52 — 目印は 2 つの component に分かれた。判断事例側に QA の目印が
    // 「無い」ことが契約である: 同じ component にある限り、DOM 上で 3 件目に
    // なる書き方がいつでもできてしまう。
    assert.match(CASES_MARKUP, /data-decision-case=\{c\.id\}/);
    assert.equal(
      /data-qa-record\b/.test(CASES_MARKUP),
      false,
      'QA の目印が判断事例 component に戻っている — 3 件目に見える構造',
    );
    assert.equal([...CASES_MARKUP.matchAll(/data-decision-pr=/g)].length, 1);
    assert.match(QA_MARKUP, /data-qa-record\b/);
    assert.equal(/data-decision-case=/.test(QA_MARKUP), false, 'QA が事例を名乗っている');
    assert.equal([...QA_MARKUP.matchAll(/data-decision-pr=/g)].length, 1);
    assert.match(PAGE_MARKUP, /<HowIBuildCases \/>/);
    assert.match(PAGE_MARKUP, /<HowIBuildQaRecord \/>/);
    assert.match(PAGE_MARKUP, /<ScrollToTop \/>/);
    // 読み順: 判断事例 → QA → Footer → TOP
    assert.ok(PAGE_MARKUP.indexOf('<HowIBuildQaRecord') > PAGE_MARKUP.indexOf('<HowIBuildCases'));
    assert.ok(PAGE_MARKUP.indexOf('<Footer') > PAGE_MARKUP.indexOf('<HowIBuildQaRecord'));
  });
});
