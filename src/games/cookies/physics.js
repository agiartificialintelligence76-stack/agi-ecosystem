// ACCEPT ALL COOKIES: the physics. Pure (no DOM, no canvas): the same code runs the game, its demo and the tests in
// Node. Units are the page's (a 600 × 900 portrait page, y grows down) and ticks of 1/120 s; velocities are kept the
// Verlet way (where a point is now minus where it was), so they're "units per tick".
//
// The cookie is a heavy point with a radius. Each rope ties it to a pin: the cookie can never be farther from the pin
// than the rope is long (a tether, solved a few times a tick, so two or three ropes share the load exactly), and the
// rope you see is a light chain of points (about one every 12 units) that follows its two ends with distance
// constraints and "long range" tethers from both ends, so a taut rope is straight and a slack one sags. Nothing here
// uses Math.random, sin, cos or atan2: the same actions at the same ticks give the same frames, on any machine.

export const PAGE_W = 600, PAGE_H = 900;
export const HZ = 120, DT = 1 / HZ;
export const GRAVITY = 1150;            // units/s²: a cookie dropped from the top reaches the bottom in about 1.25 s
export const COOKIE_R = 26;
export const SEG = 12;                  // a rope point about every 12 units
export const PIXEL_R = 15;              // a tracker pixel's reach (the cookie collects it when they touch)
export const CAT_R = 52;                // the cat's mouth: the cookie this close to it is eaten
export const POP_R = 44;                // a pop-up window's reach
export const BUG_R = 21;
export const TAB_R = 38;
export const FAN_RANGE = 380;
export const FAN_COS = 0.8;             // the puff's cone: about 37° each side of where the fan faces
export const PUFF_V = 560;              // units/s, the push of one puff at the fan's mouth (a little less far away)
export const FAN_COOL = 22;             // ticks between two puffs of one fan
export const SLIDE_V = 620;             // units/s: how fast a sliding pin follows its target along the track
export const LIFT = 520;                // units/s²: a pop-up floats the cookie up…
export const WRAP_DRAG = 0.982;         // …slowly (a float's speed settles near 220 units/s)
export const MAX_V = 2500 / HZ;         // nothing moves the cookie faster
const AIR = 0.9995;                     // the cookie's light air drag, per tick
const ROPE_AIR = 0.985;                 // a rope's own damping (it settles, never jitters)
const G = GRAVITY / (HZ * HZ);          // gravity per tick²
const LIFT_T = LIFT / (HZ * HZ);
const TETHER_ITERS = 12, CHAIN_ITERS = 12;
const REST_V = 70 / HZ;                 // a slower impact than this doesn't bounce (the cookie can rest and slide)
const PAD_V = 760 / HZ;                 // a bouncy button always sends the cookie off at least this fast
const ROPE_E = 0.14;                    // a rope going taut throws the cookie back a little (slightly elastic)
const ROPE_E_MIN = 140 / HZ;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// ---------- chains: the ropes you see ----------
// A chain of n segments (n + 1 points: x, y, px, py each), `seg` long each; its first point and/or its last point are
// held by something (a pin, the cookie) and set from outside every tick.
export class Chain {
  constructor(n, seg) {
    this.n = n;
    this.seg = seg;
    this.p = new Float64Array((n + 1) * 4);
    this.fixA = true;
    this.fixB = true;
  }
  // points evenly from (ax, ay) to (bx, by), at rest
  lay(ax, ay, bx, by) {
    const p = this.p, n = this.n;
    for (let i = 0; i <= n; i++) {
      const t = n ? i / n : 0, o = i * 4;
      p[o] = p[o + 2] = ax + (bx - ax) * t;
      p[o + 1] = p[o + 3] = ay + (by - ay) * t;
    }
    return this;
  }
  setA(x, y) { const p = this.p; p[0] = p[2] = x; p[1] = p[3] = y; }
  setB(x, y) { const p = this.p, o = this.n * 4; p[o] = p[o + 2] = x; p[o + 1] = p[o + 3] = y; }
  length() {
    const p = this.p;
    let s = 0;
    for (let i = 0; i < this.n; i++) { const o = i * 4; s += Math.hypot(p[o + 4] - p[o], p[o + 5] - p[o + 1]); }
    return s;
  }
  step() {
    const p = this.p, n = this.n, seg = this.seg;
    // move the free points (gravity, damping)
    for (let i = 0; i <= n; i++) {
      if ((i === 0 && this.fixA) || (i === n && this.fixB)) continue;
      const o = i * 4;
      const vx = (p[o] - p[o + 2]) * ROPE_AIR, vy = (p[o + 1] - p[o + 3]) * ROPE_AIR;
      p[o + 2] = p[o]; p[o + 3] = p[o + 1];
      p[o] += vx; p[o + 1] += vy + G;
    }
    if (n < 1) return;
    const ax = p[0], ay = p[1], bo = n * 4, bx = p[bo], by = p[bo + 1];
    for (let k = 0; k < CHAIN_ITERS; k++) {
      // the segments, swept one way then the other (it settles faster)
      const fwd = (k & 1) === 0;
      for (let j = 0; j < n; j++) {
        const i = fwd ? j : n - 1 - j;
        const o = i * 4, q = o + 4;
        const dx = p[q] - p[o], dy = p[q + 1] - p[o + 1];
        const d = Math.sqrt(dx * dx + dy * dy) || 1e-9;
        const wa = (i === 0 && this.fixA) ? 0 : 1, wb = (i + 1 === n && this.fixB) ? 0 : 1;
        const w = wa + wb;
        if (!w) continue;
        const c = (d - seg) / d / w;
        p[o] += dx * c * wa; p[o + 1] += dy * c * wa;
        p[q] -= dx * c * wb; p[q + 1] -= dy * c * wb;
      }
      // long range tethers: no point farther from a held end than the rope between them (taut ropes stay straight)
      for (let i = 1; i < n; i++) {
        const o = i * 4;
        if (this.fixA) {
          const dx = p[o] - ax, dy = p[o + 1] - ay, d = Math.sqrt(dx * dx + dy * dy), m = i * seg;
          if (d > m) { const c = m / d; p[o] = ax + dx * c; p[o + 1] = ay + dy * c; }
        }
        if (this.fixB) {
          const dx = p[o] - bx, dy = p[o + 1] - by, d = Math.sqrt(dx * dx + dy * dy), m = (n - i) * seg;
          if (d > m) { const c = m / d; p[o] = bx + dx * c; p[o + 1] = by + dy * c; }
        }
      }
    }
  }
  // the points i..j as a chain of their own (a rope cut in two)
  slice(i, j) {
    const c = new Chain(j - i, this.seg);
    c.p.set(this.p.subarray(i * 4, (j + 1) * 4));
    return c;
  }
}

