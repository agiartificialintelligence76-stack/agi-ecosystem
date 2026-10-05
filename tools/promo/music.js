// AGI-1's launch video (2026-10-03): its music, composed and played in code by Claude (no samples, no service, nobody
// else's music), on the video's own clock (tools/promo/timeline.js): 120 beats a minute, F major, I–V–vi–IV
// (F, C, Dm, B♭). Every hit lands on the picture's moments: the heartbeat of the cold open, "AGI" landing, the drop into
// Pop mode, the benchmarks' blips, her 16 hellos (one note each), the scanner's ticks (one for each coin row that passes),
// the launch, the end chord and two last heartbeats.
// renderMusic() → a WAV file (48 kHz, stereo, 16-bit). Pure: the same notes always make the same sound.
import { BEAT, BAR, at, TOTAL, MOMENTS as M, SCENES, scanPos, SCAN_ROWS } from './timeline.js';

export const RATE = 48000;
const TAU = Math.PI * 2;
const hz = (m) => 440 * 2 ** ((m - 69) / 12);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- filters (RBJ's cookbook biquads) ----------
function biquad(type, f, q = 0.707) {
  const w = (TAU * Math.min(f, RATE * 0.45)) / RATE, c = Math.cos(w), al = Math.sin(w) / (2 * q);
  let b0, b1, b2;
  if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; }
  else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; }
  else { b0 = al; b1 = 0; b2 = -al; }
  const a0 = 1 + al;
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: (-2 * c) / a0, a2: (1 - al) / a0, x1: 0, x2: 0, y1: 0, y2: 0 };
}
// the same filter, its frequency moved (keeps its memory: no clicks)
function retune(f, type, freq, q = 0.707) { const n = biquad(type, freq, q); f.b0 = n.b0; f.b1 = n.b1; f.b2 = n.b2; f.a1 = n.a1; f.a2 = n.a2; return f; }
function run(f, x) {
  const y = f.b0 * x + f.b1 * f.x1 + f.b2 * f.x2 - f.a1 * f.y1 - f.a2 * f.y2;
  f.x2 = f.x1; f.x1 = x; f.y2 = f.y1; f.y1 = y;
  return y;
}
// a band-limited sawtooth's correction (polyBLEP)
function blep(t, dt) {
  if (t < dt) { const x = t / dt; return x + x - x * x - 1; }
  if (t > 1 - dt) { const x = (t - 1) / dt; return x * x + x + x + 1; }
  return 0;
}

// ---------- a dry run (musicPlan): every sound notes what it is and when, and makes no sound (the tests read it) ----------
let REC = null;
const rec = (name, t, extra = {}) => { if (!REC) return false; REC.push({ name, t: +t.toFixed(4), ...extra }); return true; };

// ---------- the mix: stereo buses ----------
const N = Math.ceil((TOTAL + 0.5) * RATE);
const bus = () => ({ L: new Float32Array(N), R: new Float32Array(N) });
const panLR = (p) => [Math.cos(((clamp(p, -1, 1) + 1) * Math.PI) / 4) * Math.SQRT2, Math.sin(((clamp(p, -1, 1) + 1) * Math.PI) / 4) * Math.SQRT2];
const idx = (t) => Math.round(t * RATE);

// ---------- drums ----------
function kick(b, t, vel = 1) {
  if (rec('kick', t)) return;
  const s0 = idx(t), n = Math.round(0.42 * RATE);
  let p = 0;
  for (let i = 0; i < n && s0 + i < N; i++) {
    const x = i / RATE;
    p += (TAU * (52 + 118 * Math.exp(-x / 0.026))) / RATE;
    let v = Math.sin(p) * Math.exp(-x / 0.15) * Math.min(1, x / 0.0015);
    v = Math.tanh(v * 1.8) / Math.tanh(1.8);
    v += 0.32 * Math.sin(TAU * 1700 * x) * Math.exp(-x / 0.004) + 0.12 * Math.sin(TAU * 3400 * x) * Math.exp(-x / 0.002);
    b.L[s0 + i] += v * vel; b.R[s0 + i] += v * vel;
  }
}
function clap(b, t, vel, rnd, pan = 0) {
  if (rec('clap', t)) return;
  const s0 = idx(t), n = Math.round(0.3 * RATE), bp = biquad('bp', 1250, 0.9), hp = biquad('hp', 600);
  const [l, r] = panLR(pan);
  for (let i = 0; i < n && s0 + i < N; i++) {
    const x = i / RATE;
    // three quick hands, then the room
    let env = 0;
    for (const d of [0, 0.011, 0.023]) if (x >= d) env = Math.max(env, Math.exp(-(x - d) / 0.006));
    env = Math.max(env, x > 0.023 ? 0.55 * Math.exp(-(x - 0.023) / 0.11) : 0);
    const v = run(hp, run(bp, rnd() * 2 - 1)) * env * 2.2 * vel;
    b.L[s0 + i] += v * l; b.R[s0 + i] += v * r;
  }
}
function snare(b, t, vel, rnd, pan = 0) {
  if (rec('snare', t)) return;
  const s0 = idx(t), n = Math.round(0.22 * RATE), bp = biquad('bp', 2100, 0.7);
  const [l, r] = panLR(pan);
  let p = 0;
  for (let i = 0; i < n && s0 + i < N; i++) {
    const x = i / RATE;
    p += (TAU * (190 + 60 * Math.exp(-x / 0.01))) / RATE;
    const v = (run(bp, rnd() * 2 - 1) * 1.7 * Math.exp(-x / 0.07) + 0.5 * Math.sin(p) * Math.exp(-x / 0.04)) * vel;
    b.L[s0 + i] += v * l; b.R[s0 + i] += v * r;
  }
}
function hat(b, t, vel, open, rnd, pan = 0) {
  if (rec('hat', t)) return;
  const s0 = idx(t), n = Math.round((open ? 0.32 : 0.07) * RATE), hp = biquad('hp', 7500, 0.8);
  const [l, r] = panLR(pan);
  for (let i = 0; i < n && s0 + i < N; i++) {
    const x = i / RATE;
    const v = run(hp, rnd() * 2 - 1) * Math.exp(-x / (open ? 0.11 : 0.018)) * vel;
    b.L[s0 + i] += v * l; b.R[s0 + i] += v * r;
  }
}
// a crash cymbal: noise in each ear on its own (wide), with a few metallic partials
function crash(b, t, vel, rnd, len = 2.2) {
  if (rec('crash', t)) return;
  const s0 = idx(t), n = Math.round(len * RATE), hl = biquad('hp', 3800, 0.6), hr = biquad('hp', 3800, 0.6);
  const parts = [3100, 4370, 5190, 6650].map((f) => ({ f, p: rnd() * TAU }));
  for (let i = 0; i < n && s0 + i < N; i++) {
    const x = i / RATE;
    const env = Math.min(1, x / 0.003) * (0.75 * Math.exp(-x / 0.55) + 0.25 * Math.exp(-x / 1.6));
    let m = 0;
    for (const q of parts) m += Math.sin(TAU * q.f * x + q.p);
    b.L[s0 + i] += (run(hl, rnd() * 2 - 1) + 0.04 * m) * env * vel;
    b.R[s0 + i] += (run(hr, rnd() * 2 - 1) + 0.04 * m) * env * vel;
  }
}

