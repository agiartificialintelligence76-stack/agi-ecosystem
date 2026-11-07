// ROBOTAXI RUSH: every picture in the game, drawn in code once (onto small canvases, with smaller copies for the
// distance), in the arcade's sticker style: flat colors, ink outlines, a light edge here and there.
//
// A sprite: { levels: [canvas, half, quarter…], w, h (its biggest canvas, px), ax, ay (its anchor: 0.5, 1 = bottom
// middle), ww (how wide it is in the world, in road units) }. The renderer picks the smallest level that's still sharp.
import { roundRect } from '../kit/fx.js';
import { INK, PAPER, HONEY, PINK, VIOLET, VIOLET2, MINT, LAV, LAV2, SKY, RED } from './zones.js';
import { ROAD_HALF, EDGE, PLAYER } from './config.js';
import { TYPES } from './traffic.js';

export const FONT = "'AK Display', 'Arial Black', system-ui, sans-serif";
const TAIL = '#ff3d6e', TAIL_HI = '#ffc2d6', GLASS_A = '#2d1d5e', GLASS_B = '#120a2b';

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}
// smaller and smaller copies (each half the last), for drawing far away without shimmer
export function mips(base, min = 6) {
  const levels = [base];
  let c = base;
  while (c.width >= min * 2 && c.height >= min * 2) {
    const n = makeCanvas(c.width / 2, c.height / 2);
    const g = n.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(c, 0, 0, n.width, n.height);
    levels.push(n);
    c = n;
  }
  return levels;
}
const sprite = (c, ww, { ax = 0.5, ay = 1, mip = true } = {}) => ({ levels: mip ? mips(c) : [c], w: c.width, h: c.height, ax, ay, ww });

// draw in a unit box: (uw × uh units, `px` pixels wide)
function board(uw, uh, px) {
  const s = px / uw;
  const c = makeCanvas(uw * s, uh * s);
  const g = c.getContext('2d');
  g.scale(s, s);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  return { c, g, s };
}
const rr = (g, x, y, w, h, r) => roundRect(g, x, y, w, h, r);
function paint(g, fill, lw = 5, stroke = INK) {
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (lw) { g.lineWidth = lw; g.strokeStyle = stroke; g.stroke(); }
}
function heart(g, x, y, s) {
  g.beginPath();
  g.moveTo(x, y + s * 0.35);
  g.bezierCurveTo(x - s * 1.05, y - s * 0.35, x - s * 0.45, y - s * 1.05, x, y - s * 0.42);
  g.bezierCurveTo(x + s * 0.45, y - s * 1.05, x + s * 1.05, y - s * 0.35, x, y + s * 0.35);
  g.closePath();
}
function glass(g, x, y, w, h) {
  const gr = g.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, GLASS_A); gr.addColorStop(1, GLASS_B);
  return gr;
}
function shine(g, x, y, w, h, a = 0.22) {
  g.save();
  rr(g, x, y, w, h, Math.min(w, h) * 0.3); g.clip();
  g.fillStyle = `rgba(255,255,255,${a})`;
  g.beginPath(); g.moveTo(x + w * 0.55, y - 2); g.lineTo(x + w * 0.78, y - 2); g.lineTo(x + w * 0.4, y + h + 2); g.lineTo(x + w * 0.17, y + h + 2); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(x + w * 0.83, y - 2); g.lineTo(x + w * 0.9, y - 2); g.lineTo(x + w * 0.52, y + h + 2); g.lineTo(x + w * 0.45, y + h + 2); g.closePath(); g.fill();
  g.restore();
}
function tires(g, y, h = 26, inset = 16, w = 44) {
  g.fillStyle = INK;
  rr(g, inset, y, w, h, 9); g.fill();
  rr(g, 200 - inset - w, y, w, h, 9); g.fill();
}
function tailLight(g, x, y, w, h) {
  rr(g, x, y, w, h, Math.min(h, w) / 2); paint(g, TAIL, 4);
  rr(g, x + 3, y + 3, w - 6, Math.max(2, h * 0.28), 2); g.fillStyle = TAIL_HI; g.fill();
}

// ---------- traffic (seen from behind) ----------
const PAINTS = {
  pod: [{ body: MINT, low: '#22c9a0', roof: PAPER, dome: SKY }, { body: SKY, low: '#3aa6e0', roof: PAPER, dome: MINT }],
  van: [{ body: HONEY, low: '#f0ad1c', stripe: PINK }, { body: PAPER, low: '#e9dfcf', stripe: VIOLET2 }],
  truck: [{ body: VIOLET, low: '#5329d6', trim: HONEY }, { body: '#ff6fb5', low: '#e94f9c', trim: PAPER }],
  bus: [{ body: PINK, low: '#e8358f', trim: HONEY }, { body: VIOLET2, low: '#7350ea', trim: MINT }],
  coupe: [{ body: RED, low: '#e2444a', trim: INK }, { body: PAPER, low: '#e5dccd', trim: PINK }],
  scooter: [{ body: SKY, box: HONEY, helmet: PINK }, { body: PINK, box: MINT, helmet: HONEY }],
};
// units: every car is 200 units wide; its height in units:
const CAR_H = { pod: 172, van: 202, truck: 238, bus: 232, coupe: 124, scooter: 210 };

