export const rooms=[
  {name:'The guestbook',file:'a pressed rose',map:['#...###','#.p##.#','#.SgDE#','#..##.#','##..###'],script:[0],cap:4},
  {name:'Camera obscura',file:'her first camera roll',map:['#######','#p..###','#S.#DE#','#.g! .#','#######'],script:[0,4,2],cap:5},
  {name:'Double booking',file:'a torn concert ticket',map:['#######','#p.q###','#.SgD##','###.hE#','#######'],script:[0,3,1,1],cap:6},
  {name:'The private stacks',file:'her radio transcript',map:['#######','#pSq###','##g####','#D.!hE#','#######'],script:[3,4,1,1],cap:6},
  {name:'Last known address',file:'two pages of her diary',map:['#######','#p.q###','#.SgD##','###h!D#','####E.#'],script:[0,3,4,1,1],cap:7},
];
export const symbols=['↑','→','↓','←','•'];
const delta=[[0,-1],[1,0],[0,1],[-1,0],[0,0]];
export function indexRoom(room){
  const cells=room.map.join('').replaceAll(' ','.');
  return {...room,cells,start:cells.indexOf('S'),exit:cells.indexOf('E'),diaries:[...cells].flatMap((v,i)=>v==='D'?[i]:[]),pads:[cells.indexOf('p'),cells.indexOf('q')]};
}
export function step(pos,action,cells){
  const [dx,dy]=delta[action],x=pos%7+dx,y=Math.floor(pos/7)+dy;
  if(x<0||x>=7||y<0||y>=5||cells[y*7+x]==='#')return pos;
  return y*7+x;
}
export function record(room,script){
  let pos=room.start;return script.map(a=>pos=step(pos,a,room.cells));
}
export function advance(room,tape,[pos,phase,mask],action){
  const ghost=tape[phase],dst=step(pos,action,room.cells),tile=room.cells[dst];
  const locked=(tile==='g'&&ghost!==room.pads[0])||(tile==='h'&&ghost!==room.pads[1])||(tile==='!'&&phase%3===0);
  const next=locked?pos:dst,diary=room.diaries.indexOf(next);
  return [next,(phase+1)%tape.length,diary>=0?mask|(1<<diary):mask];
}
export const cleared=(room,s)=>s[0]===room.exit&&s[2]===(1<<room.diaries.length)-1;
export function solve(room,tape,start=[room.start,0,0]){
  if(!tape.length)return null;
  const queue=[[start,[]]],seen=new Set([start.join()]);
  for(let i=0;i<queue.length;i++){
    const [state,path]=queue[i];if(cleared(room,state))return path;
    for(let a=0;a<5;a++){
      const next=advance(room,tape,state,a),key=next.join();if(seen.has(key))continue;
      seen.add(key);queue.push([next,[...path,a]]);
    }
  }return null;
}
