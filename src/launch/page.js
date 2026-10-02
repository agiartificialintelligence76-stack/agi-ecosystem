// "Launch with AGI-1" (2026-10-01, the owner's idea): the launch page (agi1.app/launch/<id>, launch.html). Her Telegram bot
// checked the coin with the person (/launch) and sent this private link. Here they:
//   0. confirm they're 18+ (the chat's own confirmation, shared with it);
//   1. connect their OWN wallet: its address and the site's free sign-in signature (src/lib/wallet.js). It needs the chat's
//      Crush level (10,000+ $AGI held or burned): the server reads it fresh before anything else;
//   2. switch to Robinhood Chain, if their wallet is elsewhere (only when they press it);
//   3. pick its pair (ETH, or SPCX since 2026-10-02) and add their coin's links if they like (X, Telegram, a website:
//      optional, src/launch/links.js), then press Launch: our server builds clank.trade's own launch for their wallet and
//      tries it on the chain first (api/launch.js "prepare"); src/launch/send.js checks it's exactly that and asks their
//      wallet to send it; they approve it there; then the page reads the launch back from the chain ("check") and shows
//      the coin.
// The coins a wallet may launch a day follow what it holds (2026-10-02, src/launch/rules.js): our server counts them.
// Nothing here holds a key or sends anything by itself. All text is set with textContent.
import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/layout.css';
import '../styles/sections.css';
import '../styles/footer.css';
import '../styles/diary.css';        // (the short safety paragraph above the bottom bar)
import '../styles/launch.css';
import '../styles/pop.css';          // Pop mode: the bold look, only while it's switched on
import { startTheme } from '../theme.js';
import { startMenu } from '../menu.js';
import { findWallets, signInWithWallet, explainWalletError, userRejected } from '../lib/wallet.js';
import { postJson } from '../lib/human.js';
import { botName } from '../chat/telegram-link.js';
import { walletChain, switchToRobinhood, sendLaunch, ROBINHOOD } from './send.js';
import { draftIdFrom, WORDS, CHECK, STEP, LEVEL_NAME, short, gasText, gasNote, GAS_AGAIN, linkNote, capText } from './words.js';
import { cleanLinks, cleanX, cleanTelegram, cleanWebsite, LINK_FIELDS } from './links.js';

startTheme();
startMenu();

const ADULT = 'agi1_18plus';            // the chat's 18+ confirmation (src/chat/chat.js)
const WALLET = 'agi_wallet';            // the site's wallet session (src/chat/relationship.js): { session, wallet, level, name, notes }
const PENDING = 'agi1_launch_tx';       // a launch sent but not read back yet: { draft, tx } (so a reload keeps waiting;
                                        // once it's read back, our server keeps its transaction for the fee's payback)
