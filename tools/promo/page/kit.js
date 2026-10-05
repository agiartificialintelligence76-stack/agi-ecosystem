// AGI-1's launch video: a small motion-design kit for a 2D canvas. Easing, timing, type, shapes, the site's colors and
// textures (halftone dots, comic focus lines, film grain). Everything is a pure function of time: drawing frame n twice
// gives the same picture.

// ---------- the site's colors ----------
export const C = {
  // Pop mode (src/styles/pop.css)
  ink: '#170a36', paper: '#f8f5ff', lav: '#e4d9ff', lav2: '#cdb8ff', violet: '#6b3bff', violetDeep: '#2a1466',
  honey: '#ffc933', mint: '#3ff0c3', pink: '#ff4da6', blue: '#2f5bff', white: '#ffffff',
  // the lab look (src/styles/tokens.css, dark)
  labBg: '#0b0b0c', labBg2: '#141416', labFg: '#ededed', labFg2: '#a1a1a6', labFg3: '#86868c', labLine: '#26262a', labAccent: '#ff5c93',
  up: '#3ecf8e', warn: '#f2a33a', down: '#ff6b6b',
};
export const FONTS = {
  sans: "'Geist', 'Noto Sans CJK SC', sans-serif",
  mono: "'Geist Mono', 'Noto Sans Mono CJK SC', monospace",
  display: "'Anybody', 'Geist', sans-serif",
  serif: "'Instrument Serif', serif",
  doki: "'Dela Gothic One', 'Noto Sans CJK JP', sans-serif",
  emoji: "'Noto Color Emoji'",
};

// ---------- time ----------
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const prog = (t, a, b) => clamp((t - a) / (b - a));
export const mix = (a, b, p) => a + (b - a) * p;
export const E = {
  lin: (x) => x,
  inQuad: (x) => x * x,
  outQuad: (x) => 1 - (1 - x) * (1 - x),
  inOutQuad: (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2),
  inCubic: (x) => x * x * x,
  outCubic: (x) => 1 - (1 - x) ** 3,
  inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2),
  outQuart: (x) => 1 - (1 - x) ** 4,
  inOutQuart: (x) => (x < 0.5 ? 8 * x ** 4 : 1 - (-2 * x + 2) ** 4 / 2),
  outQuint: (x) => 1 - (1 - x) ** 5,
  inExpo: (x) => (x <= 0 ? 0 : 2 ** (10 * x - 10)),
  outExpo: (x) => (x >= 1 ? 1 : 1 - 2 ** (-10 * x)),
  inOutExpo: (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? 2 ** (20 * x - 10) / 2 : (2 - 2 ** (-20 * x + 10)) / 2),
  outBack: (x, c = 1.70158) => 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2,
  inBack: (x, c = 1.70158) => (c + 1) * x ** 3 - c * x * x,
  outElastic: (x) => (x <= 0 ? 0 : x >= 1 ? 1 : 2 ** (-10 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
  smooth: (x) => x * x * (3 - 2 * x),
};
// eased progress of t from a to b
export const ep = (t, a, b, ease = E.outCubic) => ease(prog(t, a, b));
// a value that goes in (a → a+inDur), holds, and goes out (b-outDur → b): 0..1..0
export function inOut(t, a, b, inDur = 0.4, outDur = 0.3, easeIn = E.outCubic, easeOut = E.inCubic) {
  if (t < a || t > b) return 0;
  return Math.min(easeIn(prog(t, a, a + inDur)), 1 - easeOut(prog(t, b - outDur, b)));
}
// a damped spring's response to a step at time t0 (0 → 1, overshooting a little): pops and slams
export function spring(t, t0, { freq = 2.4, damp = 0.32 } = {}) {
  const x = t - t0;
  if (x <= 0) return 0;
  const w = 2 * Math.PI * freq;
  return 1 - Math.exp(-damp * w * x) * Math.cos(w * Math.sqrt(1 - damp * damp) * x);
}

// ---------- randomness that never changes ----------
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
// smooth 1D noise (-1..1): drifts, wobbles
export function noise1(x) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return mix(hash(i) * 2 - 1, hash(i + 1) * 2 - 1, u);
}

// ---------- colors ----------
export function rgba(hex, a = 1) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
export function mixHex(a, b, p) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(mix((pa >> s) & 255, (pb >> s) & 255, clamp(p)));
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

// ---------- canvases ----------
export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  return c;
}

