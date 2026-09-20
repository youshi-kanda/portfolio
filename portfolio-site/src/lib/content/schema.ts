/**
 * Structural validation for the content collections.
 *
 * Responsibility boundary (TASK-PORTFOLIO-IMPLEMENT-01 §7):
 *   this file  — SHAPE. Is the field present, is it the right type, is the
 *                enum member one that exists?
 *   validation/ — TRUTH. Is the claim allowed to ship, given its review record?
 *
 * `entryVariant` is deliberately a plain string rather than an enum. The art
 * direction (§12) makes ENTRY_RENDERERS the source of truth for the closed set,
 * and an unknown variant has to surface as the variant gate's `E-UNKNOWN` with
 * the list of implemented variants — not as a zod type error that says nothing
 * about renderers.
 */
import { z } from 'astro/zod';

export const ENTRY_VARIANTS = ['v-stage', 'v-split', 'v-terminal'] as const;
export const CASE_VARIANTS = ['walkthrough', 'ledger', 'pipeline', 'comparison'] as const;
export const FRAMES = ['fr-stage', 'fr-plate', 'fr-term'] as const;
export const GROUNDS = ['paper', 'tone', 'inv'] as const;
export const TEXTURES = ['none', 'rule'] as const;

export const REVIEW_STATUSES = ['draft', 'in_review', 'approved', 'rejected'] as const;
/**
 * `source-derived` — a transcription with a cited locator. Approved by
 *                    comparison against that source (content-model §1.3).
 * `authored`       — written for this site. Only a person can approve it, and
 *                    the approval is recorded in approvedBy / approvedAt.
 * `user-fact`      — only the subject knows it (経歴・稼働条件・料金・連絡先).
 *                    Never filled in with a plausible-looking placeholder.
 */
export const SOURCE_TYPES = ['source-derived', 'authored', 'user-fact'] as const;

/**
 * The second axis, and the one V3 was missing.
 *
 * `sourceType` says HOW a string earns the right to ship. It was being asked to
 * also say WHAT KIND of statement it is, and the two are not the same question:
 * "閉じる ESC" and "backend 静的 480 件" are both transcribed from a source, and
 * only one of them can be wrong about the world.
 *
 *   fact          the string asserts something checkable — a count, a scope, a
 *                 capability, a provenance. It carries the burden the
 *                 provenance matrix sets for its sourceType.
 *   presentation  the string presents: a label, a heading, a button, a piece of
 *                 framing. It is still registered, still carries metadata, and
 *                 still may not ship unapproved — being presentation buys an
 *                 exemption from FACT provenance, not from the registry.
 *
 * Default `fact`, on purpose. A string nobody has classified is treated as
 * making a claim, so forgetting the field tightens the requirement rather than
 * quietly waiving it.
 */
export const CLAIM_TYPES = ['fact', 'presentation'] as const;

/**
 * What every publishable record carries: its review state, where it came from,
 * what it cites, and who signed it off.
 *
 * `claimType` is NOT here, and that is the point. It asks whether a STRING is
 * asserting something or presenting something, which is a question about a
 * sentence and only a sentence. A Work is not a sentence. Putting the field on
 * the shared record meant every work, Case Study and copy row carried a
 * `claimType: fact` that no gate read and no author chose — a field defaulted
 * onto a hundred records to answer a question they were never asked.
 *
 * "The default is harmless" is not a reason to carry a field. A field that is
 * always the same value is one a reader has to check anyway, and the day
 * someone sets it to `presentation` on a Work is the day it means something
 * nobody defined.
 *
 * Records are not exempt from the provenance matrix for lacking it. A work
 * record IS a claim about the world — its scope, its languages, its test count
 * — so the Truth Gate looks it up under `fact`, unconditionally and without
 * storing the answer. There is no presentation variant of a Work, so there is
 * nothing for content to decide.
 */
export const basePublicationSchema = z.object({
  reviewStatus: z.enum(REVIEW_STATUSES),
  sourceType: z.enum(SOURCE_TYPES),
  sourceRefs: z.array(z.string()).default([]),
  approvedBy: z.string().nullable().default(null),
  approvedAt: z.string().nullable().default(null),
});

/**
 * The publication record for a registered STRING — shipping copy and UI chrome.
 * The one place `claimType` is a live question, because it is the one place the
 * subject under review is a sentence.
 */
export const copyPublicationSchema = basePublicationSchema.extend({
  claimType: z.enum(CLAIM_TYPES).default('fact'),
});

/**
 * V4 — which pigment a work is assigned. A key into the design system, and
 * nothing else.
 *
 * No colour value lives here, and none ever will. Content names the slot; the
 * design system owns what the slot resolves to, and resolves it differently
 * for light, dark and inverse. A hex in a work record would be the same colour
 * written down twice — once in JSON and once in tokens.css — and two places
 * that must agree about one fact are a place they will eventually disagree.
 *
 * Abstract on purpose. `'a'` says which of the closed set this work holds; a
 * name like 常磐 would state the resolved appearance, which is exactly the
 * decision Content is not making. `signal` still carries the V3 string and is
 * still what the renderers read until CONTRACT.
 */