// ---------- instruments ----------
// a round, warm bass: a sub sine and a filtered saw, a little saturated (so phones hear it too)
function bass(b, t, midi, len, vel, { cutoff = 760, growl = 0 } = {}) {
  if (rec('bass', t, { midi })) return;
  const s0 = idx(t), n = Math.round((len + 0.06) * RATE), f = hz(midi), lp = biquad('lp', cutoff, 0.9);
  let ph = 0, ps = 0;
  for (let i = 0; i < n && s0 + i < N; i++) {
    const x = i / RATE;
    ph = (ph + f / RATE) % 1;
    ps += (TAU * f) / RATE;
    if (i % 32 === 0) retune(lp, 'lp', cutoff * (1 + 2.2 * Math.exp(-x / 0.08)) * (1 + growl * 0.5 * Math.sin(TAU * 4 * x)), 0.9);
    const saw = 2 * ph - 1 - blep(ph, f / RATE);
    const env = Math.min(1, x / 0.004) * (x > len ? Math.exp(-(x - len) / 0.025) : 1);
    let v = Math.sin(ps) * 0.62 + run(lp, saw) * (0.78 + growl * 0.4);
    v = Math.tanh(v * (1.6 + growl)) * env * vel;
    b.L[s0 + i] += v; b.R[s0 + i] += v;
  }
}
// supersaws for the chords: five saws a note, each a little out of tune and placed across the stereo field, through a
// low-pass that opens on each attack (the future-bass chord)
function supersaw(b, t, notes, len, vel, rnd, { cutoff = 4200, open = 1.6, attack = 0.008, release = 0.18, voices = 5, spread = 0.2 } = {}) {
  if (rec('chord', t, { notes })) return;
  const s0 = idx(t), n = Math.round((len + release * 4) * RATE);
  const osc = [];
  for (const m of notes) for (let v = 0; v < voices; v++) {
    const d = voices > 1 ? (v / (voices - 1)) * 2 - 1 : 0;
    osc.push({ f: hz(m + d * spread), p: rnd(), pan: d * 0.85 });
  }
  const gl = osc.map((o) => panLR(o.pan));
  const lpl = biquad('lp', cutoff), lpr = biquad('lp', cutoff);
  const norm = vel / Math.sqrt(osc.length);
  for (let i = 0; i < n && s0 + i < N; i++) {
    const x = i / RATE;
    if (i % 48 === 0) { const c = cutoff * (1 + open * Math.exp(-x / 0.12)); retune(lpl, 'lp', c); retune(lpr, 'lp', c); }
    let sl = 0, sr = 0;
    for (let k = 0; k < osc.length; k++) {
      const o = osc[k];
      o.p += o.f / RATE; if (o.p >= 1) o.p -= 1;
      const s = 2 * o.p - 1 - blep(o.p, o.f / RATE);
      sl += s * gl[k][0]; sr += s * gl[k][1];
    }
    const env = Math.min(1, x / attack) * (x > len ? Math.exp(-(x - len) / release) : 1);
    b.L[s0 + i] += run(lpl, sl) * env * norm;
    b.R[s0 + i] += run(lpr, sr) * env * norm;
  }
}
// a soft pad (detuned saws, slow in and out, dark)
function pad(b, t, notes, len, vel, rnd, cutoff = 1100) {
  if (rec('pad', t, { notes })) return;
  supersaw(b, t, notes, len, vel, rnd, { cutoff, open: 0, attack: 0.7, release: 0.9, voices: 3, spread: 0.12 });
}
// the hook's voice: a bright pluck (saw and pulse through a closing filter) with a bell an octave up
function lead(b, t, midi, len, vel, { pan = 0, bright = 1 } = {}) {
  if (rec('lead', t, { midi })) return;
  const s0 = idx(t), n = Math.round((len + 0.35) * RATE), f = hz(midi), lp = biquad('lp', 5000, 1.1);
  const [l, r] = panLR(pan);
  let p1 = 0, p2 = 0.5, pb = 0, pm = 0;
  for (let i = 0; i < n && s0 + i < N; i++) {
    const x = i / RATE;
    if (i % 24 === 0) retune(lp, 'lp', (900 + 5200 * bright * Math.exp(-x / 0.16)), 1.1);
    p1 = (p1 + f / RATE) % 1; p2 = (p2 + (f * 1.004) / RATE) % 1;
    const saw = 2 * p1 - 1 - blep(p1, f / RATE);
    const pulse = (p2 < 0.32 ? 1 : -1);
    const env = Math.min(1, x / 0.003) * (0.45 + 0.55 * Math.exp(-x / 0.18)) * (x > len ? Math.exp(-(x - len) / 0.08) : 1);
    pb += (TAU * f * 2) / RATE; pm += (TAU * f * 7) / RATE;
    const bell = Math.sin(pb + 1.1 * Math.exp(-x / 0.12) * Math.sin(pm)) * Math.exp(-x / 0.5) * 0.35;
    const v = (run(lp, saw * 0.6 + pulse * 0.25) + bell) * env * vel;
    b.L[s0 + i] += v * l; b.R[s0 + i] += v * r;
  }
}
// a bell (FM at 3.5×, a music box)
function bell(b, t, midi, vel, { pan = 0, decay = 0.9, len = 1.6 } = {}) {
  if (rec('bell', t, { midi })) return;
  const s0 = idx(t), n = Math.round(len * RATE), f = hz(midi);
  const [l, r] = panLR(pan);
  let p = 0, q = 0;
  for (let i = 0; i < n && s0 + i < N; i++) {
    const x = i / RATE;
    p += (TAU * f) / RATE; q += (TAU * f * 3.5) / RATE;
    const v = Math.sin(p + 1.3 * Math.exp(-x / 0.14) * Math.sin(q)) * Math.min(1, x / 0.002) * Math.exp(-x / decay) * vel;
    b.L[s0 + i] += v * l; b.R[s0 + i] += v * r;
  }
}
// an electric piano (two-operator FM)
function epiano(b, t, midi, len, vel, { pan = 0 } = {}) {
  if (rec('epiano', t, { midi })) return;
  const s0 = idx(t), n = Math.round((len + 0.5) * RATE), f = hz(midi);
  const [l, r] = panLR(pan);
  let pc = 0, pm = 0;
  for (let i = 0; i < n && s0 + i < N; i++) {
    const x = i / RATE;
    const env = Math.min(1, x / 0.004) * Math.exp(-x / 1.3) * (x > len ? Math.exp(-(x - len) / 0.16) : 1);
    pc += (TAU * f) / RATE; pm += (TAU * f) / RATE;
    const v = (Math.sin(pc + (1.5 * Math.exp(-x / 0.2) + 0.25) * Math.sin(pm)) + 0.1 * Math.exp(-x / 0.3) * Math.sin(pc * 4)) * env * vel;
    b.L[s0 + i] += v * l; b.R[s0 + i] += v * r;
  }
}
// a short pluck (a triangle through a closing filter): arpeggios, her hellos
function pluck(b, t, midi, vel, { pan = 0, len = 0.18 } = {}) {
  if (rec('pluck', t, { midi })) return;
  const s0 = idx(t), n = Math.round((len + 0.3) * RATE), f = hz(midi), lp = biquad('lp', 6000, 0.8);
  const [l, r] = panLR(pan);
  let p = 0;
  for (let i = 0; i < n && s0 + i < N; i++) {
    const x = i / RATE;
    if (i % 24 === 0) retune(lp, 'lp', 700 + 7000 * Math.exp(-x / 0.05), 0.8);
    p = (p + f / RATE) % 1;
    const tri = 1 - 4 * Math.abs(p - 0.5), sq = p < 0.5 ? 1 : -1;
    const v = run(lp, tri * 0.7 + sq * 0.3) * Math.min(1, x / 0.002) * Math.exp(-x / 0.16) * (x > len ? Math.exp(-(x - len) / 0.05) : 1) * vel;
    b.L[s0 + i] += v * l; b.R[s0 + i] += v * r;
  }
}

