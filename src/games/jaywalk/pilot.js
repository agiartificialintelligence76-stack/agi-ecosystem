// JAYWALK's pilot (2026-11-08): looks ahead and picks a hop, for the self-playing demo (`?demo`), and answers "can this
// street be crossed at all?" for the tests. Both search the same thing: states { row, x, ride, t } a hop (or a wait of
// one hop's time) apart, checked against the world's own answers (where every car, raft and train is at time t) with a
// body a little wider than the player's, so what it finds is fair with room to spare. Pure: no DOM, no clock.
import { HOP, BODY, EDGE, HALF, T, isSafe, slotPos, hazardAt, blockedAt, entX } from './world.js';
import { hopPlan, BACK_GRAB, carriedOff } from './rules.js';

const DT = 1 / 60;
export const ACTIONS = Object.freeze(['up', 'left', 'right', 'wait', 'down']);

// standing still for `dur` seconds from s: the state after, or null if something gets her (a raft may carry her)
export function simWait(world, s, dur, half = BODY) {
  const row = world.row(s.row);
  const n = Math.max(1, Math.round(dur / DT));
  let x = s.x;
  for (let j = 1; j <= n; j++) {
    const t = s.t + (dur * j) / n;
    if (s.ride) {
      x = slotPos(row, s.ride.e, s.ride.k, t);
      if (carriedOff(row, x)) return null;
    }
    if (hazardAt(world, s.row, x, t, half)) return null;
  }
  return { row: s.row, x, ride: s.ride, t: s.t + dur };
}

// one hop from s: the state where it lands, or null (a bump goes nowhere; a splash, a car or a train ends it)
export function simHop(world, s, dir, half = BODY) {
  const p = hopPlan(world, s, dir, s.t);
  if (p.bump) return null;
  const from = world.row(s.row), to = world.row(p.toRow);
  const n = Math.round(HOP / DT);
  let x = s.x;
  for (let j = 1; j <= n; j++) {
    const k = j / n, t = s.t + HOP * k;
    const fx = s.ride ? slotPos(from, s.ride.e, s.ride.k, t) : s.x;
    const tx = p.raft ? slotPos(to, p.raft, p.slot, t) : p.toX;
    x = fx + (tx - fx) * k;
    if (hazardAt(world, k < 0.5 ? s.row : p.toRow, x, t, half)) return null;
  }
  if (to.type === T.RIVER && (!p.raft || carriedOff(to, x))) return null;
  return { row: p.toRow, x, ride: p.raft ? { e: p.raft, k: p.slot } : null, t: s.t + HOP };
}

const keyOf = (s) => (s.ride ? `${s.row}|r${s.ride.e.id}:${s.ride.k}` : `${s.row}|${Math.round(s.x * 2)}`);

// seconds until the raft she rides carries her off the street (Infinity on land or on pads that hover in place)
export function edgeTime(world, s) {
  if (!s.ride) return Infinity;
  const row = world.row(s.row);
  if (!row.speed) return Infinity;
  return Math.max(0, row.dir > 0 ? EDGE - s.x : s.x + EDGE) / row.speed;
}
// The columns of row i from which she can still get on past the safe rows (and hovering pads) ahead: a run of free
// cells is good when one of its cells leads to a good cell of the next row; a moving lane takes her anywhere (null).
// Rows never change, so it's worked out once per row (per world).
const goodCache = new WeakMap();
const isStill = (row) => row.type === T.RIVER && row.still;
const padAt = (row, c) => row.ents.some((e) => Math.abs(entX(row, e, 0) - c) < 0.01);
export function goodCols(world, i) {
  let memo = goodCache.get(world);
  if (!memo) { memo = new Map(); goodCache.set(world, memo); }
  if (memo.has(i)) return memo.get(i);
  const row = world.row(i);
  let good = null;
  if (isSafe(row.type) || isStill(row)) {
    const next = world.row(i + 1);
    const ng = isSafe(next.type) || isStill(next) ? goodCols(world, i + 1) : null;
    const stand = (r, c) => (isStill(r) ? padAt(r, c) : !blockedAt(r, c));
    const leads = (c) => (isSafe(next.type) || isStill(next) ? stand(next, c) && (!ng || ng.has(c)) : true);
    good = new Set();
    for (let c = -HALF; c <= HALF;) {
      if (!stand(row, c)) { c++; continue; }
      let d = c;
      while (d + 1 <= HALF && stand(row, d + 1)) d++;
      let ok = false;
      for (let k = c; k <= d && !ok; k++) ok = leads(k);
      if (ok) for (let k = c; k <= d; k++) good.add(k);
      c = d + 1;
    }
  }
  memo.set(i, good);
  return good;
}
// can she still go forward from here (not a pocket between things, with the way ahead blocked)?
export function onward(world, s) {
  const g = goodCols(world, s.row);
  return !g || g.has(Math.round(s.x));
}
const act = (world, s, a, half) => (a === 'wait' ? simWait(world, s, HOP, half) : simHop(world, s, a, half));

