import {rng} from '../kit/fx.js';
import {BY_ID,CROPS} from './assignments.js';
import {clamp,project,cameraTransform,focusQuality,occlusion,reflected} from './camera.js';
const TAU=Math.PI*2;
const wrapped=(t,period)=>((t%period)+period)%period;
function pulse(t,center,width,period){
 const d=Math.abs(wrapped(t-center+period*.5,period)-period*.5);
 return Math.exp(-.5*(d/width)**2);
}
export function schedule(id,seed){
 const a=BY_ID[id];const r=rng((seed^Math.imul(id+19,15773))>>>0).next;
 const tutor=id===0,period=tutor?7.5:12.7+r()*3.6,first=tutor?2.55:4.4+r()*3.5;
 return {id,seed,period,first,side:r()>.5?1:-1,phase:r()*TAU,drift:r()*.8+.35,wind:r()*.46+.45,weather:r()*.6+.4,
  budget:tutor?47:58+a.place*.7,base:tutor?3.55:3.35+r()*.80,catPhase:r()*.75-.375};
}
export function sceneAt(plan,t){
 const a=BY_ID[plan.id],p=plan.period,phase=TAU*(t-plan.first)/p,wave=pulse(t,plan.first,a.pose==='skip'?.47:.72,p);
 const falseWave=a.pose==='waveback'?pulse(t,plan.first-2.2,.57,p):0;
 const gesture=clamp(.11+.89*wave),side=plan.side;
 const x=side*(.45*Math.sin(phase*.50+plan.phase)+.18*Math.sin(phase+plan.phase*.4));
 const z=plan.base+Math.sin(phase*.45+plan.phase)*((a.pose==='walk'||a.ask==='pair')?.77:.35);
 const jump=a.pose==='skip'?.32*wave:0,kneel=a.pose==='crouch'?.28*wave:0,foot={x,y:jump,z};
 const eye={x:x+.045*Math.sin(phase),y:1.46+jump-kneel,z},catWanted=a.ask==='pair';
 const catCross=.5+.5*Math.cos(phase+.55);
 const cat={x:x+side*(catWanted?.49+.20*Math.sin(phase):.90*Math.sin(phase+plan.catPhase)),
  y:catWanted?.75+.09*Math.sin(phase*2):.78+catCross*.69,
  z:z-(catWanted?.12+.27*(1-wave):.48+.18*Math.sin(phase*.5))};
 const posts=[];
 if(a.slot>=2||a.place>0){
  posts.push({x:side*(.45+.10*Math.sin(t*.31+plan.phase)),z:1.50+plan.wind*.4,r:a.ask==='frame'?.073:.083,bottom:0,top:1.85,kind:a.place===4?'awning':'post'});
  if(a.place>0)posts.push({x:-side*(.8+.16*Math.sin(t*.25+plan.phase)),z:1.96,r:.075,bottom:0,top:2.0,kind:a.place===5?'flag':'post'});
 }
 if(a.place===5||a.place===6)posts.push({x:1.35*Math.sin(t*.24+plan.phase),z:2.68,r:.13,bottom:0,top:1.50+.22*Math.sin(t*.49),kind:'crowd'});
 const catBlock=a.id===2||a.ask==='solo'||a.ask==='pair';
 if(catBlock)posts.push({x:cat.x,z:cat.z,r:.13,bottom:cat.y-.18,top:cat.y+.12,kind:'cat'});
 return {a,plan,t,x,z,foot,eye,cat,catWanted,catVisible:catWanted||a.id>=2,posts,gesture,falseWave,phase,
  angle:Math.sin(phase+plan.phase)*.38+(a.pose==='turn'||a.pose==='twirl'?.8*wave:0),
  light:clamp(.68+.32*Math.cos(phase+.32)),reflection:reflected(eye)};
}
export function anchor(scene){
 const {a}=scene;
 return {u:a.ask==='color'?.36:a.ask==='frame'?.64:a.ask==='pair'?.43:.50,v:a.crop==='tight'?.35:a.crop==='full'?.32:.30};
}
export function gradeShot(scene,cam){
 const lens=cam.lens,at=q=>project(q,cam,lens,cam.focus);
 const eye=at(scene.eye),foot=at(scene.foot),cat=at(scene.cat),target=anchor(scene);
 const cover=occlusion(scene.eye,cam,scene.posts);
 const accuracy=clamp(1-Math.hypot((eye.u-target.u)/.5,(eye.v-target.v)/.49));
 const height=Math.abs(foot.v-eye.v),wanted=CROPS.indexOf(scene.a.crop);
 const crop=clamp(1-Math.abs(height-[.43,.62,.92][wanted])/[.53,.57,.75][wanted]);
 const sharp=focusQuality(eye.depth,cam.focus,lens),catSharp=focusQuality(cat.depth,cam.focus,lens);
 const catIn=cat.u>.06&&cat.u<.94&&cat.v>.06&&cat.v<.93,visible=1-cover;
 const goal=scene.a.ask;
 let request=0;
 if(goal==='pair')request=Number(catIn)*clamp(.30+.30*catSharp+.40*(1-Math.abs(cat.depth-eye.depth)/1.05));
 else if(goal==='reflection'){const reflectedEye=at(scene.reflection);
  const visibleReflection=clamp((1-Math.max(0,foot.v))/Math.max(.001,reflectedEye.v-foot.v));
  request=clamp(.26+.74*Math.min(1,visibleReflection/.33))*visible;}
 else if(goal==='light')request=scene.light*sharp;
 else if(goal==='silhouette')request=clamp(.30+.64*Math.abs(scene.angle)+.18*crop);
 else if(goal==='color')request=clamp(1-Math.abs(eye.u-.36)/.52)*scene.light;
 else if(goal==='frame'){const pole=scene.posts.find(p=>p.kind!=='cat');const pp=pole?at({x:pole.x,y:scene.eye.y,z:pole.z}):{u:.2};
  request=clamp(1-Math.abs(Math.abs(pp.u-eye.u)-.27)/.36)*visible;}
 else if(goal==='solo')request=visible*clamp(.7+Math.abs(cat.u-eye.u));
 else if(goal==='eyes')request=sharp*visible;
 else request=scene.gesture*.70+.30*crop;
 const parts={framing:Math.round(30*(.62*accuracy+.38*crop)*visible),focus:Math.round(25*sharp),gesture:Math.round(25*scene.gesture),request:Math.round(20*clamp(request))};
 return {parts,score:Object.values(parts).reduce((a,b)=>a+b,0),cover,sharp,crop,request,eye,cat,catIn,gesture:scene.gesture,focusDepth:cameraTransform(scene.eye,cam).z};
}
