import fs from 'node:fs/promises';
import sharp from 'sharp';
import { recolorPixels } from '../../src/pfp/engine.js';

const destination = 'output/pfp-contour-repair/a';
await fs.mkdir(destination, { recursive: true });
for (let character = 0; character < 16; character++) {
  const source = await sharp(`public/pfp/v1/character-${character}.png`).ensureAlpha().raw().toBuffer();
  const layers = [];
  for (const [column, hair] of [1, 12, 11, 6].entries()) {
    const data = recolorPixels(Buffer.from(source), { character, hair, outfit: hair === 1 ? 0 : 4 });
    const png = await sharp(data, { raw: { width: 512, height: 512, channels: 4 } })
      .extract({ left: 100, top: 100, width: 330, height: 280 }).resize(660, 560, { kernel: 'nearest' }).png().toBuffer();
    layers.push({ input: png, left: column * 660, top: 30 });
    layers.push({ input: Buffer.from(`<svg width="660" height="30"><text x="8" y="20" fill="white">${character}: ${['Source','Electric violet','Moonlight','Chocolate'][column]}</text></svg>`), left: column * 660, top: 0 });
  }
  await sharp({ create: { width: 2640, height: 590, channels: 4, background: '#252530' } }).composite(layers).png().toFile(`${destination}/face-${character}.png`);
}
