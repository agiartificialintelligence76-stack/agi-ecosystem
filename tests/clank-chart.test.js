import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createClankBuckets, updateClankStudies, clankDisplayCandles, createClankPracticeSeries } from '../src/games/trenchingsimulator/boards/clank-chart-data.js';
import { createClankImageQueue } from '../src/games/trenchingsimulator/boards/clank-images.js';
import { createClankMarket } from '../src/games/trenchingsimulator/clank-live.js';
import { aggregate, sma, ema, rsi, macd } from '../src/games/trenchingsimulator/boards/gngm-data.js';
import { installDom, Element, viewModule, byLabel } from './helpers/phomo-dom.js';
const { createClankChart, clankClock } = await import(viewModule(new URL('../src/games/trenchingsimulator/boards/clank-chart.js',import.meta.url)));
const rows = (n,start=0) => Array.from({length:n},(_,i)=>({t:start+i,o:100+i,h:102+i,l:99+i,c:101+i,v:i+1}));

test('practice candles retain frozen real context and append local prices and volume without overlapping intervals',()=>{
  const stream=createClankPracticeSeries(),base=120000,started=75;
  const history=[{t:60,o:100,h:110,l:90,c:105,v:12},{t:120,o:105,h:115,l:100,c:110,v:14},{t:180,o:110,h:999,l:1,c:900,v:999}];
  const practice=[{t:74,o:8,h:8,l:8,c:8,v:100},{t:75,o:2,h:2.2,l:1.9,c:2.1,v:3}];
  const args={key:'coin',base,started,history,historyThrough:210,practice,tf:60,solUsd:100};
  let result=stream.update(args);
  assert.deepEqual(result.candles.map(b=>[b.t,b.c,b.v]),[[60,105,12],[120,110,14],[195,210,300]]);
  assert.equal(result.practiceAt,195);assert.equal(result.history,true);
  const first=result.candles[0],array=result.candles,revision=result.revision;
  practice[1]={...practice[1],h:2.5,c:2.4,v:5};result=stream.update({...args,history:history.map(b=>({...b,c:999999}))});
  assert.equal(result.candles,array);assert.equal(result.candles[0],first);assert.equal(result.candles.at(-1).c,240);assert.equal(result.candles.at(-1).v,500);
  assert.equal(result.revision,revision,'metadata refresh does not reset the practice path');
  practice.push({t:76,o:2.4,h:2.6,l:2.3,c:2.5,v:7});result=stream.update(args);
  assert.equal(result.candles.at(-1).t,196);assert.equal(result.candles.at(-1).v,700);
  const aggregate=createClankBuckets().update(result.candles,60).bars;
  assert.equal(aggregate.at(-1).o,200);assert.equal(aggregate.at(-1).v,1200,'only local volume enters the practice interval');
  assert.deepEqual(history.at(-1),{t:180,o:110,h:999,l:1,c:900,v:999},'raw source candles are untouched');
});

test('late source history can backfill once without extrapolating past its clock or resetting local candles',()=>{
  const stream=createClankPracticeSeries(),args={key:1,base:100000,started:10,tf:1,solUsd:100,seed:3};
  let result=stream.update(args);assert.deepEqual(result.candles,[{t:110,o:300,h:300,l:300,c:300,v:0}]);
  const history=[{t:90,o:100,h:110,l:99,c:105,v:1}];
  result=stream.update({...args,history,historyThrough:92});
  assert.deepEqual(result.candles.map(b=>b.t),[90,91,92,110]);
  const practice=[{t:10,o:3,h:3.1,l:2.9,c:3.05,v:1}];
  result=stream.update({...args,history,historyThrough:109,practice});
  assert.deepEqual(result.candles.map(b=>b.t),[90,91,92,110],'late source polls cannot move the frozen boundary');
  assert.equal(result.candles.at(-1).v,100);
  const other=stream.update({...args,key:2,practice:[]});assert.equal(other.candles.length,1);assert.equal(other.history,false);
});

