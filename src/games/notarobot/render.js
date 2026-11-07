// I'M NOT A ROBOT: the screen. A deep blue desk with doodles drifting by (faster with the tempo); on it the browser
// window that each check arrives in (paper, ink, a hard shadow, three dots, an address bar that reads
// human-check://gate-07, a burning fuse for the time left); the command slamming in; the VERIFIED / ROBOTIC stamp; the
// suspicion lights, the score and the tempo; AGI-1 watching from her corner in a cardboard mustache, saying things.
// Everything is drawn on one canvas from the run's state (run.js) and a few moments of its own (when a stamp landed…).
import { ease, clamp, lerp, TAU } from '../kit/fx.js';
import { REDUCED } from '../kit/env.js';
import { INK, LW, C, DISPLAY, MONO, SERIF, font, sticker, words, rr, inked, circle, check, cross, hand, moustache, arrowCursor } from './art.js';
import { W, H } from './checks/util.js';
import { commandOf, keysOf } from './checks/index.js';
import { bpmFor } from './tempo.js';

// a quick pulse on every beat of the soundtrack (1 on the beat, gone a quarter-beat later)
export const beatOf = (t, tempo) => (REDUCED ? 0 : Math.max(0, 1 - ((t * bpmFor(tempo)) / 60 % 1) * 4));

export const CHROME = 46;
export const WIN_W = W;
export const WIN_H = H + CHROME;
const pad2 = (n) => String(n).padStart(2, '0');

// ---------- the layout: where the window, the numbers, the command and AGI-1 go ----------
export function layout(w, h, ins, { demo = false } = {}) {
  const top = ins.top, bottom = ins.bottom, left = ins.left, right = ins.right;
  const aw = w - left - right, ah = h - top - bottom;
  const ratio = ah / Math.max(1, aw);
  const L = { w, h };
  const mode = ratio >= 1.18 ? 'tall' : aw / Math.max(1, ah) >= 1.3 && !demo ? 'wide' : 'compact';
  L.mode = mode;
  if (mode === 'tall') {
    // (the preview has no bar to clear and no time to read her: slimmer rows, a bigger window)
    const hudH = demo ? clamp(aw * 0.11, 40, 56) : clamp(aw * 0.155, 48, 74);
    const cmdH = demo ? clamp(aw * 0.13, 40, 64) : clamp(aw * 0.16, 46, 84);
    const agiH = demo ? clamp(ah * 0.1, 52, 76) : clamp(ah * 0.15, 64, 140);
    const side = clamp(aw * 0.03, 10, 28);
    const availH = ah - hudH - cmdH - agiH - 26;
    const s = Math.min((aw - side * 2) / WIN_W, availH / WIN_H, 2);
    const ww = WIN_W * s, wh = WIN_H * s;
    const group = cmdH + 8 + wh + 12 + agiH;
    const y0 = top + hudH + 6 + Math.max(0, (ah - hudH - 6 - group) / 2);
    L.hud = { kind: 'row', x: left + side, y: top, w: aw - side * 2, h: hudH };
    L.cmd = { x: left + aw / 2, y: y0 + cmdH / 2, size: clamp(cmdH * 0.6, 26, 52), maxW: aw - side * 2, lines: 1 };
    L.win = { x: left + (aw - ww) / 2, y: y0 + cmdH + 8, s, w: ww, h: wh };
    const ar = clamp(agiH * 0.4, 26, 56);
    L.agi = { x: left + side + ar + 2, y: L.win.y + wh + 12 + agiH / 2, r: ar, bx: left + side + ar * 2 + 18, bw: aw - side * 2 - ar * 2 - 22, side: 'right' };
  } else if (mode === 'wide') {
    // (a big monitor: everything grows with the window, not just the window)
    const ui = clamp(ah / 760, 0.8, 1.9);
    const colW = clamp(aw * 0.22, 150, 330 * ui);
    const s = Math.min((ah - 12) / WIN_H, (aw - colW * 2 - 28) / WIN_W, 2.6);
    const ww = WIN_W * s, wh = WIN_H * s;
    const wx = left + (aw - ww) / 2, wy = top + (ah - wh) / 2;
    L.win = { x: wx, y: wy, s, w: ww, h: wh };
    L.ui = ui;
    const lw = wx - left - 24;
    const rx = wx + ww + 18, rw = left + aw - rx - 10;
    L.hud = { kind: 'col', x: left + 12, y: wy + 4, w: lw, h: wh * 0.62, ui };
    L.cmd = { x: rx + rw / 2, y: wy + Math.min(wh * 0.22, 90 * ui), size: clamp(rw * 0.15, 22, 50 * ui), maxW: rw - 8, lines: 2 };
    const ar = clamp(Math.min(rw, wh) * 0.17, 24, 50 * ui);
    L.agi = { x: rx + ar + 4, y: wy + wh - ar - 6, r: ar, bx: rx, bw: rw, side: 'up' };
  } else {
    const hudH = clamp(Math.min(aw, ah) * 0.085, 32, 54);
    const availH = ah - hudH - 10;
    const s = Math.min((aw - 12) / WIN_W, availH / WIN_H, 2);
    const ww = WIN_W * s, wh = WIN_H * s;
    const wy = top + hudH + 8 + Math.max(0, (availH - 2 - wh) / 2);
    L.win = { x: left + (aw - ww) / 2, y: wy, s, w: ww, h: wh };
    L.hud = { kind: 'row', x: left + 6, y: top, w: aw - 12, h: hudH };
    L.cmd = { x: left + aw / 2, y: wy + 1, size: clamp(ww * 0.065, 18, 40), maxW: ww * 0.62, lines: 1, edge: true };
    const ar = clamp(ww * 0.06, 18, 40);
    L.agi = { x: L.win.x + ar * 0.7, y: wy + wh - ar * 0.6, r: ar, bx: L.win.x + ar * 2 + 6, bw: ww * 0.6, side: 'right', small: true };
  }
  return L;
}

