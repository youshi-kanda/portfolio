/**
 * #52 Phase 9-8 — secondary pages の「読めない」「意味が伝わりにくい」を直す。
 *
 * 三か所しか触っていないが、三つとも同じ壊れ方をしていた: 出ている文字が
 * 正しいことと、読者がそれを読めることは別の条件で、この repo の gate は
 * 前者しか見ていない。PPM の register は列見出しが無く `SYSTEM` が何の値か
 * 言えず、判断事例は見出しの次がいきなり case title で、QA の記録は 3 件目の
 * 事例として並んでいた。どれも Truth Gate は通る。
 *
 * ここで固定するのは、直したあとの構造が構造として残ることである。
 * 「読める」こと自体は測るしかなく、実測は `npm run qa` の外——viewport ごとの
 * geometry は PR に記録した——なので、このファイルが見るのはその実測を成り立た
 * せている条件のほうである: 専用 variant であること、列見出しが registry から
 * 出ること、折り返しの床が外れていないこと、QA が事例の外にいること。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { workVisual } from '../src/lib/content/derive.ts';
import { loadUiCopy, loadWorks } from '../src/lib/content/load.ts';
import { ui } from '../src/lib/content/ui.ts';

const src = (path: string): string =>
  readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');

const LEDGER = src('components/case/SpineLedger.astro');
const WALKTHROUGH = src('components/case/SpineWalkthrough.astro');
const PIPELINE = src('components/case/SpinePipeline.astro');
const METHOD = src('components/home/HowIBuild.astro');
const CASES = src('components/home/HowIBuildCases.astro');
const QA = src('components/home/HowIBuildQaRecord.astro');
const COMPONENTS_CSS = src('styles/components.css');
const RESPONSIVE_CSS = src('styles/responsive.css');

/** Comments removed, so a rule this file EXPLAINS is not read as a rule it sets. */
const cssBody = (sheet: string): string => sheet.replace(/\/\*[\s\S]*?\*\//g, '');

const row = (path: string) => {
  const r = loadUiCopy().find((x) => x.path === path);
  assert.ok(r, `ui.${path} の行が copy inventory に無い`);
  return r;
};

/** The approval this change's new strings ship under — one comment, one event. */
const APPROVED_AT = '2026-09-23T07:42:28Z';
const APPROVAL_COMMENT = '5791022793';

describe('#52 PPM ledger — 列の意味が画面に出ている', () => {
  it('ledger だけが専用 variant を名乗る', () => {
    assert.match(LEDGER, /class="flow flow-ledger"/);
    // 他の 2 変種には出さない。`.flow` は共有の道具で、PPM の都合で
    // HOW I BUILD の工程表や CRM の walkthrough を動かさない。
    assert.equal(WALKTHROUGH.includes('flow-ledger'), false);
    assert.equal(PIPELINE.includes('flow-ledger'), false);
    assert.equal(METHOD.includes('flow-ledger'), false);
  });

  it('列見出しが 5 つ、行と同じ順で DOM にある', () => {
    const head = LEDGER.slice(LEDGER.indexOf('<div class="fhd">'), LEDGER.indexOf('</div>', LEDGER.indexOf('<div class="fhd">')));
    const classes = [...head.matchAll(/<span class="([kn od g]+)"/g)].map((m) => m[1]);
    assert.deepEqual(classes, ['k', 'n', 'o', 'd', 'g']);
    // 行側も同じ順である。読み上げ順は STEP → 処理 → 実行主体 → 内容 → ゲート。
    const body = LEDGER.slice(LEDGER.indexOf('caseStudy.flow.map'));
    const rowClasses = [...body.matchAll(/<span class="(?:\{[^}]*\}|)?([kn od g]+)"/g)].map((m) => m[1]);
    assert.deepEqual(rowClasses.slice(0, 4), ['k', 'n', 'o', 'd']);
    assert.match(body, /class="g"/);
  });

  it('見出しの語は registry から出る — component に直書きしない', () => {
    assert.match(LEDGER, /ui\.caseStudy\.ledgerHeaders/);
    for (const label of Object.values(ui.caseStudy.ledgerHeaders)) {
      assert.equal(LEDGER.includes(`>${label}<`), false, `${label} が直書きされている`);
    }
    assert.deepEqual(Object.values(ui.caseStudy.ledgerHeaders), [
      'STEP',
      '処理',
      '実行主体',
      '内容',
      'ゲート',
    ]);
  });

  it('5 語が本人承認として登録されている', () => {
    for (const key of ['step', 'name', 'owner', 'what', 'gate']) {
      const r = row(`caseStudy.ledgerHeaders.${key}`);
      const p = r.publication;
      assert.equal(p.reviewStatus, 'approved');
      assert.equal(p.claimType, 'presentation', '列の名前は世界について何も述べない');
      assert.equal(p.approvedBy, 'user');
      assert.equal(p.approvedAt, APPROVED_AT);
      assert.ok(
        p.sourceRefs.some((ref) => ref.includes(APPROVAL_COMMENT)),
        `caseStudy.ledgerHeaders.${key} が承認コメントを出所に挙げていない`,
      );
    }
  });

  it('ledger を描くのは PPM だけである', () => {
    // Case Study を持つ作品だけを見る。`caseVariant` は全作品が持つ既定値を
    // 返すので、掲載していない作品まで数えると「ledger は 5 件」になる。
    const ledgers = loadWorks()
      .filter((w) => w.caseStudyPublished)
      .filter((w) => workVisual(w).caseVariant === 'ledger')
      .map((w) => w.slug);
    assert.deepEqual(ledgers, ['ppm']);
    const others = loadWorks()
      .filter((w) => w.caseStudyPublished && w.slug !== 'ppm')
      .map((w) => workVisual(w).caseVariant);
    assert.equal(others.includes('ledger'), false, 'PPM 以外が ledger を描いている');
  });

  it('CSS が generic .flow を書き換えていない — 規則はすべて variant 付き', () => {
    for (const sheet of [COMPONENTS_CSS, RESPONSIVE_CSS]) {
      for (const [selector] of cssBody(sheet).matchAll(/([^{}]*\.flow-ledger[^{}]*)\{/g)) {
        assert.match(
          selector,
          /\.flow-ledger/,
          `variant を条件にしない規則が ledger 用に書かれている: ${selector.trim()}`,
        );
      }
    }
    // 逆向き: generic `.flow` の規則が 1 つも増減していないこと。増えていれば
    // PPM の都合が、HOW I BUILD と CRM が共有している道具へ漏れている。
    const generic = [...cssBody(COMPONENTS_CSS).matchAll(/\.ad \.flow(?!-ledger)[^{,]*\{/g)].map(
      (m) => m[0],
    );
    assert.deepEqual(generic, [
      '.ad .flow{',
      '.ad .flow .fst{',
      '.ad .flow .fst.gate{',
      '.ad .flow .k{',
      '.ad .flow .n{',
      '.ad .flow .o{',
      '.ad .flow .o[data-r="human"]{',
      '.ad .flow .d{',
      '.ad .flow .g{',
    ]);
  });

  it('gate は字を小さくして収めていない — 5 列は幅で解いている', () => {
    const body = cssBody(COMPONENTS_CSS);
    // variant 側に font-size の宣言が 1 つも無いこと。「入らないから縮める」は
    // この Issue が名指しで禁じた解き方である。
    const variantRules = [...body.matchAll(/\.ad \.flow-ledger[^{]*\{([^}]*)\}/g)].map((m) => m[1] ?? '');
    const gateRule = [...body.matchAll(/\.ad \.flow-ledger \.g\{([^}]*)\}/g)].map((m) => m[1] ?? '');
    for (const decl of gateRule) {
      assert.equal(/font-size/.test(decl), false, 'gate の字を小さくして収めている');
    }
    // 見出し自身は instrument の 10.5px で、行の `.o` / `.g` と同じ大きさ。
    assert.ok(variantRules.some((d) => /font-size:10\.5px/.test(d)), '見出しが instrument size ではない');
    // ゲート列は generic の 132px より広い。実測 100.8px / 95.8px の gate が
    // 通常サイズのまま 1 行に載る幅である。
    const tracks = /\.ad \.flow-ledger \.fst\{grid-template-columns:([^;}]*)/.exec(body);
    assert.ok(tracks, 'ledger の track 宣言が無い');
    assert.match(tracks[1] ?? '', /minmax\(0,156px\)\s*$/);
    // 折り返しの床。長い refusal が来た日にページの外へ出さない。
    assert.ok(gateRule.some((d) => /overflow-wrap:anywhere/.test(d)));
  });

  it('狭い幅では 5 列を捨てて縦に積む — 見出しは残す', () => {
    const body = cssBody(RESPONSIVE_CSS);
    const at = body.indexOf('.ad .flow-ledger .fst{grid-template-columns:52px minmax(0,1fr)');
    assert.ok(at > 0, 'ledger の stack 規則が無い');
    // その規則を抱えている media query が 1279 であること（generic の 767 では
    // なく、この register 自身の内容が要求する幅）。
    const media = body.lastIndexOf('@media', at);
    assert.match(body.slice(media, at), /max-width:1279px/);
    // 見出しは display:none にしない。列が無くなっても「各行が何を述べるか」は
    // 読み上げからも画面からも消さない。
    const block = body.slice(at, body.indexOf('}\n}', at));
    assert.match(block, /\.ad \.flow-ledger \.fhd\{display:flex/);
    assert.equal(/\.fhd\{[^}]*display:none/.test(block), false, '見出しを消している');
  });
});

describe('#52 判断事例の導入文 — 本人承認の 1 文', () => {
  const LEAD = '実装中に起きた問題を、何を確認し、どう判断し、どう検証したかで示します。';

  it('文面が承認されたとおりである', () => {
    assert.equal(ui.howIBuild.casesLead, LEAD);
    assert.equal(row('howIBuild.casesLead').text, LEAD);
  });

  it('registry 行が承認者と出所を持つ', () => {
    const p = row('howIBuild.casesLead').publication;
    assert.equal(p.reviewStatus, 'approved');
    assert.equal(p.sourceType, 'authored');
    // 実績の主張ではない、と本人が comment で位置づけている。
    assert.equal(p.claimType, 'presentation');
    assert.equal(p.approvedBy, 'user');
    assert.equal(p.approvedAt, APPROVED_AT);
    assert.ok(p.sourceRefs.some((ref) => ref.includes(APPROVAL_COMMENT)));
    assert.equal(row('howIBuild.casesLead').kind, 'editorial');
  });

  it('見出しの直後、最初の事例より前に 1 回だけ出る', () => {
    assert.equal([...CASES.matchAll(/class="dc-lead"/g)].length, 1);
    const head = CASES.indexOf('id={HEADING_ID}');
    const lead = CASES.indexOf('class="dc-lead"');
    const first = CASES.indexOf('cases.map(');
    assert.ok(head < lead && lead < first, '導入文が見出しと最初の事例の間に無い');
    assert.match(CASES, /<p class="dc-lead">\{ui\.howIBuild\.casesLead\}<\/p>/);
  });

  it('何も新しく主張していない — 数量も全称も無い', () => {
    // claims.ts の W-CLAIM-SUSPECT が見ている形。presentation を名乗る文が
    // 照合できる主張を含んでいれば、根拠なしに事実が出ていることになる。
    assert.equal(/(?<![0-9A-Za-z_])\d+\s*(件|作品|本|回|人|枚|%|passed|tests|steps)/.test(LEAD), false);
    assert.equal(/(すべて|全て|全部|常に|必ず|一切|唯一|最も|最大|最小|初めて)/.test(LEAD), false);
    // 述べているのは下の 5 欄の順序だけである。
    for (const field of ['確認', '判断', '検証']) assert.ok(LEAD.includes(field));
  });

  it('QA 側には導入文を足していない — 既存の summary が既に説明である', () => {
    assert.equal(QA.includes('dc-lead'), false);
    assert.equal(QA.includes('casesLead'), false);
  });
});

describe('#52 判断事例タイトルの文字組み', () => {
  it('.dc-t が keep-all と overflow-wrap の対で組まれている', () => {
    const body = cssBody(COMPONENTS_CSS);
    const rule = /\.ad \.dc-t\{([^}]*)\}/.exec(body);
    assert.ok(rule, '.dc-t の規則が無い');
    const decl = rule[1] ?? '';
    // keep-all だけでは、句読点の無い長い run が来た日にページの外へ出る。
    // overflow-wrap だけでは、デプロ / イ の分割が戻る。対で 1 つの規則である。
    assert.match(decl, /word-break:keep-all/);
    assert.match(decl, /overflow-wrap:anywhere/);
    assert.match(decl, /max-width:30ch/);
  });

  it('本文に手作業の改行も不可視文字も埋めていない', () => {
    // 折り返しは CSS が決める。`<br>` を 1 本入れれば見た目はその場で直るが、
    // 直っているのはその 1 幅だけで、他のすべての幅で改行が増える。NBSP と
    // zero-width は、直したことが diff にも画面にも残らないぶん更に悪い。
    const raw = readFileSync(new URL('../src/content/site.json', import.meta.url), 'utf8');
    for (const bad of ['<br', ' ', '​', '⁠', '&nbsp;']) {
      assert.equal(raw.includes(bad), false, `site.json に ${JSON.stringify(bad)} が埋め込まれている`);
    }
  });
});
