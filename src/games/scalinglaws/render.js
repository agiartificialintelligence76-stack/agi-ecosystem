// SCALING LAWS: the picture, a neon track in perspective drawn on one 2D canvas (no 3D library): a synthwave sky over
// a city of server towers, the road's stripes rushing past, gates of glass with their maths on them, saws, walls, holes,
// rival crowds, crystals, the benchmark staircase at the end, and her crowd of little parameters running in a sunflower.
import { Particles, FloatText, Shake, roundRect, clamp, lerp, rgba, TAU } from '../kit/fx.js';
import { REDUCED } from '../kit/env.js';
import { formation, unitAt, sawX, opText, isGood, MULTS, TUNE, params } from './rules.js';

const INK = '#170a36', PAPER = '#fffaf0', MINT = '#3ff0c3', PINK = '#ff4da6', HONEY = '#ffc933', RED = '#ff5a5f', SKY = '#59c8ff';
const DISPLAY = "'AK Display', 'Arial Black', system-ui, sans-serif";
const MAXU = 280;

export function createRenderer(canvas) {
  return {
    canvas, ctx: canvas.getContext('2d'), L: null, parts: new Particles(700), floats: new FloatText(), shake: new Shake({ max: 12 }),
    flash: 0, flashColor: PINK, ux: new Float32Array(MAXU), uz: new Float32Array(MAXU), uready: 0, towers: null, camZ: 0,
  };
}

export function layout(R, { w, h, dpr, top, bottom }) {
  const H = Math.max(200, h - top - bottom);
  const horizon = top + H * 0.2;
  const playerY = top + H * 0.8;
  const s0 = Math.min(w * 0.4, H * 0.55);
  const d0 = 3.4;
  R.L = { w, h, dpr, top, bottom, horizon, playerY, s0, d0, f: s0 * d0, camH: (playerY - horizon) / s0, cx: w / 2 };
  R.towers = null;
  return R.L;
}
// a point on the track (x across, z along, y up) on the screen; null behind the camera
export function project(R, x, z, y = 0) {
  const dz = z - R.camZ;
  if (dz < 0.25) return null;
  const s = R.L.f / dz;
  return { x: R.L.cx + x * s, y: R.L.horizon + (R.L.camH - y) * s, s };
}

function sky(R, time) {
  const { ctx, L } = R;
  const g = ctx.createLinearGradient(0, 0, 0, L.horizon);
  g.addColorStop(0, '#0d0626'); g.addColorStop(0.6, '#2a0f5a'); g.addColorStop(1, '#7a2a86');
  ctx.fillStyle = g; ctx.fillRect(0, 0, L.w, L.horizon + 1);
  // the sun, striped
  const sr = Math.min(L.w, L.h) * 0.16, sy = L.horizon - sr * 0.35;
  ctx.save();
  ctx.beginPath(); ctx.arc(L.cx, sy, sr, Math.PI, 0); ctx.lineTo(L.cx + sr, L.horizon); ctx.lineTo(L.cx - sr, L.horizon); ctx.closePath(); ctx.clip();
  const sg = ctx.createLinearGradient(0, sy - sr, 0, L.horizon);
  sg.addColorStop(0, HONEY); sg.addColorStop(1, PINK);
  ctx.fillStyle = sg; ctx.fillRect(L.cx - sr, sy - sr, sr * 2, sr * 2);
  ctx.fillStyle = '#2a0f5a';
  for (let i = 0; i < 6; i++) { const y = sy + i * sr * 0.16 - ((time * 6) % (sr * 0.16)); ctx.fillRect(L.cx - sr, y, sr * 2, 1.5 + i * 0.9); }
  ctx.restore();
  // her city's server towers on the horizon
  if (!R.towers) {
    const t = [];
    let x = -20, seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    while (x < L.w + 20) { const w = 14 + rnd() * 30, h = 10 + rnd() * L.horizon * 0.22; t.push({ x, w, h, lit: rnd() }); x += w + rnd() * 6; }
    R.towers = t;
  }
  for (const tw of R.towers) {
    ctx.fillStyle = '#1a0a3e'; ctx.fillRect(tw.x, L.horizon - tw.h, tw.w, tw.h);
    ctx.fillStyle = tw.lit > 0.5 ? rgba(MINT, 0.5) : rgba(PINK, 0.45);
    for (let y = L.horizon - tw.h + 4; y < L.horizon - 3; y += 6) if (((y + tw.x) | 0) % 3) ctx.fillRect(tw.x + 3, y, tw.w - 6, 1.5);
  }
}

