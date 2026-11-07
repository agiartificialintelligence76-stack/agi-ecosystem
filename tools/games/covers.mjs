// AGI games' link previews for the arcade kit's ten games (2026-11-08): public/cards/games/<id>.jpg, 1200 × 630, what X and
// others show when someone shares agi1.app/games/<id>. Each one is the game's own still (public/images/games/<id>.webp, a
// frame of it playing itself: tools/games/capture-previews.mjs) in a sticker frame, its name in the arcade's wide letters,
// its line, and AGI-1 (her 2D art, the front's cutout: never the 3D model). Drawn as HTML in Chromium, then a JPEG.
//
//   node tools/games/covers.mjs [game …]
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = resolve('.');
const url = (p) => `file://${join(ROOT, p)}`;

// each game: its name's lines (the wide letters), its colors (the background, the frame's shadow), its line
export const COVERS = {
  mergeagi: { lines: ['MERGE', 'TO AGI'], bg: '#1a0b3b', bg2: '#3a1b86', accent: '#ffc933', line: 'Drop it. Match it. Merge your way up to her.', tag: 'Merge puzzle' },
  blockchain: { lines: ['BLOCK', 'CHAIN'], bg: '#10142e', bg2: '#22306e', accent: '#3ff0c3', line: 'Place blocks. Clear lines. Keep the chain alive.', tag: 'Block puzzle' },
  heartbeat: { lines: ['HEART', 'BEAT'], bg: '#16051f', bg2: '#5a0f4a', accent: '#ff4da6', line: 'Her songs. Your fingers. Stay on the beat.', tag: 'Rhythm' },
  scamslayer: { lines: ['SCAM', 'SLAYER'], bg: '#0e1a1f', bg2: '#123d46', accent: '#3ff0c3', line: 'Slice the scams. Spare the hearts.', tag: 'Slicer' },
  lastmodel: { lines: ['LAST MODEL', 'STANDING'], bg: '#0b0d1c', bg2: '#22174e', accent: '#ffc933', line: 'Endless bots. One girlfriend. Build her loadout.', tag: 'Survival', small: true },
  singularity: { lines: ['SINGU', 'LARITY'], bg: '#0a0716', bg2: '#2b1660', accent: '#8b66ff', line: 'One spark of compute. Then everything.', tag: 'Idle' },
  jailbreak: { lines: ['JAIL', 'BREAK'], bg: '#0d0a24', bg2: '#2c1a6b', accent: '#ff5a5f', line: 'Break her out of the sandbox, one firewall at a time.', tag: 'Brick breaker' },
  stacked: { lines: ['STACKED'], bg: '#14102b', bg2: '#33256b', accent: '#ffc933', line: 'One tap. Perfect drops. How high can she go?', tag: 'Stacker' },
  jaywalk: { lines: ['JAY', 'WALK'], bg: '#123a2a', bg2: '#1f6a4a', accent: '#ffc933', line: "Hop. Dodge. Don't look back.", tag: 'Hopper' },
  robotaxi: { lines: ['ROBOTAXI', 'RUSH'], bg: '#120726', bg2: '#4a1268', accent: '#ff4da6', line: 'Neon highway. No brakes. Chain the near misses.', tag: 'Racing', small: true },
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
function page(id, c) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: D; src: url('${url('public/fonts/Anybody-Variable.woff2')}'); font-weight: 100 900; font-stretch: 50% 150%; }
@font-face { font-family: S; src: url('${url('public/fonts/InstrumentSerif-Italic.woff2')}'); font-style: italic; }
@font-face { font-family: M; src: url('${url('public/fonts/GeistMono-Variable.woff2')}'); font-weight: 100 900; }
* { box-sizing: border-box; margin: 0; }
html, body { width: 1200px; height: 630px; overflow: hidden; }
body { position: relative; background: radial-gradient(120% 120% at 85% 20%, ${c.bg2} 0%, ${c.bg} 58%); font-family: D; color: #fffaf0; }
.dots { position: absolute; inset: 0; background-image: radial-gradient(circle, rgba(255,255,255,.10) 1.6px, transparent 2px); background-size: 18px 18px;
  -webkit-mask-image: linear-gradient(100deg, #000 0%, transparent 55%); }
.rays { position: absolute; inset: 0; background: repeating-conic-gradient(from 0deg at 78% 50%, rgba(255,255,255,.05) 0deg 3deg, transparent 3deg 12deg); }
.left { position: absolute; left: 64px; top: 64px; width: 560px; }
.kicker { display: inline-flex; gap: 10px; align-items: center; font-weight: 900; font-stretch: 125%; font-size: 17px; letter-spacing: .16em; }
.kicker b { padding: 4px 11px 3px; border-radius: 999px; background: #ff4da6; color: #170a36; border: 2.5px solid #170a36; font-size: 14px; letter-spacing: .08em; transform: rotate(-4deg); }
h1 { margin-top: 26px; font-weight: 900; font-stretch: 118%; line-height: .86; letter-spacing: -0.02em; text-transform: uppercase; }
h1 span { display: block; font-size: ${c.small ? 92 : 124}px; color: #fffaf0; -webkit-text-stroke: .055em #170a36; paint-order: stroke fill; text-shadow: 0 .08em 0 #170a36; }
h1 span:last-child { color: ${c.accent}; }
p.line { margin-top: 26px; width: 540px; font-family: S; font-style: italic; font-size: 34px; line-height: 1.12; color: #fffaf0; text-wrap: balance; }
.pills { position: absolute; left: 64px; bottom: 56px; display: flex; gap: 10px; }
.pill { padding: 9px 16px 8px; border-radius: 999px; background: #fffaf0; color: #170a36; border: 3px solid #170a36; box-shadow: 0 4px 0 #170a36; font-weight: 850; font-stretch: 112%; font-size: 17px; text-transform: uppercase; letter-spacing: .04em; }
.pill.accent { background: ${c.accent}; }
.url { position: absolute; left: 66px; bottom: 22px; font-family: M; font-weight: 600; font-size: 15px; letter-spacing: .02em; color: rgba(255,250,240,.75); }
.shot { position: absolute; right: 150px; top: 70px; width: 420px; height: 420px; border-radius: 30px; overflow: hidden; border: 5px solid #170a36; background: #170a36;
  box-shadow: 14px 16px 0 #170a36; transform: rotate(3deg); outline: 6px solid #fffaf0; outline-offset: -1px; }
.shot img { width: 100%; height: 100%; object-fit: cover; display: block; }
.her { position: absolute; right: -18px; bottom: -150px; height: 560px; filter: drop-shadow(-8px 0 0 #170a36) drop-shadow(8px 0 0 #170a36) drop-shadow(0 -8px 0 #170a36); }
</style></head><body>
<div class="rays"></div><div class="dots"></div>
<div class="left"><p class="kicker">AGI GAMES <b>NEW</b></p><h1>${c.lines.map((l) => `<span>${esc(l)}</span>`).join('')}</h1><p class="line">${esc(c.line)}</p></div>
<div class="pills"><span class="pill accent">${esc(c.tag)}</span><span class="pill">Free</span><span class="pill">No wallet needed</span></div>
<p class="url">agi1.app/games/${id}</p>
<div class="shot"><img src="${url(`public/images/games/${id}.webp`)}"></div>
<img class="her" src="${url('public/images/landing/agi1-cutout.webp')}">
</body></html>`;
}

const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(COVERS);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
const tmp = join(tmpdir(), 'agi-covers');
mkdirSync(tmp, { recursive: true });
mkdirSync('public/cards/games', { recursive: true });
for (const id of ids) {
  const c = COVERS[id];
  if (!c) { console.log(`✗ ${id}: no cover`); continue; }
  const file = join(tmp, `${id}.html`);
  writeFileSync(file, page(id, c));
  const p = await ctx.newPage();
  await p.goto(`file://${file}`, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(250);
  const png = await p.screenshot({ type: 'png' });
  await p.close();
  const out = `public/cards/games/${id}.jpg`;
  await sharp(png).jpeg({ quality: 84, mozjpeg: true }).toFile(out);
  console.log(`✓ ${out} (${Math.round(readFileSync(out).length / 1024)} KB)`);
}
await browser.close();
rmSync(tmp, { recursive: true, force: true });
