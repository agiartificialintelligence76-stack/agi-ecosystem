// GOING LIVE (2026-11-14; rebuilt the same day): what the game is made of. AGI-1 starts as a brand-new streamer with no
// followers in a bare bedroom. She makes videos (an idea, two topics, a short wait while she records and uploads),
// the views buy things for her room one by one, every thing helps some topics, her room makes her videos better, and
// she climbs the board of made-up streamers to #1. Everything here is made up: the streamers, the chat, the numbers.
// "Views" are the game’s own points, never money. (The owner, 2026-11-14: "yes exactly" to an AGI-1 version of a famous
// YouTuber’s game, ours in every way; then, of that game, "the game mechanics there is so good and the graphics too" →
// "Rebuild both" and "Short waits". No real creator, platform, name or look; nothing of the original’s art.)

// ---------- topics: what a video is about ----------
// `level`: the level it opens at; `mash`: its big moment when she goes live (tap fast).
export const TOPICS = Object.freeze([
  { id: 'chat', name: 'Chatting', icon: '💬', color: '#ff8ac0', level: 1, mash: 'Story time: tap to keep it going!' },
  { id: 'gaming', name: 'Gaming', icon: '🎮', color: '#6b74ff', level: 1, mash: 'BOSS FIGHT: tap tap tap!' },
  { id: 'cute', name: 'Cute', icon: '🐱', color: '#ff9ccf', level: 1, mash: 'Plushie stack: tap before it falls!' },
  { id: 'funny', name: 'Funny', icon: '😂', color: '#ffc933', level: 1, mash: 'The punchline: tap tap tap!' },
  { id: 'music', name: 'Music', icon: '🎤', color: '#ff4da6', level: 3, mash: 'The high note: hold it with taps!' },
  { id: 'art', name: 'Art', icon: '🎨', color: '#2fd6a6', level: 5, mash: 'Speed-draw: tap to finish it!' },
  { id: 'cooking', name: 'Cooking', icon: '🍳', color: '#ff9a3d', level: 8, mash: 'Flip it! Tap tap tap!' },
  { id: 'tech', name: 'Tech', icon: '💻', color: '#62d84c', level: 11, mash: 'Compile! Tap to fix the bugs!' },
  { id: 'cozy', name: 'Cozy', icon: '🌙', color: '#9b6bff', level: 14, mash: 'Lullaby: tap to keep chat awake!' },
  { id: 'dance', name: 'Dance', icon: '💃', color: '#ffd84a', level: 18, mash: 'DANCE BATTLE: tap to the beat!' },
]);
export const TOPIC_IDS = Object.freeze(TOPICS.map((t) => t.id));
export const topicOf = (id) => TOPICS.find((t) => t.id === id) || null;
// (the live stream, ./stream.js, calls them its "kinds")
export const CATS = TOPICS;
export const catOf = topicOf;

