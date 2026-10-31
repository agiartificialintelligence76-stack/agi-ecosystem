import fs from 'node:fs/promises';
import sharp from 'sharp';
import {recolorPixels} from '../../src/pfp/engine.js';
// Independently selected source pixels from full-face and 10× boundary proofs.
// None of these coordinates are read from generated polygons or their masks.
const temple={
 32:[356,246,353,349],33:[392,248,388,384],34:[372,212,368,364],35:[368,222,365,361],
 36:[373,222,369,366],37:[372,226,369,365],38:[389,235,385,381],39:[364,232,359,356],
 40:[355,230,352,348],41:[335,237,330,327],42:[367,235,362,359],43:[359,240,354,351],
 44:[350,247,346,343],45:[360,212,354,350],46:[361,223,358,354],47:[342,225,339,336],
};
const bangs=[[269,224],[328,222],[283,194],[312,196],[306,201],[293,211],[307,218],[303,208],[253,206],[217,223],[319,182],[270,195],[249,222],[258,184],[271,207],[281,198]];
const foreheads=[[243,219],[287,198],[265,162],[260,163],[271,182],[271,179],[280,172],[257,162],[255,153],[208,194],[280,198],[276,155],[245,195],[259,148],[236,191],[237,171]];
const eyes=[[240,255],[285,235],[260,220],[250,225],[255,240],[255,235],[265,245],[235,232],[235,235],[207,252],[250,230],[240,228],[240,255],[232,215],[245,230],[215,240]];
const necks=[[272,333],[285,346],[286,302],[277,339],[288,345],[287,340],[299,320],[254,324],[271,340],[286,354],[256,328],[260,350],[260,343],[277,307],[281,332],[260,331]];
const extra={
 32:[[173,286,'skin','Visible ear shading']],
 33:[[212,256,'skin','Visible ear shading'],[392,255,'hair','Removed gold strip outside right cheek ink'],[382,255,'skin','Skin adjacent to removed cheek strip']],
 34:[[220,230,'hair','Reported sideburn block below outer lash'],[230,235,'skin','Cheek beside corrected sideburn'],[216,221,'skin','Full outer eyelash preserved after sideburn correction'],[360,166,'skin','Right upper eyelid slope below forehead'],[362,169,'skin','Right upper eyelid dark crease'],[364,172,'skin','Skin between source outer lash strokes'],[366,166,'hair','Gold bang outside upper eyelid slope']],
 35:[[181,254,'skin','Visible ear shading'],[246,295,'hair','Removed shaded hair outside left neck outline'],[251,295,'skin','Skin beside left neck outline'],[250,300,'skin','Full dark neck ink']],
 36:[[187,263,'skin','Visible ear shading'],[291,371,'skin','Golden light on true lower neckline']],
 37:[[361,255,'skin','Reported missing bright jaw antialias pixel'],[343,275,'skin','Reported missing bright jaw antialias pixel'],[368,235,'skin','Reported full jaw ink restored'],[266,340,'hair','Golden curl crossing left neck']],
 38:[[277,194,'skin','Restored left eyebrow ink'],[290,147,'hair','Warm hair shadow under knit hat remains hair'],[343,150,'skin','Right forehead upper shadow restored'],[350,155,'skin','Right forehead middle shadow restored'],[355,170,'skin','Right forehead lower shadow restored'],[352,150,'hair','Gold hair outside right forehead valley']],
 39:[[230,327,'hair','Hair tip crossing neck above helmet rim'],[237,328,'skin','Neck beside crossing hair tip'],[354,201,'skin','Continuous source upper eyelid skin slope'],[358,203,'skin','Shaded outer eyelid above lash'],[360,204,'skin','Outer eyelid skin antialiasing'],[361,201,'hair','Gold bang beyond upper eyelid slope']],
 40:[[165,255,'skin','Visible ear shading']],
 41:[[372,235,'skin','Visible ear shading'],[200,211,'skin','Restored eyebrow ink'],[276,145,'skin','Right forehead upper shadow restored'],[280,155,'skin','Right forehead middle shadow restored'],[290,170,'skin','Right forehead lower shadow restored'],[283,145,'hair','Gold hair immediately outside restored right wedge'],[328,260,'hair','Front lock crossing right cheek'],[321,260,'skin','Cheek beside crossing front lock'],[323,268,'skin','Cheek returns below tapered hair tip'],[330,268,'skin','Dark jaw ink beneath crossing lock']],
 42:[[174,230,'skin','Reported ear interior retained'],[174,232,'skin','Reported lower ear ink retained'],[166,228,'hair','Removed gold hair outside lower-left ear'],[182,205,'hair','Removed gold hair outside upper-right ear'],[180,220,'hair','Removed gold band outside right ear'],[161,212,'skin','Ear outer ink restored'],[234,306,'hair','Short curl crossing left neck'],[245,306,'skin','Neck next to crossing curl'],[346,145,'skin','Right forehead upper shadow restored'],[346,155,'skin','Right forehead middle shadow restored'],[352,165,'skin','Right forehead lower shadow restored'],[354,145,'hair','Gold hair outside right forehead shadow']],
 43:[[330,288,'hair','Shaded hair outside right jaw'],[330,277,'skin','True face above jaw ink'],[228,290,'hair','Short wisp crossing left upper-neck shadow'],[270,392,'skin','Gold-lit lower neckline skin'],[344,145,'skin','Right forehead upper shadow restored'],[345,155,'skin','Right forehead middle shadow restored'],[350,170,'skin','Right forehead lower shadow restored'],[350,145,'hair','Gold hair outside right forehead valley']],
 44:[[169,280,'skin','Visible ear shading']],
 45:[[318,120,'skin','Right forehead upper shadow restored'],[321,130,'skin','Right forehead middle shadow restored'],[330,140,'skin','Right forehead lower shadow restored'],[325,120,'hair','Gold hair outside right forehead shadow']],
 46:[[175,254,'skin','Visible ear shading'],[323,327,'skin','Right shoulder golden light remains skin']],
 47:[[151,251,'skin','Visible ear shading'],[342,235,'hair','Reported golden band outside right temple'],[337,235,'skin','Cheek next to reported temple band'],[339,235,'skin','Full dark source temple ink'],[298,130,'skin','Right forehead upper shadow restored'],[302,140,'skin','Right forehead middle shadow restored'],[310,150,'skin','Right forehead lower shadow restored'],[306,130,'hair','Gold hair outside right forehead shadow']],
};
const result={},failures=[];
const supplements=await Promise.all(['cheek-fixtures-c-from-b.json','forehead-fixtures-c.json','right-wedge-fixtures-c.json'].map(name=>fs.readFile(`tools/pfp/${name}`,'utf8').then(JSON.parse)));
for(let c=32;c<48;c++){
 const source=await sharp(`public/pfp/v1/character-${c}.png`).ensureAlpha().raw().toBuffer();
 const[x,y,ink,skin]=temple[c];
 const points=[[x,y,'hair','Shaded hair outside source right temple ink'],[...bangs[c-32],'hair','Golden bang tip beyond skin opening'],[ink,y,'skin','Source right temple ink'],[skin,y,'skin','Skin adjacent to right temple'],[...foreheads[c-32],'skin','Restored source forehead opening'],[...eyes[c-32],'skin','Eye region remains original'],[...necks[c-32],'skin','Neck anatomy remains original'],...(extra[c]||[])];
 result[c]={reviewed:['forehead','leftTemple','rightTemple','ears','jaw','neck'],pixels:points.map(([x,y,material,note])=>({x,y,rgba:Array.from(source.subarray((y*512+x)*4,(y*512+x)*4+4)),material,note}))};
 for(const supplement of supplements)for(const p of supplement[c]||[]){
  const original=Array.from(source.subarray((p.y*512+p.x)*4,(p.y*512+p.x)*4+4));
  if(!original.every((v,i)=>v===p.rgba[i]))throw Error(`Supplement source mismatch ${c} ${p.x},${p.y}`);
  if(!result[c].pixels.some(q=>q.x===p.x&&q.y===p.y))result[c].pixels.push(p);
 }
 for(const hair of[12,11,6]){
  const output=recolorPixels(Buffer.from(source),{character:c,hair,outfit:4});
  for(const p of result[c].pixels){const actual=Array.from(output.subarray((p.y*512+p.x)*4,(p.y*512+p.x)*4+4)),same=actual.every((v,i)=>v===p.rgba[i]);if((p.material==='skin'&&!same)||(p.material==='hair'&&same))failures.push(`Fixture ${c} ${p.x},${p.y} ${p.material} hair${hair}: ${p.rgba} -> ${actual}`);}
 }
}
if(failures.length)throw Error(failures.join('\n'));
await fs.writeFile('tools/pfp/contour-fixtures-c.json',JSON.stringify(result,null,2)+'\n');
console.log(`Verified ${Object.values(result).reduce((s,r)=>s+r.pixels.length,0)} independent source fixtures in three contrasting palettes.`);
