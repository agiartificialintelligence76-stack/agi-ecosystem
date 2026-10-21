// TRENCHING SIMULATOR's AGI-1 (2026-10-20): what she says while you trade, from what the run tells the screen (its
// events: ./run.js). Pre-written (no AI, nothing sent anywhere), PG-13, in her lowercase texting voice with her 💜 and
// 🙈; she reacts to what just happened and cheers, and never tells anyone to buy or sell (the coins and the money are
// simulated, and she still never sounds like a tip); now and then she says it's play money. A coin is named by its
// made-up ticker. Pure: read in Node too (tests/trench-game.test.js holds every line to these rules).
import { moneySigned } from './format.js';

// Each key: her lines for it, and her face while she says it (the 8-bit face in the HUD: ./agi.js)
export const LINES = Object.freeze({
  start: ['play money, real vibes 💜 let\'s see what you\'ve got', 'i\'ll be right here watching the charts with you 💜',
    'deep breath. it\'s all play money, so have fun 🙈', 'new coins every few seconds. pick your fighters 💜',
    'okay, the trenches are open 💜 good luck'],
  startFree: ['free play 💜 no timer, no goal, just vibes', 'your bag, your rules. it\'s play money 🙈',
    'no clock this time. take it slow, or don\'t 💜'],
  startDaily: ['the daily market 💜 same coins for everyone today', 'today\'s market is the same for everyone. no pressure 🙈',
    'daily run 💜 everyone gets these exact coins today'],
  firstBuy: ['first bag of the run 💜 {ticker}, huh?', 'ooh, {ticker}. i like the name 🙈', 'and we\'re in. {ticker} it is 💜'],
  buy: ['{ticker} added 💜', 'another one. {ticker} 👀', 'bag secured: {ticker} 💜', 'okay okay, {ticker} 🙈'],
  sellWin: ['{pnl} on {ticker} 💜 look at you', 'that\'s a win on {ticker} 🎉', 'green on {ticker} 💚 i\'m clapping',
    'profit is profit 💜 nice one on {ticker}'],
  sellLoss: ['{ticker} didn\'t love us back 🙈', 'a little red on {ticker}. it happens 💜', 'out of {ticker}. we move 💜',
    'every trench has a few of those 🙈'],
  failSlip: ['slippage got that one 🙈 the price moved too fast', 'that order bounced: the price ran past your slippage',
    'missed it by a candle 🙈 slippage'],
  failMigrating: ['{ticker} is migrating right now: nothing trades for a moment', 'can\'t trade {ticker} mid-migration 🙈 give it a second'],
  failOther: ['that one didn\'t go through 🙈', 'order failed. the trenches are like that sometimes'],
  rug: ['oh no. {ticker} just rugged 💔', '{ticker} got rugged. i\'m so sorry 🙈', 'rug on {ticker} 💔 that one hurt'],
  migrating: ['{ticker} filled its curve 👀 it\'s migrating', '{ticker} is graduating 🎓 hold on', 'bonding curve complete on {ticker} 💜'],
  migrated: ['{ticker} made it to the pool 🎓💜', '{ticker} migrated. a whole new chart 👀'],
  devSell: ['the dev just sold some {ticker} 👀', 'dev wallet moving on {ticker}. just saying 👀', '{ticker}\'s dev sold. noted 🙈'],
  kolBuy: ['{kol} just bought {ticker} 👀', 'a caller is in {ticker}: {kol} 👀'],
  cto: ['the community took over {ticker} 💜', '{ticker} has a new crew running it now'],
  dexPaid: ['{ticker} paid for its screener page 👀', 'dex paid on {ticker}. fancy 💅'],
  x1_5: ['up 50% 💜 we\'re cooking', 'half again! 🙈', '1.5x the bag 💜'],
  x2: ['you doubled it 🎉', '2x 💜 i\'m screaming', 'double up 💜 look at that'],
  x3: ['3x?? okay trader 🙈', 'triple 💜 who are you'],
  x5: ['5x. i need to sit down 🙈', 'five times your start 💜'],
  x10: ['10x 💜💜💜 legend behavior', 'ten times. you\'re a legend 🎉'],
  down: ['down half 🙈 deep breath, it\'s play money', 'rough patch. the trenches test everyone 💜',
    'we\'ve seen better charts 🙈 still here with you'],
  close: ['so close to the goal 👀💜', 'almost there! i can feel it 🙈'],
  lastMinute: ['one minute left 👀', 'last minute! 💜'],
  countdown: ['ten seconds 👀'],
  idle: ['the coins won\'t trade themselves 🙈', 'just watching? that\'s allowed 💜', 'new launches keep popping up 👀',
    'take your time. i\'ll be here 💜'],
  won: ['you did it 🎉💜 challenge complete', 'goal hit! i knew you had it 💜', 'winner 🏆 play money, real skills'],
  lostTime: ['time\'s up 🙈 so close. one more?', 'the clock won this one. rematch? 💜', 'out of time. the trenches will be here 💜'],
  lostRug: ['that rug ended the run 💔 it happens to everyone', 'rugged out. next one\'s yours 💜'],
  busted: ['out of SOL 🙈 it\'s only play money. run it back?', 'busted. the trenches were cruel today 💜'],
  cashed: ['cashed out 💜 nice session', 'and that\'s the session 💜 see you in the trenches'],
  quit: ['see you next time 💜', 'leaving already? i\'ll keep the charts warm 🙈'],
});

