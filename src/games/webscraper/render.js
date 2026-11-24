// WEB SCRAPER: the picture. A little city seen from above at a slant (its streets and blocks drawn once into a map, its
// things drawn every frame as small extruded stickers), the portals as glowing swirls in the ground, things tipping in
// and spinning down as they fall, names and sizes over the portals, arrows at the screen's edge pointing at rivals.
import { Particles, FloatText, Shake, roundRect, clamp, rgba, shade, TAU } from '../kit/fx.js';
import { REDUCED } from '../kit/env.js';
import { TYPES } from './rules.js';

const INK = '#170a36', PAPER = '#fffaf0';
const DISPLAY = "'AK Display', 'Arial Black', system-ui, sans-serif";
const PX = 14;   // the map's pixels per metre

export function createRenderer(canvas) {
  return { canvas, ctx: canvas.getContext('2d'), L: null, map: null, mapFor: null, cam: { x: 38, y: 38, view: 16 }, parts: new Particles(600), floats: new FloatText(), shake: new Shake({ max: 10 }), flash: 0 };
}
export function layout(R, { w, h, dpr, top }) { R.L = { w, h, dpr, top }; return R.L; }

// the streets and blocks, drawn once per city
function mapOf(R, city) {
  if (R.mapFor === city && R.map) return R.map;
  const c = document.createElement('canvas');
  c.width = c.height = city.size * PX;
  const g = c.getContext('2d');
  g.scale(PX, PX);
  g.fillStyle = '#3a3358'; g.fillRect(0, 0, city.size, city.size);
  // lane dashes
  g.strokeStyle = 'rgba(255, 250, 240, .35)'; g.lineWidth = 0.12; g.setLineDash([0.8, 0.8]);
  for (let k = 0; k <= city.size; k += city.block) {
    g.beginPath(); g.moveTo(0, k + city.road / 2); g.lineTo(city.size, k + city.road / 2); g.moveTo(k + city.road / 2, 0); g.lineTo(k + city.road / 2, city.size); g.stroke();
  }
  g.setLineDash([]);
  const fill = { park: '#4fbf7e', houses: '#cfe9b0', downtown: '#b9b2d6', plaza: '#e8d6b4' };
  for (const b of city.blocks) {
    g.fillStyle = '#d8d0ec'; roundRect(g, b.x - 0.35, b.y - 0.35, b.w + 0.7, b.h + 0.7, 0.8); g.fill();
    g.fillStyle = fill[b.kind] || '#cfe9b0'; roundRect(g, b.x, b.y, b.w, b.h, 0.6); g.fill();
    if (b.kind === 'park') { g.fillStyle = 'rgba(255,255,255,.18)'; for (let i = 0; i < 14; i++) g.fillRect(b.x + ((i * 3.7) % b.w), b.y + ((i * 5.3) % b.h), 0.12, 0.12); }
    if (b.kind === 'plaza') { g.strokeStyle = 'rgba(23,10,54,.12)'; g.lineWidth = 0.06; for (let x = b.x + 1; x < b.x + b.w; x += 1) { g.beginPath(); g.moveTo(x, b.y); g.lineTo(x, b.y + b.h); g.stroke(); } }
    if (b.kind === 'downtown') { g.fillStyle = 'rgba(23,10,54,.08)'; g.fillRect(b.x + 0.6, b.y + 0.6, b.w - 1.2, b.h - 1.2); }
  }
  // crossings
  g.fillStyle = 'rgba(255, 250, 240, .55)';
  for (let y = 0; y < city.size; y += city.block) for (let x = 0; x < city.size; x += city.block) for (let i = 0; i < 4; i++) g.fillRect(x + city.road + 0.2 + i * 0.5, y + 0.4, 0.25, city.road - 0.8);
  R.map = c; R.mapFor = city;
  return c;
}

