export const STEP_LIMIT=20;
export const MOVES={right:[1,0],down:[0,1],left:[-1,0],up:[0,-1],wait:[0,0]};
const rooms=[
  {name:'Meet yourself',rows:['#######','#S.#..#','#.a#.*#','#..A.E#','#..#..#','#..#..#','#######'],slots:1},
  {name:'The long goodbye',rows:['#########','#S..#.*.#','#.#.#.#.#','#.a.A..E#','#...#.#.#','#.*.#...#','#########'],slots:1},
  {name:'Hold that thought',rows:['#########','#S.*#...#','#.#.#.#*#','#...A..E#','##a##.#.#','#...#...#','#########'],slots:1},
  {name:'A second you',rows:['#########','#S.#.#.*#','#.a#b#..#','#..A.B.E#','#.*#.#..#','#..#.#..#','#########'],slots:2},
  {name:'Passing the moment',rows:['#########','#S.#.#.*#','#..#b#..#','#..A.B.E#','#.a#.#..#','#.*#.#..#','#########'],slots:2},
  {name:'Our little paradox',rows:['###########','#S..#.#.*.#','#.#a#b#.#.#','#...A.B..E#','#.*.#.#.#.#','#...#.#...#','###########'],slots:2},
];
export const LEVELS=rooms.flatMap((r,i)=>[{...r,id:i*2},{...r,id:i*2+1,name:`${r.name} · reflection`,rows:r.rows.map(s=>[...s].reverse().join(''))}]);
export function parse(index){const d=LEVELS[index],out={...d,w:d.rows[0].length,h:d.rows.length,plates:{},gates:{},crystals:[]};d.rows.forEach((s,y)=>[...s].forEach((v,x)=>{if(v==='S')out.start={x,y};if(v==='E')out.exit={x,y};if(v==='a'||v==='b')out.plates[v]={x,y};if(v==='A'||v==='B')out.gates[v.toLowerCase()]={x,y};if(v==='*')out.crystals.push({x,y});}));return out;}
export function createRoom(index=0){const def=parse(Math.max(0,Math.min(LEVELS.length-1,index)));return {index:def.id,player:{...def.start},echoes:[],tape:[],tick:0,turns:0,loops:0,collected:0,won:false};}
export function echoPositions(w){const start=parse(w.index).start;return w.echoes.map(t=>w.tick===0?start:t[Math.min(w.tick-1,t.length-1)]||start);}
export function gateOpen(w,key,positions=echoPositions(w)){const p=parse(w.index).plates[key];return !!p&&[w.player,...positions].some(o=>o.x===p.x&&o.y===p.y);}
export function advance(w,dir){if(w.won||!MOVES[dir])return false;const def=parse(w.index),[dx,dy]=MOVES[dir];w.tick++;w.turns++;const nx=w.player.x+dx,ny=w.player.y+dy,cell=def.rows[ny]?.[nx];const walk=cell&&cell!=='#'&&(!/[AB]/.test(cell)||gateOpen(w,cell.toLowerCase()));if(walk)w.player={x:nx,y:ny};if(w.tape.length<STEP_LIMIT)w.tape.push({...w.player});def.crystals.forEach((p,i)=>{if(p.x===w.player.x&&p.y===w.player.y)w.collected|=1<<i;});w.won=w.player.x===def.exit.x&&w.player.y===def.exit.y&&w.collected===(1<<def.crystals.length)-1;return !!walk;}
export function rewind(w){const def=parse(w.index);if(w.won||!w.tape.length||w.echoes.length>=def.slots)return false;w.echoes.push(w.tape.map(p=>({...p})));w.tape=[];w.player={...def.start};w.tick=0;w.collected=0;w.loops++;return true;}
export function plan(w,target=null){
  const def=parse(w.index),queue=[{state:structuredClone(w),path:[]}],seen=new Set();
  const maxEcho=Math.max(0,...w.echoes.map(e=>e.length));
  for(let i=0;i<queue.length&&i<25000;i++){
    const {state:s,path}=queue[i];
    if(target?s.player.x===target.x&&s.player.y===target.y:s.won)return path;
    for(const dir of Object.keys(MOVES)){
      const n=structuredClone(s);advance(n,dir);
      const key=`${n.player.x},${n.player.y},${Math.min(n.tick,maxEcho)},${n.collected}`;
      if(seen.has(key))continue;seen.add(key);queue.push({state:n,path:[...path,dir]});
    }
  }
  return null;
}
export function reference(index){const w=createRoom(index),def=parse(index),actions=[];for(const key of Object.keys(def.plates).sort()){
  const path=plan(w,def.plates[key]);if(!path||path.length>STEP_LIMIT)return null;
  for(const action of path){advance(w,action);actions.push(action);}rewind(w);actions.push('rewind');
}const final=plan(w);if(!final)return null;return [...actions,...final];}
export function starsFor(w){const best=reference(w.index)?.length||30;return w.turns<=best?3:w.turns<=best*1.5?2:1;}
