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

/**
 * A section's own content, minus its number. The number is not stored: it is
 * the section's position in `sections`, derived by `sectionNumber`. V3 wrote
 * it twice — once on the section and once on its nav entry — and the two had
 * to be edited together every time the order changed.
 */
const railed = {
  railLabels: z.array(z.string().min(1)),
};

const siteSchema = z.object({
  handle: z.string().min(1),
  kicker: z.string().min(1),
  repo: z.url(),
  synthetic: z.object({ label: z.string().min(1), note: z.string().min(1) }),
  /**
   * The homepage's sections, in the order they appear. This list IS the running
   * order, the numbering and the nav: a section's displayed index is its
   * position here, and a section with a `label` is offered in the nav.
   *
   * `id` is semantic and stable — `work` stays `work` whether it is shown
   * second or fifth — so adding or removing a section renumbers everything
   * after it with no edit anywhere else. `anchor` is separate from `id` because
   * one of them is not `#${id}`: the intro's fragment is `#top`, which is where
   * the masthead sends you and means the top of the document rather than the
   * name of a section.
   */
  sections: z.array(
    z.object({
      id: z.string().min(1),
      anchor: z.string().min(1),
      /** Null = on the page, not in the nav. */
      label: z.string().min(1).nullable(),
      needsWorks: z.boolean(),
    }),
  ),
  workPermalink: z.string().min(1),

  /**
   * Structure only. The hero's authored strings — the role, the display, the
   * lede and the three capability axes — are in the copy registry, where an
   * approval covers them; what stays here is the section index, its rail
   * labels and the stack line.
   */
  hero: z.object({
    ...railed,
    stackLine: z.string().min(1),
  }),
  registerMinSlots: z.number().int().nonnegative(),

  selectedWork: z.object(railed),
  /** 02 MORE PROJECTS — #7. Rail and heading only; the rows come from work/. */
  moreProjects: z.object({ ...railed, h2: z.string().min(1) }).strict(),
  /**
   * 03 CAPABILITIES — #7, spec §8.
   *
   * Four things a reader can hand over, each with the technologies it is done
   * with and the works that are the evidence. `examples` holds work SLUGS, not
   * titles: a category that named its examples in prose would go stale the
   * first time a work was renamed, and this way the section cannot claim a work
   * the site does not have — `capabilitiesGate` refuses an unknown slug.
   */
  capabilities: z
    .object({
      ...railed,
      h2: z.string().min(1),
      categories: z.array(
        z.object({
          key: z.string().min(1),
          title: z.string().min(1),
          titleEn: z.string().min(1),
          what: z.string().min(1),
          tech: z.array(z.string().min(1)).min(1).max(6),
          examples: z.array(z.string().min(1)).min(1),
        }),
      ),
      /** The one line HOW I BUILD keeps on the homepage, plus its link label. */
      methodLede: z.string().min(1),
      methodLink: z.string().min(1),
    })
    .strict(),
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
    /**
     * #31 — the decision cases, transcribed from public pull requests.
     *
     * WHY THE BODY IS DATA AND NOT MARKUP. Every sentence below is a
     * source-derived fact: it says what was measured, what was rejected and
     * what was verified, and each one has to stay checkable against the PR it
     * came from. A paragraph typed into an `.astro` file is outside every gate
     * this repository has — `siteStrings` does not walk components, so a claim
     * written there ships with no locator and no way to tell, later, which
     * sentence rests on which section of which PR.
     *
     * `sourceRefs` is required and is the point of the record. It names the
     * SECTIONS of the PR that support the case, not just the PR: "PR #20" as a
     * whole is 200 lines, and a reader checking one sentence needs to be sent
     * to the part that states it.
     *
     * `prNumber` is a number rather than a URL, and the URL is built by
     * `publicPrUrl` from `site.repo` — see derive.ts for why the address is
     * not stored here.
     *
     * WHAT THESE RECORDS DELIBERATELY DO NOT HAVE: a field for whose idea the
     * initial plan was. The site's claim is that the AUTHOR investigated,
     * decided and verified — which the PRs do document — and neither PR says
     * who proposed the design it starts from. A schema with an `aiProposal`
     * field would be an invitation to fill it in from the site's own narrative,
     * so the field does not exist; the initial state is stated inside
     * `problem`, as what was there, with no origin attached to it.
     */
    decisionCases: z
      .array(
        z
          .object({
            id: z.string().min(1),
            prNumber: z.number().int().positive(),
            title: z.string().min(1),
            /** What was happening, including the plan it started from. */
            problem: z.string().min(1),
            /** What investigation or measurement established. */
            observed: z.string().min(1),
            /** What was chosen, and what was dropped. */
            decision: z.string().min(1),
            /** What it became. */
            result: z.string().min(1),
            /** The engineer's layer: measurements, tests, conditions. */
            verification: z.array(z.string().min(1)).min(1),
            sourceRefs: z.array(z.string().min(1)).min(1),
          })
          .strict(),
      )
      .min(1),
    /**
     * #31 HD-J — the QA record, which is NOT a third case.
     *
     * Its own shape, because it makes a different kind of statement. A decision
     * case says "this was wrong, this was found, this was chosen"; this one
     * says how far the checking reached and where it stopped. Giving it the
     * case shape would have meant inventing a `problem` and a `decision` for a
     * record that has neither, which is how a QA pass gets written up as a
     * dramatic fix it never was.
     */
    qaRecord: z
      .object({
        prNumber: z.number().int().positive(),
        title: z.string().min(1),
        summary: z.string().min(1),
        facts: z.array(z.string().min(1)).min(1),
        sourceRefs: z.array(z.string().min(1)).min(1),
      })
      .strict(),
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
      /**
       * #7 — the short statement of how this engineer works, which ABOUT did
       * not have. `known` stays exactly as it was and moves below it: the
       * premises were never the introduction, they were the fine print under
       * one.
       */
      now: z.array(z.string().min(1)).min(1),
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
      h2: z.string().min(1),
      lede: z.string().min(1),
      rows: z.array(
        z.object({ key: z.string().min(1), value: z.string().min(1) }).strict(),
      ),
    })
    .strict(),
});

