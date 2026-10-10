// AGI Studio: My studio (the connected wallet: its credits, its holder perks, its influencers, its prices).
import { h, icon, btn, linkBtn, pic, put, add } from '../ui.js';
import { infPic, creditsText, PRICES } from '../rules.js';
import { LEVEL_NAMES, shortAddress, num, perksText, statusChip, studioText, errorText } from '../app-words.js';

const PRICE_NAMES = { influencer: 'A new influencer (4 looks and its full body)', looks: '4 new looks', photo: 'A photo', trend: 'A trend video', video: 'A 5-second video', model: 'A 3D model' };

export function render(ctx, route, root) {
  document.title = 'My studio · AGI Studio';
  const body = h('div', { class: 'sa-me' });
  add(root, h('header', { class: 'sa-page-head' }, h('h1', { class: 'sa-h1', tabindex: '-1', text: 'My studio' })), body);

  const draw = () => {
    if (!ctx.session) {
      const go = btn('Connect your wallet', { kind: 'primary', size: 'lg', icon: 'wallet' });
      go.addEventListener('click', async () => { if (await ctx.requireAdult()) ctx.connect(); });
      put(body, h('section', { class: 'sa-card sa-empty' },
        h('span', { class: 'sa-empty-icon' }, icon('wallet')),
        h('p', { class: 'sa-empty-title', text: 'Your studio lives in your wallet' }),
        h('p', { class: 'sa-muted', text: 'Connect it to see your credits and your influencers. A free signature, never a transaction.' }), go));
      return;
    }
    const s = ctx.session;
    const me = ctx.me;
    const out = btn('Disconnect', { kind: 'quiet', size: 'sm' });
    out.addEventListener('click', () => ctx.signOut());
    const wallet = h('section', { class: 'sa-card sa-wallet-card' },
      h('div', { class: 'sa-row sa-row-between' },
        h('div', null, h('p', { class: 'sa-label', text: 'Your wallet' }), h('p', { class: 'sa-wallet-line' }, h('span', { class: `sa-dot sa-lvl-${s.level}`, 'aria-hidden': 'true' }),
          h('strong', { text: shortAddress(s.wallet) }), h('span', { class: 'sa-muted', text: ` · ${LEVEL_NAMES[s.level] || LEVEL_NAMES[1]}` }))),
        out),
      h('p', { class: 'sa-muted sa-small', text: perksText(s.level) }));
    const buy = btn('Buy credits', { kind: 'primary', icon: 'bolt' });
    buy.addEventListener('click', () => ctx.buyCredits());
    const credits = h('section', { class: 'sa-card sa-credits-card', id: 'credits' },
      h('div', { class: 'sa-credits-row' },
        h('div', null, h('p', { class: 'sa-label', text: 'Your credits' }),
          h('p', { class: 'sa-credits-big' }, icon('bolt'), h('span', { text: me ? num(me.credits?.total) : '…' }))),
        buy),
      me && me.credits?.free > 0 ? h('p', { class: 'sa-muted sa-small', text: `${creditsText(me.credits.free)} of them are this month's free ones (used first; they end with the month).` }) : null,
      h('p', { class: 'sa-fine', text: "1 credit = 1 cent of USDG. Credits have no cash value: they can't be withdrawn, sold or refunded. Something that can't be made gives its credits back." }));
    const warn = studioText(ctx.info, { allowed: me?.allowed !== false });
    const list = (me?.influencers || []);
    const grid = h('ul', { class: 'sa-grid sa-grid-people' },
      h('li', null, h('a', { class: 'sa-tile sa-tile-new', href: ctx.href('/create'), dataset: { saLink: '' } }, h('span', { class: 'sa-new-plus' }, icon('plus')), h('span', { text: 'Create new' }))),
      ...list.map((i) => h('li', null, h('a', { class: 'sa-tile sa-tile-person', href: ctx.href(`/i/${i.id}`), dataset: { saLink: '' } },
        i.portrait ? pic(infPic(i.id, i.portrait.job, i.portrait.n, true), { cls: 'sa-tile-pic' }) : h('span', { class: 'sa-tile-pic is-missing' }),
        h('span', { class: `sa-chip-state is-${i.status}`, text: statusChip(i.status) }),
        h('span', { class: 'sa-tile-cap' }, h('span', { text: i.name }), i.mode === 'face' ? icon('shield') : null)))));
    const prices = h('section', { class: 'sa-card' }, h('h2', { class: 'sa-h3', text: 'Your prices' }),
      h('dl', { class: 'sa-prices' }, ...Object.keys(PRICES).map((k) => [h('dt', { text: PRICE_NAMES[k] }), h('dd', null, icon('bolt'), h('span', { text: num(me?.prices?.[k] ?? PRICES[k]) }))]).flat()),
      ctx.info?.threeD && s.level === 3 ? h('p', { class: 'sa-muted sa-small', text: 'Soulmate: your first 3D model each month is free.' }) : null);
    // what people come back for first: their credits (one line) and their influencers; then the wallet and prices
    put(body,
      warn ? h('p', { class: 'sa-banner', text: warn }) : null,
      ctx.meError && !me ? h('p', { class: 'sa-banner', text: errorText(ctx.meError) }) : null,
      credits,
      h('section', { class: 'sa-section sa-mine', 'aria-labelledby': 'sa-mine-h' }, h('div', { class: 'sa-section-head' }, h('h2', { class: 'sa-h2', id: 'sa-mine-h', text: 'My influencers' })), grid),
      h('div', { class: 'sa-me-top' }, wallet, prices),
      me?.owner ? h('p', null, linkBtn('Owner tools', ctx.href('/owner'), { kind: 'ghost', icon: 'shield', dataset: { saLink: '' } })) : null,
    );
  };
  draw();
  ctx.on('me', draw);
  ctx.on('wallet', draw);
  ctx.on('info', draw);
  if (ctx.session) ctx.refreshMe();
  // influencers being made: their states change while you look
  ctx.every(() => {
    if (document.visibilityState === 'visible' && (ctx.me?.influencers || []).some((i) => ['looks', 'body'].includes(i.status))) ctx.refreshMe();
  }, 10_000);
}
