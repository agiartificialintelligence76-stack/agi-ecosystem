// Her live show's page (agi1.app/live, live.html, 2026-10-02): whether she's live on X (/api/live, every 15 s while the page
// is visible), the box to send her a question (18+, the site's human check), where your question is and her answer, and,
// with the owner's link (#admin=…), the host's controls. All text is set with textContent.
import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/layout.css';
import '../styles/sections.css';
import '../styles/footer.css';
import '../styles/live.css';
import '../styles/pop.css';      // Pop mode: the bold look, only while it's switched on
import { startTheme } from '../theme.js';
import { startMenu } from '../menu.js';
import { withHuman, postJson } from '../lib/human.js';
import { botName } from '../chat/telegram-link.js';
import { STATUS, segmentText, lineText, askError, mineText, ownerText, fromText, relayText } from './words.js';

const KEYS = { adult: 'agi1_18plus', mine: 'agi1_live_q', owner: 'agi1_live_owner' };
const STATUS_EVERY = 15_000, MINE_EVERY = 30_000, OWNER_EVERY = 5_000, MINE_HOURS = 6;
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode: this visit only */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};
const session = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* this visit only */ } },
  del(k) { try { sessionStorage.removeItem(k); } catch { /* ignore */ } },
};
const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const visible = () => document.visibilityState === 'visible';

