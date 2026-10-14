// "With AGI-1" (2026-10-13, AGI Studio: the owner's "Her 2D anime self"): the two pictures of AGI-1 the AI services get when
// she joins an influencer's photo or video, made once here from the owner's own 2D art (the front's cutout,
// public/images/landing/agi1-cutout.webp: never the 3D model, never a render of her Live2D model):
//   server/media/agi1-with.jpg  her whole body, standing, on plain light grey (9:16, 864 × 1536): the picture she's drawn from
//   server/media/agi1-face.jpg  her head and shoulders, the "AGI" on her shirt in it (768 × 768): her face, for video models
// Our server only reads them (server/inf-agi1.js) and keeps a copy in the private bucket. Not part of the website.
// Run again only after the front's art changes:  node tools/studio/agi1-refs.mjs   (sharp: the site's own package)
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../../', import.meta.url));
const SRC = `${root}public/images/landing/agi1-cutout.webp`;
const GREY = { r: 233, g: 233, b: 238 }; // the plain light grey of the influencers' own full bodies
// Her head and shoulders in the cutout (796 × 1510): her hair's top at y 10, the "AGI" on her shirt at about y 360 to 395
export const FACE_BOX = { left: 165, top: 0, width: 470, height: 470 };
export const WITH_SIZE = { width: 864, height: 1536 };
export const FACE_SIZE = 768;

export async function makeRefs(src = SRC) {
  // Her whole body: trimmed to what's drawn (its see-through edges), as tall as 94% of the picture, in its middle
  const trimmed = await sharp(src).ensureAlpha().trim({ threshold: 1 }).png().toBuffer();
  const fitted = await sharp(trimmed)
    .resize({ width: Math.round(WITH_SIZE.width * 0.92), height: Math.round(WITH_SIZE.height * 0.94), fit: 'inside', kernel: 'lanczos3' })
    .png().toBuffer();
  const meta = await sharp(fitted).metadata();
  const withJpg = await sharp({ create: { ...WITH_SIZE, channels: 3, background: GREY } })
    .composite([{ input: fitted, left: Math.round((WITH_SIZE.width - meta.width) / 2), top: Math.round((WITH_SIZE.height - meta.height) / 2) }])
    .jpeg({ quality: 90, chromaSubsampling: '4:4:4' })
    .toBuffer();
  // Her head and shoulders: cut from the art as it is, made bigger (her face is about 150 px wide in it)
  const faceJpg = await sharp(src)
    .extract(FACE_BOX)
    .flatten({ background: GREY })
    .resize(FACE_SIZE, FACE_SIZE, { kernel: 'lanczos3' })
    .jpeg({ quality: 90, chromaSubsampling: '4:4:4' })
    .toBuffer();
  return { withJpg, faceJpg };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { withJpg, faceJpg } = await makeRefs();
  writeFileSync(`${root}server/media/agi1-with.jpg`, withJpg);
  writeFileSync(`${root}server/media/agi1-face.jpg`, faceJpg);
  console.log(`server/media/agi1-with.jpg: ${withJpg.length} bytes · server/media/agi1-face.jpg: ${faceJpg.length} bytes`);
}
