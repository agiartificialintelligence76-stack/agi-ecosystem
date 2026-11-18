import {rng} from '../kit/fx.js';
import {BY_ID,COMMISSIONS,CANDIDS,PLACES,CROPS} from './assignments.js';
import {neutral,pointAt,clamp,bounds} from './camera.js';
import {schedule,sceneAt,gradeShot,anchor} from './scene.js';
const precision=(v,d=10000)=>Math.round(v*d)/d;
export function configFor(mode,roll,seed){
 const next=rng(seed^0x53485554).next;
 let ids=COMMISSIONS.slice(roll*4,roll*4+4).map(a=>a.id);
 if(mode==='daily'){const p=Math.floor(next()*8);ids=[p*4,(p*4+1+Math.floor(next()*2)),((p+2+Math.floor(next()*4))%8)*4+3];}
 if(mode==='darkroom')ids=[ids[0]];
 return {mode,roll,seed,plans:ids.map(id=>schedule(id,Math.floor(next()*0xffffffff)))};
}
export function recipe(plan,t,cam){
 const c={truck:precision(cam.truck),pan:precision(cam.pan),tilt:precision(cam.tilt),lens:cam.lens,focus:precision(cam.focus)};
 const key=[plan.id,plan.seed,precision(t,1000),...Object.values(c)].join('/');
 return {v:1,id:plan.id,seed:plan.seed,t:precision(t,1000),cam:c,key};
}
export function readRecipe(raw){
 if(!raw||raw.v!==1||!Number.isInteger(raw.id)||!BY_ID[raw.id]||!Number.isInteger(raw.seed)||raw.seed<0||raw.seed>0xffffffff||!Number.isFinite(raw.t)||raw.t<0||raw.t>1e9)return null;
 const c=raw.cam;if(!c||![0,1,2].includes(c.lens))return null;
 for(const [k,[lo,hi]] of Object.entries(bounds))if(!Number.isFinite(c[k])||c[k]<lo-.0001||c[k]>hi+.0001)return null;
 return recipe(schedule(raw.id,raw.seed),raw.t,c);
}
export function printOf(raw){
 const p=readRecipe(raw);if(!p)return null;
 const scene=sceneAt(schedule(p.id,p.seed),p.t),grade=gradeShot(scene,p.cam);
 return {recipe:p,scene,grade,note:noteFor(scene,p.cam,grade),keeper:grade.score>=82};
}
export function noteFor(s,c,g){
 if(g.cover>.24)return s.posts.some(p=>p.kind==='cat'&&Math.abs(p.x-s.eye.x)<.2)?'understudy':'post';
 if(g.parts.focus<=17)return c.focus>g.focusDepth?'behind':'ahead';
 if(g.parts.gesture<=14)return s.falseWave>.52?'false':s.a.pose==='twirl'?'twirlLate':'windup';
 if(g.parts.framing<=19)return 'crop';
 if(g.parts.request<=13)return s.a.ask==='pair'?'approach':s.a.ask==='reflection'?'reflect':'soft';
 if(g.parts.request>=17&&s.a.ask==='pair')return 'catWanted';
 if(s.a.ask==='light')return 'catchlight';if(s.a.ask==='silhouette')return 'silhouette';if(s.a.ask==='reflection')return 'reflect';
 return s.a.pose==='twirl'?'twirlPeak':s.a.pose==='waveback'?'peak':'keeper';
}
function open(s,index){
 s.index=index;s.age=0;s.takes=[];s.selected=0;s.develop=0;s.phase='live';s.plan=s.plans[index];const scene=sceneAt(s.plan,0);
 s.cam=neutral();s.cam.lens=index===0?0:1;s.cam.focus=s.plan.id===0?scene.z:3.85;
 s.cam=pointAt(s.cam,scene.eye,anchor(scene));
}
export function openRoll(config){
 const s={config,plans:config.plans.slice(),index:0,age:0,time:0,kept:[],exposures:0,missed:0,bonus:false,context:0,detail:0,ended:false};
 open(s,0);return s;
}
export function adjust(s,k,v){
 if(s.phase!=='live')return false;
 if(k==='lens'){if(!Number.isInteger(v)||v<0||v>2)return false;s.cam.lens=v;return true;}
 if(!bounds[k]||!Number.isFinite(v))return false;s.cam[k]=clamp(v,...bounds[k]);return true;
}
export function expose(s){
 if(s.phase!=='live'||s.takes.length>=2||s.ended)return null;
 const shot=printOf(recipe(s.plan,s.age,s.cam));s.takes.push(shot);s.exposures++;s.selected=s.takes.length-1;
 s.develop=1;s.phase='review';return shot;
}
export function another(s){if(s.phase!=='review'||s.takes.length!==1||(s.age>=s.plan.budget-.25&&s.config.mode!=='darkroom'))return false;s.phase='live';s.develop=0;return true;}
function toNext(s){
 if(s.index+1<s.plans.length)open(s,s.index+1);else{
  s.phase='spread';s.context=Math.max(0,s.kept.findIndex(p=>p?.scene.a.crop==='full'));
  s.detail=Math.max(0,s.kept.findIndex((p,i)=>i!==s.context&&p&&p.scene.a.crop!=='full'));
  if(s.detail===s.context&&s.kept.length>1)s.detail=(s.context+1)%s.kept.length;
 }
}
export function keep(s,idx=s.selected){
 if(s.phase!=='review'||!s.takes[idx])return false;s.kept.push(s.takes[idx]);toNext(s);return true;
}
export function candid(s){
 if(s.phase!=='spread'||s.bonus||s.config.mode!=='campaign')return false;s.bonus=true;
 s.plans.push(schedule(CANDIDS[s.config.roll].id,(s.config.seed^0xfe1203)>>>0));open(s,s.plans.length-1);return true;
}
export function tick(s,dt){
 if(s.ended)return;s.time+=dt;
 if(s.phase==='review'){s.develop=Math.max(0,s.develop-dt*.95);return;}
 if(s.phase!=='live')return;s.age+=dt;
 if(s.age>=s.plan.budget&&s.config.mode!=='darkroom'){
  if(s.takes.length){s.phase='review';s.selected=0;}else{s.missed++;s.kept.push(null);toNext(s);}
 }
}
export function turnSpread(s,slot){
 if(s.phase!=='spread'||s.kept.length<2)return;
 const k=slot==='context'?'context':'detail',other=k==='context'?'detail':'context';
 const live=s.kept.flatMap((p,i)=>p?[i]:[]);if(live.length<2)return;
 const i=live.indexOf(s[k]);s[k]=live[(i+1)%live.length];if(s[k]===s[other])s[other]=live[(i+live.length)%live.length];
}
export function resultOf(s){
 const live=s.kept.filter(Boolean),left=s.kept[s.context],right=s.kept[s.detail];
 const paired=Boolean(left&&right&&left!==right&&left.scene.a.crop==='full'&&right.scene.a.crop!=='full');
 const total=live.reduce((n,p)=>n+p.grade.score,0),avg=Math.round(total/Math.max(1,s.kept.length));
 return {score:total+(paired?30:0),avg,grade:avg>=85?3:avg>=69?2:avg>=50?1:0,paired,keepers:live.filter(p=>p.keeper).length,
  prints:live,count:s.kept.length,spread:paired?'A place and a face.':left&&right&&left!==right?'Two sides of the walk.':'One face in the light.'};
}
