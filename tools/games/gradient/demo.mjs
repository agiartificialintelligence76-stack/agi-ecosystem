// GRADIENT DESCENT's demo finder (2026-11-08): where should the self-playing demo's ball start, so that its first putt
// (planned by the demo's own AI with its seeded wobble) curves and drops in 3 to 4.3 seconds (the arcade records 5.7 to
// 11.7 s after the page opens; the putt goes at about 6.1 s)? Scans a grid of spots on one hole and lists the best.
//   node tools/games/gradient/demo.mjs banana [seed]
import { HOLES } from '../../../src/games/gradient/holes.js';
import { buildHole } from '../../../src/games/gradient/course.js';
import { planShot } from '../../../src/games/gradient/ai.js';
import { simulate } from '../../../src/games/gradient/physics.js';
import { rng } from '../../../src/games/kit/fx.js';

const id = process.argv[2] || 'banana';
const seed = Number(process.argv[3] || 7);
const hole = buildHole(HOLES.find((h) => h.id === id));
const [hx, hz] = hole.half;
const out = [];
for (let x = -hx + 1; x <= hx - 1; x += 0.9) {
  for (let z = -hz + 1; z <= hz - 1; z += 0.9) {
    const d = Math.hypot(x - hole.cup[0], z - hole.cup[1]);
    if (d < 6) continue;
    if (hole.pits.some((p) => Math.hypot(x - p.x, z - p.z) < p.r + 1)) continue;
    // a spot where a ball rests (it would roll away otherwise)
    const still = simulate(hole, x, z, 0, 0.0001, { maxT: 1.5 });
    if (Math.hypot(still.x - x, still.z - z) > 0.05) continue;
    const plan = planShot(hole, x, z, { rand: rng(seed), noise: 0.6 });
    const r = plan.result;
    if (r.done !== 'sink' || r.t < 2.8 || r.t > 4.4) continue;
    // how much it curves: the angle between the putt and its last approach to the cup
    const pts = [];
    simulate(hole, x, z, plan.angle, plan.power, { track: (px, pz) => pts.push([px, pz]) });
    const a = pts[Math.max(0, pts.length - 6)], b = pts[pts.length - 1];
    const turn = Math.abs(((Math.atan2(b[1] - a[1], b[0] - a[0]) - plan.angle + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
    out.push({ x: +x.toFixed(2), z: +z.toFixed(2), t: +r.t.toFixed(2), power: +plan.power.toFixed(2), turn: +(turn * 57.3).toFixed(0), d: +d.toFixed(1) });
  }
}
out.sort((p, q) => q.turn - p.turn);
console.log(`${id}: ${out.length} spots`);
for (const o of out.slice(0, 12)) console.log(JSON.stringify(o));
