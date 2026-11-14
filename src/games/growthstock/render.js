// GROWTH STOCK: the picture. The farm (sky over Gradient Hills, the grass, the fence, the 5 × 5 field, every stock, the
// weather, day and night, the bear and the bull) on the canvas under the page; the bits that fly (shares into the
// market, gold into the bar, the sparks and the words) on a second canvas over it. The background is drawn once per
// size and hour and kept.
import { Particles, FloatText, Shake, ease, clamp } from '../kit/fx.js';
import { REDUCED } from '../kit/env.js';
import { cropSprite, produceSprite, drawPlot, drawDrop, drawBear, drawBull, drawTuft, INK, rgba, mix } from './art.js';
import { COLS, ROWS, plotXY, ripe, thirsty, growing, TUNE } from './sim.js';
import { clockOf } from './seasons.js';

const TAU = Math.PI * 2;

export function createRenderer(canvas, top) {
  return {
    canvas, c: canvas.getContext('2d'), top, t: top.getContext('2d'), L: null, time: 0,
    parts: new Particles(500), floats: new FloatText(), flies: [], shake: new Shake({ max: 10 }), flash: new Map(),
    bg: null, bgKey: '', bull: null, rain: [], snow: [], bugs: [], words: [], topDirty: true,
  };
}

// world (plot units) → screen
export const sx = (L, x) => L.gx + x * L.cell;
export const sy = (L, y) => L.gy + y * L.cell;
export function plotAt(L, px, py) {
  const x = (px - L.gx) / L.cell, y = (py - L.gy) / L.cell;
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return null;
  return Math.floor(y) * COLS + Math.floor(x);
}

// ---------- the sky by the hour ----------
const SKY = [[0, '#141a46', '#2a2f6a'], [5, '#1c2458', '#3a3f7e'], [6.5, '#ff9b7a', '#ffd3a0'], [8, '#7ec9ff', '#bfe6ff'], [17, '#7ec9ff', '#c7ecff'], [19, '#ff8a6a', '#ffc58a'], [20.5, '#2c2a6a', '#5a4a8e'], [24, '#141a46', '#2a2f6a']];
function skyAt(hod) {
  for (let i = 0; i < SKY.length - 1; i++) {
    const [h0, a0, b0] = SKY[i], [h1, a1, b1] = SKY[i + 1];
    if (hod >= h0 && hod <= h1) { const k = (hod - h0) / (h1 - h0); return [mix(a0, a1, k), mix(b0, b1, k)]; }
  }
  return [SKY[0][1], SKY[0][2]];
}
// how dark it is (0 day … 1 night)
export function darkness(hod) {
  if (hod >= 7 && hod <= 18) return 0;
  if (hod < 5) return 1;
  if (hod < 7) return 1 - (hod - 5) / 2;
  if (hod < 21) return (hod - 18) / 3;
  return 1;
}

