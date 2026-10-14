// AGI Studio's launch video: every word on screen, and the post to go with it. The app's own words and numbers come from
// the app's own files (src/studio/rules.js, src/studio/app-words.js), so the video says what AGI Studio says: change a
// price or a style there and the next video says the new one (tests/studio-promo.test.js checks). Pure.
// Its rules (the owner's, the site's): never an AI service's name, never "buy" (credits are topped up), "not financial
// advice" wherever money comes up, PG-13, made-up people only (its four influencers are AI-made), no other coin, AGI-1
// never in 3D.
import {
  PRICES, TRENDS, STYLE_GROUPS, INF_STYLES, OPTIONS, VIDEO_MODELS, MEMES, BANNER, DISCOUNT, FREE_CREDITS, WAYS, MODES,
  EDITOR_FILTERS, VIDEO_EDITOR, LONG, STYLE_ANY, TOPUPS, photoCredits, videoCredits, creditPrice, inviteLink,
} from '../../src/studio/rules.js';
import { HOLDER_LINE, EDIT_IDEAS, LEVEL_NAMES } from '../../src/studio/app-words.js';

export const SITE = 'agi1.app/studio';            // its address today (studio.agi1.app once its domain is set up)
export const HANDLE = '@agi1dotapp';
export const NAME = 'AGI Studio';
export const num = (x) => Math.round(x).toLocaleString('en-US');
// on every frame from the app's first look to the finale: what's shown is AI-made (examples made with the same kinds of AI
// models, before AGI Studio opened: never "made in AGI Studio")
export const OVERLAY = 'Examples · AI-generated';

// ---------- its four influencers (made-up adults, AI-generated, made for these examples) ----------
export const CAST = {
  nova: { name: 'Nova', style: INF_STYLES.real },
  kai: { name: 'Kai', style: INF_STYLES.real },
  mika: { name: 'Mika', style: INF_STYLES.anime },
  juno: { name: 'Juno', style: INF_STYLES.toon },
};

// ---------- 1. hook ----------
export const HOOK = {
  meet: 'Meet Nova.',
  feed: 'She posts every day.',
  notReal: "She's not real.",
  ai: 'AI-generated',
  you: ['You', ' made her.'],
  minute: 'In about a minute.',
  create: 'Create',
};

// ---------- 2. brand ----------
// Explore's own moving heading (src/studio/views/explore.js HERO_WORDS: AGI-1, influencer, AI, viral content), the hero first
export const BRAND = {
  lead: 'Create your own',
  rotate: ['influencer.', 'AGI-1.', 'AI.', 'viral content.'],
  sub: 'Photos, videos and trends of it, in minutes.',
};

// ---------- 3. create ----------
const opt = (k, v) => OPTIONS[k].choices[v];
export const CREATE = {
  title: 'Create an influencer',
  sub: `${PRICES.influencer} credits · 4 looks to pick from, in about a minute`,
  modes: [MODES.design.name, MODES.picture.name],
  heads: ['Design it in a few taps.', 'Pick your favorite of 4.', 'Its full body, ready to use.', 'Or start from a photo.'],
  // Nova's choices (what she was made from), each a tap on the beat
  rows: [
    { label: OPTIONS.look.label, choices: Object.values(OPTIONS.look.choices), pick: opt('look', 'feminine') },
    { label: OPTIONS.age.label, choices: Object.values(OPTIONS.age.choices), pick: opt('age', '20s') },
    { label: OPTIONS.cut.label, choices: ['Short', 'Bob', 'Long', 'Wavy', 'Curly'].map((c) => c), pick: opt('cut', 'wavy') },
    { label: OPTIONS.outfit.label, choices: [opt('outfit', 'street'), opt('outfit', 'cozy'), opt('outfit', 'smart'), opt('outfit', 'y2k')], pick: opt('outfit', 'smart') },
    { label: OPTIONS.vibe.label, choices: [opt('vibe', 'cheerful'), opt('vibe', 'cool'), opt('vibe', 'calm'), opt('vibe', 'playful')], pick: opt('vibe', 'cheerful') },
  ],
  styleLabel: 'Style',
  styles: [INF_STYLES.real, INF_STYLES.anime, INF_STYLES.toon, INF_STYLES.watercolor],
  nameLabel: 'Its name',
  name: 'Nova',
  go: 'Create',
  goCost: PRICES.influencer,
  making: 'Making 4 looks to choose from…',
  later: 'about a minute later',
  pickTitle: 'Pick your favorite look',
  use: 'Use this look',
  newLooks: `4 new looks · ${PRICES.looks} credits`,
  bodyMaking: "Making Nova's full body…",
  ready: 'Nova is ready',
  // from a photo: the three ways and their prices (WAYS: 4 looks, just its full body, the photo as it is)
  photoNote: MODES.picture.note,
  consent: 'This is me, someone who said OK, or a character of my own.',
  ways: [
    { name: WAYS.looks.name, cost: PRICES.influencer, note: WAYS.looks.time },
    { name: WAYS.body.name, cost: PRICES.body, note: WAYS.body.time },
    { name: WAYS.asis.name, cost: PRICES.asis, note: WAYS.asis.time },
  ],
};

