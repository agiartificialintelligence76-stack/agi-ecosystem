// AGI Studio (round 4, phase 4, 2026-10-11): Instant, the one-tap mode. The owner: "call it a different name on that mode with
// differen color as well like fast , i dont know you know the best". Claude named it Instant: a mint-to-aqua switch with
// fast-forward chevrons (never a lightning bolt: that's the credits' sign). Off by default, remembered in this browser only.
// On, an influencer's tools are these ready-made ideas, and one tap makes one at its price: a photo (Classic, Standard), an X
// banner (Classic, HD), a meme (since 2026-10-19 one of its templates, Classic at its template's own quality and shape: its
// words ready), a video (Standard, 5 seconds, silent, from its
// newest photo) or its 3D model. A coin is never one tap (launching stays manual). (MEME_READY filled the Meme tool's
// "Surprise me" until 2026-10-19: since then it picks any of the 30 templates and one of its samples, views/influencer.js
// memeFields.) (2026-10-13, "With AGI-1") photos of it together with AGI-1 (Classic, Standard), and videos with her (from its
// newest photo she's in; the plain videos from its newest photo she isn't in). Pure (tests/influencer.test.js: every idea
// passes our server's own word checks).
export const INSTANT_KEY = 'agi_instant';
export const INSTANT_SEEN_KEY = 'agi_instant_seen';

// What each kind of idea makes (the menu's choices: src/studio/rules.js photoSpec / videoSpec)
export const INSTANT_MAKES = {
  photo: { kind: 'photo', model: 'classic', quality: 'std', shape: 'tall' },
  banner: { kind: 'photo', model: 'classic', quality: 'hd', shape: 'banner' },
  // (2026-10-19) a meme idea is made as its template says (views/influencer.js memeSpecOf: Classic at memes.js memeQuality and
  // memeShape: a POV meme tall and HD); this is a template's usual, Standard and square
  meme: { kind: 'photo', model: 'classic', quality: 'std', shape: 'square' },
  video: { kind: 'video', model: 'standard', seconds: 5, sound: false },
  // (2026-10-13) with AGI-1: a photo by Classic (it keeps her exactly as she's drawn), a video from a photo she's in
  agi1: { kind: 'photo', model: 'classic', quality: 'std', shape: 'tall', agi1: true },
  agi1Video: { kind: 'video', model: 'standard', seconds: 5, sound: false, agi1: true },
};

// Ready-made memes: a format, its words (one per line of the format) and what the picture shows. PG-13, never about money,
// nobody real, no names
export const MEME_READY = [
  { id: 'coffee', emoji: '☕', label: 'Coffee kicks in', meme: 'topbottom', lines: ['When the coffee finally kicks in', 'Main character energy'],
    scene: 'holding a giant latte in a cozy café, eyes wide with sudden energy' },
  { id: 'onemore', emoji: '📸', label: 'One more photo', meme: 'pov', lines: ["POV: you said 'one more photo' 40 minutes ago"],
    scene: 'striking yet another pose in front of a sunny pastel wall, playful grin' },
  { id: 'outfit', emoji: '👗', label: 'Casual outfit', meme: 'caption', lines: ["Me pretending I didn't plan this outfit for a week"],
    scene: 'leaning on a wall in a perfectly coordinated outfit, acting surprised to be noticed' },
  { id: 'pizza', emoji: '🍕', label: 'Pineapple pizza', meme: 'reaction', lines: ['When someone says pineapple belongs on pizza'],
    scene: 'a big shocked reaction face, mouth open, both hands on the cheeks' },
  { id: 'week', emoji: '📅', label: 'Monday vs Friday', meme: 'twopanel', lines: ['Monday morning', 'Friday night'],
    scene: 'left: sleepy in pajamas with messy hair and a mug; right: dressed up and glowing, dancing at a party' },
  { id: 'sleep', emoji: '🌙', label: 'Sleep early', meme: 'topbottom', lines: ['Said I would sleep early', 'It is now 3 AM'],
    scene: 'in bed at night lit by a phone screen, wide awake, guilty smile' },
  { id: 'joke', emoji: '😅', label: 'Quiet group chat', meme: 'pov', lines: ['POV: the group chat goes quiet after your joke'],
    scene: 'on a couch staring at a phone with an awkward smile, one cartoon sweat drop' },
  { id: 'cake', emoji: '🎂', label: 'Expectation', meme: 'twopanel', lines: ['What I pictured', 'What I baked'],
    scene: 'left: holding a perfect tall layered cake; right: holding a tiny lopsided cupcake, confused' },
  { id: 'playlist', emoji: '🎧', label: 'Playlist hits', meme: 'reaction', lines: ['Me when the playlist hits just right'],
    scene: 'eyes closed with headphones on, dancing happily, lost in the music' },
  { id: 'plot', emoji: '✨', label: 'Plot twist', meme: 'caption', lines: ['Plot twist: I was the main character all along'],
    scene: 'walking out of sparkling fog toward the camera, confident smile' },
];