/** #7 C-2 — five, since FEATURED WORK is five blocks and each holds one. */
export const PALETTE_KEYS = ['a', 'b', 'c', 'd', 'e'] as const;

export const visualSchema = z.object({
  entryVariant: z.string().min(1),
  caseVariant: z.enum(CASE_VARIANTS),
  signal: z.string().min(1),
  frame: z.enum(FRAMES),
  ground: z.enum(GROUNDS),
  texture: z.enum(TEXTURES),
  displayCut: z.string().min(1),
  /** V4. Optional through MIGRATE — `signal` is still what the renderers read. */
  palette: z.enum(PALETTE_KEYS).optional(),
});

/**
 * V4 — how the source of a work can be seen.
 *
 * V3 had one field for this, `repoPath`, and it could only describe a work
 * whose code is in this public repository. That is not a property of every
 * work: a client engagement has a repository that exists and cannot be linked.
 * Saying so is a fact about the work; omitting the field would instead say
 * "there is no source", which is false.
 *
 * `path` is a PUBLIC path and nothing else. A private repository's name, host
 * or path never enters this record — see the Local Private Verification gate.
 */
export const SOURCE_ACCESS = ['public-repo', 'private-repo', 'none'] as const;

/**
 * #7 C-8 — whether THIS SITE publishes a way to reach the source.
 *
 * Separate from `access`, because they answer different questions and the
 * answers come apart. `access` is a fact about the work: the repository is
 * public, or it is private, or there is none. `linkPolicy` is a decision about
 * the portfolio: we show the way in, or we withhold it.
 *
 * The case that forced the split is a work whose repository is genuinely
 * public but whose NAME carries the client's. Before this field the record had
 * two seats and neither was true — `public-repo` demanded a path that cannot be
 * shown, and `private-repo` would have bought the client's privacy with a false
 * statement about the work. A gate that makes honesty inexpressible gets
 * answered with a lie, so the seat is what had to change.
 *
 * `withheld` is inert on a source that is not public: there was never a link to
 * withhold. It is `public-repo` + `linked` that means "there is a way in and we
 * publish it", and only that pair carries a path.
 */
export const LINK_POLICIES = ['linked', 'withheld'] as const;

export const sourceSchema = z
  .object({
    access: z.enum(SOURCE_ACCESS),
    /** Defaults to `linked`: a public path that exists was always published. */
    linkPolicy: z.enum(LINK_POLICIES).default('linked'),
    /**
     * Public path, e.g. `ai-crm-demo/`. Null unless the source is BOTH public
     * and linked — a withheld path is the client's name spelled sideways, and
     * keeping it out of the record is the point of withholding it.
     */
    path: z.string().min(1).nullable().default(null),
  })
  .superRefine((s, ctx) => {
    const linkable = s.access === 'public-repo' && s.linkPolicy === 'linked';
    if (linkable && !s.path) {
      ctx.addIssue({
        code: 'custom',
        path: ['path'],
        message: 'access = public-repo かつ linkPolicy = linked なら path が要る。公開している場所を言えない公開は無い。',
      });
    }
    if (!linkable && s.path) {
      ctx.addIssue({
        code: 'custom',
        path: ['path'],
        message:
          `access = ${s.access} / linkPolicy = ${s.linkPolicy} に path を書かない。` +
          'リンクしない source の所在を Public Repository に保存しない。',
      });
    }
  });

/**
 * What was actually run, and where the number can be read. The legacy `tests`
 * field on a work is this same record — deliberately, so the MIGRATE-period
 * comparison between the two is a comparison of like with like.
 */
export const testsSchema = z.object({
  summary: z.string().min(1),
  count: z.number().int().nonnegative(),
  source: z.string().min(1),
});

/**
 * V4 — the public showing of a work: what can be seen of its source, what a
 * visitor can actually run, and what verification stands behind it.
 *
 * `verificationId` is an identifier and only an identifier. It resolves to a
 * private record through the local gate (`review-private/`, gitignored); this
 * repository holds the id, never what it points at.
 */
export const showcaseSchema = z.object({
  source: sourceSchema,
  /** What a visitor can actually run in public. Empty when nothing is public. */
  demoScope: z.array(z.string().min(1)).default([]),
  verification: z.object({
    /** Null when no public test count can be cited for this work. */
    tests: testsSchema.nullable().default(null),
    verificationId: z.string().min(1).nullable().default(null),
  }),
});

/**
 * V4 — the one entry the homepage leads with, when it leads with one.
 * A single member today: the role either applies or the field is absent.
 */
export const HOMEPAGE_ROLES = ['lead'] as const;

