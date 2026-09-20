/**
 * #32 Phase 9-4 — ABOUT の業務経験と公開境界。
 *
 * この Issue が動かしたのは文章ではなく読み順である。ABOUT は
 * `now` 3 文 + 注意書き 3 行という形で、3 行はどれも「これは本物ではない」を
 * 別の言い方で述べていた。読み手は予防線を 3 本読んでから何も知らずに去り、
 * 本人の業務背景はサイトのどこにも無かった。
 *
 * だから守るものが 3 種類ある。
 *
 *   1. 承認された文言と一致していること。本文 3 件・ラベル 3 件が、本人が
 *      Issue #32 comment 5748161578 で確定した文字列そのままであること。
 *   2. 旧文言が公開面のどこにも残っていないこと。退役した文は有効な文であり、
 *      承認も受けていて、件数も合う——だからどの gate も気づかない。
 *   3. 追加していないものを追加していないこと。年数・勤務先名・顧客名、
 *      そして #29 の metadata と矛盾する分類語。
 *
 * 見ているのは DATA / REGISTRY / COMPONENT SOURCE である。描画された HTML 側の
 * 件数と読み順（ABOUT_EXPERIENCE / ABOUT_DISCLOSURE_ROWS / ABOUT_RETIRED_COPY /
 * ABOUT_ORDER / ABOUT_NO_TENURE）は `check:structure` が dist に対して持って
 * いる——`npm run qa` は test を build より先に走らせるので、ここで dist を
 * 読めば前回のビルドを検査することになりうる。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { APPROVED_TEXT, APPROVAL_BATCHES } from '../src/lib/content/approved-text.ts';
import { loadCopy, loadUiCopy, loadWorks } from '../src/lib/content/load.ts';
import { site, siteStrings } from '../src/lib/content/site.ts';
import { ui, uiStrings, uiText } from '../src/lib/content/ui.ts';

const a = site.about;
const ABOUT_COMPONENT = readFileSync(
  new URL('../src/components/home/About.astro', import.meta.url),
  'utf8',
);

const APPROVED_AT = '2026-09-20T06:35:42Z';
/**
 * `home.about.disclosure` の訂正。同じ PR のレビュー中の別の occasion である。
 *
 * 旧文の 2 文目「担当範囲と到達状態は作品ごとに記載しています。」は、到達状態が
 * どの公開ページにも出ていないため成り立たなかった。本人は公開 UI を足す側では
 * なく、文を現在の公開面で確認できる範囲へ狭める側を選んでいる
 * （Issue #32 comment 5749023659）。
 */
const DISCLOSURE_APPROVED_AT = '2026-09-20T09:43:50Z';

/** どの文がどの occasion で承認されたか。id が 1 つの機会にだけ属する。 */
const APPROVAL_OF: Readonly<Record<string, { at: string; comment: string }>> = {
  'home.about.experience': { at: APPROVED_AT, comment: '5748161578' },
  'home.about.disclosure': { at: DISCLOSURE_APPROVED_AT, comment: '5749023659' },
  'home.about.syntheticData': { at: APPROVED_AT, comment: '5748161578' },
};

/** 本人承認コメントの文言そのまま（Issue #32 comment 5748161578）。 */
const BODY: Readonly<Record<string, string>> = {
  'home.about.experience':
    '製造現場から営業までの業務経験を通じ、業務フローを理解したうえで課題を整理し、システムへ落とし込むことを大切にしています。',
  'home.about.disclosure':
    '公開している作品には、共同プロジェクトを公開用に再構成したもの、個人開発の技術デモ、自主開発のPoCが含まれます。',
  'home.about.syntheticData': '掲載画面では実顧客情報を公開せず、合成データを使用しています。',
};

/** 同じコメントで指定された公開ラベル 3 語。 */
const LABEL: Readonly<Record<string, string>> = {
  'ui.about.experienceLabel': '業務経験',
  'ui.about.disclosureLabel': '掲載内容について',
  'ui.about.dataLabel': '公開データ',
};

