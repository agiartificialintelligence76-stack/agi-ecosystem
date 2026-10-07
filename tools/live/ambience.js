// AGI-1's live show (2026-10-07, the owner: "background sounds can also be changed based on the event on whats happening"):
// the sounds around her, made in code like her music (no samples, no service, nobody else's sounds): where she is (a city,
// waves, birds, a café, wind, space), the weather (rain, wind), on the way (an engine, a train, a plane, a rocket), and short
// sounds on their own (thunder, a whoosh between places, a pop, a bite's crunch, a ding). Loops of a few seconds, made once
// when first needed (a fraction of a second each), at the stream's rate (48 kHz), mono (the mixer reads the right channel
// half a loop later: a little width for nothing). The same seed, the same sound. Pure.
export const RATE = 48000;

// ---------- tools ----------
function noise(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}
// a biquad filter (RBJ's cookbook): type 'lp' | 'hp' | 'bp', its frequency (Hz) and Q
function biquad(type, f, q = 0.707, rate = RATE) {
  const w = (2 * Math.PI * Math.min(f, rate * 0.45)) / rate, c = Math.cos(w), s = Math.sin(w), al = s / (2 * q);
  let b0, b1, b2;
  if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; }
  else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; }
  else { b0 = al; b1 = 0; b2 = -al; }
  const a0 = 1 + al, a1 = -2 * c, a2 = 1 - al;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const k = [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
  return (x) => { const y = k[0] * x + k[1] * x1 + k[2] * x2 - k[3] * y1 - k[4] * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
}
const len = (s) => Math.round(s * RATE);
// a loop's ends crossfaded (its last half second into its start), so it plays round without a click
function seamless(buf, fadeS = 0.5) {
  const f = Math.min(len(fadeS), Math.floor(buf.length / 3)), n = buf.length - f, out = new Float32Array(n);
  out.set(buf.subarray(0, n));
  for (let i = 0; i < f; i++) { const k = i / f; out[i] = buf[n + i] * (1 - k) + buf[i] * k; }
  return out;
}
// to a level (its loudest bit at `peak`)
function level(buf, peak = 0.5) {
  let m = 0;
  for (const x of buf) m = Math.max(m, Math.abs(x));
  if (m > 0) for (let i = 0; i < buf.length; i++) buf[i] *= peak / m;
  return buf;
}
// a short sine "ping" (a cup's clink, a bird's chirp, a gull, a horn) added into buf at sample i
function tone(buf, i, { f0, f1 = f0, seconds = 0.1, amp = 0.3, attack = 0.005, vib = 0, vibHz = 0 }) {
  const n = len(seconds);
  let ph = 0;
  for (let k = 0; k < n && i + k < buf.length; k++) {
    const t = k / n, f = f0 + (f1 - f0) * t + vib * Math.sin(2 * Math.PI * vibHz * (k / RATE));
    ph += (2 * Math.PI * f) / RATE;
    const env = Math.min(1, k / len(attack)) * (1 - t) ** 2;
    buf[i + k] += Math.sin(ph) * env * amp;
  }
}

// ---------- the loops ----------
const LOOPS = {
  // rain: a hiss of drops (bright noise), a soft roar under it, and drops landing close by
  rain(seed) {
    const r = noise(seed), n = len(9), out = new Float32Array(n);
    const hp = biquad('bp', 3500, 0.6), lo = biquad('lp', 500);
    for (let i = 0; i < n; i++) out[i] = hp(r()) * 0.5 + lo(r()) * 0.25;
    for (let k = 0; k < 160; k++) { const i = Math.floor(((r() + 1) / 2) * (n - 2000)); const bp = biquad('bp', 1800 + 3000 * Math.abs(r()), 3); for (let j = 0; j < 400; j++) out[i + j] += bp(r()) * (1 - j / 400) ** 3 * 0.9; }
    return seamless(level(out, 0.5));
  },
  // wind: noise through a filter that opens and closes slowly, and comes and goes
  wind(seed) {
    const r = noise(seed), n = len(10), out = new Float32Array(n);
    let f = 400, y = 0;
    for (let i = 0; i < n; i++) {
      const t = i / RATE;
      f = 380 + 260 * Math.sin(t * 0.7) + 140 * Math.sin(t * 1.9 + 1);
      const a = 1 - Math.exp((-2 * Math.PI * f) / RATE);
      y += (r() - y) * a;
      out[i] = y * (0.55 + 0.45 * Math.sin(t * 0.45 + 0.3) ** 2);
    }
    return seamless(level(out, 0.5), 1);
  },
  // waves: a swell that rises and breaks every few seconds
  waves(seed) {
    const r = noise(seed), n = len(12), out = new Float32Array(n);
    const lp = biquad('lp', 900), lp2 = biquad('lp', 2600);
    for (let i = 0; i < n; i++) {
      const t = i / RATE, ph = (t % 6) / 6;
      const swell = ph < 0.7 ? (ph / 0.7) ** 2 : Math.exp(-(ph - 0.7) * 9);
      out[i] = lp(r()) * (0.25 + 0.75 * swell) + lp2(r()) * 0.25 * Math.max(0, swell - 0.6);
    }
    return seamless(level(out, 0.5), 1);
  },
  // a city: its low rumble, cars passing by, now and then a far-away horn
  city(seed) {
    const r = noise(seed), n = len(12), out = new Float32Array(n);
    const rum = biquad('lp', 160), pass = biquad('bp', 700, 0.8);
    for (let i = 0; i < n; i++) {
      const t = i / RATE;
      const car = Math.max(0, Math.sin(t * 0.9)) ** 4 * 0.8 + Math.max(0, Math.sin(t * 1.4 + 2)) ** 6 * 0.6;
      out[i] = rum(r()) * 0.7 + pass(r()) * 0.35 * car;
    }
    for (const at of [2.3, 8.1]) { tone(out, len(at), { f0: 392, seconds: 0.35, amp: 0.05 }); tone(out, len(at), { f0: 494, seconds: 0.35, amp: 0.04 }); }
    return seamless(level(out, 0.45), 1);
  },
  // a café: a murmur of voices (noise shaped like syllables), and now and then a cup's clink
  cafe(seed) {
    const r = noise(seed), n = len(10), out = new Float32Array(n);
    const bp = [biquad('bp', 450, 1.2), biquad('bp', 900, 1.4), biquad('bp', 1500, 1.6)];
    const rates = [4.3, 5.7, 6.9];
    for (let i = 0; i < n; i++) {
      const t = i / RATE;
      let x = 0;
      for (let v = 0; v < 3; v++) x += bp[v](r()) * (0.35 + 0.65 * Math.max(0, Math.sin(t * rates[v] * Math.PI + v * 2 + Math.sin(t * 0.3 * (v + 1)) * 3)));
      out[i] = x * 0.6;
    }
    for (const at of [1.4, 4.9, 7.6]) tone(out, len(at), { f0: 2650, seconds: 0.5, amp: 0.12, attack: 0.001 });
    return seamless(level(out, 0.4), 0.8);
  },
  // birds: little chirps here and there over a soft breeze
  birds(seed) {
    const r = noise(seed), n = len(11), out = new Float32Array(n);
    const lp = biquad('lp', 600);
    for (let i = 0; i < n; i++) out[i] = lp(r()) * 0.12;
    for (let k = 0; k < 26; k++) {
      const at = len(((r() + 1) / 2) * 10), f = 2600 + 2200 * Math.abs(r()), notes = 2 + Math.floor(Math.abs(r()) * 3);
      for (let j = 0; j < notes; j++) tone(out, at + j * len(0.09), { f0: f, f1: f * (r() > 0 ? 1.3 : 0.75), seconds: 0.07, amp: 0.18, attack: 0.004 });
    }
    return seamless(level(out, 0.4));
  },
  // a harbor: waves, and gulls
  harbor(seed) {
    const out = LOOPS.waves(seed).slice();
    const r = noise(seed + 7);
    for (let k = 0; k < 5; k++) tone(out, len(1 + k * 2.1 + Math.abs(r())), { f0: 1500, f1: 1050, seconds: 0.45, amp: 0.09, vib: 40, vibHz: 18 });
    return level(out, 0.45);
  },
  // space: a low hum, slowly beating, and a faint shimmer
  space(seed) {
    const r = noise(seed), n = len(12), out = new Float32Array(n);
    const hi = biquad('bp', 5200, 2);
    for (let i = 0; i < n; i++) {
      const t = i / RATE;
      out[i] = (Math.sin(2 * Math.PI * 55 * t) * 0.5 + Math.sin(2 * Math.PI * 82.5 * t + Math.sin(t * 0.5)) * 0.35) * (0.7 + 0.3 * Math.sin(t * 0.52)) + hi(r()) * 0.06;
    }
    return seamless(level(out, 0.35), 1);
  },
  // on the road: an engine's hum and the road under the wheels
  engine(seed) {
    const r = noise(seed), n = len(8), out = new Float32Array(n);
    const road = biquad('lp', 380), body = biquad('lp', 900);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / RATE, f = 72 + 3 * Math.sin(t * 0.8);
      ph += (2 * Math.PI * f) / RATE;
      const saw = ((ph / (2 * Math.PI)) % 1) * 2 - 1;
      out[i] = body(saw) * 0.35 + road(r()) * 0.6;
    }
    return seamless(level(out, 0.45));
  },
  // a train: a hum and the rails' clickety-clack
  train(seed) {
    const r = noise(seed), n = len(7.2), out = new Float32Array(n);
    const hum = biquad('lp', 260);
    for (let i = 0; i < n; i++) out[i] = hum(r()) * 0.5;
    for (let b = 0; b < 8; b++) for (const d of [0, 0.16]) { const i = len(b * 0.9 + d); const bp = biquad('bp', 900, 1.5); for (let j = 0; j < 1600; j++) out[i + j] += bp(r()) * (1 - j / 1600) ** 4 * 1.4; }
    return level(out, 0.45);
  },
  // a plane: a steady roar and a soft whine
  plane(seed) {
    const r = noise(seed), n = len(8), out = new Float32Array(n);
    const lp = biquad('lp', 700);
    for (let i = 0; i < n; i++) out[i] = lp(r()) * 0.8 + Math.sin((2 * Math.PI * 420 * i) / RATE) * 0.03;
    return seamless(level(out, 0.45));
  },
  // a rocket: a deep rumble with a crackle in it
  rocket(seed) {
    const r = noise(seed), n = len(8), out = new Float32Array(n);
    const lp = biquad('lp', 140), cr = biquad('hp', 2500);
    for (let i = 0; i < n; i++) out[i] = lp(r()) * 1.6 + (r() > 0.995 ? cr(r()) * 0.7 : cr(r() * 0.05));
    return seamless(level(out, 0.5));
  },
};
export const LOOP_IDS = Object.keys(LOOPS);
// how loud each sits under her voice and music (a bed, never in front)
export const LOOP_GAIN = { rain: 0.22, wind: 0.16, waves: 0.2, city: 0.14, cafe: 0.12, birds: 0.13, harbor: 0.18, space: 0.12, engine: 0.14, train: 0.15, plane: 0.15, rocket: 0.2 };

