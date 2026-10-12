// AGI Studio's guide (2026-10-11, the owner: "theres should be a video guide on the site on every step and arrows so they dont
// get confused everyone gets that ofcourse they have an option to X IT but put vosials and video on the guidses please"; the
// owner's choice, "Guide next (Recommended)": arrows that walk through each step on the real buttons, with an X to close, and a
// short video for each step, recorded from the real app). This file is the pure part (no page, no files: tests read it in
// Node): each page's guide and its steps (where its arrow points: a data-guide name on the page; its words; its video), what's
// kept in this browser, which steps a page shows now, and where a step's card goes. The coach marks themselves:
// src/studio/guide.js; the videos: src/studio/guide-media.js (made by tools/studio/guide-record.mjs from the real app).

// what's kept in this browser only (never sent anywhere): the guides seen, and "Skip all guides"
export const GUIDE_KEY = 'agi_guide';

// A step: id; target (the element its arrow points at: [data-guide="<target>"] on the page); title and text (words only, set
// as text); clip (its video, src/studio/guide-media.js); when (only while the page is like that: 'signedIn', 'signedOut',
// 'design', 'photo', 'styled', 'instantOff'); open ('panel': a phone's drawer of controls opens first; 'gallery': it closes first, so
// what's behind it shows).
export const GUIDES = {
  explore: {
    name: 'Explore',
    steps: [
      { id: 'start', target: 'start', title: 'Make your own AI influencer', clip: 'explore-start',
        text: 'Start here: design one in a few taps, or start from a photo. It takes about a minute.' },
      { id: 'gallery', target: 'gallery', title: 'See what people make', clip: 'explore-trends',
        text: "Trend clips, people's influencers and your own creations. Tap a trend clip to put yours in it, or to copy its prompt." },
      { id: 'wallet', target: 'account', when: 'signedOut', title: 'Connect your wallet', clip: 'explore-wallet',
        text: 'A free signature, never a transaction. Holding $AGI gives you discounts and free credits.' },
      { id: 'credits', target: 'account', when: 'signedIn', title: 'Your credits', clip: 'explore-credits',
        text: 'Everything is paid in credits: 1 credit = 1 cent. Tap + to buy more with USDG, from your own wallet app.' },
      { id: 'nav', target: 'nav', title: 'Find your way', clip: 'explore-nav',
        text: 'Explore, Create and My studio. My studio has your influencers, your credits, gifts and help.' },
      { id: 'again', target: 'guide', title: 'Show me around, anytime', clip: 'explore-again',
        text: 'Tap ? on any page to see its guide again. Short lessons with videos are in How it works.' },
    ],
  },
  create: {
    name: 'Create',
    steps: [
      { id: 'mode', target: 'mode', open: 'panel', title: 'How do you want to start?', clip: 'create-mode',
        text: "Design it from a few choices, or start from a photo: yours, a friend's who said OK, or a character you drew." },
      { id: 'look', target: 'look', open: 'panel', when: 'design', title: 'Pick its look', clip: 'create-look',
        text: 'Its look and age are needed; More details has its hair, skin and eyes. Tap a picked one again to unpick it.' },
      { id: 'photo', target: 'look', open: 'panel', when: 'photo', title: 'Add its photo', clip: 'create-photo',
        text: "Tick the box first, then choose a photo: it's checked in a few seconds. A real person's photo makes a private influencer." },
      // (2026-10-11) from a photo, how it's made: 4 looks, just its full body, or the photo as it is (src/studio/rules.js WAYS)
      { id: 'way', target: 'way', open: 'panel', when: 'photo', title: 'How it\'s made', clip: 'create-way',
        text: '4 looks to pick from, or save credits: just its full body, or your photo as it is (a photo of the whole person, head to feet).' },
      { id: 'style', target: 'style', open: 'panel', when: 'styled', title: 'Style, outfit and vibe', clip: 'create-style',
        text: 'A style is optional: 26 of them, from film photo to storybook anime. Any style keeps its own look. An outfit and a vibe are up to you.' },
      { id: 'name', target: 'name', open: 'panel', title: 'Name it', clip: 'create-name',
        text: 'Type a name, or tap Suggest. Anything else you want goes in the box above it.' },
      { id: 'go', target: 'go', open: 'panel', title: 'Create it', clip: 'create-go',
        text: 'The price is on the button, in credits. Its 4 looks come in about a minute; the cheaper ways from a photo, sooner.' },
    ],
  },
  pick: {
    name: 'Its looks',
    steps: [
      { id: 'looks', target: 'looks', title: 'Pick your favorite look', clip: 'pick-look',
        text: "Tap the one you like best, then Use this look: it's free. Its full body is made from it." },
      { id: 'reroll', target: 'reroll', title: 'Not quite it?', clip: 'pick-reroll',
        text: "4 new looks costs a few credits. Anything that can't be made gives its credits back." },
    ],
  },
  make: {
    name: 'Make',
    steps: [
      { id: 'tools', target: 'tools', open: 'panel', when: 'instantOff', title: 'What to make', clip: 'make-tools',
        text: 'Photo, Trend, Video, 3D and Coin. Photo also makes memes and X banners.' },
      { id: 'scene', target: 'scene', open: 'panel', when: 'instantOff', title: 'Describe the scene', clip: 'make-scene',
        text: "Type what's happening, or tap an idea. References are optional: a place, a pet, food or a style." },
      { id: 'models', target: 'models', open: 'panel', when: 'instantOff', title: 'Pick a model', clip: 'make-models',
        text: 'Each card shows its price in credits. Classic keeps faces closest; Crisp is bold and cheap.' },
      { id: 'go', target: 'go', open: 'panel', when: 'instantOff', title: 'Make it', clip: 'make-go',
        text: 'The price is on the button. It shows up in Creations with a progress bar and the time left.' },
      { id: 'instant', target: 'instant', open: 'panel', title: 'Instant: one tap', clip: 'make-instant',
        text: "Switch it on for ready-made ideas: one tap makes one, at the price on it. It's off until you switch it on." },
      // (2026-10-11) its profile picture: the camera on its picture (only its own wallet's, once it's ready: src/studio/views/frame.js)
      { id: 'pfp', target: 'pfp', open: 'gallery', title: 'Its profile picture', clip: 'make-pfp',
        text: 'Tap the camera on its picture to change it: one of its looks, its full body or a photo, framed on its face. Free.' },
      { id: 'creations', target: 'creations', open: 'gallery', title: 'Your creations', clip: 'make-creations',
        text: 'Open one to edit it with words or in the photo or video editor (free), make another, delete it, download it marked AI-made, or get captions.' },
    ],
  },
  me: {
    name: 'My studio',
    steps: [
      { id: 'connect', target: 'connect', when: 'signedOut', title: 'Your studio lives in your wallet', clip: 'explore-wallet',
        text: 'Connect it to see your credits and your influencers: a free signature, never a transaction.' },
      { id: 'credits', target: 'credits', when: 'signedIn', title: 'Your credits', clip: 'me-credits',
        text: 'What you have, and Buy credits: USDG sent from your own wallet app. Your holder perks are beside it.' },
      { id: 'mine', target: 'mine', when: 'signedIn', title: 'Your influencers', clip: 'me-infs',
        text: 'Open one to make photos, videos and more. Create new is the first tile.' },
      { id: 'gifts', target: 'gifts', when: 'signedIn', title: 'Gifts and invites', clip: 'me-gifts',
        text: 'Give credits you bought, or invite friends: bonus credits for you both when they buy.' },
      { id: 'help', target: 'help', title: 'Help & support', clip: 'me-help',
        text: 'The helper answers questions about AGI Studio; a person on the team answers your tickets.' },
    ],
  },
};