function background(R, S) {
  const L = R.L, c0 = clockOf(S.h), key = `${L.w}x${L.h}:${L.dpr}:${Math.floor(c0.hod * 2)}:${S.weather}`;
  if (R.bg && R.bgKey === key) return R.bg;
  const cv = R.bg || document.createElement('canvas');
  cv.width = Math.round(L.w * L.dpr); cv.height = Math.round(L.h * L.dpr);
  const c = cv.getContext('2d'); c.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
  const [top, low] = skyAt(c0.hod);
  const horizon = Math.max(L.gy - L.cell * 0.9, L.h * 0.08);
  const g = c.createLinearGradient(0, 0, 0, horizon);
  g.addColorStop(0, top); g.addColorStop(1, low);
  c.fillStyle = g; c.fillRect(0, 0, L.w, horizon + 2);
  const cloudy = S.weather === 'cloud' || S.weather === 'rain' || S.weather === 'frost';
  if (cloudy) { c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(0, 0, L.w, horizon); }
  // Gradient Hills: three rolling layers, each a little darker, under the sky
  const hills = ['#8fd88a', '#6cc86c', '#58bb5c'];
  hills.forEach((col, k) => {
    c.beginPath(); c.moveTo(0, L.h);
    const base = horizon - L.cell * (0.55 - k * 0.22), amp = L.cell * (0.35 - k * 0.07), wl = L.w / (1.3 + k * 0.6);
    for (let x = 0; x <= L.w + 10; x += 10) c.lineTo(x, base + Math.sin(x / wl * TAU + k * 2.1) * amp + Math.sin(x / wl * 0.37 * TAU + k) * amp * 0.6);
    c.lineTo(L.w, L.h); c.closePath(); c.fillStyle = col; c.fill();
  });
  // the meadow
  const gg = c.createLinearGradient(0, horizon, 0, L.h);
  gg.addColorStop(0, '#5cbf5c'); gg.addColorStop(1, '#4aa952');
  c.fillStyle = gg; c.fillRect(0, horizon + L.cell * 0.18, L.w, L.h);
  c.fillStyle = 'rgba(255,255,255,0.05)';
  for (let y = horizon + L.cell * 0.4; y < L.h; y += L.cell * 0.9) c.fillRect(0, y, L.w, L.cell * 0.45);
  // tufts and flowers off the field (the same each time: from a fixed little sequence)
  let a = 7;
  const rnd = () => ((a = (a * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 70; k++) {
    const x = rnd() * L.w, y = horizon + L.cell * 0.5 + rnd() * (L.h - horizon);
    if (x > L.gx - L.cell * 0.3 && x < L.gx + L.cell * (COLS + 0.3) && y > L.gy - L.cell * 0.3 && y < L.gy + L.cell * (ROWS + 0.3)) continue;
    drawTuft(c, x, y, L.cell * 0.05, rnd() < 0.55 ? 0 : 1 + Math.floor(rnd() * 4));
  }
  // the fence round the field
  const fx0 = L.gx - L.cell * 0.18, fy0 = L.gy - L.cell * 0.18, fw = L.cell * (COLS + 0.36), fh = L.cell * (ROWS + 0.36);
  c.fillStyle = 'rgba(0,0,0,0.08)'; c.beginPath(); c.roundRect(fx0 + 4, fy0 + 6, fw, fh, L.cell * 0.2); c.fill();
  c.fillStyle = '#7a5532'; c.beginPath(); c.roundRect(fx0, fy0, fw, fh, L.cell * 0.2); c.fill();
  c.fillStyle = '#5a3a20'; c.beginPath(); c.roundRect(fx0 + L.cell * 0.08, fy0 + L.cell * 0.08, fw - L.cell * 0.16, fh - L.cell * 0.16, L.cell * 0.14); c.fill();
  c.lineWidth = Math.max(1.5, L.cell * 0.035); c.strokeStyle = INK; c.beginPath(); c.roundRect(fx0, fy0, fw, fh, L.cell * 0.2); c.stroke();
  const post = (x, y) => { c.beginPath(); c.roundRect(x - L.cell * 0.06, y - L.cell * 0.06, L.cell * 0.12, L.cell * 0.12, L.cell * 0.03); c.fillStyle = '#a8784a'; c.fill(); c.lineWidth = Math.max(1, L.cell * 0.025); c.strokeStyle = INK; c.stroke(); };
  for (let k = 0; k <= COLS; k++) { post(fx0 + fw * k / COLS, fy0); post(fx0 + fw * k / COLS, fy0 + fh); }
  for (let k = 1; k < ROWS; k++) { post(fx0, fy0 + fh * k / ROWS); post(fx0 + fw, fy0 + fh * k / ROWS); }
  R.bg = cv; R.bgKey = key;
  return cv;
}

// ---------- the frame ----------
// `o`: { hover (plot index), cursor ({x, y} in plots, the demo's finger), keySel (plot index), hint (plot index),
//        sel (the chosen seed), confirm ({ i, cost }), dim (0…1, behind the title) }
export function draw(R, S, o = {}) {
  const { c, L } = R;
  if (!L) return;
  c.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
  c.drawImage(background(R, S), 0, 0, L.w, L.h);
  const cl = clockOf(S.h), dark = darkness(cl.hod), t = R.time;
  c.save();
  R.shake.apply(c, L.w / 2, L.h / 2);
  // plots, row by row (a plant may stand over the plot above it)
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const i = row * COLS + col, p = S.plots[i], x = sx(L, col), y = sy(L, row);
      const fl = R.flash.get(i);
      const sign = !p.open && (o.confirm?.i === i || o.signs?.has(i));
      drawPlot(c, x, y, L.cell, {
        open: p.open, w: p.w, cost: sign ? o.plotCost : null,
        hover: o.hover === i || o.keySel === i || o.confirm?.i === i, flash: fl ? { color: fl.color, a: fl.t / fl.max * 0.5 } : null, comp: p.comp && growing(p), night: dark,
      });
      if (!p.open && !sign && o.plotCost != null) { c.globalAlpha = 0.35; drawLock(c, x + L.cell / 2, y + L.cell / 2, L.cell * 0.12); c.globalAlpha = 1; }
    }
    for (let col = 0; col < COLS; col++) {
      const i = row * COLS + col, p = S.plots[i];
      if (!p.open || !p.crop) continue;
      const stage = p.rot ? 4 : p.g >= 1 ? 3 : p.g < 0.15 ? 0 : p.g < 0.45 ? 1 : 2;
      const sp = cropSprite(p.crop, stage, L.cell, L.dpr);
      const x = sx(L, col + 0.5), y = sy(L, row + 0.62);
      const w = sp.canvas.width / L.dpr, h = sp.canvas.height / L.dpr;
      c.save(); c.translate(x, y);
      if (!REDUCED) {
        const sway = stage >= 1 && stage <= 3 ? Math.sin(t * 1.7 + i * 1.3) * 0.035 : 0;
        const bob = stage === 3 ? 1 + Math.max(0, Math.sin(t * 4 + i)) * 0.045 : 1;
        c.transform(bob, 0, sway, bob, 0, 0);
      }
      const grow = R.flash.get(`g${i}`);
      if (grow) { const k = ease.outBack(1 - grow.t / grow.max); c.scale(k, k); }
      c.drawImage(sp.canvas, -w * sp.ax, -h * sp.ay, w, h);
      c.restore();
      // a thirsty plant asks for water; a growing one shows how far along it is
      if (thirsty(p)) drawDrop(c, sx(L, col + 0.78), sy(L, row + 0.2) + Math.sin(t * 5 + i) * L.cell * 0.03, L.cell * 0.075, 0.95);
      if (growing(p) && p.g > 0.02) bar(c, sx(L, col + 0.18), sy(L, row + 0.86), L.cell * 0.64, L.cell * 0.065, p.g, p.w > 0 ? '#ffd84a' : '#d9b48f');
      if (ripe(p)) ripeGlow(c, sx(L, col + 0.5), sy(L, row + 0.5), L.cell, t + i, p.ripeH / TUNE.rotH);
      if (p.rot) wilted(c, sx(L, col + 0.66), sy(L, row + 0.12), L.cell, t + i);
    }
  }
  // the first-time ring round where to start
  if (o.hint != null) {
    const q = plotXY(o.hint), r = L.cell * (0.62 + Math.sin(t * 5) * 0.05);
    c.save(); c.setLineDash([L.cell * 0.12, L.cell * 0.09]); c.lineDashOffset = -t * L.cell * 0.4;
    c.lineWidth = Math.max(2, L.cell * 0.05); c.strokeStyle = '#ffffff'; c.beginPath(); c.arc(sx(L, q.x), sy(L, q.y), r, 0, TAU); c.stroke(); c.restore();
  }
  // the bear
  if (S.bear) {
    const b = S.bear;
    drawBear(c, sx(L, b.x), sy(L, b.y), L.cell * 0.95, { t: b.walk * 1.4 + (b.state === 'eat' ? t : 0), face: b.face, eat: b.state === 'eat' && b.hop <= 0, scared: b.hop > 0, hop: b.hop, flee: b.state === 'flee' });
    if (b.state !== 'flee') {
      for (let k = 0; k < 3; k++) {
        const x = sx(L, b.x) - L.cell * 0.18 + k * L.cell * 0.18, y = sy(L, b.y) - L.cell * 0.72;
        c.beginPath(); c.arc(x, y, L.cell * 0.06, 0, TAU); c.fillStyle = k < b.scared ? '#ff4da6' : 'rgba(255,255,255,0.85)'; c.fill(); c.lineWidth = Math.max(1, L.cell * 0.02); c.strokeStyle = INK; c.stroke();
      }
    }
  }
  c.restore();
  // the weather and the dark
  weather(R, S, dark);
  // the bull runs across the whole farm
  if (R.bull) {
    const k = R.bull.t / R.bull.dur, x = -L.cell * 1.5 + k * (L.w + L.cell * 3), y = sy(L, R.bull.row);
    drawBull(c, x, y, L.cell * 1.3, t);
    if (!REDUCED && Math.random() < 0.6) R.parts.burst({ x: x - L.cell * 0.5, y: y + L.cell * 0.3, count: 2, speed: [20, 80], angle: [Math.PI * 0.8, Math.PI * 1.2], life: [0.4, 0.8], size: [6, 14], colors: ['rgba(200,170,120,0.6)', 'rgba(220,200,160,0.5)'], drag: 2, grow: 10 });
  }
  // the demo's finger
  if (o.cursor) finger(c, sx(L, o.cursor.x), sy(L, o.cursor.y), L.cell, o.cursor.tap);
  if (o.dim) { c.fillStyle = `rgba(18,10,42,${o.dim})`; c.fillRect(0, 0, L.w, L.h); }
}

