import fs from 'node:fs/promises';
import sharp from 'sharp';
import {recolorPixels} from '../../src/pfp/engine.js';
const out='output/pfp-full-boundary-review/c';
await fs.mkdir(out,{recursive:true});
const variants=[['Source',0],['Electric violet',12],['Moonlight',11],['Chocolate',6]];
for(let n=32;n<48;n++){
 const source=await sharp(`public/pfp/v1/character-${n}.png`).ensureAlpha().raw().toBuffer(),layers=[];
 for(let v=0;v<4;v++){
  const data=v?recolorPixels(Buffer.from(source),{character:n,hair:variants[v][1],outfit:4}):source;
  const input=await sharp(data,{raw:{width:512,height:512,channels:4}}).extract({left:110,top:80,width:320,height:340}).resize(640,680,{kernel:'nearest'}).flatten({background:'#33363f'}).png().toBuffer();
  const left=v%2*640,top=Math.floor(v/2)*710;
  layers.push({input,left,top:top+30});
  layers.push({input:Buffer.from(`<svg width="640" height="30"><text x="12" y="22" fill="white" font-size="20">${n}: ${variants[v][0]} — crop x110,y80; 2×</text></svg>`),left,top});
 }
 await sharp({create:{width:1280,height:1420,channels:3,background:'#202328'}}).composite(layers).png().toFile(`${out}/face-${n}.png`);
}
