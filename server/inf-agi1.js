// AGI Studio's "With AGI-1" (2026-10-13, the owner's: "Her 2D anime self"): her two pictures for the AI services, made once
// from the owner's own 2D art by tools/studio/agi1-refs.mjs (never the 3D model, never a render of her Live2D model):
// server/media/agi1-with.jpg (her whole body: the picture she's drawn from, with an influencer's photo, meme, X banner or
// video) and server/media/agi1-face.jpg (her head and shoulders: a video model's element for her face). Read here only when a
// job with her is sent (light to load otherwise: Vercel's file tracer bundles them with the functions that load this file, by
// their `new URL(…, import.meta.url)`), kept in the studio's private bucket under a name made from their own bytes
// (agi1/with-<16 hex>.jpg: a new picture gets a new name, never an old one under it), and handed to the AI service as a
// short-lived signed address like everything else (never a public one).
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

let withJpg = null, faceJpg = null;
const withSource = () => (withJpg ??= readFileSync(new URL('./media/agi1-with.jpg', import.meta.url)));
const faceSource = () => (faceJpg ??= readFileSync(new URL('./media/agi1-face.jpg', import.meta.url)));
const hash16 = (bytes) => createHash('sha256').update(bytes).digest('hex').slice(0, 16);

// Their names in the bucket (server/studio-files.js NAME allows them)
export const agi1Names = () => ({ body: `agi1/with-${hash16(withSource())}.jpg`, face: `agi1/face-${hash16(faceSource())}.jpg` });

// One of them signed (6 hours), kept in the bucket first when it isn't there yet (its first job with her, or a new picture).
// F: server/studio-files.js (its signedUrl, putFile). → an https address · throws when Storage can't keep or sign it
async function signed(cfg, F, name, bytes) {
  let url = await F.signedUrl(cfg, name, { expiresIn: 6 * 3600 });
  if (url) return url;
  await F.putFile(cfg, name, bytes, 'image/jpeg');
  url = await F.signedUrl(cfg, name, { expiresIn: 6 * 3600 });
  if (!url) throw new Error('storage: AGI-1\'s picture couldn\'t be kept');
  return url;
}

// Her pictures' signed addresses for a job with her. face: also her head and shoulders (a video model's element).
// → { body, face? }
export async function agi1Urls(cfg, F, { face = false } = {}) {
  const names = agi1Names();
  const body = await signed(cfg, F, names.body, withSource());
  return face ? { body, face: await signed(cfg, F, names.face, faceSource()) } : { body };
}
