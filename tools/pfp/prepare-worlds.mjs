import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

// Usage: node tools/pfp/prepare-worlds.mjs <earth> <space> <fantasy> [future] [surreal]
// All sources are borderless, square atlases. Only crop/resize/encoding occurs here.
const groups = [
  ['london', 'new-york', 'santorini', 'rome', 'venice', 'alps', 'seoul', 'marrakech', 'amazon'],
  ['saturn', 'mars', 'asteroid', 'black-hole', 'alien-ocean', 'crimson-nebula', 'comet', 'star-desert', 'galactic-library'],
  ['ember', 'ice-palace', 'thunder', 'water-temple', 'mushroom', 'enchanted', 'clockwork', 'dream-train', 'atlantis'],
  ['solarpunk', 'orbital-elevator', 'robot-garden', 'cyber-circuit', 'future-station', 'neon-laundry', 'hologram', 'undersea-lab', 'retro-starship'],
  ['origami', 'glass', 'candy-sky', 'mirror'],
];
const destination = resolve('public/pfp/v1');
await mkdir(destination, { recursive: true });
let count = 0;
for (const [group, source] of process.argv.slice(2).entries()) {
  if (source === '-') continue;
  if (!groups[group]) throw new Error('Too many sources.');
  const names = groups[group], grid = names.length === 4 ? 2 : 3;
  const { width, height } = await sharp(source).metadata();
  if (width !== height) throw new Error(`Expected square atlas: ${source}`);
  for (const [index, name] of names.entries()) {
    const column = index % grid, row = Math.floor(index / grid);
    const left = Math.round(column * width / grid), top = Math.round(row * height / grid);
    const tileWidth = Math.round((column + 1) * width / grid) - left;
    const tileHeight = Math.round((row + 1) * height / grid) - top;
    await sharp(source).extract({ left, top, width: tileWidth, height: tileHeight })
      .resize(768, 768, { kernel: 'nearest' }).webp({ quality: 85 }).toFile(resolve(destination, `${name}.webp`));
    count++;
  }
}
console.log(`Prepared ${count} background files.`);
