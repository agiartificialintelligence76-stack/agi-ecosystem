// Messages paid for by burning $AGI (2026-09-30, the owner's idea "every chat $AGI is burned", made better): her free
// messages stay; after them, a visitor with a connected wallet sends $AGI from their OWN wallet app to the burn address
// (0x…dEaD) and presses "Check my burn". Our server reads that burn on Robinhood Chain and adds messages (server/burn.js,
// api/wallet.js). Nothing here talks to a wallet: this page shows the address, copies it, and asks our own /api/wallet.
// Nothing shows until burns are open (supabase/burns.sql run): GET /api/wallet?burns says so, with the price and the
// public counter, and a connected wallet's profile says it too.
// Parts: the burn monitor above the chat (the owner, the same day: "make a monitor on how many agi are gonna be burned so
// they know its working, make it a huge text on the chat on top of it": the $AGI burned for messages so far by everyone, a
// huge number that counts up, live while it's on screen), the Relationship panel's "Burn $AGI for more messages" (with how
// many are left), the sentences about burning in "How levels work" and the safety note ([data-burn-only]), and the burn
// screen (a native dialog). The chat asks burnsReady() / openBurn() for its out-of-messages chip (src/chat/chat.js).
// Events: reads 'agi:relationship' (the wallet), 'agi:burn-status' (a profile's burned messages, src/chat/relationship.js)
// and 'agi:chat-answer' (a reply paid by a burn: how many are left); sends 'agi:profile' (the profile after a burn was
// counted: what was burned counts toward the level, so it may go up), 'agi:wallet-open', and her thank-you
// ('agi:agi1-line' + her 'love' reaction).
import { postJson } from '../lib/human.js';
import { currentSession, currentWallet } from './relationship.js';
import { copyButton } from '../lib/copy.js';
import { BURN_ADDRESS, BURN_EXPLORER, packsFor, fmt } from '../lib/burns.js';
import { TOKENS } from '../prices/parse.js';
import { t, currentLang } from '../i18n/lang.js';
import { formatNumber } from '../i18n/langs.js';

const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const CA = TOKENS[0].ca;
let open = { ready: false, price: 10, perDay: 300, total: null };    // what GET /api/wallet?burns (or a profile) said
const LIVE_MS = 60_000;                                              // the monitor asks again every minute while it's watched
const IDLE_MS = 10 * 60_000;                                         // …and rests after 10 minutes without a touch
let wallet = null;
let mine = null;                                                     // this wallet's burned messages: { left, today, … }
let started = false;
let dialog = null;
const refresh = new Set();                                           // parts to redraw when something changes
const redraw = () => { for (const f of refresh) f(); };
// Two readings of the burn monitor's numbers (a CDN copy can be a minute old): burns are only ever added, so the bigger is the
// newer, and the number never counts down
function merge(a, b) {
  if (!b || typeof b !== 'object') return a;
  if (!a) return b;
  const newer = b.agi >= a.agi ? b : a;
  return {
    agi: Math.max(a.agi, b.agi), messages: Math.max(a.messages, b.messages), burns: Math.max(a.burns, b.burns),
    today: newer.today, lastAt: Math.max(a.lastAt || 0, b.lastAt || 0) || null,
  };
}

export const burnsReady = () => open.ready;
export const burnSettings = () => ({ ...open });
let opener = () => {};
export const openBurn = () => opener();

// What the server said about a burn it read, in plain words
const WHY = {
  used: 'That burn was already counted.',
  pending: "That transaction isn't on Robinhood Chain yet. Give it a minute, then check again.",
  failed: 'That transaction failed on the chain, so nothing was burned.',
  not_agi: `That transaction didn't burn the official $AGI (0xfa31…06ec) to the burn address.`,
  other_wallet: 'That burn came from another wallet. Connect that wallet to use it.',
  too_old: 'That burn is more than 7 days old, so it can\'t be counted.',
  chain: "Couldn't read Robinhood Chain just now. Nothing was lost: check again in a minute.",
};
const ERRORS = {
  bad_tx: "That doesn't look like a transaction. Paste its ID (0x and 64 characters) or its block explorer link.",
  chain: WHY.chain,
  explorer: "Couldn't look up your burns automatically just now. Paste the transaction link instead: your wallet's activity → the transaction → copy its link or ID.",
  not_ready: "Burning for messages isn't open yet.",
  too_fast: 'One check at a time: try again in a minute.',
  busy: "Couldn't reach our database. Nothing was lost: try again in a minute.",
  offline: 'You seem to be offline.',
};

