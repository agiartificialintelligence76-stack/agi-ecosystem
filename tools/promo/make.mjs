// AGI-1's launch video (2026-10-03, the owner: "create me a professional launch video with motion design using only code
// about the website and its features"): makes it. Everything on screen is drawn in code (tools/promo/page/), the music
// is made in code (tools/promo/music.js), and both follow the same clock (tools/promo/timeline.js).
// Not part of the website, and nothing here posts anything anywhere: the owner downloads the video and posts it by hand.
//
//   node tools/promo/make.mjs [--format wide|tall|both] [--out promo] [--fps 60] [--scale 1] [--from s] [--to s]
//                             [--stills 3.5,9,12.25] [--sheet 0.5] [--no-music] [--crf 17] [--name launch]
//     --format   wide = 1920 × 1080 (X, YouTube), tall = 1080 × 1920 (TikTok, Reels, Shorts), both = one after the other
//     --scale    0.5 for a quick, smaller preview (the same picture, fewer pixels)
//     --from/--to  only that stretch (seconds)
//     --stills   PNG pictures at those times instead of a video
//     --sheet    a contact sheet: a picture every N seconds, in one PNG
//     --light MB also a smaller copy of each video, at most that many megabytes (two passes from the full one)
// A whole video also gets its cover picture (…-cover.jpg), and the post text goes next to them (…-post.txt).
// Needs Chromium (Claude's workspace has one; else CHROME_PATH), ffmpeg, and playwright-core
// (npm install --no-save playwright-core), like her daily clips.
import { writeFileSync, mkdirSync, existsSync, createReadStream, statSync, rmSync, readdirSync, copyFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { resolve, dirname, join, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOTAL, MOMENTS } from './timeline.js';
import { POST } from './words.js';

// the cover: the finale, AGI-1 waving next to "Talk to her now" and agi1.app
export const COVER_AT = MOMENTS.url + 0.95;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const HERE = join(ROOT, 'tools/promo');
// what the browser and ffmpeg get of this computer's settings: never a key, a secret or a token
export const withoutSecrets = (env = process.env) => Object.fromEntries(Object.entries(env).filter(([k]) => !/KEY|SECRET|TOKEN|PASS/i.test(k)));

// ---------- the renderer page, served on this computer only ----------
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.moc3': 'application/octet-stream' };
async function buildPage() {
  const { build } = await import('vite');
  const outDir = join(HERE, 'dist');
  await build({
    configFile: false, logLevel: 'warn', root: join(HERE, 'page'), publicDir: join(ROOT, 'public'), base: '/',
    build: { outDir, emptyOutDir: true, chunkSizeWarningLimit: 4000, copyPublicDir: true, minify: false },
  });
  return outDir;
}
function serve(dir) {
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = resolve(dir, `.${path === '/' ? '/index.html' : path}`);
    if (!file.startsWith(dir + sep) || !existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  return new Promise((ok) => { server.listen(0, '127.0.0.1', () => ok({ server, url: `http://127.0.0.1:${server.address().port}/` })); });
}
const BROWSERS = ['/opt/pw-browsers/chromium', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
async function openBrowser() {
  let chromium;
  try { ({ chromium } = await import('playwright-core')); } catch { throw new Error('playwright-core is missing: npm install --no-save playwright-core'); }
  let own = null;
  try { own = chromium.executablePath(); } catch { /* not downloaded */ }
  const paths = [...new Set([process.env.CHROME_PATH, own, ...BROWSERS])].filter((p) => p && existsSync(p));
  if (!paths.length) throw new Error('no Chrome or Chromium found (set CHROME_PATH)');
  // WebGL without a graphics card (her Live2D model, her art's shader): Chrome's software renderer. The 2D canvas is
  // drawn by the processor directly (faster than going through the software GPU).
  return chromium.launch({
    executablePath: paths[0], env: withoutSecrets(),
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--disable-accelerated-2d-canvas', '--disable-gpu-rasterization'],
  });
}

// ---------- ffmpeg: the pictures (JPEG, one after another) + the music → an MP4 ----------
function encoder(mp4, { fps, audio, crf, W, H }) {
  const input = audio ? ['-i', audio] : ['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo'];
  const args = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', ...input,
    '-map', '0:v', '-map', '1:a',
    // the site's colors as they are: BT.709, TV range, tagged so every player reads them the same
    '-vf', `scale=${W}:${H}:flags=lanczos:out_color_matrix=bt709:out_range=tv,format=yuv420p`,
    '-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-crf', String(crf), '-profile:v', 'high', '-level:v', fps > 30 ? '4.2' : '4.1',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-g', String(fps * 2), '-bf', '2', '-r', String(fps),
    '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-shortest', '-movflags', '+faststart', mp4];
  const ff = spawn('ffmpeg', args, { stdio: ['pipe', 'ignore', 'inherit'], env: withoutSecrets() });
  let failed = null;
  const done = new Promise((ok, fail) => { ff.on('error', fail); ff.on('close', (code, sig) => (code === 0 ? ok() : fail(new Error(`ffmpeg stopped (${sig || `exit ${code}`})`)))); });
  done.catch((e) => { failed = e; });
  ff.stdin.on('error', (e) => { failed ||= e; });
  return {
    write: (buf) => (failed ? Promise.reject(failed) : new Promise((ok) => { if (ff.stdin.write(buf)) ok(); else ff.stdin.once('drain', ok); })),
    end: () => { ff.stdin.end(); return done; },
    kill: () => { try { ff.kill('SIGKILL'); } catch { /* gone */ } },
  };
}

// a smaller copy, at most `mb` megabytes: two passes of x264 at the bitrate that fits (for places that take only small
// files; the full one is the one to post)
async function lighter(src, dst, mb, seconds) {
  const audioK = 160;
  const videoK = Math.floor((mb * 8 * 1000 * 0.96) / seconds - audioK);
  const log = join(dirname(dst), `x264-${process.pid}`);
  const run = (args) => new Promise((ok, fail) => { const p = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'inherit'], env: withoutSecrets() }); p.on('close', (c) => (c ? fail(new Error(`ffmpeg (light copy) exit ${c}`)) : ok())); });
  const common = ['-y', '-loglevel', 'error', '-i', src, '-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-b:v', `${videoK}k`, '-maxrate', `${Math.round(videoK * 1.8)}k`, '-bufsize', `${videoK * 4}k`, '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-passlogfile', log];
  await run([...common, '-pass', '1', '-an', '-f', 'mp4', '/dev/null']);
  await run([...common, '-pass', '2', '-c:a', 'aac', '-b:a', `${audioK}k`, '-movflags', '+faststart', dst]);
  for (const f of readdirSync(dirname(dst))) if (f.startsWith(`x264-${process.pid}`)) rmSync(join(dirname(dst), f), { force: true });
  console.log(`[promo] ${dst}: ${(statSync(dst).size / 1e6).toFixed(1)} MB (${videoK} kb/s)`);
}

