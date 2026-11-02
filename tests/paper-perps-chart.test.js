import test from 'node:test';
import assert from 'node:assert/strict';
import { createPerpsChart,perpsChartCandles } from '../src/games/trenchingsimulator/boards/phomo-perps-chart.js';
import { valueOf } from '../src/games/trenchingsimulator/boards/gngm-data.js';
import { createPaperPerps } from '../src/games/trenchingsimulator/paper-perps.js';
import { installDom,byLabel,byText } from './helpers/phomo-dom.js';
function factory() {
  const states=[];
  return {states,create(host,options){const state={sets:[],levels:[],style:'candles',scale:'normal',auto:true,visible:true,destroyed:false,drawings:[],tool:'cursor'};states.push(state);
    const change=patch=>{Object.assign(state,patch);options.onChange?.(state);};
    return {state,set:data=>state.sets.push({...data}),levels:data=>state.levels=data,style:v=>change({style:v}),indicators:v=>change({indicators:v}),
      settings:v=>change(v),scale:v=>change({scale:v}),auto:v=>change({auto:v}),drawTool:v=>change({tool:v}),range:v=>state.range=v,
      undo:()=>state.undo=true,redo:()=>state.redo=true,lockSelected(){},removeSelected(){},clearDrawings(){},showDrawings:v=>change({visible:v}),
      redraw(){},zoom(){},fit:()=>state.fit=true,toNow(){},screenshot:()=>null,destroy:()=>state.destroyed=true};}};
}
const bars=[{t:1792000000000,o:100,h:110,l:90,c:105,v:12},{t:1792000060000,o:105,h:115,l:100,c:110,v:7}];
test('perpetual chart preserves exact USD OHLC, epoch and base volume through the shared price adapter',()=>{
  const rows=perpsChartCandles(bars);assert.equal(rows[0].t,bars[0].t/1000);assert.equal(rows[0].v,12);
  for(const key of ['o','h','l','c'])assert.equal(valueOf(rows[0][key],{mode:'price',unit:'usd',solUsd:1}),bars[0][key]);
  installDom();const f=factory(),changes=[],view=createPerpsChart({createChart:f.create,onInterval:v=>changes.push(v)});document.body.append(view.el);
  view.set(bars,{coin:'BTC',interval:'1m'});const s=f.states[0],first=s.sets.at(-1).candles;
  view.set(bars.map(b=>({...b})),{coin:'BTC'});assert.equal(s.sets.at(-1).candles,first,'unchanged refresh keeps series input identity');
  view.set([{...bars[0],h:111},bars[1]],{coin:'BTC'});assert.notEqual(s.sets.at(-1).candles,first,'historical corrections reset aggregation');
  byLabel(view.el,'Perpetual chart style').value='area';byLabel(view.el,'Perpetual chart style').fire('change');assert.equal(s.style,'area');
  byText(view.el,'1h').click();assert.deepEqual(changes,['1h']);
  byLabel(view.el,'Trend line').click();assert.equal(s.tool,'trend');byLabel(view.el,'Logarithmic price scale').click();assert.equal(s.scale,'log');
  byLabel(view.el,'Volume bars').checked=false;byLabel(view.el,'Volume bars').fire('change');assert.equal(s.volume,false);
  view.set(bars,{coin:'ETH'});assert.equal(s.destroyed,true);assert.equal(f.states.length,2);view.destroy();assert.equal(f.states[1].destroyed,true);
});
test('paper fill markers and limit/protection overlays use only this market and are explicitly switchable',()=>{
  installDom();let cash=1000;const now=1792000000000,ledger=createPaperPerps({now:()=>now,account:{available:()=>cash,reserve(k,n){cash-=n;return true;},mark(){},settle(k,n){cash+=n;}}});
  ledger.observeMarkets([{coin:'BTC',mark:100,leverage:40}],{at:now});
  ledger.submit({coin:'BTC',side:'long',kind:'market',notional:100,leverage:10,tp:120,sl:90});
  ledger.submit({coin:'BTC',side:'long',kind:'limit',notional:100,leverage:10,limitPrice:95});
  const f=factory(),view=createPerpsChart({ledger,createChart:f.create});document.body.append(view.el);view.set(bars,{coin:'BTC'});
  const state=f.states[0];assert.equal(state.sets.at(-1).marks.length,1);assert.equal(state.levels.length,3);assert.equal(state.levels[0].value,95e9);
  byLabel(view.el,'Limit orders').checked=false;byLabel(view.el,'Limit orders').fire('change');assert.equal(state.levels.length,2);
  byLabel(view.el,'TP/SL').checked=false;byLabel(view.el,'TP/SL').fire('change');assert.equal(state.levels.length,0);
  byLabel(view.el,'My paper trades').checked=false;byLabel(view.el,'My paper trades').fire('change');assert.equal(state.sets.at(-1).marks.length,0);
  view.setActive(false);const count=state.sets.length;
  ledger.observeMarkets([{coin:'BTC',mark:101,leverage:40}],{at:now});assert.equal(state.sets.length,count,'hidden panel leaves required quote monitoring active without chart writes');
  view.setActive(true);assert.equal(state.sets.length,count+1);
  view.destroy();ledger.destroy();
});
