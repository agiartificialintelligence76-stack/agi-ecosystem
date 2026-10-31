import fs from 'node:fs/promises';
import sharp from 'sharp';
import { skinMask } from '../../src/pfp/skin-mask.js';
import { rgbToHsl } from '../../src/pfp/engine.js';

// Source-measured envelopes around the two forehead openings. This offline
// measurement follows the warm shadow valley inside each explicitly inspected
// opening; it never searches the full portrait or expands through a hat.
const envelopes = {
  1: [[[135,248,250],[150,242,251],[165,232,253],[180,222,253],[195,211,250]],[[118,310,313],[135,310,324],[150,309,333],[165,307,343],[180,302,349]]],
  2: [[[160,240,243],[175,235,247],[190,229,248],[205,219,247],[214,209,246]],[[145,300,303],[160,301,313],[175,300,324],[190,298,335],[198,294,341]]],
  3: [[[140,277,287],[150,264,287],[160,252,287],[170,242,286],[176,235,285]],[[148,343,347],[160,342,350],[175,337,354],[190,332,357],[198,327,358]]],
  4: [[[165,230,285],[175,223,283],[182,213,281]],[[140,330,333],[150,329,337],[165,325,342],[180,319,349]]],
  5: [[[143,242,245],[155,236,245],[170,225,245],[185,214,244],[200,205,242],[205,199,242]],[[123,294,297],[140,294,308],[155,293,319],[170,289,328],[180,285,335]]],
  6: [[[126,265,269],[140,256,267],[155,245,264],[165,236,261],[175,225,259],[181,216,257]],[[108,317,319],[125,316,328],[140,314,341],[155,309,349],[163,306,355]]],
  7: [[[146,248,252],[160,243,254],[175,234,254],[190,223,252],[200,214,250]],[[138,300,306],[150,300,315],[165,300,326],[180,297,337]]],
  8: [[[146,245,255],[155,236,255],[165,228,255],[175,220,253],[185,211,251],[191,204,249]],[[134,317,319],[145,315,323],[160,311,330],[175,305,341]]],
  9: [[[120,202,211],[130,200,207],[140,197,204],[150,195,202],[160,192,200],[170,188,205],[180,185,205],[185,182,200]],[[120,209,268],[130,208,273],[140,207,278],[150,207,283],[160,208,290]]],
  10: [[[147,210,213],[160,207,217],[175,202,225],[185,197,231],[195,191,235],[203,185,236]],[[121,278,283],[140,279,292],[155,277,304],[170,273,316],[178,269,321]]],
  11: [[[157,299,302],[175,292,303],[190,282,304],[200,272,304],[207,267,302],[213,261,302]],[[137,350,353],[150,350,360],[165,349,371],[180,345,382],[190,341,389]]],
  12: [[[155,270,273],[170,264,274],[185,258,276],[200,249,275],[210,241,273],[214,235,272]],[[138,322,325],[150,322,333],[165,322,340],[180,317,351],[190,312,358]]],
  13: [[[165,240,250],[175,236,251],[185,229,251],[195,220,251],[205,213,250]],[[139,305,308],[150,305,315],[165,304,325],[180,299,337],[187,295,340]]],
  14: [[[153,235,238],[165,231,239],[180,223,241],[195,211,241],[205,204,240],[211,198,238]],[[136,293,298],[150,294,306],[165,293,317],[180,288,329],[188,285,335]]],
  15: [[[145,267,270],[160,259,272],[175,249,274],[190,237,274],[200,228,272]],[[134,323,326],[145,323,334],[160,322,342],[175,318,353],[183,314,359]]],
};

