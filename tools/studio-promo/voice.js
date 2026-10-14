// AGI Studio's launch video (2026-10-13): AGI-1's voice over its music (the owner: "will it be good if you add voice over
// to the launch video", then "Short, AGI-1's voice (Recommended)": about ten short lines at the big moments, the music
// dipping under her, the words on screen as they were). Her lines are takes of her own voice (the site's Despina voice,
// made with the owner's account and downloaded into the owner's Downloads), made ready once by media.mjs (readyLine) and
// mixed with the music by make.mjs (mixVoice). Pure: no ffmpeg, no browser; the same takes and music always make the
// same soundtrack.
//
//   readWav(buffer) → { rate, channels }        a WAV file's samples (8, 16, 24 or 32-bit, or float)
//   wav16(channels, rate) → a 16-bit WAV file    (16-bit samples read back exactly as they were written)
//   resample(x, from, to) → x at another rate    (a windowed sinc)
//   readyLine(take) → her line, ready: 48 kHz, trimmed around its words, a long pause shortened, its loudness set,
//                     and where its words start and how long they last
//   loudness(channels) → in LUFS (ITU-R BS.1770-4: K-weighting, 400 ms blocks, gated), at 48 kHz
//   planDucks(lines, { hits, breaths }) → when the music dips for each line, and anything wrong with where it is
//   mixVoice(music, lines, { hits, breaths }) → the soundtrack; wherever she isn't, the music exactly as it was
export const RATE = 48000;
// 16-bit full scale, as music.js writes it (× 32767): read and written the same way, a sample comes back exactly
export const S16 = 32767;

// her lines, made ready
export const LINE = {
  floor: -45,        // a 10 ms frame louder than this (dBFS) has her voice in it
  minRun: 0.05,      // her first and last words: at least 50 ms of voice (a click or a breath isn't a word)
  soft: 12,          // a soft first or last sound ("sh", "j", a "t" let go): 12 dB over the take's own quiet…
  softGap: 0.04,     // …with gaps of 40 ms at most…
  softMax: 0.2,      // …and at most 0.2 s before her first word or after her last
  pre: 0.15,         // kept before her first sound…
  post: 0.2,         // …and after her last
  pause: 0.12,       // a quiet stretch this long between her words is a pause,
  maxPause: 0.3,     // and one longer than this is made this long (its middle taken out)
  splice: 0.02,      // the crossfade where a pause is shortened
  fadeIn: 0.02, fadeOut: 0.06,
  hp: 90,            // her lowest rumble out
  lufs: -14,         // each line's loudness, as it plays from both speakers (the music is about -13 LUFS: dipped under her,
                     // the soundtrack stays as loud as the music)
  peak: -2,          // her loudest moments held under this (dBFS), so the mix's limiter has less to do
};
// the music dipping under her
export const DUCK = {
  margin: 8,         // the music this far under her, in loudness (LU), over her words
  min: 8, max: 12,   // dB
  split: [180, 6000],
  lows: 0.5,         // the lows (under 180 Hz) dip half as much, in dB: the kick and the bass carry on
  highs: 0.7,        // the highs (over 6 kHz) a little less: the hats' shimmer stays
  attack: [0.2, 0.04],   // the dip: from 0.2 s before her first word to 0.04 s before it
  hold: 0.06,        // kept after her last word…
  release: 0.5,      // …then back up (a half cosine, in dB)
  minRamp: 0.05,     // a dip or a rise never quicker than this
  hitGap: 0.06,      // a hit of the music (its impacts and crashes) gets through at full level: never dipped in its first 60 ms
  ceiling: 0.86,     // a limiter where she is, a little under the music's own ceiling (music.js: 0.89): her voice's peaks
                     // between samples rise higher than the music's, and the soundtrack keeps a true peak under -1 dBTP
};

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const dB = (ms) => 10 * Math.log10(ms + 1e-20);

