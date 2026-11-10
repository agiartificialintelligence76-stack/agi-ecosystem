// HARVEST EXCHANGE: a seeded, entirely fictional farm and crop-share exchange.
// Credits, companies, prices and events belong only to this game.
export const DAY_SECONDS = 48;
export const CROPS = Object.freeze([
  { id:'sunberry', name:'Sunberry', short:'SUN', color:'#ff677a', leaf:'#487c4c', seed:8, base:10, days:1.6, yield:3, rep:0 },
  { id:'bytebean', name:'Byte bean', short:'BYTE', color:'#a9ce66', leaf:'#397246', seed:12, base:14, days:2.3, yield:4, rep:0 },
  { id:'moonmelon', name:'Moon melon', short:'MOON', color:'#b4a0fa', leaf:'#476d64', seed:22, base:29, days:3.4, yield:3, rep:1 },
  { id:'cloudcorn', name:'Cloud corn', short:'CLOUD', color:'#ffd878', leaf:'#4b9063', seed:18, base:18, days:2.8, yield:5, rep:2 },
  { id:'neonroot', name:'Neon root', short:'NEON', color:'#fa9fd0', leaf:'#418e64', seed:24, base:26, days:3.6, yield:4, rep:3 },
  { id:'starbloom', name:'Star bloom', short:'STAR', color:'#84e7de', leaf:'#2c8180', seed:34, base:46, days:4.7, yield:3, rep:5 },
]);
export const WEATHER = Object.freeze([
  {name:'Golden skies',icon:'sun',growth:1,water:false},
  {name:'Soft rain',icon:'rain',growth:1.15,water:true},
  {name:'Cool breeze',icon:'wind',growth:.9,water:false},
  {name:'Warm evening',icon:'sun',growth:1.05,water:false},
]);
export const UPGRADES = Object.freeze({ land:{name:'Two new plots',cost:140}, sprinkler:{name:'Morning sprinklers',cost:260}, greenhouse:{name:'Glasshouse research',cost:360}, pantry:{name:'Bigger stockroom',cost:190} });
const round=n=>Math.round(n*100)/100;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const bag=()=>Object.fromEntries(CROPS.map(c=>[c.id,0]));
export const crop=id=>CROPS.find(c=>c.id===id);
function random(s){s.rng=(Math.imul(s.rng,1664525)+1013904223)>>>0;return s.rng/4294967296;}
export const sharePrice=(s,id)=>round(s.market[id].price*4);
export const capacity=s=>s.upgrades.pantry?160:80;
export const stored=s=>Object.values(s.stock).reduce((a,b)=>a+b,0);
export const wealth=s=>round(s.cash+CROPS.reduce((sum,c)=>sum+s.stock[c.id]*s.market[c.id].price+s.shares[c.id]*sharePrice(s,c.id),0));
export function createFarm(seed=7){
  const s={version:1,rng:(seed>>>0)||7,day:1,time:0,marketTime:0,cash:180,rep:0,energy:18,weather:0,unlocked:6,stock:bag(),shares:bag(),basis:bag(),plots:Array.from({length:12},()=>({crop:null,growth:0,watered:false})),market:{},upgrades:{sprinkler:false,greenhouse:false,pantry:false},orders:[],orderId:0,event:{text:'The village exchange is open.',crop:'sunberry',bias:0},stats:{harvested:0,orders:0,trades:0,dividends:0},feed:[],seasonSeen:0,helpDay:0};
  for(const c of CROPS){const price=round(c.base*(.9+random(s)*.2));s.market[c.id]={price,previous:price,history:Array.from({length:18},()=>price),supply:0};}
  s.plots[0]={crop:'sunberry',growth:2,watered:true};s.plots[1]={crop:'sunberry',growth:2,watered:true};s.plots[2]={crop:'bytebean',growth:1.2,watered:true};
  makeOrder(s,'sunberry',4); makeOrder(s,'bytebean',3);
  return s;
}
function note(s,text){s.feed.unshift({day:s.day,text});s.feed.length=Math.min(s.feed.length,16);}
function makeOrder(s,id,quantity){
  const available=CROPS.filter(c=>c.rep<=s.rep);
  const c=id?crop(id):available[Math.floor(random(s)*available.length)];
  const qty=quantity||3+Math.floor(random(s)*4);
  s.orders.push({id:++s.orderId,crop:c.id,qty,reward:Math.ceil(c.base*qty*1.3),deadline:s.day+4,client:['Luna’s café','AGI’s picnic','The night market','Cat shelter'][s.orderId%4]});
}
export function plant(s,index,id){
  const c=crop(id),p=s.plots[index];
  if(!c||!p||index>=s.unlocked||p.crop||s.energy<1||s.rep<c.rep||s.cash<c.seed)return false;
  s.cash=round(s.cash-c.seed);s.energy--;Object.assign(p,{crop:id,growth:0,watered:s.upgrades.sprinkler||WEATHER[s.weather].water});return true;
}
export function water(s,index){const p=s.plots[index];if(!p||index>=s.unlocked||!p.crop||p.watered||s.energy<1)return false;p.watered=true;s.energy--;return true;}
export function waterAll(s){let n=0;for(let i=0;i<s.unlocked;i++)if(water(s,i))n++;return n;}
export const ready=p=>Boolean(p.crop&&p.growth>=crop(p.crop).days);
export function harvest(s,index){
  const p=s.plots[index];if(!p||index>=s.unlocked||!ready(p)||s.energy<1)return 0;
  const c=crop(p.crop),qty=c.yield;if(stored(s)+qty>capacity(s))return 0;
  s.stock[c.id]+=qty;s.energy--;s.stats.harvested+=qty;Object.assign(p,{crop:null,growth:0,watered:false});return qty;
}
export function sellProduce(s,id,amount){
  if(!crop(id)||!Number.isInteger(amount)||amount<1||s.stock[id]<amount)return false;
  s.stock[id]-=amount;s.cash=round(s.cash+amount*s.market[id].price);s.market[id].supply+=amount;return true;
}
export function trade(s,id,side,amount=1){
  if(!crop(id)||!Number.isInteger(amount)||amount<1||amount>9999||!['buy','sell'].includes(side))return false;
  const unit=sharePrice(s,id),total=round(unit*amount);
  if(side==='buy'){
    if(total>s.cash)return false;
    s.basis[id]=round((s.basis[id]*s.shares[id]+total)/(s.shares[id]+amount));s.shares[id]+=amount;s.cash=round(s.cash-total);
  }else{if(s.shares[id]<amount)return false;s.shares[id]-=amount;s.cash=round(s.cash+total);if(!s.shares[id])s.basis[id]=0;}
  s.stats.trades++;return true;
}
export function deliver(s,id){
  const order=s.orders.find(o=>o.id===id);if(!order||order.deadline<s.day||s.stock[order.crop]<order.qty)return false;
  s.stock[order.crop]-=order.qty;s.cash+=order.reward;s.rep++;s.stats.orders++;s.orders=s.orders.filter(o=>o.id!==id);note(s,`${order.client}: delivered! +${order.reward} credits.`);return true;
}
export function upgrade(s,id){
  const u=UPGRADES[id];if(!u||s.cash<u.cost)return false;
  if(id==='land'){if(s.unlocked>=12)return false;s.unlocked+=2;}else{if(s.upgrades[id])return false;s.upgrades[id]=true;}
  s.cash-=u.cost;note(s,`${u.name} ready.`);return true;
}
export function marketTick(s){
  for(const c of CROPS){const m=s.market[c.id];m.previous=m.price;const mean=(c.base-m.price)/c.base*.025;const news=s.event.crop===c.id?s.event.bias:0;const pressure=Math.min(.025,m.supply*.001);m.price=round(clamp(m.price*(1+mean+(random(s)-.5)*.09+news-pressure),c.base*.42,c.base*2.25));m.supply*=.75;m.history.push(m.price);if(m.history.length>48)m.history.shift();}
}
function nextDay(s){
  s.day++;s.energy=18;s.weather=Math.floor(random(s)*WEATHER.length);
  for(const p of s.plots)p.watered=Boolean(p.crop&&(s.upgrades.sprinkler||WEATHER[s.weather].water));
  const c=CROPS[Math.floor(random(s)*CROPS.length)],positive=random(s)>.42;
  const headline=positive?[`${c.name} festival announced.`,`${c.name} recipes are trending.`,`${c.name} delivery demand rises.`]:[`${c.name} harvest surplus arrives.`,`${c.name} festival crowds thin out.`,`${c.name} farms report a bumper crop.`];
  s.event={text:headline[Math.floor(random(s)*headline.length)],crop:c.id,bias:positive?.012:-.012};note(s,s.event.text);
  let dividends=0;for(const item of CROPS)dividends+=round(s.shares[item.id]*s.market[item.id].price*.015);dividends=round(dividends);s.cash=round(s.cash+dividends);s.stats.dividends=round(s.stats.dividends+dividends);
  s.orders=s.orders.filter(o=>o.deadline>=s.day);while(s.orders.length<3)makeOrder(s);
}
export function tick(s,dt){
  if(!Number.isFinite(dt)||dt<=0)return;
  let remaining=Math.min(dt,DAY_SECONDS*2);
  while(remaining>1e-8){const step=Math.min(remaining,DAY_SECONDS-s.time,6-s.marketTime);for(const p of s.plots)if(p.crop){const speed=(p.watered?1:.28)*WEATHER[s.weather].growth*(s.upgrades.greenhouse?1.25:1);p.growth=Math.min(crop(p.crop).days,p.growth+step/DAY_SECONDS*speed);}s.time+=step;s.marketTime+=step;remaining-=step;if(s.marketTime>=6-1e-8){s.marketTime=0;marketTick(s);}if(s.time>=DAY_SECONDS-1e-8){s.time=0;nextDay(s);}}
}
export function endDay(s){tick(s,DAY_SECONDS-s.time);}
export function starterHelp(s){
  if(s.helpDay===s.day||s.cash>=8||stored(s)||Object.values(s.shares).some(Boolean)||s.plots.some(p=>p.crop))return false;
  s.cash+=16;s.helpDay=s.day;note(s,'The village seed bank left you 16 starter credits.');return true;
}
export function restoreFarm(raw){
  if(!raw||raw.version!==1||!Array.isArray(raw.plots)||raw.plots.length!==12)return null;
  try{const s=structuredClone(raw);if(!Number.isFinite(s.cash)||s.cash<0||!Number.isInteger(s.day)||s.day<1||!Number.isInteger(s.unlocked)||s.unlocked<6||s.unlocked>12)return null;
    if(![s.time,s.marketTime,s.rep,s.energy,s.rng,s.weather].every(Number.isFinite)||s.time<0||s.time>=DAY_SECONDS||s.marketTime<0||s.marketTime>=6||s.weather<0||s.weather>=WEATHER.length)return null;
    for(const c of CROPS){if(![s.stock?.[c.id],s.shares?.[c.id]].every(n=>Number.isInteger(n)&&n>=0))return null;const m=s.market?.[c.id];if(!m||!Number.isFinite(m.price)||m.price<=0||!Array.isArray(m.history)||m.history.some(n=>!Number.isFinite(n)||n<=0))return null;}
    for(const p of s.plots)if(p.crop&&(!crop(p.crop)||!Number.isFinite(p.growth)||p.growth<0))return null;
    if(!s.upgrades||!s.stats||!Array.isArray(s.orders)||!Array.isArray(s.feed))return null;return s;
  }catch{return null;}
}
export function demoStep(s){
  for(let i=0;i<s.unlocked;i++){const p=s.plots[i];if(ready(p))harvest(s,i);else if(!p.crop)plant(s,i,CROPS.filter(c=>c.rep<=s.rep)[i%CROPS.filter(c=>c.rep<=s.rep).length].id);else water(s,i);}
  for(const o of [...s.orders])deliver(s,o.id);
  for(const c of CROPS)if(s.stock[c.id]>7)sellProduce(s,c.id,s.stock[c.id]-4);
  if(s.cash>350&&!s.upgrades.sprinkler)upgrade(s,'sprinkler');
  if(s.cash>240&&s.shares.sunberry<2)trade(s,'sunberry','buy',1);
}
