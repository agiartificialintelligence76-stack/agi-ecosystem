// BLOCKCHAIN on the screen (2026-11-08): one run as the player sees it. Its rules' state (./run.js) and everything that
// moves: blocks landing with a squash, cleared lines sweeping and bursting into squares, the score counting up, the
// chain's links, labels, a piece dragged (or picked with the keys) with its landing spot and the lines it would clear,
// AGI-1's lines, the end of the run. The player, the demo's player (./bot.js) and the title's little board each drive
// one; ./render.js draws it. Its clock is the game loop's (paused with it); sounds, buzzes and lines go out through hooks.
import { PIECES, N, CELLS, fits, apply } from './rules.js';
import { createGame, play, room, inTray } from './run.js';
import { Particles, Shake, FloatText, ease, clamp, lerp } from '../kit/fx.js';
import { REDUCED } from '../kit/env.js';
import { HEX, PAPER, DISPLAY } from './art.js';
import { say as lineOf } from './lines.js';

export const T = Object.freeze({
  pop: 0.2, stagger: 0.017, slide: 0.09,
  clearDelay: 0.08, sweep: 0.22, burst: 0.17,
  lift: 0.13, back: 0.34, deal: 0.42, dealStagger: 0.08,
  say: 2.5, sayGap: 4.5, overBeat: 1.5,
});
const MULTI = ['', '', 'DOUBLE', 'TRIPLE', 'QUAD', 'MEGA', 'GIGA'];
const MULTI_COLOR = ['', '', HEX[0], HEX[1], HEX[2], HEX[4], HEX[6]];
const BIG_CHAINS = new Set([8, 12, 16, 20, 25, 30, 40, 50]);
const noop = () => {};

export class Session {
  // { seed, board (an opening), best (the player's best, for "new best"), ticker (blocks confirmed so far), hooks:
  //   { sfx(name, …), haptic(ms), over(session), pick(list) }, quiet (the title's board: no lines, no sounds) }
  constructor({ seed = 1, board = null, best = null, ticker = 0, hooks = {}, quiet = false } = {}) {
    this.s = createGame({ seed, board });
    this.best = best;
    this.quiet = quiet;
    this.hooks = { sfx: noop, haptic: noop, over: noop, pick: (a) => a[0], ...hooks };
    this.L = null;
    this.time = 0;
    this.freeze = 0;
    this.timers = [];
    // each board cell's landing: when it landed, where it slid from (px)
    this.landT = new Float64Array(CELLS).fill(-9);
    this.slideX = new Float32Array(CELLS);
    this.slideY = new Float32Array(CELLS);
    this.popT = new Float64Array(CELLS).fill(-9);
    this.clearing = [];
    this.beams = [];
    this.labels = [];
    this.floats = new FloatText();
    this.parts = new Particles(720);
    this.shake = new Shake({ max: 11, decay: 2.4 });
    this.tray = [0, 1, 2].map((k) => ({ enter: -k * T.dealStagger, back: null, shake: -9, flash: -9 }));
    this.drag = null;
    this.kb = null;
    this.ghost = null;              // { x, y, ok, rows, cols, cells: Set (blocks that would clear) }
    this.disp = {
      score: 0, scorePop: -9, scoreFlash: -9,
      ticker, tickerTarget: ticker, tickerStep: 0, tickerFlash: -9,
      chainPop: -9, chainBreak: -9, lostLinks: [], glow: -9, glowColor: HEX[0], wave: -9, flash: -9,
      best: -9,
    };
    this.danger = false;
    this.dangerT = -9;
    this.overT = -1;
    this.overDone = false;
    this.bestShown = false;
    this.cleared = 0;
    this.line = null;               // AGI-1's line on the screen: { text, t0 }
    this.lastLine = -99;
    this.lineGone = -99;
    this.grey = null;               // the end: when each cell turns grey
    this.checkDanger(true);
  }

  // ---------- helpers ----------
  get C() { return this.L ? this.L.C : 40; }
  cellX(i) { return this.L.gx + ((i % N) + 0.5) * this.L.C; }
  cellY(i) { return this.L.gy + (((i / N) | 0) + 0.5) * this.L.C; }
  after(dt, fn) { this.timers.push({ at: this.time + dt, fn }); }
  sfx(name, ...args) { if (!this.quiet) this.hooks.sfx(name, ...args); }
  haptic(ms) { if (!this.quiet) this.hooks.haptic(ms); }
  speak(kind, n = 0, { force = false } = {}) {
    if (this.quiet) return;
    if (!force && this.time - this.lastLine < T.sayGap) return;
    this.line = { text: lineOf(kind, n, this.hooks.pick), t0: this.time };
    this.lastLine = this.time;
  }
  get busy() { return this.overT >= 0; }
  // the piece's center when it sits in its tray slot (px), and its size there
  home(slot) { const sl = this.L.slots[slot]; return { x: sl.cx, y: sl.cy }; }

