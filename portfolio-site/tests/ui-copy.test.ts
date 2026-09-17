/**
 * The UI chrome coverage gate.
 *
 * The property under test is the one content-model §4 says was missing: that a
 * string cannot reach a page without a review record. So the tests here are
 * mostly about the ways a string could slip past — a new one added to `ui.ts`,
 * a registered one reworded, a record left behind after its string is gone.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadUiCopy } from '../src/lib/content/load.ts';
import { uiStrings } from '../src/lib/content/ui.ts';
import { uiCopyGate } from '../src/lib/validation/ui-copy.ts';
import { errors } from '../src/lib/validation/finding.ts';
import { codes, clone } from './helpers.ts';

const rows = () => loadUiCopy();
const always = () => true;

describe('UI copy gate', () => {
  it('passes the shipping UI chrome as it stands', () => {
    assert.deepEqual(uiCopyGate(rows()), []);
  });

  it('registers every shipping string — UNMANAGED_SHIPPING_COPY = 0', () => {
    const registered = new Set(rows().map((r) => r.path));
    const unmanaged = uiStrings().filter((s) => !registered.has(s.path));
    assert.deepEqual(unmanaged.map((s) => s.path), []);
  });

  it('fails a string added to ui.ts with no registry row', () => {
    const found = uiCopyGate(rows(), {
      strings: [...uiStrings(), { path: 'work.newLabel', text: '新しいラベル' }],
      exists: always,
    });
    assert.deepEqual(codes(errors(found)), ['U-UNMANAGED']);
    assert.match(found[0]!.message, /work\.newLabel/);
  });

  it('names the offending text so the fix does not need a diff', () => {
    const found = uiCopyGate(rows(), {
      strings: [{ path: 'work.newLabel', text: '新しいラベル' }],
      exists: always,
    });
    assert.match(found[0]!.message, /新しいラベル/);
  });

  it('fails a registered string that has been reworded', () => {
    const strings = clone(uiStrings());
    const target = strings.find((s) => s.path === 'evidence.proves');
    target!.text = 'この画面で確認できること！';
    const found = uiCopyGate(rows(), { strings, exists: always });
    assert.deepEqual(codes(errors(found)), ['U-DRIFT']);
  });

  it('prints both sides of a drift', () => {
    const strings = clone(uiStrings());
    strings.find((s) => s.path === 'evidence.notProves')!.text = '対象外';
    const [finding] = uiCopyGate(rows(), { strings, exists: always });
    assert.ok(finding);
    assert.match(finding.message, /Evidence の対象外/); // registry side
    assert.match(finding.message, /対象外/); // live side
  });

  it('fails a registry row whose string no longer exists', () => {
    const strings = uiStrings().filter((s) => s.path !== 'nav.breadcrumbLabel');
    const found = uiCopyGate(rows(), { strings, exists: always });
    assert.deepEqual(codes(errors(found)), ['U-ORPHAN']);
  });

  /*
   * The two navigation labels answer different questions and neither is the
   * other's replacement: `mobileIndex` is on the button that opens the section
   * list — where the reader can GO — and `breadcrumbLabel` is the name a screen
   * reader gives the trail — where the reader IS. They arrived from two
   * branches that each solved the same dead `<span>Index</span>` a different
   * way, and merging those branches is exactly where one of them silently
   * disappears. This asserts the shape that merge has to preserve.
   */
  it('ships the mobile index label and the breadcrumb label, both registered', () => {
    const strings = new Map(uiStrings().map((s) => [s.path, s.text]));
    assert.equal(strings.get('nav.mobileIndex'), 'Index');
    assert.equal(strings.get('nav.breadcrumbLabel'), 'パンくずリスト');

    const registered = new Set(rows().map((r) => r.path));
    assert.ok(registered.has('nav.mobileIndex'), 'nav.mobileIndex の登録行が無い');
    assert.ok(registered.has('nav.breadcrumbLabel'), 'nav.breadcrumbLabel の登録行が無い');
  });

  it('fails when an ADAPTED string points at a path that is not there', () => {
    const found = uiCopyGate(rows(), { exists: () => false });
    assert.ok(found.length > 0);
    assert.deepEqual(new Set(codes(found)), new Set(['U-REFTARGET']));
  });

  it('checks the ADAPTED reference target against the real repository', () => {
    // no `exists` override — this is the live filesystem check
    assert.deepEqual(uiCopyGate(rows()), []);
  });

  it('does not treat data keys as shipping copy', () => {
    const paths = uiStrings().map((s) => s.path);
    assert.ok(paths.includes('work.fieldLabels.1.label'));
    assert.ok(!paths.some((p) => p.endsWith('.key')));
  });

  it('carries a source locator on every row', () => {
    for (const row of rows()) {
      assert.ok(
        row.publication.sourceRefs.length > 0,
        `${row.id} に sourceRefs が無い`,
      );
      assert.notEqual(row.publication.sourceRefs[0], 'UNRESOLVED', `${row.id}`);
    }
  });

  it('records the classification content-model §4 asks for', () => {
    const kinds = new Set(rows().map((r) => r.kind));
    for (const k of kinds) {
      assert.ok(['ui-system', 'editorial', 'source-derived', 'user-fact'].includes(k));
    }
  });

  it('creates no user-fact row — an empty fact cannot be approved', () => {
    // content-model §5: a Profile item is not created until the fact exists.
    assert.deepEqual(rows().filter((r) => r.kind === 'user-fact'), []);
  });
});
