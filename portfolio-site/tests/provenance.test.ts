/**
 * The FACT provenance matrix.
 *
 * The point of holding the requirement as a table is that the table can be
 * checked: every combination decided exactly once, nothing left to a default,
 * and the two axes actually independent — which is the property V3 did not
 * have and could not have had with one field.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CLAIM_TYPES,
  SOURCE_TYPES,
  type ClaimType,
  type Publication,
} from '../src/lib/content/schema.ts';
import { loadAll } from '../src/lib/content/load.ts';
import {
  PROVENANCE_MATRIX,
  matrixCell,
  provenanceFindings,
  type BasisResolver,
} from '../src/lib/validation/provenance.ts';
import { codes } from './helpers.ts';

const publication = (over: Partial<Publication> = {}): Publication => ({
  reviewStatus: 'approved',
  sourceType: 'source-derived',
  sourceRefs: ['some/file.md:12'],
  approvedBy: null,
  approvedAt: null,
  ...over,
});

/**
 * `claimType` is an argument here for the same reason it is one in the gate:
 * it is a property of the statement being made, not of the publication record,
 * and only a registered string stores it.
 */
const run = (
  p: Publication,
  claimType: ClaimType = 'fact',
  value?: string,
  resolve?: BasisResolver,
) => codes(provenanceFindings({ id: 'copy/x', claimType, publication: p, value, resolve }, 'ERROR'));

/** An `authored` fact that already carries everything its cell asks for. */
const authoredFact = (over: Partial<Publication> = {}): Publication =>
  publication({
    sourceType: 'authored',
    approvedBy: 'user',
    approvedAt: '2026-09-06',
    ...over,
  });

