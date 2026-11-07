// OVERCLOCK: a headless look at the raw physics (no rules): plunges, drops, cradles, flips.
// node tools/games/overclock/physics-check.mjs [plunge|random|cradle|all]
import { stepWorld, makeBall, BALL_R, probe, probeFlipper } from '../../../src/games/overclock/physics.js';
import { buildTable, PLUNGER, ARCH, SLINGS, DRAIN_Y, W } from '../../../src/games/overclock/table.js';
import { rng } from '../../../src/games/kit/fx.js';

const what = process.argv[2] || 'all';
const DT = 1 / 120;
const tmp = { nx: 0, ny: 0 };
function overlap(T, b) {
  let worst = 0, by = null;
  for (const c of T.world.colliders) { if (!c.on) continue; const d = probe(c, b.x, b.y, tmp); if (BALL_R - d > worst) { worst = BALL_R - d; by = c; } }
  for (const f of T.world.flippers) { const d = probeFlipper(f, b.x, b.y, tmp); if (BALL_R - d > worst) { worst = BALL_R - d; by = f; } }
  return { worst, by };
}
const triIn = (p, a, b, c) => {
  const s = (p1, p2, p3) => (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1]);
  const d1 = s(p, a, b), d2 = s(p, b, c), d3 = s(p, c, a);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
};
function validStart(x, y) {
  if (x < 18 + BALL_R || x > 552 - BALL_R) return false;
  if (y < ARCH.y && Math.hypot(x - ARCH.x, y - ARCH.y) > ARCH.inner - 8 - BALL_R && x > 300) return false;
  if (y < ARCH.y && Math.hypot(x - ARCH.x, y - ARCH.y) > ARCH.out - BALL_R) return false;
  for (const s of SLINGS) if (triIn([x, y], s.a, s.b, s.c)) return false;
  return true;
}
if (what === 'all' || what === 'plunge') {
  for (let v0 = 2090; v0 <= 2300; v0 += 6) {
    const T = buildTable();
    const b = makeBall(PLUNGER.x, PLUNGER.y, 0, -v0);
    let first = null, exitV = null;
    for (let i = 0; i < 120 * 4 && !first; i++) {
      stepWorld(T.world, [b], DT, { sensor(s, bb) { if (s.tag === 'lane' && !first) first = `lane ${s.ref}`; if (s.tag === 'launched' && exitV == null) exitV = Math.round(Math.hypot(bb.vx, bb.vy)); if (s.tag === 'orbit' && !first) first = `orbit ${s.ref}`; } });
      if (b.y > 600 && b.x < 556 && !first) first = `fell (${Math.round(b.x)})`;
    }
    console.log(`v0 ${v0}: exit ${exitV} K ${exitV ? Math.round((v0 * v0 - exitV * exitV) / 1000) : '-'}k → ${first || `at ${Math.round(b.x)},${Math.round(b.y)}`}`);
  }
}
if (what === 'all' || what === 'random') {
  const R = rng(5);
  let worst = 0, escaped = 0, ticks = 0, bad = 0;
  for (let n = 0; n < 2000; n++) {
    const T = buildTable();
    for (const f of Object.values(T.flippers)) f.held = R.chance(0.5);
    let b;
    for (;;) { b = makeBall(R.range(20, 560), R.range(30, 1000), 0, 0); if (validStart(b.x, b.y) && overlap(T, b).worst <= 0) break; }
    const a = R.range(0, Math.PI * 2), sp = R.range(500, 4300);
    b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp;
    const start = { x: b.x, y: b.y, vx: b.vx, vy: b.vy };
    for (let i = 0; i < 240; i++) {
      if (i % 17 === 0) for (const f of Object.values(T.flippers)) f.held = R.chance(0.5);
      const px = b.x, py = b.y;
      stepWorld(T.world, [b], DT);
      ticks++;
      const o = overlap(T, b);
      if (o.worst > worst) worst = o.worst;
      if (o.worst > 6 && bad < 6) { bad++; console.log(`  deep ${o.worst.toFixed(1)} at ${b.x.toFixed(0)},${b.y.toFixed(0)} (from ${px.toFixed(0)},${py.toFixed(0)}) by ${o.by.tag}${o.by.side ? ' ' + o.by.side : ''} start ${JSON.stringify(start)}`); }
      if (b.x < 18 - 2 || b.x > W - 4 || b.y < 6) { escaped++; if (escaped < 5) console.log(`  escaped at ${b.x.toFixed(0)},${b.y.toFixed(0)} start ${JSON.stringify(start)}`); break; }
      if (b.y > DRAIN_Y) break;
    }
  }
  console.log(`random: ${ticks} ticks, deepest overlap after a tick ${worst.toFixed(2)}, escaped ${escaped}`);
}
if (what === 'all' || what === 'cradle') {
  for (const side of ['L', 'R']) {
    const inl = side === 'L' ? [84, 800] : [490, 800];
    const T = buildTable();
    T.flippers[side].held = true;
    const b = makeBall(inl[0], inl[1], 0, 200);
    for (let i = 0; i < 240; i++) stepWorld(T.world, [b], DT);
    console.log(`cradle ${side}: at ${b.x.toFixed(1)},${b.y.toFixed(1)} speed ${Math.hypot(b.vx, b.vy).toFixed(1)} u ${b.flipU.toFixed(1)}`);
    for (let d = 0.1; d <= 0.62; d += 0.03) {
      const T2 = buildTable();
      T2.flippers[side].held = true;
      const c = makeBall(inl[0], inl[1], 0, 200);
      for (let i = 0; i < 240; i++) stepWorld(T2.world, [c], DT);
      T2.flippers[side].held = false;
      for (let i = 0; i < Math.round(d * 120); i++) stepWorld(T2.world, [c], DT);
      const u0 = c.flipU;
      T2.flippers[side].held = true;
      let shot = null, where = null;
      for (let i = 0; i < 240; i++) {
        stepWorld(T2.world, [c], DT, { sensor(s) { if (!where && ['ramp', 'orbit', 'socket', 'spinner', 'lane'].includes(s.tag)) where = `${s.tag}${s.ref != null ? s.ref : ''}`; }, contact(cc) { if (!where && ['target', 'pop'].includes(cc.tag)) where = `${cc.tag}${cc.ref}`; } });
        if (!shot && c.vy < 0 && !c.onFlipper && i > 2) shot = { vx: c.vx, vy: c.vy };
        if (c.y > DRAIN_Y) { where = where || 'drain'; break; }
      }
      const ang = shot ? Math.round(Math.atan2(-shot.vy, shot.vx) * 180 / Math.PI) : null;
      console.log(`  ${side} flip after ${d.toFixed(2)}s (u ${u0.toFixed(0)}): ${shot ? `${Math.round(Math.hypot(shot.vx, shot.vy))} u/s at ${ang}°` : 'no shot'} → ${where || `${c.x.toFixed(0)},${c.y.toFixed(0)}`}`);
    }
  }
}