/** #7 — the two homepage tiers. Absent means the work is archive-only. */
export const HOMEPAGE_PLACEMENTS = ['featured', 'more'] as const;

/**
 * #30 Phase 9-2 — homepage 上の編集上の強弱。それ以上の意味を持たない。
 *
 * 技術力の評価でも、品質の順位でも、到達状態でもない。01 FEATURED WORK で
 * 「先に深く読んでほしい作品」と「技術・業務の幅を示す作品」を分けるための
 * presentation metadata で、権威は本人の編集判断（HD-G）にある。
 *
 *   primary     代表作。figure / measure / spacing を強く出す
 *   supporting  補助作品。同じ情報項目を保ったまま一段コンパクトにする
 *
 * `portfolioProfile` と混ぜない。あちらは作品の成立背景という事実の記録で、
 * 誰がどう並べるかとは無関係に真偽がある。こちらは並べ方の決定そのもので、
 * 同じ作品が明日 supporting になっても、作品について嘘になる事実は 1 つも無い。
 * 1 つのフィールドに畳めば、並び替えるたびに事実が書き換わることになる。
 *
 * `homepage === 'featured'` の作品だけが持つ。Featured に出ない作品にこの値を
 * 置くと、どこにも描かれない強弱が記録に残り、次に homepage tier を動かす人が
 * それを既定値として読むことになる（下の refinement が拒む）。
 */
export const FEATURED_TIERS = ['primary', 'supporting'] as const;

/**
 * #29 Phase 9-1 — 作品の成立背景・公開形態・到達状態・リリース境界。
 *
 * `role` と混ぜない。`role` は技術担当領域（Frontend / Backend / Auth …）の列挙で、
 * 「何を書いたか」を言う。ここで定義するのは「その作品がどういう成り立ちで、
 * Portfolio 上どういう形で出ていて、どこまで到達していて、リリースについて
 * 何を主張してよいか」で、別の軸の事実。1 つのフィールドに 2 つの意味を持たせると、
 * 片方だけ変えたい日に必ず嘘が入る。
 *
 * ここに入るのはすべて本人確認済みの事実だけ。未確認は推測で埋めず、
 * 専用の enum 値（`releaseStatus = 'unknown'`）で「未確認である」と記録する。
 */

/**
 * 誰と進めたか。
 *
 *   personal       本人が単独で進めた（自主開発・個人開発）
 *   collaborative  共同プロジェクトとして進めた
 *
 * 有償 / 無償、受託 / 自社は、この軸では言わない。#29 §5.0 の方針どおり、
 * 金銭条件は作品分類に使わない。
 */
export const DEVELOPMENT_CONTEXTS = ['personal', 'collaborative'] as const;

/**
 * Portfolio 上にどういう形で載っているか。
 *
 *   public-reconstruction  元の実装を、公開用に匿名化・合成データで再構成したもの
 *   technical-demo         公開されることを前提に作った技術デモ
 *
 * 「合成データを使っている」こと自体は公開のためのデータ差し替えであって、
 * 作品の成立背景ではない（#29 §5.2）。両者を混同しないためにこの軸を分けている。
 */
export const PORTFOLIO_FORMS = ['public-reconstruction', 'technical-demo'] as const;

/**
 * 本人が関与した範囲で、どこまで到達したか。
 *
 *   implemented  実装済み
 *   public-demo  公開デモとして動作する
 *   poc          PoC（検証目的の実装で、製品として完成させていない）
 */
export const IMPLEMENTATION_STATUSES = ['implemented', 'public-demo', 'poc'] as const;

/**
 * 本番リリース・本番運用について、Portfolio 上で何を言ってよいか。
 *
 * 4 つの値はすべて別の事実であって、程度の差ではない。特に `unknown` と
 * `not-released` を 1 つにまとめない ——「確認していない」と「無いと確認した」は
 * 違う事実で、まとめた瞬間にどちらかが嘘になる。
 *
 *   unknown       本人確認上、本番リリース状態を確定していない。
 *                 未確認なので、公開面に事実として出さない。
 *   not-released  本番リリースなしを本人確認済み。
 *   project-use   一般向け本番サービスとしてのリリースではないが、
 *                 実プロジェクト内で実際に利用した。
 *   not-claimed   公開デモや開発中作品で、
 *                 本番リリース・本番運用を Portfolio 上で主張しない。
 */
export const RELEASE_STATUSES = ['unknown', 'not-released', 'project-use', 'not-claimed'] as const;

/** `originProject` の開発体制。自社プロジェクトを表せる点が本体の軸との差。 */
export const ORIGIN_PROJECT_CONTEXTS = ['internal-project', 'personal', 'collaborative'] as const;

/** `originProject` の到達状態。継続中を表せる点が本体の軸との差。 */
export const ORIGIN_PROJECT_STATUSES = ['in-development', 'implemented', 'poc', 'unknown'] as const;

