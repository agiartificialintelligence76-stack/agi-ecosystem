import fs from 'node:fs/promises';
import sharp from 'sharp';
import {SKIN_REGIONS_B} from '../../src/pfp/skin-regions-b.js';
import {rgbToHsl} from '../../src/pfp/engine.js';
import {refineFullFaceC} from './refine-full-boundaries-c.mjs';
import {refineCheekC} from './cheek-restorations-c.mjs';
import {refineForeheadC} from './forehead-restorations-c.mjs';
import {refineRightWedgeC} from './right-wedge-restorations-c.mjs';
const out='output/pfp-boundary-fix/c'; await fs.mkdir(out,{recursive:true});
const inside=(x,y,p)=>{let r=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const[a,b]=p[i],[c,d]=p[j];if((b>y)!=(d>y)&&x<(c-a)*(y-b)/(d-b)+a)r=!r;}return r;};
function raster(p){const mask=new Uint8Array(512*512);for(let y=0;y<512;y++){const xs=[];for(let i=0,j=p.length-1;i<p.length;j=i++){const[a,b]=p[i],[c,d]=p[j];if((b>y+.5)!=(d>y+.5))xs.push(a+(y+.5-b)*(c-a)/(d-b));}xs.sort((a,b)=>a-b);for(let i=0;i+1<xs.length;i+=2)mask.fill(1,y*512+Math.max(0,Math.ceil(xs[i]-.5)),y*512+Math.min(512,Math.ceil(xs[i+1]-.5)));}return mask;}
function contours(mask){
  const edges=new Map();const add=(a,b)=>{const k=a.join(',');(edges.get(k)||edges.set(k,[]).get(k)).push(b);};
  for(let y=0;y<512;y++)for(let x=0;x<512;x++) {const i=y*512+x;if(!mask[i])continue;if(y===0||!mask[i-512])add([x,y],[x+1,y]);if(x===511||!mask[i+1])add([x+1,y],[x+1,y+1]);if(y===511||!mask[i+512])add([x+1,y+1],[x,y+1]);if(x===0||!mask[i-1])add([x,y+1],[x,y]);}
  const loops=[];while(edges.size){const start=edges.keys().next().value.split(',').map(Number),loop=[start];let current=start;for(let c=0;c<20000;c++){const k=current.join(',');const next=edges.get(k)?.pop();if(!next)break;if(!edges.get(k).length)edges.delete(k);if(next[0]===start[0]&&next[1]===start[1])break;loop.push(next);current=next;}if(loop.length>2){const reduced=loop.filter((p,i)=>{const a=loop[(i+loop.length-1)%loop.length],b=loop[(i+1)%loop.length];return(a[0]-p[0])*(b[1]-p[1])!==(a[1]-p[1])*(b[0]-p[0]);});loops.push(reduced);}}
  return loops.sort((a,b)=>area(b)-area(a));
}
function area(p){return Math.abs(p.reduce((s,[x,y],i)=>{const[a,b]=p[(i+1)%p.length];return s+x*b-a*y;},0));}
function exactContour(mask){
  const loops=contours(mask);let polygon=loops.shift();
  for(const loop of loops){let a=0,b=0,distance=Infinity;for(let i=0;i<polygon.length;i++)for(let j=0;j<loop.length;j++){const d=(polygon[i][0]-loop[j][0])**2+(polygon[i][1]-loop[j][1])**2;if(d<distance){distance=d;a=i;b=j;}}const rotated=[...loop.slice(b),...loop.slice(0,b)];polygon=[...polygon.slice(0,a+1),...rotated,rotated[0],polygon[a],...polygon.slice(a+1)];}
  const actual=raster(polygon),bad=actual.findIndex((v,p)=>v!==mask[p]);if(bad>=0)throw Error(`Face contour differs at ${bad%512},${Math.floor(bad/512)}`);return polygon;
}
const interpolate=(points,y)=>{const k=points.findIndex(v=>v[0]>=y),a=points[Math.max(0,k-1)],b=points[k];return k===0?a[1]:a[1]+(b[1]-a[1])*(y-a[0])/(b[0]-a[0]);};
function reviewedFaceEdges(source,regions,n){
  if(![34,35,37,39,41,42,47].includes(n))return regions;
  const mask=raster(regions[0]);
  if(n===34){
    const original=Uint8Array.from(mask);
    // The sideburn below the outer lash is hair. The bright cheek begins
    // farther right; these anchors retain the source lash and skin gradient.
    const edge=[[220,218],[225,222],[230,227],[235,229],[240,230],[245,231],[250,233],[255,235],[260,237]];
    for(let y=220;y<=260;y++){const x=Math.round(interpolate(edge,y));for(let q=205;q<x;q++)mask[y*512+q]=0;}
    // The outer lash projects left of the cheek. Preserve its full dark
    // stroke and source AA; it must not inherit the sideburn's color.
    for(let y=212;y<=233;y++)for(let x=210;x<240;x++){const p=y*512+x,i=p*4;if(original[p]&&Math.max(...source.subarray(i,i+3))<170)mask[p]=1;}
    // The skin slope continues below the restored right forehead through
    // the upper eyelid. Retain the measured source crease and outer lash AA.
    for(const[y,right]of[[166,364],[167,365],[168,365],[169,365],[170,365],[171,364],[172,368],[173,368],[174,367],[175,370]]){
      for(let x=350;x<=right;x++)mask[y*512+x]=1;
    }
  }
  if(n===37||n===47){
    const edge=n===37?[[225,369],[235,368],[245,367],[255,364],[265,356],[275,347],[285,335],[295,323],[301,313]]:[[205,342],[215,341],[225,339],[235,338],[245,336],[255,332],[265,323]];
    for(let y=edge[0][0];y<=edge.at(-1)[0];y++){
      const expected=interpolate(edge,y),lum=x=>{const i=(y*512+x)*4;return .3*source[i]+.6*source[i+1]+.1*source[i+2];};
      let x=Math.round(expected),lowest=Infinity;
      for(let q=Math.floor(expected)-2;q<=Math.ceil(expected)+2;q++){const l=lum(q);if(l<lowest){lowest=l;x=q;}}
      // Retain the full dark stroke and its outer antialiasing. Filling the
      // interior also repairs the old mask's missing bright jaw half-pixels.
      while(x<expected+3&&lum(x+1)<lowest+40)x++;
      for(let q=300;q<400;q++)mask[y*512+q]=q<=x?1:0;
    }
  }
  if(n===47){
    for(let y=200;y<205;y++)for(let x=344;x<360;x++)mask[y*512+x]=0;
    for(let y=190;y<205;y++)for(let x=337;x<346;x++){const i=(y*512+x)*4;if(Math.max(...source.subarray(i,i+3))<125)mask[y*512+x]=1;}
  }
  if(n===41){
    // A bright front lock crosses the cheek without a dark ink border. Its
    // tapered gold tip ends at row266; the true cheek returns beneath it.
    const edge=[[240,330],[245,329],[250,328],[255,325],[260,323],[265,321],[266,323],[267,330],[269,330]];
    for(let y=240;y<=269;y++)for(let x=318;x<345;x++)mask[y*512+x]=x<=Math.round(interpolate(edge,y))?1:0;
  }
  if(n===39){
    // The source upper eyelid slopes continuously into the outer lash.
    // Its shaded peach pixels were cut away by the former rectangular edge.
    for(const[y,right]of[[196,355],[197,356],[198,358],[199,359],[200,359],[201,359],[202,360],[203,360],[204,361],[205,361],[206,361]]){
      for(let x=347;x<=right;x++)mask[y*512+x]=1;
    }
  }
  if(n===42){
    const ear=raster(regions[2]);
    const left=[[210,161],[212,161],[214,161],[216,162],[218,162],[220,164],[222,164],[224,167],[226,168],[228,169],[230,171],[232,173],[234,174],[235,175]];
    const right=[[202,179],[204,179],[206,179],[208,179],[210,178],[212,178],[214,176],[216,176],[218,176],[220,176],[222,176],[224,176],[226,176],[228,176],[230,176],[232,176],[234,175],[235,175]];
    for(let y=202;y<245;y++)for(let x=150;x<190;x++){
      if(y>235){ear[y*512+x]=0;continue;}
      const r=Math.round(interpolate(right,y));
      if(y<210){if(x>r)ear[y*512+x]=0;continue;}
      const l=Math.round(interpolate(left,y));ear[y*512+x]=x>=l&&x<=r?1:0;
    }regions[2]=contours(ear)[0];
  }
  if(n===35||n===39){
    for(let region=0;region<2;region++){
      const material=region===0?mask:raster(regions[region]);
      if(n===35){
        // Source dark neck outline, left side: the old face and neck both
        // overlapped the shaded lock by four to six pixels.
        const left=[[280,249],[305,249],[310,248],[315,248],[320,246]];
        for(let y=280;y<=320;y++)for(let x=235;x<Math.round(interpolate(left,y));x++)material[y*512+x]=0;
      }else{
        // Short bob tip crosses the neck immediately above the helmet rim.
        for(let y=321;y<=333;y++)for(let x=218;x<=234;x++){
          const p=y*512+x,i=p*4,[h,s]=rgbToHsl(...source.subarray(i,i+3));
          if(h>35.5&&h<60&&s>.3&&source[i+2]<115)material[p]=0;
        }
      }
      if(region)regions[region]=exactContour(material);
    }
  }
  regions[0]=exactContour(mask);return regions;
}
const jawStarts=[280,275,252,262,263,262,273,274,270,275,255,270,285,252,260,263];
function refinedJaw(source,polygon,startY,neck){
  const face=raster(polygon);
  const kept=Uint8Array.from(face),handledRows=new Uint8Array(512),bright=p=>source[p*4]>=225&&source[p*4+1]>=150&&source[p*4+2]>=105;
  const light=p=>(Math.max(...source.subarray(p*4,p*4+3))+Math.min(...source.subarray(p*4,p*4+3)))/510;
  const valley=points=>{let chosen=points[0],value=light(chosen);for(const p of points.slice(1)){const l=light(p);if(l<value){value=l;chosen=p;}}return chosen;};
  for(let y=startY;y<350;y++){
    const points=[];for(let x=130;x<420;x++)if(face[y*512+x]&&bright(y*512+x))points.push(x);
    if(!points.length)continue;handledRows[y]=1;const left=points[0],right=points.at(-1);
    const l=valley(Array.from({length:7},(_,k)=>y*512+left-k))%512,r=valley(Array.from({length:7},(_,k)=>y*512+right+k))%512;
    for(let x=130;x<420;x++)if(x<l||x>r)kept[y*512+x]=0;
  }
  for(let x=130;x<420;x++){
    const points=[];for(let y=startY;y<350;y++)if(face[y*512+x]&&bright(y*512+x))points.push(y);
    if(!points.length)continue;const bottom=points.at(-1),end=Math.floor(valley(Array.from({length:7},(_,k)=>(bottom+k)*512+x))/512);
    for(let y=end+1;y<350;y++)if(!handledRows[y])kept[y*512+x]=0;
  }
  // The legacy face includes the true shaded upper neck above the coarse
  // neck polygon. Keep that anatomy between the measured vertical sides.
  const top=neck.slice(0,3),left=Math.min(...top.map(v=>v[0])),right=Math.max(...top.map(v=>v[0])),y0=Math.min(...top.map(v=>v[1]))-12;
  for(let y=y0;y<350;y++)for(let x=left;x<=right;x++)if(face[y*512+x])kept[y*512+x]=1;
  return contours(kept)[0]||polygon;
}
const result={},report=[];
for(let n=32;n<48;n++){
  const original=SKIN_REGIONS_B[n-24],d=await sharp(`public/pfp/v1/character-${n}.png`).ensureAlpha().raw().toBuffer(),hsl=Array.from({length:512*512},(_,i)=>rgbToHsl(...d.subarray(i*4,i*4+3)));
  const fixed=[original[0]]; let removed=0,added=0;
  if(n===42||n===43){
    // The old right-jaw polygon enclosed a 2–4px strip of shaded hair.
    // Trace the original dark chin stroke column by column; keep its dark
    // antialiasing while excluding the brighter golden pixels beneath it.
    const face=new Uint8Array(512*512);for(let y=0;y<512;y++)for(let x=0;x<512;x++)face[y*512+x]=inside(x+.5,y+.5,original[0])?1:0;
    const jaw=n===42?[[282,294],[291,294],[300,290],[311,287],[320,283],[331,279],[342,273],[350,263],[355,254],[359,242]]:[[279,305],[287,303],[297,297],[307,294],[317,288],[327,283],[337,276],[344,268],[348,259],[351,249],[354,238]];
    for(let x=jaw[0][0]+1;x<=jaw.at(-1)[0];x++){
      let bottom=-1;for(let y=240;y<330;y++)if(face[y*512+x])bottom=y;
      if(bottom<250)continue;
      const k=jaw.findIndex(([a])=>a>=x),a=jaw[Math.max(0,k-1)],b=jaw[k];
      const expected=a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);
      const lum=y=>{const i=(y*512+x)*4;return .3*d[i]+.6*d[i+1]+.1*d[i+2];};
      let edge=bottom,lowest=Infinity;for(let y=Math.floor(expected)-3;y<=Math.ceil(expected)+2;y++){const v=lum(y);if(v<lowest){lowest=v;edge=y;}}
      while(edge<bottom&&edge<expected+2&&lum(edge+1)<lowest+14)edge++;
      for(let y=edge+1;y<=bottom;y++)face[y*512+x]=0;
    }
    const cheek=n===42?[[230,367],[235,364],[240,360],[245,357],[250,355],[255,354],[260,351],[265,348],[270,343],[275,338],[280,329],[285,316],[290,301],[294,284]]:[[238,354],[245,352],[250,351],[255,350],[260,348],[265,346],[270,343],[275,338],[280,332],[285,323],[290,314],[295,302],[300,292],[305,279]];
    for(let y=cheek[0][0];y<=cheek.at(-1)[0];y++){
      const k=cheek.findIndex(([a])=>a>=y),a=cheek[Math.max(0,k-1)],b=cheek[k];
      const expected=k===0?a[1]:a[1]+(b[1]-a[1])*(y-a[0])/(b[0]-a[0]);
      const lum=x=>{const i=(y*512+x)*4;return .3*d[i]+.6*d[i+1]+.1*d[i+2];};
      let edge=Math.round(expected),lowest=Infinity;for(let x=Math.floor(expected)-2;x<=Math.ceil(expected)+2;x++){const v=lum(x);if(v<lowest){lowest=v;edge=x;}}
      while(edge<expected+2&&lum(edge+1)<lowest+14)edge++;
      for(let x=edge+1;x<400;x++)face[y*512+x]=0;
    }
    fixed[0]=contours(face)[0];
  }
  fixed[0]=refinedJaw(d,fixed[0],jawStarts[n-32],original[1]);
  if(n===33){
    // Right cheek: the old mask reached several pixels beyond the face ink
    // into the shaded front curl, including above the lower-jaw audit rows.
    const face=raster(fixed[0]),edge=[[230,394],[235,392],[240,391],[245,389],[250,388],[255,386],[260,384],[265,383],[270,382],[275,380]];
    for(let y=230;y<=275;y++){
      const k=edge.findIndex(([a])=>a>=y),a=edge[Math.max(0,k-1)],b=edge[k],x=k?Math.round(a[1]+(b[1]-a[1])*(y-a[0])/(b[0]-a[0])):a[1];
      for(let column=x+1;column<415;column++)face[y*512+column]=0;
    }fixed[0]=contours(face)[0];
  }
  for(const p of original.slice(1)){
    const mask=new Uint8Array(512*512),gold=new Uint8Array(mask.length),visited=new Uint8Array(mask.length),erase=new Uint8Array(mask.length);
    for(let y=0;y<512;y++)for(let x=0;x<512;x++){const i=y*512+x;mask[i]=inside(x+.5,y+.5,p)?1:0;const[h,s,l]=hsl[i];if(d[i*4+3]&&h>36.5&&h<70&&s>.30&&l>.18&&l<.95)gold[i]=1;}
    for(let i=0;i<gold.length;i++)if(gold[i]&&!visited[i]){const q=[i];visited[i]=1;let external=0;for(let at=0;at<q.length;at++){const k=q[at];if(!mask[k])external++;for(const j of[k-1,k+1,k-512,k+512])if(gold[j]&&!visited[j]){visited[j]=1;q.push(j);}}if(external>=30)for(const k of q)if(mask[k])erase[k]=1;}
    // Include just the immediate amber antialiasing beside a connected gold curl.
    const fringe=Uint8Array.from(erase);for(let i=0;i<erase.length;i++)if(erase[i])for(const j of[i-1,i+1,i-512,i+512])if(mask[j]&&!erase[j]){const[h,s,l]=hsl[j];if(h>34.8&&h<70&&s>.30&&l>.18&&l<.95)fringe[j]=1;}
    for(let i=0;i<mask.length;i++)if(fringe[i]){mask[i]=0;removed++;}
    // Grow the measured skin region only into adjacent peach antialiasing.
    // Never cross the removed golden curl or jump through violet cloth.
    for(let pass=0;pass<2;pass++){const next=Uint8Array.from(mask);for(let i=512;i<mask.length-512;i++)if(!mask[i]&&!fringe[i]&&(mask[i-1]||mask[i+1]||mask[i-512]||mask[i+512])){const[h,s,l]=hsl[i];if(d[i*4+3]>220&&h>12&&h<33&&s>.15&&l>.15&&l<.85){next[i]=1;added++;}}mask.set(next);}
    const minY=Math.min(...p.map(v=>v[1])),maxY=Math.max(...p.map(v=>v[1]));
    if(maxY-minY>45||minY>430)for(let pass=0;pass<8;pass++){
      const next=Uint8Array.from(mask);for(let y=Math.floor(minY+(maxY-minY)*.45);y<Math.min(512,maxY+9);y++)for(let x=100;x<490;x++){
        const i=y*512+x;if(mask[i]||fringe[i]||!(mask[i-1]||mask[i+1]||mask[i-512]||mask[i+512]))continue;
        const[h,s,l]=hsl[i];if(d[i*4+3]>220&&(h<80||h>345)&&s>.08&&l>.68){next[i]=1;added++;}
      }mask.set(next);
    }
    if(n===36&&p===original[1])for(let pass=0;pass<2;pass++){
      const next=Uint8Array.from(mask);for(let y=350;y<395;y++)for(let x=264;x<355;x++){const i=y*512+x;if(mask[i]||!(mask[i-1]||mask[i+1]||mask[i-512]||mask[i+512]))continue;const[h,s,l]=hsl[i];if(d[i*4+3]>220&&h>10&&h<65&&s>.15&&l>.2){next[i]=1;added++;}}mask.set(next);
    }
    if(n===46&&p===original[1])for(let pass=0;pass<8;pass++){
      // The right shoulder is gold-lit skin, outside the old polygon.
      const next=Uint8Array.from(mask);for(let y=315;y<349;y++)for(let x=307;x<342;x++){const i=y*512+x;if(mask[i]||!(mask[i-1]||mask[i+1]||mask[i-512]||mask[i+512]))continue;const[h,s,l]=hsl[i];if(d[i*4+3]>220&&h>10&&h<65&&s>.15&&l>.2){next[i]=1;added++;}}mask.set(next);
    }
    if(n===42&&p===original[1]){
      // This short curl crosses over the left neck; its orange shaded tip
      // shares the skin's hue, so trace the actual strand rather than key it.
      const curl=[[229,285],[232,288],[234,290],[237,293],[239,296],[239,301],[238,307],[236,312],[234,317],[232,321],[229,323],[228,321],[230,317],[231,312],[231,308],[230,304],[227,302],[225,299],[224,295],[226,291]];
      for(let y=285;y<=323;y++)for(let x=223;x<=240;x++)if(inside(x+.5,y+.5,curl))mask[y*512+x]=0;
    }
    const loops=contours(mask);fixed.push(loops[0]||p);
  }
  const neckRims={34:[287,298,310],35:[293,305,304],40:[306,326,292],41:[295,328,315]};
  if(neckRims[n]||n===43)for(let region=0;region<Math.min(2,fixed.length);region++){
    const mask=raster(fixed[region]);
    if(neckRims[n]){
      const[y0,y1,expected]=neckRims[n];
      for(let y=y0;y<=y1;y++){
        const lum=x=>{const i=(y*512+x)*4;return .3*d[i]+.6*d[i+1]+.1*d[i+2];};let edge=expected,lowest=Infinity;
        for(let x=expected-3;x<=expected+3;x++){const value=lum(x);if(value<lowest){lowest=value;edge=x;}}
        while(edge<expected+4&&lum(edge+1)<lowest+16)edge++;
        for(let x=edge+1;x<expected+9;x++)mask[y*512+x]=0;
      }
    }
    if(n===43)for(let y=285;y<=295;y++)for(let x=218;x<=233;x++){
      // Short highlighted lock crossing the left upper-neck shadow.
      const i=y*512+x,[h,s,l]=hsl[i];if(h>30.8&&s>.25&&l>.3)mask[i]=0;
    }
    fixed[region]=contours(mask)[0]||fixed[region];
  }
  const full=refineFullFaceC(d,raster(fixed[0]),n);fixed[0]=exactContour(full.mask);
  result[n]=reviewedFaceEdges(d,fixed,n).map((p,index)=>{
    let mask=refineCheekC(n,d,raster(p),index);
    if(index===0){mask=refineForeheadC(n,d,mask);mask=refineRightWedgeC(n,d,mask);}
    return exactContour(mask);
  });
  report.push({character:n,removed,added,temple:full.profile,fringe:full.fringe,fringeBox:full.box});
}
await fs.writeFile('src/pfp/skin-corrections-c.js',`// Pixel contours for faces, necks, ears and arms, reviewed against each source sprite.\n// Preserve dark jaw ink and skin highlights while excluding overlapping hair.\nexport const SKIN_CORRECTIONS_C = ${JSON.stringify(result)};\n`);
await fs.writeFile(`${out}/correction-metrics.json`,JSON.stringify(report,null,2));
console.log(report.map(({character,removed,added,fringe})=>({character,removed,added,fringe:fringe.length})));
