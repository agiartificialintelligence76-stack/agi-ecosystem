// BUBBLE SORT's view: where everything sits on the screen (a phone held up: the board across the width, sitting low by the
// thumb, its header above; anything wider: a tall board in the middle, AGI-1 leaning in on the left, the level's card on
// the right), the board drawn once per size, and the scene that plays each shot: the flight, the landing (its neighbours
// wobble on springs), the SORT bubble's hops, the pops, the drops, the stack coming down. The view keeps its own copy of
// the board and plays the rules' result into it step by step; when a shot is over it takes the rules' board again.
import { Board, ROWS, LIMIT, W, RH, rowY, DEADLINE_Y, LAUNCHER, FIELD_H, STONE, LOCK, MEMORY, SORT, WILD, BOMB, isColor, isSpecial } from './grid.js';
import { makeSprites, stamp, C, COLORS, fillOf, roundRectPath, RAINBOW, makeCanvas, INK } from './art.js';
import { Particles, Shake, FloatText, ease, clamp, lerp, fmt } from '../kit/fx.js';
import { REDUCED } from '../kit/env.js';

export const M = 0.62;                       // the frame around the board (units)
export const PW = W + 2 * M, PH = FIELD_H + 2 * M;
export const SPEED = 1.8 * FIELD_H;          // a shot's speed: units a second (1.8 board heights)
const POP_GAP = 0.034, POP_DUR = 0.17;
const SWAP0 = 0.07, SWAP_DECAY = 0.93, SWAP_MIN = 0.026;
const GRAV = 70;
export const NEXT_AT = Object.freeze({ x: 16.9, y: LAUNCHER.y + 0.95 });
export const FACE_AT = Object.freeze({ x: 3.05, y: LAUNCHER.y + 0.55, r: 1.85 });

// ---------- the layout ----------
// ins: { top, right, bottom, left } (CSS px kept clear: the bar, the notch) → L
export function computeLayout(w, h, ins, { demo = false } = {}) {
  const ax = ins.left, ay = ins.top;
  const aw = Math.max(60, w - ins.left - ins.right), ah = Math.max(60, h - ins.top - ins.bottom);
  const wide = !demo && aw >= 560 && aw >= ah * 1.08;
  const s = wide ? Math.min(ah / PH, (aw * 0.5) / PW, 32) : Math.min(aw / PW, ah / PH, 32);
  const pw = PW * s, ph = PH * s;
  const px = Math.round(ax + (aw - pw) / 2);
  // a phone held up: the header (when there's room for it) and the board, together, in the middle (a little low)
  const room = ah - ph;
  const hh = !wide && !demo && room >= 58 ? Math.min(84, Math.max(56, room * 0.42)) : 0;
  const gap = hh ? 10 : 0;
  const spare = room - hh - gap;
  const py = Math.round(wide ? ay + room / 2 : ay + hh + gap + spare * 0.56);
  const L = { kind: wide ? 'W' : 'P', s, w, h, demo, panel: { x: px, y: py, w: pw, h: ph }, x0: px + M * s, y0: py + M * s };
  L.ux = (u) => L.x0 + u * s;
  L.uy = (u) => L.y0 + u * s;
  L.header = null; L.side = null; L.bust = null; L.face = null;
  if (!wide) {
    if (hh) L.header = { x: px + s * 0.2, y: py - hh - gap, w: pw - s * 0.4, h: hh };
    L.face = { x: L.ux(FACE_AT.x), y: L.uy(FACE_AT.y), r: FACE_AT.r * s };
    L.say = { x: L.face.x + L.face.r * 0.55, y: L.face.y - L.face.r - 4, side: 'up', maxW: Math.min(280, w - 24) };
  } else {
    const left = px - ax, right = ax + aw - (px + pw);
    // AGI-1 leaning in from the lower left
    const bh = Math.min(ah * 0.86, (left + s * 2) * 1.5, h * 0.9);
    const bw = bh * (574 / 718);
    L.bust = { x: px - bw * 0.86, y: h - bh + bh * 0.06, w: bw, h: bh };
    if (L.bust.x < ax - bw * 0.2) L.bust.x = ax - bw * 0.2;
    const sw = Math.min(310, right - 28);
    if (sw >= 150) L.side = { x: px + pw + Math.max(18, (right - sw) / 2 - 4), y: py + s * 0.2, w: sw };
    L.say = { x: L.bust.x + bw * 0.5, y: L.bust.y + bh * 0.08, side: 'up', maxW: Math.min(300, Math.max(180, left + bw * 0.3)) };
  }
  return L;
}