// Live mode (2026-10-21, #404): her lines about a real coin never name it (no {ticker}, no {kol}: the owner's rule), and
// a live run starts with its own words. A made-up stand-in in a live run is still named; a real coin's rug, dev sell,
// caller, takeover or paid page is never something she says (the game never claims them about a real coin).
export const LIVE_LINES = Object.freeze({
  start: ['these coins are real, your money isn\'t 🙈 have fun', 'live coins, play money 💜 nothing here leaves this page',
    'real launches, play money 💜 let\'s see what you\'ve got', 'the live trenches 👀 it\'s all play money, so relax'],
  firstBuy: ['first bag of the run 💜', 'and we\'re in 💜 play money, real chart', 'first trade down 💜 let\'s watch it'],
  buy: ['added to the bag 💜', 'another one 👀', 'bag secured 💜', 'okay okay 🙈 noted'],
  sellWin: ['{pnl} 💜 look at you', 'that\'s a win 🎉', 'green 💚 i\'m clapping', 'profit is profit 💜 nice one'],
  sellLoss: ['that one didn\'t love us back 🙈', 'a little red. it happens 💜', 'out of that one. we move 💜',
    'every trench has a few of those 🙈'],
  failMigrating: ['that one is migrating right now: nothing trades for a moment', 'can\'t trade it mid-migration 🙈 give it a second'],
  migrating: ['one of yours filled its curve 👀 it\'s migrating', 'one of your coins is graduating 🎓 hold on'],
  migrated: ['one of yours made it to its pool 🎓💜', 'one of your coins migrated. a whole new chart 👀'],
});

export const MOODS = Object.freeze(['neutral', 'happy', 'love', 'celebrate', 'shy', 'hmm', 'worried', 'sad', 'wave']);
const MOOD = Object.freeze({
  start: 'wave', startFree: 'wave', startDaily: 'wave', firstBuy: 'happy', buy: 'happy', sellWin: 'happy', sellLoss: 'shy',
  failSlip: 'hmm', failMigrating: 'hmm', failOther: 'hmm', rug: 'sad', migrating: 'happy', migrated: 'love', devSell: 'worried',
  kolBuy: 'hmm', cto: 'love', dexPaid: 'happy', x1_5: 'happy', x2: 'celebrate', x3: 'celebrate', x5: 'celebrate',
  x10: 'celebrate', down: 'sad', close: 'love', lastMinute: 'worried', countdown: 'worried', idle: 'neutral',
  won: 'celebrate', lostTime: 'sad', lostRug: 'sad', busted: 'sad', cashed: 'wave', quit: 'wave',
});
// which one she says when several happen at once (the highest), and the end of a run beats everything
const PRIORITY = Object.freeze({
  won: 100, lostTime: 100, lostRug: 100, busted: 100, cashed: 100, quit: 100, x10: 95, rug: 90, x5: 85, x3: 80, x2: 75,
  migrated: 70, migrating: 65, close: 60, x1_5: 58, sellWin: 55, sellLoss: 54, devSell: 50, down: 48, lastMinute: 46,
  countdown: 45, kolBuy: 42, firstBuy: 40, start: 38, startFree: 38, startDaily: 38, cto: 30, dexPaid: 28, failMigrating: 26,
  failSlip: 25, failOther: 24, buy: 20, idle: 5,
});
export const moodOf = (key) => MOOD[key] || 'neutral';
export const priorityOf = (key) => PRIORITY[key] || 0;

const tick = (t) => (t ? `$${t}` : 'that coin');

