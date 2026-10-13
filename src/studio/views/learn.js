// AGI Studio: Learn (/learn; round 4, phase 4, 2026-10-11, the owner's list: "tutorials", built last). Short lessons, each a
// few steps and a button to where you do it. Since the guide (2026-10-11, the owner: "a video guide on the site on every
// step and arrows so they dont get confused … put vosials and video on the guidses"): each lesson with its video (its steps'
// clips from the guide, recorded from the real app, one after the other: src/studio/guide-media.js), and "Show me with arrows"
// where a page has the guide (?guide=1). The first-time tips it had are the guide now (src/studio/guide.js), which starts by
// itself the first time this browser opens a page. Every word is text (never HTML); they never name the AI services.
import { h, add, icon, linkBtn } from '../ui.js';
import { LESSON_CLIPS } from '../guide-steps.js';
import { CLIPS } from '../guide-media.js';

// each lesson: its id (the page's #anchor), its icon, title, a line, its steps, and where to try it
export const LESSONS = [
  { id: 'start', icon: 'learn', title: 'Make your first influencer', line: 'A few taps, about a minute.', to: '/create', go: 'Start creating',
    steps: ['Connect your wallet (a free signature, never a transaction) and confirm you\'re 18+.',
      'Design it (its look, age, outfit and vibe), or start from a photo: yours, a friend\'s who said OK, or a character you drew.',
      'A style is optional: 26 of them, from film photo to storybook anime. With Any style it keeps its own look (or the one your words name).',
      'Pick your favorite of its 4 looks (free). Its full body is made from it: everything else starts there.',
      'From a photo, save credits: just its full body, or, for a photo of the whole person, your photo as it is (no AI, a few seconds).',
      'Change its profile picture any time (free): the camera on its picture, then frame its face in one of its looks or photos.'] },
  { id: 'photos', icon: 'smile', title: 'Photos, memes and X banners', line: 'One tool, three kinds.', to: '/me', go: 'Open my influencers',
    steps: ['On your influencer\'s page, open Photo and pick Photo, Meme or X banner.',
      'Pick a model and its quality: each card shows its price in credits. Classic keeps faces closest; Crisp is bold and cheap.',
      'Add up to 4 references if you like (a thing, a place, a pet, food or a style: never a person).',
      'A meme: pick its format and type its words (or Surprise me). An X banner comes out exactly 1500 × 500.',
      'Open one you made: Make another (the same words and settings, a new one next to it) or Delete it.',
      'Or Edit with words: type one change ("make the jacket red", "add snow") and a new one is made from it, next to it, at its price.',
      'Or Edit photo: crop it, its light, a filter, words and stickers (free), in your browser. Save it as a new one next to it, or download it.'] },
  { id: 'videos', icon: 'play', title: 'Videos, up to a minute', line: 'Standard, Pro, Anime or Long.', to: '/me', go: 'Open my influencers',
    steps: ['Make a photo first: a video starts from one of its photos (Anime starts from its full body, for drawn styles: anime, comics, 3D, toys and art).',
      'Pick a model and a length: Standard and Pro 5, 10 or 15 seconds, with sound or not; Long 20 to 60 seconds, made in parts, silent.',
      'Its bar shows how far along it is and the time left. You can close the page: it keeps going.',
      'Or Edit video (free): trim it to 1 to 15 seconds, its shape, its sound, words and stickers. Save it as a new video next to it, made in a minute or two.'] },
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
    steps: ['Open a photo or video: Download (with its "Made with AGI Studio · AI-generated" watermark), Captions, Post on X. Holding 1,000+ $AGI? "Remove watermark" downloads your own without it.',
      'Say it\'s AI when the app you post on asks.',
      'We never ask for a seed phrase, a private key or a password, never to send money or sign anything: questions go to Help & support.'] },
];

const layout = () => (matchMedia('(max-width: 959px)').matches ? 'p' : 'd');

