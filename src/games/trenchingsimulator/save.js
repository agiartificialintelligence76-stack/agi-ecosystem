// TRENCHING SIMULATOR's progress, kept in this browser only (2026-10-20): the player's settings (terminal, sound, free
// play's start and speed, slippage and priority; since 2026-10-22 GNGM's presets P1 to P3 and its chart's view), each
// challenge's best, each day's daily market and a few totals. (The player's optional name is both games': ../player-name.js.)
// Nothing is sent anywhere. Storage can be blocked or full: every read and write is wrapped, and a broken or older save
// is read as a new one. Pure apart from the storage it's handed: read in Node too (tests/trench-game.test.js).
import { FREE_STARTS, SPEEDS, isDailyKey } from './challenges.js';
import { TERMINAL_IDS, DEFAULT_TERMINAL } from './terminals.js';
import { CHAIN_IDS, DEFAULT_CHAIN } from './live-chains.js';

export const SAVE_KEY = 'trench_v1';
export const SLIPPAGES = Object.freeze([0.01, 0.05, 0.1, 0.2, 0.5]);
export const PRIORITIES = Object.freeze(['fast', 'turbo', 'ultra']);
export const DAILY_KEEP = 30; // the daily markets remembered (the newest)
// GNGM's three settings presets (2026-10-22, P1 to P3): a slippage and a priority each; the one picked is the game's
// slippage and priority, and changing those changes it
export const PRESETS = Object.freeze([Object.freeze({ slippage: 0.2, priority: 'fast' }),
  Object.freeze({ slippage: 0.1, priority: 'turbo' }), Object.freeze({ slippage: 0.5, priority: 'ultra' })]);
// GNGM's chart: a market cap or a token's price, in dollars or the run's own coin
export const CHART_MODES = Object.freeze(['mcap', 'price']);
export const CHART_UNITS = Object.freeze(['usd', 'coin']);

const fin = (x) => typeof x === 'number' && Number.isFinite(x);
const nat = (x) => (fin(x) && x >= 0 ? Math.floor(x) : 0);

// (Live mode, 2026-10-21: whether it's on, its chain, and the challenges' bests in it, kept apart from the made-up
// markets' so neither is compared with the other)
export function blank() {
  return {
    v: 1, terminal: DEFAULT_TERMINAL, muted: false, speed: 1, freeStart: 1, slippage: 0.2, priority: 'fast',
    best: {}, daily: {}, stats: { runs: 0, wins: 0, trades: 0, coins: 0, bestX: 0 }, live: false, chain: DEFAULT_CHAIN,
    liveBest: {}, preset: 0, presets: PRESETS.map((p) => ({ ...p })), chart: { mode: 'mcap', unit: 'usd' },
  };
}

// a challenge's best: { stars 0…3, time (s, the fastest win), multiple (the best), runs, wins }
function cleanBest(b) {
  if (!b || typeof b !== 'object') return null;
  return {
    stars: Math.min(3, nat(b.stars)), time: fin(b.time) && b.time > 0 ? b.time : null,
    multiple: fin(b.multiple) && b.multiple > 0 ? b.multiple : 0, runs: nat(b.runs), wins: nat(b.wins),
  };
}