// ---------- her room’s things ----------
// `place`: ’floor’ (w × h cells of the floor: h rows deep), ’flat’ (a rug: on the floor, walked over, things stand on
// it), ’wall’ (w × h cells of the wall), ’top’ (w cells on a surface: a desk, a table, a shelf). `kind`: its shelf in
// the shop. `pts`: how it splits its points between topics (its total grows with its price: `pointsOf`). Flags:
// `surface` (the height in art pixels where things stand on it), `desk` (she records there), `seat`, `bed`, `light`
// (glows at night), `pet` (it walks around), `anim` (it moves).
export const KINDS = Object.freeze([
  { id: 'tech', name: 'Desk & tech', icon: '🖥️' },
  { id: 'seat', name: 'Seats & beds', icon: '🛋️' },
  { id: 'furn', name: 'Furniture', icon: '🗄️' },
  { id: 'kitchen', name: 'Kitchen', icon: '🍳' },
  { id: 'music', name: 'Music & dance', icon: '🎸' },
  { id: 'art', name: 'Art', icon: '🎨' },
  { id: 'plant', name: 'Plants', icon: '🪴' },
  { id: 'cute', name: 'Pets & plushies', icon: '🧸' },
  { id: 'wall', name: 'On the wall', icon: '🖼️' },
  { id: 'fun', name: 'Silly stuff', icon: '🦆' },
]);
// `rarity`: common, rare, epic or legendary (the shop’s by their cost in views: under 30K common, under 1M rare, then
// epic; the golden statue legendary); `box`: only ever found in a mystery box (its cost in views is only what its
// points are worth). `use`: what AGI-1 does with it when she’s free (./uses.js): sit, nap, game, cook, paint, dance…
export const RARITIES = Object.freeze([
  { id: 'common', name: 'Common', color: '#b9b2d0' },
  { id: 'rare', name: 'Rare', color: '#3fa9ff' },
  { id: 'epic', name: 'Epic', color: '#b46bff' },
  { id: 'legendary', name: 'Legendary', color: '#ffb800' },
]);
export const rarityOf = (id) => RARITIES.find((r) => r.id === id) || RARITIES[0];
const byPrice = (price) => (price >= 1e6 ? 'epic' : price >= 30000 ? 'rare' : 'common');
const USE = {
  stool: 'sit', gamerchair: 'sit', beanbag: 'sit', sofa: 'sit', eggchair: 'sit', throne: 'sit', whoopee: 'whoopee',
  bed: 'nap', canopy: 'nap', cloudbed: 'nap',
  pc: 'game', monitor: 'game', dual: 'game', arcade: 'game', vr: 'vr', console: 'game', gamingpod: 'game',
  ringlight: 'pose', greenscreen: 'pose', webcam: 'wave', mic: 'sing', studiomic: 'sing', karaoke: 'sing', goldmic: 'sing',
  tablet: 'paint', easel: 'paint', artdesk: 'paint', sculpture: 'admire', gallery: 'admire', neuralart: 'admire',
  rack: 'tinker', robotarm: 'tinker', holo: 'dance', quantum: 'tinker', agicore: 'tinker', gpushrine: 'pray', brainjar: 'admire',
  bookshelf: 'read', dresser: 'outfit', aquarium: 'fish', fishbowl: 'fish', wallaquarium: 'fish',
  minifridge: 'snack', popcorn: 'snack', bobabar: 'snack', snackjar: 'snack', capsule: 'capsule',
  stove: 'cook', pizzaoven: 'cook', counter: 'cook', ramenbar: 'cook', espresso: 'coffee',
  synth: 'keys', piano: 'keys', drums: 'drums', dj: 'dj', jukebox: 'dance', discoball: 'dance', dancefloor: 'dance', bubbler: 'dance',
  treadmill: 'run', cactus: 'water', pottedplant: 'water', monstera: 'water', hangingplant: 'water', bonsai: 'water', tree: 'water',
  bear: 'hug', bunny: 'hug', giantplush: 'hug', plushpile: 'hug', plushagi: 'hug',
  cat: 'pet', robodog: 'pet', holocat: 'pet', robobutler: 'pet',
  trophy: 'admire', statue: 'admire', ballpit: 'jump', slide: 'slide', clawmachine: 'claw', confetti: 'party', snowglobe: 'admire',
};
const I = (id, name, kind, place, w, h, price, level, pts, more = {}) => Object.freeze({
  id, name, kind, place, w, h, price, level, pts: Object.freeze(pts), rarity: id === 'statue' ? 'legendary' : byPrice(price), use: USE[id] || null, ...more,
});
export const ITEMS = Object.freeze([
  // the starter room (free, she has them already)
  I('desk', 'Wobbly desk', 'tech', 'floor', 3, 1, 0, 1, { chat: 1, gaming: 1 }, { surface: 15, desk: true, starter: true }),
  I('laptop', 'Old laptop', 'tech', 'top', 1, 1, 0, 1, { gaming: 1, chat: 1 }, { starter: true }),
  I('stool', 'Folding chair', 'seat', 'floor', 1, 1, 0, 1, { chat: 1 }, { seat: true, starter: true }),
  I('bed', 'Little bed', 'seat', 'floor', 3, 2, 0, 1, { cozy: 1, cute: 1 }, { bed: true, starter: true }),
  I('window', 'Little window', 'wall', 'wall', 2, 2, 0, 1, { cozy: 1 }, { starter: true }),
  // desk & tech
  I('webcam', 'Webcam', 'tech', 'top', 1, 1, 40, 1, { chat: 2, cute: 1 }),
  I('mic', 'USB mic', 'tech', 'top', 1, 1, 90, 2, { music: 2, chat: 2 }),
  I('ringlight', 'Ring light', 'tech', 'floor', 1, 1, 220, 2, { chat: 2, cute: 2, dance: 1 }, { light: true }),
  I('console', 'Retro console', 'tech', 'top', 1, 1, 650, 3, { gaming: 3, funny: 1 }),
  I('pc', 'Gaming PC', 'tech', 'floor', 1, 1, 420, 3, { gaming: 3, tech: 2 }, { light: true }),
  I('monitor', 'Big monitor', 'tech', 'top', 2, 1, 900, 4, { gaming: 3, art: 1, tech: 1 }),
  I('cornerdesk', 'Big desk', 'tech', 'floor', 4, 1, 1600, 5, { chat: 2, tech: 2, art: 1 }, { surface: 16, desk: true }),
  I('tablet', 'Drawing tablet', 'tech', 'top', 1, 1, 2200, 6, { art: 3 }),
  I('buttons', 'Button board', 'tech', 'top', 1, 1, 3400, 7, { gaming: 2, funny: 2 }),
  I('studiomic', 'Studio mic', 'tech', 'top', 1, 1, 6500, 9, { music: 3, chat: 2 }),
  I('dual', 'Two monitors', 'tech', 'top', 2, 1, 12000, 11, { gaming: 2, tech: 2, art: 1 }),
  I('greenscreen', 'Green screen', 'tech', 'floor', 2, 1, 21000, 12, { funny: 2, dance: 1, chat: 1 }),
  I('arcade', 'Arcade cabinet', 'tech', 'floor', 1, 1, 32000, 14, { gaming: 2, funny: 1 }, { light: true }),
  I('vr', 'VR rig', 'tech', 'floor', 1, 1, 48000, 15, { gaming: 2, tech: 2 }),
  I('rack', 'Server rack', 'tech', 'floor', 1, 1, 260000, 22, { tech: 3, gaming: 1 }, { light: true, anim: true }),
  I('robotarm', 'Robot arm', 'tech', 'top', 2, 1, 420000, 24, { tech: 3, funny: 1 }, { anim: true }),
  I('holo', 'Hologram stage', 'tech', 'floor', 2, 1, 2100000, 30, { dance: 2, chat: 2, tech: 1 }, { light: true, anim: true }),
  I('quantum', 'Tiny quantum computer', 'tech', 'floor', 2, 1, 8500000, 36, { tech: 3, gaming: 1 }, { light: true, anim: true }),
  // seats & beds
  I('beanbag', 'Beanbag', 'seat', 'floor', 2, 1, 340, 2, { cozy: 2, chat: 1 }, { seat: true }),
  I('gamerchair', 'Gaming chair', 'seat', 'floor', 1, 1, 600, 3, { gaming: 2, chat: 1 }, { seat: true }),
  I('sofa', 'Sofa', 'seat', 'floor', 3, 1, 5200, 8, { cozy: 2, chat: 1 }, { seat: true }),
  I('eggchair', 'Egg chair', 'seat', 'floor', 1, 1, 18000, 13, { cozy: 2, cute: 1 }, { seat: true }),
  I('canopy', 'Canopy bed', 'seat', 'floor', 4, 2, 62000, 16, { cozy: 2, cute: 1 }, { bed: true }),
  I('throne', 'Streamer throne', 'seat', 'floor', 2, 1, 1600000, 32, { chat: 2, gaming: 2, funny: 1 }, { seat: true }),
  // furniture
  I('sidetable', 'Side table', 'furn', 'floor', 1, 1, 150, 2, { cozy: 1 }, { surface: 10 }),
  I('lamp', 'Floor lamp', 'furn', 'floor', 1, 1, 200, 2, { cozy: 2 }, { light: true }),
  I('rug', 'Round rug', 'furn', 'flat', 3, 2, 300, 2, { cozy: 1, cute: 1 }),
  I('lavalamp', 'Lava lamp', 'furn', 'top', 1, 1, 500, 3, { cozy: 2, music: 1 }, { light: true, anim: true }),
  I('coffeetable', 'Coffee table', 'furn', 'floor', 2, 1, 900, 4, { chat: 2, cozy: 1 }, { surface: 8 }),
  I('bookshelf', 'Bookshelf', 'furn', 'floor', 2, 1, 1200, 5, { art: 1, tech: 1, cozy: 1 }, { surface: 34 }),
  I('dresser', 'Dresser', 'furn', 'floor', 2, 1, 2500, 6, { cute: 2, dance: 1 }, { surface: 16 }),
  I('starrug', 'Star rug', 'furn', 'flat', 4, 2, 8000, 10, { cozy: 1, dance: 1 }),
  I('aquarium', 'Aquarium', 'furn', 'floor', 2, 1, 36000, 14, { cozy: 2, cute: 1 }, { light: true, anim: true }),
  // kitchen
  I('minifridge', 'Mini fridge', 'kitchen', 'floor', 1, 1, 1800, 8, { cooking: 3 }, { surface: 18 }),
  I('stove', 'Little stove', 'kitchen', 'floor', 2, 1, 4600, 8, { cooking: 3 }, { surface: 16 }),
  I('espresso', 'Espresso machine', 'kitchen', 'top', 1, 1, 7200, 9, { cooking: 2, chat: 1 }),
  I('popcorn', 'Popcorn machine', 'kitchen', 'floor', 1, 1, 13000, 11, { funny: 1, cooking: 1 }, { anim: true }),
  I('counter', 'Kitchen counter', 'kitchen', 'floor', 3, 1, 26000, 13, { cooking: 3, cozy: 1 }, { surface: 16 }),
  I('pizzaoven', 'Pizza oven', 'kitchen', 'floor', 2, 1, 125000, 20, { cooking: 3, funny: 1 }, { light: true }),
  I('bobabar', 'Bubble tea bar', 'kitchen', 'floor', 2, 1, 620000, 26, { cooking: 2, cute: 1 }, { surface: 18 }),
  // music & dance
  I('guitar', 'Guitar on the wall', 'music', 'wall', 1, 2, 4000, 7, { music: 1 }),
  I('synth', 'Synth keyboard', 'music', 'floor', 2, 1, 9200, 10, { music: 1 }),
  I('discoball', 'Disco ball', 'music', 'wall', 1, 1, 15000, 12, { dance: 3, funny: 1 }, { anim: true, light: true }),
  I('treadmill', 'Treadmill', 'music', 'floor', 2, 1, 22000, 13, { dance: 3, funny: 1 }),
  I('drums', 'Drum kit', 'music', 'floor', 2, 1, 41000, 15, { music: 3, dance: 1 }),
  I('piano', 'Piano', 'music', 'floor', 3, 1, 92000, 18, { music: 4, art: 1 }),
  I('dj', 'DJ booth', 'music', 'floor', 3, 1, 310000, 23, { music: 1, dance: 1 }, { light: true, anim: true }),
  I('dancefloor', 'Light-up floor', 'music', 'flat', 3, 2, 720000, 27, { dance: 1 }, { light: true, anim: true }),
  // art
  I('easel', 'Easel', 'art', 'floor', 1, 1, 1000, 4, { art: 1 }),
  I('artdesk', 'Art desk', 'art', 'floor', 3, 1, 14500, 11, { art: 3, cute: 1 }, { surface: 15 }),
  I('sculpture', 'Big sculpture', 'art', 'floor', 1, 1, 520000, 25, { art: 1 }),
  I('gallery', 'Gallery wall', 'art', 'wall', 3, 2, 1250000, 30, { art: 4, chat: 1 }),
  // plants
  I('cactus', 'Little cactus', 'plant', 'top', 1, 1, 30, 1, { cute: 1, cozy: 1 }),
  I('pottedplant', 'Potted plant', 'plant', 'floor', 1, 1, 120, 1, { cozy: 1 }),
  I('monstera', 'Monstera', 'plant', 'floor', 1, 1, 1600, 5, { cozy: 2, art: 1 }),
  I('hangingplant', 'Hanging plant', 'plant', 'wall', 1, 1, 3000, 7, { cozy: 2, cute: 1 }),
  I('bonsai', 'Bonsai', 'plant', 'top', 1, 1, 11000, 11, { cozy: 2, art: 1 }),
  I('tree', 'Indoor tree', 'plant', 'floor', 2, 1, 155000, 21, { cozy: 3, cute: 1 }),
  // pets & plushies
  I('bear', 'Bear plushie', 'cute', 'top', 1, 1, 60, 1, { cute: 1 }),
  I('bunny', 'Bunny plushie', 'cute', 'top', 1, 1, 260, 2, { cute: 2, funny: 1 }),
  I('fishbowl', 'Fish bowl', 'cute', 'top', 1, 1, 400, 3, { cute: 2, cozy: 1 }, { anim: true }),
  I('cat', 'Her cat', 'cute', 'floor', 1, 1, 2000, 6, { cute: 3, funny: 1 }, { pet: true }),
  I('cattree', 'Cat tree', 'cute', 'floor', 1, 1, 6600, 8, { cute: 2, cozy: 1 }),
  I('giantplush', 'Giant plushie', 'cute', 'floor', 2, 1, 9800, 10, { cute: 3, funny: 1 }),
  I('robodog', 'Robot dog', 'cute', 'floor', 1, 1, 82000, 17, { tech: 2, cute: 2, funny: 1 }, { pet: true }),
  I('plushpile', 'Plushie mountain', 'cute', 'floor', 2, 1, 230000, 22, { cute: 4, funny: 1 }),
  // on the wall
  I('gameposter', 'Game poster', 'wall', 'wall', 1, 2, 50, 1, { gaming: 1 }),
  I('starposter', 'Star poster', 'wall', 'wall', 1, 2, 90, 1, { cute: 1, music: 1 }),
  I('clock', 'Wall clock', 'wall', 'wall', 1, 1, 160, 2, { chat: 1 }, { anim: true }),
  I('wallshelf', 'Wall shelf', 'wall', 'wall', 2, 1, 700, 4, { cute: 1, art: 1 }),
  I('meme', 'Framed meme', 'wall', 'wall', 1, 1, 1100, 5, { funny: 1 }),
  I('map', 'World map', 'wall', 'wall', 2, 1, 2800, 6, { chat: 2, cozy: 1 }),
  I('neon', 'Neon “AGI ♡” sign', 'wall', 'wall', 3, 1, 5600, 8, { chat: 2, dance: 2, cute: 1 }, { light: true }),
  I('bigwindow', 'Big window', 'wall', 'wall', 3, 2, 10500, 10, { cozy: 2, art: 1 }),
  I('tv', 'Wall TV', 'wall', 'wall', 2, 2, 16500, 12, { gaming: 2, funny: 2 }, { light: true, anim: true }),
  I('ledwall', 'LED panels', 'wall', 'wall', 3, 2, 190000, 22, { dance: 3, gaming: 2, tech: 1 }, { light: true, anim: true }),
  I('spacewindow', 'Space window', 'wall', 'wall', 3, 2, 3200000, 34, { cozy: 2, tech: 1 }),
  // silly stuff
  I('duck', 'Rubber duck', 'fun', 'top', 1, 1, 20, 1, { funny: 1 }),
  I('banana', 'Banana for scale', 'fun', 'top', 1, 1, 75, 1, { funny: 1 }),
  I('whoopee', 'Whoopee cushion', 'fun', 'floor', 1, 1, 140, 2, { funny: 2 }),
  I('trophy', 'Totally real trophy', 'fun', 'top', 1, 1, 2000, 6, { funny: 2, chat: 1 }),
  I('ballpit', 'Ball pit', 'fun', 'floor', 3, 2, 52000, 16, { funny: 2, cute: 1 }),
  I('clawmachine', 'Claw machine', 'fun', 'floor', 1, 1, 78000, 17, { funny: 2, cute: 2, gaming: 1 }, { light: true }),
  I('confetti', 'Confetti cannon', 'fun', 'floor', 1, 1, 270000, 23, { funny: 2, dance: 1 }),
  I('statue', 'Golden AGI-1 statue', 'fun', 'floor', 1, 1, 21000000, 40, { chat: 1, gaming: 1, cute: 1, funny: 1, music: 1, art: 1, cooking: 1, tech: 1, cozy: 1, dance: 1 }),
  // only in mystery boxes (made up for her: an AI’s things)
  I('snackjar', 'Jar of snacks', 'kitchen', 'top', 1, 1, 60000, 1, { cooking: 2, funny: 1 }, { box: true, rarity: 'rare' }),
  I('moonlamp', 'Moon lamp', 'furn', 'top', 1, 1, 70000, 1, { cozy: 3, cute: 1 }, { box: true, rarity: 'rare', light: true }),
  I('rocketlamp', 'Rocket lamp', 'furn', 'floor', 1, 1, 80000, 1, { tech: 2, cozy: 1 }, { box: true, rarity: 'rare', light: true }),
  I('bubbler', 'Bubble machine', 'fun', 'floor', 1, 1, 90000, 1, { funny: 2, cute: 1, dance: 1 }, { box: true, rarity: 'rare', anim: true }),
  I('snowglobe', 'Snow globe', 'cute', 'top', 1, 1, 75000, 1, { cozy: 2, cute: 2 }, { box: true, rarity: 'rare', anim: true }),
  I('capsule', 'Capsule machine', 'fun', 'floor', 1, 1, 110000, 1, { funny: 2, cute: 2 }, { box: true, rarity: 'rare' }),
  I('karaoke', 'Karaoke machine', 'music', 'floor', 1, 1, 120000, 1, { music: 2, funny: 1, dance: 1 }, { box: true, rarity: 'rare', light: true }),
  I('neuralart', 'Neural net art', 'art', 'wall', 2, 2, 140000, 1, { art: 2, tech: 2 }, { box: true, rarity: 'rare' }),
  I('losscurve', 'Loss curve poster', 'wall', 'wall', 1, 2, 100000, 1, { tech: 2, funny: 2 }, { box: true, rarity: 'rare' }),
  I('plushagi', 'AGI-1 plushie', 'cute', 'top', 1, 1, 900000, 1, { cute: 3, funny: 1, chat: 1 }, { box: true, rarity: 'epic' }),
  I('brainjar', 'Glowing brain jar', 'tech', 'top', 1, 1, 1100000, 1, { tech: 3, funny: 1, art: 1 }, { box: true, rarity: 'epic', light: true, anim: true }),
  I('gpushrine', 'GPU shrine', 'tech', 'floor', 1, 1, 1300000, 1, { tech: 3, gaming: 2, funny: 1 }, { box: true, rarity: 'epic', light: true, anim: true }),
  I('jukebox', 'Jukebox', 'music', 'floor', 1, 1, 1400000, 1, { music: 3, dance: 2, cozy: 1 }, { box: true, rarity: 'epic', light: true, anim: true }),
  I('gamingpod', 'Gaming pod', 'tech', 'floor', 2, 1, 1700000, 1, { gaming: 4, tech: 1 }, { box: true, rarity: 'epic', seat: true, light: true }),
  I('ramenbar', 'Ramen bar', 'kitchen', 'floor', 3, 1, 1600000, 1, { cooking: 4, cozy: 2 }, { box: true, rarity: 'epic', surface: 16 }),
  I('wallaquarium', 'Wall aquarium', 'furn', 'wall', 3, 2, 1900000, 1, { cozy: 3, cute: 2 }, { box: true, rarity: 'epic', anim: true, light: true }),
  I('holocat', 'Hologram cat', 'cute', 'floor', 1, 1, 2000000, 1, { cute: 3, tech: 2, funny: 1 }, { box: true, rarity: 'epic', pet: true }),
  I('robobutler', 'Robot butler', 'tech', 'floor', 1, 1, 2400000, 1, { tech: 3, cozy: 1, funny: 1 }, { box: true, rarity: 'epic', pet: true }),
  I('goldmic', 'Golden mic', 'music', 'top', 1, 1, 12000000, 1, { music: 4, chat: 3 }, { box: true, rarity: 'legendary', light: true }),
  I('slide', 'Rainbow slide', 'fun', 'floor', 3, 2, 14000000, 1, { funny: 3, cute: 2, dance: 1 }, { box: true, rarity: 'legendary' }),
  I('cloudbed', 'Actual cloud bed', 'seat', 'floor', 3, 2, 16000000, 1, { cozy: 4, cute: 2 }, { box: true, rarity: 'legendary', bed: true }),
  I('agicore', 'AGI core', 'tech', 'floor', 2, 1, 25000000, 1, { tech: 3, chat: 1, gaming: 1, cute: 1, funny: 1, music: 1, art: 1, cooking: 1, cozy: 1, dance: 1 }, { box: true, rarity: 'legendary', light: true, anim: true }),
]);
// the award plaques: given (never sold), hung on the wall like anything else
export const AWARDS = Object.freeze([
  { at: 100, id: 'bronze', name: 'Bronze Mic', color: '#d08a4e' },
  { at: 1000, id: 'silver', name: 'Silver Mic', color: '#c9d4e3' },
  { at: 10000, id: 'gold', name: 'Gold Mic', color: '#ffc933' },
  { at: 100000, id: 'diamond', name: 'Diamond Mic', color: '#7fe0ff' },
  { at: 1000000, id: 'ruby', name: 'Ruby Mic', color: '#ff4d8d' },
  { at: 10000000, id: 'galaxy', name: 'Galaxy Mic', color: '#9b6bff' },
]);
const PLAQUES = AWARDS.map((a) => I(`plaque_${a.id}`, `${a.name} plaque`, 'wall', 'wall', 1, 1, 0, 1, { chat: 2, funny: 1 }, { award: a.id, color: a.color, given: true }));
export const ALL_ITEMS = Object.freeze([...ITEMS, ...PLAQUES]);
export const ITEM_IDS = Object.freeze(ALL_ITEMS.map((x) => x.id));
const BY_ID = new Map(ALL_ITEMS.map((x) => [x.id, x]));
export const itemOf = (id) => BY_ID.get(id) || null;
// an item’s points: its total grows with its price (cheap things a point or two, the dearest a few hundred), split
// between its topics by `pts`; a plaque is worth what its mic is
const PTS = new Map();
export function pointsOf(item) {
  if (PTS.has(item.id)) return PTS.get(item.id);
  const plaque = item.award ? AWARDS.findIndex((a) => a.id === item.award) : -1;
  const total = plaque >= 0 ? 4 * 2.6 ** plaque : Math.max(1, 1.25 * Math.max(10, item.price) ** 0.36);
  const sum = Object.values(item.pts).reduce((a, b) => a + b, 0);
  const out = {};
  for (const [t, w] of Object.entries(item.pts)) out[t] = Math.max(1, Math.round((total * w) / sum));
  PTS.set(item.id, Object.freeze(out));
  return PTS.get(item.id);
}

