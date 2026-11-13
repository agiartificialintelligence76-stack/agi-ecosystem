// OVERTHINKING: a player made of code. It picks a bunch of thoughts of one kind that nothing else is mixed into, draws
// a ribbon round them the way a hand would (through the same pen the player has: penDown, penMove, penUp), and either
// lifts to close the loop or sweeps across its own line and goes straight on to the next bunch.
// It plays the title screen and the arcade's preview (`?demo`), and it tunes the nights
// (tools/games/overthinking/balance.mjs): a beginner, a regular and someone who never lifts the pen.
// Pure and seeded: the same seed, the same night.
import { penDown, penMove, penUp, preview, closable, maxRibbon, count, dice, TUNE } from './sim.js';
import { isKind, SPECIALS } from './kinds.js';

const TAU = Math.PI * 2;

//   speed    how fast the hand moves (thought radii a second)
//   think    seconds between loops, [least, most]
//   lift     lifts the pen to close each loop (false: crosses its own line and keeps drawing)
//   maxN     the biggest bunch it goes for
//   slip     how often it doesn't notice a stray thought in the way
//   margin   how wide of the bunch it draws
export const PROFILES = Object.freeze({
  newbie: Object.freeze({ speed: 12, think: [0.9, 1.8], lift: true, maxN: 4, slip: 0.2, margin: 1.9 }),
  casual: Object.freeze({ speed: 15, think: [0.5, 1.1], lift: true, maxN: 5, slip: 0.1, margin: 1.75 }),
  steady: Object.freeze({ speed: 24, think: [0.2, 0.5], lift: true, maxN: 9, slip: 0.03, margin: 1.6 }),
  expert: Object.freeze({ speed: 34, think: [0.05, 0.15], lift: false, maxN: 99, slip: 0, margin: 1.5 }),
  demo: Object.freeze({ speed: 27, think: [0.1, 0.24], lift: false, maxN: 99, slip: 0, margin: 1.55 }),
});

export function createBot(profile = 'steady', seed = 1) {
  const prof = typeof profile === 'string' ? PROFILES[profile] : profile;
  return { prof, rnd: dice((seed ^ 0x9e3779b9) >>> 0), state: 'idle', wait: 0.4, plan: null, swept: 0, stuck: 0, seen: 0 };
}

const wild = (t) => Boolean(SPECIALS[t.kind]?.wild);

// the bunches worth a loop right now: thoughts of one kind, close together, with nothing else inside the circle
export function targets(S, prof, { blind = false } = {}) {
  const live = S.thoughts.filter((t) => t.born <= 0);
  const out = [];
  const longest = maxRibbon(S) * 0.9, soonest = TUNE.life * 0.8;
  const tryBunch = (members, kind) => {
    let bunch = members.slice();
    while (bunch.length) {
      let cx = 0, cy = 0;
      for (const t of bunch) { cx += t.x; cy += t.y; }
      cx /= bunch.length; cy /= bunch.length;
      let far = 0, farAt = 0;
      bunch.forEach((t, i) => { const d = Math.hypot(t.x - cx, t.y - cy) + t.r; if (d > far) { far = d; farAt = i; } });
      const rho = Math.max(2.1, far + prof.margin - 1);
      const round = TAU * rho * 1.14;
      const ids = new Set(bunch.map((t) => t.id));
      let ok = round <= longest && round / prof.speed <= soonest && bunch.length <= prof.maxN;
      if (ok && !blind) {
        for (const t of live) {
          if (ids.has(t.id)) continue;
          const d = Math.hypot(t.x - cx, t.y - cy);
          const stray = kind === 'cringe' ? true : t.kind === 'cringe' || (t.kind !== kind && !wild(t));
          if (stray && d < rho + 0.45) { ok = false; break; }
          if (t.kind === 'cringe' && d < rho + 1.8) { ok = false; break; }      // it would snap the ribbon
        }
      }
      if (ok) return { kind, ids: [...ids], n: bunch.length, cx, cy, rho };
      bunch.splice(farAt, 1);
    }
    return null;
  };
  const kinds = new Set(live.filter((t) => isKind(t.kind)).map((t) => t.kind));
  for (const kind of kinds) {
    const pool = live.filter((t) => t.kind === kind);
    const left = new Set(pool.map((t) => t.id));
    while (left.size) {
      // a bunch: everything linked to its first thought by short hops
      const first = pool.find((t) => left.has(t.id));
      const bunch = [first];
      left.delete(first.id);
      for (let i = 0; i < bunch.length; i++) {
        for (const o of pool) {
          if (left.has(o.id) && Math.hypot(o.x - bunch[i].x, o.y - bunch[i].y) < 3.7) { left.delete(o.id); bunch.push(o); }
        }
      }
      const got = tryBunch(bunch, kind);
      if (got) out.push(got);
    }
  }
  // a cringe on its own: let it go (if it isn't heading straight for the pen's path)
  for (const c of live) {
    if (c.kind !== 'cringe') continue;
    const got = tryBunch([{ ...c, x: c.x + c.vx * 0.45, y: c.y + c.vy * 0.45 }], 'cringe');
    if (got) out.push({ ...got, ids: [c.id], dismiss: true });
  }
  // a wild one alone (a what-if about to go off, her phone): worth a quick loop
  for (const w of live) {
    if (!wild(w) || out.some((g) => Math.hypot(g.cx - w.x, g.cy - w.y) < g.rho)) continue;
    const got = tryBunch([w], w.kind);
    if (got) out.push({ ...got, solo: true });
  }
  return out;
}

