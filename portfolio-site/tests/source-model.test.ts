/**
 * The source model — #7 C-8.
 *
 * Two questions that used to share one seat: whether the source is public, and
 * whether this site publishes the way in. They came apart on a work whose
 * repository is genuinely public and whose name carries a client's, where the
 * old shape offered only a required path that cannot be shown or a `private-repo`
 * that is false. These tests pin the six combinations so the seat cannot be
 * quietly collapsed back into one.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sourceSchema } from '../src/lib/content/schema.ts';
import { workSourceIsLinkable, workRepoPath } from '../src/lib/content/compat.ts';
import type { Work } from '../src/lib/content/schema.ts';

const parse = (input: unknown) => sourceSchema.safeParse(input);

describe('source model — access × linkPolicy', () => {
  it('public + linked + path — the ordinary published source', () => {
    const r = parse({ access: 'public-repo', linkPolicy: 'linked', path: 'ai-crm-demo/' });
    assert.equal(r.success, true);
  });

  it('public + linked + null — refused: a publication with no place to point', () => {
    const r = parse({ access: 'public-repo', linkPolicy: 'linked', path: null });
    assert.equal(r.success, false);
  });

  it('public + withheld + null — accepted: public, and deliberately not linked', () => {
    const r = parse({ access: 'public-repo', linkPolicy: 'withheld', path: null });
    assert.equal(r.success, true);
  });

  it('public + withheld + path — refused: a withheld path is still stored', () => {
    const r = parse({ access: 'public-repo', linkPolicy: 'withheld', path: 'some-repo/' });
    assert.equal(r.success, false);
  });

  it('private + path — refused', () => {
    const r = parse({ access: 'private-repo', linkPolicy: 'withheld', path: 'some-repo/' });
    assert.equal(r.success, false);
  });

  it('none + path — refused', () => {
    const r = parse({ access: 'none', linkPolicy: 'withheld', path: 'some-repo/' });
    assert.equal(r.success, false);
  });

  it('linkPolicy defaults to linked, so existing public records keep their meaning', () => {
    const r = parse({ access: 'public-repo', path: 'ai-crm-demo/' });
    assert.equal(r.success, true);
    assert.equal(r.success && r.data.linkPolicy, 'linked');
  });
});

describe('workSourceIsLinkable / workRepoPath', () => {
  const work = (source: unknown): Work =>
    ({ showcase: { source, demoScope: [], verification: { tests: null, verificationId: null } } } as unknown as Work);

  it('a linked public source is linkable and yields its path', () => {
    const w = work({ access: 'public-repo', linkPolicy: 'linked', path: 'ai-crm-demo/' });
    assert.equal(workSourceIsLinkable(w), true);
    assert.equal(workRepoPath(w), 'ai-crm-demo/');
  });

  it('a withheld public source is NOT linkable and yields no path', () => {
    const w = work({ access: 'public-repo', linkPolicy: 'withheld', path: null });
    assert.equal(workSourceIsLinkable(w), false);
    assert.equal(workRepoPath(w), null);
  });

  it('a private source is not linkable', () => {
    const w = work({ access: 'private-repo', linkPolicy: 'withheld', path: null });
    assert.equal(workSourceIsLinkable(w), false);
    assert.equal(workRepoPath(w), null);
  });

  it('a legacy repoPath work stays linkable — no behaviour change for V3 records', () => {
    const w = { repoPath: 'ai-crm-demo/' } as unknown as Work;
    assert.equal(workSourceIsLinkable(w), true);
    assert.equal(workRepoPath(w), 'ai-crm-demo/');
  });
});