/**
 * この作品が「何かの一部を公開用に取り出したもの」であるとき、その元にあたる開発。
 *
 * 作品レコードとは別に持つ。元の開発と、公開している作品は、到達状態も担当範囲も
 * 一致しないのが普通で（元は開発中・公開分は動作する、など）、1 つのレコードに
 * 畳むとどちらの事実も言えなくなる。
 *
 * `label` は公開される文字列なので、顧客名・発注元名・非公開リポジトリ名を入れない。
 * 入れてよいのは、その開発が何であるかを一般名詞で言った呼称だけ。
 */
export const originProjectSchema = z.object({
  label: z.string().min(1),
  context: z.enum(ORIGIN_PROJECT_CONTEXTS),
  status: z.enum(ORIGIN_PROJECT_STATUSES),
  /** 元の開発における本人の担当範囲。工程（要件定義 等）と技術領域の両方を書ける。 */
  responsibilityScope: z.array(z.string().min(1)).min(1),
});

/**
 * 全 Work が持つ、同一基準のメタデータ（#29 §5.1）。
 *
 * `responsibilityNotes` と `originProject` に default を置いていないのは意図的。
 * default があると、書き忘れた作品が「補足なし」「元となる開発なし」として
 * 静かに通る。どちらも「無い」と言い切る記録なので、`[]` / `null` を
 * 明示的に書かせる。
 */
export const portfolioProfileSchema = z.object({
  developmentContext: z.enum(DEVELOPMENT_CONTEXTS),
  portfolioForm: z.enum(PORTFOLIO_FORMS),
  implementationStatus: z.enum(IMPLEMENTATION_STATUSES),
  releaseStatus: z.enum(RELEASE_STATUSES),
  /**
   * 上の 4 つの enum では言えない、本人確認済みの補足。
   * 推測・評価・成果数値は書かない。確認済みの事実だけ。
   */
  responsibilityNotes: z.array(z.string().min(1)),
  /** 元となる開発が無い作品は `null`。省略は許さない。 */
  originProject: originProjectSchema.nullable(),
});

