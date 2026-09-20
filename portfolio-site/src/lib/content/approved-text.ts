/**
 * The approved shipping copy, frozen at the moment of approval.
 *
 * This is not documentation. `approved-copy.ts` compares every string in the
 * `copy` collection against this snapshot on every production build: an
 * approval covers the sentence the user read, not the slot it sat in, so a
 * later edit to an approved string invalidates its approval and must fail the
 * build rather than ship under an approval record that no longer applies.
 *
 * Changing an approved string means recording a NEW approval here, on purpose.
 *
 * Migrated verbatim from portfolio-planning positioning.APPROVALS
 * (TASK-PORTFOLIO-CONTENT-APPROVE-01).
 */

/**
 * When each string was approved, and by whom.
 *
 * There is more than one approval event now, so a single APPROVED_AT constant
 * would have to be either wrong for one batch or vague about both. Every id in
 * `APPROVED_TEXT` belongs to exactly one batch below, and `approvedCopyGate`
 * holds each registry row's own `approvedBy` / `approvedAt` against the batch
 * that lists it (`A-BATCH`). That is what makes the per-row approval record a
 * fact the build checks rather than two fields somebody typed.
 *
 * ONE BATCH PER ID, INCLUDING AFTER A REWORD. A batch lists the ids whose
 * CURRENT approved text was approved at that event. When a string is reworded
 * and re-approved, its id moves to the new batch rather than being listed in
 * both — the snapshot holds one text per id, and an id in two batches would
 * leave no way to say which of the two events approved the text that ships.
 * The batch a reworded id leaves is not falsified by the move: the sentence it
 * approved is no longer on the site.
 */
export interface ApprovalBatch {
  /** The task in which the user read these strings and approved them. */
  task: string;
  by: string;
  /** ISO 8601, UTC. */
  at: string;
  ids: readonly string[];
}

