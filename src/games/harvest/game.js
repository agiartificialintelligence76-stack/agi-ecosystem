import {createShell,el} from '../kit/shell.js';
import {fitCanvas} from '../kit/canvas.js';
import {createLoop} from '../kit/loop.js';
import {DEMO,SEED,QUERY,REDUCED} from '../kit/env.js';
import {createFarm,restoreFarm,CROPS,WEATHER,UPGRADES,DAY_SECONDS,crop,plant,water,waterAll,harvest,ready,sellProduce,trade,deliver,upgrade,tick,endDay,starterHelp,demoStep,sharePrice,wealth,stored,capacity} from './engine.js';
import {drawFarm,drawChart,layout} from './art.js';
import './style.css';

const root=document.getElementById('ak-root');
const shell=createShell({game: 'harvest',name:'HARVEST EXCHANGE',root,
 howTo:{intro:'A farming sim with a fictional crop-share exchange. All credits and market movements belong only to this game.',steps:[['Tend your farm','Choose a seed, then tap an empty plot to plant. Tap a dry crop to water it; tap a READY crop to harvest. Water all saves time.'],['Work the market','Sell your harvested stock or hold it for a better price. Crop shares are separate: you can trade them and collect small daily dividends.'],['Read the village','Market news changes demand. Delivery orders pay a fixed reward and unlock better seeds. A full stockroom needs a sale or delivery.'],['Build your future','Use game credits for more plots, sprinklers, faster growing or storage. Next day advances the farm and refreshes your energy. Progress saves automatically.']],touch:[['Tap a plot','Plant, water or harvest'],['Bottom buttons','Market, orders, upgrades, next day']],keys:[['1–6','Choose a seed'],['Arrow keys + Enter','Select and tend a plot'],['W / M / O / U / N','Water all / market / orders / upgrades / next day']]},
 onPause:()=>save(),onQuit:()=>{save();panelKind=null;title();},onRestart:()=>start(false),onResume:()=>refresh()});
