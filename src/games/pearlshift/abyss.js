import { poly,line,oval,panel } from '../kit/field-art.js';

export function mantaRay(c,t){
  const x=245+Math.sin(t*.14)*135,y=98+Math.sin(t*.3)*13;
  c.save();c.translate(x,y);c.rotate(Math.sin(t*.17)*.13);const flap=Math.sin(t*1.8)*10;
  poly(c,[[-55,-14-flap],[-37,-3],[-15,10],[0,8],[15,12],[49,-9+flap],[21,-4],[9,-14],[0,-11],[-9,-14],[-22,-6]],'#43788a');
  poly(c,[[-37,-6-flap*.45],[-15,5],[-3,3],[-9,-9],[-18,-4]],'#598990');
  line(c,[[0,6],[5,20],[17,30],[23+Math.sin(t*2)*4,43]],'#3c6c7f',2);
  for(let n=0;n<6;n++)oval(c,-18+n*6,Math.sin(n)*2,1.4,1.2,'#9dc2b5');c.restore();
}
export function jellyfish(c,t){
  for(let i=0;i<4;i++){const x=i*127+25+Math.sin(t*.26+i)*13,y=94+(i%2)*48+Math.sin(t+i)*7;
    const glow=c.createRadialGradient(x,y,0,x,y,21);glow.addColorStop(0,'#a7e9d052');glow.addColorStop(1,'#a7e9d000');c.fillStyle=glow;c.fillRect(x-22,y-22,44,44);
    c.beginPath();c.ellipse(x,y,8,6+Math.sin(t*1.8+i),0,Math.PI,Math.PI*2);c.fillStyle='#abd8c5a3';c.fill();
    for(let j=-1;j<=1;j++)line(c,[[x+j*5,y],[x+j*4+Math.sin(t+j+i)*2,y+7],[x+j*4-Math.sin(t+j+i)*3,y+14]],'#c3deca72',1);
  }
}
export function wreck(c,[x,y],t){
  c.save();c.translate(x,y);c.rotate(-.22);
  poly(c,[[-46,-6],[-26,4],[25,10],[45,-3],[40,-12],[16,-9],[2,-15],[-9,-9]],'#294f54');
  for(let k=-3;k<4;k++)line(c,[[k*9,2+k*.6],[k*10-3,-12+Math.sin(k)*4]],'#8a8b6e',2.6);
  line(c,[[-10,-1],[-19,-34]],'#9b9170',3);line(c,[[-32,-23],[-4,-29]],'#8b9375',2);
  poly(c,[[-17,-29],[-7,-26],[-3,-16],[-13,-20]],'#65988a');
  for(let i=0;i<7;i++)line(c,[[i*9-30,4],[i*9-30+Math.sin(t+i)*2,-4],[i*9-29+Math.sin(t*.83+i)*3,-13-(i%3)*2]],'#4e9780',2);
  c.restore();
}
export function eel(c,[x,y],t,repelled){
  const pts=[];const dir=Math.cos(t*.41)<0?-1:1;
  for(let k=0;k<15;k++){const q=k/14;pts.push([x-dir*q*49,y+Math.sin(q*9-t*4)*q*7-4]);}
  for(let k=13;k>=0;k--)line(c,[pts[k],pts[k+1]],repelled?'#677c93':'#744f88',1+(14-k)*.39);
  for(let i=1;i<12;i+=2)oval(c,...pts[i],1.5,1.2,repelled?'#c5dada':'#f2b7de');
  oval(c,x,y-4,6,3.1,'#655d86');oval(c,x+dir*3,y-5,1.3,1.3,'#fff1b5');
}
export function thermalVent(c,[x,y],t,hot){
  for(let i=0;i<3;i++){const xx=x+(i-1)*7;poly(c,[[xx-5,y+3],[xx-3,y-5-i%2*4],[xx+2,y-6-i%2*4],[xx+5,y+2]],'#516c70');
    if(hot){const rise=(t*13+i*7)%28;oval(c,xx+Math.sin(t+i)*2,y-7-rise,1+rise*.07,1+rise*.08,null,'#b4e6c8ac',1);}}
  oval(c,x,y,17,6,null,hot?'#a5d6aa95':'#4c7674',1);
}
export function relic(c,[x,y],t){
  const pulse=2+Math.sin(t*4)*2;oval(c,x,y+2,14+pulse,5+pulse*.4,null,'#fcd4ef',1.4);
  poly(c,[[x,y-15],[x+8,y-5],[x,y+1],[x-7,y-6]],'#e9a1dd');poly(c,[[x,y-15],[x+2,y-6],[x-7,y-6]],'#ffe6f3');
}
export function bellRivets(c){for(let i=0;i<6;i++){const a=i*Math.PI/3;oval(c,1+Math.cos(a)*8,-5+Math.sin(a)*8,1,1,'#8f713f');}
  line(c,[[-13,-8],[-17,-8],[-17,2]],'#f7ce80',2);oval(c,-17,3,3,2,'#ffdc8f');}
