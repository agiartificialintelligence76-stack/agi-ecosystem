// AGI Studio's share mark (2026-10-10, round 2: the owner's flywheel, "Share mark"): every photo and video people download
// carries a small "Made with AGI Studio · AI-generated · studio.agi1.app" pill (server/media/studio-mark.png, drawn once by
// tools/studio/mark.mjs with the site's own font), so each post that travels says where it was made and that it's AI.
//   • A photo: marked as it's downloaded (GET /api/launch?inf-dl=…, server/inf-api.js), with sharp: bottom right.
//   • A video: marked once by the studio's clock (/api/feed?studio: only that function ships ffmpeg, the
//     @ffmpeg-installer package's Linux binary, through vercel.json's includeFiles), one at a time and only with 14 s left:
//     top left (TikTok's, Reels' and Shorts' own buttons sit at the bottom right), its picture encoded again, its sound
//     copied as it is. The copy is kept beside it (inf/<influencer>/<job>.dl.mp4) and its downloads use it from then on;
//     until then (or after 3 tries that failed) the video downloads as it was made.
// The video as it plays on its page is never changed. (Round 4, phase 4: a long video is made in parts, each one encoded again
// with the mark as it's kept, then joined: its one copy, played and downloaded, carries the mark: encodePart, joinParts.)
import { readFileSync } from 'node:fs';
import { rpc } from './limits.js';
import { mp4Info } from './mp4.js';
import { videoPath, markedPath } from './inf-jobs.js';

export const MARK = {
  NEEDS_MS: 14_000,              // a video is marked only with this much of the clock's time left
  VIDEO_MAX: 40_000_000,         // the bucket's limit: the most read for one video
  SHARE: 0.36,                   // the mark's width, of the picture's shorter side
  MARGIN: 0.035,                 // its distance from the edges, of the shorter side
};
let markPng = null;
const markSource = () => (markPng ??= readFileSync(new URL('./media/studio-mark.png', import.meta.url)));

// The mark at the size for a picture of w × h (sharp) → { png, left, top } for the corner asked ('br' bottom right, 'tl' top left)
export async function markFor(sharp, w, h, corner = 'br') {
  const short = Math.max(1, Math.min(w, h));
  const width = Math.max(120, Math.round(short * MARK.SHARE));
  const png = await sharp(markSource()).resize({ width }).png().toBuffer();
  const meta = await sharp(png).metadata();
  const m = Math.round(short * MARK.MARGIN);
  return corner === 'tl' ? { png, left: m, top: m } : { png, left: Math.max(0, w - meta.width - m), top: Math.max(0, h - meta.height - m) };
}

// A photo with the mark (bottom right) → a JPEG, or null when it isn't a picture we read
export async function markPhoto(sharp, jpeg) {
  const meta = await sharp(jpeg, { limitInputPixels: 40_000_000 }).metadata().catch(() => null);
  if (!meta?.width || !meta?.height) return null;
  const { png, left, top } = await markFor(sharp, meta.width, meta.height, 'br');
  return sharp(jpeg, { limitInputPixels: 40_000_000 }).composite([{ input: png, left, top }]).jpeg({ quality: 90 }).toBuffer().catch(() => null);
}

// ---------- ffmpeg (only in /api/feed: vercel.json ships the binary with it) ----------
let ffmpegPath;
// → its path, or null where it isn't (it's never needed anywhere but the clock). FFMPEG_PATH chooses another one (the tests).
export async function ffmpegBin() {
  if (ffmpegPath !== undefined) return ffmpegPath;
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { createRequire } = await import('node:module');
  let bin = process.env.FFMPEG_PATH || null;
  if (!bin) {
    try {
      bin = path.join(path.dirname(createRequire(import.meta.url).resolve('@ffmpeg-installer/linux-x64/package.json')), 'ffmpeg');
    } catch { bin = null; }
  }
  if (!bin || !fs.existsSync(bin)) return (ffmpegPath = null);
  try {
    fs.accessSync(bin, fs.constants.X_OK);
    ffmpegPath = bin;
  } catch {
    // a bundle that lost the file's "runnable" mode: a copy in /tmp that has it
    const copy = '/tmp/agi1-ffmpeg';
    try {
      if (!fs.existsSync(copy)) fs.copyFileSync(bin, copy);
      fs.chmodSync(copy, 0o755);
      ffmpegPath = copy;
    } catch { ffmpegPath = null; }
  }
  return ffmpegPath;
}
export const forgetFfmpeg = () => { ffmpegPath = undefined; };   // (for the tests)

