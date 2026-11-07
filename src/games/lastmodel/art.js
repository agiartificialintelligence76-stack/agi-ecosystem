// LAST MODEL STANDING: the pixel art made into canvases once, as the page starts: one atlas with every sprite and its
// variants (looking left, a white hit-flash, an elite: twice the size with a honey outline), soft pixel shadows, stepped
// glows for the shots (drawn with "lighter"), the server-room floor in chunks made as they're needed, rings for waves
// and warnings, the pixel digits of the damage numbers, and the icons as pictures for the cards (data: URLs: the CSP
// allows them). Everything stays crisp: it's drawn at whole multiples of its pixels, never smoothed.
import { PAL, SPRITES } from './sprites.js';

const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; };
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const RGB = Object.fromEntries(Object.entries(PAL).map(([k, v]) => [k, hex(v)]));

// the anchor of each sprite: AGI-1 by her feet; everything else by its middle
const anchorOf = (name, w, h) => (name.startsWith('agi') ? [w / 2, h] : [w / 2, h / 2]);
const ENEMY = new Set(['spam', 'crawler', 'captcha', 'troll', 'ghost', 'swarm']);
const FLASHED = (name) => /^(agi|spam|crawler|captcha|troll|ghost|swarm|botnet|broker|overfit|crate)/.test(name);
const MIRRORED = (name) => /^(agi|spam|crawler|captcha|troll|ghost|swarm|broker)/.test(name);

// one sprite's pixels (×scale), as an RGBA buffer, mirrored or white if asked, with an outline ring of `ring` colour
function pixels(rows, { scale = 1, mirror = false, white = false, ring = null } = {}) {
  const sw = rows[0].length, sh = rows.length;
  const pad = ring ? 1 : 0;
  const w = sw * scale + pad * 2, h = sh * scale + pad * 2;
  const buf = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < sh; y++) {
    const row = rows[y];
    for (let x = 0; x < sw; x++) {
      const ch = row[mirror ? sw - 1 - x : x];
      if (ch === '.') continue;
      const c = white ? (ch === 'h' ? [255, 236, 250] : [255, 255, 255]) : RGB[ch];
      for (let yy = 0; yy < scale; yy++) {
        for (let xx = 0; xx < scale; xx++) {
          const i = ((y * scale + yy + pad) * w + (x * scale + xx + pad)) * 4;
          buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = 255;
        }
      }
    }
  }
  if (ring) {
    const rc = hex(ring), add = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (buf[(y * w + x) * 4 + 3]) continue;
      const near = (dx, dy) => { const xx = x + dx, yy = y + dy; return xx >= 0 && yy >= 0 && xx < w && yy < h && buf[(yy * w + xx) * 4 + 3] === 255; };
      if (near(1, 0) || near(-1, 0) || near(0, 1) || near(0, -1)) add.push((y * w + x) * 4);
    }
    for (const i of add) { buf[i] = rc[0]; buf[i + 1] = rc[1]; buf[i + 2] = rc[2]; buf[i + 3] = 255; }
  }
  return { buf, w, h };
}

