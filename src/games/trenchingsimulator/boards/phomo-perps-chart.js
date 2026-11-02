import { el, setText } from '../ui.js';
import { compact, pct, usdFull } from '../format.js';
import { SUPPLY } from '../curve.js';
import { INDICATORS } from './gngm-data.js';
import { createPhomoChart } from './phomo-chart.js';
import { chartCredit } from './gchart.js';

export const PERPS_CHART_INTERVALS = Object.freeze({ '1m':60, '5m':300, '15m':900, '1h':3600, '4h':14400, '1d':86400 });
export function perpsChartCandles(rows) {
  return (rows || []).map(row => ({t:row.t/1000,o:row.o*SUPPLY,h:row.h*SUPPLY,l:row.l*SUPPLY,c:row.c*SUPPLY,v:row.v || 0}));
}
const paths = { cursor:'M5 3l14 10-7 1-3 7z',trend:'M3 20L21 4',horizontal:'M3 12h18',vertical:'M12 3v18',ray:'M3 19L20 4M15 4h5v5',
  rectangle:'M4 5h16v14H4z',text:'M4 5h16M12 5v15M8 20h8',measure:'M4 17L17 4l4 4L8 21zM9 12l3 3M13 8l3 3',
  undo:'M9 5L4 10l5 5M4 10h9a6 6 0 0 1 6 6',redo:'M15 5l5 5-5 5M20 10h-9a6 6 0 0 0-6 6',
  fullscreen:'M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6',camera:'M3 7h5l2-3h4l2 3h5v13H3zM16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  settings:'M4 7h16M8 4v6M4 17h16M16 14v6',eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z',trash:'M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15',lock:'M6 10h12v11H6zM8 10V6a4 4 0 0 1 8 0v4' };