function args(argv) {
  const a = { format: 'wide', out: 'promo', fps: 60, scale: 1, from: 0, to: TOTAL, stills: null, sheet: null, music: true, crf: 18, name: 'agi1-launch', quality: 0.95, light: 0 };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i], v = () => argv[++i];
    if (k === '--format') a.format = v();
    else if (k === '--out') a.out = v();
    else if (k === '--fps') a.fps = +v();
    else if (k === '--scale') a.scale = +v();
    else if (k === '--from') a.from = +v();
    else if (k === '--to') a.to = +v();
    else if (k === '--stills') a.stills = v().split(',').map(Number);
    else if (k === '--sheet') a.sheet = +v();
    else if (k === '--no-music') a.music = false;
    else if (k === '--crf') a.crf = +v();
    else if (k === '--name') a.name = v();
    else if (k === '--quality') a.quality = +v();
    else if (k === '--light') a.light = +v();
    else throw new Error(`unknown option ${k}`);
  }
  return a;
}

async function music(outDir) {
  const file = join(outDir, 'music.wav');
  const { renderMusic } = await import('./music.js');
  const t0 = Date.now();
  writeFileSync(file, renderMusic());
  console.log(`[promo] music: ${file} (${Math.round((Date.now() - t0) / 1000)} s)`);
  return file;
}

