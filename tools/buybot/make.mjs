// AGI-1's buy GIF (2026-10-06, the owner: "a very simple buybot … with a gif of her"): makes server/media/agi1-buy.mp4,
// the animation her buy bot posts with each $AGI buy in her Telegram groups (server/buys.js). Drawn in code
// (tools/buybot/page/: her 2D self cheering, PG-13), 480 × 480, 2.5 s, 30 frames a second, H.264 without sound: Telegram
// shows a soundless MP4 as a GIF (smaller and sharper than a real GIF). Run it again after her model changes:
//   node tools/buybot/make.mjs [--out server/media/agi1-buy.mp4] [--stills 0,0.9,1.6] [--crf 26]
// Needs Chromium (Claude's workspace has one; else CHROME_PATH), ffmpeg and playwright-core
// (npm install --no-save playwright-core), like her daily clips and her launch video. Nothing here posts anything.
import { writeFileSync, existsSync, createReadStream, statSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { resolve, dirname, join, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const HERE = join(ROOT, 'tools/buybot');
export const FPS = 30;
// what the browser and ffmpeg get of this computer's settings: never a key, a secret or a token
export const withoutSecrets = (env = process.env) => Object.fromEntries(Object.entries(env).filter(([k]) => !/KEY|SECRET|TOKEN|PASS|JWT/i.test(k)));

function args(argv) {
  const a = { out: join(ROOT, 'server/media/agi1-buy.mp4'), stills: null, crf: 26 };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i], v = () => argv[++i];
    if (k === '--out') a.out = resolve(v());
    else if (k === '--stills') a.stills = v().split(',').map(Number);
    else if (k === '--crf') a.crf = +v();
  }
  return a;
}

async function buildPage() {
  const { build } = await import('vite');
  const outDir = join(HERE, 'dist');
  await build({
    configFile: false, logLevel: 'warn', root: join(HERE, 'page'), publicDir: join(ROOT, 'public'), base: '/',
    build: { outDir, emptyOutDir: true, chunkSizeWarningLimit: 4000, copyPublicDir: true, minify: false },
  });
  return outDir;
}
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.woff2': 'font/woff2', '.png': 'image/png', '.json': 'application/json', '.moc3': 'application/octet-stream' };
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
  return chromium.launch({
    executablePath: paths[0], env: withoutSecrets(),
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--disable-accelerated-2d-canvas', '--disable-gpu-rasterization'],
  });
}

// ffmpeg: the pictures (JPEG, one after another) → an MP4 without sound, ready to stream (moov first), BT.709
function encoder(mp4, { crf }) {
  const p = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-vf', 'scale=480:480:flags=lanczos:out_color_matrix=bt709:out_range=tv,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-crf', String(crf), '-profile:v', 'high', '-level:v', '3.1',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-g', String(FPS * 3), '-an', '-movflags', '+faststart', mp4], { stdio: ['pipe', 'inherit', 'inherit'], env: withoutSecrets() });
  const done = new Promise((ok, no) => p.on('close', (code) => (code === 0 ? ok() : no(new Error(`ffmpeg stopped (${code})`)))));
  return { write: (buf) => new Promise((ok) => (p.stdin.write(buf) ? ok() : p.stdin.once('drain', ok))), end: () => { p.stdin.end(); return done; } };
}

async function main() {
  const a = args(process.argv.slice(2));
  const dir = await buildPage();
  const { server, url } = await serve(dir);
  const browser = await openBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 520, height: 520 } });
    const problems = [];
    page.on('pageerror', (e) => problems.push(e.message));
    await page.goto(url, { waitUntil: 'load' });
    const info = await page.evaluate(() => window.gif.load());
    if (problems.length) throw new Error(`the page went wrong: ${problems[0]}`);
    if (a.stills) {
      for (const t of a.stills) {
        const png = Buffer.from(await page.evaluate((x) => window.gif.still(x), t), 'base64');
        const file = a.out.replace(/\.mp4$/, '') + `-${t.toFixed(2)}.png`;
        writeFileSync(file, png);
        console.log(`[buybot] ${file}`);
      }
      return;
    }
    mkdirSync(dirname(a.out), { recursive: true });
    const enc = encoder(a.out, a);
    const frames = Math.round(info.T * FPS);
    for (let i = 0; i < frames; i++) {
      const jpg = Buffer.from(await page.evaluate(([t]) => window.gif.frame(t), [i / FPS]), 'base64');
      if (problems.length) throw new Error(`the page went wrong at frame ${i}: ${problems[0]}`);
      await enc.write(jpg);
    }
    await enc.end();
    console.log(`[buybot] ${a.out}: ${frames} frames, ${Math.round(statSync(a.out).size / 1024)} KB`);
  } finally {
    await browser.close();
    server.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => { console.error(`[buybot] ${err.message}`); process.exit(1); });
}
