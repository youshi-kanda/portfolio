/**
 * The Truth Policy — semantic validation, as distinct from schema validation.
 *
 * The schema asks "is this field a string?". This asks "is this claim allowed
 * to be published, given what we know about where it came from?".
 *
 * Rules (TASK-PORTFOLIO-IMPLEMENT-01 §7, content-model §2.1):
 *
 *   T-UNAPPROVED   shipping && reviewStatus !== 'approved'
 *   T-DEAD-REF     a work points at an Evidence id that does not exist
 *   T-PROVENANCE   a full Evidence component is claimed for a record whose
 *                  provenance is not established (SHA256 未取得)
 *
 * T-NO-SOURCE / T-NO-BASIS / T-NO-APPROVER / T-EMPTY-FACT are not decided
 * here. What a record must carry depends on TWO axes — what kind of statement
 * it makes and where it came from — so it is a cell in the provenance matrix
 * (`provenance.ts`) rather than a chain of conditions on one field.
 *
 * T-UNAPPROVED stays, and stays unconditional: it is a rule about shipping,
 * not about provenance. A label is as much a shipping string as a claim is,
 * and being presentation is not an exemption from review. That separation is
 * the point — "someone approved it" is what makes a string publishable, never
 * what makes a claim true. What makes an authored claim true is its basis, and
 * the matrix is where that is asked for.
 *
 * In `development` every ERROR is reported as a WARN instead, so an author can
 * see the page with pending content on it. In `production` nothing is
 * downgraded and there is no `--force` escape hatch.
 */
import type { Finding, Level } from './finding.ts';
import { workSource } from '../content/compat.ts';
import { BASIS_ID_FORMS, provenanceFindings, type BasisResolver } from './provenance.ts';
import type {
  Work,
  CaseStudy,
  Evidence,
  ClaimType,
  CopyItem,
  UiCopyItem,
  Publication,
} from '../content/schema.ts';

export type Mode = 'production' | 'development';

interface Subject {
  /** Human-readable identity used in the failure message. */
  id: string;
  shipping: boolean;
  /**
   * What kind of statement this subject makes. A registered string carries the
   * answer on its own record; a work, a Case Study or an Evidence record does
   * not, because there is no presentation variant of one — it asserts a scope,
   * a language list, a test count, and is asked as a `fact`.
   */
  claimType: ClaimType;
  publication: Publication;
  /** For user-fact subjects: the value that must not be empty. */
  value?: string;
  /** How an `authored` fact's basis is checked against the registries. */
  resolve?: BasisResolver;
}

function checkSubject(s: Subject, level: Level): Finding[] {
  const out: Finding[] = [];
  const p = s.publication;

  if (s.shipping && p.reviewStatus !== 'approved') {
    out.push({
      level,
      code: 'T-UNAPPROVED',
      message:
        `${s.id} は shipping だが reviewStatus = ${p.reviewStatus}。` +
        `source.kind = ${p.sourceType} / claim.kind = ${s.claimType}。` +
        `承認されるまで production build は通らない。`,
    });
  }

  out.push(
    ...provenanceFindings(
      { id: s.id, claimType: s.claimType, publication: p, value: s.value, resolve: s.resolve },
      level,
    ),
  );

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

  const bySlug = new Map(works.map((w) => [w.slug, w]));
  const caseBySlug = new Set(caseStudies.map((c) => c.slug));
  const byId = new Map(evidence.map((e) => [e.id, e]));

  /**
   * What an `authored` fact may cite as its basis, and whether that citation
   * lands. The registries are already loaded here, so the check costs a lookup
   * — and it is the difference between a basis and a plausible-looking string.
   *
   * A reference that matches no known form is `external`: a section of a
   * planning document is a real basis this repository cannot resolve, and
   * treating "cannot check" as "wrong" would push authors toward citing
   * nothing rather than citing something unverifiable.
   */
  const EXISTS: Record<string, (id: string) => boolean> = {
    work: (id) => bySlug.has(id),
    'case-study': (id) => caseBySlug.has(id),
    evidence: (id) => byId.has(id),
  };
  const resolve: BasisResolver = (ref) => {
    for (const { re, collection } of BASIS_ID_FORMS) {
      const m = re.exec(ref);
      if (m) return EXISTS[collection]!(m[1]!) ? 'resolved' : 'dangling';
    }
    return 'external';
  };

  for (const w of works) {
    out.push(
      ...checkSubject(
        {
          id: `work/${w.slug}`,
          shipping: w.shipping,
          claimType: 'fact',
          publication: w.publication,
          resolve,
        },
        level,
      ),
    );
  }

  for (const c of caseStudies) {
    // A Case Study ships when its work does — it is that work's own page.
    const work = bySlug.get(c.slug);
    out.push(
      ...checkSubject(
        {
          id: `case-study/${c.slug}`,
          shipping: work?.shipping ?? false,
          claimType: 'fact',
          publication: c.publication,
          resolve,
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

  // CS-16 sends the reader somewhere to check the claims. A work whose source
  // is public has such a place, so its Case Study has to name it; a work whose
  // source is a private engagement has none, and the schema cannot tell the
  // two apart because the answer is on the work, not on the Case Study.
  for (const c of caseStudies) {
    const work = bySlug.get(c.slug);
    if (!work || c.repository.length > 0) continue;
    if (workSource(work)?.access === 'public-repo') {
      out.push({
        level,
        code: 'T-NO-REPO',
        message:
          `case-study/${c.slug} は repository を 1 件も挙げていないが、` +
          `work/${work.slug} のソースは公開されている。` +
          `確かめに行ける場所があるなら、それを出す。`,
      });
    }
  }

  // A work may not promise a Case Study it does not have. The call to action
  // renders off `caseStudyPublished`, so a true flag with no record is a link
  // whose label promises a page that will 404.
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
        {
          id: `copy/${c.id}`,
          shipping: true,
          claimType: c.publication.claimType,
          publication: c.publication,
          value: c.text,
          resolve,
        },
        level,
      ),
    );
  }

  for (const c of uiCopy) {
    out.push(
      ...checkSubject(
        {
          id: `copy/${c.id}`,
          shipping: true,
          claimType: c.publication.claimType,
          publication: c.publication,
          value: c.text,
          resolve,
        },
        level,
      ),
    );
  }

  // A work may only point at Evidence that exists. A dead Evidence reference
  // renders as a missing figure, which reads as "no evidence" rather than as a
  // broken build — so it has to be caught here.
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