// ---------- sound design ----------
// noise through a band-pass whose center moves from f0 to f1: whooshes, risers, swishes
function sweep(b, t, dur, f0, f1, vel, rnd, { q = 1.2, shape = 'bell', pan0 = 0, pan1 = 0 } = {}) {
  if (rec('sweep', shape === 'rise' ? t + dur : t, { dur })) return;
  const s0 = idx(t), n = Math.round(dur * RATE), bl = biquad('bp', f0, q), br = biquad('bp', f0, q);
  for (let i = 0; i < n && s0 + i < N; i++) {
    const x = i / n;
    if (i % 32 === 0) { const f = f0 * (f1 / f0) ** x; retune(bl, 'bp', f, q); retune(br, 'bp', f, q); }
    const env = shape === 'rise' ? x ** 2.2 * Math.min(1, (1 - x) * 60) : shape === 'fall' ? (1 - x) ** 2 * Math.min(1, x * 40) : Math.sin(Math.PI * x) ** 1.5;
    const [l, r] = panLR(pan0 + (pan1 - pan0) * x);
    b.L[s0 + i] += run(bl, rnd() * 2 - 1) * env * vel * 2.2 * l;
    b.R[s0 + i] += run(br, rnd() * 2 - 1) * env * vel * 2.2 * r;
  }
}
// a big low hit: a falling sub and a dull thump
function impact(b, t, vel, rnd, { tail = 1.3 } = {}) {
  if (rec('impact', t)) return;
  const s0 = idx(t), n = Math.round(tail * 1.6 * RATE), lp = biquad('lp', 1400, 0.7);
  let p = 0;
  for (let i = 0; i < n && s0 + i < N; i++) {
    const x = i / RATE;
    p += (TAU * (32 + 90 * Math.exp(-x / 0.09))) / RATE;
    const v = (Math.sin(p) * Math.exp(-x / (tail * 0.45)) + run(lp, rnd() * 2 - 1) * 0.8 * Math.exp(-x / 0.12)) * Math.min(1, x / 0.002) * vel;
    b.L[s0 + i] += v; b.R[s0 + i] += v;
  }
}
// a riser: noise opening up and a tone climbing, louder and louder, to the drop
function riser(b, t0, t1, vel, rnd) {
  if (rec('riser', t1, { from: t0 })) return;
  const s0 = idx(t0), n = idx(t1) - s0, hl = biquad('hp', 300), hr = biquad('hp', 300);
  let p = 0;
  for (let i = 0; i < n && s0 + i < N; i++) {
    const x = i / n;
    if (i % 32 === 0) { retune(hl, 'hp', 300 * 20 ** x); retune(hr, 'hp', 300 * 20 ** x); }
    const f = 140 * 8 ** x;
    p = (p + f / RATE) % 1;
    const saw = (2 * p - 1 - blep(p, f / RATE)) * 0.18 * x;
    const env = x ** 2.4;
    b.L[s0 + i] += (run(hl, rnd() * 2 - 1) * 0.9 + saw) * env * vel;
    b.R[s0 + i] += (run(hr, rnd() * 2 - 1) * 0.9 + saw) * env * vel;
  }
}
// a cymbal backwards, swelling into t1
function reverseCymbal(b, t1, dur, vel, rnd) {
  if (rec('reverse', t1)) return;
  const s0 = idx(t1 - dur), n = Math.round(dur * RATE), hl = biquad('hp', 3000), hr = biquad('hp', 3000);
  for (let i = 0; i < n && s0 + i < N; i++) {
    const x = i / n;
    const env = Math.exp(-(1 - x) * 4) * Math.min(1, (1 - x) * 80);
    b.L[s0 + i] += run(hl, rnd() * 2 - 1) * env * vel;
    b.R[s0 + i] += run(hr, rnd() * 2 - 1) * env * vel;
  }
}
// a tiny click (a mouse, a key)
function click(b, t, vel, { f = 3200, pan = 0 } = {}) {
  if (rec('click', t)) return;
  const s0 = idx(t), n = Math.round(0.012 * RATE);
  const [l, r] = panLR(pan);
  for (let i = 0; i < n && s0 + i < N; i++) {
    const x = i / RATE;
    const v = Math.sin(TAU * f * x) * Math.exp(-x / 0.0025) * vel;
    b.L[s0 + i] += v * l; b.R[s0 + i] += v * r;
  }
}
// a blip (a UI sound at a pitch)
function blip(b, t, midi, vel, { pan = 0, len = 0.14 } = {}) {
  if (rec('blip', t, { midi })) return;
  const s0 = idx(t), n = Math.round(len * 2.2 * RATE), f = hz(midi);
  const [l, r] = panLR(pan);
  let p = 0;
  for (let i = 0; i < n && s0 + i < N; i++) {
    const x = i / RATE;
    p += (TAU * f * (1 + 0.06 * Math.exp(-x / 0.01))) / RATE;
    const v = (Math.sin(p) + 0.25 * Math.sin(2 * p)) * Math.min(1, x / 0.002) * Math.exp(-x / (len * 0.55)) * vel;
    b.L[s0 + i] += v * l; b.R[s0 + i] += v * r;
  }
}
// a bubble's pop
function pop(b, t, vel, { pan = 0, up = 1 } = {}) {
  if (rec('pop', t)) return;
  const s0 = idx(t), n = Math.round(0.12 * RATE);
  const [l, r] = panLR(pan);
  let p = 0;
  for (let i = 0; i < n && s0 + i < N; i++) {
    const x = i / RATE;
    p += (TAU * (up ? 260 + 900 * (1 - Math.exp(-x / 0.02)) : 900 - 600 * (1 - Math.exp(-x / 0.02)))) / RATE;
    const v = Math.sin(p) * Math.min(1, x / 0.001) * Math.exp(-x / 0.03) * vel;
    b.L[s0 + i] += v * l; b.R[s0 + i] += v * r;
  }
}
// a quick run of bells, high up: sparkles
function sparkle(b, t, vel, notes = [89, 93, 96, 101], gap = 0.045) {
  if (rec('sparkle', t)) return;
  notes.forEach((m, k) => bell(b, t + k * gap, m, vel * (1 - k * 0.12), { pan: (k / (notes.length - 1 || 1)) * 1.2 - 0.6, decay: 0.45, len: 0.9 }));
}
// lub-dub
function heartbeat(b, t, vel, rnd = Math.random) {
  if (rec('heartbeat', t)) return;
  for (const [d, v] of [[0, 1], [0.17, 0.62]]) {
    const s0 = idx(t + d), n = Math.round(0.35 * RATE), lp = biquad('lp', 420, 0.8), bp = biquad('bp', 240, 1.4);
    let p = 0;
    for (let i = 0; i < n && s0 + i < N; i++) {
      const x = i / RATE;
      p += (TAU * (52 + 58 * Math.exp(-x / 0.03))) / RATE;
      const body = Math.sin(p) + 0.45 * Math.sin(2 * p) + 0.2 * Math.sin(3 * p);
      const knock = run(bp, rnd() * 2 - 1) * Math.exp(-x / 0.02) * 1.4;
      const s = run(lp, body + knock) * Math.min(1, x / 0.004) * Math.exp(-x / 0.085) * vel * v * 1.3;
      b.L[s0 + i] += s; b.R[s0 + i] += s;
    }
  }
}
// a marker's squeak
function squeak(b, t, dur, vel, rnd) {
  if (rec('squeak', t)) return;
  const s0 = idx(t), n = Math.round(dur * RATE), bp = biquad('bp', 2300, 6);
  for (let i = 0; i < n && s0 + i < N; i++) {
    const x = i / n;
    if (i % 32 === 0) retune(bp, 'bp', 2100 + 900 * x + 150 * Math.sin(x * 40), 6);
    const v = run(bp, rnd() * 2 - 1) * Math.sin(Math.PI * x) * (0.7 + 0.3 * Math.sin(x * 90)) * vel * 3;
    b.L[s0 + i] += v; b.R[s0 + i] += v;
  }
}
// fire: a dark swell and crackles
function fire(b, t0, t1, vel, rnd) {
  if (rec('fire', t0, { to: t1 })) return;
  const s0 = idx(t0), n = idx(t1) - s0, lp = biquad('lp', 700, 0.7), hp = biquad('hp', 2500, 0.7);
  for (let i = 0; i < n && s0 + i < N; i++) {
    const x = i / n;
    const env = Math.min(1, x * 6) * Math.min(1, (1 - x) * 5);
    let v = run(lp, rnd() * 2 - 1) * 1.6 * env;
    if (rnd() < 0.0009) v += (rnd() * 2 - 1) * 4;                 // a crackle
    const c = run(hp, v) * 0.3;
    const pan = Math.sin(x * 9) * 0.3;
    b.L[s0 + i] += (v * 0.5 + c) * vel * (1 - pan); b.R[s0 + i] += (v * 0.5 + c) * vel * (1 + pan);
  }
}

