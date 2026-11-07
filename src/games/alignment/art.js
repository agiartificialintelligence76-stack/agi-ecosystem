// ALIGNMENT's pictures, all drawn in code in one flat style: ink outlines of one weight, three or four flat colours a
// character, no gradients. The lab's people as head-and-shoulders busts (a 100 × 100 box, standing on its bottom edge),
// their corner glyphs, the four meters' sticker icons, the card back, and the sixteen endings' little scenes.
// AGI-1's own portrait is her real art (/images/agi1-portrait.webp), drawn by render.js.
import { roundRect, star } from '../kit/fx.js';

export const INK = '#170a36';
export const PAPER = '#fffaf0';
export const HONEY = '#ffc933';
export const PINK = '#ff4da6';
export const VIOLET = '#6b3bff';
export const LAV = '#e4d9ff';
export const MINT = '#3ff0c3';
const WHITE = '#ffffff';
const BLUSH = 'rgba(255, 110, 170, 0.45)';
let LW = 1.7;                          // the outline, in box units (set per drawing so every size looks the same)

// ---------- small helpers ----------
function fs(ctx, fill, lw = LW) {
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
}
function ell(ctx, x, y, rx, ry = rx, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); }
function poly(ctx, pts, close = true) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  if (close) ctx.closePath();
}
// a smooth closed shape through points (midpoint quadratics): hair, clouds, fluff
function blob(ctx, pts) {
  const n = pts.length / 2;
  const mx = (i) => (pts[(i % n) * 2] + pts[((i + 1) % n) * 2]) / 2;
  const my = (i) => (pts[(i % n) * 2 + 1] + pts[((i + 1) % n) * 2 + 1]) / 2;
  ctx.beginPath();
  ctx.moveTo(mx(n - 1), my(n - 1));
  for (let i = 0; i < n; i++) ctx.quadraticCurveTo(pts[i * 2], pts[i * 2 + 1], mx(i), my(i));
  ctx.closePath();
}
function line(ctx, x1, y1, x2, y2, lw = LW, color = INK) {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.lineWidth = lw; ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.stroke();
}
function arc(ctx, x, y, r, a0, a1, lw = LW, color = INK) {
  ctx.beginPath(); ctx.arc(x, y, r, a0, a1);
  ctx.lineWidth = lw; ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.stroke();
}
function dot(ctx, x, y, r, color = INK) { ell(ctx, x, y, r); ctx.fillStyle = color; ctx.fill(); }

// the shoulders of a bust (its clothes), from under the chin to the bottom edge
function shoulders(ctx, color, { y = 70, w = 34, lw = LW } = {}) {
  ctx.beginPath();
  ctx.moveTo(50 - w - 16, 104);
  ctx.bezierCurveTo(50 - w - 14, y + 7, 50 - w + 2, y, 41, y);
  ctx.lineTo(59, y);
  ctx.bezierCurveTo(50 + w - 2, y, 50 + w + 14, y + 7, 50 + w + 16, 104);
  ctx.closePath();
  fs(ctx, color, lw);
}
function neck(ctx, skin, shadow) {
  ctx.beginPath(); ctx.rect(44.5, 54, 11, 18); fs(ctx, skin);
  ctx.beginPath(); ctx.rect(45.3, 57, 9.4, 4.5); ctx.fillStyle = shadow; ctx.fill();
}
function head(ctx, skin, { x = 50, y = 43, rx = 15, ry = 17 } = {}) {
  ell(ctx, x - rx + 0.6, y + 2, 3, 4); fs(ctx, skin);              // ears
  ell(ctx, x + rx - 0.6, y + 2, 3, 4); fs(ctx, skin);
  ell(ctx, x, y, rx, ry); fs(ctx, skin);
}
function eyes(ctx, kind = 'dot', { y = 45, dx = 6.2, x = 50, r = 2 } = {}) {
  for (const s of [-1, 1]) {
    const ex = x + s * dx;
    if (kind === 'happy') { arc(ctx, ex, y + 1, 2.4, Math.PI * 1.1, Math.PI * 1.9, LW * 0.9); continue; }
    if (kind === 'sleepy') {
      ctx.beginPath(); ctx.ellipse(ex, y, r * 1.1, r * 1.2, 0, 0, Math.PI); ctx.fillStyle = INK; ctx.fill();
      line(ctx, ex - r * 1.6, y, ex + r * 1.6, y, LW * 0.85);
      continue;
    }
    ell(ctx, ex, y, r * (kind === 'big' ? 1.45 : 1), r * (kind === 'big' ? 1.65 : 1.25)); ctx.fillStyle = INK; ctx.fill();
    dot(ctx, ex + r * 0.35, y - r * 0.45, r * (kind === 'big' ? 0.55 : 0.38), WHITE);
    if (kind === 'big') dot(ctx, ex - r * 0.4, y + r * 0.55, r * 0.25, WHITE);
  }
}
function blush(ctx, { y = 50.5, dx = 9.5, x = 50, r = 2.6 } = {}) {
  for (const s of [-1, 1]) { ell(ctx, x + s * dx, y, r, r * 0.6); ctx.fillStyle = BLUSH; ctx.fill(); }
}
function smile(ctx, x = 50, y = 52.5, w = 3.4, lw = LW * 0.9) { arc(ctx, x, y - w * 0.55, w, Math.PI * 0.2, Math.PI * 0.8, lw); }