// ---------- geometry ----------
// does segment a→b cross segment c→d? (touching counts)
export function crosses(ax, ay, bx, by, cx, cy, dx, dy) {
  const o = (px, py, qx, qy, rx, ry) => (qx - px) * (ry - py) - (qy - py) * (rx - px);
  const d1 = o(cx, cy, dx, dy, ax, ay), d2 = o(cx, cy, dx, dy, bx, by);
  const d3 = o(ax, ay, bx, by, cx, cy), d4 = o(ax, ay, bx, by, dx, dy);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  const on = (px, py, qx, qy, rx, ry) => Math.min(px, qx) - 1e-9 <= rx && rx <= Math.max(px, qx) + 1e-9 && Math.min(py, qy) - 1e-9 <= ry && ry <= Math.max(py, qy) + 1e-9;
  if (d1 === 0 && on(cx, cy, dx, dy, ax, ay)) return true;
  if (d2 === 0 && on(cx, cy, dx, dy, bx, by)) return true;
  if (d3 === 0 && on(ax, ay, bx, by, cx, cy)) return true;
  if (d4 === 0 && on(ax, ay, bx, by, dx, dy)) return true;
  return false;
}
// the point on segment a→b closest to p, as t in 0…1
export function closestT(ax, ay, bx, by, px, py) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  return l2 ? clamp01(((px - ax) * dx + (py - ay) * dy) / l2) : 0;
}
const unit = (x, y) => { const d = Math.sqrt(x * x + y * y) || 1; return [x / d, y / d]; };
// a ping-pong from 0 to 1 and back, easing at both ends, `u` in turns (no trig: smoothstep of a triangle)
export function pingPong(u) {
  let f = u - Math.floor(u);
  f = f < 0.5 ? f * 2 : 2 - f * 2;
  return f * f * (3 - 2 * f);
}

