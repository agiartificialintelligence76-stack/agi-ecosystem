// AFTERDRIFT: inertial arcade handling and ordered checkpoint laps, independent of the renderer.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const TRACKS=[
 {name:'Lotus Loop',color:'#5cf0be',road:104,points:[[740,350],[630,540],[390,580],[180,440],[180,230],[380,135],[650,170]]},
 {name:'Neon Docks',color:'#ff7cb8',road:96,points:[[740,470],[580,570],[240,570],[160,430],[190,200],[330,130],[420,290],[560,290],[670,130],[780,240]]},
 {name:'Moonrise Pass',color:'#ac9dff',road:90,points:[[750,540],[480,590],[220,540],[125,350],[210,130],[450,110],[720,180],[750,300],[530,310],[500,430],[710,430]]}
];
function cat(a,b,c,d,t){return .5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);}
export function makeTrack(id=0){
 const def=TRACKS[Math.max(0,Math.min(TRACKS.length-1,id))],points=[];
 for(let i=0;i<def.points.length;i++)for(let k=0;k<16;k++){const p=def.points,n=p.length,a=p[(i+n-1)%n],b=p[i],c=p[(i+1)%n],d=p[(i+2)%n],t=k/16;points.push({x:cat(a[0],b[0],c[0],d[0],t),y:cat(a[1],b[1],c[1],d[1],t)});}
 let length=0;for(let i=0;i<points.length;i++){points[i].at=length;const next=points[(i+1)%points.length];length+=Math.hypot(next.x-points[i].x,next.y-points[i].y);}
 const checks=Array.from({length:12},(_,i)=>{const at=length*i/12;let p=points.find(p=>p.at>=at)||points[0];return {...p};});
 return{...def,id,points,length,checks};
}
export function nearest(track,x,y){
 let best={distance:Infinity,x:0,y:0,index:0,angle:0};
 for(let i=0;i<track.points.length;i++){const a=track.points[i],b=track.points[(i+1)%track.points.length],dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy,t=den?clamp(((x-a.x)*dx+(y-a.y)*dy)/den,0,1):0,px=a.x+dx*t,py=a.y+dy*t,d=Math.hypot(x-px,y-py);if(d<best.distance)best={distance:d,x:px,y:py,index:i,angle:Math.atan2(dy,dx)};}
 return best;
}
export function createRace(trackId=0){const track=makeTrack(trackId),a=track.points[0],b=track.points[1];return{track,x:a.x,y:a.y,heading:Math.atan2(b.y-a.y,b.x-a.x),vx:0,vy:0,speed:0,time:0,countdown:2.4,lap:0,next:1,checkpoints:0,drift:0,chain:0,chainTime:0,straight:0,offroad:false,phase:'play',events:[],samples:[],nextSample:0};}
const norm=a=>Math.atan2(Math.sin(a),Math.cos(a));
export function step(s,dt,input={}){
 if(s.phase!=='play')return;dt=clamp(dt,0,.05);
 if(s.countdown>0){s.countdown=Math.max(0,s.countdown-dt);return;}
 s.time+=dt;const steer=clamp(Number(input.steer)||0,-1,1),brake=Boolean(input.brake);
 const road=nearest(s.track,s.x,s.y);s.offroad=road.distance>s.track.road*.5;
 const target=s.offroad?66:brake?112:205; s.speed+=(target-s.speed)*Math.min(1,dt*(brake?5:1.3));
 const turn=(brake?2.5:1.8)*Math.min(1,s.speed/100);s.heading+=steer*turn*dt;
 const grip=brake?2.3:6.2;s.vx+=(Math.cos(s.heading)*s.speed-s.vx)*Math.min(1,dt*grip);s.vy+=(Math.sin(s.heading)*s.speed-s.vy)*Math.min(1,dt*grip);
 s.x+=s.vx*dt;s.y+=s.vy*dt;
 if(road.distance>s.track.road*.5+90){s.x+=(road.x-s.x)*dt*2;s.y+=(road.y-s.y)*dt*2;}
 s.x=clamp(s.x,35,865);s.y=clamp(s.y,35,665);
 const slip=Math.abs(norm(Math.atan2(s.vy,s.vx)-s.heading));
 if(!s.offroad&&s.speed>75&&slip>.13&&Math.abs(steer)>.15){s.chainTime+=dt;s.chain+=dt*(35+slip*100);s.straight=0;}
 else{s.straight+=dt;if(s.offroad){s.chain=0;s.chainTime=0;}else if(s.straight>.65&&s.chain>1){const points=Math.floor(s.chain*(1+Math.min(3,s.chainTime*.3)));s.drift+=points;s.events.push({type:'drift',points});s.chain=0;s.chainTime=0;}}
 const cp=s.track.checks[s.next];
 if(Math.hypot(s.x-cp.x,s.y-cp.y)<s.track.road*.62){s.checkpoints++;s.next=(s.next+1)%s.track.checks.length;s.events.push({type:'checkpoint'});if(s.next===1){s.lap++;s.events.push({type:'lap',lap:s.lap});if(s.lap===3){s.phase='won';s.events.push({type:'finish'});}}}
 if(s.time>=s.nextSample){s.samples.push({t:Math.round(s.time*10)/10,x:Math.round(s.x),y:Math.round(s.y),a:Math.round(s.heading*100)/100});s.nextSample+=.1;}
 if(s.time>180){s.phase='over';s.events.push({type:'timeout'});}
}
export function pilot(s){
 const pos=nearest(s.track,s.x,s.y);let target=s.track.points[(pos.index+7)%s.track.points.length];
 const angle=Math.atan2(target.y-s.y,target.x-s.x),diff=norm(angle-s.heading);
 return{steer:clamp(diff*1.9,-1,1),brake:Math.abs(diff)>.34&&s.speed>135};
}
export function ghostAt(samples,time){if(!Array.isArray(samples)||!samples.length)return null;const index=Math.min(samples.length-1,Math.max(0,Math.floor(time*10)));return samples[index];}
export const formatTime=t=>`${Math.floor(t/60)}:${(t%60).toFixed(2).padStart(5,'0')}`;
