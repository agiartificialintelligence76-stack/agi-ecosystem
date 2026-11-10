// PACKET LOSS: the board, drawn. "The network at night": navy-black with a faint hex mesh; the walls are thick rounded
// cable conduits (an ink outline, a dark body, an inner stripe in the maze's tint, a glossy highlight), pre-rendered
// once per maze and size (and a lit copy for the clear's wall flash); bits are tiny mint diamonds from a cached sprite;
// the quarantine pod in the middle; gates, keys and the rest drawn each frame; the letter and the gremlins on top.
import { W, H, WALL, BOXWALL, BOX, DOOR, DX, DY } from './mazes.js';
import { C, envelope, gremlin, key, receipt, repeater, bitShape } from './art.js';
import { mix, rgba, roundRect, TAU, clamp, ease } from '../kit/fx.js';
import { TUNE, active } from './sim.js';
import { REDUCED } from '../kit/env.js';

const DISPLAY = "'AK Display', 'Arial Black', system-ui, sans-serif";
const MONO = "'AK Mono', ui-monospace, monospace";
export const font = (weight, size, fam = DISPLAY) => `${weight} ${Math.round(size)}px ${fam}`;

// ---------- the background: a faint hex mesh, drawn once per size ----------
let bg = null;
export function drawBackground(ctx, view) {
  const w = view.w, h = view.h, dpr = view.dpr;
  if (!bg || bg.w !== w || bg.h !== h || bg.dpr !== dpr) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * dpr); c.height = Math.ceil(h * dpr);
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = C.bg; g.fillRect(0, 0, w, h);
    const r = 16, hw = Math.sqrt(3) * r;
    g.strokeStyle = 'rgba(96,120,230,0.075)'; g.lineWidth = 1;
    g.beginPath();
    for (let row = -1, y = -r; y < h + r * 2; row++, y += r * 1.5) {
      for (let x = (row % 2 ? hw / 2 : 0) - hw; x < w + hw; x += hw) {
        for (let k = 0; k < 6; k++) {
          const a = Math.PI / 6 + (k * Math.PI) / 3, b = a + Math.PI / 3;
          g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
          g.lineTo(x + Math.cos(b) * r, y + Math.sin(b) * r);
        }
      }
    }
    g.stroke();
    const v = g.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.78);
    v.addColorStop(0, 'rgba(20,28,70,0.0)'); v.addColorStop(1, 'rgba(2,3,12,0.55)');
    g.fillStyle = v; g.fillRect(0, 0, w, h);
    bg = { c, w, h, dpr };
  }
  ctx.drawImage(bg.c, 0, 0, w, h);
}