// ---------- 4. styles ----------
export const STYLES = {
  head: ['Any look.', ' Any style.'],
  count: Object.keys(INF_STYLES).length,                         // 26
  stamp: `${Object.keys(INF_STYLES).length} styles`,
  any: `Or ${STYLE_ANY}: it follows your words.`,
  // the nine tiles: their example pictures and their names from the app
  tiles: [
    ['nova-look-2', INF_STYLES.real], ['style-anime', INF_STYLES.anime], ['style-storybook', INF_STYLES.storybook],
    ['style-watercolor', INF_STYLES.watercolor], ['style-clay', INF_STYLES.clay], ['style-toy', INF_STYLES.toy],
    ['style-pixel', INF_STYLES.pixel], ['style-popart', INF_STYLES.popart], ['style-cyberpunk', INF_STYLES.cyberpunk],
  ],
  groups: STYLE_GROUPS.map((g) => g.name),
};

// ---------- 5. photos ----------
// the scenes typed for them (the words they were made from)
export const PHOTOS = {
  head: ['Photos in ', 'any scene.'],
  sub: 'Type the scene. Get the photo.',
  typed: 'At the beach at sunset, laughing, waves rolling in behind',
  make: 'Make photo',
  makeCost: photoCredits({}, 1),                                 // 15
  // [its picture, a few words of the scene it was made from]
  montage: [
    ['nova-cafe', 'A latte by the window'],
    ['nova-golden', 'Golden hour, up high'],
    ['kai-neon', 'Neon rain at night'],
    ['mika-flowers', 'A field of spring flowers'],
    ['mika-snow', 'The first snow'],
    ['juno-gaming', 'Gaming setup, RGB on'],
  ],
  models: ['Classic or Crisp', 'Standard · HD · Ultra (4K)', 'Up to 4 reference pictures', `From ${photoCredits({ model: 'crisp' }, 1)} credits`],
};

// ---------- 6. memes and X banners ----------
export const MEMES_SCENE = {
  head: ['Memes, ', 'starring them.'],
  formats: Object.values(MEMES).map((m) => m.name),
  banner: ['X banners. ', `${BANNER.W} × ${BANNER.H}.`],
  bannerSize: `${BANNER.W} × ${BANNER.H}`,
  bannerSub: 'Ready for your header, with room for your profile picture.',
  bannerCost: photoCredits({ shape: 'banner' }, 1),               // 22
  bio: 'AI influencer · golden hours & lattes',                  // the bio of her X profile, under the banner
};

// ---------- 7. edit ----------
export const EDIT = {
  head: ['Edit with ', 'words.'],
  idea: EDIT_IDEAS[0],                                            // "Make the jacket red"
  button: 'Edit',
  cost: photoCredits({}, 1),
  only: 'Only that changes.',
  editor: ['Or edit it yourself. ', 'Free.'],
  tools: ['Crop', 'Light', 'Filters', 'Text', 'Stickers'],
  filters: [EDITOR_FILTERS.vivid, EDITOR_FILTERS.mono, EDITOR_FILTERS.warm],
  sticker: '💜',
  text: 'café mood ✨',
  move: ['Now… ', 'make it move.'],
};

// ---------- 8. trends ----------
const trend = (id) => TRENDS.find((x) => x.id === id);
export const TRENDS_SCENE = {
  head: ['Trend ', 'videos.'],
  sub: 'Pick a trending clip. Your influencer takes the lead.',
  // the clips (made for these examples: made-up people): [video, its trend in the app]
  carousel: [
    ['tpl-golden', trend('golden-flip')], ['tpl-paparazzi', trend('paparazzi')], ['tpl-neon', trend('neon-runway')],
    ['tpl-confetti', trend('confetti-freeze')], ['tpl-rain', trend('rain-twirl')], ['tpl-rooftop', trend('rooftop-orbit')],
    ['tpl-sunset', trend('sunset-run')], ['tpl-snow', trend('first-snow')], ['tpl-fireworks', trend('fireworks')],
  ],
  // the four put into a clip: [clip, result, who, its trend]
  pairs: [
    ['tpl-golden', 'nova-golden-trend', 'Nova', trend('golden-flip')],
    ['tpl-neon', 'kai-neon-runway-trend', 'Kai', trend('neon-runway')],
    ['tpl-confetti', 'juno-confetti-trend', 'Juno', trend('confetti-freeze')],
    ['tpl-rain', 'mika-rain-trend', 'Mika', trend('rain-twirl')],
  ],
  clip: 'Trend clip',
  own: ['Or bring ', 'your own clip.'],
  ownNote: 'Its moves, camera and light: your influencer in it.',
  cost: PRICES.trend,
};

