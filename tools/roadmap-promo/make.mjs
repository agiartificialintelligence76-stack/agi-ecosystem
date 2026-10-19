// The roadmap's video and graphics (2026-10-14, the owner: "can you create a graphic and just short promotional video
// for the roadmap"; the owner's choices: 16:9 for X, about 20 seconds, music made in code and AGI-1's voice, and an X
// post image, the roadmap's link preview and a square one): makes them.
// Everything on screen is drawn in code (tools/roadmap-promo/page/) in the roadmap page's Pop mode look, with its own
// words (words.js); its music is made in code (music.js), both follow one clock (timeline.js), and AGI-1's voice is over
// the music: her three takes, made ready by media.mjs, mixed by AGI Studio's video's voice.js where timeline.js puts them
// (VOICE), the music dipping under her. Not part of the website, and nothing here posts anything: the owner posts it by
// hand.
//
//   node tools/roadmap-promo/make.mjs [--out promo/roadmap] [--fps 60] [--scale 1] [--from s] [--to s]
//                                     [--stills 1.2,6.9] [--sheet 0.5] [--cards] [--no-music] [--no-voice] [--crf 18]
//                                     [--light 12] [--sound-only]
//     --scale    0.5 for a quick, smaller preview (the same picture, fewer pixels)
//     --from/--to  only that stretch (seconds)
//     --stills   PNG pictures at those times instead of a video
//     --sheet    a contact sheet: a picture every N seconds, in one PNG
//     --cards    its graphics instead of the video: the X post image and the square one (PNG), the link preview (PNG,
//                and a JPEG, also written to public/cards/roadmap.jpg: the roadmap pages' og:image)
//     --light MB also a smaller copy, at most that many megabytes (two passes from the full one)
//     --no-voice its music alone, without her voice
//     --sound-only  only its sound, made again: the videos already in --out get it, their pictures as they are (copied,
//                never encoded again); the first time, each of them as it was is kept as …-music-only.mp4
// A whole video also gets its cover picture (…-cover.jpg), the post text next to it (…-post.txt) and README.txt; with her
// voice, a copy with its music alone too (…-music-only.mp4, and …-light-music-only.mp4 with --light).
// Needs Chromium (Claude's workspace has one; else CHROME_PATH), ffmpeg, playwright-core (npm install --no-save
// playwright-core), and for her voice tools/roadmap-promo/media (node tools/roadmap-promo/media.mjs --from <the folder
// with her takes>).
import { writeFileSync, readFileSync, mkdirSync, existsSync, createReadStream, statSync, rmSync, readdirSync, copyFileSync, renameSync } from 'node:fs';
import { createServer } from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import { resolve, dirname, join, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOTAL, MOMENTS, VOICE } from './timeline.js';
import { POST } from './words.js';
import { RATE, readWav, wav16, mixVoice, hitsOf } from '../studio-promo/voice.js';

// the cover: the end card, everything on it, on its last hit
export const COVER_AT = MOMENTS.lastHits[0] - 0.1;
// the link preview's JPEG: under this many bytes (the home page's is 73 KB)
export const OG_MAX = 160_000;
// room left in it for the Claude app's Content Credentials label (about 5.8 KB in a JPEG saved into the owner's folder:
// an APP11 segment, see CLAUDE.md's "Working in this repo"), so the copy in the owner's folder fits under OG_MAX too
export const OG_LABEL = 6_000;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const HERE = join(ROOT, 'tools/roadmap-promo');
const MEDIA = join(HERE, 'media');
export const OG_FILE = join(ROOT, 'public/cards/roadmap.jpg');
// what the browser and ffmpeg get of this computer's settings: never a key, a secret or a token
export const withoutSecrets = (env = process.env) => Object.fromEntries(Object.entries(env).filter(([k]) => !/KEY|SECRET|TOKEN|PASS/i.test(k)));
const log = (s) => console.log(`[roadmap-promo] ${s}`);

