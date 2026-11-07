// GUARDRAILS: a builder that plays it well enough to watch: the ?demo preview, the battle behind the title screen, and
// tools/games/guardrails/balance.mjs (which tunes the waves with it). No DOM, no clock: it reads the sim and acts on it,
// so a seeded run repeats exactly. Its placement: the tile whose range covers the most path (weighted toward where the
// gremlins walk past twice), spread out a little; honeypots go where the most guardrails can reach.
import { COLS, ROWS, TOWERS, buildCost, upgradeCost, rebuildCost } from './data.js';
import { TILE } from './sim.js';

// the builds it knows. Each step: a tower to build, or 'up:<type>' (upgrade the weakest of that type), then it loops
export const PLANS = {
  balanced: {
    steps: ['filter', 'filter', 'classifier', 'redteam', 'filter', 'honeypot', 'up:filter', 'limiter', 'up:redteam', 'redteam',
      'up:filter', 'up:classifier', 'sysprompt', 'up:filter', 'up:redteam', 'filter', 'up:honeypot', 'up:limiter', 'up:sysprompt',
      'redteam', 'up:filter', 'up:redteam', 'classifier', 'limiter', 'sysprompt'],
    loop: ['up:filter', 'up:redteam', 'up:sysprompt', 'up:limiter', 'up:classifier', 'up:honeypot', 'filter', 'redteam', 'sysprompt', 'limiter', 'up:filter', 'up:redteam', 'up:sysprompt'],
    specs: { filter: [0, 1], classifier: [0, 1], redteam: [0, 1], limiter: [1, 0], honeypot: [0, 1], sysprompt: [1, 0] },
  },
  // a weak build for the balance tool: filters only (it should fall early)
  filters: {
    steps: ['filter', 'filter', 'filter', 'filter', 'up:filter'],
    loop: ['filter', 'up:filter'],
    specs: { filter: [0, 1] },
  },
};

