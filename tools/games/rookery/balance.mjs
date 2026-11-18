import { pathToFileURL } from 'node:url';
import { NAPS } from '../../../src/games/rookery/levels.js';
import { PROOFS } from '../../../src/games/rookery/proofs.js';
import { initial,finished,command,pack,CALL,DOT } from '../../../src/games/rookery/rules.js';
import { solve } from '../../../src/games/rookery/solver.js';
import { grade,points } from '../../../src/games/rookery/progress.js';
import { rng } from '../../../src/games/kit/fx.js';

const distance=(b,a,c)=>Math.abs(a%b.cols-c%b.cols)+Math.abs(Math.floor(a/b.cols)-Math.floor(c/b.cols));
function estimate(b,s){
 if(finished(b,s))return -100;
 const goals=s.typed<b.word.length?b.letters.flatMap((l,i)=>l===b.word[s.typed]?[i]:[]):[b.home];
 const d=Math.min(...goals.map(k=>distance(b,s.cat,k)));
 return (b.word.length-s.typed)*7+d*2+Math.max(0,distance(b,s.cat,s.agi)-1)*.27;
}
function search(b,s,depth,seen,random,full){
 // Four-ply handler sees immediate consequences, never a solution table.
 let best=Infinity,chosen=null;const layer=new Map([[pack(b,s),{s,first:null}]]);
 let frontier=layer;
 for(let level=1;level<=depth;level++){
  const out=new Map();
  for(const node of frontier.values())for(const a of full?b.actions:[0,1,2,3]){
   const next=command(b,node.s,a);if(next===node.s)continue;
   const key=pack(b,next),first=node.first??a;
   if(layer.has(key)||out.has(key))continue;
   out.set(key,{s:next,first});
   const cost=estimate(b,next)+level*.105+(seen.get(key)||0)*2.7+random()*.16;
   if(cost<best){best=cost;chosen=first;}
  }
  for(const [id,n] of out)layer.set(id,n);
  frontier=out;
 }
 return chosen;
}
export function simulate(b,persona,seed,trace=null){
 const random=rng(seed*97+b.id*1583).next,proof=PROOFS[b.id-1];
 const exact=persona==='shortest',steady=persona==='lookahead';
 let s=initial(b),trail=[],states=[s],seen=new Map(),decision=0,corners=0,blocked=0,redots=0,rescues=0,undos=0;
 let rescuePlan=null,withoutProgress=0,min=estimate(b,s);
 const secondsPerDecision=exact?1.18:steady?3.1:4.55,reading=exact?3:steady?8:11;
 function rescue(){
  let path=solve(b,s);
  while(!path&&states.length>1){trace?.push('undo');states.pop();trail.pop();s=states.at(-1);undos++;decision++;path=solve(b,s);}
  trace?.push('hint','hint');rescues++;rescuePlan=path?.path?.slice()||[];
 }
 while(!finished(b,s)&&decision<Math.max(60,proof.par*6+50)){
  let a=null;
  if(exact)a=proof.witness[trail.length];
  else if(rescuePlan?.length)a=rescuePlan.shift();
  else{
   const code=pack(b,s);seen.set(code,(seen.get(code)||0)+1);
   if((seen.get(code)>2||withoutProgress>(steady?9:6)||decision>proof.par*(steady?1.65:1.4)+5)){rescue();continue;}
   if(!steady&&random()<.15&&b.sight[s.cat][s.agi]<0)a=CALL;
   else a=search(b,s,steady?4:1,seen,random,steady);
   if(a===null){rescue();continue;}
  }
  const e={},next=command(b,s,a,e);trace?.push(a);decision++;
  if(next===s){if(a===CALL)blocked++;withoutProgress++;continue;}
  if(a>=DOT&&!e.moved)redots++;
  if(e.moved&&e.kind==='push'&&b.steps[next.cat].filter(k=>k<0||b.tiles[k]==='#').length>=2&&next.cat!==b.home)corners++;
  trail.push(a);states.push(next);s=next;const v=estimate(b,s);
  if(v<min){min=v;withoutProgress=0;}else withoutProgress++;
 }
 const win=finished(b,s),secs=Math.round(reading+decision*secondsPerDecision+rescues*4+undos*1.1);
 return {id:b.id,name:b.name,win,moves:trail.length,decisions:decision,seconds:secs,score:win?points(trail.length,proof.par):0,
  stars:win?grade(trail.length,proof.par):0,corners,blocked,redots,rescues,undos};
}
const median=a=>{const v=[...a].sort((a,b)=>a-b);return (v[Math.floor((v.length-1)/2)]+v[Math.floor(v.length/2)])/2;};
const sum=(a,k)=>a.reduce((total,x)=>total+Number(x[k]),0);
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
const personas=['nudge','lookahead','shortest'],full=process.argv.includes('--json'),profiles={};
for(const persona of personas){
 const samples=[1,7,19].flatMap(seed=>NAPS.map(b=>simulate(b,persona,seed)));
 const groups=NAPS.map(b=>{const runs=samples.filter(r=>r.id===b.id);return {id:b.id,name:b.name,par:PROOFS[b.id-1].par,
  decisions:median(runs.map(r=>r.decisions)),seconds:median(runs.map(r=>r.seconds)),score:median(runs.map(r=>r.score)),
  corners:sum(runs,'corners'),blocked:sum(runs,'blocked'),redots:sum(runs,'redots')};});
 const n=samples.length,score=samples.map(r=>r.score);
 let elapsed=0,first20=[];for(const b of NAPS){const v=simulate(b,persona,7);if(elapsed>=1200)break;first20.push([b.id,elapsed,Math.min(1200,elapsed+v.seconds)]);elapsed+=v.seconds;}
 profiles[persona]={completions:sum(samples,'win')+'/'+n,unassisted:samples.filter(s=>!s.rescues&&s.win).length,medianDecisions:median(samples.map(s=>s.decisions)),
  medianSeconds:median(samples.map(s=>s.seconds)),scoreRange:[Math.min(...score),Math.max(...score)],medianScore:median(score),medianStars:median(samples.map(s=>s.stars)),
  corners:sum(samples,'corners'),blockedCalls:sum(samples,'blocked'),idleDotChanges:sum(samples,'redots'),rescues:sum(samples,'rescues'),undos:sum(samples,'undos'),
  first20Seconds:first20,completeBookMinutes:Math.round(median([0,1,2].map(i=>sum(samples.slice(i*NAPS.length,(i+1)*NAPS.length),'seconds')))/60),...(full?{boards:groups}:{})};
}
if(full)console.log(JSON.stringify({seeds:[1,7,19],secondsPerDecision:{nudge:4.55,lookahead:3.1,shortest:1.18},profiles},null,2));
else for(const [name,p] of Object.entries(profiles))console.log(name+' · book '+p.completeBookMinutes+' min · nap '+p.medianSeconds+'s / '+p.medianDecisions+' decisions · score '+p.medianScore+' ['+p.scoreRange.join('–')+'] · '+p.completions+' solved, '+p.unassisted+' unaided · '+p.blockedCalls+' blocked calls, '+p.corners+' corner pushes, '+p.idleDotChanges+' idle dot changes, '+p.rescues+' rescues');
}
