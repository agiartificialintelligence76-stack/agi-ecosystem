// OVERCLOCK: the dot-matrix display above the table, as a buffer of dots (pure: no canvas; render.js paints it). 128 × 32
// dots, each 0 (off), 1–4 (amber, dim to bright) or 5–8 (pink, dim to bright). It shows the score and the ball most of
// the time, with AGI-1's pixel face beside it; the game's big moments take it over for a second or two (a queue, the
// most important first): JACKPOT, MULTIBALL, OVERCLOCK, a mission, the end-of-ball bonus counted line by line…
export const DW = 128, DH = 32;
export const AMBER = 0, PINK = 4;     // add to a level 1–4

// ---------- fonts ----------
// 5 × 7: each glyph is 7 rows of 5 bits (the high bit on the left)
const F5 = {
  A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14], D: [28, 18, 17, 17, 17, 18, 28],
  E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16], G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14], J: [7, 2, 2, 2, 2, 18, 12], K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17], N: [17, 17, 25, 21, 19, 17, 17], O: [14, 17, 17, 17, 17, 17, 14], P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17], S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14], V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 21, 10], X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 17, 10, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
  0: [14, 17, 19, 21, 25, 17, 14], 1: [4, 12, 4, 4, 4, 4, 14], 2: [14, 17, 1, 2, 4, 8, 31], 3: [31, 2, 4, 2, 1, 17, 14],
  4: [2, 6, 10, 18, 31, 2, 2], 5: [31, 16, 30, 1, 1, 17, 14], 6: [6, 8, 16, 30, 17, 17, 14], 7: [31, 1, 2, 4, 8, 8, 8],
  8: [14, 17, 17, 14, 17, 17, 14], 9: [14, 17, 17, 15, 1, 2, 12],
  '!': [4, 4, 4, 4, 4, 0, 4], '?': [14, 17, 1, 2, 4, 0, 4], '.': [0, 0, 0, 0, 0, 12, 12], ',': [0, 0, 0, 0, 12, 4, 8],
  '-': [0, 0, 0, 31, 0, 0, 0], '+': [0, 4, 4, 31, 4, 4, 0], ':': [0, 12, 12, 0, 12, 12, 0], "'": [12, 4, 8, 0, 0, 0, 0],
  '/': [1, 2, 2, 4, 8, 8, 16], '×': [0, 17, 10, 4, 10, 17, 0], '%': [24, 25, 2, 4, 8, 19, 3], '#': [10, 10, 31, 10, 31, 10, 10],
  '♥': [0, 10, 31, 31, 14, 4, 0], '<': [2, 4, 8, 16, 8, 4, 2], '>': [8, 4, 2, 1, 2, 4, 8], ' ': [0, 0, 0, 0, 0, 0, 0],
  '=': [0, 0, 31, 0, 31, 0, 0],
};
// 3 × 5: each glyph is 5 rows of 3 bits
const F3 = {
  A: [2, 5, 7, 5, 5], B: [6, 5, 6, 5, 6], C: [3, 4, 4, 4, 3], D: [6, 5, 5, 5, 6], E: [7, 4, 6, 4, 7], F: [7, 4, 6, 4, 4],
  G: [3, 4, 5, 5, 3], H: [5, 5, 7, 5, 5], I: [7, 2, 2, 2, 7], J: [1, 1, 1, 5, 2], K: [5, 5, 6, 5, 5], L: [4, 4, 4, 4, 7],
  M: [5, 7, 7, 5, 5], N: [6, 5, 5, 5, 5], O: [2, 5, 5, 5, 2], P: [6, 5, 6, 4, 4], Q: [2, 5, 5, 6, 3], R: [6, 5, 6, 5, 5],
  S: [3, 4, 2, 1, 6], T: [7, 2, 2, 2, 2], U: [5, 5, 5, 5, 7], V: [5, 5, 5, 5, 2], W: [5, 5, 7, 7, 5], X: [5, 5, 2, 5, 5],
  Y: [5, 5, 2, 2, 2], Z: [7, 1, 2, 4, 7],
  0: [7, 5, 5, 5, 7], 1: [2, 6, 2, 2, 7], 2: [7, 1, 7, 4, 7], 3: [7, 1, 7, 1, 7], 4: [5, 5, 7, 1, 1], 5: [7, 4, 7, 1, 7],
  6: [7, 4, 7, 5, 7], 7: [7, 1, 1, 1, 1], 8: [7, 5, 7, 5, 7], 9: [7, 5, 7, 1, 7],
  '.': [0, 0, 0, 0, 2], ',': [0, 0, 0, 2, 4], '-': [0, 0, 7, 0, 0], '+': [0, 2, 7, 2, 0], ':': [0, 2, 0, 2, 0], '/': [1, 1, 2, 4, 4],
  '×': [0, 5, 2, 5, 0], '!': [2, 2, 2, 0, 2], '?': [6, 1, 2, 0, 2], '%': [5, 1, 2, 4, 5], '♥': [0, 5, 7, 2, 0], "'": [2, 2, 0, 0, 0],
  '=': [0, 7, 0, 7, 0],
  ' ': [0, 0, 0, 0, 0],
};
const FONTS = {
  small: { g: F3, w: 3, h: 5, gap: 1, scale: 1, space: 2 },
  med: { g: F5, w: 5, h: 7, gap: 1, scale: 1, space: 3 },
  big: { g: F5, w: 5, h: 7, gap: 1, scale: 2, space: 4 },
};
const glyphW = (f, ch) => (ch === ' ' ? f.space : (ch === '.' || ch === ',' || ch === ':' || ch === "'" || ch === '!') ? (f.w === 3 ? 1 : 2) * f.scale : f.w * f.scale);
const glyphX0 = (f, ch) => ((ch === '.' || ch === ',' || ch === ':' || ch === "'") ? (f.w === 3 ? 1 : 1) : ch === '!' ? (f.w === 3 ? 1 : 2) : 0);