// ---------- the board, drawn once per size ----------
export function drawPanel(L, dpr) {
  const { panel: P, s } = L;
  const pad = Math.ceil(s * 0.6);
  const cv = makeCanvas(Math.ceil((P.w + pad * 2) * dpr), Math.ceil((P.h + pad * 2) * dpr));
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, pad * dpr, pad * dpr);
  const R = s * 1.05;
  // the hard shadow and the ink frame
  g.fillStyle = INK; roundRectPath(g, s * 0.22, s * 0.32, P.w, P.h, R); g.fill();
  g.fillStyle = INK; roundRectPath(g, 0, 0, P.w, P.h, R); g.fill();
  const ix = M * s * 0.42, iw = P.w - ix * 2;
  g.save();
  roundRectPath(g, ix, ix, iw, P.h - ix * 2, R * 0.72); g.clip();
  // the memory bank: deep indigo, a faint honeycomb and a few traces
  const grd = g.createLinearGradient(0, 0, 0, P.h);
  grd.addColorStop(0, '#160f38'); grd.addColorStop(0.75, C.board); grd.addColorStop(1, '#0f0a28');
  g.fillStyle = grd; g.fillRect(0, 0, P.w, P.h);
  const ox = M * s, oy = M * s;
  g.strokeStyle = 'rgba(205,184,255,0.055)'; g.lineWidth = 1;
  const hx = 2 * s, hy = RH * s;
  for (let r = -1; r < FIELD_H / RH + 1; r++) {
    for (let c = -1; c < 12; c++) {
      const x = ox + (r % 2 ? 2 : 1) * s + c * hx, y = oy + (1 + r * RH) * s;
      g.beginPath();
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + Math.PI / 6; g[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * s * 1.13, y + Math.sin(a) * s * 1.13); }
      g.closePath(); g.stroke();
    }
  }
  g.strokeStyle = 'rgba(139,102,255,0.13)'; g.lineWidth = Math.max(1, s * 0.09); g.lineCap = 'round'; g.lineJoin = 'round';
  const trace = (pts) => { g.beginPath(); pts.forEach(([x, y], i) => g[i ? 'lineTo' : 'moveTo'](ox + x * s, oy + y * s)); g.stroke(); const [lx, ly] = pts[pts.length - 1]; g.fillStyle = 'rgba(139,102,255,0.2)'; g.beginPath(); g.arc(ox + lx * s, oy + ly * s, s * 0.22, 0, Math.PI * 2); g.fill(); };
  trace([[0.2, 6], [2.5, 8.3], [2.5, 13]]);
  trace([[21.8, 4], [19.5, 6.3], [19.5, 10.5]]);
  trace([[0.2, 17], [3.4, 20.2], [6.5, 20.2]]);
  trace([[21.8, 15], [18.8, 18], [18.8, 21.5]]);
  // the launcher's bay: a lighter floor
  const by = oy + DEADLINE_Y * s;
  const bay = g.createLinearGradient(0, by, 0, P.h);
  bay.addColorStop(0, 'rgba(107,59,255,0.10)'); bay.addColorStop(1, 'rgba(107,59,255,0.24)');
  g.fillStyle = bay; g.fillRect(0, by, P.w, P.h - by);
  g.restore();
  // the inner rim
  g.strokeStyle = 'rgba(228,217,255,0.16)'; g.lineWidth = Math.max(1, s * 0.08);
  roundRectPath(g, ix, ix, iw, P.h - ix * 2, R * 0.72); g.stroke();
  return { cv, pad };
}

// the page around the board: deep night, a few big faint bubbles drifting (drawn live: cheap)
export function drawPage(g, L, t) {
  const grd = g.createRadialGradient(L.w * 0.5, L.h * 0.55, 10, L.w * 0.5, L.h * 0.55, Math.max(L.w, L.h) * 0.75);
  grd.addColorStop(0, '#1d1150'); grd.addColorStop(1, '#0b0720');
  g.fillStyle = grd; g.fillRect(0, 0, L.w, L.h);
  g.lineWidth = Math.max(1.5, L.s * 0.12);
  for (let i = 0; i < 9; i++) {
    const r = (0.05 + ((i * 37) % 11) / 90) * Math.max(L.w, L.h);
    const x = ((i * 0.37 + 0.11) % 1) * L.w + Math.sin(t * 0.13 + i) * 18;
    const y = ((i * 0.61 + 0.2) % 1) * L.h + Math.cos(t * 0.11 + i * 2) * 14;
    g.strokeStyle = `rgba(139,102,255,${0.05 + (i % 3) * 0.02})`;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
  }
}

