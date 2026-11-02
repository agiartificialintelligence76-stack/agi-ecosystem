// TRENCHING SIMULATOR's game (2026-10-20): its numbers as players read them, its challenges (their goals, stars, the
// daily market and their words), a run from start to result (its clock, speeds and pauses, orders filled and failed, a
// sell's P&L, milestones, the last minute and its countdown, a challenge won, lost by time or by a rug, busted, cashed out
// or quit, its labels, the same run from the same seed), SOL's price (read, kept, or the default), AGI-1's lines and her
// voice, and the five terminals. Pure: no network, no clock, no settings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as F from '../src/games/trenchingsimulator/format.js';
import {
  CHALLENGES, TIERS, FREE_STARTS, SPEEDS, challengeById, startSolFor, goalState, atEnd, starsFor, dailyKey, isDailyKey,
  dailySeed, dailyChallenge, goalText, timeText, startText, freeStartSol,
} from '../src/games/trenchingsimulator/challenges.js';
import { createRun, BUST_SOL, MILESTONES, DOWN_AT, MAX_DT } from '../src/games/trenchingsimulator/run.js';
import { MIN_BUY, PRIORITY, BASE_FEE } from '../src/games/trenchingsimulator/engine.js';
import {
  WSOL, SOL_URL, FALLBACK_USD, SANE, SAVE_KEY, SAVED_FOR_MS, saneUsd, parseSolPrice, readSaved, getSolPrice,
} from '../src/games/trenchingsimulator/solprice.js';
import {
  LINES, MOODS, moodOf, priorityOf, lineFor, fill, createVoice, VOICE_GAP, VOICE_BREATH,
} from '../src/games/trenchingsimulator/lines.js';
import {
  SAFETY_NOTE, TERMINALS, TERMINAL_IDS, DEFAULT_TERMINAL, terminalById,
} from '../src/games/trenchingsimulator/terminals.js';
import { makeRng, seedOf } from '../src/games/trenchingsimulator/rng.js';
import {
  SORTS, ORDER_ERRORS, whoText, holderTag, buyPresets, parseAmount,
} from '../src/games/trenchingsimulator/boards/board.js';
import {
  TITLES, resultTitle, resultTone, modeLabel, resultLine, statLines, starsRow, downsample, sparkPath, cardText,
} from '../src/games/trenchingsimulator/results.js';
import { readFileSync, readdirSync } from 'node:fs';

const near = (a, b, eps, what) => assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} is not ${b}`);
const types = (events) => events.map((e) => e.type);

// ---------- format.js ----------

test("its numbers as players read them: dollars, SOL, percents, ages, clocks, prices with small zeros", () => {
  // short and whole
  assert.equal(F.compact(1234), '1.23K');
  assert.equal(F.compact(12345678), '12.3M');
  assert.equal(F.compact(999600), '1M'); // never "1000K"
  assert.equal(F.compact(999400), '999K');
  assert.equal(F.compact(-1500), '−1.5K');
  assert.equal(F.compact(12.5), '12.5');
  assert.equal(F.compact(0), '0');
  assert.equal(F.grouped(1234567.891), '1,234,567.89');
  assert.equal(F.grouped(1000, 0), '1,000');
  assert.equal(F.grouped(999.999), '1,000.00');
  // dollars
  assert.equal(F.usd(1000), '$1K');
  assert.equal(F.usd(1234.5), '$1.23K');
  assert.equal(F.usd(185.1), '$185.1');
  assert.equal(F.usd(5), '$5');
  assert.equal(F.usd(0.52), '$0.52');
  assert.equal(F.usd(0), '$0');
  assert.equal(F.usd(0.0034), '$0.0034');
  assert.equal(F.usd(0.000001234), '$0.0₅12');
  assert.equal(F.usd(-15), '−$15');
  assert.equal(F.usdFull(1234.5), '$1,234.50');
  assert.equal(F.usdFull(-3), '−$3.00');
  // SOL, as many decimals as it needs
  assert.equal(F.sol(1), '1');
  assert.equal(F.sol(6.6667), '6.667');
  assert.equal(F.sol(0.5), '0.5');
  assert.equal(F.sol(0.0001234), '0.000123');
  assert.equal(F.sol(123.456), '123.5');
  assert.equal(F.sol(12.3456), '12.35');
  assert.equal(F.sol(1234.5), '1,234.5');
  assert.equal(F.sol(150000), '150K');
  assert.equal(F.sol(0), '0');
  assert.equal(F.sol(-0.25), '−0.25');
  // signed amounts (a real minus, and never "+0")
  assert.equal(F.signed(0.123), '+0.123');
  assert.equal(F.signed(-0.045), '−0.045');
  assert.equal(F.signed(0), '0');
  assert.equal(F.signed(0.0000001), '0');
  assert.equal(F.signed(18.45, 'usd'), '+$18.45');
  assert.equal(F.signed(-15, 'usd'), '−$15');
  assert.equal(F.signed(0, 'usd'), '$0');
  // percents and multiples
  assert.equal(F.pct(0.123), '+12.3%');
  assert.equal(F.pct(-0.045), '−4.5%');
  assert.equal(F.pct(0), '0%');
  assert.equal(F.pct(0.0001), '0%');
  assert.equal(F.pct(9), '+900%');
  assert.equal(F.pct(12), '+1200%');
  assert.equal(F.pct(150), '+15K%');
  assert.equal(F.share(0.123), '12.3%');
  assert.equal(F.share(0.5), '50%');
  assert.equal(F.times(2), '2x');
  assert.equal(F.times(2.5), '2.5x');
  assert.equal(F.times(12.34), '12.3x');
  assert.equal(F.times(150.4), '150x');
  // next to 1x, as many decimals as it takes to say which side of it a run ended (a small loss never reads "1x")
  assert.equal(F.times(1), '1x');
  assert.equal(F.times(0.9978), '0.998x');
  assert.equal(F.times(1.004), '1.004x');
  assert.equal(F.times(0.9996), '0.9996x');
  assert.equal(F.times(1.0002), '1.0002x');
  assert.equal(F.times(0.99999), '1x', 'at most 4 decimals');
  assert.equal(F.times(0.97), '0.97x');
  assert.equal(F.times(0.5), '0.5x');
  assert.equal(F.times(0), '0x');
  assert.equal(F.times(NaN), '—');
  // ages and clocks
  assert.equal(F.age(0.5), 'now');
  assert.equal(F.age(-5), 'now');
  assert.equal(F.age(12.9), '12s');
  assert.equal(F.age(240), '4m');
  assert.equal(F.age(3 * 3600 + 5), '3h');
  assert.equal(F.age(2 * 86400), '2d');
  assert.equal(F.clock(305), '05:05');
  assert.equal(F.clock(59.9), '00:59');
  assert.equal(F.clock(3725), '1:02:05');
  assert.equal(F.clock(-3), '00:00');
  assert.equal(F.tokens(12345678), '12.3M');
  assert.equal(F.tokens(-5), '0');
  // prices: four or more zeros after the point are written small, as trading terminals do
  assert.equal(F.price(0.0000012345), '0.0₅1235');
  assert.equal(F.price(-0.0000012345), '−0.0₅1235');
  assert.equal(F.price(0.00012345), '0.0001235');
  assert.equal(F.price(0.000099999), '0.0001'); // rounds up to one zero fewer
  assert.equal(F.price(0.99999), '1'); // rounds up to a whole 1
  assert.equal(F.price(0.001), '0.001');
  assert.equal(F.price(0.5), '0.5');
  assert.equal(F.price(2.5), '2.5');
  assert.equal(F.price(1234.5678), '1,234.57');
  assert.equal(F.price(0), '0');
  // in a terminal's own money
  assert.equal(F.mcUsd(100, 150), '$15K');
  assert.equal(F.money(1.5, 'sol', 150), '1.5 SOL');
  assert.equal(F.money(1.5, 'sol', 150, { unit: false }), '1.5');
  assert.equal(F.money(1.5, 'usd', 150), '$225');
  assert.equal(F.money(1, 'usd', NaN), '—');
  assert.equal(F.moneySigned(0.123, 'sol', 150), '+0.123 SOL');
  assert.equal(F.moneySigned(-0.1, 'usd', 150), '−$15');
  // every function takes anything and gives a string: "—" for what isn't a number, never a throw (the money's helpers,
  // since 2026-10-21, aren't formatters: anything odd is SOL, or comes back as it is)
  const HELPERS = new Set(['isCoinCurrency', 'currencyOf', 'unitOf', 'nice']);
  for (const [name, fn] of Object.entries(F)) {
    if (typeof fn !== 'function' || HELPERS.has(name)) continue;
    for (const x of [NaN, Infinity, -Infinity, undefined, null, '12', {}, [], true]) {
      assert.equal(fn(x, x), '—', `${name}(${String(x)})`);
    }
  }
  for (const x of [NaN, Infinity, -Infinity, undefined, null, '12', {}, [], true]) {
    assert.equal(F.isCoinCurrency(x), false);
    assert.equal(F.currencyOf(x), 'sol');
    assert.deepEqual(F.unitOf(x, x), { id: 'sol', name: 'SOL', per: 1 });
    assert.equal(F.money(1, x, 150), '1 SOL', String(x));
    assert.ok(Object.is(F.nice(x), x) || (typeof x === 'number' && !Number.isFinite(x)), String(x));
  }
});

// ---------- challenges.js ----------

test("its challenges: the owner's two and seven more, each with a goal, a start, a time and words", () => {
  assert.equal(CHALLENGES.length, 9);
  assert.equal(new Set(CHALLENGES.map((c) => c.id)).size, 9);
  assert.ok(Object.isFrozen(CHALLENGES));
  const kinds = new Set(['worth', 'profitUsd', 'takeProfit', 'migration', 'survive']);
  for (const c of CHALLENGES) {
    assert.ok(Object.isFrozen(c) && Object.isFrozen(c.goal) && Object.isFrozen(c.start), `${c.id} frozen`);
    assert.ok(TIERS.includes(c.tier), `${c.id}'s tier`);
    assert.ok(kinds.has(c.goal.kind), `${c.id}'s goal`);
    assert.ok(c.seconds > 0 && Number.isInteger(c.seconds), `${c.id}'s time`);
    assert.ok((c.start.sol > 0) !== (c.start.usd > 0), `${c.id}: one start`);
    assert.ok(c.name.length >= 3 && c.name.length <= 24, `${c.id}'s name`);
    assert.ok(c.blurb.length >= 10 && c.blurb.length <= 80, `${c.id}'s blurb`);
    assert.doesNotMatch(c.blurb, /\b(buy|guarantee|financial|\$AGI)\b/i, `${c.id}'s blurb`);
    assert.equal(challengeById(c.id), c);
  }
  assert.equal(challengeById('nope'), null);
  assert.equal(challengeById(undefined), null);
  // the owner's: "make 10x your money in 30 mins", "make 500$ in 10 mins"
  const ten = challengeById('ten-bagger');
  assert.deepEqual([ten.tier, ten.start.sol, ten.seconds, ten.goal.kind, ten.goal.x], ['legendary', 1, 1800, 'worth', 10]);
  const five = challengeById('five-hundred');
  assert.deepEqual([five.start.usd, five.seconds, five.goal.kind, five.goal.usd], [1000, 600, 'profitUsd', 500]);
  assert.deepEqual([...FREE_STARTS], [1, 5, 10, 50]);
  assert.deepEqual([...SPEEDS], [1, 2, 4]);
  assert.deepEqual([...TIERS], ['easy', 'medium', 'hard', 'legendary']);

  // what a challenge starts with, in SOL
  assert.equal(startSolFor(ten, 150), 1);
  near(startSolFor(five, 150), 1000 / 150, 1e-12, 'a dollar start at the run\'s price');
  near(startSolFor(five, 200), 5, 1e-12, 'another price');
  near(startSolFor(five, NaN), 1000 / 150, 1e-12, 'no price: $150');
  near(startSolFor(five, -3), 1000 / 150, 1e-12, 'a bad price: $150');
  assert.equal(startSolFor(null, 150), 1);
  assert.equal(startSolFor({ start: {} }, 150), 1);
});

test('how far along a goal is, for each kind; and its stars', () => {
  const worth = { kind: 'worth', x: 2 };
  assert.deepEqual(goalState(worth, { worth: 1.5, start: 1 }), { done: false, frac: 0.5, failed: false });
  assert.deepEqual(goalState(worth, { worth: 2, start: 1 }), { done: true, frac: 1, failed: false });
  assert.equal(goalState(worth, { worth: 2 - 1e-13, start: 1 }).done, true);
  assert.deepEqual(goalState(worth, { worth: 0.4, start: 1 }), { done: false, frac: 0, failed: false });
  assert.deepEqual(goalState(worth, { worth: 9, start: 1 }).frac, 1);
  assert.deepEqual(goalState(worth, undefined), { done: false, frac: 0, failed: false });
  assert.deepEqual(goalState(worth, { worth: NaN, start: 2 }), { done: false, frac: 0, failed: false });

  const usd = { kind: 'profitUsd', usd: 500 };
  const start = 1000 / 150;
  assert.equal(goalState(usd, { worth: start + 500 / 150, start, solUsd: 150 }).done, true);
  near(goalState(usd, { worth: start + 250 / 150, start, solUsd: 150 }).frac, 0.5, 1e-9, 'half the profit');
  near(goalState(usd, { worth: 1 + 250 / 150, start: 1 }).frac, 0.5, 1e-9, 'no price: $150');
  assert.equal(goalState(usd, { worth: start - 1, start, solUsd: 150 }).frac, 0);

  const tp = { kind: 'takeProfit', x: 3 };
  assert.equal(goalState(tp, { positions: [{ invested: 1, sold: 3 }] }).done, true);
  near(goalState(tp, { positions: [{ invested: 1, sold: 1.5 }, { invested: 0, sold: 9 }] }).frac, 0.5, 1e-12, 'best sold');
  assert.equal(goalState(tp, { positions: [] }).frac, 0);

  const mig = { kind: 'migration' };
  assert.deepEqual(goalState(mig, { flags: { migrationWin: true } }), { done: true, frac: 1, failed: false });
  near(goalState(mig, { positions: [{ open: true, progress: 0.5 }] }).frac, 0.425, 1e-12, 'along its curve');
  assert.equal(goalState(mig, { positions: [{ open: true, progress: 0.5, heldThrough: true }] }).frac, 0.9);
  assert.equal(goalState(mig, { positions: [{ open: false, progress: 1, heldThrough: true }] }).frac, 0);
  assert.equal(goalState(mig, { positions: [{ open: true }] }).frac, 0);

  const sv = { kind: 'survive', coins: 5 };
  const flags = (n, rugHit = false) => ({ coinsTraded: n, rugHit });
  assert.deepEqual(goalState(sv, { worth: 2.2, start: 2, timeUp: true, flags: flags(5) }), { done: true, frac: 1, failed: false });
  assert.equal(goalState(sv, { worth: 2.2, start: 2, timeUp: false, flags: flags(5) }).done, false); // only when time is up
  assert.equal(goalState(sv, { worth: 2, start: 2, timeUp: true, flags: flags(5) }).done, false); // above its start
  assert.equal(goalState(sv, { worth: 3, start: 2, timeUp: true, flags: flags(4) }).done, false);
  near(goalState(sv, { worth: 3, start: 2, flags: flags(2) }).frac, 0.4, 1e-12, 'coins traded');
  assert.deepEqual(goalState(sv, { worth: 3, start: 2, timeUp: true, flags: flags(5, true) }), { done: false, frac: 1, failed: true });

  assert.deepEqual(goalState({ kind: 'nope' }, {}), { done: false, frac: 0, failed: false });
  assert.deepEqual(goalState(null, {}), { done: false, frac: 0, failed: false });
  assert.equal(atEnd(sv), true);
  for (const g of [worth, usd, tp, mig, null]) assert.equal(atEnd(g), false);

  // stars: a third of its time or less 3, two thirds 2, else 1; surviving by how far above its start
  const dbl = challengeById('double-up');
  assert.equal(starsFor(dbl, { timeUsed: 0 }), 3);
  assert.equal(starsFor(dbl, { timeUsed: 200 }), 3);
  assert.equal(starsFor(dbl, { timeUsed: 201 }), 2);
  assert.equal(starsFor(dbl, { timeUsed: 400 }), 2);
  assert.equal(starsFor(dbl, { timeUsed: 401 }), 1);
  assert.equal(starsFor(dbl, { timeUsed: 600 }), 1);
  const rd = challengeById('rug-dodger');
  assert.equal(starsFor(rd, { multiple: 1.5, timeUsed: 600 }), 3);
  assert.equal(starsFor(rd, { multiple: 1.2, timeUsed: 600 }), 2);
  assert.equal(starsFor(rd, { multiple: 1.19, timeUsed: 600 }), 1);
  assert.equal(starsFor(null, { timeUsed: 1 }), 0);
});

test('the daily market: the same challenge and seed for everyone on a UTC day', () => {
  assert.equal(dailyKey(new Date('2026-10-20T23:59:59.999Z')), '2026-10-20');
  assert.equal(dailyKey(new Date('2026-10-21T00:00:00.000Z')), '2026-10-21');
  assert.equal(dailyKey(new Date('2026-10-21T00:30:00+08:00')), '2026-10-20'); // its UTC day, wherever the player is
  assert.equal(dailyKey(Date.UTC(2027, 0, 1)), '2027-01-01');
  assert.equal(dailyKey(Date.UTC(2028, 1, 29, 12)), '2028-02-29');
  assert.equal(dailyKey(NaN), '1970-01-01');
  assert.equal(dailyKey('soon'), '1970-01-01');
  assert.equal(isDailyKey('2026-10-20'), true);
  for (const k of ['2026-1-2', '20261020', 20261020, null, '2026-10-20T00']) assert.equal(isDailyKey(k), false, String(k));
  assert.equal(dailySeed('2026-10-20'), 'daily-2026-10-20');

  const pool = new Set(['double-up', 'five-hundred', 'speedrun', 'rug-dodger', 'runner', 'migration', 'whale']);
  const seen = new Map();
  for (let d = 0; d < 366; d++) {
    const key = dailyKey(Date.UTC(2026, 9, 20 + d));
    const ch = dailyChallenge(key);
    assert.ok(pool.has(ch.id), `${key}: ${ch.id}`);
    assert.equal(ch.daily, key);
    assert.deepEqual(dailyChallenge(key), ch, 'the same for everyone');
    seen.set(ch.id, (seen.get(ch.id) || 0) + 1);
  }
  assert.equal(seen.size, pool.size, 'every one of the pool comes up in a year');
  for (const n of seen.values()) assert.ok(n >= 20, `each about once a week (${n})`);
  assert.equal(challengeById(dailyChallenge('2026-10-20').id).daily, undefined, 'a copy: the challenge itself is unchanged');
});

test("a goal's words and its time, in the terminal's own money", () => {
  const c = (id) => challengeById(id);
  assert.equal(goalText(c('first-blood'), 'sol', 150), 'Finish above 1 SOL: any profit counts');
  assert.equal(goalText(c('first-blood'), 'usd', 150), 'Finish above $150: any profit counts');
  assert.equal(goalText(c('double-up'), 'sol', 150), 'Turn 1 SOL into 2 SOL (2x)');
  assert.equal(goalText(c('double-up'), 'usd', 150), 'Turn $150 into $300 (2x)');
  assert.equal(goalText(c('speedrun'), 'sol', 150), 'Turn 1 SOL into 1.5 SOL (1.5x)');
  assert.equal(goalText(c('ten-bagger'), 'sol', 150), 'Turn 1 SOL into 10 SOL (10x)');
  assert.equal(goalText(c('ten-bagger'), 'usd', 200), 'Turn $200 into $2K (10x)');
  assert.equal(goalText(c('whale'), 'sol', 150), 'Turn 100 SOL into 150 SOL (1.5x)');
  assert.equal(goalText(c('five-hundred'), 'usd', 150), 'Make $500 profit');
  assert.equal(goalText(c('five-hundred'), 'sol', 150), 'Make $500 profit (about 3.333 SOL)');
  assert.equal(goalText(c('five-hundred'), 'sol', 250), 'Make $500 profit (about 2 SOL)');
  assert.equal(goalText(c('runner'), 'sol', 150), 'Sell one coin for 3x what you put into it');
  assert.equal(goalText(c('migration'), 'sol', 150), 'Hold a coin while it migrates, then sell it in profit');
  assert.equal(goalText(c('rug-dodger'), 'sol', 150),
    'Trade 5 different coins and finish above your start. A rug on a coin you hold ends it');
  assert.equal(goalText(null, 'sol', 150), '');
  for (const ch of CHALLENGES) {
    for (const cur of ['sol', 'usd']) assert.doesNotMatch(goalText(ch, cur, 150), /—|NaN|undefined/, `${ch.id} ${cur}`);
  }

  assert.equal(timeText(0), 'No timer');
  assert.equal(timeText(null), 'No timer');
  assert.equal(timeText(60), '1 minute');
  assert.equal(timeText(180), '3 minutes');
  assert.equal(timeText(1800), '30 minutes');
  assert.equal(timeText(3600), '1 hour');
  assert.equal(timeText(5400), '1:30:00');

  assert.equal(startText(c('five-hundred'), 'usd', 150), '$1,000'); // its own dollars, whole
  assert.equal(startText(c('five-hundred'), 'usd', 999), '$1,000');
  assert.equal(startText(c('five-hundred'), 'sol', 150), '6.667 SOL');
  assert.equal(startText(c('double-up'), 'sol', 150), '1 SOL');
  assert.equal(startText(c('double-up'), 'usd', 150), '$150');
  assert.equal(startText(c('whale'), 'usd', 150), '$15K');
});

// ---------- run.js ----------

// a fresh coin (at most maxAge seconds old, at least minAge) with one of the fates, the run ticking until there's one
function fresh(run, fates, { minAge = 0, maxAge = 4, limit = 2400, when = () => true } = {}) {
  for (let s = 0; s < limit && !run.over; s++) {
    const m = run.market;
    for (let id = m.size.coins - 1; id >= 0; id--) {
      const c = m.debug.coin(id);
      const age = m.t - c.born;
      if (age > maxAge) break;
      if (age >= minAge && fates.includes(c.fate) && when(c)) return id;
    }
    run.tick(0.25);
  }
  return null;
}

// a coin on its curve from the run's lists
function curveCoin(run, skip = new Set()) {
  const L = run.market.lists({ limit: 30 });
  for (const r of [...L.new, ...L.stretch]) if (!skip.has(r.id) && r.phase === 'curve') return r.id;
  return null;
}

const ticks = (run, n, dt = 0.25) => {
  for (let i = 0; i < n && !run.over; i++) run.tick(dt);
};

test("a run's clock: its speeds, its longest step, a pause, and every way a tick can be wrong", () => {
  const run = createRun({ seed: 'clock-1', mode: 'free' });
  assert.equal(run.clock, 0);
  assert.equal(run.speed, 1);
  assert.equal(run.market.t, 0, 'the market starts at 0 after its warm-up');
  assert.deepEqual(types(run.drain()), ['start']);
  assert.deepEqual(run.drain(), [], 'drained');

  run.tick(10); // a slow frame never jumps the market ahead
  assert.equal(run.clock, MAX_DT);
  for (const bad of [-1, 0, NaN, 'soon', null, undefined, {}]) {
    assert.equal(run.tick(bad), 0, String(bad));
    assert.equal(run.clock, MAX_DT, String(bad));
  }
  for (let i = 0; i < 39; i++) run.tick(0.25);
  assert.equal(run.clock, 10, 'kept in whole microseconds: 40 steps of 0.25 s are exactly 10 s');
  near(run.market.t, 10, 1e-9, "the market's clock follows");

  // free play's speeds: only its own, and an unknown one changes nothing
  assert.equal(run.setSpeed(2), 2);
  run.tick(0.25);
  assert.equal(run.clock, 10.5);
  assert.equal(run.setSpeed(3), 2);
  assert.equal(run.setSpeed('x'), 2);
  assert.equal(run.setSpeed('4'), 4);
  run.tick(0.25);
  assert.equal(run.clock, 11.5);
  assert.equal(run.setSpeed(1), 1);

  // a pause stops its clock and its market
  run.pause();
  assert.equal(run.paused, true);
  const t = run.market.t;
  assert.equal(run.tick(0.25), 0);
  assert.equal(run.clock, 11.5);
  assert.equal(run.market.t, t);
  run.resume();
  assert.equal(run.paused, false);
  assert.ok(run.tick(0.25) > 0, 'its market moves on again');
  assert.equal(run.clock, 11.75);

  // a speed it doesn't have starts at 1; a challenge is always at 1
  assert.equal(createRun({ seed: 'clock-2', mode: 'free', speed: 7 }).speed, 1);
  assert.equal(createRun({ seed: 'clock-2', mode: 'free', speed: 4 }).speed, 4);
  const ch = createRun({ seed: 'clock-3', mode: 'challenge', challenge: challengeById('double-up'), speed: 4 });
  assert.equal(ch.speed, 1);
  assert.equal(ch.setSpeed(4), 1);
  assert.equal(ch.setSpeed(2), 1);
});

