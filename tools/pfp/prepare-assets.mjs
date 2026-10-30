import sharp from 'sharp';
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';

// Reproduce the browser assets from the generated source images. Originals
// stay outside public/. This only crops, resizes and encodes; it does not repaint
// the artwork or change its alpha, colors, lettering, or character details.
// node tools/pfp/prepare-assets.mjs <nine-character-atlas> <extra-character-atlas> <room> <four-scenes> [world-scenes] [fantasy-scenes] [output-directory]
const [atlas, extra, room, scenes, world, fantasy, output = 'public/pfp/v1'] = process.argv.slice(2);
if (![atlas, extra, room, scenes].every(Boolean)) {
  throw new Error('Supply the nine-character atlas, three-character atlas, room, and four-scene atlas paths.');
}
await mkdir(output, { recursive: true });
const alpha = { r: 0, g: 0, b: 0, alpha: 0 };
const expected = [[atlas, 1254, 1254], [extra, 2172, 724], [room, 1254, 1254], [scenes, 1254, 1254]];
if (world) expected.push([world, 1254, 1254]);
if (fantasy) expected.push([fantasy, 1536, 1024]);
for (const [file, width, height] of expected) {
  const meta = await sharp(file).metadata();
  if (meta.width !== width || meta.height !== height) throw new Error(`Unexpected dimensions for ${path.basename(file)}; expected ${width} × ${height}.`);
}

// The generated atlas has uneven cell seams. These coordinates were checked
// against its alpha channel; an even 418px grid would clip hair and hat tops.
const rowCuts = [0, 425, 835, 1254];
const columnCuts = [[0, 441, 820, 1254], [0, 420, 862, 1254], [0, 440, 839, 1254]];
const cells = columnCuts.flatMap((columns, row) => columns.slice(0, 3).map((left, col) => ({
  file: atlas,
  box: { left, top: rowCuts[row], width: columns[col + 1] - left, height: rowCuts[row + 1] - rowCuts[row] },
})));
const extraCuts = [0, 738, 1450, 2172];
cells.push(...extraCuts.slice(0, 3).map((left, col) => ({ file: extra, box: { left, top: 0, width: extraCuts[col + 1] - left, height: 724 } })));

const report = [];
for (const [index, { file, box }] of cells.entries()) {
  const cropped = await sharp(file).extract(box).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data, info } = cropped;
  let left = info.width; let top = info.height; let right = 0; let bottom = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] < 64) continue;
      left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
  }
  // Preserve two pixels around soft edges. The alpha itself is untouched.
  left = Math.max(0, left - 2); top = Math.max(0, top - 2);
  right = Math.min(info.width - 1, right + 2); bottom = Math.min(info.height - 1, bottom + 1);
  const tight = { left: box.left + left, top: box.top + top, width: right - left + 1, height: bottom - top + 1 };
  const name = `character-${index}.png`;
  const fitted = await sharp(file).extract(tight)
    .resize(512, 488, { fit: 'contain', position: 'south', kernel: sharp.kernel.nearest, background: alpha })
    .png().toBuffer();
  await sharp(fitted).extend({ top: 24, bottom: 0, left: 0, right: 0, background: alpha })
    .png({ compressionLevel: 9, adaptiveFiltering: true, palette: false }).toFile(path.join(output, name));
  report.push({ name, crop: tight, bytes: (await stat(path.join(output, name))).size });
}

const backgrounds = [
  { name: 'room', file: room, box: { left: 0, top: 0, width: 1254, height: 1254 } },
  { name: 'rooftop', file: scenes, box: { left: 0, top: 0, width: 627, height: 627 } },
  { name: 'sakura', file: scenes, box: { left: 627, top: 0, width: 627, height: 627 } },
  { name: 'arcade', file: scenes, box: { left: 0, top: 627, width: 627, height: 627 } },
  { name: 'bedroom', file: scenes, box: { left: 627, top: 627, width: 627, height: 627 } },
];
if (world) {
  ['tokyo', 'paris', 'bali', 'egypt', 'aurora', 'future', 'moon', 'station', 'sky-garden'].forEach((name, index) => {
    backgrounds.push({ name, file: world, box: { left: (index % 3) * 418, top: Math.floor(index / 3) * 418, width: 418, height: 418 } });
  });
}
if (fantasy) {
  ['cosmos', 'ink-world', 'wind-world', 'crystal', 'ocean-sky', 'dream'].forEach((name, index) => {
    backgrounds.push({ name, file: fantasy, box: { left: (index % 3) * 512, top: Math.floor(index / 3) * 512, width: 512, height: 512 } });
  });
}
for (const { name, file, box } of backgrounds) {
  const filename = `${name}.webp`;
  await sharp(file).extract(box).resize(768, 768, { kernel: sharp.kernel.nearest })
    .webp({ quality: 85, effort: 6 }).toFile(path.join(output, filename));
  report.push({ name: filename, bytes: (await stat(path.join(output, filename))).size });
}
console.log(JSON.stringify({ output: path.resolve(output), totalBytes: report.reduce((sum, item) => sum + item.bytes, 0), files: report }, null, 2));
