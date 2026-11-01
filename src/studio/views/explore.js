// AGI Studio: Explore (the app's front). Its print-inspired colors and type follow the main page (2026-11-01).
// Round 3 (2026-10-10, the owner's "Pro tool layout"): a compact top (what it is, in a
// line, with a wall of what people made beside it), the live stats board as one strip, the spotlight of the week, then the
// gallery (Trending · Influencers · My creations: views/gallery.js), and the two ways to start. Everything public here is the
// same for everyone (/api/launch?inf-explore and ?inf-stats, kept a little by the CDN); a signed-in wallet's hearts after.
import { h, icon, btn, linkBtn, pic, put, add } from '../ui.js';
import { infPic, infPoster, infExample, clankProfileUrl } from '../rules.js';
import { studioText, MODE_CARDS, STAT_NAMES, HOLDER_LINE, compact, tiny, weekText, prizeText } from '../app-words.js';
import { videoSheet, photoSheet, loadLiked, likeButton, ownItem } from './shared.js';
import { gallery } from './gallery.js';

const MODE_ICON = { design: 'wand', picture: 'image' };
const MODE_EXAMPLES = { design: ['style-anime', 'style-real', 'style-toon'], picture: ['look-feminine', 'look-masculine', 'look-androgynous'] };
const list = (x) => (Array.isArray(x) ? x : []);
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// (2026-10-11, the owner: "and i wan this moving pleae, Create your own AGI-1. / influencer. / AI. / Viral content. … the only
// moving is the words afer the word "own" and put under line", then "and also the images moving there okay") The top's heading
// is "Create your own ___": the words after "own" change every few seconds, sliding in, underlined (the line follows their
// width); and its wall of what people made scrolls slowly, its columns in turns up and down (CSS). Both rest while the top is
// off screen or the tab is hidden, and stand still for "reduce motion" (its word then: "influencer"). Screen readers get one
// steady sentence.
export const HERO_WORDS = ['AGI-1', 'influencer', 'AI', 'viral content'];
export const HERO_STILL = 1;
export const HERO_EVERY_MS = 2600;
const HERO_SAID = 'Create your own AGI-1, influencer, AI or viral content.';
// a wall's column: its pictures twice over, so it scrolls round without a seam (each set taller than the wall)
const WALL_EACH = 6;

