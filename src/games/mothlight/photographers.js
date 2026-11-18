import {rng} from '../kit/fx.js';
import {CROPS} from './assignments.js';
import {clamp,cameraTransform,pointAt} from './camera.js';
import {sceneAt,gradeShot,anchor} from './scene.js';
import {adjust,expose,keep,another,turnSpread,resultOf} from './run.js';
export function bestCamera(scene,now,skill='expert',noise=0){
 const expert=skill==='expert'||skill==='demo',novice=skill==='novice',lens=novice?1:CROPS.indexOf(scene.a.crop);
 let result=null;
 const sites=expert?[-1.55,-.95,-.55,-.25,0,.25,.55,.95,1.55]:novice?[clamp(now.truck,-1.6,1.6)]:[-.75,0,.75];
 for(const truck of sites){
  let c={...now,truck,lens,focus:scene.z};const aim=anchor(scene);c=pointAt(c,scene.eye,{u:aim.u+(novice?.10:.025)*noise,v:aim.v+(novice?.11:.025)*noise});
  const z=cameraTransform(scene.eye,c).z;
  c.focus=clamp(novice?Math.round(z/1.25)*1.25+.44*noise:expert?z:Math.round(z/.27)*.27,1.7,8);
  const grade=gradeShot(scene,c);const cost=grade.score-.14*Math.abs(truck-now.truck);
  if(!result||result.cost<cost)result={cam:c,grade,cost};
 }
 return result;
}
export function makePhotographer(skill,seed){
 const random=rng(seed^0x56494557).next;let last=-1,take=0,noise=0,review=0,stage='',nextThink=0,aimed=0;
 const expert=skill==='expert',demo=skill==='demo';
 return (s,dt)=>{
  if(s.phase!==stage){stage=s.phase;review=0;}
  if(s.index!==last){last=s.index;take=0;noise=random()*2-1;nextThink=0;aimed=0;}
  if(s.phase==='spread'){review+=dt;if(review>.75){if(s.kept.length>1&&s.kept[s.detail]?.scene.a.crop==='full')turnSpread(s,'detail');s.ended=true;}return;}
  if(s.phase==='review'){
   review+=dt;
   const time=demo?2.35:skill==='novice'?2.65:expert?2.9:4.6;
   if(review<time)return;
   if(s.takes.length===1&&!demo&&!expert&&s.config.mode!=='darkroom'&&s.age<s.plan.budget-4){another(s);take++;return;}
   const i=s.takes.length>1&&s.takes[1].grade.score>s.takes[0].grade.score?1:0;keep(s,i);return;
  }
  if(s.phase!=='live')return;
  nextThink-=dt;
  const sc=sceneAt(s.plan,s.age);
  if(nextThink<=0){
   nextThink=demo?.12:expert?.13:skill==='novice'?.76:.36;
   let source=bestCamera(sc,s.cam,skill,noise).cam;
   if(demo&&s.index===0&&s.age<6.14)source=pointAt({...source,truck:0},sc.eye,anchor(sc));
   // A photographer has to move the body, turn the glass and pull focus.
   const speed=demo?.84:expert?.58:skill==='novice'?.38:.43;
   for(const k of ['truck','pan','tilt','focus'])adjust(s,k,s.cam[k]+clamp(source[k]-s.cam[k],-speed,speed));
   adjust(s,'lens',source.lens);aimed++;
  }
  let when=s.plan.first;
  if(demo)when=s.index===0?Math.max(6.46,s.plan.first+.16):3.2;
  else if(skill==='steady')when+=s.plan.period*(take===0?1:2)+.53+noise*.19;
  else if(skill==='novice')when+=s.plan.period*(take===0?0:1)+1.25+noise*.53;
  else when+=.04+noise*.09;
  if(s.age>=Math.min(s.plan.budget-.24,when)&&aimed>=2){expose(s);}
 };
}