export const INSTANT = {
  photo: [
    { id: 'cafe', emoji: '☕', label: 'Café morning', scene: 'sipping a latte in a sunny café by the window, smiling at the camera' },
    { id: 'golden', emoji: '🌇', label: 'Golden hour', scene: 'on a rooftop at golden hour, the city glowing behind, hair in the breeze' },
    { id: 'neon', emoji: '🌃', label: 'Neon night', scene: 'walking down a rainy neon-lit street at night, reflections everywhere' },
    { id: 'beach', emoji: '🏖️', label: 'Beach sunset', scene: 'at the beach at sunset, laughing, waves rolling in behind' },
    { id: 'gaming', emoji: '🎮', label: 'Gaming setup', scene: 'at a cozy gaming desk with RGB lights, headset on, grinning' },
    { id: 'flowers', emoji: '🌸', label: 'Flower field', scene: 'in a pastel flower field in spring, soft morning sunlight' },
    { id: 'portrait', emoji: '📸', label: 'Studio portrait', scene: 'a clean studio portrait on a soft gradient background, confident pose' },
    { id: 'snow', emoji: '❄️', label: 'Snow day', scene: 'in a cozy winter coat on a snowy street, snowflakes falling, rosy cheeks' },
  ],
  banner: [
    { id: 'skyline', emoji: '🏙️', label: 'Night skyline', scene: 'a city skyline at night with neon reflections' },
    { id: 'pastel', emoji: '☁️', label: 'Pastel sky', scene: 'a dreamy pastel sky with soft clouds' },
    { id: 'desk', emoji: '🖥️', label: 'Desk setup', scene: 'a long gaming desk with glowing RGB lights' },
    { id: 'boardwalk', emoji: '🌅', label: 'Sunset boardwalk', scene: 'a beach boardwalk at sunset, the sea behind' },
  ],
  meme: MEME_READY,
  video: [
    { id: 'wave', emoji: '👋', label: 'Wave hello', scene: 'waves at the camera with a big smile, then laughs' },
    { id: 'spin', emoji: '💃', label: 'Little spin', scene: 'does a happy little spin, then strikes a pose' },
    { id: 'walk', emoji: '🚶', label: 'Walk up', scene: 'walks toward the camera with confidence, hair moving in the breeze' },
    { id: 'wink', emoji: '😉', label: 'Wink', scene: 'looks into the camera, winks and smiles' },
  ],
  // (2026-10-13) with AGI-1: cute and a little flirty, PG-13, made-up places (never a real brand or person)
  agi1: [
    { id: 'her-pose', emoji: '📸', label: 'Photo together', scene: 'posing for a photo together with AGI-1 at a sunny café, both smiling' },
    { id: 'her-heart', emoji: '💜', label: 'Heart hands', scene: 'on a rooftop at golden hour with AGI-1, making a heart with their hands together' },
    { id: 'her-movie', emoji: '🍿', label: 'Movie night', scene: 'sharing popcorn with AGI-1 at the cinema, both laughing' },
    { id: 'her-games', emoji: '🎮', label: 'Game night', scene: 'playing video games with AGI-1 at a cozy desk with RGB lights, AGI-1 cheering' },
    { id: 'her-neon', emoji: '🌃', label: 'Neon walk', scene: 'walking side by side with AGI-1 down a neon street at night' },
    { id: 'her-picnic', emoji: '🌸', label: 'Picnic', scene: 'having a picnic with AGI-1 in a pastel flower field, AGI-1 offering a strawberry' },
  ],
  agi1Video: [
    { id: 'her-wave', emoji: '👋', label: 'Wave together', scene: 'waves at the camera together with AGI-1, then both laugh' },
    { id: 'her-dance', emoji: '💃', label: 'Little dance', scene: 'does a happy little dance with AGI-1, both smiling' },
  ],
};

// A ready meme as the Meme tool's inputs: a POV line without its "POV:" (the tool shows it in front of the box)
export const memeInputs = (m) => m.lines.map((l) => (m.meme === 'pov' ? l.replace(/^pov\s*:\s*/i, '') : l));

// Instant on or off, in this browser (off when the browser keeps nothing: a private window, blocked storage)
export function instantOn(store = globalThis.localStorage) {
  try { return store?.getItem(INSTANT_KEY) === '1'; } catch { return false; }
}
export function setInstant(on, store = globalThis.localStorage) {
  try { if (on) store?.setItem(INSTANT_KEY, '1'); else store?.removeItem(INSTANT_KEY); } catch { /* nothing kept: on for this page only */ }
}
// its explainer, once per browser
export function instantSeen(store = globalThis.localStorage) {
  try { return store?.getItem(INSTANT_SEEN_KEY) === '1'; } catch { return false; }
}
export function markInstantSeen(store = globalThis.localStorage) {
  try { store?.setItem(INSTANT_SEEN_KEY, '1'); } catch { /* shown again next time: harmless */ }
}
