// The roadmap's video (2026-10-14, the owner: "can you create a graphic and just short promotional video for the
// roadmap"): its music, composed and played in code by Claude (no samples, no service, nobody else's music), on the
// video's own clock (tools/roadmap-promo/timeline.js): 120 beats a minute, A major, vi–IV–I–V (F#m7, Dmaj7, A(add9),
// E(add9)). The title slams in on F#m, a bar on E builds to the first drop (V to vi), the road's two drops start on F#m,
// the hook is sung in full once her third line is said (on A, under the stamps), the locked card goes dark, a bar on E
// lifts into the end, and the end chord is A (V to I: home).
// AGI-1's four lines go over it (tools/studio-promo/voice.js dips the music under her): every hit of the music (its
// impacts and crashes) is where she isn't (the title's three slams, the two drops, the three stamps, the lock, the end
// and its two last hits), and under her words only soft sounds (pops, blips, whooshes, ticks, glitches, bells).
// renderMusic() → a WAV file (48 kHz, stereo, 16-bit). musicPlan() → every sound and when (the tests read it). Pure: the
// same notes always make the same sound.
// The engine (filters, drums, synths, the mix) is the one Claude wrote for AGI-1's launch video (tools/promo/music.js),
// as AGI Studio's launch video has it (tools/studio-promo/music.js).
import { BEAT, BAR, at, TOTAL, MOMENTS as M } from './timeline.js';

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
    const bel = Math.sin(pb + 1.1 * Math.exp(-x / 0.12) * Math.sin(pm)) * Math.exp(-x / 0.5) * 0.35;
    const v = (run(lp, saw * 0.6 + pulse * 0.25) + bel) * env * vel;
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
// a short pluck (a triangle through a closing filter): arpeggios, the choices' notes
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
// a tiny click (a mouse, a key, a tap)
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
function sparkle(b, t, vel, notes = [90, 93, 98, 102], gap = 0.045) {
  if (rec('sparkle', t)) return;
  notes.forEach((m, k) => bell(b, t + k * gap, m, vel * (1 - k * 0.12), { pan: (k / (notes.length - 1 || 1)) * 1.2 - 0.6, decay: 0.45, len: 0.9 }));
}
// a camera's shutter: the curtain opening and closing (two quick mechanical clacks), with a little body under them
function shutter(b, t, vel, rnd, { pan = 0 } = {}) {
  if (rec('shutter', t)) return;
  const [l, r] = panLR(pan);
  for (const [d, v, f] of [[0, 1, 2400], [0.058, 0.72, 3300]]) {
    const s0 = idx(t + d), n = Math.round(0.06 * RATE), bp = biquad('bp', f, 1.5), lp = biquad('lp', 700, 0.7);
    for (let i = 0; i < n && s0 + i < N; i++) {
      const x = i / RATE;
      const z = rnd() * 2 - 1;
      const s = (run(bp, z) * 2.6 * Math.exp(-x / 0.005) + run(lp, z) * 1.1 * Math.exp(-x / 0.014)) * Math.min(1, x / 0.0004) * vel * v;
      b.L[s0 + i] += s * l; b.R[s0 + i] += s * r;
    }
  }
}
// a digital stutter: five tiny bursts in a row, bouncing between the ears (the influencer swapped into a clip)
function glitch(b, t, vel, rnd) {
  if (rec('glitch', t)) return;
  for (let k = 0; k < 5; k++) {
    const s0 = idx(t + k * 0.034), n = Math.round(0.024 * RATE), bp = biquad('bp', 700 + ((k * 1900) % 5200), 2.2);
    const [l, r] = panLR(k % 2 ? 0.7 : -0.7);
    for (let i = 0; i < n && s0 + i < N; i++) {
      const x = i / RATE;
      const v = run(bp, rnd() * 2 - 1) * 2.4 * Math.min(1, x / 0.001) * Math.exp(-x / 0.011) * vel * (1 - k * 0.1);
      b.L[s0 + i] += v * l; b.R[s0 + i] += v * r;
    }
  }
}
// a tone that falls (a price coming down): a sine gliding from f0 to f1, with a soft body
function whomp(b, t, vel, { f0 = 1100, f1 = 160, dur = 0.42, pan = 0 } = {}) {
  if (rec('whomp', t)) return;
  const s0 = idx(t), n = Math.round(dur * 1.4 * RATE);
  const [l, r] = panLR(pan);
  let p = 0;
  for (let i = 0; i < n && s0 + i < N; i++) {
    const x = i / RATE, q = Math.min(1, x / dur);
    p += (TAU * f0 * (f1 / f0) ** (q ** 0.7)) / RATE;
    const v = (Math.sin(p) + 0.3 * Math.sin(2 * p)) * Math.min(1, x / 0.003) * Math.exp(-x / (dur * 0.7)) * vel;
    b.L[s0 + i] += v * l; b.R[s0 + i] += v * r;
  }
}

