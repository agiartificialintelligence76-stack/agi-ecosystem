// AGI-1's daily clips (2026-09-29, the owner's idea "video"; the owner's choice: "you post by hand"). Makes today's vertical
// clip (1080 × 1920, 30 frames a second, MP4 with her voice and her captions) for the owner to download and post by hand
// on X, TikTok, Reels and Shorts. Nothing is ever posted from here (hard rule 6).
// Only her diary: her newest entry, as /diary shows it. Never another coin (the owner, the same day: "why are u promoting
// other coins in the video … the founder of the launchpad will get angry"): the clips don't even read clank.trade.
// Her words: tools/clips/lines.js; her voice: Gemini's speech model (Despina, like the site: one request a clip); she's
// AGI-1 in 2D, drawn frame by frame (tools/clips/page/).
//
//   node tools/clips/make.mjs [--out clips] [--fake-voice] [--facts facts.json]
//     --fake-voice   a stand-in hum instead of her voice (no Google, no key, no cost: to try it out)
//     --facts f.json the day's facts from a file instead of the site ({ now, diary: { day, entry, mood } })
// GitHub runs it once a day (.github/workflows/clips.yml). Needs GEMINI_API_KEY (not with --fake-voice), Chrome or
// Chromium, ffmpeg and playwright-core (the workflow installs the last two; they aren't part of the site).
import { readFileSync, writeFileSync, mkdirSync, existsSync, createReadStream, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { resolve, dirname, join, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { diaryClip, spokenOf, postOf, LABEL } from './lines.js';
import { readWav, writeWav, pad, talkTrack, pauses, fakeVoice } from './audio.js';
import { timeCaptions, reactionTimes } from './captions.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const FPS = 30, BEFORE = 0.45, AFTER = 1.7;
const KINDS = ['diary'];
const DAY = 86_400_000;
const FRAME_TIMEOUT = 30_000;                 // a frame that takes longer than this: something is stuck (a frame takes ~0.2 s)
const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10);
// what the browser and ffmpeg get of this computer's settings: never a key, a secret or a token
export const withoutSecrets = (env = process.env) => Object.fromEntries(Object.entries(env).filter(([k]) => !/KEY|SECRET|TOKEN|PASS/i.test(k)));

// ---------- the day's facts: her newest diary entry, from the site (nothing else is read) ----------
export async function gather(now = Date.now(), { site = 'https://agi1.app' } = {}) {
  const facts = { now, diary: null, problems: [] };
  try {
    const res = await fetch(`${site.replace(/\/+$/, '')}/api/diary?limit=1`, { signal: AbortSignal.timeout(10_000) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`HTTP ${res.status}${body?.error ? ` ${body.error}` : ''}`);
    facts.diary = body?.entries?.[0] || null;
  } catch (err) { facts.problems.push(`her diary (${err.message})`); }
  return facts;
}

// ---------- what the clip says ----------
export function clipsFor(facts, only = KINDS) {
  const { now } = facts;
  const out = [];
  // her newest entry, if it's about yesterday (or today): it's written just after midnight UTC, so a night it failed
  // never makes yesterday's clip again
  const d = facts.diary;
  if (d?.day && only.includes('diary') && d.day >= dayOf(now - DAY)) {
    const clip = diaryClip(d);
    if (clip) out.push(clip);
  }
  return out.map((c, i) => ({ ...c, n: i + 1, spoken: spokenOf(c.text) }));
}

// ---------- her voice ----------
async function herVoice(words, mood) {
  const { getConfig } = await import('../../server/config.js');
  const { speakAsAgi1, styleFor } = await import('../../server/voice.js');
  const cfg = getConfig();
  if (!cfg.geminiKey) throw new Error('GEMINI_API_KEY is missing (add it as a GitHub secret, or use --fake-voice)');
  let last = null;
  for (const model of cfg.voiceModels) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return { wav: await speakAsAgi1({ ...cfg, voiceModel: model }, words, styleFor(mood), { timeoutMs: 60_000 }), model };
      } catch (err) {
        last = err;
        console.warn(`[clips] ${model}: ${err.message}`);                                  // (server/gemini.js hides the key)
        if (err.credits || [400, 401, 403].includes(err.httpStatus)) throw err;              // the key or the credits: stop
        const wait = err.httpStatus === 429 && !err.perDay ? Math.min(30, err.retryAfter ?? 10) : 0;
        if (!wait || attempt) break;                                                          // used up for today: next model
        await new Promise((r) => { setTimeout(r, wait * 1000); });
      }
    }
  }
  throw last || new Error('no speech model to ask');
}