// ---------- WAV files ----------
export function readWav(buf) {
  if (buf.length < 12 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') throw new Error('not a WAV file');
  let fmt = null, data = null;
  for (let p = 12; p + 8 <= buf.length;) {
    const id = buf.toString('ascii', p, p + 4), size = buf.readUInt32LE(p + 4), body = p + 8;
    if (id === 'fmt ') {
      fmt = { format: buf.readUInt16LE(body), channels: buf.readUInt16LE(body + 2), rate: buf.readUInt32LE(body + 4), bits: buf.readUInt16LE(body + 14) };
      if (fmt.format === 0xfffe && size >= 26) fmt.format = buf.readUInt16LE(body + 24);   // WAVE_FORMAT_EXTENSIBLE: its own format
    } else if (id === 'data') data = [body, Math.min(size, buf.length - body)];
    p = body + size + (size & 1);
  }
  if (!fmt || !data) throw new Error('a WAV file without its format or its samples');
  const { format, channels: nc, bits } = fmt;
  const bytes = bits / 8, frame = bytes * nc, n = Math.floor(data[1] / frame);
  const read = format === 1 && bits === 16 ? (o) => buf.readInt16LE(o) / S16
    : format === 1 && bits === 24 ? (o) => buf.readIntLE(o, 3) / 8388607
    : format === 1 && bits === 32 ? (o) => buf.readInt32LE(o) / 2147483647
    : format === 1 && bits === 8 ? (o) => (buf[o] - 128) / 127
    : format === 3 && bits === 32 ? (o) => buf.readFloatLE(o)
    : format === 3 && bits === 64 ? (o) => buf.readDoubleLE(o)
    : null;
  if (!read || !nc) throw new Error(`a WAV file this can't read (format ${format}, ${bits}-bit)`);
  const channels = Array.from({ length: nc }, () => new Float32Array(n));
  for (let i = 0; i < n; i++) for (let c = 0; c < nc; c++) channels[c][i] = read(data[0] + i * frame + c * bytes);
  return { rate: fmt.rate, channels };
}

export function wav16(channels, rate = RATE) {
  const nc = channels.length, n = channels[0].length;
  const buf = Buffer.alloc(44 + n * nc * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * nc * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(nc, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * nc * 2, 28); buf.writeUInt16LE(nc * 2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * nc * 2, 40);
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < nc; c++) buf.writeInt16LE(Math.round(clamp(channels[c][i], -1, 1) * S16), 44 + (i * nc + c) * 2);
  }
  return buf;
}

// ---------- filters (RBJ's cookbook biquads), run in place or one sample at a time ----------
export function biquad(type, f, q = Math.SQRT1_2, rate = RATE) {
  const w = (2 * Math.PI * Math.min(f, rate * 0.45)) / rate, c = Math.cos(w), al = Math.sin(w) / (2 * q);
  const b = type === 'lp' ? [(1 - c) / 2, 1 - c, (1 - c) / 2] : [(1 + c) / 2, -(1 + c), (1 + c) / 2];
  const a0 = 1 + al;
  return { b0: b[0] / a0, b1: b[1] / a0, b2: b[2] / a0, a1: (-2 * c) / a0, a2: (1 - al) / a0, x1: 0, x2: 0, y1: 0, y2: 0 };
}
export function step(f, x) {
  const y = f.b0 * x + f.b1 * f.x1 + f.b2 * f.x2 - f.a1 * f.y1 - f.a2 * f.y2;
  f.x2 = f.x1; f.x1 = x; f.y2 = f.y1; f.y1 = y;
  return y;
}
const filter = (x, ...fs) => { const y = Float64Array.from(x); for (const f of fs) for (let i = 0; i < y.length; i++) y[i] = step(f, y[i]); return y; };

