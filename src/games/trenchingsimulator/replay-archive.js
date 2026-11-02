// Local recordings only. This archive is never uploaded and cannot execute orders.
import { REPLAY_LIMITS } from './replay-data.js';
import { LAUNCH_PAIRS } from './engine.js';
import { validPaperPerps } from './paper-perps-record.js';

export const REPLAY_ARCHIVE_KEY = 'trench_replays_v1';
export const REPLAY_ARCHIVE_LIMITS = Object.freeze({ runs: 8, characters: 2_000_000, record: 1_500_000 });
const fin = (n) => typeof n === 'number' && Number.isFinite(n);
const text = (s, cap = 100) => typeof s === 'string' ? s.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '').slice(0, cap) : '';
const array = (a, max, check) => Array.isArray(a) && a.length <= max && a.every(check);
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const word = (v, cap) => typeof v === 'string' && v.length <= cap;
const optional = (v, check) => v === undefined || v === null || check(v);
const fields = (v, allowed) => object(v) && Object.keys(v).every((k) => allowed.includes(k));
const sequence = (rows, key, strict = false) => rows.every((p, i) => !i || (strict ? p[key] > rows[i - 1][key] : p[key] >= rows[i - 1][key]));
const unique = (rows, key) => new Set(rows.map((x) => x[key])).size === rows.length;
const id = (v) => Number.isSafeInteger(v) && v >= 0;

export function validArchivedReplay(r) {
  // Storage is editable JSON. Validate the whole shape rather than retaining arbitrary nested payloads
  // which can later break exporting, copying, or the playback renderer's ordered-history assumptions.
  if (!fields(r, ['v', 'seed', 'live', 'practice', 'chain', 'terminal', 'duration', 'solUsd', 'startSol', 'until', 'n0', 'config', 'replayable', 'log', 'orders', 'coins', 'equity', 'coverage', 'paperPerps'])
    || r.v !== 1 || !fin(r.duration) || r.duration < 0 || r.duration > Number.MAX_SAFE_INTEGER || !fin(r.solUsd) || r.solUsd <= 0
    || !fin(r.startSol) || r.startSol < 0 || !fin(r.startSol * r.solUsd) || !word(r.seed, 200)
    || !optional(r.chain, (s) => word(s, 24)) || !optional(r.until, id) || !optional(r.n0, id)
    || (r.practice !== undefined && typeof r.practice !== 'boolean')
    || typeof r.replayable !== 'boolean' || !fields(r.coverage, ['ordersTrimmed', 'coinsTrimmed', 'candlesTrimmed', 'equitySampled', 'equityFrom', 'logComplete'])
    || !['ordersTrimmed', 'coinsTrimmed', 'candlesTrimmed', 'equitySampled', 'logComplete'].every((k) => typeof r.coverage[k] === 'boolean')
    || !optional(r.coverage.equityFrom, (n) => fin(n) && n >= 0 && n <= r.duration)) return false;
  if (r.paperPerps !== undefined && (!validPaperPerps(r.paperPerps, r.duration) || r.replayable || r.coverage.logComplete || r.log?.length)) return false;
  if (!object(r.config) || Object.keys(r.config).length > 64 || !Object.entries(r.config).every(([k, v]) => k.length <= 100
    && (fin(v) || typeof v === 'boolean' || word(v, 200)))) return false;
  if (!array(r.log, REPLAY_LIMITS.log, (o) => o?.kind === 'launch'
    ? fields(o, ['kind', 'n', 'name', 'ticker', 'pair', 'emoji', 'line']) && id(o.n)
      && word(o.name, 50) && o.name.trim().length > 0 && word(o.ticker, 12) && /^[A-Z0-9]{1,12}$/.test(o.ticker)
      && LAUNCH_PAIRS.includes(o.pair) && word(o.emoji, 12) && word(o.line, 280)
    : fields(o, ['n', 'coin', 'side', 'sol', 'frac', 'slippage', 'priority'])
    && id(o.n) && id(o.coin) && ['buy', 'sell'].includes(o.side)
    && ['sol', 'frac', 'slippage'].every((k) => optional(o[k], (n) => fin(n) && n >= 0))
    && optional(o.priority, (s) => word(s, 40)))) return false;
  const time = (n) => fin(n) && n <= r.duration;
  if (!array(r.equity, REPLAY_LIMITS.equity, (p) => fields(p, ['t', 'v']) && time(p.t) && p.t >= 0 && fin(p.v) && fin(p.v * r.solUsd))
    || !sequence(r.equity, 't')) return false;
  if (!array(r.orders, REPLAY_LIMITS.orders, (o) => fields(o, ['id', 'coin', 'ticker', 'side', 't', 'doneAt', 'status', 'reason', 'sol', 'frac', 'spent', 'got', 'tok', 'mc', 'price']) && id(o.id) && id(o.coin)
    && ['buy', 'sell'].includes(o.side) && ['filled', 'pending', 'failed'].includes(o.status)
    && typeof o.ticker === 'string' && o.ticker.length <= 24 && time(o.t) && o.t >= 0
    && (o.doneAt === null || (time(o.doneAt) && o.doneAt >= o.t))
    && (o.status !== 'filled' || o.doneAt !== null)
    && ['sol', 'frac', 'spent', 'got', 'tok'].every((k) => fin(o[k]) && o[k] >= 0 && fin(o[k] * r.solUsd))
    && o.frac <= 1 && optional(o.reason, (s) => word(s, 80))
    && ['mc', 'price'].every((k) => optional(o[k], (n) => fin(n) && n >= 0 && fin(n * r.solUsd))))
    || !unique(r.orders, 'id') || !sequence(r.orders, 't')) return false;
  let total = 0;
  if (!array(r.coins, REPLAY_LIMITS.coins, (c) => {
    if (!fields(c, ['id', 'name', 'ticker', 'live', 'born', 'candles', 'from', 'trimmed']) || !id(c.id) || !word(c.name, 100)
      || !word(c.ticker, 24) || typeof c.live !== 'boolean' || typeof c.trimmed !== 'boolean'
      || !optional(c.born, fin) || !optional(c.from, (n) => time(n) && n >= 0)) return false;
    if (!array(c.candles, REPLAY_LIMITS.candles, (p) => fields(p, ['t', 'o', 'h', 'l', 'c', 'v', 'availableAt']) && time(p.t) && time(p.availableAt)
      && p.availableAt >= p.t && ['o', 'h', 'l', 'c'].every((k) => fin(p[k]) && p[k] > 0 && fin(p[k] * r.solUsd))
      && p.h >= Math.max(p.o, p.c) && p.l <= Math.min(p.o, p.c) && fin(p.v) && p.v >= 0)
      || !sequence(c.candles, 't', true) || !sequence(c.candles, 'availableAt')) return false;
    total += c.candles.length; return total <= REPLAY_LIMITS.totalCandles;
  }) || !unique(r.coins, 'id')) return false;
  return typeof r.live === 'boolean' && typeof r.terminal === 'string' && r.terminal.length <= 24;
}

