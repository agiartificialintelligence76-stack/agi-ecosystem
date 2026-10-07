// AGI-1's live show (2026-10-07, the owner: "can change her clothes"): her outfits, made in code on her Live2D model (the
// owner's choice: "Made in code"). Her clothes keep their shape (her model's own drawing), and change color: each piece of
// clothing is drawn through a color matrix (hue, saturation and brightness, like CSS's filters, so her outlines and
// shading stay as drawn), and accessories drawn in code sit where her pieces are, every frame: cat ears, headphones,
// glasses, sunglasses, a bow, a headset mic, star clips, and things she holds (a mug, her microphone). PG-13 like
// everything she wears: only colors and accessories, never less of her clothes.
import * as THREE from 'three';
import { drawFood, FOOD_SIZE, FOOD_SCALE, FOODS } from './food.js';

// ---------- color matrices (rows), the way CSS's hue-rotate, saturate and brightness work ----------
function hueRotate(deg) {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return [
    0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
    0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283,
    0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072,
  ];
}
function saturate(v) {
  return [
    0.213 + 0.787 * v, 0.715 - 0.715 * v, 0.072 - 0.072 * v,
    0.213 - 0.213 * v, 0.715 + 0.285 * v, 0.072 - 0.072 * v,
    0.213 - 0.213 * v, 0.715 - 0.715 * v, 0.072 + 0.928 * v,
  ];
}
const mul = (A, B) => Array.from({ length: 9 }, (_, k) => {
  const r = Math.floor(k / 3), c = k % 3;
  return A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c];
});
// her clothes' own color is lavender (about #d8a8f8, hue 276°): a tint is how far its hue turns, its saturation and its
// brightness. null: as drawn
export function tintMatrix(t) {
  if (!t) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const m = mul(saturate(t.sat ?? 1), hueRotate(t.hue ?? 0));
  return m.map((x) => x * (t.val ?? 1));
}
const T = {
  pink: { hue: 54, sat: 1.7 }, hotpink: { hue: 62, sat: 2.3, val: 0.98 }, mint: { hue: -112, sat: 1.4 },
  sky: { hue: -68, sat: 1.5 }, honey: { hue: 132, sat: 2.2, val: 1.02 }, black: { sat: 0.35, val: 0.3 },
  cream: { hue: 124, sat: 0.45, val: 1.08 }, navy: { hue: -50, sat: 1.4, val: 0.45 }, red: { hue: 80, sat: 2.3, val: 0.92 },
  white: { sat: 0, val: 1.08 },
};

// ---------- her outfits ----------
// shirt, shorts, shoes: a tint each (null: as drawn); acc: her accessories; colors: theirs
export const OUTFITS = {
  classic: { name: 'my classic AGI tee', shirt: null, shorts: null, shoes: null, acc: [] },
  pinkpop: { name: 'pink pop', shirt: T.pink, shorts: T.white, shoes: null, acc: ['bow'], colors: { bow: '#ff4da6' } },
  midnight: { name: 'midnight', shirt: T.black, shorts: T.hotpink, shoes: T.black, acc: ['headphones'], colors: { headphones: '#22183f', cups: '#ff4da6' } },
  mint: { name: 'mint fresh', shirt: T.mint, shorts: T.navy, shoes: null, acc: ['glasses'], colors: { glasses: '#170a36' } },
  sunny: { name: 'sunny day', shirt: T.honey, shorts: T.sky, shoes: T.white, acc: ['sunglasses', 'clips'], colors: { lens: '#ff4da6', clips: '#3ff0c3' } },
  cozy: { name: 'cozy', shirt: T.cream, shorts: null, shoes: null, acc: ['catEars'], colors: { ears: '#fff4e8', inner: '#ff9cc0' } },
  gamer: { name: 'gamer mode', shirt: T.sky, shorts: T.black, shoes: T.black, acc: ['headphones', 'catEars'], colors: { headphones: '#170a36', cups: '#3ff0c3', ears: '#170a36', inner: '#3ff0c3' } },
  stage: { name: 'my stage outfit', shirt: T.black, shorts: T.hotpink, shoes: T.white, acc: ['headset', 'clips'], colors: { clips: '#ffc933', headset: '#170a36' } },
  // (2026-10-07, the owner: "she can also change outfit based on that place") what she wears on her trips (places.js
  // `outfit`): colors and an accessory that fits the place, never a costume of anyone's culture
  newyork: { name: 'big city', shirt: T.honey, shorts: T.navy, shoes: T.white, acc: ['cap'], colors: { cap: '#3a7bd5' } },
  london: { name: 'rainy day', shirt: T.navy, shorts: T.red, shoes: null, acc: ['scarf'], colors: { scarf: '#d0213f', stripe: '#ffc933' } },
  paris: { name: 'Paris chic', shirt: T.white, shorts: T.navy, shoes: null, acc: ['beret', 'scarf'], colors: { beret: '#e8243f', scarf: '#e8243f', stripe: '#ffffff' } },
  rome: { name: 'Roman holiday', shirt: T.white, shorts: T.red, shoes: null, acc: ['shades'], colors: { shades: '#2b2350' } },
  berlin: { name: 'all black', shirt: T.black, shorts: T.black, shoes: T.black, acc: ['beanie'], colors: { beanie: '#ffc933' } },
  istanbul: { name: 'tulip red', shirt: T.red, shorts: T.white, shoes: null, acc: ['scarf'], colors: { scarf: '#2fb5d9', stripe: '#ffffff' } },
  cairo: { name: 'explorer', shirt: T.cream, shorts: T.cream, shoes: null, acc: ['sunhat', 'shades'], colors: { sunhat: '#f2e3b8', band: '#ff4da6', shades: '#2b2350' } },
  dubai: { name: 'desert gold', shirt: T.white, shorts: T.honey, shoes: T.white, acc: ['shades'], colors: { shades: '#c9962e' } },
  agra: { name: 'marigold', shirt: T.pink, shorts: T.honey, shoes: null, acc: ['garland'], colors: { garland: '#ff9a1f', bead: '#ffd23f' } },
  bangkok: { name: 'orchid', shirt: T.mint, shorts: T.pink, shoes: null, acc: ['flower'], colors: { flower: '#c86bff', center: '#ffe27a' } },
  halong: { name: 'boat day', shirt: T.white, shorts: T.mint, shoes: null, acc: ['conical'], colors: { conical: '#f2e0b0' } },
  bali: { name: 'island', shirt: T.mint, shorts: T.sky, shoes: null, acc: ['flower'], colors: { flower: '#ffffff', center: '#ffc933' } },
  palawan: { name: 'lagoon', shirt: T.honey, shorts: T.sky, shoes: null, acc: ['shades', 'flower'], colors: { shades: '#ff4da6', flower: '#ff3d5a', center: '#ffe27a' } },
  tokyo: { name: 'sakura', shirt: T.pink, shorts: T.white, shoes: null, acc: ['sakura'], colors: { sakura: '#ffc2dc' } },
  seoul: { name: 'pastel', shirt: T.cream, shorts: T.navy, shoes: T.white, acc: ['beret'], colors: { beret: '#c9b6ff' } },
  beijing: { name: 'hiking', shirt: T.red, shorts: T.navy, shoes: T.white, acc: ['bucket'], colors: { bucket: '#fff4e0' } },
  rio: { name: 'sunshine', shirt: T.honey, shorts: T.mint, shoes: null, acc: ['shades', 'flower'], colors: { shades: '#2b2350', flower: '#ff4da6', center: '#ffe27a' } },
  mexico: { name: 'fiesta', shirt: T.pink, shorts: T.mint, shoes: null, acc: ['sunhat', 'flower'], colors: { sunhat: '#f2e3b8', band: '#3ff0c3', flower: '#ffc933', center: '#ff4da6' } },
  space: { name: 'space suit', shirt: T.white, shorts: T.white, shoes: T.white, acc: ['helmet'], colors: {} },
};
export const OUTFIT_IDS = Object.keys(OUTFITS);
export const SHOW_OUTFITS = ['classic', 'pinkpop', 'midnight', 'mint', 'sunny', 'cozy', 'gamer'];
// (2026-10-07) the ones she wears on her trips: each place's (places.js)
export const PLACE_OUTFITS = ['newyork', 'london', 'paris', 'rome', 'berlin', 'istanbul', 'cairo', 'dubai', 'agra', 'bangkok', 'halong', 'bali', 'palawan', 'tokyo', 'seoul', 'beijing', 'rio', 'mexico', 'space'];
const CLOTHES = { shirt: ['shirt', 'chest', 'sleeve_L', 'sleeve_R', 'shirt_print'], shorts: ['shorts', 'drawstring'], shoes: ['shoe_L', 'shoe_R'] };