// ---------- another rate: a sinc, its window Kaiser's (β 9), 32 zero crossings each side ----------
function i0(x) { let s = 1, t = 1; for (let k = 1; k < 60; k++) { t *= (x / (2 * k)) ** 2; s += t; if (t < 1e-14 * s) break; } return s; }
const KAISER = (() => {
  const n = 4096, beta = 9, w = new Float64Array(n + 2), ib = i0(beta);
  for (let k = 0; k <= n; k++) w[k] = i0(beta * Math.sqrt(1 - (k / n) ** 2)) / ib;
  return { n, w };
})();
export function resample(x, from, to, { zeros = 32 } = {}) {
  if (from === to) return Float32Array.from(x);
  const stepIn = from / to;                         // input samples an output sample moves on
  const fc = Math.min(1, to / from) * 0.94;         // the cutoff, as a share of the input's Nyquist frequency
  const half = Math.ceil(zeros / fc);               // the kernel's half-width, in input samples
  const n = Math.floor(x.length / stepIn);
  const y = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const p = k * stepIn, c = Math.floor(p);
    let s = 0;
    for (let j = Math.max(0, c - half + 1); j <= Math.min(x.length - 1, c + half); j++) {
      const u = p - j, r = Math.abs(u) / half;
      if (r >= 1) continue;
      const a = Math.PI * fc * u;
      const wf = r * KAISER.n, wi = Math.floor(wf);
      const win = KAISER.w[wi] + (KAISER.w[wi + 1] - KAISER.w[wi]) * (wf - wi);
      s += x[j] * fc * (a === 0 ? 1 : Math.sin(a) / a) * win;
    }
    y[k] = s;
  }
  return y;
}

// ---------- loudness (ITU-R BS.1770-4) ----------
// K-weighting at 48 kHz: the head's high shelf, then the RLB high-pass (the standard's own coefficients)
const K1 = { b: [1.53512485958697, -2.69169618940638, 1.19839281085285], a: [-1.69065929318241, 0.73248077421585] };
const K2 = { b: [1, -2, 1], a: [-1.99004745483398, 0.99007225036621] };
function kWeight(x) {
  const y = new Float64Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0, u1 = 0, u2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i];
    const s = K1.b[0] * v + K1.b[1] * x1 + K1.b[2] * x2 - K1.a[0] * y1 - K1.a[1] * y2;
    x2 = x1; x1 = v; y2 = y1; y1 = s;
    const o = K2.b[0] * s + K2.b[1] * u1 + K2.b[2] * u2 - K2.a[0] * (y[i - 1] ?? 0) - K2.a[1] * (y[i - 2] ?? 0);
    u2 = u1; u1 = s; y[i] = o;
  }
  return y;
}
// → its integrated loudness (LUFS), or -Infinity for silence. A signal shorter than a block is one block.
export function loudness(channels, rate = RATE) {
  if (rate !== RATE) throw new Error('loudness: 48 kHz only');
  const n = channels[0].length;
  const P = new Float64Array(n + 1);                 // the K-weighted energy so far, all channels together
  const z = channels.map(kWeight);
  for (let i = 0; i < n; i++) { let s = 0; for (const c of z) s += c[i] * c[i]; P[i + 1] = P[i] + s; }
  const block = Math.min(n, Math.round(0.4 * rate)), hop = Math.round(0.1 * rate);
  const e = [];
  for (let a = 0; a + block <= n; a += hop) e.push((P[a + block] - P[a]) / block);
  const L = (m) => -0.691 + dB(m);
  const mean = (xs) => xs.reduce((s, v) => s + v, 0) / xs.length;
  const abs = e.filter((m) => L(m) > -70);
  if (!abs.length) return -Infinity;
  const rel = L(mean(abs)) - 10;
  return L(mean(abs.filter((m) => L(m) > rel)));
}

