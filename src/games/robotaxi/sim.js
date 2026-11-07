// ROBOTAXI RUSH: one run, step by step. Pure (no DOM): the game, its demo AI and tests/robotaxi.test.js all drive it.
//
// stepRun(run, dt, input) moves the world on by dt seconds. input: { steer: -1..1 (keys, holding a side), target: x or
// null (dragging: where the robotaxi should be), boost: true on the step the boost was pressed }. What happened on the
// way (a near miss, a crash, a pin picked up…) is pushed to run.events, for the game to show and play; the game empties it.
import {
  SEG, ROAD_HALF, BARRIER, LANE_X, PLAYER, SPEED, BOOST, NEAR_MISS, SHIELDS, GRACE, SPIN, FARE_POINTS, CHECKPOINT_POINTS,
  RAM_POINTS, MPU, KMH, ZONE_Z, DRAW, clamp, cruiseAt, zoneOfIndex, segOf,
} from './config.js';
import { createTrack, CALM } from './track.js';
import { createTraffic, HIT_W } from './traffic.js';

export function createRun({ seed = 1, startM = 0, demo = false, attract = false, boost = 0, lane = 1, quiet = false } = {}) {
  const startIndex = Math.round(startM / MPU / SEG);
  const z = startIndex * SEG;
  const track = createTrack(seed, { startIndex, calm: demo || attract ? 20 : CALM });
  const traffic = createTraffic(seed, { demo: demo || attract, quiet });
  const cruise = cruiseAt(z * MPU);
  const x = LANE_X[lane];
  const run = {
    seed, demo, attract,
    startZ: z, startM: z * MPU,
    t: 0, z, prevZ: z, x, prevX: x, vx: 0, lean: 0,
    speed: cruise * (demo || attract ? 0.97 : SPEED.launch), cruise,
    boost, boostT: 0, ready: boost >= 1,
    shields: SHIELDS, grace: 0, hitAt: -9, spin: 0, spinDir: 1, spinSlide: 0, hitStop: 0,
    combo: 0, comboT: 0, bestCombo: 0, nearMisses: 0, closeCalls: 0,
    points: 0, fares: 0, rams: 0, checkpoints: 0, topSpeed: 0, score: 0, dist: 0,
    rumble: 0, wall: 0,
    over: false, overT: 0, done: false,
    zone: zoneOfIndex(startIndex), gate: Math.floor(z / ZONE_Z),
    events: [],
    track, traffic,
    ctx: { z, speed: cruise, cruise, x, shields: SHIELDS, d: 0, slope: 0.6, lane },
  };
  track.ensure(startIndex + DRAW + 60);
  traffic.prefill(run.ctx);
  return run;
}

const ev = (run, type, data) => { run.events.push({ type, ...data }); };

