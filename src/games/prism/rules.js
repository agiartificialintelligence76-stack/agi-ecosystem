// Light is additive: R=1, G=2, B=4. Every ray is bounded by its cell/direction/color state.
export const SIZE = 7;
export const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const refl = [[3, 2, 1, 0], [1, 0, 3, 2]];
const tile = (x, y, type, extra = {}) => ({ x, y, type, ...extra });
const turn = (p, q) => { let x = p.x, y = p.y; for (let i=0;i<q;i++) [x,y]=[6-y,x]; return {...p,x,y,...(p.dir!=null?{dir:(p.dir+q)%4}:{}),...(p.type==='mirror'?{rot:(p.rot+q)%2}:{})}; };
const templates = [
  { name:'First reflection', sources:[tile(0,3,'source',{dir:0,color:1})], optics:[tile(3,3,'mirror',{rot:0})], targets:[tile(3,0,'receiver',{color:1})] },
  { name:'Double take', sources:[tile(0,4,'source',{dir:0,color:2})], optics:[tile(2,4,'mirror',{rot:0}),tile(2,1,'mirror',{rot:0})], targets:[tile(6,1,'receiver',{color:2})] },
  { name:'The long way', sources:[tile(0,5,'source',{dir:0,color:4})], optics:[tile(2,5,'mirror',{rot:0}),tile(2,1,'mirror',{rot:0}),tile(5,1,'mirror',{rot:1}),tile(5,4,'mirror',{rot:0})], targets:[tile(0,4,'receiver',{color:4})] },
  { name:'Three little lights', sources:[tile(0,3,'source',{dir:0,color:7})], optics:[tile(3,3,'prism',{rot:0}),tile(3,1,'mirror',{rot:0}),tile(3,5,'mirror',{rot:1})], targets:[tile(6,1,'receiver',{color:1}),tile(6,3,'receiver',{color:2}),tile(6,5,'receiver',{color:4})] },
  { name:'Meet in violet', sources:[tile(0,1,'source',{dir:0,color:1}),tile(2,6,'source',{dir:3,color:4})], optics:[tile(3,1,'mirror',{rot:1}),tile(3,3,'mirror',{rot:1}),tile(2,5,'mirror',{rot:0}),tile(6,5,'mirror',{rot:0})], targets:[tile(6,3,'receiver',{color:5})] },
  { name:'Pure spectrum', sources:[tile(0,3,'source',{dir:0,color:7})], optics:[tile(2,3,'prism',{rot:0}),tile(2,1,'mirror',{rot:0}),tile(5,1,'mirror',{rot:1}),tile(2,5,'mirror',{rot:1}),tile(4,5,'mirror',{rot:1})], targets:[tile(5,2,'receiver',{color:1}),tile(6,3,'receiver',{color:2}),tile(4,6,'receiver',{color:4})] },
];
export const LEVELS = Array.from({length:18}, (_,i) => {
  const template = templates[Math.min(5, Math.floor(i/3))], q=i%3;
  const solution=template.optics.map((t,j)=>({...turn(t,q),id:j,movable:i>=12&&j===0}));
  const optics=solution.map((t,j)=>({...t,...(t.movable?turn({...template.optics[j],x:template.optics[j].x+1},q):{}),rot:t.type==='mirror'?1-t.rot:(t.rot+1+j%2)%3}));
  const obstacles=[tile(0,0,'block'),tile(6,6,'block'),tile(1,0,'block')].map(t=>turn(t,q));
  return {id:i,name:template.name,chapter:i<9?'REFLECTION':i<12?'SPLIT':i<15?'MIX':'SPECTRUM',sources:template.sources.map(t=>turn(t,q)),targets:template.targets.map(t=>turn(t,q)),obstacles,optics,solution,par:optics.length+1+(i>=12?1:0)};
});
export function createBoard(index=0) { const def=LEVELS[Math.max(0,Math.min(LEVELS.length-1,index))]; return {index:def.id,optics:def.optics.map(t=>({...t})),moves:0,hints:0}; }
export function rotate(board,id) { const t=board.optics.find(t=>t.id===id); if(!t)return false; t.rot=(t.rot+1)%(t.type==='prism'?3:2);board.moves++;return true; }
export function moveOptic(board,id,x,y) {
  const t=board.optics.find(t=>t.id===id),def=LEVELS[board.index];
  if(!t?.movable||!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=SIZE||y>=SIZE||[...board.optics,...def.sources,...def.targets,...def.obstacles].some(o=>o!==t&&o.x===x&&o.y===y))return false;
  if(t.x===x&&t.y===y)return false;t.x=x;t.y=y;board.moves++;return true;
}
export function hint(board) {
  const target=LEVELS[board.index].solution.find(t=>{const o=board.optics.find(o=>o.id===t.id);return o.x!==t.x||o.y!==t.y||o.rot!==t.rot;});
  if(!target)return null;Object.assign(board.optics.find(o=>o.id===target.id),target);board.moves++;board.hints++;return target.id;
}
export function trace(board) {
  const def=LEVELS[board.index],received=def.targets.map(()=>0),segments=[],visited=new Set();
  const queue=def.sources.map(s=>({x:s.x,y:s.y,dir:s.dir,color:s.color}));
  while(queue.length) {
    const ray=queue.shift(); let {x,y,dir,color}=ray;
    for(let n=0;n<196;n++) {
      const key=`${x},${y},${dir},${color}`;if(visited.has(key))break;visited.add(key);
      const [dx,dy]=DIRS[dir],nx=x+dx,ny=y+dy;
      if(nx<0||ny<0||nx>=SIZE||ny>=SIZE)break;
      segments.push({x,y,nx,ny,color});x=nx;y=ny;
      if(def.obstacles.some(o=>o.x===x&&o.y===y))break;
      const target=def.targets.findIndex(t=>t.x===x&&t.y===y);
      if(target>=0){received[target]|=color;break;}
      if(def.sources.some(s=>s.x===x&&s.y===y))break;
      const optic=board.optics.find(o=>o.x===x&&o.y===y);if(!optic)continue;
      if(optic.type==='mirror'){dir=refl[optic.rot][dir];continue;}
      if(optic.type==='prism'){
        [1,2,4].forEach((bit,j)=>{if(color&bit)queue.push({x,y,dir:(dir+((j+optic.rot)%3)-1+4)%4,color:bit});});break;
      }
    }
  }
  return {segments,received,lit:received.filter((c,i)=>c===def.targets[i].color).length,won:received.every((c,i)=>c===def.targets[i].color)};
}
export const starsFor = board => board.hints ? 1 : board.moves<=LEVELS[board.index].par ? 3 : 2;
