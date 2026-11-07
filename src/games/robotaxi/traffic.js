// ROBOTAXI RUSH: the traffic and the things on the road (passenger pins, shields). Pure (no DOM).
//
// Cars drive in lanes at their own speeds (all slower than the robotaxi), keep their distance from the car ahead in their
// lane, and some change lanes, always blinking first. New traffic appears far ahead, in the haze, in small patterns that
// leave gaps to thread; the further the run goes, the denser it gets.
//
// The promise (the "guardian"): there is always a way through. sweep() drives an ideal robotaxi through the traffic as it
// stands, from just ahead of the player to the haze, moving sideways no faster than the real one can: if it ever finds
// no lane open, that's a wall. A new car that would make a wall isn't placed, a lane change that would make one doesn't
// happen, and a wall that forms anyway (cars drifting together at their own speeds) is pulled apart again: the car in
// front speeds up, or the one behind slows down, long before the robotaxi gets there.
import { rng } from '../kit/fx.js';
import { SEG, ROAD_HALF, LANE_X, LANES, PLAYER, DRAW, CAM_BACK, SPEED, MPU, clamp, lerp, smooth, difficultyAt } from './config.js';

export const TYPES = Object.freeze({
  pod: { halfW: 285, len: 470, h: 430, speed: [0.95, 1.04], weight: 3 },
  van: { halfW: 330, len: 620, h: 640, speed: [0.84, 0.92], weight: 2 },
  truck: { halfW: 370, len: 980, h: 900, speed: [0.76, 0.83], weight: 1.1 },
  bus: { halfW: 385, len: 1040, h: 860, speed: [0.77, 0.84], weight: 0.75 },
  coupe: { halfW: 300, len: 480, h: 320, speed: [1.04, 1.12], weight: 1.4, changer: 0.7 },
  scooter: { halfW: 130, len: 300, h: 540, speed: [0.9, 0.97], weight: 0.85 },
});
export const TYPE_IDS = Object.freeze(Object.keys(TYPES));

export const FLOW = 0.5;                       // traffic drives at about half the robotaxi's cruise
export const SPAWN_AHEAD = (DRAW - 8) * SEG;   // where new traffic appears (in the haze)
export const BEHIND = CAM_BACK + 500;          // traffic this far behind the robotaxi is gone
export const FOLLOW_GAP = 560;                 // bumper to bumper, the least a car keeps behind the one ahead
export const BLINK = 0.95;                     // a lane change blinks this long first
export const SHIFT = 0.9;                      // then takes this long
export const MAX_CARS = 46;
export const HIT_W = 0.86;                     // a car hits with this much of its half width

// ---------- the guardian's sweep ----------
const CELL = 50;
const XMIN = -ROAD_HALF + 60, XMAX = ROAD_HALF - 60;
const NCELL = Math.floor((XMAX - XMIN) / CELL) + 1;
const reachA = new Uint8Array(NCELL), reachB = new Uint8Array(NCELL), blocked = new Uint8Array(NCELL);

// the sideways room a car takes, left and right edges (both lanes while it changes lanes)
const changing = (c) => c.blinkT > 0 || c.shiftT > 0;
export const spanL = (c) => (changing(c) ? Math.min(LANE_X[c.lane], LANE_X[c.laneTo], c.x) : c.x) - c.halfW * HIT_W;
export const spanR = (c) => (changing(c) ? Math.max(LANE_X[c.lane], LANE_X[c.laneTo], c.x) : c.x) + c.halfW * HIT_W;

