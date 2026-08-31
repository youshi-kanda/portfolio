/**
 * The Truth Policy — semantic validation, as distinct from schema validation.
 *
 * The schema asks "is this field a string?". This asks "is this claim allowed
 * to be published, given what we know about where it came from?".
 *
 * Rules (TASK-PORTFOLIO-IMPLEMENT-01 §7, content-model §2.1):
 *
 *   T-UNAPPROVED   shipping && reviewStatus !== 'approved'
 *   T-NO-SOURCE    sourceType === 'source-derived' && sourceRefs is empty
 *   T-EMPTY-FACT   sourceType === 'user-fact' && the value is empty
 *   T-NO-APPROVER  an authored string is approved but records no approver/date
 *   T-DEAD-REF     a work points at an Evidence id that does not exist
 *   T-PROVENANCE   a full Evidence component is claimed for a record whose
 *                  provenance is not established (SHA256 未取得)
 *
 * In `development` every ERROR is reported as a WARN instead, so an author can
 * see the page with pending content on it. In `production` nothing is
 * downgraded and there is no `--force` escape hatch.
 */
import type { Finding, Level } from './finding.ts';
import type {
  Work,
  CaseStudy,
  Evidence,
  CopyItem,
  UiCopyItem,
  Publication,
} from '../content/schema.ts';

export type Mode = 'production' | 'development';

interface Subject {
  /** Human-readable identity used in the failure message. */
  id: string;
  shipping: boolean;
  publication: Publication;
  /** For user-fact subjects: the value that must not be empty. */
  value?: string;
}

const isEmpty = (s: string | undefined | null): boolean => !s || s.trim() === '';

function checkSubject(s: Subject, level: Level): Finding[] {
  const out: Finding[] = [];
  const p = s.publication;

  if (s.shipping && p.reviewStatus !== 'approved') {
    out.push({
      level,
      code: 'T-UNAPPROVED',
      message:
        `${s.id} は shipping だが reviewStatus = ${p.reviewStatus}。` +
        `source.kind = ${p.sourceType}。承認されるまで production build は通らない。`,
    });
  }

  if (p.sourceType === 'source-derived' && p.sourceRefs.length === 0) {
    out.push({
      level,
      code: 'T-NO-SOURCE',
      message:
        `${s.id} は source-derived だが sourceRefs が空。` +
        `出所を照合できない文は source-derived を名乗れない。`,
    });
  }

  if (p.sourceType === 'user-fact' && isEmpty(s.value)) {
    out.push({
      level,
      code: 'T-EMPTY-FACT',
      message:
        `${s.id} は user-fact だが値が空。` +
        `事実が提供されるまで、もっともらしい値で埋めない。`,
    });
  }

  if (
    p.sourceType === 'authored' &&
    p.reviewStatus === 'approved' &&
    (isEmpty(p.approvedBy) || isEmpty(p.approvedAt))
  ) {
    out.push({
      level,
      code: 'T-NO-APPROVER',
      message:
        `${s.id} は approved だが approvedBy / approvedAt が欠けている。` +
        `誰がいつ承認したか記録の無い承認は承認ではない。`,
    });
  }

  return out;
}

export interface TruthInput {
  works: readonly Work[];
  caseStudies?: readonly CaseStudy[];
  evidence: readonly Evidence[];
  copy: readonly CopyItem[];
  /**
   * The UI chrome registry. Held to the same publication rules as authored
   * copy — a label is as much a shipping claim as a sentence is, and the whole
   * point of registering them (content-model §4) was to stop treating chrome as
   * exempt from review.
   */
  uiCopy?: readonly UiCopyItem[];
  mode: Mode;
}

