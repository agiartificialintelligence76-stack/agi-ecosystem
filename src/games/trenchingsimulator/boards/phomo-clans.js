// Original practice clans: groups of existing NPCs, never real communities or inferred real wallet identities.
import { el, setText, keyed, flag, icon } from '../ui.js';
import { usd, signed, age } from '../format.js';
import { pic } from './common.js';
import { traderProfiles } from './phomo-data.js';
import './phomo-clans.css';

export const PHOMO_CLANS = Object.freeze([
  Object.freeze({ id: 'smart', name: 'Signal Society', mark: 'S', kind: 'smart',
    description: 'A practice clan for the market’s simulated smart wallets. Follow their positions and compare the results of their decisions during this run.' }),
  Object.freeze({ id: 'kol', name: 'Candle Collective', mark: 'C', kind: 'kol',
    description: 'The game’s fictional callers, gathered in one place. Watch their calls, follow their simulated trades, and keep your own notes.' }),
]);
const fin = (x) => typeof x === 'number' && Number.isFinite(x);
const knownSum = (values) => values.length && values.every(fin) ? values.reduce((sum, x) => sum + x, 0) : null;

// Complete aggregates only: an unknown member or position metric cannot silently become zero.
// Profiles are de-duplicated by NPC identity, and real-token holdings are deliberately excluded.
export function aggregateClan(market, profiles, clanId) {
  const clan = PHOMO_CLANS.find((x) => x.id === clanId);
  if (!clan) return null;
  const byKey = new Map((profiles || []).filter((p) => p?.simulated === true && p.kind === clan.kind && typeof p.key === 'string'
    && p.key.startsWith(`${clan.kind}:`)).map((p) => [p.key, p]));
  const members = [...byKey.values()];
  const coins = new Map();
  for (const member of members) {
    for (const h of member.holdings || []) {
      if (!Number.isInteger(h.coin) || !(h.tok > 0)) continue;
      const row = market?.row(h.coin);
      if (!row || row.live || market.isExt?.(h.coin)) continue;
      let found = coins.get(h.coin);
      if (!found) { found = { coin: h.coin, row, byMember: new Map() }; coins.set(h.coin, found); }
      const previous = found.byMember.get(member.key);
      // Defensive de-duplication: the profile model normally has one holding per token.
      if (!previous) found.byMember.set(member.key, h);
    }
  }
  const holdings = [...coins.values()].map((x) => ({ coin: x.coin, row: x.row, memberKeys: [...x.byMember.keys()],
    members: x.byMember.size, positionUsd: knownSum([...x.byMember.values()].map((h) => h.valueUsd)),
    pnlUsd: knownSum([...x.byMember.values()].map((h) => h.pnlUsd)) }));
  holdings.sort((a, b) => fin(a.positionUsd) && fin(b.positionUsd) ? b.positionUsd - a.positionUsd || a.coin - b.coin
    : Number(fin(b.positionUsd)) - Number(fin(a.positionUsd)) || a.coin - b.coin);
  const complete = members.map((p) => fin(p.pnlUsd) && fin(p.unrealizedUsd) ? p.pnlUsd + p.unrealizedUsd : null);
  const top = holdings.filter((h) => fin(h.pnlUsd)).sort((a, b) => b.pnlUsd - a.pnlUsd || a.coin - b.coin).slice(0, 3);
  return { ...clan, members, memberCount: members.length, trades: knownSum(members.map((p) => p.trades)),
    pnlUsd: knownSum(complete), knownPnlMembers: complete.filter(fin).length,
    positionUsd: holdings.length ? knownSum(holdings.map((h) => h.positionUsd)) : 0,
    holdings, top, simulated: true };
}

const button = (label, click, attrs = {}) => el('button', { type: 'button', class: 'phc-button', ...attrs, on: { click } }, label);
const tint = (node, value) => { flag(node, 'phc-up', fin(value) && value > 0); flag(node, 'phc-down', fin(value) && value < 0); };
const mark = (clan, small = false) => el('span', { class: `phc-mark ${small ? 'is-small' : ''}`, 'aria-hidden': 'true' }, clan.mark);
const empty = (words) => el('p', { class: 'phc-empty' }, words);

