// Exhaustive palette invariants plus native-size, high-contrast review sheets.
// Run from the repository root: node tools/pfp/verify-boundaries.mjs [output-dir]
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { TRAITS, recolorPixels, rgbToHsl } from '../../src/pfp/engine.js';
import { skinMask } from '../../src/pfp/skin-mask.js';

const destination = path.resolve(process.argv[2] || 'output/pfp-boundary-fix/verified');
await fs.mkdir(destination, { recursive: true });
const report = { looks: TRAITS.character.length, hairColors: TRAITS.hair.length, outfitColors: TRAITS.outfit.length,
  combinations: 0, alphaFailures: 0, protectedColorFailures: 0, sourceHashes: {}, reviewSheets: [] };
const cases = [[1,0], [4,4], [11,6], [9,2]];
let sheets = [];
for (let character = 0; character < TRAITS.character.length; character++) {
  const file = await fs.readFile(`public/pfp/v1/character-${character}.png`);
  report.sourceHashes[character] = createHash('sha256').update(file).digest('hex');
  const source = await sharp(file).ensureAlpha().raw().toBuffer();
  const mask = skinMask(character);
  const protectedOffsets = [];
  for (let p = 0; p < mask.length; p++) {
    if (!source[p * 4 + 3]) continue;
    const [h,s] = rgbToHsl(source[p*4],source[p*4+1],source[p*4+2]);
    if (mask[p] === 1 || (mask[p] === 3 && !(h > 238 && h < 301 && s > .24))) protectedOffsets.push(p*4);
  }
  for (let hair = 0; hair < TRAITS.hair.length; hair++) for (let outfit = 0; outfit < TRAITS.outfit.length; outfit++) {
    const actual = recolorPixels(Buffer.from(source), { character, hair, outfit });
    for (let p = 3; p < actual.length; p += 4) {
      if (actual[p] !== source[p]) throw new Error(`Alpha changed on look ${character}/${hair}/${outfit}, pixel ${p/4}`);
    }
    for (const p of protectedOffsets) {
      if (actual[p] !== source[p] || actual[p+1] !== source[p+1] || actual[p+2] !== source[p+2]) {
        throw new Error(`Protected color changed on look ${character}/${hair}/${outfit}, pixel ${p/4}`);
      }
    }
    if (hair === 1 && outfit === 0) assert.deepEqual(actual, source, 'the original palette stays byte-identical');
    report.combinations++;
    const column = cases.findIndex(([h,o]) => h === hair && o === outfit);
    if (column !== -1) {
      const tile = await sharp(actual,{raw:{width:512,height:512,channels:4}}).flatten({background:'#292d36'}).png().toBuffer();
      const label = Buffer.from(`<svg width="512" height="24"><rect width="512" height="24" fill="#16191f"/><text x="8" y="17" fill="white" font-size="14">${character} · ${TRAITS.hair[hair].label} / ${TRAITS.outfit[outfit].label}</text></svg>`);
      sheets.push({input:label,left:column*512,top:(character%2)*536},{input:tile,left:column*512,top:(character%2)*536+24});
    }
  }
  if (character % 2 === 1) {
    const name = `looks-${character-1}-${character}.png`;
    await sharp({create:{width:2048,height:1072,channels:3,background:'#16191f'}}).composite(sheets).png().toFile(path.join(destination,name));
    report.reviewSheets.push(name); sheets = [];
  }
  console.log(`Verified look ${character+1}/48: all ${TRAITS.hair.length*TRAITS.outfit.length} palettes; skin and alpha unchanged.`);
}
await fs.writeFile(path.join(destination,'verification.json'), JSON.stringify(report,null,2)+'\n');
console.log(`PASS: ${report.combinations} complete portraits; ${report.reviewSheets.length} native-size review sheets.`);
