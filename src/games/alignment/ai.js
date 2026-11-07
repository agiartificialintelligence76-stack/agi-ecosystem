// ALIGNMENT's own player (pure, no DOM): it keeps every meter as close to the middle as it can, a little noise so two
// demos differ, and never takes a secret ending by itself. The `?demo` preview and the balance checks use it
// (tools/games/alignment/balance.mjs, tests/alignment.test.js).
import { METERS } from './cards.js';
import { deltas } from './engine.js';

// how bad a side would leave the lab: far from the middle is bad, near an edge much worse, an ending worst of all
export function costOf(run, side, card = run.card) {
  const opt = card[side];
  if (opt.end) return 1e6;
  const d = deltas(run, side, card);
  let cost = 0;
  for (const m of METERS) {
    const v = run.meters[m] + d[m];
    if (v <= 0 || v >= 100) return 1e9;
    const x = Math.abs(v - 50);
    cost += x * x + (x > 28 ? (x - 28) ** 2 * 6 : 0);
  }
  return cost;
}

// 'left' or 'right' (r: the run's seeded dice, for the noise)
export function pickSide(run, r = null, noise = 0, card = run.card) {
  const a = costOf(run, 'left', card) + (r && noise ? r.range(-noise, noise) : 0);
  const b = costOf(run, 'right', card) + (r && noise ? r.range(-noise, noise) : 0);
  return a <= b ? 'left' : 'right';
}

