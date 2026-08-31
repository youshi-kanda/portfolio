/**
 * The Truth Gate — every content rule the build enforces, in one call.
 *
 * Ordering matters: this runs BEFORE rendering, not after. A page that has
 * already been written to disk and then found to be wrong is a page that can
 * be deployed by accident.
 */
import { heroLede, shippingWorks } from '../content/derive.ts';
import type { ContentBundle } from '../content/load.ts';
import { approvedCopyGate } from './approved-copy.ts';
import { errors, format, warnings, type Finding } from './finding.ts';
import { truthGate, type Mode } from './truth.ts';
import { uiCopyGate } from './ui-copy.ts';
import { variantGate } from './variant.ts';

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
  options: { mode: Mode; strict?: boolean } = { mode: 'production' },
): GateResult {
  const { works, caseStudies, evidence, copy, uiCopy } = content;
  const shipping = shippingWorks(works);

  const findings: Finding[] = [
    ...truthGate({ works, caseStudies, evidence, copy, uiCopy, mode: options.mode }),
    ...approvedCopyGate(copy, [
      { id: 'home.hero.lede', rendered: heroLede(shipping.length) },
    ]),
    ...uiCopyGate(uiCopy),
    ...variantGate(
      shipping.map((w) => ({ slug: w.slug, entryVariant: w.visual.entryVariant })),
      { strict: options.strict ?? false },
    ),
  ];

  const errs = errors(findings);
  return { findings, errors: errs, warnings: warnings(findings), ok: errs.length === 0 };
}