// ---------- accessories, drawn on small canvases ----------
const INK = '#170a36';
function canvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.lineJoin = 'round'; g.lineCap = 'round';
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 1;
  return t;
}
const DRAW = {
  // two cat ears on a thin headband (256 × 128)
  catEars: (col) => canvas(256, 128, (g) => {
    for (const s of [-1, 1]) {
      const x = 128 + s * 70;
      g.beginPath(); g.moveTo(x - 34, 118); g.lineTo(x + s * 6, 14); g.lineTo(x + 34, 118); g.closePath();
      g.fillStyle = col.ears || '#fff'; g.fill(); g.lineWidth = 7; g.strokeStyle = INK; g.stroke();
      g.beginPath(); g.moveTo(x - 17, 112); g.lineTo(x + s * 5, 44); g.lineTo(x + 17, 112); g.closePath();
      g.fillStyle = col.inner || '#ff9cc0'; g.fill();
    }
  }),
  // over-ear headphones: the band (256 × 96) and a cup (64 × 96)
  band: (col) => canvas(256, 112, (g) => {
    g.beginPath(); g.arc(128, 126, 112, Math.PI * 1.06, Math.PI * 1.94);
    g.lineWidth = 22; g.strokeStyle = INK; g.stroke();
    g.lineWidth = 13; g.strokeStyle = col.headphones || '#22183f'; g.stroke();
  }),
  slider: (col) => canvas(24, 128, (g) => {
    g.fillStyle = INK; g.beginPath(); g.roundRect(2, 0, 20, 128, 8); g.fill();
    g.fillStyle = col.headphones || '#22183f'; g.beginPath(); g.roundRect(7, 4, 10, 120, 5); g.fill();
  }),
  cup: (col) => canvas(64, 96, (g) => {
    g.beginPath(); g.ellipse(32, 48, 24, 40, 0, 0, Math.PI * 2);
    g.fillStyle = col.cups || '#ff4da6'; g.fill(); g.lineWidth = 6; g.strokeStyle = INK; g.stroke();
    g.beginPath(); g.ellipse(32, 48, 11, 22, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fill();
  }),
  // round glasses (256 × 96)
  glasses: (col) => canvas(256, 96, (g) => {
    g.lineWidth = 8; g.strokeStyle = col.glasses || INK;
    for (const x of [72, 184]) { g.beginPath(); g.arc(x, 50, 38, 0, Math.PI * 2); g.fillStyle = 'rgba(200,230,255,0.18)'; g.fill(); g.stroke(); }
    g.beginPath(); g.moveTo(110, 46); g.quadraticCurveTo(128, 36, 146, 46); g.stroke();
  }),
  // heart sunglasses (256 × 96)
  sunglasses: (col) => canvas(256, 96, (g) => {
    for (const x of [72, 184]) {
      g.beginPath(); g.moveTo(x, 84);
      g.bezierCurveTo(x - 52, 52, x - 44, 6, x, 30); g.bezierCurveTo(x + 44, 6, x + 52, 52, x, 84);
      g.fillStyle = col.lens || '#ff4da6'; g.fill(); g.lineWidth = 7; g.strokeStyle = INK; g.stroke();
      g.beginPath(); g.ellipse(x - 14, 38, 8, 5, -0.5, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,0.7)'; g.fill();
    }
    g.lineWidth = 7; g.strokeStyle = INK; g.beginPath(); g.moveTo(114, 40); g.quadraticCurveTo(128, 32, 142, 40); g.stroke();
  }),
  // a bow (128 × 96)
  bow: (col) => canvas(128, 96, (g) => {
    g.fillStyle = col.bow || '#ff4da6'; g.lineWidth = 6; g.strokeStyle = INK;
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(64, 48); g.bezierCurveTo(64 + s * 30, 8, 64 + s * 64, 14, 64 + s * 58, 48); g.bezierCurveTo(64 + s * 64, 82, 64 + s * 30, 88, 64, 48); g.fill(); g.stroke(); }
    g.beginPath(); g.ellipse(64, 48, 13, 15, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  }),
  // two little star clips (128 × 64)
  clips: (col) => canvas(128, 64, (g) => {
    for (const [x, y, r] of [[36, 34, 24], [94, 26, 17]]) {
      g.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
      g.closePath(); g.fillStyle = col.clips || '#ffc933'; g.fill(); g.lineWidth = 5; g.strokeStyle = INK; g.stroke();
    }
  }),
  // a headset mic: a thin boom from her ear toward her mouth (256 × 64; the ear end on the left)
  headset: (col) => canvas(256, 64, (g) => {
    g.lineWidth = 9; g.strokeStyle = INK; g.beginPath(); g.moveTo(22, 20); g.quadraticCurveTo(120, 58, 226, 40); g.stroke();
    g.lineWidth = 5; g.strokeStyle = col.headset || '#3a3a52'; g.stroke();
    g.beginPath(); g.ellipse(232, 40, 18, 14, 0, 0, Math.PI * 2); g.fillStyle = '#2b2b3d'; g.fill(); g.lineWidth = 5; g.strokeStyle = INK; g.stroke();
    g.beginPath(); g.arc(22, 22, 16, 0, Math.PI * 2); g.fillStyle = col.headset || '#3a3a52'; g.fill(); g.stroke();
  }),
  // (2026-10-07, her trips) hats and other things for each place, front on
  beret: (col) => canvas(200, 120, (g) => {
    g.beginPath(); g.ellipse(104, 70, 92, 38, -0.12, 0, Math.PI * 2); g.fillStyle = col.beret || '#e8243f'; g.fill(); g.lineWidth = 6; g.strokeStyle = INK; g.stroke();
    g.beginPath(); g.ellipse(96, 92, 70, 12, -0.12, 0, Math.PI); g.fillStyle = 'rgba(23,10,54,0.25)'; g.fill();
    g.lineWidth = 6; g.beginPath(); g.moveTo(120, 34); g.lineTo(130, 12); g.stroke();
  }),
  cap: (col) => canvas(256, 150, (g) => {
    g.beginPath(); g.moveTo(28, 110); g.bezierCurveTo(30, 20, 226, 20, 228, 110); g.closePath(); g.fillStyle = col.cap || '#3a7bd5'; g.fill(); g.lineWidth = 6; g.strokeStyle = INK; g.stroke();
    g.beginPath(); g.ellipse(128, 116, 112, 26, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.beginPath(); g.arc(128, 30, 9, 0, Math.PI * 2); g.fill(); g.stroke();
    g.lineWidth = 3; g.strokeStyle = 'rgba(23,10,54,0.4)'; g.beginPath(); g.moveTo(128, 36); g.lineTo(128, 100); g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(128, 82); g.bezierCurveTo(108, 66, 112, 52, 128, 64); g.bezierCurveTo(144, 52, 148, 66, 128, 82); g.fill();
  }),
  sunhat: (col) => canvas(320, 150, (g) => {
    g.beginPath(); g.ellipse(160, 108, 150, 34, 0, 0, Math.PI * 2); g.fillStyle = col.sunhat || '#f2e3b8'; g.fill(); g.lineWidth = 6; g.strokeStyle = INK; g.stroke();
    g.beginPath(); g.moveTo(84, 104); g.bezierCurveTo(86, 20, 234, 20, 236, 104); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = col.band || '#ff4da6'; g.fillRect(88, 82, 144, 16); g.strokeRect(88, 82, 144, 16);
  }),
  bucket: (col) => canvas(256, 150, (g) => {
    g.beginPath(); g.moveTo(16, 126); g.lineTo(60, 92); g.lineTo(196, 92); g.lineTo(240, 126); g.quadraticCurveTo(128, 146, 16, 126); g.closePath();
    g.fillStyle = col.bucket || '#fff4e0'; g.fill(); g.lineWidth = 6; g.strokeStyle = INK; g.stroke();
    g.beginPath(); g.moveTo(60, 96); g.bezierCurveTo(64, 20, 192, 20, 196, 96); g.closePath(); g.fill(); g.stroke();
    g.lineWidth = 3; g.strokeStyle = 'rgba(23,10,54,0.35)'; for (const y of [104, 116]) { g.beginPath(); g.moveTo(40, y); g.quadraticCurveTo(128, y + 10, 216, y); g.stroke(); }
  }),
  beanie: (col) => canvas(256, 180, (g) => {
    g.beginPath(); g.moveTo(30, 150); g.bezierCurveTo(30, 30, 226, 30, 226, 150); g.closePath(); g.fillStyle = col.beanie || '#ffc933'; g.fill(); g.lineWidth = 6; g.strokeStyle = INK; g.stroke();
    g.beginPath(); g.roundRect(22, 126, 212, 40, 14); g.fill(); g.stroke();
    g.lineWidth = 3; g.strokeStyle = 'rgba(23,10,54,0.35)'; for (let x = 40; x < 230; x += 18) { g.beginPath(); g.moveTo(x, 130); g.lineTo(x, 162); g.stroke(); }
    g.beginPath(); g.arc(128, 30, 22, 0, Math.PI * 2); g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = 5; g.strokeStyle = INK; g.stroke();
  }),
  conical: (col) => canvas(320, 150, (g) => {
    g.beginPath(); g.moveTo(160, 10); g.lineTo(306, 124); g.quadraticCurveTo(160, 150, 14, 124); g.closePath(); g.fillStyle = col.conical || '#f2e0b0'; g.fill(); g.lineWidth = 6; g.strokeStyle = INK; g.stroke();
    g.lineWidth = 2.5; g.strokeStyle = 'rgba(23,10,54,0.35)'; for (let k = 1; k < 6; k++) { const y = 10 + k * 22; const w = (y - 10) * 1.28; g.beginPath(); g.moveTo(160 - w, y); g.quadraticCurveTo(160, y + 8, 160 + w, y); g.stroke(); }
  }),
  // a flower behind her ear (128 × 128)
  flower: (col) => canvas(128, 128, (g) => {
    g.save(); g.translate(64, 64);
    for (let i = 0; i < 5; i++) { g.rotate((Math.PI * 2) / 5); g.beginPath(); g.ellipse(0, 28, 20, 30, 0, 0, Math.PI * 2); g.fillStyle = col.flower || '#ff4da6'; g.fill(); g.lineWidth = 5; g.strokeStyle = INK; g.stroke(); }
    g.beginPath(); g.arc(0, 0, 13, 0, Math.PI * 2); g.fillStyle = col.center || '#ffe27a'; g.fill(); g.lineWidth = 4; g.stroke();
    g.restore();
  }),
  // three cherry blossoms on a clip (200 × 90)
  sakura: (col) => canvas(200, 90, (g) => {
    for (const [x, y, r] of [[40, 50, 26], [100, 36, 30], [160, 52, 24]]) {
      g.save(); g.translate(x, y);
      for (let i = 0; i < 5; i++) { g.rotate((Math.PI * 2) / 5); g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-r * 0.6, r * 0.5, -r * 0.3, r * 1.05, 0, r * 0.86); g.bezierCurveTo(r * 0.3, r * 1.05, r * 0.6, r * 0.5, 0, 0); g.fillStyle = col.sakura || '#ffc2dc'; g.fill(); g.lineWidth = 3.5; g.strokeStyle = INK; g.stroke(); }
      g.beginPath(); g.arc(0, 0, r * 0.18, 0, Math.PI * 2); g.fillStyle = '#ff4da6'; g.fill();
      g.restore();
    }
  }),
  // a scarf around her neck: the band and its two ends (256 × 200)
  scarf: (col) => canvas(256, 200, (g) => {
    const c = col.scarf || '#e8243f', st = col.stripe || '#ffffff';
    g.beginPath(); g.moveTo(20, 40); g.quadraticCurveTo(128, 96, 236, 40); g.lineTo(236, 74); g.quadraticCurveTo(128, 130, 20, 74); g.closePath(); g.fillStyle = c; g.fill(); g.lineWidth = 6; g.strokeStyle = INK; g.stroke();
    for (const [x, a] of [[96, -0.12], [132, 0.18]]) { g.save(); g.translate(x, 96); g.rotate(a); g.beginPath(); g.roundRect(-20, 0, 40, 96, 8); g.fillStyle = c; g.fill(); g.stroke(); g.fillStyle = st; g.fillRect(-20, 30, 40, 10); g.fillRect(-20, 58, 40, 10); g.restore(); }
    g.fillStyle = st; g.globalAlpha = 0.9; g.beginPath(); g.moveTo(40, 52); g.quadraticCurveTo(128, 100, 216, 52); g.lineTo(216, 60); g.quadraticCurveTo(128, 108, 40, 60); g.closePath(); g.fill(); g.globalAlpha = 1;
  }),
  // a marigold garland around her neck (300 × 230)
  garland: (col) => canvas(300, 230, (g) => {
    for (let i = 0; i <= 18; i++) {
      const t = i / 18, a = Math.PI * (0.06 + 0.88 * t);
      const x = 150 - Math.cos(a) * 128, y = 20 + Math.sin(a) * 180;
      g.beginPath(); g.arc(x, y, 15, 0, Math.PI * 2); g.fillStyle = i % 3 ? (col.garland || '#ff9a1f') : (col.bead || '#ffd23f'); g.fill(); g.lineWidth = 4; g.strokeStyle = INK; g.stroke();
      g.strokeStyle = 'rgba(23,10,54,0.35)'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.stroke();
    }
  }),
  // classic sunglasses (256 × 96)
  shades: (col) => canvas(256, 96, (g) => {
    for (const x of [72, 184]) { g.beginPath(); g.moveTo(x - 46, 26); g.lineTo(x + 46, 26); g.quadraticCurveTo(x + 46, 82, x, 82); g.quadraticCurveTo(x - 46, 82, x - 46, 26); g.closePath(); g.fillStyle = col.shades || '#2b2350'; g.fill(); g.lineWidth = 7; g.strokeStyle = INK; g.stroke();
      g.beginPath(); g.ellipse(x - 14, 42, 10, 5, -0.5, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,0.55)'; g.fill(); }
    g.lineWidth = 7; g.strokeStyle = INK; g.beginPath(); g.moveTo(118, 34); g.quadraticCurveTo(128, 28, 138, 34); g.stroke();
  }),
  // a space helmet: a glass bubble around her head, its ring at the bottom (360 × 380)
  helmet: () => canvas(360, 380, (g) => {
    g.beginPath(); g.arc(180, 176, 166, 0, Math.PI * 2); g.fillStyle = 'rgba(200,225,255,0.14)'; g.fill(); g.lineWidth = 8; g.strokeStyle = INK; g.stroke();
    g.beginPath(); g.arc(180, 176, 152, -2.6, -1.9); g.lineWidth = 12; g.strokeStyle = 'rgba(255,255,255,0.6)'; g.stroke();
    g.beginPath(); g.arc(180, 176, 140, -1.75, -1.6); g.lineWidth = 8; g.stroke();
    g.beginPath(); g.roundRect(60, 318, 240, 48, 20); g.fillStyle = '#e8e8f2'; g.fill(); g.lineWidth = 6; g.strokeStyle = INK; g.stroke();
    g.fillStyle = '#ff4da6'; g.fillRect(150, 330, 60, 12);
  }),
  // an umbrella: its canopy (300 × 170) and its shaft (24 × 256)
  canopy: (col) => canvas(300, 170, (g) => {
    g.beginPath(); g.moveTo(10, 130); g.bezierCurveTo(20, 10, 280, 10, 290, 130);
    for (let i = 5; i > 0; i--) { const x0 = 10 + (i * 280) / 5, x1 = 10 + ((i - 1) * 280) / 5; g.quadraticCurveTo((x0 + x1) / 2, 112, x1, 130); }
    g.closePath();
    const grad = g.createLinearGradient(0, 0, 300, 0);
    const cs = [col.umbrella || '#ff4da6', col.umbrella2 || '#ffc933'];
    for (let i = 0; i <= 5; i++) { grad.addColorStop(i / 5, cs[i % 2]); if (i < 5) grad.addColorStop((i + 0.999) / 5, cs[i % 2]); }
    g.fillStyle = grad; g.fill(); g.lineWidth = 6; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke();
    g.lineWidth = 3; for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(150, 40); g.quadraticCurveTo(10 + (i * 280) / 5 + (i - 2.5) * 10, 70, 10 + (i * 280) / 5, 128); g.stroke(); }
    g.beginPath(); g.arc(150, 30, 7, 0, Math.PI * 2); g.fillStyle = INK; g.fill();
  }),
  shaft: () => canvas(24, 256, (g) => {
    g.fillStyle = INK; g.fillRect(9, 0, 6, 220);
    g.lineWidth = 7; g.strokeStyle = INK; g.beginPath(); g.moveTo(12, 214); g.lineTo(12, 236); g.quadraticCurveTo(12, 250, 2, 246); g.stroke();
  }),
  // (2026-10-07, the owner: "add more emotions as well") her cartoon marks: heart eyes, star eyes, dizzy spirals (one eye
  // each, 128 × 128), tears (a stream under one eye, 64 × 160), gloom lines, an anger mark and a sweat drop
  heartEye: () => canvas(128, 128, (g) => {
    g.beginPath(); g.moveTo(64, 112); g.bezierCurveTo(-4, 70, 12, 8, 64, 40); g.bezierCurveTo(116, 8, 132, 70, 64, 112);
    g.fillStyle = '#ff3d8b'; g.fill(); g.lineWidth = 7; g.strokeStyle = INK; g.stroke();
    g.beginPath(); g.ellipse(42, 46, 11, 7, -0.6, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,0.8)'; g.fill();
  }),
  starEye: () => canvas(128, 128, (g) => {
    g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 24 : 58; g.lineTo(64 + Math.cos(a) * r, 66 + Math.sin(a) * r); }
    g.closePath(); g.fillStyle = '#ffd23f'; g.fill(); g.lineWidth = 7; g.strokeStyle = INK; g.stroke();
    g.beginPath(); g.arc(52, 52, 7, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill();
  }),
  spiralEye: () => canvas(128, 128, (g) => {
    g.beginPath(); g.arc(64, 64, 56, 0, Math.PI * 2); g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = 6; g.strokeStyle = INK; g.stroke();
    g.beginPath();
    for (let a = 0; a < Math.PI * 7; a += 0.12) { const r = 4 + a * 2.25; g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); }
    g.lineWidth = 6; g.stroke();
  }),
  tear: () => canvas(64, 160, (g) => {
    const grad = g.createLinearGradient(0, 0, 0, 160);
    grad.addColorStop(0, 'rgba(120,200,255,0.95)'); grad.addColorStop(1, 'rgba(120,200,255,0.55)');
    g.beginPath(); g.moveTo(18, 0); g.quadraticCurveTo(10, 90, 22, 150); g.lineTo(42, 150); g.quadraticCurveTo(54, 90, 46, 0); g.closePath();
    g.fillStyle = grad; g.fill(); g.lineWidth = 4; g.strokeStyle = 'rgba(23,10,54,0.7)'; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.75)'; for (const y of [30, 70, 110]) { g.beginPath(); g.ellipse(28, y, 4, 10, 0, 0, Math.PI * 2); g.fill(); }
  }),
  gloom: () => canvas(200, 110, (g) => {
    g.lineWidth = 7; g.strokeStyle = 'rgba(107,59,255,0.85)'; g.lineCap = 'round';
    for (let i = 0; i < 6; i++) { const x = 22 + i * 31, h = 50 + (i % 2) * 34; g.beginPath(); g.moveTo(x, 8); g.lineTo(x, 8 + h); g.stroke(); }
  }),
  vein: () => canvas(128, 128, (g) => {
    g.lineWidth = 13; g.strokeStyle = '#ff2d55'; g.lineCap = 'round';
    for (const [a, b] of [[[20, 46], [50, 50]], [[78, 50], [108, 46]], [[46, 18], [50, 48]], [[78, 48], [82, 18]], [[20, 82], [50, 78]], [[78, 78], [108, 82]], [[46, 110], [50, 80]], [[78, 80], [82, 110]]]) {
      g.beginPath(); g.moveTo(a[0], a[1]); g.quadraticCurveTo((a[0] + b[0]) / 2 + 6, (a[1] + b[1]) / 2 - 6, b[0], b[1]); g.stroke();
    }
  }),
  sweat: () => canvas(80, 112, (g) => {
    g.beginPath(); g.moveTo(40, 6); g.bezierCurveTo(30, 40, 8, 58, 10, 80); g.arc(40, 78, 30, Math.PI, 0, true); g.bezierCurveTo(72, 58, 50, 40, 40, 6);
    g.fillStyle = 'rgba(140,215,255,0.95)'; g.fill(); g.lineWidth = 6; g.strokeStyle = INK; g.stroke();
    g.beginPath(); g.ellipse(30, 74, 6, 11, 0.3, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,0.85)'; g.fill();
  }),
  // things she holds: a mug (96 × 96) and a microphone (64 × 160)
  mug: () => canvas(96, 96, (g) => {
    g.lineWidth = 6; g.strokeStyle = INK;
    g.beginPath(); g.arc(70, 50, 15, -Math.PI / 2, Math.PI / 2); g.stroke();
    g.beginPath(); g.moveTo(14, 18); g.lineTo(64, 18); g.lineTo(60, 86); g.lineTo(18, 86); g.closePath();
    g.fillStyle = '#6b3bff'; g.fill(); g.stroke();
    g.beginPath(); g.moveTo(39, 40); g.bezierCurveTo(28, 30, 22, 48, 39, 60); g.bezierCurveTo(56, 48, 50, 30, 39, 40); g.fillStyle = '#ff9cc0'; g.fill();
  }),
  phone: () => canvas(64, 112, (g) => {
    g.lineWidth = 6; g.strokeStyle = INK;
    g.beginPath(); g.roundRect(8, 6, 48, 100, 10); g.fillStyle = '#ff4da6'; g.fill(); g.stroke();
    g.fillStyle = '#e4d9ff'; g.beginPath(); g.roundRect(14, 14, 36, 70, 5); g.fill();
    g.fillStyle = '#6b3bff'; g.beginPath(); g.arc(32, 94, 4, 0, Math.PI * 2); g.fill();
  }),
  mic: () => canvas(64, 160, (g) => {
    g.lineWidth = 6; g.strokeStyle = INK;
    g.beginPath(); g.moveTo(24, 58); g.lineTo(40, 58); g.lineTo(36, 154); g.lineTo(28, 154); g.closePath(); g.fillStyle = '#2b2b3d'; g.fill(); g.stroke();
    g.beginPath(); g.arc(32, 34, 27, 0, Math.PI * 2); g.fillStyle = '#c9c9d9'; g.fill(); g.stroke();
    g.strokeStyle = 'rgba(23,10,54,0.5)'; g.lineWidth = 2;
    for (let k = -18; k <= 18; k += 9) { g.beginPath(); g.moveTo(32 + k, 10); g.lineTo(32 + k, 58); g.stroke(); g.beginPath(); g.moveTo(6, 34 + k); g.lineTo(58, 34 + k); g.stroke(); }
    g.fillStyle = '#ff4da6'; g.fillRect(24, 64, 16, 8);
  }),
};

