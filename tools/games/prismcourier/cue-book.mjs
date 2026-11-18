import { writeFileSync } from 'node:fs';
import { frames } from '../../../src/games/prismcourier/chambers.js';
import { opening,search,advance } from '../../../src/games/prismcourier/maze.js';

// Choose goals once, during authoring. Only source boards change the shipped
// chambers. The daily can draw from four independently certified alternatives.
const book=frames.map(room=>{
  const start=opening(room),options={collect:true,min:1,max:room.target+7};
  const all=search(room,start,s=>s.a!==start.a&&s.b!==start.b&&(s.seals&room.need)===room.need&&(!room.exchange||s.swapped),options);
  const unique=new Map();
  for(const dest of all){
    const {a,b}=dest.state,key=a+'/'+b;
    if(unique.has(key))continue;
    unique.set(key,dest);
  }
  let pool=[...unique.values()];
  if(room.id===0)pool=pool.filter(v=>v.state.a===start.a+1 && v.state.b===start.b-1);
  if(room.id===32)pool=pool.filter(v=>v.state.b%5>=3);
  if(room.id===33)pool=pool.filter(v=>v.state.a%5>=3);
  if(room.gallery===3) {
    const icy=pool.filter(dest=>{
      let s=start;
      for(const k of dest.path()){
        const n=advance(room,s,k);
        if(Math.abs(n.b%5-s.b%5)+Math.abs(Math.floor(n.b/5)-Math.floor(s.b/5))>1)return true;
        s=n;
      }
      return false;
    });
    if(icy.length)pool=icy;
  }
  const ranked=pool.sort((a,b)=>Math.abs(a.depth-room.target)-Math.abs(b.depth-room.target) ||
    Math.abs(b.state.a-b.state.b)-Math.abs(a.state.a-a.state.b));
  if(room.id===17){
    // This landing pair is the teaching case: resting finishes a beat earlier
    // than any witness made solely of directional inputs.
    const index=ranked.findIndex(v=>v.state.a===12&&v.state.b===19);
    if(index<0)throw Error('Rest lesson missing');
    ranked.unshift(...ranked.splice(index,1));
  }
  if(!ranked.length)throw Error('No reachable destination for '+room.name);
  return ranked.slice(0,5).map(dest=>{
    const goal=[dest.state.a,dest.state.b],path=search({...room,goal}), end=path.reduce((s,m)=>advance(room,s,m),start);
    if(end.a!==goal[0]||end.b!==goal[1])throw Error(room.name);
    return {goal,par:path.length,witness:path.join('')};
  });
});
writeFileSync(new URL('../../../src/games/prismcourier/cues.json',import.meta.url),JSON.stringify(book)+'\n');
console.log(book.map((rows,i)=>frames[i].name+' '+rows[0].par).join(' · '));