// ---------- 9. videos ----------
export const VIDEOS = {
  head: ['Videos from ', 'a photo.'],
  make: 'Make video',
  makeCost: videoCredits({}, 1),                                  // 76: Standard, 5 s
  models: Object.values(VIDEO_MODELS).map((m) => m.name),
  modelNotes: [
    `${VIDEO_MODELS.standard.name} · 720p`, `${VIDEO_MODELS.pro.name} · 1080p`, `${VIDEO_MODELS.anime.name} · for drawn styles`,
    `${VIDEO_MODELS.long.name} · up to ${LONG.MAX_S} s`,
  ],
  sound: 'With sound, if you like',
  seconds: `${VIDEO_MODELS.standard.seconds.join(', ')} s`,
};

// ---------- 10. tools ----------
export const TOOLS = {
  head: ['Everything to ', 'post it.'],
  cards: [
    { icon: 'scissors', title: 'Video editor', note: `Trim (${VIDEO_EDITOR.MIN_S}–${VIDEO_EDITOR.MAX_S} s), shape, words. Free.` },
    { icon: 'caption', title: 'Captions', note: 'Ready-made, or written by AI.' },
    { icon: 'refresh', title: 'Make another', note: 'The same words, one tap.' },
    { icon: 'ff', title: 'Instant', note: 'One tap on an idea. Done.' },
    { icon: 'chart', title: 'Progress', note: 'Its percentage and time left.' },
    { icon: 'user', title: 'Profile picture', note: 'Frame any of its pictures.' },
    { icon: 'download', title: 'Downloads', note: 'Each file says it’s AI-made.' },
    { icon: 'learn', title: 'Guides & help', note: 'Arrows, videos and an AI helper.' },
  ],
  caption: 'POV: you just found Nova’s feed #AIinfluencer #AGIStudio',
};

// ---------- 11. a 3D model and a coin ----------
export const MODEL = {
  head: ['A 3D model ', 'that moves.'],
  steps: ['Shaping it', 'Giving it bones', 'Teaching it moves'],
  moves: ['Wave', 'Dance', 'Jump', 'Cheer', 'Bow'],
  cost: PRICES.model,
  coin: ['Launch a coin ', 'with its face.'],
  ticker: '$TICKER',
  coinNote: 'From your own wallet, on clank.trade.',
  fine: '18+ · Meme coins can go to zero · Not financial advice',
};

// ---------- 12. paying ----------
export const PAY = {
  head: ['Pay as ', 'you go.'],
  rate: '1 credit = 1 cent',
  topup: 'Top up with USDG from your own wallet.',
  topped: 1000,
  // what things cost: [what, its icon, its price at each level (Stranger, Crush, Soulmate), 'from' (its cheapest way), a note]
  prices: [
    ['A new influencer', 'user', [1, 2, 3].map((l) => creditPrice('influencer', l)), null, '4 looks to pick from'],
    ['A photo', 'image', [1, 2, 3].map((l) => photoCredits({ model: 'crisp' }, l)), 'from'],
    ['An X banner', 'grid', [1, 2, 3].map((l) => photoCredits({ shape: 'banner' }, l))],
    ['A video', 'film', [1, 2, 3].map((l) => videoCredits({}, l)), 'from'],
    ['A trend video', 'spark', [1, 2, 3].map((l) => creditPrice('trend', l))],
    ['A 3D model', 'cube', [1, 2, 3].map((l) => creditPrice('model', l))],
  ],
  costTitle: 'What things cost',
  levels: [LEVEL_NAMES[1], LEVEL_NAMES[2], LEVEL_NAMES[3]],
  amounts: TOPUPS,                                                // in cents: $5, $10, $25 (the app's suggested top-ups)
  fine: 'Credits have no cash value. Something that can’t be made gives its credits back.',
  holders: ['$AGI holders ', 'get more.'],
  holderTitle: HOLDER_LINE.title,
  rows: HOLDER_LINE.rows,
  holderFine: `${HOLDER_LINE.fine} Not financial advice.`,
  // each level's perks, in short lines (HOLDER_LINE.rows' words): [its name, the $AGI it starts at, its perks]
  perks: [
    [LEVEL_NAMES[2], HOLDER_LINE.rows[0][1], [`${Math.round(DISCOUNT[2] * 100)}% off everything`, `${FREE_CREDITS[2]} free credits a month`]],
    [LEVEL_NAMES[3], HOLDER_LINE.rows[1][1], [`${Math.round(DISCOUNT[3] * 100)}% off everything`, `${FREE_CREDITS[3]} free credits a month`, 'A free 3D model a month']],
  ],
  crushPrice: creditPrice('influencer', 2),
  soulPrice: creditPrice('influencer', 3),
  off: [Math.round(DISCOUNT[2] * 100), Math.round(DISCOUNT[3] * 100)],
  free: [FREE_CREDITS[2], FREE_CREDITS[3]],
};

