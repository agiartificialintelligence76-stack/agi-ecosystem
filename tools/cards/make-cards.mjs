// Makes the link-preview pictures in public/cards/ (1200×630 PNG) with the site's own card drawing (src/share/card.js),
// so they always match "Save image", plus the home page's preview (home.jpg, from home-card.html).
// Not part of the site build. Run it again after changing the cards, the hero's words, or adding a coin:
//   1. npm run build, then serve dist/ (e.g. npx vite preview --port 4173)
//   2. cd tools/cards && npm install && node make-cards.mjs http://localhost:4173
//   3. shrink them to 256 colors (about 40 KB each instead of 200 KB; they look the same), e.g. with pngquant:
//      pngquant --force --ext .png 256 ../../public/cards/*.png
// Needs Playwright's Chromium (npx playwright install chromium) or CHROMIUM=/path/to/chromium.
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TOKENS } from '../../src/prices/parse.js';
import { LEVELS } from '../../src/lib/levels.js';

const base = process.argv[2] || 'http://localhost:4173';
const out = new URL('../../public/cards/', import.meta.url);
mkdirSync(out, { recursive: true });
const cards = {
  ...Object.fromEntries(TOKENS.map((t) => [`champion-${t.symbol.toLowerCase()}`, { kind: 'champion', coin: t.symbol }])),
  ...Object.fromEntries(LEVELS.map((l) => [`level-${l.name.toLowerCase()}`, { kind: 'level', level: l.level }])),
  diary: { kind: 'diary' },
};
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const page = await browser.newPage();
await page.route(/\/models\/|dexscreener|cloudflare/, (r) => r.abort());
await page.goto(`${base}/?dev`);
await page.waitForFunction(() => window.__agiCards);
for (const [name, card] of Object.entries(cards)) {
  const b64 = await page.evaluate(async (c) => {
    const blob = await window.__agiCards.cardBlob(c);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (const x of bytes) s += String.fromCharCode(x);
    return btoa(s);
  }, card);
  writeFileSync(new URL(`${name}.png`, out), Buffer.from(b64, 'base64'));
  console.log('made', `${name}.png`);
}
// the home page's preview: a small HTML page (same words as the hero), saved as a JPG (about 80 KB; the 3D render
// would make a PNG about 300 KB)
await page.setViewportSize({ width: 1200, height: 630 });
await page.goto(new URL('home-card.html', import.meta.url).href);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: fileURLToPath(new URL('home.jpg', out)), type: 'jpeg', quality: 86 });
console.log('made home.jpg');
await browser.close();
