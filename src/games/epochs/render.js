// EPOCHS: the board on a canvas. "Blueprint lab, top-down 3/4 view": a deep navy floor with a faint blueprint grid,
// raised walls with lavender tops and ink outlines, mint plates, honey buttons, pink lasers, toy crates, and AGI-1 with
// her echoes (./sprite.js). A Scene keeps what's on the screen (where everyone is drawn, doors half open, sparks…) and
// eases it toward the rules' world (./engine.js) after each tick.
import { Particles, FloatText, Shake, ease, clamp, lerp, roundRect } from '../kit/fx.js';
import { REDUCED } from '../kit/env.js';
import { WALL, EXIT, PLATE, TOGGLE, TIMER, DOOR, EMIT, ARROW, VOID, neighbor } from './engine.js';
import { createSprites, TINTS, BOX } from './sprite.js';

export const C = {
  bg: '#120f26', bg2: '#0c0a1c', floor: '#1b1742', floorEdge: '#2a2560', grid: 'rgba(150,170,255,0.09)', mark: 'rgba(170,185,255,0.22)',
  ink: '#170a36', wallTop: '#cdb8ff', wallTop2: '#e4d9ff', wallFront: '#6c56c8', wallFront2: '#4b3a9c',
  mint: '#3ff0c3', mintDk: '#14866b', honey: '#ffc933', honeyDk: '#a8770a', orange: '#ff9a3d', orangeDk: '#a5520f',
  pink: '#ff4da6', violet: '#6b3bff', violet2: '#8b66ff', paper: '#fffaf0', lav: '#e4d9ff',
  crateTop: '#ffe8b8', crateFront: '#d9a95c', crateDk: '#a8742c',
};
const DEVICE = {
  [PLATE]: { top: C.mint, dk: C.mintDk },
  [TOGGLE]: { top: C.honey, dk: C.honeyDk },
  [TIMER]: { top: C.orange, dk: C.orangeDk },
};
const WALL_K = 0.3;          // walls' height, in tiles
const MOVE_S = 0.13;         // a step's slide (s)

// where the board goes in an area, as big as fits
export function boardGeo(L, area, maxS = 78, bleed = 0) {
  const s = Math.max(8, Math.floor(Math.min(area.w / (L.w - bleed * 2), area.h / (L.h + WALL_K), maxS)));
  const h = Math.round(s * WALL_K);
  const bw = L.w * s, bh = L.h * s + h;
  const x0 = Math.round(area.x + (area.w - bw) / 2);
  const y0 = Math.round(area.y + (area.h - bh) / 2 + h);
  return { s, h, x0, y0, bw, bh };
}

// ---------- glyphs that pair a device with its door (shape, not only color) ----------
function glyph(g, id, x, y, r) {
  g.beginPath();
  switch (id % 8) {
    case 0: g.arc(x, y, r * 0.8, 0, Math.PI * 2); break;
    case 1: g.moveTo(x, y - r); g.lineTo(x + r * 0.95, y + r * 0.75); g.lineTo(x - r * 0.95, y + r * 0.75); g.closePath(); break;
    case 2: g.rect(x - r * 0.75, y - r * 0.75, r * 1.5, r * 1.5); break;
    case 3: g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.closePath(); break;
    case 4: for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; g[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); break;
    case 5: for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); break;
    case 6: g.rect(x - r * 0.28, y - r, r * 0.56, r * 2); g.rect(x - r, y - r * 0.28, r * 2, r * 0.56); break;
    default: g.arc(x, y, r, 0, Math.PI * 2); g.moveTo(x + r * 0.45, y); g.arc(x, y, r * 0.45, 0, Math.PI * 2, true);
  }
}

export class Scene {
  constructor() {
    this.parts = new Particles(420);
    this.floats = new FloatText();
    this.shake = new Shake({ max: 10, decay: 2.4 });
    this.time = 0;
    this.geo = null;
    this.L = null;
    this.bodies = [];
    this.boxes = [];
    this.doorO = new Float32Array(0);
    this.plateP = new Float32Array(0);
    this.flash = 0; this.flashColor = C.pink;
    this.rewind = 0;             // > 0 while the rewind plays (seconds left)
    this.rewindEpoch = 1;
    this.win = 0;                // seconds since the win (or -1)
    this.zapT = -1;
    this.banner = null;          // { text, sub, t }
    this.youT = 0;               // the "you" marker over the live AGI-1 at an epoch's start
    this.sprites = null; this.spriteKey = '';
    this.layers = null;
    this.beamSparkT = 0;
  }

  // a new level (or the same one again, from the start)
  load(L, world, dpr) {
    this.L = L;
    this.doorO = new Float32Array(L.n);
    this.plateP = new Float32Array(L.n);
    this.layers = null;
    this.win = -1; this.zapT = -1; this.banner = null; this.rewind = 0;
    this.parts.clear(); this.floats.clear();
    this.sync(world, { instant: true });
    this.dpr = dpr;
  }

  // the world as it is now: everyone placed at once (instant) or eased there
  sync(W, { instant = false, undo = false } = {}) {
    const L = this.L;
    const n = W.n;
    while (this.bodies.length > n) this.bodies.pop();
    for (let i = 0; i < n; i++) {
      const p = W.bp[i], x = p % L.w, y = (p / L.w) | 0;
      let b = this.bodies[i];
      if (!b) { b = this.bodies[i] = { x, y, fx: x, fy: y, tx: x, ty: y, t: 1, dir: 2, hop: 0, sq: 0, alpha: 1, gone: false, fade: 0, glitch: 0, spawn: 1, bump: 0, bx: 0, by: 0, step: 0 }; }
      b.live = i === n - 1;
      b.tint = b.live ? -1 : i;
      b.dir = W.bd[i];
      const gone = W.bs[i] === 2;
      if (instant) { b.x = b.fx = b.tx = x; b.y = b.fy = b.ty = y; b.t = 1; b.gone = gone; b.fade = gone ? 1 : 0; b.alpha = gone ? 0 : 1; }
      else if (b.tx !== x || b.ty !== y) { b.fx = b.x; b.fy = b.y; b.tx = x; b.ty = y; b.t = 0; b.dur = undo ? 0.1 : MOVE_S; }
      if (!instant && b.gone !== gone) { b.gone = gone; b.fade = gone ? 0.001 : 0; if (!gone) b.alpha = 1; }
    }
    while (this.boxes.length > W.boxes.length) this.boxes.pop();
    for (let i = 0; i < W.boxes.length; i++) {
      const p = W.boxes[i], x = p % L.w, y = (p / L.w) | 0;
      let k = this.boxes[i];
      if (!k) k = this.boxes[i] = { x, y, fx: x, fy: y, tx: x, ty: y, t: 1, dur: MOVE_S };
      if (instant) { k.x = k.fx = k.tx = x; k.y = k.fy = k.ty = y; k.t = 1; }
      else if (k.tx !== x || k.ty !== y) { k.fx = k.x; k.fy = k.y; k.tx = x; k.ty = y; k.t = 0; k.dur = undo ? 0.1 : MOVE_S; }
    }
    this.world = W;
    if (instant) {
      for (let p = 0; p < L.n; p++) { this.doorO[p] = W.open[p]; this.plateP[p] = W.pressed[p]; }
    }
  }