  // ---------- the clock ----------
  update(dt) {
    let vdt = dt;
    if (this.freeze > 0) { this.freeze -= dt; vdt = dt * 0.08; }
    this.time += vdt;
    for (let i = this.timers.length - 1; i >= 0; i--) {
      if (this.time >= this.timers[i].at) { const t = this.timers[i]; this.timers.splice(i, 1); t.fn(); }
    }
    // cleared blocks burst when the sweep reaches them
    for (let k = this.clearing.length - 1; k >= 0; k--) {
      const e = this.clearing[k];
      if (!e.burst && this.time >= e.at) { e.burst = true; this.burstCell(e); }
      if (this.time >= e.at + T.burst) this.clearing.splice(k, 1);
    }
    for (let k = this.beams.length - 1; k >= 0; k--) if (this.time > this.beams[k].t0 + 0.6) this.beams.splice(k, 1);
    for (let k = this.labels.length - 1; k >= 0; k--) if (this.time > this.labels[k].t0 + this.labels[k].life) this.labels.splice(k, 1);
    for (let k = this.disp.lostLinks.length - 1; k >= 0; k--) if (this.time > this.disp.lostLinks[k].t0 + 0.8) this.disp.lostLinks.splice(k, 1);
    this.parts.update(vdt);
    this.floats.update(vdt);
    this.shake.update(vdt);
    // the score counts up, the ticker clicks up one block at a time
    const d = this.disp, target = this.s.score;
    if (d.score < target) d.score = Math.min(target, d.score + Math.max(1, Math.ceil((target - d.score) * Math.min(1, vdt * 9))));
    if (d.ticker < d.tickerTarget) {
      d.tickerStep -= vdt;
      if (d.tickerStep <= 0) { d.ticker++; d.tickerStep = 0.075; d.tickerFlash = this.time; }
    }
    if (this.line && this.time > this.line.t0 + T.say) { this.line = null; this.lineGone = this.time; }
    // a drag lifts quickly; it leans the way it moves
    if (this.drag) {
      const g = this.drag;
      g.tilt = lerp(g.tilt, clamp(g.vx * 0.012, -0.12, 0.12), Math.min(1, dt * 14));
      g.vx *= Math.exp(-dt * 10);
    }
  }

  // ---------- a drop ----------
  // `from`: where the piece was drawn when it was let go (its top-left, px), to slide it into its cells
  drop(slot, x, y, from = null) {
    const t = this.s.tray[slot];
    if (t == null || t < 0) return null;
    const p = PIECES[t];
    // a new block on a cell still bursting: let that one go now
    const covered = new Set(p.offs.map((d) => y * N + x + d));
    for (let k = this.clearing.length - 1; k >= 0; k--) {
      const e = this.clearing[k];
      if (covered.has(e.i)) { if (!e.burst) this.burstCell(e); this.clearing.splice(k, 1); }
    }
    const r = play(this.s, slot, x, y);
    if (!r) return null;
    const now = this.time, C = this.C;
    this.ghost = null;
    this.kb = null;
    const cx = x + p.w / 2, cy = y + p.h / 2;
    const dx = from ? from.x - (this.L.gx + x * C) : 0, dy = from ? from.y - (this.L.gy + y * C) : 0;
    // the blocks land: a squash rippling out from the piece's middle
    const order = r.placed.map((i) => [i, Math.hypot((i % N) + 0.5 - cx, ((i / N) | 0) + 0.5 - cy)]).sort((a, b) => a[1] - b[1]);
    const landing = new Map();
    order.forEach(([i], rank) => {
      this.landT[i] = now;
      this.popT[i] = now + rank * T.stagger;
      this.slideX[i] = dx;
      this.slideY[i] = dy;
      landing.set(i, now + rank * T.stagger);
    });
    this.sfx('place', p.n);
    this.haptic(r.lines ? 0 : 10);
    if (r.lines) this.onClear(r, p, cx, cy, landing, dx, dy);
    else if (r.broke) this.onBreak(r);
    else if (r.chain > 0) {
      // a link drops off the meter
      this.disp.lostLinks.push({ k: r.misses - 1, t0: now });
      this.after(0.05, () => this.sfx('linkLost'));
    }
    if (r.dealt) this.dealt();
    this.checkBest();
    if (r.over) this.startOver();
    else this.checkDanger();
    return r;
  }