export async function render(ctx, route, root) {
  document.title = 'AGI Studio · make your own AI influencer';
  const status = h('p', { class: 'sa-banner', role: 'status', hidden: true });
  const showStatus = () => {
    const t = ctx.info ? studioText(ctx.info, { allowed: ctx.me?.allowed !== false }) : ctx.infoFailed ? studioText(null) : '';
    status.textContent = t;
    status.hidden = !t;
  };

  // ---------- the top: the app in a line, and a wall of what people made ----------
  const wall = h('div', { class: 'sa-hero-wall', 'aria-hidden': 'true' }, ...[0, 1, 2, 3].map(() => h('div', { class: 'sa-wall-col' }, h('div', { class: 'sa-wall-track' }))));
  const art = h('div', { class: 'sa-hero-art', 'aria-hidden': 'true' },
    h('span', { class: 'sa-hero-art-word', text: 'AGI' }),
    h('span', { class: 'sa-hero-orbit' }),
    h('img', { class: 'sa-hero-figure', src: '/images/landing/agi1-cutout.webp', alt: '', width: 796, height: 1510, decoding: 'async' }),
    h('span', { class: 'sa-hero-sticker', text: 'Made of\nimagination.' }),
    h('span', { class: 'sa-hero-spark', text: '✦' }));
  const ribbon = h('div', { class: 'sa-hero-ribbon', 'aria-hidden': 'true' },
    ...['Your imagination', 'AI influencers', 'Photos', 'Videos', '3D worlds'].map((text) => h('span', { text })));
  const seeTrends = btn('Browse trends', { kind: 'ghost', icon: 'zap' });
  const still = calm();
  const first = still ? HERO_STILL : 0;
  const rotor = h('span', { class: 'sa-rotor' },
    // (an invisible letter in the line: the words beside it are placed over it, so the line's height and baseline are its)
    h('span', { class: 'sa-rotor-ghost', text: 'A' }),
    ...HERO_WORDS.map((w, k) => h('span', { class: `sa-rotor-word sa-grad${k === first ? ' is-on' : ''}`, text: w })));
  const hero = h('section', { class: 'sa-hero' },
    h('div', { class: 'sa-hero-copy' },
      h('p', { class: 'sa-eyebrow' }, h('span', { class: 'sa-live-dot', 'aria-hidden': 'true' }), h('span', { text: 'AGI Studio · AI influencers' })),
      h('h1', { class: 'sa-display sa-hero-title', tabindex: '-1' },
        h('span', { class: 'sa-sr', text: HERO_SAID }),
        h('span', { class: 'sa-hero-line', 'aria-hidden': 'true', text: 'Create your own' }),
        h('span', { class: 'sa-hero-line', 'aria-hidden': 'true' }, rotor, h('span', { text: '.' }))),
      h('p', { class: 'sa-hero-sub', text: 'Design one in a few taps or start from a photo. Then photos in any scene, trend videos, short videos, a 3D model and a coin with its face.' }),
      holderLine(),
      h('div', { class: 'sa-row sa-hero-cta' },
        linkBtn('Create an influencer', ctx.href('/create'), { kind: 'primary', icon: 'plus', dataset: { saLink: '', guide: 'start' } }),
        seeTrends),
      status),
    art, wall, ribbon);

  // ---------- the live stats board, as one strip ----------
  const stats = h('section', { class: 'sa-stats', 'aria-label': 'AGI Studio, live', hidden: true },
    h('p', { class: 'sa-stats-live' }, h('span', { class: 'sa-live-dot', 'aria-hidden': 'true' }), h('span', { text: 'Live' })),
    h('dl', { class: 'sa-stats-list' }));
  async function loadStats() {
    const r = await ctx.getJson('inf-stats');
    if (!ctx.alive() || !r.ok) return;
    const dl = stats.querySelector('dl');
    put(dl, ...STAT_NAMES.map(([k, label]) => h('div', { class: `sa-stat sa-stat-${k}` }, h('dt', { text: label }), h('dd', { text: tiny(r.data?.[k]) }))));
    stats.hidden = !STAT_NAMES.some(([k]) => Number(r.data?.[k]) > 0);
  }

  // ---------- the spotlight of the week (holders' likes pick it, the owner approves it), the gallery, two ways to start ----------
  const spot = h('section', { class: 'sa-section sa-spot-box', 'aria-labelledby': 'sa-spot-h', hidden: true });
  const g = gallery(ctx, { initial: route.q.get('tab') || 'trending' });
  const modes = h('ul', { class: 'sa-modes' });
  const fillModes = () => {
    put(modes, ...MODE_CARDS.map((m) => {
      const ex = MODE_EXAMPLES[m.id].map((k) => ctx.info?.examples?.[k]).filter(Boolean);
      return h('li', null, h('a', { class: `sa-mode sa-mode-${m.id}`, href: ctx.href(`/create?mode=${m.id}`), dataset: { saLink: '' } },
        h('span', { class: 'sa-mode-art', 'aria-hidden': 'true' }, ex.length
          ? ex.slice(0, 3).map((job) => pic(infExample(job), { cls: 'sa-mode-pic' }))
          : h('span', { class: 'sa-mode-icon' }, icon(MODE_ICON[m.id]))),
        h('span', { class: 'sa-mode-text' },
          h('span', { class: 'sa-mode-name', text: m.name }),
          h('span', { class: 'sa-mode-note', text: m.note })),
        h('span', { class: 'sa-mode-go', 'aria-hidden': 'true' }, icon('next'))));
    }));
  };
  const modesBox = h('section', { class: 'sa-section', 'aria-labelledby': 'sa-modes-h' },
    h('div', { class: 'sa-section-head' }, h('h2', { class: 'sa-h2', id: 'sa-modes-h', text: 'Two ways to start' })), modes);

  add(root, h('div', { class: 'sa-page sa-explore' }, hero, stats, spot, h('div', { class: 'sa-section sa-explore-gallery' }, g.node), modesBox));
  heroMotion(ctx, hero, rotor, { still, first });
  // (2026-10-11) its guide: the first time this browser opens Explore, and with the bar's ? button
  ctx.guide('explore');
  fillModes();
  showStatus();
  ctx.on('info', () => { showStatus(); fillModes(); });
  ctx.on('me', showStatus);
  loadStats();
  ctx.every(() => { if (document.visibilityState === 'visible') loadStats(); }, 60_000);
  seeTrends.addEventListener('click', () => {
    g.show('trending');
    g.node.scrollIntoView({ behavior: calm() ? 'auto' : 'smooth', block: 'start' });
    g.node.querySelector('[role="tab"][aria-selected="true"]')?.focus({ preventScroll: true });
  });

  const data = await g.loaded;
  if (!ctx.alive() || !data) return;
  const fresh = list(data.fresh);
  // (2026-10-13) one of this wallet's own: as its maker sees it (Remove watermark; its heart isn't for itself; no Report)
  const open = (item) => (item.kind === 'photo'
    ? photoSheet(ctx, item, { name: item.inf?.name || 'An influencer', inf: item.inf?.id, mine: ownItem(ctx, item) })
    : videoSheet(ctx, item, { name: item.inf?.name || 'An influencer', inf: item.inf?.id, mine: ownItem(ctx, item) }));

  // the top's wall: what people made (pictures only: no video plays by itself), scrolling slowly (CSS: .sa-wall-track)
  const covers = fresh.map((v) => (v.kind === 'photo' ? infPic(v.inf?.id, v.id, 0, true) : v.poster ? infPoster(v.inf?.id, v.id) : null)).filter(Boolean)
    .concat(list(data.influencers).filter((i) => i.portrait).map((i) => infPic(i.id, i.portrait.job, i.portrait.n, true)));
  if (covers.length >= 4) {
    // up to 12 pictures, each column its own turn of them (with fewer, some come round again: it's decoration, hidden from screen
    // readers), and each column's twice over so it scrolls round without a seam (the same pictures: downloaded once)
    for (const [c, track] of [...wall.querySelectorAll('.sa-wall-track')].entries()) {
      const mine = wallColumn(covers, c);
      for (const [k, url] of [...mine, ...mine].entries()) add(track, pic(url, { cls: 'sa-wall-pic', lazy: k > 1 }));
    }
    hero.classList.add('has-wall');
  }

  // the spotlight
  const sp = data.spotlight;
  if (sp) {
    const item = { id: sp.job, kind: sp.kind, shape: sp.shape, poster: sp.poster, files: sp.files, likes: sp.likes, inf: sp.inf };
    const cover = sp.kind === 'photo' ? infPic(sp.inf.id, sp.job, 0) : sp.poster ? infPoster(sp.inf.id, sp.job) : sp.inf.portrait ? infPic(sp.inf.id, sp.inf.portrait.job, sp.inf.portrait.n) : null;
    const media = h('button', { type: 'button', class: `sa-spot-media is-${sp.shape || 'tall'}`, 'aria-label': `The spotlight of ${weekText(sp.week)}: ${sp.inf.name}` },
      cover ? pic(cover, { cls: 'sa-spot-pic', lazy: false }) : null, sp.kind === 'photo' ? null : h('span', { class: 'sa-media-play', 'aria-hidden': 'true' }, icon('play')));
    media.addEventListener('click', () => open(item));
    put(spot,
      h('div', { class: `sa-spot${sp.shape === 'wide' || sp.shape === 'banner' ? '' : ' is-side'}` },
        media,
        h('div', { class: 'sa-spot-copy' },
          h('p', { class: 'sa-tag sa-tag-gold' }, icon('trophy'), h('span', { text: 'Spotlight of the week' })),
          h('h2', { class: 'sa-display sa-spot-title', id: 'sa-spot-h', text: sp.inf.name }),
          // (round 4) its maker's clank.trade username, when they show it
          sp.inf.maker?.name ? h('a', { class: 'sa-maker', href: clankProfileUrl(sp.inf.maker.name), target: '_blank', rel: 'noopener noreferrer', 'aria-label': `By @${sp.inf.maker.name} on clank.trade (opens clank.trade)` },
            h('span', { text: 'by ' }), h('span', { class: 'sa-maker-name', text: `@${sp.inf.maker.name}` }), h('span', { 'aria-hidden': 'true', text: '\u00a0↗' })) : null,
          h('p', { class: 'sa-muted', text: `The most loved creation of ${weekText(sp.week)}, picked by holders' hearts.` }),
          h('dl', { class: 'sa-spot-facts' },
            h('div', null, h('dt', { text: 'Likes' }), h('dd', { text: compact(sp.likes) })),
            h('div', null, h('dt', { text: "Holders' likes" }), h('dd', { text: compact(sp.holderLikes) })),
            h('div', null, h('dt', { text: 'Prize' }), h('dd', { text: prizeText(sp.prize) }))),
          h('div', { class: 'sa-row' },
            linkBtn(`See ${sp.inf.name}`, ctx.href(`/i/${sp.inf.id}`), { kind: 'primary', size: 'sm', dataset: { saLink: '' } }),
            likeButton(ctx, { job: sp.job, likes: sp.likes, cls: 'sa-heart-lg' })),
          sp.prize > 0 ? h('p', { class: 'sa-fine', text: 'A prize is a thank-you for making, sent to the maker\'s own wallet: not an investment, not financial advice.' }) : null)));
    spot.hidden = false;
    loadLiked(ctx, [sp.job]);
    ctx.on('wallet', () => loadLiked(ctx, [sp.job]));
  }
}

