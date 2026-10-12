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
// (2026-10-12, the video editor) A video saved from the video editor is made here too, by the clock, in pieces of 5 seconds
// (cutPlan, cutPieces) joined with its sound or none (joinCut): its part, its crop at its shape's size, its words and stickers
// (the picture its maker's browser drew), the mark top left: its one copy, played and downloaded, carries the mark.
import { readFileSync } from 'node:fs';
import { rpc } from './limits.js';
import { mp4Info, mp4HasSound } from './mp4.js';
import { videoPath, markedPath, aiTagged } from './inf-jobs.js';
import { cutSize, cropPixels, asItIs } from '../src/studio/video-edit.js';

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

// ---------- (2026-10-12) the video editor's cut ----------
// One part of a video (1 to 15 s: ffmpeg seeks to where it starts, then reads only that long), its crop (at exactly its shape's
// size: src/studio/video-edit.js cropPixels, even and inside the picture), made that size at 24 frames a second, with its
// maker's words and stickers (one transparent PNG at that size, drawn in their browser: our server needs no fonts) and the mark
// top left over them; H.264 at about 2.5 Mb/s (15 s is about 5 MB). One core makes 15 s of a 1080p video in about 13 s
// (measured 2026-10-12), more than one minute of the clock may have, so it's made in pieces of 5 seconds, as many as a minute
// has time for (each exactly its frames, without sound, kept until they're all made: server/inf-cut.js), then joined as they
// are with its sound (from the video it's cut from: AAC, 128 kb/s, stereo) or none, its index first. A video whose mark is in
// it already (a long video, or one saved from the video editor: video-edit.js ownMark) is only ever cut as it is (its own
// shape, the whole picture: its mark where it was), and given no second one.
export const CUT = {
  PIECE_S: 5,                    // a piece's seconds (the last one up to a second more, never under one on its own)
  NEEDS_MS: 11_000,              // the clock's time a piece needs left: its video read (about 1 s), a piece made (4 to 7 s on
                                 // one core from a 1080p video, measured 2026-10-12) and kept
  KEEP_MS: 2_500,                // …of which, keeping what was made and saying so
  JOIN_NEEDS_MS: 6_000,          // its pieces joined with its sound (half a second to 2 s), and kept
  CHECK_NEEDS_MS: 14_000,        // its look (Gemini's, before anyone sees it)
  PRESET: 'superfast',           // x264's: a fifth faster than veryfast, at about the same size
  SOURCE_MAX: 40_000_000,        // the most read for the video it's cut from (the bucket's limit)
  LAYER_MAX: 4_000_000,          // its words' and stickers' picture
  FPS: 24, KBPS: 2500, SOUND_KBPS: 128,
  NEAR_END_S: 0.5,               // a part must start at least this long before its video's end
  MORE: 1.3,                     // another piece in the same minute: when the time left is this many times the last one's
};
const sec = (v) => (Math.round(Number(v) * 1000) / 1000).toFixed(3);
const cutNo = (what) => Object.assign(new Error(`cut: ${what}`), { why: 'cut' });
// How a cut (video-edit.js cutSpec's, checked: { start, length, shape, src, box, sound }) of a video (mp4Info's) is made: its
// size, its crop, its seconds (its frames over 24: as long as asked, or to its video's end) and its pieces ({ k, from: seconds
// into the cut, frames }) → { w, h, crop, start, seconds, frames, pieces } · throws (why 'cut') when it can't be that video's (not
// the video its page measured, or a part that starts past its end; one with its mark asked for more than its whole picture).
// own: the video carries its mark already
export function cutPlan(info, cut, { own = false } = {}) {
  if (!info?.width || !info?.height) throw cutNo('not a video we read');
  const [srcW, srcH] = Array.isArray(cut?.src) ? cut.src : [];
  if (!(Math.abs(info.width - srcW) <= 2 && Math.abs(info.height - srcH) <= 2)) throw cutNo(`its video is ${info.width}×${info.height}, not ${srcW}×${srcH}`);
  if (own && !asItIs(cut)) throw cutNo('its mark is in it already: it can only be cut as it is');
  const size = cutSize(cut.shape, srcW, srcH);
  if (!size) throw cutNo('no size');
  const [w, h] = size;
  const start = Number(cut.start);
  let seconds = Number(cut.length);
  if (!(Number.isFinite(start) && start >= 0 && Number.isFinite(seconds) && seconds > 0)) throw cutNo('no part');
  if (Number.isFinite(info.seconds) && info.seconds > 0) {
    if (start > info.seconds - CUT.NEAR_END_S) throw cutNo(`it starts at ${start} s, and its video is ${info.seconds.toFixed(1)} s`);
    seconds = Math.min(seconds, info.seconds - start);
  }
  const frames = Math.max(1, Math.round(seconds * CUT.FPS));
  const per = CUT.PIECE_S * CUT.FPS;
  let n = Math.ceil(frames / per);
  if (n > 1 && frames - (n - 1) * per < CUT.FPS) n -= 1;   // a last piece under a second goes into the one before
  const pieces = Array.from({ length: n }, (_, k) => ({ k, from: k * CUT.PIECE_S, frames: k < n - 1 ? per : frames - k * per }));
  return { w, h, crop: cropPixels(cut.box, info.width, info.height, w, h), start, seconds: frames / CUT.FPS, frames, pieces };
}
// ffmpeg's words for a piece: input the video from where the piece starts (and its layer, and the mark, each a still picture
// overlaid on every frame), exactly its frames, no sound
export function pieceArgs({ input, layer = null, mark = null, output, at, frames, crop, w, h, margin = 0 }) {
  const args = ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-ss', sec(at), '-t', sec(frames / CUT.FPS + 0.5), '-i', input];
  const graph = [`[0:v]crop=${crop.w}:${crop.h}:${crop.x}:${crop.y},scale=${w}:${h}:flags=bicubic,setsar=1,fps=${CUT.FPS}[base]`];
  let at2 = 'base', n = 0;
  if (layer) {
    args.push('-i', layer);
    n += 1;
    graph.push(`[${at2}][${n}:v]overlay=x=0:y=0:format=auto[words]`);
    at2 = 'words';
  }
  if (mark) {
    args.push('-i', mark);
    n += 1;
    graph.push(`[${at2}][${n}:v]overlay=x=${margin}:y=${margin}:format=auto[marked]`);
    at2 = 'marked';
  }
  graph.push(`[${at2}]format=yuv420p[v]`);
  return [
    ...args, '-filter_complex', graph.join(';'), '-map', '[v]', '-an', '-frames:v', String(frames),
    '-c:v', 'libx264', '-preset', CUT.PRESET, '-b:v', `${CUT.KBPS}k`, '-maxrate', `${Math.round(CUT.KBPS * 1.2)}k`, '-bufsize', `${CUT.KBPS * 2}k`,
    '-movflags', '+faststart', output,
  ];
}
// ffmpeg's words for its pieces joined as they are (each encoded alike), with its sound from the video it's cut from (source:
// only when that video has one and its maker kept it on) or none
export function cutJoinArgs({ list, source = null, output, start = 0, seconds = 0 }) {
  const args = ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-f', 'concat', '-safe', '0', '-i', list];
  if (source) args.push('-ss', sec(start), '-t', sec(seconds), '-i', source);
  return [
    ...args, '-map', '0:v',
    ...(source ? ['-map', '1:a:0', '-c:a', 'aac', '-b:a', `${CUT.SOUND_KBPS}k`, '-ac', '2', '-shortest'] : ['-an']),
    '-c:v', 'copy', '-movflags', '+faststart', output,
  ];
}
// Its pieces from piece `from` on, made one after another while there's time: the first always (it has its own time: until),
// another only when the time left before `until` (a time, in ms) is CUT.MORE times what the last one took. A piece that fails
// after one was made ends it (what was made is kept): the first throws. → { pieces: [{ k, video, ms }] } · throws when ffmpeg
// isn't there, fails or runs out of time on its first piece. own: the video carries its mark already. layer: its words' and
// stickers' PNG, or null.
export async function cutPieces(sharp, bytes, { plan, from = 0, layer = null, own = false, until, run = null }) {
  const bin = run ? 'ffmpeg' : await ffmpegBin();
  if (!bin) throw Object.assign(new Error('cut: ffmpeg isn\'t here'), { why: 'no_ffmpeg' });
  return inTemp(async (dir, join) => {
    const { writeFile, readFile } = await import('node:fs/promises');
    const input = join(dir, 'in.mp4');
    const layerFile = layer ? join(dir, 'layer.png') : null;
    let markFile = null, margin = 0;
    const writes = [writeFile(input, bytes)];
    if (layerFile) writes.push(writeFile(layerFile, layer));
    if (!own) {
      const m = await markFor(sharp, plan.w, plan.h, 'tl');
      markFile = join(dir, 'mark.png');
      margin = m.left;
      writes.push(writeFile(markFile, m.png));
    }
    await Promise.all(writes);
    const made = [];
    for (const p of plan.pieces.slice(from)) {
      const left = until - Date.now();
      if (made.length && left < made[made.length - 1].ms * CUT.MORE) break;
      if (left < 1000) break;
      const output = join(dir, `p${p.k}.mp4`);
      const args = pieceArgs({ input, layer: layerFile, mark: markFile, output, at: plan.start + p.from, frames: p.frames, crop: plan.crop, w: plan.w, h: plan.h, margin });
      const t0 = Date.now();
      try {
        await (run ? run(args, left) : runFfmpeg(bin, args, left));
        const video = await readFile(output);
        if (!mp4Info(video)?.width) throw new Error('cut: ffmpeg made no piece');
        made.push({ k: p.k, video, ms: Date.now() - t0 });
      } catch (err) {
        if (!made.length) throw err;
        console.warn(`[studio] a cut's piece ${p.k + 1} (it keeps the ${made.length} made): ${err.message}`);
        break;
      }
    }
    return { pieces: made };
  });
}
// Its pieces (all of them, in order) joined, with its sound (source: the video it's cut from, when its maker kept the sound on
// and it has one) → { video, seconds, sound, width, height } · throws when ffmpeg isn't there, fails or runs out of time
export async function joinCut(pieces, { plan, source = null, timeoutMs = 6000, run = null }) {
  if (!Array.isArray(pieces) || !pieces.length || pieces.length !== plan.pieces.length || pieces.some((p) => !mp4Info(p)?.width)) throw new Error('cut: its pieces aren\'t videos we read');
  const bin = run ? 'ffmpeg' : await ffmpegBin();
  if (!bin) throw Object.assign(new Error('cut: ffmpeg isn\'t here'), { why: 'no_ffmpeg' });
  return inTemp(async (dir, join) => {
    const { writeFile, readFile } = await import('node:fs/promises');
    const names = pieces.map((_, n) => join(dir, `p${n}.mp4`));
    await Promise.all(pieces.map((p, n) => writeFile(names[n], p)));
    const list = join(dir, 'list.txt'), output = join(dir, 'cut.mp4');
    await writeFile(list, names.map((f) => `file '${f}'`).join('\n'));
    let input = null;
    if (source) {
      input = join(dir, 'in.mp4');
      await writeFile(input, source);
    }
    const args = cutJoinArgs({ list, source: input, output, start: plan.start, seconds: plan.seconds });
    await (run ? run(args, timeoutMs) : runFfmpeg(bin, args, timeoutMs));
    const video = await readFile(output);
    const out = mp4Info(video);
    if (!out?.width) throw new Error('cut: ffmpeg made no video');
    return { video, seconds: out.seconds ?? plan.seconds, sound: mp4HasSound(video) === true, width: out.width, height: out.height };
  });
}
// The share mark's own picture's size (the page clears a video's words where its mark already is: server/inf-cut.js)
export async function markSize(sharp) {
  const meta = await sharp(markSource()).metadata();
  return { width: meta.width, height: meta.height };
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
    await F.putFile(cfg, markedPath(job.inf_id, job.id), aiTagged(marked), 'video/mp4', { timeoutMs: Math.max(2000, Math.min(9000, left() - 500)) });
    if (await rpc(cfg, 'inf_mark_done', { p_job: job.id }, 'studio') !== true) {
      // (2026-10-12) its maker deleted it while it was being marked: the copy just kept goes too
      await F.deleteFiles(cfg, [markedPath(job.inf_id, job.id)]).catch(() => 0);
      return { gone: job.id };
    }
    return { marked: job.id };
  } catch (err) {
    console.warn(`[studio] marking video ${job.id} (try ${job.tries} of 3): ${err.message}`);
    return { failed: job.id };
  }
}