  onClear(r, p, cx, cy, landing, dx, dy) {
    const now = this.time, C = this.C, color = HEX[p.color];
    const rows = [], cols = [];
    for (let k = 0; k < N; k++) { if (r.rows & (1 << k)) rows.push(k); if (r.cols & (1 << k)) cols.push(k); }
    // the sweep runs out from the drop along each line; each block bursts as it passes
    let sx = 0, sy = 0;
    for (const { i, c } of r.cleared) {
      const col = i % N, row = (i / N) | 0;
      let dist = 9;
      if (rows.includes(row)) dist = Math.min(dist, Math.abs(col + 0.5 - cx));
      if (cols.includes(col)) dist = Math.min(dist, Math.abs(row + 0.5 - cy));
      let at = now + T.clearDelay + T.sweep * (dist / N);
      const land = landing.get(i);
      if (land != null) at = Math.max(at, land + T.pop * 0.45);
      // the line takes the dropped piece's color (as its preview showed), then bursts in it
      this.clearing.push({ i, c: p.color, was: c, at, burst: false, land: land ?? null, dx: land != null ? dx : 0, dy: land != null ? dy : 0 });
      sx += this.cellX(i); sy += this.cellY(i);
    }
    for (const k of rows) this.beams.push({ row: true, k, o: cx, t0: now + T.clearDelay * 0.5, color });
    for (const k of cols) this.beams.push({ row: false, k, o: cy, t0: now + T.clearDelay * 0.5, color });
    const n = r.cleared.length;
    const mx = clamp(sx / n, this.L.gx + C * 1.6, this.L.gx + C * 6.4), my = clamp(sy / n, this.L.gy + C * 1.2, this.L.gy + C * 6.8);
    const pts = r.parts.clear + r.parts.bonus;
    // labels: several lines at once, the chain, and the points under them (or just the points, floating up)
    const ptsText = `+${pts.toLocaleString('en-US')}`;
    if (r.lines >= 2) {
      this.labels.push({ text: MULTI[Math.min(r.lines, 6)], sub: r.chain >= 2 ? r.chain : 0, pts: ptsText, x: mx, y: my - C * 0.55, t0: now + T.clearDelay, life: 1.2, color: MULTI_COLOR[Math.min(r.lines, 6)], size: C * (0.92 + Math.min(0.3, (r.lines - 2) * 0.12)), rot: -0.08 });
    } else if (r.chain >= 2) {
      this.labels.push({ text: '', sub: r.chain, pts: ptsText, x: mx, y: my - C * 0.3, t0: now + T.clearDelay, life: 1.05, color: HEX[0], size: C * 0.72, rot: -0.06 });
    } else {
      this.after(T.clearDelay + 0.05, () => {
        this.floats.add({ x: mx, y: my, text: ptsText, color: PAPER, size: C * 0.56, life: 1.0, rise: C * 0.9, font: `900 1em ${DISPLAY}` });
      });
    }
    this.sfx('clear', r.lines, r.chain);
    if (r.chain > r.chainBefore && r.chain >= 2) this.after(0.12, () => this.sfx('chainUp', r.chain));
    this.haptic(r.lines >= 2 ? [14, 30, 22] : 16);
    if (r.lines >= 2) this.shake.kick(Math.min(0.62, 0.2 + (r.lines - 2) * 0.14));
    if (r.lines >= 3 && !REDUCED) this.freeze = 0.07;
    this.disp.glow = now;
    this.disp.glowColor = color;
    this.disp.chainPop = now;
    this.disp.scorePop = now + T.clearDelay;
    if (pts >= 600) this.disp.scoreFlash = now + T.clearDelay;
    this.disp.tickerTarget += r.lines;
    this.cleared++;
    if (r.perfect) {
      this.labels.push({ text: 'PERFECT', text2: 'CLEAR', sub: 0, x: this.L.gx + C * 4, y: this.L.gy + C * 3.6, t0: now + 0.22, life: 1.9, color: HEX[2], size: C * 1.05, rot: -0.07, big: true });
      this.disp.wave = now + 0.2;
      this.disp.flash = now + 0.2;
      if (!REDUCED) this.freeze = 0.12;
      this.shake.kick(0.55);
      this.after(0.25, () => this.confetti(this.L.gx + C * 4, this.L.gy + C * 4, 90));
      this.after(0.1, () => this.sfx('perfect'));
      this.haptic([20, 40, 30, 40, 60]);
      this.speak('perfect', 0, { force: true });
    } else if (r.lines >= 3) this.speak('huge', 0, { force: true });
    else if (BIG_CHAINS.has(r.chain)) this.speak('bigChain', r.chain);
    else if (r.chain === 3 || r.chain === 5) this.speak('chain', r.chain);
    else if (r.lines === 2) this.speak('multi');
    else if (this.cleared === 1) this.speak('first');
  }

