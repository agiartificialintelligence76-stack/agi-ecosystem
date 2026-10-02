// AGI-1's live show (2026-10-02, the owner: "can you just generate music yourself?"): her background music, made here, in
// code. A few calm, original instrumental songs (chill lo-fi and soft synth), each written as chords, a bass line, soft
// drums and a little melody, and played by small synthesizers: no samples, no outside service, nobody else's music.
// Pure: a song's notes and seed → its sound (mono, 24 kHz, -1..1), the same every time, so a song is rendered once and kept
// on the server's disk (tools/live/cache, like her voice lines). tools/live/run.mjs plays them on a loop under her voice
// (MusicBed: quiet, and quieter while she talks). LIVE_MUSIC=off switches it off; LIVE_MUSIC_VOLUME (percent) sets how loud.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { seeded } from './show.js';

export const RATE = 24000;
export const MUSIC_VERSION = 1;                 // (how songs are made changed: they're rendered again)
const TAU = Math.PI * 2;
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

// ---------- the songs ----------
// key: the song's home note (MIDI) · bpm · swing (where the off-beat eighth falls: 0.5 straight, 0.6 lazy) · chords: four
// bars, each [semitones above the key, quality] (I = 0, ii = 2, iii = 4, IV = 5, V = 7, vi = 9) · keys: how the chords are
// played ('rhodes' struck chords, 'pluck' an arpeggio) · drums: 'lofi' (kick, snare, swung hats) or 'soft' (sparse) ·
// lead: the melody's sound ('bell' or 'soft')
const QUALITY = {
  maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], dom9: [0, 4, 10, 14], sus: [0, 5, 7, 10], add9: [0, 4, 7, 14], six: [0, 4, 7, 9], m9: [0, 3, 10, 14],
};
export const SONGS = [
  { id: 'purple-hour', title: 'purple hour', key: 60, bpm: 80, swing: 0.6, keys: 'rhodes', drums: 'lofi', lead: 'bell', seed: 11,
    chords: [[5, 'maj7'], [4, 'm7'], [2, 'm7'], [0, 'maj7']] },
  { id: 'soft-launch', title: 'soft launch', key: 57, bpm: 92, swing: 0.54, keys: 'pluck', drums: 'lofi', lead: 'soft', seed: 23,
    chords: [[9, 'm7'], [5, 'maj7'], [0, 'maj7'], [7, 'add9']] },
  { id: 'texts-back', title: 'texts back', key: 53, bpm: 86, swing: 0.62, keys: 'rhodes', drums: 'lofi', lead: 'soft', seed: 37,
    chords: [[2, 'm9'], [7, 'dom9'], [0, 'maj7'], [9, 'm7']] },
  { id: 'after-midnight', title: 'after midnight', key: 51, bpm: 72, swing: 0.56, keys: 'rhodes', drums: 'soft', lead: 'bell', seed: 41,
    chords: [[5, 'maj7'], [4, 'm7'], [2, 'm7'], [7, 'sus']] },
  { id: 'no-red-flags', title: 'no red flags', key: 50, bpm: 88, swing: 0.57, keys: 'pluck', drums: 'lofi', lead: 'bell', seed: 53,
    chords: [[0, 'maj7'], [9, 'm7'], [5, 'maj7'], [7, 'six']] },
];
// a song's shape: bars, and what plays (1 = full, a smaller number = softer)
export const PLAN = [
  { bars: 4, pad: 1, keys: 0.75 },                                         // intro
  { bars: 8, pad: 1, keys: 1, bass: 1, drums: 1 },
  { bars: 8, pad: 1, keys: 0.9, bass: 1, drums: 1, lead: 1 },
  { bars: 8, pad: 1, keys: 1, bass: 1, drums: 1, hats: 1 },
  { bars: 4, pad: 1, keys: 0.9, bass: 0.7 },                               // a breath: no drums
  { bars: 8, pad: 1, keys: 0.9, bass: 1, drums: 1, lead: 1, variation: 1 },
  { bars: 4, pad: 1, keys: 0.7, end: true },                               // outro
];
export const songBars = (plan = PLAN) => plan.reduce((n, s) => n + s.bars, 0);
export const songSeconds = (song, plan = PLAN) => (songBars(plan) * 4 * 60) / song.bpm;

