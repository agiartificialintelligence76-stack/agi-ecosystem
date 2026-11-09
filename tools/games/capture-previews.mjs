// AGI games' gameplay previews (2026-11-08, the owner: "there should ba a preview of gameplay on every game"): each game's
// tile on agi1.app/games plays a short muted loop of the game playing itself, with a still from it. This records them.
//
//   node tools/games/capture-previews.mjs [--base http://127.0.0.1:5173] [game …]
//
// It opens each game in Chromium (Playwright) with a fake clock, so every frame is stepped exactly (1/30 s) however slow
// the machine draws (a 3D game in a software renderer included), screenshots it, and encodes the frames with ffmpeg:
//   public/images/games/<id>.mp4   480 × 480, H.264, 30 fps, about 6 s, no sound, fast start (Safari and every phone)
//   public/images/games/<id>.webp  600 × 600, a still from the loop (the tile's picture until the loop plays)
// The ten arcade-kit games play themselves with `?demo&seed=…` (their own AI); Ride 'Em, AGI! with its QA autopilot
// (`window.__auto`); SKYBREAK with its QA input replay (`?qa`); VLAD RUNNER 2049 and TRENCHING SIMULATOR with a few
// scripted presses. Needs a running site (`npx vite`), Playwright's Chromium and ffmpeg.
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, readdirSync, statSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const BASE = opt('base', 'http://127.0.0.1:5173');
const OUT = opt('out', 'public/images/games');
const FPS = 30, SIZE = 480, DPR = 1.25;
const only = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));

