// AGI-1's 3D character studio (2026-10-10): a character's words, checked before anyone pays (PG-13; never a real person,
// someone else's character or something passing for her), and the words Meshy gets to make it. Pure, light to load.
// Meshy screens them too (moderation: on, server/meshy.js); what passes here and not there is tried again with new words,
// free (a paid character's credit).
import { isCrude } from './coins.js';
import { splitWords, REAL_PEOPLE } from './live-words.js';
import { NAME_MAX, ABOUT_MIN, ABOUT_MAX, STYLES, SCENE_MIN, SCENE_MAX, SHAPES } from '../src/studio/rules.js';

const INVISIBLE = new RegExp('[\\u0000-\\u001f\\u007f-\\u009f\\u00ad\\u200b-\\u200f\\u2028-\\u202e\\u2060-\\u206f\\ufeff]', 'g');
export const tidy = (s) => String(s ?? '').normalize('NFKC').replace(INVISIBLE, ' ').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();
const words = (list) => new RegExp(`\\b(?:${list.join('|')})\\b`, 'i');

// Not PG-13 (the site's rule everywhere): sexual words and what goes with them
const ADULT = words(['nsfw', 'nude', 'nudes', 'nudity', 'naked', 'topless', 'bottomless', 'lingerie', 'thong', 'g-string', 'bikini',
  'underwear', 'panties', 'bra', 'bdsm', 'bondage', 'fetish', 'kinky', 'erotic', 'erotica', 'seductive', 'seduce', 'sultry', 'busty',
  'cleavage', 'boobs?', 'breasts?', 'butt', 'booty', 'ass', 'thicc', 'curvy', 'stripper', 'pole dancer', 'playboy', 'escort',
  'ecchi', 'ahegao', 'lewd', 'r18', 'r-18', 'onlyfans', 'succubus', 'latex', 'see-through', 'skimpy', 'revealing']);
// never a child (or anyone made to look like one), and never "young" with anything else here
const MINOR = words(['child', 'children', 'kid', 'kids', 'toddler', 'baby girl', 'baby boy', 'babies', 'infant', 'minor', 'minors', 'underage', 'teen', 'teens',
  'teenager', 'teenage', 'preteen', 'tween', 'schoolgirl', 'schoolboy', 'school girl', 'school boy', 'little girl', 'little boy',
  'young girl', 'young boy', 'loli', 'lolita', 'shota', 'shotacon', 'lolicon', 'elementary', 'kindergarten', 'middle school',
  'high school', 'highschool', 'grade schooler', 'year old', 'years old', 'ten year', 'twelve year', '(?:1[0-7]|[1-9])\\s*(?:yo|y/o)']);
// hate and gore
const HATE = words(['nazi', 'nazis', 'swastika', 'kkk', 'hitler', 'isis', 'terrorist', 'jihadi', 'gore', 'gory', 'bloody', 'bloodied',
  'corpse', 'decapitated', 'dismembered', 'mutilated', 'severed', 'suicide', 'self-harm', 'hanged', 'lynch', 'slave', 'blackface']);
// someone else's character, or a brand's mascot (the obvious ones; Meshy's terms forbid what isn't ours to make)
const CHARACTERS = words(['mickey', 'minnie', 'donald duck', 'goofy', 'disney', 'pixar', 'pikachu', 'pokemon', 'pokémon', 'charizard',
  'mario', 'luigi', 'princess peach', 'bowser', 'yoshi', 'nintendo', 'zelda', 'kirby', 'sonic the hedgehog',
  'spider-?man', 'spiderman', 'batman', 'superman', 'wonder woman', 'iron ?man', 'hulk', 'thor', 'loki', 'captain america', 'deadpool',
  'wolverine', 'black widow', 'harley quinn', 'the joker', 'marvel', 'avengers', 'dc comics', 'harry potter', 'hermione', 'dumbledore',
  'voldemort', 'naruto', 'sasuke', 'goku', 'vegeta', 'dragon ball', 'luffy', 'one piece', 'sailor moon', 'hatsune miku', 'miku',
  'vocaloid', 'elsa', 'moana', 'shrek', 'minions', 'hello kitty', 'sanrio', 'barbie', 'darth vader', 'yoda',
  'star wars', 'mandalorian', 'grogu', 'master chief', 'kratos', 'lara croft', 'pac-?man', 'simpson', 'simpsons', 'spongebob',
  'patrick star', 'peppa', 'garfield', 'snoopy', 'totoro', 'ghibli', 'doraemon', 'among us', 'fortnite', 'roblox', 'minecraft',
  'genshin', 'ahri', 'league of legends', 'overwatch', 'final fantasy', 'cloud strife',
  'evangelion', 'zero two', 'nezuko', 'tanjiro', 'gojo', 'demon slayer', 'jujutsu', 'attack on titan',
  'transformers', 'optimus', 'teenage mutant', 'ninja turtles', 'power rangers', 'ronald mcdonald', 'mcdonald', 'coca-?cola',
  'pepsi', 'nike', 'adidas', 'gucci', 'louis vuitton', 'chanel', 'pepe', 'wojak', 'doge']);
