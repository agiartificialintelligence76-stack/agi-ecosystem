// TRENCHING SIMULATOR's checked runs (2026-10-22, the leaderboards; the owner's pick: "Checked runs only"): a run made
// again from its seed, its SOL price and its orders (each at the market step it was placed) with the game's own run
// (./run.js) and market (./engine.js), so a leaderboard ranks what really happened, never what a page says. Only the daily
// market and the challenges rank: simulated, in SOL, at speed 1 (never free play or Live mode). The order log travels
// packed, one short string an order. Pure (no clock, no network): read in Node by tests/trench-game.test.js and by our
// server (server/scores.js, which loads it only for a ticket or a score).
//
// (The same numbers on any computer: V8, Chrome's and Edge's engine and our server's, makes them bit for bit. Another
// browser's math can differ in its last digit, and a run from it may then not check: it isn't ranked, nothing worse.)
import { createRun } from './run.js';
import { STEPS_PER_S } from './engine.js';
import { challengeById, dailyChallenge, dailySeed, isDailyKey } from './challenges.js';
import { SLIPPAGES, PRIORITIES } from './save.js';

export const LOG_MAX = 1000;
const NUM = /^(?:0|[1-9]\d*)(?:\.\d+)?(?:e-\d{1,3})?$/;
const B36 = /^[0-9a-z]{1,9}$/;

// an order as it travels: "<step>,<coin>,<b|s>,<a buy's SOL or a sell's share>,<slippage>,<priority 0 to 2>" (its step
// and its coin in base 36; numbers as JavaScript writes them, which read back exactly)
export function packLog(log) {
  return (Array.isArray(log) ? log : []).map((e) => `${e.n.toString(36)},${e.coin.toString(36)},${e.side === 'buy' ? 'b' : 's'},`
    + `${e.side === 'buy' ? e.sol : e.frac},${e.slippage},${PRIORITIES.indexOf(e.priority)}`);
}

// the orders back, checked: in order of their steps, known slippages and priorities, a sell's share at most all of it.
// → [{ n, coin, side, sol | frac, slippage, priority }], or null when anything in it is wrong
export function unpackLog(list) {
  if (!Array.isArray(list) || list.length > LOG_MAX) return null;
  const out = [];
  let last = -1;
  for (const s of list) {
    if (typeof s !== 'string' || s.length > 80) return null;
    const p = s.split(',');
    if (p.length !== 6 || !B36.test(p[0]) || !B36.test(p[1]) || (p[2] !== 'b' && p[2] !== 's') || !NUM.test(p[3]) || !NUM.test(p[4])
      || !/^[0-2]$/.test(p[5])) return null;
    const n = parseInt(p[0], 36);
    const coin = parseInt(p[1], 36);
    const amount = Number(p[3]);
    const slippage = Number(p[4]);
    if (!Number.isSafeInteger(n) || n < last || !Number.isSafeInteger(coin) || !(amount > 0) || !SLIPPAGES.includes(slippage)) return null;
    if (p[2] === 's' && amount > 1) return null;
    last = n;
    const priority = PRIORITIES[Number(p[5])];
    out.push(p[2] === 'b' ? { n, coin, side: 'buy', sol: amount, slippage, priority } : { n, coin, side: 'sell', frac: amount, slippage, priority });
  }
  return out;
}

// a checked run's challenge: the daily market's of its UTC day, or a challenge by its id (null: neither)
export function rankedChallenge({ kind, challenge = null, day = null }) {
  if (kind === 'daily') return isDailyKey(day) ? dailyChallenge(day) : null;
  if (kind === 'challenge') return challengeById(challenge);
  return null;
}
// its seed: the daily market's (the same for everyone that day), or the one our server's ticket gave it
export const rankedSeed = ({ kind, day, seed }) => (kind === 'daily' ? dailySeed(day) : seed);

// The run made again, its orders each placed at its step, and played to its end (the run ends by itself: a goal reached,
// its time up, a rug, or nothing left to trade with). → { ok: true, result } (run.result()'s numbers) or
// { ok: false, why: 'bad' (its setup) | 'order' (an order out of its place, or one the market refuses) }
export function replayRun({ kind, challenge = null, day = null, seed, solUsd, log }) {
  const ch = rankedChallenge({ kind, challenge, day });
  const orders = Array.isArray(log) ? log : null;
  const s = rankedSeed({ kind, day, seed });
  if (!ch || !orders || orders.length > LOG_MAX || typeof s !== 'string' || !s || !(solUsd > 0)) return { ok: false, why: 'bad' };
  const run = createRun({ seed: s, solUsd, mode: kind === 'daily' ? 'daily' : 'challenge', challenge: ch, currency: 'sol' });
  const m = run.market;
  const dt = 1 / STEPS_PER_S;
  const end = m.n0 + ch.seconds * STEPS_PER_S;
  for (const o of orders) {
    if (!o || !Number.isInteger(o.n) || o.n < m.n || o.n > end) return { ok: false, why: 'order' };
    while (!run.over && m.n < o.n) run.tick(dt);
    if (run.over) return { ok: false, why: 'order' };
    const r = run.order({ coin: o.coin, side: o.side, sol: o.side === 'buy' ? o.sol : undefined,
      frac: o.side === 'sell' ? o.frac : undefined, slippage: o.slippage, priority: o.priority });
    if (!r.ok) return { ok: false, why: 'order' };
  }
  while (!run.over && m.n < end) run.tick(dt);
  return { ok: true, result: run.result() };
}

// what the page said happened is what happened: its outcome, its time (a step's) and its worth
export function sameResult(claim, result) {
  if (!claim || !result) return false;
  if (claim.outcome !== result.outcome) return false;
  if (!(Math.abs(claim.timeUsed - result.timeUsed) <= 1e-6)) return false;
  return Math.abs(claim.worth - result.worth) <= 1e-9 * Math.max(1, Math.abs(result.worth));
}
