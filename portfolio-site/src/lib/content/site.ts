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