// ---------- the maze layer ----------
// the walls' skeleton: a line between neighbouring wall tiles, a dot for a lone one, a filled square in each 2 × 2 block
function skeleton(M, s) {
  const lines = new Path2D(), blocks = new Path2D();
  const wall = (x, y) => x >= 0 && y >= 0 && x < W && y < H && M.cell[y * W + x] === WALL;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!wall(x, y)) continue;
      const cx = (x + 0.5) * s, cy = (y + 0.5) * s;
      let n = 0;
      if (wall(x + 1, y)) { lines.moveTo(cx, cy); lines.lineTo(cx + s, cy); n++; }
      if (wall(x, y + 1)) { lines.moveTo(cx, cy); lines.lineTo(cx, cy + s); n++; }
      if (!n && !wall(x - 1, y) && !wall(x, y - 1)) { lines.moveTo(cx, cy); lines.lineTo(cx + 0.01, cy); }
      if (wall(x + 1, y) && wall(x, y + 1) && wall(x + 1, y + 1)) blocks.rect(cx, cy, s, s);
    }
  }
  return { lines, blocks };
}
function paintConduits(g, sk, s, tint, lit) {
  g.lineCap = 'round'; g.lineJoin = 'round';
  const pass = (width, color, blocks = true) => {
    g.strokeStyle = color; g.lineWidth = width;
    g.stroke(sk.lines);
    if (blocks) { g.stroke(sk.blocks); g.fillStyle = color; g.fill(sk.blocks); }
  };
  pass(0.8 * s, C.inkDeep);
  pass(0.62 * s, lit ? mix(tint, '#ffffff', 0.55) : mix('#141a3d', tint, 0.2));
  pass(0.25 * s, lit ? '#ffffff' : tint, false);
  pass(0.08 * s, lit ? '#ffffff' : mix(tint, '#ffffff', 0.55), false);
  // a glossy highlight along the top-left of every run
  g.save();
  g.translate(-0.13 * s, -0.15 * s);
  g.strokeStyle = lit ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.28)'; g.lineWidth = 0.055 * s;
  g.stroke(sk.lines);
  g.restore();
}
// a rounded rectangle added to a path (no beginPath: several can share one path)
function rr(path, x, y, w, h, r) {
  path.moveTo(x + r, y);
  path.arcTo(x + w, y, x + w, y + h, r); path.arcTo(x + w, y + h, x, y + h, r);
  path.arcTo(x, y + h, x, y, r); path.arcTo(x, y, x + w, y, r);
  path.closePath();
}
// the quarantine pod: a hazard-striped frame round a dark window, its name on top
function paintPod(g, M, s) {
  const b = M.box, x = b.x0 * s, y = b.y0 * s, w = (b.x1 - b.x0 + 1) * s, h = (b.y1 - b.y0 + 1) * s;
  const inset = 0.1 * s;
  roundRect(g, x + inset, y + inset, w - inset * 2, h - inset * 2, 0.35 * s);
  g.fillStyle = '#0d1230'; g.fill();
  g.lineWidth = 0.12 * s; g.strokeStyle = C.inkDeep; g.stroke();
  // the hazard frame: honey and ink stripes, clipped to a band
  g.save();
  const bw = 0.32 * s;
  const band = new Path2D();
  rr(band, x + inset, y + inset, w - inset * 2, h - inset * 2, 0.35 * s);
  rr(band, x + inset + bw, y + inset + bw, w - inset * 2 - bw * 2, h - inset * 2 - bw * 2, 0.2 * s);
  g.clip(band, 'evenodd');
  g.fillStyle = C.honey; g.fillRect(x, y, w, h);
  g.strokeStyle = C.ink; g.lineWidth = 0.13 * s;
  g.beginPath();
  for (let k = -h; k < w + h; k += 0.36 * s) { g.moveTo(x + k, y + h); g.lineTo(x + k + h, y); }
  g.stroke();
  g.restore();
  roundRect(g, x + inset, y + inset, w - inset * 2, h - inset * 2, 0.35 * s);
  g.lineWidth = 0.1 * s; g.strokeStyle = C.inkDeep; g.stroke();
  roundRect(g, x + inset + bw, y + inset + bw, w - inset * 2 - bw * 2, h - inset * 2 - bw * 2, 0.2 * s);
  g.lineWidth = 0.08 * s; g.strokeStyle = C.inkDeep; g.stroke();
  // inside: a faint grid
  g.save();
  roundRect(g, x + inset + bw, y + inset + bw, w - inset * 2 - bw * 2, h - inset * 2 - bw * 2, 0.2 * s); g.clip();
  g.strokeStyle = 'rgba(120,140,255,0.12)'; g.lineWidth = 1;
  g.beginPath();
  for (let k = x; k < x + w; k += s * 0.5) { g.moveTo(k, y); g.lineTo(k, y + h); }
  for (let k = y; k < y + h; k += s * 0.5) { g.moveTo(x, k); g.lineTo(x + w, k); }
  g.stroke();
  g.restore();
  // its name, on the band at the top (when there's room for words)
  if (s >= 15) {
    const fs = Math.max(7, 0.3 * s);
    g.font = font(900, fs); g.textAlign = 'center'; g.textBaseline = 'middle';
    const tx = x + w / 2, ty = y + inset + bw / 2 + 0.01 * s;
    const label = 'QUARANTINE', tw = g.measureText(label).width + fs * 0.9;
    roundRect(g, tx - tw / 2, ty - fs * 0.62, tw, fs * 1.24, fs * 0.3);
    g.fillStyle = C.ink; g.fill();
    g.fillStyle = C.honey; g.fillText(label, tx, ty + 0.5);
  }
}
// the tunnel mouths: little chevrons pointing out
function paintTunnels(g, M, s, tint) {
  g.strokeStyle = rgba(tint, 0.55); g.lineWidth = Math.max(1, 0.07 * s); g.lineCap = 'round'; g.lineJoin = 'round';
  for (const y of M.tunnels) {
    const cy = (y + 0.5) * s;
    for (const [x, sgn] of [[0.32 * s, -1], [W * s - 0.32 * s, 1]]) {
      g.beginPath();
      g.moveTo(x - sgn * 0.08 * s, cy - 0.16 * s); g.lineTo(x + sgn * 0.08 * s, cy); g.lineTo(x - sgn * 0.08 * s, cy + 0.16 * s);
      g.stroke();
    }
  }
}