const imageSchema = z.object({
  src: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

const workBase = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  status: z.enum(['draft', 'published', 'archived']),
  shipping: z.boolean(),
  featured: z.boolean(),
  featuredOrder: z.number().int().positive(),
  /** LEGACY — see the transitional contract under `workSchema`. */
  repoPath: z.string().min(1).optional(),

  // what it is
  productType: z.string().min(1),
  targetUser: z.string().min(1),
  problem: z.array(z.string().min(1)).min(1),
  purpose: z.string().min(1),

  // what was built, and what deliberately was not
  implementationScope: z.array(z.string().min(1)).min(1),
  /** LEGACY. */
  publicDemoScope: z.array(z.string().min(1)).min(1).optional(),
  limitations: z.array(z.string().min(1)),
  originalProductScope: z.array(z.string().min(1)),

  /**
   * #7 — what the homepage says about this work, in the spec's own terms.
   *
   * `role` and `selectedTech` are not derivable from the fields above. The
   * spec fixes the public order as Problem → What was built → Role → Selected
   * Technology, and the last two have no home in the V3 record: `languages`
   * is what the code is written in, which is a different question from the
   * four-to-six technologies a reader should take away, and nothing at all
   * states how much of the work was this engineer's.
   *
   * Both default to empty so every V3 record stays valid, and both are read
   * through derive.ts so a work without them falls back rather than renders a
   * gap — see `workSelectedTech`.
   */
  role: z.array(z.string().min(1)).default([]),
  /** The 4–6 the homepage shows. Falls back to `languages` when empty. */
  selectedTech: z.array(z.string().min(1)).default([]),

  /**
   * #29 — 作品の成立背景・公開形態・到達状態・リリース境界。全 Work に必須。
   *
   * default を持たない。default は「まだ決めていない作品」と「そう決めた作品」を
   * 同じ形にしてしまい、この記録が答えるはずの「未確認かどうか」をちょうど
   * 見えなくする。未確認であることは `releaseStatus = 'unknown'` のように
   * 値として書く。
   *
   * 上の `role` とは別軸（`portfolioProfileSchema` の説明を参照）。
   */
  portfolioProfile: portfolioProfileSchema,

  // what it is written in
  languages: z.array(z.string().min(1)).min(1),
  frameworks: z.array(z.string().min(1)),
  platform: z.array(z.string().min(1)),

  keyDecision: z
    .array(z.object({ decision: z.string().min(1), rationale: z.string().min(1) }))
    .min(1),
  /** LEGACY. */
  tests: testsSchema.optional(),
  evidence: z.array(z.string().min(1)),
  /**
   * Whether the full Case Study (CS-1 … CS-16) is published for this work.
   * The "Case Study を読む" call to action renders only when it is true, so the
   * site never offers a link whose label promises a page that does not exist.
   */
  caseStudyPublished: z.boolean().default(false),

  /**
   * The entry figure. Optional in the schema and required by the refinement
   * below whenever the work ships — see `workFigure` in derive.ts.
   *
   * A figure is the work's rendering, and a work that does not ship has no
   * rendering. Demanding one anyway would mean the only way to register a work
   * before it has a publishable image is to point at somebody else's, or to
   * invent one; both put a false figure in the repository to satisfy a field.
   */
  image: imageSchema.extend({ caption: z.string().min(1) }).optional(),
  fieldsTable: z
    .object({
      /** The command whose output this table is. Printed above it. */
      producedBy: z.string().min(1),
      /** The command shown in the fr-term strip beside it. */
      terminalCommand: z.string().min(1),
      rows: z
        .array(
          z.object({
            key: z.string().min(1),
            value: z.string().min(1),
            confidence: z.string().min(1),
            level: z.enum(['HIGH', 'MEDIUM', 'LOW']),
          }),
        )
        .min(1),
    })
    .optional(),

  /**
   * V4. Absent on every work but the one the homepage leads with.
   *
   * #7 retired the Lead, so nothing composes the homepage from this any more.
   * It is kept because deleting it would destroy the record of a decision
   * (V4 Phase 5) that was made deliberately — see the spec's rule that data
   * outlives the presentation that used it.
   */
  homepageRole: z.enum(HOMEPAGE_ROLES).optional(),

  /**
   * #7 — where this work appears on the homepage, if it does.
   *
   * Three states, and the third is the one the V3 record could not hold: a
   * work that ships, keeps its page under /work/, and is deliberately NOT on
   * the homepage. `shipping` could not say it, because turning that off would
   * take the work off its own archive page too.
   *
   *   'featured'  01 FEATURED WORK — a gallery block with a figure
   *   'more'      02 MORE PROJECTS — one ruled row
   *   absent      archive only; reachable from /work/ and from nowhere else
   */
  homepage: z.enum(HOMEPAGE_PLACEMENTS).optional(),

  /**
   * #30 — Featured の中での強弱。`homepage === 'featured'` のときだけ持つ。
   *
   * optional なのは、Featured でない作品が持たないことを表すため。持つ / 持たない
   * の対応は下の refinement が両方向で要求するので、「featured なのに未設定」も
   * 「featured でないのに設定されている」も通らない。
   */
  featuredTier: z.enum(FEATURED_TIERS).optional(),

  /**
   * V4 — `repoPath`, `publicDemoScope` and `tests` restated as one record.
   *
   * Optional because the legacy fields are still allowed. Nothing renders from
   * here while a legacy field is present: through MIGRATE the legacy value is
   * the one with authority (`lib/content/compat.ts`).
   */
  showcase: showcaseSchema.optional(),

  /**
   * How the work is drawn. Optional on the same terms as `image`, and required
   * by the refinement below whenever the work ships — see `workVisual`.
   *
   * These are art-direction decisions: which pigment the work is assigned,
   * which of the closed set of entry and case variants draws it, where the
   * display line breaks. They are made when a work is prepared for the page,
   * by a person looking at the page. Filling them in for a work that does not
   * render yet would put a provisional assignment in the repository looking
   * exactly like a decided one — and the pigment set has three members
   * assigned to three works, so a fourth is a decision, not a default.
   */
  visual: visualSchema.optional(),
  publication: basePublicationSchema,
});

/**
 * The work record, in the shape it has for the length of the migration.
 *
 * Exactly three states are legal, and this is what makes them the only three:
 *
 *   Legacy-only  repoPath + publicDemoScope + tests, no showcase — every V3
 *                work as it stands today
 *   V4-only      showcase and none of the three — a work whose source is
 *                private could not be expressed at all before this
 *   Dual         both, while a work is being moved across
 *
 * A PARTIAL legacy set is refused. The three fields were required together in
 * V3, so two of them with the third gone is not a migration state — it is a
 * work that lost a fact, and the loss would show up as a chip that quietly
 * stopped rendering rather than as a failure.
 *
 * Whether a Dual work's two records AGREE is not asked here. That is a
 * comparison of claims, so it belongs to the Truth Gate
 * (`validation/migration.ts`, W-DUAL-SOURCE / T-DUAL-CONFLICT) — this file
 * only asks whether the fields are present and the right shape.
 *
 * At CONTRACT this refinement is deleted along with the legacy fields, and
 * `showcase` becomes required.
 */