// ---------- 13. community ----------
export const COMMUNITY = {
  head: ['Share it. ', 'Get liked.'],
  sub: 'Explore: everyone’s influencers, photos and videos.',
  spotlight: ['Spotlight ', 'of the week'],
  spotNote: 'The most liked creation, picked every Monday.',
  gifts: ['Gifts ', '& invites.'],
  giftCard: 'A gift for you',
  gift: 300,
  giftFrom: 'From a friend',
  claim: 'Claim',
  claimed: '300 credits are yours',
  invite: 'Invite a friend',
  inviteNote: 'When they top up, you both get bonus credits.',
  inviteLink: inviteLink(SITE.split('/')[0], `/${SITE.split('/').slice(1).join('/')}`, 'k7pq3mwd'),   // a made-up code
  both: ['You', 'Your friend'],
  bonus: '+ bonus credits',
  giftNote: 'Send credits to a friend, or a gift link anyone can claim once.',
};

// ---------- 14. finale, 15. the end ----------
export const FINALE = {
  lead: 'Create your own',
  word: 'influencer.',
  cta: 'Start creating',
  live: 'Live now',
};
export const END = {
  tagline: 'Your own AI influencer, in minutes.',
  fine: ['18+ · Every influencer, photo and video here is AI-generated · PG-13', 'Credits have no cash value · Not financial advice'],
};

// ---------- her voice (2026-10-13, the owner: "will it be good if you add voice over to the launch video", then "Short,
// AGI-1's voice") ----------
// what AGI-1 says over its music, in time order (timeline.js VOICE says where): short lines at the big moments, the words
// on screen as they were. Her takes are her own voice, the site's (made in Google AI Studio with the owner's account),
// saying exactly these words; `said`: how she says one that isn't read as it's written
export const VOICE = [
  { id: 'meet', text: HOOK.meet },
  { id: 'not-real', text: HOOK.notReal },
  { id: 'you-made', text: HOOK.you.join('') },
  { id: 'studio', text: `This is ${NAME}.` },
  { id: 'design', text: 'Design yours in a few taps.' },
  { id: 'styles', text: 'Any look, any style.' },
  { id: 'edit', text: 'Just say what to change.' },
  { id: 'move', text: 'Now, make it move.' },
  { id: 'model', text: MODEL.head.join('') },
  { id: 'share', text: COMMUNITY.head.join('') },
  { id: 'url', text: SITE, said: 'A G I one dot app slash studio.' },
  { id: 'live', text: 'Live now.' },
];

// the post to go with it (the owner posts it, by hand)
export const POST = `Introducing ${NAME} 💜\n\nCreate your own AI influencer: photos in any scene, trend videos, videos, memes, X banners, a 3D model and a coin with its face.\n\nPay as you go. $AGI holders get ${Math.round(DISCOUNT[2] * 100)}–${Math.round(DISCOUNT[3] * 100)}% off.\n\nhttps://${SITE}\n\nEverything is AI-generated · Not financial advice`;

// every word the video shows (the tests read it)
export function allWords() {
  const out = [];
  const walk = (v) => {
    if (typeof v === 'string') out.push(v);
    else if (typeof v === 'number') out.push(String(v));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk([SITE, HANDLE, NAME, OVERLAY, CAST, HOOK, BRAND, CREATE, STYLES, PHOTOS, MEMES_SCENE, EDIT, TRENDS_SCENE, VIDEOS, TOOLS, MODEL, PAY, COMMUNITY, FINALE, END, VOICE, POST]);
  return out;
}