export function createAI(sim, { plan = 'balanced', every = 0.4, sendEarly = 0, maxTowers = 40 } = {}) {
  const P = PLANS[plan];
  const M = sim.map;
  // samples along every path, a quarter tile apart (the shared stretch counted once per path: more gremlins pass there)
  const samples = [];
  for (const path of M.paths) {
    for (let d = 0.5; d < path.leak; d += 0.25) {
      const s = pointAt(path, d);
      if (s.x < 0 || s.y < 0 || s.x > COLS || s.y > ROWS) continue;
      samples.push({ x: s.x, y: s.y, early: 1 - d / path.leak });
    }
  }
  const covCache = new Map();
  function coverage(x, y, range, earlyW = 0) {
    const key = `${x},${y},${range},${earlyW}`;
    if (covCache.has(key)) return covCache.get(key);
    const cx = x + 0.5, cy = y + 0.5, R2 = range * range;
    let n = 0;
    for (const s of samples) {
      const dx = s.x - cx, dy = s.y - cy;
      if (dx * dx + dy * dy <= R2) n += 1 + s.early * earlyW;
    }
    covCache.set(key, n);
    return n;
  }
  let step = 0, loopI = 0, clock = 0, specN = {};

  function bestTile(type) {
    const T = TOWERS[type];
    let best = null, score = -Infinity;
    if (T.on === 'path') {
      // a honeypot: the path tile in reach of the most firepower, not too near the entrance or the core
      for (const [ti, ds] of M.pathD) {
        const x = ti % COLS, y = (ti / COLS) | 0;
        if (sim.towerAt(x, y)) continue;
        const d = Math.max(...ds);
        const path = M.paths[ds.indexOf(d)];
        if (d < 3 || d > path.leak - 3) continue;
        let sc = 0;
        for (const t of sim.towers) {
          if (t.type === 'honeypot' || t.type === 'classifier') continue;
          const rr = t.stats.range || 0;
          if ((t.x - x - 0.5) ** 2 + (t.y - y - 0.5) ** 2 <= rr * rr) sc += t.tier * (t.type === 'redteam' ? 1.6 : 1);
        }
        // shared stretches stop both entrances' gremlins
        sc += ds.filter((v) => v >= 0).length * 0.8 - d * 0.01;
        if (sc > score) { score = sc; best = { x, y }; }
      }
      return best;
    }
    const range = T.levels[1].range;
    const earlyW = type === 'classifier' ? 1.2 : type === 'limiter' ? 0.4 : 0;
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      if (sim.tileAt(x, y) !== TILE.BUILD || sim.towerAt(x, y)) continue;
      let sc = coverage(x, y, range, earlyW);
      // spread: the same kind right next door is worth a bit less (pulses and slows overlap)
      for (const t of sim.towers) {
        const d2 = (t.tx - x) ** 2 + (t.ty - y) ** 2;
        if (t.type === type && d2 <= 4) sc *= type === 'limiter' || type === 'classifier' ? 0.55 : 0.9;
      }
      // a touch of the seeded dice, so two runs of the same plan on different seeds differ a little
      sc += sim.rng.next() * 0.01;
      if (sc > score) { score = sc; best = { x, y }; }
    }
    return best;
  }

  // what the next step would do and cost (null: nothing to do for it now)
  function actionOf(token) {
    if (token.startsWith('up:')) {
      const type = token.slice(3);
      const list = sim.towers.filter((t) => t.type === type && t.tier < 3 && !t.broken);
      if (!list.length) return null;
      list.sort((a, b) => a.tier - b.tier || b.kills - a.kills);
      const t = list[0];
      let spec = 0;
      if (t.tier === 2) {
        const order = P.specs[type] || [0];
        spec = order[(specN[type] || 0) % order.length];
      }
      return { kind: 'up', t, spec, cost: upgradeCost(type, t.tier, spec) };
    }
    if (sim.towers.length >= maxTowers) return null;
    const tile = bestTile(token);
    if (!tile) return null;
    return { kind: 'build', type: token, tile, cost: buildCost(token) };
  }
  function act(a) {
    if (a.kind === 'up') {
      const ok = sim.upgrade(a.t.id, a.spec);
      if (ok && a.t.tier === 3) specN[a.t.type] = (specN[a.t.type] || 0) + 1;
      return ok;
    }
    return Boolean(sim.build(a.type, a.tile.x, a.tile.y));
  }

  // one decision: rebuild a broken honeypot, else the next step of the plan when it can pay for it
  function think() {
    for (const t of sim.towers) {
      if (t.broken && sim.compute >= rebuildCost(t.spent)) { sim.rebuild(t.id); return 'rebuild'; }
    }
    for (let guard = 0; guard < 6; guard++) {
      const token = step < P.steps.length ? P.steps[step] : P.loop[loopI % P.loop.length];
      const a = actionOf(token);
      const next = () => { if (step < P.steps.length) step++; else loopI++; };
      if (!a) { next(); continue; }            // nothing of that kind to upgrade (or no room): skip it
      if (sim.compute < a.cost) return null;   // save up for it
      next();
      return act(a) ? a : null;
    }
    return null;
  }
  return {
    get step() { return step; },
    think,
    // its own clock: a decision every `every` seconds; sends the next wave early when the field is quiet
    // hold: only send waves (the demo makes its own moves for a while, where the camera can see them)
    hold: false,
    plan: (token) => actionOf(token),
    act: (a) => act(a),
    update(dt) {
      clock += dt;
      if (clock < every) return null;
      clock = 0;
      if (sendEarly && sim.canSend() && sim.started) {
        const alive = sim.creatures.length;
        if (alive <= sendEarly) sim.sendWave();
      }
      return this.hold ? null : think();
    },
    // build up front (the demo's defense): as many steps as it can pay for, at once
    prebuild(limit = 99) {
      let n = 0;
      while (n < limit && think()) n++;
      return n;
    },
    coverage,
  };
}

// (a local copy of the sim's path lookup, so this file needs nothing else from it at load)
function pointAt(path, d) {
  for (const s of path.segs) {
    if (d <= s.d0 + s.len) { const k = Math.max(0, d - s.d0); return { x: s.ax + s.dx * k, y: s.ay + s.dy * k }; }
  }
  const s = path.segs[path.segs.length - 1];
  return { x: s.bx, y: s.by };
}
