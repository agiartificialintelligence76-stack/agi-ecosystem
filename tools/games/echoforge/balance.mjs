import { arrange, songs } from '../../../src/games/echoforge/setlist.js';
import { Performance } from '../../../src/games/echoforge/performance.js';
import { player, skillNames } from '../../../src/games/echoforge/player.js';

function percentile(rows, fraction) {
  const sorted = [...rows].sort((a,b)=>a-b);
  return sorted[Math.floor((sorted.length-1)*fraction)];
}
for (const skill of skillNames) {
  const runs = [];
  const trouble = new Map();
  for (const tune of songs) {
    for (const difficulty of ['soundcheck','studio','headliner']) {
      for (let seed=1;seed<=3;seed++) {
        const part=['lead','upper','lower'][seed-1];
        const chart=arrange({tune,difficulty,part,seed});
        const run=new Performance(chart,(e)=>{
          if(e.type==='judge' && ['wrong','short','miss'].includes(e.kind)) {
            const key=difficulty+' '+e.kind;
            trouble.set(key,(trouble.get(key)||0)+1);
          }
        });
        const actions=player(chart,skill,seed*73);
        const intervene=(down,lane,time)=>down?run.press(lane,time):run.release(lane,time);
        for(let t=0;t<=chart.duration+.1;t+=1/60) {actions(t,intervene);run.advance(t);}
        runs.push({...run.report(),duration:chart.duration});
      }
    }
  }
  const measure=(key,p,scale=1)=>Math.round(percentile(runs.map(r=>r[key]),p)*scale);
  const failures=[...trouble].sort((a,b)=>b[1]-a[1]).slice(0,2).map(([key,n])=>key+' ('+n+')').join(', ');
  console.log(skill.padEnd(8)+' n='+runs.length+' · song seconds P10/P50/P90 '+[.1,.5,.9].map(p=>measure('duration',p)).join('/')+
    ' · accuracy P10/P50/P90 '+[.1,.5,.9].map(p=>measure('accuracy',p,100)).join('/')+'% · score P10/P50/P90 '+
    [.1,.5,.9].map(p=>measure('score',p)).join('/')+' · breaks '+failures);
}
console.log('A song lasts for its recording. Skill changes accuracy, streaks and grade. Seven full recordings total '+
  (songs.reduce((n,s)=>n+s.duration,0)/60).toFixed(2)+' minutes.');
