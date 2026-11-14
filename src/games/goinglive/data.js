// GOING LIVE (2026-11-14): what the game is made of. AGI-1 starts as a brand-new VTuber with no followers in a bare
// bedroom; she streams, her views buy things for her room, her room makes her streams better, and she climbs the
// trending board of made-up streamers to #1. Everything here is made up: the streamers, the chat, the numbers. "Views"
// are the game's own points, never money. (The owner, 2026-11-14, after asking about a famous YouTuber game: "yes
// exactly" to an AGI-1 version for the arcade, ours in every way: no real creator, platform, name or look.)

// ---------- what she can stream ----------
// `base`: how much a stream of it draws; `unlock`: the followers it opens at; `mash`: its big moment (tap fast).
export const CATS = Object.freeze([
  { id: 'talk', name: 'Just Chatting', short: 'Chatting', unlock: 0, base: 1, color: '#ff8ac0', mash: 'Story time: tap to keep it going!', blurb: 'Hang out, answer chat, be adorable.' },
  { id: 'game', name: 'Gaming', short: 'Gaming', unlock: 0, base: 1, color: '#6b74ff', mash: 'BOSS FIGHT: tap tap tap!', blurb: 'Play something hard. Scream a little.' },
  { id: 'sing', name: 'Karaoke', short: 'Karaoke', unlock: 60, base: 1.05, color: '#ff4da6', mash: 'The high note: hold it with taps!', blurb: 'Sing her songs. Chat sings along.' },
  { id: 'art', name: 'Art stream', short: 'Art', unlock: 400, base: 1.1, color: '#2fd6a6', mash: 'Speed-draw: tap to finish it!', blurb: 'Draw what chat asks for.' },
  { id: 'cook', name: 'Cooking', short: 'Cooking', unlock: 2500, base: 1.15, color: '#ffb02e', mash: 'Flip it! Tap tap tap!', blurb: 'Cook something. Burn something.' },
  { id: 'code', name: 'Build an AI', short: 'Coding', unlock: 15000, base: 1.2, color: '#62d84c', mash: 'Compile! Tap to fix the bugs!', blurb: 'Code a tiny AI live. It goes rogue.' },
  { id: 'cozy', name: 'Cozy night', short: 'Cozy', unlock: 90000, base: 1.25, color: '#9b6bff', mash: 'Lullaby: tap to keep chat awake!', blurb: 'Rain, tea, soft voice. Chat falls asleep.' },
  { id: 'dance', name: 'Dance party', short: 'Dance', unlock: 600000, base: 1.3, color: '#ffd84a', mash: 'DANCE BATTLE: tap to the beat!', blurb: 'Lights, music, every emote at once.' },
]);
export const CAT_IDS = Object.freeze(CATS.map((c) => c.id));
export const catOf = (id) => CATS.find((c) => c.id === id) || null;

