// ClankChecker (2026-09-26, the owner's idea and name): every coin on clank.trade (new, old and graduated) with a risk scan
// on demand, and AGI-1 reading it with you. The whole list comes from /api/checker (when the section gets close), the
// newest coins from /api/checker?latest every 10 s while it's on screen (so a coin launched a moment ago shows up without a
// reload; plus a Refresh button), each coin's picture from /api/checker?logo=… (tap it to see it big), and a coin's scan
// from /api/checker?a=0x… when someone asks. All of it is shared by the CDN (see api/checker.js).
// "Ask AGI-1" opens the answer under that coin: the level (lower / some / high risk), the flags, the facts behind them, and
// AGI-1 herself: the 3D canvas moves into the answer's live view (src/stage/stage.js), she reacts (a nod, a "hmm", a worried
// shake of her head…) and says a pre-written line in her natural voice (src/checker/lines.js: made once and kept, so asking
// about coin after coin never makes a new recording). Her part comes after the 18+ check, like her chat; the scan itself is
// there for everyone. Every coin is listed, crude names too (the owner's choice; hate slurs come masked from our server),
// but the picture of a coin with a crude name stays blurred until the 18+ check. Everything is shown with textContent.
// Never buy / sell advice.
import { sharedVoice } from '../chat/voice.js';
import { pretendTalk } from '../lib/talk.js';
import { checkLine as checkLineIn, LEVELS } from '../checker/lines.js';
import { currentLang, currentLines } from '../i18n/lang.js';
import { markCopycats } from '../checker/copycat.js';
import { parseCoinInput } from '../prices/parse.js';

const PAGE = 30;                        // coins shown at first, and per "Show more"
const LIVE_EVERY = 10_000;              // the newest coins, while ClankChecker is on screen (the CDN keeps them 10 s)
const LIST_EVERY = 5 * 60_000;          // the whole list (the CDN keeps it 5 minutes)
const IDLE_AFTER = 10 * 60_000;         // nobody has touched the page for 10 minutes: live updates rest until someone does
                                        // (a tab forgotten on this section doesn't ask our server every 10 s all night)
const SCAN_KEEP = 5 * 60_000;           // a scan is reused this long in this visit…
const SCAN_KEEP_NEW = 60_000;           // …a coin less than a day old only this long (it changes fast)
const MISS_KEEP = 30_000;               // …and a failed one this long (then it's asked again)
const ADULT = 'agi1_18plus';           // the chat's 18+ confirmation (src/chat/chat.js)
const DAY = 86_400_000;
const ADDRESS = /^0x[0-9a-f]{40}$/;
const nap = (ms) => new Promise((ok) => setTimeout(ok, ms));
const sayTime = (text) => Math.min(3.2, Math.max(0.8, String(text).length / 16));   // like the chat's silent "saying"
const smooth = () => !matchMedia('(prefers-reduced-motion: reduce)').matches;
const picture = (address, size) => `/api/checker?logo=${address}&s=${size}`;

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const svg = (d, box = '0 0 16 16') => {
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('viewBox', box);
  icon.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d);
  icon.append(path);
  return icon;
};
const BUBBLE = 'M3 3.5h10a1 1 0 0 1 1 1v5.5a1 1 0 0 1-1 1H7.2L4.5 13v-2H3a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z';
const isAdult = () => { try { return JSON.parse(localStorage.getItem(ADULT)) === true; } catch { return false; } };
const setAdult = () => { try { localStorage.setItem(ADULT, 'true'); } catch { /* this visit only */ } };