export const APPROVAL_BATCHES: readonly ApprovalBatch[] = Object.freeze([
  Object.freeze({
    task: 'TASK-PORTFOLIO-CONTENT-APPROVE-01',
    by: 'user',
    at: '2026-08-28T21:20:25Z',
    ids: Object.freeze([
      'home.hero.role.01',
      'home.works.h2',
      'home.stack.h2',
      'home.stack.lede',
      'home.stack.note',
    ]),
  }),
  Object.freeze({
    task: 'TASK-PORTFOLIO-RELEASE-CLOSEOUT-01',
    by: 'user',
    at: '2026-08-29T06:10:37Z',
    ids: Object.freeze([
      'notfound.code',
      'notfound.h1',
      'notfound.body.01',
      'notfound.body.02',
      'notfound.back',
    ]),
  }),
  /**
   * V4 Phase 3. The hero and the work lede were rewritten, and the capability
   * rail changed axis: 設計 / 実装 / 検証 named the stages of a process, and
   * V4 names what the engineer can do. Six of these ids held approved text
   * before and moved here with their new sentences; the six capability rows
   * are new, and replace two authored rows in `site.json` plus one row the
   * homepage computed from the work list.
   */
  Object.freeze({
    task: 'TASK-PORTFOLIO-V4-COPY-APPROVE-01',
    by: 'user',
    at: '2026-09-07T22:24:15Z',
    ids: Object.freeze([
      'home.hero.capability.01.key',
      'home.hero.capability.01.value',
      'home.hero.capability.02.key',
      'home.hero.capability.02.value',
      'home.hero.capability.03.key',
      'home.hero.capability.03.value',
    ]),
  }),
  /**
   * The work lede, re-approved on its own. The V4 sentence named two forms of
   * work the register would hold — a public demo, and a case study with a
   * limited disclosure scope — and only the first of them ships. Shipping copy
   * has to be true of what ships today, not of what ships next, so the sentence
   * dropped the enumeration and says only what every entry shows.
   */
  Object.freeze({
    task: 'TASK-PORTFOLIO-V4-COPY-APPROVE-02',
    by: 'user',
    at: '2026-09-09T10:05:34Z',
    ids: Object.freeze(['home.works.lede']),
  }),
  /**
   * Issue #6 — the Home IA / Content Specification, reviewed over three rounds
   * and merged as PR #15. The hero was rewritten there and the two CTAs were
   * specified there, so this batch is the approval event for both.
   *
   * The display lost a line: three became two, and `home.hero.display.03` left
   * the registry with the sentence it held. The wording changed for a reason
   * recorded in the spec (§4.1) — 「実際に使われる」 implies works in live
   * use, and this site claims no operating status anywhere else, so the
   * strongest claim on the page would have been the one nobody can source.
   * 「業務で使える」 is fitness, not track record.
   *
   * The timestamp is PR #15's actual merge time as GitHub records it, not a
   * rounded stand-in. An approval record with a tidy 00:00:00 in it is a
   * record nobody checked against anything.
   */
  Object.freeze({
    task: 'ISSUE-6-HOME-IA-CONTENT-SPEC',
    by: 'user',
    at: '2026-09-13T00:13:13Z',
    ids: Object.freeze([
      'home.hero.display.01',
      'home.hero.display.02',
      'home.hero.lede',
      'home.hero.role.02',
      'home.hero.cta.primary',
      'home.hero.cta.secondary',
    ]),
  }),
  /**
   * Issue #8 — the public-copy pass, approved on PR #17.
   *
   * WHERE THE TIMESTAMP COMES FROM, AND WHY IT MATTERS. `at` is the creation
   * time of PR #17 comment 5651891248, in which the owner listed these four
   * strings and adopted them as the PR's final wording. It is not the issue's
   * created_at, not a commit time, and not the moment this batch was typed.
   *
   * An earlier draft of #8 used Issue #8's created_at here. Nobody had approved
   * anything at that moment — the issue did not contain these sentences — so
   * the row asserted an event that never happened, in the table `A-BATCH` reads
   * to check exactly that. It was withdrawn, the four strings sat at
   * `in_review` and stopped production builds until a real approval existed,
   * and this is that approval. The comment is a durable public record: anyone
   * can open it and read what was approved, by whom, and when.
   *
   * `home.about.h2` is here as a REWORD and so appears in no other batch. The
   * 2026-08-28 batch approved 「リポジトリから確認できることだけ。」, which stated
   * the site's sourcing policy where a reader was asking what kind of engineer
   * built this; that sentence is no longer on the site, so its id moved rather
   * than being listed twice.
   */
  Object.freeze({
    task: 'ISSUE-8-PUBLIC-COPY (PR #17 comment 5651891248)',
    by: 'user',
    at: '2026-09-13T07:17:12Z',
    ids: Object.freeze([
      'home.about.h2',
      'ui.contact.channels',
      'ui.contact.githubCta',
      'ui.caseStudy.repositoryAuthNote',
    ]),
  }),
  /**
   * U-01 — the public contact address, approved on PR #17 comment 5651971896.
   *
   * A SEPARATE BATCH, DELIBERATELY. It would have been less typing to add these
   * three ids to the batch above, and it would have been false: that approval
   * happened at 07:17:12Z and covered four strings that did not include an
   * address. One batch is one occasion, and the register of occasions is the
   * only thing that makes `approvedAt` mean anything.
   *
   * `home.contact.email` is this site's FIRST `user-fact`. The classification
   * has existed since the content model was written and nothing had ever
   * qualified: only the subject knows their own contact address, so the rule
   * was that the slot stays empty until they provide it, and #6's search of the
   * repository turned up nothing but `@example.com` fixtures. The matrix asks a
   * user-fact for a non-empty value AND an approver, which is exactly the pair
   * that was missing every time someone might have been tempted to fill it in.
   */
  Object.freeze({
    task: 'ISSUE-8-PUBLIC-EMAIL (PR #17 comment 5651971896)',
    by: 'user',
    at: '2026-09-13T07:35:52Z',
    ids: Object.freeze([
      'home.contact.emailKey',
      'home.contact.email',
      'ui.contact.emailCta',
    ]),
  }),
  /**
   * Issue #34 — CONTACT の問い合わせ補助文。
   *
   * 1 文だけの独立したバッチである。U-01 のバッチ（2026-09-13）が承認したのは
   * 住所とそのラベルであって、「何を書いて送ればよいか」を案内する文ではない。
   * 後から書かれた文を既存のバッチに足せば、その日には読まれていない文を
   * 承認済みとして記録することになる。
   *
   * 承認記録は Issue #34 comment 5741442820。本人が確定文を引用したうえで
   * 「この文言を公開コピーとして使用することを承認します」と述べており、
   * 同じ文は Issue #34 §5.1 にも確定文言として記載されている。`at` は
   * その承認コメントの時刻である。
   */
  Object.freeze({
    task: 'ISSUE-34-CONTACT-GUIDANCE (Issue #34 comment 5741442820 / §5.1)',
    by: 'user',
    at: '2026-09-19T11:26:31Z',
    ids: Object.freeze(['home.contact.helper']),
  }),
  /**
   * Issue #30 HD-I — 公開コードリンクを掲載しない作品の説明文。
   *
   * 独立したバッチである。#34 のバッチ（2026-09-19）が承認したのは CONTACT の
   * 問い合わせ補助文であって、FEATURED WORK でコードリンクが無い理由を述べる
   * 文ではない。既存バッチに足せば、その日には読まれていない文を承認済みとして
   * 記録することになる。
   *
   * `at` は承認コメント Issue #30 comment 5746615341 の作成時刻。本人が HD-G と
   * 並べてこの文を引用し、「この文言を公開コピーとして使用することを承認します」
   * と述べている。同じ文は Issue #30 §8.1 にも確定文言として記載されている。
   *
   * この 1 文が承認を要するのは、ラベルではなく事実を述べているからである
   * ——「掲載していない」も「公開可能な情報に限定して記載している」も、本人の
   * 公開方針が違えば誤りになる。だから presentation の免除ではなく、根拠と
   * 承認者を持つ側に置かれている。
   */
  Object.freeze({
    task: 'ISSUE-30-SOURCE-WITHHELD (Issue #30 comment 5746615341 / §8.1)',
    by: 'user',
    at: '2026-09-20T01:11:07Z',
    ids: Object.freeze(['home.works.sourceWithheld']),
  }),
  /**
   * Issue #31 追加 Human Decision — HOW I BUILD の「開発の前提」。
   *
   * これは REWORD ではなく REPLACEMENT である。置き換わったのは
   * `site.howIBuild.notClaimed` の 2 文——「完全自動の Multi-Agent 開発を
   * しているとは主張しない。」「Harness を構築済みであるとは主張しない。」——で、
   * どちらも承認バッチにも APPROVED_TEXT にも無かった。site.json の節内容として
   * 出ていた文であり、registry の外にいたからである（`W-SITE-UNMANAGED` が
   * 数えていた backlog のうちの 2 件）。なので「id が旧バッチから移動する」
   * 話ではなく、**registry の外にあった文が、承認を持って registry の中へ入る**
   * のがこのバッチである。
   *
   * 否定の境界線は消えていない。2 文目が同じ 2 つの主張——完全自動の
   * Multi-Agent 開発と、構築済み Harness の運用——を名指しで対象外にしている。
   * 変わったのは順序で、「何を主張しないか」を先に読ませる構成から、
   * 「実際にどうやっているか」を述べてからその範囲を区切る構成になった。
   *
   * `at` は承認コメント Issue #31 comment 5747908981 の作成時刻。本人が
   * 公開見出しと公開本文 2 文を確定文として記載している。
   *
   * 見出し `開発の前提` も同じバッチにある。本人がこのコメントで指定した語で、
   * ui.json 側の行として出るため APPROVED_TEXT には入らない——この snapshot が
   * 守っているのは `approvedCopyGate` が読む shipping registry であり、
   * ui 行の一致は approved-copy.test.ts が両 registry を跨いで見ている。
   */
  Object.freeze({
    task: 'ISSUE-31-DEV-PREMISES (Issue #31 comment 5747908981)',
    by: 'user',
    at: '2026-09-20T05:37:32Z',
    ids: Object.freeze([
      'method.premise.01',
      'method.premise.02',
      'ui.howIBuild.premises',
    ]),
  }),
]);

