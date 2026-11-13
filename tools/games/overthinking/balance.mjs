// OVERTHINKING: how hard is each night? Plays every night of the week (and Insomnia) with the game's own players (a
// beginner, a regular, someone who never lifts the pen: src/games/overthinking/ai.js) over many seeds, and prints how
// often each sees the sunrise, how late they get and what they score. Run it after changing the rules, a night or a
// player:   node tools/games/overthinking/balance.mjs [seeds=24] [night …]
import { createSim, step, drain, count, STEP } from '../../../src/games/overthinking/sim.js';
import { makeConfig, NIGHTS, clockLabel, HOUR } from '../../../src/games/overthinking/nights.js';
import { createBot, drive } from '../../../src/games/overthinking/ai.js';

const args = process.argv.slice(2);
const seeds = Number(args[0]) || 24;
const only = args.slice(1).map(Number).filter(Boolean);
const ASPECTS = [0.62, 1.9];

export function play(cfg, profile, seed, aspect, maxSeconds = 1800) {
  const S = createSim(cfg, seed, aspect);
  const bot = createBot(profile, seed);
  let peak = 0, fullT = 0;
  for (let i = 0; i < maxSeconds / STEP && !S.over; i++) {
    drive(bot, S, STEP);
    step(S, STEP);
    drain(S);
    peak = Math.max(peak, count(S));
  }
  return { S, peak, won: Boolean(S.over?.won), clock: S.clock, score: S.score };
}
const pct = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const mean = (arr) => arr.reduce((a, b) => a + b, 0) / Math.max(1, arr.length);

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const n of NIGHTS) {
    if (only.length && !only.includes(n.id)) continue;
    console.log(`\n${n.day} — ${n.title}   (stars at ${n.stars.join(', ')})`);
    for (const profile of ['newbie', 'casual', 'steady', 'expert']) {
      const runs = [];
      for (let s = 1; s <= seeds; s++) runs.push(play(makeConfig({ mode: 'night', night: n.id }), profile, s * 7919 + n.id, ASPECTS[s % 2]));
      const wins = runs.filter((r) => r.won);
      const st = runs.map((r) => r.S.stats);
      console.log(`  ${profile.padEnd(7)} sunrise ${String(Math.round((wins.length / runs.length) * 100)).padStart(3)}%  `
        + `score p25 ${String(pct(runs.map((r) => r.score), 0.25)).padStart(6)} p50 ${String(pct(runs.map((r) => r.score), 0.5)).padStart(6)} p90 ${String(pct(runs.map((r) => r.score), 0.9)).padStart(6)}  `
        + `gets to ${clockLabel(mean(runs.map((r) => r.clock)), { step: 1 }).padStart(8)}  peak ${mean(runs.map((r) => r.peak)).toFixed(0)}  `
        + `loops ${mean(st.map((x) => x.loops)).toFixed(0)} biggest ${mean(st.map((x) => x.biggest)).toFixed(1)} mixed ${mean(st.map((x) => x.mixed)).toFixed(1)} cuts ${mean(st.map((x) => x.cuts)).toFixed(1)}`);
    }
  }
  if (!only.length) {
    console.log('\nInsomnia');
    for (const profile of ['casual', 'steady', 'expert']) {
      const runs = [];
      for (let s = 1; s <= Math.min(seeds, 16); s++) runs.push(play(makeConfig({ mode: 'insomnia' }), profile, s * 104729, ASPECTS[s % 2], 3600));
      console.log(`  ${profile.padEnd(7)} awake ${(mean(runs.map((r) => r.clock)) / HOUR).toFixed(1)} h (p90 ${(pct(runs.map((r) => r.clock), 0.9) / HOUR).toFixed(1)} h)  `
        + `score p50 ${pct(runs.map((r) => r.score), 0.5)} p90 ${pct(runs.map((r) => r.score), 0.9)}`);
    }
  }
}
