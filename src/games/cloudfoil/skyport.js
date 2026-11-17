import { poly,line,oval,TAU } from '../kit/field-art.js';

export function drawAurora(c,time,progress,sector){
  const sx=366-Math.sin(progress*.0008)*30;
  const halo=c.createRadialGradient(sx,81,5,sx,81,94);
  halo.addColorStop(0,'#fff2ba99');halo.addColorStop(1,'#ffdfaa00');c.fillStyle=halo;c.fillRect(sx-95,-15,190,192);
  oval(c,sx,81,29,29,'#ffeda9');
  for(let row=0;row<4;row++){
    const ribbon=[];
    for(let i=0;i<=32;i++){const x=i*16-10;ribbon.push([x,30+row*10+Math.sin(i*.22+time*.08+row*.3)*14]);}
    line(c,ribbon,['#b6ecdd30','#f3d3ed33','#a9def832','#ffeac42b'][row],2+row);
  }
  for(let i=0;i<7;i++){
    const x=(i*77+time*(5+i%3))%530-25,y=64+(i*31)%78+Math.sin(time+i)*2;
    line(c,[[x-5,y-2],[x-2,y-3],[x,y],[x+3,y-3],[x+6,y-3]],'#41667b',1.4);
  }
}
function island(c,px,py,scale,phase){
  c.save();c.translate(px,py);c.scale(scale,scale);
  poly(c,[[-65,-4],[-47,-17],[5,-21],[52,-15],[69,0],[36,11],[-27,13]],'#769b90');
  poly(c,[[-64,-3],[-28,9],[-15,56],[-45,31]],'#6c747d');
  poly(c,[[-28,9],[40,7],[20,43],[-15,56]],'#79727a');
  poly(c,[[40,7],[67,-1],[44,31],[20,43]],'#a08783');
  for(let i=0;i<6;i++){
    const x=i*13-35,y=-12-Math.sin(i*1.4)*4,h=12+i%3*8;
    poly(c,[[x-6,y],[x-6,y-h],[x+6,y-h],[x+6,y]],'#f5dbb5');
    poly(c,[[x-9,y-h],[x,y-h-7],[x+8,y-h]],i%2?'#a55f60':'#5c797d');
    line(c,[[x,y-3],[x,y-8]],'#587484',2.3);
  }
  line(c,[[-45,-10],[-45,-57]],'#6d675f',3);
  for(let k=0;k<4;k++){const a=phase+k*TAU/4;poly(c,[[-45,-53],[-45+Math.cos(a)*22,-53+Math.sin(a)*22],[-45+Math.cos(a+.25)*17,-53+Math.sin(a+.25)*17]],'#f4dfb9');}
  for(let k=0;k<4;k++){const yy=(phase*9+k*11)%40;line(c,[[18+k*2,8+yy],[17+k*2,18+yy]],'#c9eff09c',1.5);}
  c.restore();
}
export function drawSkyport(c,camera,progress,time){
  const visible=[];
  for(let k=0;k<9;k++){
    const d=(k*179-progress%1450+2900)%1450-70;
    const [x,y,s]=camera((k%2?1:-1)*(166+k%4*58),-40-k%3*15,d);
    visible.push([d,x,y,s,k]);
  }
  for(const [d,x,y,s,k] of visible.sort((a,b)=>b[0]-a[0]))if(x>-100&&x<580)island(c,x,y,s*.91,time*.8+k);
  const [bx,by,bs]=camera(95+Math.sin(time*.17)*108,112,340+Math.sin(time*.22)*70);
  c.save();c.translate(bx,by);c.scale(bs,bs);oval(c,0,0,52,16,'#e6a48d','#835e68',2);
  for(let k=-2;k<=2;k++)line(c,[[k*15,-14+Math.abs(k)*2],[k*17,0],[k*15,14-Math.abs(k)*2]],'#fae2b4',2);
  poly(c,[[-48,-3],[-64,-11],[-61,4],[-48,8]],'#81949b');line(c,[[-20,12],[-10,24],[10,24],[22,12]],'#777e79',2);
  poly(c,[[-14,23],[12,23],[9,29],[-10,29]],'#775f56');c.restore();
}
export function drawTail(c,history,camera,progress,fast){
  for(const side of [-1,1]){
    const dots=history.map(v=>{const d=progress-v.p;const [x,y]=camera(v.x,v.h,0);
      return [x+side*(52-v.wing*24)*(1+d*.006),y+11+d*1.35];});
    if(dots.length>1){line(c,dots,fast?'#fbc9ed99':'#e9ffed60',fast?4:2);line(c,dots,'#fff5d8b3',1);}
  }
}