// ---------- the world ----------
// A level (./levels.js) brought to life: `new World(level)`, then `apply(action)` for each of the player's moves and
// `step()` 120 times a second. Everything that happens is pushed to `events` (the game drains it for its sounds and
// sparkles; the tests read it).
export class World {
  constructor(L) {
    this.L = L;
    this.tick = 0;
    this.status = 'play';           // play · won · lost
    this.why = '';                  // when lost: fell · away · bug
    this.events = [];
    const [cx, cy] = L.cookie;
    this.c = { x: cx, y: cy, px: cx, py: cy, ox: cx, oy: cy, angle: 0, spin: 0, wrap: -1, tabLock: -1, contact: 0, gone: false };
    this.pins = (L.pins || []).map((p) => {
      if (Array.isArray(p)) return { x: p[0], y: p[1], track: null, t: 0, target: 0 };
      const [x0, y0, x1, y1] = p.track;
      const t = p.t ?? 0;
      return { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t, track: { x0, y0, x1, y1, len: Math.hypot(x1 - x0, y1 - y0) || 1 }, t, target: t };
    });
    this.hooks = (L.hooks || []).map(([x, y, r]) => ({ x, y, r, used: false }));
    this.ropes = [];
    for (const r of L.ropes || []) {
      const pin = this.pins[r[0]];
      const len = r[1] ?? Math.hypot(cx - pin.x, cy - pin.y);
      this.addRope('pin', r[0], len);
    }
    this.pieces = [];               // the halves of cut ropes (they hang, then fade)
    this.popups = (L.popups || []).map(([x, y]) => ({ x, y, hx: x, hy: y, state: 'idle' }));
    this.walls = [];
    for (const b of L.banners || []) this.walls.push(wall(b, 'banner'));
    for (const b of L.pads || []) this.walls.push(wall(b, 'pad'));
    this.fans = (L.fans || []).map(([x, y, dx, dy]) => { const [ux, uy] = unit(dx, dy); return { x, y, dx: ux, dy: uy, cool: 0, puffs: 0 }; });
    this.bugs = (L.bugs || []).map((b) => ({ ax: b[0], ay: b[1], bx: b[2] ?? b[0], by: b[3] ?? b[1], period: b[4] || 0, phase: b[5] || 0, x: b[0], y: b[1], dir: 1 }));
    this.tabs = [];
    for (const [a, b] of L.tabs || []) {
      const A = tabEnd(a), B = tabEnd(b);
      A.other = this.tabs.length + 1; B.other = this.tabs.length;
      this.tabs.push(A, B);
    }
    this.pixels = (L.pixels || []).map(([x, y]) => ({ x, y, got: false }));
    this.cat = { x: L.cat[0], y: L.cat[1] };
    this.got = 0;
    this.moveBugs();
  }

  get tied() { let n = 0; for (const r of this.ropes) if (!r.cut) n++; return n; }
  anchor(r) { return r.kind === 'pin' ? this.pins[r.ai] : this.hooks[r.ai]; }

  addRope(kind, ai, len) {
    const a = kind === 'pin' ? this.pins[ai] : this.hooks[ai];
    const n = Math.max(2, Math.round(len / SEG));
    const chain = new Chain(n, len / n).lay(a.x, a.y, this.c.x, this.c.y);
    const r = { id: this.ropes.length, kind, ai, len, chain, cut: false, born: this.tick };
    this.ropes.push(r);
    return r;
  }

