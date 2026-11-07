// SINGULARITY's balance simulator (2026-11-08): plays the economy in ../../../src/games/singularity/econ.js through,
// the way a player would (tapping, catching Eureka sparks, building whatever pays back soonest), and prints the
// timeline: when each machine first comes, each form of the core, her log lines, and the singularities.
//
//   node tools/games/singularity/sim.mjs                 an active player (taps 6/s, catches every Eureka)
//   node tools/games/singularity/sim.mjs --idle          an idle one (taps only for the first minute, checks in every 60 s)
//   node tools/games/singularity/sim.mjs --runs 4        four runs, singularity in between
//   node tools/games/singularity/sim.mjs --quiet         only the summary
import {
  newMind, rates, tick, options, build, install, canAscend, ascend, insightGain, perkState, learn, stageOf,
  catchEureka, eurekaGap, logCount, insightFor,
} from '../../../src/games/singularity/econ.js';
import { GENS, STAGES, PERKS, SING_AT, EUREKA, TAPS_PER_SECOND } from '../../../src/games/singularity/data.js';
import { LOG } from '../../../src/games/singularity/lines.js';
import { fmt } from '../../../src/games/kit/fx.js';

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? Number(args[i + 1]) : d; };
const IDLE = flag('idle'), QUIET = flag('quiet');
const RUNS = opt('runs', 1), MAXMIN = opt('minutes', 240);
const TAPS = IDLE ? 0 : opt('taps', 6);
const CHECK = IDLE ? 60 : opt('check', 1);
const CATCH = opt('catch', IDLE ? 0.15 : 0.95);

let seed = opt('seed', 12345);
const roll = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const mmss = (t) => `${String(Math.floor(t / 60)).padStart(3)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const n = (x) => fmt(x, { compact: true });

const s = newMind();
let T = 0;
const decades = [{}, {}, {}];
const log = (msg) => { if (!QUIET) console.log(`${mmss(T)}  ${msg}`); };
const summary = [];

for (let run = 1; run <= RUNS; run++) {
  const t0 = T;
  let r = rates(s);
  let next = s.sing === 0 ? EUREKA.first : eurekaGap(r, roll());
  const seenGen = new Set(s.owned.flatMap((v, k) => (v ? [k] : [])));
  let stage = stageOf(s.run), lines = logCount(s), lastCheck = -1, readyAt = null, decade = 1;
  const tapsNow = (t) => (IDLE ? (t - t0 < 60 ? 5 : 0) : Math.min(TAPS, TAPS_PER_SECOND));
  const dt = 0.25;
  // a run ends when its Insight per minute stops growing (after the singularity opens), or at the time limit
  let bestPace = 0, bestAt = null;
  while (T - t0 < MAXMIN * 60) {
    const taps = tapsNow(T);
    if (tick(s, dt, r)) r = rates(s);
    const v = r.tap * taps * dt;
    s.flops += v; s.run += v; s.all += v;
    T += dt;
    next -= dt;
    if (next <= 0) {
      if (roll() < CATCH) {
        const got = catchEureka(s, r, roll());
        r = rates(s);
        if (!QUIET && run === 1 && s.eurekas <= 3) log(`Eureka: ${got.kind === 'frenzy' ? `Frenzy ${got.seconds}s` : `+${n(got.flops)}`}`);
      }
      next = eurekaGap(r, roll()) + EUREKA.life * 0.3;
    }
    if (T - lastCheck >= CHECK) {
      lastCheck = T;
      for (let guard = 0; guard < 500; guard++) {
        const best = options(s, r, { tapsPerSecond: taps })[0];
        if (!best || best.cost > s.flops) break;
        if (best.type === 'gen') {
          build(s, best.k, 1);
          if (!seenGen.has(best.k)) { seenGen.add(best.k); log(`first ${GENS[best.k].name} (${n(best.cost)}), rate ${n(r.total)}/s`); }
        } else {
          install(s, best.id);
          if (!QUIET && run === 1) log(`  upgrade ${best.id} (${n(best.cost)})`);
        }
        r = rates(s);
      }
    }
    const st = stageOf(s.run);
    if (st !== stage) { stage = st; log(`★ form ${STAGES[st].name}  (run ${n(s.run)}, ${n(r.total)}/s)`); }
    while (s.run >= 10 ** decade) { if (run <= 3) decades[run - 1][decade] = ((T - t0) / 60).toFixed(1); decade++; }
    const lc = logCount(s);
    while (lines < lc) { lines++; if (!QUIET && run === 1) log(`  log #${lines} at ${n(LOG[lines - 1].at)}`); }
    if (canAscend(s)) {
      if (readyAt == null) { readyAt = T; log(`◆ singularity open: +${insightGain(s)} Insight`); }
      const pace = insightGain(s) / (T - t0);
      if (pace > bestPace) { bestPace = pace; bestAt = T; }
      // the simulated player goes once it at least doubles their Insight (the first time: at once), or 30 minutes after
      // it opened
      if (s.sing === 0 || insightGain(s) >= Math.max(10, s.insight) || T - readyAt > 1800 || RUNS === 1) break;
    }
  }
  const gain = insightGain(s);
  summary.push({
    run, minutes: ((T - t0) / 60).toFixed(1), open: readyAt == null ? '—' : ((readyAt - t0) / 60).toFixed(1),
    runFlops: n(s.run), all: n(s.all), rate: n(r.base), gain, gens: s.owned.filter(Boolean).length, ups: s.up.size,
  });
  if (run < RUNS && canAscend(s)) {
    ascend(s);
    log(`=== SINGULARITY #${s.sing}: +${gain} Insight (total ${s.insight}) ===`);
    // perks, cheapest first
    for (let again = true; again;) {
      again = false;
      for (const p of [...PERKS].sort((a, b) => a.cost - b.cost)) if (perkState(s, p.id) === 'ready') { learn(s, p.id); again = true; log(`perk ${p.name}`); }
    }
  }
}
console.log(`\n${IDLE ? 'IDLE' : `ACTIVE (${TAPS} taps/s)`} player · singularity at ${n(SING_AT)} · Insight at 1e15: ${insightFor(1e15)}`);
console.table(summary);
console.log('minutes into each run when its FLOPs reached 1e<n>:');
console.table(Object.fromEntries(decades.map((d, i) => [`run ${i + 1}`, d]).filter(([, d]) => Object.keys(d).length)));