const creditChip=shell.chip('CR',180),dayChip=shell.chip('Day',1),energyChip=shell.chip('Energy',18);
const canvas=el('canvas',{class:'hf-canvas','aria-label':'Farm with twelve crop plots'});shell.stage.append(canvas);
const view=fitCanvas(canvas,{maxDpr:2});
const plots=el('div',{class:'hf-plots','aria-label':'Crop plots'});shell.stage.append(plots);
const buttons=Array.from({length:12},(_,i)=>{const b=el('button',{class:'hf-plot',type:'button','data-hf-plot':i});b.addEventListener('click',()=>tend(i));plots.append(b);return b;});
const ui=el('div','hf-ui');shell.stage.append(ui);
const news=el('div','hf-news');
const seedBar=el('div',{class:'hf-seeds','aria-label':'Choose a seed'});
const seedButtons=CROPS.map((c,i)=>{const dot=el('i',null,String(i+1));dot.style.background=c.color;const b=el('button',{type:'button',class:'hf-seed','data-hf-seed':c.id},dot,el('span',null,c.name),el('small',null,`${c.seed} CR · ${c.days}d`));b.addEventListener('click',()=>{selectedCrop=c.id;refresh();});seedBar.append(b);return b;});
const action=(label,cls,fn)=>{const b=el('button',{type:'button',class:cls},label);b.addEventListener('click',()=>{shell.audio.unlock();fn();});return b;};
const waterButton=action('Water all','hf-water',()=>{const n=waterAll(state);feedback(n?`${n} plots watered`:'No dry crops, or no energy',n>0);refresh();});
const dock=el('div','hf-dock',seedBar,el('div','hf-actions',waterButton,action('Market','hf-market',()=>showPanel('market')),action('Orders','',()=>showPanel('orders')),action('Build','',()=>showPanel('build')),action('Next day','',()=>{endDay(state);starterHelp(state);feedback(`Day ${state.day}: ${WEATHER[state.weather].name}`,true);refresh();save();})),el('p','hf-help','Choose a seed. Tap a plot to plant, water or harvest.'));
const pane=el('section',{class:'hf-pane',hidden:true,'aria-label':'Farm exchange panel'});ui.append(news,dock,pane);
const face=new Image();face.src='/images/agi1-portrait-2d.webp';
let state=createFarm(SEED||7),hasStarted=false,selectedCrop='sunberry',selected=0,panelKind=null,marketCrop='sunberry',elapsed=0,saveTime=0,demoTime=0,refreshTime=0,particles=[],lastLayout='',lastDay=1;
ui.hidden=true;plots.hidden=true;
function save(){if(DEMO||!hasStarted)return;const d=shell.store.read();d.farm=state;d.best=Math.max(d.best||0,Math.floor(wealth(state)));shell.store.write(d);}
function feedback(text,good=true){if(DEMO)return;shell.toast(text,good?'good':'warn');shell.audio.sfx(good?'pop':'error');if(good)shell.haptic(10);}
function start(fresh=false){const saved=!fresh&&!DEMO?restoreFarm(shell.store.read().farm):null;state=saved||createFarm(SEED||Math.floor(Date.now()/1000));if(DEMO){state=createFarm(7);state.cash=430;state.rep=3;for(let i=3;i<6;i++){plant(state,i,CROPS[i%3].id);state.plots[i].growth=crop(state.plots[i].crop).days*.8;state.plots[i].watered=true;}}hasStarted=true;selected=0;panelKind=null;pane.hidden=true;ui.hidden=DEMO;plots.hidden=DEMO;shell.started();refresh();save();}
function freshConfirm(){const card=el('div','ak-card',el('h2','ak-card-title','Start a fresh farm?'),el('p',null,'Your current farm on this device will be replaced. Your best farm value stays saved.'));card.append(el('div','ak-card-actions',action('Start fresh','ak-btn ak-btn-primary',()=>{shell.closeCard();start(true);}),action('Keep my farm','ak-btn',()=>shell.closeCard())));shell.card(card,{label:'Start a fresh farm'});}
function title(){const saved=restoreFarm(shell.store.read().farm);ui.hidden=true;plots.hidden=true;shell.title({logo:['HARVEST',{text:'EXCHANGE',tone:'mint'}],tagline:'Grow your farm. Play the fictional market.',play:saved?'Continue farm':'Start farming',onPlay:()=>start(false),modes:saved?[{label:'Fresh farm',sub:'A new beginning',onClick:freshConfirm}]:[],best:shell.store.best(),bestLabel:'Best farm value',fine:'Fictional crops • game credits only • saved on this device'});}
function tend(i){if(shell.state!=='play'||DEMO)return;selected=i;const p=state.plots[i];if(i>=state.unlocked){showPanel('build');return;}let success=false,text='';
 if(ready(p)){const amount=harvest(state,i);success=amount>0;text=success?`Harvested ${amount}!`:stored(state)+crop(p.crop).yield>capacity(state)?'Stockroom full. Make a sale or delivery.':'Rest until tomorrow for more energy.';}
 else if(!p.crop){success=plant(state,i,selectedCrop);text=success?`${crop(selectedCrop).name} planted`:'Need seed credits, energy or more delivery reputation.';}
 else{success=water(state,i);text=success?'Watered. Happy little roots.':p.watered?'Already watered. Come back when it says READY.':'Rest until tomorrow for more energy.';}
 if(success&&!REDUCED){const q=layout(view,DEMO).slots[i];for(let n=0;n<12;n++)particles.push({x:q.x,y:q.y-20,vx:Math.cos(n*2.4)*35,vy:-30-Math.sin(n)*25,life:1,color:n%2?'#fff0b4':'#bfe6a1'});}feedback(text,success);refresh();save();}