export type SiteContent = z.infer<typeof siteSchema>;

export const site: SiteContent = siteSchema.parse(raw);

/**
 * Leaves that are not shipping copy, each with the reason it is not.
 *
 * Listed rather than inferred, for the same reason `ui.ts` lists its one
 * exemption: an exemption is a decision, and it should be readable next to the
 * rule it exempts. Everything not named here is a string this site puts in
 * front of a reader, whether or not anyone has registered it yet.
 */
export interface SiteStringExemption {
  /** Matches the last segment of the dotted path. */
  leaf: string;
  why: string;
  /** When set, the leaf is only exempt while its value still looks like this. */
  valuePattern?: RegExp;
}

export const SITE_NON_SHIPPING: readonly SiteStringExemption[] = [
  { leaf: 'href', why: 'ルート断片。読者に読ませる文ではなく、行き先そのもの。' },
  { leaf: 'anchor', why: '同上。節の fragment そのもの。' },
  {
    leaf: 'id',
    why: '節の意味 ID。順序が変わっても不変で、描画されない。番号は order から導出する。',
  },
  { leaf: 'repo', why: 'URL。' },
  { leaf: 'workPermalink', why: 'ルートのテンプレート。' },
  { leaf: 'featured', why: 'Evidence の id。どの記録を出すかという指定であって文ではない。' },
  { leaf: 'sourceRef', why: '出所そのもの。承認を要する主張ではなく、主張を照合する座標。' },
  { leaf: 'work', why: '作品の slug。文言は work レコードが持っていて、ここは参照。' },
  {
    leaf: 'index',
    why: '節・手順の序数。構造であって文ではない — 数字である間だけ免除する。',
    valuePattern: /^\d+$/,
  },
  /*
   * #8 — two leaves that were being counted as unregistered COPY and are not
   * copy at all. Both already have a rule above that says why; they were simply
   * not named by it.
   */
  {
    leaf: 'example',
    why:
      'capability が実例として挙げる作品の slug。`work` と同じ理由で免除する — ' +
      '読者が見るのは work レコードの title で、ここにあるのは参照。' +
      'capabilitiesGate が未知の slug を先に落とすので、綴りは別途守られている。',
  },
  {
    leaf: 'key',
    why:
      'capability category の序数。`index` と同じ理由で免除し、同じ条件を付ける — ' +
      '数字でなくなった瞬間に、それは構造ではなく読ませる語なので免除が外れる。',
    valuePattern: /^\d+$/,
  },
];

export interface SiteString {
  /** Dotted path into `site`, e.g. `hero.stackLine`. */
  path: string;
  text: string;
}

const exemptionFor = (path: string, text: string): SiteStringExemption | undefined => {
  const leaf = path.slice(path.lastIndexOf('.') + 1);
  const parent = path.slice(0, path.lastIndexOf('.'));
  const parentLeaf = parent.slice(parent.lastIndexOf('.') + 1);
  return SITE_NON_SHIPPING.find(
    (e) =>
      // `sourceRefs.1` is a sourceRef; an array index is not a leaf name
      (e.leaf === leaf || (/^\d+$/.test(leaf) && `${e.leaf}s` === parentLeaf)) &&
      (!e.valuePattern || e.valuePattern.test(text)),
  );
};

/**
 * Every shipping string in `site`, flattened — the same walk `uiStrings` does
 * over `ui`, for the half of the site's copy that lives in JSON.
 *
 * site.json was outside every copy gate: `ui.json` covers the strings embedded
 * in components, `shipping.json` covers the authored sentences, and the section
 * content in between was covered by neither. That is not a small gap — it holds
 * the workflow steps, the stack rows, the principles and the section ledes.
 */
export function siteStrings(node: unknown = site, path = ''): SiteString[] {
  if (typeof node === 'string') {
    if (node.trim() === '') return [];
    return exemptionFor(path, node) ? [] : [{ path, text: node }];
  }
  if (Array.isArray(node)) {
    return node.flatMap((child, i) => siteStrings(child, `${path}.${i + 1}`));
  }
  if (node && typeof node === 'object') {
    return Object.entries(node).flatMap(([k, child]) =>
      siteStrings(child, path ? `${path}.${k}` : k),
    );
  }
  return [];
}