// ---------- the song ----------
const CHORDS = [
  { name: 'F#m7', root: 42, notes: [57, 61, 64, 66, 69], pad: [54, 57, 61, 64] },
  { name: 'Dmaj7', root: 38, notes: [57, 61, 62, 66, 69], pad: [50, 57, 62, 66] },
  { name: 'A(add9)', root: 33, notes: [57, 61, 64, 69, 71], pad: [52, 57, 61, 64] },
  { name: 'E(add9)', root: 40, notes: [56, 59, 64, 66, 68], pad: [52, 56, 59, 64] },
];
// the hook: a bar for each chord, [beat, length, note]
export const HOOK = [
  [[0, 0.5, 73], [0.75, 0.25, 76], [1, 0.5, 78], [1.5, 0.5, 76], [2.5, 0.5, 73], [3, 0.5, 71], [3.5, 0.5, 73]],
  [[0, 0.75, 78], [0.75, 0.25, 76], [1, 0.5, 73], [1.5, 1.0, 76], [3, 0.5, 78], [3.5, 0.5, 81]],
  [[0, 0.5, 81], [0.75, 0.25, 78], [1, 0.5, 76], [1.5, 0.5, 78], [2, 1.0, 76], [3.5, 0.5, 73]],
  [[0, 0.5, 71], [0.5, 0.5, 73], [1, 0.5, 76], [1.5, 0.5, 78], [2, 1.5, 76], [3.5, 0.5, 73]],
];
// A major pentatonic, up from A4: the road's stops' notes
const PENTA = [69, 71, 73, 76, 78, 81, 83, 85, 88, 90, 93, 95, 97, 100, 102, 105];
const P = (k) => PENTA[Math.min(PENTA.length - 1, Math.max(0, Math.round(k)))];
// the locked stop's note: low, closed (C#4, under everything else the stops play)
const LOCKED = 61;
// what plays in each bar: [its first bar, the section, the chord it starts on] (the scenes: timeline.js)
export const SECTIONS = [
  [0, 'intro', 0],      //   0–2 s    the title's three slams (F#m), her first line
  [1, 'build', 3],      //   2–4 s    the road and its six stops: E, a riser and a snare roll, a breath
  [2, 'dropA', 0],      //   4–8 s    the drop: live now (F#m, D)
  [4, 'dropB', 0],      //   8–14 s   the second drop: coming soon (F#m, D), then the hook in full and its stamps (A)
  [7, 'dark', 0],       //  14–16 s   the locked card (F#m, dark)
  [8, 'lift', 3],       //  16–18 s   the whole road at once, into the end (E)
  [9, 'end', 2],        //  18–21.5 s the end chord (A), its two last hits
];
export function sectionAt(bar) {
  let s = SECTIONS[0];
  for (const x of SECTIONS) if (bar >= x[0]) s = x;
  const [from, name, first] = s;
  const next = SECTIONS.find((x) => x[0] > from);
  return { name, from, to: next ? next[0] : Infinity, chord: (first + bar - from) % 4 };
}
// the bar where the hook is sung in full: her third line is said, the stamps come down (A)
export const HOOK_BAR = 6;

