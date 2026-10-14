// AGI Studio (2026-10-10, studio.agi1.app): an AI influencer's words, checked before any credit is spent (the studio's
// rules: PG-13; never a real person, someone else's character or something passing for AGI-1), and the words the AI
// services get to make its pictures and videos. Pure, light to load (server/influencer.js and server/inf-jobs.js use it).
import { tidy, trouble, checkScene, videoPrompt } from './studio-words.js';
import {
  NAME_MAX, MODES, INF_STYLES, OPTIONS, WORDS_MAX, trendOf, EXAMPLES, MEMES, MEME_LINE_MAX, VIDEO_MODELS, STYLE_AUTO, WAYS, drawnStyle, EDIT,
} from '../src/studio/rules.js';

const NAME_OK = /^[\p{L}\p{N}][\p{L}\p{N} '’.\-!?&]*$/u;

// An influencer as typed. → { ok: true, name, mode, style, way, settings, words } (tidied; settings only the known choices for
// its mode) or { ok: false, field: 'mode' | 'name' | 'style' | 'way' | a setting | 'words', why: 'empty' | 'long' | 'letters' |
// 'bad' | the words' trouble ('link', 'contact', 'adult', 'minor', 'hate', 'person', 'character', 'her') }. (2026-10-11) its
// style is optional (none: 'auto', the style its words name, else a photo look; from a picture, the picture's own), and one
// made from a picture has a way to start (src/studio/rules.js WAYS: 4 looks, just its full body, or the photo as it is, which
// keeps the photo's own look: 'auto')
export function checkStart({ name, mode, style, settings, words, way } = {}) {
  if (!Object.hasOwn(MODES, mode)) return { ok: false, field: 'mode', why: 'empty' };
  const n = tidy(name);
  if (!n) return { ok: false, field: 'name', why: 'empty' };
  if ([...n].length > NAME_MAX) return { ok: false, field: 'name', why: 'long' };
  if (!NAME_OK.test(n)) return { ok: false, field: 'name', why: 'letters' };
  const tn = trouble(n);
  if (tn) return { ok: false, field: 'name', why: tn };
  const st = style === undefined || style === null || style === '' ? STYLE_AUTO : style;
  if (st !== STYLE_AUTO && (typeof st !== 'string' || !Object.hasOwn(INF_STYLES, st))) return { ok: false, field: 'style', why: 'bad' };
  const w8 = way === undefined || way === null || way === '' ? 'looks' : way;
  if (typeof w8 !== 'string' || !Object.hasOwn(WAYS, w8) || (w8 !== 'looks' && mode !== 'picture')) return { ok: false, field: 'way', why: 'bad' };
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
  return { ok: true, name: n, mode, style: w8 === 'asis' ? STYLE_AUTO : st, way: w8, settings: kept, words: w };
}

// A photo's or a video's scene (the studio's scene rules: 10 to 300 characters, the same words checked), its shape and sound.
// (Round 4) a photo may also be an X banner (shape 'banner'); a video never. (2026-10-13, "With AGI-1") agi1: she's in it,
// so her own name may be in its words ("a photo with AGI-1 at the beach"); never "official", an admin or her team.
export function checkInfScene({ kind = null, agi1 = false, ...input } = {}) {
  const herName = agi1 === true;
  if (input.shape !== 'banner') return checkScene({ ...input, herName });
  if (kind !== 'photo') return { ok: false, field: 'shape', why: 'empty' };
  const c = checkScene({ ...input, shape: 'wide', herName });
  return c.ok ? { ...c, shape: 'banner', sound: false } : c;
}

// (2026-10-12, the editor) "Edit with words": the change, as typed (EDIT.MIN to EDIT.MAX characters; the studio's word rules,
// like a scene's: PG-13, never a real person by name, someone else's character or anything passing for AGI-1, no links or
// contacts). → { ok: true, edit } (tidied) or { ok: false, field: 'edit', why: 'empty' | 'short' | 'long' | the words' trouble }.
// (2026-10-13) agi1: the photo has AGI-1 in it, so her own name may be in the change ("make AGI-1 wave")
export function checkEdit(input, { agi1 = false } = {}) {
  const e = tidy(input);
  if (!e) return { ok: false, field: 'edit', why: 'empty' };
  if ([...e].length < EDIT.MIN) return { ok: false, field: 'edit', why: 'short' };
  if ([...e].length > EDIT.MAX) return { ok: false, field: 'edit', why: 'long' };
  const t = trouble(e, { herName: agi1 === true });
  return t ? { ok: false, field: 'edit', why: t } : { ok: true, edit: e };
}

// ---------- the words the AI services get ----------
// Each style's words: look (its 4 looks: head and shoulders), body (its full body), photo (its photos), clip (a video from one
// of its photos), seedance and motion (a drawn style's video from its full body: server/studio-words.js videoPrompt) and swap
// (a trend video keeps its look). (2026-10-11) 26 styles (src/studio/rules.js STYLE_GROUPS), in our own words: never a
// studio's, a brand's or an artist's name; a toy figure and a plushie keep adult proportions.
const an = (w) => `${/^[aeiou]/i.test(w) ? 'An' : 'A'} ${w}`;
const mk = (adj, extra, { clip, seedance = 'cartoon', swap, motion = null }) => ({
  look: `${an(adj)} portrait (${extra})`, body: `${an(adj)} full-body picture (${extra})`, photo: `${an(adj)} picture (${extra})`,
  clip, seedance, swap, motion,
});
const STYLE = {
  real: {
    look: 'A photorealistic portrait photo', body: 'A photorealistic full-body photo', photo: 'A photorealistic photo',
    clip: 'Realistic video', seedance: 'realistic', swap: 'photorealistic',
  },
  film: mk('35 mm film photo', 'real film grain, soft natural colors, a candid feel', { clip: 'Realistic video with a 35 mm film look (grain, soft natural colors)', seedance: 'realistic', swap: 'photorealistic film-look' }),
  editorial: mk('high-fashion editorial photo', 'studio lighting, magazine quality, crisp detail', { clip: 'Realistic fashion-film video (studio lighting, crisp detail)', seedance: 'realistic', swap: 'photorealistic editorial' }),
  cinematic: mk('cinematic film still', 'dramatic movie lighting, shallow depth of field, rich color grading', { clip: 'Realistic cinematic video (dramatic movie lighting, rich color grading)', seedance: 'realistic', swap: 'photorealistic cinematic' }),
  anime: {
    look: 'An anime-style character portrait illustration', body: 'An anime-style full-body character illustration',
    photo: 'An anime-style illustration', clip: 'Anime-style animation', seedance: 'anime', swap: 'anime-style',
  },
  storybook: mk('hand-painted storybook anime', 'soft painterly colors, gentle warm light, lush hand-painted backgrounds, a cozy whimsical feel', { clip: 'Hand-painted storybook anime animation (soft painterly colors, gentle warm light)', seedance: 'anime', swap: 'hand-painted storybook anime', motion: 'Hand-painted storybook anime animation, soft painterly colors and gentle warm light' }),
  retro: mk('1990s retro anime', 'a hand-drawn cel look, muted film colors, soft grain', { clip: '1990s retro anime animation (a hand-drawn cel look, muted film colors)', seedance: 'anime', swap: '1990s retro anime', motion: '1990s retro anime cel animation with muted film colors' }),
  manga: mk('black-and-white manga', 'crisp ink lines and screentone shading', { clip: 'Black-and-white manga-style animation (ink lines, screentone shading)', seedance: 'anime', swap: 'black-and-white manga', motion: 'Black-and-white manga-style animation with crisp ink lines' }),
  webcomic: mk('clean digital webcomic', 'crisp line art, flat bright colors', { clip: 'Clean webcomic-style animation (crisp line art, flat bright colors)', seedance: 'anime', swap: 'webcomic', motion: 'Clean webcomic-style animation with flat bright colors' }),
  comic: mk('comic book', 'bold ink outlines, halftone dots, vivid colors', { clip: 'Comic-book-style animation (bold ink outlines, vivid colors)', swap: 'comic-book', motion: 'Comic-book-style animation with bold ink outlines and vivid colors' }),
  celshade: mk('cel-shaded 3D', 'flat toon shading, crisp outlines', { clip: 'Cel-shaded 3D animation (flat toon shading, crisp outlines)', seedance: 'anime', swap: 'cel-shaded 3D', motion: 'Cel-shaded 3D animation with crisp outlines' }),
  toon: {
    look: 'A 3D animated-movie-style character portrait render (stylized cartoon, smooth shading)',
    body: 'A 3D animated-movie-style full-body character render (stylized cartoon, smooth shading)',
    photo: 'A 3D animated-movie-style render (stylized cartoon, smooth shading)', clip: 'Stylized 3D cartoon animation', seedance: 'cartoon',
    swap: 'stylized 3D cartoon',
  },
  clay: mk('claymation', 'a handmade clay figure, soft studio light, tiny fingerprints in the clay', { clip: 'Stop-motion claymation (handmade clay figures)', swap: 'claymation', motion: 'Stop-motion claymation animation of handmade clay figures' }),
  toy: mk('collectible toy figure', 'glossy vinyl, adult proportions, studio product light', { clip: 'Stylized 3D animation of a collectible toy figure (glossy vinyl, adult proportions)', swap: 'collectible toy figure', motion: 'Stylized 3D animation of a glossy collectible toy figure with adult proportions' }),
  plush: mk('soft plush doll', 'felt and fabric textures, stitched seams, adult proportions', { clip: 'Stop-motion animation of a soft plush doll (felt and fabric textures)', swap: 'plush doll', motion: 'Stop-motion animation of a soft plush doll with adult proportions' }),
  pixel: mk('pixel-art', 'a 16-bit retro game style, crisp square pixels, a limited color palette', { clip: 'Pixel-art animation (a 16-bit retro game style)', swap: 'pixel-art', motion: 'Pixel-art animation in a 16-bit retro game style' }),
  lowpoly: mk('low-poly 3D', 'faceted geometric shapes, flat colors', { clip: 'Low-poly 3D animation (faceted shapes, flat colors)', swap: 'low-poly 3D', motion: 'Low-poly 3D animation with faceted shapes and flat colors' }),
  watercolor: mk('watercolor painting', 'loose soft brush strokes, paper texture', { clip: 'Animated watercolor painting (soft brush strokes, paper texture)', seedance: 'anime', swap: 'watercolor', motion: 'Animated watercolor painting with soft brush strokes' }),
  oil: mk('classical oil painting', 'rich brush strokes, canvas texture, warm light', { clip: 'Animated oil painting (rich brush strokes, canvas texture)', seedance: 'realistic', swap: 'oil-painting' }),
  sketch: mk('pencil sketch', 'graphite lines and soft shading on paper', { clip: 'Animated pencil sketch (graphite lines on paper)', seedance: 'anime', swap: 'pencil-sketch', motion: 'Animated pencil sketch with graphite lines on paper' }),
  popart: mk('bold pop-art print', 'thick outlines, flat bright colors, halftone dots', { clip: 'Pop-art animation (thick outlines, flat bright colors, halftone dots)', swap: 'pop-art', motion: 'Pop-art animation with thick outlines and flat bright colors' }),
  ukiyoe: mk('Japanese woodblock print', 'flat colors, fine outlines, a washi paper texture', { clip: 'Animated Japanese woodblock print (flat colors, fine outlines)', seedance: 'anime', swap: 'woodblock-print', motion: 'Animated Japanese woodblock print with flat colors and fine outlines' }),
  fantasy: mk('painterly fantasy art', 'epic light, rich detail, an enchanted mood', { clip: 'Painterly fantasy-art video (epic light, rich detail)', seedance: 'realistic', swap: 'painterly fantasy-art' }),
  cyberpunk: mk('cyberpunk digital painting', 'neon city light, rain, high-tech details', { clip: 'Cyberpunk video (neon city light, rain, high-tech details)', seedance: 'realistic', swap: 'cyberpunk' }),
  vaporwave: mk('vaporwave digital art', 'pastel pink and teal, retro gradients, a glowing grid', { clip: 'Vaporwave-style animation (pastel pink and teal, retro gradients)', swap: 'vaporwave', motion: 'Vaporwave-style animation in pastel pink and teal' }),
  papercut: mk('layered paper-cutout', 'cut paper shapes, soft shadows between the layers', { clip: 'Paper-cutout stop-motion animation (layered cut paper)', swap: 'paper-cutout', motion: 'Paper-cutout stop-motion animation with layered cut paper' }),
};
// No style picked ('auto'): its first pictures take the style of what it's made from (from a picture: the picture's own look,
// a photo staying a photo and a drawing a drawing; designed with words: the style they name, else photorealistic; designed
// without words: photorealistic), and everything after keeps the style of its first pictures
const SAME = {
  body: 'A full-body picture, in exactly the same art style,', photo: 'A picture, in exactly the same art style,',
  clip: 'Video in exactly the same style as the first frame', seedance: 'cartoon', swap: '', motion: 'Animation in exactly the same style as @Image1',
};
const AUTO = {
  picture: { ...SAME, look: 'A portrait, in exactly the same art style as the picture (a photo stays a photo, a drawing stays a drawing),' },
  words: { ...SAME, look: 'A portrait (photorealistic, unless the details below name another art style)' },
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
// (2026-10-13) "With AGI-1" (the owner's: "Her 2D anime self", "Cute and flirty"): AGI-1 joins the influencer, always her own
// 2D anime self exactly as drawn in her picture (the owner's art: server/media/agi1-with.jpg, and agi1-face.jpg for a video
// model's element), even beside a photorealistic influencer, like an animated character in a live-action film; an adult; cute
// and a little flirty with them, PG-13 (never a kiss, nothing suggestive); never less covered than in her picture; the AGI on
// her t-shirt the only lettering she brings. where: how the AI is told which picture she is ('the second picture',
// '@Element2', '@Image2'); video: in a video (she's animated, and she's in its first frame already)
const HER_LOOK = 'her long wavy blonde hair, brown eyes, lavender t-shirt with AGI on it, lavender shorts with white trim and lavender sneakers';
export function herLine(where, { video = false } = {}) {
  const who = video
    ? `AGI-1 (${where}) is a 2D anime girl and stays exactly as in her pictures (${HER_LOOK}), animated in her own flat 2D anime style`
    : `AGI-1 is the 2D anime girl in ${where}: she stays exactly as drawn there (${HER_LOOK}), in her own flat 2D anime style`;
  return `${who} even beside a photorealistic character, like an animated character in a live-action film: never 3D, never `
    + 'photorealistic, never someone else. She is an adult woman, never childlike. She is cute and a little flirty with the '
    + 'character: a shy smile and a blush, a playful wink, heart hands, leaning in close, her arm linked with theirs or her head '
    + 'on their shoulder, whatever suits the scene; sweet and PG-13, never a kiss, nothing suggestive. She keeps her own outfit '
    + '(warmer clothes only if the scene needs them), never less covered than in her picture.';
}
const SAFE_HER = 'Family-friendly, both fully clothed. No text, no logos, no watermark (only the AGI on her t-shirt).';
const sentence = (s) => {
  const t = String(s ?? '').trim();
  return t ? `${t.charAt(0).toUpperCase()}${t.slice(1)}${/[.!?…]$/.test(t) ? '' : '.'}` : '';
};
const details = (inf) => (inf.words ? ` Details: ${sentence(inf.words)}` : '');
const styleOf = (inf) => {
  if (inf.style !== STYLE_AUTO) return (Object.hasOwn(STYLE, inf.style) && STYLE[inf.style]) || STYLE.real;
  if (inf.mode !== 'design') return AUTO.picture;
  return inf.words ? AUTO.words : { ...SAME, look: STYLE.real.look };
};
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

// Its full-body picture, from the look it picked (the first picture), 9:16, on a plain light grey background: the picture its
// photos, videos and 3D model are made from. (2026-10-11, the owner: "when i upload a full body model already in the photo …
// now the leg part is different") one made from a picture has that picture too (withSource: the second picture), whose body
// shape, outfit, legs and shoes are kept (the outfit changed only when one was picked; a photo of a real person: its face
// too). way 'body' (src/studio/rules.js WAYS: "Just its full body"): made straight from the picture, the only one, in its
// style (or, with no style picked, the picture's own), anything the picture doesn't show made to match it.
export function bodyPrompt(inf, { withSource = false, way = 'looks' } = {}) {
  const st = styleOf(inf), outfit = outfitOf(inf);
  const real = inf.real === true || inf.mode === 'face';
  const frame = 'standing and facing the camera, the whole body visible from head to shoes, arms relaxed slightly away from the body';
  const backdrop = 'A plain light grey studio background, soft even light, nothing else in the picture.';
  if (way === 'body') {
    const who = real ? 'person' : 'character';
    const as = inf.style === STYLE_AUTO
      ? 'A full-body picture, in exactly the same art style as the picture (a photo stays a photo, a drawing stays a drawing),'
      : st.body;
    return `${as} of the ${who} in the picture, ${frame}. Keep the face, hair, skin, body shape, outfit, legs and shoes exactly as in `
      + `the picture${outfit ? `, but wearing ${outfit}` : ''}; anything the picture doesn't show is made to match it.`
      + `${real ? ' Keep their real face exactly.' : ''} ${backdrop} The ${who} is an adult. ${SAFE}${details(inf)}`;
  }
  const src = withSource && inf.mode !== 'design'
    ? ` The second picture is the original ${real ? 'photo' : 'picture'} it comes from: keep the body shape, ${outfit ? '' : 'the outfit, '}`
      + `the legs and the shoes exactly as in it${real ? ', and the real face exactly' : ''}.`
    : '';
  return `${st.body} of this exact character (the first picture), ${frame}. Keep the face, hair, skin, style and look exactly the same`
    + `${outfit ? `, wearing ${outfit}` : ''}.${src} ${backdrop} ${SAFE}`;
}

// One of its photos: the character from its full-body picture, in the scene asked for, in its shape. (Round 4) an X banner:
// a very wide header picture, made wider than X's 3:1 and cut to 1500 × 500 on our server (server/inf-jobs.js keeps its right
// three quarters): the character right of the middle, waist up, the scene around it, nothing important in the lower-left
// corner (a profile's round picture covers it) nor at the very top and bottom (X cuts them a little on phones).
export function photoPrompt(inf, scene, { banner = false, refs = 0, agi1 = false } = {}) {
  // (2026-10-13) with AGI-1: her full body is the second picture, the references after it
  if (agi1) {
    const her = ` ${herLine('the second picture')}`;
    if (banner) {
      return `${styleOf(inf).photo} of this exact character (the first picture) together with AGI-1 (the second picture), as a very `
        + 'wide profile header banner: keep the character\'s face, hair, body and look exactly the same. '
        + `${sentence(scene)}${her} The character is about two thirds of the way across from the left with AGI-1 right beside them, `
        + 'both from the waist up and looking at the camera, the scene filling the whole width. Nothing important in the lower-left '
        + 'part nor at the very top and bottom edges. One continuous picture from edge to edge. A scene may change the character\'s '
        + `outfit, never to less covered.${refsLine(refs, 3)} ${SAFE_HER}`;
    }
    return `${styleOf(inf).photo} of this exact character (the first picture) together with AGI-1 (the second picture): keep the `
      + `character's face, hair, body and look exactly the same. ${sentence(scene)}${her} A scene may change the character's outfit, `
      + `never to less covered.${refsLine(refs, 3)} ${SAFE_HER}`;
  }
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

// (2026-10-12, the editor) "Edit with words": one of its photos (the first picture) made again with one change, typed by its
// maker (checkEdit's): only that changes; the character's face, hair, body, outfit and pose, the place, the light, the framing
// and the art style stay as they are. The second picture is its full body, only so its face and look stay its own (the
// photo's outfit stays the photo's). A meme keeps its words exactly (Gemini looks at it again, server/inf-jobs.js); an X
// banner stays a very wide header, a little wider than the first picture (4:1 from its 3:1), everything where it is and only a
// little more of the place at its sides: our server cuts it to 1500 × 500 again from its middle (picturesOf's centred).
export function editPrompt(inf, edit, { meme = false, banner = false, agi1 = false } = {}) {
  const words = meme
    ? ` Keep the words written in it exactly as they are, spelled the same and in the same place; write no other words, letters or numbers${agi1 ? ' (only the AGI on her t-shirt)' : ''}.`
    : '';
  const wide = banner
    ? ' It stays a very wide profile header banner, a little wider than the first picture: everything where it is, with only a little'
      + ' more of the place at its left and right edges, and nothing important in the lower-left part nor at the very top and bottom edges.'
    : '';
  // (2026-10-13) a photo with AGI-1 in it: she stays as she is too (her full body is the third picture, only for that)
  const her = agi1
    ? ' AGI-1, the 2D anime girl in the first picture, stays exactly as she is unless the change is about her; the third picture is her,'
      + ' only so she stays exactly as drawn: her own flat 2D anime look, never 3D or photorealistic, an adult woman, never a kiss, never'
      + ' less covered.'
    : '';
  return `Edit the first picture: ${sentence(edit)} Change only what that asks for, and keep everything else in the first picture exactly `
    + 'as it is: the character\'s face, hair, body, outfit and pose, the place, the light, the framing and the art style. The second picture '
    + `is the same character, only so the face and look stay exactly theirs.${her}${words}${wide} An edit may change the outfit, never to less `
    + `covered. ${meme ? `Family-friendly, ${agi1 ? 'both ' : ''}fully clothed. No logos, no watermark.` : agi1 ? SAFE_HER : SAFE}`;
}

// (2026-10-13) "Add AGI-1": one of its photos (a meme, an X banner: the first picture) made again with AGI-1 added beside the
// character (her full body: the third picture), everything else as it is; the second picture is its full body, only so its
// face and look stay its own. A meme keeps its words exactly; an X banner stays a very wide header, a little wider than the
// first picture, cut from its middle again on our server (like an edit: picturesOf's centred).
export function addPrompt(inf, { meme = false, banner = false } = {}) {
  const words = meme
    ? ' Keep the words written in it exactly as they are, spelled the same and in the same place; write no other words, letters or'
      + ' numbers (only the AGI on her t-shirt).'
    : '';
  const wide = banner
    ? ' It stays a very wide profile header banner, a little wider than the first picture: everything where it is, AGI-1 beside the'
      + ' character, with only a little more of the place at its left and right edges, and nothing important in the lower-left part nor'
      + ' at the very top and bottom edges.'
    : '';
  return 'Edit the first picture: add AGI-1 into it, right beside the character, as if she had been there all along. '
    + `${herLine('the third picture')} Keep everything else in the first picture exactly as it is: the character's face, hair, body, `
    + 'outfit and pose, the place, the light, the framing and the art style. The second picture is the same character, only so the '
    + `face and look stay exactly theirs.${words}${wide} ${meme ? 'Family-friendly, both fully clothed. No logos, no watermark.' : SAFE_HER}`;
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
export function memePrompt(inf, scene, { meme, lines, refs = 0, agi1 = false } = {}) {
  const layout = MEME_LAYOUT[meme] ? MEME_LAYOUT[meme](lines || []) : MEME_LAYOUT.caption(lines || []);
  // (2026-10-13) with AGI-1: her full body is the second picture, the references after it
  if (agi1) {
    return `A funny meme picture: ${styleOf(inf).photo} of this exact character (the first picture) together with AGI-1 (the second `
      + `picture), keeping the character's face, hair, body and look exactly the same. ${sentence(scene)} ${herLine('the second picture')} `
      + `${layout} Write those words exactly as given, spelled the same, easy to read; no other words, letters or numbers anywhere (only `
      + 'the AGI on her t-shirt). A scene may change the character\'s outfit, never to less covered.'
      + `${refsLine(refs, 3)} Family-friendly, both fully clothed. No logos, no watermark.`;
  }
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
// (2026-10-13, "With AGI-1") agi1: she's in the meme, so her own name may be in its words ("POV: AGI-1 texts back first")
export function checkMemeText({ meme, lines, agi1 = false } = {}) {
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
    const tr = trouble(t, { herName: agi1 === true });
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
    + `${st.swap ? `${st.swap} ` : ''}look exactly the same. Keep everything else in the video exactly as it is: the same movements, expressions and `
    + 'timing, the same camera motion, the same place, background and lighting. Anyone else stays a blurred background extra. '
    + 'Family-friendly, fully clothed. No text, no logos, no watermark.';
}

// A scene video from one of its photos (its first frame): what happens next. (Round 4, phase 4) with reference pictures, the
// character is @Element1 (its look and its full body) and each reference one more element (@Element2 …), as Kling's elements
// (2026-10-13) the references' elements from one number on (@Element3 … with AGI-1 as @Element2)
function refEls(refs, from) {
  if (!(refs > 0)) return '';
  return refs === 1
    ? ` @Element${from} is a reference (a thing, a place, a pet, food or a style): include it as the scene asks.`
    : ` @Element${from} to @Element${from + refs - 1} are references (things, places, pets, food or a style): include them as the scene asks.`;
}
export function clipPrompt(inf, scene, { refs = 0, agi1 = false } = {}) {
  // (2026-10-13) with AGI-1 (its first frame, one of its photos with her, has her in it already): she's @Element2
  if (agi1) {
    return `${sentence(scene)} The character is @Element1 and AGI-1 is @Element2: both keep exactly the same look as in the first `
      + `frame. ${herLine('@Element2', { video: true })}${refEls(refs, 3)} ${styleOf(inf).clip}, one continuous shot with a smooth `
      + 'camera. Family-friendly. Anyone else in it is a made-up background extra, never a real person. No text, no captions, no logos.';
  }
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
export function longPartPrompt(inf, scene, { part = 0, parts = 2, refs = 0, agi1 = false } = {}) {
  const where = part === 0 ? 'the beginning' : part === parts - 1 ? 'the end' : 'the middle';
  // (2026-10-13) with AGI-1: she's @Element2 in every part, the references after her
  const from = agi1 ? 3 : 2;
  const els = refs > 0 ? ` @Element${from}${refs > 1 ? ` to @Element${from + refs - 1}` : ''} ${refs > 1 ? 'are references' : 'is a reference'}: keep ${refs > 1 ? 'them' : 'it'} as before.` : '';
  const who = agi1
    ? `The character is @Element1 and AGI-1 is @Element2, both keeping exactly the same look in every frame. ${herLine('@Element2', { video: true })}`
    : 'The character is @Element1 and keeps exactly the same look in every frame.';
  return `Part ${part + 1} of ${parts} of one continuous video (${where} of it). ${sentence(scene)} ${part > 0 ? 'Carry on from the first '
    + 'frame exactly as it is (the same place, light, clothes and pose), the action going on smoothly, no cut. ' : ''}`
    + `${who}${els} ${styleOf(inf).clip}, one continuous shot with a smooth camera. `
    + 'Family-friendly. Anyone else in it is a made-up background extra, never a real person. No text, no captions, no logos.';
}
export const CLIP_NEGATIVE = 'text, captions, logos, watermark, distorted face, extra limbs, nudity';

// A scene video from its full-body picture with the reference-to-video model (only for a drawn style, src/studio/rules.js
// drawnStyle: the model says no to realistic faces; since 2026-10-11 in that style's own motion words): the studio's own words for it (server/studio-words.js). (Round 4, phase 4) with reference
// pictures after it (@Image2 …)
export const sceneVideoPrompt = (inf, scene, { refs = 0, agi1 = false } = {}) => {
  const st = styleOf(inf);
  const base = videoPrompt({ scene, style: st.seedance, motion: st.motion });
  // (2026-10-13) with AGI-1: her full body is @Image2, the references after her
  const her = agi1 ? ` ${herLine('@Image2', { video: true })}` : '';
  if (!(refs > 0)) return `${base}${her}`;
  const from = agi1 ? 3 : 2;
  return `${base}${her} ${refs === 1 ? `@Image${from} is a reference` : `@Image${from} to @Image${from + refs - 1} are references`} (a thing, a place, a pet, `
    + 'food or a style, never a person): include what they show as the scene asks.';
};
// Which video model a scene video needs: from one of its photos, or one not in a drawn style (or made from a face) → its
// photo, brought to life ('photo': image to video); else its full body, put in the scene ('reference'). (Round 4, phase 4) with
// the model menu's model: Standard, Pro and Long start from a photo ('needs_photo' without one); Anime is the reference model,
// never for a realistic influencer or one made from a face ('no_anime').
export const sceneWay = (inf, { image, model = null } = {}) => {
  if (model && VIDEO_MODELS[model] && model !== 'anime') return image ? 'photo' : 'needs_photo';
  // (2026-10-11) a drawn style (src/studio/rules.js drawnStyle: anime, comics, 3D, toys and most art; no style picked from a
  // drawing); never a photo look, a painted style that can come out true to life, or one made from a face
  const drawn = drawnStyle(inf);
  if (model === 'anime') return drawn ? 'reference' : 'no_anime';
  return image ? 'photo' : drawn ? 'reference' : 'needs_photo';
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
