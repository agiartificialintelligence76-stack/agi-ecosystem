// JAYWALK (2026-11-08): the city, one row (lane) at a time, made ahead of the player from a seed. Parks and sidewalks
// (safe, with things in the way), roads (robotaxis, cars, vans, buses), bike lanes (scooters), data rivers (server
// racks and drone pads to ride) and maglev lines (a train after a warning). Pure: no DOM, no three.js, no clock of its
// own (time is the run's, in seconds), the same rows for the same seed on every computer (tests/jaywalk.test.js).
//
// Coordinates: a row is an integer (forward is +1), a column x is -4 … 4 on the playable street (x is continuous on a
// raft). Moving lanes are analytic: everything on one goes round a loop of LOOP cells at the lane's speed, so where a
// car is at any time t is one line of maths (the rules, the renderer and the demo's pilot all ask the same question).
import { rng as seeded, clamp, lerp } from '../kit/fx.js';

export const HALF = 4;            // playable columns: -HALF … HALF
export const EDGE = 4.6;          // a raft carries you past this: out
export const SPAN = 22;           // the lanes are drawn from -SPAN to SPAN
export const LOOP = 48;           // a moving lane's things go round every LOOP cells (they wrap at ±24, off-screen)
export const HOP = 0.13;          // one hop, in seconds
export const BUMP = 0.11;         // a hop into something: a little hop in place
export const BODY = 0.28;         // half the player's width for collisions (a cell is 1: generous on purpose)
export const RAFT_GRACE = 0.24;   // how far past a raft's end a landing still counts
export const FENCE = -3;          // the row behind the start (trees): never walkable
export const T = Object.freeze({ PARK: 'park', WALK: 'walk', ROAD: 'road', BIKE: 'bike', RIVER: 'river', RAIL: 'rail' });
export const COLS = Object.freeze([-4, -3, -2, -1, 0, 1, 2, 3, 4]);
export const isSafe = (type) => type === T.PARK || type === T.WALK;
export const isTraffic = (type) => type === T.ROAD || type === T.BIKE;

// what drives on the roads (a length in cells; speed: how fast it goes against its lane's pace; colors: its paint jobs)
export const VEHICLES = Object.freeze({
  car: Object.freeze({ len: 1.5, speed: 1, colors: 4 }),
  taxi: Object.freeze({ len: 1.7, speed: 1.08, colors: 1 }),
  van: Object.freeze({ len: 2.1, speed: 0.95, colors: 2 }),
  bus: Object.freeze({ len: 3.3, speed: 0.86, colors: 1 }),
  scooter: Object.freeze({ len: 0.8, speed: 1, colors: 2 }),
});
// what stands on the safe rows (block: the player can't hop into its cell)
export const PROPS = Object.freeze({
  tree: { block: true }, tree2: { block: true }, bush: { block: true }, bench: { block: true }, rock: { block: true },
  lamp: { block: true }, hydrant: { block: true }, vend: { block: true }, planter: { block: true }, bin: { block: true },
  flowers: { block: false }, signal: { block: false }, chev: { block: false },
});
const PARK_KINDS = ['tree', 'tree', 'tree2', 'bush', 'bush', 'bench', 'rock'];
const WALK_KINDS = ['lamp', 'hydrant', 'vend', 'planter', 'bench', 'bin', 'planter'];
const PARK_DECOR = ['tree', 'tree2', 'tree', 'bush', 'flowers', 'tree2'];
const WALK_DECOR = ['lamp', 'planter', 'vend', 'tree2', 'bench', 'bin', 'planter', 'lamp'];

// how hard the street is at a row: 0 near the start, 1 from about row 200 (`base` lifts it: the demo starts busy)
export function difficulty(i, base = 0) {
  const k = clamp((i - 6) / 190, 0, 1) ** 0.85;
  return clamp(base + (1 - base) * k, 0, 1);
}

// ---------- where things are at time t (pure maths on a row) ----------

