// Community votes (agi1.app/vote, 2026-10-24: the roadmap's "Gamified governance"): vote.html. The polls are in the
// database, their rules in src/vote/polls.js; the numbers come from /api/wallet?votes (the same for everyone), a
// wallet's own votes and voting from /api/wallet (server/vote.js). At agi1.app/vote/owner the same page is the owner's
// (src/vote/owner.js, loaded only there): the public list makes way for the owner's box. The wallet sign-in is the site's own (src/lib/wallet.js): an address
// and a free signature, never a transaction. A wallet connected on the home page, her live page or the games is
// connected here too (the same saved session).
import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/layout.css';
import '../styles/sections.css';
import '../styles/footer.css';
import '../styles/diary.css';      // (the short safety paragraph above the bottom bar)
import '../styles/roadmap.css';    // (the hero and the fine print: the roadmap's coming-soon pages' look)
import '../styles/vote.css';
import '../styles/pop.css';        // Pop mode: the bold look, only while it's switched on
import { startTheme } from '../theme.js';
import { startMenu } from '../menu.js';
import { postJson } from '../lib/human.js';
import { findWallets, signInWithWallet, explainWalletError } from '../lib/wallet.js';
import { VOTE, leader } from './polls.js';
import { agiText, shortWallet, stateText, voteError, WALLET_STEPS, NO_WALLET } from './words.js';

const API = '/api/wallet';
const KEY = 'agi_wallet';          // the site's wallet session: { session, wallet, level, name, notes }
const REFRESH_MS = 60_000;         // the numbers again (the CDN shares them a minute)
const store = {
  get() { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } },
  set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode: this visit only */ } },
  del() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } },
};
const walletOf = (v) => (v && typeof v.session === 'string' && v.session && /^0x[0-9a-f]{40}$/i.test(String(v.wallet)) ? v : null);
const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const ui = {
  meTitle: $('[data-vt-me-title]'), meNote: $('[data-vt-me-note]'), connect: $('[data-vt-connect]'),
  disconnect: $('[data-vt-disconnect]'), wallets: $('[data-vt-wallets]'), say: $('[data-vt-say]'), polls: $('[data-vt-polls]'),
  me: $('[data-vt-me]'), owner: $('[data-vt-owner]'), public: $('[data-vt-public]'),
};
const OWNER = /^\/vote\/owner\/?$/.test(location.pathname);
let ownerBox = null;              // src/vote/owner.js, at agi1.app/vote/owner only
const state = {
  me: walletOf(store.get()),
  polls: null,        // null: not loaded · []: none on
  ready: true,        // false: votes.sql isn't run yet
  mine: {},           // { [poll]: { choice, agi, final } }
  held: null,         // the wallet's $AGI now (null: unknown)
  busy: null,         // `${poll}:${choice}` being sent
  scrolled: false,
};

startTheme();
startMenu();
if (OWNER) startOwnerPage();
renderMe();
if (!OWNER) {
  loadPolls();
  if (state.me) loadMine();
  setInterval(() => { if (!document.hidden) loadPolls(); }, REFRESH_MS);
}
addEventListener('storage', (e) => {
  if (e.key !== KEY && e.key !== null) return;
  const next = walletOf(store.get());
  if (String(next?.wallet || '').toLowerCase() === String(state.me?.wallet || '').toLowerCase()) return;
  state.me = next; state.mine = {}; state.held = null;
  renderMe(); renderPolls();
  if (next) loadMine();
  ownerBox?.refresh();
});

// ---------- the owner's page (agi1.app/vote/owner) ----------
function startOwnerPage() {
  document.title = 'Manage the votes · AGI';
  const robots = document.createElement('meta');
  robots.name = 'robots'; robots.content = 'noindex';
  document.head.append(robots);
  const sub = $('.rm-sub');
  if (sub) sub.textContent = 'The owner\'s page: make votes, add choices, hide or end them.';
  ui.public.hidden = true;
  ui.owner.hidden = false;
  import('./owner.js').then(({ startOwner }) => {
    ownerBox = startOwner({ root: ui.owner, getMe: () => state.me, say, onSignedOut: forget });
    if (state.me) ownerBox.refresh();
  }).catch(() => say('The owner\'s page didn\'t load. Reload to try again.'));
}

// ---------- the numbers ----------
async function loadPolls() {
  let data = null;
  try {
    const res = await fetch(`${API}?votes`);
    data = res.ok ? await res.json() : null;
  } catch { /* offline: keep what's shown */ }
  if (!data) { if (state.polls === null) emptyText('Couldn\'t load the votes. Try again in a minute.'); return; }
  state.ready = data.ready === true;
  state.polls = state.ready && Array.isArray(data.polls) ? data.polls : [];
  renderPolls();
}