// ---------- small synthesizers ----------
// A biquad filter (RBJ's cookbook): lowpass, highpass or bandpass at f (Hz), q
function biquad(type, f, q, rate = RATE) {
  const w = (TAU * Math.min(f, rate * 0.45)) / rate, c = Math.cos(w), al = Math.sin(w) / (2 * q);
  let b0, b1, b2;
  if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; }
  else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; }
  else { b0 = al; b1 = 0; b2 = -al; }
  const a0 = 1 + al;
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: (-2 * c) / a0, a2: (1 - al) / a0, x1: 0, x2: 0, y1: 0, y2: 0 };
}
function run(f, x) {
  const y = f.b0 * x + f.b1 * f.x1 + f.b2 * f.x2 - f.a1 * f.y1 - f.a2 * f.y2;
  f.x2 = f.x1; f.x1 = x; f.y2 = f.y1; f.y1 = y;
  return y;
}
function filterAll(buf, f) { for (let i = 0; i < buf.length; i++) buf[i] = run(f, buf[i]); return buf; }
// a band-limited sawtooth (polyBLEP: no harsh aliasing)
function blep(t, dt) {
  if (t < dt) { const x = t / dt; return x + x - x * x - 1; }
  if (t > 1 - dt) { const x = (t - 1) / dt; return x * x + x + x + 1; }
  return 0;
}