test('visible coin logos use six concurrent stable URLs and spaced bounded retries',()=>{
  installDom();let time=0,seq=0,observer;const pending=new Map();
  const timers={set(fn,ms){const id=++seq;pending.set(id,{fn,at:time+ms});return id;},clear(id){pending.delete(id);}};
  const advance=ms=>{time+=ms;for(const[id,t]of [...pending])if(t.at<=time){pending.delete(id);t.fn();}};
  class Observer{constructor(fn){observer=this;this.fn=fn;this.items=new Set();}observe(img){this.items.add(img);}unobserve(img){this.items.delete(img);}disconnect(){this.items.clear();}}
  const loader=createClankImageQueue({timers,observe:Observer}),images=[];let loaded=0,failed=0;
  for(let i=0;i<10;i++){
    const img=new Element('img');img.urls=[];Object.defineProperty(img,'src',{set(v){img.urls.push(v);},get(){return img.urls.at(-1);}});
    document.body.append(img);images.push(img);loader.add(img,`/api/checker?terminal=clank&image=coin${i}`,{onLoad:()=>loaded++,onError:()=>failed++});
  }
  assert.equal(loader.state.running,0,'offscreen artwork does not make requests');
  observer.fn(images.map(target=>({target,isIntersecting:true})));
  assert.equal(loader.state.running,6);assert.equal(loader.state.queued,4);
  images[0].fire('error');assert.equal(loader.state.running,6);assert.equal(images[6].urls.length,1);assert.equal(failed,1);
  for(const img of images.slice(1))img.fire('load');assert.equal(loaded,9);assert.equal(loader.state.running,0);
  advance(1999);assert.equal(images[0].urls.length,1);advance(1);assert.equal(images[0].urls.length,2);
  images[0].fire('error');advance(5000);images[0].fire('error');advance(15000);images[0].fire('error');advance(60000);
  assert.equal(images[0].urls.length,4);assert.ok(images[0].urls.every(url=>url===images[0].urls[0]),'no rejected cache-buster query params');
  assert.equal(loader.state.running,0);assert.equal(loader.state.tracked,0);loader.destroy();assert.equal(pending.size,0);
});

test('destroying a coin image queue cancels retries and releases active slots',()=>{
  installDom();const pending=new Map();let seq=0;
  const timers={set(fn){pending.set(++seq,fn);return seq;},clear(id){pending.delete(id);}};
  const loader=createClankImageQueue({timers,observe:null});const img=new Element('img');document.body.append(img);loader.add(img,'/stable');
  for(const[id,fn]of [...pending]){pending.delete(id);fn();}assert.equal(loader.state.running,1);
  loader.destroy();assert.equal(pending.size,0);assert.equal(loader.state.running,0);assert.equal(loader.state.tracked,0);
  img.fire('error');assert.equal(pending.size,0);
});

test('default image timers do not invoke native window functions with the queue object as receiver',()=>{
  installDom();const originalSet=globalThis.setTimeout,originalClear=globalThis.clearTimeout,pending=new Map();let seq=0,loader;
  try{
    globalThis.setTimeout=function(fn){assert.equal(this,undefined,'native timers require a legal receiver');pending.set(++seq,fn);return seq;};
    globalThis.clearTimeout=function(id){assert.equal(this,undefined,'native timer cancellation requires a legal receiver');pending.delete(id);};
    loader=createClankImageQueue({observe:null});const img=new Element('img');document.body.append(img);loader.add(img,'/stable');
    for(const[id,fn]of [...pending]){pending.delete(id);fn();}
    assert.equal(img.src,'/stable');img.fire('load');assert.equal(loader.state.running,0);assert.equal(pending.size,0);
  }finally{loader?.destroy();globalThis.setTimeout=originalSet;globalThis.clearTimeout=originalClear;}
});