// ---------- the song ----------
// I–V–vi–IV, a chord a bar (bar 4, the drop, is F)
const CHORDS = [
  { root: 41, notes: [53, 60, 65, 67, 69], pad: [53, 60, 64, 67] },     // F (add9)
  { root: 36, notes: [55, 60, 64, 67, 74], pad: [52, 55, 60, 62] },     // C (add9)
  { root: 38, notes: [57, 62, 65, 69, 72], pad: [53, 57, 60, 62] },     // Dm7
  { root: 34, notes: [53, 58, 62, 65, 69], pad: [53, 58, 62, 65] },     // B♭maj7
];
const chordAt = (bar) => CHORDS[(((bar - 4) % 4) + 4) % 4];
// the hook: four bars, [beat, length, note]
const HOOK = [
  [[0, 0.5, 84], [0.75, 0.25, 81], [1, 0.5, 79], [1.5, 0.5, 81], [2.5, 0.5, 77], [3, 0.5, 79], [3.5, 0.5, 81]],
  [[0, 0.75, 79], [0.75, 0.25, 76], [1, 0.5, 79], [1.5, 1.0, 84], [3, 0.5, 86], [3.5, 0.5, 84]],
  [[0, 0.5, 81], [0.75, 0.25, 77], [1, 0.5, 81], [1.5, 0.5, 84], [2, 1.0, 86], [3.5, 0.5, 84]],
  [[0, 0.5, 86], [0.5, 0.5, 84], [1, 0.5, 81], [1.5, 0.5, 79], [2, 1.5, 77], [3.5, 0.5, 79]],
];
const PENTA = [65, 67, 69, 72, 74, 77, 79, 81, 84, 86, 89, 91, 93, 96, 98, 101];   // F major pentatonic, up from F4
// what plays in each bar (the scenes: tools/promo/timeline.js)
function section(bar) {
  if (bar < 4) return 'intro';
  if (bar < 11) return 'dropA';        // the drop, her reveal, the benchmarks
  if (bar < 14) return 'verse';        // talk to her (half time, room for the chat's sounds)
  if (bar < 16) return 'build';        // her 16 hellos
  if (bar < 19) return 'dropA';        // the levels
  if (bar < 21) return 'dark';         // burning $AGI
  if (bar < 24) return 'break';        // she texts first, then the build to the second drop
  if (bar < 30) return 'dropB';        // the risk check, launching
  if (bar < 34) return 'more';         // everything else
  if (bar < 37) return 'finale';
  return 'end';
}

