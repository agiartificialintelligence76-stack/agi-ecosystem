// The Arena (formerly the ClankeRRankeR): a live leaderboard. One vote per human per 5-minute round;
// the server keeps the score and crowns a champion for every round (supabase/arena.sql).
// - The scoreboard comes from GET /api/arena (the same for everyone, so the CDN can reuse it for ~10 s).
// - Votes go to POST /api/vote with the shared human check (src/lib/human.js).
// - Prices come from the live 'agi:prices' events. All text is set with textContent.
// - Phase 4: the Hall of Fame (crowns this week / all time), the round history (GET /api/arena?before=…), and
//   'agi:champion' { round, number, coin, votes, mine } whenever a new champion is crowned while the page is open,
//   so AGI-1 can react in her chat (src/chat/chat.js). It also watches while only the Playground is on screen.
// - Phase 6: the coins come from the server. Visitors nominate clank.trade coins and vote them in (POST /api/coins,
//   supabase/coins.sql): 20 humans in 7 days and a coin joins; the Arena holds 8. Each row shows the coin's logo.
//   It announces 'agi:coins' (prices.js follows the list) and 'agi:arena-champion' (the latest champion with its logo and
//   clank.trade link, for the stage's Champion button in src/stage/stage.js).
import { TOKENS, fmtPrice, fmtPct, fmtCompact, parseCoinInput, buyLink } from '../prices/parse.js';
import { withHuman, postJson } from '../lib/human.js';
import { championPost, championLink } from '../share/texts.js';
import { setShareLink, onSaveImage } from '../share/buttons.js';

const POLL_MS = 15_000;
const ROUND_MS = 5 * 60_000;
const WEEK_MS = 7 * 24 * 3600_000;
const MINE_KEY = 'arena_vote';                 // { round, coin }: this browser's vote in the current round
const LOG_KEY = 'arena_votes';                 // [{ round, coin }]: this browser's last 100 votes ("your pick" in the history)
const COIN_VOTES_KEY = 'arena_coin_votes';     // { address: time }: coins this browser voted to add (for 7 days)
const PAGE = 24;                               // older rounds per "Show older rounds"
const NEW_MS = 24 * 3600_000;                  // a coin voted in during the last day gets a "New" tag

// Until the first scoreboard arrives: the Arena's first coins (the server sends the real list).
const START = TOKENS.map((t, i) => {
  const id = t.symbol.toLowerCase();
  return { symbol: t.symbol, name: t.name, address: t.ca, logo: `/images/coins/${id}-64.webp`, logoLarge: `/images/coins/${id}.webp`, core: i < 2, listedAt: null, buy: buyLink(t.ca) };
});

const NOTES = {
  idle: 'One vote per human per round.',
  human_check: "Couldn't check that you're human. Refresh the page and try again.",
  not_ready: 'The Arena opens soon.',
  not_configured: 'The Arena opens soon.',
  busy: 'Too busy to count right now. Try again in a minute.',
  slow_down: 'Too many tries. Wait a minute, then vote again.',
  bad_coin: 'That coin just left the Arena.',
  offline: 'You seem to be offline.',
  error: 'Something went wrong. Try again in a minute.',
};