// ---------- the atlas ----------
function buildAtlas() {
  const jobs = [];
  for (const [name, rows] of Object.entries(SPRITES)) {
    const base = { name, rows };
    jobs.push({ ...base, key: name });
    if (MIRRORED(name)) jobs.push({ ...base, key: `${name}~m`, mirror: true });
    if (FLASHED(name)) {
      jobs.push({ ...base, key: `${name}~f`, white: true });
      if (MIRRORED(name)) jobs.push({ ...base, key: `${name}~mf`, mirror: true, white: true });
    }
    const kind = name.replace(/B$/, '');
    if (ENEMY.has(kind)) {
      for (const m of [false, true]) for (const f of [false, true]) {
        jobs.push({ ...base, key: `${name}~e${m ? 'm' : ''}${f ? 'f' : ''}`, scale: 2, mirror: m, white: f, ring: f ? null : '#ffc933', elite: true });
      }
    }
  }
  const made = jobs.map((j) => ({ ...j, px: pixels(j.rows, j) }));
  // shelf packing, tallest first
  made.sort((a, b) => b.px.h - a.px.h);
  const W = 1024;
  let x = 1, y = 1, shelf = 0;
  for (const m of made) {
    if (x + m.px.w + 1 > W) { x = 1; y += shelf + 1; shelf = 0; }
    m.x = x; m.y = y;
    x += m.px.w + 1;
    shelf = Math.max(shelf, m.px.h);
  }
  const H = y + shelf + 1;
  const atlas = mk(W, H);
  const g = atlas.getContext('2d');
  const img = g.createImageData(W, H);
  for (const m of made) {
    for (let yy = 0; yy < m.px.h; yy++) {
      img.data.set(m.px.buf.subarray(yy * m.px.w * 4, (yy + 1) * m.px.w * 4), ((m.y + yy) * W + m.x) * 4);
    }
  }
  g.putImageData(img, 0, 0);
  const frames = {};
  for (const m of made) {
    const sw = m.rows[0].length * (m.scale || 1), sh = m.rows.length * (m.scale || 1);
    const [ax, ay] = anchorOf(m.name, sw, sh);
    const pad = m.ring ? 1 : 0;
    frames[m.key] = { img: atlas, x: m.x, y: m.y, w: m.px.w, h: m.px.h, ax: ax + pad, ay: ay + pad };
  }
  return { atlas, frames };
}

// ---------- shadows, glows, discs ----------
function ellipseSprite(rx, ry, color, alpha) {
  const w = rx * 2 + 1, h = ry * 2 + 1;
  const c = mk(w, h), g = c.getContext('2d');
  g.fillStyle = color;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (((x - rx) / (rx + 0.5)) ** 2 + ((y - ry) / (ry + 0.5)) ** 2 <= 1) {
      g.globalAlpha = alpha;
      g.fillRect(x, y, 1, 1);
    }
  }
  return { img: c, x: 0, y: 0, w, h, ax: rx + 0.5, ay: ry + 0.5 };
}
// a glow in pixel steps (brighter in the middle), for "lighter" blending
function glowSprite(r, color) {
  const n = r * 2 + 1;
  const c = mk(n, n), g = c.getContext('2d');
  const [R, G, B] = hex(color);
  const img = g.createImageData(n, n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const d = Math.hypot(x - r, y - r) / (r + 0.5);
    if (d > 1) continue;
    const a = d < 0.3 ? 0.55 : d < 0.55 ? 0.32 : d < 0.8 ? 0.16 : 0.07;
    const i = (y * n + x) * 4;
    img.data[i] = R; img.data[i + 1] = G; img.data[i + 2] = B; img.data[i + 3] = Math.round(a * 255);
  }
  g.putImageData(img, 0, 0);
  return { img: c, x: 0, y: 0, w: n, h: n, ax: r + 0.5, ay: r + 0.5 };
}
const ringCache = new Map();
// a filled disc with a dithered edge (the field's shimmer, warnings)
export function discSprite(r, color, alpha) {
  r = Math.max(1, Math.round(r));
  const key = `d${r}|${color}|${alpha}`;
  let s = ringCache.get(key);
  if (s) return s;
  const n = r * 2 + 3, o = r + 1;
  const c = mk(n, n), g = c.getContext('2d');
  const [R, G, B] = hex(color);
  const img = g.createImageData(n, n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const d = Math.hypot(x - o, y - o);
    if (d > r) continue;
    const edge = d > r - 3;
    if (edge && (x + y) % 2) continue;
    const i = (y * n + x) * 4;
    img.data[i] = R; img.data[i + 1] = G; img.data[i + 2] = B; img.data[i + 3] = Math.round(alpha * (edge ? 1.6 : 1) * 255);
  }
  g.putImageData(img, 0, 0);
  s = { img: c, x: 0, y: 0, w: n, h: n, ax: o + 0.5, ay: o + 0.5 };
  ringCache.set(key, s);
  return s;
}