test("orders: the first fill, a sell's P&L, a fill that failed on slippage, and the HUD's numbers", () => {
  const run = createRun({ seed: 'fills-1', mode: 'free', startSol: 5 });
  ticks(run, 8);
  const a = curveCoin(run);
  assert.notEqual(a, null);
  const r1 = run.order({ coin: a, side: 'buy', sol: 0.5, slippage: 0.5, priority: 'turbo' });
  assert.equal(r1.ok, true);
  assert.equal(run.hud().pending, 1);
  ticks(run, 8);
  const b = curveCoin(run, new Set([a]));
  assert.equal(run.order({ coin: b, side: 'buy', sol: 0.3, slippage: 0.5, priority: 'turbo' }).ok, true);
  ticks(run, 8);
  const buys = run.drain().filter((e) => e.type === 'fill');
  assert.deepEqual(buys.map((e) => [e.order.side, e.first]), [['buy', true], ['buy', false]]);
  assert.equal(buys[0].order.coin, a);
  assert.equal(buys[0].order.status, 'filled');
  let hud = run.hud();
  assert.equal(hud.open, 2);
  assert.equal(hud.pending, 0);
  assert.equal(hud.held, 0);
  const fee = PRIORITY.turbo.fee + BASE_FEE;
  near(hud.sol, 5 - 0.8 - 2 * fee, 1e-9, 'its SOL after two buys and their fees');
  near(hud.worth, run.market.player.worth, 1e-12, 'worth');
  near(hud.multiple, hud.worth / 5, 1e-12, 'multiple');
  near(hud.pnlUsd, (hud.worth - 5) * 150, 1e-9, 'P&L in dollars');
  assert.equal(hud.left, null, 'free play has no timer');

  // a sell: what it made or lost, whether it closed its position, and that position's whole result
  assert.equal(run.order({ coin: a, side: 'sell', frac: 1, slippage: 0.5, priority: 'turbo' }).ok, true);
  ticks(run, 8);
  const [sold] = run.drain().filter((e) => e.type === 'fill');
  assert.equal(sold.order.side, 'sell');
  assert.equal(sold.first, false);
  assert.equal(sold.closed, true);
  const pos = run.market.positions().find((p) => p.id === a);
  assert.equal(pos.open, false);
  near(sold.pnl, pos.realized, 1e-12, "the sell's P&L is its position's realized");
  near(sold.total, pos.total, 1e-12, 'its total');
  hud = run.hud();
  assert.equal(hud.open, 1);
  const res = run.result();
  assert.deepEqual([res.placed, res.filled, res.failed, res.coins], [3, 3, 0, 2]);
  assert.equal(res.outcome, 'playing');
  assert.equal(res.stars, 0);
  assert.equal(res.reason, null);
  assert.deepEqual(res.equity[0], { t: 0, v: 5 }, 'its worth from the start, every second');
  // its fees as one number (what the results show), its parts beside it, and what bots took never counted as a fee
  assert.ok(res.feeParts.priority > 0 && res.feeParts.terminal > 0, 'its fees, by kind');
  const fp = run.market.player.fees;
  near(res.fees, fp.terminal + fp.market + fp.priority + fp.failed, 1e-12, 'its fees, in all');
  assert.ok(Number.isFinite(res.fees) && res.fees > 0, 'a number, never an object');
  assert.equal(res.mev, 0, 'no sandwich bots unless a run asks for them');
  assert.notEqual(res.feeParts, fp, 'a copy of its parts');
  // with sandwich bots on (the engine's option; the game itself leaves them off): what they took has its own number
  let bots = null;
  for (let s = 0; s < 6 && !bots; s++) {
    const r = createRun({ seed: `bots-${s}`, mode: 'free', startSol: 50, config: { mev: true } });
    for (let k = 0; k < 6; k++) {
      const pick = r.market.lists().new[k];
      if (pick) r.order({ coin: pick.id, side: 'buy', sol: 2, slippage: 0.6 });
    }
    ticks(r, 6);
    if (r.market.player.fees.mev > 0) bots = r;
  }
  assert.ok(bots, 'bots sandwich a buy at 60% slippage within 6 seeds');
  const bf = bots.market.player.fees;
  const bres = bots.result();
  near(bres.mev, bf.mev, 1e-12, 'what bots took');
  near(bres.fees, bf.terminal + bf.market + bf.priority + bf.failed, 1e-12, 'never counted as a fee');
  assert.ok(bres.fees > 0 && bres.mev > 0);

  // a buy that fails on slippage (a coin just launched, at the least slippage there is): its fee is still paid
  let failed = null;
  for (let k = 0; k < 20 && !failed; k++) {
    const r = createRun({ seed: `slip-${k}`, mode: 'free', startSol: 2 });
    const id = fresh(r, ['dud', 'rug', 'pumpdump', 'slow', 'runner', 'moon'], { maxAge: 0.3 });
    if (id === null || !r.order({ coin: id, side: 'buy', sol: 0.5, slippage: 0, priority: 'fast' }).ok) continue;
    ticks(r, 12);
    const ev = r.drain().filter((e) => e.type === 'fill' || e.type === 'fail');
    if (ev[0] && ev[0].type === 'fail') failed = { r, e: ev[0] };
  }
  assert.ok(failed, 'a buy at no slippage on a coin just launched fails within 20 seeds');
  assert.equal(failed.e.reason, 'slippage');
  assert.equal(failed.e.order.status, 'failed');
  near(failed.r.hud().sol, 2 - PRIORITY.fast.fee - BASE_FEE, 1e-9, 'only its fee is gone');
  assert.deepEqual([failed.r.result().failed, failed.r.result().filled, failed.r.result().coins], [1, 0, 0]);
  assert.equal(failed.r.hud().open, 0);
});