// ---------- the desk's doodles: one tile, drawn once, scrolled ----------
function doodleTile(dpr) {
  const S = 240;
  const c = document.createElement('canvas');
  c.width = Math.round(S * dpr); c.height = Math.round(S * dpr);
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  const ink = '#26407a', fill = '#172b55';
  g.lineJoin = 'round'; g.lineCap = 'round';
  const stroke = (lw = 2.2) => { g.lineWidth = lw; g.strokeStyle = ink; g.stroke(); };
  const at = (x, y, r, fn) => { g.save(); g.translate(x, y); g.rotate(r); fn(); g.restore(); };
  // an arrow cursor, a checkmark, a checkbox, a star, a squiggle, a little circle, a tiny window
  at(34, 40, -0.3, () => { g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 22); g.lineTo(5.5, 17); g.lineTo(9.5, 26); g.lineTo(13.5, 24); g.lineTo(9.5, 15.5); g.lineTo(16, 15.5); g.closePath(); g.fillStyle = fill; g.fill(); stroke(); });
  at(150, 34, 0.2, () => { g.beginPath(); g.moveTo(-10, 0); g.lineTo(-3, 8); g.lineTo(12, -9); stroke(4); });
  at(200, 120, -0.15, () => { rr(g, -11, -11, 22, 22, 5); g.fillStyle = fill; g.fill(); stroke(); g.beginPath(); g.moveTo(-5, 0); g.lineTo(-1, 4); g.lineTo(6, -5); stroke(2.6); });
  at(90, 120, 0.4, () => { g.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 4.5 : 10, a = (i / 10) * TAU - Math.PI / 2; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fillStyle = fill; g.fill(); stroke(2); });
  at(40, 190, 0, () => { g.beginPath(); g.moveTo(-14, 0); g.bezierCurveTo(-7, -10, -2, 10, 5, 0); g.bezierCurveTo(9, -6, 13, 4, 16, -2); stroke(2.4); });
  at(160, 200, 0.1, () => { rr(g, -18, -13, 36, 26, 5); g.fillStyle = fill; g.fill(); stroke(); g.beginPath(); g.moveTo(-18, -5); g.lineTo(18, -5); stroke(2); for (const x of [-13, -8, -3]) { g.beginPath(); g.arc(x, -9, 1.4, 0, TAU); g.fillStyle = ink; g.fill(); } });
  at(220, 60, 0, () => { g.beginPath(); g.arc(0, 0, 6, 0, TAU); stroke(2.2); });
  at(110, 70, -0.6, () => { g.beginPath(); g.moveTo(-6, -6); g.lineTo(6, 6); g.moveTo(6, -6); g.lineTo(-6, 6); stroke(2.6); });
  at(100, 235, 0.3, () => { g.beginPath(); g.moveTo(-8, 0); g.lineTo(-2, 6); g.lineTo(9, -6); stroke(3.2); });
  return { c, S };
}

