// A bounded, read-only record of the run. Live playback never re-simulates a real coin or fills missing history.
export const REPLAY_LIMITS = Object.freeze({ orders: 300, coins: 100, candles: 2000, totalCandles: 20000, equity: 2000, log: 300 });
export const REPLAY_SPEEDS = Object.freeze([1, 2, 4]);
const fin = (n) => typeof n === 'number' && Number.isFinite(n);
const word = (s, cap = 100) => typeof s === 'string' ? s.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '').slice(0, cap) : '';
const freeze = (x) => {
  if (x && typeof x === 'object' && !Object.isFrozen(x)) { Object.values(x).forEach(freeze); Object.freeze(x); }
  return x;
};
const boundTime = (n, duration) => Math.max(0, Math.min(duration, fin(n) ? n : 0));
const number = (n, fallback = null) => fin(n) ? n : fallback;

// Keep original observations, including first/last, without interpolating values or inventing samples.
export function sampleReplayPoints(points, cap = REPLAY_LIMITS.equity) {
  const rows = (Array.isArray(points) ? points : []).filter((p) => p && fin(p.t) && fin(p.v)).map((p) => ({ t: p.t, v: p.v }));
  const limit = Math.max(2, Math.floor(cap));
  if (rows.length <= limit) return rows;
  return Array.from({ length: limit }, (_, i) => rows[Math.round(i * (rows.length - 1) / (limit - 1))]);
}

export function captureRunReplay(run) {
  const m = run && run.market;
  if (!m || typeof m.orders !== 'function' || typeof m.candles !== 'function') return null;
  const duration = Math.max(0, number(run.clock, number(m.t, 0)));
  const rawOrders = m.orders(REPLAY_LIMITS.orders);
  const orders = rawOrders.filter((o) => o && Number.isInteger(o.id) && Number.isInteger(o.coin)
    && ['buy', 'sell'].includes(o.side) && fin(o.t) && o.t <= duration).slice(0, REPLAY_LIMITS.orders)
    .map((o) => ({ id: o.id, coin: o.coin, ticker: word(o.ticker, 24), side: o.side, t: o.t,
      doneAt: fin(o.doneAt) && o.doneAt <= duration ? o.doneAt : null,
      status: ['filled', 'failed', 'pending'].includes(o.status) ? o.status : 'pending', reason: word(o.reason, 80) || null,
      sol: number(o.sol, 0), frac: number(o.frac, 0), spent: number(o.spent, 0), got: number(o.got, 0),
      tok: number(o.tok, 0), mc: number(o.mc), price: number(o.price) }))
    .sort((a, b) => a.t - b.t || a.id - b.id);
  const ids = [...new Set([...orders].reverse().map((o) => o.coin))];
  if (typeof m.positions === 'function') for (const p of m.positions()) if (Number.isInteger(p.id) && !ids.includes(p.id)) ids.push(p.id);
  if (!ids.length && typeof m.lists === 'function') {
    const lists = m.lists({ limit: 1 });
    const first = ['new', 'stretch', 'migrated', 'trending'].flatMap((k) => lists[k] || []).find((r) => r && Number.isInteger(r.id));
    if (first) ids.push(first.id);
  }
  const selected = ids.slice(0, REPLAY_LIMITS.coins);
  const perCoin = Math.min(REPLAY_LIMITS.candles, Math.max(1, Math.floor(REPLAY_LIMITS.totalCandles / Math.max(1, selected.length))));
  const coins = selected.flatMap((id) => {
    const r = m.row(id);
    if (!r) return [];
    const input = (m.candles(id) || []).filter((c) => c && fin(c.t) && c.t <= duration
      && [c.o, c.h, c.l, c.c].every((v) => fin(v) && v > 0) && c.h >= c.l).sort((a, b) => a.t - b.t);
    const during = input.filter((c, i) => c.t >= 0 || i === input.length - 1 || input[i + 1].t >= 0);
    const keep = during.slice(-perCoin);
    // A retained OHLC bar can contain several updates. Reveal it only at the next retained timestamp (or the end),
    // never its final close/high/low at the beginning of that bar. The exact intrabar path was not retained.
    const candles = keep.map((c, i) => ({ t: c.t, o: c.o, h: c.h, l: c.l, c: c.c, v: Math.max(0, number(c.v, 0)),
      availableAt: i + 1 < keep.length ? keep[i + 1].t : duration }));
    return [{ id, name: word(r.name), ticker: word(r.ticker, 24), live: r.live === true,
      born: number(r.born), candles, from: candles.length ? Math.max(0, candles[0].availableAt) : null,
      trimmed: during.length > candles.length }];
  });
  const equitySource = typeof m.equity === 'function' ? m.equity(0).filter((p) => p && fin(p.t) && p.t >= 0 && p.t <= duration && fin(p.v)) : [];
  const equity = sampleReplayPoints(equitySource);
  const live = Boolean(run.live || run.realTime || m.live);
  const originalLog = !live && typeof m.log === 'function' ? m.log() : [];
  const replayable = !live && originalLog.length <= REPLAY_LIMITS.log;
  const log = replayable ? originalLog.map((o) => o.kind === 'launch'
    ? { kind: 'launch', n: o.n, name: word(o.name, 50), ticker: word(o.ticker, 12), pair: word(o.pair, 10),
      emoji: word(o.emoji, 12), line: word(o.line, 280) }
    : { n: o.n, coin: o.coin, side: o.side, sol: o.sol, frac: o.frac,
      slippage: o.slippage, priority: o.priority }) : [];
  const config = Object.fromEntries(Object.entries(m.config || {}).filter(([, v]) => fin(v) || typeof v === 'boolean' || typeof v === 'string'));
  let placed = rawOrders.length;
  if (typeof run.result === 'function') placed = number(run.result().placed, placed);
  return freeze({ v: 1, seed: String(run.seed ?? m.seed ?? '').slice(0, 200), live,
    ...(live && (m.livePractice || m.clankPractice) ? { practice: true } : {}), chain: typeof run.live === 'string' ? run.live : null,
    terminal: word(run.terminal, 24), duration, solUsd: number(run.solUsd, number(m.solUsd, 150)),
    startSol: number(run.start, number(m.startSol, 0)), until: number(m.n), n0: number(m.n0), config,
    replayable, log, orders, coins, equity,
    coverage: { ordersTrimmed: placed > orders.length, coinsTrimmed: ids.length > selected.length,
      candlesTrimmed: coins.some((c) => c.trimmed), equitySampled: equitySource.length > equity.length,
      equityFrom: equity.length ? equity[0].t : null, logComplete: replayable } });
}