// ffmpeg's words for a video of w × h with the mark (a PNG at its size) top left: its picture encoded again (H.264, its
// pixels as they were), its sound copied as it is, its index first (it plays as it downloads)
export function markArgs({ input, mark, output, margin }) {
  return [
    '-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-i', input, '-i', mark,
    '-filter_complex', `[0:v][1:v]overlay=x=${margin}:y=${margin}:format=auto,format=yuv420p[v]`,
    '-map', '[v]', '-map', '0:a?', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-c:a', 'copy',
    '-movflags', '+faststart', output,
  ];
}

// A video with the mark → its MP4 · throws when ffmpeg isn't there, fails, or runs out of time (it's stopped)
export async function markVideo(sharp, bytes, { timeoutMs = 12_000, run = null } = {}) {
  const info = mp4Info(bytes);
  if (!info?.width || !info?.height) throw new Error('mark: not a video we read');
  const bin = run ? 'ffmpeg' : await ffmpegBin();
  if (!bin) throw Object.assign(new Error('mark: ffmpeg isn\'t here'), { why: 'no_ffmpeg' });
  const { mkdtemp, writeFile, readFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = await mkdtemp(join(tmpdir(), 'agi1-mark-'));
  try {
    const { png, left } = await markFor(sharp, info.width, info.height, 'tl');
    const input = join(dir, 'in.mp4'), mark = join(dir, 'mark.png'), output = join(dir, 'out.mp4');
    await Promise.all([writeFile(input, bytes), writeFile(mark, png)]);
    const args = markArgs({ input, mark, output, margin: left });
    await (run ? run(args, timeoutMs) : runFfmpeg(bin, args, timeoutMs));
    const out = await readFile(output);
    if (!mp4Info(out)?.width) throw new Error('mark: ffmpeg made no video');
    return out;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
// ---------- (round 4, phase 4) a long video's parts ----------
// Each part (Kling's MP4, with its sound) is encoded again as it's kept: the same size for every part (by its shape), 24
// frames a second, the mark top left, no sound (a long video is silent: its parts' sounds wouldn't join up), H.264 at about
// 2.5 Mb/s (a minute is about 19 MB: under the bucket's 40 MB a file), its index first. Then they're joined as they are
// (ffmpeg's concat, nothing encoded again: a tenth of a second). Measured 2026-10-11: a 15 s 720p part takes about 4.2 s on
// one core, its last frame 0.45 s, joining four 0.09 s.
export const PART = { SIZE: { tall: [720, 1280], wide: [1280, 720], square: [960, 960] }, FPS: 24, KBPS: 2500, NEEDS_MS: 14_000, JOIN_NEEDS_MS: 12_000 };
export function partArgs({ input, mark, output, margin, w, h }) {
  return [
    '-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-i', input, '-i', mark,
    '-filter_complex', `[0:v]scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${PART.FPS}[b];`
      + `[b][1:v]overlay=x=${margin}:y=${margin}:format=auto,format=yuv420p[v]`,
    '-map', '[v]', '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-b:v', `${PART.KBPS}k`, '-maxrate', `${Math.round(PART.KBPS * 1.2)}k`,
    '-bufsize', `${PART.KBPS * 2}k`, '-movflags', '+faststart', output,
  ];
}
// its last frame (the next part starts from it), from the part as Kling made it (its own pixels)
export const lastFrameArgs = ({ input, output }) => ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-sseof', '-0.3', '-i', input, '-frames:v', '1', '-q:v', '2', output];
// the parts joined as they are (each encoded the same way), its index first
export const joinArgs = ({ list, output }) => ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', output];

async function inTemp(fn) {
  const { mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = await mkdtemp(join(tmpdir(), 'agi1-part-'));
  try { return await fn(dir, join); } finally { await rm(dir, { recursive: true, force: true }).catch(() => {}); }
}
// A part, encoded again with the mark (and its last frame, unless it's the last part) → { video, frame } · throws when ffmpeg
// isn't there, fails, or runs out of time
export async function encodePart(sharp, bytes, { shape = 'tall', last = false, timeoutMs = 12_000, run = null } = {}) {
  if (!mp4Info(bytes)?.width) throw new Error('part: not a video we read');
  const bin = run ? 'ffmpeg' : await ffmpegBin();
  if (!bin) throw Object.assign(new Error('part: ffmpeg isn\'t here'), { why: 'no_ffmpeg' });
  const [w, h] = PART.SIZE[shape] || PART.SIZE.tall;
  const started = Date.now();
  return inTemp(async (dir, join) => {
    const { writeFile, readFile } = await import('node:fs/promises');
    const { png, left } = await markFor(sharp, w, h, 'tl');
    const input = join(dir, 'in.mp4'), mark = join(dir, 'mark.png'), output = join(dir, 'out.mp4'), frameOut = join(dir, 'last.jpg');
    await Promise.all([writeFile(input, bytes), writeFile(mark, png)]);
    const go = (args, ms) => (run ? run(args, ms) : runFfmpeg(bin, args, ms));
    await Promise.all([
      go(partArgs({ input, mark, output, margin: left, w, h }), timeoutMs),
      last ? null : go(lastFrameArgs({ input, output: frameOut }), timeoutMs),
    ]);
    const video = await readFile(output);
    if (!mp4Info(video)?.width) throw new Error('part: ffmpeg made no video');
    const frame = last ? null : await readFile(frameOut).catch(() => null);
    if (!last && !(frame && frame.length > 1000)) throw new Error('part: ffmpeg took no last frame');
    return { video, frame, ms: Date.now() - started };
  });
}
// The parts joined → its MP4 · throws when ffmpeg isn't there, fails, or runs out of time
export async function joinParts(parts, { timeoutMs = 9000, run = null } = {}) {
  if (!Array.isArray(parts) || parts.length < 2 || parts.some((p) => !mp4Info(p)?.width)) throw new Error('join: its parts aren\'t videos we read');
  const bin = run ? 'ffmpeg' : await ffmpegBin();
  if (!bin) throw Object.assign(new Error('join: ffmpeg isn\'t here'), { why: 'no_ffmpeg' });
  return inTemp(async (dir, join) => {
    const { writeFile, readFile } = await import('node:fs/promises');
    const names = parts.map((_, n) => join(dir, `p${n}.mp4`));
    await Promise.all(parts.map((p, n) => writeFile(names[n], p)));
    const list = join(dir, 'list.txt'), output = join(dir, 'joined.mp4');
    await writeFile(list, names.map((f) => `file '${f}'`).join('\n'));
    await (run ? run(joinArgs({ list, output }), timeoutMs) : runFfmpeg(bin, joinArgs({ list, output }), timeoutMs));
    const out = await readFile(output);
    if (!mp4Info(out)?.width) throw new Error('join: ffmpeg made no video');
    return out;
  });
}

async function runFfmpeg(bin, args, timeoutMs) {
  const { spawn } = await import('node:child_process');
  await new Promise((resolve, reject) => {
    const p = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { if (err.length < 2000) err += d; });
    const timer = setTimeout(() => { p.kill('SIGKILL'); reject(new Error('mark: ffmpeg ran out of time')); }, timeoutMs);
    p.on('error', (e) => { clearTimeout(timer); reject(new Error(`mark: ffmpeg didn't start (${e.code || e.message})`)); });
    p.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`mark: ffmpeg stopped (${code}): ${err.replace(/\s+/g, ' ').trim().slice(0, 200)}`));
    });
  });
}