// ---------- sets: collect every thing in one (ever, placed or put away) for a bonus on its topic’s videos ----------
export const SETS = Object.freeze([
  { id: 'gamer', name: 'Gamer den', icon: '🎮', topic: 'gaming', items: ['pc', 'monitor', 'gamerchair', 'console', 'arcade', 'gamingpod'] },
  { id: 'studio', name: 'Pro studio', icon: '🎙️', topic: 'chat', items: ['webcam', 'mic', 'ringlight', 'studiomic', 'greenscreen', 'dual'] },
  { id: 'plush', name: 'Plushie party', icon: '🧸', topic: 'cute', items: ['bear', 'bunny', 'giantplush', 'plushpile', 'cattree', 'plushagi'] },
  { id: 'silly', name: 'Silly corner', icon: '🦆', topic: 'funny', items: ['duck', 'banana', 'whoopee', 'trophy', 'ballpit', 'capsule'] },
  { id: 'concert', name: 'Concert night', icon: '🎤', topic: 'music', items: ['synth', 'drums', 'piano', 'karaoke', 'jukebox', 'goldmic'] },
  { id: 'artist', name: 'Artist loft', icon: '🎨', topic: 'art', items: ['easel', 'artdesk', 'tablet', 'gallery', 'sculpture', 'neuralart'] },
  { id: 'cafe', name: 'Little café', icon: '☕', topic: 'cooking', items: ['espresso', 'minifridge', 'stove', 'counter', 'bobabar', 'ramenbar'] },
  { id: 'lab', name: 'AI lab', icon: '🧠', topic: 'tech', items: ['rack', 'robotarm', 'quantum', 'brainjar', 'gpushrine', 'agicore'] },
  { id: 'cozy', name: 'Cozy corner', icon: '🌙', topic: 'cozy', items: ['sofa', 'lamp', 'rug', 'bookshelf', 'moonlamp', 'cloudbed'] },
  { id: 'jungle', name: 'Indoor jungle', icon: '🪴', topic: 'cozy', items: ['cactus', 'pottedplant', 'monstera', 'hangingplant', 'bonsai', 'tree'] },
  { id: 'disco', name: 'Disco fever', icon: '🪩', topic: 'dance', items: ['discoball', 'dancefloor', 'dj', 'ledwall', 'bubbler', 'slide'] },
]);
export const setOf = (id) => SETS.find((s) => s.id === id) || null;

