// REAL OR AI?'s pictures (2026-11-08): turns the source squares into the game's WebP files and its manifest.
//   node tools/games/realorai/build-pictures.mjs <source dir>
// <source dir> holds the squares named in tools/games/realorai/pictures.json (`src`): the real photos (CC0 photos from
// Wikimedia Commons, first published on Unsplash; their photographers in `credit`) and the AI-made pictures (made with an
// image model in ChatGPT for this game). Each picture becomes public/games/realorai/p/<id>.webp (960 × 960, no camera
// metadata; an AI-made one carries the IPTC "Digital Source Type" tag saying so, like AGI Studio's downloads), its id a
// short scramble of its key so the file names never tell which is which, and src/games/realorai/pictures.js lists them
// all (sorted by id, so the order doesn't tell either).
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const srcDir = process.argv[2];
if (!srcDir || !existsSync(srcDir)) { console.error('usage: node tools/games/realorai/build-pictures.mjs <source dir>'); process.exit(1); }
const list = JSON.parse(readFileSync(new URL('./pictures.json', import.meta.url), 'utf8'));
const XMP = `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about="" xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/" xmlns:dc="http://purl.org/dc/elements/1.1/"
 Iptc4xmpExt:DigitalSourceType="http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia">
<dc:description><rdf:Alt><rdf:li xml:lang="x-default">AI-made picture for REAL OR AI? (agi1.app/games/realorai)</rdf:li></rdf:Alt></dc:description>
</rdf:Description></rdf:RDF></x:xmpmeta>
<?xpacket end="r"?>`;
const idOf = (key) => createHash('sha256').update(`agi-realorai:${key}`).digest('hex').replace(/[^a-z]/g, '').slice(0, 2)
  + parseInt(createHash('sha256').update(`n:${key}`).digest('hex').slice(0, 6), 16).toString(36).slice(0, 3);
const outDir = join(ROOT, 'public/games/realorai/p');
mkdirSync(outDir, { recursive: true });
for (const f of readdirSync(outDir)) if (f.endsWith('.webp')) unlinkSync(join(outDir, f));
const ids = new Set();
const out = [];
for (const p of list) {
  const id = idOf(p.key);
  if (ids.has(id)) throw new Error(`id clash: ${p.key}`);
  ids.add(id);
  let img = sharp(join(srcDir, p.src)).rotate().resize(960, 960, { fit: 'cover' }).toColourspace('srgb');
  if (p.ai) img = img.withXmp(XMP);
  await img.webp({ quality: 78, effort: 6, smartSubsample: true }).toFile(join(outDir, `${id}.webp`));
  const e = { id, file: `/games/realorai/p/${id}.webp`, ai: p.ai, level: p.level, topic: p.topic, title: p.title, clues: p.clues || [] };
  if (p.note) e.note = p.note;
  e.credit = p.ai ? 'AI-made picture' : p.credit;
  out.push(e);
}
out.sort((a, b) => a.id.localeCompare(b.id));
const js = `// REAL OR AI?'s pictures: made by tools/games/realorai/build-pictures.mjs from tools/games/realorai/pictures.json (don't edit
// by hand). Real ones: CC0 photos from Wikimedia Commons (first published on Unsplash), their photographers in \`credit\`.
// AI-made ones: made with an image model for this game. No people in any of them. \`clues\`: x, y and r are fractions of the
// picture; for an AI-made one what gives it away, for a real one what shows it's real.
export const PICTURES = ${JSON.stringify(out, null, 1).replace(/\n\s*/g, ' ').replace(/\{ "id"/g, '\n  { "id"').replace(/\] *$/, '\n]')};
`;
writeFileSync(join(ROOT, 'src/games/realorai/pictures.js'), js);
const total = readdirSync(outDir).reduce((s, f) => s + readFileSync(join(outDir, f)).length, 0);
console.log(`✓ ${out.length} pictures (${out.filter((p) => p.ai).length} AI-made), ${(total / 1e6).toFixed(1)} MB`);
