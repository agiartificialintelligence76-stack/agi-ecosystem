// The relay's hub (2026-10-21, #404): every chain's newest coins and their markets, and the browsers watching them. One
// upstream connection per source feeds it; it fans what it gets out to every viewer of that chain: a new coin at once,
// market changes in one small batch every half second (each coin's newest state only), pictures as they're ready.
//
// What a browser may send (JSON, at most 2 KB, about two a second): {op:'sub', chain} · {op:'watch', ids:[…8 at most]}
// (the coins it has open or holds, kept live for it) · {op:'unsub'}. Anything else is ignored; too much closes it.
// What it gets: hi (hello: each chain's state, prices) · snap (a chain's newest coins) · c (a coin, new or live again) ·
// u (market changes) · off (coins no longer followed) · pic (a picture ready) · h (a coin's history, when it's watched)
// · st (a chain's state changed) · px (dollar prices).
//
// A slow viewer never slows the others: past `high` bytes waiting for it, it misses batches (and gets a fresh snapshot
// once it has caught up); past `hard` it's dropped. Pings every `pingMs`; no pong by the next one, it's dropped.
import { encodeCoin, encodeState } from './parse.mjs';
import { CHAIN_IDS } from './config.mjs';

export const PREFIX = Object.freeze({ solana: 's', robinhood: 'r', bnb: 'b', base: 'a', ethereum: 'e', monad: 'm', hyperevm: 'h',
  arbitrum: 'f', tron: 't' });
export const ID = /^[srbaemhft][0-9]{1,9}$/;
export const LIMITS = Object.freeze({ keep: 400, snap: 60, hist: 300, watchPer: 8, msgBurst: 20, msgPerSec: 2,
  maxMsgBytes: 2048, high: 512 * 1024, low: 128 * 1024, hard: 4 * 1024 * 1024, histPer10s: 6 });
// how long without a new coin before a chain is "quiet" (stand-ins fill in), by chain
export const QUIET_MS = Object.freeze({ solana: 3 * 60_000, robinhood: 45 * 60_000, bnb: 30 * 60_000, base: 30 * 60_000,
  ethereum: 30 * 60_000, monad: 30 * 60_000, hyperevm: 30 * 60_000, arbitrum: 30 * 60_000, tron: 30 * 60_000 });

