/**
 * The two report-only readings of the copy.
 *
 * Heuristics, held to the standard a heuristic has to meet before it is worth
 * running: it has to fire on the real defect, and it has to stay quiet on the
 * string that merely looks like one.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shippingWorks } from '../src/lib/content/derive.ts';
import { loadAll } from '../src/lib/content/load.ts';
import { siteStrings } from '../src/lib/content/site.ts';
import type { CopyItem } from '../src/lib/content/schema.ts';
import { claimsGate } from '../src/lib/validation/claims.ts';
import { codes } from './helpers.ts';

const row = (id: string, text: string, claimType: 'fact' | 'presentation'): CopyItem => ({
  id,
  text,
  route: '/',
  section: 'test',
  slot: 'test',
  purpose: 'test',
  publication: {
    reviewStatus: 'approved',
    sourceType: 'authored',
    claimType,
    sourceRefs: [],
    approvedBy: 'user',
    approvedAt: '2026-09-06',
  },
});

const run = (copy: CopyItem[], site: { path: string; text: string }[] = [], workCount = 3) =>
  claimsGate({ copy, uiCopy: [], site, workCount });

describe('claims report', () => {
  it('flags a presentation string that states a quantity', () => {
    const findings = run([row('x', 'テストは 484 件 通っています', 'presentation')]);
    assert.deepEqual(codes(findings), ['W-CLAIM-SUSPECT']);
    assert.equal(findings[0]?.level, 'WARN');
  });

  it('flags a presentation string that speaks in absolutes', () => {
    assert.deepEqual(codes(run([row('x', 'すべての画面は合成データです', 'presentation')])), [
      'W-CLAIM-SUSPECT',
    ]);
  });

  it('says nothing about the same sentence classified as a fact', () => {
    // the suspicion is of the classification, not of the sentence
    assert.deepEqual(run([row('x', 'テストは 484 件 通っています', 'fact')]), []);
  });

  it('does not read a digit inside an identifier as a count', () => {
    // `L3 作品固有トークン` is not "3 作品" — the first thing this check tried
    // to tell us, and the reason it is not allowed to fail a build
    assert.deepEqual(run([row('x', 'L1 共通 / L2 変種 / L3 作品固有トークン', 'presentation')]), []);
  });

  it('leaves a template alone, since it has no literal to go stale', () => {
    assert.deepEqual(run([row('x', '{count} 件', 'presentation')]), []);
  });

  it('flags a literal work count wherever it is written', () => {
    const findings = run(
      [row('x', '3 作品を公開しています', 'fact')],
      [{ path: 'principles.spineBody', text: '3 作品はいずれも' }],
    );
    assert.deepEqual(codes(findings), ['W-LITERAL-COUNT', 'W-LITERAL-COUNT']);
    assert.match(findings[0]!.message, /site\.principles\.spineBody/);
  });

  it('says so when the literal is already wrong', () => {
    const findings = run([row('x', '5 作品を公開しています', 'fact')], [], 3);
    assert.match(findings[0]!.message, /既に食い違っている/);
  });

  it('exempts a registry row that is the recorded output of a derivation', () => {
    const derived = row('home.hero.lede', '公開しているのは 3 つの動くデモです。', 'fact');
    assert.deepEqual(
      claimsGate({ copy: [derived], uiCopy: [], site: [], workCount: 3, derivedIds: [derived.id] }),
      [],
    );
    assert.deepEqual(
      codes(claimsGate({ copy: [derived], uiCopy: [], site: [], workCount: 3 })),
      ['W-LITERAL-COUNT'],
    );
  });

  it('reports the shipping content: no suspect classification, no typed count', () => {
    const { works, copy, uiCopy } = loadAll();
    const findings = claimsGate({
      copy,
      uiCopy,
      site: siteStrings(),
      workCount: shippingWorks(works).length,
      derivedIds: ['home.hero.lede'],
    });
    assert.deepEqual(codes(findings), []);
  });

  it('still catches a count typed back into site.json', () => {
    // The two it used to report — site.stack.platform.5.detail and
    // site.principles.spineBody — now hold `{count}` and are filled at render.
    // The check has to keep working, or the fix is indistinguishable from
    // having quietly stopped looking.
    const site = [
      { path: 'stack.platform.5.detail', text: 'GitHub Actions — 3 作品それぞれに workflow がある' },
    ];
    const findings = claimsGate({ copy: [], uiCopy: [], site, workCount: 3 });
    assert.deepEqual(codes(findings), ['W-LITERAL-COUNT']);
    assert.equal(findings[0]?.level, 'WARN');

    // and the templates that replaced them do not trip it
    assert.deepEqual(
      codes(
        claimsGate({
          copy: [],
          uiCopy: [],
          site: [{ path: 'x', text: 'GitHub Actions — {count} 作品それぞれに workflow がある' }],
          workCount: 3,
        }),
      ),
      [],
    );
  });

});
