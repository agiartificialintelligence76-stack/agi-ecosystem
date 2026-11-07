// HEARTBEAT (2026-11-08): its link preview, public/cards/games/heartbeat.jpg (1200 × 630). The game's own demo, drawn
// by the game in a browser (the dev server: `npm run dev`), then its wordmark on top (card.py, Pillow).
//   node tools/games/heartbeat/card.mjs [http://127.0.0.1:5173]
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');     // like tools/games/capture-previews.mjs
const base = process.argv[2] || 'http://127.0.0.1:5173';
const here = dirname(fileURLToPath(import.meta.url));
const shot = join(mkdtempSync(join(tmpdir(), 'hb-card-')), 'demo.png');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
// `card` (the dev server only): the demo without its score, for a clean picture
await page.goto(`${base}/games/heartbeat?demo&seed=7&card`, { waitUntil: 'load' });
await page.waitForTimeout(7500);
await page.screenshot({ path: shot });
await browser.close();
execFileSync('python3', [join(here, 'card.py'), shot], { stdio: 'inherit' });