// ---------- her line, made ready ----------
// take: a WAV file (any rate; two channels are averaged) → { pcm (48 kHz), onset (s: where her first word starts in it),
// len (s: how long her words last), lufs, gain (dB), peak (dBFS), pauses: [{ at (s, in pcm), was (s), now (s) }] }
export function readyLine(take, o = {}) {
  const c = { ...LINE, ...o };
  const { rate, channels } = readWav(take);
  let x = channels[0];
  if (channels.length > 1) x = Float32Array.from(x, (_, i) => channels.reduce((s, ch) => s + ch[i], 0) / channels.length);
  x = resample(x, rate, RATE);
  x = Float32Array.from(filter(x, biquad('hp', c.hp), biquad('hp', c.hp)));
  // where her voice is: 10 ms frames over the floor
  const fr = Math.round(0.01 * RATE), nf = Math.floor(x.length / fr);
  const lv = new Float64Array(nf), on = new Uint8Array(nf);
  for (let f = 0; f < nf; f++) {
    let s = 0;
    for (let i = f * fr; i < (f + 1) * fr; i++) s += x[i] * x[i];
    lv[f] = dB(s / fr);
    on[f] = lv[f] > c.floor ? 1 : 0;
  }
  const runs = [];
  for (let f = 0; f < nf; f++) if (on[f]) { const a = f; while (f < nf && on[f]) f++; runs.push([a, f]); }
  const words = runs.filter(([a, b]) => (b - a) * 0.01 >= c.minRun - 1e-9);
  if (!words.length) throw new Error('no voice in this take');
  const w0 = words[0][0], w1 = words.at(-1)[1];
  // a soft first or last sound ("sh", a "t" let go) sits under the floor: from her first word back, and from her last
  // forward, over frames `soft` dB above the take's own quiet (its 10th-percentile frame), gaps of `softGap` at most
  const quiet = Float64Array.from(lv).sort()[Math.floor(0.1 * (nf - 1))];
  const soft = clamp(quiet + c.soft, c.floor - 25, c.floor);
  const most = Math.round(c.softMax / 0.01), gapMax = Math.round(c.softGap / 0.01);
  let f0 = w0;
  for (let f = w0 - 1, gap = 0; f >= 0 && w0 - f <= most; f--) {
    if (lv[f] > soft) { f0 = f; gap = 0; } else if (++gap > gapMax) break;
  }
  let f1 = w1;
  for (let f = w1, gap = 0; f < nf && f - w1 < most; f++) {
    if (lv[f] > soft) { f1 = f + 1; gap = 0; } else if (++gap > gapMax) break;
  }
  const first = f0 * fr, last = f1 * fr;
  // its pauses: quiet stretches between her words (from her first word to her last)
  const inside = runs.filter(([a, b]) => a >= w0 && b <= w1);
  const pauses = [];
  for (let k = 1; k < inside.length; k++) {
    const a = inside[k - 1][1] * fr, b = inside[k][0] * fr;
    if (b - a >= Math.round(c.pause * RATE)) pauses.push([a, b]);
  }
  // its piece: `pre` before her first word to `post` after her last; a long pause made `maxPause` long (its middle out,
  // crossfaded over `splice`)
  const s0 = Math.max(0, first - Math.round(c.pre * RATE)), s1 = Math.min(x.length, last + Math.round(c.post * RATE));
  const keep = Math.round((c.maxPause / 2) * RATE), X = Math.round(c.splice * RATE);
  const pieces = [];
  let from = s0;
  const done = [];
  for (const [a, b] of pauses) {
    if (b - a <= 2 * keep) continue;
    pieces.push([from, a + keep + X / 2]);
    from = b - keep - X / 2;
    done.push({ a, was: (b - a) / RATE });
  }
  pieces.push([from, s1]);
  const len0 = pieces.reduce((s, [a, b]) => s + (b - a), 0) - X * (pieces.length - 1);
  const pcm = new Float32Array(len0);
  let w = 0;
  pieces.forEach(([a, b], k) => {
    const n = b - a;
    for (let i = 0; i < n; i++) {
      let v = x[a + i];
      if (k > 0 && i < X) v *= (1 - Math.cos((Math.PI * (i + 0.5)) / X)) / 2;                // fading in, over the end of the piece before
      if (k < pieces.length - 1 && i >= n - X) v *= (1 + Math.cos((Math.PI * (i - (n - X) + 0.5)) / X)) / 2;   // fading out
      pcm[w + i] += v;
    }
    w += n - X;
  });
  const removed = pieces.slice(0, -1).reduce((s, [, b], k) => s + (pieces[k + 1][0] - b) + X, 0);
  // where its pauses are now, in the piece
  let cut = 0;
  const shortened = done.map((p) => { const at = (p.a - s0 - cut) / RATE; cut += Math.round(p.was * RATE) - 2 * keep; return { at: +at.toFixed(3), was: +p.was.toFixed(3), now: c.maxPause }; });
  // gentle fades at its ends
  const fi = Math.round(c.fadeIn * RATE), fo = Math.round(c.fadeOut * RATE);
  for (let i = 0; i < fi && i < pcm.length; i++) pcm[i] *= (1 - Math.cos((Math.PI * i) / fi)) / 2;
  for (let i = 0; i < fo && i < pcm.length; i++) pcm[pcm.length - 1 - i] *= (1 - Math.cos((Math.PI * i) / fo)) / 2;
  // its loudness, as it plays from both speakers; her loudest moments held under `peak` (each time the limiter takes a
  // little off, its loudness is set again, until it's within 0.05 dB: a few rounds at most)
  const scale = (db) => { const g = 10 ** (db / 20); for (let i = 0; i < pcm.length; i++) pcm[i] *= g; };
  let gain = c.lufs - loudness([pcm, pcm]);
  scale(gain);
  if (c.peak != null) {
    const ceiling = 10 ** (c.peak / 20);
    for (let round = 0; round < 6; round++) {
      limit([pcm], ceiling, VOICE_LIMIT);
      const more = c.lufs - loudness([pcm, pcm]);
      if (Math.abs(more) < 0.05) break;
      scale(more);
      gain += more;
    }
    limit([pcm], ceiling, VOICE_LIMIT);
  }
  let peak = 0;
  for (let i = 0; i < pcm.length; i++) peak = Math.max(peak, Math.abs(pcm[i]));
  const onset = (first - s0) / RATE;
  const len = (last - first - removed) / RATE;
  return {
    pcm, rate: RATE, onset: +onset.toFixed(4), len: +len.toFixed(4), lufs: +loudness([pcm, pcm]).toFixed(2),
    gain: +gain.toFixed(2), peak: +(20 * Math.log10(peak)).toFixed(2), pauses: shortened,
    soft: [+((w0 - f0) * 0.01).toFixed(2), +((f1 - w1) * 0.01).toFixed(2)], from: +(first / RATE).toFixed(3),
  };
}
// her own limiter: quicker than the mix's (2 ms down, 50 ms back up)
const VOICE_LIMIT = { look: 0.002, release: 0.05 };