  onBreak(r) {
    this.disp.chainBreak = this.time;
    this.sfx('broke');
    this.haptic([12, 40, 12]);
    if (r.chainBefore >= 3) this.speak('broke', r.chainBefore);
    const tg = this.L.tag;
    if (tg) this.parts.burst({ x: tg.cx, y: tg.cy, count: 14, speed: [80 * this.C / 40, 220 * this.C / 40], life: [0.3, 0.6], size: [this.C * 0.06, this.C * 0.14], colors: [HEX[5], PAPER], gravity: 600, shape: 'square', spin: 10 });
  }

  // one cleared block bursts into small squares
  burstCell(e) {
    const x = this.cellX(e.i), y = this.cellY(e.i), C = this.C, hex = HEX[e.c] || PAPER;
    const k = C / 40;
    this.parts.burst({ x, y, count: 6, speed: [70 * k, 300 * k], life: [0.35, 0.85], size: [C * 0.1, C * 0.24], colors: [hex, hex, PAPER], gravity: 900 * k, drag: 2.4, shape: 'square', spin: 9, vy: -60 * k });
  }

  confetti(x, y, count = 70) {
    const C = this.C, k = C / 40;
    this.parts.burst({ x, y, count, speed: [160 * k, 520 * k], angle: [Math.PI * 1.1, Math.PI * 1.9], life: [0.9, 1.7], size: [C * 0.09, C * 0.2], colors: HEX, gravity: 700 * k, drag: 1.6, shape: 'square', spin: 12 });
  }

  // a new tray: its three pieces come in one after another
  dealt() {
    for (let k = 0; k < 3; k++) { this.tray[k].enter = this.time + 0.06 + k * T.dealStagger; this.tray[k].back = null; }
    this.after(0.08, () => this.sfx('deal'));
  }

  checkBest() {
    if (this.bestShown || this.best == null || this.best <= 0 || this.s.score <= this.best) return;
    this.bestShown = true;
    this.after(0.35, () => {
      this.disp.best = this.time;
      const sp = this.L.scorePos;
      if (sp) this.confetti(sp.x, sp.y, 60);
      this.sfx('best');
      this.haptic([10, 30, 10, 30]);
      this.speak('best', 0, { force: true });
    });
  }

  checkDanger(first = false) {
    const was = this.danger;
    this.danger = !this.s.over && room(this.s) <= 4;
    if (this.danger && !was && !first) {
      this.dangerT = this.time;
      this.after(0.4, () => { if (this.danger) { this.sfx('danger'); this.speak('danger'); } });
    }
  }

  // the run is over: the pieces that don't fit shake, the board goes grey, a short beat, then the hook
  startOver() {
    this.overT = this.time;
    this.danger = false;
    this.cancelDrag(true);
    this.kb = null;
    this.ghost = null;
    this.grey = new Float64Array(CELLS);
    for (let i = 0; i < CELLS; i++) this.grey[i] = this.time + 0.45 + ((i % N) + ((i / N) | 0)) * 0.035;
    for (const [slot] of inTray(this.s)) this.tray[slot].shake = this.time + 0.1;
    this.labels.push({ text: 'NO ROOM', sub: 0, x: this.L.gx + this.C * 4, y: this.L.gy + this.C * 4, t0: this.time + 0.55, life: 2.5, color: HEX[5], size: this.C * 1.0, rot: -0.06, stay: true });
    this.after(0.12, () => this.sfx('over'));
    this.haptic([30, 60, 30]);
    this.after(T.overBeat, () => { this.overDone = true; this.hooks.over(this); });
  }

