// MERGE TO AGI (2026-11-08): the compute jar's physics. Circles only, no library: position-based (verlet) circles at a
// fixed 120 Hz tick with 8 substeps, overlaps pushed apart by mass (∝ r²), friction on the positions, the jar's walls,
// floor and rounded bottom corners, a spatial grid for the pairs, and orbs that fall asleep once they rest (and wake when
// something hits them or a merge changes the pile). Two of a kind that touch merge into the next tier at their midpoint;
// two AGI-1s make the SINGULARITY. Pure: no DOM, no clock, no Math.random: the same drops make the same jar on every
// computer (tests/mergeagi.test.js).
import { RADII, MAX_TIER } from './tiers.js';

// the jar, in logical units: its inside is x 0…W, its rim y = 0 and its floor y = H; the bottom corners are rounded
export const JAR = Object.freeze({ W: 400, H: 560, CORNER: 46 });
export const TICK = 1 / 120;
export const SUBSTEPS = 8;
export const GRAVITY = 1850;

const H_SUB = TICK / SUBSTEPS;
const G_SUB = GRAVITY * H_SUB * H_SUB;
const ITERS = 2;                 // contact passes a substep
const VMAX = 2300;               // units/s: no tunnelling (2.4 units a substep, the smallest orb is 15)
const AIR = 0.08;                // damping /s in the air
const REST = 1.5;                // more damping /s for each contact (rolling resistance), up to three
const MU_S = 0.14;               // orb on orb: static friction (only stops tiny slides: orbs still roll off one another)
const MU_K = 0.07;               //             kinetic friction
const MU_WALL = 0.08;            // the glass and the floor
const MAX_PUSH = 3;              // units a pair is pushed apart in one pass at most (no explosions)
const MARGIN = 22;               // the grid's pairs are found once a tick, each orb's box this much bigger
const CELL = 64;
const GX0 = -CELL, GY0 = -2400;
const GCOLS = Math.ceil((JAR.W + 2 * CELL) / CELL);
const GROWS = Math.ceil((JAR.H - GY0 + CELL) / CELL);
const SLEEP_SPEED = 7;           // units/s: slower than this…
const SLEEP_TICKS = 36;          // …this many ticks in a row, touching something: asleep
const WAKE_PEN = 0.3;            // a sleeper pushed in deeper than this wakes up
export const MERGE_GAP = 1.2;    // two orbs "touch" when closer than r1 + r2 + this
export const GROW_T = 0.14;      // s for a merged orb to grow from 60% to its full size (it nudges its neighbours)
export const GROW_FROM = 0.6;
const POP_UP = 150;              // units/s: a new orb's little upward pop
const NUDGE = 70;                // units/s: its neighbours pushed outward
export const MERGE_LOCK = 0.06;  // s a new orb waits before it merges again (each step of a chain lands on its own)
export const CHAIN_T = 0.6;      // s: an orb made by a merge that merges again this soon continues that merge's chain
const SHOCK = 1150, SHOCK_MIN = 320, SHOCK_UP = 260;   // the SINGULARITY's shockwave (units/s)

const DAMP = [0, 1, 2, 3].map((n) => Math.exp(-(AIR + REST * n) * H_SUB));
const easeOut = (t) => 1 - (1 - t) * (1 - t);

let NEXT_WORLD = 1;

