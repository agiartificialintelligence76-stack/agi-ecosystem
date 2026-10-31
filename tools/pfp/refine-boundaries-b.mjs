import fs from 'node:fs/promises';
import sharp from 'sharp';
import { SKIN_REGIONS_A } from '../../src/pfp/skin-regions-a.js';
import { SKIN_REGIONS_B } from '../../src/pfp/skin-regions-b.js';
import { rgbToHsl } from '../../src/pfp/engine.js';
const SKIN_REGIONS=[...SKIN_REGIONS_A,...SKIN_REGIONS_B];
const W=512,N=W*W;
function fill(poly){const m=new Uint8Array(N);for(let y=0;y<W;y++){const xs=[];for(let i=0,j=poly.length-1;i<poly.length;j=i++){const[a,b]=poly[i],[c,d]=poly[j];if((b>y+.5)!=(d>y+.5))xs.push(a+(y+.5-b)*(c-a)/(d-b));}xs.sort((a,b)=>a-b);for(let k=0;k+1<xs.length;k+=2)m.fill(1,y*W+Math.max(0,Math.ceil(xs[k]-.5)),y*W+Math.min(W,Math.ceil(xs[k+1]-.5)));}return m;}
function dilate(m,n){let a=m;for(let k=0;k<n;k++){const b=Uint8Array.from(a);for(let i=W+1;i<N-W-1;i++)if(a[i])for(const j of[i-1,i+1,i-W,i+W])b[j]=1;a=b;}return a;}
function contours(mask){const edges=new Map();function add(a,b){const k=a.join(',');if(!edges.has(k))edges.set(k,[]);edges.get(k).push(b);}for(let y=0;y<W;y++)for(let x=0;x<W;x++){const i=y*W+x;if(!mask[i])continue;if(y===0||!mask[i-W])add([x,y],[x+1,y]);if(x===W-1||!mask[i+1])add([x+1,y],[x+1,y+1]);if(y===W-1||!mask[i+W])add([x+1,y+1],[x,y+1]);if(x===0||!mask[i-1])add([x,y+1],[x,y]);}const loops=[];while(edges.size){let cur=edges.keys().next().value.split(',').map(Number);const start=cur,loop=[cur];for(let k=0;k<N;k++){const key=cur.join(','),n=edges.get(key)?.pop();if(!n)break;if(!edges.get(key).length)edges.delete(key);if(n[0]===start[0]&&n[1]===start[1])break;loop.push(n);cur=n;}if(loop.length>2){const clean=loop.filter((p,i)=>{const a=loop[(i+loop.length-1)%loop.length],b=loop[(i+1)%loop.length];return !((a[0]===p[0]&&p[0]===b[0])||(a[1]===p[1]&&p[1]===b[1]));});loops.push(clean);}}loops.sort((a,b)=>area(b)-area(a));return loops;}
function area(p){return Math.abs(p.reduce((s,[x,y],i)=>{const[a,b]=p[(i+1)%p.length];return s+x*b-a*y;},0));}
const corrections={},log=[];
for(let c=16;c<32;c++){
 const d=await sharp(`public/pfp/v1/character-${c}.png`).ensureAlpha().raw().toBuffer();
 const hsl=Array.from({length:N},(_,i)=>rgbToHsl(...d.subarray(i*4,i*4+3)));
 const anatomy=SKIN_REGIONS[c],out=[];
 for(let r=0;r<anatomy.length;r++){
  const old=fill(anatomy[r]);let mask=Uint8Array.from(old);
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
