import {oval,polygon,line} from '../kit/illustration.js';
import {detail} from './set-dressing.js';
import {PLACES} from './assignments.js';
import {optics,focusQuality} from './camera.js';
import {drawAgi,drawCat} from './figure.js';
import {figureLayer} from './layers.js';
const ink='#413447';
export function box(c,x,y,w,h,r,fill,stroke=null,lw=1){if(w<=0||h<=0)return;c.beginPath();c.roundRect(x,y,w,h,Math.min(r,w*.5,h*.5));if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=lw;c.stroke();}}
export function txt(c,str,x,y,sz,fill=ink,align='left',family='AK Sans',max=9999){
 c.textBaseline='middle';c.textAlign=align;c.font='750 '+sz+'px "'+family+'",sans-serif';c.fillStyle=fill;c.fillText(str,x,y,max);
}
function speck(n){const m=Math.sin(n*73.773+22.892)*7432.121;return m-Math.floor(m);}
export function photograph(c,scene,cam,x,y,w,h){
 const loc=PLACES[scene.a.place];c.save();c.translate(x,y);c.beginPath();c.rect(0,0,w,h);c.clip();
 const cy=Math.cos(cam.pan),sy=Math.sin(cam.pan),ct=Math.cos(cam.tilt),st=Math.sin(cam.tilt),f=optics[cam.lens]*(1+(1/cam.focus-.25)*.035);
 const at=(x,y,z)=>{const dx=x-cam.truck,dy=y-1.30,forward=z*cy+dx*sy,depth=forward*ct+dy*st,s=f/Math.max(.15,depth),v=.5-(dy*ct-forward*st)*s*1.5;return {x:(.5+(dx*cy-z*sy)*s)*w,y:v*h,s:s*w,v,depth};};
 const grad=c.createLinearGradient(0,0,0,h);grad.addColorStop(0,loc.sky[0]);grad.addColorStop(.69,loc.sky[1]);grad.addColorStop(1,loc.ground);c.fillStyle=grad;c.fillRect(0,0,w,h);
 const sun=at(5.8,4.7,25);oval(c,sun.x,sun.y,sun.s*1.38,sun.s*1.38,loc.light);
 // Far buildings and mountains move more slowly than the set the subject walks on.
 if([0,7].includes(scene.a.place)){
  for(let lay=0;lay<2;lay++){
   const ridge=[];for(let k=-32;k<33;k++){const yy=1.4+(Math.sin(k*.74+lay*2)*.59+speck(k+lay)*.45)*(2-lay),p=at(k*1.75,yy,24-lay*5);ridge.push([p.x,p.y]);}
   ridge.push([w+100,h],[-100,h]);polygon(c,ridge,lay?'#99aaa1':'#b6b7ad');
  }
 }else for(let layer=0;layer<2;layer++)for(let j=-17;j<18;j++){
  const z=layer?12:22,bd=at(j*(layer?1.17:2.27),.15,z),height=(1.7+speck(j+layer*17+scene.a.place)*3.0)*bd.s,bw=bd.s*(layer?1.07:2.0);
  if(bd.x>w||bd.x+bw<0)continue;
  box(c,bd.x,bd.y-height,bw,height,0,layer?loc.line+'a8':'#9993a196');
  if(scene.a.place===1)polygon(c,[[bd.x-2,bd.y-height],[bd.x+bw*.55,bd.y-height-bw*.33],[bd.x+bw+3,bd.y-height]],'#92757b');
  if(scene.a.place===2||scene.a.place===3)line(c,[[bd.x+bw*.75,bd.y-height],[bd.x+bw*.75,bd.y-height-bw*.27]],loc.line,Math.max(.7,bd.s*.017));
  const rw=bw*.13;for(let col=0;col<3;col++)for(let row=0;row<5;row++){
   const xx=bd.x+bw*(.14+col*.25),yy=bd.y-height+bd.s*.23+row*bd.s*.37;if(yy>bd.y-4)continue;
   box(c,xx,yy,rw,bd.s*.19,0,scene.a.place===3&&((j+col+row)%3===0)?'#ffc6c2':'#dbc8ae88');
  }
 }
 const horizon=at(0,0,14).y;c.fillStyle=loc.ground;c.fillRect(0,horizon,w,Math.max(0,h-horizon));
 if([1,4,7].includes(scene.a.place)){
  const gg=c.createLinearGradient(0,horizon,0,h);gg.addColorStop(0,loc.sky[1]);gg.addColorStop(1,loc.ground);c.fillStyle=gg;c.fillRect(0,horizon,w,h-horizon);
  for(let i=0;i<46;i++){const z=2.1+speck(i+1)*10,x0=(speck(i+80)-.5)*15,p=at(x0,0,z);
   line(c,[[p.x+Math.sin(scene.t*1.2+i)*2,p.y],[p.x+p.s*(.10+speck(i+6)*.43),p.y]],'#fff0ce89',Math.max(.6,p.s*.008));}
 }else{
  for(let i=-12;i<=12;i++){const a=at(i*.8,0,1.6),b=at(i*.8,0,14);line(c,[[a.x,a.y],[b.x,b.y]],'#ede2c781',Math.max(.6,w*.0016));}
  for(let i=2;i<15;i+=1.28){const a=at(0,0,i);line(c,[[0,a.y],[w,a.y]],'#e9d4bc88',Math.max(.7,w*.0015));}
 }
 scenery(c,scene,loc,at,w,h);detail(c,scene,at,w,h);
 const root=at(scene.foot.x,scene.foot.y,scene.foot.z),head=at(scene.eye.x,scene.eye.y,scene.eye.z);
 const actual=(root.y-head.y)/(scene.a.pose==='crouch'?.76:.80);
 const sharp=focusQuality(head.depth,cam.focus,cam.lens);
 const hero=()=>{
  oval(c,root.x+actual*.025,root.y+1,Math.max(3,actual*.145),Math.max(1,actual*.029),'#55475c36');
  const reflection=[1,4,7].includes(scene.a.place)&&root.y<h,soft=sharp<.90;
  const layer=soft||reflection?figureLayer(c,actual,scene):null;
  const draw=(x,y)=>{if(layer)layer.draw(c,x,y);else drawAgi(c,x,y,actual,scene,scene.light);};
  if(reflection){
   c.save();c.translate(root.x,root.y);
   c.scale(1,-Math.max(.2,(at(scene.reflection.x,scene.reflection.y,scene.reflection.z).y-root.y)/(actual*.8)));
   c.globalAlpha=.20;draw(0,0);c.restore();
  }
  c.save();
  if(soft&&layer)c.filter='blur('+((1-sharp)*Math.min(4,w*.007)).toFixed(2)+'px)';
  draw(root.x,root.y);c.restore();
 };
 const kitty=()=>{if(!scene.catVisible)return;const p=at(scene.cat.x,scene.cat.y,scene.cat.z);drawCat(c,p.x,p.y,p.s*.42,scene.t,scene.plan.side);};
 const objects=[{z:scene.z,draw:hero},{z:scene.cat.z,draw:kitty},...scene.posts.filter(q=>q.kind!=='cat').map(q=>({z:q.z,draw(){
  const foot=at(q.x,q.bottom,q.z),top=at(q.x,q.top,q.z),width=foot.s*q.r*2;
  if(q.kind==='crowd'){oval(c,top.x,top.y+width*.43,width*.47,width*.53,'#876f78');box(c,top.x-width*.53,top.y+width*.85,width*1.06,foot.y-top.y,width*.42,'#938698');return;}
  box(c,top.x-width/2,top.y,width,Math.max(2,foot.y-top.y),width*.08,loc.line);line(c,[[top.x-width*.27,top.y+2],[foot.x-width*.27,foot.y]],'#d6b79b',Math.max(.9,width*.12));
  if(q.kind==='flag')polygon(c,[[top.x,top.y],[top.x+width*2.1,top.y+width*.5],[top.x,top.y+width]],'#e9a1b0');
  else if(q.kind==='awning')box(c,top.x-width*1.6,top.y-3,width*3.2,width*.39,2,'#b67e85');
  else{oval(c,top.x,top.y,width*.67,width*.18,'#b69991',loc.line,1);}
 } }))];
 objects.sort((a,b)=>b.z-a.z).forEach(o=>o.draw());
 if(scene.a.place===0||scene.a.place===4)for(let i=0;i<19;i++){
  const drift=(scene.t*(scene.a.place===4?.21:.028)+i*.147)%1,xx=(speck(i+4)*w+Math.sin(i+scene.t*.34)*w*.03),yy=drift*h;
  if(scene.a.place===0){c.save();c.translate(xx,yy);c.rotate(i+.3*scene.t);oval(c,0,0,Math.max(.9,w*.005),Math.max(.7,w*.0022),'#f9d2d4ac');c.restore();}
  else line(c,[[xx,yy],[xx-2,yy+5]],'#eef0e19c',.8);
 }
 c.restore();
}
function scenery(c,scene,loc,at,w,h){
 const place=scene.a.place;
 if(place===0){
  for(let i=-5;i<=5;i++){const x=i*2.2+.61,z=6.0+Math.abs(i%3)*.6,foot=at(x,0,z),trunk=at(x-.18,1.6,z),fork=at(x+.47,2.55,z);
   if(foot.x< -foot.s*1.65||foot.x>w+foot.s*1.65)continue;
   line(c,[[foot.x,foot.y],[trunk.x,trunk.y],[fork.x,fork.y]],'#886d74',Math.max(2,foot.s*.11));
   line(c,[[trunk.x,trunk.y],[trunk.x-foot.s*.56,trunk.y-foot.s*.57]],'#8e7379',Math.max(1,foot.s*.062));
   for(let j=0;j<16;j++){const leaf=at(x+(speck(j*7+i)-.5)*2.11,2.5+(speck(j*5+i)-.5)*1.17,z+.27),r=leaf.s*(.19+speck(j*3+i)*.23);
    oval(c,leaf.x,leaf.y,r,r*.76,['#c58c99','#daa3ad','#efbac2','#f4cdd0'][Math.abs((j+i)%4)]);}
  }
 }
 if([1,2,7].includes(place)){
  for(const ht of [.53,.62]){const a=at(-16,ht,6.2),b=at(16,ht,6.2);line(c,[[a.x,a.y],[b.x,b.y]],loc.line,Math.max(1,w*.006));}
  for(let i=-16;i<=16;i++){const a=at(i*.67,0,6.2),b=at(i*.67,.66,6.2);line(c,[[a.x,a.y],[b.x,b.y]],loc.line,Math.max(1,a.s*.035));}
  if(place===2)for(let i=-5;i<6;i++){const p=at(i*1.77,0,6.8);box(c,p.x-p.s*.30,p.y-p.s*.34,p.s*.60,p.s*.34,3,'#ad857e');
   for(let j=0;j<5;j++)oval(c,p.x+(j-2)*p.s*.082,p.y-p.s*(.33+(j%2)*.15),p.s*.095,p.s*.18,'#839286');}
 }
 if(place===3||place===4||place===6){
  for(let i=-4;i<=4;i++){
   const a=at(i*1.6,2.05,6.0),b=at(i*1.6,2.65,6.0);
   if(place===3){box(c,a.x-a.s*.2,b.y,a.s*.41,Math.max(3,a.y-b.y),2,i%2?'#df99a7':'#8db7af','#755d77');
    for(let j=0;j<3;j++)box(c,a.x-a.s*.11,b.y+(j+.5)*a.s*.15,a.s*.21,a.s*.035,1,'#fff0c8');}
   if(place===4){const p=at(i*1.6-1.1,2.35,6.4);polygon(c,[[p.x,p.y],[a.x+a.s*.58,b.y],[a.x+a.s*.83,a.y],[p.x-a.s*.2,p.y+a.s*.2]],i%2?'#c78d91':'#e1c4ae',loc.line,1);}
   if(place===6){const foot=at(i*1.6,0,6.6);line(c,[[a.x,b.y],[foot.x,foot.y]],'#798986',Math.max(2,a.s*.075));box(c,a.x-a.s*.62,b.y-a.s*.19,a.s*1.25,a.s*.16,1,'#a78f77');}
  }
 }
 if(place===5||place===1){
  const wire=[];for(let j=-14;j<=14;j++){const x=j*.43,z=6.25,p=at(x,2.42+Math.sin(j*.36)*.18,z);wire.push([p.x,p.y]);
   if(j%2===0){if(place===5)polygon(c,[[p.x,p.y],[p.x+p.s*.26,p.y-2],[p.x+p.s*.13,p.y+p.s*.29]],['#df9f93','#e0c481','#92afa5'][Math.abs(j)%3],loc.line,.55);
   else oval(c,p.x,p.y+p.s*.086,p.s*.073,p.s*.09,'#e8ad83','#9b7779',.75);}}
  line(c,wire,loc.line,1);
 }
}