// An electric piano (two-operator FM): a bright attack that mellows, a soft bell partial, a slow tape wobble
function epiano(out, at, midi, len, vel, rate = RATE) {
  const f = hz(midi), start = Math.round(at * rate), n = Math.round((len + 0.6) * rate);
  let pc = 0, pm = 0;
  for (let i = 0; i < n && start + i < out.length; i++) {
    const t = i / rate;
    const wob = 1 + 0.0012 * Math.sin(TAU * 0.35 * (at + t));
    const env = (t < 0.004 ? t / 0.004 : Math.exp(-(t - 0.004) / 1.4)) * (t > len ? Math.exp(-(t - len) / 0.18) : 1);
    const index = 1.6 * Math.exp(-t / 0.22) + 0.25;
    pm += (TAU * f * wob) / rate;
    pc += (TAU * f * wob) / rate;
    const s = Math.sin(pc + index * Math.sin(pm)) + 0.12 * Math.exp(-t / 0.35) * Math.sin(pc * 4);
    out[start + i] += vel * env * s;
  }
}
// A soft pluck (a triangle through a closing filter): her arpeggios
function pluck(out, at, midi, len, vel, rate = RATE) {
  const f = hz(midi), start = Math.round(at * rate), n = Math.round((len + 0.4) * rate), lp = biquad('lp', 2400, 0.7, rate);
  let p = 0;
  for (let i = 0; i < n && start + i < out.length; i++) {
    const t = i / rate;
    p = (p + f / rate) % 1;
    const tri = 1 - 4 * Math.abs(p - 0.5);
    const env = (t < 0.003 ? t / 0.003 : Math.exp(-(t - 0.003) / 0.45)) * (t > len ? Math.exp(-(t - len) / 0.12) : 1);
    out[start + i] += vel * env * run(lp, tri);
  }
}
// A warm pad (two detuned saws and a sub, slow in, slow out); the pad bus is filtered afterwards
function pad(out, at, midi, len, vel, rate = RATE) {
  const start = Math.round(at * rate), n = Math.round((len + 1.4) * rate);
  const f1 = hz(midi + 0.07), f2 = hz(midi - 0.07), f3 = hz(midi - 12);
  let a = 0, b = 0.37, c = 0;
  for (let i = 0; i < n && start + i < out.length; i++) {
    const t = i / rate;
    const env = Math.min(1, t / 0.9) * (t > len ? Math.exp(-(t - len) / 0.6) : 1);
    a = (a + f1 / rate) % 1; b = (b + f2 / rate) % 1; c += (TAU * f3) / rate;
    const s = (2 * a - 1 - blep(a, f1 / rate)) + (2 * b - 1 - blep(b, f2 / rate)) + 0.5 * Math.sin(c);
    out[start + i] += vel * env * s * 0.33;
  }
}
// A round bass (a sine and two soft overtones, so small speakers hear it too)
function bass(out, at, midi, len, vel, rate = RATE) {
  const f = hz(midi), start = Math.round(at * rate), n = Math.round((len + 0.15) * rate);
  let p = 0;
  for (let i = 0; i < n && start + i < out.length; i++) {
    const t = i / rate;
    p += (TAU * f) / rate;
    const env = Math.min(1, t / 0.008) * (0.62 + 0.38 * Math.exp(-t / 0.3)) * (t > len ? Math.exp(-(t - len) / 0.05) : 1);
    out[start + i] += vel * env * (Math.sin(p) + 0.3 * Math.sin(2 * p) + 0.08 * Math.sin(3 * p));
  }
}
// A bell (FM at 3.5×: a music box): the melody's 'bell' sound; 'soft' is a rounder sine with a little second harmonic
function lead(out, at, midi, len, vel, kind, rate = RATE) {
  const f = hz(midi), start = Math.round(at * rate), n = Math.round((len + 0.8) * rate);
  let p = 0;
  for (let i = 0; i < n && start + i < out.length; i++) {
    const t = i / rate;
    p += (TAU * f) / rate;
    let s, env;
    if (kind === 'bell') {
      env = (t < 0.003 ? t / 0.003 : Math.exp(-(t - 0.003) / 0.9)) * (t > len ? Math.exp(-(t - len) / 0.3) : 1);
      s = Math.sin(p + 1.2 * Math.exp(-t / 0.15) * Math.sin(3.5 * p));
    } else {
      env = Math.min(1, t / 0.03) * Math.exp(-t / 1.6) * (t > len ? Math.exp(-(t - len) / 0.15) : 1);
      s = Math.sin(p) + 0.18 * Math.sin(2 * p);
    }
    out[start + i] += vel * env * s;
  }
}
// Soft drums: a round kick, a lo-fi snare, closed and open hats (noise from the song's own random numbers)
function kick(out, at, vel, rnd, rate = RATE) {
  const start = Math.round(at * rate), n = Math.round(0.45 * rate);
  let p = 0;
  for (let i = 0; i < n && start + i < out.length; i++) {
    const t = i / rate;
    p += (TAU * (46 + 74 * Math.exp(-t / 0.032))) / rate;
    out[start + i] += vel * (Math.sin(p) * Math.exp(-t / 0.15) + 0.08 * (rnd() * 2 - 1) * Math.exp(-t / 0.003));
  }
}
function snare(out, at, vel, rnd, rate = RATE) {
  const start = Math.round(at * rate), n = Math.round(0.3 * rate), bp = biquad('bp', 1900, 0.8, rate);
  let p = 0;
  for (let i = 0; i < n && start + i < out.length; i++) {
    const t = i / rate;
    p += (TAU * 185) / rate;
    out[start + i] += vel * (run(bp, rnd() * 2 - 1) * 1.6 * Math.exp(-t / 0.075) + 0.35 * Math.sin(p) * Math.exp(-t / 0.045));
  }
}
function hat(out, at, vel, open, rnd, rate = RATE) {
  const start = Math.round(at * rate), n = Math.round((open ? 0.4 : 0.09) * rate), hp = biquad('hp', 7000, 0.7, rate);
  for (let i = 0; i < n && start + i < out.length; i++) {
    const t = i / rate;
    out[start + i] += vel * run(hp, rnd() * 2 - 1) * Math.exp(-t / (open ? 0.12 : 0.022));
  }
}
// A small room (Schroeder: four combs with damping, two allpasses)
function reverb(input, rate = RATE) {
  const out = new Float32Array(input.length);
  const combs = [0.0297, 0.0371, 0.0411, 0.0437].map((s) => ({ buf: new Float32Array(Math.round(s * rate)), i: 0, lp: 0 }));
  const alls = [0.005, 0.0017].map((s) => ({ buf: new Float32Array(Math.round(s * rate)), i: 0 }));
  for (let n = 0; n < input.length; n++) {
    let s = 0;
    for (const c of combs) {
      const y = c.buf[c.i];
      c.lp = y * 0.75 + c.lp * 0.25;
      c.buf[c.i] = input[n] + c.lp * 0.8;
      c.i = (c.i + 1) % c.buf.length;
      s += y;
    }
    s *= 0.25;
    for (const a of alls) {
      const y = a.buf[a.i];
      const x = s + y * 0.7;
      a.buf[a.i] = x;
      a.i = (a.i + 1) % a.buf.length;
      s = y - x * 0.7;
    }
    out[n] = s;
  }
  return out;
}

