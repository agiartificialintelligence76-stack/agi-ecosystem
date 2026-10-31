import fs from 'node:fs/promises';
import sharp from 'sharp';
import {recolorPixels,TRAITS} from '../../src/pfp/engine.js';
const start=Number(process.argv[2]||0),end=Number(process.argv[3]||48);
const out='output/pfp-contour-repair';await fs.mkdir(out,{recursive:true});
for(let character=start;character<end;character++){
  const source=await sharp(`public/pfp/v1/character-${character}.png`).ensureAlpha().raw().toBuffer();
  for(const hair of [12,11,6]){
    const layers=[];
    for(let k=0;k<2;k++){
      const pixels=k?recolorPixels(Buffer.from(source),{character,hair,outfit:4}):source;
      const tile=await sharp(pixels,{raw:{width:512,height:512,channels:4}}).extract({left:90,top:55,width:360,height:360}).resize(720,720,{kernel:'nearest'}).flatten({background:'#282c34'}).png().toBuffer();
      const title=Buffer.from(`<svg width="720" height="28"><rect width="720" height="28" fill="#17191f"/><text x="8" y="20" fill="white" font-size="18">${character} ${k?TRAITS.hair[hair].label:'Source'}</text></svg>`);
      layers.push({input:title,left:k*720,top:0},{input:tile,left:k*720,top:28});
    }
    await sharp({create:{width:1440,height:748,channels:3,background:'#17191f'}}).composite(layers).png().toFile(`${out}/face-${character}-${hair}.png`);
  }
}
