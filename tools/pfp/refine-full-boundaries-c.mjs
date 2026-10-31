// Offline measurements within independently reviewed face corridors, 32–47.
// No classifier runs in the portrait renderer; only the final polygons ship.
import {rgbToHsl} from '../../src/pfp/engine.js';
const W=512;
const templeStarts=[223,230,186,195,195,203,210,205,204,213,222,220,222,185,199,200];
const templeEnds=[281,276,253,263,264,263,274,275,271,276,256,271,286,253,261,264];
const fringeBoxes={
 32:[240,150,315,238],33:[285,138,373,226],34:[245,105,326,205],35:[240,115,328,216],
 36:[242,123,326,224],37:[246,123,332,220],38:[250,131,343,226],39:[235,136,324,224],
 40:[230,130,316,224],41:[190,138,286,234],42:[248,119,346,210],43:[245,127,345,222],
 44:[233,145,307,242],45:[238,112,319,205],46:[232,125,318,218],47:[220,125,305,214],
};
// Source-measured envelopes for the shaded skin wedge above the left brow.
// They exclude the warm band of hair immediately under the hats and the
// opposite edge of the central bang. Only source-connected skin grows here.
const shadowWedges={
 32:[240,176,267,227],33:[285,180,319,215],34:[245,135,276,190],35:[240,142,276,200],
 36:[242,148,276,207],37:[246,165,284,209],38:[250,155,290,205],39:[235,145,271,203],
 40:[230,145,260,202],41:[190,165,214,225],42:[248,145,293,200],43:[245,145,289,207],
 44:[233,171,260,224],45:[238,143,267,191],46:[232,150,266,200],47:[220,150,252,202],
};
// Additional right-forehead openings measured from the original at 8×.
// Each row anchor records y, first skin/outline pixel, last skin/outline
// pixel. This restores the shaded triangle, including its dark upper tip.
const rightWedges={
 38:[[143,342,343],[145,341,345],[150,341,349],[155,341,353],[160,342,357],[165,342,360],[170,342,364],[175,342,366],[180,341,369]],
 41:[[138,274,275],[140,274,276],[145,274,280],[150,274,282],[155,274,284],[160,274,287],[165,272,293],[170,271,295],[175,271,300],[180,270,304]],
 42:[[138,345,347],[140,345,350],[145,344,351],[150,344,352],[155,344,353],[160,341,355],[165,340,356],[170,339,358],[175,337,359]],
 43:[[138,343,344],[140,342,345],[145,342,347],[150,340,350],[155,339,351],[160,338,354],[165,337,355],[170,336,356],[175,334,357],[180,331,360],[185,328,361]],
 45:[[114,314,317],[115,314,318],[120,315,322],[125,315,325],[130,315,329],[135,316,331],[140,315,334],[145,314,336],[150,314,341]],
 47:[[128,296,299],[130,296,302],[135,297,305],[140,298,309],[145,298,312],[150,298,316],[155,298,320],[160,298,324],[165,297,328],[170,296,331]],
};
export function refineFullFaceC(source,face,c){
 const kept=Uint8Array.from(face),sum=(x,y)=>{const i=(y*W+x)*4;return Math.max(...source.subarray(i,i+3))+Math.min(...source.subarray(i,i+3));};
 const profile=[],fringe=[];let previous=-1;
 for(let y=templeEnds[c-32]-1;y>=templeStarts[c-32];y--){
  let old=-1;for(let x=300;x<405;x++)if(face[y*W+x])old=x;
  if(old<0)continue;
  let right=-1,best=Infinity;
  const from=previous<0?old-3:Math.max(old-12,previous-1),to=previous<0?old+3:Math.min(old+6,previous+2);
  for(let x=from;x<=to;x++){const cost=sum(x,y)+(previous<0?Math.abs(x-old)*4:Math.abs(x-previous)*8);if(cost<=best){best=cost;right=x;}}
  if(right<0)continue;previous=right;
  for(let k=0;k<2;k++){const i=(y*W+right+1)*4,[h,s,l]=rgbToHsl(...source.subarray(i,i+3));if(h<31.5&&s>.15&&l<.4)right++;else break;}
  for(let x=right+1;x<405;x++)kept[y*W+x]=0;
  for(let x=old+1;x<=right;x++)kept[y*W+x]=1;
  profile.push([y,right,old]);
 }
 const[x0,y0,x1,y1]=fringeBoxes[c],gold=new Uint8Array(W*W),seenGold=new Uint8Array(W*W),goldQueue=[];
 for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
  const p=y*W+x,i=p*4,[h,s]=rgbToHsl(...source.subarray(i,i+3));
  if(h>=34.5&&h<70&&s>.3&&source[i]>=175&&source[i+1]>=105&&(h>=38||source[i+2]<=110)){
   gold[p]=1;if(!kept[p]&&h>=39.5){seenGold[p]=1;goldQueue.push(p);}
  }
 }
 for(let i=0;i<goldQueue.length;i++)for(const p of[goldQueue[i]-1,goldQueue[i]+1,goldQueue[i]-W,goldQueue[i]+W])if(gold[p]&&!seenGold[p]){seenGold[p]=1;goldQueue.push(p);}
 for(const p of goldQueue)if(kept[p]){kept[p]=0;fringe.push([p%W,Math.floor(p/W),'hair']);}
 const allowed=new Uint8Array(W*W),seen=new Uint8Array(W*W),q=[];
 const [sx0,sy0,sx1,sy1]=shadowWedges[c];
 for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
  const p=y*W+x,i=p*4,[h,s,l]=rgbToHsl(...source.subarray(i,i+3)),max=Math.max(...source.subarray(i,i+3)),chroma=max-Math.min(...source.subarray(i,i+3));
  // Growth is limited to the peach interior. Warm hair shadows below hats and
  // beside bangs share the skin hue, but have much less blue than this skin.
  // Existing dark eyebrow/ink pixels remain protected; they cannot seed a
  // connected route into hair shadow.
  const inShadow=y>=sy0&&y<=sy1&&x<=sx1&&x>=sx1-8-(sx1-8-sx0)*(y-sy0)/(sy1-sy0);
  const peach=chroma>60&&l<.9&&h>=0&&h<38&&s>.15&&source[i+2]>105;
  const shadedSkin=inShadow&&((h>=0&&h<34.5&&s>.15&&l>.04&&l<.9)||max<80);
  if(!seenGold[p]&&(peach||shadedSkin)){allowed[p]=1;if(kept[p]){seen[p]=1;q.push(p);}}
 }
 for(let i=0;i<q.length;i++)for(const p of[q[i]-1,q[i]+1,q[i]-W,q[i]+W])if(allowed[p]&&!seen[p]){seen[p]=1;q.push(p);}
 for(const p of q)if(!kept[p]){kept[p]=1;fringe.push([p%W,Math.floor(p/W),'skin']);}
 const rows=rightWedges[c];
 if(rows)for(let y=rows[0][0];y<=rows.at(-1)[0];y++){
  const k=rows.findIndex(row=>row[0]>=y),a=rows[Math.max(0,k-1)],b=rows[k],t=k?(y-a[0])/(b[0]-a[0]):0;
  const left=Math.round(a[1]+(b[1]-a[1])*t),right=Math.round(a[2]+(b[2]-a[2])*t);
  for(let x=left;x<=right;x++)kept[y*W+x]=1;
 }
 return{mask:kept,profile,fringe,box:fringeBoxes[c]};
}