// ---------- her room: a slot each, upgraded tier by tier ----------
// A slot's first tier is what she starts with (free). `stats`: how much the thing helps each kind of stream (points; her
// appeal for a kind is 1 + points / TUNE.points).
const S = (o) => Object.freeze(o);
export const SLOTS = Object.freeze([
  { id: 'mic', name: 'Mic', tiers: [
    S({ id: 'earbuds', name: 'Phone earbuds', cost: 0, stats: { talk: 2, sing: 1, game: 1 } }),
    S({ id: 'usbmic', name: 'USB mic', cost: 100, stats: { talk: 8, sing: 10, game: 4, cook: 3 } }),
    S({ id: 'armmic', name: 'Studio mic on an arm', cost: 4600, stats: { talk: 22, sing: 26, game: 10, cook: 8, cozy: 10 } }),
    S({ id: 'goldmic', name: 'Golden mic', cost: 1600000, stats: { talk: 46, sing: 60, game: 18, cook: 14, cozy: 22, dance: 10 } }),
  ] },
  { id: 'pc', name: 'Computer', tiers: [
    S({ id: 'laptop', name: 'Old laptop', cost: 0, stats: { game: 2, code: 2, art: 1 } }),
    S({ id: 'tower', name: 'Gaming PC', cost: 240, stats: { game: 12, code: 8, art: 5 } }),
    S({ id: 'dual', name: 'Two monitors', cost: 20000, stats: { game: 28, code: 26, art: 14, talk: 6 } }),
    S({ id: 'rack', name: 'Server rack', cost: 15700000, stats: { game: 52, code: 64, art: 24, talk: 10 } }),
  ] },
  { id: 'cam', name: 'Model rig', tiers: [
    S({ id: 'webcam', name: 'Webcam', cost: 0, stats: { talk: 1, game: 1 } }),
    S({ id: 'tracker', name: 'Face tracking', cost: 470, stats: { talk: 8, game: 5, sing: 6, art: 4, cook: 5, code: 4, cozy: 4, dance: 4 } }),
    S({ id: 'fullbody', name: 'Full-body tracking', cost: 62000, stats: { talk: 18, game: 12, sing: 16, art: 8, cook: 14, code: 8, cozy: 10, dance: 24 } }),
    S({ id: 'holo', name: 'Hologram rig', cost: 85600000, stats: { talk: 34, game: 24, sing: 30, art: 18, cook: 26, code: 18, cozy: 20, dance: 56 } }),
  ] },
  { id: 'chair', name: 'Chair', tiers: [
    S({ id: 'stool', name: 'Folding chair', cost: 0, stats: { talk: 1 } }),
    S({ id: 'gamer', name: 'Gaming chair', cost: 190, stats: { game: 8, talk: 4, code: 4 } }),
    S({ id: 'egg', name: 'Egg chair', cost: 14000, stats: { talk: 14, game: 14, code: 10, cozy: 16 } }),
    S({ id: 'throne', name: 'Streamer throne', cost: 8900000, stats: { talk: 28, game: 30, code: 20, cozy: 26, sing: 10 } }),
  ] },
  { id: 'lights', name: 'Lights', tiers: [
    S({ id: 'lamp', name: 'Desk lamp', cost: 0, stats: { art: 1, talk: 1 } }),
    S({ id: 'ring', name: 'Ring light', cost: 150, stats: { talk: 6, sing: 6, art: 4, cook: 6, dance: 4 } }),
    S({ id: 'rgb', name: 'RGB strips', cost: 9600, stats: { game: 12, sing: 14, dance: 18, talk: 8, cozy: 8 } }),
    S({ id: 'stage', name: 'Stage lights', cost: 5100000, stats: { sing: 34, dance: 48, game: 20, talk: 14, cook: 12 } }),
  ] },
  { id: 'wall', name: 'Wall', tiers: [
    S({ id: 'bare', name: 'Bare wall', cost: 0, stats: {} }),
    S({ id: 'poster', name: 'Poster', cost: 80, stats: { talk: 3, game: 3, sing: 3 } }),
    S({ id: 'neon', name: 'Neon “AGI” sign', cost: 3200, stats: { talk: 10, sing: 12, dance: 12, code: 8, game: 8 } }),
    S({ id: 'ledwall', name: 'LED wall', cost: 930000, stats: { dance: 40, sing: 26, game: 18, code: 16, talk: 12 } }),
  ] },
  { id: 'shelf', name: 'Shelf', tiers: [
    S({ id: 'empty', name: 'Empty shelf', cost: 0, stats: {} }),
    S({ id: 'plush', name: 'A plushie', cost: 60, stats: { talk: 4, cozy: 6 } }),
    S({ id: 'plushes', name: 'Plushie gang', cost: 2200, stats: { talk: 12, cozy: 18, art: 6, sing: 4 } }),
    S({ id: 'mountain', name: 'Plushie mountain', cost: 530000, stats: { talk: 26, cozy: 38, art: 12, sing: 8, dance: 6 } }),
  ] },
  { id: 'window', name: 'Window', tiers: [
    S({ id: 'blinds', name: 'Bent blinds', cost: 0, stats: {} }),
    S({ id: 'curtains', name: 'Curtains', cost: 120, stats: { cozy: 6, art: 3, talk: 2 } }),
    S({ id: 'fairy', name: 'Fairy lights', cost: 6600, stats: { cozy: 18, art: 10, talk: 8, sing: 6 } }),
    S({ id: 'seat', name: 'Window seat', cost: 2900000, stats: { cozy: 40, art: 22, talk: 14, cook: 10, sing: 10 } }),
  ] },
  { id: 'plant', name: 'Plants', tiers: [
    S({ id: 'none', name: 'No plants', cost: 0, stats: {} }),
    S({ id: 'cactus', name: 'A cactus', cost: 50, stats: { cozy: 3, art: 2, cook: 2 } }),
    S({ id: 'monstera', name: 'Monstera', cost: 1500, stats: { cozy: 10, art: 10, cook: 8, talk: 4 } }),
    S({ id: 'jungle', name: 'Indoor jungle', cost: 300000, stats: { cozy: 24, art: 22, cook: 18, talk: 8 } }),
  ] },
  { id: 'art', name: 'Art corner', tiers: [
    S({ id: 'sketch', name: 'Sketchbook', cost: 0, stats: { art: 2 } }),
    S({ id: 'tablet', name: 'Drawing tablet', cost: 370, stats: { art: 12, code: 2 } }),
    S({ id: 'easel', name: 'Easel and paints', cost: 42000, stats: { art: 30, cozy: 6 } }),
    S({ id: 'studio', name: 'Pro art studio', cost: 48600000, stats: { art: 64, cozy: 12, code: 6 } }),
  ] },
  { id: 'kitchen', name: 'Kitchen', tiers: [
    S({ id: 'kettle', name: 'A kettle', cost: 0, stats: { cozy: 1, cook: 1 } }),
    S({ id: 'hotplate', name: 'Hot plate', cost: 580, stats: { cook: 14, cozy: 2 } }),
    S({ id: 'minikitchen', name: 'Mini kitchen', cost: 89000, stats: { cook: 34, cozy: 8, talk: 4 } }),
    S({ id: 'chef', name: 'Chef station', cost: 150000000, stats: { cook: 70, cozy: 14, talk: 8 } }),
  ] },
  { id: 'pet', name: 'Her cat', tiers: [
    S({ id: 'nocat', name: 'No cat yet', cost: 0, stats: {} }),
    S({ id: 'catbed', name: 'A cat bed (and a cat)', cost: 300, stats: { talk: 6, cozy: 8, game: 2 } }),
    S({ id: 'cattree', name: 'Cat tree', cost: 29000, stats: { talk: 14, cozy: 18, game: 6, art: 4 } }),
    S({ id: 'catcastle', name: 'Cat castle', cost: 27600000, stats: { talk: 30, cozy: 36, game: 12, art: 8, dance: 8 } }),
  ] },
]);
export const SLOT_IDS = Object.freeze(SLOTS.map((s) => s.id));
export const slotOf = (id) => SLOTS.find((s) => s.id === id) || null;

