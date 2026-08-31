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
      'home.hero.role.02',
      'home.hero.display.01',
      'home.hero.display.02',
      'home.hero.display.03',
      'home.hero.lede',
      'home.works.h2',
      'home.works.lede',
      'home.stack.h2',
      'home.stack.lede',
      'home.stack.note',
      'home.about.h2',
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
]);

export const APPROVED_TEXT: Readonly<Record<string, string>> = Object.freeze({
  "home.hero.role.01": "ソフトウェアエンジニア",
  "home.hero.role.02": "業務システム / 自動化 / AI駆動開発",
  "home.hero.display.01": "業務の要件を整理し、Web・",
  "home.hero.display.02": "自動化・データ処理を、",
  "home.hero.display.03": "検証できる仕組みをつくる。",
  "home.hero.lede": "公開しているのは 3 つの動くデモです。何のためのサービスか・どこまで実装したか・何の言語で書いたかを、作品ごとに分けて書いています。",
  "home.works.h2": "何のためのサービスを、どこまで実装したのか。",
  "home.works.lede": "作品ごとに、製品種別・使う人・目的と、実装した範囲・使用言語を分けて書いています。公開デモに含まれるもの、含めていないもの、元プロダクト側にあるものは、それぞれ別の欄です。",
  "home.stack.h2": "どの技術で何を担当し、それがどの作品に入っているか。",
  "home.stack.lede": "ロゴは並べていません。1 行が「技術 → その技術で担当した責務 → その責務を持つ作品」の対応です。",
  "home.stack.note": "この表に無い技術は、公開しているデモでは使っていません。",
  "home.about.h2": "リポジトリから確認できることだけ。",

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
