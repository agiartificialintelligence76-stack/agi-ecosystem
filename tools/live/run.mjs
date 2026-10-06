// AGI-1's live show (2026-10-02, the owner's idea: "what if she livestreams on X and reads the comments and reacts to it?
// like an automated one"). Runs on the owner's own rented server, never on Vercel: a virtual screen (Xvfb) shows her set
// (tools/live/page) in Chromium, and ffmpeg sends that screen and her voice to X Live Studio (RTMP), or to a file.
// The show itself: tools/live/show.js (what she does next), tools/live/lines.js (what she says between questions),
// tools/live/voice.js (her voice: Google Cloud), tools/live/site.js (her questions and answers: agi1.app/api/live).
//
//   node tools/live/run.mjs                          the show, now, to X (LIVE_RTMP_URL + LIVE_STREAM_KEY)
//   node tools/live/run.mjs --start-at 20:00         a "starting soon" screen until 20:00 UTC, then the show
//   node tools/live/run.mjs --record show.mp4        to a file instead of X, with made-up questions (try it first: nobody
//                                                    sees it); --with-site: agi1.app's real questions (only when no show is on)
//   node tools/live/run.mjs --demo --fake-voice --record try.mp4 --minutes 3
//                                                    no site, made-up questions, a stand-in hum: try it anywhere, free
//   node tools/live/run.mjs --check                  checks the settings, the site, her voice (writes live-check.wav)
//   node tools/live/run.mjs --owner-link             prints the owner's phone link (agi1.app/live#admin=…)
//   node tools/live/run.mjs --announce 20:00         tells agi1.app/live when her next show is (HH:MM UTC, or a date)
//   node tools/live/run.mjs --build                  only builds her set's page (the Docker image does this once)
//   node tools/live/run.mjs --sync-check             measures whether her mouth is in step with her voice on this server
//   node tools/live/run.mjs --warm                   makes every pre-written line's voice once and keeps it (once, at setup:
//                                                    about 20 minutes, at Google's pace; then even her first show never waits for Google)
// Options: --minutes 60 (LIVE_MINUTES) · --site https://www.agi1.app (SITE_URL) · --next-at 20:00 (LIVE_DAILY_AT: her next show,
// said on agi1.app/live when this one ends) · --fake-voice
// Settings (/opt/agi1-live/live.env on the server, from tools/live/live.env.example; never in git): see "Her live show on X"
// in CLAUDE.md. On the server, tools/live/live.sh runs all of this in the Docker image (tools/live/Dockerfile).
import { existsSync, createReadStream, statSync, mkdtempSync, rmSync, writeFileSync, readFileSync, renameSync } from 'node:fs';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { resolve, dirname, join, extname, sep, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir, cpus } from 'node:os';
import { talkTrack, pauses, fakeVoice, readWav, writeWav } from '../clips/audio.js';
import { timeCaptions } from '../clips/captions.js';
import { withoutSecrets } from '../clips/make.mjs';
import { adminKeyFor } from '../../server/live.js';
import { liveSite, demoSite } from './site.js';
import { voiceSettings, createVoice, RATE } from './voice.js';
import { musicSettings, loadSongs, MusicBed } from './music.js';
import * as L from './lines.js';
import { createShow, nextStep, didStep, chatLine, pickupLine, readingLine, lagLine, tipsFor, pairsFor, PACE } from './show.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const W = 1280, H = 720, FPS = 30;
const LEAD_MS = 250;                    // her voice is written this far ahead of ffmpeg (it never runs dry)
const BEAT_MS = 5000;                   // the runner tells the site what she's doing (and hears the owner) this often
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
const stamp = () => new Date().toISOString().slice(11, 19);
const log = { info: (...a) => console.log(`[live ${stamp()}]`, ...a), warn: (...a) => console.warn(`[live ${stamp()}]`, ...a), error: (...a) => console.error(`[live ${stamp()}]`, ...a) };

// her mouth ahead of the clock (ms), so it's in step with her voice in the stream: what the browser draws reaches the screen
// ffmpeg grabs a little later (measured with --sync-check on 2 cores: 170 ms). LIVE_AV_MS to change it
// where files the owner opens go (--check's live-check.wav, a --record without a folder): LIVE_OUT_DIR (the Docker image:
// /out, a folder on the server mounted there), else the folder it's run from
export const outPath = (name, env = process.env) => (isAbsolute(name) ? name : resolve(String(env.LIVE_OUT_DIR || '').trim() || '.', name));
export const avShift = (env = process.env) => (env.LIVE_AV_MS !== undefined && env.LIVE_AV_MS !== '' && Number.isFinite(Number(env.LIVE_AV_MS)) ? Number(env.LIVE_AV_MS) : 170);

// ---------- options ----------
export function parseArgs(argv, env = process.env) {
  const a = {
    record: null, minutes: Number(env.LIVE_MINUTES) || 60, startAt: env.LIVE_START_AT || null, nextAt: env.LIVE_DAILY_AT || null,
    site: env.SITE_URL || 'https://www.agi1.app', fake: false, demo: false, check: false, ownerLink: false, announce: null, build: false, syncCheck: false,
    withSite: false, warm: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--record') a.record = argv[++i];
    else if (k === '--minutes') a.minutes = Number(argv[++i]);
    else if (k === '--start-at') a.startAt = argv[++i];
    else if (k === '--next-at') a.nextAt = argv[++i];
    else if (k === '--site') a.site = argv[++i];
    else if (k === '--fake-voice') a.fake = true;
    else if (k === '--demo') a.demo = true;
    else if (k === '--check') a.check = true;
    else if (k === '--owner-link') a.ownerLink = true;
    else if (k === '--announce') a.announce = argv[++i];
    else if (k === '--build') a.build = true;
    else if (k === '--sync-check') a.syncCheck = true;
    else if (k === '--with-site') a.withSite = true;
    else if (k === '--warm') a.warm = true;
    else throw new Error(`unknown option ${k}`);
  }
  if (!(a.minutes >= 1 && a.minutes <= 240)) throw new Error('--minutes: 1 to 240');
  // a recording uses made-up questions unless asked (agi1.app's real ones would be "answered" into a file, and the site
  // would say she's live on X)
  if (a.record && !a.withSite) a.demo = true;
  return a;
}
// A show waits at most this long for --start-at ("starting soon" on X and agi1.app/live): a time further away is a mistake
// (a late start, or LIVE_DAILY_AT and the cron line apart), so it's refused instead of streaming "starting soon" all day
export const START_AHEAD_MS = 30 * 60_000;
export function startProblem(text, startAt, now = Date.now()) {
  if (!text) return null;
  if (!startAt) return `--start-at ${text}: a time like 20:00 (UTC)`;
  const ahead = startAt - now;
  if (ahead <= START_AHEAD_MS) return null;
  const h = Math.floor(ahead / 3_600_000), m = Math.round((ahead % 3_600_000) / 60_000);
  return `--start-at ${text} is ${h ? `${h} h ` : ''}${m} min away (it's ${new Date(now).toISOString().slice(11, 16)} UTC now): a show waits at most ${START_AHEAD_MS / 60_000} minutes. `
    + 'Start it now without --start-at, or check that the cron line starts it a couple of minutes before LIVE_DAILY_AT.';
}
// "20:00" (UTC) → the next time it's 20:00 UTC after `now` (within the next 24 h; a time up to 10 minutes ago: now);
// "2026-10-05T20:00Z" → that time · null
export function timeAt(text, now = Date.now(), { grace = 10 * 60_000 } = {}) {
  if (!text) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(text).trim());
  if (m) {
    const d = new Date(now);
    let t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), Number(m[1]), Number(m[2]));
    if (Number(m[1]) > 23 || Number(m[2]) > 59) return null;
    if (t < now - grace) t += 86_400_000;
    return t;
  }
  const t = Date.parse(String(text));
  return Number.isFinite(t) ? t : null;
}
// X Live Studio's server address + the stream key → where ffmpeg sends the show. (Never logged: maskUrl)
export function rtmpTarget(env = process.env) {
  const url = String(env.LIVE_RTMP_URL || '').trim(), key = String(env.LIVE_STREAM_KEY || '').trim();
  if (!/^rtmps?:\/\/[^\s]+$/i.test(url) || !key || /\s/.test(key)) return null;
  return url.endsWith('/') ? `${url}${key}` : `${url}/${key}`;
}
export const maskUrl = (text, target) => (target ? String(text).split(target).join('rtmp://[X Live Studio]/[stream key]') : String(text));

