// AGI-1's holder roles in her Discord server (2026-10-29): agi1.app/discord/verify (verify.html). Opened from her "Verify
// my $AGI" button (server/dc-holders.js), with its private link's code after "#t=" (never sent with the page's address).
// The wallet sign-in is the site's own (src/lib/wallet.js): an address and a free signature, never a transaction. A wallet
// connected on the home page, her live page, the games or the votes is connected here too (the same saved session), and can
// verify at once. Then /api/wallet { action: 'dc-verify', session, link } reads its $AGI on the chain and gives the role.
import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/layout.css';
import '../styles/sections.css';
import '../styles/footer.css';
import '../styles/diary.css';      // (the short safety paragraph above the bottom bar)
import '../styles/roadmap.css';    // (the hero and the fine print: the roadmap's coming-soon pages' look)
import '../styles/vote.css';       // (the wallet box and "How it works": the votes page's)
import '../styles/verify.css';
import '../styles/pop.css';        // Pop mode: the bold look, only while it's switched on
import { startTheme } from '../theme.js';
import { startMenu } from '../menu.js';
import { postJson } from '../lib/human.js';
import { findWallets, signInWithWallet, explainWalletError } from '../lib/wallet.js';
import { shortWallet } from '../vote/words.js';
import { linkFrom, linkEnds, minutesLeft, leftText, resultText, verifyError, NO_LINK, EXPIRED, WALLET_STEPS, CHECKING, NO_WALLET, COPIED } from './words.js';

const API = '/api/wallet';
const KEY = 'agi_wallet';          // the site's wallet session: { session, wallet, level, name, notes }
const store = {
  get() { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } },
  set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode: this visit only */ } },
  del() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } },
};
const walletOf = (v) => (v && typeof v.session === 'string' && v.session && /^0x[0-9a-f]{40}$/i.test(String(v.wallet)) ? v : null);
const $ = (sel) => document.querySelector(sel);
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const ui = {
  title: $('[data-dv-title]'), note: $('[data-dv-note]'), connect: $('[data-dv-connect]'), go: $('[data-dv-go]'),
  other: $('[data-dv-other]'), copy: $('[data-dv-copy]'), wallets: $('[data-dv-wallets]'), say: $('[data-dv-say]'),
  box: $('[data-dv-box]'), done: $('[data-dv-done]'), role: $('[data-dv-role]'), doneTitle: $('[data-dv-done-title]'), doneNote: $('[data-dv-done-note]'),
};
const link = linkFrom(location.hash);
const ends = link ? linkEnds(link) : null;
const state = { me: walletOf(store.get()), busy: false, done: false };
// a phone's own browser (or Discord's) has no wallet: the link goes to the wallet app's browser instead
const phoneWithoutWallet = matchMedia('(pointer: coarse)').matches && !window.ethereum && !window.phantom?.ethereum;

startTheme();
startMenu();
render();
if (link) setInterval(() => { if (!state.done && !document.hidden) render(); }, 30_000);
addEventListener('storage', (e) => {
  if (e.key !== KEY && e.key !== null) return;
  state.me = walletOf(store.get());
  render();
});

function expired() { return ends !== null && ends <= Date.now(); }
function show(button, on) { button.hidden = !on; }

function render() {
  if (!link || expired()) {
    const t = link ? EXPIRED : NO_LINK;
    ui.title.textContent = t.title;
    ui.note.textContent = t.note;
    for (const b of [ui.connect, ui.go, ui.other, ui.copy]) show(b, false);
    ui.wallets.hidden = true;
    return;
  }
  if (state.done) return;
  const left = leftText(minutesLeft(ends, Date.now()));
  if (state.me) {
    ui.title.textContent = `Connected: ${shortWallet(state.me.wallet)}`;
    ui.note.textContent = `${left} Verify with this wallet, or use another one.`;
  } else {
    ui.title.textContent = 'Connect your wallet';
    ui.note.textContent = `${left} You'll sign a free message: never a transaction, no gas.`;
  }
  show(ui.connect, !state.me);
  show(ui.go, Boolean(state.me));
  show(ui.other, Boolean(state.me));
  if (phoneWithoutWallet && !state.me) show(ui.copy, true);
  for (const b of [ui.connect, ui.go, ui.other]) b.disabled = state.busy;
}

function say(text) { ui.say.textContent = text; }

// ---------- verifying ----------
async function verify() {
  if (!state.me || state.busy || expired()) { render(); return; }
  state.busy = true;
  render();
  say(CHECKING);
  try {
    const r = await postJson(API, { action: 'dc-verify', session: state.me.session, link });
    if (r.ok) {
      const t = resultText(r.data);
      ui.role.textContent = t.emoji;
      ui.doneTitle.textContent = t.title;
      ui.doneNote.textContent = t.note;
      ui.done.hidden = false;
      ui.done.classList.toggle('is-role', t.done);
      say('');
      if (t.done) {
        state.done = true;
        ui.title.textContent = 'Verified 💜';
        ui.note.textContent = 'You can close this page and go back to Discord.';
        for (const b of [ui.connect, ui.go, ui.other, ui.copy]) show(b, false);
      }
      ui.done.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } else {
      if (r.data.error === 'signed_out') forget();
      say(verifyError(r.data));
    }
  } catch {
    say('You seem to be offline.');
  } finally {
    state.busy = false;
    render();
  }
}

function forget() {
  state.me = null;
  store.del();
}

ui.go.addEventListener('click', verify);
ui.other.addEventListener('click', () => {
  forget();
  ui.done.hidden = true;
  say('This browser forgot that wallet. Connect the one you want to verify.');
  render();
  ui.connect.focus();
});

// ---------- the wallet ----------
let attempt = 0;
ui.connect.addEventListener('click', async () => {
  say('Looking for wallets…');
  ui.connect.disabled = true;
  let list = [];
  try { list = await findWallets(); } finally { ui.connect.disabled = false; }
  if (!list.length) {
    const phone = matchMedia('(pointer: coarse)').matches;
    say(phone ? NO_WALLET.phone : NO_WALLET.computer);
    show(ui.copy, true);
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
    render();
    await verify();
  } catch (err) {
    if (mine === attempt) say(explainWalletError(err));
  } finally {
    if (mine === attempt) ui.connect.disabled = false;
  }
}

// ---------- on a phone without a wallet: the link, for the wallet app's own browser ----------
ui.copy.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(location.href);
    say(COPIED);
  } catch {
    say(`Copy this address: ${location.href}`);
  }
});