function ground(R) {
  const { ctx, L } = R;
  ctx.fillStyle = '#12072a'; ctx.fillRect(0, L.horizon, L.w, L.h - L.horizon);
  // the grid beside the road: lines to the vanishing point, and across, moving
  ctx.strokeStyle = rgba(PINK, 0.22); ctx.lineWidth = 1;
  ctx.beginPath();
  for (let k = -14; k <= 14; k++) {
    if (Math.abs(k) < 2) continue;
    const a = project(R, k * 0.9, R.camZ + 0.6), b = project(R, k * 0.9, R.camZ + 90);
    if (a && b) { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
  }
  for (let z = Math.ceil(R.camZ / 2) * 2; z < R.camZ + 70; z += 2) {
    const p = project(R, 0, z);
    if (p) { ctx.moveTo(0, p.y); ctx.lineTo(L.w, p.y); }
  }
  ctx.stroke();
  // the road
  const n0 = project(R, -1, R.camZ + 0.6), n1 = project(R, 1, R.camZ + 0.6), f0 = project(R, -1, R.camZ + 120), f1 = project(R, 1, R.camZ + 120);
  ctx.fillStyle = '#21104a';
  ctx.beginPath(); ctx.moveTo(n0.x, n0.y); ctx.lineTo(f0.x, f0.y); ctx.lineTo(f1.x, f1.y); ctx.lineTo(n1.x, n1.y); ctx.closePath(); ctx.fill();
  // stripes rushing past
  ctx.fillStyle = '#2b1660';
  for (let z = Math.floor(R.camZ / 3) * 3; z < R.camZ + 60; z += 3) {
    const a0 = project(R, -1, z), a1 = project(R, 1, z), b0 = project(R, -1, z + 1.5), b1 = project(R, 1, z + 1.5);
    if (!a0 || !b0) continue;
    ctx.beginPath(); ctx.moveTo(a0.x, a0.y); ctx.lineTo(b0.x, b0.y); ctx.lineTo(b1.x, b1.y); ctx.lineTo(a1.x, a1.y); ctx.closePath(); ctx.fill();
  }
  // the middle line and the neon rails
  ctx.strokeStyle = rgba(PAPER, 0.35); ctx.lineWidth = 2;
  for (let z = Math.floor(R.camZ / 2) * 2; z < R.camZ + 50; z += 2) {
    const a = project(R, 0, z), b = project(R, 0, z + 0.9);
    if (a && b) { ctx.lineWidth = Math.max(1, a.s * 0.03); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
  }
  for (const side of [-1, 1]) {
    const a = project(R, side * 1.02, R.camZ + 0.6), b = project(R, side * 1.02, R.camZ + 120);
    ctx.strokeStyle = side < 0 ? PINK : SKY; ctx.lineWidth = 4;
    if (!REDUCED) { ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 10; }
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.shadowBlur = 0;
  }
}

function quad(ctx, a, b, c, d) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); }