const layers = new Map();
export function mazeLayer(M, s, dpr, lit = false) {
  const keyStr = `${M.id}|${s.toFixed(2)}|${dpr}|${lit ? 1 : 0}`;
  let L = layers.get(keyStr);
  if (L) return L;
  if (layers.size > 6) layers.clear();
  const c = document.createElement('canvas');
  c.width = Math.ceil(W * s * dpr); c.height = Math.ceil(H * s * dpr);
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sk = skeleton(M, s);
  paintConduits(g, sk, s, M.tint, lit);
  if (!lit) { paintPod(g, M, s); paintTunnels(g, M, s, M.tint); }
  L = { c, w: W * s, h: H * s };
  layers.set(keyStr, L);
  return L;
}

// ---------- bit sprites ----------
let bits = null;
function bitSprites(s, dpr) {
  if (bits && bits.s === s && bits.dpr === dpr) return bits;
  const size = Math.ceil(s * 0.36), make = (bright) => {
    const c = document.createElement('canvas');
    c.width = Math.ceil(size * dpr); c.height = Math.ceil(size * dpr);
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    bitShape(g, size / 2, size / 2, s, bright);
    return c;
  };
  bits = { s, dpr, size, normal: make(false), bright: make(true) };
  return bits;
}

// ---------- a frame of the board ----------
// cam: { s, ox, oy, clip: { x, y, w, h } } (the maze's tile size, where its top-left corner is, the visible window)
// F: the game's effects (fx state, timers); now: seconds (for animation)
export function drawBoard(ctx, view, S, cam, F, now) {
  const s = cam.s, ox = cam.ox, oy = cam.oy, M = S.maze;
  const X = (x) => ox + (x + 0.5) * s, Y = (y) => oy + (y + 0.5) * s;
  ctx.save();
  ctx.beginPath(); ctx.rect(cam.clip.x, cam.clip.y, cam.clip.w, cam.clip.h); ctx.clip();
  // the walls (and the clear's flash running through them)
  const L = mazeLayer(M, s, view.dpr);
  ctx.drawImage(L.c, ox, oy, L.w, L.h);
  if (F.calm > 0) {
    const a = 0.1 + 0.08 * Math.sin(now * 5);
    ctx.globalAlpha = a * Math.min(1, F.calm * 2);
    ctx.drawImage(mazeLayer(M, s, view.dpr, true).c, ox, oy, L.w, L.h);
    ctx.globalAlpha = 1;
  }
  if (F.wave) {
    const wv = F.wave, lit = mazeLayer(M, s, view.dpr, true);
    if (REDUCED) {
      ctx.globalAlpha = 0.35 * Math.sin(Math.min(1, wv.t / 0.9) * Math.PI);
      ctx.drawImage(lit.c, ox, oy, L.w, L.h);
      ctx.globalAlpha = 1;
    } else {
      const R = wv.t * s * 26, band = s * 3.2;
      ctx.save();
      ctx.beginPath(); ctx.arc(X(wv.x), Y(wv.y), R, 0, TAU); ctx.arc(X(wv.x), Y(wv.y), Math.max(0, R - band), 0, TAU, true);
      ctx.clip();
      ctx.drawImage(lit.c, ox, oy, L.w, L.h);
      ctx.restore();
    }
  }
  // the gates
  for (const g of S.gates) drawGate(ctx, S, g, X(g.x), Y(g.y), s, now);
  // the box's door: shut unless someone's passing
  drawDoor(ctx, S, X, Y, s);
  // bits (a shimmer runs through them now and then)
  const B = bitSprites(s, view.dpr), half = B.size / 2;
  const wave = (now * 7) % 34;
  const y0 = Math.max(0, Math.floor((cam.clip.y - oy) / s) - 1), y1 = Math.min(H - 1, Math.ceil((cam.clip.y + cam.clip.h - oy) / s) + 1);
  for (let y = y0; y <= y1; y++) {
    for (let x = 0; x < W; x++) {
      if (!S.bits[y * W + x]) continue;
      const d = (x + y * 0.7 + 30 - wave) % 34;
      ctx.drawImage(d >= 0 && d < 1.6 ? B.bright : B.normal, X(x) - half, Y(y) - half, B.size, B.size);
    }
  }
  // keys, the receipt, the repeater
  for (const k of S.keys) {
    if (!k.on) continue;
    const kx = X(k.x), ky = Y(k.y), ph = (now * 0.9 + k.x * 0.13 + k.y * 0.07) % 1;
    if (!REDUCED) {
      ctx.beginPath(); ctx.arc(kx, ky, s * (0.3 + ph * 0.55), 0, TAU);
      ctx.strokeStyle = rgba(C.honey, 0.55 * (1 - ph)); ctx.lineWidth = Math.max(1, 0.06 * s); ctx.stroke();
    }
    key(ctx, kx, ky, s, { t: now + k.x, scale: 0.98 + 0.1 * Math.sin(now * 5 + k.y) });
  }
  if (S.receipt.on) receipt(ctx, X(M.receipt.x), Y(M.receipt.y), s, { t: now, left: S.receipt.t });
  if (S.repeater.on) repeater(ctx, X(M.repeater.x), Y(M.repeater.y), s, { t: now, left: S.repeater.t });
  // lost packets in the air
  for (const f of S.flying) {
    const u = Math.min(1, f.t / f.dur), e = ease.outCubic(u);
    let fx = f.fx, tx = f.tx;
    if (tx - fx > W / 2) fx += W; else if (fx - tx > W / 2) fx -= W;
    const px = X(fx + (tx - fx) * e), py = Y(f.fy + (f.ty - f.fy) * e) - Math.sin(u * Math.PI) * s * (0.9 + 0.4 * Math.abs(tx - fx) / 4);
    ctx.drawImage(B.bright, px - half * 1.3, py - half * 1.3, B.size * 1.3, B.size * 1.3);
  }
  drawActors(ctx, S, X, Y, s, F, now);
  ctx.restore();
}

