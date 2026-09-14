/**
 * The Truth Gate — every content rule the build enforces, in one call.
 *
 * Ordering matters: this runs BEFORE rendering, not after. A page that has
 * already been written to disk and then found to be wrong is a page that can
 * be deployed by accident.
 */
import { shippingWorks } from '../content/derive.ts';
import type { ContentBundle } from '../content/load.ts';
import { siteStrings } from '../content/site.ts';
import { approvedCopyGate } from './approved-copy.ts';
import { capabilitiesGate } from './capabilities.ts';
import { claimsGate } from './claims.ts';
import { siteCopyGate } from './site-copy.ts';
import { errors, format, warnings, type Finding } from './finding.ts';
import { migrationGate } from './migration.ts';
import { truthGate, type Mode } from './truth.ts';
import { uiCopyGate } from './ui-copy.ts';

export { errors, warnings, format };
export type { Finding, Mode };

export interface GateResult {
  findings: Finding[];
  errors: Finding[];
  warnings: Finding[];
  ok: boolean;
}

export function runGates(
  content: ContentBundle,
  options: { mode: Mode } = { mode: 'production' },
): GateResult {
  const { works, caseStudies, evidence, copy, uiCopy } = content;
  const shipping = shippingWorks(works);
  const site = siteStrings();
  /**
   * Registry ids whose text is the recorded output of a derivation — none
   * today. The hero lede was the only one, and V4 rewrote it into a sentence
   * that states no count and so is authored rather than computed. The gate
   * keeps taking the list: a derived string still ships, and the day one exists
   * again it is held to its approval like every other.
   */
  const derivedIds: string[] = [];

  const findings: Finding[] = [
    ...truthGate({ works, caseStudies, evidence, copy, uiCopy, mode: options.mode }),
    ...approvedCopyGate(copy),
    ...uiCopyGate(uiCopy),
    ...siteCopyGate(copy, uiCopy, site),
    ...claimsGate({ copy, uiCopy, site, workCount: shipping.length, derivedIds }),
    ...migrationGate(works, options.mode),
    ...capabilitiesGate(works),
  ];

  const errs = errors(findings);
  return { findings, errors: errs, warnings: warnings(findings), ok: errs.length === 0 };
}