function emptyText(text) {
  ui.polls.replaceChildren(el('p', 'vt-empty', text));
}

function renderPolls() {
  if (state.polls === null) return;
  if (!state.ready || !state.polls.length) {
    emptyText(state.ready ? 'No vote is on right now. The next one is announced on X and in the $AGI group on Telegram.'
      : 'Votes open soon. They\'re announced on X and in the $AGI group on Telegram.');
    return;
  }
  // open ones first, then the ones still to open, then the closed ones
  const order = { open: 0, soon: 1, counting: 2, final: 3 };
  const polls = [...state.polls].sort((a, b) => (order[a.state] ?? 9) - (order[b.state] ?? 9));
  ui.polls.replaceChildren(...polls.map(pollCard));
  if (!state.scrolled && location.hash.length > 1) {
    state.scrolled = true;
    document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView({ block: 'start' });
  }
}

function pollCard(p) {
  const card = el('article', `vt-poll is-${p.state}`);
  card.id = p.id;
  const top = el('header', 'vt-poll-top');
  top.append(el('p', `vt-state is-${p.state}`, stateText(p, Date.now())), el('h3', 'vt-q', p.question));
  if (p.about) top.append(el('p', 'vt-about', p.about));
  card.append(top);

  const lead = p.state === 'soon' ? null : leader(p.rows);
  const mine = state.mine[p.id]?.choice ?? null;
  const list = el('ul', 'vt-choices');
  for (const c of p.choices) {
    const row = p.rows.find((r) => r.choice === c.id) || { agi: 0, wallets: 0, share: 0 };
    const li = el('li', 'vt-choice');
    if (c.id === mine) li.classList.add('is-mine');
    if (c.id === lead) li.classList.add('is-lead');
    if (c.picture) {
      const img = el('img', 'vt-pic');
      img.src = c.picture; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; img.width = 96; img.height = 96;
      li.append(img);
    }
    const body = el('div', 'vt-choice-body');
    body.append(el('p', 'vt-label', c.label));
    if (c.note) body.append(el('p', 'vt-note', c.note));
    if (p.state !== 'soon') {
      const bar = el('div', 'vt-bar');
      bar.setAttribute('aria-hidden', 'true');
      const fill = el('span', 'vt-bar-fill');
      fill.style.setProperty('--vt-share', `${row.share}%`);     // (the CSS object model: the CSP allows no style attributes)
      bar.append(fill);
      body.append(bar, el('p', 'vt-nums mono', `${row.share}% · ${agiText(row.agi)} $AGI · ${row.wallets} ${row.wallets === 1 ? 'wallet' : 'wallets'}`));
    }
    li.append(body);
    if (p.state === 'open') li.append(pickButton(p, c, mine));
    else if (c.id === mine) li.append(el('span', 'vt-mine-tag', 'Your vote'));
    list.append(li);
  }
  card.append(list);
  if (p.state !== 'soon') {
    const foot = p.state === 'final' && !lead && p.total > 0 ? ' · a tie' : '';
    card.append(el('p', 'vt-foot mono', `${agiText(p.total)} $AGI from ${p.wallets} ${p.wallets === 1 ? 'wallet' : 'wallets'}${foot}`));
  }
  return card;
}

function pickButton(p, c, mine) {
  const key = `${p.id}:${c.id}`;
  const b = el('button', `btn btn-sm vt-pick ${c.id === mine ? 'btn-primary' : 'btn-ghost'}`,
    state.busy === key ? 'Voting…' : c.id === mine ? 'Your vote ✓' : mine ? 'Change to this' : 'Vote');
  b.type = 'button';
  b.disabled = Boolean(state.busy) || c.id === mine;
  b.setAttribute('aria-label', c.id === mine ? `Your vote: ${c.label}` : `Vote for ${c.label}`);
  b.addEventListener('click', () => vote(p.id, c.id));
  return b;
}

// ---------- voting ----------
async function vote(poll, choice) {
  if (!state.me) {
    say('Connect your wallet first (a free signature, never a transaction).');
    ui.me.scrollIntoView({ block: 'center', behavior: 'smooth' });
    ui.connect.focus({ preventScroll: true });
    return;
  }
  state.busy = `${poll}:${choice}`;
  renderPolls();
  try {
    const r = await postJson(API, { action: 'vote', session: state.me.session, poll, choice });
    if (r.ok) {
      state.mine[poll] = { choice: r.data.choice, agi: r.data.agi, final: null };
      state.held = r.data.agi;
      if (r.data.poll && state.polls) state.polls = state.polls.map((p) => (p.id === poll ? r.data.poll : p));
      say(`Voted with ${agiText(r.data.agi)} $AGI. You can change it until the vote closes.`);
    } else {
      if (r.data.error === 'signed_out') forget();
      if (r.data.error === 'too_few') state.held = r.data.agi ?? state.held;
      if (r.data.error === 'closed') loadPolls();
      say(voteError(r.data));
    }
  } catch {
    say('You seem to be offline.');
  } finally {
    state.busy = null;
    renderMe();
    renderPolls();
  }
}

