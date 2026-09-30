// The Relationship panel in the Playground (Phase 3): connect a wallet, see your level with AGI-1, set the name she
// uses, see what she remembers, and "Forget me". Levels: src/lib/levels.js. Server: /api/wallet.
// Other parts talk to it through events:
//   'agi:relationship' { level, name, notes, wallet }   sent whenever it changes (the chat uses it for greetings)
//   'agi:chat-reset'                                     sent by "Forget me" so the chat clears itself
//   'agi:agi1-line' { text }                            asks the chat to show a line from AGI-1 (the level-up moment)
//   'agi:wallet-open'                                    opens the connect screen (her out-of-messages line, 2026-09-25)
//   'agi:burn-status' { wallet, burn }                   sent with each profile from the server: its burned messages
//                                                        (2026-09-30, src/chat/burn.js)
//   'agi:profile' (heard)                                a profile the burn screen got after "Check my burn": saved here
//   'agi:signed-out' (heard)                             the burn screen found the session ended
import { LEVELS, levelInfo } from '../lib/levels.js';
import { findWallets, signInWithWallet, explainWalletError } from '../lib/wallet.js';
import { postJson } from '../lib/human.js';
import { levelPost, levelLink } from '../share/texts.js';
import { setShareLink, onSaveImage } from '../share/buttons.js';
import { t, currentLang } from '../i18n/lang.js';

const KEY = 'agi_wallet';              // { session, wallet, level, name, notes } in this browser
const SEEN = 'agi_levels_seen';        // { [wallet]: highest level this browser has celebrated }
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode: this visit only */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};
const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const el = (tag, className, text) => {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined) n.textContent = text;
  return n;
};

// Pre-written lines for the level-up moment (no AI call, so no cost), in the language she speaks (src/i18n/lines: levelUp)
const LEVEL_UP_LINES = {
  2: (name) => (name ? t('levelUp.crush', { name }) : t('levelUp.crushNoName')),
  3: (name) => (name ? t('levelUp.soulmate', { name }) : t('levelUp.soulmateNoName')),
};

let state = store.get(KEY);            // null = no wallet (Stranger)
export const currentSession = () => state?.session || null;
export const currentWallet = () => state?.wallet || null;