export function textWidth(str, font = 'med') {
  const f = FONTS[font];
  let w = 0;
  for (const ch of String(str).toUpperCase()) w += glyphW(f, ch) + f.gap * f.scale;
  return Math.max(0, w - f.gap * f.scale);
}

// ---------- AGI-1's face (30 × 32, from tools/games/overclock/face.py): her hair parted in the middle, falling long on
// both sides; the eyes, the mouth and the blush are stamped on per expression ----------
const FACE = [
  '...........22222222...........',
  '........22234333332222........',
  '......223344332334334322......',
  '.....23343234334333334432.....',
  '....2343333334333233434332....',
  '...244333334324333433334242...',
  '..233343343333..433323344332..',
  '..23323433333.22.33334333432..',
  '.233343343334.22.434333233432.',
  '.2343333244..2222..2333343342.',
  '.23323334..22222222..34333232.',
  '23433343.222222222222.23333432',
  '23344332.222222222222.33343332',
  '234243..22222222222222..323332',
  '23333.222222222222222222.33342',
  '23333.222222222222222222.34322',
  '23243.222222222222222222.43332',
  '24333.222222222222222222.34332',
  '23333.222222222222222222.33432',
  '243343.2222222222222222.343342',
  '234333.2222222222222222.333332',
  '233423.2222222222222222.332342',
  '2333443.22222222222222.2334332',
  '2334342.22222222222222..233332',
  '243232...222222222222...223332',
  '233332...222222222222...243432',
  '2333432...2222222222....244322',
  '23433332...22222222....2233432',
  '24333332....111111....23333342',
  '23433432....222222....23334232',
  '22343332....222222.....2433332',
  '2222222.....666666.....2222222',
];
export const FACE_W = 30, FACE_H = 32;
// eyes (5 × 5, at columns 8 and 17, row 14) and mouths (6 × 3, at column 12, row 22); '.' leaves the skin
const EYES = {
  open: ['00000', '01401', '01111', '.000.', '.....'],
  blink: ['.....', '.....', '00000', '.....', '.....'],
  happy: ['.....', '.000.', '0...0', '.....', '.....'],
  wide: ['00000', '04440', '04040', '04440', '00000'],
  heart: ['PP.PP', 'PPPPP', 'PPPPP', '.PPP.', '..P..'],
  angry: ['0....', '.00..', '00000', '01401', '.000.'],
  sad: ['....0', '..00.', '00000', '01401', '.000.'],
};
const MOUTHS = {
  smile: ['0....0', '.0000.', '......'],
  grin: ['000000', '.0pp0.', '..00..'],
  o: ['..00..', '.0..0.', '..00..'],
  flat: ['......', '.0000.', '......'],
  frown: ['......', '.0000.', '0....0'],
  tongue: ['0....0', '.0000.', '..pp..'],
};
export const EXPRESSIONS = {
  idle: { l: 'open', r: 'open', m: 'smile' },
  blink: { l: 'blink', r: 'blink', m: 'smile' },
  wink: { l: 'open', r: 'happy', m: 'tongue' },
  happy: { l: 'happy', r: 'happy', m: 'grin' },
  shocked: { l: 'wide', r: 'wide', m: 'o' },
  love: { l: 'heart', r: 'heart', m: 'grin', blush: 4 },
  hot: { l: 'angry', r: 'angry', m: 'grin', blush: 4, sweat: true },
  sad: { l: 'sad', r: 'sad', m: 'frown' },
  focus: { l: 'open', r: 'open', m: 'flat' },
};