// whatever was stored, made a save (anything odd: its default)
export function cleanSave(raw) {
  const s = blank();
  if (!raw || typeof raw !== 'object' || raw.v !== 1) return s;
  if (TERMINAL_IDS.includes(raw.terminal)) s.terminal = raw.terminal;
  s.muted = raw.muted === true;
  if (SPEEDS.includes(raw.speed)) s.speed = raw.speed;
  if (FREE_STARTS.includes(raw.freeStart)) s.freeStart = raw.freeStart;
  if (SLIPPAGES.includes(raw.slippage)) s.slippage = raw.slippage;
  if (PRIORITIES.includes(raw.priority)) s.priority = raw.priority;
  for (const book of ['best', 'liveBest']) {
    if (!raw[book] || typeof raw[book] !== 'object') continue;
    for (const [id, b] of Object.entries(raw[book])) {
      const c = /^[a-z0-9-]{2,32}$/.test(id) ? cleanBest(b) : null;
      if (c) s[book][id] = c;
    }
  }
  s.live = raw.live === true;
  if (CHAIN_IDS.includes(raw.chain)) s.chain = raw.chain;
  if (Number.isInteger(raw.preset) && raw.preset >= 0 && raw.preset < PRESETS.length) s.preset = raw.preset;
  if (Array.isArray(raw.presets)) {
    s.presets = PRESETS.map((d, i) => {
      const p = raw.presets[i];
      return {
        slippage: p && SLIPPAGES.includes(p.slippage) ? p.slippage : d.slippage,
        priority: p && PRIORITIES.includes(p.priority) ? p.priority : d.priority,
      };
    });
  }
  if (raw.chart && typeof raw.chart === 'object') {
    if (CHART_MODES.includes(raw.chart.mode)) s.chart.mode = raw.chart.mode;
    if (CHART_UNITS.includes(raw.chart.unit)) s.chart.unit = raw.chart.unit;
  }
  if (raw.daily && typeof raw.daily === 'object') {
    for (const [k, d] of Object.entries(raw.daily)) {
      if (!isDailyKey(k) || !d || typeof d !== 'object') continue;
      s.daily[k] = { won: d.won === true, stars: Math.min(3, nat(d.stars)), multiple: fin(d.multiple) ? d.multiple : 0,
        tries: nat(d.tries) };
    }
  }
  const st = raw.stats && typeof raw.stats === 'object' ? raw.stats : {};
  s.stats = { runs: nat(st.runs), wins: nat(st.wins), trades: nat(st.trades), coins: nat(st.coins),
    bestX: fin(st.bestX) && st.bestX > 0 ? st.bestX : 0 };
  return s;
}

export function loadSave(storage) {
  try {
    const text = storage && storage.getItem(SAVE_KEY);
    return text ? cleanSave(JSON.parse(text)) : blank();
  } catch {
    return blank();
  }
}

// true when it was kept
export function writeSave(storage, s) {
  try {
    if (!storage) return false;
    storage.setItem(SAVE_KEY, JSON.stringify(cleanSave(s)));
    return true;
  } catch {
    return false;
  }
}

// A finished run added to a save (a new save: the one given is left as it is). A run that was never really played (no
// time, no order) isn't counted. `dailyKey`: the day of a daily market's run. Its best is kept per challenge: the most
// stars, the fastest win and the best multiple, each on its own.
export function recordResult(save, result, { dailyKey = null } = {}) {
  const s = cleanSave(save);
  const r = result && typeof result === 'object' ? result : null;
  if (!r || (!(r.timeUsed > 0) && !(r.placed > 0))) return s;
  const won = r.outcome === 'won';
  const multiple = fin(r.multiple) && r.multiple > 0 ? r.multiple : 0;
  s.stats.runs += 1;
  if (won) s.stats.wins += 1;
  s.stats.trades += nat(r.filled);
  s.stats.coins += nat(r.coins);
  if (multiple > s.stats.bestX) s.stats.bestX = multiple;
  if (r.mode === 'challenge' && typeof r.challenge === 'string' && /^[a-z0-9-]{2,32}$/.test(r.challenge)) {
    // a Live mode run's best is kept apart (its market isn't the same game as a made-up one's)
    const book = typeof r.live === 'string' ? s.liveBest : s.best;
    const b = book[r.challenge] || { stars: 0, time: null, multiple: 0, runs: 0, wins: 0 };
    b.runs += 1;
    if (won) {
      b.wins += 1;
      b.stars = Math.max(b.stars, Math.min(3, nat(r.stars)));
      if (fin(r.timeUsed) && r.timeUsed > 0 && (b.time === null || r.timeUsed < b.time)) b.time = r.timeUsed;
    }
    if (multiple > b.multiple) b.multiple = multiple;
    book[r.challenge] = b;
  }
  if (r.mode === 'daily' && isDailyKey(dailyKey)) {
    const d = s.daily[dailyKey] || { won: false, stars: 0, multiple: 0, tries: 0 };
    d.tries += 1;
    if (won) {
      d.won = true;
      d.stars = Math.max(d.stars, Math.min(3, nat(r.stars)));
    }
    if (multiple > d.multiple) d.multiple = multiple;
    s.daily[dailyKey] = d;
    const keys = Object.keys(s.daily).sort();
    for (const k of keys.slice(0, Math.max(0, keys.length - DAILY_KEEP))) delete s.daily[k];
  }
  return s;
}

// the stars of every challenge, summed (the list's "12 of 27 ★"); `live`: Live mode's own
export const starsTotal = (s, { live = false } = {}) => Object.values((s && (live ? s.liveBest : s.best)) || {})
  .reduce((n, b) => n + Math.min(3, nat(b && b.stars)), 0);