  // ---------- the player's actions ----------
  // ['cut', rope, seg?] · ['pop', popup] · ['puff', fan] · ['slide', pin, t]
  apply(a) {
    if (this.status !== 'play') return false;
    switch (a[0]) {
      case 'cut': return this.cut(a[1], a[2]);
      case 'pop': return this.pop(a[1]);
      case 'puff': return this.puff(a[1]);
      case 'slide': return this.slide(a[1], a[2]);
      default: return false;
    }
  }
  cut(id, seg) {
    const r = this.ropes[id];
    if (!r || r.cut) return false;
    const ch = r.chain;
    const s = seg == null ? (ch.n >> 1) : Math.max(0, Math.min(ch.n - 1, seg | 0));
    r.cut = true;
    const a = this.anchor(r);
    const taut = Math.min(1, Math.hypot(this.c.x - a.x, this.c.y - a.y) / r.len);
    // the two halves: one hangs from the pin, one from the cookie; both spring back toward their ends
    const head = ch.slice(0, s); head.fixA = true; head.fixB = false;
    const tail = ch.slice(s + 1, ch.n); tail.fixA = false; tail.fixB = true;
    recoil(head, true, taut); recoil(tail, false, taut);
    const o = s * 4;
    const x = (ch.p[o] + ch.p[o + 4]) / 2, y = (ch.p[o + 1] + ch.p[o + 5]) / 2;
    if (head.n > 0) this.pieces.push({ chain: head, kind: r.kind, ai: r.ai, cookie: false, life: 2.2, max: 2.2 });
    if (tail.n > 0) this.pieces.push({ chain: tail, kind: r.kind, ai: r.ai, cookie: true, life: 1.1, max: 1.1 });
    this.events.push({ type: 'cut', rope: id, seg: s, x, y, taut });
    return true;
  }
  // swipe a→b across the page: every rope it crosses is cut (where it crosses) → how many
  cutAlong(ax, ay, bx, by) {
    if (this.status !== 'play') return 0;
    let n = 0;
    for (const r of this.ropes) {
      if (r.cut) continue;
      const p = r.chain.p;
      for (let i = 0; i < r.chain.n; i++) {
        const o = i * 4;
        if (crosses(ax, ay, bx, by, p[o], p[o + 1], p[o + 4], p[o + 5])) { this.cut(r.id, i); n++; break; }
      }
    }
    return n;
  }
  pop(i) {
    const u = this.popups[i];
    if (!u || u.state === 'closed') return false;
    const held = u.state === 'holding';
    u.state = 'closed';
    if (held) {
      this.c.wrap = -1;
      // the cookie drops from where it floated (a little of its drift kept)
      const c = this.c;
      c.px = c.x - (c.x - c.px) * 0.6; c.py = c.y - (c.y - c.py) * 0.35;
    }
    this.events.push({ type: 'pop', i, x: u.x, y: u.y, held });
    return true;
  }
  puff(i) {
    const f = this.fans[i];
    if (!f || f.cool > 0) return false;
    f.cool = FAN_COOL;
    f.puffs++;
    const c = this.c;
    const dx = c.x - f.x, dy = c.y - f.y, d = Math.sqrt(dx * dx + dy * dy) || 1e-9;
    let hit = false;
    if (!c.gone && d < FAN_RANGE && (dx * f.dx + dy * f.dy) / d > FAN_COS) {
      hit = true;
      const k = (PUFF_V / HZ) * (1 - 0.35 * (d / FAN_RANGE));
      c.px -= f.dx * k; c.py -= f.dy * k;
    }
    this.events.push({ type: 'puff', i, hit });
    return true;
  }
  slide(i, t) {
    const p = this.pins[i];
    if (!p || !p.track) return false;
    p.target = clamp01(t);
    return true;
  }

  // ---------- a tick ----------
  step() {
    this.tick++;
    for (const f of this.fans) if (f.cool > 0) f.cool--;
    this.moveBugs();
    this.movePins();
    const c = this.c;
    if (this.status === 'play') this.moveCookie();
    // the ropes you see follow their ends
    for (const r of this.ropes) {
      if (r.cut) continue;
      const a = this.anchor(r);
      r.chain.setA(a.x, a.y);
      r.chain.setB(c.x, c.y);
      r.chain.step();
    }
    for (let i = this.pieces.length - 1; i >= 0; i--) {
      const pc = this.pieces[i];
      pc.life -= DT;
      if (pc.life <= 0) { this.pieces.splice(i, 1); continue; }
      const ch = pc.chain;
      if (pc.cookie) {
        if (c.gone || this.status !== 'play') ch.fixB = false;
        else ch.setB(c.x, c.y);
      } else { const a = pc.kind === 'pin' ? this.pins[pc.ai] : this.hooks[pc.ai]; ch.setA(a.x, a.y); }
      ch.step();
    }
    if (this.status === 'play') this.checks();
    return this.events;
  }