// ---------- the buffer ----------
export function createDMD() {
  return {
    buf: new Uint8Array(DW * DH), t: 0,
    queue: [], cur: null, face: 'idle', faceT: 0, blinkT: 2.2, idleFace: 'idle',
    sparks: [],                // explosion dots (jackpot): [x, y, vx, vy, life]
  };
}
export function clear(d) { d.buf.fill(0); }
export function px(d, x, y, v) {
  x |= 0; y |= 0;
  if (x < 0 || y < 0 || x >= DW || y >= DH) return;
  d.buf[y * DW + x] = v;
}
export function rect(d, x, y, w, h, v) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(d, x + i, y + j, v); }

// text at (x, y) (its top), align 'left' | 'center' | 'right'; level 1–4 (+ PINK)
export function text(d, str, x, y, { font = 'med', level = 4, align = 'left', shadow = 0, outline = false } = {}) {
  const f = FONTS[font];
  const s = String(str).toUpperCase();
  const w = textWidth(s, font);
  const x0 = align === 'center' ? Math.round(x - w / 2) : align === 'right' ? x - w : x;
  if (outline) rect(d, x0 - 1, y - 1, w + 2, f.h * f.scale + 2, 0);
  let cx = x0;
  for (const ch of s) {
    const g = f.g[ch] || f.g['?'];
    const gw = glyphW(f, ch), x0 = glyphX0(f, ch);
    for (let r = 0; r < f.h; r++) {
      const bits = g[r];
      for (let c = 0; c < f.w; c++) {
        if (!(bits & (1 << (f.w - 1 - c)))) continue;
        const gx = cx + (c - x0) * f.scale, gy = y + r * f.scale;
        for (let a = 0; a < f.scale; a++) for (let b = 0; b < f.scale; b++) {
          if (shadow) px(d, gx + a + 1, gy + b + 1, shadow);
          px(d, gx + a, gy + b, level);
        }
      }
    }
    cx += gw + f.gap * f.scale;
  }
  return w;
}

// her face at (x, y); `dim` scales it down to the dimmer levels (1 = as drawn)
export function face(d, x, y, expr = 'idle', { pink = false, shift = 0 } = {}) {
  const e = EXPRESSIONS[expr] || EXPRESSIONS.idle;
  const add = pink ? PINK : AMBER;
  for (let r = 0; r < FACE_H; r++) {
    const row = FACE[r];
    for (let c = 0; c < FACE_W; c++) {
      const ch = row[c];
      if (ch !== '.') px(d, x + c, y + r + shift, Number(ch) + add);
    }
  }
  const stamp = (rows, sx, sy) => {
    for (let r = 0; r < rows.length; r++) for (let c = 0; c < rows[r].length; c++) {
      const ch = rows[r][c];
      if (ch === '.') continue;
      px(d, x + sx + c, y + sy + r + shift, ch === '0' ? 0 : ch === 'p' ? 7 : ch === 'P' ? 8 : Number(ch) + add);
    }
  };
  stamp(EYES[e.l], 8, 14);
  stamp(EYES[e.r], 17, 14);
  stamp(MOUTHS[e.m], 12, 22);
  const blush = e.blush ? 7 : 6;
  for (const bx of [7, 8, 21, 22]) px(d, x + bx, y + 20 + shift, blush);
  if (e.sweat) { px(d, x + 25, y + 8, 4); px(d, x + 25, y + 9, 4); px(d, x + 24, y + 10, 3); px(d, x + 26, y + 10, 3); px(d, x + 25, y + 11, 3); }
}