export function truthGate({
  works,
  caseStudies = [],
  evidence,
  copy,
  uiCopy = [],
  mode,
}: TruthInput): Finding[] {
  const level: Level = mode === 'production' ? 'ERROR' : 'WARN';
  const out: Finding[] = [];

  for (const w of works) {
    out.push(
      ...checkSubject(
        { id: `work/${w.slug}`, shipping: w.shipping, publication: w.publication },
        level,
      ),
    );
  }

  const bySlug = new Map(works.map((w) => [w.slug, w]));
  for (const c of caseStudies) {
    // A Case Study ships when its work does — it is that work's own page.
    const work = bySlug.get(c.slug);
    out.push(
      ...checkSubject(
        {
          id: `case-study/${c.slug}`,
          shipping: work?.shipping ?? false,
          publication: c.publication,
        },
        level,
      ),
    );

    if (!work) {
      out.push({
        level,
        code: 'T-ORPHAN-CASE',
        message:
          `case-study/${c.slug} に対応する work が無い。` +
          `作品の無い Case Study はどのルートからも到達できない。`,
      });
    }
  }

  // A work may not promise a Case Study it does not have. The call to action
  // renders off `caseStudyPublished`, so a true flag with no record is a link
  // whose label promises a page that will 404.
  const caseBySlug = new Set(caseStudies.map((c) => c.slug));
  for (const w of works) {
    if (w.caseStudyPublished && !caseBySlug.has(w.slug)) {
      out.push({
        level,
        code: 'T-NO-CASE',
        message:
          `work/${w.slug} は caseStudyPublished = true だが ` +
          `src/content/case-study/${w.slug}.json が無い。` +
          `読めない Case Study への導線を出さない。`,
      });
    }
  }

  for (const c of copy) {
    out.push(
      ...checkSubject(
        { id: `copy/${c.id}`, shipping: true, publication: c.publication, value: c.text },
        level,
      ),
    );
  }

  for (const c of uiCopy) {
    out.push(
      ...checkSubject(
        { id: `copy/${c.id}`, shipping: true, publication: c.publication, value: c.text },
        level,
      ),
    );
  }

  // A work may only point at Evidence that exists. A dead Evidence reference
  // renders as a missing figure, which reads as "no evidence" rather than as a
  // broken build — so it has to be caught here.
  const byId = new Map(evidence.map((e) => [e.id, e]));
  for (const w of works) {
    for (const id of w.evidence) {
      if (!byId.has(id)) {
        out.push({
          level,
          code: 'T-DEAD-REF',
          message: `work/${w.slug} が参照する Evidence ${id} が存在しない。`,
        });
      }
    }
  }

  // Case Study claims cite Evidence inline. A citation pointing at nothing is
  // worse than no citation: it reads as "this is evidenced" while showing none.
  for (const c of caseStudies) {
    const cited: { where: string; id: string }[] = [
      ...c.decisions.flatMap((d) =>
        d.evidenceRefs.map((id) => ({ where: `decisions/${d.title}`, id })),
      ),
      ...c.highlights.flatMap((h) =>
        h.evidenceRefs.map((id) => ({ where: `highlights/${h.claim}`, id })),
      ),
    ];
    for (const { where, id } of cited) {
      if (!byId.has(id)) {
        out.push({
          level,
          code: 'T-DEAD-REF',
          message: `case-study/${c.slug} の ${where} が参照する Evidence ${id} が存在しない。`,
        });
      }
    }
  }

  return out;
}

/**
 * A record whose SHA256 is not yet taken may still be shown as a figure with a
 * caption — that claims nothing about provenance. It may not be shown with the
 * provenance expander, which would present 未取得 as if it were a record.
 */
export function assertProvenanceComplete(e: Evidence, mode: Mode): Finding[] {
  if (e.provenanceComplete) return [];
  return [
    {
      level: mode === 'production' ? 'ERROR' : 'WARN',
      code: 'T-PROVENANCE',
      message:
        `Evidence ${e.id} は provenance 未確定（SHA256 ${e.sha}）。` +
        `出所 expander を出せるのは PUBLISH-MAP が揃った記録だけ。`,
    },
  ];
}
