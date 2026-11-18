// Both performers move from the same snapshot. A previous arrow matters only
// in a delay room. A latched signature and swapped assignments persist.
export const arrows=['↑','→','↓','←','·','⇄'];
export const names=['Up','Right','Down','Left','Rest','Exchange'];
export const DELTA=[[0,-1],[1,0],[0,1],[-1,0],[0,0]];
export const transforms={mirror:[0,3,2,1],right:[1,2,3,0],left:[3,0,1,2],reverse:[2,3,0,1],same:[0,1,2,3]};
export const opening=room=>({a:room.start[0],b:room.start[1],previous:4,swapped:0,seals:0});
export const isHome=(room,s)=>s.a===room.goal[0]&&s.b===room.goal[1]&&
  (s.seals&room.need)===room.need && (!room.exchange || s.swapped===1);
const code=s=>((((s.a*36+s.b)*5+s.previous)*2+s.swapped)*4+s.seals);
function neighbor(room,from,dir){
  const [dx,dy]=DELTA[dir],x=from%room.size+dx,y=Math.floor(from/room.size)+dy;
  return x<0||y<0||x>=room.size||y>=room.size?-1:y*room.size+x;
}
function travel(room,side,pos,dir,seals) {
  if(dir>=4)return pos;
  const tiles=room.boards[side];
  let at=pos;
  for(let i=0;i<room.size;i++){
    const n=neighbor(room,at,dir),tile=tiles[n];
    if(n<0 || tile==='#' || (tile==='D' && !(seals & (1<<(1-side))))) break;
    at=n;if(tile!=='~')break;
  }
  return at;
}
export function advance(room,s,action){
  if(action===5){
    if(room.boards[0][s.a]!=='R' && room.boards[1][s.b]!=='R')return s;
    return {...s,swapped:1-s.swapped};
  }
  if(action<0||action>4||action===4&&!room.delay)return s;
  const input=room.delay?s.previous:action;
  const other=input===4?4:transforms[room.transform][input];
  const a=travel(room,0,s.a,s.swapped?other:action,s.seals);
  const b=travel(room,1,s.b,s.swapped?action:other,s.seals);
  const seals=s.seals|(room.boards[0][a]==='P'?1:0)|(room.boards[1][b]==='P'?2:0);
  const previous=room.delay?action:4;
  if(a===s.a&&b===s.b&&seals===s.seals&&previous===s.previous)return s;
  return {a,b,seals,previous,swapped:s.swapped};
}
export function moves(room){
  const list=[0,1,2,3];if(room.delay)list.push(4);if(room.boards.some(b=>b.includes('R')))list.push(5);return list;
}
// Breadth-first search over the full joint state. A predecessor index and one
// command per visited node let hints recover a true optimum without storing paths.
export function search(room,start=opening(room),goal=s=>isHome(room,s),options={}) {
  const states=[start],parents=[-1],inputs=[-1],depths=[0],seen=new Set([code(start)]);
  const commands=moves(room).filter(a=>a!==options.omit),limit=options.max??Infinity;
  const candidates=[];
  const path=i=>{const out=[];while(parents[i]>=0){out.push(inputs[i]);i=parents[i];}return out.reverse();};
  for(let i=0;i<states.length;i++){
    if(goal(states[i]) && (!options.collect || depths[i]>=options.min)) {
      if(!options.collect)return path(i);
      candidates.push(i);
    }
    if(depths[i]>=limit)continue;
    for(const input of commands){
      const next=advance(room,states[i],input),key=code(next);
      if(seen.has(key))continue;
      seen.add(key);parents.push(i);inputs.push(input);states.push(next);depths.push(depths[i]+1);
    }
  }
  return options.collect ? candidates.map(i=>({state:states[i],depth:depths[i],path:()=>path(i)})) : null;
}
export function stars(par,length){return length<=par?3:length<=par+2?2:1;}
