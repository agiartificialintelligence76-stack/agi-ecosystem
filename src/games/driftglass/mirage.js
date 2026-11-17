import { line,poly,oval,panel,gradient } from '../kit/field-art.js';
export function racingSky(c,t,gate,x){
  const night=Math.max(0,(gate-9)/10),sunY=92+gate*2;
  if(night>0){c.save();c.globalAlpha=night;c.fillStyle=gradient(c,0,165,[[0,'#232748'],[.65,'#72527e'],[1,'#ed9e99']]);c.fillRect(0,0,480,165);
    for(let i=0;i<31;i++)oval(c,(i*73)%490,(i*31)%109,1,1,'#ead9cb');c.restore();}
  const sx=343-x*.065;const glow=c.createRadialGradient(sx,sunY,4,sx,sunY,70);
  glow.addColorStop(0,'#ffe1abbb');glow.addColorStop(1,'#ffe1ab00');c.fillStyle=glow;c.fillRect(sx-70,sunY-70,140,140);
  oval(c,sx,sunY,31,31,'#ffdfa9');
  for(let i=0;i<3;i++){const y=sunY+9+i*5;line(c,[[sx-26+i*3,y],[sx+27-i*3,y]],'#f5b5a2',1+i*.5);}
}
export function horizonLandmarks(c,z,t,x,gate){
  for(let k=0;k<7;k++){
    const d=(k*122-z%842+1684)%842;const s=125/(135+d);
    const xx=240+((k%2?1:-1)*(132+(k%3)*78)-x*.33)*s*2.4,yy=163+199*s;
    if(xx<-35||xx>515)continue;
    if(k%3===0){
      for(let i=0;i<4;i++){const h=(19+i%3*13)*s,px=xx+i*5*s;
        poly(c,[[px-6*s,yy],[px-4*s,yy-h*.8],[px+2*s,yy-h],[px+5*s,yy-h*.5],[px+7*s,yy]],'#b4c5c9');
        poly(c,[[px+2*s,yy-h],[px+5*s,yy-h*.5],[px+7*s,yy],[px+1*s,yy]],'#909eb3');
        line(c,[[px-4*s,yy-h*.8],[px+2*s,yy-h]],'#f6e8db',Math.max(.8,s));}
    }else{
      const h=47*s;line(c,[[xx,yy],[xx,yy-h]],'#77778b',Math.max(1,3*s));
      for(let n=0;n<3;n++){const a=t*.8+n*Math.PI*2/3+k;
        poly(c,[[xx,yy-h],[xx+Math.cos(a)*22*s,yy-h+Math.sin(a)*22*s],[xx+Math.cos(a+.26)*14*s,yy-h+Math.sin(a+.26)*14*s]],'#f0d9c7');}
      line(c,[[xx,yy],[xx+3*s,yy+19*s]],'#809cad66',Math.max(1,2*s));
    }
  }
  if(gate>=13){c.fillStyle='#6562842d';c.fillRect(0,167,480,244);}
}
export function rivalCar(c,x,y,s,t){
  c.save();c.translate(x,y);c.scale(s,s);oval(c,0,3,28,7,'#617d91a3');
  poly(c,[[-27,-3],[-25,-11],[-14,-23],[12,-24],[25,-15],[27,-3],[20,0],[-22,0]],'#65768d');
  poly(c,[[-24,-11],[-15,-21],[11,-22],[21,-15],[12,-11]],'#e2e8df');
  poly(c,[[-15,-19],[10,-20],[16,-15],[-13,-14]],'#64778b');
  panel(c,-24,-9,49,6,'#acb9c6',2);
  for(const k of [-1,1]){line(c,[[k*23,-7],[k*13,-7]],'#ff8a82',2.3);oval(c,k*23,0,3,3,'#495868');}
  const a=2+Math.sin(t*22);poly(c,[[-5,0],[6,0],[0,4+a]],'#e5be9b');c.restore();
}
export function apexDiamond(c,x,y,s,t){
  const h=Math.max(2.3,5*s),lift=Math.sin(t*4)*s;
  poly(c,[[x,y-9*s-h+lift],[x+h,y-9*s+lift],[x,y-9*s+h+lift],[x-h,y-9*s+lift]],'#ffe9a1');line(c,[[x-h,y],[x+h,y]],'#ffcf88',Math.max(1,2*s));
}
export function saltSpray(c,x,y,t,yaw,boost){
  for(let k=0;k<20;k++){const q=(t*(boost?2.1:1.35)+k/20)%1,side=k%2?1:-1;
    const xx=x+side*22+side*q*(21+k%5*4)-yaw*q*30,yy=y+2+q*30-Math.sin(q*Math.PI)*(k%4)*3;
    oval(c,xx,yy,1+q*(boost?3:2),1+q*2,boost?'#ffe2aa99':'#f6ebd7a0');}
}
