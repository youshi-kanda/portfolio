/**
 * UI chrome — labels, column headings, button text.
 *
 * REGISTERED (TASK-PORTFOLIO-IMPLEMENT-02 §2). Every string below now has a row
 * in `src/content/copy/ui.json` carrying its classification, its slot, and the
 * `file:line` in the frozen prototype it was transcribed from. `uiCopyGate`
 * walks this object on every build and fails when a string here has no row
 * (`U-UNMANAGED`), when a row points at a path this object no longer has
 * (`U-ORPHAN`), or when the two texts have drifted apart (`U-DRIFT`).
 *
 * That closes the gap content-model §4 recorded — the prototype's `要確認`
 * marker only ever covered the strings registered in COPY_SLOTS, so ~78
 * renderer-embedded strings shipped without one. The count here came out at 78
 * verbatim transcriptions plus the 2 ADAPTED strings below.
 *
 * These are registered as `source-derived`: content-model §1.3 defines that as
 * a transcription with a cited locator, approved by comparison against the
 * source rather than by a new authoring decision. No string here was written
 * for this site.
 *
 * Two strings are the only ones on this site whose wording was touched, and
 * both for the same reason: they named `positioning.WORKS`, a Python file that
 * does not exist in this repository. Telling a reader to edit it would be
 * shipping a false instruction. The reference target was repointed at
 * `src/content/work/`; nothing else about either sentence changed. Marked
 * ADAPTED below, and the substituted path is itself checked to exist by the
 * gate's `U-REFTARGET` — a corrected reference that goes stale is the same
 * defect again.
 */

