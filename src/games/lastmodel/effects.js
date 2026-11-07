// LAST MODEL STANDING: the juice that isn't the game: pixel particles, the bolts and screws a bot pops into (they bounce
// on the floor), damage numbers, and short-lived marks (a strike's column of light, a blast, a shockwave's ring). All in
// pools of plain numbers: nothing is allocated while playing. Positions are world pixels; ./render.js draws them.
// Its dice are seeded (the demo looks the same every time it's recorded).
import { rng as makeRng } from '../kit/fx.js';
import { REDUCED } from '../kit/env.js';

// ---------- pixel particles ----------
export class Pixels {
  constructor(max = 900, seed = 9) {
    this.max = max; this.n = 0;
    this.x = new Float32Array(max); this.y = new Float32Array(max); this.z = new Float32Array(max);
    this.vx = new Float32Array(max); this.vy = new Float32Array(max); this.vz = new Float32Array(max);
    this.life = new Float32Array(max); this.full = new Float32Array(max); this.size = new Float32Array(max);
    this.drag = new Float32Array(max); this.grav = new Float32Array(max);
    this.kind = new Uint8Array(max);              // 0 square · 1 debris (bounces) · 2 spark (streak) · 3 rising mote
    this.col = new Array(max).fill('#fff');
    this.r = makeRng(seed);
  }
  add(x, y, vx, vy, life, size, col, kind = 0, drag = 3, grav = 0, vz = 0) {
    let i = this.n;
    if (i >= this.max) i = (this.r.next() * this.max) | 0;   // full: replace one at random
    else this.n++;
    this.x[i] = x; this.y[i] = y; this.z[i] = 0; this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz;
    this.life[i] = life; this.full[i] = life; this.size[i] = size; this.col[i] = col; this.kind[i] = kind;
    this.drag[i] = drag; this.grav[i] = grav;
  }
  // a burst of n squares out of (x, y)
  burst(x, y, n, cols, { speed = [30, 120], life = [0.25, 0.6], size = [1, 2], kind = 0, drag = 4, grav = 0, up = 0 } = {}) {
    const r = this.r;
    const count = REDUCED ? Math.ceil(n / 2) : n;
    for (let k = 0; k < count; k++) {
      const a = r.next() * Math.PI * 2, s = r.range(speed[0], speed[1]);
      this.add(x, y, Math.cos(a) * s, Math.sin(a) * s - up, r.range(life[0], life[1]), Math.round(r.range(size[0], size[1])),
        cols[(r.next() * cols.length) | 0], kind, drag, grav, kind === 1 ? r.range(60, 140) : 0);
    }
  }
  update(dt) {
    for (let i = this.n - 1; i >= 0; i--) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.kill(i); continue; }
      const k = Math.exp(-this.drag[i] * dt);
      this.vx[i] *= k; this.vy[i] = this.vy[i] * k + this.grav[i] * dt;
      this.x[i] += this.vx[i] * dt; this.y[i] += this.vy[i] * dt;
      if (this.kind[i] === 1) {
        // debris: a hop with gravity, bouncing twice on the floor
        this.vz[i] -= 520 * dt;
        this.z[i] += this.vz[i] * dt;
        if (this.z[i] < 0) { this.z[i] = 0; this.vz[i] = -this.vz[i] * 0.42; this.vx[i] *= 0.6; this.vy[i] *= 0.6; }
      } else if (this.kind[i] === 3) this.z[i] += 18 * dt;
    }
  }
  kill(i) {
    const j = --this.n;
    if (i === j) return;
    this.x[i] = this.x[j]; this.y[i] = this.y[j]; this.z[i] = this.z[j]; this.vx[i] = this.vx[j]; this.vy[i] = this.vy[j];
    this.vz[i] = this.vz[j]; this.life[i] = this.life[j]; this.full[i] = this.full[j]; this.size[i] = this.size[j];
    this.col[i] = this.col[j]; this.kind[i] = this.kind[j]; this.drag[i] = this.drag[j]; this.grav[i] = this.grav[j];
  }
  clear() { this.n = 0; }
}