const additions = {};
let previous = {};
try {
  const module = await fs.readFile('tools/pfp/forehead-restorations-a.mjs', 'utf8');
  previous = JSON.parse(module.match(/const spans = ([\s\S]*?);\n/)[1]);
} catch {}
for (const [key, openings] of Object.entries(envelopes)) {
  const character = Number(key);
  const source = await sharp(`public/pfp/v1/character-${character}.png`).ensureAlpha().raw().toBuffer();
  const existing = Uint8Array.from(skinMask(character));
  for (const [y, left, right] of previous[key] || []) {
    for (let x = left; x <= right; x++) existing[y * 512 + x] = 0;
  }
  const added = new Uint8Array(512 * 512);
  function shadow(x, y) {
    const i = (y * 512 + x) * 4;
    return source[i + 3] && rgbToHsl(source[i], source[i + 1], source[i + 2])[0] <= 35.5;
  }
  for (const [side, anchors] of openings.entries()) {
    for (let y = anchors[0][0]; y <= anchors.at(-1)[0]; y++) {
      let k = 1;
      while (anchors[k][0] < y) k++;
      const [y0, l0, r0] = anchors[k - 1], [y1, l1, r1] = anchors[k];
      const t = (y - y0) / (y1 - y0);
      const left = Math.round(l0 + (l1 - l0) * t), right = Math.round(r0 + (r1 - r0) * t);
      let l = Array.from({ length: 10 }, (_, j) => left - 4 + j).find(x => shadow(x, y) && shadow(x + 1, y));
      let r = Array.from({ length: 10 }, (_, j) => right + 4 - j).find(x => shadow(x, y) && shadow(x - 1, y));
      if (character === 9 && side === 0) { l = left; r = right; }
      if (character === 2 && side === 0 && y >= 195) {
        const contour = [[195,225],[200,222],[205,220],[210,216],[214,213]];
        let segment = 1;
        while (contour[segment][0] < y) segment++;
        const [ya, xa] = contour[segment - 1], [yb, xb] = contour[segment];
        l = Math.round(xa + (xb - xa) * (y - ya) / (yb - ya));
      }
      if (l === undefined || r === undefined || l > r) continue;
      const protectedXs = [];
      for (let x = l; x <= r; x++) if (existing[y * 512 + x]) protectedXs.push(x);
      // Keep the previously inspected inner bang contour. The missing skin is
      // on the outer diagonal and at the apex, not through the central strand.
      if (protectedXs.length) {
        if (side === 0) r = Math.min(r, protectedXs.at(-1));
        else l = Math.max(l, protectedXs[0]);
      }
      for (let x = l; x <= r; x++) {
        const p = y * 512 + x, i = p * 4;
        if (existing[p]) continue;
        // Look6 has a real narrow golden strand crossing the left eyebrow.
        // Keep that source strand; the other openings contain continuous skin.
        const [h, saturation] = rgbToHsl(source[i], source[i + 1], source[i + 2]);
        const crossingStrand = side === 0 && [1,2,6,7,9,10].includes(character)
          && h >= 38 && saturation > 0.35 && source[i + 2] < 125;
        if (!crossingStrand) added[p] = 1;
      }
    }
  }
  const eyebrowTips = {
    1: [219,176,228,184], 2: [214,198,222,205],
    6: [226,157,241,167], 7: [211,180,226,188],
    9: [186,166,216,174], 10: [185,187,198,194],
  };
  if (eyebrowTips[character]) {
    const [left, top, right, bottom] = eyebrowTips[character];
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
      const p = y * 512 + x, i = p * 4;
      if (!existing[p] && source[i] < 170 && source[i + 2] < 90 && shadow(x, y)) added[p] = 1;
    }
  }
  additions[key] = [];
  for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) if (added[y * 512 + x]) {
    const left = x;
    while (x + 1 < 512 && added[y * 512 + x + 1]) x++;
    additions[key].push([y, left, x]);
  }
}
await fs.writeFile('tools/pfp/forehead-restorations-a.mjs', `// Exact source-measured additions from measure-forehead-a.mjs.\nconst spans = ${JSON.stringify(additions, null, 2)};\n\nexport function refineForeheadA(character, source, mask) {\n  for (const [y, left, right] of spans[character] || []) {\n    for (let x = left; x <= right; x++) if (source[(y * 512 + x) * 4 + 3]) mask[y * 512 + x] = 1;\n  }\n  return mask;\n}\n`);