// Every video a guide or a lesson shows (src/studio/guide-media.js has each one twice: '-d' recorded on a computer, '-p' on a
// phone). The lessons' own four: a trend video and a video, made on an influencer's page, and (2026-10-12) the photo editor
// and the video editor.
export const CLIP_IDS = [...new Set([
  ...Object.values(GUIDES).flatMap((g) => g.steps.map((s) => s.clip)),
  'make-trend', 'make-video', 'make-editor', 'make-cut',
])];

// Learn's lessons and their videos (played one after the other), and the page whose guide shows it with arrows
export const LESSON_CLIPS = {
  start: { clips: ['create-mode', 'create-look', 'create-go', 'pick-look', 'create-way', 'make-pfp'], guide: '/create' },
  photos: { clips: ['make-scene', 'make-models', 'make-go', 'make-editor'], guide: null },
  videos: { clips: ['make-video', 'make-cut'], guide: null },
  trends: { clips: ['explore-trends', 'make-trend'], guide: '/explore' },
  instant: { clips: ['make-instant'], guide: null },
  credits: { clips: ['explore-credits', 'me-credits', 'me-gifts'], guide: '/me' },
  share: { clips: ['make-creations'], guide: null },
};

// the conditions a step may have, against what the page is like now: { signedIn, mode: 'design' | 'picture', way: 'looks' |
// 'body' | 'asis' (2026-10-11: how one from a photo is made), instant }
const WHEN = {
  signedIn: (env) => env.signedIn === true,
  signedOut: (env) => env.signedIn !== true,
  design: (env) => env.mode !== 'picture',
  photo: (env) => env.mode === 'picture',
  // a style to pick (a photo used as it is keeps its own look: no style, outfit or vibe)
  styled: (env) => env.mode !== 'picture' || env.way !== 'asis',
  instantOff: (env) => env.instant !== true,
};
// a guide's steps for the page as it is (a step whose target isn't on the page is left out later, when it's looked for)
export function guideSteps(id, env = {}) {
  const g = Object.hasOwn(GUIDES, id) ? GUIDES[id] : null;
  if (!g) return [];
  return g.steps.filter((s) => !s.when || (WHEN[s.when] ? WHEN[s.when](env) : false));
}