// (2026-10-11, the owner: "and can you also add in the front page that holders get discounts"; "AGI Studio's Explore
// (Recommended)") Under the top's words: what $AGI holders get here (src/studio/app-words.js HOLDER_LINE: the numbers from
// DISCOUNT and FREE_CREDITS), the levels and where they start, and that it's a thank-you, never an investment. Never "buy"
// (hard rule 8): where it starts, held or burned for messages.
function holderLine() {
  return h('div', { class: 'sa-holders', role: 'group', 'aria-labelledby': 'sa-holders-h' },
    h('p', { class: 'sa-holders-title', id: 'sa-holders-h' }, icon('heart'), h('span', { text: HOLDER_LINE.title })),
    h('ul', { class: 'sa-holders-rows' }, ...HOLDER_LINE.rows.map(([lvl, need, what]) => h('li', { class: 'sa-holders-row' },
      h('span', { class: 'sa-holders-lvl', text: lvl }), h('span', { class: 'sa-holders-need', text: need }), h('span', { class: 'sa-holders-what', text: what })))),
    h('p', { class: 'sa-holders-fine', text: HOLDER_LINE.fine }));
}

// A wall column's pictures (column c of 4): WALL_EACH of the covers, starting a quarter further round for each column, so no
// column shows the same picture twice in a row while there are enough of them
export function wallColumn(covers, c) {
  const n = Math.min(covers.length, 12);
  return n ? Array.from({ length: WALL_EACH }, (_, k) => covers[(c * 3 + k) % n]) : [];
}

