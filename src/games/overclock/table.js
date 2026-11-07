// OVERCLOCK: the table, AGI-1's motherboard. Pure data and a builder (no DOM): the physics, the renderer, the demo
// player and the tests all read this one description. Units: 600 × 1100, y down the table toward the flippers.
//
//                 ┌──────── top arch (the orbit) ────────┐
//                 │     R   A   M   (rollover lanes)  ⌒ gate (one way out of the shooter lane)
//                 │   [core]       [core]             │
//   left orbit →  │        [core]                     │ ← right orbit (the fan: a spinner)
//   PCIe ramp  →  │      G  P  U  (drop targets)      │
//                 │                  (CPU socket)     │ ← upper flipper
//                 │  sling                    sling   │
//                 │ in/outlanes  flipper  flipper     │ shooter lane / plunger
import { seg, circle, arc, flipper, line, spot, createWorld, BALL_R } from './physics.js';
import { rng as makeRng } from '../kit/fx.js';

export const W = 600, H = 1100;
export const MID = 287;                         // the playfield's centre line (the shooter lane is on the right)
export const ARCH = { x: 306, y: 300, out: 288, inner: 250 };
export const GATE_A = Math.PI * 2 - (70 * Math.PI) / 180;   // where the shooter lane opens onto the top of the table
export const DRAIN_Y = 1112;
export const PLUNGER = { x: 577, y: 1080 - 4 - BALL_R, lane: [560, 594], top: 300 };
export const DEG = Math.PI / 180;

export const FLIPPERS = {
  L: { x: 183, y: 991, len: 84, r1: 14, r2: 8, rest: 30 * DEG, up: -26 * DEG, side: 'L' },
  R: { x: 391, y: 991, len: 84, r1: 14, r2: 8, rest: 150 * DEG, up: 206 * DEG, side: 'R' },
  U: { x: 538, y: 648, len: 58, r1: 12, r2: 7, rest: 155 * DEG, up: 203 * DEG, side: 'U' },
};
export const BUMPERS = [
  { x: 215, y: 224, r: 27 },
  { x: 335, y: 219, r: 27 },
  { x: 275, y: 306, r: 27 },
];
export const LANES = [{ x: 200, y: 120 }, { x: 260, y: 120 }, { x: 320, y: 120 }];
export const LANE_GUIDES = [170, 230, 290, 350];
// the bank leans 12° (a ball that lands on its back rolls off it, never rests there)
export const TARGET_TILT = 12 * Math.PI / 180;
export const TARGETS = [-1, 0, 1].map((k) => ({ x: 286 + k * 48 * Math.cos(TARGET_TILT), y: 434 + k * 48 * Math.sin(TARGET_TILT) }));
export const TARGET_HALF = 21;
export const SOCKET = { x: 412, y: 474, r: 16 };
export const SPINNER = { x0: 504, x1: 552, y: 430 };
export const SLINGS = [
  { a: [108, 770], b: [108, 881], c: [177, 921] },
  { a: [466, 770], b: [466, 881], c: [397, 921] },
];
export const GUIDES = [
  [[60, 772], [60, 906], [177, 974]],
  [[514, 772], [514, 906], [397, 974]],
];
export const ORBIT_L = [[84, 650], [64, 540], [64, 330]];        // the left orbit's inner wall
export const ORBIT_GATE = [[16, 300], [64, 330]];                // one way: up the left orbit, never back down it
export const RAMP_WALL = [[152, 652], [128, 540], [128, 488]];   // the ramp mouth's right wall
export const RAMP_TOP = [[64, 452], [128, 488]];                 // a failed ramp shot rolls back from here (and a ball
                                                                 // landing on top of it rolls off)
export const ORBIT_R = [[500, 340], [500, 562]];                 // the right orbit's inner wall
export const U_DEFLECT = [[553, 604], [533, 633]];                // over the upper flipper's pivot
export const RAMP_LINE = [[68, 556], [126, 556]];                // a ball crossing this fast enough rides the ramp
export const RAMP_MIN_V = 950;                                   // …this fast (units/s, going up)
// the ramp's path over the playfield (Catmull-Rom through these), from the mouth to the right inlane
export const RAMP_PATH = [
  [97, 556], [93, 470], [97, 380], [113, 296], [150, 226], [208, 180], [290, 163], [380, 166], [452, 192],
  [503, 246], [523, 330], [525, 440], [517, 540], [498, 626], [486, 702], [489, 780],
];
export const RAMP_EXIT_V = 620;