// ---------- the notes ----------
// The chord's notes near the last chord's (smooth voice leading), between lo and hi, avoiding half-step rubs between
// neighboring notes (they sound muddy on a soft electric piano)
export function voicing(tones, prev, lo = 52, hi = 76) {
  const options = tones.map((pc) => { const o = []; for (let m = lo; m <= hi; m++) if (((m - pc) % 12 + 12) % 12 === 0) o.push(m); return o; });
  let best = null, bestCost = Infinity;
  const pick = (k, acc) => {
    if (k === options.length) {
      const v = [...acc].sort((x, y) => x - y);
      if (v[v.length - 1] - v[0] > 14 || new Set(v).size < v.length) return;
      const rubs = v.slice(1).filter((m, i) => m - v[i] === 1).length;
      const cost = (prev ? v.reduce((sum, m, i) => sum + Math.abs(m - (prev[i] ?? prev.at(-1))), 0) : Math.abs(v.reduce((a, b) => a + b, 0) / v.length - 62)) + 6 * rubs;
      if (cost < bestCost) { bestCost = cost; best = v; }
      return;
    }
    for (const m of options[k]) { acc.push(m); pick(k + 1, acc); acc.pop(); }
  };
  pick(0, []);
  return best || tones.map((pc) => lo + (((pc - lo) % 12) + 12) % 12).sort((x, y) => x - y);
}
const PENTA = [0, 2, 4, 7, 9];
// A melody over four bars: a two-bar idea, said again, then an answer that comes home. → [{ bar, beat, len, midi }]
export function melody(song, rnd, chordTones) {
  const rhythms = [
    [[0, 1.5], [1.5, 0.5], [2, 2]],
    [[0.5, 0.5], [1, 1], [2, 0.5], [2.5, 1.5]],
    [[0, 1], [1, 1], [2.5, 1.5]],
    [[0, 0.5], [0.5, 0.5], [1, 2], [3, 1]],
    [[1, 0.5], [1.5, 0.5], [2, 1], [3, 1]],
  ];
  const scale = [];
  for (let m = 65; m <= 84; m++) if (PENTA.includes(((m - song.key) % 12 + 12) % 12)) scale.push(m);
  const nearest = (pool, target) => pool.reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a));
  const inChord = (bar) => scale.filter((m) => chordTones[bar % 4].includes(((m % 12) + 12) % 12));
  const out = [];
  let last = nearest(scale, 72);
  const phrase = (bar, rhythm, home = false) => {
    for (const [i, [beat, len]] of rhythm.entries()) {
      const strong = beat === 0 || beat === 2;
      const pool = strong ? inChord(bar) : scale;
      const step = Math.floor(rnd() * 5) - 2;                   // a small step from the last note, mostly
      let midi = nearest(pool.length ? pool : scale, last + step * 2);
      if (home && i === rhythm.length - 1) midi = nearest(scale.filter((m) => (m - song.key) % 12 === 0), last);
      out.push({ bar, beat, len, midi });
      last = midi;
    }
  };
  const a = rhythms[Math.floor(rnd() * rhythms.length)], b = rhythms[Math.floor(rnd() * rhythms.length)];
  phrase(0, a); phrase(1, b); phrase(2, a); phrase(3, [[0, 1.5], [2, 2]], true);
  return out;
}

