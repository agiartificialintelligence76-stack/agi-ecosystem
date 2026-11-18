import {hold,launch,setLane,solution,tick,makeRun,STEP,clamp} from './flight.js';
import {randomWord} from './routes.js';

export const pilots={
 newbie:{read:3.2,error:.137,late:.21,depth:.27,parcel:.28,stumble:.079},
 steady:{read:2.3,error:.067,late:.12,depth:.068,parcel:.58,stumble:.025},
 expert:{read:1.60,error:.032,late:.045,depth:.017,parcel:.87,stumble:.012},
 courier:{read:.62,error:0,late:0,depth:0,parcel:1,stumble:0},
};
export function flightDirector(profile,seed){
 let card=-1,attempt=-1,goal=0,wait=0,badLane=false,collect=true,misread=false;
 return s=>{
  if(s.phase==='deck'){
   if(card!==s.delivered||attempt!==s.saves){
    card=s.delivered;attempt=s.saves;
    const u=k=>randomWord(seed,card+attempt*957,k);
    wait=profile.read*(.6+.8*u(0));badLane=u(1)<profile.depth;
    collect=u(2)<profile.parcel;misread=u(3)<profile.stumble;
    goal=NaN;
   }
   if(!s.held&&s.wait>=wait){
    setLane(s,badLane?s.origin.z:s.dest.z);
    const u=k=>randomWord(seed,card+attempt*957,k);
    const error=(u(4)*2-1)*profile.error;
    goal=clamp(solution(s)+error+(misread?(u(5)>.5?.26:-.26):0)+profile.late*(u(6)-.5),0,1);
    hold(s);
   }else if(s.held&&s.charge>=goal)launch(s);
  }else if(s.phase==='air'){
   if(badLane&&s.flightTime>.88+profile.late)setLane(s,s.dest.z);
   if(s.letter&&!s.letter.taken&&!collect&&s.flightTime<.38){
     setLane(s,s.dest.z===1?0:1);
   }else if(!badLane) setLane(s,s.dest.z);
  }
 };
}
export function survey(seed,skill,mode='red',route=0,maxDeliveries=Infinity){
 const s=makeRun(seed,mode,route),drive=flightDirector(pilots[skill],seed^0x623cc);
 const causes={},postmarks=[];let last=0;
 while(!s.ended&&s.delivered<maxDeliveries&&s.t<1800){
  drive(s);tick(s,STEP);
  if(s.events.includes('chute'))causes[s.cause]=(causes[s.cause]||0)+1;
  if(s.delivered!==last){postmarks.push(s.t);last=s.delivered;}
  s.events.length=0;
 }
 return {time:s.t,score:s.score,cards:s.delivered,mail:s.letters,perfect:s.perfect,saves:s.saves,causes,postmarks,ended:s.ended};
}
