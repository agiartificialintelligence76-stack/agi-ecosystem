// Offline source measurements for shaded cheeks and ear outlines. These
// bounded corridors are converted to static polygons by the C generator.
import {rgbToHsl} from '../../src/pfp/engine.js';
const W=512;
const cheeks={
 35:{box:[220,239,249],bottom:[[220,265],[224,266],[228,268],[232,270],[236,272],[239,274]]},
 36:{box:[222,244,258],bottom:[[222,277],[226,278],[230,280],[235,280],[240,282],[244,284]]},
 38:{box:[236,258,262],bottom:[[236,280],[241,281],[247,282],[251,285],[258,289]]},
 40:{box:[202,229,255],bottom:[[202,273],[207,276],[210,276],[214,280],[220,283],[229,289]]},
 44:{box:[202,228,276],bottom:[[202,296],[207,299],[211,298],[215,300],[219,302],[224,306],[228,308]]},
 46:{box:[213,238,252],bottom:[[213,266],[218,269],[222,267],[226,268],[231,273],[238,277]]},
 47:{box:[192,220,250],bottom:[[192,269],[197,271],[201,271],[203,269],[207,273],[213,276],[220,280]]},
};
const at=(points,x)=>{const n=points.findIndex(([a])=>a>=x),a=points[Math.max(0,n-1)],b=points[n];return n===0?a[1]:a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);};
export function refineCheekC(character,source,mask,regionIndex=0){
 const out=Uint8Array.from(mask),light=(x,y)=>{const o=(y*W+x)*4;return Math.max(...source.subarray(o,o+3))+Math.min(...source.subarray(o,o+3));};
 // The caller supplies each anatomy polygon separately: region zero is
 // the face, and region two is the reviewed ear in these source sprites.
 if(regionIndex===0&&cheeks[character]){
  const {box:[left,right,top],bottom}=cheeks[character];
  for(let x=left;x<=right;x++){
   const expected=at(bottom,x);let edge=Math.round(expected),best=Infinity;
   for(let y=Math.floor(expected)-1;y<=Math.ceil(expected)+1;y++){const v=light(x,y);if(v<best){best=v;edge=y;}}
   // The outer AA belongs to the source ink. Retain its dark brown sample,
   // but stop before the brighter shaded hair below the jaw.
   if(light(x,edge+1)<best+30)edge++;
   for(let y=top;y<=edge;y++){
    const p=y*W+x,o=p*4,[h,s]=rgbToHsl(...source.subarray(o,o+3));
    if(s>.2&&(h<34.5||(h<38&&source[o+2]>100)||(h<42&&source[o]>=245&&source[o+2]>=140)))out[p]=1;
   }
  }
 }
 if(regionIndex===0&&character===39){
  // Right jaw: original peach/ink AA pixels were omitted above the dark
  // contour, producing a white zipper when the hair became Moonlight.
  const edge=[[274,343],[277,340],[281,337],[285,332],[289,328],[293,323]];
  for(let y=274;y<=293;y++){
   const expected=at(edge,y);let right=Math.round(expected),best=Infinity;
   for(let x=Math.floor(expected)-1;x<=Math.ceil(expected)+1;x++){const v=light(x,y);if(v<best){best=v;right=x;}}
   if(light(right+1,y)<best+30)right++;
   for(let x=320;x<=right;x++)out[y*W+x]=1;
  }
 }
 if(character===32&&regionIndex===2){
  // Lower-left ear: the actual dark lobe stroke precedes the old mask edge
  // by several pixels. Each column keeps that stroke and its brown AA.
  const edge=[[159,282],[162,288],[166,294],[170,299],[174,302],[178,304],[182,306],[184,306]];
  for(let x=159;x<=184;x++){
   const expected=at(edge,x);let bottom=Math.round(expected),best=Infinity;
   for(let y=Math.floor(expected)-1;y<=Math.ceil(expected)+1;y++){const v=light(x,y);if(v<best){best=v;bottom=y;}}
   for(let k=0;k<2&&light(x,bottom+1)<best+40;k++)bottom++;
   for(let y=bottom+1;y<=315;y++)out[y*W+x]=0;
  }
 }
 if(regionIndex===2&&[35,44,46,47].includes(character)){
  const [left,right,top,bottom]={35:[169,190,238,274],44:[155,177,264,298],46:[165,183,244,274],47:[140,159,240,271]}[character];
  for(let x=left;x<=right;x++){
   let bright=-1;
   for(let y=top;y<=bottom;y++){
    const p=y*W+x,o=p*4,[h]=rgbToHsl(...source.subarray(o,o+3));
    if(mask[p]&&source[o]>=210&&source[o+1]>=145&&source[o+2]>=85&&h<35.5)bright=y;
   }
   if(bright<0)continue;
   let edge=bright,best=Infinity;
   for(let y=bright;y<=Math.min(bottom+2,bright+6);y++){const v=light(x,y);if(v<best){best=v;edge=y;}}
   for(let k=0;k<2&&light(x,edge+1)<best+40;k++)edge++;
   for(let y=edge+1;y<=bottom+5;y++)out[y*W+x]=0;
  }
 }
 return out;
}
