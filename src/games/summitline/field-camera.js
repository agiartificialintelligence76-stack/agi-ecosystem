import { poly,line,oval,panel,caption } from '../kit/field-art.js';
export const species=['Osprey','Ibex','Red fox','Snow owl','Alpine hare'];
export function portrait(c,id,x,y,s,t){
  c.save();c.translate(x,y);c.scale(s,s);const flap=Math.sin(t*3.2)*5;
  if(id===0||id===3){
    const col=id===0?'#5a4744':'#e7decc';
    poly(c,[[-28,-5-flap],[-24,-8-flap],[-12,-4],[-4,1],[1,-2],[6,0],[13,-7],[27,-12+flap],[24,-4+flap],[12,2],[4,4],[-2,4],[-9,1],[-20,-1]],col);
    poly(c,[[-4,1],[0,-3],[4,-2],[7,1],[3,2],[-2,4]],'#f6e4bf');
    poly(c,[[0,3],[-5,9],[3,6],[5,2]],col);
    line(c,[[-22,-5-flap],[-14,-3],[-9,0]],id===0?'#aa8b73':'#998d87',1);
  }else{
    const col=id===1?'#937052':id===2?'#c77848':'#dcdac9';const yb=Math.sin(t*3)*1;
    poly(c,[[-11,1+yb],[-5,-5+yb],[6,-4+yb],[12,-10+yb],[16,-9+yb],[17,-4+yb],[12,-2+yb],[8,4+yb],[-4,5+yb]],col);
    for(const xx of [-6,-2,5,8])line(c,[[xx,3+yb],[xx-1,9],[xx+1,10]],col,2);
    if(id===1){line(c,[[12,-8],[9,-14],[12,-18],[15,-17]],'#66534d',2);line(c,[[14,-9],[13,-15],[16,-18]],'#66534d',1.5);}
    else if(id===2){poly(c,[[-8,2],[-18,2],[-24,-4],[-19,5],[-12,7]],col);poly(c,[[-22,-3],[-17,1],[-17,4],[-21,1]],'#eee8ce');poly(c,[[12,-8],[12,-15],[16,-9]],col);}
    else {line(c,[[13,-8],[9,-18]],col,3);line(c,[[15,-9],[15,-20]],col,3);}
  }
  c.restore();
}
export function mountainDetails(c,pos,t){
  for(let i=0;i<8;i++){const x=((i*131-pos*.13+t*1.5)%610+610)%610-55,y=62+(i%3)*18;
    oval(c,x,y,34+i%3*7,3+i%2,'#ffeece75');oval(c,x-7,y-2,12,4,'#ffe8c76b');}
  for(let i=0;i<4;i++){const x=((i*93+t*3)%525)-20,y=87+Math.sin(t*.4+i)*8;line(c,[[x-3,y-1],[x,y],[x+4,y-2]],'#716774',1.1);}
}
export function passengers(c,t,swing){
  for(let k=0;k<3;k++){const x=k*5-3,y=35-k*.45;
    oval(c,x,y,1.8,2.1,['#eac1a0','#ccab92','#f1caa3'][k]);line(c,[[x,y+2],[x+swing,y+5]],['#bda071','#bd7868','#779c9b'][k],2.5);}
  line(c,[[-15,46],[-6,50],[-6,53]],'#dca078',1);
}
export function filmFrame(c,id,stars,t){
  c.save();c.translate(67,140);c.rotate(-.075);
  panel(c,-47,-39,94,83,'#faeacf',2);panel(c,-41,-33,82,53,'#8da6a1',2);
  poly(c,[[-41,10],[-22,-9],[-10,-2],[8,-20],[37,1],[41,20],[-41,20]],'#6e8986');
  portrait(c,id,0,-7,1.05,0);caption(c,'★'.repeat(stars),0,32,'#745638',15);c.restore();
}