export function createReplayArchive(store, { now = () => Date.now() } = {}) {
  let rows = [];
  try {
    const raw = store?.getItem(REPLAY_ARCHIVE_KEY);
    if (raw && raw.length <= REPLAY_ARCHIVE_LIMITS.characters) {
      const parsed = JSON.parse(raw);
      if (parsed.v === 1 && Array.isArray(parsed.runs)) {
        const seen = new Set();
        rows = parsed.runs.slice(0, REPLAY_ARCHIVE_LIMITS.runs)
          .filter((x) => {
            if (!x || typeof x.id !== 'string' || !/^[a-zA-Z0-9_-]{1,99}$/.test(x.id) || seen.has(x.id)
              || !fin(x.at) || x.at < 0 || !Number.isFinite(new Date(x.at).getTime()) || !validArchivedReplay(x.record)
              || JSON.stringify(x.record).length > REPLAY_ARCHIVE_LIMITS.record) return false;
            seen.add(x.id); return true;
          })
          .map((x) => ({ id: x.id, at: x.at, label: text(x.label), record: x.record }));
      }
    }
  } catch { /* Unavailable or damaged storage must not prevent a new run. */ }
  function persist(next) {
    if (!store?.setItem) return false;
    try { store.setItem(REPLAY_ARCHIVE_KEY, JSON.stringify({ v: 1, runs: next })); rows = next; return true; }
    catch { return false; }
  }
  return {
    list() { return rows.map((x) => ({ id: x.id, at: x.at, label: x.label, terminal: x.record.terminal,
      live: x.record.live, chain: x.record.chain, duration: x.record.duration, trades: x.record.orders.filter((o) => o.status === 'filled').length + (x.record.paperPerps?.filled || 0) })); },
    get(id) { const x = rows.find((r) => r.id === id); return x ? JSON.parse(JSON.stringify(x.record)) : null; },
    save(record, label = 'Practice run') {
      if (!validArchivedReplay(record)) return { ok: false, reason: 'invalid' };
      const raw = JSON.stringify(record);
      if (raw.length > REPLAY_ARCHIVE_LIMITS.record) return { ok: false, reason: 'large' };
      const at = now(), id = `${at}-${Math.random().toString(36).slice(2, 10)}`;
      const item = { id, at, label: text(label), record: JSON.parse(raw) };
      let next = [item, ...rows].slice(0, REPLAY_ARCHIVE_LIMITS.runs);
      while (next.length > 1 && JSON.stringify({ v: 1, runs: next }).length > REPLAY_ARCHIVE_LIMITS.characters) next.pop();
      return persist(next) ? { ok: true, id } : { ok: false, reason: 'storage' };
    },
    remove(id) { return rows.some((x) => x.id === id) && persist(rows.filter((x) => x.id !== id)); },
  };
}
