import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');
const ogSource = path.join(root, 'scripts', 'assets', 'og-card.svg');
const faviconSource = path.join(publicDir, 'favicon.svg');

await mkdir(publicDir, { recursive: true });

await Promise.all([
  sharp(ogSource, { density: 144 })
    .resize(1200, 630)
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(path.join(publicDir, 'og-card.png')),
  sharp(faviconSource, { density: 512 })
    .resize(180, 180)
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(path.join(publicDir, 'apple-touch-icon.png')),
]);

console.log('Generated social assets: og-card.png, apple-touch-icon.png');