// ---------- the renderer page, served on this computer only ----------
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json' };
async function buildPage() {
  const { build } = await import('vite');
  const outDir = join(HERE, 'dist');
  await build({
    configFile: false, logLevel: 'warn', root: join(HERE, 'page'), publicDir: join(ROOT, 'public'), base: '/',
    build: { outDir, emptyOutDir: true, chunkSizeWarningLimit: 4000, copyPublicDir: true, minify: false },
  });
  return outDir;
}
export function serve(dir) {
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    const file = resolve(dir, `.${path === '/' ? '/index.html' : path}`);
    if (!file.startsWith(dir + sep) || !existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
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
  // WebGL without a graphics card (her art's halftone shader): Chrome's software renderer. The 2D canvas is drawn by the
  // processor directly (faster than going through the software GPU).
  return chromium.launch({
    executablePath: paths[0], env: withoutSecrets(),
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--disable-accelerated-2d-canvas', '--disable-gpu-rasterization'],
  });
}

// ---------- ffmpeg: the pictures (JPEG, one after another) + the sound → an MP4 ----------
function encoder(mp4, { fps, audio, crf, W, H }) {
  const input = audio ? ['-i', audio] : ['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo'];
  const args = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', ...input,
    '-map', '0:v', '-map', '1:a',
    '-vf', `scale=${W}:${H}:flags=lanczos:out_color_matrix=bt709:out_range=tv,format=yuv420p`,
    '-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-crf', String(crf), '-profile:v', 'high', '-level:v', fps > 30 ? '4.2' : '4.1',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-g', String(fps * 2), '-bf', '2', '-r', String(fps),
    '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-shortest', '-movflags', '+faststart', mp4];
  const proc = spawn('ffmpeg', args, { stdio: ['pipe', 'ignore', 'inherit'], env: withoutSecrets() });
  let failed = null;
  const done = new Promise((ok, fail) => { proc.on('error', fail); proc.on('close', (code, sig) => (code === 0 ? ok() : fail(new Error(`ffmpeg stopped (${sig || `exit ${code}`})`)))); });
  done.catch((e) => { failed = e; });
  proc.stdin.on('error', (e) => { failed ||= e; });
  return {
    write: (buf) => (failed ? Promise.reject(failed) : new Promise((ok) => { if (proc.stdin.write(buf)) ok(); else proc.stdin.once('drain', ok); })),
    end: () => { proc.stdin.end(); return done; },
    kill: () => { try { proc.kill('SIGKILL'); } catch { /* gone */ } },
  };
}

// ffmpeg, never with a secret in its environment
const ff = (args, what) => new Promise((ok, fail) => {
  const p = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'inherit'], env: withoutSecrets() });
  p.on('error', fail);
  p.on('close', (c) => (c ? fail(new Error(`ffmpeg (${what}) exit ${c}`)) : ok()));
});
// how long a video's pictures last (s)
const videoSeconds = (file) => +execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=duration', '-of', 'default=nw=1:nk=1', file], { env: withoutSecrets() }).toString().trim();

// a smaller copy, at most `mb` megabytes: two passes of x264 at the bitrate that fits; its sound from `audio` (a WAV) when
// given, else the full one's
async function lighter(src, dst, mb, seconds, audio = null) {
  const audioK = 160;
  const videoK = Math.floor((mb * 8 * 1000 * 0.96) / seconds - audioK);
  const passlog = join(dirname(dst), `x264-${process.pid}`);
  const video = ['-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-b:v', `${videoK}k`, '-maxrate', `${Math.round(videoK * 1.8)}k`, '-bufsize', `${videoK * 4}k`, '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-passlogfile', passlog];
  await ff(['-y', '-loglevel', 'error', '-i', src, ...video, '-pass', '1', '-an', '-f', 'mp4', '/dev/null'], 'light copy');
  const sound = audio ? ['-i', audio, '-map', '0:v:0', '-map', '1:a:0', '-t', String(seconds)] : [];
  await ff(['-y', '-loglevel', 'error', '-i', src, ...sound, ...video, '-pass', '2', '-c:a', 'aac', '-b:a', `${audioK}k`, '-ar', '48000', '-movflags', '+faststart', dst], 'light copy');
  for (const f of readdirSync(dirname(dst))) if (f.startsWith(`x264-${process.pid}`)) rmSync(join(dirname(dst), f), { force: true });
  log(`${dst}: ${(statSync(dst).size / 1e6).toFixed(1)} MB (${videoK} kb/s)`);
}

