// AGI-1's live show (2026-10-07, the owner: "react to her own X posts/videos and replies (with visuals and not)"): her
// videos and pictures on her TV (tools/live/page/fx.js), played from the runner's own disk (the page reads /media/…).
//   • her videos: from a folder on the owner's server (/opt/agi1-live/videos, given to the show as /videos: any of her own
//     videos the owner puts there, like her launch video or her daily clips), and from her own posts on X (tools/live/x.js);
//   • each is made once into what her set's browser can play (Playwright's Chromium has no H.264: VP8 in WebM, 640 px wide,
//     no sound) and its sound into the stream's own (48 kHz stereo, played by the runner in step with the picture), both kept
//     on the server's disk; at most 4 minutes of a video;
//   • a picture from one of her X posts: downloaded once (JPEG, PNG or WebP, 5 MB at most).
// A video can have a few words about it next to it (the same name, .txt: its first line), which she reacts to.
// (2026-10-09, the owner: "when she sings the full lyrics on the subtitle must shown with the full video on the live as
// well") her song's music video goes in the same folder, named after the song (feel-the-agi.mp4): it's never one of her
// videos on her TV, but the picture of her song, full screen while she sings it (findSongVideo, prepareSongVideo).
import { existsSync, readdirSync, statSync, readFileSync, writeFileSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, extname, basename } from 'node:path';
import { spawn } from 'node:child_process';
import { withoutSecrets } from '../clips/make.mjs';

export const MEDIA_RATE = 48000;
export const VIDEO_MAX_S = 240;
export const VIDEO_TYPES = ['.mp4', '.webm', '.mov', '.m4v', '.mkv'];
const MEDIA_VERSION = 1;
// what the page may read from /media/: only the files made here (24 hex characters, then .webm, .jpg, .png or .webp)
export const MEDIA_NAME = /^[0-9a-f]{24}\.(?:webm|jpg|png|webp)$/;

// her songs' music videos are named after them (tools/live/songs/<id>.json): feel-the-agi.mp4
export const SONG_IDS = ['feel-the-agi'];
const songVideo = (n) => SONG_IDS.includes(basename(n, extname(n)).toLowerCase());
// the videos the owner put in the folder: [{ file, title, about }] (newest first; files of 500 MB or more are left out;
// never a song's music video: that one is her song's own picture)
export function listVideos(dir) {
  if (!dir || !existsSync(dir)) return [];
  let names = [];
  try { names = readdirSync(dir); } catch { return []; }
  return names.filter((n) => VIDEO_TYPES.includes(extname(n).toLowerCase()) && !n.startsWith('.') && !songVideo(n))
    .map((n) => {
      const file = join(dir, n);
      let st;
      try { st = statSync(file); } catch { return null; }
      if (!st.isFile() || st.size > 500 * 1024 * 1024 || st.size < 1000) return null;
      const stem = basename(n, extname(n));
      let about = '';
      try { about = readFileSync(join(dir, `${stem}.txt`), 'utf8').split(/\r?\n/).find((x) => x.trim()) || ''; } catch { /* none */ }
      return { file, title: titleOf(stem), about: about.trim().slice(0, 200), mtime: st.mtimeMs, size: st.size };
    })
    .filter(Boolean)
    .sort((a, b) => b.mtime - a.mtime);
}
// "agi1-launch_video (final)" → "agi1 launch video (final)"
export const titleOf = (stem) => String(stem).replace(/[_]+/g, ' ').replace(/(?<=\w)-(?=\w)/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
export const mediaKey = (file, size, mtime) => createHash('sha256').update(`${MEDIA_VERSION}:${file}:${size}:${Math.round(mtime)}`).digest('hex').slice(0, 24);

// (made at a lower priority than her show, when the server has `nice`: her set is drawn first)
export const NICE = existsSync('/usr/bin/nice') ? '/usr/bin/nice' : null;
const ff = (args, { run = spawn, out = false, nice = NICE } = {}) => new Promise((ok, fail) => {
  const cmd = nice ? [nice, ['-n', '15', 'ffmpeg', '-v', 'error', ...args]] : ['ffmpeg', ['-v', 'error', ...args]];
  const p = run(cmd[0], cmd[1], { stdio: ['ignore', out ? 'pipe' : 'ignore', 'pipe'], env: withoutSecrets() });
  const chunks = [];
  let err = '';
  if (out) p.stdout.on('data', (d) => chunks.push(d));
  p.stderr?.on('data', (d) => { err += d; });
  p.on('error', fail);
  p.on('exit', (code) => (code === 0 ? ok(out ? Buffer.concat(chunks) : null) : fail(new Error(`ffmpeg (${code}): ${err.trim().slice(-200)}`))));
});
// how long a video is (seconds), from ffprobe; null when it can't tell
export function probeSeconds(file, { run = spawn } = {}) {
  return new Promise((ok) => {
    let text = '';
    let p;
    try { p = run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { stdio: ['ignore', 'pipe', 'ignore'], env: withoutSecrets() }); } catch { ok(null); return; }
    p.stdout.on('data', (d) => { text += d; });
    p.on('error', () => ok(null));
    p.on('exit', () => { const s = Number.parseFloat(text); ok(Number.isFinite(s) && s > 0 ? s : null); });
  });
}
// the ffmpeg arguments that make a video her TV can play: VP8 in WebM, at most 640 px wide and 24 frames a second, no
// sound, at most VIDEO_MAX_S seconds; made fast (her show runs on the same processor)
export const videoArgs = (file, out) => ['-y', '-i', file, '-t', String(VIDEO_MAX_S), '-an', '-sn', '-dn',
  '-vf', "scale='min(640,iw)':-2:flags=bilinear,fps=24,format=yuv420p", '-c:v', 'libvpx', '-b:v', '900k', '-crf', '12', '-deadline', 'realtime', '-cpu-used', '8',
  '-threads', '1', '-auto-alt-ref', '0', '-f', 'webm', out];