// ---------- the music dipping under her ----------
// lines: [{ id, at (s: her first word), len (s: her words), over: [s] (the music's hits she's meant to speak over) }]
// → [{ id, at, end, a0, a1 (the dip), r0, r1 (back up), problems: [words] }], in time order. A hit (the music's impacts and
// crashes) always gets through at full level: the dip starts after it, and lifts before it; a breath (a moment of silence
// before a drop) is never under her words, and the music is back up by its silence. Anything that can't be is a problem.
export function planDucks(lines, o = {}) {
  const c = { ...DUCK, ...o };
  const hits = [...(o.hits || [])].sort((a, b) => a - b), breaths = o.breaths || [];
  const sorted = [...lines].sort((a, b) => a.at - b.at);
  return sorted.map((l, k) => {
    const s = l.at, e = l.at + l.len, over = l.over || [];
    const problems = [];
    const free = hits.filter((h) => !over.some((x) => Math.abs(x - h) < 1e-6));
    // the dip, after any hit just before her first word
    const a1 = s - c.attack[1];
    let a0 = s - c.attack[0];
    for (const h of free) if (h < a1 && h + c.hitGap > a0) a0 = h + c.hitGap;
    if (a1 - a0 < c.minRamp - 1e-9) problems.push(`a hit too close before her first word (${a0.toFixed(2)})`);
    // back up after her last word, by the next hit or breath at the latest
    let r1 = e + c.hold + c.release;
    for (const h of free) if (h >= e && h - 0.01 < r1) r1 = h - 0.01;
    for (const [b0] of breaths) if (b0 >= e && b0 + 0.01 < r1) r1 = b0 + 0.01;
    const r0 = Math.max(e, Math.min(e + c.hold, r1 - c.minRamp));
    if (r1 - r0 < c.minRamp - 1e-9) problems.push(`a hit or a breath too close after her last word (${r1.toFixed(2)})`);
    // nothing under her words but the hits she's meant to speak over
    for (const h of free) if (h > a0 && h < r1 && !(h >= e && h - 0.01 <= r1 + 1e-9)) problems.push(`a hit under her words (${h})`);
    for (const [b0, b1] of breaths) if (b0 < e && b1 > a0) problems.push(`her words in a breath (${b0})`);
    for (const x of over) if (!(x > s && x < e)) problems.push(`a hit she speaks over isn't under her words (${x})`);
    if (k && sorted[k - 1].at + sorted[k - 1].len + 0.1 > s) problems.push(`too close after "${sorted[k - 1].id}"`);
    return { id: l.id, at: s, end: e, a0, a1, r0, r1, problems };
  });
}

