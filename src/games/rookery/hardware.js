import { box,label,oval,line,path,star,moon,paw,ink } from './art.js';

function screw(c,x,y,r){
 oval(c,x,y,r,r,'#9a97a3','#514655',.7);
 line(c,[[x-r*.54,y+r*.39],[x+r*.54,y-r*.39]],'#534657',Math.max(.6,r*.36));
}
// Parts behind the key deck. Each keyboard has its own recognizable construction.
export function hardware(c,g,b,s,scene){
 const {x,y,bw,bh,cw,ch,gridX,gridY}=g;
 const reserve=g.side?g.margin:Math.min(g.head+g.margin,g.h*.33);
 const room=Math.max(0,y-reserve-1),lift=Math.min(room,Math.max(8,ch*.49));
 const floor=Math.min(Math.max(0,g.h-g.foot*.76-(y+bh)),ch*.32);
 if(b.world===0){
  if(lift>6){
   const xx=x+bw*.045,w=bw*.91;box(c,xx,y-lift,w,lift+10,Math.min(9,lift*.24),'#55475b',ink,1.4);
   box(c,xx+4,y-lift+3,w-8,lift+5,4,'#434e71');
   const sky=c.createLinearGradient(0,y-lift,0,y);sky.addColorStop(0,'#384466');sky.addColorStop(1,'#666991');
   box(c,xx+7,y-lift+5,w-14,lift+1,3,sky);
   for(let i=0;i<9;i++)star(c,xx+w*(.06+i*.095),y-lift*.45+(i%3-1)*lift*.14,1.4+(i%3)*.42,'#ffe6bb');
   if(lift>=15){moon(c,xx+w*.89,y-lift*.42,Math.min(9,lift*.28),'#f7cc85');}
  }
  if(floor>6){
   box(c,x+bw*.035,y+bh-2,bw*.93,floor+3,4,'#9daac5',ink,1.2);
   box(c,x+bw*.35,y+bh-1,bw*.28,floor*.7+1,3,'#b8c4d5','#747b99');
  }
 }
 if(b.world===1){
  // The translucent switch tray has exposed PCB traces and copper pads.
  box(c,x-2,y+1,bw+4,bh+Math.min(floor,8)+4,Math.min(11,ch*.26),'#6d9f8b',ink,1.5);
  for(let i=0;i<6;i++){const px=x+bw*(.12+i*.145);line(c,[[px,y+bh-3],[px+3,y+bh+3],[px+cw*.23,y+bh+3]],'#d9c987',1.3);oval(c,px+cw*.23,y+bh+3,1.8,1.8,'#d4ba78');}
 }
 if(b.world===2){
  if(lift>8){
   const hw=Math.min(cw*.29,15);
   path(c,[['moveTo',x+bw*.81,y],['bezierCurveTo',x+bw*.81,y-lift*.9,x+bw*.89,y-lift*1.05,x+bw*.93,y-lift*.8],['quadraticCurveTo',x+bw*.96,y-lift*.68,x+bw*.94,y-lift*.37]],null,'#4b3d53',Math.min(5,hw*.45));
   box(c,x+bw*.8-hw*.45,y-lift*.28,hw,lift*.35+4,2,'#9b93ad',ink);
  }
  if(floor>6){box(c,x+bw*.25,y+bh-2,bw*.51,floor,4,'#736785',ink,1.3);for(let i=0;i<7;i++)line(c,[[x+bw*(.3+i*.063),y+bh+1],[x+bw*(.3+i*.063),y+bh+floor*.65]],'#a89cba',1);}
 }
 if(b.world===3){
  if(lift>6){
   const travel=scene.event.letter&&!scene.reduced?Math.max(0,1-scene.age*3.5):0;
   const ww=bw*.62,xx=x+bw*.18-Math.min(bw*.04,10)*s.typed/(b.word.length||1),py=y-lift+travel*lift*.15;
   box(c,xx+3,py+2,ww,lift+9,2,'#6e585b57');box(c,xx,py,ww,lift+11,2,'#fff4d9','#947d75',1);
   const pcy=py+lift*.49;
   if(lift>14){label(c,(b.word.slice(0,s.typed)||'')+'▏',xx+ww*.12,pcy,Math.min(20,Math.max(12,lift*.56)),'#765060','left','AK Mono',ww*.68);}
   line(c,[[xx+ww*.72,pcy],[xx+ww*.92,pcy]],'#d5c0b3',1);
   oval(c,x+bw*.12,y-1,Math.min(7,cw*.11),Math.min(7,cw*.11),'#6b5660',ink,1);
   oval(c,x+bw*.87,y-1,Math.min(7,cw*.11),Math.min(7,cw*.11),'#6b5660',ink,1);
  }
  if(floor>5){box(c,x+bw*.06,y+bh-2,bw*.88,floor+4,6,'#776460',ink);box(c,x+bw*.26,y+bh-1,bw*.48,floor*.63+2,3,'#b39983','#6b5359');}
 }
 if(b.world===4){
  if(lift>7){
   const cx=x+bw*.5,ww=bw*.55;
   // An open score rests on a narrow music stand above the keys.
   for(const side of [-1,1]){
    const ex=cx+side*ww*.5;
    path(c,[['moveTo',cx,y-lift*.71],['quadraticCurveTo',cx+side*ww*.25,y-lift*1.07,ex,y-lift*.86],['lineTo',ex,y+3],['lineTo',cx,y+3],['closePath']],'#f3e5ce','#776785',1);
    for(let i=0;i<3;i++)line(c,[[cx+side*ww*.07,y-lift*(.53-i*.13)],[ex-side*ww*.06,y-lift*(.64-i*.13)]],'#9b8ca1',.8);
    for(let i=0;i<3;i++)oval(c,cx+side*ww*(.13+i*.11),y-lift*.39+(i%2)*2,1.8,1.2,'#756482');
   }
  }
  if(floor>4){box(c,x+bw*.06,y+bh-1,bw*.88,floor*.65+3,3,'#4c4059',ink);for(const at of [.37,.48,.59])box(c,x+bw*at,y+bh+1,bw*.04,floor*.9,2,'#c8a76c','#655368');}
 }
}
export function caseFinish(c,g,b){
 const {x,y,bw,bh,cw,ch,gridX,gridY}=g,r=Math.max(1.7,Math.min(4,cw*.04));
 if(b.world===1){
  for(const a of [.022,.978])for(const q of [.12,.95])screw(c,x+bw*a,y+bh*q,r);
 }else if(b.world===3){
  const yy=y+(gridY-y)*.43;line(c,[[x+bw*.62,yy+1],[x+bw*.72,yy+1],[x+bw*.747,yy-3]],'#69535d',2);
  box(c,x+bw*.73,yy-5,bw*.055,4,2,'#9e8a7d','#594752');
 }else if(b.world===4){
  line(c,[[x+bw*.034,gridY-2],[x+bw*.965,gridY-2]],'#caa876',Math.max(1,ch*.025));
 }
}
export function capFinish(c,x,y,width,height,depth,world){
 if(width<16||height<14)return;
 const rail=height-depth;
 if(world===1){
  line(c,[[x+width*.14,y+rail+1],[x+width*.23,y+height-1],[x+width*.78,y+height-1],[x+width*.86,y+rail+1]],'#d6bbae88',1);
 }else if(world===2){
  line(c,[[x+width*.17,y+rail-2],[x+width*.84,y+rail-2]],'#b195b955',1);
 }else if(world===3){
  box(c,x+3,y+3,width-6,rail-5,Math.min(width,height)*.23,null,'#967b685d',1);
 }else if(world===4){
  line(c,[[x+width-3,y+4],[x+width-3,y+rail-3]],'#b89fad77',Math.max(1,width*.025));
 }
}
