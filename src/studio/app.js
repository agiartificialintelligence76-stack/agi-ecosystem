// AGI Studio (2026-10-10, studio.agi1.app; also agi1.app/studio): the AI influencer app. One page (studio.html), its views
// drawn here: Explore, Create, an influencer's page, My studio, a 3D model's page, the owner's page, and (round 4, phase 2)
// Help & support and the team's page (Mod tools), at their own
// addresses (history.pushState; Vercel serves this page at every one of them: vercel.json). The owner's words: "the ui will
// be different on this it will be user friendly and easy to use". Since round 4's phase 3: an invite link's code (?ref=) kept
// until a wallet signs in, then joined with; a gift link (#gift=<its secret>) opens its sheet; a gift got shows a toast.
//   • 18+ (the site's own confirmation), a connected wallet (the site's sign-in: an address and a free signature, never a
//     transaction: hard rule 9), credits bought with USDG from the person's own wallet app (this page only shows where to
//     send it, and our server reads the chain after).
//   • Everything it shows is set with textContent; our server's answers are said in words (src/studio/app-words.js).
import '../styles/studio-app.css';
import { postJson, withHuman } from '../lib/human.js';
import { findWallets, signInWithWallet, explainWalletError } from '../lib/wallet.js';
import { WALLET_STEPS, NO_WALLET } from '../live/words.js';
import { h, $, $$, icon, btn, linkBtn, sheet, closeSheets, toast, say, copyText, busy, put, add } from './ui.js';
import { TOPUPS, TOPUP_MIN, usd, creditsText, REF_CODE } from './rules.js';
import {
  LEVEL_NAMES, shortAddress, num, errorText, topupCheckText, welcomeLine, inviteJoinedText, inviteLandingText, gotGiftText,
  GIFT_APPS_NOTE,
} from './app-words.js';
import { noteServerNow, startBars } from './progress.js';
import * as explore from './views/explore.js';
import * as create from './views/create.js';
import * as influencer from './views/influencer.js';
import * as mine from './views/me.js';
import * as owner from './views/owner.js';
import * as model from './views/model3d.js';
import * as help from './views/help.js';
import * as learn from './views/learn.js';
import * as mod from './views/mod.js';
import { openGiftClaim } from './views/gifts.js';
import { offerGuide, leaveGuides, wireGuideButton } from './guide.js';

const API = '/api/launch';
// (round 4, phase 3) an invite link's code, kept until a wallet signs in (30 days at most); the last gifts got that a toast
// told (so it says each once)
const KEYS = { adult: 'agi1_18plus', wallet: 'agi_wallet', invite: 'agi1_studio_ref', gotSeen: 'agi1_studio_got' };
const INVITE_DAYS = 30;
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode: this visit only */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

// ---------- where the app lives: studio.agi1.app/<view>, or agi1.app/studio/<view> ----------
const BASE = /^\/studio(?:\/|$)/.test(location.pathname) ? '/studio' : '';
export const href = (path = '/explore') => `${BASE}${path}`;
const ID = '[A-Za-z0-9_-]{22}';
export function parseRoute(pathname, search = '') {
  let p = String(pathname || '/');
  if (BASE && (p === BASE || p.startsWith(`${BASE}/`))) p = p.slice(BASE.length);
  p = p.replace(/\/+$/, '') || '/';
  const q = new URLSearchParams(search);
  if (p === '/' || p === '/explore') return { view: 'explore', q };
  if (p === '/create') return { view: 'create', q };
  if (p === '/me') return { view: 'me', q };
  if (p === '/owner') return { view: 'owner', q };
  // (round 4, phase 2) Help & support, and the team's page
  if (p === '/help') return { view: 'help', q };
  if (p === '/mod') return { view: 'mod', q };
  // (round 4, phase 4) Learn: short lessons
  if (p === '/learn') return { view: 'learn', q };
  let m = new RegExp(`^/i/(${ID})$`).exec(p);
  if (m) return { view: 'influencer', id: m[1], q };
  m = new RegExp(`^/3d/(${ID})$`).exec(p) || new RegExp(`^/(${ID})$`).exec(p);         // (agi1.app/studio/<id>: a 3D page)
  if (m) return { view: 'model', id: m[1], q };
  return { view: 'missing', q };
}

