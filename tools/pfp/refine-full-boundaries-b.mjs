// Offline source-contour measurements for the 16–31 face variants.
// Runtime receives only the traced pixel polygons, never these classifiers.
import { rgbToHsl } from '../../src/pfp/engine.js';
const W=512;
const templeStarts=[178,199,204,204,188,216,201,211,222,190,189,183,193,195,214,221];
const templeEnds=[239,263,272,258,261,275,261,274,261,255,259,243,240,250,265,275];
// Only the individually reviewed central fringe/forehead corridor. No cheek,
// eye, ear or neck pixels are classified through their color here.
const fringeBoxes={
 16:[243,117,318,199],17:[250,145,316,221],18:[210,144,311,224],19:[247,145,320,232],
 20:[232,132,301,215],21:[247,168,313,238],22:[241,143,302,224],23:[266,172,334,236],
 24:[272,150,355,219],25:[233,131,300,211],26:[244,141,313,216],27:[251,130,320,201],
 28:[244,130,318,196],29:[257,128,329,205],30:[259,142,330,224],31:[248,140,323,233],
};
export function refineFullFace(source,face,c){
 const kept=Uint8Array.from(face),sum=(x,y)=>{const o=(y*W+x)*4;return Math.max(source[o],source[o+1],source[o+2])+Math.min(source[o],source[o+1],source[o+2]);};
 const profile=[];
 let previous=-1;
 for(let y=templeEnds[c-16]-1;y>=templeStarts[c-16];y--){
  let old=-1;for(let x=300;x<400;x++)if(face[y*W+x])old=x;
  if(old<0)continue;
  let right=-1,best=Infinity;
  const from=previous<0?old-3:Math.max(old-12,previous-1),to=previous<0?old+3:Math.min(old+6,previous+2);
  for(let x=from;x<=to;x++){const cost=sum(x,y)+(previous<0?Math.abs(x-old)*4:Math.abs(x-previous)*8);if(cost<=best){best=cost;right=x;}}
  if(right<0)continue;previous=right;
  // The ink has a brown antialiased outside edge in the originals. Retain
  // that edge; white hair must not replace half of the face outline.
  for(let k=0;k<2;k++){const p=(y*W+right+1)*4,[h,s,l]=rgbToHsl(source[p],source[p+1],source[p+2]);if(h<31.5&&s>.15&&l<.4)right++;else break;}
  for(let x=right+1;x<400;x++)kept[y*W+x]=0;
  for(let x=old+1;x<=right;x++)kept[y*W+x]=1;
  profile.push([y,right,old]);
 }
 const [x0,tipY,x1,y1]=fringeBoxes[c],y0=c===17?160:c===26?125:tipY,fringe=[];
 const near=Uint8Array.from(kept),gold=new Uint8Array(W*W),goldSeen=new Uint8Array(W*W),goldQueue=[];
 for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
  const p=y*W+x,o=p*4,[h,s,l]=rgbToHsl(source[o],source[o+1],source[o+2]);
  if(h>=34.5&&h<70&&s>.3&&source[o]>=175&&source[o+1]>=105&&(h>=38||source[o+2]<=110)){gold[p]=1;if(!near[p]&&h>=39.5){goldSeen[p]=1;goldQueue.push(p);}}
 }
 for(let i=0;i<goldQueue.length;i++)for(const p of[goldQueue[i]-1,goldQueue[i]+1,goldQueue[i]-W,goldQueue[i]+W])if(gold[p]&&!goldSeen[p]){goldSeen[p]=1;goldQueue.push(p);}
 for(const p of goldQueue)if(kept[p]){kept[p]=0;fringe.push([p%W,Math.floor(p/W),'hair']);}
 {
  const allowed=new Uint8Array(W*W),seen=new Uint8Array(W*W),q=[];
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const p=y*W+x,o=p*4,[h,s,l]=rgbToHsl(source[o],source[o+1],source[o+2]),max=Math.max(source[o],source[o+1],source[o+2]),chroma=max-Math.min(source[o],source[o+1],source[o+2]);if((chroma>60&&l<.9&&((h>=0&&h<34.5&&s>.15&&l>.04)||(h>=0&&h<38&&source[o+2]>110)))||max<80){allowed[p]=1;if(kept[p]){seen[p]=1;q.push(p);}}}
  for(let i=0;i<q.length;i++)for(const p of[q[i]-1,q[i]+1,q[i]-W,q[i]+W])if(allowed[p]&&!seen[p]){seen[p]=1;q.push(p);}
  for(const p of q)if(!kept[p]){kept[p]=1;fringe.push([p%W,Math.floor(p/W),'skin']);}
  // Warm antialiased peach may straddle the two foreground samples. Close
  // only a one-pixel gap bounded by real forehead on both sides, not a gold
  // strand or a larger opening in the fringe.
  const beforeGaps=Uint8Array.from(kept);
  for(let y=y0;y<y1;y++)for(let x=x0+1;x<x1-1;x++){const p=y*W+x,o=p*4,[h]=rgbToHsl(source[o],source[o+1],source[o+2]);if(!beforeGaps[p]&&beforeGaps[p-1]&&beforeGaps[p+1]&&h<38&&source[o]>205&&source[o+2]>90)kept[p]=1;}
 }
 const cheekWindows={20:[184,212,249,274,287],22:[193,215,248,274,287],23:[233,258,263,285,301],26:[198,225,250,275,289],27:[201,227,238,255,275]};
 if(cheekWindows[c]){
  const [left,right,top,bottom0,bottom1]=cheekWindows[c];
  for(let x=left;x<=right;x++){
   let bottom=bottom0,best=Infinity;
   for(let y=bottom0;y<=bottom1;y++){const v=sum(x,y);if(v<best){best=v;bottom=y;}}
   for(let y=top;y<=bottom;y++){const p=y*W+x,o=p*4,[h,s,l]=rgbToHsl(source[o],source[o+1],source[o+2]);if(h<34.5&&s>.2)kept[p]=1;}
  }
 }
 return {mask:kept,profile,fringe};
}
