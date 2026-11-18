import {ISSUES} from '../../../src/games/nightpress/issues.js';
import {evaluate,placementsFor,placementOf,analysis,boardMasks,bits} from '../../../src/games/nightpress/press.js';
import {createDesk,choose,drop,depth,pull,rushIssue,deadline} from '../../../src/games/nightpress/editor.js';
import {PROOFS} from '../../../src/games/nightpress/proofs.js';
import {rng} from '../../../src/games/kit/fx.js';
const skills=['exploratory','steady','expert'],qt=(a,p)=>a.slice().sort((a,b)=>a-b)[Math.floor((a.length-1)*p)]??0;
const decks=new Map();
function rack(issue,skill){const key=issue.id+skill;if(decks.has(key))return decks.get(key);const masks=boardMasks(issue);
 const r=issue.pieces.map(id=>placementsFor(issue,id).filter(p=>{
  if(!issue.rules.includes('clip')&&p.cut)return false;
  if(skill!=='exploratory'&&(!p.film&&(masks.head&p.mask)))return false;
  if(skill==='expert'&&((issue.rules.includes('border')&&(p.mask&masks.bottom))||(issue.rules.includes('gutter')&&(p.mask&masks.gutter))||(issue.rules.includes('eyes')&&p.face&&bits(p.eyes)!==2)))return false;
  return true;
 }));decks.set(key,r);return r;}
function weighted(q){return q.checks.reduce((sum,r)=>sum+(r.ok?(r.id==='stock'?.5:r.id==='trim'?.7:r.id==='head'?1.4:1.7):0),0)+Math.min(.28,q.count*.017);}
function place(d,p){choose(d,p.id);Object.assign(d.cursor,p);drop(d);}
export function simulate(issue,skill,seed,limit=Infinity){
 const rand=rng((seed^Math.imul(issue.id+1,7211)^Math.imul(skills.indexOf(skill)+1,18347))>>>0).next,rackList=rack(issue,skill),d=createDesk(issue);
 let t=5+rand()*4,last=[],worst='stock',tries=0;const tags={};
 while(t<limit&&tries<85){tries++;
  // Mentally test a handful of loose compositions. Paper still has to be
  // picked, turned, placed, raised/lowered and pulled through the real judge.
  const samples=skill==='expert'?90:skill==='steady'?15:4;
  let best=null;for(let k=0;k<samples;k++){
   const layer=rackList.map((rs,i)=>last.length&&rand()<.38?last.find(p=>p.id===issue.pieces[i]):rs[Math.floor(rand()*rs.length)]);
   if(rand()<.48)layer.reverse();if(skill!=='exploratory'&&issue.rules.includes('top'))layer.sort((a,b)=>Number(a.foil)-Number(b.foil));
   if(skill==='expert'&&issue.rules.includes('window'))layer.sort((a,b)=>Number(!!a.hole)-Number(!!b.hole));
   const judge=analysis(issue,layer),value=weighted(judge)+rand()*(skill==='exploratory'?.82:.19);
   if(!best||value>best.value)best={layer,judge,value};if(!judge.failed.length)break;
  }
  const plans=best.layer;let spend=(skill==='expert'?3.70:skill==='steady'?4.9:5.7)+rand()*2.9+issue.rules.length*1.1;
  const changed=plans.filter(p=>{const current=d.layers.find(q=>q.id===p.id);return !current||current.x!==p.x||current.y!==p.y||current.turn!==p.turn;});
  spend+=changed.reduce((n,p)=>n+(skill==='expert'?3.5:skill==='steady'?6.0:7.2)+rand()*3.3+(p.turn?1.0:0),0);
  if(t+spend>limit){t=limit;break;}t+=spend;
  for(const p of changed)place(d,p);
  for(let j=0;j<plans.length;j++){const i=d.layers.findIndex(p=>p.id===plans[j].id);choose(d,plans[j].id);for(let k=i;k>j;k--){depth(d,-1);t+=1.7;}}
  if(t>limit){t=limit;break;}
  const result=pull(d);if(result)return {seconds:t,actions:d.moves,score:result.score,pass:true,tries,fail:worst,tags};
  worst=d.checks.failed.find(q=>!['stock','coverage','trim'].includes(q))||d.checks.failed[0]||'trim';tags[worst]=(tags[worst]||0)+1;d.phase='desk';last=plans;
 }
 return {seconds:t,actions:d.moves,score:0,pass:false,tries,fail:worst,tags};
}
const n=Number(process.argv.find(a=>a.startsWith('--seeds='))?.split('=')[1]??48);
export function measure(N=n){
 const results=[],detail=process.argv.includes('--json');
 for(const skill of skills){
  const vols=Array.from({length:6},()=>({actions:[],seconds:[],passes:0,total:0,loss:0,tags:{}})),rush=[],scores=[],trace=[];
  for(let seed=1;seed<=N;seed++){
   for(const issue of ISSUES){const v=vols[issue.volume],r=simulate(issue,skill,seed);v.actions.push(r.actions);v.seconds.push(r.seconds);v.total++;v.passes+=Number(r.pass);for(const [k,n] of Object.entries(r.tags))v.tags[k]=(v.tags[k]||0)+n;}
   let t=0,score=0,failed=null;
   for(let j=0;j<40;j++){const issue=rushIssue(seed,j),res=simulate(issue,skill,seed+j*31,deadline(seed,j));t+=res.seconds;score+=res.score;
    if(!res.pass){vols[issue.volume].loss++;failed={issue:issue.id+1,rule:res.fail};break;}}
   rush.push(t);scores.push(score);if(detail)trace.push({seed,seconds:Math.round(t),score,failed});
  }
  results.push({skill,...(detail?{trace}:{}),rush:[.1,.5,.9].map(p=>Math.round(qt(rush,p))),score:[.1,.5,.9].map(p=>Math.round(qt(scores,p))),
   volumes:vols.map((v,i)=>({volume:i+1,solutions:PROOFS.slice(i*6,i*6+6).reduce((a,q)=>a+q.solutions,0),distinct:PROOFS.slice(i*6,i*6+6).reduce((a,q)=>a+q.distinct,0),p50actions:qt(v.actions,.5),p50seconds:Math.round(qt(v.seconds,.5)),passes:v.passes,total:v.total,lost:v.loss,common:Object.entries(v.tags).sort((a,b)=>b[1]-a[1])[0]?.[0]||'none'}))});
 }return results;
}
if(process.argv[1]?.endsWith('balance.mjs')){
 const report=measure();if(process.argv.includes('--json'))console.log(JSON.stringify(report,null,2));
 else for(const p of report)console.log(p.skill+' | Rush p10/50/90 '+p.rush.join('/')+'s, scores '+p.score.join('/')+' | vols 1–6 med actions '+p.volumes.map(v=>v.p50actions).join('/')+'; median sec '+p.volumes.map(v=>v.p50seconds).join('/')+'; losses '+p.volumes.map(v=>v.lost).join('/')+'; principal '+p.volumes.map(v=>v.common).join('/')+' | starter books '+p.volumes[0].passes+'/'+p.volumes[0].total);
}