// A flat picture in her model's own space (model units), drawn in a place in her pieces' order
function sprite(tex, order) {
  const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m);
  mesh.frustumCulled = false;
  mesh.visible = false;
  mesh.userData.order = order;
  return mesh;
}
const HATS = ['cap', 'beret', 'sunhat', 'bucket', 'beanie', 'conical'];
// where each hat sits (her face's width = 1): its width, and where its middle is above the top of her hair (her head's
// tilt follows). Tuned by eye on her set (2026-10-07)
const HAT_AT = { cap: { w: 1.6, y: -0.52 }, beret: { w: 1.3, y: -0.31, x: 0.12, rot: 0.08 }, sunhat: { w: 2.4, y: -0.45 }, bucket: { w: 1.65, y: -0.52 },
  beanie: { w: 1.55, y: -0.48 }, conical: { w: 2.3, y: -0.38 } };
// her cartoon marks (moves.js `emote`): which pictures, and where
export const EMOTES = ['hearts', 'stars', 'spiral', 'tears', 'gloom', 'vein', 'sweat'];

// ---------- her wardrobe ----------
// model: her puppet (src/stage/agi1-2d.js). wear(id) changes her outfit (its colors ease in), hold('mug' | 'mic' | 'phone' |
// 'umbrella' | 'food' | null) puts something in her right hand (on the left of the picture), food(id, stage) is the food
// she holds (food.js: whole, one bite, two bites). Call update(emote) from her model's hooks.afterDeform: emote is moves.js's
// { kind, w } (her cartoon marks: heart eyes, tears…) or null.
export function createWardrobe(model) {
  const D = model.core.drawables, ids = Array.from(D.ids), meshes = model.meshes.meshes;
  const piece = (n) => ids.indexOf(n);
  // her clothes' materials get a color matrix (and how much of it: 0 as drawn, 1 all of it)
  const parts = {};
  for (const [part, names] of Object.entries(CLOTHES)) {
    parts[part] = [];
    for (const n of names) {
      const mesh = meshes[piece(n)];
      if (!mesh) continue;
      const mat = mesh.material;
      mat.uniforms.tint = { value: new THREE.Matrix3() };
      mat.fragmentShader = mat.fragmentShader
        .replace('uniform sampler2D map;', 'uniform sampler2D map;\n  uniform mat3 tint;')
        .replace('vec4 c = texture2D(map, vUv);', `vec4 c = texture2D(map, vUv);
    // only the colored parts of her clothes: white (the AGI on her shirt, her shorts' stripes, her shoes) stays white
    vec3 rgb = c.rgb / max(c.a, 0.001);
    float hi = max(max(rgb.r, rgb.g), rgb.b), lo = min(min(rgb.r, rgb.g), rgb.b);
    float colored = smoothstep(0.07, 0.2, hi > 0.0 ? (hi - lo) / hi : 0.0);
    c.rgb = mix(c.rgb, clamp(tint * c.rgb, 0.0, c.a), colored);`);
      mat.needsUpdate = true;
      parts[part].push(mat);
    }
  }
  const tints = { shirt: tintMatrix(null), shorts: tintMatrix(null), shoes: tintMatrix(null) };
  const from = { ...tints }, to = { ...tints };
  let ease = 1;
  const apply = () => {
    for (const part of Object.keys(parts)) {
      const m = from[part].map((x, k) => x + (to[part][k] - x) * ease);
      for (const mat of parts[part]) mat.uniforms.tint.value.set(...m);
      tints[part] = m;
    }
  };
  apply();

  // accessories: made for each outfit (their colors), placed every frame
  const group = new THREE.Group();
  group.name = 'wardrobe';
  model.art.add(group);
  let items = {}, current = 'classic', held = null;
  // the food she holds: its own small canvas, drawn again for each bite
  const foodCanvas = document.createElement('canvas');
  foodCanvas.width = foodCanvas.height = FOOD_SIZE;
  const foodTex = new THREE.CanvasTexture(foodCanvas);
  foodTex.colorSpace = THREE.SRGBColorSpace;
  let foodNow = null;
  const props = { mug: sprite(DRAW.mug(), 'hand'), mic: sprite(DRAW.mic(), 'hand'), phone: sprite(DRAW.phone(), 'hand'), food: sprite(foodTex, 'hand'),
    canopy: sprite(DRAW.canopy({}), 'top'), shaft: sprite(DRAW.shaft(), 'hand') };
  for (const p of Object.values(props)) group.add(p);
  // her cartoon marks: two of each eye mark, two tears, the rest one
  const marks = {
    heartsR: sprite(DRAW.heartEye(), 'behindBangs'), heartsL: sprite(DRAW.heartEye(), 'behindBangs'),
    starsR: sprite(DRAW.starEye(), 'behindBangs'), starsL: sprite(DRAW.starEye(), 'behindBangs'),
    spiralR: sprite(DRAW.spiralEye(), 'behindBangs'), spiralL: sprite(DRAW.spiralEye(), 'behindBangs'),
    tearsR: sprite(DRAW.tear(), 'behindBangs'), tearsL: sprite(DRAW.tear(), 'behindBangs'),
    gloom: sprite(DRAW.gloom(), 'top'), vein: sprite(DRAW.vein(), 'top'), sweat: sprite(DRAW.sweat(), 'top'),
  };
  for (const m of Object.values(marks)) group.add(m);
  function dress(id) {
    for (const it of Object.values(items)) { group.remove(it); it.material.map.dispose(); it.material.dispose(); it.geometry.dispose(); }
    items = {};
    const o = OUTFITS[id] || OUTFITS.classic, col = o.colors || {};
    for (const a of o.acc) {
      if (a === 'headphones') {
        items.band = sprite(DRAW.band(col), 'top');
        items.slideR = sprite(DRAW.slider(col), 'top');
        items.slideL = sprite(DRAW.slider(col), 'top');
        items.cupR = sprite(DRAW.cup(col), 'top');
        items.cupL = sprite(DRAW.cup(col), 'top');
      } else if (a === 'catEars') items.ears = sprite(DRAW.catEars(col), 'behindBangs');
      else if (a === 'glasses' || a === 'sunglasses' || a === 'shades') items.glasses = sprite(DRAW[a](col), 'behindBangs');
      else if (a === 'bow') items.bow = sprite(DRAW.bow(col), 'top');
      else if (a === 'clips') items.clips = sprite(DRAW.clips(col), 'top');
      else if (a === 'headset') items.headset = sprite(DRAW.headset(col), 'top');
      else if (HATS.includes(a)) { items.hat = sprite(DRAW[a](col), 'top'); items.hat.userData.kind = a; }
      else if (a === 'flower') items.flower = sprite(DRAW.flower(col), 'top');
      else if (a === 'sakura') items.sakura = sprite(DRAW.sakura(col), 'top');
      else if (a === 'scarf' || a === 'garland') { items.neck = sprite(DRAW[a](col), 'neck'); items.neck.userData.kind = a; }
      else if (a === 'helmet') items.helmet = sprite(DRAW.helmet(col), 'top');
    }
    for (const it of Object.values(items)) group.add(it);
  }
  dress('classic');

  // where her pieces are (model units), this frame
  const P = {
    face: piece('face'), hairL: piece('hair_front_L'), hairR: piece('hair_front_R'), sideL: piece('hair_side_L'), sideR: piece('hair_side_R'),
    earL: piece('ear_L'), earR: piece('ear_R'), eyeL: piece('eye_white_L'), eyeR: piece('eye_white_R'), handR: piece('hand_R'), mouth: piece('mouth_line'),
    print: piece('shirt_print'), upperR: piece('upper_arm_R'),
  };
  const box = (i) => {
    const p = D.vertexPositions[i];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, sx = 0, sy = 0;
    for (let k = 0; k < p.length; k += 2) { const x = p[k], y = p[k + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; sx += x; sy += y; }
    const n = p.length / 2;
    return { x0, y0, x1, y1, cx: sx / n, cy: sy / n, w: x1 - x0, h: y1 - y0 };
  };
  const place = (mesh, x, y, w, h, rot, order, opacity = 1) => {
    mesh.position.set(x, y, 0);
    mesh.scale.set(w, h, 1);
    mesh.rotation.z = rot;
    const ro = { behindBangs: Math.min(meshes[P.hairL].renderOrder, meshes[P.hairR].renderOrder) - 1e-4,
      top: Math.max(meshes[P.hairL].renderOrder, meshes[P.hairR].renderOrder, meshes[P.sideL].renderOrder, meshes[P.sideR].renderOrder) + 1e-4,
      hand: meshes[P.handR].renderOrder - 1e-4,
      // (a scarf or a garland: over her shirt, under her arms, her face and her hair)
      neck: meshes[P.print].renderOrder + 1e-4,
      // (her umbrella's shaft: in her hand, behind her upper arm)
      under: meshes[P.upperR].renderOrder - 1e-4 }[order];
    mesh.renderOrder = ro;
    mesh.material.opacity = opacity;
    mesh.visible = opacity > 0.01;
  };
  let t = 0;

  function update(emote = null) {
    t += 1 / 30;
    if (ease < 1) { ease = Math.min(1, ease + 1 / 12); apply(); }
    const face = box(P.face), eL = box(P.eyeL), eR = box(P.eyeR);
    const roll = Math.atan2(eL.cy - eR.cy, eL.cx - eR.cx);           // her head's tilt (R is on the left of the picture)
    const cos = Math.cos(roll), sin = Math.sin(roll);
    const at = (dx, dy) => [face.cx + dx * cos - dy * sin, face.cy + dx * sin + dy * cos];
    const fw = face.w, eyesY = (eL.cy + eR.cy) / 2 - face.cy, eyesX = (eL.cx + eR.cx) / 2 - face.cx;
    const top = Math.max(box(P.hairL).y1, box(P.hairR).y1) - face.cy;
    const span = Math.hypot(eL.cx - eR.cx, eL.cy - eR.cy);
    for (const [k, it] of Object.entries(items)) {
      if (k === 'ears') { const [x, y] = at(0, top - fw * 0.02); place(it, x, y, fw * 1.25, fw * 0.62, roll, it.userData.order); }
      else if (k === 'band') { const [x, y] = at(0, top - fw * 0.17); place(it, x, y, fw * 1.42, fw * 0.62, roll, it.userData.order); }
      else if (k === 'slideR' || k === 'slideL') {
        // from the band's end down to its cup
        const s = k === 'slideR' ? -1 : 1, ear = box(s < 0 ? P.earR : P.earL);
        const [ex, ey] = at(s * fw * 0.6, top - fw * 0.17 - fw * 0.27);
        const cx = ear.cx + s * fw * 0.04, cy = ear.cy + fw * 0.17;
        const len = Math.hypot(ex - cx, ey - cy);
        place(it, (ex + cx) / 2, (ey + cy) / 2, fw * 0.075, len, Math.atan2(ey - cy, ex - cx) - Math.PI / 2, it.userData.order);
      }
      else if (k === 'cupR' || k === 'cupL') {
        const ear = box(k === 'cupR' ? P.earR : P.earL);
        place(it, ear.cx + (k === 'cupR' ? -1 : 1) * fw * 0.04, ear.cy + fw * 0.02, fw * 0.24, fw * 0.36, roll, it.userData.order);
      } else if (k === 'glasses') { const [x, y] = at(eyesX, eyesY + fw * 0.01); place(it, x, y, span * 1.95, span * 0.73, roll, it.userData.order); }
      else if (k === 'bow') { const [x, y] = at(fw * 0.38, top - fw * 0.16); place(it, x, y, fw * 0.42, fw * 0.32, roll + 0.35, it.userData.order); }
      else if (k === 'clips') { const [x, y] = at(fw * 0.3, top - fw * 0.3); place(it, x, y, fw * 0.36, fw * 0.18, roll + 0.2, it.userData.order); }
      else if (k === 'headset') {
        const ear = box(P.earR), mouth = box(P.mouth);
        const dx = mouth.cx - ear.cx, dy = mouth.cy - ear.cy, len = Math.hypot(dx, dy);
        place(it, (ear.cx + mouth.cx) / 2 - fw * 0.02, (ear.cy + mouth.cy) / 2, len * 1.12, len * 0.28, Math.atan2(dy, dx), it.userData.order);
      } else if (k === 'hat') {
        const h = HAT_AT[it.userData.kind], img = it.material.map.image, w = fw * h.w;
        const [x, y] = at(fw * (h.x || 0), top + fw * h.y);
        place(it, x, y, w, (w * img.height) / img.width, roll + (h.rot || 0), it.userData.order);
      } else if (k === 'flower') { const ear = box(P.earL); place(it, ear.cx + fw * 0.06, ear.cy + fw * 0.2, fw * 0.36, fw * 0.36, roll - 0.3, it.userData.order); }
      else if (k === 'sakura') { const [x, y] = at(fw * 0.46, top - fw * 0.2); place(it, x, y, fw * 0.62, fw * 0.28, roll - 0.45, it.userData.order); }
      else if (k === 'neck') {
        // around her neck, its top just under her chin
        const img = it.material.map.image, g = it.userData.kind === 'garland', w = fw * (g ? 1.7 : 1.55);
        place(it, face.cx, face.y0 - fw * (g ? 0.49 : 0.41), w, (w * img.height) / img.width, roll * 0.3, it.userData.order);
      } else if (k === 'helmet') { const [x, y] = at(0, fw * 0.05); place(it, x, y, fw * 2.3, fw * 2.3 * (380 / 360), roll, it.userData.order); }
    }
    // what she holds, in her right hand (on the left of the picture): along her hand, from her wrist to her fingertips
    const arm = model.arms.R;
    for (const [k, p] of Object.entries(props)) {
      const on = held === k || (held === 'umbrella' && (k === 'canopy' || k === 'shaft'));
      if (!on || !arm) { p.visible = false; continue; }
      const h = model.posture.hip, W = arm.now.W, tip = arm.now.tip;
      const dx = tip[0] - W[0], dy = tip[1] - W[1], len = Math.hypot(dx, dy) || 1;
      const ang = Math.atan2(dy, dx);
      const mx = (tip[0] + W[0]) / 2 + h, my = (tip[1] + W[1]) / 2;
      if (k === 'mug') place(p, mx, my, len * 1.25, len * 1.25, 0, 'hand');
      else if (k === 'phone') place(p, mx + len * 0.1, my + len * 0.35, len * 0.62, len * 1.08, ang - Math.PI / 2, 'hand');
      // (her food over her face and hair: her arms are drawn under her face, and a bite happens at her mouth: as her hand
      // comes near her mouth, the food's top right corner, where its bites are, slides to her mouth; a drink's straw)
      else if (k === 'food') {
        const fid = foodNow ? foodNow.split(':')[0] : '', mouth = box(P.mouth), S = len * 1.55 * (FOOD_SCALE[fid] || 1), drink = Boolean(FOODS[fid]?.drink);
        const hx = W[0] * 0.4 + tip[0] * 0.6 + h, hy = W[1] * 0.4 + tip[1] * 0.6 + S * 0.12;
        const near = Math.hypot(tip[0] + h - mouth.cx, tip[1] - mouth.cy), k2 = 1 - Math.min(1, Math.max(0, (near - len * 0.7) / (len * 1.6)));
        const fx = mouth.cx - S * (drink ? 0.12 : 0.3), fy = mouth.cy - S * (drink ? 0.47 : 0.28);
        place(p, hx + (fx - hx) * k2, hy + (fy - hy) * k2, S, S, 0, 'top');
      } else if (k === 'shaft' || k === 'canopy') {
        // her umbrella over her shoulder (her head is near the top of the picture: no room for it over her head), tilted
        // back, its shaft from her hand up to its middle
        const tilt = 0.38 + 0.03 * Math.sin(t * 1.3), hx = mx, hy = my - len * 0.2;
        const L = fw * 1.55, cx = hx - Math.sin(tilt) * L, cy = hy + Math.cos(tilt) * L;
        if (k === 'shaft') place(p, (hx + cx) / 2 - Math.sin(tilt) * fw * 0.1, (hy + cy) / 2, fw * 0.09, L + fw * 0.45, tilt, 'under');
        else { const w = fw * 3.2; place(p, cx, cy + (w * 170) / 300 * 0.12, w, (w * 170) / 300, tilt, 'top'); }
      } else place(p, mx, my + len * 0.6, len * 0.62, len * 1.55, 0.12, 'hand');
    }
    // her cartoon marks
    const kind = emote?.kind || null, w = Math.max(0, Math.min(1, emote?.w ?? 0));
    for (const [k, m] of Object.entries(marks)) {
      const base = k.replace(/[RL]$/, '');
      if (base !== kind || w < 0.02) { m.visible = false; continue; }
      const side = k.endsWith('R') ? 'R' : 'L', eye = side === 'R' ? eR : eL;
      if (base === 'hearts' || base === 'stars') {
        const beat = base === 'hearts' ? 1 + 0.12 * Math.max(0, Math.sin(t * 9)) : 1 + 0.06 * Math.sin(t * 6 + (side === 'R' ? 0 : 1.4));
        const s = span * 0.62 * beat * (0.6 + 0.4 * w);
        place(m, eye.cx, eye.cy, s, s, roll, m.userData.order, w);
      } else if (base === 'spiral') {
        const s = span * 0.6;
        place(m, eye.cx, eye.cy, s, s, roll + t * (side === 'R' ? 5 : -5), m.userData.order, w);
      } else if (base === 'tears') {
        // a stream from the bottom of each eye, a little wobble, longer as it goes on
        const len = fw * 0.55 * (0.4 + 0.6 * w), wob = 1 + 0.08 * Math.sin(t * 11 + (side === 'R' ? 0 : 2));
        place(m, eye.cx + (side === 'R' ? -1 : 1) * span * 0.08, eye.y0 - len / 2 + fw * 0.03, span * 0.2 * wob, len, roll, m.userData.order, w);
      } else if (base === 'gloom') { const [x, y] = at(eyesX, eyesY + fw * 0.42); place(m, x, y, fw * 0.7, fw * 0.38, roll, m.userData.order, w * 0.9); }
      else if (base === 'vein') {
        const pulse = 1 + 0.15 * Math.max(0, Math.sin(t * 10));
        const [x, y] = at(-fw * 0.5, top - fw * 0.12);
        place(m, x, y, fw * 0.36 * pulse, fw * 0.36 * pulse, roll, m.userData.order, w);
      } else if (base === 'sweat') {
        const [x, y] = at(fw * 0.58, eyesY + fw * 0.22 - 0.04 * fw * ((t * 0.8) % 1));
        place(m, x, y, fw * 0.2, fw * 0.28, roll - 0.2, m.userData.order, w);
      }
    }
  }

  return {
    get current() { return current; },
    get held() { return held; },
    // her outfit: its colors ease in over a few frames, its accessories at once (stage.js covers the change with sparkles)
    wear(id) {
      const o = OUTFITS[id];
      if (!o) return false;
      current = id;
      for (const part of Object.keys(CLOTHES)) { from[part] = tints[part]; to[part] = tintMatrix(o[part]); }
      ease = 0;
      dress(id);
      return true;
    },
    hold(what) { held = what && (props[what] || what === 'umbrella') ? what : null; return true; },
    // the food she holds, at a stage (0 whole, 1 one bite, 2 two bites; a drink goes down instead)
    food(id, stage = 0) {
      const key = `${id}:${stage}`;
      if (key === foodNow) return true;
      foodNow = key;
      drawFood(foodCanvas.getContext('2d'), id, stage);
      foodTex.needsUpdate = true;
      return true;
    },
    update,
  };
}