export function stepRun(run, dt, input) {
  if (run.hitStop > 0) { run.hitStop = Math.max(0, run.hitStop - dt); return; }
  const { track, traffic } = run;
  run.t += dt;
  run.prevZ = run.z; run.prevX = run.x;
  run.cruise = cruiseAt(run.z * MPU);

  // ---- the boost: 4 seconds once the meter is full
  if (input.boost && run.boostT <= 0 && run.boost >= 1 && !run.over) {
    run.boostT = BOOST.time;
    run.ready = false;
    ev(run, 'boost');
  }
  if (run.boostT > 0) {
    run.boostT = Math.max(0, run.boostT - dt);
    run.boost = run.boostT / BOOST.time;
    // a moment of ghosting as it ends: it's in the middle of the traffic it just plowed through
    if (run.boostT <= 0) { run.grace = Math.max(run.grace, 0.8); ev(run, 'boostEnd'); }
  }

  // ---- speed: cruise (more while boosting), half while spinning out, nothing once wrecked
  let target = run.cruise * (run.boostT > 0 ? SPEED.boost : 1);
  if (run.spin > 0) target = Math.min(target, run.cruise * 0.5);
  if (run.over) target = 0;
  const rate = run.speed < target ? SPEED.accel * (run.boostT > 0 ? 1.8 : 1) : (run.over ? 5200 : SPEED.decel);
  run.speed += clamp(target - run.speed, -rate * dt, rate * dt);

  // ---- steering: the stick (or the finger's spot), the curve's pull outwards
  const curve = track.curveAt(run.z);
  const sp = run.speed / SPEED.max;
  const pull = -curve * sp * sp * SPEED.centrifugal;
  let want;
  if (run.over) want = run.spinSlide * Math.max(0, 1 - run.overT);
  else if (run.spin > 0) want = run.spinSlide * (run.spin / SPIN);
  else if (input.target != null) want = clamp((input.target - run.x) * 9 - pull, -SPEED.lat, SPEED.lat);
  else want = clamp(input.steer || 0, -1, 1) * SPEED.lat;
  run.vx += (want - run.vx) * (1 - Math.exp(-SPEED.latRate * dt));
  run.x += (run.vx + (run.over ? 0 : pull)) * dt;
  run.lean += (clamp(run.vx / SPEED.lat, -1, 1) - run.lean) * (1 - Math.exp(-11 * dt));

  // ---- the road's edges: the rumble strips slow it down, the barrier bounces it back
  const ax = Math.abs(run.x);
  run.rumble = ax > ROAD_HALF - 130 ? Math.sign(run.x) : 0;
  if (run.rumble) run.speed -= run.speed * SPEED.scrape * dt;
  run.wall = 0;
  if (ax > BARRIER) {
    const side = Math.sign(run.x);
    run.x = side * BARRIER;
    run.wall = side;
    if (run.vx * side > 600) { ev(run, 'barrier', { side, hard: run.vx * side > 2400 }); run.speed *= 0.93; }
    run.vx = -side * Math.min(1400, Math.abs(run.vx) * 0.35);
  }

  // ---- forward
  run.z += run.speed * dt;
  track.ensure(segOf(run.z) + DRAW + 40);
  run.topSpeed = Math.max(run.topSpeed, run.speed);
  run.dist = Math.max(0, run.z * MPU - run.startM);

  // ---- a checkpoint every 2 km: the next zone
  const gate = Math.floor(run.z / ZONE_Z);
  if (gate > run.gate) {
    run.gate = gate;
    run.zone = zoneOfIndex(segOf(run.z));
    if (!run.over) {
      run.checkpoints++;
      run.points += CHECKPOINT_POINTS;
      ev(run, 'checkpoint', { zone: run.zone, n: gate, pts: CHECKPOINT_POINTS });
    }
  }

  // ---- the traffic moves
  const ctx = run.ctx;
  ctx.z = run.z; ctx.speed = run.speed; ctx.cruise = run.cruise; ctx.x = run.x; ctx.shields = run.shields;
  traffic.update(dt, ctx);

  // ---- near misses, crashes, rams
  // the ghosting after a hit lasts until the robotaxi is back up to speed (at most a little longer)
  if (run.grace > 0) run.grace = Math.max(0, run.grace - (run.speed < run.cruise * 0.82 && run.grace < 0.6 && run.t - run.hitAt < 3.6 ? dt * 0.15 : dt));
  if (run.spin > 0) run.spin = Math.max(0, run.spin - dt);
  for (const c of traffic.cars) {
    if (c.flying || c.gone) continue;
    const dz = c.z - run.z;
    const reach = (c.len + PLAYER.len) / 2;
    if (dz > reach) continue;
    if (dz < -reach) {
      if (!c.passed) {
        c.passed = true;
        if (!c.hit && !c.ghost && c.minGap < NEAR_MISS.gap && !run.over && run.speed >= NEAR_MISS.minSpeed) nearMiss(run, c);
      }
      continue;
    }
    if (c.hit || c.ghost) continue;
    const dx = Math.abs(c.x - run.x);
    const gap = dx - (PLAYER.halfW + c.halfW);
    if (gap < c.minGap) c.minGap = gap;
    if (dx < PLAYER.hitHalfW + c.halfW * HIT_W) {
      if (run.boostT > 0 && !run.over) ram(run, c);
      else if (run.grace > 0 || run.over) c.ghost = true;
      else crash(run, c);
    }
  }

  // ---- passenger pins and shields
  for (const it of traffic.items) {
    if (it.taken || run.over) continue;
    if (Math.abs(it.z - run.z) < 360 && Math.abs(it.x - run.x) < 560) {
      it.taken = true;
      if (it.kind === 'fare') {
        run.fares++;
        run.points += FARE_POINTS;
        const was = run.boost;
        if (run.boostT <= 0) run.boost = Math.min(1, run.boost + BOOST.perFare);
        ev(run, 'fare', { item: it, pts: FARE_POINTS });
        if (was < 1 && run.boost >= 1) { run.ready = true; ev(run, 'ready'); }
      } else {
        const had = run.shields;
        run.shields = Math.min(SHIELDS, run.shields + 1);
        ev(run, 'shield', { item: it, gained: run.shields > had });
      }
    }
  }

  // ---- the chain of near misses runs out 2 seconds after the last one
  if (run.comboT > 0) {
    run.comboT -= dt;
    if (run.comboT <= 0) {
      if (run.combo >= 2) ev(run, 'chainEnd', { n: run.combo });
      run.combo = 0; run.comboT = 0;
    }
  }

  if (run.over) {
    run.overT += dt;
    if (run.overT >= 1.6 && !run.done) { run.done = true; ev(run, 'done'); }
  }
  run.score = scoreOf(run);
}

