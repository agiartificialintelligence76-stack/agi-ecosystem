// Phomo's dollar-denominated discovery workspace. Local social controls belong to this game only.
// Panels share one market and order path; switching or splitting them never creates a second game clock.
import { el, setText, flag, keyed as reconcile, icon, toast } from '../ui.js';
import { markEl, wordEl } from '../brands.js';
import { usd, usdFull, signed, pct, age, compact, price as priceWords } from '../format.js';
import { SAFETY_NOTE } from '../terminals.js';
import { chainById, feedWords } from '../live-chains.js';
import { createAddressSearch } from '../live-search.js';
import { pic, samePic, parseAmount, ORDER_ERRORS, short, waitingForRealCoins } from './common.js';
import { createPhomoState, PHOMO_SAVE_KEY } from './phomo-state.js';
import { PHOMO_CATEGORIES, PHOMO_WINDOWS, tokenMetrics } from './phomo-data.js';
import { mountPhomoCoin } from './phomo-coin.js';
import { mountPhomoSocial, mountPhomoProfile, mountPhomoPosition } from './phomo-social.js';
import { positionCardWords } from './gngm-card.js';
import './phomo.css';
import './phomo-perps.css';
import './phomo-reference.css';
import './phomo-social-reference.css';

const TYPES = [['tokens', 'Tokens', 'chart'], ['watchlist', 'Watchlist', 'star'], ['perps', 'Perps', 'arrows'],
  ['leaderboard', 'Leaderboard', 'trophy'], ['feed', 'Feed', 'users'], ['alerts', 'Alerts', 'bolt'], ['clans', 'Clans', 'users']];
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
  let hasSavedWorkspace = false;
  try { hasSavedWorkspace = Boolean(storage?.getItem(PHOMO_SAVE_KEY)); } catch { /* private browsing */ }
  const state = createPhomoState(market, { storage, solUsd: ctx.solUsd, order: ctx.order, playerName: ctx.playerName, kols:ctx.kols, paperPerps:ctx.paperPerps });
  const chain = ctx.chain ? chainById(ctx.chain).name : 'Simulated market';
  let dead = false, last = -Infinity, subView = null, dialog = null, popover = null, sequence = 0, active = 0, searchTimer;
  let layout = state.prefs.ui?.layout || 'columns';
  let railOpen = !narrowScreen() && state.prefs.ui?.rail === true, detailNavOpen = !narrowScreen(), navCategory = 'trending', navigationKind = state.prefs.ui?.navigationKind || 'tokens', selectedCoin = null, searchTab = 'tokens';
  let navigationView = null, navigationViewKind = null, scrolledNavigationKind = null, wasNarrow = narrowScreen();
  let discoveryWidth = hasSavedWorkspace ? state.prefs.ui?.discoveryWidth || 280
    : Math.max(280,Math.min(340,Math.round((globalThis.innerWidth || 1280)*.1771))), positionsWidth = state.prefs.ui?.positionsWidth || 320;
  let positionsCollapsed = state.prefs.ui?.positionsCollapsed === true;
  const dragCleanups = new Set();
  let quick = String(state.prefs.ui?.quickBuy || Math.min(100, Math.max(1, Math.round(ctx.start * ctx.solUsd / 10))));
  const panels = [];
  const root = el('div', { class: 'ph-root', 'aria-label': 'Phomo terminal' });
  const content = el('div', { class: 'ph-workspace', data: { layout } });
  const subHost = el('div', { class: 'ph-sub', hidden: true });
  const rail = el('nav', { class: 'ph-rail', 'aria-label': 'Discovery' });
  const railToggle = button('»', () => { if (subView || singlePerps()) detailNavOpen = !detailNavOpen; else railOpen = !railOpen; updateGeometry(); refreshNavigator(); saveUI(); },'ph-rail-toggle','Expand discovery panel');
  const navTabs = el('div',{class:'ph-nav-tabs'});
  for (const kind of ['alerts','watchlist','tokens','perps','leaderboard','feed']) {
    const [,label,ic] = TYPES.find(([k]) => k === kind);
    navTabs.append(button(['alerts','watchlist'].includes(kind) ? icon(ic) : label,() => {
      if (kind === 'perps') setMain(kind);
      else {
        // A single perps workspace owns the discovery host. Leave it before selecting a spot/social rail.
        if (singlePerps()) setMain('tokens');
        navigationKind = kind; railOpen = true; detailNavOpen = true; updateGeometry(); refreshNavigator(); saveUI();
      }
    },'ph-rail-button',label));
  }
  const navCategories = el('div',{class:'ph-nav-categories'});
  for (const [key,label] of [['trending','Trending'],['mostheld','Most held'],['graduated','Graduated'],['bonding','Bonding'],['bluechips','Blue chips']]) {
    navCategories.append(button(label,() => { navCategory = key; refreshNavigator(); },'',`${label} in discovery list`));
  }
  const navRows = el('div',{class:'ph-nav-rows','aria-label':'Discovery token list'});
  const navSocial = el('div',{class:'ph-nav-social',hidden:true,'aria-label':'Discovery activity panel'});
  const navExternal = el('div',{class:'ph-nav-external',hidden:true,'aria-label':'Perpetual market discovery'});
  const navFooter = el('div',{class:'ph-nav-footer'},button('Split bottom',() => { const p = panels[active] || panels[0]; if (p) split(p,'rows'); },'','Split discovery bottom'),button('Split right',() => { const p = panels[active] || panels[0]; if (p) split(p,'columns'); },'','Split discovery right'));
  rail.append(el('div',{class:'ph-nav-heading'},navTabs,railToggle),navCategories,navRows,navSocial,navExternal,navFooter);
  const watchstrip = el('div', { class: 'ph-watchstrip', 'aria-label': 'Watched tokens' });
  const balance = el('span');
  const worth = el('span');
  const notices = el('span', { class: 'ph-badge' });
  const searchIn = input('Search tokens, traders or contract address'); searchIn.type = 'search'; searchIn.placeholder = 'Search for tokens, perps or traders...';
  const found = el('div', { class: 'ph-search-results', hidden: true });
  const addressSearch = createAddressSearch(market, () => { if (!dead) search(); });
  const searchBox = el('form', { class: 'ph-search', role: 'search', on: { submit(e) { e.preventDefault(); search(); found.querySelector('.ph-search-row')?.click(); } } },
    icon('search'), searchIn, button('Paste', async () => { try { searchIn.value = (await navigator.clipboard.readText()).slice(0,160); search(); } catch { toast('Paste into the search field with your keyboard.'); searchIn.focus(); } }), el('kbd', {}, '/'), found);
  searchIn.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(search, 160); });
  searchIn.addEventListener('keydown', (e) => { if (e.key === 'Escape') { searchIn.value = ''; found.hidden = true; e.stopPropagation(); } if (e.key === 'ArrowDown') { e.preventDefault(); found.querySelector('.ph-search-row')?.focus(); } });
  const head = el('header', { class: 'ph-topbar' }, button([markEl('social', 'ph-logo'), wordEl('social', 'ph-word')], () => setMain('tokens'), 'ph-brand', 'Phomo home'),
    button('Discover', (e) => showPopover(e.currentTarget || e.target,'Discover',el('div',{class:'ph-menu-list'},TYPES.map(([kind,label,ic]) => button([icon(ic),label],() => { closePopover(); setMain(kind); })))), 'ph-discover'), searchBox,
    button([el('span',{class:'ph-cash-value'},balance,el('small',{},'cash')),el('small',{class:'ph-cash-note'},'Play balance')], showCash, 'ph-cash', 'Play cash balance'),
    button([el('span',{class:'ph-account-value'},worth,el('small',{},'Your portfolio')),el('span',{class:'ph-avatar'},(ctx.playerName?.() || 'P')[0])], () => showProfile('you'), 'ph-account', 'Your profile'),
    button([icon('bolt'), notices], () => setMain('alerts'), 'ph-icon ph-notifications', 'Notifications'),
    button(icon('sliders'), ctx.openSettings, 'ph-icon ph-settings', 'Game settings'));
  const positionList = el('div', { class: 'ph-position-list' });
  let closed = false, positionType = 'all';
  const positionTabs = el('div', { class: 'ph-tabs' });
  for (const [id, label] of [['all', 'All'], ['tokens', 'Tokens'], ['perps', 'Perps']]) positionTabs.append(button(label, () => { positionType = id; refreshPositions(); }, '', `${label} positions`));
  const openButton = button('Open', () => { closed = false; refreshPositions(); });
  const closedButton = button('Closed', () => { closed = true; refreshPositions(); });
  const positionsToggle = button('»',() => { positionsCollapsed = !positionsCollapsed; updateGeometry(); saveUI(); },'ph-icon','Collapse positions');
  const positions = el('aside', { class: 'ph-positions', 'aria-label': 'Your positions' }, el('div', { class: 'ph-panel-heading' }, el('h2', {}, 'Your positions'),positionsToggle),
    el('div',{class:'ph-position-toolbar'},el('div', { class: 'ph-segment' }, openButton, closedButton),positionTabs),positionList);
  const navSplitter = makeSplitter('Resize discovery panel','vertical',() => discoveryWidth,(n) => { discoveryWidth = Math.max(220,Math.min(420,n)); updateGeometry(); });
  navSplitter.classList.add('ph-nav-splitter');
  const positionsSplitter = makeSplitter('Resize positions panel','vertical',() => positionsWidth,(n) => { positionsWidth = Math.max(240,Math.min(480,n)); updateGeometry(); },-1);
  positionsSplitter.classList.add('ph-positions-splitter');
  const center = el('div', { class: 'ph-center' }, watchstrip, content, subHost);
  const body = el('div', { class: 'ph-body' }, rail,navSplitter,center,positionsSplitter,positions);
  const ticker = el('div', { class: 'ph-ticker' });
  const status = el('span', { class: 'ph-status' });
  const footer = el('footer', { class: 'ph-footer' }, ticker, status, button('Help', showHelp), button('Layouts', showLayouts));
  root.append(head, body, footer); host.append(root);
  updateGeometry();

  function saveUI() {
    state.setPrefs({ ui: { layout, quickBuy: parseAmount(quick) || 100, rail: railOpen, navigationKind, discoveryWidth, positionsWidth, positionsCollapsed, panelSizes: panels.map((p) => p.size || 0),
      panels: panels.map((p) => ({ ...p.options, kind: p.kind })) } });
  }
  function singlePerps() { return !subView && panels.length === 1 && panels[0].kind === 'perps' ? panels[0] : null; }
  function narrowScreen() { return globalThis.matchMedia?.('(max-width: 820px)')?.matches || (globalThis.innerWidth > 0 && globalThis.innerWidth <= 820); }
  function updateGeometry() {
    const perps = singlePerps(), expanded = subView || perps ? detailNavOpen : railOpen;
    for (const p of panels) p.setHosts?.(p === perps ? {discoveryHost:navExternal,positionsHost:positions} : {});
    if (!subView && !perps && positions.parentNode !== body) body.append(positions);
    flag(root,'is-rail-collapsed',!expanded); flag(root,'is-detail',Boolean(subView || perps)); flag(root,'is-perps',Boolean(perps)); flag(root,'is-positions-collapsed',positionsCollapsed);
    positions.hidden = subView?.kind === 'profile'; positionsSplitter.hidden = Boolean(subView || perps);
    const social = ['feed','alerts','leaderboard'].includes(navigationKind);
    watchstrip.hidden = Boolean(subView || perps); navRows.hidden = navCategories.hidden = Boolean(perps || social); navExternal.hidden = !perps; navSocial.hidden = Boolean(perps || !social);
    flag(positions,'is-collapsed',positionsCollapsed);
    root.style.setProperty('--ph-discovery-width',`${discoveryWidth}px`); root.style.setProperty('--ph-positions-width',`${positionsWidth}px`);
    setText(railToggle,expanded ? '«' : '»'); railToggle.setAttribute('aria-expanded',String(expanded)); railToggle.setAttribute('aria-label',`${expanded ? 'Collapse' : 'Expand'} discovery panel`);
    setText(positionsToggle,positionsCollapsed ? '«' : '»'); positionsToggle.setAttribute('aria-expanded',String(!positionsCollapsed)); positionsToggle.setAttribute('aria-label',`${positionsCollapsed ? 'Expand' : 'Collapse'} positions`);
  }
  function makeSplitter(label,orientation,read,write,sign = 1) {
    const handle = el('div',{class:'ph-splitter',role:'separator',tabIndex:0,'aria-label':label,'aria-orientation':orientation});
    handle.addEventListener('keydown',(e) => { const delta = {ArrowLeft:-12,ArrowRight:12,ArrowUp:-12,ArrowDown:12}[e.key]; if (!delta) return; e.preventDefault(); write(read()+delta*sign); saveUI(); });
    handle.addEventListener('pointerdown',(e) => {
      if (e.button !== undefined && e.button !== 0) return; e.preventDefault();
      const start = orientation === 'vertical' ? e.clientX : e.clientY, before = read();
      const move = (v) => write(before+((orientation === 'vertical' ? v.clientX : v.clientY)-start)*sign);
      const stop = () => { globalThis.removeEventListener?.('pointermove',move); globalThis.removeEventListener?.('pointerup',stop); globalThis.removeEventListener?.('pointercancel',stop); dragCleanups.delete(stop); saveUI(); };
      dragCleanups.add(stop); globalThis.addEventListener?.('pointermove',move); globalThis.addEventListener?.('pointerup',stop); globalThis.addEventListener?.('pointercancel',stop);
    });
    return handle;
  }
  function refreshNavigator() {
    [...navTabs.children].forEach((n,i) => { const on = ['alerts','watchlist','tokens','perps','leaderboard','feed'][i] === navigationKind; flag(n,'is-active',on); n.setAttribute('aria-pressed',String(on)); });
    if (scrolledNavigationKind !== navigationKind && !root.classList.contains('is-rail-collapsed')) {
      navTabs.querySelector('.is-active')?.scrollIntoView?.({block:'nearest',inline:'nearest'}); scrolledNavigationKind = navigationKind;
    }
    if (['feed','alerts','leaderboard'].includes(navigationKind)) {
      if (navigationViewKind !== navigationKind) { navigationView?.destroy(); navigationViewKind = navigationKind;
        navigationView = mountPhomoSocial(navSocial,ctx,{state,kind:navigationKind,onTrader:showProfile,onCoin:openCoin,onPosition:showPosition,quickAmount:() => parseAmount(quick),compact:true}); }
      if (!root.classList.contains('is-rail-collapsed')) navigationView.update();
      return;
    }
    if (navigationView) { navigationView.destroy(); navigationView = null; navigationViewKind = null; }
    if (root.classList.contains('is-rail-collapsed') || singlePerps()) return;
    const rows = state.tokens({category:navigationKind === 'watchlist' ? 'watchlist' : navCategory,window:'5m',limit:100,filters:{}}).rows;
    keyed(navRows,rows,(r) => r.id,(r) => {
      const name = el('b'),price = el('small'),cap = el('b'),change = el('small');
      const n = button([pic(r,'','ph'),el('span',{class:'ph-nav-identity'},name,price),el('span',{class:'ph-nav-values'},cap,change)],() => openCoin(r.id),'ph-nav-token',`Open discovery ${r.ticker}`);
      n._ph = {name,price,cap,change}; return n;
    },(n,r) => { setText(n._ph.name,r.ticker); setText(n._ph.price,fin(r.priceUsd) ? `$${priceWords(r.priceUsd,4)}` : '—'); n._ph.price.title = r.practicePrice ? 'Price per practice unit' : 'Practice token price'; setText(n._ph.cap,usd(r.marketCapUsd)); setText(n._ph.change,pct(r.change)); tint(n._ph.change,r.change); flag(n,'is-active',r.id === selectedCoin); n.setAttribute('aria-pressed',String(r.id === selectedCoin)); });
    if (!rows.length) navRows.replaceChildren(waitingForRealCoins(market) ? empty('Waiting for real coin listings','New listings will appear when the coin feed connects.') : empty('No tokens here','Change category or star a token to add it to your watchlist.'));
    [...navCategories.children].forEach((n,i) => flag(n,'is-active',['trending','mostheld','graduated','bonding','bluechips'][i] === navCategory));
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
    const ids = market.find(q).slice(0,20); const people = state.traders({ query: q }).slice(0,20);
    const tabs = el('div',{class:'ph-search-tabs'},...['tokens','traders'].map((k) => button(k === 'tokens' ? `Tokens (${ids.length})` : `Traders (${people.length})`,() => { searchTab = k; search(); },searchTab === k ? 'is-active' : '',`Search ${k}`)));
    found.append(tabs);
    if (searchTab === 'tokens') {
      found.append(el('div',{class:'ph-search-columns'},el('span',{},'Token'),el('span',{},'Market cap'),el('span',{},'5m change')));
      for (const id of ids) {
        const r = tokenMetrics(market,id,{solUsd:ctx.solUsd,window:'5m'}); if (!r) continue;
        const change = el('span',{class:'ph-search-change'},pct(r.change)); tint(change,r.change);
        const n = button([el('span',{class:'ph-search-identity'},pic(r,'','ph'),el('span',{},el('b',{},r.ticker),el('small',{},`${r.name} · ${r.live ? chainById(r.chain)?.name || chain : 'Simulated'}`))),el('span',{},usd(r.marketCapUsd)),change],() => { openCoin(id); searchIn.value = ''; found.hidden = true; },'ph-search-row',`Open ${r.ticker}`);
        found.append(n);
      }
    } else {
      found.append(el('div',{class:'ph-search-columns'},el('span',{},'Simulated trader'),el('span',{},'Profit'),el('span',{},'Win rate')));
      for (const p of people) found.append(button([el('span',{class:'ph-search-identity'},el('span',{class:'ph-avatar'},p.name[0]),el('span',{},el('b',{},p.name),el('small',{},p.simulated === false ? 'Real KOL · Kolscan' : 'Simulated trader'))),el('span',{},signed(p.pnlUsd,'usd')),el('span',{},pct(p.winRate))],() => { showProfile(p.key); searchIn.value = ''; found.hidden = true; },'ph-search-row',`Open trader ${p.name}`));
    }
    const note = addressSearch(q, ids.length > 0);
    if (searchTab === 'tokens' ? !ids.length : !people.length) found.append(el('p', {}, searchTab === 'tokens' ? note || 'No matching tokens in this market.' : 'No matching simulated traders.'));
    found.append(el('div',{class:'ph-search-foot'},'↑ ↓ Browse results',el('span',{},'Enter to open · Esc to close')));
    const resultRows = [...found.querySelectorAll('.ph-search-row')];
    resultRows.forEach((n,i) => n.addEventListener('keydown',(e) => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); resultRows[(i+(e.key === 'ArrowDown' ? 1 : resultRows.length-1))%resultRows.length]?.focus(); } if (e.key === 'Escape') { e.stopPropagation(); found.hidden = true; searchIn.focus(); } }));
  }
  function makePanel(kind = 'tokens', options = {}) {
    const p = { id: ++sequence, kind, options: { category: 'trending', window: '5m', limit: 25, direction: 'desc', filters: {}, ...options }, update: null, dispose: null };
    p.el = el('section', { class: 'ph-panel', 'aria-label': `${TYPES.find(([k]) => k === kind)?.[1] || 'Tokens'} panel`, on: { pointerdown: () => { active = panels.indexOf(p); } } });
    p.toolbar = el('div', { class: 'ph-panel-tools' });
    p.select = button(TYPES.find(([k]) => k === kind)?.[1] || 'Tokens',() => {
      showPopover(p.select,'Panel content',el('div',{class:'ph-menu-list'},TYPES.map(([k,label,ic]) => button([icon(ic),label],() => { p.kind = k; closePopover(); renderPanel(p); saveUI(); },p.kind === k ? 'is-active' : ''))));
    },'ph-panel-title','Panel content');
    const menu = button('⋯',() => showPopover(menu,'Panel options',el('div',{class:'ph-menu-list'},button('Split right',() => { closePopover(); split(p,'columns'); }),button('Split bottom',() => { closePopover(); split(p,'rows'); }),button('Close panel',() => { closePopover(); removePanel(p); }))), 'ph-icon','Panel options');
    const hiddenIcon = icon('info'); hiddenIcon.firstChild.setAttribute('d','M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0M3 3l18 18');
    const hidden = button(hiddenIcon,() => showHiddenTokens(),'ph-icon ph-hidden-tokens','Hidden tokens');
    p.toolbar.append(p.select,hidden,menu,button('⊞', () => split(p, 'columns'), 'ph-icon', 'Split right'), button('⊟', () => split(p, 'rows'), 'ph-icon ph-split-bottom', 'Split bottom'),button('×', () => removePanel(p), 'ph-icon ph-close-panel', 'Close panel'));
    p.host = el('div', { class: 'ph-panel-content' }); p.el.append(p.toolbar, p.host); panels.push(p); content.append(p.el); renderPanel(p); rebuildSplitters(); return p;
  }
  function split(p, direction) {
    if (panels.length >= 4) return toast('Four panels are open. Close a panel to make room.');
    closeSub(); layout = direction; content.dataset.layout = layout; panels.forEach((n) => { n.size = 0; n.el.style.setProperty('flex-basis',''); n.el.style.setProperty('flex-grow','1'); }); makePanel(p.kind, { ...p.options, filters: { ...p.options.filters } }); saveUI();
  }
  function rebuildSplitters() {
    for (const n of [...content.children]) if (n.classList.contains('ph-splitter')) n.remove();
    panels.forEach((p,i) => { if (!i) return; const before = panels[i-1]; const orientation = layout === 'rows' ? 'horizontal' : 'vertical';
      const handle = makeSplitter('Resize workspace panels',orientation,() => before.size || (layout === 'rows' ? before.el.getBoundingClientRect?.().height : before.el.getBoundingClientRect?.().width) || 300,(n) => { before.size = Math.max(220,Math.min(1800,n)); before.el.style.setProperty('flex-basis',`${before.size}px`); before.el.style.setProperty('flex-grow','0'); });
      handle.classList.add('ph-panel-splitter'); content.insertBefore(handle,p.el);
    });
    updateGeometry();
  }
  function removePanel(p) { if (panels.length === 1) return toast('Keep at least one discovery panel open.'); p.dispose?.(); p.el.remove(); panels.splice(panels.indexOf(p),1); active = 0; rebuildSplitters(); saveUI(); }
  function setMain(kind) { closeSub(); navigationKind = kind; if (kind === 'perps' && narrowScreen()) detailNavOpen = false; const p = panels[Math.min(active,panels.length - 1)]; if (p) { p.kind = kind; renderPanel(p); updateGeometry(); saveUI(); refreshNavigator(); } }
  function renderPanel(p) {
    p.dispose?.(); p.dispose = null; p.update = null; p.setActive = null; p.setHosts = null; p.host.replaceChildren(); p.host.classList.remove('ph-token-panel'); setText(p.select,TYPES.find(([k]) => k === p.kind)?.[1] || 'Tokens');
    p.el.setAttribute('aria-label', `${TYPES.find(([k]) => k === p.kind)?.[1] || 'Tokens'} panel`);
    if (p.kind === 'tokens' || p.kind === 'watchlist') renderTokens(p);
    else if (['feed','leaderboard','alerts'].includes(p.kind)) {
      const v = mountPhomoSocial(p.host,ctx,{state,kind:p.kind,onTrader:showProfile,onCoin:openCoin,onPosition:showPosition,quickAmount:() => parseAmount(quick)});
      p.update = v.update; p.dispose = v.destroy;
    }
    else if (p.kind === 'perps') {
      const loading = empty('Loading markets', 'Connecting to the read-only market feed…'); p.host.append(loading);
      let cancelled = false; p.dispose = () => { cancelled = true; };
      import('./phomo-perps.js').then(({ mountPhomoPerps }) => { if (dead || cancelled) return; p.host.replaceChildren(); const v = mountPhomoPerps(p.host,{...ctx,openPaperCash:showCash}); p.update = v.update; p.setActive = v.setActive; p.setHosts = v.setHosts; if (subView) v.setActive(false); p.dispose = () => { cancelled = true; v.destroy(); }; updateGeometry(); }, () => { if (!cancelled) loading.replaceWith(empty('Markets unavailable', 'Reopen Perps to try again.')); });
    }
    else if (p.kind === 'clans') {
      const loading = empty('Loading clans','Opening the game’s simulated communities…'); p.host.append(loading);
      let cancelled = false; p.dispose = () => { cancelled = true; };
      import('./phomo-clans.js').then(({ mountPhomoClans }) => { if (dead || cancelled) return; p.host.replaceChildren(); const v = mountPhomoClans(p.host,ctx,{state,onTrader:showProfile,onCoin:openCoin,onClose:() => setMain('tokens')}); p.update = v.update; p.dispose = () => { cancelled = true; v.destroy(); }; }, () => { if (!cancelled) loading.replaceWith(empty('Clans unavailable','Reopen Clans to try again.')); });
    }
    p.update?.(performance.now()); updateGeometry();
  }
  function renderTokens(p) {
    p.host.classList.add('ph-token-panel');
    const tabs = el('div', { class: 'ph-tabs ph-categories' });
    for (const [key,label] of PHOMO_CATEGORIES) { const selected = key === (p.kind === 'watchlist' ? 'watchlist' : p.options.category);
      const tab = button(label, () => { p.options.category = key; p.options.sort = key === 'mostheld' ? 'holders' : key === 'bluechips' ? 'marketCap' : 'volume'; p.kind = key === 'watchlist' ? 'watchlist' : 'tokens'; renderPanel(p); saveUI(); }, selected ? 'is-active' : '');
      tab.setAttribute('aria-pressed',String(selected)); tabs.append(tab);
    }
    const count = el('span', { class: 'ph-count' });
    const qb = input('Quick-buy dollars', quick, 'number'); qb.min = '0.01'; qb.step = 'any';
    qb.addEventListener('change', () => { quick = qb.value; saveUI(); });
    const filters = button([icon('sliders'), 'Filters'], () => tokenFilters(p), 'ph-all-filters');
    const filterShortcuts = [['Market cap','minMarketCap','maxMarketCap'],['Liquidity','minLiquidity',null],['Age',null,'maxAge'],['Volume','minVolume',null]].map(([label,min,max]) => {
      const b = button(`${label} ⌄`,() => tokenFilterPopover(p,b,label,min,max),'ph-filter-short'); return b;
    });
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
    const filterSelect = (n,title) => {
      n.hidden = true;
      const b = button(`${title} ⌄`,() => showPopover(b,title,el('div',{class:'ph-menu-list'},[...n.children].map((o) => {
        const value = o.getAttribute('value'); return button(o.textContent,() => { n.value = value; n.dispatchEvent?.(new Event('change',{bubbles:true})); closePopover(); },n.value === value ? 'is-active' : '');
      }))),'ph-filter-short',`Filter by ${title.toLowerCase()}`);
      n._phButton = b;
      return el('span',{class:'ph-filter-select'},n,b);
    };
    const controls = el('div', { class: 'ph-controls' }, count,rowCount,win,windows,filterShortcuts,filterSelect(network,'Network'),filterSelect(launchpad,'Launchpad'),filters);
    const list = el('tbody');
    const headers = [['Token name',null],['Market cap','marketCap'],['Age','age'],['Change','change'],['Volume','volume'],['Holders','holders'],['Latest thesis',null]];
    const table = el('table', { class: 'ph-table ph-token-table' }, el('thead', {}, el('tr', {}, headers.map(([label,key]) => el('th', {}, key ? button(label, () => { p.options.direction = p.options.sort === key && p.options.direction === 'desc' ? 'asc' : 'desc'; p.options.sort = key; p.update(); saveUI(); }) : label)))),list);
    table.style.setProperty('--ph-token-name-width',`${p.options.tokenNameWidth || 300}px`);
    const nameResize = makeSplitter('Resize token name column','vertical',() => p.options.tokenNameWidth || 300,(n) => { p.options.tokenNameWidth = Math.max(220,Math.min(420,n)); table.style.setProperty('--ph-token-name-width',`${p.options.tokenNameWidth}px`); });
    nameResize.classList.add('ph-name-splitter'); table.querySelectorAll('th')[0].append(nameResize);
    table.querySelectorAll('th')[0].append(el('label',{class:'ph-quick'},'Quick buy',el('span',{},'$'),qb));
    const blank = empty('No matching tokens', 'Try another category or reset the filters.');
    p.host.append(tabs,controls,el('div',{class:'ph-table-scroll'},table,blank));
    let sourceSize = -1, sourceView = '', sourceAt = -Infinity;
    p.update = () => {
      const size = market.size?.coins, shown = JSON.stringify(market.ext?.shown), now = market.t;
      const nextSources = size !== sourceSize || shown !== sourceView || now-sourceAt >= 5 || now<sourceAt ? sourceOptions() : sources;
      if(nextSources!==sources){sourceSize=size;sourceView=shown;sourceAt=now;}
      if (nextSources.length !== sources.length || nextSources.some((s,i) => s !== sources[i])) {
        sources = nextSources;
        const selected = p.options.launchpad || 'all';
        launchpad.replaceChildren(...[['all','All launchpads'],...sources.map((s) => [s,s])].map(([value,label]) => el('option',{value},label)));
        launchpad.value = selected === 'all' || sources.includes(selected) ? selected : 'all';
        if (launchpad.value !== selected) { p.options.launchpad = launchpad.value; saveUI(); }
      }
      const result = state.tokens({ ...p.options,category:p.kind === 'watchlist' ? 'watchlist' : p.options.category });
      setText(count,`${result.total} tokens`); blank.hidden = result.rows.length > 0; table.hidden = !result.rows.length;
      setText(blank.querySelector('strong'), waitingForRealCoins(market) ? 'Waiting for real coin listings' : 'No matching tokens');
      setText(blank.querySelector('p'), waitingForRealCoins(market) ? 'New listings will appear when the coin feed connects.' : 'Try another category or reset the filters.');
      for (const n of [network,launchpad]) flag(n._phButton,'is-active',n.value !== 'all');
      [...windows.children].forEach((b,i) => { flag(b,'is-active',PHOMO_WINDOWS[i] === p.options.window); b.setAttribute('aria-pressed',String(PHOMO_WINDOWS[i] === p.options.window)); });
      const heads = table.querySelectorAll('th'); setText(heads[3].firstChild,`${p.options.window} change`); setText(heads[4].firstChild,`${p.options.window} volume`);
      heads.forEach((h,i) => { if (headers[i][1]) h.setAttribute('aria-sort',headers[i][1] === p.options.sort ? (p.options.direction === 'asc' ? 'ascending' : 'descending') : 'none'); });
      filters.classList.toggle('is-active',Object.keys(p.options.filters).length > 0);
      const notes = state.notes();
      keyed(list,result.rows,(r) => r.id,(r) => {
        const star = button('☆',() => { state.toggleWatch(r.id); refresh(); },'ph-star',`Watch ${r.ticker}`);
        const source = el('span',{class:'ph-chain-tag'},r.live ? chainById(r.chain)?.name?.[0] || 'L' : 'S');
        source.title = r.live ? chainById(r.chain)?.name || chain : 'Simulated token';
        const name = button([pic(r,'','ph'),el('span',{},el('b',{},r.ticker,source),el('small',{},r.name))],() => openCoin(r.id),'ph-token-name',`Open ${r.ticker}`);
        const copy = button('▣',() => copyContract(r.id),'ph-row-action',`Copy ${r.ticker} contract`);
        const searchCoin = button(icon('search'),() => { searchIn.value = r.ticker; searchTab = 'tokens'; search(); searchIn.focus(); },'ph-row-action',`Search ${r.ticker}`);
        const more = button('⋯',() => showPopover(more,r.ticker,el('div',{class:'ph-menu-list'},button('Open token',() => { closePopover(); openCoin(r.id); }),button('Copy contract',() => { closePopover(); copyContract(r.id); }),button('Hide token',() => { state.toggleHide(r.id); closePopover(); refresh(); }),button('Token details',() => { closePopover(); tokenDetails(r.id); }))), 'ph-row-action',`More actions for ${r.ticker}`);
        const meta = el('span',{class:'ph-token-actions'},copy,searchCoin,more);
        const buy = button('',() => quickBuy(r.id),'ph-quickbuy',`Quick buy ${r.ticker}`);
        const cells = Array.from({length:5},() => el('td'));
        const holders = el('b'),holderNote=el('small',{class:'ph-cell-secondary'});cells[4].append(holders,holderNote);
        const thesis = el('td',{class:'ph-thesis-cell'});
        const tr = el('tr',{},el('td',{},el('div',{class:'ph-token-cell'},star,el('div',{class:'ph-token-main'},name,meta),buy)),cells,thesis);
        tr._ph = {star,name,meta,buy,cells,holders,holderNote,thesis,noteId:null}; return tr;
      },(tr,r) => {
        const n = tr._ph; setText(n.star,state.isWatched(r.id) ? '★' : '☆'); n.star.setAttribute('aria-pressed',String(state.isWatched(r.id)));
        n.name.title = `${r.name} · ${fin(r.age) ? age(r.age) : 'Age unavailable'} · ${r.live ? chain : 'Simulated'}${r.phase === 'pool' ? ' · Graduated' : ''}`;
        const old = n.name.querySelector('.ph-pic'); if (!samePic(old,r)) old?.replaceWith(pic(r,'','ph'));
        setText(n.buy,`Buy ${usd(parseAmount(quick))}`); setText(n.cells[0],usd(r.marketCapUsd)); setText(n.cells[1],age(r.age)); setText(n.cells[2],pct(r.change)); tint(n.cells[2],r.change); setText(n.cells[3],usd(r.volumeUsd));
        setText(n.holders,fin(r.holders) ? compact(r.holders,0) : '—');setText(n.holderNote,fin(r.holders) ? 'total holders' : 'not available');
        const note = notes.find((v) => v.coin === r.id);
        if ((note?.id || null) !== n.noteId || !n.thesis.firstChild) {
          n.noteId = note?.id || null;
          n.thesis.replaceChildren(note ? el('div',{class:'ph-thesis-preview'},el('span',{class:'ph-avatar'},(ctx.playerName?.() || 'P')[0]),el('span',{},el('b',{},ctx.playerName?.() || 'You'),el('small',{},note.text))) : el('span',{},'—'));
        }
      });
    };
  }
  async function copyContract(id) {
    const address = market.info?.(id)?.mint;
    if (!address) return toast('No contract address is available.');
    try { await navigator.clipboard.writeText(address); toast('Contract copied.'); }
    catch { const field = input('Contract address',address); field.readOnly = true; showDialog('Contract address',el('div',{class:'ph-form'},field)); field.focus(); field.select?.(); }
  }
  function showHiddenTokens() {
    const count = state.prefs.hidden.length;
    showDialog('Hidden tokens',el('div',{class:'ph-form'},el('p',{},count ? `${count} token${count === 1 ? ' is' : 's are'} hidden from discovery.` : 'No tokens are hidden. Use a token’s more menu to hide it from your discovery lists.'),
      button('Restore hidden tokens',() => { state.restoreHidden(); closeDialog(); refresh(); })));
  }
  function tokenDetails(id) {
    const r = tokenMetrics(market,id,{solUsd:ctx.solUsd,window:'5m'}); if (!r) return;
    showDialog(`${r.ticker} details`,el('div',{class:'ph-form'},stat('Name',r.name),stat('Network',r.live ? chainById(r.chain)?.name || chain : 'Simulated'),stat('Source',r.src || 'Not available'),stat('Age',fin(r.age) ? age(r.age) : 'Not available'),stat('Liquidity',usd(r.liquidityUsd)),button('Copy contract',() => copyContract(id)),button('Open token',() => { closeDialog(); openCoin(id); })));
  }
  function tokenFilterPopover(p,anchor,title,minKey,maxKey) {
    const fields = [];
    const body = el('form',{class:'ph-filter-form'});
    const presets = title === 'Market cap' ? [['All',null,null],['< $100K',null,100000],['< $500K',null,500000],['< $1M',null,1000000]]
      : title === 'Age' ? [['All',null,null],['< 1 hour',null,3600],['< 1 day',null,86400],['< 1 week',null,604800]]
        : [['All',null,null],['> $10K',10000,null],['> $100K',100000,null],['> $1M',1000000,null]];
    const apply = () => { for (const [k,n] of fields) { if (n.value.trim() && fin(Number(n.value)) && Number(n.value) >= 0) p.options.filters[k] = Number(n.value); else delete p.options.filters[k]; } p.update(); saveUI(); flag(anchor,'is-active',fields.some(([k]) => fin(p.options.filters[k]))); };
    body.append(el('div',{class:'ph-filter-presets'},presets.map(([label,min,max]) => button(label,() => {
      for (const [k,n] of fields) n.value = k === minKey && min !== null ? String(min) : k === maxKey && max !== null ? String(max) : '';
      apply();
    }))));
    for (const [label,key] of [['Minimum',minKey],['Maximum',maxKey]]) if (key) {
      const n = input(`${label} ${title.toLowerCase()}`,fin(p.options.filters[key]) ? p.options.filters[key] : '','number'); n.min = '0'; n.step = 'any';
      n.addEventListener('input',apply);
      fields.push([key,n]); body.append(el('label',{},`${label}${title === 'Age' ? ' (seconds)' : ' ($)'}`,n));
    }
    body.append(el('div',{class:'ph-actions'},button('Reset',() => { for (const [,n] of fields) n.value = ''; apply(); }),button('Done',closePopover)));
    body.addEventListener('submit',(e) => { e.preventDefault(); apply(); closePopover(); });
    showPopover(anchor,title,body);
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
  function refreshPositions() {
    flag(openButton,'is-active',!closed); flag(closedButton,'is-active',closed);
    [...positionTabs.children].forEach((b,i) => flag(b,'is-active',['all','tokens','perps'][i] === positionType));
    const paper = ctx.paperPerps?.snapshot();
    const rows = positionType === 'perps' ? [] : market.positions().filter((p) => closed ? !p.open : p.open);
    if (positionType !== 'tokens' && paper) {
      const source = closed ? paper.fills.filter(f => f.type !== 'open') : paper.positions;
      rows.push(...source.map(p => ({ id:`paper-${closed ? 'fill' : 'position'}-${p.id}`, paper:true, ticker:`${p.coin} · paper ${closed ? 'close' : p.side}`,
        value:(p.equity || 0)/ctx.solUsd, sold:(p.returned || 0)/ctx.solUsd, open:!closed,
        total:(closed ? p.realized : p.realized + p.unrealized)/ctx.solUsd,
        pnlPct:(closed ? p.realized / Math.max(1e-12,p.returned - p.realized) : (p.realized + p.unrealized)/p.invested) })));
    }
    keyed(positionList,rows,(p) => p.id,(p) => { const view = () => p.paper ? setMain('perps') : openCoin(p.id); const title = button([p.paper ? el('span',{},'↕') : pic(p,'','ph'),el('b',{},p.ticker)],view,'ph-position-name'); const value = el('strong'); const profit = el('span'); const share = p.paper ? null : button(icon('share'),() => sharePosition(p.id),'ph-icon','Share position card'); const tr = el('article',{class:'ph-position'},title,el('div',{class:'ph-position-values'},value,profit),el('div',{class:'ph-actions'},button('View',() => p.paper ? setMain('perps') : showPosition({coin:p.id,traderKey:'you'})),share)); tr._ph = {value,profit}; return tr; },(tr,p) => { setText(tr._ph.value,usdFull((p.open ? p.value : p.sold) * ctx.solUsd)); setText(tr._ph.profit,`${signed(p.total * ctx.solUsd,'usd')} (${pct(p.pnlPct)})`); tint(tr._ph.profit,p.total); });
    if (!rows.length) positionList.replaceChildren(empty(`No ${closed ? 'closed' : 'open'} positions`,positionType === 'perps' ? 'Paper perpetual positions share your play cash. Open Perps to place a free-play order.' : closed ? 'Finished practice trades appear here.' : 'Open a token or use quick buy to begin.'));
  }
  function sharePosition(id) {
    const p = market.positions().find((x) => x.id === id); if (!p) return;
    const words = positionCardWords(p,{live:Boolean(market.row(id)?.live),currency:'usd',solUsd:ctx.solUsd,name:ctx.playerName?.(),terminal:'social'});
    ctx.saveCard?.(words,`${words.title} · ${words.big} · Phomo practice trading. ${SAFETY_NOTE}`);
  }
  function beginSub(kind) {
    closePopover(); found.hidden = true;
    if (narrowScreen()) detailNavOpen = false;
    if (!subView) ctx.pushSub?.(); else subView.view?.destroy();
    if (positions.parentNode !== body) body.append(positions);
    ctx.onCoin?.(null); subView = {kind,view:null}; panels.forEach((p) => p.setActive?.(false));
    content.hidden = true; watchstrip.hidden = true; subHost.hidden = false; subHost.replaceChildren(); positionsSplitter.hidden = kind === 'coin';
    updateGeometry(); refreshNavigator();
  }
  function closeSub(pop = true) {
    if (!subView) return;
    subView.view?.destroy(); subView = null; selectedCoin = null; ctx.onCoin?.(null);
    if (positions.parentNode !== body) body.append(positions);
    subHost.replaceChildren(); subHost.hidden = true; watchstrip.hidden = false; content.hidden = false; positionsSplitter.hidden = false;
    panels.forEach((p) => p.setActive?.(true)); updateGeometry(); refreshNavigator(); if (pop) ctx.popSub?.();
  }
  function openCoin(id,options = {}) {
    if (!market.row(id)) return;
    selectedCoin = id; beginSub('coin'); ctx.onCoin?.(id);
    subView.view = mountPhomoCoin(subHost,ctx,id,{state,onTrader:showProfile,onClose:() => closeSub(),positionsHost:positions,initialSide:options.side});
    refreshNavigator();
  }
  function showProfile(key) {
    if (!state.profile(key)) return toast('That trader is unavailable.');
    selectedCoin = null; beginSub('profile');
    subView.view = mountPhomoProfile(subHost,ctx,key,{state,onTrader:showProfile,onCoin:openCoin,onPosition:showPosition,onClose:() => closeSub(),onShare:(p) => sharePosition(p.id)});
  }
  function showPosition(selection) {
    if (!Number.isInteger(selection?.coin)) return;
    closePopover(); closeDialog();
    const previous = document.activeElement, box = el('section',{class:'ph-position-modal',role:'dialog','aria-modal':'true','aria-label':'Practice position',tabIndex:-1});
    const cover = el('div',{class:'ph-dialog',on:{click(e) { if (e.target === cover) closeDialog(); },keydown(e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeDialog(); } if (e.key === 'Tab') { const items = [...box.querySelectorAll('button,input,select,textarea')].filter((n) => !n.disabled && !n.hidden); const first = items[0],last = items.at(-1); if (e.shiftKey && (document.activeElement === first || document.activeElement === box)) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); } } }}},box);
    dialog = {node:cover,previous,view:null}; root.append(cover);
    dialog.view = mountPhomoPosition(box,ctx,selection,{state,onTrader:(key) => { closeDialog(); showProfile(key); },onCoin:(id,options) => { closeDialog(); openCoin(id,options); },onClose:closeDialog,onShare:(p) => sharePosition(p.id)});
    box.focus();
  }
  function showCash() { const paper = ctx.paperPerps?.snapshot(); showDialog('Your play cash',el('div',{class:'ph-form'},stat('Available',usdFull(market.player.sol * ctx.solUsd)),stat('Portfolio',usdFull(market.netWorth() * ctx.solUsd)),paper ? stat('Paper perpetual equity',usdFull(paper.equity)) : null,el('p',{},'Spot and paper perpetual orders share this run’s available play cash. Sell a spot position, close a perpetual position or cancel an unfilled order to free cash. There is no second account to fund.'),el('p',{class:'ph-muted'},SAFETY_NOTE))); }
  function showLayouts() { showDialog('Workspace layout',el('div',{class:'ph-form'},el('p',{},'Open up to four panels. Each keeps its own category and filters. Drag the dividers between panels to resize them.'),button('Columns',() => { layout = 'columns'; content.dataset.layout = layout; rebuildSplitters(); saveUI(); closeDialog(); }),button('Rows',() => { layout = 'rows'; content.dataset.layout = layout; rebuildSplitters(); saveUI(); closeDialog(); }),button('Reset workspace',() => { panels.forEach((p) => { p.dispose?.(); p.el.remove(); }); panels.length = 0; layout = 'columns'; content.dataset.layout = layout; makePanel(); saveUI(); closeDialog(); })) ); }
  function showHelp() { showDialog('Phomo guide',el('div',{class:'ph-form'},el('p',{},'Search by token name, ticker or contract address. In Live mode, address search can find supported markets beyond the discovery list.'),el('p',{},'Use stars to build a watchlist, filters to narrow the table and split buttons to compare panels. Copy buttons place a single practice trade using your quick-buy amount.'),el('p',{},market.live ? 'Live traders are public Kolscan profiles and source rankings. Real trade activity is unavailable. Follows and notes stay on this device. Unknown source metrics are shown as —.' : 'Trader characters are simulated. Theses, follows and likes stay on this device. Price alerts run while the game is open. Unknown metrics are shown as —.'),el('p',{},'Perpetual orders use shared play cash in free play: Market, Limit and TWAP with isolated leverage and TP/SL. Fills use fresh observed public marks; no funding payments or real execution. Spot positions use the game’s fees and slippage.'),el('p',{},SAFETY_NOTE))); }
  function showDialog(title,node) {
    closePopover(); closeDialog(); const previous = document.activeElement; const close = button('×',closeDialog,'ph-icon','Close dialog');
    const box = el('section',{class:'ph-dialog-box',role:'dialog','aria-modal':'true','aria-label':title},el('div',{class:'ph-panel-heading'},el('h2',{},title),close),node);
    const cover = el('div',{class:'ph-dialog',on:{click(e) { if (e.target === cover) closeDialog(); },keydown(e) { if (e.key === 'Escape') { e.stopPropagation(); closeDialog(); } if (e.key === 'Tab') { const items = [...box.querySelectorAll('button,input,select,textarea')].filter((n) => !n.disabled); const first = items[0],last = items.at(-1); if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); } } }}},box);
    dialog = {node:cover,previous}; root.append(cover); close.focus();
  }
  function closeDialog() { if (!dialog) return; const old = dialog; dialog = null; old.view?.destroy(); old.node.remove(); if (old.previous?.isConnected) old.previous.focus(); }
  function showPopover(anchor,title,node) {
    closePopover();
    const box = el('section',{class:'ph-popover',role:'dialog','aria-label':title},el('div',{class:'ph-popover-heading'},el('b',{},title),button('×',closePopover,'ph-icon','Close menu')),node);
    const layer = el('div',{class:'ph-popover-layer',on:{pointerdown(e) { if (e.target === layer) closePopover(); },keydown(e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePopover(); } }}},box);
    const r = anchor.getBoundingClientRect?.() || {left:12,bottom:100};
    const viewport = globalThis.innerWidth || 1280, height = globalThis.innerHeight || 720;
    box.style.setProperty('left',`${Math.max(8,Math.min(viewport-288,r.left))}px`);
    box.style.setProperty('top',`${Math.min(height-120,r.bottom+6)}px`);
    box.style.setProperty('max-height',`${Math.max(100,height-r.bottom-18)}px`);
    popover = {node:layer,previous:anchor}; root.append(layer); box.querySelector('input,button')?.focus();
  }
  function closePopover() { if (!popover) return; const old = popover; popover = null; old.node.remove(); if (old.previous?.isConnected) old.previous.focus(); }
  function responsiveGeometry() {
    const narrow = narrowScreen();
    if (narrow && !wasNarrow) { railOpen = false; detailNavOpen = false; updateGeometry(); }
    wasNarrow = narrow;
  }
  function refresh(skipCovered = false) {
    responsiveGeometry();
    // A modal fully covers the workspace. Keep its live position current without repainting
    // the token chart or discovery panels beneath it; state.tick() still handles alert rules.
    if (skipCovered && dialog) { dialog.view?.update?.(performance.now()); return; }
    setText(balance,usdFull(market.player.sol * ctx.solUsd)); setText(worth,usd(market.netWorth() * ctx.solUsd));
    const news = state.notifications({unreadOnly:true}); setText(notices,news.length ? String(news.length) : '');
    refreshPositions();
    const watched = watchstrip.hidden ? [] : state.tokens({category:'watchlist',window:'5m',limit:25,filters:{}}).rows;
    if(!watchstrip.hidden){
    keyed(watchstrip,watched,(r) => r.id,(r) => {
      const cap = el('span'), change = el('span');
      const b = button([el('span',{class:'ph-watch-name'},pic(r,'','ph'),el('b',{},r.ticker),el('span',{},'★')),el('span',{class:'ph-watch-values'},cap,change)],() => openCoin(r.id),'ph-watch-chip',`Open watched ${r.ticker}`);
      b._ph = {cap,change}; return b;
    },(b,r) => { setText(b._ph.cap,`${usd(r.marketCapUsd)} MC`); setText(b._ph.change,pct(r.change)); tint(b._ph.change,r.change); });
    if (!watched.length) watchstrip.replaceChildren(el('span',{class:'ph-muted'},'☆ Star tokens to pin them here'));
    }
    const quotes = ctx.spotPrices?.() || {};
    const assets = [['btc','BTC'],['eth','ETH'],['sol','SOL'],['hype','HYPE']];
    keyed(ticker,assets,([key]) => key,() => el('span',{class:'ph-spot-quote'}),(n,[key,symbol]) => {
      const quote = quotes[key], known = fin(quote) && quote > 0;
      setText(n,`${symbol} ${known ? usdFull(quote) : '—'}`);
      n.title = known ? `${symbol} public spot quote in US dollars${ctx.spotPricesStatus?.() === 'live' ? '' : ' · last available quote'}` : `${symbol} spot quote is not available from the current public feed`;
    });
    const liveState = market.liveState?.();
    if (ctx.chain) {
      const words = feedWords(liveState?.feed,liveState?.chainState,ctx.chain,'run');
      const label = words.tone === 'live' ? 'Coin feed live' : ['connecting','idle'].includes(liveState?.feed) ? 'Connecting'
        : liveState?.feed === 'full' ? 'Feed full' : liveState?.feed !== 'live' ? 'Reconnecting'
          : liveState?.chainState === 'quiet' ? 'Quiet coin feed' : 'Feed unavailable';
      setText(status,`● ${label} · ${chain} · simulated prices/volume`); status.title = words.text;
      flag(status,'is-down',words.tone !== 'live');
    } else { setText(status,'● Simulated · play money'); status.title = 'Simulated market · practice money'; flag(status,'is-down',false); }
    refreshNavigator();
    if (!subView) for (const p of panels) p.update?.(performance.now()); subView?.view?.update?.(performance.now());
  }
  function keydown(e) {
    if (e.target.closest?.('input,textarea,select,[contenteditable="true"]')) return;
    if (e.key === '/') { e.preventDefault(); searchIn.focus(); }
    if (e.key === 'Escape' && popover) { e.preventDefault(); closePopover(); return; }
    if (e.key === 'Escape' && !dialog) { found.hidden = true; if (subView) { e.preventDefault(); e.stopPropagation(); closeSub(); } }
  }
  root.addEventListener('keydown',keydown);
  globalThis.addEventListener?.('resize',responsiveGeometry);
  const saved = state.prefs.ui?.panels;
  if (saved?.length) for (const p of saved) makePanel(TYPES.some(([k]) => k === p.kind) ? p.kind : 'tokens',p);
  else makePanel();
  navigationKind = state.prefs.ui?.navigationKind || (panels[0]?.kind === 'perps' ? 'perps' : 'tokens');
  const sizes = state.prefs.ui?.panelSizes || [];
  panels.forEach((p,i) => { if (sizes[i] > 0) { p.size = sizes[i]; p.el.style.setProperty('flex-basis',`${p.size}px`); p.el.style.setProperty('flex-grow','0'); } });
  refresh();
  return { el: root, update(now) { if (dead || now - last < 650) return; last = now; state.tick(); refresh(true); },
    sub: () => Boolean(subView), closeSub: () => closeSub(false), openCoin,
    destroy() { dead = true; clearTimeout(searchTimer); closePopover(); closeDialog(); for (const done of [...dragCleanups]) done(); navigationView?.destroy(); subView?.view?.destroy(); if (subView) ctx.onCoin?.(null); panels.forEach((p) => p.dispose?.()); state.destroy(); root.removeEventListener('keydown',keydown); globalThis.removeEventListener?.('resize',responsiveGeometry); root.remove(); } };
}