const READY = 'agi1_launch_ready';      // the pair and links each link's launch was last got ready with: { <draft>: { pair,
                                        // links } } (the newest 10; a reload shows them again: others make another coin)
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode: this visit only */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};
const $ = (s) => document.querySelector(s);
const show = (el, on = true) => { if (el) el.hidden = !on; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CLANK = (a) => `https://clank.trade/coin/${a}`;
const EXPLORER = (a) => `https://robinhoodchain.blockscout.com/token/${a}`;

const id = draftIdFrom(location);
let draft = null;                       // { name, symbol, description, expires, expired, token, ready, gasBack, gas }
let me = null;                          // { provider, address, session, level }
let chainOk = false;
let busy = false;                       // getting the launch ready, sending it, or waiting for it
let attempt = 0;                        // the latest wallet the person picked (an older one that answers late is left behind)

const status = (text) => { const p = $('[data-lch-status]'); p.textContent = text || ''; show(p, Boolean(text)); };
const note = (step, text) => { const p = $(`[data-lch-${step}-note]`); if (p && text) p.textContent = text; };
const adult = () => store.get(ADULT) === true;
const ready = () => adult() && me && me.level >= 2 && chainOk;

function showBot() {
  const bot = botName(import.meta.env.VITE_TELEGRAM_BOT);
  if (!bot) return;
  $('[data-lch-bot-link]').href = `https://t.me/${bot}`;
  show($('[data-lch-bot]'));
}

function renderSteps() {
  show($('[data-lch-step="adult"]'), !adult());
  $('[data-lch-step="wallet"]').classList.toggle('is-done', Boolean(me && me.level >= 2));
  $('[data-lch-step="chain"]').classList.toggle('is-done', Boolean(me && chainOk));
  // (picking a wallet never waits for another one: a wallet that never answers can't lock the page)
  for (const b of document.querySelectorAll('[data-lch-wallets] button')) b.disabled = busy || !adult();
  $('[data-lch-switch]').disabled = busy;
  for (const field of LINK_FIELDS) linkBox(field).disabled = busy;
  for (const r of pairBoxes()) r.disabled = busy;
  $('[data-lch-go]').disabled = busy || !ready() || !cleanLinks(typedLinks()).ok;
}

// What this link's launch was last got ready with, in this browser (null: forget it, it's launched)
function readyBefore() {
  const all = store.get(READY);
  const mine = all && typeof all === 'object' && !Array.isArray(all) && Object.hasOwn(all, id) ? all[id] : null;
  return mine && typeof mine === 'object' ? mine : null;
}
function rememberReady(what) {
  const all = store.get(READY);
  const kept = Object.entries(all && typeof all === 'object' && !Array.isArray(all) ? all : {}).filter(([k]) => k !== id && /^[A-Za-z0-9_-]{22}$/.test(k));
  if (what) kept.push([id, what]);
  if (kept.length) store.set(READY, Object.fromEntries(kept.slice(-10))); else store.del(READY);
}

// ---------- its pair (2026-10-02): what people trade it against on clank.trade, ETH unless they pick SPCX ----------
const pairBoxes = () => document.querySelectorAll('input[name="lch-pair"]');
const pairChoice = () => ([...pairBoxes()].find((r) => r.checked)?.value === 'spcx' ? 'spcx' : 'eth');
function setPair(choice) {
  for (const r of pairBoxes()) r.checked = r.value === (choice === 'spcx' ? 'spcx' : 'eth');
}

// ---------- the coin's links (optional) ----------
// What they typed, tidied the way our server will save it; under each box what it will be saved as, or what's wrong (an
// error only once they've left the box, or after the server said so: not while they're still typing it)
const CLEAN_ONE = { twitter: cleanX, telegram: cleanTelegram, website: cleanWebsite };
const linkBox = (field) => $(`[data-lch-link="${field}"]`);
const typedLinks = () => Object.fromEntries(LINK_FIELDS.map((field) => [field, linkBox(field).value]));
function showLink(field, { why = 'format', force = false } = {}) {
  const box = linkBox(field), out = $(`[data-lch-link-note="${field}"]`);
  const saved = why === 'format' ? CLEAN_ONE[field](box.value) : null;
  const bad = saved === null;
  if (bad && !force && box.getAttribute('aria-invalid') !== 'true') { out.textContent = ''; return; }
  box.setAttribute('aria-invalid', bad ? 'true' : 'false');
  out.classList.toggle('is-bad', bad);
  out.textContent = linkNote(field, saved, why);
}
for (const field of LINK_FIELDS) {
  linkBox(field).addEventListener('input', () => { showLink(field); renderSteps(); });
  linkBox(field).addEventListener('change', () => { showLink(field, { force: true }); renderSteps(); });
}

function renderCoin() {
  $('[data-lch-name]').textContent = draft.name;
  $('[data-lch-ticker]').textContent = `$${draft.symbol}`;
  const line = $('[data-lch-line]');
  line.textContent = draft.description || '';
  show(line, Boolean(draft.description));
  const pic = $('[data-lch-pic]');
  pic.addEventListener('error', () => pic.classList.add('is-missing'), { once: true });
  pic.alt = `${draft.name}'s picture`;
  pic.src = `/api/launch?pic=${id}`;
  $('[data-lch-go]').textContent = `Launch $${draft.symbol}`;
  if (draft.gasBack) note('launch', gasNote(draft.gasBack));
  show($('[data-lch-coin]'));
}

// The coin is live: the links, and its network fee's payback (again when that changes)
let shown = false;
function done(token, gas = null) {
  busy = false;
  status('');
  show($('[data-lch-steps]'), false);
  show($('[data-lch-bot]'), false);
  $('[data-lch-done-title]').textContent = `$${draft?.symbol || ''} is live on clank.trade 🎉`;
  $('[data-lch-clank]').href = CLANK(token);
  $('[data-lch-explorer]').href = EXPLORER(token);
  // its network fee, paid back by her gas wallet (or why not)
  const text = gasText(gas);
  $('[data-lch-gas-text]').textContent = text;
  const tx = $('[data-lch-gas-tx]');
  const paid = Boolean(gas?.paid && /^0x[0-9a-f]{64}$/.test(String(gas.tx)));
  if (paid) tx.href = `https://robinhoodchain.blockscout.com/tx/${gas.tx}`;
  show(tx, paid);
  show($('[data-lch-gas]'), Boolean(text));
  show($('[data-lch-done]'));
  if (!shown) { shown = true; $('[data-lch-done]').focus?.(); }
}
// Its payback, asked for again while it can still happen in a moment (her gas wallet was busy, or is sending it right
// now): our server pays it from the launch it kept, so this works after a reload too, whoever opens the link
async function settleGas(gas) {
  for (let tries = 0; GAS_AGAIN.includes(gas?.why) && tries < 5; tries++) {
    if (tries || gas.why !== 'unpaid') await sleep(5000);
    let r;
    try { r = await postJson('/api/launch', { action: 'payback', draft: id }); } catch { continue; }
    if (!r.ok) { if (r.status === 429) continue; return; }
    gas = r.data?.gas ?? null;
    done(draft.token, gas);
  }
}

// ---------- 1. their wallet ----------
function walletApps() {
  $('[data-lch-app="metamask"]').href = `https://metamask.app.link/dapp/${location.host}${location.pathname}${location.search}`;
  $('[data-lch-app="phantom"]').href = `https://phantom.app/ul/browse/${encodeURIComponent(location.href)}?ref=${encodeURIComponent(location.origin)}`;
  $('[data-lch-app="coinbase"]').href = `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(location.href)}`;
  show($('[data-lch-apps]'));
}
async function listWallets() {
  const box = $('[data-lch-wallets]');
  const list = await findWallets();
  box.textContent = '';
  if (!list.length) { walletApps(); return; }
  for (const w of list) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn-ghost btn-sm lch-wallet';
    if (w.icon) {
      const img = document.createElement('img');
      img.src = w.icon;
      img.alt = '';
      img.width = 18;
      img.height = 18;
      b.append(img);
    }
    b.append(document.createTextNode(w.name));
    b.addEventListener('click', () => connect(w));
    box.append(b);
  }
  renderSteps();
}