  // ---------- dragging a piece ----------
  // the lift: from the tray's size to the board's, floating above a finger (or held where the mouse grabbed it)
  startDrag(slot, px, py, { touch = false, bot = false } = {}) {
    if (this.busy || this.drag) return false;
    const t = this.s.tray[slot];
    if (t == null || t < 0) return false;
    const p = PIECES[t], C = this.C, ts = this.L.ts;
    const h = this.home(slot);
    const tb = this.tray[slot].back;
    const start = tb ? this.backPos(slot) : { x: h.x, y: h.y };
    this.kb = null;
    const fromX = start.x - px, fromY = start.y - py;
    let ox, oy;
    if (touch) { ox = 0; oy = -(p.h * C / 2 + C * 1.15); }
    else {
      const k = C / ts;
      ox = clamp(fromX * k, -p.w * C * 0.45, p.w * C * 0.45);
      oy = clamp(fromY * k, -p.h * C * 0.45, p.h * C * 0.45);
    }
    this.tray[slot].back = null;
    this.drag = { slot, t, p, px, py, ox, oy, fromX, fromY, fromScale: tb ? start.scale : ts / C, touch, bot, t0: this.time, vx: 0, tilt: 0 };
    this.sfx('pick', p.n);
    this.haptic(8);
    this.findGhost();
    return true;
  }
  // where a dragged piece is drawn: its center (px) and its scale (1: the board's size)
  dragPos() {
    const g = this.drag;
    const k = REDUCED ? 1 : clamp((this.time - g.t0) / T.lift, 0, 1), e = ease.outCubic(k);
    return {
      x: g.px + lerp(g.fromX, g.ox, e), y: g.py + lerp(g.fromY, g.oy, e),
      scale: lerp(g.fromScale, 1, REDUCED ? 1 : ease.outBack(k, 2.2)),
    };
  }
  moveDrag(px, py) {
    const g = this.drag;
    if (!g) return;
    g.vx += px - g.px;
    g.px = px; g.py = py;
    this.findGhost();
  }
  // the landing spot: the nearest place it fits, within a cell of where it floats
  findGhost() {
    const g = this.drag, L = this.L, C = this.C;
    const p = g.p;
    const fx = (g.px + g.ox - p.w * C / 2 - L.gx) / C, fy = (g.py + g.oy - p.h * C / 2 - L.gy) / C;
    let best = null, bestD = 1.02 * 1.02;
    for (let y = Math.floor(fy) - 1; y <= Math.ceil(fy) + 1; y++) {
      for (let x = Math.floor(fx) - 1; x <= Math.ceil(fx) + 1; x++) {
        const d = (x - fx) ** 2 + (y - fy) ** 2;
        if (d < bestD && fits(this.s.board, p, x, y)) { bestD = d; best = { x, y }; }
      }
    }
    // keep the current spot unless another is clearly nearer (no flicker between two)
    const cur = this.ghost;
    if (cur && best && (cur.x !== best.x || cur.y !== best.y)) {
      const dc = (cur.x - fx) ** 2 + (cur.y - fy) ** 2;
      if (dc < 1.02 && Math.sqrt(dc) - Math.sqrt(bestD) < 0.16 && fits(this.s.board, p, cur.x, cur.y)) best = { x: cur.x, y: cur.y };
    }
    this.setGhost(best ? best.x : null, best ? best.y : null, p);
  }
  setGhost(x, y, p, ok = true) {
    const cur = this.ghost;
    if (x == null) { this.ghost = null; return; }
    if (cur && cur.x === x && cur.y === y && cur.t === p) return;
    // which lines it would clear, and their blocks
    let rows = 0, cols = 0;
    const cells = new Set();
    if (ok) {
      const b = this.s.board.slice();
      const a = apply(b, p, x, y);
      rows = a.rows; cols = a.cols;
      for (const { i } of a.cleared) cells.add(i);
    }
    this.ghost = { x, y, t: p, ok, rows, cols, cells, t0: this.time };
    this.sfx('hover', y);
  }
  endDrag() {
    const g = this.drag;
    if (!g) return null;
    const pos = this.dragPos(), C = this.C;
    const gh = this.ghost;
    this.drag = null;
    if (gh && gh.ok) {
      const from = { x: pos.x - g.p.w * C / 2, y: pos.y - g.p.h * C / 2 };
      return this.drop(g.slot, gh.x, gh.y, from);
    }
    this.flyBack(g.slot, pos);
    return null;
  }
  cancelDrag(silent = false) {
    const g = this.drag;
    if (!g) return;
    const pos = this.dragPos();
    this.drag = null;
    this.ghost = null;
    this.flyBack(g.slot, pos, silent);
  }
  flyBack(slot, pos, silent = false) {
    this.ghost = null;
    this.tray[slot].back = { x: pos.x, y: pos.y, scale: pos.scale, t0: this.time };
    if (!silent) { this.sfx('back'); this.haptic(6); }
  }
  // a piece flying back to its slot: where it is now
  backPos(slot) {
    const b = this.tray[slot].back, h = this.home(slot);
    const k = clamp((this.time - b.t0) / T.back, 0, 1), e = ease.outBack(k, 1.4);
    return { x: lerp(b.x, h.x, e), y: lerp(b.y, h.y, e), scale: lerp(b.scale, this.L.ts / this.C, ease.outCubic(k)), done: k >= 1 };
  }

