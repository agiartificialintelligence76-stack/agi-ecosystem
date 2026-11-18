import { weather,routes } from './routes.js';

export const STEP=1/120, GRAVITY=6.8, CHARGE_TIME=1.22;
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function deck(p,t){
 const angle=t*p.cadence+p.phase;
 return {x:p.x+Math.sin(angle*.83)*p.amp*.42,y:p.y+Math.sin(angle)*p.amp,
   slope:Math.sin(angle*.91)*p.bank,z:p.z,half:p.half};
}
export const heightAt=(d,x)=>d.y+(x-d.x)*d.slope;
export function crossing(a,b,oldDeck,newDeck){
 const above=a.y-heightAt(oldDeck,a.x),below=b.y-heightAt(newDeck,b.x);
 if(above<0||below>0||above<=below)return null;
 const k=above/(above-below),mix=(v,w)=>v+(w-v)*k;
 const dx=mix(a.x,b.x)-mix(oldDeck.x,newDeck.x), dz=mix(a.z,b.z)-mix(oldDeck.z,newDeck.z);
 if(Math.abs(dx)>newDeck.half||Math.abs(dz)>.27)return null;
 return {offset:dx/fillWidth(newDeck),at:k};
}
function fillWidth(deck){return Math.max(.01,deck.half);}
export function sweptParcel(a,b,mail){
 const dx=b.x-a.x,dy=b.y-a.y,dz=(b.z-a.z)*.7;
 const x=mail.x-a.x,y=mail.y-a.y,z=(mail.z-a.z)*.7;
 const k=clamp((x*dx+y*dy+z*dz)/(dx*dx+dy*dy+dz*dz||1),0,1);
 return Math.hypot(x-k*dx,y-k*dy,z-k*dz)<mail.radius;
}
function receiver(s){
 const seg=weather(s.seed,s.mode,s.route,s.delivered);
 const from=s.origin,p={...seg,x:from.x+seg.gap,y:seg.y,z:seg.lane};
 s.dest=p;s.seg=seg;s.letter=null;
 if(seg.letter){
   const d=deck(from,s.t),e=deck(p,s.t+.55);
   s.letter={x:(d.x+e.x)*.5+seg.letterBias,y:d.y*.45+e.y*.55+1.05,z:(d.z+e.z)*.5+seg.letterBias,radius:.22,taken:false};
 }
}
export function makeRun(seed=7,mode='post',routeId=0){
 const origin={x:0,y:0,z:0,amp:0,bank:0,phase:0,cadence:1,half:.92,body:0,paint:0};
 const s={seed,mode,route:routes[routeId]||routes[0],origin,t:0,phase:'deck',wait:0,charge:0,held:false,
   x:0,y:0,z:0,lane:0,vx:0,vy:0,trim:0,flightTime:0,landOffset:0,dip:0,
   delivered:0,score:0,chain:0,bestChain:0,letters:0,saves:0,perfect:0,chutes:3,cause:'',events:[],ended:false};
 receiver(s);return s;
}
export function hold(s){
 if(s.phase!=='deck'||s.held||s.ended)return false;
 s.held=true;s.charge=0;s.events.push('charge');return true;
}
export function launch(s){
 if(!s.held||s.phase!=='deck'||s.ended)return false;
 const power=s.charge;s.held=false;s.phase='air';s.flightTime=0;s.vx=1.05+2.95*power;
 s.vy=3.8+.42*power;s.events.push('launch');return true;
}
export function setLane(s,lane){
 if(s.ended||s.phase==='chute')return;
 const z=clamp(lane,-1,1);if(z!==s.lane)s.events.push(z<0?'far':z>0?'near':'middle');
 s.lane=z;
}
export function wind(s,t){return s.seg.gust*(.8+.31*Math.sin(t*1.8+s.seg.phase));}
export function ballistic(a,dt,acc,lane){
 const dx=a.vx*dt+acc*dt*dt*.5;
 return {x:a.x+dx,y:a.y+a.vy*dt-GRAVITY*dt*dt*.5,z:a.z+clamp(lane-a.z,-2.55*dt,2.55*dt),
  vx:a.vx+acc*dt,vy:a.vy-GRAVITY*dt};
}
export function miss(s,cause){
 s.phase='chute';s.held=false;s.charge=0;s.chutes--;s.cause=cause;s.saves++;s.chain=0;s.wait=0;s.trim=0;s.events.push('chute');
}
function land(s,hit){
 const prev=s.dest;
 s.origin=prev;s.delivered++;s.phase='deck';s.wait=0;s.charge=0;s.held=false;s.dip=1;s.trim=0;
 s.landOffset=hit.offset*prev.half;s.lane=prev.z;
 const center=Math.abs(hit.offset)<.42;
 s.perfect+=+center;s.chain=center?s.chain+1:0;s.bestChain=Math.max(s.chain,s.bestChain);
 s.score+=65+(center?50+s.chain*12:0);
 s.events.push(center?'center':'edge');
 if(s.chain&&s.chain%4===0){s.events.push('firstclass');s.score+=140;}
 if(s.delivered%8===0)s.events.push('relay');
 const limit=s.mode==='daily'?15:s.mode==='post'?s.route.legs.length:Infinity;
 if(s.delivered>=limit){s.ended=true;s.events.push('complete');return;}
 receiver(s);if(s.mode==='post'&&s.delivered===s.route.turn)s.events.push('home');
}
export function tick(s,dt=STEP){
 if(s.ended)return;
 const t0=s.t;s.t+=dt;s.dip=Math.max(0,s.dip-dt*2.9);
 if(s.phase==='chute'){
   s.wait+=dt;s.y-=dt*.31;
   if(s.wait<1.05)return;
   if(s.chutes===0){s.ended=true;s.events.push('finish');return;}
   s.phase='deck';s.wait=0;s.landOffset=0;s.lane=s.origin.z;s.events.push('reboard');
 }
 if(s.phase==='deck'){
   const d=deck(s.origin,s.t);s.wait+=dt;s.landOffset*=Math.exp(-3.8*dt);
   if(s.held)s.charge=Math.min(1,s.charge+dt/CHARGE_TIME);
   s.x=d.x+s.landOffset+s.charge*.10;s.y=heightAt(d,s.x);s.z=d.z;
   if(s.mode!=='post'&&s.wait>Math.max(3.7,8.5-s.delivered*.08)){miss(s,'late');}
   return;
 }
 const at=s.t, next=ballistic(s,dt,wind(s,(at+t0)*.5)+s.trim*1.45,s.lane);
 // Intersect both the moving wing and the mail along this step. The earlier
 // contact wins if a parcel is beside the deck.
 const oldDeck=deck(s.dest,t0),newDeck=deck(s.dest,at);
 const hit=crossing(s,next,oldDeck,newDeck);
 const beforeLanding=hit?{x:s.x+(next.x-s.x)*hit.at,y:s.y+(next.y-s.y)*hit.at,z:s.z+(next.z-s.z)*hit.at}:next;
 if(s.letter&&!s.letter.taken&&sweptParcel(s,beforeLanding,s.letter)){
   s.letter.taken=true;s.letters++;s.score+=45;s.events.push('parcel');
 }
 Object.assign(s,next);s.flightTime+=dt;
 if(hit){land(s,hit);return;}
 if(s.y<Math.min(s.origin.y,s.dest.y)-.71){
   miss(s,Math.abs(s.z-s.dest.z)>.28?'lane':s.x<newDeck.x?'short':'long');
 }
}
// Predict touchdown on the extended moving wing. The flight director uses this
// instrument too; no pilot moves or resizes a receiver to turn a miss into a hit.
export function predict(s,power,delay=0){
 const t=s.t+delay, d=deck(s.origin,t),start=d.x+s.landOffset*Math.exp(-3.8*delay)+power*.10;
 const y0=heightAt(d,start),vx=1.05+2.95*power,vy=3.8+.42*power;
 let duration=2*vy/GRAVITY;
 for(let i=0;i<4;i++){
   const e=deck(s.dest,t+duration),x=start+vx*duration+.5*wind(s,t+duration*.42)*duration*duration;
   duration=(vy+Math.sqrt(Math.max(.2,vy*vy-2*GRAVITY*(heightAt(e,x)-y0))))/GRAVITY;
 }
 const e=deck(s.dest,t+duration),x=start+vx*duration+.5*wind(s,t+duration*.42)*duration*duration;
 return {offset:x-e.x,x,y:heightAt(e,x),duration,start,y0,vx,vy};
}
export function solution(s){
 let lo=0,hi=1;
 for(let i=0;i<10;i++){const mid=(lo+hi)*.5;if(predict(s,mid,Math.max(0,mid-s.charge)*CHARGE_TIME).offset>0)hi=mid;else lo=mid;}
 return (lo+hi)*.5;
}
