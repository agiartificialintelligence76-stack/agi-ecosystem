import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// The versioned 512px sprites have a clean clothing row at y500. Atlas remnants
// and transparent padding below it otherwise expose a colored stripe in a PFP.
// Keep every pixel through that row in place, including all original AGI print
// (its lowest checked edge is y498), then extend that row to the canvas bottom.
export async function finishCharacterEdge(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== 512 || info.height !== 512) throw new Error('Character edge finishing expects a 512px square sprite.');
  const cleanRow = 500, stride = info.width * 4;
  for (let y = cleanRow + 1; y < info.height; y++) {
    data.copy(data, y * stride, cleanRow * stride, (cleanRow + 1) * stride);
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const file of process.argv.slice(2)) {
    const png = await finishCharacterEdge(file);
    await writeFile(file, png);
    console.log(`${file}: retained rows 0–500; extended clean row through 511`);
  }
}