  moveBugs() {
    const t = this.tick * DT;
    for (const b of this.bugs) {
      const ox = b.x;
      if (b.period > 0) {
        const s = pingPong((t + b.phase) / b.period);
        b.x = b.ax + (b.bx - b.ax) * s; b.y = b.ay + (b.by - b.ay) * s;
      }
      if (b.x !== ox) b.dir = b.x > ox ? 1 : -1;
    }
  }
  movePins() {
    for (const p of this.pins) {
      if (!p.track || p.t === p.target) continue;
      const step = SLIDE_V / HZ / p.track.len;
      p.t = p.t < p.target ? Math.min(p.target, p.t + step) : Math.max(p.target, p.t - step);
      p.x = p.track.x0 + (p.track.x1 - p.track.x0) * p.t;
      p.y = p.track.y0 + (p.track.y1 - p.track.y0) * p.t;
    }
  }

  moveCookie() {
    const c = this.c;
    c.ox = c.x; c.oy = c.y;
    // Verlet: carry on, with air drag and gravity (or the pop-up's lift, and its stronger drag)
    let vx = (c.x - c.px) * AIR, vy = (c.y - c.py) * AIR;
    if (c.wrap >= 0) { vx *= WRAP_DRAG; vy *= WRAP_DRAG; vy -= LIFT_T; } else vy += G;
    const sp = Math.sqrt(vx * vx + vy * vy);
    if (sp > MAX_V) { vx *= MAX_V / sp; vy *= MAX_V / sp; }
    c.px = c.x; c.py = c.y;
    c.x += vx; c.y += vy;
    // the ropes and the banners, a few times over (two or three ropes share the cookie exactly)
    const R = c.wrap >= 0 ? POP_R - 4 : COOKIE_R;
    let contacts = null, taut = null;
    for (let k = 0; k < TETHER_ITERS; k++) {
      for (const r of this.ropes) {
        if (r.cut) continue;
        const a = this.anchor(r);
        const dx = c.x - a.x, dy = c.y - a.y, d = Math.sqrt(dx * dx + dy * dy);
        if (d > r.len) {
          const q = (d - r.len) / d;
          c.x -= dx * q; c.y -= dy * q;
          if (k === 0) (taut ||= []).push(r);
        }
      }
      for (const w of this.walls) {
        const t = closestT(w.ax, w.ay, w.bx, w.by, c.x, c.y);
        const qx = w.ax + (w.bx - w.ax) * t, qy = w.ay + (w.by - w.ay) * t;
        let nx = c.x - qx, ny = c.y - qy;
        const d = Math.sqrt(nx * nx + ny * ny), min = w.r + R;
        if (d >= min) continue;
        if (d > 1e-9) { nx /= d; ny /= d; } else { nx = w.nx; ny = w.ny; }
        c.x += nx * (min - d); c.y += ny * (min - d);
        if (!contacts) contacts = [];
        if (!contacts.some((h) => h.w === w)) contacts.push({ w, nx, ny });
      }
    }
    // a rope that just went taut: a little spring back (never rubbery)
    if (taut) for (const r of taut) {
      const a = this.anchor(r);
      const ux = (c.x - a.x) / r.len, uy = (c.y - a.y) / r.len;
      const vin = vx * ux + vy * uy;
      if (vin > ROPE_E_MIN) {
        const nvx = c.x - c.px, nvy = c.y - c.py;
        const vr = nvx * ux + nvy * uy;
        const want = -vin * ROPE_E;
        c.px = c.x - (nvx + (want - vr) * ux); c.py = c.y - (nvy + (want - vr) * uy);
      }
    }
    // banners: bounce (their buttons always bounce), slide with a little friction, rest
    c.contact = 0;
    if (contacts) for (const { w, nx, ny } of contacts) {
      const vin = vx * nx + vy * ny;                       // how fast it came in, before the push out
      let nvx = c.x - c.px, nvy = c.y - c.py;
      const vn = nvx * nx + nvy * ny;
      let tx = nvx - vn * nx, ty = nvy - vn * ny;
      let out = vn;
      if (w.kind === 'pad') {
        out = Math.max(-vin * w.e, PAD_V);
        this.events.push({ type: 'bounce', pad: true, x: c.x - nx * R, y: c.y - ny * R, v: Math.abs(vin) * HZ, wall: this.walls.indexOf(w) });
      } else if (vin < -REST_V) {
        out = -vin * w.e;
        this.events.push({ type: 'bounce', pad: false, x: c.x - nx * R, y: c.y - ny * R, v: -vin * HZ, wall: this.walls.indexOf(w) });
      } else {
        out = Math.max(0, vn);
        c.contact = 1;
      }
      tx *= 1 - w.f; ty *= 1 - w.f;
      nvx = tx + nx * out; nvy = ty + ny * out;
      c.px = c.x - nvx; c.py = c.y - nvy;
      // it rolls along the surface
      c.spin = (tx * -ny + ty * nx) / COOKIE_R;
    }
    if (!contacts) c.spin *= 0.995;
    c.angle += c.spin;
  }