function drawLock(c, x, y, r) {
  c.save(); c.translate(x, y); c.lineWidth = Math.max(1, r * 0.25); c.strokeStyle = INK;
  c.beginPath(); c.arc(0, -r * 0.35, r * 0.55, Math.PI, 0); c.stroke();
  c.beginPath(); c.roundRect(-r * 0.8, -r * 0.35, r * 1.6, r * 1.2, r * 0.2); c.fillStyle = '#ffe7b8'; c.fill(); c.stroke();
  c.restore();
}
function bar(c, x, y, w, h, k, col) {
  c.beginPath(); c.roundRect(x, y, w, h, h / 2); c.fillStyle = 'rgba(23,10,54,0.45)'; c.fill();
  c.beginPath(); c.roundRect(x, y, Math.max(h, w * k), h, h / 2); c.fillStyle = col; c.fill();
}
function ripeGlow(c, x, y, s, t, rotK) {
  // ready: a soft halo and a twinkle; it turns amber as it gets close to wilting
  const col = rotK > 0.65 ? '#ffb02e' : '#fff6b0';
  c.save(); c.globalCompositeOperation = 'lighter';
  const g = c.createRadialGradient(x, y, 0, x, y, s * 0.55);
  g.addColorStop(0, rgba(col, 0.28 + Math.sin(t * 4) * 0.08)); g.addColorStop(1, rgba(col, 0));
  c.fillStyle = g; c.fillRect(x - s * 0.6, y - s * 0.6, s * 1.2, s * 1.2);
  c.restore();
  const k = (t * 0.9) % 1;
  if (k < 0.3 && !REDUCED) {
    const a = 1 - k / 0.3, r = s * 0.07 * (0.5 + k * 2);
    c.save(); c.translate(x + s * 0.28, y - s * 0.3); c.rotate(k * 3); c.fillStyle = `rgba(255,255,255,${a})`;
    c.beginPath(); for (let q = 0; q < 8; q++) { const rr = q % 2 ? r * 0.3 : r, an = q / 8 * TAU; c[q ? 'lineTo' : 'moveTo'](Math.cos(an) * rr, Math.sin(an) * rr); } c.closePath(); c.fill(); c.restore();
  }
}
// a wilted stock: a little red arrow bobbing down over it (tap it to clear the plot)
function wilted(c, x, y, s, t) {
  const r = s * 0.075, b = REDUCED ? 0 : Math.abs(Math.sin(t * 3)) * s * 0.04;
  c.save(); c.translate(x, y + b);
  c.beginPath(); c.moveTo(-r * 0.45, -r); c.lineTo(r * 0.45, -r); c.lineTo(r * 0.45, 0); c.lineTo(r, 0); c.lineTo(0, r * 1.1); c.lineTo(-r, 0); c.lineTo(-r * 0.45, 0); c.closePath();
  c.fillStyle = '#ff4d8d'; c.fill(); c.lineJoin = 'round'; c.lineWidth = Math.max(1, s * 0.022); c.strokeStyle = INK; c.stroke();
  c.restore();
}
function finger(c, x, y, s, tap) {
  c.save(); c.translate(x + s * 0.1, y + s * 0.1);
  if (tap) { c.beginPath(); c.arc(-s * 0.1, -s * 0.1, s * 0.3, 0, TAU); c.lineWidth = Math.max(2, s * 0.04); c.strokeStyle = 'rgba(255,255,255,0.8)'; c.stroke(); }
  c.rotate(-0.4);
  c.beginPath(); c.roundRect(-s * 0.09, -s * 0.22, s * 0.18, s * 0.42, s * 0.09); c.fillStyle = '#ffe2c4'; c.fill(); c.lineWidth = Math.max(1.5, s * 0.03); c.strokeStyle = INK; c.stroke();
  c.beginPath(); c.roundRect(-s * 0.16, s * 0.04, s * 0.32, s * 0.3, s * 0.1); c.fill(); c.stroke();
  c.restore();
}

