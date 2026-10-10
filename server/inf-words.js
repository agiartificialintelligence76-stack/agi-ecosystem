// AGI Studio (2026-10-10, studio.agi1.app): an AI influencer's words, checked before any credit is spent (the studio's
// rules: PG-13; never a real person, someone else's character or something passing for AGI-1), and the words the AI
// services get to make its pictures and videos. Pure, light to load (server/influencer.js and server/inf-jobs.js use it).
import { tidy, trouble, checkScene, videoPrompt } from './studio-words.js';
import { NAME_MAX, MODES, INF_STYLES, OPTIONS, WORDS_MAX, trendOf } from '../src/studio/rules.js';

const NAME_OK = /^[\p{L}\p{N}][\p{L}\p{N} '’.\-!?&]*$/u;

// An influencer as typed. → { ok: true, name, mode, style, settings, words } (tidied; settings only the known choices for its
// mode) or { ok: false, field: 'mode' | 'name' | 'style' | a setting | 'words', why: 'empty' | 'long' | 'letters' | 'bad' |
// the words' trouble ('link', 'contact', 'adult', 'minor', 'hate', 'person', 'character', 'her') }
export function checkStart({ name, mode, style, settings, words } = {}) {
  if (!Object.hasOwn(MODES, mode)) return { ok: false, field: 'mode', why: 'empty' };
  const n = tidy(name);
  if (!n) return { ok: false, field: 'name', why: 'empty' };
  if ([...n].length > NAME_MAX) return { ok: false, field: 'name', why: 'long' };
  if (!NAME_OK.test(n)) return { ok: false, field: 'name', why: 'letters' };
  const tn = trouble(n);
  if (tn) return { ok: false, field: 'name', why: tn };
  if (!Object.hasOwn(INF_STYLES, style)) return { ok: false, field: 'style', why: 'empty' };
  const given = settings && typeof settings === 'object' && !Array.isArray(settings) ? settings : {};
  const kept = {};
  for (const [key, value] of Object.entries(given)) {
    if (value === '' || value === null || value === undefined) continue;
    const option = Object.hasOwn(OPTIONS, key) ? OPTIONS[key] : null;
    if (!option || !option.for.includes(mode) || typeof value !== 'string' || !Object.hasOwn(option.choices, value)) {
      return { ok: false, field: option ? key : 'settings', why: 'bad' };
    }
    kept[key] = value;
  }
  // one designed from choices always says it's an adult (its age is one of OPTIONS.age's, from the twenties up) and its look
  if (mode === 'design') {
    for (const key of ['look', 'age']) if (!kept[key]) return { ok: false, field: key, why: 'empty' };
  }
  const w = tidy(words);
  if ([...w].length > WORDS_MAX) return { ok: false, field: 'words', why: 'long' };
  if (w) {
    const tw = trouble(w);
    if (tw) return { ok: false, field: 'words', why: tw };
  }
  return { ok: true, name: n, mode, style, settings: kept, words: w };
}

// A photo's or a video's scene (the studio's scene rules: 10 to 300 characters, the same words checked), its shape and sound
export const checkInfScene = (input) => checkScene(input);

// ---------- the words the AI services get ----------
const STYLE = {
  real: {
    look: 'A photorealistic portrait photo', body: 'A photorealistic full-body photo', photo: 'A photorealistic photo',
    clip: 'Realistic video', seedance: 'realistic',
  },
  anime: {
    look: 'An anime-style character portrait illustration', body: 'An anime-style full-body character illustration',
    photo: 'An anime-style illustration', clip: 'Anime-style animation', seedance: 'anime',
  },
  toon: {
    look: 'A 3D animated-movie-style character portrait render (stylized cartoon, smooth shading)',
    body: 'A 3D animated-movie-style full-body character render (stylized cartoon, smooth shading)',
    photo: 'A 3D animated-movie-style render (stylized cartoon, smooth shading)', clip: 'Stylized 3D cartoon animation', seedance: 'cartoon',
  },
};
const LOOK = { feminine: 'woman', masculine: 'man', androgynous: 'person with an androgynous look' };
const AGE = { '20s': 'in their twenties', '30s': 'in their thirties', '40s': 'in their forties', '50s': 'in their fifties' };
const SKIN = { fair: 'fair skin', light: 'light skin', medium: 'a medium skin tone', olive: 'olive skin', brown: 'brown skin', deep: 'deep dark skin' };
const HAIR = { black: 'black', brown: 'brown', blonde: 'blonde', red: 'red', pink: 'pastel pink', blue: 'blue', silver: 'silver', lavender: 'lavender' };
const CUT = {
  short: (c) => `short ${c} hair`, bob: (c) => `${c} hair in a bob`, long: (c) => `long ${c} hair`, curly: (c) => `curly ${c} hair`,
  wavy: (c) => `wavy ${c} hair`, braids: (c) => `${c} hair in braids`, ponytail: (c) => `${c} hair in a ponytail`, buzz: (c) => `a ${c} buzz cut`,
};
const EYES = { brown: 'brown eyes', hazel: 'hazel eyes', green: 'green eyes', blue: 'blue eyes', grey: 'grey eyes', violet: 'violet eyes' };
const OUTFIT = {
  street: 'streetwear (an oversized hoodie and sneakers)', cozy: 'a cozy knit sweater', sporty: 'sporty athleisure (a zip-up track jacket)',
  smart: 'smart casual clothes (a blazer over a t-shirt)', y2k: 'Y2K-style fashion (a colorful jacket, cargo pants and chunky sneakers)',
  cyber: 'futuristic techwear (a jacket with neon details)', gamer: 'a gamer look (a hoodie, headphones around the neck)',
  elegant: 'an elegant outfit (a tailored long coat)',
};
const VIBE = {
  cheerful: 'a cheerful smile', cool: 'a cool, relaxed look', calm: 'a calm, warm expression', confident: 'a confident look',
  playful: 'a playful grin', mysterious: 'a mysterious half-smile',
};
const SAFE = 'Family-friendly, fully clothed. No text, no logos, no watermark.';
const sentence = (s) => {
  const t = String(s ?? '').trim();
  return t ? `${t.charAt(0).toUpperCase()}${t.slice(1)}${/[.!?…]$/.test(t) ? '' : '.'}` : '';
};
const details = (inf) => (inf.words ? ` Details: ${sentence(inf.words)}` : '');
const styleOf = (inf) => STYLE[inf.style] || STYLE.real;
const settingsOf = (inf) => (inf.settings && typeof inf.settings === 'object' ? inf.settings : {});
const outfitOf = (inf) => OUTFIT[settingsOf(inf).outfit] || null;
const vibeOf = (inf) => VIBE[settingsOf(inf).vibe] || null;

// Its 4 looks to pick from: head and shoulders on a plain background, 1:1 (they make good coin pictures too). Designed: from
// its choices, an original made-up adult; from a picture: the character in it; from a face: the person in the selfie.
export function looksPrompt(inf) {
  const st = styleOf(inf), s = settingsOf(inf);
  const outfit = outfitOf(inf), vibe = vibeOf(inf);
  const extra = `${vibe ? `, ${vibe}` : ''}${outfit ? `, wearing ${outfit}` : ''}`;
  const frame = 'Head and shoulders, facing the camera';
  const backdrop = 'A plain soft-colored studio background, soft even light.';
  if (inf.mode === 'picture') {
    return `${st.look} of the character in the picture: keep its face, hair, colors and features recognizable. ${frame}${extra}. `
      + `${backdrop} The character is an adult. ${SAFE}${details(inf)}`;
  }
  if (inf.mode === 'face') {
    return `${st.look} of the person in the photo, keeping their face recognizable (the same face shape, eyes, nose, mouth, skin `
      + `tone and hair). ${frame}${extra}. ${backdrop} ${SAFE}${details(inf)}`;
  }
  const color = HAIR[s.hair] || '';
  const hair = CUT[s.cut] ? CUT[s.cut](color).replace(/\s+/g, ' ').trim() : color ? `${color} hair` : null;
  const traits = [SKIN[s.skin], hair, EYES[s.eyes]].filter(Boolean);
  const who = `a ${LOOK[s.look] || 'person'} ${AGE[s.age] || 'in their twenties'}${traits.length ? ` with ${traits.join(', ')}` : ''}`;
  return `${st.look} of ${who}. ${frame}${extra}. ${backdrop} An original made-up adult character: not a real person, not any `
    + `existing character. ${SAFE}${details(inf)}`;
}

// Its full-body picture, from the look it picked (the first picture; from a face, its selfie too when it's still there: the
// second picture), 9:16, on a plain light grey background: the picture its photos, videos and 3D model are made from
export function bodyPrompt(inf, { withSelfie = false } = {}) {
  const st = styleOf(inf), outfit = outfitOf(inf);
  return `${st.body} of this exact character (the first picture), standing and facing the camera, the whole body visible from head `
    + `to shoes, arms relaxed slightly away from the body. Keep the face, hair, skin, style and look exactly the same`
    + `${outfit ? `, wearing ${outfit}` : ''}.${withSelfie ? ' The second picture shows their real face: keep it exactly.' : ''} `
    + `A plain light grey studio background, soft even light, nothing else in the picture. ${SAFE}`;
}

// One of its photos: the character from its full-body picture, in the scene asked for, in its shape
export function photoPrompt(inf, scene) {
  return `${styleOf(inf).photo} of this exact character (the picture): keep the face, hair, body and look exactly the same. `
    + `${sentence(scene)} A scene may change the outfit, never to less covered. ${SAFE}`;
}

// A trend video: the character copies the moves of the video (the owner's trend move, or the person's own clip)
export function motionPrompt(inf) {
  return `The character from the picture copies the moves in the video, keeping exactly the same look, face, outfit and `
    + `background. ${styleOf(inf).clip}, natural smooth motion. Family-friendly.`;
}

// A scene video from one of its photos (its first frame): what happens next
export function clipPrompt(inf, scene) {
  return `${sentence(scene)} The character keeps exactly the same look as in the first frame. ${styleOf(inf).clip}, one continuous `
    + 'shot with a smooth camera. Family-friendly. Anyone else in it is a made-up background extra, never a real person. No text, '
    + 'no captions, no logos.';
}
export const CLIP_NEGATIVE = 'text, captions, logos, watermark, distorted face, extra limbs, nudity';

// A scene video from its full-body picture with the reference-to-video model (only for anime and cartoon influencers: the
// model says no to realistic faces): the studio's own words for it (server/studio-words.js)
export const sceneVideoPrompt = (inf, scene) => videoPrompt({ scene, style: styleOf(inf).seedance });
// Which video model a scene video needs: from one of its photos, or a realistic (or face) influencer → its photo, brought to
// life ('photo': image to video); else its full body, put in the scene ('reference')
export const sceneWay = (inf, { image } = {}) => (image ? 'photo' : inf.style === 'real' || inf.mode === 'face' ? 'needs_photo' : 'reference');

// The owner's trend move, made once: a made-up adult dancer doing it, the whole body in view, a still camera, a plain
// background, no music (motion control copies only the moves)
export function presetPrompt(trendId) {
  const t = trendOf(trendId);
  if (!t) return null;
  return `A made-up adult dancer in a plain light grey t-shirt and dark grey sweatpants ${t.move}. The whole body is visible `
    + 'from head to toe the whole time, the camera is still and straight on, a plain light grey studio background, even soft light. '
    + 'Exactly one person. Realistic video, natural smooth motion.';
}
export const PRESET_NEGATIVE = 'more than one person, cut-off limbs, the body out of frame, camera movement, text, logos, watermark, blur';