function drawGate(ctx, S, g, x, y, s, now) {
  // across the corridor: a corridor running left-right gets an up-down barrier
  const horiz = canSee(S, g.x - 1, g.y) || canSee(S, g.x + 1, g.y);
  const len = s * 0.5;
  const ax = horiz ? 0 : 1, ay = horiz ? 1 : 0;
  const p1x = x - ax * len, p1y = y - ay * len, p2x = x + ax * len, p2y = y + ay * len;
  const warn = g.open && g.left < 1;
  const lw = Math.max(1.2, 0.08 * s);
  if (!g.open) {
    // the barrier: pink-red with ink stripes
    ctx.lineCap = 'round';
    ctx.strokeStyle = C.inkDeep; ctx.lineWidth = 0.34 * s;
    ctx.beginPath(); ctx.moveTo(p1x, p1y); ctx.lineTo(p2x, p2y); ctx.stroke();
    ctx.strokeStyle = C.gate; ctx.lineWidth = 0.22 * s; ctx.stroke();
    ctx.strokeStyle = C.ink; ctx.lineWidth = Math.max(1, 0.06 * s);
    ctx.beginPath();
    for (let k = -2; k <= 2; k++) {
      const cx = x + ax * k * 0.2 * s, cy = y + ay * k * 0.2 * s;
      ctx.moveTo(cx - ay * 0.07 * s - ax * 0.05 * s, cy - ax * 0.07 * s - ay * 0.05 * s);
      ctx.lineTo(cx + ay * 0.07 * s + ax * 0.05 * s, cy + ax * 0.07 * s + ay * 0.05 * s);
    }
    ctx.stroke();
  } else {
    ctx.setLineDash([0.08 * s, 0.1 * s]);
    ctx.strokeStyle = warn && Math.sin(now * 24) > 0 ? rgba(C.gate, 0.85) : rgba(C.mint, 0.3); ctx.lineWidth = Math.max(1, 0.05 * s);
    ctx.beginPath(); ctx.moveTo(p1x, p1y); ctx.lineTo(p2x, p2y); ctx.stroke();
    ctx.setLineDash([]);
  }
  // the light on its post, with its countdown ring
  const lx = p1x - ax * 0.05 * s, ly = p1y - ay * 0.05 * s;
  const frac = g.open ? g.left / TUNE.gateOpen : g.left / (TUNE.gateCycle - TUNE.gateOpen);
  ctx.beginPath(); ctx.arc(lx, ly, 0.17 * s, 0, TAU); ctx.fillStyle = C.inkDeep; ctx.fill();
  ctx.beginPath(); ctx.arc(lx, ly, 0.17 * s, -Math.PI / 2, -Math.PI / 2 + TAU * frac);
  ctx.strokeStyle = g.open ? C.mint : C.gate; ctx.lineWidth = Math.max(1.2, 0.06 * s); ctx.stroke();
  ctx.beginPath(); ctx.arc(lx, ly, 0.08 * s, 0, TAU);
  ctx.fillStyle = g.open ? (warn && Math.sin(now * 24) > 0 ? C.honey : C.mint) : C.gate; ctx.fill();
  ctx.lineWidth = lw * 0.5; ctx.strokeStyle = C.ink; ctx.stroke();
}
const canSee = (S, x, y) => y >= 0 && y < H && S.cell[y * W + ((x + W) % W)] !== WALL && S.cell[y * W + ((x + W) % W)] !== BOXWALL;