// The demo's choice from s (standing, not in the air): the first move of the best way forward over `depth` hops' time.
// Best: furthest row reached on the way (sooner is better), then standing somewhere safe, near the middle, with a
// heart picked up now and then. Only ways that are still alive at the end count (no walking into a dead end).
// → 'up' | 'down' | 'left' | 'right' | 'wait'
export function think(world, s, { depth = 12, half = 0.36, maxRow = s.row, idle = 0, got = null, stuck = 0 } = {}) {
  // rivers need a longer look (where a raft takes her matters a few seconds on); so does being stuck
  for (let i = s.row; i <= s.row + 2; i++) if (world.row(i).type === T.RIVER) { depth = Math.max(depth, 14); break; }
  if (stuck > 3.5) depth = Math.max(depth, 18);
  const floor = maxRow - (BACK_GRAB - 1);
  let layer = [{ ...s, first: null, top: s.row, topAt: 0, hearts: 0 }];
  let fallback = null;
  for (let d = 1; d <= depth && layer.length; d++) {
    const next = new Map();
    for (const st of layer) {
      for (const a of ACTIONS) {
        const n = act(world, st, a, half);
        if (!n || n.row < floor) continue;
        n.first = st.first || a;
        n.top = Math.max(st.top, n.row);
        n.topAt = n.row > st.top ? d : st.topAt;
        n.hearts = st.hearts;
        if (a !== 'wait' && got) {
          const row = world.row(n.row);
          for (const h of row.hearts) if (Math.abs(h.x - n.x) < 0.5 && !got.has(`${row.i}:${h.x}`)) n.hearts += h.big ? 3 : 1;
        }
        const k = keyOf(n);
        const old = next.get(k);
        if (!old || n.top > old.top || (n.top === old.top && (n.topAt < old.topAt || (n.topAt === old.topAt && n.hearts > old.hearts)))) next.set(k, n);
      }
    }
    layer = [...next.values()];
    if (layer.length) fallback = layer;
  }
  const pool = layer.length ? layer : fallback;
  if (!pool?.length) return 'up';
  let best = null, bestV = -Infinity;
  for (const st of pool) {
    const row = world.row(st.row);
    // the end of the look-ahead in the middle of a street: only if she can stay there a moment longer
    if (!isSafe(row.type) && !simWait(world, st, 0.35, half)) continue;
    let v = 10 * st.top - 0.35 * st.topAt + 2.2 * st.hearts - 0.12 * Math.abs(st.x);
    if (isSafe(row.type)) v += 1.4;
    // a raft about to carry her off, or a pocket with no way forward: not where to end up
    const te = edgeTime(world, st);
    if (te < 1.6) v -= 12; else if (te < 2.6) v -= 4;
    if (!onward(world, st)) v -= 16;
    if (idle > 3 && st.first === 'wait') v -= 4;
    if (st.first === 'down' && stuck < 3.5) v -= 1.5;
    if (v > bestV) { bestV = v; best = st; }
  }
  return (best || pool[0]).first || 'wait';
}

// Can the street from safe row `from` to safe row `to` be crossed, starting any time from t0, within `horizon`
// seconds? (Waiting on the safe row is free: you can always step aside to keep the drone away.) → seconds it took, or
// -1. `half`: the body's half-width for the check, wider than the game's own so a found way is fair with room to spare.
export function crossable(world, from, to, t0, { horizon = 24, half = 0.32 } = {}) {
  const start = world.row(from);
  let layer = new Map();
  for (const x of start.reach.length ? start.reach : [0]) {
    const s = { row: from, x, ride: null, t: t0 };
    layer.set(keyOf(s), s);
  }
  const ticks = Math.ceil(horizon / HOP);
  for (let tick = 0; tick < ticks && layer.size; tick++) {
    const next = new Map();
    for (const st of layer.values()) {
      for (const a of ACTIONS) {
        const n = act(world, st, a, half);
        if (!n || n.row < from) continue;
        if (n.row >= to) return n.t - t0;
        const k = keyOf(n);
        if (!next.has(k)) next.set(k, n);
      }
    }
    layer = next;
  }
  return -1;
}
