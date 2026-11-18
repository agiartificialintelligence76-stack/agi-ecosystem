// node tools/games/tidepool/balance.mjs [seed count]
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { rng } from '../../../src/games/kit/fx.js';
import { makeDJ } from '../../../src/games/tidepool/ai.js';
import { SHIFTS } from '../../../src/games/tidepool/shifts.js';
import { configFor, openShow, advance, drain, resultOf } from '../../../src/games/tidepool/rules.js';
import { availableEdits } from '../../../src/games/tidepool/progress.js';

export function broadcast(profile,seed,mode='late',shift=5) {
  const config=configFor({seed,mode,shift,edits:availableEdits({unlocked:shift},shift,mode)});
  const s=openShow(config),bot=makeDJ(profile,rng(seed^0xaa7712).next);
  let weakEnergy=0,offBeat=0,wrongCurve=0;
  for(let tick=0;tick<30*1500&&!s.ended;tick++){
    bot(s);advance(s,(tick+1)/30);
    for(const event of drain(s)){
      if(event.kind!=='land'||event.missed)continue;
      if(event.energy<26)weakEnergy++;
      if(event.timing<16)offBeat++;
      if(event.curve<13)wrongCurve++;
    }
  }
  return {...resultOf(s),seconds:s.time,weakEnergy,offBeat,wrongCurve};
}
const median=(rows,field)=>{const values=rows.map(r=>r[field]).sort((a,b)=>a-b);return values[Math.floor(values.length/2)];};
export function audit(count=48) {
  for(const mode of ['hosted','late','daily']){
    for(const profile of ['newcomer','steady','expert']){
      const runs=Array.from({length:count},(_,i)=>broadcast(profile,2003+i*73,mode,mode==='hosted'?0:5));
      const scores=runs.map(r=>r.score).sort((a,b)=>a-b);
      console.log([mode.padEnd(7),profile.padEnd(9),'median '+median(runs,'seconds').toFixed(1)+'s','score '+scores[0]+'..'+scores.at(-1),
        'mixes '+median(runs,'blends'),'missed '+median(runs,'misses'),'offbeat '+median(runs,'offBeat'),'energy '+median(runs,'weakEnergy'),'curve '+median(runs,'wrongCurve')].join(' | '));
    }
  }
  const hours=SHIFTS.map((_,i)=>broadcast('steady',22703+i*73,'hosted',i).seconds);
  console.log('Hosted series, representative steady broadcasts: '+hours.map(x=>Math.round(x)+'s').join(', ')+'; '+(hours.reduce((a,b)=>a+b,0)/60).toFixed(1)+' minutes.');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))audit(Math.max(1,Number(process.argv[2])||48));
