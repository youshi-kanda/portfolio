import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const DIST = new URL('../dist/', import.meta.url).pathname;
const CONFIG = readFileSync(new URL('../astro.config.mjs', import.meta.url), 'utf8');
const ORIGIN = /\bsite:\s*'([^']+)'/.exec(CONFIG)?.[1]?.replace(/\/$/, '');

if (!ORIGIN) {
  console.error('SOCIAL_METADATA FAIL: astro.config.mjs から site を読めない');
  process.exit(1);
}

const failures: string[] = [];
const fail = (message: string) => failures.push(message);

const walkHtml = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walkHtml(full) : full.endsWith('.html') ? [full] : [];
  });

const route = (file: string): string =>
  `/${relative(DIST, file)}`.replace(/index\.html$/, '').replace(/\/\/+/g, '/');

const attr = (html: string, tag: 'meta' | 'link', key: string, value: string, wanted: string): string | null => {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const keyEscaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const wantedEscaped = wanted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tagRe = new RegExp(`<${tag}[^>]*${keyEscaped}="${escaped}"[^>]*${wantedEscaped}="([^"]*)"`, 'i');
  const reverseRe = new RegExp(`<${tag}[^>]*${wantedEscaped}="([^"]*)"[^>]*${keyEscaped}="${escaped}"`, 'i');
  return tagRe.exec(html)?.[1] ?? reverseRe.exec(html)?.[1] ?? null;
};

const pngDimensions = (file: string): [number, number] | null => {
  if (!existsSync(file)) return null;
  const buf = readFileSync(file);
  if (buf.length < 24 || buf.toString('hex', 0, 8) !== '89504e470d0a1a0a') return null;
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
};

const ogFile = join(DIST, 'og-card.png');
const appleFile = join(DIST, 'apple-touch-icon.png');
const ogDims = pngDimensions(ogFile);
const appleDims = pngDimensions(appleFile);

if (!ogDims) fail('og-card.png が無い、または PNG ではない');
else if (ogDims[0] !== 1200 || ogDims[1] !== 630) fail(`og-card.png が ${ogDims[0]}x${ogDims[1]} — 期待は 1200x630`);

if (!appleDims) fail('apple-touch-icon.png が無い、または PNG ではない');
else if (appleDims[0] !== 180 || appleDims[1] !== 180) fail(`apple-touch-icon.png が ${appleDims[0]}x${appleDims[1]} — 期待は 180x180`);

const expectedImage = `${ORIGIN}/og-card.png`;
for (const file of walkHtml(DIST)) {
  const here = route(file);
  const html = readFileSync(file, 'utf8');

  const apple = attr(html, 'link', 'rel', 'apple-touch-icon', 'href');
  if (apple !== '/apple-touch-icon.png') fail(`${here}: apple-touch-icon が ${apple ?? '無い'}`);

  if (here === '/404.html') continue;

  const ogImage = attr(html, 'meta', 'property', 'og:image', 'content');
  if (ogImage !== expectedImage) fail(`${here}: og:image が ${ogImage ?? '無い'} — 期待は ${expectedImage}`);

  const ogWidth = attr(html, 'meta', 'property', 'og:image:width', 'content');
  const ogHeight = attr(html, 'meta', 'property', 'og:image:height', 'content');
  const ogType = attr(html, 'meta', 'property', 'og:image:type', 'content');
  const ogAlt = attr(html, 'meta', 'property', 'og:image:alt', 'content');
  if (ogWidth !== '1200') fail(`${here}: og:image:width が ${ogWidth ?? '無い'}`);
  if (ogHeight !== '630') fail(`${here}: og:image:height が ${ogHeight ?? '無い'}`);
  if (ogType !== 'image/png') fail(`${here}: og:image:type が ${ogType ?? '無い'}`);
  if (!ogAlt?.trim()) fail(`${here}: og:image:alt が無い、または空`);

  const twitterCard = attr(html, 'meta', 'name', 'twitter:card', 'content');
  const twitterImage = attr(html, 'meta', 'name', 'twitter:image', 'content');
  const twitterTitle = attr(html, 'meta', 'name', 'twitter:title', 'content');
  const twitterDescription = attr(html, 'meta', 'name', 'twitter:description', 'content');
  const twitterAlt = attr(html, 'meta', 'name', 'twitter:image:alt', 'content');

  if (twitterCard !== 'summary_large_image') fail(`${here}: twitter:card が ${twitterCard ?? '無い'}`);
  if (twitterImage !== expectedImage) fail(`${here}: twitter:image が ${twitterImage ?? '無い'} — 期待は ${expectedImage}`);
  if (!twitterTitle?.trim()) fail(`${here}: twitter:title が無い、または空`);
  if (!twitterDescription?.trim()) fail(`${here}: twitter:description が無い、または空`);
  if (!twitterAlt?.trim()) fail(`${here}: twitter:image:alt が無い、または空`);
}

if (failures.length > 0) {
  for (const message of failures) console.error(`SOCIAL_METADATA FAIL: ${message}`);
  process.exit(1);
}

console.log('SOCIAL_METADATA PASS');
console.log('SOCIAL_ASSETS PASS: og-card.png 1200x630 / apple-touch-icon.png 180x180');