// a run's event → the key of her lines for it and its words to fill in, or null (nothing to say)
export function lineFor(e, { currency = 'sol', solUsd = 150 } = {}) {
  if (!e || typeof e.type !== 'string') return null;
  const o = e.order || null;
  switch (e.type) {
    case 'start':
      return { key: e.mode === 'free' ? 'startFree' : e.mode === 'daily' ? 'startDaily' : 'start', vars: {} };
    case 'fill':
      if (!o) return null;
      if (o.side === 'buy') return { key: e.first ? 'firstBuy' : 'buy', vars: { ticker: tick(o.ticker) } };
      return {
        key: (e.pnl || 0) > 0 ? 'sellWin' : 'sellLoss',
        vars: { ticker: tick(o.ticker), pnl: moneySigned(e.pnl || 0, currency, solUsd) },
      };
    case 'fail':
      if (e.reason === 'slippage') return { key: 'failSlip', vars: {} };
      if (e.reason === 'migrating') return { key: 'failMigrating', vars: { ticker: tick(o && o.ticker) } };
      return { key: 'failOther', vars: {} };
    case 'rug':
      return { key: 'rug', vars: { ticker: tick(e.ticker) } };
    case 'migrating':
      return { key: 'migrating', vars: { ticker: tick(e.ticker) } };
    case 'migrated':
      return { key: 'migrated', vars: { ticker: tick(e.ticker) } };
    case 'dev_sell':
      return { key: 'devSell', vars: { ticker: tick(e.ticker) } };
    case 'kol_buy':
      return e.kol ? { key: 'kolBuy', vars: { ticker: tick(e.ticker), kol: `@${e.kol}` } } : null;
    case 'cto':
      return { key: 'cto', vars: { ticker: tick(e.ticker) } };
    case 'dex_paid':
      return { key: 'dexPaid', vars: { ticker: tick(e.ticker) } };
    case 'milestone': {
      const k = { 1.5: 'x1_5', 2: 'x2', 3: 'x3', 5: 'x5', 10: 'x10' }[e.x];
      return k ? { key: k, vars: {} } : null;
    }
    case 'down':
      return { key: 'down', vars: {} };
    case 'close':
      return { key: 'close', vars: {} };
    case 'last_minute':
      return { key: 'lastMinute', vars: {} };
    case 'countdown':
      return e.s === 10 ? { key: 'countdown', vars: {} } : null;
    case 'idle':
      return { key: 'idle', vars: {} };
    case 'end':
      if (e.outcome === 'won') return { key: 'won', vars: {} };
      if (e.outcome === 'lost') return { key: e.reason === 'rug' ? 'lostRug' : 'lostTime', vars: {} };
      if (e.outcome === 'busted') return { key: 'busted', vars: {} };
      if (e.outcome === 'cashed') return { key: 'cashed', vars: {} };
      if (e.outcome === 'quit') return { key: 'quit', vars: {} };
      return null;
    default:
      return null;
  }
}

export const fill = (line, vars) => line.replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] != null ? String(vars[k]) : m));

// Her voice for a run: hear(events, clock) → { key, text, mood } | null. Of the events since the last call, the one
// that matters most; at most one line every `gap` seconds (`breath` for what matters: a rug, a sell, a milestone…; none
// for the end of a run); each key's lines come in a shuffled order, never the same line twice in a row. `rng` is a
// function giving 0…1. The game gives `clock` in real seconds, so a faster run never makes her chattier.
export const VOICE_GAP = 7;
export const VOICE_BREATH = 2.5;

// the coin an event is about (an order's, or the event's own), or null
const coinOfEvent = (e) => (e && e.order && Number.isInteger(e.order.coin) ? e.order.coin : e && Number.isInteger(e.coin) ? e.coin : null);
const NAMES_A_COIN = (key) => (LINES[key] || []).some((l) => /\{(ticker|kol)\}/.test(l));

// In Live mode: a line about a real coin (`isReal(id)`) from LIVE_LINES, never naming it; nothing when there's no way
// to say it without naming it; a live run's start in its own words. Else the line as it was.
export function liveLineFor(l, e, { live = false, isReal = null } = {}) {
  if (!l) return null;
  if (live && l.key.startsWith('start')) return { key: 'start', vars: {}, live: true };
  const id = coinOfEvent(e);
  const real = id !== null && typeof isReal === 'function' && isReal(id);
  if (!real) return l;
  if (Object.hasOwn(LIVE_LINES, l.key)) return { key: l.key, vars: l.vars && l.vars.pnl ? { pnl: l.vars.pnl } : {}, live: true };
  return NAMES_A_COIN(l.key) ? null : l;
}

export function createVoice({
  rng = Math.random, gap = VOICE_GAP, breath = VOICE_BREATH, currency = 'sol', solUsd = 150, live = false, isReal = null,
} = {}) {
  const r = typeof rng === 'function' ? rng : Math.random;
  const bags = new Map();
  const last = new Map();
  let lastAt = -Infinity;

  function next(key, isLive = false) {
    const lines = isLive ? LIVE_LINES[key] : LINES[key];
    key = isLive ? `live:${key}` : key;
    let bag = bags.get(key);
    if (!bag || !bag.length) {
      bag = lines.map((_, i) => i);
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      // a new round never starts with the line that ended the last one
      if (bag.length > 1 && bag[bag.length - 1] === last.get(key)) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
      bags.set(key, bag);
    }
    const i = bag.pop();
    last.set(key, i);
    return lines[i];
  }

  return {
    hear(events, clock = 0) {
      let best = null;
      for (const e of events || []) {
        const l = live || isReal ? liveLineFor(lineFor(e, { currency, solUsd }), e, { live, isReal }) : lineFor(e, { currency, solUsd });
        if (!l || !(l.live ? LIVE_LINES[l.key] : LINES[l.key])) continue;
        if (!best || priorityOf(l.key) > priorityOf(best.key)) best = l;
      }
      if (!best) return null;
      // the end of a run always speaks; what matters (a rug, a milestone, a sell…) after a short breath; the rest waits
      // its turn
      const p = priorityOf(best.key);
      const need = p >= 100 ? 0 : p >= 50 ? Math.min(gap, breath) : gap;
      if (clock - lastAt < need) return null;
      lastAt = clock;
      return { key: best.key, text: fill(next(best.key, Boolean(best.live)), best.vars), mood: moodOf(best.key), live: Boolean(best.live) };
    },
  };
}
