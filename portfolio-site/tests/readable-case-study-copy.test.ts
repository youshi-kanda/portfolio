import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { caseSections } from '../src/lib/content/derive.ts';
import { loadCaseStudies, loadUiCopy, loadWorks } from '../src/lib/content/load.ts';
import { ui } from '../src/lib/content/ui.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = (path: string) => readFileSync(`${root}${path}`, 'utf8');
const APPROVED_AT = '2026-09-26T15:51:06Z';

describe('Case Study reader copy', () => {
  const sectionHeadings = {
    problem: '解決したい業務上の課題',
    highlights: '実装で確認できること',
    quality: '確認・テスト方法',
  } as const;
  const scopeHeaders = ['実装済み', '含めていないもの', '理由'] as const;

  it('uses reader-facing section headings and Japanese scope headers', () => {
    for (const [key, text] of Object.entries(sectionHeadings)) {
      assert.equal(ui.caseStudy.sections[key as keyof typeof sectionHeadings], text);
    }
    assert.deepEqual([...ui.caseStudy.scopeHeaders], [...scopeHeaders]);
    assert.equal(ui.caseStudy.railLabels[0], 'CASE STUDY');
    assert.equal(ui.caseStudy.technicalCta, '設計・実装の詳細を見る');
  });

  it('keeps the rewritten strings in the UI registry under this approval', () => {
    const rows = new Map(loadUiCopy().map((row) => [row.path, row]));
    const expected = new Map<string, string>([
      ...Object.entries(sectionHeadings).map(
        ([key, text]) => [`caseStudy.sections.${key}`, text] as [string, string],
      ),
      ...scopeHeaders.map(
        (text, index) => [`caseStudy.scopeHeaders.${index + 1}`, text] as [string, string],
      ),
    ]);

    for (const [path, text] of expected) {
      const row = rows.get(path);
      assert.ok(row, `${path} is missing from UI copy`);
      assert.equal(row.text, text);
      assert.equal(row.publication.sourceType, 'authored');
      assert.equal(row.publication.claimType, 'presentation');
      assert.equal(row.publication.approvedBy, 'user');
      assert.equal(row.publication.approvedAt, APPROVED_AT);
    }
  });

  it('feeds the same section titles to the table of contents and body', () => {
    const works = new Map(loadWorks().map((work) => [work.slug, work]));
    for (const caseStudy of loadCaseStudies()) {
      const work = works.get(caseStudy.slug);
      assert.ok(work);
      const titles = caseSections(work, caseStudy).map(({ title }) => title);
      for (const text of Object.values(sectionHeadings)) {
        assert.ok(titles.includes(text), `${caseStudy.slug} is missing ${text}`);
      }
    }

    const body = source('src/components/case/CaseBody.astro');
    const page = source('src/pages/work/[slug]/index.astro');
    assert.match(body, /const sections = caseSections\(work, c\)/);
    assert.match(page, /const sections = caseStudy \? caseSections\(work, caseStudy\) : \[\]/);
  });

  it('keeps scope column labels visible when the table stacks on mobile', () => {
    const body = source('src/components/case/CaseBody.astro');
    const polish = source('src/styles/polish.css');
    assert.match(body, /class="tw scope-table"/);
    for (const index of [0, 1, 2]) {
      assert.match(body, new RegExp(`data-label=\\{L\\.scopeHeaders\\[${index}\\]\\}`));
    }
    assert.match(polish, /\.scope-table tbody th::before/);
    assert.match(polish, /content: attr\(data-label\)/);
  });
});

describe('DFE confidence terminology', () => {
  it('uses 確信度 consistently in public DFE copy', () => {
    const publicSources = [
      'src/content/case-study/dfe.json',
      'src/content/work/dfe.json',
      'src/content/evidence/DFE-V01.json',
      'src/content/site.json',
    ];
    const publicCopy = publicSources.map(source).join('\n');
    assert.equal(publicCopy.includes('自信度'), false);
    assert.equal(publicCopy.includes('確信度'), true);
  });

  it('does not rename code identifiers, JSON keys or source paths', () => {
    const caseStudy = source('src/content/case-study/dfe.json');
    const work = source('src/content/work/dfe.json');
    assert.match(caseStudy, /confidence = 0/);
    assert.match(caseStudy, /src\/confidence\.js/);
    assert.match(work, /"confidence": "0\.98"/);
  });
});