function drawDoor(ctx, S, X, Y, s) {
  const M = S.maze, d = M.door;
  let open = 0;
  for (const g of S.gremlins) if (g.state === 'exit') open = 1;
  const x = X(d.x), y = Y(d.y);
  const hw = 0.36 * s * (1 - open * 0.85);
  ctx.lineCap = 'round';
  ctx.strokeStyle = C.inkDeep; ctx.lineWidth = 0.26 * s;
  ctx.beginPath(); ctx.moveTo(x - 0.36 * s, y); ctx.lineTo(x - 0.36 * s + hw, y); ctx.moveTo(x + 0.36 * s, y); ctx.lineTo(x + 0.36 * s - hw, y); ctx.stroke();
  ctx.strokeStyle = C.pink; ctx.lineWidth = 0.13 * s; ctx.stroke();
}

// the letter, its trail, the gremlins, the THROTTLE aura; anything near a tunnel mouth drawn on both sides
function drawActors(ctx, S, X, Y, s, F, now) {
  const p = S.player;
  const th = S.gremlins[2];
  // THROTTLE's aura (under everything)
  if (th && active(th) && !th.scrambled) {
    const inside = p.slowed;
    const r = TUNE.aura * s;
    each(th.x, (gx) => {
      const cx = X(gx), cy = Y(th.y);
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU);
      ctx.fillStyle = rgba(C.purple, inside ? 0.12 : 0.05); ctx.fill();
      ctx.save();
      ctx.setLineDash([0.32 * s, 0.22 * s]); ctx.lineDashOffset = -now * s * 1.2;
      ctx.strokeStyle = rgba(C.purple, inside ? 0.75 : 0.35); ctx.lineWidth = Math.max(1, 0.07 * s);
      ctx.stroke();
      ctx.restore();
    });
  }
  // gremlins in or flying back to the box
  for (const g of S.gremlins) {
    if (g.state === 'box' || g.state === 'exit') drawGremlin(ctx, g, X(g.x), Y(g.y + Math.sin(now * 3 + g.i) * 0.06), s * (g.state === 'box' ? 0.78 : 0.88), F, now, S);
    if (g.state === 'return') drawReturning(ctx, g, X(g.x), Y(g.y), s, now);
  }
  // the letter's trail
  if (S.phase === 'play' && p.moving) drawTrail(ctx, S, X, Y, s);
  // the gremlins out on the board
  for (const g of S.gremlins) {
    if (!(g.state === 'roam' || g.state === 'stun' || ((g.state === 'on' || g.state === 'join') && g.kind === 'echo'))) continue;
    each(g.x, (gx) => drawGremlin(ctx, g, X(gx), Y(g.y), s, F, now, S));
  }
  // the letter
  if (F.showPlayer !== false) each(p.x, (px) => drawPlayer(ctx, S, X(px) + (F.px || 0), Y(p.y) + (F.py || 0), s, F, now));
}
// draw at x and, near a tunnel mouth, at its twin on the other side
function each(x, fn) {
  fn(x);
  if (x < 0.6) fn(x + W);
  else if (x > W - 1.6) fn(x - W);
}