export function createWorld({ merging = true } = {}) {
  const orbs = [];
  let ids = 0;
  let maxPairs = 1024;
  let pairA = new Int32Array(maxPairs), pairB = new Int32Array(maxPairs), npairs = 0;
  const head = new Int32Array(GCOLS * GROWS);
  let cap = 2048;
  let entOrb = new Int32Array(cap), entNext = new Int32Array(cap);
  let stamp = new Int32Array(64), stampN = 0;
  const events = [];
  const merges = [];
  let flip = false, counting = true;   // contacts are counted on a substep's first pass only

  function add(tier, x, y, { r = null, exempt = 0, vx = 0, vy = 0, lock = 0 } = {}) {
    const R = RADII[tier];
    const r0 = r == null ? R : Math.min(R, r);
    const o = {
      id: ++ids, tier, R, r: r0, m: R * R, invM: 1 / (R * R),
      x, y, px: x - vx * H_SUB, py: y - vy * H_SUB, ox: x, oy: y, vx, vy,
      age: 0, exempt, lock, grow: r0 < R ? 0 : 1, growFrom: r0, chain: 0,
      asleep: false, still: 0, contacts: 0, dead: false,
      // for the eyes only (the game and its renderer move these; the physics never reads them)
      angle: 0, spin: 0, sq: 0, sqv: 0, sqa: 0, popT: 1, glow: 0,
    };
    orbs.push(o);
    return o;
  }

  function sleep(o) { o.asleep = true; o.px = o.x; o.py = o.y; o.vx = 0; o.vy = 0; o.still = 0; }
  function wake(o) { if (o.asleep) { o.asleep = false; o.still = 0; o.px = o.x; o.py = o.y; } }
  function wakeAll() { for (const o of orbs) wake(o); }

  // ---------- pairs: a grid of cells, each orb in every cell its box (plus MARGIN) touches, once a tick ----------
  function broadphase() {
    head.fill(-1);
    let ne = 0;
    const n = orbs.length;
    if (stamp.length < n) stamp = new Int32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const o = orbs[i], e = o.R + MARGIN;
      const c0 = cellX(o.x - e), c1 = cellX(o.x + e), r0 = cellY(o.y - e), r1 = cellY(o.y + e);
      for (let cy = r0; cy <= r1; cy++) {
        for (let cx = c0; cx <= c1; cx++) {
          if (ne >= cap) { cap *= 2; entOrb = grow32(entOrb, cap); entNext = grow32(entNext, cap); }
          const c = cy * GCOLS + cx;
          entOrb[ne] = i; entNext[ne] = head[c]; head[c] = ne; ne++;
        }
      }
    }
    npairs = 0;
    for (let i = 0; i < n; i++) {
      const a = orbs[i], ea = a.R + MARGIN;
      const c0 = cellX(a.x - ea), c1 = cellX(a.x + ea), r0 = cellY(a.y - ea), r1 = cellY(a.y + ea);
      stampN++;
      for (let cy = r0; cy <= r1; cy++) {
        for (let cx = c0; cx <= c1; cx++) {
          for (let k = head[cy * GCOLS + cx]; k !== -1; k = entNext[k]) {
            const j = entOrb[k];
            if (j <= i || stamp[j] === stampN) continue;
            stamp[j] = stampN;
            const b = orbs[j], reach = a.R + b.R + 2 * MARGIN;
            const dx = b.x - a.x, dy = b.y - a.y;
            if (dx > reach || dx < -reach || dy > reach || dy < -reach) continue;
            if (npairs >= maxPairs) { maxPairs *= 2; pairA = grow32(pairA, maxPairs); pairB = grow32(pairB, maxPairs); }
            pairA[npairs] = i; pairB[npairs] = j; npairs++;
          }
        }
      }
    }
  }

  // ---------- one contact: push apart by mass, then friction along it ----------
  function solvePair(a, b) {
    if (a.asleep && b.asleep) return;
    const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r;
    const d2 = dx * dx + dy * dy;
    if (d2 >= rr * rr) return;
    let d = Math.sqrt(d2), nx, ny;
    if (d > 1e-9) { nx = dx / d; ny = dy / d; } else { nx = 0; ny = 1; d = 0; }
    let pen = rr - d;
    if (pen > WAKE_PEN) { wake(a); wake(b); }
    const wa = a.asleep ? 0 : a.invM, wb = b.asleep ? 0 : b.invM, ws = wa + wb;
    if (ws === 0) return;
    if (pen > MAX_PUSH) pen = MAX_PUSH;
    const ka = wa / ws, kb = wb / ws;
    a.x -= nx * pen * ka; a.y -= ny * pen * ka;
    b.x += nx * pen * kb; b.y += ny * pen * kb;
    // friction: the slide along the contact this substep, held (static) or slowed (kinetic)
    const tx = -ny, ty = nx;
    const slide = ((b.x - b.px) - (a.x - a.px)) * tx + ((b.y - b.py) - (a.y - a.py)) * ty;
    const s = Math.abs(slide);
    const corr = s < MU_S * pen ? slide : (slide > 0 ? 1 : -1) * Math.min(s, MU_K * pen);
    a.x += tx * corr * ka; a.y += ty * corr * ka;
    b.x -= tx * corr * kb; b.y -= ty * corr * kb;
    if (counting) { a.contacts++; b.contacts++; }
  }

  // the glass: walls (as tall as you like: nothing ever leaves the jar), the floor, the rounded bottom corners
  function solveBounds(o) {
    if (o.asleep) return;
    const r = o.r, W = JAR.W, H = JAR.H, C = JAR.CORNER;
    const c = counting ? 1 : 0;
    if (o.x < r) { const pen = r - o.x; o.x = r; o.y -= clampAbs(o.y - o.py, MU_WALL * pen); o.contacts += c; }
    else if (o.x > W - r) { const pen = o.x - (W - r); o.x = W - r; o.y -= clampAbs(o.y - o.py, MU_WALL * pen); o.contacts += c; }
    if (o.y > H - r) { const pen = o.y - (H - r); o.y = H - r; o.x -= clampAbs(o.x - o.px, MU_WALL * pen); o.contacts += c; }
    if (r < C && o.y > H - C) {
      const cx = o.x < C ? C : o.x > W - C ? W - C : -1;
      if (cx >= 0) {
        const rho = C - r, cy = H - C, dx = o.x - cx, dy = o.y - cy, d = Math.hypot(dx, dy);
        if (d > rho) {
          const k = rho / d, pen = d - rho;
          o.x = cx + dx * k; o.y = cy + dy * k;
          const tx = -dy / d, ty = dx / d;
          const corr = clampAbs((o.x - o.px) * tx + (o.y - o.py) * ty, MU_WALL * pen);
          o.x -= tx * corr; o.y -= ty * corr;
          o.contacts += c;
        }
      }
    }
  }

  // ---------- one tick (1/120 s): substeps, then speeds, landings, sleep, merges ----------
  function step() {
    events.length = 0;
    for (const o of orbs) {
      o.ox = o.x; o.oy = o.y;
      o.age += TICK;
      if (o.exempt > 0) o.exempt = Math.max(0, o.exempt - TICK);
      if (o.lock > 0) o.lock = Math.max(0, o.lock - TICK);
      if (o.grow < 1) {
        o.grow = Math.min(1, o.grow + TICK / GROW_T);
        o.r = o.growFrom + (o.R - o.growFrom) * easeOut(o.grow);
      }
    }
    broadphase();
    const vmax = VMAX * H_SUB;
    for (let s = 0; s < SUBSTEPS; s++) {
      for (const o of orbs) {
        if (o.asleep) { o.contacts = 0; continue; }
        const damp = DAMP[o.contacts > 3 ? 3 : o.contacts];
        let vx = (o.x - o.px) * damp, vy = (o.y - o.py) * damp;
        const v2 = vx * vx + vy * vy;
        if (v2 > vmax * vmax) { const k = vmax / Math.sqrt(v2); vx *= k; vy *= k; }
        o.px = o.x; o.py = o.y;
        o.x += vx; o.y += vy + G_SUB;
        o.contacts = 0;
      }
      for (let it = 0; it < ITERS; it++) {
        counting = it === 0;
        // alternate the order each pass, so no direction is favoured (and the pile doesn't drift)
        flip = !flip;
        if (flip) for (let p = 0; p < npairs; p++) solvePair(orbs[pairA[p]], orbs[pairB[p]]);
        else for (let p = npairs - 1; p >= 0; p--) solvePair(orbs[pairA[p]], orbs[pairB[p]]);
        for (const o of orbs) solveBounds(o);
      }
    }
    // speeds, landings (a sudden change of speed: the game squashes it and plays a tap), sleep
    for (const o of orbs) {
      const vx = (o.x - o.ox) / TICK, vy = (o.y - o.oy) / TICK;
      if (!o.asleep && o.age > 0.05 && o.grow >= 1) {
        const dvx = vx - o.vx, dvy = vy - (o.vy + GRAVITY * TICK);
        const dv2 = dvx * dvx + dvy * dvy;
        if (dv2 > 260 * 260) {
          const dv = Math.sqrt(dv2);
          events.push({ type: 'impact', orb: o, speed: dv, nx: dvx / dv, ny: dvy / dv });
        }
      }
      o.vx = vx; o.vy = vy;
      if (o.asleep) continue;
      if (vx * vx + vy * vy < SLEEP_SPEED * SLEEP_SPEED && o.contacts > 0 && o.grow >= 1 && o.age > 0.3) {
        if (++o.still >= SLEEP_TICKS) sleep(o);
      } else o.still = 0;
    }
    // merges: two of a kind touching (each orb merges once a tick), in a fixed order
    merges.length = 0;
    for (let p = 0; merging && p < npairs; p++) {
      const a = orbs[pairA[p]], b = orbs[pairB[p]];
      if (a.tier !== b.tier || a.lock > 0 || b.lock > 0) continue;
      const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r + MERGE_GAP;
      if (dx * dx + dy * dy <= rr * rr) merges.push(p);
    }
    if (merges.length) {
      for (const p of merges) {
        const a = orbs[pairA[p]], b = orbs[pairB[p]];
        if (a.dead || b.dead) continue;
        merge(a, b);
      }
      let w = 0;
      for (let i = 0; i < orbs.length; i++) if (!orbs[i].dead) orbs[w++] = orbs[i];
      orbs.length = w;
    }
    return events;
  }

  function merge(a, b) {
    a.dead = true; b.dead = true;
    const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
    const vx = ((a.x - a.px) + (b.x - b.px)) / 2, vy = ((a.y - a.py) + (b.y - b.py)) / 2;
    const from = [snap(a), snap(b)];
    // a chain: one of the two was itself made by a merge a moment ago (a cascade), so this is its next step
    const chain = 1 + Math.max(a.age <= CHAIN_T ? a.chain : 0, b.age <= CHAIN_T ? b.chain : 0);
    wakeAll();
    if (a.tier >= MAX_TIER) {
      // the SINGULARITY: both vanish, and a shockwave pushes everything out (and up)
      for (const o of orbs) {
        if (o.dead) continue;
        const dx = o.x - x, dy = o.y - y, d = Math.hypot(dx, dy);
        const nx = d > 1e-6 ? dx / d : 0, ny = d > 1e-6 ? dy / d : -1;
        const k = 1 - Math.min(1, d / 560);
        const imp = SHOCK_MIN + (SHOCK - SHOCK_MIN) * k;
        o.px = o.x - nx * imp * H_SUB;
        o.py = o.y - (ny * imp - SHOCK_UP) * H_SUB;
        o.exempt = Math.max(o.exempt, 1.8);
      }
      events.push({ type: 'singularity', tier: MAX_TIER + 1, x, y, from, chain });
      return;
    }
    const t = a.tier + 1;
    const c = add(t, x, y, { r: RADII[t] * GROW_FROM, lock: MERGE_LOCK });
    c.px = x - vx;
    c.py = y - vy + POP_UP * H_SUB;
    c.popT = 0;
    c.chain = chain;
    // its neighbours: a little nudge outward
    const reach0 = c.R + 14;
    for (const o of orbs) {
      if (o === c || o.dead) continue;
      const dx = o.x - x, dy = o.y - y, reach = reach0 + o.r;
      const d2 = dx * dx + dy * dy;
      if (d2 >= reach * reach || d2 < 1e-9) continue;
      const d = Math.sqrt(d2), k = (1 - d / reach) * NUDGE * H_SUB;
      o.px -= (dx / d) * k; o.py -= (dy / d) * k;
    }
    events.push({ type: 'merge', tier: t, x, y, orb: c, from, chain });
  }

  return {
    id: NEXT_WORLD++,
    orbs, add, wake, wakeAll, step,
    get pairs() { return npairs; },
    // nothing left in the jar (a new run)
    clear() { orbs.length = 0; },
    // how much everything is moving: ½ m v² summed (tests: a pile at rest settles)
    energy() {
      let e = 0;
      for (const o of orbs) e += 0.5 * o.m * (o.vx * o.vx + o.vy * o.vy);
      return e;
    },
  };
}

