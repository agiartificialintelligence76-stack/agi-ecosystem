import fs from 'node:fs/promises';
import sharp from 'sharp';
import {SKIN_REGIONS_B} from '../../src/pfp/skin-regions-b.js';
import {rgbToHsl} from '../../src/pfp/engine.js';
const out='output/pfp-boundary-fix/c'; await fs.mkdir(out,{recursive:true});
const inside=(x,y,p)=>{let r=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const[a,b]=p[i],[c,d]=p[j];if((b>y)!=(d>y)&&x<(c-a)*(y-b)/(d-b)+a)r=!r;}return r;};
function contours(mask){
  const edges=new Map();const add=(a,b)=>{const k=a.join(',');(edges.get(k)||edges.set(k,[]).get(k)).push(b);};
  for(let y=0;y<512;y++)for(let x=0;x<512;x++) {const i=y*512+x;if(!mask[i])continue;if(y===0||!mask[i-512])add([x,y],[x+1,y]);if(x===511||!mask[i+1])add([x+1,y],[x+1,y+1]);if(y===511||!mask[i+512])add([x+1,y+1],[x,y+1]);if(x===0||!mask[i-1])add([x,y+1],[x,y]);}
  const loops=[];while(edges.size){const start=edges.keys().next().value.split(',').map(Number),loop=[start];let current=start;for(let c=0;c<20000;c++){const k=current.join(',');const next=edges.get(k)?.pop();if(!next)break;if(!edges.get(k).length)edges.delete(k);if(next[0]===start[0]&&next[1]===start[1])break;loop.push(next);current=next;}if(loop.length>2){const reduced=loop.filter((p,i)=>{const a=loop[(i+loop.length-1)%loop.length],b=loop[(i+1)%loop.length];return(a[0]-p[0])*(b[1]-p[1])!==(a[1]-p[1])*(b[0]-p[0]);});loops.push(reduced);}}
  return loops.sort((a,b)=>area(b)-area(a));
}
function area(p){return Math.abs(p.reduce((s,[x,y],i)=>{const[a,b]=p[(i+1)%p.length];return s+x*b-a*y;},0));}
const result={},report=[];
for(let n=32;n<48;n++){
  const original=SKIN_REGIONS_B[n-24],d=await sharp(`public/pfp/v1/character-${n}.png`).ensureAlpha().raw().toBuffer(),hsl=Array.from({length:512*512},(_,i)=>rgbToHsl(...d.subarray(i*4,i*4+3)));
  const fixed=[original[0]]; let removed=0,added=0;
  if(n===42){
    // The old right-jaw polygon enclosed a 2–4px strip of shaded hair.
    // Trace the original dark chin stroke column by column; keep its dark
    // antialiasing while excluding the brighter golden pixels beneath it.
    const face=new Uint8Array(512*512);for(let y=0;y<512;y++)for(let x=0;x<512;x++)face[y*512+x]=inside(x+.5,y+.5,original[0])?1:0;
    const jaw=[[282,294],[291,294],[300,290],[311,287],[320,283],[331,279],[342,273],[350,263],[355,254],[359,242]];
    for(let x=283;x<=359;x++){
      let bottom=-1;for(let y=240;y<330;y++)if(face[y*512+x])bottom=y;
      if(bottom<250)continue;
      const k=jaw.findIndex(([a])=>a>=x),a=jaw[Math.max(0,k-1)],b=jaw[k];
      const expected=a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);
      const lum=y=>{const i=(y*512+x)*4;return .3*d[i]+.6*d[i+1]+.1*d[i+2];};
      let edge=bottom,lowest=Infinity;for(let y=Math.floor(expected)-3;y<=Math.ceil(expected)+2;y++){const v=lum(y);if(v<lowest){lowest=v;edge=y;}}
      while(edge<bottom&&edge<expected+2&&lum(edge+1)<lowest+14)edge++;
      for(let y=edge+1;y<=bottom;y++)face[y*512+x]=0;
    }
    const cheek=[[230,367],[235,364],[240,360],[245,357],[250,355],[255,354],[260,351],[265,348],[270,343],[275,338],[280,329],[285,316],[290,301],[294,284]];
    for(let y=230;y<=294;y++){
      const k=cheek.findIndex(([a])=>a>=y),a=cheek[Math.max(0,k-1)],b=cheek[k];
      const expected=k===0?a[1]:a[1]+(b[1]-a[1])*(y-a[0])/(b[0]-a[0]);
      const lum=x=>{const i=(y*512+x)*4;return .3*d[i]+.6*d[i+1]+.1*d[i+2];};
      let edge=Math.round(expected),lowest=Infinity;for(let x=Math.floor(expected)-2;x<=Math.ceil(expected)+2;x++){const v=lum(x);if(v<lowest){lowest=v;edge=x;}}
      while(edge<expected+2&&lum(edge+1)<lowest+14)edge++;
      for(let x=edge+1;x<400;x++)face[y*512+x]=0;
    }
    fixed[0]=contours(face)[0];
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
    if(n===36&&p===original[1])for(let pass=0;pass<2;pass++){
      const next=Uint8Array.from(mask);for(let y=350;y<395;y++)for(let x=264;x<355;x++){const i=y*512+x;if(mask[i]||!(mask[i-1]||mask[i+1]||mask[i-512]||mask[i+512]))continue;const[h,s,l]=hsl[i];if(d[i*4+3]>220&&h>10&&h<65&&s>.15&&l>.2){next[i]=1;added++;}}mask.set(next);
    }
    const loops=contours(mask);fixed.push(loops[0]||p);
  }
  result[n]=fixed;report.push({character:n,removed,added});
}
await fs.writeFile('src/pfp/skin-corrections-c.js',`// Pixel contours for necks, ears and arms, reviewed against each original sprite.\n// Gold curls overlapping the older broad anatomy polygons are excluded.\nexport const SKIN_CORRECTIONS_C = ${JSON.stringify(result)};\n`);
await fs.writeFile(`${out}/correction-metrics.json`,JSON.stringify(report,null,2));console.log(report);