test('Clank quiet intervals carry confirmed prices with zero volume only through the indexer clock',()=>{
  const source=[{t:60,o:10,h:12,l:9,c:11,v:7},{t:240,o:20,h:22,l:19,c:21,v:8}];
  const copy=structuredClone(source),bars=clankDisplayCandles(source,60,419);
  assert.deepEqual(bars.map(b=>b.t),[60,120,180,240,300,360]);
  assert.deepEqual(bars.filter(b=>b.carried).map(b=>[b.o,b.h,b.l,b.c,b.v]),[[11,11,11,11,0],[11,11,11,11,0],[21,21,21,21,0],[21,21,21,21,0]]);
  assert.deepEqual(bars[3],{t:240,o:11,h:22,l:11,c:21,v:8},'real candle opens at confirmed preceding close and extends its wick');
  assert.equal(bars.reduce((n,b)=>n+b.v,0),15,'display interpolation cannot invent trading volume');
  assert.equal(clankDisplayCandles(source,60).at(-1).t,240,'missing indexer time cannot advance the chart');
  assert.deepEqual(source,copy,'raw market data stays unchanged');
  const huge=clankDisplayCandles([source[0]],1,1e12);assert.equal(huge.length,501);assert.equal(huge.at(-1).t,1e12);
  assert.equal(huge[1].t,61);assert.equal(huge.at(-2).t,1e12-1,'large gaps retain both edges');
  const many=Array.from({length:1000},(_,i)=>({...source[0],t:i*10000}));
  assert.ok(clankDisplayCandles(many,1).length<=3000,'work stays bounded even with many long gaps');
});

test('Clank buckets preserve history and rework only the active interval after live tail replacement',()=>{
  const input=rows(7200),cache=createClankBuckets();
  assert.equal(cache.update(input,5).visited,7200);
  const first=cache.update(input,5);assert.equal(first.visited,0);assert.equal(first.from,1440);
  input.at(-1).c+=2;input.at(-1).h+=2;
  let got=cache.update(input,5);assert.equal(got.visited,5);assert.equal(got.full,false);
  assert.deepEqual(got.bars,aggregate(input,5).map(({b,s,...bar})=>bar));
  const stable=got.bars[0];input.push({t:7200,o:7300,h:7302,l:7299,c:7301,v:10});
  got=cache.update(input,5);assert.equal(got.visited,6);assert.equal(got.bars[0],stable);
  assert.deepEqual(got.bars,aggregate(input,5).map(({b,s,...bar})=>bar));
  got=cache.update(input,60);assert.equal(got.full,true);assert.equal(got.visited,input.length);
  input[0].h=9000;got=cache.update(input,60,true);assert.equal(got.bars[0].h,9000);
});

test('Clank stream handles old-history backfill, pruning, empty and invalid candles',()=>{
  const cache=createClankBuckets();cache.update(rows(30,30));
  let got=cache.update(rows(60));assert.equal(got.full,true);assert.equal(got.bars.length,60);
  got=cache.update(rows(30,30));assert.equal(got.full,true);assert.equal(got.bars[0].t,30);
  got=cache.update([]);assert.deepEqual(got.bars,[]);
  got=cache.update([{t:1,o:1,h:2,l:0,c:1,v:3},{t:2,o:NaN,h:2,l:0,c:1},{t:3,o:1,h:2,l:0,c:1,v:Infinity}]);
  assert.deepEqual(got.bars.map(x=>[x.t,x.v]),[[1,3],[3,0]]);
});

test('Clank incremental studies agree with complete MA, EMA, RSI and MACD calculations',()=>{
  const bars=rows(200).map((b,i)=>({...b,c:100+Math.sin(i/5)*20+i*.1}));
  const study=[];updateClankStudies(bars.slice(0,180),study);updateClankStudies(bars,study,179);
  bars.at(-1).c+=5;updateClankStudies(bars,study,199);
  const close=bars.map(b=>b.c),m=macd(close),expected={ma:sma(close,20),ema:ema(close,9),rsi:rsi(close),macd:m.line,signal:m.signal,hist:m.hist};
  for(const[k,values]of Object.entries(expected))for(let i=0;i<values.length;i++){
    if(values[i]===null)assert.equal(study[i][k],null,`${k} warmup at ${i}`);
    else assert.ok(Math.abs(study[i][k]-values[i])<1e-9,`${k} at ${i}`);
  }
});