// ---------- the floor: a server room, in 256-pixel chunks made as she walks ----------
export const TILE = 32, CHUNK = 256;
// calm on purpose: dark navy panels, the circuits a dim blue (never mint: mint is an XP chip), nothing that blinks
const FLOOR = {
  base: '#121733', light: '#1a2146', lighter: '#232b59', dark: '#0d1128', gap: '#090c1f',
  vent: '#0a0e24', trace: '#19254a', traceHi: '#213262', node: '#263a6e', stripe: '#1f1d3f', led: '#2c3a72', ledR: '#3a2a5e',
};
function tileCanvas(kind) {
  const c = mk(TILE, TILE), g = c.getContext('2d');
  const f = (col, x, y, w = 1, h = 1) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  f(FLOOR.base, 0, 0, TILE, TILE);
  // a raised panel: lit edge top-left, shade bottom-right, a gap around it
  f(FLOOR.light, 1, 1, TILE - 2, 1); f(FLOOR.light, 1, 1, 1, TILE - 2);
  f(FLOOR.dark, 1, TILE - 2, TILE - 2, 1); f(FLOOR.dark, TILE - 2, 1, 1, TILE - 2);
  f(FLOOR.gap, 0, TILE - 1, TILE, 1); f(FLOOR.gap, TILE - 1, 0, 1, TILE);
  if (kind === 0) {
    // plain, with its four screws
    for (const [x, y] of [[3, 3], [TILE - 5, 3], [3, TILE - 5], [TILE - 5, TILE - 5]]) { f(FLOOR.lighter, x, y); f(FLOOR.dark, x + 1, y + 1); }
  } else if (kind === 1) {
    // a perforated vent
    f(FLOOR.dark, 6, 6, TILE - 12, TILE - 12);
    for (let y = 8; y < TILE - 8; y += 3) for (let x = 8; x < TILE - 8; x += 3) f(FLOOR.vent, x, y, 2, 2);
    f(FLOOR.light, 6, TILE - 7, TILE - 12, 1);
  } else if (kind === 2) {
    // circuit traces with their nodes
    f(FLOOR.trace, 4, 10, 14, 1); f(FLOOR.trace, 17, 10, 1, 12); f(FLOOR.trace, 17, 21, 11, 1);
    f(FLOOR.trace, 8, 4, 1, 7); f(FLOOR.trace, 4, 25, 9, 1); f(FLOOR.trace, 12, 15, 1, 11);
    f(FLOOR.traceHi, 4, 10, 3, 1); f(FLOOR.traceHi, 25, 21, 3, 1);
    for (const [x, y] of [[3, 9], [16, 20], [7, 3], [11, 14], [27, 20]]) f(FLOOR.node, x, y, 3, 3);
    f(FLOOR.lighter, 3, 9); f(FLOOR.lighter, 16, 20);
  } else if (kind === 3) {
    // a cable cover with hazard stripes
    f(FLOOR.dark, 2, 11, TILE - 4, 10);
    for (let x = 2; x < TILE - 2; x++) for (let y = 12; y < 20; y++) if (((x + y) >> 2) % 2 === 0) f(FLOOR.stripe, x, y);
    f(FLOOR.light, 2, 11, TILE - 4, 1);
  } else if (kind === 4) {
    // a status panel with little lights
    f(FLOOR.dark, 5, 5, TILE - 10, TILE - 10);
    f(FLOOR.vent, 7, 7, TILE - 14, 2);
    for (let i = 0; i < 4; i++) f(i === 2 ? FLOOR.ledR : FLOOR.led, 8 + i * 4, 13, 2, 2);
    f(FLOOR.light, 5, TILE - 6, TILE - 10, 1);
  }
  return c;
}
const hash2 = (x, y) => {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
export function createFloor() {
  const tiles = [0, 1, 2, 3, 4].map(tileCanvas);
  const chunks = new Map();
  const kindAt = (tx, ty) => {
    // a landing pad of plain panels where she starts
    if (Math.abs(tx) <= 1 && Math.abs(ty) <= 1) return 0;
    const r = hash2(tx, ty);
    return r < 0.66 ? 0 : r < 0.8 ? 2 : r < 0.94 ? 1 : r < 0.98 ? 3 : 4;
  };
  return {
    // the chunk at chunk coords (cx, cy): a canvas of CHUNK × CHUNK
    chunk(cx, cy) {
      const key = `${cx},${cy}`;
      let c = chunks.get(key);
      if (c) { chunks.delete(key); chunks.set(key, c); return c; }
      c = mk(CHUNK, CHUNK);
      const g = c.getContext('2d');
      const n = CHUNK / TILE;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) g.drawImage(tiles[kindAt(cx * n + x, cy * n + y)], x * TILE, y * TILE);
      chunks.set(key, c);
      while (chunks.size > 40) chunks.delete(chunks.keys().next().value);
      return c;
    },
  };
}
// ---------- pixel digits (3 × 5) with an ink edge, in a few colours ----------
const DIGITS = {
  0: ['###', '#.#', '#.#', '#.#', '###'], 1: ['.#.', '##.', '.#.', '.#.', '###'], 2: ['###', '..#', '###', '#..', '###'],
  3: ['###', '..#', '.##', '..#', '###'], 4: ['#.#', '#.#', '###', '..#', '..#'], 5: ['###', '#..', '###', '..#', '###'],
  6: ['###', '#..', '###', '#.#', '###'], 7: ['###', '..#', '..#', '.#.', '.#.'], 8: ['###', '#.#', '###', '#.#', '###'],
  9: ['###', '#.#', '###', '..#', '###'], '+': ['...', '.#.', '###', '.#.', '...'],
};
function buildDigits(colors) {
  const out = {};
  for (const [name, col] of Object.entries(colors)) {
    out[name] = {};
    for (const [d, rows] of Object.entries(DIGITS)) {
      const c = mk(5, 7), g = c.getContext('2d');
      g.fillStyle = '#170a36';
      for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) if (rows[y][x] === '#') {
        for (const [dx, dy] of [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2], [1, 1]]) g.fillRect(x + dx, y + dy, 1, 1);
      }
      g.fillStyle = col;
      for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) if (rows[y][x] === '#') g.fillRect(x + 1, y + 1, 1, 1);
      out[name][d] = c;
    }
  }
  return out;
}

