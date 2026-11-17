import { line,poly,oval,panel } from '../kit/field-art.js';

export function satellite(c,t){
  const x=(50+t*6)%540-25,y=65+Math.sin(t*.13)*16;
  c.save();c.translate(x,y);c.rotate(-.25);
  poly(c,[[-18,-4],[-5,-4],[-5,2],[-18,2]],'#8495ad');poly(c,[[4,-4],[17,-4],[17,2],[4,2]],'#8495ad');
  for(const k of [-15,-11,-7,7,11,15])line(c,[[k,-4],[k,2]],'#c2bdbe',.6);
  panel(c,-4,-5,8,9,'#d9bb9c',2);line(c,[[0,-4],[3,-10]],'#d6c7b4',1);c.restore();
}
export function moonbase(c,ground,t,stage){
  const [x,y]=ground(-108,-106);
  for(let i=0;i<3;i++){const px=x+i*16,py=y-i*4;
    poly(c,[[px-9,py+1],[px+8,py+1],[px+12,py-13],[px-6,py-13]],'#566186');
    for(let n=0;n<4;n++)line(c,[[px-7+n*5,py],[px-3+n*5,py-12]],'#949ab0',.8);
    line(c,[[px,py],[px,py+5]],'#68667b',1.7);}
  const [hx,hy]=ground(77,-105);oval(c,hx,hy,34,7,'#646478');
  c.beginPath();c.ellipse(hx,hy-2,24,18,0,Math.PI,Math.PI*2);c.fillStyle='#dbbda8';c.fill();
  for(let n=-1;n<=1;n++)line(c,[[hx+n*17,hy-2],[hx+n*10,hy-15],[hx,hy-20]],'#897b84',1.3);
  poly(c,[[hx-21,hy-3],[hx+22,hy-3],[hx+20,hy+4],[hx-19,hy+4]],'#888495');
  panel(c,hx-4,hy-9,8,13,'#60667a',2);oval(c,hx+13,hy-6,2.5,2.5,'#fcdb97');
  const [ax,ay]=ground(130,-58);line(c,[[ax-5,ay],[ax,ay-26],[ax+5,ay]],'#767387',3);
  const dir=Math.sin(t*.22)*6;line(c,[[ax,ay-22],[ax+dir,ay-33]],'#dad0c6',3);
  c.save();c.translate(ax+dir,ay-33);c.rotate(-.3+dir*.05);c.beginPath();c.arc(0,-5,12,.08*Math.PI,.94*Math.PI);c.fillStyle='#d6c8bc';c.fill();line(c,[[-8,1],[0,-9],[8,1]],'#807c90',1.3);c.restore();
  const [rx,ry]=ground(-68+Math.sin(t*.21+stage)*28,49);c.save();c.translate(rx,ry);
  for(const xx of [-8,0,8])oval(c,xx,0,3.2,3.2,'#484757','#aba7b1',1);
  poly(c,[[-12,-2],[-9,-8],[4,-10],[12,-6],[10,-2]],'#d2ac7c');line(c,[[3,-8],[4,-16]],'#ded3bb',1.5);oval(c,4,-17,2,2,'#f6d991');c.restore();
}
export function salvagePod(c,[x,y],ready,t,landed=false){
  if(!landed){const q=11+(t*8)%5;oval(c,x,y,q,q,null,ready?'#b3ffe0':'#e5c68e8f',1.2);}
  poly(c,[[x-7,y-4],[x+1,y-8],[x+8,y-5],[x+1,y]],'#ffdc98');
  poly(c,[[x-7,y-4],[x+1,y],[x+1,y+8],[x-7,y+3]],'#cd9368');
  poly(c,[[x+1,y],[x+8,y-5],[x+8,y+3],[x+1,y+8]],'#a97c67');
  line(c,[[x-2,y-7],[x+5,y-3],[x+5,y+4]],'#746c69',1.5);
  if(!landed)oval(c,x,y-9,1.8,1.8,Math.sin(t*6)>0?'#ceffe4':'#77afa9');
}
export function suspendedCrate(c,x,y,swing,h){const len=Math.min(27,h+6);
  line(c,[[x-5,y+3],[x+swing,y+len],[x+5,y+3]],'#e8ce9b',1.5);salvagePod(c,[x+swing,y+len+4],false,0,true);}
export function dust(c,x,y,t,power){for(let i=0;i<16;i++){const phase=(t*1.2+i/16)%1,side=i%2?1:-1;
  oval(c,x+side*(8+phase*40)*power,y-phase*(1-phase)*21,2+phase*4,1+phase*2,'#ddd2bf8a');}}
