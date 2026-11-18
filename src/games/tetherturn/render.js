import {sprite} from '../kit/field-art.js';
import {cupAt,clamp} from './flight.js';
import {systems,systemInk} from './courses.js';
const face=sprite(new URL('/images/agi1-portrait-2d.webp',import.meta.url));
const paper='#fff1c7',brass='#f6d295',dark='#18223a',TAU=Math.PI*2;
function path(c,pts,col,width=1){c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=col;c.lineWidth=width;c.lineCap=c.lineJoin='round';c.stroke();}
function disc(c,x,y,rx,ry,col,edge=null,width=1){c.beginPath();c.ellipse(x,y,Math.max(.01,rx),Math.max(.01,ry),0,0,TAU);if(col){c.fillStyle=col;c.fill();}if(edge){c.strokeStyle=edge;c.lineWidth=width;c.stroke();}}
function poly(c,pts,fill,edge=dark,width=2){c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();if(edge){c.strokeStyle=edge;c.lineWidth=width;c.stroke();}}
function label(c,s,x,y,size,fill=paper,align='left',weight=850,max=1e4){c.textAlign=align;c.textBaseline='middle';c.font=weight+' '+size+'px "AK Sans",system-ui';c.fillStyle=fill;c.fillText(s,x,y,max);}
function panel(c,x,y,w,h,color,edge){c.beginPath();c.roundRect(x,y,w,h,9);c.fillStyle=color;c.fill();if(edge){c.strokeStyle=edge;c.lineWidth=1.3;c.stroke();}}
export function chart(leg,w,h){
 const vertical=w/h<1.04,top=60,bottom=58,spaceW=w-14,spaceH=Math.max(60,h-top-bottom);
 const all=[leg.tee,...leg.wells,leg.cup,...leg.rings],xs=all.map(v=>v.x),ys=all.map(v=>v.y);
 const minx=Math.min(...xs)-46,maxx=Math.max(...xs)+57,miny=Math.min(...ys)-55,maxy=Math.max(...ys)+55;
 const cx=(minx+maxx)*.5,cy=(miny+maxy)*.5,ww=maxx-minx,hh=maxy-miny,s=Math.min(spaceW/(vertical?hh:ww),spaceH/(vertical?ww:hh));
 const mid=[w/2,top+spaceH/2],world=(x,y)=>vertical?[mid[0]+(y-cy)*s,mid[1]-(x-cx)*s]:[mid[0]+(x-cx)*s,mid[1]+(y-cy)*s];
 const flight=(sx,sy)=>vertical?[cx-(sy-mid[1])/s,cy+(sx-mid[0])/s]:[cx+(sx-mid[0])/s,cy+(sy-mid[1])/s];
 return {world,flight,s,vertical,top,bottom};
}
function star(c,x,y,r,color){poly(c,[[x,y-r],[x+r*.21,y-r*.22],[x+r,y],[x+r*.21,y+r*.22],[x,y+r],[x-r*.21,y+r*.22],[x-r,y],[x-r*.21,y-r*.22]],color,null);}
function sky(c,w,h,pal,sys,time){
 const b=c.createLinearGradient(w*.2,0,w,h);b.addColorStop(0,pal[0]);b.addColorStop(.60,'#11182f');b.addColorStop(1,pal[0]);c.fillStyle=b;c.fillRect(0,0,w,h);
 const glow=c.createRadialGradient(w*.82,h*.18,4,w*.82,h*.18,w*.60);glow.addColorStop(0,pal[1]+'28');glow.addColorStop(.68,pal[2]+'10');glow.addColorStop(1,'#17192c00');c.fillStyle=glow;c.fillRect(0,0,w,h);
 // Hand-print clouds of stardust along a different curved ecliptic for each constellation.
 c.save();c.globalCompositeOperation='screen';for(let i=0;i<29;i++){const u=i/28,xx=w*(u-.07),yy=h*(.32+.20*Math.sin(u*5+sys*.72)-u*.18),r=Math.max(14,Math.min(w,h)*(.09+.03*Math.sin(i*3.1)));
 const n=c.createRadialGradient(xx,yy,0,xx,yy,r);n.addColorStop(0,(i%3?pal[1]:pal[2])+'1a');n.addColorStop(.58,(i%3?pal[1]:pal[2])+'0c');n.addColorStop(1,'#17213f00');c.fillStyle=n;c.fillRect(xx-r,yy-r,r*2,r*2);}c.restore();
 const motif=[[-.7,.05],[-.4,-.35],[-.07,-.05],[.28,-.56],[.65,-.18],[.9,-.42]],anchorX=w*.78,anchorY=h*.25,spacing=Math.min(w,h)*.12;
 path(c,motif.map(([x,y])=>[anchorX+x*spacing,anchorY+y*spacing]),pal[1]+'63',1);motif.forEach(([x,y],i)=>star(c,anchorX+x*spacing,anchorY+y*spacing,2+i%2,paper));
 const count=Math.round(w*h/1400);for(let i=0;i<count;i++){const x=((i*349+37*sys+Math.sin(i*.7)*41)%997)/997*w,y=((i*167+59*sys+Math.cos(i*.3)*13)%751)/751*h;const r=.54+(i%9)*.115;disc(c,x,y,r,r,i%4===0?'#bfaad4':'#dddfd2');if(i%15===0)star(c,x,y,3+Math.sin(time*.9+i)*.5,pal[1]);}
 c.save();c.globalAlpha=.14;for(let i=0;i<4;i++){c.beginPath();c.ellipse(w*.74,h*.46,w*(.26+i*.09),h*(.13+i*.07),-.4,0,TAU);c.strokeStyle=brass;c.lineWidth=.8;c.stroke();}c.restore();
}
function planets(c,g,leg,sys,pal,time){
 for(let i=0;i<leg.wells.length;i++){
 const w=leg.wells[i],wx=w.x+Math.sin(time*(w.rate||0)+(w.phase||0))*(w.drift||0),wy=w.y+Math.cos(time*(w.rate||0)+(w.phase||0))*(w.drift||0),[x,y]=g.world(wx,wy);
 const r=Math.max(13,Math.min(77,(17+(w.mass/17000))*g.s)),col=i%2?pal[2]:pal[1];
 for(let n=1;n<=3;n++){c.save();c.setLineDash(n===2?[4,7]:[]);disc(c,x,y,r*(1.25+n*.32),r*(1.25+n*.32),null,col+(n===2?'66':'36'),1);c.restore();}
 c.save();c.translate(x,y);c.rotate(-.37+i*.37);disc(c,2,5,r*1.06,r*.97,'#080e20b0');
 const orb=c.createRadialGradient(-r*.38,-r*.46,r*.09,0,0,r*1.12);orb.addColorStop(0,'#fcf0bb');orb.addColorStop(.35,col);orb.addColorStop(.83,pal[0]);orb.addColorStop(1,'#14152b');disc(c,0,0,r,r,orb,col,2);
 c.save();c.beginPath();c.arc(0,0,r-.6,0,TAU);c.clip();
 if((sys+i)%3===0){for(let j=0;j<6;j++){c.beginPath();c.ellipse(-r*.38,-r*.15+j*r*.27,r*1.3,r*.27,-.16,Math.PI*.08,Math.PI*1.02);c.strokeStyle=j%2?'#f1e5ba60':'#7c6b9566';c.lineWidth=r*.085;c.stroke();}}
 else if((sys+i)%3===1){for(let j=0;j<9;j++){const a=j*2.35,rr=r*(.30+j*.052);disc(c,Math.cos(a)*rr,Math.sin(a)*rr,r*(.07+j%3*.025),r*(.045+j%3*.025),'#7b74905a','#ffe7b95c',1);}}
 else{for(let j=0;j<4;j++){const yy=r*(-.58+j*.37);path(c,[[-r,yy],[0,yy+r*.12],[r,yy-r*.12]],'#7e7b9d99',r*.07);}disc(c,r*.18,r*.24,r*.25,r*.095,'#e7acb499');}
 c.restore();if((sys+i)%2===1){c.beginPath();c.ellipse(0,2,r*1.46,r*.36,0,0,Math.PI);c.lineWidth=Math.max(3,r*.12);c.strokeStyle=brass;c.stroke();}
 c.restore();}
}
function capsule(c,x,y,size,heading,sign,blast,time){
 c.save();c.translate(x,y);c.rotate(heading);c.scale(size/22,size/22);
 if(blast>0){poly(c,[[-14,-4],[-25-blast*10,0],[-14,4]],'#a5ecda',null);poly(c,[[-14,-2],[-23-blast*4,0],[-14,2]],'#ffda8a',null);}
 const fin=sign<0?'#eb8ac9':'#88dbcf';poly(c,[[-7,-4],[-14,-16],[2,-9],[9,-3]],fin,'#24223a',1.4);poly(c,[[-7,3],[-13,15],[4,9],[11,3]],fin,'#24223a',1.4);
 poly(c,[[-18,-4],[-4,-10],[10,-9],[20,-2],[22,2],[11,8],[-6,9],[-17,5]],'#f4cb93','#222038',1.8);path(c,[[-10,5],[3,7],[17,2]],'#b16e8d',2.2);
 // The little helmet is upright inside the tilted foil body.
 c.save();c.translate(3,-4);c.rotate(-heading);disc(c,0,0,9,9,'#abe5e7','#393454',1.5);c.save();c.beginPath();c.arc(0,0,7.4,0,TAU);c.clip();if(!face(c,-8,-9,16,18)){disc(c,0,1,5,6,'#e2aa88');disc(c,-1,-2,5,3,'#f0c06f');}c.restore();path(c,[[-5,-4],[-2,-6],[2,-6]],'#f9f6d4',1);c.restore();c.restore();
}
export function draw(c,w,h,v){
 const {leg,course,f,phase,time,angle,power}=v,g=chart(leg,w,h),sys=course.system,pal=systemInk[sys],ft=f?.tick||0,t=ft/120;
 c.save();sky(c,w,h,pal,sys,v.reduced?0:time);planets(c,g,leg,sys,pal,t);
 const [tx,ty]=g.world(leg.tee.x,leg.tee.y),teeR=Math.max(8,g.s*12);
 disc(c,tx,ty,teeR*1.5,teeR*.83,'#263449',brass,2);disc(c,tx,ty-2,teeR,teeR*.55,null,'#8defce',1.5);
 if(v.ghost?.length){c.setLineDash([3,8]);path(c,v.ghost.map(([x,y])=>g.world(x,y)),'#e7b8ee85',2);c.setLineDash([]);}
 for(const [i,r] of leg.rings.entries()){const [x,y]=g.world(r.x,r.y),rr=Math.max(6,r.radius*g.s*.68);disc(c,x,y,rr,rr*.77,null,(f?.ringMask&(1<<i))?'#829491':'#f6ce7e',2.7);star(c,x,y,3,'#ffe0a0');}
 if(leg.optional&&!f?.post){const [x,y]=g.world(leg.optional.x,leg.optional.y);c.save();c.translate(x,y);c.rotate(-.3);poly(c,[[-5,0],[0,-4],[5,0],[0,4]],brass);for(const s of [-1,1])poly(c,[[s*4,-2],[s*13,-4],[s*13,2],[s*4,3]],pal[1],dark,1);c.restore();}
 if(leg.beacon){const [x,y]=g.world(leg.beacon.x,leg.beacon.y),rr=leg.beacon.radius*g.s; c.setLineDash([5,5]);disc(c,x,y,rr,rr,null,f?.charged?'#a0f2ba':'#c5b6ff',2);c.setLineDash([]);label(c,f?.charged?'CHARGED':'PULSE ZONE',x,y+rr+11,12,paper,'center');}
 const loc=cupAt(leg,ft),[cx,cy]=g.world(loc.x,loc.y),r=Math.max(12,leg.radius*g.s),gate=loc.gate+(g.vertical?-Math.PI/2:0)+Math.PI;
 disc(c,cx,cy,r,r,pal[1]+'18');c.beginPath();c.arc(cx,cy,r,gate+leg.gateWidth,gate-leg.gateWidth+TAU);c.strokeStyle=leg.phaseRequired?'#efa5d9':pal[1];c.lineWidth=4;c.stroke();
 for(const a of [gate-leg.gateWidth,gate+leg.gateWidth])disc(c,cx+Math.cos(a)*r,cy+Math.sin(a)*r,3.1,3.1,brass);
 c.save();c.translate(cx,cy);c.rotate(-.13);path(c,[[0,4],[0,-14]],brass,1.8);poly(c,[[0,-14],[12,-12],[1,-7]],leg.phaseRequired?'#ed94d6':pal[1],null);c.restore();
 if(phase==='capture'||phase==='card'){c.beginPath();c.arc(cx,cy,r+5,-Math.PI/2,-Math.PI/2+TAU*(phase==='card'?1:clamp(f.hold/leg.settle,0,1)));c.strokeStyle=brass;c.lineWidth=3;c.stroke();}
 const body=f||leg.tee,[px,py]=g.world(body.x,body.y),heading=(f?Math.atan2(f.vy,f.vx):angle)+(g.vertical?-Math.PI/2:0);
 if(f?.tail?.length>1){path(c,f.tail.map(([x,y])=>g.world(x,y)),f.sign<0?'#e6a3d9':'#8ce4cb',Math.max(1.5,g.s*2));}
 if(!f){const len=32+65*power;c.setLineDash([5,5]);path(c,[[tx,ty],[tx+Math.cos(heading)*len,ty+Math.sin(heading)*len]],'#efdf9e',2);c.setLineDash([]);
 const back=13+power*12;path(c,[[tx-13,ty+11],[tx-Math.cos(heading)*back,ty-Math.sin(heading)*back],[tx+13,ty+6]],pal[2],2.5);}
 capsule(c,px,py,Math.max(20,Math.min(42,g.s*23)),heading,f?.sign||1,v.blast,time);
 panel(c,7,5,Math.min(w-14,450),44,'#11192be6','#9b8ba4');label(c,course.name,18,20,w<480?19:23,paper,'left',900,Math.min(w-85,335));label(c,systems[sys].toUpperCase()+'   ·   FLAG '+(course.id+1)+' / 36   ·   PAR '+course.par,18,39,12,pal[1]);
 if(w>630){label(c,phase==='aim'?'SLING STRETCH':phase==='capture'?'ORBIT HOLD':'RELATIVE SPEED',w-14,18,12,paper,'right');label(c,phase==='aim'?Math.round(power*100)+'%':Math.round(Math.hypot((f?.vx||0)-loc.vx,(f?.vy||0)-loc.vy))+' / '+Math.round(leg.maxSpeed),w-14,39,17,pal[1],'right');}
 if(w<=630){const value=f?Math.hypot(f.vx-loc.vx,f.vy-loc.vy):0,lim=leg.maxSpeed;const gw=82,x=w-gw-13,y=65;panel(c,x-5,y-11,gw+10,29,'#141a2de8','#757888');label(c,f?'CUP SPEED':'SLING',x,y-3,12,paper);path(c,[[x,y+9],[x+gw,y+9]],'#4a4f66',4);path(c,[[x,y+9],[x+gw*.67,y+9]],pal[1],4);const ix=x+gw*clamp(f?value/lim*.67:power,0,1);poly(c,[[ix-3,y+3],[ix+3,y+3],[ix,y+9]],brass,null);}
 const msg=v.notice,pxs=w<500?12:15;panel(c,8,h-58,w-16,25,'#11192be8','#928c9c');label(c,msg,16,h-45,pxs,paper,'left',790,w-32);c.restore();
}