// a lesson's video: its clips one after the other (paused until its play button is pressed: nothing plays by itself here,
// "reduce motion" or not), then back to the first. Muted, like the guide's; its words say the same.
function lessonVideo(ctx, clips, title) {
  const list = clips.map((id) => CLIPS[id]?.[layout()] || CLIPS[id]?.d).filter(Boolean);
  if (!list.length) return null;
  let at = 0, playing = false;
  const video = h('video', { class: 'sa-learn-video', muted: true, playsinline: true, preload: 'none', disablepictureinpicture: true, disableremoteplayback: true, 'aria-hidden': 'true', tabindex: '-1' });
  video.muted = true;
  video.defaultMuted = true;
  const label = h('span', { class: 'sa-learn-step', 'aria-hidden': 'true', hidden: list.length < 2 });
  const play = h('button', { type: 'button', class: 'sa-learn-play' });
  const box = h('div', { class: 'sa-learn-media' }, video, label, play);
  const load = (k) => {
    at = k;
    video.poster = list[k].poster;
    video.src = list[k].mp4;
    label.textContent = `${k + 1} of ${list.length}`;
  };
  const draw = () => {
    play.classList.toggle('is-playing', playing);
    play.replaceChildren(icon(playing ? 'pause' : 'play'), h('span', { class: 'sa-sr', text: `${playing ? 'Pause' : 'Play'} the video: ${title}` }));
  };
  play.addEventListener('click', () => {
    playing = !playing;
    draw();
    if (playing) video.play().catch(() => { playing = false; draw(); });
    else video.pause();
  });
  video.addEventListener('ended', () => {
    if (at + 1 < list.length) { load(at + 1); video.play().catch(() => { playing = false; draw(); }); return; }
    playing = false;
    load(0);
    draw();
  });
  video.addEventListener('error', () => { box.hidden = true; });
  ctx.listen(document, 'visibilitychange', () => { if (document.hidden && playing) { playing = false; video.pause(); draw(); } });
  load(0);
  draw();
  return box;
}

export async function render(ctx, route, root) {
  document.title = 'Learn · AGI Studio';
  add(root,
    h('header', { class: 'sa-page-head' },
      h('p', { class: 'sa-eyebrow', text: 'Learn' }),
      h('h1', { class: 'sa-display sa-page-title', tabindex: '-1', text: 'How AGI Studio works' }),
      h('p', { class: 'sa-muted', text: 'Seven short lessons, each with its video. On any page, tap ? at the top for its guide with arrows.' })),
    h('nav', { class: 'sa-learn-toc', 'aria-label': 'Lessons' },
      ...LESSONS.map((l) => h('a', { href: `#learn-${l.id}`, class: 'sa-chip', text: l.title }))),
    h('ol', { class: 'sa-learn-list' },
      ...LESSONS.map((l, n) => {
        const more = LESSON_CLIPS[l.id] || { clips: [], guide: null };
        return h('li', { class: 'sa-card sa-learn-card', id: `learn-${l.id}`, 'aria-labelledby': `learn-${l.id}-h` },
          h('div', { class: 'sa-learn-head' },
            h('span', { class: 'sa-learn-n', 'aria-hidden': 'true' }, icon(l.icon)),
            h('div', null,
              h('h2', { class: 'sa-learn-title', id: `learn-${l.id}-h`, text: `${n + 1}. ${l.title}` }),
              h('p', { class: 'sa-muted', text: l.line }))),
          lessonVideo(ctx, more.clips, l.title),
          h('ol', { class: 'sa-learn-steps' }, ...l.steps.map((s) => h('li', { text: s }))),
          h('div', { class: 'sa-learn-links' },
            linkBtn(l.go, ctx.href(l.to), { kind: 'ghost', dataset: { saLink: '' } }),
            more.guide ? linkBtn('Show me with arrows', `${ctx.href(more.guide)}?guide=1`, { kind: 'quiet', icon: 'next', dataset: { saLink: '' } }) : null));
      })),
    h('p', { class: 'sa-note', text: 'Still stuck? Help & support has an AI helper and a person on the team.' }));
  const hash = /^#learn-([a-z]+)$/.exec(location.hash || '');
  if (hash) document.getElementById(`learn-${hash[1]}`)?.scrollIntoView({ block: 'start' });
}
