// JAYWALK's rules (2026-11-08): one run, stepped by the game loop. Hops (one cell, HOP seconds, up to QUEUE presses
// waiting), rafts that carry you, what flattens, splashes, zaps or carries you off, hearts, close calls and the
// security drone (standing still IDLE_GRAB seconds, or BACK_GRAB rows back from your best). Pure: no DOM, no three.js;
// it tells the game what happened in `run.events` (the game plays the sounds and the effects).
import { clamp, lerp } from '../kit/fx.js';
import {
  HOP, BUMP, BODY, EDGE, HALF, FENCE, T, isTraffic, entX, raftAt, slotOf, slotPos, blockedAt, hazardAt,
} from './world.js';

export const STEP = Object.freeze({ up: [1, 0], down: [-1, 0], left: [0, -1], right: [0, 1] });
export const QUEUE = 2;            // presses kept while a hop is in the air
export const IDLE_WARN = 4.2;      // the drone shows up…
export const IDLE_GRAB = 7;        // …and takes you
export const BACK_WARN = 2;        // rows back from your best: the drone shows up…
export const BACK_GRAB = 3;        // …and takes you
export const MILESTONE = 25;       // a little party every 25 rows
export const NEAR = 0.42;          // a vehicle that misses the body by less than this: a close call

// Where a hop in `dir` from s = { row, x, ride } at time t lands: { bump } (something's in the way: hop in place) or
// { toRow, toX, raft, slot } (raft: the raft it lands on and its slot; on a river without one: a splash).
export function hopPlan(world, s, dir, t, dur = HOP) {
  const [dr, dx] = STEP[dir];
  const toRow = s.row + dr;
  if (toRow <= FENCE) return { bump: true };
  const target = world.row(toRow);
  const tl = t + dur;
  // on a raft, a sideways hop goes along it (it carries you while you're in the air)
  const carried = s.ride ? slotPos(world.row(s.row), s.ride.e, s.ride.k, dx !== 0 ? tl : t) : s.x;
  let toX = carried + dx;
  if (target.type === T.RIVER) {
    if (dx !== 0 && Math.abs(toX) > EDGE - 0.1) return { bump: true };
    const hit = raftAt(target, toX, tl);
    if (hit) {
      const k = slotOf(hit.e, hit.ex, toX);
      return { toRow, toX: hit.ex + k - (hit.e.len - 1) / 2, raft: hit.e, slot: k };
    }
    return { toRow, toX, raft: null, slot: 0 };
  }
  toX = Math.round(toX);
  if (Math.abs(toX) > HALF) {
    if (dx !== 0) return { bump: true };
    toX = clamp(toX, -HALF, HALF);
  }
  if (blockedAt(target, toX)) return { bump: true };
  return { toRow, toX, raft: null, slot: 0 };
}

// createRun(world, { t, best }) → the run (t: the world's clock to start from; best: the player's best, for its party)
export function createRun(world, { t = 0, best = 0 } = {}) {
  return {
    world, t, t0: t,
    row: 0, x: 0, ride: null,      // where she stands (x follows a raft she rides)
    lane: 0,                        // the row her body is in (the row she left until halfway through a hop)
    hop: null, queue: [],
    maxRow: 0, best,
    idle: 0, droneWarn: false,
    alive: true, death: null,
    hearts: 0, got: new Set(),
    hops: 0, bumps: 0, near: 0,
    facing: 'up',
    events: [],
    nearIds: new Set(), left: null,
    bestShown: false,
  };
}

export const scoreOf = (run) => run.maxRow;

// past the street's edge on a raft that's taking her further out
export const carriedOff = (row, x) => Math.abs(x) > EDGE && row.speed > 0 && Math.sign(x) === row.dir;

// a tap, a swipe or a key: queued (at most QUEUE waiting), → whether it was kept
export function press(run, dir) {
  if (!run.alive || !STEP[dir] || run.queue.length >= QUEUE) return false;
  run.queue.push(dir);
  return true;
}

// x during a hop at time t: from where she took off (moving with her raft) to where she lands (moving with its raft)
function hopX(world, h, t) {
  const k = clamp(h.t / h.dur, 0, 1);
  const fx = h.fromRide ? slotPos(world.row(h.fromRow), h.fromRide.e, h.fromRide.k, t) : h.fromX;
  const tx = h.raft ? slotPos(world.row(h.toRow), h.raft, h.slot, t) : h.toX;
  return lerp(fx, tx, k);
}

function die(run, kind, info = {}) {
  run.alive = false;
  run.queue.length = 0;
  run.death = { kind, t: run.t, row: run.lane, x: run.x, hopDir: run.hop?.dir || null, ...info };
  run.hop = null;
  run.events.push({ type: 'death', ...run.death });
}

