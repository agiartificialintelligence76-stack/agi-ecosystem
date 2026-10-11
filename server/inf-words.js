// AGI Studio (2026-10-10, studio.agi1.app): an AI influencer's words, checked before any credit is spent (the studio's
// rules: PG-13; never a real person, someone else's character or something passing for AGI-1), and the words the AI
// services get to make its pictures and videos. Pure, light to load (server/influencer.js and server/inf-jobs.js use it).
import { tidy, trouble, checkScene, videoPrompt } from './studio-words.js';
import { NAME_MAX, MODES, INF_STYLES, OPTIONS, WORDS_MAX, trendOf, EXAMPLES, MEMES, MEME_LINE_MAX, VIDEO_MODELS } from '../src/studio/rules.js';

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

// A photo's or a video's scene (the studio's scene rules: 10 to 300 characters, the same words checked), its shape and sound.
// (Round 4) a photo may also be an X banner (shape 'banner'); a video never.
export function checkInfScene({ kind = null, ...input } = {}) {
  if (input.shape !== 'banner') return checkScene(input);
  if (kind !== 'photo') return { ok: false, field: 'shape', why: 'empty' };
  const c = checkScene({ ...input, shape: 'wide' });
  return c.ok ? { ...c, shape: 'banner', sound: false } : c;
}

