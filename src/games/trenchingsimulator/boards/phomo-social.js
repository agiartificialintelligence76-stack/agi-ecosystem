// Local Phomo social views. All identities are the player or identified simulation characters.
// Buttons opening a trade form never submit an order; only an explicitly labelled Copy order does.
import { el, setText, keyed as reconcile, flag, icon } from '../ui.js';
import { usd, usdFull, signed, pct, age, tokens, compact } from '../format.js';
import { pic } from './common.js';
import { positionDetail, profileEquity, tokenMetrics } from './phomo-data.js';
import { chartCredit } from './gchart.js';
import { createPhomoChart } from './phomo-chart.js';
import './phomo-social.css';

const fin = (x) => typeof x === 'number' && Number.isFinite(x);
const button = (s, click, cls = '', label = null) => el('button', { type: 'button', class: `phs-button ${cls}`, 'aria-label': label, on: { click } }, s);
const input = (label, value = '', type = 'text') => el('input', { class: 'phs-input', type, value, 'aria-label': label });
const empty = (title, detail = '') => el('div', { class: 'phs-empty' }, el('strong', {}, title), el('p', {}, detail));
const select = (label, choices, value, change = () => {}) => {
  const n = el('select', { class: 'phs-input', 'aria-label': label, on: { change: () => change(n.value) } },
    choices.map(([v, s]) => el('option', { value: v }, s)));
  n.value = value; return n;
};
const tint = (n, v) => { flag(n, 'phs-up', fin(v) && v > 0); flag(n, 'phs-down', fin(v) && v < 0); };
const field = (label) => { const dd = el('dd'); return { el: el('div', {}, el('dt', {}, label), dd), dd }; };
const avatar = (p) => el('span', { class: 'phs-avatar', 'aria-hidden': 'true' }, p?.avatar || p?.name?.[0] || '?');
const relation = (state, key) => state.isFollowing(key) ? 'Following' : 'Follow';
const keyed = (host, ...args) => { for (const child of [...host.children]) if (!child.dataset.key) child.remove(); reconcile(host, ...args); };

function modal(host, title, content) {
  const previous = document.activeElement;
  const heading = el('h2', {}, title);
  const wrap = el('div', { class: 'phs-overlay' });
  const close = () => { wrap.remove(); if (previous?.isConnected) previous.focus(); };
  const box = el('section', { class: 'phs-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title, tabIndex: -1,
    on: { keydown: (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
      if (e.key !== 'Tab') return;
      const focusable = [...box.querySelectorAll('button,input,textarea,select,a')].filter((n) => !n.disabled && !n.hidden);
      const first = focusable[0], last = focusable.at(-1);
      if (e.shiftKey && (document.activeElement === first || document.activeElement === box)) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    } } },
  el('header', {}, heading, button(icon('close'), close, '', `Close ${title}`)), content);
  wrap.append(box); host.append(wrap); box.focus(); return close;
}

function noteEditor(host, state, { note = null, parent = null, coin = null, done = () => {} } = {}) {
  const body = el('textarea', { class: 'phs-input', 'aria-label': note ? 'Edit thesis text' : 'Reply text', maxLength: 500, rows: 5 });
  body.value = note?.text || '';
  const status = el('p', { role: 'status' });
  let close;
  const form = el('form', { class: 'phs-form', on: { submit(e) {
    e.preventDefault();
    const result = note ? state.editNote(note.id, body.value) : state.addNote({ text: body.value, parentKey: parent, coin });
    if (!result.ok) return setText(status, 'Write some text before saving.');
    close(); done();
  } } }, body, el('small', {}, 'Private to this device. You are the author.'), status,
  el('button', { type: 'submit', class: 'phs-button phs-primary' }, 'Save'));
  close = modal(host, note ? 'Edit thesis' : 'Reply', form); body.focus();
}

function eventCard(e, state, market, hooks, host, refresh) {
  const name = button(e.name || 'You', () => e.traderKey && hooks.onTrader?.(e.traderKey), 'phs-person');
  const kind = el('small', { class: 'phs-pill' });
  const when = el('time');
  const words = el('p', { class: 'phs-event-text' });
  const coin = button('', () => { if (Number.isInteger(row._event.coin)) hooks.onCoin?.(row._event.coin); }, 'phs-coin-link');
  const like = button('', () => { state.toggleLike(row._event.key); refresh(); }, '', 'Like this local activity');
  const replies = button('', () => thread(row._event), '', 'Open conversation');
  const detail = button('Position', () => hooks.onPosition?.({ coin: row._event.coin, traderKey: row._event.traderKey || 'you' }));
  const copy = button('Copy order', () => {
    const result = state.copyTrade(row._event, Number(hooks.quickAmount?.() || 10));
    setText(status, result?.ok ? 'Practice order submitted.' : 'This practice order could not be placed. Open the token to review your balance and position.');
  });
  const edit = button('Edit', () => {
    const n = state.notes().find((x) => x.id === row._event.key);
    if (n) noteEditor(host, state, { note: n, done: refresh });
  });
  const remove = button('Delete', () => { state.removeNote(row._event.key); refresh(); });
  const status = el('p', { class: 'phs-status', role: 'status' });
  const row = el('article', { class: 'phs-event' }, el('header', {}, avatar({ name: e.name }), name, kind, when), words,
    el('footer', {}, coin, like, replies, detail, copy, edit, remove), status);
  row._event = e;
  row._refresh = (v) => {
    row._event = v;
    setText(name, v.name || 'You');
    setText(kind, v.kind === 'note' ? 'Thesis · local' : v.kind === 'closed' ? 'Closed position · practice' : v.source === 'you' ? 'Practice trade' : 'Simulated trade');
    setText(when, `${age(Math.max(0, market.t - v.t))} ago`);
    setText(words, v.kind === 'note' ? v.text : v.kind === 'closed' ? `Closed $${v.ticker} · ${signed(v.pnlUsd, 'usd')} P&L`
      : `${v.side === 'sell' ? 'Sold' : 'Bought'} ${usd(v.amountUsd)} of $${v.ticker}`);
    setText(coin, v.ticker ? `$${v.ticker}` : ''); coin.hidden = !Number.isInteger(v.coin);
    setText(like, `${v.liked ? '♥' : '♡'} ${v.likes || 0}`); like.setAttribute('aria-pressed', String(!!v.liked));
    setText(replies, `Replies ${v.notes || 0}`);
    detail.hidden = !Number.isInteger(v.coin) || !v.traderKey || v.kind === 'note';
    copy.hidden = v.kind !== 'trade'; edit.hidden = remove.hidden = v.kind !== 'note' || v.traderKey !== 'you';
  };
  function thread(parent) {
    const list = el('div', { class: 'phs-thread' });
    const content = el('div', {}, el('p', { class: 'phs-thread-parent' }, parent.text || `${parent.name} ${parent.side === 'sell' ? 'sold' : 'bought'} $${parent.ticker}`), list,
      button('Write reply', () => noteEditor(host, state, { parent: parent.key, coin: parent.coin ?? null, done: () => { draw(); refresh(); } }), 'phs-primary'));
    function draw() {
      const notes = state.notes({ parentKey: parent.key });
      list.replaceChildren(...notes.map((n) => el('article', { class: 'phs-reply' }, el('strong', {}, 'You'), el('p', {}, n.text),
        button('Edit', () => noteEditor(host, state, { note: n, done: () => { draw(); refresh(); } })),
        button('Delete', () => { state.removeNote(n.id); draw(); refresh(); }))));
      if (!notes.length) list.append(empty('No replies yet', 'Add your own private research notes here.'));
    }
    draw(); modal(host, 'Conversation', content);
  }
  row._refresh(e); return row;
}

