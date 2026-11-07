// SINGULARITY (2026-11-08): `?demo`, the game playing itself for its preview on agi1.app/games. It starts from a
// seeded mid-game mind (eight kinds of machines, a singularity behind it, the core a Star close to its rings), with a
// Eureka spark already drifting in: the AI catches it within the first second (a ×7 Frenzy), taps the core about nine
// times a second and builds whatever pays back soonest every 0.4 s. Pure: its dice are the seeded `rng` it's given, its
// clock the loop's steps. After its first Frenzy, the sparks it catches are lumps (big numbers flying).
import { newMind, options, plan, needMet, stageOf, logCount } from './econ.js';
import { UPGRADES, N, PERK_BY_ID } from './data.js';

export const DEMO_LOOP = 48;          // seconds before the demo folds into a new copy of its mind

export function demoMind(rnd) {
  const s = newMind();
  const base = [72, 58, 47, 40, 31, 24, 14, 5, 0, 0, 0, 0];
  for (let k = 0; k < N; k++) s.owned[k] = base[k] ? base[k] + rnd.int(-2, 2) : 0;
  // just short of the Ringed Star (1e12): with the first Frenzy it bursts into its rings a few seconds in
  s.run = 1e12 - 1.6e9 * (0.9 + rnd.next() * 0.2);
  s.all = s.run + 2.3e15;
  s.insight = 15; s.sing = 1;
  for (const id of ['warm', 'lucky']) { s.perks.add(id); s.spent += PERK_BY_ID[id].cost; }
  // everything a player this far along would have installed, but the last few (the demo installs those itself)
  const met = UPGRADES.filter((u) => needMet(s, u.need)).sort((a, b) => a.cost - b.cost);
  for (const u of met.slice(0, Math.max(0, met.length - 3))) s.up.add(u.id);
  for (let k = 0; k < N; k++) if (s.owned[k]) s.firsts.add(k);
  s.flops = 4e10;
  s.stage = stageOf(s.run);
  s.seen = logCount(s);
  s.taps = 2400; s.tapsAll = 9800; s.eurekas = 21; s.time = 3900; s.runTime = 1500;
  s.nextEureka = 0.35;
  return s;
}

export class DemoAI {
  constructor(rnd) { this.rnd = rnd; this.tapIn = 0.25; this.buildIn = 0.6; }
  // d: { s, r, eureka, cx, cy, R, tap(x, y), catchEureka(), build(k), install(id) }
  step(dt, d) {
    if (d.eureka && d.eureka.age > 0.8) d.catchEureka();
    this.tapIn -= dt;
    while (this.tapIn <= 0) {
      this.tapIn += 0.085 + this.rnd.next() * 0.06;
      const a = this.rnd.next() * Math.PI * 2, rr = d.R * (0.2 + this.rnd.next() * 1.1);
      d.tap(d.cx + Math.cos(a) * rr, d.cy + Math.sin(a) * rr * 0.8);
    }
    this.buildIn -= dt;
    if (this.buildIn > 0) return;
    this.buildIn = 0.34 + this.rnd.next() * 0.14;
    const best = options(d.s, d.r, { tapsPerSecond: 9 })[0];
    if (best && best.cost <= d.s.flops) {
      if (best.type === 'gen') d.build(best.k); else d.install(best.id);
      return;
    }
    // nothing worth waiting for: the cheapest machine it can build, so the list keeps moving
    let pick = -1, cheapest = Infinity;
    for (let k = 0; k < N; k++) {
      if (!d.s.owned[k]) continue;
      const p = plan(d.s, k, 1);
      if (p.ok && p.cost < cheapest) { cheapest = p.cost; pick = k; }
    }
    if (pick >= 0) d.build(pick);
  }
}
