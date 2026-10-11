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
// (Round 4, 2026-10-11: an X banner is a photo made wider and sharper, 2K: about $0.12 of AI, so 22 credits: about 1.8× its
// cost, the owner's choice for every price, so a Soulmate's 40% off still covers it.)
export const PRICES = { influencer: 100, looks: 40, photo: 15, banner: 22, trend: 300, video: 400, model: 500 };
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
export const INF_STYLES = { real: 'Realistic', anime: 'Anime', toon: '3D cartoon' };
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
  photo: [['queue', 6], ['make', 22], ['save', 8]],
  banner: [['queue', 6], ['make', 30], ['save', 8]],
  trend: [['queue', 20], ['make', 270], ['save', 20]],
  video: [['queue', 20], ['make', 150], ['save', 15]],
  // (the owner's trend clips: 10 s made from words, with sound)
  clip: [['queue', 20], ['make', 240], ['save', 20]],
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
//     (links included), gift links open at once, a link's days, a note's length.
export const GIFTS = { MIN: 10, A_DAY: 50_000, PER_DAY: 20, OPEN_LINKS: 10, LINK_DAYS: 30, NOTE_MAX: 80 };
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

// Video models. Standard and Pro are Kling V3's image to video (720p or 1080p: $0.084 or $0.112 a second, with sound $0.126
// or $0.168), from one of its photos; Anime is Seedance 2.5's reference to video ($0.2205 a second at 480p, $0.473 at 720p,
// its sound free), from its full body or a photo, only for an anime or 3D cartoon influencer (it says no to realistic faces);
// Long is Kling V3 Standard made in parts (each starting from the last frame of the one before), up to a minute, without sound
// (its parts' sounds wouldn't join up: add your own music when you post it).
export const VIDEO_MODELS = {
  standard: { name: 'Standard', note: '720p, natural motion', seconds: [5, 10, 15], cents: { silent: 8.4, sound: 12.6 }, refs: 2, photo: true },
  pro: { name: 'Pro', note: '1080p, the finest detail', seconds: [5, 10, 15], cents: { silent: 11.2, sound: 16.8 }, refs: 2, photo: true },
  anime: { name: 'Anime', note: 'For anime and 3D cartoon influencers', seconds: [5, 10, 15], cents: { '480p': 22.05, '720p': 47.3 }, refs: 4, photo: false, styles: ['anime', 'toon'] },
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
export const refsFor = (what, model) => (what === 'video' ? VIDEO_MODELS[model]?.refs ?? 0 : PHOTO_MODELS[model]?.refs ?? 0);

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
// One of its photos, videos or trend videos being made (as our server shows it: src/studio/views/influencer.js): its plan and
// its step now (a long video's part and that part's step)
export function jobPlan(j) {
  if (j?.kind === 'photo') return j.shape === 'banner' ? TYPICAL.banner : photoPlan({ model: j.model || 'classic', quality: j.quality, meme: j.meme });
  if (j?.kind === 'video') return videoPlan({ model: j.model || 'standard', seconds: j.seconds || 5, parts: j.parts || 1 });
  return TYPICAL[j?.kind] || null;
}
export const jobStep = (j) => (j?.kind === 'video' && Number(j.parts) > 1 ? longStep(j.part, j.parts, j.step) : j?.step || 'queue');
// Its newest photo a video can start from (never an X banner or a meme: a meme's words in a video come out garbled)
export const startPhotos = (jobs) => (jobs || []).filter((j) => j.kind === 'photo' && j.status === 'done' && j.shape !== 'banner' && !j.meme);
