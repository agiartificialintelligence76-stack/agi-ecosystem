import {DECALS,ISSUES} from './issues.js';
import {geometry,placementOf} from './press.js';
const title=x=>typeof x==='string'?x.replace(/[\u0000-\u001f]/g,' ').trim().slice(0,32):'';
const validId=x=>typeof x==='string'&&Object.hasOwn(DECALS,x);
export function readCover(raw){
 if(!raw||!Number.isInteger(raw.stock)||raw.stock<0||raw.stock>5||!Array.isArray(raw.pieces)||raw.pieces.length<1||raw.pieces.length>4||!raw.pieces.every(validId)||new Set(raw.pieces).size!==raw.pieces.length||!Array.isArray(raw.layers)||raw.layers.length>raw.pieces.length)return null;
 const issue={...ISSUES[0],pieces:raw.pieces},seen=new Set(),layers=[];
 for(const q of raw.layers){const g=geometry(issue,q);if(!g||seen.has(g.id))return null;seen.add(g.id);layers.push(placementOf(g));}
 return {title:title(raw.title)||'Untitled cover',stock:raw.stock,pieces:[...raw.pieces],layers,comment:typeof raw.comment==='string'?raw.comment.slice(0,95):''};
}
function shelfEntry(raw){const cover=readCover(raw);return cover&&typeof raw.key==='string'&&/^edition-[0-9]{1,10}$/.test(raw.key)?{...cover,key:raw.key}:null;}
export function readBinder(raw){
 const b=raw?.pressBinder||{},stars=ISSUES.map((_,i)=>[1,2,3].includes(b.stars?.[i])?b.stars[i]:0);
 const first=stars.indexOf(0);if(first>=0)stars.fill(0,first+1);
 const seen=new Set(),gallery=[];
 for(const r of (Array.isArray(b.gallery)?b.gallery:[]).slice(0,12)){const q=shelfEntry(r);if(q&&!seen.has(q.key)){gallery.push(q);seen.add(q.key);}}
 const next=Math.max(1,...gallery.map(g=>Number(g.key.slice(8))+1),Number.isInteger(b.next)&&b.next>0&&b.next<1e9?b.next:1);
 const change=b.change&&['replace','remove','add'].includes(b.change.kind)&&Number.isInteger(b.change.index)&&b.change.index>=0&&b.change.index<=12?b.change:null;
 const prev=change?shelfEntry(change.before):null;
 return {stars,next,gallery,change:change&&(prev||change.kind==='add')?{kind:change.kind,index:change.index,before:prev,key:String(change.key).slice(0,24)}:null,
 daily:b.daily&&/^\d{4}-\d\d-\d\d$/.test(b.daily.day)&&Number.isFinite(b.daily.score)?{day:b.daily.day,score:Math.max(0,b.daily.score)}:null,
 rush:Number.isFinite(b.rush)?Math.max(0,b.rush):0};
}
export const nextIssue=b=>{const i=b.stars.indexOf(0);return i<0?35:i;};
export function earned(b){
 const ids=new Set(['agi','ticket','stamp']);for(let i=0;i<36;i++)if(b.stars[i]){for(const id of ISSUES[i].pieces)ids.add(id);if(i%6===5)for(const id of ISSUES[Math.min(35,i+1)].pieces)ids.add(id);}
 return [...ids];
}
export function fileArt(b,raw,key=null){
 const art=readCover(raw);if(!art||!art.layers.length)return null;
 let index=key?b.gallery.findIndex(r=>r.key===key):-1;
 if(index<0){const id='edition-'+b.next++;if(b.gallery.length<12){index=b.gallery.length;b.change={kind:'add',index,before:null,key:id};b.gallery.push({...art,key:id});}
  else{index=0;b.change={kind:'replace',index,before:b.gallery[0],key:id};b.gallery[0]={...art,key:id};}return id;}
 b.change={kind:'replace',index,before:b.gallery[index],key};b.gallery[index]={...art,key};return key;
}
export function removeArt(b,key){const index=b.gallery.findIndex(v=>v.key===key);if(index<0)return false;
 b.change={kind:'remove',index,key,before:b.gallery[index]};b.gallery.splice(index,1);return true;}
export function recoverArt(b){const q=b.change;if(!q)return false;
 const index=b.gallery.findIndex(p=>p.key===q.key);
 if(q.kind==='remove')b.gallery.splice(q.index,0,q.before);else if(q.kind==='replace'&&index>=0)b.gallery[index]=q.before;else if(q.kind==='add'&&index>=0)b.gallery.splice(index,1);
 b.change=null;return true;
}
export function renameArt(b,key,name){const n=title(name),q=b.gallery.find(w=>w.key===key);if(!q||!n)return false;b.change={kind:'replace',index:b.gallery.indexOf(q),key,before:{...q}};q.title=n;return true;}
