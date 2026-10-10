// AGI-1's 3D character studio (2026-10-10): the rules the page and our server share, so both always agree. Pure, no imports.
// (server/studio.js makes the characters; since AGI Studio, the same day, the page is the app: src/studio/app.js and its
// views, and a character's page its 3D view, src/studio/views/model3d.js.)

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

// ---------- AGI Studio (2026-10-10, studio.agi1.app; the owner: "i want it sopmething likehiggsfield ai influencer … and then
// they can launch a token with it on clank … the ui will be different on this it will be user friendly and easy to use") ----
// An AI influencer, made three ways (designed from a few choices, from a picture of a character, or from your own face), then
// its photos, trend videos, scene videos, a 3D model and a coin with its face. Everything is paid in credits, bought with USDG
// from your own wallet app: 1 credit = 1 cent (100 credits for $1). server/influencer.js makes them; src/studio/app.js is the app.

// What each thing costs, in credits, before a holder's discount (DISCOUNT above: Crush 20% off, Soulmate 40% off): the owner's
// numbers. An influencer is its 4 looks and its full-body picture; new looks while picking cost "looks".
export const PRICES = { influencer: 100, looks: 40, photo: 15, trend: 300, video: 400, model: 500 };
export const creditPrice = (what, level) => Math.round(PRICES[what] * (1 - (DISCOUNT[level] ?? 0)));
// A holder's free credits each month (the owner's: "Discounts + free credits"): Crush 100, Soulmate 400 (the whole site's
// free credits a month are capped on our server). A thank-you for holding, never an investment.
export const FREE_CREDITS = { 1: 0, 2: 100, 3: 400 };
// Top-ups: USDG sent from your own wallet app to the studio's wallet; any amount from $1 counts (these are suggestions)
export const TOPUPS = [500, 1000, 2500];
export const TOPUP_MIN = 100;
export const creditsText = (n) => `${Number(n || 0).toLocaleString('en-US')} credit${Number(n) === 1 ? '' : 's'}`;

// How an influencer starts, and its style
export const MODES = {
  design: { name: 'Design it', note: 'Pick a look: we make 4 to choose from.' },
  picture: { name: 'From a picture', note: 'A drawing or a character of yours. Never a photo of a real person.' },
  face: { name: 'Use my face', note: 'Take a selfie: your own AI twin. Only you, 18+.' },
};
export const INF_STYLES = { real: 'Realistic', anime: 'Anime', toon: '3D cartoon' };
// The choices to design one with (each a few words for the AI on our server: server/inf-words.js). Adults only, PG-13.
export const OPTIONS = {
  look: { label: 'Look', for: ['design'], choices: { feminine: 'Feminine', masculine: 'Masculine', androgynous: 'Androgynous' } },
  age: { label: 'Age', for: ['design'], choices: { '20s': '20s', '30s': '30s', '40s': '40s', '50s': '50+' } },
  skin: { label: 'Skin', for: ['design'], choices: { fair: 'Fair', light: 'Light', medium: 'Medium', olive: 'Olive', brown: 'Brown', deep: 'Deep' } },
  hair: { label: 'Hair color', for: ['design'], choices: { black: 'Black', brown: 'Brown', blonde: 'Blonde', red: 'Red', pink: 'Pink', blue: 'Blue', silver: 'Silver', lavender: 'Lavender' } },
  cut: { label: 'Hair style', for: ['design'], choices: { short: 'Short', bob: 'Bob', long: 'Long', curly: 'Curly', wavy: 'Wavy', braids: 'Braids', ponytail: 'Ponytail', buzz: 'Buzz cut' } },
  eyes: { label: 'Eyes', for: ['design'], choices: { brown: 'Brown', hazel: 'Hazel', green: 'Green', blue: 'Blue', grey: 'Grey', violet: 'Violet' } },
  outfit: { label: 'Outfit', for: ['design', 'picture', 'face'], choices: { street: 'Streetwear', cozy: 'Cozy knit', sporty: 'Sporty', smart: 'Smart casual', y2k: 'Y2K', cyber: 'Cyber', gamer: 'Gamer', elegant: 'Elegant' } },
  vibe: { label: 'Vibe', for: ['design', 'picture', 'face'], choices: { cheerful: 'Cheerful', cool: 'Cool', calm: 'Calm', confident: 'Confident', playful: 'Playful', mysterious: 'Mysterious' } },
};
export const WORDS_MAX = 200;

