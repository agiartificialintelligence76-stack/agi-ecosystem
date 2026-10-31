import fs from 'node:fs/promises';
import sharp from 'sharp';
import { recolorPixels } from '../../src/pfp/engine.js';
// Coordinates selected from source/three-palette full-face and 8–10× edge
// proofs, independently of the polygon generation predicates.
const edges={
16:[[356,218],[359,208],[353,218],[350,218]],17:[[358,242],[359,232],[355,242],[352,242]],
18:[[356,251],[360,241],[353,251],[350,251]],19:[[348,237],[351,227],[345,237],[342,237]],
20:[[345,240],[347,230],[342,240],[339,240]],21:[[344,254],[345,244],[341,254],[338,254]],
22:[[338,240],[338,230],[335,240],[332,230]],23:[[367,253],[367,243],[364,253],[361,243]],
24:[[372,240],[368,250],[369,240],[366,240]],25:[[335,234],[336,224],[332,234],[329,234]],
26:[[351,238],[350,228],[348,238],[344,228]],27:[[358,222],[358,212],[355,222],[352,212]],
28:[[344,219],[340,220],[338,220],[334,220]],29:[[363,229],[364,219],[360,229],[357,229]],
30:[[366,244],[367,234],[363,244],[361,234]],31:[[363,254],[365,244],[360,254],[357,254]],
};
const eyes=[[230,215],[238,238],[229,255],[220,235],[218,237],[236,253],[221,246],[268,253],[270,220],[208,230],[235,239],[244,223],[213,213],[243,228],[243,245],[247,250]];
const necks=[[275,340],[285,345],[275,345],[260,340],[260,330],[280,355],[268,340],[300,350],[275,350],[270,340],[290,350],[280,330],[240,295],[290,330],[275,320],[290,360]];
const wedges={
16:[[315,115],[338,151],[322,115]],17:[[315,150],[338,172],[322,149]],18:[[309,142],[335,177],[315,142]],19:[[316,151],[328,173],[322,151]],
20:[[295,125],[324,163],[301,125]],21:[[312,170],[333,201],[319,170]],22:[[301,146],[325,177],[308,146]],23:[[332,177],[349,194],[339,177]],
24:[[354,160],[366,194],[360,160]],25:[[296,133],[319,164],[302,133]],26:[[298,134],[323,163],[305,134]],27:[[317,123],[339,159],[324,123]],
28:[[317,129],[330,169],[323,129]],29:[[326,132],[340,160],[334,132]],30:[[323,140],[351,180],[330,140]],31:[[319,145],[345,189],[326,145]],
};
const extra={
18:[[240,180,'skin','Restored forehead outside old diagonal contour'],[235,195,'skin','Restored eyebrow ink'],[155,274,'skin','Ear shading']],
19:[[256,220,'skin','Peach opening between the two fringe tips']],
20:[[190,270,'skin','Restored left cheek/ear triangle'],[145,246,'skin','Ear shading']],
21:[[196,281,'skin','Ear lobe']],22:[[200,274,'skin','Restored lower-left cheek triangle']],
23:[[241,283,'skin','Soft cheek edge above jaw ink'],[211,275,'skin','Ear shading']],
25:[[172,270,'skin','Ear lobe'],[178,279,'skin','Restored bottom ear ink'],[178,280,'hair','Hair below ear outline']],26:[[207,269,'skin','Restored ear/cheek shadow']],
27:[[214,255,'skin','Restored cheek triangle'],[175,235,'skin','Ear lobe'],[177,244,'skin','Lower earlobe ink'],[177,247,'hair','Hair below earlobe ink'],[175,242,'skin','Lower ear ink'],[175,245,'hair','Warm hair below ear']],
31:[[182,293,'hair','Back hair below earlobe ink'],[182,288,'skin','Earlobe outline'],[274,215,'skin','Peach antialias gap inside fringe opening']],
};
const result={};
for(let c=16;c<32;c++){
 const source=await sharp(`public/pfp/v1/character-${c}.png`).ensureAlpha().raw().toBuffer();
 const points=[...edges[c].map(([x,y],i)=>[x,y,i<2?'hair':'skin',i<2?'Source hair outside right temple ink':'Right temple ink / adjacent face']),...wedges[c].map(([x,y],i)=>[x,y,i===2?'hair':'skin',i===2?'Hair alongside the separate right forehead valley':i===0?'Dark peach apex of right forehead valley':'Right eyebrow tip / adjacent forehead shading']),[...eyes[c-16],'skin','Iris and eye color remain original'],[...necks[c-16],'skin','Neck anatomy remains original'],...(extra[c]||[])];
 result[c]={reviewed:['forehead','leftTemple','rightTemple','ears','jaw','neck'],pixels:points.map(([x,y,material,note])=>({x,y,rgba:Array.from(source.subarray((y*512+x)*4,(y*512+x)*4+4)),material,note}))};
 for(const hair of[12,11,6]){
  const output=recolorPixels(Buffer.from(source),{character:c,hair,outfit:4});
  for(const p of result[c].pixels){const actual=Array.from(output.subarray((p.y*512+p.x)*4,(p.y*512+p.x)*4+4)),same=actual.every((v,i)=>v===p.rgba[i]);if((p.material==='skin'&&!same)||(p.material==='hair'&&same))throw Error(`Fixture ${c} ${p.x},${p.y} ${p.material} hair${hair}: ${p.rgba} -> ${actual}`);}
 }
}
await fs.writeFile('tools/pfp/contour-fixtures-b.json',JSON.stringify(result,null,2)+'\n');
console.log(`Verified ${Object.values(result).reduce((s,r)=>s+r.pixels.length,0)} independent source fixtures across three contrasting hair palettes.`);
