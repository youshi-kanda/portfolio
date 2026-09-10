/**
 * The FACT provenance matrix — what a record has to carry, by what kind of
 * statement it makes and where it came from.
 *
 * V3 asked one question, `sourceType`, and hung three rules off it. That
 * conflated two axes: "閉じる ESC" and "backend 静的 480 件" are both
 * transcriptions with a locator, and only one of them can be wrong about the
 * world. Holding a button label to a fact's burden of proof is theatre; letting
 * a count off it is how a false number ships.
 *
 * So the requirement is a cell in a 2 × 3 table rather than a chain of ifs, and
 * the table is DATA. Written as code, the exemption for presentation would be a
 * `!==` buried in a condition; written as a row, it is a decision someone can
 * read, and the test can check that every combination has exactly one row and
 * that none was left undecided.
 *
 *                  source-derived      authored            user-fact
 *   fact           sourceRefs          basis + approver    value + approver
 *   presentation   —                   —                   value
 *
 * WHAT IS NOT A COLUMN HERE, AND WHY. Shipping approval is not in this table.
 * `reviewStatus = approved` is required of every shipping string on this site
 * regardless of which cell it lands in — that is T-UNAPPROVED, and it lives in
 * truth.ts because it is a rule about SHIPPING. This table is about FACT
 * PROVENANCE: what makes the statement true, not what makes it publishable.
 * The two are separate questions and conflating them is how "someone approved
 * it" starts being accepted as a reason a claim is true.
 *
 * WHY `authored` GAINED `basis`. The cell used to ask for nothing but an
 * approver, which made approval itself the grounds for a claim: "この
 * システムは Human Approval を実装しています" would have shipped on the
 * strength of someone having set reviewStatus. `authored` says the SENTENCE
 * was written here. It does not say the FACT was. A claim written for this
 * site still rests on something, and that something has to be named.
 *
 * WHY `basis` REUSES `sourceRefs` INSTEAD OF A NEW FIELD. The two readings
 * cannot collide: a string is transcribed or it is written, never both, so
 * `sourceType` already says which way to read the array. On a `source-derived`
 * row the refs say WHERE THE WORDS CAME FROM; on an `authored` row they say
 * WHAT MAKES IT TRUE. A second array would be a field that is null on every
 * row where the first one is populated — the same slot, named twice.
 *
 * What may stand as a basis: a reference this repository's Truth System can
 * resolve (`work/<slug>`, `case-study/<slug>`, `evidence/<id>`), or an external
 * public locator — a document section, a `file:line`. A Truth-System reference
 * is checked: naming `evidence/CRM-V99` and having it not exist is a basis that
 * resolves to nothing, which is worse than none at all because it reads as
 * evidenced.
 */
import type { ClaimType, Publication, SourceType } from '../content/schema.ts';
import type { Finding, Level } from './finding.ts';

export type Requirement = 'sourceRefs' | 'basis' | 'approver' | 'nonEmptyValue';

export interface MatrixCell {
  claimType: ClaimType;
  sourceType: SourceType;
  requires: readonly Requirement[];
  /** Why this cell asks for what it asks for. */
  why: string;
}

export const PROVENANCE_MATRIX: readonly MatrixCell[] = [
  {
    claimType: 'fact',
    sourceType: 'source-derived',
    requires: ['sourceRefs'],
    why: '出所を照合できない文は source-derived を名乗れない。',
  },
  {
    claimType: 'fact',
    sourceType: 'authored',
    requires: ['basis', 'approver'],
    why:
      'authored は「文章をこちらで書いた」であって「根拠なしに事実を作ってよい」ではない。' +
      '書いた文が述べている事実には、解決できる根拠が要る。',
  },
  {
    claimType: 'fact',
    sourceType: 'user-fact',
    requires: ['nonEmptyValue', 'approver'],
    why:
      '事実が提供されるまで、もっともらしい値で埋めない。' +
      '本人しか Authority を持たない情報は、本人が確認した記録があって初めて出る。',
  },
  {
    claimType: 'presentation',
    sourceType: 'source-derived',
    requires: [],
    why: 'ラベル・見出し・ボタンは世界について何も主張しない。出所は任意。',
  },
  {
    claimType: 'presentation',
    sourceType: 'authored',
    requires: [],
    why: '提示のための文に FACT の根拠は求めない。出荷には reviewStatus が要る。',
  },
  {
    claimType: 'presentation',
    sourceType: 'user-fact',
    requires: ['nonEmptyValue'],
    why: '本人しか知らない値が空なら、それは提示ではなく穴である。',
  },
];