export function replayFrame(record, time, coinId = null) {
  const t = boundTime(time, record.duration);
  const coin = coinId === null ? record.coins[0] || null : record.coins.find((c) => c.id === coinId) || null;
  const equity = record.equity.filter((p) => p.t <= t);
  const orders = record.orders.filter((o) => o.t <= t).map((o) => o.doneAt !== null && o.doneAt <= t ? o
    : { ...o, status: 'pending', spent: 0, got: 0, tok: 0, mc: null, price: null, reason: null });
  const candles = coin ? coin.candles.filter((c) => c.availableAt <= t) : [];
  const marks = coin ? orders.filter((o) => o.coin === coin.id && o.status === 'filled').map((o) => ({ t: o.doneAt, side: o.side })) : [];
  const worth = equity.length ? equity[equity.length - 1].v : null;
  return { time: t, coin, candles, marks, orders, equity, worth, pnl: worth === null ? null : worth - record.startSol,
    marketCap: candles.length ? candles[candles.length - 1].c : null };
}

export function replayTradeAt(record, time, direction = 1) {
  const rows = record.orders.filter((o) => o.status === 'filled' && fin(o.doneAt)).sort((a, b) => a.doneAt - b.doneAt || a.id - b.id);
  return direction < 0 ? [...rows].reverse().find((o) => o.doneAt < time - 1e-6) || null
    : rows.find((o) => o.doneAt > time + 1e-6) || null;
}

export function createReplayClock(duration) {
  const end = Math.max(0, number(duration, 0));
  let time = 0, playing = false, speed = 1;
  return {
    get time() { return time; }, get playing() { return playing; }, get speed() { return speed; },
    play() { if (time >= end) time = 0; playing = end > 0; },
    pause() { playing = false; },
    seek(t) { time = boundTime(t, end); if (time >= end) playing = false; return time; },
    setSpeed(s) { if (REPLAY_SPEEDS.includes(s)) speed = s; return speed; },
    advance(seconds) {
      if (playing && fin(seconds) && seconds > 0) { time = Math.min(end, time + seconds * speed); if (time >= end) playing = false; }
      return time;
    },
  };
}