function weather(R, S, dark) {
  const { c, L } = R, w = S.weather, dt = R.dt || 0.016;
  if (w === 'heat') { c.fillStyle = 'rgba(255,140,40,0.1)'; c.fillRect(0, 0, L.w, L.h); }
  if (w === 'frost') { c.fillStyle = 'rgba(170,210,255,0.16)'; c.fillRect(0, 0, L.w, L.h); }
  if (w === 'cloud' || w === 'rain') {
    c.fillStyle = 'rgba(40,40,80,0.06)';
    for (let k = 0; k < 3; k++) { const x = ((R.time * 18 + k * 400) % (L.w + 400)) - 200; c.beginPath(); c.ellipse(x, L.gy + L.cell * (1 + k * 1.4), L.cell * 2.2, L.cell * 0.9, 0, 0, TAU); c.fill(); }
  }
  if (w === 'rain' && !REDUCED) {
    while (R.rain.length < 90) R.rain.push({ x: Math.random() * L.w, y: Math.random() * L.h, v: 600 + Math.random() * 300 });
    c.strokeStyle = 'rgba(200,225,255,0.55)'; c.lineWidth = 1.2; c.beginPath();
    for (const d of R.rain) { d.y += d.v * dt; d.x -= d.v * 0.25 * dt; if (d.y > L.h) { d.y = -20; d.x = Math.random() * (L.w + 100); } c.moveTo(d.x, d.y); c.lineTo(d.x + 4, d.y - 14); }
    c.stroke();
  } else R.rain.length = 0;
  if (w === 'frost' && !REDUCED) {
    while (R.snow.length < 50) R.snow.push({ x: Math.random() * L.w, y: Math.random() * L.h, v: 30 + Math.random() * 40, p: Math.random() * 6 });
    c.fillStyle = 'rgba(255,255,255,0.85)';
    for (const f of R.snow) { f.y += f.v * dt; f.x += Math.sin(R.time + f.p) * 12 * dt; if (f.y > L.h) { f.y = -5; f.x = Math.random() * L.w; } c.beginPath(); c.arc(f.x, f.y, 1.6 + (f.p % 1.5), 0, TAU); c.fill(); }
  } else R.snow.length = 0;
  if (dark > 0) {
    c.fillStyle = `rgba(16,18,64,${0.42 * dark})`; c.fillRect(0, 0, L.w, L.h);
    if (!REDUCED) {
      while (R.bugs.length < 14) R.bugs.push({ x: Math.random(), y: Math.random(), p: Math.random() * 10 });
      c.save(); c.globalCompositeOperation = 'lighter';
      for (const b of R.bugs) {
        const x = (b.x + Math.sin(R.time * 0.3 + b.p) * 0.03) * L.w, y = (b.y + Math.cos(R.time * 0.4 + b.p) * 0.03) * L.h;
        const a = (0.5 + 0.5 * Math.sin(R.time * 2 + b.p)) * dark;
        const g = c.createRadialGradient(x, y, 0, x, y, 9); g.addColorStop(0, `rgba(255,240,140,${a})`); g.addColorStop(1, 'rgba(255,240,140,0)');
        c.fillStyle = g; c.fillRect(x - 9, y - 9, 18, 18);
      }
      c.restore();
    }
  }
}

