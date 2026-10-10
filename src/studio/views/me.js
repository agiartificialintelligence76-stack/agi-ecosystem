// AGI Studio: My studio (the connected wallet: its credits, its influencers and how many it may have, its burn unlocks
// waiting for their burn, its weekly prizes to claim, its holder perks and its prices).
import { h, icon, btn, linkBtn, pic, put, add, busy } from '../ui.js';
import { infPic, creditsText, PRICES } from '../rules.js';
import {
  LEVEL_NAMES, shortAddress, num, perksText, statusChip, studioText, errorText, BURN_WHATS, myWeekText, prizeText, weekText,
} from '../app-words.js';
import { unlockSlot, boostInf } from './shared.js';

const PRICE_NAMES = { influencer: 'A new influencer (4 looks and its full body)', looks: '4 new looks', photo: 'A photo', trend: 'A trend video', video: 'A 5-second video', model: 'A 3D model' };
const TX = (tx) => `https://robinhoodchain.blockscout.com/tx/${tx}`;

export function render(ctx, route, root) {
  document.title = 'My studio · AGI Studio';
  const body = h('div', { class: 'sa-me' });
  add(root, h('header', { class: 'sa-page-head' },
    h('p', { class: 'sa-eyebrow', text: 'Your wallet, your influencers' }),
    h('h1', { class: 'sa-display sa-page-title', tabindex: '-1', text: 'My studio' })), body);
  // a weekly prize being claimed keeps its button busy across redraws (the page is drawn again when credits change)
  const claiming = new Set();

  // ---------- its weekly prizes (round 2: the spotlight of the week, picked by holders' hearts) ----------
  function prizeCard(w) {
    const line = h('p', { class: 'sa-prize-text', text: myWeekText(w) });
    const note = h('p', { class: 'sa-note', role: 'status', hidden: true });
    const actions = h('div', { class: 'sa-row' });
    const tx = (hash) => h('a', { class: 'sa-link', href: TX(hash), target: '_blank', rel: 'noopener noreferrer', text: 'See it on the block explorer ↗' });
    if (w.status === 'sent' && w.tx) add(actions, tx(w.tx));
    if (['approved', 'claimed', 'sending'].includes(w.status)) {
      const claim = btn(w.status === 'approved' ? `Claim ${prizeText(w.prize)}` : 'Check again', { kind: w.status === 'approved' ? 'primary' : 'ghost', icon: w.status === 'approved' ? 'trophy' : 'refresh' });
      claim.disabled = claiming.has(w.week);
      claim.addEventListener('click', () => {
        claiming.add(w.week);
        busy(claim, w.status === 'approved' ? 'Sending it to your wallet…' : 'Checking…', async () => {
          const r = await ctx.act('inf-week-claim', { week: w.week });
          claiming.delete(w.week);
          const d = r.data || {};
          if (r.ok && d.ok) {
            ctx.toast(`Sent: ${prizeText(d.amount)} to your wallet 💜`, 'good');
            ctx.refreshMe();
            return;
          }
          note.hidden = false;
          note.replaceChildren(h('span', { text: errorText(d.error) }), d.tx ? ' ' : null, d.tx ? tx(d.tx) : null);
          if (['sending', 'claimed', 'sent'].includes(d.error)) ctx.refreshMe();
        });
      });
      add(actions, claim);
    }
    return h('li', { class: 'sa-prize' },
      h('span', { class: 'sa-prize-icon', 'aria-hidden': 'true' }, icon('trophy')),
      h('div', { class: 'sa-prize-body' },
        h('p', { class: 'sa-prize-title', text: `Spotlight of ${weekText(w.week)}` }),
        line, actions, note,
        h('p', { class: 'sa-fine', text: 'A prize is a thank-you for making, sent to the wallet that made it: not an investment, not financial advice.' })));
  }

  // ---------- its burn unlocks waiting for their burn, and the ones done lately ----------
  function burnRow(b, me) {
    const inf = (me.influencers || []).find((i) => i.id === b.inf);
    const what = b.what === 'boost' && inf ? `Boost ${inf.name}` : BURN_WHATS[b.what] || 'An unlock';
    const line = b.status === 'paid'
      ? `Done ✓ · ${num(b.paid)} $AGI burned`
      : b.paid > 0 ? `Burned so far: ${num(b.paid)} of ${num(b.agi)} $AGI` : `Waiting for your burn: ${num(b.agi)} $AGI`;
    const row = h('li', { class: `sa-burn-row${b.status === 'paid' ? ' is-done' : ''}` },
      h('span', { class: 'sa-burn-row-icon', 'aria-hidden': 'true' }, icon(b.what === 'boost' ? 'rocket' : b.what === 'model' ? 'cube' : 'plus')),
      h('div', { class: 'sa-burn-row-body' }, h('p', { class: 'sa-burn-row-title', text: what }), h('p', { class: 'sa-muted sa-small', text: line })));
    if (b.status === 'quote' && (b.what === 'slot' || (b.what === 'boost' && inf))) {
      const go = btn('Continue', { kind: 'ghost', size: 'sm', icon: 'flame' });
      go.addEventListener('click', () => (b.what === 'slot'
        ? unlockSlot(ctx, { quote: b, onDone: () => ctx.refreshMe() })
        : boostInf(ctx, inf, { quote: b, hours: b.hours || ctx.info?.burns?.boostHours || 24, onDone: () => ctx.refreshMe() })));
      add(row, go);
    } else if (b.status === 'quote' && b.what === 'model' && inf) {
      add(row, linkBtn('Open', ctx.href(`/i/${inf.id}`), { kind: 'ghost', size: 'sm', dataset: { saLink: '' } }));
    }
    return row;
  }

  const draw = () => {
    if (!ctx.session) {
      const go = btn('Connect your wallet', { kind: 'primary', size: 'lg', icon: 'wallet' });
      go.addEventListener('click', async () => { if (await ctx.requireAdult()) ctx.connect(); });
      put(body, h('section', { class: 'sa-empty' },
        h('span', { class: 'sa-empty-icon' }, icon('wallet')),
        h('p', { class: 'sa-empty-title', text: 'Your studio lives in your wallet' }),
        h('p', { class: 'sa-muted', text: 'Connect it to see your credits and your influencers. A free signature, never a transaction.' }), go));
      return;
    }
    const s = ctx.session;
    const me = ctx.me;
    const info = ctx.info;

    // the three numbers that matter: credits, its level, its influencers
    const buy = btn('Buy credits', { kind: 'primary', icon: 'bolt' });
    buy.addEventListener('click', () => ctx.buyCredits());
    const credits = h('section', { class: 'sa-stat-card sa-stat-credits', id: 'credits' },
      h('p', { class: 'sa-label', text: 'Credits' }),
      h('p', { class: 'sa-stat-big' }, icon('bolt'), h('span', { text: me ? num(me.credits?.total) : '…' })),
      me && me.credits?.free > 0 ? h('p', { class: 'sa-muted sa-small', text: `${creditsText(me.credits.free)} of them are this month's free ones (used first; they end with the month).` }) : null,
      buy);
    const out = btn('Disconnect', { kind: 'quiet', size: 'sm' });
    out.addEventListener('click', () => ctx.signOut());
    const wallet = h('section', { class: 'sa-stat-card sa-stat-level' },
      h('p', { class: 'sa-label', text: 'Holder level' }),
      h('p', { class: 'sa-stat-big' }, h('span', { class: `sa-dot sa-lvl-${s.level}`, 'aria-hidden': 'true' }), h('span', { text: LEVEL_NAMES[s.level] || LEVEL_NAMES[1] })),
      h('p', { class: 'sa-muted sa-small', text: perksText(s.level) }),
      h('div', { class: 'sa-row sa-row-between' }, h('span', { class: 'sa-mono sa-small', text: shortAddress(s.wallet) }), out));
    const slots = me?.slots;
    const canUnlock = Number(info?.burns?.slot) > 0;
    const unlock = canUnlock ? btn(`Unlock one more · ${num(info.burns.slot)} $AGI`, { kind: 'ghost', size: 'sm', icon: 'flame' }) : null;
    unlock?.addEventListener('click', () => unlockSlot(ctx, { onDone: () => ctx.refreshMe() }));
    const slotCard = h('section', { class: 'sa-stat-card sa-stat-slots' },
      h('p', { class: 'sa-label', text: 'Influencers' }),
      h('p', { class: 'sa-stat-big' }, icon('user'), h('span', { text: slots ? `${num(slots.used)} of ${num(slots.max)}` : '…' })),
      h('p', { class: 'sa-muted sa-small', text: slots?.extra > 0
        ? `${num(slots.extra)} more unlocked by burning $AGI. Deleting one makes room again.`
        : 'How many your wallet may have at once. Deleting one makes room again.' }),
      unlock);

    const warn = studioText(info, { allowed: me?.allowed !== false });
    const list = me?.influencers || [];
    const full = slots && slots.used >= slots.max;
    const grid = h('ul', { class: 'sa-grid sa-grid-people' },
      h('li', null, full
        ? h('div', { class: 'sa-person sa-person-new is-full' }, h('span', { class: 'sa-new-plus' }, icon('user')), h('span', { class: 'sa-person-name', text: 'All your influencers' }),
          h('span', { class: 'sa-person-note', text: canUnlock ? 'Unlock one more above' : 'Delete one to make room' }))
        : h('a', { class: 'sa-person sa-person-new', href: ctx.href('/create'), dataset: { saLink: '' } }, h('span', { class: 'sa-new-plus' }, icon('plus')), h('span', { class: 'sa-person-name', text: 'Create new' }))),
      ...list.map((i) => h('li', null, h('a', { class: 'sa-person', href: ctx.href(`/i/${i.id}`), dataset: { saLink: '' } },
        i.portrait ? pic(infPic(i.id, i.portrait.job, i.portrait.n, true), { cls: 'sa-person-pic', alt: '' }) : h('span', { class: 'sa-person-pic is-missing' }, icon('user')),
        i.status !== 'ready' ? h('span', { class: `sa-tag sa-state is-${i.status}`, text: statusChip(i.status) })
          : i.boosted ? h('span', { class: 'sa-tag sa-tag-boost' }, icon('rocket'), h('span', { text: 'Boosted' })) : null,
        h('span', { class: 'sa-person-cap' },
          h('span', { class: 'sa-person-name' }, h('span', { text: i.name }), i.private ? icon('shield') : null),
          h('span', { class: 'sa-person-note', text: i.private ? 'Private' : i.status !== 'ready' ? (i.status === 'failed' ? 'Its credits came back' : 'Not in Explore yet') : i.public ? 'In Explore' : 'Only by its link' }))))));

    const weeks = me?.weeks || [];
    const prizes = weeks.length ? h('section', { class: 'sa-section', 'aria-labelledby': 'sa-prizes-h' },
      h('div', { class: 'sa-section-head' }, h('h2', { class: 'sa-h2', id: 'sa-prizes-h' }, icon('trophy'), h('span', { text: 'Your spotlight prizes' }))),
      h('ul', { class: 'sa-prizes' }, ...weeks.map(prizeCard))) : null;
    const burns = (me?.burns || []);
    const burnBox = burns.length ? h('section', { class: 'sa-section', 'aria-labelledby': 'sa-burns-h' },
      h('div', { class: 'sa-section-head' }, h('h2', { class: 'sa-h2', id: 'sa-burns-h' }, icon('flame'), h('span', { text: 'Your burn unlocks' })),
        h('p', { class: 'sa-muted', text: 'Burned from your own wallet app: gone for good, not an investment.' })),
      h('ul', { class: 'sa-burn-rows' }, ...burns.map((b) => burnRow(b, me)))) : null;

    const prices = h('section', { class: 'sa-card sa-prices-card' }, h('h2', { class: 'sa-h3', text: 'Your prices' }),
      h('dl', { class: 'sa-prices' }, ...Object.keys(PRICES).map((k) => [h('dt', { text: PRICE_NAMES[k] }), h('dd', null, icon('bolt'), h('span', { text: num(me?.prices?.[k] ?? PRICES[k]) }))]).flat()),
      info?.threeD && s.level === 3 ? h('p', { class: 'sa-muted sa-small', text: 'Soulmate: your first 3D model each month is free.' }) : null,
      Number(info?.burns?.model) > 0 ? h('p', { class: 'sa-muted sa-small', text: `Or burn ${num(info.burns.model)} $AGI for a 3D model, no credits (on its influencer's page).` }) : null);

    // what people come back for first: prizes to claim, their influencers, their credits; then the rest
    put(body,
      warn ? h('p', { class: 'sa-banner', text: warn }) : null,
      ctx.meError && !me ? h('p', { class: 'sa-banner', text: errorText(ctx.meError) }) : null,
      h('div', { class: 'sa-stat-cards' }, credits, slotCard, wallet),
      prizes,
      h('section', { class: 'sa-section sa-mine', 'aria-labelledby': 'sa-mine-h' }, h('div', { class: 'sa-section-head' }, h('h2', { class: 'sa-h2', id: 'sa-mine-h' }, icon('user'), h('span', { text: 'My influencers' }))), grid),
      burnBox,
      prices,
      me?.owner ? h('p', { class: 'sa-owner-link' }, linkBtn('Owner tools', ctx.href('/owner'), { kind: 'ghost', icon: 'shield', dataset: { saLink: '' } })) : null,
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