export const ui = {
  /*
   * `mobileIndex` STAYS, and it is no longer a dead label.
   *
   * The wayfinding work removed it, correctly, for what it then was: a
   * `<span class="mob">Index</span>` with no handler and no tab stop — below
   * 768px the only thing in the chrome that looked like navigation, and a dead
   * label is worse than an empty corner, because the empty corner promises
   * nothing. What that reasoning refuses is a label without a control, not the
   * word. The mobile index is now a real disclosure: a `<button>` owning
   * `aria-expanded` over the panel it names (Nav.astro), and this is the string
   * on its face. So the row stays in ui.json too — it is rendered, which is
   * precisely what U-ORPHAN asks of a registry row.
   */
  nav: {
    /**
     * The mobile index disclosure's label, on the `<button>` in the masthead
     * that opens the section list below 768px.
     */
    mobileIndex: 'Index',
    /**
     * The breadcrumb landmark's accessible name. Never drawn — it is what a
     * screen reader announces before reading the trail, so that a bare
     * `WORK INDEX / …` is introduced as a position rather than as a second
     * list of links next to the masthead's.
     */
    breadcrumbLabel: 'パンくずリスト',
  },

  /** The Evidence component's own labels. art-direction §4–6: these do not vary. */
  evidence: {
    zoom: '原寸で開く',
    proves: 'この画面で確認できること',
    notProves: 'Evidence の対象外',
    provenanceSummary: 'この画像の出所と、拡大',
    cropChip: 'crop 表示',
    cropRowLabel: '掲載の crop',
    cropRowValue: 'レイアウト上の切り抜き。上の「原寸で開く」で全体を表示する',
    provenanceLabels: {
      type: '種別',
      source: '出所',
      dims: '掲載サイズ',
      scale: '倍率',
      sha: 'SHA256',
    },
    dialog: {
      close: '閉じる ESC',
      footer:
        '原寸表示。掲載側の crop はレイアウト上の切り抜きで、ここでは全体を表示している。',
    },
  },

  work: {
    fieldLabels: [
      { key: 'productType', label: '製品種別' },
      { key: 'targetUser', label: '使う人' },
      { key: 'purpose', label: '目的' },
    ],
    problem: '解いている課題',
    implementationScope: '実装した範囲',
    languages: 'Languages',
    frameworks: 'Frameworks / Platform',
    scope: {
      included: 'Public Demo に含まれる',
      excluded: 'この公開デモに含めていない',
      original: '元プロダクト側にある範囲',
    },
    keyDecision: 'Key engineering decision',
    /** #7 — the two labelled facts a FEATURED block ends with. */
    role: 'Role',
    selectedTech: 'Selected technology',
    caseStudyCta: 'Case Study を読む',
    /*
     * #30 — Featured ブロックが Role / Selected technology の前に置く 1 行の
     * ラベル。作品が「どういう成り立ちで、Portfolio 上どういう形で出ているか」
     * （#29 の portfolioProfile）を読む前に、それが何の欄なのかを言う。
     */
    background: '開発背景',
    /*
     * #30 — 証拠導線の見出し。「Evidence」でも「Links」でもないのは、この欄が
     * 答えているのが「読み手が自分で何を確認しに行けるか」だからである。
     * 確認しに行ける先が無い作品では、同じ欄が「なぜ出していないか」を言う。
     */
    evidenceHead: '確認できるもの',
    /** #30 — 公開されている作品コードへ直接送る CTA。 */
    sourceCta: '公開コードを見る',
    /*
     * #30 HD-G — 代表作に付く小さな表示ラベル。編集上の強弱であって、技術力の
     * 評価でも品質の順位でもない。補助作品の側に対になる語を置かないのは、
     * 「代表作ではない」を名乗るラベルが必ず評価語として読まれるからである。
     */
    featuredPrimary: '代表作',
    /*
     * #30 — `portfolioProfile` の enum を読者向けの語にする対応表。
     *
     * JSON 側へ日本語を二重に持たせない。作品レコードが持つのは enum だけで、
     * 表示語はここにしか無い——両方に置けば、片方だけ直した日に作品が別のことを
     * 言い出す。語は #29 が schema.ts に書いた各 enum 値の定義からの転記で、
     * 新しい判断を足していない。
     */
    profileLabels: {
      personal: '個人開発',
      collaborative: '共同プロジェクト',
      'public-reconstruction': '公開用再構成',
      'technical-demo': '技術デモ',
    },
    fieldsTableLabel: 'extracted fields ({count})',
    /*
     * The two return labels, and the reason they are not `allWorksCta`.
     *
     * `register.allWorksCta`（作品一覧へ）is a FORWARD move: it sits in 02 MORE
     * PROJECTS and offers a reader who is browsing the homepage the longer
     * list. These two are the opposite gesture — you are inside something and
     * going back out of it — and a return band that said 「作品一覧へ」 would
     * name the destination while saying nothing about the direction.
     *
     * Both were written by the requester, not here. They are `authored`
     * `presentation`: a label makes no claim about the world, so the matrix
     * asks no basis of them, but it does ask that a person approved the
     * wording — and the person who approved it is the one who wrote it.
     */
    backToIndex: '作品一覧に戻る',
    /** `fill(backToWork, { title })`. The work names itself in the link. */
    backToWork: '{title} に戻る',
  },

  howIBuild: {
    workflowLabel: 'Workflow',
    workflowCount: '{count} steps',
    rolesLabel: 'Roles',
    rolesHead: 'ROLES',
    rolesSub: '誰が何を持つか',
    intentLabel: 'Intent',
    notClaimed: '主張しないこと',
    sourceLabel: 'Source',
    /*
     * #31 — /how-i-build/ の判断事例ブロック。
     *
     * 語は Issue #31 comment 5747573639 §8 が列挙した 9 語をそのまま使う。
     * 新しく言葉を選んでいないのは、この欄の見出しが「何を書く欄か」を決めて
     * しまうからである——「工夫」「こだわり」のような語を置けば、公開 PR が
     * 記録していない性質の話を書ける欄になる。問題 / 確認した事実 / 判断 /
     * 結果 / 検証 は、書ける内容を PR が記録している範囲に閉じる。
     *
     * `AI案` という語がここに無いのは意図である。PR #18 / #20 の本文は、
     * 最初にあった設計を誰が出したかを述べていない。述べていないことを
     * ラベルにすれば、それは転記ではなく Portfolio 側が足した主張になる。
     * この欄が示すのは、調査・計測・採否・検証を誰が持っているかであって、
     * 最初の案の出どころではない。
     */
    casesLabel: '判断事例',
    casesCount: '{count} 件',
    caseProblem: '問題',
    caseObserved: '確認した事実',
    caseDecision: '判断',
    caseResult: '結果',
    /** 折りたたみの summary。中身は実測値・test・検証条件。 */
    caseVerification: '検証',
    /** 公開 PR へ送る CTA。URL は `publicPrUrl` が `site.repo` から組み立てる。 */
    openPr: '公開PRで確認する',
    /** #31 HD-J — PR #19 は 3 件目の事例ではなく、この補足記録として出る。 */
    qaLabel: 'QA / 検証記録',
    /*
     * #31 — /how-i-build/ 右下の固定リンクのアクセシブル名。
     *
     * 見えている面は矢印 1 つで、この語は `aria-label` として出る。語そのものを
     * 44px の操作面に並べると幅 130px 前後の帯になり、最下部までスクロールした
     * とき Footer のリンクの上に常時居座る。読み上げには語が要り、画面には
     * Footer が要る——両方を満たす置き方がこれである。
     */
    toTop: 'ページ上部へ戻る',
  },

  stack: {
    languagesLabel: 'Languages',
    count: '{count} 件',
    platformLabel: 'Platform',
    platformHead: 'PLATFORM / CROSS-CUTTING',
    platformSub: '作品をまたぐ層',
    tableHeaders: { detail: '内容', work: '作品', source: '出所' },
  },

  principles: {
    decisionsLabel: 'Decisions',
    count: '{count} 件',
    head: 'KEY TECHNICAL DECISIONS',
    sub: '作品 / 判断 / 理由 / 出所',
  },

  /**
   * 06 ABOUT and 07 CONTACT carry no pending state — IMPLEMENT-03 §5.
   *
   * The prototype's five pending strings (`about.railNote`,
   * `about.pendingHead`, `about.pendingSub`, `contact.pendingKey`,
   * `contact.pendingValue`) are gone, and `contact.note` lost its second
   * sentence with them. They were the right thing in a prototype, where 未記入
   * is a message to the people building it. On a public site the audience is a
   * reader, and to a reader a row that reads 未記入 is not a status — it is the
   * site listing what it does not have. The section now shows the facts the
   * repositories confirm, and says nothing about the ones nobody has provided.
   *
   * The removal is a deletion only. No replacement sentence was written, which
   * is what keeps PROFILE_INVENTED = NO true through the change.
   */
  /*
   * #8 — CONTACT stopped ending on a disclaimer and started ending on a way in.
   *
   * `note` held the synthetic-data sentence. That sentence is true and it stays
   * on the site, but CONTACT is the one section whose job is to be used, and
   * the last thing a reader met there was a statement about what the screens
   * are NOT. The claim now sits where the screens are: every figure carries its
   * own caption, 04 ABOUT keeps the full sentence among its premises, and the
   * strip stays on the pages that ARE the screens — /work/<slug>/, their
   * technical pages, /how-i-build/ and /404 (#8 §16). The /work/ archive has
   * carried no strip since #7; it lists works and shows none of them.
   *
   * TWO CHANNELS, TWO JOBS, AND THEY DO NOT BLUR (U-01 resolved).
   *
   *   emailCta   「メールで相談する」 — the one link here that SENDS. It is the
   *              section's conversion point and #8's success condition
   *              (「CONTACTから最低1つ明確な相談導線がある」), met at last.
   *   channels   says where the code can be READ, and
   *   githubCta  goes there. Neither claims to carry a message: a GitHub
   *              profile has no inbox, and before the address existed this
   *              section said so rather than dressing the GitHub link up as a
   *              way to make contact.
   *
   * THE ADDRESS WAITED FOR ITS OWNER. #6 searched the repository and found only
   * `@example.com` fixtures; publishing anything on that basis would have meant
   * choosing, for someone else, which of their addresses is public. It is a
   * `user-fact` in the registry — the first one this site has — which is the
   * classification that requires a real approver and refuses a
   * plausible-looking placeholder.
   */
  contact: {
    channels: '実装例・公開コード・リポジトリは GitHub で確認できます。',
    emailCta: 'メールで相談する',
    githubCta: 'GitHub で実装を見る',
    /*
     * #30 — 作品別の公開コード一覧の見出し。
     *
     * `channels` は「GitHub で読める」と言うだけで、どの作品のコードが読めるの
     * かは言っていなかった。この欄はその不足だけを埋める。一覧そのものは固定
     * 配列ではなく、出荷中の作品のうち source が linkable なものから導出する
     * ——ここに作品名を書けば、リンクを出す / 出さないの判断が 2 か所になる。
     */
    publicCode: '公開コード',
  },

  mobileBar: {
    work: 'Work',
    contact: 'Contact →',
  },

  /** 0 works is a supported state, not an error state. */
  empty: {
    triptych: '作品未登録 — SELECTED WORK は 0 件でも成立する',
    selectedWork: '01 — 未登録。SELECTED WORK はデータ駆動で、0 件でもこの節は成立する',
  },

  register: {
    railLabels: ['WORK INDEX', 'Register'],
    railNote: '0 → 20 works',
    h1: '{count} 件。同じ規則で 20 件まで伸びる。',
    // The spaces between sentences are the frozen screen's own: the source set
    // each clause on its own line and HTML collapsed the breaks to spaces,
    // which is where the lines wrap. Same for `variantNote` below.
    lede:
      '1 件が 1 行。行の順序・番号・信号色・レイアウト変種はコンテンツ側で宣言します。 ' +
      'ビルドが拒否するのは、変種の種類が足りずに一様な格子へ退化することであって、 ' +
      '隣り合う 2 件が同じ変種を取ること自体ではありません。 ' +
      '行に出るのは製品種別と言語で、主張ではありません。',
    /** #7 — 02 MORE PROJECTS' route into the full archive. */
    allWorksCta: '作品一覧へ',
    emptySlot: '{index} — 未登録',
    // ADAPTED — reference target only (was: positioning.WORKS に 1 要素を足すだけ)
    emptySlotHint: ' · 追加は src/content/work/ に 1 ファイルを足すだけ',
    variantRailLabels: ['レイアウト変種', 'Variant assignment'],
    variantHead: 'PROJECT VARIATION SYSTEM',
    variantSub: 'L1 共通システム / L2 レイアウト変種 / L3 作品固有トークン',
    variantHeaders: ['作品', '製品種別', '言語', 'entry (L2)', 'case (L2)', 'signal (L3)'],
    // ADAPTED — reference target only (was: positioning.WORKS の 1 要素だけ)
    variantNote:
      '変種は閉じた集合です。entry は {names} の {size} 種で、 ' +
      'renderer を持つものだけが集合に入ります。 ' +
      'いまの {count} 件では {floor} 種以上を使うことがビルドの条件です。 ' +
      '作品を足す人が触るのは src/content/work/ の 1 ファイルだけで、 ' +
      'Homepage の component は変更しません。',
  },

  /** The entry page for a single work — prototype screen 04-crm-entry. */
  workPage: {
    railIndex: '01',
    railLabels: ['SELECTED WORK'],
    railEntry: 'Entry — {title}',
  },

  /**
   * The Case Study page. Section names are CASE_TOC verbatim (content.py) — the
   * same CS-1 … CS-16 order design-freeze §1 item 8 froze. None of them was
   * written here; a heading that names a section is as much a claim about what
   * the page contains as the prose under it.
   */
  caseStudy: {
    /*
     * THE RAIL INDEX IS A LETTER, NOT `00`.
     *
     * It was `00`, which is the homepage HERO's index — the same glyph in the
     * same slot on two pages that are not the same page. And it was a NUMBER
     * on a page that is not a band of anything, while the two other subpage
     * types already named themselves with letters: `/how-i-build/` draws `M`
     * and `/work/<slug>/technical/` draws `T`.
     *
     * So the rule is stated rather than half-kept: a DIGIT is a section's
     * position inside the homepage's running order, and a LETTER is the type of
     * a page below it. `C` completes `C / T / M`.
     *
     * `/work/`'s index stays the work COUNT and `/404`'s stays `404`. Neither
     * is a section number and neither is ambiguous — the archive's h1 already
     * says WORK INDEX, and a count is a readout the page is for.
     */
    railIndex: 'C',
    railLabels: ['CASE STUDY'],
    contents: '目次',
    contentsLabel: 'Contents',
    sections: {
      overview: 'このシステムは何をするか',
      problem: '想定業務課題',
      currentPractice: '使う人と、いまのやり方',
      requirements: '満たすべきこと',
      built: '作ったもの',
      decisions: 'なぜこの設計にしたか',
      highlights: '見どころ',
      role: '実装範囲',
      quality: '品質の担保方法',
      safety: '安全性とデータの扱い',
      delivery: '運用と納品物',
      scope: 'できること・含めていないこと',
      scale: '規模の目安',
      capabilities: '対応可能な作業の例',
      technical: '技術詳細',
      repository: '証拠へのリンク',
    },
    requirementsFunctional: '機能',
    requirementsConstraints: '制約',
    rejected: '却下した案',
    tradeoff: '代償',
    deliveryHeaders: ['区分', '内容'],
    scopeHeaders: ['Implemented', 'Not Included', 'Why'],
    scaleHeaders: ['項目', '実測値', '取得方法'],
    technicalCta: '技術詳細のページへ',
    evidenceLabel: 'Evidence',
    /*
     * #8 §15. A GitHub Actions run page is not always readable to a signed-out
     * visitor, so a link to one can dead-end with no explanation. The note is
     * rendered only when a link actually points at a run — a standing caveat
     * under every repository list would be a caveat about links that do not
     * need one.
     */
    repositoryAuthNote:
      'CI 実行ログは GitHub Actions で確認できます。閲覧には GitHub へのサインインが必要な場合があります。',
  },

  /**
   * The Technical page — design-freeze §1 item 9, whose 正本 is
   * `frender.py: technical()`: a section index rail beside the body, with the
   * T-0 … T-8 headings that renderer names.
   */
  technical: {
    railLabels: ['TECHNICAL'],
    sectionsLabel: 'Sections',
    // No `railEntry` template here, and no "back to Case Study" label. Both
    // would have been strings written for this site, and neither exists in any
    // frozen source — so the rail carries the work's own title, and the return
    // link reuses `work.caseStudyCta`, which is transcribed and registered.
    sections: {
      about: 'このページについて',
      architecture: 'Architecture',
      why: 'Why this architecture',
      failureModes: 'Failure modes',
      tradeOffs: 'Trade-offs',
      tests: 'Tests',
      security: 'Security / Data handling',
      limitations: 'Limitations',
      scale: 'Scale',
      links: 'Links',
    },
    aboutFields: {
      target: '対象',
      claimSource: '公開 claim の正本',
      role: '実装形態',
      notIncluded: '含めていないもの',
    },
    testBreakdownHeaders: ['領域', '内容'],
    designDocsHead: '設計文書の読む順',
  },
} as const;