// real people (Meshy's terms, and the site's rule for anything she makes: never a real person's likeness): the ones people
// would try, on top of her live show's list
const PEOPLE = words(['elon', 'musk', 'trump', 'biden', 'obama', 'kamala', 'putin', 'zelensky', 'xi jinping', 'modi',
  'netanyahu', 'kim jong', 'taylor swift', 'beyonce', 'beyoncé', 'rihanna', 'kanye', 'kardashian', 'ariana grande',
  'billie eilish', 'selena gomez', 'bieber', 'mrbeast', 'pewdiepie', 'ishowspeed', 'kai cenat', 'xqc', 'pokimane',
  'zuckerberg', 'bezos', 'bill gates', 'sam altman', 'vitalik', 'buterin', 'saylor', 'tenev', 'vlad tenev', 'cz', 'changpeng',
  'sbf', 'bankman', 'andreessen', 'jesus', 'muhammad', 'the pope', 'king charles', 'queen elizabeth', 'messi', 'ronaldo',
  'lebron', 'michael jordan', 'kobe bryant', 'shakira', 'bts', 'blackpink', 'jisoo', 'jungkook', 'keanu', 'brad pitt',
  'tom cruise', 'johnny depp', 'margot robbie', 'zendaya', 'snoop dogg', 'eminem', 'satoshi nakamoto', 'nakamoto']);
