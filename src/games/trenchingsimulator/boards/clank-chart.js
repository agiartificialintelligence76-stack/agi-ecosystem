// Clank's visible chart layout (observed 2026-11-02), implemented with Apache-licensed Lightweight Charts.
// The original uses the separately licensed TradingView Charting Library; none of that library is copied here.
// Input OHLC is market-cap in the simulator's accounting coin; solUsd converts both candles and volume to USD.
// key identifies a token, base is fixed for that token, and revision/reset explicitly replaces corrected history.
import { el, setText } from '../ui.js';
import { compact, price } from '../format.js';
import { createClankBuckets, clankLowerBound, updateClankStudies, clankDisplayCandles } from './clank-chart-data.js';
import './clank-chart.css';

const C = Object.freeze({ bg:'#131313', grid:'#1c1c1c', line:'#252525', text:'#b2b5be', up:'#089981', down:'#f23645' });
const fin = Number.isFinite;
const glyph = (name) => {
  const paths = { candles:'M5 2v3m0 8v5M3 5h4v8H3zM13 1v7m0 7v4M11 8h4v7h-4z', indicator:'M3 16c6 0 4-13 9-13m-5 6h7m-1 6 5 5m0-5-5 5',
    undo:'M7 4 2 8l5 4M2 8h9a5 5 0 0 1 0 10', redo:'m13 4 5 4-5 4m5-4H9a5 5 0 0 0 0 10',
    settings:'m6 2-4 7 4 7h8l4-7-4-7zM13 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0', full:'M2 7V2h5m6 0h5v5M2 13v5h5m6 0h5v-5',
    minus:'M4 10h12', plus:'M4 10h12m-6-6v12', reset:'M4 5a7 7 0 1 1-1 9M4 1v5H0', now:'m5 3 7 7-7 7m11-14v14' };
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  const path=document.createElementNS('http://www.w3.org/2000/svg','path');
  svg.setAttribute('viewBox','0 0 20 20');svg.setAttribute('aria-hidden','true');path.setAttribute('d',paths[name]||paths.candles);svg.append(path);return svg;
};
export const clankClock = (t, seconds = false) => new Date(t * 1000).toLocaleTimeString('en-GB', { timeZone:'UTC',hour:'2-digit',minute:'2-digit',...(seconds ? {second:'2-digit'} : {}),hour12:false });
const clone = (x) => ({ ...x, studies:[...x.studies] });

