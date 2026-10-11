// AGI Studio: Learn (/learn; round 4, phase 4, 2026-10-11, the owner's list: "tutorials", built last). Short lessons, each a
// few steps and a button to where you do it; and first-time tips: one line on Explore, Create and My studio, the first time
// this browser opens them, with "Show me how" (a lesson) and ✕ (kept in this browser only: TIPS_KEY). Nothing is sent
// anywhere; every word is text (never HTML). The words never name the AI services, like the rest of the app.
import { h, add, icon, linkBtn } from '../ui.js';

export const TIPS_KEY = 'agi_tips';

// each lesson: its id (the page's #anchor), its icon, title, a line, its steps, and where to try it
export const LESSONS = [
  { id: 'start', icon: 'learn', title: 'Make your first influencer', line: 'A few taps, about a minute.', to: '/create', go: 'Start creating',
    steps: ['Connect your wallet (a free signature, never a transaction) and confirm you\'re 18+.',
      'Design it (its look, age, style, outfit and vibe), or start from a photo: yours, a friend\'s who said OK, or a character you drew.',
      'Pick your favorite of its 4 looks (free). Its full body is made from it: everything else starts there.'] },
  { id: 'photos', icon: 'smile', title: 'Photos, memes and X banners', line: 'One tool, three kinds.', to: '/me', go: 'Open my influencers',
    steps: ['On your influencer\'s page, open Photo and pick Photo, Meme or X banner.',
      'Pick a model and its quality: each card shows its price in credits. Classic keeps faces closest; Crisp is bold and cheap.',
      'Add up to 4 references if you like (a thing, a place, a pet, food or a style: never a person).',
      'A meme: pick its format and type its words (or Surprise me). An X banner comes out exactly 1500 × 500.'] },
  { id: 'videos', icon: 'play', title: 'Videos, up to a minute', line: 'Standard, Pro, Anime or Long.', to: '/me', go: 'Open my influencers',
    steps: ['Make a photo first: a video starts from one of its photos (Anime starts from its full body, for anime and cartoon influencers).',
      'Pick a model and a length: Standard and Pro 5, 10 or 15 seconds, with sound or not; Long 20 to 60 seconds, made in parts, silent.',
      'Its bar shows how far along it is and the time left. You can close the page: it keeps going.'] },
  { id: 'trends', icon: 'spark', title: 'Trend videos', line: 'Your influencer in a trending clip.', to: '/explore', go: 'See the trending clips',
    steps: ['Pick a trending clip (or upload your own clip, 3 to 10 seconds, one person).',
      'Your influencer takes the place of the clip\'s person: its moves, camera, place and light stay.'] },
  { id: 'instant', icon: 'ff', title: 'Instant: one tap', line: 'Ready-made ideas, made at once.', to: '/me', go: 'Open my influencers',
    steps: ['On your influencer\'s page, switch Instant on (its mint-to-aqua switch at the top of its tools).',
      'Tap an idea: a photo, a meme, an X banner or a video, made at once at the price shown.',
      '"Every choice" brings the full tools back. Instant is off until you switch it on, and only in this browser.'] },
  { id: 'credits', icon: 'bolt', title: 'Credits, holder perks, gifts and invites', line: 'How paying works.', to: '/me', go: 'Open My studio',
    steps: ['Buy credits with USDG from your own wallet app, then press Check my payment (1 credit = 1 cent; no cash value).',
      'Holding $AGI: Crush 20% off and 100 free credits a month, Soulmate 40% off and 400 (a thank-you, not an investment).',
      'Give bought credits to a friend, or invite friends: never buy credits from anyone.'] },
  { id: 'share', icon: 'share', title: 'Share it, safely', line: 'Captions, X, and what we never ask.', to: '/help', go: 'Help & support',
    steps: ['Open a photo or video: Download (with its "Made with AGI Studio · AI-generated" mark), Captions, Post on X.',
      'Say it\'s AI when the app you post on asks.',
      'We never ask for a seed phrase, a private key or a password, never to send money or sign anything: questions go to Help & support.'] },
];

export async function render(ctx, route, root) {
  document.title = 'Learn · AGI Studio';
  add(root,
    h('header', { class: 'sa-page-head' },
      h('p', { class: 'sa-eyebrow', text: 'Learn' }),
      h('h1', { class: 'sa-display sa-page-title', tabindex: '-1', text: 'How AGI Studio works' }),
      h('p', { class: 'sa-muted', text: 'Seven short lessons. Each one ends where you try it.' })),
    h('nav', { class: 'sa-learn-toc', 'aria-label': 'Lessons' },
      ...LESSONS.map((l) => h('a', { href: `#learn-${l.id}`, class: 'sa-chip', text: l.title }))),
    h('ol', { class: 'sa-learn-list' },
      ...LESSONS.map((l, n) => h('li', { class: 'sa-card sa-learn-card', id: `learn-${l.id}`, 'aria-labelledby': `learn-${l.id}-h` },
        h('div', { class: 'sa-learn-head' },
          h('span', { class: 'sa-learn-n', 'aria-hidden': 'true' }, icon(l.icon)),
          h('div', null,
            h('h2', { class: 'sa-learn-title', id: `learn-${l.id}-h`, text: `${n + 1}. ${l.title}` }),
            h('p', { class: 'sa-muted', text: l.line }))),
        h('ol', { class: 'sa-learn-steps' }, ...l.steps.map((s) => h('li', { text: s }))),
        linkBtn(l.go, ctx.href(l.to), { kind: 'ghost' })))),
    h('p', { class: 'sa-note', text: 'Still stuck? Help & support has an AI helper and a person on the team.' }));
  const hash = /^#learn-([a-z]+)$/.exec(location.hash || '');
  if (hash) document.getElementById(`learn-${hash[1]}`)?.scrollIntoView({ block: 'start' });
}

// ---------- first-time tips ----------
export const TIPS = {
  explore: { text: 'New here? See how AGI Studio works in 2 minutes.', lesson: 'start' },
  create: { text: 'First influencer? Here\'s how making one works.', lesson: 'start' },
  me: { text: 'Tip: open one of your influencers to make photos, memes, X banners and videos. Instant makes them in one tap.', lesson: 'instant' },
};
function seen(store) {
  try { const v = JSON.parse(store?.getItem(TIPS_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
export function tipSeen(view, store = globalThis.localStorage) { return seen(store).includes(view); }
export function markTip(view, store = globalThis.localStorage) {
  try { store?.setItem(TIPS_KEY, JSON.stringify([...new Set([...seen(store), view])].slice(-20))); } catch { /* shown again: harmless */ }
}
// the tip for a view, the first time this browser opens it (or null)
export function firstTip(ctx, view, store = globalThis.localStorage) {
  const t = TIPS[view];
  if (!t || tipSeen(view, store)) return null;
  const close = h('button', { type: 'button', class: 'sa-tip-x', 'aria-label': 'Hide this tip', text: '✕' });
  const node = h('aside', { class: 'sa-tip', role: 'note' },
    icon('learn'), h('p', { text: t.text }),
    linkBtn('Show me how', `${ctx.href('/learn')}#learn-${t.lesson}`, { kind: 'ghost', size: 'sm' }), close);
  const done = () => { markTip(view, store); node.remove(); };
  close.addEventListener('click', done);
  node.querySelector('a')?.addEventListener('click', () => markTip(view, store));
  return node;
}
