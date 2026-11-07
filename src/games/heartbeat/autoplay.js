// HEARTBEAT (2026-11-08): the demo's player (pure, seeded: the same seed plays the same run). It presses each note a
// hair off its time, the way a good player does: nearly always PERFECT, now and then a GREAT, and it holds holds to
// their end.
import { rng } from '../kit/fx.js';

export function createAutoplay(notes, { seed = 1, greatRate = 0.035 } = {}) {
  const r = rng(seed || 1);
  const actions = [];
  for (const n of notes) {
    const great = r.chance(greatRate);
    const err = great ? r.sign() * r.range(0.05, 0.08) : r.range(-0.022, 0.022);
    actions.push({ t: n.t + err, lane: n.lane, down: true });
    actions.push({ t: (n.hold > 0 ? n.t + n.hold + 0.02 : n.t + err + 0.07), lane: n.lane, down: false });
  }
  actions.sort((a, b) => a.t - b.t || (a.down === b.down ? 0 : a.down ? 1 : -1));
  let i = 0;
  return {
    // everything due by song time t, in order → run.press / run.release
    step(run, t) {
      while (i < actions.length && actions[i].t <= t) {
        const a = actions[i++];
        if (a.down) run.press(a.lane, a.t); else run.release(a.lane, a.t);
      }
    },
    skipTo(t) { while (i < actions.length && actions[i].t < t) i++; },
    get pending() { return actions.length - i; },
  };
}
