// AIR GAP's demo (?demo, the arcade's preview) and the title's attract match: AGI-1 against AGI-1, seeded, power-ups
// on. The demo opens mid-match at 3–3 with Tryhard (pink, at the top) against Competitive (mint, below), and its first
// chip, a SPLIT, slides in a little before the preview's recording starts (5.7 s after the page opens), onto the path
// the puck is about to take: three pucks, and goals, inside the recorded six seconds. Pure: no DOM.
import { len } from './dmath.js';
import { createMatch, spawnChip, CHIP_IN } from './match.js';
import { createBrain, project } from './ai.js';
import { W, H, MID } from './physics.js';

export const DEMO_LEVELS = [2, 3];          // [bottom (mint), top (pink: her)]
export const RIG_AT = 4.75;                 // when the demo's SPLIT chip starts sliding in (page seconds)
// the matches each ?seed= opens with: chosen (tools/games/airgap/demo-seeds.mjs) so the SPLIT lands about 6–7 s in and
// goals follow inside the recording; ?demo&seed=7 (the arcade's preview) opens the best of them
export const DEMO_SEEDS = [51, 98, 111, 174, 206, 240, 276, 213, 70, 71];
export const demoSeed = (seed) => DEMO_SEEDS[((seed || 7) >>> 0) % DEMO_SEEDS.length];

export function createDemo(seed, { attract = false } = {}) {
  const levels = attract ? [2, 2] : DEMO_LEVELS;
  const M = createMatch({ seed, to: 7, powerups: true, score: attract ? [0, 0] : [3, 3], serveTo: 1, chipFirst: attract ? 5 : 999 });
  const brains = [createBrain(levels[0], seed * 7 + 3, 0), createBrain(levels[1], seed * 11 + 5, 1)];
  return { M, brains, seed, rig: attract ? null : { at: RIG_AT, done: false } };
}

const ph = { x: 0, y: 0, vx: 0, vy: 0 };
// the demo's chip: once it's time, on the puck's way (somewhere it will be once the chip has slid in)
export function rigTick(D) {
  const { M, rig } = D;
  if (!rig || rig.done || M.t < rig.at || M.phase !== 'play' || M.chip || M.last < 0 || !M.pucks.length) return;
  const p = M.pucks[0];
  for (let tau = CHIP_IN + 0.12; tau < 1.5; tau += 0.04) {
    project(p.x, p.y, p.vx, p.vy, tau, 3, ph);
    if (ph.x < 90 || ph.x > W - 90 || ph.y < 250 || ph.y > H - 250 || Math.abs(ph.y - MID) < 40) continue;
    if (M.mallets.some((m) => len(m.x - ph.x, m.y - ph.y) < 110)) continue;
    // and the way there doesn't run past a mallet first
    let clear = true;
    for (let u = 0.1; u < tau && clear; u += 0.1) {
      const q = project(p.x, p.y, p.vx, p.vy, u, 3, { x: 0, y: 0, vx: 0, vy: 0 });
      if (M.mallets.some((m) => len(m.x - q.x, m.y - q.y) < 95)) clear = false;
    }
    if (!clear) continue;
    spawnChip(M, 'split', { x: ph.x, y: ph.y });
    M.chipT = 12;
    rig.done = true;
    return;
  }
  if (M.t > rig.at + 2.2) {
    // no clean path: drop it in the middle of her half's way anyway
    spawnChip(M, 'split', { x: W / 2, y: MID + (p.y < MID ? -150 : 150) });
    rig.done = true;
  }
}
