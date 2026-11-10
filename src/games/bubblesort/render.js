// BUBBLE SORT: drawing a frame. The page and the board (pre-drawn once per size), the ceiling, the deadline, the bubbles on
// their springs, the guide (its dots along the exact path, a ghost where it lands), the launcher contraption (a honey
// console, a pink dome, a barrel that turns, the meter and the miss pips), the next bubble, AGI-1, the header or the side
// card, the falling bubbles and the banners. Everything in CSS px; the board's units turned into px by the layout.
import { RH, rowY, DEADLINE_Y, LAUNCHER, FIELD_H, W, LIMIT, LOCK, MEMORY, SORT, WILD, BOMB, isColor } from './grid.js';
import { stamp, C, INK, fillOf, roundRectPath, RAINBOW } from './art.js';
import { NEXT_AT, FACE_AT, M, drawPage } from './view.js';
import { clamp, ease, fmt, star as starPath } from '../kit/fx.js';
import { sortRowsFor, around, BOMB_RADIUS } from './rules.js';

const DISPLAY = "'AK Display', 'Arial Black', system-ui, sans-serif";
const MONO = "'AK Mono', ui-monospace, monospace";
const font = (w, px, fam = DISPLAY) => `${w} ${Math.max(6, Math.round(px))}px ${fam}`;

// st: { t, game, guide, aim, cancel, mode, def, panel, sheet, face, bust, faceHop, nervous, best, label }
export function draw(g, L, sc, st) {
  const s = L.s, P = L.panel;
  drawPage(g, L, st.t);
  if (L.bust && st.bust) drawBust(g, L, st);
  if (st.panel) g.drawImage(st.panel.cv, P.x - st.panel.pad, P.y - st.panel.pad, st.panel.cv.width / st.dpr, st.panel.cv.height / st.dpr);
  g.save();
  sc.shake.apply(g, P.x + P.w / 2, P.y + P.h / 2);
  // inside the board
  g.save();
  roundRectPath(g, P.x + M * s * 0.42, P.y + M * s * 0.42, P.w - M * s * 0.84, P.h - M * s * 0.84, s * 0.76); g.clip();
  const mir = sc.mirror;
  drawCeiling(g, L, sc, st);
  if (sc.sortRows) drawSortRows(g, L, sc);
  drawDeadline(g, L, st);
  drawBubbles(g, L, sc, st);
  if (st.guide && !st.cancel) drawGuide(g, L, st);
  drawFalling(g, L, sc, st);
  g.restore();
  drawLauncher(g, L, sc, st);
  if (sc.flying) drawFlying(g, L, sc, st);
  g.restore();
  // above everything
  sc.parts.draw(g);
  sc.floats.draw(g);
  if (sc.flash > 0) { g.fillStyle = `rgba(255,250,240,${sc.flash * 0.35})`; g.fillRect(P.x, P.y, P.w, P.h); }
  if (L.face && st.face) drawFace(g, L, sc, st);
  if (L.header) drawHeader(g, L, sc, st);
  if (L.side) drawSide(g, L, sc, st);
  if (sc.banner) drawBanner(g, L, sc.banner);
  if (st.levelIntro) drawIntro(g, L, st.levelIntro);
}

