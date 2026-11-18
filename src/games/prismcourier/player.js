import { chamber,createTake } from './rehearsal.js';
import { advance,moves,search } from './maze.js';
import { rng } from '../kit/fx.js';

export const performers={
  firstVisit:{think:4.7,detour:.23,undo:.42,patience:76},
  steady:{think:3.0,detour:.12,undo:.73,patience:65},
  expert:{think:1.6,detour:.025,undo:.42,patience:54},
};
export function performGallery(seed,skill){
  const dice=rng(seed), result={seconds:0,score:0,gold:0,detours:0,undos:0,stalls:[],reunions:0};
  for(let i=0;i<40;i++){
    const room=chamber(i),take=createTake(room);
    let path=[...room.witness].map(Number);
    result.seconds+=skill.think*3.4; // Read each new pair of floors and its compass.
    for(let turn=0;turn<skill.patience && !take.solved;turn++){
      if(!path?.length)path=search(room,take.state);
      if(!path?.length){
        if(!take.undo())break;
        result.undos++;result.seconds+=skill.think;continue;
      }
      const best=path[0], wrong=moves(room).filter(m=>m!==best&&advance(room,take.state,m)!==take.state);
      const detour=wrong.length&&dice.chance(skill.detour);
      result.seconds+=skill.think*(.75+dice.next()*.5);
      if(detour){
        take.step(dice.pick(wrong));result.detours++;path=[];
        if(dice.chance(skill.undo)){take.undo();result.undos++;result.seconds+=skill.think*.55;}
      }else {take.step(best);path.shift();}
    }
    if(!take.solved){result.stalls.push(room.name);continue;}
    result.score+=take.score();result.reunions++;if(take.length===room.par)result.gold++;
  }
  return result;
}