// The heading's words in turns (the wall scrolls by itself: CSS), resting while the top is off screen or the tab is hidden
// (.is-still pauses the wall too), and never for "reduce motion". Each word's width is measured in em once its font is in
// (so it follows the heading's size), and the rotor's width (and its underline) moves to the next word's.
function heroMotion(ctx, hero, rotor, { still, first }) {
  const words = [...rotor.querySelectorAll('.sa-rotor-word')];
  let at = first;
  let widths = [];
  let seen = true;
  const fit = () => { if (widths[at]) rotor.style.width = `${widths[at].toFixed(3)}em`; };
  const measure = () => {
    if (!ctx.alive() || !rotor.isConnected) return;
    const size = parseFloat(getComputedStyle(rotor).fontSize) || 16;
    widths = words.map((w) => w.getBoundingClientRect().width / size);
    fit();
  };
  const moving = () => !still && seen && document.visibilityState === 'visible';
  const update = () => hero.classList.toggle('is-still', !moving());
  measure();
  document.fonts?.ready.then(measure).catch(() => {});
  // Pop mode changes the headline's font. Refit even in reduced-motion mode,
  // and again when a newly requested display font is ready.
  ctx.listen(window, 'agi:skin', () => {
    measure();
    document.fonts?.ready.then(measure).catch(() => {});
  });
  if (still) { update(); return; }
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      if (!ctx.alive()) { io.disconnect(); return; }
      seen = entries[entries.length - 1].isIntersecting;
      update();
    });
    io.observe(hero);
  }
  ctx.listen(document, 'visibilitychange', update);
  ctx.every(() => {
    if (!moving()) return;
    const next = (at + 1) % words.length;
    words[at].classList.replace('is-on', 'is-off');
    // the words before it rest below again, out of sight, for their next turn
    for (const [k, w] of words.entries()) if (k !== at && k !== next) w.classList.remove('is-off');
    words[next].classList.remove('is-off');
    words[next].classList.add('is-on');
    at = next;
    fit();
  }, HERO_EVERY_MS);
}
