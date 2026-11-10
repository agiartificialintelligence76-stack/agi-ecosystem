// ACCEPT ALL COOKIES: helpers for designing levels with the game's own physics (used from small scripts while the
// levels were made; kept so they can be made again).
//
//   import { path, sweep, near, describe } from './design.mjs';
//   path(level, actions)            → the cookie's path [[tick, x, y, wrapped, ropes]…] and the events, cat and pixels away
//   sweep(level, before, make, a, b) → for each tick t in a…b: the path with `before` plus make(t) (an action or a list)
//   near(path, x, y)                → { d, tick } the path's closest pass to (x, y)
//   describe(level, actions)         → one line: the result, the pixels, the events
import { World, HZ } from '../../../src/games/cookies/physics.js';

export function path(L, actions = [], { keep = false, maxTicks = HZ * 14 } = {}) {
  const lvl = keep ? L : { ...L, cat: [-9999, -9999], pixels: [] };
  const w = new World(lvl);
  const list = actions.slice().sort((a, b) => a[0] - b[0]);
  let i = 0;
  const out = [], events = [];
  while (w.status === 'play' && w.tick < maxTicks) {
    while (i < list.length && list[i][0] <= w.tick) w.apply(list[i++].slice(1));
    w.step();
    out.push([w.tick, w.c.x, w.c.y, w.c.wrap >= 0 ? 1 : 0, w.tied]);
    for (const e of w.drain()) events.push({ t: w.tick, ...e });
  }
  return { path: out, events, status: w.status, why: w.why, world: w };
}

export function near(p, x, y, from = 0) {
  let best = { d: Infinity, tick: -1, x: 0, y: 0 };
  for (const q of p) {
    if (q[0] < from) continue;
    const d = Math.hypot(q[1] - x, q[2] - y);
    if (d < best.d) best = { d, tick: q[0], x: q[1], y: q[2] };
  }
  return best;
}

export function at(p, tick) { return p.find((q) => q[0] === tick) || null; }

export function sweep(L, before, make, a, b, step = 1) {
  const out = [];
  for (let t = a; t <= b; t += step) {
    const extra = make(t);
    const acts = before.concat(Array.isArray(extra[0]) ? extra : [extra]);
    out.push({ t, ...path(L, acts) });
  }
  return out;
}

export function describe(L, actions = L.sol) {
  const r = path(L, actions, { keep: true, maxTicks: HZ * 30 });
  const ev = r.events.filter((e) => e.type !== 'bounce' || e.pad).map((e) => `${e.t}:${e.type}${e.i ?? ''}${e.rope != null ? `r${e.rope}` : ''}`).join(' ');
  return `${r.status} ${r.why} px ${r.world.got} t ${r.world.tick} | ${ev}`;
}

// the path's samples every `every` ticks, rounded, for reading
export const brief = (p, every = 10) => p.filter((q) => q[0] % every === 0).map((q) => `${q[0]}:${Math.round(q[1])},${Math.round(q[2])}${q[3] ? 'w' : ''}`).join(' ');

// A greedy solver for a chain of moves. steps: [{ act: ['cut', 0], goal: 'hook:1' | 'win' | 'wrap:0' | 'tab:0' |
// (events, world) => bool, from, to }]: for each step in turn, every tick from…to (counted from the start) is tried
// with the moves found so far, and the middle of the widest run of ticks that reach its goal is kept (the most
// forgiving). → { sol, windows: [[a, b]…] } or { fail: step }.
export function chain(L, steps, { maxTicks = HZ * 14 } = {}) {
  const sol = [], windows = [];
  for (let k = 0; k < steps.length; k++) {
    const s = steps[k];
    const hit = (t) => {
      const r = path(L, sol.concat([[t, ...s.act]]), { maxTicks, keep: s.goal === 'win' });
      const ev = r.events.filter((e) => e.t > t);
      if (typeof s.goal === 'function') return s.goal(ev, r);
      if (s.goal === 'win') return r.status === 'won';
      const [type, i] = s.goal.split(':');
      return ev.some((e) => e.type === type && (i == null || e.i === Number(i)));
    };
    let best = null, run = null;
    for (let t = s.from; t <= s.to; t++) {
      if (hit(t)) { run = run ? [run[0], t] : [t, t]; if (!best || run[1] - run[0] > best[1] - best[0]) best = run.slice(); } else run = null;
    }
    if (!best) return { fail: k, sol, windows };
    const t = Math.round((best[0] + best[1]) / 2);
    sol.push([t, ...s.act]);
    windows.push(best);
  }
  return { sol, windows };
}