async function render(browser, url, a, format, audio) {
  const page = await browser.newPage({ viewport: { width: 400, height: 300 }, deviceScaleFactor: 1 });
  const problems = [];
  page.on('pageerror', (e) => problems.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.warn(`[page] ${m.text()}`); });
  try {
    await page.goto(url);
    await page.waitForFunction(() => window.promo, null, { timeout: 60_000 });
    const info = await page.evaluate((o) => window.promo.load(o), { format, scale: a.scale });
    if (problems.length) throw new Error(problems[0]);
    const tag = `${a.name}-${format}${a.scale !== 1 ? `-x${a.scale}` : ''}`;
    if (a.stills) {
      for (const t of a.stills) {
        const png = Buffer.from(await page.evaluate((x) => window.promo.still(x), t), 'base64');
        const f = join(a.outDir, `${tag}-${String(t.toFixed(2)).padStart(6, '0')}.png`);
        writeFileSync(f, png);
        console.log(`[promo] ${f}`);
      }
      return;
    }
    if (a.sheet) {
      const times = [];
      for (let t = a.from; t < Math.min(a.to, TOTAL) - 1e-6; t += a.sheet) times.push(+t.toFixed(3));
      const png = Buffer.from(await page.evaluate(([ts, cols]) => window.promo.sheet(ts, cols), [times, format === 'wide' ? 6 : 8]), 'base64');
      const f = join(a.outDir, `${tag}-sheet-${a.from}-${a.to}.png`);
      writeFileSync(f, png);
      console.log(`[promo] ${f} (${times.length} pictures)`);
      return;
    }
    const first = Math.round(a.from * a.fps), last = Math.round(Math.min(a.to, TOTAL) * a.fps);
    const mp4 = join(a.outDir, `${tag}${a.from || a.to < TOTAL ? `-${a.from}-${a.to}` : ''}.mp4`);
    let aud = audio;
    if (aud && (a.from || a.to < TOTAL)) {                  // just that stretch of the music
      aud = join(a.outDir, `music-${a.from}-${a.to}.wav`);
      await new Promise((ok, fail) => { const p = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(a.from), '-to', String(a.to), '-i', audio, aud]); p.on('close', (c) => (c ? fail(new Error('ffmpeg (music cut)')) : ok())); });
    }
    const ff = encoder(mp4, { fps: a.fps, audio: aud, crf: a.crf, W: Math.round(info.W * a.scale), H: Math.round(info.H * a.scale) });
    const t0 = Date.now();
    try {
      for (let i = first; i < last; i++) {
        const jpg = Buffer.from(await page.evaluate(([k, fps, q]) => window.promo.frame(k, fps, q), [i, a.fps, a.quality]), 'base64');
        if (problems.length) throw new Error(`the page went wrong at frame ${i}: ${problems[0]}`);
        await ff.write(jpg);
        if ((i - first) % (a.fps * 2) === 0) {
          const done = i - first + 1, el = (Date.now() - t0) / 1000;
          process.stdout.write(`\r[promo] ${format} ${(i / a.fps).toFixed(1)} s / ${(last / a.fps).toFixed(1)} s · ${(el / done * 1000).toFixed(0)} ms a frame · ${Math.round((last - i) * el / done)} s left   `);
        }
      }
      await ff.end();
    } catch (err) { ff.kill(); throw err; }
    const t = await page.evaluate(() => window.promo.times());
    console.log(`\n[promo] ${mp4}: ${last - first} frames in ${Math.round((Date.now() - t0) / 1000)} s (draw ${Math.round(t.draw / t.n)} ms, jpeg ${Math.round(t.encode / t.n)} ms a frame)`);
    if (aud && aud !== audio) rmSync(aud, { force: true });
    if (!a.from && a.to >= TOTAL) {
      const jpg = Buffer.from(await page.evaluate((x) => window.promo.still(x, 'image/jpeg'), COVER_AT), 'base64');
      writeFileSync(join(a.outDir, `${tag}-cover.jpg`), jpg);
      console.log(`[promo] ${join(a.outDir, `${tag}-cover.jpg`)}`);
    }
    if (a.light) await lighter(mp4, join(a.outDir, `${tag}-light.mp4`), a.light, (last - first) / a.fps);
  } finally {
    await page.close().catch(() => {});
  }
}

async function main() {
  const a = args(process.argv.slice(2));
  a.outDir = resolve(a.out);
  mkdirSync(a.outDir, { recursive: true });
  const formats = a.format === 'both' ? ['wide', 'tall'] : [a.format];
  if (!a.stills && !a.sheet && !a.from && a.to >= TOTAL) {
    writeFileSync(join(a.outDir, `${a.name}-post.txt`), `${POST}\n`);
    copyFileSync(join(HERE, 'README.txt'), join(a.outDir, 'README.txt'));      // what each file is, and how to post it
  }
  const audio = !a.stills && !a.sheet && a.music ? await music(a.outDir) : null;
  const served = await serve(await buildPage());
  const browser = await openBrowser();
  try {
    for (const f of formats) await render(browser, served.url, a, f, audio);
  } finally {
    await browser.close().catch(() => {});
    served.server.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => { console.error(`\n[promo] ${err.stack || err.message}`); process.exitCode = 1; });
}