// ---------- the scene: a run on the screen ----------
export class Scene {
  constructor(hooks = {}) {
    this.hooks = hooks;          // { sfx(name, …), haptic(p), event(name, data) }
    this.parts = new Particles(520);
    this.floats = new FloatText();
    this.shake = new Shake({ max: 13, decay: 2.1 });
    this.t = 0;
    this.slow = 1;               // time scale (a big drop slows the world a moment)
    this.slowT = 0;
    this.sheet = null;
    this.L = null;
    this.load(null);
  }
  load(game, { intro = false } = {}) {
    this.game = game;
    this.mirror = game ? game.board.clone() : new Board();
    this.wob = new Map();
    this.hop = new Map();        // id → a swap's hop { dx, t, dur, arc }
    this.popping = [];
    this.falling = [];
    this.flying = null;
    this.steps = [];
    this.cur = null;
    this.pushOff = 0;
    this.pushT = -1;
    this.sortRows = null;        // rows lit while sorting
    this.banner = null;
    this.flash = 0;
    this.quiet = false;
    this.calm = false;
    this.swapT = 1;              // a swap: the old loaded bubble sliding to the next spot
    this.shown = game ? game.queue.slice() : [];
    this.reload = 1;             // the launcher's bubble sliding in (0 → 1)
    this.meterShown = game ? game.meter : 0;
    this.missShown = game ? game.misses : 0;
    this.trail = [];
    if (game && intro) {
      // every bubble drops into place, row by row
      this.mirror.each((x, r, c) => {
        const w = { ox: (c - 5) * 0.06, oy: -(10 + r * 0.9), vx: 0, vy: 0, hold: 0.05 + r * 0.045 + c * 0.006 };
        this.wob.set(x.id, w);
      });
    }
  }
  get busy() { return Boolean(this.cur || this.steps.length || this.flying); }
  // can the player fire again? (drops may still be falling; pops and pushes are done)
  get ready() { return !this.busy; }