// ---------- her set's page ----------
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.moc3': 'application/octet-stream' };
export async function buildPage() {
  const { build } = await import('vite');
  const outDir = join(ROOT, 'tools/live/dist');
  await build({
    configFile: false, logLevel: 'warn', root: join(ROOT, 'tools/live/page'), publicDir: join(ROOT, 'public'), base: '/',
    build: { outDir, emptyOutDir: true, chunkSizeWarningLimit: 4000, copyPublicDir: true },
  });
  return outDir;
}
export function serve(dir) {
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = resolve(dir, `.${path === '/' ? '/index.html' : path}`);
    if (!file.startsWith(dir + sep) || !existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    createReadStream(file).pipe(res);
  });
  return new Promise((ok) => { server.listen(0, '127.0.0.1', () => ok({ server, url: `http://127.0.0.1:${server.address().port}/` })); });
}

// ---------- the virtual screen, the browser ----------
export async function startScreen() {
  for (let n = 99; n > 90; n--) {
    if (existsSync(`/tmp/.X11-unix/X${n}`)) continue;
    const xvfb = spawn('Xvfb', [`:${n}`, '-screen', '0', `${W}x${H}x24`, '-nolisten', 'tcp', '-dpi', '96'], { stdio: 'ignore' });
    let gone = false;
    xvfb.on('exit', () => { gone = true; });
    for (let i = 0; i < 50 && !gone; i++) {
      if (existsSync(`/tmp/.X11-unix/X${n}`)) return { display: `:${n}`, xvfb };
      await sleep(100);
    }
    xvfb.kill();
  }
  throw new Error('couldn\'t start the virtual screen (Xvfb): is it installed? (the Docker image has it)');
}
const BROWSERS = ['/opt/pw-browsers/chromium', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'];
export async function openBrowser(display, url) {
  let chromium;
  try { ({ chromium } = await import('playwright-core')); } catch { throw new Error('playwright-core is missing: npm install --no-save playwright-core@1.63.0'); }
  let own = null;
  try { own = chromium.executablePath(); } catch { /* not downloaded */ }
  const executablePath = [process.env.CHROME_PATH, own, ...BROWSERS].find((p) => p && existsSync(p));
  if (!executablePath) throw new Error('no Chromium found (the Docker image has one; or set CHROME_PATH)');
  const profile = mkdtempSync(join(tmpdir(), 'agi1-live-'));
  const context = await chromium.launchPersistentContext(profile, {
    headless: false, executablePath, viewport: null, env: { ...withoutSecrets(), DISPLAY: display },
    ignoreDefaultArgs: ['--enable-automation'],            // (no "controlled by automated software" bar on stream)
    // a window one pixel bigger than the screen: one exactly the screen's size gets a page 1 px narrower and shorter from
    // Chromium on a screen without a window manager (1279 × 719: a black line along the stream's right and bottom edges)
    args: [`--window-size=${W + 1},${H + 1}`, '--window-position=0,0', '--kiosk', '--start-fullscreen', '--force-device-scale-factor=1',
      // her picture: WebGL in software (no graphics card on a server), and the window put together in software too (measured
      // on 2 cores of Claude's computer: 13 frames a second with SwiftShader putting it together, 22 to 29 with this; the
      // owner's CX23 about 20 since she's drawn lighter, 2026-10-06). It misplaces what something opaque covers of her
      // picture: tools/live/page/stage.js
      '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--disable-gpu-compositing',
      '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
      '--noerrdialogs', '--disable-session-crashed-bubble', '--disable-infobars', '--hide-scrollbars', '--no-first-run',
      '--no-default-browser-check', '--disable-features=Translate,MediaRouter,OptimizationHints', '--password-store=basic'],
  });
  const page = context.pages()[0] || await context.newPage();
  const problems = [];
  page.on('pageerror', (e) => { problems.push(e.message); log.warn(`[page] ${e.message}`); });
  page.on('console', (m) => { if (m.type() === 'error') log.warn(`[page] ${m.text().slice(0, 200)}`); });
  await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
  // the window fills the screen, nothing of the browser around it
  try {
    const cdp = await context.newCDPSession(page);
    const { windowId } = await cdp.send('Browser.getWindowForTarget');
    await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'fullscreen' } });
  } catch (err) { log.warn(`couldn't make the window full screen: ${err.message}`); }
  await page.waitForFunction(() => window.studio, null, { timeout: 30_000 });
  await page.evaluate(() => window.studio.load());
  return { context, page, profile, problems };
}