export function startBurns(doc = document) {
  if (started) return;
  started = true;
  wallet = currentWallet();
  const $$ = (s) => [...doc.querySelectorAll(s)];
  dialog = doc.querySelector('[data-burn-dialog]');

  // ---------- is it open, and how much was burned? (GET /api/wallet?burns, shared by the CDN for a minute) ----------
  let asked = false, lastAsk = 0, fails = 0, retry = 0;
  async function ask() {
    asked = true;
    lastAsk = Date.now();
    clearTimeout(retry);
    let d = null;
    try {
      const res = await fetch('/api/wallet?burns');
      d = res.ok ? await res.json() : null;
    } catch { /* offline */ }
    if (!d) {                                                   // not answered: try again later (30 s, 1, 2, 4, then 5 minutes)
      if (!open.total) retry = setTimeout(ask, Math.min(300_000, 30_000 * 2 ** fails++));
      return;
    }
    fails = 0;
    if (!d.ready) return;
    open = { ready: true, price: d.price, perDay: d.perDay, total: merge(open.total, d.total) };
    redraw();
  }
  // (only once someone gets near the chat or the safety note: most visitors never scroll there)
  const near = ['playground', 'safety'].map((id) => doc.getElementById(id)).filter(Boolean);
  if (near.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { io.disconnect(); if (!asked) ask(); } }, { rootMargin: '900px 0px' });
    for (const n of near) io.observe(n);
  } else ask();
  // the numbers our server sent right after counting this visitor's own burn (src: the burn screen below)
  addEventListener('agi:burn-total', (e) => { if (open.ready && e.detail) { open.total = merge(open.total, e.detail); redraw(); } });

  addEventListener('agi:relationship', (e) => {
    const w = e.detail?.wallet || null;
    if (w !== wallet) { wallet = w; if (!w) mine = null; redraw(); }
  });
  addEventListener('agi:burn-status', (e) => {
    const b = e.detail?.burn;
    if (b?.ready) {
      open = { ...open, ready: true, price: b.price || open.price, perDay: b.perDay || open.perDay };
      mine = b;
    } else mine = null;
    redraw();
  });
  addEventListener('agi:chat-answer', (e) => {
    const d = e.detail || {};
    const left = Number.isFinite(d.burned?.left) ? d.burned.left : Number.isFinite(d.burn?.left) ? d.burn.left : null;
    if (left === null || !mine) return;
    mine = { ...mine, left, ...(Number.isFinite(d.burned?.today) ? { today: d.burned.today } : {}) };
    redraw();
  });

  // ---------- the page's parts ----------
  refresh.add(() => {
    for (const n of $$('[data-burn-only]')) n.hidden = !open.ready;
    for (const n of $$('[data-burn-price]')) n.textContent = fmt(open.price);
    const panel = doc.querySelector('[data-rel-burn]');
    if (panel) panel.hidden = !open.ready;
    const left = doc.querySelector('[data-rel-burn-left]');
    if (left) {
      left.hidden = !open.ready || !wallet || !mine;
      const n = doc.querySelector('[data-rel-burn-n]');
      if (n && mine) n.textContent = fmt(mine.left);
    }
  });
  for (const b of $$('[data-burn-open]')) b.addEventListener('click', () => openBurn());

  // ---------- the burn monitor ----------
  const mon = doc.querySelector('[data-burnmon]');
  if (mon) {
    const num = mon.querySelector('.burnmon-num'), agiEl = mon.querySelector('[data-burnmon-agi]');
    const proof = mon.querySelector('[data-burnmon-proof]');
    if (proof) proof.href = BURN_EXPLORER;                   // (the burn address itself: only in the burn screen's markup)
    let shown = null, frame = 0;
    // the huge number: counts up to the new total (at once with "reduce motion", or when nobody can see it)
    const countTo = (target) => {
      const text = fmt(target);
      num.classList.toggle('is-long', text.length >= 8 && text.length < 11);
      num.classList.toggle('is-longer', text.length >= 11);
      const from = shown ?? target;
      shown = target;
      cancelAnimationFrame(frame);
      if (from >= target || matchMedia('(prefers-reduced-motion: reduce)').matches || document.hidden) { agiEl.textContent = text; return; }
      num.classList.remove('is-up');
      void num.offsetWidth;                                   // (so the glow starts again)
      num.classList.add('is-up');
      const t0 = performance.now();
      const step = (now) => {
        const k = Math.min(1, (now - t0) / 1400);
        agiEl.textContent = fmt(Math.round(from + (target - from) * (1 - (1 - k) ** 3)));
        if (k < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    };
    const ago = (ms) => {
      const m = Math.max(0, Math.floor(ms / 60_000));
      if (m < 1) return 'just now';
      if (m < 60) return `${m} min ago`;
      if (m < 1440) return `${Math.floor(m / 60)} h ago`;
      const d = Math.floor(m / 1440);
      return `${d} ${d === 1 ? 'day' : 'days'} ago`;
    };
    const line = (t) => {
      if (!t.burns) return 'Nothing burned yet: the first burn shows up here.';
      return [t.today > 0 ? `+${fmt(t.today)} today` : null, `${fmt(t.messages)} ${t.messages === 1 ? 'message' : 'messages'} paid for`,
        `${fmt(t.burns)} ${t.burns === 1 ? 'burn' : 'burns'}`, t.lastAt ? `latest ${ago(Date.now() - t.lastAt)}` : null].filter(Boolean).join(' · ');
    };
    refresh.add(() => {
      mon.hidden = !open.ready || !open.total;
      if (mon.hidden) return;
      countTo(open.total.agi);
      mon.querySelector('[data-burnmon-sub]').textContent = line(open.total);
    });

    // live: asks again every minute while it's on screen, the tab is visible and someone touched the page in the last 10
    // minutes (a forgotten tab doesn't ask all night); "paused" otherwise
    let onScreen = false, lastTouch = Date.now(), timer = 0;
    const tag = mon.querySelector('[data-burnmon-live]');
    const schedule = () => {
      clearTimeout(timer);
      timer = 0;
      const live = onScreen && !document.hidden && Date.now() - lastTouch < IDLE_MS;
      tag.dataset.state = live ? 'live' : 'paused';
      tag.querySelector('[data-burnmon-state]').textContent = live ? 'live' : 'paused';
      if (!live) return;
      timer = setTimeout(async () => {
        await ask();
        if (open.total) mon.querySelector('[data-burnmon-sub]').textContent = line(open.total);   // ("latest …" moves on)
        schedule();
      }, Math.max(0, LIVE_MS - (Date.now() - lastAsk)));
    };
    for (const type of ['pointermove', 'pointerdown', 'keydown', 'scroll', 'touchstart']) {
      addEventListener(type, () => { const was = Date.now() - lastTouch >= IDLE_MS; lastTouch = Date.now(); if (was) schedule(); }, { passive: true });
    }
    document.addEventListener('visibilitychange', schedule);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => { onScreen = entries.some((e) => e.isIntersecting); schedule(); }).observe(mon);
    }
  }

  if (dialog) startDialog(doc);
  redraw();
}