// ---------- what's kept in this browser ----------
const IDS = new Set(Object.keys(GUIDES));
export function readGuide(store = globalThis.localStorage) {
  try {
    const v = JSON.parse(store?.getItem(GUIDE_KEY) || 'null');
    const seen = Array.isArray(v?.seen) ? v.seen.filter((x) => IDS.has(x)) : [];
    return { seen: [...new Set(seen)], off: v?.off === true };
  } catch {
    return { seen: [], off: false };
  }
}
function write(v, store) {
  try { store?.setItem(GUIDE_KEY, JSON.stringify(v)); } catch { /* private mode: this visit only */ }
}
export function markSeen(id, store = globalThis.localStorage) {
  if (!IDS.has(id)) return;
  const v = readGuide(store);
  if (!v.seen.includes(id)) write({ ...v, seen: [...v.seen, id] }, store);
}
// "Skip all guides" (true), or back on (the ? button shows one: false)
export function setGuidesOff(off, store = globalThis.localStorage) {
  write({ ...readGuide(store), off: Boolean(off) }, store);
}
// whether a page's guide starts by itself: never seen in this browser, and guides not switched off
export function shouldOffer(id, store = globalThis.localStorage) {
  const v = readGuide(store);
  return IDS.has(id) && !v.off && !v.seen.includes(id);
}