// ---------- the board ----------
function drawCeiling(g, L, sc, st) {
  const s = L.s, mir = sc.mirror;
  if (st.game?.mode === 'endless' && st.game.timerOn) {
    // the slow timer: a fuse along the top
    const k = clamp(st.game.timer / st.timerMax, 0, 1);
    g.fillStyle = 'rgba(255,90,95,0.18)'; g.fillRect(L.x0, L.y0 - M * s * 0.3, W * s, s * 0.32);
    g.fillStyle = k < 0.25 ? C.red : C.honey; g.fillRect(L.x0, L.y0 - M * s * 0.3, W * s * k, s * 0.32);
  }
  if (mir.top <= 0 && !(sc.pushT >= 0 && st.game?.mode === 'level')) return;
  // the ceiling plate came down: a heavy slab with rivets
  const h = (rowY(mir.top) - 1 + sc.pushOff) * s;
  if (h <= 0) return;
  const x = L.panel.x, y = L.panel.y, w = L.panel.w, top = L.y0 - M * s;
  g.fillStyle = '#2a1a5c'; g.fillRect(x, top, w, h + M * s);
  g.fillStyle = 'rgba(139,102,255,0.25)';
  for (let i = -2; i < w / (s * 1.6) + 2; i++) {
    g.beginPath(); g.moveTo(x + i * s * 1.6, top + h + M * s); g.lineTo(x + i * s * 1.6 + s * 0.8, top + h + M * s); g.lineTo(x + i * s * 1.6 + s * 0.8 + h + M * s, top); g.lineTo(x + i * s * 1.6 + h + M * s, top); g.closePath(); g.fill();
  }
  g.fillStyle = INK; g.fillRect(x, L.y0 + h - s * 0.22, w, s * 0.34);
  g.fillStyle = C.lav2;
  for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(L.x0 + (1.5 + i * 3.8) * s, L.y0 + h - s * 0.6, s * 0.18, 0, Math.PI * 2); g.fill(); }
}
function drawSortRows(g, L, sc) {
  const s = L.s;
  const pulse = 0.5 + 0.5 * Math.sin(sc.t * 18);
  for (const r of sc.sortRows) {
    const y = L.uy(rowY(r) + sc.pushOff);
    const grd = g.createLinearGradient(L.x0, 0, L.x0 + W * s, 0);
    RAINBOW.forEach((c, i) => grd.addColorStop(i / 5, c));
    g.globalAlpha = 0.16 + pulse * 0.1;
    g.fillStyle = grd;
    g.fillRect(L.x0, y - s * 1.05, W * s, s * 2.1);
    g.globalAlpha = 1;
  }
}
function drawDeadline(g, L, st) {
  const s = L.s, y = L.uy(DEADLINE_Y);
  const danger = st.nervous;
  const pulse = danger ? 0.5 + 0.5 * Math.sin(st.t * 9) : 0;
  g.save();
  g.strokeStyle = danger ? `rgba(255,90,95,${0.55 + pulse * 0.45})` : 'rgba(205,184,255,0.4)';
  g.lineWidth = Math.max(1.5, s * (danger ? 0.2 : 0.13));
  g.setLineDash([s * 0.7, s * 0.55]);
  g.lineDashOffset = -st.t * s * (danger ? 3 : 0.8);
  g.beginPath(); g.moveTo(L.x0 + s * 0.3, y); g.lineTo(L.x0 + (W - 0.3) * s, y); g.stroke();
  g.restore();
  if (danger) {
    const grd = g.createLinearGradient(0, y - s * 3, 0, y);
    grd.addColorStop(0, 'rgba(255,90,95,0)'); grd.addColorStop(1, `rgba(255,90,95,${0.12 + pulse * 0.1})`);
    g.fillStyle = grd; g.fillRect(L.x0, y - s * 3, W * s, s * 3);
  }
}
function drawBubbles(g, L, sc, st) {
  const s = L.s, mir = sc.mirror, sheet = st.sheet;
  const W0 = mir.width.bind(mir);
  for (let r = 0; r < mir.rows.length; r++) {
    const row = mir.rows[r], w = W0(r), uy = rowY(r) + sc.pushOff;
    for (let c = 0; c < w; c++) {
      const x = row[c];
      if (!x) continue;
      let ux = mir.x(r, c), yy = uy, sc2 = 1;
      const wb = sc.wob.get(x.id);
      if (wb) { ux += wb.ox; yy += wb.oy; }
      const h = sc.hop.get(x.id);
      if (h) { const k = ease.inOutCubic(clamp(h.t / h.dur, 0, 1)); ux += h.dx * (1 - k); yy -= h.arc * Math.sin(Math.PI * k); sc2 = 1 + 0.12 * Math.sin(Math.PI * k); }
      if (x.k === MEMORY) sc2 *= 1 + 0.045 * Math.sin(st.t * 3.2 + c);
      stamp(g, sheet, x.k, L.ux(ux), L.uy(yy), sc2, x.hits);
    }
  }
  for (const p of sc.popping) {
    const k = p.t / 0.17;
    g.globalAlpha = Math.max(0, 1 - k);
    stamp(g, sheet, p.k, L.ux(p.x), L.uy(p.y + sc.pushOff), 1 + 0.45 * ease.outCubic(k));
  }
  g.globalAlpha = 1;
}