  // ---------- the steps of a shot ----------
  run(steps) { this.steps.push(...steps); }
  update(dt) {
    this.t += dt;
    if (this.slowT > 0) { this.slowT -= dt; if (this.slowT <= 0) this.slow = 1; }
    const sdt = dt * this.slow;
    // the script
    let budget = sdt;
    for (let guard = 0; guard < 64 && budget >= 0; guard++) {
      if (!this.cur) {
        if (!this.steps.length) break;
        this.cur = this.steps.shift();
        this.cur.t = 0;
        this.cur.start?.();
      }
      const st = this.cur;
      const left = st.dur - st.t;
      const use = Math.min(budget, left);
      st.t += use;
      st.tick?.(st.dur > 0 ? st.t / st.dur : 1, use);
      budget -= use;
      if (st.t >= st.dur - 1e-9) { this.cur = null; st.end?.(); if (budget <= 0) break; } else break;
    }
    // springs
    for (const [id, w] of this.wob) {
      if (w.hold > 0) { w.hold -= sdt; continue; }
      w.vx += (-240 * w.ox - 15 * w.vx) * sdt;
      w.vy += (-240 * w.oy - 15 * w.vy) * sdt;
      w.ox += w.vx * sdt; w.oy += w.vy * sdt;
      if (Math.abs(w.ox) + Math.abs(w.oy) + Math.abs(w.vx) * 0.02 + Math.abs(w.vy) * 0.02 < 0.002) this.wob.delete(id);
    }
    for (const [id, h] of this.hop) { h.t += sdt; if (h.t >= h.dur) this.hop.delete(id); }
    for (let i = this.popping.length - 1; i >= 0; i--) { const p = this.popping[i]; p.t += sdt; if (p.t >= POP_DUR) this.popping.splice(i, 1); }
    // the falling ones: gravity, one bounce off the bay's floor (a plink), then away
    const floor = FIELD_H - 1.05;
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const f = this.falling[i];
      if (f.delay > 0) { f.delay -= sdt; continue; }
      f.t += sdt;
      if (f.up) { f.vy -= 26 * sdt; f.y += f.vy * sdt; f.x += f.vx * sdt; f.vx *= Math.exp(-2 * sdt); if (f.y < -3) this.falling.splice(i, 1); continue; }
      f.vy += GRAV * sdt;
      f.x += f.vx * sdt; f.y += f.vy * sdt; f.rot += f.vr * sdt;
      if (f.x < 1) { f.x = 1; f.vx = Math.abs(f.vx) * 0.5; }
      if (f.x > W - 1) { f.x = W - 1; f.vx = -Math.abs(f.vx) * 0.5; }
      if (!f.bounced && f.y >= floor) {
        f.y = floor; f.vy = -Math.abs(f.vy) * 0.38 - 4; f.vx *= 0.7; f.bounced = true;
        if (!this.quiet && f.plink) this.hooks.sfx?.('plink', f.pitch);
      }
      if (f.y > FIELD_H + 14 || f.t > 4) this.falling.splice(i, 1);
    }
    if (this.pushT >= 0) {
      this.pushT += sdt;
      const k = clamp(this.pushT / 0.36, 0, 1);
      this.pushOff = -RH * (1 - ease.outBounce(k));
      if (k >= 1) { this.pushT = -1; this.pushOff = 0; }
    }
    if (this.reload < 1) this.reload = Math.min(1, this.reload + sdt / 0.2);
    if (this.swapT < 1) this.swapT = Math.min(1, this.swapT + sdt / 0.2);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 3);
    if (this.banner) { this.banner.t += dt; if (this.banner.t > this.banner.dur) this.banner = null; }
    this.parts.update(sdt);
    this.floats.update(sdt);
    this.shake.update(dt);
  }

  // the bubbles around a cell get a push away from it (they wobble back on their springs)
  nudge(ux, uy, power = 7) {
    this.mirror.each((x, r, c) => {
      const dx = this.mirror.x(r, c) - ux, dy = this.mirror.y(r) - uy, d = Math.hypot(dx, dy);
      if (d < 0.5 || d > 4.6) return;
      const w = this.wob.get(x.id) || { ox: 0, oy: 0, vx: 0, vy: 0, hold: 0 };
      const f = power / (d * d) * 2.2;
      w.vx += (dx / d) * f; w.vy += (dy / d) * f;
      this.wob.set(x.id, w);
    });
  }
  banner_(text, { sub = '', tone = C.honey, dur = 1.15, big = 1 } = {}) { if (!this.calm) this.banner = { text, sub, tone, dur, t: 0, big }; }
  float(ux, uy, text, { color = C.paper, size = 1, life = 1, rise = 2.2 } = {}) {
    const L = this.L;
    if (!L || this.calm) return;
    const x = clamp(L.ux(ux), L.x0 + L.s * 3, L.x0 + L.s * (W - 3));
    this.floats.add({ x, y: L.uy(uy), text, color, size: size * L.s, life, rise: rise * L.s, font: "900 1em 'AK Display', 'Arial Black', system-ui, sans-serif", strokeWidth: Math.max(3, L.s * 0.32) });
  }

  // ---------- a shot: its whole story as steps ----------
  playShot(res, { quiet = false } = {}) {
    this.quiet = quiet;
    const H = this.hooks, mir = this.mirror, game = this.game;
    const say = (name, data) => { if (!quiet) H.event?.(name, data); };
    const sfx = (name, ...a) => { if (!quiet) H.sfx?.(name, ...a); };
    const pts = res.path.points;
    const cellX = (r, c) => mir.x(r, c), cellY = (r) => mir.y(r);
    const landX = cellX(res.r, res.c), landY = cellY(res.r);
    // 1. the flight
    const dur = res.path.length / SPEED;
    let seg = 1, travelled = 0;
    this.shown = this.shown.slice(1);
    this.reload = 1;
    this.run([{
      dur: Math.max(0.06, dur),
      start: () => {
        this.flying = { k: res.k, x: pts[0].x, y: pts[0].y, vx: 0, vy: 0 };
        this.trail.length = 0;
        sfx('fire');
        H.haptic?.(8);
      },
      tick: (k) => {
        const d = k * res.path.length;
        while (seg < pts.length - 1) {
          const a = pts[seg - 1], b = pts[seg], L = Math.hypot(b.x - a.x, b.y - a.y);
          if (travelled + L > d) break;
          travelled += L; seg++;
          sfx('bounce', 1 + seg * 0.05);
          this.burst(b.x, b.y, { count: 6, speed: [4, 10], life: [0.15, 0.3], size: [0.15, 0.3], colors: [C.paper, fillOf(res.k)], drag: 4 });
        }
        const a = pts[seg - 1], b = pts[seg], L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const f = clamp((d - travelled) / L, 0, 1);
        const f0 = this.flying;
        const nx = lerp(a.x, b.x, f), ny = lerp(a.y, b.y, f);
        f0.vx = nx - f0.x; f0.vy = ny - f0.y;
        f0.x = nx; f0.y = ny;
        this.trail.push(nx, ny);
        if (this.trail.length > 16) this.trail.splice(0, 2);
      },
      end: () => {
        // 2. it lands: a snap to its cell, the neighbours wobble
        this.flying = null;
        this.trail.length = 0;
        this.reload = 0;
        mir.rows[res.r][res.c] = { id: res.id, k: res.k, hits: 0 };
        this.wob.set(res.id, { ox: res.path.end.x - landX, oy: res.path.end.y - landY, vx: 0, vy: 0, hold: 0 });
        this.nudge(landX, landY, isSpecial(res.k) ? 10 : 6);
        sfx('stick');
        if (res.path.bounces && (res.pops.length || res.drops.length)) say('bank', res);
      },
    }]);
    // 3. the specials
    if (res.wild) {
      this.run([{ dur: 0.2, start: () => { sfx('wild'); this.burstRainbow(landX, landY, 14); }, end: () => { const x = mir.rows[res.r][res.c]; if (x) x.k = res.wild; this.nudge(landX, landY, 4); } }]);
    }
    if (res.sort) this.sortSteps(res, sfx, say);
    if (res.bomb) {
      this.run([{ dur: 0.12, start: () => {
        sfx('bomb'); H.haptic?.([25, 30, 40]);
        mir.rows[res.r][res.c] = null;
        this.flash = 0.7; this.shake.kick(0.45);
        this.burst(landX, landY, { count: 30, speed: [8, 26], life: [0.3, 0.7], size: [0.25, 0.6], colors: [C.honey, C.paper, C.pink], shape: 'spark', drag: 3 });
        this.burst(landX, landY, { count: 2, speed: [0, 0], life: [0.4, 0.5], size: [2.2, 2.6], colors: [C.paper], shape: 'ring' });
        say('bomb', res);
      } }]);
    }
    // 4. the pops: in rings out from the hit, the pitch rising
    const pops = res.pops.concat(res.broken.map((b) => ({ ...b, order: (res.pops[res.pops.length - 1]?.order || 0) + 1 })));
    const maxOrder = pops.length ? pops[pops.length - 1].order : 0;
    if (pops.length) {
      const popDur = maxOrder * POP_GAP + 0.06;
      let next = 0;
      this.run([{
        dur: popDur,
        start: () => { if (res.sort) this.sortRows = null; },
        tick: (k) => {
          const at = k * popDur;
          while (next < pops.length && pops[next].order * POP_GAP <= at + 1e-6) {
            const p = pops[next];
            this.popOne(p, next, pops.length, quiet);
            next++;
          }
        },
        end: () => {
          while (next < pops.length) { this.popOne(pops[next], next, pops.length, quiet); next++; }
          for (const c of res.cracked) { const x = mir.rows[c.r][c.c]; if (x) x.hits = c.hits; this.burst(cellX(c.r, c.c), cellY(c.r), { count: 8, speed: [3, 9], life: [0.2, 0.45], size: [0.15, 0.32], colors: [C.paper, C.lav2], shape: 'square', spin: 8 }); }
          if (res.cracked.length) sfx('crack');
          // the score at the cluster
          const pts0 = res.points - res.freed * 500;
          if (pts0 > 0 && !res.drops.length) {
            let sx = 0, sy = 0;
            for (const p of pops) { sx += cellX(p.r, p.c); sy += cellY(p.r); }
            this.float(sx / pops.length, sy / pops.length, `+${fmt(pts0)}`, { color: C.paper, size: 1.15 + Math.min(0.6, pops.length * 0.03) });
          }
          if (res.streak >= 2 && res.mult > 1) {
            this.float(LAUNCHER.x, DEADLINE_Y - 1.4, `COMBO ×${res.mult % 1 ? res.mult.toFixed(1) : res.mult}`, { color: C.honey, size: 1.0 + Math.min(0.5, res.streak * 0.06), life: 1.1 });
            sfx('combo', res.streak);
          }
        },
      }]);
    }
    // 5. what nothing holds up falls (memories float up: free)
    if (res.drops.length) {
      this.run([{ dur: 0.001, start: () => this.dropAll(res, quiet) }]);
    }
    // the launcher catches up: the next bubble moves in, the meter and the misses show
    this.run([{ dur: 0.001, start: () => {
      this.shown = game ? game.queue.slice() : [];
      this.reload = 0;
      if (res.special) { sfx('special'); this.banner_(({ [SORT]: 'SORT!', [WILD]: 'WILD!', [BOMB]: 'BOMB!' })[res.special], { sub: 'loaded', tone: C.mint, dur: 0.95, big: 0.8 }); say('special', res); }
      this.meterShown = game ? game.meter : 0;
      this.missShown = game ? game.misses : 0;
      if (res.miss) { sfx('miss'); say('miss', res); }
      say('shot', res);
    } }]);
    // 6. the stack comes down (misses; Endless's fresh rows)
    for (const p of [res.push, ...(res.refill || [])].filter(Boolean)) this.pushSteps(p, quiet);
    // 7. done: the rules' board is the truth again
    this.run([{ dur: 0.001, start: () => this.sync() }]);
  }
  sortSteps(res, sfx, say) {
    const mir = this.mirror, S = res.sort;
    const lanes = S.swaps.map((list) => list.slice());
    const ux = mir.x(res.r, res.c), uy = mir.y(res.r);
    // the SORT bubble lights its rows, then dissolves into them
    this.run([{
      dur: 0.32,
      start: () => {
        this.sortRows = S.rows.slice();
        sfx('sortStart');
        this.burstRainbow(ux, uy, 18);
        this.shake.kick(0.12);
        say('sort', res);
      },
      end: () => { mir.rows[res.r][res.c] = null; },
    }]);
    // then the swaps: every lane (row) at once, each pair hopping past each other, faster and faster
    const n = Math.max(0, ...lanes.map((l) => l.length));
    let d = SWAP0;
    for (let i = 0; i < n; i++) {
      const dur = d;
      this.run([{
        dur,
        start: () => {
          let any = false;
          for (const lane of lanes) {
            const sw = lane[i];
            if (!sw) continue;
            any = true;
            const A = mir.rows[sw.r][sw.a], B = mir.rows[sw.r][sw.b];
            mir.rows[sw.r][sw.a] = B; mir.rows[sw.r][sw.b] = A;
            const dx = mir.x(sw.r, sw.b) - mir.x(sw.r, sw.a);
            if (A) this.hop.set(A.id, { dx: -dx, t: 0, dur: dur * 0.98, arc: 0.9 });
            if (B) this.hop.set(B.id, { dx, t: 0, dur: dur * 0.98, arc: -0.55 });
          }
          if (any) sfx('swap', i);
        },
      }]);
      d = Math.max(SWAP_MIN, d * SWAP_DECAY);
    }
    this.run([{ dur: 0.16, start: () => {
      if (n) { sfx('sorted'); this.banner_('SORTED!', { tone: C.mint, dur: 0.9 }); this.shake.kick(0.18); this.hooks.haptic?.(14); }
    } }]);
  }
  pushSteps(p, quiet) {
    const mir = this.mirror;
    this.run([{
      dur: 0.4,
      start: () => {
        mir.rows.pop();
        mir.rows.unshift(new Array(11).fill(null));
        mir.parity ^= 1;
        if (p.row.length) for (const x of p.row) mir.rows[0][x.c] = { id: x.id, k: x.k, hits: 0 };
        else mir.top++;
        this.pushT = 0;
        this.pushOff = -RH;
        this.shake.kick(p.by === 'refill' ? 0.12 : 0.32);
        if (!quiet) { this.hooks.sfx?.('thunk', p.by); this.hooks.haptic?.(p.by === 'refill' ? 10 : 30); this.hooks.event?.('push', p); }
      },
    }]);
  }
  popOne(p, i, n, quiet) {
    const mir = this.mirror;
    const ux = mir.x(p.r, p.c), uy = mir.y(p.r);
    if (mir.rows[p.r][p.c]?.id === p.id) mir.rows[p.r][p.c] = null;
    this.wob.delete(p.id);
    this.popping.push({ k: p.k, x: ux, y: uy, t: 0 });
    const col = fillOf(p.k);
    this.burst(ux, uy, { count: REDUCED ? 4 : 9, speed: [5, 14], life: [0.25, 0.55], size: [0.22, 0.48], colors: [col, col, C.paper], drag: 3.2 });
    this.burst(ux, uy, { count: 1, speed: [0, 0], life: [0.28, 0.3], size: [1.2, 1.2], colors: [col], shape: 'ring' });
    if (!quiet) this.hooks.sfx?.('pop', i, n);
  }
  dropAll(res, quiet) {
    const mir = this.mirror;
    const n = res.drops.length;
    let sx = 0, sy = 0;
    res.drops.forEach((d, i) => {
      const ux = mir.x(d.r, d.c), uy = mir.y(d.r);
      if (mir.rows[d.r][d.c]?.id === d.id) mir.rows[d.r][d.c] = null;
      this.wob.delete(d.id);
      sx += ux; sy += uy;
      const seed = ((d.id * 2654435761) >>> 0) / 4294967296;
      if (d.k === MEMORY) {
        this.falling.push({ k: d.k, x: ux, y: uy, vx: (seed - 0.5) * 4, vy: -3, rot: 0, vr: 0, t: 0, delay: 0.12, up: true });
        this.burst(ux, uy, { count: 12, speed: [3, 9], life: [0.5, 1], size: [0.4, 0.7], colors: [C.pink, C.honey, C.paper], shape: 'star', spin: 5, gravity: -6 });
        return;
      }
      this.falling.push({ k: d.k, x: ux, y: uy, vx: (seed - 0.5) * 7, vy: -2 - seed * 5, rot: 0, vr: (seed - 0.5) * 6, t: 0, delay: Math.min(0.25, i * 0.006), bounced: false, plink: i < 14, pitch: 1 + (FIELD_H - uy) / FIELD_H * 0.9 + (i % 5) * 0.03, hits: 0 });
    });
    const cx = sx / n, cy = sy / n;
    const dropPts = res.points - Math.round(res.pops.length * 10 * res.mult) - res.freed * 500;
    if (dropPts > 0) this.float(cx, cy, `+${fmt(dropPts)}`, { color: C.honey, size: 1.3 + Math.min(1.1, n * 0.05), life: 1.3 });
    if (n >= 15) {
      this.slow = 0.3; this.slowT = 0.2;
      this.shake.kick(0.6);
      this.banner_('MEGA DROP!', { sub: `${n} bubbles`, tone: C.pink, dur: 1.5, big: 1.15 });
      if (!quiet) { this.hooks.haptic?.([30, 40, 60]); this.hooks.sfx?.('mega', n); }
    } else if (n >= 8) {
      this.shake.kick(0.35);
      this.banner_('BIG DROP!', { sub: `${n} bubbles`, tone: C.honey, dur: 1.1 });
      if (!quiet) { this.hooks.haptic?.([20, 30, 30]); this.hooks.sfx?.('bigdrop', n); }
    } else if (!quiet) this.hooks.sfx?.('drop', n);
    if (res.freed && !quiet) { this.hooks.sfx?.('memory'); this.hooks.event?.('memory', res); }
    if (!quiet) this.hooks.event?.('drop', res);
  }
  // a burst of particles at a board point: speeds, sizes and gravity in units, drawn in CSS px
  burst(ux, uy, o) {
    const L = this.L;
    if (!L) return;
    const s = L.s;
    this.parts.burst({ ...o, x: L.ux(ux), y: L.uy(uy), speed: o.speed.map((v) => v * s), size: o.size.map((v) => v * s), gravity: (o.gravity || 0) * s });
  }
  burstRainbow(ux, uy, count) {
    this.burst(ux, uy, { count, speed: [5, 15], life: [0.3, 0.7], size: [0.25, 0.55], colors: RAINBOW, shape: 'star', spin: 6, drag: 2.5 });
  }
  // the stack moved by the clock (Endless): its own little story
  playPush(p) { this.pushSteps(p, false); this.run([{ dur: 0.001, start: () => this.sync() }]); }
  sync() {
    if (!this.game) return;
    this.mirror = this.game.board.clone();
    this.shown = this.game.queue.slice();
    this.meterShown = this.game.meter;
    this.missShown = this.game.misses;
    this.sortRows = null;
  }
}