const icon = name => { const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('class','tspc-tool-icon');svg.setAttribute('aria-hidden','true');
  const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',paths[name]);svg.append(path);return svg; };
const button = (text, label, action, cls='tspc-button') => el('button',{type:'button',class:cls,'aria-label':label,title:label,on:{click:action}},text);

export function createPerpsChart({ ledger, onInterval = () => {}, createChart = createPhomoChart } = {}) {
  let chart, dead=false, active=true, coin='', interval='1m', candles=[], ledgerRevision=-1, resolveText=null;
  const selection={trades:true,limits:true,protection:true}, indicators=[];
  const hint=el('p',{class:'tspc-drawing-hint',role:'status'}),legend=el('div',{class:'tspc-legend'});
  const plot=el('div',{class:'tspc-plot php-chart',role:'img',tabIndex:0,'aria-label':'Observed perpetual price chart'});
  const style=el('select',{class:'tspc-chart-select','aria-label':'Perpetual chart style',on:{change:()=>chart.style(style.value)}},
    ['candles','bars','line','area'].map(value=>el('option',{value},value[0].toUpperCase()+value.slice(1))));style.value='candles';
  const intervals=Object.keys(PERPS_CHART_INTERVALS).map(value=>button(value,`${value} perpetual candles`,()=>{interval=value;paintInterval();onInterval(value);},'php-interval'));
  const action=(name,label,fn)=>button(icon(name),label,fn,'tspc-icon-button');
  const undo=action('undo','Undo drawing',()=>chart.undo()),redo=action('redo','Redo drawing',()=>chart.redo());
  const drawingButtons=Object.entries({cursor:'Select or move drawing',trend:'Trend line',horizontal:'Horizontal line',vertical:'Vertical line',ray:'Ray',rectangle:'Rectangle',text:'Text annotation',measure:'Measure'}).map(([tool,label])=>{
    const b=action(tool,label,()=>{chart.drawTool(tool);setText(hint,tool==='cursor'?'':tool==='text'?'Click the chart to add text.':['horizontal','vertical'].includes(tool)?'Click to place a line.':'Click two points on the chart.');});b.dataset.tool=tool;return b;
  });
  const drawingRail=el('div',{class:'tspc-drawing-rail',role:'toolbar','aria-label':'Perpetual drawing tools',hidden:true},drawingButtons,
    action('lock','Lock or unlock selected drawing',()=>chart.lockSelected()),action('eye','Show or hide drawings',()=>chart.showDrawings(!chart.state.visible)),
    action('trash','Delete selected drawing',()=>chart.removeSelected()),button('Clear','Remove unlocked drawings',()=>chart.clearDrawings(),'tspc-drawing-clear'));
  const drawToggle=action('trend','Toggle drawing tools',()=>{drawingRail.hidden=!drawingRail.hidden;drawToggle.setAttribute('aria-pressed',String(!drawingRail.hidden));});
  const indicatorButtons=INDICATORS.map(([key,label])=>{const b=button(label,`${label} indicator`,()=>{const index=indicators.indexOf(key);if(index<0)indicators.push(key);else indicators.splice(index,1);chart.indicators(indicators);indicatorButtons.forEach(n=>n.setAttribute('aria-pressed',String(indicators.includes(n.dataset.indicator))));});b.dataset.indicator=key;return b;});
  const indicatorMenu=el('details',{class:'tspc-indicators'},el('summary',{},el('i',{},'ƒx'),' Indicators'),el('div',{class:'tspc-indicator-menu'},indicatorButtons));
  const settings=el('dialog',{class:'tspc-settings','aria-label':'Perpetual chart settings'},el('div',{class:'tspc-settings-heading'},el('h2',{},'Chart settings'),button('×','Close chart settings',()=>settings.close())),
    [['grid','Grid lines'],['volume','Volume bars'],['crosshair','Crosshair and axis labels']].map(([key,label])=>el('label',{class:'tspc-chart-option'},el('input',{type:'checkbox',checked:true,'aria-label':label,on:{change(event){chart.settings({[key]:event.target.checked});}}}),label)));
  const textInput=el('input',{type:'text',maxLength:120,'aria-label':'Chart annotation text'});
  const textDialog=el('dialog',{class:'tspc-settings','aria-label':'Add chart text'},el('h2',{},'Add chart text'),textInput,
    button('Add','Add annotation',()=>{resolveText?.(textInput.value);resolveText=null;textDialog.close();}),button('Cancel','Cancel annotation',()=>textDialog.close()));
  textDialog.addEventListener('close',()=>{resolveText?.('');resolveText=null;});
  const percent=button('%','Percentage price scale',()=>chart.scale(chart.state.scale==='percent'?'normal':'percent'));
  const log=button('log','Logarithmic price scale',()=>chart.scale(chart.state.scale==='log'?'normal':'log'));
  const auto=button('auto','Automatic price scale',()=>chart.auto(!chart.state.auto));
  const chartClock=el('span',{class:'tspc-chart-clock'});
  const overlays=el('div',{class:'tspc-overlays'},el('span',{class:'tspc-muted'},'Chart overlays'),
    [['trades','My paper trades'],['limits','Limit orders'],['protection','TP/SL']].map(([key,label])=>el('label',{class:'tspc-check'},el('input',{type:'checkbox',checked:true,'aria-label':label,on:{change(event){selection[key]=event.target.checked;ledgerRevision=-1;update();}}}),label)));
  const root=el('section',{class:'php-rich-chart tspc-coin tspc-chart-card','aria-label':'Perpetual price chart'},
    el('div',{class:'tspc-chart-tools'},el('div',{class:'php-rich-intervals'},intervals),style,indicatorMenu,undo,redo,el('span',{class:'tspc-tool-spacer'}),drawToggle,
      action('settings','Perpetual chart settings',()=>settings.showModal()),action('fullscreen','Fullscreen chart',()=>fullscreen()),action('camera','Download chart image',()=>download())),
    el('div',{class:'tspc-chart-body'},drawingRail,el('div',{class:'tspc-chart-canvas'},legend,plot)),
    el('div',{class:'tspc-chart-bottom'},el('div',{class:'tspc-chart-ranges'},[['1D',86400],['1W',604800],['1M',2592000],['3M',7776000],['1Y',31536000]].map(([label,seconds])=>button(label,`${label} retained chart range`,()=>{chart.range(seconds);setText(hint,'Range is limited to observed candles retained by the public feed.');}))),chartClock,percent,log,auto,button('↻','Reset chart view',()=>chart.fit())),
    overlays,hint,el('details',{class:'tspc-chart-disclosure'},el('summary',{},'Chart data & attribution'),el('p',{class:'tspc-chart-note'},'Observed public USD prices. Volume is in the market’s base asset. Paper fills are separate from public candles; missing data remains blank.'),chartCredit()),settings,textDialog);
  function paintInterval(){intervals.forEach(b=>b.setAttribute('aria-pressed',String(b.textContent===interval)));}
  function build(){chart=createChart(plot,{mode:'price',unit:'usd',tf:PERPS_CHART_INTERVALS[interval],
    colors:{bg:'#060510',border:'#1a1925',axis:'#9899a3',strong:'#f7f7f7',up:'#21c95e',down:'#ff622e',label:'#12111a',ma:'#69b8ff',ema:'#c9a6ff'},
    onHover:b=>setText(legend,b?`${coin} · ${interval}  O ${b.fmt(b.o)} H ${b.fmt(b.h)} L ${b.fmt(b.l)} C ${b.fmt(b.c)} ${pct(b.ch)} · Vol ${compact(b.vol)} ${coin.split(':').at(-1)}`:''),
    requestText:()=>new Promise(resolve=>{resolveText=resolve;textInput.value='';textDialog.showModal();textInput.focus();}),
    onChange:state=>{undo.disabled=!state.canUndo;redo.disabled=!state.canRedo;drawingButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===state.tool)));percent.setAttribute('aria-pressed',String(state.scale==='percent'));log.setAttribute('aria-pressed',String(state.scale==='log'));auto.setAttribute('aria-pressed',String(state.auto));}});
    chart.style(style.value);chart.indicators(indicators);
  }
  function update(force=false){if(dead||!active)return;const snapshot=ledger?.snapshot();if(!force&&snapshot?.revision===ledgerRevision)return;ledgerRevision=snapshot?.revision;
    const marks=selection.trades?(snapshot?.fills || []).filter(f=>f.coin===coin).map(f=>({t:f.at/1000,side:(f.type==='open')===(f.side==='long')?'buy':'sell'})):[];
    chart.set({candles,tf:PERPS_CHART_INTERVALS[interval],solUsd:1,base:0,marks});
    const levels=[];
    if(selection.limits)for(const order of snapshot?.pending || [])if(order.coin===coin&&order.kind==='limit')levels.push({value:order.limitPrice*SUPPLY,title:`Paper limit #${order.id}`,color:'#818cf8'});
    if(selection.protection)for(const p of snapshot?.positions || [])if(p.coin===coin){if(p.tp)levels.push({value:p.tp*SUPPLY,title:`TP #${p.id}`,color:'#21c95e'});if(p.sl)levels.push({value:p.sl*SUPPLY,title:`SL #${p.id}`,color:'#ff622e'});}
    chart.levels?.(levels);
  }
  async function fullscreen(){try{if(document.fullscreenElement===root)await document.exitFullscreen();else if(root.requestFullscreen)await root.requestFullscreen();else root.classList.toggle('is-expanded');}catch{root.classList.toggle('is-expanded');}chart.redraw();}
  function download(){const canvas=chart.screenshot();if(!canvas?.toBlob){setText(hint,'The chart is still loading.');return;}canvas.toBlob(blob=>{if(!blob||dead)return;const url=URL.createObjectURL(blob),a=el('a',{href:url,download:'phomo-paper-perpetual-chart.png'});a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},'image/png');}
  build();paintInterval();const off=ledger?.on(()=>update());
  return {el:root,plot,
    set(rows,meta={}){if(dead)return;const nextCoin=meta.coin??coin;if(coin&&nextCoin!==coin){chart.destroy();plot.replaceChildren();coin=nextCoin;build();}else coin=nextCoin;
      interval=PERPS_CHART_INTERVALS[meta.interval]?meta.interval:interval;paintInterval();
      const next=perpsChartCandles(rows);let from=0;while(from<Math.min(candles.length,next.length)&&['t','o','h','l','c','v'].every(k=>candles[from][k]===next[from][k]))from++;
      if (from < candles.length - 1 || next.length < candles.length) candles = next;
      else candles.splice(from,candles.length-from,...next.slice(from));update(true);
      const last=rows?.at(-1);setText(chartClock,last?`${new Date(last.t).toISOString().slice(11,16)} UTC`:'');
      setText(legend,last?`${coin} · ${interval}  O ${usdFull(last.o)} H ${usdFull(last.h)} L ${usdFull(last.l)} C ${usdFull(last.c)} · Vol ${compact(last.v)} ${coin.split(':').at(-1)}`:'');
    },
    draw:()=>{if(active)chart.redraw();},update,setActive(value){active=Boolean(value);if(active)update(true);},style:value=>chart.style(value),zoomIn:()=>chart.zoom(1),zoomOut:()=>chart.zoom(-1),reset:()=>chart.toNow(),
    destroy(){if(dead)return;dead=true;off?.();resolveText?.('');resolveText=null;chart.destroy();root.remove();}
  };
}