/**
 * 退役した公開文言。どれも出荷文字列のどこにも残っていてはならない。
 *
 * 最初の 3 件は ABOUT が終わっていた旧 `known` の行。4 件目だけ性格が違い、
 * この BRANCH が一度承認して書いた文である——同じ PR のレビューで本人が
 * 2 文目を落とした。現在の文は旧文の PREFIX なので、包含は正しい向きにしか
 * 当たらない: 新しい文だけが出ていれば旧文は含まれず、旧文が戻れば当たる。
 */
const RETIRED = [
  '個人開発。AI CRM Demo は画面・API・データベース・AI 呼び出し・権限・テストまで 1 人で実装している。',
  '私的に開発中のプロダクトから公開可能な範囲を切り出したもの。外部配信・代理店管理・本番インフラは含めていない。',
  '掲載している画面はすべて合成データ。実顧客・実案件・本番運用の記録ではない。',
  '担当範囲と到達状態は作品ごとに記載しています。',
];

/** 旧 disclosure の全文。退役した 2 文構成そのもの。 */
const RETIRED_DISCLOSURE =
  '公開している作品には、共同プロジェクトを公開用に再構成したもの、個人開発の技術デモ、自主開発のPoCが含まれます。担当範囲と到達状態は作品ごとに記載しています。';

const shippingStrings = (): { where: string; text: string }[] => [
  ...siteStrings().map((s) => ({ where: `site.${s.path}`, text: s.text })),
  ...uiStrings().map((s) => ({ where: `ui.${s.path}`, text: s.text })),
  ...loadCopy().map((c) => ({ where: `copy/${c.id}`, text: c.text })),
  ...loadUiCopy().map((c) => ({ where: `copy/${c.id}`, text: c.text })),
];

/** ABOUT が #32 で追加した 6 件だけ — 不変を見る側と混ぜない。 */
const NEW_ABOUT_STRINGS = [...Object.values(BODY), ...Object.values(LABEL)];