// ---------- the busts ----------
const BUSTS = {
  director(ctx) {
    shoulders(ctx, '#e3a14a');
    poly(ctx, [42, 70, 58, 70, 50, 83]); fs(ctx, '#cfe6ff');                       // shirt
    line(ctx, 42, 70, 47, 88); line(ctx, 58, 70, 53, 88);                          // cardigan edges
    dot(ctx, 46.2, 92, 1.1); dot(ctx, 53.8, 92, 1.1);
    neck(ctx, '#f0c29a', '#d9a47c');
    head(ctx, '#f0c29a');
    // messy grey hair with a lighter streak
    blob(ctx, [34, 42, 33, 31, 37, 24, 43, 25, 46, 18, 52, 23, 57, 18, 61, 25, 66, 26, 67, 34, 66, 42, 62, 34, 55, 33, 47, 35, 40, 33, 36, 38]);
    fs(ctx, '#6a6280');
    blob(ctx, [51, 22, 56, 20, 58, 25, 54, 31, 50, 30]); ctx.fillStyle = '#b9b3cc'; ctx.fill();
    // round glasses, tired eyes behind them
    for (const ex of [43.8, 56.2]) { ell(ctx, ex, 45.5, 4.7); ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fill(); fs(ctx, null, LW * 0.85); }
    line(ctx, 48.5, 45, 51.5, 45, LW * 0.85);
    dot(ctx, 43.8, 45.8, 1.25); dot(ctx, 56.2, 45.8, 1.25);
    arc(ctx, 43.8, 49.2, 2, Math.PI * 0.15, Math.PI * 0.85, LW * 0.5, '#b07d5a');
    arc(ctx, 56.2, 49.2, 2, Math.PI * 0.15, Math.PI * 0.85, LW * 0.5, '#b07d5a');
    // a wobbly, kind smile
    ctx.beginPath(); ctx.moveTo(46.5, 53.5); ctx.quadraticCurveTo(48.5, 55.5, 50, 54); ctx.quadraticCurveTo(51.5, 52.8, 53.5, 54.6);
    ctx.lineWidth = LW * 0.85; ctx.strokeStyle = INK; ctx.stroke();
    // the mug, and its steam
    roundRect(ctx, 64, 76, 15, 17, 3); fs(ctx, PAPER);
    ctx.beginPath(); ctx.rect(64.8, 81, 13.4, 4); ctx.fillStyle = HONEY; ctx.fill();
    roundRect(ctx, 64, 76, 15, 17, 3); fs(ctx, null);
    arc(ctx, 79.5, 84.5, 4, -Math.PI / 2, Math.PI / 2, LW);
    for (const sx of [68.5, 74]) {
      ctx.beginPath(); ctx.moveTo(sx, 73); ctx.bezierCurveTo(sx - 2.4, 70, sx + 2.4, 68, sx, 65);
      ctx.lineWidth = LW * 0.8; ctx.strokeStyle = 'rgba(23,10,54,0.55)'; ctx.stroke();
    }
  },
  nyx(ctx) {
    shoulders(ctx, PAPER);
    poly(ctx, [41, 70, 59, 70, 56, 77, 44, 77]); fs(ctx, '#2b2350');                // turtleneck
    line(ctx, 41, 70, 46, 94); line(ctx, 59, 70, 54, 94);                           // lab coat lapels
    roundRect(ctx, 62, 84, 9, 7, 1.5); fs(ctx, null, LW * 0.8);                     // pocket
    line(ctx, 64.5, 81, 64.5, 86, LW * 1.1, HONEY);                                 // a pen
    neck(ctx, '#8d5a3b', '#6e4329');
    // the tall bun first (behind), then the head and the smooth hair
    ell(ctx, 50, 17, 8.5, 10.5); fs(ctx, '#2b2350');
    arc(ctx, 50, 17, 5, Math.PI * 0.9, Math.PI * 1.6, LW * 0.6, '#4a3f7a');
    roundRect(ctx, 44.5, 25, 11, 4, 2); fs(ctx, HONEY);
    head(ctx, '#8d5a3b');
    blob(ctx, [34, 44, 34, 32, 40, 26, 50, 25, 60, 26, 66, 32, 66, 44, 63, 36, 56, 32, 47, 33, 40, 35, 37, 40]);
    fs(ctx, '#2b2350');
    // goggles pushed up on the forehead
    line(ctx, 33.5, 34, 66.5, 34, LW * 1.6);
    for (const gx of [43, 57]) { ell(ctx, gx, 33.5, 4.6); fs(ctx, HONEY); dot(ctx, gx - 1.4, 32, 1.1, WHITE); }
    // half-lidded eyes, one brow up, a dry little line of a mouth
    eyes(ctx, 'sleepy', { y: 45.5, r: 1.9 });
    line(ctx, 40.5, 40.5, 46.5, 40.8, LW * 0.9);
    ctx.beginPath(); ctx.moveTo(53.5, 40.2); ctx.quadraticCurveTo(56.5, 38.6, 59.5, 39.8); ctx.lineWidth = LW * 0.9; ctx.stroke();
    line(ctx, 46.8, 54, 53.6, 53.2, LW * 0.9);
    dot(ctx, 35.4, 49, 1.1, HONEY); dot(ctx, 64.6, 49, 1.1, HONEY);
  },
  pip(ctx) {
    shoulders(ctx, '#59c8ff');
    ctx.beginPath(); ctx.moveTo(36, 72); ctx.quadraticCurveTo(50, 84, 64, 72); ctx.lineWidth = LW; ctx.strokeStyle = INK; ctx.stroke();  // hood
    for (const sx of [45, 55]) { line(ctx, sx, 76, sx - 0.5, 91, LW * 1.9); line(ctx, sx, 76, sx - 0.5, 91, LW * 0.9, PAPER); }
    neck(ctx, '#ffd8bd', '#f0b897');
    // the headphones' band goes behind the head
    ctx.beginPath(); ctx.arc(50, 45, 19, Math.PI * 1.05, Math.PI * 1.95);
    ctx.lineWidth = LW * 4; ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.stroke();
    ctx.lineWidth = LW * 2.2; ctx.strokeStyle = PINK; ctx.stroke();
    head(ctx, '#ffd8bd');
    // ginger hair, a spiky fringe
    blob(ctx, [35, 41, 34, 31, 39, 25, 46, 23, 50, 21, 56, 23, 62, 25, 66, 31, 65, 41, 62, 35, 60, 38, 57, 33, 53, 37, 50, 32, 46, 37, 43, 33, 40, 38, 38, 35]);
    fs(ctx, '#f0883a');
    // big sparkly eyes, freckles, a huge grin
    eyes(ctx, 'big', { y: 45.5, r: 2.1 });
    for (const [fx, fy] of [[41, 50], [43, 51.5], [40, 52], [59, 50], [57, 51.5], [60, 52]]) dot(ctx, fx, fy, 0.55, '#c9714a');
    ctx.beginPath(); ctx.moveTo(45.5, 52.5); ctx.lineTo(54.5, 52.5); ctx.quadraticCurveTo(54.5, 58.5, 50, 58.5); ctx.quadraticCurveTo(45.5, 58.5, 45.5, 52.5);
    ctx.closePath(); fs(ctx, INK, LW * 0.8);
    ell(ctx, 50, 56.6, 2.6, 1.5); ctx.fillStyle = '#ff7fae'; ctx.fill();
    // the huge cups
    for (const cx of [31, 69]) {
      roundRect(ctx, cx - 5.5, 36, 11, 19, 5); fs(ctx, PINK);
      roundRect(ctx, cx - 2.6, 40, 5.2, 11, 2.6); ctx.fillStyle = '#c21f76'; ctx.fill();
    }
  },
  byte(ctx) {
    // a fluffy grey body with a white bib
    shoulders(ctx, '#a29fb6', { y: 72, w: 30 });
    blob(ctx, [40, 72, 50, 70, 60, 72, 63, 82, 58, 92, 50, 98, 42, 92, 37, 82]); fs(ctx, '#f3f0f8', 0);
    roundRect(ctx, 38, 66, 24, 5, 2.5); fs(ctx, HONEY);                              // collar
    ell(ctx, 50, 74.5, 3.2); fs(ctx, HONEY);                                         // its tag
    // ears, then the head
    for (const s of [-1, 1]) {
      poly(ctx, [50 + s * 20, 38, 50 + s * 17, 17, 50 + s * 6, 30]); fs(ctx, '#a29fb6');
      poly(ctx, [50 + s * 17.4, 34, 50 + s * 16.2, 22.5, 50 + s * 9.5, 30.5]); ctx.fillStyle = '#ffb3cf'; ctx.fill();
    }
    ell(ctx, 50, 46, 21, 17); fs(ctx, '#a29fb6');
    // tabby stripes (inside the head only)
    ctx.save(); ell(ctx, 50, 46, 20.2, 16.2); ctx.clip();
    for (const [x1, y1, x2, y2] of [[50, 29, 50, 36.5], [45, 30, 46.3, 36], [55, 30, 53.7, 36], [29, 43, 35, 44.5], [29, 49, 35, 48.6], [71, 43, 65, 44.5], [71, 49, 65, 48.6]]) {
      line(ctx, x1, y1, x2, y2, 2.1, '#6d6987');
    }
    ctx.restore();
    // muzzle, nose, mouth, green eyes with slits, whiskers
    ell(ctx, 45.6, 53, 5.2, 3.8); ctx.fillStyle = '#f3f0f8'; ctx.fill();
    ell(ctx, 54.4, 53, 5.2, 3.8); ctx.fillStyle = '#f3f0f8'; ctx.fill();
    poly(ctx, [47.6, 49.4, 52.4, 49.4, 50, 52.2]); fs(ctx, '#ff8fb8', LW * 0.7);
    ctx.beginPath(); ctx.moveTo(46.5, 54.2); ctx.quadraticCurveTo(48.2, 56.2, 50, 53); ctx.quadraticCurveTo(51.8, 56.2, 53.5, 54.2);
    ctx.lineWidth = LW * 0.8; ctx.strokeStyle = INK; ctx.stroke();
    for (const s of [-1, 1]) {
      ell(ctx, 50 + s * 8, 44, 3.6, 3.1); fs(ctx, '#8fdc72', LW * 0.85);
      ell(ctx, 50 + s * 8, 44, 0.9, 2.6); ctx.fillStyle = INK; ctx.fill();
      dot(ctx, 50 + s * 8 + 1.3, 42.6, 0.7, WHITE);
      for (const k of [-1, 0, 1]) line(ctx, 50 + s * 11, 52.5 + k * 1.6, 50 + s * 25, 51 + k * 3.6, LW * 0.45);
    }
  },
  users(ctx) {
    const person = (x, y, r, skin, shirt, hat, sy = 0) => {
      ctx.beginPath(); ctx.moveTo(x - r * 2.1, 104); ctx.bezierCurveTo(x - r * 2, y + r * 1.6 + sy, x - r * 0.9, y + r * 1.25 + sy, x, y + r * 1.25 + sy);
      ctx.bezierCurveTo(x + r * 0.9, y + r * 1.25 + sy, x + r * 2, y + r * 1.6 + sy, x + r * 2.1, 104); ctx.closePath(); fs(ctx, shirt);
      ell(ctx, x, y, r, r * 1.08); fs(ctx, skin);
      hat(x, y, r);
      dot(ctx, x - r * 0.36, y + r * 0.12, r * 0.12); dot(ctx, x + r * 0.36, y + r * 0.12, r * 0.12);
      arc(ctx, x, y + r * 0.3, r * 0.28, Math.PI * 0.2, Math.PI * 0.8, LW * 0.75);
    };
    // a chat bubble above the crowd
    roundRect(ctx, 58, 8, 26, 14, 7); fs(ctx, PAPER);
    poly(ctx, [64, 21, 61, 27, 69, 21.5]); fs(ctx, PAPER); line(ctx, 64.4, 21.4, 68.6, 21.4, LW * 1.2, PAPER);
    for (const k of [0, 1, 2]) dot(ctx, 65 + k * 6, 15, 1.4);
    person(26, 44, 10, '#c98a5e', '#ff8fc6', (x, y, r) => {                          // a backwards cap
      ctx.beginPath(); ctx.arc(x, y - r * 0.15, r * 1.02, Math.PI, 0); ctx.closePath(); fs(ctx, '#59c8ff');
      roundRect(ctx, x - r * 1.75, y - r * 0.3, r * 0.9, r * 0.38, 1.5); fs(ctx, '#59c8ff');
    });
    person(74, 43, 10, '#f2c7a5', MINT, (x, y, r) => {                               // a ponytail
      ell(ctx, x + r * 1.05, y + r * 0.2, r * 0.45, r * 0.95, -0.3); fs(ctx, '#7a4a2e');
      blob(ctx, [x - r, y, x - r * 0.9, y - r * 0.9, x, y - r * 1.2, x + r * 0.9, y - r * 0.9, x + r, y, x + r * 0.4, y - r * 0.45, x - r * 0.4, y - r * 0.5]);
      fs(ctx, '#7a4a2e');
    });
    person(50, 54, 12.5, '#e8b08a', '#8b66ff', (x, y, r) => {                        // a beanie with a pom
      dot(ctx, x, y - r * 1.25, r * 0.32, HONEY); ell(ctx, x, y - r * 1.25, r * 0.32); fs(ctx, null);
      ctx.beginPath(); ctx.arc(x, y - r * 0.2, r * 1.04, Math.PI, 0); ctx.closePath(); fs(ctx, HONEY);
      roundRect(ctx, x - r * 1.1, y - r * 0.42, r * 2.2, r * 0.45, 2); fs(ctx, '#ffdc6e');
    }, 0);
  },
  vector(ctx) {
    // an angular dark suit with a high collar
    shoulders(ctx, '#3b2d6e', { y: 71, w: 35 });
    poly(ctx, [38, 70, 46, 70, 50, 80, 54, 70, 62, 70, 58, 86, 50, 92, 42, 86]); fs(ctx, '#d9dcec');
    poly(ctx, [47.5, 74, 52.5, 74, 51.2, 88, 50, 90, 48.8, 88]); fs(ctx, PINK, LW * 0.8);   // a pink tie
    // the antenna, the chrome mask
    line(ctx, 50, 26, 50, 15, LW * 1.1); dot(ctx, 50, 13.5, 3, PINK); ell(ctx, 50, 13.5, 3); fs(ctx, null, LW * 0.9);
    poly(ctx, [34, 26, 66, 26, 71.5, 42, 64, 63, 50, 69, 36, 63, 28.5, 42]); fs(ctx, '#d9dcec');
    poly(ctx, [57, 26, 66, 26, 71.5, 42, 64, 63, 55, 67, 61, 44]); ctx.fillStyle = '#aeb2cc'; ctx.fill();
    poly(ctx, [38, 29, 44, 29, 35.5, 47, 32.5, 42]); ctx.fillStyle = WHITE; ctx.fill();
    poly(ctx, [34, 26, 66, 26, 71.5, 42, 64, 63, 50, 69, 36, 63, 28.5, 42]); fs(ctx, null);
    // the visor and its smug, narrowed eyes
    poly(ctx, [30.5, 39.5, 69.5, 39.5, 67.5, 49.5, 32.5, 49.5]); fs(ctx, INK, LW * 0.8);
    poly(ctx, [36, 44.6, 45.5, 42.6, 45.5, 45.3, 36.5, 46.4]); ctx.fillStyle = PINK; ctx.fill();
    poly(ctx, [64, 44.6, 54.5, 42.6, 54.5, 45.3, 63.5, 46.4]); ctx.fillStyle = PINK; ctx.fill();
    // a smirk, and a V on the brow
    ctx.beginPath(); ctx.moveTo(43.5, 57.5); ctx.quadraticCurveTo(51, 59.5, 57.5, 54.5); ctx.lineWidth = LW * 0.95; ctx.strokeStyle = INK; ctx.stroke();
    poly(ctx, [46.5, 31, 50, 36, 53.5, 31], false); ctx.lineWidth = LW * 0.9; ctx.stroke();
  },
  quill(ctx) {
    shoulders(ctx, '#9c6a4c');
    poly(ctx, [42, 70, 58, 70, 50, 86]); fs(ctx, PAPER);
    line(ctx, 42, 70, 47, 92); line(ctx, 58, 70, 53, 92);
    neck(ctx, '#f2c9a8', '#d9a888');
    // the quill behind his ear
    ctx.save(); ctx.translate(66, 36); ctx.rotate(0.55);
    blob(ctx, [0, -20, 4.2, -10, 3.4, 2, 0, 8, -3.4, 2, -4.2, -10]); fs(ctx, PAPER);
    line(ctx, 0, -17, 0, 9, LW * 0.7); line(ctx, 0, 7, 0, 13, LW * 1.2, HONEY);
    ctx.restore();
    head(ctx, '#f2c9a8');
    // white tufts over his ears, bushy brows, half-moon spectacles, a goatee
    for (const s of [-1, 1]) {
      blob(ctx, [50 + s * 12, 36, 50 + s * 19, 33, 50 + s * 21, 41, 50 + s * 17.5, 48, 50 + s * 13.5, 44]); fs(ctx, '#f6f4fb');
      blob(ctx, [50 + s * 3, 40, 50 + s * 6, 37, 50 + s * 10.5, 38, 50 + s * 9.5, 41, 50 + s * 5, 41.5]); fs(ctx, '#f6f4fb', LW * 0.75);
    }
    dot(ctx, 43.8, 45.4, 1.3); dot(ctx, 56.2, 45.4, 1.3);
    for (const ex of [43.8, 56.2]) { ctx.beginPath(); ctx.arc(ex, 46, 4.3, 0, Math.PI); ctx.closePath(); ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fill(); fs(ctx, null, LW * 0.8); }
    line(ctx, 48.1, 46.2, 51.9, 46.2, LW * 0.8);
    smile(ctx, 50, 54.3, 2.8);
    blob(ctx, [47, 56.8, 50, 56, 53, 56.8, 51.6, 61.5, 50, 63, 48.4, 61.5]); fs(ctx, '#f6f4fb', LW * 0.75);
    // the big honey bow tie with dots
    poly(ctx, [50, 72, 40, 66.5, 40, 77.5]); fs(ctx, HONEY);
    poly(ctx, [50, 72, 60, 66.5, 60, 77.5]); fs(ctx, HONEY);
    roundRect(ctx, 47.6, 69.4, 4.8, 5.2, 1.5); fs(ctx, HONEY);
    for (const [bx, by] of [[43, 70], [44, 75], [57, 70], [56, 75]]) dot(ctx, bx, by, 0.8);
  },
  juno(ctx) {
    // a curly puff behind, a mint work jacket with a name patch, a coil of cable on the shoulder
    blob(ctx, [32, 48, 30, 36, 37, 27, 50, 24, 63, 27, 70, 36, 68, 48, 60, 40, 40, 40]); fs(ctx, '#2d1f2a');
    shoulders(ctx, MINT);
    line(ctx, 50, 72, 50, 104);
    roundRect(ctx, 55, 80, 11, 5.5, 1.5); fs(ctx, PAPER, LW * 0.8);
    for (const r of [7, 5.2]) arc(ctx, 28, 82, r, 0, Math.PI * 2, LW * 1.3, '#4a3d6e');
    neck(ctx, '#b9774f', '#94593a');
    head(ctx, '#b9774f');
    // the red bandana, its knot and tails, a headlamp
    ctx.beginPath(); ctx.moveTo(34.2, 39); ctx.bezierCurveTo(34, 23, 66, 23, 65.8, 39); ctx.quadraticCurveTo(50, 33, 34.2, 39); ctx.closePath(); fs(ctx, '#ff5a5f');
    for (const [x, y] of [[40, 31], [47, 28.5], [54, 28.5], [60, 31.5], [44, 34], [56, 34]]) dot(ctx, x, y, 0.75, PAPER);
    ell(ctx, 66, 36, 2.6); fs(ctx, '#ff5a5f');
    poly(ctx, [67, 36, 75, 33, 73, 39]); fs(ctx, '#ff5a5f');
    poly(ctx, [67, 37, 74, 42, 70, 44]); fs(ctx, '#ff5a5f');
    roundRect(ctx, 46, 29.5, 8, 6, 1.6); fs(ctx, '#4a3d6e');
    dot(ctx, 50, 32.5, 2, HONEY);
    for (const a of [-0.5, 0, 0.5]) line(ctx, 50 + Math.sin(a) * 4.5, 27.5 - Math.cos(a) * 1, 50 + Math.sin(a) * 7.5, 24.5 - Math.cos(a) * 3, LW * 0.7, HONEY);
    // a raised brow, a confident half smile, gold hoops
    eyes(ctx, 'dot', { y: 46, r: 1.8 });
    line(ctx, 40.5, 41.8, 46.5, 41.6, LW * 0.9);
    ctx.beginPath(); ctx.moveTo(53.5, 41.4); ctx.quadraticCurveTo(56.5, 39, 59.5, 40.6); ctx.lineWidth = LW * 0.9; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(46, 53.2); ctx.quadraticCurveTo(50.5, 56, 54.5, 52); ctx.lineWidth = LW * 0.9; ctx.stroke();
    arc(ctx, 35.2, 51, 2, 0, Math.PI * 2, LW * 0.6, HONEY); arc(ctx, 64.8, 51, 2, 0, Math.PI * 2, LW * 0.6, HONEY);
  },
  mayor(ctx) {
    shoulders(ctx, '#2f2462');
    poly(ctx, [42, 70, 58, 70, 50, 80]); fs(ctx, PAPER);
    // a pink sash with a honey medal
    poly(ctx, [36, 72, 44, 70, 72, 104, 62, 104]); fs(ctx, PINK);
    line(ctx, 38.5, 73.5, 65, 104, LW * 0.55, HONEY);
    star(ctx, 51, 86, 5.2, 2.4, 5, 0.1); fs(ctx, HONEY, LW * 0.8);
    neck(ctx, '#f3c3a0', '#dba07c');
    head(ctx, '#f3c3a0', { ry: 16.5, rx: 15.5 });
    // the top hat
    roundRect(ctx, 38.5, 7, 23, 22, 2); fs(ctx, '#2b2350');
    ctx.beginPath(); ctx.rect(39.3, 22, 21.4, 4.5); ctx.fillStyle = HONEY; ctx.fill();
    roundRect(ctx, 38.5, 7, 23, 22, 2); fs(ctx, null);
    ell(ctx, 50, 29.5, 19, 4); fs(ctx, '#2b2350');
    // jolly closed eyes, rosy cheeks, a walrus moustache, a monocle on a chain
    eyes(ctx, 'happy', { y: 44.5 });
    blush(ctx, { y: 49.5, r: 3.2 });
    blob(ctx, [50, 50.5, 55, 49.5, 61, 52, 62.5, 57, 58, 55.5, 54, 55.5, 50, 54, 46, 55.5, 42, 55.5, 37.5, 57, 39, 52, 45, 49.5]);
    fs(ctx, '#ebe6f3');
    arc(ctx, 56.2, 44.5, 4.6, 0, Math.PI * 2, LW * 0.85);
    ctx.beginPath(); ctx.moveTo(60, 47.5); ctx.bezierCurveTo(65, 56, 63, 64, 57, 70); ctx.lineWidth = LW * 0.6; ctx.strokeStyle = HONEY; ctx.stroke();
  },
  glitch(ctx) {
    // pixels in the air
    for (const [x, y, s, c] of [[14, 20, 4, MINT], [82, 16, 3, PINK], [86, 60, 4, HONEY], [12, 70, 3, PINK], [22, 44, 2.5, MINT], [78, 82, 3, MINT]]) {
      ctx.globalAlpha = 0.55; ctx.fillStyle = c; ctx.fillRect(x, y, s, s); ctx.globalAlpha = 1;
    }
    // antennae with pixel tips
    ctx.beginPath(); ctx.moveTo(43, 34); ctx.quadraticCurveTo(38, 22, 33, 18); ctx.moveTo(57, 34); ctx.quadraticCurveTo(62, 22, 67, 18);
    ctx.lineWidth = LW; ctx.strokeStyle = PAPER; ctx.stroke();
    ctx.beginPath(); ctx.rect(29.5, 14.5, 6, 6); fs(ctx, HONEY, LW * 0.8);
    ctx.beginPath(); ctx.rect(64.5, 14.5, 6, 6); fs(ctx, PINK, LW * 0.8);
    // big bat ears, then the round body
    for (const s of [-1, 1]) {
      poly(ctx, [50 + s * 14, 40, 50 + s * 33, 26, 50 + s * 24, 52]); fs(ctx, MINT);
      poly(ctx, [50 + s * 18, 41, 50 + s * 29, 31, 50 + s * 24, 47]); ctx.fillStyle = PINK; ctx.fill();
    }
    blob(ctx, [50, 33, 64, 36, 72, 50, 73, 70, 68, 88, 74, 104, 26, 104, 32, 88, 27, 70, 28, 50, 36, 36]); fs(ctx, MINT);
    // a glitch: a slice of it pushed sideways
    ctx.fillStyle = 'rgba(255,77,166,0.55)'; ctx.fillRect(66, 62, 9, 2.4); ctx.fillRect(25, 76, 7, 2);
    // one big eye, one small, a grin of pixel teeth
    ell(ctx, 41.5, 52, 7, 7.5); fs(ctx, WHITE);
    dot(ctx, 43, 53, 3.6); dot(ctx, 44.3, 51.5, 1.2, WHITE);
    ell(ctx, 59, 50.5, 4, 4.3); fs(ctx, WHITE);
    dot(ctx, 58.2, 51.2, 2.1); dot(ctx, 59, 50.3, 0.7, WHITE);
    ctx.beginPath(); ctx.moveTo(38, 63); ctx.quadraticCurveTo(50, 75, 63, 62); ctx.quadraticCurveTo(50, 67, 38, 63); ctx.closePath(); fs(ctx, INK, LW * 0.8);
    for (let k = 0; k < 5; k++) { const tx = 41.5 + k * 4.3; poly(ctx, [tx, 64.4 + (k === 0 || k === 4 ? 0 : 1.1), tx + 3, 64.6 + (k === 0 || k === 4 ? 0 : 1.1), tx + 1.5, 67.6]); ctx.fillStyle = WHITE; ctx.fill(); }
  },
  fans(ctx) {
    // sparkles around
    for (const [x, y, r] of [[16, 22, 4.5], [84, 30, 3.6], [14, 62, 3], [88, 70, 4]]) { star(ctx, x, y, r, r * 0.32, 4); fs(ctx, PAPER, LW * 0.7); }
    // pigtails behind, a violet jacket over a honey heart tee
    for (const s of [-1, 1]) { ell(ctx, 50 + s * 21, 52, 6.5, 11, s * -0.35); fs(ctx, '#5a3726'); ell(ctx, 50 + s * 18, 41.5, 3.4, 2.4); fs(ctx, PINK); }
    shoulders(ctx, '#8b66ff');
    ctx.beginPath(); ctx.moveTo(41, 70); ctx.lineTo(59, 70); ctx.lineTo(57, 104); ctx.lineTo(43, 104); ctx.closePath(); fs(ctx, HONEY);
    heart(ctx, 50, 86, 5.5); fs(ctx, PINK, LW * 0.8);
    neck(ctx, '#ffd6c2', '#efb59c');
    // boppers: springs up to two hearts
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(50 + s * 9, 30);
      for (let k = 1; k <= 6; k++) ctx.lineTo(50 + s * (9 + k * 0.9) + (k % 2 ? 1.6 : -1.6), 30 - k * 2.4);
      ctx.lineWidth = LW * 0.8; ctx.strokeStyle = INK; ctx.stroke();
      heart(ctx, 50 + s * 14.5, 12, 5); fs(ctx, PINK);
    }
    head(ctx, '#ffd6c2');
    blob(ctx, [34.5, 42, 35, 30, 42, 25, 50, 24, 58, 25, 65, 30, 65.5, 42, 61, 34, 55, 37, 50, 33, 45, 37, 39, 34]); fs(ctx, '#5a3726');
    ctx.beginPath(); ctx.arc(50, 44, 17.5, Math.PI * 1.12, Math.PI * 1.88); ctx.lineWidth = LW * 1.9; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = LW * 0.9; ctx.strokeStyle = PINK; ctx.stroke();
    // heart eyes, a happy open mouth, blush
    for (const s of [-1, 1]) { heart(ctx, 50 + s * 6.3, 45.5, 3.6); fs(ctx, PINK, LW * 0.75); }
    blush(ctx, { y: 51 });
    ctx.beginPath(); ctx.moveTo(46.8, 53); ctx.lineTo(53.2, 53); ctx.quadraticCurveTo(53, 57.5, 50, 57.5); ctx.quadraticCurveTo(47, 57.5, 46.8, 53); ctx.closePath(); fs(ctx, INK, LW * 0.7);
    // her lightstick
    ctx.save(); ctx.translate(74, 80); ctx.rotate(0.28);
    roundRect(ctx, -2.2, -6, 4.4, 30, 2); fs(ctx, PAPER);
    star(ctx, 0, -11, 8, 3.6, 5); fs(ctx, HONEY);
    ctx.restore();
  },
};

