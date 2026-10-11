// AGI Studio (round 4, 2026-10-11, the owner: "can gerate raedy made captions on their posts, or they can generate one too"):
// ready-made captions for a post of a creation, free and instant (here), for X, TikTok or Instagram. Written by AI in a tone
// instead: our server (server/inf-captions.js). Every caption is PG-13, never about money, coins or buying, and says it's AI
// (a hashtag): a post that travels says it's AI-made. Pure, no imports but the rules (the page and the tests use it).
import { CAPTION_PLATFORMS, trendOf } from './rules.js';

// what a caption is about: { name (the influencer's), kind: 'photo' | 'banner' | 'video' | 'trend' | 'meme', trend (a trend
// clip's id) }
const LINES = {
  photo: [
    'New day, new look ✨', 'Main character energy 💜', 'Caught {name} on a good hair day', "POV: you just found {name}'s feed",
    'No thoughts, just vibes ☁️', 'Saving this one for the highlight reel', 'Somewhere between a dream and a render ✨',
    '{name} said hi 👋', 'A whole new era, loading ✨', 'Golden hour, but make it digital 🌅', 'Plot twist: {name} is an AI 🤖',
    "Today's mood, brought to you by {name}",
  ],
  banner: [
    'New header, who dis ✨', 'Fresh banner for a fresh era', "{name}'s new home on the timeline", 'Header updated. Vibes: immaculate 💜',
    'Changed my banner, changed my life (probably)', 'Welcome to my corner of the internet ✨',
  ],
  video: [
    '{name} in motion 🎬', 'Hit play: {name} has something to show you', "Five seconds of {name} you didn't know you needed",
    'Behind the scenes with {name} 🎥', 'Press play and stay a while ✨', 'This is your sign to watch it twice', 'Moving pictures, moving vibes 💜',
  ],
  trend: [
    '{name} tried the {trend} trend 🎬', "Couldn't skip the {trend} trend", '{trend}, but make it {name} ✨', 'Trend check: {trend} ✅',
    'Okay, {trend} was fun 💜', '{name} x {trend}: the collab nobody saw coming',
  ],
  meme: [
    'Tag someone who does this 😂', 'Me every single time', 'Too real 💀', 'Not me relating to an AI meme', 'Accurate. Painfully accurate.',
    '{name} gets it', 'Send this to the group chat',
  ],
};
// its hashtags, the platform's way, with an AI one in each (the post says it's AI-made)
const TAGS = {
  x: '#AIinfluencer #AGIStudio',
  tiktok: '#aiinfluencer #aiart #agistudio #fyp',
  instagram: '#aiinfluencer #aiart #virtualinfluencer #digitalcreator #aigenerated #agistudio',
};

// A short stable number from a string (the same creation gets the same first suggestions)
function seedOf(s) {
  let x = 2166136261;
  for (const c of String(s || '')) { x ^= c.codePointAt(0); x = Math.imul(x, 16777619) >>> 0; }
  return x;
}
const clean = (s) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();

// Ready-made captions for one creation and platform: `count` of them, from `offset` on (the page's "More"). → [strings]
export function readyCaptions({ name, kind = 'photo', trend = null, platform = 'x', seed = '', count = 4, offset = 0 } = {}) {
  const list = LINES[kind] || LINES.photo;
  const p = Object.hasOwn(CAPTION_PLATFORMS, platform) ? platform : 'x';
  const who = clean(name).slice(0, 24) || 'my AI';
  const t = trendOf(trend)?.name || 'this';
  const start = seedOf(seed) % list.length;
  const out = [];
  for (let k = 0; k < Math.min(count, list.length); k++) {
    const line = list[(start + offset + k) % list.length].replaceAll('{name}', who).replaceAll('{trend}', t);
    const text = `${line} ${TAGS[p]}`;
    out.push(text.length <= CAPTION_PLATFORMS[p].max ? text : line.slice(0, CAPTION_PLATFORMS[p].max));
  }
  return out;
}
export const CAPTION_KINDS = Object.keys(LINES);
