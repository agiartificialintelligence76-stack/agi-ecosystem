// Version 2: the 600 m chart climb. Times from the 135 m prototype are not comparable.
export const SAVE_KEY='agi1-skybreak-v2';
const read=()=>{try{return JSON.parse(localStorage.getItem(SAVE_KEY)||'{}');}catch{return {};}};
export function getBest(mode){const n=read().best?.[mode];return typeof n==='number'&&Number.isFinite(n)&&n>0?n:null;}
export function recordBest(mode,time){const data=read();data.best??={};const improved=!data.best[mode]||time<data.best[mode];if(improved)data.best[mode]=time;write(data);return improved;}
export function getBestBag(){const n=read().bag;return typeof n==='number'&&Number.isFinite(n)&&n>0?n:0;}
export function recordBag(count){const data=read();if(!data.bag||count>data.bag){data.bag=count;write(data);return true;}return false;}
export function loadCheckpoint(world){const s=read().checkpoint;if(s?.revision!==world.revision||s?.mode!=='rift'||!Number.isFinite(s.elapsed)||s.elapsed<0)return null;const platform=world.platforms.find(p=>p.id===s.id&&p.type==='checkpoint');return platform?{...s,coins:Array.isArray(s.coins)?s.coins:[],platform}:null;}
export function saveCheckpoint(world,id,elapsed,falls,maxHeight,coins=[]){const data=read();data.checkpoint={revision:world.revision,mode:'rift',id,elapsed,falls,maxHeight,coins:[...coins]};write(data);}
export function clearCheckpoint(){const data=read();delete data.checkpoint;write(data);}
function write(data){try{localStorage.setItem(SAVE_KEY,JSON.stringify(data));}catch{/* Play remains available when storage is disabled. */}}