// what plays, when: every note and every hit, into the buses B → the kicks' times (for the side-chain)
function compose(B, rnd) {
  const kicks = [];
  const tb = (bar, beat = 0) => at(bar, beat);
  const lastBar = Math.floor(TOTAL / BAR);

  // ---- the cold open (0–8 s): her heartbeat, a pad, the lab ----
  M.heartbeats.forEach((t) => heartbeat(B.beat, t, 0.95, rnd));
  pad(B.pad, 0.25, [53, 60, 64, 67, 69], 3.6, 0.55, rnd, 900);          // Fmaj9, under the words
  pad(B.pad, 4.0, [50, 57, 60, 64, 65], 3.75, 0.6, rnd, 1200);           // Dm9
  M.openWords.forEach((t, k) => click(B.fx, t, 0.22, { f: 2400 + k * 180, pan: (k - 2) * 0.15 }));
  reverseCymbal(B.fx, M.agi, 0.75, 0.3, rnd);
  impact(B.fx, M.agi, 0.85, rnd);
  bass(B.bass, M.agi, 29, 0.9, 0.35, { cutoff: 200 });
  sweep(B.fx, M.spread, 0.6, 500, 3200, 0.14, rnd, { pan0: -0.5, pan1: 0.5 });
  [[M.spread, 72, 0.9], [M.spread + 0.5, 69], [M.spread + 1.0, 65], [M.spread + 1.25, 67], [M.spread + 1.5, 69, 0.6]].forEach(([t, m, l = 0.4]) => epiano(B.keys, t, m, l, 0.42, { pan: 0.15 }));
  epiano(B.keys, M.spread, 53, 1.8, 0.3); epiano(B.keys, M.spread, 60, 1.8, 0.26);
  squeak(B.fx, M.strike, 0.24, 0.32, rnd);
  sparkle(B.fx, M.write, 0.22, [77, 81, 84, 89, 93]);
  [[M.write + 0.5, 74], [M.write + 1.0, 72], [M.write + 1.25, 69]].forEach(([t, m]) => epiano(B.keys, t, m, 0.4, 0.38, { pan: -0.1 }));
  epiano(B.keys, M.write, 50, 1.6, 0.3); epiano(B.keys, M.write, 57, 1.6, 0.24);
  riser(B.fx, 6.3, M.drop - 0.12, 0.38, rnd);
  for (const t of [6.5, 7.0, 7.25, 7.5, 7.625, 7.75, 7.8125]) snare(B.drums, t, 0.18 + 0.32 * ((t - 6.5) / 1.3), rnd);
  bass(B.bass, 6.0, 41, 1.85, 0.22, { cutoff: 260 });
  click(B.fx, M.click, 0.45, { f: 2600, pan: 0.6 });

  // ---- the song (8–74 s), bar by bar ----
  for (let bar = 4; bar < 37; bar++) {
    const sec = section(bar);
    const ch = chordAt(bar);
    const t0 = tb(bar);
    const full = sec === 'dropA' || sec === 'dropB' || sec === 'finale' || sec === 'more';
    // drums
    if (full || sec === 'build' || sec === 'dark') {
      for (let k = 0; k < 4; k++) { kick(B.drums, tb(bar, k), 0.85); kicks.push(tb(bar, k)); }
      clap(B.drums, tb(bar, 1), 0.5, rnd, -0.08); clap(B.drums, tb(bar, 3), 0.5, rnd, 0.08);
      for (let s = 0; s < 16; s++) {
        const t = tb(bar, s / 4);
        if (s % 4 === 2) hat(B.drums, t, 0.27, true, rnd, 0.25);
        else if (sec !== 'dark' || s % 2 === 0) hat(B.drums, t, s % 2 ? 0.09 : 0.15, false, rnd, -0.25);
      }
      if (bar % 4 === 3 && sec !== 'build') for (const s of [3.25, 3.5, 3.75]) snare(B.drums, tb(bar, s), 0.22, rnd, 0.1);   // a fill into the next phrase
    } else if (sec === 'verse') {
      for (const k of [0, 2.5]) { kick(B.drums, tb(bar, k), 0.9); kicks.push(tb(bar, k)); }
      clap(B.drums, tb(bar, 2), 0.5, rnd);
      for (let s = 0; s < 8; s++) hat(B.drums, tb(bar, s / 2), s % 2 ? 0.1 : 0.06, false, rnd, 0.2);
    } else if (sec === 'break' && bar === 23) {
      // the build into the second drop: a snare roll, faster and faster
      for (let s = 0; s < 16; s++) snare(B.drums, tb(bar, s / 4), 0.1 + 0.25 * (s / 16), rnd, (s % 2 ? 0.15 : -0.15));
      for (let s = 0; s < 6; s++) snare(B.drums, tb(bar, 3 + s / 8), 0.3 + 0.05 * s, rnd);
    }
    // bass
    if (full) {
      for (const [k, l, o] of [[0, 0.6, 0], [0.75, 0.2, 12], [1.5, 0.45, 0], [2.5, 0.45, 0], [3, 0.2, 12], [3.5, 0.4, 0]]) bass(B.bass, tb(bar, k), ch.root + o, l, 0.62);
    } else if (sec === 'verse') {
      bass(B.bass, t0, ch.root, 1.2, 0.6); bass(B.bass, tb(bar, 2.5), ch.root, 1.2, 0.55);
    } else if (sec === 'build') {
      for (let k = 0; k < 8; k++) bass(B.bass, tb(bar, k / 2), ch.root + (k % 2 ? 12 : 0), 0.22, 0.55);
    } else if (sec === 'dark') {
      for (let k = 0; k < 8; k++) bass(B.bass, tb(bar, k / 2), ch.root, 0.3, 0.6, { cutoff: 300, growl: 0.8 });
    } else if (sec === 'break') {
      if (bar < 23) bass(B.bass, t0, ch.root, 1.9, 0.38, { cutoff: 240 });
    }
    // chords
    if (full) supersaw(B.chords, t0, ch.notes, BAR - 0.02, sec === 'finale' ? 0.62 : 0.5, rnd, { cutoff: sec === 'finale' ? 5200 : 4200 });
    else if (sec === 'dark') supersaw(B.chords, t0, ch.notes.map((m) => m - 12), BAR - 0.02, 0.45, rnd, { cutoff: 900, open: 0.6 });
    else if (sec === 'build') for (let k = 0; k < 8; k++) supersaw(B.chords, tb(bar, k / 2), ch.notes, 0.18, 0.4, rnd, { cutoff: 1200 + 3800 * ((bar - 14) * 8 + k) / 16, release: 0.06 });
    else if (sec === 'verse') for (const k of [0, 1.5, 2.5]) for (const m of ch.notes.slice(1)) epiano(B.keys, tb(bar, k), m, 0.9, 0.16, { pan: (m - 64) / 20 });
    if (sec === 'break' || sec === 'verse') pad(B.pad, t0, ch.pad, BAR, sec === 'break' ? 0.6 : 0.35, rnd, sec === 'break' ? 1600 : 1000);
    // the hook
    const hookBar = (bar - 4) % 4;
    if (sec === 'dropA' || sec === 'dropB' || sec === 'finale') {
      for (const [k, l, m] of HOOK[hookBar]) {
        lead(B.lead, tb(bar, k), m, l, 0.3, { pan: 0 });
        if (sec !== 'dropA') lead(B.lead, tb(bar, k), m - 12, l, 0.16, { pan: 0, bright: 0.6 });          // an octave down, fuller
        if (sec === 'finale') bell(B.keys, tb(bar, k), m + 12, 0.07, { pan: 0.3, decay: 0.4, len: 0.8 });
      }
    } else if (sec === 'break' && bar < 23) {
      for (const [k, l, m] of HOOK[hookBar]) bell(B.keys, tb(bar, k), m, 0.14, { pan: 0.2, decay: 0.6 });
    }
    // arpeggios: 16ths through the chord, in the second drop and "more"
    if (sec === 'dropB' || sec === 'more') {
      const tones = [...ch.notes.slice(1), ...ch.notes.slice(1).map((m) => m + 12)];
      for (let s = 0; s < 16; s++) pluck(B.arp, tb(bar, s / 4), tones[(s * 3) % tones.length] + 12, s % 4 === 0 ? 0.2 : 0.13, { pan: Math.sin(s * 0.8) * 0.5 });
    }
  }
  // the drop
  impact(B.fx, M.drop, 1.0, rnd);
  crash(B.drums, M.drop, 0.32, rnd);
  M.letters.forEach((t, k) => { impact(B.fx, t, 0.35 + 0.1 * k, rnd, { tail: 0.5 }); supersaw(B.chords, t, chordAt(4).notes.map((m) => m + 12), 0.2, 0.45, rnd, { cutoff: 6000, release: 0.08 }); });
  sparkle(B.fx, M.reveal, 0.14, [84, 89, 93, 96, 101, 105]);
  pop(B.fx, M.bubble, 0.4, { pan: 0.4 });
  sweep(B.fx, M.orbit, 1.0, 400, 2200, 0.16, rnd, { pan0: -0.9, pan1: 0.9 });
  impact(B.fx, M.name, 0.5, rnd, { tail: 0.6 }); crash(B.drums, M.name, 0.2, rnd, 1.4);
  // the benchmarks race in: a blip each, higher and higher
  M.bars.forEach((t, k) => { blip(B.fx, t, PENTA[5 + k], 0.22, { pan: -0.4 + k * 0.16 }); blip(B.fx, t + 0.08, PENTA[5 + k] - 12, 0.1); });
  impact(B.fx, M.sticker, 0.55, rnd, { tail: 0.5 }); snare(B.drums, M.sticker, 0.5, rnd); crash(B.drums, M.sticker, 0.18, rnd, 1);
  // the chat
  sweep(B.fx, M.send - 0.12, 0.3, 900, 4500, 0.16, rnd, { shape: 'rise', pan0: 0.3, pan1: 0.6 });
  [0, 0.15, 0.3, 0.45].forEach((d) => click(B.fx, M.typing + d, 0.14, { f: 1900, pan: -0.3 }));
  pop(B.fx, M.reply, 0.45, { pan: -0.2 }); sparkle(B.fx, M.reply + 0.05, 0.13, [84, 88, 91]);
  M.pills.forEach((t, k) => blip(B.fx, t, [84, 86, 89][k], 0.2, { pan: -0.3 + k * 0.3 }));
  // her 16 hellos: a note each, up the scale (and faster)
  M.langs.forEach((t, k) => pluck(B.arp, t, PENTA[k], 0.32 - k * 0.006, { pan: Math.sin(k * 1.3) * 0.55, len: k < 4 ? 0.22 : 0.1 }));
  impact(B.fx, M.stamp16, 0.6, rnd, { tail: 0.6 }); snare(B.drums, M.stamp16, 0.45, rnd); crash(B.drums, M.stamp16, 0.24, rnd, 1.6);
  // the levels
  M.cards.forEach((t, k) => { sweep(B.fx, t - 0.12, 0.24, 700, 2600, 0.12, rnd, { pan0: k - 1.2, pan1: k - 0.8 }); kick(B.fx, t, 0.25); });
  [77, 81, 84, 89, 93].forEach((m, k) => pluck(B.arp, M.levelUp + k * 0.055, m, 0.3, { pan: k * 0.2 - 0.4 }));
  sparkle(B.fx, M.levelUp + 0.28, 0.15, [96, 101, 105]);
  bell(B.fx, M.trust, 84, 0.16, { decay: 0.5 }); bell(B.fx, M.trust + 0.1, 89, 0.12, { decay: 0.5 });
  // burning $AGI
  impact(B.fx, M.burnIn, 0.55, rnd, { tail: 0.7 });
  sweep(B.fx, M.burn - 0.35, 0.7, 150, 1500, 0.3, rnd, { q: 0.8 });
  fire(B.fx, M.burn - 0.1, 41.9, 0.22, rnd);
  for (let i = 0; i < 7; i++) bell(B.fx, M.burn - 0.25 + i * 0.3 + 0.55, [96, 93, 98, 91, 96, 89, 93][i], 0.1, { decay: 0.25, len: 0.5, pan: Math.sin(i * 2) * 0.4 });
  // she texts first: her text arrives (a phone's two-note chime and its buzz)
  bell(B.fx, M.ding, 88, 0.3, { decay: 0.7 }); bell(B.fx, M.ding + 0.14, 93, 0.26, { decay: 0.9 });
  for (let i = 0; i < 3; i++) blip(B.fx, M.ding + i * 0.06, 33, 0.18, { len: 0.06 });
  pop(B.fx, M.group + 0.1, 0.35, { pan: -0.3 });
  pop(B.fx, M.groupReply, 0.38, { pan: 0.3 }); sparkle(B.fx, M.groupReply + 0.05, 0.12, [86, 89, 93]);
  riser(B.fx, M.riser2, M.drop2 - 0.12, 0.42, rnd);
  sweep(B.fx, M.drop2 - 0.24, 0.42, 300, 6000, 0.25, rnd, { shape: 'rise', pan0: 0.8, pan1: -0.8 });   // the whip pan
  // the second drop: the risk check
  impact(B.fx, M.drop2, 1.0, rnd); crash(B.drums, M.drop2, 0.32, rnd);
  // its scanner: a tick for every row that goes past
  let last = 0;
  for (let s = idx(M.scan - 0.15); s < idx(M.found + 0.05); s += 48) {
    const p = Math.floor(scanPos(s / RATE));
    if (p > last && p < SCAN_ROWS) { click(B.fx, s / RATE, 0.12, { f: 3600 + (p % 4) * 300, pan: 0.35 }); last = p; }
  }
  blip(B.fx, M.found, 84, 0.3, { pan: 0.3 }); blip(B.fx, M.found + 0.1, 91, 0.3, { pan: 0.3 }); impact(B.fx, M.found, 0.35, rnd, { tail: 0.4 });
  sparkle(B.fx, M.herCheck, 0.16, [89, 93, 96, 101]);
  // launching
  sweep(B.fx, M.launchCmd - 0.1, 0.3, 800, 4000, 0.15, rnd, { shape: 'rise', pan0: 0.4, pan1: 0.7 }); click(B.fx, M.launchCmd, 0.25);
  pop(B.fx, M.launchCmd + 0.62, 0.35, { pan: -0.3 });
  M.launchSteps.forEach((t, k) => blip(B.fx, t, [84, 88, 91][k], 0.28, { pan: 0.2 + k * 0.15 }));
  riser(B.fx, M.launched - 0.5, M.launched, 0.25, rnd);
  impact(B.fx, M.launched, 0.65, rnd); crash(B.drums, M.launched, 0.26, rnd);
  sweep(B.fx, M.launched, 1.1, 300, 5000, 0.2, rnd, { shape: 'fall', pan0: 0, pan1: 0.7 });
  // everything else: a pop and a note for each card
  M.more.forEach((t, k) => { pop(B.fx, t, 0.3, { pan: (k % 4) * 0.3 - 0.45 }); blip(B.fx, t + 0.02, PENTA[6 + k], 0.16, { pan: (k % 4) * 0.3 - 0.45 }); });
  // the finale
  impact(B.fx, M.finale, 0.9, rnd); crash(B.drums, M.finale, 0.3, rnd);
  sparkle(B.fx, M.wave, 0.16, [89, 93, 96]);
  impact(B.fx, M.url, 0.5, rnd, { tail: 0.5 }); snare(B.drums, M.url, 0.4, rnd); crash(B.drums, M.url, 0.18, rnd, 1.2);
  sparkle(B.fx, M.hearts, 0.18, [93, 96, 101, 105, 108]);
  // every cut gets a swish into it
  for (const s of SCENES.slice(1)) if (![M.drop, M.drop2].includes(s.from)) sweep(B.fx, s.from - 0.3, 0.36, 500, 3800, 0.12, rnd, { shape: 'rise', pan0: -0.6, pan1: 0.6 });
  // the end: one big chord, ringing out, and two last heartbeats
  impact(B.fx, M.end, 1.0, rnd, { tail: 2 }); crash(B.drums, M.end, 0.34, rnd, 3);
  supersaw(B.chords, M.end, [41, 53, 60, 65, 67, 69, 72], 2.6, 0.75, rnd, { cutoff: 3600, release: 1.0, voices: 5 });
  bass(B.bass, M.end, 29, 2.4, 0.5, { cutoff: 220 });
  [65, 69, 72, 77].forEach((m, k) => epiano(B.keys, M.end + k * 0.04, m, 2.2, 0.28, { pan: k * 0.25 - 0.4 }));
  sparkle(B.fx, M.end + 0.2, 0.12, [89, 93, 96, 101, 105]);
  M.lastBeats.forEach((t, k) => heartbeat(B.beat, t, 0.7 - k * 0.15, rnd));
  return kicks;
}