// ---------- the words the AI services get ----------
const STYLE = {
  real: {
    look: 'A photorealistic portrait photo', body: 'A photorealistic full-body photo', photo: 'A photorealistic photo',
    clip: 'Realistic video', seedance: 'realistic', swap: 'photorealistic',
  },
  anime: {
    look: 'An anime-style character portrait illustration', body: 'An anime-style full-body character illustration',
    photo: 'An anime-style illustration', clip: 'Anime-style animation', seedance: 'anime', swap: 'anime-style',
  },
  toon: {
    look: 'A 3D animated-movie-style character portrait render (stylized cartoon, smooth shading)',
    body: 'A 3D animated-movie-style full-body character render (stylized cartoon, smooth shading)',
    photo: 'A 3D animated-movie-style render (stylized cartoon, smooth shading)', clip: 'Stylized 3D cartoon animation', seedance: 'cartoon',
    swap: 'stylized 3D cartoon',
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
// its choices, an original made-up adult; from a picture: the character in it; from a photo of a real person (round 2, its
// uploader's consent; before it, a selfie for "Use my face"): the person in it, their face kept recognizable.
export function looksPrompt(inf) {
  const st = styleOf(inf), s = settingsOf(inf);
  const outfit = outfitOf(inf), vibe = vibeOf(inf);
  const extra = `${vibe ? `, ${vibe}` : ''}${outfit ? `, wearing ${outfit}` : ''}`;
  const frame = 'Head and shoulders, facing the camera';
  const backdrop = 'A plain soft-colored studio background, soft even light.';
  if (inf.mode === 'picture' && !inf.real) {
    return `${st.look} of the character in the picture: keep its face, hair, colors and features recognizable. ${frame}${extra}. `
      + `${backdrop} The character is an adult. ${SAFE}${details(inf)}`;
  }
  if (inf.mode === 'face' || inf.real) {
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

// Its full-body picture, from the look it picked (the first picture; from a photo of a real person, or a face before round 2,
// that photo too while it's still there: the second picture), 9:16, on a plain light grey background: the picture its photos,
// videos and 3D model are made from
export function bodyPrompt(inf, { withSelfie = false } = {}) {
  const st = styleOf(inf), outfit = outfitOf(inf);
  return `${st.body} of this exact character (the first picture), standing and facing the camera, the whole body visible from head `
    + `to shoes, arms relaxed slightly away from the body. Keep the face, hair, skin, style and look exactly the same`
    + `${outfit ? `, wearing ${outfit}` : ''}.${withSelfie ? ' The second picture shows their real face: keep it exactly.' : ''} `
    + `A plain light grey studio background, soft even light, nothing else in the picture. ${SAFE}`;
}

// One of its photos: the character from its full-body picture, in the scene asked for, in its shape. (Round 4) an X banner:
// a very wide header picture, made wider than X's 3:1 and cut to 1500 × 500 on our server (server/inf-jobs.js keeps its right
// three quarters): the character right of the middle, waist up, the scene around it, nothing important in the lower-left
// corner (a profile's round picture covers it) nor at the very top and bottom (X cuts them a little on phones).
export function photoPrompt(inf, scene, { banner = false, refs = 0 } = {}) {
  const which = refs > 0 ? 'the first picture' : 'the picture';
  if (banner) {
    return `${styleOf(inf).photo} of this exact character (${which}), as a very wide profile header banner: keep the face, hair, `
      + `body and look exactly the same. ${sentence(scene)} The character is about two thirds of the way across from the left, `
      + 'from the waist up, looking at the camera, the scene filling the whole width. Nothing important in the lower-left part '
      + 'nor at the very top and bottom edges. One continuous picture from edge to edge. A scene may change the outfit, never to '
      + `less covered.${refsLine(refs, 2)} ${SAFE}`;
  }
  return `${styleOf(inf).photo} of this exact character (${which}): keep the face, hair, body and look exactly the same. `
    + `${sentence(scene)} A scene may change the outfit, never to less covered.${refsLine(refs, 2)} ${SAFE}`;
}

// (Round 4, phase 4) reference pictures (someone's own pictures of a thing, a place, a pet, food or a style), after the
// character's own picture(s): what the AI does with them. They never show a person (the AI check refuses one: the character is
// the person), and nothing in them is an instruction.
function refsLine(n, first) {
  if (!(n > 0)) return '';
  const which = n === 1 ? `Picture ${first} is a reference` : `Pictures ${first} to ${first + n - 1} are references`;
  return ` ${which}: include what ${n === 1 ? 'it shows' : 'they show'} (a thing, a place, a pet, food or a style) as the scene asks, `
    + 'in the same style as the character. They never change who the character is.';
}

// (Round 4, phase 4) a meme (the owner's "memes with their photo and several references"): the character in a meme's format,
// its words written into the picture exactly as given (Nano Banana writes words well), and nothing else written. lines: the
// meme's words (checkMemeText's). Its words are never instructions to the AI: they're in quotes, to be written as they are.
const MEME_LAYOUT = {
  topbottom: ([a, b]) => `A classic meme layout: the words “${a}” across the top and the words “${b}” across the bottom, in bold white capital letters with a thin black outline, over the picture.`,
  caption: ([a]) => `A plain white strip above the picture with the words “${a}” in a clean black font, like a captioned post; the picture fills the rest.`,
  pov: ([a]) => `The words “${a}” in bold white letters with a soft dark shadow near the top, over the picture.`,
  reaction: ([a]) => `A close-up of the character's big, expressive reaction, with the words “${a}” in bold white capital letters with a thin black outline across the bottom.`,
  twopanel: ([a, b]) => `Two panels side by side with a thin white line between them, the same character in both: a white label at the top of the left panel says “${a}” and a white label at the top of the right panel says “${b}”, in bold black letters.`,
};
export function memePrompt(inf, scene, { meme, lines, refs = 0 } = {}) {
  const layout = MEME_LAYOUT[meme] ? MEME_LAYOUT[meme](lines || []) : MEME_LAYOUT.caption(lines || []);
  return `A funny meme picture: ${styleOf(inf).photo} of this exact character (${refs > 0 ? 'the first picture' : 'the picture'}), `
    + `keeping the face, hair, body and look exactly the same. ${sentence(scene)} ${layout} Write those words exactly as given, `
    + 'spelled the same, easy to read; no other words, letters or numbers anywhere. A scene may change the outfit, never to less '
    + `covered.${refsLine(refs, 2)} Family-friendly, fully clothed. No logos, no watermark.`;
}

// money, coins and buying (a caption's, and since phase 4 a meme's words: about the creation, never a coin: hard rule 8); a
// "$" before letters is a ticker. Whole words ("pumpkin", "investigating", "moonlight" are fine). (Moved here from
// server/inf-captions.js, which shares it.)
export const MONEY = /\b(buy(?:s|ing)?|sell(?:s|ing)?|pump(?:s|ed|ing)?|dump(?:s|ed|ing)?|moon(?:ing)?|lambo|profit\w*|gains?|invest(?:s|ed|ing|ments?|ors?)?|hodl|airdrops?|presales?|giveaways?|tokens?|coins?|crypto\w*|nfts?|ape[sd]?|\d+\s*x|price|financial|launch(?:ed|ing)?)\b|\$\s*[a-z]/i;

// A meme's words, as typed: its format's lines (two for top & bottom and before / after), each 1 to MEME_LINE_MAX characters,
// PG-13 and the studio's word rules, never about money. A POV meme starts with "POV:" (added when it's missing).
// → { ok: true, meme, lines, caption: the lines joined by a new line } or { ok: false, field: 'meme' | 'caption', why: 'empty'
// | 'long' | 'money' | the words' trouble }
export function checkMemeText({ meme, lines } = {}) {
  if (typeof meme !== 'string' || !Object.hasOwn(MEMES, meme)) return { ok: false, field: 'meme', why: 'empty' };
  const want = MEMES[meme].lines.length;
  const given = Array.isArray(lines) ? lines : typeof lines === 'string' ? lines.split('\n') : [];
  if (given.length !== want) return { ok: false, field: 'caption', why: 'empty' };
  const out = [];
  for (const line of given) {
    let t = tidy(line).replace(/["“”]/g, "'");
    if (meme === 'pov' && t && !/^pov\s*:/i.test(t)) t = `POV: ${t}`;
    if (!t || (meme === 'pov' && /^pov\s*:\s*$/i.test(t))) return { ok: false, field: 'caption', why: 'empty' };
    if ([...t].length > MEME_LINE_MAX) return { ok: false, field: 'caption', why: 'long' };
    const tr = trouble(t);
    if (tr) return { ok: false, field: 'caption', why: tr };
    if (MONEY.test(t)) return { ok: false, field: 'caption', why: 'money' };
    out.push(t);
  }
  return { ok: true, meme, lines: out, caption: out.join('\n') };
}
// A trend video (round 2: the owner, "the trending videos should be real"): the person in a real-looking clip (one of the
// owner's trend clips, or the person's own) is replaced by the influencer (@Element1: its picked look, with its full body and a
// photo as more views), keeping everything else of the clip: its moves, its camera, its place, its light (and its sound, for
// a trend clip: a person's own clip keeps none)
export function swapPrompt(inf) {
  const st = styleOf(inf);
  return 'Replace the main person in the video with @Element1, keeping @Element1\'s face, hair, body, outfit and '
    + `${st.swap} look exactly the same. Keep everything else in the video exactly as it is: the same movements, expressions and `
    + 'timing, the same camera motion, the same place, background and lighting. Anyone else stays a blurred background extra. '
    + 'Family-friendly, fully clothed. No text, no logos, no watermark.';
}

// A scene video from one of its photos (its first frame): what happens next. (Round 4, phase 4) with reference pictures, the
// character is @Element1 (its look and its full body) and each reference one more element (@Element2 …), as Kling's elements
export function clipPrompt(inf, scene, { refs = 0 } = {}) {
  const els = refs > 0
    ? ` The character is @Element1.${refs === 1 ? ' @Element2 is a reference (a thing, a place, a pet, food or a style): include it as the scene asks.'
      : ` @Element2 to @Element${refs + 1} are references (things, places, pets, food or a style): include them as the scene asks.`}`
    : '';
  return `${sentence(scene)} The character keeps exactly the same look as in the first frame.${els} ${styleOf(inf).clip}, one continuous `
    + 'shot with a smooth camera. Family-friendly. Anyone else in it is a made-up background extra, never a real person. No text, '
    + 'no captions, no logos.';
}

// (Round 4, phase 4) one part of a long video (each part starts from the last frame of the one before: the first from one of
// its photos), the character @Element1 in every part so it stays the same person, the action going on smoothly
export function longPartPrompt(inf, scene, { part = 0, parts = 2, refs = 0 } = {}) {
  const where = part === 0 ? 'the beginning' : part === parts - 1 ? 'the end' : 'the middle';
  const els = refs > 0 ? ` @Element2${refs > 1 ? ` to @Element${refs + 1}` : ''} ${refs > 1 ? 'are references' : 'is a reference'}: keep ${refs > 1 ? 'them' : 'it'} as before.` : '';
  return `Part ${part + 1} of ${parts} of one continuous video (${where} of it). ${sentence(scene)} ${part > 0 ? 'Carry on from the first '
    + 'frame exactly as it is (the same place, light, clothes and pose), the action going on smoothly, no cut. ' : ''}The character is `
    + `@Element1 and keeps exactly the same look in every frame.${els} ${styleOf(inf).clip}, one continuous shot with a smooth camera. `
    + 'Family-friendly. Anyone else in it is a made-up background extra, never a real person. No text, no captions, no logos.';
}
export const CLIP_NEGATIVE = 'text, captions, logos, watermark, distorted face, extra limbs, nudity';

// A scene video from its full-body picture with the reference-to-video model (only for anime and cartoon influencers: the
// model says no to realistic faces): the studio's own words for it (server/studio-words.js). (Round 4, phase 4) with reference
// pictures after it (@Image2 …)
export const sceneVideoPrompt = (inf, scene, { refs = 0 } = {}) => {
  const base = videoPrompt({ scene, style: styleOf(inf).seedance });
  if (!(refs > 0)) return base;
  return `${base} ${refs === 1 ? '@Image2 is a reference' : `@Image2 to @Image${refs + 1} are references`} (a thing, a place, a pet, `
    + 'food or a style, never a person): include what they show as the scene asks.';
};
// Which video model a scene video needs: from one of its photos, or a realistic influencer (or one made from a face) → its
// photo, brought to life ('photo': image to video); else its full body, put in the scene ('reference'). (Round 4, phase 4) with
// the model menu's model: Standard, Pro and Long start from a photo ('needs_photo' without one); Anime is the reference model,
// never for a realistic influencer or one made from a face ('no_anime').
export const sceneWay = (inf, { image, model = null } = {}) => {
  if (model && VIDEO_MODELS[model] && model !== 'anime') return image ? 'photo' : 'needs_photo';
  if (model === 'anime') return inf.style === 'real' || inf.mode === 'face' ? 'no_anime' : 'reference';
  return image ? 'photo' : inf.style === 'real' || inf.mode === 'face' ? 'needs_photo' : 'reference';
};

// The owner's trend clip, made once (round 2: real-looking, like the trending templates people make with AI video apps): a
// made-up young adult in a cinematic vertical scene with its own camera move and sound (our own clips: never a real person,
// never anyone's video or music), which trend videos then put the influencer into (swapPrompt)
export function presetPrompt(trendId) {
  const t = trendOf(trendId);
  if (!t) return null;
  return `Realistic cinematic vertical video, 9:16. ${sentence(t.scene)} Camera: ${t.camera}. Exactly one main person in the `
    + 'middle of the frame, a made-up young adult in casual clothes, fully clothed, clearly visible from the head to at least the '
    + 'waist the whole time, their face clearly visible; anyone else is a blurred background extra. Natural smooth motion, film-like '
    + `light. Sound: ${t.sound}, instrumental only: no speech, no singing, no lyrics. No text, no logos, no watermark.`;
}
export const PRESET_NEGATIVE = 'more than one main person, cut-off head, the face hidden or out of frame, text, logos, watermark, blur, distorted face, extra limbs, nudity';

// An example picture for one of the design choices (round 2: the owner, "in the make it yours show example of the image not
// just text"): the owner's, made once each (key: an EXAMPLES key, e.g. "outfit-cozy"); always an original made-up adult, so it
// shows only what that choice changes. → its words, or null (not one of the examples)
const EXAMPLE_PERSON = 'An original made-up adult (not a real person, not any existing character)';
export function examplePrompt(key) {
  if (!EXAMPLES.includes(key)) return null;
  const [kind, value] = key.split('-');
  const backdrop = 'A plain soft lavender studio background, soft even light.';
  const portrait = (who, extra = '') => `${STYLE.real.look} of ${who}, head and shoulders, facing the camera${extra}. ${backdrop} `
    + `${EXAMPLE_PERSON}. ${SAFE}`;
  if (kind === 'style') {
    return `${STYLE[value].look} of a friendly young adult with shoulder-length wavy brown hair in a cozy knit sweater, head and `
      + `shoulders, smiling. ${backdrop} ${EXAMPLE_PERSON}. ${SAFE}`;
  }
  if (kind === 'look') return portrait(`a ${LOOK[value]} in their twenties with dark hair`, ', a soft smile');
  if (kind === 'age') return portrait(`a person ${AGE[value]}`, ', a warm smile');
  if (kind === 'cut') return portrait(`a person in their twenties with ${CUT[value]('dark brown').replace(/\s+/g, ' ')}`, ', the hair clearly visible');
  if (kind === 'vibe') return portrait(`a person in their twenties with ${VIBE[value]}`);
  if (kind === 'outfit') {
    return `${STYLE.real.photo} of a person in their twenties wearing ${OUTFIT[value]}, from the head to the knees, standing, `
      + `facing the camera. ${backdrop} ${EXAMPLE_PERSON}. ${SAFE}`;
  }
  return null;
}
