import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { APPROVED_TEXT } from '../src/lib/content/approved-text.ts';
import { ui } from '../src/lib/content/ui.ts';

const source = (path: string) =>
  readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');

describe('Home / Work reader copy', () => {
  it('keeps reader-facing copy in the registries', () => {
    assert.equal(ui.register.pageTitle, '開発実績');
    assert.equal(ui.register.homeAllWorksCta, '開発実績をすべて見る');
    assert.equal(ui.work.role, '担当範囲');
    assert.equal(ui.work.selectedTech, '使用技術');
    assert.equal(APPROVED_TEXT['home.works.h2'], '何を作り、どこまで実装したのか。');
    assert.equal(APPROVED_TEXT['home.hero.cta.primary'], '主な開発実績を見る');
    assert.equal(APPROVED_TEXT['home.hero.cta.secondary'], '開発について相談する');
  });

  it('shows work.role only in the archive variant', () => {
    const register = source('components/work/Register.astro');
    const archive = source('pages/work/index.astro');
    const more = source('components/home/MoreProjects.astro');

    assert.match(register, /showRole\s*=\s*false/);
    assert.match(register, /showRole\s*&&\s*w\.role\.length/);
    assert.match(archive, /<Register[^>]*showRole/);
    assert.doesNotMatch(more, /<Register[^>]*showRole/);
  });

  it('keeps featuredTier structure without rendering the former badge', () => {
    const featured = source('components/home/FeaturedWork.astro');
    assert.match(featured, /data-featured-tier=\{tier\}/);
    assert.doesNotMatch(featured, /featuredPrimary|fw-tier/);
  });
});
