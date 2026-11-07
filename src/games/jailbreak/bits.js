// JAILBREAK: the bits that fly: brick shards (little squares that tumble and fall), sparks, rings, dust and glass. One
// fixed pool (no garbage while playing), its own seeded dice (so ?demo looks the same every time), fewer bits with
// "reduce motion". Field units; render.js draws it inside the field's transform.
import { rng } from '../kit/fx.js';
import { REDUCED } from '../kit/env.js';

const SHARD = 0, SPARK = 1, RING = 2, DOT = 3, TRI = 4;

export class Bits {
  constructor(max = 720, seed = 7) {
    this.max = max;
    this.items = [];
    this.pool = [];
    this.r = rng(seed);
  }
  get count() { return this.items.length; }
  reseed(seed) { this.r = rng(seed); }
  clear() { while (this.items.length) this.pool.push(this.items.pop()); }
  add(kind) {
    if (this.items.length >= this.max) { const old = this.items.shift(); this.pool.push(old); }
    const p = this.pool.pop() || {};
    p.kind = kind; p.x = 0; p.y = 0; p.vx = 0; p.vy = 0; p.life = 1; p.max = 1; p.size = 2; p.color = '#fff';
    p.rot = 0; p.spin = 0; p.g = 0; p.drag = 0; p.r0 = 0; p.r1 = 0; p.w = 1; p.ink = false;
    this.items.push(p);
    return p;
  }
  n(count) { return REDUCED ? Math.ceil(count / 3) : count; }
  // a brick breaking: chunky squares that burst out and fall, a few with an ink edge
  shards(x, y, color, count, { speed = [60, 260], up = 90, size = [2.4, 5], life = [0.55, 1.1], g = 900, w = 28, h = 16 } = {}) {
    const r = this.r;
    for (let i = this.n(count); i > 0; i--) {
      const p = this.add(SHARD);
      p.x = x + (r.next() - 0.5) * w; p.y = y + (r.next() - 0.5) * h;
      const a = r.next() * Math.PI * 2, sp = speed[0] + r.next() * (speed[1] - speed[0]);
      p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp - up;
      p.life = p.max = life[0] + r.next() * (life[1] - life[0]);
      p.size = size[0] + r.next() * (size[1] - size[0]);
      p.color = color; p.rot = r.next() * 6.28; p.spin = (r.next() - 0.5) * 18; p.g = g; p.drag = 0.6;
      p.ink = r.next() < 0.35;
    }
  }
  sparks(x, y, color, count, { speed = [140, 420], dir = null, spread = Math.PI, life = [0.18, 0.4], size = [1.2, 2.2], g = 200 } = {}) {
    const r = this.r;
    for (let i = this.n(count); i > 0; i--) {
      const p = this.add(SPARK);
      p.x = x; p.y = y;
      const a = dir == null ? r.next() * Math.PI * 2 : dir + (r.next() - 0.5) * spread;
      const sp = speed[0] + r.next() * (speed[1] - speed[0]);
      p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
      p.life = p.max = life[0] + r.next() * (life[1] - life[0]);
      p.size = size[0] + r.next() * (size[1] - size[0]);
      p.color = color; p.g = g; p.drag = 3;
    }
  }
  ring(x, y, color, r0, r1, life = 0.35, w = 2.5) {
    const p = this.add(RING);
    p.x = x; p.y = y; p.color = color; p.r0 = r0; p.r1 = r1; p.life = p.max = life; p.w = w;
  }
  dots(x, y, color, count, { speed = [20, 80], life = [0.4, 0.9], size = [1.5, 3.5], g = -40 } = {}) {
    const r = this.r;
    for (let i = this.n(count); i > 0; i--) {
      const p = this.add(DOT);
      p.x = x + (r.next() - 0.5) * 10; p.y = y + (r.next() - 0.5) * 6;
      const a = r.next() * Math.PI * 2, sp = speed[0] + r.next() * (speed[1] - speed[0]);
      p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
      p.life = p.max = life[0] + r.next() * (life[1] - life[0]);
      p.size = size[0] + r.next() * (size[1] - size[0]); p.color = color; p.g = g; p.drag = 1.5;
    }
  }
  glass(x, y, count, { speed = [80, 300], size = [3, 8] } = {}) {
    const r = this.r;
    for (let i = this.n(count); i > 0; i--) {
      const p = this.add(TRI);
      p.x = x + (r.next() - 0.5) * 26; p.y = y + (r.next() - 0.5) * 14;
      const a = r.next() * Math.PI * 2, sp = speed[0] + r.next() * (speed[1] - speed[0]);
      p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp - 60;
      p.life = p.max = 0.5 + r.next() * 0.6; p.size = size[0] + r.next() * (size[1] - size[0]);
      p.rot = r.next() * 6.28; p.spin = (r.next() - 0.5) * 14; p.g = 800; p.drag = 0.4;
    }
  }
  update(dt) {
    const it = this.items;
    for (let i = it.length - 1; i >= 0; i--) {
      const p = it[i];
      p.life -= dt;
      if (p.life <= 0) { it[i] = it[it.length - 1]; it.pop(); this.pool.push(p); continue; }
      if (p.kind === RING) continue;
      const k = Math.exp(-p.drag * dt);
      p.vx *= k; p.vy = p.vy * k + p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.spin * dt;
    }
  }
  draw(g) {
    for (const p of this.items) {
      const t = p.life / p.max;
      switch (p.kind) {
        case SHARD: {
          const s = p.size * (0.6 + 0.4 * t), c = Math.cos(p.rot) * s * 0.5, sn = Math.sin(p.rot) * s * 0.5;
          g.globalAlpha = Math.min(1, t * 2.2);
          g.beginPath();
          g.moveTo(p.x - c + sn, p.y - sn - c); g.lineTo(p.x + c + sn, p.y + sn - c);
          g.lineTo(p.x + c - sn, p.y + sn + c); g.lineTo(p.x - c - sn, p.y - sn + c); g.closePath();
          g.fillStyle = p.color; g.fill();
          if (p.ink) { g.lineWidth = 0.9; g.strokeStyle = '#170a36'; g.stroke(); }
          break;
        }
        case SPARK: {
          const len = Math.hypot(p.vx, p.vy) * 0.035 + p.size;
          const a = Math.atan2(p.vy, p.vx);
          g.globalAlpha = Math.min(1, t * 1.8);
          g.strokeStyle = p.color; g.lineWidth = p.size; g.lineCap = 'round';
          g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - Math.cos(a) * len, p.y - Math.sin(a) * len); g.stroke();
          break;
        }
        case RING: {
          const e = 1 - t, rr = p.r0 + (p.r1 - p.r0) * (1 - (1 - e) * (1 - e));
          g.globalAlpha = t;
          g.strokeStyle = p.color; g.lineWidth = p.w * (0.4 + t * 0.6);
          g.beginPath(); g.arc(p.x, p.y, rr, 0, Math.PI * 2); g.stroke();
          break;
        }
        case DOT:
          g.globalAlpha = t; g.fillStyle = p.color;
          g.beginPath(); g.arc(p.x, p.y, p.size * (0.5 + t * 0.5), 0, Math.PI * 2); g.fill();
          break;
        case TRI: {
          const s = p.size, c = Math.cos(p.rot), sn = Math.sin(p.rot);
          g.globalAlpha = Math.min(1, t * 2);
          g.beginPath();
          g.moveTo(p.x + c * s, p.y + sn * s);
          g.lineTo(p.x - c * s * 0.5 - sn * s * 0.6, p.y - sn * s * 0.5 + c * s * 0.6);
          g.lineTo(p.x - c * s * 0.4 + sn * s * 0.7, p.y - sn * s * 0.4 - c * s * 0.7);
          g.closePath();
          g.fillStyle = 'rgba(225,242,255,0.5)'; g.fill();
          g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 0.8; g.stroke();
          break;
        }
        default: break;
      }
    }
    g.globalAlpha = 1;
  }
}