export function mountPhomoSocial(host, ctx, { state, kind = 'feed', onTrader, onCoin, onPosition, quickAmount } = {}) {
  const root = el('section', { class: `phs-social phs-${kind}` }); host.append(root);
  const hooks = { onTrader, onCoin, onPosition, quickAmount }, market = ctx.market;
  let dead = false, last = -Infinity, draw = () => {};
  function update(force = false) { if (dead || (force !== true && Date.now() - last < 500)) return; last = Date.now(); draw(); }
  if (kind === 'alerts') alerts(); else if (kind === 'leaderboard') leaderboard(); else feed();
  function feed() {
    let following = false;
    const types = new Set(['trade', 'closed', 'note']);
    const all = button('All activity', () => { following = false; update(true); });
    const followingButton = button('Following', () => { following = true; update(true); });
    const filter = el('details', { class: 'phs-filter' }, el('summary', {}, 'Feed settings'));
    const boxes = [];
    for (const [key, label] of [['trade', 'Trades'], ['closed', 'Closed positions'], ['note', 'Theses']]) {
      const check = el('input', { type: 'checkbox', checked: true, on: { change() { if (check.checked) types.add(key); else types.delete(key); update(true); } } });
      boxes.push([key, check]); filter.append(el('label', {}, check, label));
    }
    filter.append(button('Select all', () => { for (const [key, n] of boxes) { n.checked = true; types.add(key); } update(true); }),
      button('Deselect all', () => { for (const [, n] of boxes) n.checked = false; types.clear(); update(true); }));
    const note = el('textarea', { class: 'phs-input', placeholder: 'What is your thesis?', 'aria-label': 'Your local thesis', maxLength: 500, rows: 2 });
    const status = el('small', { role: 'status' });
    const composer = el('form', { class: 'phs-composer', on: { submit(e) {
      e.preventDefault(); const result = state.addNote({ text: note.value });
      if (result.ok) { note.value = ''; setText(status, 'Saved on this device.'); update(true); } else setText(status, 'Write a thesis first.');
    } } }, note, status, el('button', { type: 'submit', class: 'phs-button phs-primary' }, 'Post thesis'));
    const recap = el('details', { class: 'phs-recap' }, el('summary', {}, 'Your run recap'));
    const recapText = el('p'); recap.append(recapText);
    const list = el('div', { class: 'phs-feed-list' });
    const blank = empty('Your feed is quiet', 'Follow a simulated trader, place a practice trade, or write a thesis.');
    root.append(el('div', { class: 'phs-toolbar' }, all, followingButton, filter),
      el('p', { class: 'phs-caption' }, 'Your practice activity and simulated traders. Notes and likes stay on this device.'), recap, composer, list, blank);
    draw = () => {
      flag(all, 'is-active', !following); flag(followingButton, 'is-active', following);
      const p = state.profile('you'); setText(recapText, `${p.trades} recorded fills · ${signed(p.pnlUsd, 'usd')} run P&L · ${p.closed?.count || 0} closed token positions`);
      const rows = state.feed({ following, types: [...types], replies: false, limit: 100 }); blank.hidden = !!rows.length;
      keyed(list, rows, (e) => e.key, (e) => eventCard(e, state, market, hooks, root, () => update(true)), (n, e) => n._refresh(e));
    };
  }
  function leaderboard() {
    let only = false;
    const period = select('Trader ranking period', [['run', 'This run'], ['week', '7D · character history'], ['month', '30D · unavailable']], 'run', () => update(true));
    const metric = select('Rank traders by', [['pnl', 'Profit'], ['winRate', 'Win rate'], ['volume', 'Volume'], ['followers', 'Followers (current)']], 'pnl', () => update(true));
    const query = input('Search traders'); query.addEventListener('input', () => update(true));
    const following = button('Following only', () => { only = !only; update(true); });
    const body = el('tbody'), heads = ['Rank', 'Trader', 'P&L', 'Win rate', 'Volume', ''].map((s) => el('th', {}, s));
    const table = el('table', { class: 'phs-table' }, el('thead', {}, el('tr', {}, heads)), body);
    const blank = empty('No matching traders');
    const own = el('p', { class: 'phs-recap' });
    root.append(el('h2', {}, 'Leaderboard'), el('p', { class: 'phs-caption' }, 'Simulated trader rankings. Seven-day statistics are fictional character history; this run uses recorded game activity.'),
      el('div', { class: 'phs-toolbar' }, period, metric, following, query), own, table, blank);
    draw = () => {
      const mine = state.profile('you'); setText(own, `You · ${signed(mine.pnlUsd, 'usd')} this run · Practice account`);
      period.disabled = metric.value === 'followers';
      const unavailable = !period.disabled && period.value === 'month', week = !period.disabled && period.value === 'week';
      const sort = week ? ({ pnl: 'week', winRate: 'weekWinRate', volume: 'weekVolume' })[metric.value] : metric.value;
      const rows = unavailable ? [] : state.traders({ sort, following: only, query: query.value });
      blank.hidden = !!rows.length; table.hidden = !rows.length;
      setText(blank.firstChild, unavailable ? '30-day history is unavailable' : 'No matching traders'); flag(following, 'is-active', only);
      setText(heads[2], `P&L · ${week ? '7D' : 'run'}`); setText(heads[3], `Win rate · ${week ? '7D' : 'run'}`); setText(heads[4], `Volume · ${week ? '7D' : 'run'}`);
      keyed(body, rows, (p) => p.key, (p) => {
        const cells = [el('td'), el('td'), el('td')], rank = el('td');
        const follow = button('', () => { state.toggleFollow(p.key); update(true); });
        const row = el('tr', {}, rank, el('td', {}, button([avatar(p), el('span', {}, p.name, el('small', {}, `@${p.handle}`))], () => onTrader?.(p.key), 'phs-person')), cells, el('td', {}, follow));
        row._parts = { cells, rank, follow }; return row;
      }, (n, p) => {
        const { cells, rank, follow } = n._parts; setText(rank, p.rank); const pnl = week ? p.weekPnlUsd : p.pnlUsd;
        setText(cells[0], signed(pnl, 'usd')); tint(cells[0], pnl); setText(cells[1], pct(week ? p.weekWinRate : p.winRate));
        setText(cells[2], usd(week ? p.weekVolumeUsd : p.volumeUsd)); setText(follow, relation(state, p.key));
      });
    };
  }
  function alerts() {
    let editing = null, choices = '';
    const coin = select('Alert token', [['', 'Choose a token']], ''), metric = select('Alert metric', [['marketCap', 'Market cap'], ['price', 'Price per practice unit']], 'marketCap');
    const direction = select('Alert direction', [['above', 'Above'], ['below', 'Below']], 'above');
    const value = input('Alert threshold in dollars', '', 'number'); value.min = '0'; value.step = 'any';
    const status = el('p', { role: 'status' }), submit = el('button', { type: 'submit', class: 'phs-button phs-primary' }, 'Create alert');
    const cancel = button('Cancel edit', () => { editing = null; value.value = ''; update(true); }); cancel.hidden = true;
    const form = el('form', { class: 'phs-alert-form', on: { submit(e) {
      e.preventDefault();
      if (coin.value === '') return setText(status, 'Choose a token.');
      const data = { coin: Number(coin.value), metric: metric.value, direction: direction.value, valueUsd: Number(value.value) };
      const result = editing ? state.updateAlert(editing, data) : state.addAlert(data);
      if (!result.ok) return setText(status, result.error === 'full' ? 'Remove an alert before adding another.' : 'Enter a positive dollar threshold.');
      editing = null; value.value = ''; setText(status, 'Alert saved.'); update(true);
    } } }, coin, metric, direction, value, el('div', { class: 'phs-toolbar' }, [-.1, .1, .25].map((fraction) => button(`${fraction > 0 ? '+' : '−'}${Math.abs(fraction) * 100}%`, () => {
      const m = coin.value === '' ? null : tokenMetrics(market, Number(coin.value), { solUsd: ctx.solUsd });
      const v = metric.value === 'price' ? m?.priceUsd : m?.marketCapUsd;
      if (fin(v) && v > 0) { value.value = String(v * (1 + fraction)); direction.value = fraction > 0 ? 'above' : 'below'; }
      else setText(status, 'A current quote is required for this preset.');
    }))), submit, cancel, status);
    const rules = el('div'), notices = el('div');
    root.append(el('div', { class: 'phs-toolbar' }, el('h2', {}, 'Alerts'), button('Traders', traderSettings), button('Activity filters', activityFilters)), el('p', { class: 'phs-caption' }, 'Rules check while Phomo is open. They fire once until you rearm them. Followed simulated traders also appear in notifications.'), form,
      el('h3', {}, 'Price alerts'), rules, el('div', { class: 'phs-toolbar' }, el('h3', {}, 'Notifications'), button('Mark all read', () => { state.markRead(); update(true); })), notices);
    draw = () => {
      const rows = state.tokens({ category: 'trending', query: '', network: 'all', launchpad: 'all', limit: 100,
        filters: { minMarketCap: null, maxMarketCap: null, minLiquidity: null, minVolume: null, minHolders: null, maxAge: null, minChange: null, maxChange: null } }).rows;
      const selected = coin.value;
      if (selected !== '' && !rows.some((r) => r.id === Number(selected))) {
        const r = market.row(Number(selected)); if (r) rows.push(r);
      }
      const key = rows.map((r) => `${r.id}:${r.ticker}`).join('|');
      if (key !== choices) { choices = key; coin.replaceChildren(el('option', { value: '' }, 'Choose a token'), ...rows.map((r) => el('option', { value: r.id }, r.ticker))); coin.value = rows.some((r) => String(r.id) === selected) ? selected : ''; }
      cancel.hidden = !editing; setText(submit, editing ? 'Save alert' : 'Create alert');
      const alerts = state.alerts();
      keyed(rules, alerts, (a) => a.id, (a) => {
        const words = el('span'), pause = button('', () => { const current = state.alerts().find((x) => x.id === a.id); if (current) state.updateAlert(a.id, current.firedAt !== null ? { rearm: true } : { active: !current.active }); update(true); });
        const row = el('article', { class: 'phs-alert' }, words, button('Edit', () => {
          const current = state.alerts().find((x) => x.id === a.id); if (!current) return;
          editing = a.id; coin.value = current.coin === null ? '' : String(current.coin); metric.value = current.metric; direction.value = current.direction; value.value = String(current.valueUsd); update(true); value.focus();
        }), pause, button('Delete', () => { state.removeAlert(a.id); if (editing === a.id) editing = null; update(true); }));
        row._parts = { words, pause }; return row;
      }, (n, a) => { setText(n._parts.words, `${market.row(a.coin)?.ticker || 'Token unavailable'} · ${a.metric === 'price' ? 'Practice-unit price' : 'Market cap'} ${a.direction} ${usd(a.valueUsd)} · ${a.firedAt !== null ? 'Triggered' : a.active ? 'Active' : 'Paused'}`);
        setText(n._parts.pause, a.firedAt !== null ? 'Rearm' : a.active ? 'Pause' : 'Resume'); });
      if (!alerts.length) rules.replaceChildren(empty('No price alerts yet'));
      const items = state.notifications();
      keyed(notices, items, (n) => n.id, (n) => {
        const words = button(n.text, () => { state.markRead(n.id); if (Number.isInteger(n.coin)) onCoin?.(n.coin); update(true); });
        return el('article', { class: 'phs-notice' }, words);
      }, (row, n) => flag(row, 'is-unread', !n.read));
      if (!items.length) notices.replaceChildren(empty('No notifications yet'));
    };
    function traderSettings() {
      const query = input('Search followed traders'), list = el('div');
      const render = () => {
        const disabled = state.prefs.traderAlerts.disabled;
        const people = state.traders({ following: true, query: query.value });
        list.replaceChildren(...people.map((p) => {
          const check = el('input', { type: 'checkbox', checked: !disabled.includes(p.key), on: { change() {
            const next = state.prefs.traderAlerts.disabled.filter((k) => k !== p.key); if (!check.checked) next.push(p.key); state.setTraderAlerts({ disabled: next });
          } } }); return el('label', { class: 'phs-trader-check' }, check, avatar(p), p.name);
        }));
        if (!people.length) list.append(empty('No matching followed traders', 'Follow a simulated trader from their profile first.'));
      };
      query.addEventListener('input', render);
      const content = el('div', {}, query, el('div', { class: 'phs-toolbar' },
        button('Select all', () => { state.setTraderAlerts({ disabled: [] }); render(); }),
        button('Deselect all', () => { state.setTraderAlerts({ disabled: [...state.prefs.followed] }); render(); })), list);
      render(); modal(root, 'Trader activity alerts', content);
    }
    function activityFilters() {
      const prefs = state.prefs.traderAlerts, fields = {};
      const config = [['minTradeUsd', 'Minimum trade ($)', [0, 1000, 5000, 10000]], ['minPortfolioUsd', 'Minimum held value ($)', [0, 10000, 100000, 1000000]],
        ['minMarketCapUsd', 'Minimum token market cap ($)', []], ['maxMarketCapUsd', 'Maximum token market cap ($)', []]];
      const form = el('form', { class: 'phs-form' });
      for (const [k, label, presets] of config) {
        const n = input(label, prefs[k] ?? '', 'number'); n.min = '0'; n.step = 'any'; fields[k] = n;
        form.append(el('label', {}, label, n), presets.length ? el('div', { class: 'phs-toolbar' }, presets.map((v) => button(v ? `>${usd(v)}` : 'All', () => { n.value = String(v); }))) : null);
      }
      let close;
      const error = el('p', { role: 'status' });
      form.append(el('small', {}, 'Filters apply to future simulated-trader alerts. Held value excludes unknown cash. Unknown metrics cannot pass a minimum.'), error,
        el('button', { type: 'submit', class: 'phs-button phs-primary' }, 'Save activity filters'));
      form.addEventListener('submit', (e) => {
        e.preventDefault(); const values = Object.fromEntries(Object.entries(fields).map(([k, n]) => [k, n.value === '' && k === 'maxMarketCapUsd' ? null : Number(n.value)]));
        if (Object.values(values).some((v) => v !== null && (!fin(v) || v < 0 || v > 1e15)) || (values.maxMarketCapUsd !== null && values.maxMarketCapUsd < values.minMarketCapUsd)) return setText(error, 'Enter valid minimum and maximum values.');
        state.setTraderAlerts(values); close();
      }); close = modal(root, 'Trader activity filters', form);
    }
  }
  update(true);
  return { el: root, update, destroy() { dead = true; root.remove(); } };
}

