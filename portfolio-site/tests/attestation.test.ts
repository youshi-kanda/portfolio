/**
 * Public Artifact Attestation.
 *
 * The record is a claim that a person read a specific set of bytes. What the
 * gate has to get right is the two ways such a claim rots: the bytes change, or
 * the set stops being the set the content actually implies.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  artifactDigest,
  attestations,
  attestedArtifacts,
  claimedVerificationIds,
} from '../src/lib/content/attestation.ts';
import { loadEvidence, loadWorks } from '../src/lib/content/load.ts';
import type { Work } from '../src/lib/content/schema.ts';
import { attestationGate } from '../src/lib/validation/attestation.ts';
import { codes, sampleWork } from './helpers.ts';

describe('public artifact attestation', () => {
  it('is current — every recorded digest still matches what is on disk', () => {
    assert.deepEqual(attestationGate(loadWorks(), loadEvidence()), []);
  });

  it('has nothing to attest while every shipping work is public', () => {
    // Attestation covers a work whose source cannot be linked: the public
    // artefact is then the only thing a reader can check, so the record fixes
    // the bytes a human verified. Every work in this release has a public
    // repository, so there is no such artefact and the register is empty.
    assert.deepEqual(attestations, []);
  });

  it('derives the covered set rather than trusting the list in the record', () => {
    for (const att of attestations) {
      const derived = attestedArtifacts(att.verificationId);
      assert.deepEqual(att.artifacts, derived);
      assert.equal(att.publicArtifactDigest, artifactDigest(derived));
    }
  });

  it('never records a path outside the public site', () => {
    for (const att of attestations) {
      for (const a of att.artifacts) {
        assert.match(a, /^(public|src)\//);
        assert.doesNotMatch(a, /\.\./);
      }
    }
  });

  it('fails when nothing claims the id any more', () => {
    // A record that is asserting a review of a set nothing points at. The
    // register is a fixture rather than the file on disk, so this rule is
    // exercised whether or not the repository currently holds such a record.
    const orphan = [
      {
        verificationId: 'ORPHAN-01',
        verifiedAt: '2026-01-01T00:00:00Z',
        artifacts: ['src/content/work/crm.json'],
        publicArtifactDigest: 'x'.repeat(64),
      },
    ];
    assert.deepEqual(
      codes(attestationGate(loadWorks(), loadEvidence(), orphan)),
      ['P-ATTEST-ORPHAN'],
    );
  });

  it('warns for an unattested id before shipping, and fails once it ships', () => {
    const base = sampleWork();
    const withId = (shipping: boolean): Work[] => [
      {
        ...base,
        slug: 'unattested',
        shipping,
        showcase: {
          ...base.showcase!,
          verification: { tests: null, verificationId: 'NOT-ATTESTED-01' },
        },
      },
      ...loadWorks(),
    ];

    assert.deepEqual(
      codes(attestationGate(withId(false), loadEvidence())),
      ['W-ATTEST-PENDING'],
    );
    assert.deepEqual(
      codes(attestationGate(withId(true), loadEvidence())),
      ['P-ATTEST-STALE'],
    );
  });

  it('has an attestation for every id the public content claims', () => {
    const attested = new Set(attestations.map((a) => a.verificationId));
    for (const [id] of claimedVerificationIds()) assert.ok(attested.has(id), id);
  });
});
