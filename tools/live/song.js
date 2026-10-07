// AGI-1's live show (2026-10-07, the owner: "can sing her songs like this one (AGI-1_Feel_the_AGI_v9_master.mp4)", then
// "sing some parts of her song like the rap part, can sing the whole song also"): her song on stream.
//   • its sound: tools/live/songs/feel-the-agi.mp3, the owner's own song (made with Suno), as it is: the owner's exception
//     to her show's rules ("Feel the AGI as it is": its words name real people and another project; nothing else on her
//     show may). Without its tags, its lyrics or its cover (only the sound).
//   • its timing: tools/live/songs/feel-the-agi.json (made once in Claude's workspace from the song itself: its vocals cut
//     out with an open vocal-separation model, her mouth from their loudness, 50 values a second; the beats and bars; the
//     karaoke lines of its hook only, so no real person's name is ever on screen; her moves on its big moments).
// Pure but for decodeSong (ffmpeg, once: the sound kept on the server's disk as raw 48 kHz stereo).
import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { SONG_PARTS } from '../../server/live-acts.js';
import { withoutSecrets } from '../clips/make.mjs';

export const SONG_DIR = new URL('./songs/', import.meta.url).pathname;
export const SONG_RATE = 48000;          // her song is played as it is: 48 kHz stereo (the stream's own sound: run.mjs Mixer)
export const SONG_LEVEL = 0.11;          // how loud (RMS, 0..1): about her voice's own level, above her quiet music

// → { meta, file } (the song's timing, and where its sound is) or null when it isn't there
export function readSong(dir = SONG_DIR, id = 'feel-the-agi') {
  try {
    const meta = JSON.parse(readFileSync(join(dir, `${id}.json`), 'utf8'));
    const file = join(dir, meta.file || `${id}.mp3`);
    if (!existsSync(file) || !(meta.seconds > 0) || typeof meta.mouth !== 'string') return null;
    return { meta, file };
  } catch {
    return null;
  }
}

// her mouth while she sings, 0..1, 50 values a second (from the JSON's base64)
export function mouthOf(meta) {
  const raw = Buffer.from(String(meta.mouth || ''), 'base64');
  return Float32Array.from(raw, (x) => x / 255);
}

// One part of her song (server/live-acts.js SONG_PARTS: chorus, rap, intro, verse, final, whole), as her set needs it: when
// it starts and ends in the song, and everything in it timed from its start → { part, name, from, to, seconds, step (ms per
// mouth value), env (her mouth), lines (karaoke), beats, downbeats, cues (her moves), sections (its big moments), bpm, title }
export function partOf(meta, part) {
  const p = SONG_PARTS[part] || SONG_PARTS.chorus;
  const from = Math.max(0, p.from), to = Math.min(meta.seconds, p.to);
  const fps = Number(meta.fps) || 50;
  const mouth = mouthOf(meta);
  const env = Array.from(mouth.subarray(Math.floor(from * fps), Math.ceil(to * fps)), (x) => Math.round(x * 100) / 100);
  const within = (t) => t >= from - 0.01 && t < to;
  const at = (t) => Math.round((t - from) * 1000) / 1000;
  const lines = (meta.lines || []).filter((x) => x.from >= from - 0.3 && x.to <= to + 0.3 && x.words?.length)
    .map((x) => ({ text: x.text, from: at(Math.max(from, x.from)), to: at(Math.min(to, x.to)), words: x.words.map((w) => ({ w: w.w, t: at(w.t) })) }));
  const beats = (meta.beats || []).filter(within).map(at);
  const downbeats = (meta.downbeats || []).filter(within).map(at);
  // her moves: the one already on when the part starts (or its first one, from its first moment), then the ones in it
  const choreo = meta.choreo || [];
  const inside = choreo.filter((c) => within(c.t)).map((c) => ({ t: at(c.t), move: c.move }));
  const first = choreo.filter((c) => c.t < from).at(-1)?.move || inside[0]?.move || 'groove';
  const cues = [{ t: 0, move: first }, ...inside.filter((c) => c.t > 0)];
  const sections = (meta.sections || []).filter((x) => x.to > from && x.from < to).map((x) => ({ from: at(Math.max(from, x.from)), to: at(Math.min(to, x.to)), kind: x.kind }));
  const bpm = beats.length > 8 ? Math.round(600 / ((beats.at(-1) - beats[0]) / (beats.length - 1))) / 10 : 120;
  return {
    part: SONG_PARTS[part] ? part : 'chorus', name: p.name, from, to, seconds: Math.round((to - from) * 1000) / 1000,
    step: 1000 / fps, env, lines, beats, downbeats, cues, sections, bpm, title: meta.title || 'my song',
  };
}

// Its sound: decoded once by ffmpeg (48 kHz, stereo, 16-bit) and kept on the server's disk next to her kept voice lines;
// then read back (a few tens of MB, read in a moment). → Int16Array (left, right, left, right…)
const songKey = (file) => { const st = statSync(file); return createHash('sha256').update(`${file}:${st.size}:${Math.round(st.mtimeMs)}:${SONG_RATE}`).digest('hex').slice(0, 24); };
export async function decodeSong(file, cacheDir, { run = spawn, log = null } = {}) {
  const kept = join(cacheDir, `song-${songKey(file)}.pcm`);
  if (existsSync(kept)) {
    const buf = readFileSync(kept);
    return new Int16Array(buf.buffer, buf.byteOffset, Math.floor(buf.length / 2));
  }
  const pcm = await new Promise((ok, fail) => {
    const p = run('ffmpeg', ['-v', 'error', '-i', file, '-vn', '-ac', '2', '-ar', String(SONG_RATE), '-f', 's16le', 'pipe:1'], { stdio: ['ignore', 'pipe', 'pipe'], env: withoutSecrets() });
    const chunks = [];
    let err = '';
    p.stdout.on('data', (d) => chunks.push(d));
    p.stderr?.on('data', (d) => { err += d; });
    p.on('error', fail);
    p.on('exit', (code) => (code === 0 ? ok(Buffer.concat(chunks)) : fail(new Error(`ffmpeg couldn't read her song (${code}): ${err.trim().slice(0, 200)}`))));
  });
  try {
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(`${kept}.part`, pcm);
    renameSync(`${kept}.part`, kept);
  } catch (err) { log?.warn?.(`[song] couldn't keep her song's sound: ${err.message}`); }
  return new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.length / 2));
}

// how loud it is (RMS, 0..1, both channels) → the gain that brings it to SONG_LEVEL (never louder than its peak allows)
export function songGain(pcm, { level = SONG_LEVEL } = {}) {
  let sum = 0, peak = 0;
  const step = Math.max(1, Math.floor(pcm.length / 2_000_000));     // (a sample of it is plenty)
  let n = 0;
  for (let i = 0; i < pcm.length; i += step) { const x = pcm[i] / 32768; sum += x * x; peak = Math.max(peak, Math.abs(x)); n += 1; }
  const rms = Math.sqrt(sum / Math.max(1, n));
  if (!(rms > 1e-4)) return 0;
  return Math.min(level / rms, 0.98 / Math.max(peak, 1e-4));
}
