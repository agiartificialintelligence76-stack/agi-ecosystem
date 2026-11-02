import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/games/trenchingsimulator/run.js';
import { createPaperPerps } from '../src/games/trenchingsimulator/paper-perps.js';
import { captureRunReplay,replayTradeAt } from '../src/games/trenchingsimulator/replay-data.js';
import { validArchivedReplay,createReplayArchive } from '../src/games/trenchingsimulator/replay-archive.js';
const near = (actual,expected) => assert.ok(Math.abs(actual-expected)<1e-8,`${actual} ≈ ${expected}`);
function fixture(options = {}) {
  const run = createRun({seed:'paper-account',terminal:'social',startSol:10,solUsd:100,...options}); let now=100000;
  const ledger = createPaperPerps({account:run.paperAccount,isOpen:() => run.mode === 'free' && !run.over,now:() => now}); run.attachPaperPerps(ledger);
  const quote = price => ledger.observeMarkets([{coin:'BTC',mark:price,leverage:40}],{at:now}); quote(100);
  return {run,ledger,quote,order:patch => ledger.submit({coin:'BTC',side:'long',kind:'market',notional:1000,leverage:10,...patch}),tick() {now+=250;run.tick(.25);}};
}
test('perpetual collateral is not spendable by spot, while total equity and cumulative fees reconcile', () => {
  const f=fixture(); const order=f.order(); assert.equal(order.ok,true); near(f.run.market.player.sol,8.995); near(f.run.market.player.worth,9.99);
  assert.equal(f.run.paperAccount.reserve('phomo-perps',900),false); assert.ok(f.run.market.maxBuy() < 8.995);
  f.tick(); f.quote(110); near(f.run.market.player.worth,10.9895); f.ledger.close(order.id); near(f.run.market.player.sol,10.9895);
  near(f.run.market.player.fees.paper,.0105); f.quote(110); near(f.run.market.player.fees.paper,.0105);
  f.run.end(); const result=f.run.result(); near(result.fees,.0105); near(result.pnlUsd,98.95); assert.equal(result.filled,2); assert.equal(result.coins,1); assert.equal(result.wins,1);
  assert.equal(result.paperPerps.open,0); near(result.paperPerps.realizedUsd,98.95); assert.equal(f.ledger.close(order.id).error,'free_only');
});
test('challenge, daily and other terminals cannot reserve paper collateral; funded positions prevent a false bust', () => {
  for (const options of [{mode:'challenge'},{mode:'daily'},{terminal:'board'}]) { const f=fixture(options); assert.equal(f.order().ok,false); near(f.run.market.player.sol,10); }
  const f=fixture(); assert.equal(f.order({notional:1000/(1/10+.0005)}).ok,true); near(f.run.market.player.sol,0); f.tick(); assert.equal(f.run.over,false);
  f.run.end(); const before=f.run.result(); f.ledger.destroy(); assert.deepEqual(f.run.result(),before);
});
test('used paper perpetual runs export separately as recorded-only and round trip through strict replay validation', () => {
  const f=fixture(); f.order(); f.tick(); f.quote(105); f.ledger.close(1,.5); f.tick(); f.order({kind:'limit',limitPrice:90,notional:100}); f.run.end();
  const record=captureRunReplay(f.run); assert.equal(record.live,false); assert.equal(record.replayable,false); assert.equal(record.log.length,0); assert.equal(record.paperPerps.positions.length,1);
  assert.equal(record.paperPerps.orders.length,2); assert.equal(record.paperPerps.fills.length,2); assert.equal(record.paperPerps.fills[1].t,.25); assert.equal(validArchivedReplay(record),true);
  assert.equal(replayTradeAt(record,0,1).paper,true); assert.equal(replayTradeAt(record,0,1).doneAt,.25); assert.equal(replayTradeAt(record,.25,-1).doneAt,0);
  const data=new Map(),store={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)}; const archive=createReplayArchive(store); const saved=archive.save(record); assert.equal(saved.ok,true);
  assert.deepEqual(createReplayArchive(store).get(saved.id),record);
  for (const corrupt of [r=>r.paperPerps.orders[0].wallet='secret',r=>r.paperPerps.fills[0].t=-1,r=>r.paperPerps.positions[0].leverage=1000,r=>r.replayable=true]) {
    const copy=JSON.parse(JSON.stringify(record)); corrupt(copy); assert.equal(validArchivedReplay(copy),false);
  }
});
