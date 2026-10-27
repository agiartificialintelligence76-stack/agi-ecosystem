// Browser-safe media rules, shared by the gallery, editor and server. No keys or wallet data.
export const MEDIA_BUCKET = 'agi1-owner-media';
export const MEDIA_ORIGIN = 'https://vujaxukucukjxzhcxlea.supabase.co';
export const MEDIA_PUBLIC_ROOT = `${MEDIA_ORIGIN}/storage/v1/object/public/${MEDIA_BUCKET}/`;
export const MEDIA_MIME_TYPES = Object.freeze({
  'image/jpeg': { extension: 'jpg', maxBytes: 20_000_000, family: 'image' },
  'image/png': { extension: 'png', maxBytes: 20_000_000, family: 'image' },
  'image/webp': { extension: 'webp', maxBytes: 20_000_000, family: 'image' },
  'image/gif': { extension: 'gif', maxBytes: 20_000_000, family: 'image' },
  'video/mp4': { extension: 'mp4', maxBytes: 50_000_000, family: 'video' },
  'video/webm': { extension: 'webm', maxBytes: 50_000_000, family: 'video' },
});
const UUID = '[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}';
export const MEDIA_PATH = new RegExp(`^(${UUID})\\.(jpg|png|webp|gif|mp4|webm)$`);
export const MEDIA_ID = new RegExp(`^upload-(${UUID})$`);
export function mediaPath(value) {
  if (typeof value !== 'string' || !value.startsWith(MEDIA_PUBLIC_ROOT)) return null;
  const path = value.slice(MEDIA_PUBLIC_ROOT.length);
  return MEDIA_PATH.test(path) ? path : null;
}
export function safeMemeUrl(value, { imageOnly = false } = {}) {
  const path = mediaPath(value);
  return Boolean(path && (!imageOnly || /\.(?:jpg|png|webp|gif)$/.test(path)));
}
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const plainText = (value, max, fallback, label) => {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || value.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)) throw new Error(`${label} is too long or isn't text.`);
  return value;
};
const proof = (value) => {
  if (value === undefined || value === '') return '';
  if (typeof value !== 'string' || value.length > 1400 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) throw new Error('An upload confirmation is invalid. Upload the file again.');
  return value;
};
export function validateMemes(input, builtins) {
  if (!Array.isArray(input) || input.length > 500) throw new Error('The gallery can keep up to 500 entries.');
  const originals = new Map(builtins.map((m) => [m.id, m]));
  const ids = new Set();
  return input.map((value) => {
    if (!object(value) || typeof value.id !== 'string' || ids.has(value.id)) throw new Error('Each gallery item needs a unique ID.');
    ids.add(value.id);
    if (value.custom !== undefined && typeof value.custom !== 'boolean') throw new Error('A gallery item has an invalid source.');
    if (value.hidden !== undefined && typeof value.hidden !== 'boolean') throw new Error('Choose whether the gallery item is shown.');
    if (value.addedAt !== undefined && (!Number.isSafeInteger(value.addedAt) || value.addedAt < 0 || value.addedAt > 8_640_000_000_000_000)) throw new Error('A gallery upload date is invalid.');
    const custom = value.custom === true, original = originals.get(value.id);
    if (custom ? !MEDIA_ID.test(value.id) : !original) throw new Error('This gallery item is not a built-in meme or a confirmed upload.');
    const kind = value.kind ?? original?.kind;
    if (!['image', 'video', 'slopcore'].includes(kind)) throw new Error('Choose Images, Videos or Slopcore.');
    const family = kind === 'image' ? 'image' : 'video';
    if (original && (original.kind === 'image') !== (family === 'image')) throw new Error('An image cannot become a video. Upload the other file instead.');
    const originalSrc = original ? (original.kind === 'image' ? `/memes/images/agi-${original.id}.jpg` : `/memes/videos/agi-${original.id}.mp4`) : '';
    const originalThumb = original ? (original.kind === 'image' ? `/memes/previews/agi-${original.id}.webp` : `/memes/posters/agi-${original.id}.webp`) : '';
    const src = value.src ?? originalSrc, thumb = value.thumb ?? originalThumb;
    if (typeof src !== 'string' || typeof thumb !== 'string') throw new Error('A gallery file address is invalid.');
    if (!custom && (src !== originalSrc || thumb !== originalThumb)) throw new Error('Built-in gallery files stay unchanged. Upload a new item to replace one.');
    if (custom) {
      const path = mediaPath(src);
      if (!path || !path.startsWith(`${value.id.slice(7)}.`) || (family === 'image') !== /\.(?:jpg|png|webp|gif)$/.test(path)) throw new Error('This gallery file does not match its upload.');
      if (thumb && !safeMemeUrl(thumb, { imageOnly: true })) throw new Error('Choose an uploaded image for the video cover.');
    }
    const secs = value.secs ?? original?.secs ?? 0;
    if (typeof secs !== 'number' || !Number.isFinite(secs) || secs < 0 || secs > 86400) throw new Error('The video length must be between 0 and 24 hours.');
    const result = { id: value.id, custom, kind, title: plainText(value.title, 240, original?.title || 'Untitled', 'Gallery title'), note: plainText(value.note, 1200, original?.note || '', 'Gallery note'), src, thumb, secs: family === 'image' ? 0 : secs, hidden: value.hidden === true };
    const addedAt = custom ? value.addedAt : original?.addedAt;
    if (addedAt !== undefined) result.addedAt = addedAt;
    if (custom) {
      const savedProof = proof(value.proof), thumbProof = proof(value.thumbProof);
      if (savedProof) result.proof = savedProof;
      if (thumbProof && thumb) result.thumbProof = thumbProof;
    }
    return result;
  });
}
export function publicMemes(memes) {
  return memes.filter((m) => !m.custom || !m.hidden).map(({ proof, thumbProof, ...m }) => m.hidden ? { id: m.id, custom: false, hidden: true } : m);
}