// ---------- mystery boxes: from levels, quests, the drone, good streams, every day; what’s inside by rarity ----------
// `odds`: common, rare, epic, legendary (in hundredths)
export const BOXES = Object.freeze([
  { id: 'bronze', name: 'Mystery box', color: '#d08a4e', odds: [70, 25, 4.5, 0.5] },
  { id: 'silver', name: 'Silver mystery box', color: '#b9c6dc', odds: [40, 45, 13, 2] },
  { id: 'gold', name: 'Gold mystery box', color: '#ffc933', odds: [0, 55, 37, 8] },
]);
export const boxOf = (id) => BOXES.find((b) => b.id === id) || BOXES[0];

// ---------- her homes: the room grows (floor cols × rows, wall rows); moving keeps every thing where it was ----------
export const HOMES = Object.freeze([
  { id: 'bedroom', name: 'Bedroom', cols: 14, rows: 6, wall: 4, at: 0, cost: 0, wallA: '#ffd9ea', wallB: '#ffc2dc', floorA: '#d9a26e', floorB: '#c98f5c', trim: '#ff8ac0', view: 'suburb', paper: 'dots', floor: 'planks' },
  { id: 'apartment', name: 'Cozy apartment', cols: 18, rows: 7, wall: 4, at: 5000, cost: 25000, wallA: '#d6f0e0', wallB: '#bfe4cd', floorA: '#c99a6c', floorB: '#b5865a', trim: '#2fb8a0', view: 'city', paper: 'stripes', floor: 'herring' },
  { id: 'loft', name: 'Studio loft', cols: 22, rows: 7, wall: 5, at: 50000, cost: 400000, wallA: '#c9785c', wallB: '#b0644b', floorA: '#8f8aa6', floorB: '#807b96', trim: '#ff9a3d', view: 'city', paper: 'brick', floor: 'concrete' },
  { id: 'penthouse', name: 'Penthouse', cols: 28, rows: 8, wall: 5, at: 500000, cost: 9000000, wallA: '#d9f3fb', wallB: '#c2e8f5', floorA: '#ece7f4', floorB: '#d9d1e8', trim: '#3fa9ff', view: 'skyline', paper: 'panels', floor: 'marble' },
  { id: 'mansion', name: 'Creator mansion', cols: 34, rows: 8, wall: 5, at: 4000000, cost: 120000000, wallA: '#5b3a8c', wallB: '#6a479f', floorA: '#a8445c', floorB: '#933a50', trim: '#ffc933', view: 'garden', paper: 'damask', floor: 'carpet' },
  { id: 'orbit', name: 'Space station', cols: 40, rows: 9, wall: 5, at: 15000000, cost: 900000000, wallA: '#2e2758', wallB: '#3a3270', floorA: '#4d4a6e', floorB: '#43405f', trim: '#7fe0ff', view: 'space', paper: 'metal', floor: 'metal' },
]);
export const homeOf = (c) => HOMES[Math.max(0, Math.min(HOMES.length - 1, c.home || 0))];