test('a challenge lost by time: its last minute, its countdown, its end at exactly its time', () => {
  const run = createRun({ seed: 'time-1', mode: 'challenge', challenge: challengeById('speedrun') });
  assert.equal(run.left, 180);
  assert.equal(run.seconds, 180);
  const all = [];
  let n = 0;
  while (!run.over && n < 20000) {
    run.tick(1 / 60); // a 60 Hz screen
    n++;
    all.push(...run.drain());
  }
  assert.equal(run.outcome, 'lost');
  assert.equal(run.clock, 180, 'never past its time');
  assert.equal(run.left, 0);
  assert.deepEqual(types(all), ['start', 'idle', 'last_minute', 'idle', ...Array(10).fill('countdown'), 'end']);
  // a 60 Hz tick is 16,667 µs on the run's clock, so a moment lands within one tick after its whole second
  const TICK = 1 / 60 + 1e-9;
  const onTime = (at, want, what) => assert.ok(at >= want && at < want + TICK, `${what}: at ${at}, not within a tick of ${want}`);
  const cd = all.filter((e) => e.type === 'countdown');
  assert.deepEqual(cd.map((e) => e.s), [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
  for (const e of cd) onTime(e.at, 180 - e.s, `countdown ${e.s}`);
  onTime(all.find((e) => e.type === 'last_minute').at, 120, 'the last minute');
  const idles = all.filter((e) => e.type === 'idle').map((e) => e.at);
  onTime(idles[0], 40, 'idle after 40 s');
  onTime(idles[1], 130, 'then every 90 s');
  const end = all[all.length - 1];
  assert.deepEqual([end.outcome, end.reason, end.at], ['lost', 'time', 180]);
  for (let i = 1; i < all.length; i++) assert.ok(all[i].at >= all[i - 1].at, 'in order');
  const res = run.result();
  assert.deepEqual([res.outcome, res.reason, res.timeUsed, res.stars, res.seconds], ['lost', 'time', 180, 0, 180]);
  assert.deepEqual(run.progress(), { frac: 0, done: false, failed: false, label: '1 SOL / 1.5 SOL' });
  // over: nothing moves, nothing is placed
  assert.equal(run.tick(0.25), 0);
  assert.equal(run.clock, 180);
  assert.deepEqual(run.order({ coin: 0, side: 'buy', sol: 0.1 }), { ok: false, error: 'over' });
  run.end();
  assert.deepEqual(run.drain(), [], 'ended once');

  // a challenge of two minutes or less has no "last minute"
  const short = createRun({ seed: 'time-2', mode: 'challenge',
    challenge: { id: 'short', seconds: 90, start: { sol: 1 }, goal: { kind: 'worth', x: 2 } } });
  const ev = [];
  while (!short.over) {
    short.tick(0.25);
    ev.push(...short.drain());
  }
  assert.equal(ev.some((e) => e.type === 'last_minute'), false);
  assert.equal(ev.filter((e) => e.type === 'countdown').length, 10);
});

test('a challenge won: double up with its milestones and stars; the migration ridden and sold in profit', () => {
  const dbl = challengeById('double-up');
  let won = null;
  for (let k = 0; k < 8 && !won; k++) {
    const run = createRun({ seed: `dbl-${k}`, mode: 'challenge', challenge: dbl });
    const id = fresh(run, ['runner', 'moon'], { minAge: 0.1 });
    if (id === null || !run.order({ coin: id, side: 'buy', sol: 0.95, slippage: 0.4, priority: 'fast' }).ok) continue;
    while (!run.over) run.tick(0.25);
    if (run.outcome === 'won') won = run;
  }
  assert.ok(won, 'a runner bought early doubles the money within 8 seeds');
  const ev = won.drain().filter((e) => e.type !== 'idle');
  const t = types(ev);
  assert.equal(t[0], 'start');
  assert.equal(t[t.length - 1], 'end');
  assert.equal(ev[ev.length - 1].outcome, 'won');
  assert.deepEqual(ev.filter((e) => e.type === 'milestone').map((e) => e.x).slice(0, 2), [1.5, 2]);
  assert.ok(t.indexOf('close') > -1 && t.indexOf('close') < t.lastIndexOf('end'), 'close to its goal first');
  assert.equal(t.filter((x) => x === 'close').length, 1);
  const res = won.result();
  assert.equal(res.outcome, 'won');
  assert.ok(res.multiple >= 2 - 1e-9, `${res.multiple}`);
  assert.equal(res.stars, starsFor(dbl, res));
  assert.ok(res.stars >= 1 && res.stars <= 3);
  assert.equal(res.timeUsed, won.clock);
  assert.deepEqual(won.progress().done, true);
  for (const m of MILESTONES) if (res.peak / res.start >= m) assert.ok(ev.some((e) => e.type === 'milestone' && e.x === m), `${m}x`);

  // the migration: a coin held while it migrates, then sold after it, in profit
  const mig = challengeById('migration');
  let ok = null;
  for (let k = 0; k < 6 && !ok; k++) {
    const run = createRun({ seed: `mig-${k}`, mode: 'challenge', challenge: mig });
    const id = fresh(run, ['runner', 'moon'], { minAge: 0.1 });
    if (id === null || !run.order({ coin: id, side: 'buy', sol: 1.5, slippage: 0.4, priority: 'fast' }).ok) continue;
    assert.equal(run.progress().label, 'hold a coin through its migration');
    while (!run.over && run.market.row(id).phase !== 'pool') run.tick(0.25);
    if (run.over) continue;
    ticks(run, 12);
    const before = run.progress();
    if (!run.order({ coin: id, side: 'sell', frac: 1, slippage: 0.4, priority: 'fast' }).ok) continue;
    ticks(run, 12);
    if (run.outcome === 'won') ok = { run, id, before };
  }
  assert.ok(ok, 'a runner ridden through its migration and sold wins within 6 seeds');
  assert.equal(ok.before.label, 'migrated: sell in profit');
  assert.equal(ok.before.frac, 0.9);
  assert.equal(ok.run.progress().label, 'done');
  const evm = ok.run.drain();
  const tm = types(evm);
  assert.ok(tm.indexOf('migrating') < tm.indexOf('migrated'), 'it migrates, then it has migrated');
  assert.equal(evm.find((e) => e.type === 'migrated').coin, ok.id);
  assert.deepEqual(ok.run.flags.heldThrough, [ok.id]);
  assert.equal(ok.run.flags.migrationWin.coin, ok.id);
  const sell = evm.filter((e) => e.type === 'fill').pop();
  assert.equal(sell.order.side, 'sell');
  assert.ok(sell.total > 0, 'in profit');
  assert.equal(tm[tm.length - 1], 'end');
});

test("a challenge lost to a rug: the dev's sell, the rug, the end; and down by half in free play", () => {
  const rd = challengeById('rug-dodger');
  let lost = null;
  for (let k = 0; k < 8 && !lost; k++) {
    const run = createRun({ seed: `rug-${k}`, mode: 'challenge', challenge: rd });
    const id = fresh(run, ['rug'], { minAge: 0.5, when: (c) => c.plan.events.some((e) => e.what === 'rug' && e.t > 15) });
    if (id === null || !run.order({ coin: id, side: 'buy', sol: 0.2, slippage: 0.5, priority: 'fast' }).ok) continue;
    while (!run.over) run.tick(0.25);
    if (run.outcome === 'lost') lost = { run, id };
  }
  assert.ok(lost, 'a rug held loses the rug dodger within 8 seeds');
  const ev = lost.run.drain().filter((e) => e.type !== 'idle');
  const t = types(ev);
  assert.ok(t.includes('rug'));
  assert.equal(t[t.length - 1], 'end');
  const rug = ev.find((e) => e.type === 'rug');
  assert.equal(rug.coin, lost.id);
  assert.equal(typeof rug.ticker, 'string');
  for (const d of ev.filter((e) => e.type === 'dev_sell')) {
    assert.equal(d.coin, lost.id);
    assert.ok(d.frac >= 0.5, 'only a dev selling half or more is news');
  }
  const end = ev[ev.length - 1];
  assert.deepEqual([end.outcome, end.reason], ['lost', 'rug']);
  const res = lost.run.result();
  assert.deepEqual([res.outcome, res.reason, res.stars], ['lost', 'rug', 0]);
  assert.equal(lost.run.flags.rugHit.coin, lost.id);
  assert.ok(lost.run.clock < rd.seconds, 'before its time was up');
  assert.equal(lost.run.progress().failed, true);

  // free play, nearly everything on a rug bought at its top (a moment before its rug): down by half, said once; never
  // busted while a coin is held. (Bought at its launch instead, a curve's rug takes only about 40%: everyone else's exit
  // can't take back more than what the early buyers made from it.)
  let down = null;
  for (let k = 0; k < 8 && !down; k++) {
    const run = createRun({ seed: `down-${k}`, mode: 'free', startSol: 1 });
    const id = fresh(run, ['rug'], { minAge: 0.5, when: (c) => c.plan.events.some((e) => e.what === 'rug' && e.t > 15) });
    if (id === null) continue;
    const c = run.market.debug.coin(id);
    const rugAt = c.born + c.plan.events.find((e) => e.what === 'rug').t;
    while (!run.over && run.market.t < rugAt - 2) run.tick(0.25);
    if (!run.order({ coin: id, side: 'buy', sol: 0.9, slippage: 0.5, priority: 'fast' }).ok) continue;
    const ev2 = [];
    for (let i = 0; i < 2400 && !ev2.some((e) => e.type === 'rug'); i++) {
      run.tick(0.25);
      ev2.push(...run.drain());
    }
    ticks(run, 40);
    ev2.push(...run.drain());
    if (ev2.some((e) => e.type === 'down')) down = { run, ev: ev2 };
  }
  assert.ok(down, 'nearly everything on a rug, bought at its top, halves the money within 8 seeds');
  assert.equal(DOWN_AT, 0.5, 'down by half');
  assert.equal(down.ev.filter((e) => e.type === 'down').length, 1, 'said once');
  assert.equal(down.ev.find((e) => e.type === 'down').x, DOWN_AT);
  const lowRes = down.run.result();
  assert.ok(lowRes.low <= DOWN_AT * lowRes.start + 1e-12, `its low ${lowRes.low}`);
  assert.ok(lowRes.low <= down.run.hud().worth + 1e-12, 'its low is never above its worth');
  assert.equal(down.run.over, false, 'still holding its coin: not busted');
  ticks(down.run, 40);
  assert.equal(down.run.drain().filter((e) => e.type === 'down').length, 0, 'never said again');
});

test('busted, cashed out or quit; the labels, HUD and result of every challenge; the daily market', () => {
  // nothing left to trade with
  assert.equal(BUST_SOL, MIN_BUY + 2 * (PRIORITY.fast.fee + BASE_FEE));
  const b = createRun({ seed: 'bust', mode: 'free', startSol: 0.003 });
  b.tick(0.1);
  assert.equal(b.outcome, 'busted');
  assert.deepEqual(b.drain().map((e) => e.type + (e.outcome ? `:${e.outcome}` : '')), ['start', 'end:busted']);
  assert.equal(b.result().outcome, 'busted');
  const nb = createRun({ seed: 'bust', mode: 'free', startSol: 0.0031 });
  ticks(nb, 8);
  assert.equal(nb.over, false, 'enough for the smallest buy and its fees');

  // free play: Cash out; leaving is quitting; a challenge is never cashed out
  const f = createRun({ seed: 'cash', mode: 'free', startSol: 10 });
  assert.deepEqual(f.progress(), { frac: null, label: '0% so far' });
  ticks(f, 4);
  f.end();
  assert.equal(f.outcome, 'cashed');
  f.end('quit');
  assert.equal(f.outcome, 'cashed', 'the first end stays');
  assert.equal(f.drain().filter((e) => e.type === 'end').length, 1);
  const q = createRun({ seed: 'quit', mode: 'free' });
  q.end('quit');
  assert.equal(q.outcome, 'quit');
  const cq = createRun({ seed: 'quit', mode: 'challenge', challenge: challengeById('first-blood') });
  cq.end('cashed');
  assert.equal(cq.outcome, 'quit');
  assert.deepEqual([cq.result().outcome, cq.result().stars], ['quit', 0]);

  // every challenge's label at its start, in SOL and in dollars
  const want = {
    'first-blood': ['1 SOL / 1.05 SOL', '$150 / $157.5'],
    'double-up': ['1 SOL / 2 SOL', '$150 / $300'],
    'five-hundred': ['+$0 / +$500', '+$0 / +$500'],
    speedrun: ['1 SOL / 1.5 SOL', '$150 / $225'],
    'rug-dodger': ['0/5 coins · 0%', '0/5 coins · 0%'],
    runner: ['best sold 0.00x / 3x', 'best sold 0.00x / 3x'],
    migration: ['hold a coin through its migration', 'hold a coin through its migration'],
    whale: ['100 SOL / 150 SOL', '$15K / $22.5K'],
    'ten-bagger': ['1 SOL / 10 SOL', '$150 / $1.5K'],
  };
  for (const ch of CHALLENGES) {
    const sol = createRun({ seed: `lbl-${ch.id}`, mode: 'challenge', challenge: ch, currency: 'sol', speed: 4 });
    const usd = createRun({ seed: `lbl-${ch.id}`, mode: 'challenge', challenge: ch, currency: 'usd', solUsd: 150 });
    assert.deepEqual([sol.progress().label, usd.progress().label], want[ch.id], ch.id);
    assert.equal(sol.progress().frac, 0, ch.id);
    near(sol.start, startSolFor(ch, 150), 1e-12, `${ch.id}'s start`);
    assert.equal(sol.seconds, ch.seconds);
    assert.equal(sol.speed, 1);
    const hud = sol.hud();
    assert.deepEqual([hud.clock, hud.left, hud.open, hud.pending, hud.multiple, hud.pnl, hud.over, hud.outcome],
      [0, ch.seconds, 0, 0, 1, 0, false, null], ch.id);
    near(hud.worth, sol.start, 1e-12, `${ch.id}'s worth`);
    const res = sol.result();
    assert.deepEqual([res.mode, res.challenge, res.daily, res.outcome, res.currency, res.terminal],
      ['challenge', ch.id, null, 'playing', 'sol', 'board'], ch.id);
  }
  // its dollars when the price moves: a dollar challenge's start, and a loss in its label
  const r5 = createRun({ seed: 'usd-5', mode: 'challenge', challenge: challengeById('five-hundred'), solUsd: 250 });
  near(r5.start, 4, 1e-12, '$1,000 at $250 a SOL');
  assert.equal(r5.solUsd, 250);
  const lossy = createRun({ seed: 'usd-6', mode: 'challenge', challenge: challengeById('five-hundred'), solUsd: 150 });
  const id = curveCoin(lossy);
  lossy.order({ coin: id, side: 'buy', sol: 1, slippage: 0.5, priority: 'ultra' });
  ticks(lossy, 4);
  assert.match(lossy.progress().label, /^(−\$\d+(\.\d+)? \/ \+\$500|\+\$\d+(\.\d+)? \/ \+\$500)$/);

  // the daily market: its seed and its challenge, the same for everyone, its key in the result
  const key = '2026-10-20';
  const d = createRun({ seed: dailySeed(key), mode: 'daily', challenge: dailyChallenge(key), terminal: 'pro', speed: 4 });
  assert.equal(d.challenge.id, dailyChallenge(key).id);
  assert.equal(d.speed, 1);
  assert.deepEqual([d.result().mode, d.result().daily, d.result().terminal], ['daily', key, 'pro']);
  assert.equal(d.seed, dailySeed(key));
  const d2 = createRun({ seed: dailySeed(key), mode: 'daily', challenge: dailyChallenge(key) });
  assert.deepEqual(d2.market.lists(), d.market.lists(), 'the same coins for everyone');
});

// one run played the same way: the same seed and the same orders
function play(seed) {
  const run = createRun({ seed, mode: 'challenge', challenge: challengeById('double-up') });
  const out = [];
  const held = [];
  for (let k = 0; k < 6; k++) {
    ticks(run, 30);
    out.push(...run.drain());
    const id = curveCoin(run, new Set(held));
    if (id !== null) {
      run.order({ coin: id, side: 'buy', sol: 0.1, slippage: 0.3, priority: k % 2 ? 'turbo' : 'fast' });
      held.push(id);
    }
    if (k >= 2) run.order({ coin: held[k - 2], side: 'sell', frac: 0.5, slippage: 0.3, priority: 'fast' });
  }
  ticks(run, 40);
  out.push(...run.drain());
  return JSON.stringify([out, run.result(), run.hud(), run.progress()]);
}

test('the same seed and the same orders make the same run; another seed makes another', () => {
  const a = play('same-1');
  assert.equal(play('same-1'), a);
  assert.notEqual(play('same-2'), a);
  const ev = JSON.parse(a)[0];
  assert.ok(ev.filter((e) => e.type === 'fill').length >= 6, 'its orders filled');
});

// ---------- solprice.js ----------

const base = (usd, liq, chainId = 'solana') => ({
  chainId, baseToken: { address: WSOL }, quoteToken: { address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
  priceUsd: String(usd), liquidity: { usd: liq },
});
const quote = (usd, native, liq) => ({
  chainId: 'solana', baseToken: { address: 'Coin1111111111111111111111111111111111111111' }, quoteToken: { address: WSOL },
  priceUsd: String(usd), priceNative: String(native), liquidity: { usd: liq },
});

test("SOL's price from DexScreener's answer: the most liquid SOL pair, else a pair priced in SOL, never nonsense", () => {
  assert.equal(SOL_URL, `https://api.dexscreener.com/tokens/v1/solana/${WSOL}`);
  assert.equal(parseSolPrice([base(187.12, 5e6), base(190, 9e7), base(150, 1e3)]), 190);
  assert.equal(parseSolPrice({ pairs: [base(187.12, 5e6)] }), 187.12);
  assert.equal(parseSolPrice([base(187, 1e6, 'ethereum'), base(180, 10)]), 180, 'only Solana');
  assert.equal(parseSolPrice([base(0.5, 9e9), base(250000, 9e9), base('abc', 9e9), base(201, 1)]), 201, 'only sane');
  assert.equal(parseSolPrice([base(202, undefined), base(203, -5)]), 202, 'no liquidity counts as none');
  // priced in SOL: its token's dollars ÷ its SOL
  assert.equal(parseSolPrice([quote(0.002, 0.00001, 1e6)]), 200);
  near(parseSolPrice([quote(0.003, 0.00002, 1e5), quote(0.0019, 0.00001, 2e6)]), 190, 1e-9, 'the most liquid');
  assert.equal(parseSolPrice([quote(0.002, 0, 1e6), quote(0.002, 'x', 1e6)]), null, 'no price in SOL');
  assert.equal(parseSolPrice([quote(5, 0.00001, 1e6)]), null, 'never $500,000 a SOL');
  assert.equal(parseSolPrice([quote(0.002, 0.00001, 9e9), base(180, 1)]), 180, 'a SOL pair wins over one priced in SOL');
  for (const x of [null, undefined, 'x', 42, {}, { pairs: 'x' }, [], [null, 3, 'a', {}]]) assert.equal(parseSolPrice(x), null);
  assert.equal(saneUsd(SANE.min), true);
  assert.equal(saneUsd(SANE.max), true);
  assert.equal(saneUsd(SANE.min - 0.01), false);
  assert.equal(saneUsd(SANE.max + 1), false);
  assert.equal(saneUsd(NaN), false);
});

// a stand-in for localStorage
function store(init = {}) {
  const m = new Map(Object.entries(init));
  return {
    m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
  };
}
const answer = (data, ok = true) => async () => ({ ok, json: async () => data });

test("SOL's price for a run: live, else the one this browser kept, else $150; never throws, never waits long", async () => {
  const now = 1_800_000_000_000;
  // live: rounded to cents, kept for next time
  let asked = null;
  const s = store();
  const live = await getSolPrice({
    fetch: async (url, init) => {
      asked = { url, init };
      return { ok: true, json: async () => [base(187.1234, 1e6)] };
    },
    storage: s, now: () => now,
  });
  assert.deepEqual(live, { usd: 187.12, source: 'live', at: now });
  assert.equal(asked.url, SOL_URL);
  assert.equal(asked.init.headers.Accept, 'application/json');
  assert.ok(asked.init.signal, 'it can be given up');
  assert.deepEqual(JSON.parse(s.m.get(SAVE_KEY)), { usd: 187.12, at: now });

  // DexScreener down, refusing, odd or slow: what this browser kept
  const kept = store({ [SAVE_KEY]: JSON.stringify({ usd: 171.5, at: now - 3600e3 }) });
  for (const f of [answer([], true), answer([base(190, 1)], false), answer('nope'), async () => { throw new Error('down'); },
    async () => ({ ok: true, json: async () => { throw new Error('not json'); } })]) {
    assert.deepEqual(await getSolPrice({ fetch: f, storage: kept, now: () => now }),
      { usd: 171.5, source: 'saved', at: now - 3600e3 });
  }
  let signal = null;
  const t0 = Date.now();
  const slow = await getSolPrice({
    fetch: (url, init) => {
      signal = init.signal;
      return new Promise(() => {});
    },
    storage: kept, now: () => now, timeoutMs: 30,
  });
  assert.equal(slow.source, 'saved');
  assert.ok(Date.now() - t0 < 2000, 'given up on time');
  assert.equal(signal.aborted, true, 'and its request stopped');

  // nothing kept, or too old, from the future, broken, or storage that throws: $150
  const old = store({ [SAVE_KEY]: JSON.stringify({ usd: 171.5, at: now - SAVED_FOR_MS - 1 }) });
  const edge = store({ [SAVE_KEY]: JSON.stringify({ usd: 171.5, at: now - SAVED_FOR_MS }) });
  const future = store({ [SAVE_KEY]: JSON.stringify({ usd: 171.5, at: now + 61000 }) });
  const broken = store({ [SAVE_KEY]: '{nope' });
  const silly = store({ [SAVE_KEY]: JSON.stringify({ usd: 0.2, at: now }) });
  const throws = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(SAVED_FOR_MS, 30 * 24 * 3600 * 1000, 'kept 30 days');
  assert.deepEqual(readSaved(edge, now), { usd: 171.5, at: now - SAVED_FOR_MS }, '30 days to the millisecond');
  for (const st of [old, future, broken, silly, throws, null, store()]) {
    assert.equal(readSaved(st, now), null);
    assert.deepEqual(await getSolPrice({ fetch: answer([]), storage: st, now: () => now }),
      { usd: FALLBACK_USD, source: 'default', at: now });
  }
  assert.deepEqual(await getSolPrice({ fetch: null, storage: null, now: () => now }), { usd: 150, source: 'default', at: now });
  // a live price even where the browser keeps nothing
  assert.deepEqual(await getSolPrice({ fetch: answer([base(160, 1)]), storage: throws, now: () => now }),
    { usd: 160, source: 'live', at: now });
});

// ---------- lines.js ----------

// one of every event a run makes, as the run makes it
const order = (side, ticker = 'TKR') => ({ id: 1, coin: 3, ticker, side, status: 'filled' });
const EVENTS = [
  { type: 'start', mode: 'challenge' }, { type: 'start', mode: 'free' }, { type: 'start', mode: 'daily' },
  { type: 'fill', order: order('buy'), first: true }, { type: 'fill', order: order('buy'), first: false },
  { type: 'fill', order: order('sell'), pnl: 0.1, closed: true, total: 0.1 },
  { type: 'fill', order: order('sell'), pnl: -0.1, closed: true, total: -0.1 },
  { type: 'fill', order: order('sell'), pnl: 0, closed: false, total: 0 },
  { type: 'fail', order: order('buy'), reason: 'slippage' }, { type: 'fail', order: order('sell'), reason: 'migrating' },
  { type: 'fail', order: order('sell'), reason: 'no_liquidity' }, { type: 'fail', order: order('sell'), reason: 'no_tokens' },
  { type: 'rug', coin: 3, ticker: 'TKR' }, { type: 'migrating', coin: 3, ticker: 'TKR' },
  { type: 'migrated', coin: 3, ticker: 'TKR' }, { type: 'dev_sell', coin: 3, ticker: 'TKR', frac: 0.8 },
  { type: 'kol_buy', coin: 3, ticker: 'TKR', kol: 'degenqueen' }, { type: 'cto', coin: 3, ticker: 'TKR' },
  { type: 'dex_paid', coin: 3, ticker: 'TKR' },
  ...MILESTONES.map((x) => ({ type: 'milestone', x })), { type: 'down', x: 0.5 }, { type: 'close' },
  { type: 'last_minute' }, { type: 'countdown', s: 10 }, { type: 'idle' },
  { type: 'end', outcome: 'won' }, { type: 'end', outcome: 'lost', reason: 'time' }, { type: 'end', outcome: 'lost', reason: 'rug' },
  { type: 'end', outcome: 'busted' }, { type: 'end', outcome: 'cashed' }, { type: 'end', outcome: 'quit' },
];

test("AGI-1's lines: lowercase, PG-13, never a tip, play money now and then, and a line for everything a run says", () => {
  const keys = Object.keys(LINES);
  assert.ok(keys.length >= 30);
  for (const [key, lines] of Object.entries(LINES)) {
    assert.ok(Array.isArray(lines) && lines.length >= 1, key);
    assert.equal(new Set(lines).size, lines.length, `${key}: no line twice`);
    assert.ok(MOODS.includes(moodOf(key)), `${key}'s mood`);
    assert.ok(priorityOf(key) > 0, `${key}'s priority`);
    for (const l of lines) {
      assert.ok(l.length >= 5 && l.length <= 80, `${key}: "${l}"`);
      assert.doesNotMatch(l.replace(/\bSOL\b/g, '').replace(/\{\w+\}/g, ''), /[A-Z]/, `lowercase: "${l}"`);
      for (const [, name] of l.matchAll(/\{(\w+)\}/g)) assert.ok(['ticker', 'pnl', 'kol'].includes(name), `{${name}} in "${l}"`);
      assert.doesNotMatch(l, /https?:|www\.|\.com\b|@|\$/, `no links, handles or tickers of its own: "${l}"`);
      assert.doesNotMatch(l, /\b(you should|go buy|buy (it|this|now|more|the dip)|sell (it|now|this)|ape|send it|to the moon|guarantee|100x|financial advice|wagmi|lfg)\b/i,
        `never a tip: "${l}"`);
      assert.doesNotMatch(l, /\b(fuck|shit|bitch|sex|sexy|nsfw|ass|damn)\b/i, `PG-13: "${l}"`);
    }
  }
  assert.ok(keys.filter((k) => LINES[k].some((l) => l.includes('play money'))).length >= 3, 'play money, now and then');
  assert.equal(moodOf('nope'), 'neutral');
  assert.equal(priorityOf('nope'), 0);
  // the end of a run beats everything; a rug beats a sell; a sell beats a buy
  for (const k of ['won', 'lostTime', 'lostRug', 'busted', 'cashed', 'quit']) assert.equal(priorityOf(k), 100);
  assert.ok(priorityOf('rug') > priorityOf('sellWin') && priorityOf('sellWin') > priorityOf('buy'));
  assert.ok(priorityOf('x10') > priorityOf('x5') && priorityOf('x5') > priorityOf('x2') && priorityOf('x2') > priorityOf('x1_5'));

  // every event a run makes has its line (or nothing to say), with every word it needs filled in
  const said = new Set();
  for (const e of EVENTS) {
    const l = lineFor(e);
    assert.ok(l, JSON.stringify(e));
    assert.ok(LINES[l.key], `${e.type}: ${l.key}`);
    said.add(l.key);
    for (const line of LINES[l.key]) assert.doesNotMatch(fill(line, l.vars), /\{\w+\}/, `${l.key}: "${line}"`);
  }
  assert.deepEqual([...said].sort(), keys.slice().sort(), 'every one of her lines is for something a run says');
  assert.deepEqual(lineFor({ type: 'fill', order: order('buy', 'PEPE2'), first: true }), { key: 'firstBuy', vars: { ticker: '$PEPE2' } });
  assert.deepEqual(lineFor({ type: 'fill', order: order('sell'), pnl: 0.1 }).vars, { ticker: '$TKR', pnl: '+0.1 SOL' });
  assert.deepEqual(lineFor({ type: 'fill', order: order('sell'), pnl: 0.1 }, { currency: 'usd', solUsd: 150 }).vars.pnl, '+$15');
  assert.equal(lineFor({ type: 'fill', order: order('sell'), pnl: 0 }).key, 'sellLoss');
  assert.equal(lineFor({ type: 'rug' }).vars.ticker, 'that coin');
  assert.equal(lineFor({ type: 'fail', reason: 'migrating' }).vars.ticker, 'that coin');
  assert.deepEqual(lineFor({ type: 'kol_buy', ticker: 'X', kol: 'cryptobae' }).vars, { ticker: '$X', kol: '@cryptobae' });
  // nothing to say
  for (const e of [null, undefined, {}, { type: 7 }, { type: 'nope' }, { type: 'fill' }, { type: 'kol_buy', ticker: 'X' },
    { type: 'milestone', x: 4 }, { type: 'countdown', s: 9 }, { type: 'end', outcome: 'nope' }]) {
    assert.equal(lineFor(e), null, JSON.stringify(e));
  }
  assert.equal(fill('{ticker} and {who}', { ticker: '$A' }), '$A and {who}');
  assert.equal(fill('{ticker}', null), '{ticker}');
  assert.equal(fill('{ticker}', { ticker: 0 }), '0');
});

test('her voice: the event that matters most, one line at a time, never the same line twice in a row', () => {
  const rng = makeRng(seedOf('voice')).f;
  const v = createVoice({ rng, gap: 3.5, breath: 1.2 });
  assert.equal(v.hear([], 0), null);
  assert.equal(v.hear(null, 0), null);
  assert.equal(v.hear([{ type: 'nope' }, { type: 'countdown', s: 4 }], 0), null);
  // the one that matters most
  const buy = { type: 'fill', order: order('buy'), first: false };
  const rug = { type: 'rug', coin: 3, ticker: 'TKR' };
  const first = v.hear([buy, rug, { type: 'idle' }], 0);
  assert.equal(first.key, 'rug');
  assert.equal(first.mood, moodOf('rug'));
  assert.match(first.text, /\$TKR/);
  // a short breath for what matters (a sell: 1.2 s), her whole gap for the rest, none for the end of a run
  assert.equal(v.hear([buy], 1), null);
  assert.equal(v.hear([{ type: 'fill', order: order('sell'), pnl: 0.1 }], 1.1), null);
  assert.equal(v.hear([{ type: 'fill', order: order('sell'), pnl: 0.1 }], 1.2).key, 'sellWin');
  assert.equal(v.hear([buy], 4.6), null, 'not quite 3.5 s');
  assert.equal(v.hear([buy], 4.7).key, 'buy');
  assert.equal(v.hear([{ type: 'end', outcome: 'won' }], 4.7).key, 'won', 'the end always speaks');

  // each key's lines in a shuffled round, every line once a round, never the same line twice in a row
  const w = createVoice({ rng: makeRng(seedOf('rounds')).f, gap: 0 });
  const said = [];
  for (let i = 0; i < 400; i++) said.push(w.hear([buy], i).text);
  const all = LINES.buy.map((l) => fill(l, { ticker: '$TKR' }));
  for (let r = 0; r + all.length <= said.length; r += all.length) {
    assert.deepEqual(said.slice(r, r + all.length).sort(), all.slice().sort(), `round ${r / all.length}`);
  }
  for (let i = 1; i < said.length; i++) assert.notEqual(said[i], said[i - 1], `${i}`);
  // in dollars, in Phomo
  const usd = createVoice({ rng, currency: 'usd', solUsd: 200 });
  const won = usd.hear([{ type: 'fill', order: order('sell'), pnl: 0.25 }], 0);
  if (LINES.sellWin.some((l) => l.includes('{pnl}'))) {
    const again = [won.text];
    for (let i = 1; i < LINES.sellWin.length; i++) again.push(usd.hear([{ type: 'fill', order: order('sell'), pnl: 0.25 }], i * 10).text);
    assert.ok(again.some((t) => t.includes('+$50')), 'its P&L in dollars');
    assert.ok(again.every((t) => !t.includes('SOL')));
  }
  // any rng: a broken one is Math.random's
  assert.equal(createVoice({ rng: 5 }).hear([rug], 0).key, 'rug');

  // by default she's quieter: 7 s between everyday lines, 2.5 s before what matters, never a wait for the end of a run
  // (the game gives her real seconds, so a run at 4× never makes her talk more)
  assert.equal(VOICE_GAP, 7);
  assert.equal(VOICE_BREATH, 2.5);
  const q = createVoice({ rng: makeRng(seedOf('quiet')).f });
  const sell = { type: 'fill', order: order('sell'), pnl: 0.1 };
  assert.equal(q.hear([buy], 100).key, 'buy');
  assert.equal(q.hear([sell], 102.4), null, 'a sell 2.4 s later waits');
  assert.equal(q.hear([sell], 102.5).key, 'sellWin');
  assert.equal(q.hear([buy], 109.4), null, 'an everyday line 6.9 s later waits');
  assert.equal(q.hear([buy], 109.5).key, 'buy');
  assert.equal(q.hear([{ type: 'end', outcome: 'busted' }], 109.5).key, 'busted');
  // a breath is never longer than the gap
  const fast = createVoice({ rng, gap: 1, breath: 5 });
  assert.equal(fast.hear([buy], 0).key, 'buy');
  assert.equal(fast.hear([sell], 1).key, 'sellWin');
});

// ---------- terminals.js ----------

// WCAG's contrast between two colors
const lum = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => {
    const x = v / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

test("the six terminals: the owner's order, the safety note, their money and readable colors", () => {
  assert.equal(SAFETY_NOTE, 'Play money only. Not affiliated with any real trading terminal. This game never asks for a wallet.');
  assert.deepEqual(TERMINALS.map((t) => t.id), ['chat', 'scan', 'board', 'pro', 'social', 'clank']);
  assert.deepEqual([...TERMINAL_IDS], ['chat', 'scan', 'board', 'pro', 'social', 'clank']);
  // 2026-10-21: parody names (the owner's "use a parody names … instead of their current names like trench board"; the
  // owner's pick: sound-alikes), never a real terminal's own name (the check below)
  assert.deepEqual(TERMINALS.map((t) => t.name), ['BasedBott', 'GNGM', 'Pomp.fun', 'Axium', 'Phomo', 'Clank.trade']);
  assert.deepEqual(TERMINALS.map((t) => t.currency), [{ coin: 'eth', usd: 3000 }, 'sol', 'sol', 'sol', 'usd', 'usd']);
  assert.equal(DEFAULT_TERMINAL, 'board');
  assert.equal(terminalById('board').ready, true, 'Pomp.fun first');
  assert.equal(terminalById('nope'), null);
  assert.ok(Object.isFrozen(TERMINALS));
  for (const t of TERMINALS) {
    assert.equal(terminalById(t.id), t);
    assert.ok(Object.isFrozen(t) && Object.isFrozen(t.colors) && Object.isFrozen(t.features), `${t.id} frozen`);
    assert.ok(t.short.length >= 3 && t.short.length <= 12, `${t.id}'s short name`);
    assert.equal(typeof t.ready, 'boolean');
    assert.ok(t.tagline.length >= 10 && t.tagline.length <= 80, `${t.id}'s tagline`);
    assert.equal(t.features.length, 4);
    for (const k of ['bg', 'panel', 'line', 'text', 'muted', 'accent', 'up', 'down']) {
      assert.match(t.colors[k], /^#[0-9a-f]{6}$/, `${t.id}.${k}`);
    }
    for (const on of ['bg', 'panel']) {
      const c = t.colors;
      assert.ok(contrast(c.text, c[on]) >= 7, `${t.id}: text on ${on}`);
      for (const k of ['muted', 'accent', 'up', 'down']) assert.ok(contrast(c[k], c[on]) >= 4.5, `${t.id}: ${k} on ${on}`);
    }
    assert.notEqual(t.colors.up, t.colors.down);
  }
  // never a real terminal's (or another site's) name
  const words = JSON.stringify(TERMINALS) + SAFETY_NOTE + JSON.stringify(CHALLENGES) + JSON.stringify(LINES);
  assert.doesNotMatch(words,
    /based\s*bot(?!t)|gmgn|pump\.?fun|axiom|fomo|photon|bullx|trojan|maestro|banana\s*gun|bloom|padre|dexscreener|birdeye|phantom|raydium|jupiter|moonshot|bonk\.?fun|robinhood/i);
});

test("the parody brands: a mark and a wordmark for every terminal, shapes only, never a link, a picture or a real logo", async () => {
  const { BRANDS, brandOf, MARK_TAGS, markEl, wordEl } = await import('../src/games/trenchingsimulator/brands.js');
  assert.deepEqual(Object.keys(BRANDS).sort(), [...TERMINAL_IDS].sort());
  assert.equal(brandOf('nope'), null);
  const walk = (shape, seen) => {
    const [tag, attrs, kids] = shape;
    assert.ok(MARK_TAGS.includes(tag), `only shapes: ${tag}`);
    for (const [k, v] of Object.entries(attrs)) {
      assert.doesNotMatch(k, /^on|href|src|style/i, `no event, link, picture or style attribute: ${k}`);
      assert.doesNotMatch(String(v), /url\(|javascript:|https?:|data:/i, `${k}`);
    }
    seen.push(tag);
    if (kids) for (const kid of kids) walk(kid, seen);
  };
  for (const t of TERMINALS) {
    const b = brandOf(t.id);
    assert.equal(b.name, t.name, `${t.id}'s brand name`);
    assert.equal(b.word.map((w) => w.t).join('').toLowerCase(), t.name.toLowerCase(), `${t.id}'s wordmark spells its name`);
    for (const w of b.word) assert.ok(['main', 'accent'].includes(w.k));
    assert.match(b.view, /^0 0 \d+ \d+$/);
    const seen = [];
    for (const shape of b.shapes) walk(shape, seen);
    assert.ok(seen.length >= 3, `${t.id} has a mark`);
  }
  // in the page: a stand-in document
  const mk = (tag) => {
    const n = { tag, attrs: {}, kids: [], className: '', textContent: '' };
    n.setAttribute = (k, v) => { n.attrs[k] = v; };
    n.append = (...k) => n.kids.push(...k);
    return n;
  };
  const doc = { createElementNS: (ns, tag) => (assert.equal(ns, 'http://www.w3.org/2000/svg'), mk(tag)), createElement: mk };
  const had = globalThis.document;
  globalThis.document = doc;
  try {
    const m = markEl('scan');
    assert.equal(m.tag, 'svg');
    assert.equal(m.attrs['aria-hidden'], 'true');
    assert.equal(m.attrs.focusable, 'false');
    assert.equal(m.attrs['shape-rendering'], 'crispEdges', "GNGM's pixel toad stays crisp");
    assert.equal(markEl('board').attrs['shape-rendering'], undefined);
    assert.equal(markEl('board', 'tsb-logo').attrs.class, 'tsb-logo');
    const w = wordEl('board', 'tsb-brand-t');
    assert.equal(w.className, 'tsb-brand-t');
    assert.deepEqual(w.kids.map((k) => [k.className, k.textContent]), [['ts-word-main', 'pomp'], ['ts-word-accent', '.fun']]);
    assert.equal(wordEl('nope').kids.length, 0);
  } finally {
    if (had === undefined) delete globalThis.document;
    else globalThis.document = had;
  }
  // where they're used: the terminal cards and Pomp.fun's header; the name stays text, never a link
  const shell = readFileSync('src/games/trenchingsimulator/shell.js', 'utf8');
  const board = readFileSync('src/games/trenchingsimulator/boards/board.js', 'utf8');
  const menu = readFileSync('src/games/trenchingsimulator/menu.js', 'utf8');
  assert.match(menu, /markEl\(t\.id\), wordEl\(t\.id\)/);
  assert.match(board, /markEl\('board', 'tsb-logo'\), wordEl\('board', 'tsb-brand-t'\)/);
  assert.doesNotMatch(shell + board, /Trench (Board|Chat|Scan|Pro|Social)'/, 'the old names are gone from the page');
});

test('the save: settings, bests, the daily market and totals, kept in this browser only and never broken', async () => {
  const S = await import('../src/games/trenchingsimulator/save.js');
  const mem = new Map();
  const st = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)) };
  assert.deepEqual(S.loadSave(st), S.blank());
  assert.deepEqual(S.loadSave({ getItem() { throw new Error('blocked'); } }), S.blank());
  assert.equal(S.writeSave({ setItem() { throw new Error('full'); } }, S.blank()), false);
  mem.set(S.SAVE_KEY, '{not json');
  assert.deepEqual(S.loadSave(st), S.blank());
  const odd = S.cleanSave({ v: 1, terminal: 'evil', speed: 9, freeStart: 3, slippage: 0.33, priority: 'warp', muted: 'yes',
    best: { 'double-up': { stars: 9, time: -1 }, '<b>': { stars: 3 } }, daily: { nope: {}, '2026-10-20': { won: true, stars: 2 } } });
  assert.equal(odd.terminal, 'board');
  assert.equal(odd.speed, 1);
  assert.equal(odd.freeStart, 1);
  assert.equal(odd.slippage, 0.2);
  assert.equal(odd.priority, 'fast');
  assert.equal(odd.muted, false);
  assert.deepEqual(Object.keys(odd.best), ['double-up']);
  assert.equal(odd.best['double-up'].stars, 3);
  assert.equal(odd.best['double-up'].time, null);
  assert.deepEqual(Object.keys(odd.daily), ['2026-10-20']);
  assert.deepEqual(S.cleanSave({ v: 2, terminal: 'scan' }), S.blank());
  let s = S.blank();
  assert.equal(S.recordResult(s, { mode: 'free', outcome: 'quit', timeUsed: 0, placed: 0 }).stats.runs, 0);
  s = S.recordResult(s, { mode: 'challenge', challenge: 'double-up', outcome: 'won', stars: 2, timeUsed: 312, multiple: 2.04,
    filled: 7, coins: 3, placed: 7 });
  s = S.recordResult(s, { mode: 'challenge', challenge: 'double-up', outcome: 'won', stars: 1, timeUsed: 290, multiple: 2.5,
    placed: 4 });
  s = S.recordResult(s, { mode: 'challenge', challenge: 'double-up', outcome: 'lost', reason: 'time', stars: 0, timeUsed: 600,
    multiple: 0.9, placed: 2 });
  assert.deepEqual(s.best['double-up'], { stars: 2, time: 290, multiple: 2.5, runs: 3, wins: 2 });
  assert.deepEqual(s.stats, { runs: 3, wins: 2, trades: 7, coins: 3, bestX: 2.5 });
  assert.equal(S.starsTotal(s), 2);
  for (let d = 1; d <= S.DAILY_KEEP + 5; d++) {
    const key = `2026-11-${String(d).padStart(2, '0')}`;
    s = S.recordResult(s, { mode: 'daily', outcome: d === 3 ? 'won' : 'lost', stars: 1, timeUsed: 60, multiple: 1.1 },
      { dailyKey: d > 30 ? `2026-12-${String(d - 30).padStart(2, '0')}` : key });
  }
  assert.equal(Object.keys(s.daily).length, S.DAILY_KEEP);
  assert.ok(!('2026-11-01' in s.daily) && '2026-12-05' in s.daily);
  assert.ok(S.writeSave(st, s));
  assert.deepEqual(S.loadSave(st), S.cleanSave(s));
});

test('its posts for X: play money and made-up coins every time, never buy, never a real name, inside a post', async () => {
  const { shareText, shareLink, GAME_URL } = await import('../src/games/trenchingsimulator/share.js');
  const bad = /based\s*bot(?!t)|gmgn|pump\.?fun|axiom|fomo|photon|bullx|trojan|maestro|banana\s*gun|bloom|padre|dexscreener|birdeye|phantom|raydium|jupiter|moonshot|bonk\.?fun|robinhood|\bbuy\b|guarantee|financial/i;
  const runs = [
    { mode: 'challenge', challenge: 'double-up', outcome: 'won', stars: 3, start: 1, worth: 2.04, timeUsed: 192, multiple: 2.04 },
    { mode: 'challenge', challenge: 'ten-bagger', outcome: 'lost', reason: 'rug', start: 1, worth: 0.3, multiple: 0.3 },
    { mode: 'challenge', challenge: 'five-hundred', outcome: 'busted', start: 6.6, worth: 0, currency: 'usd', solUsd: 150 },
    { mode: 'daily', challenge: 'runner', daily: '2026-10-20', outcome: 'won', stars: 1, start: 2, worth: 3, timeUsed: 900 },
    { mode: 'free', outcome: 'cashed', start: 5, worth: 7.2, multiple: 1.44 },
    { mode: 'free', outcome: 'quit', start: 5, worth: 2.5, multiple: 0.5 },
    {},
  ];
  for (const r of runs) {
    const t = shareText(r);
    assert.match(t, /TRENCHING SIMULATOR/);
    assert.match(t, /play money, made-up coins/);
    assert.ok(!bad.test(t), t);
    assert.ok(t.length + 24 <= 280, t);
  }
  assert.match(shareText(runs[0]), /⭐⭐⭐/);
  assert.match(shareText(runs[4]), /\+44%/);
  assert.match(shareText(runs[5]), /−50%/);
  assert.equal(shareLink('a b'), `https://x.com/intent/tweet?text=a%20b&url=${encodeURIComponent(GAME_URL)}`);
  assert.equal(GAME_URL, 'https://agi1.app/games/trenchingsimulator');
});

test('the chart\'s sums: candles of any timeframe and round ticks', async () => {
  const { aggregate, niceTicks, TIMEFRAMES } = await import('../src/games/trenchingsimulator/chart.js');
  assert.deepEqual(TIMEFRAMES.map((t) => t.s), [1, 15, 60, 300]);
  const one = [{ t: 0, o: 1, h: 2, l: 1, c: 2, v: 1 }, { t: 7, o: 2, h: 5, l: 0.5, c: 3, v: 2 }, { t: 15, o: 3, h: 3, l: 3, c: 3, v: 4 }];
  assert.deepEqual(aggregate(one, 15), [{ t: 0, o: 1, h: 5, l: 0.5, c: 3, v: 3 }, { t: 15, o: 3, h: 3, l: 3, c: 3, v: 4 }]);
  assert.equal(aggregate(one, 1).length, 3);
  assert.deepEqual(aggregate([], 60), []);
  assert.deepEqual(niceTicks(0, 10, 5), [0, 2, 4, 6, 8, 10]);
  assert.deepEqual(niceTicks(4300, 9100, 4), [5000, 6000, 7000, 8000, 9000]);
  assert.deepEqual(niceTicks(5, 5), []);
  assert.deepEqual(niceTicks(NaN, 3), []);
});

test("the chart's clock: the time of day a candle stands for, HH:MM:SS under a minute and HH:MM from one", async () => {
  const { timeLabel, timeTicks } = await import('../src/games/trenchingsimulator/chart.js');
  const two = (n) => String(n).padStart(2, '0');
  // the page's own clock: read with the same Date methods, so this holds in any time zone
  const base = Date.UTC(2026, 9, 20, 12, 0, 0);
  const at = (t) => new Date(base + t * 1000);
  const hms = (d) => `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;
  const hm = (d) => `${two(d.getHours())}:${two(d.getMinutes())}`;
  for (const t of [0, 1, 59, 95, 3600, 86399]) {
    assert.equal(timeLabel(t, base, 1), hms(at(t)), `1s ${t}`);
    assert.equal(timeLabel(t, base, 15), hms(at(t)), `15s ${t}`);
    assert.equal(timeLabel(t, base, 60), hm(at(t)), `1m ${t}`);
    assert.equal(timeLabel(t, base, 300), hm(at(t)), `5m ${t}`);
  }
  // a candle from before the player arrived (the market's warm-up): still the time of day it was
  assert.equal(timeLabel(-600, base, 15), hms(at(-600)));
  assert.match(timeLabel(95, base, 15), /^\d\d:\d\d:\d\d$/);
  assert.match(timeLabel(95, base, 60), /^\d\d:\d\d$/);
  // without the page's clock: minutes and seconds from the run's start, a minus before it
  assert.equal(timeLabel(-90), '−1:30');
  assert.equal(timeLabel(-90, null, 60), '−1:30');
  assert.equal(timeLabel(0), '0:00');
  assert.equal(timeLabel(75), '1:15');
  assert.equal(timeLabel(-0.2), '0:00', 'never "−0:00"');
  assert.equal(timeLabel(5, NaN), '0:05');
  for (const bad of [NaN, Infinity, -Infinity, undefined, null, 'x']) assert.equal(timeLabel(bad, base), '', String(bad));
  assert.equal(timeLabel(1e20, base), '', 'past the last date there is');

  // which candles get one: the first past each round step, the steps far enough apart for their labels
  assert.deepEqual(timeTicks([], 15, 10, 60), []);
  assert.deepEqual(timeTicks([0, 15], 15, 0, 60), []);
  assert.deepEqual(timeTicks([0, 15], 0, 10, 60), []);
  assert.deepEqual(timeTicks(null, 15, 10, 60), []);
  const every15 = Array.from({ length: 80 }, (_, i) => i * 15);
  // 7 px a candle, 60 px a label: at least 128.6 s a label, so every 300 s (20 candles)
  assert.deepEqual(timeTicks(every15, 15, 7, 60), [0, 20, 40, 60]);
  // 30 px a candle: every 30 s (2 candles)
  assert.deepEqual(timeTicks(every15.slice(0, 8), 15, 30, 60), [0, 2, 4, 6]);
  // a gap in trading: the first candle after it starts the next label
  assert.deepEqual(timeTicks([0, 15, 30, 45, 60, 75, 90, 105, 240, 255], 15, 10, 50), [0, 8]);
  // a first candle that isn't on a step gets none
  assert.deepEqual(timeTicks([5, 20, 35, 125, 140], 15, 10, 50), [3]);
  // never two labels closer than their gap, whatever the candles
  const r = makeRng(seedOf('ticks')).f;
  for (let k = 0; k < 200; k++) {
    const span = [1, 15, 60, 300][k % 4];
    const ts = [];
    let t = Math.floor(r() * 5000) * span;
    for (let i = 0; i < 20 + Math.floor(r() * 200); i++) {
      ts.push(t);
      t += span * (r() < 0.1 ? 2 + Math.floor(r() * 30) : 1);
    }
    const cw = 2 + r() * 30;
    const gap = 40 + r() * 60;
    const out = timeTicks(ts, span, cw, gap);
    for (let i = 1; i < out.length; i++) assert.ok((out[i] - out[i - 1]) * cw >= gap, `${k}`);
  }
});

test('the chart on a stand-in canvas: dollars from market caps in SOL ($4.5K, never trillions), its clock times', async () => {
  const { createChart, timeLabel } = await import('../src/games/trenchingsimulator/chart.js');
  const saved = { window: globalThis.window, raf: globalThis.requestAnimationFrame, caf: globalThis.cancelAnimationFrame };
  const queue = [];
  globalThis.window = { devicePixelRatio: 2 };
  globalThis.requestAnimationFrame = (f) => queue.push(f);
  globalThis.cancelAnimationFrame = (id) => {
    if (queue[id - 1]) queue[id - 1] = null;
  };
  const flush = () => {
    while (queue.some(Boolean)) {
      const fs = queue.splice(0);
      for (const f of fs) if (f) f(0);
    }
  };
  let texts = [];
  const ctx = {
    setTransform() {}, fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, arc() {}, fill() {},
    setLineDash() {}, clearRect() {},
    fillText(t) {
      texts.push(String(t));
    },
    measureText: (t) => ({ width: String(t).length * 6.6 }),
  };
  const listeners = new Map();
  const canvas = {
    width: 0, height: 0,
    getContext: () => ctx,
    getBoundingClientRect: () => ({ width: 600, height: 300, left: 0, top: 0 }),
    addEventListener: (k, f) => listeners.set(k, f),
    removeEventListener: (k) => listeners.delete(k),
  };
  try {
    const chart = createChart(canvas, { tf: 15 });
    // sharp on a 2× screen
    assert.equal(canvas.width, 1200);
    assert.equal(canvas.height, 600);
    flush();
    assert.deepEqual(texts, ['waiting for the first trade…']);
    // a market cap of 30 SOL, a candle a second from the warm-up on (negative t), at $150 a SOL: $4.5K
    const base = Date.UTC(2026, 9, 20, 12, 0, 0);
    const candles = [];
    for (let t = -60; t < 120; t++) candles.push({ t, o: 30, h: 30.2, l: 29.8, c: 30, v: 1 + (t % 3) });
    const draw = (d) => {
      texts = [];
      chart.set(d);
      flush();
      return texts;
    };
    let tx = draw({ candles, solUsd: 150, tf: 15, base });
    assert.ok(tx.includes('$4.5K'), `its last price: ${tx.join(' | ')}`);
    const money = tx.filter((t) => t.startsWith('$'));
    assert.ok(money.length >= 3, money.join(' '));
    for (const t of money) {
      assert.match(t, /^\$4\.\d+K$/, `every price on its axis is about $4.5K: ${t}`);
      assert.ok(!/[TB]$/.test(t), t);
    }
    // its clock: the time of day of a candle that's there
    const want = new Set();
    for (let t = -60; t < 120; t += 15) want.add(timeLabel(t, base, 15));
    const clock = tx.filter((t) => /^\d\d:\d\d:\d\d$/.test(t));
    assert.ok(clock.length >= 2, tx.join(' | '));
    for (const t of clock) assert.ok(want.has(t), t);
    // a minute a candle: HH:MM
    tx = draw({ tf: 60 });
    assert.ok(tx.some((t) => /^\d\d:\d\d$/.test(t)), tx.join(' | '));
    assert.ok(!tx.some((t) => /^\d\d:\d\d:\d\d$/.test(t)));
    // no page clock: minutes and seconds from the start
    tx = draw({ tf: 15, base: null });
    assert.ok(tx.some((t) => /^−?\d+:\d\d$/.test(t)), tx.join(' | '));
    // SOL at $200: $6K; no price (or a broken one): $150's
    assert.ok(draw({ solUsd: 200, base }).includes('$6K'));
    for (const bad of [0, -5, NaN, null]) assert.ok(draw({ solUsd: bad }).includes('$4.5K'), String(bad));
    // the player's own buys and sells on their candles
    tx = draw({ solUsd: 150, marks: [{ t: 30, side: 'buy' }, { t: 60, side: 'sell' }, { t: 9999, side: 'buy' }] });
    assert.equal(tx.filter((t) => t === 'B').length, 1);
    assert.equal(tx.filter((t) => t === 'S').length, 1);
    // a crosshair under the pointer: its O/H/L/C in dollars
    listeners.get('pointermove')({ clientX: 100, clientY: 50 });
    texts = [];
    flush();
    assert.ok(texts.some((t) => /^O \$4\.5K {2}H \$4\.53K {2}L \$4\.47K {2}C \$4\.5K$/.test(t)), texts.join(' | '));
    listeners.get('pointerleave')();
    texts = [];
    flush();
    assert.ok(!texts.some((t) => t.startsWith('O ')));
    // nothing drawn when nothing changed
    texts = [];
    chart.redraw();
    chart.destroy();
    flush();
    assert.deepEqual(texts, []);
    assert.equal(listeners.size, 0);
  } finally {
    globalThis.window = saved.window;
    globalThis.requestAnimationFrame = saved.raf;
    globalThis.cancelAnimationFrame = saved.caf;
  }
});

test('her face in the corner: her 8-bit frame, her eyes for each mood, a mark, a blink, all inside its 25 pixels', async () => {
  const { facePixels, FACE } = await import('../src/games/trenchingsimulator/agi.js');
  const { PALETTE } = await import('../src/games/intro-sprite.js');
  const at = (px, x, y) => px.filter((p) => p[0] === x && p[1] === y).map((p) => p[2]).pop();
  const [[ex, ey]] = FACE.eyes;
  const x = ex - FACE.x;
  const y = ey - FACE.y;
  for (const mood of ['neutral', 'happy', 'love', 'celebrate', 'shy', 'hmm', 'worried', 'sad', 'wave', 'odd']) {
    const px = facePixels(mood);
    assert.ok(px.length > 300, mood);
    for (const [a, b, c] of px) assert.ok(a >= 0 && a < 25 && b >= 0 && b < 25 && /^#[0-9a-f]{6}$/.test(c), mood);
  }
  assert.equal(at(facePixels('neutral'), x, y), PALETTE.e);
  assert.notEqual(at(facePixels('happy'), x, y), PALETTE.e);
  assert.equal(at(facePixels('happy'), x, y - 1), PALETTE.e);
  assert.equal(at(facePixels('neutral', { blink: true }), x, y), PALETTE['6']);
  assert.equal(at(facePixels('love'), 20, 1), '#ff5c8a');
  assert.equal(at(facePixels('neutral'), 20, 1), undefined);
});

test('her words stay up as long as they take to read: about a second, 60 ms a character, 2.4 s to 5.2 s', async () => {
  const { talkMs, TALK } = await import('../src/games/trenchingsimulator/agi.js');
  assert.deepEqual({ ...TALK }, { min: 2400, max: 5200, base: 1000, perChar: 60 });
  assert.equal(talkMs('gm'), 2400, 'a short line: never under 2.4 s');
  assert.equal(talkMs('x'.repeat(30)), 2800);
  assert.equal(talkMs('x'.repeat(50)), 4000);
  assert.equal(talkMs('x'.repeat(400)), 5200, 'never over 5.2 s');
  // an emoji is one character to read, not two
  assert.equal(talkMs('💜'.repeat(30)), talkMs('x'.repeat(30)));
  for (const bad of ['', null, undefined]) assert.equal(talkMs(bad), 2400);
  // every one of her lines: between the two
  for (const lines of Object.values(LINES)) {
    for (const l of lines) {
      const ms = talkMs(fill(l, { ticker: '$TADPOL', pnl: '+0.25 SOL', kol: '@cryptobae', x: '3x' }));
      assert.ok(ms >= 2400 && ms <= 5200, l);
    }
  }
});

// ---------- boards/board.js: Pomp.fun's own helpers ----------

test("Pomp.fun's helpers: its sorts, quick buys by the run's start, amounts as typed, who traded, holders' tags", () => {
  // its five sorts, the way a launchpad board has them
  assert.deepEqual(SORTS.map(([id]) => id), ['bump', 'trending', 'new', 'stretch', 'migrated']);
  for (const [, label] of SORTS) assert.ok(typeof label === 'string' && label.length > 2);
  assert.ok(Object.isFrozen(SORTS));
  // quick buys: four, growing, never more than the run started with, never under the smallest buy
  const cases = [[1, [0.05, 0.1, 0.25, 0.5]], [1.5, [0.05, 0.1, 0.25, 0.5]], [5, [0.1, 0.25, 0.5, 1]], [6, [0.1, 0.25, 0.5, 1]],
    [10, [0.5, 1, 2, 5]], [20, [0.5, 1, 2, 5]], [100, [1, 5, 10, 25]]];
  for (const [start, want] of cases) {
    const got = buyPresets(start);
    assert.deepEqual(got, want, `start ${start}`);
    assert.ok(got.every((v, i) => v >= MIN_BUY && (i === 0 || v > got[i - 1]) && v <= start), `start ${start}`);
  }
  for (const bad of [0, -1, NaN, undefined, null, 'x']) assert.deepEqual(buyPresets(bad), [0.05, 0.1, 0.25, 0.5]);
  // an amount as typed: a dot or a comma, a leading or trailing dot; nothing else (no signs, exponents or hex)
  const amounts = [['1.5', 1.5], ['0,25', 0.25], ['.5', 0.5], ['2.', 2], [' 3 ', 3], ['10', 10]];
  for (const [t, v] of amounts) assert.equal(parseAmount(t), v, t);
  for (const t of ['', '  ', 'abc', '1.2.3', '-1', '+1', '1e3', '0x10', '1,5,0', 'Infinity', null, undefined]) {
    assert.ok(Number.isNaN(parseAmount(t)), String(t));
  }
  // who made a trade: words for every label the engine gives a trader, "someone" for the rest (never a raw label)
  const engineLabels = [...readFileSync('src/games/trenchingsimulator/engine.js', 'utf8')
    .match(/const LABEL = \{([^}]*)\}/)[1].matchAll(/: '([a-z]+)'/g)].map((m) => m[1]);
  assert.ok(engineLabels.includes('dev') && engineLabels.includes('regular'), 'the engine\'s labels were read');
  for (const l of [...engineLabels, 'me', 'mev']) {
    const w = whoText(l);
    assert.ok(typeof w === 'string' && w.length > 1, l);
    if (l === 'regular') assert.equal(w, 'someone');
    else assert.notEqual(w, 'someone', l);
  }
  assert.equal(whoText('me'), 'you');
  for (const bad of ['', 'toString', '__proto__', 'constructor', undefined, null, 7]) assert.equal(whoText(bad), 'someone');
  // a holder's tag: only the ones a trencher looks for (a caller shows by its name, you as "you")
  assert.equal(holderTag('dev'), 'dev');
  assert.equal(holderTag('smart'), 'smart wallet');
  for (const l of ['bundler', 'sniper', 'insider', 'whale']) assert.equal(holderTag(l), l);
  for (const l of ['kol', 'regular', 'me', 'mev', '', 'toString', '__proto__', undefined, null]) assert.equal(holderTag(l), '', String(l));
});

test("Pomp.fun's order errors: words for every reason the engine or the run can refuse an order", () => {
  const src = readFileSync('src/games/trenchingsimulator/engine.js', 'utf8') + readFileSync('src/games/trenchingsimulator/run.js', 'utf8');
  const codes = [...new Set([...src.matchAll(/error: '([a-z_]+)'/g)].map((m) => m[1]))].sort();
  assert.ok(codes.length >= 9, `the codes were read: ${codes}`);
  assert.deepEqual(Object.keys(ORDER_ERRORS).sort(), codes);
  for (const [k, words] of Object.entries(ORDER_ERRORS)) {
    assert.match(words, /^[A-Z].*[.:]?\S$/, k);
    assert.ok(!/\bbuy (more|now)\b|\bnot financial\b/i.test(words), k);
  }
  assert.ok(Object.isFrozen(ORDER_ERRORS));
});

// ---------- results.js ----------

const WON = Object.freeze({
  outcome: 'won', challenge: 'first-blood', mode: 'challenge', start: 1, worth: 2.31, multiple: 2.31, timeUsed: 522,
  seconds: 1800, pnl: 1.31, peak: 2.5, filled: 12, failed: 2, coins: 5, wins: 3, losses: 2,
  best: { ticker: 'FROG', emoji: '🐸', total: 0.42 }, worst: { ticker: 'RUG', emoji: '💀', total: -0.2 }, fees: 0.031,
  solUsd: 150, currency: 'sol', stars: 2,
});

test("a chain's own coin as a terminal's money (Live mode, the owner's \"Each chain's money\"): ETH and BNB at the run's prices", async () => {
  // 2026-10-21: Pomp.fun shows ETH on Robinhood Chain and Base, BNB on BNB Chain; the game counts in SOL underneath
  const ETH = { coin: 'eth', usd: 3000 };
  const BNB = { coin: 'bnb', usd: 600 };
  assert.deepEqual(F.unitOf('sol', 150), { id: 'sol', name: 'SOL', per: 1 });
  assert.deepEqual(F.unitOf('usd', 150), { id: 'usd', name: 'USD', per: 150 });
  assert.deepEqual(F.unitOf(ETH, 150), { id: 'eth', name: 'ETH', per: 0.05 });
  assert.deepEqual(F.unitOf(BNB, 150), { id: 'bnb', name: 'BNB', per: 0.25 });
  for (const bad of [{ coin: 'eth' }, { coin: 'eth', usd: 0 }, { coin: 'doge', usd: 1 }, 'eth', null, undefined, 7]) {
    assert.equal(F.isCoinCurrency(bad), false, JSON.stringify(bad));
    assert.equal(F.unitOf(bad, 150).id, 'sol', JSON.stringify(bad));
    assert.equal(F.currencyOf(bad), 'sol');
  }
  assert.equal(F.currencyOf('usd'), 'usd');
  assert.equal(F.currencyOf(ETH), ETH);
  // amounts in it
  assert.equal(F.money(1, ETH, 150), '0.05 ETH');
  assert.equal(F.money(2, BNB, 150), '0.5 BNB');
  assert.equal(F.money(1, ETH, 150, { unit: false }), '0.05');
  assert.equal(F.moneySigned(-0.1, ETH, 150), '−0.005 ETH');
  assert.equal(F.moneySigned(0.4, BNB, 150), '+0.1 BNB');
  assert.equal(F.money(NaN, ETH, 150), '—');
  // SOL and dollars exactly as before
  assert.equal(F.money(1.5, 'sol', 150), '1.5 SOL');
  assert.equal(F.moneySigned(0.123, 'sol', 150), '+0.123 SOL');
  // round amounts, two significant figures
  assert.deepEqual([0.0404, 0.202, 4.04, 0.176, 2.5, 0.0123].map(F.nice), [0.04, 0.2, 4, 0.18, 2.5, 0.012]);
  // a challenge's SOL start: a round amount of the coin (here 1 SOL is exactly 0.05 ETH); a dollar start as it is
  const c = (id) => challengeById(id);
  assert.equal(startSolFor(c('double-up'), 150, ETH), 1);
  assert.equal(startText(c('double-up'), ETH, 150), '0.05 ETH');
  assert.equal(goalText(c('double-up'), ETH, 150), 'Turn 0.05 ETH into 0.1 ETH (2x)');
  assert.equal(goalText(c('first-blood'), BNB, 150), 'Finish above 0.25 BNB: any profit counts');
  assert.equal(goalText(c('five-hundred'), ETH, 150), 'Make $500 profit (about 0.1667 ETH)');
  near(startSolFor(c('five-hundred'), 150, ETH), 1000 / 150, 1e-12, 'a dollar start: the same in any money');
  // at today's kind of prices: 1 SOL is 0.0405 ETH, so 0.04 ETH; the run starts with that in SOL
  const eth = { coin: 'eth', usd: 2612.46 };
  near(startSolFor(c('double-up'), 105.73, eth), 0.04 * 2612.46 / 105.73, 1e-12);
  assert.equal(startText(c('double-up'), eth, 105.73), '0.04 ETH');
  assert.equal(goalText(c('ten-bagger'), eth, 105.73), 'Turn 0.04 ETH into 0.4 ETH (10x)');
  assert.equal(startText(c('whale'), eth, 105.73), '4 ETH');
  // Free play's starts the same way
  assert.deepEqual(FREE_STARTS.map((v) => F.money(freeStartSol(v, eth, 105.73), eth, 105.73)), ['0.04 ETH', '0.2 ETH', '0.4 ETH', '2 ETH']);
  assert.deepEqual(FREE_STARTS.map((v) => freeStartSol(v, 'sol', 105.73)), [1, 5, 10, 50]);
  assert.deepEqual(FREE_STARTS.map((v) => freeStartSol(v, 'usd', 105.73)), [1, 5, 10, 50]);
  // a run in ETH: its start in SOL for the engine, its goal's words, its result's money
  const run = createRun({ seed: 'eth-run', challenge: c('double-up'), mode: 'challenge', solUsd: 105.73, currency: eth });
  near(run.start, 0.04 * 2612.46 / 105.73, 1e-9);
  assert.deepEqual(run.currency, eth);
  assert.match(run.progress().label, / ETH \/ 0\.08 ETH$/);
  const res = { ...WON, start: run.start, worth: run.start * 2, multiple: 2, currency: eth, solUsd: 105.73 };
  assert.equal(resultLine(res), '0.04 ETH → 0.08 ETH (2x) in 08:42');
  const rows = Object.fromEntries(statLines(res).map((r) => [r.label, r.value]));
  assert.equal(rows['ETH price'], `${F.usd(2612.46)} (frozen for this run)`);
  assert.equal(Object.hasOwn(rows, 'SOL price'), false, 'native results show the native quote, not the engine conversion unit');
  assert.match(rows.Profit, / ETH$/);
  const { shareText } = await import('../src/games/trenchingsimulator/share.js');
  assert.match(shareText(res), /0\.04 ETH → 0\.08 ETH/);
  // a result's currency as saved: nonsense is SOL
  assert.equal(resultLine({ start: 1, worth: 2, currency: { coin: 'doge', usd: 1 } }), '1 SOL → 2 SOL');
});

test('races preserve identical underlying funds and fills across display currencies without changing solo rounding', () => {
  const px = 94.32, eth = { coin: 'eth', usd: 3000 }, challenge = challengeById('double-up');
  const options = { seed: 'race-native-fairness', challenge, mode: 'challenge', solUsd: px, realTime: true,
    exactStart: true, config: { warmup: 60 } };
  const runs = ['sol', 'usd', eth, { coin: 'bnb', usd: 643.27 }].map(currency => createRun({ ...options, currency }));
  for (const run of runs) {
    assert.equal(run.start, 1);
    assert.equal(run.market.player.sol, 1);
    const coin = run.market.lists({ limit: 1 }).new[0].id;
    assert.equal(run.order({ coin, side: 'buy', sol: 0.1, slippage: 0.5 }).ok, true);
    for (let i = 0; i < 12; i++) run.tick(0.5);
  }
  for (const run of runs.slice(1)) {
    assert.deepEqual(run.market.player, runs[0].market.player, 'currency cannot change the race portfolio');
    assert.deepEqual(run.market.orders(), runs[0].market.orders(), 'identical race trades fill identically');
    assert.equal(run.progress().frac, runs[0].progress().frac);
  }
  const solo = createRun({ ...options, currency: eth, exactStart: false });
  assert.equal(F.money(solo.start, eth, px), '0.031 ETH');
  assert.notEqual(solo.start, 1, 'solo native-coin starts keep their convenient rounded size');
  const dollars = challengeById('five-hundred');
  for (const currency of ['sol', 'usd', eth]) assert.equal(startSolFor(dollars, px, currency, { exactStart: true }), 1000 / px);
});

test('race start and goal labels describe exact funding in the chosen display coin', () => {
  const challenge = challengeById('double-up'), px = 94.32, eth = { coin: 'eth', usd: 3000 }, options = { exactStart: true };
  const actual = startSolFor(challenge, px, eth, options);
  assert.equal(actual, 1);
  assert.equal(startText(challenge, eth, px, options), '0.0314 ETH');
  assert.equal(goalText(challenge, eth, px, options), 'Turn 0.0314 ETH into 0.0629 ETH (2x)');
  assert.equal(startText(challenge, eth, px, options), F.money(actual, eth, px));
  assert.equal(startText(challenge, eth, px), '0.031 ETH');
  assert.equal(goalText(challenge, eth, px), 'Turn 0.031 ETH into 0.062 ETH (2x)');
});

test('all nine live chains keep their native denomination through challenge goals, run progress and results', async () => {
  const { liveMoney } = await import('../src/games/trenchingsimulator/live-chains.js');
  const px = { sol: 150, eth: 3000, bnb: 600, mon: 0.02, hype: 25, trx: 0.3 };
  const cases = [
    ['solana', '1 SOL', '2 SOL'], ['robinhood', '0.05 ETH', '0.1 ETH'], ['bnb', '0.25 BNB', '0.5 BNB'],
    ['base', '0.05 ETH', '0.1 ETH'], ['ethereum', '0.05 ETH', '0.1 ETH'], ['monad', '7,500 MON', '15,000 MON'],
    ['hyperevm', '6 HYPE', '12 HYPE'], ['arbitrum', '0.05 ETH', '0.1 ETH'], ['tron', '500 TRX', '1,000 TRX'],
  ];
  for (const terminal of ['board', 'scan']) {
    for (const [chain, start, goal] of cases) {
      const currency = liveMoney(terminal, chain, px);
      const ch = challengeById('double-up');
      assert.equal(startText(ch, currency, px.sol), start, `${terminal}/${chain} start`);
      assert.equal(goalText(ch, currency, px.sol), `Turn ${start} into ${goal} (2x)`, `${terminal}/${chain} goal`);
      const run = createRun({ seed: `native-${terminal}-${chain}`, challenge: ch, mode: 'challenge',
        currency, solUsd: px.sol, terminal, live: chain });
      near(run.start, 1, 1e-12, `${chain}: native money retains the same dollar value`);
      assert.equal(run.progress().label, `${start} / ${goal}`, `${terminal}/${chain} progress`);
      const result = { ...run.result(), worth: 2, pnl: 1, multiple: 2, timeUsed: 60 };
      assert.equal(resultLine(result), `${start} → ${goal} (2x) in 01:00`, `${terminal}/${chain} result`);
      assert.equal(statLines(result).find((row) => row.label === 'Profit').value, `+${start}`, `${terminal}/${chain} profit`);
    }
  }
});

test("a run's results: its title and color for every ending, what it was, and its line in the terminal's money", () => {
  assert.equal(resultTitle(WON), TITLES.won);
  assert.equal(resultTitle({ outcome: 'lost', reason: 'rug' }), TITLES.rug);
  assert.equal(resultTitle({ outcome: 'lost', reason: 'time' }), TITLES.time);
  assert.equal(resultTitle({ outcome: 'busted' }), TITLES.busted);
  assert.equal(resultTitle({ outcome: 'cashed' }), TITLES.cashed);
  for (const r of [{ outcome: 'quit' }, {}, null, undefined, 'won']) assert.equal(resultTitle(r), TITLES.quit);
  assert.ok(Object.isFrozen(TITLES));
  // its color: a win up, a loss down, else by where it ended
  assert.equal(resultTone(WON), 'up');
  assert.equal(resultTone({ outcome: 'lost', multiple: 3 }), 'down');
  assert.equal(resultTone({ outcome: 'busted' }), 'down');
  assert.equal(resultTone({ outcome: 'cashed', multiple: 1.2 }), 'up');
  assert.equal(resultTone({ outcome: 'cashed', multiple: 1 }), 'up');
  assert.equal(resultTone({ outcome: 'cashed', multiple: 0.8 }), 'down');
  assert.equal(resultTone({ outcome: 'quit' }), 'down');
  assert.equal(resultTone(null), 'down');
  // what it was
  assert.equal(modeLabel(WON), 'First blood');
  assert.equal(modeLabel({ mode: 'daily', daily: '2026-10-20', challenge: 'double-up' }), 'Daily market · 2026-10-20 · Double up');
  assert.equal(modeLabel({ mode: 'daily', daily: '2026-10-20' }), 'Daily market · 2026-10-20');
  for (const r of [{ challenge: 'nope' }, { mode: 'free' }, {}, null]) assert.equal(modeLabel(r), 'Free play');
  // its line: SOL, or dollars at the run's own SOL price (the engine counts in SOL)
  assert.equal(resultLine(WON), '1 SOL → 2.31 SOL (2.31x) in 08:42');
  assert.equal(resultLine({ start: 100, worth: 600, currency: 'usd', solUsd: 200, multiple: 6, timeUsed: 61 }), '$20K → $120K (6x) in 01:01');
  assert.equal(resultLine({ start: 1, worth: 0.5 }), '1 SOL → 0.5 SOL');
});

test("a run's numbers, stars, card and line drawn small", () => {
  const rows = statLines(WON);
  assert.deepEqual(rows.map((r) => r.label), ['Profit', 'Peak', 'Time', 'Orders', 'Coins traded', 'Wins / losses', 'Best trade',
    'Worst trade', 'Fees paid', 'SOL price']);
  const by = Object.fromEntries(rows.map((r) => [r.label, r]));
  assert.deepEqual(by.Profit, { label: 'Profit', value: '+1.31 SOL', tone: 'up' });
  assert.equal(by.Time.value, '08:42 of 30:00');
  assert.equal(by.Orders.value, '12 filled · 2 failed');
  assert.equal(by['Best trade'].value, '🐸 $FROG +0.42 SOL');
  assert.equal(by['Best trade'].tone, 'up');
  assert.equal(by['Worst trade'].tone, 'down');
  assert.equal(by['SOL price'].value, '$150 (frozen for this run)');
  // its fees: the one number run.result() gives, and what sandwich bots took beside it (never added to the fees)
  assert.equal(by['Fees paid'].value, '0.031 SOL');
  const bots = Object.fromEntries(statLines({ ...WON, mev: 0.012 }).map((r) => [r.label, r.value]));
  assert.equal(bots['Fees paid'], '0.031 SOL · 0.012 SOL lost to bots');
  const botsUsd = Object.fromEntries(statLines({ ...WON, mev: 0.012, currency: 'usd' }).map((r) => [r.label, r.value]));
  assert.equal(botsUsd['Fees paid'], '$4.65 · $1.8 lost to bots', "in dollars at the run's own SOL price");
  for (const mev of [0, -1, NaN, '0.5', null]) {
    assert.equal(Object.fromEntries(statLines({ ...WON, mev }).map((r) => [r.label, r.value]))['Fees paid'], '0.031 SOL', String(mev));
  }
  // one trade is both best and worst: shown once, on its own side (a loss is never "best", a win never "worst")
  const lone = (total) => Object.fromEntries(statLines({ ...WON, best: { id: 7, ticker: 'CLOO', emoji: '👾', total },
    worst: { id: 7, ticker: 'CLOO', emoji: '👾', total } }).map((r) => [r.label, r.value]));
  assert.deepEqual([lone(-0.0061)['Best trade'], lone(-0.0061)['Worst trade']], ['—', '👾 $CLOO −0.0061 SOL']);
  assert.deepEqual([lone(0.42)['Best trade'], lone(0.42)['Worst trade']], ['👾 $CLOO +0.42 SOL', '—']);
  assert.deepEqual([lone(0)['Best trade'], lone(0)['Worst trade']], ['👾 $CLOO 0 SOL', '—']);
  const two = Object.fromEntries(statLines({ ...WON, best: { id: 1, ticker: 'A', total: -0.1 }, worst: { id: 2, ticker: 'B', total: -0.3 } })
    .map((r) => [r.label, r.value]));
  assert.deepEqual([two['Best trade'], two['Worst trade']], ['🪙 $A −0.1 SOL', '🪙 $B −0.3 SOL'], 'two losses: the smaller is best');
  // an older result whose fees were the engine's object: never "[object Object]" or NaN
  assert.equal(Object.fromEntries(statLines({ ...WON, fees: { terminal: 0.01 } }).map((r) => [r.label, r.value]))['Fees paid'], '0 SOL');
  // free play (no time limit), nothing failed, no trades, no price: still all ten, never NaN or undefined
  const empty = statLines({ timeUsed: 75 });
  assert.equal(empty.length, 10);
  assert.ok(empty.every((r) => typeof r.value === 'string' && !/NaN|undefined/.test(r.value)), JSON.stringify(empty));
  assert.equal(empty.find((r) => r.label === 'Orders').value, '0 filled');
  assert.equal(empty.find((r) => r.label === 'Time').value, '01:15');
  assert.equal(empty.find((r) => r.label === 'Best trade').value, '—');
  assert.equal(statLines(null).length, 10);
  // stars out of three
  assert.deepEqual([0, 1, 2, 3, 5, -1, NaN, 2.9, undefined].map(starsRow), ['☆☆☆', '★☆☆', '★★☆', '★★★', '★★★', '☆☆☆', '☆☆☆', '★★☆', '☆☆☆']);
  // the share card's words: play money, never "buy"; stars only for a win
  const card = cardText(WON);
  assert.deepEqual(card, {
    kicker: 'TRENCHING SIMULATOR · First blood', title: 'Challenge complete', big: '2.31x', line: '1 SOL → 2.31 SOL',
    sub: '+1.31 SOL · 08:42', stars: '★★☆', foot: 'Play money, made-up coins · agi1.app/games/trenchingsimulator', tone: 'up',
  });
  assert.equal(cardText({ ...WON, outcome: 'cashed' }).stars, '');
  assert.equal(cardText({ outcome: 'busted' }).big, '—');
  for (const c of [card, cardText({}), cardText({ outcome: 'lost', reason: 'rug' })]) {
    assert.ok(!/\bbuy\b/i.test(Object.values(c).join(' ')), JSON.stringify(c));
  }
});

test("a run's worth drawn as a line: at most 200 points, its spikes and dips kept, inside its box", () => {
  // few enough: the same points (a copy), bad ones dropped
  const few = [{ t: 0, v: 1 }, { t: 1, v: 2 }, { t: 2, v: NaN }, null, { t: 3, v: 1.5 }];
  const kept = downsample(few);
  assert.deepEqual(kept, [{ t: 0, v: 1 }, { t: 1, v: 2 }, { t: 3, v: 1.5 }]);
  assert.notEqual(downsample(kept), kept);
  assert.deepEqual(downsample('x'), []);
  // many: at most the cap, the first and the last, the highest and the lowest, in time order
  const many = Array.from({ length: 10000 }, (_, i) => ({ t: i, v: 1 + Math.sin(i / 300) * 0.1 }));
  many[5000] = { t: 5000, v: 9 };
  many[7000] = { t: 7000, v: 0.01 };
  for (const cap of [200, 50, 4, 1]) {
    const d = downsample(many, cap);
    assert.ok(d.length <= Math.max(4, cap), `cap ${cap}: ${d.length}`);
    assert.equal(d[0], many[0]);
    assert.equal(d[d.length - 1], many[many.length - 1]);
    assert.ok(d.some((q) => q.v === 9) && d.some((q) => q.v === 0.01), `cap ${cap}: its spike and its dip`);
    for (let i = 1; i < d.length; i++) assert.ok(d[i].t > d[i - 1].t, `cap ${cap}: in time order`);
  }
  // the path: nothing for nothing; one point a flat line; two points exactly; inside its box; the start's level in range
  assert.equal(sparkPath([]), null);
  const one = sparkPath([{ t: 5, v: 2 }], { w: 100, h: 50, pad: 5 });
  assert.equal(one.n, 2);
  assert.equal(one.d, 'M5 25 L95 25');
  assert.deepEqual(sparkPath([{ t: 0, v: 1 }, { t: 1, v: 2 }], { w: 100, h: 50, pad: 5 }),
    { d: 'M5 45 L95 5', area: 'M5 45 L95 5 L95 45 L5 45 Z', baseY: 45, up: true, lo: 1, hi: 2, n: 2 });
  const down = sparkPath([{ t: 0, v: 3 }, { t: 1, v: 2 }], { w: 100, h: 50, pad: 5, base: 4 });
  assert.equal(down.up, false);
  assert.equal(down.hi, 4);
  assert.equal(down.baseY, 5);
  // a small move draws as a small move: the range is at least 5% of where it started (a 0.4% dip, not a crash);
  // minSpan 0 draws it edge to edge, as before; a big move is never squeezed
  const small = [{ t: 0, v: 1 }, { t: 1, v: 0.996 }];
  const dip = sparkPath(small, { w: 100, h: 50, pad: 5 });
  near(dip.lo, 0.973, 1e-9, 'its range, centered on the move');
  near(dip.hi, 1.023, 1e-9);
  assert.equal(dip.d, 'M5 23.4 L95 26.6');
  assert.equal(dip.baseY, 23.4);
  assert.equal(dip.up, false);
  assert.equal(sparkPath(small, { w: 100, h: 50, pad: 5, minSpan: 0 }).d, 'M5 5 L95 45');
  const wide = sparkPath(small, { w: 100, h: 50, pad: 5, minSpan: 0.5 });
  near(wide.hi - wide.lo, 0.5, 1e-9, 'a wider minimum, asked for');
  const flat = sparkPath([{ t: 0, v: 3 }, { t: 9, v: 3 }], { w: 100, h: 50, pad: 5 });
  assert.equal(flat.d, 'M5 25 L95 25', 'a flat run in the middle');
  const moved = sparkPath([{ t: 0, v: 1 }, { t: 1, v: 1.2 }], { w: 100, h: 50, pad: 5 });
  assert.deepEqual([moved.lo, moved.hi, moved.d], [1, 1.2, 'M5 45 L95 5'], 'a 20% move fills its box');
  const big = sparkPath(many, { w: 600, h: 160, pad: 6 });
  assert.ok(big.n <= 200);
  for (const [, x, y] of big.d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)) {
    assert.ok(Number(x) >= 6 && Number(x) <= 594 && Number(y) >= 6 && Number(y) <= 154, `${x} ${y}`);
  }
});

// ---------- boards/gngm-data.js: GNGM's numbers (2026-10-22) ----------

test("GNGM's chart sums: candles with their buys and sells, a price or a market cap in dollars or the run's coin, its labels", async () => {
  const G = await import('../src/games/trenchingsimulator/boards/gngm-data.js');
  assert.deepEqual(G.GTF.map((x) => x.s), [1, 15, 30, 60, 300, 900]);
  assert.deepEqual(G.GTF.map((x) => x.id), ['1s', '15s', '30s', '1m', '5m', '15m']);
  const c1 = [
    { t: 0, o: 30, h: 31, l: 29, c: 30.5, v: 1, b: 1, s: 0 },
    { t: 1, o: 30.5, h: 33, l: 30, c: 32, v: 2, b: 2, s: 1 },
    { t: 15, o: 32, h: 32, l: 28, c: 28, v: 0.5, b: 0, s: 1 },
  ];
  assert.deepEqual(G.aggregate(c1, 15), [
    { t: 0, o: 30, h: 33, l: 29, c: 32, v: 3, b: 3, s: 1 },
    { t: 15, o: 32, h: 32, l: 28, c: 28, v: 0.5, b: 0, s: 1 },
  ]);
  assert.equal(G.aggregate(c1, 1).length, 3);
  assert.deepEqual(G.aggregate(null, 15), []);
  assert.equal(c1[0].h, 31, 'its candles are never changed');
  // a market cap of 30 SOL at $150: $4,500, a token $0.0000045; in SOL 30; in ETH at 0.05 ETH a SOL, 1.5
  assert.equal(G.valueOf(30, { mode: 'mcap', unit: 'usd', solUsd: 150 }), 4500);
  near(G.valueOf(30, { mode: 'price', unit: 'usd', solUsd: 150 }), 4.5e-6, 1e-15, 'a token in dollars');
  assert.equal(G.valueOf(30, { mode: 'mcap', unit: 'coin', solUsd: 150 }), 30);
  assert.equal(G.valueOf(30, { mode: 'mcap', unit: 'coin', solUsd: 150, per: 0.05 }), 1.5);
  assert.equal(G.formatterFor('mcap', 'usd')(4500), '$4.5K');
  assert.equal(G.formatterFor('price', 'usd')(4.5e-6), '$0.0₅45');
  assert.equal(G.formatterFor('mcap', 'coin')(1234), '1.23K');
  assert.equal(G.formatterFor('price', 'coin')(3e-8), '0.0₇3');
  // its indicators: moving averages, RSI (Wilder's) and MACD, null until they're there
  const xs = [1, 2, 3, 4, 5, 6];
  assert.deepEqual(G.sma(xs, 3), [null, null, 2, 3, 4, 5]);
  assert.deepEqual(G.ema(xs, 3), [null, null, 2, 3, 4, 5]);
  assert.deepEqual(G.ema([1, 2], 3), [null, null]);
  assert.deepEqual(G.sma(xs, 0), [null, null, null, null, null, null]);
  const r2 = G.rsi([1, 2, 1, 2, 1], 2);
  assert.deepEqual(r2.slice(0, 2), [null, null]);
  for (const [i, want] of [[2, 50], [3, 75], [4, 37.5]]) near(r2[i], want, 1e-9, `RSI at ${i}`);
  const up = G.rsi(Array.from({ length: 16 }, (_, i) => i + 1), 14);
  assert.deepEqual([up[13], up[14], up[15]], [null, 100, 100]);
  assert.equal(G.rsi(Array.from({ length: 16 }, (_, i) => 20 - i), 14)[15], 0);
  assert.equal(G.rsi(Array(16).fill(3), 14)[15], 50);
  const md = G.macd(xs, 2, 3, 2);
  assert.deepEqual(md.line.slice(0, 2), [null, null]);
  for (let i = 2; i < 6; i++) near(md.line[i], 0.5, 1e-9, `MACD at ${i}`);
  assert.deepEqual(md.signal.slice(0, 3), [null, null, null]);
  for (let i = 3; i < 6; i++) {
    near(md.signal[i], 0.5, 1e-9, `its signal at ${i}`);
    near(md.hist[i], 0, 1e-9, `its histogram at ${i}`);
  }
  assert.deepEqual(G.INDICATORS.map(([k]) => k), ['ma', 'ema', 'rsi', 'macd']);
});

// (2026-10-22: GNGM's chart is TradingView Lightweight Charts™ 5.2.1. It needs a page, so here it runs on a stand-in of
// the library that keeps what the chart asks of it: its options, its series and their data, its panes, its markers and
// primitive, its crosshair, its time scale)
function standInCharts() {
  const charts = [];
  const def = (type) => Object.freeze({ type });
  function createChart(host, options) {
    const c = { host, options, series: [], panes: [{ stretch: 1 }], handlers: new Set(), removed: false, ts: { barSpacing: options.timeScale.barSpacing, toNow: 0 } };
    const paneOf = (s) => c.panes.indexOf(s.paneRef);
    const add = (d, o = {}, pane = 0) => {
      while (c.panes.length <= pane) c.panes.push({ stretch: 1 });
      const s = { type: d.type, opts: { ...o }, paneRef: c.panes[pane], sets: 0, data: null, updates: [], applied: [], scale: [], prims: [], lines: [] };
      s.setData = (x) => {
        s.sets += 1;
        s.data = x;
      };
      s.update = (p) => s.updates.push(p);
      s.applyOptions = (o2) => s.applied.push(o2);
      s.priceScale = () => ({ applyOptions: (o2) => s.scale.push(o2) });
      s.createPriceLine = (o2) => s.lines.push(o2);
      s.priceToCoordinate = () => 100;
      s.attachPrimitive = (p) => {
        s.prims.push(p);
        p.attached({ chart: api, series: s, requestUpdate: () => {} });
      };
      s.detachPrimitive = (p) => {
        s.prims = s.prims.filter((x) => x !== p);
        p.detached();
      };
      c.series.push(s);
      return s;
    };
    const paneApi = (p) => ({ addSeries: (d, o) => add(d, o, c.panes.indexOf(p)), setStretchFactor: (f) => { p.stretch = f; } });
    const api = {
      addSeries: (d, o, pane = 0) => add(d, o, pane),
      addPane: () => {
        const p = { stretch: 1 };
        c.panes.push(p);
        return paneApi(p);
      },
      panes: () => c.panes.map(paneApi),
      // (like the library: a pane goes with its last series)
      removeSeries: (s) => {
        s.removed = true;
        c.series = c.series.filter((x) => x !== s);
        c.panes = c.panes.filter((p, i) => i === 0 || c.series.some((x) => x.paneRef === p));
      },
      subscribeCrosshairMove: (h) => c.handlers.add(h),
      unsubscribeCrosshairMove: (h) => c.handlers.delete(h),
      timeScale: () => ({ applyOptions: (o) => Object.assign(c.ts, o), options: () => ({ barSpacing: c.ts.barSpacing }),
        scrollToRealTime: () => { c.ts.toNow += 1; }, timeToCoordinate: (t) => t % 1000 }),
      remove: () => { c.removed = true; },
    };
    c.paneOf = paneOf;
    charts.push(c);
    return api;
  }
  const markers = [];
  const lib = {
    createChart, CandlestickSeries: def('Candlestick'), HistogramSeries: def('Histogram'), LineSeries: def('Line'),
    createSeriesMarkers: (series, list) => {
      const m = { series, sets: [list], detached: false, setMarkers(x) { m.sets.push(x); }, detach() { m.detached = true; } };
      markers.push(m);
      return m;
    },
    ColorType: { Solid: 'solid' }, CrosshairMode: { Normal: 0 }, LineStyle: { Dashed: 2 }, LastPriceAnimationMode: { Disabled: 0 },
    TickMarkType: { Year: 0, Month: 1, DayOfMonth: 2, Time: 3, TimeWithSeconds: 4 },
  };
  return { lib, charts, markers };
}

test('streamed chart buckets match full aggregation across live updates, rollover, retention, rewind and replacement', async () => {
  const { createCandleStream } = await import('../src/games/trenchingsimulator/boards/chart-stream.js');
  const { aggregate } = await import('../src/games/trenchingsimulator/boards/gngm-data.js');
  const candle = (t) => ({ t, o: 100 + t, h: 103 + t, l: 98 + t, c: 102 + t, v: 5, b: 2, s: 1 });
  for (const tf of [1, 5, 60, 900]) {
    const stream = createCandleStream();
    let rows = Array.from({ length: 1900 }, (_, i) => candle(i - 120));
    assert.deepEqual(stream.update(rows, tf).bars, aggregate(rows, tf));
    assert.equal(stream.update(rows, tf).changed, false, 'unchanged data does no chart work');
    for (let i = 0; i < 50; i++) {
      rows.at(-1).h += 2; rows.at(-1).c += 1; rows.at(-1).v += 3;
      assert.deepEqual(stream.update(rows, tf).bars, aggregate(rows, tf), 'the open candle is replaced, never double-counted');
      rows.push(candle(rows.at(-1).t + 1));
      assert.deepEqual(stream.update(rows, tf).bars, aggregate(rows, tf), 'closing bucket plus new bucket');
    }
    rows.splice(0, 100);
    assert.deepEqual(stream.update(rows, tf).bars, aggregate(rows, tf), 'retention trimming');
    rows.length = 300;
    assert.deepEqual(stream.update(rows, tf).bars, aggregate(rows, tf), 'replay rewind');
    rows = rows.map((c) => ({ ...c, c: c.c + 20 }));
    assert.deepEqual(stream.update(rows, tf).bars, aggregate(rows, tf), 'historical correction / different coin');
    assert.deepEqual(stream.update(rows, tf * 2).bars, aggregate(rows, tf * 2), 'timeframe switch');
    assert.deepEqual(stream.update([], tf).bars, []);
  }
});

test('shared chart streams long histories without rereading closed candles or resending unchanged series', async () => {
  const { createCandleStream } = await import('../src/games/trenchingsimulator/boards/chart-stream.js');
  const { createGChart } = await import('../src/games/trenchingsimulator/boards/gchart.js');
  const raw = Array.from({ length: 10000 }, (_, t) => ({ t, o: 30, h: 31, l: 29, c: 30, v: 1 }));
  let reads = 0;
  const rows = new Proxy(raw, { get(target, prop) { if (/^\d+$/.test(String(prop))) reads++; return target[prop]; } });
  const stream = createCandleStream();stream.update(rows, 1);reads = 0;
  raw.at(-1).c = 30.5;stream.update(rows, 1);
  assert.ok(reads < 10, `only the open bucket is read, got ${reads}`);
  const { lib, charts } = standInCharts();const chart = createGChart(null, { lib });
  chart.set({ candles: raw });const series = charts[0].series[0], sets = series.sets;
  for (let i = 0; i < 100; i++) chart.set({ candles: raw });
  assert.equal(series.sets, sets);assert.equal(series.updates.length, 0);
  raw.at(-1).c = 30.8;chart.set({ candles: raw });
  assert.equal(series.updates.length, 1);assert.equal(series.updates[0].close, 30.8 * 150);
  chart.destroy();
});

test('shared chart replaces a partially retained first bucket even when its timestamp and bar count stay unchanged', async () => {
  const { createGChart } = await import('../src/games/trenchingsimulator/boards/gchart.js');
  const { aggregate } = await import('../src/games/trenchingsimulator/boards/gngm-data.js');
  for (const tf of [60, 300, 900]) {
    const { lib, charts } = standInCharts(), chart = createGChart(null, { lib, tf });
    const rows = Array.from({ length: tf * 2 }, (_, t) => ({ t, o: 100+t, h: 103+t, l: 98+t, c: 102+t, v: 5 }));
    rows[0].h = 100000; rows[0].l = 1; rows[0].v = 50;
    chart.set({ candles: rows, solUsd: 1 });
    const candles = charts[0].series[0], volume = charts[0].series[1], sets = candles.sets;
    rows.splice(0, 1); chart.set({ candles: rows });
    assert.equal(candles.sets, sets+1, `partial ${tf}s bucket retention replaces stale historical data`);
    const expected = aggregate(rows, tf);
    assert.deepEqual(candles.data, expected.map(b=>({time:b.t,open:b.o,high:b.h,low:b.l,close:b.c})));
    assert.deepEqual(volume.data.map(b=>({time:b.time,value:b.value})), expected.map(b=>({time:b.t,value:b.v})));
    chart.set({ candles: rows }); assert.equal(candles.sets,sets+1,'unchanged data remains cached after reset');
    rows.at(-1).c+=1; chart.set({candles:rows}); assert.equal(candles.sets,sets+1,'ordinary tail changes remain incremental');
    chart.destroy();
  }
});

test("GNGM's chart on TradingView Lightweight Charts™ (a stand-in): market cap or price, dollars or the coin, its indicators, crosshair, zoom, back to now", async () => {
  const { createGChart, PALETTE, CREDIT } = await import('../src/games/trenchingsimulator/boards/gchart.js');
  const { fxText } = await import('../src/games/trenchingsimulator/boards/gngm-data.js');
  const { lib, charts, markers } = standInCharts();
  const kids = [];
  const host = { ownerDocument: { createElement: () => ({ className: '', textContent: '', hidden: false, removed: false, remove() { this.removed = true; } }) },
    append: (n) => kids.push(n) };
  const heard = [];
  const chart = createGChart(host, { tf: 15, onHover: (b) => heard.push(b), lib });
  const c = charts[0];
  // the library's options: its logo off (its inline style: refused by the CSP; the credit is ours), its size the host's,
  // a vertical swipe still scrolls the page, the page's local time on its axis
  assert.equal(c.options.layout.attributionLogo, false);
  assert.equal(c.options.autoSize, true);
  assert.equal(c.options.handleScroll.vertTouchDrag, false);
  const base = Date.UTC(2026, 9, 22, 12, 0, 0);
  const s0 = base / 1000;
  assert.match(c.options.timeScale.tickMarkFormatter(s0 + 30, lib.TickMarkType.TimeWithSeconds), /^\d\d:\d\d:\d\d$/);
  assert.match(c.options.timeScale.tickMarkFormatter(s0 + 30, lib.TickMarkType.Time), /^\d\d:\d\d$/);
  assert.deepEqual([CREDIT.name, CREDIT.url, CREDIT.tail], ['TradingView Lightweight Charts™', 'https://www.tradingview.com/', ' · Copyright (c) 2025 TradingView, Inc.']);
  const [candleS, volS] = c.series;
  assert.deepEqual([candleS.type, volS.type, volS.opts.priceScaleId], ['Candlestick', 'Histogram', '']);
  // nothing yet: its words over it, the legend told so
  const wait = kids[0];
  assert.equal(wait.textContent, 'waiting for the first trade…');
  assert.equal(wait.hidden, false);
  assert.deepEqual(heard, [null]);
  const candles = [];
  for (let t = -60; t < 120; t++) candles.push({ t, o: 30, h: 30.2, l: 29.8, c: 30, v: 1 + (t % 3), b: 1, s: 1 });
  chart.set({ candles, solUsd: 150, tf: 15, base });
  assert.equal(wait.hidden, true);
  // 15-second candles of market caps in dollars, at the page's clock; their volume, green or red
  assert.equal(candleS.data.length, 12);
  assert.deepEqual([candleS.data[0].time, candleS.data[11].time, candleS.data[11].open, candleS.data[11].close], [s0 - 60, s0 + 105, 4500, 4500]);
  assert.deepEqual(volS.data[11], { time: s0 + 105, value: 30, color: 'rgba(22,196,127,0.35)' });
  assert.equal(candleS.opts.priceFormat.formatter(4500), '$4.5K', 'its axis and crosshair labels');
  const last = heard[heard.length - 1];
  // (the newest 15-second candle: t 105 to 119, a volume of 1 + t mod 3 each, 30 in all)
  assert.deepEqual([last.c, last.hovering, last.vol, last.t], [4500, false, 30, 105], 'the newest candle for the legend');
  // a token's price: its zeros small, a step small enough for them; the run's own coin: the market cap in it
  chart.view({ mode: 'price' });
  const pf = candleS.applied.at(-1).priceFormat;
  assert.deepEqual([pf.type, pf.minMove, pf.formatter(0.0000045)], ['custom', 1e-13, '$0.0₅45']);
  assert.ok(Math.abs(candleS.data[11].close - 4.5e-6) < 1e-15);
  chart.view({ mode: 'mcap', unit: 'coin' });
  assert.equal(candleS.data[11].close, 30);
  assert.equal(candleS.applied.at(-1).priceFormat.formatter(30), '30');
  chart.view({ unit: 'coin', per: 0.05 });
  assert.ok(Math.abs(candleS.data[11].close - 1.5) < 1e-12);
  chart.view({ unit: 'usd' });
  assert.equal(candleS.data[11].close, 4500);
  // the player's trades (B / S bubbles, drawn by a primitive) and the migration (a marker), on their candles
  chart.set({ marks: [{ t: 30, side: 'buy' }, { t: 60, side: 'sell' }, { t: 9999, side: 'buy' }], migratedAt: 45 });
  const bub = candleS.prims[0];
  assert.deepEqual(bub.items.map((m) => [m.time, m.buy]), [[s0 + 30, true], [s0 + 60, false]]);
  assert.deepEqual(markers[0].sets.at(-1), [{ time: s0 + 45, position: 'aboveBar', shape: 'arrowDown', color: PALETTE.mig, text: 'Migrated' }]);
  bub.updateAllViews();
  const drawn = [];
  const g = { beginPath() {}, arc() {}, fill() {}, fillText: (t) => drawn.push(t) };
  bub.paneViews()[0].renderer().draw({ useBitmapCoordinateSpace: (f) => f({ context: g, horizontalPixelRatio: 2, verticalPixelRatio: 2 }) });
  assert.deepEqual(drawn, ['B', 'S']);
  // its indicators: MA 20 and EMA 9 over the candles, RSI 14 (its 70 and 30) and MACD in panes of their own; a flat
  // market's RSI is 50 and its MACD 0, "—" until there are enough candles (12 candles of 15 s: too few for RSI 14)
  chart.indicators(['ma', 'ema', 'rsi', 'macd']);
  assert.deepEqual(c.series.filter((s) => c.paneOf(s) === 0).map((s) => s.type), ['Candlestick', 'Histogram', 'Line', 'Line']);
  assert.deepEqual(c.series.filter((s) => c.paneOf(s) > 0).map((s) => [c.paneOf(s), s.type]), [[1, 'Line'], [2, 'Histogram'], [2, 'Line'], [2, 'Line']]);
  assert.deepEqual(c.panes.map((p) => p.stretch), [3, 1, 1], 'the candles three times an indicator\'s pane');
  assert.deepEqual(c.series.find((s) => c.paneOf(s) === 1).lines.map((l) => l.price), [70, 30]);
  let h = heard[heard.length - 1];
  assert.equal(fxText(h.fx, h.ind, h.fmt), 'MA 20 —  EMA 9 $4.5K  RSI 14 —  MACD 12 26 9 — —');
  chart.set({ tf: 1 });
  h = heard[heard.length - 1];
  assert.equal(fxText(h.fx, h.ind, h.fmt), 'MA 20 $4.5K  EMA 9 $4.5K  RSI 14 50.0  MACD 12 26 9 $0 $0');
  assert.deepEqual(chart.state.indicators, ['ma', 'ema', 'rsi', 'macd']);
  chart.indicators([]);
  assert.deepEqual(c.series.map((s) => s.type), ['Candlestick', 'Histogram'], 'gone again');
  assert.equal(c.panes.length, 1, 'their panes with them');
  // the crosshair: the candle under it for the legend, else the newest
  const cross = [...c.handlers][0];
  cross({ point: { x: 40, y: 60 }, time: s0 + 30 });
  assert.deepEqual([heard.at(-1).hovering, heard.at(-1).t], [true, 30]);
  cross({ point: undefined });
  assert.deepEqual([heard.at(-1).hovering, heard.at(-1).t], [false, 119]);
  // the market moves on: only the newest candle again and the new one, never all of them
  const sets = candleS.sets;
  candles.push({ t: 120, o: 30, h: 31, l: 30, c: 31, v: 2, b: 1, s: 0 });
  chart.set({});
  assert.equal(candleS.sets, sets);
  assert.deepEqual(candleS.updates.slice(-2).map((p) => p.time), [s0 + 119, s0 + 120]);
  // another coin (another array): all of them again
  chart.set({ candles: candles.slice() });
  assert.equal(candleS.sets, sets + 1);
  // zoom (within 2 to 32 pixels a candle), back to now at its first zoom, to now
  chart.zoom(1);
  assert.equal(chart.state.barW, 8.75);
  for (let i = 0; i < 30; i++) chart.zoom(1);
  assert.equal(chart.state.barW, 32);
  for (let i = 0; i < 30; i++) chart.zoom(-1);
  assert.equal(chart.state.barW, 2);
  chart.fit();
  assert.deepEqual([chart.state.barW, c.ts.toNow], [7, 1]);
  chart.toNow();
  assert.equal(c.ts.toNow, 2);
  // gone without a trace: its crosshair, primitive and markers let go, the chart removed, its words too
  chart.destroy();
  assert.deepEqual([c.handlers.size, candleS.prims.length, markers[0].detached, c.removed, wait.removed], [0, 0, true, true, true]);
  // the library comes only when there's a chart to draw (its own file: never in the game's first one, never on our server)
  const later = createGChart(host, {});
  later.set({ candles: [] });
  assert.equal(later.state.ready, false);
  later.destroy();
  const src = readFileSync('src/games/trenchingsimulator/boards/gchart.js', 'utf8');
  assert.match(src, /import\('lightweight-charts'\)/);
  assert.doesNotMatch(src, /^import .*lightweight-charts/m, 'never a static import');
  for (const dir of ['server', 'api']) {
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.js'))) assert.doesNotMatch(readFileSync(`${dir}/${f}`, 'utf8'), /lightweight-charts/, `${dir}/${f}`);
  }
  assert.match(readFileSync('vite.config.js', 'utf8'), /license: true,/, 'its license goes with the build (dist/.vite/license.md)');
});

test("GNGM's Trenches: a card's metrics (a real coin's unknowns stay unknown), how worrying they are, its column filters", async () => {
  const G = await import('../src/games/trenchingsimulator/boards/gngm-data.js');
  const row = { id: 1, mc: 40, vol: 12, vol5m: 3, txns: 50, txns5m: 9, holders: 30, top10: 0.25, dev: 0.04, devSold: 0,
    snipers: 0.12, insiders: 0.02, bundlers: 0.08, progress: 0.3, age: 90, rugged: false };
  const m = G.cardMetrics(row, { smart: 2, kols: [{ id: 'gmgrandma' }] });
  assert.deepEqual([m.smart, m.kols, m.holders, m.live, m.mc], [2, 1, 30, false, 40]);
  assert.equal(G.cardMetrics(row).smart, null, 'without its stats: not known');
  const real = G.cardMetrics({ ...row, live: true, holders: null, top10: null }, { smart: null, kols: [] });
  for (const k of ['holders', 'top10', 'dev', 'devSold', 'snipers', 'insiders', 'bundlers', 'smart', 'kols']) {
    assert.equal(real[k], null, `a real coin's ${k}`);
  }
  assert.equal(real.mc, 40);
  assert.equal(G.cardMetrics(null), null);
  assert.equal(G.riskOf('top10', 0.25), 'warn');
  assert.equal(G.riskOf('top10', 0.31), 'bad');
  assert.equal(G.riskOf('dev', 0.01), 'ok');
  assert.equal(G.riskOf('dev', null), 'na');
  assert.equal(G.riskOf('toString', 0.5), 'na');
  assert.deepEqual(G.FILTERS.map(([id]) => id), ['all', 'safe', 'smart', 'strict']);
  assert.equal(G.passes(m, 'all'), true);
  assert.equal(G.passes(m, 'safe'), true);
  assert.equal(G.passes(m, 'smart'), true);
  assert.equal(G.passes(m, 'strict', 150), true, '12 SOL traded at $150: $1,800');
  assert.equal(G.passes(m, 'strict', 50), false, '$600');
  assert.equal(G.passes({ ...m, rugged: true }, 'safe'), false);
  assert.equal(G.passes({ ...m, insiders: 0.4 }, 'safe'), false);
  assert.equal(G.passes({ ...m, smart: 0 }, 'smart'), false);
  for (const f of ['safe', 'smart', 'strict']) assert.equal(G.passes(real, f), false, `a real coin's unknowns never pass ${f}`);
  assert.equal(G.passes(real, 'all'), true);
  assert.equal(G.passes(null, 'all'), false);
});

test("GNGM's coin page: what each trade was to its maker, its top traders, its security checks", async () => {
  const G = await import('../src/games/trenchingsimulator/boards/gngm-data.js');
  // oldest first: A buys 100, B buys 10, A buys 50, A sells 30, C sells 5, A sells its last 120 (B still holds 10)
  const trades = [{ addr: 'A', side: 'sell', tok: 120 }, { addr: 'C', side: 'sell', tok: 5 }, { addr: 'A', side: 'sell', tok: 30 },
    { addr: 'A', side: 'buy', tok: 50 }, { addr: 'B', side: 'buy', tok: 10 }, { addr: 'A', side: 'buy', tok: 100 }];
  const holders = [{ addr: 'B', tok: 10 }];
  assert.deepEqual(G.activityLabels(trades, holders, true), ['Sell All', 'Sell All', 'Sell Part', 'Buy More', 'New Holder', 'New Holder']);
  // not every holder listed: a wallet that isn't listed holds an unknown little
  assert.deepEqual(G.activityLabels(trades, holders, false), ['Sell Part', 'Sell Part', 'Sell Part', 'Buy More', 'New Holder', 'New Holder']);
  // a real coin's trades: nobody we know
  assert.deepEqual(G.activityLabels([{ addr: null, side: 'buy', tok: 5 }], [], true), ['']);
  assert.deepEqual(G.activityLabels(null, null, true), []);
  assert.equal(G.makerTag('dev'), 'DEV');
  assert.equal(G.makerTag('regular'), '');
  assert.equal(G.makerTag('__proto__'), '');
  assert.equal(G.makerOk({ label: 'smart' }, 'smart'), true);
  assert.equal(G.makerOk({ label: 'regular', kol: 'gmgrandma' }, 'kol'), true);
  assert.equal(G.makerOk({ label: 'regular', me: true }, 'me'), true);
  assert.equal(G.makerOk({ label: 'regular' }, 'whale'), false);
  assert.equal(G.makerOk({ label: 'regular' }, 'all'), true);
  // its top traders: by profit, from what each put in and took out and what it holds is worth (0.01 SOL a token)
  const top = G.topTraders([{ addr: 'a', label: 'regular', tok: 100, in: 1, out: 0.5 },
    { addr: 'b', label: 'smart', tok: 10, in: 2, out: 0 }, { addr: 'c', label: 'kol', kol: 'gmgrandma', tok: 50, in: 0.1, out: 1 }], 0.01);
  assert.deepEqual(top.map((x) => x.addr), ['c', 'a', 'b']);
  near(top[0].pnl, 1.4, 1e-9, "c's profit");
  near(top[0].pct, 14, 1e-9, "c's return");
  near(top[2].pnl, -1.9, 1e-9, "b's loss");
  assert.equal(top[0].kol, 'gmgrandma');
  assert.deepEqual(G.topTraders(null, 0.01), []);
  // its security checks: a made-up coin's from its holders; a real coin's all "—"
  const st = { phase: 'curve', top10: 0.35, dev: 0.02, devSold: 0, insiders: 0.07, snipers: 0.01, bundlers: 0.2, rugged: false };
  const checks = G.securityChecks(st);
  assert.deepEqual(checks.map((c) => c.k), G.CHECKS.map(([k]) => k));
  assert.deepEqual(checks.map((c) => c.state), ['ok', 'ok', 'na', 'bad', 'ok', 'ok', 'warn', 'ok', 'bad', 'ok']);
  assert.equal(checks.find((c) => c.k === 'top10').value, '35%');
  assert.equal(checks.find((c) => c.k === 'lp').value, 'On the curve');
  const pool = G.securityChecks({ ...st, phase: 'pool', rugged: true });
  assert.deepEqual([pool[2].value, pool[2].state], ['Burnt 100%', 'ok']);
  assert.deepEqual([pool[9].value, pool[9].state], ['Yes', 'bad']);
  for (const c of G.securityChecks({ ...st, live: true })) assert.deepEqual([c.value, c.state], ['—', 'na'], c.k);
  assert.deepEqual(G.securityChecks(null), []);
});

test("GNGM's first 70 buyers: kept by the market as they first buy, what each holds now, a real coin's never made up", async () => {
  const { createMarket, FIRST_BUYERS } = await import('../src/games/trenchingsimulator/engine.js');
  const G = await import('../src/games/trenchingsimulator/boards/gngm-data.js');
  assert.equal(FIRST_BUYERS, 70);
  const m = createMarket({ seed: 'gngm-first' });
  m.advance(240);
  assert.equal(m.firstBuyers(-1), null);
  assert.equal(m.firstBuyers(1e9), null);
  let checked = 0;
  for (let id = 0; id < m.size.coins; id++) {
    const fb = m.firstBuyers(id);
    assert.ok(fb && Array.isArray(fb.list), `coin ${id}`);
    assert.ok(fb.list.length <= 70, `coin ${id}: at most 70`);
    const coin = m.debug.coin(id);
    let got = 0;
    let hold = 0;
    fb.list.forEach((x, i) => {
      assert.equal(x.n, i + 1);
      if (i > 0) assert.ok(x.at >= fb.list[i - 1].at, `coin ${id}: in the order they first bought`);
      // what it holds now is its wallet's own (gone from the holders: sold out)
      const h = coin.holders.get(coin.first[i].key);
      assert.equal(x.tok, h ? h.tok : 0, `coin ${id}, buyer ${i + 1}`);
      assert.ok(x.tok0 > 0);
      const want = x.tok <= 0 ? 'all' : x.tok > x.tok0 * 1.02 ? 'more' : x.tok < x.tok0 * 0.98 ? 'part' : 'hold';
      assert.equal(x.status, want, `coin ${id}, buyer ${i + 1}`);
      got += x.tok0;
      hold += x.tok;
    });
    near(fb.got, got / 1e9, 1e-12, `coin ${id}: the share they first got`);
    near(fb.hold, hold / 1e9, 1e-12, `coin ${id}: the share they hold now`);
    if (fb.list.length >= 20) checked++;
  }
  assert.ok(checked >= 5, `coins with 20 first buyers or more: ${checked}`);
  // the summary: each state counted, the snipers and insiders among them
  const busy = [...Array(m.size.coins).keys()].map((id) => m.firstBuyers(id)).find((fb) => fb.list.length >= 20);
  const sum = G.firstSummary(busy);
  assert.equal(sum.count, busy.list.length);
  assert.equal(Object.values(sum.states).reduce((a, b) => a + b, 0), busy.list.length);
  assert.equal(sum.snipers, busy.list.filter((x) => x.label === 'sniper').length);
  assert.equal(G.firstSummary(null), null);
  // the same seed, the same first buyers (keeping them draws no number: the market is the same as before)
  const again = createMarket({ seed: 'gngm-first' });
  again.advance(240);
  assert.deepEqual(again.firstBuyers(3), m.firstBuyers(3));
  assert.deepEqual(again.lists(), m.lists());
  // the smart wallets' weeks: how their trades ended, counted from the same trades, a copy each time
  const w = m.smartWallets()[0];
  assert.equal(w.d7.dist.length, 5);
  assert.equal(w.d7.dist.reduce((a, b) => a + b, 0), w.d7.trades);
  assert.equal(w.d7.dist[0] + w.d7.dist[1] + w.d7.dist[2], w.d7.won, 'every win returned something, every loss lost something');
  w.d7.dist[0] = -1;
  assert.notEqual(m.smartWallets()[0].d7.dist[0], -1);
});

test("GNGM's Track feed and wallet pages: KOL and smart money trades, a smart wallet's week and run, a caller's calls", async () => {
  const G = await import('../src/games/trenchingsimulator/boards/gngm-data.js');
  const { createMarket } = await import('../src/games/trenchingsimulator/engine.js');
  const { smartAddress, KOLS } = await import('../src/games/trenchingsimulator/names.js');
  const events = [
    { q: 1, t: 5, kind: 'kol_buy', c: 3, kol: 'gmgrandma', sol: 2, ticker: 'FROG' },
    { q: 2, t: 6, kind: 'launch', c: 4, ticker: 'NEW' },
    { q: 3, t: 7, kind: 'smart_sell', c: 3, smart: 5, frac: 0.5, sol: 1, ticker: 'FROG' },
    { q: 4, t: 8, kind: 'whale_buy', c: 9, sol: 12, l: 'whale', ticker: 'CAT' },
    { q: 5, t: 9, kind: 'kol_sell', c: 3, kol: 'gmgrandma', frac: 1, sol: 3, ticker: 'FROG' },
  ];
  assert.deepEqual(G.trackItems(events).map((x) => x.q), [5, 4, 3, 1]);
  assert.deepEqual(G.trackItems(events, { filter: 'kol' }).map((x) => x.q), [5, 1]);
  assert.deepEqual(G.trackItems(events, { max: 2 }).map((x) => x.q), [5, 4]);
  const first = G.trackItems(events)[0];
  assert.deepEqual([first.who, first.side, first.kol, first.coin, first.frac], ['kol', 'sell', 'gmgrandma', 3, 1]);
  assert.equal(G.trackItems(events)[2].smart, 5);
  assert.deepEqual(G.trackItems(null), []);
  // a caller's page: its calls this run, never how honest or good it is
  const k = G.kolProfile('gmgrandma', events);
  const ki = KOLS.findIndex((x) => x.id === 'gmgrandma');
  assert.deepEqual([k.name, k.calls, k.sells, k.followers, k.addr], ['@gmgrandma', 1, 1, KOLS[ki].followers, smartAddress(1000 + ki)]);
  assert.deepEqual(k.coins, [3]);
  assert.ok(!('honest' in k) && !('skill' in k));
  assert.equal(G.kolProfile('nobody', events), null);
  assert.equal(G.kolAddress('nobody'), null);
  // a smart wallet's page from the market's board
  const m = createMarket({ seed: 'gngm-wallet' });
  m.advance(300);
  const W = m.smartWallets();
  for (const w of W) {
    const p = G.smartProfile(w);
    assert.equal(p.name, `Smart wallet ${w.n + 1}`);
    assert.equal(p.addr, w.addr);
    assert.equal(p.week.trades, w.d7.trades);
    near(p.week.winRate, w.d7.won / w.d7.trades, 1e-12, 'its week\'s win rate');
    assert.deepEqual(p.week.dist, w.d7.dist);
    assert.equal(p.run.open, w.open.length);
    assert.equal(p.run.dist.reduce((a, b) => a + b, 0), w.open.filter((o) => o.in > 0).length);
    if (w.won + w.lost === 0) assert.equal(p.run.winRate, null);
  }
  assert.equal(G.smartProfile(null), null);
  assert.deepEqual([G.distOf(6), G.distOf(3), G.distOf(0.5), G.distOf(-0.2), G.distOf(-0.9)], [0, 1, 2, 3, 4]);
  assert.equal(G.DIST_LABELS.length, 5);
});

test("GNGM's trade module: take my initial, limit orders, take profit and stop loss, a PnL card's numbers", async () => {
  const G = await import('../src/games/trenchingsimulator/boards/gngm-data.js');
  // take my initial: what's still in it (1 in, 0.5 out already) from a quote that pays 3 SOL for all of it
  assert.equal(G.initialFrac({ tokens: 100, invested: 1, sold: 0.5 }, (f) => f * 3), 0.167);
  assert.equal(G.initialFrac({ tokens: 100, invested: 1, sold: 1.2 }, (f) => f * 3), null, 'already got it back');
  assert.equal(G.initialFrac({ tokens: 100, invested: 1, sold: 0.5 }, (f) => f * 0.4), null, 'selling all of it would not');
  assert.equal(G.initialFrac({ tokens: 0, invested: 1, sold: 0 }, (f) => f * 3), null);
  assert.equal(G.initialFrac(null, (f) => f), null);
  // limit orders: their direction from where the market cap was
  const dip = G.makeLimit({ coin: 3, side: 'buy', mc: 30, sol: 0.1, mcNow: 40 });
  assert.deepEqual([dip.dir, G.limitName(dip), G.limitHit(dip, 35), G.limitHit(dip, 30), G.limitHit(dip, 12)], ['down', 'Buy the dip', false, true, true]);
  const brk = G.makeLimit({ coin: 3, side: 'buy', mc: 60, sol: 0.1, mcNow: 40 });
  assert.deepEqual([brk.dir, G.limitName(brk), G.limitHit(brk, 59), G.limitHit(brk, 61)], ['up', 'Buy the breakout', false, true]);
  assert.equal(G.limitName(G.makeLimit({ coin: 3, side: 'sell', mc: 80, frac: 0.5, mcNow: 40 })), 'Take profit');
  assert.equal(G.limitName(G.makeLimit({ coin: 3, side: 'sell', mc: 20, frac: 1, mcNow: 40 })), 'Stop loss');
  for (const bad of [{ coin: 3, side: 'x', mc: 30, sol: 1, mcNow: 40 }, { coin: 3, side: 'buy', mc: 30, mcNow: 40 },
    { coin: 3, side: 'sell', mc: 30, frac: 1.5, mcNow: 40 }, { coin: 'a', side: 'buy', mc: 30, sol: 1, mcNow: 40 },
    { coin: 3, side: 'buy', mc: 0, sol: 1, mcNow: 40 }]) assert.equal(G.makeLimit(bad), null, JSON.stringify(bad));
  assert.equal(G.limitHit(null, 10), false);
  // auto: take profit at +100%, stop loss at −50%, on an entry of 40 SOL of market cap
  const a = { tp: { at: 1, frac: 0.5 }, sl: { at: -0.5, frac: 1 } };
  assert.deepEqual([G.autoHit(a, 80, 40), G.autoHit(a, 79, 40), G.autoHit(a, 20, 40), G.autoHit(a, 50, 40)], ['tp', null, 'sl', null]);
  assert.equal(G.autoHit({ ...a, tp: { at: 1, frac: 0.5, done: true } }, 90, 40), null, 'each once');
  assert.equal(G.autoHit(a, 80, 0), null);
  near(G.entryMcOf({ tokens: 1e6, cost: 0.04 }), 40, 1e-9, 'its entry as a market cap');
  assert.equal(G.entryMcOf({ tokens: 0, cost: 1 }), null);
  // a PnL card's numbers: invested, what came back (sold and still held), profit, return
  const p = G.pnlOf({ invested: 2, sold: 1, value: 2, total: 0.9 });
  assert.deepEqual([p.invested, p.sold, p.profit, p.pct], [2, 3, 0.9, 0.45]);
  assert.equal(G.pnlOf(null), null);
});

test("GNGM's presets (P1 to P3) and chart view in the save; the player's optional name, both games' and never required", async () => {
  const S = await import('../src/games/trenchingsimulator/save.js');
  const b = S.blank();
  assert.equal(b.preset, 0);
  assert.deepEqual(b.presets, [{ slippage: 0.2, priority: 'fast' }, { slippage: 0.1, priority: 'turbo' }, { slippage: 0.5, priority: 'ultra' }]);
  assert.deepEqual(b.chart, { mode: 'mcap', unit: 'usd' });
  const c = S.cleanSave({ v: 1, preset: 2, presets: [{ slippage: 0.05, priority: 'ultra' }, { slippage: 0.33, priority: 'warp' }],
    chart: { mode: 'price', unit: 'eth' } });
  assert.equal(c.preset, 2);
  assert.deepEqual(c.presets, [{ slippage: 0.05, priority: 'ultra' }, { slippage: 0.1, priority: 'turbo' }, { slippage: 0.5, priority: 'ultra' }]);
  assert.deepEqual(c.chart, { mode: 'price', unit: 'usd' });
  for (const bad of [3, -1, 1.5, '1', null]) assert.equal(S.cleanSave({ v: 1, preset: bad }).preset, 0, String(bad));
  b.presets[0].slippage = 0.5;
  assert.equal(S.blank().presets[0].slippage, 0.2, "the defaults are copies");
  assert.ok(Object.isFrozen(S.PRESETS) && S.PRESETS.every((p) => Object.isFrozen(p)));
  // the name: optional, tidied, the site's rules for a name in short (our server checks it again before anyone sees it)
  const N = await import('../src/games/player-name.js');
  assert.equal(N.NAME_KEY, 'agi_player_name');
  assert.equal(N.NAME_MAX, 24);
  assert.deepEqual(N.cleanName(''), { ok: true, name: null });
  assert.deepEqual(N.cleanName('   '), { ok: true, name: null });
  assert.deepEqual(N.cleanName(undefined), { ok: true, name: null });
  assert.deepEqual(N.cleanName('  degen   dan '), { ok: true, name: 'degen dan' });
  for (const ok of ['Trenchlord', 'María José', '鈴木', 'ape_42', 'gm 🐸', "O'Neil", 'Dev', 'x'.repeat(24)]) assert.equal(N.cleanName(ok).ok, true, ok);
  for (const bad of ['x'.repeat(25), 'AGI-1', 'agi1official', 'AGI Team', 'the team', 'admin', 'Mod', 'support', 'official_dan',
    'real_agi_1', 'http://x.co', 'www.site', 'buy.fun', 'pump.xyz/ok', 'me@mail.com', '0xabcdef12', '1234567', '<b>', '???', '...']) {
    assert.equal(N.cleanName(bad).ok, false, bad);
  }
  const mem = new Map();
  const st = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  assert.equal(N.loadName(st), null);
  assert.deepEqual(N.saveName(st, ' Ape Lord '), { ok: true, name: 'Ape Lord', saved: true });
  assert.equal(mem.get('agi_player_name'), 'Ape Lord');
  assert.equal(N.loadName(st), 'Ape Lord');
  assert.deepEqual(N.saveName(st, 'admin'), { ok: false });
  assert.equal(N.loadName(st), 'Ape Lord', 'a name that is refused changes nothing');
  assert.deepEqual(N.saveName(st, ''), { ok: true, name: null, saved: true });
  assert.equal(mem.has('agi_player_name'), false, 'an empty name forgets it');
  mem.set('agi_player_name', 'AGI team');
  assert.equal(N.loadName(st), null, 'a kept name that no longer passes');
  assert.equal(N.loadName({ getItem() { throw new Error('blocked'); } }), null);
  assert.deepEqual(N.saveName({ setItem() { throw new Error('full'); } }, 'Ape'), { ok: true, name: 'Ape', saved: false });
  assert.deepEqual(N.saveName(null, 'Ape'), { ok: true, name: 'Ape', saved: false });
});

test("GNGM's PnL card: its return big, in, out and profit, the player's name, the safety foot; never a real coin's name, a QR code or a link", async () => {
  const K = await import('../src/games/trenchingsimulator/boards/gngm-card.js');
  const { tradeShareText } = await import('../src/games/trenchingsimulator/share.js');
  assert.deepEqual([K.CARD_W, K.CARD_H], [1200, 630]);
  // a run's card
  const won = K.runCardWords(WON, { name: 'Ape Lord' });
  assert.match(won.kicker, /^TRENCHING SIMULATOR · /);
  assert.equal(won.big, '+131%');
  assert.equal(won.small, '2.31x');
  assert.deepEqual(won.rows.map((r) => r[0]), ['Start', 'Worth', 'Profit', 'Time']);
  assert.equal(won.rows[2][2], 'up');
  assert.equal(won.name, 'Ape Lord');
  assert.match(won.foot, /^Play money, made-up coins · agi1\.app\/games\/trenchingsimulator · Not financial advice\.$/);
  assert.equal(K.runCardWords({ ...WON, live: 'solana', liveTraded: 2 }).foot,
    'Play money on live coins · agi1.app/games/trenchingsimulator · Not financial advice.');
  assert.equal(K.runCardWords(WON).name, null, 'no name, none on the card');
  // one coin's card: a made-up coin by its ticker, a real one never by name
  const pos = { id: 4, ticker: 'FROG', name: 'Frog Coin', tokens: 0, invested: 1, sold: 2.5, value: 0, total: 1.5 };
  const made = K.positionCardWords(pos, { currency: 'sol', solUsd: 150, name: 'Ape Lord' });
  assert.deepEqual([made.title, made.big, made.small, made.tone], ['$FROG', '+150%', 'sold', 'up']);
  assert.deepEqual(made.rows.map((r) => r[0]), ['Invested', 'Sold', 'Profit']);
  assert.equal(made.rows[2][1], '+1.5 SOL');
  const real = K.positionCardWords({ ...pos, ticker: 'REALTKR', tokens: 10, value: 1, total: -0.2 }, { live: true, currency: { coin: 'eth', usd: 3000 }, solUsd: 150 });
  assert.equal(real.title, 'a live coin');
  assert.equal(real.tone, 'down');
  assert.match(real.rows[0][1], /ETH$/);
  assert.match(real.foot, /^Play money on live coins/);
  // drawn on a stand-in canvas: the words above, nothing else (no link, no QR code, never the real coin's ticker)
  const draw = (w) => {
    const texts = [];
    const g = { fillRect() {}, strokeRect() {}, save() {}, restore() {}, translate() {}, scale() {},
      fillText: (t) => texts.push(String(t)), measureText: (t) => ({ width: String(t).length * 20 }) };
    K.drawPnlCard(g, w, { bg: '#0d0d0f' });
    return texts;
  };
  const tx = draw(real);
  assert.ok(tx.includes('a live coin') && tx.includes('GN') && tx.includes('GM'), tx.join(' | '));
  assert.ok(!tx.some((t) => /REALTKR|https?:|www\.|qr|ref=/i.test(t)), tx.join(' | '));
  assert.ok(tx.some((t) => t.startsWith('Play money on live coins')), 'the safety foot');
  const tx2 = draw(made);
  assert.ok(tx2.includes('$FROG') && tx2.includes('+150%') && tx2.includes('by Ape Lord'), tx2.join(' | '));
  assert.ok(tx2.some((t) => /Not financial advice/.test(t)));
  // the words shared with it: play money every time, never "buy", never a real coin or terminal by name
  const bad = /based\s*bot(?!t)|gmgn|pump\.?fun|axiom|fomo|photon|bullx|dexscreener|robinhood|\bbuy\b|guarantee|financial|REALTKR/i;
  for (const o of [{ ticker: 'FROG', change: 1.5 }, { ticker: 'FROG', change: -0.4 }, { ticker: 'REALTKR', live: true, change: 3 },
    { ticker: '<b>', change: 0.1 }, { ticker: 'FROG' }, {}]) {
    const t = tradeShareText(o);
    assert.match(t, /TRENCHING SIMULATOR/);
    assert.match(t, /\(play money, made-up coins\)|\(play money on live coins\)/);
    assert.ok(!bad.test(t), t);
    assert.ok(t.length + 24 <= 280, t);
  }
  assert.equal(tradeShareText({ ticker: 'FROG', change: 1.5 }), '+150% on $FROG in TRENCHING SIMULATOR (play money, made-up coins) 💜');
  assert.match(tradeShareText({ ticker: 'REALTKR', live: true, change: 3 }), /^\+300% on a live coin in /);
  assert.match(tradeShareText({ ticker: '<b>', change: 0.1 }), / on a coin in /);
});

// ---------- verify.js and ../boards.js: checked runs and the leaderboards (2026-10-22) ----------

test("checked runs: a run's orders packed and read back, and the same run made again from them, whatever its frames were", async () => {
  const V = await import('../src/games/trenchingsimulator/verify.js');
  const { dailySeed: dSeed, dailyChallenge: dCh } = await import('../src/games/trenchingsimulator/challenges.js');
  // a challenge played with uneven frames (a slow phone): a new coin bought now and then, half of a coin held sold later
  const play = (run) => {
    const frames = [0.016, 0.25, 0.033, 0.18, 0.016, 0.016, 0.21, 0.05];
    for (let i = 0; !run.over && i < 40000; i++) {
      run.tick(frames[i % frames.length]);
      if (i % 37 === 5) {
        const r = run.market.lists({ limit: 5 }).new[0];
        if (r) run.order({ coin: r.id, side: 'buy', sol: 0.05, slippage: 0.2, priority: 'fast' });
      }
      if (i % 53 === 20) {
        const p = run.market.positions().find((x) => x.open);
        if (p) run.order({ coin: p.id, side: 'sell', frac: 0.5, slippage: 0.5, priority: 'turbo' });
      }
    }
    return run.result();
  };
  const run = createRun({ seed: 'checked-1', solUsd: 150, mode: 'challenge', challenge: challengeById('speedrun'), currency: 'sol' });
  const res = play(run);
  assert.ok(run.over, 'it ended by itself');
  const log = run.market.log();
  assert.ok(log.length >= 5, `its orders: ${log.length}`);
  const packed = V.packLog(log);
  assert.ok(packed.every((s) => typeof s === 'string' && s.length < 60), packed[0]);
  const back = V.unpackLog(packed);
  assert.deepEqual(back, log.map((e) => (e.side === 'buy' ? { n: e.n, coin: e.coin, side: 'buy', sol: e.sol, slippage: e.slippage, priority: e.priority }
    : { n: e.n, coin: e.coin, side: 'sell', frac: e.frac, slippage: e.slippage, priority: e.priority })));
  // made again on single steps: the same ending, at the same step, with the same worth
  const rep = V.replayRun({ kind: 'challenge', challenge: 'speedrun', seed: 'checked-1', solUsd: 150, log: back });
  assert.equal(rep.ok, true);
  assert.deepEqual([rep.result.outcome, rep.result.reason, rep.result.timeUsed, rep.result.worth, rep.result.filled],
    [res.outcome, res.reason, res.timeUsed, res.worth, res.filled]);
  assert.equal(V.sameResult({ outcome: res.outcome, timeUsed: res.timeUsed, worth: res.worth }, rep.result), true);
  // the daily market: its seed is the day's
  const day = '2026-10-20';
  const daily = createRun({ seed: dSeed(day), challenge: dCh(day), mode: 'daily', solUsd: 150, currency: 'sol' });
  const dres = play(daily);
  const drep = V.replayRun({ kind: 'daily', day, seed: 'ignored', solUsd: 150, log: V.unpackLog(V.packLog(daily.market.log())) });
  assert.equal(drep.ok, true);
  assert.deepEqual([drep.result.outcome, drep.result.timeUsed, drep.result.worth], [dres.outcome, dres.timeUsed, dres.worth]);
  // what a page could change: an order's amount (another run), an order out of its place, a claim that isn't what happened
  const changed = back.map((o, i) => (i === 0 ? { ...o, sol: o.sol * 3 } : o));
  const crep = V.replayRun({ kind: 'challenge', challenge: 'speedrun', seed: 'checked-1', solUsd: 150, log: changed });
  assert.ok(!crep.ok || !V.sameResult({ outcome: res.outcome, timeUsed: res.timeUsed, worth: res.worth }, crep.result), 'another run');
  assert.equal(V.replayRun({ kind: 'challenge', challenge: 'speedrun', seed: 'another', solUsd: 150, log: back }).ok
    && V.sameResult(res, V.replayRun({ kind: 'challenge', challenge: 'speedrun', seed: 'another', solUsd: 150, log: back }).result), false, 'another seed');
  assert.deepEqual(V.replayRun({ kind: 'challenge', challenge: 'speedrun', seed: 'checked-1', solUsd: 150,
    log: [{ ...back[0], n: back[0].n - 99999 }] }), { ok: false, why: 'order' });
  assert.deepEqual(V.replayRun({ kind: 'free', seed: 'x', solUsd: 150, log: [] }), { ok: false, why: 'bad' });
  assert.deepEqual(V.replayRun({ kind: 'challenge', challenge: 'nope', seed: 'x', solUsd: 150, log: [] }), { ok: false, why: 'bad' });
  assert.equal(V.sameResult({ ...res, worth: res.worth * 1.001 }, rep.result), false);
  assert.equal(V.sameResult({ ...res, timeUsed: res.timeUsed - 0.1 }, rep.result), false);
  assert.equal(V.sameResult({ ...res, outcome: 'won' }, { ...rep.result, outcome: 'lost' }), false);
  // a log read back only when everything in it is right
  const ok = packed[0];
  for (const bad of [[ok, ok.replace(/^[0-9a-z]+/, '0')], [ok.replace(/,[0-2]$/, ',7')], [ok.replace(/^([^,]+,[^,]+,)b/, '$1x')],
    [`${ok},1`], ['a,b,s,1.5,0.2,0'], ['1,1,s,0.5,0.33,0'], ['1,1,b,-1,0.2,0'], ['1,1,b,1e3,0.2,0'], [7], 'x', null]) {
    assert.equal(V.unpackLog(bad), null, JSON.stringify(bad));
  }
  assert.equal(V.unpackLog(Array(V.LOG_MAX + 1).fill(ok)), null, 'at most 1,000 orders');
  assert.deepEqual(V.unpackLog([]), []);
  assert.equal(V.rankedChallenge({ kind: 'daily', day: 'nope' }), null);
  assert.equal(V.rankedSeed({ kind: 'daily', day, seed: 'x' }), dSeed(day));
});

test("checked runs on our server: a ticket (its seed ours, its price frozen), the run made again, the boards; every way a score is refused", async () => {
  const S = await import('../server/scores.js');
  const V = await import('../src/games/trenchingsimulator/verify.js');
  const B = await import('../src/games/boards.js');
  const { dailyChallenge: dCh } = await import('../src/games/trenchingsimulator/challenges.js');
  const cfg = { passSecret: 'a-pass-secret-for-the-checked-runs-0123456789', supabaseUrl: 'https://db.example', supabaseKey: 'k' };
  const PID = 'c'.repeat(32);
  const WHO = 'v'.repeat(24);
  const calls = [];
  const db = { take: 'ok', cut: true, put: null };
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.startsWith('https://api.dexscreener.com/')) return new Response('{}', { status: 503 });
    const fn = u.slice(u.lastIndexOf('/') + 1);
    const args = JSON.parse(init.body);
    calls.push({ fn, args });
    const out = fn === 'arcade_take' ? db.take : fn === 'arcade_board_cut' ? db.cut
      : fn === 'arcade_score_put' ? (db.put || { ok: true, ranks: Object.fromEntries(args.p_boards.map((b, i) => [b, i + 1])) }) : null;
    return new Response(JSON.stringify(out), { status: 200 });
  };
  S._resetScores();
  try {
    const T0 = Date.UTC(2026, 9, 22, 12, 0, 0);
    const day = B.dayKeyOf(T0);
    // a ticket for today's daily market: its day's seed, SOL at $150 (DexScreener away), tied to this browser
    const tk = await S.gameTicket(cfg, { game: 'trenchingsimulator', player: PID, kind: 'daily', who: WHO, now: T0 });
    assert.equal(tk.ok, true);
    assert.deepEqual([tk.kind, tk.day, tk.solUsd, tk.seed], ['daily', day, 150, V.rankedSeed({ kind: 'daily', day })]);
    assert.deepEqual(calls.at(-1), { fn: 'arcade_take', args: { p_kind: 't', p_who: WHO, p_per_day: 60, p_site_daily: 50000 } });
    // a challenge's: a seed of its own, picked here, never the same twice
    const c1 = await S.gameTicket(cfg, { game: 'trenchingsimulator', player: PID, kind: 'challenge', challenge: 'speedrun', who: WHO, now: T0 });
    const c2 = await S.gameTicket(cfg, { game: 'trenchingsimulator', player: PID, kind: 'challenge', challenge: 'speedrun', who: WHO, now: T0 });
    assert.match(c1.seed, /^speedrun-[0-9a-f]{32}$/);
    assert.notEqual(c1.seed, c2.seed);
    for (const bad of [{ kind: 'free' }, { kind: 'challenge', challenge: 'nope' }, { kind: 'daily', player: 'x' }]) {
      assert.deepEqual(await S.gameTicket(cfg, { game: 'trenchingsimulator', player: PID, who: WHO, now: T0, ...bad }), { ok: false, why: 'bad' });
    }
    db.take = 'person_cap';
    assert.deepEqual(await S.gameTicket(cfg, { game: 'trenchingsimulator', player: PID, kind: 'daily', who: WHO, now: T0 }), { ok: false, why: 'person_cap' });
    db.take = 'ok';
    // the run played in the page with the ticket's seed and price, its orders sent with what it says happened
    const run = createRun({ seed: tk.seed, challenge: dCh(day), mode: 'daily', solUsd: tk.solUsd, currency: 'sol' });
    const frames = [0.016, 0.2, 0.05];
    for (let i = 0; !run.over && i < 80000; i++) {
      run.tick(frames[i % 3]);
      if (i % 41 === 3) {
        const r = run.market.lists({ limit: 3 }).new[0];
        if (r) run.order({ coin: r.id, side: 'buy', sol: 0.05, slippage: 0.2, priority: 'fast' });
      }
      if (i % 67 === 30) {
        const p = run.market.positions().find((x) => x.open);
        if (p) run.order({ coin: p.id, side: 'sell', frac: 1, slippage: 0.5, priority: 'fast' });
      }
    }
    const res = run.result();
    const claim = { outcome: res.outcome, timeUsed: res.timeUsed, worth: res.worth, multiple: res.multiple };
    const body = { game: 'trenchingsimulator', player: PID, ticket: tk.ticket, name: ' Ape Lord ', claim, log: V.packLog(run.market.log()) };
    const after = T0 + (res.timeUsed + 2) * 1000;
    const keys = B.trenchKeys('daily', res);
    assert.ok(keys, `a daily market's ${res.outcome} ranks`);
    calls.length = 0;
    const ok = await S.gameScore(cfg, body, { who: WHO, now: after });
    assert.deepEqual(ok, { ok: true, ranked: true, ranks: { [`daily:${day}`]: 1 }, name: 'Ape Lord', nameRefused: false });
    assert.deepEqual(calls.map((x) => x.fn), ['arcade_take', 'arcade_board_cut', 'arcade_take', 'arcade_score_put']);
    assert.deepEqual(calls[0].args, { p_kind: 's', p_who: WHO, p_per_day: 30, p_site_daily: 20000 }, 'a score, counted');
    assert.deepEqual(calls[2].args, { p_kind: 'p', p_who: WHO, p_per_day: 30, p_site_daily: 2000 }, 'made again: 2,000 a day for the site');
    const put = calls[3].args;
    assert.deepEqual([put.p_boards, put.p_k1, put.p_k2, put.p_detail, put.p_max_uses, put.p_name],
      [[`daily:${day}`], keys.k1, keys.k2, keys.detail, 1, 'Ape Lord']);
    assert.match(put.p_player, /^[A-Za-z0-9_-]{32}$/, 'a code of the browser\'s id, never the id');
    assert.ok(!JSON.stringify(calls).includes(PID));
    // what's refused: a claim that isn't what its orders make, another browser's ticket, a changed ticket, too soon, too late
    const no = async (b, now = after) => S.gameScore(cfg, { ...body, ...b }, { who: WHO, now });
    assert.deepEqual(await no({ claim: { ...claim, worth: claim.worth * 1.01 } }), { ok: false, why: 'replay' });
    assert.deepEqual(await no({ player: 'd'.repeat(32) }), { ok: false, why: 'ticket' });
    const [pl, mac] = tk.ticket.split('.');
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(pl, 'base64url').toString()), s: 'mine' })).toString('base64url');
    assert.deepEqual(await no({ ticket: `${forged}.${mac}` }), { ok: false, why: 'ticket' });
    assert.deepEqual(await no({ ticket: 'nope' }), { ok: false, why: 'ticket' });
    assert.ok(res.timeUsed > 6, `a run of ${res.timeUsed} s`);
    assert.deepEqual(await no({}, T0 + 1000), { ok: false, why: 'fast' }, 'it took less real time than it says');
    assert.deepEqual(await no({}, T0 + (dCh(day).seconds + 1000) * 1000), { ok: false, why: 'late' });
    assert.deepEqual(await no({ log: ['nope'] }), { ok: false, why: 'bad' });
    assert.deepEqual(await no({ claim: { ...claim, outcome: 'quit' } }), { ok: true, ranked: false, why: 'not_ranked' });
    // not better than what it has (or not in the top 100): nothing made again, nothing kept
    db.cut = false;
    calls.length = 0;
    assert.deepEqual(await no({}), { ok: true, ranked: false, why: 'not_better' });
    assert.ok(!calls.some((x) => x.fn === 'arcade_score_put'));
    assert.ok(!calls.some((x) => x.fn === 'arcade_take' && x.args.p_kind === 'p'), 'nothing made again');
    db.cut = true;
    // the site's replays used up for today: not ranked, nothing made again
    let takes = 0;
    db.take = 'ok';
    const realTake = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      if (String(url).endsWith('/arcade_take') && JSON.parse(init.body).p_kind === 'p') { takes++; return new Response('"site_cap"', { status: 200 }); }
      return realTake(url, init);
    };
    calls.length = 0;
    assert.deepEqual(await no({}), { ok: false, why: 'site_cap' });
    assert.equal(takes, 1);
    assert.ok(!calls.some((x) => x.fn === 'arcade_score_put'));
    globalThis.fetch = realTake;
    db.put = { ok: false, why: 'used' };
    assert.deepEqual(await no({}), { ok: false, why: 'used' });
    db.put = null;
    // a name that can't be shown: "A player", and the page is told why
    const named = await no({ name: 'admin' });
    assert.deepEqual([named.ok, named.name, named.nameRefused], [true, null, true]);
    // a board as the page reads it: never who
    globalThis.fetch = async () => new Response(JSON.stringify([{ name: 'Ape Lord', k1: 5, k2: -2, detail: { w: 1, t: 5, m: 2 }, created: '2026-10-22T12:00:00Z', player: 'x' }]), { status: 200 });
    assert.deepEqual(await S.gameBoard(cfg, 'trenchingsimulator', `daily:${day}`), [{ rank: 1, name: 'Ape Lord', detail: { w: 1, t: 5, m: 2 }, at: '2026-10-22T12:00:00Z' }]);
    assert.equal(await S.gameBoard(cfg, 'trenchingsimulator', 'e:all'), null, 'another game\'s board');
  } finally {
    globalThis.fetch = real;
  }
});

