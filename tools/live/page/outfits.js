// AGI-1's live show (2026-10-07, the owner: "can change her clothes"): her outfits, made in code on her Live2D model (the
// owner's choice: "Made in code"). Her clothes keep their shape (her model's own drawing), and change color: each piece of
// clothing is drawn through a color matrix (hue, saturation and brightness, like CSS's filters, so her outlines and
// shading stay as drawn), and accessories drawn in code sit where her pieces are, every frame: cat ears, headphones,
// glasses, sunglasses, a bow, a headset mic, star clips, and things she holds (a mug, her phone, her snacks). PG-13 like
// everything she wears: only colors and accessories, never less of her clothes.
// (2026-10-07, her painted set; the owner after the first preview of her trips: the worst part was "Her hat and outfit"
// among the rest) Her accessories are paintings where they're there (paint.js: painted once by Google's image AI, cut out of
// their green background; PAINTED_ACC says which goes with which outfit), else drawn in code as before.
import * as THREE from 'three';
import { handPoint } from '../../../src/stage/agi1-2d-arms.js';
import { HOLD } from './moves.js';
import { drawFood, FOOD_SIZE, FOOD_SCALE, FOODS } from './food.js';
import { isPainted, paintLoad } from './paint.js';

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
// brightness; or (2026-10-07) a color it becomes outright (`rgb`), its shading kept: each pixel as bright against the
// lavender as it was (a turn of the hue went muddy for these: her white looked grey, her cream khaki, her navy olive), a
// little of the lavender left in (`keep`). null: as drawn
export const LAVENDER = [215, 170, 249];
export function tintMatrix(t) {
  if (!t) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  if (t.rgb) {
    const w = [0.2126, 0.7152, 0.0722], base = w[0] * LAVENDER[0] + w[1] * LAVENDER[1] + w[2] * LAVENDER[2], keep = t.keep ?? 0.1;
    return Array.from({ length: 9 }, (_, k) => {
      const r = Math.floor(k / 3), c = k % 3;
      return ((1 - keep) * t.rgb[r] * w[c]) / base + (r === c ? keep : 0);
    });
  }
  const m = mul(saturate(t.sat ?? 1), hueRotate(t.hue ?? 0));
  return m.map((x) => x * (t.val ?? 1));
}
const T = {
  pink: { hue: 54, sat: 1.7 }, hotpink: { hue: 62, sat: 2.3, val: 0.98 }, mint: { hue: -112, sat: 1.4 },
  sky: { hue: -68, sat: 1.5 }, honey: { hue: 132, sat: 2.2, val: 1.02 }, black: { sat: 0.35, val: 0.3 },
  cream: { rgb: [250, 236, 206] }, navy: { rgb: [50, 62, 132], keep: 0.06 }, red: { rgb: [232, 56, 72], keep: 0.06 },
  white: { rgb: [236, 232, 245] },
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
// (2026-10-07) the paintings of each outfit's accessories (tools/live/art.mjs paints them under these names)
export const PAINTED_ACC = {
  pinkpop: { bow: 'bow-pink' },
  midnight: { headphones: 'headphones-midnight' },
  mint: { glasses: 'glasses' },
  sunny: { sunglasses: 'heartglasses', clips: 'clips-mint' },
  cozy: { catEars: 'catears-white' },
  gamer: { headphones: 'headphones-gamer', catEars: 'catears-black' },
  stage: { headset: 'headset', clips: 'clips-honey' },
  newyork: { cap: 'cap-blue' },
  london: { scarf: 'scarf-london' },
  paris: { beret: 'beret-red', scarf: 'scarf-paris' },
  rome: { shades: 'shades-dark' },
  berlin: { beanie: 'beanie-yellow' },
  istanbul: { scarf: 'scarf-istanbul' },
  cairo: { sunhat: 'sunhat-pink', shades: 'shades-dark' },
  dubai: { shades: 'shades-gold' },
  agra: { garland: 'garland' },
  bangkok: { flower: 'flower-orchid' },
  halong: { conical: 'conical' },
  bali: { flower: 'flower-frangipani' },
  palawan: { shades: 'shades-pink', flower: 'flower-hibiscus' },
  tokyo: { sakura: 'sakura' },
  seoul: { beret: 'beret-lilac' },
  beijing: { bucket: 'bucket-cream' },
  rio: { shades: 'shades-dark', flower: 'flower-pink' },
  mexico: { sunhat: 'sunhat-mint', flower: 'flower-yellow' },
  space: { helmet: 'helmet' },
};
// where a painted one sits on her (her face's width = 1, from the middle of her face; y up): its width, and where it is: a
// hat or a headband by its bottom edge (its brim, its band) above her eyes (`brow`), something small in her hair or on her
// eyes by its middle (`eyes`), a scarf or a garland under her chin (`neck`); and a tilt. Measured on her set (2026-10-07:
// her face is about 185 px wide there, her eyes 260 px down, the top of her hair 65 px down), then tuned by eye with the
// paintings. (The first guesses, from the top of her hair's mesh, put every hat above her head: the mesh reaches higher
// than the hair painted on it.) An accessory's own id can carry its own (two sun hats aren't the same shape). sy: a
// little shorter than painted; order: where it's drawn among her pieces.
export const PAINT_AT = {
  hat: { w: 1.3, from: 'brow', y: 0.2 }, cap: { w: 1.38, from: 'brow', y: 0.11 }, beret: { w: 1.22, from: 'brow', y: 0.36, x: 0.12, rot: -0.12 },
  sunhat: { w: 1.9, from: 'brow', y: 0.2 }, conical: { w: 1.8, from: 'brow', y: 0.22 }, beanie: { w: 1.5, from: 'brow', y: 0.08 }, bucket: { w: 1.42, from: 'brow', y: 0.12 },
  catEars: { w: 1.75, from: 'brow', y: -0.08 },
  // (2026-10-08, the owner: "this headset is too big for her": 2.25 of her face's width, behind her face and the hair
  // beside it, its band floated over her hair and its cups stuck out past her head) her headphones on her head: from the
  // middle between her ears (`ears`: as she turns her head they stay at its sides), their cups' middles at her ears'
  // height, the inside of each cup just outside her face, their band on top of her hair, drawn over her hair (`mic`)
  headphones: { w: 1.643, from: 'ears', y: -0.397, order: 'mic' },
  // (2026-10-08, the owner: "headset not even on her ears": its cup sat beside her eye, 0.19 of her face's width above her
  // ear) its painting fitted to her head (PAINT_FIT): its cup's middle on her ear (her ears' middles are 0.45 out and 0.1
  // below her eyes, measured on her model), its band's top on her hair, its mic at her mouth; drawn over her hair and under a
  // hand by her face (`mic`: her laugh's hand over her mouth went under the boom)
  headset: { w: 1.2, from: 'brow', y: -0.651, x: -0.032, order: 'mic' },
  glasses: { w: 1.08, from: 'eyes', y: 0.0 }, bow: { w: 0.75, from: 'eyes', y: 0.72, x: 0.55, rot: -0.35 }, clips: { w: 0.6, from: 'eyes', y: 0.85, x: 0.45, rot: -0.25 },
  flower: { w: 0.55, from: 'eyes', y: 0.4, x: 0.62, rot: -0.2 }, sakura: { w: 0.85, from: 'eyes', y: 0.7, x: 0.55, rot: -0.35 },
  neck: { w: 1.5, from: 'neck', y: 0 }, garland: { w: 1.75, from: 'neck', y: -0.05 }, helmet: { w: 2.2, from: 'eyes', y: 0.0 },
  // their own: the black cat ears are taller (their tips left the picture), the lilac beret bigger than the red one, the
  // flower under Mexico's sun hat by her ear (on the hat's brim it was lost)
  'catears-black': { w: 1.55, y: -0.22 }, 'beret-lilac': { w: 1.12, y: 0.3 }, 'flower-yellow': { y: 0.12, x: 0.68 },
};
// (2026-10-08, the owner's screenshot: the conical hat perched above her head) a hat she wears with her head inside it,
// painted from a little below (its underside showing): all of it behind her face and her hair, its outside (the cone, down
// to its lip: `lip`, the lip's curve in the picture, y = lip[0] + lip[1] (x − ½)², both 0..1 of its size) in front of them
export const PAINT_SPLIT = { conical: { lip: [0.478, 0.8] } };
// (2026-10-08, the owner: "headset not even on her ears") a painting that doesn't fit her head as it's painted (its band a
// round arc, her head taller than wide: its cups came out by her eyes): its rows [a, b] stretched, `add` px more in all,
// most where its band's sides are straight (a smooth bump: its arc stays round at the top, its thickness as painted), so its
// cups come down to her ears and its band stays on her hair; and a part of it turned on its own (`swing`: its mic's boom,
// below `cut`, and below side[0] left of side[1], about `pivot` (where it leaves the cup), `deg` up: its mic, lower with
// the stretch, back at her mouth). In the painting's own pixels (headset.webp, 431 × 512).
// (2026-10-08, the owner: "this headset is too big for her") her headphones, smaller: painted with their cups close
// together for her head (at the size that puts them at its sides, the cups were tall from her eyebrows to her mouth), so
// their band's middle is widened too (`cols`, `addX` px more: the cups farther apart, as painted) and its sides lengthened
// (`rows`), so at a smaller size the inside of each cup is just outside her face and the band on top of her hair
// (headphones-midnight.webp 472 × 512, headphones-gamer.webp 464 × 512: its band thinner, so a little less of it).
export const PAINT_FIT = {
  headset: { rows: [110, 270], add: 99, swing: { cut: 374, side: [364, 39], pivot: [26, 364], deg: 16.5 } },
  'headphones-midnight': { rows: [150, 268], add: 51, cols: [128, 344], addX: 58 },
  'headphones-gamer': { rows: [150, 268], add: 41, cols: [124, 340], addX: 66 },
};
// where row y (or column x) of a painting goes once it's fitted (∫ 1 + k sin²: the stretch grows and fades smoothly; k:
// `add` in all)
function stretched(v, [a, b], add) {
  if (!add || v <= a) return v;
  if (v >= b) return v + add;
  const u = (v - a) / (b - a);
  return v + 2 * add * (u / 2 - Math.sin(2 * Math.PI * u) / (4 * Math.PI));
}
export const fitRow = (y, fit) => (fit.rows ? stretched(y, fit.rows, fit.add) : y);
export const fitCol = (x, fit) => (fit.cols ? stretched(x, fit.cols, fit.addX) : x);
// the painting fitted: its body (the swinging part taken out) and the swinging part, each a canvas of the fitted size
function fitPainting(img, fit) {
  const W = img.width, H = img.height, H2 = H + (fit.rows ? fit.add : 0), W2 = W + (fit.cols ? fit.addX : 0);
  // its rows, then its columns: each one in between from the one of the painting that lands there (the stretch grows:
  // halving finds it)
  let src = img;
  if (fit.rows) {
    const c = document.createElement('canvas');
    c.width = W; c.height = H2;
    const g = c.getContext('2d'), [a, b] = fit.rows;
    g.drawImage(src, 0, 0, W, a, 0, 0, W, a);
    g.drawImage(src, 0, b, W, H - b, 0, b + fit.add, W, H - b);
    for (let yo = a; yo < b + fit.add; yo++) {
      let lo = a, hi = b;
      for (let k = 0; k < 24; k++) { const mid = (lo + hi) / 2; if (fitRow(mid, fit) < yo + 0.5) lo = mid; else hi = mid; }
      g.drawImage(src, 0, Math.min(H - 1, Math.floor(lo)), W, 1, 0, yo, W, 1);
    }
    src = c;
  }
  if (fit.cols) {
    const c = document.createElement('canvas');
    c.width = W2; c.height = H2;
    const g = c.getContext('2d'), [a, b] = fit.cols;
    g.drawImage(src, 0, 0, a, H2, 0, 0, a, H2);
    g.drawImage(src, b, 0, W - b, H2, b + fit.addX, 0, W - b, H2);
    for (let xo = a; xo < b + fit.addX; xo++) {
      let lo = a, hi = b;
      for (let k = 0; k < 24; k++) { const mid = (lo + hi) / 2; if (fitCol(mid, fit) < xo + 0.5) lo = mid; else hi = mid; }
      g.drawImage(src, Math.min(W - 1, Math.floor(lo)), 0, 1, H2, xo, 0, 1, H2);
    }
    src = c;
  }
  let body = src;
  if (body === img) { body = document.createElement('canvas'); body.width = W; body.height = H; body.getContext('2d').drawImage(img, 0, 0); }
  if (!fit.swing) return { body };
  const g = body.getContext('2d');
  const s = fit.swing, at = (y) => fitRow(y, fit), sx = fitCol(s.side[1], fit);
  const region = (c) => { c.beginPath(); c.rect(0, at(s.cut), W2, H2 - at(s.cut)); c.rect(0, at(s.side[0]), sx, at(s.cut) - at(s.side[0])); };
  const swing = document.createElement('canvas');
  swing.width = W2; swing.height = H2;
  const q = swing.getContext('2d');
  region(q); q.clip();
  q.drawImage(body, 0, 0);
  g.globalCompositeOperation = 'destination-out';
  region(g); g.fill();
  return { body, swing };
}
const PAINT_SLOT = { bow: 'bow', headphones: 'headphones', glasses: 'glasses', sunglasses: 'glasses', shades: 'glasses', clips: 'clips', catEars: 'ears',
  headset: 'headset', cap: 'hat', beret: 'hat', sunhat: 'hat', bucket: 'hat', beanie: 'hat', conical: 'hat', scarf: 'neck', garland: 'neck', flower: 'flower',
  sakura: 'sakura', helmet: 'helmet' };
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
  // (2026-10-07, her painted set: the striped pink and honey one looked like clip art in front of the paintings) a clear
  // umbrella, as in anime: see-through, a soft highlight, thin silver ribs, raindrops on it; the set shows through it
  canopy: (col) => canvas(300, 170, (g) => {
    const dome = () => {
      g.beginPath(); g.moveTo(10, 130); g.bezierCurveTo(20, 10, 280, 10, 290, 130);
      for (let i = 5; i > 0; i--) { const x0 = 10 + (i * 280) / 5, x1 = 10 + ((i - 1) * 280) / 5; g.quadraticCurveTo((x0 + x1) / 2, 116, x1, 130); }
      g.closePath();
    };
    dome();
    const fill = g.createLinearGradient(0, 20, 0, 135);
    fill.addColorStop(0, col.umbrella || 'rgba(255, 255, 255, 0.42)'); fill.addColorStop(1, col.umbrella2 || 'rgba(228, 217, 255, 0.24)');
    g.fillStyle = fill; g.fill();
    g.lineJoin = 'round'; g.lineWidth = 3.5; g.strokeStyle = 'rgba(92, 84, 128, 0.75)'; g.stroke();
    // its ribs, thin and silver, and a lighter edge where the panels meet the rim
    g.lineWidth = 2; g.strokeStyle = 'rgba(150, 146, 176, 0.8)';
    for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(150, 34); g.quadraticCurveTo(10 + (i * 280) / 5 + (i - 2.5) * 10, 70, 10 + (i * 280) / 5, 129); g.stroke(); }
    // a soft highlight across its top-left, as light catches the plastic
    g.save(); dome(); g.clip();
    g.beginPath(); g.ellipse(102, 64, 78, 20, -0.42, 0, Math.PI * 2); g.fillStyle = 'rgba(255, 255, 255, 0.5)'; g.fill();
    g.beginPath(); g.ellipse(214, 58, 30, 8, 0.35, 0, Math.PI * 2); g.fillStyle = 'rgba(255, 255, 255, 0.35)'; g.fill();
    g.restore();
    // raindrops on it
    for (const [x, y, r] of [[70, 92, 4], [118, 104, 3], [186, 86, 4.5], [236, 104, 3], [150, 70, 3], [92, 60, 2.5], [210, 56, 2.5]]) {
      g.beginPath(); g.ellipse(x, y, r * 0.8, r, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(255, 255, 255, 0.75)'; g.fill();
      g.lineWidth = 1.2; g.strokeStyle = 'rgba(92, 84, 128, 0.45)'; g.stroke();
    }
    g.beginPath(); g.arc(150, 30, 6, 0, Math.PI * 2); g.fillStyle = '#d9d4ec'; g.fill(); g.lineWidth = 2; g.strokeStyle = 'rgba(92, 84, 128, 0.85)'; g.stroke();
  }),
  // (2026-10-08: as long as a real umbrella's, its handle a pink grip and a little hook at its end; resting on her shoulder,
  // held behind her, that end is behind her, out of sight)
  shaft: () => canvas(32, 512, (g) => {
    const rod = g.createLinearGradient(13, 0, 19, 0);
    rod.addColorStop(0, '#8d88a6'); rod.addColorStop(0.5, '#eeeaf8'); rod.addColorStop(1, '#8d88a6');
    g.fillStyle = rod; g.fillRect(14, 0, 4, 400);
    // its handle: a pink grip, then its hook
    const grip = g.createLinearGradient(9, 0, 23, 0);
    grip.addColorStop(0, '#e2508f'); grip.addColorStop(0.45, '#ff8cc0'); grip.addColorStop(1, '#d9407f');
    g.fillStyle = grip; g.beginPath(); g.roundRect(9, 384, 14, 92, 6); g.fill();
    g.lineWidth = 2.5; g.strokeStyle = 'rgba(120, 30, 70, 0.6)'; g.stroke();
    g.lineCap = 'round'; g.lineWidth = 10; g.strokeStyle = '#ff7eb6';
    g.beginPath(); g.moveTo(16, 472); g.lineTo(16, 486); g.quadraticCurveTo(16, 506, 4, 498); g.stroke();
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
  // things she holds: a mug (96 × 96) and her phone (64 × 112)
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
// (2026-10-08) her umbrella, resting on her right shoulder, held behind her (her face's widths): where its shaft rests on
// her shoulder (from her shoulder joint: out, up), how far it leans out from upright (degrees), its length above that and
// below it (behind her), its width, its canopy's width; the canopy picture's apex (where the shaft ends) above its middle
export const UMBRELLA = { rest: [0.12, 0.42], tilt: -15, above: 3, below: 1.6, width: 0.13, canopy: 4.3 };
const CANOPY_APEX = 0.32;
const HATS = ['cap', 'beret', 'sunhat', 'bucket', 'beanie', 'conical'];
// where each hat sits (her face's width = 1): its width, and where its middle is above the top of her hair (her head's
// tilt follows). Tuned by eye on her set (2026-10-07)
const HAT_AT = { cap: { w: 1.6, y: -0.52 }, beret: { w: 1.3, y: -0.31, x: 0.12, rot: 0.08 }, sunhat: { w: 2.4, y: -0.45 }, bucket: { w: 1.65, y: -0.52 },
  beanie: { w: 1.55, y: -0.48 }, conical: { w: 2.3, y: -0.38 } };
// her cartoon marks (moves.js `emote`): which pictures, and where
export const EMOTES = ['hearts', 'stars', 'spiral', 'tears', 'gloom', 'vein', 'sweat'];

// her hand drawn again over what she holds, only where her thumb or her fingers are (her hand's own frame, a vertex
// attribute: so it follows her hand however it bends, turns or curls)
const GRIP_VERT = /* glsl */`
  attribute vec2 hl;
  varying vec2 vUv;
  varying vec2 vHl;
  void main() { vUv = uv; vHl = hl; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const GRIP_FRAG = /* glsl */`
  uniform sampler2D map;
  uniform float opacity;
  uniform vec3 mulColor;
  uniform vec3 scrColor;
  uniform float part;
  uniform float fade;
  varying vec2 vUv;
  varying vec2 vHl;
  void main() {
    float a = vHl.x, b = vHl.y;
    // 1: her thumb (out on the far side of her hand, above its ball, before her knuckles: never her palm's edge below it,
    // which showed as a line across her mug); 2: her fingers (past her knuckles)
    float m = part < 1.5 ? (1.0 - smoothstep(-0.24, -0.15, b)) * smoothstep(0.3, 0.36, a) * (1.0 - smoothstep(0.54, 0.62, a)) : smoothstep(0.5, 0.6, a);
    if (m < 0.004) discard;
    vec4 c = texture2D(map, vUv);
    c.rgb *= mulColor;
    c.rgb = c.rgb + scrColor * c.a - c.rgb * scrColor;
    gl_FragColor = c * opacity * fade * m;
  }`;
const GRIP_PART = { thumb: 1, fingers: 2 };
// (2026-10-08) her elbow bent far, her hand up by her face: the ends of her upper arm and her forearm are drawn soft, to lie
// over each other on a straight arm, and nothing of her drawing is the round of a bent elbow: its end showed as a pale,
// see-through cuff with odd lines. A small round elbow in her skin's colors, just under her forearm (so her forearm's soft
// end fades into it), its outline round its end, lit on her thumb's side like her forearm. In her quad's own frame: y away
// from her forearm, x across it toward her little finger's side.
const ELBOW_VERT = /* glsl */`
  varying vec2 vP;
  void main() { vP = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const ELBOW_FRAG = /* glsl */`
  uniform float opacity;
  uniform float w;
  uniform float flip;
  uniform vec3 skin;
  uniform vec3 shade;
  uniform vec3 line;
  uniform vec3 lineLit;
  varying vec2 vP;
  void main() {
    float r = length(vP);
    float fill = 1.0 - smoothstep(0.95, 1.0, r);
    if (fill <= 0.0) discard;
    float x = vP.x * flip, y = vP.y;
    float ring = smoothstep(0.85, 0.9, r) * smoothstep(-0.3, 0.15, y);
    float dark = smoothstep(-0.7, 0.8, x);
    vec3 c = mix(skin, shade, 0.15 + 0.55 * dark * smoothstep(0.35, 0.95, r) * smoothstep(-0.4, 0.6, y));
    c = mix(c, mix(lineLit, line, dark), ring);
    float a = fill * opacity * w;
    gl_FragColor = vec4(c * a, a);
  }`;
// her skin (her forearm's, as drawn: its middle, its shaded side) and her outline (its dark side, its lit side), 0..255
const ELBOW_COLORS = { skin: [254, 219, 192], shade: [246, 190, 164], line: [160, 98, 78], lineLit: [205, 168, 138] };
// how far bent before it shows (the cosine between her upper arm and her forearm, from her elbow: −1 straight, 1 folded
// flat: from about 110° apart, all of it by 70°), its radius (forearm lengths: her forearm's half width there, a little
// more) and where its middle is across her forearm (her forearm's middle is a little toward her thumb's side)
export const ELBOW_FOLD = [-0.34, 0.34];
export const ELBOW_R = 0.18, ELBOW_ACROSS = -0.013;
const smoothstep = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
// (2026-10-08) what she holds fades in and out (in this many frames) instead of popping into her hand and out of it
export const HELD_FADE = 6;
// ---------- her wardrobe ----------
// model: her puppet (src/stage/agi1-2d.js). wear(id) changes her outfit (its colors ease in), hold('mug' | 'phone' | 'food' |
// 'umbrella' | null) puts something in her right hand (on the left of the picture; her umbrella on her right shoulder),
// food(id, stage) is the food she holds (food.js: whole, one bite, two bites). Call update(emote) from her model's
// hooks.afterDeform: emote is moves.js's { kind, w } (her cartoon marks: heart eyes, tears…) or null.
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
  // (2026-10-08) what's drawn in her hand: what she holds, fading in (heldK up to 1), or what she held, fading out
  let shown = null, heldK = 0;
  // the food she holds: its own small canvas, drawn again for each bite
  const foodCanvas = document.createElement('canvas');
  foodCanvas.width = foodCanvas.height = FOOD_SIZE;
  const foodTex = new THREE.CanvasTexture(foodCanvas);
  foodTex.colorSpace = THREE.SRGBColorSpace;
  let foodNow = null;
  const props = { mug: sprite(DRAW.mug(), 'held'), phone: sprite(DRAW.phone(), 'held'), food: sprite(foodTex, 'held'),
    canopy: sprite(DRAW.canopy({}), 'top'), shaft: sprite(DRAW.shaft(), 'held') };
  for (const p of Object.values(props)) group.add(p);
  // (2026-10-08) her hand drawn again over what she holds, only her fingers or her thumb (HOLD.grip): for each hand, her
  // fingers, then her thumb over them
  const grips = {};
  for (const side of ['R', 'L']) {
    const arm = model.drawnArms?.[side], i = arm?.pieces.hand, mesh = meshes[i], local = arm?.local?.[i];
    if (!mesh || !local || local.length !== mesh.geometry.attributes.position.count * 2) continue;
    mesh.geometry.setAttribute('hl', new THREE.BufferAttribute(local, 2));
    const u = mesh.material.uniforms;
    grips[side] = ['fingers', 'thumb'].map((part) => {
      const mat = new THREE.ShaderMaterial({
        uniforms: { map: u.map, opacity: u.opacity, mulColor: u.mulColor, scrColor: u.scrColor, part: { value: GRIP_PART[part] }, fade: { value: 0 } },
        vertexShader: GRIP_VERT, fragmentShader: GRIP_FRAG, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
      });
      for (const k of ['blending', 'blendEquation', 'blendEquationAlpha', 'blendSrc', 'blendDst', 'blendSrcAlpha', 'blendDstAlpha']) mat[k] = mesh.material[k];
      const g = new THREE.Mesh(mesh.geometry, mat);
      g.name = `${mesh.name}-${part}`;
      g.frustumCulled = false;
      g.visible = false;
      g.userData.part = part;
      model.meshes.group.add(g);
      return g;
    });
  }
  // (2026-10-08) her round elbow when it's bent far (ELBOW_FRAG), one for each arm
  const elbows = {};
  for (const side of ['R', 'L']) {
    const arm = model.drawnArms?.[side], fm = arm && meshes[arm.pieces.fore];
    if (!fm) continue;
    const v3 = (c) => new THREE.Vector3(c[0] / 255, c[1] / 255, c[2] / 255);
    const mat = new THREE.ShaderMaterial({
      uniforms: { opacity: fm.material.uniforms.opacity, w: { value: 0 }, flip: { value: arm.inward || 1 }, skin: { value: v3(ELBOW_COLORS.skin) },
        shade: { value: v3(ELBOW_COLORS.shade) }, line: { value: v3(ELBOW_COLORS.line) }, lineLit: { value: v3(ELBOW_COLORS.lineLit) } },
      vertexShader: ELBOW_VERT, fragmentShader: ELBOW_FRAG, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
    });
    for (const k of ['blending', 'blendEquation', 'blendEquationAlpha', 'blendSrc', 'blendDst', 'blendSrcAlpha', 'blendDstAlpha']) mat[k] = fm.material[k];
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    m.name = `elbow_${side}`;
    m.frustumCulled = false;
    m.visible = false;
    group.add(m);
    elbows[side] = m;
  }
  // (2026-10-08) a hand by her face (a bite, her cheek, her chin): her forearm and hand drawn over her face and her hair
  // (moves.js `front`); her arms are drawn under them otherwise, as her model has them
  const armPieces = { R: ['forearm_R', 'hand_R'].map(piece), L: ['forearm_L', 'hand_L'].map(piece) };
  const ownOrder = {};
  let fronted = { R: false, L: false };
  function front(which) {
    const top = Math.max(meshes[P.hairL].renderOrder, meshes[P.hairR].renderOrder, meshes[P.sideL].renderOrder, meshes[P.sideR].renderOrder);
    for (const side of ['R', 'L']) {
      const on = Boolean(which?.[side]);
      if (on === fronted[side]) continue;
      fronted[side] = on;
      armPieces[side].forEach((i, k) => {
        const m = meshes[i];
        if (!m) return;
        if (on) { ownOrder[i] = m.renderOrder; m.renderOrder = top + (side === 'R' ? 0.2e-4 : 0.6e-4) + k * 0.1e-4; }
        else if (ownOrder[i] !== undefined) m.renderOrder = ownOrder[i];
      });
    }
  }
  // her cartoon marks: two of each eye mark, two tears, the rest one
  const marks = {
    heartsR: sprite(DRAW.heartEye(), 'behindBangs'), heartsL: sprite(DRAW.heartEye(), 'behindBangs'),
    starsR: sprite(DRAW.starEye(), 'behindBangs'), starsL: sprite(DRAW.starEye(), 'behindBangs'),
    spiralR: sprite(DRAW.spiralEye(), 'behindBangs'), spiralL: sprite(DRAW.spiralEye(), 'behindBangs'),
    tearsR: sprite(DRAW.tear(), 'behindBangs'), tearsL: sprite(DRAW.tear(), 'behindBangs'),
    gloom: sprite(DRAW.gloom(), 'top'), vein: sprite(DRAW.vein(), 'top'), sweat: sprite(DRAW.sweat(), 'top'),
  };
  for (const m of Object.values(marks)) group.add(m);
  // (2026-10-07) her painted accessories: loaded once (prepare(id) before an outfit goes on), kept for the show
  const painted = {};
  async function prepare(id) {
    await Promise.all(Object.values(PAINTED_ACC[id] || {}).filter((pid) => !painted[pid] && isPainted('accessories', pid)).map(async (pid) => {
      const img = await paintLoad('accessories', pid);
      if (!img || painted[pid]) return;
      // (a painting fitted to her head first: its body, and the part that swings on its own)
      const fit = PAINT_FIT[pid] && fitPainting(img, PAINT_FIT[pid]);
      const texOf = (src) => {
        const tex = src instanceof HTMLCanvasElement ? new THREE.CanvasTexture(src) : new THREE.Texture(src);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 1;
        tex.needsUpdate = true;
        return tex;
      };
      painted[pid] = texOf(fit ? fit.body : img);
      if (fit?.swing) painted[`${pid}:swing`] = texOf(fit.swing);
      // (a hat she wears with her head inside it: its front, the part in front of her head, as a picture of its own)
      const split = PAINT_SPLIT[pid];
      if (split) {
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        const g = c.getContext('2d');
        g.drawImage(img, 0, 0);
        g.globalCompositeOperation = 'destination-out';
        g.beginPath();
        for (let k = 0; k <= 64; k++) { const x = k / 64; g.lineTo(x * c.width, (split.lip[0] + split.lip[1] * (x - 0.5) ** 2) * c.height); }
        g.lineTo(c.width, c.height); g.lineTo(0, c.height); g.closePath();
        g.fill();
        const front = new THREE.CanvasTexture(c);
        front.colorSpace = THREE.SRGBColorSpace;
        front.anisotropy = 1;
        painted[`${pid}:front`] = front;
      }
    }));
    return true;
  }
  function dress(id) {
    for (const it of Object.values(items)) { group.remove(it); if (!it.userData.kept) it.material.map.dispose(); it.material.dispose(); it.geometry.dispose(); }
    items = {};
    const o = OUTFITS[id] || OUTFITS.classic, col = o.colors || {};
    for (const a of o.acc) {
      // painted (if its painting is there and loaded): one picture where it goes
      const pid = PAINTED_ACC[id]?.[a], tex = pid && painted[pid];
      if (tex) {
        const slot = PAINT_SLOT[a] || a;
        const order = slot === 'glasses' || slot === 'ears' ? 'behindBangs' : slot === 'neck' ? 'neck' : 'top';
        const it = sprite(tex, order);
        it.userData.kept = true;
        it.userData.paint = a;
        it.userData.pid = pid;
        items[slot] = it;
        // (a hat her head is inside: all of it behind her face and her hair, its front over them)
        const front = painted[`${pid}:front`];
        if (front) {
          it.userData.order = 'underFace';
          it.userData.split = true;
          const f = sprite(front, 'top');
          Object.assign(f.userData, { kept: true, paint: a, pid, split: true, front: true });
          items[`${slot}Front`] = f;
        }
        // (its part that swings on its own: placed with it, below)
        const swing = painted[`${pid}:swing`];
        if (swing) {
          const s = sprite(swing, 'top');
          Object.assign(s.userData, { kept: true, pid, swing: true });
          it.userData.swing = s;
          items[`${slot}Swing`] = s;
        }
        continue;
      }
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
    earL: piece('ear_L'), earR: piece('ear_R'), eyeL: piece('eye_white_L'), eyeR: piece('eye_white_R'), handR: piece('hand_R'), handL: piece('hand_L'), mouth: piece('mouth_line'),
    print: piece('shirt_print'), upperR: piece('upper_arm_R'),
  };
  const box = (i) => {
    const p = D.vertexPositions[i];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, sx = 0, sy = 0;
    for (let k = 0; k < p.length; k += 2) { const x = p[k], y = p[k + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; sx += x; sy += y; }
    const n = p.length / 2;
    return { x0, y0, x1, y1, cx: sx / n, cy: sy / n, w: x1 - x0, h: y1 - y0 };
  };
  const lowest = Math.min(...meshes.filter(Boolean).map((m) => m.renderOrder));
  const place = (mesh, x, y, w, h, rot, order, opacity = 1) => {
    mesh.position.set(x, y, 0);
    mesh.scale.set(w, h, 1);
    mesh.rotation.z = rot;
    const ro = { behindBangs: Math.min(meshes[P.hairL].renderOrder, meshes[P.hairR].renderOrder) - 1e-4,
      top: Math.max(meshes[P.hairL].renderOrder, meshes[P.hairR].renderOrder, meshes[P.sideL].renderOrder, meshes[P.sideR].renderOrder) + 1e-4,
      // (2026-10-08, her headset: over her hair, under a hand by her face, front())
      mic: Math.max(meshes[P.hairL].renderOrder, meshes[P.hairR].renderOrder, meshes[P.sideL].renderOrder, meshes[P.sideR].renderOrder) + 0.1e-4,
      hand: meshes[P.handR].renderOrder - 1e-4,
      // (2026-10-08: what she holds, over her hand; her thumb or her fingers drawn again over it)
      held: meshes[P.handR].renderOrder + 0.05e-4,
      // (a scarf or a garland: over her shirt, under her arms, her face and her hair)
      neck: meshes[P.print].renderOrder + 1e-4,
      // (her umbrella's shaft: in her hand, behind her upper arm)
      under: meshes[P.upperR].renderOrder - 1e-4,
      // (behind her face and her hair: the conical hat's underside, PAINT_SPLIT)
      underFace: meshes[P.face].renderOrder - 1e-4,
      // (her umbrella, held behind her: behind all of her)
      behind: lowest - 1e-4 }[order];
    mesh.renderOrder = ro;
    mesh.material.opacity = opacity;
    mesh.visible = opacity > 0.01;
  };
  let t = 0;
  const norm = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const spots = { mouth: [0, 0], chin: [0, 0], cheekR: [0, 0], cheekL: [0, 0], eyeR: [0, 0], eyeL: [0, 0], earR: [0, 0], earL: [0, 0],
    top: [0, 0], face: [0, 0], shoulderR: [0, 0], shoulderL: [0, 0], fw: 0.148, roll: 0 };
  let spotsReady = false;

  function update(emote = null, extra = {}) {
    t += 1 / 30;
    front(extra.front);
    if (ease < 1) { ease = Math.min(1, ease + 1 / 12); apply(); }
    const face = box(P.face), eL = box(P.eyeL), eR = box(P.eyeR);
    const roll = Math.atan2(eL.cy - eR.cy, eL.cx - eR.cx);           // her head's tilt (R is on the left of the picture)
    const cos = Math.cos(roll), sin = Math.sin(roll);
    const at = (dx, dy) => [face.cx + dx * cos - dy * sin, face.cy + dx * sin + dy * cos];
    const fw = face.w, eyesY = (eL.cy + eR.cy) / 2 - face.cy, eyesX = (eL.cx + eR.cx) / 2 - face.cx;
    const top = Math.max(box(P.hairL).y1, box(P.hairR).y1) - face.cy;
    const span = Math.hypot(eL.cx - eR.cx, eL.cy - eR.cy);
    const earL = box(P.earL), earR = box(P.earR), chin = face.y0;
    // (2026-10-08) the spots of her face and body her hands reach for (moves.js), without her hips' shift (her arms' frame)
    {
      const hip = model.posture.hip, mouth = box(P.mouth), put = (k, x, y) => { spots[k][0] = x - hip; spots[k][1] = y; };
      put('mouth', mouth.cx, mouth.cy);
      put('chin', ...at(0, chin - face.cy));
      put('cheekR', ...at(eyesX - fw * 0.4, eyesY - fw * 0.22));
      put('cheekL', ...at(eyesX + fw * 0.4, eyesY - fw * 0.22));
      put('eyeR', eR.cx, eR.cy); put('eyeL', eL.cx, eL.cy);
      put('earR', earR.cx, earR.cy); put('earL', earL.cx, earL.cy);
      put('top', ...at(0, top)); put('face', face.cx, face.cy);
      for (const side of ['R', 'L']) { const S = model.drawnArms?.[side]?.now.base?.S; if (S) { spots[`shoulder${side}`][0] = S[0]; spots[`shoulder${side}`][1] = S[1]; } }
      spots.fw = fw; spots.roll = roll;
      spotsReady = true;
    }
    for (const [k, it] of Object.entries(items)) {
      if (it.userData.paint) {
        // a painting: its width (her face's), where its middle is, its own shape
        const a = it.userData.paint, kind = PAINT_AT[a] ? a : ['cap', 'beret', 'sunhat', 'bucket', 'beanie', 'conical'].includes(a) ? 'hat'
          : a === 'scarf' ? 'neck' : a === 'sunglasses' || a === 'shades' ? 'glasses' : a;
        // (its own place if it has one: two sun hats or berets aren't the same shape)
        const at0 = { ...(PAINT_AT[kind] || PAINT_AT.hat), ...(PAINT_AT[it.userData.pid] || {}) };
        const img = it.material.map.image, w = fw * at0.w * (kind === 'glasses' ? span / fw * 2.1 : 1);
        const h = (w * img.height * (at0.sy || 1)) / img.width;          // (sy: a little shorter, like headphones' tall band)
        let x, y;
        if (at0.from === 'eyes') [x, y] = at(eyesX + fw * (at0.x || 0), eyesY + fw * at0.y);
        else if (at0.from === 'brow') [x, y] = at(eyesX + fw * (at0.x || 0), eyesY + fw * at0.y + h / 2);
        else if (at0.from === 'ear') { x = earL.cx + fw * (at0.x || 0); y = earL.cy + fw * at0.y; }
        else if (at0.from === 'ears') {
          // (2026-10-08) from the middle between her ears, by its bottom edge: the sides of her head, which stay where they
          // are as she turns her head (her eyes move across her face; anchored to them, a cup slid over her cheek)
          const mx = (earR.cx + earL.cx) / 2, my = (earR.cy + earL.cy) / 2, ox = fw * (at0.x || 0), oy = fw * at0.y + h / 2;
          x = mx + ox * cos - oy * sin; y = my + ox * sin + oy * cos;
        }
        else if (at0.from === 'neck') { x = face.cx + fw * (at0.x || 0); y = chin - h / 2 + fw * (0.06 + at0.y); }
        else [x, y] = at(fw * (at0.x || 0), top + h / 2 + fw * at0.y - fw * 0.25);
        const rot = (at0.from === 'neck' ? roll * 0.3 : roll) + (at0.rot || 0), order = it.userData.split ? it.userData.order : at0.order || it.userData.order;
        place(it, x, y, w, h, rot, order);
        // (its part that swings on its own, turned about its pivot: the same size of picture, so the pivot is the same point
        // of both)
        const sw = it.userData.swing, fit = PAINT_FIT[it.userData.pid];
        if (sw && fit?.swing) {
          const [px, py] = fit.swing.pivot, lx = (fitCol(px, fit) / img.width - 0.5) * w, ly = (0.5 - fitRow(py, fit) / img.height) * h;
          const c0 = Math.cos(rot), s0 = Math.sin(rot), r1 = rot + (fit.swing.deg * Math.PI) / 180, c1 = Math.cos(r1), s1 = Math.sin(r1);
          const wx = x + lx * c0 - ly * s0, wy = y + lx * s0 + ly * c0;
          place(sw, wx - lx * c1 + ly * s1, wy - lx * s1 - ly * c1, w, h, r1, order);
        }
        continue;
      }
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
    // what she holds, in her right hand (on the left of the picture): in her hand's own frame (HOLD), in front of her palm,
    // her fingers or her thumb drawn again over it (2026-10-08: it floated past her fingertips before); fading in as it
    // comes and out as it goes (heldK)
    if (held !== shown) { heldK = Math.max(0, heldK - 1 / HELD_FADE); if (heldK === 0) shown = held; }
    else heldK = Math.min(1, heldK + 1 / HELD_FADE);
    const arm = model.drawnArms?.R || model.arms.R, hip = model.posture.hip;
    let grip = null;
    for (const [k, p] of Object.entries(props)) {
      const on = heldK > 0 && (shown === k || (shown === 'umbrella' && (k === 'canopy' || k === 'shaft')));
      if (!on || !arm) { p.visible = false; continue; }
      const hd = arm.now.hand, Lh = Math.hypot(hd.u[0], hd.u[1]);
      const up = Math.atan2(hd.u[1], hd.u[0]) - Math.PI / 2;            // turned with her hand: its top toward her fingertips
      const drink = k === 'food' && FOODS[(foodNow || '').split(':')[0]]?.drink;
      const H = k === 'shaft' || k === 'canopy' ? {} : HOLD[drink ? 'drink' : k], img = p.material.map.image;
      const [cx, cy] = handPoint(arm, H.a ?? 0.6, H.b ?? 0);
      if (k === 'shaft' || k === 'canopy') {
        // her umbrella (2026-10-08: held up in her hand it showed her hand floating by her shoulder with her arm hanging
        // under it, the owner: "????"; her drawn hand can't close round a handle): resting on her right shoulder, held
        // behind her, its canopy over her head and behind it, its shaft coming out from behind her shoulder
        const S = arm.now.S, t = (UMBRELLA.tilt * Math.PI) / 180;
        const ax = arm.sign * Math.sin(t), ay = Math.cos(t);                // up its shaft (out over her shoulder)
        const rx = S[0] + arm.sign * fw * UMBRELLA.rest[0], ry = S[1] + fw * UMBRELLA.rest[1];
        const above = fw * UMBRELLA.above, below = fw * UMBRELLA.below, rot = Math.atan2(ay, ax) - Math.PI / 2;
        if (k === 'shaft') {
          const mid = (above - below) / 2;
          place(p, rx + hip + ax * mid, ry + ay * mid, fw * UMBRELLA.width, above + below, rot, 'behind', heldK);
        } else {
          // (its top, where the shaft ends, is its picture's apex: CANOPY_APEX of its height above its middle)
          const w = fw * UMBRELLA.canopy, h = (w * 170) / 300, top2 = above - h * CANOPY_APEX;
          place(p, rx + hip + ax * top2, ry + ay * top2, w, h, rot, 'behind', heldK);
        }
        continue;
      }
      let w = H.w * Lh;
      if (k === 'food') { const fid = shown === 'food' && foodNow ? foodNow.split(':')[0] : ''; w *= FOOD_SCALE[fid] || 1; }
      const rot = H.upright !== undefined ? norm(up) * (1 - H.upright) : up + ((H.rot || 0) * Math.PI) / 180;
      place(p, cx + hip, cy, w, (w * img.height) / img.width, rot, 'held', heldK);
      grip = H.grip;
    }
    // her fingers and her thumb drawn again over what she holds (HOLD.grip)
    for (const [side, parts] of Object.entries(grips)) {
      const hand = meshes[side === 'R' ? P.handR : P.handL];
      for (const g of parts) {
        const part = g.userData.part;
        // (her thumb over what she holds; her fingers over what she holds, and her thumb over them)
        const on = side === 'R' && grip && (grip === part || (grip === 'fingers' && part === 'thumb'));
        g.visible = Boolean(on) && hand.visible && heldK > 0.01;
        g.material.uniforms.fade.value = heldK;
        if (g.visible) g.renderOrder = hand.renderOrder + (part === 'fingers' ? 0.1e-4 : 0.15e-4);
      }
    }
    // her round elbow, when it's bent far: from straight (nothing) to her forearm folded up beside her upper arm (all of
    // it), at her elbow joint, just under her forearm (wherever her forearm is drawn: over her hair, by her face)
    for (const [side, cap] of Object.entries(elbows)) {
      const arm = model.drawnArms[side], n = arm.now, fm = meshes[arm.pieces.fore];
      const u1x = n.S[0] - n.E[0], u1y = n.S[1] - n.E[1], u2x = n.W[0] - n.E[0], u2y = n.W[1] - n.E[1];
      const l1 = Math.hypot(u1x, u1y) || 1e-9, l2 = Math.hypot(u2x, u2y) || 1e-9;
      const fold = (u1x * u2x + u1y * u2y) / (l1 * l2);              // −1 straight, 1 folded flat
      const k = smoothstep(ELBOW_FOLD[0], ELBOW_FOLD[1], fold) * (fm.visible ? 1 : 0);
      cap.material.uniforms.w.value = k;
      cap.visible = k > 0.01;
      if (!cap.visible) continue;
      const r = ELBOW_R * arm.rest.fore, dx = -u2x / l2, dy = -u2y / l2, inw = arm.inward || 1;
      // (across her forearm toward her little finger's side: (−u2y, u2x) × inward, as her hand's frame)
      const off = ELBOW_ACROSS * arm.rest.fore, ax = (-u2y / l2) * inw, ay = (u2x / l2) * inw;
      cap.position.set(n.E[0] + ax * off + hip, n.E[1] + ay * off, 0);
      cap.scale.set(2 * r, 2 * r, 1);
      cap.rotation.z = Math.atan2(-dx, dy);
      cap.renderOrder = fm.renderOrder - 0.05e-4;
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
    // (2026-10-08) the spots of her face and body this frame, for her hands (moves.js), once she's been drawn
    get spots() { return spotsReady ? spots : null; },
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
    // (2026-10-07) her painted accessories for an outfit, loaded before it goes on
    prepare,
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
