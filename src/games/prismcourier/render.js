import { layout,cellPoint } from './layout.js';
import { galleries } from './chambers.js';
import { arrows,advance } from './maze.js';
import { dancer } from './performers.js';
import { roundRect,star } from '../kit/fx.js';
import { line,oval,polygon } from '../kit/illustration.js';

const ink='#24152f',night='#352044',gold='#ffe07e',paper='#fff4d9';
const twins=[
 {name:'CORAL',key:'I',wall:'#db7189',edge:'#ffa6ae',floor:'#ffe3d8',light:'#fff0dc',glow:'#f05875'},
 {name:'CYAN',key:'II',wall:'#578eae',edge:'#96e2ea',floor:'#dcebe9',light:'#ecf5e7',glow:'#308dab'},
];
function panel(c,x,y,w,h,r,fill,border=ink,weight=2){
  roundRect(c,x,y,w,h,r);c.fillStyle=fill;c.fill();if(border){c.strokeStyle=border;c.lineWidth=weight;c.stroke();}
}
function label(c,str,x,y,size,fill=ink,align='left',limit,display=false){
  c.font=(display?'900 ':'700 ')+size+"px 'AK "+(display?'Display':'Sans')+"',system-ui";
  c.fillStyle=fill;c.textAlign=align;c.textBaseline='middle';
  if(limit>0)c.fillText(str,x,y,limit);else c.fillText(str,x,y);
}
function gem(c,x,y,r,fill){
 polygon(c,[[x,y-r],[x+r*.8,y],[x,y+r],[x-r*.8,y]],fill,ink,1.6);
}
function tile(c,box,n,kind,side,s) {
 const t=box.size/5, [x,y]=cellPoint(box,n),p=twins[side],left=x-t/2,top=y-t/2;
 c.fillStyle=(n%2)?p.floor:p.light;c.fillRect(left,top,t,t);
 c.strokeStyle='#472b431f';c.lineWidth=1;c.strokeRect(left+.5,top+.5,t-1,t-1);
 if(kind==='.'){
   const gap=t*.06;
   line(c,[[left+gap,top+t*.3],[left+gap,top+gap],[left+t*.32,top+gap]],p.light,Math.max(1,t*.028));
   line(c,[[left+t*.7,top+t-gap],[left+t-gap,top+t-gap],[left+t-gap,top+t*.7]],p.edge,Math.max(1,t*.018));
 }
 if(kind==='#'){
   polygon(c,[[left+2,top+2],[left+t-2,top+2],[left+t-2,top+t*.73],[left+t*.73,top+t-2],[left+2,top+t-2]],p.wall,ink,1.5);
   polygon(c,[[left+3,top+3],[left+t*.88,top+3],[left+t*.3,top+t*.72]],p.edge);
   line(c,[[left+3,top+t-3],[left+t*.3,top+t*.72],[left+t*.88,top+3]],p.light,1.3);
 } else if(kind==='~'){
   c.fillStyle='#a8d9eb';c.fillRect(left+1,top+1,t-2,t-2);
   for(let k=1;k<4;k++)line(c,[[left+t*k/5,top+t*.75],[left+t*(k+1)/5,top+t*.35]],'#f2ffff',2);
 } else if(kind==='P'){panel(c,x-t*.32,y-t*.18,t*.64,t*.36,t*.1,s.seals&(1<<side)?gold:p.edge);label(c,p.key,x,y,Math.max(12,t*.24));}
 else if(kind==='R'){gem(c,x,y,t*.37,gold);label(c,'⇄',x,y,Math.max(12,t*.4),ink,'center');}
 else if(kind==='D'){
   const open=s.seals&(1<<(1-side));
   for(let k=1;k<(open?2:5);k++)line(c,[[left+t*k/5,top+2],[left+t*k/5,top+t-2]],open?'#b4957b':ink,open?2:4);
   if(!open)gem(c,x,y,t*.15,twins[1-side].edge);
 }
}
function ring(c,x,y,r,side,occupied,time,reduced){
 const p=twins[side],pulse=reduced?1:1+Math.sin(time*3.8)*.055;
 oval(c,x,y,r*pulse,r*pulse,occupied?gold:p.edge,ink,2);
 star(c,x,y,r*.65,r*.30,4,side?Math.PI/4:0);c.fillStyle=occupied?ink:paper;c.fill();c.strokeStyle=ink;c.lineWidth=1;c.stroke();
}
function board(c,box,room,side,view){
 const {take,from,tween,clock,flash,reduced,preview}=view,s=take.state,p=twins[side],t=box.size/5;
 const rim=Math.max(3,t*.10);
 panel(c,box.x-rim+2,box.y-rim+5,box.size+2*rim,box.size+2*rim,rim+2,ink,ink,3);
 panel(c,box.x-rim,box.y-rim,box.size+2*rim,box.size+2*rim,rim+2,p.wall,ink,2);
 for(let i=0;i<8;i++){
   const along=(i+.5)*box.size/8;
   for(const [bx,by] of [[box.x+along,box.y-rim*.50],[box.x+along,box.y+box.size+rim*.50],[box.x-rim*.5,box.y+along],[box.x+box.size+rim*.5,box.y+along]]){
     oval(c,bx,by,Math.max(1,rim*.28),Math.max(1,rim*.28),'#fff2b7',ink,.6);
   }
 }
 panel(c,box.x-.5,box.y-.5,box.size+1,box.size+1,2,p.edge,ink,1);
 for(let n=0;n<25;n++)tile(c,box,n,room.boards[side][n],side,s);
 const pos=side?s.b:s.a,prev=side?from.b:from.a;
 const [gx,gy]=cellPoint(box,room.goal[side]);ring(c,gx,gy,t*.31,side,room.goal[side]===pos,clock,reduced);
 const [px,py]=cellPoint(box,prev),[dx,dy]=cellPoint(box,pos);
 const progress=reduced?1:1-Math.pow(1-Math.min(1,tween),3),x=px+(dx-px)*progress,y=py+(dy-py)*progress;
 if(preview!=null) {
   const n=advance(room,s,preview),future=side?n.b:n.a;
   if(future!==pos){
     const [nx,ny]=cellPoint(box,future);c.save();c.setLineDash([t*.13,t*.11]);line(c,[[dx,dy],[nx,ny]],p.glow,3);c.restore();
     const actual=nx>dx+.5?1:nx<dx-.5?3:ny>dy+.5?2:0;
     label(c,arrows[actual],nx,ny,t*.39,p.glow,'center',t*.8,true);
   }
 }
 dancer(c,x,y,t*.97,side,prev===pos?1:tween,clock,room.goal[side]===pos,reduced);
}
function portraitTag(c,l,view,side){
 const {room,take}=view,box=l.boxes[side],p=twins[side],s=take.state;
 const x=side?l.pad:box.x+box.size+l.pad+5;
 const width=side?box.x-x-5:l.w-x-l.pad, cy=box.y+box.size*.45;
 label(c,p.key+' / '+p.name,x,cy-21,Math.min(17,width*.18),p.edge,'left',width,true);
 const rule=side?(room.delay?'One beat late':room.transform==='same'?'Same step':room.transform==='mirror'?'Mirror step':room.transform==='reverse'?'Reverse':'Quarter turn'):'Reads your arrow';
 label(c,s.swapped?(side?'Reads your arrow':'Swapped cue'):rule,x,cy,13,paper,'left',width);
 label(c,(side?s.b:s.a)===room.goal[side]?'On her mark':'Find the star',x,cy+18,12,gold,'left',width);
}
export function render(c,w,h,view){
 const l=layout(w,h),{room,take,clock}=view;
 c.fillStyle=night;c.fillRect(0,0,w,h);
 for(let i=0;i<16;i++){
   const x=i*w/15,y=(i*47)%Math.max(20,h-l.head);
   line(c,[[x,0],[x-h*.32,h]],i%3?'#3c274b':'#472d51',Math.max(2,w*.012));
   if(i%3===0)gem(c,x,y+l.head,3,'#826582');
 }
 const pad=l.pad;
 panel(c,pad,pad,w-pad*2,l.head-pad,8,ink);
 label(c,galleries[room.gallery].toUpperCase()+'  /  '+String(room.id+1).padStart(2,'0'),pad+10,pad+(l.head-pad)*.27,12,gold,'left',w*.67);
 label(c,room.name,pad+10,pad+(l.head-pad)*.70,Math.min(29,Math.max(16,l.head*.37)),paper,'left',w*.68,true);
 label(c,'PAR  '+room.par,w-pad-10,pad+(l.head-pad)*.53,Math.min(25,l.head*.38),paper,'right',w*.21,true);
 for(let i=0;i<2;i++){
   board(c,l.boxes[i],room,i,view);
   if(l.stacked)portraitTag(c,l,view,i);
   else {
     const b=l.boxes[i],p=twins[i];
     const above=b.y-l.head>22;
     if(above)label(c,p.key+'  '+p.name,b.x,b.y-20,Math.max(12,Math.min(20,b.size*.055)),p.edge,'left',b.size,true);
     if(h-b.y-b.size>55){
       const rule=i?(room.delay?'One beat late':room.transform==='mirror'?'Mirror step':room.transform==='reverse'?'Opposite step':room.transform==='same'?'Same step':'Quarter turn'):'Reads your arrow';
       label(c,view.take.state.swapped?'Parts exchanged':rule,b.x+b.size*.5,b.y+b.size+24,Math.max(12,Math.min(17,b.size*.04)),p.edge,'center',b.size);
     }
   }
 }
 if(!l.stacked&&w>580){
   const seam=w/2,mid=h*.53;gem(c,seam,mid,Math.min(w*.036,26),gold);
   label(c,room.delay?arrows[take.state.previous]:room.transform==='mirror'?'↔':room.transform==='same'?'=':'↻',seam,mid,17,ink,'center');
 }
 if(view.take.solved)label(c,'REUNITED   '+('★'.repeat(view.earned)),w/2,h-25,Math.min(24,h*.055),gold,'center',w*.85,true);
}