// ---------- the wallet ----------
async function loadMine() {
  if (!state.me) return;
  if (OWNER) { renderMe(); ownerBox?.refresh(); return; }
  try {
    const r = await postJson(API, { action: 'vote-mine', session: state.me.session });
    if (r.ok) {
      state.mine = r.data.votes && typeof r.data.votes === 'object' ? r.data.votes : {};
      state.held = Number.isSafeInteger(r.data.agi) ? r.data.agi : null;
    } else if (r.data.error === 'signed_out') {
      forget();
      say('Your sign-in ended. Connect your wallet again.');
    }
  } catch { /* offline: try when they vote */ }
  renderMe();
  renderPolls();
}

function renderMe() {
  const me = state.me;
  ui.connect.hidden = Boolean(me);
  ui.disconnect.hidden = !me;
  if (OWNER) {
    ui.meTitle.textContent = me ? `Connected: ${shortWallet(me.wallet)}` : 'Connect the owner\'s wallet';
    ui.meNote.textContent = 'The same wallet as AGI Studio\'s owner page. A free signature, never a transaction.';
    if (me) ui.wallets.hidden = true;
    return;
  }
  if (!me) {
    ui.meTitle.textContent = 'Connect your wallet to vote';
    ui.meNote.textContent = `Anyone can see the results. Voting needs ${agiText(VOTE.minAgi)} $AGI or more in the wallet.`;
    return;
  }
  ui.wallets.hidden = true;
  ui.meTitle.textContent = `Connected: ${shortWallet(me.wallet)}`;
  if (state.held === null) ui.meNote.textContent = 'Your vote counts the $AGI in this wallet when you vote.';
  else if (state.held >= VOTE.minAgi) ui.meNote.textContent = `This wallet holds ${agiText(state.held)} $AGI: that's ${agiText(state.held)} votes.`;
  else ui.meNote.textContent = `This wallet holds ${agiText(state.held)} $AGI. Voting needs ${agiText(VOTE.minAgi)} or more.`;
}

function say(text) { ui.say.textContent = text; }

function forget() {
  state.me = null; state.mine = {}; state.held = null;
  store.del();
  renderMe();
}

ui.disconnect.addEventListener('click', () => {
  forget();
  renderPolls();
  ownerBox?.refresh();
  say('Disconnected. This browser forgot the wallet.');
  ui.connect.focus();
});

let attempt = 0;
ui.connect.addEventListener('click', async () => {
  say('Looking for wallets…');
  ui.connect.disabled = true;
  let list = [];
  try { list = await findWallets(); } finally { ui.connect.disabled = false; }
  if (!list.length) {
    say(matchMedia('(pointer: coarse)').matches ? NO_WALLET.phone : NO_WALLET.computer);
    return;
  }
  if (list.length === 1) { signIn(list[0]); return; }
  say('Pick your wallet.');
  ui.wallets.replaceChildren(...list.map((w) => {
    const li = el('li');
    const b = el('button', 'btn btn-ghost btn-sm vt-wallet');
    b.type = 'button';
    if (w.icon) { const img = el('img', 'vt-wallet-ic'); img.src = w.icon; img.alt = ''; img.width = 20; img.height = 20; b.append(img); }
    b.append(document.createTextNode(w.name));
    b.addEventListener('click', () => signIn(w));
    li.append(b);
    return li;
  }));
  ui.wallets.hidden = false;
});

async function signIn(w) {
  const mine = ++attempt;
  ui.wallets.hidden = true;
  ui.connect.disabled = true;
  try {
    const p = await signInWithWallet(w.provider, (step) => { if (mine === attempt) say(WALLET_STEPS[step] || ''); });
    if (mine !== attempt) return;
    const me = walletOf({ session: p.session, wallet: p.wallet, level: p.level, name: p.name ?? null, notes: p.notes || [] });
    if (!me) throw new Error('error');
    state.me = me;
    store.set(me);
    say(OWNER ? 'Connected.' : 'Connected. Pick a choice to vote.');
    renderMe();
    await loadMine();
  } catch (err) {
    if (mine === attempt) say(explainWalletError(err));
  } finally {
    if (mine === attempt) ui.connect.disabled = false;
  }
}

