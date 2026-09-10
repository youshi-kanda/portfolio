/** The shared result type for every gate. */
export type Level = 'ERROR' | 'WARN';

export interface Finding {
  level: Level;
  /** Stable machine code, e.g. `E-UNKNOWN`, `T-UNAPPROVED`. */
  code: string;
  message: string;
}

export const errors = (findings: readonly Finding[]): Finding[] =>
  findings.filter((f) => f.level === 'ERROR');

export const warnings = (findings: readonly Finding[]): Finding[] =>
  findings.filter((f) => f.level === 'WARN');

export const format = (findings: readonly Finding[]): string =>
  findings.map((f) => `  [${f.level} ${f.code}] ${f.message}`).join('\n');
