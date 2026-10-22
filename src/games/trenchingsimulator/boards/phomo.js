// Phomo's dollar-denominated discovery workspace. Local social controls belong to this game only.
// Panels share one market and order path; switching or splitting them never creates a second game clock.
import { el, setText, flag, keyed as reconcile, icon, toast } from '../ui.js';
import { markEl, wordEl } from '../brands.js';
import { usd, usdFull, signed, pct, age, compact } from '../format.js';
import { SAFETY_NOTE } from '../terminals.js';
import { chainById, feedWords } from '../live-chains.js';
import { createAddressSearch } from '../live-search.js';
import { pic, samePic, parseAmount, ORDER_ERRORS, short } from './common.js';
import { createPhomoState } from './phomo-state.js';
import { PHOMO_CATEGORIES, PHOMO_WINDOWS } from './phomo-data.js';
import { mountPhomoCoin } from './phomo-coin.js';
import { positionCardWords } from './gngm-card.js';
import './phomo.css';
import './phomo-perps.css';

const TYPES = [['tokens', 'Tokens', 'chart'], ['watchlist', 'Watchlist', 'star'], ['perps', 'Perps', 'arrows'],
  ['leaderboard', 'Leaderboard', 'trophy'], ['feed', 'Feed', 'users'], ['alerts', 'Alerts', 'bolt']];
const fin = Number.isFinite;
const button = (text, click, cls = '', label = typeof text === 'string' ? text : undefined) => el('button', { type: 'button', class: `ph-btn ${cls}`,
  'aria-label': label, on: { click } }, text);
const empty = (title, detail) => el('div', { class: 'ph-empty' }, icon('search'), el('strong', {}, title), el('p', {}, detail));
const stat = (label, value) => el('div', { class: 'ph-stat' }, el('small', {}, label), el('strong', {}, value));
const input = (label, value = '', type = 'text') => el('input', { class: 'ph-input', type, value,
  'aria-label': label, placeholder: label, autocomplete: 'off' });
function select(label, values, value, change) {
  const n = el('select', { class: 'ph-select', 'aria-label': label }, values.map((v) => el('option', { value: Array.isArray(v) ? v[0] : v }, Array.isArray(v) ? v[1] : v)));
  n.value = String(value); n.addEventListener('change', () => change(n.value)); return n;
}
function tint(node, value) { flag(node, 'is-up', value > 0); flag(node, 'is-down', value < 0); }
function keyed(host, items, key, make, update) {
  for (const child of [...host.children]) if (!child.dataset.key) child.remove();
  reconcile(host,items,key,make,update);
}