// The trend moves (the owner's, made once with AI on the owner's page, then kept): a made-up dancer doing each move, which
// a trend video copies onto your influencer. Never a real person, no music, nobody's choreography by name.
export const TREND_ID = /^[a-z][a-z0-9-]{1,30}$/;
export const TRENDS = [
  { id: 'heart-hands', name: 'Heart hands', emoji: '🫶', move: 'makes a heart shape with both hands in front of the chest, sways gently from side to side and smiles' },
  { id: 'hip-sway', name: 'Hip sway', emoji: '💃', move: 'does a relaxed hip sway to a beat, shifting weight from foot to foot with loose arms' },
  { id: 'wave-hi', name: 'Wave hello', emoji: '👋', move: 'waves hello with one hand, then with both hands, smiling at the camera' },
  { id: 'peace-pose', name: 'Peace & pose', emoji: '✌️', move: 'shows a peace sign, tilts the head, then strikes a confident pose with one hand on the hip' },
  { id: 'shoulder-shimmy', name: 'Shoulder shimmy', emoji: '✨', move: 'does a playful shoulder shimmy while bouncing lightly on the feet' },
  { id: 'slow-spin', name: 'Slow spin', emoji: '🌀', move: 'turns slowly in one full spin with the arms slightly out, ending facing the camera' },
  { id: 'happy-jump', name: 'Happy jump', emoji: '🦘', move: 'jumps up with joy twice, arms raised, landing softly' },
  { id: 'point-laugh', name: 'Point & laugh', emoji: '👉', move: 'points at the camera, laughs, then covers the mouth with one hand' },
  { id: 'clap-along', name: 'Clap along', emoji: '👏', move: 'claps along to a beat while nodding and stepping from side to side' },
  { id: 'robot-moves', name: 'Robot moves', emoji: '🤖', move: 'does a playful robot dance with stiff arm movements and sharp head turns' },
  { id: 'hair-flip', name: 'Hair flip', emoji: '💁', move: 'flips the hair over one shoulder with a hand and gives a confident look' },
  { id: 'victory-dance', name: 'Victory dance', emoji: '🏆', move: 'does a short victory dance: two fist pumps, a little hop, then both arms up' },
];
export const trendOf = (id) => TRENDS.find((t) => t.id === id) || null;

// Their own clip for a trend video (a move to copy): 2 to 10 seconds, an MP4 or MOV, up to 30 MB, sent in parts of 3.5 MB
// (Vercel takes at most 4.5 MB a request), with 3 small frames of it for the AI check
export const CLIP = { MIN_S: 2, MAX_S: 10, MAX_BYTES: 30_000_000, PART: 3_500_000, FRAMES: 3, FRAME_BYTES: 300_000 };
// A picture or a selfie: made at most 1536 px on its longest side in the browser, then sent (4 MB at most)
export const PICTURE = { MAX_PX: 1536, MAX_BYTES: 4_000_000, POSTER_BYTES: 400_000 };
// Reasons someone can report an influencer or one of its videos
export const REPORT_WHYS = {
  real_person: "It's a real person who didn't agree",
  minor: 'It looks like a minor',
  sexual: "It's sexual or too revealing",
  hate: 'Hate or harassment',
  violence: 'Violence or gore',
  copyright: "It copies someone else's character or work",
  other: 'Something else',
};
// The steps of a 3D model made from an influencer's full-body picture (Meshy: image to 3D, bones, moves, kept)
export const MODEL_STEPS = [
  { step: 'image', words: 'Shaping it' },
  { step: 'rig', words: 'Giving it bones' },
  { step: 'moves', words: 'Teaching it moves' },
  { step: 'save', words: 'Saving it' },
];

// Its files, from our own address (api/launch.js): a picture (<influencer>/<job>-<n>.jpg, and a small one, .webp), a video's
// poster (<influencer or "trends">/<job>.poster.webp), and a video (played in parts, or downloaded)
export const INF_FILE_RE = /^(?:([A-Za-z0-9_-]{22})\/([A-Za-z0-9_-]{22})-([0-3])\.(jpg|webp)|([A-Za-z0-9_-]{22}|trends)\/([A-Za-z0-9_-]{22})\.poster\.webp)$/;
export const infPic = (inf, job, n = 0, small = false) => `/api/launch?inf-file=${inf}/${job}-${n}.${small ? 'webp' : 'jpg'}`;
export const infPoster = (owner, job) => `/api/launch?inf-file=${owner}/${job}.poster.webp`;
export const infVideo = (job) => `/api/launch?inf-video=${job}.mp4`;
export const infVideoDl = (job) => `/api/launch?inf-video-dl=${job}.mp4`;
