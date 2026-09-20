/**
 * Approved copy is immutable.
 *
 * The user approved a first set of homepage sentences on 2026-08-28, the five
 * 404 strings on 2026-08-29, the V4 hero and work copy on 2026-09-07, and the
 * CONTACT helper line on 2026-09-19 (#34). An
 * approval covers the sentence that was read, not the slot it sat in — so
 * rewording an approved string has to fail the build rather than ship under an
 * approval record that no longer describes it.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  APPROVAL_BATCHES,
  APPROVED_TEXT,
  PENDING_APPROVAL,
} from '../src/lib/content/approved-text.ts';
import { loadAll, loadCopy } from '../src/lib/content/load.ts';
import { approvedCopyGate } from '../src/lib/validation/approved-copy.ts';
import { codes } from './helpers.ts';

/**
 * Nothing on this site is derived copy any more — V4 rewrote the hero lede
 * into a sentence that states no count. The gate's derived-copy check still
 * has to work, so these tests hand it one by name: a registered id, rendered
 * as it is approved and rendered as it is not.
 */
const asApproved = [{ id: 'home.works.h2', rendered: APPROVED_TEXT['home.works.h2']! }];

describe('approved copy gate', () => {
  it('passes the registry as it stands', () => {
    assert.deepEqual(approvedCopyGate(loadCopy(), asApproved), []);
  });

  it('covers all thirty approved strings, each in exactly one batch', () => {
    assert.equal(Object.keys(APPROVED_TEXT).length, 30);

    const [homepage, notFound, v4, workLede, issue6, issue8, email, guidance, withheld, premises] =
      APPROVAL_BATCHES;
    assert.ok(
      homepage &&
        notFound &&
        v4 &&
        workLede &&
        issue6 &&
        issue8 &&
        email &&
        guidance &&
        withheld &&
        premises,
    );
    assert.equal(APPROVAL_BATCHES.length, 10);
    assert.deepEqual(
      // 6 before #8. `home.about.h2` was REWORDED there and moved to the #8
      // batch with its new sentence, because this batch approved
      // 「リポジトリから確認できることだけ。」 and that sentence is no longer on
      // the site — one batch per id, the same move the display lines made.
      [homepage.by, homepage.at, homepage.ids.length],
      ['user', '2026-08-28T21:20:25Z', 5],
    );
    assert.deepEqual(
      [notFound.by, notFound.at, notFound.ids.length],
      ['user', '2026-08-29T06:10:37Z', 5],
    );
    assert.deepEqual(
      [v4.by, v4.at, v4.ids.length],
      // 11 before #7. `home.hero.role.02` and the three display lines left for
      // the #6 batch that approved their current text — one batch per id.
      ['user', '2026-09-07T22:24:15Z', 6],
    );
    assert.deepEqual(
      [issue6.by, issue6.at, issue6.ids.length],
      ['user', '2026-09-13T00:13:13Z', 6],
    );
    assert.deepEqual(
      [workLede.by, workLede.at, [...workLede.ids]],
      ['user', '2026-09-09T10:05:34Z', ['home.works.lede']],
    );
    // A reworded string moves to the batch that approved its current text.
    // Being listed in both would leave no way to say which event approved the
    // sentence that ships, and `A-BATCH` fails the build for exactly that.
    assert.equal(homepage.ids.includes('home.hero.lede'), false);
    assert.equal(v4.ids.includes('home.hero.lede'), false);
    assert.equal(issue6.ids.includes('home.hero.lede'), true);
    assert.equal(homepage.ids.includes('home.about.h2'), false);
    assert.equal(issue8.ids.includes('home.about.h2'), true);

    // #8 — approved on PR #17, and the timestamp is that comment's, not the
    // issue's created_at and not a commit time. An earlier draft used the
    // issue's and asserted an approval nobody had given.
    assert.deepEqual(
      [issue8.by, issue8.at, [...issue8.ids]],
      [
        'user',
        '2026-09-13T07:17:12Z',
        [
          'home.about.h2',
          'ui.contact.channels',
          'ui.contact.githubCta',
          'ui.caseStudy.repositoryAuthNote',
        ],
      ],
    );
    assert.match(issue8.task, /PR #17 comment 5651891248/);

    // U-01 — a SEPARATE occasion, 18 minutes after the one above and covering
    // different strings. Folding these into the batch above would have been
    // less typing and would have backdated the address to an approval that did
    // not mention one.
    assert.deepEqual(
      [email.by, email.at, [...email.ids]],
      [
        'user',
        '2026-09-13T07:35:52Z',
        ['home.contact.emailKey', 'home.contact.email', 'ui.contact.emailCta'],
      ],
    );
    assert.match(email.task, /PR #17 comment 5651971896/);
    assert.notEqual(email.at, issue8.at);

    // #34 — 補助文。住所を承認した機会（2026-09-13）とは別の occasion で、
    // 別の文である。前のバッチに足せば、その日には存在しなかった文を
    // その日に承認されたものとして記録することになる。`at` は他のバッチと
    // 同じく承認記録の時刻——Issue #34 comment 5741442820 の時刻である。
    assert.deepEqual(
      [guidance.by, guidance.at, [...guidance.ids]],
      ['user', '2026-09-19T11:26:31Z', ['home.contact.helper']],
    );
    assert.match(guidance.task, /Issue #34/);
    assert.notEqual(guidance.at, email.at);

    // #30 HD-I — コードリンクを掲載しない作品の説明文。#34 のバッチが承認したの
    // は CONTACT の補助文で、この文ではない。別の occasion、別の文、別のバッチ。
    assert.deepEqual(
      [withheld.by, withheld.at, [...withheld.ids]],
      ['user', '2026-09-20T01:11:07Z', ['home.works.sourceWithheld']],
    );
    assert.match(withheld.task, /Issue #30 comment 5746615341/);
    assert.notEqual(withheld.at, guidance.at);

    // #31 追加 Human Decision — 「開発の前提」。REWORD ではなく REPLACEMENT で
    // ある: 置き換わった 2 文は site.json の節内容として出ていて、どの承認
    // バッチにも APPROVED_TEXT にも無かった。だから旧バッチから移動した id は
    // 無く、registry の外にあった文が承認を持って中へ入っている。
    //
    // 見出しの行 `ui.howIBuild.premises` が同じバッチにいるのは、同じ
    // コメントで同じ人が同時に指定した語だからである。ui.json の行なので
    // APPROVED_TEXT には入らない——下の「スナップショットより広い」節と、
    // 両 registry を跨ぐテストがその差を受け持っている。
    assert.deepEqual(
      [premises.by, premises.at, [...premises.ids]],
      [
        'user',
        '2026-09-20T05:37:32Z',
        ['method.premise.01', 'method.premise.02', 'ui.howIBuild.premises'],
      ],
    );
    assert.match(premises.task, /Issue #31 comment 5747908981/);
    assert.notEqual(premises.at, withheld.at);

    const ids = APPROVAL_BATCHES.flatMap((b) => [...b.ids]);
    assert.equal(new Set(ids).size, ids.length);

    /*
     * Batches cover MORE than the snapshot now, and the difference is a fact
     * about where a string lives rather than a gap.
     *
     * APPROVED_TEXT is the frozen text of `shipping.json`, which is the only
     * registry `approvedCopyGate` reads. #8's approval also covered three UI
     * chrome strings, and those live in `ui.json` — putting them in
     * APPROVED_TEXT would make `A-MISSING` fire, because the gate would look
     * for them in a collection they are not in.
     *
     * So: every snapshot id is batched (nothing approved is unattributed), and
     * every batched id NOT in the snapshot is a ui row — held to its batch's
     * by / at by `keeps every batched id approved in its own registry` below,
     * which is the check that spans both registries.
     */
    for (const id of Object.keys(APPROVED_TEXT)) {
      assert.ok(ids.includes(id), `${id} がどのバッチにも属していない`);
    }
    const uiOnly = ids.filter((id) => !(id in APPROVED_TEXT));
    assert.deepEqual(uiOnly.sort(), [
      'ui.caseStudy.repositoryAuthNote',
      'ui.contact.channels',
      'ui.contact.emailCta',
      'ui.contact.githubCta',
      // #31 — 「開発の前提」の見出し。本人が本文 2 文と同じコメントで指定した
      // 語で、ui.json の行なのでここに来る。
      'ui.howIBuild.premises',
    ]);
    assert.equal(uiOnly.every((id) => id.startsWith('ui.')), true);
  });

  it('cannot approve new copy without naming who approved it', () => {
    // The forward contract. Legacy records that predate approval batches keep
    // their null approver as reported debt, but a NEW approval cannot join
    // them: three existing rules already close every route in.
    const rows = loadCopy();
    const first = rows[0]!;

    // (1) approved, but no snapshot entry — there is nothing that was read
    const invented = { ...first, id: 'home.hero.newclaim' };
    assert.ok(codes(approvedCopyGate([...rows, invented], asApproved)).includes('A-UNKNOWN'));

    // (2) in the snapshot and in a batch, but the row names nobody
    const unattributed = {
      ...first,
      publication: { ...first.publication, approvedBy: null, approvedAt: null },
    };
    assert.ok(
      codes(approvedCopyGate([...rows.slice(1), unattributed], asApproved)).includes('A-BATCH'),
    );

    // (3) the row names someone, but not the person the batch records
    const selfSigned = {
      ...first,
      publication: { ...first.publication, approvedBy: 'claude', approvedAt: '2026-09-06T00:00:00Z' },
    };
    assert.ok(
      codes(approvedCopyGate([...rows.slice(1), selfSigned], asApproved)).includes('A-BATCH'),
    );
  });

  it('has every approved copy row attributed, and says so', () => {
    // The counterpart to APPROVAL_ATTRIBUTION in validate-content: every row
    // in this collection that CLAIMS approval names who and when. 24 before #8;
    // `home.about.h2` is 23rd-plus-one no longer, because it is in_review and
    // claims nothing. The invariant is about the approved ones, so it is
    // counted off the filter rather than off the file length.
    const rows = loadCopy();
    const approved = rows.filter((r) => r.publication.reviewStatus === 'approved');
    // 28 before #31; the two 開発の前提 sentences are the 29th and 30th.
    assert.equal(approved.length, 30);
    assert.equal(
      approved.filter((r) => r.publication.approvedBy && r.publication.approvedAt).length,
      30,
    );
    // Nothing is half-set: no row is waiting, and none claims approval without
    // naming who and when.
    assert.deepEqual(rows.filter((r) => r.publication.reviewStatus !== 'approved'), []);
  });

  it('holds the capability rail as three approved pairs in the registry', () => {
    // The rail is a name and a line for each of three axes. `check:structure`
    // holds the RENDERED rail at three rows; this holds the six strings behind
    // it, so a rail that renders three rows cannot be doing it from copy that
    // was never approved.
    const registered = new Map(loadCopy().map((c) => [c.id, c]));
    for (const n of ['01', '02', '03']) {
      for (const part of ['key', 'value']) {
        const id = `home.hero.capability.${n}.${part}`;
        const row = registered.get(id);
        assert.ok(row, `${id} が copy registry に無い`);
        assert.equal(row.text, APPROVED_TEXT[id]);
        assert.equal(row.publication.reviewStatus, 'approved');
        assert.equal(row.publication.approvedAt, '2026-09-07T22:24:15Z');
      }
    }
    assert.equal(registered.has('home.hero.capability.04.key'), false);
  });

  it('ships the 404 copy the user approved, verbatim', () => {
    // The four lines the user read, in the order they appear on the page. The
    // registry rows are checked against these by `approvedCopyGate` above; this
    // is the literal the task approved, kept where a reviewer can read it.
    assert.equal(APPROVED_TEXT['notfound.code'], '404');
    assert.equal(APPROVED_TEXT['notfound.h1'], 'ページが見つかりません。');
    assert.equal(APPROVED_TEXT['notfound.body.01'], 'URLが変更されたか、');
    assert.equal(APPROVED_TEXT['notfound.body.02'], 'ページが存在しない可能性があります。');
    assert.equal(APPROVED_TEXT['notfound.back'], 'Portfolioへ戻る');

    const registered = new Map(loadCopy().map((c) => [c.id, c]));
    for (const id of ['notfound.code', 'notfound.h1', 'notfound.back']) {
      const row = registered.get(id);
      assert.ok(row, `${id} が copy registry に無い`);
      assert.equal(row.publication.reviewStatus, 'approved');
      assert.equal(row.publication.approvedBy, 'user');
      assert.equal(row.publication.approvedAt, '2026-08-29T06:10:37Z');
      assert.equal(row.route, '/404.html');
    }
  });

  it('fails when a row records an approval date no batch backs', () => {
    const copy = structuredClone(loadCopy());
    const target = copy.find((c) => c.id === 'notfound.h1');
    assert.ok(target);
    target.publication.approvedAt = '2026-08-28T21:20:25Z'; // the other batch

    const findings = approvedCopyGate(copy, asApproved);
    assert.deepEqual(codes(findings), ['A-BATCH']);
    assert.match(findings[0]!.message, /notfound\.h1/);
  });

  it('fails when an approved string is reworded', () => {
    const copy = structuredClone(loadCopy());
    const target = copy.find((c) => c.id === 'home.works.h2');
    assert.ok(target);
    target.text = '何のためのサービスを、どこまで作ったのか。'; // 実装した → 作った

    const findings = approvedCopyGate(copy, asApproved);
    assert.deepEqual(codes(findings), ['A-CHANGED']);
  });

  it('reports the id, the approved text and the current text', () => {
    // Was driven through `home.about.h2`, which #8 took out of the snapshot —
    // an id with no approved text cannot drift from one. Any approved id
    // demonstrates the same message, so the test names one it still has.
    const copy = structuredClone(loadCopy());
    const target = copy.find((c) => c.id === 'home.works.h2');
    assert.ok(target);
    const before = target.text;
    target.text = '何のためのサービスを、どこまで作ったのか。';

    const [finding] = approvedCopyGate(copy, asApproved);
    assert.ok(finding);
    assert.match(finding.message, /home\.works\.h2/);
    assert.match(finding.message, new RegExp(before));
    assert.match(finding.message, /何のためのサービスを、どこまで作ったのか。/);
  });

  it('fails when an approved string is missing from the registry', () => {
    const copy = structuredClone(loadCopy()).filter((c) => c.id !== 'home.stack.note');
    assert.equal(codes(approvedCopyGate(copy, asApproved)).includes('A-MISSING'), true);
  });

  it('fails when the registry claims an approval the snapshot does not record', () => {
    const copy = structuredClone(loadCopy());
    const first = copy[0];
    assert.ok(first);
    copy.push({ ...structuredClone(first), id: 'home.hero.slogan', text: '未承認の一文' });
    assert.equal(codes(approvedCopyGate(copy, asApproved)).includes('A-UNKNOWN'), true);
  });

  it('fails when a derived string no longer renders its approved form', () => {
    // Nothing is derived today, so the subject is supplied. What the gate has
    // to keep doing is hold a COMPUTED string to the approval that covers it:
    // approval is of a sentence, and a template that renders a different one
    // is not covered by it.
    const findings = approvedCopyGate(loadCopy(), [
      { id: 'home.works.h2', rendered: '何のためのサービスを、どこまで作ったのか。' },
    ]);
    assert.deepEqual(codes(findings), ['A-DERIVED']);
    assert.match(findings[0]!.message, /home\.works\.h2/);
  });

  it('ships the hero copy the user approved in #6, verbatim', () => {
    // Two lines, not three, and the claim is fitness rather than track record:
    // 「実際に使われる」 would say these works are in live use, which is a
    // claim this site makes nowhere else (#6 spec §4.1).
    assert.equal(APPROVED_TEXT['home.hero.display.01'], '業務課題を、');
    assert.equal(APPROVED_TEXT['home.hero.display.02'], '業務で使える Web・AI システムへ。');
    assert.equal(APPROVED_TEXT['home.hero.display.03'], undefined);
    assert.equal(APPROVED_TEXT['home.hero.role.02'], '業務システム / AI 活用 / 業務自動化');
    assert.equal(APPROVED_TEXT['home.hero.cta.primary'], '実績を見る');
    assert.equal(APPROVED_TEXT['home.hero.cta.secondary'], '相談する');

    // No count anywhere in the V4 hero and work copy. That is the property
    // that let `heroLede` and `capabilityVerify` be deleted rather than turned
    // into literals — a static string with a "3" in it is the defect those
    // derivations existed to prevent.
    for (const id of [
      ...APPROVAL_BATCHES[2]!.ids,
      ...APPROVAL_BATCHES[3]!.ids,
      ...APPROVAL_BATCHES[4]!.ids,
    ]) {
      assert.doesNotMatch(APPROVED_TEXT[id]!, /\d+\s*(作品|つの動くデモ|tests|passed)/);
    }
  });

  /*
   * The waiting room, held shut from both sides.
   *
   * PENDING_APPROVAL is empty now — #8's four strings were approved on PR #17 —
   * and the assertions below are what make it safe for it to be empty. The
   * failure they guard against is the tidy one: a row flipped to `approved` to
   * get a green build, shipping a sentence under an approval nobody gave.
   *
   * Both halves are checked, because either alone can hold while the defect is
   * present — a batch entry with no registry change, or a registry change with
   * no batch, each look fine from the other side.
   *
   * AND IT SPANS BOTH REGISTRIES, which `approvedCopyGate` does not: that gate
   * only sees `shipping.json`, so three of #8's four ids live in `ui.json`
   * where A-BATCH cannot compare them. Without this, a batch could name a ui
   * string whose row said something else entirely.
   */
  it('keeps every batched id approved in its own registry, with the batch by / at', () => {
    assert.deepEqual([...PENDING_APPROVAL], []);

    const { copy, uiCopy } = loadAll();
    const rows = new Map([...copy, ...uiCopy].map((c) => [c.id, c]));

    for (const batch of APPROVAL_BATCHES) {
      for (const id of batch.ids) {
        const row = rows.get(id);
        assert.ok(row, `batch ${batch.task} が registry に無い id ${id} を挙げている`);
        assert.equal(row.publication.reviewStatus, 'approved', id);
        assert.equal(row.publication.approvedBy, batch.by, id);
        assert.equal(row.publication.approvedAt, batch.at, id);
      }
    }
  });

  /*
   * U-01. The address is the one piece of personal information this site
   * publishes, so what it may say is pinned rather than left to review.
   */
  it('publishes exactly one contact address, and nothing else personal', () => {
    const { copy, uiCopy } = loadAll();
    const all = [...copy, ...uiCopy];

    // Exactly one address, and it is the one that was approved.
    const withEmail = all.filter((c) => /@[a-z0-9.-]+\.[a-z]{2,}/i.test(c.text));
    assert.deepEqual(withEmail.map((c) => c.id), ['home.contact.email']);
    assert.equal(withEmail[0]!.text, 'kanda02.1203@gmail.com');

    // Nothing else personal joined it. A phone number or a postal address
    // would be a second `user-fact` shipping on the strength of this one's
    // approval, which covered an email and only an email.
    for (const c of all) {
      assert.doesNotMatch(c.text, /\b0\d{1,4}-\d{1,4}-\d{3,4}\b/, `${c.id} に電話番号`);
      assert.doesNotMatch(c.text, /〒\s*\d{3}-?\d{4}/, `${c.id} に郵便番号`);
      assert.doesNotMatch(c.text, /(twitter|x)\.com\/|instagram\.com\/|facebook\.com\//i, `${c.id} に SNS`);
    }
  });

  it('holds the #8 strings at the wording the owner approved', () => {
    const { copy, uiCopy } = loadAll();
    const text = new Map([...copy, ...uiCopy].map((c) => [c.id, c.text]));
    assert.equal(text.get('home.about.h2'), '業務要件を整理し、設計から実装・運用まで形にする。');
    assert.equal(
      text.get('ui.contact.channels'),
      '実装例・公開コード・リポジトリは GitHub で確認できます。',
    );
    assert.equal(text.get('ui.contact.githubCta'), 'GitHub で実装を見る');
    assert.equal(
      text.get('ui.caseStudy.repositoryAuthNote'),
      'CI 実行ログは GitHub Actions で確認できます。閲覧には GitHub へのサインインが必要な場合があります。',
    );

    // The GITHUB pair still says READ, never SEND — that separation is the
    // point of having two channels, and it survives U-01 being resolved. The
    // email CTA is the one string in this section allowed to promise a reply.
    for (const id of ['ui.contact.channels', 'ui.contact.githubCta']) {
      assert.doesNotMatch(text.get(id)!, /問い合わせ|お問合せ|連絡する|相談する|メール/);
    }
    assert.equal(text.get('ui.contact.emailCta'), 'メールで相談する');
    assert.equal(text.get('home.contact.emailKey'), '開発のご相談');
  });

  /*
   * #34 — 問い合わせ補助文。本人が承認したのは「何を書けばよいか」と
   * 「まずはメールで」の 2 点だけで、この文が言えることはそこで尽きている。
   */
  it('ships the #34 contact helper as the owner approved it', () => {
    assert.equal(
      APPROVED_TEXT['home.contact.helper'],
      '現状の業務・困りごと・希望時期が分かる範囲で構いません。まずはメールでご相談ください。',
    );

    const row = loadCopy().find((c) => c.id === 'home.contact.helper');
    assert.ok(row, 'home.contact.helper が copy registry に無い');
    assert.equal(row.text, APPROVED_TEXT['home.contact.helper']);
    assert.equal(row.section, '05 CONTACT');
    assert.equal(row.route, '/');
    assert.equal(row.publication.reviewStatus, 'approved');
    assert.equal(row.publication.approvedBy, 'user');
    // 公開承認記録（Issue #34 comment 5741442820）の時刻。registry と承認表は
    // 同じ記録の同じ時刻を指す。
    assert.equal(row.publication.approvedAt, '2026-09-19T11:26:31Z');
    const batch = APPROVAL_BATCHES.find((b) => b.ids.includes('home.contact.helper'));
    assert.ok(batch, 'home.contact.helper を含む承認バッチが無い');
    assert.equal(row.publication.approvedAt, batch.at);
    assert.equal(row.publication.approvedBy, batch.by);

    // 参照先は公開承認記録を指す。誰でも開いて読める承認コメントと、同じ
    // 確定文を載せた Issue #34 §5.1 の両方を挙げる。
    const refs = row.publication.sourceRefs;
    assert.equal(
      refs.some((r) => r.includes('Issue #34 comment 5741442820')),
      true,
      '公開承認記録が sourceRefs に無い',
    );
    assert.equal(
      refs.some((r) => r.includes('2026-09-19T11:26:31Z')),
      true,
      '承認記録の時刻が sourceRefs に無い',
    );
    assert.equal(
      refs.some((r) => r.includes('Issue #34 §5.1')),
      true,
      '確定文を記載した Issue #34 §5.1 が sourceRefs に無い',
    );

    // 約束していないことは言わない。見積り・返信期限・対応可能時期は本人が
    // 承認した 2 点に含まれておらず、この 1 文に紛れ込めば、サイトが本人に
    // 代わって条件を出したことになる。
    for (const word of ['見積', '無料', '営業日', '以内に', '即日', '返信', '対応可能']) {
      assert.equal(row.text.includes(word), false, `補助文が約束していない内容 ${word} を含む`);
    }

    // Email＝問い合わせ / GitHub＝実装確認 の分離（#8 §1）はこの文でも保たれる。
    // 補助文が送る先として名指すのはメールだけである。
    assert.match(row.text, /メール/);
    assert.doesNotMatch(row.text, /GitHub|リポジトリ/);
  });
});