// ---------- state, and who's listening ----------
const walletOf = (v) => (v && typeof v.session === 'string' && v.session && /^0x[0-9a-f]{40}$/i.test(String(v.wallet)) ? v : null);
const state = { info: null, infoFailed: false, me: null, meError: null, session: walletOf(store.get(KEYS.wallet)) };
const events = new EventTarget();
const emit = (type) => events.dispatchEvent(new Event(type));

async function getJson(query) {
  try {
    const res = await fetch(`${API}?${query}`);
    const data = await res.json().catch(() => ({}));
    // (round 4) an answer about something being made carries our server's clock: its progress bars count from it
    if (res.ok && Number.isFinite(data?.now)) noteServerNow(data.now);
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: 'offline' } };
  }
}

// One of the app's actions (with the wallet's session; `human`: a box for the human check, when the action needs one).
// → { ok, status, data } (never throws). Follows the answer: a session read again (a new level), one that ended, credits.
async function act(action, payload = {}, { human = null } = {}) {
  const sent = state.session;
  const body = { action, ...(sent ? { session: sent.session } : {}), ...payload };
  let r;
  try {
    r = human ? await withHuman(human, 'studio', (extra) => postJson(API, { ...body, ...extra })) : await postJson(API, body);
  } catch (err) {
    r = { ok: false, status: 0, data: { error: ['offline', 'not_configured'].includes(err?.message) ? err.message : 'human_check' } };
  }
  const d = r.data || {};
  if (sent && state.session?.wallet === sent.wallet) {
    if (d.signedOut === true) forget();
    else if (typeof d.session === 'string' && [1, 2, 3].includes(d.level)) keep({ ...state.session, session: d.session, level: d.level }, { quiet: true });
  }
  if (d.credits && Number.isFinite(d.credits.paid) && state.me) setCredits(d.credits);
  if (r.ok && Number.isFinite(d.now)) noteServerNow(d.now);
  return r;
}

// ---------- the wallet ----------
function keep(profile, { quiet = false } = {}) {
  const next = walletOf({ session: profile.session, wallet: String(profile.wallet).toLowerCase(), level: profile.level, name: profile.name ?? null, notes: profile.notes || [] });
  if (!next) return;
  const changed = next.wallet !== state.session?.wallet || next.level !== state.session?.level;
  state.session = next;
  store.set(KEYS.wallet, next);
  if (!quiet || changed) emit('wallet');
  if (changed) refreshMe();
}
function forget() {
  state.session = null;
  state.me = null;
  store.del(KEYS.wallet);
  emit('wallet');
  emit('me');
}
// a wallet signed in or out in another tab (the same session as the home page's on agi1.app)
addEventListener('storage', (e) => {
  if (e.key !== KEYS.wallet && e.key !== null) return;
  const next = walletOf(store.get(KEYS.wallet));
  if (next?.session === state.session?.session) return;
  state.session = next;
  state.me = null;
  emit('wallet');
  if (next) refreshMe(); else emit('me');
});