export const workSchema = workBase.superRefine((w, ctx) => {
  const legacy = { repoPath: w.repoPath, publicDemoScope: w.publicDemoScope, tests: w.tests };
  const present = Object.entries(legacy).filter(([, v]) => v !== undefined);

  if (present.length > 0 && present.length < 3) {
    const missing = Object.entries(legacy)
      .filter(([, v]) => v === undefined)
      .map(([k]) => k);
    ctx.addIssue({
      code: 'custom',
      path: [missing[0] ?? 'repoPath'],
      message:
        `legacy field は 3 つ揃って初めて 1 つの状態になる。欠けている: ${missing.join(' / ')}。` +
        `移行するなら 3 つとも showcase へ移す。`,
    });
  }

  // A work that ships renders, and rendering needs both halves of the
  // presentation. One rule, two fields: `shipping` is the predicate every page
  // filters on (`shippingWorks`), so the schema asks for these under exactly
  // the circumstances a renderer reaches for them.
  // #7 — the rule is "drawn with a figure", and `shipping` stopped meaning
  // that when MORE PROJECTS and the archive became figure-less rows. Two
  // things draw one: a FEATURED gallery block, and the /work/<slug>/ entry,
  // which exists exactly when the work's Evidence resolves. Asking `shipping`
  // now would demand a figure for a row that has nowhere to put one — and the
  // only way to satisfy it would be to attach a picture that stands for
  // nothing, which is the defect this check was written to prevent.
  const drawsFigure = w.featured || w.evidence.length > 0;
  if (w.shipping && drawsFigure && !w.image) {
    ctx.addIssue({
      code: 'custom',
      path: ['image'],
      message:
        'featured な作品、または Evidence を持つ（= /work/<slug>/ が出る）作品には image が要る。' +
        '図版付きで描画されるのに figure が無い。',
    });
  }

  // One fact, two fields — so the schema is what keeps them agreeing rather
  // than the next person remembering to change both.
  if (w.featured !== (w.homepage === 'featured')) {
    ctx.addIssue({
      code: 'custom',
      path: ['homepage'],
      message:
        `featured = ${w.featured} と homepage = ${w.homepage ?? '(なし)'} が食い違っている。` +
        'FEATURED WORK に出る作品は featured = true かつ homepage = "featured"。',
    });
  }

  // #30 — featuredTier は Featured の中でだけ意味を持つ。両方向で要求するのは、
  // 片方向だけだと「Featured から外したのに tier が残っている」記録が静かに
  // 生き延びるため。描かれない強弱は、次に順序を触る人が既定値として読む。
  const onFeatured = w.homepage === 'featured';
  if (onFeatured && w.featuredTier === undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['featuredTier'],
      message:
        'homepage = "featured" の作品には featuredTier が要る。' +
        'FEATURED WORK は代表作と補助作品で強弱を付けて描くので、どちらかを記録すること。',
    });
  }
  if (!onFeatured && w.featuredTier !== undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['featuredTier'],
      message:
        `homepage = ${w.homepage ?? '(なし)'} の作品に featuredTier = ${w.featuredTier} を置かない。` +
        'FEATURED WORK に出ない作品に homepage 上の強弱は無い。',
    });
  }

  if (w.shipping && !w.visual) {
    ctx.addIssue({
      code: 'custom',
      path: ['visual'],
      message:
        'shipping = true なら visual が要る。' +
        '出荷する作品は必ず描画され、描画には variant / 顔料 / displayCut の割り当てが要る。',
    });
  }

  if (present.length === 0 && !w.showcase) {
    ctx.addIssue({
      code: 'custom',
      path: ['showcase'],
      message:
        'repoPath / publicDemoScope / tests か showcase のどちらかが要る。' +
        'ソースについても公開範囲についても検証についても何も言わない作品は出さない。',
    });
  }
});

/**
 * The Case Study record — CS-1 … CS-16, as fixed by
 * portfolio-case-study-specification.md §17 (TASK-CS-06 確定版).
 *
 * WHAT IS NOT HERE, AND WHY. A Case Study does not restate productType,
 * targetUser, problem, purpose, implementationScope, limitations or tests: those
 * are on the work record already. Copying them here would create a second place
 * for the same fact to be true, and the two would eventually disagree — which on
 * this site is not an inconsistency but a false claim. The page reads both
 * records and renders each fact from its one home.
 *
 * `technicalRoute` is likewise absent: it is `/work/<slug>/technical/`, derived
 * in `derive.ts`, for the same reason no component hard-codes a work name.
 *
 * Optional sections are genuinely optional (§4). A work with nothing true to say
 * under a heading renders no heading — an empty section is a worse statement
 * than a missing one.
 */
const namedItem = z.object({ name: z.string().min(1), what: z.string().min(1) });