// ---------- ffmpeg: the screen + her voice → X (or a file) ----------
// how hard x264 works on each picture: on a server with fewer than 4 cores, superfast (2026-10-06: the CX23's 2 cores draw
// her about 12 times a second, and every bit of processor x264 leaves goes to drawing her; a little less sharp for the same
// bits, which this flat, mostly still picture hardly shows); veryfast with 4 or more. LIVE_X264_PRESET to choose
export const X264_PRESETS = ['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium'];
export const x264Preset = (env = process.env, cores = cpus().length) => {
  const want = String(env.LIVE_X264_PRESET || '').trim().toLowerCase();
  return X264_PRESETS.includes(want) ? want : cores >= 4 ? 'veryfast' : 'superfast';
};
// Her voice goes in as raw sound, written in real time; the screen's first picture's time (ffmpeg says it: "start: …")
// lines her voice up with her mouth.
export function ffmpegArgs({ display, out, file = false, preset = x264Preset() }) {
  return ['-hide_banner', '-loglevel', 'info', '-nostats',
    '-thread_queue_size', '1024', '-f', 'x11grab', '-video_size', `${W}x${H}`, '-framerate', String(FPS), '-draw_mouse', '0', '-i', `${display}.0+0,0`,
    '-thread_queue_size', '1024', '-f', 's16le', '-ar', String(RATE), '-ac', '1', '-i', 'pipe:0',
    '-c:v', 'libx264', '-preset', preset, '-tune', 'zerolatency', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-b:v', '3000k', '-maxrate', '3000k', '-bufsize', '6000k', '-g', String(FPS * 3), '-keyint_min', String(FPS * 3), '-sc_threshold', '0',
    '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2',
    ...(file ? ['-movflags', '+frag_keyframe+empty_moov+default_base_moof', '-y', out] : ['-rw_timeout', '15000000', '-f', 'flv', out])];
}
// A recording is written as a fragmented MP4 while it's made (a show cut short still plays), then made into a standard MP4,
// with its index at the start, which every player shows properly (2026-10-06: Windows' own player showed blocks over her
// hand and her mouth in the owner's first test recording, which ffmpeg read without a single error). Nothing is encoded
// again (a copy: a few seconds for an hour); if it fails, the fragmented file stays as it was.
export async function finishRecording(file, { run = spawn } = {}) {
  if (!existsSync(file)) return false;
  const tmp = `${file}.finishing.mp4`;
  const ok = await new Promise((done) => {
    let p;
    try { p = run('ffmpeg', ['-v', 'error', '-y', '-i', file, '-map', '0', '-c', 'copy', '-movflags', '+faststart', tmp], { stdio: 'ignore', env: withoutSecrets() }); } catch { done(false); return; }
    p.on('error', () => done(false));
    p.on('exit', (code) => done(code === 0));
  });
  if (ok && existsSync(tmp) && statSync(tmp).size > 0) { renameSync(tmp, file); return true; }
  rmSync(tmp, { force: true });
  return false;
}
export function startFfmpeg({ display, out, file, target }) {
  const ff = spawn('ffmpeg', ffmpegArgs({ display, out, file }), { stdio: ['pipe', 'ignore', 'pipe'], env: withoutSecrets() });
  let text = '', startedAt = null, exited = null;
  const recent = [];                    // its last lines (the stream key masked): said when it stops on its own
  const started = new Promise((ok) => {
    ff.stderr.on('data', (d) => {
      const chunk = d.toString();
      for (const line of chunk.split('\n')) {
        const t = line.trim();
        if (t && !/update header with correct/i.test(t)) { recent.push(maskUrl(t, target).slice(0, 240)); if (recent.length > 8) recent.shift(); }
      }
      if (startedAt === null) {
        text += chunk;
        const m = /Input #0, x11grab[\s\S]*?start: ([\d.]+)/.exec(text);
        if (m) { startedAt = Number(m[1]) * 1000; ok(startedAt); text = ''; }
      } else {
        // (an FLV stream can't rewrite its header at the end: ffmpeg says so every time, harmlessly)
        for (const line of chunk.split('\n')) if (/error|fail|refused|broken|timed out|denied/i.test(line) && !/update header with correct/i.test(line)) log.warn(`[ffmpeg] ${maskUrl(line.trim(), target).slice(0, 240)}`);
      }
    });
    setTimeout(() => { if (startedAt === null) ok(null); }, 15_000);
  });
  const done = new Promise((ok) => { ff.on('exit', (code, signal) => { exited = { code, signal }; ok(exited); }); ff.on('error', (err) => { exited = { error: err.message }; ok(exited); }); });
  ff.stdin.on('error', () => {});
  return { ff, started, done, recent, at: Date.now(), get exited() { return exited; } };
}

// Her voice, written to ffmpeg in real time: silence, or the line she's saying, and her music under it (bed: a MusicBed,
// tools/live/music.js, quieter while she talks). t0: the time (this computer's clock) of the sound's first sample, so a
// line's first sample has a time the page's mouth can follow.
export class Mixer {
  constructor(write, { rate = RATE, lead = LEAD_MS, now = () => Date.now(), bed = null } = {}) {
    this.write = write; this.rate = rate; this.lead = lead; this.now = now; this.bed = bed;
    this.t0 = null; this.written = 0; this.clip = null; this.timer = null;
  }
  begin(t0 = this.now()) { this.t0 = t0; this.timer ??= setInterval(() => this.pump(), 10); this.pump(); }
  align(t0) { if (Number.isFinite(t0)) this.t0 = t0; }      // (ffmpeg said when its first picture was: her voice lines up with it)
  end() { clearInterval(this.timer); this.timer = null; if (this.clip) { this.clip.finish('cut'); this.clip = null; } }
  pump() {
    if (this.t0 === null) return;
    const target = Math.floor(((this.now() + this.lead - this.t0) * this.rate) / 1000);
    while (this.written < target) {
      const n = Math.min(target - this.written, Math.round(this.rate / 50));
      const sound = new Float32Array(n);
      const c = this.clip;
      let talking = false;
      if (c) {
        const take = Math.min(n, c.samples.length - c.pos);
        if (!c.silent) { sound.set(c.samples.subarray(c.pos, c.pos + take)); talking = true; }
        c.pos += take;
        if (c.pos >= c.samples.length) { this.clip = null; c.finish('done'); }
      }
      this.bed?.mix(sound, talking);
      const buf = Buffer.alloc(n * 2);
      for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sound[i])) * 32767), i * 2);
      this.write(buf);
      this.written += n;
    }
  }
  // → { startAt: when its first sample is heard (ms, this computer's clock), seconds, done: Promise<'done' | 'cut'> }
  play(samples, { silent = false } = {}) {
    if (this.clip) this.clip.finish('cut');
    let finish;
    const done = new Promise((ok) => { finish = ok; });
    const startAt = this.t0 + (this.written / this.rate) * 1000;
    this.clip = { samples, pos: 0, silent, finish };
    return { startAt, seconds: samples.length / this.rate, done };
  }
  stop() { if (this.clip) { const c = this.clip; this.clip = null; c.finish('cut'); } }
}