// The wallet sheet: the wallets in this browser, the site's sign-in. → the session, or null when closed
function connect() {
  return new Promise((resolve) => {
    if (state.session) { resolve(state.session); return; }
    const s = sheet({ title: 'Connect your wallet', sub: 'A free signature, never a transaction.' });
    const note = h('p', { class: 'sa-note', role: 'status', hidden: true });
    const list = h('div', { class: 'sa-wallets' });
    const appsNote = h('p', { class: 'sa-muted' });
    const here = location.href.split('#')[0];
    const apps = h('div', { class: 'sa-apps', hidden: true }, appsNote, h('div', { class: 'sa-row' },
      linkBtn('Open in MetaMask ↗', `https://metamask.app.link/dapp/${location.host}${location.pathname}`, { size: 'sm', rel: 'noopener noreferrer' }),
      linkBtn('Open in Phantom ↗', `https://phantom.app/ul/browse/${encodeURIComponent(here)}?ref=${encodeURIComponent(location.origin)}`, { size: 'sm', rel: 'noopener noreferrer' }),
      linkBtn('Open in Coinbase Wallet ↗', `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(here)}`, { size: 'sm', rel: 'noopener noreferrer' })),
    h('p', { class: 'sa-muted sa-small', text: "Robinhood Wallet: open its Web3 tab, then this page's address. Phantom: turn on Robinhood Chain first (Settings → Active Networks)." }),
    // a gift link is open: these links leave its secret behind (it never goes to those apps' servers)
    /^#gift=/.test(location.hash) ? h('p', { class: 'sa-note sa-small', text: GIFT_APPS_NOTE }) : null);
    add(s.body,
      h('p', { class: 'sa-muted', text: "Your wallet shows it's you and reads your $AGI for holder perks. AGI Studio never asks your wallet to send anything: you buy credits from your own wallet app." }),
      list, apps, note,
    );
    let result = null, attempt = 0;
    s.done.then(() => resolve(result));
    say(note, 'Looking for wallets…');
    findWallets().then((found) => {
      say(note, '');
      put(list, ...found.map((w) => {
        const b = h('button', { type: 'button', class: 'sa-wallet' });
        if (w.icon) add(b, h('img', { src: w.icon, alt: '', width: 28, height: 28 }));
        else add(b, h('span', { class: 'sa-wallet-letter', 'aria-hidden': 'true', text: (w.name || 'W').slice(0, 1).toUpperCase() }));
        add(b, h('span', { text: w.name }));
        b.addEventListener('click', () => connectTo(w));
        return b;
      }));
      apps.hidden = found.length > 0;
      if (!found.length) appsNote.textContent = matchMedia('(pointer: coarse)').matches ? NO_WALLET.phone : NO_WALLET.computer;
      else list.querySelector('button')?.focus();
    });
    async function connectTo(w) {
      const mine = ++attempt;
      try {
        const profile = await signInWithWallet(w.provider, (step) => { if (mine === attempt) say(note, WALLET_STEPS[step]); });
        if (mine !== attempt || !s.dialog.open) return;
        keep(profile);
        result = state.session;
        toast(`Connected: ${shortAddress(result.wallet)} · ${LEVEL_NAMES[result.level] || LEVEL_NAMES[1]}`, 'good');
        s.close();
      } catch (err) {
        if (mine === attempt) say(note, explainWalletError(err));
      }
    }
  });
}
const requireWallet = async () => state.session || connect();

// ---------- 18+ ----------
const isAdult = () => store.get(KEYS.adult) === true;
function requireAdult() {
  if (isAdult()) return Promise.resolve(true);
  return new Promise((resolve) => {
    let yes = false;
    const s = sheet({ title: 'AGI Studio is 18+', sub: 'Everything here is AI-generated and kept PG-13.' });
    add(s.body,
      h('p', { text: "You make AI influencers here: adults only, never a famous person or anyone who didn't say OK, never someone else's character. Please confirm you're 18 or older." }),
    );
    const ok = btn("I'm 18 or older", { kind: 'primary', size: 'lg' });
    ok.addEventListener('click', () => { yes = true; store.set(KEYS.adult, true); emit('adult'); s.close(); });
    s.setFoot(ok, linkBtn("I'm not", 'https://agi1.app/', { kind: 'quiet' }));
    s.done.then(() => resolve(yes));
    ok.focus();
  });
}

// ---------- this wallet in the studio: its credits, its influencers, its prices ----------
let meLoading = null;
function refreshMe() {
  if (!state.session) { state.me = null; emit('me'); return Promise.resolve(null); }
  meLoading ??= (async () => {
    const before = state.session?.wallet;
    const r = await act('inf-me');
    meLoading = null;
    if (state.session?.wallet !== before) return state.me;
    if (r.ok) {
      state.me = r.data;
      state.meError = null;
      if (r.data?.free?.granted && r.data.free.free > 0) {
        toast(`💜 Your ${LEVEL_NAMES[state.session.level] || 'holder'} perk: ${creditsText(r.data.free.free)} free this month`, 'good');
      }
    } else {
      state.meError = r.data?.error || 'busy';
      if (r.data?.error === 'signed_out') state.me = null;
    }
    emit('me');
    return state.me;
  })();
  return meLoading;
}
// A wallet's credits after an action (what's left after a spend, or a gift): since round 4's phase 3 three kinds (bought ones,
// this month's free ones, bonus ones), and what an answer doesn't say (whether it bought, joined through an invite…) is kept
function setCredits(c) {
  if (!state.me || !c) return;
  const prev = state.me.credits || {};
  const n = (k) => (c[k] !== undefined && c[k] !== null && Number.isFinite(Number(c[k])) ? Math.max(0, Number(c[k])) : Math.max(0, Number(prev[k]) || 0));
  const paid = n('paid'), free = n('free'), bonus = n('bonus');
  const flag = (k) => (typeof c[k] === 'boolean' ? c[k] : prev[k] === true);
  state.me = {
    ...state.me,
    credits: { ...prev, paid, free, bonus, total: paid + free + bonus, bought: flag('bought'), invited: flag('invited'), welcomed: flag('welcomed'), got: n('got'), gotN: n('gotN') },
  };
  emit('me');
}
const credits = () => state.me?.credits?.total ?? 0;

// ---------- the studio's settings (the same for everyone) ----------
async function loadInfo() {
  const r = await getJson('inf-info');
  if (r.ok) { state.info = r.data; state.infoFailed = false; }
  else { state.infoFailed = true; setTimeout(loadInfo, 15_000); }
  emit('info');
  return state.info;
}

// ---------- buying credits: USDG from their own wallet app, then "Check my payment" ----------
async function buyCredits({ need = 0 } = {}) {
  if (!(await requireAdult())) return;
  if (!(await requireWallet())) return;
  if (!state.me) await refreshMe();
  const s = sheet({ title: 'Buy credits', sub: '1 credit = 1 cent of USDG. Photos, videos, 3D and more.', size: 'md' });
  const info = state.info;
  if (!info?.usdg || !info.payTo) {
    add(s.body, h('p', { class: 'sa-note', text: errorText('no_usdg') }));
    return s.done;
  }
  const short = Math.max(0, need - credits());
  const pick = TOPUPS.find((c) => c >= short) ?? TOPUPS[TOPUPS.length - 1];
  const have = h('p', { class: 'sa-credit-now' }, icon('bolt'), h('span', { text: `You have ${creditsText(credits())}` }));
  const wantLine = short > 0 ? h('p', { class: 'sa-note', text: `That needs ${creditsText(short)} more.` }) : null;
  // (round 4, phase 3) a wallet that joined through an invite: its welcome credits come with its first top-up of $5 or more
  const c0 = state.me?.credits;
  const welcome = info.refs && c0?.invited && !c0.welcomed ? h('p', { class: 'sa-banner', text: welcomeLine(info.refs, c0) }) : null;
  let amount = pick;
  const title = h('p', { class: 'sa-pay-title' });
  const showAmount = () => { title.textContent = `Send ${usd(amount)} in USDG (${creditsText(amount)})`; };
  const amounts = h('div', { class: 'sa-amounts', role: 'radiogroup', 'aria-label': 'How many credits' });
  for (const c of TOPUPS) {
    const b = h('button', { type: 'button', class: 'sa-amount', role: 'radio', 'aria-checked': String(c === amount) },
      h('strong', { text: usd(c) }), h('span', { text: creditsText(c) }));
    b.addEventListener('click', () => {
      amount = c;
      for (const x of $$('.sa-amount', amounts)) x.setAttribute('aria-checked', String(x === b));
      showAmount();
    });
    add(amounts, b);
  }
  showAmount();
  const to = h('code', { class: 'sa-addr', text: info.payTo });
  const copied = h('span', { class: 'sa-sr', 'aria-live': 'polite' });
  const copy = btn('Copy', { kind: 'ghost', size: 'sm', icon: 'copy' });
  copy.addEventListener('click', async () => {
    const ok = await copyText(info.payTo, to);
    copied.textContent = ok ? "The studio's wallet address copied" : 'Selected: copy it with your keyboard or a long-press';
    toast(ok ? 'Address copied' : 'Address selected: copy it', 'good');
  });
  const tx = h('input', { class: 'sa-input', type: 'text', inputmode: 'url', autocomplete: 'off', spellcheck: 'false', placeholder: 'Its link or ID (optional)', 'aria-label': "The transaction's link or ID (optional)" });
  const result = h('p', { class: 'sa-note', role: 'status', hidden: true });
  const check = btn('Check my payment', { kind: 'primary', size: 'lg', icon: 'refresh' });
  check.addEventListener('click', () => busy(check, 'Checking Robinhood Chain…', async () => {
    const pasted = tx.value.trim();
    const r = await act('inf-topup', pasted ? { tx: pasted } : {});
    const d = r.data || {};
    if (r.ok && d.ok) {
      if (d.credits) setCredits(d.credits);
      have.lastChild.textContent = `You have ${creditsText(credits())}`;
      say(result, topupCheckText(d));
      if (d.added > 0) { tx.value = ''; toast(topupCheckText(d), 'good'); }
      return;
    }
    say(result, errorText(d.error));
  }));
  add(s.body,
    have, wantLine, welcome, amounts,
    h('div', { class: 'sa-pay' },
      h('p', { class: 'sa-step-n', text: '1' }), title,
      h('p', { class: 'sa-muted', text: `From your connected wallet (${shortAddress(state.session?.wallet)}), in your own wallet app, on Robinhood Chain, to the studio's wallet:` }),
      h('div', { class: 'sa-addr-row' }, to, copy), copied,
      h('p', { class: 'sa-small sa-muted', text: `Only USDG counts (Paxos' Global Dollar on Robinhood Chain, its contract ${shortAddress(info.token)}). Any amount from ${usd(TOPUP_MIN)} counts: every cent is a credit. Its network fee is a little ETH.` })),
    h('div', { class: 'sa-pay' },
      h('p', { class: 'sa-step-n', text: '2' }), h('p', { class: 'sa-pay-title', text: 'Then check it here' }),
      h('label', { class: 'sa-label', text: 'Paste its link or ID if you like (we can find it without)' }), tx, check, result),
    h('p', { class: 'sa-fine', text: "Credits have no cash value: they can't be withdrawn, sold or refunded. Something that can't be made gives its credits back. Holder perks are a thank-you for holding, not an investment. Not financial advice." }),
  );
  return s.done;
}

// ---------- trend moves (Explore's list, kept a little while: the trend sheet uses it too) ----------
let exploreCache = null;
async function exploreData({ fresh = false } = {}) {
  if (!fresh && exploreCache && Date.now() - exploreCache.at < 30_000) return exploreCache.data;
  const r = await getJson('inf-explore');
  if (r.ok) exploreCache = { at: Date.now(), data: r.data };
  return r.ok ? r.data : exploreCache?.data || null;
}

// ---------- the app bar and the tabs ----------
// (round 4, phase 2) the tab bar's My studio (phones) with a dot when the team answered one of its support tickets
function markNews() {
  const unread = state.session ? Number(state.me?.support?.unread) || 0 : 0;
  for (const a of $$('.sa-tabs a[data-sa-route="me"]')) {
    a.classList.toggle('sa-has-news', unread > 0);
    let sr = a.querySelector('.sa-news-sr');
    if (unread > 0 && !sr) { sr = h('span', { class: 'sa-sr sa-news-sr' }); a.append(sr); }
    if (sr) sr.textContent = unread > 0 ? `, ${unread === 1 ? 'a new answer' : `${unread} new answers`} from support` : '';
  }
}
function renderBar() {
  markNews();
  const slot = $('[data-sa-account]');
  if (!slot) return;
  const s = state.session;
  if (!s) {
    const b = btn('Connect wallet', { kind: 'primary', size: 'sm', icon: 'wallet' });
    b.addEventListener('click', () => connect());
    put(slot, b);
    return;
  }
  // (round 3) the credits pill with its own +: what you have (a tap: My studio), and buying more right there
  const pill = h('a', { class: 'sa-pill', href: href('/me'), dataset: { saLink: '' }, 'aria-label': `${creditsText(credits())}: my studio` },
    icon('bolt'), h('span', { text: state.me ? num(credits()) : '…' }));
  const plus = h('button', { type: 'button', class: 'sa-pill-plus', 'aria-label': 'Buy credits' }, icon('plus'));
  plus.addEventListener('click', () => buyCredits());
  // (round 4, phase 2) a dot when the team answered one of its support tickets
  const unread = Number(state.me?.support?.unread) || 0;
  const who = h('a', { class: 'sa-me-btn', href: href('/me'), dataset: { saLink: '' },
    'aria-label': `My studio: ${shortAddress(s.wallet)}, ${LEVEL_NAMES[s.level] || LEVEL_NAMES[1]}${unread ? `, ${unread === 1 ? 'a new answer' : `${unread} new answers`} from support` : ''}` },
    h('span', { class: `sa-dot sa-lvl-${s.level}`, 'aria-hidden': 'true' }), h('span', { class: 'sa-me-addr', text: shortAddress(s.wallet) }),
    unread ? h('span', { class: 'sa-unread-dot', 'aria-hidden': 'true' }) : null);
  put(slot, h('div', { class: 'sa-credits' }, pill, plus), who);
}
function markNav(view) {
  const tab = { explore: 'explore', create: 'create', me: 'me', influencer: null, model: null, owner: 'me', help: 'me', mod: 'me', missing: null }[view];
  for (const a of $$('[data-sa-route]')) {
    if (a.dataset.saRoute === tab) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
}

// ---------- the router ----------
const VIEWS = { explore, create, influencer, me: mine, owner, model, help, mod, learn, missing: { render: missingView } };
let current = { stop: null, token: 0 };
function missingView(ctx, route, root) {
  document.title = 'Not here · AGI Studio';
  add(root, h('section', { class: 'sa-empty-page' },
    h('h1', { class: 'sa-display sa-page-title', tabindex: '-1', text: "This page isn't here" }),
    h('p', { class: 'sa-muted', text: 'It may have been deleted, or the link is mistyped.' }),
    linkBtn('Go to Explore', href('/explore'), { kind: 'primary', dataset: { saLink: '' } })));
}
async function show({ focus = false } = {}) {
  closeSheets();
  // (2026-10-11) the guide on screen goes with its page
  leaveGuides();
  current.stop?.();
  const token = ++current.token;
  const route = parseRoute(location.pathname, location.search);
  // (2026-10-11) ?guide=1 (Learn's "Show me with arrows"): this page's guide at once, and the address without it
  let guideNow = route.q.get('guide') === '1';
  if (route.q.has('guide')) {
    const q = new URLSearchParams(location.search);
    q.delete('guide');
    const rest = q.toString();
    history.replaceState(history.state, '', `${location.pathname}${rest ? `?${rest}` : ''}${location.hash}`);
  }
  const root = $('[data-sa-view]');
  put(root);
  root.className = 'sa-view';
  root.dataset.view = route.view;
  markNav(route.view);
  // the bar's ? button: a page's guide (Learn has the lessons themselves)
  for (const b of $$('[data-sa-guide]')) b.hidden = route.view === 'learn';
  const stops = [];
  const ctx = makeCtx(route, stops, () => token === current.token, () => { const f = guideNow; guideNow = false; return f; });
  current.stop = () => { for (const f of stops.splice(0)) { try { f(); } catch { /* ignore */ } } };
  try {
    const stop = await VIEWS[route.view].render(ctx, route, root);
    if (typeof stop === 'function') stops.push(stop);
  } catch (err) {
    console.error('[studio]', err);
    if (token === current.token) put(root, h('p', { class: 'sa-note', text: errorText('busy') }));
  }
  if (focus && token === current.token) (root.querySelector('h1[tabindex]') || $('#sa-main'))?.focus({ preventScroll: true });
}
function nav(path, { replace = false } = {}) {
  const url = new URL(path, location.origin);
  if (url.pathname + url.search + url.hash === location.pathname + location.search + location.hash) { show({ focus: true }); return; }
  history[replace ? 'replaceState' : 'pushState']({}, '', url.pathname + url.search + url.hash);
  scrollTo(0, 0);
  show({ focus: true });
}
// links inside the app (the bar, the tabs, the views): no page load
document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest?.('a[href]');
  if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin) return;
  const inApp = BASE ? url.pathname === BASE || url.pathname.startsWith(`${BASE}/`) : parseRoute(url.pathname).view !== 'missing';
  if (!inApp) return;
  e.preventDefault();
  if (url.pathname === location.pathname && url.search === location.search && url.hash && url.hash !== location.hash) {
    history.pushState({}, '', url.hash);
    dispatchEvent(new HashChangeEvent('hashchange'));
    return;
  }
  nav(url.pathname + url.search + url.hash);
});
addEventListener('popstate', () => show({ focus: true }));