// a video's pictures exactly as they are (copied, never encoded again) with another sound (a WAV, made AAC)
export async function remux(video, wav, dst, kbps) {
  const part = `${dst}.part.mp4`;
  await ff(['-y', '-loglevel', 'error', '-i', video, '-i', wav, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy',
    '-c:a', 'aac', '-b:a', `${kbps}k`, '-ar', '48000', '-t', String(videoSeconds(video)), '-movflags', '+faststart', part], 'its sound');
  renameSync(part, dst);
  log(`${dst}: ${(statSync(dst).size / 1e6).toFixed(1)} MB (its pictures as they were, its sound ${kbps} kb/s)`);
}

export function args(argv) {
  const a = { out: 'promo/roadmap', fps: 60, scale: 1, from: 0, to: TOTAL, stills: null, sheet: null, cards: false, music: true, voice: true, crf: 18, name: 'agi1-roadmap', quality: 0.95, light: 0, soundOnly: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i], v = () => argv[++i];
    if (k === '--out') a.out = v();
    else if (k === '--fps') a.fps = +v();
    else if (k === '--scale') a.scale = +v();
    else if (k === '--from') a.from = +v();
    else if (k === '--to') a.to = +v();
    else if (k === '--stills') a.stills = v().split(',').map(Number);
    else if (k === '--sheet') a.sheet = +v();
    else if (k === '--cards') a.cards = true;
    else if (k === '--no-music') a.music = false;
    else if (k === '--no-voice') a.voice = false;
    else if (k === '--sound-only') a.soundOnly = true;
    else if (k === '--crf') a.crf = +v();
    else if (k === '--name') a.name = v();
    else if (k === '--quality') a.quality = +v();
    else if (k === '--light') a.light = +v();
    else throw new Error(`unknown option ${k}`);
  }
  return a;
}

// her lines made ready (media.mjs: media/voice/<id>.wav, and index.json's voice: where her first word starts in each, how
// long her words last), where timeline.js puts them. A take whose words last much longer or shorter than its place was
// made for is said, never mixed: its place is checked again first (timeline.js VOICE).
export const LEN_SLACK = 0.15;
export function voiceLines(media = MEDIA) {
  const indexFile = join(media, 'index.json');
  const index = existsSync(indexFile) ? JSON.parse(readFileSync(indexFile, 'utf8')) : {};
  const how = 'node tools/roadmap-promo/media.mjs --from <the folder with her takes> (or --no-voice: its music alone)';
  return VOICE.map((l) => {
    const info = index.voice?.[l.id], file = join(media, 'voice', `${l.id}.wav`);
    if (!info || !existsSync(file)) throw new Error(`her line "${l.id}" isn't made ready: ${how}`);
    if (Math.abs(info.len - l.len) > LEN_SLACK) {
      throw new Error(`her take of "${l.id}" lasts ${info.len} s, and its place in timeline.js (VOICE) was made for ${l.len} s: check where it goes, then set its len`);
    }
    const { rate, channels } = readWav(readFileSync(file));
    if (rate !== RATE || channels.length !== 1) throw new Error(`her line "${l.id}" isn't as media.mjs makes it (48 kHz, one channel): ${how}`);
    return { id: l.id, at: l.at, len: info.len, onset: info.onset, pcm: channels[0], over: l.over };
  });
}

// its sound: the music (music.js), and her voice over it (voice.js) → { music: its music alone (a WAV), file: the
// soundtrack (a WAV), voiced }
async function soundtrack(outDir, a) {
  const { renderMusic, musicPlan, BREATHS } = await import('./music.js');
  const music = join(outDir, 'music.wav');
  const t0 = Date.now();
  const wav = renderMusic();
  writeFileSync(music, wav);
  log(`music: ${music} (${Math.round((Date.now() - t0) / 1000)} s)`);
  if (!a.voice) return { music, file: music, voiced: false };
  const lines = voiceLines();
  const { channels: [L, R] } = readWav(wav);
  // its limiter reads between the samples too (truePeak): the soundtrack's true peak stays under -1 dBTP, as a phone's app
  // and X's own encoder want it (2026-10-20: the "t" of her "secret" rose 0.44 dB between two samples)
  const mix = mixVoice({ L, R }, lines, { hits: hitsOf(musicPlan()), breaths: BREATHS, truePeak: true });
  const file = join(outDir, 'soundtrack.wav');
  writeFileSync(file, wav16([mix.L, mix.R]));
  for (const r of mix.report) {
    log(`her voice, ${r.id}: ${r.at.toFixed(2)} to ${r.end.toFixed(2)} s, the music ${r.duck} dB under her (${r.music} LUFS there, hers ${r.her})`);
  }
  log(`soundtrack: ${file} (her ${lines.length} lines over the music; the music exactly as it was everywhere else, `
    + `${mix.changed} samples changed; its limiter held ${mix.limiter.under} of them, at most ${-mix.limiter.min} dB)`);
  return { music, file, voiced: true };
}

