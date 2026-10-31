import fs from 'node:fs/promises';
import sharp from 'sharp';
import { recolorPixels } from '../../src/pfp/engine.js';
const dir='output/pfp-boundary-fix/b/full-boundary-audit';
await fs.mkdir(dir,{recursive:true});
const palettes=[[1,0,'Source'],[12,4,'Electric violet / Forest'],[11,4,'Moonlight / Forest'],[6,4,'Chocolate / Forest']];
for(let c=16;c<32;c++){
 const source=await sharp(`public/pfp/v1/character-${c}.png`).ensureAlpha().raw().toBuffer(),tiles=[];
 for(let k=0;k<palettes.length;k++){
  const[hair,outfit,label]=palettes[k],data=recolorPixels(Buffer.from(source),{character:c,hair,outfit});
  const left=k%2*600,top=Math.floor(k/2)*668;
  tiles.push({input:await sharp(data,{raw:{width:512,height:512,channels:4}}).extract({left:110,top:100,width:300,height:320}).resize(600,640,{kernel:'nearest'}).flatten({background:'#252a32'}).png().toBuffer(),left,top:top+28});
  tiles.push({input:Buffer.from(`<svg width="600" height="28"><text x="8" y="20" fill="white" font-size="16">${c}: ${label} · crop x110–409 y100–419 · 2×</text></svg>`),left,top});
 }
 await sharp({create:{width:1200,height:1336,channels:3,background:'#191d25'}}).composite(tiles).png().toFile(`${dir}/look-${c}.png`);
}
