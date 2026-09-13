/**
 * The Dual-state contract.
 *
 * The state itself is legal and expected — a work being moved across carries
 * both records for a while. What is not legal is the two records making
 * different claims, because the page prints one of them and nothing on the
 * page says why that one.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Work } from '../src/lib/content/schema.ts';
import { runGates } from '../src/lib/validation/index.ts';
import { isDual, migrationGate } from '../src/lib/validation/migration.ts';
import { bundleWith, clone, codes, exceptPendingApproval, legacyWork, realContent, sampleWork } from './helpers.ts';

/**
 * The works that still carry the legacy half, in collection order.
 *
 * `realContent().works` used to be all-Dual, so "the first work" was always a
 * usable fixture. #7 added seven V4-only records, and whichever of them loads
 * first would make `agreeing()` spread an undefined `publicDemoScope`. Picking
 * by the field the fixture actually needs says what the test requires instead
 * of relying on load order.
 */
function dualWorks(): Work[] {
  const works = realContent().works.filter((w) => w.repoPath !== undefined);
  if (works.length === 0) throw new Error('fixture: Dual な作品が無い');
  return works;
}

/** The V4 record that says exactly what the sample work's legacy fields say. */
function agreeing(w: Work): NonNullable<Work['showcase']> {
  return {
    source: { access: 'public-repo', linkPolicy: 'linked', path: w.repoPath! },
    demoScope: [...w.publicDemoScope!],
    verification: { tests: { ...w.tests! }, verificationId: null },
  };
}

const dual = (over: (s: NonNullable<Work['showcase']>) => NonNullable<Work['showcase']>): Work => {
  const w = clone(sampleWork());
  return { ...w, showcase: over(agreeing(w)) };
};

const run = (works: Work[]) => migrationGate(works, 'production');

/**
 * The real work list with the first work made Dual and disagreeing.
 *
 * The list has to stay at three: the approved hero lede is the rendering of a
 * template over the shipping work count, so a bundle with fewer works fails on
 * A-CHANGED and would say nothing about the gate under test.
 */
function withConflict(): Work[] {
  const [first, ...rest] = [...dualWorks(), ...realContent().works.filter((w) => w.repoPath === undefined)];
  const showcase = agreeing(first!);
  return [
    {
      ...clone(first!),
      showcase: {
        ...showcase,
        verification: {
          ...showcase.verification,
          tests: { ...showcase.verification.tests!, count: 500 },
        },
      },
    },
    ...rest,
  ];
}