/** `fill('{count} 件', { count: 3 })` → `'3 件'` */
export function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (s, [k, v]) => s.replaceAll(`{${k}}`, String(v)),
    template,
  );
}

/**
 * Paths that hold data, not copy, and so are not shipping strings.
 *
 * `work.fieldLabels[].key` names a field on the work record; it is used to read
 * a value, never rendered. Listing the exemptions here rather than inferring
 * them keeps the gate honest: an exemption is a decision someone made, and it
 * should be visible next to the rule it exempts.
 */
export const NON_SHIPPING = new Set(['key']);

export interface UiString {
  /** Dotted path into `ui`, e.g. `evidence.provenanceLabels.sha`. */
  path: string;
  text: string;
}

/**
 * Every shipping string in `ui`, flattened. This is the surface the UI copy
 * gate holds the registry against — derived by walking the object rather than
 * maintained as a second list, so the two cannot fall out of step.
 */
export function uiStrings(node: unknown = ui, path = ''): UiString[] {
  if (typeof node === 'string') {
    const leaf = path.slice(path.lastIndexOf('.') + 1);
    return NON_SHIPPING.has(leaf) ? [] : [{ path, text: node }];
  }
  if (Array.isArray(node)) {
    return node.flatMap((child, i) => uiStrings(child, `${path}.${i + 1}`));
  }
  if (node && typeof node === 'object') {
    return Object.entries(node).flatMap(([k, child]) =>
      uiStrings(child, path ? `${path}.${k}` : k),
    );
  }
  return [];
}
