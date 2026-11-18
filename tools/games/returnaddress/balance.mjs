import { simulate,players } from '../../../src/games/returnaddress/skater.js';
const quantile=(list,q)=>list.slice().sort((a,b)=>a-b)[Math.floor((list.length-1)*q)];
for(const [name,profile] of Object.entries(players)){
  const results=Array.from({length:80},(_,i)=>simulate(i+1,profile));
  const duration=results.map(r=>r.elapsed),scores=results.map(r=>r.score),failures={};
  for(const run of results)failures[run.cause]=(failures[run.cause]||0)+1;
  const typical=Object.entries(failures).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([k,v])=>k+' ('+v+')');
  console.log(name+' | 80 tours | median '+quantile(duration,.5).toFixed(1)+' s | p10–90 '+quantile(duration,.1).toFixed(1)+'–'+quantile(duration,.9).toFixed(1)+' s | score p10–90 '+quantile(scores,.1)+'–'+quantile(scores,.9)+' | '+typical.join(', '));
}