export const caseStudySchema = z.object({
  slug: z.string().min(1),

  /** CS-1 — one sentence on what the system does. */
  overview: z.string().min(1),
  /**
   * A disclosure that must sit above everything else, not in a footnote.
   * DFE carries Rule DFE-0 ("この作品は OCR を実行していない"), which spec §7
   * requires outside any collapsible.
   */
  leadDisclosure: z.string().nullable().default(null),

  /** CS-3 — who uses it and how they work today. */
  currentPractice: z.string().min(1),

  /** CS-4 — what it had to satisfy. */
  requirements: z.object({
    functional: z.array(z.string().min(1)).min(1),
    constraints: z.array(z.string().min(1)).min(1),
  }),

  /** CS-5 — what was actually built. */
  built: z.array(namedItem).min(1),

  /**
   * CS-6 — the design decisions, each with the option that was rejected.
   * A decision with no rejected alternative is a description, not a decision.
   */
  decisions: z
    .array(
      z.object({
        title: z.string().min(1),
        context: z.string().min(1),
        decision: z.string().min(1),
        reason: z.string().min(1),
        /** What it cost. Null only when the source records no trade-off. */
        tradeoff: z.string().nullable().default(null),
        evidenceRefs: z.array(z.string().min(1)).default([]),
      }),
    )
    .min(1),

  /** CS-7 — what a reader can actually check, each tied to its Evidence. */
  highlights: z
    .array(
      z.object({
        claim: z.string().min(1),
        detail: z.string().min(1),
        evidenceRefs: z.array(z.string().min(1)).default([]),
      }),
    )
    .min(1),

  /** CS-8 — who built what. */
  role: z.string().min(1),

  /** CS-9 / CS-10 — how quality and safety are held. */
  quality: z.array(z.string().min(1)).default([]),
  safety: z.array(namedItem).default([]),

  /** CS-11 — what is handed over. */
  delivery: z.array(z.object({ key: z.string().min(1), value: z.string().min(1) })).default([]),

  /**
   * CS-12 — the three-column scope table. `why` is required: a boundary with
   * no stated reason reads as an omission rather than a decision.
   */
  scope: z
    .array(
      z.object({
        implemented: z.string().min(1),
        notIncluded: z.string().min(1),
        why: z.string().min(1),
      }),
    )
    .default([]),

  /** CS-13 — measured size. `method` is how the number was obtained. */
  scale: z
    .array(
      z.object({
        item: z.string().min(1),
        value: z.string().min(1),
        method: z.string().min(1),
      }),
    )
    .default([]),

  /** CS-14 — kinds of work, explicitly not a record of engagements. */
  capabilities: z.array(z.string().min(1)).default([]),
  capabilitiesNote: z.string().min(1),

  /**
   * The spine the case variant draws: the run of stages the system moves
   * through. `owner` names who acts (human / system); `gate` marks a stage that
   * refuses rather than passes through.
   */
  flow: z
    .array(
      z.object({
        key: z.string().min(1),
        name: z.string().min(1),
        owner: z.string().min(1),
        what: z.string().min(1),
        gate: z.string().nullable().default(null),
      }),
    )
    .default([]),

  /** CS-15 — the Technical page. */
  technical: z.object({
    architectureSummary: z.string().min(1),
    whyThisArchitecture: z.string().min(1),
    rejected: z.array(z.object({ option: z.string().min(1), why: z.string().min(1) })).default([]),
    failureModes: z.array(z.string().min(1)).default([]),
    tradeOffs: z.array(z.string().min(1)).default([]),
    testsSummary: z.string().min(1),
    testBreakdown: z
      .array(z.object({ area: z.string().min(1), detail: z.string().min(1) }))
      .default([]),
    security: z.array(z.string().min(1)).default([]),
    limitationsNote: z.string().min(1),
    links: z.array(z.string().min(1)).default([]),
    /** The recommended reading order for the design docs, where one exists. */
    designDocs: z.array(z.string().min(1)).default([]),
  }),

  /**
   * CS-16 — where the claims can be checked.
   *
   * Empty is a legal SHAPE and usually a defect. A work whose source is public
   * has somewhere to send the reader and must; a work whose source is a
   * private engagement has nowhere, and inventing a link — or labelling one
   * "private repository" and pointing it at nothing — would offer a check that
   * cannot be performed.
   *
   * Which of those a given record is depends on the WORK, not on the Case
   * Study, so the requirement is a cross-record rule and lives in the Truth
   * Gate as T-NO-REPO. The renderer already drops the section when this is
   * empty (`caseSections`), so the two now agree.
   */
  repository: z
    .array(z.object({ label: z.string().min(1), href: z.string().min(1) }))
    .default([]),

  publication: basePublicationSchema,
});

/**
 * V4 — what an Evidence record IS.
 *
 * Every V3 record is a `screenshot`: a capture of a program that ran, whose
 * authority is the file it was taken from. A `diagram` is drawn rather than
 * captured, so its authority cannot be its own image file — it has to name the
 * verification it generalises from, and say what it left out.
 */
export const EVIDENCE_KINDS = ['screenshot', 'diagram'] as const;

/**
 * A drawn Evidence record.
 *
 * `verificationId` resolves to a private source through the local gate; this
 * repository holds the id only. `publicBasis` says what may be shown in
 * public, `generalizes` what the drawing abstracts from the private original,
 * and `omits` what was deliberately removed. `omits` is required for the same
 * reason `notProves` is: a drawing that does not say what it dropped invites
 * the reader to assume it dropped nothing.
 */