function drawTrail(ctx, S, X, Y, s) {
  const n = 22, stepK = 2;
  let px = null, py = null;
  ctx.lineCap = 'round';
  for (let k = 0; k < n; k++) {
    const i = ((S.head - k * stepK) % 4096 + 4096) % 4096;
    const x = S.trail[i * 2], y = S.trail[i * 2 + 1];
    if (px !== null && Math.abs(x - px) < 1.5) {
      const a = 1 - k / n;
      ctx.strokeStyle = rgba(C.pink, 0.55 * a);
      ctx.lineWidth = s * (0.05 + 0.24 * a);
      ctx.beginPath(); ctx.moveTo(X(px), Y(py)); ctx.lineTo(X(x), Y(y)); ctx.stroke();
    }
    px = x; py = y;
  }
}

function drawPlayer(ctx, S, x, y, s, F, now) {
  const p = S.player;
  const enc = S.enc > 0;
  if (p.inv > 0 && !REDUCED && Math.sin(now * 40) < -0.2 && S.phase === 'play') return;
  const alpha = p.inv > 0 && REDUCED ? 0.55 : 1;
  if (enc) {
    // encrypted: a honey glow ring, crisp, breathing
    const pulse = 0.62 + Math.sin(now * 10) * 0.05;
    ctx.beginPath(); ctx.arc(x, y, s * pulse, 0, TAU);
    ctx.fillStyle = rgba(C.honey, 0.16); ctx.fill();
    ctx.strokeStyle = rgba(C.honey, S.enc < TUNE.encFlash && Math.sin(now * 20) > 0 ? 0.35 : 0.9); ctx.lineWidth = Math.max(1.4, 0.08 * s); ctx.stroke();
  }
  if (p.slowed) {
    // the aura's drag: little purple dashes behind it
    ctx.strokeStyle = rgba(C.purple, 0.8); ctx.lineWidth = Math.max(1, 0.05 * s); ctx.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      const a = now * 6 + k * 2.1;
      ctx.beginPath(); ctx.arc(x, y, s * (0.5 + 0.06 * Math.sin(a)), a, a + 0.6); ctx.stroke();
    }
  }
  const hx = DX[p.dir] || 0, hy = DY[p.dir] || 0;
  const moving = p.moving && S.phase === 'play';
  const lean = (F.lean || 0) + (moving ? hx * 0.13 : 0);
  const bounce = moving ? Math.sin(now * 22) * 0.025 : 0;
  const sq = F.squash || 0;
  const sx = 1 + sq * 0.18 - (moving && hy ? 0.05 : 0), sy = 1 - sq * 0.15 + (moving && hy ? 0.06 : 0) + bounce;
  if (F.glitch > 0) {
    // packet loss: the letter splits into red and cyan
    const o = s * 0.14 * Math.min(1, F.glitch * 3);
    envelope(ctx, x - o, y, s, { lean, sx, sy, body: 'rgba(255,60,90,0.6)', line: 'rgba(255,60,90,0.6)', seal: 'rgba(0,0,0,0)', gloss: false });
    envelope(ctx, x + o, y, s, { lean, sx, sy, body: 'rgba(63,240,240,0.55)', line: 'rgba(63,240,240,0.55)', seal: 'rgba(0,0,0,0)', gloss: false });
  }
  envelope(ctx, x, y, s, { lean, sx, sy, flap: moving ? 0.5 + 0.5 * Math.sin(now * 18) : 0, alpha });
  if (enc) {
    // a little honey lock on the seal while encrypted
    ctx.save(); ctx.translate(x + 0.3 * s, y - 0.3 * s);
    ctx.beginPath(); ctx.arc(0, -0.05 * s, 0.07 * s, Math.PI, 0); ctx.lineWidth = Math.max(1, 0.04 * s); ctx.strokeStyle = C.ink; ctx.stroke();
    roundRect(ctx, -0.1 * s, -0.05 * s, 0.2 * s, 0.15 * s, 0.03 * s); ctx.fillStyle = C.honey; ctx.fill(); ctx.stroke();
    ctx.restore();
  }
}