function start(run, dir) {
  const w = run.world;
  const p = hopPlan(w, run, dir, run.t);
  run.facing = dir;
  run.idle = 0;
  if (p.bump) {
    run.hop = { bump: true, dir, t: 0, dur: BUMP, fromRow: run.row, toRow: run.row, fromX: run.x, toX: run.x };
    run.bumps++;
    run.events.push({ type: 'bump', dir });
    return;
  }
  run.hops++;
  const from = w.row(run.row);
  if (isTraffic(from.type) || from.type === T.RAIL) run.left = { row: run.row, x: run.x, t: run.t, ids: new Set() };
  run.hop = {
    bump: false, dir, t: 0, dur: HOP,
    fromRow: run.row, fromX: run.x, fromRide: run.ride,
    toRow: p.toRow, toX: p.toX, raft: p.raft, slot: p.slot,
  };
  run.ride = null;
  run.events.push({ type: 'hop', dir, from: run.row, to: p.toRow, raft: Boolean(p.raft) });
}

function land(run) {
  const w = run.world, h = run.hop;
  run.hop = null;
  run.row = h.toRow;
  run.lane = h.toRow;
  const row = w.row(run.row);
  run.nearIds.clear();
  if (row.type === T.RIVER) {
    if (!h.raft) { run.x = h.toX; die(run, 'splash'); return; }
    run.ride = { e: h.raft, k: h.slot };
    run.x = slotPos(row, h.raft, h.slot, run.t);
  } else {
    run.ride = null;
    run.x = h.toX;
  }
  for (const ht of row.hearts) {
    if (Math.abs(ht.x - run.x) > 0.5) continue;
    const key = `${row.i}:${ht.x}`;
    if (run.got.has(key)) continue;
    run.got.add(key);
    run.hearts += ht.big ? 5 : 1;
    run.events.push({ type: 'heart', row: row.i, x: ht.x, big: ht.big });
  }
  if (run.row > run.maxRow) {
    run.maxRow = run.row;
    run.events.push({ type: 'row', row: run.row });
    if (run.row % MILESTONE === 0) run.events.push({ type: 'milestone', row: run.row });
    if (run.best > 0 && !run.bestShown && run.row > run.best) { run.bestShown = true; run.events.push({ type: 'best', row: run.row }); }
  }
  run.events.push({ type: 'land', row: run.row, x: run.x, raft: Boolean(run.ride), surface: row.type });
}

// close calls: a vehicle that just missed her in her lane, or went through the spot she hopped out of a moment ago
function nearMiss(run) {
  const w = run.world, t = run.t;
  const lane = w.row(run.lane);
  if (isTraffic(lane.type)) {
    for (const e of lane.ents) {
      const ex = entX(lane, e, t);
      const gap = Math.abs(ex - run.x) - e.len / 2 - BODY;
      // only once it has gone past her (still coming: it may yet hit)
      if (gap < NEAR && (ex - run.x) * lane.dir > 0 && !run.nearIds.has(e.id)) {
        run.nearIds.add(e.id);
        run.near++;
        run.events.push({ type: 'near', row: run.lane, x: run.x });
      }
    }
  }
  const L = run.left;
  if (!L) return;
  if (t - L.t > 0.45) { run.left = null; return; }
  const row = w.row(L.row);
  const hz = hazardAt(w, L.row, L.x, t, BODY);
  if (!hz) return;
  const key = row.type === T.RAIL ? `train:${hz.k}` : hz.id;
  if (L.ids.has(key)) return;
  L.ids.add(key);
  if (row.type !== T.RAIL && run.nearIds.has(key)) return;
  run.near++;
  run.events.push({ type: 'near', row: L.row, x: L.x, train: row.type === T.RAIL });
}

// step the run by dt seconds (the world's clock goes on after she's out: the cars keep driving)
export function step(run, dt) {
  run.t += dt;
  if (!run.alive) return;
  const w = run.world, t = run.t;
  if (run.hop) {
    const h = run.hop;
    h.t += dt;
    if (!h.bump) {
      run.x = hopX(w, h, t);
      run.lane = h.t / h.dur < 0.5 ? h.fromRow : h.toRow;
      if (h.t >= h.dur) land(run);
    } else if (h.t >= h.dur) run.hop = null;
    if (!run.alive) return;
  }
  if (!run.hop && run.queue.length) start(run, run.queue.shift());
  // standing (or bumping) on a raft: it carries her, maybe off the edge of the street (only on its way out: a raft
  // coming in brings her back)
  if (run.ride && (!run.hop || run.hop.bump)) {
    const row = w.row(run.row);
    run.x = slotPos(row, run.ride.e, run.ride.k, t);
    if (carriedOff(row, run.x)) { die(run, 'edge', { side: Math.sign(run.x) }); return; }
  }
  const hz = hazardAt(w, run.lane, run.x, t);
  if (hz) {
    const lane = w.row(run.lane);
    die(run, lane.type === T.RAIL ? 'train' : 'car', { by: hz, dir: lane.dir, kindOf: hz.kind || 'train' });
    return;
  }
  nearMiss(run);
  // the security drone: no loitering, no going back
  if (!run.hop) run.idle += dt;
  const back = run.maxRow - run.row;
  if (back >= BACK_GRAB) { die(run, 'drone', { why: 'back' }); return; }
  if (run.idle >= IDLE_GRAB) { die(run, 'drone', { why: 'idle' }); return; }
  const warn = run.idle >= IDLE_WARN || back >= BACK_WARN;
  if (warn !== run.droneWarn) {
    run.droneWarn = warn;
    run.events.push({ type: warn ? 'drone-warn' : 'drone-calm', why: back >= BACK_WARN ? 'back' : 'idle' });
  }
}