// $36.5K · $1.46M · $840
export function usdShort(n) {
  if (!Number.isFinite(n)) return '—';
  if (n >= 1e9) return `$${+(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${+(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${+(n / 1e3).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}
// 5 min · 3 h · 10 d
export function ageShort(ms) {
  const m = Math.max(0, ms) / 60_000;
  if (m < 60) return `${Math.max(1, Math.round(m))} min`;
  if (m < 48 * 60) return `${Math.round(m / 60)} h`;
  return `${Math.round(m / 1440)} d`;
}
// just now · 8 s ago · 2 min ago
export function agoText(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 5) return 'just now';
  return s < 60 ? `${s} s ago` : `${Math.round(s / 60)} min ago`;
}
// (2026-09-29: "Graduating" while its curve has sold out and its pool isn't open yet, "Rescued" when its graduation failed)
export const stageText = (c) => (c.stage === 'graduating' ? 'Graduating' : c.stage === 'rescued' ? 'Rescued'
  : c.graduated ? 'Graduated' : `Curve ${c.progress > 0 && c.progress < 1 ? c.progress.toFixed(1) : Math.round(c.progress)}%`);
const tickerOf = (c) => (c.symbol ? `$${c.symbol}` : '(no ticker)');
const letterOf = (c) => (c.symbol || '?').replace(/^[^\p{L}\p{N}]+/u, '').charAt(0).toUpperCase() || '?';

// Which coins a filter shows, and in what order. query: what's typed in the search box (a name, a ticker or an address).
//   newest (the default, like clank.trade) · trending (clank.trade's own list) · graduated (the biggest first) · biggest
export function pick(coins, { filter = 'newest', query = '' } = {}) {
  const q = query.trim().toLowerCase().replace(/^\$/, '');
  const bigFirst = (a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0) || b.progress - a.progress || b.createdAt - a.createdAt;
  if (q) {
    const found = coins.filter((c) => c.address.startsWith(q) || (c.symbol || '').toLowerCase().includes(q) || (c.name || '').toLowerCase().includes(q));
    const exact = (c) => ((c.symbol || '').toLowerCase() === q ? 0 : 1);
    return found.sort((a, b) => exact(a) - exact(b) || bigFirst(a, b));
  }
  if (filter === 'trending') return coins.filter((c) => c.trending > 0).sort((a, b) => a.trending - b.trending);
  if (filter === 'graduated') return coins.filter((c) => c.graduated).sort(bigFirst);
  if (filter === 'biggest') return [...coins].sort(bigFirst);
  return [...coins].sort((a, b) => b.createdAt - a.createdAt || (a.address < b.address ? -1 : 1));
}

// A coin from our server, with its numbers made sure (null when unknown). → the coin, or null when it isn't one
export function tidyCoin(c) {
  if (!c || typeof c.address !== 'string' || !ADDRESS.test(c.address)) return null;
  const n = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  return {
    ...c,
    symbol: typeof c.symbol === 'string' ? c.symbol : null,
    name: typeof c.name === 'string' ? c.name : '',
    graduated: c.graduated === true,
    stage: c.stage === 'graduating' || c.stage === 'rescued' ? c.stage : null,
    progress: n(c.progress) ?? 0,
    createdAt: n(c.createdAt) ?? 0,
    marketCap: n(c.marketCap),
    trending: n(c.trending) ?? 0,
    image: c.image === true,
    adult: c.adult === true,
  };
}

// The newest coins (GET /api/checker?latest) into the list the page has: new launches are added, the ones it knows get
// their new numbers, the trending ranks are replaced (with the trending coins' market caps), and copycat tickers are
// marked again (src/checker/copycat.js, as on our server). → the coins that are new to the list
export function mergeLatest(coins, latest) {
  const by = new Map(coins.map((c) => [c.address, c]));
  const added = [];
  for (const raw of Array.isArray(latest?.coins) ? latest.coins : []) {
    const c = tidyCoin(raw);
    if (!c) continue;
    const had = by.get(c.address);
    if (had) {
      const { trending, copyOf, copyOfficial, sameTicker, ...news } = c;
      Object.assign(had, news);
    } else {
      coins.push(c);
      by.set(c.address, c);
      added.push(c);
    }
  }
  if (Array.isArray(latest?.trending)) {
    for (const c of coins) c.trending = 0;
    for (const t of latest.trending) {
      const had = by.get(t?.address);
      if (!had || !(t.rank > 0)) continue;
      had.trending = t.rank;
      if (Number.isFinite(t.marketCap)) had.marketCap = t.marketCap;
      if (t.graduated === true) { had.graduated = true; had.stage = null; }
      if (Number.isFinite(t.progress)) had.progress = had.graduated ? 100 : t.progress;
    }
  }
  markCopycats(coins, { size: (c) => c.marketCap ?? 0 });
  return added;
}

// her line for a scan, in the language she speaks (2026-09-29: src/i18n/lang.js)
const checkLine = (data) => checkLineIn(data, currentLines(), currentLang());

export function startChecker(root) {
  if (!root) return;
  const $ = (sel) => root.querySelector(sel);
  const listEl = $('[data-chk-list]'), statusEl = $('[data-chk-status]'), moreBtn = $('[data-chk-more]');
  const liveEl = $('[data-chk-live]'), liveText = $('[data-chk-live-text]'), refreshBtn = $('[data-chk-refresh]');
  const announcer = $('[data-chk-announce]');
  const input = $('[data-chk-input]'), searchForm = $('[data-chk-search]');
  const filterBtns = [...root.querySelectorAll('[data-chk-filter]')];
  const answer = $('[data-chk-answer]'), parking = $('.chk-parking');
  const cam = $('[data-live-cam]'), camState = cam?.querySelector('[data-cam-state]');
  const gate = $('[data-chk-gate]'), gateOk = $('[data-chk-gate-ok]');
  const coinEl = $('[data-chk-coin]'), coinPic = $('[data-chk-coin-pic]'), coinImg = $('[data-chk-coin-img]');
  const levelEl = $('[data-chk-level]'), levelText = $('[data-chk-level-text]');
  const sayEl = $('[data-chk-say]'), listenBtn = $('[data-chk-listen]'), closeBtn = $('[data-chk-close]');
  const flagsEl = $('[data-chk-flags]'), factsEl = $('[data-chk-facts]');
  const clankLink = $('[data-chk-clank]'), explorerLink = $('[data-chk-explorer]');
  const zoom = $('[data-chk-zoom]');

  let coins = null, byAddress = new Map(), complete = true, loading = null;
  let filter = 'newest', query = '', shown = PAGE;
  const typedCoins = new Map();         // a pasted contract that isn't in the list: address → a stand-in coin
  const rows = new Map();               // address → its row (made once, then updated in place)
  const scans = new Map();              // address → { at, keep, data, failed, promise }
  let open = null;                      // the coin whose answer is open: { coin, li, line, scan }
  let asking = 0;                       // +1 per question: an older answer arriving late is dropped
  let ours = false;                     // her voice right now is our line (not the chat's)
  const current = (address) => byAddress.get(address) ?? typedCoins.get(address) ?? null;

  function announce(text) {
    if (!announcer) return;
    announcer.textContent = '';
    setTimeout(() => { announcer.textContent = text; }, 60);
  }

  // ---------- the list ----------
  function status(text, retry = false) {
    if (!retry && statusEl.textContent === text) return;
    statusEl.replaceChildren(document.createTextNode(text));
    if (retry) {
      const b = el('button', 'chk-retry', 'Try again');
      b.type = 'button';
      b.addEventListener('click', () => { loading = null; load({ manual: true }); });
      statusEl.append(' ', b);
    }
  }
  // the list couldn't be read (2026-10-28): it's asked again by itself, 20 s, 40 s, then every minute, like the live
  // updates (a hidden tab waits until it's shown again), so a hiccup at clank.trade never needs a click; after 10 tries
  // in a row (about 9 minutes) only Try again asks, so a forgotten tab doesn't ask all day
  let listFails = 0, listRetry = 0;
  function retryList() {
    clearTimeout(listRetry);
    if (listFails >= 10) return;
    listRetry = setTimeout(function again() {
      listRetry = 0;
      if (coins || loading) return;
      if (document.visibilityState === 'visible') load();
      else document.addEventListener('visibilitychange', again, { once: true });
    }, Math.min(60_000, LIVE_EVERY * 2 ** listFails));
  }
  function setList(data) {
    const next = data.coins.map(tidyCoin).filter(Boolean);
    const known = new Set(next.map((c) => c.address));
    // launches this page saw live that the (older) list doesn't have yet stay
    const kept = coins ? coins.filter((c) => c.live && !known.has(c.address)) : [];
    coins = [...kept, ...next];
    complete = data.complete !== false;
    listAt = Date.now();
    if (lastLatest) mergeLatest(coins, lastLatest);   // (the newest numbers win over the list's)
    else markCopycats(coins, { size: (c) => c.marketCap ?? 0 });
    byAddress = new Map(coins.map((c) => [c.address, c]));
  }
  async function getJson(url) {
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok || data?.error) throw new Error(data?.error || `HTTP ${res.status}`);
    return data;
  }
  function load({ manual = false } = {}) {
    loading ??= (async () => {
      clearTimeout(listRetry);
      if (manual) listFails = 0;                   // (someone's there: the tries by itself start over)
      status('Scanning clank.trade…');
      try {
        const data = await getJson('/api/checker');
        if (!Array.isArray(data.coins)) throw new Error('no coins');
        listFails = 0;
        setList(data);
        render();
        live.on = true;
        refreshBtn.hidden = false;
        liveEl.hidden = false;
        wake();                                    // the newest coins at once (the list may be a few minutes old)
      } catch {
        loading = null;
        listFails += 1;
        status("Couldn't reach clank.trade right now · retrying", true);
        if (manual || listFails === 1) announce("Couldn't reach clank.trade right now.");
        retryList();
      }
    })();
    return loading;
  }
  function summary(count) {
    const graduated = coins.filter((c) => c.graduated).length;
    const lead = query ? `${count} ${count === 1 ? 'match' : 'matches'} · ` : '';
    return `${lead}${coins.length}${complete ? '' : '+'} coins on clank.trade · ${graduated} graduated`;
  }

  // one coin's row: its picture (its first letter until it arrives, or when it has none), ticker and name, stage, age,
  // market cap, a few tags, and "Ask AGI-1". Made once per coin and updated in place, so live updates never move the
  // keyboard focus, reload a picture or disturb an open answer.
  function makeRow(address) {
    const li = el('li', 'chk-item');
    li.dataset.address = address;
    const line = el('div', 'chk-row');
    const ava = el('span', 'chk-ava');
    const letter = el('span', 'chk-ava-letter mono');
    letter.setAttribute('aria-hidden', 'true');
    ava.append(letter);
    const name = el('span', 'chk-name');
    const title = el('span', 'chk-title');
    const b = el('b');
    const tags = el('span', 'chk-tags');
    const pill = el('span', 'chk-pill');
    pill.hidden = true;
    title.append(b, tags, pill);
    const sub = el('span', 'chk-sub');
    const meta = el('span', 'chk-meta mono');
    name.append(title, sub, meta);
    const stage = el('span', 'chk-stage mono'), age = el('span', 'chk-age mono c-num'), mcap = el('span', 'chk-mcap mono c-num');
    const ask = el('button', 'btn btn-ghost btn-sm chk-ask');
    ask.type = 'button';
    ask.setAttribute('aria-expanded', 'false');
    ask.append(svg(BUBBLE), el('span', '', 'Ask AGI-1'));
    ask.addEventListener('click', () => { const c = current(address); if (c) askAbout(c, li); });
    // about to ask (the pointer rests on the button, or it has keyboard focus): her scan and her voice for it start loading
    // now, so she answers at once
    let rest = 0;
    const warmUp = () => { const c = current(address); if (c) warm(c); };
    ask.addEventListener('pointerenter', () => { rest = setTimeout(warmUp, 150); });
    ask.addEventListener('pointerleave', () => clearTimeout(rest));
    for (const type of ['focus', 'touchstart']) ask.addEventListener(type, warmUp, { passive: true });
    line.append(ava, name, stage, age, mcap, ask);
    li.append(line);
    const r = { li, ava, letter, btn: null, broken: false, b, tags, pill, sub, meta, stage, age, mcap, ask, sig: '' };
    const done = scanned(address);
    if (done) showPill(r, done);
    return r;
  }
  function rowFor(c) {
    let r = rows.get(c.address);
    if (!r) { r = makeRow(c.address); rows.set(c.address, r); }
    fill(r, c);
    return r.li;
  }
  function fill(r, c) {
    const now = Date.now();
    const isNew = !c.unknown && now - c.createdAt < DAY;
    const facts = c.unknown ? ['—', '—', '—'] : [stageText(c), ageShort(now - c.createdAt), usdShort(c.marketCap)];
    const veiled = c.adult && !isAdult();
    const sig = [c.symbol, c.name, c.official, c.copyOfficial, c.copyOf, c.trending, c.unknown, c.image, veiled, isNew,
      !c.graduated && c.progress === 0, ...facts].join('|');
    if (sig === r.sig) return;
    r.sig = sig;
    r.letter.textContent = letterOf(c);
    setPicture(r, c, veiled);
    r.b.textContent = tickerOf(c);
    const tags = [];
    const tag = (text, kind, title) => { const t = el('span', `chk-tag${kind ? ` is-${kind}` : ''}`, text); if (title) t.title = title; tags.push(t); };
    if (c.official) tag('Official $AGI', 'official');
    else if (c.copyOfficial) tag('Not the official $AGI', 'bad');
    else if (c.copyOf) tag('Copycat?', 'bad', 'A bigger coin uses the same ticker');
    if (!c.unknown && !c.graduated && c.progress === 0) tag('No buyers yet');
    if (c.trending) tag(`Trending #${c.trending}`);
    if (isNew) tag('New');
    r.tags.replaceChildren(...tags);
    r.sub.textContent = c.name || '';
    // on phones the stage, age and market cap go under the name (one line)
    r.meta.textContent = c.unknown ? 'Not in our list: the scan still works' : facts.join(' · ');
    [r.stage.textContent, r.age.textContent, r.mcap.textContent] = facts;
    r.ask.setAttribute('aria-label', `Ask AGI-1 about ${tickerOf(c)}${c.name ? `, ${c.name}` : ''}`);
    // just launched (it arrived while you're looking): the row glows for a moment
    if (c.freshAt && now - c.freshAt < 12_000 && !r.li.classList.contains('is-fresh')) {
      r.li.classList.add('is-fresh');
      setTimeout(() => r.li.classList.remove('is-fresh'), 12_500);
    }
  }
  // its picture: a button over the letter that opens the big view (only once the picture really arrives, else the letter)
  function setPicture(r, c, veiled) {
    if (!c.image || r.broken) { r.btn?.remove(); r.btn = null; return; }
    if (!r.btn) {
      const btn = el('button', 'chk-ava-btn');
      btn.type = 'button';
      const img = el('img');
      img.alt = '';
      img.width = 36;
      img.height = 36;
      img.loading = 'lazy';
      img.decoding = 'async';
      img.addEventListener('load', () => btn.classList.add('is-loaded'));
      img.addEventListener('error', () => { r.broken = true; btn.remove(); r.btn = null; });
      img.src = picture(c.address, 96);
      btn.append(img);
      btn.addEventListener('click', () => { const x = current(c.address); if (x) openZoom(x, btn); });
      r.ava.append(btn);
      r.btn = btn;
    }
    r.btn.classList.toggle('is-veiled', veiled);
    r.btn.setAttribute('aria-label', `See ${tickerOf(c)}'s picture bigger${veiled ? ' (blurred until you confirm you\'re 18 or older)' : ''}`);
  }
  function showPill(r, scan) {
    const level = scan.level || 'none';
    if (!r?.pill || !LEVELS[level] || level === 'none') return;
    r.pill.hidden = false;
    r.pill.dataset.level = level;
    const dot = el('i', 'dot');
    dot.setAttribute('aria-hidden', 'true');
    r.pill.replaceChildren(dot, document.createTextNode(LEVELS[level].label));
  }

  const EMPTY = { trending: 'Nothing is trending on clank.trade right now.', graduated: 'No graduated coins yet.' };
  let emptyEl = null;
  // keep: a live update (the coin whose answer is open stays in the list even when new launches push it down)
  function render({ keep = false } = {}) {
    if (!coins) return;
    // a pasted contract (or clank.trade link) that isn't in the list can still be checked
    const typed = parseCoinInput(query);
    let list = typed ? coins.filter((c) => c.address === typed) : pick(coins, { filter, query });
    if (typed && !list.length) {
      if (!typedCoins.has(typed)) {
        typedCoins.set(typed, { address: typed, symbol: null, name: '', graduated: false, progress: 0, createdAt: NaN, marketCap: null, trending: 0, unknown: true });
      }
      list = [typedCoins.get(typed)];
    }
    if (keep && open) {
      const i = list.findIndex((c) => c.address === open.coin.address);
      if (i >= shown) shown = i + 1;
    }
    const items = list.slice(0, shown).map(rowFor);
    if (open && !items.includes(open.li)) closeAnswer({ focus: false });
    // put the rows in place with as few moves as possible (the focused button, the pictures and an open answer stay put)
    const active = document.activeElement;
    if (!items.length) {
      emptyEl ??= el('li', 'chk-empty');
      emptyEl.textContent = query ? 'No coins match that.' : EMPTY[filter] || 'No coins yet.';
      listEl.replaceChildren(emptyEl);
    } else {
      emptyEl?.remove();
      let prev = null;
      for (const li of items) {
        const want = prev ? prev.nextSibling : listEl.firstChild;
        if (want !== li) listEl.insertBefore(li, want);
        prev = li;
      }
      while (prev.nextSibling) prev.nextSibling.remove();
    }
    if (active && active !== document.activeElement && active.isConnected) active.focus({ preventScroll: true });
    moreBtn.hidden = list.length <= shown;
    moreBtn.textContent = `Show more coins (${list.length - Math.min(shown, list.length)} more)`;
    status(summary(list.length));
    return list.length;
  }

  // ---------- live: the newest coins every 10 s while ClankChecker is on screen ----------
  const live = { on: false, seen: false, timer: 0, busy: false, fails: 0, at: 0, clock: 0, active: Date.now() };
  let listAt = 0, lastLatest = null;
  const running = () => live.on && live.seen && document.visibilityState === 'visible' && Date.now() - live.active < IDLE_AFTER;
  function showLive() {
    if (!live.on) return;
    const state = live.fails ? 'error' : running() ? 'live' : 'paused';
    liveEl.dataset.state = state;
    const ago = live.at ? ` · updated ${agoText(Date.now() - live.at)}` : '';
    liveText.textContent = state === 'error' ? "Can't reach clank.trade · retrying" : `${state === 'live' ? 'Live' : 'Paused'}${ago}`;
  }
  function schedule(ms) {
    clearTimeout(live.timer);
    live.timer = 0;
    if (running()) live.timer = setTimeout(poll, Math.max(0, ms));
    showLive();
  }
  async function poll({ manual = false } = {}) {
    if (live.busy || !coins) return;
    live.busy = true;
    clearTimeout(live.timer);
    refreshBtn.classList.add('is-busy');
    refreshBtn.setAttribute('aria-busy', 'true');
    try {
      const [latest, list] = await Promise.all([
        getJson('/api/checker?latest'),
        Date.now() - listAt > LIST_EVERY ? getJson('/api/checker').catch(() => null) : null,
      ]);
      if (list && Array.isArray(list.coins)) setList(list);
      lastLatest = latest;
      const added = mergeLatest(coins, latest);
      for (const c of added) { c.live = true; c.freshAt = Date.now(); byAddress.set(c.address, c); }
      live.fails = 0;
      live.at = Date.now();
      render({ keep: true });
      if (added.length) {
        const names = added.map(tickerOf);
        announce(added.length === 1 ? `New on clank.trade: ${names[0]}` : `${added.length} new coins on clank.trade: ${names.slice(0, 3).join(', ')}`);
      } else if (manual) announce('Up to date');
    } catch {
      live.fails += 1;
      if (manual) announce("Couldn't reach clank.trade right now.");
    } finally {
      live.busy = false;
      refreshBtn.classList.remove('is-busy');
      refreshBtn.removeAttribute('aria-busy');
      // a hiccup: try again a little later each time (20 s, 40 s, then every minute)
      schedule(live.fails ? Math.min(60_000, LIVE_EVERY * 2 ** live.fails) : LIVE_EVERY);
    }
  }
  function wake() {
    if (!live.on) return;
    clearInterval(live.clock);
    live.clock = 0;
    if (running()) {
      live.clock = setInterval(showLive, 1000);
      schedule(live.at ? LIVE_EVERY - (Date.now() - live.at) : 0);
    } else schedule(0);
  }
  refreshBtn.addEventListener('click', () => { if (!live.busy) poll({ manual: true }); });
  const onScreen = new IntersectionObserver((entries) => {
    for (const e of entries) live.seen = e.isIntersecting;
    wake();
  });
  onScreen.observe(root);
  document.addEventListener('visibilitychange', wake);
  // someone's there (the pointer, a key, a tap, a scroll): live updates go on, or start again at once after a rest
  const stir = () => {
    if (Date.now() - live.active < 1000) return;
    const resting = live.on && !running();
    live.active = Date.now();
    if (resting) wake();
  };
  for (const type of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll']) addEventListener(type, stir, { passive: true });

  // ---------- the big picture ----------
  const zoomPic = zoom?.querySelector('[data-chk-zoom-pic]'), zoomLow = zoom?.querySelector('[data-chk-zoom-low]');
  const zoomImg = zoom?.querySelector('[data-chk-zoom-img]'), zoomVeil = zoom?.querySelector('[data-chk-zoom-veil]');
  const zoomTicker = zoom?.querySelector('[data-chk-zoom-ticker]'), zoomName = zoom?.querySelector('[data-chk-zoom-name]');
  const zoomMeta = zoom?.querySelector('[data-chk-zoom-meta]'), zoomClank = zoom?.querySelector('[data-chk-zoom-clank]');
  let zoomed = null;                    // { coin, opener }
  function veilZoom() {
    if (!zoomed) return;
    const veiled = zoomed.coin.adult && !isAdult();
    zoomPic.classList.toggle('is-veiled', veiled);
    zoomVeil.hidden = !veiled;
  }
  function openZoom(c, opener) {
    if (!zoom?.showModal) return;
    zoomed = { coin: c, opener };
    zoomTicker.textContent = tickerOf(c);
    zoomName.textContent = c.name || '';
    zoomMeta.textContent = c.unknown || !c.createdAt ? '' : [stageText(c), `launched ${ageShort(Date.now() - c.createdAt)} ago`, `market cap ${usdShort(c.marketCap)}`].join(' · ');
    zoomClank.href = `https://clank.trade/coin/${c.address}`;
    zoomImg.classList.remove('is-loaded');
    zoomLow.classList.remove('is-loaded');
    zoomPic.classList.remove('is-big');
    zoomImg.alt = `${tickerOf(c)}'s picture on clank.trade`;
    zoomLow.src = picture(c.address, 96);          // (already here: shown, softly, until the big one arrives)
    zoomImg.src = picture(c.address, 512);
    // (a picture the browser already has may not say "loaded" again)
    if (zoomLow.complete && zoomLow.naturalWidth) zoomLow.classList.add('is-loaded');
    if (zoomImg.complete && zoomImg.naturalWidth) { zoomImg.classList.add('is-loaded'); zoomPic.classList.add('is-big'); }
    veilZoom();
    zoom.showModal();
  }
  if (zoom) {
    zoomImg.addEventListener('load', () => { zoomImg.classList.add('is-loaded'); zoomPic.classList.add('is-big'); });
    zoomLow.addEventListener('load', () => zoomLow.classList.add('is-loaded'));
    // a tap outside the card (on the dimmed page) closes it, like Escape and ✕
    zoom.addEventListener('click', (e) => { if (e.target === zoom) zoom.close(); });
    zoom.querySelector('[data-chk-zoom-close]').addEventListener('click', () => zoom.close());
    zoom.addEventListener('close', () => {
      const opener = zoomed?.opener;
      zoomed = null;
      if (opener?.isConnected && document.activeElement === document.body) opener.focus({ preventScroll: true });
    });
    zoom.querySelector('[data-chk-zoom-ask]').addEventListener('click', () => {
      const c = zoomed && current(zoomed.coin.address);
      zoom.close();
      const r = c && rows.get(c.address);
      if (r?.li.isConnected) askAbout(c, r.li);
    });
    zoom.querySelector('[data-chk-zoom-adult]').addEventListener('click', () => {
      setAdult();
      dispatchEvent(new CustomEvent('agi:adult', { detail: true }));
      zoom.querySelector('[data-chk-zoom-close]').focus();
    });
  }
  coinPic?.addEventListener('click', () => { if (open) openZoom(current(open.coin.address) ?? open.coin, coinPic); });
  function showCoinPic(c) {
    if (!coinPic) return;
    coinPic.hidden = !c.image;
    if (!c.image) return;
    coinPic.classList.toggle('is-veiled', Boolean(c.adult && !isAdult()));
    coinPic.setAttribute('aria-label', `See ${tickerOf(c)}'s picture bigger`);
    const src = picture(c.address, 96);
    if (coinImg.getAttribute('src') !== src) coinImg.src = src;
    // the same picture already failed (the host down): keep it hidden, or the scan coming in a moment later would show a
    // broken picture (found 2026-09-27; a failed picture is "complete" with no width)
    else if (coinImg.complete && !coinImg.naturalWidth) coinPic.hidden = true;
  }
  coinImg?.addEventListener('error', () => { coinPic.hidden = true; });

  // ---------- one coin's scan ----------
  const scanned = (address) => {
    const s = scans.get(address);
    return s?.data && Date.now() - s.at < s.keep ? s.data : null;
  };
  function scan(address) {
    const s = scans.get(address);
    if (s && Date.now() - s.at < (s.failed ? MISS_KEEP : s.keep)) return s.promise;
    const c = current(address);
    const entry = { at: Date.now(), keep: c && Date.now() - c.createdAt < DAY ? SCAN_KEEP_NEW : SCAN_KEEP, data: null, failed: false, promise: null };
    entry.promise = (async () => {
      try {
        const res = await fetch(`/api/checker?a=${address}`);
        const data = await res.json();
        if (res.ok && data.level) {
          entry.data = data;
          // (a coin under a day old, or a smaller scan straight from the chain while clank.trade is away: a minute)
          if ((data.createdAt > 0 && Date.now() - data.createdAt < DAY) || data.source === 'chain') entry.keep = SCAN_KEEP_NEW;
          return data;
        }
        entry.failed = true;                       // (asked again after a little while)
        return { address, level: 'none', error: data.error || `HTTP ${res.status}` };
      } catch {
        entry.failed = true;
        return { address, level: 'none', error: 'offline' };
      }
    })();
    scans.set(address, entry);
    return entry.promise;
  }
  // pointer on "Ask AGI-1": the scan starts now, and once it's in (18+ only) her voice for its line too
  function warm(c) {
    scan(c.address).then((data) => { if (isAdult() && data.level) { const l = checkLine(data); sharedVoice()?.warm(l.key, l.lang); } });
  }

  // ---------- AGI-1's answer ----------
  const ERRORS = {
    not_clank: 'Not a clank.trade coin, or too new to be listed yet.',
    removed: "That coin isn't checked on this site.",
    slow_down: 'Lots of scans at once: wait a few seconds and ask again.',
  };
  function camLabel(text) {
    if (!cam) return;
    cam.dataset.state = text;
    if (camState) camState.textContent = text;
  }
  function showAgi1(on) {
    if (cam) cam.hidden = !on;
    gate.hidden = on;
    sayEl.hidden = !on || !sayEl.textContent;
    listenBtn.hidden = !on || !open?.line || !sharedVoice()?.available;
  }
  function setLevel(level, text) {
    levelEl.dataset.level = level;
    levelText.textContent = text;
  }
  const coinText = (c) => (c.symbol || c.name ? `${tickerOf(c)}${c.name ? ` · ${c.name}` : ''}` : `${c.address.slice(0, 6)}…${c.address.slice(-4)}`);

  async function askAbout(c, li) {
    const voice = sharedVoice();
    const adult = isAdult();
    if (adult) voice?.prime({ force: true });      // (in the tap: phones only allow sound that starts from one)
    voice?.stop();
    const my = ++asking;
    // the answer moves under this coin
    if (open?.li && open.li !== li) {
      open.li.classList.remove('is-open');
      open.li.querySelector('.chk-ask')?.setAttribute('aria-expanded', 'false');
    }
    open = { coin: c, li, line: null, scan: null };
    li.classList.add('is-open');
    li.querySelector('.chk-ask').setAttribute('aria-expanded', 'true');
    if (answer.parentNode !== li) li.append(answer);
    coinEl.textContent = coinText(c);
    showCoinPic(c);
    clankLink.href = `https://clank.trade/coin/${c.address}`;
    explorerLink.href = `https://robinhoodchain.blockscout.com/token/${c.address}`;
    setLevel('scanning', 'Scanning…');
    sayEl.textContent = '';
    flagsEl.replaceChildren();
    factsEl.replaceChildren();
    showAgi1(adult);
    answer.setAttribute('aria-busy', 'true');
    // the coin and its answer in view: if the answer doesn't fit below the coin, the coin moves up to the top
    const box = answer.getBoundingClientRect();
    if (box.bottom > innerHeight || box.top < 0) li.scrollIntoView?.({ block: 'start', behavior: smooth() ? 'smooth' : 'auto' });
    coinEl.focus({ preventScroll: true });
    // she reads it: her eyes on the scan while it loads
    camLabel('reading');
    dispatchEvent(new CustomEvent('agi1:state', { detail: { state: 'listening', look: flagsEl } }));

    const data = await scan(c.address);
    if (my !== asking) return;
    open.scan = data;
    answer.removeAttribute('aria-busy');
    dispatchEvent(new CustomEvent('agi1:state', { detail: { state: 'idle' } }));
    camLabel('live');
    // a pasted contract that isn't in the list: its row gets what the scan found out (its ticker, name and picture)
    if (c.unknown && data.symbol !== undefined && !data.error) {
      Object.assign(c, { symbol: data.symbol, name: data.name || '', image: data.image === true, adult: data.adult === true });
      const r = rows.get(c.address);
      if (r) fill(r, c);
    }
    render1(data);
    showPill(rows.get(c.address), data);
    if (isAdult()) speak(data, my);
  }

  // the scan: the level, the flags (worst first) and the facts
  function render1(data) {
    if (data.symbol || data.name) coinEl.textContent = `$${data.symbol || '?'}${data.name ? ` · ${data.name}` : ''}`;
    if (!data.error) showCoinPic({ ...open.coin, address: data.address, symbol: data.symbol, image: data.image === true, adult: data.adult === true });
    const level = LEVELS[data.level] ? data.level : 'none';
    setLevel(level, data.error ? `${LEVELS.none.label}` : LEVELS[level].label);
    flagsEl.replaceChildren();
    const flag = (sev, text) => {
      const li = el('li', 'chk-flag');
      li.dataset.sev = ['high', 'some', 'ok', 'info'].includes(sev) ? sev : 'info';
      const dot = el('i', 'dot');
      dot.setAttribute('aria-hidden', 'true');
      const words = { high: 'Red flag: ', some: 'Flag: ', ok: '', info: '' }[li.dataset.sev];
      li.append(dot, el('span', 'sr-only', words), document.createTextNode(String(text || '')));
      flagsEl.append(li);
    };
    if (data.error) flag('info', ERRORS[data.error] || "Couldn't reach clank.trade right now. Try again in a minute.");
    for (const f of Array.isArray(data.flags) ? data.flags : []) flag(f.sev, f.text);
    factsEl.replaceChildren();
    for (const f of Array.isArray(data.facts) ? data.facts : []) {
      const row = el('div');
      row.append(el('dt', '', String(f.label || '')), el('dd', 'mono', String(f.value || '')));
      factsEl.append(row);
    }
    open.line = checkLine(data);
    sayEl.textContent = open.line.text;
    sayEl.lang = open.line.lang;
    sayEl.dir = 'auto';
    showAgi1(isAdult());
  }

  // her reaction and her line: her natural voice (a fixed line, made once and kept), else her mouth "says" it silently
  async function speak(data, my) {
    const line = checkLine(data);
    // (a moment for her to arrive in the live view, so she's there when she reacts)
    await nap(250);
    if (my !== asking) return;
    dispatchEvent(new CustomEvent('agi1:react', { detail: line.react }));
    const voice = sharedVoice();
    if (!voice?.available || !voice.unlocked()) { pretendTalk(sayTime(line.text), 0.8); return; }
    ours = true;
    const how = await voice.line(line.key, line.lang);
    if (my !== asking) return;
    if (how !== 'voice') { ours = false; pretendTalk(sayTime(line.text), 0.8); }
  }
  addEventListener('agi1:speaking', (e) => {
    if (!open) return;
    if (e.detail && ours) camLabel('speaking');
    else if (!e.detail) { ours = false; camLabel('live'); }
  });

  function closeAnswer({ focus = true } = {}) {
    if (!open) return;
    asking += 1;
    if (ours) sharedVoice()?.stop();
    ours = false;
    const li = open.li;
    li.classList.remove('is-open');
    const ask = li.querySelector('.chk-ask');
    ask?.setAttribute('aria-expanded', 'false');
    parking.append(answer);
    open = null;
    dispatchEvent(new CustomEvent('agi1:state', { detail: { state: 'idle' } }));
    if (focus && ask?.isConnected) ask.focus({ preventScroll: true });
  }
  closeBtn.addEventListener('click', () => closeAnswer());
  answer.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); closeAnswer(); } });
  listenBtn.addEventListener('click', () => {
    if (!open?.line) return;
    const voice = sharedVoice();
    voice?.prime({ force: true });
    ours = true;
    voice?.line(open.line.key, open.line.lang).then((how) => { if (how !== 'voice') { ours = false; pretendTalk(sayTime(open?.line?.text || ''), 0.8); } });
  });
  // her language changed while an answer is open: her line there follows (the scan and its flags stay as they are)
  addEventListener('agi1:lang', () => {
    if (!open?.scan) return;
    open.line = checkLine(open.scan);
    sayEl.textContent = open.line.text;
    sayEl.lang = open.line.lang;
  });
  // 18+ right here: the chat opens too (and the other way round)
  gateOk.addEventListener('click', () => {
    setAdult();
    dispatchEvent(new CustomEvent('agi:adult', { detail: true }));
    sharedVoice()?.prime({ force: true });
    showAgi1(true);
    if (open?.scan) speak(open.scan, asking);
  });
  // (the chat's 18+ check, this one, or the big picture's: her answer, and every blurred picture)
  addEventListener('agi:adult', (e) => {
    if (open) {
      showAgi1(e.detail === true);
      showCoinPic({ ...open.coin, ...(open.scan && !open.scan.error ? { image: open.scan.image === true, adult: open.scan.adult === true } : {}) });
    }
    veilZoom();
    if (coins) render();
  });

  // ---------- search and filters ----------
  let typing = 0;
  const searched = () => {
    const n = render();
    if (typeof n === 'number' && query.trim()) announce(`${n} ${n === 1 ? 'match' : 'matches'}`);
  };
  input.addEventListener('input', () => {
    clearTimeout(typing);
    typing = setTimeout(() => { query = input.value; shown = PAGE; if (coins) searched(); else load(); }, 140);
  });
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    clearTimeout(typing);
    query = input.value;
    shown = PAGE;
    if (coins) searched(); else load();
    // Enter on a pasted contract: ask her right away
    const typed = parseCoinInput(query);
    const li = typed && listEl.querySelector(`[data-address="${typed}"]`);
    if (li) li.querySelector('.chk-ask').click();
  });
  const FILTER_WORDS = { newest: 'newest first', trending: 'trending on clank.trade', graduated: 'graduated coins', biggest: 'biggest first' };
  for (const b of filterBtns) {
    b.addEventListener('click', () => {
      filter = b.dataset.chkFilter;
      for (const x of filterBtns) { const on = x === b; x.classList.toggle('is-on', on); x.setAttribute('aria-pressed', String(on)); }
      shown = PAGE;
      if (!coins) { load(); return; }
      const n = render();
      if (!query.trim()) announce(`${n} ${n === 1 ? 'coin' : 'coins'}, ${FILTER_WORDS[filter] || filter}`);
    });
  }
  moreBtn.addEventListener('click', () => { shown += PAGE; render(); });

  // ---------- load when it gets close (not on page load: most visitors never scroll this far) ----------
  const near = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { near.disconnect(); load(); }
  }, { rootMargin: '900px 0px' });
  near.observe(root);
  if (location.hash === '#checker') load();
  addEventListener('hashchange', () => { if (location.hash === '#checker') load(); });
}
