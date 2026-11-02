// TRENCHING SIMULATOR cover encoder. Browser rendering is deliberately separate.
//
// Reproducible capture:
// 1. Start the project's normal Vite dev server (npm run dev).
// 2. Through CUA, open /tools/games/trench-art/keyart.html at 760 x 511 and
//    /tools/cards/trenchingsimulator-card.html at 1200 x 630 on that localhost server.
// 3. Inspect both renders. Fonts and the local mark/chart must be fully painted.
//    Save the SAME screenshot bytes you inspected as keyart-render.png and social-render.png.
//    CUA providers may return PNG or JPEG bytes; the encoder checks the file content, not the suffix.
// 4. Encode: node tools/games/trench-art.mjs --keyart output/trench-cover-review/keyart-render.png --card output/trench-cover-review/social-render.png
// 5. Run the two Trenching Simulator cover tests in tests/page.test.js, then inspect /games on desktop and phone.
//
// The source pages use Vite's /fonts and /games public paths; do not open them as file:// pages.
// This tool never opens a browser, sends requests, or invokes Playwright. The old --keep workflow is retired.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const KEYART_SIZE = [760, 511];
export const CARD_SIZE = [1200, 630];
export const CARD_MAX = 154_000;
export const OUT = {
  keyart: resolve(ROOT, 'src/games/trenchingsimulator/keyart.webp'),
  card: resolve(ROOT, 'public/cards/trenchingsimulator.jpg'),
};
export const PAGES = {
  keyart: '/tools/games/trench-art/keyart.html',
  card: '/tools/cards/trenchingsimulator-card.html',
};

async function capture(path, [width, height], region) {
  const bytes = await readFile(resolve(path));
  const metadata = await sharp(bytes).metadata();
  if (!['png', 'jpeg'].includes(metadata.format) || metadata.width !== width || metadata.height !== height) {
    throw new Error(`${path}: expected an inspected ${width}x${height} PNG or JPEG screenshot`);
  }
  const { data, info } = await sharp(bytes).extract(region).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let white = 0, lime = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    const red = data[i], green = data[i + 1], blue = data[i + 2];
    if (red > 200 && green > 200 && blue > 180) white++;
    if (red > 160 && green > 210 && blue < 150) lime++;
  }
  if (white < 2000 || lime < 2000) throw new Error(`${path}: title appears unpainted (${white} white, ${lime} lime pixels). Inspect and recapture after the font has rendered.`);
  return bytes;
}

export async function encodeCovers(keyartPath, cardPath) {
  // Validate both inputs before replacing either published asset.
  const [key, card] = await Promise.all([
    capture(keyartPath, KEYART_SIZE, { left: 38, top: 140, width: 400, height: 145 }),
    capture(cardPath, CARD_SIZE, { left: 58, top: 200, width: 500, height: 190 }),
  ]);
  const webp = await sharp(key).flatten({ background: '#0d0f0c' }).webp({ quality: 94, effort: 6 }).toBuffer();
  let jpg, quality;
  for (quality = 96; quality >= 65; quality--) {
    jpg = await sharp(card).flatten({ background: '#0d0f0c' }).jpeg({ quality, mozjpeg: true, chromaSubsampling: '4:4:4' }).toBuffer();
    if (jpg.length < CARD_MAX) break;
  }
  if (jpg.length >= CARD_MAX || webp.length >= 200_000) throw new Error('Cover encoding exceeded its asset-size budget.');
  await writeFile(OUT.keyart, webp);
  await writeFile(OUT.card, jpg);
  return { keyart: { size: KEYART_SIZE, bytes: webp.length }, card: { size: CARD_SIZE, bytes: jpg.length, quality } };
}

async function main(args) {
  if (!args.length || args.includes('--help')) {
    console.log('Capture the two cover HTML pages through CUA, then run:');
    console.log('node tools/games/trench-art.mjs --keyart <760x511.png> --card <1200x630.png>');
    console.log('See the capture instructions at the top of this file.');
    return;
  }
  const flags = new Map();
  for (let i = 0; i < args.length; i += 2) {
    if (!['--keyart', '--card'].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error('Use --keyart <capture> --card <capture>. Automatic browser capture and --keep are retired.');
    flags.set(args[i], args[i + 1]);
  }
  if (!flags.has('--keyart') || !flags.has('--card')) throw new Error('Both inspected PNG or JPEG captures are required.');
  console.log(JSON.stringify(await encodeCovers(flags.get('--keyart'), flags.get('--card')), null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