// a thing on a moving lane: its centre's x at time t (it goes round LOOP; off the street between ±SPAN and ±LOOP/2)
export function entX(row, e, t) {
  let s = (e.off + row.dir * row.speed * t) % LOOP;
  if (s < 0) s += LOOP;
  return s - LOOP / 2;
}
// the vehicle that covers x at time t (half: the player's half-width), or null
export function vehicleAt(row, x, t, half = BODY) {
  for (const e of row.ents) {
    if (Math.abs(entX(row, e, t) - x) < e.len / 2 + half) return e;
  }
  return null;
}
// the raft under x at time t ({ e, ex }: the raft and its centre), the nearest one when two are close, or null
export function raftAt(row, x, t, grace = RAFT_GRACE) {
  let best = null, bestD = Infinity;
  for (const e of row.ents) {
    const ex = entX(row, e, t);
    const d = Math.abs(ex - x) - e.len / 2;
    if (d <= grace && d < bestD) { best = { e, ex }; bestD = d; }
  }
  return best;
}
// a raft of length n has n slots (one cell each); the slot nearest x, and a slot's x at time t
export const slotOf = (e, ex, x) => clamp(Math.round(x - ex + (e.len - 1) / 2), 0, e.len - 1);
export const slotPos = (row, e, k, t) => entX(row, e, t) + k - (e.len - 1) / 2;

// maglevs: the k-th train's nose crosses x = 0 at A(k) = phase + k·period, going `dir` at `speed`; its body trails `len`
// cells behind. Its warning (red lights, the bell) starts `warn` seconds before it gets there.
export const trainArrive = (rail, k) => rail.phase + k * rail.period;
function trainSpan(rail, k, t) {
  const head = rail.dir * rail.speed * (t - trainArrive(rail, k));
  const tail = head - rail.dir * rail.len;
  return [Math.min(head, tail), Math.max(head, tail)];
}
// the train that covers x at time t ({ k, lo, hi }), or null
export function trainAt(row, x, t, half = BODY) {
  const rail = row.rail;
  if (!rail) return null;
  const k0 = Math.floor((t - rail.phase) / rail.period);
  for (let k = k0 - 1; k <= k0 + 1; k++) {
    const [lo, hi] = trainSpan(rail, k, t);
    if (x + half > lo && x - half < hi) return { k, lo, hi };
  }
  return null;
}
// what's on the tracks now: { k, lo, hi } of the train inside ±LOOP/2 (to draw it), or null
export function trainShown(row, t) {
  const rail = row.rail;
  if (!rail) return null;
  const k0 = Math.floor((t - rail.phase) / rail.period);
  for (let k = k0; k <= k0 + 1; k++) {
    const [lo, hi] = trainSpan(rail, k, t);
    if (hi > -LOOP / 2 && lo < LOOP / 2) return { k, lo, hi };
  }
  return null;
}
// the warning: from `warn` seconds before the nose reaches the street's middle until its tail has left the street
export function trainWarning(row, t) {
  const rail = row.rail;
  if (!rail) return false;
  const k0 = Math.floor((t - rail.phase) / rail.period);
  for (let k = k0; k <= k0 + 1; k++) {
    const a = trainArrive(rail, k);
    if (t >= a - rail.warn && t <= a + (rail.len + HALF + 1) / rail.speed) return true;
  }
  return false;
}
// seconds until the next train's nose reaches x = 0 (negative while one is passing)
export function trainEta(row, t) {
  const rail = row.rail;
  if (!rail) return Infinity;
  const k = Math.ceil((t - rail.phase) / rail.period);
  return trainArrive(rail, k) - t;
}

// a cell on a safe row that has something in it
export const blockedAt = (row, x) => Boolean(row.blocked && Math.abs(x) <= HALF && row.blocked[Math.round(x) + HALF]);

// ---------- making rows ----------

// a row (exported for tests, which build streets by hand)
export function makeRow(i, type, extra = {}) {
  return {
    i, type, d: 0, seg: 0,
    blocked: new Uint8Array(9),   // per playable column (x + HALF): something stands there
    props: [],                    // { x, kind, rot } everything drawn on it (outside the street too)
    hearts: [],                   // { x, big } to pick up
    ents: [],                     // moving lanes: { id, kind, len, off, v }
    dir: 1, speed: 0,             // moving lanes: the way they go and how fast (cells a second)
    rail: null,                   // maglev lines: { dir, speed, len, period, phase, warn }
    still: false,                 // a data river whose drone pads hover in place
    reach: COLS,                  // the columns you can stand on after crossing it (for the next row's obstacles)
    ...extra,
  };
}

