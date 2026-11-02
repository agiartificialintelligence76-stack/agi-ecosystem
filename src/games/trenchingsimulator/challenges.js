// TRENCHING SIMULATOR's challenges (2026-10-20): what a run asks of the player, how far along they are, the stars they
// get, the daily market, and the words for a goal in the terminal's own money. The owner's two ("make 10x your money in
// 30 mins", "make 500$ in 10 mins") and seven more. Pure: read in Node too (tests/trench-game.test.js).
//
// A goal is one of five kinds:
//   worth       net worth reaches start × x (open coins at what selling them now would bring): won the moment it does
//   profitUsd   net worth reaches start + `usd` dollars (at the run's frozen SOL price)
//   takeProfit  one coin sold for x times what was put into it (sold, not just on paper)
//   migration   a coin held while it migrates, then sold after it, in profit
//   survive     trade `coins` different coins and finish above the start when time is up; a rug on a coin held ends it
import { hash32 } from './rng.js';
import { money, usd as fmtUsd, clock, grouped, unitOf, isCoinCurrency, nice } from './format.js';

export const TIERS = Object.freeze(['easy', 'medium', 'hard', 'legendary']);

const C = (o) => Object.freeze({ ...o, start: Object.freeze(o.start), goal: Object.freeze(o.goal) });

export const CHALLENGES = Object.freeze([
  C({ id: 'first-blood', name: 'First blood', tier: 'easy', start: { sol: 1 }, seconds: 300,
    goal: { kind: 'worth', x: 1.05 }, blurb: 'Any profit at all. Five minutes to find one.' }),
  C({ id: 'double-up', name: 'Double up', tier: 'medium', start: { sol: 1 }, seconds: 600,
    goal: { kind: 'worth', x: 2 }, blurb: 'Double your money in ten minutes.' }),
  C({ id: 'five-hundred', name: 'Make $500', tier: 'medium', start: { usd: 1000 }, seconds: 600,
    goal: { kind: 'profitUsd', usd: 500 }, blurb: 'Five hundred dollars of profit in ten minutes.' }),
  C({ id: 'speedrun', name: 'Speedrun', tier: 'hard', start: { sol: 1 }, seconds: 180,
    goal: { kind: 'worth', x: 1.5 }, blurb: 'Half again in three minutes. No time to think.' }),
  C({ id: 'rug-dodger', name: 'Rug dodger', tier: 'medium', start: { sol: 2 }, seconds: 600,
    goal: { kind: 'survive', coins: 5 }, blurb: 'Trade five different coins and end up. Get caught in a rug and it’s over.' }),
  C({ id: 'runner', name: 'Catch a runner', tier: 'hard', start: { sol: 2 }, seconds: 1200,
    goal: { kind: 'takeProfit', x: 3 }, blurb: 'Sell one coin for three times what you put in.' }),
  C({ id: 'migration', name: 'Ride the migration', tier: 'hard', start: { sol: 2 }, seconds: 1200,
    goal: { kind: 'migration' }, blurb: 'Hold a coin while it migrates, then sell it in profit.' }),
  C({ id: 'whale', name: 'Whale mode', tier: 'hard', start: { sol: 100 }, seconds: 900,
    goal: { kind: 'worth', x: 1.5 }, blurb: 'A big bag moves the chart. Make it half again anyway.' }),
  C({ id: 'ten-bagger', name: '10x in 30', tier: 'legendary', start: { sol: 1 }, seconds: 1800,
    goal: { kind: 'worth', x: 10 }, blurb: 'Ten times your money in thirty minutes. Legends only.' }),
]);

const BY_ID = new Map(CHALLENGES.map((c) => [c.id, c]));
export const challengeById = (id) => BY_ID.get(id) || null;

// Free play: no timer, no goal, a start to pick
export const FREE_STARTS = Object.freeze([1, 5, 10, 50]);
export const SPEEDS = Object.freeze([1, 2, 4]);

// what a challenge starts with, in SOL (a dollar start at the run's SOL price). In a chain's own coin (`currency`: Live
// mode's ETH or BNB, since 2026-10-21), a SOL start becomes a round amount of that coin (1 SOL at $150 and ETH at $3,000:
// 0.05 ETH), and the run starts with what that is in SOL.
export function startSolFor(ch, solUsd, currency = 'sol', { exactStart = false } = {}) {
  const s = ch && ch.start;
  // A shared race must give everyone the same underlying funds. Its currency only formats that amount;
  // ordinary solo runs still round to a convenient amount of the selected native coin.
  const startCurrency = exactStart ? 'sol' : currency;
  if (s && Number.isFinite(s.sol) && s.sol > 0) return inCoin(s.sol, startCurrency, solUsd);
  const px = Number.isFinite(solUsd) && solUsd > 0 ? solUsd : 150;
  if (s && Number.isFinite(s.usd) && s.usd > 0) return s.usd / px;
  return inCoin(1, startCurrency, solUsd);
}
// Free play's start (`v`: one of FREE_STARTS, in SOL), the same way
export const freeStartSol = (v, currency = 'sol', solUsd = 150) => inCoin(v, currency, solUsd);
// an amount of SOL as a round amount of a chain's coin, back in SOL (SOL and dollars: as it is)
function inCoin(solAmount, currency, solUsd) {
  if (!isCoinCurrency(currency)) return solAmount;
  const u = unitOf(currency, solUsd);
  return nice(solAmount * u.per) / u.per;
}

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : Number.isFinite(x) ? x : 0);

