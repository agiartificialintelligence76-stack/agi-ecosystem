// AGI Studio: My studio (the connected wallet: its credits, its influencers and how many it may have, its burn unlocks
// waiting for their burn, its weekly prizes to claim, its holder perks and its prices; round 4: its clank.trade username,
// shown on its public influencers as "by @name"; round 4, phase 2: Help & support with its tickets' news, a ban said in
// words, and the team's tools; round 4, phase 3: its three kinds of credits, and "Gifts and invites": src/studio/views/gifts.js).
import { h, icon, btn, linkBtn, pic, put, add, busy, say, nextId } from '../ui.js';
import { infPic, creditsText, PRICES, BANNER, clankProfileUrl } from '../rules.js';
import {
  LEVEL_NAMES, shortAddress, num, perksText, statusChip, studioText, errorText, BURN_WHATS, myWeekText, prizeText, weekText, clankErrorText,
  BANNED_TEXT,
} from '../app-words.js';
import { unlockSlot, boostInf } from './shared.js';
import { giftsCard } from './gifts.js';

const PRICE_NAMES = {
  influencer: 'A new influencer (4 looks and its full body)', looks: '4 new looks', photo: 'A photo', banner: `An X banner (${BANNER.W} × ${BANNER.H})`,
  trend: 'A trend video', video: 'A 5-second video', model: 'A 3D model',
};
const TX = (tx) => `https://robinhoodchain.blockscout.com/tx/${tx}`;

// (round 4, phase 3) what its credits are made of: this month's free ones (spent first, they end with the month), bonus ones
// (from invites, or the team: spent next, they never run out, can't be given) and bought ones (and gifts got: the ones it may give)
function creditLines(c, info) {
  if (!c) return [];
  const lines = [];
  if (c.free > 0) lines.push(`${creditsText(c.free)} of them are this month's free ones (used first; they end with the month).`);
  if (c.bonus > 0) lines.push(`${creditsText(c.bonus)} are bonus credits, from invites or the team (used next; they don't run out, and can't be given).`);
  if (info?.gifts && c.paid > 0 && (c.free > 0 || c.bonus > 0)) lines.push(`${creditsText(c.paid)} you bought or got as gifts: those you can give.`);
  return lines.map((text) => h('p', { class: 'sa-muted sa-small', text }));
}

