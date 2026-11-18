import {polygon,oval,line,gradient} from '../kit/illustration.js';

function hill(c,w,h,y,amplitude,speed,color,time){
 c.beginPath();c.moveTo(-2,h);
 for(let x=-3;x<=w+6;x+=6){
  const p=x/w*7+time*speed;
  c.lineTo(x,y+Math.sin(p)*amplitude+Math.sin(p*1.8+2)*amplitude*.31);
 }
 c.lineTo(w+6,h);c.closePath();c.fillStyle=color;c.fill();
}
function cloud(c,x,y,r,fill){
 c.fillStyle=fill;c.beginPath();c.moveTo(x-1.1*r,y);
 c.bezierCurveTo(x-1.16*r,y-.28*r,x-.81*r,y-.47*r,x-.59*r,y-.36*r);
 c.bezierCurveTo(x-.43*r,y-.96*r,x+.21*r,y-.86*r,x+.34*r,y-.43*r);
 c.bezierCurveTo(x+.7*r,y-.65*r,x+.95*r,y-.32*r,x+.82*r,y-.19*r);
 c.bezierCurveTo(x+1.2*r,y-.23*r,x+1.36*r,y,x+1.1*r,y+.06*r);
 c.bezierCurveTo(x+.5*r,y+.17*r,x-.72*r,y+.22*r,x-1.1*r,y);c.fill();
}
const wrap=(n,range)=>((n%range)+range)%range;
export function landscape(c,w,h,region,time,district,quiet){
 const [top,bottom,hillColor]=region.sky;
 gradient(c,0,0,w,h,[top,bottom,bottom]);
 const sunX=w*.72,sunY=h*.34,sun=Math.min(w*.18,h*.19);
 oval(c,sunX,sunY,sun,sun,district===4?'#fbedd0':'#ffe7a0');
 c.save();c.globalAlpha=.37;
 for(let i=0;i<6;i++)line(c,[[sunX-sun*.90,sunY+sun*.12+i*sun*.14],[sunX+sun*.9,sunY+sun*.12+i*sun*.14]],bottom,2+i*.24);
 c.restore();
 for(let i=0;i<11;i++){
  const r=Math.min(w*.21,h*.16)*(.29+(i*37%79)/89), x=wrap(w*(i*.32+.1)-(quiet?0:time*(2+i%5)),w+2.8*r)-1.1*r;
  const y=h*(.12+(i*17%56)/100);
  cloud(c,x,y,r,'#fff8dc80');
 }
 hill(c,w,h,h*.76,h*.055,.10,'#d5be9c',time*.08);
 hill(c,w,h,h*.82,h*.085,.16,hillColor,time*.12);
 // District landmarks share the horizon, each with a recognizable silhouette.
 for(let i=0;i<11;i++){
  const x=wrap(i*w*.133-time*(quiet?0:1.7),w+75)-35,y=h*(.85+Math.sin(i*3)*.02);
  const s=Math.min(h,w)*.0013;
  c.save();c.translate(x,y);c.scale(s,s);c.globalAlpha=.82;
  if(district===0||district===5){
   polygon(c,[[-12,6],[-12,-13],[3,-25],[18,-13],[18,6]],'#9b705f');
   polygon(c,[[-16,-12],[2,-28],[23,-12]],'#75595a');
   oval(c,-22,-10,6,11,'#496e69');line(c,[[-22,-3],[-22,5]],'#5c6d62',2);
  }else if(district===1){
   line(c,[[-21,2],[18,2],[24,-4]],'#526a74',4);line(c,[[-3,-1],[-3,-39]],'#526a74',2);
   polygon(c,[[-5,-34],[-6,-4],[-20,-4]],'#f3dca8');
  }else if(district===2){
   line(c,[[0,0],[5,-18],[-1,-37],[8,-55]],'#736d67',1.5);
   polygon(c,[[7,-70],[16,-61],[8,-48],[0,-61]],i%2?'#b67176':'#e0af65');
  }else{
   polygon(c,[[-10,6],[-10,-20],[-6,-24],[0,-44],[7,-23],[11,-18],[11,6]],'#5f5970');
   oval(c,0,-15,2,4,'#f1cb92');
  }
  c.restore();
 }
 hill(c,w,h,h*.93,h*.07,.23,district===4?'#454158':'#78918a',time*.15);
}
