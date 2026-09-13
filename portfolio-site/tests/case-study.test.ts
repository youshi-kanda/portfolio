/**
 * The Case Study layer: section derivation, routes, and the truth rules that
 * only apply once a work has a Case Study.
 *
 * The theme running through these is that a Case Study is a page made of
 * claims, so the failures worth pinning down are the ones where the page keeps
 * offering something it no longer has — an index entry for a dropped section, a
 * call to action for an unwritten body, a citation pointing at no Evidence.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { workSource, workVerification } from '../src/lib/content/compat.ts';
import { caseSections, publishedCaseStudies, shippingWorks, technicalHref, workHref, workVisual } from '../src/lib/content/derive.ts';
import { CASE_VARIANTS } from '../src/lib/content/schema.ts';
import { runGates } from '../src/lib/validation/index.ts';
import { truthGate } from '../src/lib/validation/truth.ts';
import { bundleWith, clone, codes, exceptPendingApproval, realContent, sampleWork } from './helpers.ts';

const production = { mode: 'production' } as const;

describe('case study', () => {
  it('pairs a Case Study with exactly the works that declare one', () => {
    // NOT "every shipping work" any more. #7 ships ten works and three Case
    // Studies: the other seven are #8's scope, and a site that only allowed a
    // work to ship once its Case Study was written would be a site that cannot
    // publish work in the order the work actually gets done.
    //
    // What still has to hold is the pairing: `caseStudyPublished` is the flag
    // every CTA renders from, so a work claiming one without a record behind it
    // would offer a link to a page that is not there.
    const { works, caseStudies } = realContent();
    const paired = publishedCaseStudies(works, caseStudies);
    const claimed = shippingWorks(works)
      .filter((w) => w.caseStudyPublished)
      .map((w) => w.slug);
    assert.deepEqual(paired.map((p) => p.work.slug), claimed);
    assert.deepEqual(claimed, ['crm', 'ppm', 'dfe']);
  });

  it('derives the route from the slug rather than naming a work', () => {
    assert.equal(workHref('crm', false), '/work/crm/');
    assert.equal(technicalHref('crm'), '/work/crm/technical/');
    // a work that does not exist yet still resolves — no lookup table to update
    assert.equal(technicalHref('new-thing'), '/work/new-thing/technical/');
  });

  it('drops a section the work has no content for', () => {
    const { works, caseStudies } = realContent();
    const first = publishedCaseStudies(works, caseStudies)[0]!;
    const { work, caseStudy } = first;
    const emptied = { ...clone(caseStudy), safety: [], delivery: [] };
    const ids = caseSections(work, emptied).map((s) => s.id);
    assert.ok(!ids.includes('cs10'));
    assert.ok(!ids.includes('cs11'));
    assert.ok(ids.includes('cs12'));
  });

  it('keeps the table of contents and the body on one list', () => {
    // caseSections is the only place the drop condition lives; if the index and
    // the body computed it separately, one would eventually offer a dead anchor
    const { works, caseStudies } = realContent();
    for (const { work, caseStudy } of publishedCaseStudies(works, caseStudies)) {
      const ids = caseSections(work, caseStudy).map((s) => s.id);
      assert.equal(new Set(ids).size, ids.length, `${work.slug}: 重複した節 id`);
      for (const id of ids) assert.match(id, /^cs\d+$/);
    }
  });

  it('numbers the sections in CS order', () => {
    const { works, caseStudies } = realContent();
    const { work, caseStudy } = publishedCaseStudies(works, caseStudies)[0]!;
    const nums = caseSections(work, caseStudy).map((s) => Number(s.index.replace('CS-', '')));
    assert.deepEqual(nums, [...nums].sort((a, b) => a - b));
  });

  it('fails a work that promises a Case Study it does not have', () => {
    const w = sampleWork();
    w.caseStudyPublished = true;
    const bundle = bundleWith([w]);
    bundle.caseStudies = [];
    const found = truthGate({ ...bundle, mode: 'production' });
    assert.ok(codes(found).includes('T-NO-CASE'));
  });

  it('does not fail a work that has no Case Study and claims none', () => {
    const w = sampleWork();
    w.caseStudyPublished = false;
    const bundle = bundleWith([w]);
    bundle.caseStudies = [];
    const found = truthGate({ ...bundle, mode: 'production' });
    assert.ok(!codes(found).includes('T-NO-CASE'));
  });

  it('fails a Case Study whose work is gone', () => {
    const { caseStudies, evidence, copy, uiCopy } = realContent();
    const found = truthGate({
      works: [],
      caseStudies,
      evidence,
      copy,
      uiCopy,
      mode: 'production',
    });
    assert.ok(codes(found).includes('T-ORPHAN-CASE'));
  });

  it('fails a claim citing Evidence that does not exist', () => {
    const bundle = bundleWith(shippingWorks(realContent().works));
    const target = clone(bundle.caseStudies[0]!);
    target.highlights[0]!.evidenceRefs = ['NOPE-V99'];
    bundle.caseStudies = [target, ...bundle.caseStudies.slice(1)];
    const found = truthGate({ ...bundle, mode: 'production' });
    const dead = found.filter((f) => f.code === 'T-DEAD-REF');
    assert.equal(dead.length, 1);
    assert.match(dead[0]!.message, /NOPE-V99/);
  });

  it('cites only Evidence that exists, as it stands', () => {
    // #8's four unapproved strings are filtered out: they are a copy-approval
    // question, and this test is about whether a Case Study points at Evidence
    // that is there. Any OTHER error still fails it.
    assert.deepEqual(exceptPendingApproval(runGates(realContent(), production).errors), []);
  });

  it('asks for CS-16 only where there is something to point at', () => {
    // "where the claims can be checked" is a promise. A work with a public
    // repository has to keep it; a work whose source is a private engagement
    // has nowhere to send the reader, and a link labelled "private repository"
    // pointing at nothing offers a check that cannot be performed.
    const { works, caseStudies, evidence, copy, uiCopy } = realContent();
    const run = (w: typeof works, c: typeof caseStudies) =>
      codes(truthGate({ works: w, caseStudies: c, evidence, copy, uiCopy, mode: 'production' }));

    // as it stands: every shipping work has a public repository and cites it
    assert.ok(!run(works, caseStudies).includes('T-NO-REPO'));
    for (const c of caseStudies) {
      const work = works.find((w) => w.slug === c.slug)!;
      const isPublic = workSource(work)?.access === 'public-repo';
      assert.equal(c.repository.length > 0, isPublic, `${c.slug}`);
    }

    // strip the citations from a public work's Case Study and it fails
    const publicSlug = works.find((w) => workSource(w)?.access === 'public-repo')!.slug;
    const stripped = caseStudies.map((c) =>
      c.slug === publicSlug ? { ...clone(c), repository: [] } : c,
    );
    assert.ok(run(works, stripped).includes('T-NO-REPO'));
  });

  it('gives every decision the option it rejected', () => {
    // a decision with no rejected alternative is a description, not a decision
    const { caseStudies } = realContent();
    for (const c of caseStudies) {
      assert.ok(c.decisions.length > 0, `${c.slug}: 判断が無い`);
      for (const d of c.decisions) {
        assert.match(d.reason, /却下/, `${c.slug} / ${d.title}: 却下した案が無い`);
      }
    }
  });

  it('gives every measured number the method that produced it', () => {
    const { caseStudies } = realContent();
    for (const c of caseStudies) {
      for (const s of c.scale) {
        assert.ok(s.method.trim().length > 0, `${c.slug} / ${s.item}: 取得方法が無い`);
      }
    }
  });

  it('gives every excluded scope row a stated reason', () => {
    const { caseStudies } = realContent();
    for (const c of caseStudies) {
      for (const s of c.scope) {
        assert.ok(s.why.trim().length > 0, `${c.slug} / ${s.notIncluded}: why が無い`);
      }
    }
  });

  it('declares a case variant that has a renderer', () => {
    // mirrors the entry variant rule: the closed set is what can be drawn
    const IMPLEMENTED = ['walkthrough', 'ledger', 'pipeline'];
    const { works } = realContent();
    for (const w of shippingWorks(works)) {
      const { caseVariant } = workVisual(w);
      assert.ok(IMPLEMENTED.includes(caseVariant), `${w.slug}: ${caseVariant} に renderer が無い`);
      assert.ok(CASE_VARIANTS.includes(caseVariant));
    }
  });

  it('gives each published Case Study a different case variant', () => {
    // Scoped to the works that HAVE a Case Study. Uniqueness across all ten
    // shipping works is not reachable — there are three implemented spine
    // renderers — and demanding it would be demanding a renderer per work
    // rather than a variety of them where they are actually drawn.
    const { works } = realContent();
    const variants = shippingWorks(works)
      .filter((w) => w.caseStudyPublished)
      .map((w) => workVisual(w).caseVariant);
    assert.equal(variants.length, 3);
    assert.equal(new Set(variants).size, variants.length);
  });

  it('states OCR is not run, above the fold, for the work that does not run it', () => {
    // spec §7 requires Rule DFE-0 outside any collapsible; the schema field it
    // uses renders in the hero, so its presence is the thing to pin
    const { caseStudies } = realContent();
    const dfe = caseStudies.find((c) => c.slug === 'dfe');
    assert.ok(dfe?.leadDisclosure);
    assert.match(dfe.leadDisclosure, /OCR を実行していない/);
  });

  it('claims no OCR accuracy anywhere in the extraction Case Study', () => {
    const dfe = realContent().caseStudies.find((c) => c.slug === 'dfe')!;
    const text = JSON.stringify(dfe);
    // the two claims the spec's FACT_QA forbids for this work
    assert.doesNotMatch(text, /PDF を OCR/);
    assert.doesNotMatch(text, /OCR 精度は/);
  });

  it('keeps the frontend test count at zero where that is the fact', () => {
    const { works, caseStudies } = realContent();
    const crm = works.find((w) => w.slug === 'crm')!;
    const study = caseStudies.find((c) => c.slug === 'crm')!;
    // through the accessor: what the page prints is the fact under test, and
    // which field it comes from is the migration's business, not this test's
    assert.equal(workVerification(crm)?.count, 484);
    // lint / type-check / build are never counted as frontend tests
    assert.ok(study.quality.some((q) => q.includes('frontend テストは 0 件')));
    assert.ok(study.scale.some((s) => s.item === 'frontend テスト' && s.value === '0 件'));
  });
});