// Drive an ideal robotaxi from z0 to z1 through `cars` (as they stand), moving sideways at most `slope` units per unit
// forward: the z where no position is left (a wall), or Infinity. `extra` is one more car to try (it isn't in `cars`).
export function sweep(cars, z0, z1, slope = 0.6, { step = 100, extra = null, margin = 34 } = {}) {
  reachA.fill(1);
  let reach = reachA, next = reachB;
  const spread = Math.max(1, Math.round((slope * step) / CELL));
  const pw = PLAYER.hitHalfW + margin;
  const n = cars.length + (extra ? 1 : 0);
  for (let z = z0; z <= z1; z += step) {
    // where it could be by now: anywhere within `spread` cells of where it could be before
    let run = 0;
    for (let i = 0; i < Math.min(spread, NCELL); i++) run += reach[i];
    for (let i = 0; i < NCELL; i++) {
      const add = i + spread, drop = i - spread - 1;
      if (add < NCELL) run += reach[add];
      if (drop >= 0) run -= reach[drop];
      next[i] = run > 0 ? 1 : 0;
    }
    // minus where a car is
    blocked.fill(0);
    for (let k = 0; k < n; k++) {
      const c = k < cars.length ? cars[k] : extra;
      if (c.gone || c.flying) continue;
      const reachZ = (c.len + PLAYER.len) * 0.47;
      if (z < c.z - reachZ || z > c.z + reachZ) continue;
      const a = Math.max(0, Math.floor((spanL(c) - pw - XMIN) / CELL)), b = Math.min(NCELL - 1, Math.ceil((spanR(c) + pw - XMIN) / CELL));
      for (let i = a; i <= b; i++) blocked[i] = 1;
    }
    let any = false;
    for (let i = 0; i < NCELL; i++) { const v = next[i] & (blocked[i] ^ 1); next[i] = v; if (v) any = true; }
    if (!any) return z;
    const t = reach; reach = next; next = t;
  }
  return Infinity;
}

// how far sideways the ideal robotaxi may move per unit forward, at a robotaxi speed and a traffic speed
export const slopeFor = (speed, flow) => clamp((0.78 * SPEED.lat) / Math.max(1500, speed - flow), 0.32, 1.1) * 0.8;

// ---------- the traffic ----------
const byZ = (a, b) => b.z - a.z;
const PATTERNS = [
  { id: 'single', w: (d) => 5 - 3.4 * d },
  { id: 'pair', w: (d) => 1.6 + 0.9 * d },
  { id: 'wall', w: (d) => Math.max(0, 2.6 * d - 0.35) },
  { id: 'stairs', w: (d) => 0.3 + 1.7 * d },
  { id: 'convoy', w: (d) => 0.5 + 0.9 * d },
  { id: 'slalom', w: (d) => 0.2 + 1.3 * d },
  { id: 'squeeze', w: (d) => Math.max(0, 1.6 * d - 0.2) },
];

