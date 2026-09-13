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
]);

export const APPROVED_TEXT: Readonly<Record<string, string>> = Object.freeze({
  "home.hero.role.01": "ソフトウェアエンジニア",
  "home.hero.role.02": "業務システム / AI 活用 / 業務自動化",
  "home.hero.display.01": "業務課題を、",
  "home.hero.display.02": "業務で使える Web・AI システムへ。",
  "home.hero.lede": "業務フローを整理し、画面・API・データ・AI・自動処理へ落とし込み、実際に運用できる仕組みとして設計・実装します。",
  "home.hero.cta.primary": "実績を見る",
  "home.hero.cta.secondary": "相談する",

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

  "home.works.h2": "何のためのサービスを、どこまで実装したのか。",
  "home.works.lede": "各作品で、実装範囲・検証方法・公開範囲を分けて示します。",
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
