// STACKED's rules (2026-11-08): pure JavaScript, no DOM and no three.js, so tests/stacked.test.js runs them in Node.
// The tower is a list of floors, each a rectangle seen from above ({ x, z, w, d }: its centre and its size along X and
// Z). Floor 0 is the lobby; each new floor slides along X, the next along Z (alternating), swinging from beyond the
// tower's edge to the other side and back; a drop keeps what overlaps the floor below and cuts off the rest.

export const BASE = 3;              // the lobby's footprint (world units): every floor starts at most this big
export const FLOOR_H = 0.55;        // a floor's height
export const SPAWN = 3.4;           // a new floor starts this far from the floor below (along its axis) and swings ±SPAWN
export const PERFECT = { frac: 0.035, min: 0.06, ms: 24 };   // 3.5% of the size, at least 0.06 units, at least 24 ms of travel
export const GROW = { from: 6, step: 0.16 };                 // from a 6-perfect streak each perfect grows the floor back
export const SPEED = { start: 3.0, max: 5.0, early: 40, from: 10, to: 170 };   // units a second, rising with height
export const STREAK_BONUS = { every: 10, points: 5 };        // ×10, ×20…: +5
export const CLOSE = 0.22;          // a cut that keeps less than this share of the floor: "close one!"
export const METERS = 4;            // a floor is about 4 m: the altitude
export const EPS = 1e-6;

// The zones, by floors stacked: the sky behind the tower changes as it climbs
export const ZONES = Object.freeze([
  { id: 'city', name: 'City night', from: 0 },
  { id: 'rain', name: 'Rain clouds', from: 25 },
  { id: 'sunrise', name: 'Above the clouds', from: 50 },
  { id: 'strato', name: 'Stratosphere', from: 90 },
  { id: 'orbit', name: 'Orbit', from: 140 },
]);

export function zoneIndex(floors) {
  let i = 0;
  for (let k = 0; k < ZONES.length; k++) if (floors >= ZONES[k].from) i = k;
  return i;
}
export const zoneOf = (floors) => ZONES[zoneIndex(floors)];
// the next zone and how many floors to it (null at the top)
export function nextZone(floors) {
  const i = zoneIndex(floors);
  const z = ZONES[i + 1];
  return z ? { zone: z, floors: z.from - floors } : null;
}

// ---------- numbers ----------
export const altitude = (floors) => Math.max(0, Math.round(floors)) * METERS;
export const altitudeText = (floors) => `${altitude(floors).toLocaleString('en-US')} m`;

// how fast a floor slides (units a second): gentle in the city (you learn it there), then rising through the zones to
// its cap in orbit: a little early lift plus a long smooth ramp
export function speedAt(floors) {
  const n = Math.max(0, floors);
  const t = Math.min(1, Math.max(0, (n - SPEED.from) / (SPEED.to - SPEED.from)));
  const k = 0.35 * (1 - Math.exp(-n / SPEED.early)) + 0.65 * t * t * (3 - 2 * t);
  return SPEED.start + (SPEED.max - SPEED.start) * Math.min(1, k / (0.35 * (1 - Math.exp(-SPEED.to / SPEED.early)) + 0.65));
}

// how far from the floor below a drop still counts as perfect (units): 3.5% of the floor's size, at least 0.06, and at
// least PERFECT.ms of the floor's travel at its speed (a fast, narrow floor stays fair on a phone)
export function perfectTolerance(size, speed = 0) {
  return Math.max(PERFECT.min, PERFECT.frac * size, (PERFECT.ms / 1000) * Math.max(0, speed));
}

// the points for a drop: +1 a floor, +1 more for a perfect, +5 more on every 10th perfect in a row
export function pointsFor(kind, streak = 0) {
  if (kind === 'miss') return 0;
  let p = 1;
  if (kind === 'perfect') {
    p += 1;
    if (streak > 0 && streak % STREAK_BONUS.every === 0) p += STREAK_BONUS.points;
  }
  return p;
}