// A wallet's session: the one this browser already has for that address (refreshed: the server re-reads its level when it's
// due), else a new sign-in (the free signature)
async function sessionFor(provider, address) {
  const saved = store.get(WALLET);
  if (saved?.session && String(saved.wallet).toLowerCase() === address) {
    try {
      const r = await postJson('/api/wallet', { action: 'profile', session: saved.session });
      if (r.ok) return r.data;
    } catch { /* offline: sign in below */ }
  }
  return signInWithWallet(provider, (step) => note('wallet', STEP[step]));
}

async function connect(w) {
  if (!adult() || busy) return;
  const mine = ++attempt;                       // (picking another wallet leaves this attempt behind)
  me = null;
  chainOk = false;
  renderSteps();
  note('wallet', STEP.connect);
  const slow = setTimeout(() => { if (mine === attempt) note('wallet', STEP.slow); }, 15_000);
  try {
    const accounts = await w.provider.request({ method: 'eth_requestAccounts' });
    if (mine !== attempt) return;
    const address = Array.isArray(accounts) && typeof accounts[0] === 'string' ? accounts[0].toLowerCase() : '';
    if (!/^0x[0-9a-f]{40}$/.test(address)) throw new Error('no_account');
    const profile = await sessionFor(w.provider, address);
    if (mine !== attempt) return;
    if (String(profile.wallet).toLowerCase() !== address) throw new Error('wrong_signer');
    store.set(WALLET, { session: profile.session, wallet: profile.wallet, level: profile.level, name: profile.name ?? null, notes: profile.notes || [] });
    me = { provider: w.provider, address, session: profile.session, level: profile.level };
    note('wallet', me.level >= 2 ? `${short(address)} · ${LEVEL_NAME[me.level]} ✓` : `${short(address)} · ${LEVEL_NAME[me.level] || 'Stranger'}. ${WORDS.level}`);
    watch(w.provider);
  } catch (err) {
    if (mine !== attempt) return;
    me = null;
    note('wallet', explainWalletError(err));
  } finally {
    clearTimeout(slow);
  }
  await checkChain();
  // a launch sent before its sign-in ended: keep waiting for it with the new one
  const pending = store.get(PENDING);
  if (me && !busy && pending?.draft === id && /^0x[0-9a-f]{64}$/.test(String(pending.tx))) waitFor(pending.tx, me.session);
}