export function mountPhomoClans(host, ctx, { state, onTrader = () => {}, onCoin = () => {}, onClose = () => {} } = {}) {
  const market = ctx.market;
  const root = el('section', { class: 'phc-clans', 'aria-label': 'Simulated practice clans' }); host.append(root);
  let dead = false, last = -Infinity, current = null, tab = 'members', view = null;
  const groups = () => {
    const profiles = traderProfiles(market, { solUsd: ctx.solUsd || market.solUsd });
    return PHOMO_CLANS.map((clan) => aggregateClan(market, profiles, clan.id));
  };
  function directory() {
    current = null; view = null;
    const cards = el('div', { class: 'phc-directory-grid' });
    root.replaceChildren(el('header', { class: 'phc-directory-heading' }, button([icon('back'), 'Discover'], onClose), el('h1', {}, 'Clans')),
      el('p', { class: 'phc-caption' }, 'Practice clans of fictional traders. Their activity comes from this game; no real people or communities are represented.'), cards);
    for (const group of groups()) {
      const meta = el('p'), pnl = el('strong');
      const card = button([el('div', { class: `phc-banner phc-banner-${group.id}` }), mark(group),
        el('span', { class: 'phc-card-body' }, el('b', {}, group.name), el('small', {}, 'Simulated NPC clan'),
          el('span', { class: 'phc-description' }, group.description), meta, pnl)], () => detail(group.id), { class: 'phc-directory-card' });
      card._group = { id: group.id, meta, pnl }; cards.append(card);
    }
    view = { cards }; update(true);
  }
  function detail(clanId) {
    current = clanId; tab = 'members';
    const clan = PHOMO_CLANS.find((x) => x.id === clanId);
    const membership = el('span'), tradeCount = el('span'), shareStatus = el('p', { class: 'phc-status', role: 'status' });
    const hero = el('header', { class: 'phc-hero' }, el('div', { class: `phc-banner phc-banner-${clan.id}` }, button([icon('back'), 'Clans'], directory)),
      el('div', { class: 'phc-hero-body' }, mark(clan), el('div', {}, el('h1', {}, clan.name), el('p', { class: 'phc-caption' }, 'Simulated NPC clan')),
        button([icon('share'), 'Share'], async () => {
          const data = groups().find((x) => x.id === clanId);
          const summary = `${data.name} — Phomo simulated practice clan\n${data.memberCount} NPC members · ${data.trades ?? 'Unknown'} recorded trades\nCombined run P&L: ${signed(data.pnlUsd, 'usd')}\nPractice money only. ${location.origin}/games/trenchingsimulator`;
          try { await navigator.clipboard.writeText(summary); if (!dead) setText(shareStatus, 'Practice clan summary copied.'); }
          catch { if (!dead) setText(shareStatus, summary); }
        }, { class: 'phc-button phc-share' })),
      el('p', { class: 'phc-description' }, clan.description), el('div', { class: 'phc-meta' }, membership, tradeCount), shareStatus);
    const profit = el('strong'), exposure = el('span'), coverage = el('small');
    const performance = el('section', { class: 'phc-summary-card' }, el('h2', {}, 'Combined P&L'), profit, coverage,
      el('div', { class: 'phc-summary-bottom' }, el('span', {}, 'Open positions'), exposure));
    const topTokens = el('div', { class: 'phc-top-tokens' });
    const body = el('tbody'), holdingsEmpty = empty('No retained simulated holdings in this clan yet.');
    const table = el('table', { class: 'phc-table' }, el('thead', {}, el('tr', {}, ['Token', 'Members', 'Combined position', 'Combined P&L'].map((s) => el('th', { scope: 'col' }, s)))), body);
    const holdingCard = el('section', { class: 'phc-holding-card' }, el('h2', {}, 'Holdings'),
      el('p', { class: 'phc-caption' }, 'Current simulated positions. Unknown costs remain unavailable.'), el('div', { class: 'phc-table-scroll' }, table), holdingsEmpty);
    const feed = el('div', { class: 'phc-member-content' });
    const followAll = button('Follow all', () => {
      const group = groups().find((x) => x.id === current);
      for (const p of group.members) if (!state.isFollowing(p.key)) state.toggleFollow(p.key);
      update(true);
    });
    const tabs = ['members', 'feed', 'thesis'].map((kind) => button(kind[0].toUpperCase() + kind.slice(1), () => {
      tab = kind; update(true);
    }, { class: 'phc-tab', data: { tab: kind }, 'aria-pressed': String(kind === tab) }));
    const noteInput = el('textarea', { class: 'phc-note-input', rows: 3, maxLength: 500, placeholder: 'Write a private clan thesis…', 'aria-label': 'Clan thesis' });
    const noteStatus = el('p', { class: 'phc-status', role: 'status' });
    const parentKey = `clan:${clanId}:${String(market.seed).slice(0, 80)}`;
    const composer = el('form', { class: 'phc-composer', hidden: true, on: { submit(e) {
      e.preventDefault(); const result = state.addNote({ text: noteInput.value, parentKey });
      if (result.ok) { noteInput.value = ''; setText(noteStatus, 'Saved on this device.'); update(true); }
      else setText(noteStatus, 'Write a thesis first.');
    } } }, noteInput, el('div', {}, el('small', {}, 'Your private practice notebook'), el('button', { type: 'submit', class: 'phc-button' }, 'Post thesis')), noteStatus);
    const right = el('aside', { class: 'phc-members-card' }, el('div', { class: 'phc-tabs', role: 'group', 'aria-label': 'Clan activity' }, tabs),
      el('div', { class: 'phc-member-heading' }, el('span', {}, 'Simulated members'), followAll), composer, feed);
    root.replaceChildren(hero, el('div', { class: 'phc-columns' }, el('div', { class: 'phc-main' },
      el('div', { class: 'phc-performance' }, performance, el('section', { class: 'phc-top-card' }, el('h2', {}, 'Top token performance'), topTokens)), holdingCard), right));
    view = { membership, tradeCount, profit, exposure, coverage, topTokens, body, table, holdingsEmpty, feed, followAll, tabs, composer, parentKey };
    update(true);
  }
  function update(force = false) {
    if (dead || force !== true && Date.now() - last < 1000) return;
    last = Date.now();
    const all = groups();
    if (!current) {
      for (const card of view.cards.children) {
        const data = all.find((x) => x.id === card._group.id);
        setText(card._group.meta, `${data.memberCount} simulated members · ${data.trades ?? '—'} recorded trades`);
        setText(card._group.pnl, `${signed(data.pnlUsd, 'usd')} combined run P&L`); tint(card._group.pnl, data.pnlUsd);
      }
      return;
    }
    const group = all.find((x) => x.id === current);
    const keys = new Set(group.members.map((p) => p.key));
    setText(view.membership, `${group.memberCount} members · all simulated`); setText(view.tradeCount, `${group.trades ?? '—'} recorded trades`);
    setText(view.profit, signed(group.pnlUsd, 'usd')); tint(view.profit, group.pnlUsd);
    setText(view.exposure, usd(group.positionUsd));
    setText(view.coverage, group.knownPnlMembers === group.memberCount ? 'Closed and open positions · this run' : `P&L available for ${group.knownPnlMembers} of ${group.memberCount} NPCs. A complete total is unavailable.`);
    view.topTokens.replaceChildren(...(group.top.length ? group.top.map((h) => {
      const pnl = el('strong', {}, signed(h.pnlUsd, 'usd')); tint(pnl, h.pnlUsd);
      return button([pic(h.row, '', 'phc'), el('span', {}, h.row.ticker), pnl], () => onCoin(h.coin), { class: 'phc-top-token' });
    }) : [empty('No known token P&L yet.')]));
    view.table.hidden = !group.holdings.length; view.holdingsEmpty.hidden = !!group.holdings.length;
    keyed(view.body, group.holdings, (h) => h.coin, (h) => {
      const cells = [el('td'), el('td'), el('td')];
      const tr = el('tr', {}, el('td', {}, button([pic(h.row, '', 'phc'), h.row.ticker], () => onCoin(h.coin), { class: 'phc-token-link' })), cells);
      tr._cells = cells; return tr;
    }, (tr, h) => { setText(tr._cells[0], h.members); setText(tr._cells[1], usd(h.positionUsd)); setText(tr._cells[2], signed(h.pnlUsd, 'usd')); tint(tr._cells[2], h.pnlUsd); });
    for (const b of view.tabs) b.setAttribute('aria-pressed', String(b.dataset.tab === tab));
    const followed = group.members.filter((p) => state.isFollowing(p.key)).length;
    setText(view.followAll, followed === group.memberCount ? 'Following all' : `Follow all (${group.memberCount - followed})`);
    view.followAll.disabled = followed === group.memberCount; view.composer.hidden = tab !== 'thesis';
    if (view.feed.dataset.tab !== tab) { view.feed.dataset.tab = tab; view.feed.replaceChildren(); }
    if (tab === 'members') {
      keyed(view.feed, group.members, (p) => p.key, (p) => {
        const pnl = el('span');
        const follow = button('', () => { state.toggleFollow(p.key); update(true); });
        const node = el('article', { class: 'phc-member' }, button([el('span', { class: 'phc-avatar' }, p.name[0]), el('span', {}, p.name,
          el('small', {}, 'Simulated trader'))], () => onTrader(p.key), { class: 'phc-person' }), pnl,
        follow);
        node._parts = { pnl, follow }; return node;
      }, (node, p) => {
        const value = fin(p.pnlUsd) && fin(p.unrealizedUsd) ? p.pnlUsd + p.unrealizedUsd : null;
        setText(node._parts.pnl, signed(value, 'usd')); tint(node._parts.pnl, value);
        setText(node._parts.follow, state.isFollowing(p.key) ? 'Following' : 'Follow');
      });
    } else if (tab === 'feed') {
      const events = state.feed({ limit: 100, types: ['trade'] }).filter((e) => e.simulated && keys.has(e.traderKey));
      view.feed.replaceChildren(...(events.length ? events.map((e) => el('article', { class: 'phc-event' },
        button(e.name, () => onTrader(e.traderKey), { class: 'phc-person' }), el('time', {}, `${age(Math.max(0, market.t - e.t))} ago`),
        el('p', {}, e.side === 'buy' ? 'Bought ' : 'Sold ', usd(e.amountUsd), ' of ', button(`$${e.ticker}`, () => onCoin(e.coin), { class: 'phc-token-link' })),
        el('small', {}, 'Recorded simulation trade'))) : [empty('No recent recorded trades from this clan.')]));
    } else {
      const notes = state.notes({ parentKey: view.parentKey });
      view.feed.replaceChildren(...(notes.length ? notes.map((n) => el('article', { class: 'phc-event' }, el('strong', {}, 'You · local thesis'),
        el('p', {}, n.text), button('Delete', () => { state.removeNote(n.id); update(true); }))) : [empty('Keep your research here. Theses are local notes, not posts by clan members.')]));
    }
  }
  directory();
  return { update, destroy() { dead = true; root.remove(); } };
}