// ---------- the guide: dots on the true path, a ghost where it lands ----------
function drawGuide(g, L, st) {
  const s = L.s, path = st.guide, pts = path.points;
  const k = st.game?.loaded || 0;
  const gap = 1.15, start = 2.55;
  const phase = (st.t * 2.6) % gap;
  let along = 0, seg = 0;
  let dist = start + phase;
  const total = path.length;
  g.fillStyle = C.paper;
  while (dist < total - 0.9) {
    while (seg < pts.length - 1) {
      const a = pts[seg], b = pts[seg + 1], len = Math.hypot(b.x - a.x, b.y - a.y);
      if (along + len >= dist) break;
      along += len; seg++;
    }
    if (seg >= pts.length - 1) break;
    const a = pts[seg], b = pts[seg + 1], len = Math.hypot(b.x - a.x, b.y - a.y) || 1, f = (dist - along) / len;
    const x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f;
    const fade = seg >= 2 ? 0.55 : 0.95;
    g.globalAlpha = fade;
    g.beginPath(); g.arc(L.ux(x), L.uy(y), Math.max(1.6, s * (seg ? 0.17 : 0.2)), 0, Math.PI * 2); g.fill();
    dist += gap;
  }
  g.globalAlpha = 1;
  // where it lands
  const cell = path.cell, mir = st.game.board;
  const gx = L.ux(mir.x(cell.r, cell.c)), gy = L.uy(rowY(cell.r));
  if (k === SORT) {
    const rows = sortRowsFor(mir, cell.r);
    g.save();
    g.setLineDash([s * 0.5, s * 0.35]); g.lineDashOffset = -st.t * s * 2;
    g.strokeStyle = C.mint; g.lineWidth = Math.max(1.5, s * 0.14);
    for (const r of rows) { roundRectPath(g, L.x0 + s * 0.1, L.uy(rowY(r)) - s * 1.05, (W - 0.2) * s, s * 2.1, s); g.stroke(); }
    g.restore();
  } else if (k === BOMB) {
    g.fillStyle = 'rgba(255,90,95,0.18)';
    for (const [r, c] of around(mir, cell.r, cell.c, BOMB_RADIUS)) { g.beginPath(); g.arc(L.ux(mir.x(r, c)), L.uy(rowY(r)), s * 0.95, 0, Math.PI * 2); g.fill(); }
  }
  g.globalAlpha = 0.5;
  stamp(g, st.sheet, k, gx, gy, 0.96);
  g.globalAlpha = 1;
  g.save();
  g.strokeStyle = C.paper; g.lineWidth = Math.max(1.5, s * 0.12); g.setLineDash([s * 0.42, s * 0.3]); g.lineDashOffset = st.t * s * 1.5;
  g.beginPath(); g.arc(gx, gy, s * 1.08, 0, Math.PI * 2); g.stroke();
  g.restore();
}