  checks() {
    const c = this.c;
    // a hook's dashed circle: a new rope ties on
    for (let i = 0; i < this.hooks.length; i++) {
      const h = this.hooks[i];
      if (h.used) continue;
      const dx = c.x - h.x, dy = c.y - h.y;
      if (dx * dx + dy * dy < h.r * h.r) {
        h.used = true;
        const r = this.addRope('hook', i, h.r);
        this.events.push({ type: 'hook', i, rope: r.id });
      }
    }
    // pop-ups wrap the cookie, and float with it
    if (c.wrap < 0) {
      for (let i = 0; i < this.popups.length; i++) {
        const u = this.popups[i];
        if (u.state !== 'idle') continue;
        const dx = c.x - u.x, dy = c.y - u.y;
        if (dx * dx + dy * dy < (POP_R - 6) ** 2) {
          u.state = 'holding';
          c.wrap = i;
          // it soaks up most of the fall
          c.px = c.x - (c.x - c.px) * 0.35; c.py = c.y - (c.y - c.py) * 0.2;
          this.events.push({ type: 'wrap', i, x: u.x, y: u.y });
          break;
        }
      }
    }
    if (c.wrap >= 0) { const u = this.popups[c.wrap]; u.x = c.x; u.y = c.y; }
    // tabs: in one, out of the other with the same speed (a cookie on a rope stays where it is)
    if (this.tabs.length) {
      if (c.tabLock >= 0) {
        const t = this.tabs[c.tabLock];
        if ((c.x - t.x) ** 2 + (c.y - t.y) ** 2 > (TAB_R + 8) ** 2) c.tabLock = -1;
      }
      if (c.tabLock < 0 && this.tied === 0) {
        for (let i = 0; i < this.tabs.length; i++) {
          const A = this.tabs[i];
          if ((c.x - A.x) ** 2 + (c.y - A.y) ** 2 >= (TAB_R - 10) ** 2) continue;
          const B = this.tabs[A.other];
          const vx = c.x - c.px, vy = c.y - c.py;
          // rotate the velocity so going into A's opening comes out of B's
          const ix = -A.dx, iy = -A.dy, cs = ix * B.dx + iy * B.dy, sn = ix * B.dy - iy * B.dx;
          const wx = vx * cs - vy * sn, wy = vx * sn + vy * cs;
          const fx = A.x, fy = A.y;
          c.x = B.x + B.dx * (TAB_R * 0.55); c.y = B.y + B.dy * (TAB_R * 0.55);
          c.px = c.x - wx; c.py = c.y - wy; c.ox = c.x - wx; c.oy = c.y - wy;
          c.tabLock = A.other;
          if (c.wrap >= 0) { const u = this.popups[c.wrap]; u.x = c.x; u.y = c.y; }
          this.events.push({ type: 'tab', from: i, to: A.other, x: fx, y: fy, tx: B.x, ty: B.y });
          break;
        }
      }
    }
    // tracker pixels
    for (let i = 0; i < this.pixels.length; i++) {
      const p = this.pixels[i];
      if (p.got) continue;
      if ((c.x - p.x) ** 2 + (c.y - p.y) ** 2 < (COOKIE_R + PIXEL_R) ** 2) {
        p.got = true;
        this.got++;
        this.events.push({ type: 'pixel', i, n: this.got, x: p.x, y: p.y });
      }
    }
    // the cat
    if ((c.x - this.cat.x) ** 2 + (c.y - this.cat.y) ** 2 < CAT_R * CAT_R) { this.finish('won'); return; }
    // bugs crumble it
    for (let i = 0; i < this.bugs.length; i++) {
      const b = this.bugs[i];
      if ((c.x - b.x) ** 2 + (c.y - b.y) ** 2 < (COOKIE_R + BUG_R - 5) ** 2) { this.finish('lost', 'bug', i); return; }
    }
    // off the page (a cookie on a rope always swings back)
    if (this.tied) return;
    const m = COOKIE_R * 1.3;
    if (c.y > PAGE_H + m || c.x < -m || c.x > PAGE_W + m) { this.finish('lost', 'fell'); return; }
    if (c.y < (c.wrap >= 0 ? -POP_R : -260)) this.finish('lost', 'away');
  }

