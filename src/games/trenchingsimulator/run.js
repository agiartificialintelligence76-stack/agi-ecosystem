// TRENCHING SIMULATOR's run (2026-10-20): one game, from its start to its result. It owns the market (./engine.js),
// moves its clock (paused when the page is hidden, faster in free play), places the player's orders, and turns what
// happens into events the screen reacts to: an order filled or failed, a rug, a migration, the dev or a caller on a
// coin the player holds, a milestone, the last minute, the end. It decides the challenge (./challenges.js): won the
// moment a goal is reached, lost when time is up, busted when there's nothing left to trade with, or cashed out.
// Pure: no DOM, no clock of its own (the screen passes the time), read in Node too (tests/trench-game.test.js).
//
// Live mode (2026-10-21, #404): `makeMarket` makes its market instead (./live-market.js: real coins, play money), and
// `realTime` makes its clock the real one: one speed, never paused (a pause sheet doesn't stop it, nor does a hidden
// tab: the real market never waits), so a challenge's time is always the time that passed. `live` is its chain.
import { createMarket, MIN_BUY, PRIORITY, BASE_FEE } from './engine.js';
import { goalState, starsFor, startSolFor, atEnd, SPEEDS } from './challenges.js';
import { money, pct } from './format.js';

// the least a buy can be, with its fees held for it (the cheapest priority): under this and nothing left, it's over
export const BUST_SOL = MIN_BUY + 2 * (PRIORITY.fast.fee + BASE_FEE);
export const MILESTONES = Object.freeze([1.5, 2, 3, 5, 10]);
export const DOWN_AT = 0.5;
export const MAX_DT = 0.25; // the most one tick moves the clock (a slow frame never jumps the market ahead)
const IDLE_AFTER = 40; // seconds without an order before AGI-1 says something
const IDLE_EVERY = 90;

const clampSpeed = (x) => (SPEEDS.includes(x) ? x : 1);