// Her pre-written lines' voices made ahead and kept (tools/live/cache), so she never waits for Google on stream: during
// "starting soon" (her first lines), and all of them with --warm (once, at setup). until: no new one after this time (ms)
// Her pre-written lines' voices, made once and kept (--warm, and before a show). At Google's pace (2026-10-06: Vertex let
// her voice model take about 10 requests a minute, then "429 resource exhausted", and the owner's first --warm made only
// 11 of 121, skipping the rest while her voice rested): a short pause after each line Google made (gapMs; kept lines
// need none), and while her voice rests after a "wait", the same line waits and is tried again (a few times) instead of
// being skipped. Never past `until`.
export const WARM_GAP_MS = 6500;
export async function warmUp(voice, lines, { until = Infinity, each = null, gapMs = 0, tries = 4, log = null,
  now = Date.now, sleep = (ms) => new Promise((done) => { setTimeout(done, ms); }) } = {}) {
  let ready = 0, i = 0;
  for (const line of lines) {
    if (now() > until) break;
    let v = null;
    for (let t = 0; t < tries; t++) {
      const wait = (voice.restingUntil?.(now()) || 0) - now();
      if (wait > 0) {
        if (now() + wait > until) break;
        log?.(`  waiting ${Math.ceil(wait / 1000)} s: Google takes about 10 a minute…`);
        await sleep(wait + 1000);
      }
      v = await voice.speak(line.text, { say: line.say, mood: line.mood, keep: true, now }).catch(() => null);
      if (v || !(voice.restingUntil?.(now()) > now())) break;     // made or kept, or a refusal that isn't "wait"
    }
    if (v) {
      ready += 1;
      if (gapMs > 0 && !/\(kept\)/.test(String(v.by || ''))) await sleep(gapMs);
    }
    each?.(++i, v);
  }
  return ready;
}

// Her body's reaction to a line's mood (src/stage/agi1-2d.js): her pre-written lines only move her face for most moods (a
// hop and hearts on every "happy" line would be a lot for an hour); her answers to questions react fully.
const REACT = { wave: 'wave', love: 'love', shy: 'shy', sweet: 'love', careful: 'okay', pout: 'jealous', sad: 'sad', celebrate: 'celebrate', worried: 'worried' };
export const reactFor = (mood, { answer = false } = {}) => (answer && ['happy', 'love', 'shy', 'wave'].includes(mood) ? mood : REACT[mood] || 'neutral');