  // ---------- a tick's events: the little moments ----------
  react(ev, { sfx } = {}) {
    const L = this.L, g = this.geo;
    const cell = (p) => this.center(p % L.w, (p / L.w) | 0);
    for (const e of ev) {
      const b = e.i != null ? this.bodies[e.i] : null;
      switch (e.type) {
        case 'move':
          if (b) { b.hop = 1; b.step ^= 1; }
          break;
        case 'bump':
          if (b) { b.bump = 1; b.bx = [0, 1, 0, -1][e.a]; b.by = [-1, 0, 1, 0][e.a]; }
          break;
        case 'push': {
          const k = this.boxes[e.box];
          if (k && g) { const c = cell(e.to); this.parts.burst({ x: c.x, y: c.y + g.s * 0.3, count: 6, speed: [20, 70], life: [0.2, 0.4], size: [2, 4], colors: ['#d9c8ff', '#8b78c8'], drag: 4 }); }
          break;
        }
        case 'door': {
          if (!g) break;
          const c = cell(e.p);
          this.parts.burst({ x: c.x, y: c.y, count: e.open ? 10 : 6, speed: [30, 110], life: [0.25, 0.5], size: [2, 4], colors: e.open ? [C.mint, '#fff'] : ['#a99bd6'], drag: 3 });
          if (!e.open && !REDUCED) this.shake.kick(0.12);
          break;
        }
        case 'toggle': case 'timer':
          if (g) { const c = cell(e.p); this.parts.burst({ x: c.x, y: c.y, count: 10, speed: [40, 130], life: [0.3, 0.6], size: [2, 5], colors: [C.honey, '#fff'], shape: 'square', drag: 3 }); }
          break;
        case 'desync':
          if (b) { b.glitch = 0.45; const c = this.bodyPos(b); this.floats.add({ x: c.x, y: c.y - g.s * 1.2, text: 'desync', color: TINTS[e.i % 4], size: Math.max(11, g.s * 0.28), life: 0.8, rise: g.s * 0.4, font: "800 1em 'AK Mono', monospace" }); }
          break;
        case 'deprecate':
          if (b) {
            b.zapped = 0.001;
            const c = cell(e.p);
            this.parts.burst({ x: c.x, y: c.y - g.s * 0.3, count: 22, speed: [60, 220], life: [0.3, 0.7], size: [2, 5], colors: [C.pink, '#fff', TINTS[e.i % 4]], shape: 'spark', drag: 2.5 });
            this.floats.add({ x: c.x, y: c.y - g.s * 1.1, text: 'deprecated', color: C.pink, size: Math.max(12, g.s * 0.3), life: 1.1, rise: g.s * 0.6, font: "800 1em 'AK Mono', monospace" });
          }
          break;
        case 'zap': {
          const c = cell(e.p);
          this.zapT = 0;
          this.flash = 0.55; this.flashColor = C.pink;
          this.shake.kick(0.55);
          this.parts.burst({ x: c.x, y: c.y - g.s * 0.4, count: 34, speed: [80, 300], life: [0.35, 0.8], size: [2, 6], colors: [C.pink, '#fff', C.honey], shape: 'spark', drag: 2 });
          break;
        }
        case 'win':
          this.win = 0;
          break;
        default:
      }
    }
    sfx?.(ev);
  }

  // ---------- the new epoch: rewind, then the echoes appear one by one ----------
  startRewind(epoch) {
    this.rewind = REDUCED ? 0.3 : 0.75;
    this.rewindTotal = this.rewind;
    this.rewindEpoch = epoch;
    for (const b of this.bodies) { b.spawn = 0; }
    this.youT = 2.2;
  }

  center(x, y) {
    const g = this.geo;
    return { x: g.x0 + (x + 0.5) * g.s, y: g.y0 + (y + 0.5) * g.s };
  }
  bodyPos(b) { return this.center(b.x, b.y); }

