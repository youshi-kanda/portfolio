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
   *
   * 6 件で始まり、1 件になった。`home.hero.display.01` / `.02` / `home.hero.lede`
   * は #44 で書き直され、下の ISSUE-44-HERO-COPY へ移っている——この batch が
   * 承認した 2 行 display とその lede はもうサイトに無い。移動であって取り消し
   * ではない: この batch は 2026-09-13T00:13:13Z に実際に起きた承認であり続け、
   * CTA 2 件は reader-copy task で書き直され、現在この batch に残るのは
   * その日に読まれたまま出ている role.02 である。
   *
   * 上の 2 段落は当時の判断の記録としてそのまま残す。「業務で使える」を選んだ
   * 理由も、「実際に使われる」を採らなかった理由も、その occasion に実際に
   * 効いた判断であり、後の改稿がそれを無かったことにするわけではない。
   */
  Object.freeze({
    task: 'ISSUE-6-HOME-IA-CONTENT-SPEC',
    by: 'user',
    at: '2026-09-13T00:13:13Z',
    ids: Object.freeze([
      'home.hero.role.02',
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
    ids: Object.freeze(['ui.howIBuild.premises']),
  }),
  /**
   * Issue #32 Phase 9-4 — ABOUT の業務経験と公開境界。
   *
   * 別の occasion である。#31 のバッチ（05:37:32Z）が承認したのは
   * /how-i-build/ の「開発の前提」2 文で、ABOUT の文ではない。同じ日の 1 時間
   * 後に、本人が別のコメントで ABOUT 3 ブロックを確定している。`at` はその
   * 承認コメント Issue #32 comment 5748161578 の作成時刻で、issue の
   * created_at でも commit 時刻でもない。
   *
   * 本人はこのコメントで見出し 3 語と本文 3 件をまとめて確定文として記載して
   * いる。ラベル 3 件は ui.json の行なので APPROVED_TEXT には入らない——
   * `ui.howIBuild.premises` と同じで、両 registry を跨ぐ一致は
   * approved-copy.test.ts が見ている。
   *
   * 6 件で始まり、5 件になった。`home.about.disclosure` はこのバッチを離れて
   * 下の ISSUE-32-ABOUT-DISCLOSURE へ移っている——同じ PR のレビュー中に本人が
   * 文を短くしたからで、このバッチが承認した 2 文構成はもうサイトに無い。
   * 移動であって取り消しではない: このバッチは 06:35:42Z に実際に起きた
   * 承認であり続け、その日に読まれた文が今も出ている 5 件を承認している。
   *
   * REWORD ではなく RETIREMENT + NEW である。置き換わった 3 行——
   * 実装形態 / 公開範囲 / データ——は site.json の節内容として出ていた文で、
   * どの承認バッチにも APPROVED_TEXT にも無かった（`W-SITE-UNMANAGED` が
   * 数えていた backlog の 3 件）。だから旧バッチから移動する id は無く、
   * 旧文言は退役文字列として `check:structure` の RETIRED_PUBLIC_COPY が
   * 公開面から締め出す側に置いた。旧文を新しいバッチに書き写せば、本人が
   * 読んでいない文を今日の承認として記録することになる。
   *
   * 退役の理由は文体ではなく事実である。旧 `実装形態` 行は Portfolio 全体を
   * 「個人開発」と言っていて、#29 が共同プロジェクトの公開用再構成を
   * 本人確認済みの事実として記録した時点で成り立たない。公開境界そのものは
   * 消えていない——合成データの表明は `home.about.syntheticData` が、
   * 公開範囲の説明は `home.about.disclosure` が引き継いでいる。
   */
  Object.freeze({
    task: 'ISSUE-32-ABOUT-PROFILE (Issue #32 comment 5748161578)',
    by: 'user',
    at: '2026-09-20T06:35:42Z',
    ids: Object.freeze([
      'home.about.experience',
      'home.about.syntheticData',
      'ui.about.experienceLabel',
      'ui.about.disclosureLabel',
      'ui.about.dataLabel',
    ]),
  }),
  /**
   * Issue #32 — 「掲載内容について」の訂正。A REWORD, AND THE ID MOVED.
   *
   * これはこのファイルの冒頭が述べている規則がそのまま起きた例である:
   * 文が書き直されて再承認されたら、id は新しいバッチへ移り、両方には載らない。
   * スナップショットは 1 id につき 1 本文しか持たないので、2 つのバッチに
   * いる id は「どちらの機会がいま出ている文を承認したのか」を言えなくなる。
   *
   * 何が落ちたか。旧文の 2 文目は
   * 「担当範囲と到達状態は作品ごとに記載しています。」で、この PR の
   * レビューでその半分が公開面で成り立たないことが分かった——担当範囲は
   * Featured Work の Role / 開発背景 として各作品に出ているが、**到達状態
   * （`portfolioProfile.implementationStatus`）はどの公開ページにも出ていない**。
   * 作品レコードには 10 件すべてに入っている。つまり読み手に「作品ごとに
   * 書いてある」と言いながら、探しても半分は見つからない文だった。
   *
   * 直し方が 2 つあり、本人が選んだのは後者である（Issue #32 comment
   * 5749023659）。(a) 到達状態を公開 UI に足して文を真にする。(b) 文を、
   * 現在の公開面で確認できる範囲まで狭める。(a) は ABOUT の 1 文のために
   * Featured Work の情報設計を動かすことになり、#32 の対象ではない。
   * `implementationStatus` は #29 が確定した内部メタデータとして残る——
   * 消したのは主張であって、事実ではない。
   *
   * 旧バッチ（06:35:42Z）は falsify されていない。あの日あのコメントで本人が
   * 読んだのは 2 文の版で、それは実際に起きた承認である。ただしその文は
   * もうサイトに無いので、`home.about.disclosure` はここに居る。旧文は
   * `check:structure` の RETIRED_PUBLIC_COPY 側へ回り、公開面のどこにも
   * 残らないことが検査される。
   */
  Object.freeze({
    task: 'ISSUE-32-ABOUT-DISCLOSURE (Issue #32 comment 5749023659)',
    by: 'user',
    at: '2026-09-20T09:43:50Z',
    ids: Object.freeze(['home.about.disclosure']),
  }),
  /**
   * Issue #44 — HERO の display 2 行と lede。A REWORD, AND THE IDS MOVED.
   *
   * このファイルの冒頭の規則がそのまま起きている: 3 件とも #6 のバッチ
   * （2026-09-13T00:13:13Z）で承認された文を持っていたが、書き直されたので
   * id は新しいバッチへ移り、両方には載らない。#6 のバッチに残る role.02 は
   * あの日読まれたまま今も出ている。CTA 2 件は後の reader-copy task へ移った。
   *
   * `at` は承認コメント Issue #44 comment 5751276538 の作成時刻で、issue の
   * created_at でも commit 時刻でもない。本人がそのコメントで 3 文を id ごとに
   * 引用したうえで「上記 3 文を公開コピーとして使用することを承認します」と
   * 述べている。誰でも開いて、何が・誰に・いつ承認されたかを読める記録である。
   *
   * 何が変わったか。#6 の display は「業務課題を、／業務で使える Web・AI
   * システムへ。」で、読者が持ち込むもの（課題）を主語に置いていた。新しい
   * display は「業務を理解し、／現場で使える仕組みをつくる。」で、主語が
   * 書き手の仕事の順序——まず業務を理解し、そのうえで作る——に変わっている。
   *
   * 主張の強さは上がっていない。#6 §4.1 が「実際に使われる」を退けた理由は
   * 稼働実績を含意するからで、その境界は「現場で使える」でも守られている:
   * 業務要件への適合の主張であって、運用されているという主張ではない。
   * 稼働状況・利用者数・商用実績は、このサイトのどこにも無いままである。
   *
   * lede は長い 1 文から、領域と工程を簡潔に示す 1 文へ書き直され、工程名
   * （要件整理 / 設計 / 実装）と領域名（Web システム / AI / 業務自動化）だけを
   * 述べる。文の数は変わっていない——旧 lede
   * 「業務フローを整理し、画面・API・データ・AI・自動処理へ落とし込み、
   * 実際に運用できる仕組みとして設計・実装します。」も 1 文である。
   * 件数はここにも無い——`heroLede` の導出が V4 で消えて以来この行が守って
   * いる性質で、approved-copy.test.ts の「no count anywhere」がそれを見ている。
   */
  Object.freeze({
    task: 'ISSUE-44-HERO-COPY (Issue #44 comment 5751276538)',
    by: 'user',
    at: '2026-09-20T17:03:02Z',
    ids: Object.freeze([
      'home.hero.display.01',
      'home.hero.display.02',
      'home.hero.lede',
    ]),
  }),
  /**
   * Home / Work reader copy. The user supplied the final visible wording in
   * this task, including the Japanese archive title, field labels and CTAs.
   * Reworded ids move here from their earlier approval batches; the archive
   * lede and page title are new registered strings.
   */
  Object.freeze({
    task: 'TASK-IMPROVE-HOME-WORK-COPY-FOR-READERS',
    by: 'user',
    at: '2026-09-26T14:37:12Z',
    ids: Object.freeze([
      'home.hero.cta.primary',
      'home.hero.cta.secondary',
      'home.works.h2',
      'work.archive.lede',
      'ui.work.role',
      'ui.work.selectedTech',
      'ui.register.pageTitle',
      'ui.register.homeAllWorksCta',
    ]),
  }),
  /**
   * HOW I BUILD / Technical reader copy. The user supplied the visible
   * wording in this task. The two premise ids move here because their current
   * Japanese was re-approved as a reader-facing rewrite; the unchanged
   * 「開発の前提」heading remains in the earlier #31 batch.
   */
  Object.freeze({
    task: 'TASK-IMPROVE-HOW-I-BUILD-TECHNICAL-COPY-FOR-READERS',
    by: 'user',
    at: '2026-09-26T15:25:44Z',
    ids: Object.freeze([
      'method.rail.subtitle',
      'method.title',
      'method.lede',
      'method.workflow.decisionTag',
      'method.roles.human',
      'method.roles.chatgpt',
      'method.roles.claudeCode',
      'method.intent.01',
      'method.intent.02',
      'method.intent.03',
      'method.premise.01',
      'method.premise.02',
      'ui.caseStudy.technicalCta',
      'ui.technical.sectionsLabel',
      'ui.technical.sections.architecture',
      'ui.technical.sections.why',
      'ui.technical.sections.failureModes',
      'ui.technical.sections.tradeOffs',
      'ui.technical.sections.tests',
      'ui.technical.sections.security',
      'ui.technical.sections.limitations',
      'ui.technical.sections.scale',
      'ui.technical.sections.links',
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
  "home.hero.display.01": "業務を理解し、",
  "home.hero.display.02": "現場で使える仕組みをつくる。",
  "home.hero.lede": "Webシステム・AI・業務自動化を、要件整理から設計・実装まで。",
  "home.hero.cta.primary": "主な開発実績を見る",
  "home.hero.cta.secondary": "開発について相談する",

  // Issue #8 — PR #17 comment 5651891248. 04 ABOUT's heading, CONTACT's two
  // strings and the Case Study's CI note. The CTA names what the reader will
  // do there ("実装を見る"), which is the whole distinction this section rests
  // on: GitHub is where the work can be READ, and this site still publishes no
  // way to send anyone a message (U-01).
  "home.about.h2": "業務要件を整理し、設計から実装・運用まで形にする。",

  // Issue #32 — ABOUT の 3 ブロック。読み順が内容である: 現在の開発姿勢
  // (`about.now`) → 業務経験 → 掲載内容の公開境界。旧 3 行は「これは本物では
  // ない」が 3 本並ぶ構造で、業務背景はサイトのどこにも無かった。
  //
  // 年数は入っていない。HD-C の決定で、「製造業で約 12 年間」のような年数表現は
  // ABOUT に出さず、出すのは現場から営業までの業務フロー理解と、それが現在の
  // 要件整理・システム化へ接続していることだけである。勤務先名・顧客名・
  // 発注元名・取引先名も無い。
  //
  // 2 件目が使う分類語——共同プロジェクト / 公開用再構成 / 個人開発 / 技術デモ
  // / 自主開発 / PoC——は #29 の本人確認済み metadata の語で、ABOUT のために
  // 新しい軸を作っていない。掲載作品が何であるかだけを述べ、どこに何が
  // 書いてあるかは述べない: 2 文目にあった「担当範囲と到達状態は作品ごとに
  // 記載しています。」は、到達状態が公開面に出ていないため削除された
  // （Issue #32 comment 5749023659）。
  "home.about.experience": "製造現場から営業までの業務経験を通じ、業務フローを理解したうえで課題を整理し、システムへ落とし込むことを大切にしています。",
  "home.about.disclosure": "公開している作品には、共同プロジェクトを公開用に再構成したもの、個人開発の技術デモ、自主開発のPoCが含まれます。",
  "home.about.syntheticData": "掲載画面では実顧客情報を公開せず、合成データを使用しています。",

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
  "method.rail.subtitle": "AIを活用した開発プロセス",
  "method.title": "AIを活用した開発の進め方",
  "method.lede": "AIを設計・実装の支援に使い、要件整理・重要な判断・最終確認は自分で行います。",
  "method.workflow.decisionTag": "人が判断",
  "method.roles.human": "要件整理 / 内容理解 / 採否判断",
  "method.roles.chatgpt": "計画 / レビュー / 論点整理",
  "method.roles.claudeCode": "実装 / テスト",
  "method.intent.01": "AIに実装を任せる場合も、内容を理解したうえで採否を判断します。",
  "method.intent.02": "理解が浅い技術や重要な設計判断では、人が確認する範囲を広げます。",
  "method.intent.03": "定型作業は自動化し、判断が必要な箇所に確認を集中します。",
  "method.premise.01": "要件整理・判断・検証は自分で行い、AIは設計・実装の支援に使っています。",
  "method.premise.02": "現在の公開内容は、複数のAIがすべて自動で開発する仕組みや、専用の自動化基盤を構築・運用した実績を示すものではありません。",

  "home.works.h2": "何を作り、どこまで実装したのか。",
  "home.works.lede": "各作品で、実装範囲・検証方法・公開範囲を分けて示します。",
  "work.archive.lede": "業務Webアプリ、AI活用、業務自動化を中心に、これまでの開発実績をまとめています。各実績では、目的・担当範囲・使用技術を掲載しています。",
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