export function createHub({ log, chains = CHAIN_IDS, batchMs = 500, pingMs = 25000, now = Date.now, onWatch = () => {},
  limits = {} } = {}) {
  const L = { ...LIMITS, ...limits };
  const C = new Map();
  for (const id of chains) {
    C.set(id, { id, coins: new Map(), byKey: new Map(), seq: 0, dirty: new Map(), off: new Set(), subs: new Set(),
      state: 'off', src: null, lastCoinAt: 0, born: [], why: null });
  }
  const clients = new Set();
  let px = null;
  let pxAt = 0;
  let watched = 0;
  const S = { sent: 0, dropped: 0, lagged: 0, resnaps: 0, closedSlow: 0, closedSpam: 0 };

  const chainOf = (id) => C.get(id) || null;
  // a chain's state as browsers get it: live / quiet / down / off, its new coins in the last 10 minutes, seconds since
  // its newest (never which service it came from)
  const stateOf = (ch) => ({ s: ch.state, n: ch.born.filter((t) => t > now() - 600_000).length,
    last: ch.lastCoinAt ? Math.round((now() - ch.lastCoinAt) / 1000) : -1 });
  const statesMsg = () => {
    const out = {};
    for (const ch of C.values()) out[ch.id] = stateOf(ch);
    return out;
  };

  // ---------- sending ----------

  function send(cl, text, { essential = false } = {}) {
    const ws = cl.ws;
    if (ws.readyState !== 1) return false;
    const queued = ws.bufferedAmount;
    if (queued > L.hard) {
      S.closedSlow += 1;
      drop(cl, 'slow');
      return false;
    }
    if (!essential && queued > L.high) {
      cl.lagging = true;
      S.lagged += 1;
      return false;
    }
    try {
      ws.send(text);
      S.sent += 1;
      return true;
    } catch {
      return false;
    }
  }
  function toChain(ch, msg, opts) {
    if (!ch.subs.size) return;
    const text = typeof msg === 'string' ? msg : JSON.stringify(msg);
    for (const cl of ch.subs) send(cl, text, opts);
  }
  function toAll(msg, opts) {
    const text = JSON.stringify(msg);
    for (const cl of clients) send(cl, text, opts);
  }

  // ---------- coins ----------

  // a new coin (or the one already known by its address: its id); `c`: { key, name, symbol, born, by, src, sup, st, st0,
  // pic, soc, tracked, extra (the source's own, never sent) }
  function addCoin(chainId, c) {
    const ch = chainOf(chainId);
    if (!ch || !c || typeof c.key !== 'string') return null;
    const known = ch.byKey.get(c.key);
    if (known) return known;
    ch.seq += 1;
    const id = `${PREFIX[chainId]}${ch.seq}`;
    const t = now();
    const coin = { id, chain: chainId, key: c.key, name: c.name, symbol: c.symbol, born: Number.isFinite(c.born) ? Math.min(c.born, t) : t,
      by: c.by || null, src: c.src || null, sup: c.sup || 0, st: c.st || null, st0: c.st0 || null, pic: c.pic || null,
      soc: c.soc || 0, tracked: Boolean(c.tracked), at: t, hist: [], watchers: 0, extra: c.extra || {} };
    if (coin.st) coin.hist.push([t, encodeState(coin.st)]);
    ch.coins.set(id, coin);
    ch.byKey.set(c.key, id);
    ch.lastCoinAt = Math.max(ch.lastCoinAt, coin.born);
    ch.born.push(coin.born);
    if (ch.born.length > 2000) ch.born.splice(0, ch.born.length - 1000);
    // the oldest go (never one somebody watches)
    if (ch.coins.size > L.keep) {
      for (const [oid, oc] of ch.coins) {
        if (ch.coins.size <= L.keep) break;
        if (oc.watchers > 0) continue;
        ch.coins.delete(oid);
        ch.byKey.delete(oc.key);
        ch.dirty.delete(oid);
      }
    }
    toChain(ch, { t: 'c', c: encodeCoin(coin) });
    return id;
  }

  function coin(chainId, id) {
    const ch = chainOf(chainId);
    return ch ? ch.coins.get(id) || null : null;
  }
  function byKey(chainId, key) {
    const ch = chainOf(chainId);
    const id = ch ? ch.byKey.get(key) : null;
    return id ? ch.coins.get(id) : null;
  }
  function coins(chainId) {
    const ch = chainOf(chainId);
    return ch ? [...ch.coins.values()] : [];
  }

  // a coin's market changed: in the next batch (its newest state only), and in its history (one point a second)
  function setState(chainId, id, st, dx = null) {
    const ch = chainOf(chainId);
    const c = ch && ch.coins.get(id);
    if (!c || !st) return false;
    const wire = encodeState(st);
    const same = c.st && JSON.stringify(encodeState(c.st)) === JSON.stringify(wire);
    c.st = st;
    c.at = now();
    // the same market again (a re-read): nothing to send, unless its own numbers came with it
    if (same && !dx) return true;
    const last = c.hist[c.hist.length - 1];
    if (last && c.at - last[0] < 1000) last[1] = wire;
    else c.hist.push([c.at, wire]);
    if (c.hist.length > L.hist) c.hist.splice(0, c.hist.length - L.hist);
    ch.dirty.set(id, dx ? [id, wire, dx] : [id, wire]);
    return true;
  }

  // followed live or not: live again → the whole coin (its newest state) to its viewers; no longer → in the next batch
  function setTracked(chainId, id, on) {
    const ch = chainOf(chainId);
    const c = ch && ch.coins.get(id);
    if (!c || c.tracked === Boolean(on)) return;
    c.tracked = Boolean(on);
    if (on) {
      ch.off.delete(id);
      toChain(ch, { t: 'c', c: encodeCoin(c) });
    } else {
      ch.off.add(id);
      ch.dirty.delete(id);
    }
  }

  function setPic(chainId, id, path, soc = null) {
    const ch = chainOf(chainId);
    const c = ch && ch.coins.get(id);
    if (!c || !path) return;
    c.pic = path;
    if (Number.isInteger(soc)) c.soc = soc;
    toChain(ch, { t: 'pic', id, p: path, soc: c.soc });
  }

  function setStatus(chainId, state, { src, why } = {}) {
    const ch = chainOf(chainId);
    if (!ch) return;
    const next = ['live', 'quiet', 'down', 'off'].includes(state) ? state : 'down';
    const changed = next !== ch.state || (src !== undefined && src !== ch.src);
    ch.state = next;
    if (src !== undefined) ch.src = src;
    if (why !== undefined) ch.why = why;
    if (changed) toAll({ t: 'st', ch: { [ch.id]: stateOf(ch) } }, { essential: true });
  }
  // a chain's state from its source's health: down, or live / quiet by how long since its newest coin
  function judge(chainId, { connected, src, why = null }) {
    const ch = chainOf(chainId);
    if (!ch) return;
    if (!connected) return setStatus(chainId, 'down', { src, why });
    const quiet = !ch.lastCoinAt || now() - ch.lastCoinAt > (QUIET_MS[chainId] || 600_000);
    setStatus(chainId, quiet ? 'quiet' : 'live', { src, why });
  }

  function setPx(next) {
    if (!next || typeof next !== 'object') return;
    px = { ...(px || {}), ...next };
    pxAt = now();
    toAll({ t: 'px', ...px }, { essential: false });
  }

  // ---------- the batches ----------

  function flush() {
    for (const ch of C.values()) {
      if (ch.dirty.size) {
        const u = [...ch.dirty.values()];
        ch.dirty.clear();
        toChain(ch, { t: 'u', u });
      }
      if (ch.off.size) {
        const ids = [...ch.off];
        ch.off.clear();
        toChain(ch, { t: 'off', ids });
      }
      // a viewer that missed batches and has caught up: everything again
      for (const cl of ch.subs) {
        if (cl.lagging && cl.ws.bufferedAmount < L.low) {
          cl.lagging = false;
          S.resnaps += 1;
          sendSnap(cl, ch);
        }
      }
    }
  }
  const flushT = setInterval(flush, batchMs);
  const pingT = setInterval(() => {
    for (const cl of clients) {
      if (!cl.alive) {
        drop(cl, 'no pong');
        continue;
      }
      cl.alive = false;
      try {
        cl.ws.ping();
      } catch {
        // the close event follows
      }
    }
  }, pingMs);

  function snapshot(ch) {
    const list = [...ch.coins.values()].sort((a, b) => b.born - a.born).slice(0, L.snap);
    return { t: 'snap', chain: ch.id, coins: list.map(encodeCoin) };
  }
  function sendSnap(cl, ch) {
    const snap = snapshot(ch);
    send(cl, JSON.stringify(snap), { essential: true });
    // the coins it watches (older than the newest, maybe): each as a coin of its own
    const inSnap = new Set(snap.coins.map((x) => x.id));
    for (const id of cl.watch) {
      const c = ch.coins.get(id);
      if (c && !inSnap.has(id)) send(cl, JSON.stringify({ t: 'c', c: encodeCoin(c) }), { essential: true });
    }
  }

  // ---------- the browsers ----------

  function attach(ws) {
    const cl = { ws, chain: null, watch: new Set(), alive: true, lagging: false, tokens: L.msgBurst, refillAt: now(),
      hist: [] };
    clients.add(cl);
    ws.on('pong', () => {
      cl.alive = true;
    });
    ws.on('message', (data, binary) => onMessage(cl, data, binary));
    ws.on('close', () => detach(cl));
    ws.on('error', () => {});
    send(cl, JSON.stringify({ t: 'hi', v: 1, now: now(), ch: statesMsg(), px: px ? { ...px, age: Math.round((now() - pxAt) / 1000) } : null }),
      { essential: true });
    return cl;
  }

  function detach(cl) {
    if (!clients.has(cl)) return;
    clients.delete(cl);
    unwatchAll(cl);
    if (cl.chain) {
      const ch = chainOf(cl.chain);
      if (ch) ch.subs.delete(cl);
    }
  }

  function drop(cl, why) {
    detach(cl);
    try {
      if (why === 'slow' || why === 'no pong') cl.ws.terminate();
      else cl.ws.close(1008, why);
    } catch {
      // gone already
    }
  }

  function take(cl) {
    const t = now();
    cl.tokens = Math.min(L.msgBurst, cl.tokens + ((t - cl.refillAt) / 1000) * L.msgPerSec);
    cl.refillAt = t;
    if (cl.tokens < 1) return false;
    cl.tokens -= 1;
    return true;
  }

  function onMessage(cl, data, binary) {
    if (!clients.has(cl)) return;
    if (binary || data.length > L.maxMsgBytes) {
      S.closedSpam += 1;
      return drop(cl, 'bad message');
    }
    if (!take(cl)) {
      S.closedSpam += 1;
      return drop(cl, 'too many messages');
    }
    let m;
    try {
      m = JSON.parse(String(data));
    } catch {
      return undefined;
    }
    if (!m || typeof m !== 'object') return undefined;
    if (m.op === 'sub' && typeof m.chain === 'string' && C.has(m.chain)) return subscribe(cl, m.chain);
    if (m.op === 'unsub') return unsubscribe(cl);
    if (m.op === 'watch' && Array.isArray(m.ids)) return watch(cl, m.ids);
    return undefined;
  }

  function subscribe(cl, chainId) {
    unsubscribe(cl);
    const ch = chainOf(chainId);
    cl.chain = chainId;
    ch.subs.add(cl);
    cl.lagging = false;
    sendSnap(cl, ch);
  }
  function unsubscribe(cl) {
    unwatchAll(cl);
    if (!cl.chain) return;
    const ch = chainOf(cl.chain);
    if (ch) ch.subs.delete(cl);
    cl.chain = null;
  }

  function watch(cl, ids) {
    if (!cl.chain) return;
    const ch = chainOf(cl.chain);
    const want = new Set(ids.filter((x) => typeof x === 'string' && ID.test(x) && ch.coins.has(x)).slice(0, L.watchPer));
    for (const id of [...cl.watch]) {
      if (!want.has(id)) {
        cl.watch.delete(id);
        release(ch, id);
      }
    }
    for (const id of want) {
      if (cl.watch.has(id)) continue;
      const c = ch.coins.get(id);
      cl.watch.add(id);
      c.watchers += 1;
      watched += c.watchers === 1 ? 1 : 0;
      if (c.watchers === 1) onWatch(ch.id, c, true);
      sendHistory(cl, c);
    }
  }
  function release(ch, id) {
    const c = ch.coins.get(id);
    if (!c || c.watchers <= 0) return;
    c.watchers -= 1;
    if (c.watchers === 0) {
      watched -= 1;
      onWatch(ch.id, c, false);
    }
  }
  function unwatchAll(cl) {
    if (!cl.chain || !cl.watch.size) return;
    const ch = chainOf(cl.chain);
    for (const id of cl.watch) release(ch, id);
    cl.watch.clear();
  }
  function sendHistory(cl, c) {
    const t = now();
    cl.hist = cl.hist.filter((x) => x > t - 10_000);
    if (cl.hist.length >= L.histPer10s || c.hist.length < 2) return;
    cl.hist.push(t);
    send(cl, JSON.stringify({ t: 'h', id: c.id, h: c.hist }), { essential: false });
  }

  return {
    addCoin,
    coin,
    byKey,
    coins,
    setState,
    setTracked,
    setPic,
    setStatus,
    judge,
    setPx,
    attach,
    flush,
    state: (chainId) => {
      const ch = chainOf(chainId);
      return ch ? { ...stateOf(ch), src: ch.src, why: ch.why } : null;
    },
    get px() {
      return px ? { ...px } : null;
    },
    get pxAt() {
      return pxAt;
    },
    get clients() {
      return clients.size;
    },
    get watched() {
      return watched;
    },
    stats() {
      const out = { clients: clients.size, watched, ...S, chains: {} };
      for (const ch of C.values()) {
        let tracked = 0;
        for (const c of ch.coins.values()) if (c.tracked) tracked += 1;
        out.chains[ch.id] = { ...stateOf(ch), coins: ch.coins.size, tracked, viewers: ch.subs.size };
      }
      return out;
    },
    close() {
      clearInterval(flushT);
      clearInterval(pingT);
      for (const cl of [...clients]) {
        try {
          cl.ws.close(1001, 'relay restarting');
        } catch {
          // gone already
        }
        detach(cl);
      }
    },
  };
}
