import test from 'node:test';
import assert from 'node:assert/strict';
import { createPaperPerpsSession } from '../src/games/trenchingsimulator/paper-perps-session.js';
const flush = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  let now = 100000, cash = 1000, serial = 0; const pending = new Map(), listeners = new Set(), calls = [];
  const life = { starts:0, stops:0 }; let response;
  const client = { status:'idle', start() { life.starts++; this.status = 'live'; for (const fn of listeners) fn('live'); },
    stop() { life.stops++; this.status = 'idle'; }, onStatus(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    async request(op, args) { calls.push({op,args}); return response ? response() : {at:now,data:[{coin:'BTC',mark:100,leverage:40}]}; } };
  const account = { available:() => cash, reserve(key,value) { if (value > cash) return false; cash -= value; return true; }, mark() {}, settle(key,value) { cash += value; } };
  const session = createPaperPerpsSession({ account, now:() => now, client,
    timers:{ set(fn,ms) { const id = ++serial; pending.set(id,{fn,at:now+ms}); return id; }, clear(id) { pending.delete(id); } } });
  return { session, client, life, calls, pending, listeners, respond(fn) { response = fn; }, async advance(ms) {
    now += ms; const tasks = [...pending.entries()].filter(([,p]) => p.at <= now); for (const [id,p] of tasks) { pending.delete(id); p.fn(); } await flush();
  } };
}
test('one per-run quote connection is shared by panel leases and survives hidden panels with exposure', async () => {
  const f = fixture(), a = f.session.createClient(), b = f.session.createClient();
  a.start(); b.start(); assert.equal(f.life.starts,1);
  await a.request('markets',{dex:''});
  const order = f.session.ledger.submit({coin:'BTC',side:'long',kind:'limit',notional:100,leverage:10,limitPrice:90}); assert.equal(order.ok,true);
  a.stop(); b.release(); assert.equal(f.client.status,'live'); assert.equal(f.pending.size,1);
  await f.advance(5000); assert.ok(f.calls.length >= 2);
  f.session.ledger.cancel(order.id); assert.equal(f.client.status,'idle');
  f.session.destroy(); assert.equal(f.pending.size,0); a.release(); assert.equal(f.listeners.size,0);
});
test('identical public requests coalesce, stale responses never fill, and destroy cancels scheduling', async () => {
  const f = fixture(), a = f.session.createClient(); a.start();
  let resolve; f.respond(() => new Promise(done => { resolve = done; }));
  const one = a.request('markets',{dex:''}), two = a.request('markets',{dex:''}); await flush(); assert.equal(f.calls.length,1);
  resolve({at:100000,data:[{coin:'BTC',mark:100,leverage:40}]}); await Promise.all([one,two]);
  const order = f.session.ledger.submit({coin:'BTC',side:'long',kind:'limit',notional:100,leverage:10,limitPrice:90});
  f.respond(() => ({at:100000,stale:true,data:[{coin:'BTC',mark:80,leverage:40}]}));
  await f.advance(40000); assert.equal(f.session.ledger.snapshot().filled,0); assert.equal(f.session.ledger.snapshot().pending[0].id,order.id);
  f.session.destroy(); a.release(); assert.equal(f.pending.size,0); assert.equal(f.listeners.size,0);
});
