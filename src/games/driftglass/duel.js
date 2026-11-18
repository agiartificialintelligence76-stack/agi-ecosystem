import {rng} from '../kit/fx.js';
import {clamp,toward,LANES,laneOf,canLink,swept,newWave,X_LIMIT,Z_MIN,Z_MAX,LATERAL_ACCEL,FORWARD_ACCEL} from './road.js';
import {RIVALS,MEETS} from './rivals.js';
export const DT=1/120;
export function configuration(mode='ladder',meet=0,seed=7){
 const entry=MEETS[clamp(Math.floor(meet)||0,0,MEETS.length-1)];
 if(mode==='daily'){const r=rng(seed).next,i=Math.floor(r()*6);
  const hands=Array.from({length:3},()=>({first:r()>.5?1:0,charge:.15+r()*.44,pattern:Math.floor(r()*4)}));
  return {mode,seed,meet:0,rival:i,district:Math.floor(r()*4),target:28+Math.floor(r()*5),needed:2,flip:r()>.5,hands};}
 if(mode==='pass')return {mode,seed,meet:0,rival:2,district:1,target:24,needed:1,flip:false};
 if(mode==='check')return {mode,seed,meet:0,rival:0,district:1,target:18,needed:1,flip:false};
 if(mode==='marathon')return {mode,seed,meet:0,rival:1,district:0,target:24,needed:Infinity,flip:false};
 return {mode,seed,meet:entry.id,rival:entry.rival,district:entry.district,target:entry.target,needed:2,flip:entry.flip};
}
export const emptyStats=()=>({attempts:0,steals:0,jams:0,early:0,blocks:0,breaks:0,feints:0,near:0,chain:0,bestChain:0,drafts:0,
 boosts:0,hits:0,air:0,longest:0,rounds:0});
