// Live pump.fun curves from Helius (2026-10-21, #404): one WebSocket (the free plan has 5), `accountSubscribe` on each
// followed coin's bonding-curve account, every change read as the curve's new state (parse.mjs). After connecting (and
// for coins followed while connected) their current state is read once more with `getMultipleAccounts` (100 at a time),
// so nothing is missed between the coin's launch and its subscription. Subscribe messages go out at most 20 a second.
// The key is in its addresses only (never logged: the log scrubs it).
import { createUpstream } from '../upstream.mjs';
import { parseCurveAccount } from '../parse.mjs';
import { trustedJson } from '../net.mjs';
import { errText } from '../log.mjs';

export function createHelius({ ws: wsUrl, http: httpUrl, log, onState, WS, maxSubs = 950, pingMs = 30000, backoff = {},
  resyncMs = 2000, sendPerSec = 20, fetchJson = trustedJson, now = Date.now } = {}) {
  const subs = new Map(); // account → { key, sub, req }
  const bySub = new Map(); // subscription id → account
  const byReq = new Map(); // request id → { acc, kind }
  const resync = new Set();
  const outbox = [];
  let seq = 0;
  let resyncT = null;
  let sendT = null;
  let notes = 0;
  let lastNote = 0;

  const up = createUpstream({
    name: 'Helius', url: wsUrl, log, WS, pingMs, backoff,
    onOpen: () => {
      bySub.clear();
      byReq.clear();
      outbox.length = 0;
      for (const [acc, s] of subs) {
        s.sub = null;
        s.req = null;
        subscribe(acc);
        resync.add(acc);
      }
      later();
    },
    onMessage: (text) => handle(text),
    onDown: () => {
      for (const s of subs.values()) {
        s.sub = null;
        s.req = null;
      }
      bySub.clear();
      byReq.clear();
      outbox.length = 0;
    },
  });

  function queueSend(msg) {
    outbox.push(msg);
    if (!sendT) sendT = setInterval(drain, 1000 / Math.max(1, sendPerSec));
  }
  function drain() {
    const msg = outbox.shift();
    if (msg) up.send(msg);
    if (!outbox.length) {
      clearInterval(sendT);
      sendT = null;
    }
  }

  function subscribe(acc) {
    const s = subs.get(acc);
    if (!s || s.req || s.sub != null || !up.connected) return;
    seq += 1;
    s.req = seq;
    byReq.set(seq, { acc, kind: 'sub' });
    queueSend({ jsonrpc: '2.0', id: seq, method: 'accountSubscribe', params: [acc, { encoding: 'base64', commitment: 'confirmed' }] });
  }

  function deliver(acc, value) {
    if (!value || !Array.isArray(value.data) || value.data[1] !== 'base64') return;
    const st = parseCurveAccount(value.data[0], value.owner);
    if (!st) return;
    const s = subs.get(acc);
    if (!s) return;
    notes += 1;
    lastNote = now();
    onState(s.key, st);
  }

  function handle(text) {
    let m;
    try {
      m = JSON.parse(text);
    } catch {
      return;
    }
    if (!m || typeof m !== 'object') return;
    if (m.method === 'accountNotification' && m.params) {
      const acc = bySub.get(m.params.subscription);
      if (acc) deliver(acc, m.params.result && m.params.result.value);
      return;
    }
    if (m.id == null || !byReq.has(m.id)) return;
    const r = byReq.get(m.id);
    byReq.delete(m.id);
    if (r.kind !== 'sub') return;
    const s = subs.get(r.acc);
    if (!Number.isInteger(m.result)) {
      if (s) s.req = null;
      log.warn(`Helius: a curve couldn't be followed (${String((m.error && m.error.message) || 'no answer').slice(0, 80)})`);
      return;
    }
    if (!s || s.req !== m.id) {
      // no longer wanted meanwhile
      queueSend({ jsonrpc: '2.0', id: ++seq, method: 'accountUnsubscribe', params: [m.result] });
      return;
    }
    s.req = null;
    s.sub = m.result;
    bySub.set(m.result, r.acc);
  }

  function later() {
    if (resyncT || !resync.size) return;
    resyncT = setTimeout(doResync, resyncMs);
  }
  async function doResync() {
    resyncT = null;
    const accs = [...resync].slice(0, 100);
    for (const a of accs) resync.delete(a);
    if (!accs.length) return;
    try {
      const r = await fetchJson(httpUrl, { method: 'POST', timeoutMs: 8000, maxBytes: 2_000_000,
        body: { jsonrpc: '2.0', id: 1, method: 'getMultipleAccounts', params: [accs, { encoding: 'base64', commitment: 'confirmed' }] } });
      const vals = r && r.result && Array.isArray(r.result.value) ? r.result.value : [];
      accs.forEach((a, i) => deliver(a, vals[i]));
    } catch (err) {
      log.warn(`Helius: couldn't read the curves (${errText(err)})`);
    }
    later();
  }

  return {
    start: () => up.start(),
    stop() {
      up.stop();
      clearTimeout(resyncT);
      clearInterval(sendT);
      resyncT = null;
      sendT = null;
    },
    // follow a coin's curve (`key`: what onState names it by); false when there's no room
    track(key, acc) {
      if (subs.has(acc)) return true;
      if (subs.size >= maxSubs) return false;
      subs.set(acc, { key, sub: null, req: null });
      if (up.connected) {
        subscribe(acc);
        resync.add(acc);
        later();
      }
      return true;
    },
    untrack(acc) {
      const s = subs.get(acc);
      if (!s) return;
      subs.delete(acc);
      resync.delete(acc);
      if (s.sub != null) {
        bySub.delete(s.sub);
        queueSend({ jsonrpc: '2.0', id: ++seq, method: 'accountUnsubscribe', params: [s.sub] });
      }
    },
    has: (acc) => subs.has(acc),
    get connected() {
      return up.connected;
    },
    get following() {
      return subs.size;
    },
    get active() {
      let n = 0;
      for (const s of subs.values()) if (s.sub != null) n += 1;
      return n;
    },
    get notes() {
      return notes;
    },
    get lastNoteAt() {
      return lastNote;
    },
    upstream: up,
  };
}
