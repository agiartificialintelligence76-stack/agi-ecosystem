import {survey} from '../../../src/games/cloudfoil/pilot.js';
import {routes} from '../../../src/games/cloudfoil/routes.js';
const q=(vals,p)=>vals.slice().sort((a,b)=>a-b)[Math.floor((vals.length-1)*p)];
const round=n=>Math.round(n);
console.log(routes.length+' individually scored round trips, '+routes.reduce((a,r)=>a+r.legs.length,0)+' outbound and return handoffs, six districts.');
for(const level of ['newbie','steady','expert']){
 const flights=Array.from({length:64},(_,i)=>survey(i+1,level));
 const causes={};for(const f of flights)for(const [key,n] of Object.entries(f.causes))causes[key]=(causes[key]||0)+n;
 const percent=(key,p)=>round(q(flights.map(f=>f[key]),p));
 console.log(level+' · 64 red-eye runs · median '+percent('time',.5)+'s · handoffs '+percent('cards',.5)+' · score P10/50/90 '+[.1,.5,.9].map(p=>percent('score',p)).join('/')+' · chute openings '+JSON.stringify(causes));
 const post=routes.map(r=>survey(37+r.id,level,'post',r.id));
 const duration=post.reduce((sum,f,i)=>sum+(f.cards?f.time/f.cards*(routes[i].legs.length):0),0);
 console.log('  campaign pace '+(duration/60).toFixed(1)+' min extrapolated at measured seconds per handoff · clean single-flight cards '+post.filter((v,i)=>v.cards===routes[i].legs.length).length+'/18');
}
