import {line,polygon,oval,panel,type} from '../kit/illustration.js';
import {districts} from './routes.js';
import {deck,predict,clamp} from './flight.js';
import {airframe,postwoman} from './airframes.js';
import {landscape} from './sky.js';
const ink='#283747', paper='#fff3d7';
const text=(c,s,x,y,n,color=ink,align='left',face='AK Mono')=>type(c,s,x,y,n,color,align,"'"+face+"', system-ui");
const lane=z=>['FAR','MID','NEAR'][z+1];
export function frame(w,h,camera){
 const k=Math.min(w/5.85,h/3.22), cx=w*.47;
 return {k,point:(x,y,z)=>[cx+(x-camera)*k+z*k*.09,h*.58-y*k*.94+z*k*.22]};
}
function envelope(c,x,y,r,t){
 c.save();c.translate(x,y);c.rotate(Math.sin(t*3)*.14-.08);
 c.fillStyle=paper;c.strokeStyle=ink;c.lineWidth=2;c.fillRect(-r,-r*.64,r*2,r*1.28);c.strokeRect(-r,-r*.64,r*2,r*1.28);
 line(c,[[-r,-r*.6],[0,r*.16],[r,-r*.6]],'#d3635c',2);
 oval(c,0,r*.15,r*.19,r*.19,'#bc6254');
 c.restore();
}
function ticket(c,x,y,width,height){
 panel(c,x+2,y+3,width,height,'#34454b80',5);panel(c,x,y,width,height,paper,5);
 c.save();c.beginPath();c.roundRect(x,y,width,height,5);c.clip();
 for(let i=0;i<width+12;i+=14)polygon(c,[[x+i,y],[x+i+6,y],[x+i+3,y+4],[x+i-3,y+4]],i%28?'#d2625e':'#418c9b');
 c.restore();
}
export function render(c,w,h,s,view){
 const d=s.mode==='post'?s.route.district:s.seg.level,r=districts[d], time=view.quiet?0:s.t;
 const f=frame(w,h,view.camera);
 landscape(c,w,h,r,time+view.camera*.2,d,view.quiet);
 const compact=w<580||h<370,heads=compact?12:15,title=compact?18:25;
 const top=compact?9:17, left=compact?10:21;
 ticket(c,left,top,compact?165:232,compact?47:66);
 text(c,(s.mode==='red'?'RED-EYE':s.mode==='daily'?'AIRBILL':'POST RUN')+'  /  '+String(s.delivered+1).padStart(2,'0')+(s.mode==='red'?'':'–'+(s.mode==='post'?s.route.legs.length:15)),left+10,top+15,heads);
 text(c,s.mode==='post'?s.route.name:r.name,left+9,top+(compact?32:44),title,ink,'left','AK Display');
 const strap=s.chutes+' '+(s.chutes===1?'CHUTE':'CHUTES');
 text(c,strap,w-left,top+13,heads,ink,'right');
 if(!compact||w>325)text(c,s.letters+' AIRMAIL',w-left,top+33,heads,ink,'right');
 const plane=(p,origin)=>{
  const d=deck(p,s.t),[px,py]=f.point(d.x,d.y,d.z);
  const accent=origin?r.hull:['#338e99','#d96954','#d1a143','#8878b6'][p.paint];
  airframe(c,px,py,f.k/100,p,d,accent,origin&&!view.quiet?s.dip:0,time);
  if(!origin){
    const offset=Math.min(51,.46*f.k);
    const tx=clamp(px,41,w-41), ty=py+offset+14;
    panel(c,tx-33,ty-10,66,20,ink,9);text(c,lane(d.z)+'  '+(p.glyph==='g'?'≈':'✦'),tx,ty,12,paper,'center');
    if(Math.abs(s.seg.gust)>.01){
      const ax=px-d.half*f.k*.65,ay=py-14;line(c,[[ax,py],[ax,ay-14]],ink,1.8);
      const sign=Math.sign(s.seg.gust);
      polygon(c,[[ax,ay-13],[ax+sign*20,ay-9+Math.sin(time*4)*2],[ax+sign*11,ay-5],[ax,ay-7]],'#f4a55c',ink,1);
    }
  }
 };
 const actor=()=>{
  const [x,y]=f.point(s.x,s.y,s.z);
  const foot=s.phase==='deck'?s.dip*2:0;
  postwoman(c,x,y+foot,clamp(f.k/85,.8,1.7),s.phase,s.charge,time,s.vy<0,view.quiet);
 };
 const layers=[{z:s.origin.z,draw:()=>plane(s.origin,true)},{z:s.dest.z,draw:()=>plane(s.dest,false)}];
 if(s.letter&&!s.letter.taken){
  const m=s.letter,[mx,my]=f.point(m.x,m.y,m.z);
  layers.push({z:m.z,draw:()=>envelope(c,mx,my,clamp(f.k*.13,8,17),time)});
 }
 layers.push({z:s.z+.02,draw:actor});layers.sort((a,b)=>a.z-b.z).forEach(l=>l.draw());
 if(s.phase==='deck'&&(s.held||s.delivered===0)){
   const power=s.held?s.charge:view.mark;
   const shot=predict(s,power);
   for(let i=1;i<=13;i++){
     const dt=shot.duration*i/13;
     const x=shot.start+shot.vx*dt+.5*s.seg.gust*dt*dt;
     const y=shot.y0+shot.vy*dt-3.4*dt*dt;
     const z=s.z+clamp(s.lane-s.z,-2.55*dt,2.55*dt);
     const [px,py]=f.point(x,y,z);
     oval(c,px,py,i===13?4:2,i===13?4:2,s.held?'#fff8d4':'#fff6d397','#3a6366',.8);
   }
 }
 const meterW=Math.min(240,w*.62),meterX=(w-meterW)*.5, meterY=h-(h<350?50:65);
 panel(c,meterX-7,meterY-17,meterW+14,33,ink,8);
 text(c,s.phase==='deck'?(s.held?'RELEASE AT THE STRIPE':'HOLD TO BEND • RELEASE TO FLY'):s.phase==='chute'?'SILK RESCUE':s.lane===s.dest.z?'TRIM FOR THE GREEN STRIPE':'CHANGE DEPTH TO '+lane(s.dest.z),w*.5,meterY-7,12,paper,'center');
 c.fillStyle='#71898e';c.fillRect(meterX,meterY+4,meterW,5);
 c.fillStyle='#ffca75';c.fillRect(meterX,meterY+4,meterW*s.charge,5);
 c.fillStyle='#92e5bd';c.fillRect(meterX+meterW*view.mark-3,meterY+2,6,9);
 if(view.stamp>0){
  c.save();c.translate(w*.51,h*.32);c.rotate(-.09);
  const a=Math.min(1,view.stamp*3);c.globalAlpha=a;const label=view.label;
  c.font="900 "+Math.max(17,Math.min(32,w*.05))+"px 'AK Display',system-ui";
  const len=c.measureText(label).width;
  panel(c,-len/2-12,-19,len+24,38,'#fcdd82',4);c.strokeStyle=ink;c.lineWidth=2;c.strokeRect(-len/2-9,-16,len+18,32);
  text(c,label,0,0,Math.max(17,Math.min(32,w*.05)),ink,'center','AK Display');c.restore();
 }
}