// ---------- where a step's card goes ----------
// placeCard({ target, card, view, top, bottom, phone }) → { left, top, side, arrow }
//   target: the element's box in the window ({ left, top, right, bottom }; null: none), card: the card's size ({ w, h }),
//   view: the window's ({ w, h }), top: the app's bar at the top, bottom: a phone's tab bar at the bottom.
//   A phone: the card spans the width, below its target if it fits there (else above, else on the roomier side). A computer:
//   beside it (right, then left), else below, else above; never covering it while there's room. side: the edge of the card
//   its arrow is on ('top' | 'bottom' | 'left' | 'right'; null: no arrow), arrow: how far along that edge (px).
export function placeCard({ target, card, view, top = 52, bottom = 0, phone = false, gap = 14, margin = 12, edge = 22 }) {
  const minY = top + margin;
  const maxY = view.h - bottom - margin;
  const w = Math.min(card.w, view.w - 2 * margin);
  const ch = card.h;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  if (!target) return { left: Math.round((view.w - w) / 2), top: Math.round(clamp((minY + maxY - ch) / 2, minY, Math.max(minY, maxY - ch))), side: null, arrow: 0, w };
  // the part of it in the window
  const t = { left: clamp(target.left, 0, view.w), right: clamp(target.right, 0, view.w), top: clamp(target.top, 0, view.h), bottom: clamp(target.bottom, 0, view.h) };
  const cx = (t.left + t.right) / 2, cy = (t.top + t.bottom) / 2;
  const along = (pos, size) => Math.round(clamp(pos, edge, size - edge));
  const below = () => ({ top: Math.round(t.bottom + gap), side: 'top' });
  const above = () => ({ top: Math.round(t.top - gap - ch), side: 'bottom' });
  const roomBelow = maxY - (t.bottom + gap);
  const roomAbove = (t.top - gap) - minY;
  if (phone) {
    const left = Math.round((view.w - w) / 2);
    let v;
    if (ch <= roomBelow && (roomBelow >= roomAbove || ch > roomAbove)) v = below();
    else if (ch <= roomAbove) v = above();
    else v = roomBelow >= roomAbove ? { top: Math.round(clamp(t.bottom + gap, minY, maxY - ch)), side: 'top' } : { top: Math.round(clamp(t.top - gap - ch, minY, maxY - ch)), side: 'bottom' };
    return { left, top: v.top, side: v.side, arrow: along(cx - left, w), w };
  }
  // beside it: its middle must be where the arrow can point (not under the bar, not past the bottom)
  const sideTop = Math.round(clamp(cy - ch / 2, minY, Math.max(minY, maxY - ch)));
  const besideOk = cy >= minY + edge && cy <= maxY - edge && ch <= maxY - minY;
  if (besideOk && t.right + gap + w <= view.w - margin) return { left: Math.round(t.right + gap), top: sideTop, side: 'left', arrow: along(cy - sideTop, ch), w };
  if (besideOk && t.left - gap - w >= margin) return { left: Math.round(t.left - gap - w), top: sideTop, side: 'right', arrow: along(cy - sideTop, ch), w };
  const left = Math.round(clamp(cx - w / 2, margin, view.w - margin - w));
  if (ch <= roomBelow) return { left, ...below(), arrow: along(cx - left, w), w };
  if (ch <= roomAbove) return { left, ...above(), arrow: along(cx - left, w), w };
  // no room anywhere: the roomier side, inside the window
  const v = roomBelow >= roomAbove ? { top: Math.round(clamp(t.bottom + gap, minY, maxY - ch)), side: 'top' } : { top: Math.round(clamp(t.top - gap - ch, minY, maxY - ch)), side: 'bottom' };
  return { left, ...v, arrow: along(cx - left, w), w };
}

// how much of its ring a card placed there covers (0 to 1; where: placeCard's answer, card: its size, ring: ringBox's answer).
// A card that would cover more than COVER of it goes without its video (src/studio/guide.js; "Watch how" shows it).
export const COVER = 0.05;
export function coverOf(where, card, ring) {
  if (!where || !ring || !(ring.width > 0) || !(ring.height > 0)) return 0;
  const l = where.left, t = where.top, r = l + (where.w ?? card.w), b = t + card.h;
  const w = Math.max(0, Math.min(r, ring.left + ring.width) - Math.max(l, ring.left));
  const h = Math.max(0, Math.min(b, ring.top + ring.height) - Math.max(t, ring.top));
  return (w * h) / (ring.width * ring.height);
}

// the ring around a step's target: its box with a little room, inside the window
export function ringBox(target, view, pad = 6) {
  if (!target) return null;
  const left = Math.max(2, target.left - pad), top = Math.max(2, target.top - pad);
  const right = Math.min(view.w - 2, target.right + pad), bottom = Math.min(view.h - 2, target.bottom + pad);
  if (right - left < 4 || bottom - top < 4) return null;
  return { left: Math.round(left), top: Math.round(top), width: Math.round(right - left), height: Math.round(bottom - top) };
}