const kit = (id, seed = 7, { warm = 2500, dur = 6000, poster = 0.45, ...more } = {}) => ({ url: `/games/${id}?demo&seed=${seed}`, warm, dur, poster, shotTimeout: 180000, ...more });
export const RECIPES = {
  mergeagi: kit('mergeagi'), blockchain: kit('blockchain'), heartbeat: kit('heartbeat'), scamslayer: kit('scamslayer'),
  // (its pixel art is small on a wide field: drawn twice as fine and cropped around her, so the bots read on a small tile)
  lastmodel: kit('lastmodel', 7, { dpr: 2, crop: [110, 80, 260, 260] }), singularity: kit('singularity'), jailbreak: kit('jailbreak'), stacked: kit('stacked'),
  jaywalk: kit('jaywalk'), robotaxi: kit('robotaxi'),
  // (2026-11-08, the second night)
  realorai: kit('realorai'), notarobot: kit('notarobot', 7, { poster: 0.2 }), alignment: kit('alignment'), gradient: kit('gradient'), epochs: kit('epochs'),
  synapse: kit('synapse'), overclock: kit('overclock'), beattheagi: kit('beattheagi', 7, { poster: 0.1 }), hallucination: kit('hallucination'), guardrails: kit('guardrails'),
  // (2026-11-09) five more
  bubblesort: kit('bubblesort'), airgap: kit('airgap'), cookies: kit('cookies'), packetloss: kit('packetloss'), autocomplete: kit('autocomplete'),
  // its own QA autopilot plays a real run (the menu's Play, then the bot)
  rideemagi: {
    url: '/games/rideemagi', init: 'window.__auto = true;', warm: 2400, dur: 6000, poster: 0.5, vp: [768, 480], crop: [30, 0, 480, 480],
    steps: async (page) => {
      // its first visit asks "How are you playing?" (a computer: keyboard or mouse), then its menu's Endless
      for (let i = 0; i < 20 && !(await page.$('[data-act="dev"][data-v="pc"], [data-act="endless"]')); i++) await page.clock.runFor(250);
      if (await page.$('[data-act="dev"][data-v="pc"]')) { await click(page, '[data-act="dev"][data-v="pc"]'); await page.clock.runFor(800); }
      for (let i = 0; i < 20 && !(await page.$('[data-act="endless"]')); i++) await page.clock.runFor(250);
      await click(page, '[data-act="endless"]');
    },
  },
  // the setup screen, then a fight: walk right, punch, kick, jump, a special now and then
  vladrunner2049: {
    url: '/games/vladrunner2049?sound=off', warm: 1200, dur: 6000, poster: 0.5, vp: [768, 480], crop: [144, 0, 480, 480],
    steps: async (page) => {
      await click(page, '[data-do="play"]'); await page.clock.runFor(900);
      for (let i = 0; i < 40 && !(await page.$('[data-do="start"]:not([disabled])')); i++) await page.clock.runFor(250);
      await click(page, '[data-do="start"]'); await page.clock.runFor(800);
      for (let i = 0; i < 12 && (await page.$('[data-do="story-skip"]:visible')); i++) { await click(page, '[data-do="story-skip"]'); await page.clock.runFor(500); }
      await page.keyboard.down('KeyD');
    },
    frame: async (page, i) => {
      const k = ['KeyJ', 'KeyJ', 'KeyK', 'KeyJ', 'Space', 'KeyJ', 'KeyL', 'KeyJ'][Math.floor(i / 5) % 8];
      if (i % 5 === 0) await page.keyboard.down(k);
      if (i % 5 === 2) await page.keyboard.up(k);
      if (i % 60 === 30) await page.keyboard.up('KeyD');
      if (i % 60 === 45) await page.keyboard.down('KeyD');
    },
  },
  // a free-play market on its first terminal, then a trending coin's page: its candles and volume moving with the crowd
  trenchingsimulator: {
    url: '/games/trenchingsimulator', warm: 2500, dur: 6000, poster: 0.7, vp: [1100, 620], crop: [330, 150, 470, 470],
    steps: async (page) => {
      await click(page, 'button:has-text("Free play")'); await page.clock.runFor(800);
      await click(page, 'button:has-text("Start")'); await page.clock.runFor(2500);
      await click(page, '.pomp-coin-row');
    },
  },
  // the climb: its QA input replay walks and jumps her up the chart (its QA panel hidden from the picture)
  skybreak: {
    url: '/games/skybreak?qa&step=40', css: '#qa, #qa-info { display: none !important; }', warm: 4000, dur: 6000, poster: 0.5, vp: [720, 480], crop: [120, 0, 480, 480], manual: true, shotTimeout: 120000,
    steps: async (page) => {
      // its 3D city and her character load first (Begin Ascent turns on), then its QA replay starts a run and climbs
      await page.waitForSelector('#start:not([disabled])', { timeout: 300000 });
      // its low quality (the 40,000-splat city), so a software-drawn frame takes seconds, not minutes
      await page.evaluate(() => { const q = document.getElementById('quality'); q?.click(); q?.click(); });
      await page.evaluate(() => document.getElementById('qa-replay')?.click());
    },
  },
};

const cropOf = (r) => (r.crop ? `crop=${r.crop.map((v) => Math.round(v * (r.dpr || DPR))).join(':').replace(/^(\d+):(\d+):(\d+):(\d+)$/, '$3:$4:$1:$2')},` : '');
async function press(page, key) { await page.keyboard.down(key); await page.clock.runFor(60); await page.keyboard.up(key); }
async function click(page, sel) { try { await page.click(sel, { force: true, timeout: 3000 }); } catch (e) { console.log(`  (no ${sel})`); } }

