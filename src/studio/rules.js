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

// The moves a character can learn (Meshy's animation library: each an action id, and the name the library gives its clip in
// the file), grouped as the page shows them. Each costs 3 of Meshy's credits once, when it's made. Its page plays them when
// someone types their name (or a word for them: `words`, whole words, any case). "idle" is how it stands between moves.
// (2026-10-13, the owner: "i wish theres more tools to customize the 3d like in meshy"; the owner's choice: "Pick its moves
// (Recommended)": up to MODEL.PICKS_MAX of these instead of the same 8 for every model.) loop: a move that goes on a while
// (it loops a few times), the rest play once and it goes back to standing. label: its name on a button.
export const MOVE_GROUPS = {
  greet: 'Greet & talk',
  feel: 'Feelings',
  cheer: 'Celebrate',
  dance: 'Dance',
  walk: 'Walk & run',
  sport: 'Sports & fitness',
  rest: 'Rest',
};
const mv = (name, action, clip, group, label, words, loop = false) => ({ name, action, clip, group, label, words, loop });
export const MOVE_LIBRARY = [
  mv('idle', 0, 'Idle', null, 'Idle', ['idle', 'stop', 'rest', 'chill']),
  mv('wave', 28, 'Big_Wave_Hello', 'greet', 'Wave', ['wave', 'hi', 'hello', 'hey', 'hiya', 'gm', 'yo']),
  mv('bow', 41, 'Formal_Bow', 'greet', 'Bow', ['bow', 'thanks', 'thank', 'ty', 'bye']),
  mv('nod', 25, 'Agree_Gesture', 'greet', 'Nod', ['nod', 'yes', 'yeah', 'yep', 'agree', 'agreed']),
  mv('wag', 409, 'Finger_Wag_No', 'greet', 'Finger wag', ['wag', 'nope', 'nah', 'tsk']),
  mv('shrug', 317, 'Shrug', 'greet', 'Shrug', ['shrug', 'idk', 'dunno']),
  mv('talk', 313, 'Talk_with_Hands_Open', 'greet', 'Talk', ['talk', 'explain', 'speech']),
  mv('phone', 50, 'Phone_Call_Gesture', 'greet', 'Phone call', ['phone', 'call', 'ring']),
  mv('heart', 27, 'Big_Heart_Gesture', 'greet', 'Heart', ['heart', 'love', 'ily', 'luv', 'xoxo']),
  mv('think', 36, 'Confused_Scratch', 'feel', 'Think', ['think', 'thinking', 'hmm', 'hmmm', 'confused', 'huh']),
  mv('sass', 315, 'Hand_on_Hip_Gesture', 'feel', 'Sass', ['sass', 'sassy', 'pose']),
  mv('stomp', 26, 'Angry_Stomp', 'feel', 'Stomp', ['stomp', 'mad', 'angry', 'grr']),
  mv('tired', 31, 'Catching_Breath', 'feel', 'Tired', ['tired', 'phew', 'breathe', 'exhausted']),
  mv('mirror', 48, 'Mirror_Viewing', 'feel', 'Mirror', ['mirror', 'primp', 'glam']),
  mv('cheer', 59, 'Victory_Cheer', 'cheer', 'Cheer', ['cheer', 'yay', 'woo', 'woohoo', 'celebrate', 'win']),
  mv('jump', 44, 'Happy_jump_f', 'cheer', 'Jump', ['jump', 'hop', 'jumping']),
  mv('victory', 403, 'Victory_Fist_Pump', 'cheer', 'Fist pump', ['victory', 'nailed', 'gg']),
  mv('hooray', 298, 'Cheer_with_Both_Hands_Up', 'cheer', 'Hooray', ['hooray', 'hurray', 'hurrah', 'handsup']),
  mv('flex', 388, 'Show_Both_Arm_Muscles', 'cheer', 'Flex', ['flex', 'strong', 'muscle', 'muscles']),
  mv('thumbs', 387, 'Half_Squat_with_Thumb_Up', 'cheer', 'Thumbs up', ['thumbs', 'thumbsup', 'noice']),
  mv('spin', 397, '360_Power_Spin_Jump', 'cheer', 'Spin jump', ['spin', 'twirl']),
  mv('backflip', 452, 'Backflip', 'cheer', 'Backflip', ['backflip', 'flip']),
  mv('dance', 22, 'FunnyDancing_01', 'dance', 'Dance', ['dance', 'dancing', 'boogie'], true),
  mv('party', 64, 'All_Night_Dance', 'dance', 'Party', ['party', 'groove', 'vibe'], true),
  mv('silly', 23, 'FunnyDancing_02', 'dance', 'Silly dance', ['silly', 'goofy', 'funny'], true),
  mv('shuffle', 63, 'Arm_Circle_Shuffle', 'dance', 'Shuffle', ['shuffle'], true),
  mv('bass', 65, 'Bass_Beats', 'dance', 'Bass beats', ['bass', 'beat', 'beats', 'drop'], true),
  mv('bubble', 67, 'Bubble_Dance', 'dance', 'Bubble dance', ['bubble', 'bubbles'], true),
  mv('swing', 75, 'Indoor_Swing', 'dance', 'Swing', ['swing'], true),
  mv('genie', 77, 'Magic_Genie', 'dance', 'Genie', ['genie', 'magic'], true),
  mv('omg', 79, 'OMG_Groove', 'dance', 'OMG groove', ['omg', 'wow'], true),
  mv('bop', 81, 'Pod_Baby_Groove', 'dance', 'Bop', ['bop', 'bopping'], true),
  mv('hiphop', 591, 'Hip_Hop_Dance', 'dance', 'Hip hop', ['hiphop', 'rap'], true),
  mv('breakdance', 395, 'Breakdance_1990', 'dance', 'Breakdance', ['breakdance', 'breaking', 'bboy'], true),
  mv('walk', 30, 'Casual_Walk', 'walk', 'Walk', ['walk', 'walking', 'strut'], true),
  mv('strut', 107, 'Confident_Strut', 'walk', 'Strut', ['strut', 'swagger'], true),
  mv('runway', 117, 'Red_Carpet_Walk', 'walk', 'Runway', ['runway', 'catwalk', 'redcarpet'], true),
  mv('skip', 118, 'Skip_Forward', 'walk', 'Skip', ['skip', 'skipping'], true),
  mv('funky', 554, 'Funky_Walk', 'walk', 'Funky walk', ['funky', 'funk'], true),
  mv('penguin', 62, 'penguin_walk', 'walk', 'Penguin walk', ['penguin', 'waddle'], true),
  mv('run', 14, 'Run_02', 'walk', 'Run', ['run', 'running', 'sprint'], true),
  mv('jacks', 326, 'jumping_jacks', 'sport', 'Jumping jacks', ['jacks', 'jumpingjack', 'jumpingjacks'], true),
  mv('squat', 319, 'air_squat', 'sport', 'Squats', ['squat', 'squats', 'workout'], true),
  mv('pushup', 329, 'push_up', 'sport', 'Push-ups', ['pushup', 'pushups'], true),
  mv('jumprope', 46, 'Jump_Rope', 'sport', 'Jump rope', ['jumprope', 'rope'], true),
  mv('kick', 410, 'Kick_a_Soccer_Ball', 'sport', 'Kick a ball', ['kick', 'soccer', 'football', 'goal']),
  mv('boxing', 385, 'Boxing_Warmup', 'sport', 'Boxing', ['boxing', 'box', 'boxer'], true),
  mv('sit', 362, 'Sit_Cross_Legged', 'rest', 'Sit', ['sit', 'sitdown']),
  mv('drink', 342, 'Stand_and_Drink', 'rest', 'Drink', ['drink', 'sip', 'coffee', 'tea']),
];
export const MOVE_BY_NAME = new Map(MOVE_LIBRARY.map((m) => [m.name, m]));
// The moves every model made before 2026-10-13 learned, in the order of its file's clips (and the 7 picked for a new one
// unless someone picks others): idle, then wave, dance, jump, cheer, bow, walk and party. Each its library entry.
export const MOVES = ['idle', 'wave', 'dance', 'jump', 'cheer', 'bow', 'walk', 'party'].map((n) => MOVE_BY_NAME.get(n));
export const MOVE_NAMES = MOVES.map((m) => m.name);
// the moves picked for a new model when nobody picks others (every move but idle, which comes with every model)
export const DEFAULT_PICKS = MOVE_NAMES.filter((n) => n !== 'idle');
// one order for a model's moves (its file's clips): those 8 first, as before, then the library's
export const MOVE_ORDER = [...MOVE_NAMES, ...MOVE_LIBRARY.map((m) => m.name).filter((n) => !MOVE_NAMES.includes(n))];
// moves that go on a while (they loop a few times), the rest play once and it goes back to standing
export const LOOPING = new Set(MOVE_LIBRARY.filter((m) => m.loop).map((m) => m.name));
// what someone may type for each (a whole word, any case, with or without "!" or "/"), and a move's name on a button
export const MOVE_WORDS = Object.fromEntries(MOVE_LIBRARY.map((m) => [m.name, m.words]));
export const moveLabel = (name) => MOVE_BY_NAME.get(name)?.label || String(name || '');
// every word → the moves it may mean: the move it names first, then the moves listing it, in the library's order (so
// "strut" is the strut, or the walk on a model without it)
const WORD_TO_MOVES = new Map(MOVE_LIBRARY.map((m) => [m.name, [m.name]]));
for (const m of MOVE_LIBRARY) {
  for (const w of m.words) {
    const list = WORD_TO_MOVES.get(w) || [];
    if (!list.includes(m.name)) list.push(m.name);
    WORD_TO_MOVES.set(w, list);
  }
}
// a word or a name some move already answers to (a move described in words never takes one: MODEL)
export const moveWord = (w) => WORD_TO_MOVES.has(String(w || '').toLowerCase());
// The move a chat message asks for: the first word (or two words written together: "hip hop", "jump rope", "thumbs up")
// that names one, among the moves this character has (a move described in words answers to its own name). → its name or null
export function moveIn(text, has = MOVE_NAMES) {
  const words = String(text ?? '').toLowerCase().normalize('NFKC').match(/[\p{L}\p{N}]+/gu) || [];
  const read = words.slice(0, 40);
  for (let i = 0; i < read.length; i++) {
    const tries = i + 1 < read.length ? [`${read[i]}${read[i + 1]}`, read[i]] : [read[i]];
    for (const w of tries) {
      for (const move of WORD_TO_MOVES.get(w) || [w]) if (has.includes(move)) return move;
    }
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
// (Round 4, 2026-10-11: an X banner is a photo made wider and sharper, 2K: about $0.12 of AI, so 22 credits: about 1.8× its
// cost, the owner's choice for every price, so a Soulmate's 40% off still covers it.)
// (2026-10-11) from a picture, two cheaper ways to start (WAYS below): just its full body, one picture of the AI (about $0.08:
// 20 credits), or the photo as it is, no AI at all (10 credits: its checks and its keeping)
export const PRICES = { influencer: 100, looks: 40, photo: 15, banner: 22, trend: 300, video: 400, model: 500, body: 20, asis: 10 };
export const creditPrice = (what, level) => Math.round(PRICES[what] * (1 - (DISCOUNT[level] ?? 0)));
// A holder's free credits each month (the owner's: "Discounts + free credits"): Crush 100, Soulmate 400 (the whole site's
// free credits a month are capped on our server). A thank-you for holding, never an investment.
export const FREE_CREDITS = { 1: 0, 2: 100, 3: 400 };
// Top-ups: USDG sent from your own wallet app to the studio's wallet; any amount from $1 counts (these are suggestions)
export const TOPUPS = [500, 1000, 2500];
export const TOPUP_MIN = 100;
export const creditsText = (n) => `${Number(n || 0).toLocaleString('en-US')} credit${Number(n) === 1 ? '' : 's'}`;

// How an influencer starts, and its style. (Round 2, the owner: "remove the use your face", and photos of real people allowed
// with consent: "From a picture" takes a photo too, with a box ticked first. Ones made before from a face stay as they are.)
export const MODES = {
  design: { name: 'Design it', note: 'Pick a look: we make 4 to choose from.' },
  picture: { name: 'From a photo', note: 'A photo of you, of a friend who said OK, or a character you drew.' },
};
// the box ticked before a picture can be picked (sent with it: our server refuses a picture without it)
export const CONSENT_TEXT = "This is me, someone who said I may use their photo (an adult), or a character of my own.";
// Its style (2026-10-11, the owner: "can you make the style optional and please add more styles like , ghiblifi etc. and many
// more"; the owner's choices: "Their words, else photo (Recommended)", "Storybook anime (Recommended)" for the hand-painted
// anime-film look, and all four groups): 26 styles in four groups, each in our own words (never a studio's, a brand's or an
// artist's name: server/inf-words.js STYLE), and none needed. With no style picked ('auto'), it's the style its words name,
// else a photo look; from a picture, the picture's own look (a photo stays a photo, a drawing stays a drawing). Styles with
// childlike proportions (chibi) aren't offered; a toy figure or a plushie keeps adult proportions.
export const STYLE_GROUPS = [
  { id: 'photo', name: 'Photo looks', styles: { real: 'Realistic', film: 'Film photo', editorial: 'Editorial', cinematic: 'Cinematic' } },
  { id: 'anime', name: 'Anime & comics', styles: { anime: 'Anime', storybook: 'Storybook anime', retro: '90s anime', manga: 'Manga', webcomic: 'Webcomic', comic: 'Comic book', celshade: 'Cel-shaded' } },
  { id: 'toys', name: '3D & toys', styles: { toon: '3D cartoon', clay: 'Claymation', toy: 'Toy figure', plush: 'Plushie', pixel: 'Pixel art', lowpoly: 'Low poly' } },
  { id: 'art', name: 'Art & paint', styles: { watercolor: 'Watercolor', oil: 'Oil painting', sketch: 'Pencil sketch', popart: 'Pop art', ukiyoe: 'Woodblock print', fantasy: 'Fantasy art', cyberpunk: 'Cyberpunk', vaporwave: 'Vaporwave', papercut: 'Paper cutout' } },
];
export const INF_STYLES = Object.fromEntries(STYLE_GROUPS.flatMap((g) => Object.entries(g.styles)));
// no style picked: its words' style, else a photo look (from a picture: the picture's own)
export const STYLE_AUTO = 'auto';
export const STYLE_ANY = 'Any style';
export const styleName = (style) => (style === STYLE_AUTO ? STYLE_ANY : INF_STYLES[style] || null);
// The drawn styles: their faces are drawn, not photographic, so a video can be made straight from the full body by the
// reference-to-video model (VIDEO_MODELS.anime), which says no to realistic faces. The photo looks, and the painted styles
// that can come out true to life (oil painting, fantasy art, cyberpunk), start a video from one of their photos instead.
export const DRAWN_STYLES = ['anime', 'storybook', 'retro', 'manga', 'webcomic', 'comic', 'celshade', 'toon', 'clay', 'toy', 'plush', 'pixel',
  'lowpoly', 'watercolor', 'sketch', 'popart', 'ukiyoe', 'vaporwave', 'papercut'];
// An influencer's style is drawn: one of those, or no style picked from a drawing (a picture that isn't a photo of a real
// person keeps its own look); never one made from a face (before round 2)
export const drawnStyle = (inf) => Boolean(inf) && inf.mode !== 'face' && (DRAWN_STYLES.includes(inf.style)
  || (inf.style === STYLE_AUTO && inf.mode === 'picture' && inf.real !== true));

// How one made from a picture starts (2026-10-11, the owner: "if they already have a full body they can skip the first
// generate so they can save credits or maybe just crop it and put it in their picture"; "Both cheaper ways (Recommended)"):
// 4 looks to pick from (as before), or just its full body (its portrait cut from it), or the photo as it is (no AI: the photo
// is its full body and its face its portrait; only for a photo of the whole person, head to feet, and in the photo's own
// look). Each its price (PRICES: influencer, body, asis).
export const WAYS = {
  looks: { name: '4 looks to pick from', note: 'Pick your favorite of 4, then its full body is made', price: 'influencer', time: 'about two minutes' },
  body: { name: 'Just its full body', note: 'Its full body made from your photo; its portrait cut from it', price: 'body', time: 'about a minute' },
  asis: { name: 'Use my photo as it is', note: 'No AI: your photo is its full body, its face its portrait', price: 'asis', time: 'a few seconds' },
};
export const WAY_FULL_WHY = 'Needs a photo showing the whole person, head to feet';
// The choices to design one with (each a few words for the AI on our server: server/inf-words.js). Adults only, PG-13.
export const OPTIONS = {
  look: { label: 'Look', for: ['design'], choices: { feminine: 'Feminine', masculine: 'Masculine', androgynous: 'Androgynous' } },
  age: { label: 'Age', for: ['design'], choices: { '20s': '20s', '30s': '30s', '40s': '40s', '50s': '50+' } },
  skin: { label: 'Skin', for: ['design'], choices: { fair: 'Fair', light: 'Light', medium: 'Medium', olive: 'Olive', brown: 'Brown', deep: 'Deep' } },
  hair: { label: 'Hair color', for: ['design'], choices: { black: 'Black', brown: 'Brown', blonde: 'Blonde', red: 'Red', pink: 'Pink', blue: 'Blue', silver: 'Silver', lavender: 'Lavender' } },
  cut: { label: 'Hair style', for: ['design'], choices: { short: 'Short', bob: 'Bob', long: 'Long', curly: 'Curly', wavy: 'Wavy', braids: 'Braids', ponytail: 'Ponytail', buzz: 'Buzz cut' } },
  eyes: { label: 'Eyes', for: ['design'], choices: { brown: 'Brown', hazel: 'Hazel', green: 'Green', blue: 'Blue', grey: 'Grey', violet: 'Violet' } },
  outfit: { label: 'Outfit', for: ['design', 'picture'], choices: { street: 'Streetwear', cozy: 'Cozy knit', sporty: 'Sporty', smart: 'Smart casual', y2k: 'Y2K', cyber: 'Cyber', gamer: 'Gamer', elegant: 'Elegant' } },
  vibe: { label: 'Vibe', for: ['design', 'picture'], choices: { cheerful: 'Cheerful', cool: 'Cool', calm: 'Calm', confident: 'Confident', playful: 'Playful', mysterious: 'Mysterious' } },
};
export const WORDS_MAX = 200;

// Example pictures for the design choices (round 2: the owner, "in the make it yours show example of the image not just
// text"): the owner makes each once on the owner's page (an original made-up adult showing only that choice); skin, hair
// color and eyes are shown as color swatches instead. Each key is "<kind>-<choice>" (supabase/influencers.sql's rule).
export const EXAMPLE_KINDS = { style: 'style', look: 'look', age: 'age', cut: 'cut', outfit: 'outfit', vibe: 'vibe' };
export const EXAMPLES = [
  ...Object.keys(INF_STYLES).map((k) => `style-${k}`),
  ...['look', 'age', 'cut', 'outfit', 'vibe'].flatMap((o) => Object.keys(OPTIONS[o].choices).map((k) => `${o}-${k}`)),
];
export const exampleKey = (option, value) => (Object.hasOwn(EXAMPLE_KINDS, option) && EXAMPLES.includes(`${option}-${value}`) ? `${option}-${value}` : null);
export const EXAMPLE_JOB = /^[A-Za-z0-9_-]{22}$/;
export const infExample = (job) => `/api/launch?inf-ex=${job}.webp`;
// the color swatches for the choices that are only a color (CSS colors)
export const SWATCHES = {
  skin: { fair: '#f6dcc8', light: '#eac3a2', medium: '#c99a72', olive: '#b08a5c', brown: '#8a5a3c', deep: '#4e3022' },
  hair: { black: '#1b1716', brown: '#5b3a24', blonde: '#e3c27a', red: '#a8392b', pink: '#f4a6c8', blue: '#4b7bd8', silver: '#c9ccd3', lavender: '#b9a3e3' },
  eyes: { brown: '#6b4226', hazel: '#8e7240', green: '#4f8a5b', blue: '#4a7fc1', grey: '#8d949e', violet: '#8a62c7' },
};

// The trend clips (round 2, the owner: "the trending videos should be real like in higgsfield"): the owner's own short
// cinematic clips, made once with AI on the owner's page (a made-up young adult in each, with its own camera move and sound),
// which a trend video puts your influencer into, keeping the clip's moves, camera, place, light and sound. Like the trending
// templates people make with AI video apps (ours, written for this app: never anyone's video, music or name).
export const TREND_ID = /^[a-z][a-z0-9-]{1,30}$/;
export const TRENDS = [
  { id: 'golden-flip', name: 'Golden hour', emoji: '🌅', camera: 'a slow dolly back in front of them, shallow depth of field',
    scene: 'a sunlit park path at golden hour with a warm low sun and soft lens flare; the person walks toward the camera, flips their hair over one shoulder in slow motion and smiles',
    sound: 'soft park ambience and a warm, dreamy synth pad' },
  { id: 'paparazzi', name: 'Paparazzi', emoji: '📸', camera: 'a steady tracking shot backing away in front of them',
    scene: 'a red-carpet walkway at night lined with out-of-focus photographers; camera flashes pop from both sides as the person walks confidently toward the camera and glances to one side',
    sound: 'camera shutters clicking, flashes popping and a murmuring crowd' },
  { id: 'rooftop-orbit', name: 'Rooftop orbit', emoji: '🌆', camera: 'a smooth 360-degree orbit around them at chest height',
    scene: 'a city rooftop at sunset with the skyline behind; the person stands, turns their head slowly and smiles, the wind moving their hair and clothes',
    sound: 'wind and distant city sounds with a soft cinematic swell' },
  { id: 'neon-zoom', name: 'Neon crash zoom', emoji: '🕹️', camera: 'a fast crash zoom in to a close-up, then a little handheld shake',
    scene: 'a neon-lit arcade at night full of glowing game machines; the person looks up from a game, turns to the camera and grins',
    sound: 'arcade bleeps, a whoosh on the zoom and a punchy bass hit' },
  { id: 'confetti-freeze', name: 'Confetti freeze', emoji: '🎉', camera: 'a slow arc around them while the moment is frozen, like bullet time',
    scene: 'a party with colorful confetti in the air; the person jumps with joy, the moment freezes in mid-air with the confetti hanging still around them, then they land laughing',
    sound: 'party noise, a whoosh into the freeze and a cheer as they land' },
  { id: 'neon-runway', name: 'Neon runway', emoji: '💜', camera: 'a low-angle tracking shot backing away in front of them',
    scene: 'a wet street at night lit by pink and violet neon signs in light rain; the person walks toward the camera with confident runway steps',
    sound: 'rain on the street, footsteps and a deep runway beat' },
  { id: 'night-drive', name: 'Night drive', emoji: '🚗', camera: 'a steady shot from the driver\'s side with a slight road vibration',
    scene: 'the passenger seat of a car at night with city lights streaming past the window; the person rests an arm on the window, looks out, then turns to the camera and smiles',
    sound: 'a soft engine hum, passing traffic and gentle late-night lo-fi music' },
  { id: 'rain-twirl', name: 'Rain twirl', emoji: '☔', camera: 'a slow push in at eye level',
    scene: 'a city street in gentle rain at dusk; the person holds a clear umbrella, twirls once on the spot and laughs',
    sound: 'rain on the umbrella, far-off thunder and a soft piano melody' },
  { id: 'sunset-run', name: 'Sunset run', emoji: '🏖️', camera: 'slow motion, tracking backward in front of them',
    scene: 'a wide beach at sunset with small waves; the person runs along the waterline toward the camera, laughing, their hair moving in the wind',
    sound: 'waves, wind and a warm, uplifting synth' },
  { id: 'front-row', name: 'Front row', emoji: '🎤', camera: 'a handheld shot facing them from the stage side, light beams sweeping past',
    scene: 'the front row of a big concert with bright stage lights and a blurred crowd behind; the person jumps to the beat with one hand in the air, cheering',
    sound: 'a roaring crowd and a big drum beat, instrumental' },
  { id: 'first-snow', name: 'First snow', emoji: '❄️', camera: 'a slow crane down from above to eye level',
    scene: 'a quiet city square at night as the first snow falls under warm streetlights; the person looks up, catches a snowflake in their hand and smiles at the camera',
    sound: 'the soft hush of falling snow, distant bells and a gentle music-box melody' },
  { id: 'fireworks', name: 'Fireworks', emoji: '🎆', camera: 'a steady shot that slowly pushes in as they turn',
    scene: 'a bridge over a river at night with fireworks bursting in the sky behind; the person walks away from the camera, then looks back over their shoulder and smiles',
    sound: 'fireworks booming and crackling, a faint cheering crowd and a cinematic swell' },
];
export const trendOf = (id) => TRENDS.find((t) => t.id === id) || null;
// (2026-10-11, the owner: "they can copy prompt from the trends") a trend clip's prompt as words anyone can copy and use in
// their own tools: its scene, its camera and its sound (the sound left out when it wouldn't fit a scene's box, SCENE_MAX)
export function trendPrompt(t) {
  if (!t?.scene || !t.camera) return '';
  const base = `${t.scene[0].toUpperCase()}${t.scene.slice(1)}. Camera: ${t.camera}.`;
  const full = t.sound ? `${base} Sound: ${t.sound}.` : base;
  return [...full].length <= SCENE_MAX ? full : base;
}

// Their own clip for a trend video (round 2: their influencer put into it, in place of its person): 3 to 10 seconds (the video
// model takes 3 to 10.05), an MP4 or MOV, up to 30 MB, 720 to 2160 pixels on each side, 24 to 60 frames a second (the video
// model's own limits), sent in parts of 3.5 MB (Vercel takes at most 4.5 MB a request), with 3 small frames of it for the AI
// check. Its sound is never used (it could be someone else's music or voice).
export const CLIP = { MIN_S: 3, MAX_S: 10, MAX_BYTES: 30_000_000, PART: 3_500_000, FRAMES: 3, FRAME_BYTES: 300_000, MIN_PX: 720, MAX_PX: 2160, MIN_FPS: 24, MAX_FPS: 60 };
// A picture or a photo: made at most 1536 px on its longest side in the browser, then sent (4 MB at most)
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
// (round 4, phase 2, 2026-10-11) why a mod banned a maker (the page's words; the team's note is its own, never shown to them)
export const BAN_REASONS = {
  real_person: "A real person who didn't agree",
  minor: 'Looked like a minor',
  sexual: 'Sexual or too revealing',
  hate: 'Hate or harassment',
  violence: 'Violence or gore',
  copyright: "Someone else's character or work",
  spam: 'Spam',
  scam: 'A scam, or pretending to be someone',
  other: 'Something else',
};
// …a support ticket's topic, and how many a wallet may have open at once and write in a day (opening one is one)
export const TICKET_TOPICS = {
  payment: 'Credits or a payment',
  making: 'Something I made, or that wasn\'t made',
  account: 'My account, or a ban',
  bug: 'Something broke',
  other: 'Something else',
};
export const TICKETS = { OPEN: 3, MSGS_A_DAY: 20, BODY_MAX: 1000 };
// …and the AI helper: answers a day for a wallet (or a visitor who isn't signed in), and a question's length
export const HELPER = { PER_DAY: 20, QUESTION_MAX: 300 };
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
// (round 2) a photo to download, with the share mark ("Made with AGI Studio"; the video's is on its download too, once the
// clock has made its marked copy)
export const INF_DL_RE = /^([A-Za-z0-9_-]{22})\/([A-Za-z0-9_-]{22})-([0-3])\.jpg$/;
export const infPhotoDl = (inf, job, n = 0) => `/api/launch?inf-dl=${inf}/${job}-${n}.jpg`;

// (2026-10-11, the owner: "they should have an option to change the profile even after generation and on the launch coin an
// option to pick the current profile or choose from their own images") A square framed by its maker in one of its pictures:
// its profile picture (one of its looks, its full body or one of its photos) and its coin's picture. A frame is { x, y, s }:
// its top left corner in thousandths of the picture's width and height, and its side in thousandths of the picture's shorter
// side (FRAME.MIN at least: 5× zoomed in). The same numbers on the page and on our server, whatever size the picture is shown
// at. SIDE: the most a profile picture is kept at (px; a frame smaller than that keeps its own size, never under SMALL, its
// small copy for the pages); COIN: a coin's picture (Launch with AGI-1's pictures are 1 MB at most).
export const FRAME = { MIN: 200, SIDE: 1024, SMALL: 384, COIN: 1024 };
export const isFrame = (f) => Boolean(f) && typeof f === 'object' && [f.x, f.y, f.s].every((v) => Number.isInteger(v))
  && f.x >= 0 && f.x <= 1000 && f.y >= 0 && f.y <= 1000 && f.s >= FRAME.MIN && f.s <= 1000;
// A frame on a picture of w × h pixels → its square in pixels { left, top, side }, always inside the picture (a corner past
// its edge is moved back in)
export function frameBox(f, w, h) {
  const short = Math.min(w, h);
  const side = Math.max(1, Math.min(short, Math.round((Math.min(1000, Math.max(FRAME.MIN, Number(f?.s) || 1000)) / 1000) * short)));
  const left = Math.min(Math.max(0, Math.round(((Number(f?.x) || 0) / 1000) * w)), w - side);
  const top = Math.min(Math.max(0, Math.round(((Number(f?.y) || 0) / 1000) * h)), h - side);
  return { left, top, side };
}
// …and back: a square in pixels → its frame (always one isFrame takes)
export function frameFrom({ left, top, side }, w, h) {
  const short = Math.min(w, h);
  const k = (v) => Math.min(1000, Math.max(0, Math.round(v)));
  return { x: k((left / w) * 1000), y: k((top / h) * 1000), s: Math.min(1000, Math.max(FRAME.MIN, Math.round((side / short) * 1000))) };
}
// The frame a picture starts with: all of its shorter side, a tall picture's top (a full body's head and shoulders down to its
// waist), a wide one's middle
export const frameStart = (w, h) => frameFrom({ left: Math.max(0, (w - Math.min(w, h)) / 2), top: 0, side: Math.min(w, h) }, w, h);
// A coin's picture in its launch draft (server/influencer.js coinDraft, api/launch.js): one of its pictures, and a frame when
// its maker framed one ("studio:<influencer>/<job>-<n>@<x>,<y>,<s>"; before 2026-10-11 always its picked look, never framed)
export const STUDIO_PHOTO = /^studio:([A-Za-z0-9_-]{22})\/([A-Za-z0-9_-]{22})-([0-3])(?:@(\d{1,4}),(\d{1,4}),(\d{1,4}))?$/;
// Its profile picture as the pages show it (an influencer's row: its own picture once its maker framed one, `pfp`, while the
// picture it was framed from is still shown: supabase/influencers.sql inf_pfp_of; else its picked look) → { job, n } or null.
// hidden: a picture taken down (our server's STUDIO_HIDE)
export function portraitRow(x, hidden = null) {
  const p = x?.pfp;
  if (p && typeof p === 'object' && ORDER_ID.test(String(p.id)) && ORDER_ID.test(String(p.job)) && !(hidden && (hidden(p.id) || hidden(p.job)))) {
    return { job: p.id, n: 0 };
  }
  return x?.looks_job && Number.isInteger(x.pick) ? { job: x.looks_job, n: x.pick } : null;
}

// ---------- round 4 (2026-10-11, the owner: "theres should be a percentage when they are creating the 3d model just like in
// meshy so they know how long will it take", "on the photos they can ghenerate the banner on their X as well with the right
// size", "can gerate raedy made captions on their posts, or they can generate one too", and "if they can have their
// username in there [clank.trade] … their username will appear also on the studio") ----------

// How long each part of the making usually takes, in seconds (the AI services' own pages, and our clock's minute): for a
// progress bar and "about N min left". An estimate, never a promise: the step a thing is at comes from our server, and a 3D
// model's step also says its own percentage (Meshy's).
export const TYPICAL = {
  character: [['preview', 120], ['refine', 150], ['rig', 60], ['moves', 100], ['save', 45]],
  model: [['image', 150], ['rig', 60], ['moves', 100], ['save', 45]],
  looks: [['queue', 8], ['make', 35], ['save', 10]],
  body: [['queue', 8], ['make', 25], ['save', 8]],
  // (2026-10-11) a photo used as it is: no AI, only kept (its full body the photo, its portrait cut around its head)
  asis: [['queue', 4], ['save', 4]],
  photo: [['queue', 6], ['make', 22], ['save', 8]],
  banner: [['queue', 6], ['make', 30], ['save', 8]],
  trend: [['queue', 20], ['make', 270], ['save', 20]],
  video: [['queue', 20], ['make', 150], ['save', 15]],
  // (the owner's trend clips: 10 s made from words, with sound)
  clip: [['queue', 20], ['make', 240], ['save', 20]],
  // (2026-10-12, the video editor) a video edited in the browser: waiting for our clock's next minute (its first pieces made
  // there, ffmpeg), its other pieces a minute later, then looked at by Gemini before anyone sees it; a 5-second one (one piece:
  // made in that first minute) is cutSteps(5)
  cut: [['queue', 40], ['make', 5], ['save', 12]],
};
// Where a thing being made is. kind: a TYPICAL key · step: its step now (none known: the time since it started, over the whole
// plan) · stepPct: that step's own percentage (0–100), when known · since: when it started (ms) · stepSince: since when its
// step is known to be the one it's at (ms: the page's first look at it there, so its step started then or earlier) · now.
// Without a percentage of its own, a step is as far along as the time since it started says (its steps before it taking
// their usual time), or as the time it's been seen in this step says, whichever is further: so a step that came sooner than
// usual still moves from the moment it's seen (round 4's browser check: its looks' bar sat at 17% for 8 s otherwise).
// → { pct (1–99), left (seconds), slow (it's taking longer than usual) } or null
// (Round 4, phase 4) plan: a plan of its own instead of TYPICAL[kind] (a video's, by its model and length: videoPlan; a photo's,
// by its model and quality: photoPlan)
export function progressOf(kind, { plan: own = null, step = null, stepPct = null, since = null, stepSince = null, now = Date.now() } = {}) {
  const plan = Array.isArray(own) && own.length ? own : TYPICAL[kind];
  if (!plan) return null;
  const total = plan.reduce((a, [, s]) => a + s, 0);
  const elapsed = Number.isFinite(since) && since > 0 ? Math.max(0, (now - since) / 1000) : null;
  const known = plan.findIndex(([s]) => s === step);
  let doneS;
  if (known < 0 && elapsed !== null) {
    doneS = Math.min(0.95, Math.max(0.02, elapsed / total)) * total;
  } else {
    const at = Math.max(0, known);
    const before = plan.slice(0, at).reduce((a, [, s]) => a + s, 0);
    const cur = plan[at][1];
    const inStep = known >= 0 && Number.isFinite(stepSince) && stepSince > 0 ? Math.max(0, (now - stepSince) / 1000) : null;
    let frac;
    if (Number.isFinite(stepPct) && stepPct > 0) frac = Math.min(0.98, stepPct / 100);
    else if (elapsed !== null || inStep !== null) {
      frac = Math.min(0.9, Math.max(elapsed !== null ? 0.03 : 0.05, elapsed !== null ? (elapsed - before) / cur : 0, inStep !== null ? inStep / cur : 0));
    } else frac = 0.05;
    doneS = before + frac * cur;
  }
  return {
    pct: Math.max(1, Math.min(99, Math.round((doneS / total) * 100))),
    left: Math.max(5, Math.round(total - doneS)),
    slow: elapsed !== null && elapsed > total * 1.6,
  };
}

// The X banner: a photo made wide, then cut to exactly X's header size (1500 × 500) on our server. Photos may be any of the
// video shapes or this one (a banner can't start a video or a trend: those are tall, wide or square).
export const BANNER = { W: 1500, H: 500 };
export const PHOTO_SHAPES = { ...SHAPES, banner: { name: 'X banner', where: 'your X header, 1500 × 500', ratio: '3:1' } };

// Captions for a post (each creation's own): ready-made ones (free: src/studio/captions.js), or written by AI in a tone, for
// a platform (free, CAPTIONS_A_DAY a wallet: our server, server/inf-captions.js)
export const CAPTION_PLATFORMS = { x: { name: 'X', max: 270 }, tiktok: { name: 'TikTok', max: 300 }, instagram: { name: 'Instagram', max: 600 } };
export const CAPTION_TONES = { funny: 'Funny', flirty: 'Flirty', aesthetic: 'Aesthetic', hype: 'Hype', wholesome: 'Wholesome' };
export const CAPTIONS_A_DAY = 30;

// clank.trade usernames (its own rule: 3 to 32 letters, numbers or _, any case, kept lowercase): someone may show theirs in
// AGI Studio once our server has read their clank.trade profile and its wallet is the one they connected here
export const CLANK_NAME = /^[A-Za-z0-9_]{3,32}$/;
export const clankProfileUrl = (name) => `https://clank.trade/@${encodeURIComponent(String(name || ''))}`;

// ---------- (round 4, phase 3, 2026-10-11) gifts of credits, and invites ----------
// The owner's choices: "gifting bought credits only" (to a wallet, an @name or a gift link; at most 50,000 credits a day), and
// invites for credits only (a friend's 100 credits with its first top-up; its inviter 10% of what it buys, at most 500 credits
// from one friend and 5,000 a month). Our server can change the numbers (STUDIO_GIFTS_A_DAY, STUDIO_REF_…): the page shows the
// ones ?inf-info gives.
//   • A gift: some of your BOUGHT credits (never this month's free ones or bonus ones) to another wallet, by its address or the
//     clank.trade name it shows here, or a gift link anyone with it can claim once (held until then; you can take it back while
//     nobody has; after LINK_DAYS days it comes back by itself). GIFTS: the fewest credits a gift, the most a day, gifts a day
//     (links included), gift links open at once, a link's days, a note's length (80 until 2026-10-12; 200 since, the
//     owner's "Up to 200 characters (Recommended)", for every gift's message).
export const GIFTS = { MIN: 10, A_DAY: 50_000, PER_DAY: 20, OPEN_LINKS: 10, LINK_DAYS: 30, NOTE_MAX: 200 };
//   • (2026-10-12) The owner's gift links of free credits. The owner: "i can put the a custome value of credits there then
//     i can sent a message then theres gonna be a link for it then when i sahre it to someone they can see the meesage and
//     the gifted credits and they can claim it"; the owner's choices: "Mine, free credits (Recommended)", "Up to 200
//     characters (Recommended)", "Once (Recommended)". From the owner's tab only: any number of credits (MIN to MAX a
//     link), the owner's message, a link anyone with it claims once, as bonus credits (paid from the owner's own AI
//     balance, like credits for testing; never given on as a gift). OPEN links waiting at once, each for DAYS days (then
//     nothing comes back: nothing was held). Claiming one while AGI Studio is private lets that wallet in.
export const OWNER_LINKS = { MIN: 1, MAX: 100_000, OPEN: 50, DAYS: 30 };
//   • Invites: a wallet that never bought credits joins through someone's invite link once; it gets WELCOME bonus credits with
//     its first top-up of WELCOME_MIN cents or more, and its inviter PERCENT% of each of its top-ups as bonus credits (PER_FRIEND
//     at most from one friend, A_MONTH a month). Bonus credits never run out and come back when something can't be made, but
//     they're never passed on as a gift.
export const REFERRALS = { WELCOME: 100, WELCOME_MIN: 500, PERCENT: 10, PER_FRIEND: 500, A_MONTH: 5000 };
// an invite code (8 letters and numbers, never 0, 1, i, l or o: easy to read out), and a gift link's secret
export const REF_CODE = /^[a-hj-km-np-z2-9]{8}$/;
export const GIFT_TOKEN = /^[A-Za-z0-9_-]{22}$/;
// where they lead: any page of the app with ?ref=<code> (the code kept in the browser until a wallet signs in), and a gift
// link's secret after "#gift=" (never sent to a server with the page's address)
export const inviteLink = (origin, base, code) => `${origin}${base}/explore?ref=${code}`;
export const giftLink = (origin, base, token) => `${origin}${base}/explore#gift=${token}`;

// ---------- (round 4, phase 4, 2026-10-11) the model menu, long videos, memes, Instant ----------
// The owner's choices: a menu of photo and video models ("references, seconds, quality"), each price about 1.8× what its AI
// costs (MARKUP: so a Soulmate's 40% off still covers it), long videos up to a minute, memes (a kind of photo: its format and
// its words, which the AI writes into the picture) and Instant (one tap on a ready-made idea: src/studio/instant.js).
export const MARKUP = 1.8;
// credits for an AI cost in cents (a cent may have decimals: a video's cents a second): MARKUP × it, rounded up (to the
// thousandth first, so 1.8 × 5 is 9, never 10 by a floating-point hair)
export const creditsFor = (cents) => Math.ceil(Math.round(MARKUP * cents * 1000) / 1000);
const offFor = (n, level) => Math.round(n * (1 - (DISCOUNT[level] ?? 0)));

// Photo models (both on fal: server/inf-ai.js). Classic is Nano Banana 2's edit (1K, 2K or 4K: $0.08, $0.12, $0.16): X
// banners and memes are always Classic (it writes words into pictures best). Crisp is Seedream 4.5's edit ($0.04 a picture,
// 2K or 4K: it makes nothing smaller). refs: the reference pictures someone may add (things, places, pets, food, a style).
export const PHOTO_QUALITY = { std: { name: 'Standard', px: '1K' }, hd: { name: 'HD', px: '2K' }, ultra: { name: 'Ultra', px: '4K' } };
export const PHOTO_MODELS = {
  classic: { name: 'Classic', note: 'True to life, and keeps faces closest', cents: { std: 8, hd: 12, ultra: 16 }, refs: 4 },
  crisp: { name: 'Crisp', note: 'Bold color and sharp detail, always HD', cents: { hd: 4, ultra: 4 }, refs: 4 },
};
// A photo as asked for, tidied: → { model, quality } (an X banner and a meme are Classic; a banner is HD, its size fixed) or
// null when it isn't one the menu offers
export function photoSpec({ model = null, quality = null, shape = 'tall', meme = null } = {}) {
  const m = model ?? 'classic';
  if (!Object.hasOwn(PHOTO_MODELS, m)) return null;
  if (shape === 'banner') return m === 'classic' && (quality === null || quality === 'hd') && !meme ? { model: 'classic', quality: 'hd' } : null;
  if (meme && m !== 'classic') return null;
  const q = quality ?? (m === 'crisp' ? 'hd' : 'std');
  return Object.hasOwn(PHOTO_MODELS[m].cents, q) ? { model: m, quality: q } : null;
}
// what a photo costs, in credits, for this level (null: not one the menu offers)
export function photoCredits(spec, level = 1) {
  const s = photoSpec(spec || {});
  return s ? offFor(creditsFor(PHOTO_MODELS[s.model].cents[s.quality]), level) : null;
}
// (2026-10-12, the editor) "Edit with words" (the owner's choice: "type a change … a new photo from that one; same price as a
// photo"): a change typed in words (EDIT.MIN to EDIT.MAX characters, checked like a scene), and a new photo made from one of its
// own photos (a meme, an X banner) by Classic, next to it: the same shape and quality (a Crisp photo's own quality, by
// Classic), an X banner still one (1500 × 500), a meme still that meme with its words. → { model, quality, shape, meme } (what
// photoSpec and photoCredits take: its price is that photo's) or null when it isn't one of its photos
export const EDIT = { MIN: 3, MAX: 200 };
export function editSpec(photo) {
  if (!photo || photo.kind !== 'photo') return null;
  const shape = Object.hasOwn(PHOTO_SHAPES, photo.shape) ? photo.shape : 'tall';
  if (shape === 'banner') return { model: 'classic', quality: 'hd', shape, meme: null };
  return { model: 'classic', quality: ['hd', 'ultra'].includes(photo.quality) ? photo.quality : 'std', shape, meme: photo.meme || null };
}

// (2026-10-12, the editor) the photo editor (the owner's choices: "Photo editor (Recommended)", "New photo + download
// (Recommended)"): one of its own photos (a meme, an X banner) cropped, turned, lit, filtered, with words and stickers on it,
// in the visitor's own browser: free, no AI. Downloaded with the share mark (drawn here, as our server draws it), or saved as a
// new photo next to it: our server looks at it first (Gemini, about $0.001: PER_DAY a wallet, SITE_DAY for the whole site) and
// checks its words like a meme's. A crop is one of the photo shapes (an X banner stays as it is: 1500 × 500).
export const EDITOR = {
  PER_DAY: 20,                   // photos one wallet may save from it a day
  SITE_DAY: 2000,                // …and the whole site
  PX: 1536,                      // a saved photo's longest side at most (its picture's own size, never more)
  LAYERS: 8,                     // words and stickers on one photo
  TEXT_MAX: 80,                  // one text's characters
  ZOOM_MAX: 4,                   // a crop's closest
};
export const EDITOR_CROPS = { original: 'Original', tall: 'Vertical', square: 'Square', wide: 'Wide' };
export const EDITOR_FILTERS = { none: 'Original', vivid: 'Vivid', warm: 'Warm', cool: 'Cool', mono: 'Mono', vintage: 'Vintage', fade: 'Fade', noir: 'Noir' };
export const EDITOR_LIGHT = { bright: 'Brightness', contrast: 'Contrast', sat: 'Saturation', warm: 'Warmth' };
export const EDITOR_FONTS = { clean: 'Clean', bold: 'Bold', classic: 'Classic' };
export const EDITOR_COLORS = { white: '#ffffff', black: '#111111', pink: '#ff5fa8', yellow: '#ffd84d', mint: '#5ef0c8', violet: '#a98bff' };
export const EDITOR_STYLES = { outline: 'Outline', box: 'Box', plain: 'Plain' };
export const STICKERS = ['💜', '✨', '🔥', '😎', '⭐', '👑', '🌸', '🎀', '☀️', '🌈', '💫', '🦋', '🍓', '☕', '🎧', '📸'];
// the share mark's size and place on a picture (server/inf-mark.js MARK, the same numbers): its width a share of the shorter
// side, its distance from the bottom right corner
export const MARK_LOOK = { SHARE: 0.36, MARGIN: 0.035, MIN_W: 120 };

// (2026-10-12, the editor) the video editor (the owner's choice: "Video editor": "trim, text on it (a layer drawn in the
// browser as a PNG, so the server needs no fonts), change its shape (9:16, 1:1, 16:9); ffmpeg on our server makes an H.264
// MP4 (the clock's function, like the share mark); free, 10 a day per wallet"): one of its own videos or trend videos trimmed
// (1 to 15 seconds of it), its shape changed (a crop, zoomed and moved), its words and stickers drawn in the visitor's browser
// as one transparent picture, saved as a new video next to it: made by our clock (src/studio/video-edit.js, server/inf-cut.js)
// with the share mark, looked at by Gemini before anyone sees it.
export const VIDEO_EDITOR = {
  PER_DAY: 10,                   // videos one wallet may save from it a day
  SITE_DAY: 500,                 // …and the whole site
  MIN_S: 1,                      // a cut's shortest
  MAX_S: 15,                     // …and longest
  ZOOM_MAX: 2.5,                 // a crop's closest
  OPEN: 3,                       // being made at once, per wallet
  MIN_BOX_PX: 64,                // a crop's shorter side, at least, in the video's own pixels
  AREA: 921_600,                 // "Original": at most 1280 × 720's pixels (its own shape, made smaller to fit)
};

// Video models. Standard and Pro are Kling V3's image to video (720p or 1080p: $0.084 or $0.112 a second, with sound $0.126
// or $0.168), from one of its photos; Anime is Seedance 2.5's reference to video ($0.2205 a second at 480p, $0.473 at 720p,
// its sound free), from its full body or a photo, only for an influencer in a drawn style (DRAWN_STYLES, drawnStyle(): it says
// no to realistic faces);
// Long is Kling V3 Standard made in parts (each starting from the last frame of the one before), up to a minute, without sound
// (its parts' sounds wouldn't join up: add your own music when you post it).
export const VIDEO_MODELS = {
  standard: { name: 'Standard', note: '720p, natural motion', seconds: [5, 10, 15], cents: { silent: 8.4, sound: 12.6 }, refs: 2, photo: true },
  pro: { name: 'Pro', note: '1080p, the finest detail', seconds: [5, 10, 15], cents: { silent: 11.2, sound: 16.8 }, refs: 2, photo: true },
  anime: { name: 'Anime', note: 'For drawn styles: anime, comics, 3D, toys and art', seconds: [5, 10, 15], cents: { '480p': 22.05, '720p': 47.3 }, refs: 4, photo: false, styles: DRAWN_STYLES },
  long: { name: 'Long', note: 'Up to a minute, made in parts, without sound', seconds: [20, 30, 45, 60], cents: { silent: 8.4 }, refs: 2, photo: true },
};
export const ANIME_QUALITY = { '480p': { name: '480p' }, '720p': { name: '720p' } };
// a long video's parts: 20 s is 2 of 10 s, 30 s 2 of 15, 45 s 3 of 15, 60 s 4 of 15 (Kling makes 3 to 15 s at once)
export const LONG = { PART_MAX: 15, MAX_S: 60 };
export const partsOf = (seconds) => Math.max(1, Math.ceil(Number(seconds) / LONG.PART_MAX));
// A video as asked for, tidied: → { model, seconds, sound, quality, parts } or null when it isn't one the menu offers (an
// older page sends none of it: Standard, 5 s, as before)
export function videoSpec({ model = null, seconds = null, sound = false, quality = null } = {}) {
  const m = model ?? 'standard';
  const v = VIDEO_MODELS[m];
  if (!v || !Object.hasOwn(VIDEO_MODELS, m)) return null;
  const s = seconds === null || seconds === undefined || seconds === '' ? v.seconds[0] : Number(seconds);
  if (!v.seconds.includes(s)) return null;
  if (m === 'anime') {
    const q = quality ?? '720p';
    if (!Object.hasOwn(v.cents, q)) return null;
    return { model: m, seconds: s, sound: sound === true, quality: q, parts: 1 };
  }
  if (quality !== null && quality !== undefined) return null;
  if (m === 'long') return sound === true ? null : { model: m, seconds: s, sound: false, quality: null, parts: partsOf(s) };
  return { model: m, seconds: s, sound: sound === true, quality: null, parts: 1 };
}
// its AI cost in cents (Anime's sound is free; the others' sound costs more a second)
export function videoCents(spec) {
  const s = videoSpec(spec || {});
  if (!s) return null;
  const c = VIDEO_MODELS[s.model].cents;
  const perSecond = s.model === 'anime' ? c[s.quality] : c[s.sound ? 'sound' : 'silent'];
  return perSecond * s.seconds;
}
// what a video costs, in credits, for this level (null: not one the menu offers)
export function videoCredits(spec, level = 1) {
  const c = videoCents(spec);
  return c === null ? null : offFor(creditsFor(c), level);
}

// Reference pictures (the owner: "references"): someone's own pictures of a thing, a place, a pet, food or a style to put in
// a photo, a meme or a video, uploaded like a picture (made plain, at most 1536 px) and looked at by the AI first. Never a
// person: their influencer is the person (a picture of someone is refused). Each kept a day.
export const REFS = { MAX: 4, NOTE: 'A thing, a place, a pet, food or a style to include: never a person (your influencer is the person).' };
// (2026-10-13) with AGI-1 in a Standard, Pro or Long video, one less: Kling takes 3 elements at most with a first frame (the
// character, AGI-1, then the references); a photo (Nano Banana takes 14 pictures) and Anime (Seedance) keep theirs
export const refsFor = (what, model, agi1 = false) => {
  if (what !== 'video') return PHOTO_MODELS[model]?.refs ?? 0;
  const n = VIDEO_MODELS[model]?.refs ?? 0;
  return agi1 === true && model !== 'anime' ? Math.max(0, n - 1) : n;
};

// (2026-10-13) "With AGI-1" (the owner's choices: "Her 2D anime self", "Cute and flirty", "Same as without her", "Yes, kept
// private"): AGI-1 in an influencer's photo, meme, X banner or video, together with it, as her own 2D anime self (the owner's
// art: never 3D, never photorealistic, even next to a realistic influencer), cute and a little flirty, PG-13, at the same
// price as without her. A photo with her is made by Classic (it keeps her exactly as drawn); "Add AGI-1" puts her into one of
// its done photos (a photo's price at its quality, like Edit with words); a Standard, Pro or Long video with her starts from a
// photo she's in (she's in its first frame), and Anime puts her in from her own pictures. Never in a trend video (it puts the
// influencer in place of one person in a clip). One made from a real person's photo may have her too, and stays private.
export const WITH_AGI1 = {
  NAME: 'With AGI-1',
  NOTE: 'AGI-1 joins your influencer: her own 2D anime self, cute and a little flirty. The same price.',
  PHOTO_MODEL: 'classic',
  KINDS: ['photo', 'video'],
  // her face on the page's switch: the owner's own 2D art (the front's, public/images/landing/agi1-face.webp: never her 3D
  // model, or a picture rendered from it)
  FACE: '/images/landing/agi1-face.webp',
};
// (2026-10-13) her own name in someone's words ("a photo with AGI-1"): allowed only in a photo or a video she's in (our
// server's server/studio-words.js HER_NAME says the same); the page then says to switch "With AGI-1" on
export const mentionsAgi1 = (text) => /\bagi[\s_-]*1\b|\bagi1\b/i.test(String(text || ''));
// its done photos AGI-1 is in (a Standard, Pro or Long video with her starts from one), and its photos to start a trend video
// from (never one she's in: a trend video puts the influencer in place of one person)
export const herPhotos = (jobs) => startPhotos(jobs).filter((j) => j.agi1 === true);

// Memes (the owner's "memes with their photo and several references"): a photo of the influencer in a meme's format, its words
// written into the picture by the AI. Each format's lines (two lines: "top\nbottom"), MEME_LINE_MAX characters each. A meme's
// words follow the captions' rules: PG-13, never about money, coins, prices or buying.
export const MEMES = {
  topbottom: { name: 'Top & bottom', lines: ['Top', 'Bottom'], note: 'Bold white words at the top and the bottom' },
  caption: { name: 'Caption', lines: ['Caption'], note: 'A line of words above the picture, like a post' },
  pov: { name: 'POV', lines: ['POV:'], note: 'Starts with “POV:”' },
  reaction: { name: 'Reaction', lines: ['Caption'], note: 'A big reaction face, your words under it' },
  twopanel: { name: 'Before / after', lines: ['Left panel', 'Right panel'], note: 'Two panels side by side, a label on each' },
};
export const MEME_LINE_MAX = 60;
export const MEME_ID = /^[a-z]{2,12}$/;

// How long a video usually takes (round 4's progress bars): longer videos take longer at the AI service; a long video is its
// parts one after another (each made, then kept by our clock), then joined. → a TYPICAL-like plan
export function videoPlan({ model = 'standard', seconds = 5, parts = 1 } = {}) {
  if (model === 'long' || parts > 1) {
    const n = Math.max(1, Number(parts) || partsOf(seconds));
    const each = Math.round(Number(seconds) / n) || LONG.PART_MAX;
    const plan = [];
    for (let p = 0; p < n; p++) plan.push([`p${p}-queue`, 20], [`p${p}-make`, 90 + 12 * each], [`p${p}-save`, 45]);
    plan.push(['join', 40]);
    return plan;
  }
  const s = Number(seconds) || 5;
  if (model === 'anime') return [['queue', 20], ['make', 120 + 15 * s], ['save', 15]];
  if (model === 'pro') return [['queue', 20], ['make', Math.round(1.25 * (90 + 12 * s))], ['save', 15 + s]];
  return [['queue', 20], ['make', 90 + 12 * s], ['save', 10 + s]];
}
// the step a long video is at, as its plan names it (its part, and its part's step; "join" once its parts are made)
export const longStep = (part, parts, step) => (Number(part) >= Number(parts) ? 'join' : `p${Number(part) || 0}-${step || 'queue'}`);
// How long a photo usually takes, by its model and quality (a bigger picture takes longer to make and to keep; a meme's words a
// little longer); an X banner: TYPICAL.banner
export function photoPlan({ model = 'classic', quality = null, meme = null } = {}) {
  const q = quality || (model === 'crisp' ? 'hd' : 'std');
  const make = model === 'crisp' ? (q === 'ultra' ? 35 : 25) : q === 'ultra' ? 45 : q === 'hd' ? 30 : 22;
  return [['queue', 6], ['make', make + (meme ? 6 : 0)], ['save', q === 'ultra' ? 14 : q === 'hd' ? 10 : 8]];
}
// (2026-10-12, the video editor) How long a cut usually takes. Our clock comes once a minute (half a minute's wait on average)
// and makes its pieces of 5 seconds there (server/inf-mark.js CUT.PIECE_S: about 4 to 5 s each on one processor, measured
// 2026-10-12, two in that first minute), while its page still says it's waiting (its request is set once they're kept). One
// piece (under 6 s) is joined in that same minute; two or three are joined the next minute (its "make" step). Then Gemini's
// look (its page's, at once). → a TYPICAL-like plan (cutSteps(5) is TYPICAL.cut)
export function cutSteps(seconds = 5) {
  const s = Math.min(VIDEO_EDITOR.MAX_S, Math.max(VIDEO_EDITOR.MIN_S, Number(seconds) || 5));
  // (as cutPlan splits it: at 24 frames a second, a last piece under a second goes into the one before)
  const pieces = Math.max(1, Math.ceil((Math.round(s * 24) - 23) / 120));
  return [['queue', 40], ['make', pieces > 1 ? 65 : 5], ['save', 12]];
}
// One of its photos, videos or trend videos being made (as our server shows it: src/studio/views/influencer.js): its plan and
// its step now (a long video's part and that part's step)
export function jobPlan(j) {
  if (j?.kind === 'photo') return j.shape === 'banner' ? TYPICAL.banner : photoPlan({ model: j.model || 'classic', quality: j.quality, meme: j.meme });
  // (2026-10-12) a video saved from the video editor: made by our clock in pieces, then looked at
  if (j?.kind === 'video' && j.editor === true) return cutSteps(j.seconds || 5);
  if (j?.kind === 'video') return videoPlan({ model: j.model || 'standard', seconds: j.seconds || 5, parts: j.parts || 1 });
  return TYPICAL[j?.kind] || null;
}
export const jobStep = (j) => (j?.kind === 'video' && Number(j.parts) > 1 ? longStep(j.part, j.parts, j.step) : j?.step || 'queue');
// Its newest photo a video can start from (never an X banner or a meme: a meme's words in a video come out garbled)
export const startPhotos = (jobs) => (jobs || []).filter((j) => j.kind === 'photo' && j.status === 'done' && j.shape !== 'banner' && !j.meme);

// ---------- (2026-10-13) the 3D model's choices, like a 3D tool's (the owner: "i wish theres more tools to customize the 3d
// like in meshy, please fixx and make it better"; the owner's choices: "Pick its moves (Recommended)", "Shape and look
// (Recommended)", "3D page tools (Recommended)", "More downloads"; "Per extra, ~1.8× (Recommended)"; "30 days
// (Recommended)") ----------
// Its moves: up to PICKS_MAX of the library's (PICKS_FREE in its price, each one past that MODEL_EXTRAS.move), and up to
// OWN_MAX moves described in words (Meshy's Text to Motion: each MODEL_EXTRAS.own). Its shape and look: its detail
// (MODEL_DETAIL: High detail costs MODEL_EXTRAS.high), shine (PBR maps: metal, roughness and bumps), its pose (A or T), its
// height (cm: its bones' scale) and its look changed with words (what the AI paints, the rest of it from its full body). And
// more downloads (DL_FORMATS: made once it's ready, kept DL_DAYS days). Everything else in it is free; a holder's discount
// on all of it, and a Soulmate's free model a month covers its standard price (its extras still cost).
export const MODEL = {
  PICKS_MAX: 9,                  // library moves to pick (idle comes with every model: Meshy makes 10 moves in one file at most)
  PICKS_FREE: 7,                 // …in its price
  OWN_MAX: 2,                    // moves described in words
  OWN_MIN: 3,                    // a described move's words, shortest
  OWN_LONG: 200,                 // …and longest
  OWN_SECONDS: [3, 5, 8],        // a described move's length
  OWN_SECONDS_DEFAULT: 5,
  HEIGHT_MIN: 140,               // its height, cm
  HEIGHT_MAX: 210,
  HEIGHT: 170,
  LOOK_MIN: 3,                   // its look in words, shortest
  LOOK_MAX: 300,                 // …and longest
};
// a move described in words answers to a name of its own (2 to 16 lowercase letters and numbers, starting with a letter;
// never one a library move answers to: moveWord)
export const OWN_NAME = /^[a-z][a-z0-9]{1,15}$/;
// its clip's name in its file (the library's are the library's names)
export const ownClip = (name) => `own_${name}`;
// how much of a shape it gets: its faces (Meshy's target_polycount), and a finer geometry for High detail (Meshy 7.1's
// geometry_resolution "2k": 5 of Meshy's credits more)
export const MODEL_DETAIL = {
  light: { name: 'Low-poly', note: 'About 8,000 faces: the lightest, for games and VR', faces: 8000 },
  std: { name: 'Standard', note: 'About 20,000 faces', faces: 20000 },
  high: { name: 'High detail', note: 'About 40,000 faces and a finer shape', faces: 40000, geometry: '2k' },
};
export const MODEL_POSES = {
  a: { name: 'A-pose', note: 'Arms down at an angle: the usual' },
  t: { name: 'T-pose', note: 'Arms straight out, as some 3D apps want' },
};
// more downloads: each one file, made from what the 3D service made once the model is ready, kept DL_DAYS days (its small
// 3D model and its picture stay for good). Only its maker downloads them.
export const DL_FORMATS = {
  full: { name: 'Full-quality GLB', ext: 'glb', type: 'model/gltf-binary', note: 'Every move, its textures as made: bigger' },
  fbx: { name: 'FBX', ext: 'fbx', type: 'application/octet-stream', note: 'Its bones and library moves, for Unity, Unreal and Blender' },
  usdz: { name: 'USDZ', ext: 'usdz', type: 'model/vnd.usdz+zip', note: 'For AR on an iPhone or iPad (standing still)' },
  stl: { name: 'STL', ext: 'stl', type: 'model/stl', note: 'For 3D printing: its shape, no colors' },
  obj: { name: 'OBJ', ext: 'zip', type: 'application/zip', note: 'Its shape, material and textures, zipped (standing still)' },
};
export const DL_DAYS = 30;
// a download's file in the studio's bucket (dl/<the model's id>.<ext>)
export const dlPath = (id, format) => `dl/${id}.${DL_FORMATS[format]?.ext}`;
// What the extras cost: a Meshy credit is about 2 cents (Pro: about $20 for 1,000), each extra about 1.8× (MARKUP) what it
// costs the owner: a move more is 3 of Meshy's credits, a described move 13 (Text to Motion's "prime" 10, then put on its
// bones 3), High detail 5. → credits before a holder's discount
export const AI3D_CENTS = 2;
export const MODEL_EXTRAS = { move: creditsFor(3 * AI3D_CENTS), own: creditsFor(13 * AI3D_CENTS), high: creditsFor(5 * AI3D_CENTS) };

// words as they're checked: NFKC, invisible and control characters as spaces, spaces joined, trimmed (the 3D tool counts a
// move's words and its look this way before sending them, as our server does: views/model-tool.js)
export const tidyWords = (v) => String(v ?? '').normalize('NFKC').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u2064\ufeff]/g, ' ').replace(/\s+/g, ' ').trim();
const byOrder = (a, b) => MOVE_ORDER.indexOf(a) - MOVE_ORDER.indexOf(b);
// A model's choices as asked for, tidied. → { spec } or { field } (the first one that isn't right: moves, own, detail, shine,
// pose, height, look, formats or spec). Nothing asked for is the model as before: its 7 moves, Standard, A-pose, 170 cm.
function readSpec(input) {
  if (input === null || input === undefined) input = {};
  if (typeof input !== 'object' || Array.isArray(input)) return { field: 'spec' };
  let moves = [...DEFAULT_PICKS];
  if (input.moves !== undefined && input.moves !== null) {
    if (!Array.isArray(input.moves) || input.moves.length > MOVE_LIBRARY.length) return { field: 'moves' };
    const picked = [];
    for (const m of input.moves) {
      if (typeof m !== 'string' || m === 'idle' || !MOVE_BY_NAME.has(m)) return { field: 'moves' };
      if (!picked.includes(m)) picked.push(m);
    }
    if (picked.length < 1 || picked.length > MODEL.PICKS_MAX) return { field: 'moves' };
    moves = picked.sort(byOrder);
  }
  const own = [];
  if (input.own !== undefined && input.own !== null) {
    if (!Array.isArray(input.own) || input.own.length > MODEL.OWN_MAX) return { field: 'own' };
    for (const o of input.own) {
      if (!o || typeof o !== 'object' || Array.isArray(o)) return { field: 'own' };
      const name = String(o.name ?? '').trim().toLowerCase();
      const prompt = tidyWords(o.prompt);
      const seconds = o.seconds === undefined || o.seconds === null ? MODEL.OWN_SECONDS_DEFAULT : Number(o.seconds);
      if (!OWN_NAME.test(name) || moveWord(name) || own.some((p) => p.name === name)) return { field: 'own' };
      if (prompt.length < MODEL.OWN_MIN || prompt.length > MODEL.OWN_LONG) return { field: 'own' };
      if (!MODEL.OWN_SECONDS.includes(seconds)) return { field: 'own' };
      own.push({ name, prompt, seconds });
    }
  }
  const detail = input.detail ?? 'std';
  if (!Object.hasOwn(MODEL_DETAIL, detail)) return { field: 'detail' };
  const shine = input.shine ?? false;
  if (typeof shine !== 'boolean') return { field: 'shine' };
  const pose = input.pose ?? 'a';
  if (!Object.hasOwn(MODEL_POSES, pose)) return { field: 'pose' };
  const height = input.height === undefined || input.height === null ? MODEL.HEIGHT : Number(input.height);
  if (!Number.isInteger(height) || height < MODEL.HEIGHT_MIN || height > MODEL.HEIGHT_MAX) return { field: 'height' };
  let look = null;
  if (input.look !== undefined && input.look !== null) {
    if (typeof input.look !== 'string') return { field: 'look' };
    const t = tidyWords(input.look);
    if (t && (t.length < MODEL.LOOK_MIN || t.length > MODEL.LOOK_MAX)) return { field: 'look' };
    look = t || null;
  }
  let formats = [];
  if (input.formats !== undefined && input.formats !== null) {
    if (!Array.isArray(input.formats) || input.formats.length > 10) return { field: 'formats' };
    if (input.formats.some((f) => typeof f !== 'string' || !Object.hasOwn(DL_FORMATS, f))) return { field: 'formats' };
    formats = Object.keys(DL_FORMATS).filter((f) => input.formats.includes(f));
  }
  return { spec: { moves, own, detail, shine, pose, height, look, formats } };
}
export const modelSpec = (input) => readSpec(input).spec ?? null;
export const modelSpecField = (input) => readSpec(input).field ?? null;
// the model as before (its 7 moves, Standard, no shine, A-pose, 170 cm, its own look, no extra downloads)
export const MODEL_DEFAULT = Object.freeze(modelSpec(null));
export function isDefaultSpec(spec) {
  const s = modelSpec(spec);
  return !!s && JSON.stringify(s) === JSON.stringify(MODEL_DEFAULT);
}
// What its extras cost, before a holder's discount → { moves, own, high, total } (null: not a model the tool makes)
export function modelExtras(spec) {
  const s = modelSpec(spec);
  if (!s) return null;
  const moves = Math.max(0, s.moves.length - MODEL.PICKS_FREE) * MODEL_EXTRAS.move;
  const own = s.own.length * MODEL_EXTRAS.own;
  const high = s.detail === 'high' ? MODEL_EXTRAS.high : 0;
  return { moves, own, high, total: moves + own + high };
}
// What it costs, in credits, for this level: its price and its extras (free: a Soulmate's free model a month, its extras
// still paid). → credits, or null
export function modelCost(spec, level = 1, { free = false } = {}) {
  const e = modelExtras(spec);
  if (!e) return null;
  return offFor((free ? 0 : PRICES.model) + e.total, level);
}
// a model a big burn may pay for: one with nothing extra (a burn pays nobody, and its extras cost the owner)
export const burnable = (spec) => modelExtras(spec)?.total === 0;
// its moves, in its file's order: idle and its picks (each a library entry), then its own described moves (by name)
export const modelMoves = (spec) => {
  const s = modelSpec(spec) || MODEL_DEFAULT;
  return ['idle', ...s.moves].map((n) => MOVE_BY_NAME.get(n));
};
export const modelMoveNames = (spec) => {
  const s = modelSpec(spec) || MODEL_DEFAULT;
  return ['idle', ...s.moves, ...s.own.map((o) => o.name)];
};
// Its making, step by step: its described moves first (so a description the AI refuses stops it before anything is made),
// its shape, bones and library moves, then each described move put on its bones, then its files kept. → the steps' names
export function modelPlan(spec) {
  const s = modelSpec(spec) || MODEL_DEFAULT;
  const own = s.own.map((_, i) => i + 1);
  return [...own.map((i) => `motion${i}`), 'image', 'rig', 'moves', ...own.map((i) => `apply${i}`), 'save'];
}
// …and how long each usually takes (seconds: a TYPICAL-like plan for its progress bar; the model as before is TYPICAL.model)
export function modelTimes(spec) {
  const s = modelSpec(spec) || MODEL_DEFAULT;
  const more = Math.max(0, s.moves.length - MODEL.PICKS_FREE);
  const t = { image: s.detail === 'high' ? 190 : s.detail === 'light' ? 130 : 150, rig: 60, moves: 100 + 6 * more, save: 45 + 12 * s.own.length };
  return modelPlan(s).map((step) => [step, /^motion/.test(step) ? 100 : /^apply/.test(step) ? 70 : t[step]]);
}
// its steps as its page names them (a step's number left out: motion1 and motion2 are both "Making its own moves")
export const MODEL_STEP_WORDS = {
  motion: 'Making its own moves', image: 'Shaping it', rig: 'Giving it bones', moves: 'Teaching it moves', apply: 'Teaching its own moves', save: 'Saving it',
};
export const stepGroup = (step) => String(step || '').replace(/\d+$/, '');
// a plan's steps (names, or [name, seconds] pairs) → [{ step (its group), words }], each group once, in order
export function modelStepList(plan) {
  const groups = [];
  for (const p of Array.isArray(plan) && plan.length ? plan : modelPlan(null)) {
    const g = stepGroup(Array.isArray(p) ? p[0] : p);
    if (Object.hasOwn(MODEL_STEP_WORDS, g) && !groups.includes(g)) groups.push(g);
  }
  return groups.map((step) => ({ step, words: MODEL_STEP_WORDS[step] }));
}