// ---------- the renderer page and a browser ----------
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
async function buildPage() {
  const { build } = await import('vite');
  const outDir = join(ROOT, 'tools/clips/dist');
  await build({
    configFile: false, logLevel: 'warn', root: join(ROOT, 'tools/clips/page'), publicDir: join(ROOT, 'public'), base: '/',
    build: { outDir, emptyOutDir: true, chunkSizeWarningLimit: 4000, copyPublicDir: true },
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
const BROWSERS = ['/opt/pw-browsers/chromium', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/opt/google/chrome/chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
// CHROME_PATH if set, else the Chromium playwright-core downloaded (npx playwright-core install chromium: the one it's
// tested with), else a Chrome or Chromium the computer has; the first that starts
async function openBrowser() {
  let chromium;
  try { ({ chromium } = await import('playwright-core')); } catch {
    throw new Error('playwright-core is missing: npm install --no-save playwright-core');
  }
  let own = null;
  try { own = chromium.executablePath(); } catch { /* not downloaded */ }
  const paths = [...new Set([process.env.CHROME_PATH, own, ...BROWSERS])].filter((p) => p && existsSync(p));
  if (!paths.length) throw new Error('no Chrome or Chromium found (set CHROME_PATH, or: npx playwright-core install chromium)');
  let last = null;
  for (const executablePath of paths) {
    try {
      // WebGL without a graphics card: Chrome's own software renderer
      return await chromium.launch({
        executablePath, env: withoutSecrets(),
        args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
      });
    } catch (err) { last = err; console.warn(`[clips] couldn't start ${executablePath}: ${err.message.split('\n')[0]}`); }
  }
  throw last;
}

// ---------- one clip ----------
// ffmpeg turns the pictures (JPEG, one after another on its input) and her voice into an MP4. If ffmpeg stops early, the
// next write fails at once (never waits forever); kill() ends it when the clip fails halfway.
export function encode(wavFile, mp4, { command = 'ffmpeg', args = null } = {}) {
  const ff = spawn(command, args || ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-i', wavFile,
    '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
    '-r', String(FPS), '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-shortest', '-movflags', '+faststart', mp4], { stdio: ['pipe', 'ignore', 'inherit'], env: withoutSecrets() });
  let failed = null, finished = false;
  const done = new Promise((ok, fail) => {
    ff.on('error', fail);
    ff.on('close', (code, signal) => (code === 0 ? ok() : fail(new Error(`ffmpeg stopped (${signal || `exit ${code}`})`))));
  });
  done.then(() => { finished = true; }, (err) => { failed = err; finished = true; });
  // (settles only if ffmpeg stops while frames are still coming: every write waits for this or for its own frame)
  const early = done.then(() => { throw new Error('ffmpeg stopped before the last frame'); });
  early.catch(() => {});
  ff.stdin.on('error', (err) => { failed ||= new Error(`ffmpeg's input broke (${err.code || err.message})`); });
  const write = (buf) => {
    if (failed) return Promise.reject(failed);
    if (finished) return Promise.reject(new Error('ffmpeg already stopped'));
    return Promise.race([new Promise((ok) => { if (ff.stdin.write(buf)) ok(); else ff.stdin.once('drain', ok); }), early]);
  };
  return {
    write,
    end: () => { if (!failed) ff.stdin.end(); return done; },
    kill: () => { if (!finished) { try { ff.kill('SIGKILL'); } catch { /* already gone */ } } },
  };
}
// what `promise` gives, or an error after `ms`
const inTime = (promise, ms, what) => Promise.race([promise, new Promise((_, fail) => { setTimeout(() => fail(new Error(`${what} took more than ${ms / 1000} s`)), ms).unref?.(); })]);

export async function makeClip(browser, url, clip, voiceWav, { outDir, stamp, seed }) {
  const { rate, samples: raw } = readWav(voiceWav);
  const samples = pad(raw, rate, BEFORE, AFTER);
  const talk = Array.from(talkTrack(samples, rate, FPS), (x) => +x.toFixed(3));
  const cues = timeCaptions(clip.text, pauses(samples, rate));
  const reactions = reactionTimes(cues, clip.cues);
  const frames = Math.ceil((samples.length / rate) * FPS);
  const tmp = join(tmpdir(), `agi1-clip-${process.pid}-${clip.n}.wav`);
  writeFileSync(tmp, writeWav(samples, rate));
  const name = `${stamp}-${clip.n}-${clip.kind}`;
  const files = ['mp4', 'jpg', 'txt'].map((x) => join(outDir, `${name}.${x}`));
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const problems = [];
  page.on('pageerror', (e) => problems.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' || /context lost/i.test(m.text())) problems.push(m.text()); });
  let ff = null, speed = null, made = false;
  try {
    await inTime(page.goto(url), 60_000, 'opening the page');
    await inTime(page.waitForFunction(() => window.clip, null, { timeout: 30_000 }), 35_000, 'the page');
    await inTime(page.evaluate(() => window.clip.load()), 60_000, 'loading her');
    await page.evaluate((spec) => window.clip.start(spec), {
      kind: clip.kind, kicker: clip.kicker, title: clip.title, meta: clip.meta, label: LABEL, site: 'agi1.app', cues, reactions, talk, frames, seed,
    });
    ff = encode(tmp, files[0]);
    const coverAt = Math.min(frames - 1, Math.round(1.6 * FPS));
    for (let i = 0; i < frames; i++) {
      const jpg = Buffer.from(await inTime(page.evaluate((k) => window.clip.frame(k), i), FRAME_TIMEOUT, `frame ${i}`), 'base64');
      if (problems.length) throw new Error(`the page went wrong at frame ${i}: ${problems[0].slice(0, 160)}`);
      if (i === coverAt) writeFileSync(files[1], jpg);
      await ff.write(jpg);
    }
    await ff.end();
    const t = await page.evaluate(() => window.clip.times());
    speed = Object.fromEntries(Object.entries(t).filter(([k]) => k !== 'n').map(([k, v]) => [k, Math.round(v / Math.max(1, t.n))]));
    writeFileSync(files[2], `${postOf(clip)}\n`);
    made = true;
  } finally {
    ff?.kill();
    await page.close().catch(() => {});
    rmSync(tmp, { force: true });
    if (!made) for (const f of files) rmSync(f, { force: true });          // a clip that failed halfway is never left behind
  }
  return { name, seconds: +(samples.length / rate).toFixed(1), frames, cues: cues.length, speed };
}

// ---------- the whole day ----------
function args(argv) {
  const a = { out: 'clips', only: KINDS, fake: false, facts: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') a.out = argv[++i];
    else if (argv[i] === '--only') a.only = argv[++i].split(',').filter((k) => KINDS.includes(k));
    else if (argv[i] === '--fake-voice') a.fake = true;
    else if (argv[i] === '--facts') a.facts = argv[++i];
    else throw new Error(`unknown option ${argv[i]}`);
  }
  return a;
}
const readme = (stamp, made, failed, problems, fake) => `AGI-1's clip for ${stamp}${fake ? ' (TRIAL: a stand-in hum instead of her voice)' : ''}

${made.map((m) => `${m.name}.mp4  ${m.seconds} s  ${m.about}`).join('\n') || '(none today: her diary had no new entry to read)'}
${failed.length ? `\nNot made: ${failed.join('; ')}\n` : ''}${problems.length ? `\nCouldn't read: ${problems.join('; ')}\n` : ''}
How to post it (by hand; nothing was posted anywhere):
- Watch it first.
- The .txt file has a post to paste with it, and the .jpg is a cover picture.
- Every clip says "AI-generated · not financial advice" on screen. When you upload, also switch on the app's own
  AI label when it has one: TikTok "AI-generated content", YouTube "Altered or synthetic content: yes",
  Instagram "AI label".
- Never add price talk, "number go up" or "buy" to the post.
`;
// a note on the run's page on GitHub (Actions shows these as warnings)
const warn = (text) => { console.warn(`[clips] ${text}`); if (process.env.GITHUB_ACTIONS) console.log(`::warning::${text.replace(/\r?\n/g, ' ')}`); };

async function main() {
  const a = args(process.argv.slice(2));
  const now = Date.now();
  const stamp = dayOf(now);
  const outDir = resolve(a.out);
  mkdirSync(outDir, { recursive: true });
  const facts = a.facts ? { ...JSON.parse(readFileSync(a.facts, 'utf8')), problems: [] } : await gather(now, { site: process.env.SITE_URL || 'https://agi1.app' });
  const clips = clipsFor({ ...facts, now: facts.now || now }, a.only);
  console.log(`[clips] ${clips.length} clip${clips.length === 1 ? '' : 's'} to make: ${clips.map((c) => c.kind).join(', ') || 'none'}`);
  for (const p of facts.problems) warn(`couldn't read ${p}`);
  const made = [], failed = [];
  let server = null, browser = null;
  try {
    const served = await serve(await buildPage());
    server = served.server;
    browser = await openBrowser();
    for (const clip of clips) {
      try {
        const t0 = Date.now();
        const voice = a.fake ? { wav: fakeVoice(clip.spoken), model: 'stand-in' } : await herVoice(clip.spoken, clip.voice);
        const seed = [...`${stamp}:${clip.kind}`].reduce((x, ch) => (x * 31 + ch.charCodeAt(0)) >>> 0, 7);
        const m = await makeClip(browser, served.url, clip, voice.wav, { outDir, stamp, seed });
        made.push({ ...m, about: `${clip.kicker}: ${clip.title}` });
        console.log(`[clips] ${m.name}.mp4: ${m.seconds} s, ${m.frames} frames, voice ${voice.model}, made in ${Math.round((Date.now() - t0) / 1000)} s`
          + ` (ms a frame: ${Object.entries(m.speed || {}).map(([k, v]) => `${k} ${v}`).join(', ')})`);
      } catch (err) {
        failed.push(`${clip.kind} (${err.message.slice(0, 160)})`);
        warn(`${clip.kind} not made: ${err.message}`);
      }
    }
  } finally {
    await browser?.close().catch(() => {});
    server?.close();
    writeFileSync(join(outDir, 'README.txt'), readme(stamp, made, failed, facts.problems, a.fake));
  }
  // no new diary entry is a quiet day (green); a clip that should have been made and wasn't is red
  if (failed.length && !made.length) { console.error('[clips] no clip was made today'); process.exitCode = 1; }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => { console.error(`[clips] ${err.message}`); if (process.env.GITHUB_ACTIONS) console.log(`::error::${err.message}`); process.exitCode = 1; });
}
