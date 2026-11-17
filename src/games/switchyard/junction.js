import { poly,line,oval,panel,caption } from '../kit/field-art.js';

export function yardSkyline(c,t){
  poly(c,[[0,95],[40,82],[61,86],[96,65],[138,83],[170,74],[199,88],[275,53],[349,70],[390,54],[455,69],[480,60],[480,178],[0,198]],'#c2ceaf');
  poly(c,[[0,135],[40,118],[100,133],[170,99],[240,114],[318,83],[380,101],[440,80],[480,85],[480,186],[0,199]],'#aec3a6');
  poly(c,[[0,124],[37,126],[112,115],[152,125],[202,138],[101,153],[45,159],[0,155]],'#96b7b4');
  for(let i=0;i<12;i++){const x=(i*43+t*2)%187;line(c,[[x,134+i%4*4],[x+8,134+i%4*4]],'#dce6c9',1);}
  for(let i=0;i<5;i++){const x=14+i*23,y=114+(i%2)*4;
    poly(c,[[x,y],[x,y-14],[x+14,y-14],[x+14,y]],'#cca787');poly(c,[[x-2,y-14],[x+6,y-22],[x+17,y-14]],'#8d716b');
    for(let j=0;j<2;j++)c.fillStyle='#5d7573',c.fillRect(x+3+j*6,y-10,3,4);
  }
  line(c,[[120,116],[120,81],[146,66],[149,68],[124,87]],'#77877b',2.2);line(c,[[144,69],[144,90]],'#8c9587',1);
}
export function crossingScene(c,point,arm,clock,time){
  const left=1.6,right=2.33;
  poly(c,[point(left,-5.3),point(right,-5.3),point(right,4.9),point(left,4.9)],'#98948a');
  for(let k=-5;k<5;k+=.65)line(c,[point(1.97,k),point(1.97,k+.3)],'#e3d4af',1.3);
  for(let i=0;i<3;i++){
    const v=((clock*.9+i*3.4)%10.6)-5.3,[x,y]=point(1.81,v);
    if(Math.abs(v)<.7&&arm>.3)continue;
    c.save();c.translate(x,y);c.rotate(.99);
    panel(c,-6,-6,15,8,['#ad6b56','#567e89','#a2844d'][i],2);panel(c,4,-9,6,9,'#e1ceaa',1);
    oval(c,-4,2,2.1,2.1,'#444f4a');oval(c,7,2,2.1,2.1,'#444f4a');c.restore();
  }
  for(const side of [-1,1]){
    const [x,y]=point(side>0?1.52:2.4,side*.62);
    line(c,[[x,y],[x,y-14]],'#655f51',2.5);const end=[x+side*21*arm,y-16-(1-arm)*17];
    line(c,[[x,y-14],end],'#f1d5ad',4);
    for(let i=1;i<=3;i++){const a=i*.24;line(c,[[x+(end[0]-x)*a,y-14+(end[1]-y+14)*a],[x+(end[0]-x)*(a+.1),y-14+(end[1]-y+14)*(a+.1)]],'#b25c50',4);}
    oval(c,x,y-15,2.4,2.4,arm>.4&&Math.sin(time*11)>.1?'#ffac7a':'#79745f');
  }
}
export function departureStrip(c,trains,names){
  const lead=trains.find(t=>!t.done);if(!lead)return;
  panel(c,245,14,222,46,'#30453ee6');caption(c,lead.express?'EXPRESS  ↯':'LOCAL SERVICE',258,28,'#dbd6af',13,'left');
  caption(c,'Platform '+names[lead.want],258,47,'#ffedc8',16,'left');
  caption(c,Math.max(0,Math.ceil(lead.deadline-lead.age))+'s',452,37,'#f4c781',18,'right');
}