export function createTraffic(seed = 1, { demo = false } = {}) {
  const r = rng(((seed >>> 0) ^ 0x51ed27) || 7);
  const cars = [];
  const items = [];
  const pool = [];
  let nextId = 1, nextSpawn = 0, nextFare = 0, nextShield = 0, guardT = 0, started = false;
  let flow = SPEED.start * FLOW;

  const pickType = (d, big = true) => {
    const list = TYPE_IDS.filter((t) => big || (t !== 'truck' && t !== 'bus'));
    return r.weighted(list, (t) => TYPES[t].weight * (t === 'truck' || t === 'bus' ? 0.6 + 0.6 * d : 1));
  };

  function make(type, lane, z, { drift = 0 } = {}) {
    const T = TYPES[type];
    const c = pool.pop() || {};
    c.id = nextId++; c.type = type; c.halfW = T.halfW; c.len = T.len; c.h = T.h;
    c.lane = lane; c.laneTo = lane; c.x = LANE_X[lane]; c.z = z;
    c.base = flow * r.range(T.speed[0], T.speed[1]); c.v = c.base;
    c.blinkT = 0; c.shiftT = 0; c.drift = drift; c.changed = false;
    c.rush = 0; c.slow = 0; c.passed = false; c.minGap = Infinity; c.hit = false; c.near = false; c.ghost = false;
    c.gone = false; c.flying = false; c.fly = null;
    c.paint = r.int(0, 1); c.wob = r.range(0, Math.PI * 2);
    c.prevZ = z; c.prevX = c.x;
    return c;
  }
  const release = (c) => { c.gone = true; if (pool.length < 64) pool.push(c); };

  // does a car at (lane, z) overlap another car (bumper to bumper)?
  function crowded(lane, z, T) {
    const x = LANE_X[lane];
    for (const o of cars) {
      if (o.flying) continue;
      if (x + T.halfW < spanL(o) || x - T.halfW > spanR(o)) continue;
      if (Math.abs(o.z - z) < (o.len + T.len) / 2 + FOLLOW_GAP) return true;
    }
    return false;
  }

  // place one car if it fits and leaves a way through
  function tryPlace(type, lane, z, ctx, opts) {
    if (cars.length >= MAX_CARS) return null;
    const T = TYPES[type];
    if (crowded(lane, z, T)) return null;
    const c = make(type, lane, z, opts);
    const wall = sweep(cars, ctx.z + 1500, ctx.z + SPAWN_AHEAD + 9000, ctx.slope, { extra: c });
    if (wall !== Infinity) { release(c); return null; }
    cars.push(c);
    return c;
  }

  function spawnGroup(ctx, zBase) {
    const d = ctx.d;
    const p = r.weighted(PATTERNS, (q) => Math.max(0, q.w(d))).id;
    const lanes = r.shuffle([0, 1, 2, 3]);
    const drift = () => (r.chance(0.04 + 0.26 * d) ? 1 : 0);
    const put = (lane, dz, type = pickType(d)) => tryPlace(type, lane, zBase + dz, ctx, { drift: drift() });
    switch (p) {
      case 'single': {
        // early on, often right in the robotaxi's way or next to it: a near miss to learn from
        const near = ctx.lane != null && r.chance(0.55 - 0.3 * d);
        const lane = near ? clamp(ctx.lane + r.int(-1, 1), 0, LANES - 1) : lanes[0];
        put(lane, 0);
        break;
      }
      case 'pair': put(lanes[0], 0); put(lanes[1], r.range(-260, 260)); break;
      case 'wall': put(lanes[0], 0); put(lanes[1], r.range(-240, 240)); put(lanes[2], r.range(-240, 240)); break;
      case 'stairs': {
        const up = r.chance(0.5), gap = r.range(1300, 1800);
        for (let k = 0; k < 3; k++) put(up ? k : LANES - 1 - k, k * gap);
        break;
      }
      case 'convoy': {
        const lane = lanes[0];
        put(lane, 0, r.pick(['truck', 'bus', 'van']));
        put(lane, -1900, pickType(d, false));
        if (r.chance(d)) put(lanes[1], -900, pickType(d, false));
        break;
      }
      case 'slalom': {
        const a = lanes[0], b = clamp(a + (a < 2 ? 1 : -1), 0, 3), gap = r.range(2000, 2600);
        for (let k = 0; k < 4; k++) put(k % 2 ? b : a, k * gap, pickType(d, false));
        break;
      }
      case 'squeeze': {
        // two cars side by side in neighbouring lanes, a third one further on: thread them
        const a = r.int(0, 2);
        put(a, 0, pickType(d, false)); put(a + 1, r.range(-150, 150), pickType(d, false));
        put(lanes[0], r.range(2400, 3200));
        break;
      }
      default: put(lanes[0], 0);
    }
  }

  function placeItem(kind, ctx) {
    const z = ctx.z + SPAWN_AHEAD - r.range(0, 1200);
    const order = r.shuffle([0, 1, 2, 3]);
    for (const lane of order) {
      const x = LANE_X[lane];
      let ok = true;
      for (const o of cars) if (Math.abs(o.x - x) < 600 && Math.abs(o.z - z) < o.len / 2 + 700) { ok = false; break; }
      if (!ok) continue;
      items.push({ kind, x, z, lane, taken: false, t: r.range(0, 6), id: nextId++ });
      return true;
    }
    return false;
  }

  // the robotaxi is at ctx.z: set up the road ahead (calm for a player, busy for the demo)
  function prefill(ctx) {
    started = true;
    flow = ctx.cruise * FLOW;
    const from = demo ? 2600 : 15000;
    let z = ctx.z + from;
    while (z < ctx.z + SPAWN_AHEAD) {
      spawnGroup(ctx, z);
      z += gapFor(ctx.d) * (1 - FLOW) * (demo ? 0.9 : 1.15);
    }
    nextSpawn = ctx.z + gapFor(ctx.d);
    nextFare = ctx.z + (demo ? 2500 : r.range(9000, 15000)) / 1;
    nextShield = ctx.z + r.range(1300, 2100) / MPU;
    if (demo) placeItem('fare', { ...ctx, z: ctx.z - SPAWN_AHEAD + 9000 });
  }
  // the robotaxi travels this far between new groups of traffic
  const gapFor = (d) => lerp(9000, 3300, d) * r.range(0.78, 1.28);

  // lane changes: a coupe stuck behind something slower, or a car picked to drift across as the robotaxi comes
  function maybeChange(c, lead, ctx) {
    if (c.blinkT > 0 || c.shiftT > 0 || c.flying) return;
    const gap = c.z - ctx.z;
    let want = 0;
    if (TYPES[c.type].changer && lead && lead.v < c.base * 0.97 && lead.z - c.z < (lead.len + c.len) / 2 + FOLLOW_GAP * 2.4 && gap > 5200) want = r.chance(0.5) ? 1 : -1;
    else if (c.drift && !c.changed && gap > 5200 && gap < 15000 && r.chance(0.02)) want = r.chance(0.5) ? 1 : -1;
    if (!want) return;
    for (const dir of [want, -want]) {
      const to = c.lane + dir;
      if (to < 0 || to >= LANES) continue;
      const x = LANE_X[to];
      let free = true;
      for (const o of cars) {
        if (o === c || o.flying) continue;
        if (x + c.halfW + 60 < spanL(o) || x - c.halfW - 60 > spanR(o)) continue;
        if (Math.abs(o.z - c.z) < (o.len + c.len) / 2 + 1100) { free = false; break; }
      }
      if (!free) continue;
      c.laneTo = to; c.blinkT = BLINK;
      if (sweep(cars, ctx.z + 1500, ctx.z + SPAWN_AHEAD + 4000, ctx.slope) !== Infinity) { c.laneTo = c.lane; c.blinkT = 0; continue; }
      c.changed = true;
      return;
    }
  }

  // a wall has formed at zWall: pull it apart (the cars in front speed up, the one at the back slows down; one still in
  // the haze simply isn't there any more)
  function unwall(zWall, ctx) {
    let front = null, back = null;
    for (const c of cars) {
      if (c.flying || c.z < zWall - 2600 || c.z > zWall + 900) continue;
      if (!front || c.z > front.z) front = c;
      if (!back || c.z < back.z) back = c;
    }
    if (!front) return;
    if (front.z > ctx.z + SPAWN_AHEAD * 0.86 && front !== back) { release(front); cars.splice(cars.indexOf(front), 1); return; }
    for (const c of cars) if (!c.flying && c !== back && c.z >= zWall - 2600 && c.z <= zWall + 900) c.rush = 2.4;
    if (back && back !== front && back.z - ctx.z > 9000) back.slow = 2.4;
    else if (back === front) front.rush = 2.4;
  }

  // ctx: { z, speed, cruise, x, lane, dt-free numbers }
  function update(dt, ctx) {
    flow = ctx.cruise * FLOW;
    ctx.d = difficultyAt(ctx.z * MPU);
    ctx.slope = slopeFor(ctx.cruise, flow);
    ctx.lane = nearestLane(ctx.x);
    if (!started) prefill(ctx);

    // new traffic, pins and shields far ahead
    if (ctx.z >= nextSpawn) { spawnGroup(ctx, ctx.z + SPAWN_AHEAD); nextSpawn = ctx.z + gapFor(ctx.d); }
    if (ctx.z >= nextFare) { placeItem('fare', ctx); nextFare = ctx.z + r.range(380, 680) / MPU; }
    if (ctx.z >= nextShield) {
      if (ctx.shields < 3) placeItem('shield', ctx);
      nextShield = ctx.z + r.range(1500, 2400) / MPU;
    }

    // front to back: keep distance, change lanes, move
    cars.sort(byZ);
    for (let k = 0; k < cars.length; k++) {
      const c = cars[k];
      c.prevZ = c.z; c.prevX = c.x;
      if (c.flying) {
        const f = c.fly;
        f.t += dt; c.z += f.vz * dt; c.x += f.vx * dt; f.y += f.vy * dt; f.vy -= 5200 * dt; f.rot += f.spin * dt;
        if (f.y < 0 && f.vy < 0) { f.y = 0; f.vy *= -0.35; f.vx *= 0.6; f.spin *= 0.5; }
        continue;
      }
      // the nearest car ahead that shares the road with it
      let lead = null;
      const l = spanL(c), rr = spanR(c);
      for (let j = k - 1; j >= 0; j--) {
        const o = cars[j];
        if (o.flying) continue;
        if (spanR(o) < l - 60 || spanL(o) > rr + 60) continue;
        lead = o;
        break;
      }
      let want = c.base * (c.rush > 0 ? 1.24 : c.slow > 0 ? 0.8 : 1);
      if (c.rush > 0) c.rush -= dt;
      if (c.slow > 0) c.slow -= dt;
      if (lead) {
        const room = lead.z - c.z - (lead.len + c.len) / 2;
        if (room < FOLLOW_GAP * 1.6) want = Math.min(want, lead.v * (room < FOLLOW_GAP ? 0.92 : 1));
        if (room < FOLLOW_GAP * 0.4) c.z = lead.z - (lead.len + c.len) / 2 - FOLLOW_GAP * 0.4;
      }
      // traffic the robotaxi has passed never runs into it from behind (after a spin-out, say)
      if (c.z < ctx.z - 200) want = Math.min(want, ctx.speed * 0.9);
      c.v += clamp(want - c.v, -2600 * dt, 1500 * dt);
      c.z += c.v * dt;

      maybeChange(c, lead, ctx);
      if (c.blinkT > 0) {
        c.blinkT -= dt;
        if (c.blinkT <= 0) { c.blinkT = 0; c.shiftT = 1e-6; }
      } else if (c.shiftT > 0) {
        c.shiftT += dt;
        const t = Math.min(1, c.shiftT / SHIFT);
        c.x = lerp(LANE_X[c.lane], LANE_X[c.laneTo], smooth(t));
        if (t >= 1) { c.lane = c.laneTo; c.shiftT = 0; c.x = LANE_X[c.lane]; }
      } else if (c.type === 'scooter') {
        c.wob += dt * 1.7;
        c.x = LANE_X[c.lane] + Math.sin(c.wob) * 120;
      }
    }

    // gone behind the camera
    for (let k = cars.length - 1; k >= 0; k--) {
      const c = cars[k];
      if (c.z < ctx.z - BEHIND || (c.flying && c.fly.t > 1.6)) { release(c); cars.splice(k, 1); }
    }
    for (let k = items.length - 1; k >= 0; k--) {
      const it = items[k];
      it.t += dt;
      if (it.z < ctx.z - BEHIND || it.taken) items.splice(k, 1);
    }

    // the guardian, ten times a second
    guardT -= dt;
    if (guardT <= 0) {
      guardT = 0.1;
      const wall = sweep(cars, ctx.z + 1800, ctx.z + SPAWN_AHEAD + 2000, ctx.slope);
      if (wall !== Infinity) unwall(wall, ctx);
    }
  }

  return {
    cars, items,
    get flow() { return flow; },
    update, prefill: (ctx) => { ctx.d = difficultyAt(ctx.z * MPU); ctx.slope = slopeFor(ctx.cruise, ctx.cruise * FLOW); ctx.lane = nearestLane(ctx.x); prefill(ctx); },
    // a car rammed by the boosting robotaxi: it flies off (and stops being traffic)
    fling(c, side, speed) {
      c.flying = true;
      c.fly = { t: 0, vz: speed * 1.05, vx: side * r.range(2600, 4200), y: 0, vy: r.range(2600, 3800), rot: 0, spin: side * r.range(5, 9) };
    },
    release,
  };
}

export const nearestLane = (x) => {
  let best = 0;
  for (let i = 1; i < LANES; i++) if (Math.abs(LANE_X[i] - x) < Math.abs(LANE_X[best] - x)) best = i;
  return best;
};
