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

/**
 * #32 — one ABOUT block: a visible label, a body, and where both came from.
 *
 * `labelId` / `copyId` are REGISTRY IDS. The two strings a reader sees are
 * approved copy (Issue #32 comment 5748161578) and live in the registries that
 * hold their approval records; what this file holds is which block appears,
 * in what order, and on what sourcing. Writing either string here would put an
 * approved sentence where `approvedCopyGate` cannot see it, which is the defect
 * #31 fixed for 開発の前提 and the one #32 would otherwise reintroduce.
 *
 * `.strict()`, so a `value` or a `text` field added back is an error rather
 * than a second home for the body.
 */
const aboutBlock = z
  .object({
    /** Stable within the section. Not rendered; it names the block in a diff. */
    id: z.string().min(1),
    labelId: z.string().min(1),
    copyId: z.string().min(1),
    sourceRefs: z.array(z.string().min(1)).min(1),
  })
  .strict();

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
    /**
     * #31 追加 Human Decision — 「開発の前提」。
     *
     * THIS FIELD HOLDS COPY REGISTRY IDS, NOT SENTENCES, and the change of
     * shape is the point of the rename. `notClaimed` held two sentences, both
     * written as refusals（「…とは主張しない。」）and both sitting in site.json
     * where no approval record can reach them. The owner replaced the framing:
     * the section now says how the work is actually done and then bounds what
     * the published content covers, and the two sentences are APPROVED copy
     * (`method.premise.01` / `.02`, Issue #31 comment 5747908981).
     *
     * Renaming the field and leaving an array of 否定文 in it would have been
     * the worse half of the change — a section called 開発の前提 whose data
     * model still said "things not claimed". What the section content owns now
     * is the ORDER: which premises this page states, and in which sequence. The
     * sentences themselves live where their approval lives.
     *
     * The ids are resolved by `copyText` at render time, which throws on an id
     * the registry does not hold — so a premise pointing at nothing fails the
     * build rather than rendering an empty bullet.
     */
    premises: z.array(z.string().min(1)).min(1),
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
   * EVERY ABOUT BLOCK CARRIES ITS OWN LOCATORS AND THAT STAYS REQUIRED: a
   * profile fact without one is the thing this whole section exists to prevent.
   * What changed in #32 is where the SENTENCE lives, not whether the record has
   * to say where it came from.
   */
  about: z
    .object({
      ...railed,
      /**
       * #7 — the short statement of how this engineer works, which ABOUT did
       * not have. It opens the section: the rest of ABOUT is read after it, not
       * as the fine print above it.
       */
      now: z.array(z.string().min(1)).min(1),
      /**
       * #32 — 業務経験. A PROFILE FACT, not a disclaimer, and that distinction
       * is the reason it is its own field rather than a row in the list below.
       *
       * ABOUT used to end on three rows — 実装形態 / 公開範囲 / データ — which
       * were all the same kind of statement: what this site is NOT claiming.
       * A reader met the caveats and never met the person, and there was no
       * line about the owner's working background anywhere on the site. The
       * owner decided what that line says (HD-C, Issue #32 comment 5748116465)
       * and approved its wording (comment 5748161578); giving it a field of its
       * own is what keeps it from being drawn, coloured and read as a fourth
       * caveat.
       *
       * HOLDS IDS, NOT SENTENCES — the shape `premises` took in #31, for the
       * same reason. `copyId` names the approved body in the shipping registry
       * and `labelId` names its visible label in the ui registry, so the
       * sentence sits where its approval record sits and this file owns the
       * order and the sourcing. `copyText` throws on an id the registry does
       * not hold, so a block pointing at nothing fails the build rather than
       * rendering an empty row.
       *
       * `sourceRefs` is required and non-empty per block. It is the half of the
       * old `known` contract that had nothing to do with where the sentence was
       * stored: a fact on this page says where it came from, whether the words
       * are here or in a registry.
       */
      profile: z.array(aboutBlock).min(1),
      /**
       * #32 — 掲載内容について / 公開データ. The compliance half, compressed
       * into ONE block instead of three rows standing on their own.
       *
       * Nothing was dropped to compress it. 合成データ is still stated here, and
       * the scope sentence now says what #29 established — that the published
       * work includes a collaborative project rebuilt for publication, personal
       * technical demos and a self-directed PoC — where the old 実装形態 row
       * said 個人開発 of the whole portfolio, which stopped being true when #29
       * recorded the collaborative half.
       *
       * Separate from `profile` because the two are drawn differently and the
       * count of each is a rendering contract (`ABOUT_DISCLOSURE_ROWS`). One
       * list with a `kind` discriminator would put the editorial decision —
       * this is a fact about me, that is a boundary about the page — inside a
       * field a renderer has to branch on.
       */
      disclosure: z.array(aboutBlock).min(2),
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
  /*
   * #31 — 「開発の前提」が出す文の id。
   *
   * `work` / `example` / `featured` と同じ理由で免除する。読者が見るのは copy
   * registry が持つ承認済みの文で、ここにあるのはどれをどの順で出すかという
   * 参照である。文そのものをここに置けば、承認記録の無い場所に承認を要する
   * 文が座ることになり、この Issue が直したのはまさにそれだった。
   *
   * `index` / `key` と同じく条件付きである。id の形（小文字のドット区切り）を
   * していない値が入った瞬間、それは参照ではなく読ませる文なので免除が外れ、
   * 未登録の出荷文字列として報告される。
   */
  {
    leaf: 'premise',
    why:
      'copy registry の id。承認済みの文は shipping.json にあり、ここにあるのは ' +
      '「どの文をどの順で出すか」という参照 — id の形をしている間だけ免除する。',
    valuePattern: /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/,
  },
  /*
   * #32 — ABOUT の各ブロックが指す registry id。
   *
   * `premise` と同じ理由・同じ条件で免除する。読者が読むのは registry が持つ
   * 承認済みの文とラベルで、ここにあるのは「どれをどの順で出すか」という参照
   * である。`labelId` / `copyId` という名前で `label` / `copy` ではないのは、
   * `sections.label` が nav に出る本物の出荷文字列だからで、`label` を免除すれば
   * 節名が黙って gate の外へ出る。
   *
   * 条件付きである。id の形（小文字のドット区切り）をしていない値が入った瞬間、
   * それは参照ではなく読ませる文なので免除が外れ、未登録の出荷文字列として
   * 報告される — ABOUT の本文が site.json へ戻ってきたら、それがここで出る。
   */
  {
    leaf: 'labelId',
    why:
      'ui registry の id。ABOUT のラベルは ui.json にあり、ここにあるのは参照 — ' +
      'id の形をしている間だけ免除する。',
    valuePattern: /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/,
  },
  {
    leaf: 'copyId',
    why:
      'copy registry の id。ABOUT の本文は shipping.json にあり、ここにあるのは ' +
      '参照 — id の形をしている間だけ免除する。',
    valuePattern: /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/,
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
