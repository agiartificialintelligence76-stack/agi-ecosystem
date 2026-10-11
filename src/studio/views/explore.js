// AGI Studio: Explore (the app's front). Round 3 (2026-10-10, the owner's "Pro tool layout"): a compact top (what it is, in a
// line, with a wall of what people made beside it), the live stats board as one strip, the spotlight of the week, then the
// gallery (Trending · Influencers · My creations: views/gallery.js), and the two ways to start. Everything public here is the
// same for everyone (/api/launch?inf-explore and ?inf-stats, kept a little by the CDN); a signed-in wallet's hearts after.
import { h, icon, btn, linkBtn, pic, put, add } from '../ui.js';
import { infPic, infPoster, infExample, clankProfileUrl } from '../rules.js';
import { studioText, MODE_CARDS, STAT_NAMES, compact, tiny, weekText, prizeText } from '../app-words.js';
import { videoSheet, photoSheet, loadLiked, likeButton } from './shared.js';
import { gallery } from './gallery.js';

const MODE_ICON = { design: 'wand', picture: 'image' };
const MODE_EXAMPLES = { design: ['style-anime', 'style-real', 'style-toon'], picture: ['look-feminine', 'look-masculine', 'look-androgynous'] };
const list = (x) => (Array.isArray(x) ? x : []);
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export async function render(ctx, route, root) {
  document.title = 'AGI Studio · make your own AI influencer';
  const status = h('p', { class: 'sa-banner', role: 'status', hidden: true });
  const showStatus = () => {
    const t = ctx.info ? studioText(ctx.info, { allowed: ctx.me?.allowed !== false }) : ctx.infoFailed ? studioText(null) : '';
    status.textContent = t;
    status.hidden = !t;
  };

  // ---------- the top: the app in a line, and a wall of what people made ----------
  const wall = h('div', { class: 'sa-hero-wall', 'aria-hidden': 'true' }, ...[0, 1, 2, 3].map(() => h('div', { class: 'sa-wall-col' })));
  const seeTrends = btn('Browse trends', { kind: 'ghost', icon: 'zap' });
  const hero = h('section', { class: 'sa-hero' },
    h('div', { class: 'sa-hero-copy' },
      h('p', { class: 'sa-eyebrow' }, h('span', { class: 'sa-live-dot', 'aria-hidden': 'true' }), h('span', { text: 'AGI Studio · AI influencers' })),
      h('h1', { class: 'sa-display sa-hero-title', tabindex: '-1' }, h('span', { text: 'Your own ' }), h('span', { class: 'sa-grad', text: 'AI influencer' })),
      h('p', { class: 'sa-hero-sub', text: 'Design one in a few taps or start from a photo. Then photos in any scene, trend videos, short videos, a 3D model and a coin with its face.' }),
      h('div', { class: 'sa-row sa-hero-cta' },
        linkBtn('Create an influencer', ctx.href('/create'), { kind: 'primary', icon: 'plus', dataset: { saLink: '', guide: 'start' } }),
        seeTrends),
      status),
    wall);

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
  const open = (item) => (item.kind === 'photo'
    ? photoSheet(ctx, item, { name: item.inf?.name || 'An influencer', inf: item.inf?.id })
    : videoSheet(ctx, item, { name: item.inf?.name || 'An influencer', inf: item.inf?.id }));

  // the top's wall: what people made (pictures only: nothing plays by itself)
  const covers = fresh.map((v) => (v.kind === 'photo' ? infPic(v.inf?.id, v.id, 0, true) : v.poster ? infPoster(v.inf?.id, v.id) : null)).filter(Boolean)
    .concat(list(data.influencers).filter((i) => i.portrait).map((i) => infPic(i.id, i.portrait.job, i.portrait.n, true)));
  if (covers.length >= 4) {
    // 12 pictures, so the wall is full (with fewer, some come round again: it's decoration, hidden from screen readers)
    const cols = [...wall.children];
    for (let k = 0; k < 12; k++) add(cols[k % 4], pic(covers[k % Math.min(covers.length, 12)], { cls: 'sa-wall-pic', lazy: k > 3 }));
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