function fakeLibrary(){
  const state={series:[],markers:[],cross:new Set(),options:[],fit:0,latest:0,ranges:[],removed:false};
  const timeOptions={barSpacing:7};
  const api={addSeries(def,options,pane=0){
    const s={type:def.type,options,pane,data:[],sets:0,updates:0,
      setData(data){s.data=data;s.sets++;},update(row){s.updates++;if(s.data.at(-1)?.time===row.time)s.data[s.data.length-1]=row;else s.data.push(row);},
      applyOptions(next){Object.assign(s.options,next);},priceScale:()=>({applyOptions(){}})};state.series.push(s);return s;},
    removeSeries(s){state.series.splice(state.series.indexOf(s),1);},applyOptions(o){state.options.push(o);},
    subscribeCrosshairMove(fn){state.cross.add(fn);},unsubscribeCrosshairMove(fn){state.cross.delete(fn);},
    timeScale:()=>({options:()=>timeOptions,applyOptions:o=>Object.assign(timeOptions,o),fitContent:()=>state.fit++,scrollToRealTime:()=>state.latest++,setVisibleLogicalRange:r=>state.ranges.push(r)}),
    remove(){state.removed=true;}};
  const lib={createChart:(_,options)=>{state.initial=options;return api;},createSeriesMarkers:(_,markers)=>{
    const m={rows:markers,setMarkers(rows){m.rows=rows;},detach(){m.dead=true;}};state.markers.push(m);return m;},
    ColorType:{Solid:'solid'},CrosshairMode:{Normal:0},PriceScaleMode:{Normal:0,Logarithmic:1},LastPriceAnimationMode:{Disabled:0},TickMarkType:{Time:3,TimeWithSeconds:4}};
  for(const type of ['Candlestick','Bar','Line','Area','Histogram'])lib[`${type}Series`]={type};
  installDom();const host=new Element('div');host.className='tsc-chart';document.body.append(host);
  return {state,lib,host};
}