/**
 * Strings changed on a branch that are WAITING for an approval event.
 *
 * EMPTY, AND KEPT. #8 filled this with four strings and then emptied it: the
 * owner approved all four on PR #17 (comment 5651891248), so each moved into
 * APPROVAL_BATCHES and APPROVED_TEXT with that comment's timestamp.
 *
 * The list stays because the state it names is a real and recurring one, and
 * because the alternative is what #8 did first. Copy changed on a branch has no
 * approval yet; the Truth Gate refuses to ship it (`T-UNAPPROVED`), and the
 * tempting fix is to stamp a plausible date and go green. Naming the state
 * gives that moment somewhere to go that is not a forged record: put the ids
 * here, let the build stay red, and get a real approval.
 *
 * `keeps unapproved copy out of the snapshot AND out of the registries` holds
 * both halves, so an id cannot be here and approved at the same time, and
 * cannot be approved in one registry while the batch says otherwise.
 */
export const PENDING_APPROVAL: readonly { id: string; text: string; registry: string }[] =
  Object.freeze([]);

export const APPROVED_TEXT: Readonly<Record<string, string>> = Object.freeze({
  "home.hero.role.01": "ソフトウェアエンジニア",
  "home.hero.role.02": "業務システム / AI 活用 / 業務自動化",
  "home.hero.display.01": "業務課題を、",
  "home.hero.display.02": "業務で使える Web・AI システムへ。",
  "home.hero.lede": "業務フローを整理し、画面・API・データ・AI・自動処理へ落とし込み、実際に運用できる仕組みとして設計・実装します。",
  "home.hero.cta.primary": "実績を見る",
  "home.hero.cta.secondary": "相談する",

  // Issue #8 — PR #17 comment 5651891248. 04 ABOUT's heading, CONTACT's two
  // strings and the Case Study's CI note. The CTA names what the reader will
  // do there ("実装を見る"), which is the whole distinction this section rests
  // on: GitHub is where the work can be READ, and this site still publishes no
  // way to send anyone a message (U-01).
  "home.about.h2": "業務要件を整理し、設計から実装・運用まで形にする。",

  // U-01 — PR #17 comment 5651971896. The address and the label that says what
  // it is for. The CTA that uses them is ui chrome and lives in ui.json.
  "home.contact.emailKey": "開発のご相談",
  "home.contact.email": "kanda02.1203@gmail.com",

  // Issue #34 — 送る前に書くことを案内する 1 文。約束はしていない:
  // 見積り・返信期限・対応可能時期はここに無く、本人が承認したのは
  // 「何を書けばよいか」と「まずはメールで」の 2 点だけである。
  "home.contact.helper": "現状の業務・困りごと・希望時期が分かる範囲で構いません。まずはメールでご相談ください。",

  // The capability rail — TASK-PORTFOLIO-V4-COPY-APPROVE-01. Three axes, each
  // a name and the line under it, registered as six strings for the same
  // reason the display is three rows: the composition is what was approved,
  // and a pair joined into one string could not be re-cut without a new
  // approval for text nobody changed.
  "home.hero.capability.01.key": "業務をシステムにする",
  "home.hero.capability.01.value": "業務の流れを、画面・API・データへ落とす",
  "home.hero.capability.02.key": "任せる範囲を決める",
  "home.hero.capability.02.value": "AI・自動処理と、人が判断する範囲を分ける",
  "home.hero.capability.03.key": "確認できる形で作る",
  "home.hero.capability.03.value": "テスト・実行記録・人手確認で確かめる",

  // Issue #30 HD-I — 公開コードリンクを出さない Featured Work の説明。
  // private repository と public-repo + withheld を公開面で区別せず、公開面で
  // 確実に言えることだけを述べる: コードが存在しないとも、非公開 repository が
  // あるとも言っていない。
  "home.works.sourceWithheld": "公開範囲を限定しているため、コードリンクは掲載していません。担当範囲と実装内容は、公開可能な情報に限定して記載しています。",

  // Issue #31 — /how-i-build/ の「開発の前提」。順序が内容である: 1 文目が
  // 実際の開発体制を述べ、2 文目がその公開内容の対象範囲を区切る。2 文目は
  // 旧 `notClaimed` が名指ししていた 2 つ（完全自動の Multi-Agent 開発 /
  // 構築済み Harness）をそのまま対象外に保っている。
  "method.premise.01": "Human が調査・判断・検証を担当し、AI を設計・実装の支援に利用しています。",
  "method.premise.02": "現在の公開内容は、完全自動の Multi-Agent 開発や専用 Harness の構築済み運用を前提としたものではありません。",

  "home.works.h2": "何のためのサービスを、どこまで実装したのか。",
  "home.works.lede": "各作品で、実装範囲・検証方法・公開範囲を分けて示します。",
  "home.stack.h2": "どの技術で何を担当し、それがどの作品に入っているか。",
  "home.stack.lede": "ロゴは並べていません。1 行が「技術 → その技術で担当した責務 → その責務を持つ作品」の対応です。",
  "home.stack.note": "この表に無い技術は、公開しているデモでは使っていません。",

  // 404 — TASK-PORTFOLIO-RELEASE-CLOSEOUT-01. The document a visitor reaches by
  // typing a URL that is not on this site. The two body lines are separate rows
  // because the break between them is the approved composition, the same way the
  // hero display is three rows and not one sentence.
  "notfound.code": "404",
  "notfound.h1": "ページが見つかりません。",
  "notfound.body.01": "URLが変更されたか、",
  "notfound.body.02": "ページが存在しない可能性があります。",
  "notfound.back": "Portfolioへ戻る",
});