// the dry run: every sound and when it happens (nothing is synthesized: fast) → [{ name, t, … }], sorted by time
export function musicPlan() {
  REC = [];
  const B = new Proxy({}, { get: () => ({}) });
  try { compose(B, seeded(20261003)); return REC.sort((a, b) => a.t - b.t); } finally { REC = null; }
}

export function renderMusic({ stems = false } = {}) {
  const rnd = seeded(20261003);
  const B = { drums: bus(), bass: bus(), chords: bus(), pad: bus(), lead: bus(), keys: bus(), arp: bus(), fx: bus(), beat: bus() };
  const send = { verb: bus(), delay: bus() };
  const kicks = compose(B, rnd);

  // ---- the mix ----
  // the chords, pad and bass breathe with the kick (side-chain), for the pump of a dance track
  const duck = new Float32Array(N).fill(1);
  for (const t of kicks) {
    const s0 = idx(t);
    for (let i = 0; i < 0.32 * RATE && s0 + i < N; i++) {
      const x = i / RATE;
      const g = 1 - 0.72 * Math.exp(-x / 0.07) * Math.min(1, x / 0.004 + 0.6);
      if (g < duck[s0 + i]) duck[s0 + i] = g;
    }
  }
  const DUCK = { chords: 1, pad: 0.6, bass: 0.55, arp: 0.35 };
  for (const [k, depth] of Object.entries(DUCK)) {
    const b = B[k];
    for (let i = 0; i < N; i++) { const g = 1 - depth * (1 - duck[i]); b.L[i] *= g; b.R[i] *= g; }
  }
  // the non-bass parts lose their lowest rumble (room for the kick and the bass)
  for (const k of ['chords', 'pad', 'lead', 'keys', 'arp']) {
    const hl = biquad('hp', k === 'pad' ? 140 : 180), hr = biquad('hp', k === 'pad' ? 140 : 180);
    const b = B[k];
    for (let i = 0; i < N; i++) { b.L[i] = run(hl, b.L[i]); b.R[i] = run(hr, b.R[i]); }
  }
  const LEVEL = { drums: 0.9, bass: 0.8, chords: 0.52, pad: 0.34, lead: 0.8, keys: 0.66, arp: 0.52, fx: 0.8, beat: 1.0 };
  const VERB = { chords: 0.12, pad: 0.2, lead: 0.22, keys: 0.35, arp: 0.25, fx: 0.18, drums: 0.05 };
  const DELAY = { lead: 0.22, arp: 0.15, keys: 0.12 };
  for (const [k, lv] of Object.entries(LEVEL)) {
    const b = B[k], vs = (VERB[k] || 0) * lv, ds = (DELAY[k] || 0) * lv;
    for (let i = 0; i < N; i++) {
      const l = b.L[i], r = b.R[i];
      if (vs) { send.verb.L[i] += l * vs; send.verb.R[i] += r * vs; }
      if (ds) { send.delay.L[i] += l * ds; send.delay.R[i] += r * ds; }
      b.L[i] = l * lv; b.R[i] = r * lv;
    }
  }
  const verb = reverb(send.verb);
  const delay = pingPong(send.delay, BEAT * 0.75, 0.32);
  // the mix bus: everything, then a clean low end, a soft saturation and a limiter
  const out = bus();
  for (const b of [...Object.values(B), verb, delay]) for (let i = 0; i < N; i++) { out.L[i] += b.L[i]; out.R[i] += b.R[i]; }
  // the breaths before the drops: a moment of silence (the drop hits harder)
  for (const t of [M.drop, M.drop2, M.end]) gap(out, t - BEAT / 4 + 0.01, t - 0.004);
  const hl = biquad('hp', 28), hr = biquad('hp', 28);
  for (let i = 0; i < N; i++) { out.L[i] = run(hl, out.L[i]); out.R[i] = run(hr, out.R[i]); }
  master(out);
  // the end: everything fades in its last half second
  const f0 = idx(TOTAL - 0.6), f1 = idx(TOTAL);
  for (let i = f0; i < N; i++) { const g = i >= f1 ? 0 : (1 - (i - f0) / (f1 - f0)) ** 2; out.L[i] *= g; out.R[i] *= g; }
  const wav = toWav(out, idx(TOTAL));
  return stems ? { wav, stems: B, out } : wav;
}

