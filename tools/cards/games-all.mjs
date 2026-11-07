// AGI games' link preview (public/cards/games-all.jpg, 1200 × 630, 2026-11-08): games-all-card.html with a wall of the
// games' stills, in the shelf's order (src/games/shelf.js), and their count. Run it after adding a game or recording its
// preview again (tools/games/capture-previews.mjs):
//   node tools/cards/games-all.mjs
// Needs Playwright's Chromium and sharp (both already in the project).
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { SHELF } from '../../src/games/shelf.js';
import { GAMES } from '../../src/games/list.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
// the wall: 12 tiles (3 rows of 4), the featured order; the games' names (a long one shortened)
const SHORT = { trenchingsimulator: 'TRENCHING SIM', lastmodel: 'LAST MODEL', vladrunner2049: 'VLAD RUNNER', gradient: 'GRADIENT', notarobot: 'NOT A ROBOT' };
const shown = SHELF.slice(0, 12).map((g) => `${g.id}:${(SHORT[g.id] || GAMES[g.id].name).replace(/[,:]/g, '')}`);
const page = new URL('games-all-card.html', import.meta.url);
page.search = `?games=${encodeURIComponent(shown.join(','))}&count=${SHELF.length}`;
const browser = await chromium.launch();
const tab = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await tab.goto(page.href, { waitUntil: 'load' });
await tab.evaluate(() => Promise.all([document.fonts.ready, ...[...document.images].map((i) => i.decode().catch(() => {}))]));
await tab.waitForTimeout(200);
const png = await tab.screenshot({ type: 'png' });
await browser.close();
const out = fileURLToPath(new URL('../../public/cards/games-all.jpg', import.meta.url));
await sharp(png).jpeg({ quality: 84, mozjpeg: true }).toFile(out);
console.log(`✓ public/cards/games-all.jpg (${Math.round(readFileSync(out).length / 1024)} KB, ${shown.length} games on its wall)`);