function equitySVG(host, points) {
  host.replaceChildren();
  if (points.length < 2) { host.append(empty('Chart starts with your run', 'More recorded equity samples are needed.')); return; }
  const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 700 210'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Recorded practice portfolio value');
  const first = points[0], last = points.at(-1), lo = Math.min(...points.map((x) => x.v)), hi = Math.max(...points.map((x) => x.v));
  const path = document.createElementNS(ns, 'path');
  const sampled = points.filter((_, i) => i % Math.max(1, Math.ceil(points.length / 350)) === 0); if (sampled.at(-1) !== last) sampled.push(last);
  path.setAttribute('d', sampled.map((p, i) => `${i ? 'L' : 'M'}${10 + (p.t - first.t) / Math.max(1, last.t - first.t) * 680},${190 - (p.v - lo) / Math.max(1e-9, hi - lo) * 170}`).join(' '));
  path.setAttribute('fill', 'none'); path.setAttribute('stroke', 'currentColor'); path.setAttribute('stroke-width', '2'); svg.append(path); host.append(svg);
}

export function mountPhomoProfile(host, ctx, key = 'you', { state, onTrader, onCoin, onPosition, onClose = () => {}, onShare } = {}) {
  const market = ctx.market, px = ctx.solUsd > 0 ? ctx.solUsd : market.solUsd;
  let dead = false, last = -Infinity, period = Infinity, positionsTab = 'open', swapFilter = 'all', showDust = false, assetType = 'all', thesisIndex = 0;
  const own = key === 'you', profile = () => state.profile(key);
  const root = el('section', { class: 'phs-profile' }); host.append(root);
  const banner = el('div', { class: 'phs-profile-banner' }), av = el('span', { class: 'phs-profile-avatar' });
  const name = el('h1'), handle = el('span'), bio = el('p', { class: 'phs-bio' }), details = el('p', { class: 'phs-caption' });
  const follow = button('', () => { state.toggleFollow(key); update(true); }, 'phs-primary');
  const mute = button('', () => { state.toggleMute(key); update(true); });
  const following = button('', () => relations('followed')), followers = button('Followers —', () => relations('followers'));
  const actions = el('div', { class: 'phs-profile-actions' }, button('Share', shareProfile), own ? button('Edit profile', editProfile) : follow,
    own ? button('Muted traders', () => relations('muted')) : mute, own && ctx.openReplays ? button('Saved replays', () => ctx.openReplays()) : null);
  root.append(button([icon('back'), 'Back'], onClose, 'phs-back'), banner,
    el('header', { class: 'phs-profile-header' }, av, actions, name, handle, bio, el('div', { class: 'phs-toolbar' }, following, followers), details));
  const worth = el('strong', { class: 'phs-portfolio-value' }), pnl = el('span', { class: 'phs-portfolio-pnl' }), observed = el('small');
  const plot = el('div', { class: 'phs-equity' });
  const periods = [[86400, '24H'], [604800, '7D'], [2592000, '30D'], [Infinity, 'ALL']];
  const tabs = el('div', { class: 'phs-toolbar' }, periods.map(([seconds, label]) => button(label, () => { period = seconds; update(true); })));
  const statFields = Object.fromEntries(['Realized P&L', 'Unrealized P&L', 'Closed token win rate', 'Closed tokens', 'Volume', 'Average closed hold'].map((label) => [label, field(label)]));
  const cash = el('div', { class: 'phs-cash' }), posList = el('div', { class: 'phs-position-list' });
  const best = el('div', { class: 'phs-top-trades' }), thesis = el('div', { class: 'phs-profile-thesis' });
  const open = button('Open positions', () => { positionsTab = 'open'; update(true); }), closed = button('Closed positions', () => { positionsTab = 'closed'; update(true); });
  const positionSort = select('Sort profile positions', [['recent', 'Recent'], ['pnl', 'P&L'], ['value', 'Value']], 'recent', () => update(true));
  const dust = button('Show dust', () => { showDust = !showDust; update(true); });
  const assets = select('Profile position asset type', [['all', 'All assets'], ['tokens', 'Tokens'], ['perps', 'Perps']], 'all', (v) => { assetType = v; update(true); });
  const swaps = el('div', { class: 'phs-profile-swaps' });
  const swapTabs = el('div', { class: 'phs-toolbar' }, ['all', 'buy', 'sell'].map((v) => button(v === 'all' ? 'All swaps' : v === 'buy' ? 'Buys' : 'Sells', () => { swapFilter = v; update(true); })));
  root.append(el('div', { class: 'phs-profile-grid' }, el('div', { class: 'phs-profile-main' }, el('h2', {}, 'Portfolio'),
    el('div', { class: 'phs-portfolio-head' }, worth, pnl), tabs, observed, plot,
    el('dl', { class: 'phs-profile-stats' }, Object.values(statFields).map((f) => f.el)), cash,
    el('h3', {}, 'Top recorded positions'), best, thesis,
    el('div', { class: 'phs-toolbar' }, open, closed, positionSort, dust, assets), posList), el('aside', {}, swapTabs, swaps)));
  function shareProfile() {
    const p = profile(); if (!p) return;
    if (typeof ctx.saveCard === 'function') ctx.saveCard({ brand: 'social', kicker: 'PHOMO · PRACTICE PROFILE', title: p.name, big: signed(p.pnlUsd, 'usd'),
      small: 'Recorded run P&L', rows: [['Trades', String(p.trades), ''], ['Volume', usd(p.volumeUsd), '']],
      name: own ? 'Play-money account' : 'Simulated character', tone: p.pnlUsd < 0 ? 'down' : 'up',
      foot: 'Practice only · agi1.app/games/trenchingsimulator' }, `${p.name} · ${signed(p.pnlUsd, 'usd')} run P&L · practice only`);
  }
  function relations(kind) {
    if (!own) return modal(root, kind === 'followers' ? 'Followers' : 'Following', empty('Names are not recorded', 'Simulation follower counts do not identify real accounts.'));
    const box = el('div', { class: 'phs-relations' });
    const render = () => {
      const people = (kind === 'followers' ? [] : state.prefs[kind]).map((k) => state.profile(k)).filter(Boolean);
      box.replaceChildren(...people.map((p) => el('div', {}, button([avatar(p), p.name], () => onTrader?.(p.key), 'phs-person'),
        button(kind === 'muted' ? 'Unmute' : 'Unfollow', () => { if (kind === 'muted') state.toggleMute(p.key); else state.toggleFollow(p.key); render(); update(true); }))));
      if (!people.length) box.append(empty(kind === 'followers' ? 'No public follower accounts' : 'No traders here yet', kind === 'followers' ? 'This profile and its social actions are local to this device.' : 'Follow or mute a simulated trader from their profile.'));
    };
    render(); modal(root, kind === 'followers' ? 'Followers' : kind === 'muted' ? 'Muted traders' : 'Following', box);
  }
  function editProfile() {
    const p = profile(), nameInput = input('Display name', p.name), username = input('Username', p.handle);
    nameInput.maxLength = 40; username.maxLength = 30;
    const biography = el('textarea', { class: 'phs-input', 'aria-label': 'Bio', maxLength: 160, rows: 3 }); biography.value = p.bio || '';
    const avChoice = select('Avatar', ['🍜', '🐱', '🐸', '🦊', '🪙', '🚀', '🌙', '🐋'].map((s) => [s, s]), p.avatar);
    const cover = select('Banner', ['violet', 'ocean', 'forest', 'sunset', 'midnight'].map((s) => [s, s]), p.banner);
    let closeEditor;
    const form = el('form', { class: 'phs-form', on: { submit(e) {
      e.preventDefault(); state.setProfile({ displayName: nameInput.value, handle: username.value, bio: biography.value, avatar: avChoice.value, banner: cover.value });
      if (nameInput.value.trim()) ctx.setPlayerName?.(state.profile('you').name); closeEditor(); update(true);
    } } }, el('label', {}, 'Display name', nameInput), el('label', {}, 'Username', username), el('label', {}, 'Bio · 160 characters', biography),
      el('div', { class: 'phs-toolbar' }, el('label', {}, 'Avatar', avChoice), el('label', {}, 'Banner', cover)),
      el('small', {}, 'Profile details stay on this device. No external account is connected.'), el('button', { type: 'submit', class: 'phs-button phs-primary' }, 'Save profile'));
    closeEditor = modal(root, 'Edit profile', form);
  }
  function update(force = false) {
    if (dead || (force !== true && Date.now() - last < 700)) return; last = Date.now();
    const p = profile(); if (!p) { root.replaceChildren(empty('Trader unavailable'), button('Back', onClose)); return; }
    banner.className = `phs-profile-banner phs-banner-${p.banner || 'violet'}`;
    setText(av, p.avatar || p.name[0]); setText(name, p.name); setText(handle, `@${p.handle}`); setText(bio, p.bio || (own ? 'Your practice trading profile.' : 'A simulated character in this run.'));
    setText(follow, relation(state, key)); setText(mute, state.isMuted(key) ? 'Unmute' : 'Mute');
    setText(following, own ? `${state.prefs.followed.length} following` : 'Following —'); setText(followers, `${fin(p.followers) ? compact(p.followers, 0) : '—'} followers`);
    setText(details, `${p.trades} recorded trades · ${own ? `Run age ${age(market.t)} · Play money` : 'Simulated trader · Fictional history'}`);
    setText(worth, own ? usdFull(market.player.worth * px) : usd(p.holdings.reduce((sum, h) => sum + (h.valueUsd || 0), 0)));
    const series = own ? profileEquity(market, period, px) : { points: [], observed: 0, changeUsd: null };
    setText(pnl, signed(own ? series.changeUsd : p.pnlUsd, 'usd')); tint(pnl, own ? series.changeUsd : p.pnlUsd);
    setText(observed, own ? `Observed ${age(series.observed)} of this run · includes cash and marked holdings` : 'Current held value. Historical equity is not recorded for this simulated trader.');
    for (let i = 0; i < tabs.children.length; i++) flag(tabs.children[i], 'is-active', periods[i][0] === period);
    equitySVG(plot, series.points);
    const values = [own ? signed(market.positions().reduce((s, x) => s + x.realized, 0) * px, 'usd') : '—', signed(p.unrealizedUsd, 'usd'), pct(own ? p.closed?.winRate : p.winRate),
      own ? String(p.closed?.count || 0) : '—', usd(p.volumeUsd), own && fin(p.closed?.averageHold) ? age(p.closed.averageHold) : '—'];
    Object.values(statFields).forEach((f, i) => setText(f.dd, values[i]));
    cash.replaceChildren(own ? el('div', {}, el('strong', {}, `Practice cash ${usdFull(market.player.sol * px)}`),
      el('small', {}, `Reserved for pending orders ${usdFull((market.player.held || 0) * px)} · No deposits, withdrawals, or real transfers.`)) : el('small', {}, 'Simulated trader cash is not exposed.'));
    const top = own ? market.positions().filter((x) => fin(x.total)).sort((a, b) => b.total - a.total).slice(0, 5) : [];
    keyed(best, top, (p0) => p0.id, (p0) => { const n = button('', () => onPosition?.({ coin: p0.id, traderKey: key }), 'phs-top-trade'); return n; },
      (n, p0) => { setText(n, `$${p0.ticker} · ${signed(p0.total * px, 'usd')} · ${pct(p0.pnlPct)}`); tint(n, p0.total); });
    if (!top.length) best.replaceChildren(empty('No complete position rankings recorded'));
    const theses = own ? state.notes().filter((n) => !n.parentKey) : [];
    thesisIndex = Math.min(thesisIndex, Math.max(0, theses.length - 1));
    if (theses.length) { const n = theses[thesisIndex]; thesis.replaceChildren(el('h3', {}, 'Your local theses'), el('p', {}, n.text),
      el('div', { class: 'phs-toolbar' }, button('Newer', () => { thesisIndex = Math.max(0, thesisIndex - 1); update(true); }),
        el('small', {}, `${thesisIndex + 1} / ${theses.length} · ${state.isLiked(n.id) ? '♥ 1' : '♡ 0'}`), button('Older', () => { thesisIndex = Math.min(theses.length - 1, thesisIndex + 1); update(true); }))); }
    else thesis.replaceChildren();
    flag(open, 'is-active', positionsTab === 'open'); flag(closed, 'is-active', positionsTab === 'closed');
    flag(dust, 'is-active', showDust);
    let positions = own ? market.positions().filter((x) => x.open === (positionsTab === 'open')).map((x) => ({ coin: x.id, valueUsd: x.value * px, pnlUsd: x.total * px, last: x.last, position: x }))
      : positionsTab === 'open' ? p.holdings : [];
    positions = assetType === 'perps' ? [] : positions.filter((x) => positionsTab === 'closed' || showDust || !fin(x.valueUsd) || x.valueUsd >= 1);
    positions = [...positions].sort((a, b) => positionSort.value === 'pnl' ? (b.pnlUsd ?? -Infinity) - (a.pnlUsd ?? -Infinity) : positionSort.value === 'value' ? (b.valueUsd ?? -Infinity) - (a.valueUsd ?? -Infinity) : (b.last || 0) - (a.last || 0));
    keyed(posList, positions, (x) => x.coin, (x) => {
      const identity = button('', () => onPosition?.({ coin: x.coin, traderKey: key }), 'phs-person'), value = el('span'), profit = el('strong');
      const row = el('article', { class: 'phs-profile-position' }, identity, value, profit,
        button('Trade', () => onCoin?.(x.coin)), own && onShare ? button('Share', () => { const current = market.positions().find((v) => v.id === x.coin); if (current) onShare(current); }) : null);
      row._parts = { identity, value, profit }; return row;
    }, (n, x) => { const r = market.row(x.coin); setText(n._parts.identity, r ? `$${r.ticker}` : 'Token unavailable'); setText(n._parts.value, usd(x.valueUsd)); setText(n._parts.profit, signed(x.pnlUsd, 'usd')); tint(n._parts.profit, x.pnlUsd); });
    if (!positions.length) posList.replaceChildren(empty(assetType === 'perps' ? 'Perps are view-only on web' : positionsTab === 'closed' && !own ? 'Individual closed positions are not retained' : 'No positions here yet', !showDust && positionsTab === 'open' && assetType !== 'perps' ? 'Positions worth less than $1 are hidden. Turn on Show dust to include them.' : ''));
    const events = state.feed({ traderKey: key, types: ['trade'], limit: 100 }).filter((e) => swapFilter === 'all' || e.side === swapFilter);
    for (let i = 0; i < swapTabs.children.length; i++) flag(swapTabs.children[i], 'is-active', ['all', 'buy', 'sell'][i] === swapFilter);
    keyed(swaps, events, (e) => e.key, (e) => { const coin = button(e.ticker, () => onPosition?.({ coin: e.coin, traderKey: key }), 'phs-coin-link'), side = el('span'), amount = el('strong'), when = el('small');
      const row = el('div', { class: 'phs-swap-row' }, coin, side, amount, when); row._parts = { side, amount, when }; return row;
    }, (n, e) => { setText(n._parts.side, e.side === 'buy' ? 'Buy' : 'Sell'); tint(n._parts.side, e.side === 'buy' ? 1 : -1); setText(n._parts.amount, usd(e.amountUsd)); setText(n._parts.when, `${age(Math.max(0, market.t - e.t))} ago`); });
    if (!events.length) swaps.replaceChildren(empty('No recorded swaps'));
  }
  update(true); return { el: root, update, destroy() { dead = true; root.remove(); } };
}

