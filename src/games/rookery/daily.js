import { rng } from '../kit/fx.js';
import { NAPS, SPECS } from './levels.js';
import { buildBoard } from './rules.js';
import { solve } from './solver.js';

// Mutate a real physical key and certify the resulting desk, including cat habits.
export function dailyNap(seed){
  const random=rng(seed^0x7ac447).next;
  for(let i=0;i<32;i++){
    const spec=SPECS[Math.floor(random()*40)];
    const src=Array.from(spec.map.join(''));
    const c=spec.map[0].length;
    const choices=src.flatMap((v,i)=>v==='.'&&i!==spec.home?[i]:[]);
    if(!choices.length)continue;
    const k=choices[Math.floor(random()*choices.length)];
    let label;
    if((spec.world===1||spec.world===2)&&random()<.48){src[k]='~';label='a newly polished cap';}
    else if(random()<.5){src[k]='#';label='a raised divider';}
    else{const old=src.indexOf('o');if(old<0)continue;src[old]='.';src[k]='o';label='a different sleeping spot';}
    const map=spec.map.map((_,i)=>src.slice(i*c,(i+1)*c).join(''));
    const b=buildBoard({...spec,map,name:'Daily · '+spec.name,daily:true,change:label});
    const p=solve(b);
    if(p&&p.path.length>=3&&p.path.length<=28)return {board:b,proof:{par:p.path.length,witness:p.path},signature:spec.id+'/'+map.join('/'),seed};
  }
  // A permanently certified alternate hinge, even if future decks add dense maps.
  const spec={...SPECS[2],map:['c.o..','.#...','.@..#'],name:'Daily · Screen Hinge',daily:true,change:'a raised divider'};
  const b=buildBoard(spec),p=solve(b);
  return {board:b,proof:{par:p.path.length,witness:p.path},signature:'3/'+b.map.join('/'),seed};
}