function showPanel(kind){panelKind=panelKind===kind?null:kind;pane.hidden=!panelKind;if(panelKind)renderPanel();}
function closePanel(){panelKind=null;pane.hidden=true;}
function rowButton(label,fn,disabled=false,cls=''){const b=action(label,cls,()=>{fn();refresh();save();});b.disabled=disabled;return b;}
function renderPanel(){if(!panelKind)return;const names={market:'THE CROP EXCHANGE',orders:'VILLAGE DELIVERIES',build:'GROW YOUR HOMESTEAD'};const header=el('div','hf-pane-head',el('h2',null,names[panelKind]),action('×','hf-close',closePanel));pane.replaceChildren(header);
 if(panelKind==='market'){
  pane.append(el('p','hf-pane-note',`${Math.floor(wealth(state))} CR total farm value · Fictional market, game credits only.`));
  const tabs=el('div','hf-tickers');for(const c of CROPS){const b=action(c.short,c.id===marketCrop?'is-selected':'',()=>{marketCrop=c.id;renderPanel();});tabs.append(b);}pane.append(tabs);
  const c=crop(marketCrop),m=state.market[c.id],change=(m.price/m.previous-1)*100;
  pane.append(el('div','hf-quote',el('div',null,el('small',null,c.name+' · per harvested unit'),el('br'),el('strong',null,m.price.toFixed(2)+' CR')),el('span',change>=0?'hf-up':'hf-down',`${change>=0?'+':''}${change.toFixed(1)}%`)));
  const chart=el('canvas',{class:'hf-chart','aria-label':c.name+' recent simulated price history'});pane.append(chart);drawChart(chart,m.history);
  pane.append(el('p','hf-pane-note',state.event.text));
  const stock=el('div','hf-trade',el('h3',null,'Your harvested stock'),el('p',null,`${state.stock[c.id]} ${c.name} in storage · ${stored(state)}/${capacity(state)} total`));
  stock.append(el('div','hf-row',rowButton('Sell 1',()=>{sellProduce(state,c.id,1);feedback('Harvest sold');},state.stock[c.id]<1),rowButton(`Sell all · ${Math.round(state.stock[c.id]*m.price)} CR`,()=>{sellProduce(state,c.id,state.stock[c.id]);feedback('Stock sold');},state.stock[c.id]<1)));pane.append(stock);
  const unit=sharePrice(state,c.id),shares=el('div','hf-trade',el('h3',null,'Fictional crop shares'),el('p',null,`${unit.toFixed(2)} CR per share · You own ${state.shares[c.id]}`),el('p','hf-explainer','Shares follow the crop market and pay small daily dividends. They are separate from the crops in your stockroom.'));
  if(state.shares[c.id])shares.append(el('p','hf-money',`Average entry ${state.basis[c.id].toFixed(2)} CR · Held value ${(unit*state.shares[c.id]).toFixed(2)} CR`));
  shares.append(el('div','hf-row',rowButton('Buy 1 share',()=>{trade(state,c.id,'buy');feedback('One crop share added');},state.cash<unit),rowButton('Sell 1 share',()=>{trade(state,c.id,'sell');feedback('One crop share sold');},!state.shares[c.id],'hf-muted')));pane.append(shares);
 }else if(panelKind==='orders'){
  pane.append(el('p','hf-pane-note',`Reputation ${state.rep} · Deliveries unlock new seeds. Rewards are fixed even when market prices change.`));
  if(!state.orders.length)pane.append(el('p',null,'All deliveries finished. More arrive tomorrow.'));
  for(const o of state.orders){const c=crop(o.crop),card=el('article','hf-order',el('h3',null,o.client),el('p',null,`${o.qty} ${c.name} · in stock: ${state.stock[c.id]}`),el('span','hf-badge',`Until day ${o.deadline} · ${o.reward} CR + reputation`));card.append(el('div','hf-row',rowButton('Deliver order',()=>{deliver(state,o.id);feedback('Delivery complete! New seeds may be unlocked.');},state.stock[c.id]<o.qty)));pane.append(card);}
  pane.append(el('p','hf-pane-note',`${state.stats.orders} deliveries completed · ${state.stats.harvested} crops harvested`));
 }else{
  pane.append(el('p','hf-pane-note','Small improvements turn a few beds into your own thriving farm.'));
  const explain={land:'Expand your growing space by two plots, up to twelve.',sprinkler:'Every planted crop is watered automatically each morning.',greenhouse:'All crops grow 25% faster.',pantry:'Double stockroom capacity from 80 to 160 units.'};
  for(const[id,u]of Object.entries(UPGRADES)){const owned=id==='land'?state.unlocked>=12:state.upgrades[id];const card=el('article','hf-upgrade',el('h3',null,u.name),el('p',null,explain[id]));card.append(el('div','hf-row',rowButton(owned?'Completed':`${u.cost} CR`,()=>{upgrade(state,id);feedback(u.name+' ready');},owned||state.cash<u.cost)));pane.append(card);}
 }
}
function refresh(rebuildPanel=true){creditChip.set(Math.floor(state.cash));dayChip.set(state.day);energyChip.set(state.energy);news.replaceChildren(el('b',null,`DAY ${state.day} · ${WEATHER[state.weather].name}`),state.event.text);for(let i=0;i<CROPS.length;i++){const c=CROPS[i],b=seedButtons[i];b.disabled=state.rep<c.rep;b.classList.toggle('is-selected',selectedCrop===c.id);b.setAttribute('aria-pressed',String(selectedCrop===c.id));b.querySelector('small').textContent=state.rep<c.rep?`${c.rep} reputation`:`${c.seed} CR · ${c.days}d`;}
 buttons.forEach((b,i)=>{const p=state.plots[i];b.setAttribute('aria-label',i>=state.unlocked?`Locked plot ${i+1}: expand farm`:`Plot ${i+1}: ${p.crop?crop(p.crop).name+(ready(p)?', ready to harvest':p.watered?', growing':', needs water'):', empty; plant '+crop(selectedCrop).name}`);});if(panelKind&&rebuildPanel)renderPanel();else if(panelKind==='market')updateQuote();}
