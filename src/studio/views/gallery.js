// AGI Studio (round 3, 2026-10-10, the owner's "Pro tool layout": "gallery of real videos/pictures on the right: Trending ·
// Influencers · My creations"). Tabs over a wall, the same on Create and Explore:
//   • Trending: the owner's trend clips (each plays under a computer's mouse; a tap opens it, or on an influencer's page picks
//     it for its trend video), then the newest public photos and videos with their hearts (All · Photos · Videos);
//   • Influencers: the boosted ones (a burn put them there for a day), then the newest public ones;
//   • My creations: this wallet's own influencers (being made, ready, private), and Create new.
// Everything public here is Explore's answer (/api/launch?inf-explore, kept a little); a signed-in wallet's hearts after.
import { h, icon, btn, linkBtn, pic, put, add, nextId } from '../ui.js';
import { infPic, infVideo } from '../rules.js';
import { leftText, statusChip } from '../app-words.js';
import { trendTile, trendSheet, videoSheet, photoSheet, mediaTile, loadLiked, hoverPlay } from './shared.js';

export const GALLERY_TABS = { trending: 'Trending', influencers: 'Influencers', mine: 'My creations' };
const list = (x) => (Array.isArray(x) ? x : []);

// gallery(ctx, { initial, onTrend, alsoLiked }) → { node, show(tab), loaded (a promise: Explore's answer, or null) }
export function gallery(ctx, { initial = 'trending', onTrend = null, alsoLiked = [] } = {}) {
  const id = nextId('gal');
  let tab = Object.hasOwn(GALLERY_TABS, initial) ? initial : 'trending';
  let data = null, failed = false;
  const filter = { value: 'all' };
  const tabsEl = h('div', { class: 'sa-gtabs', role: 'tablist', 'aria-label': 'Gallery' });
  const tools = h('div', { class: 'sa-gtools' });
  const panels = Object.fromEntries(Object.keys(GALLERY_TABS).map((key) => [key,
    h('div', { class: 'sa-gpanel', role: 'tabpanel', id: `${id}-${key}`, 'aria-labelledby': `${id}-${key}-t`, hidden: key !== tab })]));
  // (2026-10-11) data-guide: Explore's guide points at its tabs
  const node = h('section', { class: 'sa-gallery', 'aria-label': 'Gallery' }, h('div', { class: 'sa-ghead', dataset: { guide: 'gallery' } }, tabsEl, tools), ...Object.values(panels));

  // ---------- the tabs (arrow keys move between them, like any tab list) ----------
  function drawTabs() {
    put(tabsEl, ...Object.entries(GALLERY_TABS).map(([key, label]) => {
      const b = h('button', { type: 'button', role: 'tab', class: 'sa-gtab', id: `${id}-${key}-t`, 'aria-controls': `${id}-${key}`,
        'aria-selected': String(key === tab), tabindex: key === tab ? '0' : '-1', dataset: { tab: key } },
      h('span', { text: label }), key === 'mine' && ctx.me?.influencers?.length ? h('span', { class: 'sa-gtab-n', text: String(ctx.me.influencers.length) }) : null);
      b.addEventListener('click', () => show(key));
      return b;
    }));
  }
  tabsEl.addEventListener('keydown', (e) => {
    const keys = Object.keys(GALLERY_TABS);
    const at = keys.indexOf(tab);
    const to = e.key === 'ArrowRight' ? keys[(at + 1) % keys.length] : e.key === 'ArrowLeft' ? keys[(at - 1 + keys.length) % keys.length]
      : e.key === 'Home' ? keys[0] : e.key === 'End' ? keys[keys.length - 1] : null;
    if (!to) return;
    e.preventDefault();
    show(to);
    tabsEl.querySelector(`[data-tab="${to}"]`)?.focus();
  });
  function show(key) {
    if (!Object.hasOwn(GALLERY_TABS, key)) return;
    tab = key;
    for (const [k, p] of Object.entries(panels)) p.hidden = k !== key;
    drawTabs();
    drawTools();
    draw(key);
  }

  // ---------- Trending's filter: All · Photos · Videos ----------
  function drawTools() {
    if (tab !== 'trending' || !list(data?.fresh).length) { put(tools); return; }
    put(tools, h('div', { class: 'sa-filter', role: 'group', 'aria-label': 'Show' }, ...[['all', 'All'], ['photos', 'Photos'], ['videos', 'Videos']].map(([v, label]) => {
      const b = h('button', { type: 'button', class: 'sa-filter-btn', 'aria-pressed': String(filter.value === v), text: label });
      b.addEventListener('click', () => { filter.value = v; drawTools(); draw('trending'); });
      return b;
    })));
  }

  const loadingTiles = () => h('div', { class: 'sa-gloading', 'aria-hidden': 'true' }, ...Array.from({ length: 8 }, () => h('span', { class: 'sa-skel' })));
  const empty = (title, text, action = null) => h('div', { class: 'sa-gempty' }, h('p', { class: 'sa-gempty-title', text: title }), h('p', { class: 'sa-muted', text }), action);
  const section = (title, note, ...kids) => h('div', { class: 'sa-gsec' },
    h('div', { class: 'sa-gsec-head' }, h('h2', { class: 'sa-gsec-title', text: title }), note ? h('p', { class: 'sa-gsec-note', text: note }) : null), ...kids);
  const openItem = (item) => (item.kind === 'photo'
    ? photoSheet(ctx, item, { name: item.inf?.name || 'An influencer', inf: item.inf?.id })
    : videoSheet(ctx, item, { name: item.inf?.name || 'An influencer', inf: item.inf?.id }));
  // (hidden: a banned wallet's own, whose pictures our server shows to nobody until the ban is lifted)
  const personCard = (i, { tag = null, note = null, hidden = false } = {}) => h('a', { class: 'sa-person', href: ctx.href(`/i/${i.id}`), dataset: { saLink: '' } },
    i.portrait && !hidden ? pic(infPic(i.id, i.portrait.job, i.portrait.n, true), { cls: 'sa-person-pic', alt: '' }) : h('span', { class: 'sa-person-pic is-missing' }, icon('user')),
    tag,
    h('span', { class: 'sa-person-cap' },
      h('span', { class: 'sa-person-name' }, h('span', { text: i.name }), i.private ? icon('shield') : null),
      // (round 4) its maker's clank.trade username, when they show it
      i.maker?.name ? h('span', { class: 'sa-person-by', text: `by @${i.maker.name}` }) : null,
      note ? h('span', { class: 'sa-person-note', text: note }) : null));

  function draw(key) {
    const box = panels[key];
    if (key === 'mine') { drawMine(); return; }
    if (!data) { put(box, failed ? empty("Couldn't load the gallery just now", 'Try again in a moment.') : loadingTiles()); return; }
    if (key === 'trending') {
      const trends = list(data.trends);
      const fresh = list(data.fresh).filter((v) => filter.value === 'all' || (filter.value === 'photos' ? v.kind === 'photo' : v.kind !== 'photo'));
      const trendRow = h('div', { class: 'sa-trend-row', role: 'list' }, ...trends.map((t) => {
        const tile = trendTile(t, { onpick: () => (onTrend ? onTrend(t) : trendSheet(ctx, t)) });
        hoverPlay(tile, infVideo(t.job));
        return h('div', { role: 'listitem' }, tile);
      }));
      put(box,
        trends.length ? section('Trend clips', onTrend ? 'Pick one: your influencer takes its person\'s place.' : 'Real-looking clips: your influencer takes its person\'s place.', trendRow) : null,
        list(data.fresh).length
          ? section('Fresh', "Holders' hearts pick the spotlight of the week.", fresh.length
            ? h('div', { class: 'sa-wall' }, ...fresh.map((v) => mediaTile(ctx, v, { onopen: openItem, badge: v.kind === 'trend' ? { text: 'Trend', icon: 'zap' } : v.kind === 'video' ? { text: 'Video', icon: 'film' } : null })))
            : h('p', { class: 'sa-muted', text: filter.value === 'photos' ? 'No photos yet.' : 'No videos yet.' }))
          : null,
        !trends.length && !list(data.fresh).length
          ? empty('Nothing here yet', 'Trend clips and what people make show up here. Be the first: create an influencer.',
            linkBtn('Create an influencer', ctx.href('/create'), { kind: 'primary', size: 'sm', icon: 'plus', dataset: { saLink: '' } }))
          : null);
      return;
    }
    // influencers: the boosted ones first, then the newest
    const boosted = list(data.boosted);
    const people = list(data.influencers);
    put(box,
      boosted.length ? section('Boosted', 'Their makers burned $AGI to put them here for a day.',
        h('ul', { class: 'sa-grid sa-grid-people' }, ...boosted.map((i) => h('li', null, personCard(i, {
          tag: h('span', { class: 'sa-tag sa-tag-boost' }, icon('rocket'), h('span', { text: 'Boosted' })), note: leftText(i.until) }))))) : null,
      people.length ? section('New influencers', null, h('ul', { class: 'sa-grid sa-grid-people' }, ...people.map((i) => h('li', null, personCard(i))))) : null,
      !boosted.length && !people.length ? empty('No influencers yet', 'Public influencers show up here. Yours can be the first.',
        linkBtn('Create an influencer', ctx.href('/create'), { kind: 'primary', size: 'sm', icon: 'plus', dataset: { saLink: '' } })) : null);
  }

  // ---------- My creations: this wallet's influencers ----------
  function drawMine() {
    const box = panels.mine;
    if (!ctx.session) {
      const go = btn('Connect your wallet', { kind: 'primary', size: 'sm', icon: 'wallet' });
      go.addEventListener('click', async () => { if (await ctx.requireAdult()) ctx.connect(); });
      put(box, empty('Your creations live in your wallet', 'Connect it to see your influencers here. A free signature, never a transaction.', go));
      return;
    }
    if (!ctx.me) { put(box, loadingTiles()); return; }
    const mine = list(ctx.me.influencers);
    const slots = ctx.me.slots;
    const full = slots && slots.max > 0 && slots.used >= slots.max;
    put(box, h('ul', { class: 'sa-grid sa-grid-people' },
      h('li', null, full
        ? h('div', { class: 'sa-person sa-person-new is-full' }, h('span', { class: 'sa-new-plus' }, icon('user')), h('span', { class: 'sa-person-name' }, h('span', { text: 'All your influencers' })),
          h('span', { class: 'sa-person-note', text: 'Delete one, or unlock one more in My studio' }))
        : h('a', { class: 'sa-person sa-person-new', href: ctx.href('/create'), dataset: { saLink: '' } }, h('span', { class: 'sa-new-plus' }, icon('plus')), h('span', { class: 'sa-person-name' }, h('span', { text: 'Create new' })))),
      ...mine.map((i) => h('li', null, personCard(i, {
        tag: i.status !== 'ready' ? h('span', { class: `sa-tag sa-state is-${i.status}`, text: statusChip(i.status) })
          : i.boosted ? h('span', { class: 'sa-tag sa-tag-boost' }, icon('rocket'), h('span', { text: 'Boosted' })) : null,
        note: ctx.me.banned ? 'Hidden while banned' : i.private ? 'Private' : i.status !== 'ready' ? (i.status === 'failed' ? 'Its credits came back' : 'Not in Explore yet') : i.public ? 'In Explore' : 'Only by its link',
        hidden: ctx.me.banned === true,
      })))));
  }

  drawTabs();
  drawTools();
  draw(tab);
  ctx.on('me', () => { drawTabs(); drawMine(); });
  ctx.on('wallet', () => { drawTabs(); drawMine(); liked(); });
  const liked = () => loadLiked(ctx, [...list(data?.fresh).map((v) => v.id), ...alsoLiked]);
  const loaded = ctx.exploreData({ fresh: true }).then((d) => {
    if (!ctx.alive()) return null;
    data = d;
    failed = !d;
    drawTools();
    for (const key of ['trending', 'influencers']) draw(key);
    liked();
    return d;
  });
  return { node, show, loaded, get tab() { return tab; } };
}