// ---------- the burn screen ----------
function startDialog(doc) {
  const d$ = (s) => dialog.querySelector(s);
  const status = d$('[data-bdlg-status]');
  const say = (text) => { status.textContent = text; };
  let busy = false, reopen = false;

  d$('[data-burn-address]').textContent = BURN_ADDRESS;
  copyButton(d$('[data-bdlg-copy]'), { text: BURN_ADDRESS, select: d$('[data-burn-address]'), what: 'Burn address' });

  function draw() {
    d$('[data-bdlg-out]').hidden = !!wallet;
    d$('[data-bdlg-in]').hidden = !wallet;
    if (wallet) d$('[data-bdlg-wallet]').textContent = short(wallet);
    d$('[data-bdlg-packs]').replaceChildren(...packsFor(open.price).map((p) => {
      const li = doc.createElement('li');
      const a = doc.createElement('span');
      a.className = 'mono';
      a.textContent = `${fmt(p.agi)} $AGI`;
      const m = doc.createElement('span');
      m.textContent = `${fmt(p.messages)} messages`;
      li.append(a, m);
      return li;
    }));
    const left = d$('[data-bdlg-left]');
    left.hidden = !wallet || !mine;
    if (mine) left.querySelector('b').textContent = `${fmt(mine.left)} left`;
    const total = d$('[data-bdlg-total]');
    total.hidden = !open.total;
    if (open.total) total.textContent = `${fmt(open.total.agi)} $AGI burned for messages so far, by everyone.`;
  }
  refresh.add(() => { if (dialog.open) draw(); });

  opener = () => {
    if (!open.ready) return;
    say('');
    draw();
    if (!dialog.open) dialog.showModal();
    (wallet ? d$('[data-bdlg-copy]') : d$('[data-bdlg-connect]'))?.focus();
  };
  d$('[data-bdlg-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });   // a tap outside closes it

  // No wallet yet: connect it, then come straight back here
  d$('[data-bdlg-connect]').addEventListener('click', () => {
    reopen = true;
    dialog.close();
    dispatchEvent(new CustomEvent('agi:wallet-open'));
    const wdlg = doc.querySelector('[data-wallet-dialog]');
    wdlg?.addEventListener('close', () => {
      if (reopen && wallet) opener();
      reopen = false;
    }, { once: true });
  });

  async function check(tx) {
    if (busy) return;
    const s = currentSession();
    if (!s) { draw(); return; }
    busy = true;
    for (const b of dialog.querySelectorAll('[data-bdlg-check], [data-bdlg-paste] button')) b.disabled = true;
    say(tx ? 'Reading that transaction on Robinhood Chain…' : 'Looking for your burn on Robinhood Chain…');
    try {
      const r = await postJson('/api/wallet', { action: 'burn', session: s, ...(tx ? { tx } : {}) });
      if (!r.ok) {
        if (r.data.error === 'signed_out') { say('Your session ended. Connect your wallet again.'); dispatchEvent(new CustomEvent('agi:signed-out')); return; }
        say(ERRORS[r.data.error] || ERRORS.busy);
        return;
      }
      dispatchEvent(new CustomEvent('agi:profile', { detail: r.data }));        // the level may go up (src/chat/relationship.js)
      const found = Array.isArray(r.data.found) ? r.data.found : [];
      const good = found.filter((f) => f.ok);
      if (good.length) {
        const messages = good.reduce((n, f) => n + f.messages, 0), agi = good.reduce((n, f) => n + f.agi, 0);
        if (r.data.total) dispatchEvent(new CustomEvent('agi:burn-total', { detail: r.data.total }));   // (the monitor, at once)
        say(`${good.length > 1 ? `${good.length} burns found` : 'Burn found'}: ${fmt(agi)} $AGI, so ${fmt(messages)} more messages. They're yours after your free ones.${r.data.more ? ' More burns are waiting: press Check my burn again.' : ''}`);
        if (tx) d$('[data-bdlg-tx]').value = '';
        const lang = currentLang();
        dispatchEvent(new CustomEvent('agi1:react', { detail: 'love' }));
        dispatchEvent(new CustomEvent('agi:agi1-line', { detail: { text: t('burn.thanks', { n: formatNumber(messages, lang) }), lang } }));
      } else if (found.length) {
        say(WHY[found[0].why] || (found[0].why === 'too_small' ? `That burn is under ${fmt(open.price)} $AGI, the price of one message.` : ERRORS.busy));
      } else {
        say(r.data.counted
          ? 'Your burns so far are all counted. Burned a new one? The block explorer can take a minute: check again, or paste the transaction link.'
          : `No burn from ${short(wallet || '0x')} found yet. The block explorer can take a minute: check again, or paste the transaction link.`);
      }
    } catch {
      say(ERRORS.offline);
    } finally {
      busy = false;
      for (const b of dialog.querySelectorAll('[data-bdlg-check], [data-bdlg-paste] button')) b.disabled = false;
    }
  }
  d$('[data-bdlg-check]').addEventListener('click', () => check(null));
  d$('[data-bdlg-paste]').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = d$('[data-bdlg-tx]').value.trim();
    if (!v) { say(ERRORS.bad_tx); d$('[data-bdlg-tx]').focus(); return; }
    check(v);
  });
  // (the official contract, for "only the official $AGI counts": both ends, as the safety note says)
  const ca = d$('[data-bdlg-ca]');
  if (ca) ca.textContent = `${CA.slice(0, 6)}…${CA.slice(-4)}`;
}