export const diagramSchema = z.object({
  verificationId: z.string().min(1),
  publicBasis: z.string().min(1),
  generalizes: z.array(z.string().min(1)).min(1),
  omits: z.array(z.string().min(1)).min(1),
});

const evidenceBase = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  caption: z.string().min(1),
  type: z.string().min(1),
  sourceFile: z.string().min(1),
  dims: z.string().min(1),
  sha: z.string().min(1),
  scale: z.string().min(1),
  status: z.string().min(1),
  chip: z.string().nullable().default(null),
  disclosure: z.string().nullable().default(null),
  proves: z.array(z.string().min(1)).min(1),
  notProves: z.array(z.string().min(1)).min(1),
  image: imageSchema,
  /**
   * art-direction §13.3 — PPM-V02 / DFE-V01 have no PUBLISH-MAP yet and their
   * SHA256 reads 未取得. The provenance expander must not be rendered for a
   * record whose provenance has not actually been established.
   */
  provenanceComplete: z.boolean(),

  /** V4. Defaulted, so every V3 record reads as what it already is. */
  kind: z.enum(EVIDENCE_KINDS).default('screenshot'),
  diagram: diagramSchema.nullable().default(null),
});

/**
 * The refined record. Kept separate from the object above only because zod
 * cannot `.extend()` a refined schema — everything parses through this one.
 */
export const evidenceSchema = evidenceBase.superRefine((e, ctx) => {
  if (e.kind === 'diagram' && !e.diagram) {
    ctx.addIssue({
      code: 'custom',
      path: ['diagram'],
      message: 'kind = diagram なら diagram 記録が要る。何から一般化した図かを言えない図は出さない。',
    });
  }
  if (e.kind !== 'diagram' && e.diagram) {
    ctx.addIssue({
      code: 'custom',
      path: ['diagram'],
      message: `kind = ${e.kind} に diagram 記録は付かない。`,
    });
  }
});

export const copySchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  route: z.string().min(1),
  section: z.string().min(1),
  slot: z.string().min(1),
  purpose: z.string().min(1),
  publication: copyPublicationSchema,
});

/**
 * What a UI chrome string IS, as distinct from how it is approved.
 *
 *   ui-system  a label, column heading, button or state word. Functional
 *              wording, fixed by the frozen renderers and design-freeze §3.
 *   editorial  a sentence that explains or makes a claim — a heading, a lede,
 *              a note. Carries more than a name does, so it is separated out
 *              and can be reviewed as its own group.
 *   user-fact  a slot whose content only the subject knows. None exist yet:
 *              content-model §5 holds that a Profile item is not created until
 *              the fact is provided, so an empty one cannot be approved.
 *
 * `sourceType` on the publication record is the other axis — it says how the
 * string earns the right to ship, not what kind of string it is.
 */
export const UI_KINDS = ['ui-system', 'editorial', 'source-derived', 'user-fact'] as const;

export const uiCopySchema = copySchema.extend({
  /** Dotted path into the `ui` object. The join key for the coverage gate. */
  path: z.string().min(1),
  kind: z.enum(UI_KINDS),
});

export type Work = z.infer<typeof workSchema>;
export type PortfolioProfile = z.infer<typeof portfolioProfileSchema>;
export type FeaturedTier = (typeof FEATURED_TIERS)[number];
export type OriginProject = z.infer<typeof originProjectSchema>;
export type DevelopmentContext = (typeof DEVELOPMENT_CONTEXTS)[number];
export type PortfolioForm = (typeof PORTFOLIO_FORMS)[number];
export type ImplementationStatus = (typeof IMPLEMENTATION_STATUSES)[number];
export type ReleaseStatus = (typeof RELEASE_STATUSES)[number];
export type Showcase = z.infer<typeof showcaseSchema>;
export type WorkSource = z.infer<typeof sourceSchema>;
export type Tests = z.infer<typeof testsSchema>;
export type PaletteKey = (typeof PALETTE_KEYS)[number];
export type Diagram = z.infer<typeof diagramSchema>;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];
export type SourceAccess = (typeof SOURCE_ACCESS)[number];
export type CaseStudy = z.infer<typeof caseStudySchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export type CopyItem = z.infer<typeof copySchema>;
export type UiCopyItem = z.infer<typeof uiCopySchema>;
export type UiKind = (typeof UI_KINDS)[number];
export type Publication = z.infer<typeof basePublicationSchema>;
export type CopyPublication = z.infer<typeof copyPublicationSchema>;
export type ClaimType = (typeof CLAIM_TYPES)[number];
export type SourceType = (typeof SOURCE_TYPES)[number];
export type EntryVariant = (typeof ENTRY_VARIANTS)[number];