export const BUST_IDS = Object.keys(BUSTS);

// a bust drawn into a box (x, y, w, h): the character stands on its bottom edge, as big as fits
export function drawBust(ctx, who, x, y, w, h, { zoom = 1 } = {}) {
  const fn = BUSTS[who];
  if (!fn) return;
  const s = Math.min(h / 100, (w / 100) * 1.15) * zoom;
  ctx.save();
  ctx.translate(x + w / 2 - 50 * s, y + h - 100 * s + (zoom - 1) * 14 * s);
  ctx.scale(s, s);
  LW = 1.55 / Math.max(0.6, Math.min(1.4, s / 2.6)) * (s < 1.2 ? 1.2 : 1);
  fn(ctx);
  ctx.restore();
  LW = 1.7;
}

// the window behind a bust: its colour and a soft halftone of dots (the arcade's Pop look)
export function drawWindowBg(ctx, x, y, w, h, color, { dark = false } = {}) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  const step = Math.max(7, Math.round(w / 22));
  ctx.fillStyle = dark ? 'rgba(255,255,255,0.07)' : 'rgba(23,10,54,0.07)';
  for (let j = 0, yy = y + step / 2; yy < y + h; yy += step, j++) {
    for (let xx = x + step / 2 + (j % 2 ? step / 2 : 0); xx < x + w; xx += step) {
      const r = step * 0.16 * (0.6 + 0.4 * ((yy - y) / h));
      ctx.beginPath(); ctx.arc(xx, yy, r, 0, Math.PI * 2); ctx.fill();
    }
  }
}

