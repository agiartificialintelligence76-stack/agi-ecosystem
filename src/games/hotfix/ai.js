// HOTFIX: a player made of code, for the demo (the previews on agi1.app/games), the title's attract board, the tests and
// the balance tool (tools/games/hotfix/balance.mjs). It tries many drags (a random walk from a random chip, never straight
// back, diagonals allowed), plays each on a copy of the board and scores the lines it would make: more groups and
// bigger ones are better, a kind the target is weak to counts double, one it resists half, Debug matters when her uptime
// is low. Its skill is how many drags it tries and how long they are.
import { applyPath, findGroups, adjacent, xy, alive, KINDS, DEBUG, W, H, CELLS } from './rules.js';
import { rng } from '../kit/fx.js';

export const PROFILES = Object.freeze({
  newbie: { tries: 30, len: 5 },
  steady: { tries: 220, len: 10 },
  expert: { tries: 700, len: 16 },
});
export const createBot = (profile = 'steady', seed = 1) => ({ p: PROFILES[profile] || PROFILES.steady, rnd: rng(seed ^ 0x40f1) });

function neighbours(i) {
  const p = xy(i), out = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const x = p.x + dx, y = p.y + dy;
    if (x >= 0 && y >= 0 && x < W && y < H) out.push(y * W + x);
  }
  return out;
}
const NB = Array.from({ length: CELLS }, (_, i) => neighbours(i));

function value(run, cells) {
  const groups = findGroups(cells);
  if (!groups.length) return 0;
  const target = alive(run)[0] && (alive(run).includes(run.bugs[run.target]) ? run.bugs[run.target] : alive(run)[0]);
  const hurt = 1 - run.uptime / run.max;
  let v = 0;
  for (const g of groups) {
    const size = 1 + 0.25 * (g.cells.length - 3);
    if (g.t === DEBUG) { v += size * (0.3 + hurt * 2.2); continue; }
    const kind = KINDS[g.t].id;
    v += size * (target ? (target.def.weak === kind ? 2 : target.def.resist === kind ? 0.5 : 1) : 1);
  }
  return v * (1 + 0.35 * (groups.length - 1));
}

// the best drag it finds → a path of cell indexes
export function plan(bot, run) {
  const { tries, len } = bot.p, r = bot.rnd;
  let best = null, bestV = -1;
  for (let k = 0; k < tries; k++) {
    let at = r.int(0, CELLS - 1);
    if (run.cells[at].lock) continue;
    const path = [at];
    const n = r.int(2, len);
    for (let s = 0; s < n; s++) {
      const opts = NB[at].filter((j) => j !== path[path.length - 2] && !run.cells[j].lock);
      if (!opts.length) break;
      at = r.pick(opts);
      path.push(at);
    }
    const copy = run.cells.slice();
    applyPath(copy, path);
    // the best point along the way (a drag can stop anywhere)
    const v = value(run, copy) - path.length * 0.002;
    if (v > bestV) { bestV = v; best = path; }
  }
  return best && best.length > 1 ? best : [0, 1];
}

// a whole run played by a bot → { floor, score, turns, … }
export async function playRun({ mode = 'run', seed = 1, profile = 'steady', maxTurns = 600 } = {}) {
  const { createRun, turn, choose, PATCHES } = await import('./rules.js');
  const run = createRun({ mode, seed });
  const bot = createBot(profile, seed);
  while (!run.over && run.turns < maxTurns) {
    if (run.offer) { choose(run, pickPatch(run)); continue; }
    turn(run, plan(bot, run));
  }
  void PATCHES;
  return { floor: run.floor, score: run.score, turns: run.turns, cause: run.cause, bestCombo: run.bestCombo, damage: Math.round(run.damage) };
}
// which patch a bot takes: heals when hurt, else damage
export function pickPatch(run) {
  const o = run.offer;
  if (run.uptime < run.max * 0.45 && o.includes('heal')) return 'heal';
  for (const id of ['combo', 'overclock', 'big', 'logic', 'memory', 'vision', 'voice', 'duck', 'linter', 'debug', 'gc', 'heal']) if (o.includes(id)) return id;
  return o[0];
}