// where the lit arrows (inserts) sit, pointing at their shots (angle: where the arrow points)
export const INSERTS = {
  ramp: { x: 140, y: 712, a: -110 * DEG },
  orbitL: { x: 46, y: 712, a: -95 * DEG },
  gpu: { x: 286, y: 505, a: -90 * DEG },
  socket: { x: 392, y: 548, a: -70 * DEG },
  orbitR: { x: 528, y: 600, a: -88 * DEG },
};

export function arcY(x, r = ARCH.out) { return ARCH.y - Math.sqrt(Math.max(0, r * r - (x - ARCH.x) ** 2)); }

const poly = (pts, o) => pts.slice(1).map((p, i) => seg(pts[i][0], pts[i][1], p[0], p[1], o));

// Builds a fresh table: its world (colliders, flippers, sensors) and handles on its moving parts
export function buildTable(seed = 1) {
  const wall = { e: 0.42, f: 0.05, tag: 'wall' };
  const rail = { e: 0.45, f: 0.05, tag: 'wall', r: 4 };
  const rubber = { e: 0.68, f: 0.12, tag: 'rubber', sound: 'rubber' };
  const C = [];
  // the cabinet: left wall, the top arch, the right wall
  C.push(seg(14, 300, 14, H + 40, { ...wall, r: 4 }));
  C.push(arc(ARCH.x, ARCH.y, ARCH.out + 4, Math.PI, Math.PI * 2, { ...wall, r: 4 }));
  C.push(seg(598, 300, 598, H + 40, { ...wall, r: 4 }));
  // the shooter lane: its inner wall, its curve over the top, its floor (the plunger's tip)
  C.push(seg(556, 300, 556, 1084, rail));
  C.push(arc(ARCH.x, ARCH.y, ARCH.inner, GATE_A, Math.PI * 2, rail));
  C.push(seg(556, 1080, 598, 1080, { ...wall, r: 4, e: 0.2, tag: 'plunger' }));
  // the gate: a ball leaves the shooter lane through it, nothing comes back in
  const gx0 = ARCH.x + Math.cos(GATE_A) * ARCH.inner, gy0 = ARCH.y + Math.sin(GATE_A) * ARCH.inner;
  const gx1 = ARCH.x + Math.cos(GATE_A) * (ARCH.out + 4), gy1 = ARCH.y + Math.sin(GATE_A) * (ARCH.out + 4);
  C.push(seg(gx0, gy0, gx1, gy1, { e: 0.3, f: 0.05, r: 2, tag: 'gate', oneWay: { x: Math.sin(GATE_A), y: -Math.cos(GATE_A) } }));
  // the RAM lanes' guides
  for (const x of LANE_GUIDES) C.push(seg(x, arcY(x) + 36, x, 142, { ...rail, r: 5, tag: 'guide' }));
  // the orbits, the ramp's mouth
  C.push(...poly(ORBIT_L, rail));
  {
    const [[ax, ay], [bx, by]] = ORBIT_GATE, L = Math.hypot(bx - ax, by - ay);
    C.push(seg(ax, ay, bx, by, { e: 0.3, f: 0.05, r: 2, tag: 'gate', oneWay: { x: (by - ay) / L, y: -(bx - ax) / L } }));
  }
  C.push(...poly(RAMP_WALL, rail));
  C.push(...poly(RAMP_TOP, rail));
  C.push(...poly(ORBIT_R, rail));
  // a deflector over the upper flipper's pivot (a ball coming down the wall rolls onto the flipper, never rests on it)
  C.push(seg(U_DEFLECT[0][0], U_DEFLECT[0][1], U_DEFLECT[1][0], U_DEFLECT[1][1], rail));
  // in/outlanes: their guides, a capacitor on each top
  for (const g of GUIDES) C.push(...poly(g, rail));
  C.push(circle(GUIDES[0][0][0], GUIDES[0][0][1], 7, { ...rubber, tag: 'post' }));
  C.push(circle(GUIDES[1][0][0], GUIDES[1][0][1], 7, { ...rubber, tag: 'post' }));
  // the slingshots: a kicking rubber facing the playfield, two quiet sides
  const slings = SLINGS.map((s, i) => {
    const face = seg(s.a[0], s.a[1], s.c[0], s.c[1], { e: 0.7, f: 0.1, r: 5, kick: 640, kickMin: 150, kickVar: 0.15, kickAngle: 0.16, tag: 'sling', ref: i, sound: 'rubber' });
    C.push(face, seg(s.a[0], s.a[1], s.b[0], s.b[1], { ...rubber, r: 5 }), seg(s.b[0], s.b[1], s.c[0], s.c[1], { ...rubber, r: 5 }));
    return face;
  });
  // the CPU cores (pop bumpers)
  const bumpers = BUMPERS.map((b, i) => {
    const c = circle(b.x, b.y, b.r, { e: 0.5, f: 0.02, kick: 1060, kickMin: 0, kickVar: 0.08, kickAngle: 0.1, tag: 'pop', ref: i, sound: 'pop' });
    C.push(c);
    return c;
  });
  // G-P-U, the drop targets (only their fronts drop them)
  const targets = TARGETS.map((t, i) => {
    const ex = Math.cos(TARGET_TILT) * TARGET_HALF, ey = Math.sin(TARGET_TILT) * TARGET_HALF;
    const c = seg(t.x - ex, t.y - ey, t.x + ex, t.y + ey, { e: 0.35, f: 0.08, r: 6, tag: 'target', ref: i, sound: 'target' });
    C.push(c);
    return c;
  });
  const flippers = { L: flipper(FLIPPERS.L), R: flipper(FLIPPERS.R), U: flipper(FLIPPERS.U) };
  // sensors
  const S = [];
  const lanes = LANES.map((l, i) => { const s = spot(l.x, l.y, 15, { tag: 'lane', ref: i }); S.push(s); return s; });
  const socket = spot(SOCKET.x, SOCKET.y, SOCKET.r, { tag: 'socket' });
  S.push(socket);
  S.push(line(SPINNER.x0, SPINNER.y, SPINNER.x1, SPINNER.y, { tag: 'spinner' }));
  S.push(line(RAMP_LINE[0][0], RAMP_LINE[0][1], RAMP_LINE[1][0], RAMP_LINE[1][1], { tag: 'ramp' }));
  S.push(line(18, 392, 60, 392, { tag: 'orbit', ref: 0 }));
  S.push(line(504, 352, 552, 352, { tag: 'orbit', ref: 1 }));
  S.push(spot(84, 836, 15, { tag: 'inlane', ref: 0 }), spot(490, 836, 15, { tag: 'inlane', ref: 1 }));
  S.push(spot(38, 902, 17, { tag: 'outlane', ref: 0 }), spot(536, 902, 17, { tag: 'outlane', ref: 1 }));
  // a ball through the gate is in play (ball save starts, the skill shot is armed)
  const ga = GATE_A - 4 * DEG;
  S.push(line(ARCH.x + Math.cos(ga) * (ARCH.inner - 4), ARCH.y + Math.sin(ga) * (ARCH.inner - 4),
    ARCH.x + Math.cos(ga) * (ARCH.out + 2), ARCH.y + Math.sin(ga) * (ARCH.out + 2), { tag: 'launched' }));
  const world = createWorld({ colliders: C, flippers: [flippers.L, flippers.R, flippers.U], sensors: S, rng: makeRng(seed * 977 + 3).next });
  return { world, flippers, bumpers, targets, slings, lanes, socket };
}