// What every view gets
function makeCtx(route, stops, alive, forced = () => false) {
  const ctx = {
    route, href, nav, alive, BASE,
    get info() { return state.info; },
    get infoFailed() { return state.infoFailed === true; },
    get me() { return state.me; },
    get meError() { return state.meError; },
    get session() { return state.session; },
    get level() { return state.session?.level || 1; },
    get credits() { return credits(); },
    adult: isAdult,
    getJson, act, connect, requireWallet, requireAdult, refreshMe, setCredits, buyCredits, exploreData, toast,
    signOut() { forget(); toast('Disconnected'); },
    // listen to 'info' | 'me' | 'wallet' | 'adult' while this view is shown
    on(type, fn) { events.addEventListener(type, fn); stops.push(() => events.removeEventListener(type, fn)); },
    later(fn, ms) { const t = setTimeout(() => { if (alive()) fn(); }, ms); stops.push(() => clearTimeout(t)); return t; },
    every(fn, ms) { const t = setInterval(() => { if (alive()) fn(); }, ms); stops.push(() => clearInterval(t)); return t; },
    listen(target, type, fn, opts) { target.addEventListener(type, fn, opts); stops.push(() => target.removeEventListener(type, fn, opts)); },
    // (2026-10-11) this page's guide (src/studio/guide.js): it starts by itself the first time this browser opens the page, and
    // the bar's ? button shows it again. env: what the page is like now and how to show its parts (a drawer: open, close)
    guide(id, env = {}) {
      if (!alive()) return;
      offerGuide(id, { signedIn: () => Boolean(state.session), ...env }, { force: forced() });
    },
  };
  return ctx;
}

