/**
 * Approved copy is immutable.
 *
 * The user approved a first set of homepage sentences on 2026-08-28, the five
 * 404 strings on 2026-08-29, and the V4 hero and work copy on 2026-09-07. An
 * approval covers the sentence that was read, not the slot it sat in — so
 * rewording an approved string has to fail the build rather than ship under an
 * approval record that no longer describes it.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { APPROVAL_BATCHES, APPROVED_TEXT } from '../src/lib/content/approved-text.ts';
import { loadCopy } from '../src/lib/content/load.ts';
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

  it('covers all twenty-four approved strings, each in exactly one batch', () => {
    assert.equal(Object.keys(APPROVED_TEXT).length, 24);

    const [homepage, notFound, v4, workLede, issue6] = APPROVAL_BATCHES;
    assert.ok(homepage && notFound && v4 && workLede && issue6);
    assert.equal(APPROVAL_BATCHES.length, 5);
    assert.deepEqual(
      [homepage.by, homepage.at, homepage.ids.length],
      ['user', '2026-08-28T21:20:25Z', 6],
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
      ['user', '2026-09-13T00:00:00Z', 6],
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

    const ids = APPROVAL_BATCHES.flatMap((b) => [...b.ids]);
    assert.equal(new Set(ids).size, ids.length);
    assert.deepEqual(ids.sort(), Object.keys(APPROVED_TEXT).sort());
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
    // the counterpart to APPROVAL_ATTRIBUTION in validate-content: this
    // collection is 24/24, and the reported debt is entirely elsewhere
    const rows = loadCopy();
    const approved = rows.filter((r) => r.publication.reviewStatus === 'approved');
    assert.equal(approved.length, 24);
    assert.equal(
      approved.filter((r) => r.publication.approvedBy && r.publication.approvedAt).length,
      24,
    );
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
    const copy = structuredClone(loadCopy());
    const target = copy.find((c) => c.id === 'home.about.h2');
    assert.ok(target);
    const before = target.text;
    target.text = 'リポジトリから分かることだけ。';

    const [finding] = approvedCopyGate(copy, asApproved);
    assert.ok(finding);
    assert.match(finding.message, /home\.about\.h2/);
    assert.match(finding.message, new RegExp(before));
    assert.match(finding.message, /リポジトリから分かることだけ。/);
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
});
