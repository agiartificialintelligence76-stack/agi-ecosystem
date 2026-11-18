import {drawAgi} from './figure.js';

const figureBuffers=new WeakMap();
const negativeBuffers=new WeakMap();
const PRINT_LIMIT=3;

function pixelRatio(target){
 const matrix=target.getTransform?.();
 return matrix ? Math.min(2,Math.max(.5,Math.hypot(matrix.a,matrix.b))) : 1;
}

function surface(target,width,height,reuse=null){
 if(typeof target.drawImage!=='function')return null;
 let image=reuse?.image;
 if(!image){
  const doc=target.canvas?.ownerDocument;
  if(doc?.createElement)image=doc.createElement('canvas');
  else if(typeof OffscreenCanvas!=='undefined')image=new OffscreenCanvas(width,height);
  else return null;
 }
 if(image.width!==width)image.width=width;
 if(image.height!==height)image.height=height;
 const ctx=reuse?.ctx||image.getContext('2d');
 return ctx?{image,ctx}:null;
}

// Full poses extend above and below the figure's floor origin. Allocate in
// 64-pixel steps so a walking subject can change depth without constant resizes.
export function figureLayer(target,height,scene){
 if(!(height>0))return null;
 const pixels=Math.min(960,Math.max(64,Math.ceil(height*1.22*pixelRatio(target)/64)*64));
 const width=Math.ceil(pixels*.77),layer=surface(target,width,pixels,figureBuffers.get(target));
 if(!layer)return null;
 figureBuffers.set(target,layer);
 const scale=pixels/1.22;
 layer.ctx.setTransform(1,0,0,1,0,0);
 layer.ctx.clearRect(0,0,width,pixels);
 drawAgi(layer.ctx,width/2,scale*1.12,scale,scene,scene.light);
 const destinationWidth=height*width/scale;
 return {draw(c,x,y){c.drawImage(layer.image,x-destinationWidth/2,y-height*1.12,destinationWidth,height*1.22);}};
}

// A negative contains frozen scene time, lens, pose and exact camera position.
// Reuse it while the developer changes color, in the spread and in the album.
export function negativeLayer(target,print,w,h,paint){
 if(typeof target.drawImage!=='function'||!(w>0&&h>0))return null;
 const ratio=Math.min(pixelRatio(target),1280/Math.max(w,h));
 const width=Math.max(1,Math.ceil(w*ratio)),height=Math.max(1,Math.ceil(h*ratio));
 let cache=negativeBuffers.get(target);
 if(!cache){cache=[];negativeBuffers.set(target,cache);}
 const key=print.recipe.key;
 const hit=cache.findIndex(q=>q.key===key&&q.width===width&&q.height===height&&q.w===w&&q.h===h);
 if(hit>=0){const entry=cache.splice(hit,1)[0];cache.push(entry);return entry.layer.image;}
 const reuse=cache.length===PRINT_LIMIT?cache.shift().layer:null;
 const layer=surface(target,width,height,reuse);
 if(!layer)return null;
 layer.ctx.setTransform(width/w,0,0,height/h,0,0);
 layer.ctx.clearRect(0,0,w,h);
 paint(layer.ctx);
 cache.push({key,width,height,w,h,layer});
 return layer.image;
}