// How far along a goal is, from a snapshot of the run:
//   { worth, start, solUsd, timeUp, positions: [{ id, invested, sold, total, open }], flags: { migrationWin, rugHit,
//     coinsTraded } }
// → { done, frac (0…1), failed }
export function goalState(goal, snap) {
  const s = snap || {};
  const start = s.start > 0 ? s.start : 1;
  const worth = Number.isFinite(s.worth) ? s.worth : start;
  const f = s.flags || {};
  switch (goal && goal.kind) {
    case 'worth': {
      const target = start * goal.x;
      return { done: worth >= target - 1e-12, frac: clamp01((worth - start) / (target - start)), failed: false };
    }
    case 'profitUsd': {
      const px = s.solUsd > 0 ? s.solUsd : 150;
      const profit = (worth - start) * px;
      return { done: profit >= goal.usd - 1e-9, frac: clamp01(profit / goal.usd), failed: false };
    }
    case 'takeProfit': {
      let best = 0;
      for (const p of s.positions || []) if (p.invested > 0) best = Math.max(best, p.sold / p.invested);
      return { done: best >= goal.x - 1e-12, frac: clamp01(best / goal.x), failed: false };
    }
    case 'migration': {
      if (f.migrationWin) return { done: true, frac: 1, failed: false };
      // along the way: the furthest a held coin is along its curve, and nearly there once one held migrated
      let frac = 0;
      for (const p of s.positions || []) {
        if (!p.open) continue;
        frac = Math.max(frac, p.heldThrough ? 0.9 : 0.85 * clamp01(p.progress || 0));
      }
      return { done: false, frac, failed: false };
    }
    case 'survive': {
      const traded = f.coinsTraded || 0;
      const n = goal.coins || 1;
      if (f.rugHit) return { done: false, frac: clamp01(traded / n), failed: true };
      const ok = traded >= n && worth > start;
      return { done: Boolean(s.timeUp) && ok, frac: clamp01(traded / n), failed: false };
    }
    default:
      return { done: false, frac: 0, failed: false };
  }
}

// Whether a goal is decided only when time is up (survive), or the moment it's reached (the rest)
export const atEnd = (goal) => Boolean(goal) && goal.kind === 'survive';

// Stars for a run won: by the time it took (a third or less: 3, two thirds or less: 2, else 1); survive by how far
// above its start it finished (1.5x: 3, 1.2x: 2, else 1)
export function starsFor(ch, { timeUsed, multiple } = {}) {
  if (!ch) return 0;
  if (atEnd(ch.goal)) return multiple >= 1.5 ? 3 : multiple >= 1.2 ? 2 : 1;
  const f = ch.seconds > 0 ? timeUsed / ch.seconds : 1;
  return f <= 1 / 3 + 1e-9 ? 3 : f <= 2 / 3 + 1e-9 ? 2 : 1;
}

// ---------- the daily market: the same seed and challenge for everyone on a UTC day ----------

const DAILY_POOL = Object.freeze(['double-up', 'five-hundred', 'speedrun', 'rug-dodger', 'runner', 'migration', 'whale']);

// a date's UTC day as YYYY-MM-DD (a Date, or a time in ms)
export function dailyKey(date) {
  const d = date instanceof Date ? date : new Date(Number.isFinite(date) ? date : 0);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const isDailyKey = (k) => typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k);
export const dailySeed = (key) => `daily-${key}`;

// a day's challenge, the same for everyone: one of the pool, by the day's hash
export function dailyChallenge(key) {
  const id = DAILY_POOL[hash32(`daily␟${key}`) % DAILY_POOL.length];
  return { ...BY_ID.get(id), daily: key };
}

// ---------- the words for a goal, in the terminal's own money ----------

const times = (x) => `${x}x`;

// "Turn 1 SOL into 2 SOL", "Make $500 profit (about 3.33 SOL)"…: what to do; and the time it gives
export function goalText(ch, currency, solUsd, options) {
  if (!ch) return '';
  const start = startSolFor(ch, solUsd, currency, options);
  const g = ch.goal;
  switch (g.kind) {
    case 'worth': {
      const target = start * g.x;
      if (g.x <= 1.1) return `Finish above ${money(start, currency, solUsd)}: any profit counts`;
      return `Turn ${money(start, currency, solUsd)} into ${money(target, currency, solUsd)} (${times(g.x)})`;
    }
    case 'profitUsd': {
      const inSol = g.usd / (solUsd > 0 ? solUsd : 150);
      return currency === 'usd' ? `Make ${fmtUsd(g.usd)} profit` : `Make ${fmtUsd(g.usd)} profit (about ${money(inSol, currency, solUsd)})`;
    }
    case 'takeProfit':
      return `Sell one coin for ${times(g.x)} what you put into it`;
    case 'migration':
      return 'Hold a coin while it migrates, then sell it in profit';
    case 'survive':
      return `Trade ${g.coins} different coins and finish above your start. A rug on a coin you hold ends it`;
    default:
      return '';
  }
}

// "10 minutes", "3 minutes", "30 minutes", "1 hour"
export function timeText(seconds) {
  if (!(seconds > 0)) return 'No timer';
  const m = Math.round(seconds / 60);
  if (m < 60) return m === 1 ? '1 minute' : `${m} minutes`;
  const h = m / 60;
  return h === 1 ? '1 hour' : `${clock(seconds)}`;
}

// what a challenge starts with, as the terminal shows money: "1 SOL", "$1,000"
export function startText(ch, currency, solUsd, options) {
  if (ch && ch.start && Number.isFinite(ch.start.usd) && currency === 'usd') return `$${grouped(ch.start.usd, 0)}`;
  return money(startSolFor(ch, solUsd, currency, options), currency, solUsd);
}
