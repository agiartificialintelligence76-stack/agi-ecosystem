import { NAPS } from './levels.js';
import { PROOFS } from './proofs.js';
import { replay } from './solver.js';
import { finished } from './rules.js';

export const POSES=[
 {name:'Window seat',pose:'sit',need:0},{name:'Biscuit baker',pose:'knead',need:1},
 {name:'Antenna stretch',pose:'stretch',need:5},{name:'Polite wave',pose:'wave',need:13},
 {name:'Belly invitation',pose:'roll',need:24},{name:'Perfect croissant',pose:'bagel',need:40},
];
export const grade=(moves,par)=>moves===par?3:moves<=par+3?2:1;
export const points=(moves,par)=>Math.max(100,400+par*28+grade(moves,par)*100-Math.max(0,moves-par)*11);
export function verified(b,path){
 if(!Array.isArray(path)||!path.length||path.length>2048||path.some(a=>!Number.isInteger(a)||!b.actions.includes(a)))return false;
 try{return finished(b,replay(b,path).state);}catch{return false;}
}
export function readBook(raw={}){
 const saved=raw?.napBook||{},runs={};
 for(const b of NAPS){const p=saved.runs?.[b.id];if(verified(b,p))runs[b.id]=p.slice();}
 const last=saved.last;
 const daily=saved.daily?.date;
 return {runs,last:Number.isInteger(last?.seed)&&NAPS[last?.id-1]?{seed:last.seed,id:last.id}:null,
   daily:typeof daily==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(daily)&&Number.isInteger(saved.daily.moves)&&saved.daily.moves>0?
    {date:daily,moves:saved.daily.moves,stars:Math.min(3,Math.max(1,Number(saved.daily.stars)||1))}:null};
}
export function worldCount(book,world){return NAPS.filter(b=>!b.encore&&b.world===world&&book.runs[b.id]).length;}
export function isOpen(b,book){
 if(b.encore)return worldCount(book,b.world)===8&&isOpen(NAPS[b.world*8],book);
 for(let w=0;w<b.world;w++)if(worldCount(book,w)<5)return false;
 return true;
}
export function nextNap(book){return NAPS.find(b=>isOpen(b,book)&&!book.runs[b.id])??NAPS[0];}
export function posesFor(book){return POSES.filter(p=>p.need<=Object.keys(book.runs).length);}
export function starTotal(book){return Object.entries(book.runs).reduce((s,[id,p])=>s+grade(p.length,PROOFS[id-1].par),0);}
export function archive(raw,b,path,par,seed,date=''){
 const book=readBook(raw);
 if(!verified(b,path))return book;
 if(date){if(date!==book.daily?.date||path.length<book.daily.moves)book.daily={date,moves:path.length,stars:grade(path.length,par)};}
 else{
  if(!isOpen(b,book))return book;
  if(!book.runs[b.id]||path.length<book.runs[b.id].length)book.runs[b.id]=path.slice();
  book.last={id:b.id,seed};
 }
 return book;
}