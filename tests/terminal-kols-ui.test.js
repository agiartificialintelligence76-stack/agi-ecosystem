import test from 'node:test';
import assert from 'node:assert/strict';
import { createMarket } from '../src/games/trenchingsimulator/engine.js';
import { createPompWorkspace } from '../src/games/trenchingsimulator/boards/pomp-view.js';
import { Element, installDom, viewModule, chartURL, byClass, byLabel, byText, nodes } from './helpers/phomo-dom.js';

const { mountAxium } = await import(viewModule(new URL('../src/games/trenchingsimulator/boards/axium.js',import.meta.url),{'./gchart.js':chartURL}));
const { mountBasedbott } = await import(viewModule(new URL('../src/games/trenchingsimulator/boards/basedbott.js',import.meta.url),{'./gchart.js':chartURL}));
const gngmCoin = viewModule(new URL('../src/games/trenchingsimulator/boards/gngm-coin.js',import.meta.url),{'./gchart.js':chartURL});
const { mountGngm } = await import(viewModule(new URL('../src/games/trenchingsimulator/boards/gngm.js',import.meta.url),{'./gngm-coin.js':gngmCoin}));

function clientFixture() {
  let followed = false, status = 'live';
  const listeners = new Set();
  const person = {id:'kolscan:11111111111111111111111111111111',address:'11111111111111111111111111111111',name:'Verified source fixture',handle:'source_fixture',
    rank:1,pnlSol:23,wins:7,losses:2,url:'https://kolscan.io/account/11111111111111111111111111111111',twitter:'https://x.com/source_fixture'};
  const client = {snapshot:()=>({status,asOf:1700000000000,traders:status==='unavailable'?[]:[{...person,followed}]}),
    on(fn){listeners.add(fn);return()=>listeners.delete(fn);},toggleFollow(id){assert.equal(id,person.id);followed=!followed;for(const fn of listeners)fn();},
    unavailable(){status='unavailable';for(const fn of listeners)fn();}};
  return {client,listeners,person};
}

function harness(kind) {
  installDom(); document.addEventListener=()=>{};document.removeEventListener=()=>{};document.querySelector=()=>null;
  Element.prototype.prepend=function(...items){for(const n of items.reverse())this.insertBefore(n,this.firstChild);};
  Element.prototype.contains=function(n){return n===this||nodes(this).includes(n);};
  Element.prototype.removeAttribute=function(k){delete this.attrs[k];};
  Object.defineProperty(Element.prototype,'parentElement',{configurable:true,get(){return this.parentNode;}});
  const provider=clientFixture(), market=createMarket({seed:`public-kols-${kind}`,live:true,startSol:10,solUsd:150});
  // A source profile must never be assembled by renaming simulated smart-wallet rows.
  market.smartWallets=()=>{throw new Error('Live KOL views must not read simulated wallet profiles');};
  const orders=[];
  const ctx={market,kols:provider.client,chain:'solana',solUsd:150,currency:'sol',start:10,run:{mode:'free'},
    order:p=>{orders.push(p);return {ok:true};},settings:()=>({slippage:.2,priority:'normal'}),openSettings(){},pushSub(){},popSub(){},onCoin(){}};
  const host=new Element('main');document.body.append(host);
  let view;
  if(kind==='Pomp'){
    view=createPompWorkspace({market,ctx,openCoin(){},openBag(){},closeCoin(){},brand:new Element('div'),searchForm:new Element('form'),walletBtn:new Element('button')});
    host.append(view.rail,view.el,view.mobileNav);view.update();byLabel(host,'Real KOLs').click();
  } else {
    view=({Axium:mountAxium,BasedBott:mountBasedbott,GNGM:mountGngm}[kind])(host,ctx);
    if(kind==='GNGM')byText(host,'Track').click();else byText(host,'Trackers').click();
  }
  return{host,view,orders,...provider};
}

for(const kind of ['Axium','BasedBott','GNGM','Pomp'])test(`${kind} Live KOLs use verified source profiles, preserve follow state and unsubscribe without practice orders`,()=>{
  const h=harness(kind);
  try {
    const panels=nodes(h.host).filter(n=>n.classList.contains('ts-kols'));
    assert.ok(panels.length>=1);
    assert.match(panels[0].textContent,/Verified source fixture/);
    assert.match(panels[0].textContent,/Kolscan/);
    assert.doesNotMatch(panels[0].textContent,/Smart wallet|Trader 1/);
    const row=byClass(panels[0],'ts-kols-row');
    byLabel(panels[0],'Follow Verified source fixture').click();
    assert.equal(byClass(panels[0],'ts-kols-row'),row,'source refresh preserves focused row');
    assert.equal(byLabel(panels[0],'Unfollow Verified source fixture').getAttribute('aria-pressed'),'true');
    byClass(panels[0],'ts-kols-person').click();
    assert.match(byClass(panels[0],'ts-kols-detail').textContent,/Real-time trade activity and holdings are unavailable/);
    const search=byLabel(panels[0],'Search real KOLs');search.value='missing';search.fire('input');
    assert.equal(byClass(panels[0],'ts-kols-list').children.length,0);
    search.value='source';search.fire('input');assert.equal(byClass(panels[0],'ts-kols-list').children.length,1);
    h.client.unavailable();assert.equal(byClass(panels[0],'ts-kols-list').children.length,0);
    assert.match(panels[0].textContent,/KOL source unavailable/);
    assert.equal(h.orders.length,0);
    assert.ok(h.listeners.size>0);
  } finally {h.view.destroy();assert.equal(h.listeners.size,0);delete Element.prototype.parentElement;}
});