  update(dt) {
    this.time += dt;
    this.parts.update(dt); this.floats.update(dt); this.shake.update(dt);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 1.6);
    if (this.zapT >= 0) this.zapT += dt;
    if (this.win >= 0) this.win += dt;
    if (this.youT > 0) this.youT -= dt;
    if (this.banner) this.banner.t += dt;
    const rewinding = this.rewind > 0;
    if (rewinding) this.rewind = Math.max(0, this.rewind - dt);
    for (const [i, b] of this.bodies.entries()) {
      if (b.t < 1) {
        b.t = Math.min(1, b.t + dt / (b.dur || MOVE_S));
        const k = ease.outCubic(b.t);
        b.x = lerp(b.fx, b.tx, k); b.y = lerp(b.fy, b.ty, k);
        if (b.t >= 1) b.sq = 1;
      }
      if (b.hop > 0) b.hop = Math.max(0, b.hop - dt / MOVE_S);
      if (b.sq > 0) b.sq = Math.max(0, b.sq - dt * 7);
      if (b.bump > 0) b.bump = Math.max(0, b.bump - dt * 7);
      if (b.glitch > 0) b.glitch = Math.max(0, b.glitch - dt);
      if (b.zapped > 0) { b.zapped += dt; }
      if (b.gone) b.fade = Math.min(1, (b.fade || 0) + dt * 3);
      // after a rewind, the echoes pop in one after another, then the live AGI-1
      if (!rewinding && b.spawn < 1) {
        const delay = REDUCED ? 0 : 0.1 * i;
        b.spawnDelay = (b.spawnDelay ?? delay) - dt;
        if (b.spawnDelay <= 0) {
          if (b.spawn === 0 && this.geo) {
            const c = this.bodyPos(b);
            this.parts.burst({ x: c.x, y: c.y - this.geo.s * 0.45, count: b.live ? 14 : 10, speed: [30, 120], life: [0.3, 0.6], size: [2, 4], colors: b.live ? [C.honey, '#fff'] : [TINTS[i % 4], '#fff'], shape: 'star', drag: 3 });
            this.onSpawn?.(i, b.live);
          }
          b.spawn = Math.min(1, b.spawn + dt / 0.28);
          if (b.spawn >= 1) b.spawnDelay = undefined;
        }
      }
    }
    for (const k of this.boxes) {
      if (k.t < 1) { k.t = Math.min(1, k.t + dt / (k.dur || MOVE_S)); const e = ease.outCubic(k.t); k.x = lerp(k.fx, k.tx, e); k.y = lerp(k.fy, k.ty, e); }
    }
    const W = this.world, L = this.L;
    if (W && L) {
      const rate = dt * (REDUCED ? 30 : 9);
      for (let p = 0; p < L.n; p++) {
        if (L.kind[p] === DOOR) this.doorO[p] += (W.open[p] - this.doorO[p]) * Math.min(1, rate);
        else if (L.kind[p] === PLATE || L.kind[p] === TOGGLE || L.kind[p] === TIMER) this.plateP[p] += (W.pressed[p] - this.plateP[p]) * Math.min(1, rate * 1.4);
      }
      // sparks where a beam is stopped
      this.beamSparkT -= dt;
      if (this.beamSparkT <= 0 && this.geo) {
        this.beamSparkT = REDUCED ? 0.3 : 0.07;
        for (const bm of W.beams) {
          if (bm.end < 0) continue;
          const end = this.beamEnd(bm);
          this.parts.burst({ x: end.x, y: end.y, count: 2, speed: [40, 140], life: [0.15, 0.35], size: [1.5, 3], colors: [C.pink, '#fff'], shape: 'spark', drag: 3, angle: [0, Math.PI * 2] });
        }
      }
    }
  }

  // where a beam stops (the edge of what stopped it), at waist height
  beamEnd(bm) {
    const L = this.L, g = this.geo, s = g.s, lift = s * 0.28;
    const ex = bm.end % L.w, ey = (bm.end / L.w) | 0;
    const c = this.center(ex, ey);
    const d = bm.dir, dx = [0, 1, 0, -1][d], dy = [-1, 0, 1, 0][d];
    const solid = L.kind[bm.end] === WALL || L.kind[bm.end] === EMIT || L.kind[bm.end] === DOOR || L.kind[bm.end] === VOID;
    const back = bm.hit ? 0.18 : solid ? 0.5 : 0.36;
    return { x: c.x - dx * s * back, y: c.y - dy * s * back - lift };
  }

  // ---------- the static layers: the floor (with its grid), and each row's walls ----------
  buildLayers(dpr) {
    const L = this.L, g = this.geo, s = g.s, h = g.h;
    const mk = (w, hh) => { const c = document.createElement('canvas'); c.width = Math.ceil(w * dpr); c.height = Math.ceil(hh * dpr); const x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); return [c, x]; };
    const pad = s * 0.5;
    const [floor, f] = mk(g.bw + pad * 2, g.bh + pad * 2);
    // floor: every cell that isn't void, as one blueprint sheet
    const ox = pad, oy = pad + h;
    const isFloor = (x, y) => x >= 0 && y >= 0 && x < L.w && y < L.h && L.kind[y * L.w + x] !== VOID;
    f.fillStyle = C.floor;
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) if (isFloor(x, y)) f.fillRect(ox + x * s, oy + y * s, s + 0.5, s + 0.5);
    // the blueprint grid: fine lines, and small crosses at the corners
    f.strokeStyle = C.grid; f.lineWidth = 1;
    f.beginPath();
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
      if (!isFloor(x, y) || L.kind[y * L.w + x] === WALL) continue;
      const X = ox + x * s, Y = oy + y * s;
      f.moveTo(X + 0.5, Y); f.lineTo(X + 0.5, Y + s);
      f.moveTo(X, Y + 0.5); f.lineTo(X + s, Y + 0.5);
      f.moveTo(X + s / 2, Y + s * 0.25); f.lineTo(X + s / 2, Y + s * 0.75);
    }
    f.stroke();
    f.strokeStyle = C.mark; f.lineWidth = 1.2;
    f.beginPath();
    const m = Math.max(2, s * 0.06);
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
      if (!isFloor(x, y) || L.kind[y * L.w + x] === WALL) continue;
      const X = ox + x * s, Y = oy + y * s;
      f.moveTo(X - m, Y); f.lineTo(X + m, Y); f.moveTo(X, Y - m); f.lineTo(X, Y + m);
    }
    f.stroke();
    // soft shadows on the floor along the walls (depth)
    const solidAt = (x, y) => x < 0 || y < 0 || x >= L.w || y >= L.h || L.kind[y * L.w + x] === WALL || L.kind[y * L.w + x] === EMIT;
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
      if (!isFloor(x, y) || solidAt(x, y)) continue;
      const X = ox + x * s, Y = oy + y * s;
      if (solidAt(x, y - 1)) { const gr = f.createLinearGradient(0, Y, 0, Y + s * 0.34); gr.addColorStop(0, 'rgba(5,3,18,0.5)'); gr.addColorStop(1, 'rgba(5,3,18,0)'); f.fillStyle = gr; f.fillRect(X, Y, s, s * 0.34); }
      if (solidAt(x - 1, y)) { const gr = f.createLinearGradient(X, 0, X + s * 0.16, 0); gr.addColorStop(0, 'rgba(5,3,18,0.32)'); gr.addColorStop(1, 'rgba(5,3,18,0)'); f.fillStyle = gr; f.fillRect(X, Y, s * 0.16, s); }
      if (solidAt(x + 1, y)) { const gr = f.createLinearGradient(X + s, 0, X + s * 0.84, 0); gr.addColorStop(0, 'rgba(5,3,18,0.32)'); gr.addColorStop(1, 'rgba(5,3,18,0)'); f.fillStyle = gr; f.fillRect(X + s * 0.84, Y, s * 0.16, s); }
    }
    // one-way floors: chevrons drawn later (they move); here, their tile tint
    for (let p = 0; p < L.n; p++) {
      if (L.kind[p] !== ARROW) continue;
      const X = ox + (p % L.w) * s, Y = oy + ((p / L.w) | 0) * s;
      f.fillStyle = 'rgba(139,102,255,0.16)';
      roundRect(f, X + s * 0.08, Y + s * 0.08, s * 0.84, s * 0.84, s * 0.14); f.fill();
    }
    this.layers = { floor, ox: g.x0 - pad, oy: g.y0 - h - pad, rows: [] };
    // walls, one canvas a row (so things standing in front of a wall are drawn after it)
    const wallAt = (x, y) => x >= 0 && y >= 0 && x < L.w && y < L.h && (L.kind[y * L.w + x] === WALL || L.kind[y * L.w + x] === EMIT);
    const lw = Math.max(1.5, s * 0.05);
    for (let y = 0; y < L.h; y++) {
      const [row, r] = mk(g.bw + pad * 2, s + h + pad);
      const ry = h;               // this row's floor top in the strip
      for (let x = 0; x < L.w; x++) {
        if (!wallAt(x, y)) continue;
        const X = pad + x * s, Y = ry;
        const front = !wallAt(x, y + 1);
        const emit = L.kind[y * L.w + x] === EMIT;
        // the front face
        if (front) {
          const gr = r.createLinearGradient(0, Y + s - h, 0, Y + s);
          gr.addColorStop(0, emit ? '#3a2b74' : C.wallFront); gr.addColorStop(1, emit ? '#241a52' : C.wallFront2);
          r.fillStyle = gr; r.fillRect(X, Y + s - h, s, h);
        }
        // the top: flat lavender (the outer ring a touch deeper), lit along its open edges
        const outer = x === 0 || y === 0 || x === L.w - 1 || y === L.h - 1;
        r.fillStyle = emit ? '#4a3a8c' : outer ? '#b49cf0' : C.wallTop;
        r.fillRect(X, Y - h, s + 0.5, s + 0.5);
        if (!emit) {
          const hl = Math.max(2, s * 0.07);
          r.fillStyle = C.wallTop2;
          if (!wallAt(x, y - 1)) r.fillRect(X, Y - h, s + 0.5, hl);
          if (!wallAt(x - 1, y)) r.fillRect(X, Y - h, hl, s);
          r.fillStyle = 'rgba(23,10,54,0.07)';
          if (wallAt(x + 1, y) && L.kind[y * L.w + x + 1] !== EMIT) r.fillRect(X + s - 0.5, Y - h + s * 0.2, 1, s * 0.6);
          if (wallAt(x, y + 1)) r.fillRect(X + s * 0.2, Y - h + s - 0.5, s * 0.6, 1);
        }
      }
      // outlines only where a wall meets something else (merged blocks)
      r.strokeStyle = C.ink; r.lineWidth = lw; r.lineCap = 'round';
      r.beginPath();
      for (let x = 0; x < L.w; x++) {
        if (!wallAt(x, y)) continue;
        const X = pad + x * s, Y = ry - h;
        if (!wallAt(x, y - 1)) { r.moveTo(X, Y); r.lineTo(X + s, Y); }
        if (!wallAt(x - 1, y)) { r.moveTo(X, Y); r.lineTo(X, Y + s + (wallAt(x, y + 1) ? 0 : h)); }
        if (!wallAt(x + 1, y)) { r.moveTo(X + s, Y); r.lineTo(X + s, Y + s + (wallAt(x, y + 1) ? 0 : h)); }
        if (!wallAt(x, y + 1)) { r.moveTo(X, Y + s); r.lineTo(X + s, Y + s); r.moveTo(X, Y + s + h); r.lineTo(X + s, Y + s + h); }
      }
      r.stroke();
      // emitters: a lens toward the beam
      for (let x = 0; x < L.w; x++) {
        const p = y * L.w + x;
        if (L.kind[p] !== EMIT) continue;
        const d = L.arg[p];
        const cx = pad + x * s + s / 2 + [0, 1, 0, -1][d] * s * 0.32, cy = ry - h + s / 2 + [-1, 0, 1, 0][d] * s * 0.32;
        r.fillStyle = C.ink; r.beginPath(); r.arc(cx, cy, s * 0.2, 0, Math.PI * 2); r.fill();
        r.fillStyle = C.pink; r.beginPath(); r.arc(cx, cy, s * 0.14, 0, Math.PI * 2); r.fill();
        r.fillStyle = '#ffd1e8'; r.beginPath(); r.arc(cx - s * 0.04, cy - s * 0.04, s * 0.045, 0, Math.PI * 2); r.fill();
      }
      this.layers.rows.push(row);
    }
    this.layers.pad = pad;
  }

  ensureSprites(dpr) {
    const u = this.geo.s, key = `${u}@${dpr}`;
    if (this.spriteKey !== key) { this.sprites = createSprites(u, dpr); this.spriteKey = key; }
  }

  // ---------- one frame ----------
  draw(g2, view, { dim = 0, hud = null, quiet = false } = {}) {
    const L = this.L, geo = this.geo;
    if (!L || !geo) return;
    const dpr = view.dpr;
    if (!this.layers || this.layers.dpr !== dpr || this.layers.s !== geo.s || this.layers.x0 !== geo.x0 || this.layers.y0 !== geo.y0) {
      this.buildLayers(dpr); this.layers.dpr = dpr; this.layers.s = geo.s; this.layers.x0 = geo.x0; this.layers.y0 = geo.y0;
    }
    this.ensureSprites(dpr);
    const s = geo.s, h = geo.h, t = this.time, W = this.world;
    g2.save();
    this.shake.apply(g2, view.w / 2, view.h / 2);
    // the rewind: the board shudders sideways a little, in bands
    const rw = this.rewind > 0 ? this.rewind / this.rewindTotal : 0;
    const lay = this.layers;
    g2.drawImage(lay.floor, lay.ox, lay.oy, lay.floor.width / dpr, lay.floor.height / dpr);

    // floor things: the exit, plates and buttons, open doors' slots, arrows
    for (let p = 0; p < L.n; p++) {
      const k = L.kind[p];
      if (k === 0 || k === 1 || k === WALL || k === EMIT) continue;
      const x = geo.x0 + (p % L.w) * s, y = geo.y0 + ((p / L.w) | 0) * s;
      if (k === EXIT) this.drawExit(g2, x, y, s, t);
      else if (k === PLATE || k === TOGGLE || k === TIMER) this.drawDevice(g2, x, y, s, p, t);
      else if (k === DOOR) this.drawDoorSlot(g2, x, y, s, p);
      else if (k === ARROW) this.drawArrow(g2, x, y, s, L.arg[p], t);
    }

    // row by row: walls, doors, boxes, beams, then whoever stands in that row
    const order = this._order || (this._order = []);
    for (let row = 0; row < L.h; row++) {
      g2.drawImage(lay.rows[row], lay.ox, geo.y0 + row * s - h - 0, lay.rows[row].width / dpr, lay.rows[row].height / dpr);
      for (let x = 0; x < L.w; x++) {
        const p = row * L.w + x;
        if (L.kind[p] === DOOR) this.drawDoorBlock(g2, geo.x0 + x * s, geo.y0 + row * s, s, h, p);
      }
      for (const k of this.boxes) if (Math.round(k.y) === row) this.drawCrate(g2, geo.x0 + k.x * s, geo.y0 + k.y * s, s);
      if (W) for (const bm of W.beams) this.drawBeamRow(g2, bm, row, t);
      order.length = 0;
      for (const b of this.bodies) if (Math.round(b.y) === row) order.push(b);
      order.sort((a, b) => (a.live ? 1 : 0) - (b.live ? 1 : 0) || a.y - b.y);
      for (const b of order) this.drawBody(g2, b, s);
    }

    this.parts.draw(g2);
    if (!quiet) this.floats.draw(g2);
    g2.restore();

    // over the board: the rewind's lines, a flash, the win, a banner (none of it behind the title's words)
    if (rw > 0 && !quiet) this.drawRewind(g2, view, rw);
    if (this.flash > 0 && !REDUCED) { g2.globalAlpha = this.flash * 0.35; g2.fillStyle = this.flashColor; g2.fillRect(0, 0, view.w, view.h); g2.globalAlpha = 1; }
    if (dim > 0) { g2.fillStyle = `rgba(12,10,28,${dim})`; g2.fillRect(0, 0, view.w, view.h); }
    if (this.banner && !quiet) this.drawBanner(g2, view);
    if (hud) this.drawHud(g2, view, hud);
  }

  drawExit(g, x, y, s, t) {
    const cx = x + s / 2, cy = y + s / 2;
    const glow = g.createRadialGradient(cx, cy, s * 0.1, cx, cy, s * 0.62);
    glow.addColorStop(0, 'rgba(255,201,51,0.42)'); glow.addColorStop(1, 'rgba(255,201,51,0)');
    g.fillStyle = glow; g.fillRect(x - s * 0.2, y - s * 0.2, s * 1.4, s * 1.4);
    g.fillStyle = '#2a1460';
    g.beginPath(); g.ellipse(cx, cy, s * 0.42, s * 0.36, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = C.ink; g.lineWidth = Math.max(1.5, s * 0.05); g.stroke();
    const pulse = 0.5 + 0.5 * Math.sin(t * 3);
    g.strokeStyle = C.honey; g.lineWidth = Math.max(1.5, s * 0.06);
    g.setLineDash([s * 0.12, s * 0.08]); g.lineDashOffset = -t * s * 0.5;
    g.beginPath(); g.ellipse(cx, cy, s * 0.32, s * 0.27, 0, 0, Math.PI * 2); g.stroke();
    g.setLineDash([]);
    g.fillStyle = `rgba(255,201,51,${0.45 + pulse * 0.4})`;
    g.beginPath(); g.ellipse(cx, cy, s * 0.2, s * 0.17, 0, 0, Math.PI * 2); g.fill();
    // a column of light rising out of it
    const beam = g.createLinearGradient(0, cy - s * 0.95, 0, cy);
    beam.addColorStop(0, 'rgba(255,240,190,0)'); beam.addColorStop(1, `rgba(255,240,190,${0.35 + pulse * 0.2})`);
    g.fillStyle = beam;
    g.beginPath(); g.moveTo(cx - s * 0.2, cy); g.lineTo(cx - s * 0.12, cy - s * 0.95); g.lineTo(cx + s * 0.12, cy - s * 0.95); g.lineTo(cx + s * 0.2, cy); g.closePath(); g.fill();
    // a little up-arrow of light
    g.fillStyle = '#fff6d6';
    const ay = cy - s * 0.02 - pulse * s * 0.06;
    g.beginPath(); g.moveTo(cx, ay - s * 0.11); g.lineTo(cx + s * 0.09, ay); g.lineTo(cx - s * 0.09, ay); g.closePath(); g.fill();
  }

  drawDevice(g, x, y, s, p, t) {
    const L = this.L, k = L.kind[p], id = L.arg[p], col = DEVICE[k], pr = this.plateP[p];
    const W = this.world;
    const cx = x + s / 2, cy = y + s / 2, lw = Math.max(1.5, s * 0.05);
    if (k === PLATE) {
      const m = s * 0.16, sink = pr * s * 0.04;
      g.fillStyle = col.dk; roundRect(g, x + m, y + m + s * 0.04, s - m * 2, s - m * 2, s * 0.12); g.fill();
      g.fillStyle = pr > 0.5 ? '#9cffe4' : col.top;
      roundRect(g, x + m, y + m - s * 0.04 + sink, s - m * 2, s - m * 2, s * 0.12); g.fill();
      g.strokeStyle = C.ink; g.lineWidth = lw; g.stroke();
      if (pr > 0.02) { g.globalAlpha = pr * (0.45 + 0.15 * Math.sin(t * 6)); g.strokeStyle = C.mint; g.lineWidth = s * 0.08; roundRect(g, x + m * 0.55, y + m * 0.55, s - m * 1.1, s - m * 1.1, s * 0.16); g.stroke(); g.globalAlpha = 1; }
      g.fillStyle = C.ink; glyph(g, id, cx, cy - s * 0.04 + sink, s * 0.12); g.fill();
      return;
    }
    // round buttons: a toggle (lit while its door is flipped open) or a timer (its ticks around it)
    const on = k === TOGGLE ? Boolean(W && (W.base >> id) & 1) : Boolean(W && W.timers[id] > 0);
    const r = s * 0.3, sink = pr * s * 0.035;
    g.fillStyle = col.dk; g.beginPath(); g.ellipse(cx, cy + s * 0.05, r, r * 0.85, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = on ? '#fff3c4' : col.top;
    g.beginPath(); g.ellipse(cx, cy - s * 0.03 + sink, r, r * 0.85, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = C.ink; g.lineWidth = lw; g.stroke();
    if (k === TIMER) {
      const n = L.devs[id].ticks, left = W ? W.timers[id] : 0;
      for (let i = 0; i < n; i++) {
        const a0 = -Math.PI / 2 + (i / n) * Math.PI * 2 + 0.12, a1 = -Math.PI / 2 + ((i + 1) / n) * Math.PI * 2 - 0.12;
        g.strokeStyle = i < left ? C.honey : 'rgba(255,255,255,0.18)'; g.lineWidth = s * 0.06;
        g.beginPath(); g.ellipse(cx, cy - s * 0.03, r + s * 0.09, (r + s * 0.09) * 0.85, 0, a0, a1); g.stroke();
      }
    } else if (on) {
      g.globalAlpha = 0.35 + 0.2 * Math.sin(t * 5); g.strokeStyle = C.honey; g.lineWidth = s * 0.07;
      g.beginPath(); g.ellipse(cx, cy - s * 0.03, r + s * 0.08, (r + s * 0.08) * 0.85, 0, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1;
    }
    g.fillStyle = C.ink; glyph(g, id, cx, cy - s * 0.04 + sink, s * 0.11); g.fill();
  }

  doorColor(p) {
    const L = this.L, d = L.devs[L.arg[p]];
    return DEVICE[d ? d.type : PLATE];
  }
  drawDoorSlot(g, x, y, s, p) {
    const o = this.doorO[p];
    const col = this.doorColor(p);
    g.fillStyle = '#0f0c26';
    roundRect(g, x + s * 0.06, y + s * 0.06, s * 0.88, s * 0.88, s * 0.1); g.fill();
    g.strokeStyle = col.top; g.globalAlpha = 0.35 + 0.65 * o; g.lineWidth = Math.max(1, s * 0.04);
    g.setLineDash([s * 0.1, s * 0.07]);
    roundRect(g, x + s * 0.1, y + s * 0.1, s * 0.8, s * 0.8, s * 0.08); g.stroke();
    g.setLineDash([]); g.globalAlpha = 1;
    if (o > 0.6) { g.fillStyle = col.top; g.globalAlpha = (o - 0.6) * 0.6; glyph(g, this.L.arg[p], x + s / 2, y + s / 2, s * 0.12); g.fill(); g.globalAlpha = 1; }
  }
  drawDoorBlock(g, x, y, s, h, p) {
    const o = this.doorO[p];
    if (o > 0.985) return;
    const col = this.doorColor(p);
    const k = 1 - ease.inOutQuad(clamp(o, 0, 1));
    const rise = h * k;                   // how far its top stands over the floor
    const lw = Math.max(1.5, s * 0.05), m = s * 0.04;
    // a door: a block like a wall, in its device's color, sinking into the floor as it opens
    const top = y - rise;
    g.fillStyle = col.dk; g.fillRect(x + m, top + s - m * 2, s - m * 2, rise);
    g.fillStyle = col.top; g.fillRect(x + m, top, s - m * 2, s - m * 2);
    // stripes on its top
    g.save(); g.beginPath(); g.rect(x + m, top, s - m * 2, s - m * 2); g.clip();
    g.strokeStyle = 'rgba(23,10,54,0.22)'; g.lineWidth = s * 0.08;
    g.beginPath();
    for (let i = -2; i < 4; i++) { g.moveTo(x + i * s * 0.32, top + s); g.lineTo(x + i * s * 0.32 + s, top); }
    g.stroke(); g.restore();
    g.strokeStyle = C.ink; g.lineWidth = lw;
    g.strokeRect(x + m, top, s - m * 2, s - m * 2 + rise);
    g.beginPath(); g.moveTo(x + m, top + s - m * 2); g.lineTo(x + s - m, top + s - m * 2); g.stroke();
    // its glyph, in a paper disc
    g.fillStyle = C.paper; g.beginPath(); g.arc(x + s / 2, top + s * 0.46, s * 0.17, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = C.ink; glyph(g, this.L.arg[p], x + s / 2, top + s * 0.46, s * 0.1); g.fill();
    // a timed door: its ticks left as dots
    const d = this.L.devs[this.L.arg[p]];
    if (d && d.type === TIMER && this.world) {
      const left = this.world.timers[d.id];
      for (let i = 0; i < d.ticks; i++) { g.fillStyle = i < left ? C.honey : 'rgba(23,10,54,0.35)'; g.beginPath(); g.arc(x + s / 2 + (i - (d.ticks - 1) / 2) * s * 0.16, top + s * 0.8, s * 0.05, 0, Math.PI * 2); g.fill(); }
    }
  }
  drawArrow(g, x, y, s, d, t) {
    const cx = x + s / 2, cy = y + s / 2;
    g.save(); g.translate(cx, cy); g.rotate([0, 0.5, 1, 1.5][d] * Math.PI);
    g.beginPath(); g.rect(-s * 0.42, -s * 0.42, s * 0.84, s * 0.84); g.clip();
    const off = REDUCED ? 0 : ((t * 0.8) % 1) * s * 0.36;
    g.strokeStyle = 'rgba(205,184,255,0.75)'; g.lineWidth = Math.max(2, s * 0.08); g.lineCap = 'round'; g.lineJoin = 'round';
    for (let i = -1; i < 3; i++) {
      const yy = s * 0.2 - i * s * 0.36 - off;
      g.globalAlpha = 0.35 + 0.65 * clamp(1 - Math.abs(yy) / (s * 0.45), 0, 1);
      g.beginPath(); g.moveTo(-s * 0.18, yy + s * 0.1); g.lineTo(0, yy - s * 0.08); g.lineTo(s * 0.18, yy + s * 0.1); g.stroke();
    }
    g.restore(); g.globalAlpha = 1;
  }
  drawCrate(g, x, y, s) {
    const m = s * 0.1, bh = s * 0.36, lw = Math.max(1.5, s * 0.05);
    const top = y + m - bh * 0.5;
    g.fillStyle = 'rgba(8,6,20,0.35)'; g.beginPath(); g.ellipse(x + s / 2, y + s * 0.78, s * 0.42, s * 0.14, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = C.crateFront; g.fillRect(x + m, top + s - m * 2 - bh * 0.5, s - m * 2, bh);
    g.fillStyle = C.crateTop; g.fillRect(x + m, top, s - m * 2, s - m * 2 - bh * 0.5);
    g.strokeStyle = C.ink; g.lineWidth = lw;
    g.strokeRect(x + m, top, s - m * 2, s - m * 2 + bh * 0.5);
    g.beginPath(); g.moveTo(x + m, top + s - m * 2 - bh * 0.5); g.lineTo(x + s - m, top + s - m * 2 - bh * 0.5); g.stroke();
    // its tape: a violet band across the top
    g.fillStyle = C.violet2; g.fillRect(x + s / 2 - s * 0.07, top + lw / 2, s * 0.14, s - m * 2 - bh * 0.5 - lw);
    g.fillStyle = C.crateDk; g.fillRect(x + m + lw, top + s - m * 2 - bh * 0.5 + bh * 0.42, s - m * 2 - lw * 2, Math.max(1, s * 0.03));
  }
  drawBeamRow(g, bm, row, t) {
    const L = this.L, geo = this.geo, s = geo.s, lift = s * 0.28;
    const d = bm.dir;
    const fx = bm.from % L.w, fy = (bm.from / L.w) | 0;
    const start = this.center(fx, fy);
    start.x += [0, 1, 0, -1][d] * s * 0.45; start.y += [-1, 0, 1, 0][d] * s * 0.45 - lift;
    let end;
    if (bm.end >= 0) end = this.beamEnd(bm);
    else { const lx = bm.to % L.w, ly = (bm.to / L.w) | 0; end = this.center(lx, ly); end.y -= lift; }
    let x1 = start.x, y1 = start.y, x2 = end.x, y2 = end.y;
    if (d === 1 || d === 3) {
      if (fy !== row) return;
    } else {
      // a vertical beam: only the part in this row's band
      const top = geo.y0 + row * s - lift, bot = top + s;
      const lo = Math.min(y1, y2), hi = Math.max(y1, y2);
      const a = Math.max(lo, top), b = Math.min(hi, bot);
      if (b <= a) return;
      y1 = a; y2 = b;
    }
    const fl = REDUCED ? 1 : 0.85 + 0.15 * Math.sin(t * 40 + row);
    g.lineCap = 'round';
    g.strokeStyle = `rgba(255,77,166,${0.22 * fl})`; g.lineWidth = s * 0.3;
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    g.strokeStyle = `rgba(255,77,166,${0.85 * fl})`; g.lineWidth = s * 0.11;
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    g.strokeStyle = '#ffe3f1'; g.lineWidth = Math.max(1, s * 0.035);
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
  }

  drawBody(g, b, s) {
    if (b.gone && b.fade >= 1) return;
    const sp = this.sprites;
    const c = this.center(b.x, b.y);
    const t = this.time;
    // the step's hop and the landing squash
    const hop = Math.sin(clamp(1 - b.hop, 0, 1) * Math.PI) * (b.hop > 0 ? s * 0.11 : 0);
    let sx = 1, sy = 1;
    if (b.sq > 0) { sy = 1 - 0.1 * b.sq; sx = 1 + 0.08 * b.sq; }
    else if (b.hop > 0) { sy = 1.05; sx = 0.96; }
    const bump = Math.sin(b.bump * Math.PI) * s * 0.12;
    let px = c.x + b.bx * bump, py = c.y + s * 0.28 + b.by * bump;
    // the win: she jumps, the echoes wave
    let frame = b.hop > 0 ? 1 : (b.step && b.t < 1 ? 1 : 0);
    let dir = b.dir;
    if (this.win >= 0) {
      if (b.live) { const k = (this.win * 2.6) % 1; py -= Math.abs(Math.sin(k * Math.PI)) * s * 0.35; }
      else if (this.win > 0.15 + (this.bodies.indexOf(b) * 0.08)) { dir = 2; frame = Math.floor(this.win * 6) % 2 ? 2 : 0; }
    }
    // breathing
    sy *= 1 + Math.sin(t * 2.4 + b.x) * 0.012;
    let alpha = b.live ? 1 : 0.84;
    if (b.gone) alpha *= 1 - b.fade;
    const sp2 = b.spawn < 1 ? ease.outBack(clamp(b.spawn, 0, 1)) : 1;
    if (b.spawn <= 0) return;
    const live = b.live;
    let tint = live ? -1 : b.tint;
    // zapped: she flickers between herself and static
    if (live && this.zapT >= 0) { if (Math.floor(this.zapT * 14) % 2 === 0) tint = 1; }
    if (b.zapped > 0 && !b.gone) alpha *= 0.5 + 0.5 * Math.sin(b.zapped * 50);
    // her shadow; an echo stands on a little disc of light in her color
    g.globalAlpha = 0.35 * alpha * sp2;
    g.fillStyle = '#05030f';
    g.beginPath(); g.ellipse(c.x, c.y + s * 0.27, s * 0.26 * sx, s * 0.09, 0, 0, Math.PI * 2); g.fill();
    if (!live) {
      const pulse = 0.75 + 0.25 * Math.sin(t * 4 + b.tint);
      g.globalAlpha = 0.5 * alpha * sp2 * pulse;
      g.strokeStyle = TINTS[b.tint % 4]; g.lineWidth = Math.max(1.5, s * 0.05);
      g.beginPath(); g.ellipse(c.x, c.y + s * 0.27, s * 0.33, s * 0.12, 0, 0, Math.PI * 2); g.stroke();
    }
    const img = sp.get(dir, frame, tint);
    const w = sp.w * sx * sp2, h = sp.h * sy * sp2;
    let ox = 0;
    if (b.glitch > 0 && !REDUCED) ox = (Math.random() - 0.5) * s * 0.16 * (b.glitch / 0.45);
    const dx = px - w * (BOX.fx / BOX.w) + ox, dy = py - hop - h * (BOX.fy / BOX.h);
    if (b.glitch > 0 && !REDUCED) {
      // a little color split while she drifts
      g.globalAlpha = alpha * 0.5; g.drawImage(sp.get(dir, frame, 2), dx - s * 0.06, dy, w, h);
      g.globalAlpha = alpha * 0.5; g.drawImage(sp.get(dir, frame, 1), dx + s * 0.06, dy, w, h);
    }
    g.globalAlpha = alpha;
    g.drawImage(img, dx, dy, w, h);
    g.globalAlpha = 1;
    // the echo's tag (v1, v2…) over her head; "you" over the live one for a moment at an epoch's start
    const tagY = dy + h * 0.02 - s * 0.08;
    if (!live && !b.gone && sp2 > 0.5) this.tag(g, c.x, tagY, `v${b.tint + 1}`, TINTS[b.tint % 4], s, alpha);
    if (live && this.youT > 0 && this.win < 0 && this.zapT < 0) {
      const a = clamp(this.youT, 0, 1);
      const bob = Math.sin(t * 6) * s * 0.05;
      g.globalAlpha = a;
      g.fillStyle = C.honey; g.strokeStyle = C.ink; g.lineWidth = Math.max(1.5, s * 0.045);
      const ay = tagY - s * 0.04 + bob;
      g.beginPath(); g.moveTo(c.x, ay + s * 0.17); g.lineTo(c.x + s * 0.17, ay - s * 0.03); g.lineTo(c.x - s * 0.17, ay - s * 0.03); g.closePath(); g.fill(); g.stroke();
      g.globalAlpha = 1;
    }
  }
  tag(g, x, y, text, color, s, alpha) {
    const fs = Math.max(9, Math.round(s * 0.24));
    g.font = `800 ${fs}px 'AK Mono', ui-monospace, monospace`;
    const tw = g.measureText(text).width, ph = fs * 1.25, pw = tw + fs * 0.7;
    g.globalAlpha = Math.min(1, alpha * 1.2);
    g.fillStyle = color; g.strokeStyle = C.ink; g.lineWidth = Math.max(1.5, s * 0.045);
    roundRect(g, x - pw / 2, y - ph, pw, ph, ph / 2); g.fill(); g.stroke();
    g.fillStyle = C.ink; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, x, y - ph / 2 + 0.5);
    g.globalAlpha = 1;
  }

  drawRewind(g, view, k) {
    // VHS-style: bands sliding over the screen, a tint, and the epoch's number
    const p = 1 - k;
    if (!REDUCED) {
      g.save();
      g.globalAlpha = 0.18 * Math.sin(p * Math.PI);
      g.fillStyle = C.violet2; g.fillRect(0, 0, view.w, view.h);
      g.globalAlpha = 0.5 * Math.sin(p * Math.PI);
      const n = 7;
      for (let i = 0; i < n; i++) {
        const y = ((i / n + p * 1.7) % 1) * view.h;
        const hh = 4 + ((i * 37) % 11);
        g.fillStyle = i % 2 ? 'rgba(255,255,255,0.35)' : 'rgba(63,240,195,0.35)';
        g.fillRect(0, y, view.w, hh);
      }
      g.restore();
    }
    const a = Math.sin(p * Math.PI);
    const fs = Math.round(clamp(Math.min(view.w, view.h) * 0.11, 26, 68));
    g.globalAlpha = a;
    g.font = `900 ${fs}px 'AK Display', 'Arial Black', sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round'; g.lineWidth = fs * 0.18; g.strokeStyle = C.ink;
    const y = this.geo ? this.geo.y0 + (this.L.h * this.geo.s) / 2 : view.h / 2;
    const x = this.geo ? this.geo.x0 + this.geo.bw / 2 : view.w / 2;
    const txt = `EPOCH ${this.rewindEpoch}`;
    g.strokeText(txt, x, y); g.fillStyle = C.paper; g.fillText(txt, x, y);
    // the rewind mark: two triangles pointing back
    const ty = y - fs * 0.95, tw = fs * 0.36;
    g.fillStyle = C.honey; g.lineWidth = fs * 0.08;
    for (const o of [-tw * 0.55, tw * 0.55]) {
      g.beginPath(); g.moveTo(x + o + tw * 0.5, ty - tw * 0.5); g.lineTo(x + o - tw * 0.5, ty); g.lineTo(x + o + tw * 0.5, ty + tw * 0.5); g.closePath(); g.fill(); g.stroke();
    }
    g.globalAlpha = 1;
  }

  drawBanner(g, view) {
    const b = this.banner, geo = this.geo;
    const a = clamp(b.t * 6, 0, 1);
    const fs = Math.round(clamp(geo.s * 0.62, 20, 40));
    const x = geo.x0 + geo.bw / 2, y = geo.y0 + Math.min(geo.s * 1.1, (this.L.h * geo.s) * 0.28);
    const pop = REDUCED ? 1 : ease.outBack(clamp(b.t * 4, 0, 1));
    g.save(); g.translate(x, y); g.scale(pop, pop); g.rotate(-0.04);
    g.globalAlpha = a;
    g.font = `900 ${fs}px 'AK Display', 'Arial Black', sans-serif`;
    const tw = g.measureText(b.text).width + fs * 1.1, th = fs * 1.5;
    g.fillStyle = b.color || C.pink; g.strokeStyle = C.ink; g.lineWidth = Math.max(2.5, fs * 0.1);
    roundRect(g, -tw / 2 + 4, -th / 2 + 5, tw, th, th / 2); g.fillStyle = C.ink; g.fill();
    g.fillStyle = b.color || C.pink;
    roundRect(g, -tw / 2, -th / 2, tw, th, th / 2); g.fill(); g.stroke();
    g.fillStyle = C.ink; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(b.text, 0, 2);
    g.restore();
    if (b.sub) {
      const ss = Math.round(clamp(geo.s * 0.26, 11, 15));
      g.globalAlpha = a;
      g.font = `700 ${ss}px 'AK Mono', ui-monospace, monospace`;
      g.textAlign = 'center'; g.textBaseline = 'top';
      const tw = g.measureText(b.sub).width + ss * 1.6;
      g.fillStyle = 'rgba(12,10,28,0.85)';
      roundRect(g, x - tw / 2, y + fs * 0.95, tw, ss * 2, ss); g.fill();
      g.fillStyle = C.paper; g.fillText(b.sub, x, y + fs * 0.95 + ss * 0.45);
      g.globalAlpha = 1;
    }
  }

  // the demo's own little HUD (the kit's bar is hidden in a demo): level, epochs, ticks
  drawHud(g, view, hud) {
    const fs = Math.round(clamp(view.w * 0.032, 11, 15));
    const y = 10;
    g.font = `900 ${fs}px 'AK Display', 'Arial Black', sans-serif`;
    g.textBaseline = 'middle'; g.textAlign = 'left';
    const label = `${hud.id}  ${hud.name.toUpperCase()}`;
    const tw = g.measureText(label).width + fs * 1.4, th = fs * 2;
    g.fillStyle = C.paper; g.strokeStyle = C.ink; g.lineWidth = 2;
    roundRect(g, 10, y, tw, th, th / 2); g.fill(); g.stroke();
    g.fillStyle = C.ink; g.fillText(label, 10 + fs * 0.7, y + th / 2 + 1);
    // epochs: v1 v2 … and the live one
    let x = view.w - 10;
    g.font = `800 ${Math.round(fs * 0.92)}px 'AK Mono', monospace`;
    for (let i = hud.K - 1; i >= 0; i--) {
      const text = i === hud.epoch - 1 ? 'YOU' : `v${i + 1}`;
      const w = g.measureText(text).width + fs * 1.1;
      x -= w;
      const used = i < hud.epoch - 1, cur = i === hud.epoch - 1;
      g.fillStyle = cur ? C.honey : used ? TINTS[i % 4] : 'rgba(255,255,255,0.08)';
      g.strokeStyle = used || cur ? C.ink : 'rgba(255,255,255,0.4)';
      roundRect(g, x, y, w, th, th / 2); g.fill(); g.stroke();
      g.fillStyle = used || cur ? C.ink : 'rgba(255,255,255,0.6)'; g.textAlign = 'center';
      g.fillText(text, x + w / 2, y + th / 2 + 1);
      x -= 6;
    }
    // ticks: a bar under the board
    const geo = this.geo;
    const bw = Math.min(view.w - 40, geo.bw), bx = (view.w - bw) / 2, by = view.h - 16;
    const n = hud.T, gap = 3, cw = (bw - gap * (n - 1)) / n;
    for (let i = 0; i < n; i++) {
      g.fillStyle = i < hud.t ? C.honey : 'rgba(255,255,255,0.13)';
      roundRect(g, bx + i * (cw + gap), by, cw, 7, 3); g.fill();
    }
  }
}
