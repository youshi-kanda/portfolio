import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const welcome = readFileSync(new URL('../src/components/motion/WelcomeIntro.astro', import.meta.url), 'utf8');
const brand = readFileSync(new URL('../src/assets/brand/yk-mark.svg', import.meta.url), 'utf8');
const favicon = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8');
const ogCard = readFileSync(new URL('../scripts/assets/og-card.svg', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/styles/welcome.css', import.meta.url), 'utf8');

const attribute = (source: string, name: string) => new RegExp(`${name}="([^"]+)"`).exec(source)?.[1];
const paths = (source: string) => [...source.matchAll(/<path\b([^>]*)\/>/g)].map((match) => ({
  fill: attribute(match[1]!, 'fill'),
  d: attribute(match[1]!, 'd'),
}));

describe('YK brand mark', () => {
  it('keeps a font-free, flat-color SVG as the geometry source of truth', () => {
    assert.match(brand, /<svg\b[^>]*viewBox="0 0 32 32"/);
    assert.deepEqual(paths(brand).map(({ fill }) => fill), ['#14654A', '#15171A']);
    assert.doesNotMatch(brand, /<(?:image|text|filter|linearGradient|radialGradient)\b|font-/i);
  });

  it('renders the canonical SVG directly in Welcome', () => {
    assert.match(welcome, /import ykMarkSvg from '\.\.\/\.\.\/assets\/brand\/yk-mark\.svg\?raw'/);
    assert.match(welcome, /class="wi-mark"[^>]*set:html=\{ykMarkSvg\}/);
  });

  it('uses the canonical geometry and colors in favicon and OG card', () => {
    assert.deepEqual(paths(favicon), paths(brand));
    assert.deepEqual(paths(ogCard), paths(brand));
  });

  it('does not retain the old positioned line-segment implementation', () => {
    assert.doesNotMatch(welcome, /wi-[yk]-[abc]/);
    assert.doesNotMatch(css, /\.wi-mark\s+i|\.wi-[yk]-[abc]/);
  });
});
