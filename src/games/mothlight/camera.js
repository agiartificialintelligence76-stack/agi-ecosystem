export const clamp=(n,lo=0,hi=1)=>Math.max(lo,Math.min(hi,n));
export const optics=[.70,1.03,1.55],ASPECT=1.5;
export function cameraTransform(point,cam){
 const dx=point.x-cam.truck,dy=point.y-1.30,z=point.z,cy=Math.cos(cam.pan),sy=Math.sin(cam.pan),ct=Math.cos(cam.tilt),st=Math.sin(cam.tilt);
 const x=dx*cy-z*sy,forward=z*cy+dx*sy;
 return {x,y:dy*ct-forward*st,z:forward*ct+dy*st};
}
export function project(point,cam,lens,focus=4){
 const p=cameraTransform(point,cam),f=optics[lens]*(1+(1/clamp(focus,1.7,8)-.25)*.035),scale=f/Math.max(.15,p.z);
 return {u:.5+p.x*scale,v:.5-p.y*scale*ASPECT,scale,depth:p.z};
}
export function focusQuality(depth,focus,lens){
 const error=Math.abs(1/Math.max(.2,depth)-1/clamp(focus,1.7,8));
 return Math.exp(-((error/[.097,.065,.039][lens])**2));
}
export const eyeHeight=1.48;
export function occlusion(eye,cam,posts,radius=.115){
 // Ray-model face diameter in metres. Union overlapping projected strips so
 // two aligned rails do not hide the same fraction of a face twice.
 const parts=[];
 for(const p of posts){if(p.z>=eye.z||p.z<=0)continue;
  const k=p.z/eye.z,rayY=1.30+(eye.y-1.30)*k;
  if(rayY<p.bottom||rayY>p.top)continue;
  const x=cam.truck+(eye.x-cam.truck)*k,r=radius*k;
  const lo=Math.max(-1,(p.x-p.r-x)/r),hi=Math.min(1,(p.x+p.r-x)/r);
  if(hi>lo)parts.push([lo,hi]);
 }
 parts.sort((a,b)=>a[0]-b[0]);let last=-1,total=0;
 for(const [lo,hi] of parts){if(hi<=last)continue;total+=hi-Math.max(last,lo);last=hi;}
 return clamp(total*.5);
}
export const bounds={truck:[-1.9,1.9],pan:[-.61,.61],tilt:[-.42,.46],focus:[1.7,8]};
export const neutral=()=>({truck:0,pan:0,tilt:0,lens:1,focus:4});
export function pointAt(cam,point,anchor={u:.5,v:.34}){
 const f=optics[cam.lens]*(1+(1/cam.focus-.25)*.035);
 const pan=clamp(Math.atan2(point.x-cam.truck,point.z)-Math.atan((anchor.u-.5)/f),...bounds.pan);
 const dx=point.x-cam.truck,forward=point.z*Math.cos(pan)+dx*Math.sin(pan);
 const tilt=clamp(Math.atan2(point.y-1.30,forward)-Math.atan((.5-anchor.v)/(ASPECT*f)),...bounds.tilt);
 return {...cam,pan,tilt};
}
export function reflected(eye){return {...eye,y:-eye.y};}
