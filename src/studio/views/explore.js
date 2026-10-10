// AGI Studio: Explore (the app's front: what it does, the three ways to start, the trend moves, the newest videos and
// influencers). Everything public here is the same for everyone (/api/launch?inf-explore, kept a little by the CDN).
import { h, icon, linkBtn, pic, put, add } from '../ui.js';
import { infPic, infPoster, trendOf, SHAPES } from '../rules.js';
import { studioText, MODE_CARDS } from '../app-words.js';
import { trendTile, trendSheet, videoSheet } from './shared.js';

const MODE_ICON = { design: 'wand', picture: 'image', face: 'camera' };

export async function render(ctx, route, root) {
  document.title = 'AGI Studio · make your own AI influencer';
  const status = h('p', { class: 'sa-banner', role: 'status', hidden: true });
  const showStatus = () => {
    const t = ctx.info ? studioText(ctx.info, { allowed: ctx.me?.allowed !== false }) : ctx.infoFailed ? studioText(null) : '';
    status.textContent = t;
    status.hidden = !t;
  };
  const modes = h('ul', { class: 'sa-modes' });
  const fillModes = () => {
    const cards = MODE_CARDS.filter((m) => m.id !== 'face' || ctx.info?.faces !== false);
    put(modes, ...cards.map((m) => h('li', null, h('a', { class: `sa-mode sa-mode-${m.id}`, href: ctx.href(`/create?mode=${m.id}`), dataset: { saLink: '' } },
      h('span', { class: 'sa-mode-icon' }, icon(MODE_ICON[m.id])),
      h('span', { class: 'sa-mode-name', text: m.name }),
      h('span', { class: 'sa-mode-note', text: m.note }),
      h('span', { class: 'sa-mode-go' }, h('span', { text: 'Start' }), icon('next'))))));
  };
  const trends = h('div', { class: 'sa-rail', role: 'list' });
  const trendsBox = h('section', { class: 'sa-section', 'aria-labelledby': 'sa-trends-h', hidden: true },
    h('div', { class: 'sa-section-head' }, h('h2', { class: 'sa-h2', id: 'sa-trends-h', text: 'Trending moves' }),
      h('p', { class: 'sa-muted', text: 'Pick a move: your influencer does it in a trend video. Or bring your own clip.' })), trends);
  const fresh = h('ul', { class: 'sa-grid sa-grid-videos sa-masonry' });
  const freshBox = h('section', { class: 'sa-section', 'aria-labelledby': 'sa-fresh-h', hidden: true },
    h('div', { class: 'sa-section-head' }, h('h2', { class: 'sa-h2', id: 'sa-fresh-h', text: 'Fresh videos' })), fresh);
  const people = h('ul', { class: 'sa-grid sa-grid-people' });
  const peopleBox = h('section', { class: 'sa-section', 'aria-labelledby': 'sa-people-h', hidden: true },
    h('div', { class: 'sa-section-head' }, h('h2', { class: 'sa-h2', id: 'sa-people-h', text: 'New influencers' })), people);
  const empty = h('section', { class: 'sa-empty', hidden: true },
    h('p', { class: 'sa-empty-title', text: 'Nothing here yet' }),
    h('p', { class: 'sa-muted', text: 'Be the first: create an influencer and its videos show up here (unless you keep it out of Explore).' }),
    linkBtn('Create an influencer', ctx.href('/create'), { kind: 'primary', icon: 'plus', dataset: { saLink: '' } }));
  const skeleton = h('div', { class: 'sa-skeleton-rows', 'aria-hidden': 'true' }, h('div', { class: 'sa-skel sa-skel-rail' }), h('div', { class: 'sa-skel sa-skel-grid' }));

  add(root,
    h('section', { class: 'sa-hero' },
      h('p', { class: 'sa-eyebrow' }, icon('spark'), h('span', { text: 'AGI Studio' })),
      h('h1', { class: 'sa-h1 sa-hero-title', tabindex: '-1' }, h('span', { text: 'Your own ' }), h('span', { class: 'sa-grad', text: 'AI influencer' }), h('span', { text: ', in minutes' })),
      h('p', { class: 'sa-hero-sub', text: 'Design one in a few taps, bring your own character to life, or make your AI twin. Then photos in any scene, trend videos, short videos, a 3D model and a coin with its face.' }),
      h('div', { class: 'sa-row sa-hero-cta' },
        linkBtn('Create an influencer', ctx.href('/create'), { kind: 'primary', size: 'lg', icon: 'plus', dataset: { saLink: '' } }),
        linkBtn('My studio', ctx.href('/me'), { kind: 'ghost', size: 'lg', dataset: { saLink: '' } })),
      status,
      h('ol', { class: 'sa-how' },
        h('li', null, h('strong', { text: 'Create' }), h('span', { text: 'Design it, from a picture, or your face' })),
        h('li', null, h('strong', { text: 'Pick a look' }), h('span', { text: '4 to choose from, then its full body' })),
        h('li', null, h('strong', { text: 'Make content' }), h('span', { text: 'Photos, trends, videos, 3D, a coin' })))),
    h('section', { class: 'sa-section', 'aria-labelledby': 'sa-modes-h' },
      h('div', { class: 'sa-section-head' }, h('h2', { class: 'sa-h2', id: 'sa-modes-h', text: 'Three ways to start' })), modes),
    skeleton, trendsBox, freshBox, peopleBox, empty,
  );
  fillModes();
  showStatus();
  ctx.on('info', () => { showStatus(); fillModes(); });
  ctx.on('me', showStatus);

  const data = await ctx.exploreData({ fresh: true });
  if (!ctx.alive()) return;
  skeleton.remove();
  if (!data) {
    empty.hidden = false;
    empty.querySelector('.sa-empty-title').textContent = "Couldn't load Explore just now";
    return;
  }
  const list = (x) => (Array.isArray(x) ? x : []);
  put(trends, ...list(data.trends).map((t) => h('div', { role: 'listitem' }, trendTile(t, { onpick: () => trendSheet(ctx, t) }))));
  trendsBox.hidden = !list(data.trends).length;
  put(fresh, ...list(data.fresh).map((v) => {
    const inf = v.inf?.id;
    const cover = v.poster ? infPoster(inf, v.id) : v.inf?.portrait ? infPic(inf, v.inf.portrait.job, v.inf.portrait.n, true) : null;
    const b = h('button', { type: 'button', class: `sa-tile sa-tile-video is-${SHAPES[v.shape] ? v.shape : 'tall'}`, 'aria-label': `${v.inf?.name || 'An influencer'}: ${v.kind === 'trend' ? `a trend video${v.trend && trendOf(v.trend) ? ` (${trendOf(v.trend).name})` : ''}` : 'a video'}` },
      cover ? pic(cover, { cls: 'sa-tile-pic' }) : h('span', { class: 'sa-tile-pic is-missing' }),
      h('span', { class: 'sa-tile-play', 'aria-hidden': 'true' }, icon('play')),
      h('span', { class: 'sa-tile-cap' },
        v.inf?.portrait ? pic(infPic(inf, v.inf.portrait.job, v.inf.portrait.n, true), { cls: 'sa-avatar sa-avatar-xs' }) : null,
        h('span', { text: v.inf?.name || '' })));
    b.addEventListener('click', () => videoSheet(ctx, v, { name: v.inf?.name || 'An influencer', inf }));
    return h('li', null, b);
  }));
  freshBox.hidden = !list(data.fresh).length;
  put(people, ...list(data.influencers).map((i) => h('li', null, h('a', { class: 'sa-tile sa-tile-person', href: ctx.href(`/i/${i.id}`), dataset: { saLink: '' } },
    i.portrait ? pic(infPic(i.id, i.portrait.job, i.portrait.n, true), { cls: 'sa-tile-pic', alt: '' }) : h('span', { class: 'sa-tile-pic is-missing' }),
    h('span', { class: 'sa-tile-cap' }, h('span', { text: i.name }))))));
  peopleBox.hidden = !list(data.influencers).length;
  empty.hidden = list(data.fresh).length > 0 || list(data.influencers).length > 0;
}