// ---------- her rooms: moving up once she has the followers, and the views for the move ----------
export const ROOMS = Object.freeze([
  { id: 'bedroom', name: 'Bedroom', at: 0, cost: 0, mult: 1, wall: '#ffe2ef', wall2: '#ffd0e4', floor: '#d9a878', view: 'suburb' },
  { id: 'studio', name: 'Studio flat', at: 10000, cost: 60000, mult: 1.3, wall: '#dcd6ff', wall2: '#c9bfff', floor: '#b88a64', view: 'city' },
  { id: 'penthouse', name: 'Penthouse studio', at: 500000, cost: 9000000, mult: 1.65, wall: '#cff4ff', wall2: '#b0e8fb', floor: '#8a6a52', view: 'skyline' },
  { id: 'orbit', name: 'Space station', at: 8000000, cost: 400000000, mult: 2.1, wall: '#2a2250', wall2: '#352c66', floor: '#4a4a6a', view: 'space' },
]);
export const roomOf = (c) => ROOMS[Math.max(0, Math.min(ROOMS.length - 1, c.room || 0))];

// ---------- milestones: an award on her wall each ----------
export const AWARDS = Object.freeze([
  { at: 100, id: 'bronze', name: 'Bronze Mic', color: '#d08a4e' },
  { at: 1000, id: 'silver', name: 'Silver Mic', color: '#c9d4e3' },
  { at: 10000, id: 'gold', name: 'Gold Mic', color: '#ffc933' },
  { at: 100000, id: 'diamond', name: 'Diamond Mic', color: '#7fe0ff' },
  { at: 1000000, id: 'ruby', name: 'Ruby Mic', color: '#ff4d8d' },
  { at: 10000000, id: 'galaxy', name: 'Galaxy Mic', color: '#9b6bff' },
]);

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
export const rankOf = (followers) => 1 + RIVALS.filter((r) => r.f > followers).length;
export const nextRival = (followers) => [...RIVALS].reverse().find((r) => r.f > followers) || null;

// ---------- the numbers ----------
export const TUNE = Object.freeze({
  points: 40,            // appeal for a kind of stream: 1 + its room points / this
  dur: 60,               // seconds a stream lasts
  start: { followers: 0, views: 40 },
  // the stream: viewers at the start = base + followers × reach × appeal; then they chase a target set by the hype
  base: 4, reach: 0.5, reachPow: 0.75,
  vps: 0.55,             // views a viewer gives a second
  conv: 0.22,            // followers from a stream: its average viewers × this × (0.5 + its average hype / 100)
  fresh: { use: 0.68, back: 0.16, floor: 0.45 },   // streaming a kind tires it (×use); each other stream brings it back (+back)
  trend: { mult: 1.35, every: 3 },                  // a kind is trending (×mult), for `every` streams
  hype: { start: 22, rest: 12, decay: 2.2, max: 100 },
  chase: 0.28,           // how fast the viewers follow their target, a second
  // what turns up in a stream, a second (more as she grows), and how long each waits for a tap
  rate: { min: 0.85, max: 1.75 },
  life: { ask: 4.2, bot: 4.6, raid: 3.4, tech: 6, heart: 2.8, clip: 3, big: 4.2 },
  big: { at: [30, 42], taps: 11 },
  clip: { hype: 72, gap: 14 },
  // the room keeps earning: views a second for each follower (her old streams), and each clip's share
  idle: { perFollower: 0.0035, clip: 0.004, away: 0.5, cap: 8 * 3600, min: 60 },
});