// what plays, when: every note and every hit, into the buses B → the kicks' times (for the side-chain)
function compose(B, rnd) {
  const kicks = [];
  const K = (t, vel = 0.85) => { kick(B.drums, t, vel); kicks.push(t); };
  const tb = (bar, beat = 0) => at(bar, beat);
  const [Fm, , A9, E9] = CHORDS;

  // ---- 1. the title (0–4 s) ----
  pad(B.pad, M.open, Fm.pad, BAR, 0.42, rnd, 900);
  sweep(B.fx, M.open, 0.45, 500, 3200, 0.1, rnd, { shape: 'rise', pan0: 0.4, pan1: -0.1 });           // her art, revealed in dots
  sparkle(B.fx, M.reveal + 0.05, 0.08, [93, 97, 100]);
  blip(B.fx, M.kicker, 81, 0.15, { pan: -0.4 }); blip(B.fx, M.kicker + 0.07, 88, 0.12, { pan: -0.4 });   // "Roadmap · October 2026"
  // The · AGI · roadmap: a slam each, bigger and bigger; the last with a crash and the whole chord
  M.titleWords.forEach((t, k) => {
    K(t, [0.7, 0.8, 0.95][k]);
    impact(B.fx, t, [0.45, 0.62, 0.9][k], rnd, { tail: [0.4, 0.5, 1.0][k] });
    clap(B.drums, t, [0.26, 0.34, 0.44][k], rnd, [-0.15, 0.15, 0][k]);
    supersaw(B.chords, t, k < 2 ? Fm.notes.slice(0, 3 + k) : Fm.notes, k < 2 ? 0.16 : 0.9, [0.3, 0.38, 0.55][k], rnd,
      { cutoff: 2400 + 900 * k, release: k < 2 ? 0.05 : 0.25 });
  });
  crash(B.drums, M.titleWords[2], 0.26, rnd, 1.8);
  bass(B.bass, M.titleWords[2], Fm.root, 0.95, 0.55);
  // under her first line, a light groove
  for (let s = 1; s < 8; s++) hat(B.drums, M.titleWords[2] + (s * BEAT) / 4, s % 2 ? 0.06 : 0.1, false, rnd, 0.2);
  K(tb(0, 3.5), 0.55);
  pop(B.fx, M.sub, 0.26, { pan: -0.2 });                                                              // "What's live today…"
  for (const m of [61, 64, 69]) epiano(B.keys, M.sub, m, 0.45, 0.13, { pan: (m - 64) / 12 });
  // the bar on E, building to the drop
  pad(B.pad, tb(1), E9.pad, M.breath - tb(1), 0.38, rnd, 1000);
  for (let k = 0; k < 3; k++) K(tb(1, k), 0.6);
  for (let s = 0; s < 14; s++) hat(B.drums, tb(1, s / 4), s % 2 ? 0.07 : 0.11, false, rnd, -0.2);
  for (let k = 0; k < 7; k++) bass(B.bass, tb(1, k / 2), E9.root + (k % 2 ? 12 : 0), 0.22, 0.52);
  for (let k = 0; k < 7; k++) supersaw(B.chords, tb(1, k / 2), E9.notes, 0.18, 0.34, rnd, { cutoff: 1300 + 2600 * (k / 7), release: 0.06 });
  riser(B.fx, tb(1), M.breath, 0.36, rnd);
  for (const s of [2, 2.25, 2.5, 2.75, 3, 3.125, 3.25, 3.375]) snare(B.drums, tb(1, s), 0.1 + 0.26 * ((s - 2) / 1.375), rnd, (s * 8) % 2 ? 0.15 : -0.15);
  // the road draws in, and its six stops: two live (a note and a ding), three soon (each a note higher), one locked
  sweep(B.fx, M.road - 0.1, 0.55, 400, 3600, 0.13, rnd, { pan0: -0.7, pan1: 0.7 });
  M.dots.forEach((t, k) => {
    const pan = -0.6 + k * 0.24;
    if (k < 5) blip(B.fx, t, P(5 + k), k < 2 ? 0.17 : 0.13, { pan });
    else { blip(B.fx, t, LOCKED, 0.18, { pan, len: 0.1 }); click(B.fx, t, 0.22, { f: 1500, pan }); }
    if (k < 2) bell(B.fx, t + 0.01, P(10 + k), 0.06, { decay: 0.3, len: 0.6, pan });
  });

  // ---- the road (4–18 s), bar by bar ----
  for (let bar = 2; bar < 9; bar++) {
    const sec = sectionAt(bar), ch = CHORDS[sec.chord], t0 = tb(bar), name = sec.name;
    const last = bar === sec.to - 1;                     // the section's last bar: a fill into the breath after it
    if (name === 'dropA' || name === 'dropB') {
      for (let k = 0; k < 4; k++) K(tb(bar, k));
      clap(B.drums, tb(bar, 1), 0.5, rnd, -0.08); clap(B.drums, tb(bar, 3), 0.5, rnd, 0.08);
      for (let s = 0; s < 16; s++) {
        const t = tb(bar, s / 4);
        if (inBreath(t)) continue;                       // the breath before the next drop is silence
        if (s % 4 === 2) hat(B.drums, t, 0.25, true, rnd, 0.25);
        else hat(B.drums, t, s % 2 ? 0.09 : 0.15, false, rnd, -0.25);
      }
      if (last) for (const s of [3, 3.125, 3.25, 3.375]) snare(B.drums, tb(bar, s), 0.18 + 0.4 * (s - 3), rnd, 0.1);
      for (const [k, l, o] of [[0, 0.6, 0], [0.75, 0.2, 12], [1.5, 0.45, 0], [2.5, 0.45, 0], [3, 0.2, 12], [3.5, 0.4, 0]]) bass(B.bass, tb(bar, k), ch.root + o, l, 0.62);
      const full = bar === HOOK_BAR;
      supersaw(B.chords, t0, ch.notes, BAR - 0.02, full ? 0.58 : 0.5, rnd, { cutoff: full ? 5000 : 4200 });
      // the hook: on the lead, softer under her words; in full after them, an octave down too, and bells
      for (const [k, l, m] of HOOK[sec.chord]) {
        lead(B.lead, tb(bar, k), m, l, full ? 0.32 : name === 'dropA' ? 0.22 : 0.18);
        if (full) {
          lead(B.lead, tb(bar, k), m - 12, l, 0.17, { bright: 0.6 });
          bell(B.keys, tb(bar, k), m + 12, 0.07, { pan: 0.3, decay: 0.4, len: 0.8 });
        }
      }
      // the second drop's arpeggios: 16ths through the chord
      if (name === 'dropB') {
        const tones = [...ch.notes.slice(1), ...ch.notes.slice(1).map((m) => m + 12)];
        for (let s = 0; s < 16; s++) {
          if (!inBreath(tb(bar, s / 4))) pluck(B.arp, tb(bar, s / 4), tones[(s * 3) % tones.length] + 12, s % 4 === 0 ? 0.2 : 0.13, { pan: Math.sin(s * 0.8) * 0.5 });
        }
      }
    } else if (name === 'dark') {
      K(t0, 0.8); K(tb(bar, 2.5), 0.55);
      for (let s = 0; s < 16; s++) click(B.drums, tb(bar, s / 4), s % 4 === 0 ? 0.1 : 0.05, { f: 5200 + (s % 3) * 700, pan: Math.sin(s * 1.7) * 0.6 });
      for (let k = 0; k < 8; k++) bass(B.bass, tb(bar, k / 2), ch.root, 0.3, 0.56, { cutoff: 300, growl: 0.8 });
      supersaw(B.chords, t0, ch.notes.map((m) => m - 12), BAR - 0.02, 0.42, rnd, { cutoff: 900, open: 0.6 });
      pad(B.pad, t0, ch.pad, BAR, 0.34, rnd, 1000);
    } else if (name === 'lift') {
      for (let k = 0; k < 4; k++) K(tb(bar, k), 0.62);
      for (let s = 0; s < 8; s++) hat(B.drums, tb(bar, s / 2), s % 2 ? 0.08 : 0.13, false, rnd, -0.2);
      for (let k = 0; k < 7; k++) bass(B.bass, tb(bar, k / 2), ch.root + (k % 2 ? 12 : 0), 0.22, 0.55);
      for (let k = 0; k < 7; k++) supersaw(B.chords, tb(bar, k / 2), ch.notes, 0.18, 0.36, rnd, { cutoff: 1200 + 3000 * (k / 7), release: 0.06 });
      for (const s of [2.5, 2.75, 3, 3.125, 3.25, 3.375]) snare(B.drums, tb(bar, s), 0.14 + 0.2 * ((s - 2.5) / 0.875), rnd, (s * 8) % 2 ? 0.12 : -0.12);
    }
  }

  // ---- 2. live now (4–8 s): the drop, its two stops, their cards, their checks ----
  reverseCymbal(B.fx, M.drop, 0.9, 0.3, rnd);
  impact(B.fx, M.drop, 1.0, rnd); crash(B.drums, M.drop, 0.32, rnd);
  sparkle(B.fx, M.drop + 0.08, 0.13, [90, 93, 97, 100, 105]);
  M.nodes.forEach((t, k) => { const pan = k ? 0.1 : -0.3; pop(B.fx, t, 0.3, { pan }); pluck(B.arp, t, P(5 + k * 2), 0.2, { pan }); });
  M.cards.forEach((t, k) => {
    sweep(B.fx, t - 0.2, 0.34, 500, 3600, 0.12, rnd, { shape: 'rise', pan0: k ? 0.4 : -0.4, pan1: 0 });
    pop(B.fx, t + 0.02, 0.3, { pan: k ? 0.2 : -0.2 });
  });
  M.checks.forEach((t, k) => {
    const pan = k ? 0.2 : -0.2;
    click(B.fx, t, 0.36, { f: 2600, pan });
    bell(B.fx, t + 0.01, P(10 + k), 0.16, { decay: 0.5, len: 1.0, pan });
  });
  sweep(B.fx, M.pan - 0.05, 0.5, 600, 3400, 0.12, rnd, { pan0: -0.6, pan1: 0.6 });                    // on to "We're here"

  // ---- 3. coming soon (8–14 s) ----
  reverseCymbal(B.fx, M.drop2, 0.9, 0.3, rnd);
  impact(B.fx, M.drop2, 0.95, rnd); crash(B.drums, M.drop2, 0.3, rnd);
  pop(B.fx, M.drop2 + 0.02, 0.32, { up: 0, pan: 0.1 }); bell(B.fx, M.drop2 + 0.05, 97, 0.12, { decay: 0.5, len: 1.0, pan: 0.1 });   // the pin, its ping
  blip(B.fx, M.soonHead, 85, 0.14, { pan: 0.2 });                                                     // "Coming soon"
  M.soonCards.forEach((t, k) => {
    sweep(B.fx, t - 0.2, 0.34, 500, 3600, 0.11, rnd, { shape: 'rise', pan0: 0.5, pan1: 0 });
    pop(B.fx, t + 0.02, 0.28, { pan: 0.2 - k * 0.2 });
  });
  pop(B.fx, M.fine, 0.18, { pan: -0.6 });                                                             // the safety pill
  M.chips.forEach((t, k) => { const pan = -0.2 + k * 0.2; pop(B.fx, t, 0.2, { pan }); pluck(B.arp, t, P(8 + k), 0.13, { pan }); });
  // COMING SOON, stamped on each: a thud and a crack each, the last with a crash
  M.stamps.forEach((t, k) => {
    impact(B.fx, t, [0.5, 0.55, 0.65][k], rnd, { tail: 0.45 });
    snare(B.drums, t, 0.38 + 0.05 * k, rnd, [-0.3, 0, 0.3][k]);
  });
  crash(B.drums, M.stamps[2], 0.24, rnd, 1.6);
  sweep(B.fx, M.pan2 - 0.05, 0.5, 600, 3400, 0.12, rnd, { pan0: -0.6, pan1: 0.6 });                   // on to the last stop

  // ---- 4. the locked one (14–18 s) ----
  impact(B.fx, M.lock, 0.85, rnd, { tail: 1.4 }); crash(B.drums, M.lock, 0.2, rnd, 1.8);
  whomp(B.fx, M.lock + 0.02, 0.22, { f0: 700, f1: 70, dur: 0.9 });                                   // the lights go down
  pop(B.fx, M.adult, 0.3, { up: 0, pan: 0.2 }); blip(B.fx, M.adult + 0.01, 64, 0.14, { pan: 0.2 });    // "18+"
  // its "???" scrambling, then settling: a stutter at its start, its middle and its end
  const [s0, s1] = M.scramble;
  for (const t of [s0 + 0.05, (s0 + s1) / 2, s1]) glitch(B.fx, t, 0.24, rnd);
  // the lock rattles (in her pause: "and one more… that's a secret")
  [0, 0.045, 0.085, 0.13, 0.19, 0.26].forEach((d, k) => click(B.fx, M.lockShake + d, 0.26 - k * 0.025, { f: [2100, 2700, 1800, 2500, 2000, 2300][k], pan: k % 2 ? 0.3 : 0.1 }));
  // the whole road at once, each stop lighting up in turn (the locked one low), and the meter
  sweep(B.fx, M.zoomOut - 0.25, 0.75, 300, 4200, 0.15, rnd, { shape: 'rise', pan0: -0.5, pan1: 0.5 });
  M.pulses.forEach((t, k) => {
    const pan = -0.6 + k * 0.24;
    if (k < 5) bell(B.fx, t, P(5 + k), 0.1 + 0.01 * k, { decay: 0.45, len: 0.9, pan });
    else { blip(B.fx, t, LOCKED, 0.14, { pan, len: 0.1 }); click(B.fx, t, 0.16, { f: 1500, pan }); }
  });
  pop(B.fx, M.meter, 0.32); bell(B.fx, M.meter + 0.02, 93, 0.12, { decay: 0.6 }); bell(B.fx, M.meter + 0.1, 100, 0.1, { decay: 0.6 });
  riser(B.fx, M.zoomOut, M.breath3, 0.38, rnd);
  sweep(B.fx, M.breath3 - 0.32, 0.32, 400, 5000, 0.14, rnd, { shape: 'rise' });                       // the end card rises over the road

  // ---- 5. the end (18–21.5 s): one big chord (A), ringing out, the hook on bells, her bubble, two last hits ----
  reverseCymbal(B.fx, M.end, 0.9, 0.28, rnd);
  impact(B.fx, M.end, 1.0, rnd, { tail: 2 }); crash(B.drums, M.end, 0.34, rnd, 3);
  supersaw(B.chords, M.end, [45, 52, 57, 61, 64, 69, 71], 2.6, 0.72, rnd, { cutoff: 3600, release: 1.0, voices: 5 });
  bass(B.bass, M.end, A9.root, 2.4, 0.5, { cutoff: 220 });
  [61, 64, 69, 73].forEach((m, k) => epiano(B.keys, M.end + k * 0.04, m, 2.2, 0.26, { pan: k * 0.25 - 0.4 }));
  sparkle(B.fx, M.end + 0.2, 0.12, [93, 97, 100, 105]);
  for (const [k, , m] of HOOK[2]) bell(B.keys, tb(9, k), m + 12, 0.09, { pan: 0.25, decay: 0.6, len: 1.2 });
  pop(B.fx, M.url, 0.34, { pan: 0.4 }); blip(B.fx, M.url + 0.04, 93, 0.14, { pan: 0.4 });            // agi1.app/roadmap
  pop(B.fx, M.handle, 0.28, { pan: 0.4 });                                                            // Follow @agi1dotapp
  blip(B.fx, M.fineEnd, 88, 0.08, { pan: 0.3 });                                                      // the fine print
  pop(B.fx, M.say, 0.3, { pan: -0.4 }); sparkle(B.fx, M.say + 0.04, 0.09, [97, 100]);                 // her bubble
  pad(B.pad, M.end + 1.2, [52, 57, 61, 64, 71], TOTAL - M.end - 1.6, 0.4, rnd, 1200);
  M.lastHits.forEach((t, k) => {
    kick(B.fx, t, 0.5 + 0.15 * k);
    impact(B.fx, t, 0.45 + 0.15 * k, rnd, { tail: 0.6 });
    bell(B.keys, t, [88, 93][k], 0.22, { decay: 0.8, len: 1.8 });
    bell(B.keys, t, [76, 81][k], 0.14, { decay: 0.9, len: 1.8 });
  });
  crash(B.drums, M.lastHits[1], 0.16, rnd, 2);
  return kicks;
}