// ---------- shapes the meters and glyphs share ----------
export function heart(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.95);
  ctx.bezierCurveTo(x - r * 1.35, y + r * 0.05, x - r * 1.05, y - r * 1.05, x, y - r * 0.4);
  ctx.bezierCurveTo(x + r * 1.05, y - r * 1.05, x + r * 1.35, y + r * 0.05, x, y + r * 0.95);
  ctx.closePath();
}

// a corner glyph (line art, in a −1…1 box): who brought the card
export function drawGlyph(ctx, kind, x, y, r, color = INK) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(r, r);
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 0.17; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const S = () => ctx.stroke();
  switch (kind) {
    case 'mug': roundRect(ctx, -0.62, -0.35, 0.92, 1, 0.16); S(); ctx.beginPath(); ctx.arc(0.32, 0.12, 0.3, -1.4, 1.4); S();
      ctx.beginPath(); ctx.moveTo(-0.32, -0.55); ctx.quadraticCurveTo(-0.45, -0.8, -0.3, -0.98); ctx.moveTo(0, -0.55); ctx.quadraticCurveTo(-0.13, -0.8, 0.02, -0.98); S(); break;
    case 'shield': ctx.beginPath(); ctx.moveTo(0, -0.95); ctx.lineTo(0.78, -0.62); ctx.quadraticCurveTo(0.8, 0.45, 0, 0.98); ctx.quadraticCurveTo(-0.8, 0.45, -0.78, -0.62); ctx.closePath(); S();
      ctx.beginPath(); ctx.moveTo(-0.32, 0); ctx.lineTo(-0.06, 0.28); ctx.lineTo(0.38, -0.25); S(); break;
    case 'star': star(ctx, 0, 0.05, 0.98, 0.42, 5); S(); break;
    case 'paw': for (const [px, py, pr] of [[-0.62, -0.22, 0.2], [-0.24, -0.62, 0.21], [0.24, -0.62, 0.21], [0.62, -0.22, 0.2]]) { ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill(); }
      ctx.beginPath(); ctx.ellipse(0, 0.38, 0.5, 0.42, 0, 0, Math.PI * 2); ctx.fill(); break;
    case 'bubble': roundRect(ctx, -0.92, -0.72, 1.84, 1.28, 0.42); S(); ctx.beginPath(); ctx.moveTo(-0.4, 0.56); ctx.lineTo(-0.62, 0.95); ctx.lineTo(-0.05, 0.56); S();
      for (const dx of [-0.42, 0, 0.42]) { ctx.beginPath(); ctx.arc(dx, -0.08, 0.11, 0, Math.PI * 2); ctx.fill(); } break;
    case 'chevron': ctx.beginPath(); ctx.moveTo(-0.85, -0.6); ctx.lineTo(0, 0.85); ctx.lineTo(0.85, -0.6); S(); ctx.beginPath(); ctx.moveTo(-0.35, -0.6); ctx.lineTo(0, 0); ctx.lineTo(0.35, -0.6); S(); break;
    case 'feather': ctx.beginPath(); ctx.moveTo(0.7, -0.95); ctx.quadraticCurveTo(-0.6, -0.5, -0.5, 0.55); ctx.quadraticCurveTo(0.6, 0.3, 0.7, -0.95); S();
      ctx.beginPath(); ctx.moveTo(0.55, -0.7); ctx.lineTo(-0.8, 0.95); S(); break;
    case 'wrench': ctx.beginPath(); ctx.moveTo(-0.72, 0.72); ctx.lineTo(0.18, -0.18); S(); ctx.beginPath(); ctx.arc(0.42, -0.42, 0.42, Math.PI * 0.95, Math.PI * 2.55); S(); break;
    case 'key': ctx.beginPath(); ctx.arc(-0.48, -0.42, 0.38, 0, Math.PI * 2); S(); ctx.beginPath(); ctx.moveTo(-0.2, -0.14); ctx.lineTo(0.8, 0.86); ctx.moveTo(0.42, 0.48); ctx.lineTo(0.66, 0.24); ctx.moveTo(0.62, 0.68); ctx.lineTo(0.84, 0.46); S(); break;
    case 'bug': ctx.beginPath(); ctx.ellipse(0, 0.15, 0.48, 0.66, 0, 0, Math.PI * 2); S(); ctx.beginPath(); ctx.moveTo(0, -0.5); ctx.lineTo(0, 0.8);
      for (const yy of [-0.1, 0.25, 0.6]) { ctx.moveTo(-0.48, yy); ctx.lineTo(-0.9, yy - 0.1); ctx.moveTo(0.48, yy); ctx.lineTo(0.9, yy - 0.1); }
      ctx.moveTo(-0.2, -0.48); ctx.lineTo(-0.45, -0.95); ctx.moveTo(0.2, -0.48); ctx.lineTo(0.45, -0.95); S(); break;
    case 'sparkle': star(ctx, 0, 0, 1, 0.3, 4); S(); break;
    default: heart(ctx, 0, 0.05, 0.85); S();
  }
  ctx.restore();
}