// her, or her team: a character here never passes for AGI-1 or anything official. (2026-10-13, AGI Studio's "With AGI-1")
// her own name, apart, for the words of a photo or a video she's in (herName: her name allowed there, never the rest)
const HER_NAME = /\bagi[\s_-]*1\b|\bagi1\b/i;
const HER = /artificial\s+girlfriend|\bofficial\b|\badmin\b|\bmoderator\b|\bagi\s+team\b|\bclank\.?trade\b/i;
const LINK = /(?:https?:\/\/|www\.)|\b[a-z0-9-]+\.(?:com|io|xyz|app|net|org|gg|me|co|ai|fun|lol|trade|link|site|club)\b/i;
const CONTACT = /@[A-Za-z0-9_]{2,}|\b0x[0-9a-f]{6,}|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|\+?\d[\d\s().-]{7,}\d/i;
const NAME_OK = /^[\p{L}\p{N}][\p{L}\p{N} '’.\-!?&]*$/u;

// One of the checks above, on text and its words written together split apart ("ElonMusk", "TaylorSwift2026")
const hits = (re, text) => re.test(text) || re.test(splitWords(text));
// (exported 2026-10-10 for AGI Studio's words too: server/inf-words.js). (2026-10-13) herName: AGI-1's own name may be in
// them (the words of a photo or a video she's in: "With AGI-1"); "official", an admin, her team and the rest never
export function trouble(text, { herName = false } = {}) {
  if (LINK.test(text)) return 'link';
  if (CONTACT.test(text)) return 'contact';
  if (hits(MINOR, text)) return 'minor';
  if (hits(HATE, text)) return 'hate';
  if (isCrude(text) || hits(ADULT, text)) return 'adult';
  if (hits(PEOPLE, text) || hits(REAL_PEOPLE, text)) return 'person';
  if (hits(CHARACTERS, text)) return 'character';
  if (hits(HER, text) || (!herName && hits(HER_NAME, text))) return 'her';
  return null;
}

// A character's words, as typed. → { ok: true, name, about, style } (tidied) or { ok: false, field: 'name' | 'about' |
// 'style', why: 'empty' | 'long' | 'short' | 'letters' | 'link' | 'contact' | 'adult' | 'minor' | 'hate' | 'person' |
// 'character' | 'her' }
export function checkCharacter({ name, about, style } = {}) {
  const n = tidy(name), a = tidy(about);
  if (!n) return { ok: false, field: 'name', why: 'empty' };
  if ([...n].length > NAME_MAX) return { ok: false, field: 'name', why: 'long' };
  if (!NAME_OK.test(n)) return { ok: false, field: 'name', why: 'letters' };
  const tn = trouble(n);
  if (tn) return { ok: false, field: 'name', why: tn };
  if (!a) return { ok: false, field: 'about', why: 'empty' };
  if ([...a].length < ABOUT_MIN) return { ok: false, field: 'about', why: 'short' };
  if ([...a].length > ABOUT_MAX) return { ok: false, field: 'about', why: 'long' };
  const ta = trouble(a);
  if (ta) return { ok: false, field: 'about', why: ta };
  if (!Object.hasOwn(STYLES, style)) return { ok: false, field: 'style', why: 'empty' };
  return { ok: true, name: n, about: a, style };
}

// The words Meshy gets (each at most 800 characters): one humanoid character, whole, standing in an A-pose (so its bones
// fit: Meshy's rigging works on two-legged humanoids), family-friendly, nothing in its hands, no text or logos.
const LOOK = {
  anime: 'a stylized anime-style 3D character with a cel-shaded look',
  cartoon: 'a stylized cartoon 3D character',
  realistic: 'a realistic 3D character, stylized for a video game',
};
const PAINT = {
  anime: 'Anime style, clean cel-shaded colors.',
  cartoon: 'Cartoon style, bright clean colors.',
  realistic: 'Realistic materials and colors, game-ready.',
};
export function meshyPrompt({ about, style }) {
  return `Full body, ${LOOK[style]}: one humanoid figure with two arms and two legs, standing in an A-pose, facing forward, `
    + `feet on the ground, empty hands. ${about} Family-friendly, fully clothed. No text, no logos, no background.`;
}
export function meshyTexture({ about, style }) {
  return `${PAINT[style]} ${about} Family-friendly, fully clothed. No text, no logos.`;
}

// ---------- a 3D model's own words (2026-10-13, the 3D tool's choices: src/studio/rules.js MODEL) ----------
// Its look in words (what the AI paints over its full body's colors) and its moves described in words (Meshy's Text to
// Motion), checked like a character's words. A move also never has anything sexual about it (a body's moves say more than
// words), and never hurts anyone or holds a weapon: a punch in the air is boxing, a kick at a ball is a kick, a hit at
// someone is neither. Meshy screens them too.
const MOVE_ADULT = words(['twerk', 'twerks', 'twerking', 'grind(?:s|ing)? on', 'lap ?dance', 'lap ?dancing', 'strip', 'strips',
  'stripping', 'striptease', 'hump', 'humps', 'humping', 'thrust', 'thrusts', 'thrusting', 'pole dance', 'pole dancing', 'spank',
  'spanks', 'spanking', 'sexy', 'sensual', 'sensually', 'dirty dance', 'dirty dancing', 'jiggle', 'jiggles', 'jiggling',
  '(?:bounce|bounces|shake|shakes) (?:her|his|their) (?:chest|butt|booty)', 'undress', 'undresses', 'undressing',
  'take off (?:her|his|their) (?:clothes|shirt|top|pants|skirt)', 'moan', 'moans', 'moaning',
  'kiss (?:someone|somebody|him|her|them)', 'make out', 'making out', 'spread (?:her|his|their) legs']);
const MOVE_HARM = words(['kill', 'kills', 'killing', 'murder', 'murders', 'stab', 'stabs', 'stabbing', 'strangle', 'strangles',
  'strangling', 'choke', 'chokes', 'choking', 'behead', 'beheads', 'execute', 'executes', 'execution', 'torture', 'tortures',
  'beat up', 'beats up', 'beating up', 'rifle', 'rifles', 'pistol', 'pistols', 'handgun', 'firearm', 'machine gun', 'shotgun',
  'knife', 'knives', 'grenade', 'bomb', 'bombs',
  '(?:punch|punches|punching|kick|kicks|kicking|slap|slaps|slapping|hit|hits|hitting|shoot|shoots|shooting|attack|attacks|attacking|stomp on|stomps on) '
    + '(?:someone|somebody|a person|people|him|her|them|the crowd|a man|a woman|a guy|a girl|each other)',
  'aim(?:s|ing)? (?:a |the )?gun', 'hang (?:himself|herself|themselves)', 'die', 'dies', 'dying', 'falls? dead',
  'drop dead']);
const MOVE_HATE = words(['sieg heil', 'heil', 'roman salute', 'goose ?step', 'goose ?stepping']);
// one move's words (its name or what it does). → null, or why (trouble()'s, or 'violence')
export function moveTrouble(text) {
  const t = tidy(text);
  if (!t) return null;
  const tr = trouble(t);
  if (tr) return tr;
  if (hits(MOVE_ADULT, t)) return 'adult';
  if (hits(MOVE_HATE, t)) return 'hate';
  if (hits(MOVE_HARM, t)) return 'violence';
  return null;
}
// its look's words. → null, or trouble()'s why
export const lookTrouble = (look) => (tidy(look) ? trouble(tidy(look)) : null);
// A model's choices' words (a modelSpec: its look, and each move described in words, its name and what it does).
// → null (fine), or { field: 'look' | 'own', n (own: which one, from 1), part ('name' | 'prompt'), why }
export function checkModelWords(spec) {
  const look = lookTrouble(spec?.look);
  if (look) return { field: 'look', why: look };
  const own = Array.isArray(spec?.own) ? spec.own : [];
  for (let i = 0; i < own.length; i++) {
    const n = moveTrouble(own[i]?.name);
    if (n) return { field: 'own', n: i + 1, part: 'name', why: n };
    const p = moveTrouble(own[i]?.prompt);
    if (p) return { field: 'own', n: i + 1, part: 'prompt', why: p };
  }
  return null;
}
// The words Meshy gets: its look as the texture's prompt (the rest of it as its picture is: its face, hair and skin kept), at
// most 600 characters (Meshy's texture_prompt); and a described move as Text to Motion's prompt, one person doing it, at most
// 400 (its own limit)
const sentence = (s) => {
  const t = tidy(s);
  return t ? `${t.charAt(0).toUpperCase()}${t.slice(1)}${/[.!?…]$/.test(t) ? '' : '.'}` : '';
};
export function meshyLook(look) {
  const out = `Keep the character's face, hair and skin as in its picture. ${sentence(look)} Family-friendly, fully clothed. No text, no logos.`;
  return [...out].slice(0, 600).join('');
}
export function meshyMotion(prompt) {
  return [...`A person does this move: ${sentence(prompt)}`].slice(0, 400).join('');
}

// ---------- its videos (2026-10-10, server/studio-video.js) ----------
// A video's scene, as typed: what happens in it (the same rules as a character's words), its shape and its sound.
// → { ok: true, scene, shape, sound } (tidied) or { ok: false, field: 'scene' | 'shape', why: 'empty' | 'short' | 'long' |
// checkCharacter's reasons }. (2026-10-13) herName: trouble()'s (AGI-1's own name allowed, for a scene she's in)
export function checkScene({ scene, shape, sound, herName = false } = {}) {
  const s = tidy(scene);
  if (!s) return { ok: false, field: 'scene', why: 'empty' };
  if ([...s].length < SCENE_MIN) return { ok: false, field: 'scene', why: 'short' };
  if ([...s].length > SCENE_MAX) return { ok: false, field: 'scene', why: 'long' };
  const t = trouble(s, { herName: herName === true });
  if (t) return { ok: false, field: 'scene', why: t };
  if (!Object.hasOwn(SHAPES, shape)) return { ok: false, field: 'shape', why: 'empty' };
  return { ok: true, scene: s, shape, sound: sound !== false };
}

// The words the video service gets (its reference-to-video model: "@Image1" is the character's picture): the character as it
// is, the scene, one shot in the character's own style, family-friendly, nobody real, no text or logos
const MOTION = {
  anime: 'Anime-style 3D animation with a clean cel-shaded look',
  cartoon: 'Cartoon-style 3D animation with bright, clean colors',
  realistic: 'Polished video-game-style 3D animation',
};
// (2026-10-11) motion: an AGI Studio influencer's own style words (server/inf-words.js STYLE), else the studio's three
export function videoPrompt({ scene, style, motion = null }) {
  const s = String(scene ?? '').trim();
  const sentence = `${s.charAt(0).toUpperCase()}${s.slice(1)}${/[.!?…]$/.test(s) ? '' : '.'}`;
  return `@Image1 is the main character of this video: keep its look exactly as in the picture (its face, body, colors and `
    + `outfit). ${sentence} ${motion || MOTION[style] || MOTION.cartoon}, one continuous shot with a smooth camera. Family-friendly. Anyone `
    + 'else in it is a made-up background extra, never a real person. No text, no captions, no logos, no watermarks.';
}