// ---------- perks: idea points (💡, one a level) buy ranks; a rank costs its number (the third rank, 3) ----------
export const PERKS = Object.freeze([
  { id: 'thumbs', name: 'Better thumbnails', icon: '🖼️', max: 5, level: 2, desc: 'Every video gets 20% more views.' },
  { id: 'old', name: 'Old videos', icon: '📼', max: 5, level: 3, desc: 'Her old videos earn 50% more views, even while you’re away.' },
  { id: 'express', name: 'Express delivery', icon: '📦', max: 3, level: 3, desc: 'Deliveries arrive 25% sooner.' },
  { id: 'fast', name: 'Faster editing', icon: '⏩', max: 4, level: 4, desc: 'Videos take 15% less time to make.' },
  { id: 'radar', name: 'Trend radar', icon: '📡', max: 3, level: 5, desc: 'Trending topics bring 25% more.' },
  { id: 'slot2', name: 'Second channel', icon: '✌️', max: 1, level: 6, desc: 'Make two videos at once.' },
  { id: 'mail', name: 'Fan mail', icon: '💌', max: 3, level: 7, desc: 'The fan-mail drone comes more often, with better gifts.' },
  { id: 'energy', name: 'Live energy', icon: '⚡', max: 2, level: 9, desc: 'The live meter fills faster: about an eighth fewer videos.' },
  { id: 'follow', name: 'Follow button', icon: '🔔', max: 4, level: 12, desc: '15% more new followers.' },
  { id: 'slot3', name: 'Third channel', icon: '🤟', max: 1, level: 16, needs: 'slot2', desc: 'Make three videos at once.' },
]);
export const perkOf = (id) => PERKS.find((p) => p.id === id) || null;

