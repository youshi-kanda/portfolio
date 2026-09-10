/**
 * Coverage for the copy that lives in site.json. REPORT ONLY.
 *
 * Three registries govern the strings on this site, and until now they covered
 * two of the three places strings live:
 *
 *   ui.json        the strings embedded in components   — gated (U-UNMANAGED)
 *   shipping.json  the authored sentences               — gated (A-CHANGED)
 *   site.json      the section content in between       — ungoverned
 *
 * That third file is not a leftover. It holds the workflow steps, the stack
 * rows, the principles, the section ledes and the about rows — the section
 * content is most of what a reader actually reads.
 *
 * This gate WARNS and never fails, deliberately. Making it an error today would
 * mean either failing every build until the whole file is migrated, or
 * migrating a hundred strings inside the phase whose success condition is that
 * the output does not change. Phase 2 measures the gap and names it; Phase 3
 * closes it, and can then decide to promote this to U-UNMANAGED's severity.
 *
 * Coverage is matched on TEXT, not on a path, because no site.json string has
 * a registry row yet and so there is no path convention to match on. Phase 3
 * gives these rows their own key; text matching is the measurement that gets us
 * there, not the contract that stays.
 */
import { siteStrings, type SiteString } from '../content/site.ts';
import type { CopyItem, UiCopyItem } from '../content/schema.ts';
import type { Finding } from './finding.ts';

export interface SiteCopyCoverage {
  managed: SiteString[];
  unmanaged: SiteString[];
}

export function siteCopyCoverage(
  copy: readonly CopyItem[],
  uiCopy: readonly UiCopyItem[],
  strings: readonly SiteString[] = siteStrings(),
): SiteCopyCoverage {
  const registered = new Set([...copy, ...uiCopy].map((c) => c.text));
  return {
    managed: strings.filter((s) => registered.has(s.text)),
    unmanaged: strings.filter((s) => !registered.has(s.text)),
  };
}

/** How many paths to name before the message becomes a wall rather than a list. */
const SHOWN = 12;

export function siteCopyGate(
  copy: readonly CopyItem[],
  uiCopy: readonly UiCopyItem[],
  strings: readonly SiteString[] = siteStrings(),
): Finding[] {
  const { managed, unmanaged } = siteCopyCoverage(copy, uiCopy, strings);
  if (unmanaged.length === 0) return [];

  // One finding, not one per string. This is a migration backlog with a size,
  // and a hundred separate warnings on every build is how a build log becomes
  // something nobody reads.
  const shown = unmanaged.slice(0, SHOWN).map((s) => `      site.${s.path}`);
  const rest = unmanaged.length - shown.length;

  return [
    {
      level: 'WARN',
      code: 'W-SITE-UNMANAGED',
      message:
        `site.json の出荷文字列 ${unmanaged.length} 件が copy registry に無い` +
        `（managed ${managed.length} / 全 ${managed.length + unmanaged.length}）。\n` +
        `${shown.join('\n')}${rest > 0 ? `\n      …他 ${rest} 件` : ''}\n` +
        `    report only — Phase 3 の Copy Migration で登録する。`,
    },
  ];
}