export function startRelationship(root) {
  if (!root) return;
  const $ = (s) => root.querySelector(s);
  const dialog = document.querySelector('[data-wallet-dialog]');
  const d$ = (s) => dialog.querySelector(s);
  const chip = document.querySelector('[data-rel-chip]');
  const banner = document.querySelector('[data-levelup]');

  // ---------- drawing the panel ----------
  function render() {
    const level = state?.level || 1;
    const info = levelInfo(level);
    $('[data-rel-name]').textContent = info.name;
    $('[data-rel-num]').textContent = `Level ${level} of ${LEVELS.length}`;
    $('[data-rel-daily]').textContent = String(info.daily);
    root.querySelectorAll('.rel-steps i').forEach((i, n) => i.classList.toggle('on', n < level));
    if (chip) chip.textContent = info.name;
    setShareLink($('[data-rel-share] [data-share-x]'), levelPost(level), levelLink(location.origin, level));
    $('[data-rel-out]').hidden = !!state;
    $('[data-rel-in]').hidden = !state;
    if (state) {
      $('[data-rel-addr]').textContent = short(state.wallet);
      const nameForm = $('[data-rel-name-form]');
      nameForm.hidden = level < 2;
      const input = $('[data-rel-name-input]');
      if (document.activeElement !== input) input.value = state.name || '';
      const notes = level >= 3 ? state.notes || [] : [];
      $('[data-rel-notes]').hidden = level < 3;
      $('[data-rel-notes-list]').replaceChildren(...(notes.length ? notes.map((n) => el('li', '', n))
        : [el('li', 'empty', 'Nothing yet. Tell her about your day.')]));
    }
    dispatchEvent(new CustomEvent('agi:relationship', { detail: { level, name: state?.name || null, notes: state?.notes || [], wallet: state?.wallet || null } }));
  }
  const note = (text) => {
    const p = $('[data-rel-note]');
    p.textContent = text || '';
    p.hidden = !text;
  };

  // Save a profile from the server, and celebrate if the level went up.
  function accept(profile, { quiet = false } = {}) {
    const before = state?.level || 1;
    state = { session: profile.session, wallet: profile.wallet, level: profile.level, name: profile.name, notes: profile.notes || [] };
    store.set(KEY, state);
    render();
    note(profile.checked === false ? "Couldn't check your $AGI just now, so you're a Stranger for a few minutes. It tries again by itself." : '');
    const seen = store.get(SEEN) || {};
    const highest = Math.max(seen[profile.wallet] || 1, quiet ? before : 1);
    if (profile.level > highest) levelUp(highest, profile.level);
    if (profile.level > (seen[profile.wallet] || 0)) store.set(SEEN, { ...seen, [profile.wallet]: profile.level });
    // its burned messages (2026-09-30): the burn screen and the panel's "left" (src/chat/burn.js)
    dispatchEvent(new CustomEvent('agi:burn-status', { detail: { wallet: profile.wallet, burn: profile.burn || null } }));
  }
  // "Check my burn" counted a burn: its profile (a new session, and the level, since what was burned counts toward it)
  addEventListener('agi:profile', (e) => {
    const p = e.detail;
    if (state && p && typeof p.session === 'string' && p.wallet === state.wallet) accept(p, { quiet: true });
  });
  addEventListener('agi:signed-out', () => { if (state) signOut('Your session ended. Connect again.'); });

  // ---------- the level-up moment ----------
  function levelUp(from, to) {
    banner.querySelector('[data-levelup-text]').textContent = `${levelInfo(from).name} → ${levelInfo(to).name}`;
    banner.hidden = false;
    dispatchEvent(new CustomEvent('agi1:react', { detail: 'love' }));
    dispatchEvent(new CustomEvent('agi:agi1-line', { detail: { text: LEVEL_UP_LINES[to](state?.name), lang: currentLang() } }));
  }
  banner.querySelector('[data-levelup-close]').addEventListener('click', () => { banner.hidden = true; });

  // "Save image": a personal card (your level, and the name AGI-1 calls you), made in your browser, never uploaded
  onSaveImage($('[data-rel-share] [data-save-image]'), () => {
    const level = state?.level || 1;
    return { card: { kind: 'level', level, name: level >= 2 ? state?.name || null : null }, filename: `agi1-${levelInfo(level).name.toLowerCase()}.png`, text: levelPost(level) };
  });

  // ---------- connect screen ----------
  const statusEl = d$('[data-wdlg-status]');
  const say = (text) => { statusEl.textContent = text; };
  const STEPS = {
    connect: 'Check your wallet: allow this site to see your address.',
    sign: 'Now sign the message in your wallet. It is free and not a transaction.',
    check: 'Checking your $AGI balance…',
    slow: 'Nothing showing up? Open your wallet (its icon in the browser toolbar): the request may be waiting there. Or pick another wallet.',
  };
  // Each click starts a new attempt. A wallet that never answers (a closed or hidden wallet window) must not lock the
  // screen: picking another wallet or closing this screen simply leaves the old attempt behind, and its answer is ignored.
  let attempt = 0;
  let waitingFor = null;                // the wallet button of the attempt in progress

  async function openDialog() {
    say('');
    d$('[data-wdlg-list]').replaceChildren();
    d$('[data-wdlg-none]').hidden = true;
    if (!dialog.open) dialog.showModal();
    say('Looking for wallets…');
    const wallets = await findWallets();
    say('');
    if (!wallets.length) {
      showNoWallet();
      return;
    }
    const list = d$('[data-wdlg-list]');
    for (const w of wallets) {
      const b = el('button', 'wdlg-wallet');
      b.type = 'button';
      // the wallet's own logo; without one (or if it doesn't load), its first letter instead of an empty square
      const letter = () => {
        const dot = el('span', 'wdlg-wallet-dot', (w.name.trim()[0] || '?').toUpperCase());
        dot.setAttribute('aria-hidden', 'true');
        return dot;
      };
      if (w.icon) {
        const img = el('img');
        img.alt = '';
        img.width = 28;
        img.height = 28;
        img.addEventListener('error', () => img.replaceWith(letter()), { once: true });
        img.src = w.icon;
        b.append(img);
      } else {
        b.append(letter());
      }
      b.append(el('span', 'wdlg-wallet-name', w.name), el('span', 'wdlg-wallet-tag mono', 'Sign in'));
      b.addEventListener('click', () => connect(w, b));
      list.append(b);
    }
    list.querySelector('button')?.focus();
  }

  function showNoWallet() {
    const phone = matchMedia('(pointer: coarse)').matches;
    d$('[data-wdlg-none]').hidden = false;
    d$('[data-wdlg-none-text]').textContent = phone
      ? "Phone browsers can't talk to wallets directly. Open this page inside your wallet app's browser:"
      : 'No wallet found in this browser. Add a wallet extension (for example MetaMask, Phantom or Rabby), or open this page in your phone\'s wallet app.';
    d$('[data-wdlg-apps]').hidden = !phone;
    const here = location.href.split('#')[0];
    d$('[data-wdlg-app="metamask"]').href = `https://metamask.app.link/dapp/${location.host}${location.pathname}`;
    d$('[data-wdlg-app="phantom"]').href = `https://phantom.app/ul/browse/${encodeURIComponent(here)}?ref=${encodeURIComponent(location.origin)}`;
    d$('[data-wdlg-app="coinbase"]').href = `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(here)}`;
  }

  d$('[data-wdlg-copy]').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(location.href.split('#')[0]);
      say('Copied. Paste it into your wallet app\'s browser.');
    } catch {
      say(location.href.split('#')[0]);
    }
  });

  const markWaiting = (button, on) => {
    button.classList.toggle('is-waiting', on);
    button.setAttribute('aria-busy', String(on));
    button.querySelector('.wdlg-wallet-tag').textContent = on ? 'Waiting…' : 'Sign in';
  };

  async function connect(w, button) {
    if (waitingFor === button) return;                 // this wallet is already asked: don't ask it twice
    if (waitingFor) markWaiting(waitingFor, false);    // another wallet was still thinking: leave it behind
    const mine = ++attempt;
    waitingFor = button;
    markWaiting(button, true);
    const current = () => mine === attempt;
    try {
      const profile = await signInWithWallet(w.provider, (step) => { if (current()) say(STEPS[step]); });
      if (!current()) return;                          // the visitor moved on; ignore this late answer
      accept(profile);
      say('');
      dialog.close();
      $('[data-rel-in]').querySelector('button, input')?.focus({ preventScroll: true });
    } catch (err) {
      if (current()) say(explainWalletError(err));
    } finally {
      if (current()) {
        markWaiting(button, false);
        waitingFor = null;
      }
    }
  }

  $('[data-rel-connect]').addEventListener('click', openDialog);
  addEventListener('agi:wallet-open', () => { if (!state) openDialog(); });
  d$('[data-wdlg-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });   // a tap outside closes it
  dialog.addEventListener('close', () => { attempt++; waitingFor = null; });              // closing = give up on the attempt

  // ---------- signed in: name, disconnect, forget me ----------
  $('[data-rel-name-form]').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!state) return;
    const name = $('[data-rel-name-input]').value.trim();
    try {
      const r = await postJson('/api/wallet', { action: 'name', session: state.session, name });
      if (r.ok) { accept(r.data, { quiet: true }); note(name ? `Saved. AGI-1 will call you ${r.data.name}.` : 'Name removed.'); }
      else if (r.data.error === 'bad_name') note('Use up to 24 letters or numbers, no links.');
      else if (r.data.error === 'signed_out') signOut('Your session ended. Connect again.');
      else note("Couldn't save that right now. Try again in a minute.");
    } catch {
      note('You seem to be offline.');
    }
  });

  function signOut(message = '') {
    state = null;
    store.del(KEY);
    render();
    note(message);
  }
  $('[data-rel-disconnect]').addEventListener('click', () => signOut());

  let armed = false, armTimer = null;
  const forgetBtn = $('[data-rel-forget]');
  forgetBtn.addEventListener('click', async () => {
    if (!state) return;
    if (!armed) {
      armed = true;
      forgetBtn.textContent = 'Click again to forget everything';
      armTimer = setTimeout(() => { armed = false; forgetBtn.textContent = 'Forget me'; }, 3000);
      return;
    }
    clearTimeout(armTimer);
    armed = false;
    forgetBtn.textContent = 'Forget me';
    try {
      const r = await postJson('/api/wallet', { action: 'forget', session: state.session });
      if (!r.ok && r.data.error !== 'signed_out') { note("Couldn't reach the database. Nothing was deleted; try again."); return; }
    } catch {
      note('You seem to be offline. Nothing was deleted.');
      return;
    }
    const seen = store.get(SEEN) || {};
    delete seen[state.wallet];
    store.set(SEEN, seen);
    dispatchEvent(new CustomEvent('agi:chat-reset'));
    signOut('Done. AGI-1 forgot you, and this chat was cleared.');
  });

  // ---------- the chat's answers carry the latest level and session ----------
  addEventListener('agi:chat-answer', (e) => {
    const d = e.detail || {};
    if (!state) return;
    if (d.signedOut) { signOut('Your session ended. Connect again.'); return; }
    let changed = false;
    if (typeof d.session === 'string' && d.session) { state.session = d.session; changed = true; }
    if ([1, 2, 3].includes(d.level) && d.level !== state.level) {
      const before = state.level;
      state.level = d.level;
      changed = true;
      const seen = store.get(SEEN) || {};
      if (d.level > before && d.level > (seen[state.wallet] || 1)) {
        store.set(SEEN, { ...seen, [state.wallet]: d.level });
        levelUp(before, d.level);
      }
    }
    if (d.remembered && state.level >= 3) {
      state.notes = [...(state.notes || []).filter((n) => n !== d.remembered), d.remembered].slice(-8);
      changed = true;
    }
    if (changed) { store.set(KEY, state); render(); }
  });

  render();
  // Coming back: refresh the level and what AGI-1 remembers (the server re-reads the balance if it's been 30 minutes).
  if (state?.session) {
    postJson('/api/wallet', { action: 'profile', session: state.session })
      .then((r) => {
        if (r.ok) accept(r.data, { quiet: true });
        else if (r.data.error === 'signed_out') signOut('Your session ended. Connect again.');
      })
      .catch(() => { /* offline: keep what we have */ });
  }
}