// ---------- damage numbers ----------
// A bot hit again while its number is still fresh adds to that number (it follows the bot and pops again) instead of
// stacking a new one on it: a horde stays readable, and big hits still read as big.
export const NUM_LIFE = [0.6, 0.6, 0.8, 0.6, 0.45];
const MERGE = 0.28;
export class Numbers {
  constructor(max = 56) {
    this.max = max; this.n = 0;
    this.x = new Float32Array(max); this.y = new Float32Array(max); this.v = new Int32Array(max);
    this.t = new Float32Array(max); this.kind = new Uint8Array(max); this.dx = new Float32Array(max);
    this.id = new Int32Array(max);
    this.r = makeRng(17);
  }
  // kind: 0 white · 1 crit (honey, bigger) · 2 hurt (red) · 3 heal (mint) · 4 a tick of the field (soft violet, small)
  add(x, y, v, kind = 0, id = 0) {
    v = Math.max(0, Math.round(v));
    if (id > 0 && (kind === 0 || kind === 1 || kind === 4)) {
      for (let i = this.n - 1; i >= 0; i--) {
        if (this.id[i] !== id || this.t[i] >= MERGE || this.kind[i] === 2 || this.kind[i] === 3) continue;
        this.v[i] += v;
        // a crit makes the whole number a crit; a direct hit outranks a tick
        if (kind === 1 || this.kind[i] === 1) this.kind[i] = 1; else if (kind === 0) this.kind[i] = 0;
        this.x[i] = x; this.y[i] = y;
        this.t[i] = Math.min(this.t[i], 0.03);
        return;
      }
    }
    if (this.n >= this.max) {
      if (kind === 0 || kind === 4) return;
      this.n--;                                    // drop the newest plain one for an important one
    }
    const i = this.n++;
    this.x[i] = x; this.y[i] = y; this.v[i] = v; this.t[i] = 0; this.kind[i] = kind; this.id[i] = id;
    this.dx[i] = this.r.range(-8, 8);
  }
  update(dt) {
    for (let i = this.n - 1; i >= 0; i--) {
      this.t[i] += dt;
      if (this.t[i] >= NUM_LIFE[this.kind[i]]) {
        const j = --this.n;
        this.x[i] = this.x[j]; this.y[i] = this.y[j]; this.v[i] = this.v[j]; this.t[i] = this.t[j]; this.kind[i] = this.kind[j];
        this.dx[i] = this.dx[j]; this.id[i] = this.id[j];
      }
    }
  }
  clear() { this.n = 0; }
}

// ---------- marks: short-lived shapes on the floor or in the air ----------
// kind: 1 strike (a column of light falling) · 2 blast · 3 shock ring · 4 summon puff · 5 pick-up sparkle ring ·
// 6 level-up ring · 7 purge wave · 8 dash warning line · 9 boss charge glow
export class Marks {
  constructor(max = 96) {
    this.max = max; this.n = 0;
    this.kind = new Uint8Array(max); this.x = new Float32Array(max); this.y = new Float32Array(max);
    this.r = new Float32Array(max); this.t = new Float32Array(max); this.life = new Float32Array(max);
    this.a = new Float32Array(max); this.b = new Float32Array(max);
  }
  add(kind, x, y, r, life, a = 0, b = 0) {
    let i = this.n;
    if (i >= this.max) i = 0; else this.n++;
    this.kind[i] = kind; this.x[i] = x; this.y[i] = y; this.r[i] = r; this.t[i] = 0; this.life[i] = life; this.a[i] = a; this.b[i] = b;
  }
  update(dt) {
    for (let i = this.n - 1; i >= 0; i--) {
      this.t[i] += dt;
      if (this.t[i] >= this.life[i]) {
        const j = --this.n;
        this.kind[i] = this.kind[j]; this.x[i] = this.x[j]; this.y[i] = this.y[j]; this.r[i] = this.r[j];
        this.t[i] = this.t[j]; this.life[i] = this.life[j]; this.a[i] = this.a[j]; this.b[i] = this.b[j];
      }
    }
  }
  clear() { this.n = 0; }
}
