// A nudge moves the cat away. A whispered call only reaches down a clear row
// or column. On low-friction caps, the cat keeps its momentum until ordinary ground.
export const desks=[
  {name:'One last email', layout:['.....','.....','.....','..#..','.....'],start:[10,11],goal:13},
  {name:'Midnight editor',layout:['..#..','.....','..#..','.#...','.....'],start:[20,4],depth:4},
  {name:'A slippery shortcut',layout:['.....','.#~..','..~..','.#...','.....'],start:[20,4],goals:[12,17,11]},
  {name:'The number pad',layout:['..#..','...#.','.~~..','.#.#.','.....'],start:[4,20],goals:[24,13,7]},
  {name:'Caps lock',layout:['.....','.##..','.~~..','.#.#.','.....'],start:[0,24],goals:[10,5,0]},
  {name:'Goodnight, AGI',layout:['.....','.#.#.','..~~.','.#.#.','.....'],start:[24,0],goals:[14,22,19]},
];
const delta=[[0,-1],[1,0],[0,1],[-1,0]];
export function step(layout,pos,dir){
  const [dx,dy]=delta[dir],x=pos%5+dx,y=Math.floor(pos/5)+dy;
  return x<0||y<0||x>=5||y>=5||layout[y][x]==='#'?pos:y*5+x;
}
function skitter(layout,cat,dir,her){
  let next=step(layout,cat,dir);if(next===her)return cat;
  while(next!==cat && layout[Math.floor(next/5)][next%5]==='~'){
    const after=step(layout,next,dir);if(after===next||after===her)break;next=after;
  }return next;
}
export function command(layout,state,action){
  const [her,cat]=state;
  if(action<4){
    const dest=step(layout,her,action);
    if(dest!==cat)return [dest,cat];
    const nextCat=skitter(layout,cat,action,dest);
    return nextCat===cat?state:[dest,nextCat];
  }
  const dx=her%5-cat%5,dy=Math.floor(her/5)-Math.floor(cat/5);
  if((dx&&dy)||Math.abs(dx)+Math.abs(dy)<=1)return state;
  const dir=dx?dx>0?1:3:dy>0?2:0;
  let cell=cat;
  for(let i=0;i<5&&cell!==her;i++){const next=step(layout,cell,dir);if(next===cell)return state;cell=next;}
  return [her,skitter(layout,cat,dir,her)];
}
export function paths(layout,start,goal=null,call=true){
  const queue=[[start,[]]],seen=new Set([start.join()]),landings=new Map();
  for(let i=0;i<queue.length;i++){
    const [state,path]=queue[i];
    if(state[1]===goal)return path;
    if(!landings.has(state[1]))landings.set(state[1],path);
    for(let a=0;a<(call?5:4);a++){
      const next=command(layout,state,a),key=next.join();if(!seen.has(key)){seen.add(key);queue.push([next,[...path,a]]);}
    }
  }
  return goal==null?landings:null;
}
export function targets(desk){
  const reach=paths(desk.layout,desk.start);if(desk.goal!=null)return [[desk.goal,reach.get(desk.goal)]];
  if(desk.goals)return desk.goals.map(tile=>[tile,reach.get(tile)]);
  const noCall=paths(desk.layout,desk.start,null,false);
  return [...reach].filter(([tile,path])=>tile!==desk.start[1]&&path.includes(4)&&!noCall.has(tile))
   .sort((a,b)=>Math.abs(a[1].length-desk.depth)-Math.abs(b[1].length-desk.depth));
}
