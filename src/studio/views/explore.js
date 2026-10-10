// AGI Studio: Explore (the app's front: media first, like the apps people know, in our own look). What it does, the live
// stats board, the spotlight of the week, the trend clips, the boosted influencers, the newest photos and videos (with their
// hearts) and the newest influencers. Everything public here is the same for everyone (/api/launch?inf-explore and
// ?inf-stats, kept a little by the CDN); a signed-in wallet's own hearts are filled in after (inf-liked).
import { h, icon, btn, linkBtn, pic, put, add } from '../ui.js';
import { infPic, infPoster, infVideo, infExample } from '../rules.js';
import { studioText, MODE_CARDS, STAT_NAMES, compact, tiny, weekText, prizeText, leftText } from '../app-words.js';
import { trendTile, trendSheet, videoSheet, photoSheet, mediaTile, loadLiked, likeButton } from './shared.js';

const MODE_ICON = { design: 'wand', picture: 'image' };
const MODE_EXAMPLES = { design: ['style-anime', 'style-real', 'style-toon'], picture: ['look-feminine', 'look-masculine', 'look-androgynous'] };
const list = (x) => (Array.isArray(x) ? x : []);
const fine = () => matchMedia('(hover: hover) and (pointer: fine)').matches;
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// a trend clip's tile plays its clip while the pointer rests on it (a computer's mouse only: never on phones, never by itself)
export function hoverPlay(tile, src) {
  if (!fine() || calm()) return;
  let timer = null, video = null;
  const frame = tile.querySelector('.sa-trend-frame') || tile;
  tile.addEventListener('pointerenter', () => {
    timer = setTimeout(() => {
      video = h('video', { class: 'sa-trend-live', src, muted: true, loop: true, playsinline: true, autoplay: true, preload: 'auto', 'aria-hidden': 'true' });
      frame.append(video);
      video.play?.().catch(() => {});
    }, 220);
  });
  tile.addEventListener('pointerleave', () => {
    clearTimeout(timer);
    if (video) { video.pause(); video.removeAttribute('src'); video.load(); video.remove(); video = null; }
  });
}