// ---------- the show ----------
async function runShow(a) {
  const target = a.record ? null : rtmpTarget();
  if (!a.record && !target) throw new Error('LIVE_RTMP_URL and LIVE_STREAM_KEY are missing (X Live Studio → Sources), or use --record file.mp4');
  const startAt = timeAt(a.startAt);
  const late = startProblem(a.startAt, startAt);
  if (late) throw new Error(late);
  const site = a.demo ? demoSite() : liveSite({ site: a.site, secret: process.env.LIVE_SECRET, log });
  if (a.record && !a.demo) {
    const now = await site.status().catch(() => null);
    if (now?.on) throw new Error('a show is on right now: a recording with --with-site would take over agi1.app/live from it. Try again when it has ended.');
  }
  const voice = createVoice(voiceSettings(process.env, { fake: a.fake }), { log });
  if (!voice.order.length) throw new Error('no way to make her voice: set GOOGLE_APPLICATION_CREDENTIALS (or LIVE_GCP_API_KEY), or use --fake-voice');
  log.info(`her voice: ${voice.order.join(' → ')} · the site: ${site.base} · ${a.record ? `recording to ${outPath(a.record)}` : 'streaming to X'} · ${a.minutes} minutes`);
  if (a.record && a.demo && !process.argv.includes('--demo')) log.info('(a recording uses made-up questions: --with-site for agi1.app\'s real ones, only when no show is on)');

  const dist = existsSync(join(ROOT, 'tools/live/dist/index.html')) && !process.env.LIVE_REBUILD ? join(ROOT, 'tools/live/dist') : await buildPage();
  const served = await serve(dist);
  // her picture's own size: 720 × 720 with 4 cores or more, 540 below (LIVE_GL to choose)
  const gl = Number(process.env.LIVE_GL) || (cpus().length >= 4 ? 720 : 540);
  served.url = `${served.url}?gl=${gl}`;
  const screen = await startScreen();
  let browser = null, ffm = null, mixer = null, beatTimer = null, show = null, stopping = false;
  const cleanup = async () => {
    stopping = true;                                           // (ffmpeg is never started again from here)
    clearInterval(beatTimer);
    mixer?.end();
    if (ffm && !ffm.exited) {
      // the sound ends, then ffmpeg finishes cleanly (X ends the broadcast when the stream stops)
      try { ffm.ff.stdin.end(); ffm.ff.kill('SIGINT'); } catch { /* gone */ }
      await Promise.race([ffm.done, sleep(20_000)]);
      if (!ffm.exited) ffm.ff.kill('SIGKILL');
    }
    await browser?.context.close().catch(() => {});
    if (browser?.profile) rmSync(browser.profile, { recursive: true, force: true });
    screen.xvfb.kill();
    served.server.close();
    if (a.record && ffm) {
      if (await finishRecording(outPath(a.record))) log.info(`the recording: ${outPath(a.record)}`);
      else log.warn(`the recording stays a fragmented MP4 (some players show it badly; VLC plays it): ${outPath(a.record)}`);
    }
  };
  let interrupt = null;           // the line she's saying: interrupt('pause' | 'skip' | 'stop') cuts it
  let brbLine = false;            // (her "be right back" itself is never cut by the pause it's for)
  const onSignal = () => { if (!stopping) { stopping = true; log.info('stopping (asked to)…'); interrupt?.('stop'); } };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);
  try {
    browser = await openBrowser(screen.display, served.url);
    const studio = (fn, arg) => browser.page.evaluate(([f, x]) => window.studio[f](x), [fn, arg]).catch((err) => { log.warn(`[page] ${fn}: ${err.message.split('\n')[0]}`); });
    // her diary, for its segment
    const diary = L.diaryLines(await site.diary());
    // her music (tools/live/music.js): made once and kept on disk, so only the first show waits a few seconds for it
    const ms = musicSettings();
    const music = ms.on && ms.volume > 0
      ? new MusicBed(loadSongs(voice.settings.cacheDir, { log }), { volume: ms.volume, seed: Math.floor(Date.now() / 86_400_000) })
      : null;
    if (music) log.info(`her music: ${music.tracks.length} songs, volume ${Math.round(ms.volume * 100)}%`);
    // ffmpeg, and her voice's clock lined up with its first picture
    const out = a.record ? outPath(a.record) : target;
    let restarts = 0;
    const startStream = async () => {
      ffm = startFfmpeg({ display: screen.display, out, file: Boolean(a.record), target });
      mixer?.end();
      mixer = new Mixer((buf) => { if (!ffm.exited) ffm.ff.stdin.write(buf); }, { bed: music });
      mixer.begin();
      const first = await ffm.started;
      if (first) mixer.align(first);
      else log.warn('ffmpeg didn\'t say when it started: her mouth may be a little off her voice');
      const mine = ffm;
      mine.done.then((x) => {
        if (stopping) return;
        if (Date.now() - mine.at > 5 * 60_000) restarts = 0;      // (it ran a good while: a new hiccup, not the same one)
        log.error(`ffmpeg stopped (${JSON.stringify(x)}) ${restarts < 5 ? ': starting it again' : ': giving up'}${mine.recent.length ? `. it said:\n  ${mine.recent.join('\n  ')}` : ''}`);
        if (restarts++ < 5) setTimeout(() => { if (!stopping) startStream().catch((err) => log.error(err.message)); }, 2000);
        else stopping = true;
      });
    };
    await startStream();
    await studio('shift', avShift());

    // the site: a new show, and the owner's controls every few seconds
    const now0 = Date.now();
    const begins = startAt && startAt > now0 + 5000 ? startAt : now0;
    let started;
    try { started = await site.start(begins > now0 ? 'starting' : 'live'); } catch (err) { throw new Error(`the site refused to start the show: ${err.message}${err.status === 401 ? ' (LIVE_SECRET isn\'t the same as in Vercel)' : err.status === 503 ? ' (LIVE_SECRET or supabase/live.sql missing on the site?)' : ''}`); }
    const showId = started.show;
    log.info(`show ${showId}: ${begins > now0 ? `starting at ${new Date(begins).toISOString()}` : 'starting now'}`);
    const controls = { paused: false, closed: false, end: false, waiting: 0, skipped: new Set(), failures: 0 };
    const state = { status: begins > now0 ? 'starting' : 'live', segment: begins > now0 ? 'starting' : 'intro', onAir: null };
    const beat = async () => {
      try {
        const r = await site.beat(showId, state.status, state.segment, state.onAir);
        if (r?.ok === false && r.why === 'old_show') { log.error('another show started on the site: this one stops'); stopping = true; return; }
        controls.paused = r.paused === true; controls.closed = r.closed === true; controls.end = r.end === true;
        controls.waiting = Number(r.waiting) || 0;
        for (const id of Array.isArray(r.skipped) ? r.skipped : []) controls.skipped.add(id);
        controls.failures = 0;
        if (controls.paused && interrupt && !brbLine && state.status !== 'ending' && !controls.end) interrupt('pause');
        if (state.onAir && controls.skipped.has(state.onAir) && interrupt) interrupt('skip');
        await studio('queue', controls.waiting);
      } catch (err) {
        if (++controls.failures === 3) log.warn(`the site isn't answering (${err.message}): she keeps going without new questions`);
      }
    };
    beatTimer = setInterval(beat, BEAT_MS);
    await beat();

    // saying one line: her voice (kept on disk when it's pre-written), her captions, her mouth, a reaction
    const say = async (line, { keep = true, audio = undefined, react = undefined } = {}) => {
      if (stopping) return 'cut';
      const voiced = audio !== undefined ? audio : await voice.speak(line.text, { say: line.say, mood: line.mood, keep });
      const samples = voiced?.samples || readWav(fakeVoice(line.say || line.text)).samples;     // (no voice: she says it silently)
      const env = Array.from(talkTrack(samples, RATE, 50), (x) => Math.round(x * 100) / 100);
      const cues = timeCaptions(line.text, pauses(samples, RATE));
      const play = mixer.play(samples, { silent: !voiced });
      await studio('say', { startAt: play.startAt, step: 20, env, cues, seconds: play.seconds, react: react === undefined ? reactFor(line.mood) : react });
      const result = await Promise.race([play.done, new Promise((ok) => { interrupt = ok; })]);
      interrupt = null;
      if (result !== 'done') { mixer.stop(); await studio('stop'); }
      return result;
    };

    // "starting soon": until it's time (she's there, idle; questions can already come in). Meanwhile her first lines' voices
    // are made (when they aren't kept yet), so her intro never waits for Google. The owner's "end" cancels the show.
    if (begins > Date.now()) {
      await browser.page.evaluate(([at]) => window.studio.overlay('starting', { sub: 'Ask me at agi1.app/live', untilMs: at }), [begins]);
      warmUp(voice, [...L.INTRO, ...L.READING, L.BRB.start, L.BRB.back, ...L.LAG, ...L.OUTRO], { until: begins - 5000, gapMs: WARM_GAP_MS }).catch(() => {});
      while (Date.now() < begins && !stopping && !controls.end) await sleep(500);
    }
    if (controls.end && !stopping) {
      log.info('the owner ended it before it started');
      await browser.page.evaluate(() => window.studio.overlay('ended', { sub: 'Next show: agi1.app/live' }));
      music?.fadeOut();
      await sleep(4000);
      stopping = true;
    }
    await browser.page.evaluate(() => window.studio.overlay(null));
    await studio('start', Date.now());
    show = createShow({ start: Date.now(), minutes: a.minutes, diary: Boolean(diary), seed: Math.floor(Date.now() / 86_400_000) });
    state.status = 'live';

    // her next question, ready before she needs it (asked while she's saying something else). When her answers don't come
    // (the AI is down or the site away), questions wait a while (30 s, then longer, at most 5 minutes) and she says so once,
    // instead of trying again and again in silence.
    let prepared = null, held = null;                    // held: the question she was answering when the stream started again
    const ai = { trouble: 0, until: 0, said: false };
    const troubled = (why) => {
      ai.trouble += 1;
      ai.until = Date.now() + Math.min(300_000, 30_000 * 2 ** (ai.trouble - 1));
      log.warn(`her answers aren't coming (${why}): questions wait ${Math.round((ai.until - Date.now()) / 1000)} s`);
    };
    const holding = () => Date.now() < ai.until;
    const prepare = () => {
      if (prepared || controls.paused || stopping || holding()) return;
      prepared = (async () => {
        const r = await site.next(showId);
        if (!r?.question) { if (r?.trouble) troubled(r.trouble); return null; }
        if (ai.trouble) log.info('her answers are back');
        ai.trouble = 0; ai.said = false;
        const audio = await voice.speak(r.reply, { mood: r.mood, keep: false });
        return { ...r, audio };
      })().catch((err) => { troubled(err.message); return null; });
    };
    // a question she had ready when the owner paused her: back in line (if the site can't be told, she keeps it for after)
    const putBack = async (qa) => {
      try { await site.back(showId, qa.question.id); } catch (err) { log.warn(`couldn't put a question back in line: ${err.message}`); held = qa; }
    };
    const takePrepared = () => {
      if (!prepared) prepare();
      const p = prepared || Promise.resolve(null);
      prepared = null;
      return p;
    };

    // the segments
    const segment = async (id) => {
      const seg = L.SEGMENTS[id];
      state.segment = id;
      if (id === 'diary' && diary) {
        await studio('card', { kind: 'diary', kicker: `Her diary · ${new Date(`${diary.day}T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })}`, body: diary.entry });
        for (const line of diary.lines) { if ((await say(line, { keep: line !== diary.lines[1] })) !== 'done') break; await sleep(350); }
      } else if (id === 'tips') {
        await say(seg.intro);
        const tips = tipsFor(show, 3);
        for (const [n, tip] of tips.entries()) {
          await studio('card', { kind: 'segment', kicker: seg.card.kicker, title: `Tip ${n + 1}`, body: tip });
          if ((await say(L.tipLine(tip, n))) !== 'done') break;
          await sleep(500);
        }
      } else if (id === 'wyr') {
        await say(seg.intro);
        for (const pair of pairsFor(show, 2)) {
          const [ask, answer] = L.wyrLines(pair);
          await studio('card', { kind: 'wyr', kicker: seg.card.kicker, title: 'Would you rather…', list: [pair[0], pair[1]] });
          if ((await say(ask)) !== 'done') break;
          await sleep(900);
          await studio('pick', answer.pick);
          if ((await say(answer)) !== 'done') break;
          await sleep(600);
        }
      } else {
        await studio('card', { kind: 'segment', ...seg.card });
        for (const line of seg.lines) { if ((await say(line)) !== 'done') break; await sleep(300); }
      }
      await sleep(800);
      await studio('card', null);
      state.segment = 'questions';
    };

    // a question: its card, she reads it (looks at it), her answer
    const question = async (qa) => {
      if (controls.skipped.has(qa.question.id)) { return false; }
      const from = qa.question.source === 'telegram' ? (qa.question.name || 'someone on Telegram') : (qa.question.name || 'someone');
      state.segment = 'questions';
      state.onAir = qa.question.id;
      beat();
      await studio('card', { kind: 'question', kicker: `Question · from ${from}`, body: qa.question.text });
      await studio('look', 'card');
      await sleep(1800);
      await studio('look', 'you');
      if (controls.skipped.has(qa.question.id)) {          // (the owner skipped it meanwhile)
        state.onAir = null;
        await studio('card', null);
        await site.done(showId, qa.question.id, 'skipped', 'owner').catch(() => {});
        return true;
      }
      if (controls.paused) { state.onAir = null; await studio('card', null); await putBack(qa); return true; }   // (after her break)
      const r = await say({ text: qa.reply, mood: qa.mood }, { keep: false, audio: qa.audio ?? null, react: reactFor(qa.mood, { answer: true }) });
      state.onAir = null;
      // done: answered · the owner's skip: skipped · a pause: back in line (answered fresh after the break, however long it
      // is) · the stream starting again: she answers it again at once · the show stopping: it ended before she could
      if (r === 'pause') await putBack(qa);
      else if (r === 'cut') held = qa;
      else {
        try {
          if (r === 'done') await site.done(showId, qa.question.id, 'answered');
          else await site.done(showId, qa.question.id, 'skipped', r === 'skip' ? 'owner' : 'ended');
        } catch (err) { log.warn(`couldn't mark a question done: ${err.message}`); }
      }
      await sleep(700);
      await studio('card', null);
      return true;
    };

    // the loop
    let lastFps = Date.now();
    while (!stopping) {
      if (Date.now() - lastFps > 60_000) {
        lastFps = Date.now();
        const s = await browser.page.evaluate(() => window.studio.stats()).catch(() => null);
        if (s) log.info(`her set draws ${s.fps} frames a second · ${show.answered} answered · ${controls.waiting} waiting`);
      }
      const now = Date.now();
      // (a hard stop: a show never runs on far past its length, whatever happens)
      if (now > show.endsAt + 5 * 60_000) { log.warn('past the show\'s end: stopping'); break; }
      // the question she was answering when the owner paused her (or the stream started again): again, from the top
      if (held && !controls.paused && !controls.end && now < show.endsAt - PACE.OUTRO_MS) {
        const qa = held;
        held = null;
        await question(qa);
        didStep(show, { kind: 'question' }, Date.now());
        continue;
      }
      const hold = holding();
      if (hold && controls.waiting > 0 && !ai.said && !controls.paused && !controls.end) {
        ai.said = true;
        state.segment = 'chat';
        await say(lagLine(show));
        continue;
      }
      const step = nextStep(show, { now, waiting: hold ? 0 : controls.waiting + (prepared ? 1 : 0), paused: controls.paused, end: controls.end, holding: hold && controls.waiting > 0 });
      if (step.kind === 'end') break;
      if (step.kind === 'brb') {
        state.status = 'brb'; state.segment = 'brb';
        // the question she had ready goes back in line meanwhile (a long break would make it stale)
        if (prepared) { const p = prepared; prepared = null; p.then((qa) => { if (qa?.question) putBack(qa); }); }
        await studio('card', null);
        await browser.page.evaluate(() => window.studio.overlay('brb', { sub: 'Ask me at agi1.app/live' }));
        brbLine = true;
        await say(L.BRB.start);
        brbLine = false;
        // (until the owner resumes her, ends the show, or its time is up)
        while (controls.paused && !controls.end && Date.now() < show.endsAt - PACE.OUTRO_MS && !stopping) await sleep(1000);
        await browser.page.evaluate(() => window.studio.overlay(null));
        state.status = 'live';
        if (!stopping && !controls.end && Date.now() < show.endsAt - PACE.OUTRO_MS) await say(L.BRB.back);
        continue;
      }
      if (step.kind === 'intro') {
        state.segment = 'intro';
        for (const line of L.INTRO) { if ((await say(line)) !== 'done') break; await sleep(400); }
      } else if (step.kind === 'outro') {
        state.status = 'ending'; state.segment = 'outro';
        await beat();
        for (const line of L.OUTRO) { if ((await say(line)) !== 'done') break; await sleep(400); }
        await browser.page.evaluate(() => window.studio.overlay('ended', { sub: 'Next show: agi1.app/live' }));
        music?.fadeOut();
        await sleep(6000);
      } else if (step.kind === 'question') {
        // her answer is usually ready; when it isn't yet, she says she's reading it meanwhile
        const p = takePrepared();
        let qa = await Promise.race([p, sleep(3000).then(() => 'slow')]);
        if (qa === 'slow') { state.segment = 'questions'; await say(readingLine(show)); qa = await p; }
        if (!qa) { controls.waiting = 0; await sleep(1500); continue; }
        prepare();                                           // (the one after, while she answers this one)
        if (!(await question(qa))) continue;
      } else if (step.kind === 'segment') {
        if (controls.waiting > 0) prepare();
        await segment(step.id);
      } else if (step.kind === 'pickup') {
        state.segment = 'chat';
        await say(pickupLine(show));
      } else if (step.kind === 'chat') {
        state.segment = 'chat';
        await say(chatLine(show));
      } else if (step.kind === 'wait') {
        state.segment = 'chat';
        if (controls.waiting > 0) prepare();
        const until = Date.now() + step.ms;
        while (Date.now() < until && !controls.paused && !controls.end && !stopping && !(controls.waiting > 0 && !prepared && !holding())) await sleep(250);
        continue;
      }
      didStep(show, step, Date.now());
    }
    // the end: the site hears it (and when her next show is), the stream stops cleanly (X ends the broadcast)
    const next = timeAt(a.nextAt, Date.now() + 60 * 60_000);
    try { await site.stop(showId, next && next > Date.now() ? next : null); } catch (err) { log.warn(`couldn't tell the site the show ended: ${err.message}`); }
    if (prepared) { const qa = await prepared.catch(() => null); if (qa?.question) await site.done(showId, qa.question.id, 'skipped', 'ended').catch(() => {}); }
    if (held) await site.done(showId, held.question.id, 'skipped', 'ended').catch(() => {});
    log.info(`show ${showId} ended: ${show.answered} questions answered, ${show.segmentsDone} segments`);
    return { answered: show.answered, segments: show.segmentsDone, problems: browser.problems.length };
  } finally {
    await cleanup();
  }
}