const REQUIREMENT_CODE: Record<Requirement, string> = {
  sourceRefs: 'T-NO-SOURCE',
  basis: 'T-NO-BASIS',
  approver: 'T-NO-APPROVER',
  nonEmptyValue: 'T-EMPTY-FACT',
};

export function matrixCell(claimType: ClaimType, sourceType: SourceType): MatrixCell {
  const cell = PROVENANCE_MATRIX.find(
    (c) => c.claimType === claimType && c.sourceType === sourceType,
  );
  // The matrix is exhaustive over the two enums and a test holds it that way,
  // so this cannot be reached without a new enum member having been added
  // without a row — which is exactly when a default would be wrong.
  if (!cell) {
    throw new Error(
      `provenance matrix に ${claimType} × ${sourceType} の行が無い。` +
        `列挙子を足したら行も足すこと。`,
    );
  }
  return cell;
}

/**
 * The reference forms this repository can resolve, and what each one points at.
 * Prefixed on purpose: a bare `CRM-V06` is indistinguishable from a section
 * number in a document, and a resolver that guesses would turn an external
 * locator it failed to parse into a dangling reference.
 */
export const BASIS_ID_FORMS: readonly { re: RegExp; collection: string }[] = [
  { re: /^work\/(.+)$/, collection: 'work' },
  { re: /^case-study\/(.+)$/, collection: 'case-study' },
  { re: /^evidence\/(.+)$/, collection: 'evidence' },
];

export type BasisVerdict = 'resolved' | 'dangling' | 'external';

/**
 * Whether one reference names something in the Truth System, and whether that
 * something exists. `external` is not a failure: a document section or a
 * `file:line` in the planning repository is a legitimate basis, and this
 * repository cannot check it.
 */
export type BasisResolver = (ref: string) => BasisVerdict;

/** Used when no registry is at hand — every ref reads as an external locator. */
export const NO_RESOLVER: BasisResolver = () => 'external';

export interface ProvenanceSubject {
  id: string;
  /**
   * What kind of statement this subject makes. Passed in, not read off the
   * record: only a registered string has the field, because only a string can
   * be presentation. A work, a Case Study or an Evidence record is asked as a
   * `fact` — it asserts a scope, a language list, a count.
   */
  claimType: ClaimType;
  publication: Publication;
  /** The rendered value, for the requirements that are about it being there. */
  value?: string;
  /** How to check a basis that names a record. Defaults to no checking. */
  resolve?: BasisResolver;
}

const isEmpty = (s: string | undefined | null): boolean => !s || s.trim() === '';

/** The provenance half of the Truth Policy, driven by the matrix above. */
export function provenanceFindings(s: ProvenanceSubject, level: Level): Finding[] {
  const p = s.publication;
  const cell = matrixCell(s.claimType, p.sourceType);
  const resolve = s.resolve ?? NO_RESOLVER;
  const out: Finding[] = [];

  for (const requirement of cell.requires) {
    const code = REQUIREMENT_CODE[requirement];

    if (requirement === 'sourceRefs' && p.sourceRefs.length === 0) {
      out.push({
        level,
        code,
        message: `${s.id} は ${s.claimType} / ${p.sourceType} だが sourceRefs が空。${cell.why}`,
      });
    }

    if (requirement === 'basis') {
      const refs = p.sourceRefs.filter((r) => !isEmpty(r));

      if (refs.length === 0) {
        out.push({
          level,
          code,
          message:
            `${s.id} は authored の ${s.claimType} だが根拠が 1 件も無い。${cell.why}\n` +
            `    根拠に置けるもの: work/<slug> / case-study/<slug> / evidence/<id> / ` +
            `公開できる外部 locator（文書の節・file:line）。`,
        });
      }

      // A basis that names a record and points at nothing is worse than no
      // basis: it reads as evidenced while resolving to nothing.
      for (const ref of refs) {
        if (resolve(ref) === 'dangling') {
          out.push({
            level,
            code,
            message:
              `${s.id} の根拠 ${ref} は Truth System の参照形式だが、その記録が存在しない。` +
              `解決できない参照は根拠にならない。`,
          });
        }
      }
    }

    if (
      requirement === 'approver' &&
      p.reviewStatus === 'approved' &&
      (isEmpty(p.approvedBy) || isEmpty(p.approvedAt))
    ) {
      out.push({
        level,
        code,
        message:
          `${s.id} は approved だが approvedBy / approvedAt が欠けている。` +
          `誰がいつ承認したか記録の無い承認は承認ではない。`,
      });
    }

    if (requirement === 'nonEmptyValue' && isEmpty(s.value)) {
      out.push({
        level,
        code,
        message: `${s.id} は ${p.sourceType} だが値が空。${cell.why}`,
      });
    }
  }

  return out;
}
