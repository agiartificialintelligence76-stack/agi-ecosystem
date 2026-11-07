// HALLUCINATION (2026-11-08): the ten places AGI-1 remembers, each a picture-book page of 400 × 300: its palettes (6 to 8
// colors each, plus its ink), its background (walls, floors, skies, the sea, a skyline…), and how it's set (`compose`: what
// stands where, in what order, which surfaces and walls a hallucination may add something to). Backgrounds draw from the
// scene's own background seed, so both pictures share every detail of them.
import { rr, el, ci, poly, fill, ink, line, glow, pattern, heartPath, starPath, TAU, darker, lighter, rgbaHex, W, H } from './paint.js';
import { rng } from '../kit/fx.js';
import { cloudShape } from './objects-home.js';

const BASE = { cream: '#fff6ea', metal: '#cfc8dc', coffee: '#6b4430', tape: 'rgba(255,240,205,0.82)', leaf: '#6cbf7a', honey: '#ffc933', wood: '#b98256', trim: '#fffaf0' };
const P = (o) => Object.freeze({ ...BASE, ...o });

// ---------- backgrounds ----------
function wallpaper(ctx, x0, y0, x1, y1, color, kind, seed = 1) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip();
  ctx.fillStyle = color; ctx.strokeStyle = color;
  if (kind === 'dots') { for (let y = y0 + 8, k = 0; y < y1; y += 16, k++) for (let x = x0 + (k % 2 ? 8 : 0); x < x1 + 8; x += 16) { ci(ctx, x, y, 1.8); ctx.fill(); } }
  else if (kind === 'stripes') { for (let x = x0; x < x1; x += 22) ctx.fillRect(x, y0, 9, y1 - y0); }
  else if (kind === 'stars') { const r = rng(seed); for (let y = y0 + 10, k = 0; y < y1; y += 22, k++) for (let x = x0 + (k % 2 ? 11 : 0); x < x1 + 10; x += 22) { starPath(ctx, x + r.range(-2, 2), y + r.range(-2, 2), 3.2, 4, 0.4); ctx.fill(); } }
  else if (kind === 'hearts') { for (let y = y0 + 12, k = 0; y < y1; y += 24, k++) for (let x = x0 + (k % 2 ? 12 : 0); x < x1 + 12; x += 24) { heartPath(ctx, x, y, 2.8); ctx.fill(); } }
  else if (kind === 'tiles') { ctx.lineWidth = 1; for (let y = y0; y < y1; y += 15) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); } for (let y = y0, k = 0; y < y1; y += 15, k++) for (let x = x0 + (k % 2 ? 11 : 0); x < x1; x += 22) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 15); ctx.stroke(); } }
  else if (kind === 'diamonds') { for (let y = y0 + 10, k = 0; y < y1; y += 18, k++) for (let x = x0 + (k % 2 ? 10 : 0); x < x1 + 10; x += 20) { poly(ctx, [x, y - 4, x + 3, y, x, y + 4, x - 3, y]); ctx.fill(); } }
  ctx.restore();
}
function planks(ctx, y0, a, b) {
  ctx.fillStyle = a; ctx.fillRect(0, y0, W, H - y0);
  ctx.strokeStyle = b; ctx.lineWidth = 1.4;
  let y = y0, k = 0, h = 10;
  while (y < H) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    for (let x = (k * 53) % 90 + 20; x < W; x += 90 + (k % 3) * 14) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2, y + h); ctx.stroke(); }
    y += h; h *= 1.22; k++;
  }
}
function checks(ctx, y0, a, b) {
  ctx.fillStyle = a; ctx.fillRect(0, y0, W, H - y0);
  ctx.fillStyle = b;
  let y = y0, h = 9, k = 0;
  while (y < H) {
    const w = h * 1.6;
    for (let x = (k % 2 ? w : 0) - w; x < W; x += w * 2) { poly(ctx, [x, y, x + w, y, x + w + (x - 200) * 0.03, y + h, x + (x - 200) * 0.03, y + h]); ctx.fill(); }
    y += h; h *= 1.18; k++;
  }
}
function skyGrad(ctx, y0, y1, c1, c2) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, c1); g.addColorStop(1, c2);
  ctx.fillStyle = g; ctx.fillRect(0, y0, W, y1 - y0);
}
function softLight(ctx, x, y, r, color, a = 0.25) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgbaHex(color, a)); g.addColorStop(1, rgbaHex(color, 0));
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
function baseboard(ctx, S, y, color) { rr(ctx, -2, y, W + 4, 8, 0); ctx.fillStyle = color; ctx.fill(); ink(ctx, S, 0.8); }
function hill(ctx, S, y, amp, color, phase = 0, outline = true) {
  ctx.beginPath(); ctx.moveTo(-4, H + 4); ctx.lineTo(-4, y);
  for (let x = 0; x <= W + 8; x += 8) ctx.lineTo(x, y - Math.sin((x / W) * Math.PI * 1.6 + phase) * amp - Math.sin((x / W) * Math.PI * 4.2 + phase * 2) * amp * 0.25);
  ctx.lineTo(W + 4, H + 4); ctx.closePath();
  ctx.fillStyle = color; ctx.fill();
  if (outline) ink(ctx, S, 0.8);
}
function skyline(ctx, S, seed, y, h0, h1, color, win, lit = 0.35, outline = false) {
  const r = rng(seed);
  for (let x = -6; x < W + 6;) {
    const w = r.int(26, 46), h = r.int(h0, h1);
    rr(ctx, x, y - h, w, h + 2, 0); ctx.fillStyle = color; ctx.fill();
    if (outline) ink(ctx, S, 0.6);
    if (r.chance(0.3)) { rr(ctx, x + w / 2 - 2, y - h - 8, 4, 8, 0); ctx.fill(); }
    if (win) for (let wy = y - h + 7; wy < y - 6; wy += 9) for (let wx = x + 5; wx < x + w - 5; wx += 8) if (r.chance(lit)) { ctx.fillStyle = win; ctx.fillRect(wx, wy, 3.6, 4.6); ctx.fillStyle = color; }
    x += w + r.int(0, 3);
  }
}
function vignette(ctx, a = 0.18, color = '#1a0f24') {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, W * 0.66);
  g.addColorStop(0, rgbaHex(color, 0)); g.addColorStop(1, rgbaHex(color, a));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function waves(ctx, y0, y1, color, seed) {
  const r = rng(seed);
  ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  for (let y = y0 + 6; y < y1; y += 9) for (let x = r.range(0, 30); x < W; x += r.range(40, 70)) { ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 5, y - 3, x + 10, y); ctx.quadraticCurveTo(x + 15, y + 3, x + 20, y); ctx.stroke(); }
}
function starfield(ctx, seed, x0, y0, x1, y1, n, color = '#fff6d6') {
  const r = rng(seed);
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) { const x = r.range(x0, x1), y = r.range(y0, y1), s = r.range(0.5, 1.5); ctx.globalAlpha = r.range(0.4, 1); ci(ctx, x, y, s); ctx.fill(); }
  ctx.globalAlpha = 1;
}

// ---------- the places ----------
const ROOM_ADDS = { wall: ['poster', 'frame', 'clock'], floor: ['plant', 'plushie', 'books', 'sneakers', 'cat', 'catbed', 'guitar', 'floorlamp', 'chair'], table: ['mug', 'books', 'succulent', 'plushie', 'cactus', 'fishbowl', 'vase', 'teapot', 'desklamp'] };