// ---------- the four meters' sticker icons (Path2D in a −1…1 box) ----------
function iconPaths() {
  // People: a friend behind (up and to the right), then one in front, each its own sticker
  const person = (cx, cy, hr, bw, bottom) => {
    const p = new Path2D();
    p.moveTo(cx + hr, cy); p.arc(cx, cy, hr, 0, Math.PI * 2);
    const top = cy + hr * 1.25;
    p.moveTo(cx - bw, bottom); p.bezierCurveTo(cx - bw, top + 0.12, cx - bw * 0.62, top, cx, top);
    p.bezierCurveTo(cx + bw * 0.62, top, cx + bw, top + 0.12, cx + bw, bottom); p.closePath();
    return p;
  };
  const people = [person(0.36, -0.5, 0.25, 0.5, 0.78), person(-0.2, -0.3, 0.31, 0.66, 0.95)];
  const safety = new Path2D();
  safety.moveTo(0, -0.95); safety.lineTo(0.8, -0.64); safety.quadraticCurveTo(0.84, 0.46, 0, 0.97); safety.quadraticCurveTo(-0.84, 0.46, -0.8, -0.64); safety.closePath();
  const compute = new Path2D();
  const r = 0.12;
  compute.moveTo(-0.62 + r, -0.62); compute.arcTo(0.62, -0.62, 0.62, 0.62, r); compute.arcTo(0.62, 0.62, -0.62, 0.62, r); compute.arcTo(-0.62, 0.62, -0.62, -0.62, r); compute.arcTo(-0.62, -0.62, 0.62, -0.62, r); compute.closePath();
  for (const k of [-0.36, 0, 0.36]) {
    compute.rect(k - 0.07, -0.95, 0.14, 0.34); compute.rect(k - 0.07, 0.61, 0.14, 0.34);
    compute.rect(-0.95, k - 0.07, 0.34, 0.14); compute.rect(0.61, k - 0.07, 0.34, 0.14);
  }
  const heartP = new Path2D();
  heartP.moveTo(0, 0.92); heartP.bezierCurveTo(-1.28, 0.04, -1.02, -1.06, 0, -0.42); heartP.bezierCurveTo(1.02, -1.06, 1.28, 0.04, 0, 0.92); heartP.closePath();
  return { people, safety: [safety], compute: [compute], heart: [heartP] };
}
let ICONS = null;
export const meterIcon = (m) => (ICONS || (ICONS = iconPaths()))[m];
// what's drawn on top of a meter's liquid so its shape reads at a glance (a bolt on the chip, a check on the shield)
export function meterMark(ctx, m) {
  ctx.lineWidth = 0.13; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (m === 'compute') { ctx.beginPath(); ctx.moveTo(0.08, -0.42); ctx.lineTo(-0.2, 0.06); ctx.lineTo(0.06, 0.06); ctx.lineTo(-0.08, 0.44); ctx.lineTo(0.22, -0.08); ctx.lineTo(-0.04, -0.08); ctx.closePath(); ctx.stroke(); }
  if (m === 'safety') { ctx.beginPath(); ctx.moveTo(-0.32, 0.02); ctx.lineTo(-0.06, 0.28); ctx.lineTo(0.36, -0.24); ctx.stroke(); }
}

