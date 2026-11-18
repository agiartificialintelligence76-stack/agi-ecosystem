export const SCENES=[
 {name:'First entrance',rows:['.....','.A*G.','.....'],facing:1,budget:3, cue:'walk through the rose into my light.'},
 {name:'The balcony',rows:['.##G.','.#.*.','.A##.','.....'],facing:1,budget:7,cue:'turn on your mark. i’ll take the stairs.'},
 {name:'Trapdoor tango',rows:['.....','A.*#G','.....'],facing:1,budget:4,cue:'give me a leap over that open trap.'},
 {name:'Mirror rehearsal',rows:['...G.','...*.','.A#M.','.....'],facing:1,budget:6,cue:'the silver turntable spins me left.'},
 {name:'Double bouquet',rows:['.*#G.','.#.#.','.A*M.','.....'],facing:0,budget:12,cue:'both flowers. i promised the front row.'},
 {name:'The final bow',rows:['G#.*.','...#.','A*#M.','.....'],facing:1,budget:12,cue:'two roses, a trapdoor and one big finish.'},
];
export const CUES=['STEP','LEFT','RIGHT','LEAP'];
export const VECTORS=[[0,-1],[1,0],[0,1],[-1,0]];
export function rehearsal(scene){
 const y=scene.rows.findIndex(r=>r.includes('A'));
 let roses=[];scene.rows.forEach((r,j)=>[...r].forEach((s,i)=>{if(s==='*')roses.push([i,j]);}));
 return {x:scene.rows[y].indexOf('A'),y,d:scene.facing,roses:0,marks:roses};
}
export function perform(scene,p,command){
 if(command==='LEFT'||command==='RIGHT')return {...p,d:(p.d+(command==='LEFT'?3:1))%4};
 const [dx,dy]=VECTORS[p.d],n=command==='LEAP'?2:1,x=p.x+dx*n,y=p.y+dy*n;
 const cell=scene.rows[y]?.[x];
 if(!cell||cell==='.')return null;
 const index=p.marks.findIndex(([a,b])=>a===x&&b===y);
 return {...p,x,y,d:cell==='M'?(p.d+3)%4:p.d,roses:index>=0?p.roses|(1<<index):p.roses};
}
export const complete=(scene,p)=>scene.rows[p.y][p.x]==='G'&&p.roses===(1<<p.marks.length)-1;
export function solve(scene,initial=rehearsal(scene)){
 const queue=[[initial,[]]],seen=new Set();
 for(let i=0;i<queue.length;i++){const [p,path]=queue[i];const key=[p.x,p.y,p.d,p.roses].join();
   if(seen.has(key))continue;seen.add(key);if(complete(scene,p))return path;if(path.length>=scene.budget)continue;
   for(const cue of CUES){const next=perform(scene,p,cue);if(next)queue.push([next,[...path,cue]]);}
 }return null;
}