// Nominations and votes to add a coin: what the server answered, in words
const votesWord = (n) => `${n} vote${n === 1 ? '' : 's'}`;
const NOMINATED = {
  ok: (d) => (d.nominated
    ? `Nominated $${d.symbol}. ${votesWord(Math.max(0, d.need - d.votes))} more within 7 days and it joins the Arena.`
    : `You voted to add $${d.symbol}: ${d.votes} of ${d.need}.`),
  already: (d) => `You already voted for $${d.symbol} this week (${d.votes} of ${d.need}).`,
  added: (d) => `Your vote got $${d.symbol} into the Arena.`,
  waiting: (d) => `$${d.symbol} has ${votesWord(d.votes)}. It joins as soon as a spot opens (new coins get a day to settle in).`,
  listed: (d) => `$${d.symbol} is already in the Arena.`,
};
const NOM_ERRORS = {
  bad_link: 'Paste a clank.trade coin link (clank.trade/coin/0x…) or a contract address.',
  not_clank: "That isn't a clank.trade coin.",
  not_trading: "That coin isn't trading on a DEX yet. It can be nominated once it has $5,000 in liquidity.",
  low_liquidity: (d) => `That coin has ${fmtCompact(d.liquidity)} in liquidity. Nominations need at least ${fmtCompact(d.min || 5000)}.`,
  bad_symbol: "That coin's ticker can't be shown here (letters A–Z and numbers only).",
  not_allowed: "That coin's name or ticker isn't PG-13, so it can't be nominated.",
  symbol_taken: (d) => `Another coin called $${d.symbol || '…'} is already in the Arena or up for a vote.`,
  removed: 'That coin was removed from the Arena and can’t be nominated.',
  too_many: "You've nominated 2 coins today. Try again tomorrow.",
  site_limit: 'The Arena got lots of nominations today. Try again tomorrow.',
  unverified: (d) => `Couldn't reach ${d.source || 'clank.trade'} to check the coin. Try again in a few minutes.`,
  not_ready: 'Nominations open soon.',
  not_configured: 'Nominations open soon.',
  human_check: NOTES.human_check,
  slow_down: 'Too many tries. Wait a minute, then try again.',
  busy: NOTES.busy,
  offline: NOTES.offline,
  error: NOTES.error,
};
const say = (table, key, data = {}) => {
  const v = table[key] ?? table.error;
  return typeof v === 'function' ? v(data) : v;
};

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* fine */ } },
};
const clock = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
// Times in the visitor's own time zone and language
const hhmm = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const timeRange = (a, b) => (hhmm.formatRange ? hhmm.formatRange(a, b) : `${hhmm.format(a)}–${hhmm.format(b)}`);   // "2:20 – 2:25 PM"
const dayName = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
function dayLabel(d) {
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  return dayKey(d) === dayKey(today) ? 'Today' : dayKey(d) === dayKey(yesterday) ? 'Yesterday' : dayName.format(d);
}

// A coin's logo in a small circle; the ticker's first letter when there's no picture (or it doesn't load).
export function coinLogo(coin, size = 28) {
  const wrap = el('span', 'coin-logo');
  wrap.dataset.initial = (coin?.symbol || '?').slice(0, 1);
  wrap.setAttribute('aria-hidden', 'true');
  if (coin?.logo) {
    const img = el('img');
    img.alt = '';
    img.width = size;
    img.height = size;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.addEventListener('error', () => { img.remove(); wrap.classList.add('no-logo'); }, { once: true });
    img.src = coin.logo;
    wrap.append(img);
  } else {
    wrap.classList.add('no-logo');
  }
  return wrap;
}