// ---------- scenes: the big moments ----------
// show(d, kind, data): `prio` decides who waits (a higher one replaces a lower one at once)
const PRIO = { attract: 0, info: 1, lane: 2, mission: 3, lit: 3, skill: 4, save: 4, extra: 5, overclock: 5, lock: 5, jackpot: 6, multiball: 6, agi: 7, drain: 7, tilt: 8, bonus: 9, over: 9 };
const DUR = { info: 1.6, lane: 1.1, mission: 2.4, lit: 1.6, skill: 2.0, save: 1.6, extra: 2.4, overclock: 2.4, lock: 2.0, jackpot: 2.4, multiball: 2.8, agi: 3.0, drain: 1.6, tilt: 2.4, over: 99, missionDone: 2.4, agiEnd: 2.6 };
export function show(d, kind, data = {}) {
  const prio = PRIO[kind] ?? PRIO[data.as] ?? 2;
  const item = { kind, data, t: 0, dur: data.dur ?? DUR[kind] ?? 1.8, prio };
  if (!d.cur || prio > d.cur.prio) { if (d.cur && d.cur.dur - d.cur.t > 0.4 && d.cur.prio >= 3) d.queue.unshift(d.cur); d.cur = item; }
  else {
    // the same kind already waiting is replaced (a burst of lanes is one message), the queue stays short
    const i = d.queue.findIndex((q) => q.kind === kind);
    if (i >= 0) d.queue[i] = item; else d.queue.push(item);
    d.queue.sort((a, b) => b.prio - a.prio);
    if (d.queue.length > 4) d.queue.length = 4;
  }
  if (kind === 'jackpot') burst(d, 64, 16, 46);
}
export function busy(d) { return Boolean(d.cur); }
export function reset(d) { d.queue.length = 0; d.cur = null; d.sparks.length = 0; }

function burst(d, x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, s = 30 + (i % 5) * 9;
    d.sparks.push([x, y, Math.cos(a) * s * 1.9, Math.sin(a) * s * 0.7, 0.9 + (i % 3) * 0.15]);
  }
}

export function update(d, dt) {
  d.t += dt;
  d.faceT -= dt;
  d.blinkT -= dt;
  if (d.blinkT < -0.12) d.blinkT = 2 + ((d.t * 7.3) % 2.5);
  if (d.cur) {
    d.cur.t += dt;
    if (d.cur.t >= d.cur.dur) d.cur = d.queue.shift() || null;
  }
  for (const s of d.sparks) { s[0] += s[2] * dt; s[1] += s[3] * dt; s[4] -= dt; }
  d.sparks = d.sparks.filter((s) => s[4] > 0);
}

// a face for a moment (on top of the scenes that don't choose their own)
export function mood(d, expr, secs = 1.4) { d.face = expr; d.faceT = secs; }
const curFace = (d, fallback = 'idle') => (d.faceT > 0 ? d.face : d.blinkT < 0 && d.blinkT > -0.12 ? 'blink' : fallback);

const fmtN = (n) => Math.round(n).toLocaleString('en-US');

// st: { score, ball, balls, bonusX, mission, progress, heat, overclock, agi, multiball, best, attract, players… }
export function draw(d, st) {
  clear(d);
  const c = d.cur;
  if (c) SCENES[c.kind]?.(d, c.t, c.data, st, c) ?? SCENES.info(d, c.t, c.data, st, c);
  else if (st.attract) attract(d, st);
  else idle(d, st);
  for (const s of d.sparks) px(d, s[0], s[1], s[4] > 0.5 ? 8 : 4);
}

