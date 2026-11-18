export const DEPOTS=[
 {name:'Packing room',note:'tip me into the open hatch.',rows:['.......','####...','A#####.','#######','...###.','...#G#.']},
 {name:'Fragile things',note:'the tissue holds me lying down.',rows:['####...','A##!###','####!!#','..##!##','..####G','...####']},
 {name:'The drawbridge',note:'stand me on the brass button first.',rows:['A###...','####...','##S#...','###=###','....###','....##G']},
 {name:'One-way label',note:'leave my corner stickers intact, please.',rows:['..#####','.#!#!!#','A###.##','###..#G','.####!#','.######']},
 {name:'Night dispatch',note:'our bridge remembers the last press.',rows:['####...','##SA...','####...','..#=###','..#.##G','..#####']},
 {name:'Display window',note:'my display slot is by the window.',rows:['..#####','###!!##','##A#.##','..##!##','...#!!#','..G####']},
];
const dirs={N:[0,-1],E:[1,0],S:[0,1],W:[-1,0]};
export function startDepot(level){
 const rows=level.rows;const y=rows.findIndex(row=>row.includes('A'));
 return {x:rows[y].indexOf('A'),y,o:'up',bridge:false};
}
export function footprint(p){
 return p.o==='x'?[[p.x,p.y],[p.x+1,p.y]]:p.o==='y'?[[p.x,p.y],[p.x,p.y+1]]:[[p.x,p.y]];
}
export function roll(level,p,dir){
 const [dx,dy]=dirs[dir];let {x,y,o,bridge}=p;
 if(o==='up'){
   o=dx?'x':'y';x+=dx<0?-2:dx;y+=dy<0?-2:dy;
 }else if((o==='x'&&dx)||(o==='y'&&dy)){
   o='up';x+=dx>0?2:dx;y+=dy>0?2:dy;
 }else{x+=dx;y+=dy;}
 const next={x,y,o,bridge};
 for(const [tx,ty] of footprint(next)){
   const tile=level.rows[ty]?.[tx];
   if(!tile||tile==='.'||(tile==='!'&&o==='up')||(tile==='='&&!bridge))return null;
 }
 if(o==='up'&&level.rows[y][x]==='S')next.bridge=!bridge;
 return next;
}
export const delivered=(level,p)=>p.o==='up'&&level.rows[p.y][p.x]==='G';
export function route(level,start=startDepot(level)){
 const queue=[[start,[]]],seen=new Set();
 for(let i=0;i<queue.length;i++){const [state,path]=queue[i],key=[state.x,state.y,state.o,state.bridge].join();
   if(seen.has(key))continue;seen.add(key);if(delivered(level,state))return path;
   for(const d of Object.keys(dirs)){const next=roll(level,state,d);if(next)queue.push([next,[...path,d]]);}
 }return null;
}
