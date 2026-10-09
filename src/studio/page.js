// AGI-1's 3D character studio (2026-10-10, studio.html): agi1.app/studio makes a character (18+; a connected wallet: the
// site's own sign-in, a free signature; its words; its price; paid from the person's OWN wallet app, never asked of their
// wallet here: hard rule 9), and agi1.app/studio/<id> (the same page, Vercel's rewrite) is a character's own page: while
// it's made, its steps; once done, the character in 3D (src/studio/viewer.js, loaded only there), moving when you type a
// move in its chat box, its picture and 3D model to download. Everything it shows is set with textContent.
import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/layout.css';
import '../styles/sections.css';
import '../styles/footer.css';
import '../styles/studio.css';
import '../styles/pop.css';      // Pop mode: the bold look, only while it's switched on
import { startTheme } from '../theme.js';
import { startMenu } from '../menu.js';
import { withHuman, postJson } from '../lib/human.js';
import { findWallets, signInWithWallet, explainWalletError } from '../lib/wallet.js';
import { botName } from '../chat/telegram-link.js';
import { WALLET_STEPS, NO_WALLET } from '../live/words.js';
import { ORDER_ID, MOVE_NAMES, STEPS, fileUrl, moveIn, usd, NAME_MAX, ABOUT_MAX, SCENE_MAX, SHAPES, VIDEO_SECONDS, videoUrl, videoDownload } from './rules.js';
import {
  statusText, walletText, wordsText, errorText, checkText, charText, failText, shareUrl, agiText, shortAddress,
  STEP_WORDS, MAKING_NOTE, REACTIONS, LEVEL_NAMES,
  videoMeta, videoPriceText, videoStateText, videoErrorText, videoCheckText, videoShareUrl,
} from './words.js';

const KEYS = { adult: 'agi1_18plus', wallet: 'agi_wallet', order: 'agi1_studio_order' };
const POLL_EVERY = 5000;
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode: this visit only */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const visible = () => document.visibilityState === 'visible';
const api = (body) => postJson('/api/launch', body);
async function getJson(query) {
  try {
    const res = await fetch(`/api/launch?${query}`);
    return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
  } catch {
    return { ok: false, status: 0, data: { error: 'offline' } };
  }
}
const say = (node, text) => { if (node) { node.textContent = text || ''; node.hidden = !text; } };

// ---------- the wallet: the site's own sign-in, the same session as the home page's (a free signature, never a transaction) ----------
const walletOf = (v) => (v && typeof v.session === 'string' && v.session && /^0x[0-9a-f]{40}$/i.test(String(v.wallet)) ? v : null);
function walletBox({ note, me: meLine, connect, out, list, apps, appsNote }, onChange) {
  let me = walletOf(store.get(KEYS.wallet));
  let attempt = 0;
  const keep = (p) => {
    me = walletOf({ session: p.session, wallet: p.wallet, level: p.level, name: p.name ?? null, notes: p.notes || [] });
    if (me) store.set(KEYS.wallet, me);
    onChange(me);
  };
  const forget = () => { me = null; store.del(KEYS.wallet); onChange(null); };
  async function sessionFor(provider, address) {
    const saved = walletOf(store.get(KEYS.wallet));
    if (saved && saved.wallet.toLowerCase() === address) {
      try {
        const r = await postJson('/api/wallet', { action: 'profile', session: saved.session });
        if (r.ok) return r.data;
      } catch { /* offline: sign in below */ }
    }
    return signInWithWallet(provider, (step) => say(note, WALLET_STEPS[step]));
  }
  async function connectTo(w) {
    const mine = ++attempt;
    const slow = setTimeout(() => { if (mine === attempt) say(note, WALLET_STEPS.slow); }, 15_000);
    say(note, WALLET_STEPS.connect);
    try {
      const accounts = await w.provider.request({ method: 'eth_requestAccounts' });
      if (mine !== attempt) return;
      const address = Array.isArray(accounts) && typeof accounts[0] === 'string' ? accounts[0].toLowerCase() : '';
      if (!/^0x[0-9a-f]{40}$/.test(address)) throw new Error('no_account');
      const profile = await sessionFor(w.provider, address);
      if (mine !== attempt) return;
      if (String(profile.wallet).toLowerCase() !== address) throw new Error('wrong_signer');
      say(note, '');
      keep(profile);
      out?.focus({ preventScroll: true });
    } catch (err) {
      if (mine === attempt) say(note, explainWalletError(err));
    } finally {
      clearTimeout(slow);
    }
  }
  connect?.addEventListener('click', async () => {
    say(note, 'Looking for wallets…');
    const found = await findWallets();
    say(note, '');
    list.replaceChildren(...found.map((w) => {
      const b = el('button', 'btn btn-ghost btn-sm st-wallet');
      b.type = 'button';
      if (w.icon) {
        const img = el('img');
        img.src = w.icon; img.alt = ''; img.width = 18; img.height = 18;
        b.append(img);
      }
      b.append(document.createTextNode(w.name));
      b.addEventListener('click', () => connectTo(w));
      return b;
    }));
    list.hidden = !found.length;
    apps.hidden = found.length > 0;
    if (found.length) { list.querySelector('button')?.focus(); return; }
    appsNote.textContent = matchMedia('(pointer: coarse)').matches ? NO_WALLET.phone : NO_WALLET.computer;
    const here = location.href.split('#')[0];
    $('[data-st-app="metamask"]', apps).href = `https://metamask.app.link/dapp/${location.host}${location.pathname}`;
    $('[data-st-app="phantom"]', apps).href = `https://phantom.app/ul/browse/${encodeURIComponent(here)}?ref=${encodeURIComponent(location.origin)}`;
    $('[data-st-app="coinbase"]', apps).href = `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(here)}`;
  });
  out?.addEventListener('click', () => { forget(); connect?.focus({ preventScroll: true }); });
  addEventListener('storage', (e) => { if (e.key === KEYS.wallet || e.key === null) { me = walletOf(store.get(KEYS.wallet)); onChange(me); } });
  // coming back: its level now (our server reads the balance again when it's 30 minutes old)
  if (me) {
    postJson('/api/wallet', { action: 'profile', session: me.session })
      .then((r) => { if (r.ok) keep(r.data); else if (r.data?.error === 'signed_out') forget(); })
      .catch(() => { /* offline: keep what we have */ });
  }
  return {
    get me() { return me; },
    // an answer from our server: a session it read again (a new level), or one that ended
    follow(d, sent) {
      if (!sent || me?.wallet !== sent.wallet) return;
      if (d?.signedOut === true) forget();
      else if (typeof d?.session === 'string' && [1, 2, 3].includes(d.level)) keep({ ...me, session: d.session, level: d.level });
    },
    render() {
      say(meLine, me ? `${shortAddress(me.wallet)} · ${LEVEL_NAMES[me.level] || LEVEL_NAMES[1]}` : '');
      connect.hidden = Boolean(me);
      out.hidden = !me;
      if (me) { list.hidden = true; apps.hidden = true; }
    },
  };
}