// ---------- the launcher contraption ----------
function drawLauncher(g, L, sc, st) {
  const s = L.s, game = st.game;
  const lx = L.ux(LAUNCHER.x), ly = L.uy(LAUNCHER.y);
  const cy = L.uy(LAUNCHER.y + 1.05);
  // the console: a honey slab, its hard shadow
  const cx0 = L.ux(6.4), cw = 9.2 * s, ch = 1.75 * s;
  g.fillStyle = INK; roundRectPath(g, cx0 + s * 0.12, cy + s * 0.18, cw, ch, s * 0.6); g.fill();
  g.fillStyle = C.honey; roundRectPath(g, cx0, cy, cw, ch, s * 0.6); g.fill();
  g.strokeStyle = INK; g.lineWidth = Math.max(1.5, s * 0.14); g.stroke();
  // the meter (left): three charges toward a special
  const pipY = cy + ch * 0.55;
  if (game && game.specials.length) {
    for (let i = 0; i < 3; i++) {
      const x = L.ux(7.55 + i * 0.95), on = i < sc.meterShown;
      g.save(); g.translate(x, pipY); g.rotate(Math.PI / 4);
      g.fillStyle = on ? C.pink : C.paper;
      const d = s * (on ? 0.42 : 0.36);
      g.fillRect(-d, -d, d * 2, d * 2);
      g.strokeStyle = INK; g.lineWidth = Math.max(1, s * 0.1); g.strokeRect(-d, -d, d * 2, d * 2);
      g.restore();
    }
  }
  // the misses (right): when they're all lit, the stack comes down
  if (game) {
    const n = game.missLimit, used = sc.missShown;
    const gap = Math.min(0.74, 2.75 / Math.max(1, n - 1));
    for (let i = 0; i < n; i++) {
      const x = L.ux(12.3 + i * gap);
      const lit = i < used;
      const last = !lit && i === used && used === n - 1;
      const pr = s * 0.27 * (last ? 1 + 0.18 * Math.sin(st.t * 10) : 1);
      g.fillStyle = lit ? C.red : last ? '#ffd0d2' : C.paper;
      g.beginPath(); g.arc(x, pipY, pr, 0, Math.PI * 2); g.fill();
      g.strokeStyle = INK; g.lineWidth = Math.max(1, s * 0.1); g.stroke();
    }
  }
  // the dome
  g.fillStyle = INK; g.beginPath(); g.arc(lx + s * 0.1, cy + s * 0.12, s * 2.25, Math.PI, 0); g.fill();
  g.fillStyle = C.pink; g.beginPath(); g.arc(lx, cy, s * 2.2, Math.PI, 0); g.closePath(); g.fill();
  g.strokeStyle = INK; g.lineWidth = Math.max(1.5, s * 0.14); g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(lx, cy, s * 1.6, Math.PI * 1.15, Math.PI * 1.45); g.lineTo(lx, cy); g.closePath(); g.fill();
  // the barrel, along the aim
  const a = st.aim;
  g.save(); g.translate(lx, ly); g.rotate(-a);
  const bl = s * 3.25, bw = s * 1.3;
  g.fillStyle = INK; roundRectPath(g, -s * 0.2, -bw / 2 + s * 0.12, bl + s * 0.1, bw, bw * 0.45); g.fill();
  g.fillStyle = C.paper; roundRectPath(g, -s * 0.2, -bw / 2, bl, bw, bw * 0.45); g.fill();
  g.strokeStyle = INK; g.lineWidth = Math.max(1.5, s * 0.13); g.stroke();
  g.fillStyle = C.pink; g.fillRect(bl * 0.62, -bw / 2 + s * 0.08, s * 0.42, bw - s * 0.16);
  g.restore();
  // the loaded bubble (sliding in from the next spot)
  const shown = sc.shown;
  const k0 = shown[0];
  if (k0) {
    const e = ease.outBack(sc.reload);
    const fx = L.ux(NEXT_AT.x), fy = L.uy(NEXT_AT.y);
    const x = fx + (lx - fx) * e, y = fy + (ly - fy) * e - Math.sin(Math.PI * sc.reload) * s * 1.4;
    stamp(g, st.sheet, k0, x, y, 0.78 + 0.22 * Math.min(1, sc.reload));
    if (k0 >= SORT && sc.reload >= 1) drawSparkle(g, x, y, s, st.t);
  }
  // the next bubble on its plate, and the swap arrow
  const nx = L.ux(NEXT_AT.x), ny = L.uy(NEXT_AT.y);
  g.fillStyle = INK; g.beginPath(); g.arc(nx + s * 0.1, ny + s * 0.14, s * 1.22, 0, Math.PI * 2); g.fill();
  g.fillStyle = C.lav; g.beginPath(); g.arc(nx, ny, s * 1.22, 0, Math.PI * 2); g.fill();
  g.strokeStyle = INK; g.lineWidth = Math.max(1.5, s * 0.13); g.stroke();
  const k1 = shown[1];
  if (k1 && sc.swapT < 1) {
    // a swap: the old loaded bubble hops over to the plate
    const e = ease.outBack(sc.swapT);
    stamp(g, st.sheet, k1, lx + (nx - lx) * e, ly + (ny - ly) * e - Math.sin(Math.PI * sc.swapT) * s * 1.2, 1 - 0.2 * sc.swapT);
  } else if (k1 && sc.reload >= 1) {
    stamp(g, st.sheet, k1, nx, ny, 0.8);
    if (k1 >= SORT) drawSparkle(g, nx, ny, s * 0.8, st.t);
  } else if (!k1 && game && game.mode === 'level' && game.shotsLeft <= 1) {
    g.fillStyle = C.ink2; g.font = font(900, s * 0.9); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('–', nx, ny);
  }
  // the swap arrow (a curved hint between the two)
  if (k1 && game && game.status === 'play') {
    g.save();
    g.strokeStyle = 'rgba(228,217,255,0.75)'; g.lineWidth = Math.max(1.5, s * 0.15); g.lineCap = 'round';
    const ax = L.ux(14.2), ay = L.uy(LAUNCHER.y - 0.5);
    g.beginPath(); g.arc(ax, ay + s * 1.2, s * 1.35, Math.PI * 1.22, Math.PI * 1.78); g.stroke();
    const tx = ax - Math.cos(Math.PI * 0.22) * s * 1.35, ty = ay + s * 1.2 - Math.sin(Math.PI * 0.22) * s * 1.35;
    g.fillStyle = 'rgba(228,217,255,0.75)';
    g.beginPath(); g.moveTo(tx - s * 0.32, ty - s * 0.05); g.lineTo(tx + s * 0.12, ty - s * 0.4); g.lineTo(tx + s * 0.18, ty + s * 0.18); g.closePath(); g.fill();
    g.restore();
  }
  // a cancelled aim: the finger went back under the launcher
  if (st.cancel) {
    g.fillStyle = 'rgba(255,90,95,0.9)'; g.font = font(900, s * 0.62); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('LET GO TO CANCEL', lx, L.uy(DEADLINE_Y - 1.1));
  }
}
function drawSparkle(g, x, y, s, t) {
  g.save();
  g.fillStyle = C.paper; g.strokeStyle = INK; g.lineWidth = 1.2;
  for (let i = 0; i < 3; i++) {
    const a = t * 1.8 + (i / 3) * Math.PI * 2, r = s * 1.25;
    const k = 0.5 + 0.5 * Math.sin(t * 6 + i * 2);
    starPath(g, x + Math.cos(a) * r, y + Math.sin(a) * r, s * 0.32 * (0.6 + k * 0.6), s * 0.11, 4, a);
    g.fill(); g.stroke();
  }
  g.restore();
}
function drawFlying(g, L, sc, st) {
  const f = sc.flying, s = L.s;
  const tr = sc.trail;
  for (let i = 0; i < tr.length; i += 2) {
    const k = i / tr.length;
    g.globalAlpha = k * 0.35;
    g.fillStyle = fillOf(f.k);
    g.beginPath(); g.arc(L.ux(tr[i]), L.uy(tr[i + 1]), s * (0.35 + k * 0.5), 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
  // a little stretch along its way
  const sp = Math.hypot(f.vx, f.vy);
  g.save();
  g.translate(L.ux(f.x), L.uy(f.y));
  if (sp > 0.01) { g.rotate(Math.atan2(f.vy, f.vx)); g.scale(1.1, 0.92); g.rotate(-Math.atan2(f.vy, f.vx)); }
  stamp(g, st.sheet, f.k, 0, 0, 1);
  g.restore();
}
function drawFalling(g, L, sc, st) {
  for (const f of sc.falling) {
    if (f.delay > 0) {
      stamp(g, st.sheet, f.k, L.ux(f.x), L.uy(f.y + sc.pushOff), 1);
      continue;
    }
    const a = f.up ? Math.max(0, Math.min(1, (f.y + 2) / 6)) : f.y > FIELD_H - 1 ? Math.max(0, 1 - (f.y - FIELD_H + 1) / 5) : 1;
    if (a <= 0) continue;
    g.globalAlpha = a;
    g.save(); g.translate(L.ux(f.x), L.uy(f.y)); g.rotate(f.rot);
    stamp(g, st.sheet, f.k, 0, 0, f.up ? 1.1 : 1, f.hits);
    g.restore();
  }
  g.globalAlpha = 1;
}

// ---------- AGI-1 ----------
function drawFace(g, L, sc, st) {
  const f = L.face, img = st.face;
  const hop = st.faceHop > 0 ? Math.sin(Math.min(1, st.faceHop) * Math.PI) * f.r * 0.28 : 0;
  const shake = st.nervous ? Math.sin(st.t * 40) * f.r * 0.05 : 0;
  const x = f.x + shake, y = f.y - hop;
  g.fillStyle = INK; g.beginPath(); g.arc(x + f.r * 0.07, y + f.r * 0.1, f.r, 0, Math.PI * 2); g.fill();
  g.fillStyle = st.nervous ? '#ffd0d2' : C.lav; g.beginPath(); g.arc(x, y, f.r, 0, Math.PI * 2); g.fill();
  g.save(); g.beginPath(); g.arc(x, y, f.r * 0.9, 0, Math.PI * 2); g.clip();
  g.drawImage(img, x - f.r * 0.92, y - f.r * 0.92, f.r * 1.84, f.r * 1.84);
  g.restore();
  g.strokeStyle = INK; g.lineWidth = Math.max(1.5, f.r * 0.1); g.beginPath(); g.arc(x, y, f.r, 0, Math.PI * 2); g.stroke();
}
function drawBust(g, L, st) {
  const b = L.bust, img = st.bust;
  const bob = Math.sin(st.t * 1.6) * b.h * 0.006;
  const hop = st.faceHop > 0 ? Math.sin(Math.min(1, st.faceHop) * Math.PI) * b.h * 0.035 : 0;
  const shake = st.nervous ? Math.sin(st.t * 32) * b.w * 0.006 : 0;
  g.save();
  g.translate(b.x + b.w * 0.5 + shake, b.y + b.h + bob - hop);
  g.rotate(0.07);
  // a soft lavender halo behind her
  const grd = g.createRadialGradient(0, -b.h * 0.55, b.w * 0.1, 0, -b.h * 0.55, b.w * 0.75);
  grd.addColorStop(0, 'rgba(139,102,255,0.32)'); grd.addColorStop(1, 'rgba(139,102,255,0)');
  g.fillStyle = grd; g.fillRect(-b.w, -b.h * 1.3, b.w * 2, b.h * 1.3);
  g.drawImage(img, -b.w / 2, -b.h, b.w, b.h);
  g.restore();
}

// ---------- the header (a phone held up) and the side card (wider screens) ----------
function goalText(game) {
  if (!game) return '';
  if (game.mode === 'endless') return 'Infinite context';
  return game.goal === 'memories' ? 'Free 3 memories' : 'Clear the board';
}
function drawHearts(g, x, y, size, freed, total) {
  for (let i = 0; i < total; i++) {
    const cx = x + i * size * 1.25;
    g.fillStyle = INK; g.beginPath(); g.arc(cx + size * 0.05, y + size * 0.07, size * 0.55, 0, Math.PI * 2); g.fill();
    g.fillStyle = i < freed ? C.honey : C.lav; g.beginPath(); g.arc(cx, y, size * 0.55, 0, Math.PI * 2); g.fill();
    g.strokeStyle = INK; g.lineWidth = Math.max(1, size * 0.1); g.stroke();
    g.save(); g.translate(cx, y);
    g.fillStyle = i < freed ? C.pink : '#b9a8e8';
    g.beginPath(); g.moveTo(0, size * 0.28); g.bezierCurveTo(-size * 0.42, 0, -size * 0.33, -size * 0.36, 0, -size * 0.13); g.bezierCurveTo(size * 0.33, -size * 0.36, size * 0.42, 0, 0, size * 0.28); g.fill();
    g.restore();
  }
}
function drawHeader(g, L, sc, st) {
  const hd = L.header, game = st.game;
  if (!game || st.mode === 'title') return;
  const r = Math.min(18, hd.h * 0.4);
  g.fillStyle = INK; roundRectPath(g, hd.x + 4, hd.y + 5, hd.w, hd.h, r); g.fill();
  g.fillStyle = C.paper; roundRectPath(g, hd.x, hd.y, hd.w, hd.h, r); g.fill();
  g.strokeStyle = INK; g.lineWidth = 2.5; g.stroke();
  const pad = hd.h * 0.18;
  // the badge: the level's number (∞ for Endless)
  const br = hd.h * 0.34, bx = hd.x + pad + br, by = hd.y + hd.h / 2;
  g.fillStyle = game.mode === 'endless' ? C.mint : C.honey;
  g.beginPath(); g.arc(bx, by, br, 0, Math.PI * 2); g.fill();
  g.strokeStyle = INK; g.lineWidth = 2.5; g.stroke();
  g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = font(900, br * (game.mode === 'endless' ? 1.25 : String(st.def?.n || '').length > 1 ? 0.95 : 1.15));
  g.fillText(game.mode === 'endless' ? '∞' : String(st.def.n), bx, by + 1);
  // its name and its goal
  const tx = bx + br + pad * 0.9;
  const right = hd.x + hd.w - pad;
  const widgetW = game.mode === 'level' && game.goal === 'memories' ? hd.h * 0.42 * 1.25 * 3 : hd.h * 1.55;
  const maxText = right - widgetW - tx - pad * 0.5;
  g.textAlign = 'left';
  g.font = font(900, hd.h * 0.27);
  const title = (game.mode === 'endless' ? 'ENDLESS' : st.def.name.toUpperCase());
  fitText(g, title, tx, by - hd.h * 0.13, maxText, hd.h * 0.27);
  g.fillStyle = C.ink2; g.font = font(700, hd.h * 0.2, MONO);
  fitText(g, goalText(game), tx, by + hd.h * 0.2, maxText, hd.h * 0.2, MONO, 700);
  // the goal's progress
  g.textAlign = 'right';
  if (game.mode === 'level' && game.goal === 'memories') drawHearts(g, right - hd.h * 0.42 * 1.25 * 2 - hd.h * 0.21, by, hd.h * 0.42, game.freed, game.memTotal);
  else {
    const n = game.mode === 'endless' ? game.rows : sc.mirror.count();
    g.fillStyle = INK; g.font = font(800, hd.h * 0.34, MONO); g.fillText(fmt(n), right, by - hd.h * 0.06);
    g.fillStyle = C.ink2; g.font = font(850, hd.h * 0.15); g.fillText(game.mode === 'endless' ? 'ROWS IN' : 'BUBBLES LEFT', right, by + hd.h * 0.25);
  }
}
function fitText(g, text, x, y, maxW, size, fam = DISPLAY, weight = 900) {
  let px = size;
  g.font = font(weight, px, fam);
  while (px > 7 && g.measureText(text).width > maxW) { px -= 1; g.font = font(weight, px, fam); }
  g.fillText(text, x, y);
}
function drawSide(g, L, sc, st) {
  const sd = L.side, game = st.game;
  if (!game || st.mode === 'title' || st.mode === 'demo') return;
  const w = sd.w, pad = 16;
  const rows = [];
  const lines = game.mode === 'endless' ? 4 : 5;
  const h = 70 + lines * 44;
  g.fillStyle = INK; roundRectPath(g, sd.x + 6, sd.y + 7, w, h, 22); g.fill();
  g.fillStyle = C.paper; roundRectPath(g, sd.x, sd.y, w, h, 22); g.fill();
  g.strokeStyle = INK; g.lineWidth = 3; g.stroke();
  let y = sd.y + pad + 8;
  g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillStyle = C.violet; g.font = font(900, 11);
  g.fillText(game.mode === 'endless' ? 'INFINITE CONTEXT' : `MEMORY BANK ${st.def.bank} · LEVEL ${st.def.n}`, sd.x + pad, y);
  y += 26;
  g.fillStyle = INK;
  fitText(g, game.mode === 'endless' ? 'ENDLESS' : st.def.name.toUpperCase(), sd.x + pad, y, w - pad * 2, 24);
  y += 34;
  const row = (label, value, extra) => {
    g.fillStyle = C.lav; roundRectPath(g, sd.x + pad, y - 17, w - pad * 2, 36, 12); g.fill();
    g.strokeStyle = INK; g.lineWidth = 2; g.stroke();
    g.fillStyle = C.ink2; g.font = font(850, 10.5); g.textAlign = 'left'; g.fillText(label, sd.x + pad + 12, y + 1);
    if (extra) extra(sd.x + w - pad - 12, y);
    else { g.fillStyle = INK; g.font = font(800, 17, MONO); g.textAlign = 'right'; g.fillText(value, sd.x + w - pad - 12, y + 1); }
    y += 44;
  };
  if (game.mode === 'level') {
    row(game.goal === 'memories' ? 'MEMORIES' : 'BUBBLES LEFT', fmt(sc.mirror.count()), game.goal === 'memories' ? (x, yy) => drawHearts(g, x - 16 * 1.25 * 2 - 8, yy, 16, game.freed, game.memTotal) : null);
    row('SHOTS LEFT', fmt(game.shotsLeft));
    row('★★★ AT', `${st.def.stars[1]} left`);
    row('SCORE', fmt(game.score));
    row('BEST COMBO', `×${game.stats.bestCombo}`);
  } else {
    row('SCORE', fmt(game.score));
    row('ROWS IN', fmt(game.rows));
    row('NEXT ROW', game.timerOn ? `${Math.ceil(game.timer)}s` : `${game.missLimit - game.misses} misses`);
    row('BEST', st.best ? fmt(st.best) : '—');
  }
}

// ---------- banners: SORTED!, BIG DROP!, a level's start ----------
function drawBanner(g, L, b) {
  const s = L.s;
  const t = b.t / b.dur;
  const pop = t < 0.18 ? ease.outBack(t / 0.18) : 1;
  const a = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
  const x = L.ux(W / 2), y = L.uy(FIELD_H * 0.42);
  g.save();
  g.globalAlpha = Math.max(0, a);
  g.translate(x, y); g.scale(pop, pop); g.rotate(-0.05);
  const size = Math.min(s * 2.7 * b.big, L.panel.w / Math.max(5, b.text.length) * 1.45);
  g.font = font(900, size);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = size * 0.22; g.strokeStyle = INK;
  g.strokeText(b.text, size * 0.04, size * 0.1);
  g.strokeText(b.text, 0, 0);
  g.fillStyle = b.tone; g.fillText(b.text, 0, 0);
  if (b.sub) {
    g.font = font(850, size * 0.36);
    g.lineWidth = size * 0.12; g.strokeText(b.sub.toUpperCase(), 0, size * 0.78);
    g.fillStyle = C.paper; g.fillText(b.sub.toUpperCase(), 0, size * 0.78);
  }
  g.restore();
}
function drawIntro(g, L, it) {
  const s = L.s;
  const t = it.t / it.dur;
  if (t >= 1) return;
  const inK = t < 0.15 ? ease.outBack(t / 0.15) : 1;
  const a = t > 0.8 ? 1 - (t - 0.8) / 0.2 : 1;
  const cx = L.ux(W / 2), cy = L.uy(FIELD_H * 0.55);
  const w = Math.min(L.panel.w * 0.86, s * 18), h = s * 5.6;
  g.save();
  g.globalAlpha = Math.max(0, a);
  g.translate(cx, cy); g.scale(inK, inK); g.rotate(-0.025);
  g.fillStyle = INK; roundRectPath(g, -w / 2 + s * 0.25, -h / 2 + s * 0.32, w, h, s * 1.1); g.fill();
  g.fillStyle = C.paper; roundRectPath(g, -w / 2, -h / 2, w, h, s * 1.1); g.fill();
  g.strokeStyle = INK; g.lineWidth = Math.max(2, s * 0.16); g.stroke();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = C.violet; g.font = font(900, s * 0.62); g.fillText(it.kicker, 0, -h * 0.3);
  g.fillStyle = INK; fitText(g, it.title, 0, -h * 0.02, w - s * 1.4, s * 1.35);
  g.fillStyle = C.ink2; g.font = font(700, s * 0.66, MONO); g.fillText(it.sub, 0, h * 0.29);
  g.restore();
}