// ---------- the trending board: made-up streamers (none is a real person) ----------
export const RIVALS = Object.freeze([
  { name: 'MegaModel 9000', f: 30000000, color: '#ff4d8d' },
  { name: 'NeuralNyan', f: 14000000, color: '#9b6bff' },
  { name: 'Tokenizer Tom', f: 7000000, color: '#3fa9ff' },
  { name: 'ByteBunny', f: 3200000, color: '#ff8ac0' },
  { name: 'LagLord', f: 1600000, color: '#62d84c' },
  { name: 'Captain Cache', f: 800000, color: '#ffb02e' },
  { name: 'PixelPrincess', f: 380000, color: '#ff5fa8' },
  { name: 'GPU Goblin', f: 180000, color: '#2fd6a6' },
  { name: 'Sir Prompts-a-Lot', f: 85000, color: '#6b74ff' },
  { name: 'Overfit Olivia', f: 40000, color: '#ffc933' },
  { name: 'DJ Dropout', f: 18000, color: '#7fe0ff' },
  { name: 'LowLatencyLuna', f: 8000, color: '#c9a2ff' },
  { name: 'Bit Buddy', f: 3000, color: '#ff9a3d' },
  { name: 'Noob Toaster', f: 900, color: '#a8784a' },
  { name: 'Grandma Gamer', f: 250, color: '#ff7a59' },
  { name: 'A Literal Potato', f: 40, color: '#c9a26a' },
]);
// her place on the board: one more than the streamers with more followers than her
export const rankOf = (f) => 1 + RIVALS.filter((r) => r.f > f).length;
export const nextRival = (f) => [...RIVALS].reverse().find((r) => r.f > f) || null;