// ---------- (round 4, phase 3) invites, gift links, gifts got ----------
// An invite link (…?ref=<code>): its code is kept in this browser (30 days at most) and taken out of the page's address; once
// a wallet is signed in, it joins with it (only a wallet that never bought credits, once: our server decides).
let invitedNow = false;
function catchInvite() {
  const q = new URLSearchParams(location.search);
  if (!q.has('ref')) return;
  const code = String(q.get('ref') || '').trim().toLowerCase();
  if (REF_CODE.test(code)) { store.set(KEYS.invite, { code, at: Date.now() }); invitedNow = true; }
  q.delete('ref');
  const rest = q.toString();
  history.replaceState(history.state, '', `${location.pathname}${rest ? `?${rest}` : ''}${location.hash}`);
}
function inviteCode() {
  const v = store.get(KEYS.invite);
  if (!v) return null;
  if (!REF_CODE.test(String(v.code)) || !(Date.now() - Number(v.at) < INVITE_DAYS * 86_400_000)) { store.del(KEYS.invite); return null; }
  return v.code;
}
let joining = false;
async function joinInvite() {
  const code = inviteCode();
  if (!code || joining || !state.session || !state.me?.credits || !state.info?.refs) return;
  const c = state.me.credits;
  if (c.invited || c.bought || state.me.banned) { store.del(KEYS.invite); return; }
  joining = true;
  const wallet = state.session.wallet;
  const r = await act('inf-ref-bind', { code });
  joining = false;
  if (state.session?.wallet !== wallet) return;
  if (r.ok && r.data?.ok) {
    store.del(KEYS.invite);
    toast(inviteJoinedText(state.info?.refs), 'good');
    refreshMe();
    return;
  }
  // a "no" that won't change (not an invite, their own, it bought already…): the code is dropped; a hiccup: tried next time
  if (['refs_off', 'ref_bad', 'ref_none', 'ref_self', 'ref_already', 'ref_bought', 'ref_loop', 'banned', 'bad_request'].includes(r.data?.error)) store.del(KEYS.invite);
}
// Gifts it got and hasn't seen yet (our server counts them until My studio shows them): a toast, once for each
function tellGifts() {
  const c = state.me?.credits;
  if (!state.session || !c || !(c.gotN > 0)) return;
  const sig = `${state.session.wallet}|${c.gotN}|${c.got}`;
  if (store.get(KEYS.gotSeen) === sig) return;
  store.set(KEYS.gotSeen, sig);
  if (parseRoute(location.pathname, location.search).view === 'me') return;          // (My studio shows them already)
  toast(gotGiftText(c.gotN, c.got), 'good');
}
// A gift link (…#gift=<its secret>): its sheet. The secret stays in the fragment (never sent with the page's address) and
// goes only in a POST's body; the sheet takes it out of the address when it closes.
const appApi = { act, requireAdult, requireWallet, refreshMe, toast, href, signedIn: () => !!state.session, findWallets };
let claiming = false;
async function giftFromAddress() {
  if (claiming || !/^#gift=/.test(location.hash)) return;
  const m = /^#gift=([A-Za-z0-9_-]{22})(?![A-Za-z0-9_-])/.exec(location.hash);
  claiming = true;
  try { await openGiftClaim(appApi, m ? m[1] : location.hash.slice(6)); } finally { claiming = false; }
}
addEventListener('hashchange', giftFromAddress);

// ---------- start ----------
function start() {
  // (round 4, phase 3) an invite link's code, before any view reads the address
  catchInvite();
  // the static links in studio.html name /studio/…: on studio.agi1.app they become /…
  for (const a of $$('a[data-sa-path]')) a.href = href(a.dataset.saPath);
  events.addEventListener('wallet', renderBar);
  events.addEventListener('me', renderBar);
  events.addEventListener('me', () => { tellGifts(); joinInvite(); });
  events.addEventListener('info', () => {
    joinInvite();
    // a visitor who came through an invite link, without a wallet yet: what joining brings
    if (invitedNow && state.info?.refs) {
      invitedNow = false;
      if (!state.session) toast(inviteLandingText(state.info.refs), 'good');
    }
  });
  renderBar();
  // (2026-10-11) the bar's ? button: this page's guide, else Learn's lessons
  wireGuideButton(() => nav(href('/learn')));
  loadInfo();
  // (round 4) the progress bars of what's being made move every second (one timer for every view)
  startBars();
  if (state.session) {
    // its level now (our server reads the balance again when it's 30 minutes old), then its studio
    postJson('/api/wallet', { action: 'profile', session: state.session.session })
      .then((r) => { if (r.ok) keep(r.data, { quiet: true }); else if (r.data?.error === 'signed_out') forget(); })
      .catch(() => { /* offline: keep what we have */ })
      .finally(() => { if (state.session && !state.me) refreshMe(); });
  }
  // the credits pill stays true when they come back to the tab (at most every 30 s)
  let lastLook = Date.now();
  addEventListener('focus', () => {
    if (!state.session || document.visibilityState !== 'visible' || Date.now() - lastLook < 30_000) return;
    lastLook = Date.now();
    refreshMe();
  });
  show();
  // (round 4, phase 3) a gift link opened here
  giftFromAddress();
}
start();