// createRun({ seed, solUsd, mode: 'challenge'|'daily'|'free', challenge, startSol, speed, currency, config, terminal,
//   live, makeMarket, realTime })
export function createRun({ seed, solUsd = 150, mode = 'free', challenge = null, startSol = 1, speed = 1,
  currency = 'sol', config = {}, terminal = 'board', live = null, makeMarket = null, realTime = false } = {}) {
  const ch = mode === 'free' ? null : challenge;
  const px = Number.isFinite(solUsd) && solUsd > 0 ? solUsd : 150;
  // (in a chain's own coin, a challenge's SOL start is a round amount of it: ./challenges.js)
  const start = ch ? startSolFor(ch, px, currency) : Number.isFinite(startSol) && startSol > 0 ? startSol : 1;
  const opts = { seed, solUsd: px, startSol: start, config };
  const market = typeof makeMarket === 'function' ? makeMarket(opts) : createMarket(opts);
  const seconds = ch ? ch.seconds : null;
  const real = Boolean(realTime);

  const R = {
    clock: 0, us: 0, speed: mode === 'free' && !real ? clampSpeed(speed) : 1, paused: false, over: false, outcome: null,
    reason: null, endedAt: null,
    feedSeq: market.feedSeq, events: [], peak: start, low: start,
    hit: new Set(), down: false, close: false, lastMinute: false, countdown: 11,
    pending: new Set(), placed: 0, filled: 0, failed: 0, lastAction: 0, lastIdle: -Infinity,
    traded: new Set(), heldThrough: new Set(), rugHit: null, migrationWin: null, best: null, realized: new Map(),
  };
  const push = (e) => R.events.push({ at: R.clock, ...e });
  push({ type: 'start', mode, challenge: ch ? ch.id : null, start });

  const openIds = () => {
    const s = new Set();
    for (const p of market.positions()) if (p.open) s.add(p.id);
    return s;
  };

  // the run as goalState() reads it
  function snapshot(timeUp = false) {
    const positions = market.positions().map((p) => {
      const out = { id: p.id, ticker: p.ticker, invested: p.invested, sold: p.sold, total: p.total, open: p.open,
        heldThrough: R.heldThrough.has(p.id) };
      if (p.open && ch && ch.goal.kind === 'migration') out.progress = market.row(p.id).progress;
      return out;
    });
    return {
      worth: market.player.worth, start, solUsd: px, timeUp, positions,
      flags: { migrationWin: Boolean(R.migrationWin), rugHit: Boolean(R.rugHit), coinsTraded: R.traded.size },
    };
  }

  function finish(outcome, extra = {}) {
    if (R.over) return;
    R.over = true;
    R.outcome = outcome;
    R.reason = extra.reason || null;
    R.endedAt = R.clock;
    push({ type: 'end', outcome, ...extra });
  }

  // an order that landed: its event, and what it means for the challenge
  function landed(o) {
    R.pending.delete(o.id);
    if (o.status === 'filled') {
      R.filled++;
      const first = R.filled === 1;
      if (o.side === 'buy') {
        R.traded.add(o.coin);
        push({ type: 'fill', order: o, first });
      } else {
        const p = market.positions().find((x) => x.id === o.coin);
        // what this sell made or lost (its coin's realized P&L since the last sell we saw), whether it closed the
        // position, and the position's whole result so far
        const before = R.realized.get(o.coin) || 0;
        const pnl = p ? p.realized - before : 0;
        if (p) R.realized.set(o.coin, p.realized);
        push({ type: 'fill', order: o, first, pnl, closed: p ? !p.open : true, total: p ? p.total : 0 });
        // the migration challenge: a sell after the coin's migration, of a coin held while it migrated, in profit
        if (p && R.heldThrough.has(o.coin) && p.total > 0) {
          const st = market.row(o.coin);
          if (st && st.migratedAt !== null && o.doneAt >= st.migratedAt) R.migrationWin = { coin: o.coin, ticker: o.ticker };
        }
        if (p && p.invested > 0) {
          const x = p.sold / p.invested;
          if (!R.best || x > R.best.x) R.best = { coin: o.coin, ticker: o.ticker, x };
        }
      }
    } else {
      R.failed++;
      push({ type: 'fail', order: o, reason: o.reason });
    }
  }

  function checkOrders() {
    if (!R.pending.size) return;
    const want = new Set(R.pending);
    for (const o of market.orders(100)) {
      if (!want.has(o.id) || o.status === 'pending') continue;
      want.delete(o.id);
      landed(o);
    }
    // an order too old to be in the newest 100 (never in a real run): read once more from the whole list
    if (want.size && market.player.pending === 0) {
      for (const o of market.orders(300)) if (want.has(o.id) && o.status !== 'pending') landed(o);
      for (const id of want) R.pending.delete(id);
    }
  }

  function checkFeed() {
    const items = market.feed(R.feedSeq);
    if (!items.length) return;
    R.feedSeq = items[items.length - 1].q;
    let open = null;
    for (const e of items) {
      if (e.c === null) continue;
      if (!open) open = openIds();
      const held = open.has(e.c);
      if (!held) continue;
      switch (e.kind) {
        case 'rug':
          if (!R.rugHit) R.rugHit = { coin: e.c, ticker: e.ticker };
          push({ type: 'rug', coin: e.c, ticker: e.ticker });
          break;
        case 'migrate':
          R.heldThrough.add(e.c);
          push({ type: 'migrating', coin: e.c, ticker: e.ticker });
          break;
        case 'migrated':
          R.heldThrough.add(e.c);
          push({ type: 'migrated', coin: e.c, ticker: e.ticker });
          break;
        case 'dev_sell':
          push({ type: 'dev_sell', coin: e.c, ticker: e.ticker, frac: e.frac });
          break;
        case 'kol_buy':
          push({ type: 'kol_buy', coin: e.c, ticker: e.ticker, kol: e.kol });
          break;
        case 'cto':
          push({ type: 'cto', coin: e.c, ticker: e.ticker });
          break;
        case 'dex_paid':
          push({ type: 'dex_paid', coin: e.c, ticker: e.ticker });
          break;
        default:
          break;
      }
    }
  }

  function checkWorth() {
    const w = market.player.worth;
    if (w > R.peak) R.peak = w;
    if (w < R.low) R.low = w;
    const x = w / start;
    for (const m of MILESTONES) {
      if (x >= m && !R.hit.has(m)) {
        R.hit.add(m);
        push({ type: 'milestone', x: m });
      }
    }
    if (!R.down && x <= DOWN_AT) {
      R.down = true;
      push({ type: 'down', x: DOWN_AT });
    }
  }

  function checkGoal() {
    if (!ch) return;
    const g = goalState(ch.goal, snapshot(false));
    if (g.failed) return finish('lost', { reason: 'rug' });
    if (g.done && !atEnd(ch.goal)) return finish('won');
    if (!R.close && g.frac >= 0.8 && !g.done) {
      R.close = true;
      push({ type: 'close' });
    }
  }

  function checkTime() {
    if (seconds === null) return;
    const left = seconds - R.clock;
    if (!R.lastMinute && seconds > 120 && left <= 60 && left > 0) {
      R.lastMinute = true;
      push({ type: 'last_minute' });
    }
    const s = Math.ceil(left - 1e-9);
    if (s >= 1 && s <= 10 && s < R.countdown) {
      R.countdown = s;
      push({ type: 'countdown', s });
    }
    if (left <= 1e-9) {
      const g = goalState(ch.goal, snapshot(true));
      if (g.done) finish('won');
      else finish('lost', { reason: g.failed ? 'rug' : 'time' });
    }
  }

  function checkBust() {
    const p = market.player;
    if (p.pending > 0 || R.pending.size) return;
    if (p.sol >= BUST_SOL) return;
    for (const x of market.positions()) if (x.open) return;
    finish('busted');
  }

  function checkIdle() {
    if (R.clock - R.lastAction >= IDLE_AFTER && R.clock - R.lastIdle >= IDLE_EVERY) {
      R.lastIdle = R.clock;
      push({ type: 'idle' });
    }
  }

  const run = {
    market,
    mode,
    challenge: ch,
    seed: market.seed,
    solUsd: px,
    start,
    seconds,
    currency,
    terminal,
    live,
    realTime: real,
    get clock() {
      return R.clock;
    },
    get left() {
      return seconds === null ? null : Math.max(0, seconds - R.clock);
    },
    get over() {
      return R.over;
    },
    get outcome() {
      return R.outcome;
    },
    get paused() {
      return R.paused;
    },
    get speed() {
      return R.speed;
    },
    get peak() {
      return R.peak;
    },
    // the clock moves on by dt seconds of the page's time (× the speed, at most MAX_DT a tick)
    tick(dt) {
      if (R.over || R.paused) return 0;
      // a live run: the real time that passed (a hidden tab's too); else at most MAX_DT a tick
      const d = Math.min(real ? 3600 : MAX_DT, Math.max(0, Number(dt) || 0)) * R.speed;
      if (!(d > 0)) return 0;
      // kept in whole microseconds: a clock made of 1/60 s steps adds up exactly (10 minutes end at 600 s, not 599.99…)
      R.us += Math.round(d * 1e6);
      if (seconds !== null && R.us > seconds * 1e6) R.us = seconds * 1e6;
      R.clock = R.us / 1e6;
      const steps = market.advanceTo(R.clock);
      checkOrders();
      checkFeed();
      checkWorth();
      checkGoal();
      if (!R.over) checkTime();
      if (!R.over) checkBust();
      if (!R.over) checkIdle();
      return steps;
    },
    // an order through the market, its landing watched (→ a fill or a fail event)
    order(params) {
      if (R.over) return { ok: false, error: 'over' };
      const r = market.order(params);
      if (r.ok) {
        R.placed++;
        R.pending.add(r.order.id);
        R.lastAction = R.clock;
      }
      return r;
    },
    quote: (p) => market.quote(p),
    // what happened since the last drain, oldest first
    drain() {
      const out = R.events;
      R.events = [];
      return out;
    },
    // (a live run's clock is the real one: it never stops)
    pause() {
      if (!real) R.paused = true;
    },
    resume() {
      R.paused = false;
    },
    // free play only; a speed it doesn't have changes nothing
    setSpeed(x) {
      const v = Number(x);
      if (mode === 'free' && !real && SPEEDS.includes(v)) R.speed = v;
      return R.speed;
    },
    // free play's Cash out, or leaving a challenge
    end(kind = 'cashed') {
      if (R.over) return;
      if (kind === 'cashed' && mode === 'free') finish('cashed');
      else finish('quit');
    },
    // the challenge's goal now: how far along (0…1) and its words, in the terminal's money
    progress() {
      if (!ch) {
        const w = market.player.worth;
        return { frac: null, label: `${pct(w / start - 1)} so far` };
      }
      const snap = snapshot(R.over && R.outcome !== 'won' ? true : false);
      const g = goalState(ch.goal, snap);
      const w = snap.worth;
      let label = '';
      switch (ch.goal.kind) {
        case 'worth':
          label = `${money(w, currency, px)} / ${money(start * ch.goal.x, currency, px)}`;
          break;
        case 'profitUsd':
          label = `${money(w - start, 'usd', px).replace(/^(?=\$)/, w >= start ? '+' : '')} / +$${ch.goal.usd}`;
          break;
        case 'takeProfit': {
          const best = snap.positions.reduce((b, p) => (p.invested > 0 ? Math.max(b, p.sold / p.invested) : b), 0);
          label = `best sold ${best.toFixed(2)}x / ${ch.goal.x}x`;
          break;
        }
        case 'migration':
          label = R.migrationWin ? 'done' : R.heldThrough.size ? 'migrated: sell in profit' : 'hold a coin through its migration';
          break;
        case 'survive':
          label = `${Math.min(R.traded.size, ch.goal.coins)}/${ch.goal.coins} coins · ${pct(w / start - 1)}`;
          break;
        default:
          break;
      }
      return { frac: g.frac, done: g.done, failed: g.failed, label };
    },
    // the HUD's numbers
    hud() {
      const p = market.player;
      const w = p.worth;
      let open = 0;
      for (const x of market.positions()) if (x.open) open++;
      return {
        clock: R.clock, left: seconds === null ? null : Math.max(0, seconds - R.clock), worth: w, sol: p.sol,
        held: p.held, pending: p.pending, open, start, multiple: w / start, pnl: w - start, pnlPct: w / start - 1,
        pnlUsd: (w - start) * px, peak: R.peak, over: R.over, outcome: R.outcome,
      };
    },
    // everything the results screen shows
    result() {
      const p = market.player;
      const w = p.worth;
      const pos = market.positions();
      let wins = 0;
      let losses = 0;
      let best = null;
      let worst = null;
      for (const x of pos) {
        if (x.invested <= 0) continue;
        if (x.total > 0) wins++;
        else losses++;
        if (!best || x.total > best.total) best = x;
        if (!worst || x.total < worst.total) worst = x;
      }
      const timeUsed = R.endedAt !== null ? R.endedAt : R.clock;
      const multiple = w / start;
      const stars = R.outcome === 'won' && ch ? starsFor(ch, { timeUsed, multiple }) : 0;
      const pick = (x) => (x ? { id: x.id, ticker: x.ticker, emoji: x.emoji, total: x.total, pnlPct: x.pnlPct } : null);
      // what it paid: the terminal's and the market's fees, priority and network fees (a failed order's too), as one
      // number; what a sandwich bot took isn't a fee (`mev`, its own)
      const f = p.fees || {};
      const num = (x) => (Number.isFinite(x) ? x : 0);
      const fees = num(f.terminal) + num(f.market) + num(f.priority) + num(f.failed);
      return {
        mode, challenge: ch ? ch.id : null, daily: ch && ch.daily ? ch.daily : null, outcome: R.outcome || 'playing',
        reason: R.reason, stars, start, worth: w, peak: R.peak, low: R.low, multiple, pnl: w - start, pnlUsd: (w - start) * px,
        timeUsed, seconds, placed: R.placed, filled: R.filled, failed: R.failed, coins: R.traded.size, wins, losses,
        best: pick(best), worst: pick(worst), fees, mev: num(f.mev), feeParts: { ...f }, seed: market.seed, solUsd: px,
        currency, terminal, equity: market.equity(0),
        // Live mode: its chain, and how many real coins were traded in it
        ...(live ? { live, liveTraded: typeof market.liveTraded === 'function' ? market.liveTraded() : 0 } : {}),
      };
    },
    // the challenge's flags (for tests and the results)
    get flags() {
      return { coinsTraded: R.traded.size, rugHit: R.rugHit, migrationWin: R.migrationWin,
        heldThrough: [...R.heldThrough], best: R.best };
    },
  };
  return run;
}