// ---------- the clock ----------
// One done video marked (the newest first), when there's time: → { marked: id } · { none: true } (nothing to mark) ·
// { later: true } (not enough time left) · { failed: id } (tried again on a later minute: 3 tries at most)
export async function markClock(cfg, { deadline, files = null, run = null } = {}) {
  if (deadline - Date.now() < MARK.NEEDS_MS) return { later: true };
  if (!run && !await ffmpegBin()) return { none: true, why: 'no_ffmpeg' };
  const job = await rpc(cfg, 'inf_mark_take', {}, 'studio');
  if (!job?.id || !job.inf_id) return { none: true };
  const F = files || await import('./studio-files.js');
  try {
    const left = () => deadline - Date.now();
    const bytes = await F.getFile(cfg, videoPath({ kind: job.kind, id: job.id, inf_id: job.inf_id }), { max: MARK.VIDEO_MAX, timeoutMs: Math.min(6000, left() - 7000) });
    if (!bytes) throw new Error('mark: its video isn\'t there');
    const sharp = await F.loadSharp();
    const marked = await markVideo(sharp, bytes, { timeoutMs: Math.max(3000, left() - 4000), run });
    await F.putFile(cfg, markedPath(job.inf_id, job.id), marked, 'video/mp4', { timeoutMs: Math.max(2000, Math.min(9000, left() - 500)) });
    await rpc(cfg, 'inf_mark_done', { p_job: job.id }, 'studio');
    return { marked: job.id };
  } catch (err) {
    console.warn(`[studio] marking video ${job.id} (try ${job.tries} of 3): ${err.message}`);
    return { failed: job.id };
  }
}
