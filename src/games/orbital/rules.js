export const WORLD={w:540,h:620};
export const PHYS={g:6000,ship:5,minPower:130,maxPower:390,dt:1/120};
const layouts=[
  {name:'First contact',planets:[[105,490,34],[405,155,42]],par:1},
  {name:'Gentle gravity',planets:[[100,500,34],[270,325,42],[420,140,39]],par:2},
  {name:'Around the blue',planets:[[90,450,31],[260,310,60],[445,200,36]],par:2},
  {name:'A little detour',planets:[[105,515,32],[400,395,42],[135,245,34],[420,105,38]],par:3},
  {name:'Between worlds',planets:[[100,510,35],[230,390,37],[370,285,42],[430,105,40]],par:3},
  {name:'The gravity garden',planets:[[90,525,34],[390,430,48],[155,285,46],[365,165,43],[440,70,32]],par:4},
];
export const LEVELS=layouts.flatMap((l,i)=>[0,1].map(f=>({id:i*2+f,name:f?`${l.name} · far side`:l.name,par:l.par,planets:l.planets.map(([x,y,r],j)=>({x:f?WORLD.w-x:x,y,r,color:j%4,mu:r*PHYS.g})),shards:[{x:f?205:335,y:430},{x:f?330:210,y:190},{x:f?145:395,y:225}]})));
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function createFlight(index=0){const def=LEVELS[clamp(index,0,LEVELS.length-1)],p=def.planets[0];return {index:def.id,dock:0,x:p.x,y:p.y-p.r-PHYS.ship-2,vx:0,vy:0,phase:'aim',fuel:7,shots:0,time:0,collected:0,trail:[],event:null};}
export function launch(w,angle,power){if(w.phase!=='aim'||w.fuel<=0||!Number.isFinite(angle)||!Number.isFinite(power))return false;const p=LEVELS[w.index].planets[w.dock],v=clamp(power,PHYS.minPower,PHYS.maxPower);w.x=p.x+Math.cos(angle)*(p.r+PHYS.ship+3);w.y=p.y+Math.sin(angle)*(p.r+PHYS.ship+3);w.vx=Math.cos(angle)*v;w.vy=Math.sin(angle)*v;w.phase='flight';w.time=0;w.fuel--;w.shots++;w.trail=[];w.event='launch';return true;}
export function recall(w){if(w.phase!=='flight'&&w.phase!=='lost')return false;const p=LEVELS[w.index].planets[w.dock];w.x=p.x;w.y=p.y-p.r-PHYS.ship-2;w.vx=w.vy=0;w.phase=w.fuel?'aim':'empty';w.event='recall';return true;}
export function step(w,dt=PHYS.dt,{trail=true}={}){
  if(w.phase!=='flight')return;const def=LEVELS[w.index];w.event=null;w.time+=dt;
  let ax=0,ay=0;for(const p of def.planets){const dx=p.x-w.x,dy=p.y-w.y,d2=dx*dx+dy*dy,safe=Math.max(d2,(p.r+5)**2),d=Math.sqrt(Math.max(1,d2));ax+=p.mu*dx/(safe*d);ay+=p.mu*dy/(safe*d);}
  w.vx+=ax*dt;w.vy+=ay*dt;w.x+=w.vx*dt;w.y+=w.vy*dt;
  if(trail){w.trail.push({x:w.x,y:w.y});if(w.trail.length>260)w.trail.shift();}
  def.shards.forEach((s,i)=>{if(Math.hypot(w.x-s.x,w.y-s.y)<24){w.collected|=1<<i;w.event='shard';}});
  for(let i=0;i<def.planets.length;i++){const p=def.planets[i];if(w.time<.15&&i===w.dock)continue;if(Math.hypot(w.x-p.x,w.y-p.y)<=p.r+PHYS.ship){w.dock=i;w.vx=w.vy=0;w.x=p.x;w.y=p.y-p.r-PHYS.ship-2;w.phase=i===def.planets.length-1?'won':w.fuel?'aim':'empty';w.event=w.phase==='won'?'win':'land';return;}}
  if(w.x<-65||w.x>WORLD.w+65||w.y<-65||w.y>WORLD.h+65||w.time>12){w.phase='lost';w.event='lost';}
}
export function predict(w,angle,power,seconds=5){const copy=structuredClone(w);if(!launch(copy,angle,power))return [];const points=[];for(let i=0;i<seconds*120&&copy.phase==='flight';i++){step(copy,PHYS.dt,{trail:false});if(i%8===0)points.push({x:copy.x,y:copy.y,phase:copy.phase});}return points;}
// The same physics drives the demo and these reference launches; no teleporting or scripted wins.
export function planShot(w){const def=LEVELS[w.index],p=def.planets[w.dock],goal=def.planets.at(-1),base=Math.atan2(goal.y-p.y,goal.x-p.x);let best=null,bestCost=Infinity;
  for(let offset=0;offset<=90;offset+=3)for(const sign of offset?[1,-1]:[1])for(let power=150;power<=390;power+=20){const angle=base+offset*sign*Math.PI/180,c=structuredClone(w);launch(c,angle,power);let min=Infinity;for(let i=0;i<1200&&c.phase==='flight';i++){step(c,PHYS.dt,{trail:false});min=Math.min(min,Math.hypot(c.x-goal.x,c.y-goal.y)-goal.r);}
    if(c.phase==='won')return {angle,power,goal:true};
    const progress=c.phase==='aim'&&c.dock!==w.dock?Math.hypot(def.planets[c.dock].x-goal.x,def.planets[c.dock].y-goal.y):min+500;
    if(progress<bestCost){bestCost=progress;best={angle,power,goal:false};}
  }return best||{angle:base,power:250,goal:false};
}
export const starsFor=w=>1+(w.shots<=LEVELS[w.index].par?1:0)+(w.collected.toString(2).replaceAll('0','').length>=2?1:0);