export function startArena(root) {
  if (!root) return;
  const $ = (sel) => root.querySelector(sel);
  const board = $('[data-board]'), statusEl = $('[data-status]'), roundEl = $('[data-round]');
  const countdownEl = $('[data-countdown]'), humanBox = $('[data-human]');
  const hofWeek = $('[data-hof="week"]'), hofAll = $('[data-hof="all"]');
  const historyEl = $('[data-history]'), moreButton = $('[data-history-more]');
  const champShare = $('[data-champ-share]');
  const nomForm = $('[data-nominate-form]'), nomInput = $('[data-nominate-input]'), nomSend = $('[data-nominate-send]');
  const nomStatus = $('[data-nominate-status]'), candList = $('[data-candidates]');

  let state = null;          // the last scoreboard from the server
  let coins = START;         // the coins in the Arena right now
  let known = new Map(START.map((c) => [c.symbol, c]));   // every coin we have a name/logo for (in the Arena or left recently)
  let prices = {};
  let mine = store.get(MINE_KEY);
  let myVotes = Array.isArray(store.get(LOG_KEY)) ? store.get(LOG_KEY) : [];
  let myCoinVotes = store.get(COIN_VOTES_KEY) && typeof store.get(COIN_VOTES_KEY) === 'object' ? store.get(COIN_VOTES_KEY) : {};
  let older = [];            // champions loaded with "Show older rounds"
  let moreDone = false;      // no older rounds left
  let busy = false, note = 'idle', lastCrown = null, visible = false, pollTimer = null, refetchAt = 0;
  let playgroundVisible = false, nomBusy = false, nomKey = '', coinsKey = '', championKey = '', lastChampion = null;
  const myPick = (round) => myVotes.find((v) => v.round === round)?.coin || null;
  const votedToAdd = (address) => Number(myCoinVotes[address]) > Date.now() - WEEK_MS;

  // ---------- one row per coin (made when a coin appears, re-ordered on every update) ----------
  const rows = new Map();
  function makeRow(t) {
    const row = el('div', 'board-row');
    row.setAttribute('role', 'row');
    const rank = el('span', 'b-rank');
    const coin = el('span', 'b-coin');
    const text = el('span', 'b-coin-text');
    const title = el('b', '', `$${t.symbol}`);
    const leader = el('span', 'leader', 'Leader');
    leader.hidden = true;
    const fresh = el('span', 'tag-new', 'New');
    fresh.hidden = true;
    title.append(leader, fresh);
    // on phones the price, 24h and crowns columns are hidden and shown here, under the name instead
    const meta = el('span', 'b-meta');
    const metaPrice = el('span'), metaChange = el('span'), metaCrowns = el('span');
    meta.append(metaPrice, metaChange, metaCrowns);
    text.append(title, el('span', 'b-name', t.name), meta);
    coin.append(coinLogo(t), text);
    const price = el('span', 'b-price c-num c-wide', '—');
    const change = el('span', 'b-change c-num c-wide', '—');
    const votes = el('span', 'b-votes');
    const bar = el('span', 'b-bar');
    bar.append(el('i'));
    const count = el('span', 'b-count', '0');
    votes.append(bar, count);
    const crowns = el('span', 'b-crowns c-num c-wide', '0');
    const act = el('span', 'b-act');
    const button = el('button', 'btn btn-ghost btn-sm', 'Vote');
    button.type = 'button';
    button.setAttribute('aria-label', `Vote for $${t.symbol}`);
    button.addEventListener('click', () => vote(t.symbol));
    act.append(button);
    for (const cell of [rank, coin, price, change, votes, crowns, act]) cell.setAttribute('role', 'cell');
    row.append(rank, coin, price, change, votes, crowns, act);
    return { row, rank, leader, fresh, metaPrice, metaChange, metaCrowns, price, change, bar, count, crowns, button, symbol: t.symbol, address: t.address };
  }
  function syncRows() {
    for (const c of coins) {
      const r = rows.get(c.symbol);
      if (r && r.address !== c.address) { r.row.remove(); rows.delete(c.symbol); }
      if (!rows.has(c.symbol)) rows.set(c.symbol, makeRow(c));
    }
    for (const [symbol, r] of rows) {
      if (!coins.some((c) => c.symbol === symbol)) { r.row.remove(); rows.delete(symbol); }
    }
  }

  function render() {
    syncRows();
    const tally = state?.tally || {}, crowns = state?.crowns || {};
    const order = coins.map((t, i) => ({ s: t.symbol, v: tally[t.symbol] || 0, c: crowns[t.symbol] || 0, i, t }))
      .sort((a, b) => b.v - a.v || b.c - a.c || a.i - b.i);
    const top = Math.max(1, ...order.map((o) => o.v));
    const votedNow = mine && state && mine.round === state.round;
    order.forEach((o, i) => {
      const r = rows.get(o.s);
      board.append(r.row);                                   // re-order: highest votes first
      r.rank.textContent = String(i + 1);
      r.leader.hidden = !(i === 0 && o.v > 0);
      r.fresh.hidden = o.t.core || !o.t.listedAt || Date.now() - Date.parse(o.t.listedAt) > NEW_MS;
      r.count.textContent = String(o.v);
      r.bar.style.setProperty('--share', String(o.v / top));
      r.crowns.textContent = String(o.c);
      const p = prices[o.s] || {};
      const hasPrice = Number.isFinite(p.price), hasChange = Number.isFinite(p.h24);
      r.price.textContent = r.metaPrice.textContent = fmtPrice(p.price);
      r.change.textContent = r.metaChange.textContent = fmtPct(p.h24);
      for (const c of [r.change, r.metaChange]) {
        c.classList.toggle('up', hasChange && p.h24 >= 0);
        c.classList.toggle('down', hasChange && p.h24 < 0);
      }
      r.metaPrice.hidden = !hasPrice;                        // no "—" placeholders in the phone line
      r.metaChange.hidden = !hasChange;
      r.metaCrowns.textContent = `${o.c} crown${o.c === 1 ? '' : 's'}`;
      const isMine = votedNow && mine.coin === o.s;
      r.row.classList.toggle('is-mine', !!isMine);
      r.button.classList.toggle('is-mine', !!isMine);
      r.button.textContent = isMine ? 'Voted ✓' : 'Vote';
      r.button.disabled = !state || busy || !!votedNow;
    });
    renderHallOfFame();
    renderHistory();
    renderShare();
    renderNominations();
    tick();
  }

  // ---------- share the latest champion (Phase 5) ----------
  const latest = () => state?.recent?.[0] || null;
  function renderShare() {
    const c = latest();
    champShare.hidden = !c;
    if (!c) return;
    champShare.querySelector('[data-champ-coin]').textContent = `$${c.coin}`;
    champShare.querySelector('[data-champ-round]').textContent = `round #${c.number}`;
    setShareLink(champShare.querySelector('[data-share-x]'), championPost(c), championLink(location.origin, c.coin));
  }
  onSaveImage(champShare.querySelector('[data-save-image]'), () => {
    const c = latest();
    return c && { card: { kind: 'champion', coin: c.coin, number: c.number, votes: c.votes }, filename: `agi1-arena-round-${c.number}.png`, text: championPost(c) };
  });

  // ---------- Hall of Fame: most crowns this week and all time ----------
  function renderHofList(list, counts, emptyText) {
    if (!state) return;
    if (counts === null) {                                  // the database hasn't got the Phase 4 update yet
      list.replaceChildren(el('li', 'empty', 'Coming soon.'));
      return;
    }
    // coins with crowns (including ones that left the Arena), then the other coins in the Arena; at most 8
    const inArena = coins.map((c) => c.symbol);
    const symbols = [...new Set([...Object.keys(counts).filter((s) => counts[s] > 0), ...inArena])];
    const order = symbols.map((s) => ({ s, n: counts[s] || 0, i: inArena.includes(s) ? inArena.indexOf(s) : inArena.length }))
      .sort((a, b) => b.n - a.n || a.i - b.i).slice(0, 8);
    if (!order.some((o) => o.n > 0)) {
      list.replaceChildren(el('li', 'empty', emptyText));
      return;
    }
    const top = Math.max(1, ...order.map((o) => o.n));
    list.replaceChildren(...order.map((o, i) => {
      const li = el('li');
      const bar = el('span', 'hof-bar');
      const fill = el('i');
      fill.style.setProperty('--share', String(o.n / top));
      bar.append(fill);
      bar.setAttribute('aria-hidden', 'true');
      li.append(el('span', 'hof-rank', String(i + 1)), el('span', 'hof-coin', `$${o.s}`), el('span', 'hof-count', plural(o.n, 'crown')), bar);
      return li;
    }));
  }
  function renderHallOfFame() {
    renderHofList(hofWeek, state?.week === undefined ? null : state?.week, 'No crowns yet this week. Every round counts.');
    renderHofList(hofAll, state?.crowns || {}, 'No champions yet. The first vote decides round one.');
  }

  // ---------- round history: past champions with their times ----------
  function renderHistory() {
    if (!state) return;
    const seen = new Set();
    const list = [...(state.recent || []), ...older]
      .filter((c) => !seen.has(c.round) && seen.add(c.round))
      .sort((a, b) => b.round - a.round);
    if (!list.length) {
      historyEl.replaceChildren(el('li', 'empty', 'No champions yet. The first vote decides round one.'));
      moreButton.hidden = true;
      return;
    }
    const items = [];
    let lastDay = null, prev = null;
    for (const c of list) {
      const start = new Date(c.round * ROUND_MS), end = new Date((c.round + 1) * ROUND_MS);
      const quiet = prev ? prev.round - c.round - 1 : 0;
      if (quiet > 0) items.push(el('li', 'h-gap', `${plural(quiet, 'quiet round')} (no votes)`));
      const day = dayKey(start);
      if (day !== lastDay) { items.push(el('li', 'h-day', dayLabel(start))); lastDay = day; }
      const li = el('li', 'h-row');
      const time = el('time', 'h-time', hhmm.format(start));          // when the round started ("2:20 PM", "14:20")
      time.dateTime = start.toISOString();
      time.title = `Round ${c.number}: ${timeRange(start, end)}`;
      const coin = el('span', 'h-coin', `$${c.coin}`);
      if (myPick(c.round) === c.coin) coin.append(el('span', 'h-mine', 'your pick'));
      coin.append(el('span', 'h-votes-inline', plural(c.votes, 'vote')));
      li.append(el('span', 'h-num', `#${c.number}`), time, coin, el('span', 'h-votes', plural(c.votes, 'vote')));
      items.push(li);
      prev = c;
    }
    historyEl.replaceChildren(...items);
    const oldest = list[list.length - 1];
    moreButton.hidden = moreDone || (state.recent || []).length < 12 || oldest.number <= 1;
  }

  async function loadOlder() {
    const all = [...(state?.recent || []), ...older];
    if (!all.length) return;
    const before = Math.min(...all.map((c) => c.round));
    moreButton.disabled = true;
    moreButton.textContent = 'Loading…';
    try {
      const res = await fetch(`/api/arena?before=${before}&limit=${PAGE + 1}`);   // one extra: are there more after these?
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(data.history)) throw new Error(data.error || 'error');
      older = [...older, ...data.history.slice(0, PAGE)];
      if (data.history.length <= PAGE) moreDone = true;
    } catch {
      moreButton.textContent = "Couldn't load. Try again";
      moreButton.disabled = false;
      return;
    }
    moreButton.disabled = false;
    moreButton.textContent = 'Show older rounds';
    renderHistory();
  }
  moreButton.addEventListener('click', loadOlder);

  // ---------- nominations: coins up for a vote to join the Arena (Phase 6) ----------
  function renderNominations() {
    if (!candList) return;
    const list = state ? state.candidates : undefined;
    const need = state?.rules?.need || 20;
    for (const n of root.querySelectorAll('[data-need]')) n.textContent = String(need);
    for (const n of root.querySelectorAll('[data-max]')) n.textContent = String(state?.rules?.max || 8);
    const closed = list === null;                           // coins.sql not run yet
    nomInput.disabled = closed;
    nomSend.disabled = closed || nomBusy;
    const key = JSON.stringify([list, need, closed, nomBusy, (list || []).map((c) => votedToAdd(c.address))]);
    if (key === nomKey) return;                             // unchanged: keep the buttons (and keyboard focus) as they are
    nomKey = key;
    if (list === undefined) { candList.replaceChildren(el('li', 'empty', 'Loading…')); return; }
    if (closed) { candList.replaceChildren(el('li', 'empty', 'Nominations open soon.')); return; }
    if (!list.length) { candList.replaceChildren(el('li', 'empty', 'Nothing up for a vote yet. Paste a clank.trade link to nominate the first coin.')); return; }
    candList.replaceChildren(...list.map((c) => {
      const li = el('li', 'cand');
      const info = el('span', 'cand-coin');
      const title = el('b', '', `$${c.symbol}`);
      const link = el('a', 'cand-link', 'clank.trade ↗');
      link.href = c.buy || buyLink(c.address);
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.setAttribute('aria-label', `$${c.symbol} on clank.trade (opens in a new tab)`);
      info.append(title, el('span', 'cand-name', c.name), link);
      const progress = el('span', 'cand-progress');
      const bar = el('span', 'cand-bar');
      const fill = el('i');
      fill.style.setProperty('--share', String(Math.min(1, c.votes / need)));
      bar.append(fill);
      bar.setAttribute('aria-hidden', 'true');
      progress.append(bar, el('span', 'cand-count', `${c.votes} / ${need}`));
      const done = votedToAdd(c.address);
      const button = el('button', `btn btn-ghost btn-sm${done ? ' is-mine' : ''}`, done ? 'Voted ✓' : 'Vote to add');
      button.type = 'button';
      button.disabled = done || nomBusy;
      button.setAttribute('aria-label', done ? `You voted to add $${c.symbol}` : `Vote to add $${c.symbol} to the Arena (${c.votes} of ${need} votes)`);
      button.addEventListener('click', () => nominate(c.address, c.symbol));
      const act = el('span', 'cand-act');
      act.append(button);
      li.append(info, progress, act);
      return li;
    }));
  }

  async function nominate(address, symbol) {
    if (nomBusy) return;
    nomBusy = true;
    renderNominations();
    nomStatus.textContent = symbol ? `Counting your vote for $${symbol}…` : 'Checking the coin with clank.trade…';
    try {
      const r = await withHuman(humanBox, 'vote', (extra) => postJson('/api/coins', { coin: address, ...extra }));
      const d = r.data || {};
      if (r.ok && NOMINATED[d.result]) {
        nomStatus.textContent = say(NOMINATED, d.result, d);
        if (['ok', 'already', 'added', 'waiting'].includes(d.result)) {
          myCoinVotes = { ...Object.fromEntries(Object.entries(myCoinVotes).filter(([, t]) => Number(t) > Date.now() - WEEK_MS)), [address]: Date.now() };
          store.set(COIN_VOTES_KEY, myCoinVotes);
        }
        if (!symbol) nomInput.value = '';
        // show the new count at once (the scoreboard below may be a few seconds old), then ask for a fresh one
        if (state && Array.isArray(state.candidates) && Number.isFinite(d.votes) && d.result !== 'added') {
          const c = state.candidates.find((x) => x.address === address);
          if (c) c.votes = Math.max(c.votes, d.votes);
        }
        load({ fresh: true });
      } else {
        nomStatus.textContent = say(NOM_ERRORS, d.error || 'error', d);
      }
    } catch (err) {
      nomStatus.textContent = say(NOM_ERRORS, err.message);
    } finally {
      nomBusy = false;
      nomKey = '';
      renderNominations();
    }
  }
  nomForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const address = parseCoinInput(nomInput.value);
    if (!address) { nomStatus.textContent = NOM_ERRORS.bad_link; nomInput.focus(); return; }
    const inArena = coins.find((c) => c.address === address);
    if (inArena) { nomStatus.textContent = NOMINATED.listed({ symbol: inArena.symbol }); return; }
    const listed = state?.candidates?.find((c) => c.address === address);
    nominate(address, listed?.symbol);
  });

  // ---------- the coin list and the champion, for the rest of the page ----------
  function announce() {
    const key = coins.map((c) => `${c.symbol}:${c.address}`).join(',');
    if (key !== coinsKey) {
      coinsKey = key;
      dispatchEvent(new CustomEvent('agi:coins', { detail: { coins: coins.map((c) => ({ symbol: c.symbol, address: c.address })) } }));
    }
    const c = latest();
    const info = c ? known.get(c.coin) : null;
    lastChampion = c && info ? { ...info, coin: c.coin, round: c.round, number: c.number, votes: c.votes } : null;
    const champKey = JSON.stringify(lastChampion);
    if (champKey !== championKey) {
      championKey = champKey;
      dispatchEvent(new CustomEvent('agi:arena-champion', { detail: lastChampion }));
    }
  }
  // the stage loads later than this file: it asks for the current champion when it's ready
  addEventListener('agi:arena-champion-request', () => dispatchEvent(new CustomEvent('agi:arena-champion', { detail: lastChampion })));

  function tick() {
    if (!state) { countdownEl.textContent = '--:--'; return; }
    const left = state.endsAt - Date.now();
    roundEl.textContent = String(state.number);
    countdownEl.textContent = left > 0 ? clock(left) : 'counting…';
    const voted = mine && mine.round === state.round;
    if (note === 'idle' || note === 'voted') {
      statusEl.textContent = voted && mine.coin
        ? `You voted for $${mine.coin}. Next round in ${clock(left)}.`
        : voted ? `You already voted this round. Next round in ${clock(left)}.` : NOTES.idle;
    }
    // round over: fetch the new round (the CDN may still hold the old one for a few seconds). Not in hidden tabs.
    if (left <= 0 && Date.now() >= refetchAt && !document.hidden) { refetchAt = Date.now() + 4000; load(); }
  }

  async function load({ fresh = false } = {}) {
    try {
      // `fresh`: right after a nomination, skip the CDN's copy (a new address is a new copy)
      const res = await fetch(fresh ? `/api/arena?fresh=${Date.now()}` : '/api/arena');
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data.round !== 'number') throw new Error(data.error || 'error');
      if (state && data.round < state.round) return;          // an older cached answer: keep what we have
      const crown = data.recent?.[0]?.round ?? null;
      if (lastCrown !== null && crown !== null && crown > lastCrown) {
        // a new champion was crowned while the page was open: AGI-1 reacts on stage and in her chat
        const champ = data.recent[0];
        dispatchEvent(new CustomEvent('agi1:react', { detail: champ.coin === 'AGI' ? 'love' : 'jealous' }));
        dispatchEvent(new CustomEvent('agi:champion', {
          detail: { round: champ.round, number: champ.number, coin: champ.coin, votes: champ.votes, mine: myPick(champ.round) === champ.coin, coinName: known.get(champ.coin)?.name || '' },
        }));
      }
      if (crown !== null) lastCrown = Math.max(lastCrown ?? crown, crown);
      if (state && data.round === state.round) {
        // keep our own just-counted vote even if this answer is a few seconds old
        for (const [k, v] of Object.entries(state.tally)) data.tally[k] = Math.max(data.tally[k] || 0, v);
      }
      if (Array.isArray(data.coins) && data.coins.length) {
        coins = data.coins;
        known = new Map([...(data.retired || []), ...data.coins].map((c) => [c.symbol, c]));
      }
      if (data.candidates === undefined) data.candidates = null;
      state = data;
      if (note !== 'voted') note = 'idle';
      render();
      announce();
    } catch (err) {
      note = NOTES[err.message] ? err.message : 'busy';
      statusEl.textContent = NOTES[note];
      render();
    }
  }

  async function vote(symbol) {
    if (busy || !state) return;
    busy = true;
    render();
    statusEl.textContent = 'Counting your vote…';
    try {
      const r = await withHuman(humanBox, 'vote', (extra) => postJson('/api/vote', { coin: symbol, ...extra }));
      if (r.ok && r.data.ok) {
        mine = { round: r.data.round, coin: symbol };
        store.set(MINE_KEY, mine);
        myVotes = [...myVotes.filter((v) => v.round !== mine.round), mine].slice(-100);
        store.set(LOG_KEY, myVotes);
        if (r.data.round === state.round) state.tally[symbol] = (state.tally[symbol] || 0) + 1;
        note = 'voted';
      } else if (r.data.error === 'already_voted') {
        mine = { round: r.data.round, coin: mine?.round === r.data.round ? mine.coin : null };
        store.set(MINE_KEY, mine);
        note = 'voted';
      } else {
        note = NOTES[r.data.error] ? r.data.error : 'error';
        statusEl.textContent = NOTES[note];
        if (note === 'bad_coin') load({ fresh: true });
      }
    } catch (err) {
      note = NOTES[err.message] ? err.message : 'error';
      statusEl.textContent = NOTES[note];
    } finally {
      busy = false;
      render();
      if (note !== 'voted') setTimeout(() => { if (note !== 'voted') { note = 'idle'; tick(); } }, 6000);
    }
  }

  addEventListener('agi:prices', (e) => { prices = e.detail.tokens || {}; if (state) render(); });

  // Poll every 15 s only while the Arena is on screen and the tab is visible; the countdown ticks every second.
  // While only the Playground (AGI-1's chat) is on screen, one check after each round is enough for her to react.
  const schedule = () => {
    clearInterval(pollTimer);
    pollTimer = visible && !document.hidden ? setInterval(load, POLL_MS) : null;
  };
  new IntersectionObserver((entries) => {
    const was = visible;
    visible = entries.some((e) => e.isIntersecting);
    if (visible && !was) load();
    schedule();
  }, { rootMargin: '200px' }).observe(root);
  const playground = document.getElementById('playground');
  if (playground) {
    new IntersectionObserver((entries) => {
      const was = playgroundVisible;
      playgroundVisible = entries.some((e) => e.isIntersecting);
      if (playgroundVisible && !was && !state) load();       // learn the current champion, so the next one is news
    }).observe(playground);
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && (visible || playgroundVisible)) load();
    schedule();
  });
  setInterval(() => { if (state) tick(); }, 1000);
  render();
  // Load the scoreboard once as soon as the browser is idle, even before the Arena is on screen, so the Vote
  // buttons are ready for keyboard users tabbing through and for fast scrollers, and the stage learns the champion.
  // (Cheap: the CDN shares it.)
  const firstLoad = () => { if (!state) load(); };
  if ('requestIdleCallback' in window) requestIdleCallback(firstLoad, { timeout: 4000 });
  else setTimeout(firstLoad, 2000);
}
