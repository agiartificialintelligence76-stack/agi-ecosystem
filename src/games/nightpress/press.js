import {DECALS,ruleLabels} from './issues.js';

export function bits(mask){mask>>>=0;mask-=((mask>>>1)&0x55555555);mask=(mask&0x33333333)+((mask>>>2)&0x33333333);return (((mask+(mask>>>4))&0x0f0f0f0f)*0x01010101)>>>24;}
export function rotCells(id,turn=0){
 const d=DECALS[id],rows=d.rows;let w=rows[0].length,h=rows.length;
 let points=rows.flatMap((row,y)=>[...row].flatMap((ch,x)=>ch==='.'?[]:[{x,y,ch}]));
 for(let i=0;i<(turn+4)%4;i++){points=points.map(({x,y,ch})=>({x:h-y-1,y:x,ch}));[w,h]=[h,w];}
 return {w,h,points};
}
export function geometry(issue,placement){
 if(!placement||!issue.pieces.includes(placement.id)||![0,1,2,3].includes(placement.turn)||!Number.isInteger(placement.x)||!Number.isInteger(placement.y))return null;
 const {id,turn,x,y}=placement,d=DECALS[id],shape=rotCells(id,turn);let mask=0,eyes=0,hole=0,cut=0,count=0;
 for(const v of shape.points){
  const px=x+v.x,py=y+v.y,inside=px>=0&&py>=0&&px<issue.w&&py<issue.h;
  if(v.ch==='O'){if(inside)hole|=1<<(py*issue.w+px);continue;}
  count++;if(!inside){cut++;continue;}const bit=1<<(py*issue.w+px);mask|=bit;if(v.ch==='E')eyes|=bit;
 }
 if(!mask||cut>Math.floor(count/2)||x< -1||y< -1||x+shape.w>issue.w+1||y+shape.h>issue.h+1)return null;
 const {w,h}=issue;let sides=0,corners=0;
 for(let py=0;py<h;py++)for(let px=0;px<w;px++)if(mask&(1<<(py*w+px)))for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){
  const xx=px+dx,yy=py+dy;if(xx<0||xx>=w||yy<0||yy>=h)continue;const b=1<<(yy*w+xx);if(dx&&dy)corners|=b;else sides|=b;
 }
 return {id,x,y,turn,mask,eyes,hole,cut,sides,corners,film:!!d.film,foil:!!d.foil,face:d.rows.some(r=>r.includes('E'))};
}
export const placementOf=g=>({id:g.id,x:g.x,y:g.y,turn:g.turn});
export function boardMasks(issue){
 let head=0,bottom=0,gutter=0;for(const x of issue.head)head|=1<<x;
 for(let x=0;x<issue.w;x++)bottom|=1<<((issue.h-1)*issue.w+x);
 for(let y=0;y<issue.h;y++)gutter|=1<<(y*issue.w+Math.floor(issue.w/2));
 return {head,bottom,gutter};
}
export function analysis(issue,layers){
 const masks=boardMasks(issue),occupied=layers.reduce((m,p)=>m|p.mask,0),paper=layers.reduce((m,p)=>m|(p.film?0:p.mask),0);
 const back=layers.find(p=>p.id===issue.pieces[0]),second=layers.find(p=>p.id===issue.pieces[1]);
 let over=0,clipped=false,visibleEyes=0,faceEyes=0,window=false,eyeWindow=false,film=false,collision=false,corner=false,overlap=false,front=null;
 for(let j=layers.length-1;j>=0;j--){
  const p=layers[j];if(!front)front=p;clipped||=p.cut>0;
  if(p.face){faceEyes+=2;visibleEyes+=bits(p.eyes&~over);}
  let below=0,eyes=0;
  for(let k=0;k<j;k++){const q=layers[k];if(!q.film)eyes&=~q.mask;eyes|=q.eyes;below|=q.mask;
   overlap||=!!(q.mask&p.mask);collision||=!!((q.mask|q.sides)&p.mask);corner||=!!(q.corners&p.mask);}
  if(p.hole){window||=!!(below&p.hole&~over);eyeWindow||=!!(eyes&p.hole&~over);}
  if(p.film)film||=!!(below&p.mask&~over);else over|=p.mask;
 }
 const count=bits(occupied),boundsX=p=>{let lo=issue.w,hi=-1;for(let i=0;i<issue.w*issue.h;i++)if(p?.mask&(1<<i)){lo=Math.min(lo,i%issue.w);hi=Math.max(hi,i%issue.w);}return (lo+hi)*.5;};
 const pass={stock:issue.pieces.every(id=>layers.some(p=>p.id===id)),head:!(paper&masks.head),coverage:count>=issue.coverage,eyes:faceEyes>0&&visibleEyes===faceEyes,
 border:!(occupied&masks.bottom),overlap,clip:clipped,above:!!(back&&second&&layers.indexOf(back)>layers.indexOf(second)&&(back.mask&second.mask)),
 apart:layers.length>1&&!collision,corner:corner&&!collision,window,eyeWindow,gutter:!(occupied&masks.gutter),
 order:!!(back&&second&&boundsX(back)<boundsX(second)),film,top:!!(front?.foil&&layers.slice(0,-1).some(q=>q.mask&front.mask))};
 pass.trim=!clipped;const keys=['stock','head','coverage',...(issue.rules.includes('clip')?[]:['trim']),...issue.rules];return {pass,count,visibleEyes,faceEyes,failed:keys.filter(k=>!pass[k]),checks:keys.map(id=>({id,label:id==='coverage'?'Ink '+count+' / '+issue.coverage:ruleLabels[id],ok:!!pass[id]})),occupied,headCover:paper&masks.head};
}
export function evaluate(issue,placements){return analysis(issue,placements.map(p=>geometry(issue,p)).filter(Boolean));}
const movesCache=new Map();
export function placementsFor(issue,id){
 const key=[issue.w,issue.h,id].join('/');if(movesCache.has(key))return movesCache.get(key);
 const a=[],seen=new Set();
 for(let turn=0;turn<4;turn++)for(let y=-1;y<issue.h+1;y++)for(let x=-1;x<issue.w+1;x++){
  const p=geometry(issue,{id,turn,x,y});if(!p)continue;
  const key=[p.mask,p.eyes,p.hole,p.cut].join('/');if(seen.has(key))continue;seen.add(key);a.push(p);
 }
 movesCache.set(key,a);return a;
}
export function permutations(items){if(items.length<=1)return [items.slice()];return items.flatMap((x,i)=>permutations(items.filter((_,j)=>i!==j)).map(p=>[x,...p]));}
function xMiddle(p,w){let l=w,r=-1,m=p.mask;while(m){const i=31-Math.clz32(m&-m);l=Math.min(l,i%w);r=Math.max(r,i%w);m&=m-1;}return (l+r)*.5;}
export function solve(issue,limit=Infinity){
 const {head,bottom,gutter}=boardMasks(issue),rule=new Set(issue.rules),allowClip=rule.has('clip');
 // On full-bleed jobs clipping is required. On all other jobs the trim is
 // protected by the stock rule, so every kept transform must fit the paper.
 const racks=issue.pieces.map(id=>placementsFor(issue,id).filter(p=>(allowClip||!p.cut)&&(p.film||!(p.mask&head))&&(!rule.has('border')||!(p.mask&bottom))&&(!rule.has('gutter')||!(p.mask&gutter))&&(!rule.has('eyes')||!p.face||bits(p.eyes)===2)));
 const orders=permutations(issue.pieces.map((_,i)=>i)).filter(o=>!rule.has('top')||DECALS[issue.pieces[o.at(-1)]].foil);
 let count=0,distinct=0;const witnesses=[],picked=[],seen=new Set();
 function visit(index,occupied,cut){
  if(index<racks.length){for(const p of racks[index]){const first=picked[0];
    if(index===1&&((rule.has('apart')||rule.has('corner'))&&((first.mask|first.sides)&p.mask)))continue;
    if(index===1&&rule.has('corner')&&!(first.corners&p.mask))continue;
    if(index===1&&rule.has('order')&&xMiddle(first,issue.w)>=xMiddle(p,issue.w))continue;
    picked[index]=p;visit(index+1,occupied|p.mask,cut||p.cut>0);if(count>=limit)return;
   }return;}
  if(bits(occupied)<issue.coverage||(allowClip&&!cut))return;
  if(picked.length===3&&rule.has('film')&&!(picked[0].mask&picked[1].mask))return;
  for(const ord of orders){
   const pp=ord.map(i=>picked[i]);
   if(rule.has('top')&&!pp.slice(0,-1).some(q=>q.mask&pp.at(-1).mask))continue;
   if(analysis(issue,pp).failed.length)continue;count++;
   // Different visible occupied cells are guaranteed visually distinct, even
   // when swapping two disjoint layers produces an identical physical print.
   if(!seen.has(occupied)){seen.add(occupied);distinct++;if(witnesses.length<2)witnesses.push(pp.map(placementOf));}
   if(count>=limit)return;
  }
 }
 visit(0,0,false);return {id:issue.id,par:count?issue.pieces.length:null,solutions:count,distinct,witnesses};
}