  // ---------- the keyboard: 1 2 3 pick, arrows move, Space drops, Esc puts it back ----------
  pickKey(slot) {
    if (this.busy) return;
    const t = this.s.tray[slot];
    if (t == null || t < 0) { this.sfx('nope'); return; }
    if (this.drag) this.cancelDrag(true);
    const p = PIECES[t];
    // start where the last one was, or the fitting spot nearest the middle
    let x = this.kb ? this.kb.x : null, y = this.kb ? this.kb.y : null;
    if (x == null || !fits(this.s.board, p, x, y)) {
      let bestD = Infinity;
      x = Math.round((N - p.w) / 2); y = Math.round((N - p.h) / 2);
      for (let yy = 0; yy + p.h <= N; yy++) {
        for (let xx = 0; xx + p.w <= N; xx++) {
          const d = (xx + p.w / 2 - 4) ** 2 + (yy + p.h / 2 - 4) ** 2;
          if (d < bestD && fits(this.s.board, p, xx, yy)) { bestD = d; x = xx; y = yy; }
        }
      }
    }
    x = clamp(x, 0, N - p.w); y = clamp(y, 0, N - p.h);
    this.kb = { slot, x, y, t0: this.time };
    this.ghost = null;
    this.setGhost(x, y, p, fits(this.s.board, p, x, y));
    this.sfx('pick', p.n);
  }
  moveKey(dx, dy) {
    const k = this.kb;
    if (!k) return;
    const p = PIECES[this.s.tray[k.slot]];
    const nx = clamp(k.x + dx, 0, N - p.w), ny = clamp(k.y + dy, 0, N - p.h);
    if (nx === k.x && ny === k.y) { this.sfx('nope'); return; }
    k.x = nx; k.y = ny;
    this.setGhost(nx, ny, p, fits(this.s.board, p, nx, ny));
  }
  placeKey() {
    const k = this.kb;
    if (!k) return null;
    const p = PIECES[this.s.tray[k.slot]];
    if (!fits(this.s.board, p, k.x, k.y)) {
      this.sfx('nope');
      if (this.ghost) this.ghost.shake = this.time;
      return null;
    }
    const slot = k.slot, from = { x: this.L.gx + k.x * this.C, y: this.L.gy + k.y * this.C - this.C * 0.25 };
    const r = this.drop(slot, k.x, k.y, from);
    // keep the keys going: the next piece left in the tray is picked, at the same spot if it fits
    if (r && !this.busy) {
      const next = [0, 1, 2].map((d) => (slot + d) % 3).find((sl) => this.s.tray[sl] >= 0);
      if (next != null) this.pickKeyAt(next, k.x, k.y);
    }
    return r;
  }
  pickKeyAt(slot, x, y) {
    const t = this.s.tray[slot];
    if (t == null || t < 0) return;
    const p = PIECES[t];
    this.kb = { slot, x: clamp(x, 0, N - p.w), y: clamp(y, 0, N - p.h), t0: this.time };
    if (!fits(this.s.board, p, this.kb.x, this.kb.y)) { this.kb = null; this.pickKey(slot); return; }
    this.setGhost(this.kb.x, this.kb.y, p, true);
  }
  cancelKey() {
    if (!this.kb) return false;
    this.kb = null;
    this.ghost = null;
    this.sfx('back');
    return true;
  }
}
