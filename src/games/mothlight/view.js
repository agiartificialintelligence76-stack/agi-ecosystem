import { artwork, clamp, ellipse, label, line, paintArtwork, rect, shape } from '../kit/garden-art.js';
import { project, focusQuality } from './camera.js';

const agi=artwork('/images/landing/agi1-cutout.webp');
const backplates=['sakura','venice','rooftop','tokyo'].map(id=>artwork('/pfp/v1/'+id+'.webp'));
export const places=[
 {name:'Cherry walk',sky:['#516e8b','#d6c3a7'],wall:'#526b65',dark:'#354c50',glow:'#ffd79b',floor:'#a8a38c',detail:'butterfly'},
 {name:'Canal pier',sky:['#8d85ac','#ffc99a'],wall:'#8b738b',dark:'#504e68',glow:'#ffe19c',floor:'#9b929a',detail:'kite'},
 {name:'Rooftop garden',sky:['#5c628d','#efbb9c'],wall:'#777792',dark:'#505370',glow:'#ffdda2',floor:'#9598a3',detail:'star'},
 {name:'Neon promenade',sky:['#403c72','#c17a95'],wall:'#715781',dark:'#3d385b',glow:'#ffb4cb',floor:'#887e95',detail:'heart'},
];
function coStar(ctx,id,x,y,scale,t){
 ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
 if(id===0){for(const s of [-1,1]){ellipse(ctx,s*7,-4,7,11,'#ffc85b',s*.7);ellipse(ctx,s*5,4,4,5,'#403244',s);}}
 if(id===1){shape(ctx,[[0,-17],[12,0],[0,15],[-12,0]],'#ee665a');shape(ctx,[[0,-17],[12,0],[0,15]],'#ffe582');line(ctx,[[0,15],[7,26],[Math.sin(t)*5,35]],'#fff0cc',2);}
 if(id===2||id===3){label(ctx,id===2?'✦':'♥',0,0,35,id===2?'#ffe18a':'#ff8ab3','center');line(ctx,[[0,11],[2,23],[-2,32]],'#ffe9be',1);}
 ctx.restore();
}
function roof(ctx,camera,lens,id,t){
 const p=places[id],grad=ctx.createLinearGradient(0,49,0,341);grad.addColorStop(0,p.sky[0]);grad.addColorStop(1,p.sky[1]);ctx.fillStyle=grad;ctx.fillRect(0,40,480,315);
 const angle=(x,y,z)=>project({x,y,z},camera,lens);
 const sun=angle(8,6,37);ellipse(ctx,sun.x,sun.y,1.2*sun.scale,1.2*sun.scale,'#ffe5b0');
 const plate=backplates[id];
 if(plate?.naturalWidth){
  const bg=angle(0,1.32,18),width=Math.max(560,bg.scale*13),height=width*.77;
  ctx.drawImage(plate,0,plate.naturalHeight*.14,plate.naturalWidth,plate.naturalHeight*.77,bg.x-width/2,bg.y-height*.52,width,height);
  const shade=ctx.createLinearGradient(0,80,0,342);shade.addColorStop(0,'rgba(19,22,41,.04)');shade.addColorStop(1,'rgba(19,22,41,.18)');
  ctx.fillStyle=shade;ctx.fillRect(0,45,480,300);
  const rail=angle(0,.51,7.5);line(ctx,[[-5,rail.y],[485,rail.y]],'#302948',3);
  line(ctx,[[-5,rail.y-1],[485,rail.y-1]],'#b9a0bb',1);
  for(let i=-12;i<=12;i++){
   const foot=angle(i*.70,0,7.5),top=angle(i*.70,.53,7.5);
   line(ctx,[[foot.x,foot.y],[top.x,top.y]],'#493c60',2.4);
  }
  return;
 }
 {
  for(let layer=0;layer<2;layer++){const z=layer===0?28:16;ctx.globalAlpha=layer===0?.48:.86;
   for(let j=-15;j<=15;j++){const x=j*(layer?1.2:2.1),h=1.5+2.8*(.5+.5*Math.sin(j*71+id)),b=angle(x,0,z),top=angle(x,h,z),wid=(layer?1.08:1.8)*b.scale;
    rect(ctx,b.x,top.y,wid,b.y-top.y,1,layer?p.dark:p.wall);
    if((j+id)%3===0)shape(ctx,[[b.x,top.y],[b.x+wid*.5,top.y-12],[b.x+wid,top.y]],layer?p.dark:p.wall);
    if(j%2===0)line(ctx,[[b.x+wid*.79,top.y],[b.x+wid*.79,top.y-9]],p.dark,1.5);
    for(let k=0;k<9;k++){const px=b.x+(k%3+.4)*wid/3,py=top.y+4+Math.floor(k/3)*8;
     if(py<b.y-2)rect(ctx,px,py,2.2+(id===3),3,0,(j+k)%4?'#e5bc98':'#b7a1ac');}
   }
  }ctx.globalAlpha=1;
 }
 const horizon=angle(0,0,15);ctx.fillStyle=p.floor;ctx.fillRect(0,horizon.y,480,355-horizon.y);
 for(let j=-12;j<=12;j++){const near=angle(j*.55,0,1.4),far=angle(j*.55,0,15);line(ctx,[[near.x,near.y],[far.x,far.y]],'#ead4bc7a',1.1);}
 for(let j=2;j<15;j+=1.1){const v=angle(0,0,j);line(ctx,[[0,v.y],[480,v.y]],'#d4bda98a',1.3);}
 const rail=angle(0,.64,6.5);line(ctx,[[-20,rail.y],[500,rail.y]],p.dark,3);
 for(let j=-9;j<=9;j++){const b=angle(j*.75,0,6.5),top=angle(j*.75,.72,6.5);line(ctx,[[b.x,b.y],[top.x,top.y]],p.dark,2.4);}
 if(id===1||id===3){const cable=[];for(let j=-15;j<=15;j++){const v=angle(j*.45,2.7+.15*Math.cos(j*.34),7.6);cable.push([v.x,v.y]);if(j%2===0)ellipse(ctx,v.x,v.y+4,2.2,3.2,p.glow);}line(ctx,cable,p.dark,1.6);}
}
function post(ctx,post,camera,lens,id){
 const foot=project({x:post.x,y:0,z:post.z},camera,lens),p=places[id],height=post.h*foot.scale,rr=post.radius*foot.scale;
 ctx.save();ctx.translate(foot.x,foot.y);
 rect(ctx,-rr,-height,2*rr,height,2,p.dark);
 line(ctx,[[-rr*.63,-height],[-rr*.63,0]],'#c7a997',Math.max(1,rr*.15));
 rect(ctx,-rr*1.2,-height*.61,rr*2.4,4,2,p.wall);
 if(id===0||id===2){for(let k=0;k<8;k++){const yy=-height+rr*(k-1),sign=k%2?-1:1;ellipse(ctx,sign*rr*.8,yy,rr*1.4,rr*.65,k%3?'#526d60':'#8a9676',sign*-.6);}}
 else{rect(ctx,-rr*2.5,-height-rr*2.9,rr*5,rr*3,2,p.glow);shape(ctx,[[-rr*3,-height-rr*2.8],[0,-height-rr*4.4],[rr*3,-height-rr*2.8]],p.dark);}
 ctx.restore();
}
export function photograph(ctx,scene,camera,lens,focus,time){
 const {id,subject,companion,posts}=scene;
 roof(ctx,camera,lens,id,time);
 const model=()=>{const ground=project({...subject,y:0},camera,lens),h=ground.scale*1.65,w=h*.527;
  ellipse(ctx,ground.x+5,ground.y,Math.max(8,w*.25),3+ground.scale*.012,'#44405e60');
  ctx.save();const sharp=focusQuality(subject.z,focus,lens);
  if(sharp<.94)ctx.filter='blur('+((1-sharp)*3.3).toFixed(1)+'px)';
  ctx.translate(ground.x,ground.y);
  const posing=clamp((scene.pose-.53)/.47,0,1);
  ctx.rotate(scene.side*(posing*.045+.008*Math.sin(time*1.7)));
  if(!paintArtwork(ctx,agi,-w/2,-h,w,h)){ellipse(ctx,0,-h*.83,w*.23,h*.13,'#f8d895');rect(ctx,-w*.25,-h*.67,w*.5,h*.65,8,'#a579c0');}
  if(posing>.52){
   const glint=posing*clamp(1-Math.abs(Math.sin(time*3))*.35,0,1);
   ctx.globalAlpha=glint;
   label(ctx,'✧',w*.32*scene.side,-h*.91,Math.min(25,h*.071),'#fff8c5','center');
  }
  ctx.restore();
 };
 const cast=[{z:subject.z,draw:model},{z:companion.z,draw(){const c=project(companion,camera,lens);coStar(ctx,id,c.x,c.y,clamp(c.scale*.009,.54,2.3),time);}},
  ...posts.map(p=>({z:p.z,draw:()=>post(ctx,p,camera,lens,id)}))];
 cast.sort((a,b)=>b.z-a.z).forEach(item=>item.draw());
}