export const scoreOf = (run) => Math.floor(run.dist) + run.points;
export const kmh = (speed) => Math.round(speed * KMH);

export function nearMiss(run, c) {
  const close = c.minGap < NEAR_MISS.close;
  run.combo = run.comboT > 0 ? run.combo + 1 : 1;
  run.comboT = NEAR_MISS.chain;
  run.bestCombo = Math.max(run.bestCombo, run.combo);
  const mult = Math.min(run.combo, NEAR_MISS.maxMult);
  const pts = (close ? NEAR_MISS.closePoints : NEAR_MISS.points) * mult;
  run.points += pts;
  run.nearMisses++;
  if (close) run.closeCalls++;
  c.near = true;
  const was = run.boost;
  if (run.boostT <= 0) run.boost = Math.min(1, run.boost + (close ? BOOST.perClose : BOOST.perNear));
  ev(run, 'near', { car: c, close, pts, combo: run.combo, mult, side: Math.sign(c.x - run.x) || 1 });
  if (was < 1 && run.boost >= 1) { run.ready = true; ev(run, 'ready'); }
}

function crash(run, c) {
  c.hit = true;
  run.shields = Math.max(0, run.shields - 1);
  if (run.combo >= 2) ev(run, 'chainEnd', { n: run.combo, broken: true });
  run.combo = 0; run.comboT = 0;
  const side = Math.sign(run.x - c.x) || (run.x < 0 ? 1 : -1);
  run.spinDir = side;
  c.rush = 1.6;                             // the car that was hit drives off a little faster
  if (run.shields <= 0) {
    run.over = true; run.overT = 0;
    run.hitStop = 0.42;
    run.spin = 1.6; run.spinSlide = side * 1700;
    run.boostT = 0;
    ev(run, 'crash', { car: c, shields: 0, side, wreck: true });
    ev(run, 'wreck', { car: c, side });
  } else {
    run.grace = GRACE;
    run.hitAt = run.t;
    run.spin = SPIN; run.spinSlide = side * 2600;
    run.speed *= 0.5;
    run.hitStop = 0.09;
    ev(run, 'crash', { car: c, shields: run.shields, side, wreck: false });
  }
}

function ram(run, c) {
  c.hit = true;
  run.rams++;
  run.points += RAM_POINTS;
  const side = Math.sign(c.x - run.x) || 1;
  run.traffic.fling(c, side, run.speed);
  ev(run, 'ram', { car: c, pts: RAM_POINTS, side });
}

// what the end card shows
export function summary(run) {
  return {
    score: run.score,
    km: run.dist / 1000,
    nearMisses: run.nearMisses,
    closeCalls: run.closeCalls,
    bestCombo: run.bestCombo,
    topKmh: kmh(run.topSpeed),
    fares: run.fares,
    checkpoints: run.checkpoints,
  };
}

export { ROAD_HALF, LANE_X };
