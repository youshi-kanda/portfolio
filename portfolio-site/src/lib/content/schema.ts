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
export const PALETTE_KEYS = ['a', 'b', 'c'] as const;

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

export const sourceSchema = z
  .object({
    access: z.enum(SOURCE_ACCESS),
    /** Public path, e.g. `ai-crm-demo/`. Null whenever access is not public. */
    path: z.string().min(1).nullable().default(null),
  })
  .superRefine((s, ctx) => {
    if (s.access === 'public-repo' && !s.path) {
      ctx.addIssue({
        code: 'custom',
        path: ['path'],
        message: 'access = public-repo なら path が要る。公開している場所を言えない公開は無い。',
      });
    }
    if (s.access !== 'public-repo' && s.path) {
      ctx.addIssue({
        code: 'custom',
        path: ['path'],
        message:
          `access = ${s.access} に path を書かない。` +
          '非公開リポジトリの所在は Public Repository に置かない。',
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
   */
  homepageRole: z.enum(HOMEPAGE_ROLES).optional(),

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
  if (w.shipping && !w.image) {
    ctx.addIssue({
      code: 'custom',
      path: ['image'],
      message:
        'shipping = true なら image が要る。出荷する作品は必ず描画され、描画には figure が要る。',
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