function driver(i){
 return {id:i,x:LANES[i+1],z:1.76+i*.19,vx:0,vz:0,targetX:LANES[i+1],targetZ:1.76+i*.19,prevX:LANES[i+1],prevZ:1.76+i*.19,
  charge:.19,boost:0,stun:0,jam:0,jamCool:0,handCool:0,drafting:false,slip:0,streak:0,signal:0,blink:0,pose:0};
}
export function emit(s,kind,who=-1,v=0){s.events.push({kind,who,v,at:s.time});}
export function drain(s){return s.events.splice(0);}
export function startRound(s){
 const keep=s.cars.map(c=>c.charge);
 s.cars=[driver(0),driver(1)];s.round++;s.roundTime=0;s.air=[0,0];s.owner=-1;s.pending=null;s.handoff=null;
 s.lock=0;s.released=true;s.clearTime=0;s.connected=false;s.phase='live';s.breakTime=0;s.sudden=false;s.otHold=0;
 s.traffic=[];s.nextTraffic=s.round===1?17.8:6.2;s.pattern=0;s.hitStart=s.stats[0].hits;s.nearStart=s.stats[0].near;s.signalAt=0;s.firstTape=true;s.ownedChange=0;
 const marathon=s.config.mode==='marathon';
 if(marathon){s.level=Math.min(12,s.round-1);s.rival=Math.min(5,1+Math.floor((s.round-1)/2));s.target=Math.min(31,24+Math.floor(s.level/2));}
 else{s.level=s.config.rival+(s.config.flip?2:0);s.rival=s.config.rival;s.target=s.config.target;}
 s.district=(s.config.district+s.round-1)%4;
 if(!marathon&&s.round===1)s.district=s.config.district;
 s.hand=s.config.hands?.[(s.round-1)%3];if(s.hand)s.pattern=s.hand.pattern;
 for(let i=0;i<2;i++){if(s.hand)s.cars[i].charge=s.hand.charge;if(marathon&&s.round>1)s.cars[i].charge=keep[i]??.19;}
 emit(s,'district',-1,s.district);emit(s,'round-open',-1,s.round);
}
export function createDuel(config){
 const s={config,random:rng(config.seed^0x52414449).next,events:[],time:0,distance:0,round:0,wins:[0,0],record:[],cars:[],stats:[emptyStats(),emptyStats()],
  health:3,damage:0,items:[],traffic:[],itemId:0,lastCounters:[],winner:-1,trophy:false,ended:false,firstAction:[false,false],highBroadcast:[0,0],lastLead:-1};
 startRound(s);return s;
}
export function aim(s,i,x,z){
 if(s.phase!=='live'||!s.cars[i])return;
 const c=s.cars[i];
 c.targetX=clamp(Number.isFinite(x)?x:c.targetX,-X_LIMIT,X_LIMIT);
 c.targetZ=clamp(Number.isFinite(z)?z:c.targetZ,Z_MIN,Z_MAX);
 if(!s.firstAction[i]&&(Math.abs(c.targetX-c.x)>.05||Math.abs(c.targetZ-c.z)>.05)){s.firstAction[i]=true;emit(s,'drive',i);}
}
export function useBoost(s,i){
 const c=s.cars[i];if(s.phase!=='live'||c.charge<.995||c.boost>0||c.stun)return false;
 c.charge=0;c.boost=.89;s.stats[i].boosts++;emit(s,'boost',i);return true;
}
function counter(s,method){s.lastCounters.push(method);if(s.lastCounters.length>2)s.lastCounters.shift();}
export function radio(s,i){
 if(s.phase!=='live'||s.owner<0)return false;
 const c=s.cars[i],a=s.stats[i];if(!c||c.stun||c.handCool>0)return false;
 if(s.owner===i){
  if(c.jamCool>0){emit(s,'empty',i);return false;}
  c.jam=.69;c.jamCool=4.2;c.handCool=.35;a.jams++;if(!s.pending||s.pending.who===i){a.early++;emit(s,'early',i);}else emit(s,'jam-arm',i);
  return true;
 }
 c.handCool=.44;a.attempts++;
 if(s.lock>0||!s.released||s.pending||!canLink(s)){emit(s,'miss',i);return false;}
 const window=RIVALS[s.rival].tell;
 s.pending={who:i,left:window,total:window,lost:0};c.signal=window;emit(s,'tell',i);return true;
}
export function fakeSignal(s,i){if(s.phase!=='live'||s.owner===i||s.pending)return;s.cars[i].blink=.55;emit(s,'fake',i);}
function transfer(s,i){
 const prev=s.owner;s.owner=i;s.stats[i].steals++;s.ownedChange++;s.cars[prev].streak=0;
 s.handoff={who:i,age:0};s.lock=3.20;s.released=false;s.clearTime=0;s.pending=null;s.cars[i].signal=0;
 s.otHold=0;s.firstTape=false;emit(s,'steal',i);if(s.air[prev]>s.target*.77)emit(s,'turnaround',i);
}
function resolve(s,dt){
 const t=s.pending;if(!t)return;const i=t.who,c=s.cars[1-i];
 if(c.jam>0&&canLink(s)){
  s.stats[1-i].blocks++;
  if(1-i===0&&s.config.mode==='marathon'&&s.stats[0].blocks>=3&&!s.fuseEarned&&s.health<3){s.health++;s.fuseEarned=true;emit(s,'fuse',0);}
  s.lock=.95;s.pending=null;s.cars[i].signal=0;if(1-i===0)counter(s,'jam');
  emit(s,'block',1-i);return;
 }
 const connected=canLink(s);t.lost=connected?0:t.lost+dt;
 if(t.left>0&&t.lost<.14)return;
 if(connected&&s.released&&s.lock<=0)transfer(s,i);
 else{s.cars[i].handCool=1.1;s.stats[1-i].breaks++;if(1-i===0)counter(s,'cut');emit(s,'feint',1-i);s.pending=null;s.cars[i].signal=0;}
}
export function closeRound(s,winner){
 if(s.phase!=='live')return;
 s.wins[winner]++;s.stats[winner].rounds++;
 s.record.push({round:s.round,district:s.district,winner,air:s.air.slice(),seconds:s.roundTime,rival:s.rival});
 emit(s,'round',winner);
 if(s.config.mode==='marathon'){
  if(winner===1)s.health--;
  if(s.health<=0){end(s,1,'signal');return;}
  if(winner===0&&s.round%3===0){if(s.stats[0].hits===s.hitStart&&s.stats[0].near>s.nearStart)s.health=Math.min(3,s.health+1);emit(s,'mile',0);}
 }else if(s.wins[winner]>=s.config.needed){end(s,winner,'match');return;}
 s.phase='break';s.breakTime=1.50;s.pending=null;
}
function end(s,winner,reason){s.ended=true;s.phase='over';s.winner=winner;s.reason=reason;emit(s,'end',winner);}
function collide(s,i,item){
 const c=s.cars[i],a=s.stats[i];item.hit[i]=true;if(c.stun)return;
 a.hits++;a.chain=0;c.stun=.52;c.boost=0;c.vz=-.62;c.charge=Math.max(0,c.charge-.18);
 c.targetZ=Math.max(Z_MIN,c.z-.29);emit(s,'bump',i);
 if(i===0&&s.config.mode==='marathon'&&++s.damage%3===0){s.health--;if(s.health<=0)end(s,1,'roadworks');}
}
function traffic(s,dt){
 s.nextTraffic-=dt;
 if(s.nextTraffic<=0){
  const first=s.round===1&&s.pattern===0,created=newWave(s,first);
  s.traffic.push(...created);if(created.some(o=>o.kind==='barrier'))emit(s,'work');
  s.nextTraffic=Math.max(1.62,(first?4.9:4.25)-s.level*.15+s.random()*1.05);
 }
 for(const item of s.traffic){
  const delta=item.speed*dt;item.z-=delta;
  for(const c of s.cars){
   const i=c.id;
   if(!item.hit[i]&&swept(c,'hit',item,delta))collide(s,i,item);
   if(!item.hit[i]&&!item.near[i]&&swept(c,'near',item,delta))item.near[i]=true;
   if(!item.pass[i]&&item.z<c.z-.6){
    item.pass[i]=true;
    if(item.near[i]&&!item.hit[i]){const a=s.stats[i];a.near++;a.chain++;a.bestChain=Math.max(a.bestChain,a.chain);c.charge=Math.min(1,c.charge+.12);emit(s,a.chain%3===0?'streak':'near',i,a.chain);}
   }
  }
 }
 s.traffic=s.traffic.filter(o=>o.z>-.9);
}
function move(c,dt){
 c.prevX=c.x;c.prevZ=c.z;
 const accel=c.stun?.37:1;
 const wantX=clamp((c.targetX-c.x)*4.8,-2.28,2.28)*accel;
 const wantZ=clamp((c.targetZ-c.z)*4.1,-1.7,c.boost?2.9:1.74)*accel+(c.boost?.63:0);
 c.vx=toward(c.vx,wantX,LATERAL_ACCEL*dt*accel);
 c.vz=toward(c.vz,wantZ,FORWARD_ACCEL*dt*accel);
 c.x=clamp(c.x+c.vx*dt,-X_LIMIT,X_LIMIT);c.z=clamp(c.z+c.vz*dt,Z_MIN,Z_MAX);
 for(const k of ['boost','stun','jam','jamCool','handCool','signal','blink','pose'])c[k]=Math.max(0,c[k]-dt);
}
function drafting(s,i,dt){
 const c=s.cars[i],other=s.cars[1-i];
 const wake=o=>{const gap=o.z-c.z;return gap>.43&&gap<1.75&&Math.abs(o.x-c.x)<.39;};
 const active=!c.stun&&!c.boost&&(wake(other)||s.traffic.some(o=>o.kind==='van'&&wake(o)));
 if(active&&!c.drafting){s.stats[i].drafts++;emit(s,'draft',i);}c.drafting=active;
 const old=c.charge;
 if(active){c.charge=Math.min(1,c.charge+dt*.42);c.slip+=dt;}
 if(old<.995&&c.charge>=.995)emit(s,'charged',i);
}
export function tick(s,dt=DT){
 if(s.ended)return;s.time+=dt;
 if(s.phase==='break'){s.breakTime-=dt;if(s.breakTime<=0)startRound(s);return;}
 s.roundTime+=dt;s.distance+=dt*(2.3+.045*s.level);
 s.lock=Math.max(0,s.lock-dt);
 if(s.handoff){s.handoff.age+=dt;if(s.handoff.age>.74)s.handoff=null;}
 for(const car of s.cars)move(car,dt);
 traffic(s,dt);if(s.ended)return;
 for(let i=0;i<2;i++)drafting(s,i,dt);
 const link=canLink(s);
 if(!link){s.clearTime+=dt;if(s.clearTime>.15)s.released=true;}else s.clearTime=0;
 if(link&&!s.connected&&s.owner>=0&&s.released)emit(s,'link',1-s.owner);s.connected=link;
 if(s.owner<0&&s.roundTime>=2.15){s.owner=s.hand?.first??(s.config.mode==='local'?(s.round%2):1);s.lock=.65;emit(s,'drop',s.owner);}
 if(s.pending){s.pending.left-=dt;resolve(s,dt);}
 if(s.owner>=0){
  const i=s.owner,c=s.cars[i],a=s.stats[i];s.air[i]+=dt;a.air+=dt;c.streak+=dt;a.longest=Math.max(a.longest,c.streak);
  if(s.air[i]>=s.target){closeRound(s,i);return;}
  if(s.sudden){s.otHold+=dt;if(s.otHold>=1.5)closeRound(s,i);}
  else if(s.roundTime>=s.target*1.82+2.15){
   if(Math.abs(s.air[0]-s.air[1])>=.20)closeRound(s,s.air[0]>s.air[1]?0:1);
   else{s.sudden=true;s.otHold=0;emit(s,'overtime');}
  }
 }
}
export function scoreFor(s,i=0){const a=s.stats[i];return Math.round(a.air*8+a.steals*110+a.blocks*58+a.near*22+a.bestChain*12+a.rounds*150+a.boosts*13);}