// ---------- the numbers ----------
export const TUNE = Object.freeze({
  start: { followers: 0, views: 60 },
  // a video: views = (base + reach × followers^reachPow) × quality × trend × luck × perks; quality = 1 + (points / q)^qPow
  // new followers from a video: grow × (followers + start)^growPow × quality^growQ × trend (each video adds a bit less, in
  // proportion, as she gets bigger)
  video: { base: 9, reach: 0.9, reachPow: 0.8, q: 10, qPow: 0.45, luck: [0.85, 1.2], grow: 0.28, growPow: 0.54, growStart: 20, growQ: 0.6, viral: 0.04, viralX: 4 },
  trend: { one: 1.5, two: 2.2, radar: 0.25, every: 5, n: 3 },
  // how long a video takes (s): base + per × level^pow, less with Faster editing
  make: { base: 5, per: 2.6, pow: 0.72, max: 50, fast: 0.15 },
  // a delivery (s): nothing under `free` views, then up to `max`; a tap on the box takes `tap` of what’s left
  deliver: { free: 100, base: 2.5, per: 6, pow: 1.25, max: 60, express: 0.25, tap: 0.12 },
  // experience: a level needs base + per × level^pow; what each thing gives
  xp: { base: 20, per: 16, pow: 1.5, video: 6, perLevel: 1, live: 0.8, quest: 25, place: 3, placePer: 4 },
  ideas: { n: 3, refresh: 30 },
  // mystery boxes: the shop’s things up to `ahead` levels past hers can come out of one; every `quest`th quest gives a
  // silver one; the fan-mail drone brings one this often; a find she has `keep` of already comes as views (`dup` videos’
  // reach, more for rarer ones)
  boxes: { ahead: 6, quest: 6, mail: 0.15, keep: 2, dup: 3 },
  // a completed set: this much more for videos about its topic
  sets: { bonus: 0.12 },
  // going live: the meter fills with every video; a few in every hundred followers watch; worth: [base, × hype, + an S]
  // of her best video
  live: { first: 8, charge: 3, energy: 0.12, watch: 0.08, worth: [0.5, 0.9, 0.4] },
  // her old videos: views a second per follower; away: this much of it, at most `cap` seconds
  idle: { perF: 0.0022, base: 0.05, old: 0.5, away: 0.5, cap: 8 * 3600, min: 60, bots: 0.7 },
  // events: the fan-mail drone and the spam bots (seconds between, from the career’s own dice)
  drone: { every: [40, 85], mail: 0.15, fly: 7 },
  bots: { every: [70, 140], from: 30, life: 26, n: [1, 3] },
  // the one-minute live stream (./stream.js)
  dur: 60,
  base: 4, reach: 0.5, reachPow: 0.75,
  vps: 0.55,
  conv: 0.22,
  hype: { start: 22, rest: 12, decay: 2.2, max: 100 },
  chase: 0.28,
  rate: { min: 0.85, max: 1.75 },
  life: { ask: 4.2, bot: 4.6, raid: 3.4, tech: 6, heart: 2.8, clip: 3, big: 4.2 },
  big: { at: [30, 42], taps: 11 },
  clip: { hype: 72, gap: 14 },
});