test('the leaderboards: each game\'s boards, the order they rank in, what a row says', async () => {
  const B = await import('../src/games/boards.js');
  for (const b of ['daily:2026-10-22', 'c:double-up:all', 'c:double-up:w2026-10-19']) assert.ok(B.isBoard('trenchingsimulator', b), b);
  for (const b of ['e:all', 'e:w2026-10-19', 'e:d2026-10-22', 'm:2026-10-22']) assert.ok(B.isBoard('rideemagi', b), b);
  for (const [g, b] of [['trenchingsimulator', 'e:all'], ['rideemagi', 'daily:2026-10-22'], ['trenchingsimulator', 'daily:x'],
    ['trenchingsimulator', 'c:Double:all'], ['trenchingsimulator', 'c:double-up:week'], ['nope', 'e:all'], ['rideemagi', 7]]) {
    assert.equal(B.isBoard(g, b), false, `${g} ${b}`);
  }
  assert.deepEqual([...B.BOARD_ASK.exec('?board=trenchingsimulator:c:double-up:w2026-10-19')].slice(1), ['trenchingsimulator', 'c:double-up:w2026-10-19']);
  assert.equal(B.BOARD_ASK.exec('?board=trenchingsimulator:daily:2026-10-22&x=1'), null);
  // a week starts on Monday (UTC)
  assert.deepEqual(['2026-10-19', '2026-10-22', '2026-10-25', '2026-10-26'].map(B.mondayOf), ['2026-10-19', '2026-10-19', '2026-10-19', '2026-10-26']);
  assert.equal(B.mondayOf('nope'), null);
  assert.equal(B.dayShift('2026-10-31', 1), '2026-11-01');
  assert.equal(B.dayKeyOf(Date.UTC(2026, 9, 22, 23, 59)), '2026-10-22');
  assert.deepEqual(B.trenchBoards({ kind: 'daily', day: '2026-10-22' }), ['daily:2026-10-22']);
  assert.deepEqual(B.trenchBoards({ kind: 'challenge', challenge: 'double-up', day: '2026-10-22' }), ['c:double-up:all', 'c:double-up:w2026-10-19']);
  // a win by its time then its multiple; the daily market's other runs after every win, by their multiple; a challenge's
  // loss and a run its player ended never rank
  const win = B.trenchKeys('challenge', { outcome: 'won', timeUsed: 161.23, multiple: 2.045678 });
  assert.deepEqual(win, { k1: 161.2, k2: -2.0457, detail: { w: 1, t: 161.2, m: 2.0457 } });
  assert.equal(B.trenchKeys('challenge', { outcome: 'lost', timeUsed: 600, multiple: 3 }), null);
  assert.equal(B.trenchKeys('daily', { outcome: 'quit', timeUsed: 60, multiple: 3 }), null);
  const lost = B.trenchKeys('daily', { outcome: 'lost', timeUsed: 600, multiple: 1.8 });
  assert.deepEqual(lost, { k1: 99998.2, k2: 0, detail: { w: 0, t: 600, m: 1.8 } });
  assert.ok(B.trenchKeys('daily', { outcome: 'won', timeUsed: 1799.9, multiple: 1.01 }).k1 < lost.k1, 'every win first');
  assert.ok(B.trenchKeys('daily', { outcome: 'busted', timeUsed: 9, multiple: 0.001 }));
  assert.equal(B.trenchKeys('daily', null), null);
  assert.deepEqual(B.rideBoards({ mode: 'endless', day: '2026-10-22' }), ['e:all', 'e:w2026-10-19', 'e:d2026-10-22']);
  assert.deepEqual(B.rideBoards({ mode: 'daily', day: '2026-10-22', date: '2026-10-21' }), ['m:2026-10-21']);
  assert.deepEqual(B.rideKeys({ dist: 6151, score: 119189 }), { k1: -6151, k2: -119189, detail: { d: 6151, s: 119189 } });
  // what a row says
  assert.equal(B.rowText('trenchingsimulator', { w: 1, t: 161.2, m: 10.2 }), '2:41 · 10.2x');
  assert.equal(B.rowText('trenchingsimulator', { w: 0, t: 600, m: 0.85 }), '0.85x');
  assert.equal(B.rowText('trenchingsimulator', { w: 1, t: 59.5, m: 3 }), '0:59 · 3x');
  assert.equal(B.rowText('trenchingsimulator', { w: 1, t: 600, m: 100.4 }), '10:00 · 100x');
  assert.equal(B.rowText('rideemagi', { d: 6151, s: 119189 }), '6,151 m · 119,189');
  assert.equal(B.rowText('rideemagi', {}), '—');
  assert.equal(B.rowText('trenchingsimulator', null), '—');
  assert.equal(B.rowName(null), 'A player');
  assert.equal(B.rowName('Ape Lord'), 'Ape Lord');
  assert.equal(B.boardTitle('trenchingsimulator', 'c:double-up:w2026-10-19', 'Double up'), 'Double up · This week');
  assert.equal(B.boardTitle('trenchingsimulator', 'daily:2026-10-22'), 'Daily market · 2026-10-22');
  assert.equal(B.boardTitle('rideemagi', 'e:d2026-10-22'), 'Endless · Today');
  assert.equal(B.BOARD.top, 20);
  assert.ok(B.BOARD.bodyMax <= 48000 && B.BOARD.logMax === 1000);
  assert.equal(B.BOARD.site.replays, 2000, 'the runs our server makes again: 2,000 a day for the site (code-leaderboard.md)');
  // agi1.app/games's pickers: TRENCHING SIMULATOR's daily market (a UTC day), then each challenge's week and all time;
  // Ride 'Em, AGI!'s endless runs (UTC) and the daily mod of the player's own day; every one a board our server reads
  const { CHALLENGES } = await import('../src/games/trenchingsimulator/challenges.js');
  const now = Date.UTC(2026, 9, 22, 23, 30);            // a Thursday, late (UTC)
  const ts = B.pickerBoards('trenchingsimulator', { now, challenges: CHALLENGES });
  assert.equal(ts.length, 1 + 2 * CHALLENGES.length);
  assert.deepEqual(ts[0], { board: 'daily:2026-10-22', title: 'Daily market · 2026-10-22' });
  assert.deepEqual(ts[1], { board: 'c:first-blood:w2026-10-19', title: 'First blood · This week' });
  assert.deepEqual(ts.at(-1), { board: 'c:ten-bagger:all', title: '10x in 30 · All time' });
  assert.equal(new Set(ts.map((x) => x.board)).size, ts.length, 'each once');
  for (const { board } of ts) assert.ok(B.isBoard('trenchingsimulator', board), board);
  const ride = B.pickerBoards('rideemagi', { now, localDay: '2026-10-23' });
  assert.deepEqual(ride, [{ board: 'e:d2026-10-22', title: 'Endless · Today' }, { board: 'e:w2026-10-19', title: 'Endless · This week' },
    { board: 'e:all', title: 'Endless · All time' }, { board: 'm:2026-10-23', title: 'Daily mod · 2026-10-23' }]);
  assert.equal(B.pickerBoards('rideemagi', { now, localDay: 'nope' }).at(-1).board, 'm:2026-10-22', 'an odd local day: ours');
  assert.deepEqual(B.pickerBoards('nope', { now }), []);
  assert.deepEqual(B.pickerBoards('trenchingsimulator', { now }), [{ board: 'daily:2026-10-22', title: 'Daily market · 2026-10-22' }]);
  // this browser's own place on the board it shows
  assert.equal(B.mineText('trenchingsimulator', { board: 'daily:2026-10-22', rank: 37, detail: { w: 1, t: 161.2, m: 10.2 }, hidden: false }), 'Your best here: #37 · 2:41 · 10.2x');
  assert.equal(B.mineText('rideemagi', { rank: 1200, detail: { d: 6151, s: 119189 } }), 'Your best here: #1,200 · 6,151 m · 119,189');
  assert.equal(B.mineText('rideemagi', { rank: 3, detail: { d: 10, s: 10 }, hidden: true }), 'Your run on this board was taken off it.');
  assert.equal(B.mineText('rideemagi', null), 'You\'re not on this board yet.');
});

