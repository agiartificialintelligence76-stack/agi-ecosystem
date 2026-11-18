import { initial, pack, unpack, command, finished, CALL, DOT, LEFT, RIGHT } from './rules.js';

// Breadth first over physical states. Visited states store a single parent and move.
// Optional counterfactuals remove a type of action or a realized physical event.
export function solve(board,start=initial(board),ban='',{limit=board.capacity}={}) {
  const key=pack(board,start),seen=new Int32Array(board.capacity).fill(-1);
  const queue=new Uint32Array(board.capacity),actionFrom=new Uint8Array(board.capacity);
  queue[0]=key;seen[key]=key;
  let head=0,tail=1;
  while(head<tail&&head<limit){
    const here=queue[head++],state=unpack(board,here);
    if(finished(board,state)){
      const path=[];let cursor=here;
      while(cursor!==key){path.push(actionFrom[cursor]);cursor=seen[cursor];}
      return {path:path.reverse(),expanded:head};
    }
    for(const action of board.actions){
      if((ban==='call'&&action===CALL)||(ban==='laser'&&action>=DOT)||(ban==='turn'&&(action===LEFT||action===RIGHT)))continue;
      const event=ban==='slide'||ban==='autonomous'||ban==='push'?{}:null;
      const next=command(board,state,action,event);
      if(next===state||(ban==='slide'&&event.slide)||(ban==='autonomous'&&event.moved&&event.kind!=='push')||(ban==='push'&&event.kind==='push'))continue;
      const code=pack(board,next);if(seen[code]>=0)continue;
      seen[code]=here;actionFrom[code]=action;queue[tail++]=code;
    }
  }
  return null;
}
export function replay(board,path,start=initial(board)){
  const events=[];let state=start;
  for(const action of path){const e={action};const next=command(board,state,action,e);if(next===state)throw Error('Invalid replay on '+board.name);events.push(e);state=next;}
  return {state,events};
}