// ---------- a sprite as a picture (for the DOM: cards, the HUD row, the shop) ----------
export function spriteURL(name, scale = 4) {
  const rows = SPRITES[name];
  if (!rows) return '';
  const { buf, w, h } = pixels(rows, { scale });
  const c = mk(w, h);
  const g = c.getContext('2d');
  const img = g.createImageData(w, h);
  img.data.set(buf);
  g.putImageData(img, 0, 0);
  return c.toDataURL('image/png');
}

export function buildArt() {
  const { atlas, frames } = buildAtlas();
  const shadows = [ellipseSprite(5, 2, '#05030f', 0.4), ellipseSprite(8, 3, '#05030f', 0.4), ellipseSprite(12, 4, '#05030f', 0.4), ellipseSprite(20, 6, '#05030f', 0.42)];
  const glow = {};
  for (const [name, col] of Object.entries({ mint: '#3ff0c3', honey: '#ffc933', pink: '#ff4da6', violet: '#8b66ff', red: '#ff5a5f', white: '#fff6e0', sky: '#59c8ff' })) {
    glow[name] = [4, 7, 11, 16, 24].map((r) => glowSprite(r, col));
  }
  const digits = buildDigits({ white: '#fffaf0', crit: '#ffc933', hurt: '#ff5a5f', heal: '#3ff0c3', tick: '#b9a2ff' });
  return { atlas, frames, shadows, glow, digits, floor: createFloor() };
}
