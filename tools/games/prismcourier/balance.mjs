import { performers,performGallery } from '../../../src/games/prismcourier/player.js';
for(const [name,profile] of Object.entries(performers)){
  const runs=Array.from({length:12},(_,i)=>performGallery(i+1,profile));
  const q=(key,p)=>runs.map(r=>r[key]).sort((a,b)=>a-b)[Math.floor(p*(runs.length-1))];
  console.log(name+' | 12 seeded tours | median '+(q('seconds',.5)/60).toFixed(1)+' min | score p10–90 '+q('score',.1)+'–'+q('score',.9)+' | gold '+q('gold',.5)+'/40 | '+q('detours',.5)+' detours, '+q('undos',.5)+' undos | stalls '+(runs.flatMap(r=>r.stalls).join(', ')||'none'));
}