// ---------- the slice ----------
// `below` and `moving` are { x, z, w, d }; `axis` is 'x' or 'z' (the one the floor slides along). → { kind: 'perfect'
// | 'cut' | 'miss', placed (the floor kept), fallen (what falls), delta (moving − below along the axis), overlap, grew,
// streak (the streak after it), close }
export function resolveDrop(below, moving, axis, { streak = 0, speed = 0 } = {}) {
  const k = axis === 'z' ? 'z' : 'x';
  const s = k === 'x' ? 'w' : 'd';
  const size = moving[s];
  const delta = moving[k] - below[k];
  const lo = Math.max(moving[k] - size / 2, below[k] - below[s] / 2);
  const hi = Math.min(moving[k] + size / 2, below[k] + below[s] / 2);
  const overlap = hi - lo;
  if (!(overlap > EPS)) {
    return { kind: 'miss', axis: k, placed: null, fallen: { ...moving }, delta, overlap: 0, grew: 0, streak: 0, close: false };
  }
  if (Math.abs(delta) <= perfectTolerance(size, speed) + EPS) {
    const next = streak + 1;
    const placed = { ...moving, [k]: below[k] };          // snapped exactly onto the floor below: nothing lost
    let grew = 0;
    if (next >= GROW.from && size < BASE - EPS) {
      const grown = Math.min(BASE, size + GROW.step);
      grew = grown - size;
      placed[s] = grown;
    }
    return { kind: 'perfect', axis: k, placed, fallen: null, delta, overlap: size, grew, streak: next, close: false };
  }
  const placed = { ...moving, [k]: (lo + hi) / 2, [s]: overlap };
  const fLo = delta > 0 ? hi : moving[k] - size / 2;
  const fHi = delta > 0 ? moving[k] + size / 2 : lo;
  const fallen = { ...moving, [k]: (fLo + fHi) / 2, [s]: fHi - fLo };
  return { kind: 'cut', axis: k, placed, fallen, delta, overlap, grew: 0, streak: 0, close: overlap < CLOSE * size };
}

// ---------- a run ----------
// the moving floor's axis: floor 1 slides along X, floor 2 along Z…
export const axisOf = (floorNumber) => (floorNumber % 2 ? 'x' : 'z');

export function createRun() {
  const run = {
    floors: [{ x: 0, z: 0, w: BASE, d: BASE, n: 0, kind: 'lobby' }],   // floor 0, the lobby
    score: 0, streak: 0, bestStreak: 0, perfects: 0, cuts: 0, closes: 0, grows: 0,
    over: false, moving: null, axis: 'x', offset: -SPAWN, dir: 1, speed: SPEED.start, age: 0,
  };
  spawn(run);
  return run;
}

export const topOf = (run) => run.floors[run.floors.length - 1];
export const heightOf = (run) => run.floors.length - 1;      // floors stacked above the lobby (the big number)

// the next floor: a copy of the top floor's footprint, at the far end of its axis, sliding toward the other end
export function spawn(run) {
  const top = topOf(run);
  const n = run.floors.length;
  run.axis = axisOf(n);
  run.offset = -SPAWN;
  run.dir = 1;
  run.age = 0;
  run.speed = speedAt(n - 1);
  run.moving = { x: top.x, z: top.z, w: top.w, d: top.d, n };
  place(run);
  return run.moving;
}

function place(run) {
  const top = topOf(run);
  run.moving.x = top.x + (run.axis === 'x' ? run.offset : 0);
  run.moving.z = top.z + (run.axis === 'z' ? run.offset : 0);
}

// ping-pong between −SPAWN and +SPAWN
export function swing(offset, dir, dist) {
  let o = offset + dir * dist, d = dir;
  for (let i = 0; i < 4; i++) {
    if (o > SPAWN) { o = 2 * SPAWN - o; d = -1; } else if (o < -SPAWN) { o = -2 * SPAWN - o; d = 1; } else break;
  }
  return { offset: o, dir: d };
}