// ---------- the studio's own page: making one ----------
// a character this browser is paying for, as it kept it (anything else is forgotten)
const orderOf = (o) => (o && ORDER_ID.test(String(o.id)) && typeof o.name === 'string' && Number.isFinite(o.price?.usdCents) && Number.isFinite(o.price?.agi) ? o : null);
function makePage(ui) {
  let info = null, allowed = null, order = orderOf(store.get(KEYS.order)), sending = false;
  if (!order) store.del(KEYS.order);
  const adult = () => store.get(KEYS.adult) === true;
  const wallet = walletBox({
    note: ui.walletNote, me: ui.me, connect: ui.connect, out: ui.out, list: ui.wallets, apps: ui.apps, appsNote: ui.appsNote,
  }, () => { allowed = null; render(); loadMine(); });

  async function loadInfo() {
    const r = await getJson('studio-info');
    if (r.ok) info = r.data;
    render();
    if (!r.ok) setTimeout(loadInfo, 15_000);
  }
  // its characters (and whether it may make one while the studio is private)
  async function loadMine() {
    const me = wallet.me;
    ui.mineBox.hidden = true;
    if (!me || !info?.on) return;
    let r;
    try { r = await api({ action: 'studio-mine', session: me.session }); } catch { return; }
    wallet.follow(r.data, me);
    if (!r.ok) return;
    allowed = r.data.allowed === true;
    const list = Array.isArray(r.data.characters) ? r.data.characters : [];
    ui.mineList.replaceChildren(...list.map((c) => {
      const li = el('li', 'st-mine-item');
      const a = el('a', 'st-mine-link', c.name);
      a.href = `/studio/${c.id}`;
      const what = c.status === 'done' ? 'Ready' : c.status === 'failed' ? (c.credit ? "Couldn't be made: try again free" : "Couldn't be made")
        : c.status === 'quote' ? 'Waiting for payment' : 'Being made';
      li.append(a, el('span', 'st-mine-state mono', what));
      return li;
    }));
    ui.mineBox.hidden = !list.length;
    render();
  }

  function render() {
    say(ui.status, statusText(info, { allowed: allowed !== false }));
    ui.adultStep.hidden = adult();
    const on = Boolean(info?.on);
    const me = wallet.me;
    wallet.render();
    if (me) say(ui.me, walletText(me, info));
    // each step once the one before it is done
    const steps = { wallet: adult() && on, describe: adult() && on && Boolean(me) && allowed !== false && (info?.left ?? 0) > 0 && !order,
      pay: adult() && on && Boolean(me) && Boolean(order) };
    ui.walletStep.hidden = !steps.wallet;
    ui.describeStep.hidden = !steps.describe;
    ui.payStep.hidden = !steps.pay;
    ui.privateNote.hidden = !(me && allowed === false);
    ui.walletStep.classList.toggle('is-done', Boolean(me));
    if (steps.pay) renderPay();
  }

  // ---------- 2: its words ----------
  ui.about?.addEventListener('input', () => { ui.count.textContent = String([...ui.about.value].length); ui.error.textContent = ''; });
  ui.name?.addEventListener('input', () => { ui.error.textContent = ''; });
  ui.form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (sending) return;
    const me = wallet.me;
    if (!me) return;
    const name = ui.name.value.trim(), about = ui.about.value.trim();
    const style = $('input[name="st-style"]:checked')?.value;
    if (!name) { ui.error.textContent = wordsText('name', 'empty'); ui.name.focus(); return; }
    if ([...about].length < 10) { ui.error.textContent = wordsText('about', about ? 'short' : 'empty'); ui.about.focus(); return; }
    if (!style) { ui.error.textContent = wordsText('style', 'empty'); return; }
    sending = true;
    ui.quote.disabled = true;
    ui.quote.textContent = 'Checking…';
    ui.error.textContent = '';
    let r;
    try {
      r = await withHuman(ui.human, 'studio', (extra) => api({ action: 'studio-quote', session: me.session, name, about, style, adult: true, ...extra }));
    } catch (err) {
      r = { ok: false, data: { error: err.message === 'offline' ? 'offline' : err.message === 'not_configured' ? 'not_configured' : 'human_check' } };
    }
    sending = false;
    ui.quote.disabled = false;
    ui.quote.textContent = 'Get my price';
    const d = r.data || {};
    wallet.follow(d, me);
    if (r.ok && d.ok && ORDER_ID.test(String(d.id))) {
      order = { id: d.id, name, price: d.price, usdg: d.usdg === true, burn: d.burn === true, free: d.free === true, kind: null, at: Date.now() };
      store.set(KEYS.order, order);
      ui.form.reset();
      ui.count.textContent = '0';
      render();
      ui.payStep.focus();
      return;
    }
    if (d.error === 'words') {
      ui.error.textContent = wordsText(d.field, d.why);
      (d.field === 'name' ? ui.name : ui.about).focus();
    } else {
      ui.error.textContent = errorText(d.error);
      if (d.error === 'closed') { allowed = false; render(); }
    }
  });

  // ---------- 3: paying (from their own wallet app: this page only shows where to and reads the chain after) ----------
  function renderPay() {
    if (!order) return;
    ui.payName.textContent = order.name;
    const off = wallet.me?.level === 3 ? ' (Soulmate: 40% off)' : wallet.me?.level === 2 ? ' (Crush: 20% off)' : '';
    ui.payPrice.textContent = `${[order.usdg ? `${usd(order.price.usdCents)} in USDG` : null, order.burn ? `${agiText(order.price.agi)} burned` : null]
      .filter(Boolean).join(' or ') || 'Its price'}${off}`;
    const opts = { usdg: order.usdg, burn: order.burn, free: order.free };
    for (const [kind, ok] of Object.entries(opts)) {
      const opt = $(`[data-st-pay-opt="${kind}"]`);
      if (opt) opt.hidden = !ok;
    }
    $('[data-st-pay-usdg]').textContent = usd(order.price.usdCents);
    $('[data-st-pay-burn]').textContent = agiText(order.price.agi);
    for (const input of $$('input[name="st-pay"]')) input.checked = input.value === order.kind;
    ui.how.hidden = !order.kind || order.kind === 'free';
    if (order.kind && order.kind !== 'free') renderHow();
    ui.payNone.hidden = order.usdg || order.burn || order.free;
  }
  function renderHow() {
    const me = wallet.me;
    const usdg = order.kind === 'usdg';
    const amount = usdg ? `${usd(order.price.usdCents)} in USDG` : agiText(order.price.agi);
    const to = usdg ? info?.payTo : info?.burnAddress;
    ui.howTitle.textContent = usdg ? `Send ${amount}` : `Burn ${amount}`;
    ui.howFrom.textContent = me ? `From your connected wallet (${shortAddress(me.wallet)}), in your own wallet app, on Robinhood Chain:` : '';
    ui.howTo.textContent = to || '';
    ui.howToLabel.textContent = usdg ? "To the studio's wallet" : 'To the burn address';
    ui.howToken.textContent = usdg
      ? `Only USDG counts (Paxos' Global Dollar on Robinhood Chain, its contract ${shortAddress(info?.token)}). Its network fee is a little ETH.`
      : 'Only the official $AGI counts (0xfa31…06ec). Burned $AGI is gone for good, and it counts toward your level like a burn for messages. Its network fee is a little ETH.';
  }
  for (const input of $$('input[name="st-pay"]')) {
    input.addEventListener('change', async () => {
      if (!order || !input.checked || sending) return;
      const me = wallet.me;
      if (!me) return;
      sending = true;
      say(ui.checkMsg, '');
      let r;
      try { r = await api({ action: 'studio-choose', session: me.session, id: order.id, kind: input.value }); } catch { r = { ok: false, data: { error: 'offline' } }; }
      sending = false;
      wallet.follow(r.data, me);
      const d = r.data || {};
      if (r.ok && d.ok) {
        order.kind = d.kind;
        store.set(KEYS.order, order);
        if (d.paid) { goMake(); return; }
        renderPay();
        return;
      }
      if (d.error === 'gone') { dropOrder(errorText('gone')); return; }
      if (d.error === 'done') { goMake(); return; }
      say(ui.checkMsg, errorText(d.error));
      for (const i of $$('input[name="st-pay"]')) i.checked = i.value === order.kind;
    });
  }
  // Copy: the address shown (the studio's wallet, or the burn address); where the clipboard is blocked, it's selected
  let copyReset = null;
  ui.copy?.addEventListener('click', async () => {
    const what = order?.kind === 'usdg' ? "The studio's wallet address" : 'The burn address';
    let copied = true;
    try { await navigator.clipboard.writeText(ui.howTo.textContent); } catch {
      copied = false;
      const range = document.createRange();
      range.selectNodeContents(ui.howTo);
      getSelection().removeAllRanges();
      getSelection().addRange(range);
    }
    ui.copy.textContent = copied ? 'Copied' : 'Selected';
    ui.copySay.textContent = `${what} ${copied ? 'copied' : 'selected: copy it with your keyboard or a long-press'}`;
    clearTimeout(copyReset);
    copyReset = setTimeout(() => { ui.copy.textContent = 'Copy'; ui.copySay.textContent = ''; }, 1800);
  });

  ui.check?.addEventListener('click', async () => {
    if (!order || sending) return;
    const me = wallet.me;
    if (!me) return;
    const pasted = ui.tx.value.trim();
    sending = true;
    ui.check.disabled = true;
    ui.check.textContent = 'Checking Robinhood Chain…';
    say(ui.checkMsg, '');
    let r;
    try { r = await api({ action: 'studio-check', session: me.session, id: order.id, ...(pasted ? { tx: pasted } : {}) }); } catch { r = { ok: false, data: { error: 'offline' } }; }
    sending = false;
    ui.check.disabled = false;
    ui.check.textContent = 'Check my payment';
    const d = r.data || {};
    wallet.follow(d, me);
    if (r.ok && d.ok) {
      say(ui.checkMsg, checkText(d, order.kind));
      if (d.paid) { ui.tx.value = ''; setTimeout(goMake, 900); }
      return;
    }
    if (d.error === 'gone') { dropOrder(errorText('gone')); return; }
    say(ui.checkMsg, errorText(d.error));
  });
  ui.cancel?.addEventListener('click', () => dropOrder(''));

  function dropOrder(note) {
    store.del(KEYS.order);
    order = null;
    render();
    say(ui.error, note);
    ui.name?.focus();
  }
  // paid: its own page shows it being made
  function goMake() {
    const id = order.id;
    store.del(KEYS.order);
    location.assign(`/studio/${id}`);
  }

  // a character this browser started: still waiting for its payment? (paid or made since: its own page)
  async function resume() {
    if (!order) return;
    const r = await getJson(`studio=${encodeURIComponent(order.id)}`);
    const c = r.data?.character;
    if (r.status === 404 || c?.status === 'expired') { dropOrder(r.status === 404 ? '' : errorText('gone')); return; }
    if (c && c.status !== 'quote') { goMake(); return; }
    if (c?.kind && !order.kind) { order.kind = c.kind; store.set(KEYS.order, order); }
    render();
  }

  // ---------- the gallery ----------
  async function loadGallery() {
    const r = await getJson('studio-list');
    const list = r.ok && Array.isArray(r.data.characters) ? r.data.characters : [];
    ui.gallery.replaceChildren(...list.map((c) => {
      const li = el('li', 'st-g-item');
      const a = el('a', 'st-g-link');
      a.href = `/studio/${c.id}`;
      const img = el('img', 'st-g-pic');
      img.src = fileUrl(c.id, 'webp'); img.alt = ''; img.width = 192; img.height = 192; img.loading = 'lazy'; img.decoding = 'async';
      img.addEventListener('error', () => img.classList.add('is-missing'));
      a.append(img, el('span', 'st-g-name', c.name));
      li.append(a);
      return li;
    }));
    ui.galleryBox.hidden = !list.length;
  }

  ui.adult?.addEventListener('click', () => { store.set(KEYS.adult, true); render(); ui.connect?.focus(); });
  addEventListener('storage', (e) => { if (e.key === KEYS.adult || e.key === KEYS.order) { order = orderOf(store.get(KEYS.order)); render(); } });
  render();
  loadInfo().then(() => { loadMine(); resume(); });
  loadGallery();
}