function drawGates(R, it, time) {
  const { ctx } = R;
  for (let side = 0; side < 2; side++) {
    const x0 = side ? 0.03 : -0.97, x1 = side ? 0.97 : -0.03;
    const op = it.ops[side];
    const good = isGood(op);
    const chosen = it.done && it.side === side;
    const fade = it.done ? (chosen ? 0.25 : 0.55) : 1;
    const a = project(R, x0, it.z, 0), b = project(R, x1, it.z, 0), c = project(R, x1, it.z, 0.78), d = project(R, x0, it.z, 0.78);
    if (!a || !c) continue;
    ctx.globalAlpha = fade;
    ctx.fillStyle = rgba(good ? (op.t === 'x' ? SKY : MINT) : RED, 0.42);
    quad(ctx, a, b, c, d); ctx.fill();
    ctx.lineWidth = Math.max(1.5, a.s * 0.025); ctx.strokeStyle = good ? (op.t === 'x' ? SKY : MINT) : RED; ctx.stroke();
    // the posts
    ctx.fillStyle = INK;
    for (const p of [a, b]) ctx.fillRect(p.x - a.s * 0.02, p.y - a.s * 0.82, a.s * 0.04, a.s * 0.82);
    // its maths
    const size = Math.max(9, a.s * 0.34);
    ctx.font = `900 ${size}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tx = (a.x + b.x) / 2, ty = (a.y + d.y) / 2;
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2, size * 0.16); ctx.strokeStyle = INK; ctx.strokeText(opText(op), tx, ty);
    ctx.fillStyle = PAPER; ctx.fillText(opText(op), tx, ty);
    ctx.globalAlpha = 1;
  }
}
function drawSaw(R, it, time) {
  const { ctx } = R;
  const x = sawX(it, time);
  const rail0 = project(R, -0.98, it.z, 0.05), rail1 = project(R, 0.98, it.z, 0.05);
  const p = project(R, x, it.z, TUNE.saw);
  if (!p || !rail0) return;
  ctx.strokeStyle = rgba(PAPER, 0.4); ctx.lineWidth = Math.max(1, p.s * 0.02);
  ctx.beginPath(); ctx.moveTo(rail0.x, rail0.y); ctx.lineTo(rail1.x, rail1.y); ctx.stroke();
  const r = TUNE.saw * p.s, spin = time * 14;
  ctx.fillStyle = '#c9c4dd'; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.5, r * 0.1);
  ctx.beginPath();
  for (let i = 0; i < 24; i++) { const a = spin + (i / 24) * TAU, rr = i % 2 ? r : r * 0.8; ctx.lineTo(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = RED; ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.3, 0, TAU); ctx.fill(); ctx.stroke();
}
function drawWall(R, it) {
  const { ctx } = R;
  for (const [x0, x1] of [[-1, it.gap[0]], [it.gap[1], 1]]) {
    if (x1 - x0 < 0.01) continue;
    const a = project(R, x0, it.z, 0), b = project(R, x1, it.z, 0), c = project(R, x1, it.z, 0.42), d = project(R, x0, it.z, 0.42);
    if (!a) continue;
    ctx.globalAlpha = it.done ? 0.4 : 1;
    ctx.fillStyle = '#ff6b5e'; quad(ctx, a, b, c, d); ctx.fill();
    ctx.lineWidth = Math.max(1.5, a.s * 0.02); ctx.strokeStyle = INK; ctx.stroke();
    ctx.strokeStyle = rgba(INK, 0.6); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo((a.x + d.x) / 2, (a.y + d.y) / 2); ctx.lineTo((b.x + c.x) / 2, (b.y + c.y) / 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }
}
function drawPit(R, it, time) {
  const { ctx } = R;
  const a = project(R, Math.max(-1, it.x[0]), it.z), b = project(R, Math.min(1, it.x[1]), it.z), c = project(R, Math.min(1, it.x[1]), it.z1), d = project(R, Math.max(-1, it.x[0]), it.z1);
  if (!a || !d) return;
  ctx.fillStyle = '#05020f'; quad(ctx, a, b, c, d); ctx.fill();
  ctx.strokeStyle = Math.floor(time * 6) % 2 ? PINK : SKY; ctx.lineWidth = Math.max(1.5, a.s * 0.02); ctx.stroke();
  const m = project(R, (it.x[0] + it.x[1]) / 2, (it.z + it.z1) / 2);
  if (m) { ctx.fillStyle = rgba(PINK, 0.8); ctx.font = `900 ${Math.max(8, m.s * 0.16)}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('404', m.x, m.y); }
}
function drawGem(R, it, time) {
  if (it.done) return;
  const { ctx } = R;
  const p = project(R, it.x, it.z, 0.16 + Math.sin(time * 4 + it.id) * 0.04);
  if (!p) return;
  const r = 0.075 * p.s;
  ctx.fillStyle = HONEY; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1, r * 0.2);
  ctx.beginPath(); ctx.moveTo(p.x, p.y - r * 1.3); ctx.lineTo(p.x + r, p.y); ctx.lineTo(p.x, p.y + r * 1.3); ctx.lineTo(p.x - r, p.y); ctx.closePath(); ctx.fill(); ctx.stroke();
}
// a little parameter: a round body, a head, a dot of light
function unit(ctx, x, y, r, color, bob) {
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x, y - r * 0.9 - bob, r * 1.15, 0, TAU); ctx.fill();
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y - r * 0.9 - bob, r * 0.92, 0, TAU); ctx.fill();
  ctx.fillStyle = PAPER; ctx.beginPath(); ctx.arc(x - r * 0.28, y - r * 1.2 - bob, r * 0.26, 0, TAU); ctx.fill();
}
function drawRival(R, it, time) {
  const { ctx } = R;
  if (it.done) return;
  const f = formation(it.n);
  const m = Math.min(it.n, 160);
  const pts = [];
  for (let i = 0; i < m; i++) { const u = unitAt(i, f); const p = project(R, u.x, it.z + 0.4 + Math.abs(u.z)); if (p) pts.push([p, i]); }
  pts.sort((a, b) => a[0].y - b[0].y);
  for (const [p, i] of pts) unit(ctx, p.x, p.y, Math.max(1.6, p.s * 0.036), RED, Math.abs(Math.sin(time * 9 + i)) * p.s * 0.01);
  const top = project(R, 0, it.z + 0.4, 0.5);
  if (top) pill(ctx, top.x, top.y, params(it.n), RED, Math.max(11, top.s * 0.13));
}
function pill(ctx, x, y, text, fill, size) {
  ctx.font = `900 ${size}px ${DISPLAY}`;
  const w = ctx.measureText(text).width + size * 0.9, h = size * 1.45;
  ctx.fillStyle = INK; roundRect(ctx, x - w / 2, y - h / 2 + 3, w, h, h / 2); ctx.fill();
  ctx.fillStyle = fill; roundRect(ctx, x - w / 2, y - h / 2, w, h, h / 2); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y + size * 0.05);
}
function drawStairs(R, S, time) {
  const { ctx } = R;
  if (S.endless) return;
  for (let i = TUNE.steps - 1; i >= 0; i--) {
    const z = S.length + 1.2 + i * 0.9, y = (i + 1) * 0.16;
    const a = project(R, -1, z, y), b = project(R, 1, z, y), c = project(R, 1, z + 0.9, y), d = project(R, -1, z + 0.9, y);
    const fa = project(R, -1, z, y - 0.16), fb = project(R, 1, z, y - 0.16);
    if (!a || !fa) continue;
    const reached = S.step > i;
    const hue = ['#ff4da6', '#ff6b8a', '#ff8a5c', '#ffb347', '#ffc933', '#d9f05a', '#8ff06a', '#3ff0c3', '#59c8ff', '#9b7bff'][i];
    ctx.fillStyle = reached ? hue : rgba(hue, 0.55);
    quad(ctx, fa, fb, b, a); ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = reached ? PAPER : '#2b1660'; quad(ctx, a, b, c, d); ctx.fill(); ctx.stroke();
    ctx.font = `900 ${Math.max(8, a.s * 0.13)}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = INK; ctx.fillText(`×${MULTS[i]}`, (fa.x + fb.x) / 2, (fa.y + a.y) / 2);
    if (reached) for (let k = 0; k < Math.min(S.cost, 12); k++) {
      const p = project(R, -0.8 + (k / 11) * 1.6, z + 0.45, y);
      if (p) unit(ctx, p.x, p.y, Math.max(1.5, p.s * 0.03), MINT, 0);
    }
  }
  const banner = project(R, 0, S.length + 1.2 + TUNE.steps * 0.9 + 0.4, TUNE.steps * 0.16 + 0.55);
  if (banner) pill(ctx, banner.x, banner.y, 'BENCHMARK', HONEY, Math.max(10, banner.s * 0.16));
}

export function draw(R, S, dt, { time = 0, attract = false } = {}) {
  const { ctx, L } = R;
  if (!L) return;
  const f = formation(S.n);
  const finaleClimb = S.phase === 'finale' || S.phase === 'won' ? Math.min(S.step, TUNE.steps) * 0.9 : 0;
  const lead = S.z + finaleClimb;
  R.camZ = lead - L.d0;
  ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
  ctx.save();
  R.shake.apply(ctx, L.w / 2, L.h / 2);
  sky(R, time);
  ground(R);
  drawStairs(R, S, time);
  // what's on the track, far to near
  const vis = S.items.filter((it) => it.z > R.camZ + 0.4 && it.z < R.camZ + 60).sort((a, b) => b.z - a.z);
  let drewCrowd = false;
  const crowd = () => {
    drewCrowd = true;
    const m = Math.min(S.n, MAXU);
    const k = 1 - Math.exp(-dt * 10);
    if (R.uready < m) { for (let i = R.uready; i < m; i++) { const u = unitAt(i, f); R.ux[i] = u.x; R.uz[i] = u.z + 0.6; } R.uready = m; }
    R.uready = Math.min(R.uready, Math.max(m, 0));
    const pts = [];
    const climbY = S.phase === 'finale' || S.phase === 'won' ? Math.min(S.step, TUNE.steps) * 0.16 : 0;
    for (let i = 0; i < m; i++) {
      const u = unitAt(i, f);
      R.ux[i] += (u.x - R.ux[i]) * k; R.uz[i] += (u.z - R.uz[i]) * k;
      const p = project(R, S.x + R.ux[i], lead + R.uz[i], climbY);
      if (p) pts.push([p, i]);
    }
    pts.sort((a, b) => a[0].y - b[0].y);
    const boost = S.n > MAXU ? Math.min(1.6, 1 + Math.log10(S.n / MAXU) * 0.6) : 1;
    for (const [p, i] of pts) unit(ctx, p.x, p.y, Math.max(1.6, p.s * 0.036 * boost), i % 9 === 0 ? HONEY : MINT, S.over ? 0 : Math.abs(Math.sin(time * 14 + i * 1.7)) * p.s * 0.022);
    const head = project(R, S.x, lead - f.r * f.depth * 0.62 - 0.1, 0.48 + climbY);
    if (head) pill(ctx, head.x, head.y - 8, params(S.n), S.n >= 100 ? HONEY : MINT, clamp(head.s * 0.12, 14, 30));
  };
  for (const it of vis) {
    if (!drewCrowd && it.z < lead - 0.2) crowd();
    switch (it.kind) {
      case 'gates': drawGates(R, it, time); break;
      case 'saw': drawSaw(R, it, time); break;
      case 'wall': drawWall(R, it); break;
      case 'pit': drawPit(R, it, time); break;
      case 'gem': drawGem(R, it, time); break;
      case 'rival': drawRival(R, it, time); break;
      default: break;
    }
  }
  if (!drewCrowd) crowd();
  R.parts.draw(ctx);
  R.floats.draw(ctx);
  ctx.restore();
  if (attract) { ctx.fillStyle = 'rgba(15, 8, 38, .42)'; ctx.fillRect(0, 0, L.w, L.h); }
  if (R.flash > 0 && !REDUCED) { ctx.globalAlpha = Math.min(0.45, R.flash); ctx.fillStyle = R.flashColor; ctx.fillRect(0, 0, L.w, L.h); ctx.globalAlpha = 1; }
}

// ---------- effects ----------
const FONT = `900 1em ${DISPLAY}`;
export const fx = {
  gate(R, S, e) {
    const p = project(R, e.side ? 0.5 : -0.5, e.z, 0.4) || { x: R.L.cx, y: R.L.playerY - 80, s: 100 };
    const good = e.after >= e.before;
    R.floats.add({ x: p.x, y: R.L.playerY - R.L.s0 * 0.9, text: `${opText(e.op)}  ${params(e.after)}`, color: good ? MINT : RED, size: 30, life: 1, rise: 60, font: FONT });
    R.parts.burst({ x: p.x, y: R.L.playerY - R.L.s0 * 0.4, count: good ? 26 : 14, speed: [100, 360], life: [0.4, 0.9], size: [3, 8], colors: good ? [MINT, SKY, PAPER] : [RED, PINK], shape: good ? 'star' : 'square', spin: 8, drag: 2 });
    if (!good) { R.shake.kick(0.3); R.flash = 0.2; R.flashColor = RED; } else if (e.op.t === 'x') R.shake.kick(0.12);
  },
  lost(R, S, e) {
    const p = project(R, S.x, S.z, 0.1);
    if (!p) return;
    R.parts.burst({ x: p.x + (Math.random() - 0.5) * p.s * 0.6, y: p.y - 6, count: Math.min(10, 2 + e.k), speed: [60, 220], life: [0.3, 0.7], size: [2, 5], colors: [MINT, PAPER], gravity: 600, shape: 'square', spin: 6 });
  },
  clash(R, S) {
    const p = project(R, S.x, S.z + 0.9, 0.12);
    if (p) R.parts.burst({ x: p.x + (Math.random() - 0.5) * p.s * 0.5, y: p.y, count: 3, speed: [80, 260], life: [0.15, 0.35], size: [2, 5], colors: [HONEY, PAPER, RED], shape: 'spark' });
  },
  gem(R, S, e) {
    const p = project(R, e.x, e.z, 0.16);
    if (p) { R.parts.burst({ x: p.x, y: p.y, count: 8, speed: [60, 180], life: [0.3, 0.6], size: [2, 5], colors: [HONEY, PAPER], shape: 'star' }); R.floats.add({ x: p.x, y: p.y - 10, text: `+${e.v}`, color: HONEY, size: 16, life: 0.7, rise: 30, font: FONT }); }
  },
  beat(R) { R.floats.add({ x: R.L.cx, y: R.L.playerY - R.L.s0 * 1.1, text: 'RIVAL DOWN', color: HONEY, size: 30, life: 1.1, rise: 40, font: FONT }); R.shake.kick(0.2); },
  step(R, S, e) {
    R.floats.add({ x: R.L.cx, y: R.L.playerY - R.L.s0 * 1.2, text: `×${e.mult}`, color: HONEY, size: 30 + e.step * 2, life: 0.7, rise: 40, font: FONT });
    R.parts.burst({ x: R.L.cx, y: R.L.playerY - R.L.s0 * 0.6, count: 10, speed: [80, 240], life: [0.3, 0.6], size: [3, 7], colors: [HONEY, MINT, PAPER], shape: 'star' });
  },
  won(R) {
    for (let i = 0; i < 5; i++) R.parts.burst({ x: R.L.w * (0.1 + i * 0.2), y: R.L.horizon + 20, count: 22, speed: [160, 480], life: [0.8, 1.6], size: [5, 10], colors: [HONEY, PINK, MINT, SKY, PAPER], gravity: 420, shape: 'square', spin: 10, angle: [-Math.PI * 0.95, -Math.PI * 0.05] });
  },
  lose(R) { R.shake.kick(0.6); R.flash = 0.35; R.flashColor = RED; },
  update(R, dt) { R.parts.update(dt); R.floats.update(dt); R.shake.update(dt); R.flash = Math.max(0, R.flash - dt * 2); },
  reset(R) { R.parts.clear(); R.floats.clear(); R.flash = 0; R.uready = 0; },
};