async function capture(browser, id, r) {
  const dir = join(tmpdir(), `agi-preview-${id}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  // a game made for a wide screen is recorded wide, then cropped square around its action (`vp`, `crop` in CSS pixels)
  const [vw, vh] = r.vp || [SIZE, SIZE];
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: r.dpr || DPR, reducedMotion: 'no-preference', bypassCSP: true });
  // the arcade's settings: silent; and the intro seen already in this tab (its short version)
  await ctx.addInitScript(`try { sessionStorage.setItem('agi_intro', '1'); localStorage.setItem('agi_arcade:settings', JSON.stringify({ sound: false, music: false, haptics: false })); } catch {}`);
  if (r.init) await ctx.addInitScript(r.init);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // (a game too heavy for a fake clock, SKYBREAK's 3D: real time until it plays, then each frame stepped by hand)
  const tick = r.manual ? (ms) => page.evaluate((m) => window.__step(m), ms) : (ms) => page.clock.runFor(ms);
  // the clock stands still between frames (installed, then paused: otherwise it flows while a slow frame is drawn)
  if (!r.manual) { await page.clock.install({ time: new Date('2026-11-08T12:00:00Z') }); await page.clock.pauseAt(new Date('2026-11-08T12:00:01Z')); }
  else page.clock = { runFor: (ms) => page.waitForTimeout(ms) };
  await page.goto(BASE + r.url, { waitUntil: 'load', timeout: 120000 });
  if (r.css) await page.addStyleTag({ content: r.css });
  // the AGI GAMES intro, then the game's own start
  await page.clock.runFor(3200);
  await page.keyboard.press('Shift');
  if (r.steps) await r.steps(page);
  if (r.manual) {
    await page.evaluate(() => {
      let fake = performance.now(), queue = [];
      performance.now = () => fake;
      window.requestAnimationFrame = (cb) => { queue.push(cb); return queue.length; };
      window.cancelAnimationFrame = () => {};
      window.__step = (ms) => { fake += ms; const q = queue; queue = []; for (const cb of q) { try { cb(fake); } catch (e) { console.error(e); } } return q.length; };
    });
    await page.waitForTimeout(1500);       // the loops already waiting on a real frame join the queue
  }
  for (let t = 0; t < r.warm; t += 1000 / 30) await tick(1000 / 30);
  const fps = r.fps || FPS;
  const n = Math.round((r.dur / 1000) * fps);
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    if (r.frame) await r.frame(page, i);
    await tick(1000 / fps);
    await page.screenshot({ path: join(dir, `f${String(i).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 94, timeout: r.shotTimeout || 30000 });
  }
  await ctx.close();
  console.log(`  ${n} frames in ${((Date.now() - t0) / 1000).toFixed(1)} s${errors.length ? ` · page errors: ${errors.slice(0, 3).join(' | ')}` : ''}`);
  mkdirSync(OUT, { recursive: true });
  const mp4 = join(OUT, `${id}.mp4`), webp = join(OUT, `${id}.webp`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', join(dir, 'f%04d.jpg'), '-r', String(FPS),
    '-vf', `${cropOf(r)}scale=${SIZE}:${SIZE}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.0',
    '-preset', 'slow', '-crf', '27', '-g', String(FPS * 2), '-movflags', '+faststart', '-an', mp4]);
  const pick = join(dir, `f${String(Math.min(n - 1, Math.round(n * r.poster))).padStart(4, '0')}.jpg`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', pick, '-vf', `${cropOf(r)}scale=600:600:flags=lanczos`, '-quality', '82', webp]);
  console.log(`  → ${mp4} (${Math.round(statSync(mp4).size / 1024)} KB), ${webp} (${Math.round(statSync(webp).size / 1024)} KB)`);
  rmSync(dir, { recursive: true, force: true });
  return errors;
}

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });
const ids = only.length ? only : Object.keys(RECIPES);
const problems = {};
for (const id of ids) {
  const r = RECIPES[id];
  if (!r) { console.log(`✗ ${id}: no recipe`); continue; }
  console.log(`• ${id}`);
  try {
    const errs = await capture(browser, id, r);
    if (errs.length) problems[id] = errs;
  } catch (e) { console.log(`✗ ${id}: ${e.message}`); problems[id] = [e.message]; }
}
await browser.close();
if (Object.keys(problems).length) { console.log('problems:', JSON.stringify(problems, null, 1)); process.exitCode = 1; }
if (!existsSync(OUT)) process.exitCode = 1;
else console.log(`✓ ${readdirSync(OUT).filter((f) => f.endsWith('.mp4')).length} previews in ${OUT}`);