// ---------- type ----------
// font: { f: family key or name, w: weight, s: size px, st: stretch keyword, i: italic }
export function setFont(g, { f = 'sans', w = 500, s = 32, st = 'normal', i = false } = {}) {
  g.font = `${i ? 'italic ' : ''}${w} ${s}px ${FONTS[f] || f}`;
  g.fontStretch = st;
  g.fontKerning = 'normal';
}
const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('en', { granularity: 'grapheme' }) : null;
export const graphemes = (s) => (seg ? [...seg.segment(String(s))].map((x) => x.segment) : [...String(s)]);
// the first n characters of s (emoji and accents kept whole): typing
export const typed = (s, n) => graphemes(s).slice(0, Math.max(0, Math.floor(n))).join('');
export function measure(g, text, font, spacing = 0) {
  setFont(g, font);
  g.letterSpacing = `${spacing}px`;
  const w = g.measureText(text).width;
  g.letterSpacing = '0px';
  return w;
}
// draws text; o: { x, y, font, color, align ('left' | 'center' | 'right'), base ('alphabetic' | 'middle' | 'top'), spacing,
// alpha, stroke: { color, width }, shadow: { color, x, y, blur } }
export function text(g, str, o) {
  const { x = 0, y = 0, font = {}, color = '#fff', align = 'left', base = 'alphabetic', spacing = 0, alpha = 1, stroke = null, shadow = null, dir = 'ltr' } = o;
  if (alpha <= 0 || !str) return 0;
  g.save();
  setFont(g, font);
  g.globalAlpha *= alpha;
  g.textAlign = align;
  g.textBaseline = base;
  g.direction = dir;
  g.letterSpacing = `${spacing}px`;
  if (shadow) { g.shadowColor = shadow.color; g.shadowOffsetX = shadow.x || 0; g.shadowOffsetY = shadow.y || 0; g.shadowBlur = shadow.blur || 0; }
  if (stroke) { g.lineJoin = 'round'; g.lineWidth = stroke.width; g.strokeStyle = stroke.color; g.strokeText(str, x, y); }
  g.fillStyle = color;
  g.fillText(str, x, y);
  const w = g.measureText(str).width;
  g.restore();
  return w;
}
// words that wrap inside maxW: → lines
export function wrap(g, str, font, maxW, spacing = 0) {
  setFont(g, font);
  g.letterSpacing = `${spacing}px`;
  const lines = [];
  for (const para of String(str).split('\n')) {
    const words = para.split(' ');
    let line = '';
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (g.measureText(next).width > maxW && line) { lines.push(line); line = w; } else line = next;
    }
    lines.push(line);
  }
  g.letterSpacing = '0px';
  return lines;
}
// A line of text that rises into place from behind a mask (each word on its own beat): the motion designer's favorite.
// words: [string], t: now, t0: start, o: text options + { stagger, dur, rise, maskPad }
export function riseWords(g, words, t, t0, o) {
  const { x, y, font, color, stagger = 0.06, dur = 0.55, rise = 1.0, spacing = 0, gap = null, align = 'left', ease = E.outQuart, alpha = 1 } = o;
  setFont(g, font);
  g.letterSpacing = `${spacing}px`;
  const space = gap ?? g.measureText(' ').width;
  const widths = words.map((w) => g.measureText(w).width);
  g.letterSpacing = '0px';
  const total = widths.reduce((a, b) => a + b, 0) + space * (words.length - 1);
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  const h = font.s * 1.25;
  for (let k = 0; k < words.length; k++) {
    const p = ease(prog(t, t0 + k * stagger, t0 + k * stagger + dur));
    if (p > 0) {
      g.save();
      g.beginPath();
      g.rect(cx - font.s * 0.2, y - font.s * 1.05, widths[k] + font.s * 0.4, h + font.s * 0.15);
      g.clip();
      text(g, words[k], { x: cx, y: y + (1 - p) * h * rise, font, color, spacing, alpha });
      g.restore();
    }
    cx += widths[k] + space;
  }
  return total;
}