// the free columns joined (side by side) to one of `entry`
export function reachOf(blocked, entry) {
  const ok = new Uint8Array(9);
  for (const c of entry) if (Math.abs(c) <= HALF && !blocked[c + HALF]) ok[c + HALF] = 1;
  for (let j = 1; j < 9; j++) if (ok[j - 1] && !blocked[j]) ok[j] = 1;
  for (let j = 7; j >= 0; j--) if (ok[j + 1] && !blocked[j]) ok[j] = 1;
  return COLS.filter((c) => ok[c + HALF]);
}

// the first rows of a new run (not a demo): a sidewalk with a heart right ahead, then a quiet road, then the rest
const INTRO = [
  { type: T.ROAD, n: 1, calm: true },
  { type: T.ROAD, n: 2 },
  { type: T.BIKE, n: 1 },
  { type: T.ROAD, n: 2 },
  { type: T.RAIL, n: 1 },
  { type: T.RIVER, n: 2 },
];

// createWorld(seed, { base, intro, custom }) → { seed, row(i), prune(below), difficulty(i) }
//   base: difficulty to start from (the demo starts at 0.3); intro: the gentle first rows (on by default unless base)
//   custom(i): a test's own row for i (or null for the made one)
export function createWorld(seed = 1, { base = 0, intro = base === 0, custom = null } = {}) {
  const r = seeded((seed >>> 0) || 1);
  const rows = new Map();
  let next = FENCE - 6, lowest = next, uid = 1, seg = 0, lastDanger = '';
  let breatherAt = 34 + r.int(0, 10);
  const plan = intro ? INTRO.map((s) => ({ ...s })) : [];
  const fences = new Map();

  const push = (row) => { row.d = difficulty(row.i, base); row.seg = seg; rows.set(row.i, row); next = row.i + 1; return row; };
  const id = () => uid++;

  // behind the start: a hedge across the street (never walkable), a quiet little park beyond it
  function fenceRow(i) {
    const row = makeRow(i, T.PARK, { blocked: new Uint8Array(9).fill(1), reach: [] });
    if (i === FENCE) {
      for (let x = -SPAN; x <= SPAN; x++) {
        if (Math.abs(x) <= HALF + 1) row.props.push({ x, kind: Math.abs(x) === HALF + 1 || x === 0 ? 'tree2' : 'bush', rot: r.int(0, 3) });
        else if (r.chance(0.5)) row.props.push({ x, kind: r.pick(['tree', 'tree2', 'bush']), rot: r.int(0, 3) });
      }
      return row;
    }
    for (let x = -SPAN; x <= SPAN; x++) {
      const a = Math.abs(x);
      if (a <= HALF) { if (r.chance(0.16)) row.props.push({ x, kind: r.chance(0.6) ? 'flowers' : 'bush', rot: r.int(0, 3) }); }
      else if (r.chance(a <= HALF + 2 ? 0.5 : 0.35)) row.props.push({ x, kind: r.pick(['tree', 'tree2', 'bush', 'flowers']), rot: r.int(0, 3) });
    }
    return row;
  }
  function decorate(row, kinds, chance) {
    for (let x = HALF + 1; x <= SPAN; x++) {
      for (const sx of [-x, x]) if (r.chance(chance)) row.props.push({ x: sx, kind: r.pick(kinds), rot: r.int(0, 3) });
    }
  }
  // a park or a sidewalk: a few things in the way, never all of it, always joined to where you can come from
  function safeRow(i, type, entry, { breather = false, open = false } = {}) {
    const d = difficulty(i, base);
    const row = makeRow(i, type);
    const maxObs = open ? 0 : breather ? 2 : d < 0.12 ? 2 : d < 0.4 ? 3 : 4;
    const minObs = open ? 0 : d > 0.25 ? 1 : 0;
    let blocked = null, reach = null;
    for (let attempt = 0; attempt < 30; attempt++) {
      const b = new Uint8Array(9);
      const n = r.int(minObs, maxObs);
      for (let k = 0; k < n; k++) b[r.int(0, 8)] = 1;
      const re = reachOf(b, entry);
      if (re.length >= (attempt < 20 ? 2 : 1)) { blocked = b; reach = re; break; }
    }
    if (!blocked) { blocked = new Uint8Array(9); reach = reachOf(blocked, entry); }
    row.blocked = blocked;
    row.reach = reach;
    const kinds = type === T.PARK ? PARK_KINDS : WALK_KINDS;
    for (const c of COLS) if (blocked[c + HALF]) row.props.push({ x: c, kind: r.pick(kinds), rot: r.int(0, 3) });
    // flowers on the grass (just pretty: you walk over them)
    if (type === T.PARK) for (const c of COLS) if (!blocked[c + HALF] && r.chance(0.12)) row.props.push({ x: c, kind: 'flowers', rot: r.int(0, 3) });
    decorate(row, type === T.PARK ? PARK_DECOR : WALK_DECOR, type === T.PARK ? 0.42 : 0.3);
    // a heart now and then (more on a breather), on a free cell you can reach
    if (reach.length && r.chance(breather ? 0.75 : 0.3)) row.hearts.push({ x: r.pick(reach), big: false });
    return row;
  }

  // fill a loop with things (lengths from pick()), at least `minGap` cells apart, until about `coverage` of it is used
  function fill(pick, minGap, coverage, minCount = 1) {
    const items = [];
    let total = 0;
    for (let guard = 0; guard < 40; guard++) {
      const it = pick();
      if (total + it.len + (items.length + 1) * minGap > LOOP) break;
      if (items.length >= minCount && total + it.len > coverage * LOOP) break;
      items.push(it);
      total += it.len;
    }
    const free = LOOP - total - items.length * minGap;
    const w = items.map(() => r.range(0.35, 1.65));
    const sw = w.reduce((a, b) => a + b, 0) || 1;
    let pos = r.range(0, LOOP);
    for (let k = 0; k < items.length; k++) {
      items[k].off = (pos + items[k].len / 2) % LOOP;
      items[k].id = id();
      pos += items[k].len + minGap + (free * w[k]) / sw;
    }
    return items;
  }
  function pickKind(d) {
    return r.weighted([['car', 4], ['taxi', 4], ['van', 1.4 + 2 * d], ['bus', 0.5 + 1.6 * d]], (x) => x[1])[0];
  }
  function bigHeart(row, d) {
    if (r.chance(lerp(0.035, 0.08, d))) row.hearts.push({ x: r.int(-3, 3), big: true });
  }
  function roadRow(i, dir, { calm = false } = {}) {
    const d = difficulty(i, base);
    const row = makeRow(i, T.ROAD, { dir });
    const uniform = r.chance(0.6);
    const kindA = pickKind(d);
    const pace = lerp(1.25, 2.75, d) * r.range(0.85, 1.18) * (calm ? 0.72 : 1);
    row.speed = clamp(pace * VEHICLES[kindA].speed, 0.9, 4.2);
    const gapTime = lerp(1.2, 0.62, d) * (calm ? 1.5 : 1);
    const minGap = gapTime * row.speed + 2 * BODY + 0.35;
    const coverage = lerp(0.15, 0.34, d) * r.range(0.85, 1.15) * (calm ? 0.7 : 1);
    row.ents = fill(() => {
      const kind = uniform ? kindA : pickKind(d);
      return { kind, len: VEHICLES[kind].len, v: r.int(0, VEHICLES[kind].colors - 1) };
    }, minGap, coverage);
    bigHeart(row, d);
    return row;
  }
  function bikeRow(i) {
    const d = difficulty(i, base);
    const row = makeRow(i, T.BIKE, { dir: r.sign() });
    row.speed = lerp(3.1, 5.4, d) * r.range(0.9, 1.1);
    const minGap = lerp(1.25, 0.7, d) * row.speed + 2 * BODY + 0.3;
    row.ents = fill(() => ({ kind: 'scooter', len: VEHICLES.scooter.len, v: r.int(0, 1) }), minGap, lerp(0.07, 0.14, d) * r.range(0.85, 1.15));
    for (let x = -SPAN + 2; x <= SPAN; x += 6) row.props.push({ x, kind: 'chev', rot: row.dir > 0 ? 0 : 2 });
    bigHeart(row, d);
    return row;
  }
  function rackLen(d) {
    const w = d < 0.35 ? [[3, 3], [4, 2]] : d < 0.7 ? [[2, 1], [3, 3], [4, 1]] : [[2, 2], [3, 2], [4, 0.5]];
    return r.weighted(w, (x) => x[1])[0];
  }
  function raftRow(i, dir) {
    const d = difficulty(i, base);
    const row = makeRow(i, T.RIVER, { dir });
    row.speed = lerp(0.95, 1.85, d) * r.range(0.86, 1.14);
    const pads = r.chance(lerp(0.2, 0.4, d));
    const minGap = lerp(1.05, 1.55, d);
    const coverage = lerp(0.6, 0.42, d) * r.range(0.9, 1.1);
    row.ents = fill(() => (pads ? { kind: 'pads', len: r.int(2, 3) } : { kind: 'rack', len: rackLen(d) }), minGap, coverage, 2);
    return row;
  }
  // drone pads hovering in place, one cell each: some under the columns you can come from
  function stillRow(i, prev) {
    const row = makeRow(i, T.RIVER, { still: true, speed: 0, dir: 1 });
    const from = prev && isSafe(prev.type) ? prev.reach : COLS;
    const pool = r.shuffle(from.slice());
    const cols = new Set(pool.slice(0, Math.min(2, pool.length)));
    const want = r.int(4, 6);
    for (let guard = 0; cols.size < want && guard < 40; guard++) cols.add(r.int(-HALF, HALF));
    const xs = [...cols].sort((a, b) => a - b);
    for (const x of xs) row.ents.push({ id: id(), kind: 'pad', len: 1, off: x + LOOP / 2 });
    // more pads out of reach, so the river looks full
    for (let x = HALF + 2; x <= SPAN; x += r.int(2, 4)) for (const sx of [-x, x]) row.ents.push({ id: id(), kind: 'pad', len: 1, off: sx + LOOP / 2 });
    row.reach = xs;
    return row;
  }
  function railRow(i) {
    const d = difficulty(i, base);
    const speed = lerp(26, 34, d);
    const len = 2.5 * r.int(5, 7);
    const warn = lerp(1.7, 1.2, d);
    const least = warn + (len + LOOP) / speed + 0.8;
    const period = Math.max(least, r.range(lerp(6.4, 4.6, d), lerp(8.6, 6, d)));
    const rail = { dir: r.sign(), speed, len, period, phase: r.range(0, period), warn };
    const row = makeRow(i, T.RAIL, { rail, dir: rail.dir, speed });
    for (const x of [-(HALF + 1.5), HALF + 1.5]) row.props.push({ x, kind: 'signal', rot: x < 0 ? 2 : 0 });
    if (r.chance(lerp(0.05, 0.1, d))) row.hearts.push({ x: r.int(-3, 3), big: true });
    return row;
  }

  // ---------- segments ----------
  function danger(type, n, opts = {}) {
    seg++;
    lastDanger = type;
    const i = next;
    if (type === T.ROAD) {
      const twoWay = n >= 2 && r.chance(0.65);
      const dir0 = r.sign();
      for (let k = 0; k < n; k++) push(roadRow(i + k, twoWay ? (k < Math.ceil(n / 2) ? dir0 : -dir0) : r.sign(), opts));
    } else if (type === T.BIKE) {
      push(bikeRow(i));
    } else if (type === T.RAIL) {
      for (let k = 0; k < n; k++) push(railRow(i + k));
    } else {
      let dir = r.sign(), still = false;
      for (let k = 0; k < n; k++) {
        const ri = i + k;
        const prev = rows.get(ri - 1);
        if (!still && n >= 1 && difficulty(ri, base) < 0.6 && !prev?.still && r.chance(0.2)) {
          still = true;
          push(stillRow(ri, prev));
        } else {
          push(raftRow(ri, dir));
          dir = -dir;
        }
      }
    }
  }
  function safe(prev) {
    seg++;
    const i = next;
    const d = difficulty(i, base);
    const breather = i >= breatherAt;
    if (breather) breatherAt = i + 32 + r.int(0, 12);
    const n = breather ? 3 : 1 + (r.chance(lerp(0.5, 0.22, d)) ? 1 : 0) + (r.chance(0.12) ? 1 : 0);
    let types;
    if (breather) types = [T.WALK, T.PARK, T.PARK];
    else if (prev.type === T.RIVER) types = n === 1 ? [T.PARK] : [T.PARK, T.WALK, T.PARK];
    else types = n === 1 ? [r.chance(0.75) ? T.WALK : T.PARK] : [T.WALK, T.PARK, T.WALK];
    let entry = prev.reach;
    for (let k = 0; k < n; k++) {
      const row = push(safeRow(i + k, types[k % types.length], entry, { breather }));
      entry = row.reach;
    }
  }
  function segment() {
    const i = next;
    if (i <= FENCE) { push(fenceRow(i)); return; }
    if (i <= 0) {
      const row = makeRow(i, T.PARK);
      if (i < 0) for (const c of [-HALF, HALF]) if (r.chance(0.7)) { row.blocked[c + HALF] = 1; row.props.push({ x: c, kind: r.pick(['tree', 'tree2', 'bush']), rot: r.int(0, 3) }); }
      row.reach = reachOf(row.blocked, COLS);
      decorate(row, PARK_DECOR, 0.45);
      push(row);
      return;
    }
    const prev = rows.get(i - 1);
    if (i === 1 && intro) {
      // the first hop: a sidewalk with a heart right in front of her
      const row = push(safeRow(1, T.WALK, prev.reach, { open: true }));
      row.hearts = [{ x: 0, big: false }];
      return;
    }
    if (isSafe(prev.type)) {
      if (plan.length) { const s = plan.shift(); danger(s.type, s.n, { calm: s.calm }); return; }
      const d = difficulty(i, base);
      const w = [[T.ROAD, 5], [T.BIKE, i >= 4 ? 1.1 : 0], [T.RAIL, i >= 8 ? 1.2 + d : 0], [T.RIVER, i >= 12 ? 2 + 1.3 * d : 0]];
      for (const e of w) if (e[0] === lastDanger) e[1] *= e[0] === T.ROAD ? 0.6 : 0.25;
      const type = r.weighted(w.filter((e) => e[1] > 0), (e) => e[1])[0];
      const n = type === T.ROAD ? clamp(1 + Math.floor(r.next() * (1.3 + 3.9 * d)), 1, 5)
        : type === T.RIVER ? clamp(1 + Math.floor(r.next() * (1.4 + 2.8 * d)), 1, 4)
          : type === T.RAIL ? (d > 0.5 && r.chance(0.3) ? 2 : 1) : 1;
      danger(type, n);
      return;
    }
    // after a street: usually somewhere to stand; further on, sometimes straight into the next one (a combo)
    const d = difficulty(i, base);
    if (!plan.length && prev.type !== T.RIVER && d > 0.35 && r.chance(lerp(0, 0.35, (d - 0.35) / 0.65))) {
      const type = r.pick([T.ROAD, T.BIKE, T.RAIL].filter((t) => t !== prev.type));
      danger(type, type === T.ROAD ? r.int(1, 2) : 1);
      return;
    }
    safe(prev);
  }

  function row(i) {
    if (custom) { const c = custom(i); if (c) return c; }
    if (i < lowest) {
      if (!fences.has(i)) { if (fences.size > 64) fences.clear(); fences.set(i, makeRow(i, T.PARK, { blocked: new Uint8Array(9).fill(1), reach: [] })); }
      return fences.get(i);
    }
    while (next <= i) segment();
    return rows.get(i);
  }
  // forget rows far behind (they can't be reached again: the drone sees to that)
  function prune(below) {
    if (below <= lowest) return;
    for (let i = lowest; i < below; i++) rows.delete(i);
    lowest = below;
  }
  return { seed, base, row, prune, difficulty: (i) => difficulty(i, base), get made() { return next; } };
}

// the danger at (row i, x) at time t for a player of half-width `half`: the vehicle or the train that hits, or null
export function hazardAt(world, i, x, t, half = BODY) {
  const row = world.row(i);
  if (row.type === T.ROAD || row.type === T.BIKE) return vehicleAt(row, x, t, half);
  if (row.type === T.RAIL) return trainAt(row, x, t, half);
  return null;
}