// ---------- short sounds ----------
const SHOTS = {
  // thunder: a crack, then a long rumble
  thunder(seed) {
    const r = noise(seed), n = len(4.2), out = new Float32Array(n);
    const crack = biquad('hp', 1800), rum = biquad('lp', 120), rum2 = biquad('lp', 60);
    for (let i = 0; i < n; i++) {
      const t = i / RATE;
      out[i] = crack(r()) * Math.exp(-t * 30) * 0.8 + (rum(r()) * 2.2 + rum2(r()) * 2) * Math.min(1, t * 6) * Math.exp(-t * 0.9) * (0.75 + 0.25 * Math.sin(t * 9));
    }
    return level(out, 0.6);
  },
  // a whoosh between places (the comic wipe): noise through a band that sweeps up (a state-variable filter: its frequency
  // can change every sample)
  whoosh(seed) {
    const r = noise(seed), n = len(0.8), out = new Float32Array(n);
    let low = 0, band = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n, f = 2 * Math.sin((Math.PI * (300 + 2400 * t)) / RATE);
      const high = r() - low - 0.7 * band;
      band += f * high; low += f * band;
      out[i] = band * Math.sin(Math.PI * t) ** 2;
    }
    return level(out, 0.35);
  },
  // a pop (her outfit's sparkles), a little chime
  pop() {
    const out = new Float32Array(len(0.5));
    for (const [k, f] of [[0, 1047], [0.07, 1319], [0.14, 1568]]) tone(out, len(k), { f0: f, seconds: 0.3, amp: 0.25, attack: 0.002 });
    return level(out, 0.3);
  },
  // a bite: a short crunch
  crunch(seed) {
    const r = noise(seed), out = new Float32Array(len(0.35));
    const bp = biquad('bp', 2200, 0.9);
    for (const at of [0, 0.07, 0.15]) { const i0 = len(at); for (let j = 0; j < len(0.05); j++) out[i0 + j] += bp(r()) * (1 - j / len(0.05)) ** 2; }
    return level(out, 0.28);
  },
  // a ding (her alerts)
  ding() {
    const out = new Float32Array(len(1));
    tone(out, 0, { f0: 1319, seconds: 0.9, amp: 0.3, attack: 0.002 }); tone(out, len(0.11), { f0: 1760, seconds: 0.8, amp: 0.25, attack: 0.002 });
    return level(out, 0.28);
  },
};
export const SHOT_IDS = Object.keys(SHOTS);

// made once, kept for the show
const made = new Map();
export function loop(id, seed = 7) {
  if (!LOOPS[id]) return null;
  const key = `loop:${id}:${seed}`;
  if (!made.has(key)) made.set(key, LOOPS[id](seed));
  return made.get(key);
}
export function shot(id, seed = 11) {
  if (!SHOTS[id]) return null;
  const key = `shot:${id}:${seed}`;
  if (!made.has(key)) made.set(key, SHOTS[id](seed));
  return made.get(key);
}
