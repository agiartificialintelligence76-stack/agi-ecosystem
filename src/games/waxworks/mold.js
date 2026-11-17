const molds = [
  ['Candle stair', [[1,2,3],[1,2,2],[1,1,1]]],
  ['Twin chimneys', [[3,1,3],[2,0,2],[1,1,1]]],
  ['River ribbon', [[1,2,1,0],[1,2,3,1],[0,1,3,2],[0,0,1,2]]],
  ['Bell tower', [[0,2,2,0],[1,3,4,1],[1,3,3,1],[0,1,1,0]]],
  ['Sea fan', [[0,1,1,1],[0,2,3,2],[1,3,4,1],[3,2,1,0]]],
  ['Paper lantern', [[0,1,1,0],[2,4,3,2],[2,3,4,1],[0,2,2,0]]],
];
export const pieceCount=molds.length;
export function profiles(board) {
  return {front:board[0].map((_,x)=>Math.max(...board.map(row=>row[x]))), side:board.map(row=>Math.max(...row))};
}
export function makeMold(stage,random) {
  const [name,form]=molds[stage], n=form.length;
  const goal=form.map(row=>row.slice());
  if(stage&&random()>.5)goal.reverse();
  if(stage&&random()>.5)goal.forEach(row=>row.reverse());
  const board=goal.map(row=>row.slice());
  const cells=board.flatMap((row,r)=>row.map((_,x)=>({r,x})));
  for(let i=cells.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[cells[i],cells[j]]=[cells[j],cells[i]];}
  const changes=stage<2?2:3+Math.floor(stage/2);
  const low=cells.filter(({r,x})=>goal[r][x]>0).slice(0,changes);
  const high=cells.filter(p=>!low.includes(p)).slice(0,changes-1);
  low.forEach(({r,x})=>board[r][x]--);
  high.forEach(({r,x})=>board[r][x]++);
  // The signed cells are the commission's wax seals. Other interior heights may vary.
  const seals=[...low.slice(0,stage<2?1:2),high[0]].filter(Boolean);
  return {stage,n,name,goal,board,seals,plates:profiles(goal),pot:low.length-high.length,moves:0,history:[],par:low.length+high.length};
}
export function matches(m) {
  const p=profiles(m.board);
  return m.pot===0 && ['front','side'].every(axis=>p[axis].every((v,i)=>v===m.plates[axis][i]))
    && m.seals.every(({r,x})=>m.board[r][x]===m.goal[r][x]);
}
export function toolStroke(m,r,x,tool) {
  const h=m.board[r][x], batch=[];
  if(tool==='pour'&&m.pot>0&&h<5)batch.push([r,x,1]);
  if(tool==='chisel'&&h>0)batch.push([r,x,-1]);
  if(tool==='wire'){
    const tallest=Math.max(...m.board[r]);
    if(tallest>0)m.board[r].forEach((v,col)=>{if(v===tallest)batch.push([r,col,-1]);});
  }
  if(!batch.length)return false;
  for(const [row,col,d] of batch){m.board[row][col]+=d;m.pot-=d;}
  m.history.push(batch);m.moves++;return true;
}
export function undo(m) {
  const batch=m.history.pop();if(!batch)return;
  for(const [r,x,d] of batch){m.board[r][x]-=d;m.pot+=d;}
  m.moves--;
}