// only its sound, made again: each video already in the folder (the full one, the light one) gets the soundtrack, its
// pictures as they are; the first time, the video as it was is kept as its music-only copy (its sound the music alone)
export async function soundOnly(a, sound) {
  const made = [];
  for (const [base, kbps] of [[a.name, 256], [`${a.name}-light`, 160]]) {
    const mp4 = join(a.outDir, `${base}.mp4`), kept = join(a.outDir, `${base}-music-only.mp4`);
    if (!existsSync(kept)) {
      if (!existsSync(mp4)) continue;
      renameSync(mp4, kept);
      log(`${kept}: the video as it was, its music alone`);
    }
    await remux(kept, sound.file, mp4, kbps);
    made.push(mp4);
  }
  if (!made.length) throw new Error(`no video in ${a.outDir} to give its sound to: make it first (without --sound-only)`);
}

// the link preview as a JPEG: the best quality that fits under OG_MAX, with room for its label (OG_LABEL)
export async function ogJpeg(png, max = OG_MAX - OG_LABEL) {
  const sharp = (await import('sharp')).default;
  for (const quality of [88, 85, 82, 78, 74, 70]) {
    const jpg = await sharp(png).jpeg({ quality, mozjpeg: true }).toBuffer();
    if (jpg.length <= max) return { jpg, quality };
  }
  throw new Error(`the link preview won't fit in ${max} bytes`);
}

