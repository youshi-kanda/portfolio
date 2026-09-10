/**
 * The Editorial Band's count rule.
 *
 * The band is a three-panel composition, so the featured count is a content
 * decision with only two acceptable answers — three, or none. What the gate
 * has to get right is which of the other answers fails and which reports.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { featuredWorks, leadWork } from '../src/lib/content/derive.ts';
import { loadWorks } from '../src/lib/content/load.ts';
import { BAND_PANELS, bandGate } from '../src/lib/validation/band.ts';
import { codes } from './helpers.ts';
import { nWorks } from './helpers.ts';

const featuredN = (n: number) => nWorks(n).map((w) => ({ ...w, featured: true }));

describe('editorial band', () => {
  it('says nothing at the composition it draws, and nothing at zero', () => {
    assert.deepEqual(bandGate(featuredN(BAND_PANELS)), []);
    assert.deepEqual(bandGate([]), []);
  });

  it('warns at one or two — the band is not drawn and the section is gone', () => {
    for (const n of [1, 2]) {
      const findings = bandGate(featuredN(n));
      assert.deepEqual(codes(findings), ['W-BAND-PARTIAL']);
      assert.equal(findings[0]?.level, 'WARN');
    }
  });

  it('fails past three rather than letting a renderer pick which three', () => {
    const findings = bandGate(featuredN(4));
    assert.deepEqual(codes(findings), ['B-BAND-COUNT']);
    assert.equal(findings[0]?.level, 'ERROR');
    assert.match(findings[0]!.message, /編集判断/);
  });

  it('draws from works that are both featured and shipping', () => {
    const works = loadWorks();
    // the three demos are both featured and shipping; nothing else is either.
    assert.deepEqual(
      featuredWorks(works).map((w) => w.slug),
      ['crm', 'ppm', 'dfe'],
    );

    const promoted = works.map((w) => (w.shipping ? w : { ...w, featured: true }));
    assert.equal(
      featuredWorks(promoted).some((w) => !w.shipping),
      false,
      'featured だけでは band に載らない — 出していない作品の panel は行き先が無い',
    );
  });

  it('leads with one entry or with none', () => {
    const works = loadWorks();
    const lead = leadWork(works);
    assert.equal(lead === null || lead.homepageRole === 'lead', true);
    assert.equal(leadWork(works.map(({ homepageRole: _drop, ...w }) => w as never)), null);
  });
});
