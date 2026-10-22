// TRENCHING SIMULATOR's live feed (2026-10-21, #404): one WebSocket to the relay (./live-chains.js: relayUrl) for the
// chain picked, open only while Live mode is on. It says how it's going (connecting · live · down · full), keeps what the
// relay told it about the chain (its state, the newest coins, dollar prices) so a run starts from it, asks the relay to
// keep the coins a player has open or holds live (`watch`), and connects again by itself after a drop (2 s, 4 s … 30 s
// apart, a little random). Everything it gets is checked first (parseMessage). Reads only: nothing a player does is
// ever sent but which chain and which coins to keep live.
import { parseMessage, CHAIN_IDS, DEFAULT_CHAIN, picUrl } from './live-chains.js';

export const FEED = Object.freeze({ connectMs: 8000, maxBackoffMs: 30000, keepCoins: 300 });

export function createLiveFeed({ url, WebSocket: WS = globalThis.WebSocket, random = Math.random, connectMs = FEED.connectMs,
  timers = { set: (f, ms) => setTimeout(f, ms), clear: (t) => clearTimeout(t) } } = {}) {
  const S = { status: 'idle', chain: DEFAULT_CHAIN, ch: {}, px: {}, coins: new Map(), ws: null, tries: 0, retryT: null,
    openT: null, wanted: false, watch: [], watchSent: '', full: false };
  const listeners = new Set();
  const lookups = new Map();
  function finishLookup(key, status) {
    const p = lookups.get(key);
    if (!p) return;
    lookups.delete(key);
    timers.clear(p.timer);
    if (status === 'found') p.resolve([...S.coins.values()].find((c) => c.key === key) || null);
    else if (status === 'missing') p.resolve(null);
    else p.reject(new Error(status));
  }
  function cancelLookups() {
    for (const key of lookups.keys()) finishLookup(key, 'unavailable');
  }
  const emit = (ev) => {
    for (const fn of [...listeners]) {
      try {
        fn(ev);
      } catch {
        // one listener's trouble never stops the feed
      }
    }
  };
  const setStatus = (s) => {
    if (S.status === s) return;
    S.status = s;
    emit({ type: 'status', status: s });
  };
  const send = (obj) => {
    const ws = S.ws;
    if (!ws || ws.readyState !== 1) return false;
    try {
      ws.send(JSON.stringify(obj));
      return true;
    } catch {
      return false;
    }
  };
  const sendWatch = (force = false) => {
    const key = S.watch.join(',');
    if (S.status !== 'live' || (!force && key === S.watchSent)) return;
    if (send({ op: 'watch', ids: S.watch })) S.watchSent = key;
  };

  function connect() {
    timers.clear(S.retryT);
    S.retryT = null;
    if (!S.wanted) return;
    if (typeof WS !== 'function') {
      setStatus('down');
      return;
    }
    let ws;
    try {
      ws = new WS(url);
    } catch {
      fail(0);
      return;
    }
    S.ws = ws;
    if (S.status !== 'live') setStatus(S.tries ? (S.full ? 'full' : 'down') : 'connecting');
    S.openT = timers.set(() => {
      if (S.ws === ws && S.status !== 'live') {
        try {
          ws.close();
        } catch {
          // its close event follows, or never comes: either way it's let go
        }
        if (S.ws === ws) {
          S.ws = null;
          fail(0);
        }
      }
    }, connectMs);
    ws.onopen = () => {
      if (S.ws === ws) send({ op: 'sub', chain: S.chain });
    };
    ws.onmessage = (e) => {
      if (S.ws === ws) handle(typeof e.data === 'string' ? e.data : '');
    };
    ws.onclose = (e) => {
      if (S.ws !== ws) return;
      S.ws = null;
      fail(e && e.code);
    };
    ws.onerror = () => {};
  }

  function fail(code) {
    cancelLookups();
    timers.clear(S.openT);
    S.openT = null;
    S.tries += 1;
    S.watchSent = '';
    // 1013: the relay is full (try again later)
    S.full = code === 1013;
    setStatus(S.full ? 'full' : 'down');
    if (!S.wanted) return;
    const ms = Math.min(FEED.maxBackoffMs, 1000 * 2 ** Math.min(5, S.tries)) * (0.8 + 0.4 * random());
    S.retryT = timers.set(connect, S.full ? FEED.maxBackoffMs : ms);
  }

  function handle(text) {
    const m = parseMessage(text, S.chain);
    if (!m) return;
    switch (m.t) {
      case 'hi':
        timers.clear(S.openT);
        S.openT = null;
        S.tries = 0;
        S.full = false;
        S.ch = { ...m.ch };
        if (Object.keys(m.px).length) S.px = { ...S.px, ...m.px };
        setStatus('live');
        emit({ type: 'chains' });
        break;
      case 'st': {
        const before = S.ch[S.chain] ? S.ch[S.chain].s : null;
        Object.assign(S.ch, m.ch);
        const after = S.ch[S.chain] ? S.ch[S.chain].s : null;
        emit({ type: 'chains' });
        // the chain is back: everything again (which coins are live, and their markets now)
        if (!['live', 'quiet'].includes(before) && ['live', 'quiet'].includes(after)) send({ op: 'sub', chain: S.chain });
        break;
      }
      case 'px':
        S.px = { ...S.px, ...m.px };
        emit({ type: 'px' });
        break;
      case 'snap':
        S.coins.clear();
        for (const c of m.coins) S.coins.set(c.id, c);
        emit({ type: 'snap', coins: m.coins });
        sendWatch(true);
        break;
      case 'c':
        S.coins.set(m.coin.id, m.coin);
        while (S.coins.size > FEED.keepCoins) S.coins.delete(S.coins.keys().next().value);
        emit({ type: 'coin', coin: m.coin });
        break;
      case 'u':
        for (const x of m.u) {
          const c = S.coins.get(x.id);
          if (c) {
            c.st = x.st;
            if (x.dx) c.dx = x.dx;
          }
        }
        emit({ type: 'u', u: m.u });
        break;
      case 'off':
        for (const id of m.ids) {
          const c = S.coins.get(id);
          if (c) c.tracked = false;
        }
        emit({ type: 'off', ids: m.ids });
        break;
      case 'pic': {
        const c = S.coins.get(m.id);
        if (c) {
          c.pic = m.p;
          if (m.soc !== null) c.soc = m.soc;
        }
        emit({ type: 'pic', id: m.id, pic: m.p, soc: m.soc });
        break;
      }
      case 'h':
        emit({ type: 'h', id: m.id, h: m.h });
        break;
      case 'lookup':
        finishLookup(m.key, m.status);
        break;
      default:
        break;
    }
  }

  return {
    url,
    // Live mode on: connect (for `chain`)
    start(chain) {
      if (chain) this.setChain(chain);
      S.wanted = true;
      if (!S.ws && !S.retryT) connect();
    },
    // Live mode off: no connection at all
    stop() {
      cancelLookups();
      S.wanted = false;
      timers.clear(S.retryT);
      timers.clear(S.openT);
      S.retryT = null;
      S.openT = null;
      const ws = S.ws;
      S.ws = null;
      if (ws) {
        try {
          ws.close(1000);
        } catch {
          // gone already
        }
      }
      S.coins.clear();
      S.tries = 0;
      S.watch = [];
      S.watchSent = '';
      setStatus('idle');
    },
    setChain(chain) {
      if (!CHAIN_IDS.includes(chain) || chain === S.chain) return;
      cancelLookups();
      S.chain = chain;
      S.coins.clear();
      S.watch = [];
      S.watchSent = '';
      emit({ type: 'chain', chain });
      if (S.status === 'live') send({ op: 'sub', chain });
    },
    // the relay's ids of the coins to keep live for this player (its open coin, its bag): at most 8
    watch(ids) {
      S.watch = (Array.isArray(ids) ? ids : []).filter((x) => typeof x === 'string').slice(0, 8);
      sendWatch();
    },
    lookup(address) {
      // Reuse the response validator for chain-specific address normalization on the request too.
      const valid = parseMessage(JSON.stringify({ t: 'lookup', chain: S.chain, key: address, status: 'found' }), S.chain);
      if (!valid) return Promise.resolve(null);
      if (lookups.has(valid.key)) return lookups.get(valid.key).promise;
      if (S.status !== 'live') return Promise.reject(new Error('unavailable'));
      if (lookups.size >= 1) return Promise.reject(new Error('busy'));
      let resolve;
      let reject;
      const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
      const timer = timers.set(() => finishLookup(valid.key, 'unavailable'), 20_000);
      lookups.set(valid.key, { promise, resolve, reject, timer });
      if (!send({ op: 'lookup', address: valid.key })) finishLookup(valid.key, 'unavailable');
      return promise;
    },
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    get status() {
      return S.status;
    },
    get chain() {
      return S.chain;
    },
    chainState(id = S.chain) {
      return S.ch[id] ? S.ch[id].s : null;
    },
    newCoins(id = S.chain) {
      return S.ch[id] ? S.ch[id].n : 0;
    },
    get px() {
      return { ...S.px };
    },
    coins() {
      return [...S.coins.values()];
    },
    picUrl: (p) => picUrl(url, p),
  };
}