export function createClankChart(host, { tf = 1, onHover = null, lib = null } = {}) {
  let data = { candles:[], marks:[], tf, solUsd:150, base:null, key:null, label:'' }, view = { mode:'mcap', unit:'usd', supply:1e9, per:1 };
  let config = { style:'candles', studies:[], grid:true, volume:true, crosshair:true, log:false };
  let chart = null, L = null, main = null, volume = null, markers = null, loading = false, dead = false, fitted = false, failedAt = -Infinity;
  let cache = createClankBuckets(), bars = [], studies = [], series = new Map(), sent = false, force = false, base = null;
  let hoverTime = null, hoverKey = '', markKey = '', markerTf = null, revision = null, undoStack = [], redoStack = [];
  let displaySource = null, displayKey = '', displayBars = [];
  const stats = { builds:0, resets:0, tailUpdates:0, skipped:0, visited:0 };
  const button = (name, fn, label = null) => el('button', { type:'button', title:name, 'aria-label':name, on:{click:fn} }, label || name);
  const styleSelect = el('select', { 'aria-label':'Chart style', on:{change:() => change({style:styleSelect.value})} },
    ['candles','bars','line','area'].map((id) => el('option', {value:id}, id[0].toUpperCase() + id.slice(1))));
  styleSelect.value = 'candles';
  const indicatorChecks = new Map(), settingChecks = new Map();
  const indicatorMenu = el('details', {class:'clc-menu'}, el('summary', {}, glyph('indicator'), 'Indicators'), el('div',{class:'clc-popover'},
    [['ma','Moving Average · 20'],['ema','Exponential MA · 9'],['rsi','RSI · 14'],['macd','MACD · 12, 26, 9']].map(([id,label]) => {
      const input = el('input', {type:'checkbox', 'aria-label':label, on:{change:() => change({studies:[...indicatorChecks].filter(([,x]) => x.checked).map(([name]) => name)})}});
      indicatorChecks.set(id,input); return el('label',{},input,label);
    })));
  const undoButton = button('Undo chart change',undo,glyph('undo')), redoButton = button('Redo chart change',redo,glyph('redo'));
  const settingsMenu = el('details', {class:'clc-menu is-settings'}, el('summary', {'aria-label':'Chart settings',title:'Chart settings'},glyph('settings')),
    el('div',{class:'clc-popover'}, [['grid','Grid lines'],['volume','Volume'],['crosshair','Crosshair'],['log','Logarithmic scale']].map(([id,label]) => {
      const input = el('input', {type:'checkbox',checked:config[id], 'aria-label':label,on:{change:() => change({[id]:input.checked})}});
      settingChecks.set(id,input); return el('label',{},input,label);
    })));
  const fullButton = button('Fullscreen chart',toggleFullscreen,glyph('full'));
  const toolbar = el('div',{class:'clc-toolbar'},el('label',{class:'clc-style',title:'Chart style'},glyph('candles'),styleSelect),
    el('span',{class:'clc-separator'}),indicatorMenu,el('span',{class:'clc-separator'}),undoButton,redoButton,
    el('span',{class:'clc-spacer'}),settingsMenu,fullButton);
  const surface = el('div',{class:'clc-surface'}), title = el('span',{class:'clc-legend-title'}), ohlc = el('span',{class:'clc-ohlc'});
  const volumeValue = el('span',{class:'clc-volume-value'}), volumeLegend = el('span',{class:'clc-volume'},'Volume ',volumeValue);
  const legend = el('div',{class:'clc-legend','aria-live':'off'},title,ohlc,volumeLegend);
  const wait = el('p',{class:'clc-wait',role:'status'},'Waiting for the first trade…');
  const navigation = el('div',{class:'clc-hover'},button('Zoom out',()=>zoom(-1),glyph('minus')),button('Zoom in',()=>zoom(1),glyph('plus')),
    button('Fit chart',fit,glyph('reset')),button('Go to latest candle',toNow,glyph('now')));
  const credit = el('a',{class:'clc-credit',href:'https://www.tradingview.com/',target:'_blank',rel:'noopener noreferrer',
    title:'TradingView Lightweight Charts™ · Copyright (c) 2025 TradingView, Inc.'},'TradingView Lightweight Charts™');
  const plot = el('div',{class:'clc-plot'},surface,legend,wait,navigation,credit);
  host.classList.add('clc'); host.append(toolbar,plot);

  const multiplier = () => (view.unit === 'usd' ? data.solUsd > 0 ? data.solUsd : 1 : view.per) / (view.mode === 'price' ? view.supply : 1);
  const axisFormat = (n) => view.mode === 'price' ? price(n,4) : compact(n,2);
  const priceFormat = () => ({type:'custom',formatter:axisFormat,minMove:view.mode === 'price' ? 1e-13 : .01});
  const time = (t) => Math.round((base || 0) / 1000) + t;
  const candle = (b) => ({time:time(b.t),open:b.o*multiplier(),high:b.h*multiplier(),low:b.l*multiplier(),close:b.c*multiplier()});
  const point = (b) => config.style === 'line' || config.style === 'area' ? {time:time(b.t),value:b.c*multiplier()} : candle(b);
  const volPoint = (b) => ({time:time(b.t),value:b.v*(view.unit === 'usd' ? data.solUsd : view.per),color:b.c>=b.o ? '#08998155' : '#f2364555'});
  const studyPoint = (id,b,i) => {
    const v = studies[i]?.[id], p = {time:time(b.t)};
    if (!fin(v)) return p;
    p.value = id === 'rsi' ? v : v*multiplier();
    if (id === 'hist') p.color = v >= 0 ? '#08998188' : '#f2364588';
    return p;
  };

  function build(library) {
    if (dead || chart) return;
    L = library; stats.builds++;
    chart = L.createChart(surface, {
      autoSize:true,layout:{background:{type:L.ColorType.Solid,color:C.bg},textColor:C.text,fontFamily:'Clank Suisse, Arial, sans-serif',fontSize:11,attributionLogo:false,
        panes:{separatorColor:C.line,separatorHoverColor:'#373737'}},
      grid:{vertLines:{color:C.grid},horzLines:{color:C.grid}},
      crosshair:{mode:L.CrosshairMode.Normal,vertLine:{color:'#60636b',style:2,labelBackgroundColor:'#363a45'},horzLine:{color:'#60636b',style:2,labelBackgroundColor:'#363a45'}},
      rightPriceScale:{borderVisible:false,scaleMargins:{top:.12,bottom:.15}},
      timeScale:{borderVisible:false,minimumHeight:34,timeVisible:true,secondsVisible:data.tf<60,rightOffset:16,barSpacing:7,minBarSpacing:.8,shiftVisibleRangeOnNewBar:true,
        tickMarkFormatter:(t,type) => type===L.TickMarkType.TimeWithSeconds ? clankClock(t,true) : type===L.TickMarkType.Time ? clankClock(t)
          : new Date(t*1000).toLocaleDateString('en-US',{timeZone:'UTC',...(type===0?{year:'numeric'}:type===1?{month:'short'}:{day:'numeric'})})},
      localization:{timeFormatter:(t)=>`${new Date(t*1000).toLocaleString('en-GB',{timeZone:'UTC',hour12:false})} UTC`},
      handleScroll:{mouseWheel:true,pressedMouseMove:true,horzTouchDrag:true,vertTouchDrag:false},handleScale:{mouseWheel:true,pinch:true,axisPressedMouseMove:{time:true,price:true},axisDoubleClickReset:true},kineticScroll:{touch:true,mouse:false},
    });
    createMain();
    volume = chart.addSeries(L.HistogramSeries,{priceScaleId:'',priceFormat:{type:'volume'},priceLineVisible:false,lastValueVisible:false});
    volume.priceScale().applyOptions({scaleMargins:{top:.8,bottom:0}});
    chart.subscribeCrosshairMove(onCross);
    applyConfig(); force = true; sync();
  }
  function createMain() {
    const types={candles:L.CandlestickSeries,bars:L.BarSeries,line:L.LineSeries,area:L.AreaSeries};
    main=chart.addSeries(types[config.style],{upColor:C.up,downColor:C.down,wickUpColor:C.up,wickDownColor:C.down,borderUpColor:C.up,borderDownColor:C.down,borderVisible:false,
      color:C.up,lineColor:C.up,topColor:'#08998144',bottomColor:'#08998100',lineWidth:2,priceFormat:priceFormat(),priceLineVisible:true,priceLineStyle:2,lastValueVisible:true,
      lastPriceAnimation:L.LastPriceAnimationMode.Disabled});
    markers=L.createSeriesMarkers(main,[]); markKey='';
  }
  function ensure() {
    if (chart || loading || dead || Date.now()-failedAt<15000) return;
    loading=true;
    import('lightweight-charts').then((m)=>{loading=false;build(m);},()=>{loading=false;failedAt=Date.now();if(!dead) setText(wait,'Reconnecting to the chart…');});
  }
  function applyConfig() {
    styleSelect.value=config.style;
    for(const[id,input]of indicatorChecks) input.checked=config.studies.includes(id);
    for(const[id,input]of settingChecks) input.checked=config[id];
    undoButton.disabled=!undoStack.length;redoButton.disabled=!redoStack.length;
    volumeLegend.hidden=!config.volume;
    if(!chart) return;
    chart.applyOptions({grid:{vertLines:{visible:config.grid},horzLines:{visible:config.grid}},crosshair:{vertLine:{visible:config.crosshair},horzLine:{visible:config.crosshair}},
      rightPriceScale:{mode:config.log ? L.PriceScaleMode.Logarithmic : L.PriceScaleMode.Normal}});
    volume?.applyOptions({visible:config.volume});
    const wanted=new Set(config.studies.flatMap((id)=>id==='macd'?['macd','signal','hist']:[id]));
    for(const[id,s]of series) if(!wanted.has(id)) {chart.removeSeries(s);series.delete(id);}
    let pane=1;
    const paneOf={rsi:config.studies.includes('rsi')?pane++:0,macd:config.studies.includes('macd')?pane++:0};
    for(const id of wanted) if(!series.has(id)) {
      const color={ma:'#2962ff',ema:'#ffb74d',rsi:'#b48ae5',macd:'#2962ff',signal:'#ff9800'}[id];
      const index=id==='rsi'?paneOf.rsi:['macd','signal','hist'].includes(id)?paneOf.macd:0;
      series.set(id,chart.addSeries(id==='hist'?L.HistogramSeries:L.LineSeries,{color,lineWidth:1,priceLineVisible:false,lastValueVisible:false,
        priceFormat:id==='rsi'?{type:'price',precision:2,minMove:.01}:priceFormat()},index));
    }
  }
  function change(patch,remember=true) {
    const next={...config,...patch};
    if(JSON.stringify(next)===JSON.stringify(config)) return;
    if(remember) {undoStack.push(clone(config));if(undoStack.length>30)undoStack.shift();redoStack=[];}
    const previous=config;config=next;
    if(chart && previous.style!==config.style){markers?.detach?.();chart.removeSeries(main);createMain();}
    // Rebuild study panes when their layout changes so RSI and MACD cannot share an accidental axis.
    if(chart && previous.studies.join()!==config.studies.join()){for(const s of series.values())chart.removeSeries(s);series.clear();}
    applyConfig();force=true;sync();
  }
  function undo(){if(!undoStack.length)return;redoStack.push(clone(config));change(undoStack.pop(),false);}
  function redo(){if(!redoStack.length)return;undoStack.push(clone(config));change(redoStack.pop(),false);}
  function sync() {
    if(dead)return;
    let source=Array.isArray(data.candles)?data.candles:[];
    if(data.live){
      const last=source.at(-1);
      const key=`${data.key}|${data.tf}|${data.revision}|${Math.floor(data.chartThrough/data.tf)}|${source.length}|${last?.t}|${last?.o}|${last?.h}|${last?.l}|${last?.c}|${last?.v}`;
      if(displaySource!==source||displayKey!==key){
        const next=clankDisplayCandles(source,data.tf,data.chartThrough);
        const same=(a,b)=>a&&b&&a.t===b.t&&a.o===b.o&&a.h===b.h&&a.l===b.l&&a.c===b.c&&a.v===b.v;
        // A sampled gap can shift when the indexer advances. Refresh only if an already closed
        // displayed bar changed; ordinary append/current-candle updates keep the incremental path.
        if(next.length<displayBars.length||displayBars.slice(0,-1).some((bar,i)=>!same(bar,next[i])))force=true;
        if(next.length!==displayBars.length||next.some((bar,i)=>!same(bar,displayBars[i])))displayBars=next;
        displaySource=source;displayKey=key;
      }
      source=displayBars;
    }
    const update=cache.update(source,data.tf,force);
    bars=update.bars;stats.visited+=update.visited;
    if(update.full)studies=[];
    if(update.from<bars.length)updateClankStudies(bars,studies,update.from);
    if(!chart){wait.hidden=false;if(!loading&&Date.now()-failedAt>=15000)setText(wait,data.live?'Loading live chart…':'Waiting for the first trade…');return;}
    const full=force||!sent||update.full;
    if(full){
      main.setData(bars.map(point));volume.setData(bars.map(volPoint));
      for(const[id,s]of series)s.setData(bars.map((b,i)=>studyPoint(id,b,i)));
      stats.resets++;sent=true;
    } else if(update.from<bars.length){
      for(let i=update.from;i<bars.length;i++){main.update(point(bars[i]));volume.update(volPoint(bars[i]));for(const[id,s]of series)s.update(studyPoint(id,bars[i],i));stats.tailUpdates++;}
    } else stats.skipped++;
    force=false;wait.hidden=bars.length>0;if(!bars.length)setText(wait,data.live?'Loading live chart…':'Waiting for the first trade…');
    syncMarkers();emit();
    if(bars.length&&!fitted){chart.timeScale().scrollToRealTime();fitted=true;}
  }
  function syncMarkers(){
    const key=`${data.tf}|${base}|${JSON.stringify(data.marks)}|${data.migratedAt}|${data.practiceAt}|${data.sourceHistory}|${bars[0]?.t}|${bars.at(-1)?.t}`;
    if(key===markKey)return;markKey=key;
    const list=[];
    for(const m of data.marks||[]){
      if(!fin(m.t))continue;
      const t=Math.floor(m.t/data.tf)*data.tf,i=clankLowerBound(bars,t);
      if(bars[i]?.t!==t)continue;
      const buy=m.side==='buy';list.push({time:time(t),position:buy?'belowBar':'aboveBar',shape:buy?'arrowUp':'arrowDown',color:buy?C.up:C.down,text:buy?'B':'S'});
    }
    if(fin(data.migratedAt)){const t=Math.floor(data.migratedAt/data.tf)*data.tf;if(bars[clankLowerBound(bars,t)]?.t===t)list.push({time:time(t),position:'aboveBar',shape:'circle',color:'#c6b5ff',text:'Migrated'});}
    if(data.practice&&data.sourceHistory&&fin(data.practiceAt)){const t=Math.floor(data.practiceAt/data.tf)*data.tf;if(bars[clankLowerBound(bars,t)]?.t===t)list.push({time:time(t),position:'aboveBar',shape:'circle',color:'#c6b5ff',text:'Practice begins'});}
    list.sort((a,b)=>a.time-b.time);markers.setMarkers(list);
  }
  function onCross(p){hoverTime=p?.point&&fin(Number(p.time))?Number(p.time)-Math.round((base||0)/1000):null;emit();}
  function emit(){
    const index=hoverTime===null?-1:clankLowerBound(bars,hoverTime),b=bars[index]?.t===hoverTime?bars[index]:bars.at(-1);
    const historical=data.practice&&b&&b.t<Math.floor(data.practiceAt/data.tf)*data.tf;
    setText(title,`${data.label||'Coin'} · ${view.mode==='price'?'Price':'Market cap'} · ${data.practice?(historical?'Clank history':'Simulated market'):'Clank'}`);
    if(!b){setText(ohlc,'');setText(volumeValue,'0');if(hoverKey!=='empty'){onHover?.(null);hoverKey='empty';}return;}
    const v=candle(b),key=`${v.time}|${v.open}|${v.high}|${v.low}|${v.close}|${b.v}|${hoverTime}`;
    if(key===hoverKey)return;hoverKey=key;
    setText(ohlc,`O${axisFormat(v.open)} H${axisFormat(v.high)} L${axisFormat(v.low)} C${axisFormat(v.close)}`);
    ohlc.style.setProperty('color',b.c>=b.o?C.up:C.down);setText(volumeValue,compact(volPoint(b).value,2));
    onHover?.({t:b.t,o:v.open,h:v.high,l:v.low,c:v.close,vol:volPoint(b).value,hovering:bars[index]?.t===hoverTime});
  }
  function fit(){chart?.timeScale().fitContent();}
  function toNow(){chart?.timeScale().scrollToRealTime();}
  function zoom(direction){if(!chart)return;const scale=chart.timeScale(),spacing=scale.options().barSpacing;scale.applyOptions({barSpacing:Math.max(.8,Math.min(50,spacing*(direction>0?1.3:1/1.3)))});}
  function toggleFullscreen(){
    const doc=host.ownerDocument;
    if(doc?.fullscreenElement===host){doc.exitFullscreen?.();return;}
    if(host.classList.contains('is-expanded')){host.classList.remove('is-expanded');return;}
    if(host.requestFullscreen)host.requestFullscreen().catch(()=>host.classList.add('is-expanded'));
    else host.classList.add('is-expanded');
  }
  const onKey=(e)=>{if(e.key==='Escape'){host.classList.remove('is-expanded');indicatorMenu.open=false;settingsMenu.open=false;}};
  host.ownerDocument?.addEventListener?.('keydown',onKey);
  applyConfig();if(lib)build(lib);
  return {
    set(next={}){
      if(dead)return;
      const keyChanged='key'in next&&next.key!==data.key;
      const historyChanged='revision'in next&&next.revision!==revision;
      if(keyChanged||next.reset){cache=createClankBuckets();bars=[];studies=[];displaySource=null;displayBars=[];displayKey='';sent=false;fitted=false;base=fin(next.base)?next.base:null;hoverTime=null;markKey='';}
      if(base===null&&fin(next.base))base=next.base;
      if(next.solUsd>0&&next.solUsd!==data.solUsd)force=true;
      if(historyChanged||next.reset)force=true;
      if('revision'in next)revision=next.revision;
      data={...data,...next};data.tf=data.tf>0?data.tf:1;
      if(chart&&markerTf!==data.tf){chart.timeScale().applyOptions({secondsVisible:data.tf<60});markerTf=data.tf;}
      if(!chart&&data.candles?.length)ensure();sync();
    },
    view(next={}){
      const value={mode:['mcap','price'].includes(next.mode)?next.mode:view.mode,unit:['usd','coin'].includes(next.unit)?next.unit:view.unit,
        supply:next.supply>0?next.supply:view.supply,per:next.per>0?next.per:view.per};
      if(Object.keys(value).every((key)=>value[key]===view[key]))return;
      view=value;main?.applyOptions({priceFormat:priceFormat()});force=true;sync();
    },
    style:(style)=>{if(['candles','bars','line','area'].includes(style))change({style});},
    indicators:(list)=>change({studies:[...new Set(list)].filter((id)=>['ma','ema','rsi','macd'].includes(id))}),
    settings:(patch)=>change(Object.fromEntries(Object.entries(patch).filter(([k,v])=>['grid','volume','crosshair','log'].includes(k)&&typeof v==='boolean'))),
    fit,zoom,toNow,undo,redo,
    get state(){return {ready:!!chart,...clone(config),bars:bars.length,stats:{...stats},canUndo:!!undoStack.length,canRedo:!!redoStack.length};},
    destroy(){dead=true;host.ownerDocument?.removeEventListener?.('keydown',onKey);chart?.unsubscribeCrosshairMove(onCross);markers?.detach?.();chart?.remove();
      if(host.ownerDocument?.fullscreenElement===host)host.ownerDocument.exitFullscreen?.();host.classList.remove('is-expanded');toolbar.remove();plot.remove();},
  };
}