// ---------- --sync-check: is her mouth in step with her voice on this server? ----------
// A short recording: six beeps, each with a white square in the corner of her set at the moment it should be heard; then
// the recording is read back and the difference measured. LIVE_AV_MS moves her mouth (and the square) earlier (+) or later.
export function beep(seconds = 0.12, rate = RATE) {
  const n = Math.round(seconds * rate), out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = 0.6 * Math.sin((2 * Math.PI * 1000 * i) / rate);
  return out;
}
// when each beep starts in a recording's sound (seconds): the first loud sample after a quiet stretch
export function audioOnsets(samples, rate, { level = 0.2, quiet = 0.5 } = {}) {
  const out = [];
  let lastLoud = -Infinity;
  for (let i = 0; i < samples.length; i++) {
    if (Math.abs(samples[i]) < level) continue;
    if (i / rate - lastLoud > quiet) out.push(i / rate);
    lastLoud = i / rate;
  }
  return out;
}
// when the white square shows in a recording's pictures (seconds): brightness of the corner, frame by frame
export function videoOnsets(levels, fps, { level = 200 } = {}) {
  const out = [];
  for (let i = 0; i < levels.length; i++) if (levels[i] >= level && !(levels[i - 1] >= level)) out.push(i / fps);
  return out;
}
// the sound minus the picture, in ms, each beep with its square (the nearest one within half a second) → { ms, pairs }
export function syncOffset(audio, video) {
  const diffs = [];
  for (const t of video) {
    const a = audio.reduce((best, x) => (Math.abs(x - t) < Math.abs(best - t) ? x : best), Infinity);
    if (Math.abs(a - t) < 0.5) diffs.push((a - t) * 1000);
  }
  diffs.sort((x, y) => x - y);
  return { ms: diffs.length ? Math.round(diffs[Math.floor(diffs.length / 2)]) : null, pairs: diffs.length };
}
const decode = (args) => new Promise((ok, fail) => {
  const p = spawn('ffmpeg', ['-v', 'error', ...args], { stdio: ['ignore', 'pipe', 'inherit'], env: withoutSecrets() });
  const chunks = [];
  p.stdout.on('data', (d) => chunks.push(d));
  p.on('error', fail);
  p.on('exit', (code) => (code === 0 ? ok(Buffer.concat(chunks)) : fail(new Error(`ffmpeg exit ${code}`))));
});
async function syncCheck() {
  const dist = existsSync(join(ROOT, 'tools/live/dist/index.html')) ? join(ROOT, 'tools/live/dist') : await buildPage();
  const served = await serve(dist);
  const gl = Number(process.env.LIVE_GL) || (cpus().length >= 4 ? 720 : 540);
  const screen = await startScreen();
  const file = join(tmpdir(), `agi1-sync-${process.pid}.mp4`);
  const shift = avShift();
  let browser = null, ffm = null, mixer = null;
  try {
    browser = await openBrowser(screen.display, `${served.url}?gl=${gl}`);
    await browser.page.evaluate((x) => { window.studio.overlay(null); window.studio.shift(x); }, shift);
    ffm = startFfmpeg({ display: screen.display, out: file, file: true });
    mixer = new Mixer((buf) => { if (!ffm.exited) ffm.ff.stdin.write(buf); });
    mixer.begin();
    const first = await ffm.started;
    if (first) mixer.align(first);
    await sleep(2500);
    for (let i = 0; i < 6; i++) {
      const play = mixer.play(beep());
      await browser.page.evaluate((at) => window.studio.marker(at), play.startAt);
      await sleep(1600);
    }
    await sleep(1500);
  } finally {
    mixer?.end();
    if (ffm && !ffm.exited) { ffm.ff.stdin.end(); ffm.ff.kill('SIGINT'); await Promise.race([ffm.done, sleep(20_000)]); }
    await browser?.context.close().catch(() => {});
    if (browser?.profile) rmSync(browser.profile, { recursive: true, force: true });
    screen.xvfb.kill();
    served.server.close();
  }
  const pcm = await decode(['-i', file, '-map', '0:a', '-ac', '1', '-ar', '8000', '-f', 's16le', 'pipe:1']);
  const raw = await decode(['-i', file, '-map', '0:v', '-vf', 'crop=32:32:4:4,scale=1:1', '-f', 'rawvideo', '-pix_fmt', 'gray', 'pipe:1']);
  rmSync(file, { force: true });
  const audio = audioOnsets(Array.from({ length: pcm.length / 2 }, (_, i) => pcm.readInt16LE(i * 2) / 32768), 8000);
  const video = videoOnsets([...raw], FPS);
  const r = syncOffset(audio, video);
  if (r.ms === null) { console.log(`couldn't measure it (${audio.length} beeps heard, ${video.length} squares seen): try again`); process.exitCode = 1; return r; }
  const late = r.ms > 0;
  console.log(`her voice is ${Math.abs(r.ms)} ms ${late ? 'behind' : 'ahead of'} her mouth (${r.pairs} beeps measured, LIVE_AV_MS=${shift} now).`);
  console.log(Math.abs(r.ms) <= 40 ? 'that\'s in step: nothing to change.' : `set LIVE_AV_MS=${shift - r.ms} in live.env, then run --sync-check again.`);
  return r;
}

