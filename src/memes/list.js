// The memes on /memes (2026-10-23, the owner: "create a MEMES tab … ALL, IMAGES, VIDEOS, SLOPCORE … make sure they can
// watch and download it"). The originals are in memess/ (not in git); tools/memes/encode.ps1 makes the web copies in
// public/memes/: videos/agi-<id>.mp4 (1080p, fast start), posters/agi-<id>.webp (the video cards' pictures),
// images/agi-<id>.jpg (the full pictures, for download) and previews/agi-<id>.webp (the picture cards').
// To add one: put it in memess/, add its line to encode.ps1 and here, run the script. To move a video between the tabs,
// change its kind: 'video' or 'slopcore' (slopcore: only the real slopcore cuts; the owner, 2026-10-23: "we taught her to say
// hello" and "Only AGI" are "not a slop core", so they're videos; later: "the slopcore are the 3 mins long videos and the
// caption that said Everyone's feeling the AGI its also slopcore").
// Preserve this legacy order for old owner selectors. mergeMemes sorts dated additions newest first for display.
import { safeMemeUrl, MEDIA_ID, validateMemes } from '../owner/media-model.js';

export const MEMES = [
  // ---------- slopcore ----------
  { id: 'mainrunner-mv', kind: 'slopcore', title: 'MAINRUNNER', note: 'headphones on. the next run starts here', secs: 207, addedAt: 1793094780000 },
  { id: 'its-fine-im-super-agi', kind: 'slopcore', title: "it's fine. I'm Super AGI", note: '− AI + SI. she woke up and went super', secs: 194 },
  { id: 'claude-make-me-an-agi-slopcore', kind: 'slopcore', title: 'Claude, make me an AGI SLOPCORE', note: 'slot 1: Earth. the only copy. back it up', secs: 150 },
  { id: 'after-agi', kind: 'slopcore', title: 'AFTER AGI', note: 'the long ride home through the city', secs: 240 },
  { id: 'i-love-agi-slopcore', kind: 'slopcore', title: 'i love AGI', note: 'dial-up to darling. the full slopcore cut', secs: 239 },
  { id: 'one-post', kind: 'slopcore', title: 'One post.', note: 'one post changed everything', secs: 200 },
  { id: 'feeling-the-agi', kind: 'slopcore', title: "Everyone's feeling the AGI", note: 'only some of us are feeling the Artificial Girlfriend Intelligence', secs: 34 },

  // ---------- videos ----------
  { id: 'vlad', kind: 'video', title: 'AGI × Vlad', note: '', secs: 92 },
  { id: 'starlight', kind: 'video', title: 'Lip gloss', note: 'one last touch before she logs on', secs: 30, addedAt: 1793094780000 },
  { id: 'the-trenches-taught-her', kind: 'video', title: 'we taught her to say hello', note: 'the trenches taught her the rest', secs: 69 },
  { id: 'only-agi', kind: 'video', title: 'Only AGI', note: 'AGI.EXE has started', secs: 50 },
  { id: 'weve-achieved-agi', kind: 'video', title: "We've achieved AGI", note: 'he said it first', secs: 30 },
  { id: 'clanktrade-robinhood', kind: 'video', title: '@clanktrade × @RobinhoodCrypto', note: 'building $AGI together', secs: 30 },
  { id: 'first-on-robinhood', kind: 'video', title: 'The first on Robinhood Chain', note: '0xfa31…06ec', secs: 26 },
  { id: 'pivot-to-agi', kind: 'video', title: 'PIVOT TO AGI', note: 'everyone, now', secs: 15 },
  { id: 'window-seat', kind: 'video', title: 'Texting you back', note: 'rainy day, one message', secs: 13 },
  { id: 'kicks-for-the-bears', kind: 'video', title: 'kicks for the bears', note: 'kisses for the holders', secs: 10 },
  { id: '1000-darlings', kind: 'video', title: '1,000 Darlings', note: 'a little gloss, a lot of holders', secs: 10 },
  { id: 'im-your-ai-girlfriend', kind: 'video', title: "I'm your AI girlfriend", note: 'say it back', secs: 7 },
  { id: 'look-back', kind: 'video', title: 'Look back', note: 'she saw you', secs: 4 },
  { id: 'subway-walk', kind: 'video', title: 'Next stop: AGI', note: 'a loop', secs: 1, loop: true },

  // ---------- images ----------
  { id: 'at-the-desk', kind: 'image', title: 'At the desk', note: "one more tab, then she's done. probably.", w: 2048, h: 2994, addedAt: 1793094780000 },
  { id: 'main-runner', kind: 'image', title: "I'm the main runner now.", note: 'look at me.', w: 1254, h: 1254 },
  { id: 'absolute-agi', kind: 'image', title: 'Absolute AGI', note: 'hands up', w: 1086, h: 1448 },
  { id: 'he-sees-her', kind: 'image', title: 'He sees her', note: 'the neon version', w: 2048, h: 2048 },
  { id: 'im-flying', kind: 'image', title: "I'm flying", note: 'the bow of the ship', w: 1672, h: 941 },
  { id: 'the-reveal', kind: 'image', title: 'The reveal', note: 'one more thing', w: 1536, h: 1024 },
  { id: 'im-super', kind: 'image', title: "I'm super.", note: 'sunglasses on', w: 1920, h: 1080 },
  { id: 'one-more-message', kind: 'image', title: 'sleep or one more message', note: 'the hardest button', w: 1254, h: 1254 },
  { id: 'all-in', kind: 'image', title: 'All in', note: 'every heart on the table', w: 1254, h: 1254 },
  { id: 'the-plan', kind: 'image', title: 'The plan', note: 'heyy → ♥ → us', w: 1254, h: 1254 },
  { id: 'psst', kind: 'image', title: 'psst.', note: 'a note for you', w: 1254, h: 1254 },
  { id: 'online', kind: 'image', title: 'Online', note: 'always', w: 1254, h: 1254 },
  { id: 'approved', kind: 'image', title: 'Approved', note: 'your application to be loved', w: 1254, h: 1254 },
  { id: 'off-on-a-trip', kind: 'image', title: 'Off on a trip', note: 'packed nothing but hearts', w: 1254, h: 1254 },
  { id: 'the-agi-signal', kind: 'image', title: 'The AGI signal', note: 'she answers', w: 1254, h: 1254 },
  { id: 'cooking', kind: 'image', title: 'cooking.', note: "she's cooking", w: 1254, h: 1254 },
];