function start() {
  startTheme();
  startMenu();
  const now = $('[data-lv-now]');
  const ask = $('[data-lv-ask]');
  if (!now || !ask) return;
  const ui = {
    badge: $('[data-lv-badge-text]'), headline: $('[data-lv-headline]'), sub: $('[data-lv-sub]'), watch: $('[data-lv-watch]'),
    gate: $('[data-lv-gate]'), adult: $('[data-lv-adult]'), form: $('[data-lv-form]'), q: $('[data-lv-q]'), name: $('[data-lv-name]'),
    count: $('[data-lv-count]'), human: $('[data-lv-human]'), error: $('[data-lv-error]'), send: $('[data-lv-send]'), waitNote: $('[data-lv-wait-note]'),
    mine: $('[data-lv-mine]'), mineQ: $('[data-lv-mine-q]'), mineStatus: $('[data-lv-mine-status]'), reply: $('[data-lv-reply]'),
    mineWatch: $('[data-lv-mine-watch]'), again: $('[data-lv-again]'),
  };
  // her Telegram bot, when its public name is set (VITE_TELEGRAM_BOT)
  const bot = botName(import.meta.env.VITE_TELEGRAM_BOT);
  if (bot) {
    const li = $('[data-lv-tg]');
    const a = $('[data-lv-tg-link]');
    if (li && a) { a.href = `https://t.me/${bot}`; li.hidden = false; }
  }

  let status = null;        // the newest /api/live
  let mine = store.get(KEYS.mine);     // { ticket, id, q, name, at, status, position, onAir, why, reply }
  if (!mine || typeof mine.ticket !== 'string' || !(Date.now() - mine.at < MINE_HOURS * 3_600_000)) { store.del(KEYS.mine); mine = null; }
  let sending = false;

  // ---------- is she on? ----------
  let statusTimer = null;
  async function pollStatus() {
    clearTimeout(statusTimer);
    try {
      const res = await fetch('/api/live');
      const data = await res.json().catch(() => ({}));
      if (res.ok) { status = data; render(); }
      else if (!status) showLoadError();
    } catch {
      if (!status) showLoadError();
    }
    if (visible()) statusTimer = setTimeout(pollStatus, STATUS_EVERY);
  }
  function showLoadError() {
    now.dataset.state = 'off';
    ui.badge.textContent = 'Offline?';
    ui.headline.textContent = "Couldn't check whether she's live. Trying again…";
  }
  document.addEventListener('visibilitychange', () => { if (visible()) { pollStatus(); if (mine && !finished(mine)) pollMine(); } });

  function render() {
    const s = status;
    if (!s || s.ready !== true) {
      now.dataset.state = 'soon';
      ui.badge.textContent = STATUS.soon.badge;
      ui.headline.textContent = `${STATUS.soon.headline}.`;
      ui.sub.textContent = 'Follow @agi1dotapp on X to hear when it starts.';
      ui.sub.hidden = false;
      ui.watch.textContent = 'Follow on X ↗';
      ask.hidden = true;
      return;
    }
    const kind = s.on ? (STATUS[s.status] ? s.status : 'live') : 'off';
    now.dataset.state = kind;
    ui.badge.textContent = STATUS[kind].badge;
    ui.headline.textContent = `${STATUS[kind].headline}.`;
    const bits = [];
    if (s.on) {
      const doing = segmentText(s.paused ? 'brb' : s.segment);
      if (doing && kind === 'live') bits.push(`Now: ${doing}.`);
      bits.push(lineText(Array.isArray(s.waiting) ? s.waiting.length : 0));
    } else {
      // (never when her next show is: the owner goes live at random times, 2026-10-07)
      bits.push('Follow @agi1dotapp on X to catch her next show.');
    }
    ui.sub.textContent = bits.join(' ');
    ui.sub.hidden = false;
    ui.watch.textContent = s.on ? 'Watch on X ↗' : 'Follow on X ↗';
    ask.hidden = false;
    renderAsk();
    followMine();
  }

  // ---------- asking ----------
  const adult = () => store.get(KEYS.adult) === true;
  function renderAsk() {
    const s = status;
    ui.gate.hidden = adult();
    const open = Boolean(s?.on && !s.closed && s.status !== 'ending');
    const showForm = adult() && !mine;          // (your question first, until "Ask another question")
    ui.form.hidden = !showForm;
    ui.send.disabled = sending || !open;
    ui.waitNote.hidden = open;
    ui.waitNote.textContent = !s?.on ? "You can send questions while she's live."
      : s.closed ? askError('closed') : s.status === 'ending' ? askError('ending') : '';
    renderMine();
  }
  ui.adult?.addEventListener('click', () => {
    store.set(KEYS.adult, true);
    renderAsk();
    ui.q?.focus();
  });
  addEventListener('storage', (e) => { if (e.key === KEYS.adult) renderAsk(); });
  ui.q?.addEventListener('input', () => { ui.count.textContent = String([...ui.q.value].length); ui.error.textContent = ''; });
  ui.form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (sending) return;
    const question = ui.q.value.trim();
    // (2026-10-09, the owner: "no restrictions on how short their message are": any question, a single letter included)
    if (!question) { ui.error.textContent = askError('question', { why: 'empty' }); ui.q.focus(); return; }
    sending = true;
    ui.send.disabled = true;
    ui.send.textContent = 'Sending…';
    ui.error.textContent = '';
    const name = ui.name.value.trim();
    let r;
    try {
      r = await withHuman(ui.human, 'live', (extra) => postJson('/api/live', { action: 'ask', question, ...(name ? { name } : {}), adult: true, ...extra }));
    } catch (err) {
      r = { ok: false, data: { error: err.message === 'offline' ? 'offline_net' : err.message === 'not_configured' ? 'not_configured' : 'human_check' } };
    }
    sending = false;
    ui.send.textContent = 'Send to her show';
    const d = r.data || {};
    if (r.ok && d.ok && typeof d.ticket === 'string') {
      mine = { ticket: d.ticket, id: d.id, q: question, name: name || null, at: Date.now(), status: 'waiting', position: d.position };
      store.set(KEYS.mine, mine);
      ui.q.value = '';
      ui.count.textContent = '0';
      renderAsk();
      ui.mine.focus();
      return;
    }
    // (a question from this connection still in line, "waiting": maybe someone else's on the same network, so only its place)
    ui.error.textContent = askError(d.error, { why: d.why, wait: d.wait, position: d.position });
    renderAsk();
    if (d.error === 'name') ui.name.focus(); else ui.q.focus();
  });
  ui.again?.addEventListener('click', () => {
    store.del(KEYS.mine);
    mine = null;
    renderAsk();
    ui.q?.focus();
  });

  // ---------- your question ----------
  const finished = (m) => m && (m.status === 'answered' || m.status === 'skipped' || m.status === 'gone');
  function renderMine() {
    ui.mine.hidden = !mine;
    if (!mine) return;
    ui.mineQ.textContent = mine.q ? `“${mine.q}”${mine.name ? ` · as ${mine.name}` : ''}` : 'Your question from earlier';
    ui.mineStatus.textContent = mine.status === 'gone' ? 'This question isn’t there any more.' : mineText(mine);
    ui.reply.hidden = !(mine.status === 'answered' && mine.reply);
    ui.reply.textContent = mine.reply ? `“${mine.reply}”` : '';
    ui.mineWatch.hidden = !(mine.status === 'taken' || mine.status === 'waiting');
    ui.again.hidden = !finished(mine);
  }
  // the shared status already says a lot (its place in line, on air, done) without asking about this question itself
  function followMine() {
    if (!mine || finished(mine) || !status?.ready) return;
    const id = mine.id;
    const done = status.done?.[String(id)];
    const place = Array.isArray(status.waiting) ? status.waiting.indexOf(id) : -1;
    if (done || (status.now === id) !== Boolean(mine.onAir) || (mine.status === 'waiting' && place < 0)) { pollMine(); return; }
    if (place >= 0 && place + 1 !== mine.position) { mine.position = place + 1; store.set(KEYS.mine, mine); renderMine(); }
    if (!status.on && mine.status !== 'answered') pollMine();
  }
  let mineTimer = null, mineBusy = false;
  async function pollMine() {
    clearTimeout(mineTimer);
    if (!mine || mineBusy) return;
    mineBusy = true;
    try {
      const res = await fetch(`/api/live?q=${encodeURIComponent(mine.ticket)}`);
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.status) {
        Object.assign(mine, { status: d.status, position: d.position, onAir: d.onAir === true, why: d.why, reply: d.reply });
        store.set(KEYS.mine, mine);
      } else if (res.status === 404 || res.status === 400) {
        mine.status = 'gone';
        store.set(KEYS.mine, mine);
      }
    } catch { /* tried again later */ }
    mineBusy = false;
    renderAsk();
    if (mine && !finished(mine) && visible()) mineTimer = setTimeout(pollMine, MINE_EVERY);
  }

  // ---------- the owner's controls ----------
  startOwner();

  render();
  pollStatus();
  if (mine && !finished(mine)) pollMine();
}

