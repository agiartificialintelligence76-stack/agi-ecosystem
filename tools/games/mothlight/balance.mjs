import {pathToFileURL} from 'node:url';
import {configFor,openRoll,tick,resultOf} from '../../../src/games/mothlight/run.js';
import {makePhotographer} from '../../../src/games/mothlight/photographers.js';
import {finderLayout} from '../../../src/games/mothlight/render.js';
export function shootRoll(style,seed,roll,size=[360,640]){
 const s=openRoll(configFor('campaign',roll,seed)),photographer=makePhotographer(style,seed);
 const view=finderLayout(...size);if(!(view.w>0&&view.h>0))throw Error('Empty finder');
 // Perception and shots are evaluated against the same fixed-aspect film gate.
 const dt=.2;while(!s.ended&&s.time<360){photographer(s,dt);tick(s,dt);}
 const r=resultOf(s);
 const loss={framing:0,focus:0,gesture:0,request:0};
 for(const p of r.prints)for(const [k,max] of Object.entries({framing:30,focus:25,gesture:25,request:20}))loss[k]+=max-p.grade.parts[k];
 return {seed,roll,complete:r.grade>0,score:r.score,avg:r.avg,keepers:r.keepers,seconds:Math.round(s.time),frames:s.exposures,loss};
}
const p=(rows,k,f=.5)=>rows.map(r=>r[k]).sort((a,b)=>a-b)[Math.floor((rows.length-1)*f)];
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const json=process.argv.includes('--json'),data={};
 for(const style of ['novice','steady','expert']){
  const rows=[];for(let seed=1;seed<=48;seed++)for(let roll=0;roll<8;roll++){
   const a=shootRoll(style,seed,roll,[360,640]),b=shootRoll(style,seed,roll,[1440,900]);if(JSON.stringify(a)!==JSON.stringify(b))throw Error('Viewport changed film judgment');rows.push(a);
  }
  const failure=Object.fromEntries(['framing','focus','gesture','request'].map(k=>[k,+(rows.reduce((n,r)=>n+r.loss[k],0)/(rows.length*4)).toFixed(1)]));
  const duration=[p(rows,'seconds',.1),p(rows,'seconds'),p(rows,'seconds',.9)],scores=[p(rows,'avg',.1),p(rows,'avg'),p(rows,'avg',.9)];
  const keepers=Math.round(rows.reduce((n,r)=>n+r.keepers,0)*100/(rows.length*4)),first=rows.filter(r=>!r.roll&&r.complete).length;
  data[style]={duration,scores,keepers,first,loss:failure,...(json?{rolls:rows}:{})};
  if(!json)console.log(style+' · roll '+duration.join('/')+'s P10/M/P90 · photo score '+scores.join('/')+' · '+keepers+'% keepers · first rolls '+first+'/48 · points lost '+Object.entries(failure).map(([k,n])=>k+' '+n).join(', '));
 }
 if(json)console.log(JSON.stringify(data,null,2));
}