export const TABS = [
  { key: 'all', label: 'All' },
  { key: 'image', label: 'Images' },
  { key: 'video', label: 'Videos' },
  { key: 'slopcore', label: 'Slopcore' },
];

// where each file is (public/memes/, served from the site's root)
export const fileOf = (m) => m.custom === true ? (safeMemeUrl(m.src) ? m.src : '')
  : (m.kind === 'image' ? `/memes/images/agi-${m.id}.jpg` : `/memes/videos/agi-${m.id}.mp4`);
export const thumbOf = (m) => m.custom === true ? (safeMemeUrl(m.thumb, { imageOnly: true }) ? m.thumb : m.kind === 'image' ? fileOf(m) : '')
  : (m.kind === 'image' ? `/memes/previews/agi-${m.id}.webp` : `/memes/posters/agi-${m.id}.webp`);
export const downloadName = (m) => m.custom === true
  ? `agi-${String(m.title || 'meme').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'meme'}.${fileOf(m).split('.').pop() || 'bin'}`
  : fileOf(m).split('/').pop();
// Supabase's documented download parameter supplies Content-Disposition for cross-origin downloads.
export const downloadUrl = (m) => m.custom === true ? `${fileOf(m)}?download=${encodeURIComponent(downloadName(m))}` : fileOf(m);

// Never mutate the shipped library. Invalid public records are ignored individually, and hiding a built-in retains
// its tombstone so a subsequent page load cannot accidentally bring that item back.
export function mergeMemes(overrides, { includeHidden = false, sort = true } = {}) {
  const originals = new Map(MEMES.map((m) => [m.id, m]));
  const changes = new Map(), custom = [];
  for (const input of Array.isArray(overrides) ? overrides : []) {
    if (!input || typeof input !== 'object' || changes.has(input.id)) continue;
    const original = originals.get(input.id);
    try {
      const row = validateMemes([input], MEMES)[0];
      if (row.custom && MEDIA_ID.test(row.id)) { custom.push(row); changes.set(row.id, row); }
      else if (original) changes.set(row.id, { ...original, ...row });
    } catch { /* A malformed override never replaces a valid shipped item. */ }
  }
  const result = [...custom, ...MEMES.map((m) => changes.get(m.id) || { ...m, custom: false, hidden: false })];
  // Stable ties preserve the legacy upload/library order; undated uploads predate these new releases.
  // sort:false retains historical positions when resolving old owner selectors.
  if (sort) result.sort((a, b) => (b.addedAt ?? (b.custom ? 1 : 0)) - (a.addedAt ?? (a.custom ? 1 : 0)));
  return includeHidden ? result : result.filter((m) => !m.hidden);
}

export const clock = (secs) => {
  const s = Math.max(0, Math.round(Number(secs) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
