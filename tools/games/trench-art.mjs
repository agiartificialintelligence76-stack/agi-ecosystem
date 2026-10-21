// TRENCHING SIMULATOR's two pictures (2026-10-21): its key art on agi1.app/games (src/games/trenchingsimulator/keyart.webp,
// 760 × 511 with see-through edges, the size of Ride 'Em, AGI!'s, so the shelf's cards match) and its link preview
// (public/cards/trenchingsimulator.jpg: 1200 × 630, a JPEG under 154,000 bytes, because the owner's folder adds a ~6 KB
// content-credentials label and the build fails over 160 KB).
//
// Both are made from real screenshots of the game's own terminal, Trench Board, taken here from the built game
// (tools/games/trench-art/board.webp on a computer, coin.webp on a phone): the same market every time (its clock, its date
// and its dice fixed, its time run forward by hand, a buy of the king of the hill on the way), the title, a "Play money"
// sticker, and AGI-1 only as her 2D art (public/images/landing/agi1-cutout.webp: never the 3D model or anything rendered
// from it). Its pages: tools/games/trench-art/keyart.html and tools/cards/trenchingsimulator-card.html (each a page made
// to be photographed: its words, its pictures and its look; open one in a browser to see it).
//
//   npx vite build && node tools/games/trench-art.mjs      screenshots again (from dist/), then both pictures
//   node tools/games/trench-art.mjs --keep                  both pictures again from the screenshots it has (after
//                                                           changing keyart.html or the card's page)
// then npm test. Needs Chromium (Claude's workspace has one; else CHROME_PATH), playwright-core (npm install --no-save
// playwright-core) and sharp (the site's own). Nothing is sent anywhere: the built game is served on this computer only,
// and every request it makes elsewhere is stopped.
import { createServer } from 'node:http';
import { existsSync, statSync, createReadStream, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join, extname, sep, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const HERE = join(ROOT, 'tools/games/trench-art');
const DIST = join(ROOT, 'dist');
export const OUT = {
  board: join(HERE, 'board.webp'), coin: join(HERE, 'coin.webp'),
  keyart: join(ROOT, 'src/games/trenchingsimulator/keyart.webp'), card: join(ROOT, 'public/cards/trenchingsimulator.jpg'),
};
export const PAGES = { keyart: join(HERE, 'keyart.html'), card: join(ROOT, 'tools/cards/trenchingsimulator-card.html') };
export const KEYART_SIZE = [760, 511];
export const CARD_SIZE = [1200, 630];
export const CARD_MAX = 154_000;

// ---------- the market, the same every time ----------
// A free play on Trench Board started at T0 + 2 minutes (UTC), its dice seeded; at 30 s the player opens the king of the
// hill's coin and puts 0.25 SOL of play money in it, then watches until 100 s. Its time only moves when this tool moves
// it, always by a multiple of 16 ms (the browser's frames: so the run starts at the same moment, and its market is the
// same, however fast this computer is)
const T0 = Date.parse('2026-10-21T15:00:00Z');
export const SCENE = { seed: 12, buyAt: 30, buy: '0.25', shotAt: 100 };
const DICE = `(() => {
  let s = 0;
  window.__trenchArtSeed = (v) => { s = v >>> 0; };
  Math.random = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
})();`;

// ---------- the built game, served on this computer only ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
export function serve(dir) {
  const server = createServer((req, res) => {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (/^\/games\/trenchingsimulator\/?$/.test(path)) path = '/trenchingsimulator.html';       // (vercel.json's rewrite)
    const file = resolve(dir, `.${path}`);
    if (req.method !== 'GET' || !file.startsWith(dir + sep) || !existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  return new Promise((ok) => { server.listen(0, '127.0.0.1', () => ok({ server, url: `http://127.0.0.1:${server.address().port}` })); });
}

const BROWSERS = ['/opt/pw-browsers/chromium', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
export async function openBrowser() {
  let chromium;
  try { ({ chromium } = await import('playwright-core')); } catch { throw new Error('playwright-core is missing: npm install --no-save playwright-core'); }
  let own = null;
  try { own = chromium.executablePath(); } catch { /* not downloaded */ }
  const paths = [...new Set([process.env.CHROME_PATH, own, ...BROWSERS])].filter((p) => p && existsSync(p));
  if (!paths.length) throw new Error('no Chrome or Chromium found (set CHROME_PATH)');
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/KEY|SECRET|TOKEN|PASS/i.test(k)));
  return chromium.launch({ executablePath: paths[0], env });
}

// One screenshot of the game: `phone` 390 × 844 at twice its pixels (the coin's page), else a computer's 1440 × 900 (the
// board). "Reduce motion" on: nothing caught halfway through moving.
export async function shoot(browser, base, { phone }) {
  const ctx = await browser.newContext(phone
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce', timezoneId: 'UTC', locale: 'en-US' }
    : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce', timezoneId: 'UTC', locale: 'en-US' });
  // only our own page: SOL's live price stays away (its stand-in, $150), and the run it counts goes nowhere
  await ctx.route((u) => !u.href.startsWith(base) || u.pathname.startsWith('/api/'), (r) => (r.request().url().includes('/api/') ? r.fulfill({ status: 204, body: '' }) : r.abort()));
  await ctx.addInitScript(DICE);
  const p = await ctx.newPage();
  await p.clock.install({ time: T0 });
  await p.clock.pauseAt(T0 + 1024);
  await p.goto(`${base}/games/trenchingsimulator`, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  const step = (ms) => p.clock.runFor(ms);
  const until = async (fn, what) => {
    for (let i = 0; i < 400; i++) { if (await p.evaluate(fn)) return; await step(48); }
    throw new Error(`the game never showed ${what}`);
  };
  const press = async (loc) => (phone ? loc.first().tap() : loc.first().click());
  const button = (name) => p.getByRole('button', { name, exact: true });
  await until(() => !document.getElementById('agi-intro'), 'its page (the AGI GAMES intro never ended)');
  await press(button('Play'));
  await until(() => Boolean(document.querySelector('.ts-terminals')), 'its terminals');
  await press(button('Play on Trench Board'));
  await until(() => Boolean(document.querySelector('.ts-modes')), 'its modes');
  await press(p.locator('.ts-mode', { hasText: 'Free play' }));
  await until(() => Boolean(document.querySelector('.ts-brief')) && !/checking/.test(document.querySelector('.ts-price')?.textContent || ''), 'free play');
  // the run: its moment and its dice, the same every time. (The browser's frames come every 16 ms of the clock's own ticks,
  // which started from this computer's real time: so the ticks are put on a whole frame first, then the wall clock on T0
  // + 2 minutes. The run starts on the next frame, and its market is made from that moment and the dice.)
  await step(1);
  const phase = await p.evaluate(() => Math.round(performance.now()) % 16);
  if (phase) await step(16 - phase);
  await p.clock.setSystemTime(T0 + 120_000);
  await p.evaluate((s) => window.__trenchArtSeed(s), SCENE.seed);
  if (!phone) await p.mouse.move(2, 2);
  await press(button('Start'));
  if (!phone) await p.mouse.move(2, 2);
  await until(() => document.querySelectorAll('.tsb-card').length >= 6, 'its board');
  const seconds = async (s) => {
    for (let ms = Math.round((s * 1000) / 16) * 16; ms > 0; ms -= 2000) await step(Math.min(ms, 2000));
  };
  await seconds(SCENE.buyAt);
  // the king of the hill's coin, and a buy
  await press(p.locator('.tsb-koth-card'));
  await until(() => Boolean(document.querySelector('.tsb-coinview')), 'a coin');
  if (phone) {
    await press(p.locator('.tsb-buybar .tsb-tradebtn'));
    await until(() => Boolean(document.querySelector('dialog.tsb-sheet[open] .tsb-trade')), 'its trade sheet');
    await press(p.locator('dialog.tsb-sheet[open] .tsb-presets button', { hasText: SCENE.buy }));
    await press(p.locator('dialog.tsb-sheet[open] .tsb-place'));
    await until(() => !document.querySelector('dialog.tsb-sheet[open]'), 'its trade sheet closing');
  } else {
    await press(p.locator('.tsb-presets button', { hasText: SCENE.buy }));
    await press(p.locator('.tsb-place'));
  }
  await seconds(1);
  if (!phone) {
    await p.goBack();
    await until(() => Boolean(document.querySelector('.tsb-boardview')), 'the board again');
  }
  await seconds(SCENE.shotAt - SCENE.buyAt - 1);
  // (the toasts of the last few seconds gone, so the picture is the terminal itself)
  await p.evaluate(() => { for (const t of document.querySelectorAll('.ts-toast')) t.remove(); });
  await step(96);
  const png = await p.screenshot({ type: 'png' });
  const facts = await p.evaluate(() => ({
    clock: document.querySelector('.ts-hud-clock')?.textContent, worth: document.querySelector('.ts-hud-worth')?.textContent,
    coin: document.querySelector('.tsb-ch-name')?.textContent || null,
  }));
  await ctx.close();
  return { png, facts };
}

// ---------- the pictures ----------
async function photograph(browser, page, [w, h], { scale = 1, clear = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
  const p = await ctx.newPage();
  await p.goto(pathToFileURL(page).href, { waitUntil: 'load' });
  await p.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = r; i.onerror = r; }))));
  });
  const bad = await p.evaluate(() => [...document.images].filter((i) => !i.naturalWidth).map((i) => i.getAttribute('src')));
  if (bad.length) throw new Error(`${page}: pictures that didn't load: ${bad.join(', ')}`);
  const png = await p.screenshot({ type: 'png', omitBackground: clear });
  await ctx.close();
  return png;
}
// the key art: drawn at twice its size, then made smaller (sharper edges), WebP with its see-through edges
async function makeKeyart(browser) {
  const png = await photograph(browser, PAGES.keyart, KEYART_SIZE, { scale: 2, clear: true });
  const webp = await sharp(png).resize(KEYART_SIZE[0], KEYART_SIZE[1], { kernel: 'lanczos3' }).webp({ quality: 88, alphaQuality: 100, effort: 6, smartSubsample: true }).toBuffer();
  writeFileSync(OUT.keyart, webp);
  return webp;
}
// the link preview: the best JPEG under CARD_MAX bytes
async function makeCard(browser) {
  const png = await photograph(browser, PAGES.card, CARD_SIZE);
  for (let q = 90; q >= 50; q -= 2) {
    const jpg = await sharp(png).jpeg({ quality: q, mozjpeg: true, chromaSubsampling: '4:2:0' }).toBuffer();
    if (jpg.length < CARD_MAX) { writeFileSync(OUT.card, jpg); return { jpg, q }; }
  }
  throw new Error(`the card never fit in ${CARD_MAX} bytes`);
}