export function render(ctx, route, root) {
  document.title = 'My studio · AGI Studio';
  const body = h('div', { class: 'sa-me' });
  // (round 4) its clank.trade name: a card of its own, drawn only when the name changes (so what's typed stays put while the
  // rest of the page is drawn again), and the owner's link after it
  const clankBox = h('section', { class: 'sa-card sa-clank-card', id: 'clank', 'aria-labelledby': 'sa-clank-h', hidden: true });
  // (round 4, phase 2) help and support (its tickets: open ones, and the team's answers not read yet), and for the team its
  // tools: Mod tools (a mod's, support's and the owner's), Owner tools (the owner's)
  const helpBox = h('section', { class: 'sa-card sa-help-card', 'aria-labelledby': 'sa-help-h' });
  // (round 4, phase 3) gifts and invites: a card of its own (its gifts are read when it's first shown; what's typed stays put)
  const gifts = giftsCard(ctx);
  const ownerLink = h('p', { class: 'sa-owner-link', hidden: true },
    linkBtn('Owner tools', ctx.href('/owner'), { kind: 'ghost', icon: 'shield', dataset: { saLink: '', owner: '' } }),
    linkBtn('Mod tools', ctx.href('/mod'), { kind: 'ghost', icon: 'inbox', dataset: { saLink: '', mod: '' } }));
  add(root, h('header', { class: 'sa-page-head' },
    h('p', { class: 'sa-eyebrow', text: 'Your wallet, your influencers' }),
    h('h1', { class: 'sa-display sa-page-title', tabindex: '-1', text: 'My studio' })), body, gifts.node, clankBox, helpBox, ownerLink);
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

  // ---------- (round 4) its clank.trade username ----------
  let clankSig = null, typed = '', jumped = false;
  function drawClank() {
    const me = ctx.me;
    clankBox.hidden = !ctx.session || !me;
    if (clankBox.hidden) { clankSig = null; return; }
    const sig = JSON.stringify([ctx.session.wallet, me.clank?.name ?? null]);
    if (sig === clankSig) return;
    clankSig = sig;
    // a link to it (an influencer's page: "Show your clank.trade name here") lands on it once
    if (location.hash === '#clank' && !jumped) {
      jumped = true;
      requestAnimationFrame(() => { clankBox.scrollIntoView({ block: 'start' }); clankBox.querySelector('input')?.focus({ preventScroll: true }); });
    }
    const title = h('h2', { class: 'sa-h3 sa-clank-title', id: 'sa-clank-h' }, icon('at'), h('span', { text: 'Your clank.trade name' }));
    const note = h('p', { class: 'sa-note', role: 'status', hidden: true });
    if (me.clank?.name) {
      const off = btn('Remove it', { kind: 'quiet', size: 'sm', icon: 'close' });
      off.addEventListener('click', () => busy(off, 'Removing…', async () => {
        const r = await ctx.act('inf-name-clear');
        if (r.ok && r.data?.ok) { ctx.toast('Your clank.trade name is off your influencers', 'good'); ctx.refreshMe(); return; }
        say(note, errorText(r.data?.error));
      }));
      put(clankBox, title,
        h('p', null, h('span', { text: 'Shown as ' }), h('a', { class: 'sa-maker-name', href: clankProfileUrl(me.clank.name), target: '_blank', rel: 'noopener noreferrer', text: `@${me.clank.name}\u00a0↗` }),
          h('span', { text: ' on your public influencers, and next to them in Explore.' })),
        h('p', { class: 'sa-muted sa-small', text: 'We read your clank.trade profile again now and then: if it moves to another wallet, the name comes off.' }),
        h('div', { class: 'sa-row' }, off), note);
      return;
    }
    const fieldId = nextId('clank');
    const input = h('input', { class: 'sa-input', id: fieldId, type: 'text', maxlength: 120, autocomplete: 'off', spellcheck: 'false', autocapitalize: 'none',
      placeholder: '@yourname, or your profile\'s link', value: typed });
    const err = h('p', { class: 'sa-err', role: 'alert', hidden: true });
    input.addEventListener('input', () => { typed = input.value; say(err, ''); });
    const go = btn('Show it', { kind: 'primary', icon: 'check' });
    const send = () => {
      const v = input.value.trim();
      if (!v) { say(err, clankErrorText('bad')); input.focus(); return; }
      busy(go, 'Checking clank.trade…', async () => {
        const r = await ctx.act('inf-name-set', { name: v });
        if (r.ok && r.data?.ok) { typed = ''; ctx.toast(`Shown as @${r.data.clank?.name} 💜`, 'good'); ctx.refreshMe(); return; }
        say(err, clankErrorText(r.data?.error));
        input.focus();
      });
    };
    go.addEventListener('click', send);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } });
    put(clankBox, title,
      h('p', { class: 'sa-muted', text: 'Show your clank.trade username on your public influencers ("by @name", a link to your clank.trade profile).' }),
      h('div', { class: 'sa-field' }, h('label', { class: 'sa-label', for: fieldId, text: 'Your clank.trade username' }), h('div', { class: 'sa-clank-row' }, input, go), err),
      h('p', { class: 'sa-fine', text: `We read that profile on clank.trade and show the name only if its wallet is the one you connected here (${shortAddress(ctx.session.wallet)}). Nothing is asked of your wallet.` }));
  }

  // ---------- (round 4, phase 2) help and support ----------
  function drawHelp() {
    const sup = ctx.me?.support;
    const line = !ctx.session ? 'Questions about AGI Studio? Ask the helper, or open a ticket: a person on the team answers.'
      : sup?.unread ? `The team answered you: ${sup.unread === 1 ? '1 new answer' : `${num(sup.unread)} new answers`} to read.`
        : sup?.open ? `${sup.open === 1 ? '1 ticket' : `${num(sup.open)} tickets`} open: the team answers you there.`
          : 'Quick answers from the helper, or a ticket a person answers.';
    put(helpBox,
      h('h2', { class: 'sa-h3 sa-help-title', id: 'sa-help-h' }, icon('help'), h('span', { text: 'Help & support' }),
        sup?.unread ? h('span', { class: 'sa-tag sa-tag-new', text: 'New answer' }) : null),
      h('p', { class: 'sa-muted sa-small', text: line }),
      h('div', { class: 'sa-row' }, linkBtn(sup?.unread ? 'Read it' : 'Get help', ctx.href('/help'), { kind: sup?.unread ? 'primary' : 'ghost', size: 'sm', icon: 'help', dataset: { saLink: '' } })));
    const team = ctx.me?.team?.role;
    ownerLink.hidden = !ctx.me?.owner && !team;
    ownerLink.querySelector('[data-owner]').hidden = !ctx.me?.owner;
    ownerLink.querySelector('[data-mod]').hidden = !team;
  }

  const draw = () => {
    drawClank();
    drawHelp();
    gifts.draw();
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
      ...creditLines(me?.credits, info),
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
        i.portrait && !me?.banned ? pic(infPic(i.id, i.portrait.job, i.portrait.n, true), { cls: 'sa-person-pic', alt: '' }) : h('span', { class: 'sa-person-pic is-missing' }, icon('user')),
        i.status !== 'ready' ? h('span', { class: `sa-tag sa-state is-${i.status}`, text: statusChip(i.status) })
          : i.boosted ? h('span', { class: 'sa-tag sa-tag-boost' }, icon('rocket'), h('span', { text: 'Boosted' })) : null,
        h('span', { class: 'sa-person-cap' },
          h('span', { class: 'sa-person-name' }, h('span', { text: i.name }), i.private ? icon('shield') : null),
          h('span', { class: 'sa-person-note', text: me?.banned ? 'Hidden while banned' : i.private ? 'Private' : i.status !== 'ready' ? (i.status === 'failed' ? 'Its credits came back' : 'Not in Explore yet') : i.public ? 'In Explore' : 'Only by its link' }))))));

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
      // (round 4, phase 2) a wallet a moderator banned: why it can't make anything, and where to ask
      me?.banned ? h('div', { class: 'sa-banner sa-banner-warn', role: 'status' }, h('p', { text: BANNED_TEXT }),
        linkBtn('Open a support ticket', ctx.href('/help?new=account'), { kind: 'ghost', size: 'sm', icon: 'inbox', dataset: { saLink: '' } })) : null,
      warn ? h('p', { class: 'sa-banner', text: warn }) : null,
      ctx.meError && !me ? h('p', { class: 'sa-banner', text: errorText(ctx.meError) }) : null,
      h('div', { class: 'sa-stat-cards' }, credits, slotCard, wallet),
      prizes,
      h('section', { class: 'sa-section sa-mine', 'aria-labelledby': 'sa-mine-h' }, h('div', { class: 'sa-section-head' }, h('h2', { class: 'sa-h2', id: 'sa-mine-h' }, icon('user'), h('span', { text: 'My influencers' }))), grid),
      burnBox,
      prices,
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
