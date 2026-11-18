// The blue projection obeys the mirror's current orientation. A wall can stop one
// projection while the other moves, so they may lose (or regain) alignment.
export const directions = [[0,-1],[1,0],[0,1],[-1,0]];
export const arrows = ['↑','→','↓','←','◇'];
export const mirrors = [
  { name:'First reflection', axes:[0,3,2,1], rule:'Blue mirrors left and right', left:['.....','.#.#.','.....','.#.#.','.....'], right:['.....','...#.','.#...','...#.','.....'], starts:[20,24], depth:4 },
  { name:'Afterimage', axes:[2,1,0,3], rule:'Blue mirrors up and down', left:['.#...','...#.','.#...','...#.','.#...'], right:['...#.','.#...','.....','.#.#.','.....'], starts:[0,20], depth:7 },
  { name:'Quarter turn', axes:[1,2,3,0], rule:'Blue turns clockwise', left:['.....','.#.#.','..*..','##.#.','.....'], right:['.#...','...#.','..*..','.#.#.','.....'], starts:[0,24], depth:9 },
  { name:'Negative space', axes:[2,3,0,1], rule:'Blue travels in reverse', left:['.....','.#.#.','...#.','.#*..','.....'], right:['.....','##.#.','...*.','.#.#.','.....'], starts:[20,4], depth:11 },
  { name:'Double exposure', axes:[3,0,1,2], rule:'Blue turns counterclockwise', left:['..#..','.*#..','.....','.#.#.','.....'], right:['.....','.#.#.','..*..','.#.##','.....'], starts:[20,24], depth:14 },
  { name:'The real me', axes:[0,3,2,1], rule:'Blue mirrors left and right', left:['.#...','.*.#.','.....','.#.##','.....'], right:['.....','##.#.','..#*.','.....','.#.#.'], starts:[24,0], depth:16 },
];
function slide(board,pos,dir) {
  const [dx,dy]=directions[dir], x=pos%5+dx, y=Math.floor(pos/5)+dy;
  return x<0 || y<0 || x>=5 || y>=5 || board[y][x]==='#' ? pos : y*5+x;
}
const at=(board,pos)=>board[Math.floor(pos/5)][pos%5];
export function shift(room,state,action) {
  const [a,b,phase]=state;
  if(action===4) return at(room.left,a)==='*' || at(room.right,b)==='*' ? [a,b,1-phase] : state;
  return [slide(room.left,a,action),slide(room.right,b,phase?(room.axes[action]+2)%4:room.axes[action]),phase];
}
export function reach(room,start,goal=null) {
  const queue=[{state:start,path:[]}], seen=new Set([start.join()]); const docks=[];
  for(let i=0;i<queue.length;i++) {
    const {state,path}=queue[i];
    if(goal && state.every((v,k)=>v===goal[k])) return path;
    if(!goal && path.length>=room.depth && path.some(a=>a===1||a===3) && path.some(a=>a===0||a===2)
      && state[0]!==start[0] && state[1]!==start[1]
      && (!room.left.join('').includes('*') || (state[2] && path.includes(4)))) docks.push({state,path});
    for(let action=0;action<5;action++) {
      const next=shift(room,state,action), key=next.join();
      if(!seen.has(key)){seen.add(key);queue.push({state:next,path:[...path,action]});}
    }
  }
  return goal ? null : docks.sort((a,b)=>Math.abs(a.path.length-room.depth)-Math.abs(b.path.length-room.depth));
}
