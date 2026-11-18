import {pathToFileURL} from 'node:url';
import {configuration,createDuel,DT,tick,drain,scoreFor} from '../../../src/games/driftglass/duel.js';
import {makeDriver} from '../../../src/games/driftglass/drivers.js';
import {DISTRICTS,view} from '../../../src/games/driftglass/road.js';
const sizes=[[360,640],[1440,900]];
export function runProfile(profile,seed,mode='marathon',meet=0,size=sizes[0]){
 const sim=createDuel(configuration(mode,meet,seed)),actor=makeDriver(profile,0,seed),rival=makeDriver('rival',1,seed);
 const camera=view(...size);let frame=0;const events={};
 // Every control operates on world positions; changing the projection cannot
 // alter transfer windows, cooldowns or traffic. Exercise both viewport setups.
 if(!Number.isFinite(camera.fx))throw Error('Unusable viewport');
 while(!sim.ended&&frame++<120*1200){
  if(profile!=='idle')actor.think(sim,DT);
  rival.think(sim,DT);tick(sim,DT);
  for(const e of drain(sim))events[e.kind]=(events[e.kind]||0)+1;
 }
 const a=sim.stats[0],b=sim.stats[1];return {seed,completed:sim.ended,won:sim.winner===0,seconds:Math.round(sim.time),
  score:scoreFor(sim),wins:sim.wins[0],rounds:sim.record.length,share:Math.round(100*a.air/(a.air+b.air||1)),
  attempts:a.attempts,steals:a.steals,jams:a.jams,blocks:a.blocks,early:a.early,boosts:a.boosts,hits:a.hits,near:a.near,
  changes:a.steals+b.steals,longest:+a.longest.toFixed(2),end:sim.reason,district:DISTRICTS[sim.district].short,
  roundLengths:sim.record.map(r=>Math.round(r.seconds)),events};
}
const q=(rows,key,frac=.5)=>rows.map(r=>r[key]).sort((a,b)=>a-b)[Math.floor((rows.length-1)*frac)];
function summarize(rows){
 const metric=k=>q(rows,k),counts={};for(const r of rows){const id=r.end+'/'+r.district;counts[id]=(counts[id]||0)+1;}
 return {seconds:[q(rows,'seconds',.1),metric('seconds'),q(rows,'seconds',.9)],score:[q(rows,'score',.25),metric('score'),q(rows,'score',.75)],
  wins:rows.filter(r=>r.won).length,roundsWon:metric('wins'),share:metric('share'),steals:[metric('steals'),metric('attempts')],
  jams:[metric('blocks'),metric('jams')],boosts:metric('boosts'),hits:metric('hits'),changes:metric('changes'),near:metric('near'),
  failures:counts,roundSec:q(rows.flatMap(r=>r.roundLengths.map(n=>({n}))),'n')};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const json=process.argv.includes('--json'),data={};
 for(const name of ['novice','steady','expert']){
  const rows=[],first=[],last=[];for(let seed=1;seed<=64;seed++){
   const phone=runProfile(name,seed),wide=runProfile(name,seed,'marathon',0,sizes[1]);
   if(JSON.stringify(phone)!==JSON.stringify(wide))throw Error('Viewport changed a world-state outcome');
   rows.push(phone);first.push(runProfile(name,seed,'ladder',0));last.push(runProfile(name,seed,'ladder',11));
  }
  const m=summarize(rows),a=summarize(first),b=summarize(last);
  data[name]={marathon:m,opener:a,champion:b,...(json?{runs:rows}:{})};
  if(!json)console.log(name+' · marathon '+m.seconds.join('/')+'s (P10/M/P90) · score '+m.score.join('/')+' (Q1/M/Q3) · '+m.share+'% airtime · steals '+m.steals.join('/')+', jams '+m.jams.join('/')+', '+m.boosts+' boosts, '+m.hits+' crashes · '+m.roundSec+'s/round · ladder wins '+a.wins+'/64–'+b.wins+'/64 · '+Object.entries(m.failures).sort((x,y)=>y[1]-x[1])[0].join(' '));
 }
 if(json)console.log(JSON.stringify(data,null,2));
}