// a stereo hall (Freeverb's combs and allpasses, a slightly different set in each ear)
function reverb(input) {
  const out = bus();
  const CB = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], AP = [556, 441, 341, 225];
  for (const [ch, spread] of [['L', 0], ['R', 23]]) {
    const combs = CB.map((n) => ({ buf: new Float32Array(Math.round((n + spread) * RATE / 44100)), i: 0, lp: 0 }));
    const alls = AP.map((n) => ({ buf: new Float32Array(Math.round((n + spread) * RATE / 44100)), i: 0 }));
    const x = input[ch], y = out[ch];
    const pre = Math.round(0.018 * RATE);
    for (let n = 0; n < N; n++) {
      const inp = n >= pre ? x[n - pre] * 0.015 : 0;
      let s = 0;
      for (const c of combs) {
        const v = c.buf[c.i];
        c.lp = v * 0.72 + c.lp * 0.28;
        c.buf[c.i] = inp + c.lp * 0.86;
        if (++c.i >= c.buf.length) c.i = 0;
        s += v;
      }
      for (const a of alls) {
        const v = a.buf[a.i];
        a.buf[a.i] = s + v * 0.5;
        if (++a.i >= a.buf.length) a.i = 0;
        s = v - s;
      }
      y[n] = s;
    }
  }
  return out;
}
// a ping-pong delay (left, right, left…), its echoes darker each time
function pingPong(input, time, fb) {
  const out = bus();
  const d = Math.round(time * RATE);
  const bl = new Float32Array(d), br = new Float32Array(d);
  let i = 0, ll = 0, lr = 0;
  for (let n = 0; n < N; n++) {
    const el = bl[i], er = br[i];
    ll = ll * 0.4 + el * 0.6; lr = lr * 0.4 + er * 0.6;
    bl[i] = (input.L[n] + input.R[n]) * 0.5 + lr * fb;
    br[i] = ll * fb;
    out.L[n] = el; out.R[n] = er;
    if (++i >= d) i = 0;
  }
  return out;
}
// a short silence, with tiny fades so it never clicks
function gap(b, t0, t1) {
  const s0 = idx(t0), s1 = idx(t1), f = Math.round(0.004 * RATE);
  for (let i = s0 - f; i < s1 + f; i++) {
    if (i < 0 || i >= N) continue;
    const g = i < s0 ? (s0 - i) / f : i >= s1 ? (i - s1) / f : 0;
    b.L[i] *= g; b.R[i] *= g;
  }
}
// loud enough for a phone, never clipping: a gain to a target level, a soft saturation, then a look-ahead limiter
function master(b) {
  let sum = 0, cnt = 0;
  for (let i = 0; i < N; i += 4) { const v = (b.L[i] ** 2 + b.R[i] ** 2) / 2; if (v > 1e-6) { sum += v; cnt++; } }
  const rms = Math.sqrt(sum / Math.max(1, cnt));
  const gain = 0.2 / Math.max(1e-6, rms);
  for (let i = 0; i < N; i++) { b.L[i] = Math.tanh(b.L[i] * gain * 1.1) / 1.1; b.R[i] = Math.tanh(b.R[i] * gain * 1.1) / 1.1; }
  const ceiling = 0.89, look = Math.round(0.004 * RATE), rel = Math.exp(-1 / (0.08 * RATE));
  const peak = new Float32Array(N);
  for (let i = 0; i < N; i++) peak[i] = Math.max(Math.abs(b.L[i]), Math.abs(b.R[i]));
  // the most each sample will need, looking a few ms ahead
  const need = new Float32Array(N);
  const dq = [];
  for (let i = N - 1; i >= 0; i--) {
    while (dq.length && peak[dq[dq.length - 1]] <= peak[i]) dq.pop();
    dq.push(i);
    while (dq[0] > i + look) dq.shift();
    const p = peak[dq[0]];
    need[i] = p > ceiling ? ceiling / p : 1;
  }
  // down quickly (within the look-ahead, so a peak never gets through), back up slowly
  const atk = 1 - Math.exp(-1 / (0.0012 * RATE));
  let g = 1;
  for (let i = 0; i < N; i++) {
    g = need[i] < g ? g + (need[i] - g) * atk : need[i] - (need[i] - g) * rel;
    b.L[i] *= g; b.R[i] *= g;
  }
}
function toWav(b, n) {
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(RATE, 24); buf.writeUInt32LE(RATE * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(clamp(b.L[i], -1, 1) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(clamp(b.R[i], -1, 1) * 32767), 46 + i * 4);
  }
  return buf;
}