export function mountPhomoPosition(host, ctx, { coin, traderKey = 'you' } = {}, { state, onTrader, onCoin, onClose = () => {}, onShare } = {}) {
  const market = ctx.market, px = ctx.solUsd > 0 ? ctx.solUsd : market.solUsd, base = Date.now() - market.t * 1000;
  let dead = false, last = -Infinity, window = Infinity, marks = true, theses = false, page = 0, shape = 'candles';
  const root = el('section', { class: 'phs-position-detail', role: 'dialog', 'aria-label': 'Position details' }); host.append(root);
  const trader = state.profile(traderKey), identity = button([avatar(trader), trader?.name || 'Trader'], () => onTrader?.(traderKey), 'phs-person');
  const follow = button(relation(state, traderKey), () => { state.toggleFollow(traderKey); update(true); }); follow.hidden = traderKey === 'you';
  const share = button('Share', () => { const p = market.positions().find((x) => x.id === coin); if (traderKey === 'you' && p) onShare?.(p); }); share.hidden = traderKey !== 'you' || !onShare;
  root.append(el('header', { class: 'phs-position-header' }, identity, button('View profile', () => onTrader?.(traderKey)), el('span', { class: 'phs-pill' }, traderKey === 'you' ? 'Practice position' : 'Simulated trader'), share, follow, button(icon('close'), onClose, '', 'Close position')));
  const title = el('div', { class: 'phs-position-coin' }), chartHost = el('div', { class: 'phs-position-chart' });
  const chart = createPhomoChart(chartHost, { mode: 'mcap', unit: 'usd', tf: 1, colors: { bg: '#08070f', up: '#56d6a1', down: '#ec7696', axis: '#8c899d', strong: '#eee9ff' } });
  const timeChoices = [[300, 'LIVE'], [3600, '1H'], [14400, '4H'], [Infinity, 'ALL']];
  const controls = el('div', { class: 'phs-chart-controls' }, timeChoices.map(([seconds, label]) => button(label, () => { window = seconds; update(true); chart.fit(); })));
  const swapButton = button('Swaps', () => { marks = !marks; update(true); }), thesisButton = button('Theses', () => { theses = !theses; update(true); });
  const lineButton = button('Line', () => { shape = shape === 'candles' ? 'line' : 'candles'; chart.style(shape); setText(lineButton, shape === 'candles' ? 'Line' : 'Candles'); });
  controls.append(swapButton, thesisButton, lineButton, button('+', () => chart.zoom(1), '', 'Zoom chart in'), button('−', () => chart.zoom(-1), '', 'Zoom chart out'),
    button('Expand', () => { flag(root, 'is-expanded', !root.classList.contains('is-expanded')); chart.redraw?.(); }));
  const notes = el('div', { class: 'phs-position-theses' }), about = el('p', { class: 'phs-caption' }), unknown = el('p', { class: 'phs-caption' });
  const fields = Object.fromEntries(['Position value', 'Total P&L', 'Quantity', 'Average entry', 'Invested', 'Realized P&L'].map((s) => [s, field(s)]));
  const min = input('Minimum transaction size in dollars', '', 'number'); min.min = '0'; min.placeholder = 'Minimum $'; min.addEventListener('input', () => { page = 0; update(true); });
  const body = el('tbody'), counter = el('span');
  const prev = button('Previous', () => { page = Math.max(0, page - 1); update(true); });
  const next = button('Next', () => { page++; update(true); });
  const trade = el('div', { class: 'phs-position-trade' }, button('Buy', () => onCoin?.(coin, { side: 'buy' }), 'phs-buy'), button('Sell', () => onCoin?.(coin, { side: 'sell' }), 'phs-sell'));
  root.append(el('div', { class: 'phs-position-grid' }, el('div', { class: 'phs-position-left' }, title, controls, chartHost, chartCredit(), notes, el('h3', {}, 'About'), about),
    el('aside', { class: 'phs-position-right' }, trade, el('small', { class: 'phs-caption' }, 'Opens your practice order form.'),
      el('dl', { class: 'phs-position-stats' }, Object.values(fields).map((f) => f.el)), unknown,
      el('div', { class: 'phs-toolbar' }, el('h3', {}, 'Transactions'), min),
      el('table', { class: 'phs-table' }, el('thead', {}, el('tr', {}, ['Action', 'Amount', 'Time'].map((s) => el('th', {}, s)))), body),
      el('div', { class: 'phs-pagination' }, prev, counter, next))));
  function update(force = false) {
    if (dead || (force !== true && Date.now() - last < 500)) return; last = Date.now();
    const d = positionDetail(market, coin, traderKey, { solUsd: px });
    if (!d) { setText(unknown, 'This position is unavailable. Live token data does not identify real traders.'); trade.hidden = true; return; }
    const r = d.row, m = tokenMetrics(market, coin, { solUsd: px });
    title.replaceChildren(pic(r, '', 'ph'), el('div', {}, el('h2', {}, `$${r.ticker}`), el('span', {}, r.name)), el('strong', {}, `MC ${usd(m?.marketCapUsd)}`));
    setText(follow, relation(state, traderKey));
    const values = [usd(d.valueUsd), signed(d.pnlUsd, 'usd'), tokens(d.quantity), usd(d.averageEntryUsd), usd(d.investedUsd), signed(d.realizedUsd, 'usd')];
    Object.values(fields).forEach((f, i) => setText(f.dd, values[i])); tint(fields['Total P&L'].dd, d.pnlUsd);
    const candles = market.candles(coin, Number.isFinite(window) ? Math.max(0, market.t - window) : 0);
    // ALL is a window choice, not an interval. A short retained run still needs individual candles.
    const span = candles.length > 1 ? Math.max(0, candles.at(-1).t - candles[0].t) : 0;
    chart.set({ candles, solUsd: px, marks: marks ? d.history.map((t) => ({ t: t.t, side: t.side })) : [], tf: span > 3600 ? 60 : span > 300 ? 15 : 1, migratedAt: market.stats(coin)?.poolAt, base });
    for (let i = 0; i < 4; i++) flag(controls.children[i], 'is-active', timeChoices[i][0] === window);
    flag(swapButton, 'is-active', marks); flag(thesisButton, 'is-active', theses);
    notes.hidden = !theses;
    if (theses) {
      const entries = state.notes({ coin }); notes.replaceChildren(...entries.slice(0, 10).map((n) => el('p', {}, el('strong', {}, 'You · local thesis '), n.text)));
      if (!entries.length) notes.append(empty('No local thesis for this token'));
    }
    setText(about, `${r.name} · ${r.live ? 'Live market with practice positions. Quantities and entry prices use normalized practice units.' : 'Simulation token and recorded game activity.'} Chart shows retained observations only.`);
    setText(unknown, d.own ? 'Average entry is the remaining position cost per practice unit. Transaction history retains up to 300 of your run orders.' : 'Unknown entry and realized P&L stay blank. Only retained swaps for this simulated identity are shown.');
    const threshold = Number(min.value), history = d.history.filter((t) => !Number.isFinite(threshold) || threshold <= 0 || (fin(t.amountUsd) && t.amountUsd >= threshold));
    const count = Math.max(1, Math.ceil(history.length / 11)); page = Math.max(0, Math.min(page, count - 1));
    keyed(body, history.slice(page * 11, page * 11 + 11), (t) => t.key, () => el('tr', {}, el('td'), el('td'), el('td')), (n, t) => {
      setText(n.children[0], t.side === 'buy' ? 'Buy' : 'Sell'); tint(n.children[0], t.side === 'buy' ? 1 : -1); setText(n.children[1], usd(t.amountUsd)); setText(n.children[2], `${age(Math.max(0, market.t - t.t))} ago`);
    });
    if (!history.length) body.replaceChildren(el('tr', {}, el('td', { colSpan: 3 }, 'No matching retained transactions')));
    setText(counter, `${page + 1} / ${count} · ${history.length} swaps`); prev.disabled = page === 0; next.disabled = page + 1 >= count;
  }
  update(true); return { el: root, update, destroy() { dead = true; chart.destroy(); root.remove(); } };
}