  finish(status, why = '', bug = -1) {
    this.status = status;
    this.why = why;
    const c = this.c;
    c.gone = true;
    // its ropes let go of it and hang from their pins
    for (const r of this.ropes) {
      if (r.cut) continue;
      r.cut = true;
      const ch = r.chain;
      ch.fixB = false;
      this.pieces.push({ chain: ch, kind: r.kind, ai: r.ai, cookie: false, life: 2, max: 2 });
    }
    if (c.wrap >= 0) { this.popups[c.wrap].state = 'closed'; }
    if (status === 'won') this.events.push({ type: 'eat', x: c.x, y: c.y, pixels: this.got });
    else this.events.push({ type: 'lost', why, bug, x: c.x, y: c.y, pixels: this.got });
  }

  drain() { const e = this.events; this.events = []; return e; }
}

function wall(b, kind) {
  const [ax, ay, bx, by, r = kind === 'pad' ? 11 : 12] = b;
  const [ux, uy] = unit(bx - ax, by - ay);
  // its normal points up the page (the side a cookie lands on)
  let nx = uy, ny = -ux;
  if (ny > 0) { nx = -nx; ny = -ny; }
  return { ax, ay, bx, by, r, nx, ny, kind, e: kind === 'pad' ? 1.0 : 0.32, f: kind === 'pad' ? 0.02 : 0.012 };
}
function tabEnd([x, y, dx, dy]) { const [ux, uy] = unit(dx, dy); return { x, y, dx: ux, dy: uy, other: -1 }; }

// a cut rope's half springs back toward the end that still holds it (taut ropes snap back harder)
function recoil(ch, towardA, taut) {
  const n = ch.n, p = ch.p;
  if (n < 1) return;
  const ex = towardA ? p[0] : p[n * 4], ey = towardA ? p[1] : p[n * 4 + 1];
  for (let i = 0; i <= n; i++) {
    const o = i * 4;
    const k = towardA ? i / n : (n - i) / n;          // the free end moves most
    const dx = ex - p[o], dy = ey - p[o + 1], d = Math.sqrt(dx * dx + dy * dy) || 1;
    const v = (2.2 + 4.5 * taut) * k * k;
    p[o + 2] -= (dx / d) * v; p[o + 3] -= (dy / d) * v;
  }
}

// ---------- a level played headless: its actions at their ticks ----------
// → { status, why, ticks, pixels, world }
export function simulate(L, actions = L.sol || [], { maxTicks = HZ * 30, onTick = null } = {}) {
  const w = new World(L);
  const list = actions.slice().sort((a, b) => a[0] - b[0]);
  let i = 0;
  while (w.status === 'play' && w.tick < maxTicks) {
    while (i < list.length && list[i][0] <= w.tick) w.apply(list[i++].slice(1));
    w.step();
    onTick?.(w);
    w.drain();
  }
  return { status: w.status, why: w.why, ticks: w.tick, pixels: w.got, world: w };
}
