import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { cleanCharacter } from './clean-character.mjs';
import { finishCharacterEdge } from './finish-character-edges.mjs';

// Crop a generated 3x3 atlas at the quietest alpha seams and normalize portraits.
// Usage: node tools/pfp/prepare-characters.mjs <atlas.png> <first-character-index>
const [source, firstArg] = process.argv.slice(2);
const first = Number(firstArg);
if (!source || !Number.isInteger(first) || first < 0) throw new Error('Supply an atlas and first index.');
const {data,info} = await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const transparent = {r:0,g:0,b:0,alpha:0};
const out = 'public/pfp/v1';
await mkdir(out,{recursive:true});
function seam(axis, near, lo=0, hi=axis==='x'?info.height:info.width) {
  let winner=near, score=Infinity;
  for(let pos=near-8;pos<=near+8;pos++) {
    let sum=0;
    for(let step=lo;step<hi;step++) {
      const x=axis==='x'?pos:step,y=axis==='y'?pos:step;
      if(data[(y*info.width+x)*4+3]>96)sum++;
    }
    const value=sum+Math.abs(pos-near)*.08;
    if(value<score){score=value;winner=pos;}
  }
  return winner;
}
const rows=[0,seam('y',Math.round(info.height/3)),seam('y',Math.round(info.height*2/3)),info.height];
for(let row=0;row<3;row++) {
  const cols=[0,seam('x',Math.round(info.width/3),rows[row],rows[row+1]),seam('x',Math.round(info.width*2/3),rows[row],rows[row+1]),info.width];
  for(let col=0;col<3;col++) {
    const bounds={left:cols[col],top:rows[row],width:cols[col+1]-cols[col],height:rows[row+1]-rows[row]};
    const tile=await sharp(source).extract(bounds).png().toBuffer();
    const cropped=await sharp(tile).trim({threshold:10}).png().toBuffer();
    const sprite=await sharp(cropped).resize(512,488,{fit:'contain',position:'south',background:transparent,kernel:'nearest'}).png().toBuffer();
    const file=path.join(out,`character-${first+row*3+col}.png`);
    const framed=await sharp(sprite).extend({top:24,bottom:0,left:0,right:0,background:transparent}).png().toBuffer();
    const cleaned=await cleanCharacter(framed);
    await sharp(await finishCharacterEdge(cleaned.png)).toFile(file);
    console.log(file,JSON.stringify(bounds));
  }
}