// a sample's limiter: never over `ceiling` (or over `keep`'s own level at that sample, where that's higher: what's kept as
// it was is never limited). Down along a straight line over the `look` before a peak (to exactly what it needs), back up
// with a `release` time constant (reaching exactly 1: it aims a little above and stops at 1), the same gain on every
// channel. In place.
function limit(chs, ceiling, { look: lookS = 0.004, release = 0.08, keep = null } = {}) {
  const n = chs[0].length, look = Math.max(1, Math.round(lookS * RATE)), rel = Math.exp(-1 / (release * RATE));
  const want = new Float32Array(n).fill(1);
  let over = 0;
  for (let j = 0; j < n; j++) {
    let p = 0;
    for (const ch of chs) { const a = Math.abs(ch[j]); if (a > p) p = a; }
    let cap = ceiling;
    if (keep) for (const ch of keep) { const a = Math.abs(ch[j]); if (a > cap) cap = a; }
    if (p <= cap) continue;
    over++;
    const need = cap / p;
    for (let i = Math.max(0, j - look); i <= j; i++) want[i] = Math.min(want[i], need + ((1 - need) * (j - i)) / look);
  }
  let g = 1, under = 0, min = 1;
  for (let i = 0; i < n; i++) {
    const up = g === 1 ? 1 : Math.min(1, 1.001 - (1.001 - g) * rel);
    g = Math.min(want[i], up);
    if (g < 1) { for (const ch of chs) ch[i] *= g; under++; if (g < min) min = g; }
  }
  return { over, under, min: +(20 * Math.log10(min)).toFixed(2) };
}