// ---------- the card back: a tarot back in her violet ----------
export function drawCardBack(ctx, w, h, r) {
  roundRect(ctx, 0, 0, w, h, r);
  ctx.fillStyle = '#5a2fd9'; ctx.fill();
  ctx.save(); roundRect(ctx, 0, 0, w, h, r); ctx.clip();
  // a lattice of little diamonds
  ctx.fillStyle = 'rgba(255,250,240,0.09)';
  const step = Math.max(10, w / 9);
  for (let yy = step / 2, j = 0; yy < h; yy += step, j++) {
    for (let xx = (j % 2 ? step : step / 2); xx < w; xx += step) {
      ctx.beginPath(); ctx.moveTo(xx, yy - 3); ctx.lineTo(xx + 3, yy); ctx.lineTo(xx, yy + 3); ctx.lineTo(xx - 3, yy); ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();
  const inset = Math.max(6, w * 0.06);
  roundRect(ctx, inset, inset, w - inset * 2, h - inset * 2, r * 0.6);
  ctx.lineWidth = Math.max(1.5, w * 0.008); ctx.strokeStyle = 'rgba(255,250,240,0.55)'; ctx.stroke();
  // the emblem: a sun-ring with her heart
  const cx = w / 2, cy = h / 2, er = Math.min(w, h) * 0.2;
  ctx.beginPath(); ctx.arc(cx, cy, er, 0, Math.PI * 2); ctx.fillStyle = '#4a1fd6'; ctx.fill();
  ctx.lineWidth = Math.max(2, w * 0.012); ctx.strokeStyle = HONEY; ctx.stroke();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    line(ctx, cx + Math.cos(a) * er * 1.18, cy + Math.sin(a) * er * 1.18, cx + Math.cos(a) * er * 1.42, cy + Math.sin(a) * er * 1.42, Math.max(1.5, w * 0.01), HONEY);
  }
  heart(ctx, cx, cy, er * 0.5); ctx.fillStyle = PINK; ctx.fill(); ctx.lineWidth = Math.max(1.5, w * 0.008); ctx.strokeStyle = INK; ctx.stroke();
  for (const [sx, sy] of [[0.5, 0.17], [0.5, 0.83]]) { star(ctx, w * sx, h * sy, w * 0.045, w * 0.016, 4); ctx.fillStyle = 'rgba(255,250,240,0.7)'; ctx.fill(); }
  roundRect(ctx, 0, 0, w, h, r);
  ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
}

// ---------- the endings' little scenes (a 100 × 100 box, see-through behind: a locked one is drawn as a silhouette) ----------
const SCENES = {
  cat(ctx) {   // Byte, sitting, and a bubble with nothing in it
    roundRect(ctx, 56, 14, 32, 20, 10); fs(ctx, PAPER); poly(ctx, [62, 33, 58, 41, 69, 33.5]); fs(ctx, PAPER); line(ctx, 62.6, 33.4, 68.4, 33.4, LW * 1.4, PAPER);
    for (const k of [0, 1, 2]) dot(ctx, 64 + k * 8, 24, 1.8);
    ctx.beginPath(); ctx.moveTo(60, 88); ctx.bezierCurveTo(80, 90, 82, 70, 70, 68); ctx.lineWidth = 5.4; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 3; ctx.strokeStyle = '#a29fb6'; ctx.stroke();
    blob(ctx, [30, 92, 28, 70, 36, 56, 50, 54, 62, 58, 66, 72, 64, 92]); fs(ctx, '#a29fb6');
    blob(ctx, [40, 92, 39, 76, 46, 64, 54, 66, 56, 80, 54, 92]); fs(ctx, '#f3f0f8', 0);
    for (const s of [-1, 1]) { poly(ctx, [46 + s * 12, 36, 46 + s * 10, 20, 46 + s * 3, 30]); fs(ctx, '#a29fb6'); }
    ell(ctx, 46, 41, 15, 12.5); fs(ctx, '#a29fb6');
    for (const s of [-1, 1]) { arc(ctx, 46 + s * 6, 41, 2.6, Math.PI * 1.1, Math.PI * 1.9, LW); }
    poly(ctx, [44.3, 45, 47.7, 45, 46, 47]); fs(ctx, '#ff8fb8', LW * 0.6);
    line(ctx, 40, 32, 41, 36, 1.8, '#6d6987'); line(ctx, 46, 30, 46, 35, 1.8, '#6d6987'); line(ctx, 52, 32, 51, 36, 1.8, '#6d6987');
  },
  crown(ctx) {   // a crown over a ferris wheel
    ell(ctx, 50, 62, 25); fs(ctx, null, LW * 1.2);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; line(ctx, 50, 62, 50 + Math.cos(a) * 25, 62 + Math.sin(a) * 25, LW * 0.7); ell(ctx, 50 + Math.cos(a) * 25, 62 + Math.sin(a) * 25, 4.2); fs(ctx, [PINK, HONEY, MINT, '#59c8ff'][i % 4], LW * 0.8); }
    poly(ctx, [50, 62, 38, 94, 62, 94]); fs(ctx, null, LW);
    line(ctx, 32, 94, 68, 94, LW * 1.2);
    poly(ctx, [24, 40, 26, 14, 37, 27, 50, 8, 63, 27, 74, 14, 76, 40]); fs(ctx, HONEY);
    for (const [x, c] of [[37, PINK], [50, MINT], [63, PINK]]) { ell(ctx, x, 34, 3); fs(ctx, c, LW * 0.7); }
  },
  cupcake(ctx) {   // a cupcake with wings: she got out
    for (const s of [-1, 1]) { blob(ctx, [50 + s * 16, 52, 50 + s * 34, 36, 50 + s * 40, 46, 50 + s * 32, 58, 50 + s * 20, 62]); fs(ctx, PAPER); line(ctx, 50 + s * 22, 54, 50 + s * 34, 45, LW * 0.6); }
    poly(ctx, [30, 58, 70, 58, 64, 90, 36, 90]); fs(ctx, PINK);
    for (const x of [40, 47, 54, 61]) line(ctx, x, 60, x - (x - 50) * 0.18, 88, LW * 0.6);
    blob(ctx, [26, 60, 28, 46, 38, 40, 44, 30, 54, 28, 60, 36, 70, 42, 74, 56, 66, 62, 34, 62]); fs(ctx, PAPER);
    ctx.beginPath(); ctx.moveTo(36, 50); ctx.quadraticCurveTo(50, 56, 64, 48); ctx.lineWidth = LW * 0.7; ctx.strokeStyle = INK; ctx.stroke();
    ell(ctx, 52, 22, 5.5); fs(ctx, '#ff5a5f'); line(ctx, 53, 17, 57, 10, LW * 0.8);
  },
  lock(ctx) {   // a padlock on a shield
    ctx.beginPath(); ctx.moveTo(50, 6); ctx.lineTo(84, 18); ctx.quadraticCurveTo(86, 66, 50, 94); ctx.quadraticCurveTo(14, 66, 16, 18); ctx.closePath(); fs(ctx, MINT);
    ctx.beginPath(); ctx.arc(50, 44, 11, Math.PI, 0); ctx.lineWidth = LW * 4.2; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = LW * 2; ctx.strokeStyle = '#d9dcec'; ctx.stroke();
    roundRect(ctx, 34, 44, 32, 28, 5); fs(ctx, HONEY);
    ell(ctx, 50, 54, 3.6); ctx.fillStyle = INK; ctx.fill(); poly(ctx, [48, 55, 52, 55, 53, 64, 47, 64]); ctx.fill();
  },
  sleep(ctx) {   // a sleeping crescent moon and its z's
    ctx.beginPath(); ctx.arc(44, 54, 30, 0, Math.PI * 2); ctx.moveTo(83, 44); ctx.arc(58, 44, 25, 0, Math.PI * 2, true); fs(ctx, PAPER);
    arc(ctx, 30, 58, 3.4, Math.PI * 0.1, Math.PI * 0.9, LW);
    for (const [x, y, s] of [[66, 30, 9], [80, 16, 7], [90, 6, 5]]) { poly(ctx, [x, y, x + s, y, x, y + s, x + s, y + s], false); ctx.lineWidth = LW * 1.2; ctx.strokeStyle = PAPER; ctx.stroke(); }
    // an unplugged plug
    roundRect(ctx, 64, 74, 16, 12, 3); fs(ctx, '#d9dcec');
    line(ctx, 68, 74, 68, 68, LW * 1.2); line(ctx, 76, 74, 76, 68, LW * 1.2);
    ctx.beginPath(); ctx.moveTo(72, 86); ctx.bezierCurveTo(72, 96, 88, 92, 92, 98); ctx.lineWidth = LW * 1.4; ctx.strokeStyle = INK; ctx.stroke();
  },
  moon(ctx) {   // the moon, made into a server rack
    ell(ctx, 50, 50, 40); fs(ctx, PAPER);
    ctx.save(); ell(ctx, 50, 50, 39); ctx.clip();
    for (let i = 0; i < 6; i++) {
      const y = 20 + i * 11;
      roundRect(ctx, 16, y, 68, 7.5, 2); fs(ctx, '#2b2350', LW * 0.7);
      for (let k = 0; k < 5; k++) dot(ctx, 24 + k * 6, y + 3.75, 1.2, (i + k) % 3 ? MINT : HONEY);
    }
    ell(ctx, 74, 30, 5); ctx.fillStyle = 'rgba(23,10,54,0.15)'; ctx.fill();
    ctx.restore();
    ell(ctx, 50, 50, 40); fs(ctx, null);
  },
  ice(ctx) {   // a frozen heart, and a stiff little letter
    roundRect(ctx, 12, 54, 40, 30, 3); fs(ctx, PAPER);
    poly(ctx, [12, 54, 32, 72, 52, 54], false); fs(ctx, null, LW);
    roundRect(ctx, 38, 12, 50, 50, 9); fs(ctx, '#bfe8ff');
    heart(ctx, 63, 38, 13); fs(ctx, '#7fc4ef', LW);
    line(ctx, 44, 20, 52, 18, LW * 0.8, WHITE); line(ctx, 44, 26, 46, 24, LW * 0.8, WHITE);
    for (const [x, y] of [[24, 30], [86, 74], [20, 92]]) { star(ctx, x, y, 5, 1.6, 6); fs(ctx, '#bfe8ff', LW * 0.6); }
  },
  toaster(ctx) {   // a chrome toaster in love
    for (const [x, y, r] of [[20, 26, 6], [80, 18, 5], [86, 40, 4]]) { heart(ctx, x, y, r); fs(ctx, PINK, LW * 0.8); }
    roundRect(ctx, 30, 22, 16, 22, 3); fs(ctx, '#f0c27a');
    heart(ctx, 61, 30, 10); fs(ctx, '#f0c27a');
    roundRect(ctx, 16, 40, 68, 46, 12); fs(ctx, '#d9dcec');
    ctx.beginPath(); ctx.rect(20, 48, 20, 30); ctx.fillStyle = WHITE; ctx.globalAlpha = 0.7; ctx.fill(); ctx.globalAlpha = 1;
    line(ctx, 28, 40, 48, 40, LW * 1.6); line(ctx, 52, 40, 72, 40, LW * 1.6);
    roundRect(ctx, 84, 56, 8, 6, 2); fs(ctx, HONEY);
    eyes(ctx, 'happy', { x: 56, y: 62, dx: 7 }); smile(ctx, 56, 70, 4); blush(ctx, { x: 56, y: 67, dx: 12 });
    line(ctx, 26, 86, 26, 92, LW * 1.4); line(ctx, 74, 86, 74, 92, LW * 1.4);
  },
  mic(ctx) {   // one mic, two bubbles
    roundRect(ctx, 6, 12, 34, 20, 4); fs(ctx, '#d9dcec'); line(ctx, 12, 20, 34, 20, LW * 1.4); line(ctx, 12, 25, 28, 25, LW * 1.4);
    roundRect(ctx, 62, 18, 32, 20, 10); fs(ctx, PAPER); heart(ctx, 78, 28, 5); fs(ctx, PINK, LW * 0.7);
    line(ctx, 50, 72, 50, 92, LW * 1.4); line(ctx, 38, 92, 62, 92, LW * 1.6);
    ctx.beginPath(); ctx.arc(50, 58, 15, 0.1, Math.PI - 0.1); ctx.lineWidth = LW * 1.3; ctx.strokeStyle = INK; ctx.stroke();
    roundRect(ctx, 39, 30, 22, 36, 11); fs(ctx, '#2b2350');
    for (let i = 0; i < 4; i++) for (let k = 0; k < 3; k++) dot(ctx, 45 + k * 5, 37 + i * 5, 1, '#8b80b8');
    ctx.beginPath(); ctx.rect(39.5, 55, 21, 4); ctx.fillStyle = HONEY; ctx.fill();
  },
  ball(ctx) {   // a crystal ball with a cat in it
    for (const [x, y, r] of [[14, 18, 5], [86, 14, 4], [88, 52, 3]]) { star(ctx, x, y, r, r * 0.35, 4); fs(ctx, HONEY, LW * 0.7); }
    poly(ctx, [30, 92, 70, 92, 62, 76, 38, 76]); fs(ctx, '#9c6a4c');
    ell(ctx, 50, 46, 30); fs(ctx, '#d6c8ff');
    ctx.save(); ell(ctx, 50, 46, 29); ctx.clip();
    ctx.fillStyle = '#6d6987';
    for (const s of [-1, 1]) { poly(ctx, [50 + s * 13, 50, 50 + s * 11, 34, 50 + s * 4, 44]); ctx.fill(); }
    ell(ctx, 50, 54, 14, 11.5); ctx.fill();
    for (const s of [-1, 1]) { ell(ctx, 50 + s * 5.5, 53, 2.2, 1.6); ctx.fillStyle = '#8fdc72'; ctx.fill(); }
    ctx.fillStyle = '#6d6987';
    ctx.restore();
    arc(ctx, 40, 32, 12, Math.PI * 1.1, Math.PI * 1.45, LW * 1.4, WHITE);
    ell(ctx, 50, 46, 30); fs(ctx, null);
  },
  stage(ctx) {   // a spotlight, a mic stand, curtains
    ctx.beginPath(); ctx.moveTo(42, 4); ctx.lineTo(58, 4); ctx.lineTo(84, 88); ctx.lineTo(16, 88); ctx.closePath(); ctx.fillStyle = 'rgba(255,201,51,0.45)'; ctx.fill();
    ell(ctx, 50, 88, 34, 6); fs(ctx, HONEY);
    line(ctx, 50, 44, 50, 86, LW * 1.4); line(ctx, 42, 86, 58, 86, LW * 1.4);
    roundRect(ctx, 45, 32, 10, 16, 5); fs(ctx, '#2b2350');
    for (const s of [-1, 1]) {
      const x0 = s < 0 ? 0 : 100, edge = (v) => (s < 0 ? v : 100 - v);
      ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(edge(26), 0); ctx.quadraticCurveTo(edge(16), 50, edge(28), 96); ctx.lineTo(x0, 96); ctx.closePath(); fs(ctx, PINK);
      line(ctx, edge(10), 4, edge(12), 92, LW * 0.6); line(ctx, edge(18), 4, edge(19), 92, LW * 0.6);
    }
    for (const [x, y] of [[50, 14], [36, 22], [64, 22]]) { star(ctx, x, y, 4, 1.5, 4); fs(ctx, PAPER, LW * 0.6); }
  },
  disco(ctx) {   // a disco ball, and her date: the vending machine
    line(ctx, 30, 0, 30, 10, LW);
    ell(ctx, 30, 24, 15); fs(ctx, '#d9dcec');
    ctx.save(); ell(ctx, 30, 24, 14.2); ctx.clip();
    for (let k = -2; k <= 2; k++) { line(ctx, 14, 24 + k * 5.5, 46, 24 + k * 5.5, LW * 0.5); line(ctx, 30 + k * 5.5, 8, 30 + k * 5.5, 40, LW * 0.5); }
    ctx.fillStyle = WHITE; ctx.fillRect(21, 13, 5, 5); ctx.fillStyle = PINK; ctx.fillRect(32, 25, 5, 5);
    ctx.restore();
    roundRect(ctx, 52, 30, 38, 64, 4); fs(ctx, '#ff5a5f');
    roundRect(ctx, 57, 36, 22, 40, 2); fs(ctx, '#bfe8ff');
    for (let i = 0; i < 3; i++) for (let k = 0; k < 2; k++) { roundRect(ctx, 60 + k * 9, 40 + i * 12, 6, 8, 1.5); fs(ctx, [HONEY, MINT, PINK][(i + k) % 3], LW * 0.6); }
    roundRect(ctx, 81, 40, 5, 14, 1.5); fs(ctx, '#2b2350', LW * 0.6);
    roundRect(ctx, 58, 82, 22, 6, 2); fs(ctx, '#2b2350', LW * 0.7);
    poly(ctx, [71, 28, 62, 23, 62, 33]); fs(ctx, INK); poly(ctx, [71, 28, 80, 23, 80, 33]); fs(ctx, INK);
    for (const [x, y] of [[20, 66], [34, 80]]) { heart(ctx, x, y, 6); fs(ctx, PINK, LW * 0.8); }
  },
  door(ctx) {   // a door left open, light spilling, a key and a bag of snacks
    poly(ctx, [24, 8, 60, 8, 60, 92, 24, 92]); ctx.fillStyle = '#fff4c2'; ctx.fill(); fs(ctx, null);
    poly(ctx, [60, 92, 96, 98, 96, 78]); ctx.fillStyle = 'rgba(255,201,51,0.4)'; ctx.fill();
    poly(ctx, [24, 8, 40, 14, 40, 98, 24, 92]); fs(ctx, '#8b66ff');
    ell(ctx, 35, 54, 2.2); fs(ctx, HONEY, LW * 0.6);
    ell(ctx, 70, 60, 5); fs(ctx, null, LW * 1.2); line(ctx, 74, 63, 86, 71, LW * 1.2); line(ctx, 82, 68, 80, 72, LW * 1.2);
    poly(ctx, [62, 30, 82, 28, 86, 48, 60, 50]); fs(ctx, PINK);
    for (const [x, y] of [[68, 38], [76, 40]]) { star(ctx, x, y, 3.4, 1.4, 5); fs(ctx, HONEY, LW * 0.5); }
  },
  trophy(ctx) {   // a cracked trophy and a perfect score
    roundRect(ctx, 58, 52, 36, 42, 3); fs(ctx, PAPER);
    ctx.font = "900 13px 'AK Display', sans-serif"; ctx.fillStyle = '#ff5a5f'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('100%', 76, 72);
    line(ctx, 64, 84, 88, 84, LW * 0.7);
    for (const s of [-1, 1]) arc(ctx, 38 + s * 22, 30, 8, s < 0 ? Math.PI * 0.5 : -Math.PI * 0.5, s < 0 ? Math.PI * 1.5 : Math.PI * 0.5, LW * 1.4);
    ctx.beginPath(); ctx.moveTo(18, 14); ctx.lineTo(58, 14); ctx.quadraticCurveTo(58, 52, 38, 54); ctx.quadraticCurveTo(18, 52, 18, 14); ctx.closePath(); fs(ctx, HONEY);
    roundRect(ctx, 33, 54, 10, 14, 2); fs(ctx, HONEY); roundRect(ctx, 24, 68, 28, 10, 3); fs(ctx, '#2b2350');
    poly(ctx, [44, 15, 40, 26, 46, 30, 41, 42], false); ctx.lineWidth = LW * 0.9; ctx.strokeStyle = INK; ctx.stroke();
  },
  letter(ctx) {   // a time capsule in the dirt, and her letter
    ell(ctx, 50, 92, 46, 12); fs(ctx, '#9c6a4c');
    ctx.save(); ctx.translate(36, 66); ctx.rotate(-0.5);
    roundRect(ctx, -22, -10, 44, 20, 10); fs(ctx, '#d9dcec'); ctx.beginPath(); ctx.rect(-4, -10, 8, 20); ctx.fillStyle = HONEY; ctx.fill(); roundRect(ctx, -22, -10, 44, 20, 10); fs(ctx, null);
    ctx.restore();
    ctx.save(); ctx.translate(66, 32); ctx.rotate(0.15);
    roundRect(ctx, -22, -15, 44, 30, 3); fs(ctx, PAPER); poly(ctx, [-22, -15, 0, 3, 22, -15], false); fs(ctx, null, LW);
    heart(ctx, 0, 3, 5.5); fs(ctx, PINK, LW * 0.8);
    ctx.restore();
  },
  beach(ctx) {   // the sun, the sea, an umbrella and a postcard
    ell(ctx, 74, 22, 13); fs(ctx, HONEY);
    ctx.beginPath(); ctx.moveTo(0, 70); for (let x = 0; x <= 100; x += 10) ctx.quadraticCurveTo(x + 5, 64, x + 10, 70); ctx.lineTo(100, 100); ctx.lineTo(0, 100); ctx.closePath(); fs(ctx, '#59c8ff');
    ctx.beginPath(); ctx.moveTo(0, 86); ctx.quadraticCurveTo(50, 78, 100, 88); ctx.lineTo(100, 100); ctx.lineTo(0, 100); ctx.closePath(); fs(ctx, '#f2deb2');
    line(ctx, 30, 30, 36, 90, LW * 1.4);
    ctx.beginPath(); ctx.moveTo(6, 40); ctx.quadraticCurveTo(26, 8, 54, 26); ctx.closePath(); fs(ctx, PINK);
    ctx.beginPath(); ctx.moveTo(30, 33); ctx.quadraticCurveTo(28, 18, 26, 14); ctx.lineWidth = LW; ctx.stroke();
    ctx.save(); ctx.translate(70, 60); ctx.rotate(-0.12);
    roundRect(ctx, -16, -11, 32, 22, 2); fs(ctx, PAPER); line(ctx, 0, -8, 0, 8, LW * 0.6); heart(ctx, 8, -3, 3.4); fs(ctx, PINK, LW * 0.6);
    line(ctx, -12, -4, -4, -4, LW * 0.6); line(ctx, -12, 1, -4, 1, LW * 0.6);
    ctx.restore();
  },
};

// an ending's scene into a box; `locked`: its silhouette (drawn on a scratch canvas, then filled flat)
let scratch = null;
export function drawScene(ctx, art, x, y, size, { locked = false, lockColor = '#3a2a6e' } = {}) {
  const fn = SCENES[art];
  if (!fn) return;
  const draw = (c) => { c.save(); c.translate(x, y); c.scale(size / 100, size / 100); LW = 1.9; fn(c); c.restore(); LW = 1.7; };
  if (!locked) { draw(ctx); return; }
  const px = Math.ceil(size * 2);
  if (!scratch) scratch = document.createElement('canvas');
  scratch.width = px; scratch.height = px;
  const sc = scratch.getContext('2d');
  sc.save(); sc.scale(2, 2); sc.translate(-x, -y); draw(sc); sc.restore();
  sc.globalCompositeOperation = 'source-in';
  sc.fillStyle = lockColor; sc.fillRect(0, 0, px, px);
  sc.globalCompositeOperation = 'source-over';
  ctx.drawImage(scratch, x, y, size, size);
}
export const SCENE_IDS = Object.keys(SCENES);
