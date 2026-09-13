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
    for (const e of SITE_NON_SHIPPING) assert.ok(e.why.length > 0);
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
    assert.equal(managed.length, 3);
    // 120 before #7, 183 after it. The jump is 02 MORE PROJECTS, 03
    // CAPABILITIES, ABOUT's `now` and CONTACT's heading and lede: all of it is
    // copy the user approved in #6, entered where the section content it
    // belongs to already lives. Registering it is Copy Migration's job and it
    // is #8's scope — this gate reports the debt, which is what it is for.
    assert.equal(unmanaged.length, 183);
  });

  it('reports once, warns only, and never fails a build', () => {
    const { copy, uiCopy } = loadAll();
    const findings = siteCopyGate(copy, uiCopy);
    assert.deepEqual(codes(findings), ['W-SITE-UNMANAGED']);
    assert.equal(findings[0]?.level, 'WARN');
    assert.match(findings[0]!.message, /183 件/);
    // one finding, not 183 — a build log nobody reads is not a gate
    assert.equal(findings.length, 1);
  });

  it('says nothing when every string is registered', () => {
    const strings = [{ path: 'hero.stackLine', text: 'x' }];
    const copy = [{ text: 'x' }] as never;
    assert.deepEqual(siteCopyGate(copy, [], strings), []);
  });
});
