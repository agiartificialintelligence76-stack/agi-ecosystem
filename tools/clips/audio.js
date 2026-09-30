// Her voice in a clip (2026-09-29): reading and writing WAV files, a moment of quiet before and after her words, how loud
// she is at each video frame (her mouth follows it, like the site's sound meter in src/chat/voice.js), and where she
// pauses (her captions change there). Plus a stand-in voice for trying the clips without Google (--fake-voice).
import { rhythm } from '../../src/lib/talk.js';

// 16-bit PCM WAV (Gemini's speech model sends 24 kHz mono) → { rate, channels, samples: Float32Array (mono, -1..1) }
export function readWav(buf) {
  if (buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') throw new Error('not a WAV file');
  let rate = 24000, channels = 1, bits = 16, data = null;
  for (let at = 12; at + 8 <= buf.length;) {
    const id = buf.toString('ascii', at, at + 4), size = buf.readUInt32LE(at + 4);
    if (id === 'fmt ') {
      if (buf.readUInt16LE(at + 8) !== 1) throw new Error('only plain PCM WAV files');
      channels = buf.readUInt16LE(at + 10); rate = buf.readUInt32LE(at + 12); bits = buf.readUInt16LE(at + 22);
    } else if (id === 'data') {
      data = buf.subarray(at + 8, Math.min(buf.length, at + 8 + size));
      break;
    }
    at += 8 + size + (size % 2);
  }
  if (!data || bits !== 16 || channels < 1) throw new Error('only 16-bit PCM WAV files');
  const frames = Math.floor(data.length / (2 * channels));
  const samples = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let s = 0;
    for (let c = 0; c < channels; c++) s += data.readInt16LE((i * channels + c) * 2);
    samples[i] = s / channels / 32768;
  }
  return { rate, channels: 1, samples };
}

// Float32 mono → a 16-bit PCM WAV file
export function writeWav(samples, rate) {
  const h = Buffer.alloc(44), body = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) body.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), i * 2);
  h.write('RIFF', 0, 'ascii'); h.writeUInt32LE(36 + body.length, 4); h.write('WAVE', 8, 'ascii');
  h.write('fmt ', 12, 'ascii'); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36, 'ascii'); h.writeUInt32LE(body.length, 40);
  return Buffer.concat([h, body]);
}

// `before` seconds of quiet, her words (quiet already at their start and end trimmed off), then `after` seconds
export function pad(samples, rate, before, after) {
  const loud = (i) => Math.abs(samples[i]) > 0.004;
  let a = 0, b = samples.length - 1;
  while (a < samples.length && !loud(a)) a += 1;
  while (b > a && !loud(b)) b -= 1;
  const words = samples.subarray(Math.max(0, a - Math.round(rate * 0.03)), Math.min(samples.length, b + Math.round(rate * 0.05)));
  const out = new Float32Array(Math.round(rate * before) + words.length + Math.round(rate * after));
  out.set(words, Math.round(rate * before));
  return out;
}

// How loud she is at each video frame, 0..1, the same way the site's sound meter reads her voice (src/chat/voice.js):
// the loudness of about 1/40 s of sound, against the loudest so far (slowly forgotten), above a small floor.
export function talkTrack(samples, rate, fps = 30) {
  const n = Math.ceil((samples.length / rate) * fps);
  const out = new Float32Array(n);
  const half = Math.round(rate * 0.0115);
  const decay = 0.995 ** (60 / fps);                    // the site reads it about 60 times a second
  let loudest = 0.06;
  for (let f = 0; f < n; f++) {
    const mid = Math.round((f / fps) * rate);
    let sum = 0, count = 0;
    for (let i = Math.max(0, mid - half); i < Math.min(samples.length, mid + half); i++) { sum += samples[i] * samples[i]; count += 1; }
    const rms = count ? Math.sqrt(sum / count) : 0;
    loudest = Math.max(rms, loudest * decay);
    const floor = Math.max(0.006, loudest * 0.12);
    out[f] = Math.max(0, Math.min(1, (rms - floor) / Math.max(0.02, loudest * 0.75 - floor)));
  }
  return out;
}

// Where she pauses: quiet stretches of at least `min` seconds between her words → [{ from, to }] (seconds), plus when her
// words start and end. Quiet = under a tenth of her usual loudness.
export function pauses(samples, rate, { min = 0.16 } = {}) {
  const hop = Math.round(rate * 0.01);
  const levels = [];
  for (let at = 0; at < samples.length; at += hop) {
    let sum = 0;
    const end = Math.min(samples.length, at + hop);
    for (let i = at; i < end; i++) sum += samples[i] * samples[i];
    levels.push(Math.sqrt(sum / Math.max(1, end - at)));
  }
  const sorted = levels.filter((x) => x > 0.002).sort((a, b) => a - b);
  const usual = sorted.length ? sorted[Math.floor(sorted.length * 0.6)] : 0;
  const quiet = (x) => x < Math.max(0.004, usual * 0.1);
  const first = levels.findIndex((x) => !quiet(x));
  let last = levels.length - 1;
  while (last > 0 && quiet(levels[last])) last -= 1;
  const gaps = [];
  if (first < 0) return { start: 0, end: 0, gaps };
  for (let i = first, from = -1; i <= last; i++) {
    if (quiet(levels[i])) { if (from < 0) from = i; } else if (from >= 0) {
      if ((i - from) * 0.01 >= min) gaps.push({ from: from * 0.01, to: i * 0.01 });
      from = -1;
    }
  }
  return { start: first * 0.01, end: (last + 1) * 0.01, gaps };
}

// A stand-in voice (no Google, no cost): a hum with the site's own talking rhythm (src/lib/talk.js), about 2.6 words a
// second, quiet for a moment after each sentence, so the mouth, the captions and the whole clip can be tried out
export function fakeVoice(text, rate = 24000) {
  const sentences = String(text).split(/(?<=[.!?…])\s+/).filter((s) => s.trim());
  const parts = [];
  for (const s of sentences) {
    const seconds = Math.max(0.6, s.trim().split(/\s+/).length / 2.6);
    const n = Math.round(seconds * rate), part = new Float32Array(n + Math.round(rate * 0.32));
    for (let i = 0; i < n; i++) {
      const t = i / rate;
      const env = rhythm(t) * 0.5;
      const f0 = 190 + 25 * Math.sin(t * 2.1);
      part[i] = env * (0.55 * Math.sin(2 * Math.PI * f0 * t) + 0.25 * Math.sin(4 * Math.PI * f0 * t) + 0.12 * Math.sin(6 * Math.PI * f0 * t));
    }
    parts.push(part);
  }
  const out = new Float32Array(parts.reduce((s, p) => s + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return writeWav(out, rate);
}
