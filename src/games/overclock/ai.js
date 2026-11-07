// OVERCLOCK: AGI-1's own pinball player, for ?demo and the title screen's attract mode. Pure (no DOM), seeded (the same
// seed plays the same game). It looks a few hundredths of a second ahead and flips when a ball is about to cross a
// flipper's sweep; a slow ball gets cradled, and from a cradle it lets go and flips on a count, aiming at a shot (the
// ramp from the right flipper, the socket or the fan from the left, as the table's state asks). It plunges for the lit
// skill-shot lane.
import { BALL_R, GRAVITY } from './physics.js';
import { bandOf } from './sim.js';
import { rng as makeRng } from '../kit/fx.js';

// from a cradle: let go, wait this long, flip (measured with tools/games/overclock/physics-check.mjs cradle)
export const AIMS = {
  R: { ramp: 0.46, orbit: 0.4, gpu: 0.32 },
  L: { socket: 0.4, fan: 0.46, gpu: 0.32 },
};

export function createAI(seed = 1, { skill = 0.92 } = {}) {
  return {
    r: makeRng(seed * 31 + 7), skill,
    hold: { L: 0, R: 0 },          // keep this flipper up this much longer (s)
    cradle: { L: 0, R: 0 },        // how long a ball has sat in this flipper's cradle
    plan: { L: null, R: null },    // { wait, t, shot } after letting go of a cradle
    plungeTo: null, plungeWait: 0,
    nudgeCool: 0,
  };
}

const wedge = (f, x, y) => {
  const dx = x - f.x, dy = y - f.y;
  const rho = Math.hypot(dx, dy);
  const th = Math.atan2(dy, dx);
  let d = th - f.rest;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return { rho, delta: d * f.dir, span: Math.abs(f.up - f.rest) };
};

// is this ball about to be hit by flipper f if it flipped now? (its spot a moment ahead, inside the sweep)
function threat(f, b, look) {
  const x = b.x + b.vx * look, y = b.y + b.vy * look + 0.5 * GRAVITY * look * look;
  const w = wedge(f, x, y);
  const reach = f.len + f.r2 + BALL_R + 2;
  if (w.rho < f.r1 + 4 || w.rho > reach) return null;
  if (w.delta < -0.05 || w.delta > w.span + 0.25) return null;
  return w;
}

// → sets S.input.left / right / plunge for this tick
export function think(ai, S, dt) {
  const inp = S.input, T = S.T;
  ai.nudgeCool = Math.max(0, ai.nudgeCool - dt);
  // a ball waiting in the shooter lane: pull to the lit lane's band, then let go
  const pb = S.balls.find((b) => b.mode === 'plunger');
  if (pb && S.plunger.ready && S.plunger.auto <= 0 && S.phase !== 'bonus' && S.phase !== 'over') {
    if (ai.plungeTo == null) {
      const band = bandOf(S.R.skillLane);
      ai.plungeTo = band ? band.p0 + (band.p1 - band.p0) * (0.35 + ai.r.next() * 0.3) : 0.5;
      if (ai.r.next() > ai.skill) ai.plungeTo = ai.r.range(0.1, 1);
      ai.plungeWait = 0.35 + ai.r.next() * 0.4;
    }
    if (ai.plungeWait > 0) { ai.plungeWait -= dt; inp.plunge = false; } else inp.plunge = S.plunger.pull < ai.plungeTo;
  } else { inp.plunge = false; ai.plungeTo = null; }

  for (const side of ['L', 'R']) {
    const f = T.flippers[side];
    let want = false;
    ai.hold[side] = Math.max(0, ai.hold[side] - dt);
    if (ai.hold[side] > 0) want = true;
    // a plan from a cradle: down, count, flip
    const plan = ai.plan[side];
    if (plan) {
      plan.t += dt;
      if (plan.t >= plan.wait) { ai.plan[side] = null; ai.hold[side] = 0.16; want = true; } else want = false;
    }
    let cradled = false;
    for (const b of S.balls) {
      if (!b.live) continue;
      const sp = Math.hypot(b.vx, b.vy);
      // sitting in a held flipper's cradle: keep it there a moment, then aim
      if (f.held && b.onFlipper === f && sp < 60 && !plan) {
        cradled = true;
        ai.cradle[side] += dt;
        const others = S.balls.some((o) => o !== b && o.live && o.y > 640 && o.vy > 0);
        if (ai.cradle[side] > 0.35 + ai.r.next() * 0.02 && !others) {
          ai.cradle[side] = 0;
          const shot = pickShot(S, side, ai);
          ai.plan[side] = { wait: AIMS[side][shot] + (ai.r.next() - 0.5) * 0.02 * (2 - ai.skill), t: 0, shot };
          want = false;
        } else want = true;
        continue;
      }
      if (plan) continue;
      if (b.vy < -350) continue;               // on its way up the table
      const look = 0.028 + (1 - ai.skill) * ai.r.next() * 0.03;
      const w = threat(f, b, look) || threat(f, b, look * 0.4);
      if (!w) continue;
      // a slow ball rolling onto the flipper: catch it (cradle) instead of a weak flip
      if (sp < 420 && w.delta < 0.35 && ai.r.next() < 0.5 * ai.skill) { ai.hold[side] = 0.6; want = true; continue; }
      want = true;
      ai.hold[side] = Math.max(ai.hold[side], 0.15 + ai.r.next() * 0.06);
    }
    if (!cradled) ai.cradle[side] = 0;
    if (side === 'L') inp.left = want; else inp.right = want;
  }
  // the upper flipper shares the right button: flip it when a ball drops onto it and nothing threatens the right
  const U = T.flippers.U;
  for (const b of S.balls) {
    if (!b.live || b.vy < -200) continue;
    if (threat(U, b, 0.03) && !ai.plan.R) { inp.right = true; ai.hold.R = Math.max(ai.hold.R, 0.12); }
  }
}

function pickShot(S, side, ai) {
  const R = S.R;
  if (side === 'R') {
    if (R.multiball || R.agi > 0 || R.mission?.on === 'ramp') return 'ramp';
    if (!R.lockLit && R.gpu.some((g) => !g) && ai.r.next() < 0.35) return 'gpu';
    if (R.mission?.on === 'orbit' && ai.r.next() < 0.5) return 'orbit';
    return ai.r.next() < 0.7 ? 'ramp' : 'orbit';
  }
  if (R.lockLit || R.agiReady) return 'socket';
  if (R.mission?.on === 'spin' || R.mission?.on === 'orbit') return 'fan';
  if (R.gpu.some((g) => !g) && ai.r.next() < 0.5) return 'gpu';
  return ai.r.next() < 0.5 ? 'socket' : 'fan';
}