// ---------- things ----------
function box(ctx, x, y, w, d, h, color, s, { windows = false, cab = false } = {}) {
  const hh = h * s * 0.42;
  const X = x - w / 2, Y = y - d / 2;
  ctx.fillStyle = 'rgba(23, 10, 54, .25)'; roundRect(ctx, X + 0.12 * s, Y + 0.18 * s, w, d, Math.min(w, d) * 0.15); ctx.fill();
  // its front face, then its roof (lifted toward the top of the screen)
  ctx.fillStyle = shade(color, -0.32);
  ctx.beginPath(); ctx.moveTo(X, Y + d); ctx.lineTo(X + w, Y + d); ctx.lineTo(X + w, Y + d - hh); ctx.lineTo(X, Y + d - hh); ctx.closePath(); ctx.fill();
  ctx.lineWidth = Math.max(1, s * 0.05); ctx.strokeStyle = INK; ctx.stroke();
  if (windows && hh > 6) {
    ctx.fillStyle = 'rgba(255, 250, 240, .55)';
    const rows = Math.max(1, Math.floor(hh / (s * 0.5))), cols = Math.max(1, Math.floor(w / (s * 0.6)));
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) ctx.fillRect(X + (c + 0.3) * (w / cols), Y + d - hh + (r + 0.3) * (hh / rows), (w / cols) * 0.4, (hh / rows) * 0.4);
  }
  ctx.fillStyle = color; roundRect(ctx, X, Y - hh, w, d, Math.min(w, d) * 0.12); ctx.fill(); ctx.stroke();
  if (cab) { ctx.fillStyle = 'rgba(23, 10, 54, .55)'; roundRect(ctx, X + w * 0.28, Y - hh + d * 0.18, w * 0.4, d * 0.64, Math.min(w, d) * 0.15); ctx.fill(); }
}
function thing(ctx, it, sx, sy, s, t) {
  const T = TYPES[it.type];
  const r = T.r * s;
  if (T.rect) {
    let [w, d] = T.rect;
    if (Math.abs(Math.sin(it.a)) > 0.7) [w, d] = [d, w];
    const big = it.type === 'house' || it.type === 'shop' || it.type === 'office' || it.type === 'tower' || it.type === 'servers';
    box(ctx, sx, sy, w * s, d * s, T.h, T.color, s, { windows: big, cab: it.type === 'car' || it.type === 'van' || it.type === 'bus' || it.type === 'truck' });
    if (it.type === 'billboard') { ctx.fillStyle = PAPER; ctx.font = `900 ${Math.max(6, s * 0.36)}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('AGI', sx, sy - T.h * s * 0.42); }
    return;
  }
  ctx.fillStyle = 'rgba(23, 10, 54, .25)'; ctx.beginPath(); ctx.ellipse(sx + r * 0.15, sy + r * 0.25, r, r * 0.6, 0, 0, TAU); ctx.fill();
  ctx.lineWidth = Math.max(1, s * 0.045); ctx.strokeStyle = INK;
  switch (it.type) {
    case 'tree': case 'bush': {
      if (it.type === 'tree') { ctx.fillStyle = '#7a4a2a'; ctx.fillRect(sx - r * 0.12, sy - r * 0.9, r * 0.24, r * 0.9); }
      const lift = it.type === 'tree' ? r * 0.9 : r * 0.2;
      ctx.fillStyle = T.color; ctx.beginPath(); ctx.arc(sx, sy - lift, r, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.arc(sx - r * 0.3, sy - lift - r * 0.3, r * 0.35, 0, TAU); ctx.fill();
      break;
    }
    case 'lamp': case 'sign':
      ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1, s * 0.07); ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, sy - T.h * s * 0.6); ctx.stroke();
      ctx.fillStyle = T.color; ctx.beginPath(); ctx.arc(sx, sy - T.h * s * 0.6, r * 0.9, 0, TAU); ctx.fill(); ctx.lineWidth = Math.max(1, s * 0.04); ctx.stroke();
      break;
    case 'cone':
      ctx.fillStyle = T.color; ctx.beginPath(); ctx.moveTo(sx, sy - r * 2); ctx.lineTo(sx + r, sy); ctx.lineTo(sx - r, sy); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = PAPER; ctx.fillRect(sx - r * 0.5, sy - r * 0.9, r, r * 0.3);
      break;
    case 'fountain':
      ctx.fillStyle = '#d8d0ec'; ctx.beginPath(); ctx.arc(sx, sy, r, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = T.color; ctx.beginPath(); ctx.arc(sx, sy, r * 0.75, 0, TAU); ctx.fill();
      ctx.strokeStyle = PAPER; ctx.lineWidth = Math.max(1, s * 0.05); ctx.beginPath(); ctx.arc(sx, sy, r * (0.3 + ((t * 0.6) % 0.4)), 0, TAU); ctx.stroke();
      break;
    case 'statue':
      box(ctx, sx, sy, r * 1.1, r * 1.1, 0.8, '#d8d0ec', s);
      ctx.fillStyle = T.color; ctx.strokeStyle = INK;
      ctx.beginPath(); ctx.ellipse(sx, sy - r * 1.3, r * 0.32, r * 0.6, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(sx, sy - r * 2.1, r * 0.28, 0, TAU); ctx.fill(); ctx.stroke();
      break;
    default:
      ctx.fillStyle = T.color; roundRect(ctx, sx - r * 0.8, sy - r * 1.4, r * 1.6, r * 1.5, r * 0.35); ctx.fill(); ctx.stroke();
  }
}

function portal(ctx, x, y, r, color, t, you) {
  const g = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
  g.addColorStop(0, '#000000'); g.addColorStop(0.75, '#120828'); g.addColorStop(1, '#2a1660');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  // a slow swirl inside
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
  ctx.strokeStyle = rgba(color === 'rainbow' ? '#ff4da6' : color, 0.35); ctx.lineWidth = Math.max(1.5, r * 0.06);
  for (let k = 0; k < 3; k++) { ctx.beginPath(); for (let a = 0; a < 5.5; a += 0.25) { const rr = r * (0.15 + a / 7); const aa = a + t * (you ? 2.4 : 2) + (k * TAU) / 3; ctx.lineTo(x + Math.cos(aa) * rr, y + Math.sin(aa) * rr); } ctx.stroke(); }
  ctx.restore();
  ctx.lineWidth = Math.max(2.5, r * 0.09);
  ctx.strokeStyle = color === 'rainbow' ? `hsl(${(t * 120) % 360} 95% 62%)` : color;
  if (!REDUCED) { ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = Math.min(24, r * 0.6); }
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.beginPath(); ctx.arc(x, y, r + ctx.lineWidth, 0, TAU); ctx.stroke();
}
function tag(ctx, x, y, text, fill, size) {
  ctx.font = `900 ${size}px ${DISPLAY}`;
  const w = ctx.measureText(text).width + size * 0.9, h = size * 1.5;
  ctx.fillStyle = INK; roundRect(ctx, x - w / 2, y - h / 2 + 2.5, w, h, h / 2); ctx.fill();
  ctx.fillStyle = fill; roundRect(ctx, x - w / 2, y - h / 2, w, h, h / 2); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y + 1);
}

export function draw(R, S, dt, { time = 0, rim = '#3ff0c3', attract = false } = {}) {
  const { ctx, L } = R;
  if (!L) return;
  const me = S.me;
  // the camera follows her portal and zooms out as it grows
  const playH0 = L.h - L.top;
  const view = clamp(15 + me.r * 5.5, 15, S.size * 0.7);
  R.cam.view += (view - R.cam.view) * (1 - Math.exp(-dt * 2.5));
  if (me.dead <= 0) { R.cam.x += (me.x - R.cam.x) * (1 - Math.exp(-dt * 6)); R.cam.y += (me.y - R.cam.y) * (1 - Math.exp(-dt * 6)); }
  const playH = L.h - L.top;
  const s = Math.min(L.w, playH) / R.cam.view;
  // (the camera stays over the city: no void past its edge, unless the city is smaller than the screen)
  const hw = L.w / 2 / s, hh = playH / 2 / s;
  R.cam.x = S.size > hw * 2 ? clamp(R.cam.x, hw, S.size - hw) : S.size / 2;
  R.cam.y = S.size > hh * 2 ? clamp(R.cam.y, hh, S.size - hh) : S.size / 2;
  const ox = L.w / 2 - R.cam.x * s, oy = L.top + playH / 2 - R.cam.y * s;
  const toS = (x, y) => ({ x: ox + x * s, y: oy + y * s });
  ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
  ctx.fillStyle = '#1b1040'; ctx.fillRect(0, 0, L.w, L.h);
  ctx.save();
  R.shake.apply(ctx, L.w / 2, L.h / 2);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(mapOf(R, S.city), ox, oy, S.size * s, S.size * s);
  ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeRect(ox, oy, S.size * s, S.size * s);
  // portals in the ground
  const live = S.holes.filter((h) => h.dead <= 0);
  for (const h of live) { const p = toS(h.x, h.y); portal(ctx, p.x, p.y, h.r * s, h.you ? rim : h.color, time, h.you); }
  // things falling in, inside their portal
  for (const f of S.falling) {
    const k = clamp(f.t / 0.5, 0, 1), h = f.h;
    const p = toS(f.x + (h.x - f.x) * k * 0.8, f.y + (h.y - f.y) * k * 0.8);
    const hp = toS(h.x, h.y);
    ctx.save(); ctx.beginPath(); ctx.arc(hp.x, hp.y, h.r * s, 0, TAU); ctx.clip();
    ctx.translate(p.x, p.y + k * h.r * s * 0.3); ctx.rotate(k * 2.5); ctx.scale(1 - k * 0.85, 1 - k * 0.85);
    ctx.globalAlpha = 1 - k * 0.6;
    thing(ctx, f.it, 0, 0, s, time);
    ctx.restore();
  }
  // the city's things on screen, back to front
  const half = R.cam.view * 0.5 * Math.max(L.w, playH) / Math.min(L.w, playH) + 4;
  const vis = [];
  for (const it of S.items) if (!it.gone && Math.abs(it.x - R.cam.x) < half && Math.abs(it.y - R.cam.y) < half) vis.push(it);
  vis.sort((a, b) => a.y - b.y);
  for (const it of vis) { const p = toS(it.x, it.y); thing(ctx, it, p.x, p.y, s, time); }
  // names and sizes
  for (const h of live) {
    const p = toS(h.x, h.y);
    tag(ctx, p.x, p.y - h.r * s - 14, h.you ? 'YOU' : h.name, h.you ? (rim === 'rainbow' ? '#ff4da6' : rim) : h.color, clamp(h.r * s * 0.2, 11, 18));
  }
  R.parts.draw(ctx);
  R.floats.draw(ctx);
  ctx.restore();
  // rivals off the screen: arrows at the edge
  if (!attract) for (const h of live) {
    if (h.you) continue;
    const p = toS(h.x, h.y);
    if (p.x > 0 && p.x < L.w && p.y > L.top && p.y < L.h) continue;
    const cx = L.w / 2, cy = L.top + playH / 2, a = Math.atan2(p.y - cy, p.x - cx);
    const ex = clamp(cx + Math.cos(a) * L.w, 22, L.w - 22), ey = clamp(cy + Math.sin(a) * playH, L.top + 22, L.h - 22);
    ctx.save(); ctx.translate(ex, ey); ctx.rotate(a);
    ctx.fillStyle = h.color; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-8, -9); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = PAPER; ctx.font = `800 10px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(h.r >= me.r * 1.14 ? '!' : '', ex, ey + 18);
  }
  // swallowed: the screen dims until she's back
  if (me.dead > 0 && !attract) {
    ctx.fillStyle = 'rgba(15, 8, 38, .55)'; ctx.fillRect(0, 0, L.w, L.h);
    tag(ctx, L.w / 2, L.top + playH / 2, `BACK IN ${Math.ceil(me.dead)}`, '#ff4da6', 20);
  }
  if (attract) { ctx.fillStyle = 'rgba(15, 8, 38, .4)'; ctx.fillRect(0, 0, L.w, L.h); }
  if (R.flash > 0 && !REDUCED) { ctx.globalAlpha = Math.min(0.4, R.flash); ctx.fillStyle = '#ff4da6'; ctx.fillRect(0, 0, L.w, L.h); ctx.globalAlpha = 1; }
  R.toS = toS; R.scale = s;
}

// ---------- effects ----------
const FONT = `900 1em ${DISPLAY}`;
export const fx = {
  eat(R, e) {
    if (!R.toS) return;
    const p = R.toS(e.x, e.y);
    R.parts.burst({ x: p.x, y: p.y, count: e.r > 1 ? 18 : 5, speed: [40, e.r > 1 ? 260 : 120], life: [0.25, 0.6], size: [2, e.r > 1 ? 8 : 4], colors: [TYPES[e.thing].color, PAPER], drag: 3, shape: 'square', spin: 6 });
    if (e.value >= 20) R.floats.add({ x: p.x, y: p.y - 10, text: `+${e.value}`, color: '#3ff0c3', size: Math.min(30, 14 + e.value / 12), life: 0.9, rise: 40, font: FONT });
    if (e.r >= 1.6) R.shake.kick(0.18);
  },
  swallow(R, e) {
    if (!R.toS) return;
    const p = R.toS(e.x, e.y);
    R.parts.burst({ x: p.x, y: p.y, count: 40, speed: [120, 420], life: [0.5, 1.1], size: [4, 10], colors: ['#ff4da6', '#ffc933', '#3ff0c3', PAPER], shape: 'star', spin: 8, drag: 2 });
    R.floats.add({ x: p.x, y: p.y - 20, text: e.you ? `SCRAPED ${e.victim}!` : `${e.who} ATE ${e.victimYou ? 'YOU' : e.victim}`, color: e.you ? '#3ff0c3' : '#ff5a5f', size: 26, life: 1.4, rise: 50, font: FONT });
    R.shake.kick(e.you || e.victimYou ? 0.5 : 0.15);
    if (e.victimYou) R.flash = 0.4;
  },
  update(R, dt) { R.parts.update(dt); R.floats.update(dt); R.shake.update(dt); R.flash = Math.max(0, R.flash - dt * 2); },
  reset(R) { R.parts.clear(); R.floats.clear(); R.flash = 0; },
};
