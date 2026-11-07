// OVERCLOCK: whole games played by the demo AI, headless. How long balls last, where they drain, what gets hit, how
// often the modes start, whether a ball ever gets stuck, and the scores (to set the extra ball and the end lines).
// node tools/games/overclock/harness.mjs [games=40] [skill=0.92]
import { createSim, stepSim, DT, inPlay } from '../../../src/games/overclock/sim.js';
import { createAI, think } from '../../../src/games/overclock/ai.js';

const games = Number(process.argv[2] || 40), skill = Number(process.argv[3] || 0.92);
const agg = { score: [], time: [], ballTime: [], ev: {}, stuck: 0, drainX: { left: 0, center: 0, right: 0 }, maxBalls: 0 };
const t0 = Date.now();
for (let g = 1; g <= games; g++) {
  const S = createSim({ seed: g });
  const ai = createAI(g, { skill });
  let quiet = 0, last = null, ticks = 0;
  while (!S.over && ticks < 120 * 60 * 30) {
    think(ai, S, DT);
    stepSim(S, DT);
    ticks++;
    for (const e of S.ev) {
      agg.ev[e.type] = (agg.ev[e.type] || 0) + 1;
      if (e.type === 'drain' && !e.saved) agg.drainX[e.x < 120 ? 'left' : e.x > 460 ? 'right' : 'center']++;
      if (['pop', 'sling', 'lane', 'target', 'wall', 'rubber', 'flipHit', 'spin', 'drain', 'socket', 'ramp', 'orbit', 'kick', 'launch', 'inlane'].includes(e.type)) quiet = 0;
    }
    S.ev.length = 0;
    agg.maxBalls = Math.max(agg.maxBalls, inPlay(S));
    if (S.phase === 'play') {
      quiet += DT;
      if (quiet > 12) {
        agg.stuck++;
        const b = S.balls.find((x) => x.live);
        console.log(`  stuck? game ${g} t ${S.t.toFixed(0)}s ball at ${b ? `${b.x.toFixed(0)},${b.y.toFixed(0)} v ${b.vx.toFixed(0)},${b.vy.toFixed(0)}` : S.balls.map((x) => x.mode).join(',')}`);
        for (const x of S.balls) if (x.live) { x.vy -= 600; x.vx += 300; }
        quiet = 0;
      }
    } else quiet = 0;
  }
  agg.score.push(S.R.score);
  agg.time.push(S.t);
}
const avg = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const pct = (a, p) => [...a].sort((x, y) => x - y)[Math.floor((a.length - 1) * p)];
console.log(`${games} games in ${((Date.now() - t0) / 1000).toFixed(1)}s (skill ${skill})`);
console.log(`score avg ${Math.round(avg(agg.score)).toLocaleString()} · p25 ${pct(agg.score, 0.25).toLocaleString()} · p50 ${pct(agg.score, 0.5).toLocaleString()} · p75 ${pct(agg.score, 0.75).toLocaleString()} · max ${Math.max(...agg.score).toLocaleString()}`);
console.log(`game length avg ${avg(agg.time).toFixed(0)}s (p50 ${pct(agg.time, 0.5).toFixed(0)}s) · stuck ${agg.stuck} · most balls at once ${agg.maxBalls}`);
console.log(`drains: ${JSON.stringify(agg.drainX)}`);
const per = (k) => (agg.ev[k] || 0) / games;
console.log('per game:', ['launch', 'pop', 'sling', 'lane', 'ramAll', 'targetDown', 'lockLit', 'lock', 'multiball', 'jackpot', 'rampIn', 'rampFail', 'ramp', 'orbit', 'spin', 'socket', 'overclock', 'missionDone', 'agiStart', 'skill', 'saved', 'extraBall', 'tilt'].map((k) => `${k} ${per(k).toFixed(1)}`).join(' · '));