// ---------- a character's own page ----------
function charPage(ui, id) {
  ui.make.hidden = true;
  ui.char.hidden = false;
  ui.root.setAttribute('aria-labelledby', 'st-c-title');       // the section is named by the character's own heading
  let c = null, viewer = null, timer = null, busy = false;
  const wallet = walletBox({
    note: ui.rNote, me: ui.rMe, connect: ui.rConnect, out: ui.rOut, list: ui.rWallets, apps: ui.rApps, appsNote: ui.rAppsNote,
  }, () => renderRedo());

  async function load() {
    clearTimeout(timer);
    if (busy) return;
    busy = true;
    const r = await getJson(`studio=${encodeURIComponent(id)}`);
    busy = false;
    if (r.status === 404 || r.status === 400) { c = null; render(); return; }
    if (r.ok) { c = r.data.character; render(); }
    else if (!c) { say(ui.cStatus, errorText(r.data?.error)); timer = setTimeout(load, 15_000); return; }
    if (c && (c.status === 'paid' || c.status === 'making') && visible()) timer = setTimeout(load, POLL_EVERY);
  }
  document.addEventListener('visibilitychange', () => { if (visible() && c && (c.status === 'paid' || c.status === 'making')) load(); });

  function render() {
    document.title = c ? `${c.name} · AGI-1's studio · AGI` : "AGI-1's studio · AGI";
    ui.cName.textContent = c?.name || 'Not here';
    ui.cMeta.textContent = c ? [c.style ? `${c.style[0].toUpperCase()}${c.style.slice(1)}` : '', c.done ? `made ${new Date(c.done).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}` : ''].filter(Boolean).join(' · ') : '';
    ui.cAbout.textContent = c?.about || '';
    ui.cAbout.hidden = !c?.about;
    say(ui.cStatus, charText(c));
    const making = c && (c.status === 'paid' || c.status === 'making');
    ui.progress.hidden = !making;
    if (making) renderProgress();
    const done = c?.status === 'done';
    ui.done.hidden = !done;
    if (done) { startViewer(); startVideos(); }
    ui.redo.hidden = !(c?.status === 'failed' && c.credit);
    if (!ui.redo.hidden) renderRedo();
    ui.cContinue.hidden = !(c?.status === 'quote' && store.get(KEYS.order)?.id === id);
  }

  function renderProgress() {
    const at = STEPS.findIndex((s) => s.step === (c.step || 'preview'));
    ui.steps.replaceChildren(...STEPS.map((s, i) => {
      const li = el('li', `st-p-step${i < at ? ' is-done' : i === at ? ' is-now' : ''}`);
      li.append(el('span', 'st-p-dot', ''), el('span', 'st-p-words', STEP_WORDS[s.step]));
      if (i === at && Number.isFinite(c.progress) && c.progress > 0) li.append(document.createTextNode(' '), el('span', 'st-p-pct mono', `${Math.round(c.progress)}%`));
      if (i === at) li.setAttribute('aria-current', 'step');
      return li;
    }));
    ui.makingNote.textContent = MAKING_NOTE;
  }

  // ---------- done: in 3D, its moves, its chat ----------
  let started = false;
  async function startViewer() {
    if (started) return;
    started = true;
    const moves = Array.isArray(c.moves) && c.moves.length ? c.moves : MOVE_NAMES;
    ui.pic.src = fileUrl(id, 'webp');
    ui.pic.alt = `${c.name}, as made in AGI-1's studio`;
    ui.dlPng.href = fileUrl(id, 'png');
    ui.dlPng.download = `${c.name.replace(/[^\p{L}\p{N}_-]+/gu, '-') || 'character'}.png`;
    ui.dlGlb.href = fileUrl(id, 'glb');
    ui.dlGlb.download = `${c.name.replace(/[^\p{L}\p{N}_-]+/gu, '-') || 'character'}.glb`;
    ui.share.href = shareUrl(c.name, `${location.origin}/studio/${id}`);
    const bot = botName(import.meta.env.VITE_TELEGRAM_BOT);
    ui.coin.hidden = !bot;
    if (bot) ui.bot.href = `https://t.me/${bot}`;
    // the move buttons and the chat
    ui.movebar.replaceChildren(...moves.filter((m) => m !== 'idle').map((m) => {
      const b = el('button', 'btn btn-ghost btn-sm st-move', m);
      b.type = 'button';
      b.dataset.move = m;
      b.addEventListener('click', () => doMove(m, null));
      return b;
    }));
    ui.hint.textContent = `Type to ${c.name}: ${moves.filter((m) => m !== 'idle').join(', ')}… or anything, and it reacts. Nothing you type leaves this page.`;
    ui.stage.dataset.state = 'loading';
    say(ui.stageNote, 'Loading it in 3D…');
    try {
      const { createViewer } = await import('./viewer.js');
      viewer = await createViewer(ui.canvas, { url: fileUrl(id, 'glb'), moves, onMove: showMove });
      ui.stage.dataset.state = 'ready';
      say(ui.stageNote, '');
    } catch {
      ui.stage.dataset.state = 'picture';
      say(ui.stageNote, "It can't be shown in 3D in this browser: here's its picture.");
    }
  }
  // what it's doing now: its button lit (none while it stands), for its stage too
  function showMove(move) {
    ui.stage.dataset.move = move;
    for (const b of $$('.st-move', ui.movebar)) b.classList.toggle('is-on', b.dataset.move === move);
  }
  function doMove(move, text) {
    const played = viewer ? viewer.play(move) : false;
    if (text !== null) {
      const li = el('li', 'st-log-item');
      li.append(el('span', 'st-log-you', text), el('span', 'st-log-move mono', played ? `▶ ${move}` : ui.stage.dataset.state === 'picture' ? '(its 3D view is off)' : ''));
      ui.log.append(li);
      while (ui.log.children.length > 6) ui.log.firstElementChild.remove();
    }
  }
  ui.chat?.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = ui.say.value.trim().slice(0, 200);
    if (!text) return;
    const moves = viewer?.moves || (Array.isArray(c?.moves) ? c.moves : MOVE_NAMES);
    const move = moveIn(text, moves) || (() => {
      const pick = REACTIONS.filter((m) => moves.includes(m));
      return pick.length ? pick[Math.floor(Math.random() * pick.length)] : 'idle';
    })();
    doMove(move, text);
    ui.say.value = '';
  });

  // ---------- couldn't be made: again with new words, free (only the wallet that paid) ----------
  function renderRedo() {
    if (!c || c.status !== 'failed') return;
    wallet.render();
    ui.rForm.hidden = !wallet.me;
    say(ui.rWhy, `${failText(c.error)} It was paid for, so it can be made again with new words, free.`);
    if (!ui.rName.value) ui.rName.value = c.name || '';
    if (!ui.rAbout.value) ui.rAbout.value = c.about || '';
    const styles = $$('input[name="st-r-style"]');
    if (!styles.some((x) => x.checked)) for (const i of styles) i.checked = i.value === c.style;
  }
  ui.rForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const me = wallet.me;
    if (!me || busy) return;
    const name = ui.rName.value.trim(), about = ui.rAbout.value.trim(), style = $('input[name="st-r-style"]:checked')?.value;
    ui.rSend.disabled = true;
    say(ui.rError, '');
    let r;
    try { r = await api({ action: 'studio-redo', session: me.session, id, name, about, style }); } catch { r = { ok: false, data: { error: 'offline' } }; }
    ui.rSend.disabled = false;
    const d = r.data || {};
    wallet.follow(d, me);
    if (r.ok && d.ok) { load(); return; }
    say(ui.rError, d.error === 'words' ? wordsText(d.field, d.why) : d.error === 'not_yours' ? 'Only the wallet that paid for it can try it again.' : errorText(d.error));
  });

  // ---------- its videos (2026-10-10): its done ones for everyone; the wallet that made it makes new ones ----------
  // (an AI video service makes them from its picture, server/studio-video.js; paid in USDG from that wallet's own app, never
  // asked of the wallet here; played from our own address, in parts as the player asks for them)
  let videosStarted = false, info = null, publicVideos = [], mine = null, vWallet = null, payingId = null, redoId = null;
  let vSending = false, vTimer = null, vCopyReset = null;
  async function startVideos() {
    if (videosStarted) return;
    videosStarted = true;
    const [i, l] = await Promise.all([getJson('studio-info'), getJson(`studio-videos=${encodeURIComponent(id)}`)]);
    info = i.ok ? i.data : null;
    publicVideos = l.ok && Array.isArray(l.data.videos) ? l.data.videos : [];
    if (info?.video?.on) {
      vWallet = walletBox({
        note: ui.vNote, me: ui.vMe, connect: ui.vConnect, out: ui.vOut, list: ui.vWallets, apps: ui.vApps, appsNote: ui.vAppsNote,
      }, () => { mine = null; payingId = null; renderVideos(); loadMyVideos(); });
    }
    renderVideos();
    // a shared link to one of its videos (…/studio/<id>#v-<its id>, its Share on X): its place on the page exists only now
    const want = /^#v-([A-Za-z0-9_-]{22})$/.exec(location.hash);
    if (want) document.getElementById(`v-${want[1]}`)?.scrollIntoView({ block: 'center' });
    loadMyVideos();
  }
  // the signed-in wallet's view: whether it made this character, its price, and its own videos (being made, waiting, failed)
  async function loadMyVideos() {
    const me = vWallet?.me;
    if (!me || !info?.video?.on) { mine = null; renderVideos(); return; }
    let r;
    try { r = await api({ action: 'studio-video-mine', session: me.session, char: id }); } catch { r = { ok: false, data: { error: 'offline' } }; }
    vWallet.follow(r.data, me);
    mine = r.ok ? r.data : null;
    if (!r.ok) say(ui.vOwner, videoErrorText(r.data?.error));
    if (mine && !payingId) payingId = (mine.videos || []).find((v) => v.status === 'quote')?.id || null;
    renderVideos();
    keepLooking();
  }
  const myList = () => (mine?.owner && Array.isArray(mine.videos) ? mine.videos : publicVideos);
  function renderVideos() {
    const on = Boolean(info?.video?.on);
    const list = myList();
    ui.videos.hidden = !(on || list.length);
    ui.vList.replaceChildren(...list.map(videoItem));
    ui.vNone.hidden = list.length > 0;
    ui.vMake.hidden = !on;
    if (!on) return;
    const adult = store.get(KEYS.adult) === true;
    const me = vWallet?.me;
    const level = me?.level || 1;
    const price = mine?.price?.usdCents ?? Math.round(info.video.usdCents * (1 - (info.discounts?.[level] || 0)));
    ui.vAbout.textContent = `${VIDEO_SECONDS} seconds of ${c.name} in any scene you describe: ${videoPriceText(price, me ? level : 1)}. `
      + `${me ? '' : 'Crush (10,000+ $AGI) gets 20% off, Soulmate (1,000,000+) 40% off. '}Only the wallet that made ${c.name} can make its videos.`;
    ui.vAdult.hidden = adult;
    ui.vWalletBox.hidden = !adult;
    vWallet?.render();
    if (me) say(ui.vMe, `${shortAddress(me.wallet)} · ${LEVEL_NAMES[me.level] || LEVEL_NAMES[1]}`);
    // whether this wallet may make one now: it made the character, the studio lets it (private until it opens), places left
    let note = '';
    if (adult && me && mine) {
      if (!mine.owner) note = `Only the wallet that made ${c.name} can make its videos.`;
      else if (!mine.allowed) note = videoErrorText('closed');
      else if (!(mine.left > 0) && !redoId) note = videoErrorText('sold_out');
    }
    if (note || !mine || !me) { if (note || !ui.vOwner.textContent) say(ui.vOwner, note); } else say(ui.vOwner, '');
    const ready = adult && Boolean(me) && Boolean(mine?.owner) && mine.allowed !== false;
    ui.vForm.hidden = !(ready && (mine.left > 0 || redoId) && !payingId);
    ui.vQuote.textContent = redoId ? 'Make it again, free' : 'Get my price';
    ui.vRedoCancel.hidden = !redoId;
    const paying = ready && payingId ? list.find((v) => v.id === payingId && v.status === 'quote') : null;
    ui.vPay.hidden = !paying;
    if (paying) renderVideoPay(paying);
  }
  function videoItem(v) {
    const li = el('li', `st-v-item${v.status === 'done' ? '' : ' is-pending'}`);
    li.id = `v-${v.id}`;
    li.dataset.shape = SHAPES[v.shape] ? v.shape : 'tall';
    const body = el('div', 'st-v-body');
    if (v.status === 'done') {
      const frame = el('div', 'st-v-frame');
      frame.dataset.shape = v.shape;
      const video = el('video', 'st-v-video');
      video.controls = true;
      video.playsInline = true;
      video.preload = 'none';
      video.poster = fileUrl(id, 'webp');
      video.src = videoUrl(v.id);
      video.setAttribute('aria-label', `A video of ${c.name}: ${v.scene}`);
      frame.append(video);
      li.append(frame);
      body.append(el('p', 'st-v-scene', v.scene), el('p', 'st-v-meta mono', videoMeta(v)));
      const links = el('div', 'st-links');
      const dl = el('a', 'btn btn-ghost btn-sm', 'Download');
      dl.href = videoDownload(v.id);
      const share = el('a', 'btn btn-ghost btn-sm', 'Share on X ↗');
      share.href = videoShareUrl(c.name, `${location.origin}/studio/${id}#v-${v.id}`);
      share.target = '_blank';
      share.rel = 'noopener noreferrer';
      links.append(dl, share);
      body.append(links);
    } else {
      body.append(el('p', 'st-v-scene', v.scene), el('p', 'st-v-meta mono', videoMeta(v)));
      const state = el('p', `st-v-state${v.status === 'paid' || v.status === 'making' ? ' is-now' : ''}`, videoStateText(v));
      body.append(state);
      const links = el('div', 'st-links');
      if (v.status === 'quote' && v.id !== payingId) {
        const b = el('button', 'btn btn-ghost btn-sm', 'Pay for it');
        b.type = 'button';
        b.addEventListener('click', () => { payingId = v.id; redoId = null; renderVideos(); ui.vPay.focus(); });
        links.append(b);
      }
      if (v.status === 'failed' && v.credit) {
        const b = el('button', 'btn btn-ghost btn-sm', 'Make it again, free');
        b.type = 'button';
        b.addEventListener('click', () => startRedo(v));
        links.append(b);
      }
      if (links.children.length) body.append(links);
    }
    li.append(body);
    return li;
  }

  // ---------- making one: the scene, its price ----------
  ui.vAdultYes?.addEventListener('click', () => { store.set(KEYS.adult, true); renderVideos(); ui.vConnect?.focus(); });
  ui.vScene?.addEventListener('input', () => { ui.vCount.textContent = String([...ui.vScene.value].length); say(ui.vError, ''); });
  function startRedo(v) {
    redoId = v.id;
    payingId = null;
    ui.vScene.value = v.scene || '';
    ui.vCount.textContent = String([...ui.vScene.value].length);
    for (const i of $$('input[name="st-v-shape"]')) i.checked = i.value === v.shape;
    ui.vSound.checked = v.sound !== false;
    renderVideos();
    ui.vScene.focus();
  }
  ui.vRedoCancel?.addEventListener('click', () => { redoId = null; ui.vForm.reset(); ui.vCount.textContent = '0'; renderVideos(); });
  ui.vForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const me = vWallet?.me;
    if (!me || vSending) return;
    const scene = ui.vScene.value.trim(), shape = $('input[name="st-v-shape"]:checked')?.value, sound = ui.vSound.checked;
    if ([...scene].length < 10) { say(ui.vError, wordsText('scene', scene ? 'short' : 'empty')); ui.vScene.focus(); return; }
    vSending = true;
    ui.vQuote.disabled = true;
    const label = ui.vQuote.textContent;
    ui.vQuote.textContent = 'Checking…';
    say(ui.vError, '');
    let r;
    try {
      r = redoId
        ? await api({ action: 'studio-video-redo', session: me.session, id: redoId, scene, shape, sound })
        : await withHuman(ui.vHuman, 'studio', (extra) => api({ action: 'studio-video-quote', session: me.session, char: id, scene, shape, sound, adult: true, ...extra }));
    } catch (err) {
      r = { ok: false, data: { error: err.message === 'offline' ? 'offline' : err.message === 'not_configured' ? 'not_configured' : 'human_check' } };
    }
    vSending = false;
    ui.vQuote.disabled = false;
    ui.vQuote.textContent = label;
    const d = r.data || {};
    vWallet.follow(d, me);
    if (r.ok && d.ok) {
      if (!redoId && ORDER_ID.test(String(d.id))) payingId = d.id;
      redoId = null;
      ui.vForm.reset();
      ui.vCount.textContent = '0';
      await loadMyVideos();
      (payingId ? ui.vPay : ui.vList).focus?.();
      return;
    }
    if (d.error === 'words') { say(ui.vError, wordsText(d.field, d.why)); ui.vScene.focus(); return; }
    say(ui.vError, videoErrorText(d.error));
  });

  // ---------- paying for one: USDG, from their own wallet app (this page only shows where to, and reads the chain after) ----------
  function renderVideoPay(v) {
    const me = vWallet?.me;
    const rest = Math.max(0, (v.price?.usdCents ?? 0) - (v.paid || 0));
    ui.vPayTitle.textContent = `Send ${usd(rest)} in USDG`;
    ui.vPayFrom.textContent = me ? `For the video “${v.scene}”, from your connected wallet (${shortAddress(me.wallet)}), in your own wallet app, on Robinhood Chain:` : '';
    ui.vPayTo.textContent = info?.payTo || '';
    ui.vPayToken.textContent = `Only USDG counts (Paxos' Global Dollar on Robinhood Chain, its contract ${shortAddress(info?.token)}). Its network fee is a little ETH. No refunds; if the video can't be made, it's made again with a new scene, free.`;
  }
  ui.vCopy?.addEventListener('click', async () => {
    let copied = true;
    try { await navigator.clipboard.writeText(ui.vPayTo.textContent); } catch {
      copied = false;
      const range = document.createRange();
      range.selectNodeContents(ui.vPayTo);
      getSelection().removeAllRanges();
      getSelection().addRange(range);
    }
    ui.vCopy.textContent = copied ? 'Copied' : 'Selected';
    ui.vCopySay.textContent = `The studio's wallet address ${copied ? 'copied' : 'selected: copy it with your keyboard or a long-press'}`;
    clearTimeout(vCopyReset);
    vCopyReset = setTimeout(() => { ui.vCopy.textContent = 'Copy'; ui.vCopySay.textContent = ''; }, 1800);
  });
  ui.vCheck?.addEventListener('click', async () => {
    const me = vWallet?.me;
    if (!me || !payingId || vSending) return;
    const pasted = ui.vTx.value.trim();
    vSending = true;
    ui.vCheck.disabled = true;
    ui.vCheck.textContent = 'Checking Robinhood Chain…';
    say(ui.vCheckMsg, '');
    let r;
    try { r = await api({ action: 'studio-video-check', session: me.session, id: payingId, ...(pasted ? { tx: pasted } : {}) }); } catch { r = { ok: false, data: { error: 'offline' } }; }
    vSending = false;
    ui.vCheck.disabled = false;
    ui.vCheck.textContent = 'Check my payment';
    const d = r.data || {};
    vWallet.follow(d, me);
    if (r.ok && d.ok) {
      say(ui.vCheckMsg, videoCheckText(d));
      if (d.paid) {
        ui.vTx.value = '';
        payingId = null;
        setTimeout(() => { say(ui.vCheckMsg, ''); loadMyVideos(); }, 900);
      } else loadMyVideos();
      return;
    }
    if (d.error === 'gone') { payingId = null; say(ui.vError, videoErrorText('gone')); loadMyVideos(); return; }
    say(ui.vCheckMsg, videoErrorText(d.error));
  });
  ui.vLater?.addEventListener('click', () => { payingId = null; say(ui.vCheckMsg, ''); renderVideos(); });

  // ---------- while its own are being made: one look every few seconds (each moves it along) ----------
  function keepLooking() {
    clearTimeout(vTimer);
    const making = (mine?.videos || []).filter((v) => v.status === 'paid' || v.status === 'making');
    if (!making.length || !visible()) return;
    vTimer = setTimeout(async () => {
      const me = vWallet?.me;
      if (!me) return;
      let finished = false;
      for (const v of making) {
        let r;
        try { r = await api({ action: 'studio-video-look', session: me.session, id: v.id }); } catch { continue; }
        vWallet.follow(r.data, me);
        if (!r.ok || !r.data?.video) continue;
        const at = mine.videos.findIndex((x) => x.id === v.id);
        if (at >= 0) mine.videos[at] = r.data.video;
        if (r.data.video.status === 'done' || r.data.video.status === 'failed') finished = true;
      }
      if (finished) {
        const l = await getJson(`studio-videos=${encodeURIComponent(id)}`);
        if (l.ok && Array.isArray(l.data.videos)) publicVideos = l.data.videos;
      }
      renderVideos();
      keepLooking();
    }, POLL_EVERY);
  }
  document.addEventListener('visibilitychange', () => { if (visible() && mine) keepLooking(); });

  load();
}