// the dry run: every sound and when it happens (nothing is synthesized: fast) → [{ name, t, … }], sorted by time
export function musicPlan() {
  REC = [];
  const B = new Proxy({}, { get: () => ({}) });
  try { compose(B, seeded(20261014)); return REC.sort((a, b) => a.t - b.t); } finally { REC = null; }
}

// the breaths before the drops, the lock and the end chord: a moment of silence, the hit lands harder (nothing starts in
// one: tests/roadmap-promo.test.js)
export const BREATHS = [[M.breath, M.drop], [M.breath2, M.drop2], [M.breathLock, M.lock], [M.breath3, M.end]];
function inBreath(t) { return BREATHS.some(([a, b]) => t > a + 0.005 && t < b - 0.001); }

export function renderMusic({ stems = false } = {}) {
  const rnd = seeded(20261014);
  const B = { drums: bus(), bass: bus(), chords: bus(), pad: bus(), lead: bus(), keys: bus(), arp: bus(), fx: bus() };
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
  const LEVEL = { drums: 0.9, bass: 0.8, chords: 0.52, pad: 0.34, lead: 0.8, keys: 0.66, arp: 0.52, fx: 0.8 };
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
  for (const [a, b] of BREATHS) gap(out, a + 0.01, b - 0.004);
  const hl = biquad('hp', 28), hr = biquad('hp', 28);
  for (let i = 0; i < N; i++) { out.L[i] = run(hl, out.L[i]); out.R[i] = run(hr, out.R[i]); }
  master(out);
  // the end: everything fades with the picture (page/main.js: TOTAL − 0.6 to TOTAL)
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