export function mountPhomo(host, ctx) {
  const { market } = ctx;
  let storage = null;
  try { storage = globalThis.localStorage; } catch { /* storage can be blocked */ }
  const state = createPhomoState(market, { storage, solUsd: ctx.solUsd, order: ctx.order, playerName: ctx.playerName });
  const chain = ctx.chain ? chainById(ctx.chain).name : 'Simulated market';
  let dead = false, last = -Infinity, subView = null, dialog = null, sequence = 0, active = 0, searchTimer;
  let layout = state.prefs.ui?.layout || 'columns';
  let railOpen = state.prefs.ui?.rail === true;
  let quick = String(state.prefs.ui?.quickBuy || Math.min(100, Math.max(1, Math.round(ctx.start * ctx.solUsd / 10))));
  const panels = [];
  const root = el('div', { class: 'ph-root', 'aria-label': 'Phomo terminal' });
  const content = el('div', { class: 'ph-workspace', data: { layout } });
  const subHost = el('div', { class: 'ph-sub', hidden: true });
  const rail = el('nav', { class: 'ph-rail', 'aria-label': 'Discovery' });
  const railToggle = button(railOpen ? '«' : '»', () => { railOpen = !railOpen; flag(root,'is-rail-collapsed',!railOpen);
    setText(railToggle,railOpen ? '«' : '»'); railToggle.setAttribute('aria-label',railOpen ? 'Collapse discovery panel' : 'Expand discovery panel');
    railToggle.setAttribute('aria-expanded',String(railOpen)); saveUI(); },'ph-rail-toggle',railOpen ? 'Collapse discovery panel' : 'Expand discovery panel');
  railToggle.setAttribute('aria-expanded',String(railOpen)); rail.append(railToggle); flag(root,'is-rail-collapsed',!railOpen);
  const watchstrip = el('div', { class: 'ph-watchstrip', 'aria-label': 'Watched tokens' });
  const balance = el('span');
  const worth = el('span');
  const notices = el('span', { class: 'ph-badge' });
  const searchIn = input('Search tokens, traders or contract address'); searchIn.type = 'search';
  const found = el('div', { class: 'ph-search-results', hidden: true });
  const addressSearch = createAddressSearch(market, () => { if (!dead) search(); });
  const searchBox = el('form', { class: 'ph-search', role: 'search', on: { submit(e) { e.preventDefault(); search(); found.querySelector('button')?.click(); } } },
    icon('search'), searchIn, button('Paste', async () => { try { searchIn.value = (await navigator.clipboard.readText()).slice(0,160); search(); } catch { toast('Paste into the search field with your keyboard.'); searchIn.focus(); } }), el('kbd', {}, '/'), found);
  searchIn.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(search, 160); });
  searchIn.addEventListener('keydown', (e) => { if (e.key === 'Escape') { searchIn.value = ''; found.hidden = true; } if (e.key === 'ArrowDown') { e.preventDefault(); found.querySelector('button')?.focus(); } });
  const head = el('header', { class: 'ph-topbar' }, button([markEl('social', 'ph-logo'), wordEl('social', 'ph-word')], () => setMain('tokens'), 'ph-brand', 'Phomo home'),
    button('Discover', () => setMain('tokens'), 'ph-discover'), searchBox,
    button([icon('bag'), balance, el('small', {}, 'cash')], showCash, 'ph-cash', 'Play cash balance'),
    button([icon('users'), worth], () => showProfile('you'), 'ph-account', 'Your profile'),
    button([icon('bolt'), notices], () => setMain('alerts'), 'ph-icon', 'Notifications'),
    button(icon('sliders'), ctx.openSettings, 'ph-icon', 'Game settings'));
  for (const [kind, label, ic] of TYPES) rail.append(button([icon(ic), el('span', {}, label)], () => setMain(kind), 'ph-rail-button', label));
  const positionList = el('div', { class: 'ph-position-list' });
  let closed = false, positionType = 'all';
  const positionTabs = el('div', { class: 'ph-tabs' });
  for (const [id, label] of [['all', 'All'], ['tokens', 'Tokens'], ['perps', 'Perps']]) positionTabs.append(button(label, () => { positionType = id; refreshPositions(); }, '', `${label} positions`));
  const openButton = button('Open', () => { closed = false; refreshPositions(); });
  const closedButton = button('Closed', () => { closed = true; refreshPositions(); });
  const positions = el('aside', { class: 'ph-positions', 'aria-label': 'Your positions' }, el('div', { class: 'ph-panel-heading' }, el('h2', {}, 'Your positions'),
    button(icon('chart'), () => showProfile('you'), 'ph-icon', 'Portfolio performance')), el('div', { class: 'ph-segment' }, openButton, closedButton), positionTabs, positionList);
  const body = el('div', { class: 'ph-body' }, rail, el('div', { class: 'ph-center' }, watchstrip, content, subHost), positions);
  const ticker = el('div', { class: 'ph-ticker' });
  const status = el('span', { class: 'ph-status' });
  const footer = el('footer', { class: 'ph-footer' }, ticker, status, button('Help', showHelp), button('Layouts', showLayouts));
  root.append(head, body, footer); host.append(root);

  function saveUI() {
    state.setPrefs({ ui: { layout, quickBuy: parseAmount(quick) || 100, rail: railOpen,
      panels: panels.map((p) => ({ ...p.options, kind: p.kind })) } });
  }
  function error(res) { toast(res?.error === 'min_buy' ? `Minimum buy: ${usd(0.001 * ctx.solUsd)}.`
    : (ORDER_ERRORS[res?.error] || 'The order could not be placed.').replaceAll('SOL', 'play cash'), 'down'); }
  function quickBuy(id) {
    const amount = parseAmount(quick); if (!(amount > 0)) return toast('Enter a quick-buy amount in dollars.', 'down');
    const prefs = state.prefs;
    const res = ctx.order({ coin: id, side: 'buy', sol: amount / ctx.solUsd,
      ...(prefs.slippageMode === 'custom' ? { slippage: prefs.slippage } : {}) });
    if (!res?.ok) error(res); else toast(`Buying ${usd(amount)} of ${market.row(id)?.ticker || 'this token'} with play money.`, '', 1400);
  }
  function search() {
    const q = searchIn.value.trim().slice(0,160); found.replaceChildren(); found.hidden = !q; if (!q) return;
    const ids = market.find(q).slice(0,12); const people = state.traders({ query: q }).slice(0,5);
    if (ids.length) found.append(el('small', {}, 'Tokens'));
    for (const id of ids) { const r = market.row(id); if (r) found.append(button([pic(r,'','ph'), el('span', {}, el('b', {}, r.ticker), el('small', {}, r.name)), el('span', {}, usd(r.mc * ctx.solUsd))], () => { openCoin(id); searchIn.value = ''; found.hidden = true; }, 'ph-search-row', `Open ${r.ticker}`)); }
    if (people.length) found.append(el('small', {}, 'Simulated traders'));
    for (const p of people) found.append(button([el('span', { class: 'ph-avatar' }, p.name[0]), p.name, el('small', {}, signed(p.pnlUsd,'usd'))], () => { showProfile(p.key); searchIn.value = ''; found.hidden = true; }, 'ph-search-row'));
    const note = addressSearch(q, ids.length > 0);
    if (!ids.length && !people.length) found.append(el('p', {}, note || 'No matching tokens or traders in this market.'));
  }
  function makePanel(kind = 'tokens', options = {}) {
    const p = { id: ++sequence, kind, options: { category: 'trending', window: '5m', limit: 25, direction: 'desc', filters: {}, ...options }, update: null, dispose: null };
    p.el = el('section', { class: 'ph-panel', 'aria-label': `${TYPES.find(([k]) => k === kind)?.[1] || 'Tokens'} panel`, on: { pointerdown: () => { active = panels.indexOf(p); } } });
    p.toolbar = el('div', { class: 'ph-panel-tools' });
    p.select = select('Panel content', TYPES.map(([k,l]) => [k,l]), kind, (v) => { p.kind = v; renderPanel(p); saveUI(); });
    p.toolbar.append(p.select, button('⊞', () => split(p, 'columns'), 'ph-icon', 'Split right'), button('⊟', () => split(p, 'rows'), 'ph-icon', 'Split bottom'),
      button('×', () => removePanel(p), 'ph-icon', 'Close panel'));
    p.host = el('div', { class: 'ph-panel-content' }); p.el.append(p.toolbar, p.host); panels.push(p); content.append(p.el); renderPanel(p); return p;
  }
  function split(p, direction) {
    if (panels.length >= 4) return toast('Four panels are open. Close a panel to make room.');
    closeSub(); layout = direction; content.dataset.layout = layout; makePanel(p.kind, { ...p.options, filters: { ...p.options.filters } }); saveUI();
  }
  function removePanel(p) { if (panels.length === 1) return toast('Keep at least one discovery panel open.'); p.dispose?.(); p.el.remove(); panels.splice(panels.indexOf(p),1); active = 0; saveUI(); }
  function setMain(kind) { closeSub(); const p = panels[Math.min(active,panels.length - 1)]; if (p) { p.kind = kind; renderPanel(p); saveUI(); } }
  function renderPanel(p) {
    p.dispose?.(); p.dispose = null; p.update = null; p.setActive = null; p.host.replaceChildren(); p.host.classList.remove('ph-token-panel'); p.select.value = p.kind;
    p.el.setAttribute('aria-label', `${TYPES.find(([k]) => k === p.kind)?.[1] || 'Tokens'} panel`);
    if (p.kind === 'tokens' || p.kind === 'watchlist') renderTokens(p);
    else if (p.kind === 'feed') renderFeed(p);
    else if (p.kind === 'leaderboard') renderLeaderboard(p);
    else if (p.kind === 'alerts') renderAlerts(p);
    else if (p.kind === 'perps') {
      const loading = empty('Loading markets', 'Connecting to the read-only market feed…'); p.host.append(loading);
      let cancelled = false; p.dispose = () => { cancelled = true; };
      import('./phomo-perps.js').then(({ mountPhomoPerps }) => { if (dead || cancelled) return; p.host.replaceChildren(); const v = mountPhomoPerps(p.host,ctx); p.update = v.update; p.setActive = v.setActive; if (subView) v.setActive(false); p.dispose = () => { cancelled = true; v.destroy(); }; }, () => { if (!cancelled) loading.replaceWith(empty('Markets unavailable', 'Reopen Perps to try again.')); });
    }
    p.update?.(performance.now());
  }
  function renderTokens(p) {
    p.host.classList.add('ph-token-panel');
    const tabs = el('div', { class: 'ph-tabs ph-categories' });
    for (const [key,label] of PHOMO_CATEGORIES) tabs.append(button(label, () => { p.options.category = key; p.options.sort = key === 'mostheld' ? 'holders' : key === 'bluechips' ? 'marketCap' : 'volume'; p.kind = key === 'watchlist' ? 'watchlist' : 'tokens'; renderPanel(p); saveUI(); }, key === (p.kind === 'watchlist' ? 'watchlist' : p.options.category) ? 'is-active' : ''));
    const count = el('span', { class: 'ph-count' });
    const qb = input('Quick-buy dollars', quick, 'number'); qb.min = '0.01'; qb.step = 'any';
    qb.addEventListener('change', () => { quick = qb.value; saveUI(); });
    const filters = button([icon('sliders'), 'Filters'], () => tokenFilters(p), 'ph-all-filters');
    const filterShortcuts = [['Market cap','minMarketCap'],['Liquidity','minLiquidity'],['Age','maxAge'],['Volume','minVolume']].map(([label,key]) => button(`${label} ⌄`,() => tokenFilters(p,key),'ph-filter-short'));
    const networks = [['all','All networks'],['simulated','Simulated'],...(ctx.chain ? [[ctx.chain,chain]] : [])];
    function sourceOptions() {
      const found = new Set(), size = market.size?.coins, shown = market.ext?.shown;
      if (Number.isInteger(size)) {
        // Match discovery's bounded candidate set, including sources below the current table's volume cutoff.
        for (let id = Math.max(0,size - 2000); id < size; id++) {
          const r = market.row(id);
          if (r?.src && !(shown && (r.live ? !shown.ext : !shown.sim))) found.add(r.src);
        }
      } else {
        for (const r of state.tokens({category:'trending',limit:100,network:'all',launchpad:'all',filters:{}}).rows) if (r.src) found.add(r.src);
      }
      const selected = p.options.launchpad;
      if (selected && selected !== 'all' && !found.has(selected)
        && state.tokens({category:'trending',limit:25,network:'all',launchpad:selected,filters:{}}).total > 0) found.add(selected);
      return [...found].sort();
    }
    let sources = sourceOptions();
    const oldNetwork = p.options.network || 'all', oldLaunchpad = p.options.launchpad || 'all';
    if (!networks.some(([id]) => id === oldNetwork)) p.options.network = 'all';
    if (oldLaunchpad !== 'all' && !sources.includes(oldLaunchpad)) p.options.launchpad = 'all';
    // Restore every saved panel before persisting corrected filters, so mounting the first cannot drop later panels.
    if (oldNetwork !== (p.options.network || 'all') || oldLaunchpad !== (p.options.launchpad || 'all')) queueMicrotask(() => { if (!dead) saveUI(); });
    const network = select('Network',networks,p.options.network || 'all',(v) => { p.options.network = v; p.update(); saveUI(); });
    const launchpad = select('Launchpad',[['all','All launchpads'],...sources.map((s) => [s,s])],p.options.launchpad || 'all',(v) => { p.options.launchpad = v; p.update(); saveUI(); });
    const rowCount = select('Number of tokens', [25,50,100],p.options.limit,(v) => { p.options.limit = Number(v); p.update(); saveUI(); });
    const win = select('Market time window',PHOMO_WINDOWS,p.options.window,(v) => { p.options.window = v; p.update(); saveUI(); });
    win.classList.add('ph-window-select');
    const windows = el('div',{class:'ph-window-buttons','aria-label':'Change and volume period'},PHOMO_WINDOWS.map((w) => button(w,() => { p.options.window = w; win.value = w; p.update(); saveUI(); },'',`${w} market window`)));
    const controls = el('div', { class: 'ph-controls' }, count,rowCount,win,windows,filterShortcuts,filters,network,launchpad);
    const list = el('tbody');
    const headers = [['Token',null],['Quick buy',null],['Market cap','marketCap'],['Age','age'],['Change','change'],['Volume','volume'],['Holders','holders'],['Latest thesis',null]];
    const table = el('table', { class: 'ph-table ph-token-table' }, el('thead', {}, el('tr', {}, headers.map(([label,key]) => el('th', {}, key ? button(label, () => { p.options.direction = p.options.sort === key && p.options.direction === 'desc' ? 'asc' : 'desc'; p.options.sort = key; p.update(); saveUI(); }) : label)))),list);
    table.querySelectorAll('th')[1].replaceChildren(el('label',{class:'ph-quick'},'Quick buy',el('span',{},'$'),qb));
    const blank = empty('No matching tokens', 'Try another category or reset the filters.');
    p.host.append(tabs,controls,el('div',{class:'ph-table-scroll'},table,blank));
    p.update = () => {
      const nextSources = sourceOptions();
      if (nextSources.length !== sources.length || nextSources.some((s,i) => s !== sources[i])) {
        sources = nextSources;
        const selected = p.options.launchpad || 'all';
        launchpad.replaceChildren(...[['all','All launchpads'],...sources.map((s) => [s,s])].map(([value,label]) => el('option',{value},label)));
        launchpad.value = selected === 'all' || sources.includes(selected) ? selected : 'all';
        if (launchpad.value !== selected) { p.options.launchpad = launchpad.value; saveUI(); }
      }
      const result = state.tokens({ ...p.options,category:p.kind === 'watchlist' ? 'watchlist' : p.options.category });
      setText(count,`${result.total} tokens`); blank.hidden = result.rows.length > 0; table.hidden = !result.rows.length;
      [...windows.children].forEach((b,i) => { flag(b,'is-active',PHOMO_WINDOWS[i] === p.options.window); b.setAttribute('aria-pressed',String(PHOMO_WINDOWS[i] === p.options.window)); });
      const heads = table.querySelectorAll('th'); setText(heads[4].firstChild,`${p.options.window} change`); setText(heads[5].firstChild,`${p.options.window} volume`);
      heads.forEach((h,i) => { if (headers[i][1]) h.setAttribute('aria-sort',headers[i][1] === p.options.sort ? (p.options.direction === 'asc' ? 'ascending' : 'descending') : 'none'); });
      filters.classList.toggle('is-active',Object.keys(p.options.filters).length > 0);
      const notes = state.notes();
      keyed(list,result.rows,(r) => r.id,(r) => {
        const star = button('☆',() => { state.toggleWatch(r.id); refresh(); },'ph-star',`Watch ${r.ticker}`);
        const name = button([pic(r,'','ph'),el('span',{},el('b',{},r.ticker),el('small',{},r.name))],() => openCoin(r.id),'ph-token-name',`Open ${r.ticker}`);
        const mobileAge = el('span',{class:'ph-token-mobile-age'}), context = el('span');
        const meta = el('small',{class:'ph-token-meta'},mobileAge,context);
        const buy = button('',() => quickBuy(r.id),'ph-quickbuy',`Quick buy ${r.ticker}`);
        const cells = Array.from({length:5},() => el('td'));
        const thesis = el('td',{class:'ph-thesis-cell'});
        const tr = el('tr',{},el('td',{},el('div',{class:'ph-token-cell'},star,name,button('×',() => { state.toggleHide(r.id); p.update(); },'ph-hide',`Hide ${r.ticker}`)),meta),el('td',{},buy),cells,thesis);
        tr._ph = {star,name,meta,mobileAge,context,buy,cells,thesis}; return tr;
      },(tr,r) => {
        const n = tr._ph; setText(n.star,state.isWatched(r.id) ? '★' : '☆'); n.star.setAttribute('aria-pressed',String(state.isWatched(r.id)));
        setText(n.mobileAge,`${fin(r.age) ? age(r.age) : '—'} · `); setText(n.context,`${r.live ? chain : 'Simulated'}${r.phase === 'pool' ? ' · Graduated' : ''}`);
        const old = n.name.querySelector('.ph-pic'); if (!samePic(old,r)) old?.replaceWith(pic(r,'','ph'));
        setText(n.buy,`↗ ${usd(parseAmount(quick))}`); setText(n.cells[0],usd(r.marketCapUsd)); setText(n.cells[1],fin(r.age) ? age(r.age) : '—');
        setText(n.cells[2],pct(r.change)); tint(n.cells[2],r.change); setText(n.cells[3],usd(r.volumeUsd)); setText(n.cells[4],fin(r.holders) ? compact(r.holders,0) : '—');
        const note = notes.find((v) => v.coin === r.id); setText(n.thesis,note ? note.text : '—');
      });
    };
  }
  function tokenFilters(p,focusKey = null) {
    const fields = [['minMarketCap','Minimum market cap ($)'],['maxMarketCap','Maximum market cap ($)'],['minLiquidity','Minimum liquidity ($)'],['minVolume','Minimum volume ($)'],['minHolders','Minimum holders'],['maxAge','Maximum age (seconds)'],['minChange','Minimum change (%)'],['maxChange','Maximum change (%)']];
    const nodes = new Map(); const form = el('form',{class:'ph-form'});
    for (const [key,label] of fields) { const val = p.options.filters[key]; const n = input(label,fin(val) ? val * (key.includes('Change') ? 100 : 1) : '', 'number'); n.step = 'any'; if (!key.includes('Change')) n.min = '0'; nodes.set(key,n); form.append(el('label',{},label,n)); }
    form.append(el('p',{class:'ph-muted'},`Filtering ${chain}. Unknown metrics do not pass numeric filters. Blue chips means market cap ≥ $1M and liquidity ≥ $50K in this game.`),el('div',{class:'ph-actions'},button('Restore hidden tokens',() => { state.restoreHidden(); refresh(); }),button('Reset filters',() => { p.options.filters = {}; closeDialog(); p.update(); saveUI(); })),el('button',{type:'submit',class:'ph-btn ph-primary'},'Apply filters'));
    form.addEventListener('submit',(e) => { e.preventDefault(); const f = {}; for (const [k,n] of nodes) if (n.value.trim() && fin(Number(n.value))) f[k] = Number(n.value)/(k.includes('Change') ? 100 : 1); p.options.filters = f; closeDialog(); p.update(); saveUI(); });
    showDialog('Token filters',form);
    if (focusKey) nodes.get(focusKey)?.focus();
  }
  function feedRow(e) {
    const title = e.traderKey ? button(e.name || 'You',() => showProfile(e.traderKey),'ph-trader-link') : el('strong',{},e.name || 'Simulated trader');
    const text = el('p'); const like = button('♡',() => { state.toggleLike(e.key); refresh(); },'','Like this local activity');
    const copy = button(e.side === 'sell' ? 'Copy sell' : `Copy ${usd(parseAmount(quick))}`,() => { const result = state.copyTrade(e,parseAmount(quick)); if (!result?.ok) error(result); else toast('Copy order placed with play money.'); },'ph-copy');
    const row = el('article',{class:'ph-feed-card'},el('div',{class:'ph-feed-top'},el('span',{class:'ph-avatar'},(e.name || 'Y')[0]),title,el('small',{},e.source === 'you' ? 'You' : e.source === 'note' ? 'Local thesis' : 'Simulated trader')),
      text,el('div',{class:'ph-feed-bottom'},Number.isInteger(e.coin) ? button(e.ticker || 'Open token',() => openCoin(e.coin),'ph-token-link') : null,el('small',{class:'ph-event-age'}),like,e.kind === 'trade' ? copy : null));
    row._ph = {text,like,copy}; return row;
  }
  function updateFeedRow(row,e) {
    setText(row._ph.text,e.kind === 'note' ? e.text : `${e.side === 'sell' ? 'Sold' : 'Bought'} ${fin(e.amountUsd) ? usd(e.amountUsd) : e.frac ? pct(e.frac) : ''} ${e.ticker || 'a token'}`);
    setText(row.querySelector('.ph-event-age'),`${age(Math.max(0,market.t - e.t))} ago`); setText(row._ph.like,`${e.liked ? '♥' : '♡'} ${e.likes || 0}`);
    row._ph.like.setAttribute('aria-pressed',String(Boolean(e.liked)));
    setText(row._ph.copy,e.side === 'sell' ? 'Copy sell' : `Copy ${usd(parseAmount(quick))}`);
  }
  function renderFeed(p) {
    let following = false; const rows = el('div',{class:'ph-feed'}); const all = button('All activity',() => { following = false; p.update(); }); const friends = button('Following',() => { following = true; p.update(); });
    const note = el('textarea',{class:'ph-input',placeholder:'Write a private thesis for this run…','aria-label':'Your local thesis',maxLength:280,rows:2});
    const composer = el('form',{class:'ph-composer',on:{submit(e) { e.preventDefault(); const result = state.addNote({text:note.value}); if (result.ok) { note.value = ''; p.update(); } else toast('Write a thesis before saving.'); }}},note,el('button',{type:'submit',class:'ph-btn'},'Save thesis'));
    const blank = empty('Your feed is quiet','Follow a simulated trader from the leaderboard, or make your first practice trade.');
    p.host.append(el('div',{class:'ph-tabs'},all,friends),el('p',{class:'ph-caption'},'Practice activity and simulated traders. Theses and likes stay on this device.'),composer,rows,blank);
    p.update = () => { flag(all,'is-active',!following); flag(friends,'is-active',following); const events = state.feed({following,limit:60}); blank.hidden = events.length > 0; keyed(rows,events,(e) => e.key,feedRow,updateFeedRow); };
  }
  function renderLeaderboard(p) {
    let only = false; const rows = el('tbody');
    const period = select('Trader ranking period',[['pnl','This run'],['week','7 days']],'week',() => p.update());
    const metric = select('Rank traders by',[['pnl','Profit'],['winRate','Win rate'],['volume','Volume'],['followers','Followers (current)']], 'pnl',() => p.update());
    const follow = button('Following only',() => { only = !only; p.update(); });
    const headings = ['#','Trader','Profit','Win rate','Volume',''].map((s) => el('th',{},s));
    const table = el('table',{class:'ph-table ph-trader-table'},el('thead',{},el('tr',{},headings)),rows);
    const blank = empty('No followed traders','Open a trader and follow them to build your feed.');
    p.host.append(el('h2',{class:'ph-title'},'Trader leaderboard'),el('p',{class:'ph-caption'},'Simulated traders · Practice rankings, no prizes. The seven-day history belongs to each fictional character.'),el('div',{class:'ph-controls'},period,metric,follow),el('div',{class:'ph-table-scroll'},table,blank));
    p.update = () => {
      period.disabled = metric.value === 'followers';
      const week = !period.disabled && period.value === 'week';
      const sort = week ? ({pnl:'week',winRate:'weekWinRate',volume:'weekVolume'})[metric.value] : metric.value;
      const people = state.traders({sort,following:only}); blank.hidden = !!people.length; flag(follow,'is-active',only);
      for (const [i,label] of [[2,'Profit'],[3,'Win rate'],[4,'Volume']]) setText(headings[i],`${label} · ${week ? '7d' : 'run'}`);
      keyed(rows,people,(p) => p.key,(r) => { const rank = el('td'); const name = button([el('span',{class:'ph-avatar'},r.name[0]),r.name],() => showProfile(r.key),'ph-trader-link'); const profit = el('td'), win = el('td'), vol = el('td'); const f = button('',() => { state.toggleFollow(r.key); p.update(); }); const tr = el('tr',{},rank,el('td',{},name),profit,win,vol,el('td',{},f)); tr._ph = {rank,profit,win,vol,f}; return tr; },(tr,r) => { const n = tr._ph; const profit = week ? r.weekPnlUsd : r.pnlUsd; setText(n.rank,r.rank); setText(n.profit,signed(profit,'usd')); tint(n.profit,profit); setText(n.win,pct(week ? r.weekWinRate : r.winRate)); setText(n.vol,usd(week ? r.weekVolumeUsd : r.volumeUsd)); setText(n.f,state.isFollowing(r.key) ? 'Following' : 'Follow'); n.f.setAttribute('aria-pressed',String(state.isFollowing(r.key))); });
    };
  }
  function renderAlerts(p) {
    const rules = el('div',{class:'ph-alert-list'}), notices = el('div',{class:'ph-alert-list'});
    const coin = select('Alert token',[['','Choose a token'],...state.tokens({category:'trending',limit:100,filters:{}}).rows.map((r) => [r.id,r.ticker])],'',() => {});
    coin.required = true;
    const metric = select('Alert metric',[['marketCap','Market cap'],['price','Price per practice unit']],'marketCap',() => {});
    const direction = select('Alert direction',[['above','Above'],['below','Below']],'above',() => {}); const amount = input('Alert threshold in dollars','','number'); amount.min = '0'; amount.step = 'any'; amount.required = true;
    const form = el('form',{class:'ph-alert-form',on:{submit(e) { e.preventDefault(); if (coin.value === '') return toast('Choose a token and a positive dollar threshold.','down'); const result = state.addAlert({coin:Number(coin.value),metric:metric.value,direction:direction.value,valueUsd:Number(amount.value)}); if (!result.ok) return toast(result.error === 'full' ? 'Remove an alert before creating another.' : 'Choose a token and a positive dollar threshold.','down'); amount.value = ''; p.update(); }}},coin,metric,direction,amount,el('button',{type:'submit',class:'ph-btn ph-primary'},'Create alert'));
    p.host.append(el('h2',{class:'ph-title'},'Alerts'),el('p',{class:'ph-caption'},'Alerts run while this game is open. Price alerts fire once; follow a trader to see their new practice trades.'),form,el('h3',{class:'ph-title'},'Price alerts'),rules,el('div',{class:'ph-panel-heading'},el('h3',{},'Notifications'),button('Mark all read',() => { state.markRead(); p.update(); })),notices);
    p.update = () => {
      const alerts = state.alerts(); keyed(rules,alerts,(a) => a.id,(a) => { const words = el('span'); const row = el('div',{class:'ph-alert'},words,button('Remove',() => { state.removeAlert(a.id); p.update(); })); row._words = words; return row; },(row,a) => setText(row._words,`${market.row(a.coin)?.ticker || 'Token'} · ${a.metric === 'price' ? 'Practice price' : 'Market cap'} ${a.direction} ${usd(a.valueUsd)}${a.firedAt !== null ? ' · Triggered' : ''}`));
      if (!alerts.length) rules.replaceChildren(el('p',{class:'ph-muted'},'No price alerts yet.'));
      const items = state.notifications({}); keyed(notices,items,(a) => a.id,(a) => button('',() => { state.markRead(a.id); if (Number.isInteger(a.coin)) openCoin(a.coin); else if (a.traderKey) showProfile(a.traderKey); },'ph-alert'),(row,a) => { setText(row,a.text || a.message || 'New activity'); flag(row,'is-unread',!a.read); });
      if (!items.length) notices.replaceChildren(el('p',{class:'ph-muted'},'New alerts will appear here.'));
    };
  }
  function refreshPositions() {
    flag(openButton,'is-active',!closed); flag(closedButton,'is-active',closed);
    [...positionTabs.children].forEach((b,i) => flag(b,'is-active',['all','tokens','perps'][i] === positionType));
    const rows = positionType === 'perps' ? [] : market.positions().filter((p) => closed ? !p.open : p.open);
    keyed(positionList,rows,(p) => p.id,(p) => { const title = button([pic(p,'','ph'),el('b',{},p.ticker)],() => openCoin(p.id),'ph-position-name'); const value = el('strong'); const profit = el('span'); const share = button(icon('share'),() => sharePosition(p.id),'ph-icon','Share position card'); const tr = el('article',{class:'ph-position'},title,el('div',{class:'ph-position-values'},value,profit),el('div',{class:'ph-actions'},button('View',() => openCoin(p.id)),share)); tr._ph = {value,profit}; return tr; },(tr,p) => { setText(tr._ph.value,usdFull((p.open ? p.value : p.sold) * ctx.solUsd)); setText(tr._ph.profit,`${signed(p.total * ctx.solUsd,'usd')} (${pct(p.pnlPct)})`); tint(tr._ph.profit,p.total); });
    if (!rows.length) positionList.replaceChildren(empty(positionType === 'perps' ? 'Perps are view-only' : `No ${closed ? 'closed' : 'open'} positions`,positionType === 'perps' ? 'Explore live markets from the Perps panel.' : closed ? 'Finished practice trades appear here.' : 'Open a token or use quick buy to begin.'));
  }
  function sharePosition(id) {
    const p = market.positions().find((x) => x.id === id); if (!p) return;
    const words = positionCardWords(p,{live:Boolean(market.row(id)?.live),currency:'usd',solUsd:ctx.solUsd,name:ctx.playerName?.(),terminal:'social'});
    ctx.saveCard?.(words,`${words.title} · ${words.big} · Phomo practice trading. ${SAFETY_NOTE}`);
  }
  function beginSub(kind) { if (!subView) ctx.pushSub?.(); else subView.view?.destroy(); ctx.onCoin?.(null); subView = {kind,view:null}; panels.forEach((p) => p.setActive?.(false)); content.hidden = true; subHost.hidden = false; subHost.replaceChildren(); }
  function closeSub(pop = true) { if (!subView) return; subView.view?.destroy(); subView = null; ctx.onCoin?.(null); subHost.replaceChildren(); subHost.hidden = true; content.hidden = false; panels.forEach((p) => p.setActive?.(true)); if (pop) ctx.popSub?.(); }
  function openCoin(id) { if (!market.row(id)) return; beginSub('coin'); ctx.onCoin?.(id); subView.view = mountPhomoCoin(subHost,ctx,id,{state,onTrader:showProfile,onClose:() => closeSub()}); }
  function showProfile(key) {
    const p = state.profile(key); if (!p) return toast('That trader is unavailable.');
    beginSub('profile'); let tab = 'holdings';
    const name = el('h1',{},p.name || ctx.playerName?.() || 'You');
    const controls = key === 'you' ? button('Edit name',() => { const n = input('Player name',ctx.playerName?.() || ''); n.maxLength = 24; const form = el('form',{class:'ph-form',on:{submit(e) { e.preventDefault(); const r = ctx.setPlayerName(n.value); if (r?.ok) { setText(name,r.name || 'You'); closeDialog(); } else toast('Use a name with 24 characters or fewer.'); }}},n,el('button',{type:'submit',class:'ph-btn ph-primary'},'Save name')); showDialog('Your name',form); }) : button(state.isFollowing(key) ? 'Following' : 'Follow',() => { state.toggleFollow(key); showProfile(key); },'ph-primary');
    const values = el('div',{class:'ph-profile-stats'}); const chart = el('canvas',{class:'ph-equity',width:900,height:200,'aria-label':'Your practice portfolio value over time',role:'img'});
    const list = el('div',{class:'ph-profile-list'}); const holdingTab = button('Holdings',() => { tab = 'holdings'; update(); }); const activityTab = button('Activity',() => { tab = 'activity'; update(); });
    const view = el('div',{class:'ph-profile'},button('← Back',() => closeSub()),el('div',{class:'ph-profile-hero'},el('span',{class:'ph-avatar ph-avatar-large'},(p.name || 'Y')[0]),el('div',{},name,el('p',{class:'ph-muted'},key === 'you' ? 'Your practice portfolio' : 'Simulated trader · Fictional history')),controls,key !== 'you' ? button(state.isMuted(key) ? 'Unmute' : 'Mute',() => { state.toggleMute(key); showProfile(key); }) : null),values,key === 'you' ? chart : null,el('div',{class:'ph-tabs'},holdingTab,activityTab),list);
    subHost.append(view);
    function update() {
      const profile = state.profile(key); if (!profile) return;
      values.replaceChildren(stat(key === 'you' ? 'Profit' : 'Realized profit',signed(profile.pnlUsd,'usd')),stat('Unrealized',signed(profile.unrealizedUsd,'usd')),stat('Volume',usd(profile.volumeUsd)),stat('Win rate',pct(profile.winRate)),stat('Trades',profile.trades ?? '—'));
      flag(holdingTab,'is-active',tab === 'holdings'); flag(activityTab,'is-active',tab === 'activity');
      if (tab === 'holdings') {
        const held = key === 'you' ? market.positions().filter((p) => p.open).map((p) => ({coin:p.id,valueUsd:p.value * ctx.solUsd,pnlUsd:p.total * ctx.solUsd})) : profile.holdings || [];
        keyed(list,held,(h) => h.coin,(h) => button('',() => openCoin(h.coin),'ph-holding'),(row,h) => setText(row,`${market.row(h.coin)?.ticker || 'Token'}    ${usd(h.valueUsd)}    ${signed(h.pnlUsd,'usd')}`));
        if (!held.length) list.replaceChildren(empty('No current holdings','Positions appear here after a practice buy.'));
      } else {
        const events = state.feed({traderKey:key,limit:100});
        keyed(list,events,(e) => e.key,feedRow,updateFeedRow); if (!events.length) list.replaceChildren(empty('No recent activity','This trader has not traded during the observed period.'));
      }
      if (key === 'you') drawEquity(chart,market.equity());
    }
    subView.view = {update,destroy() {}}; update();
  }
  function drawEquity(canvas,points) {
    const g = canvas.getContext('2d'); if (!g) return; const w = canvas.width,h = canvas.height; g.clearRect(0,0,w,h); if (points.length < 2) return;
    const values = points.map((p) => p.v); const lo = Math.min(...values), hi = Math.max(...values), range = hi - lo || 1;
    g.strokeStyle = ctx.colors.accent; g.lineWidth = 2; g.beginPath(); points.forEach((p,i) => { const x = 12 + i/(points.length - 1)*(w - 24); const y = h - 14 - (p.v - lo)/range*(h - 28); if (i) g.lineTo(x,y); else g.moveTo(x,y); }); g.stroke();
  }
  function showCash() { showDialog('Your play cash',el('div',{class:'ph-form'},stat('Available',usdFull(market.player.sol * ctx.solUsd)),stat('Portfolio',usdFull(market.netWorth() * ctx.solUsd)),el('p',{},'Your balance belongs to this run. Sell a practice position to free cash, or cash out and start another run with a new starting balance.'),el('p',{class:'ph-muted'},SAFETY_NOTE))); }
  function showLayouts() { showDialog('Workspace layout',el('div',{class:'ph-form'},el('p',{},'Open up to four panels. Each keeps its own category and filters. Resize panels using their bottom corner.'),button('Columns',() => { layout = 'columns'; content.dataset.layout = layout; saveUI(); closeDialog(); }),button('Rows',() => { layout = 'rows'; content.dataset.layout = layout; saveUI(); closeDialog(); }),button('Reset workspace',() => { panels.forEach((p) => { p.dispose?.(); p.el.remove(); }); panels.length = 0; layout = 'columns'; content.dataset.layout = layout; makePanel(); saveUI(); closeDialog(); })) ); }
  function showHelp() { showDialog('Phomo guide',el('div',{class:'ph-form'},el('p',{},'Search by token name, ticker or contract address. In Live mode, address search can find supported markets beyond the discovery list.'),el('p',{},'Use stars to build a watchlist, filters to narrow the table and split buttons to compare panels. Copy buttons place a single practice trade using your quick-buy amount.'),el('p',{},'Trader characters are simulated. Theses, follows and likes stay on this device. Price alerts run while the game is open. Unknown live metrics are shown as —.'),el('p',{},'Perpetual markets show live quotes and charts only. Spot positions use the game’s fees, slippage and available play balance.'),el('p',{},SAFETY_NOTE))); }
  function showDialog(title,node) {
    closeDialog(); const previous = document.activeElement; const close = button('×',closeDialog,'ph-icon','Close dialog');
    const box = el('section',{class:'ph-dialog-box',role:'dialog','aria-modal':'true','aria-label':title},el('div',{class:'ph-panel-heading'},el('h2',{},title),close),node);
    const cover = el('div',{class:'ph-dialog',on:{click(e) { if (e.target === cover) closeDialog(); },keydown(e) { if (e.key === 'Escape') { e.stopPropagation(); closeDialog(); } if (e.key === 'Tab') { const items = [...box.querySelectorAll('button,input,select,textarea')].filter((n) => !n.disabled); const first = items[0],last = items.at(-1); if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); } } }}},box);
    dialog = {node:cover,previous}; root.append(cover); close.focus();
  }
  function closeDialog() { if (!dialog) return; const old = dialog; dialog = null; old.node.remove(); if (old.previous?.isConnected) old.previous.focus(); }
  function refresh() {
    setText(balance,usdFull(market.player.sol * ctx.solUsd)); setText(worth,usd(market.netWorth() * ctx.solUsd));
    const news = state.notifications({unreadOnly:true}); setText(notices,news.length ? String(news.length) : '');
    refreshPositions();
    const watched = state.tokens({category:'watchlist',window:'5m',limit:25,filters:{}}).rows;
    keyed(watchstrip,watched,(r) => r.id,(r) => {
      const cap = el('span'), change = el('span');
      const b = button([el('span',{class:'ph-watch-name'},pic(r,'','ph'),el('b',{},r.ticker),el('span',{},'★')),el('span',{class:'ph-watch-values'},cap,change)],() => openCoin(r.id),'ph-watch-chip',`Open watched ${r.ticker}`);
      b._ph = {cap,change}; return b;
    },(b,r) => { setText(b._ph.cap,`${usd(r.marketCapUsd)} MC`); setText(b._ph.change,pct(r.change)); tint(b._ph.change,r.change); });
    if (!watched.length) watchstrip.replaceChildren(el('span',{class:'ph-muted'},'☆ Star tokens to pin them here'));
    const hot = state.tokens({category:'trending',window:'5m',limit:25,filters:{}}).rows.slice(0,5);
    keyed(ticker,hot,(r) => r.id,(r) => button('',() => openCoin(r.id)),(b,r) => { setText(b,`${r.ticker} ${usd(r.marketCapUsd)} ${pct(r.change)}`); tint(b,r.change); });
    const liveState = market.liveState?.();
    if (ctx.chain) {
      const words = feedWords(liveState?.feed,liveState?.chainState,ctx.chain,'run');
      const label = words.tone === 'live' ? 'Live' : ['connecting','idle'].includes(liveState?.feed) ? 'Connecting'
        : liveState?.feed === 'full' ? 'Feed full' : liveState?.feed !== 'live' ? 'Reconnecting'
          : liveState?.chainState === 'quiet' ? 'Quiet market' : 'Feed unavailable';
      setText(status,`● ${label} · ${chain}`); status.title = words.text;
      flag(status,'is-down',words.tone !== 'live');
    } else { setText(status,'● Simulated · play money'); status.title = 'Simulated market · practice money'; flag(status,'is-down',false); }
    [...rail.querySelectorAll('.ph-rail-button')].forEach((b,i) => { const selected = TYPES[i][0] === panels[Math.min(active,panels.length - 1)]?.kind; flag(b,'is-active',selected); b.setAttribute('aria-pressed',String(selected)); });
    for (const p of panels) p.update?.(performance.now()); subView?.view?.update?.(performance.now());
  }
  function keydown(e) {
    if (e.target.closest?.('input,textarea,select,[contenteditable="true"]')) return;
    if (e.key === '/') { e.preventDefault(); searchIn.focus(); }
    if (e.key === 'Escape' && !dialog) { found.hidden = true; if (subView) { e.preventDefault(); e.stopPropagation(); closeSub(); } }
  }
  root.addEventListener('keydown',keydown);
  const saved = state.prefs.ui?.panels;
  if (saved?.length) for (const p of saved) makePanel(TYPES.some(([k]) => k === p.kind) ? p.kind : 'tokens',p);
  else makePanel();
  refresh();
  return { el: root, update(now) { if (dead || now - last < 650) return; last = now; state.tick(); refresh(); },
    sub: () => Boolean(subView), closeSub: () => closeSub(false), openCoin,
    destroy() { dead = true; clearTimeout(searchTimer); closeDialog(); subView?.view?.destroy(); panels.forEach((p) => p.dispose?.()); state.destroy(); root.removeEventListener('keydown',keydown); root.remove(); } };
}
