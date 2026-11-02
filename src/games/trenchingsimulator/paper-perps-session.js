// One public-data connection and one paper ledger per run, independent of visible panels.
import { createPaperPerps } from './paper-perps.js';
import { createPerpsClient } from './boards/phomo-perps.js';

export function createPaperPerpsSession({ account, isOpen, now = Date.now, client = createPerpsClient(),
  timers = { set: (fn, ms) => setTimeout(fn, ms), clear: id => clearTimeout(id) } } = {}) {
  const ledger = createPaperPerps({ account, isOpen, now });
  const viewers = new Set(), requests = new Map();
  let dead = false, timer = null, polling = false, nextPoll = 0, cursor = 0, started = false;
  const needed = () => ledger.snapshot().neededMarkets;
  const wanted = () => viewers.size > 0 || needed().length > 0;
  function connection() {
    if (dead) return;
    if (wanted() && !started) { started = true; client.start(); }
    else if (!wanted() && started) { started = false; client.stop(); }
  }
  function request(op, args = {}) {
    if (dead) return Promise.reject(new Error('stopped'));
    const key = `${op}:${JSON.stringify(args)}`;
    if (requests.has(key)) return requests.get(key);
    const task = Promise.resolve().then(() => client.request(op, args)).then(reply => {
      if (!dead && op === 'markets') ledger.observeMarkets(reply.data, { at: reply.at, stale: reply.stale });
      return reply;
    }).finally(() => { if (requests.get(key) === task) requests.delete(key); });
    requests.set(key, task); return task;
  }
  async function poll() {
    if (dead || polling || client.status !== 'live') return;
    const groups = [...new Set(needed().map(coin => coin.includes(':') ? coin.split(':')[0] : ''))];
    if (!groups.length) return;
    // At most three groups per pass leaves one client slot for visible chart requests.
    const batch = Array.from({ length: Math.min(3, groups.length) }, (_, i) => groups[(cursor + i) % groups.length]);
    cursor = (cursor + batch.length) % groups.length; polling = true; nextPoll = now() + 4000;
    try { await Promise.allSettled(batch.map(dex => request('markets', { dex }))); }
    finally { polling = false; }
  }
  function schedule() {
    connection();
    if (dead || timer !== null || !needed().length) return;
    timer = timers.set(() => {
      timer = null; if (dead) return;
      ledger.advance(); if (now() >= nextPoll) poll(); schedule();
    }, 1000);
  }
  const offLedger = ledger.on(schedule);
  const offStatus = client.onStatus(status => { if (status === 'live' && needed().length) { nextPoll = 0; poll(); } });
  return {
    ledger,
    // Each panel gets its own lease. Pausing or removing one panel cannot stop another
    // panel's quotes, or the marks needed by an existing position or pending order.
    createClient() {
      const lease = {}, listeners = new Set(); let active = false, released = false;
      const off = client.onStatus(status => { if (active) for (const fn of listeners) fn(status); });
      return {
        get status() { return client.status; },
        start() { if (dead || released || active) return; active = true; viewers.add(lease);
          const wasLive = client.status === 'live'; connection(); if (wasLive) for (const fn of listeners) fn('live'); },
        stop() { if (!active) return; active = false; viewers.delete(lease); connection(); },
        onStatus(fn) { listeners.add(fn); return () => listeners.delete(fn); },
        request,
        release() { if (released) return; released = true; active = false; viewers.delete(lease); off(); listeners.clear(); connection(); },
      };
    },
    destroy() { if (dead) return; dead = true; timers.clear(timer); timer = null; offLedger(); offStatus();
      ledger.destroy(); client.stop(); viewers.clear(); requests.clear(); },
  };
}