function start() {
  startTheme();
  startMenu();
  const root = $('[data-st]');
  if (!root) return;
  const ui = {
    root, make: $('[data-st-make]'), char: $('[data-st-char]'),
    status: $('[data-st-status]'), adultStep: $('[data-st-step="adult"]'), adult: $('[data-st-adult]'),
    walletStep: $('[data-st-step="wallet"]'), walletNote: $('[data-st-wallet-note]'), me: $('[data-st-me]'), connect: $('[data-st-connect]'),
    out: $('[data-st-out]'), wallets: $('[data-st-wallets]'), apps: $('[data-st-apps]'), appsNote: $('[data-st-apps-note]'),
    privateNote: $('[data-st-private]'),
    describeStep: $('[data-st-step="describe"]'), form: $('[data-st-form]'), name: $('[data-st-name]'), about: $('[data-st-about]'),
    count: $('[data-st-count]'), human: $('[data-st-human]'), error: $('[data-st-error]'), quote: $('[data-st-quote]'),
    payStep: $('[data-st-step="pay"]'), payName: $('[data-st-pay-name]'), payPrice: $('[data-st-pay-price]'), payNone: $('[data-st-pay-none]'),
    how: $('[data-st-how]'), howTitle: $('[data-st-how-title]'), howFrom: $('[data-st-how-from]'), howToLabel: $('[data-st-how-to-label]'),
    howTo: $('[data-st-how-to]'), howToken: $('[data-st-how-token]'), copy: $('[data-st-copy]'), copySay: $('[data-st-copy-say]'),
    tx: $('[data-st-tx]'), check: $('[data-st-check]'), checkMsg: $('[data-st-check-msg]'), cancel: $('[data-st-cancel]'),
    mineBox: $('[data-st-mine]'), mineList: $('[data-st-mine-list]'), galleryBox: $('[data-st-gallery]'), gallery: $('[data-st-gallery-list]'),
    // a character's page
    cName: $('[data-st-c-name]'), cMeta: $('[data-st-c-meta]'), cAbout: $('[data-st-c-about]'), cStatus: $('[data-st-c-status]'),
    cContinue: $('[data-st-c-continue]'), progress: $('[data-st-progress]'), steps: $('[data-st-p-steps]'), makingNote: $('[data-st-making-note]'),
    done: $('[data-st-done]'), stage: $('[data-st-stage]'), canvas: $('[data-st-canvas]'), pic: $('[data-st-pic]'), stageNote: $('[data-st-stage-note]'),
    movebar: $('[data-st-movebar]'), chat: $('[data-st-chat]'), say: $('[data-st-say]'), log: $('[data-st-log]'), hint: $('[data-st-hint]'),
    dlPng: $('[data-st-dl-png]'), dlGlb: $('[data-st-dl-glb]'), share: $('[data-st-share]'), coin: $('[data-st-coin]'), bot: $('[data-st-bot]'),
    redo: $('[data-st-redo]'), rWhy: $('[data-st-r-why]'), rNote: $('[data-st-r-note]'), rMe: $('[data-st-r-me]'), rConnect: $('[data-st-r-connect]'),
    rOut: $('[data-st-r-out]'), rWallets: $('[data-st-r-wallets]'), rApps: $('[data-st-r-apps]'), rAppsNote: $('[data-st-r-apps-note]'),
    rForm: $('[data-st-r-form]'), rName: $('[data-st-r-name]'), rAbout: $('[data-st-r-about]'), rSend: $('[data-st-r-send]'), rError: $('[data-st-r-error]'),
    // its videos
    videos: $('[data-st-videos]'), vList: $('[data-st-v-list]'), vNone: $('[data-st-v-none]'), vMake: $('[data-st-v-make]'), vAbout: $('[data-st-v-about]'),
    vAdult: $('[data-st-v-adult]'), vAdultYes: $('[data-st-v-adult-yes]'), vWalletBox: $('[data-st-v-wallet]'), vMe: $('[data-st-v-me]'),
    vNote: $('[data-st-v-note]'), vConnect: $('[data-st-v-connect]'), vOut: $('[data-st-v-out]'), vWallets: $('[data-st-v-wallets]'),
    vApps: $('[data-st-v-apps]'), vAppsNote: $('[data-st-v-apps-note]'), vOwner: $('[data-st-v-owner]'), vForm: $('[data-st-v-form]'),
    vScene: $('[data-st-v-scene]'), vCount: $('[data-st-v-count]'), vSound: $('[data-st-v-sound]'), vHuman: $('[data-st-v-human]'),
    vError: $('[data-st-v-error]'), vQuote: $('[data-st-v-quote]'), vRedoCancel: $('[data-st-v-redo-cancel]'), vPay: $('[data-st-v-pay]'),
    vPayTitle: $('[data-st-v-pay-title]'), vPayFrom: $('[data-st-v-pay-from]'), vPayTo: $('[data-st-v-pay-to]'), vCopy: $('[data-st-v-copy]'),
    vCopySay: $('[data-st-v-copy-say]'), vPayToken: $('[data-st-v-pay-token]'), vTx: $('[data-st-v-tx]'), vCheck: $('[data-st-v-check]'),
    vLater: $('[data-st-v-later]'), vCheckMsg: $('[data-st-v-check-msg]'),
  };
  if (ui.name) ui.name.maxLength = NAME_MAX;
  if (ui.about) ui.about.maxLength = ABOUT_MAX;
  if (ui.vScene) ui.vScene.maxLength = SCENE_MAX;
  const m = /^\/studio\/([A-Za-z0-9_-]{22})\/?$/.exec(location.pathname);
  if (m) charPage(ui, m[1]);
  else makePage(ui);
}

start();