// music: { L, R } (48 kHz) · lines: [{ id, at, len, onset, pcm (48 kHz, mono), over, duck? (dB: its own dip) }] (readyLine's,
// and where it goes)
// → { L, R, report: [{ id, at, end, a0, a1, r0, r1, duck (dB), music and her (LUFS over her words, the music as it was) }],
// limiter, changed (samples not the music's) }
export function mixVoice(music, lines, o = {}) {
  const c = { ...DUCK, ...o };
  const N = music.L.length;
  const plan = planDucks(lines.map(({ id, at, len, over }) => ({ id, at, len, over })), o);
  const bad = plan.filter((p) => p.problems.length);
  if (bad.length && !o.anyway) throw new Error(`her lines don't fit: ${bad.map((p) => `${p.id}: ${p.problems.join('; ')}`).join(' · ')}`);
  const ids = new Set(lines.map((l) => l.id));
  if (ids.size !== lines.length) throw new Error('two of her lines have the same id');
  // her voice, where it goes (one voice, from both speakers), only from its dip's start to the music back up: the quiet
  // of a take before her first sound or after her last never reaches the music's hits (faded over 10 ms where it's cut)
  const v = new Float32Array(N), F = Math.round(0.01 * RATE);
  for (const l of lines) {
    const p = plan.find((x) => x.id === l.id);
    const p0 = Math.round((l.at - l.onset) * RATE), p1 = p0 + l.pcm.length;
    const w0 = Math.max(p0, Math.ceil(p.a0 * RATE), 0), w1 = Math.min(p1, Math.floor(p.r1 * RATE), N);
    for (let j = w0; j < w1; j++) {
      let s = l.pcm[j - p0];
      if (w0 > p0 && j - w0 < F) s *= (1 - Math.cos((Math.PI * (j - w0 + 0.5)) / F)) / 2;
      if (w1 < p1 && w1 - 1 - j < F) s *= (1 - Math.cos((Math.PI * (w1 - j - 0.5)) / F)) / 2;
      v[j] += s;
    }
  }
  // how far the music dips for each line: as loud as she is over her words, less `margin` (in LUFS: the music's loudness
  // there, as it was, and hers), at least `min` and at most `max`
  const report = plan.map((p) => {
    const a = Math.max(0, Math.round(p.at * RATE)), e = Math.min(N, Math.round(p.end * RATE));
    const m = loudness([music.L.subarray(a, e), music.R.subarray(a, e)]), her = loudness([v.subarray(a, e), v.subarray(a, e)]);
    const line = lines.find((l) => l.id === p.id);
    const duck = line.duck != null ? line.duck : Number.isFinite(m) ? clamp(m - her + c.margin, c.min, c.max) : c.min;
    return { ...p, duck: +duck.toFixed(2), music: +m.toFixed(2), her: +her.toFixed(2) };
  });
  // the dip: each line's own (a half cosine down and up, in dB), the deepest where two meet
  const g = new Float64Array(N).fill(1);
  for (const r of report) {
    const i0 = Math.max(0, Math.floor(r.a0 * RATE)), i1 = Math.min(N, Math.ceil(r.r1 * RATE));
    for (let i = i0; i < i1; i++) {
      const t = i / RATE;
      const w = t <= r.a0 ? 0 : t < r.a1 ? (1 - Math.cos((Math.PI * (t - r.a0)) / (r.a1 - r.a0))) / 2
        : t <= r.r0 ? 1 : t < r.r1 ? (1 + Math.cos((Math.PI * (t - r.r0)) / (r.r1 - r.r0))) / 2 : 0;
      if (w <= 0) continue;
      const gi = 10 ** ((-r.duck * w) / 20);
      if (gi < g[i]) g[i] = gi;
    }
  }
  // the music in three bands: its lows (under split[0]) dipping `lows` as much in dB, its highs (over split[1]) `highs`
  // as much, the middle (her voice's band) in full; and her voice on top. Where nothing dips, the music exactly as it was (the bands are taken
  // from the whole, so their gains at 1 add back up to it)
  const fl = [biquad('lp', c.split[0]), biquad('lp', c.split[0])], fh = [biquad('hp', c.split[1]), biquad('hp', c.split[1])];
  const L = new Float32Array(N), R = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const x = music.L[i], y = music.R[i];
    const lx = step(fl[0], x), ly = step(fl[1], y), hx = step(fh[0], x), hy = step(fh[1], y);
    const gm = g[i];
    if (gm === 1 && v[i] === 0) { L[i] = x; R[i] = y; continue; }
    const gl = gm ** c.lows, gh = gm ** c.highs;
    L[i] = gm * x + (gl - gm) * lx + (gh - gm) * hx + v[i];
    R[i] = gm * y + (gl - gm) * ly + (gh - gm) * hy + v[i];
  }
  // a limiter where she is: never over the ceiling, unless the music itself is (it's never touched for that)
  const limiter = limit([L, R], c.ceiling, { keep: [music.L, music.R] });
  let changed = 0;
  for (let i = 0; i < N; i++) if (L[i] !== music.L[i] || R[i] !== music.R[i]) changed++;
  return { L, R, report, limiter, changed };
}

// the music's hits (its impacts and crashes), from music.js's plan: the dips leave them alone
export const hitsOf = (plan) => [...new Set(plan.filter((e) => e.name === 'impact' || e.name === 'crash').map((e) => e.t))].sort((a, b) => a - b);