export const soundArgs = (file) => ['-i', file, '-t', String(VIDEO_MAX_S), '-vn', '-ac', '2', '-ar', String(MEDIA_RATE), '-f', 's16le', 'pipe:1'];

// A video, ready for her TV (made once, kept): → { id, src: '/media/<id>.webm', sound: Int16Array (48 kHz stereo) | null,
// seconds } or throws. cacheDir: the show's cache (tools/live/cache: media/ in it)
export async function prepareVideo(v, cacheDir, { run = spawn, log = null, nice = NICE } = {}) {
  const dir = join(cacheDir, 'media');
  mkdirSync(dir, { recursive: true });
  const id = mediaKey(v.file, v.size, v.mtime);
  const webm = join(dir, `${id}.webm`), pcm = join(dir, `${id}.pcm`);
  if (!existsSync(webm)) {
    await ff(videoArgs(v.file, `${webm}.part`), { run, nice });
    renameSync(`${webm}.part`, webm);
  }
  let sound = null;
  if (existsSync(pcm)) sound = readFileSync(pcm);
  else {
    try {
      sound = await ff(soundArgs(v.file), { run, out: true, nice });
      writeFileSync(`${pcm}.part`, sound);
      renameSync(`${pcm}.part`, pcm);
    } catch (err) { log?.warn?.(`[media] "${v.title}" has no sound she can play: ${err.message}`); sound = null; }
  }
  const samples = sound && sound.length >= 4 ? new Int16Array(sound.buffer, sound.byteOffset, Math.floor(sound.length / 2)) : null;
  const seconds = (await probeSeconds(webm, { run })) || (samples ? samples.length / 2 / MEDIA_RATE : null);
  if (!(seconds > 0.5)) throw new Error(`"${v.title}": couldn't tell how long it is`);
  return { id, src: `/media/${id}.webm`, sound: samples, seconds: Math.min(VIDEO_MAX_S, seconds) };
}

// (2026-10-09) her song's music video in the folder (feel-the-agi.mp4, or .webm, .mov, .m4v, .mkv) → { file, title, size,
// mtime } or null
export function findSongVideo(dir, id = 'feel-the-agi') {
  if (!dir || !existsSync(dir)) return null;
  let names = [];
  try { names = readdirSync(dir); } catch { return null; }
  for (const n of names) {
    if (n.startsWith('.') || !VIDEO_TYPES.includes(extname(n).toLowerCase()) || basename(n, extname(n)).toLowerCase() !== id) continue;
    try {
      const file = join(dir, n), st = statSync(file);
      if (st.isFile() && st.size >= 1000 && st.size <= 1024 * 1024 * 1024) return { file, title: `${id} (music video)`, size: st.size, mtime: st.mtimeMs };
    } catch { /* gone */ }
  }
  return null;
}
// the ffmpeg arguments for it: the whole of it (no 4-minute cap), 1280 px wide (it fills her stream), 24 frames a second,
// VP8 in WebM like her TV's, a keyframe every 2 seconds (a part of her song starts it in the middle), no sound (the song's
// own sound plays); made once, at a lower priority than her show, kept on the server's disk
export const songVideoArgs = (file, out) => ['-y', '-i', file, '-an', '-sn', '-dn',
  '-vf', "scale='min(1280,iw)':-2:flags=bicubic,fps=24,format=yuv420p", '-c:v', 'libvpx', '-b:v', '1800k', '-crf', '10', '-qmin', '4', '-qmax', '40',
  '-deadline', 'good', '-cpu-used', '4', '-g', '48', '-threads', '2', '-auto-alt-ref', '0', '-f', 'webm', out];
