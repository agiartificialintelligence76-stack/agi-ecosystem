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
// said on agi1.app/live when this one ends) · --fake-voice · --try song,dance,room (2026-10-07: these extras first, one about
// every 45 s, to see them on a recording: dance, room, post, outfit, market, song, replies, video; and since the trips, eat,
// weather, meet, trip)
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
import { musicSettings, loadSongs, MusicBed, DANCE_SONGS } from './music.js';
import * as L from './lines.js';
import { createShow, nextStep, didStep, chatLine, pickupLine, readingLine, lagLine, tipsFor, pairsFor, poolFor, pickFrom, PACE, EXTRA_IDS } from './show.js';
// (2026-10-07, the owner's stream upgrade: viewers' requests, her song, her videos and X posts, $AGI on stream)
import { createActs, DOES, actMs, roomFor, outfitFor, nextRoom, nextOutfit } from './acts.js';
import { BIG_DANCES } from './page/moves.js';
import { readSong, partOf, decodeSong, songGain } from './song.js';
import { listVideos, prepareVideo, download, toStereo, tidyMedia, MEDIA_NAME } from './media.js';
import { xSettings, createX } from './x.js';
import { OUTFITS as OUTFIT_NAMES, ROOMS as ROOM_NAMES } from '../../server/live-acts.js';
import { fmtCompact, fmtPct } from '../../src/prices/parse.js';
// (2026-10-07, the owner's next list: real places, vehicles, people she meets, food, the Moon and Mars, more emotions, her 16
// languages on stream, the weather, the start of her show, the sounds around her)
import * as T from './trips.js';
import { PLACES } from './page/places.js';
import { FOODS as FOOD_DEFS } from './page/food.js';
import { loop as ambLoop, shot as ambShot, LOOP_GAIN } from './ambience.js';
import { langOf } from '../../src/i18n/langs.js';

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
export function parseArgs(argv, env = process.env, now = Date.now()) {
  const a = {
    record: null, minutes: Number(env.LIVE_MINUTES) || 60, startAt: env.LIVE_START_AT || null, nextAt: env.LIVE_DAILY_AT || null,
    site: env.SITE_URL || 'https://www.agi1.app', fake: false, demo: false, check: false, ownerLink: false, announce: null, build: false, syncCheck: false,
    withSite: false, warm: false, tryExtras: [], art: false, artOnly: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--record') a.record = argv[++i];
    else if (k === '--minutes') a.minutes = Number(argv[++i]);
    else if (k === '--start-at') a.startAt = argv[++i];
    else if (k === '--start-in') {
      // (2026-10-07, the owner goes live at random times: "starting soon" for this many minutes, then the show; no UTC sums)
      const raw = String(argv[++i] ?? '').trim();
      const n = /^\d+(\.\d+)?$/.test(raw) ? Number(raw) : NaN;
      if (!(n >= 0 && n <= START_AHEAD_MS / 60_000)) throw new Error(`--start-in: 0 to ${START_AHEAD_MS / 60_000} minutes (like --start-in 10)`);
      a.startAt = new Date(now + Math.round(n * 60_000)).toISOString();
    }
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
    // (2026-10-07) the pictures of her set, painted by Google's image AI (tools/live/art.mjs): every one not made yet, or
    // one more of each named
    else if (k === '--art') a.art = true;
    else if (k === '--art-only') {
      a.art = true;
      a.artOnly = String(argv[++i] ?? '').split(',').map((x) => x.trim()).filter(Boolean);
      if (!a.artOnly.length) throw new Error('--art-only: the pictures to make again, like --art-only paris,omar');
    }
    else if (k === '--try') {
      // (2026-10-07) these extras first, soon after the intro, one about every 45 s: to see them on a recording
      const list = String(argv[++i] ?? '').split(',').map((x) => x.trim()).filter(Boolean);
      // (2026-10-07) and "trip": a trip by herself soon after the intro
      if (!list.length || list.some((x) => !EXTRA_IDS.includes(x) && x !== 'trip')) throw new Error(`--try: some of ${EXTRA_IDS.join(', ')}, trip (like --try song,dance)`);
      a.tryExtras = list;
    }
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
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.moc3': 'application/octet-stream',
  '.webm': 'video/webm', '.jpg': 'image/jpeg' };
export async function buildPage() {
  const { build } = await import('vite');
  const outDir = join(ROOT, 'tools/live/dist');
  await build({
    configFile: false, logLevel: 'warn', root: join(ROOT, 'tools/live/page'), publicDir: join(ROOT, 'public'), base: '/',
    build: { outDir, emptyOutDir: true, chunkSizeWarningLimit: 4000, copyPublicDir: true },
  });
  return outDir;
}
// (2026-10-07) and /media/<name>: her videos and pictures made ready for her TV (tools/live/media.js), only those files
// (24 hex characters, .webm, .jpg, .png or .webp), with ranges (the browser asks for a video in pieces)
export function serve(dir, { media = null } = {}) {
  const server = createServer((req, res) => {
    let path;
    try { path = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400).end(); return; }
    if (path.startsWith('/media/')) {
      const name = path.slice(7);
      const file = media && MEDIA_NAME.test(name) ? join(media, name) : null;
      if (!file || !existsSync(file)) { res.writeHead(404).end(); return; }
      const size = statSync(file).size;
      const type = TYPES[extname(file)] || 'application/octet-stream';
      const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
      if (m && size > 0) {
        const start = m[1] === '' ? Math.max(0, size - Number(m[2])) : Number(m[1]);
        const end = m[1] !== '' && m[2] !== '' ? Math.min(size - 1, Number(m[2])) : size - 1;
        if (!(start <= end && start < size)) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }).end(); return; }
        res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' });
        createReadStream(file, { start, end }).pipe(res);
        return;
      }
      res.writeHead(200, { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' });
      createReadStream(file).pipe(res);
      return;
    }
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
// lines her voice up with her mouth. (2026-10-07: 48 kHz stereo, as it goes out: her song and her videos' sound as they
// are; her voice and her music, made at 24 kHz, are made twice as fine by the Mixer on the way)
export const OUT_RATE = 48000;
export function ffmpegArgs({ display, out, file = false, preset = x264Preset() }) {
  return ['-hide_banner', '-loglevel', 'info', '-nostats',
    '-thread_queue_size', '1024', '-f', 'x11grab', '-video_size', `${W}x${H}`, '-framerate', String(FPS), '-draw_mouse', '0', '-i', `${display}.0+0,0`,
    '-thread_queue_size', '1024', '-f', 's16le', '-ar', String(OUT_RATE), '-ac', '2', '-i', 'pipe:0',
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

// The stream's sound, written to ffmpeg in real time (48 kHz stereo since 2026-10-07): silence, or the line she's saying,
// her music under it (bed: a MusicBed, tools/live/music.js: quieter while she talks), and (2026-10-07) one more thing on its
// own: her song, a dance song or one of her videos' sound (media: the music bed rests meanwhile, and it's a little quieter
// while she talks over it). t0: the time (this computer's clock) of the sound's first sample, so a line's first sample has
// a time the page's mouth can follow (and her song's, its karaoke and her moves). Her voice and her music are 24 kHz mono:
// made twice as fine on the way (straight lines between samples).
export class Mixer {
  constructor(write, { rate = OUT_RATE, voiceRate = RATE, bedRate = RATE, lead = LEAD_MS, now = () => Date.now(), bed = null } = {}) {
    this.write = write; this.rate = rate; this.voiceRate = voiceRate; this.bedRate = bedRate; this.lead = lead; this.now = now; this.bed = bed;
    this.t0 = null; this.written = 0; this.clip = null; this.media = null; this.timer = null;
    this.bedBuf = new Float32Array(0); this.bedPos = 0; this.duck = 1;
    // (2026-10-07) the sounds around her (tools/live/ambience.js): a loop for where she is and one for the weather, each
    // fading from one to the next; and short sounds on their own (thunder, a whoosh, a pop, a crunch, a ding)
    this.amb = { place: [], weather: [] }; this.shots = []; this.ambDuck = 1;
  }
  begin(t0 = this.now()) { this.t0 = t0; this.timer ??= setInterval(() => this.pump(), 10); this.pump(); }
  align(t0) { if (Number.isFinite(t0)) this.t0 = t0; }      // (ffmpeg said when its first picture was: her voice lines up with it)
  // a layer's loop (Float32Array at the stream's rate, mono), its level, how long it takes to fade (s); null: silence
  setAmbience(layer, data, { gain = 0.15, fade = 1.6 } = {}) {
    const voices = this.amb[layer];
    if (!voices) return false;
    const frames = Math.max(1, fade * this.rate);
    const same = voices.find((v) => v.data === data && v.target > 0);
    if (same) { same.target = gain; same.delta = Math.abs(gain - same.g) / frames; return true; }
    for (const v of voices) { v.target = 0; v.delta = v.g / frames; }
    if (data && data.length > 100) voices.push({ data, pos: 0, g: 0, target: gain, delta: gain / frames });
    return true;
  }
  // a short sound, from `at` (this computer's clock, ms: when it should be heard; now when it's past) at `gain`
  sfx(data, { gain = 1, at = null } = {}) {
    if (!data || !data.length || this.t0 === null) return false;
    const now = Math.floor(((Number.isFinite(at) ? at : this.now()) - this.t0) * this.rate / 1000);
    this.shots.push({ data, start: Math.max(this.written, now), gain });
    if (this.shots.length > 8) this.shots.shift();
    return true;
  }
  ambFrames(n, talking) {
    const out = new Float32Array(n), right = new Float32Array(n);
    for (const layer of Object.values(this.amb)) {
      for (const v of layer) {
        const half = Math.floor(v.data.length / 2);
        for (let i = 0; i < n; i++) {
          if (v.g !== v.target) v.g = v.g < v.target ? Math.min(v.target, v.g + v.delta) : Math.max(v.target, v.g - v.delta);
          const k = v.pos % v.data.length;
          out[i] += v.data[k] * v.g;
          right[i] += v.data[(k + half) % v.data.length] * v.g;
          v.pos = k + 1;
        }
      }
      for (let j = layer.length - 1; j >= 0; j--) if (layer[j].target === 0 && layer[j].g <= 0) layer.splice(j, 1);
    }
    // a little quieter while she talks
    const want = talking ? 0.6 : 1;
    for (let i = 0; i < n; i++) { this.ambDuck += (want - this.ambDuck) * 0.0002; out[i] *= this.ambDuck; right[i] *= this.ambDuck; }
    for (let j = this.shots.length - 1; j >= 0; j--) {
      const s = this.shots[j];
      for (let i = 0; i < n; i++) {
        const k = this.written + i - s.start;
        if (k < 0) continue;
        if (k >= s.data.length) break;
        out[i] += s.data[k] * s.gain; right[i] += s.data[k] * s.gain;
      }
      if (this.written + n - s.start >= s.data.length) this.shots.splice(j, 1);
    }
    return [out, right];
  }
  end() {
    clearInterval(this.timer); this.timer = null;
    if (this.clip) { this.clip.finish('cut'); this.clip = null; }
    if (this.media) { this.media.finish('cut'); this.media = null; }
  }
  // the music bed's next n samples at the stream's rate (it runs at its own: 24 kHz)
  bedFrames(n, talking, hush) {
    const out = new Float32Array(n);
    if (!this.bed) return out;
    const step = this.bedRate / this.rate;
    const need = Math.floor(this.bedPos + step * (n - 1)) + 2;
    if (need > this.bedBuf.length) {
      const keep = Math.floor(this.bedPos);
      const old = this.bedBuf.subarray(keep);
      const fresh = new Float32Array(need - this.bedBuf.length + 8);
      this.bed.mix(fresh, talking, hush);
      const buf = new Float32Array(old.length + fresh.length);
      buf.set(old); buf.set(fresh, old.length);
      this.bedBuf = buf; this.bedPos -= keep;
    }
    for (let i = 0; i < n; i++) {
      const a = Math.floor(this.bedPos), f = this.bedPos - a;
      out[i] = this.bedBuf[a] * (1 - f) + this.bedBuf[a + 1] * f;
      this.bedPos += step;
    }
    return out;
  }
  pump() {
    if (this.t0 === null) return;
    const target = Math.floor(((this.now() + this.lead - this.t0) * this.rate) / 1000);
    while (this.written < target) {
      const n = Math.min(target - this.written, Math.round(this.rate / 50));
      const left = new Float32Array(n), right = new Float32Array(n);
      // her voice
      const c = this.clip;
      let talking = false;
      if (c) {
        const take = Math.min(n, c.frames - c.pos);
        if (!c.silent) {
          talking = true;
          const step = this.voiceRate / this.rate;
          for (let i = 0; i < take; i++) {
            const x = (c.pos + i) * step, a = Math.floor(x), f = x - a;
            const v = (c.samples[a] ?? 0) * (1 - f) + (c.samples[a + 1] ?? 0) * f;
            left[i] = v; right[i] = v;
          }
        }
        c.pos += take;
        if (c.pos >= c.frames) { this.clip = null; c.finish('done'); }
      }
      // her song, a dance song, a video's sound: a little quieter while she talks over it, with its own fades
      const m = this.media;
      if (m) {
        const take = Math.min(n, m.end - m.pos);
        const want = talking ? 0.45 : 1;
        for (let i = 0; i < take; i++) {
          this.duck += (want - this.duck) * 0.0003;                // (about 70 ms to settle)
          const k = m.pos + i;
          let g = m.gain * this.duck;
          if (k - m.start < m.fadeIn) g *= (k - m.start) / m.fadeIn;
          if (m.end - k < m.fadeOut) g *= (m.end - k) / m.fadeOut;
          left[i] += m.data[k * 2] * m.scale * g;
          right[i] += m.data[k * 2 + 1] * m.scale * g;
        }
        m.pos += take;
        if (m.pos >= m.end) { this.media = null; m.finish('done'); }
      } else this.duck = 1;
      const bed = this.bedFrames(n, talking, Boolean(m));
      const [ambL, ambR] = this.ambFrames(n, talking);
      const buf = Buffer.alloc(n * 4);
      for (let i = 0; i < n; i++) {
        buf.writeInt16LE(Math.round(soft(left[i] + bed[i] + ambL[i]) * 32767), i * 4);
        buf.writeInt16LE(Math.round(soft(right[i] + bed[i] + ambR[i]) * 32767), i * 4 + 2);
      }
      this.write(buf);
      this.written += n;
    }
  }
  // a line of hers (24 kHz mono) → { startAt: when its first sample is heard (ms, this computer's clock), seconds,
  // done: Promise<'done' | 'cut'> }
  play(samples, { silent = false } = {}) {
    if (this.clip) this.clip.finish('cut');
    let finish;
    const done = new Promise((ok) => { finish = ok; });
    const startAt = this.t0 + (this.written / this.rate) * 1000;
    this.clip = { samples, pos: 0, frames: Math.ceil((samples.length * this.rate) / this.voiceRate), silent, finish };
    return { startAt, seconds: samples.length / this.voiceRate, done };
  }
  stop() { if (this.clip) { const c = this.clip; this.clip = null; c.finish('cut'); } }
  // (2026-10-07) one more thing on its own: data, stereo at the stream's rate (left, right, left, right…: an Int16Array, or
  // a Float32Array -1..1), from `from` to `to` (seconds in it), at `gain`, with fades (seconds) → { startAt, seconds, done }
  playMedia(data, { from = 0, to = null, gain = 1, fadeIn = 0, fadeOut = 0 } = {}) {
    if (this.media) this.media.finish('cut');
    let finish;
    const done = new Promise((ok) => { finish = ok; });
    const frames = Math.floor(data.length / 2);
    const start = Math.max(0, Math.min(frames, Math.round(from * this.rate)));
    const end = Math.max(start, Math.min(frames, to === null ? frames : Math.round(to * this.rate)));
    const startAt = this.t0 + (this.written / this.rate) * 1000;
    this.media = { data, scale: data instanceof Int16Array ? 1 / 32768 : 1, start, end, pos: start, gain,
      fadeIn: Math.max(1, Math.round(fadeIn * this.rate)), fadeOut: Math.max(1, Math.round(fadeOut * this.rate)), finish };
    return { startAt, seconds: (end - start) / this.rate, done };
  }
  stopMedia() { if (this.media) { const m = this.media; this.media = null; m.finish('cut'); } }
  get playingMedia() { return Boolean(this.media); }
}
// never past full scale: a rare peak is rounded off softly (above 0.92), never wrapped around
const soft = (x) => (x > 0.92 ? 0.92 + 0.08 * Math.tanh((x - 0.92) / 0.08) : x < -0.92 ? -0.92 - 0.08 * Math.tanh((-x - 0.92) / 0.08) : x);

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
// Who asked, on her question card: the name they gave (or "someone"), never a Telegram name ("someone on Telegram"), and
// (2026-10-07) a question from X's live chat that the owner passed on: "<name> on X" (or "someone on X")
export const askedBy = (q) => (q?.source === 'telegram' ? q.name || 'someone on Telegram'
  : q?.source === 'x' ? `${q.name || 'someone'} on X` : q?.name || 'someone');

// ---------- (2026-10-07, the owner's stream upgrade) her own words between things, and where everyone is watching from ----------
// LIVE_CHATTER (on unless "off"): something new to say now and then (the site's AI, her live rules; about $0.0005 a line,
// and her voice about $0.001), at most LIVE_CHATTER_PER_HOUR an hour (40) and one every 40 seconds; between those, her
// pre-written lines as before
export function chatterSettings(env = process.env) {
  const n = Number(env.LIVE_CHATTER_PER_HOUR);
  return { on: !/^(off|no|false|0)$/i.test(String(env.LIVE_CHATTER ?? '').trim()),
    perHour: Number.isFinite(n) && String(env.LIVE_CHATTER_PER_HOUR).trim() !== '' ? Math.max(0, Math.min(120, Math.floor(n))) : 40, gapMs: 40_000 };
}
// what she talks about when it's her turn (the site's CHATTER: server/live.js), in turn
export const TOPICS = ['anything', 'room', 'anything', 'outfit', 'time', 'anything', 'music', 'show'];
const WHERE = [['Los Angeles', 'America/Los_Angeles'], ['New York', 'America/New_York'], ['London', 'Europe/London'], ['Manila', 'Asia/Manila'], ['Tokyo', 'Asia/Tokyo']];
// "it's evening in New York, night in London and morning in Tokyo" (three places around the world, their part of the day)
export function timeFact(now = Date.now(), places = [WHERE[1], WHERE[2], WHERE[4]]) {
  const part = (tz) => {
    const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).format(now)) % 24;
    return h < 5 ? 'the middle of the night' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 21 ? 'evening' : 'night';
  };
  const bits = places.map(([city, tz]) => `${part(tz)} in ${city}`);
  return `right now it's ${bits.slice(0, -1).join(', ')} and ${bits.at(-1)}`;
}
// a feeling about $AGI's day, from its 24-hour change: up, down or flat (never more than a feeling: lines.js MARKET_LINES)
export const dirOf = (h24) => (h24 >= 3 ? 'up' : h24 <= -3 ? 'down' : 'flat');
// her song by herself: the whole song once a show (after the first 25 minutes, when it isn't resting), else a part, in turn
export const SONG_ROTATION = ['chorus', 'final', 'rap', 'chorus', 'verse', 'intro'];

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
  const cacheDir = voice.settings.cacheDir;

  // (2026-10-07) her song, her dance songs, her videos, her X posts
  const song = readSong();
  let dances = [];
  try { dances = loadSongs(cacheDir, { songs: DANCE_SONGS, log }); } catch (err) { log.warn(`her dance songs: ${err.message}`); }
  const x = a.demo ? createX({ bearer: '', maxReads: 0, user: 'agi1dotapp' }) : createX(xSettings(), { log, cacheDir });
  const videos = listVideos(process.env.LIVE_VIDEOS_DIR || '/videos');
  tidyMedia(cacheDir);
  log.info(`her song: ${song ? song.meta.title : 'none'} · ${dances.length} dance songs · ${videos.length} videos · X: ${x.on ? 'her posts and their replies' : 'off (no LIVE_X_BEARER)'}`);

  const dist = existsSync(join(ROOT, 'tools/live/dist/index.html')) && !process.env.LIVE_REBUILD ? join(ROOT, 'tools/live/dist') : await buildPage();
  const served = await serve(dist, { media: join(cacheDir, 'media') });
  // her picture's own size: 720 × 720 with 4 cores or more, 540 below (LIVE_GL to choose)
  const gl = Number(process.env.LIVE_GL) || (cpus().length >= 4 ? 720 : 540);
  served.url = `${served.url}?gl=${gl}`;
  const screen = await startScreen();
  let browser = null, ffm = null, mixer = null, beatTimer = null, marketTimer = null, show = null, stopping = false;
  const cleanup = async () => {
    stopping = true;                                           // (ffmpeg is never started again from here)
    clearInterval(beatTimer);
    clearInterval(marketTimer);
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
  let interrupt = null;           // the line she's saying (or her song, a dance, a video): interrupt('pause' | 'skip' | 'stop') cuts it
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
      ? new MusicBed(loadSongs(cacheDir, { log }), { volume: ms.volume, seed: Math.floor(Date.now() / 86_400_000) })
      : null;
    if (music) log.info(`her music: ${music.tracks.length} songs, volume ${Math.round(ms.volume * 100)}%`);
    // her song's sound: read once (ffmpeg, then kept on disk), while she gets ready
    let songSound = null;
    const songReady = song ? decodeSong(song.file, cacheDir, { log }).then((pcm) => { songSound = { pcm, gain: songGain(pcm) }; return songSound; })
      .catch((err) => { log.warn(`her song couldn't be read: ${err.message}`); return null; }) : Promise.resolve(null);
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
    // (2026-10-07) line.lang: the language she says it in (her captions say so); act: one of her moves (an emotion) as she starts
    const say = async (line, { keep = true, audio = undefined, react = undefined, act = null } = {}) => {
      if (stopping || !line) return 'cut';
      const voiced = audio !== undefined ? audio : await voice.speak(line.text, { say: line.say, mood: line.mood, keep });
      const samples = voiced?.samples || readWav(fakeVoice(line.say || line.text)).samples;     // (no voice: she says it silently)
      const env = Array.from(talkTrack(samples, RATE, 50), (x) => Math.round(x * 100) / 100);
      const cues = timeCaptions(line.text, pauses(samples, RATE));
      const play = mixer.play(samples, { silent: !voiced });
      await studio('say', { startAt: play.startAt, step: 20, env, cues, seconds: play.seconds, react: react === undefined ? reactFor(line.mood) : react,
        ...(act ? { act } : {}), ...(line.lang ? { lang: line.lang } : {}) });
      const result = await Promise.race([play.done, new Promise((ok) => { interrupt = ok; })]);
      interrupt = null;
      if (result !== 'done') { mixer.stop(); await studio('stop'); }
      return result;
    };
    // (2026-10-07) something on its own in the stream's sound (her song, a dance song, a video's sound): cut like her lines
    const playOn = async (play) => {
      const result = await Promise.race([play.done, new Promise((ok) => { interrupt = ok; })]);
      interrupt = null;
      if (result !== 'done') mixer.stopMedia();
      return result;
    };
    const fresh = (r) => r?.reply && { text: r.reply, mood: r.mood, ...(r.lang ? { lang: r.lang } : {}) };
    const sayFresh = (r) => say(fresh(r), { keep: false, react: reactFor(r.mood, { answer: true }) });

    // ---------- (2026-10-07) her rooms and outfits, dances, her song, her videos ----------
    const look = { room: 'studio', outfit: 'classic' };
    // (2026-10-07) where she's visiting (a real place, the Moon, Mars: null in her own rooms), and the sounds around her
    const where = { place: null, visited: [], since: 0, weather: null, weatherUntil: 0, lightning: null };
    const sfx = (id, o = {}) => mixer?.sfx(ambShot(id), o);
    const surround = (id) => { const k = T.PLACE_SOUND[id]; mixer?.setAmbience('place', k ? ambLoop(k) : null, { gain: LOOP_GAIN[k] || 0.12 }); };
    const goRoom = async (id, { line = true } = {}) => {
      if (!ROOM_NAMES[id] || (id === look.room && !where.place) || stopping) return false;
      state.segment = 'room';
      // (the weather stays where it was: going from the rooftop's rain to the concert stage, her umbrella went along until
      // the painted set's first recording showed it)
      where.place = null;
      await stopWeather();
      sfx('whoosh', { gain: 0.8 });
      await studio('room', id);                     // the comic wipe: the room changes midway (about a second)
      look.room = id;
      surround(id);
      await sleep(1000);
      if (line) await say(L.ROOM_LINES[id]);
      talk.event = 'room';
      return true;
    };
    const goOutfit = async (id, { line = true } = {}) => {
      if (!OUTFIT_NAMES[id] || id === look.outfit || stopping) return false;
      state.segment = 'outfit';
      await studio('outfit', id);                   // a hop and sparkles, her new colors as she lands
      sfx('pop', { gain: 0.7 });
      look.outfit = id;
      await sleep(900);
      if (line) await say(L.OUTFIT_LINES[id]);
      talk.event = 'outfit';
      return true;
    };
    let danceNext = Math.floor(Date.now() / 86_400_000);
    // one of her dance songs (in the stream's own sound), and her moves on its beat (its tempo is known: made in code)
    const danceFor = async ({ seconds = null } = {}) => {
      if (!dances.length) return 'none';
      const tr = dances[danceNext++ % dances.length];
      const len = Math.min(tr.samples.length / RATE, seconds || Infinity);
      const play = mixer.playMedia(toStereo(tr.samples, RATE, OUT_RATE), { to: len, fadeOut: len < tr.samples.length / RATE - 0.5 ? 1.6 : 0.3 });
      state.segment = 'dance';
      await studio('dance', { bpm: tr.song.bpm, beat0: play.startAt, until: play.startAt + play.seconds * 1000, styles: BIG_DANCES });
      const r = await playOn(play);
      await studio('dance', null);
      talk.event = 'dance';
      return r;
    };
    // her song, or a part of it: to the concert stage in her stage outfit, the song's sound as it is, her mouth from its
    // vocals, karaoke for its hook, her moves on its beat; then back to where she was
    let sangWhole = false;
    const singPart = async (part, { intro = false } = {}) => {
      const s = await songReady;
      if (!s) { await say(L.OOPS); return 'none'; }
      const p = partOf(song.meta, part);
      // (where she was: a room, or a place she's visiting, which the concert stage mustn't make her forget)
      const back = { room: look.room, outfit: look.outfit, place: where.place, since: where.since };
      if (intro) await say(pickFrom(show, 'songIntro', part === 'whole' ? L.SONG_LINES.whole : L.SONG_LINES.part));
      await studio('card', null);
      await goRoom('stage', { line: false });
      await goOutfit('stage', { line: false });
      await sleep(1200);
      if (stopping || controls.paused) return 'cut';
      if (part === 'whole') sangWhole = true;
      const play = mixer.playMedia(s.pcm, { from: p.from, to: p.to, gain: s.gain, fadeIn: p.from > 0.5 ? 0.35 : 0.02, fadeOut: p.to < song.meta.seconds - 0.5 ? 1.4 : 0.25 });
      state.segment = 'song';
      await studio('sing', { startAt: play.startAt, seconds: play.seconds, step: p.step, env: p.env, lines: p.lines, beats: p.beats, downbeats: p.downbeats,
        cues: p.cues, sections: p.sections, bpm: p.bpm, title: `${p.title} · ${p.name}` });
      const r = await playOn(play);
      await studio('sing', null);
      if (r === 'done') {
        if (part === 'whole' || part === 'final') await studio('confetti', 4.5);
        await sleep(500);
        await say(pickFrom(show, 'songAfter', L.SONG_LINES.after));
      }
      if (!stopping && !controls.paused) {
        if (back.place) await backTo(back.place, back.since);
        else await goRoom(back.room, { line: false });
        await goOutfit(back.outfit, { line: false });
      }
      talk.event = 'song';
      return r;
    };
    // a video on her TV, its sound in the stream's own, her eyes on it
    const watch = async (v, label) => {
      const play = v.sound ? mixer.playMedia(v.sound, { to: v.seconds, gain: v.gain ?? songGain(v.sound), fadeIn: 0.05, fadeOut: 0.6 }) : null;
      state.segment = 'video';
      await studio('card', null);
      await studio('tv', { src: v.src, startAt: play ? play.startAt : Date.now() + 300, seconds: v.seconds, label });
      await studio('look', 'tv');
      let r;
      if (play) r = await playOn(play);
      else { r = await Promise.race([sleep(v.seconds * 1000).then(() => 'done'), new Promise((ok) => { interrupt = ok; })]); interrupt = null; }
      await studio('tv', null);
      await studio('look', 'you');
      return r;
    };
    // her videos, made ready one at a time in the background (each once, kept on disk): the folder's, and her X posts'
    const readyVideos = [];
    const xMedia = new Map();                       // her post's id → { video } or { picture }
    const prepping = (async () => {
      for (const v of videos.slice(0, 12)) {
        if (stopping) return;
        try { const r = await prepareVideo(v, cacheDir, { log }); readyVideos.push({ ...r, title: v.title, about: v.about, gain: r.sound ? songGain(r.sound) : 1 }); } catch (err) { log.warn(`[media] "${v.title}": ${err.message}`); }
      }
      if (!x.on) return;
      for (const p of (await x.posts()).slice(0, 6)) {
        if (stopping) return;
        try {
          if (p.media?.type === 'video') {
            const dl = await download(p.media.video, cacheDir, { kind: 'video' });
            const st = statSync(dl.file);
            const r = await prepareVideo({ file: dl.file, title: 'my post', size: st.size, mtime: st.mtimeMs }, cacheDir, { log });
            xMedia.set(p.id, { video: { ...r, gain: r.sound ? songGain(r.sound) : 1 } });
          } else if (p.media?.type === 'photo') xMedia.set(p.id, { picture: await download(p.media.url, cacheDir) });
        } catch (err) { log.warn(`[media] a picture or video from her post: ${err.message}`); }
      }
    })().catch((err) => log.warn(`[media] ${err.message}`));

    // ---------- (2026-10-07) $AGI on her show: its numbers and its new buys (alerts), never advice ----------
    const market = { numbers: null, since: Date.now(), seen: new Set(), pending: [], milestone: false, step: null, lastAlert: 0, failures: 0 };
    const pollMarket = async () => {
      try {
        const r = await site.market(showId, market.since);
        if (r?.numbers?.mcap > 0) {
          market.numbers = r.numbers;
          const step = Math.floor(r.numbers.mcap / 200_000);
          if (market.step !== null && step > market.step) market.milestone = true;
          market.step = market.step === null ? step : Math.max(market.step, step);
        }
        for (const b of Array.isArray(r?.buys) ? r.buys : []) {
          if (!b?.id || market.seen.has(b.id) || !(b.usd > 0)) continue;
          market.seen.add(b.id);
          market.pending.push(b);
          if (Number.isFinite(b.at)) market.since = Math.max(market.since, b.at);
        }
        market.pending = market.pending.slice(-10);
        market.failures = 0;
      } catch (err) { if (++market.failures === 3) log.warn(`$AGI's numbers aren't coming (${err.message}): no alerts meanwhile`); }
    };
    marketTimer = setInterval(pollMarket, 60_000);
    pollMarket();
    const alertDue = (now) => (market.pending.length || market.milestone) && now - market.lastAlert > 90_000;
    const buyAlert = async () => {
      state.segment = 'market';
      market.lastAlert = Date.now();
      if (market.milestone) {
        market.milestone = false;
        await studio('alert', { kind: 'info', icon: '💜', title: `$AGI: ${fmtCompact(market.step * 200_000)} market cap`, sub: 'a new step · not financial advice', seconds: 9 });
        await studio('confetti', 4);
        await say(L.MILESTONE_LINE);
        return;
      }
      sfx('ding', { gain: 0.7 });
      const list = market.pending.splice(0);
      const usd = list.reduce((sum, b) => sum + b.usd, 0);
      await studio('alert', { kind: 'buy', icon: '🤖', title: list.length === 1 ? 'New $AGI buy' : `${list.length} new $AGI buys`, sub: `${fmtCompact(usd)} · not financial advice`, seconds: 8 });
      await say(pickFrom(show, 'buy', L.BUY_LINES));
    };

    // ---------- (2026-10-07) something new to say, made ahead in the background (her own words, the site's AI) ----------
    const chatter = chatterSettings();
    const talk = { recent: [], times: [], next: 0, k: 0, event: null, ready: null, making: null };
    const factsFor = (kind) => {
      if (kind === 'room') return [`you're streaming from ${where.place ? PLACES[where.place].name : ROOM_NAMES[look.room]}`];
      if (kind === 'outfit') return [`you're wearing ${OUTFIT_NAMES[look.outfit]}`];
      if (kind === 'music') return music?.playing ? [`the song playing right now is called "${music.playing}"`] : [];
      if (kind === 'time') return [timeFact()];
      if (kind === 'show') return [`you've been live for ${Math.max(1, Math.round((Date.now() - show.start) / 60_000))} minutes`, `you've answered ${show.answered} questions so far`];
      return [`you're streaming from ${where.place ? PLACES[where.place].name : ROOM_NAMES[look.room]}`];
    };
    const prefetchChat = () => {
      if (!chatter.on || talk.making || talk.ready || stopping || controls.paused || !show) return;
      const now = Date.now();
      talk.times = talk.times.filter((t) => now - t < 3_600_000);
      if (talk.times.length >= chatter.perHour || now < talk.next || (voice.restingUntil?.(now) || 0) > now) return;
      talk.next = now + chatter.gapMs;
      const kind = talk.event || TOPICS[talk.k++ % TOPICS.length];
      talk.event = null;
      talk.making = (async () => {
        const r = await site.chat(showId, { kind, facts: factsFor(kind), recent: talk.recent });
        if (!r?.reply) return;
        talk.times.push(Date.now());
        talk.recent = [...talk.recent, r.reply].slice(-6);
        const audio = await voice.speak(r.reply, { mood: r.mood, keep: false });
        if (audio) talk.ready = { line: { text: r.reply, mood: r.mood }, audio, at: Date.now() };
      })().catch((err) => log.warn(`something new to say: ${err.message}`)).finally(() => { talk.making = null; });
    };
    const takeChat = () => {
      const c = talk.ready;
      talk.ready = null;
      return c && Date.now() - c.at < 6 * 60_000 ? c : null;           // (one made long ago: about something long gone)
    };


    // ---------- (2026-10-07) her trips: a vehicle takes her somewhere real (or to the Moon, or Mars) ----------
    // The vehicle each place has (trips.js), the scene on the way with a line, then the place: her outfit for it, her hello in
    // the language people speak there (one of her 16) and what it means, a line about it; sometimes she meets someone there.
    const aired = [];                               // viewers' questions she answered lately (what people she meets talk about)
    const meetOk = () => Boolean(T.personAt(where.place || (look.room === 'cafe' ? 'cafe' : null)));
    const stopWeather = async () => {
      if (!where.weather) return;
      clearInterval(where.lightning); where.lightning = null;
      where.weather = null;
      await studio('weather', null);
      mixer?.setAmbience('weather', null);
    };
    let nextTripAt = Date.now() + 7 * 60_000 + Math.random() * 3 * 60_000;
    const trip = async (to, { mine = false } = {}) => {
      if (!PLACES[to] || stopping) return false;
      if (to === where.place) { await say(T.HERE_LINE); return true; }
      state.segment = 'trip';
      acts.take({ act: 'trip' });
      await studio('card', null);
      await stopWeather();
      const vehicle = T.vehicleFor(to), kind = T.kindFor(vehicle);
      const from = where.place ? PLACES[where.place].name : 'home';
      await say(T.GO_LINES[to]);
      if (stopping || controls.paused) return true;
      mixer?.setAmbience('place', ambLoop(T.TRAVEL_SOUND[kind]), { gain: LOOP_GAIN[T.TRAVEL_SOUND[kind]] || 0.14 });
      const travel = 14;
      await studio('tripGo', { vehicle, kind, from, to: PLACES[to].name, icon: T.ICON[vehicle] || '➜', seconds: travel });
      const onWay = Date.now();
      await say(pickFrom(show, `travel-${kind}`, T.TRAVEL_LINES[kind]));
      const left = travel * 1000 - (Date.now() - onWay) - 1500;
      if (left > 0) await sleep(left);
      sfx('whoosh', { gain: 0.8 });
      await studio('tripArrive', { to });
      surround(to);
      where.place = to; where.since = Date.now(); where.visited.push(to); where.visited = where.visited.slice(-12);
      look.room = null;
      const p = T.PLACE_LINES[to];
      await say(p.hello, { react: 'wave' });
      if (p.means) await say(p.means);
      if (PLACES[to].outfit && PLACES[to].outfit !== look.outfit) await goOutfit(PLACES[to].outfit);
      await say(pickFrom(show, `place-${to}`, p.lines));
      talk.event = 'room';
      nextTripAt = Date.now() + (15 + Math.random() * 5) * 60_000;
      // (by herself: half the time she meets someone there, or has a snack)
      if (mine && !stopping && !controls.paused) {
        const r = show.rnd();
        if (r < 0.5 && meetOk()) await meet();
        else if (r < 0.75) await eat(T.foodAt(to, show.rnd));
      }
      return true;
    };
    // back to a place she was visiting (after her song on the concert stage): a wipe, its sounds, no trip
    const backTo = async (id, since = Date.now()) => {
      if (!PLACES[id] || stopping) return false;
      sfx('whoosh', { gain: 0.8 });
      await studio('place', id);
      where.place = id; where.since = since;
      look.room = null;
      surround(id);
      await sleep(1000);
      return true;
    };
    // home: a quick wipe back to her studio, her classic tee
    const goHome = async () => {
      if (!where.place) return false;
      await say(pickFrom(show, 'home', T.HOME_LINES));
      await stopWeather();
      where.place = null;
      sfx('whoosh', { gain: 0.8 });
      await studio('home', 'studio');
      look.room = 'studio';
      surround('studio');
      await sleep(900);
      await goOutfit('classic', { line: false });
      nextTripAt = Date.now() + (12 + Math.random() * 6) * 60_000;
      return true;
    };
    // someone she meets there: their conversation (the site's AI, about what her chat asked lately; else their own few words),
    // their own voice, their words in a bubble
    const meet = async () => {
      const person = T.personAt(where.place || (look.room === 'cafe' ? 'cafe' : null));
      if (!person || stopping) return false;
      state.segment = 'meet';
      acts.take({ act: 'meet' });
      await studio('card', null);
      const scene = site.meet(showId, { person, chat: aired.slice(-3) }).catch(() => null);
      await say(pickFrom(show, 'meetIntro', T.MEET_INTRO));
      await studio('meet', person);
      const r = await scene;
      const lines = Array.isArray(r?.lines) && r.lines.length >= 2 ? r.lines : T.MEET_FALLBACK[person];
      const v = T.voiceOf(person);
      for (const ln of lines.slice(0, 6)) {
        if (stopping || controls.paused) break;
        if (ln.who === 'them') {
          const audio = await voice.speak(ln.text, { voice: v, keep: lines === T.MEET_FALLBACK[person] });
          const samples = audio?.samples || readWav(fakeVoice(ln.text)).samples;
          const play = mixer.play(samples, { silent: !audio });
          await studio('npcSay', { startAt: play.startAt, step: 20, env: Array.from(talkTrack(samples, RATE, 50), (x) => Math.round(x * 100) / 100), text: ln.text, seconds: play.seconds });
          const res = await Promise.race([play.done, new Promise((ok) => { interrupt = ok; })]);
          interrupt = null;
          if (res !== 'done') { mixer.stop(); break; }
        } else if ((await say({ text: ln.text, mood: ln.mood || r?.mood || 'happy' }, { keep: false, react: 'neutral' })) !== 'done') break;
        await sleep(250);
      }
      await say(pickFrom(show, 'meetBye', T.MEET_BYE), { react: 'wave' });
      await studio('bye');
      talk.event = 'show';
      return true;
    };
    // a snack: in her hand, a bite at a time (a crunch on each), then how it was
    const eat = async (food) => {
      const id = FOOD_DEFS[food] ? food : T.foodAt(where.place, show.rnd);
      if (!FOOD_DEFS[id] || stopping) return false;
      state.segment = 'eat';
      acts.take({ act: 'eat' });
      await say(T.EAT_LINES[id]);
      const at = Date.now();
      await studio('eat', id);
      if (!FOOD_DEFS[id].drink) for (const b of [1450, 3150]) sfx('crunch', { at: at + b + 120, gain: 0.9 });
      await sleep(FOOD_DEFS[id].drink ? 4700 : 5500);
      await say(pickFrom(show, 'ate', T.ATE_LINES));
      return true;
    };
    // the weather: outside (in her rooms she goes up to the rooftop first, or to the beach for sunshine), her umbrella in the
    // rain, a reaction, its sound; a storm's lightning now and then with its thunder; it clears by itself after a while
    const weather = async (w) => {
      let id = T.WEATHERS[w] ? w : T.weatherAt(where.place, show.rnd) || 'rain';
      if (id === 'dust' && where.place !== 'mars' && where.place !== 'cairo' && where.place !== 'dubai') id = 'fog';
      if (stopping) return false;
      state.segment = 'weather';
      acts.take({ act: 'weather' });
      await studio('card', null);
      if (!where.place && !['rooftop', 'beach'].includes(look.room)) {
        await say(T.WEATHER_GO_OUT);
        await goRoom(T.roomForWeather(id) || 'rooftop', { line: false });
        await sleep(600);
      }
      clearInterval(where.lightning); where.lightning = null;
      await studio('weather', id);
      where.weather = id; where.weatherUntil = Date.now() + (2 + Math.random()) * 60_000;
      const k = T.WEATHER_SOUND[id];
      mixer?.setAmbience('weather', k ? ambLoop(k) : null, { gain: (LOOP_GAIN[k] || 0.15) * (id === 'storm' ? 1.3 : 1) });
      const flash = () => { studio('lightning'); sfx('thunder', { at: Date.now() + 500 + Math.random() * 900, gain: 0.9 }); };
      if (id === 'storm') { setTimeout(flash, 1500); where.lightning = setInterval(flash, 9000 + Math.random() * 6000); }
      await say(T.WEATHER_LINES[id], { act: T.WEATHER_FEEL[id] || null });
      return true;
    };

    // ---------- (2026-10-07) viewers' requests: what she said yes to, right after she said it ----------
    const acts = createActs({ song: Boolean(song), dance: dances.length > 0, meet: meetOk });
    const doAct = async (act) => {
      const d = DOES[act?.act];
      if (!d || stopping || controls.paused) return;
      state.segment = 'request';
      try {
        if (d.act) { await studio('act', d.act); await sleep(actMs(act)); }
        else if (d.react) {
          for (let i = 0; i < (act.act === 'wave' ? Math.min(3, act.times || 1) : 1); i++) { await studio('react', d.react); await sleep(act.act === 'wave' ? 2100 : actMs(act)); }
        } else if (d.page === 'jump') { await studio('jump', act.times || 1); await sleep(actMs(act)); }
        else if (d.page === 'twirl') { await studio('twirl', act.times || 1); await sleep(actMs(act)); }
        else if (d.page === 'move') { await studio('move', act.to || 'around'); await sleep(actMs(act)); }
        else if (d.own === 'confetti') { await studio('confetti', 4); await studio('sticker', 'yay'); await sleep(actMs(act)); }
        else if (d.own === 'room') await goRoom(roomFor(act, look.room), { line: false });
        else if (d.own === 'outfit') await goOutfit(outfitFor(act, look.outfit), { line: false });
        else if (d.own === 'dance') { const r = await danceFor({ seconds: 24 }); if (r === 'none') await say(L.OOPS); }
        else if (d.own === 'sing') await singPart(act.part || 'chorus');
        // (2026-10-07) a trip (somewhere, or one she picks), a snack, the weather, someone she meets
        else if (d.own === 'trip') await trip(act.to && PLACES[act.to] ? act.to : T.nextPlace(where.visited, where.place, show.rnd));
        else if (d.own === 'eat') await eat(act.to);
        else if (d.own === 'weather') await weather(act.to);
        else if (d.own === 'meet') { if (!(await meet())) await say(L.OOPS); }
      } catch (err) { log.warn(`a viewer's request (${act.act}): ${err.message}`); }
    };

    // "starting soon": until it's time (she's there, idle; questions can already come in). Meanwhile her first lines' voices
    // are made (when they aren't kept yet), so her intro never waits for Google. The owner's "end" cancels the show.
    if (begins > Date.now()) {
      await browser.page.evaluate(([at]) => window.studio.overlay('starting', { sub: 'Ask me at agi1.app/live', untilMs: at }), [begins]);
      warmUp(voice, [...L.INTRO, ...T.SHOWCASE.map((x) => x.line), ...L.READING, L.BRB.start, L.BRB.back, ...L.LAG, ...L.OUTRO], { until: begins - 5000, gapMs: WARM_GAP_MS }).catch(() => {});
      while (Date.now() < begins && !stopping && !controls.end) await sleep(500);
    }
    if (controls.end && !stopping) {
      log.info('the owner ended it before it started');
      await browser.page.evaluate(() => window.studio.overlay('ended', { sub: 'Follow @agi1dotapp for the next one' }));
      music?.fadeOut();
      await sleep(4000);
      stopping = true;
    }
    await browser.page.evaluate(() => window.studio.overlay(null));
    await studio('start', Date.now());
    const extras = ['room', 'outfit', 'market', 'eat', 'weather', 'meet', ...(dances.length ? ['dance'] : []), ...(song ? ['song'] : []), ...(x.on ? ['post', 'replies'] : []), ...(videos.length ? ['video'] : [])];
    show = createShow({ start: Date.now(), minutes: a.minutes, diary: Boolean(diary), seed: Math.floor(Date.now() / 86_400_000), extras, first: a.tryExtras });
    state.status = 'live';
    // (2026-10-07) what to try asking her, in the bar all show long; a trip soon on a recording that asks for one (--try trip)
    await studio('hint', T.HINTS);
    if (a.tryExtras.includes('trip')) nextTripAt = Date.now() + 75_000;
    // (2026-10-07) she's streaming on X now: her Telegram groups hear it, once a day at most (the site decides); never for a
    // recording, and --demo's stand-in site tells nobody
    if (!a.record && !stopping) {
      site.onX(showId).then((r) => { if (r?.told) log.info(`her Telegram groups heard she's live (${r.posted ?? 0} posted, ${r.failed ?? 0} failed)`); },
        (err) => log.warn(`couldn't tell her Telegram groups she's live: ${err.message}`));
    }

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
        // (2026-10-07) what she can do on stream right now: the site's AI says which one the viewer asked for
        const r = await site.next(showId, acts.can(), where.place);
        if (!r?.question) { if (r?.trouble) troubled(r.trouble); return null; }
        if (ai.trouble) log.info('her answers are back');
        ai.trouble = 0; ai.said = false;
        if (r.act) acts.take(r.act);                     // (it rests from now: the next answer, asked meanwhile, never offers it)
        const audio = await voice.speak(r.reply, { mood: r.mood, keep: false });
        return { ...r, audio };
      })().catch((err) => { troubled(err.message); return null; });
    };
    // a question she had ready when the owner paused her: back in line (if the site can't be told, she keeps it for after)
    const putBack = async (qa) => {
      acts.release(qa.act);
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
      } else if (seg.pool) {
        // (2026-10-07) a few of its pool (fun facts, quick picks, flags, quiz questions), a card for each
        await studio('card', { kind: 'segment', ...seg.card });
        if ((await say(seg.intro)) === 'done') {
          for (const item of poolFor(show, id)) {
            await studio('card', { kind: 'segment', kicker: seg.card.kicker, title: seg.card.title, body: item.card });
            if ((await say(item.line)) !== 'done') break;
            await sleep(500);
          }
        }
      } else {
        await studio('card', { kind: 'segment', ...seg.card });
        for (const line of seg.lines) { if ((await say(line)) !== 'done') break; await sleep(300); }
      }
      await sleep(800);
      await studio('card', null);
      state.segment = 'questions';
    };

    // ---------- (2026-10-07) her extras: a dance break, a new room, an outfit change, her song, her posts, her videos, $AGI ----------
    const shown = { posts: new Set(), replies: new Set(), videos: new Set() };
    const showPost = async () => {
      for (const p of (await x.posts()).filter((q) => !shown.posts.has(q.id)).slice(0, 3)) {
        // (its picture or video isn't ready yet: another post now, this one later)
        if (p.media && !xMedia.has(p.id)) continue;
        shown.posts.add(p.id);
        const r = await site.react(showId, { kind: 'post', text: p.text, media: p.media?.type || null }).catch(() => null);
        if (!r?.reply) continue;                     // (one that can't go on stream: never shown)
        const m = xMedia.get(p.id);
        await say(pickFrom(show, 'postIntro', L.POST_LINES.intro));
        await studio('card', { kind: 'post', kicker: 'My post on X', body: r.text });
        await studio('look', 'card');
        await sleep(2800);
        await studio('look', 'you');
        if (m?.video) {
          if ((await watch(m.video, 'from my post on X')) !== 'done') return true;
          await studio('card', { kind: 'post', kicker: 'My post on X', body: r.text });
        } else if (m?.picture) {
          await studio('card', null);
          await studio('tv', { img: m.picture.src, seconds: 16, label: 'from my post on X' });
          await studio('look', 'tv');
        }
        state.segment = 'post';
        await sayFresh(r);
        await sleep(800);
        await studio('tv', null);
        await studio('card', null);
        await studio('look', 'you');
        return true;
      }
      return false;
    };
    const showReplies = async () => {
      for (const p of (await x.posts()).slice(0, 5)) {
        if (shown.replies.has(p.id)) continue;
        shown.replies.add(p.id);
        let said = 0;
        for (const reply of (await x.replies(p.id)).slice(0, 6)) {
          if (said >= 3 || stopping || controls.paused) break;
          const r = await site.react(showId, { kind: 'reply', text: reply.text }).catch(() => null);
          if (!r?.reply) continue;
          if (!said) await say(pickFrom(show, 'replyIntro', L.REPLY_LINES.intro));
          state.segment = 'replies';
          await studio('card', { kind: 'reply', kicker: 'Someone replied to my post', body: r.text });
          await studio('look', 'card');
          await sleep(2400);
          await studio('look', 'you');
          await sayFresh(r);
          await sleep(600);
          said += 1;
        }
        await studio('card', null);
        if (said) return true;
      }
      return false;
    };
    const showVideo = async () => {
      const v = readyVideos.find((y) => !shown.videos.has(y.id));
      if (!v) return false;
      shown.videos.add(v.id);
      await say(pickFrom(show, 'videoIntro', L.VIDEO_LINES.intro));
      const reaction = site.react(showId, { kind: 'video', title: v.title, text: v.about }).catch(() => null);   // (written while they watch)
      if ((await watch(v, v.title)) !== 'done') return true;
      const r = await reaction;
      if (r?.reply) await sayFresh(r);
      else await say(pickFrom(show, 'videoAfter', L.VIDEO_LINES.after));
      return true;
    };
    const marketCheck = async () => {
      const n = market.numbers;
      if (!n) return false;
      state.segment = 'market';
      await studio('card', { kind: 'chart', ...L.MARKET_CARD, stats: [
        { label: 'Market cap', value: fmtCompact(n.mcap) },
        { label: '24h', value: fmtPct(n.h24), tone: Number.isFinite(n.h24) ? (n.h24 >= 0 ? 'up' : 'down') : undefined },
        { label: 'Liquidity', value: fmtCompact(n.liq) },
      ] });
      await say(pickFrom(show, `market-${dirOf(n.h24)}`, L.MARKET_LINES[dirOf(n.h24)]));
      await sleep(1500);
      await studio('card', null);
      return true;
    };
    const extraOk = (id) => {
      if (id === 'dance') return dances.length > 0 && !acts.resting('dance');
      if (id === 'song') return Boolean(song) && !acts.resting('sing') && (Date.now() - show.start > 6 * 60_000 || a.tryExtras.includes('song'));
      if (id === 'market') return Boolean(market.numbers);
      if (id === 'video') return readyVideos.some((v) => !shown.videos.has(v.id));
      // (2026-10-07) a snack, the weather (not while one's on), someone she meets (only where she's visiting, or her café)
      if (id === 'eat') return !acts.resting('eat');
      if (id === 'weather') return !where.weather && !acts.resting('weather');
      if (id === 'meet') return meetOk() && !acts.resting('meet');
      return true;
    };
    const extra = async (id) => {
      state.segment = id;
      if (id === 'dance') {
        await say(pickFrom(show, 'danceStart', L.DANCE_LINES.start));
        acts.take({ act: 'dance' });
        if ((await danceFor()) === 'done') await say(pickFrom(show, 'danceAfter', L.DANCE_LINES.after));
        return true;
      }
      if (id === 'room') { await say(pickFrom(show, 'roomIntro', L.ROOM_INTRO)); return goRoom(nextRoom(look.room)); }
      if (id === 'outfit') { await say(pickFrom(show, 'outfitIntro', L.OUTFIT_INTRO)); return goOutfit(nextOutfit(look.outfit)); }
      if (id === 'song') {
        const part = !sangWhole && !acts.resting('sing_whole') && Date.now() - show.start > 25 * 60_000 ? 'whole' : pickFrom(show, 'songPart', SONG_ROTATION);
        acts.take({ act: 'sing', part });
        await singPart(part, { intro: true });
        return true;
      }
      if (id === 'market') return marketCheck();
      if (id === 'post') return showPost();
      if (id === 'replies') {
        const ok = await showReplies();
        if (!ok && !shown.replies.size) await say(L.REPLY_LINES.none);
        return ok;
      }
      if (id === 'video') return showVideo();
      if (id === 'eat') return eat(null);
      if (id === 'weather') return weather(null);
      if (id === 'meet') return meet();
      return false;
    };

    // a question: its card, she reads it (looks at it), her answer, and (2026-10-07) what the viewer asked her to do
    const question = async (qa) => {
      if (controls.skipped.has(qa.question.id)) { acts.release(qa.act); return false; }
      state.segment = 'questions';
      state.onAir = qa.question.id;
      beat();
      // (2026-10-07) a question in another of her languages: its name on the card, and she answers in it
      const lang = qa.lang && qa.lang !== 'en' ? langOf(qa.lang) : null;
      await studio('card', { kind: 'question', kicker: `Question · from ${askedBy(qa.question)}${lang ? ` · ${lang.native}` : ''}`, body: qa.question.text, ...(lang ? { lang: lang.code } : {}) });
      await studio('look', 'card');
      await sleep(1800);
      await studio('look', 'you');
      if (controls.skipped.has(qa.question.id)) {          // (the owner skipped it meanwhile)
        state.onAir = null;
        await studio('card', null);
        acts.release(qa.act);
        await site.done(showId, qa.question.id, 'skipped', 'owner').catch(() => {});
        return true;
      }
      if (controls.paused) { state.onAir = null; await studio('card', null); await putBack(qa); return true; }   // (after her break)
      const r = await say({ text: qa.reply, mood: qa.mood, ...(qa.lang ? { lang: qa.lang } : {}) }, { keep: false, audio: qa.audio ?? null, react: reactFor(qa.mood, { answer: true }),
        act: qa.feel && !qa.act ? qa.feel : null });
      state.onAir = null;
      if (r === 'done') { aired.push(qa.question.text); if (aired.length > 8) aired.shift(); }
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
      if (r === 'done' && qa.act) await doAct(qa.act);
      else if (qa.act && r !== 'pause' && r !== 'cut') acts.release(qa.act);
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
      prefetchChat();
      // the question she was answering when the owner paused her (or the stream started again): again, from the top
      if (held && !controls.paused && !controls.end && now < show.endsAt - PACE.OUTRO_MS) {
        const qa = held;
        held = null;
        await question(qa);
        didStep(show, { kind: 'question' }, Date.now());
        continue;
      }
      // (2026-10-07) a new $AGI buy or a new market cap step: her alert, between things (one every 90 seconds at most)
      if (alertDue(now) && !controls.paused && !controls.end && show.phase === 'main' && now < show.endsAt - PACE.OUTRO_MS) {
        await buyAlert();
        continue;
      }
      // (2026-10-07) the weather clears after a while
      if (where.weather && now > where.weatherUntil && !controls.paused && !controls.end) {
        await say(pickFrom(show, 'clear', T.WEATHER_CLEAR));
        await stopWeather();
        continue;
      }
      // (2026-10-07) a trip by herself, every 15 to 20 minutes (or home again, after a while away), between questions
      if (show.phase === 'main' && now > nextTripAt && !controls.paused && !controls.end && !holding() && now < show.endsAt - PACE.OUTRO_MS - 3 * 60_000
        && (controls.waiting === 0 || show.questionsInARow >= 2) && !acts.resting('trip')) {
        nextTripAt = now + 5 * 60_000;
        const home = where.place && (show.rnd() < 0.3 || now - where.since > 30 * 60_000);
        try { if (home) await goHome(); else await trip(T.nextPlace(where.visited, where.place, show.rnd), { mine: true }); } catch (err) { log.warn(`her trip: ${err.message}`); }
        didStep(show, { kind: 'chat' }, Date.now());
        continue;
      }
      const hold = holding();
      if (hold && controls.waiting > 0 && !ai.said && !controls.paused && !controls.end) {
        ai.said = true;
        state.segment = 'chat';
        await say(lagLine(show));
        continue;
      }
      const step = nextStep(show, { now, waiting: hold ? 0 : controls.waiting + (prepared ? 1 : 0), paused: controls.paused, end: controls.end, holding: hold && controls.waiting > 0, extraOk });
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
        // (2026-10-07) then what she can do, done right away, and what to try (a card)
        for (const sc of T.SHOWCASE) {
          if (stopping || controls.paused || controls.end) break;
          if (sc.card) await studio('card', T.TRY_CARD);
          if ((await say(sc.line)) !== 'done') break;
          if (sc.do?.act === 'jump') { await studio('jump', sc.do.times || 1); await sleep(1600); }
          else if (sc.do?.act === 'eat') { const at = Date.now(); await studio('eat', sc.do.to); for (const b of [1450, 3150]) sfx('crunch', { at: at + b + 120, gain: 0.9 }); await sleep(5600); }
          else if (sc.do?.act) { await studio('act', sc.do.act); await sleep(2700); }
          await sleep(300);
        }
        await sleep(3000);
        await studio('card', null);
      } else if (step.kind === 'outro') {
        state.status = 'ending'; state.segment = 'outro';
        await beat();
        mixer.stopMedia();
        await stopWeather();
        for (const line of L.OUTRO) { if ((await say(line)) !== 'done') break; await sleep(400); }
        await browser.page.evaluate(() => window.studio.overlay('ended', { sub: 'Follow @agi1dotapp for the next one' }));
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
      } else if (step.kind === 'extra') {
        if (controls.waiting > 0) prepare();
        let ok = false;
        try { ok = await extra(step.id); } catch (err) { log.warn(`her ${step.id}: ${err.message}`); }
        await studio('card', null);
        didStep(show, ok ? step : { ...step, skipped: true }, Date.now());
        state.segment = 'questions';
        continue;
      } else if (step.kind === 'pickup') {
        state.segment = 'chat';
        await say(pickupLine(show));
      } else if (step.kind === 'chat') {
        state.segment = 'chat';
        // (2026-10-07) something new, made ahead by the site's AI, when it's ready; else one of her pre-written lines
        const c = takeChat();
        if (c) await say(c.line, { keep: false, audio: c.audio, react: reactFor(c.line.mood, { answer: true }) });
        else await say(chatLine(show));
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
    await Promise.race([prepping, sleep(100)]);
    log.info(`show ${showId} ended: ${show.answered} questions answered, ${show.segmentsDone} segments, ${show.extrasDone} extras${x.on ? `, ${x.reads} X posts read` : ''}`);
    return { answered: show.answered, segments: show.segmentsDone, extras: show.extrasDone, problems: browser.problems.length };
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
  if (a.art) {
    const { makeArt } = await import('./art.mjs');
    const r = await makeArt({ only: a.artOnly, log: { log: (m) => console.log(m) } });
    process.exitCode = r.failed ? 1 : 0;
    return;
  }
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
    console.log(`the site keeps her next show as ${new Date(t).toISOString()} (since 2026-10-07 it's never shown to visitors)`);
    return;
  }
  const r = await runShow(a);
  if (r.problems) log.warn(`the page reported ${r.problems} problem(s): see above`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => { log.error(err.message); process.exitCode = 1; });
}