let watched = null;
function watch(provider) {
  if (watched === provider || typeof provider.on !== 'function') return;
  watched = provider;
  provider.on('chainChanged', () => { checkChain(); });
  provider.on('accountsChanged', (accounts) => {
    const now = Array.isArray(accounts) && typeof accounts[0] === 'string' ? accounts[0].toLowerCase() : '';
    if (me && now !== me.address) {
      me = null;
      chainOk = false;
      note('wallet', 'Your wallet switched accounts. Pick your wallet again.');
      renderSteps();
    }
  });
}

// ---------- 2. Robinhood Chain ----------
async function checkChain() {
  if (!me) { chainOk = false; renderSteps(); return; }
  const { provider } = me;
  const on = (await walletChain(provider)) === ROBINHOOD.chainId;
  if (!me || me.provider !== provider) return;  // (another wallet was picked meanwhile)
  chainOk = on;
  show($('[data-lch-switch]'), !chainOk);
  note('chain', chainOk ? 'Your wallet is on Robinhood Chain ✓' : "Your wallet is on another network. clank.trade's coins live on Robinhood Chain.");
  renderSteps();
}
$('[data-lch-switch]').addEventListener('click', async () => {
  if (!me || busy) return;
  let said = null;
  try {
    await switchToRobinhood(me.provider);
  } catch (err) {
    said = userRejected(err) ? 'You cancelled in your wallet.' : WORDS.no_switch;
  }
  await checkChain();
  // (after the check, so its "on another network" doesn't hide why: in Phantom, Robinhood Chain may be switched off)
  if (said && !chainOk) note('chain', said);
});

// ---------- 3. the launch ----------
async function launch() {
  if (busy || !ready()) return;
  const linked = cleanLinks(typedLinks());
  if (!linked.ok) { showLink(linked.field, { force: true }); linkBox(linked.field).focus(); note('launch', WORDS.links); return; }
  const { provider, address, session } = me;     // (this wallet's, whatever happens to the page meanwhile)
  const pair = pairChoice();
  busy = true;
  renderSteps();
  note('launch', WORDS.preparing);
  let r;
  try { r = await postJson('/api/launch', { action: 'prepare', draft: id, session, links: linked.links, pair }); } catch {
    busy = false;
    note('launch', WORDS.offline);
    renderSteps();
    return;
  }
  if (!r.ok) {
    busy = false;
    const error = r.data?.error;
    if (error === 'launched' && /^0x[0-9a-f]{40}$/.test(String(r.data?.token))) { done(r.data.token); return; }
    if (error === 'signed_out') { store.del(WALLET); me = null; note('wallet', WORDS.signed_out); }
    // this wallet's coins for today (how many it gets, and whether other links or the other pair made this one another)
    note('launch', error === 'wallet_cap' ? capText(r.data?.perDay, r.data?.changed === true) : WORDS[error] || WORDS.error);
    renderSteps();
    // a link our server won't save (its form, or about her, or crude): said under that box, and the focus there (once the
    // boxes are back on)
    const field = r.data?.field;
    if (error === 'links' && LINK_FIELDS.includes(field)) {
      showLink(field, { why: ['agi', 'crude'].includes(r.data?.why) ? r.data.why : 'format', force: true });
      linkBox(field).focus();
    }
    return;
  }
  rememberReady({ pair, links: linked.links });
  note('launch', WORDS.approve);
  let hash;
  try {
    hash = await sendLaunch(provider, address, r.data);
  } catch (err) {
    busy = false;
    const said = String(err?.message || '').replace(/\s+/g, ' ').trim().slice(0, 140);
    note('launch', userRejected(err) ? WORDS.cancelled : WORDS[said] || `Your wallet didn't send it. It said: "${said}"`);
    await checkChain();
    return;
  }
  store.set(PENDING, { draft: id, tx: hash });
  await waitFor(hash, session);
}
$('[data-lch-go]').addEventListener('click', launch);