// ---------- what flies over the page (the top canvas) ----------
export function drawTop(R) {
  const { t: c, L } = R;
  if (!L) return;
  const busy = R.parts.count || R.floats.items.length || R.flies.length;
  if (!busy && !R.topDirty) return;
  c.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
  c.clearRect(0, 0, L.w, L.h);
  R.topDirty = Boolean(busy);
  R.parts.draw(c);
  for (const f of R.flies) {
    if (f.delay > 0) continue;
    const k = ease.inOutCubic(clamp(f.t / f.dur, 0, 1));
    const x = f.x0 + (f.x1 - f.x0) * k, y = f.y0 + (f.y1 - f.y0) * k - Math.sin(k * Math.PI) * f.arc;
    const r = f.r * (1 - k * 0.45);
    if (f.coin) { coin(c, x, y, r); continue; }
    const sp = produceSprite(f.id, r, L.dpr);
    const s = sp.canvas.width / L.dpr;
    c.drawImage(sp.canvas, x - s / 2, y - s / 2, s, s);
  }
  R.floats.draw(c);
}
function coin(c, x, y, r) {
  c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = '#ffc933'; c.fill(); c.lineWidth = Math.max(1.2, r * 0.22); c.strokeStyle = INK; c.stroke();
  c.beginPath(); c.arc(x, y, r * 0.55, 0, TAU); c.lineWidth = Math.max(1, r * 0.14); c.strokeStyle = '#e09a12'; c.stroke();
}

