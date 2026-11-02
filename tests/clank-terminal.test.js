import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMarket } from '../src/games/trenchingsimulator/engine.js';
import { clankFeed, clankPair, validateClankLaunch } from '../src/games/trenchingsimulator/boards/clank-data.js';
import { createClankTicker } from '../src/games/trenchingsimulator/boards/clank-ticker.js';
import { installDom, Element } from './helpers/phomo-dom.js';

function tickerHarness({reduced=false,width=250}={}){
  installDom();let reads=0,resize;const animations=[],listeners=new Map(),mediaListeners=new Set();
  document.hidden=false;document.addEventListener=(k,fn)=>{if(!listeners.has(k))listeners.set(k,new Set());listeners.get(k).add(fn);};
  document.removeEventListener=(k,fn)=>listeners.get(k)?.delete(fn);
  const create=document.createElement;
  document.createElement=tag=>{
    const node=create(tag);node.removeAttribute=k=>delete node.attrs[k];
    node.contains=target=>node===target||node.childNodes.some(child=>child===target||child.contains?.(target));
    node.getBoundingClientRect=()=>{reads++;return {width:node.classList.contains('tsc-tape-window')?width:150};};
    node.animate=(frames,options)=>{
      const animation={frames,options,currentTime:0,playState:'running',pause(){this.playState='paused';},play(){this.playState='running';},cancel(){this.playState='idle';},finish(){this.playState='finished';this.onfinish?.();}};
      animations.push(animation);return animation;
    };return node;
  };
  class Resize{constructor(fn){resize=this;this.fn=fn;}observe(){}disconnect(){this.disconnected=true;}}
  const media={matches:reduced,addEventListener:(_,fn)=>mediaListeners.add(fn),removeEventListener:(_,fn)=>mediaListeners.delete(fn)};
  const host=document.createElement('div');document.body.append(host);let clicks=0;
  const ticker=createClankTicker(host,{keyOf:r=>r.id,makeItem:r=>{const b=document.createElement('button');b.textContent=r.id;b.addEventListener('click',()=>clicks++);return b;},media,Resize});
  return {host,ticker,animations,listeners,mediaListeners,get reads(){return reads;},get clicks(){return clicks;},get resize(){return resize;},
    motion(matches){media.matches=matches;for(const fn of mediaListeners)fn({matches});},
    visibility(hidden){document.hidden=hidden;for(const fn of listeners.get('visibilitychange')||[])fn();},
    track:()=>host.querySelector('.tsc-tape-track'),rows:(n,offset=0)=>Array.from({length:n},(_,i)=>({id:`trade-${offset+i}`}))};
}

test('Clank ticker leaves active trade nodes and animation untouched during rapid incoming updates',()=>{
  const h=tickerHarness();h.ticker.update(h.rows(20));const track=h.track(),initial=[...track.children],animation=h.animations[0],reads=h.reads;
  assert.equal(initial.length,3);animation.currentTime=900;
  for(let i=1;i<=1000;i++)h.ticker.update(h.rows(20,i*20));
  assert.deepEqual(track.children,initial,'new300ms batches cannot reorder or replace visible trades');
  assert.equal(h.animations.length,1);assert.equal(animation.currentTime,900,'feed arrival cannot restart motion');
  assert.equal(h.reads,reads,'feed updates do no layout reads');assert.equal(h.ticker.state.queued,20);assert.equal(h.ticker.state.seen,512);
  animation.finish();
  assert.equal(track.children[0],initial[1]);assert.equal(track.children[1],initial[2],'remaining visible nodes keep their order');
  assert.equal(track.children[2].dataset.tradeKey,'trade-20000','next offscreen item comes from latest batch, not a long backlog');
  assert.equal(animation.playState,'idle');assert.equal(h.animations[1].options.duration,2500);
  assert.deepEqual(h.animations[1].frames,[{transform:'translate3d(0,0,0)'},{transform:'translate3d(-150px,0,0)'}]);
  track.children[0].querySelector('button').click();assert.equal(h.clicks,1);h.ticker.destroy();
});

test('Clank ticker pauses the same animation for hover, focus, hidden page and terminal navigation',()=>{
  const h=tickerHarness();h.ticker.update(h.rows(10));const a=h.animations[0];a.currentTime=500;
  h.host.fire('mouseenter');assert.equal(a.playState,'paused');h.ticker.update(h.rows(10,50));assert.equal(a.currentTime,500);
  h.host.fire('mouseleave');assert.equal(a.playState,'running');h.host.fire('focusin');assert.equal(a.playState,'paused');
  h.host.fire('focusout',{relatedTarget:h.track().children[1]});assert.equal(a.playState,'paused');
  const viewport=h.host.querySelector('.tsc-tape-window');viewport.scrollLeft=320;
  h.host.fire('focusout',{relatedTarget:null});assert.equal(a.playState,'running');
  assert.equal(viewport.scrollLeft,0,'native keyboard scrolling is reset when the moving strip resumes');
  h.visibility(true);assert.equal(a.playState,'paused');h.visibility(false);assert.equal(a.playState,'running');
  h.ticker.visible(false);assert.equal(a.playState,'paused');h.ticker.visible(true);assert.equal(a.playState,'running');
  assert.equal(h.animations.length,1);assert.equal(a.currentTime,500);h.ticker.destroy();
  assert.equal(a.playState,'idle');assert.equal(a.onfinish,null);assert.equal(h.resize.disconnected,true);
  assert.equal(h.mediaListeners.size,0);assert.equal(h.listeners.get('visibilitychange').size,0);assert.equal(h.host.children.length,0);
  h.ticker.update(h.rows(10,100));assert.equal(h.host.children.length,0);
});