async function render(browser, url, a, sound) {
  const audio = sound?.file || null;
  const page = await browser.newPage({ viewport: { width: 400, height: 300 }, deviceScaleFactor: 1 });
  const problems = [];
  page.on('pageerror', (e) => problems.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.warn(`[page] ${m.text()}`); });
  try {
    await page.goto(url);
    await page.waitForFunction(() => window.promo, null, { timeout: 60_000 });
    const info = await page.evaluate((o) => window.promo.load(o), { scale: a.scale });
    if (problems.length) throw new Error(problems[0]);
    const tag = `${a.name}${a.scale !== 1 ? `-x${a.scale}` : ''}`;
    if (a.cards) {
      for (const kind of await page.evaluate(() => window.promo.cards)) {
        const png = Buffer.from(await page.evaluate((k) => window.promo.card(k), kind), 'base64');
        if (problems.length) throw new Error(problems[0]);
        const f = join(a.outDir, `${a.name}-${kind}.png`);
        writeFileSync(f, png);
        log(`${f}: ${(png.length / 1e6).toFixed(2)} MB`);
        if (kind === 'og') {
          const { jpg, quality } = await ogJpeg(png);
          writeFileSync(join(a.outDir, `${a.name}-og.jpg`), jpg);
          writeFileSync(OG_FILE, jpg);
          log(`${OG_FILE}: ${Math.round(jpg.length / 1000)} KB (JPEG, quality ${quality}): the roadmap pages' link preview`);
        }
      }
      return;
    }
    if (a.stills) {
      for (const t of a.stills) {
        const png = Buffer.from(await page.evaluate((x) => window.promo.still(x), t), 'base64');
        const f = join(a.outDir, `${tag}-${String(t.toFixed(2)).padStart(6, '0')}.png`);
        writeFileSync(f, png);
        log(f);
      }
      return;
    }
    if (a.sheet) {
      const times = [];
      for (let t = a.from; t < Math.min(a.to, TOTAL) - 1e-6; t += a.sheet) times.push(+t.toFixed(3));
      const png = Buffer.from(await page.evaluate(([ts, cols]) => window.promo.sheet(ts, cols), [times, 6]), 'base64');
      const f = join(a.outDir, `${tag}-sheet-${a.from}-${a.to}.png`);
      writeFileSync(f, png);
      log(`${f} (${times.length} pictures)`);
      return;
    }
    const first = Math.round(a.from * a.fps), last = Math.round(Math.min(a.to, TOTAL) * a.fps);
    const whole = !a.from && a.to >= TOTAL;
    const mp4 = join(a.outDir, `${tag}${whole ? '' : `-${a.from}-${a.to}`}.mp4`);
    let aud = audio;
    if (aud && !whole) {
      aud = join(a.outDir, `sound-${a.from}-${a.to}.wav`);
      await ff(['-y', '-loglevel', 'error', '-ss', String(a.from), '-to', String(a.to), '-i', audio, aud], 'its sound, cut');
    }
    const enc = encoder(mp4, { fps: a.fps, audio: aud, crf: a.crf, W: Math.round(info.W * a.scale), H: Math.round(info.H * a.scale) });
    const t0 = Date.now();
    try {
      for (let i = first; i < last; i++) {
        const jpg = Buffer.from(await page.evaluate(([k, fps, q]) => window.promo.frame(k, fps, q), [i, a.fps, a.quality]), 'base64');
        if (problems.length) throw new Error(`the page went wrong at frame ${i}: ${problems[0]}`);
        await enc.write(jpg);
        if ((i - first) % (a.fps * 2) === 0) {
          const done = i - first + 1, el = (Date.now() - t0) / 1000;
          process.stdout.write(`\r[roadmap-promo] ${(i / a.fps).toFixed(1)} s / ${(last / a.fps).toFixed(1)} s · ${(el / done * 1000).toFixed(0)} ms a frame · ${Math.round((last - i) * el / done)} s left   `);
        }
      }
      await enc.end();
    } catch (err) { enc.kill(); throw err; }
    const t = await page.evaluate(() => window.promo.times());
    console.log('');
    log(`${mp4}: ${last - first} frames in ${Math.round((Date.now() - t0) / 1000)} s (draw ${Math.round(t.draw / t.n)} ms, jpeg ${Math.round(t.encode / t.n)} ms a frame)`);
    if (whole) {
      const jpg = Buffer.from(await page.evaluate((x) => window.promo.still(x, 'image/jpeg'), COVER_AT), 'base64');
      writeFileSync(join(a.outDir, `${tag}-cover.jpg`), jpg);
      log(join(a.outDir, `${tag}-cover.jpg`));
    }
    // with her voice, a copy with its music alone (its pictures the same)
    if (whole && sound?.voiced) await remux(mp4, sound.music, join(a.outDir, `${tag}-music-only.mp4`), 256);
    if (a.light) {
      const light = join(a.outDir, `${tag}${whole ? '' : `-${a.from}-${a.to}`}-light.mp4`);
      await lighter(mp4, light, a.light, (last - first) / a.fps, aud);
      if (whole && sound?.voiced) await remux(light, sound.music, join(a.outDir, `${tag}-light-music-only.mp4`), 160);
    }
    if (aud && aud !== audio) rmSync(aud, { force: true });
  } finally {
    await page.close().catch(() => {});
  }
}

async function main() {
  const a = args(process.argv.slice(2));
  a.outDir = resolve(a.out);
  mkdirSync(a.outDir, { recursive: true });
  const whole = !a.stills && !a.sheet && !a.cards && !a.from && a.to >= TOTAL;
  if (whole) {
    writeFileSync(join(a.outDir, `${a.name}-post.txt`), `${POST}\n`);
    if (existsSync(join(HERE, 'README.txt'))) copyFileSync(join(HERE, 'README.txt'), join(a.outDir, 'README.txt'));
  }
  if (a.soundOnly) {
    if (!whole || !a.music) throw new Error('--sound-only is for the whole video, with its music');
    await soundOnly(a, await soundtrack(a.outDir, a));
    return;
  }
  const sound = !a.stills && !a.sheet && !a.cards && a.music ? await soundtrack(a.outDir, a) : null;
  const served = await serve(await buildPage());
  const browser = await openBrowser();
  try {
    await render(browser, served.url, a, sound);
  } finally {
    await browser.close().catch(() => {});
    served.server.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => { console.error(`\n[roadmap-promo] ${err.stack || err.message}`); process.exitCode = 1; });
}
