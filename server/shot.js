// "Show her" (2026-10-02, the owner: "does she see my screen? and help me?", then "all of that"): a chat message may come
// with ONE picture of a window the visitor picked in their browser's own screen-sharing window (src/chat/shot.js). It goes
// to the AI service with that one message, so she can see it, and nowhere else: never logged, never stored, never sent
// again (the chat's history is text only). This file only checks that it really is a picture, and a small one.

export const SHOT_MAX_BYTES = 600_000;           // the page makes it smaller than this (src/chat/shot.js)
const B64 = /^[A-Za-z0-9+/]+={0,2}$/;
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// what kind of picture these bytes are, by their first bytes (never by what the page says): JPEG, PNG or WebP, else null
export function pictureKind(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(PNG)) return 'image/png';
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString('latin1') === 'RIFF' && bytes.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
}

// → { mimeType, data } (data: the base64 as sent, checked) · null: no picture with this message · false: not one we take
export function readShot(input) {
  if (input === undefined || input === null) return null;
  if (typeof input !== 'string') return false;
  const data = input.replace(/^data:image\/(?:jpeg|png|webp);base64,/, '');
  if (data.length < 100 || data.length % 4 !== 0 || data.length > Math.ceil(SHOT_MAX_BYTES / 3) * 4 || !B64.test(data)) return false;
  const bytes = Buffer.from(data, 'base64');
  if (bytes.length > SHOT_MAX_BYTES) return false;
  const mimeType = pictureKind(bytes);
  return mimeType ? { mimeType, data } : false;
}