// a gremlin: its body, eyes that follow where it's going, scrambled and flashing near the end
const _o = { t: 0, lx: 0, ly: 0, scrambled: false, flashOn: false, wobble: false, alpha: 1, angry: false, blink: false, needle: 0, lean: 0, body: '', line: '' };
function drawGremlin(ctx, g, x, y, s, F, now, S) {
  const look = F.look[g.i];
  _o.t = now + g.i * 1.7;
  _o.lx = look.x; _o.ly = look.y;
  _o.scrambled = g.scrambled;
  _o.flashOn = g.scrambled && S.enc <= TUNE.encFlash && Math.floor(now * 7) % 2 === 0;
  _o.alpha = g.kind === 'echo' ? Math.max(0.15, g.alpha) * 0.92 : 1;
  _o.angry = g.kind === 'ping' && S.calm <= 0 && g.state === 'roam';
  _o.blink = Math.floor(now * 4 + g.i) % 2 === 0;
  _o.needle = S.player.slowed ? 0.85 + Math.sin(now * 30) * 0.08 : 0.45 + Math.sin(now * 3) * 0.1;
  _o.lean = look.x * 0.1;
  if (g.state === 'stun') { _o.lx = Math.sin(now * 30) * 0.5; _o.ly = 0.3; }
  gremlin(ctx, g.kind, x, y, s, _o);
  if (g.state === 'stun') {
    // a hiccup: little stars over it
    ctx.fillStyle = C.paper;
    for (let k = 0; k < 3; k++) {
      const a = now * 7 + (k * TAU) / 3;
      ctx.beginPath(); ctx.arc(x + Math.cos(a) * 0.32 * s, y - 0.55 * s + Math.sin(a) * 0.1 * s, Math.max(1, 0.05 * s), 0, TAU); ctx.fill();
    }
  }
}
// quarantined, flying home: just its eyes inside a dashed square, spinning
function drawReturning(ctx, g, x, y, s, now) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(now * 8);
  ctx.setLineDash([0.1 * s, 0.08 * s]);
  ctx.strokeStyle = rgba(['#ff5a3c', '#ffe14d', '#9b5cff', '#8b7bff'][g.i], 0.9); ctx.lineWidth = Math.max(1, 0.06 * s);
  ctx.strokeRect(-0.28 * s, -0.28 * s, 0.56 * s, 0.56 * s);
  ctx.setLineDash([]);
  ctx.restore();
  ctx.fillStyle = C.white;
  for (const sgn of [-1, 1]) { ctx.beginPath(); ctx.arc(x + sgn * 0.1 * s, y, 0.07 * s, 0, TAU); ctx.fill(); }
}

