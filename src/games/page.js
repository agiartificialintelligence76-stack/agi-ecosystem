// AGI games (agi1.app/games, games.html, 2026-10-19, the owner: "the word GAMES on TOP will be written as GAME beta … theres
// also a rating stars and how many people have played it, dont need sign in a wallet to play it its optional", then "if they
// want to rate it and review and put a comment they need to sign in wallet signature only not transaction. but on how many
// times played it will still be recorded no need sign in"): each game's numbers (/api/wallet?game=…: its stars, players and
// plays), its ratings and reviews, and rating it: 18+, the site's own wallet sign-in (src/lib/wallet.js: an address, the
// network it's on and one free signature, never a transaction) and the human check. Playing needs none of this (each game
// counts its own runs: src/games/<game>/site.js). Its words are in the page and src/games/words.js; everything here is set
// with textContent, and its CSS variables through the CSS object model (the CSP allows no style attributes).
// Since 2026-10-21 two games (Ride 'Em, AGI! and TRENCHING SIMULATOR): a card on the shelf and a tab of ratings for each
// (mountGame: one game's numbers, reviews and box), one wallet session and 18+ answer for all of them (createSession:
// connecting a wallet in one game's box connects them all), and a link to a game's ratings opens its tab (startTabs).
// Since 2026-10-22 the leaderboards' section too (./leaderboard.js: each game's boards and the optional name).
import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/layout.css';
import '../styles/sections.css';
import '../styles/footer.css';
import '../styles/diary.css';      // (the short safety paragraph above the bottom bar)
import '../styles/games.css';
import '../styles/pop.css';        // Pop mode: the bold look, only while it's switched on
import { startTheme } from '../theme.js';
import { startMenu } from '../menu.js';
import { withHuman, postJson } from '../lib/human.js';
import { findWallets, signInWithWallet, explainWalletError } from '../lib/wallet.js';
import { isGame, STARS } from './list.js';
import {
  WALLET_STEPS, NO_WALLET, BADGE, STAR_PATH, starsPath, starsLabel, pickText, fillWidth, avgText, ratingsText, countText,
  barWidth, playedText, cardStats, dateText, adjustStats, placeReview, mergeMine, appendPage, BOX, moreText, meText, savedText,
  deletedText, reviewError, gameOfHash, tileStats, shownText,
} from './words.js';
import { startBoards } from './leaderboard.js';
import { GAMES } from './list.js';
import { SHELF, FILTERS, SORTS, sortShelf, inFilter } from './shelf.js';

// the site's 18+ answer and wallet session (the home page's and her live page's too: a wallet connected there is connected
// here), { session, wallet, level, name, notes }
const KEYS = { adult: 'agi1_18plus', wallet: 'agi_wallet' };
const API = '/api/wallet';
const RETRY_MS = 20_000;        // our server didn't answer: asked once more after this
const ARMED_MS = 4_000;         // "Tap again to delete" lasts this long
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode: this visit only */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};
const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const SVG = 'http://www.w3.org/2000/svg';
const svgOf = (className, viewBox, d) => {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute('d', d);
  svg.append(path);
  return svg;
};

// what our server says, checked (anything odd counts as nothing)
const nat = (n) => Number.isSafeInteger(n) && n >= 0;
const numbersOf = (d) => ({
  open: d.open === true,
  plays: nat(d.plays) ? d.plays : null,
  players: nat(d.players) ? d.players : null,
  ratings: nat(d.ratings) ? d.ratings : 0,
  average: typeof d.average === 'number' && Number.isFinite(d.average) ? d.average : null,
  stars: STARS.map((_, i) => (nat(d.stars?.[i]) ? d.stars[i] : 0)),
});
const isReview = (r) => Boolean(r) && typeof r === 'object' && Number.isSafeInteger(r.id) && STARS.includes(r.stars) && typeof r.at === 'string';
const walletOf = (v) => (v && typeof v.session === 'string' && v.session && /^0x[0-9a-f]{40}$/i.test(String(v.wallet)) ? v : null);
const sameWallet = (a, b) => Boolean(a && b) && String(a.wallet).toLowerCase() === String(b.wallet).toLowerCase();

// a row of five stars, filled to `value` (two drawings of it: the top one cut to its width, --gm-fill)
function setStars(node, value, label) {
  node.style.setProperty('--gm-fill', fillWidth(value));
  node.setAttribute('aria-label', label);
}
function starRow(value, label, size) {
  const row = el('span', `gm-stars ${size}`);
  row.setAttribute('role', 'img');
  row.append(svgOf('gm-stars-svg gm-stars-base', '0 0 120 24', starsPath()), svgOf('gm-stars-svg gm-stars-fill', '0 0 120 24', starsPath()));
  setStars(row, value, label);
  return row;
}

