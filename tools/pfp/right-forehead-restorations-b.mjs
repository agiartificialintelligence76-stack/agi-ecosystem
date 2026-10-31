// Source-only offline restoration of the separate right forehead valley.
// Each box starts at the reviewed dark-peach apex, below hair parting seams.
import {rgbToHsl} from '../../src/pfp/engine.js';
const boxes={
 16:[308,111,350,168],17:[307,146,357,187],18:[301,140,356,193],19:[309,150,352,189],
 20:[289,123,347,177],21:[303,165,354,213],22:[291,142,351,193],23:[325,173,373,209],
 24:[337,153,378,213],25:[288,130,345,180],26:[290,129,358,179],27:[308,118,367,175],
 28:[306,124,350,187],29:[317,128,375,177],30:[313,136,380,198],31:[309,139,373,204],
};
export function restoreRightForeheadB(source,mask,character){
 const kept=Uint8Array.from(mask),[x0,y0,x1,y1]=boxes[character],allowed=new Uint8Array(mask.length),seen=new Uint8Array(mask.length),queue=[];
 for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
  const p=y*512+x,o=p*4,[h,s]=rgbToHsl(...source.subarray(o,o+3));
  if(character===17&&y<160&&x>315+(y-146)*.9)continue;
  if(h<34.5&&s>.15){allowed[p]=1;if(mask[p]){seen[p]=1;queue.push(p);}}
 }
 for(let i=0;i<queue.length;i++)for(const p of[queue[i]-1,queue[i]+1,queue[i]-512,queue[i]+512])if(allowed[p]&&!seen[p]){seen[p]=1;queue.push(p);}
 // The reviewed valley is a single span per row. Preserve source skin
 // highlights and eyebrow pixels between the connected contour samples.
 let previousRight=-1;
 for(let y=y0;y<=y1;y++){
  const row=[];for(let x=x0;x<=x1;x++)if(seen[y*512+x])row.push(x);
  if(row.length){
   // The source bang edge advances rightward down each reviewed valley.
   // Keep warm mixed skin samples across small texture-induced hue gaps.
   const right=Math.max(previousRight,row.at(-1));previousRight=right;
   for(let x=row[0];x<=right;x++)kept[y*512+x]=1;
  }
 }
 return kept;
}
