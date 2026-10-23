import { heroAnimation, enemyAnimation, animationSheet } from './animation.js';
import { ANIMATION_META } from './animation-meta.js';

// Original canvas staging for VLAD RUNNER 2049. Coordinates are world pixels; y is the feet's ground lane.
// Heroes: four columns / two rows: idle, run A/B, punch, kick, jump, hurt, special.
// Default hero art faces right; optional agiLeft faces left with readable shirt lettering.
// Enemies/bosses: four columns / three rows, facing left; each type's row is idle, walk, attack, hurt.
const W = 1280, H = 720, TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const finite = (v, fallback = 0) => Number.isFinite(v) ? v : fallback;
const noise = (n) => { const x = Math.sin(n * 127.1 + 31.7) * 43758.5453; return x - Math.floor(x); };
const PALETTES = [
  { sky: '#080d29', haze: '#7d347c', light: '#61e7ff', second: '#ff53bb', ground: '#111526', fog: '#714d9b' },
  { sky: '#291511', haze: '#dd7b38', light: '#ffd17a', second: '#e76443', ground: '#302522', fog: '#b47b52' },
  { sky: '#080f24', haze: '#324a87', light: '#80f5ef', second: '#a589ff', ground: '#111d32', fog: '#526ca1' },
];
function ellipse(g, x, y, rx, ry, fill, stroke = null, line = 3) {
  g.beginPath(); g.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), 0, 0, TAU); g.fillStyle = fill; g.fill();
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = line; g.stroke(); }
}
function shape(g, points, fill, stroke = '#090d19', width = 4) {
  g.beginPath(); points.forEach(([x,y],i) => i ? g.lineTo(x,y) : g.moveTo(x,y)); g.closePath();
  g.fillStyle = fill; g.fill(); if (stroke) { g.strokeStyle = stroke; g.lineWidth = width; g.lineJoin = 'round'; g.stroke(); }
}
function limb(g, points, color, width = 13) {
  g.beginPath(); points.forEach(([x,y],i) => i ? g.lineTo(x,y) : g.moveTo(x,y)); g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = '#090c17'; g.lineWidth = width + 7; g.stroke(); g.strokeStyle = color; g.lineWidth = width; g.stroke();
}
function text(g, value, x, y, size, color, align = 'center') {
  g.font = `700 ${size}px VRComic, sans-serif`; g.textAlign = align; g.textBaseline = 'middle';
  g.lineJoin = 'round'; g.strokeStyle = '#090c1de0'; g.lineWidth = Math.max(3,size / 7); g.strokeText(value,x,y); g.fillStyle = color; g.fillText(value,x,y);
}

// A standing runner belongs above the surface supporting their feet, while a
// runner behind the same box must be obscured by its front. Height does not
// change the belt lane: it changes which physical surface owns that lane.
export function worldDrawOrder(actors = [], platforms = [], props = [], pickups = []) {
  const surfaces = [...platforms, ...props.filter(item => !item.broken)];
  const depth = entity => {
    const support = surfaces.find(item => item.id === entity.platformId)
      || surfaces.filter(item => finite(entity.z) >= item.height - .5
        && Math.abs(entity.x - item.x) <= item.width / 2
        && Math.abs(entity.y - item.y) <= item.depth / 2).sort((a,b) => b.height-a.height)[0];
    return support ? support.y + support.depth / 2 + .2 + (entity.y - support.y) * .001 : entity.y;
  };
  return [...platforms.map(entity => ({ type: 'platform', entity, depth: entity.y + entity.depth / 2 })),
    ...props.map(entity => ({ type: 'prop', entity, depth: entity.broken ? entity.y - 1 : entity.y + entity.depth / 2 })),
    ...actors.map(entity => ({ type: 'actor', entity, depth: depth(entity) })),
    ...pickups.map(entity => ({ type: 'pickup', entity, depth: depth(entity) }))]
    .sort((a,b) => a.depth-b.depth || finite(a.entity.id)-finite(b.entity.id));
}