export function stepRun(run, dt) {
  if (run.over || !run.moving) return;
  run.age += dt;
  const s = swing(run.offset, run.dir, run.speed * dt);
  run.offset = s.offset; run.dir = s.dir;
  place(run);
}

// the floor where it was `rewind` seconds ago (a tap's own delay on a touchscreen): never before it appeared
export function offsetAt(run, rewind = 0) {
  const back = Math.min(Math.max(0, rewind), run.age);
  return back > 0 ? swing(run.offset, -run.dir, run.speed * back).offset : run.offset;
}

// drop the moving floor → the event (resolveDrop's, with points, the floor's number and the score after it); a miss
// ends the run. A perfect or a cut spawns the next floor at once.
export function dropRun(run, { rewind = 0 } = {}) {
  if (run.over || !run.moving) return null;
  const top = topOf(run);
  const off = offsetAt(run, rewind);
  const moving = { ...run.moving };
  if (run.axis === 'x') moving.x = top.x + off; else moving.z = top.z + off;
  const r = resolveDrop(top, moving, run.axis, { streak: run.streak, speed: run.speed });
  const ev = { ...r, n: moving.n, moving, below: top, speed: run.speed, points: pointsFor(r.kind, r.streak) };
  if (r.kind === 'miss') {
    run.over = true;
    run.moving = null;
    run.streak = 0;
  } else {
    run.floors.push({ ...r.placed, n: moving.n, kind: r.kind });
    run.streak = r.streak;
    run.bestStreak = Math.max(run.bestStreak, run.streak);
    if (r.kind === 'perfect') run.perfects++; else run.cuts++;
    if (r.close) run.closes++;
    if (r.grew > 0) run.grows++;
    run.score += ev.points;
    spawn(run);
  }
  ev.score = run.score;
  ev.height = heightOf(run);
  ev.milestone = r.kind === 'perfect' && r.streak > 0 && r.streak % STREAK_BONUS.every === 0;
  const before = zoneIndex(ev.height - (r.kind === 'miss' ? 0 : 1)), after = zoneIndex(ev.height);
  ev.zone = after !== before ? after : -1;
  return ev;
}

// ---------- an AI that plays (the demo, the title's tower): it aims for an error and drops when the floor crosses it ----------
// aim: how far from perfect it means to drop this floor (0 = perfect). Mostly perfect, now and then a small cut, and
// a miss when `fail` says so.
export function aimFor(r, { slip = 0.16, wide = 0.4, fail = false } = {}) {
  if (fail) return { error: SPAWN, fail: true };
  const roll = r.next();
  if (roll < slip) return { error: (r.next() < 0.5 ? -1 : 1) * (0.12 + r.next() * wide), fail: false };
  return { error: (r.next() - 0.5) * 0.04, fail: false };
}

// does the floor cross the aimed offset between two steps? (prev → now)
export const crosses = (prev, now, aim) => (prev - aim) * (now - aim) <= 0 && prev !== now;

// build `count` floors at once (no animation): the demo's head start and the title's tower. `r` is rng(seed).
export function prebuild(run, count, r, opts = {}) {
  for (let i = 0; i < count && !run.over; i++) {
    const a = aimFor(r, opts);
    const top = topOf(run);
    const error = a.fail ? 0 : a.error;
    if (run.axis === 'x') run.moving.x = top.x + error; else run.moving.z = top.z + error;
    run.offset = error;
    run.age = 1;
    dropRun(run);
  }
  return run;
}

// what a run leaves in the over card: its numbers, rounded for words
export function summary(run) {
  const floors = heightOf(run);
  return {
    floors, score: run.score, perfects: run.perfects, bestStreak: run.bestStreak, altitude: altitude(floors),
    altitudeText: altitudeText(floors), zone: zoneIndex(floors), next: nextZone(floors),
  };
}