// ---------- the wallet session and the 18+ answer: the site's own, one for every game's box ----------
// A box that connects a wallet, renews its session, finds it ended or disconnects it tells the session, and every box
// follows (each asks our server for its own game's review once it shows); so does another tab doing the same
function createSession() {
  const boxes = [];
  const s = {
    me: walletOf(store.get(KEYS.wallet)),
    adult: () => store.get(KEYS.adult) === true,
    add(box) { boxes.push(box); },
    each(fn) { for (const box of boxes) fn(box); },
    // a wallet signed in, or its session renewed (its level read again on the chain): kept for the whole site
    keep(p) {
      const next = walletOf({ session: p.session, wallet: p.wallet, level: p.level, name: p.name ?? null, notes: p.notes || [] });
      if (!next) return;
      const changed = !sameWallet(next, s.me);
      s.me = next;
      store.set(KEYS.wallet, next);
      s.each((box) => box.walletChanged(changed));
    },
    // disconnected here, or a session our server can't read any more: this browser forgets it (everywhere on the site)
    forget() {
      s.me = null;
      store.del(KEYS.wallet);
      s.each((box) => box.walletChanged(true));
    },
    // connected, disconnected or forgotten in another tab (the home page's too), or 18+ answered there: this page follows
    follow(e) {
      if (e.key === KEYS.wallet || e.key === null) {
        const next = walletOf(store.get(KEYS.wallet));
        const changed = !sameWallet(next, s.me);
        s.me = next;
        s.each((box) => box.walletChanged(changed));
      } else if (e.key === KEYS.adult) s.each((box) => box.render());
    },
  };
  return s;
}

