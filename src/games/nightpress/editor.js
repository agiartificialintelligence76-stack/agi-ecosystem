import {ISSUES,issueFor,DECALS,VOLUMES} from './issues.js';
import {evaluate,geometry,placementOf} from './press.js';
import {nextIssue,earned} from './binder.js';
export const clone=a=>a.map(p=>({...p}));
export function createDesk(issue,stock=issue.volume){
 return {issue,stock,layers:[],history:[],moves:0,selected:issue.pieces[0],cursor:{x:1,y:2,turn:0},phase:'desk',elapsed:0,lastDrop:null,flash:0,
 checks:evaluate(issue,[]),published:false,probes:0,streak:0};
}
export function choose(d,id){if(!d.issue.pieces.includes(id))return false;d.selected=id;const old=d.layers.find(p=>p.id===id);
 d.cursor=old?{x:old.x,y:old.y,turn:old.turn}:{x:1,y:2,turn:0};return true;}
export function nudge(d,dx,dy){d.cursor.x=Math.min(d.issue.w,Math.max(-1,d.cursor.x+dx));d.cursor.y=Math.min(d.issue.h,Math.max(-1,d.cursor.y+dy));}
export function turn(d,k=1){d.cursor.turn=((d.cursor.turn+k)%4+4)%4;}
function save(d){d.history.push({layers:clone(d.layers),selected:d.selected,cursor:{...d.cursor}});if(d.history.length>128)d.history.shift();}
function changed(d){d.checks=evaluate(d.issue,d.layers);d.flash=.4;d.phase='desk';}
export function drop(d){
 const p=geometry(d.issue,{id:d.selected,...d.cursor});if(!p)return false;
 const old=d.layers.findIndex(q=>q.id===d.selected);
 if(old>=0&&d.layers[old].x===p.x&&d.layers[old].y===p.y&&d.layers[old].turn===p.turn)return false;
 save(d);const q=placementOf(p);if(old>=0)d.layers[old]=q;else d.layers.push(q);d.lastDrop=q;d.moves++;changed(d);return true;
}
export function depth(d,direction){
 const i=d.layers.findIndex(p=>p.id===d.selected),j=i+direction;if(i<0||j<0||j>=d.layers.length)return false;
 save(d);[d.layers[i],d.layers[j]]=[d.layers[j],d.layers[i]];d.moves++;changed(d);return true;
}
export function undo(d){const q=d.history.pop();if(!q)return false;d.layers=q.layers;d.selected=q.selected;d.cursor=q.cursor;changed(d);return true;}
export function pull(d,studio=false){
 d.probes++;if(!d.layers.length||(!studio&&d.checks.failed.length)){d.phase='proof';return null;}
 d.phase='fold';d.flash=1.0;const par=d.issue.pieces.length,stars=d.moves<=par?3:d.moves<=par+2?2:1;
 return {stars,par,score:Math.max(15,150+50*stars+4*d.checks.count-4*Math.max(0,d.moves-par)),moves:d.moves};
}
export function cover(d,name=d.issue.title,comment=''){return {title:name,stock:d.stock,pieces:[...d.issue.pieces],layers:clone(d.layers),comment};}
export function reopen(raw){const issue={...ISSUES[raw.stock*6],title:raw.title,pieces:[...raw.pieces],rules:[],coverage:1};const d=createDesk(issue,raw.stock);
 d.layers=clone(raw.layers);d.checks=evaluate(d.issue,d.layers);choose(d,d.issue.pieces[0]);return d;}
export function studioIssue(b){return {...ISSUES[0],title:'UNTITLED CLUB',pieces:earned(b).slice(0,3),coverage:1,rules:[],note:'Your own cover. Mix the shapes and save a print.'};}
export function swapMotif(d,b,dir=1){const pool=earned(b),i=d.issue.pieces.indexOf(d.selected),at=pool.indexOf(d.selected);
 for(let j=1;j<=pool.length;j++){const id=pool[((at+j*dir)%pool.length+pool.length)%pool.length];if(d.issue.pieces.includes(id))continue;
  d.issue={...d.issue,pieces:d.issue.pieces.map((q,k)=>k===i?id:q)};d.layers=d.layers.filter(p=>p.id!==d.selected);d.history=[];choose(d,id);changed(d);return true;}return false;}
export function rushIssue(seed,index){if(index===0)return ISSUES[(seed>>>0)%6];const x=(Math.imul(seed^0x73d2,1664525)+Math.imul(index+5,1103515245))>>>0;
 return ISSUES[Math.min(5,Math.floor(index*.76))*6+(x>>>8)%6];}
export const deadline=(seed,index)=>45+(((seed>>>0)%31+index*13)%31);
export function begin(mode,b,seed,choice='next'){
 const unlocked=nextIssue(b),wanted=Number(choice),i=choice==='next'||!Number.isInteger(wanted)?unlocked:Math.min(unlocked,Math.max(0,wanted));
 const issue=mode==='daily'?issueFor(seed):mode==='rush'?rushIssue(seed,0):mode==='studio'?studioIssue(b):ISSUES[i];
 return {mode,seed,index:0,total:0,time:0,left:deadline(seed,0),done:false,desk:createDesk(issue),last:null};
}
export function nextRush(s){
 s.index++;s.desk=createDesk(rushIssue(s.seed,s.index));s.left=deadline(s.seed,s.index);s.last=null;
}