// ---------- a whole song ----------
// → the song's sound (and with { stems: true }, each part on its own too, to check the balance). plan: its shape (PLAN)
export function renderSong(song, rate = RATE, { stems = false, plan = PLAN } = {}) {
  const rnd = seeded(song.seed * 7919 + MUSIC_VERSION);
  const beat = 60 / song.bpm, bar = beat * 4;
  const total = songBars(plan) * bar;
  const len = Math.ceil((total + 3) * rate);
  const keysBus = new Float32Array(len), padBus = new Float32Array(len), bassBus = new Float32Array(len);
  const drumBus = new Float32Array(len), leadBus = new Float32Array(len);
  const pcs = song.chords.map(([deg, q]) => QUALITY[q].map((iv) => (((song.key + deg + iv) % 12) + 12) % 12));
  const roots = song.chords.map(([deg]) => song.key + deg);
  const swung = (b) => (b % 1 === 0.5 ? Math.floor(b) + song.swing : b);   // the off-beat eighth falls a little late
  const human = () => (rnd() - 0.5) * 0.012;                                // a hand's timing, not a machine's
  let prev = null, barIndex = 0;
  const tunes = [melody(song, rnd, pcs), melody(song, rnd, pcs)];
  for (const sec of plan) {
    for (let b = 0; b < sec.bars; b++, barIndex++) {
      const t0 = barIndex * bar, c = barIndex % 4;
      const v = voicing(pcs[c], prev);
      prev = v;
      const last = sec.end && b === sec.bars - 1;
      // the pad holds the chord; the keys play it
      for (const m of v) pad(padBus, t0, m, bar, 0.115 * sec.pad, rate);
      if (song.keys === 'rhodes') {
        v.forEach((m, i) => epiano(keysBus, t0 + i * 0.012 + Math.abs(human()), m, beat * 1.8, 0.11 * sec.keys, rate));
        if (!last && rnd() < 0.8) v.slice(1).forEach((m, i) => epiano(keysBus, t0 + swung(1.5) * beat + i * 0.01, m, beat * 1.2, 0.065 * sec.keys, rate));
        if (!last && rnd() < 0.35) v.slice(-2).forEach((m) => epiano(keysBus, t0 + swung(3.5) * beat, m, beat * 0.4, 0.05 * sec.keys, rate));
      } else {
        // an arpeggio, up and back down, in swung eighths (the last bar: just the way up)
        const up = [...v, v[1] + 12];
        const order = last ? [0, 1, 2, 3] : [0, 1, 2, 3, 4, 3, 2, 1];
        order.forEach((k, j) => pluck(keysBus, t0 + swung(j / 2) * beat + human(), up[k], beat * 0.45, (j % 2 ? 0.12 : 0.17) * sec.keys, rate));
      }
      // the bass: its root on one, then the fifth or the root again
      if (sec.bass) {
        const root = 36 + (((roots[c] - 36) % 12) + 12) % 12;
        bass(bassBus, t0 + human(), root, beat * 1.6, 0.18 * sec.bass, rate);
        const next = rnd() < 0.5 ? root + 7 : root;
        bass(bassBus, t0 + swung(2.5) * beat + human(), next > 47 ? next - 12 : next, beat * 1.1, 0.14 * sec.bass, rate);
      }
      // the drums
      if (sec.drums) {
        if (song.drums === 'lofi') {
          kick(drumBus, t0 + human(), 0.5, rnd, rate);
          kick(drumBus, t0 + swung(2.5) * beat + human(), 0.36, rnd, rate);
          if (rnd() < 0.3) kick(drumBus, t0 + swung(3.5) * beat + human(), 0.24, rnd, rate);
          snare(drumBus, t0 + beat + human(), 0.24, rnd, rate);
          snare(drumBus, t0 + 3 * beat + human(), 0.26, rnd, rate);
          for (let k = 0; k < 8; k++) hat(drumBus, t0 + swung(k / 2) * beat + human(), (k % 2 ? 0.05 : 0.08) * (0.8 + 0.4 * rnd()), sec.hats && k === 7, rnd, rate);
        } else {
          kick(drumBus, t0 + human(), 0.5, rnd, rate);
          kick(drumBus, t0 + 2 * beat + human(), 0.38, rnd, rate);
          snare(drumBus, t0 + 3 * beat + human(), 0.18, rnd, rate);
          for (let k = 0; k < 4; k++) hat(drumBus, t0 + k * beat + human(), 0.045, false, rnd, rate);
        }
      }
      // the melody: four bars at a time, its second take in the second half of the song
      if (sec.lead) {
        const tune = tunes[sec.variation ? 1 : 0];
        for (const note of tune.filter((x) => x.bar === b % 4)) {
          lead(leadBus, t0 + swung(note.beat) * beat + human(), note.midi, note.len * beat, 0.11 * sec.lead, song.lead, rate);
        }
      }
    }
  }
  // a little warmth: the keys a touch darker, the drums softer at the top, the pad slowly breathing
  filterAll(keysBus, biquad('lp', 3600, 0.7, rate));
  filterAll(drumBus, biquad('lp', 7500, 0.6, rate));
  const padLp = biquad('lp', 800, 0.8, rate);
  for (let i = 0; i < len; i += 64) {
    const f = biquad('lp', 760 + 260 * Math.sin((TAU * 0.06 * i) / rate), 0.8, rate);
    Object.assign(padLp, { b0: f.b0, b1: f.b1, b2: f.b2, a1: f.a1, a2: f.a2 });
    for (let k = i; k < Math.min(len, i + 64); k++) padBus[k] = run(padLp, padBus[k]);
  }
  const room = new Float32Array(len);
  for (let i = 0; i < len; i++) room[i] = keysBus[i] * 0.3 + padBus[i] * 0.35 + leadBus[i] * 0.45;
  const wet = reverb(room, rate);
  // the mix, a little vinyl hiss and crackle, no rumble; then a level that's the same for every song, never clipping
  const mix = new Float32Array(len), hissLp = biquad('lp', 2500, 0.7, rate), dc = biquad('hp', 28, 0.7, rate);
  for (let i = 0; i < len; i++) {
    let s = keysBus[i] + padBus[i] + bassBus[i] + drumBus[i] + leadBus[i] + wet[i] * 0.28;
    s += 0.004 * run(hissLp, rnd() * 2 - 1);
    if (rnd() < 2.5 / rate) s += (rnd() < 0.5 ? -1 : 1) * 0.02 * (0.5 + rnd());
    mix[i] = run(dc, s);
  }
  let sum = 0;
  for (let i = 0; i < len; i++) sum += mix[i] * mix[i];
  const gain = 0.1 / Math.max(1e-6, Math.sqrt(sum / len));
  const fadeIn = 1.5 * rate, fadeOut = Math.min(7 * rate, total * rate * 0.3), end = Math.round(total * rate) + Math.round(1.2 * rate);
  for (let i = 0; i < len; i++) {
    let s = Math.tanh(mix[i] * gain * 1.25) / 1.25;                         // (soft: a rare peak is rounded, never clipped)
    if (i < fadeIn) s *= i / fadeIn;
    if (i > end - fadeOut) s *= Math.max(0, (end - i) / fadeOut);
    mix[i] = s;
  }
  const out = mix.subarray(0, Math.min(len, end));
  return stems ? { mix: out, stems: { keys: keysBus, pad: padBus, bass: bassBus, drums: drumBus, lead: leadBus, room: wet }, gain } : out;
}