export async function render(ctx, route, root) {
  document.title = 'AGI Studio · make your own AI influencer';
  const status = h('p', { class: 'sa-banner', role: 'status', hidden: true });
  const showStatus = () => {
    const t = ctx.info ? studioText(ctx.info, { allowed: ctx.me?.allowed !== false }) : ctx.infoFailed ? studioText(null) : '';
    status.textContent = t;
    status.hidden = !t;
  };

  // ---------- the hero: the app in one line, and a wall of what people made ----------
  const wall = h('div', { class: 'sa-hero-wall', 'aria-hidden': 'true' }, ...[0, 1, 2].map(() => h('div', { class: 'sa-wall-col' })));
  const seeTrends = btn('See trends', { kind: 'ghost', size: 'lg', icon: 'zap', hidden: true });
  const hero = h('section', { class: 'sa-hero' },
    h('div', { class: 'sa-hero-copy' },
      h('p', { class: 'sa-eyebrow' }, h('span', { class: 'sa-live-dot', 'aria-hidden': 'true' }), h('span', { text: 'AGI Studio · AI influencers' })),
      h('h1', { class: 'sa-display sa-hero-title', tabindex: '-1' }, h('span', { text: 'Your own ' }), h('span', { class: 'sa-grad', text: 'AI influencer' })),
      h('p', { class: 'sa-hero-sub', text: 'Design one in a few taps or start from a photo. Then photos in any scene, trend videos, short videos, a 3D model and a coin with its face.' }),
      h('div', { class: 'sa-row sa-hero-cta' },
        linkBtn('Create an influencer', ctx.href('/create'), { kind: 'primary', size: 'lg', icon: 'plus', dataset: { saLink: '' } }),
        seeTrends),
      status),
    wall);

  // ---------- the live stats board ----------
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

  // ---------- the spotlight of the week (round 2: holders' likes pick it, the owner approves it) ----------
  const spot = h('section', { class: 'sa-section', 'aria-labelledby': 'sa-spot-h', hidden: true });
  // ---------- trends, boosted, fresh, new ----------
  const trends = h('div', { class: 'sa-rail sa-rail-trends', role: 'list' });
  const trendsBox = h('section', { class: 'sa-section', 'aria-labelledby': 'sa-trends-h', hidden: true },
    h('div', { class: 'sa-section-head' }, h('h2', { class: 'sa-h2', id: 'sa-trends-h' }, icon('zap'), h('span', { text: 'Trending' })),
      h('p', { class: 'sa-muted', text: 'Real-looking clips: your influencer takes the place of its person. Or bring your own clip.' })), trends);
  const boosted = h('div', { class: 'sa-rail sa-rail-people', role: 'list' });
  const boostedBox = h('section', { class: 'sa-section', 'aria-labelledby': 'sa-boost-h', hidden: true },
    h('div', { class: 'sa-section-head' }, h('h2', { class: 'sa-h2', id: 'sa-boost-h' }, icon('rocket'), h('span', { text: 'Boosted' })),
      h('p', { class: 'sa-muted', text: 'Their makers burned $AGI to put them here for a day.' })), boosted);
  const freshGrid = h('div', { class: 'sa-wall' });
  const filter = { value: route.q.get('show') === 'photos' || route.q.get('show') === 'videos' ? route.q.get('show') : 'all' };
  const filters = h('div', { class: 'sa-filter', role: 'group', 'aria-label': 'Show' });
  const freshBox = h('section', { class: 'sa-section', 'aria-labelledby': 'sa-fresh-h', hidden: true },
    h('div', { class: 'sa-section-head sa-row-between' }, h('div', null, h('h2', { class: 'sa-h2', id: 'sa-fresh-h' }, icon('flame'), h('span', { text: 'Fresh' })),
      h('p', { class: 'sa-muted', text: "Holders' hearts pick the spotlight of the week." })), filters), freshGrid);
  const people = h('ul', { class: 'sa-grid sa-grid-people' });
  const peopleBox = h('section', { class: 'sa-section', 'aria-labelledby': 'sa-people-h', hidden: true },
    h('div', { class: 'sa-section-head' }, h('h2', { class: 'sa-h2', id: 'sa-people-h' }, icon('user'), h('span', { text: 'New influencers' }))), people);
  const modes = h('ul', { class: 'sa-modes' });
  const fillModes = () => {
    put(modes, ...MODE_CARDS.map((m) => {
      const ex = MODE_EXAMPLES[m.id].map((k) => ctx.info?.examples?.[k]).filter(Boolean);
      return h('li', null, h('a', { class: `sa-mode sa-mode-${m.id}`, href: ctx.href(`/create?mode=${m.id}`), dataset: { saLink: '' } },
        h('span', { class: 'sa-mode-art', 'aria-hidden': 'true' }, ex.length
          ? ex.slice(0, 3).map((job) => pic(infExample(job), { cls: 'sa-mode-pic' }))
          : h('span', { class: 'sa-mode-icon' }, icon(MODE_ICON[m.id]))),
        h('span', { class: 'sa-mode-name', text: m.name }),
        h('span', { class: 'sa-mode-note', text: m.note }),
        h('span', { class: 'sa-mode-go' }, h('span', { text: 'Start' }), icon('next'))));
    }));
  };
  const modesBox = h('section', { class: 'sa-section', 'aria-labelledby': 'sa-modes-h' },
    h('div', { class: 'sa-section-head' }, h('h2', { class: 'sa-h2', id: 'sa-modes-h' }, icon('spark'), h('span', { text: 'Two ways to start' }))), modes);
  const empty = h('section', { class: 'sa-empty', hidden: true },
    h('p', { class: 'sa-empty-title', text: 'Nothing here yet' }),
    h('p', { class: 'sa-muted', text: 'Be the first: create an influencer and its photos and videos show up here (unless you keep it out of Explore).' }),
    linkBtn('Create an influencer', ctx.href('/create'), { kind: 'primary', icon: 'plus', dataset: { saLink: '' } }));
  const skeleton = h('div', { class: 'sa-skeleton-rows', 'aria-hidden': 'true' }, h('div', { class: 'sa-skel sa-skel-rail' }), h('div', { class: 'sa-skel sa-skel-grid' }));

  add(root, hero, stats, skeleton, spot, trendsBox, boostedBox, freshBox, peopleBox, modesBox, empty);
  fillModes();
  showStatus();
  ctx.on('info', () => { showStatus(); fillModes(); });
  ctx.on('me', showStatus);
  loadStats();
  ctx.every(() => { if (document.visibilityState === 'visible') loadStats(); }, 60_000);

  const data = await ctx.exploreData({ fresh: true });
  if (!ctx.alive()) return;
  skeleton.remove();
  if (!data) {
    empty.hidden = false;
    empty.querySelector('.sa-empty-title').textContent = "Couldn't load Explore just now";
    return;
  }
  const fresh = list(data.fresh);
  const open = (item) => (item.kind === 'photo'
    ? photoSheet(ctx, item, { name: item.inf?.name || 'An influencer', inf: item.inf?.id })
    : videoSheet(ctx, item, { name: item.inf?.name || 'An influencer', inf: item.inf?.id }));

  // the hero's wall: what people made (pictures only: nothing plays by itself)
  const covers = fresh.map((v) => (v.kind === 'photo' ? infPic(v.inf?.id, v.id, 0, true) : v.poster ? infPoster(v.inf?.id, v.id) : null)).filter(Boolean)
    .concat(list(data.influencers).filter((i) => i.portrait).map((i) => infPic(i.id, i.portrait.job, i.portrait.n, true)));
  if (covers.length >= 3) {
    // 9 pictures, so the wall is full (with fewer, some come round again: it's decoration, hidden from screen readers)
    const cols = [...wall.children];
    for (let k = 0; k < 9; k++) add(cols[k % 3], pic(covers[k % Math.min(covers.length, 9)], { cls: 'sa-wall-pic', lazy: k > 2 }));
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
      h('div', { class: 'sa-spot' },
        media,
        h('div', { class: 'sa-spot-copy' },
          h('p', { class: 'sa-tag sa-tag-gold' }, icon('trophy'), h('span', { text: 'Spotlight of the week' })),
          h('h2', { class: 'sa-display sa-spot-title', id: 'sa-spot-h', text: sp.inf.name }),
          h('p', { class: 'sa-muted', text: `The most loved creation of ${weekText(sp.week)}, picked by holders' hearts.` }),
          h('dl', { class: 'sa-spot-facts' },
            h('div', null, h('dt', { text: 'Likes' }), h('dd', { text: compact(sp.likes) })),
            h('div', null, h('dt', { text: "Holders' likes" }), h('dd', { text: compact(sp.holderLikes) })),
            h('div', null, h('dt', { text: 'Prize' }), h('dd', { text: prizeText(sp.prize) }))),
          h('div', { class: 'sa-row' },
            linkBtn(`See ${sp.inf.name}`, ctx.href(`/i/${sp.inf.id}`), { kind: 'primary', dataset: { saLink: '' } }),
            likeButton(ctx, { job: sp.job, likes: sp.likes, cls: 'sa-heart-lg' })),
          sp.prize > 0 ? h('p', { class: 'sa-fine', text: 'A prize is a thank-you for making, sent to the maker\'s own wallet: not an investment, not financial advice.' }) : null)));
    spot.hidden = false;
  }

  // the trend clips
  put(trends, ...list(data.trends).map((t) => {
    const tile = trendTile(t, { onpick: () => trendSheet(ctx, t) });
    hoverPlay(tile, infVideo(t.job));
    return h('div', { role: 'listitem' }, tile);
  }));
  trendsBox.hidden = !list(data.trends).length;
  seeTrends.hidden = trendsBox.hidden;
  seeTrends.addEventListener('click', () => { trendsBox.scrollIntoView({ behavior: calm() ? 'auto' : 'smooth', block: 'start' }); trends.querySelector('button')?.focus({ preventScroll: true }); });

  // the boosted ones
  put(boosted, ...list(data.boosted).map((i) => h('div', { role: 'listitem' }, h('a', { class: 'sa-person', href: ctx.href(`/i/${i.id}`), dataset: { saLink: '' } },
    i.portrait ? pic(infPic(i.id, i.portrait.job, i.portrait.n, true), { cls: 'sa-person-pic', alt: '' }) : h('span', { class: 'sa-person-pic is-missing' }),
    h('span', { class: 'sa-tag sa-tag-boost' }, icon('rocket'), h('span', { text: 'Boosted' })),
    h('span', { class: 'sa-person-cap' }, h('span', { class: 'sa-person-name', text: i.name }), h('span', { class: 'sa-person-note', text: leftText(i.until) }))))));
  boostedBox.hidden = !list(data.boosted).length;

  // the newest photos and videos, with their hearts
  const drawFresh = () => {
    const shown = fresh.filter((v) => filter.value === 'all' || (filter.value === 'photos' ? v.kind === 'photo' : v.kind !== 'photo'));
    put(freshGrid, ...shown.map((v) => mediaTile(ctx, v, { onopen: open, badge: v.kind === 'trend' ? { text: 'Trend', icon: 'zap' } : null })));
    put(filters, ...[['all', 'All'], ['photos', 'Photos'], ['videos', 'Videos']].map(([v, label]) => {
      const b = h('button', { type: 'button', class: 'sa-filter-btn', 'aria-pressed': String(filter.value === v), text: label });
      b.addEventListener('click', () => { filter.value = v; drawFresh(); });
      return b;
    }));
  };
  drawFresh();
  freshBox.hidden = !fresh.length;
  const liked = () => loadLiked(ctx, [...fresh.map((v) => v.id), ...(sp ? [sp.job] : [])]);
  liked();
  ctx.on('wallet', liked);

  // the newest influencers
  put(people, ...list(data.influencers).map((i) => h('li', null, h('a', { class: 'sa-person', href: ctx.href(`/i/${i.id}`), dataset: { saLink: '' } },
    i.portrait ? pic(infPic(i.id, i.portrait.job, i.portrait.n, true), { cls: 'sa-person-pic', alt: '' }) : h('span', { class: 'sa-person-pic is-missing' }),
    h('span', { class: 'sa-person-cap' }, h('span', { class: 'sa-person-name', text: i.name }))))));
  peopleBox.hidden = !list(data.influencers).length;
  empty.hidden = fresh.length > 0 || list(data.influencers).length > 0;
}
