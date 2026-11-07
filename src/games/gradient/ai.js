// GRADIENT DESCENT (2026-11-08): the demo's golfer. It tries a few hundred putts with the real physics (simulate()),
// keeps the ones that stop where the cup is easiest to reach from (course.js's cost map: climbing costs extra, pits and
// posts are walked around), sharpens the best few, and prefers a putt that drops in and still drops in when it's off by
// a hair. Pure and deterministic (its little wobble comes from the seeded dice it's given).
import { simulate, PHYS } from './physics.js';
import { costField } from './course.js';

const DEG = Math.PI / 180;
const POWERS = [0.1, 0.17, 0.25, 0.34, 0.44, 0.55, 0.67, 0.8, 0.92, 1];
const POWERS_FAST = [0.14, 0.26, 0.4, 0.56, 0.74, 0.92];

const AI_T = 10;          // a putt still rolling after this long is judged where it is (and not liked much)

export function scoreOf(hole, cost, r) {
  if (r.done === 'sink') return -1000 + r.t * 0.5;
  if (r.done === 'pit') return 1000;
  const d = Math.hypot(r.x - hole.cup[0], r.z - hole.cup[1]);
  return cost.at(r.x, r.z) + 0.25 * d + (r.done ? 0 : 6);
}

// The best putt from (x, z) → { angle, power, result, sinks, tries }
export function planShot(hole, x, z, { rand = null, noise = 0, cost = null, coarse = 1 } = {}) {
  const cf = cost || hole._cost || (hole._cost = costField(hole));
  let tries = 0;
  const run = (angle, power) => {
    tries++;
    const r = simulate(hole, x, z, angle, power, { maxT: AI_T });
    return { angle, power, r, s: scoreOf(hole, cf, r) };
  };
  const base = Math.atan2(hole.cup[1] - z, hole.cup[0] - x);
  // angles: dense around the straight line to the cup, sparse all the way round (valleys curve)
  const angles = [];
  const dense = coarse >= 1 ? 4 : 8;
  for (let d = -28; d <= 28; d += dense) angles.push(base + d * DEG);
  const sparse = coarse >= 1 ? 24 : 45;
  for (let d = 36; d <= 324; d += sparse) angles.push(base + d * DEG);
  const powers = coarse >= 1 ? POWERS : POWERS_FAST;
  const tried = [];
  for (const a of angles) for (const p of powers) tried.push(run(a, p));
  tried.sort((a, b) => a.s - b.s);

  // sharpen the best few (distinct ones)
  const seeds = [];
  const nSeeds = coarse >= 1 ? 4 : 2;
  for (const t of tried) {
    if (seeds.length >= nSeeds) break;
    if (seeds.every((s) => Math.abs(angDiff(s.angle, t.angle)) > 3 * DEG || Math.abs(s.power - t.power) > 0.05)) seeds.push(t);
  }
  let pool = [...seeds];
  for (const s of seeds) {
    for (const da of [-2.2, 0, 2.2]) for (const dp of [-0.035, 0, 0.035]) {
      if (!da && !dp) continue;
      const p = clamp01(s.power + dp);
      pool.push(run(s.angle + da * DEG, p));
    }
  }
  pool.sort((a, b) => a.s - b.s);
  const top = pool[0];
  for (const da of [-0.8, 0, 0.8]) for (const dp of [-0.012, 0, 0.012]) {
    if (!da && !dp) continue;
    pool.push(run(top.angle + da * DEG, clamp01(top.power + dp)));
  }
  pool.sort((a, b) => a.s - b.s);

  // among the putts that drop, the one that still drops when it's a hair off
  let pick = pool[0];
  const sinkers = pool.filter((t) => t.r.done === 'sink').slice(0, 6);
  if (sinkers.length) {
    let bestSafe = -1;
    for (const t of sinkers) {
      let ok = 0;
      for (const [da, dp] of [[-0.45, 0], [0.45, 0], [0, -0.01], [0, 0.01]]) {
        if (simulate(hole, x, z, t.angle + da * DEG, clamp01(t.power + dp), { maxT: AI_T }).done === 'sink') ok++;
      }
      if (ok > bestSafe) { bestSafe = ok; pick = t; }
      if (ok === 4) break;
    }
  }
  let { angle, power } = pick;
  let result = pick.r;
  if (noise > 0 && rand) {
    const na = angle + (rand.next() * 2 - 1) * noise * 0.6 * DEG, np = clamp01(power + (rand.next() * 2 - 1) * noise * 0.012);
    const r = simulate(hole, x, z, na, np, { maxT: AI_T });
    // a wobble that would turn a drop into a miss is kept small: the demo is a good golfer, not a perfect one
    if (!(pick.r.done === 'sink' && r.done !== 'sink')) { angle = na; power = np; result = r; }
  }
  return { angle, power, result: { ...result }, sinks: sinkers.length > 0, tries };
}

const clamp01 = (v) => (v < PHYS.MIN_POWER ? PHYS.MIN_POWER : v > 1 ? 1 : v);
function angDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

// Plays a whole hole with planShot (the tests, the balance tool, the daily hole's check): → { strokes, sunk, shots }
export function playHole(hole, { rand = null, noise = 0, maxStrokes = 8, coarse = 1 } = {}) {
  let x = hole.start[0], z = hole.start[1];
  let strokes = 0;
  const shots = [];
  while (strokes < maxStrokes) {
    const plan = planShot(hole, x, z, { rand, noise, coarse });
    strokes++;
    shots.push({ x, z, angle: plan.angle, power: plan.power, done: plan.result.done });
    if (plan.result.done === 'sink') return { strokes, sunk: true, shots };
    if (plan.result.done === 'pit') { strokes++; continue; }   // +1, back where it was
    x = plan.result.x; z = plan.result.z;
  }
  return { strokes, sunk: false, shots };
}