describe('#32 ABOUT — 注意書き 3 行から、業務背景と公開境界へ', () => {
  it('section content は 1 件の profile fact と 2 件の公開境界を、id で持つ', () => {
    assert.equal(a.profile.length, 1);
    assert.equal(a.disclosure.length, 2);
    assert.equal('known' in a, false, 'known が schema に残っている');

    assert.deepEqual(
      a.profile.map((b) => [b.id, b.labelId, b.copyId]),
      [['experience', 'ui.about.experienceLabel', 'home.about.experience']],
    );
    assert.deepEqual(
      a.disclosure.map((b) => [b.id, b.labelId, b.copyId]),
      [
        ['published-work', 'ui.about.disclosureLabel', 'home.about.disclosure'],
        ['synthetic-data', 'ui.about.dataLabel', 'home.about.syntheticData'],
      ],
    );
  });

  it('本人承認済みの本文 3 件が完全一致で registry にある', () => {
    const rows = loadCopy();
    for (const [id, text] of Object.entries(BODY)) {
      const row = rows.find((r) => r.id === id);
      assert.ok(row, `${id} が shipping registry に無い`);
      assert.equal(row.text, text, `${id} の文言が承認済みの文と違う`);
      assert.equal(APPROVED_TEXT[id], text, `${id} が承認スナップショットと違う`);
    }
  });

  it('本人指定の公開ラベル 3 語が完全一致で ui registry にある', () => {
    assert.equal(ui.about.experienceLabel, LABEL['ui.about.experienceLabel']);
    assert.equal(ui.about.disclosureLabel, LABEL['ui.about.disclosureLabel']);
    assert.equal(ui.about.dataLabel, LABEL['ui.about.dataLabel']);

    const rows = loadUiCopy();
    for (const [id, text] of Object.entries(LABEL)) {
      const row = rows.find((r) => r.id === id);
      assert.ok(row, `${id} が ui registry に無い`);
      assert.equal(row.text, text, `${id} のラベルが承認済みの語と違う`);
      // 描画側が読む値と registry の値が同じ id で解決できること。ここが
      // 割れていると U-DRIFT 側でも見えるが、ABOUT の 3 件は id 経由で
      // 引かれるので、参照が通ること自体を見ておく。
      assert.equal(uiText(id), text);
      assert.equal(row.publication.claimType, 'presentation');
      assert.equal(row.publication.sourceType, 'authored');
      assert.equal(row.publication.reviewStatus, 'approved');
      assert.equal(row.publication.approvedBy, 'user');
      assert.equal(row.publication.approvedAt, APPROVED_AT);
    }
  });

  it('業務経験は user-fact として、値と承認者を持つ', () => {
    // 本人しか Authority を持たない経歴である（content-model §5 が
    // 経歴・稼働条件・料金・連絡先を user-fact と定義している）。matrix は
    // user-fact に「空でない値」と「承認者」を求める——もっともらしい値で
    // 埋めることを拒否する組み合わせがこれである。
    const row = loadCopy().find((r) => r.id === 'home.about.experience')!;
    assert.equal(row.publication.claimType, 'fact');
    assert.equal(row.publication.sourceType, 'user-fact');
    assert.equal(row.publication.reviewStatus, 'approved');
    assert.equal(row.publication.approvedBy, 'user');
    assert.equal(row.publication.approvedAt, APPROVED_AT);
    assert.ok(row.text.trim().length > 0);
    // HD-C と承認コメントの両方を挙げていること。
    assert.ok(row.publication.sourceRefs.some((r) => r.includes('5748116465')), 'HD-C が無い');
    assert.ok(row.publication.sourceRefs.some((r) => r.includes('5748161578')), '承認記録が無い');
  });

  it('公開境界の 2 文は authored fact として、根拠と承認者を持つ', () => {
    const rows = loadCopy();
    for (const id of ['home.about.disclosure', 'home.about.syntheticData']) {
      const p = rows.find((r) => r.id === id)!.publication;
      const approval = APPROVAL_OF[id]!;
      assert.equal(p.claimType, 'fact');
      assert.equal(p.sourceType, 'authored');
      assert.equal(p.reviewStatus, 'approved');
      assert.equal(p.approvedBy, 'user');
      assert.equal(p.approvedAt, approval.at);
      assert.ok(p.sourceRefs.length > 0, `${id} に根拠が無い`);
      assert.ok(
        p.sourceRefs.some((r) => r.includes(approval.comment)),
        `${id} が現在の文を承認したコメントを挙げていない`,
      );
    }

    // 掲載内容の basis は #29 の本人確認済み metadata である。
    const disclosure = rows.find((r) => r.id === 'home.about.disclosure')!;
    assert.ok(
      disclosure.publication.sourceRefs.some((r) => r.includes('5742687087')),
      '#29 の本人確認記録を根拠に挙げていない',
    );
    // 公開データは旧 about 行が持っていた README / PUBLISH-MAP の根拠を失わない。
    const synthetic = rows.find((r) => r.id === 'home.about.syntheticData')!;
    assert.ok(
      synthetic.publication.sourceRefs.some((r) => r.includes('PUBLISH-MAP')),
      '旧 データ 行の根拠（README / PUBLISH-MAP）が引き継がれていない',
    );
  });

  it('section content 側も、ブロックごとに空でない出所を持つ', () => {
    // 旧 `known` が `sourceRef` を必須にしていた契約はそのまま。本文が
    // registry へ移っても、「この節が何を根拠に何を出しているか」は節の側の
    // 記録である。
    for (const block of [...a.profile, ...a.disclosure]) {
      assert.ok(block.sourceRefs.length > 0, `${block.id} に sourceRefs が無い`);
      for (const ref of block.sourceRefs) {
        assert.ok(ref.trim().length > 0, `${block.id} に空の sourceRef がある`);
      }
      const approval = APPROVAL_OF[block.copyId]!;
      assert.ok(
        block.sourceRefs.some((r) => r.includes(approval.comment)),
        `${block.id} が現在の文を承認したコメントを挙げていない`,
      );
    }
  });

  it('承認バッチが 2 つの occasion に分かれ、id はそれぞれ 1 つにだけ属する', () => {
    // 06:35:42Z の機会が 5 件。`home.about.disclosure` はここを離れている——
    // 同じ PR のレビュー中に文が短くなり、このバッチが承認した 2 文構成は
    // もうサイトに無いからである。
    const batch = APPROVAL_BATCHES.find((b) => b.ids.includes('home.about.experience'));
    assert.ok(batch);
    assert.equal(batch.by, 'user');
    assert.equal(batch.at, APPROVED_AT);
    assert.deepEqual([...batch.ids], [
      'home.about.experience',
      'home.about.syntheticData',
      ...Object.keys(LABEL),
    ]);
    assert.match(batch.task, /Issue #32 comment 5748161578/);
    assert.equal(
      batch.ids.includes('home.about.disclosure'),
      false,
      '訂正された文が旧バッチに残っている',
    );

    // 09:43:50Z の機会は 1 件だけ。
    const corrected = APPROVAL_BATCHES.find((b) => b.ids.includes('home.about.disclosure'));
    assert.ok(corrected);
    assert.equal(corrected.by, 'user');
    assert.equal(corrected.at, DISCLOSURE_APPROVED_AT);
    assert.deepEqual([...corrected.ids], ['home.about.disclosure']);
    assert.match(corrected.task, /Issue #32 comment 5749023659/);
    assert.notEqual(corrected.at, batch.at);

    // 1 approval occasion = 1 batch。#31 のバッチは同じ日の 1 時間前で、
    // ABOUT の文は含まない。
    const premises = APPROVAL_BATCHES.find((b) => b.ids.includes('method.premise.01'))!;
    assert.notEqual(batch.at, premises.at);
    for (const id of [...Object.keys(BODY), ...Object.keys(LABEL)]) {
      const owners = APPROVAL_BATCHES.filter((b) => b.ids.includes(id));
      assert.equal(owners.length, 1, `${id} が 2 つ以上のバッチにある`);
    }
  });

  it('退役した本文が、出荷文字列のどこにも残っていない', () => {
    const offenders = shippingStrings().filter((s) => RETIRED.some((r) => s.text.includes(r)));
    assert.deepEqual(offenders.map((s) => `${s.where}: ${s.text}`), []);
    // 旧 disclosure は全文でも見る。断片（2 文目）と全文の両方を固定するのは、
    // 現在の文が旧文の PREFIX で、片方だけでは戻ってきた文を捕まえ損ねうるため。
    const full = shippingStrings().filter((s) => s.text.includes(RETIRED_DISCLOSURE));
    assert.deepEqual(full.map((s) => s.where), []);
  });

  it('旧文言を新しい承認 batch へ書き写していない', () => {
    // 退役した文が承認済みとして残るのが、いちばん静かな失敗である。旧文は
    // 有効で、かつて出ていて、件数も合う。
    for (const retired of [...RETIRED, RETIRED_DISCLOSURE]) {
      for (const [id, text] of Object.entries(APPROVED_TEXT)) {
        assert.notEqual(text, retired, `${id} が退役文言を承認済みとして持っている`);
        assert.equal(
          text.includes(retired),
          false,
          `${id} が退役文言を含んでいる`,
        );
      }
    }
  });

  it('公開境界は圧縮されても内容を失っていない', () => {
    // 3 行を 2 行にしたのは配置と密度の問題で、表明の削除ではない。
    // 合成データと、実顧客情報を公開しないこと、そして公開範囲の説明が残る。
    const synthetic = BODY['home.about.syntheticData']!;
    assert.match(synthetic, /合成データ/);
    assert.match(synthetic, /実顧客情報を公開せず/);
    const disclosure = BODY['home.about.disclosure']!;
    assert.match(disclosure, /公開用に再構成/);
    // 「担当範囲と到達状態は作品ごとに記載しています。」は要求しない。到達状態は
    // 公開面に出ておらず、出ていないものを指して「記載しています」と言う文は
    // 公開境界の説明ではなく、確認できない主張だった。削除は内容の喪失ではない
    // ——掲載作品が何であるかは 1 文目がそのまま述べている。
    assert.doesNotMatch(disclosure, /到達状態/);
  });

  it('年数表現を ABOUT の新規 copy に入れていない', () => {
    // HD-C の決定。「製造業で約 12 年間」も「12 年」も出さない。数字 + 年 の
    // 形そのものを見るので、書き方を変えれば通るものではない。
    for (const text of NEW_ABOUT_STRINGS) {
      assert.doesNotMatch(text, /(?<![0-9A-Za-z_])(約\s*)?\d+\s*(年間|年|ヶ月|か月)/, text);
      assert.equal(text.includes('12年'), false, text);
      assert.equal(text.includes('約12'), false, text);
      assert.equal(text.includes('約 12'), false, text);
    }
  });

  it('勤務先名・顧客名・発注元名・取引先名を追加していない', () => {
    // #29 が定めた規則（origin project の label は一般名詞のみ）を ABOUT 側にも
    // 当てる。ここで見るのは「会社名の形をした語を足していないか」である:
    // 株式会社・有限会社・法人接尾辞、そして「様」付きの呼称。
    for (const text of NEW_ABOUT_STRINGS) {
      assert.doesNotMatch(text, /(株式会社|有限会社|合同会社|Inc\.|Ltd\.|LLC|Corp\.)/, text);
      assert.doesNotMatch(text, /(取引先|発注元|顧客名|クライアント名)/, text);
      assert.doesNotMatch(text, /[^\s]{2,}様/, text);
    }
  });

  it('掲載内容の分類語が #29 の本人確認済み metadata と一致している', () => {
    // 文が挙げる 3 種は、実際に作品レコードが持っている組み合わせである。
    // 語の側も #29 の対応表（`ui.work.profileLabels`）から来ていて、ABOUT の
    // ために新しい軸を作っていない。
    const text = BODY['home.about.disclosure']!;

    // #29 の表示語そのもの。ABOUT のためにこの対応表を触っていないことと、
    // 触られたらここが落ちることの両方を見る——語が変わったなら ABOUT の文も
    // 読み直す必要がある。
    assert.deepEqual(ui.work.profileLabels, {
      personal: '個人開発',
      collaborative: '共同プロジェクト',
      'public-reconstruction': '公開用再構成',
      'technical-demo': '技術デモ',
    });

    // 文の中での現れ方。`公開用再構成` は名詞としての欄の値で、文中では
    // 「公開用に再構成したもの」という動詞句になる——同じ語であって、
    // 新しい分類語ではない。
    for (const word of [
      '共同プロジェクト',
      '公開用に再構成',
      '個人開発',
      '技術デモ',
      '自主開発',
      'PoC',
    ]) {
      assert.ok(text.includes(word), `${word} が掲載内容の文に無い`);
    }

    const profiles = loadWorks().map((w) => w.portfolioProfile);
    const has = (
      context: string,
      form?: string,
      status?: string,
    ): boolean =>
      profiles.some(
        (p) =>
          p.developmentContext === context &&
          (form === undefined || p.portfolioForm === form) &&
          (status === undefined || p.implementationStatus === status),
      );
    // 共同プロジェクトを公開用に再構成したもの
    assert.ok(has('collaborative', 'public-reconstruction'), '該当する作品が無い');
    // 個人開発の技術デモ
    assert.ok(has('personal', 'technical-demo'), '該当する作品が無い');
    // 自主開発の PoC
    assert.ok(has('personal', undefined, 'poc'), '該当する作品が無い');
  });

  it('component は本文もラベルも直書きせず、id を registry で解決する', () => {
    // コメントを落としてから見る。この component の設計判断はコメントとして
    // 記録されていて、その説明の中にラベルの語が出る——「ラベルが値として
    // 書かれていないこと」を見たいので、散文と値を区別しない substring 検索を
    // そのまま当てると説明を書いた分だけ落ちる。
    const code = ABOUT_COMPONENT.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const text of NEW_ABOUT_STRINGS) {
      assert.equal(
        code.includes(text),
        false,
        `承認済みの文字列が component に直書きされている: ${text}`,
      );
    }
    // 本文はコメントの中にすら無い。ラベル 1 語と違って、承認済みの文を
    // 説明のために引用する理由が無く、引用すれば 2 か所目の正本になる。
    for (const text of Object.values(BODY)) {
      assert.equal(ABOUT_COMPONENT.includes(text), false, `本文が component にある: ${text}`);
    }
    assert.match(ABOUT_COMPONENT, /copyText\(block\.copyId\)/);
    assert.match(ABOUT_COMPONENT, /uiText\(block\.labelId\)/);
    assert.match(ABOUT_COMPONENT, /site\.about/);
  });

  it('site.json が本文の二重正本になっていない', () => {
    // schema は `.strict()` なので `value` / `text` を足せば parse が落ちる。
    // ここで見るのは実データの側——本文の断片が site.json のどこにも無いこと。
    const raw = readFileSync(new URL('../src/content/site.json', import.meta.url), 'utf8');
    for (const text of NEW_ABOUT_STRINGS) {
      assert.equal(raw.includes(text), false, `site.json が本文を持っている: ${text}`);
    }
    // そして registry 側が唯一の正本であること: 同じ文が 2 行にない。
    const rows = loadCopy();
    for (const text of Object.values(BODY)) {
      assert.equal(rows.filter((r) => r.text === text).length, 1, text);
    }
  });

  it('ABOUT 以外の承認済み公開文面を動かしていない', () => {
    // #32 の対象は ABOUT だけである。HERO / HOW I BUILD / h2 / now は不変。
    assert.equal(APPROVED_TEXT['home.hero.display.01'], '業務課題を、');
    assert.equal(APPROVED_TEXT['home.hero.display.02'], '業務で使える Web・AI システムへ。');
    assert.equal(
      APPROVED_TEXT['home.hero.lede'],
      '業務フローを整理し、画面・API・データ・AI・自動処理へ落とし込み、実際に運用できる仕組みとして設計・実装します。',
    );
    assert.equal(APPROVED_TEXT['home.hero.role.01'], 'ソフトウェアエンジニア');
    assert.equal(APPROVED_TEXT['home.hero.role.02'], '業務システム / AI 活用 / 業務自動化');
    assert.equal(APPROVED_TEXT['home.hero.cta.primary'], '実績を見る');
    assert.equal(APPROVED_TEXT['home.hero.cta.secondary'], '相談する');
    assert.equal(
      site.hero.stackLine,
      'Python / Django · TypeScript / React · Google Apps Script · Node.js',
    );

    assert.equal(
      APPROVED_TEXT['home.about.h2'],
      '業務要件を整理し、設計から実装・運用まで形にする。',
    );
    assert.deepEqual(
      [...a.now],
      [
        '業務フローを整理し、必要な画面・API・データ構造・自動処理へ落とし込む開発をしています。',
        'AI は目的ではなく、検索・判断支援・自動化など、業務に効果がある部分へ組み込みます。',
        '自動処理や AI に任せる範囲と、人が判断する範囲を分けて設計します。',
      ],
    );
    assert.deepEqual([...a.railLabels], ['ABOUT', 'Profile']);

    assert.equal(
      APPROVED_TEXT['method.premise.01'],
      'Human が調査・判断・検証を担当し、AI を設計・実装の支援に利用しています。',
    );
    assert.equal(
      APPROVED_TEXT['method.premise.02'],
      '現在の公開内容は、完全自動の Multi-Agent 開発や専用 Harness の構築済み運用を前提としたものではありません。',
    );
    assert.deepEqual([...site.howIBuild.premises], ['method.premise.01', 'method.premise.02']);
  });

  it('HOW I BUILD の役割と重複していない', () => {
    // ABOUT は業務背景と掲載内容、HOW I BUILD は人と AI の境界。同じ内容を
    // 2 か所で長文化しないための、いちばん単純な確認: ABOUT の新しい本文が
    // HOW I BUILD の語を持ち出していない。
    for (const text of Object.values(BODY)) {
      for (const word of ['Multi-Agent', 'Harness', 'ChatGPT', 'Claude Code', 'Human Decision']) {
        assert.equal(text.includes(word), false, `${word} は HOW I BUILD の語である`);
      }
    }
  });
});
