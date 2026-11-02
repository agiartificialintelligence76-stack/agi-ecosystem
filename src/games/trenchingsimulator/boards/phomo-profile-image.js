// Local profile artwork only. Never fetches a URL or uploads a selected file.
export const PROFILE_IMAGE_LIMITS = Object.freeze({ avatar: 256 * 1024, banner: 512 * 1024 });
const TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const validated = new Map();
function signature(bytes, type) {
  if (type === 'image/png') return bytes.length >= 24 && [137,80,78,71,13,10,26,10].every((n,i) => bytes[i] === n)
    && [73,72,68,82].every((n,i) => bytes[i + 12] === n);
  if (type === 'image/jpeg') return bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  return bytes.length >= 16 && [82,73,70,70].every((n,i) => bytes[i] === n)
    && [87,69,66,80].every((n,i) => bytes[i + 8] === n);
}
export function cleanProfileImage(value, kind) {
  const limit = PROFILE_IMAGE_LIMITS[kind];
  if (!limit || typeof value !== 'string' || !value || value.length > Math.ceil(limit / 3) * 4 + 32) return null;
  if (validated.get(value) <= limit) return value;
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || match[2].length % 4 !== 0) return null;
  try {
    const raw = atob(match[2]);
    if (raw.length > limit || !signature(Uint8Array.from(raw.slice(0,24), c => c.charCodeAt(0)), match[1])) return null;
    validated.set(value, raw.length);
    if (validated.size > 4) validated.delete(validated.keys().next().value);
    return value;
  } catch { return null; }
}
export function cleanProfileX(value) {
  if (typeof value !== 'string') return '';
  const m = /^https:\/\/x\.com\/([A-Za-z0-9_]{1,15})\/?$/.exec(value.trim());
  return m ? `https://x.com/${m[1]}` : '';
}
export async function readProfileImage(file, kind) {
  const limit = PROFILE_IMAGE_LIMITS[kind];
  if (!file || !limit || !TYPES.has(file.type)) throw new Error('Choose a PNG, JPEG, or WebP image.');
  if (!Number.isInteger(file.size) || file.size < 1 || file.size > limit) throw new Error(`Choose an image smaller than ${limit / 1024} KB.`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length !== file.size || !signature(bytes, file.type)) throw new Error('This file is not a valid PNG, JPEG, or WebP image.');
  // Decode browser-selected artwork before accepting it; restore-time validation remains synchronous.
  if (typeof createImageBitmap === 'function') {
    let bitmap;
    try { bitmap = await createImageBitmap(file); }
    catch { throw new Error('This image could not be opened. Choose another image.'); }
    finally { bitmap?.close(); }
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  const result = cleanProfileImage(`data:${file.type};base64,${btoa(binary)}`, kind);
  if (!result) throw new Error('This image could not be saved.');
  return result;
}
