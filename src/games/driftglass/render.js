import {view,project,DISTRICTS,canLink} from './road.js';
import {horizonDetail,groundDetail,roadsideDetail} from './scenery.js';
import {RIVALS,MEETS} from './rivals.js';
import {ink,box,oval,polygon,line,curve,label,cassette,agi,car,trafficCar} from './art.js';
const paper='#fff0d3',mint='#8ee2c4',rose='#ed99b7';
function skyline(c,v,s,d){
 const {w,h,horizon}=v,g=c.createLinearGradient(0,0,0,horizon+22);
 g.addColorStop(0,d.sky[0]);g.addColorStop(1,d.sky[1]);c.fillStyle=g;c.fillRect(0,0,w,h);
 const shift=(s.distance*(2+s.district))%(w*.115);
 oval(c,w*.73,horizon*.75,Math.min(w,h)*.070,Math.min(w,h)*.070,'#ffdda1');
 for(let i=0;i<14;i++){
  const x=w*(i*.096-.08)-shift,y=horizon-Math.sin(i*2.35+1)*h*.024;
  if(s.district===0){
   const ch=h*(.06+((i*7)%5)*.009);box(c,x,y-ch,w*.085,ch+20,1,i%2?'#aa8288':'#b99591');
   for(let j=0;j<3;j++)box(c,x+4+j*w*.018,y-ch+5,w*.008,3,0,'#e7bb99');
  }else if(s.district===1){
   polygon(c,[[x,y-10],[x+w*.053,y-h*.071],[x+w*.1,y-10]],'#a17675');box(c,x+4,y-10,w*.081,h*.06,0,'#c09a87');
   for(let j=0;j<4;j++)box(c,x+w*.016*j,y-10,w*.013,6,1,j%2?'#edbb90':'#b16e6d');
  }else if(s.district===2){
   const hi=h*(.11+((i*3)%4)*.028);line(c,[[x,y+9],[x,y-hi],[x+w*.075,y-hi],[x+w*.12,y-hi*.84]],'#aa8780',2);
   line(c,[[x,y-hi*.65],[x+w*.05,y-hi]],'#aa8780',1.5);
  }else{
   polygon(c,[[x-w*.05,y+12],[x+w*.05,y-h*.063],[x+w*.14,y+12]],'#b496a3');
  }
 }
 if(s.district===3||s.district===0){
  const r=Math.max(...s.air)/s.target,tx=w*.62,ty=horizon-h*(.06+.08*r),tw=h*(.018+.026*r);
  polygon(c,[[tx-tw,horizon+1],[tx,ty],[tx+tw,horizon+1]],null,'#775970',2);
  for(let k=1;k<4;k++)line(c,[[tx-tw*k/4,ty+(horizon-ty)*k/4],[tx+tw*k/4,ty+(horizon-ty)*k/4]],'#775970',1);
  line(c,[[tx,ty],[tx,ty-tw*.8]],'#775970',1.6);oval(c,tx,ty-tw*.8,2,2,'#e26274');
 }
}
function road(c,v,s,d){
 const pp=(x,z,y=0)=>project(v,x,z,y,s.distance,s.district);
 groundDetail(c,v,s,d);
 const step=1.03,phase=s.distance%step;
 for(let z=35-phase;z>-1.4;z-=step){
  const near=z-step,far=z,i=Math.floor((z+s.distance)/step);
  const plane=(xl,xr,color)=>{const a=pp(xl,far),b=pp(xr,far),e=pp(xr,near),f=pp(xl,near);polygon(c,[[a.x,a.y],[b.x,b.y],[e.x,e.y],[f.x,f.y]],color);};
  plane(-1.99,1.99,d.road);
  for(const side of [-1,1]){plane(side*1.99,side*1.88,i%2?'#f7d8b1':'#b5736e');plane(side*1.77,side*1.79,d.mark);}
  if(i%3!==0)for(const x of [-.8,0,.8])plane(x-.014,x+.014,'#ecd6b2');
  if(i%4===0){const l=pp(-1.87,z),r=pp(1.87,z);line(c,[[l.x,l.y],[r.x,r.y]],'#45394a15',1);}
 }
 // These props occupy actual positions outside the playable road.
 for(let j=6;j>=0;j--){
  const z=2.5+j*4.4-s.distance%4.4;if(z<-1)continue;
  const side=(j+Math.floor(s.distance/4.4))%2?1:-1,a=pp(side*2.06,z),b=pp(side*2.25,z);
  if(s.district===0){
   const l=pp(-2.10,z),r=pp(2.10,z),height=Math.min(a.s*.84,v.h*.27),color='#816475';
   box(c,l.x-3,l.y-height,Math.max(2,a.s*.065),height,1,color);
   box(c,r.x-3,r.y-height,Math.max(2,a.s*.065),height,1,color);
   if(j%2===0){line(c,[[l.x,l.y-height],[r.x,r.y-height]],'#9f7c807d',Math.max(1,a.s*.025));for(const f of [.15,.50,.85])oval(c,l.x+(r.x-l.x)*f,l.y-height+2,Math.max(1.2,a.s*.028),2,'#ffe69f');}
  }else if(s.district===1){
   if(j%2)continue;
   line(c,[[a.x,a.y],[a.x,a.y-a.s*.55]],'#785759',Math.max(1,a.s*.035));
   polygon(c,[[a.x-a.s*.25,a.y-a.s*.42],[a.x,a.y-a.s*.63],[a.x+a.s*.25,a.y-a.s*.42]],j%2?'#d87c79':'#85aaa0',ink,.8);
   oval(c,b.x,b.y-b.s*.24,b.s*.06,b.s*.08,'#e3a477',ink,.7);
  }else if(s.district===2){
   const k=a.s*.54;line(c,[[a.x,a.y],[a.x,a.y-k],[b.x,b.y-k*.84],[b.x,b.y]],'#8c705e',Math.max(1,k*.08));
   line(c,[[a.x,a.y-k*.69],[b.x,b.y-k*.25]],'#f5c48f',Math.max(1,k*.045));
  }else{
   line(c,[[a.x,a.y],[a.x,a.y-a.s*.67]],'#775e78',Math.max(1,a.s*.033));
   for(const t of [.32,.48,.60])line(c,[[a.x-a.s*.08,a.y-a.s*t],[a.x+a.s*.08,a.y-a.s*t]],'#826b81',Math.max(1,a.s*.024));
  }
 }
}
function lamps(c,v,s,style){
 const w=v.w,hh=v.top-4,x=Math.max(5,w*.018),width=w-2*x,compact=w<560,font=Math.max(12,Math.min(18,hh*.255));
 box(c,x+1,4,width,hh,Math.min(12,hh*.18),'#6b5060');box(c,x,1,width,hh,Math.min(12,hh*.18),'#fbebcf',ink,1.7);
 const local=style.local,accent=style.color||mint,opp=local?'ROSE':RIVALS[s.rival].name.toUpperCase(),mx=w*.50;
 const tapeWidth=Math.max(34,Math.min(76,width*.16,hh*1.14));
 cassette(c,mx,hh*.51,tapeWidth,style.reduced?0:s.time,s.owner===0?accent:s.owner===1?rose:'#ffe292');
 for(const i of [0,1]){
  const left=i?mx+tapeWidth*.66:x+Math.max(8,width*.022),right=i?w-x-Math.max(8,width*.022):mx-tapeWidth*.66;
  const barW=right-left,color=i?rose:accent,h=Math.max(7,hh*.15),y=hh*.66;
  const badge=i?Math.max(15,Math.min(30,hh*.38)):0;
  if(i){oval(c,right-badge*.53,hh*.32,badge*.51,badge*.51,'#efc6be','#9a7180',1);agi(c,right-badge*.53,hh*.34,badge*1.04,{turn:s.owner===0?-1:0,reach:s.cars[1].signal>0?1:0});}
  label(c,(i?opp:'MINT')+'  '+s.air[i].toFixed(1)+'s',i?right-badge-2:left,hh*.34,font,ink,i?'right':'left','AK Mono',barW-badge);
  box(c,left,y,barW,h,2,'#c9b6ab',ink,.9);
  const fill=barW*Math.min(1,s.air[i]/s.target);if(fill>1)box(c,i?right-fill:left,y,fill,h,2,color);
  if(s.owner===i){const xx=i?right:left;line(c,[[xx,y+h+2],[i?right-Math.min(barW,19):left+Math.min(barW,19),y+h+2]],ink,1.5);}
 }
}
function guide(c,v,s,style){
 const small=v.w<560,xx=v.w*.025,y=v.top+9,ww=Math.min(v.w*.52,335),hh=Math.max(26,Math.min(42,v.h*.083));
 box(c,xx,y,ww,hh,5,'#483347ed',ink,1);
 label(c,DISTRICTS[s.district].short+'  /  '+(s.config.mode==='marathon'?'FM '+s.health+'♥':'R'+s.round+'  '+s.wins.join('–')),xx+8,y+hh*.50,Math.max(12,Math.min(16,hh*.42)),'#ffebc7','left','AK Mono',ww-16);
 const b=s.cars[0],unit=Math.min(112,v.w*.27),right=v.w-xx;
 box(c,right-unit,y,unit,hh,5,'#fcf0cfed',ink,1);
 label(c,b.boost?'BOOSTING':b.drafting?'DRAFT '+Math.floor(b.charge*100)+'%':b.charge>=.995?'BOOST READY':'BOOST '+Math.floor(b.charge*100)+'%',right-unit*.5,y+hh*.50,Math.max(12,Math.min(15,hh*.43)),ink,'center','AK Mono',unit-7);
}
function captionStrip(c,v,text,sub,background='#fff0cd'){
 const w=Math.min(v.w*.85,470),h=Math.min(83,Math.max(43,v.h*.13)),x=(v.w-w)*.5,y=v.h*.33-h*.34;
 box(c,x+2,y+3,w,h,8,'#6e506c66');box(c,x,y,w,h,8,background,ink,1.8);
 label(c,text,v.w*.5,y+h*.38,Math.min(31,Math.max(16,h*.39)),ink,'center','AK Display',w-16);
 if(sub)label(c,sub,v.w*.5,y+h*.78,Math.max(12,Math.min(16,h*.24)),'#85596a','center','AK Sans',w-15);
}
export function drawDuel(c,s,w,h,style={}){
 const v=view(w,h),d=DISTRICTS[s.district],at=(x,z,alt=0)=>project(v,x,z,alt,s.distance,s.district);
 skyline(c,v,s,d);horizonDetail(c,v,s,d);road(c,v,s,d);roadsideDetail(c,v,s);
 for(const driver of s.cars){
  const p=at(driver.x,driver.z);
  if(driver.drafting||driver.boost){const size=p.s*.55;
   for(let k=0;k<3;k++)line(c,[[p.x+size*(k*.4-.4),p.y+size*.22],[p.x+size*(k*.42-.42),p.y+size*(.46+(k%2)*.2)]],driver.boost?'#ffe4a2':'#b8eadce0',Math.max(1,size*.027));}
  if(driver.signal>0||driver.blink>0){const blink=style.reduced||Math.floor(s.time*8)%2===0;
   if(blink)for(const side of [-1,1]){const a=at(driver.x+side*.19,driver.z+.28),b=at(driver.x+side*.37,driver.z+.99),e=at(driver.x+side*.15,driver.z+.99);polygon(c,[[a.x,a.y],[b.x,b.y],[e.x,e.y]],'#fff1a6c9');}}
 }
 const objects=[...s.traffic.map(o=>({z:o.z,object:o})),...s.cars.map(o=>({z:o.z,driver:o}))].sort((a,b)=>b.z-a.z);
 const p0=at(s.cars[0].x,s.cars[0].z),p1=at(s.cars[1].x,s.cars[1].z);
 if(s.owner>=0&&canLink(s)&&s.released&&!s.lock){c.save();c.setLineDash([4,4]);line(c,[[p0.x,p0.y-8],[p1.x,p1.y-8]],s.pending?'#fff3b6':'#f7cd69',3);c.restore();}
 for(const a of objects){
  const o=a.object||a.driver,p=at(o.x,o.z);
  if(a.object)trafficCar(c,p,o);
  else{car(c,p.x,p.y,p.s,o,s,o.id===0?style.color||mint:RIVALS[s.rival].body,s.rival===3&&o.id===1?'courier':'convertible',style.reduced);
   if(o.id===s.owner){const cy=p.y-p.s*.47;box(c,p.x-12,cy-6,24,12,5,'#ffe5a0',ink,1);
    oval(c,p.x-4,cy,2.6,2.6,null,ink,1);oval(c,p.x+4,cy,2.6,2.6,null,ink,1);}
  }
 }
 if(s.owner===-1){const t=Math.min(1,s.roundTime/2.15),xx=(p0.x+p1.x)*.5,yy=v.top+(p1.y-v.top)*t*t;
  cassette(c,xx,yy,Math.max(27,p1.s*.35),style.reduced?0:s.time); }
 if(s.handoff){const t=Math.min(1,s.handoff.age/.56),from=s.handoff.who?p0:p1,to=s.handoff.who?p1:p0;
  curve(c,[from.x,from.y-7,from.x,from.y-30,to.x,to.y-30,to.x,to.y-7],'#ffe381',3);
  cassette(c,from.x+(to.x-from.x)*t,from.y+(to.y-from.y)*t-Math.sin(t*Math.PI)*18-8,Math.max(20,Math.min(45,w*.075)),s.time);}
 if(s.pending){const lost=s.pending.who===1;
  const tag=lost?'TWO FLASHES · JAM':'REACHING FOR TAPE',yy=Math.max(v.top+50,Math.min(p0.y,p1.y)-Math.min(p0.s,p1.s)*.64);
  const ww=Math.min(w*.56,240);
  box(c,w*.5-ww*.5,yy-10,ww,20,6,lost?'#ffe29d':'#dcf5d6',ink,1);label(c,tag,w*.5,yy,Math.max(12,Math.min(15,w*.025)),ink,'center','AK Mono',ww-9);
 }
 lamps(c,v,s,style);guide(c,v,s,style);
 const lineText=s.sudden?'Overtime · hold 1.5s':s.owner<0?'Tape drop · pull level with rose':s.pending?(s.pending.who===1?'JAM NOW or move your door clear':'Hold your line until the splice lands'):s.lock>.01?'Rewinding · '+s.lock.toFixed(1)+'s':s.owner===0?'ON AIR · '+s.target+'s takes the round':!s.released?'Break away once, then rejoin':s.connected?'GOLD LINK · SNATCH':s.cars[1].z-s.cars[0].z>.43?'Rose is ahead · accelerate ↑':s.cars[0].z-s.cars[1].z>.43?'Rose is behind · ease back ↓':Math.abs(s.cars[0].x-s.cars[1].x)<.25?'Move alongside her door':'Close the lane gap toward Rose';
 const yy=h-13,ww=Math.min(w*.92,525);box(c,(w-ww)*.5,yy-11,ww,22,6,'#493748e8',ink,1);
 label(c,lineText,w*.5,yy,Math.min(17,Math.max(12,w*.031)),'#fff0ca','center','AK Sans',ww-13);
 if(s.phase==='break'){const r=s.record.at(-1);captionStrip(c,v,(r.winner===0?'Mint':'Rose')+' wins round '+r.round,r.air.map(t=>t.toFixed(1)+'s').join('   /   ')+'     ·     Next district ahead');}
 if(style.handoff)captionStrip(c,v,'Pass the phone to Rose','Same road. Same rival. Beat Mint’s broadcast.');
}