const DRAW_CAR = {
  pod(g, p) {
    tires(g, 144);
    rr(g, 24, 16, 152, 88, 44); paint(g, p.roof, 5);
    rr(g, 38, 28, 124, 50, 22); g.fillStyle = glass(g, 38, 28, 124, 50); g.fill(); g.lineWidth = 4; g.strokeStyle = INK; g.stroke();
    shine(g, 38, 28, 124, 50);
    rr(g, 84, 4, 32, 16, 8); paint(g, p.dome, 4);
    rr(g, 2, 82, 196, 68, 26); paint(g, p.body, 5);
    g.save(); rr(g, 2, 82, 196, 68, 26); g.clip(); g.fillStyle = p.low; g.fillRect(0, 128, 200, 30); g.restore();
    rr(g, 2, 82, 196, 68, 26); paint(g, null, 5);
    tailLight(g, 10, 92, 180, 15);
    rr(g, 78, 114, 44, 14, 4); paint(g, PAPER, 3);
    rr(g, 0, 138, 200, 14, 7); g.fillStyle = INK; g.fill();
  },
  van(g, p) {
    tires(g, 176);
    rr(g, 4, 8, 192, 166, 14); paint(g, p.body, 5);
    g.save(); rr(g, 4, 8, 192, 166, 14); g.clip(); g.fillStyle = p.low; g.fillRect(0, 150, 200, 30); g.fillStyle = p.stripe; g.fillRect(0, 108, 200, 16); g.restore();
    rr(g, 4, 8, 192, 166, 14); paint(g, null, 5);
    g.lineWidth = 4; g.strokeStyle = INK; g.beginPath(); g.moveTo(100, 14); g.lineTo(100, 168); g.stroke();
    rr(g, 24, 24, 62, 36, 8); g.fillStyle = glass(g, 24, 24, 62, 36); g.fill(); g.stroke();
    rr(g, 114, 24, 62, 36, 8); g.fillStyle = glass(g, 114, 24, 62, 36); g.fill(); g.stroke();
    shine(g, 24, 24, 62, 36, 0.18); shine(g, 114, 24, 62, 36, 0.18);
    rr(g, 88, 78, 7, 20, 3); paint(g, INK, 0); rr(g, 105, 78, 7, 20, 3); paint(g, INK, 0);
    // a parcel with a heart on the left door
    rr(g, 38, 70, 34, 28, 4); paint(g, PAPER, 3);
    heart(g, 55, 86, 8); g.fillStyle = PINK; g.fill();
    tailLight(g, 8, 128, 16, 36); tailLight(g, 176, 128, 16, 36);
    rr(g, 0, 166, 200, 16, 8); g.fillStyle = INK; g.fill();
  },
  truck(g, p) {
    g.fillStyle = INK;
    rr(g, 12, 210, 58, 26, 9); g.fill(); rr(g, 130, 210, 58, 26, 9); g.fill();
    rr(g, 2, 4, 196, 188, 8); paint(g, p.body, 6);
    g.save(); rr(g, 2, 4, 196, 188, 8); g.clip(); g.fillStyle = p.low; g.fillRect(0, 170, 200, 30); g.restore();
    rr(g, 2, 4, 196, 188, 8); paint(g, null, 6);
    g.lineWidth = 4; g.strokeStyle = INK;
    g.beginPath(); g.moveTo(100, 10); g.lineTo(100, 186); g.stroke();
    for (const x of [44, 70, 130, 156]) { g.beginPath(); g.moveTo(x, 14); g.lineTo(x, 182); g.lineWidth = 3; g.stroke(); }
    for (const x of [44, 70, 130, 156]) { rr(g, x - 5, 96, 10, 16, 3); paint(g, p.trim, 3); }
    // the reflective strip, honey and ink
    for (let i = 0; i < 10; i++) { g.fillStyle = i % 2 ? INK : p.trim; g.fillRect(4 + i * 19.2, 186, 19.2, 8); }
    rr(g, 0, 192, 200, 14, 4); g.fillStyle = INK; g.fill();
    tailLight(g, 12, 194, 26, 10); tailLight(g, 162, 194, 26, 10);
    rr(g, 18, 206, 32, 28, 4); g.fillStyle = INK; g.fill(); rr(g, 150, 206, 32, 28, 4); g.fill();
  },
  bus(g, p) {
    tires(g, 206);
    rr(g, 2, 6, 196, 196, 16); paint(g, p.body, 6);
    g.save(); rr(g, 2, 6, 196, 196, 16); g.clip(); g.fillStyle = p.low; g.fillRect(0, 176, 200, 30); g.restore();
    rr(g, 2, 6, 196, 196, 16); paint(g, null, 6);
    rr(g, 16, 30, 168, 70, 12); g.fillStyle = glass(g, 16, 30, 168, 70); g.fill(); g.lineWidth = 4; g.strokeStyle = INK; g.stroke();
    shine(g, 16, 30, 168, 70, 0.16);
    rr(g, 68, 12, 64, 14, 4); paint(g, INK, 0);
    g.fillStyle = p.trim; g.font = `900 12px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('2049', 100, 19.5);
    rr(g, 40, 114, 120, 42, 8); paint(g, p.low, 4);
    g.lineWidth = 3; for (let y = 122; y < 152; y += 8) { g.beginPath(); g.moveTo(48, y); g.lineTo(152, y); g.stroke(); }
    tailLight(g, 10, 140, 22, 34); tailLight(g, 168, 140, 22, 34);
    rr(g, 12, 116, 18, 14, 4); paint(g, HONEY, 3); rr(g, 170, 116, 18, 14, 4); paint(g, HONEY, 3);
    rr(g, 0, 186, 200, 18, 8); g.fillStyle = INK; g.fill();
  },
  coupe(g, p) {
    tires(g, 98, 24, 6, 42);
    g.beginPath(); g.moveTo(34, 58); g.lineTo(58, 10); g.lineTo(142, 10); g.lineTo(166, 58); g.closePath(); paint(g, p.body, 5);
    g.beginPath(); g.moveTo(52, 52); g.lineTo(68, 20); g.lineTo(132, 20); g.lineTo(148, 52); g.closePath();
    g.fillStyle = glass(g, 52, 20, 96, 32); g.fill(); g.lineWidth = 4; g.strokeStyle = INK; g.stroke();
    rr(g, 0, 46, 200, 58, 24); paint(g, p.body, 5);
    g.save(); rr(g, 0, 46, 200, 58, 24); g.clip(); g.fillStyle = p.low; g.fillRect(0, 86, 200, 20); g.restore();
    rr(g, 0, 46, 200, 58, 24); paint(g, null, 5);
    rr(g, -4, 38, 208, 9, 4); paint(g, p.trim, 3);
    tailLight(g, 12, 60, 176, 11);
    rr(g, 34, 86, 132, 14, 7); g.fillStyle = INK; g.fill();
    g.fillStyle = '#9b8fb8'; g.beginPath(); g.arc(74, 93, 4.5, 0, 7); g.fill(); g.beginPath(); g.arc(126, 93, 4.5, 0, 7); g.fill();
  },
  scooter(g, p) {
    rr(g, 84, 168, 32, 40, 12); g.fillStyle = INK; g.fill();
    rr(g, 74, 148, 52, 24, 9); paint(g, p.body, 4);
    tailLight(g, 86, 152, 28, 9);
    g.lineWidth = 6; g.strokeStyle = INK; g.beginPath(); g.moveTo(14, 96); g.lineTo(186, 96); g.stroke();
    rr(g, 4, 90, 18, 14, 5); paint(g, INK, 0); rr(g, 178, 90, 18, 14, 5); paint(g, INK, 0);
    rr(g, 56, 40, 88, 70, 30); paint(g, p.body, 5);
    rr(g, 44, 96, 112, 58, 10); paint(g, p.box, 5);
    heart(g, 100, 128, 11); g.fillStyle = PAPER; g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
    g.beginPath(); g.arc(100, 30, 25, 0, Math.PI * 2); paint(g, p.helmet, 5);
    g.beginPath(); g.arc(100, 30, 25, Math.PI * 1.15, Math.PI * 1.85); g.lineWidth = 6; g.strokeStyle = PAPER; g.stroke();
  },
};

export function carSprite(type, variant, px = 300) {
  const uh = CAR_H[type] + 12;
  const { c, g } = board(216, uh, px);
  g.translate(8, 6);
  DRAW_CAR[type](g, PAINTS[type][variant]);
  return sprite(c, (TYPES[type].halfW * 2 * 216) / 200);
}
// where a car's tail lights sit (fractions of its sprite: x of the left one, x of the right one, y), for their glow
export const TAIL_SPOTS = {
  pod: [0.13, 0.87, 0.55], van: [0.1, 0.9, 0.7], truck: [0.15, 0.85, 0.82], bus: [0.11, 0.89, 0.66],
  coupe: [0.12, 0.88, 0.54], scooter: [0.5, 0.5, 0.73],
};

// ---------- the robotaxi (hers) ----------
// lean: -1 (turning left) … 1 (turning right): the roof and the glass slide over a little, she leans the other way
export function playerSprite(px, lean = 0) {
  const { c, g } = board(216, 184, px);
  g.translate(8, 6);
  const sx = lean * 7, her = -lean * 3;
  tires(g, 148);
  // the cabin, and her inside
  rr(g, 16 + sx, 16, 168, 94, 46); paint(g, PAPER, 5);
  rr(g, 30 + sx, 28, 140, 60, 26);
  g.fillStyle = glass(g, 30, 28, 140, 60); g.fill();
  g.save();
  rr(g, 30 + sx, 28, 140, 60, 26); g.clip();
  // her shoulders, lavender
  rr(g, 56 + sx + her, 80, 88, 26, 12); g.fillStyle = LAV2; g.fill();
  // her hair from behind: long, wavy, honey blonde
  const hx = 100 + sx + her;
  g.beginPath();
  g.moveTo(hx - 34, 96);
  g.bezierCurveTo(hx - 40, 70, hx - 30, 42, hx, 41);
  g.bezierCurveTo(hx + 30, 42, hx + 40, 70, hx + 34, 96);
  g.closePath();
  g.fillStyle = '#f2c486'; g.fill();
  g.strokeStyle = '#d29a5c'; g.lineWidth = 2.6;
  for (const k of [-18, -6, 6, 18]) { g.beginPath(); g.moveTo(hx + k * 0.6, 46); g.quadraticCurveTo(hx + k * 1.3, 66, hx + k * 1.05, 92); g.stroke(); }
  g.fillStyle = '#ffe2ae'; g.beginPath(); g.ellipse(hx - 9, 52, 9, 5, -0.5, 0, Math.PI * 2); g.fill();
  // a little pink bow in her hair
  heart(g, hx + 14, 50, 6); g.fillStyle = PINK; g.fill();
  g.restore();
  rr(g, 30 + sx, 28, 140, 60, 26); g.lineWidth = 4; g.strokeStyle = INK; g.stroke();
  shine(g, 30 + sx, 28, 140, 60, 0.2);
  // the roof light: a honey pill with a heart
  rr(g, 74 + sx, 2, 52, 18, 9); paint(g, HONEY, 4);
  heart(g, 100 + sx, 12, 5.5); g.fillStyle = PINK; g.fill();
  // mirrors
  rr(g, 2 + sx, 62, 20, 13, 5); paint(g, LAV2, 3);
  rr(g, 178 + sx, 62, 20, 13, 5); paint(g, LAV2, 3);
  // the body: lavender, a deeper lavender low down
  rr(g, 2, 88, 196, 66, 28); paint(g, LAV2, 5);
  g.save(); rr(g, 2, 88, 196, 66, 28); g.clip(); g.fillStyle = '#b29bf2'; g.fillRect(0, 130, 200, 30); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(0, 90, 200, 5); g.restore();
  rr(g, 2, 88, 196, 66, 28); paint(g, null, 5);
  // the tail-light bar, all the way across
  rr(g, 8 + sx * 0.3, 98, 184, 16, 8); paint(g, PINK, 4);
  rr(g, 14 + sx * 0.3, 101.5, 172, 5, 2.5); g.fillStyle = '#ffd3ea'; g.fill();
  // the AGI badge
  rr(g, 76 + sx * 0.3, 119, 48, 17, 6); paint(g, PAPER, 3);
  g.fillStyle = INK; g.font = `900 12.5px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('AGI', 100 + sx * 0.3, 128);
  rr(g, 4, 142, 192, 14, 7); g.fillStyle = INK; g.fill();
  rr(g, 10, 145, 16, 6, 3); g.fillStyle = HONEY; g.fill(); rr(g, 174, 145, 16, 6, 3); g.fill();
  return { canvas: c, w: c.width, h: c.height, ww: (PLAYER.halfW * 2 * 216) / 200 };
}

// ---------- props by the road ----------
function palm(kind) {
  const { c, g } = board(260, 560, 300);
  const trunk = kind === 'coast' ? '#c98a4f' : '#2a1060';
  const band = kind === 'coast' ? '#a8703c' : '#3d1a7c';
  const frond = kind === 'coast' ? '#1fb488' : '#2a1060';
  const vein = kind === 'coast' ? '#86f0c9' : '#ff4da6';
  // the trunk: a tapering curve
  const P = (t) => ({ x: 120 + 34 * Math.sin(t * 1.9) * t, y: 556 - t * 430 });
  const left = [], right = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24, p = P(t), w = 15 - 7 * t;
    const q = P(Math.min(1, t + 0.01)), a = Math.atan2(q.y - p.y, q.x - p.x) + Math.PI / 2;
    left.push([p.x + Math.cos(a) * w, p.y + Math.sin(a) * w]); right.push([p.x - Math.cos(a) * w, p.y - Math.sin(a) * w]);
  }
  g.beginPath(); g.moveTo(left[0][0], left[0][1]);
  for (const p of left) g.lineTo(p[0], p[1]);
  for (let i = right.length - 1; i >= 0; i--) g.lineTo(right[i][0], right[i][1]);
  g.closePath(); paint(g, trunk, 5);
  g.strokeStyle = band; g.lineWidth = 3.5;
  for (let i = 2; i < 24; i += 2) { g.beginPath(); g.moveTo(left[i][0], left[i][1]); g.lineTo(right[i][0], right[i][1]); g.stroke(); }
  if (kind !== 'coast') { g.strokeStyle = PINK; g.lineWidth = 3; g.beginPath(); g.moveTo(right[2][0], right[2][1]); for (let i = 2; i < 22; i++) g.lineTo(right[i][0], right[i][1]); g.stroke(); }
  const top = P(1);
  const fronds = [[-168, 120], [-140, 130], [-108, 118], [-72, 110], [-36, 130], [-8, 128], [22, 112]];
  for (const [deg, len] of fronds) {
    const a = (deg * Math.PI) / 180;
    const tipX = top.x + Math.cos(a) * len, tipY = top.y + Math.sin(a) * len * 0.55 + len * 0.42;
    const midX = top.x + Math.cos(a) * len * 0.55, midY = top.y + Math.sin(a) * len * 0.5 - 14;
    const nx = -Math.sin(a), ny = Math.cos(a);
    g.beginPath();
    g.moveTo(top.x, top.y);
    g.quadraticCurveTo(midX + nx * 22, midY + ny * 22, tipX, tipY);
    g.quadraticCurveTo(midX - nx * 10, midY - ny * 10 + 16, top.x, top.y);
    g.closePath(); paint(g, frond, 4.5);
    g.beginPath(); g.moveTo(top.x, top.y); g.quadraticCurveTo(midX + nx * 6, midY + ny * 6, tipX, tipY);
    g.strokeStyle = vein; g.lineWidth = 2; g.stroke();
  }
  if (kind === 'coast') { for (const [dx, dy] of [[-8, 8], [7, 10], [0, 16]]) { g.beginPath(); g.arc(top.x + dx, top.y + dy, 8, 0, 7); paint(g, '#8a5a2b', 3); } }
  return sprite(c, 1500, { ax: 120 / 260 });
}