export function createRenderer(canvas, assets = {}, options = {}) {
  const g = canvas.getContext('2d', { alpha: false });
  let settings = { reducedMotion: false, shake: true, ...options }, dead = false, time = 0, aspect = W/H;
  let pixelW = 0, pixelH = 0, scale = 1, offsetX = 0, offsetY = 0, shakeTime = 0, shakePower = 0;
  let lastEvent = 0, lastElapsed = -1, shakeClock = 0;
  const sprites = new WeakMap();
  function resize() {
    if (dead) return;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width || canvas.clientWidth || W), height = Math.max(1, rect.height || canvas.clientHeight || width / aspect);
    const dpr = Math.min(2, Math.max(1, finite(globalThis.devicePixelRatio,1)));
    pixelW = Math.round(width*dpr); pixelH = Math.round(height*dpr);
    if (canvas.width !== pixelW || canvas.height !== pixelH) { canvas.width = pixelW; canvas.height = pixelH; }
    scale = Math.min(pixelW/W,pixelH/H); offsetX = (pixelW-W*scale)/2; offsetY = (pixelH-H*scale)/2;
  }
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  observer?.observe(canvas); resize();
  function spriteInfo(img, rows = 2, cols = 4, metadata = null) {
    if (!img || !(img.naturalWidth || img.width) || img.complete === false) return null;
    rows = Math.max(1, Math.floor(finite(metadata?.rows, rows)));
    cols = Math.max(1, Math.floor(finite(metadata?.cols, cols)));
    if (sprites.get(img)?.rows === rows && sprites.get(img)?.cols === cols && sprites.get(img)?.metadata === metadata) return sprites.get(img);
    const width = img.naturalWidth || img.width, height = img.naturalHeight || img.height;
    const count=cols*rows,cw = width/cols, ch = height/rows;
    const frames = Array.from({length:count},(_,i) => {
      const col=i%cols,row=Math.floor(i/cols),x=Math.round(col*cw),y=Math.round(row*ch);
      return {x,y,w:Math.round((col+1)*cw)-x,h:Math.round((row+1)*ch)-y,left:x-col*cw,top:y-row*ch};
    });
    let top = ch*.08, baseline = ch*.94;
    // Same-origin generated assets permit alpha bounds. The untrimmed sheet remains a safe fallback.
    try {
      const tmp = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(width,height) : document.createElement('canvas');
      tmp.width = width; tmp.height = height;
      const ctx = tmp.getContext('2d',{willReadFrequently:true}); ctx.drawImage(img,0,0);
      const pixels = ctx.getImageData(0,0,width,height).data; top = ch; baseline = 0;
      frames.forEach((f) => {
        let minX=f.w,minY=f.h,maxX=-1,maxY=-1;
        for (let y=0;y<f.h;y++) for (let x=0;x<f.w;x++) if(pixels[((f.y+y)*width+f.x+x)*4+3]>28) { minX=Math.min(minX,x); minY=Math.min(minY,y); maxX=Math.max(maxX,x); maxY=Math.max(maxY,y); }
        if(maxX>=minX) { f.x+=minX; f.y+=minY; f.w=maxX-minX+1; f.h=maxY-minY+1; f.left+=minX; f.top+=minY; top=Math.min(top,f.top); baseline=Math.max(baseline,f.top+f.h); }
      });
      // Generated hands, coat tails and kicks can cross a nominal cell edge. If distinct
      // silhouettes exist for every pose, use connected alpha bounds assigned to the same grid.
      // This preserves the original common anchor while avoiding clipped limbs/neighbor fragments.
      const labels=new Int32Array(width*height), queue=new Int32Array(width*height), regions=Array(count).fill(null);
      let label=0;
      for(let start=0;start<labels.length;start++) {
        if(labels[start]||pixels[start*4+3]<64)continue;
        let head=0,tail=1,minX=width,minY=height,maxX=0,maxY=0;queue[0]=start;labels[start]=++label;
        while(head<tail){
          const n=queue[head++],x=n%width,y=Math.floor(n/width);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
          const visit=(k)=>{if(!labels[k]&&pixels[k*4+3]>=64){labels[k]=label;queue[tail++]=k;}};
          if(x>0)visit(n-1);if(x<width-1)visit(n+1);if(y>0)visit(n-width);if(y<height-1)visit(n+width);
        }
        if(tail<cw*ch*.05||maxY-minY<ch*.3)continue;
        const col=clamp(Math.floor((minX+maxX)/2/cw),0,cols-1),row=clamp(Math.floor((minY+maxY)/2/ch),0,rows-1),slot=row*cols+col;
        if(regions[slot]&&regions[slot].pixels>tail)continue;
        regions[slot]={minX,minY,maxX,maxY,label,pixels:tail};
      }
      if(regions.every(Boolean)) {
        // Several poses overlap their neighbors' bounding rectangles. Assign each opaque
        // silhouette and its translucent fringe to its own frame instead of cutting the art.
        const slots=new Map(regions.map((region,i)=>[region.label,i+1])),owners=new Uint8Array(labels.length);
        let head=0,tail=0;
        for(let n=0;n<labels.length;n++){const owner=slots.get(labels[n]);if(owner){owners[n]=owner;queue[tail++]=n;}}
        while(head<tail){
          const n=queue[head++],owner=owners[n],x=n%width,y=Math.floor(n/width),region=regions[owner-1];
          region.minX=Math.min(region.minX,x);region.maxX=Math.max(region.maxX,x);region.minY=Math.min(region.minY,y);region.maxY=Math.max(region.maxY,y);
          // Extremely faint matte pixels can connect otherwise separate drawings.
          // Keep antialiased edges, while excluding the almost-transparent sheet matte.
          const visit=(k)=>{if(!owners[k]&&pixels[k*4+3]>8){owners[k]=owner;queue[tail++]=k;}};
          if(x>0)visit(n-1);if(x<width-1)visit(n+1);if(y>0)visit(n-width);if(y<height-1)visit(n+width);
        }
        const isolated=regions.map((region,i)=>{
          const col=i%cols,row=Math.floor(i/cols),x=Math.max(0,region.minX-1),y=Math.max(0,region.minY-1);
          const w=Math.min(width,region.maxX+2)-x,h=Math.min(height,region.maxY+2)-y;
          const image=typeof OffscreenCanvas==='function'?new OffscreenCanvas(w,h):document.createElement('canvas');
          image.width=w;image.height=h;
          const frameContext=image.getContext('2d'),data=frameContext.createImageData(w,h);
          for(let fy=0;fy<h;fy++)for(let fx=0;fx<w;fx++){
            const n=(y+fy)*width+x+fx;if(owners[n]!==i+1)continue;
            const from=n*4,to=(fy*w+fx)*4;
            data.data[to]=pixels[from];data.data[to+1]=pixels[from+1];data.data[to+2]=pixels[from+2];data.data[to+3]=pixels[from+3];
          }
          frameContext.putImageData(data,0,0);
          return {x,y,w,h,left:x-col*cw,top:y-row*ch,image};
        });
        frames.splice(0,count,...isolated);top=Math.min(...isolated.map(f=>f.top));baseline=Math.max(...isolated.map(f=>f.top+f.h));
      }
      if (baseline <= top) { top=ch*.08; baseline=ch*.94; }
    } catch { /* Cross-origin or unreadable canvas: retain the supplied aligned cells. */ }
    const rowMetrics=Array.from({length:rows},(_,row)=>{
      const poses=frames.slice(row*cols,row*cols+cols),rowTop=Math.min(...poses.map(f=>f.top)),rowBaseline=Math.max(...poses.map(f=>f.top+f.h));
      return {top:rowTop,baseline:rowBaseline,span:Math.max(1,rowBaseline-rowTop)};
    });
    // A prepared atlas can provide a single anatomical anchor for all its poses. Never
    // scale a punch to its own bounds: an extended hand must not shrink the character.
    const anchorX = finite(metadata?.anchorX, cw / 2), anchorY = finite(metadata?.baseline, baseline);
    const visibleHeight = Math.max(1, finite(metadata?.sourceHeight, baseline - top));
    const info={frames,cw,ch,rows,cols,rowMetrics,baseline:anchorY,anchorX,metadata,
      scale:finite(metadata?.height,214)/visibleHeight}; sprites.set(img,info); return info;
  }
  async function prepareAssets(onProgress) {
    const keys=[...Object.keys(ANIMATION_META),'enemies','bosses'].filter(key=>assets[key]);
    let prepared=0;
    for(const key of keys){
      if(dead)break;
      const metadata=assets.animationMeta?.[key]||ANIMATION_META[key]||null;
      if(spriteInfo(assets[key],metadata?.rows||3,metadata?.cols||4,metadata))prepared++;
      onProgress?.(prepared,keys.length);
      // Decode and isolate actors during loading, yielding a paint between sheets.
      // Starting the first combo must not trigger a million-pixel alpha scan.
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    return {prepared,total:keys.length};
  }
  function backdrop(stage, camera, clock) {
    const p=PALETTES[stage], bg=assets[['neon','orange','spire'][stage]];
    const hasBackground=bg && (bg.naturalWidth||bg.width) && bg.complete!==false;
    const sky=g.createLinearGradient(0,0,0,530); sky.addColorStop(0,p.sky); sky.addColorStop(.75,p.haze); sky.addColorStop(1,p.ground);
    g.fillStyle=sky; g.fillRect(0,0,W,H);
    if (hasBackground) {
      const iw=bg.naturalWidth||bg.width, ih=bg.naturalHeight||bg.height;
      // The skyline and road are distinct planes. Mirrored panorama sections
      // meet at their actual edges; neither layer stops scrolling mid-district.
      const tile = (sourceY, sourceH, top, height, parallax, span) => {
        const scroll=camera*parallax, start=Math.floor(scroll/span);
        for(let n=start;n<=start+2;n++) {
          const x=n*span-scroll;
          g.save();g.translate(x+(n%2?span:0),top);g.scale(n%2?-1:1,1);
          g.drawImage(bg,0,sourceY,iw,sourceH,0,0,span,height);g.restore();
        }
      };
      tile(0,ih*.69,0,480,.27,1320);
      tile(ih*.69,ih*.31,474,H-474,1,1320);
      const shade=g.createLinearGradient(0,0,0,480); shade.addColorStop(0,'#05091630'); shade.addColorStop(1,'#080c2120'); g.fillStyle=shade; g.fillRect(0,0,W,500);
    } else {
      for(let layer=0;layer<3;layer++) {
        const gap=110+layer*45, drift=camera*(.05+layer*.07);
        for(let i=-2;i<14;i++) {
          const n=i+Math.floor(drift/gap), x=i*gap-(drift%gap), height=90+noise(n+layer*40)*240;
          g.fillStyle=['#171b3d','#13172e','#0b1025'][layer]; g.fillRect(x,455-height,gap-8,height);
          g.fillStyle=p.light; g.globalAlpha=.12+layer*.08;
          for(let yy=470-height;yy<430;yy+=20) for(let xx=x+11;xx<x+gap-12;xx+=17) if(noise(xx+yy)> .5) g.fillRect(xx,yy,5,8);
          g.globalAlpha=1;
        }
      }
    }
    // Small distant traffic and a few large, slowly drifting light shafts give the city depth.
    g.save(); g.globalCompositeOperation='screen';
    for(let i=0;i<4;i++) {
      const x=((clock*(13+i*7)+i*374-camera*.13)%(W+260)+W+260)%(W+260)-130, y=128+i*55;
      g.globalAlpha=.42; g.fillStyle=p.light; g.fillRect(x-45,y,44,2); g.fillRect(x,y-4,27,7); g.fillStyle='#fff6cf'; g.fillRect(x+24,y-3,5,3);
    }
    const beam=g.createLinearGradient(0,40,0,470); beam.addColorStop(0,p.light+'19'); beam.addColorStop(1,p.light+'00');
    shape(g,[[950+Math.sin(clock*.13)*60,20],[1120,480],[710,480]],beam,null); g.restore();
    // Mid-distance fixtures slide more quickly than the skyline. Their bases
    // stay behind the playable walkway; only authored objects have collision.
    for(let n=Math.floor(camera*.62/680)-1;n<Math.floor(camera*.62/680)+3;n++) {
      const x=n*680-camera*.62+160;
      g.save();g.globalAlpha=.8;
      if(stage===1){
        shape(g,[[x,460],[x+13,320],[x+27,319],[x+41,460]],'#3c2c29','#1e1b24',3);
        shape(g,[[x-72,316],[x+77,294],[x+115,330],[x-38,353]],'#37464f','#1b2029',4);
        for(let i=0;i<5;i++){g.strokeStyle='#99afb54d';g.lineWidth=2;g.beginPath();g.moveTo(x-64+i*29,320-i*4);g.lineTo(x-33+i*29,348-i*4);g.stroke();}
      }else{
        g.fillStyle='#141c2c';g.fillRect(x,288,12,181);g.fillStyle=p.light+'70';g.fillRect(x+3,293,3,160);
        shape(g,[[x-9,296],[x+142,296],[x+133,354],[x-9,354]],'#17213be8',p.second+'90',2);
        text(g,stage===0?['NIGHT MARKET','NØ SIGNAL','AFTER HOURS'][((n%3)+3)%3]:['MEMORY / 01','ARCHIVE','KEEP MOVING'][((n%3)+3)%3],x+62,323,17,p.light);
        g.strokeStyle='#0c1124';g.lineWidth=4;g.beginPath();g.moveTo(x+7,290);g.quadraticCurveTo(x+350,355,x+687,290);g.stroke();
      }g.restore();
    }
    const floor=g.createLinearGradient(0,447,0,H); floor.addColorStop(0,hasBackground?'#10142722':p.ground); floor.addColorStop(.5,hasBackground?'#0b122230':'#0b1222'); floor.addColorStop(1,hasBackground?'#070c1960':'#070c19');
    g.fillStyle=floor; g.fillRect(0,447,W,H-447);
    g.fillStyle='#10182ccc';g.fillRect(0,465,W,9);g.fillStyle=p.light+'45';g.fillRect(0,465,W,2);
    // Ground seams, drains and painted arrows are world coordinates. Their
    // exact one-to-one movement makes running read as travel, not a treadmill.
    for(let n=Math.floor(camera/220)-1;n<Math.floor(camera/220)+8;n++) {
      const x=n*220-camera;
      g.strokeStyle='#060b18a0';g.lineWidth=2;g.beginPath();g.moveTo(x,478);g.lineTo(x+24,H);g.stroke();
      if(n%3===0){
        const y=510+noise(n+71)*122;g.save();g.globalAlpha=.6;
        shape(g,[[x-42,y-8],[x+41,y-8],[x+47,y+10],[x-37,y+10]],'#0b1324','#506477',2);
        g.strokeStyle='#748798';g.lineWidth=2;for(let i=0;i<9;i++){g.beginPath();g.moveTo(x-32+i*8,y-5);g.lineTo(x-28+i*8,y+7);g.stroke();}g.restore();
      }
      if(n%4===1){g.save();g.globalAlpha=.24;shape(g,[[x-32,657],[x+13,657],[x+10,650],[x+43,662],[x+11,672],[x+14,666],[x-30,666]],p.light,null);g.restore();}
    }
    g.save(); g.globalCompositeOperation='screen';
    for(let i=Math.floor(camera/161)-1;i<Math.floor(camera/161)+10;i++) {
      const x=i*161-camera, y=480+noise(i+34)*200;
      g.globalAlpha=.10+noise(i)*.09; g.fillStyle=i%2?p.light:p.second;
      ellipse(g,x,y,25+noise(i+2)*80,2+noise(i+3)*5,g.fillStyle);
      g.fillRect(x-7,y-10,3,17+noise(i)*21);
    }
    g.restore();
    // Perspective curb and hazard marks, all below the playable lanes.
    g.fillStyle='#101b2bc9'; g.fillRect(0,689,W,31); g.fillStyle=p.light+'50'; g.fillRect(0,689,W,2);
    for(let i=-1;i<12;i++){const x=i*150-(camera%150);shape(g,[[x,698],[x+29,698],[x+11,708],[x-18,708]],'#b1a05c66',null);}
  }
  function worldObject(e,camera,stage,breakable=false) {
    const x=e.x-camera, y=e.y, w=e.width, d=e.depth, h=e.height;
    if(x+w/2<-60||x-w/2>W+60)return;
    const p=PALETTES[stage],l=-w/2,r=w/2,back=-d/2,front=d/2,top=front-h;
    const ink='#0c1220',accent=stage===1?'#efb86e':p.light;
    g.save();g.translate(x,y);
    ellipse(g,7,front+5,w*.54,d*.32,'#04071470');
    if(e.broken){
      // Persistent, low rubble gives the destroyed obstacle a readable absence.
      for(let i=0;i<7;i++){
        const xx=(noise(e.id*17+i)-.5)*w*1.5,yy=(noise(e.id*13+i)-.5)*d;
        shape(g,[[xx-8,yy+4],[xx-5,yy-4],[xx+8,yy-7],[xx+11,yy+4]],i%2?'#344658':'#64707c',ink,2);
      }
      g.restore();return;
    }
    if(e.kind==='rock'){
      shape(g,[[l,front],[l-7,-8],[l+17,back-h+13],[r-23,back-h],[r+8,top+10],[r-4,front]],'#846b58',ink,4);
      shape(g,[[l+17,back-h+13],[r-23,back-h],[r+8,top+10],[l+29,top]],'#b49472',ink,3);
      g.strokeStyle='#534a43';g.lineWidth=3;g.beginPath();g.moveTo(l+29,top);g.lineTo(l+40,front-4);g.moveTo(r-21,top+14);g.lineTo(r-9,front-6);g.stroke();
    }else if(e.kind==='barrel'){
      const ry=d*.33;
      g.fillStyle=stage===1?'#9c6247':'#405166';g.fillRect(l,back-h+ry,w,h+d*.5);
      ellipse(g,0,front-ry,w/2,ry,stage===1?'#774b39':'#2b3c51',ink,3);
      g.fillStyle=stage===1?'#9c6247':'#405166';g.fillRect(l,back-h+ry,w,h+d*.5-ry);
      for(const yy of [back-h+14,front-10]){g.strokeStyle=ink;g.lineWidth=7;g.beginPath();g.ellipse(0,yy,w/2,ry,0,0,Math.PI);g.stroke();g.strokeStyle='#96a0a7';g.lineWidth=3;g.stroke();}
      ellipse(g,0,back-h+ry,w/2,ry,'#78848b',ink,3);
      ellipse(g,w*.2,back-h+ry,4,2,'#222d3a');
      shape(g,[[-9,top-1],[0,top-16],[9,top-1]],'#f7d17b',ink,2);
    }else{
      const cargo=e.kind==='crate'||e.kind==='cargo-stack',solar=e.kind==='solar-plinth',wreck=e.kind==='wreck';
      const counter=e.kind==='market-stall',console=e.kind==='console-deck'||e.kind==='terminal',gantry=e.kind==='gantry';
      const frontColor=cargo?(stage===1?'#8c634a':'#3d5b6c'):counter?'#973b57':wreck?'#786352':console?'#283b58':'#34445a';
      const topColor=cargo?'#73939a':counter?'#d3a47d':solar?'#234d64':wreck?'#9a8970':console?'#49637c':'#637789';
      shape(g,[[l,top],[r,top],[r,front],[l,front]],frontColor,ink,4);
      shape(g,[[l,back-h],[r-9,back-h],[r,top],[l,top]],topColor,ink,4);
      if(wreck){
        shape(g,[[l+18,top],[l+28,back-h+8],[r-28,back-h+8],[r-11,top]],'#435663',ink,3);
        g.strokeStyle='#c6aa7b';g.lineWidth=3;g.beginPath();g.moveTo(l+43,top-2);g.lineTo(l+62,back-h+11);g.stroke();
        ellipse(g,l+28,front-7,16,9,'#242b35',ink,3);ellipse(g,r-28,front-7,16,9,'#242b35',ink,3);
      }else if(cargo){
        const count=Math.max(1,Math.round(w/76));
        for(let i=0;i<count;i++){
          const left=l+i*w/count+7,right=l+(i+1)*w/count-7;
          g.strokeStyle='#182b3b';g.lineWidth=3;g.strokeRect(left,top+7,right-left,h-14);
          g.beginPath();g.moveTo(left,top+7);g.lineTo(right,front-7);g.moveTo(right,top+7);g.lineTo(left,front-7);g.stroke();
          g.strokeStyle='#9cb0af';g.lineWidth=2;g.beginPath();g.moveTo(left,back-h+8);g.lineTo(right-3,top-5);g.stroke();
        }
      }else if(counter){
        for(let i=0;i<Math.ceil(w/26);i++)shape(g,[[l+i*26+3,top+5],[l+i*26+15,top+5],[l+i*26+20,front-5],[l+i*26+8,front-5]],'#e9b49b',null);
        g.fillStyle='#221a30';g.fillRect(l+9,front-14,w-18,9);
      }else if(solar){
        for(let i=1;i<7;i++){const xx=l+i*w/7;g.strokeStyle='#6ad0e677';g.lineWidth=2;g.beginPath();g.moveTo(xx,back-h+5);g.lineTo(xx,top-4);g.stroke();}
        g.strokeStyle='#92e2e57a';g.beginPath();g.moveTo(l+7,(back+front)/2-h);g.lineTo(r-7,(back+front)/2-h);g.stroke();
        g.fillStyle='#1f2938';g.fillRect(l+12,top+9,w-24,h-19);
      }else if(console){
        shape(g,[[l+10,back-h+7],[r-17,back-h+7],[r-10,top-6],[l+10,top-6]],'#102c43',ink,2);
        for(let i=0;i<Math.max(2,Math.floor(w/40));i++){g.fillStyle=i%2?'#b68eff':'#6be4e6';g.fillRect(l+18+i*31,back-h+13,17,3);}
        g.fillStyle='#14243a';g.fillRect(l+9,top+9,w-18,h-18);
        g.fillStyle=accent;g.fillRect(l+15,top+15,Math.min(w-30,42),4);g.fillStyle='#8b70af';g.fillRect(l+15,top+24,Math.min(w-30,29),3);
      }else{
        for(let xx=l+11;xx<r-10;xx+=15){g.strokeStyle='#1b2c3d';g.lineWidth=3;g.beginPath();g.moveTo(xx,back-h+5);g.lineTo(xx+5,top-5);g.stroke();}
        if(gantry){g.fillStyle='#152337';g.fillRect(l+10,top+9,w-20,h-18);g.strokeStyle='#82929f';g.lineWidth=4;g.beginPath();g.moveTo(l+12,front-10);g.lineTo(r-12,top+10);g.moveTo(l+12,top+10);g.lineTo(r-12,front-10);g.stroke();}
      }
      // Bright top lip is the landing surface. Bolts and diagonal hazard marks
      // give low platforms a stable readable edge against the painted pavement.
      g.strokeStyle=accent;g.lineWidth=3;g.beginPath();g.moveTo(l+3,top);g.lineTo(r-3,top);g.stroke();
      for(const xx of [l+7,r-7])for(const yy of [top+7,front-6])ellipse(g,xx,yy,2,2,'#c7d0ce');
    }
    if(breakable&&e.hp<e.maxHp){
      const damage=1-e.hp/e.maxHp;g.strokeStyle='#0c1324';g.lineWidth=2.5;
      g.beginPath();g.moveTo(-7,top);g.lineTo(2,top+h*.3);g.lineTo(-5,top+h*.5);g.lineTo(8,top+h*.8);g.stroke();
      if(damage>.45){g.beginPath();g.moveTo(2,top+h*.3);g.lineTo(15,top+h*.24);g.lineTo(22,top+h*.5);g.stroke();}
    }
    g.restore();
  }
  function foreground(stage,camera) {
    const p=PALETTES[stage];
    // Close fixtures cross the screen faster than the walkway, without covering
    // the combat lane or changing any collision boundary.
    for(let n=Math.floor(camera*1.12/820)-1;n<Math.floor(camera*1.12/820)+3;n++){
      const x=n*820-camera*1.12+570;
      shape(g,[[x-16,720],[x-12,664],[x+8,660],[x+16,720]],'#091320','#050912',4);
      g.fillStyle=p.light+'66';g.fillRect(x-8,669,13,5);
      g.strokeStyle='#050b16';g.lineWidth=5;g.beginPath();g.moveTo(x,677);g.quadraticCurveTo(x+410,756,x+820,677);g.stroke();
    }
  }
  function hazard(e,camera,stage,plume=false) {
    const x=e.x-camera,y=e.y,w=e.width,d=e.depth;
    if(x+w/2<0||x-w/2>W)return;
    const live=e.phase==='active',warning=e.phase==='telegraph',phase=finite(e.phaseProgress);
    const color=stage===1?'#ffad65':stage===2?'#dba0ff':'#7ceeff';
    g.save();g.translate(x,y);
    if(!plume){
      shape(g,[[-w/2,-d/2],[w/2,-d/2],[w/2+5,d/2],[-w/2+5,d/2]],'#162538','#080e1d',3);
      for(let i=1;i<Math.floor(w/12);i++){g.strokeStyle='#718692';g.lineWidth=2;g.beginPath();g.moveTo(-w/2+i*12,-d/2+4);g.lineTo(-w/2+i*12+3,d/2-4);g.stroke();}
      if(warning||live){
        g.globalAlpha=live?.7:.24+phase*.48;g.strokeStyle=warning?'#ffbc76':color;g.lineWidth=3;g.strokeRect(-w/2-5,-d/2-4,w+10,d+8);
        g.fillStyle=warning?'#ff7a4933':color+'44';g.fillRect(-w/2,-d/2,w,d);
        if(warning){text(g,'!',0,-d/2-12,19,'#fff0c9');g.fillStyle='#ffd197';g.fillRect(-w/2,d/2+7,w*phase,3);}
      }
    }else if(live){
      const h=finite(e.height,50)+12;
      if(stage===1||String(e.kind).includes('steam')){
        for(let i=0;i<5;i++){
          const xx=(i-2)*w/5,life=(time*2.5+i*.18)%1;
          g.globalAlpha=(1-life)*.55;
          ellipse(g,xx+Math.sin(i+time*4)*7,-life*h,6+life*15,10+life*24,stage===1?'#ffd9a6':'#c5eeff');
        }
      }else{
        g.globalAlpha=.75;g.strokeStyle=color;g.lineWidth=2.5;
        for(let i=0;i<5;i++){
          const xx=(i-2)*w/5,k=Math.floor(time*18)+i;
          g.beginPath();g.moveTo(xx,d*.2);g.lineTo(xx-8,-h*.28);g.lineTo(xx+noise(k)*18,-h*.52);g.lineTo(xx-3,-h);g.stroke();
        }
        g.globalAlpha=.13;ellipse(g,0,-h*.3,w*.55,h*.45,color);
      }
    }
    g.restore();
  }
  function rain(stage, clock) {
    const p=PALETTES[stage]; g.save(); g.strokeStyle=p.light; g.lineWidth=1.2; g.globalAlpha=stage===1?.09:.18;
    const moving=settings.reducedMotion?0:clock;
    for(let i=0;i<(stage===1?46:92);i++){const x=((noise(i+1)*W-moving*(stage===1?95:60))%(W+40)+W+40)%(W+40)-20,y=((noise(i+501)*H+moving*(stage===1?12:280+noise(i)*160))%H);g.beginPath();g.moveTo(x,y);g.lineTo(x-(stage===1?12:5),y+(stage===1?2:16+noise(i+2)*12));g.stroke();}
    g.globalAlpha=.1; g.lineWidth=1;
    for(let i=0;i<13;i++){const phase=(clock*.9+noise(i+93))%1;g.beginPath();g.ellipse(noise(i+70)*W,480+noise(i+40)*190,phase*18,phase*4,0,0,TAU);g.stroke();}
    g.restore();
  }
  function groundMark(e, camera, clock) {
    const x=e.x-camera,y=e.y-finite(e.groundZ), boss=e.boss;
    g.save(); g.globalAlpha=e.dead?.25:.5;
    const groundScale=clamp(1-(finite(e.z)-finite(e.groundZ))/380,.52,1);
    ellipse(g,x,y+4,(boss?57:36)*groundScale,(boss?15:9)*groundScale,'#030714');
    if(e.telegraph) {
      const radius=boss?100:e.kind==='ranger'?48:66, pulse=.5+Math.sin(clock*16)*.2;
      g.globalAlpha=pulse; ellipse(g,finite(e.targetX,e.x)-camera,finite(e.targetY,e.y)-finite(e.targetZ),radius,radius*.36,'#ff435e25','#ff6077',2);
      g.setLineDash([8,7]); ellipse(g,x,y,radius*.72,radius*.25,'#ff50601a','#ff93a2',2); g.setLineDash([]);
    }
    if(e.index>0){g.globalAlpha=.42;ellipse(g,x,y+5,31,8,'#00000000','#d08bff',1.5);}
    g.restore();
  }
  function hero(e, camera) {
    const action=heroAnimation(e),selection=animationSheet(assets,e,action),img=assets[selection.key];
    const sheet=spriteInfo(img,selection.rows,selection.cols,assets.animationMeta?.[selection.key]||ANIMATION_META[selection.key]);
    const face=selection.mirror?-1:1,anatomicalFace=e.face<0?-1:1;
    g.save();g.translate(e.x-camera,e.y-finite(e.z));
    if(e.counterReady&&finite(e.counterTime)>0){
      g.save();g.globalAlpha=.65;g.strokeStyle='#fff2ae';g.lineWidth=2.5;
      const pulse=.8+Math.sin(time*13)*.2;
      ellipse(g,0,-5,34*pulse,10*pulse,'#fff0b912','#ffe6a3',2);
      shape(g,[[-7,-233],[0,-244],[7,-233],[0,-222]],'#fff3b5','#38233b',2);
      g.restore();
    }
    if(e.dead){
      const fall=clamp(finite(e.deadTime)/.28,0,1);g.globalAlpha=.9*(1-clamp((finite(e.deadTime)-.4)/.5,0,.72));
      g.translate(0,-58);g.rotate(-anatomicalFace*fall*1.48);g.translate(0,58);
    } else if(e.invuln>0&&!settings.reducedMotion&&e.hurtTime<=0)g.globalAlpha=.78+.22*Math.sin(time*30)**2;
    g.scale(face,1);
    // Small grounded deformations join the drawn keys; locomotion itself uses eight
    // distinct drawings. Feet remain fixed instead of the whole sprite bobbing.
    const landing=clamp(finite(e.landingTime)/.12,0,1);
    const recoil=action.recoil||0;
    const lean=action.pose==='dodge'?13:action.pose==='hurt'?-7*recoil:finite(action.lean);
    const orient=selection.mirror?1:anatomicalFace;
    g.transform(1,0,-lean*orient/214,1,0,0);
    if(!settings.reducedMotion){
      const breath=action.pose==='idle'?Math.sin(time*2.2+finite(e.id))*.003:0;
      g.scale(1+landing*.065+recoil*.025,1-landing*.06-recoil*.025+breath);
    }
    if(sheet){
      const f=sheet.frames[clamp(selection.frame,0,sheet.frames.length-1)],s=sheet.scale;
      const frameMeta=sheet.metadata?.frames?.[selection.frame];
      const anchorX=finite(frameMeta?.anchorX,sheet.anchorX),baseline=finite(frameMeta?.baseline,sheet.baseline);
      g.drawImage(f.image||img,f.image?0:f.x,f.image?0:f.y,f.w,f.h,(f.left-anchorX)*s,(f.top-baseline)*s,f.w*s,f.h*s);
    }else humanoid(e,true);
    g.restore();
  }
  function duoPartner(state,camera) {
    if(!state||state.coop||state.players?.length!==1)return null;
    const player=state.players[0];if(player.dead)return null;
    let event=null;
    for(let i=(state.events?.length||0)-1;i>=0;i--)if(state.events[i].type==='duo'){event=state.events[i];break;}
    const age=event?(Number.isFinite(state.simulationTime)&&Number.isFinite(event.simulationTime)
      ?state.simulationTime-event.simulationTime:state.elapsed-event.time):-1;
    if(age<0||age>=.85)return null;
    const fade=clamp(age/.12,0,1)*clamp((.85-age)/.25,0,1),face=player.face<0?-1:1;
    let x=player.x-face*94;
    if(x-camera<55||x-camera>W-55)x=player.x+face*94;
    return {id:-1,kind:player.kind==='vlad'?'agi':'vlad',x,y:player.y-24,z:finite(player.z)+8,
      face,pose:'special',animTime:age,hp:1,maxHp:1,hologram:true,alpha:fade*(settings.reducedMotion?.42:.78),
      fade,progress:age/.85,partner:player};
  }
  function partnerHologram(e,camera) {
    const color=e.kind==='agi'?'#d7a0ff':'#7decff';
    g.save();g.globalAlpha=e.alpha;g.shadowColor=color;g.shadowBlur=settings.reducedMotion?9:21;
    hero(e,camera);g.restore();
    g.save();g.globalCompositeOperation='screen';g.globalAlpha=e.alpha*.55;
    ellipse(g,e.x-camera,e.y+2,39,9,'#00000000',color,2);g.restore();
  }
  function duoTrails(e,camera) {
    const player=e.partner,reach=settings.reducedMotion?225:225+Math.sin(e.progress*Math.PI)*65;
    g.save();g.translate((e.x+player.x)/2-camera,(e.y+player.y)/2-finite(player.z)-104);g.scale(e.face,1);
    g.globalCompositeOperation='screen';g.lineCap='round';
    for(const [index,color]of ['#79ecff','#ce8aff'].entries()){
      const sign=index?1:-1;
      g.beginPath();g.moveTo(-70,sign*47);
      g.bezierCurveTo(8,sign*65,reach*.45,-sign*46,reach,-sign*18);
      g.strokeStyle=color;g.shadowColor=color;g.shadowBlur=settings.reducedMotion?0:12;
      g.globalAlpha=e.fade*(settings.reducedMotion?.1:.2);g.lineWidth=settings.reducedMotion?5:12;g.stroke();
      g.shadowBlur=0;g.globalAlpha=e.fade*(settings.reducedMotion?.24:.72);g.lineWidth=2.5;g.stroke();
    }
    g.restore();
  }
  function humanoid(e, player=false) {
    const kind=e.kind, vlad=kind==='vlad', agi=kind==='agi', boss=!!e.boss, shield=kind==='shield', ranger=kind==='ranger';
    const stride=e.pose==='run'?Math.sin(finite(e.animTime,time)*12):0, bob=e.pose==='run'?Math.abs(stride)*4:Math.sin(time*3)*1.3;
    const punch=e.pose==='punch',kick=e.pose==='kick',special=e.pose==='special',hurt=e.pose==='hurt'||e.hurtTime>0;
    const skin=player?'#e6ad88':'#708599', fabric=agi?'#8c4be4':vlad?'#282632':kind==='juggernaut'?'#88624a':ranger?'#35414f':'#334554';
    const accent=agi?'#ed89ff':vlad?'#72e7ff':kind==='archon'?'#a891ff':kind==='juggernaut'?'#ffad5a':shield?'#72e7ff':'#ff5b91';
    const size=boss?(kind==='juggernaut'?1.52:1.35):1;g.scale(size,size);g.translate(hurt?-9:0,-bob);
    if(agi)shape(g,[[-30,-158],[-37,-139],[-40,-77],[-15,-88],[17,-71],[35,-91],[28,-159]],'#e1b14e');
    const legBack=kick?-15:stride*22,legFront=kick?67:-stride*22;
    limb(g,[[-13,-66],[-18+legBack*.4,-32],[-18+legBack,-6]],agi?skin:'#222536',agi?15:20);
    ellipse(g,-11+legBack,-5,22,8,agi?'#e9e9f9':'#171c2c','#080d19',4);
    if(vlad||ranger||kind==='archon')shape(g,[[-28,-116],[22,-115],[34+stride*5,-35],[3,-49],[-14,-36],[-39-stride*8,-35]],fabric);
    const lower=agi?-53:-62;
    shape(g,[[-29,-129],[22,-129],[30,lower],[-29,lower]],fabric);
    if(!player){shape(g,[[-33,-125],[-10,-139],[29,-126],[31,-99],[-29,-96]],'#506477');g.fillStyle=accent;g.fillRect(-20,-114,40,5);}
    if(agi){shape(g,[[-28,-66],[27,-66],[25,-48],[-28,-48]],'#2c2d49');text(g,'AGI',0,-100,18,'#f7eaff');}
    if(vlad){shape(g,[[-25,-133],[-9,-109],[0,-124],[13,-109],[26,-133],[12,-142],[-11,-142]],'#bfae96');g.strokeStyle='#77717a';g.lineWidth=2;g.beginPath();g.moveTo(0,-105);g.lineTo(0,-49);g.stroke();}
    limb(g,[[11,-60],[17+legFront*.5,kick?-54:-30],[18+legFront,kick?-76:-6]],agi?skin:'#292d3a',agi?16:21);
    ellipse(g,27+legFront,kick?-76:-5,23,9,agi?'#f0edf9':'#171a29','#080d19',4);
    if(agi){g.strokeStyle='#9e5fdc';g.lineWidth=4;g.beginPath();g.moveTo(legFront+12,kick?-78:-7);g.lineTo(legFront+32,kick?-78:-7);g.stroke();}
    // Back arm, then head, then striking arm make the silhouette clear in either direction.
    limb(g,[[-25,-120],[-39,-91-stride*8],[-27,-73-stride*10]],agi?skin:fabric,agi?12:17);
    ellipse(g,2,-158,29,30,player?skin:'#303e51','#0a0d18',5);
    if(player){
      if(vlad){shape(g,[[-29,-160],[-33,-179],[-23,-185],[-19,-196],[-8,-192],[2,-199],[10,-190],[20,-190],[30,-176],[26,-151],[18,-171],[7,-176],[-4,-168],[-14,-174],[-19,-156]],'#59402f');
        shape(g,[[-12,-145],[-5,-150],[3,-147],[11,-150],[20,-143],[7,-140],[-1,-142]],'#674334',null);
        shape(g,[[-7,-135],[13,-136],[8,-124],[0,-123]],'#674334',null);
      } else {shape(g,[[-29,-159],[-31,-178],[-12,-193],[8,-191],[29,-174],[29,-151],[16,-173],[-1,-180],[-15,-158]],'#f2cd6e');g.strokeStyle='#fff0b3';g.lineWidth=4;g.beginPath();g.moveTo(-17,-179);g.quadraticCurveTo(-32,-134,-26,-98);g.stroke();}
      g.fillStyle='#141b28';g.fillRect(-6,-160,5,5);g.fillRect(15,-160,5,5);g.strokeStyle='#614135';g.lineWidth=2;g.beginPath();g.moveTo(8,-156);g.lineTo(11,-148);g.lineTo(7,-147);g.stroke();
      g.strokeStyle=vlad?'#553b32':'#b16165';g.lineWidth=2;g.beginPath();g.moveTo(4,-138);g.lineTo(14,-140);g.stroke();
    }else{
      shape(g,[[-28,-168],[26,-169],[31,-145],[-24,-144]],'#192536');g.fillStyle=accent;g.shadowColor=accent;g.shadowBlur=12;g.fillRect(-18,-159,40,5);g.shadowBlur=0;
      if(kind==='grunt')shape(g,[[-15,-185],[-13,-205],[-2,-193],[7,-204],[15,-181]],accent);
      if(boss){shape(g,[[-31,-172],[-42,-194],[-17,-188],[0,-201],[20,-187],[38,-193],[31,-169]],'#667484');g.fillStyle=accent;g.fillRect(-4,-190,9,12);}
    }
    const handX=punch?91:special?61:35-stride*9, handY=punch?-117:special?-174:-80+stride*10;
    limb(g,[[25,-119],[punch?53:special?46:42,punch?-119:special?-141:-98],[handX,handY]],agi?skin:fabric,agi?13:18);
    ellipse(g,handX+4,handY,agi?10:13,agi?11:13,player?skin:'#455c70','#090d19',4);
    if(shield){ellipse(g,43,-96,27,43,'#203345','#090c17',5);ellipse(g,43,-96,20,33,'#58839477',accent,3);g.fillStyle=accent;g.fillRect(39,-116,8,39);}
    if(ranger){shape(g,[[handX+1,handY-8],[handX+40,handY-8],[handX+42,handY+2],[handX+16,handY+4],[handX+13,handY+18],[handX+3,handY+16]],'#3d5062');g.fillStyle=accent;g.fillRect(handX+34,handY-7,8,7);}
  }
  function enemy(e,camera) {
    const bossKinds=['warden','juggernaut','archon'],normalKinds=['grunt','shield','ranger'];
    const boss=bossKinds.includes(e.kind),row=(boss?bossKinds:normalKinds).indexOf(e.kind);
    const motion=e.kind==='grunt'&&assets.enforcerMotion;
    const img=motion||assets[boss?'bosses':'enemies'];
    const sheet=row>=0?spriteInfo(img,3,4,motion?(assets.animationMeta?.enforcerMotion||ANIMATION_META.enforcerMotion):null):null;
    const action=enemyAnimation(e);
    g.save();g.translate(e.x-camera,e.y-finite(e.z));
    if(e.dead){
      g.globalAlpha=.9*(1-clamp((finite(e.deadTime)-.25)/.55,0,1));
    }
    else if(e.spawnTime>0)g.globalAlpha=clamp(1-e.spawnTime/.45,.08,1);
    if(sheet){
      // Enemy artwork faces left; heroes face right. Mirror only for a right-facing enemy.
      g.scale(e.face<0?1:-1,1);
      const index=motion?(e.dead?10:action.frame):row*4+action.column,f=sheet.frames[index],metric=sheet.rowMetrics[row];
      const size=motion?sheet.scale:(boss?260:e.kind==='shield'?220:210)/metric.span;
      const frameMeta=sheet.metadata?.frames?.[index];
      const anchorX=motion?finite(frameMeta?.anchorX,sheet.anchorX):sheet.cw/2,baseline=motion?finite(frameMeta?.baseline,sheet.baseline):metric.baseline;
      const recoil=action.recoil||0,landing=clamp(finite(e.landingTime)/.12,0,1);
      const drawX=(f.left-anchorX)*size,drawY=(f.top-baseline)*size,drawW=f.w*size,drawH=f.h*size;
      const source=f.image||img,sx=f.image?0:f.x,sy=f.image?0:f.y;
      let fall=e.dead?clamp(finite(e.deadTime)/.23,0,1):finite(action.tumble);
      if(motion&&!e.dead)fall=action.pose==='launched'?.13:0;
      if(fall>0){
        const restingAngle=motion?.72:e.kind==='shield'||e.kind==='juggernaut'?.7:e.kind==='ranger'?.98:1.06;
        const angle=fall*restingAngle,c=Math.cos(angle),s=Math.sin(angle);
        const bottom=Math.max(...[drawX,drawX+drawW].flatMap(x=>[drawY,drawY+drawH].map(y=>x*s+y*c)));
        // Falling bodies rest on the surface instead of rotating through it.
        g.translate(0,-bottom);g.rotate(angle);
      }
      const winding=action.pose==='windup',anticipation=winding?finite(action.progress):0;
      const settling=action.pose==='getup'?(1-finite(action.progress))*.16:0;
      const compression=landing*.09+recoil*.075+anticipation*.055+settling;
      g.transform(1,0,(finite(action.lean)-recoil*16)/(boss?260:214),1,0,0);
      g.scale(1+compression*.55,1-compression);
      if(!motion&&action.pose==='run'&&!settings.reducedMotion){
        // The legacy shield/ranger/boss sheets have two locomotion keys. Their
        // lower limbs articulate around the hips between those keys; the torso
        // and painted face remain stable, and feet plant on every half stride.
        const stride=Math.sin(finite(e.runCycle,finite(e.animTime)*9)),hipY=-drawH*.43;
        const splitY=clamp((hipY-drawY)/size,0,f.h),splitX=clamp((0-drawX)/size,0,f.w);
        for(const [left,width,sign] of [[0,splitX,-1],[splitX,f.w-splitX,1]]){
          if(width<=0||splitY>=f.h)continue;
          g.save();g.translate(sign*13,hipY);g.rotate(stride*.105*sign);g.translate(-sign*13,-hipY);
          g.drawImage(source,sx+left,sy+splitY,width,f.h-splitY,drawX+left*size,hipY,width*size,(f.h-splitY)*size);g.restore();
        }
        g.drawImage(source,sx,sy,f.w,Math.min(f.h,splitY+3),drawX,drawY,drawW,Math.min(f.h,splitY+3)*size);
      }else g.drawImage(source,sx,sy,f.w,f.h,drawX,drawY,drawW,drawH);
      if(winding){
        const pulse=anticipation>.78?1:.55,yy=-drawH-17;
        g.save();g.globalAlpha*=pulse;
        const color=e.kind==='ranger'||e.kind==='archon'?'#ffb4e9':'#ffe7a0';
        // The tell grows with the real windup window and vanishes on contact.
        text(g,'!',0,yy,20+anticipation*11,color);
        if(anticipation>.6){g.strokeStyle=color;g.lineWidth=2;for(const sign of [-1,1]){g.beginPath();g.moveTo(sign*12,yy-6);g.lineTo(sign*20,yy-12);g.stroke();}}
        g.restore();
      }
    }else{g.scale(e.face<0?-1:1,1);humanoid(e);}
    g.restore();
  }
  function trails(e,camera) {
    if(e.dead)return;
    const player=e.kind==='agi'||e.kind==='vlad',action=player?heroAnimation(e):enemyAnimation(e);
    const special=e.pose==='special',a=e.attack;
    const specialAge=finite(a?.age,finite(e.animTime));
    const strength=special?clamp(1-Math.abs(specialAge-.16)/.17,0,1):finite(action.trail);
    if(strength<=0)return;
    const face=e.face<0?-1:1,x=e.x-camera,y=e.y-finite(e.z)-95, color=a?.counter?'#fff0a6':e.kind==='agi'?'#e0a2ff':e.kind==='vlad'?'#92f4ff':'#ff839f';
    g.save();g.translate(x,y);g.scale(face,1);g.globalCompositeOperation='screen';
    if(special) {
      g.globalAlpha=strength*.14;ellipse(g,5,-8,100,62,color);
      g.globalAlpha=strength*.75;g.strokeStyle=color;g.lineWidth=3;g.beginPath();g.arc(0,-6,77,-.7+specialAge*11,2.2+specialAge*11);g.stroke();
    }else{
      const heavy=action.stage===3||e.attackKind==='charge';
      g.globalAlpha=strength*(settings.reducedMotion?.2:.7);
      shape(g,heavy?[[16,26],[77,-42],[118,-37],[63,22]]:[[30,-10],[100,-23],[127,-15],[65,-4]],'#fff2d5',null);
      g.globalAlpha=strength*.42;g.strokeStyle=color;g.lineWidth=heavy?6:3;g.lineCap='round';g.beginPath();
      g.moveTo(9,heavy?36:-5);g.quadraticCurveTo(62,heavy?-35:-21,118,heavy?-38:-14);g.stroke();
    }
    g.restore();
  }
  function particle(e,camera) {
    const ratio=clamp(finite(e.life)/Math.max(.01,finite(e.maxLife,.5)),0,1), progress=1-ratio, x=e.x-camera;
    const y=e.y-finite(e.z)-(['hit','slash'].includes(e.kind)?60:0),color=e.color||'#ffe993';
    g.save();g.translate(x,y);g.globalAlpha=ratio;
    if(e.kind==='ring'||e.kind==='burst'||e.kind==='spawn'){g.globalCompositeOperation='screen';ellipse(g,0,0,20+progress*130,(20+progress*130)*.45,'#00000000',color,Math.max(1,ratio*9));}
    else if(e.kind==='heal'){text(g,'+',0,-progress*42,32,'#9cffbf');}
    else if(e.kind==='dust'){
      g.globalAlpha=ratio*.35;g.strokeStyle='#c8e1e9';g.lineWidth=1.5;
      for(const direction of [-1,1]){g.beginPath();g.moveTo(direction*(8+progress*12),0);g.quadraticCurveTo(direction*(20+progress*20),-8*ratio,direction*(30+progress*27),-2);g.stroke();}
    }
    else if(e.kind==='prop-break'){
      const metal=e.propKind!=='crate';
      for(let i=0;i<9;i++){
        const angle=(i/9)*TAU,speed=35+noise(finite(e.id)+i)*48;
        const xx=Math.cos(angle)*progress*speed,yy=Math.sin(angle)*progress*speed*.3-Math.sin(progress*Math.PI)*35;
        g.save();g.translate(xx,yy);g.rotate(progress*(i%2?4:-5));
        shape(g,[[-6,-4],[5,-6],[9,3],[-4,5]],metal?(i%2?'#889aab':color):(i%2?'#ba8b60':'#6f5144'),'#11172b',2);g.restore();
      }
    }
    else if(e.kind==='dodge'){for(let i=0;i<4;i++){g.strokeStyle='#8af3ff';g.lineWidth=3;g.beginPath();g.moveTo(-20-i*17,0+i*6);g.lineTo(-65-i*17,0+i*6);g.stroke();}}
    else {
      const heavy=e.strength==='heavy',rays=e.kind==='slash'?4:heavy?8:5,reach=heavy?70:43;
      for(let i=0;i<rays;i++){const a=i*TAU/rays+noise(finite(e.id)+i)*.6,r=8+progress*reach;g.strokeStyle=i%2?'#fff5cf':color;g.lineWidth=(heavy?2:1)+ratio*3;g.beginPath();g.moveTo(Math.cos(a)*r*.6,Math.sin(a)*r*.6);g.lineTo(Math.cos(a)*r,Math.sin(a)*r);g.stroke();}
      if(progress<.23){g.scale(heavy?1.35:1,heavy?1.35:1);shape(g,[[-16,-23],[-3,-8],[18,-15],[10,1],[24,13],[5,10],[-6,25],[-9,8],[-25,4],[-12,-4]],'#fff8d9','#1c1435',2);}
    }
    g.restore();
  }
  function pickup(e,camera) {const bob=settings.reducedMotion?0:Math.sin(time*4+finite(e.id))*5,color=e.kind==='health'?'#8effb2':e.kind==='energy'?'#8cddff':'#ffd98b';g.save();g.translate(e.x-camera,e.y-finite(e.z)-18+bob);g.rotate(Math.sin(time*2)*.08);g.shadowColor=color;g.shadowBlur=15;shape(g,[[-14,-14],[14,-14],[17,12],[-17,12]],'#17263f',color,3);g.shadowBlur=0;text(g,e.kind==='health'?'+':e.kind==='energy'?'ϟ':'◆',0,0,23,color);g.restore();}
  function bars(e,camera) {
    if(e.dead||e.hp>=e.maxHp||e.boss||e.kind==='vlad'||e.kind==='agi')return;
    const x=e.x-camera,w=46,y=e.y-finite(e.z)-237;
    g.save();g.lineCap='round';
    for(const [width,color,end] of [[11,'#17101e',w],[7,'#fff0ce',w],[5,'#ec626a',w*clamp(e.hp/e.maxHp,0,1)]]){
      g.beginPath();g.moveTo(x-w/2,y);g.lineTo(x-w/2+end,y);g.lineWidth=width;g.strokeStyle=color;g.stroke();
    }
    g.restore();
  }
  function readEvents(state) {
    if(!state)return;
    if(state.elapsed<lastElapsed){lastEvent=0;shakeTime=0;}lastElapsed=state.elapsed;
    for(const ev of state.events||[])if(ev.id>lastEvent){lastEvent=ev.id;if(['hit','special','duo','boss'].includes(ev.type)){
      const heavy=ev.strength==='heavy';shakeTime=ev.type==='duo'?.22:ev.type==='special'?.16:heavy?.13:.075;
      shakePower=ev.type==='duo'?7:ev.type==='special'?5:heavy?3.5:1.5;shakeClock=0;
    }}
  }
  function draw(state=null,dt=1/60) {
    if(dead||!g)return;
    const delta=clamp(finite(dt,1/60),0,.08);time=state?finite(state.simulationTime,state.elapsed):time+delta;
    readEvents(state);shakeTime=Math.max(0,shakeTime-delta);shakeClock+=delta;
    g.setTransform(1,0,0,1,0,0);g.fillStyle='#050914';g.fillRect(0,0,canvas.width,canvas.height);
    g.setTransform(scale,0,0,scale,offsetX,offsetY);g.save();g.beginPath();g.rect(0,0,W,H);g.clip();
    if(settings.shake&&!settings.reducedMotion&&shakeTime>0){const decay=clamp(shakeTime/.12,0,1);g.translate(Math.sin(shakeClock*125)*shakePower*decay,Math.cos(shakeClock*94)*shakePower*decay*.42);}
    const stage=clamp(Math.floor(finite(state?.stage)),0,2),camera=finite(state?.cameraX),clock=settings.reducedMotion?0:time;
    backdrop(stage,camera,clock);
    const actors=[...(state?.enemies||[]),...(state?.players||[])].filter(e=>finite(e.x)-camera>-220&&finite(e.x)-camera<W+220);
    const partner=duoPartner(state,camera);if(partner)actors.push(partner);
    const platforms=state?.platforms||[],props=state?.props||[];
    for(const e of state?.hazards||[])hazard(e,camera,stage);
    if(state?.arena?.active){g.save();g.strokeStyle='#ff6c9b77';g.lineWidth=2;g.setLineDash([6,10]);for(const x of [state.arena.left,state.arena.right]){g.beginPath();g.moveTo(x-camera,470);g.lineTo(x-camera,680);g.stroke();}g.restore();}
    const entries=worldDrawOrder(actors,platforms,props,state?.pickups||[]);
    for(const {type,entity:e} of entries){
      if(type==='platform'||type==='prop'){worldObject(e,camera,stage,type==='prop');continue;}
      if(type==='pickup'){pickup(e,camera);continue;}
      if(e.hologram){partnerHologram(e,camera);continue;}
      groundMark(e,camera,clock);trails(e,camera);
      if(e.kind==='vlad'||e.kind==='agi')hero(e,camera);else enemy(e,camera);bars(e,camera);
    }
    for(const e of state?.hazards||[])hazard(e,camera,stage,true);
    if(partner)duoTrails(partner,camera);
    for(const p of state?.projectiles||[]){g.save();g.globalCompositeOperation='screen';const x=p.x-camera,y=p.y-finite(p.z);g.strokeStyle='#ff789f';g.lineWidth=5;g.beginPath();g.moveTo(x-Math.sign(p.vx||1)*28,y);g.lineTo(x,y);g.stroke();ellipse(g,x,y,8,5,'#fff2bd');g.restore();}
    for(const e of state?.effects||[])particle(e,camera);
    if(!state){const titleHeroes=[{id:1,kind:'vlad',x:515,y:610,z:0,pose:'idle',face:1,hp:100,maxHp:100},{id:2,kind:'agi',x:745,y:610,z:0,pose:'idle',face:-1,hp:100,maxHp:100}];for(const e of titleHeroes){groundMark(e,0,clock);hero(e,0);}}
    foreground(stage,camera);rain(stage,clock);
    const shade=g.createLinearGradient(0,0,0,H);shade.addColorStop(0,'#05091770');shade.addColorStop(.17,'#05091700');shade.addColorStop(.84,'#05091700');shade.addColorStop(1,'#05091760');g.fillStyle=shade;g.fillRect(0,0,W,H);
    g.restore();
  }
  return {draw,resize,prepareAssets,setOptions(next={}){settings={...settings,...next};},destroy(){dead=true;observer?.disconnect();},
    // Useful for consistent mouse/touch interactions if the shell ever needs world-space targeting.
    toLogical(clientX,clientY){const r=canvas.getBoundingClientRect(),sx=canvas.width/Math.max(1,r.width),sy=canvas.height/Math.max(1,r.height);return{x:((clientX-r.left)*sx-offsetX)/scale,y:((clientY-r.top)*sy-offsetY)/scale};}};
}