function idle(d, st) {
  const hot = st.overclock > 0, agi = st.agi > 0;
  face(d, -1, 0, curFace(d, agi ? 'love' : hot ? 'hot' : st.multiball ? 'happy' : 'idle'), { pink: agi });
  const s = fmtN(st.score);
  const font = textWidth(s, 'big') <= 94 ? 'big' : 'med';
  text(d, s, 128 - 1, font === 'big' ? 3 : 7, { font, level: agi ? 8 : 4, align: 'right' });
  // the status line: the ball, the bonus multiplier, the mission
  let line;
  if (agi) line = `AGI MODE ${Math.ceil(st.agi)}`;
  else if (hot) line = `OVERCLOCK ${Math.ceil(st.overclock)}`;
  else if (st.multiball) line = `JACKPOT ${compact(st.jackpot)}`;
  else if (st.mission && st.missionShow) line = `${st.mission.short} ${st.progress}/${st.mission.goal}`;
  else line = `BALL ${st.ball}  ${st.bonusX}X`;
  text(d, line, 33, 24, { font: 'small', level: hot || agi ? 7 : 3 });
  // the heat, a bar under the score
  const hw = Math.round((Math.min(100, st.heat) / 100) * 40);
  for (let i = 0; i < 40; i++) { px(d, 87 + i, 26, i < hw ? (hot ? 8 : i > 30 ? 7 : 3) : 1); px(d, 87 + i, 27, i < hw ? (hot ? 7 : i > 30 ? 6 : 2) : 0); }
}
const compact = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n));

function attract(d, st) {
  const k = Math.floor(d.t / 3.2) % 3;
  const t = d.t % 3.2;
  if (k === 0) {
    // OVERCLOCK, wiped in column by column
    const w = Math.min(128, t * 160);
    text(d, 'OVERCLOCK', 64, 4, { font: 'big', level: 4, align: 'center' });
    for (let x = Math.ceil(w); x < 128; x++) for (let y = 0; y < 32; y++) d.buf[y * DW + x] = 0;
    text(d, 'FLIP FAST. RUN HOT.', 64, 23, { font: 'small', level: 3, align: 'center' });
  } else if (k === 1) {
    face(d, 51, 1, curFace(d, t < 1.2 ? 'idle' : 'wink'));
  } else {
    if (Math.floor(d.t * 2.4) % 2 === 0) text(d, 'PRESS START', 64, 6, { font: 'med', level: 4, align: 'center' });
    text(d, st.best ? `BEST ${fmtN(st.best)}` : 'FREE PLAY', 64, 20, { font: 'small', level: 3, align: 'center' });
  }
}

