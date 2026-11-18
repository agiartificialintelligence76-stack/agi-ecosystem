import {rng} from '../kit/fx.js';
import {LANES,clamp,canLink,laneOf,Z_MIN,Z_MAX,X_LIMIT} from './road.js';
import {RIVALS} from './rivals.js';
import {aim,radio,useBoost,fakeSignal} from './duel.js';

const PERSONAS={
 novice:{reaction:.71,noise:.49,defend:.20,initiative:.50,agility:.32,traffic:.36,stream:.12},
 steady:{reaction:.32,noise:.21,defend:.58,initiative:.83,agility:.58,traffic:.77,stream:.53},
 expert:{reaction:.16,noise:.075,defend:.88,initiative:.97,agility:.86,traffic:.96,stream:.85},
 demo:{reaction:.16,noise:.05,defend:.54,initiative:.95,agility:.58,traffic:.93,stream:.8},
};
function settings(s,mode){
 if(PERSONAS[mode])return PERSONAS[mode];
 const r=RIVALS[s.rival],remix=s.config.flip?.025:0;
 const level=s.rival,hard=s.config.mode==='marathon'?Math.min(.16,Math.max(0,s.level-5)*.035):0;
 const delays=[.36,.32,.34,.31,.29,.30],defense=[.47,.56,.59,.63,.61,.60];
 return {reaction:Math.max(.14,delays[level]-hard),noise:Math.max(.07,r.aim*.6+.10-hard*.4),defend:defense[level]+remix+hard,initiative:.73+level*.015+remix+hard*.25,
  agility:.48+level*.025+remix+hard,traffic:.66+s.rival*.049,stream:s.rival===1?.94:s.rival===3?.82:.40};
}
function safeTarget(s,c,target,experience,random){
 const hazard=s.traffic.filter(o=>o.z>c.z-.1&&o.z-c.z<1.20+experience*.8&&Math.abs(o.x-target)<.45).sort((a,b)=>a.z-b.z)[0];
 if(!hazard||random()>experience)return target;
 const available=LANES.filter(x=>!s.traffic.some(o=>Math.abs(o.z-hazard.z)<.95&&Math.abs(o.x-x)<.44));
 return available.sort((a,b)=>Math.abs(a-target)-Math.abs(b-target))[0]??target;
}
export function makeDriver(mode,seat,seed){
 const random=rng((seed^Math.imul(seat+19,73507))>>>0).next;
 let reaction=0,lastRound=-1,route=0,nextRoute=0,holdX=0,holdZ=1.7,threatStamp=0,lastFake=-10,recoverZ=0;
 const log={reacts:0,threats:0,misses:0,bluffs:0,reads:0};
 function think(s,dt){
  if(s.phase!=='live')return;
  const c=s.cars[seat],other=s.cars[1-seat],p=settings(s,mode),rival=mode==='rival';
  if(lastRound!==s.round){lastRound=s.round;reaction=0;nextRoute=0;route=Math.floor(random()*4);recoverZ=0;threatStamp=0;}
  reaction-=dt;if(reaction>0)return;
  reaction=p.reaction*(.78+random()*.42);log.reacts++;
  const now=s.roundTime,noise=()=>(random()-.5)*p.noise*2;
  const tutor=s.round===1&&s.rival===0&&now<7.3;
  if(s.owner===-1||tutor&&s.firstTape&&seat===1){
   aim(s,seat,LANES[seat+1],1.76+seat*.19);return;
  }
  if(mode==='demo'&&s.round===1&&now<5.65){aim(s,seat,other.x-.70,other.z-.09);return;}
  let x=c.targetX,z=c.targetZ;
  if(s.owner===seat){
   if(now>=nextRoute){
    route=(route+1+Math.floor(random()*2))%4;
    const arch=rival&&s.rival===4&&(Math.floor(s.distance/5)%3===1);
    const adapt=rival&&s.rival===5&&s.lastCounters.length===2;
    if(adapt)log.reads++;
    holdX=arch?-1.32:adapt&&s.lastCounters[1]==='cut'?-Math.sign(other.vx||other.x||1)*.96:LANES[route];
    const amplitude=.52+p.agility*.77;
    holdZ=clamp(1.9+((route%2?1:-1)*amplitude)+noise(),Z_MIN+.08,Z_MAX-.08);
    nextRoute=now+2.6+(1-p.agility)*2+random()*1.2;
   }
   x=holdX;z=holdZ;
   const threat=s.pending?.who===1-seat?s.pending:null;
   const stamp=threat?Math.round((s.time+threat.left)*10):0;
   if(threat&&stamp!==threatStamp){
    threatStamp=stamp;log.threats++;
    if(random()<p.defend&&c.jamCool<=0)radio(s,seat);
    else if(random()<p.agility){holdZ=other.z>c.z?Z_MIN+.04:Z_MAX-.04;holdX=-Math.sign(other.x||1)*1.25;
     x=holdX;z=holdZ;nextRoute=now+1.14;}
    else log.misses++;
   }
   if(other.blink>0&&!threat&&c.jamCool<=0&&random()>(p.defend+.02))radio(s,seat);
   if(c.charge>=.995&&threat&&(s.rival!==3||s.traffic.some(o=>o.z-c.z<1.7&&o.z>c.z)))useBoost(s,seat);
  }else{
   const side=other.x>.40?-1:other.x<-.40?1:c.x<=other.x?-1:1;
   x=other.x+side*.68+other.vx*(.11+p.agility*.14)+noise();
   z=other.z+other.vz*(.06+p.agility*.19)+noise()*.72;
   if(!s.released){recoverZ=now+.43;z=other.z>1.8?Z_MIN:Z_MAX;x=other.x+side*1.25;}
   else if(now<recoverZ){z=other.z>1.8?Z_MIN:Z_MAX;}
   else if(!s.pending&&s.lock<=0){
    const gap=other.z-c.z;
    if(gap>.80&&gap<2.2&&c.charge<.91&&random()<p.stream){x=other.x+noise()*.32;z=other.z-.57;}
    if(c.charge>=.995&&(gap>.55||rival&&s.rival===3&&s.traffic.some(o=>o.z>c.z&&o.z-c.z<1.7)))useBoost(s,seat);
    if(canLink(s)){
     if(rival&&s.rival===2&&now-lastFake>6.1&&random()<.43){fakeSignal(s,seat);lastFake=now;log.bluffs++;}
     else if(now-lastFake>.5&&random()<p.initiative)radio(s,seat);
    }
   }
  }
  x=safeTarget(s,c,x,p.traffic,random);
  aim(s,seat,clamp(x,-X_LIMIT,X_LIMIT),clamp(z,Z_MIN,Z_MAX));
 }
 return {think,log};
}