function updateQuote(){const c=crop(marketCrop),m=state.market[c.id],unit=sharePrice(state,c.id),change=(m.price/m.previous-1)*100;const quote=pane.querySelector('.hf-quote');if(!quote)return;quote.querySelector('strong').textContent=m.price.toFixed(2)+' CR';const delta=quote.lastElementChild;delta.textContent=`${change>=0?'+':''}${change.toFixed(1)}%`;delta.className=change>=0?'hf-up':'hf-down';drawChart(pane.querySelector('.hf-chart'),m.history);const blocks=pane.querySelectorAll('.hf-trade');blocks[0].querySelectorAll('button')[1].textContent=`Sell all · ${Math.round(state.stock[c.id]*m.price)} CR`;blocks[1].querySelector('p').textContent=`${unit.toFixed(2)} CR per share · You own ${state.shares[c.id]}`;blocks[1].querySelector('button').disabled=state.cash<unit;const basis=blocks[1].querySelector('.hf-money');if(basis)basis.textContent=`Average entry ${state.basis[c.id].toFixed(2)} CR · Held value ${(unit*state.shares[c.id]).toFixed(2)} CR`;}
function positionPlots(f){const signature=[view.w,view.h,f.x,f.y,f.scale].join(',');if(signature===lastLayout)return;lastLayout=signature;buttons.forEach((b,i)=>{const q=f.slots[i],w=q.w*f.scale,h=Math.max(44,q.h*f.scale);Object.assign(b.style,{left:`${f.x+(q.x-q.w/2)*f.scale}px`,top:`${f.y+q.y*f.scale-h/2}px`,width:`${w}px`,height:`${h}px`});});}
addEventListener('keydown',e=>{if(shell.state!=='play'||e.ctrlKey||e.metaKey||e.altKey||/INPUT|TEXTAREA/.test(document.activeElement?.tagName))return;const k=e.key.toLowerCase();if(k==='escape'&&panelKind){closePanel();return;}if(k>='1'&&k<='6'){const c=CROPS[Number(k)-1];if(state.rep>=c.rep){selectedCrop=c.id;refresh();}return;}if(k.startsWith('arrow')){e.preventDefault();const cols=layout(view).wide?4:3;selected=(selected+(k==='arrowleft'?-1:k==='arrowright'?1:k==='arrowup'?-cols:cols)+12)%12;buttons[selected].focus({preventScroll:true});}else if(k==='enter'&&document.activeElement?.classList.contains('hf-plot')){e.preventDefault();tend(Number(document.activeElement.dataset.hfPlot));}else if(k==='w'){waterButton.click();}else if(k==='m')showPanel('market');else if(k==='o')showPanel('orders');else if(k==='u')showPanel('build');else if(k==='n'){endDay(state);refresh();save();}});
addEventListener('pagehide',save);
createLoop({paused:()=>shell.state!=='play',update(dt){tick(state,dt*(DEMO?14:1));saveTime+=dt;demoTime+=dt;refreshTime+=dt;
 if(DEMO&&demoTime>.65){demoTime=0;demoStep(state);}if(state.day!==lastDay){lastDay=state.day;starterHelp(state);refresh();}
 if(saveTime>2){saveTime=0;save();}if(refreshTime>.7){refreshTime=0;refresh(false);}
},render(_,dt){elapsed+=dt;for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=50*dt;p.life-=dt;}particles=particles.filter(p=>p.life>0);const f=layout(view,DEMO);positionPlots(f);drawFarm(view.begin(),view,f,state,REDUCED?0:elapsed,{selected,particles,face,demo:DEMO});}}).start();
if(QUERY.has('qa'))window.__harvest={get state(){return state;},get layout(){return layout(view,DEMO);},get mode(){return shell.state;}};
if(DEMO)start(true);else title();

