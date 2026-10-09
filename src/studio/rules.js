// AGI-1's 3D character studio (2026-10-10): the rules the page and our server share, so both always agree. Pure, no imports.
// (server/studio.js makes the characters; src/studio/page.js is the page.)

// A character's id: 22 random characters (its page: agi1.app/studio/<id>)
export const ORDER_ID = /^[A-Za-z0-9_-]{22}$/;

// Its name and its description, as typed (checked on our server: server/studio-words.js)
export const NAME_MAX = 24;
export const ABOUT_MIN = 10;
export const ABOUT_MAX = 400;

// How it looks: the three styles the page offers (the words Meshy gets for each: server/studio-words.js)
export const STYLES = { anime: 'Anime', cartoon: 'Cartoon', realistic: 'Realistic' };

// The moves every character learns, in the order of its file's clips (Meshy's animation library: each an action id, and
// the name the library gives its clip). Each costs 3 of Meshy's credits once, when it's made. Its page plays them when
// someone types their name (or a word for them: MOVE_WORDS). "idle" is how it stands between moves.
export const MOVES = [
  { name: 'idle', action: 0, clip: 'Idle' },
  { name: 'wave', action: 28, clip: 'Big_Wave_Hello' },
  { name: 'dance', action: 22, clip: 'FunnyDancing_01' },
  { name: 'jump', action: 44, clip: 'Happy_jump_f' },
  { name: 'cheer', action: 59, clip: 'Victory_Cheer' },
  { name: 'bow', action: 41, clip: 'Formal_Bow' },
  { name: 'walk', action: 30, clip: 'Casual_Walk' },
  { name: 'party', action: 64, clip: 'All_Night_Dance' },
];
export const MOVE_NAMES = MOVES.map((m) => m.name);
// moves that go on a while (they loop a few times), the rest play once and it goes back to standing
export const LOOPING = new Set(['dance', 'walk', 'party']);
// what someone may type for each (a whole word, any case, with or without "!" or "/")
export const MOVE_WORDS = {
  wave: ['wave', 'hi', 'hello', 'hey', 'hiya', 'gm', 'yo'],
  dance: ['dance', 'dancing', 'boogie'],
  jump: ['jump', 'hop', 'jumping'],
  cheer: ['cheer', 'yay', 'woo', 'woohoo', 'celebrate', 'win'],
  bow: ['bow', 'thanks', 'thank', 'ty', 'bye'],
  walk: ['walk', 'walking', 'strut'],
  party: ['party', 'groove', 'vibe'],
  idle: ['idle', 'stop', 'rest', 'chill'],
};
const WORD_TO_MOVE = new Map(Object.entries(MOVE_WORDS).flatMap(([move, words]) => words.map((w) => [w, move])));
// The move a chat message asks for: the first word that names one, among the moves this character has. → its name or null
export function moveIn(text, has = MOVE_NAMES) {
  const words = String(text ?? '').toLowerCase().normalize('NFKC').match(/[\p{L}\p{N}]+/gu) || [];
  for (const w of words.slice(0, 40)) {
    const move = WORD_TO_MOVE.get(w);
    if (move && has.includes(move)) return move;
  }
  return null;
}

// What it takes to make one, and the holder discounts (the owner's: "if they hold agi they get a discount"): by the wallet's
// level (src/lib/levels.js: Crush at 10,000+ $AGI held or burned for messages, Soulmate at 1,000,000+). A Soulmate also gets
// one free a month. Never an investment: a discount on a thing to make, nothing more.
export const DISCOUNT = { 1: 0, 2: 0.2, 3: 0.4 };
// → { usdCents: the price in USDG (cents), agi: the price in burned $AGI (whole) } for this level, from the base prices
export function priceFor(level, { usdCents, agi }) {
  const off = DISCOUNT[level] ?? 0;
  return { usdCents: Math.round(usdCents * (1 - off)), agi: Math.round(agi * (1 - off)) };
}
export const usd = (cents) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;

// The steps of the making, as the page names them (each one of Meshy's tasks; then its file kept)
export const STEPS = [
  { step: 'preview', words: 'Shaping it' },
  { step: 'refine', words: 'Painting it' },
  { step: 'rig', words: 'Giving it bones' },
  { step: 'moves', words: 'Teaching it moves' },
  { step: 'save', words: 'Saving it' },
];

// Its files, from our own address (api/launch.js): its 3D model, a picture for the page, and a bigger one to download
export const FILES = { glb: 'model/gltf-binary', webp: 'image/webp', png: 'image/png' };
export const FILE_RE = /^([A-Za-z0-9_-]{22})\.(glb|webp|png)$/;
export const fileUrl = (id, ext) => `/api/launch?studio-file=${id}.${ext}`;

// Its videos (2026-10-10, the owner's: "they can create a viral content with it … they gonna pay crypto like stables instead
// of $agi if they hold agi they get a discount"): the wallet that made a character describes a scene, and an AI video service
// makes a short video of it from its picture (server/studio-video.js). Paid only in USDG, with the same holder discounts.
export const SCENE_MIN = 10;
export const SCENE_MAX = 300;
export const VIDEO_SECONDS = 5;
// its shapes: [the words on the page, where it goes, the video's aspect ratio]
export const SHAPES = {
  tall: { name: 'Vertical', where: 'TikTok, Reels, Shorts', ratio: '9:16' },
  wide: { name: 'Wide', where: 'X, YouTube', ratio: '16:9' },
  square: { name: 'Square', where: 'any feed', ratio: '1:1' },
};
// its file: played from our own address (?studio-video=: in parts, as its player asks), or downloaded (?studio-video-dl=)
export const VIDEO_RE = /^([A-Za-z0-9_-]{22})\.mp4$/;
export const videoUrl = (id) => `/api/launch?studio-video=${id}.mp4`;
export const videoDownload = (id) => `/api/launch?studio-video-dl=${id}.mp4`;
// while it's made: waiting its turn at the video service, being made, its file being kept
export const VIDEO_STEPS = [
  { step: 'queue', words: 'Waiting its turn' },
  { step: 'make', words: 'Making it' },
  { step: 'save', words: 'Saving it' },
];