test('Clank reduced motion provides a static scrollable strip and explicit latest-trades refresh',()=>{
  const h=tickerHarness({reduced:true});h.ticker.update(h.rows(10));const nodes=[...h.track().children];
  assert.equal(h.animations.length,0);assert.ok(h.host.classList.contains('is-reduced-motion'));
  const refresh=h.host.querySelector('.tsc-tape-refresh');assert.equal(refresh.hidden,false);assert.equal(refresh.disabled,true);
  h.ticker.update(h.rows(10,50));assert.deepEqual(h.track().children,nodes);assert.equal(refresh.disabled,false);
  refresh.click();assert.equal(h.track().children[0].dataset.tradeKey,'trade-50');assert.equal(refresh.disabled,true);
  h.motion(false);assert.equal(h.animations.length,1);assert.equal(refresh.hidden,true);
  h.motion(true);assert.equal(h.animations[0].playState,'idle');assert.equal(h.ticker.state.moving,false);h.ticker.destroy();
});

test('Clank ticker fills short feeds without gaps and excludes repeated copies from keyboard navigation',()=>{
  const h=tickerHarness({width:800});h.ticker.update(h.rows(1));const cells=h.track().children;
  assert.ok(cells.length*150>=800+150);assert.equal(cells[0].getAttribute('aria-hidden'),null);
  for(const cell of cells.slice(1)){assert.equal(cell.getAttribute('aria-hidden'),'true');assert.equal(cell.querySelector('button').tabIndex,-1);}
  h.animations[0].finish();assert.equal(h.track().children[0].getAttribute('aria-hidden'),null);
  assert.equal(h.track().children[0].querySelector('button').tabIndex,0);h.ticker.destroy();
});

test('Clank New includes every bonding phase in true launch order without duplicate rows', () => {
  const rows = [
    { id: 1, born: 10, pair: 'ETH' }, { id: 2, born: 30, pair: 'SPCX' },
    { id: 3, born: 20, pair: 'ETH' }, { id: 4, born: 30, pair: 'SPCX' },
  ];
  const market = { lists: () => ({ new: [rows[0], rows[1]], stretch: [rows[2], rows[1]], migrated: [rows[3]], trending: [rows[3], rows[1]] }),
    find: () => [2, 3], row: (id) => rows.find((r) => r.id === id) };
  assert.deepEqual(clankFeed(market, { sort: 'new' }).map((r) => r.id), [4, 2, 3, 1]);
  assert.deepEqual(clankFeed(market, { sort: 'new', pair: 'SPCX' }).map((r) => r.id), [4, 2]);
  assert.deepEqual(clankFeed(market, { query: 'some coin', pair: 'ETH' }).map((r) => r.id), [3]);
  assert.deepEqual(clankFeed(market, { limit: 1 }).map((r) => r.id), [4]);
});

test('Clank never labels an unknown live pairing as ETH', () => {
  assert.equal(clankPair({ live: true }), 'Unknown');
  assert.equal(clankPair({ live: true, pair: 'sol' }), 'Unknown');
  assert.equal(clankPair({ live: true, pair: 'ETH' }), 'Unknown');
  assert.equal(clankPair({ live: true, pair: '0x1234567890123456789012345678901234567890' }), 'Unknown');
  assert.equal(clankPair({ live: true, quoteAsset: 'spcx' }), 'SPCX');
  assert.equal(clankPair({ live: true, quoteAsset: 'unverified' }), 'Unknown');
  assert.equal(clankPair({ name: 'A simulated coin' }), 'ETH');
});

test('Clank launch validation rejects broken tickers, unknown pairs, and invalid money', () => {
  const valid = { name: ' Space cat ', ticker: '$cat', pair: 'SPCX', initialBuy: '10,50' };
  assert.deepEqual(validateClankLaunch(valid), { ok: true, name: 'Space cat', ticker: 'CAT', pair: 'SPCX', amount: 10.5 });
  for (const patch of [{ ticker: '<svg>' }, { ticker: 'WAYTOOLONGTICKER' }, { name: ' ' }, { pair: 'UNKNOWN' },
    { initialBuy: '-10' }, { initialBuy: 'Infinity' }, { initialBuy: '1e100' }]) {
    assert.equal(validateClankLaunch({ ...valid, ...patch }).ok, false, JSON.stringify(patch));
  }
  assert.equal(validateClankLaunch({ ...valid, initialBuy: '' }).amount, 0);
});

test('A newly created Clank coin is searchable and appears in the chosen stock-pair feed', () => {
  const market = createMarket({ seed: 'clank-launch-feed', startSol: 10, config: { warmup: 0 } });
  const fields = validateClankLaunch({ name: 'Launchpad Ghost', ticker: 'GHOST', pair: 'NVDA', initialBuy: '10' });
  const launched = market.launchCoin({ ...fields, emoji: '👻', line: 'A practice launch' });
  assert.equal(launched.ok, true);
  assert.equal(clankFeed(market, { sort: 'new', pair: 'NVDA' })[0].id, launched.id);
  assert.equal(clankFeed(market, { query: 'GHOST', pair: 'NVDA' })[0].id, launched.id);
  assert.equal(clankFeed(market, { query: 'GHOST', pair: 'SPCX' }).length, 0);
  assert.equal(market.quote({ coin: launched.id, side: 'buy', sol: fields.amount / 150 }).ok, true);
});
