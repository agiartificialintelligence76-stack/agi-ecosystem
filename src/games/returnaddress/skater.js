import { createSide,setlist } from './record.js';
import { rng } from '../kit/fx.js';

// A skater notices a mark ahead of the gate, moves (or deliberately stays in
// the wrong groove), and times the hop. All outcomes use the real collision rules.
export const players = {
  newbie:{read:.73,jump:.57,timing:.29,repair:false},
  steady:{read:.922,jump:.90,timing:.19,repair:true},
  expert:{read:.99,jump:.982,timing:.09,repair:true},
};
export function simulate(seed,profile) {
  const dice=rng(seed+77), sides=setlist(seed,'shuffle','tour');
  let elapsed=0, score=0, cleared=0, cause='tour clear';
  for (const [i,record] of sides.entries()) {
    const board=createSide(record,'club',seed+i*104729), s=board.state;
    while (!s.finished) {
      const e=s.events[s.index], before=s.time;
      if (!e) { board.advance(record.duration); elapsed+=s.time-before; break; }
      const gap=e.time-before;
      if (gap>.54) board.advance(e.time-.53);
      if (e.scratch) {
        if (dice.chance(profile.jump)) {
          const when=e.time-.24+dice.range(-profile.timing,profile.timing);
          board.advance(Math.max(s.time,Math.min(when,e.time-.001)));
          board.jump();
        }
      } else {
        const target=dice.chance(profile.read)?e.lane:(e.lane+1)%3;
        while(s.lane!==target) board.shift(Math.sign(target-s.lane));
      }
      board.advance(e.time+.001);
      elapsed+=s.time-before;
      if(profile.repair && !s.finished && s.ledger.damage>=7 && s.spin>0) board.rewind();
    }
    score+=s.ledger.score;
    if(s.failed){cause=s.last.kind+' · '+record.title;break;}
    cleared++;
  }
  return {elapsed,score,cleared,cause};
}