// → { id, src: '/media/<id>.webm', seconds } or throws
export async function prepareSongVideo(v, cacheDir, { run = spawn, nice = NICE } = {}) {
  const dir = join(cacheDir, 'media');
  mkdirSync(dir, { recursive: true });
  const id = mediaKey(`song:${v.file}`, v.size, v.mtime);
  const webm = join(dir, `${id}.webm`);
  if (!existsSync(webm)) {
    await ff(songVideoArgs(v.file, `${webm}.part`), { run, nice });
    renameSync(`${webm}.part`, webm);
  }
  const seconds = await probeSeconds(webm, { run });
  if (!(seconds > 1)) throw new Error(`"${v.title}": couldn't tell how long it is`);
  return { id, src: `/media/${id}.webm`, seconds };
}

// A picture or a video from one of her X posts, downloaded once into the show's cache (only from X's own media hosts,
// https, no redirects to elsewhere; a picture 5 MB at most, a video 80 MB) → its file, or throws
const X_HOSTS = /^https:\/\/(?:pbs\.twimg\.com|video\.twimg\.com)\//;
const PICTURE = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
export async function download(url, cacheDir, { fetchFn = fetch, kind = 'picture' } = {}) {
  if (!X_HOSTS.test(String(url))) throw new Error('not one of X\'s media addresses');
  const dir = join(cacheDir, 'media');
  mkdirSync(dir, { recursive: true });
  const id = createHash('sha256').update(`${MEDIA_VERSION}:${url}`).digest('hex').slice(0, 24);
  for (const ext of kind === 'picture' ? Object.values(PICTURE) : ['mp4']) {
    const f = join(dir, `${id}.${ext}`);
    if (existsSync(f)) return { id, file: f, src: `/media/${id}.${ext}` };
  }
  const res = await fetchFn(url, { signal: AbortSignal.timeout(kind === 'picture' ? 15_000 : 60_000), redirect: 'error' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const type = String(res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const max = kind === 'picture' ? 5 * 1024 * 1024 : 80 * 1024 * 1024;
  const ext = kind === 'picture' ? PICTURE[type] : (type === 'video/mp4' ? 'mp4' : null);
  if (!ext) throw new Error(`not a ${kind}: ${type || 'no type'}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > max || buf.length < 100) throw new Error(`${buf.length} bytes`);
  const file = join(dir, `${id}.${ext}`);
  writeFileSync(`${file}.part`, buf);
  renameSync(`${file}.part`, file);
  return { id, file, src: `/media/${id}.${ext}` };
}

// her voice or her music (mono, 24 kHz) → the stream's sound (stereo, 48 kHz): straight lines between samples
export function toStereo(samples, from = 24000, to = MEDIA_RATE) {
  const n = Math.round((samples.length * to) / from), out = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const x = (i * from) / to, a = Math.floor(x), f = x - a;
    const v = (samples[a] ?? 0) * (1 - f) + (samples[a + 1] ?? samples[a] ?? 0) * f;
    out[i * 2] = v; out[i * 2 + 1] = v;
  }
  return out;
}

// tidy the media folder: anything not used for 14 days goes (a video made again is a few seconds of work)
export function tidyMedia(cacheDir, { now = Date.now(), days = 14 } = {}) {
  const dir = join(cacheDir, 'media');
  if (!existsSync(dir)) return 0;
  let gone = 0;
  for (const n of readdirSync(dir)) {
    const f = join(dir, n);
    try { if (now - statSync(f).atimeMs > days * 86_400_000 && now - statSync(f).mtimeMs > days * 86_400_000) { rmSync(f, { force: true }); gone += 1; } } catch { /* gone */ }
  }
  return gone;
}