function choose(S, bot) {
  const prof = bot.prof;
  const blind = bot.rnd() < prof.slip;
  const list = targets(S, prof, { blind });
  if (!list.length) return null;
  const hurry = count(S) / S.cfg.cap > 0.78;
  let best = null, bestV = -1;
  for (const g of list) {
    const travel = S.pen.down ? Math.max(0, Math.hypot(S.pen.x - g.cx, S.pen.y - g.cy) - g.rho) : 0;
    const time = (travel + TAU * g.rho * 1.1) / prof.speed + 0.2;
    let worth = g.dismiss ? 4 : g.solo ? (g.kind === 'whatif' || g.kind === 'phone' ? 9 : 5) : g.n * g.n;
    if (hurry) worth = g.dismiss ? 1 : g.n + (g.solo ? 2 : 0);
    const v = (worth / time) * (0.85 + 0.3 * bot.rnd());
    if (v > bestV) { bestV = v; best = g; }
  }
  return best && { ...best, blind };
}

// its middle, as the bunch drifts
function middle(S, plan) {
  let x = 0, y = 0, n = 0;
  for (const t of S.thoughts) if (plan.set.has(t.id)) { x += t.x; y += t.y; n++; }
  if (!n) return null;
  plan.cx = x / n; plan.cy = y / n; plan.alive = n;
  return plan;
}
// the circle's radius as the pen goes round: a little tighter on the way back, then out across where it began
function radiusAt(plan, swept) {
  if (swept <= Math.PI) return plan.rho;
  if (swept <= TAU) return plan.rho * (1 - 0.1 * ((swept - Math.PI) / Math.PI));
  return plan.rho * (0.9 + 0.62 * (swept - TAU));
}
const pointAt = (plan, swept) => {
  const a = plan.a0 + plan.dir * swept, r = radiusAt(plan, swept);
  return { x: plan.cx + Math.cos(a) * r, y: plan.cy + Math.sin(a) * r };
};

// one tick of its hand
export function drive(bot, S, dt) {
  const prof = bot.prof, pen = S.pen;
  if (S.over) return;
  if (bot.state === 'idle') {
    bot.wait -= dt;
    if (bot.wait > 0) return;
    const g = choose(S, bot);
    if (!g) { bot.wait = 0.15; if (pen.down && ++bot.stuck > 12) { penUp(S); bot.stuck = 0; } return; }
    bot.stuck = 0;
    const a0 = Math.atan2(pen.y - g.cy, pen.x - g.cx) || 0;
    bot.plan = { ...g, set: new Set(g.ids), a0, dir: bot.rnd() < 0.5 ? 1 : -1, alive: g.n };
    bot.swept = 0;
    bot.state = 'go';
  }
  const plan = bot.plan;
  if (!plan || !middle(S, plan)) { bot.state = 'idle'; bot.wait = 0.1; return; }

  if (bot.state === 'go') {
    const p = pointAt(plan, 0);
    if (!pen.down) { penDown(S, p.x, p.y); bot.state = 'round'; bot.seen = S.loopsClosed; return; }
    const dx = p.x - pen.x, dy = p.y - pen.y, d = Math.hypot(dx, dy), stepLen = prof.speed * dt;
    if (d <= stepLen) { penMove(S, p.x, p.y); bot.state = 'round'; bot.seen = S.loopsClosed; }
    else penMove(S, pen.x + (dx / d) * stepLen, pen.y + (dy / d) * stepLen);
    return;
  }

  if (bot.state === 'round') {
    const before = pen.pts.length, mixed = S.stats.mixed, cuts = S.stats.cuts;
    bot.swept += (prof.speed * dt) / radiusAt(plan, bot.swept);
    const p = pointAt(plan, bot.swept);
    penMove(S, p.x, p.y);
    const done = () => { bot.state = 'idle'; bot.plan = null; bot.wait = prof.think[0] + (prof.think[1] - prof.think[0]) * bot.rnd(); };
    // the loop closed (resolved, mixed up, or snapped): on to the next
    if (S.loopsClosed !== bot.seen || S.stats.mixed !== mixed || S.stats.cuts !== cuts || pen.pts.length < before - 2) {
      if (prof.lift) penUp(S);
      return done();
    }
    // a hand that lifts: once it's most of the way round and the loop holds what it wanted
    if (prof.lift && bot.swept > 4.9) {
      const pv = preview(S);
      // (a hand that didn't notice the stray lifts anyway: a mixed loop)
      if (plan.blind && pv && bot.swept > 5.3) { penUp(S); return done(); }
      if (pv && (pv.verdict === 'pure' || pv.verdict === 'dismiss') && pv.n >= plan.alive) { penUp(S); return done(); }
      // something else got in: wait for the ribbon to fade rather than close a mixed loop
      if (pv && pv.verdict === 'mixed' && bot.swept > 5.6) { bot.state = 'hold'; bot.wait = TUNE.life + 0.1; return; }
    }
    if (bot.swept > TAU + 0.75) { if (prof.lift || !closable(S) || preview(S)?.verdict !== 'mixed') penUp(S); else { bot.state = 'hold'; bot.wait = TUNE.life + 0.1; return; } done(); }
    return;
  }

  if (bot.state === 'hold') {
    bot.wait -= dt;
    if (!closable(S) || bot.wait <= 0) { penUp(S); bot.state = 'idle'; bot.plan = null; bot.wait = prof.think[0]; }
  }
}