// ---- the scenes ----
// "reduce motion": the words stay lit instead of blinking (the game calls calm(true))
let CALM = false;
export function calm(on) { CALM = Boolean(on); }
const flashOn = (t, hz = 6) => CALM || Math.floor(t * hz) % 2 === 0;
const SCENES = {
  info(d, t, p) {
    const lines = p.lines || [p.text || ''];
    const font = p.font || (lines.length === 1 && textWidth(lines[0], 'big') <= 126 ? 'big' : 'med');
    if (p.face) face(d, 1, 1, p.face);
    const cx = p.face ? 78 : 64;
    if (lines.length === 1) text(d, lines[0], cx, font === 'big' ? 9 : 12, { font, level: p.pink ? 8 : 4, align: 'center' });
    else { text(d, lines[0], cx, 4, { font: 'med', level: p.pink ? 8 : 4, align: 'center' }); text(d, lines[1], cx, 18, { font: lines[1].length > 18 ? 'small' : 'med', level: 3, align: 'center' }); }
  },
  lane(d, t, p) {
    // R-A-M: the three letters, the lit ones bright
    face(d, 1, 1, curFace(d));
    for (let i = 0; i < 3; i++) {
      const lit = p.ram[i];
      text(d, 'RAM'[i], 52 + i * 22, 4, { font: 'big', level: lit ? (flashOn(t, 8) || i !== p.lane ? 4 : 2) : 1 });
    }
    text(d, p.bonusX > 1 && p.all ? `BONUS ${p.bonusX}X` : `+${fmtN(p.pts || 3000)}`, 82, 24, { font: 'small', level: 3, align: 'center' });
  },
  skill(d, t, p) {
    face(d, 1, 1, 'happy');
    if (flashOn(t, 5)) text(d, 'SKILL SHOT', 78, 5, { font: 'med', level: 8, align: 'center' });
    text(d, fmtN(p.pts || 200000), 78, 16, { font: 'big', level: 4, align: 'center' });
  },
  jackpot(d, t, p) {
    // the explosion (sparks), the word flashing, then its value
    const k = Math.min(1, t / 0.35);
    const r = k * 70;
    for (let a = 0; a < 64; a++) { const an = (a / 64) * Math.PI * 2; px(d, 64 + Math.cos(an) * r, 16 + Math.sin(an) * r * 0.42, 8); }
    if (t < 1.2) text(d, 'JACKPOT', 64, 9, { font: 'big', level: flashOn(t, 10) ? 8 : 4, align: 'center', outline: true });
    else { face(d, 1, 1, 'wink'); text(d, 'JACKPOT', 78, 2, { font: 'med', level: 8, align: 'center' }); text(d, fmtN(p.pts), 78, 14, { font: textWidth(fmtN(p.pts), 'big') < 96 ? 'big' : 'med', level: 4, align: 'center' }); }
  },
  multiball(d, t, p) {
    if (t < 1.4) {
      // MULTI / BALL slamming in from both sides
      const k = Math.min(1, t / 0.4);
      const e = 1 - (1 - k) ** 3;
      text(d, 'MULTI', -40 + e * 104, 1, { font: 'big', level: 4, align: 'center' });
      text(d, 'BALL', 168 - e * 104, 17, { font: 'big', level: flashOn(t, 8) ? 8 : 4, align: 'center' });
    } else {
      face(d, 1, 1, 'happy');
      text(d, 'MULTIBALL', 78, 4, { font: 'med', level: 8, align: 'center' });
      text(d, 'RAMP = JACKPOT', 78, 19, { font: 'small', level: flashOn(t, 4) ? 4 : 2, align: 'center' });
    }
  },
  lock(d, t, p) {
    face(d, 1, 1, 'wink');
    text(d, `BALL ${p.n} LOCKED`, 78, 6, { font: 'med', level: 4, align: 'center' });
    text(d, p.n >= 1 ? 'ONE MORE FOR MULTIBALL' : '', 78, 20, { font: 'small', level: 3, align: 'center' });
  },
  lit(d, t, p) {
    face(d, 1, 1, curFace(d));
    text(d, p.title || 'LOCK IS LIT', 78, 6, { font: 'med', level: flashOn(t, 6) ? 4 : 2, align: 'center' });
    text(d, p.sub || 'SHOOT THE SOCKET', 78, 20, { font: 'small', level: 3, align: 'center' });
  },
  overclock(d, t) {
    // flames rising from the bottom, the word over them
    for (let x = 0; x < 128; x++) {
      const hgt = 6 + Math.round((Math.sin(x * 0.55 + t * 13) + Math.sin(x * 0.23 - t * 9)) * 3 + 4);
      for (let y = 0; y < hgt; y++) px(d, x, 31 - y, y > hgt - 3 ? 5 : y > hgt - 6 ? 6 : 7);
    }
    text(d, 'OVERCLOCK', 64, 2, { font: 'big', level: 4, align: 'center', outline: true });
    if (t > 0.8) text(d, '2X SCORING', 64, 21, { font: 'med', level: 4, align: 'center', outline: true });
  },
  mission(d, t, p) {
    face(d, 1, 1, curFace(d, 'focus'));
    text(d, t < 0.9 ? 'NEW MISSION' : p.mission.name, 78, 5, { font: textWidth(p.mission.name, 'med') <= 98 ? 'med' : 'small', level: 4, align: 'center' });
    text(d, `${p.mission.goal}X`, 78, 17, { font: 'med', level: flashOn(t, 4) ? 8 : 4, align: 'center' });
  },
  missionDone(d, t, p) {
    face(d, 1, 1, 'happy');
    text(d, 'MISSION', 78, 1, { font: 'med', level: 4, align: 'center' });
    text(d, 'COMPLETE', 78, 10, { font: 'med', level: flashOn(t, 6) ? 8 : 4, align: 'center' });
    text(d, `+${fmtN(p.pts)}`, 78, 24, { font: 'small', level: 3, align: 'center' });
    // four lights: the missions toward AGI MODE
    for (let i = 0; i < 4; i++) rect(d, 112 - 0 + (i % 2) * 6, 2 + Math.floor(i / 2) * 6, 4, 4, i < p.wizard ? 8 : 1);
  },
  agi(d, t, p) {
    // her face big and pink, hearts floating up
    for (let i = 0; i < 9; i++) {
      const hx = 34 + ((i * 41 + 9) % 92), hy = 31 - (((t * 22) + i * 9) % 36);
      text(d, '♥', hx, hy, { font: 'small', level: 6 });
    }
    face(d, -1, 0, 'love', { pink: true });
    if (t > 0.5) text(d, 'AGI MODE', 79, 4, { font: 'big', level: 8, align: 'center', outline: true });
    if (t > 1.2) text(d, 'ALL SHOTS LIT', 79, 23, { font: 'small', level: 4, align: 'center', outline: true });
  },
  agiEnd(d, t, p) {
    face(d, 1, 1, 'love', { pink: true });
    text(d, 'AGI MODE TOTAL', 78, 4, { font: 'small', level: 7, align: 'center' });
    text(d, fmtN(p.pts), 78, 13, { font: textWidth(fmtN(p.pts), 'big') < 96 ? 'big' : 'med', level: 8, align: 'center' });
  },
  save(d, t) {
    face(d, 1, 1, 'wink');
    text(d, 'BALL SAVED', 78, 6, { font: 'med', level: flashOn(t, 5) ? 4 : 2, align: 'center' });
    text(d, 'DON\'T MOVE', 78, 20, { font: 'small', level: 3, align: 'center' });
  },
  extra(d, t) {
    face(d, 1, 1, 'happy');
    text(d, 'EXTRA', 78, 1, { font: 'big', level: flashOn(t, 6) ? 8 : 4, align: 'center' });
    text(d, 'BALL', 78, 17, { font: 'big', level: 4, align: 'center' });
  },
  drain(d, t, p) {
    face(d, 51, 1 + (t < 0.15 ? 1 : 0), 'shocked');
    if (t > 0.5) { text(d, p.left || 'NO!', 24, 12, { font: 'med', level: 3, align: 'center' }); text(d, p.right || 'NO!', 104, 12, { font: 'med', level: 3, align: 'center' }); }
  },
  tilt(d, t, p) {
    if (flashOn(t, 3)) text(d, p.text || 'TILT', 64, 9, { font: 'big', level: 4, align: 'center' });
    if (p.sub) text(d, p.sub, 64, 25, { font: 'small', level: 3, align: 'center' });
  },
  bonus(d, t, p) {
    // the end-of-ball bonus, line by line, then the multiplier and the total
    const b = p.bonus;
    if (b.tilted) { text(d, 'TILT', 64, 4, { font: 'big', level: 4, align: 'center' }); text(d, 'NO BONUS', 64, 22, { font: 'small', level: 3, align: 'center' }); return; }
    const step = 0.45, i = Math.floor(Math.max(0, t - 0.35) / step);
    text(d, 'BONUS', 64, 1, { font: 'small', level: 3, align: 'center' });
    if (!b.lines.length) { text(d, 'NO BONUS', 64, 12, { font: 'med', level: 3, align: 'center' }); return; }
    if (i < b.lines.length) {
      const l = b.lines[i];
      text(d, `${l.label} ${l.n}`, 64, 9, { font: 'med', level: 4, align: 'center' });
      text(d, fmtN(l.pts), 64, 20, { font: 'med', level: 3, align: 'center' });
    } else {
      text(d, b.x > 1 ? `${fmtN(b.sub)} × ${b.x}` : 'TOTAL', 64, 9, { font: b.x > 1 ? 'small' : 'med', level: 3, align: 'center' });
      text(d, fmtN(b.total), 64, 17, { font: textWidth(fmtN(b.total), 'big') < 126 ? 'big' : 'med', level: 4, align: 'center' });
    }
  },
  over(d, t, p) {
    face(d, 1, 1, curFace(d, 'sad'));
    text(d, 'GAME OVER', 78, 4, { font: 'med', level: 4, align: 'center' });
    text(d, fmtN(p.score), 78, 16, { font: textWidth(fmtN(p.score), 'big') < 96 ? 'big' : 'med', level: 4, align: 'center' });
  },
};
