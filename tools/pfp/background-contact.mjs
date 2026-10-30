import sharp from 'sharp';
import { readdir, mkdir } from 'node:fs/promises';
const names = (await readdir('public/pfp/v1')).filter(name => name.endsWith('.webp')).sort();
const columns = 10, cell = 160, height = 184;
const composite = [];
for (const [i, name] of names.entries()) {
  const left = (i % columns) * cell, top = Math.floor(i / columns) * height;
  const input = await sharp(`public/pfp/v1/${name}`).resize(cell, cell).toBuffer();
  composite.push({ input, left, top });
  const label = Buffer.from(`<svg width="160" height="24"><text x="80" y="16" text-anchor="middle" font-family="sans-serif" font-size="10" fill="white">${name.replace('.webp','')}</text></svg>`);
  composite.push({ input: label, left, top: top + cell });
}
await mkdir('output/pfp', { recursive: true });
await sharp({ create: { width: columns * cell, height: Math.ceil(names.length / columns) * height, channels: 3, background: '#17131f' } }).composite(composite).jpeg({quality:90}).toFile('output/pfp/worlds-contact.jpg');
console.log(`${names.length} scenes on contact sheet.`);
