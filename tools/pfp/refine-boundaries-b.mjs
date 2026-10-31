import fs from 'node:fs/promises';
import sharp from 'sharp';
import { SKIN_REGIONS_A } from '../../src/pfp/skin-regions-a.js';
import { SKIN_REGIONS_B } from '../../src/pfp/skin-regions-b.js';
import { rgbToHsl } from '../../src/pfp/engine.js';
import { refineFullFace } from './refine-full-boundaries-b.mjs';
import { restoreRightForeheadB } from './right-forehead-restorations-b.mjs';
const SKIN_REGIONS=[...SKIN_REGIONS_A,...SKIN_REGIONS_B];
const W=512,N=W*W;
await fs.mkdir('output/pfp-boundary-fix/b', {recursive:true});
function fill(poly){const m=new Uint8Array(N);for(let y=0;y<W;y++){const xs=[];for(let i=0,j=poly.length-1;i<poly.length;j=i++){const[a,b]=poly[i],[c,d]=poly[j];if((b>y+.5)!=(d>y+.5))xs.push(a+(y+.5-b)*(c-a)/(d-b));}xs.sort((a,b)=>a-b);for(let k=0;k+1<xs.length;k+=2)m.fill(1,y*W+Math.max(0,Math.ceil(xs[k]-.5)),y*W+Math.min(W,Math.ceil(xs[k+1]-.5)));}return m;}
function dilate(m,n){let a=m;for(let k=0;k<n;k++){const b=Uint8Array.from(a);for(let i=W+1;i<N-W-1;i++)if(a[i])for(const j of[i-1,i+1,i-W,i+W])b[j]=1;a=b;}return a;}
function contours(mask){const edges=new Map();function add(a,b){const k=a.join(',');if(!edges.has(k))edges.set(k,[]);edges.get(k).push(b);}for(let y=0;y<W;y++)for(let x=0;x<W;x++){const i=y*W+x;if(!mask[i])continue;if(y===0||!mask[i-W])add([x,y],[x+1,y]);if(x===W-1||!mask[i+1])add([x+1,y],[x+1,y+1]);if(y===W-1||!mask[i+W])add([x+1,y+1],[x,y+1]);if(x===0||!mask[i-1])add([x,y+1],[x,y]);}const loops=[];while(edges.size){let cur=edges.keys().next().value.split(',').map(Number);const start=cur,loop=[cur];for(let k=0;k<N;k++){const key=cur.join(','),n=edges.get(key)?.pop();if(!n)break;if(!edges.get(key).length)edges.delete(key);if(n[0]===start[0]&&n[1]===start[1])break;loop.push(n);cur=n;}if(loop.length>2){const clean=loop.filter((p,i)=>{const a=loop[(i+loop.length-1)%loop.length],b=loop[(i+1)%loop.length];return !((a[0]===p[0]&&p[0]===b[0])||(a[1]===p[1]&&p[1]===b[1]));});loops.push(clean);}}loops.sort((a,b)=>area(b)-area(a));return loops;}
function area(p){return Math.abs(p.reduce((s,[x,y],i)=>{const[a,b]=p[(i+1)%p.length];return s+x*b-a*y;},0));}
function exactContour(mask){
 const loops=contours(mask);let polygon=loops.shift();
 for(const loop of loops){let a=0,b=0,distance=Infinity;for(let i=0;i<polygon.length;i++)for(let j=0;j<loop.length;j++){const d=(polygon[i][0]-loop[j][0])**2+(polygon[i][1]-loop[j][1])**2;if(d<distance){distance=d;a=i;b=j;}}const rotated=[...loop.slice(b),...loop.slice(0,b)];polygon=[...polygon.slice(0,a+1),...rotated,rotated[0],polygon[a],...polygon.slice(a+1)];}
 const actual=fill(polygon),bad=actual.findIndex((v,p)=>v!==mask[p]);if(bad>=0)throw Error(`Contour differs at ${bad%W},${Math.floor(bad/W)}`);return polygon;
}
// The jaw ink, not a skin hue cutoff, is the boundary of the face. These
// start rows are individually below each look's lower eye edge.
const jawStarts=[238,262,272,257,260,274,260,273,260,254,258,242,239,249,264,274];
const rightJawStarts=[219,243,251,230,241,258,243,258,246,238,241,227,226,238,253,256];
function refineJaw(source,face,character,anatomy){
 const kept=Uint8Array.from(face),handledRows=new Uint8Array(W),startY=jawStarts[character-16];
 const bright=p=>source[p*4]>=225&&source[p*4+1]>=150&&source[p*4+2]>=105;
 const light=p=>(Math.max(...source.subarray(p*4,p*4+3))+Math.min(...source.subarray(p*4,p*4+3)))/510;
 const valley=points=>points.reduce((best,p)=>light(p)<light(best)?p:best,points[0]);
 for(let y=rightJawStarts[character-16];y<340;y++){
  const points=[];for(let x=130;x<420;x++)if(face[y*W+x]&&bright(y*W+x))points.push(x);
  if(!points.length)continue;handledRows[y]=1;
  let left=y>=startY?valley(Array.from({length:7},(_,k)=>y*W+points[0]-k))%W:face.subarray(y*W,(y+1)*W).indexOf(1);
  // This softly shaded cheek row has no dark ink. Its measured transition
  // lies eight pixels left of the first pale face highlight.
  if(character===23&&y===283)left=239;
  const right=valley(Array.from({length:7},(_,k)=>y*W+points.at(-1)+k))%W;
  for(let x=130;x<420;x++)kept[y*W+x]=Number(x>=left&&x<=right);
 }
 for(let x=130;x<420;x++){
  const points=[];for(let y=startY;y<340;y++)if(face[y*W+x]&&bright(y*W+x))points.push(y);
  if(!points.length)continue;
  const end=Math.floor(valley(Array.from({length:7},(_,k)=>(points.at(-1)+k)*W+x))/W);
  for(let y=end+1;y<340;y++)if(!handledRows[y])kept[y*W+x]=0;
 }
 // The face region also protects upper-neck shadow above the neck polygon's
 // diagonal top edge. Keep it between the measured vertical neck sides.
 const neck=anatomy[[18,20,21,23].includes(character)?2:1];
 const top=neck.slice(0,3),left=Math.min(...top.map(p=>p[0])),right=Math.max(...top.map(p=>p[0])),y0=Math.min(...top.map(p=>p[1]))-12;
 for(let y=y0;y<340;y++)for(let x=left;x<=right;x++)if(face[y*W+x])kept[y*W+x]=1;
 const neckMask=fill(neck);
 for(let x=left;x<=right;x++){
  let faceBottom=-1,neckTop=-1;for(let y=y0;y<340;y++){if(face[y*W+x])faceBottom=y;if(neckTop<0&&neckMask[y*W+x])neckTop=y;}
  if(faceBottom>=0&&neckTop>faceBottom&&neckTop-faceBottom<20)for(let y=faceBottom+1;y<=neckTop;y++)kept[y*W+x]=1;
 }
 // Two missing ear-shadow pixels and the adjacent lobe highlight lie just
 // outside Flutter's original straight ear triangle.
 if(character===26)for(const[x,y]of[[207,268],[207,269],[209,278],[210,278]])kept[y*W+x]=1;
 return kept;
}
const corrections={},log=[];
for(let c=16;c<32;c++){
 const d=await sharp(`public/pfp/v1/character-${c}.png`).ensureAlpha().raw().toBuffer();
 const hsl=Array.from({length:N},(_,i)=>rgbToHsl(...d.subarray(i*4,i*4+3)));
 const anatomy=SKIN_REGIONS[c],out=[];
 for(let r=0;r<anatomy.length;r++){
  const old=fill(anatomy[r]);let mask=Uint8Array.from(old);
  if(r===0){mask=refineJaw(d,old,c,anatomy);const full=refineFullFace(d,mask,c);mask=restoreRightForeheadB(d,full.mask,c);out.push(exactContour(mask));log.push({character:c,region:r,before:old.reduce((a,b)=>a+b,0),after:mask.reduce((a,b)=>a+b,0),note:'Measured jaw and temple ink boundary',temple:full.profile,fringe:full.fringe});continue;}
  // Below Warm Front's scarf the narrow golden-lit strip is skin, not hair.
  // There is no hair in this region; include its blended seam pixels too.
  if(c===28&&r===2){mask=dilate(old,3);out.push(contours(mask)[0]);log.push({character:c,region:r,before:old.reduce((a,b)=>a+b,0),after:mask.reduce((a,b)=>a+b,0),note:'Scarf skin strip; no hair overlaps'});continue;}
  {
   const hair=new Uint8Array(N),visited=new Uint8Array(N);
   const eyeBottom=[218,242,250,229,240,257,242,257,245,237,240,226,225,237,252,255][c-16];
   const ear=r>0&&Math.max(...anatomy[r].map(p=>p[1]))<310;
   const depth=new Uint8Array(N); let eroded=Uint8Array.from(old);
   for(let level=1;level<=6;level++){const next=new Uint8Array(N);for(let i=W+1;i<N-W-1;i++)if(eroded[i]){depth[i]=level;if(eroded[i-1]&&eroded[i+1]&&eroded[i-W]&&eroded[i+W])next[i]=1;}eroded=next;}
   const gold=new Uint8Array(N);for(let i=0;i<N;i++){const[h,s,l]=hsl[i];if(!old[i]&&h>=37&&h<65&&s>.4&&l>.25&&d[i*4+3]>20)gold[i]=1;}
   const nearGold=dilate(gold,12);
   for(let i=0;i<N;i++){const[h,s,l]=hsl[i],y=Math.floor(i/W);if(r===0&&(c===31||y<=eyeBottom||depth[i]>4))continue;if(h<75&&s>.25&&l>.10&&l<.94&&d[i*4+3]>20&&(h>=(ear?37:36.5)||(!ear&&(!r||nearGold[i])&&y>eyeBottom&&h>=30&&l<.65&&d[i*4+2]<95)))hair[i]=1;}
   for(let i=0;i<N;i++)if(hair[i]&&!visited[i]){const q=[i];visited[i]=1;let outside=false;for(let p=0;p<q.length;p++){const k=q[p];if(!old[k])outside=true;for(const j of[k-1,k+1,k-W,k+W])if(hair[j]&&!visited[j]){visited[j]=1;q.push(j);}}if(outside)for(const k of q)mask[k]=0;}
   if(r&&!ear){const reach=dilate(old,3),bottom=Math.max(...anatomy[r].map(p=>p[1]));for(let i=0;i<N;i++){const[h,s,l]=hsl[i];if(reach[i]&&!mask[i]&&Math.floor(i/W)>bottom-25&&h>0&&h<35.4&&d[i*4+2]>95&&d[i*4]>185&&d[i*4+3]>120)mask[i]=1;}}
   // Warm collar lighting is real skin in these hair-free central regions.
   // It must not be mistaken for a gold hair strand merely by its hue.
   const collarWindows={16:[240,365,326,384],21:[250,378,308,397],26:[265,370,337,392]};
   if(r&&!ear&&collarWindows[c]){const [x0,y0,x1,y1]=collarWindows[c],reach=dilate(old,2);for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(reach[y*W+x])mask[y*W+x]=1;}
  }
  if([25,27].includes(c)&&r>0&&Math.max(...anatomy[r].map(p=>p[1]))<310){
   const [x0,x1,y0,y1]=c===25?[164,182,247,284]:[169,182,216,252];
   const light=(x,y)=>{const o=(y*W+x)*4;return Math.max(d[o],d[o+1],d[o+2])+Math.min(d[o],d[o+1],d[o+2]);};
   for(let x=x0;x<=x1;x++){
    let last=-1;for(let y=y0;y<=y1;y++){const p=y*W+x,o=p*4;if(mask[p]&&d[o]>=210&&d[o+1]>=140&&d[o+2]>=75&&hsl[p][0]<35.5)last=y;}
    if(last<0)continue;let end=last,best=Infinity;
    for(let y=last;y<=last+6;y++){const v=light(x,y);if(v<best){best=v;end=y;}}
    for(let k=0;k<2&&light(x,end+1)<best+50;k++)end++;
    for(let y=last;y<=end;y++)mask[y*W+x]=1;
    for(let y=end+1;y<=y1;y++)mask[y*W+x]=0;
   }
  }
  if(c===31&&Math.max(...anatomy[r].map(p=>p[1]))<310){
   for(let x=168;x<198;x++){
    let last=-1;for(let y=260;y<302;y++){const o=(y*W+x)*4;if(mask[y*W+x]&&d[o]>=210&&d[o+1]>=145&&d[o+2]>=85)last=y;}
    if(last<0)continue;let end=last,best=Infinity;
    for(let y=last;y<=last+6;y++){const o=(y*W+x)*4,v=Math.max(d[o],d[o+1],d[o+2])+Math.min(d[o],d[o+1],d[o+2]);if(v<best){best=v;end=y;}}
    for(let y=end+1;y<310;y++)mask[y*W+x]=0;
   }
  }
  const loops=contours(mask);
  if(!loops.length)throw Error(`Empty region ${c}/${r}`);
  out.push(loops[0]);
  if(r)out.push(...loops.slice(1).filter(p=>area(p)>16));
  log.push({character:c,region:r,before:old.reduce((a,b)=>a+b,0),after:mask.reduce((a,b)=>a+b,0)});
 }
 corrections[c]=out;
}
await fs.writeFile('src/pfp/skin-corrections-b.js','// Pixel-aligned anatomical boundaries, measured against the original sprites.\n// These keep gold hair tips out of skin protection and include real neck edges.\nexport const SKIN_CORRECTIONS_B = {\n'+Object.entries(corrections).map(([c,regions])=>`  ${c}: ${JSON.stringify(regions)},`).join('\n')+'\n};\n');
await fs.writeFile('output/pfp-boundary-fix/b/refinement.json',JSON.stringify(log,null,2));
