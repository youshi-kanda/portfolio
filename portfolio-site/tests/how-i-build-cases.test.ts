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
 * 見ているのは DATA である。描画された HTML 側の契約（HOW_OUTLINE /
 * HOW_NO_CASE_DEPTH / HOW_TOP_LINKS ほか）は `check:structure` が dist に対して
 * 持っている——`npm run qa` は test を build より先に走らせるので、ここで dist を
 * 読めば前回のビルドを検査することになりうる。同じ契約を、確実に今の入力を
 * 見られる側でそれぞれ置いている。
 *
 * **この 2 節は /how-i-build/ から外れた。** 判断事例と QA / 検証記録は、
 * 「どう作るか」ではなく「なぜその設計・技術判断をしたか」を、名指しの 2 PR に
 * ついて述べる節だった。それは Case Study の問いで、/work/ 何を作ったか →
 * /how-i-build/ どう作るか → Case Study なぜそう判断したか の 3 分割では 3 枚目に
 * 属する。component は消え、**data は残っている**——`decisionCases` と
 * `qaRecord` は承認記録つきの公開内容のままで、Case Study 側が描く素材である。
 *
 * だからこのファイルはほぼそのまま残る。PR #18 / #20 の実測値を丸めない、
 * 運用情報を持ち込まない、出所を推測しない——どれも「公開面に出ていること」を
 * 前提にした規則ではなく、この文章がこの文章であることの規則で、描画されて
 * いない今のほうが静かに壊れやすい。落ちたのは component の markup を見ていた
 * 節だけで、その代わりに「ページに戻っていないこと」を見る節が入っている。
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
    // 描画する側が居なくなっても `publicPrUrl` は残す。Case Study 側がこの
    // data を描くときに通る道で、literal を書いてよい理由にはならない。
    for (const [name, component] of [
      ['ScrollToTop.astro', TOP_COMPONENT],
      ['how-i-build.astro', PAGE],
    ] as const) {
      assert.equal(
        /href=["'`]https:\/\/github\.com/.test(component),
        false,
        `${name} が GitHub の URL を直書きしている`,
      );
    }
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

  it('残った component も日本語ラベルを直書きしていない — registry 経由で出る', () => {
    assert.equal(AI_ORIGIN.test(METHOD_COMPONENT.replace(/\/\*[\s\S]*?\*\//g, '')), false);
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
 * #31 が期待した形は h1 HOW I BUILD → h2 開発の前提 → h2 判断事例 → h3 x3 で、
 * そのうち下 2 段はこのページから外れた。残るのは 2 つで、内訳は変わっていない:
 *
 *   h1 HOW I BUILD
 *   └─ h2 開発の前提
 *
 * 「開発の前提」が実 h2 であること——`<h4 aria-level="2">` ではないこと——が
 * #31 の決定で、節が減ってもそこは動かない。描画後の実レベルは
 * `check:structure` の HOW_OUTLINE が dist に対して数える。ここで見るのは
 * source 側の契約である。
 */
describe('#31 見出し階層 — 開発の前提は実 h2 である', () => {
  it('「開発の前提」が実 h2 として出る', () => {
    assert.match(METHOD_MARKUP, /<h2 aria-level=\{heading \? 3 : undefined\}>\{ui\.howIBuild\.premises\}<\/h2>/);
    // 見た目は変えない: `.premise h2` が mono 10.5px を宣言し直しているので
    // `.ad h2` の 40px display は当たらない。
    const css = src('styles/components.css');
    assert.match(css, /\.ad \.premise h2\{font-family:var\(--f-mono\);font-size:10\.5px/);
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

/**
 * /how-i-build/ の責務 — 「どう作るか」だけを置く。
 *
 * 判断事例と QA / 検証記録がこのページから外れた理由は、内容が間違っていた
 * からではない。名指しの 2 PR について「なぜその判断か」を述べる節で、それは
 * 3 枚のページのうち Case Study の問いだった——/work/ 何を作ったか、
 * /how-i-build/ どう作るか、各 Case Study なぜその設計・技術判断をしたか。
 * 2 枚目に置けば、読者は判断を当てる先の案件を手に持たないまま読むことになる。
 *
 * ここで見るのは 2 つ。**残すべきものが残っていること**——工程・役割・intent・
 * 前提は 1 つも落ちていない——と、**戻っていないこと**。戻り方で現実的なのは
 * component を消したことではなく、data が残っているので誰かが同じ節を書き直す
 * ほうで、その番人は `check:structure` の HOW_NO_CASE_DEPTH（全公開ルートを
 * 見る）である。こちらは source 側、つまり page が何を import しているかを見る。
 */
describe('/how-i-build/ の責務 — 開発プロセスだけを置く', () => {
  it('工程・役割・intent・前提はどれも落ちていない', () => {
    // #31 §2 / §13 が触らないと決めた 3 つと、#31 が置き換えた前提。節を
    // 減らした側の変更で、残すと決めたほうが一緒に消えていないかを見る。
    assert.equal(h.workflow.length, 8);
    assert.equal(h.roles.length, 3);
    assert.equal(h.intent.length, 3);
    assert.equal(h.premises.length, 2);
    assert.match(PAGE_MARKUP, /<HowIBuild heading=\{false\} \/>/);
    assert.match(PAGE_MARKUP, /<ScrollToTop \/>/);
    assert.ok(PAGE_MARKUP.indexOf('<Footer') > PAGE_MARKUP.indexOf('<HowIBuild '));
  });

  it('判断事例 / QA の節を page が描いていない', () => {
    for (const tag of ['HowIBuildCases', 'HowIBuildQaRecord']) {
      assert.equal(PAGE.includes(`<${tag} />`), false, `${tag} が page に戻っている`);
      assert.equal(
        new RegExp(`^import ${tag} `, 'm').test(PAGE),
        false,
        `${tag} を import したままになっている`,
      );
    }
  });

  it('component file 自体が残っていない — 描かれない component は死蔵である', () => {
    // data と違って、component は Case Study が使うものではない。あちらは
    // Case Study の markup で描く。`HowIBuild*` という名前の file が残って
    // いれば、それは「いつでも戻せる状態」であって削除ではない。
    const dir = readdirSync(new URL('../src/components/home/', import.meta.url));
    for (const gone of ['HowIBuildCases.astro', 'HowIBuildQaRecord.astro']) {
      assert.equal(dir.includes(gone), false, `${gone} が残っている`);
    }
    assert.ok(dir.includes('HowIBuild.astro'), '工程表の component まで消えている');
  });

  it('data と承認記録は消していない — Case Study 側が描く素材である', () => {
    // 「描画していない」と「登録していない」は別の状態である（/work/ の index が
    // 自分の rail copy について記録しているのと同じ区別）。ここを緩めると、
    // 節を消すたびに承認済みの公開内容が一緒に落ちる運用になる。
    assert.equal(cases.length, 2);
    assert.ok(qa.facts.length > 0);
    for (const key of ['casesLabel', 'casesLead', 'caseProblem', 'caseVerification', 'qaLabel'] as const) {
      assert.ok((ui.howIBuild[key] as string).length > 0, `ui.howIBuild.${key} が消えている`);
    }
  });
});