function snap(o) { return { id: o.id, tier: o.tier, x: o.x, y: o.y, r: o.r, angle: o.angle }; }
const cellX = (x) => { const c = Math.floor((x - GX0) / CELL); return c < 0 ? 0 : c >= GCOLS ? GCOLS - 1 : c; };
const cellY = (y) => { const c = Math.floor((y - GY0) / CELL); return c < 0 ? 0 : c >= GROWS ? GROWS - 1 : c; };
const clampAbs = (v, m) => (v > m ? m : v < -m ? -m : v);
function grow32(arr, n) { const a = new Int32Array(n); a.set(arr.subarray(0, Math.min(arr.length, n))); return a; }

// Where a circle of radius r dropped straight down at x first touches something: { y (its centre then), hit (the orb
// it lands on, or null for the glass) }. The guide line and the demo's player both use it. `out` is filled (no garbage).
export function landing(orbs, x, r, out = { y: 0, hit: null }) {
  const W = JAR.W, H = JAR.H, C = JAR.CORNER;
  let y = H - r, hit = null;
  if (r < C) {
    const cx = x < C ? C : x > W - C ? W - C : -1;
    if (cx >= 0) {
      const rho = C - r, dx = x - cx;
      const yc = H - C + Math.sqrt(Math.max(0, rho * rho - dx * dx));
      if (yc < y) y = yc;
    }
  }
  for (const o of orbs) {
    const dx = x - o.x, rr = r + o.r;
    if (dx >= rr || dx <= -rr) continue;
    const yc = o.y - Math.sqrt(rr * rr - dx * dx);
    if (yc < y) { y = yc; hit = o; }
  }
  out.y = y; out.hit = hit;
  return out;
}
