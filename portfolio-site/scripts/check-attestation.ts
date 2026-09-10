/**
 * `npm run check:attestation` — the public half of provenance, in public CI.
 *
 * Everything this needs is in the repository, so unlike
 * `verify:private-provenance` it runs anywhere: the artifacts, the derived
 * artifact set, and the digest a human froze. It answers one question — have
 * the reviewed bytes changed? — and says nothing about whether the text is
 * true, because nothing here can see the source that would settle that.
 *
 *     node scripts/check-attestation.ts [--print]
 *
 *   --print   report the derived artifacts and their CURRENT digest, and
 *             change nothing. There is deliberately no --write: refreshing an
 *             attestation is a claim that a person read the new bytes, and a
 *             flag that made it a keystroke would make the record worthless.
 *
 * Exit 0 = every attestation current. Exit 1 = one is not.
 */
import { artifactDigest, attestations, attestedArtifacts, claimedVerificationIds } from '../src/lib/content/attestation.ts';
import { loadEvidence, loadWorks } from '../src/lib/content/load.ts';
import { attestationGate } from '../src/lib/validation/attestation.ts';
import { errors, format, warnings } from '../src/lib/validation/finding.ts';

if (process.argv.includes('--print')) {
  for (const [id] of [...claimedVerificationIds()].sort()) {
    const artifacts = attestedArtifacts(id);
    console.log(`${id}`);
    for (const a of artifacts) console.log(`  ${a}`);
    console.log(`  digest ${artifactDigest(artifacts)}`);
  }
  process.exit(0);
}

const findings = attestationGate(loadWorks(), loadEvidence());
const errs = errors(findings);
const warns = warnings(findings);

const claimed = claimedVerificationIds();
console.log(
  `PUBLIC_ARTIFACT_ATTESTATION — claimed id ${claimed.size} / attested ${attestations.length}`,
);
for (const att of attestations) {
  const stale = errs.some((f) => f.message.startsWith(att.verificationId));
  console.log(
    `  id=${att.verificationId} verifiedAt=${att.verifiedAt} ` +
      `artifacts=${att.artifacts.length} digest=${att.publicArtifactDigest.slice(0, 16)} ` +
      `state=${stale ? 'STALE' : 'CURRENT'}`,
  );
  for (const a of att.artifacts) console.log(`    covers: ${a}`);
}
console.log('  ※ 公開記述が private source の意味に反していないかは、この check の対象外');

if (warns.length > 0) {
  console.log(`\n${warns.length} warning(s):`);
  console.log(format(warns));
}

if (errs.length > 0) {
  console.error(`\nPUBLIC_ARTIFACT_ATTESTATION = FAIL（${errs.length}）`);
  console.error(format(errs));
  process.exit(1);
}

console.log('\nPUBLIC_ARTIFACT_ATTESTATION = PASS');
