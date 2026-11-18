import { byId } from './catalog.js';
import { beginFade, changeEdit, grade, selectSleeve } from './rules.js';

const profiles = {
  newcomer:{ choice:.42, timing:.41, miss:.29, phrase:.37 },
  steady:{ choice:.77, timing:.18, miss:.08, phrase:.78 },
  expert:{ choice:1, timing:.043, miss:.012, phrase:.97 },
  demo:{ choice:1, timing:.012, miss:0, phrase:1 },
};
export function makeDJ(name, random) {
  const p=profiles[name]||profiles.steady;
  let prepared=-1,fire=Infinity;
  return function play(s) {
    if(s.ended||s.fade)return;
    if(prepared!==s.turn){
      if(s.time < Math.min(s.request.target-.8,s.started+.7))return;
      prepared=s.turn;
      let best={value:-1,sleeve:0,edit:0};
      for(let i=0;i<s.choices.length;i++)for(let j=0;j<s.config.edits.length;j++){
        const c=byId[s.choices[i]].cuts[s.config.edits[j]];
        const v=26-9*Math.abs(c.heat-s.request.heat)+(c.curve===s.request.curve?12:0);
        if(v>best.value)best={value:v,sleeve:i,edit:j};
      }
      const know=random()<p.choice;
      selectSleeve(s,know?best.sleeve:Math.floor(random()*s.choices.length));
      const edit=know?best.edit:Math.floor(random()*s.config.edits.length);
      while(s.edit!==edit)changeEdit(s,1);
      const miss=random()<p.miss;
      const drift=random()<p.phrase?0:(.35+random()*1.32)*s.request.bar;
      fire=miss?Infinity:s.request.target+drift+(random()*2-1)*p.timing;
    }
    if(s.time>=fire){beginFade(s,s.time);fire=Infinity;}
  };
}