export const TEMPLATES = {
  bedroom: {
    name: 'bedroom',
    palettes: [
      P({ id: 'peach', wall: '#f7dccb', wall2: '#efcab2', wp: 'dots', floor: '#c98f63', floor2: '#b37a51', trim: '#fff3e4', ink: '#3b2335', wood: '#b98256', acc: ['#e86a7d', '#f2a65a', '#f7d06b', '#6cbf9a', '#6f9fd8', '#9b7bd4', '#fff1e0'], leaves: ['#6cbf7a', '#4f9d63', '#8fcf6a'], view: 'dusk', warm: true }),
      P({ id: 'mint', wall: '#d9efe3', wall2: '#cbe6d7', wp: 'stripes', floor: '#dcb68f', floor2: '#c79f78', trim: '#ffffff', ink: '#263238', wood: '#c99a6b', acc: ['#ff8a80', '#ffc66d', '#7ec8e3', '#b39ddb', '#f48fb1', '#81c784', '#fffaf0'], leaves: ['#5fb36e', '#3f8f6a', '#8fcf6a'], view: 'day' }),
      P({ id: 'night', wall: '#c9bde6', wall2: '#bcaedf', wp: 'stars', floor: '#8f739e', floor2: '#7a6190', trim: '#efe8ff', ink: '#241a3a', wood: '#a7826e', acc: ['#ff8fb1', '#ffd45c', '#7fd6c2', '#8fb8ff', '#c9a7ff', '#ff9f68', '#fff6ea'], leaves: ['#6cbf7a', '#4f9d63'], view: 'night', night: true }),
    ],
    compose(c) {
      const { r } = c; const m = r.chance(0.5); const X = (x) => (m ? W - x : x);
      c.add('window', X(306), 90, { s: 0.94, z: 100 });
      c.add(r.pick(['bunting', 'lights']), X(150), 10, { opt: { w: 168 }, z: 112 });
      const pics = r.shuffle(['poster', 'frame', 'clock', 'poster', 'frame']);
      c.add(pics[0], X(112), 74, { z: 101 }); c.add(pics[1] === pics[0] ? 'clock' : pics[1], X(176), 70, { z: 102 });
      if (r.chance(0.6)) c.add('clock', X(228), 56, { s: 0.9, z: 103 });
      const sh = c.add('shelf', X(150), 132, { opt: { w: 96 }, z: 104 });
      c.row(c.top(sh, { types: ROOM_ADDS.table, s: [0.85, 1] }), r.shuffle(['books', 'succulent', 'plushie', 'cactus', 'mug', 'fishbowl']).slice(0, r.int(2, 3)));
      c.add('rug', X(212), 286, { z: 200 });
      const bed = c.add('bed', X(162), 274, { flip: m, z: 300 + 274 });
      if (r.chance(0.7)) c.row(c.top(bed, { types: ['plushie', 'books'] }), [r.chance(0.55) ? { type: 'cat', opt: { pose: r.pick(['loaf', 'curl']) } } : r.pick(['plushie', 'laptop'])]);
      const ns = c.add('nightstand', X(40), 272, { z: 300 + 272 });
      c.row(c.top(ns, { types: ['mug', 'succulent', 'books', 'desklamp'], s: [0.82, 0.9] }), [r.pick(['desklamp', 'desklamp', 'succulent', 'fishbowl'])], { pad: 0 });
      const right = c.surface(Math.min(X(254), X(394)), Math.max(X(254), X(394)), 280, { z: 300 + 280, types: ROOM_ADDS.floor });
      const placed = c.row(right, r.shuffle(['plant', r.pick(['guitar', 'chair', 'floorlamp', 'bookshelf']), r.pick(['catbed', 'catbed', 'plushie'])]), { pad: 8 });
      for (const o of placed) if (o.type === 'catbed') c.add('cat', o.x, o.y - 7 * o.s, { s: o.s * 0.92, opt: { pose: 'curl' }, z: o.z + 0.5, parent: o, flip: 'rand' });
      const front = c.surface(Math.min(X(96), X(236)), Math.max(X(96), X(236)), 296, { z: 300 + 296, types: ['sneakers', 'books', 'plushie', 'cat'] });
      c.row(front, r.shuffle(['sneakers', r.pick(['books', 'cat', 'plushie'])]).slice(0, r.int(1, 2)), { pad: 30 });
      c.region(8, 28, 392, 112, { types: ROOM_ADDS.wall, z: 105 });
      return { m };
    },
    paint(ctx, sc, S, layer) {
      const p = sc.pal;
      if (layer === 'fg') { vignette(ctx, p.night ? 0.28 : 0.16); return; }
      if (layer !== 0) return;
      ctx.fillStyle = p.wall; ctx.fillRect(0, 0, W, 200);
      wallpaper(ctx, 0, 0, W, 200, p.wall2, p.wp, sc.bg);
      planks(ctx, 204, p.floor, p.floor2);
      baseboard(ctx, S, 196, p.trim);
      softLight(ctx, sc.layout.m ? 94 : 306, 250, 150, p.night ? '#ffd27a' : '#ffffff', p.night ? 0.12 : 0.22);
    },
  },

  agiroom: {
    name: 'her room',
    palettes: [
      P({ id: 'lilac', wall: '#ebe2ff', wall2: '#ddd0ff', wp: 'hearts', floor: '#b9a3ef', floor2: '#a48ce2', trim: '#fffaf0', ink: '#2a1846', wood: '#b48ad8', acc: ['#ff7eb6', '#8b66ff', '#ffc933', '#4fd8b5', '#6fb7ff', '#ff9f68', '#fffaf0'], neon: ['#ff4da6', '#8b66ff', '#3ff0c3', '#ffc933', '#59c8ff'], desk: ['#fffaf0', '#f6efff'], leaves: ['#5fc49a', '#4fae6a'], view: 'day' }),
      P({ id: 'stream', wall: '#3b2b70', wall2: '#33265f', wp: 'diamonds', floor: '#2d2257', floor2: '#261c4b', trim: '#5c48a3', ink: '#120a2a', wood: '#7b5fc4', acc: ['#ff7eb6', '#b39bff', '#ffc933', '#4fd8b5', '#6fb7ff', '#ff9f68', '#fffaf0'], neon: ['#ff4da6', '#b39bff', '#3ff0c3', '#ffc933', '#59c8ff'], desk: ['#e9e0ff', '#fffaf0'], leaves: ['#5fc49a', '#4fae6a'], view: 'night', night: true, plate: '#1c1438' }),
    ],
    compose(c) {
      const { r } = c; const m = r.chance(0.5); const X = (x) => (m ? W - x : x);
      c.add('ledstrip', 200, 6, { opt: { w: 396 }, z: 150 });
      c.add('window', X(336), 98, { s: 0.9, z: 100 });
      c.add('neon', X(176), 56, { z: 101 });
      c.add(r.pick(['poster', 'poster', 'frame']), X(62), 66, { z: 102 });
      c.add(r.pick(['clock', 'poster', 'frame']), X(250), 58, { s: 0.92, z: 103 });
      const sh = c.add('shelf', X(66), 140, { opt: { w: 86 }, z: 104 });
      c.row(c.top(sh, { types: ROOM_ADDS.table, s: [0.85, 1] }), r.shuffle(['plushie', 'books', 'succulent', 'cactus', 'headphones']).slice(0, r.int(2, 3)));
      c.add('rug', X(250), 290, { z: 200 });
      const desk = c.add('desk', X(186), 266, { opt: { w: 150 }, z: 300 + 266 });
      c.row(c.top(desk, { types: ['mug', 'plushie', 'succulent', 'books', 'headphones'], s: [0.9, 1] }), ['monitor', 'mic', r.pick(['mug', 'plushie', 'succulent', 'headphones'])], { pad: 6 });
      c.add('gamerchair', X(92), 292, { z: 300 + 292 });
      const right = c.surface(Math.min(X(272), X(394)), Math.max(X(272), X(394)), 290, { z: 300 + 290, types: ROOM_ADDS.floor });
      const placed = c.row(right, r.shuffle(['catbed', r.pick(['plushie', 'guitar', 'sneakers', 'plant'])]), { pad: 8 });
      for (const o of placed) if (o.type === 'catbed') c.add('cat', o.x, o.y - 7 * o.s, { s: o.s * 0.92, opt: { pose: r.pick(['curl', 'loaf']) }, z: o.z + 0.5, parent: o, flip: 'rand' });
      c.region(8, 24, 392, 104, { types: ROOM_ADDS.wall, z: 105 });
      return { m };
    },
    paint(ctx, sc, S, layer) {
      const p = sc.pal;
      if (layer === 'fg') { vignette(ctx, p.night ? 0.3 : 0.14); return; }
      if (layer !== 0) return;
      ctx.fillStyle = p.wall; ctx.fillRect(0, 0, W, 210);
      wallpaper(ctx, 0, 0, W, 210, p.wall2, p.wp, sc.bg);
      ctx.fillStyle = p.floor; ctx.fillRect(0, 214, W, H - 214);
      ctx.strokeStyle = p.floor2; ctx.lineWidth = 1.2;
      for (let y = 222; y < H; y += 8 + (y - 214) * 0.12) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      baseboard(ctx, S, 206, p.trim);
      if (p.night) { softLight(ctx, 200, 30, 220, '#ff4da6', 0.12); softLight(ctx, sc.layout.m ? 224 : 176, 210, 120, '#8fb8ff', 0.16); }
      else softLight(ctx, sc.layout.m ? 64 : 336, 240, 160, '#ffffff', 0.25);
    },
  },

  cafe: {
    name: 'café',
    palettes: [
      P({ id: 'latte', wall: '#f5e6d0', wall2: '#ecd9bd', wp: 'none', lower: '#8a5a44', lower2: '#784b37', floor: '#efe2cc', floor2: '#d8c3a5', trim: '#fff7ea', ink: '#3b2620', wood: '#a8714f', acc: ['#e07a5f', '#81b29a', '#f2cc8f', '#6d7fc7', '#f4a6b7', '#7fb8d6', '#fff6e6'], frost: ['#ffb3cf', '#fff4c9', '#c8f0dc', '#8a5a44'], view: 'day', warm: true }),
      P({ id: 'evening', wall: '#ead2c4', wall2: '#e0c4b3', wp: 'diamonds', lower: '#3f6b5c', lower2: '#355c4f', floor: '#e3d3c0', floor2: '#c9b296', trim: '#fdf3e6', ink: '#2e211f', wood: '#8f5f45', acc: ['#e07a5f', '#9fd8b8', '#f2cc8f', '#8f9be0', '#f4a6b7', '#ffd27a', '#fff6e6'], lights: ['#ffd45c', '#ff8fb1', '#ffffff'], view: 'night', night: true }),
    ],
    compose(c) {
      const { r } = c; const m = r.chance(0.5); const X = (x) => (m ? W - x : x);
      const night = c.pal.night;
      c.add('chalkboard', X(78), 86, { z: 100 });
      c.add('window', X(322), 98, { s: 0.92, z: 101 });
      if (night) c.add('lights', 200, 8, { opt: { w: 380 }, z: 150 });
      else { c.add('pendant', X(176), 0, { opt: { len: 16 }, z: 150 }); c.add('pendant', X(236), 0, { opt: { len: 26 }, z: 151 }); }
      c.add(r.pick(['frame', 'poster', 'neon', 'clock']), X(206), r.int(88, 100), { z: 102 });
      if (!night && r.chance(0.5)) c.add('wallplant', X(128), 4, { z: 103, s: 0.9 });
      const counter = c.surface(Math.min(X(8), X(150)), Math.max(X(8), X(150)), 170, { z: 250, types: ['cake', 'pastry', 'mug', 'teapot', 'jar', 'vase', 'succulent'] });
      c.row(counter, r.shuffle(['cake', 'pastry', r.pick(['teapot', 'jar']), 'mug', 'pastry']).slice(0, r.int(3, 4)), { pad: 5 });
      const tb = c.add('table', X(270), 284, { opt: { w: 70, h: 42, cloth: r.chance(0.5) }, z: 300 + 284 });
      c.add('chair', X(220), 288, { flip: m, z: 300 + 286 });
      c.add('chair', X(320), 288, { flip: !m, z: 300 + 286 });
      c.row(c.top(tb, { types: ['mug', 'pastry', 'vase', 'teapot', 'succulent'] }), r.shuffle(['mug', r.pick(['mug', 'laptop']), r.pick(['pastry', 'vase', 'teapot'])]), { pad: 4 });
      c.row(c.surface(Math.min(X(150), X(196)), Math.max(X(150), X(196)), 292, { z: 300 + 292, types: ['cat', 'plushie', 'plant'] }), [r.chance(0.7) ? 'cat' : 'plant']);
      c.add('plant', X(380), 290, { s: 0.9, z: 300 + 290 });
      c.region(130, 30, 270, 140, { types: ['frame', 'poster', 'clock'], z: 105 });
      return { m };
    },
    paint(ctx, sc, S, layer) {
      const p = sc.pal, m = sc.layout.m;
      if (layer === 'fg') { vignette(ctx, p.night ? 0.26 : 0.15); return; }
      if (layer !== 0) return;
      ctx.fillStyle = p.wall; ctx.fillRect(0, 0, W, 214);
      wallpaper(ctx, 0, 0, W, 156, p.wall2, p.wp, sc.bg);
      ctx.fillStyle = p.lower; ctx.fillRect(0, 156, W, 60);
      ctx.strokeStyle = p.lower2; ctx.lineWidth = 2;
      for (let x = 10; x < W; x += 26) { rr(ctx, x, 166, 18, 40, 2); ctx.stroke(); }
      rr(ctx, -2, 152, W + 4, 6, 0); ctx.fillStyle = p.trim; ctx.fill(); ink(ctx, S, 0.7);
      checks(ctx, 214, p.floor, p.floor2);
      rr(ctx, -2, 212, W + 4, 4, 0); ctx.fillStyle = p.lower2; ctx.fill();
      // the counter
      const x0 = m ? 250 : -4, x1 = m ? 404 : 150;
      rr(ctx, x0, 172, x1 - x0, 92, 0); ctx.fillStyle = p.wood; ctx.fill(); ink(ctx, S);
      ctx.strokeStyle = darker(p.wood, 0.18); ctx.lineWidth = 1.4;
      for (let x = x0 + 14; x < x1 - 6; x += 24) { rr(ctx, x, 186, 16, 64, 2); ctx.stroke(); }
      rr(ctx, x0 - 2, 166, x1 - x0 + 4, 8, 2); ctx.fillStyle = lighter(p.wood, 0.25); ctx.fill(); ink(ctx, S);
      if (p.night) softLight(ctx, 200, 40, 220, '#ffd27a', 0.18); else softLight(ctx, m ? 78 : 322, 240, 170, '#ffffff', 0.22);
    },
  },

  kitchen: {
    name: 'kitchen',
    palettes: [
      P({ id: 'mint', wall: '#e7f3ee', wall2: '#cfe3da', wp: 'tiles', cab: '#7fb7a4', cab2: '#6aa391', top: '#d9b48a', floor: '#f1e6d4', floor2: '#dccab0', trim: '#fffaf0', ink: '#2c3a37', wood: '#c99a6b', acc: ['#e2574c', '#f4c84e', '#3e8e8a', '#f6a6a6', '#7aa7e0', '#fff6e6', '#9cc95a'], fridge: ['#bfe6f5', '#fff4c9', '#ffd6e0', '#fffaf0'], view: 'day' }),
      P({ id: 'butter', wall: '#fff2d2', wall2: '#f2deb0', wp: 'tiles', cab: '#e98b6d', cab2: '#d6795c', top: '#f4eee6', floor: '#cfe3dc', floor2: '#b6d0c6', trim: '#fffaf0', ink: '#3a2a2a', wood: '#c99a6b', acc: ['#e2574c', '#3e8e8a', '#7aa7e0', '#f4c84e', '#9b7bd4', '#fff6e6', '#9cc95a'], fridge: ['#bfe6f5', '#c8f0dc', '#e4d9ff', '#fffaf0'], view: 'day' }),
    ],
    compose(c) {
      const { r } = c; const m = r.chance(0.5); const X = (x) => (m ? W - x : x);
      c.add('window', X(150), 80, { s: 0.92, z: 100 });
      c.add('clock', X(40), 50, { z: 101 });
      const sh = c.add('shelf', X(266), 104, { opt: { w: 84 }, z: 102 });
      c.row(c.top(sh, { types: ['mug', 'jar', 'succulent', 'books', 'teapot'], s: [0.85, 0.95] }), r.shuffle(['mug', 'jar', 'succulent', 'mug', 'books']).slice(0, r.int(2, 3)));
      const counter = c.surface(Math.min(X(6), X(316)), Math.max(X(6), X(316)), 190, { z: 250, types: ['mug', 'jar', 'succulent', 'fruitbowl', 'teapot', 'vase', 'toaster', 'cookpot', 'cake'] });
      c.row(counter, r.shuffle(['toaster', 'teapot', 'fruitbowl', 'cookpot', 'jar', 'cake', 'vase', 'mug']).slice(0, r.int(4, 5)), { pad: 6 });
      c.add('fridge', X(358), 290, { z: 300 + 290 });
      c.add('rug', X(150), 290, { s: 0.75, z: 200 });
      c.row(c.surface(Math.min(X(40), X(300)), Math.max(X(40), X(300)), 292, { z: 300 + 292, types: ['cat', 'plushie', 'plant'] }), r.shuffle([r.chance(0.75) ? 'cat' : 'plushie', r.chance(0.5) ? 'plant' : null]).filter(Boolean), { pad: 20 });
      c.region(8, 26, 318, 150, { types: ['clock', 'frame', 'poster'], z: 105 });
      return { m };
    },
    paint(ctx, sc, S, layer) {
      const p = sc.pal, m = sc.layout.m;
      if (layer === 'fg') { vignette(ctx, 0.14); return; }
      if (layer !== 0) return;
      ctx.fillStyle = p.wall; ctx.fillRect(0, 0, W, 196);
      wallpaper(ctx, 0, 0, W, 196, p.wall2, p.wp, sc.bg);
      checks(ctx, 262, p.floor, p.floor2);
      const x0 = m ? 80 : -4, x1 = m ? 404 : 320;
      rr(ctx, x0, 194, x1 - x0, 70, 0); ctx.fillStyle = p.cab; ctx.fill(); ink(ctx, S);
      for (let x = x0 + 8; x < x1 - 30; x += 50) {
        rr(ctx, x, 204, 42, 52, 3); ctx.fillStyle = p.cab2; ctx.fill(); ink(ctx, S, 0.7);
        rr(ctx, x + 17, 210, 8, 3, 1.5); ctx.fillStyle = BASE.honey; ctx.fill(); ink(ctx, S, 0.6);
      }
      rr(ctx, x0 - 2, 188, x1 - x0 + 4, 8, 2); ctx.fillStyle = p.top; ctx.fill(); ink(ctx, S);
      softLight(ctx, m ? 250 : 150, 200, 160, '#ffffff', 0.22);
    },
  },

  park: {
    name: 'park',
    palettes: [
      P({ id: 'spring', sky1: '#8fd3f4', sky2: '#e3f6fd', far: '#c3e6ad', hill: '#a3d48d', grass: '#8ccf7e', grass2: '#7cc06e', path: '#f1deb6', ink: '#2b3a2c', wood: '#b98256', acc: ['#ff8fb1', '#ffd45c', '#7ec8e3', '#b39ddb', '#ff9f68', '#fffaf0', '#e2574c'], leaves: ['#6cbf7a', '#5aa86a', '#8fcf6a'], view: 'day' }),
      P({ id: 'autumn', sky1: '#ffc89a', sky2: '#fff1dc', far: '#ecd09a', hill: '#e2bf7e', grass: '#cdbb72', grass2: '#bba862', path: '#f3e2c4', ink: '#3a2a22', wood: '#9a6b45', acc: ['#e2574c', '#ffd45c', '#7ec8e3', '#b39ddb', '#ff8fb1', '#fffaf0', '#6d7fc7'], leaves: ['#f0a050', '#e2774c', '#f4c84e', '#c9653f'], view: 'dusk', warm: true }),
      P({ id: 'winter', sky1: '#c3d8f2', sky2: '#f4f8ff', far: '#e8eef8', hill: '#dfe7f4', grass: '#f6f8ff', grass2: '#e1e8f4', path: '#dce3ef', ink: '#26324a', wood: '#9a6b45', acc: ['#e2574c', '#ffd45c', '#59c8ff', '#9b7bd4', '#ff8fb1', '#2f9e6e'], leaves: ['#4f8f7a', '#5f9a7a', '#3f7f6a'], view: 'day', snow: true }),
    ],
    compose(c) {
      const { r } = c; const m = r.chance(0.5); const X = (x) => (m ? W - x : x);
      const snow = c.pal.snow;
      if (r.chance(0.7)) c.add(r.chance(0.8) ? 'sun' : 'moon', X(r.int(44, 80)), r.int(34, 46), { s: 0.9, z: 50 });
      const cl = r.shuffle([[140, 40], [236, 30], [330, 52], [190, 70]]).slice(0, r.int(2, 3));
      cl.forEach(([x, y], i) => c.add('cloud', X(x), y, { s: r.range(0.8, 1.05), z: 52 + i }));
      if (r.chance(0.6)) c.add(r.pick(['kite', 'balloon']), X(r.int(280, 340)), r.int(64, 84), { s: 0.9, z: 60 });
      c.add('bird', X(r.int(110, 210)), r.int(92, 112), { opt: { pose: 'fly' }, z: 61, flip: 'rand' });
      c.add('house', X(260), 176, { s: 0.62, z: 200 });
      c.add('fence', X(150), 210, { s: 0.85, z: 210 });
      c.add('tree', X(46), 214, { s: 0.95, z: 300 + 214, p: { kind: snow ? 'pine' : r.pick(['round', 'round', 'pine']) } });
      c.add('tree', X(352), 206, { s: 0.85, z: 300 + 206, p: { kind: snow ? 'pine' : r.pick(['round', 'pine']) } });
      const bench = c.add('bench', X(206), 248, { z: 300 + 248 });
      if (r.chance(0.65)) c.row(c.top(bench, { types: ['bird', 'books', 'plushie'] }), [r.pick(['cat', 'bird', 'plushie', 'icecream'])]);
      c.add('streetlamp', X(292), 246, { s: 0.92, z: 300 + 246 });
      c.add(snow ? 'snowman' : 'bush', X(118), 246, { z: 300 + 246 });
      c.add(r.pick(['sign', 'mailbox']), X(330), 252, { s: 0.9, z: 300 + 252, flip: 'rand' });
      const front = c.surface(6, 394, 292, { z: 300 + 292, types: snow ? ['snowman', 'cat', 'bird', 'cone'] : ['flowers', 'cat', 'bird', 'bush', 'bicycle'] });
      c.row(front, snow ? r.shuffle(['bush', 'cat', 'bicycle']) : r.shuffle(['flowers', 'flowers', r.pick(['bicycle', 'cat', 'bicycle']), 'bush']).slice(0, 3), { pad: 14 });
      c.region(10, 14, 390, 118, { types: ['cloud', 'bird', 'balloon', 'kite'], z: 70 });
      return { m };
    },
    paint(ctx, sc, S, layer) {
      const p = sc.pal, m = sc.layout.m;
      if (layer === 'fg') { vignette(ctx, 0.12, '#203040'); return; }
      if (layer !== 0) return;
      skyGrad(ctx, 0, 210, p.sky1, p.sky2);
      hill(ctx, S, 170, 10, p.far, sc.bg % 7, false);
      hill(ctx, S, 196, 8, p.hill, (sc.bg % 5) + 1);
      ctx.fillStyle = p.grass; ctx.fillRect(0, 214, W, H - 214);
      ctx.strokeStyle = p.grass2; ctx.lineWidth = 1.4;
      const rr0 = rng(sc.bg);
      for (let i = 0; i < 46; i++) { const x = rr0.range(0, W), y = rr0.range(222, H); ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.lineTo(x - 1, y - 4); ctx.moveTo(x + 1, y); ctx.lineTo(x + 3, y - 5); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(m ? 120 : 280, H + 2);
      ctx.bezierCurveTo(m ? 150 : 250, 262, m ? 220 : 180, 244, 200, 222);
      ctx.bezierCurveTo(m ? 214 : 186, 214, m ? 230 : 170, 210, m ? 236 : 164, 206);
      ctx.lineTo(m ? 244 : 156, 206);
      ctx.bezierCurveTo(m ? 236 : 164, 214, m ? 222 : 178, 220, m ? 214 : 186, 228);
      ctx.bezierCurveTo(m ? 194 : 206, 256, m ? 214 : 186, 276, m ? 220 : 180, H + 2);
      ctx.closePath(); ctx.fillStyle = p.path; ctx.fill(); ink(ctx, S, 0.7);
      if (p.snow) { const r2 = rng(sc.bg + 3); ctx.fillStyle = '#ffffff'; for (let i = 0; i < 60; i++) { ci(ctx, r2.range(0, W), r2.range(0, 210), r2.range(0.8, 1.8)); ctx.fill(); } }
    },
  },

  beach: {
    name: 'beach',
    palettes: [
      P({ id: 'noon', sky1: '#7fcff2', sky2: '#e6f7fd', sea: '#3fa9c9', sea2: '#7fcbe0', sand: '#f3d9a4', sand2: '#e5c58a', ink: '#2b3440', wood: '#b98256', acc: ['#ff6f91', '#ffd45c', '#4fb3a8', '#7ec8e3', '#ff9f68', '#fffaf0', '#b39ddb'], view: 'day' }),
      P({ id: 'sunset', sky1: '#ff9f7a', sky2: '#ffe3b8', sea: '#5a7fc0', sea2: '#9cb3e0', sand: '#f0cf9c', sand2: '#deb682', ink: '#3a2440', wood: '#a8714f', acc: ['#ff6f91', '#ffd45c', '#4fb3a8', '#8fb8ff', '#ffffff', '#b39ddb', '#ff9f68'], view: 'dusk', warm: true }),
    ],
    compose(c) {
      const { r } = c; const m = r.chance(0.5); const X = (x) => (m ? W - x : x);
      c.add('sun', X(r.int(250, 300)), c.pal.warm ? 104 : 46, { s: c.pal.warm ? 1.15 : 0.95, z: 40 });
      c.add('cloud', X(r.int(80, 140)), r.int(34, 48), { s: 0.9, z: 52 });
      if (r.chance(0.6)) c.add('cloud', X(r.int(330, 370)), r.int(24, 36), { s: 0.7, z: 53 });
      c.add('gull', X(r.int(150, 210)), r.int(64, 86), { z: 54, flip: 'rand' });
      if (r.chance(0.6)) c.add('gull', X(r.int(200, 240)), r.int(90, 104), { s: 0.8, z: 55, flip: 'rand' });
      c.add('lighthouse', X(364), 192, { s: 0.92, z: 150 });
      c.add('boat', X(r.int(150, 250)), r.int(166, 176), { s: 0.78, z: 160, flip: 'rand' });
      c.add('palm', X(36), 246, { s: 0.88, z: 300 + 246, flip: !m });
      c.add('umbrella', X(116), 262, { z: 300 + 262, flip: m });
      const tw = c.add('towel', X(196), 272, { z: 210 });
      c.row(c.surface(tw.x - 30, tw.x + 30, 274, { z: 300 + 274, types: ['sunglasses', 'icecream', 'bucket', 'books'] }), r.shuffle(['sunglasses', r.pick(['icecream', 'books', 'bucket'])]).slice(0, r.int(1, 2)), { pad: 4 });
      c.add('sandcastle', X(292), 270, { z: 300 + 270 });
      const front = c.surface(10, 390, 294, { z: 300 + 294, types: ['beachball', 'bucket', 'crab', 'icecream'] });
      c.row(front, r.shuffle(['beachball', 'bucket', 'crab', 'crab']).slice(0, 3), { pad: 40 });
      c.region(10, 12, 390, 120, { types: ['cloud', 'gull', 'balloon', 'kite'], z: 70 });
      return { m };
    },
    paint(ctx, sc, S, layer) {
      const p = sc.pal;
      if (layer === 'fg') { vignette(ctx, 0.12, '#203040'); return; }
      if (layer !== 0) return;
      skyGrad(ctx, 0, 132, p.sky1, p.sky2);
      ctx.fillStyle = p.sea; ctx.fillRect(0, 130, W, 74);
      rr(ctx, -2, 128, W + 4, 3, 0); ctx.fillStyle = lighter(p.sea, 0.3); ctx.fill();
      waves(ctx, 134, 196, p.sea2, sc.bg);
      if (p.warm) { ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = '#ffd27a'; for (let y = 136; y < 196; y += 7) ctx.fillRect(W / 2 - 60 + (y % 14) * 2, y, 120 - (y - 136), 2.2); ctx.restore(); }
      ctx.beginPath(); ctx.moveTo(-4, 204); for (let x = 0; x <= W + 8; x += 20) ctx.quadraticCurveTo(x + 10, 198 + (x % 40 ? 4 : -2), x + 20, 202); ctx.lineTo(W + 4, H + 4); ctx.lineTo(-4, H + 4); ctx.closePath();
      ctx.fillStyle = p.sand; ctx.fill(); ink(ctx, S, 0.7);
      ctx.beginPath(); ctx.moveTo(-4, 204); for (let x = 0; x <= W + 8; x += 20) ctx.quadraticCurveTo(x + 10, 198 + (x % 40 ? 4 : -2), x + 20, 202);
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.stroke();
      const r2 = rng(sc.bg + 1); ctx.fillStyle = p.sand2;
      for (let i = 0; i < 70; i++) { ci(ctx, r2.range(0, W), r2.range(212, H), r2.range(0.6, 1.4)); ctx.fill(); }
    },
  },

  city: {
    name: 'street at night',
    palettes: [
      P({ id: 'violet', sky1: '#1b1740', sky2: '#4a3a7a', far: '#2c2654', far2: '#3a3170', win: '#ffd98a', walk: '#4c4374', walk2: '#3f3764', street: '#29233f', ink: '#0f0a22', wood: '#9a6b45', acc: ['#ff6f91', '#ffd45c', '#7fd6c2', '#8fb8ff', '#c9a7ff', '#ff9f68', '#fffaf0'], shops: ['#c97a5e', '#5e7fc9', '#4fa58a', '#a46bc9', '#d9a066'], cars: ['#e2574c', '#ffc933', '#59c8ff', '#7fd6a2', '#ff8fb1', '#fffaf0'], view: 'night', night: true, leaves: ['#4fa58a', '#5fae6a'] }),
      P({ id: 'teal', sky1: '#0e2236', sky2: '#2f5d6e', far: '#1d3a4c', far2: '#264a5c', win: '#ffe3a3', walk: '#3c5866', walk2: '#324b57', street: '#1f2f38', ink: '#081218', wood: '#9a6b45', acc: ['#ff6f91', '#ffd45c', '#7fd6c2', '#8fb8ff', '#ffb36b', '#fffaf0', '#c9a7ff'], shops: ['#c96e5e', '#6c7fd0', '#d9a066', '#b06bc9', '#4fa58a'], cars: ['#e2574c', '#ffc933', '#fffaf0', '#ff8fb1', '#9b7bd4'], view: 'night', night: true, leaves: ['#4fa58a', '#5fae6a'] }),
    ],
    compose(c) {
      const { r } = c; const m = r.chance(0.5); const X = (x) => (m ? W - x : x);
      c.add('moon', X(r.int(320, 360)), r.int(34, 44), { z: 40 });
      c.add('stars', X(r.int(70, 110)), r.int(28, 40), { z: 41 });
      if (r.chance(0.6)) c.add('stars', X(r.int(200, 240)), r.int(22, 34), { s: 0.8, z: 42 });
      c.add('shop', X(102), 216, { s: 0.95, z: 200 });
      c.add('shop', X(298), 216, { s: 0.95, z: 201 });
      c.add('streetlamp', X(200), 238, { s: 0.94, z: 300 + 238 });
      const L = c.surface(Math.min(X(8), X(176)), Math.max(X(8), X(176)), 242, { z: 300 + 242, types: ['mailbox', 'hydrant', 'cone', 'cat', 'sign', 'plant', 'bicycle'] });
      c.row(L, r.shuffle(['mailbox', 'hydrant', 'cat', 'sign', 'plant']).slice(0, 2), { pad: 10 });
      const R = c.surface(Math.min(X(224), X(392)), Math.max(X(224), X(392)), 242, { z: 300 + 242, types: ['mailbox', 'hydrant', 'cone', 'cat', 'sign', 'plant', 'bicycle'] });
      c.row(R, r.shuffle(['bicycle', 'bench', 'sign', 'hydrant', 'cat']).slice(0, 2), { pad: 10 });
      c.add('car', X(r.pick([112, 136])), 294, { z: 300 + 294, flip: r.chance(0.5) });
      c.add('cone', X(r.int(300, 340)), 294, { z: 300 + 294 });
      c.region(10, 10, 390, 96, { types: ['moon', 'stars', 'comet', 'balloon'], z: 60 });
      return { m };
    },
    paint(ctx, sc, S, layer) {
      const p = sc.pal;
      if (layer === 'fg') { vignette(ctx, 0.3, '#05030c'); return; }
      if (layer !== 0) return;
      skyGrad(ctx, 0, 214, p.sky1, p.sky2);
      starfield(ctx, sc.bg, 0, 0, W, 130, 46);
      skyline(ctx, S, sc.bg + 5, 214, 70, 130, p.far, rgbaHex(p.win, 0.55), 0.3);
      skyline(ctx, S, sc.bg + 9, 214, 40, 88, p.far2, p.win, 0.4);
      rr(ctx, -2, 212, W + 4, 34, 0); ctx.fillStyle = p.walk; ctx.fill(); ink(ctx, S, 0.8);
      ctx.strokeStyle = p.walk2; ctx.lineWidth = 1.2;
      for (let x = 12; x < W; x += 36) { ctx.beginPath(); ctx.moveTo(x, 214); ctx.lineTo(x - 6, 244); ctx.stroke(); }
      rr(ctx, -2, 244, W + 4, 6, 0); ctx.fillStyle = lighter(p.walk, 0.2); ctx.fill(); ink(ctx, S, 0.8);
      ctx.fillStyle = p.street; ctx.fillRect(0, 250, W, H - 250);
      ctx.fillStyle = 'rgba(255,212,92,0.8)';
      for (let x = 6; x < W; x += 44) { rr(ctx, x, 276, 24, 3.4, 1.6); ctx.fill(); }
    },
  },

  space: {
    name: 'space station',
    palettes: [
      P({ id: 'lilac', wood: '#8f88b0', panel: '#dcd6ea', panel2: '#c8c0db', seam: '#aea5c6', floor: '#a59cc0', floor2: '#948ab2', sp1: '#0b0f2e', sp2: '#2a1d58', ink: '#1d1a33', acc: ['#ff6f91', '#ffd45c', '#7fd6c2', '#8fb8ff', '#c9a7ff', '#ff9f68', '#fffaf0'], screen: ['#7fd6c2', '#8fb8ff', '#c9a7ff', '#ffb3cf'], view: 'night' }),
      P({ id: 'sand', wood: '#a39684', panel: '#ece4d6', panel2: '#ddd2bf', seam: '#c4b8a2', floor: '#b8aa94', floor2: '#a69882', sp1: '#120a2c', sp2: '#3e1f5e', ink: '#2a2030', acc: ['#ff6f91', '#ffd45c', '#4fb3a8', '#6f9fd8', '#c9a7ff', '#ff9f68', '#fffaf0'], screen: ['#7fd6c2', '#ffd45c', '#ffb3cf'], view: 'night' }),
    ],
    compose(c) {
      const { r } = c; const m = r.chance(0.5); const X = (x) => (m ? W - x : x);
      const spots = r.shuffle([[170, 82], [238, 76], [234, 140], [162, 142]]);
      const things = r.shuffle(['planet', 'rocket', 'satellite', 'comet', 'moon']).slice(0, 3);
      things.forEach((t, i) => c.add(t, X(spots[i][0]), spots[i][1], { s: t === 'planet' ? 0.82 : 0.78, z: 120 + i, flip: 'rand' }));
      c.add('stars', X(spots[3][0]), spots[3][1], { s: 0.7, z: 119 });
      const sh = c.add('shelf', X(52), 128, { opt: { w: 76 }, z: 104 });
      c.row(c.top(sh, { types: ['pod', 'plushie', 'mug', 'books', 'succulent'], s: [0.85, 0.95] }), r.shuffle(['pod', 'plushie', 'mug', 'pod']).slice(0, 2));
      c.add(r.pick(['poster', 'clock']), X(52), 58, { z: 101 });
      c.add(r.pick(['poster', 'neon', 'clock']), X(350), 66, { z: 102 });
      c.add(r.pick(['frame', 'clock', 'poster']), X(350), 136, { s: 0.9, z: 103 });
      c.add('console', X(200), 290, { z: 300 + 290 });
      const L = c.surface(Math.min(X(8), X(150)), Math.max(X(8), X(150)), 288, { z: 300 + 288, types: ['pod', 'plushie', 'cat', 'books'] });
      c.row(L, r.shuffle(['cat', 'pod', 'plushie']).slice(0, 2), { pad: 12 });
      const R = c.surface(Math.min(X(252), X(392)), Math.max(X(252), X(392)), 288, { z: 300 + 288, types: ['pod', 'plushie', 'cat', 'headphones', 'books'] });
      c.row(R, r.shuffle(['pod', 'headphones', 'plushie', 'books']).slice(0, 2), { pad: 12 });
      c.region(138, 44, 262, 166, { types: ['planet', 'rocket', 'satellite', 'comet', 'moon', 'stars'], z: 125 });
      return { m };
    },
    paint(ctx, sc, S, layer) {
      const p = sc.pal;
      if (layer === 'fg') { vignette(ctx, 0.2); return; }
      if (layer !== 0) return;
      ctx.fillStyle = p.panel; ctx.fillRect(0, 0, W, 236);
      ctx.strokeStyle = p.seam; ctx.lineWidth = 1.4;
      for (const x of [96, 304]) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 236); ctx.stroke(); }
      for (const y of [92, 176]) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(96, y); ctx.moveTo(304, y); ctx.lineTo(W, y); ctx.stroke(); }
      ctx.fillStyle = p.seam;
      for (const x of [8, 88, 312, 392]) for (const y of [8, 84, 100, 168, 184, 228]) { ci(ctx, x, y, 1.6); ctx.fill(); }
      rr(ctx, 98, 0, 204, 236, 0); ctx.fillStyle = p.panel2; ctx.fill();
      // the porthole: space in a ring of steel
      ci(ctx, 200, 105, 92); ctx.fillStyle = darker(p.panel2, 0.08); ctx.fill(); ink(ctx, S);
      ctx.save(); ci(ctx, 200, 105, 80); ctx.clip();
      const g = ctx.createRadialGradient(170, 70, 10, 200, 105, 100); g.addColorStop(0, p.sp2); g.addColorStop(1, p.sp1);
      ctx.fillStyle = g; ctx.fillRect(100, 0, 200, 210);
      starfield(ctx, sc.bg, 110, 20, 290, 190, 70);
      softLight(ctx, 150, 150, 70, '#ff8fb1', 0.12);
      ctx.restore();
      ci(ctx, 200, 105, 80); ink(ctx, S, 1.2);
      for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; ci(ctx, 200 + Math.cos(a) * 86, 105 + Math.sin(a) * 86, 2); ctx.fillStyle = p.seam; ctx.fill(); }
      ctx.save(); ctx.globalAlpha = 0.18; ctx.beginPath(); ctx.ellipse(170, 70, 40, 16, -0.6, 0, TAU); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.restore();
      ctx.fillStyle = p.floor; ctx.fillRect(0, 236, W, H - 236);
      ctx.fillStyle = p.floor2;
      for (let x = -20; x < W; x += 30) { poly(ctx, [x, 300, x + 12, 300, x + 22, 236, x + 10, 236]); ctx.fill(); }
      rr(ctx, -2, 232, W + 4, 6, 0); ctx.fillStyle = p.seam; ctx.fill(); ink(ctx, S, 0.8);
    },
  },

  rooftop: {
    name: 'rooftop garden',
    palettes: [
      P({ id: 'dusk', sky1: '#8a7ddc', sky2: '#ffb38a', far: '#6b5aa0', far2: '#7f6cb6', win: '#ffd98a', wall: '#e7cfb6', wall2: '#d4b99d', floor: '#cdb8a5', floor2: '#b9a28e', ink: '#2d2340', wood: '#a8714f', acc: ['#ff6f91', '#ffd45c', '#7fd6c2', '#8fb8ff', '#c9a7ff', '#ff9f68', '#fffaf0'], lights: ['#ffd45c', '#ff8fb1', '#fff4c9'], view: 'dusk', warm: true, night: true }),
      P({ id: 'noon', sky1: '#8fd3f4', sky2: '#e3f6fd', far: '#b9c7e6', far2: '#a5b5da', win: '#e8f2ff', wall: '#f0dcc6', wall2: '#ddc4a8', floor: '#d6c3ae', floor2: '#c2ad96', ink: '#2c3340', wood: '#b98256', acc: ['#ff6f91', '#ffd45c', '#4fb3a8', '#6f9fd8', '#9b7bd4', '#ff9f68', '#fffaf0'], lights: ['#ffd45c', '#ff8fb1', '#ffffff'], view: 'day' }),
    ],
    compose(c) {
      const { r } = c; const m = r.chance(0.5); const X = (x) => (m ? W - x : x);
      const dusk = c.pal.warm;
      c.add(dusk ? 'moon' : 'sun', X(r.int(310, 350)), r.int(52, 64), { s: 0.9, z: 40 });
      c.add('cloud', X(r.int(80, 150)), r.int(52, 70), { s: 0.85, z: 50 });
      if (r.chance(0.5)) c.add('cloud', X(r.int(200, 250)), r.int(84, 100), { s: 0.7, z: 51 });
      c.add('bird', X(r.int(180, 240)), r.int(40, 56), { opt: { pose: 'fly' }, z: 55, flip: 'rand' });
      c.add('lights', 200, 14, { opt: { w: 370 }, z: 150 });
      const ledge = c.surface(Math.min(X(30), X(250)), Math.max(X(30), X(250)), 190, { z: 220, types: ['succulent', 'cactus', 'bird', 'mug', 'plushie'] });
      c.row(ledge, r.shuffle(['succulent', 'cactus', 'bird', 'succulent', 'mug']).slice(0, 3), { pad: 14 });
      c.add('birdhouse', X(26), 266, { z: 300 + 266 });
      c.add('planter', X(112), 276, { z: 300 + 276 });
      c.add('loungechair', X(300), 280, { z: 300 + 280, flip: m });
      c.add(r.pick(['telescope', 'plant', 'umbrella']), X(374), 268, { s: 0.9, z: 300 + 268, flip: !m });
      const front = c.surface(Math.min(X(170), X(250)), Math.max(X(170), X(250)), 294, { z: 300 + 294, types: ['wateringcan', 'cat', 'flowers', 'plushie', 'books'] });
      c.row(front, r.shuffle(['wateringcan', r.pick(['cat', 'flowers'])]), { pad: 6 });
      c.region(20, 30, 380, 120, { types: ['cloud', 'bird', 'balloon', 'kite'], z: 70 });
      return { m };
    },
    paint(ctx, sc, S, layer) {
      const p = sc.pal;
      if (layer === 'fg') { vignette(ctx, 0.18); return; }
      if (layer !== 0) return;
      skyGrad(ctx, 0, 200, p.sky1, p.sky2);
      skyline(ctx, S, sc.bg + 2, 196, 50, 110, p.far, p.warm ? rgbaHex(p.win, 0.7) : null, 0.25);
      skyline(ctx, S, sc.bg + 4, 196, 26, 64, p.far2, p.warm ? p.win : null, 0.3);
      rr(ctx, -2, 186, W + 4, 34, 0); ctx.fillStyle = p.wall; ctx.fill(); ink(ctx, S, 0.8);
      ctx.strokeStyle = p.wall2; ctx.lineWidth = 1.2;
      for (let y = 196; y < 218; y += 10) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      for (let y = 186, k = 0; y < 218; y += 10, k++) for (let x = k % 2 ? 12 : 0; x < W; x += 24) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 10); ctx.stroke(); }
      rr(ctx, -2, 184, W + 4, 6, 1); ctx.fillStyle = lighter(p.wall, 0.2); ctx.fill(); ink(ctx, S, 0.8);
      checks(ctx, 220, p.floor, p.floor2);
      for (const x of [14, 386]) { rr(ctx, x - 3, 6, 6, 186, 1); ctx.fillStyle = p.wood; ctx.fill(); ink(ctx, S, 0.8); }
      if (p.warm) softLight(ctx, 200, 60, 240, '#ffb38a', 0.12);
    },
  },

  train: {
    name: 'train',
    palettes: [
      P({ id: 'green', wall: '#efe0c8', lower: '#9b4f4f', lower2: '#874343', frame: '#5a3a3a', sky1: '#8fd3f4', sky2: '#e3f6fd', far: '#c3e6ad', hill: '#9fd18b', hill2: '#86c272', table: '#c99a6b', ink: '#30222a', wood: '#a8714f', acc: ['#e07a5f', '#81b29a', '#f2cc8f', '#6d7fc7', '#f4a6b7', '#7fb8d6', '#fff6e6'], leaves: ['#6cbf7a', '#5aa86a'], view: 'day' }),
      P({ id: 'golden', wall: '#e9e1f2', lower: '#4a5f8f', lower2: '#3f527d', frame: '#2f3550', sky1: '#ff9f7a', sky2: '#ffe0b8', far: '#e8c28c', hill: '#d9a96a', hill2: '#c9955a', table: '#b98256', ink: '#2a2235', wood: '#a8714f', acc: ['#e07a5f', '#9fd8b8', '#f2cc8f', '#8f9be0', '#f4a6b7', '#ffd27a', '#fff6e6'], leaves: ['#7cae6a', '#5f9a5a'], view: 'dusk', warm: true }),
    ],
    compose(c) {
      const { r } = c; const m = r.chance(0.5); const X = (x) => (m ? W - x : x);
      c.add('sun', X(r.int(300, 330)), r.int(84, 94), { s: 0.8, z: 40 });
      c.add('cloud', X(r.int(90, 150)), r.int(78, 90), { s: 0.8, z: 50 });
      if (r.chance(0.5)) c.add('bird', X(r.int(200, 250)), r.int(70, 84), { opt: { pose: 'fly' }, z: 51, flip: 'rand' });
      const field = c.surface(54, 346, 168, { z: 120, types: ['cow', 'tree', 'house', 'bush', 'flowers'], s: [0.62, 0.72] });
      c.row(field, r.shuffle(['cow', 'windmill', 'house', 'tree', 'cow']).slice(0, 4), { pad: 10 });
      const rack = c.surface(Math.min(X(40), X(200)), Math.max(X(40), X(200)), 40, { z: 300, layer: 1, types: [], add: false, s: [0.78, 0.82] });
      c.row(rack, ['suitcase'], { pad: 10 });
      const tbl = c.surface(Math.min(X(90), X(310)), Math.max(X(90), X(310)), 206, { z: 400, layer: 1, types: ['mug', 'books', 'pastry', 'sunglasses', 'vase', 'plushie', 'succulent'] });
      c.row(tbl, r.shuffle(['mug', 'books', 'pastry', 'sunglasses', 'vase', 'plushie']).slice(0, r.int(3, 4)), { pad: 8 });
      c.region(44, 62, 356, 132, { types: ['cloud', 'bird', 'balloon', 'kite'], z: 60 });
      // what's outside stays inside the glass (the frame and the curtains are painted over it)
      return { m, safe: [46, 58, 354, 188] };
    },
    paint(ctx, sc, S, layer) {
      const p = sc.pal;
      if (layer === 'fg') { vignette(ctx, 0.16); return; }
      if (layer === 0) {
        skyGrad(ctx, 0, 200, p.sky1, p.sky2);
        hill(ctx, S, 150, 9, p.far, sc.bg % 6, false);
        hill(ctx, S, 170, 6, p.hill, (sc.bg % 4) + 2, true);
        ctx.fillStyle = p.hill2; ctx.fillRect(0, 186, W, 30);
        const r2 = rng(sc.bg + 7);
        for (let x = r2.range(10, 60); x < W; x += 120) { rr(ctx, x, 100, 3.4, 90, 1); ctx.fillStyle = '#7a5a46'; ctx.fill(); ink(ctx, S, 0.6); line(ctx, S, [x - 8, 108, x + 11, 108], 0.8); }
        ctx.strokeStyle = 'rgba(40,30,40,0.5)'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(0, 112); for (let x = 0; x <= W; x += 40) ctx.quadraticCurveTo(x + 20, 120, x + 40, 112); ctx.stroke();
        return;
      }
      if (layer !== 1) return;
      // the carriage around the window: wall, frame, curtains, the luggage rack, the table and the seats
      ctx.beginPath(); ctx.rect(-2, -2, W + 4, H + 4);
      ctx.moveTo(52, 56); ctx.arcTo(34, 56, 34, 74, 18); ctx.lineTo(34, 172); ctx.arcTo(34, 190, 52, 190, 18); ctx.lineTo(348, 190); ctx.arcTo(366, 190, 366, 172, 18); ctx.lineTo(366, 74); ctx.arcTo(366, 56, 348, 56, 18); ctx.closePath();
      ctx.fillStyle = p.wall; ctx.fill('evenodd');
      rr(ctx, 34, 56, 332, 134, 18); ctx.lineWidth = 10; ctx.strokeStyle = p.frame; ctx.stroke(); ctx.lineWidth = S.lw; ctx.strokeStyle = S.ink; ctx.stroke();
      rr(ctx, 29, 51, 342, 144, 22); ink(ctx, S);
      ctx.save(); ctx.globalAlpha = 0.22; poly(ctx, [120, 60, 150, 60, 90, 186, 60, 186]); ctx.fillStyle = '#ffffff'; ctx.fill(); poly(ctx, [170, 60, 180, 60, 120, 186, 110, 186]); ctx.fill(); ctx.restore();
      rr(ctx, 20, 38, W - 40, 4, 2); ctx.fillStyle = '#c9c4d6'; ctx.fill(); ink(ctx, S, 0.8);
      for (const x of [40, 200, 360]) line(ctx, S, [x, 38, x, 28], 1);
      for (const k of [-1, 1]) {
        const e = k < 0 ? 0 : W, d = -k;         // the curtain hangs from the wall's edge toward the window
        ctx.beginPath();
        ctx.moveTo(e, 44); ctx.lineTo(e + d * 46, 44);
        ctx.quadraticCurveTo(e + d * 40, 96, e + d * 26, 122);
        ctx.quadraticCurveTo(e + d * 34, 158, e + d * 40, 202);
        ctx.lineTo(e, 202); ctx.closePath();
        ctx.save(); ctx.fillStyle = p.acc[3]; ctx.fill(); ctx.clip();
        ctx.strokeStyle = rgbaHex('#ffffff', 0.18); ctx.lineWidth = 3;
        for (let j = 1; j < 4; j++) { ctx.beginPath(); ctx.moveTo(e + d * j * 10, 44); ctx.quadraticCurveTo(e + d * j * 8, 120, e + d * j * 9, 202); ctx.stroke(); }
        ctx.fillStyle = 'rgba(20,10,30,0.14)'; ctx.fillRect(k < 0 ? 30 : W - 48, 44, 18, 160);
        ctx.restore(); ink(ctx, S);
        rr(ctx, e + d * 28 - 6, 117, 12, 9, 3); ctx.fillStyle = BASE.honey; ctx.fill(); ink(ctx, S, 0.8);
      }
      rr(ctx, -2, 214, W + 4, 90, 0); ctx.fillStyle = p.lower; ctx.fill(); ink(ctx, S);
      ctx.strokeStyle = p.lower2; ctx.lineWidth = 2;
      for (let x = 14; x < W; x += 28) { ctx.beginPath(); ctx.moveTo(x, 230); ctx.lineTo(x, 300); ctx.stroke(); }
      rr(ctx, 70, 204, 260, 12, 3); ctx.fillStyle = p.table; ctx.fill(); ink(ctx, S);
      rr(ctx, 70, 212, 260, 4, 0); ctx.fillStyle = darker(p.table, 0.18); ctx.fill();
      rr(ctx, 192, 216, 16, 84, 2); ctx.fillStyle = '#8a8098'; ctx.fill(); ink(ctx, S);
    },
  },
};
export const TEMPLATE_IDS = Object.freeze(Object.keys(TEMPLATES));
