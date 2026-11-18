export const STEP=1/120;
export const presets=[
 {name:'Launch lesson',start:[57,319],moons:[[225,209,32,120000]],angle:-17,power:158,duration:2.12},
 {name:'Strawberry slalom',start:[429,317],moons:[[250,203,36,165000]],angle:196,power:163,duration:2.04,buoy:.82},
 {name:'Blue shift',start:[54,301],moons:[[214,192,32,180000],[386,319,20,95000]],angle:-16,power:156,duration:2.01,buoy:.76,flip:.93},
 {name:'Paper moons',start:[421,180],moons:[[281,299,37,172000],[149,164,20,82000]],angle:159,power:178,duration:1.95,buoy:.7,flip:1.02},
 {name:'Ringside',start:[61,170],moons:[[164,290,27,120000],[335,170,30,158000]],angle:17,power:164,duration:2.14,buoy:.73,flip:1.07},
 {name:'Homeward arc',start:[428,302],moons:[[296,164,37,190000],[156,315,29,145000]],angle:202,power:168,duration:2.19,buoy:.79,flip:1.19},
];
export const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
export function closePass(pod,[x,y,r]){
  const clearance=Math.hypot(pod.x-x,pod.y-y)-r;
  return clearance>=6 && clearance<=22;
}
export function launch(preset,deg,power){const a=deg*Math.PI/180;return {x:preset.start[0],y:preset.start[1],vx:Math.cos(a)*power,vy:Math.sin(a)*power,age:0,polarity:1,flipped:false};}
export function integrate(pod,moons,dt=STEP){
  for(const [x,y,r,mass] of moons){
    const dx=x-pod.x,dy=y-pod.y,rr=Math.max(dx*dx+dy*dy,(r+6)**2);
    const accel=pod.polarity*mass/(rr*Math.sqrt(rr));pod.vx+=dx*accel*dt;pod.vy+=dy*accel*dt;
  }
  pod.x+=pod.vx*dt;pod.y+=pod.vy*dt;pod.age+=dt;
}
export function wreck(pod,moons){
  return pod.x<9||pod.x>471||pod.y<97||pod.y>401||pod.age>5.5
    ||moons.some(([x,y,r])=>Math.hypot(pod.x-x,pod.y-y)<r+6);
}
export function reverse(pod){
  if(!pod||pod.flipped)return false;pod.flipped=true;pod.polarity=-1;return true;
}
// Place the gates on a tested orbit. A little launch-angle variation changes a
// fresh course without unlucky planets or inaccessible finish lines.
export function course(preset,jitter=0){
  const ref=launch(preset,preset.angle+jitter,preset.power);
  const layout={...preset,solution:preset.angle+jitter,ring:null,beacon:null};
  while(ref.age<preset.duration){
    if(preset.flip && ref.age>=preset.flip)reverse(ref);
    integrate(ref,preset.moons);
    if(wreck(ref,preset.moons)){if(jitter)return course(preset);throw Error('Unavailable reference orbit: '+preset.name);}
    if(preset.buoy && !layout.beacon && ref.age>=preset.buoy)layout.beacon=[ref.x,ref.y];
  }
  layout.ring=[ref.x,ref.y];return layout;
}
export function passage(course,pod,checkpoint){
 const pos=[pod.x,pod.y];
 const marked=checkpoint||!course.beacon||distance(pos,course.beacon)<20;
 return {marked,finish:marked&&(!course.flip||pod.flipped)&&distance(pos,course.ring)<20};
}