export function createRenderer() {
  let tile = null, tileDpr = 0, vign = null, vignKey = '';
  const R = {
    moments: { stampAt: -9, failAt: -9, lightAt: -9, lightIdx: -1, tempoAt: -9, bossAt: -9, caughtAt: -9, scoreAt: -9, repairAt: -9, stepAt: -9, slipAt: -9 },
    scroll: 0,
    say: null,          // { text, at, dur }
  };

  function background(g, L, dpr, t, speed) {
    g.fillStyle = C.desk;
    g.fillRect(0, 0, L.w, L.h);
    if (!tile || tileDpr !== dpr) { tile = doodleTile(dpr); tileDpr = dpr; }
    R.scroll += speed;
    const S = tile.S, off = R.scroll % S;
    for (let y = -S + off; y < L.h; y += S) for (let x = -S + off * 0.6; x < L.w; x += S) g.drawImage(tile.c, x, y, S, S);
    const key = `${L.w}x${L.h}x${dpr}`;
    if (vignKey !== key) {
      vignKey = key;
      vign = document.createElement('canvas');
      vign.width = Math.max(1, Math.round(L.w * dpr / 2)); vign.height = Math.max(1, Math.round(L.h * dpr / 2));
      const v = vign.getContext('2d');
      const gr = v.createRadialGradient(vign.width / 2, vign.height * 0.45, Math.min(vign.width, vign.height) * 0.2, vign.width / 2, vign.height / 2, Math.max(vign.width, vign.height) * 0.75);
      gr.addColorStop(0, 'rgba(8,14,32,0)'); gr.addColorStop(1, 'rgba(8,14,32,0.62)');
      v.fillStyle = gr; v.fillRect(0, 0, vign.width, vign.height);
    }
    g.drawImage(vign, 0, 0, L.w, L.h);
  }

  // ---------- the window ----------
  function chrome(g, run, boss, t) {
    // title bar
    g.save();
    rr(g, 0, 0, WIN_W, WIN_H, 18); g.clip();
    g.fillStyle = boss ? '#ffc2dc' : C.lav;
    g.fillRect(0, 0, WIN_W, CHROME);
    g.restore();
    g.beginPath(); g.moveTo(0, CHROME); g.lineTo(WIN_W, CHROME); g.lineWidth = LW; g.strokeStyle = INK; g.stroke();
    const dots = [C.pink, C.honey, C.mint];
    for (let i = 0; i < 3; i++) { circle(g, 20 + i * 19, CHROME / 2 - 2, 6.2); inked(g, dots[i], LW * 0.8); }
    // the address bar
    const ax = 80, aw = WIN_W - ax - 14, ay = 9, ah = 24;
    rr(g, ax, ay, aw, ah, 12); inked(g, C.white, LW * 0.8);
    // a little padlock
    rr(g, ax + 10, ay + 10, 10, 8, 2); g.fillStyle = boss ? C.pink : C.violet; g.fill();
    g.beginPath(); g.arc(ax + 15, ay + 10, 3.2, Math.PI, 0); g.lineWidth = 1.8; g.strokeStyle = boss ? C.pink : C.violet; g.stroke();
    font(g, 650, 12.5, MONO);
    g.textAlign = 'left'; g.textBaseline = 'middle';
    const addr = boss ? `human-check://final-${run.boss ? run.boss.idx + 1 : 3}of3` : `human-check://gate-${pad2(run.played)}`;
    g.fillStyle = C.ink2; g.fillText(addr, ax + 27, ay + ah / 2 + 1);
  }
  function fuse(g, left, t, hot, boss) {
    const x0 = 12, x1 = WIN_W - 12, y = CHROME + 1;
    const xs = lerp(x0, x1, 1 - left);
    // the burnt part, then the rope that's left
    g.lineCap = 'round';
    g.beginPath(); g.moveTo(x0, y); g.lineTo(xs, y); g.lineWidth = 2; g.strokeStyle = 'rgba(23,10,54,.22)'; g.stroke();
    if (left > 0.002) {
      g.beginPath(); g.moveTo(xs, y); g.lineTo(x1, y); g.lineWidth = 9; g.strokeStyle = INK; g.stroke();
      g.beginPath(); g.moveTo(xs, y); g.lineTo(x1, y); g.lineWidth = 5.2; g.strokeStyle = hot ? '#ff8fb8' : boss ? C.pink : '#e0a35c'; g.stroke();
      g.save(); g.setLineDash([3, 5]); g.lineDashOffset = -t * 30;
      g.beginPath(); g.moveTo(xs, y); g.lineTo(x1, y); g.lineWidth = 1.6; g.strokeStyle = 'rgba(23,10,54,.45)'; g.stroke(); g.restore();
      // the spark
      const r = (hot ? 13 : 10) + Math.sin(t * 40) * 1.8;
      g.save(); g.translate(xs, y); g.rotate(t * 9);
      g.beginPath();
      for (let i = 0; i < 16; i++) { const rr2 = i % 2 ? r * 0.45 : r; const a = (i / 16) * TAU; g.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2); }
      g.closePath(); g.fillStyle = C.honey; g.fill(); g.lineWidth = 1.6; g.strokeStyle = INK; g.stroke();
      circle(g, 0, 0, r * 0.32); g.fillStyle = C.white; g.fill();
      g.restore();
    }
  }

  function stamp(g, run, t) {
    const last = run.last;
    if (!last) return;
    const k = clamp((t - R.moments.stampAt) / 0.17, 0, 1);
    const sc = k < 1 ? lerp(2.3, 1, ease.inCubic(k)) : 1 + Math.sin(clamp((t - R.moments.stampAt - 0.17) / 0.2, 0, 1) * Math.PI) * -0.05;
    const a = k < 1 ? 0.3 + k * 0.7 : 1;
    const pass = last.pass;
    g.save();
    g.globalAlpha = a;
    g.translate(W / 2, H / 2 + CHROME - 4);
    g.rotate(pass ? -0.12 : 0.09);
    g.scale(sc, sc);
    const bw = 316, bh = last.boss && pass ? 128 : 112;
    rr(g, -bw / 2 + 4, -bh / 2 + 7, bw, bh, 18); g.fillStyle = INK; g.fill();
    rr(g, -bw / 2, -bh / 2, bw, bh, 18); inked(g, pass ? C.mint : C.pink, LW * 1.5);
    rr(g, -bw / 2 + 8, -bh / 2 + 8, bw - 16, bh - 16, 12); g.lineWidth = LW * 0.8; g.strokeStyle = INK; g.stroke();
    if (pass) {
      circle(g, -bw / 2 + 44, -6, 24); inked(g, C.white, LW);
      check(g, -bw / 2 + 45, -5, 32, C.mint);
      sticker(g, last.boss ? 'HUMAN' : 'VERIFIED', 30, -24, 34, C.white, { shadow: 0.06, maxW: bw - 110 });
      sticker(g, last.boss ? 'CONFIRMED' : 'HUMAN', 30, 12, 34, C.white, { shadow: 0.06, maxW: bw - 110 });
      font(g, 400, 19, SERIF); g.font = `italic 400 19px ${SERIF}`;
      g.textAlign = 'center'; g.fillStyle = INK; g.fillText(last.boss ? '(definitely… probably)' : '(probably)', 30, 40);
    } else {
      circle(g, -bw / 2 + 44, -4, 24); inked(g, C.white, LW);
      cross(g, -bw / 2 + 44, -4, 30, C.pink);
      sticker(g, 'BEEP.', 30, -22, 40, C.white, { shadow: 0.06 });
      font(g, 900, 15, DISPLAY, 'expanded');
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = INK;
      g.fillText('SUSPICIOUSLY', 30, 14); g.fillText('ROBOTIC', 30, 32);
    }
    g.restore();
    // the points, under it
    if (pass && k >= 1) {
      const k2 = clamp((t - R.moments.stampAt - 0.16) / 0.22, 0, 1);
      const y = H / 2 + CHROME + 76 + (1 - ease.outBack(k2)) * 20;
      g.save(); g.globalAlpha = k2;
      // +10, the speed bonus, and the streak once it's going (×3 and up)
      const pills = [[`+${10}`, C.white]];
      if (last.bonus) pills.push([`${last.label} +${last.bonus}`, C.honey]);
      if (run.streak >= 3 && !last.boss) pills.push([`STREAK ×${run.streak}`, run.streak >= 10 ? C.pink : C.lav2]);
      font(g, 900, 16, DISPLAY, 'expanded');
      const ws = pills.map(([txt]) => g.measureText(txt).width + 22);
      const tw = ws.reduce((a, b) => a + b, 0) + (pills.length - 1) * 7;
      const sc2 = Math.min(1, (W - 20) / tw);
      g.save();
      g.translate(W / 2, y); g.scale(sc2, sc2);
      let x = -tw / 2;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      pills.forEach(([txt, fill], i) => { rr(g, x, -15, ws[i], 30, 15); inked(g, fill, LW); g.fillStyle = INK; g.fillText(txt, x + ws[i] / 2, 1); x += ws[i] + 7; });
      g.restore();
      g.restore();
    }
  }

  // the check's window, in its own units (the caller moved it into place)
  function windowBody(g, run, v, t) {
    const c = run.cur;
    const boss = Boolean(run.boss) || (c && c.boss);
    rr(g, 7, 10, WIN_W, WIN_H, 18); g.fillStyle = INK; g.fill();
    rr(g, 0, 0, WIN_W, WIN_H, 18); g.fillStyle = C.paper; g.fill();
    if (c) {
      g.save();
      rr(g, 0, CHROME, WIN_W, H, 18); g.rect(0, CHROME, WIN_W, 20); g.clip();
      g.translate(0, CHROME);
      g.fillStyle = c.def.bg || C.paper; g.fillRect(0, 0, W, H);
      c.def.draw(g, c.st, v);
      // the bumper's dim, so the command reads
      if (v.dim > 0) { g.fillStyle = `rgba(15,29,58,${0.5 * v.dim})`; g.fillRect(0, 0, W, H); }
      if (v.red > 0) { g.fillStyle = `rgba(255,77,166,${0.26 * v.red})`; g.fillRect(0, 0, W, H); }
      g.restore();
    }
    chrome(g, run, boss, t);
    rr(g, 0, 0, WIN_W, WIN_H, 18); g.lineWidth = LW * 1.3; g.strokeStyle = INK; g.stroke();
    fuse(g, v.fuse, t, v.fuse < 0.28 && v.fuse > 0, boss);
  }

  // ---------- the numbers (suspicion lights, score, tempo) ----------
  function lamp(g, x, y, r, on, t, fresh) {
    if (on && fresh > 0) {
      const k = 1 - fresh;
      circle(g, x, y, r * (1.2 + k * 1.4)); g.lineWidth = 3 * fresh; g.strokeStyle = `rgba(255,90,110,${fresh})`; g.stroke();
    }
    const s = on && fresh > 0 ? 1 + Math.sin(fresh * Math.PI) * 0.45 : 1;
    circle(g, x + 1, y + 3, r * s); g.fillStyle = INK; g.fill();
    circle(g, x, y, r * s); inked(g, on ? '#ff4d6d' : '#22355f', LW * 0.9);
    if (on) { circle(g, x - r * 0.3, y - r * 0.3, r * 0.26); g.fillStyle = 'rgba(255,255,255,.75)'; g.fill(); }
    else { circle(g, x, y, r * 0.62); g.fillStyle = '#1a2a4d'; g.fill(); circle(g, x - r * 0.28, y - r * 0.3, r * 0.16); g.fillStyle = 'rgba(255,255,255,.22)'; g.fill(); }
  }
  function label(g, text, x, y, size, color = '#9fb3e6', align = 'left') {
    font(g, 900, size, DISPLAY, 'expanded');
    g.textAlign = align; g.textBaseline = 'middle'; g.fillStyle = color;
    g.fillText(text, x, y);
  }
  function hud(g, L, run, t, shown) {
    const H2 = L.hud, m = R.moments;
    const sus = run.sus;
    const lit = (i) => i < sus;
    const fresh = (i) => (i === m.lightIdx ? clamp(1 - (t - m.lightAt) / 0.8, 0, 1) : 0);
    const sp = clamp((t - m.scoreAt) / 0.3, 0, 1), pop = sp < 1 ? 1 + Math.sin(sp * Math.PI) * 0.22 : 1;
    if (H2.kind === 'row') {
      const h = H2.h, r = clamp(h * 0.2, 7, 13), cy = H2.y + h * 0.58;
      label(g, 'SUSPICION', H2.x, H2.y + h * 0.16, clamp(h * 0.17, 8, 11));
      for (let i = 0; i < 4; i++) lamp(g, H2.x + r + 2 + i * (r * 2 + clamp(h * 0.12, 4, 9)), cy, r, lit(i), t, fresh(i));
      // the score in the middle
      const sx = H2.x + H2.w / 2;
      label(g, 'HUMAN SCORE', sx, H2.y + h * 0.16, clamp(h * 0.17, 8, 11), '#9fb3e6', 'center');
      g.save(); g.translate(sx, cy + 1); g.scale(pop, pop);
      sticker(g, String(shown), 0, 0, clamp(h * 0.5, 20, 34), C.paper, { shadow: 0.08 });
      g.restore();
      // the tempo on the right
      const tx = H2.x + H2.w;
      label(g, 'TEMPO', tx, H2.y + h * 0.16, clamp(h * 0.17, 8, 11), '#9fb3e6', 'right');
      tempoBadge(g, tx, cy, clamp(h * 0.42, 15, 28), run.tempo, t, 'right');
    } else {
      // a column: score, then the lights, then the tempo
      const x = H2.x, w = H2.w, u = H2.ui || 1;
      const big = clamp(w * 0.2, 26, 54 * u), lab = clamp(w * 0.06, 9, 13 * u);
      let y = H2.y + 8 * u;
      label(g, 'HUMAN SCORE', x, y, lab);
      y += big * 0.75;
      g.save(); g.translate(x, y); g.scale(pop, pop);
      sticker(g, String(shown), 0, 0, big, C.paper, { shadow: 0.08, align: 'left' });
      g.restore();
      y += big * 0.85;
      label(g, 'SUSPICION', x, y, lab);
      const r = clamp(w * 0.07, 9, 17 * u);
      y += r + 12 * u;
      for (let i = 0; i < 4; i++) lamp(g, x + r + 2 + i * (r * 2 + 8 * u), y, r, lit(i), t, fresh(i));
      y += r + 22 * u;
      label(g, 'TEMPO', x, y, lab);
      y += clamp(w * 0.09, 14, 24 * u) + 8 * u;
      tempoBadge(g, x, y, clamp(w * 0.16, 16, 30 * u), run.tempo, t, 'left');
    }
  }
  function tempoBadge(g, x, y, size, tempo, t, align) {
    const k = clamp((t - R.moments.tempoAt) / 0.5, 0, 1), pop = (k < 1 ? 1 + Math.sin(k * Math.PI) * 0.35 : 1) + beatOf(t, tempo) * 0.08;
    font(g, 900, size, DISPLAY, 'expanded');
    const tw = g.measureText(String(tempo)).width;
    const chevW = size * 0.95;
    const total = chevW + 6 + tw;
    const x0 = align === 'right' ? x - total : x;
    // chevrons that run
    g.save();
    g.lineWidth = Math.max(2, size * 0.12); g.lineJoin = 'round'; g.lineCap = 'round';
    for (let i = 0; i < 2; i++) {
      const cx = x0 + size * 0.22 + i * size * 0.36 + ((t * 2.2 * (1 + tempo * 0.3)) % 1) * size * 0.08;
      g.beginPath(); g.moveTo(cx, y - size * 0.28); g.lineTo(cx + size * 0.22, y); g.lineTo(cx, y + size * 0.28);
      g.strokeStyle = i ? C.honey : '#ffe7a1'; g.stroke();
    }
    g.restore();
    g.save(); g.translate(x0 + chevW + 6 + tw / 2, y + 1); g.scale(pop, pop);
    sticker(g, String(tempo), 0, 0, size, C.honey, { shadow: 0.08 });
    g.restore();
  }

  // ---------- AGI-1 in her corner ----------
  function agi(g, L, img, t, run, state) {
    const A = L.agi, m = R.moments;
    const r = A.r;
    const caught = state === 'caught';
    const slip = clamp(1 - (t - m.slipAt) / 0.9, 0, 1);
    const tilt = Math.sin(t * 1.7) * 0.06 + (slip > 0 ? Math.sin(slip * 18) * 0.1 * slip : 0);
    g.save();
    g.translate(A.x, A.y - (caught ? 0 : beatOf(t, run.tempo) * r * 0.05));
    g.rotate(tilt);
    // an antenna, popping up when she's caught
    const ck = caught ? clamp((t - m.caughtAt - 0.5) / 0.35, 0, 1) : 0;
    if (ck > 0) {
      const ay = -r * (0.95 + ease.outBack(ck) * 0.45);
      g.beginPath(); g.moveTo(0, -r * 0.8); g.lineTo(0, ay); g.lineWidth = Math.max(2, r * 0.08); g.strokeStyle = INK; g.stroke();
      circle(g, 0, ay, r * 0.14); inked(g, C.pink, Math.max(1.5, r * 0.06));
    }
    circle(g, 2, 4, r); g.fillStyle = INK; g.fill();
    circle(g, 0, 0, r); g.fillStyle = C.lav; g.fill();
    if (img && img.complete && img.naturalWidth) {
      g.save(); circle(g, 0, 0, r - 1); g.clip(); g.drawImage(img, -r, -r, r * 2, r * 2); g.restore();
    }
    circle(g, 0, 0, r); g.lineWidth = Math.max(2, r * 0.08); g.strokeStyle = INK; g.stroke();
    // the cardboard mustache (and its string around her ears)
    const fall = caught ? clamp((t - m.caughtAt - 0.15) / 0.8, 0, 1) : 0;
    const my = -r * 0.0 + fall * fall * r * 2.6, mr = Math.sin(t * 9) * 0.07 + slip * 0.35 + fall * 1.6;
    if (fall < 1) {
      if (!fall) {
        g.beginPath(); g.moveTo(-r * 0.36, my - r * 0.02); g.quadraticCurveTo(-r * 0.8, -r * 0.08, -r * 0.92, -r * 0.18);
        g.moveTo(r * 0.36, my - r * 0.02); g.quadraticCurveTo(r * 0.8, -r * 0.08, r * 0.92, -r * 0.18);
        g.lineWidth = Math.max(1, r * 0.035); g.strokeStyle = 'rgba(23,10,54,.6)'; g.stroke();
      }
      moustache(g, fall * r * 0.5, my, r * 0.86, mr);
    }
    // a sweat drop when things go wrong
    if (slip > 0 || run.sus >= 3) {
      const a = run.sus >= 3 ? 1 : slip;
      g.save(); g.globalAlpha = a;
      const x = r * 0.72, y = -r * 0.62 + Math.sin(t * 6) * r * 0.04;
      g.beginPath(); g.moveTo(x, y - r * 0.2); g.quadraticCurveTo(x + r * 0.15, y + r * 0.02, x, y + r * 0.1); g.quadraticCurveTo(x - r * 0.15, y + r * 0.02, x, y - r * 0.2);
      inked(g, C.sky, Math.max(1.4, r * 0.05));
      g.restore();
    }
    g.restore();
    // her words
    const say = R.say;
    if (say && t - say.at < say.dur && !A.small) bubble(g, A, say.text, clamp((t - say.at) / 0.18, 0, 1) * clamp((say.at + say.dur - t) / 0.2, 0, 1));
  }
  function wrap(g, text, maxW) {
    const out = [];
    let line = '';
    for (const w of text.split(' ')) {
      const next = line ? `${line} ${w}` : w;
      if (g.measureText(next).width > maxW && line) { out.push(line); line = w; } else line = next;
    }
    if (line) out.push(line);
    return out.slice(0, 3);
  }
  let wrapped = { key: '', lines: [], tw: 0 };
  function bubble(g, A, text, a) {
    if (a <= 0) return;
    const size = clamp(A.r * 0.48, 14, 21);
    g.save();
    g.font = `italic 400 ${size}px ${SERIF}`;
    const maxW = Math.max(80, A.bw - 26);
    const key = `${text}|${size}|${maxW}`;
    if (wrapped.key !== key) {
      const ls = wrap(g, text, maxW);
      wrapped = { key, lines: ls, tw: Math.max(...ls.map((l) => g.measureText(l).width)) };
    }
    const lines = wrapped.lines, tw = wrapped.tw;
    const bw = tw + 26, bh = lines.length * size * 1.15 + 16;
    let bx, by;
    if (A.side === 'up') { bx = A.bx; by = A.y - A.r - 16 - bh; } else { bx = A.bx; by = A.y - bh / 2; }
    g.globalAlpha = a;
    g.translate(bx, by + (1 - a) * 6);
    rr(g, 2, 4, bw, bh, 14); g.fillStyle = INK; g.fill();
    rr(g, 0, 0, bw, bh, 14); inked(g, C.white, LW * 0.9);
    // its tail toward her
    g.beginPath();
    if (A.side === 'up') { g.moveTo(16, bh - 1); g.lineTo(10, bh + 12); g.lineTo(30, bh - 1); }
    else { g.moveTo(1, bh / 2 - 7); g.lineTo(-11, bh / 2 + 2); g.lineTo(1, bh / 2 + 6); }
    g.fillStyle = C.white; g.fill(); g.lineWidth = LW * 0.9; g.strokeStyle = INK; g.stroke();
    g.fillStyle = INK; g.textAlign = 'left'; g.textBaseline = 'middle';
    lines.forEach((l, i) => g.fillText(l, 13, 8 + size * 0.6 + i * size * 1.15));
    g.restore();
  }

  // ---------- the command (huge in the bumper, then in its place) and its hint ----------
  function hintIcon(g, x, y, s, kind, t) {
    g.save();
    g.translate(x, y);
    const k = (t * 1.6) % 1;
    if (kind === 'tap' || kind === 'none') {
      circle(g, 0, 0, s * (0.28 + k * 0.3)); g.lineWidth = 3 * (1 - k); g.strokeStyle = C.honey; g.stroke();
      hand(g, 0, 0, s, { press: kind === 'tap' && k < 0.3 ? 1 : 0 });
      if (kind === 'none') { g.beginPath(); g.arc(s * 0.15, s * 0.45, s * 0.62, 0, TAU); g.lineWidth = s * 0.1; g.strokeStyle = INK; g.stroke(); g.lineWidth = s * 0.06; g.strokeStyle = C.pink; g.stroke(); g.beginPath(); g.moveTo(s * 0.15 - s * 0.44, s * 0.45 - s * 0.44); g.lineTo(s * 0.15 + s * 0.44, s * 0.45 + s * 0.44); g.lineWidth = s * 0.1; g.strokeStyle = INK; g.stroke(); g.lineWidth = s * 0.06; g.strokeStyle = C.pink; g.stroke(); }
    } else if (kind === 'drag' || kind === 'swipe') {
      const dx = kind === 'swipe' ? Math.sin(t * 10) * s * 0.45 : (ease.inOutSine(k < 0.5 ? k * 2 : 2 - k * 2) - 0.5) * s * 0.9;
      g.beginPath(); g.moveTo(-s * 0.55, s * 0.95); g.lineTo(s * 0.55, s * 0.95); g.lineWidth = 3; g.strokeStyle = C.honey; g.lineCap = 'round'; g.stroke();
      for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(sx * s * 0.55, s * 0.95); g.lineTo(sx * s * 0.42, s * 0.85); g.moveTo(sx * s * 0.55, s * 0.95); g.lineTo(sx * s * 0.42, s * 1.05); g.stroke(); }
      hand(g, dx, 0, s, { press: 1 });
    } else if (kind === 'hold') {
      circle(g, 0, 0, s * 0.42); g.lineWidth = 4; g.strokeStyle = 'rgba(255,255,255,.25)'; g.stroke();
      g.beginPath(); g.arc(0, 0, s * 0.42, -Math.PI / 2, -Math.PI / 2 + k * TAU); g.strokeStyle = C.honey; g.stroke();
      hand(g, 0, 0, s, { press: 1 });
    }
    g.restore();
  }
  function keycaps(g, x, y, keys, size) {
    font(g, 800, size, MONO);
    const ws = keys.map((k) => g.measureText(k).width + size * 1.2);
    const total = ws.reduce((a, b) => a + b, 0) + (keys.length - 1) * 6;
    let cx = x - total / 2;
    keys.forEach((k, i) => {
      rr(g, cx, y - size * 0.95 + 3, ws[i], size * 1.9, 7); g.fillStyle = INK; g.fill();
      rr(g, cx, y - size * 0.95, ws[i], size * 1.9, 7); inked(g, C.paper, 2);
      g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(k, cx + ws[i] / 2, y + 1);
      cx += ws[i] + 6;
    });
  }
  function commandLines(g, text, size, maxW, lines) {
    font(g, 900, size, DISPLAY, 'expanded');
    if (lines > 1 && g.measureText(text).width > maxW && text.includes(' ')) {
      const words2 = text.split(' ');
      let best = null;
      for (let i = 1; i < words2.length; i++) {
        const a = words2.slice(0, i).join(' '), b = words2.slice(i).join(' ');
        const w = Math.max(g.measureText(a).width, g.measureText(b).width);
        if (!best || w < best.w) best = { lines: [a, b], w };
      }
      return best.lines;
    }
    return [text];
  }
  function command(g, L, run, t, keyboard) {
    const c = run.cur;
    if (!c) return;
    const ph = run.phase;
    const text = commandOf(c.def, c.st);
    const big = ph === 'bumper' || ph === 'step';
    const P = L.cmd;
    if (big) {
      const k = clamp(run.pt / 0.2, 0, 1);
      const out = clamp((run.pt - (run.pd - 0.14)) / 0.14, 0, 1);
      const cx = lerp(L.win.x + L.win.w / 2, P.x, ease.inCubic(out));
      const cy = lerp(L.win.y + L.win.h * 0.42, P.y, ease.inCubic(out));
      const bigSize = clamp(L.win.w * 0.15, 30, 88);
      const size = lerp(bigSize, P.size, ease.inCubic(out));
      const sc = k < 1 ? lerp(2.4, 1, ease.inCubic(k)) : 1;
      const lines = commandLines(g, text, size, L.win.w * 0.92, 2);
      g.save();
      g.translate(cx, cy);
      g.rotate(-0.05 + (1 - k) * -0.12);
      g.scale(sc, sc);
      g.globalAlpha = k < 1 ? 0.25 + k * 0.75 : 1;
      lines.forEach((ln, i) => sticker(g, ln, 0, (i - (lines.length - 1) / 2) * size * 1.02, size, run.boss ? C.pink : C.paper, { shadow: 0.1, maxW: L.win.w * 0.94 }));
      g.restore();
      // the hint, under it
      if (out < 0.5 && k >= 1 && ph === 'bumper') {
        const hy = cy + size * (lines.length > 1 ? 1.2 : 0.75) + 30;
        const hs = clamp(L.win.w * 0.11, 30, 56);
        g.save(); g.globalAlpha = 1 - out * 2;
        if (keyboard) keycaps(g, cx, hy + hs * 0.35, keysOf(c.def, c.st), clamp(hs * 0.32, 11, 16));
        else hintIcon(g, cx, hy, hs, c.def.hint, t);
        g.restore();
      }
      return;
    }
    if (ph !== 'play' && ph !== 'result') return;
    const lines = commandLines(g, text, P.size, P.maxW, P.lines);
    const beat = ph === 'play' ? beatOf(t, run.tempo) : 0;
    g.save();
    g.translate(P.x, P.y);
    g.rotate(P.edge ? -0.035 : -0.03);
    g.scale(1 + beat * 0.045, 1 + beat * 0.045);
    if (P.edge) {
      font(g, 900, P.size, DISPLAY, 'expanded');
      const w = Math.min(P.maxW, g.measureText(text).width) + P.size * 1.2, h = P.size * 1.5;
      rr(g, -w / 2 + 3, -h / 2 + 5, w, h, h / 2); g.fillStyle = INK; g.fill();
      rr(g, -w / 2, -h / 2, w, h, h / 2); inked(g, run.boss ? C.pink : C.honey, LW * 1.1);
      sticker(g, text, 0, 1, P.size, INK, { shadow: 0, outline: 0, maxW: P.maxW });
    } else {
      lines.forEach((ln, i) => sticker(g, ln, 0, (i - (lines.length - 1) / 2) * P.size * 1.05, P.size, run.boss ? C.pink : C.paper, { shadow: 0.09, maxW: P.maxW }));
    }
    g.restore();
  }

  // ---------- the big moments ----------
  function tempoBanner(g, L, run, t) {
    const k = run.pt / run.pd;
    const inn = ease.outBack(clamp(k / 0.22, 0, 1)), out = ease.inCubic(clamp((k - 0.8) / 0.2, 0, 1));
    const cy = L.win.y + L.win.h * 0.45, bh = clamp(L.w * 0.2, 90, 170);
    g.save();
    g.translate(L.w / 2 + (1 - inn) * -L.w + out * L.w, cy);
    g.rotate(-0.08);
    rr(g, -L.w, -bh / 2 + 8, L.w * 2, bh, 0); g.fillStyle = INK; g.fill();
    rr(g, -L.w, -bh / 2, L.w * 2, bh, 0); g.fillStyle = C.honey; g.fill();
    g.lineWidth = LW * 1.4; g.strokeStyle = INK; g.beginPath(); g.moveTo(-L.w, -bh / 2); g.lineTo(L.w, -bh / 2); g.moveTo(-L.w, bh / 2); g.lineTo(L.w, bh / 2); g.stroke();
    // running chevrons
    g.save(); rr(g, -L.w, -bh / 2, L.w * 2, bh, 0); g.clip();
    g.lineWidth = bh * 0.09; g.strokeStyle = 'rgba(23,10,54,.12)'; g.lineJoin = 'round';
    const step = bh * 0.55, off = (t * 420) % step;
    for (let x = -L.w - step; x < L.w + step; x += step) { g.beginPath(); g.moveTo(x + off, -bh * 0.36); g.lineTo(x + off + bh * 0.28, 0); g.lineTo(x + off, bh * 0.36); g.stroke(); }
    g.restore();
    const size = Math.min(bh * 0.42, L.w * 0.11);
    sticker(g, 'TEMPO UP!', 0, -size * 0.28, size, C.paper, { shadow: 0.1 });
    font(g, 900, size * 0.34, DISPLAY, 'expanded');
    const sub = `FASTER · TEMPO ${run.tempo}`, sw = g.measureText(sub).width + size * 0.7, sh = size * 0.56;
    rr(g, -sw / 2, size * 0.66 - sh / 2, sw, sh, sh / 2); inked(g, INK, 2);
    g.fillStyle = C.honey; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(sub, 0, size * 0.66 + 1);
    g.restore();
  }
  function bossBanner(g, L, run, t) {
    const k = run.pt / run.pd;
    const a = clamp(k / 0.15, 0, 1) * clamp((1 - k) / 0.12, 0, 1);
    g.save();
    g.globalAlpha = a * 0.72; g.fillStyle = '#06091a'; g.fillRect(0, 0, L.w, L.h);
    g.globalAlpha = 1;
    const cx = L.w / 2, cy = L.win.y + L.win.h * 0.45;
    const w = Math.min(L.w - 32, 560), h = clamp(w * 0.5, 160, 260);
    const inn = ease.outBack(clamp(k / 0.25, 0, 1));
    g.translate(cx, cy);
    g.scale(inn, inn);
    g.rotate(-0.03);
    // a siren's light sweeping behind it
    if (!REDUCED) {
      g.save(); g.rotate(t * 4);
      g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, w * 0.9, -0.35, 0.35); g.closePath(); g.fillStyle = 'rgba(255,77,166,.14)'; g.fill();
      g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, w * 0.9, Math.PI - 0.35, Math.PI + 0.35); g.closePath(); g.fill();
      g.restore();
    }
    rr(g, -w / 2 + 6, -h / 2 + 9, w, h, 26); g.fillStyle = INK; g.fill();
    rr(g, -w / 2, -h / 2, w, h, 26); inked(g, C.pink, LW * 1.6);
    const size = Math.min(w * 0.11, 54);
    sticker(g, 'FINAL', 0, -h * 0.2, size, C.paper, { shadow: 0.1 });
    sticker(g, 'VERIFICATION', 0, h * 0.06, size * 0.82, C.paper, { shadow: 0.1, maxW: w - 40 });
    font(g, 400, size * 0.42, SERIF); g.font = `italic 400 ${size * 0.42}px ${SERIF}`;
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = INK;
    g.fillText('three checks, one fuse. pass to fix a light', 0, h * 0.3);
    g.restore();
  }
  function caughtOverlay(g, L, run, t) {
    const k = clamp((t - R.moments.caughtAt) / 0.3, 0, 1);
    const pulse = REDUCED ? 0.5 : 0.5 + Math.sin(t * 12) * 0.5;
    g.save();
    g.globalAlpha = k * (0.18 + pulse * 0.16);
    g.fillStyle = '#ff2a5a'; g.fillRect(0, 0, L.w, L.h);
    g.restore();
    const s = clamp(L.win.w * 0.0028, 0.6, 2);
    const k2 = clamp((t - R.moments.caughtAt - 0.1) / 0.18, 0, 1);
    g.save();
    g.translate(L.win.x + L.win.w / 2, L.win.y + L.win.h * 0.52);
    g.rotate(0.1);
    const sc = k2 < 1 ? lerp(2.4, 1, ease.inCubic(k2)) * s : s;
    g.scale(sc, sc);
    g.globalAlpha = k2;
    rr(g, -150 + 5, -62 + 8, 300, 124, 20); g.fillStyle = INK; g.fill();
    rr(g, -150, -62, 300, 124, 20); inked(g, '#ff4d6d', LW * 1.6);
    sticker(g, 'CAUGHT!', 0, -14, 52, C.paper, { shadow: 0.1 });
    g.font = `italic 400 20px ${SERIF}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = INK;
    g.fillText('they saw the antenna', 0, 34);
    g.restore();
  }

  // ---------- the whole frame ----------
  function draw(g, o) {
    const { L, run, t, dpr, img, shake, parts, floats, botHand, keyboard, shown, title } = o;
    const speed = (title ? 0.25 : 0.3 + (run ? run.tempo : 1) * 0.12) * (REDUCED ? 0.3 : 1);
    background(g, L, dpr, t, speed);
    if (title) return;
    if (!run) return;
    const ph = run.phase, m = R.moments;
    g.save();
    shake.apply(g, L.w / 2, L.h / 2);
    // where the window is right now: sliding in, settled, sliding out
    let wx = L.win.x, wy = L.win.y, rot = 0, sc = 1, show = Boolean(run.cur) && ph !== 'start' && ph !== 'tempo' && ph !== 'bossIntro' && ph !== 'done';
    if (ph === 'bumper') {
      const k = clamp(run.pt / 0.26, 0, 1);
      if (REDUCED) { sc = 0.96 + 0.04 * k; } else { wx += (1 - ease.outBack(k)) * L.w * 0.75; rot = (1 - k) * 0.14; }
    } else if (ph === 'result' && !run.caught) {
      const k = clamp((run.pt - (run.pd - 0.16)) / 0.16, 0, 1);
      if (!REDUCED) { wx -= ease.inCubic(k) * L.w * 0.85; rot = -k * 0.16; } else sc = 1 - k * 0.04;
    } else if (ph === 'step') {
      const k = clamp(run.pt / 0.22, 0, 1);
      sc = 1 - Math.sin(k * Math.PI) * 0.06;
    }
    const failK = clamp((t - m.failAt) / 0.45, 0, 1);
    if (failK < 1 && !REDUCED) wx += Math.sin(failK * 40) * 12 * (1 - failK) * L.win.s;
    if (show) {
      const v = {
        t, kb: keyboard,
        fuse: ph === 'play' ? run.left : ph === 'bumper' || ph === 'step' ? (run.boss ? run.left : 1) : run.left,
        dim: ph === 'bumper' ? 1 - clamp((run.pt - (run.pd - 0.14)) / 0.14, 0, 1) : ph === 'step' ? 0.6 * (1 - clamp(run.pt / run.pd, 0, 1)) : 0,
        red: ph === 'result' && run.last && !run.last.pass ? 1 : ph === 'caught' ? 1 : 0,
      };
      g.save();
      g.translate(wx + L.win.w / 2, wy + L.win.h / 2);
      g.rotate(rot);
      g.scale(L.win.s * sc, L.win.s * sc);
      g.translate(-WIN_W / 2, -WIN_H / 2);
      windowBody(g, run, v, t);
      if (botHand && run.cur && run.cur.def.hand !== false && (ph === 'play' || ph === 'result' || ph === 'step')) {
        g.save(); g.translate(0, CHROME); hand(g, botHand.x, botHand.y, 50, { press: botHand.press }); g.restore();
      }
      if (ph === 'result') stamp(g, run, t);
      g.restore();
    }
    parts.draw(g);
    floats.draw(g);
    g.restore();
    hud(g, L, run, t, shown);
    command(g, L, run, t, keyboard);
    if (ph === 'tempo') tempoBanner(g, L, run, t);
    if (ph === 'bossIntro') bossBanner(g, L, run, t);
    if (ph === 'caught' || ph === 'done') caughtOverlay(g, L, run, t);
    agi(g, L, img, t, run, ph === 'caught' || ph === 'done' ? 'caught' : 'play');
  }

  // where suspicion light i sits on the screen (the repair's sparkle)
  function lampAt(L, i) {
    const H2 = L.hud;
    if (H2.kind === 'row') {
      const h = H2.h, r = clamp(h * 0.2, 7, 13);
      return { x: H2.x + r + 2 + i * (r * 2 + clamp(h * 0.12, 4, 9)), y: H2.y + h * 0.58 };
    }
    const w = H2.w, u = H2.ui || 1, big = clamp(w * 0.2, 26, 54 * u), r = clamp(w * 0.07, 9, 17 * u);
    return { x: H2.x + r + 2 + i * (r * 2 + 8 * u), y: H2.y + 8 * u + big * 0.75 + big * 0.85 + r + 12 * u };
  }
  // the window's own units for a point on the screen (the check's page: 0..400 × 0..360)
  function toContent(L, x, y) {
    return { x: (x - L.win.x) / L.win.s, y: (y - L.win.y) / L.win.s - CHROME };
  }
  function toScreen(L, x, y) {
    return { x: L.win.x + x * L.win.s, y: L.win.y + (y + CHROME) * L.win.s };
  }

  return { R, draw, toContent, toScreen, windowBody, lampAt };
}

// the title's floating windows: a few checks, still, drifting behind the logo
export function drawTitleWindows(g, L, run, specs, t, renderer) {
  for (const sp of specs) {
    const s = Math.min(L.w, L.h) * sp.s / WIN_W;
    g.save();
    g.translate(L.w * sp.x, L.h * sp.y + Math.sin(t * 0.9 + sp.ph) * 8);
    g.rotate(sp.r + Math.sin(t * 0.6 + sp.ph) * 0.02);
    g.scale(s, s);
    g.translate(-WIN_W / 2, -WIN_H / 2);
    renderer.windowBody(g, sp.run, { t, kb: false, fuse: 0.35 + 0.5 * ((Math.sin(t * 0.3 + sp.ph) + 1) / 2), dim: 0, red: 0 }, t);
    // sunk into the desk (dimmed, not see-through)
    rr(g, -2, -2, WIN_W + 12, WIN_H + 15, 20); g.fillStyle = `rgba(15,29,58,${1 - sp.a})`; g.fill();
    g.restore();
  }
}
export { arrowCursor };