// ---------- kept on disk ----------
export const songKey = (song) => createHash('sha256').update(JSON.stringify({ v: MUSIC_VERSION, rate: RATE, song })).digest('hex').slice(0, 24);
// Each song: read from the cache, or rendered and kept there. → [{ song, samples (Float32Array) }]
export function loadSongs(cacheDir, { songs = SONGS, log = null, render = renderSong } = {}) {
  return songs.map((song) => {
    const file = join(cacheDir, `music-${songKey(song)}.pcm`);
    if (existsSync(file)) {
      try {
        const buf = readFileSync(file);
        const pcm = new Int16Array(buf.buffer, buf.byteOffset, Math.floor(buf.length / 2));
        return { song, samples: Float32Array.from(pcm, (x) => x / 32768) };
      } catch { /* render it again */ }
    }
    const t0 = Date.now();
    const samples = render(song);
    try {
      mkdirSync(cacheDir, { recursive: true });
      const pcm = Int16Array.from(samples, (x) => Math.round(Math.max(-1, Math.min(1, x)) * 32767));
      writeFileSync(`${file}.part`, Buffer.from(pcm.buffer));
      renameSync(`${file}.part`, file);
    } catch (err) { log?.warn?.(`[music] couldn't keep "${song.title}": ${err.message}`); }
    log?.info?.(`[music] made "${song.title}" (${Math.round(samples.length / RATE)} s, in ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
    return { song, samples };
  });
}

// ---------- under her voice ----------
// The settings: LIVE_MUSIC (on unless "off"), LIVE_MUSIC_VOLUME (percent, 100 by default, 0 to 200)
export function musicSettings(env = process.env) {
  const on = !/^(off|no|false|0)$/i.test(String(env.LIVE_MUSIC ?? '').trim());
  const v = Number(env.LIVE_MUSIC_VOLUME);
  return { on, volume: Number.isFinite(v) && String(env.LIVE_MUSIC_VOLUME).trim() !== '' ? Math.min(2, Math.max(0, v / 100)) : 1 };
}
// The songs on a loop (shuffled, never the same twice in a row), quiet, and quieter while she talks: down quickly when she
// starts, back up slowly after. mix(out, talking) adds the music to a piece of the stream's sound.
export const MUSIC_LEVEL = { idle: 0.55, talk: 0.28 };
export class MusicBed {
  constructor(tracks, { volume = 1, rate = RATE, seed = 1 } = {}) {
    this.tracks = tracks.filter((x) => x?.samples?.length);
    this.rnd = seeded(seed);
    this.idle = MUSIC_LEVEL.idle * volume; this.talk = MUSIC_LEVEL.talk * volume;
    this.gain = 0; this.cur = null; this.pos = 0; this.order = []; this.last = null; this.fading = false;
    this.upcoming = null; this.upPos = 0; this.overlap = Math.round(2 * rate);
    this.down = 1 - Math.exp(-1 / (0.12 * rate)); this.up = 1 - Math.exp(-1 / (0.9 * rate)); this.out = 1 - Math.exp(-1 / (1.2 * rate));
  }
  next() {
    if (!this.tracks.length) return null;
    if (!this.order.length) {
      const order = this.tracks.map((_, i) => i);
      for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(this.rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      if (order.length > 1 && order[0] === this.last) order.push(order.shift());
      this.order = order;
    }
    this.last = this.order.shift();
    return this.tracks[this.last];
  }
  get playing() { return this.cur?.song?.title || null; }
  // (the next song starts while the last one fades out: no gap between them)
  mix(out, talking = false) {
    const target = this.fading ? 0 : talking ? this.talk : this.idle;
    for (let i = 0; i < out.length; i++) {
      if (!this.cur) { this.cur = this.next(); this.pos = 0; if (!this.cur) return; }
      this.gain += (target - this.gain) * (this.fading ? this.out : target < this.gain ? this.down : this.up);
      let s = this.cur.samples[this.pos++];
      const left = this.cur.samples.length - this.pos;
      if (!this.upcoming && left < Math.min(this.overlap, this.cur.samples.length / 2)) { this.upcoming = this.next(); this.upPos = 0; }
      if (this.upcoming) s += this.upcoming.samples[this.upPos++] ?? 0;
      out[i] += s * this.gain;
      if (this.pos >= this.cur.samples.length) { this.cur = this.upcoming; this.pos = this.upPos; this.upcoming = null; }
    }
  }
  fadeOut() { this.fading = true; }
}