test('the real Clank practice model drives chart prices, volume and buy/sell markers without source resets',()=>{
  const now=1793615000000,address=`0x${'a'.repeat(40)}`,listeners=new Set();
  const coin={address,name:'Source coin',ticker:'SRC',marketCapUsd:4000,phase:'curve',progress:.1,holderCount:7,quoteAsset:'ETH'};
  const feed={status:'live',coins:()=>[coin],on(fn){listeners.add(fn);return()=>listeners.delete(fn);},watch(){},trending:()=>[address],chainState:()=> 'live'};
  const market=createClankMarket({feed,seed:'clank-order-chart',solUsd:100,startSol:20,wallNow:()=>now}),id=market.find(address)[0];
  const f=fakeLibrary(),chart=createClankChart(f.host,{lib:f.lib}),stream=createClankPracticeSeries();
  const history=[{t:now/1000-10,o:3900,h:4010,l:3890,c:4000,v:80}];
  const refresh=()=>{
    const r=stream.update({key:id,history,practice:market.candles(id),base:market.baseTime,started:market.clankPracticeStart(id),seed:market.clankPracticeSeed(id),solUsd:100});
    chart.set({key:id,label:'SRC',candles:r.candles,revision:r.revision,tf:1,base:0,solUsd:1,practice:true,practiceAt:r.practiceAt,sourceHistory:r.history,
      marks:market.orders().filter(o=>o.status==='filled').map(o=>({t:now/1000+o.doneAt,side:o.side}))});
  };
  market.advanceTo(1);refresh();const main=f.state.series.find(s=>s.type==='Candlestick'),volume=f.state.series.find(s=>s.type==='Histogram');
  assert.equal(main.data.at(-1).close,market.stats(id).mc*100);
  assert.equal(market.order({coin:id,side:'buy',sol:.5,priority:'ultra',slippage:1}).ok,true);market.advanceTo(2);refresh();
  assert.equal(market.orders()[0].status,'filled');assert.equal(main.data.at(-1).close,market.stats(id).mc*100);
  assert.ok(f.state.markers.at(-1).rows.some(m=>m.text==='B'));assert.ok(f.state.markers.at(-1).rows.some(m=>m.text==='Practice begins'));
  assert.ok(Math.abs(volume.data.filter(b=>b.time>=now/1000).reduce((sum,b)=>sum+b.value,0)-market.stats(id).vol*100)<1e-8);
  assert.match(f.host.querySelector('.clc-legend-title').textContent,/Simulated market/);
  const prices=structuredClone(main.data),resets=chart.state.stats.resets;
  for(const fn of listeners)fn({type:'snap',coins:[{...coin,marketCapUsd:900000}]});refresh();
  assert.deepEqual(main.data,prices);assert.equal(chart.state.stats.resets,resets,'a source quote cannot repaint the practice market');
  assert.equal(market.order({coin:id,side:'sell',frac:1,priority:'ultra',slippage:1}).ok,true);market.advanceTo(3);refresh();
  assert.equal(market.orders()[0].status,'filled');assert.ok(f.state.markers.at(-1).rows.some(m=>m.text==='S'));
  for(const fn of f.state.cross)fn({point:{x:1,y:1},time:history[0].t});
  assert.match(f.host.querySelector('.clc-legend-title').textContent,/Clank history/);
  chart.destroy();market.destroy();
});

test('Clank chart sends only changed candles and preserves pan, timestamps and hover state',()=>{
  assert.equal(clankClock(Date.UTC(2026,10,2,10,11,12)/1000,true),'10:11:12','Clank axes use UTC regardless of browser timezone');
  const f=fakeLibrary(),hover=[],chart=createClankChart(f.host,{lib:f.lib,onHover:v=>hover.push(v)}),candles=rows(400);
  chart.set({key:1,label:'CAT',candles,solUsd:150,base:1000000});
  const main=f.state.series.find(s=>s.type==='Candlestick');const sets=main.sets,rangeCount=f.state.ranges.length;
  const first=main.data[0];assert.equal(first.open,15000);assert.equal(first.time,1000);
  chart.view({supply:1e9});chart.view({mode:'mcap',unit:'usd'});assert.equal(main.sets,sets,'repeated board view props cannot replace the chart history');
  chart.set({candles,base:1000999});assert.equal(main.sets,sets);assert.equal(main.updates,0);assert.equal(main.data[0].time,1000,'market-speed clock drift cannot shift history');
  candles.at(-1).c++;chart.set({candles});assert.equal(main.updates,1);assert.equal(main.sets,sets);assert.equal(main.data[0],first);
  candles.push({t:400,o:500,h:502,l:499,c:501,v:30});chart.set({candles});assert.equal(main.updates,3);assert.equal(f.state.ranges.length,rangeCount);
  for(const fn of f.state.cross)fn({time:1005,point:{x:4,y:5}});
  assert.equal(hover.at(-1).t,5);assert.equal(hover.at(-1).hovering,true);
  chart.set({marks:[{t:400,side:'buy'}]});assert.equal(f.state.markers.at(-1).rows.at(-1).text,'B');
  chart.set({key:2,label:'DOG',candles:rows(3),solUsd:1,base:0});assert.equal(main.data[0].time,0);assert.equal(main.data[0].open,100);
  const converted=rows(3);chart.set({candles:converted,revision:2000});const beforeFx=main.sets;
  converted[0].h=250;chart.set({candles:converted,revision:2001});assert.equal(main.data[0].high,250,'a new quote conversion refreshes closed USD candles');
  assert.equal(main.sets,beforeFx+1);chart.set({candles:converted,revision:2001});assert.equal(main.sets,beforeFx+1,'identical conversion revisions keep incremental updates');
  chart.destroy();assert.equal(f.state.cross.size,0);assert.equal(f.state.removed,true);
});

