/**
 * Approved copy is immutable.
 *
 * The user approved twelve specific sentences on 2026-08-28 and the five 404
 * strings on 2026-08-29. An approval covers the sentence that was read, not the
 * slot it sat in — so rewording an approved string has to fail the build rather
 * than ship under an approval record that no longer describes it.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { APPROVAL_BATCHES, APPROVED_TEXT } from '../src/lib/content/approved-text.ts';
import { heroLede } from '../src/lib/content/derive.ts';
import { loadCopy } from '../src/lib/content/load.ts';
import { approvedCopyGate } from '../src/lib/validation/approved-copy.ts';
import { codes } from './helpers.ts';

const derived = (n: number) => [{ id: 'home.hero.lede', rendered: heroLede(n) }];

describe('approved copy gate', () => {
  it('passes the registry as it stands', () => {
    assert.deepEqual(approvedCopyGate(loadCopy(), derived(3)), []);
  });

  it('covers all seventeen approved strings, each in exactly one batch', () => {
    assert.equal(Object.keys(APPROVED_TEXT).length, 17);

    const [homepage, notFound] = APPROVAL_BATCHES;
    assert.ok(homepage && notFound);
    assert.equal(APPROVAL_BATCHES.length, 2);
    assert.deepEqual(
      [homepage.by, homepage.at, homepage.ids.length],
      ['user', '2026-08-28T21:20:25Z', 12],
    );
    assert.deepEqual(
      [notFound.by, notFound.at, notFound.ids.length],
      ['user', '2026-08-29T06:10:37Z', 5],
    );

    const ids = APPROVAL_BATCHES.flatMap((b) => [...b.ids]);
    assert.equal(new Set(ids).size, ids.length);
    assert.deepEqual(ids.sort(), Object.keys(APPROVED_TEXT).sort());
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

    const findings = approvedCopyGate(copy, derived(3));
    assert.deepEqual(codes(findings), ['A-BATCH']);
    assert.match(findings[0]!.message, /notfound\.h1/);
  });

  it('fails when an approved string is reworded', () => {
    const copy = structuredClone(loadCopy());
    const target = copy.find((c) => c.id === 'home.works.h2');
    assert.ok(target);
    target.text = '何のためのサービスを、どこまで作ったのか。'; // 実装した → 作った

    const findings = approvedCopyGate(copy, derived(3));
    assert.deepEqual(codes(findings), ['A-CHANGED']);
  });

  it('reports the id, the approved text and the current text', () => {
    const copy = structuredClone(loadCopy());
    const target = copy.find((c) => c.id === 'home.about.h2');
    assert.ok(target);
    const before = target.text;
    target.text = 'リポジトリから分かることだけ。';

    const [finding] = approvedCopyGate(copy, derived(3));
    assert.ok(finding);
    assert.match(finding.message, /home\.about\.h2/);
    assert.match(finding.message, new RegExp(before));
    assert.match(finding.message, /リポジトリから分かることだけ。/);
  });

  it('fails when an approved string is missing from the registry', () => {
    const copy = structuredClone(loadCopy()).filter((c) => c.id !== 'home.stack.note');
    assert.equal(codes(approvedCopyGate(copy, derived(3))).includes('A-MISSING'), true);
  });

  it('fails when the registry claims an approval the snapshot does not record', () => {
    const copy = structuredClone(loadCopy());
    const first = copy[0];
    assert.ok(first);
    copy.push({ ...structuredClone(first), id: 'home.hero.slogan', text: '未承認の一文' });
    assert.equal(codes(approvedCopyGate(copy, derived(3))).includes('A-UNKNOWN'), true);
  });

  it('fails when the derived hero lede no longer renders its approved form', () => {
    // The approval covers "3 つの動くデモ". At four works the sentence the
    // user approved is not the sentence that would ship.
    const findings = approvedCopyGate(loadCopy(), derived(4));
    assert.deepEqual(codes(findings), ['A-DERIVED']);
    assert.match(findings[0]!.message, /home\.hero\.lede/);
  });

  it('renders the approved lede from the template at three works', () => {
    assert.equal(heroLede(3), APPROVED_TEXT['home.hero.lede']);
  });
});
