// A deterministic salvage expedition. Only banked relics count; the current hold is at risk underwater.
export const WIDTH=900, HEIGHT=1500, DOCK={x:450,y:85};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function dice(seed){let a=seed>>>0;return()=>{a+=0x6d2b79f5;let t=Math.imul(a^a>>>15,a|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
export function upgrades(total=0){const level=total>=1200?3:total>=500?2:total>=150?1:0;return{level,tank:100+level*18,capacity:5+level*2,speed:145+level*8};}
export function createDive(seed=7,total=0){
 const rand=dice(seed),gear=upgrades(total),loot=[],rocks=[],jellies=[];
 for(let i=0;i<44;i++){const y=190+Math.floor(i/5)*140+rand()*65;loot.push({id:i,x:95+(i%5)*175+rand()*30,y,value:18+Math.floor(y/90)*4,rare:i%8===6,revealed:i%8!==6,taken:false});}
 for(let i=0;i<18;i++)rocks.push({x:95+rand()*710,y:320+Math.floor(i/3)*180+rand()*65,r:20+rand()*16});
 for(let i=0;i<9;i++)jellies.push({x:140+rand()*620,y:360+i*115,phase:rand()*6.28});
 return{seed,x:DOCK.x,y:DOCK.y,vx:0,vy:0,facing:1,time:0,oxygen:gear.tank,gear,hold:[],banked:0,deliveries:0,sonar:0,scan:0,invulnerable:0,phase:'play',loot,rocks,jellies,events:[],deepest:0};
}
export function sonar(s){if(s.phase!=='play'||s.sonar>0||s.oxygen<4)return false;s.sonar=7;s.scan=1;s.oxygen-=3;for(const l of s.loot)if(Math.hypot(l.x-s.x,l.y-s.y)<360)l.revealed=true;s.events.push({type:'sonar'});return true;}
export function atDock(s){return Math.hypot(s.x-DOCK.x,s.y-DOCK.y)<65;}
export function step(s,dt,input={}){
 if(s.phase!=='play')return;dt=clamp(dt,0,.05);s.time+=dt;s.sonar=Math.max(0,s.sonar-dt);s.scan=Math.max(0,s.scan-dt*.65);s.invulnerable=Math.max(0,s.invulnerable-dt);
 const ix=clamp(Number(input.x)||0,-1,1),iy=clamp(Number(input.y)||0,-1,1),mag=Math.max(1,Math.hypot(ix,iy));
 const loaded=1-s.hold.length*.026,current=s.y>700?Math.sin(s.time*.65+s.y*.007)*19:Math.sin(s.time*.3)*4;
 s.vx+=(ix/mag*s.gear.speed*loaded+current-s.vx)*Math.min(1,dt*7);s.vy+=(iy/mag*s.gear.speed*loaded-s.vy)*Math.min(1,dt*7);
 const px=s.x,py=s.y;s.x=clamp(s.x+s.vx*dt,28,WIDTH-28);s.y=clamp(s.y+s.vy*dt,55,HEIGHT-45);if(Math.abs(s.vx)>5)s.facing=Math.sign(s.vx);s.deepest=Math.max(s.deepest,Math.floor(s.y/3));
 for(const rock of s.rocks){const dx=s.x-rock.x,dy=s.y-rock.y,d=Math.hypot(dx,dy),r=rock.r+17;if(d<r){if(d>.001){s.x=rock.x+dx/d*r;s.y=rock.y+dy/d*r;}else{s.x=px;s.y=py;}s.vx*=.6;s.vy*=.6;}}
 for(const jelly of s.jellies){const jx=jelly.x+Math.sin(s.time*.7+jelly.phase)*42;if(Math.hypot(s.x-jx,s.y-jelly.y)<35&&s.invulnerable<=0){s.oxygen=Math.max(0,s.oxygen-9);s.invulnerable=1.5;s.events.push({type:'sting'});}}
 for(const l of s.loot)if(!l.taken&&l.revealed&&s.hold.length<s.gear.capacity&&Math.hypot(s.x-l.x,s.y-l.y)<31){l.taken=true;s.hold.push(l);s.events.push({type:'loot',value:l.value});}
 if(atDock(s)){
   s.oxygen=Math.min(s.gear.tank,s.oxygen+dt*28);
   if(s.hold.length){const amount=s.hold.reduce((sum,l)=>sum+l.value*(l.rare?2:1),0);s.banked+=amount;s.deliveries++;s.events.push({type:'bank',amount,count:s.hold.length});s.hold=[];}
 }else s.oxygen=Math.max(0,s.oxygen-dt*(1.15+(s.y>1000?.35:0)));
 if(s.oxygen<=0){s.phase='over';s.events.push({type:'empty'});}
 if(s.time>=150||s.loot.every(l=>l.taken)&&!s.hold.length){s.phase='complete';s.events.push({type:'finish'});}
}
export function pilot(s){
 let target=DOCK;
 if(s.hold.length<Math.min(3,s.gear.capacity)&&s.oxygen>s.gear.tank*.45){
  const choices=s.loot.filter(l=>!l.taken&&l.revealed&&l.y<900).sort((a,b)=>Math.hypot(a.x-s.x,a.y-s.y)-Math.hypot(b.x-s.x,b.y-s.y));target=choices[0]||DOCK;
 }
 let dx=target.x-s.x,dy=target.y-s.y;
 for(const rock of s.rocks){const rx=s.x-rock.x,ry=s.y-rock.y,d=Math.hypot(rx,ry);if(d<rock.r+85){const cross=dx*ry-dy*rx;dx+=(-ry)*(cross>=0?1:-1)*3;dy+=(rx)*(cross>=0?1:-1)*3;}}
 const len=Math.max(1,Math.hypot(dx,dy));return{x:dx/len,y:dy/len};
}