// ---------- shapes ----------
export function rr(g, x, y, w, h, r) {
  const k = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.roundRect(x, y, w, h, k);
}
// a Pop mode card: fill, ink outline, hard offset shadow (like a sticker)
export function popCard(g, x, y, w, h, { r = 22, fill = C.white, line = C.ink, lw = 3, shadow = 8, shadowColor = C.ink, alpha = 1 } = {}) {
  if (alpha <= 0) return;
  g.save();
  g.globalAlpha *= alpha;
  if (shadow) { rr(g, x + shadow, y + shadow, w, h, r); g.fillStyle = shadowColor; g.fill(); }
  rr(g, x, y, w, h, r);
  g.fillStyle = fill; g.fill();
  if (lw) { g.lineWidth = lw; g.strokeStyle = line; g.stroke(); }
  g.restore();
}
// a heart (the site's: two arcs and a point), centered at x, y, about `s` wide
export function heart(g, x, y, s, color, alpha = 1) {
  if (alpha <= 0) return;
  g.save();
  g.globalAlpha *= alpha;
  g.translate(x, y);
  g.scale(s / 24, s / 24);
  g.beginPath();
  g.moveTo(0, 8);
  g.bezierCurveTo(-2, 6, -12, 0, -12, -6);
  g.bezierCurveTo(-12, -11, -8, -13, -5.5, -13);
  g.bezierCurveTo(-2.5, -13, -1, -11, 0, -9);
  g.bezierCurveTo(1, -11, 2.5, -13, 5.5, -13);
  g.bezierCurveTo(8, -13, 12, -11, 12, -6);
  g.bezierCurveTo(12, 0, 2, 6, 0, 8);
  g.closePath();
  g.fillStyle = color;
  g.fill();
  g.restore();
}
// a four-point spark (the front's ✦)
export function spark(g, x, y, s, color, alpha = 1, rot = 0) {
  if (alpha <= 0) return;
  g.save();
  g.globalAlpha *= alpha;
  g.translate(x, y);
  g.rotate(rot);
  g.beginPath();
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    g.lineTo(Math.cos(a) * s, Math.sin(a) * s);
    g.lineTo(Math.cos(a + Math.PI / 4) * s * 0.22, Math.sin(a + Math.PI / 4) * s * 0.22);
  }
  g.closePath();
  g.fillStyle = color;
  g.fill();
  g.restore();
}

// ---------- textures ----------
// A halftone dot field (cached per look): dots on a 45° grid, as in the site's Pop mode
const dotCache = new Map();
export function halftone(w, h, cell, color, r = 0.22) {
  const key = `${w}x${h}:${cell}:${color}:${r}`;
  if (dotCache.has(key)) return dotCache.get(key);
  const c = canvas(w, h), g = c.getContext('2d');
  g.fillStyle = color;
  for (let y = 0, row = 0; y < h + cell; y += cell * 0.7071, row++) {
    for (let x = (row % 2) * cell * 0.5; x < w + cell; x += cell) {
      g.beginPath(); g.arc(x, y, cell * r, 0, Math.PI * 2); g.fill();
    }
  }
  dotCache.set(key, c);
  return c;
}
// Comic focus lines around (cx, cy): uneven rays, turning slowly (the front's hero)
export function focusLines(g, cx, cy, R, t, { color = 'rgba(255,255,255,0.08)', count = 46, spin = 0.04, seed = 3 } = {}) {
  g.save();
  g.fillStyle = color;
  g.beginPath();
  let a = t * spin;
  for (let i = 0; i < count; i++) {
    const w = (0.35 + hash(i + seed * 17) * 0.9) * ((Math.PI * 2) / count) * 0.5;
    g.moveTo(cx, cy);
    g.arc(cx, cy, R, a, a + w);
    g.closePath();
    a += (Math.PI * 2) / count;
  }
  g.fill();
  g.restore();
}
// Film grain: a few noise tiles, one per frame in turn (cheap, and never the same twice in a row)
const grains = [];
export function grain(g, w, h, frame, alpha = 0.06) {
  if (!grains.length) {
    const rnd = seeded(77);
    for (let k = 0; k < 6; k++) {
      const c = canvas(256, 256), x = c.getContext('2d'), img = x.createImageData(256, 256);
      for (let i = 0; i < img.data.length; i += 4) { const v = rnd() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
      x.putImageData(img, 0, 0);
      grains.push(c);
    }
  }
  g.save();
  g.globalAlpha = alpha;
  g.globalCompositeOperation = 'overlay';
  const tile = grains[frame % grains.length];
  const ox = (hash(frame) * 256) | 0, oy = (hash(frame + 9) * 256) | 0;
  for (let y = -oy; y < h; y += 256) for (let x = -ox; x < w; x += 256) g.drawImage(tile, x, y);
  g.restore();
}
// A soft vignette: the edges a little darker, for depth
export function vignette(g, w, h, strength = 0.35, color = '0,0,0') {
  const r = Math.hypot(w, h) / 2;
  const v = g.createRadialGradient(w / 2, h / 2, r * 0.45, w / 2, h / 2, r);
  v.addColorStop(0, `rgba(${color},0)`);
  v.addColorStop(1, `rgba(${color},${strength})`);
  g.fillStyle = v;
  g.fillRect(0, 0, w, h);
}