// ---------- the ramp's path: sampled once, by distance ----------
function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}
export function samplePath(pts, per = 24) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < per; k++) {
      const t = k / per;
      out.push([catmull(p0[0], p1[0], p2[0], p3[0], t), catmull(p0[1], p1[1], p2[1], p3[1], t)]);
    }
  }
  out.push(pts[pts.length - 1].slice());
  const len = [0];
  for (let i = 1; i < out.length; i++) len.push(len[i - 1] + Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]));
  return { pts: out, len, total: len[len.length - 1] };
}
export const RAMP = samplePath(RAMP_PATH);

// a point at distance s along a sampled path, and its direction → [x, y, dx, dy]
export function pathAt(P, s, out = [0, 0, 0, 1]) {
  const L = P.len;
  if (s <= 0) s = 0;
  if (s >= P.total) s = P.total - 1e-6;
  let lo = 0, hi = L.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (L[m] <= s) lo = m; else hi = m; }
  const k = (s - L[lo]) / ((L[hi] - L[lo]) || 1);
  const a = P.pts[lo], b = P.pts[hi];
  const dx = b[0] - a[0], dy = b[1] - a[1], m = Math.hypot(dx, dy) || 1;
  out[0] = a[0] + dx * k; out[1] = a[1] + dy * k; out[2] = dx / m; out[3] = dy / m;
  return out;
}