test('Clank chart controls change real series, panes, visibility and reversible settings',()=>{
  const f=fakeLibrary(),chart=createClankChart(f.host,{lib:f.lib});chart.set({key:'live',candles:rows(60,1000),base:0,solUsd:1});
  byLabel(f.host,'Chart style').value='line';byLabel(f.host,'Chart style').fire('change');
  assert.equal(chart.state.style,'line');assert.ok(f.state.series.find(s=>s.type==='Line').data[0].value>0);
  chart.undo();assert.equal(chart.state.style,'candles');chart.redo();assert.equal(chart.state.style,'line');
  chart.indicators(['ma','ema','rsi','macd']);assert.equal(f.state.series.filter(s=>s.pane>0).length,4);
  chart.settings({grid:false,volume:false,log:true});assert.equal(f.state.options.at(-1).rightPriceScale.mode,1);
  assert.equal(f.state.series.find(s=>s.type==='Histogram'&&s.pane===0).options.visible,false);
  chart.set({tf:15});assert.equal(f.state.series.find(s=>s.type==='Line'&&s.pane===0).data.length,5);
  chart.view({mode:'price',supply:1e6});assert.ok(f.state.series.find(s=>s.type==='Line'&&s.pane===0).data.at(-1).value<.001);
  chart.zoom(1);chart.toNow();chart.fit();assert.equal(f.state.latest,2);assert.equal(f.state.fit,1);
  byLabel(f.host,'Fullscreen chart').click();assert.equal(f.host.classList.contains('is-expanded'),true);
  byLabel(f.host,'Fullscreen chart').click();assert.equal(f.host.classList.contains('is-expanded'),false);
  chart.destroy();
});

test('Clank live display uses confirmed zero-volume bars for practice markers without rebuilding identical polls',()=>{
  const f=fakeLibrary(),chart=createClankChart(f.host,{lib:f.lib});
  const candles=[{t:1200,o:10,h:12,l:9,c:11,v:5}];
  chart.set({key:'live',live:true,candles,tf:60,chartThrough:1450,base:0,solUsd:1,marks:[{t:1444,side:'buy'}]});
  const main=f.state.series.find(s=>s.type==='Candlestick'),vol=f.state.series.find(s=>s.type==='Histogram');
  assert.equal(main.data.at(-1).time,1440);assert.equal(vol.data.at(-1).value,0);assert.equal(f.state.markers.at(-1).rows[0].text,'B');
  const resets=main.sets;chart.set({candles:[...candles],chartThrough:1450});assert.equal(main.sets,resets,'identical network snapshots retain series data');
  chart.set({chartThrough:1500});assert.equal(main.data.at(-1).time,1500);assert.equal(main.sets,resets,'advancing the confirmed clock appends a quiet candle incrementally');
  chart.destroy();
});

test('Clank long-session benchmark visits one candle per changing 1s quote, zero per unchanged quote',(t)=>{
  const data=rows(7200),cache=createClankBuckets();cache.update(data);
  let visited=0;const start=performance.now();
  for(let i=0;i<1000;i++){data.at(-1).c+=.001;visited+=cache.update(data).visited;visited+=cache.update(data).visited;}
  const incrementalMs=performance.now()-start;
  const baseline=performance.now();for(let i=0;i<1000;i++)aggregate(data,1);
  const baselineMs=performance.now()-baseline;
  assert.equal(visited,1000);assert.ok(visited<7200*1000/1000);
  t.diagnostic(`7200 candles × 1000 updates: incremental ${incrementalMs.toFixed(2)}ms / full aggregation ${baselineMs.toFixed(2)}ms; 1000 vs 7,200,000 inspected candles.`);
});