// (agi1.app/games's leaderboards, src/games/leaderboard.js: its page is tests/page.test.js's; run here on a stand-in page)
test('the leaderboards on agi1.app/games: each game\'s boards to pick, its top rows, your own place only once you\'ve played, the optional name', async () => {
  class Node {
    constructor(tag, attrs = {}) {
      this.tagName = tag.toUpperCase(); this.attrs = attrs; this.kids = []; this.textContent = ''; this.className = '';
      this.hidden = 'hidden' in attrs; this.on = {}; this.val = '';
      this.dataset = Object.fromEntries(Object.entries(attrs).filter(([k]) => k.startsWith('data-'))
        .map(([k, v]) => [k.slice(5).replace(/-(\w)/g, (_, c) => c.toUpperCase()), v]));
    }
    get value() { return this.tagName === 'SELECT' ? (this.val || this.kids[0]?.value || '') : this.val; }
    set value(v) { this.val = v; }
    append(...n) { this.kids.push(...n); }
    replaceChildren(...n) { this.kids = n; }
    addEventListener(type, fn) { (this.on[type] ||= []).push(fn); }
    fire(type, e = {}) { for (const fn of this.on[type] || []) fn({ preventDefault() {}, ...e }); }
    all() { return this.kids.flatMap((k) => [k, ...k.all()]); }
    querySelectorAll(sel) { const a = /^\[([a-z-]+)\]$/.exec(sel)[1]; return this.all().filter((k) => a in k.attrs); }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  }
  const box = (id) => {
    const b = new Node('section', { 'data-gm-lb': id });
    b.append(new Node('select', { 'data-gm-lb-pick': '' }), new Node('p', { 'data-gm-lb-state': '' }), new Node('ol', { 'data-gm-lb-list': '' }),
      new Node('p', { 'data-gm-lb-me': '', hidden: '' }));
    return b;
  };
  const root = new Node('section', { 'data-gm-lead': '' });
  const nameIn = new Node('input', { 'data-gm-lb-name': '' });
  const save = new Node('button', { 'data-gm-lb-save': '' });
  const say = new Node('p', { 'data-gm-lb-name-say': '' });
  root.append(box('rideemagi'), box('trenchingsimulator'), nameIn, save, say);
  const kept = new Map([['agi_player_name', 'Neo']]);
  const storage = { getItem: (k) => (kept.has(k) ? kept.get(k) : null), setItem: (k, v) => kept.set(k, String(v)), removeItem: (k) => kept.delete(k) };
  const asked = [];
  let board = { ready: true, rows: [{ rank: 1, name: 'Ape Lord', detail: { d: 6151, s: 119189 } }, { rank: 2, name: null, detail: { d: 900, s: 20000 } }] };
  const had = { document: globalThis.document, window: globalThis.window, fetch: globalThis.fetch, addEventListener: globalThis.addEventListener };
  globalThis.document = { createElement: (tag) => new Node(tag), querySelector: (sel) => (sel === '[data-gm-lead]' ? root : null) };
  globalThis.window = { localStorage: storage };
  globalThis.addEventListener = () => {};
  globalThis.fetch = async (url, init) => {
    if (!init) { asked.push({ url }); return new Response(JSON.stringify(board), { status: 200 }); }
    const body = JSON.parse(init.body);
    asked.push({ url, body });
    return new Response(JSON.stringify({ ok: true, rows: [{ board: body.boards[0], rank: 37, detail: { d: 800, s: 9000 }, hidden: false }] }), { status: 200 });
  };
  const settle = async () => { for (let i = 0; i < 30; i++) await new Promise((r) => setImmediate(r)); };
  const [ride, ts] = root.kids;
  const part = (b, a) => b.querySelector(`[${a}]`);
  try {
    const { startBoards } = await import('../src/games/leaderboard.js');
    startBoards();
    await settle();
    // each game's boards to pick (Ride 'Em, AGI!: 4; TRENCHING SIMULATOR: its daily market and each challenge's week and all time)
    assert.deepEqual(part(ride, 'data-gm-lb-pick').kids.map((o) => o.textContent), ['Endless · Today', 'Endless · This week', 'Endless · All time', part(ride, 'data-gm-lb-pick').kids[3].textContent]);
    assert.match(part(ride, 'data-gm-lb-pick').kids[3].textContent, /^Daily mod · \d{4}-\d{2}-\d{2}$/);
    assert.equal(part(ts, 'data-gm-lb-pick').kids.length, 19);
    assert.match(part(ts, 'data-gm-lb-pick').kids[0].value, /^daily:\d{4}-\d{2}-\d{2}$/);
    // the first board of each, read from our server (shared by the CDN), and nothing else asked: this browser hasn't played
    assert.deepEqual(asked.map((x) => x.url).sort(), [`/api/wallet?board=rideemagi:${part(ride, 'data-gm-lb-pick').value}`,
      `/api/wallet?board=trenchingsimulator:${part(ts, 'data-gm-lb-pick').value}`].sort());
    const rows = part(ride, 'data-gm-lb-list').kids.map((li) => li.kids.map((s) => s.textContent));
    assert.deepEqual(rows, [['1', 'Ape Lord', '6,151 m · 119,189'], ['2', 'A player', '900 m · 20,000']]);
    assert.equal(part(ride, 'data-gm-lb-state').textContent, '');
    assert.equal(part(ride, 'data-gm-lb-me').hidden, true, 'no place to show: never played here');
    // once it has played (its random id for the games): its own place on the board it shows, asked for that board only
    kept.set('agi_player', 'a'.repeat(32));
    asked.length = 0;
    part(ride, 'data-gm-lb-pick').value = 'e:all';
    part(ride, 'data-gm-lb-pick').fire('change');
    await settle();
    assert.deepEqual(asked.map((x) => x.body || x.url), ['/api/wallet?board=rideemagi:e:all',
      { action: 'game-score-mine', game: 'rideemagi', player: 'a'.repeat(32), boards: ['e:all'] }]);
    assert.equal(part(ride, 'data-gm-lb-me').hidden, false);
    assert.equal(part(ride, 'data-gm-lb-me').textContent, 'Your best here: #37 · 800 m · 9,000');
    // a board shown again within the CDN's minute: the one we have, nothing asked
    asked.length = 0;
    part(ride, 'data-gm-lb-pick').value = 'e:all';
    part(ride, 'data-gm-lb-pick').fire('change');
    await settle();
    assert.deepEqual(asked, []);
    // the leaderboards not set up yet (arcade.sql not run): "open soon", and no place asked
    board = { ready: false };
    asked.length = 0;
    part(ts, 'data-gm-lb-pick').value = part(ts, 'data-gm-lb-pick').kids[18].value;
    part(ts, 'data-gm-lb-pick').fire('change');
    await settle();
    assert.equal(part(ts, 'data-gm-lb-state').textContent, 'Leaderboards open soon. You can play now.');
    assert.deepEqual(part(ts, 'data-gm-lb-list').kids, []);
    assert.equal(asked.length, 1, 'no place asked while they aren\'t open');
    // the optional name, both games': what this browser keeps, saved when it's fine, refused when it isn't
    assert.equal(nameIn.value, 'Neo');
    nameIn.value = '  Ape   Lord ';
    save.fire('click');
    assert.equal(kept.get('agi_player_name'), 'Ape Lord');
    assert.equal(nameIn.value, 'Ape Lord');
    assert.equal(say.textContent, 'Saved. Your next ranked runs say “Ape Lord”.');
    nameIn.value = 'the real admin';
    nameIn.fire('keydown', { key: 'Enter' });
    assert.match(say.textContent, /^That name can't be used/);
    assert.equal(kept.get('agi_player_name'), 'Ape Lord', 'nothing changed');
    nameIn.value = '';
    save.fire('click');
    assert.equal(kept.has('agi_player_name'), false);
    assert.equal(say.textContent, 'No name: your rows say “A player”.');
  } finally {
    for (const [k, v] of Object.entries(had)) { if (v === undefined) delete globalThis[k]; else globalThis[k] = v; }
  }
});

test('all six terminals are ready and their boards load only when played', () => {
  assert.equal(terminalById('scan').ready, true);
  assert.equal(terminalById('social').ready, true);
  assert.deepEqual(TERMINALS.filter((t) => t.ready).map((t) => t.id), [...TERMINAL_IDS]);
  const shell = readFileSync('src/games/trenchingsimulator/shell.js', 'utf8');
  assert.match(shell, /t\.id === 'scan' \? import\('\.\/boards\/gngm\.js'\)\.then\(\(m\) => m\.mountGngm, \(\) => null\)/);
  for (const [id, file, mount] of [['pro', 'axium', 'mountAxium'], ['chat', 'basedbott', 'mountBasedbott'], ['clank', 'clank', 'mountClank']]) {
    assert.ok(shell.includes(`t.id === '${id}' ? import('./boards/${file}.js').then((m) => m.${mount}`), `${id} has its own board`);
  }
  assert.match(shell, /t\.id === 'social' \? import\('\.\/boards\/phomo\.js'\)\.then\(\(m\) => m\.mountPhomo, \(\) => null\)/);
  assert.doesNotMatch(shell, /^import .*gngm/m, 'never in the page until it\'s played');
  assert.doesNotMatch(shell, /^import .*phomo/m, 'Phomo loads only when played');
  assert.match(shell, /P\.board = mount\(boardHost, \{/);
  // its own words in its header, and the doors the shell calls
  const g = readFileSync('src/games/trenchingsimulator/boards/gngm.js', 'utf8');
  assert.match(g, /markEl\('scan', 'tsg-logo'\), wordEl\('scan', 'tsg-brand-t'\)/);
  assert.match(g, /^export function mountGngm\(host, ctx\)/m);
  for (const door of ['el: root', 'update(now)', 'sub: () =>', 'closeSub: () =>', 'openCoin,', 'destroy()']) assert.ok(g.includes(door), door);
  const phomo = readFileSync('src/games/trenchingsimulator/boards/phomo.js', 'utf8');
  assert.match(phomo, /^export function mountPhomo\(host, ctx\)/m);
  for (const door of ['el: root', 'update(now)', 'sub: () =>', 'closeSub: () =>', 'openCoin,', 'destroy()']) assert.ok(phomo.includes(door), `Phomo: ${door}`);
  // its colors: every one GNGM's own, every word readable on its page and panels
  const c = terminalById('scan').colors;
  for (const on of ['bg', 'panel', 'panel2']) {
    for (const k of ['text', 'soft', 'muted', 'dim', 'accent', 'up', 'down', 'warn', 'info', 'violet']) {
      assert.ok(contrast(c[k], c[on]) >= 4.5, `GNGM ${k} on ${on}: ${contrast(c[k], c[on]).toFixed(2)}`);
    }
  }
  assert.ok(contrast('#062013', c.up) >= 4.5 && contrast(c.onDown, c.down) >= 4.5 && contrast(c.onAccent, c.accent) >= 4.5, 'words on its buttons');
});