describe('provenance matrix', () => {
  it('decides every claimType × sourceType exactly once', () => {
    assert.equal(PROVENANCE_MATRIX.length, CLAIM_TYPES.length * SOURCE_TYPES.length);
    for (const claimType of CLAIM_TYPES) {
      for (const sourceType of SOURCE_TYPES) {
        const rows = PROVENANCE_MATRIX.filter(
          (c) => c.claimType === claimType && c.sourceType === sourceType,
        );
        assert.equal(rows.length, 1, `${claimType} × ${sourceType}`);
        assert.ok(rows[0]!.why.length > 0, 'every cell states why');
      }
    }
  });

  it('asks a fact for its source, its basis, its approver, or its value', () => {
    assert.deepEqual(run(publication({ sourceType: 'source-derived', sourceRefs: [] })), [
      'T-NO-SOURCE',
    ]);
    // authored is asked for BOTH: the approval record and the grounds. An
    // approval on its own was the hole — it made "someone approved it" the
    // reason a claim was true.
    assert.deepEqual(run(publication({ sourceType: 'authored', sourceRefs: [] })), [
      'T-NO-BASIS',
      'T-NO-APPROVER',
    ]);
    assert.deepEqual(run(publication({ sourceType: 'user-fact' }), 'fact', '   '), [
      'T-EMPTY-FACT',
      'T-NO-APPROVER',
    ]);
  });

  it('refuses an authored fact whose only credential is that it was approved', () => {
    // the case this cell exists for: a claim about the world, written here,
    // carrying an approval and no grounds whatsoever.
    assert.deepEqual(run(authoredFact({ sourceRefs: [] })), ['T-NO-BASIS']);
    assert.deepEqual(run(authoredFact({ sourceRefs: ['', '   '] })), ['T-NO-BASIS']);
  });

  it('accepts an external locator as a basis, and a resolved record too', () => {
    // a planning document section is a real basis this repository cannot check
    assert.deepEqual(run(authoredFact({ sourceRefs: ['portfolio-positioning.md §4'] })), []);
    const resolve: BasisResolver = (ref) => (ref === 'work/crm' ? 'resolved' : 'external');
    assert.deepEqual(run(authoredFact({ sourceRefs: ['work/crm'] }), 'fact', undefined, resolve), []);
  });

  it('refuses a basis that names a record and points at nothing', () => {
    // worse than no basis: it reads as evidenced while resolving to nothing
    const resolve: BasisResolver = () => 'dangling';
    assert.deepEqual(
      run(authoredFact({ sourceRefs: ['evidence/CRM-V99'] }), 'fact', undefined, resolve),
      ['T-NO-BASIS'],
    );
  });

  it('asks nothing of a basis on a source-derived row', () => {
    // sourceRefs is read as a transcription locator there, not as grounds, so
    // a dangling-looking ref is not this cell's business
    const resolve: BasisResolver = () => 'dangling';
    assert.deepEqual(
      run(publication({ sourceRefs: ['evidence/CRM-V99'] }), 'fact', undefined, resolve),
      [],
    );
  });

  it('asks a presentation string for none of them', () => {
    assert.deepEqual(
      run(publication({ sourceType: 'source-derived', sourceRefs: [] }), 'presentation'),
      [],
    );
    assert.deepEqual(run(publication({ sourceType: 'authored' }), 'presentation'), []);
  });

  it('still refuses an empty user-fact even as presentation', () => {
    // an empty value is not a lighter claim, it is a hole in the page
    assert.deepEqual(run(publication({ sourceType: 'user-fact' }), 'presentation', ''), [
      'T-EMPTY-FACT',
    ]);
  });

  it('is satisfied by a record that carries what its cell asks for', () => {
    assert.deepEqual(run(publication()), []);
    assert.deepEqual(run(authoredFact()), []);
  });

  it('keeps shipping approval out of the table', () => {
    // T-UNAPPROVED is truth.ts's, and applies to every cell. The matrix never
    // reports it — conflating "publishable" with "true" is the thing the two
    // axes exist to stop.
    for (const cell of PROVENANCE_MATRIX) {
      assert.ok(
        !cell.requires.includes('sourceRefs' as never) || cell.claimType === 'fact',
        'only facts are asked for provenance',
      );
    }
    const draft = publication({ reviewStatus: 'draft' });
    assert.deepEqual(run(draft, 'presentation'), []);
  });

  it('refuses to guess when a combination has no row', () => {
    assert.throws(() => matrixCell('editorial' as never, 'authored'), /provenance matrix/);
  });

  it('classifies the shipping registries: 147 presentation, the rest fact', () => {
    // 24 facts before V4 Phase 3; the capability rail added six shipping
    // strings, each a claim about what this engineer can do and so each a fact.
    const { copy, uiCopy } = loadAll();
    const all = [...copy, ...uiCopy];
    const presentation = all.filter((c) => c.publication.claimType === 'presentation');
    const fact = all.filter((c) => c.publication.claimType === 'fact');
    // #7 added three ui-system labels (Role / Selected technology / the
    // archive CTA) and two authored hero CTAs.
    //
    // #8 leaves presentation where it was and adds one fact. It removed the
    // provenance 状態 label and added the GitHub CTA — both ui-system, both
    // presentation, and they cancel. The two sentences it added are editorial
    // and therefore FACTS: 「GitHubの公開情報もご確認いただけます」 and
    // 「GitHubへのサインインが必要な場合があります」 each assert something a
    // reader can find out is wrong, so each carries a basis and an approver
    // rather than the label exemption.
    //
    // The wayfinding change adds four: the breadcrumb's landmark name, the two
    // return labels, and the Case Study's rail letter. All four are `authored`
    // rather than `source-derived`, which is the first time labels on this site
    // were written for it rather than transcribed; they are still presentation,
    // because a label that says which way a link goes, or which kind of page
    // this is, asserts nothing about the world that a reader could find out is
    // wrong.
    //
    // It netted +3 on its own branch, because it also deleted
    // `nav.mobileIndex`. That deletion is NOT carried here. On that branch the
    // `Index` box was a span nothing listened to; on this one it is a
    // `<button>` over a disclosure panel, so the string is rendered and its row
    // is not an orphan. +4, not +3: 125 -> 129.
    //
    // #34 は fact を 1 つ足す。CONTACT の補助文はラベルでも見出しでもなく、
    // 本人が何を書いて送ってほしいかを述べた 1 文で、本人の受け方が違えば
    // 誤りになりうる。だから presentation の免除ではなく、根拠（Issue #34
    // §5.1 の本人指示）と承認者を持つ側に置かれている。
    //
    // #30 は presentation を 5、fact を 5 足す。
    //
    // presentation 5 件はすべてラベルである: 開発背景 / 確認できるもの /
    // 公開コードを見る / 代表作 / 公開コード。`代表作` を含めているのは、これが
    // homepage 上の編集上の強弱を示す表示であって、作品の品質や技術力について
    // 読み手が誤りだと分かりうることを述べていないからである。
    //
    // fact 5 件のうち 4 件は `portfolioProfile` の enum の表示語
    // （個人開発 / 共同プロジェクト / 公開用再構成 / 技術デモ）。これはラベルでは
    // なく値で、作品の成立背景を述べる——本人確認の結果が違えば誤りになる。
    // 5 件目は HD-I の 1 文で、shipping registry の側にある。
    //
    // #31 は presentation を 10 足し、fact を 1 件も足さない。これは偶然ではなく
    // この Issue の設計そのものである。判断事例の本文——計測値・棄却した案・
    // テストの本数——は世界について述べる FACT だが、その 1 文字も registry に
    // 入っていない。本文は `site.howIBuild.decisionCases` にあり、PR #18 / #19 /
    // #20 の該当節を `sourceRefs` に持つ source-derived な転記として扱われる。
    // registry に来たのは欄の名前だけ（判断事例 / 問題 / 確認した事実 / 判断 /
    // 結果 / 検証 / 公開PRで確認する / QA・検証記録 / ページ上部へ戻る と件数の
    // template）で、どれも「何の欄か」しか言っていない。
    //
    // 逆だったら誤りだった: 本文を authored な fact として registry へ入れれば、
    // 承認者の欄が空いた状態で 1,828ms や contract test 22 本を出すことになり、
    // その数値の正しさは公開 PR ではなく承認記録が支えていることになる。
    //
    // #31 追加 Human Decision は fact を 2 足し、presentation の数を動かさない。
    // fact 2 件は「開発の前提」の本文——`method.premise.01` / `.02`——で、
    // どちらも本人が承認した authored fact である。registry の外（site.json の
    // `notClaimed`）にあった文が、承認記録を持って中へ入ったぶんの +2 であり、
    // 新しく書かれた文ではない。
    //
    // presentation が動かないのは、見出しの行が置き換わっただけだからである:
    // `ui.howIBuild.notClaimed`（主張しないこと）が
    // `ui.howIBuild.premises`（開発の前提）になった。1 行が 1 行になっている。
    //
    // #32 は presentation を 3、fact を 3 足す。ABOUT の 3 ブロックで、
    // ラベルと本文がきれいに 2 軸へ分かれた例である。
    //
    // presentation 3 件はラベル（業務経験 / 掲載内容について / 公開データ）。
    // どれも「何の欄か」しか言っていない。本人が語を指定したので authored で、
    // 承認者を持つが、世界について述べていないので基礎は求められない。
    //
    // fact 3 件は本文である。業務経験は `user-fact`——本人しか Authority を
    // 持たない経歴で、この registry の 2 件目の user-fact になる。残る 2 件は
    // authored fact で、掲載内容は #29 の本人確認済み metadata を、公開データは
    // 各 README / PUBLISH-MAP と本人承認を基礎に持つ。
    //
    // 旧 3 行はここに現れない。site.json の節内容として出ていて registry の外に
    // あったので、置き換わったぶんの相殺は無く、3 件そのままの増加である。
    assert.equal(presentation.length, 147);
    assert.equal(fact.length, 44);

    // U-01 added three: the email row label and its CTA present, and the
    // address itself asserts. The address is also the registry's first
    // `user-fact` — the cell that demands a non-empty value AND an approver,
    // which is why the slot stayed empty until its owner filled it.
    //
    // #32 added the SECOND one, and it is the other item content-model §5 names:
    // 経歴. ABOUT carried no line about the owner's working background because
    // nobody had provided one, which is the same reason the address slot sat
    // empty — and it arrives the same way, with the subject's own wording and a
    // real approval, not with a plausible sentence written for them.
    const userFacts = all.filter((c) => c.publication.sourceType === 'user-fact');
    assert.deepEqual(
      userFacts.map((c) => c.id).sort(),
      ['home.about.experience', 'home.contact.email'],
    );
    for (const row of userFacts) {
      assert.equal(row.publication.claimType ?? 'fact', 'fact');
      assert.equal(row.publication.approvedBy, 'user');
      assert.ok(row.text.length > 0);
    }
    // ui-system is the registry's own word for label / heading / button, which
    // is what presentation means on this axis. Nothing else was reclassified.
    assert.equal(
      uiCopy.every((c) => (c.kind === 'ui-system') === (c.publication.claimType === 'presentation')),
      true,
    );
  });
});
