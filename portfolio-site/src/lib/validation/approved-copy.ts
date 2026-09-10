/**
 * Approved copy may not be reworded.
 *
 * The user approved specific sentences, not slots. If a later edit changes an
 * approved string, that approval no longer covers what ships — so the build
 * fails here rather than letting unapproved copy go out under an approval
 * record that does not apply to it.
 *
 * The comparison is against the literal text, not a hash, so the failure can
 * print the approved sentence next to the current one and the difference is
 * readable without tooling.
 *
 *   A-CHANGED   an approved string no longer matches the frozen snapshot
 *   A-MISSING   the snapshot holds an id the copy registry does not carry
 *   A-UNKNOWN   the registry claims `approved` for an id the snapshot lacks
 *   A-DERIVED   a computed string (the hero lede) no longer renders to its
 *               approved form
 *   A-BATCH     the registry row's approvedBy / approvedAt does not name the
 *               approval event the snapshot records for that id
 */
import { APPROVAL_BATCHES, APPROVED_TEXT } from '../content/approved-text.ts';
import type { CopyItem } from '../content/schema.ts';
import type { Finding } from './finding.ts';

export interface DerivedCopy {
  id: string;
  rendered: string;
}

export function approvedCopyGate(
  items: readonly CopyItem[],
  derived: readonly DerivedCopy[] = [],
): Finding[] {
  const out: Finding[] = [];
  const byId = new Map(items.map((i) => [i.id, i]));

  for (const [id, approved] of Object.entries(APPROVED_TEXT)) {
    const item = byId.get(id);
    if (!item) {
      out.push({
        level: 'ERROR',
        code: 'A-MISSING',
        message: `承認済み copy ${id} が copy registry に無い。`,
      });
      continue;
    }
    if (item.text !== approved) {
      out.push({
        level: 'ERROR',
        code: 'A-CHANGED',
        message:
          `承認済み copy が書き換えられている\n` +
          `    content id: ${id}\n` +
          `    approved:   ${approved}\n` +
          `    current:    ${item.text}\n` +
          `    文言を変えるなら、新しい承認を approved-text.ts に記録すること。`,
      });
    }
  }

  for (const item of items) {
    if (item.publication.reviewStatus === 'approved' && !(item.id in APPROVED_TEXT)) {
      out.push({
        level: 'ERROR',
        code: 'A-UNKNOWN',
        message: `${item.id} は approved を名乗るが、承認スナップショットに無い。`,
      });
    }
  }

  // The registry row states who approved the string and when. The Truth Policy
  // only asks that both fields be non-empty (`T-NO-APPROVER`), which any date
  // satisfies. Here they are held against the approval event the snapshot
  // records, so the two cannot disagree about a single string — a row that
  // names a date no approval happened on is a fabricated record, not a typo.
  const batchOf = new Map<string, (typeof APPROVAL_BATCHES)[number]>();
  for (const batch of APPROVAL_BATCHES) {
    for (const id of batch.ids) {
      const already = batchOf.get(id);
      if (already) {
        out.push({
          level: 'ERROR',
          code: 'A-BATCH',
          message:
            `${id} が承認バッチ ${already.task} と ${batch.task} の両方にある。` +
            `1 つの文字列が承認された機会は 1 つであること。`,
        });
        continue;
      }
      batchOf.set(id, batch);
    }
  }

  for (const id of Object.keys(APPROVED_TEXT)) {
    if (!batchOf.has(id)) {
      out.push({
        level: 'ERROR',
        code: 'A-BATCH',
        message:
          `${id} は承認スナップショットにあるが、どの承認バッチにも属していない。` +
          `いつ誰が承認したか辿れない承認は承認ではない。`,
      });
    }
  }

  for (const item of items) {
    const batch = batchOf.get(item.id);
    if (!batch) continue;
    const p = item.publication;
    if (p.approvedBy !== batch.by || p.approvedAt !== batch.at) {
      out.push({
        level: 'ERROR',
        code: 'A-BATCH',
        message:
          `承認記録が承認バッチと一致しない\n` +
          `    content id: ${item.id}\n` +
          `    batch:      ${batch.task} — ${batch.by} / ${batch.at}\n` +
          `    registry:   ${p.approvedBy} / ${p.approvedAt}`,
      });
    }
  }

  // Strings the page computes rather than stores still ship, so they are held
  // to the same approval. The hero lede states how many demos are published;
  // approval covers the sentence the user read, which is the one rendered at
  // the work count that existed when it was approved.
  for (const d of derived) {
    const approved = APPROVED_TEXT[d.id];
    if (approved === undefined) continue;
    if (d.rendered !== approved) {
      out.push({
        level: 'ERROR',
        code: 'A-DERIVED',
        message:
          `導出される copy が承認時と一致しない\n` +
          `    content id: ${d.id}\n` +
          `    approved:   ${approved}\n` +
          `    current:    ${d.rendered}\n` +
          `    作品数が変わったなら、その件数の文で新しい承認を取ること。`,
      });
    }
  }

  return out;
}
