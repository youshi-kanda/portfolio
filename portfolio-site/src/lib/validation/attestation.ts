/**
 * The Public Artifact Attestation gate.
 *
 * One question, asked in public, answerable in public: are the artifacts a
 * human read still the artifacts on disk?
 *
 *   P-ATTEST-STALE     the digest no longer matches. Something covered by the
 *                      attestation changed after the review that produced it,
 *                      so the review no longer describes what would ship. An
 *                      ERROR — this is the whole point of the record.
 *   P-ATTEST-SCOPE     the record's artifact list is not the set the content
 *                      derives. The digest would still "match" while covering
 *                      less than it claims to, which is the failure mode a
 *                      typed-in list has.
 *   P-ATTEST-ORPHAN    an attestation for a verificationId nothing claims. The
 *                      record is asserting a review of a set that no work or
 *                      Evidence points at any more.
 *   W-ATTEST-PENDING   a claimed verificationId with no attestation yet. A
 *                      warning while the work is not shipping — an id can be
 *                      written before a human has read anything — and an error
 *                      the moment the work ships.
 *
 * This gate reads bytes off disk, so it runs from `npm run check:attestation`
 * rather than inside `runGates`: the Truth Gate is given its content and the
 * unit tests hand it fixtures, and a gate that ignored the fixture to read the
 * real repository would be reporting on the wrong thing.
 */
import { artifactDigest, attestations, attestedArtifacts } from '../content/attestation.ts';
import type { Attestation } from '../content/attestation.ts';
import type { Evidence, Work } from '../content/schema.ts';
import type { Finding } from './finding.ts';

const sameList = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i]);

/**
 * `register` defaults to the file on disk, which is what every caller uses. It
 * is a parameter so the unit tests can hand the gate a record instead of
 * needing one to exist in the repository: a rule that can only be exercised
 * while some particular work is present is a rule that stops being tested the
 * day that work is not.
 */
export function attestationGate(
  works: readonly Work[],
  evidence: readonly Evidence[],
  register: readonly Attestation[] = attestations,
): Finding[] {
  const findings: Finding[] = [];

  const claimed = new Map<string, Work[]>();
  for (const w of works) {
    const id = w.showcase?.verification.verificationId;
    if (id) claimed.set(id, [...(claimed.get(id) ?? []), w]);
  }
  for (const e of evidence) {
    const id = e.diagram?.verificationId;
    if (id && !claimed.has(id)) claimed.set(id, []);
  }

  for (const att of register) {
    const { verificationId: id } = att;

    if (!claimed.has(id)) {
      findings.push({
        level: 'ERROR',
        code: 'P-ATTEST-ORPHAN',
        message:
          `attestations.json が ${id} を確認済みとしているが、公開コンテンツの中で ` +
          `この id を名乗っているレコードが 1 つも無い。確認した対象が今どこにも無い。`,
      });
      continue;
    }

    const derived = attestedArtifacts(id);
    if (!sameList(att.artifacts, derived)) {
      findings.push({
        level: 'ERROR',
        code: 'P-ATTEST-SCOPE',
        message:
          `${id} の attestation が挙げている artifact が、コンテンツから導出される集合と違う。\n` +
          `    記録: ${att.artifacts.join(' / ')}\n` +
          `    導出: ${derived.join(' / ')}\n` +
          `    digest は一致していても、覆っている範囲が記録より狭い/広い可能性がある。`,
      });
      continue;
    }

    const current = artifactDigest(derived);
    if (current !== att.publicArtifactDigest) {
      findings.push({
        level: 'ERROR',
        code: 'P-ATTEST-STALE',
        message:
          `${id} は ${att.verifiedAt} 時点の public artifact に対する確認だが、` +
          `その後 artifact が変わっている。\n` +
          `    記録 ${att.publicArtifactDigest.slice(0, 16)} / 現在 ${current.slice(0, 16)}\n` +
          `    内容を変えたなら、人の再確認を経てから attestation を更新すること。`,
      });
    }
  }

  const attested = new Set(register.map((a) => a.verificationId));
  for (const [id, claimants] of [...claimed].sort()) {
    if (attested.has(id)) continue;
    const shipping = claimants.some((w) => w.shipping);
    findings.push({
      level: shipping ? 'ERROR' : 'WARN',
      code: shipping ? 'P-ATTEST-STALE' : 'W-ATTEST-PENDING',
      message:
        `${id} を公開コンテンツが名乗っているが、attestations.json に記録が無い。` +
        (shipping
          ? '出荷中の作品が、人が読んだ範囲の記録を持たないまま公開されることになる。'
          : '出荷前なので警告に留める。shipping にする前に記録すること。'),
    });
  }

  return findings;
}
