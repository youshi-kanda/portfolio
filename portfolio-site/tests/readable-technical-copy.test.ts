import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { APPROVED_TEXT } from '../src/lib/content/approved-text.ts';
import { loadCopy, loadUiCopy } from '../src/lib/content/load.ts';
import { site } from '../src/lib/content/site.ts';
import { ui } from '../src/lib/content/ui.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = (path: string) => readFileSync(`${root}${path}`, 'utf8');
const APPROVED_AT = '2026-09-26T15:25:44Z';

describe('HOW I BUILD reader copy', () => {
  it('states the process and the human decision boundary in reader-facing Japanese', () => {
    assert.deepEqual([...site.howIBuild.railLabels], [
      'HOW I BUILD',
      'AIを活用した開発プロセス',
    ]);
    assert.equal(site.howIBuild.title, 'AIを活用した開発の進め方');
    assert.equal(
      site.howIBuild.lede,
      'AIを設計・実装の支援に使い、要件整理・重要な判断・最終確認は自分で行います。',
    );
    assert.equal(site.howIBuild.workflow.at(-1)?.tag, '人が判断');
    assert.deepEqual(
      site.howIBuild.roles.map(({ role, duty }) => [role, duty]),
      [
        ['Human', '要件整理 / 内容理解 / 採否判断'],
        ['ChatGPT', '計画 / レビュー / 論点整理'],
        ['Claude Code', '実装 / テスト'],
      ],
    );
    assert.deepEqual([...site.howIBuild.intent], [
      'AIに実装を任せる場合も、内容を理解したうえで採否を判断します。',
      '理解が浅い技術や重要な設計判断では、人が確認する範囲を広げます。',
      '定型作業は自動化し、判断が必要な箇所に確認を集中します。',
    ]);
  });

  it('registers every rewritten method string under the current approval', () => {
    const registered = new Map(loadCopy().map((row) => [row.id, row]));
    const ids = [
      'method.rail.subtitle',
      'method.title',
      'method.lede',
      'method.workflow.decisionTag',
      'method.roles.human',
      'method.roles.chatgpt',
      'method.roles.claudeCode',
      'method.intent.01',
      'method.intent.02',
      'method.intent.03',
      'method.premise.01',
      'method.premise.02',
    ];

    for (const id of ids) {
      const row = registered.get(id);
      assert.ok(row, `${id} is missing from shipping copy`);
      assert.equal(row.text, APPROVED_TEXT[id]);
      assert.equal(row.publication.approvedBy, 'user');
      assert.equal(row.publication.approvedAt, APPROVED_AT);
    }
  });
});

describe('Technical page reader copy', () => {
  const headings = {
    about: 'このページについて',
    architecture: '全体構成',
    why: 'この構成を選んだ理由',
    failureModes: '起こりうる問題',
    tradeOffs: 'この設計で残る制約',
    tests: '確認方法とテスト',
    security: '権限・安全性・データの扱い',
    limitations: 'できること・含めていないこと',
    scale: '規模の目安',
    links: 'コードと設計資料',
  } as const;

  it('names the contents, sections and Case Study CTA by what readers will find', () => {
    assert.equal(ui.technical.railLabels[0], 'TECHNICAL');
    assert.equal(ui.technical.sectionsLabel, 'このページの内容');
    assert.deepEqual(ui.technical.sections, headings);
    assert.equal(ui.caseStudy.technicalCta, '設計・実装の詳細を見る');
  });

  it('keeps rewritten UI strings in the registry with the current approval', () => {
    const rows = new Map(loadUiCopy().map((row) => [row.path, row]));
    const expected = new Map<string, string>([
      ['caseStudy.technicalCta', '設計・実装の詳細を見る'],
      ['technical.sectionsLabel', 'このページの内容'],
      ...Object.entries(headings)
        .filter(([key]) => key !== 'about')
        .map(([key, text]) => [`technical.sections.${key}`, text] as [string, string]),
    ]);

    for (const [path, text] of expected) {
      const row = rows.get(path);
      assert.ok(row, `${path} is missing from UI copy`);
      assert.equal(row.text, text);
      assert.equal(row.publication.approvedBy, 'user');
      assert.equal(row.publication.approvedAt, APPROVED_AT);
    }
  });

  it('renders registry values instead of duplicating the visible copy in components', () => {
    const technicalPage = source('src/pages/work/[slug]/technical.astro');
    const casePage = source('src/pages/work/[slug]/index.astro');
    assert.match(technicalPage, /const S = ui\.technical\.sections/);
    assert.match(technicalPage, /ui\.technical\.sectionsLabel/);
    assert.match(casePage, /ui\.caseStudy\.technicalCta/);

    for (const text of ['このページの内容', ...Object.values(headings)]) {
      assert.equal(technicalPage.includes(text), false, `${text} is hard-coded in Technical page`);
    }
    assert.equal(casePage.includes('設計・実装の詳細を見る'), false);
  });
});