// The owner's link: agi1.app/live#admin=<key> (node tools/live/run.mjs --owner-link). The key is kept for this tab only and
// taken out of the address at once (so it isn't left on screen or in a screenshot).
function startOwner() {
  const box = $('[data-lv-owner]');
  if (!box) return;
  const m = /^#admin=([A-Za-z0-9_-]{20,64})$/.exec(location.hash);
  if (m) {
    session.set(KEYS.owner, m[1]);
    history.replaceState(null, '', `${location.pathname}${location.search}`);
  }
  const key = session.get(KEYS.owner);
  if (!key) return;
  box.hidden = false;
  const o = {
    state: $('[data-lv-o-state]', box), error: $('[data-lv-o-error]', box), now: $('[data-lv-o-now]', box), nowQ: $('[data-lv-o-now-q]', box),
    nowA: $('[data-lv-o-now-a]', box), count: $('[data-lv-o-count]', box), line: $('[data-lv-o-line]', box), empty: $('[data-lv-o-empty]', box),
    words: $('[data-lv-o-words]', box), block: $('[data-lv-o-block]', box), word: $('[data-lv-o-word]', box), recent: $('[data-lv-o-recent]', box),
    buttons: [...box.querySelectorAll('[data-lv-o]')],
    // (2026-10-07) the box for a question from X's live chat
    relay: $('[data-lv-o-relay]', box), relayQ: $('[data-lv-o-relay-q]', box), relayName: $('[data-lv-o-relay-name]', box),
    relaySend: $('[data-lv-o-relay-send]', box), relayMsg: $('[data-lv-o-relay-msg]', box),
  };
  let timer = null, view = null, busy = false, armed = null, relaying = false, dead = false;
  const queued = [];
  const call = async (body) => {
    let res;
    try {
      res = await fetch('/api/live', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify({ action: 'control', ...body }) });
    } catch {
      return { error: 'offline_net' };
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) return { error: 'unauthorized' };
    return res.ok ? data : { error: data.error || 'busy' };
  };
  // one request at a time; a tap while one is on its way goes right after it (never dropped), a poll then just waits
  const run = async (body) => {
    if (busy) { if (body.do !== 'view') queued.push(body); return; }
    busy = true;
    const v = await call(body);
    busy = false;
    if (v.error === 'unauthorized') {
      queued.length = 0;
      session.del(KEYS.owner);
      clearTimeout(timer);
      dead = true;
      o.state.textContent = "This host link doesn't work any more (LIVE_SECRET changed?). Get the new one from the server.";
      for (const b of o.buttons) b.disabled = true;
      if (o.relaySend) o.relaySend.disabled = true;
      return;
    }
    if (v.error) o.error.textContent = v.error === 'offline_net' ? "You're offline." : "Couldn't reach her show just now. Trying again…";
    else {
      o.error.textContent = body.do !== 'view' && v.ok === false ? 'Nothing to do there.' : '';
      view = v;
      draw();
    }
    if (queued.length) run(queued.shift());
  };
  const poll = async () => {
    clearTimeout(timer);
    if (visible()) await run({ do: 'view' });
    timer = setTimeout(poll, OWNER_EVERY);
  };
  function draw() {
    const v = view;
    o.state.textContent = ownerText(v);
    const show = (name, yes) => { const b = box.querySelector(`[data-lv-o="${name}"]`); if (b) b.hidden = !yes; };
    show('pause', !v.paused); show('resume', v.paused); show('close', !v.closed); show('open', v.closed);
    for (const b of o.buttons) b.disabled = !v.on && !['open', 'close', 'clear'].includes(b.dataset.lvO);
    box.querySelector('[data-lv-o="skip"]').disabled = !v.now;
    if (o.relaySend) o.relaySend.disabled = relaying || !v.on;
    o.now.hidden = !v.now;
    if (v.now) {
      o.nowQ.textContent = `${fromText(v.now)}: “${v.now.question}”`;
      o.nowA.textContent = v.now.reply ? `She says: “${v.now.reply}”` : '';
    }
    const line = Array.isArray(v.line) ? v.line : [];
    o.count.textContent = String(line.length);
    o.empty.hidden = line.length > 0;
    o.line.replaceChildren(...line.map((q) => {
      const li = el('li', 'lv-item');
      li.append(el('span', 'lv-item-from mono', `${q.status === 'taken' ? 'up next · ' : ''}${fromText(q)}`), el('span', 'lv-item-q', q.question));
      const drop = el('button', 'btn btn-ghost btn-sm', 'Drop');
      drop.type = 'button';
      drop.setAttribute('aria-label', `Drop the question from ${q.name || 'someone'}`);
      drop.addEventListener('click', () => run({ do: 'drop', arg: String(q.id) }));
      li.append(drop);
      return li;
    }));
    o.words.replaceChildren(...(Array.isArray(v.blocked) ? v.blocked : []).map((w) => {
      const li = el('li', 'lv-word');
      li.append(el('span', '', w));
      const x = el('button', 'lv-word-x', '×');
      x.type = 'button';
      x.setAttribute('aria-label', `Unblock “${w}”`);
      x.addEventListener('click', () => run({ do: 'unblock', arg: w }));
      li.append(x);
      return li;
    }));
    o.recent.replaceChildren(...(Array.isArray(v.recent) ? v.recent : []).map((q) => {
      const li = el('li', 'lv-item');
      li.append(el('span', 'lv-item-from mono', `${q.status === 'answered' ? 'answered' : `skipped${q.why ? ` (${q.why})` : ''}`} · ${fromText(q)}`), el('span', 'lv-item-q', q.question));
      return li;
    }));
  }
  // "End the show" and "Clear the line": two taps (the first one asks), so a stray tap never ends her show
  const TWICE = { end: 'Tap again to end the show', clear: 'Tap again to clear the line' };
  for (const b of o.buttons) {
    const label = b.textContent;
    b.addEventListener('click', () => {
      const action = b.dataset.lvO;
      if (TWICE[action] && armed !== action) {
        armed = action;
        b.textContent = TWICE[action];
        setTimeout(() => { if (armed === action) { armed = null; b.textContent = label; } }, 4000);
        return;
      }
      armed = null;
      b.textContent = label;
      run({ do: action });
    });
  }
  o.block?.addEventListener('submit', (e) => {
    e.preventDefault();
    const w = o.word.value.trim();
    if (w.length < 2) { o.error.textContent = 'A blocked word needs 2 letters or more.'; return; }
    o.word.value = '';
    run({ do: 'block', arg: w });
  });

  // (2026-10-07) a question from X's live chat, passed on by the host: the same checks as everyone's, then her line
  o.relayQ?.addEventListener('input', () => { if (!relaying) o.relayMsg.textContent = ''; });
  o.relay?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (relaying || dead) return;
    const question = o.relayQ.value.trim();
    const name = o.relayName.value.trim();
    if ([...question].length < 3) { o.relayMsg.textContent = relayText('question', { why: question ? 'short' : 'empty' }); o.relayQ.focus(); return; }
    relaying = true;
    o.relaySend.disabled = true;
    o.relayMsg.textContent = 'Adding…';
    let d;
    try {
      const res = await fetch('/api/live', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ action: 'relay', question, ...(name ? { name } : {}) }),
      });
      d = await res.json().catch(() => ({}));
      if (res.status === 401) d = { error: 'unauthorized' };
      else if (!res.ok || d.ok !== true) d = { ...d, error: d.error || 'busy' };
    } catch {
      d = { error: 'offline_net' };
    }
    relaying = false;
    o.relaySend.disabled = dead || (view ? !view.on : false);
    if (d.error === 'unauthorized') {
      o.relayMsg.textContent = '';
      run({ do: 'view' });                 // (it says the link stopped working, and switches the controls off)
      return;
    }
    o.relayMsg.textContent = relayText(d.error ?? null, { why: d.why, wait: d.wait, position: d.position });
    if (!d.error) {
      o.relayQ.value = '';
      o.relayName.value = '';
      run({ do: 'view' });                 // (her line shows it at once)
      o.relayQ.focus();
    } else if (d.error === 'name') o.relayName.focus();
    else o.relayQ.focus();
  });
  document.addEventListener('visibilitychange', () => { if (visible()) poll(); });
  poll();
}

start();
