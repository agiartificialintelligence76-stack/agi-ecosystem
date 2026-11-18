import {MEETS,RIVALS} from './rivals.js';
export const DECKS=[{id:'mint',label:'Sea glass',color:'#8ce2c5',blocks:0},{id:'butter',label:'Butter yellow',color:'#ffdf76',blocks:3},{id:'sky',label:'Sky blue',color:'#9ad2ed',blocks:9}];
const integer=(v,max=1000000)=>Number.isFinite(v)?Math.min(max,Math.max(0,Math.floor(v))):0;
export function readLibrary(raw={}){
 const a=raw?.bandit||{},wins=MEETS.map((_,i)=>Boolean(a.wins?.[i]));
 const next=wins.indexOf(false);if(next>=0)wins.fill(false,next+1);
 const unlocked=next<0?11:next;
 return {version:1,wins,unlocked,blocks:integer(a.blocks),longest:Math.min(120,Number(a.longest)||0),
  sleeves:RIVALS.flatMap((r,i)=>wins[i]?[r.name]:[]),last:a.last&&Number.isInteger(a.last.seed)&&Number.isInteger(a.last.meet)&&a.last.meet>=0&&a.last.meet<=unlocked?{...a.last}:null,
  daily:typeof a.daily?.day==='string'&&/^\d{4}-\d\d-\d\d$/.test(a.daily.day)?{day:a.daily.day,score:integer(a.daily.score)}:null,
  marathon:integer(a.marathon,999),chart:Array.isArray(a.chart)?a.chart.filter(r=>r&&RIVALS[r.rival]&&Number.isInteger(r.round)&&r.round>0)
   .slice(0,12).map(r=>({round:r.round,rival:r.rival,a:integer(r.a,120),b:integer(r.b,120),winner:r.winner===1?1:0})):[]};
}
export function selection(lib,requested,seed){
 const same=lib.last?.seed===seed?lib.last.meet:lib.unlocked;
 const id=requested==null||requested==='next'?same:Number(requested);
 return Number.isInteger(id)?Math.min(lib.unlocked,Math.max(0,id)):same;
}
export function saveResult(raw,s,score,day){
 const a=readLibrary(raw),mode=s.config.mode;
 if(mode==='local'||mode==='pass')return a;
 a.blocks+=s.stats[0].blocks;a.longest=Math.max(a.longest,s.stats[0].longest);
 if(mode==='ladder'){a.last={seed:s.config.seed,meet:s.config.meet};if(s.winner===0)a.wins[s.config.meet]=true;}
 if(mode==='marathon')a.marathon=Math.max(a.marathon,s.stats[0].rounds);
 if(mode==='daily'&&(a.daily?.day!==day||score>a.daily.score))a.daily={day,score};
 a.chart=s.record.slice(-12).map(r=>({round:r.round,rival:r.rival,a:Math.round(r.air[0]),b:Math.round(r.air[1]),winner:r.winner}));
 return readLibrary({bandit:a});
}
