import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const welcome = readFileSync(new URL('../src/components/motion/WelcomeIntro.astro', import.meta.url), 'utf8');
const favicon = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/styles/welcome.css', import.meta.url), 'utf8');

const pathData = (source: string) => [...source.matchAll(/<path\s+d="([^"]+)"/g)].map((match) => match[1]);

describe('welcome YK mark', () => {
  it('uses the favicon viewBox and exact monogram geometry', () => {
    assert.match(welcome, /<svg\s+viewBox="0 0 32 32"/);
    assert.deepEqual(pathData(welcome), pathData(favicon));
  });

  it('does not retain the old positioned line-segment implementation', () => {
    assert.doesNotMatch(welcome, /wi-[yk]-[abc]/);
    assert.doesNotMatch(css, /\.wi-mark\s+i|\.wi-[yk]-[abc]/);
  });
});
