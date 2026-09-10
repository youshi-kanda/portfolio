/**
 * Public Artifact Attestation — the one thing a public CI can honestly check
 * about a work whose source it cannot see.
 *
 * WHAT THIS IS NOT. It is not evidence that the private source says what the
 * public text says. That check needs the private source, it happens on a
 * machine that has it (`scripts/verify-private-provenance.ts`), and its human
 * half is a reading rather than a computation. Nothing here can stand in for
 * it, and a record that implied otherwise would be worse than no record.
 *
 * WHAT IT IS. A human read a specific set of bytes and the set was frozen at
 * that moment. This says which bytes those were. Afterwards a public CI can
 * answer exactly one question — have they changed since? — without holding
 * anything private. That is a small guarantee, and it is the one that closes
 * the actual gap: a review that passed and then a file that quietly moved on.
 *
 * WHY THE PATH IS IN THE HASH. An attestation that survived `git mv` would be
 * attesting to bytes nobody can find any more. Renaming a covered file is a
 * change to what was reviewed, so it has to break the digest.
 *
 * WHY THE ARTIFACT LIST IS DERIVED AND NOT TRUSTED. The record states its
 * artifacts, but `attestedArtifacts` computes them from the content, and the
 * gate compares the two. A list typed into a file goes stale the day a work
 * gains an Evidence record — and a stale list would narrow the digest's cover
 * without anything looking wrong.
 *
 * WHAT MUST NEVER BE IN HERE. No private path, no repository name, no commit,
 * no private document title. The schema is `.strict()` for that reason: a new
 * field cannot be introduced by writing one into the JSON, only by changing
 * this file, where the rule is written down next to it.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'astro/zod';
import raw from '../../content/attestations.json' with { type: 'json' };
import { loadCaseStudies, loadEvidence, loadWorks } from './load.ts';

/** Everything an artifact path is relative to: the site root. */
export const SITE_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

const attestationSchema = z
  .object({
    /** The opaque public handle for the private source. Never the source. */
    verificationId: z.string().min(1),
    /** ISO 8601, UTC. When this artifact set was frozen for review. */
    verifiedAt: z.string().min(1),
    /** Site-relative, sorted. Checked against the derived set, not trusted. */
    artifacts: z.array(z.string().min(1)).min(1),
    publicArtifactDigest: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict();

export type Attestation = z.infer<typeof attestationSchema>;

export const attestations: readonly Attestation[] = z
  .array(attestationSchema)
  .parse(raw);

/**
 * The public artifacts one verificationId stands behind — derived, not listed.
 *
 * A work that claims the id brings its own record, its Case Study when it has
 * one, and the Evidence it points at; a drawn Evidence record brings its image.
 */
export function attestedArtifacts(id: string): string[] {
  const files = new Set<string>();

  for (const w of loadWorks()) {
    if (w.showcase?.verification.verificationId !== id) continue;
    files.add(`src/content/work/${w.slug}.json`);
    if (loadCaseStudies().some((c) => c.slug === w.slug)) {
      files.add(`src/content/case-study/${w.slug}.json`);
    }
    for (const eid of w.evidence) files.add(`src/content/evidence/${eid}.json`);
  }
  for (const e of loadEvidence()) {
    if (e.diagram?.verificationId !== id) continue;
    files.add(`src/content/evidence/${e.id}.json`);
    files.add(`public${e.image.src}`);
  }
  return [...files].sort();
}

/** Every verificationId the public content claims, with who claims it. */
export function claimedVerificationIds(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const add = (id: string | null | undefined, where: string): void => {
    if (!id) return;
    out.set(id, [...(out.get(id) ?? []), where]);
  };
  for (const w of loadWorks()) add(w.showcase?.verification.verificationId, `work/${w.slug}`);
  for (const e of loadEvidence()) add(e.diagram?.verificationId, `evidence/${e.id}`);
  return out;
}

/**
 * One digest over an ordered set of site-relative files, path included.
 *
 * `attestations.json` itself is never in the set: a record cannot cover its own
 * bytes without changing them as it is written.
 */
export function artifactDigest(paths: readonly string[]): string {
  const h = createHash('sha256');
  for (const rel of paths) {
    h.update(rel, 'utf8');
    h.update('\0');
    h.update(readFileSync(new URL(rel, `file://${SITE_ROOT}`)));
    h.update('\0');
  }
  return h.digest('hex');
}