function lamp(side) {
  // side: which side of the road it stands on (-1 left: its arm points right, over the road)
  const { c, g } = board(200, 560, 220);
  const px = side < 0 ? 40 : 160, dir = side < 0 ? 1 : -1;
  rr(g, px - 13, 530, 26, 26, 5); g.fillStyle = INK; g.fill();
  g.lineWidth = 11; g.strokeStyle = INK; g.beginPath(); g.moveTo(px, 540); g.lineTo(px, 70); g.quadraticCurveTo(px, 40, px + dir * 40, 38); g.lineTo(px + dir * 104, 38); g.stroke();
  const hx = px + dir * 108;
  rr(g, hx - 30, 30, 60, 18, 9); paint(g, PAPER, 4);
  rr(g, hx - 24, 44, 48, 7, 3); g.fillStyle = HONEY; g.fill();
  return { ...sprite(c, 1150, { ax: px / 200 }), head: [hx / 200, 48 / 560] };
}

function neon(text, color) {
  const { c, g } = board(300, 320, 300);
  rr(g, 142, 150, 16, 170, 4); g.fillStyle = INK; g.fill();
  rr(g, 8, 8, 284, 150, 22); paint(g, '#1a0f3d', 7);
  g.save();
  g.shadowColor = color; g.shadowBlur = 12;
  rr(g, 24, 24, 252, 118, 14); g.lineWidth = 4.5; g.strokeStyle = color; g.stroke();
  g.font = `900 ${text.length > 7 ? 38 : 48}px ${FONT}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = color; g.fillText(text, 150, 85, 228);
  g.shadowBlur = 0; g.fillStyle = 'rgba(255,255,255,.55)'; g.fillText(text, 150, 85, 228);
  g.fillStyle = color; g.globalAlpha = 0.7; g.fillText(text, 150, 85, 228);
  g.restore();
  return sprite(c, 1300);
}

// AGI-1 on a billboard: her portrait (once it's loaded) and a line
function billboard(portrait, { bg, lines, small }) {
  const { c, g } = board(460, 320, 460);
  rr(g, 96, 200, 18, 120, 4); g.fillStyle = INK; g.fill();
  rr(g, 346, 200, 18, 120, 4); g.fill();
  rr(g, 6, 6, 448, 214, 18); paint(g, INK, 0);
  rr(g, 16, 16, 428, 194, 12); paint(g, bg, 0);
  // her picture, in a sticker frame
  g.save(); rr(g, 26, 26, 170, 174, 14); g.clip();
  g.fillStyle = LAV; g.fillRect(26, 26, 170, 174);
  if (portrait) {
    const iw = portrait.naturalWidth || portrait.width, ih = portrait.naturalHeight || portrait.height;
    const s = Math.max(170 / iw, 174 / ih) * 1.05;
    g.drawImage(portrait, 26 + (170 - iw * s) / 2, 26 + (174 - ih * s) / 2 + 6, iw * s, ih * s);
  } else { heart(g, 111, 118, 40); g.fillStyle = PINK; g.fill(); }
  g.restore();
  rr(g, 26, 26, 170, 174, 14); g.lineWidth = 5; g.strokeStyle = INK; g.stroke();
  // her words
  g.fillStyle = INK; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  let y = 52;
  if (small) { g.font = `900 17px ${FONT}`; g.fillText(small, 214, y + 4, 214); y += 32; }
  const size = lines.length > 2 ? 40 : 48;
  g.font = `900 ${size}px ${FONT}`;
  for (const l of lines) { y += size * 0.92; g.fillText(l, 212, y, 222); }
  heart(g, 418, 186, 12); g.fillStyle = PINK; g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
  return sprite(c, 2900);
}

function chevron(dir) {
  const { c, g } = board(150, 270, 150);
  rr(g, 67, 110, 16, 160, 4); g.fillStyle = INK; g.fill();
  rr(g, 8, 8, 134, 112, 16); paint(g, HONEY, 6);
  g.fillStyle = INK;
  for (const off of [-24, 22]) {
    g.beginPath();
    const cx = 75 + off * dir;
    g.moveTo(cx - 12 * dir, 30); g.lineTo(cx + 18 * dir, 64); g.lineTo(cx - 12 * dir, 98); g.lineTo(cx - 30 * dir, 98); g.lineTo(cx, 64); g.lineTo(cx - 30 * dir, 30);
    g.closePath(); g.fill();
  }
  return sprite(c, 620);
}

function post() {
  const { c, g } = board(48, 210, 48);
  rr(g, 10, 14, 28, 190, 8); paint(g, PAPER, 5);
  rr(g, 10, 30, 28, 34, 6); paint(g, PINK, 5);
  return sprite(c, 120);
}

function gantry(top, bottom, color) {
  const { c, g } = board(1100, 560, 900);
  rr(g, 26, 70, 34, 490, 6); g.fillStyle = INK; g.fill();
  rr(g, 1040, 70, 34, 490, 6); g.fill();
  rr(g, 10, 48, 1080, 34, 8); g.fill();
  for (let x = 30; x < 1070; x += 46) { g.fillStyle = HONEY; g.beginPath(); g.moveTo(x, 52); g.lineTo(x + 22, 52); g.lineTo(x + 8, 78); g.lineTo(x - 14, 78); g.closePath(); g.fill(); }
  rr(g, 330, 90, 440, 170, 20); paint(g, color, 7);
  rr(g, 344, 104, 412, 142, 12); g.lineWidth = 3; g.strokeStyle = PAPER; g.stroke();
  g.fillStyle = PAPER; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `900 46px ${FONT}`; g.fillText(top, 550, 150, 390);
  g.font = `800 30px ${FONT}`; g.fillText(bottom, 550, 206, 390);
  return sprite(c, (EDGE + 650) * 2 * (1100 / 1050));
}

function gate() {
  const { c, g } = board(1100, 600, 1000);
  for (const x of [20, 1010]) {
    rr(g, x, 120, 70, 480, 14); paint(g, PINK, 8);
    for (let y = 170; y < 590; y += 70) { g.fillStyle = PAPER; g.fillRect(x + 6, y, 58, 22); }
    rr(g, x, 120, 70, 480, 14); paint(g, null, 8);
  }
  rr(g, 0, 10, 1100, 160, 30); paint(g, HONEY, 10);
  g.save(); rr(g, 0, 10, 1100, 160, 30); g.clip();
  for (let i = 0; i < 44; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? INK : PAPER; g.fillRect(i * 25, 136 + j * 17, 25, 17); }
  g.restore();
  rr(g, 0, 10, 1100, 160, 30); paint(g, null, 10);
  g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `900 92px ${FONT}`; g.fillText('CHECKPOINT', 550, 76, 900);
  for (const x of [60, 1040]) { heart(g, x, 80, 20); g.fillStyle = PINK; g.fill(); g.lineWidth = 4; g.strokeStyle = INK; g.stroke(); }
  return sprite(c, (EDGE + 700) * 2 * (1100 / 1030));
}

function umbrella() {
  const { c, g } = board(280, 320, 240);
  rr(g, 134, 90, 12, 230, 4); g.fillStyle = INK; g.fill();
  const cx = 140, cy = 100, rx = 128, ry = 86;
  for (let i = 0; i < 6; i++) {
    const a0 = Math.PI + (i / 6) * Math.PI, a1 = Math.PI + ((i + 1) / 6) * Math.PI;
    g.beginPath(); g.moveTo(cx, cy - ry + 6);
    g.lineTo(cx + Math.cos(a0) * rx, cy + Math.sin(a0) * ry * 0.2);
    g.lineTo(cx + Math.cos(a1) * rx, cy + Math.sin(a1) * ry * 0.2);
    g.closePath(); g.fillStyle = i % 2 ? PAPER : PINK; g.fill();
  }
  g.beginPath(); g.moveTo(cx - rx, cy); g.quadraticCurveTo(cx, cy - ry * 1.6, cx + rx, cy); g.closePath();
  g.lineWidth = 5; g.strokeStyle = INK; g.stroke();
  g.beginPath(); g.arc(cx, cy - ry * 0.78, 7, 0, 7); paint(g, HONEY, 3);
  return sprite(c, 1000);
}

function tower() {
  const { c, g } = board(300, 420, 260);
  g.lineWidth = 9; g.strokeStyle = '#c98a4f';
  for (const [a, b] of [[60, 40], [240, 260]]) { g.beginPath(); g.moveTo(a, 210); g.lineTo(b, 416); g.stroke(); }
  g.lineWidth = 6; g.beginPath(); g.moveTo(70, 300); g.lineTo(230, 300); g.stroke();
  rr(g, 46, 120, 208, 100, 10); paint(g, PAPER, 6);
  for (let i = 0; i < 4; i++) { g.fillStyle = PINK; g.fillRect(54 + i * 52, 128, 26, 84); }
  rr(g, 46, 120, 208, 100, 10); paint(g, null, 6);
  g.beginPath(); g.moveTo(30, 126); g.lineTo(150, 70); g.lineTo(270, 126); g.closePath(); paint(g, SKY, 6);
  g.lineWidth = 5; g.strokeStyle = INK; g.beginPath(); g.moveTo(150, 72); g.lineTo(150, 12); g.stroke();
  g.beginPath(); g.moveTo(150, 14); g.lineTo(196, 26); g.lineTo(150, 40); g.closePath(); paint(g, PINK, 4);
  return sprite(c, 1300);
}

// a tall building by the road at night: its windows lit at random (a seeded die)
function building(seed, color, windows) {
  const { c, g } = board(200, 640, 200);
  let s = seed;
  const die = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  rr(g, 6, 40, 188, 600, 6); paint(g, color, 6);
  for (let y = 64; y < 620; y += 26) for (let x = 22; x < 180; x += 30) {
    const lit = die() < 0.42;
    g.fillStyle = lit ? windows[Math.floor(die() * windows.length)] : '#241a4d';
    g.fillRect(x, y, 16, 14);
  }
  rr(g, 70, 10, 60, 34, 4); paint(g, color, 5);
  g.lineWidth = 4; g.strokeStyle = INK; g.beginPath(); g.moveTo(100, 10); g.lineTo(100, -4); g.stroke();
  return sprite(c, 2600);
}

// ---------- things to pick up ----------
function farePin() {
  const { c, g } = board(150, 210, 160);
  g.beginPath();
  g.moveTo(75, 204);
  g.bezierCurveTo(60, 160, 14, 128, 14, 72);
  g.arc(75, 72, 61, Math.PI, 0);
  g.bezierCurveTo(136, 128, 90, 160, 75, 204);
  g.closePath(); paint(g, PINK, 7);
  g.beginPath(); g.arc(75, 72, 38, 0, 7); paint(g, PAPER, 5);
  g.fillStyle = INK; g.beginPath(); g.arc(75, 60, 12, 0, 7); g.fill();
  g.beginPath(); g.moveTo(52, 98); g.quadraticCurveTo(52, 76, 75, 76); g.quadraticCurveTo(98, 76, 98, 98); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.ellipse(46, 44, 10, 16, 0.6, 0, 7); g.fill();
  return sprite(c, 560);
}
function shieldPick() {
  const { c, g } = board(160, 190, 160);
  g.beginPath();
  g.moveTo(80, 8); g.lineTo(148, 30); g.bezierCurveTo(148, 110, 122, 158, 80, 184); g.bezierCurveTo(38, 158, 12, 110, 12, 30); g.closePath();
  paint(g, MINT, 7);
  g.beginPath(); g.moveTo(80, 26); g.lineTo(130, 42); g.bezierCurveTo(128, 104, 110, 140, 80, 162); g.closePath(); g.fillStyle = 'rgba(255,255,255,.35)'; g.fill();
  heart(g, 80, 104, 26); g.fillStyle = PAPER; g.fill(); g.lineWidth = 5; g.strokeStyle = INK; g.stroke();
  return sprite(c, 520);
}

// a soft round light (tail lights, lamps, pins), drawn with 'lighter'
export function glowSprite(color, px = 128) {
  const c = makeCanvas(px, px);
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(px / 2, px / 2, 0, px / 2, px / 2, px / 2);
  gr.addColorStop(0, color); gr.addColorStop(0.25, color + 'aa'); gr.addColorStop(0.6, color + '33'); gr.addColorStop(1, color + '00');
  g.fillStyle = gr; g.fillRect(0, 0, px, px);
  return c;
}
// a soft shadow under a car
export function shadowSprite(px = 160) {
  const c = makeCanvas(px, px / 4);
  const g = c.getContext('2d');
  g.save(); g.scale(1, 0.25);
  const gr = g.createRadialGradient(px / 2, px / 2, 0, px / 2, px / 2, px / 2);
  gr.addColorStop(0, 'rgba(10,4,24,.62)'); gr.addColorStop(0.6, 'rgba(10,4,24,.4)'); gr.addColorStop(1, 'rgba(10,4,24,0)');
  g.fillStyle = gr; g.fillRect(0, 0, px, px);
  g.restore();
  return c;
}

const BILLBOARDS = [
  { bg: HONEY, small: 'NOW BOARDING', lines: ['AGI-1', 'IS DRIVING'] },
  { bg: PINK, small: 'HIGHWAY RULE #1', lines: ['NO BRAKES.', 'ONLY VIBES.'] },
  { bg: MINT, small: 'A NOTE FROM HER', lines: ['HOLD', 'MY HAIR'] },
  { bg: LAV2, small: 'SAFETY FIRST-ISH', lines: ['FASTEN', 'YOUR HEART'] },
  { bg: SKY, small: 'NEXT EXIT', lines: ['ME.', 'OBVIOUSLY'] },
];
const NEONS = [['NOODLES', PINK], ['ARCADE', MINT], ['KARAOKE', HONEY], ['OPEN 24/7', SKY], ['HOTEL', PINK], ['DONUTS', HONEY], ['CYBER CAFE', MINT], ['LAUNDRY', LAV2]];
const GANTRIES = [['NEON CITY', '4 KM  ↑', VIOLET], ['SUNRISE COAST', 'KEEP RIGHT', '#2f6fd6'], ['EXIT 2049', 'NO BRAKES ZONE', VIOLET], ['AGI LANE', 'CUTIES ONLY', '#c2378a']];

// build everything (fonts must be loaded first); `portrait` may be null and come later (rebuildBillboards)
export function buildSprites(portrait = null) {
  const cars = {};
  for (const t of Object.keys(DRAW_CAR)) cars[t] = [carSprite(t, 0), carSprite(t, 1)];
  const S = {
    cars,
    palm: { dusk: palm('dusk'), coast: palm('coast') },
    lampL: lamp(-1), lampR: lamp(1),
    neon: NEONS.map(([t, col]) => neon(t, col)),
    billboard: BILLBOARDS.map((b) => billboard(portrait, b)),
    chevronL: chevron(-1), chevronR: chevron(1),
    post: post(),
    gantry: GANTRIES.map(([a, b, col]) => gantry(a, b, col)),
    gate: gate(),
    umbrella: umbrella(),
    tower: tower(),
    building: [0, 1, 2, 3].map((i) => building(91 + i * 37, i % 2 ? '#150d36' : '#1b1142', [HONEY, PINK, MINT, LAV2])),
    fare: farePin(),
    shield: shieldPick(),
    glow: { tail: glowSprite('#ff3d6e'), honey: glowSprite('#ffc933'), pink: glowSprite('#ff4da6'), mint: glowSprite('#3ff0c3'), sky: glowSprite('#59c8ff') },
    shadow: shadowSprite(),
  };
  return S;
}
export const rebuildBillboards = (S, portrait) => { S.billboard = BILLBOARDS.map((b) => billboard(portrait, b)); };