// Their launch, read back from the chain every few seconds (up to 3 minutes; a reload keeps waiting), then its network
// fee's payback (asked for again while it can still happen in a moment)
async function waitFor(hash, session) {
  busy = true;
  renderSteps();
  note('launch', WORDS.waiting);
  const until = Date.now() + 3 * 60_000;
  while (Date.now() < until) {
    await sleep(3000);
    let r;
    try { r = await postJson('/api/launch', { action: 'check', draft: id, session, tx: hash }); } catch { continue; }
    if (r.ok && r.data?.ok === true) {
      store.del(PENDING);
      rememberReady(null);
      draft.token = r.data.token;
      done(r.data.token, r.data.gas || null);
      await settleGas(r.data.gas);
      return;
    }
    if (r.ok && r.data?.pending) continue;
    if (r.ok && r.data?.ok === false) {
      store.del(PENDING);
      busy = false;
      note('launch', CHECK[r.data.why] || WORDS.error);
      renderSteps();
      return;
    }
    if (r.status === 401) {
      store.del(WALLET);
      busy = false;
      note('launch', WORDS.signed_out_waiting);
      renderSteps();
      return;
    }
  }
  busy = false;
  note('launch', WORDS.slow);
  renderSteps();
}

$('[data-lch-adult]').addEventListener('click', () => {
  store.set(ADULT, true);
  renderSteps();
  $('[data-lch-wallets] button')?.focus();
});

// ---------- the draft ----------
async function start() {
  if (!id) { status(WORDS.start); showBot(); return; }
  let res, data = {};
  try {
    res = await fetch(`/api/launch?d=${encodeURIComponent(id)}`, { headers: { Accept: 'application/json' } });
    data = await res.json().catch(() => ({}));
  } catch {
    status(WORDS.offline);
    return;
  }
  if (res.status === 404) { status(WORDS.gone); showBot(); return; }
  if (!res.ok) { status(res.status === 503 ? WORDS.not_ready : WORDS.error); return; }
  draft = data;
  renderCoin();
  // launched: the coin, and its fee's payback asked for again if it's still due
  const pending = store.get(PENDING), saved = store.get(WALLET);
  const mine = pending?.draft === id && /^0x[0-9a-f]{64}$/.test(String(pending.tx)) && saved?.session ? pending : null;
  if (/^0x[0-9a-f]{40}$/.test(String(draft.token))) {
    if (pending?.draft === id) store.del(PENDING);
    rememberReady(null);
    done(draft.token, draft.gas);
    settleGas(draft.gas);
    return;
  }
  if (draft.expired && !mine) { status(WORDS.expired); showBot(); return; }
  if (!draft.ready) { status(WORDS.not_ready); return; }
  // the pair and links its launch was last got ready with, in this browser (other ones would make it another coin)
  const before = readyBefore();
  if (before) {
    setPair(before.pair);
    for (const field of LINK_FIELDS) {
      if (typeof before.links?.[field] === 'string') { linkBox(field).value = before.links[field]; showLink(field); }
    }
  }
  status('');
  show($('[data-lch-steps]'));
  renderSteps();
  if (mine) waitFor(mine.tx, saved.session);
  await listWallets();
}
start();