export function update(R, dt) {
  R.time += dt; R.dt = dt;
  R.parts.update(dt); R.floats.update(dt); R.shake.update(dt);
  for (const [k, f] of R.flash) { f.t -= dt; if (f.t <= 0) R.flash.delete(k); }
  for (let i = R.flies.length - 1; i >= 0; i--) {
    const f = R.flies[i];
    if (f.delay > 0) { f.delay -= dt; continue; }
    f.t += dt;
    if (f.t >= f.dur) { R.flies.splice(i, 1); f.done?.(); }
  }
  if (R.bull) { R.bull.t += dt; if (R.bull.t >= R.bull.dur) R.bull = null; }
}

// ---------- effects the page asks for ----------
export const fx = {
  flash(R, i, color, dur = 0.35) { R.flash.set(i, { color, t: dur, max: dur }); },
  pop(R, i) { R.flash.set(`g${i}`, { t: 0.28, max: 0.28 }); },
  // shares from a plot into its chip on the market
  harvest(R, i, id, n, to, bump) {
    const L = R.L, q = plotXY(i), x = sx(L, q.x), y = sy(L, q.y - 0.1);
    R.parts.burst({ x, y, count: bump ? 22 : 12, speed: [80, 260], angle: [-Math.PI * 0.95, -Math.PI * 0.05], life: [0.35, 0.7], size: [3, 7], colors: bump ? ['#fff6b0', '#ffd84a', '#ffffff'] : ['#ffffff', '#b8f0a8'], gravity: 500, drag: 1.4, shape: bump ? 'star' : 'circle' });
    for (let k = 0; k < Math.min(n, 4); k++) {
      R.flies.push({ id, x0: x + (k - 1.5) * L.cell * 0.12, y0: y, x1: to ? to.x : x, y1: to ? to.y : y - 80, r: L.cell * 0.17, t: 0, dur: 0.55 + k * 0.06, delay: k * 0.07, arc: L.cell * 0.9 });
    }
    R.floats.add({ x, y: y - L.cell * 0.25, text: bump ? `+${n} BUMPER` : `+${n}`, color: bump ? '#ffd84a' : '#ffffff', size: Math.max(14, L.cell * (bump ? 0.24 : 0.28)), life: 0.9, rise: L.cell * 0.6 });
    R.topDirty = true;
  },
  plant(R, i) {
    const L = R.L, q = plotXY(i);
    R.parts.burst({ x: sx(L, q.x), y: sy(L, q.y + 0.1), count: 7, speed: [30, 110], angle: [-Math.PI, 0], life: [0.25, 0.45], size: [3, 6], colors: ['#8a5a32', '#6b4428', '#a8784a'], gravity: 400 });
    fx.pop(R, i); R.topDirty = true;
  },
  water(R, i) {
    const L = R.L, q = plotXY(i);
    R.parts.burst({ x: sx(L, q.x), y: sy(L, q.y - 0.2), count: 10, speed: [40, 150], angle: [Math.PI * 0.15, Math.PI * 0.85], life: [0.3, 0.55], size: [3, 6], colors: ['#59c8ff', '#9fdcff', '#ffffff'], gravity: 600 });
    fx.flash(R, i, '#59c8ff', 0.3); R.topDirty = true;
  },
  bad(R, i) { fx.flash(R, i, '#ff4d6a', 0.4); if (!REDUCED) R.shake.kick(0.08); },
  // gold from the sell button (or a plot) into the gold in the bar
  coins(R, from, to, n) {
    if (!from || !to) return;
    for (let k = 0; k < Math.min(n, 6); k++) R.flies.push({ coin: true, x0: from.x + (Math.random() - 0.5) * 24, y0: from.y, x1: to.x, y1: to.y, r: 7, t: 0, dur: 0.5 + k * 0.04, delay: k * 0.05, arc: 60 });
    R.topDirty = true;
  },
  word(R, x, y, text, color = '#ffffff', size = 22, life = 1.1) { R.floats.add({ x, y, text, color, size, life, rise: 46 }); R.topDirty = true; },
  plotWord(R, i, text, color, size) { const L = R.L, q = plotXY(i); fx.word(R, sx(L, q.x), sy(L, q.y - 0.3), text, color, size || Math.max(13, L.cell * 0.22)); },
  eaten(R, i) {
    const L = R.L, q = plotXY(i);
    R.parts.burst({ x: sx(L, q.x), y: sy(L, q.y), count: 16, speed: [60, 200], life: [0.3, 0.6], size: [3, 7], colors: ['#4fd16a', '#8a5a32', '#ffffff'], gravity: 500, shape: 'square', spin: 8 });
    fx.flash(R, i, '#ff4d6a', 0.5); if (!REDUCED) R.shake.kick(0.12); R.topDirty = true;
  },
  shoo(R, S) {
    const b = S.bear; if (!b) return;
    const L = R.L, x = sx(L, b.x), y = sy(L, b.y - 0.5);
    R.parts.burst({ x, y, count: 10, speed: [80, 220], life: [0.25, 0.5], size: [4, 8], colors: ['#ffffff', '#ff4da6', '#ffd84a'], shape: 'star', spin: 6 });
    fx.word(R, x, y - 10, b.state === 'flee' ? 'SHOO!' : ['HEY!', 'GO!', 'SHOO!'][Math.min(2, b.scared - 1)] || 'HEY!', '#ffffff', Math.max(16, L.cell * 0.3));
  },
  bull(R, row) { R.bull = { t: 0, dur: 2.1, row }; },
  sparkle(R, at, colors = ['#ffd84a', '#ffffff', '#3ff0c3']) { if (!at) return; R.parts.burst({ x: at.x, y: at.y, count: 18, speed: [80, 260], life: [0.3, 0.7], size: [3, 7], colors, shape: 'star', spin: 6, gravity: 200 }); R.topDirty = true; },
};