// ---------- --check, --owner-link, --announce ----------
// Does the site take this server's LIVE_SECRET? A beat for a show that can never be on (the site answers "old_show" and
// changes nothing; a wrong key gets 401). Before 2026-10-06 it sent show 0, which the site refuses as a bad request (400)
// before it looks: the owner's first --check said NO with the right key.
export const PROBE_SHOW = Number.MAX_SAFE_INTEGER;
export async function secretAccepted(site) {
  try {
    const r = await site.beat(PROBE_SHOW, 'live', null, null);
    return { ok: r?.ok === true || r?.why === 'old_show', why: String(r?.why || '') };
  } catch (err) {
    // a 400 only comes after the key was taken (the runner's own checks); 401 is a wrong key; anything else, the site
    return { ok: err.status === 400, why: err.message };
  }
}

async function check(a) {
  const ok = (c, m) => { console.log(`${c ? 'ok  ' : 'NO  '} ${m}`); return c; };
  let good = true;
  for (const [cmd, args] of [['ffmpeg', ['-version']], ['Xvfb', ['-help']]]) {
    const r = await new Promise((done) => { const p = spawn(cmd, args, { stdio: 'ignore' }); p.on('error', () => done(false)); p.on('exit', () => done(true)); });
    good = ok(r, `${cmd} is installed`) && good;
  }
  try { await import('playwright-core'); ok(true, 'playwright-core is installed'); } catch { good = ok(false, 'playwright-core is installed (npm install --no-save playwright-core@1.63.0)') && false; }
  good = ok(Boolean(rtmpTarget()), 'LIVE_RTMP_URL and LIVE_STREAM_KEY (X Live Studio → Sources)') && good;
  try {
    const site = liveSite({ site: a.site, secret: process.env.LIVE_SECRET, log });
    const s = await site.status();
    good = ok(s.ready === true, `${site.base}/api/live is set up${s.ready ? '' : ' (LIVE_SECRET in Vercel, and supabase/live.sql run?)'}`) && good;
    const k = await secretAccepted(site);
    good = ok(k.ok, `the site accepts this server's LIVE_SECRET${k.ok ? '' : ` (${k.why})`}`) && good;
  } catch (err) { good = ok(false, err.message) && false; }
  const voice = createVoice(voiceSettings(process.env, { fake: a.fake }), { log: { warn: (m) => console.log(`     ${m}`) } });
  good = ok(voice.order.length > 0, `a way to make her voice: ${voice.order.join(' → ') || 'none (GOOGLE_APPLICATION_CREDENTIALS or LIVE_GCP_API_KEY)'}`) && good;
  if (voice.order.length) {
    const t0 = Date.now();
    const v = await voice.speak("hi, it's AGI-1. checking my voice for my live show 💜", { mood: 'wave' });
    const wav = outPath('live-check.wav');
    if (ok(Boolean(v), `her voice works${v ? ` (${v.by}, ${(v.samples.length / RATE).toFixed(1)} s, made in ${((Date.now() - t0) / 1000).toFixed(1)} s)` : ''}`)) {
      try { writeFileSync(wav, writeWav(v.samples, RATE)); console.log(`     listen to it: ${wav}`); } catch (err) { console.log(`     (couldn't save it to ${wav}: ${err.code || err.message})`); }
    } else good = false;
  }
  console.log(good ? '\nall set ✓' : '\nsomething above needs fixing');
  process.exitCode = good ? 0 : 1;
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  if (a.ownerLink) {
    const secret = String(process.env.LIVE_SECRET || '');
    if (secret.length < 32) throw new Error('LIVE_SECRET is missing or shorter than 32 characters');
    console.log(`${String(a.site).replace(/\/+$/, '')}/live#admin=${adminKeyFor(secret)}\n(keep it to yourself: whoever has it can pause or end her show)`);
    return;
  }
  if (a.build) { console.log(`built ${await buildPage()}`); return; }
  if (a.warm) {
    const voice = createVoice(voiceSettings(process.env, { fake: a.fake }), { log });
    if (!voice.order.length) throw new Error('no way to make her voice: set GOOGLE_APPLICATION_CREDENTIALS (or LIVE_GCP_API_KEY)');
    const lines = L.allLines(), t0 = Date.now();
    if (musicSettings().on) { console.log('making her music (the songs already kept are skipped)…'); loadSongs(voice.settings.cacheDir, { log }); }
    console.log(`making her ${lines.length} pre-written lines' voices at Google's pace, about 8 a minute (the ones already kept are skipped)…`);
    // (at Google's pace: about 8 a minute, so 121 lines take about 17 minutes; never more than an hour)
    const ready = await warmUp(voice, lines, { gapMs: WARM_GAP_MS, until: Date.now() + 60 * 60_000, log: (m) => console.log(m),
      each: (i) => { if (i % 10 === 0) console.log(`  ${i} of ${lines.length}`); } });
    console.log(`${ready} of ${lines.length} ready, kept for every show (${Math.round((Date.now() - t0) / 1000)} s)${ready < lines.length ? ': run it again later for the rest' : ''}`);
    process.exitCode = ready === lines.length ? 0 : 1;
    return;
  }
  if (a.syncCheck) { await syncCheck(); return; }
  if (a.check) { await check(a); return; }
  if (a.announce) {
    const t = timeAt(a.announce);
    if (!t) throw new Error('--announce: a time like 20:00 (UTC) or 2026-10-05T20:00Z');
    await liveSite({ site: a.site, secret: process.env.LIVE_SECRET, log }).schedule(t);
    console.log(`agi1.app/live now says her next show is ${new Date(t).toISOString()}`);
    return;
  }
  const r = await runShow(a);
  if (r.problems) log.warn(`the page reported ${r.problems} problem(s): see above`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => { log.error(err.message); process.exitCode = 1; });
}
