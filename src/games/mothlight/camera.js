import { clamp } from '../kit/garden-art.js';

// The photographer trucks sideways and changes camera height. A lens changes the
// focal length in pixels. Subjects, scenery and obstructions live in metres.
export const optics=[463,925,1470];
export const focusStops=[2.4,3.8,5.2];
export const center={x:240,y:184};
export function project(point,camera,lens){
 const scale=optics[lens]/point.z;
 return {x:center.x+(point.x-camera.x)*scale,y:center.y-(point.y-camera.y)*scale,scale};
}
export const eyeHeight=1.50;
export function focusQuality(depth,dial,lens){
 const aperture=[4,5.6,7.5][lens];
 return clamp(1-Math.abs(1/depth-1/focusStops[dial])*aperture,0,1);
}
export function blockedBy(subject,camera,posts){
 return posts.some(post=>{
  if(post.z>=subject.z)return false;
  const fraction=post.z/subject.z;
  const rayX=camera.x+(subject.x-camera.x)*fraction,rayY=camera.y+(eyeHeight-camera.y)*fraction;
  return rayY>=0&&rayY<=post.h&&Math.abs(rayX-post.x)<post.radius;
 });
}
export function assess({subject,goal,camera,lens,wantLens,focus,pose,posts}){
 const aim=project(goal,camera,lens);
 const framing=clamp(1-Math.hypot((aim.x-center.x)/130,(aim.y-center.y)/100),0,1);
 const sharp=focusQuality(subject.z,focus,lens),blocked=blockedBy(subject,camera,posts);
 const score=Math.max(0,Math.round(34*framing+25*sharp+22*pose+19*Number(lens===wantLens)-29*Number(blocked)));
 return {score,framing,sharp,blocked};
}