// ---------- one game: its card on the shelf, its numbers, its reviews and rating it ----------
// `rate`: its ratings' panel ([data-gm-rate="<game>"]), where everything it reads and writes is
function mountGame(rate, session) {
  const GAME = rate.dataset.gmRate;
  const card = $(`[data-gm-game="${GAME}"]`);
  const ui = {
    avg: $('[data-gm-avg]', rate), avgStars: $('[data-gm-avg-stars]', rate), count: $('[data-gm-count]', rate),
    played: $('[data-gm-played]', rate),
    bar: Object.fromEntries(STARS.map((n) => [n, $(`[data-gm-bar="${n}"]`, rate)])),
    barN: Object.fromEntries(STARS.map((n) => [n, $(`[data-gm-bar-n="${n}"]`, rate)])),
    states: [...rate.querySelectorAll('[data-gm-state]')],
    adult: $('[data-gm-adult]', rate),
    say: $('[data-gm-say]', rate), connect: $('[data-gm-connect]', rate), wallets: $('[data-gm-wallets]', rate),
    apps: $('[data-gm-apps]', rate), appsNote: $('[data-gm-apps-note]', rate),
    me: $('[data-gm-me]', rate), out: $('[data-gm-out]', rate), mineLoading: $('[data-gm-mine-loading]', rate),
    mine: $('[data-gm-mine]', rate), mineStars: $('[data-gm-mine-stars]', rate), mineName: $('[data-gm-mine-name]', rate),
    mineText: $('[data-gm-mine-text]', rate), mineHidden: $('[data-gm-mine-hidden]', rate),
    edit: $('[data-gm-edit]', rate), del: $('[data-gm-delete]', rate),
    form: $('[data-gm-form]', rate), formTitle: $('[data-gm-form-title]', rate), formNote: $('[data-gm-form-note]', rate),
    radios: [...rate.querySelectorAll('input[name="gm-stars"]')], pickWords: $('[data-gm-pick-words]', rate),
    text: $('[data-gm-text]', rate), countText: $('[data-gm-count-text]', rate), name: $('[data-gm-name]', rate),
    human: $('[data-gm-human]', rate), error: $('[data-gm-error]', rate), send: $('[data-gm-send]', rate),
    cancel: $('[data-gm-cancel]', rate), done: $('[data-gm-done]', rate),
    empty: $('[data-gm-empty]', rate), list: $('[data-gm-list]', rate), listSay: $('[data-gm-list-say]', rate),
    more: $('[data-gm-more]', rate),
  };
  const stars = ui.radios.map((r) => r.nextElementSibling);      // each radio's label: its star

  let stats;                       // undefined: loading; null: none (not set up, or our server didn't answer); else its numbers
  let list = [];                   // the reviews shown, newest first
  let more = false;                // more to load ("Show more reviews")
  let mine;                        // this wallet's review: undefined (not known yet), null (none), a review, or 'failed'
  let mineAskFor = null;           // the wallet its review is being asked for
  let editing = false, sending = false, removing = false;
  const myReview = () => (isReview(mine) ? mine : null);
  const shown = () => !rate.closest('[hidden]');    // its tab picked (a hidden box asks our server nothing about the wallet)

  // ---------- its numbers, and the reviews ----------
  let retried = false;
  async function loadStats() {
    let res = null, data = {};
    try {
      res = await fetch(`${API}?game=${GAME}`);
      data = await res.json().catch(() => ({}));
    } catch { /* offline */ }
    if (res?.ok && data.ready === true) {
      stats = numbersOf(data);
      list = appendPage([], data.reviews);
      more = data.more === true;
      if (myReview()) list = mergeMine(list, myReview(), { more });
    } else {
      stats = null;
      // a hiccup (offline, or our server busy): once more after a while; never for "not set up yet" or a game it doesn't know
      if (!retried && (!res || res.status >= 500)) { retried = true; setTimeout(loadStats, RETRY_MS); }
    }
    renderAll();
  }

  // its tile in the picker: its rating ("4.8" and a star, or "New") and its plays ("1.2K plays")
  function renderCard() {
    if (!card) return;
    const c = tileStats(stats, { loading: stats === undefined });
    const rating = $('[data-gm-stat="rating"]', card);
    if (rating) {
      rating.replaceChildren();
      if (c.rating.star) rating.append(svgOf('gm-stat-star', '0 0 24 24', STAR_PATH));
      rating.append(document.createTextNode(c.rating.value));
      if (c.rating.star) rating.append(el('span', 'sr-only', ' out of 5'));
      rating.hidden = !c.rating.value;
    }
    const plays = $('[data-gm-stat="plays"]', card);
    if (plays) { plays.textContent = c.plays; plays.hidden = !c.plays; }
    if (stats) shelfStats.set(GAME, stats);
    shelfChanged();
  }

  function renderSummary() {
    const s = stats;
    ui.avg.textContent = s === undefined ? '…' : s && s.ratings > 0 ? avgText(s.average) : '—';
    setStars(ui.avgStars, s && s.ratings > 0 ? s.average : 0,
      s === undefined ? 'Loading its rating' : s && s.ratings > 0 ? `Rated ${avgText(s.average)} out of 5` : 'No ratings yet');
    ui.count.textContent = s === undefined ? 'Loading…' : s ? ratingsText(s.ratings) : BOX.statsSoon;
    for (const n of STARS) {
      const k = s ? s.stars[n - 1] : null;
      ui.bar[n]?.style.setProperty('--gm-w', s ? barWidth(k, s.ratings) : '0%');
      if (ui.barN[n]) ui.barN[n].textContent = s ? countText(k) : '—';
    }
    ui.played.textContent = s === undefined ? '…' : playedText(s?.plays, s?.players);
  }

  function reviewItem(r) {
    const li = el('li', 'gm-review');
    li.tabIndex = -1;
    const top = el('div', 'gm-review-top');
    top.append(starRow(r.stars, starsLabel(r.stars), 'gm-stars-sm'));
    const who = el('span', 'gm-review-who', typeof r.name === 'string' && r.name ? r.name : BOX.anon);
    if (BADGE[r.level]) who.append(el('span', 'gm-badge', `💜 ${BADGE[r.level]}`));
    if (myReview()?.id === r.id) who.append(el('span', 'gm-you', 'Yours'));
    top.append(who);
    const at = el('time', 'gm-review-at', `${dateText(r.at)}${r.edited ? ' · edited' : ''}`);
    at.dateTime = r.at;
    top.append(at);
    li.append(top);
    if (r.text) li.append(el('p', 'gm-review-text', r.text));
    return li;
  }
  function renderList() {
    ui.list.replaceChildren(...list.map(reviewItem));
    ui.empty.textContent = stats ? BOX.empty : BOX.reviewsSoon;
    ui.empty.hidden = stats === undefined || list.length > 0;
    ui.more.hidden = !more || !list.length;
  }

  // ---------- rating it: one state at a time ----------
  function boxState() {
    if (stats === undefined) return 'loading';
    if (!stats) return 'soon';
    if (!stats.open) return 'closed';
    if (!session.adult()) return 'gate';
    if (!session.me) return 'connect';
    return 'form';
  }
  function renderBox() {
    const state = boxState();
    for (const node of ui.states) node.hidden = node.dataset.gmState !== state;
    if (state === 'form') renderForm();
  }
  function renderForm() {
    ensureMine();
    ui.me.textContent = meText(session.me);
    const r = myReview();
    ui.mineLoading.hidden = mine !== undefined;
    ui.mine.hidden = !r || editing;
    if (r) {
      setStars(ui.mineStars, r.stars, starsLabel(r.stars));
      ui.mineName.textContent = typeof r.name === 'string' && r.name ? r.name : BOX.anon;
      ui.mineText.textContent = r.text || '';
      ui.mineHidden.hidden = !r.hidden;
    }
    ui.form.hidden = mine === undefined || (Boolean(r) && !editing);
    ui.cancel.hidden = !(r && editing);
    ui.formTitle.textContent = r ? BOX.title.edit : BOX.title.new;
    const note = mine === 'failed' ? BOX.mineFailed : '';
    ui.formNote.textContent = note;
    ui.formNote.hidden = !note;
    ui.send.disabled = sending;
    ui.send.textContent = sending ? BOX.send.busy : r ? BOX.send.edit : BOX.send.new;
  }
  function renderAll() {
    renderCard();
    renderSummary();
    renderList();
    renderBox();
  }
  const done = (text) => { ui.done.textContent = text || ''; };
  const showError = (text) => { ui.error.textContent = text || ''; };
  const connectSay = (text) => { ui.say.textContent = text || ''; ui.say.hidden = !text; };

  // ---------- 18+ (the site's own answer: every game's box follows) ----------
  ui.adult.addEventListener('click', () => {
    store.set(KEYS.adult, true);
    session.each((box) => box.render());
    (session.me ? ui.out : ui.connect).focus({ preventScroll: true });
  });

  // ---------- connecting a wallet (the same sign-in as the home page's and her live page's) ----------
  let attempt = 0;                // the wallet picked last (an older one that answers late is left behind)
  // a wallet's session: the one this browser has for that address (its level re-read when due), else a new sign-in
  async function sessionFor(provider, address) {
    const saved = walletOf(store.get(KEYS.wallet));
    if (saved && saved.wallet.toLowerCase() === address) {
      try {
        const r = await postJson(API, { action: 'profile', session: saved.session });
        if (r.ok) return r.data;
      } catch { /* offline: sign in below */ }
    }
    return signInWithWallet(provider, (step) => connectSay(WALLET_STEPS[step]));
  }
  async function connect(w) {
    const mineNow = ++attempt;
    const slow = setTimeout(() => { if (mineNow === attempt) connectSay(WALLET_STEPS.slow); }, 15_000);
    connectSay(WALLET_STEPS.connect);
    try {
      const accounts = await w.provider.request({ method: 'eth_requestAccounts' });
      if (mineNow !== attempt) return;
      const address = Array.isArray(accounts) && typeof accounts[0] === 'string' ? accounts[0].toLowerCase() : '';
      if (!/^0x[0-9a-f]{40}$/.test(address)) throw new Error('no_account');
      const profile = await sessionFor(w.provider, address);
      if (mineNow !== attempt) return;
      if (String(profile.wallet).toLowerCase() !== address) throw new Error('wrong_signer');
      connectSay('');
      done('');
      ui.wallets.hidden = true;
      ui.apps.hidden = true;
      session.keep(profile);
      renderAll();
      ui.out.focus({ preventScroll: true });
    } catch (err) {
      if (mineNow === attempt) connectSay(explainWalletError(err));
    } finally {
      clearTimeout(slow);
    }
  }
  ui.connect.addEventListener('click', async () => {
    connectSay('Looking for wallets…');
    const found = await findWallets();
    connectSay('');
    ui.wallets.replaceChildren(...found.map((w) => {
      const b = el('button', 'btn btn-ghost btn-sm gm-wallet');
      b.type = 'button';
      if (w.icon) {
        const img = el('img');
        img.src = w.icon; img.alt = ''; img.width = 18; img.height = 18;
        b.append(img);
      }
      b.append(document.createTextNode(w.name));
      b.addEventListener('click', () => connect(w));
      return b;
    }));
    ui.wallets.hidden = !found.length;
    ui.apps.hidden = found.length > 0;
    if (found.length) { ui.wallets.querySelector('button')?.focus(); return; }
    // no wallet in this browser: open the page in a wallet app's own browser
    ui.appsNote.textContent = matchMedia('(pointer: coarse)').matches ? NO_WALLET.phone : NO_WALLET.computer;
    const here = location.href.split('#')[0];
    $('[data-gm-app="metamask"]', rate).href = `https://metamask.app.link/dapp/${location.host}${location.pathname}`;
    $('[data-gm-app="phantom"]', rate).href = `https://phantom.app/ul/browse/${encodeURIComponent(here)}?ref=${encodeURIComponent(location.origin)}`;
    $('[data-gm-app="coinbase"]', rate).href = `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(here)}`;
  });
  ui.out.addEventListener('click', () => {
    done('');
    session.forget();
    ui.connect.focus({ preventScroll: true });
  });
  // the session ended (our server can't read it any more): this browser forgets it, and says so where you connect again
  function signedOut() {
    session.forget();
    connectSay(reviewError('signed_out'));
    ui.connect.focus({ preventScroll: true });
  }

  // ---------- this wallet's own review ----------
  function ensureMine() {
    const me = session.me;
    if (!me || mine !== undefined || sameWallet(me, { wallet: mineAskFor }) || !shown()) return;
    loadMine(me);
  }
  async function loadMine(asked) {
    mineAskFor = asked.wallet;
    let r;
    try {
      r = await postJson(API, { action: 'game-mine', game: GAME, session: asked.session });
    } catch {
      r = { ok: false, status: 0, data: {} };
    }
    if (!sameWallet(session.me, asked)) return;           // disconnected, or another wallet, meanwhile
    mineAskFor = null;
    const d = r.data || {};
    if (r.status === 401 && d.error === 'signed_out') { signedOut(); return; }
    if (r.ok && (d.review === null || isReview(d.review))) {
      mine = d.review;
      if (mine) list = mergeMine(list, mine, { more });
    } else {
      mine = 'failed';
    }
    // (its level read again on the chain comes back with a new session: kept for every box, after this one knows its review)
    if ([1, 2, 3].includes(d.level)) session.keep({ ...session.me, ...(typeof d.session === 'string' ? { session: d.session } : {}), level: d.level });
    renderAll();
  }

  // ---------- the form ----------
  const picked = () => Number(ui.radios.find((r) => r.checked)?.value) || 0;
  function paint(n) {
    stars.forEach((s, i) => s?.classList.toggle('is-on', i < n));
    ui.pickWords.textContent = pickText(n);
  }
  for (const r of ui.radios) r.addEventListener('change', () => { paint(picked()); showError(''); });
  stars.forEach((s, i) => {
    s?.addEventListener('pointerenter', () => paint(i + 1));
    s?.addEventListener('pointerleave', () => paint(picked()));
  });
  const countWords = () => { ui.countText.textContent = String([...ui.text.value].length); };
  ui.text.addEventListener('input', () => { countWords(); showError(''); });
  ui.name.addEventListener('input', () => showError(''));
  function fillForm(r) {
    for (const radio of ui.radios) radio.checked = Number(radio.value) === (r?.stars || 0);
    ui.text.value = r?.text || '';
    ui.name.value = typeof r?.name === 'string' ? r.name : '';
    paint(picked());
    countWords();
    showError('');
  }
  function resetForm() {
    editing = false;
    fillForm(null);
  }
  ui.edit.addEventListener('click', () => {
    const r = myReview();
    if (!r) return;
    editing = true;
    fillForm(r);
    done('');
    renderForm();
    ui.formTitle.focus();
  });
  ui.cancel.addEventListener('click', () => {
    resetForm();
    renderForm();
    ui.edit.focus();
  });

  ui.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (sending || !session.me) return;
    const n = picked();
    if (!n) { showError(BOX.needStars); ui.radios[0]?.focus(); return; }
    const text = ui.text.value.trim(), name = ui.name.value.trim();
    const sent = session.me, before = myReview();
    sending = true;
    showError('');
    done('');
    renderForm();
    let r;
    try {
      r = await withHuman(ui.human, 'review', (extra) => postJson(API, { action: 'game-review', game: GAME, session: sent.session, stars: n,
        ...(text ? { text } : {}), ...(name ? { name } : {}), adult: true, ...extra }));
    } catch (err) {
      r = { ok: false, status: 0, data: { error: err.message === 'offline' ? 'offline_net' : err.message === 'not_configured' ? 'not_configured' : 'human_check' } };
    }
    sending = false;
    const d = r.data || {};
    const still = sameWallet(session.me, sent);
    if (still && r.status === 401 && d.error === 'signed_out') { signedOut(); return; }
    if (r.ok && d.ok === true && isReview(d.review)) {
      // its numbers and the list without asking our server again (its answer is shared for a minute); an earlier review
      // this page didn't know about leaves the numbers as they are (the list replaces it: an edit keeps its id)
      if (d.created === true || before) stats = adjustStats(stats, { before, after: d.review });
      list = placeReview(list, d.review, { remove: before, more });
      if (still) { mine = d.review; resetForm(); }
      if (still && [1, 2, 3].includes(d.level)) session.keep({ ...session.me, ...(typeof d.session === 'string' ? { session: d.session } : {}), level: d.level });
      done(savedText({ created: d.created === true, hidden: d.review.hidden === true }));
      renderAll();
      if (still) ui.mine.focus({ preventScroll: true });
      return;
    }
    if (still && [1, 2, 3].includes(d.level)) session.keep({ ...session.me, ...(typeof d.session === 'string' ? { session: d.session } : {}), level: d.level });
    showError(reviewError(d.error, { why: d.why }));
    renderAll();
    (d.error === 'name' ? ui.name : d.error === 'words' ? ui.text : ui.send).focus();
  });

  // ---------- deleting it: two taps ----------
  let armed = null;
  function disarm() {
    clearTimeout(armed);
    armed = null;
    ui.del.classList.remove('is-armed');
    ui.del.textContent = BOX.remove.idle;
  }
  ui.del.addEventListener('click', async () => {
    if (removing || !session.me || !myReview()) return;
    if (!armed) {
      ui.del.classList.add('is-armed');
      ui.del.textContent = BOX.remove.armed;
      armed = setTimeout(disarm, ARMED_MS);
      return;
    }
    disarm();
    const sent = session.me, before = myReview();
    removing = true;
    ui.del.disabled = true;
    ui.del.textContent = BOX.remove.busy;
    done('');
    let r;
    try {
      r = await postJson(API, { action: 'game-review-delete', game: GAME, session: sent.session });
    } catch {
      r = { ok: false, status: 0, data: { error: 'offline_net' } };
    }
    removing = false;
    ui.del.disabled = false;
    ui.del.textContent = BOX.remove.idle;
    const d = r.data || {};
    const still = sameWallet(session.me, sent);
    if (still && r.status === 401 && d.error === 'signed_out') { signedOut(); return; }
    if (r.ok && d.ok === true) {
      if (d.removed === true) {
        stats = adjustStats(stats, { before });
        list = placeReview(list, null, { remove: before });
      }
      if (still) { mine = null; resetForm(); }
      done(deletedText(d.removed === true));
      renderAll();
      if (still) ui.formTitle.focus({ preventScroll: true });
      return;
    }
    done(reviewError(d.error));
    ui.del.focus();
  });

  // ---------- "Show more reviews" ----------
  ui.more.addEventListener('click', async () => {
    if (!list.length || ui.more.disabled) return;
    const last = Math.min(...list.map((r) => r.id));
    ui.more.disabled = true;
    ui.more.textContent = BOX.more.busy;
    let added = -1, firstNew = null;
    try {
      const res = await fetch(`${API}?game=${GAME}&before=${last}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ready === true && Array.isArray(data.reviews)) {
        const known = new Set(list.map((r) => r.id));
        list = appendPage(list, data.reviews);
        more = data.more === true;
        if (myReview()) list = mergeMine(list, myReview(), { more });
        const fresh = list.filter((r) => !known.has(r.id));
        added = fresh.length;
        firstNew = fresh[0]?.id ?? null;
      }
    } catch { /* offline */ }
    ui.more.disabled = false;
    ui.more.textContent = BOX.more.idle;
    renderList();
    ui.listSay.textContent = added < 0 ? BOX.more.failed : moreText(added);
    // the keyboard: on the first new review (the button may be gone), else where it was
    const index = firstNew === null ? -1 : list.findIndex((r) => r.id === firstNew);
    if (index >= 0) ui.list.children[index]?.focus();
    else if (ui.more.hidden) ui.list.lastElementChild?.focus();
  });

  const box = {
    game: GAME,
    render: renderAll,
    // the wallet changed (another one, or none): its review forgotten, the form emptied; else only its level or session
    walletChanged(changed) {
      if (changed) { mine = undefined; mineAskFor = null; editing = false; resetForm(); }
      renderAll();
    },
    start() {
      renderAll();
      loadStats();
    },
  };
  session.add(box);
  return box;
}

// ---------- a tab for each game's ratings ----------
// The WAI-ARIA tabs pattern: ← and → (Home, End) move between the games and show each one's panel as they go; Tab goes
// on into it. A link to a game's ratings (#rate-<game>, or #rate: Ride 'Em, AGI!'s, from before there were two) opens its
// tab before the browser scrolls there, on this page or when it opens with one.
function startTabs(boxes) {
  const list = $('[data-gm-tabs]');
  const tabs = list ? [...list.querySelectorAll('[role="tab"]')] : [];
  if (!tabs.length) return;
  const panelOf = (tab) => document.getElementById(tab.getAttribute('aria-controls'));
  const tabOf = (game) => tabs.find((t) => t.dataset.gmTab === game) || null;
  function pick(tab, { focus = false } = {}) {
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      const panel = panelOf(t);
      if (panel) panel.hidden = !on;
    }
    if (focus) tab.focus();
    // (fourteen tabs scroll sideways on a phone: the picked one comes into view in its row, never the page)
    const row = list, l = tab.offsetLeft, r = l + tab.offsetWidth;
    if (row.scrollWidth > row.clientWidth && (l < row.scrollLeft || r > row.scrollLeft + row.clientWidth)) {
      try { row.scrollTo({ left: l - 16, behavior: 'smooth' }); } catch { row.scrollLeft = l - 16; }
    }
    boxes.find((b) => b.game === tab.dataset.gmTab)?.render();     // its box drawn as it shows (and asks for your review)
  }
  const picked = (tab) => tab.getAttribute('aria-selected') === 'true';
  list.addEventListener('click', (e) => {
    const tab = e.target.closest('[role="tab"]');
    if (tab && tabs.includes(tab) && !picked(tab)) pick(tab);
  });
  list.addEventListener('keydown', (e) => {
    const i = tabs.indexOf(e.target.closest('[role="tab"]'));
    if (i < 0 || e.altKey || e.ctrlKey || e.metaKey) return;
    const n = tabs.length;
    const to = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    pick(tabs[to], { focus: true });
  });
  // a link to a game's ratings on this page (a card's "Rate it"): its tab first, so the browser finds its panel showing
  const follow = (hash) => {
    const tab = tabOf(gameOfHash(hash));
    if (tab && !picked(tab)) pick(tab);
    return tab;
  };
  document.addEventListener('click', (e) => {
    const a = e.target.closest?.('a[href^="#rate"]');
    if (a) follow(a.getAttribute('href'));
  });
  addEventListener('hashchange', () => follow(location.hash));
  // the page opened at a game's ratings: its tab, then its panel in view (it was hidden when the browser looked for it)
  const tab = tabOf(gameOfHash(location.hash));
  if (tab && !picked(tab)) {
    pick(tab);
    const target = document.getElementById(location.hash.slice(1));
    if (target) {
      try { target.scrollIntoView({ block: 'start', behavior: 'instant' }); } catch { target.scrollIntoView(true); }
    }
  }
}

// ---------- each game's ratings panel, from the page's one template (2026-11-08: fourteen games) ----------
// games.html has an empty panel per game (its tab's) and one <template> of a panel's insides, written for "GAMEID" and
// "GAMENAME": each panel gets its own copy, with its own ids
const NAMED = ['id', 'for', 'aria-labelledby', 'aria-describedby', 'aria-controls'];
function fillPanels() {
  const tpl = document.getElementById('gm-panel-tpl');
  if (!tpl) return;
  for (const panel of document.querySelectorAll('[data-gm-rate]')) {
    const game = panel.dataset.gmRate;
    if (!isGame(game) || panel.childElementCount) continue;
    const copy = tpl.content.cloneNode(true);
    for (const node of copy.querySelectorAll('*')) {
      for (const a of NAMED) {
        const v = node.getAttribute(a);
        if (v && v.includes('GAMEID')) node.setAttribute(a, v.replaceAll('GAMEID', game));
      }
    }
    const walk = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT);
    for (let t = walk.nextNode(); t; t = walk.nextNode()) if (t.data.includes('GAMENAME')) t.data = t.data.replaceAll('GAMENAME', GAMES[game].name);
    panel.append(copy);
  }
}

// ---------- the picker: filters, the sort, and each tile's gameplay preview ----------
// Every tile shows a still from its game; the ones on screen play a short muted loop of the game playing itself (a few at
// a time, the ones nearest the middle of the screen; on a computer, the one under the mouse first). Nothing plays with
// "reduce motion" or the browser's data saver on: the stills stay. A preview that can't load is never asked again.
const shelfStats = new Map();
let shelfChanged = () => {};
function startShelf() {
  const grid = $('[data-gm-grid]');
  if (!grid) return;
  const tiles = new Map([...grid.querySelectorAll('[data-gm-game]')].map((li) => [li.dataset.gmGame, li]));
  const shown = $('[data-gm-shown]');
  const chips = [...document.querySelectorAll('[data-gm-filter]')];
  const sortPick = $('[data-gm-sort]');
  let filter = 'all', sort = 'featured';
  const labelOf = (list, id) => list.find((x) => x.id === id)?.label || '';

  function order() {
    const list = sortShelf(sort, Object.fromEntries(shelfStats));
    const now = [...grid.children].map((li) => li.dataset.gmGame).join();
    if (now !== list.map((g) => g.id).join()) for (const g of list) { const li = tiles.get(g.id); if (li) grid.append(li); }
    for (const g of SHELF) { const li = tiles.get(g.id); if (li) li.hidden = !inFilter(g, filter); }
    pickPlaying();
  }
  const say = () => { if (shown) shown.textContent = shownText([...tiles.values()].filter((li) => !li.hidden).length, labelOf(FILTERS, filter), labelOf(SORTS, sort)); };
  for (const chip of chips) {
    chip.addEventListener('click', () => {
      filter = chip.dataset.gmFilter;
      for (const c of chips) c.setAttribute('aria-pressed', String(c === chip));
      order(); say();
    });
  }
  sortPick?.addEventListener('change', () => { sort = sortPick.value; order(); say(); });
  // Most played and Top rated follow the numbers as they come in
  shelfChanged = () => { if (sort === 'played' || sort === 'rated') order(); };

  // ---------- previews ----------
  const media = (q) => { try { return matchMedia(q).matches; } catch { return false; } };
  const still = media('(prefers-reduced-motion: reduce)') || navigator.connection?.saveData === true;
  const fine = media('(hover: hover) and (pointer: fine)');
  const MAX = fine ? 6 : 4;
  const seen = new Map();                 // a tile → how much of it is on screen (0 to 1)
  let hovered = null;
  const vids = new Map([...tiles].map(([id, li]) => [id, li.querySelector('[data-gm-video]')]));
  function play(id) {
    const v = vids.get(id), li = tiles.get(id);
    if (!v || li.dataset.gmNoVideo !== undefined) return;
    if (!v.getAttribute('src')) {
      v.addEventListener('playing', () => li.classList.add('is-live'), { once: false });
      v.addEventListener('error', () => { li.dataset.gmNoVideo = ''; li.classList.remove('is-live'); }, { once: true });
      v.src = v.dataset.gmVideo;
    }
    if (v.paused) v.play().catch(() => { /* not allowed now: its still stays */ });
  }
  function stop(id) { const v = vids.get(id); if (v && !v.paused) v.pause(); }
  function pickPlaying() {
    if (still || document.visibilityState === 'hidden') { for (const id of vids.keys()) stop(id); return; }
    const mid = innerHeight / 2;
    const ranked = [...seen].filter(([li, r]) => r >= 0.55 && !li.hidden)
      .map(([li]) => { const b = li.getBoundingClientRect(); return [li.dataset.gmGame, Math.abs(b.top + b.height / 2 - mid)]; })
      .sort((a, b) => a[1] - b[1]).map(([id]) => id);
    const on = new Set(ranked.slice(0, MAX));
    if (hovered) on.add(hovered);
    for (const id of vids.keys()) (on.has(id) ? play : stop)(id);
  }
  if (typeof IntersectionObserver === 'function') {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) seen.set(e.target, e.isIntersecting ? e.intersectionRatio : 0);
      pickPlaying();
    }, { threshold: [0, 0.3, 0.55, 0.8, 1] });
    for (const li of tiles.values()) io.observe(li);
  }
  if (fine) {
    for (const [id, li] of tiles) {
      li.addEventListener('pointerenter', () => { hovered = id; pickPlaying(); });
      li.addEventListener('pointerleave', () => { if (hovered === id) hovered = null; pickPlaying(); });
    }
  }
  let scrollT = 0;
  addEventListener('scroll', () => { clearTimeout(scrollT); scrollT = setTimeout(pickPlaying, 120); }, { passive: true });
  document.addEventListener('visibilitychange', pickPlaying);
  say();
}

function start() {
  startTheme();
  startMenu();
  fillPanels();
  startShelf();
  startBoards();          // the leaderboards: asked once their section is near the screen
  const session = createSession();
  const boxes = [...document.querySelectorAll('[data-gm-rate]')]
    .filter((rate) => isGame(rate.dataset.gmRate))
    .map((rate) => mountGame(rate, session));
  if (!boxes.length) return;
  startTabs(boxes);
  addEventListener('storage', (e) => session.follow(e));
  // each game's numbers at once (every tile shows them)
  for (const box of boxes) box.start();
}

start();
