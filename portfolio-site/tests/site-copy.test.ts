/**
 * site.json's copy, and the gap Phase 2 measures.
 *
 * The point of these is not the number — the number changes as Phase 3 works
 * through it. It is that the number is now KNOWN, and that the walk which
 * produces it exempts only what someone decided to exempt.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadAll } from '../src/lib/content/load.ts';
import { SITE_NON_SHIPPING, site, siteStrings } from '../src/lib/content/site.ts';
import { siteCopyCoverage, siteCopyGate } from '../src/lib/validation/site-copy.ts';
import { codes } from './helpers.ts';

describe('site.json copy coverage', () => {
  it('is in the content bundle the gates run on', () => {
    // it was outside it, which is why none of this was ever checked
    assert.equal(loadAll().site.hero.stackLine, site.hero.stackLine);
  });

  it('walks the section content as shipping strings', () => {
    const paths = siteStrings().map((s) => s.path);
    for (const expected of [
      'hero.stackLine',
      'howIBuild.workflow.1.name',
      'stack.languages.1.responsibility',
      'principles.spineBody',
      'about.known.1.value',
    ]) {
      assert.ok(paths.includes(expected), `${expected} が対象に入っていない`);
    }
  });

  it('exempts only identifiers and locators, each with a reason', () => {
    const paths = new Set(siteStrings().map((s) => s.path));
    assert.equal(paths.has('nav.1.href'), false);
    assert.equal(paths.has('repo'), false);
    assert.equal(paths.has('workPermalink'), false);
    assert.equal(paths.has('evidenceSection.featured'), false);
    assert.equal(paths.has('stack.languages.1.sourceRef'), false);
    assert.equal(paths.has('howIBuild.sourceRefs.1'), false);
    assert.equal(paths.has('stack.languages.1.work'), false);
    assert.equal(paths.has('hero.index'), false);
    // #31 — 開発の前提 holds copy registry ids, not sentences
    assert.equal(paths.has('howIBuild.premises.1'), false);
    for (const e of SITE_NON_SHIPPING) assert.ok(e.why.length > 0);
  });

  it('stops exempting a premise reference once it stops being an id', () => {
    // #31. `premises` is exempt because it holds copy registry ids. A SENTENCE
    // there is the defect the move to the registry fixed — copy sitting where
    // no approval record can reach it — so the exemption lifts and the walk
    // reports it as an unregistered shipping string.
    assert.deepEqual(siteStrings({ howIBuild: { premises: ['method.premise.01'] } }), []);
    assert.deepEqual(siteStrings({ howIBuild: { premises: ['前提です。'] } }), [
      { path: 'howIBuild.premises.1', text: '前提です。' },
    ]);
  });

  it('stops exempting a section index once it stops being a number', () => {
    // `index` is exempt because it is structure. A word there is not.
    //
    // (The exemption is written as 序数 rather than with the English word for
    //  it, on purpose: Tailwind scans every tracked file for class-name
    //  candidates, and the English word for 序数 is one of its font-variant
    //  utilities — writing it here once added a rule to the shipped stylesheet
    //  and changed the hash of every page. See README, Development.)
    assert.deepEqual(siteStrings({ hero: { index: '00' } }), []);
    assert.deepEqual(siteStrings({ hero: { index: '序' } }), [
      { path: 'hero.index', text: '序' },
    ]);
  });

  it('counts what the registries already cover, and what they do not', () => {
    const { copy, uiCopy } = loadAll();
    const { managed, unmanaged } = siteCopyCoverage(copy, uiCopy);
    assert.equal(managed.length + unmanaged.length, siteStrings().length);
    assert.equal(managed.length, 2);
    // 120 before #7, 183 after it, 167 after #8, 191 after #31. The jump was 02
    // MORE PROJECTS, 03 CAPABILITIES, ABOUT's `now` and CONTACT's heading and
    // lede: all of it copy the user approved in #6, entered where the section
    // content it belongs to already lives.
    //
    // #8 took 16 off the count and NONE of them by registering a string. They
    // were capability `examples` (work slugs) and category `key` (ordinals) —
    // two leaves that were being counted as unregistered copy and are not copy,
    // each now exempt next to the rule it already belonged under. The rest of
    // the backlog is real and stays reported: registering a string means
    // recording an approval event for it, and #8 may not sign one on the
    // owner's behalf before the PR review that is supposed to be it.
    //
    // #31 PUT 26 BACK ON, and on purpose. They are the decision cases and the
    // QA record — source-derived transcriptions of PR #18 / #19 / #20, each
    // carrying the PR sections it came from in its own `sourceRefs`. The gate
    // measures registry coverage, so a transcription that is checked against a
    // public PR instead of against a registry row is exactly what it reports;
    // this number going UP is the backlog being honest, not a regression. What
    // would be a regression is registering them here by writing an approval
    // event nobody signed — the reason the count has only ever moved by
    // exempting non-copy or by the owner approving a string.
    //
    // AND THE OTHER DIRECTION HAPPENED IN THE SAME ISSUE. #31's follow-up took
    // 2 OFF by the legitimate route: `notClaimed`'s two sentences left
    // site.json for the copy registry with a real approval event behind them
    // (Issue #31 comment 5747908981), and `premises` now holds their ids —
    // which are references, exempt for the same reason a work slug is. 193
    // after the decision cases landed, 191 after the premises moved out.
    assert.equal(unmanaged.length, 191);
  });

  it('reports once, warns only, and never fails a build', () => {
    const { copy, uiCopy } = loadAll();
    const findings = siteCopyGate(copy, uiCopy);
    assert.deepEqual(codes(findings), ['W-SITE-UNMANAGED']);
    assert.equal(findings[0]?.level, 'WARN');
    assert.match(findings[0]!.message, /191 件/);
    // one finding, not 191 — a build log nobody reads is not a gate
    assert.equal(findings.length, 1);
  });

  it('says nothing when every string is registered', () => {
    const strings = [{ path: 'hero.stackLine', text: 'x' }];
    const copy = [{ text: 'x' }] as never;
    assert.deepEqual(siteCopyGate(copy, [], strings), []);
  });
});
