import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// Remove detached atlas fragments without moving or resampling any retained pixel.
// Opaque silhouette connectivity avoids joining portraits through barely visible
// generation noise; a small halo retains the original antialiased edge values.
export async function cleanCharacter(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const total = width * height;
  const labels = new Int32Array(total);
  const queue = new Int32Array(total);
  let label = 0, largest = 0, largestSize = 0;
  for (let start = 0; start < total; start++) {
    if (labels[start] || data[start * 4 + 3] < 128) continue;
    label++;
    let head = 0, tail = 1;
    queue[0] = start;
    labels[start] = label;
    while (head < tail) {
      const point = queue[head++], x = point % width, y = Math.floor(point / width);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || xx >= width || yy < 0 || yy >= height) continue;
        const next = yy * width + xx;
        if (!labels[next] && data[next * 4 + 3] >= 128) {
          labels[next] = label;
          queue[tail++] = next;
        }
      }
    }
    if (tail > largestSize) { largestSize = tail; largest = label; }
  }
  if (!largestSize) throw new Error('The character has no opaque silhouette.');
  const keep = new Uint8Array(total);
  for (let point = 0; point < total; point++) {
    if (labels[point] !== largest) continue;
    const x = point % width, y = Math.floor(point / width);
    for (let yy = Math.max(0, y - 3); yy <= Math.min(height - 1, y + 3); yy++) {
      for (let xx = Math.max(0, x - 3); xx <= Math.min(width - 1, x + 3); xx++) keep[yy * width + xx] = 1;
    }
  }
  let cleared = 0;
  for (let point = 0; point < total; point++) {
    if (!keep[point] && data[point * 4 + 3]) { data[point * 4 + 3] = 0; cleared++; }
  }
  const png = await sharp(data, { raw: { width, height, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer();
  return { png, cleared, width, height };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const file of process.argv.slice(2)) {
    const result = await cleanCharacter(file);
    await writeFile(file, result.png);
    console.log(`${file}: cleared ${result.cleared} detached pixels; kept ${result.width}x${result.height} coordinates`);
  }
}