// ---------- words on the board ----------
// sticker words: an ink outline and a hard shadow, the arcade's display face
export function stickerText(ctx, text, x, y, size, fill, { align = 'center', stroke = C.ink, shadow = 0.08, weight = 900, family = DISPLAY } = {}) {
  ctx.font = font(weight, size, family);
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, size * 0.16);
  ctx.strokeStyle = stroke;
  if (shadow) { ctx.fillStyle = stroke; ctx.strokeText(text, x, y + size * shadow); ctx.fillText(text, x, y + size * shadow); }
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill; ctx.fillText(text, x, y);
}

// the maze's name card at its start, READY, then GO
export function drawBanner(ctx, cam, b, now) {
  if (!b) return;
  const cx = cam.clip.x + cam.clip.w / 2, cy = cam.clip.y + cam.clip.h * 0.42;
  const s = cam.s;
  const t = b.t, life = b.life;
  const pin = REDUCED ? 1 : ease.outBack(clamp(t / 0.32, 0, 1));
  const out = t > life - 0.25 ? clamp((life - t) / 0.25, 0, 1) : 1;
  ctx.save();
  ctx.globalAlpha = out;
  const big = clamp(cam.clip.w * 0.11, 22, 58);
  ctx.translate(cx, cy); ctx.scale(pin, pin);
  if (b.kind === 'maze') {
    // a plate behind the words so they read over the walls
    const w = Math.min(cam.clip.w * 0.86, big * 7.4), h = big * 2.5;
    roundRect(ctx, -w / 2, -h * 0.62, w, h, big * 0.4);
    ctx.fillStyle = rgba(C.bg, 0.86); ctx.fill();
    ctx.lineWidth = Math.max(2, big * 0.07); ctx.strokeStyle = b.tint; ctx.stroke();
    stickerText(ctx, b.kicker, 0, -h * 0.3, big * 0.42, b.tint, { shadow: 0 });
    stickerText(ctx, b.title, 0, -h * 0.02, fitSize(ctx, b.title, big, w * 0.9), C.paper);
    if (b.sub) stickerText(ctx, b.sub, 0, h * 0.27, big * 0.34, C.honey, { shadow: 0 });
  } else {
    stickerText(ctx, b.title, 0, 0, b.size || big, b.color || C.paper);
    if (b.sub) stickerText(ctx, b.sub, 0, (b.size || big) * 0.85, (b.size || big) * 0.36, b.subColor || C.paper, { shadow: 0 });
  }
  ctx.restore();
  void s; void now;
}
function fitSize(ctx, text, size, maxW) {
  ctx.font = font(900, size);
  const w = ctx.measureText(text).width;
  return w > maxW ? size * (maxW / w) : size;
}

// ?demo: the run's numbers drawn on the board (the kit's bar is hidden there)
export function drawDemoHud(ctx, view, S) {
  const pad = 10, y = 16;
  ctx.save();
  ctx.font = font(900, 12); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const label = `MAZE ${S.n + 1} · ${S.maze.name.toUpperCase()}`;
  const tw = ctx.measureText(label).width;
  roundRect(ctx, pad - 6, y - 11, tw + 12, 22, 11); ctx.fillStyle = rgba(C.ink, 0.85); ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = S.maze.tint; ctx.stroke();
  ctx.fillStyle = C.paper; ctx.fillText(label, pad, y + 0.5);
  // score and signal on the right
  ctx.font = font(800, 14, MONO); ctx.textAlign = 'right';
  const sc = S.score.toLocaleString('en-US');
  const sw = ctx.measureText(sc).width;
  const bx = view.w - pad - 30;
  roundRect(ctx, bx - sw - 14, y - 11, sw + 52, 22, 11); ctx.fillStyle = rgba(C.ink, 0.85); ctx.fill();
  ctx.fillStyle = C.honey; ctx.fillText(sc, bx - 6, y + 1);
  for (let k = 0; k < 3; k++) {
    const h = 5 + k * 3.5;
    ctx.fillStyle = k < S.signal ? C.mint : rgba(C.paper, 0.22);
    ctx.fillRect(bx + 2 + k * 7, y + 7 - h, 4.5, h);
  }
  ctx.restore();
}
export { BOX, DOOR };
