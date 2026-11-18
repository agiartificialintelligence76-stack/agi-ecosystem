import cues from './cues.json' with {type:'json'};
import { frames } from './chambers.js';
import { advance,opening,isHome,search,stars } from './maze.js';
import { rng } from '../kit/fx.js';

export function chamber(id,edition=0) {
  const variants=cues[id];
  return {...frames[id],...variants[edition%variants.length],edition:edition%variants.length};
}
export function readGallery(save) {
  const data=save?.mirrorBook;return data?.version===1 && data.rooms && typeof data.rooms==='object' ? data.rooms : {};
}
export function accessible(records,id) {
  if(id<8)return true;
  const first=Math.floor(id/8)*8-8;
  return Array.from({length:8},(_,i)=>records[first+i]?.stars>0).filter(Boolean).length>=5;
}
export function choose(seed,mode,selection,records){
  const next=frames.find(r=>accessible(records,r.id)&&!records[r.id])?.id ?? 0;
  if(mode==='daily'){const dice=rng(seed^0xa109),id=dice.int(0,39);return chamber(id,dice.int(0,cues[id].length-1));}
  const selected=selection==='continue'||selection==null?next:Number(selection);
  let room=Number.isInteger(selected)&&selected>=0&&selected<40&&accessible(records,selected)?selected:next;
  if(mode==='studio'&&!records[room])room=frames.find(f=>records[f.id])?.id??0;
  return chamber(room);
}
export function createTake(room){
  const stack=[opening(room)],commands=[];
  let undos=0,hints=0;
  return {
    get state(){return stack.at(-1);},get length(){return commands.length;},get solved(){return isHome(room,stack.at(-1));},
    get tape(){return commands.join('');},get undos(){return undos;},get hints(){return hints;},
    step(cmd){
      if(this.solved)return false;
      const next=advance(room,this.state,cmd);
      if(next===this.state)return false;
      commands.push(cmd);stack.push(next);return true;
    },
    undo(){if(stack.length<=1)return false;stack.pop();commands.pop();undos++;return true;},
    hint(){hints++;return search(room,this.state)?.[0]??null;},
    score(){return isHome(room,this.state)?Math.max(50,100*stars(room.par,this.length)+room.par*13-hints*8):0;},
  };
}
export function recordClear(data,room,take,mode,seed){
  const rooms=readGallery(data);
  const result={stars:stars(room.par,take.length),best:take.length,tape:take.tape};
  if(mode==='daily'){
    const d=data.mirrorDaily || {};
    d[seed]=Math.max(d[seed]||0,result.stars);
    const days=Object.keys(d).sort().slice(-60);
    data.mirrorDaily=Object.fromEntries(days.map(day=>[day,d[day]]));return;
  }
  if(room.edition!==0 || (rooms[room.id] && rooms[room.id].best<=take.length))return;
  data.mirrorBook={version:1,rooms:{...rooms,[room.id]:result}};
}
