/**
 * The MIGRATE-period read path — EXPAND-B.
 *
 * These are the tests that let the legacy fields become optional in EXPAND-C
 * without a red commit in between: the consumers already read through here, and
 * here already answers the V4-only case. The V4-only fixtures are built by hand
 * rather than parsed, because at this stage the schema still refuses them —
 * which is the point of the stage.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  workDemoScope,
  workRepoPath,
  workSource,
  workVerification,
} from '../src/lib/content/compat.ts';
import type { Work } from '../src/lib/content/schema.ts';
import { clone, sampleWork } from './helpers.ts';

/** A work carrying showcase and no legacy field. Not yet parseable — see above. */
function v4Only(showcase: Work['showcase']): Work {
  const w = clone(sampleWork()) as Record<string, unknown>;
  delete w['repoPath'];
  delete w['publicDemoScope'];
  delete w['tests'];
  w['showcase'] = showcase;
  return w as unknown as Work;
}

const showcase = {
  source: { access: 'public-repo', path: 'rin/' },
  demoScope: ['V4 の公開範囲'],
  verification: { tests: { summary: 'V4 summary', count: 12, source: 'V4 source' }, verificationId: null },
} satisfies Work['showcase'];

describe('transitional accessors', () => {
  it('reads the legacy fields when they are the only ones present', () => {
    const w = sampleWork();
    assert.equal(workRepoPath(w), w.repoPath);
    assert.deepEqual(workSource(w), { access: 'public-repo', path: w.repoPath });
    assert.deepEqual(workDemoScope(w), w.publicDemoScope);
    assert.deepEqual(workVerification(w), w.tests);
  });

  it('reads showcase when the legacy fields are absent', () => {
    const w = v4Only(showcase);
    assert.equal(workRepoPath(w), 'rin/');
    assert.deepEqual(workDemoScope(w), ['V4 の公開範囲']);
    assert.equal(workVerification(w)?.count, 12);
  });

  it('reports a private source as a source, not as a missing one', () => {
    // "there is a repository and it cannot be linked" is a fact about the work.
    // Null here would say something different and false: that none exists.
    const w = v4Only({
      source: { access: 'private-repo', path: null },
      demoScope: [],
      verification: { tests: null, verificationId: 'rin-authority-v1' },
    });
    assert.equal(workSource(w)?.access, 'private-repo');
    assert.equal(workRepoPath(w), null);
    assert.deepEqual(workDemoScope(w), []);
    assert.equal(workVerification(w), null);
  });

  it('gives the legacy field authority in the Dual state', () => {
    // The gate proves the two agree before a Dual work can ship. If one ever
    // does reach here disagreeing, the page must not quietly switch which
    // value it prints — Phases 1–3 keep the V3 presentation exactly.
    const w = { ...sampleWork(), showcase } as Work;
    assert.equal(workRepoPath(w), w.repoPath);
    assert.notEqual(workRepoPath(w), 'rin/');
    assert.deepEqual(workDemoScope(w), w.publicDemoScope);
    assert.equal(workVerification(w)?.count, w.tests?.count);
  });

  it('says nothing rather than something empty when a work states no source', () => {
    const w = v4Only(undefined);
    assert.equal(workSource(w), null);
    assert.equal(workRepoPath(w), null);
    assert.deepEqual(workDemoScope(w), []);
    assert.equal(workVerification(w), null);
  });
});