async function main() {
  const keep = process.argv.includes('--keep');
  const browser = await openBrowser();
  try {
    if (!keep) {
      if (!existsSync(join(DIST, 'trenchingsimulator.html'))) throw new Error('dist/ has no game: npx vite build first');
      const { server, url } = await serve(DIST);
      try {
        mkdirSync(HERE, { recursive: true });
        for (const [name, phone] of [['board', false], ['coin', true]]) {
          const { png, facts } = await shoot(browser, url, { phone });
          writeFileSync(OUT[name], await sharp(png).webp({ quality: 90, effort: 6 }).toBuffer());
          console.log(`✓ ${name}.webp: ${JSON.stringify(facts)}`);
        }
      } finally {
        server.close();
      }
    }
    for (const f of [OUT.board, OUT.coin]) if (!existsSync(f)) throw new Error(`${f} is missing: run without --keep`);
    const webp = await makeKeyart(browser);
    console.log(`✓ keyart.webp: ${KEYART_SIZE.join(' × ')}, ${webp.length.toLocaleString('en-US')} bytes`);
    const { jpg, q } = await makeCard(browser);
    console.log(`✓ trenchingsimulator.jpg: ${CARD_SIZE.join(' × ')}, ${jpg.length.toLocaleString('en-US')} bytes (quality ${q})`);
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => { console.error(`✗ ${err.message}`); process.exit(1); });
}
