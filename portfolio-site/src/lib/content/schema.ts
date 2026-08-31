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

export const publicationSchema = z.object({
  reviewStatus: z.enum(REVIEW_STATUSES),
  sourceType: z.enum(SOURCE_TYPES),
  sourceRefs: z.array(z.string()).default([]),
  approvedBy: z.string().nullable().default(null),
  approvedAt: z.string().nullable().default(null),
});

export const visualSchema = z.object({
  entryVariant: z.string().min(1),
  caseVariant: z.enum(CASE_VARIANTS),
  signal: z.string().min(1),
  frame: z.enum(FRAMES),
  ground: z.enum(GROUNDS),
  texture: z.enum(TEXTURES),
  displayCut: z.string().min(1),
});

const imageSchema = z.object({
  src: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export const workSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  status: z.enum(['draft', 'published', 'archived']),
  shipping: z.boolean(),
  featured: z.boolean(),
  featuredOrder: z.number().int().positive(),
  repoPath: z.string().min(1),

  // what it is
  productType: z.string().min(1),
  targetUser: z.string().min(1),
  problem: z.array(z.string().min(1)).min(1),
  purpose: z.string().min(1),

  // what was built, and what deliberately was not
  implementationScope: z.array(z.string().min(1)).min(1),
  publicDemoScope: z.array(z.string().min(1)).min(1),
  limitations: z.array(z.string().min(1)),
  originalProductScope: z.array(z.string().min(1)),

  // what it is written in
  languages: z.array(z.string().min(1)).min(1),
  frameworks: z.array(z.string().min(1)),
  platform: z.array(z.string().min(1)),

  keyDecision: z
    .array(z.object({ decision: z.string().min(1), rationale: z.string().min(1) }))
    .min(1),
  tests: z.object({
    summary: z.string().min(1),
    count: z.number().int().nonnegative(),
    source: z.string().min(1),
  }),
  evidence: z.array(z.string().min(1)),
  /**
   * Whether the full Case Study (CS-1 … CS-16) is published for this work.
   * The "Case Study を読む" call to action renders only when it is true, so the
   * site never offers a link whose label promises a page that does not exist.
   */
  caseStudyPublished: z.boolean().default(false),

  image: imageSchema.extend({ caption: z.string().min(1) }),
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

  visual: visualSchema,
  publication: publicationSchema,
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

  /** CS-16 — where the claims can be checked. */
  repository: z
    .array(z.object({ label: z.string().min(1), href: z.string().min(1) }))
    .min(1),

  publication: publicationSchema,
});

export const evidenceSchema = z.object({
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
});

export const copySchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  route: z.string().min(1),
  section: z.string().min(1),
  slot: z.string().min(1),
  purpose: z.string().min(1),
  publication: publicationSchema,
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
export type CaseStudy = z.infer<typeof caseStudySchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export type CopyItem = z.infer<typeof copySchema>;
export type UiCopyItem = z.infer<typeof uiCopySchema>;
export type UiKind = (typeof UI_KINDS)[number];
export type Publication = z.infer<typeof publicationSchema>;
export type EntryVariant = (typeof ENTRY_VARIANTS)[number];
