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
import {
  caseSections,
  publishedCaseStudies,
  shippingWorks,
  technicalHref,
  workHref,
} from '../src/lib/content/derive.ts';
import { CASE_VARIANTS } from '../src/lib/content/schema.ts';
import { runGates } from '../src/lib/validation/index.ts';
import { truthGate } from '../src/lib/validation/truth.ts';
import { bundleWith, clone, codes, realContent, sampleWork } from './helpers.ts';

const production = { mode: 'production' } as const;

describe('case study', () => {
  it('publishes a Case Study for every shipping work', () => {
    const { works, caseStudies } = realContent();
    const paired = publishedCaseStudies(works, caseStudies);
    assert.deepEqual(
      paired.map((p) => p.work.slug),
      shippingWorks(works).map((w) => w.slug),
    );
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
    assert.deepEqual(runGates(realContent(), production).errors, []);
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
      assert.ok(
        IMPLEMENTED.includes(w.visual.caseVariant),
        `${w.slug}: ${w.visual.caseVariant} に renderer が無い`,
      );
      assert.ok(CASE_VARIANTS.includes(w.visual.caseVariant));
    }
  });

  it('gives the three works three different case variants', () => {
    const { works } = realContent();
    const variants = shippingWorks(works).map((w) => w.visual.caseVariant);
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
    assert.equal(crm.tests.count, 484);
    // lint / type-check / build are never counted as frontend tests
    assert.ok(study.quality.some((q) => q.includes('frontend テストは 0 件')));
    assert.ok(study.scale.some((s) => s.item === 'frontend テスト' && s.value === '0 件'));
  });
});
