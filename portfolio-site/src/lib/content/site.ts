/**
 * Singleton section content — everything on the homepage that is not a work.
 *
 * This is one heterogeneous record rather than a queryable set, so it is a JSON
 * module instead of a content collection. It is still schema-validated: the
 * parse happens at module load, which means an invalid site.json fails the
 * build (and `astro check`) rather than rendering a page with holes in it.
 *
 * The authored strings that need human approval are NOT here — they live in
 * the `copy` collection and are looked up by id. What is here is structure and
 * source-derived transcription: the workflow steps, the stack rows, the
 * decisions, each with the locator it came from.
 */
import { z } from 'astro/zod';
import raw from '../../content/site.json' with { type: 'json' };

const railed = {
  index: z.string().min(1),
  railLabels: z.array(z.string().min(1)),
};

const siteSchema = z.object({
  handle: z.string().min(1),
  kicker: z.string().min(1),
  repo: z.url(),
  synthetic: z.object({ label: z.string().min(1), note: z.string().min(1) }),
  nav: z.array(
    z.object({
      index: z.string(),
      label: z.string().min(1),
      href: z.string().min(1),
      needsWorks: z.boolean(),
    }),
  ),
  workPermalink: z.string().min(1),

  hero: z.object({
    ...railed,
    stackLine: z.string().min(1),
    capability: z.array(z.object({ key: z.string().min(1), value: z.string().min(1) })),
    capabilityCountLimit: z.number().int().positive(),
  }),
  /**
   * Templates for the two strings positioning computed rather than stored. A
   * literal count in the copy would go stale the moment a fourth work lands,
   * so the count is substituted in and the result is held to the approval
   * snapshot by `approvedCopyGate`.
   */
  derived: z.object({
    heroLede: z.object({ template: z.string().min(1), empty: z.string().min(1) }),
    capabilityVerify: z.object({
      empty: z.string().min(1),
      counts: z.string().min(1),
      summary: z.string().min(1),
    }),
  }),
  registerMinSlots: z.number().int().nonnegative(),

  selectedWork: z.object(railed),
  howIBuild: z.object({
    ...railed,
    title: z.string().min(1),
    lede: z.string().min(1),
    workflow: z.array(
      z.object({
        index: z.string().min(1),
        name: z.string().min(1),
        owner: z.string().min(1),
        what: z.string().min(1),
        tag: z.string(),
      }),
    ),
    roles: z.array(z.object({ role: z.string().min(1), duty: z.string().min(1) })),
    intent: z.array(z.string().min(1)),
    notClaimed: z.array(z.string().min(1)),
    sourceRefs: z.array(z.string().min(1)).min(1),
  }),
  stack: z.object({
    ...railed,
    languages: z.array(
      z.object({
        language: z.string().min(1),
        responsibility: z.string().min(1),
        work: z.string().min(1),
        frameworks: z.string().min(1),
        sourceRef: z.string().min(1),
      }),
    ),
    platform: z.array(
      z.object({
        layer: z.string().min(1),
        detail: z.string().min(1),
        work: z.string().min(1),
        sourceRef: z.string().min(1),
      }),
    ),
  }),
  principles: z.object({
    ...railed,
    spine: z.array(z.string().min(1)).min(1),
    spineBody: z.string().min(1),
    instances: z.array(
      z.object({ work: z.string().min(1), name: z.string().min(1), text: z.string().min(1) }),
    ),
    decisions: z.array(
      z.object({
        decision: z.string().min(1),
        work: z.string().min(1),
        why: z.string().min(1),
        sourceRef: z.string().min(1),
      }),
    ),
  }),
  evidenceSection: z.object({
    ...railed,
    h2: z.string().min(1),
    lede: z.string().min(1),
    featured: z.string().min(1),
  }),
  /**
   * 06 ABOUT / 07 CONTACT — IMPLEMENT-03 §5.
   *
   * `about.pending`, `about.note` and the rows' `pending` flag are not just
   * unset here, they are off the schema. That is deliberate: the policy is
   * "only facts a source confirms", and a schema with a `pending: boolean` on
   * every contact row is an invitation to ship a 未記入 row again the next time
   * someone wants to acknowledge a gap. `.strict()` makes the invitation an
   * error — re-adding the field now fails the build, so restoring pending rows
   * has to be a decision someone takes on purpose rather than a field someone
   * fills in.
   *
   * `known` carries `sourceRef` per row and that stays required: a profile fact
   * without a locator is the thing this whole section exists to prevent.
   */
  about: z
    .object({
      ...railed,
      known: z.array(
        z.object({
          key: z.string().min(1),
          value: z.string().min(1),
          sourceRef: z.string().min(1),
        }),
      ),
    })
    .strict(),
  contact: z
    .object({
      ...railed,
      rows: z.array(
        z.object({ key: z.string().min(1), value: z.string().min(1) }).strict(),
      ),
    })
    .strict(),
});

export type SiteContent = z.infer<typeof siteSchema>;

export const site: SiteContent = siteSchema.parse(raw);
