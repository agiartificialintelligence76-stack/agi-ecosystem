// World positions cross the road in four lanes and move forward in real depth.
// The same ground projection and inverse drive the scene and touch steering.
export const LANES=[-1.2,-.4,.4,1.2];
export const X_LIMIT=1.52, Z_MIN=.38,Z_MAX=3.75;
export const LATERAL_ACCEL=5.8,FORWARD_ACCEL=4.5;
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const laneOf=x=>LANES.reduce((best,v,i)=>Math.abs(v-x)<Math.abs(LANES[best]-x)?i:best,0);
export const toward=(v,t,change)=>v<t?Math.min(t,v+change):Math.max(t,v-change);
export function view(w,h){
 const top=Math.min(83,Math.max(38,h*.155)),ground=h-top,wide=w/h>1.35;
 return {w,h,top,horizon:top+ground*(wide?.17:.19),center:w*.5,
  fx:w*(wide?.89:1.11),fy:ground*3.02,back:3.47,carPixels:Math.min(w,h)*.13};
}
export function centerAt(z,distance,district){
 const amp=[.17,.27,.38,.31][district];
 return amp*(Math.sin(distance*.052+z*.13)-Math.sin(distance*.052));
}
export function project(cam,x,z,alt=0,distance=0,district=0){
 const dz=Math.max(.85,cam.back+z),perspective=1/dz;
 return {x:cam.center+(x+centerAt(z,distance,district))*cam.fx*perspective,
  y:cam.horizon+(1-alt)*cam.fy*perspective,s:cam.fx*perspective,z};
}
export function inverse(cam,sx,sy,distance=0,district=0){
 const z=cam.fy/Math.max(1,sy-cam.horizon)-cam.back;
 return {x:(sx-cam.center)*(cam.back+z)/cam.fx-centerAt(z,distance,district),z};
}
export function swept(a,b,item,advance){
 const ax=a.prevX??a.x,az=(a.prevZ??a.z)-(item.z+advance),dx=(a.x-ax),dz=(a.z-item.z)-az;
 const cx=ax-item.x,rz=b==='near'?.55:.37,rx=b==='near'?.52:item.width+.17;
 const d=dx*dx/(rx*rx)+dz*dz/(rz*rz);
 const t=d?clamp(-(cx*dx/(rx*rx)+az*dz/(rz*rz))/d,0,1):0;
 return ((cx+dx*t)/rx)**2+((az+dz*t)/rz)**2<=1;
}
export function obstructed(a,b,things){
 const dx=b.x-a.x,dz=b.z-a.z,len=dx*dx+dz*dz;
 return things.some(o=>{if(o.kind==='cone'||!len)return false;
  const t=clamp(((o.x-a.x)*dx+(o.z-a.z)*dz)/len,0,1);
  return Math.abs(o.x-a.x-dx*t)<o.width&&Math.abs(o.z-a.z-dz*t)<.33;});
}
export function canLink(s){
 const [a,b]=s.cars,dx=Math.abs(a.x-b.x),dz=Math.abs(a.z-b.z);
 return dx>=.25&&dx<=.98&&dz<=.43&&!a.stun&&!b.stun&&!obstructed(a,b,s.traffic);
}
// A conservative lateral reach envelope includes reaction time, present momentum
// and acceleration. A proposed closure must leave an open, reachable lane for both.
export function safeLanes(cars,z,speed,closed){
 return cars.map(c=>{
  const seconds=Math.max(0,(z-c.z)/speed-.48);
  const reach=Math.max(0,Math.min(2.35*seconds,.5*LATERAL_ACCEL*seconds*seconds)-Math.abs(c.vx||0)*.14);
  return LANES.flatMap((x,i)=>!closed.includes(i)&&Math.abs(x-c.x)<=reach+.34?[i]:[]);
 });
}
export function newWave(s,forced=false){
 const district=s.district,roll=s.random(),work=!forced&&(s.pattern+district)%[4,4,3,3][district]===2;
 const lead=forced?6.7:8.8, speed=forced?.60:work?.91:.72+s.random()*.27;
 const block=Math.floor(roll*4),second=(block+1)%4;
 let closed=work&&s.level>=2?[block,second]:[block];
 if(safeLanes(s.cars,lead,speed,closed).some(l=>!l.length))closed=[block];
 if(safeLanes(s.cars,lead,speed,closed).some(l=>!l.length))return [];
 const created=closed.map((n,i)=>({id:++s.itemId,x:LANES[n],z:lead+i*.09,kind:forced?'van':work?'barrier':s.pattern%3===0?'van':s.pattern%3===1?'taxi':'cone',
  width:work?.28:forced?.28:.22,speed,pass:[false,false],hit:[false,false],near:[false,false],lane:n}));
 s.pattern++;return created;
}
export const DISTRICTS=[
 {name:'Tunnel Club',short:'TUNNEL',sky:['#ecd2aa','#f3a887'],road:'#a98378',edge:'#af635e',ink:'#633f50',mark:'#ffe9c1',tag:'SUBSTATION 08'},
 {name:'Floating Market',short:'MARKET',sky:['#77b6b5','#f6d797'],road:'#b58b75',edge:'#67918c',ink:'#395f65',mark:'#ffedc8',tag:'RIVER MARKET'},
 {name:'Bridgeworks',short:'BRIDGE',sky:['#b8c2c6','#f7bf8e'],road:'#9c8980',edge:'#b47659',ink:'#5d5261',mark:'#fff0c4',tag:'WORKS IN PROGRESS'},
 {name:'Antenna Hill',short:'ANTENNA',sky:['#a49ac1','#f9bcb1'],road:'#a68aa0',edge:'#7b6888',ink:'#564864',mark:'#ffebc2',tag:'FM 88.1'},
];