describe('dual migration state', () => {
  it('says nothing about a Legacy-only work', () => {
    assert.deepEqual(run([legacyWork()]), []);
  });

  it('says nothing about a V4-only work', () => {
    const w = clone(legacyWork()) as Record<string, unknown>;
    const showcase = agreeing(sampleWork());
    delete w['repoPath'];
    delete w['publicDemoScope'];
    delete w['tests'];
    w['showcase'] = showcase;
    assert.deepEqual(run([w as unknown as Work]), []);
  });

  it('warns — and only warns — when the two records agree', () => {
    const findings = run([dual((s) => s)]);
    assert.deepEqual(codes(findings), ['W-DUAL-SOURCE']);
    assert.equal(findings[0]?.level, 'WARN');
  });

  it('fails when the two test counts differ', () => {
    // 484 against 500: both parse, one is false, and the page cannot tell
    const findings = run([
      dual((s) => ({
        ...s,
        verification: { ...s.verification, tests: { ...s.verification.tests!, count: 500 } },
      })),
    ]);
    assert.deepEqual(codes(findings), ['T-DUAL-CONFLICT']);
    assert.equal(findings[0]?.level, 'ERROR');
    assert.match(findings[0]!.message, /tests\.count/);
    assert.match(findings[0]!.message, /484/);
    assert.match(findings[0]!.message, /500/);
  });

  it('fails when the V4 record drops the test claim the legacy one makes', () => {
    const findings = run([
      dual((s) => ({ ...s, verification: { ...s.verification, tests: null } })),
    ]);
    assert.deepEqual(codes(findings), ['T-DUAL-CONFLICT']);
  });

  it('fails when the V4 record calls a public source private', () => {
    const findings = run([
      dual((s) => ({ ...s, source: { access: 'private-repo', linkPolicy: 'withheld', path: null } })),
    ]);
    assert.deepEqual(codes(findings), ['T-DUAL-CONFLICT']);
    assert.match(findings[0]!.message, /showcase\.source/);
  });

  it('fails when the V4 record points at a different path', () => {
    const findings = run([
      dual((s) => ({ ...s, source: { access: 'public-repo', linkPolicy: 'linked', path: 'other-demo/' } })),
    ]);
    assert.deepEqual(codes(findings), ['T-DUAL-CONFLICT']);
  });

  it('fails when the public scope gains or loses an item', () => {
    const dropped = run([dual((s) => ({ ...s, demoScope: s.demoScope.slice(1) }))]);
    assert.deepEqual(codes(dropped), ['T-DUAL-CONFLICT']);

    const added = run([dual((s) => ({ ...s, demoScope: [...s.demoScope, '追加された主張'] }))]);
    assert.deepEqual(codes(added), ['T-DUAL-CONFLICT']);
    assert.match(added[0]!.message, /追加された主張/);
  });

  it('compares meaning, not objects: order and whitespace are not conflicts', () => {
    const reordered = run([dual((s) => ({ ...s, demoScope: [...s.demoScope].reverse() }))]);
    assert.deepEqual(codes(reordered), ['W-DUAL-SOURCE']);

    const rewrapped = run([
      dual((s) => ({
        ...s,
        verification: {
          ...s.verification,
          tests: { ...s.verification.tests!, summary: `  ${s.verification.tests!.summary}  ` },
        },
      })),
    ]);
    assert.deepEqual(codes(rewrapped), ['W-DUAL-SOURCE']);
  });

  it('reports every field that disagrees, not just the first', () => {
    const findings = run([
      dual((s) => ({
        ...s,
        source: { access: 'public-repo', linkPolicy: 'linked', path: 'other-demo/' },
        demoScope: [],
        verification: { ...s.verification, tests: null },
      })),
    ]);
    assert.equal(findings.length, 3);
    assert.deepEqual(new Set(codes(findings)), new Set(['T-DUAL-CONFLICT']));
  });

  it('does NOT downgrade the conflict in development', () => {
    // The development downgrade is for content that is not approved YET —
    // review state, with the content still coherent. This is two records in
    // the repository asserting different things: warning through it is how the
    // contradiction stops being visible to anyone.
    const conflicting = dual((s) => ({
      ...s,
      verification: { ...s.verification, tests: { ...s.verification.tests!, count: 500 } },
    }));
    const dev = migrationGate([conflicting], 'development');
    assert.deepEqual(codes(dev), ['T-DUAL-CONFLICT']);
    assert.equal(dev[0]?.level, 'ERROR');
    // and it is an error through the whole gate, in either mode
    for (const mode of ['production', 'development'] as const) {
      const result = runGates(bundleWith(withConflict()), { mode });
      assert.equal(result.ok, false);
      assert.equal(codes(result.errors).includes('T-DUAL-CONFLICT'), true);
    }
  });

  it('keeps W-DUAL-SOURCE a warning, which never fails a build', () => {
    const [first, ...others] = dualWorks();
    const rest = realContent().works.filter((w) => w.slug !== first!.slug);
    void others;
    const agreed = { ...clone(first!), showcase: agreeing(first!) };
    const result = runGates(bundleWith([agreed, ...rest]), { mode: 'production' });
    // The claim is about W-DUAL-SOURCE's LEVEL — that it warns and does not
    // fail. #8's pending copy approvals are a separate, deliberate block, so
    // they are set aside; what must hold is that nothing else errors and the
    // dual-source finding is a warning.
    assert.deepEqual(exceptPendingApproval(result.errors), []);
    assert.equal(codes(result.warnings).includes('W-DUAL-SOURCE'), true);
  });

  it('fails a lead that the homepage does not feature', () => {
    // The Editorial Band is drawn from the featured works and leads with this
    // one, so a lead that is not featured is promoted to a place it never has.
    const lead = { ...clone(legacyWork()), homepageRole: 'lead', featured: false } satisfies Work;
    assert.deepEqual(codes(run([lead])), ['T-LEAD-NOT-FEATURED']);
    assert.deepEqual(run([{ ...lead, featured: true }]), []);
  });

  it('says nothing when no work claims the lead', () => {
    // `homepageRole` is dropped explicitly. The fixture is built from the first
    // shipping work, which now IS the Lead, so inheriting the record would make
    // this read "a work that claims the lead and is not featured" — the case
    // the test above covers, arriving here by accident.
    const notLead = { ...clone(legacyWork()), homepageRole: undefined, featured: false };
    assert.deepEqual(run([notLead as Work]), []);
  });

  it('fails two works claiming the homepage lead', () => {
    const a = { ...clone(legacyWork()), slug: 'a', homepageRole: 'lead' } satisfies Work;
    const b = { ...clone(legacyWork()), slug: 'b', homepageRole: 'lead' } satisfies Work;
    assert.deepEqual(codes(run([a, b])), ['T-MULTI-LEAD']);
    assert.deepEqual(run([a, { ...b, homepageRole: undefined }]), []);
  });

  it('reports every migrated work on disk and contradicts none', () => {
    // Counted from the records rather than written down, so this states the
    // invariant — one warning per Dual work, never a conflict — at whatever
    // point the migration has reached.
    const { works } = realContent();
    const migrated = works.filter(isDual).map((w) => w.slug);
    const findings = run(works);

    assert.deepEqual(
      codes(findings),
      migrated.map(() => 'W-DUAL-SOURCE'),
      `Dual: ${migrated.join(' ') || '(none)'}`,
    );
    for (const f of findings) assert.equal(f.level, 'WARN');

    const result = runGates(bundleWith(works), { mode: 'production' });
    // No CONTRADICTION, which is what this test is named after. The build does
    // not pass right now — #8 is holding four copy approvals — so the assertion
    // is that nothing besides those is wrong, rather than `ok === true`.
    assert.deepEqual(exceptPendingApproval(result.errors), []);
    assert.equal(result.findings.filter((f) => f.code === 'T-DUAL-CONFLICT').length, 0);
  });
});
