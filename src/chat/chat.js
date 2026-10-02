// The Playground: AGI-1's chat, styled like an AI lab's playground. It only ever talks to our own
// /api/chat, never to Google directly.
// Flow: 18+ confirmation → first message gets a Cloudflare "are you human?" check (usually invisible)
// → the server hands back a 2-hour chat pass → her reply comes with a mood that makes her react on stage.
// The markup lives in index.html (section#playground). Messages are always added with textContent.
// Her live view (2026-09-25): the 3D AGI-1 moves into the chat while you're here (src/stage/stage.js). This file tells her
// what's going on ('agi1:state': listening while you type, thinking while her reply is on its way) and makes her mouth
// "say" each reply (src/lib/talk.js) when her voice is off.
// Voice chat (2026-09-25): the mic button says one message out loud; the Call button on her live view is hands-free (she
// picks up, listens, answers in her voice, and the mic opens again when she's done). The browser turns speech into text
// for free (src/chat/listen.js); the words are sent like typed ones, with the same limits.
// Out of messages (2026-09-25): a Stranger or a Crush who used today's messages hears her say that $AGI unlocks more
// (src/chat/limit-lines.js), with the safety note right under it; the owner's one exception to "no buy advice". Whatever she
// writes when someone runs out, she also says, in her natural voice, even with her voice switched off (the owner's choice).
// Market moments (2026-09-25): when $AGI reaches a new $200K market cap step she's happy and says the market cap; after a -20%
// day she's sad. Her face and body react, a notification card appears, and her natural voice says it (src/chat/market.js).
// Her languages (2026-09-29): the language menu in the chat bar (src/chat/languages.js) picks the one she speaks; every line
// of hers here comes from src/i18n/lines/<code>.js (src/i18n/lang.js), her replies follow it (and whatever language you write
// in), the mic listens for it, and her voice lines are that language's. The page itself stays in English.
// Full-screen talk (2026-10-02, src/chat/fullscreen.js): this same chat at agi1.app/talk, with AGI-1 big beside it. There
// her live view shows even before the 18+ check (as on the stage, for everyone: PG-13); the chat itself still waits for it.
import { withHuman, postJson } from '../lib/human.js';
import { currentSession } from './relationship.js';
import { startModelMenu } from './models.js';
import { soonLine } from './model-lines.js';
import { startVoice } from './voice.js';
import { canListen, listenOnce } from './listen.js';
import { pretendTalk } from '../lib/talk.js';
import { TOKENS } from '../prices/parse.js';
import { limitLineIn, restLineIn, finePrintIn } from './limit-lines.js';
import { levelInfo } from '../lib/levels.js';
import { startMarketWatch } from './market.js';
import { usd, STEP, milestoneOf, milestoneLine, dumpLine, marketLineByKey } from './market-lines.js';
import { notify } from '../lib/notify.js';
import { getPrices } from '../prices/prices.js';
import { currentLang, currentLines, t, tl } from '../i18n/lang.js';
import { langOf } from '../i18n/langs.js';
import { startLanguageMenu } from './languages.js';
import { burnsReady, openBurn, burnSettings } from './burn.js';
import { fmt } from '../lib/burns.js';

// limit: the day and level she last said her out-of-messages line in this browser ("2026-09-25:1"), so she says it once a day
const KEYS = { history: 'agi1_chat_v1', adult: 'agi1_18plus', limit: 'agi1_limit_line' };
const MAX_LEN = 500;        // characters per message (the server enforces this too)
const KEEP = 40;            // messages remembered in this browser
const CONTEXT = 6;          // recent messages sent along so she remembers the conversation
const REACTIONS = ['happy', 'love', 'shy', 'wave'];
const VOICE_WAIT = 2500;    // with voice on, her reply waits (at most this long, ms) for her voice, so both start together
const LISTEN_MS = 2500;     // after you stop typing for this long, she stops "listening"
// the label on her live view, for each thing she can be doing
const STATE_WORDS = { idle: 'live', listening: 'listening', thinking: 'thinking', speaking: 'speaking' };
const QUIET_TRIES = 3;      // a call hangs up after this many silent turns in a row (about 20–30 s of nobody talking)
const nap = (ms) => new Promise((ok) => setTimeout(ok, ms));
const clockOf = (ms) => { const t = Math.floor(ms / 1000); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
// voice off: her mouth "says" a reply for about as long as reading it out would take (16 letters a second, 0.8 to 3.2 s)
const sayTime = (text) => Math.min(3.2, Math.max(0.8, String(text).length / 16));
// Her first line depends on your relationship level (Phase 3): a Stranger gets a friendly hello, no pet names.
// (Her words for all of these: src/i18n/lines/<code>.js, in the language she speaks: greet, notes, hear, voiceRest.)
const greeting = ({ level, name }) => (level >= 3 ? (name ? t('greet.soulmate', { name }) : t('greet.soulmateNoName'))
  : level === 2 ? t('greet.crush', { name: name || tl('pets')[1] })
    : t('greet.stranger'));

// What AGI-1 says when something stops a reply (keys match the server's error codes)
const NOTE_KEYS = ['too_fast', 'busy', 'not_configured', 'too_long', 'human_check', 'offline', 'error'];
const note = (why) => (why === 'person_cap' ? t('limit.sleep') : why === 'global_cap' ? t('limit.talkedOut')
  : t(`notes.${NOTE_KEYS.includes(why) ? why : 'error'}`));
// Voice chat: what she says when the mic couldn't get your words, or when a call ends by itself
const HEAR_KEYS = ['silence', 'denied', 'no-mic', 'unavailable', 'error', 'quiet', 'away'];
const hearNote = (why) => (why === 'offline' ? t('notes.offline') : t(`hear.${HEAR_KEYS.includes(why) ? why : 'error'}`));
// Her voice (src/chat/voice.js) can't be made for the rest of this visit: voiceRest.today / setup / call

// Browser storage can be blocked (private mode, settings), so every access is wrapped.
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* not saved: fine */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

export function startPlayground(root) {
  if (!root) return;
  const $ = (sel) => root.querySelector(sel);
  const log = $('[data-log]'), gate = $('[data-gate]'), form = $('[data-form]'), input = $('[data-input]');
  const sendBtn = $('[data-send]'), clearBtn = $('[data-clear]'), examples = $('[data-examples]');
  const humanBox = $('[data-human]'), count = $('[data-count]'), hint = $('[data-hint]'), foot = $('.pg-foot');
  const touch = matchMedia('(pointer: coarse)').matches;
  if (touch) hint.textContent = 'Tap Send to send';
  $('.pg-ava')?.addEventListener('error', (e) => e.target.remove());

  let history = Array.isArray(store.get(KEYS.history)) ? store.get(KEYS.history) : [];
  // (2026-10-02) the same chat can be open in two tabs (full-screen talk opens in a new tab too): `synced` is how much of
  // `history` is also in this browser's storage (the rest: this tab's new messages); `stale`: another tab changed it while
  // this one was busy, so this one shows the stored chat again once it's done
  let synced = history.length, stale = false;
  let busy = false;
  let epoch = 0;                                // +1 on Clear and Forget me: a reply still on its way then isn't shown
  let rel = { level: 1, name: null };           // updated by the Relationship panel (src/chat/relationship.js)

  // ---------- her live view (2026-09-25) ----------
  const cam = $('[data-cam]'), camState = $('[data-cam-state]');
  let attention = 'idle', lookAt = null, speaking = false, listenTimer = 0;
  let hearing = null;                           // voice chat: the mic, while it listens (src/chat/listen.js)
  let call = null;                              // voice chat: a call in progress { since, quiet, wasOn }
  function showState() {
    if (!cam) return;
    const s = speaking ? 'speaking' : attention;
    cam.dataset.state = s;
    if (camState) camState.textContent = call ? `${s === 'idle' ? 'on call' : STATE_WORDS[s]} · ${clockOf(Date.now() - call.since)}` : STATE_WORDS[s];
  }
  // what she's paying attention to: 'listening' (you're typing: she looks at the box; or you're talking: she looks at
  // you), 'thinking' (her reply is on its way) or 'idle'. src/stage/stage.js turns it into where she looks and her tilt.
  function attend(next, look = next === 'listening' ? form : null) {
    clearTimeout(listenTimer);
    if (next === attention && look === lookAt) return;
    attention = next;
    lookAt = look;
    dispatchEvent(new CustomEvent('agi1:state', { detail: { state: next, look } }));
    showState();
  }
  // Phase 5: she reads her replies aloud, if the visitor switched it on (only ever in her natural voice: src/chat/voice.js)
  const voice = startVoice($('[data-voice]'), {
    onSpeaking: (on) => {
      speaking = on;
      showState();
      if (on && hearing) hearing.cancel();      // her voice started while the mic was open: don't let it hear her
    },
    onResting: (why) => voiceResting(why),
  });
  // Her voice can't be made for the rest of this visit (today's allowance, Google's daily limit, not set up): she says so
  // once, after the reply she's on, and a call ends (it can't be out loud). Her replies keep coming as text.
  let restNote = null, restNoted = false;
  function voiceResting(why) {
    if (restNoted || restNote) return;
    restNote = ['global_cap', 'person_cap', 'daily_limit', 'credits'].includes(why) ? 'voiceRest.today' : 'voiceRest.setup';
    if (call) endCall();
    if (!busy) showRestNote();
  }
  function showRestNote() {
    if (!restNote) return;
    message('note', t(restNote), { lang: currentLang() });
    restNote = null;
    restNoted = true;
  }

  // ---------- messages ----------
  function message(who, text, meta = {}, scroll = true) {
    const box = el('div', `msg msg-${who}`);
    const head = el('div', 'msg-meta', who === 'user' ? 'You' : who === 'note' ? 'AGI-1 · notice' : 'AGI-1');
    if (who === 'user' && meta.voice) head.append(el('span', 'msg-chip', 'voice'));   // said out loud (voice chat)
    if (who === 'model' && meta.mood) head.append(el('span', 'msg-chip', `mood: ${meta.mood}`));
    if (who === 'model' && meta.ms) head.append(el('span', 'msg-time', `${(meta.ms / 1000).toFixed(1)} s`));
    if (who === 'model' && meta.remembered) head.append(el('span', 'msg-chip msg-memory', `remembered: ${meta.remembered}`));
    if (who === 'model' && meta.chip) head.append(el('span', 'msg-chip', meta.chip));
    // (2026-09-30) a reply paid for by burning $AGI: how many burned messages are left
    if (who === 'model' && Number.isFinite(meta.burned)) head.append(el('span', 'msg-chip msg-burned', `burned message · ${fmt(meta.burned)} left`));
    const body = el('div', 'msg-text', text);
    body.dir = 'auto';                           // (her Arabic, or yours, reads right to left)
    if (meta.lang) body.lang = meta.lang;        // her pre-written lines: the language they're in
    box.append(head, body);
    log.append(box);
    if (scroll) log.scrollTop = log.scrollHeight;
    return box;
  }
  function renderHistory() {
    log.replaceChildren();
    if (!history.length) message('model', greeting(rel), { lang: currentLang() }, false);
    for (const t of history) message(t.role === 'user' ? 'user' : 'model', t.text, t, false);
    log.scrollTop = log.scrollHeight;          // once at the end, not once per message (faster page start)
    examples.hidden = history.length > 0;
  }
  // this tab's new messages go after whatever is stored now: another tab may have added some (they're kept) or cleared it,
  // or "Forget me" (then that wins: only this tab's new messages are kept)
  const save = () => {
    const stored = store.get(KEYS.history);
    const base = Array.isArray(stored) ? stored : [];
    if (JSON.stringify(base) !== JSON.stringify(history.slice(0, synced))) stale = true;
    history = base.concat(history.slice(synced)).slice(-KEEP);
    synced = history.length;
    store.set(KEYS.history, history);
  };
  // the stored chat, shown again (another tab changed it)
  function reload() {
    const next = store.get(KEYS.history);
    history = Array.isArray(next) ? next : [];
    synced = history.length;
    stale = false;
    renderHistory();
    if (!gate.hidden) examples.hidden = true;
  }

  // ---------- 18+ confirmation ----------
  // her live view comes with the chat, after the 18+ check; in full-screen talk she's there from the start (src/chat/fullscreen.js)
  const talkMode = () => document.documentElement.classList.contains('is-talk');
  const showCam = () => { if (cam) cam.hidden = !gate.hidden && !talkMode(); };
  function showGate(on) {
    if (on) endCall();
    gate.hidden = !on;
    log.hidden = form.hidden = foot.hidden = on;
    root.classList.toggle('is-gated', on);       // (no Call button on her live view before it)
    showCam();
    examples.hidden = on || history.length > 0;
    clearBtn.hidden = on;
    if (!on) log.scrollTop = log.scrollHeight;   // (the live view takes some width, so lines wrap: newest message in view)
  }
  addEventListener('agi:talk', () => {
    showCam();
    requestAnimationFrame(() => { log.scrollTop = log.scrollHeight; });   // (a taller or shorter chat: the newest message in view)
  });
  $('[data-gate-ok]').addEventListener('click', () => {
    store.set(KEYS.adult, true);
    showGate(false);
    input.focus({ preventScroll: true });
    dispatchEvent(new CustomEvent('agi:adult', { detail: true }));   // (ClankChecker's AGI-1 too)
  });
  // confirmed somewhere else on the page (ClankChecker's "Ask AGI-1"): the chat opens too
  addEventListener('agi:adult', (e) => { if (e.detail === true && !gate.hidden) showGate(false); });

  // ---------- "Try AGI-1" buttons: scroll here and get ready to type ----------
  addEventListener('agi:chat-open', () => {
    dispatchEvent(new CustomEvent('agi:stage', { detail: 'agi1' }));   // bring AGI-1 back on stage
    if (talkMode()) { (gate.hidden ? input : $('[data-gate-ok]')).focus({ preventScroll: true }); return; }   // (already right here)
    const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    root.closest('section').scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
    setTimeout(() => (gate.hidden ? input : $('[data-gate-ok]')).focus({ preventScroll: true }), smooth ? 600 : 0);
  });

  // ---------- clear the conversation (click twice to confirm) ----------
  let armed = false, armTimer = null;
  clearBtn.addEventListener('click', () => {
    if (!armed) {
      armed = true; clearBtn.textContent = 'Click again to clear';
      armTimer = setTimeout(() => { armed = false; clearBtn.textContent = 'Clear'; }, 2600);
      return;
    }
    clearTimeout(armTimer); armed = false; clearBtn.textContent = 'Clear';
    epoch += 1;
    endCall();
    hearing?.cancel();
    voice.stop();
    attend('idle');
    history = []; synced = 0; store.del(KEYS.history);
    log.replaceChildren(); message('model', t('fresh'), { lang: currentLang() });
    examples.hidden = false;
  });

  // "Listen": one of her pre-written lines in her natural voice (a tap, so it plays even with her voice off)
  function listenButton(line) {
    const b = el('button', 'chip-btn msg-listen');
    b.type = 'button';
    b.setAttribute('aria-label', 'Listen to AGI-1 say it');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('aria-hidden', 'true');
    const play = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    play.setAttribute('d', 'M5 3.2v9.6a.6.6 0 0 0 .9.5l7.4-4.8a.6.6 0 0 0 0-1L5.9 2.7a.6.6 0 0 0-.9.5Z');
    svg.append(play);
    b.append(svg, el('span', '', 'Listen'));
    b.addEventListener('click', () => { hearing?.cancel(); voice.line(line.key, line.lang); });
    // about to press it: her voice for the line starts downloading, so it plays at once
    for (const type of ['pointerenter', 'focus', 'touchstart']) b.addEventListener(type, () => voice.warm(line.key, line.lang), { passive: true });
    return b;
  }

  // ---------- out of messages for today (2026-09-25, the owner's request) ----------
  // A Stranger or a Crush: she says that $AGI in a connected wallet unlocks more messages a day (src/chat/limit-lines.js),
  // with the safety note and the free option right under it. Once a day per browser and level; after that, and always for
  // Soulmates (already at the top), her short "come back tomorrow" line, and when the whole site is out for today (`site`),
  // her "all talked out" line. She says every one of them out loud in her natural voice (see sayAnyway).
  // Since 2026-09-30, once burning $AGI for messages is open (src/chat/burn.js): a "Burn $AGI for more messages" chip under
  // every one of these lines, or, when their burned messages wait for tomorrow (`burn`: their daily most, or the site's), a
  // note saying so.
  // → how her voice went ('voice' | 'late' | 'none'), like voice.speak()
  async function outOfMessages(level, { site = false, burn = null } = {}) {
    reachedCap(level);
    const lines = currentLines(), lang = currentLang();
    const offer = site ? null : limitLineIn(level, lines, lang);
    const mark = `${new Date().toISOString().slice(0, 10)}:${level}`;
    if (!offer || store.get(KEYS.limit) === mark) {
      const line = restLineIn(site ? 'site' : 'person', lines, lang);
      const box = message('model', line.text, { chip: 'out of messages', lang });
      const actions = el('div', 'msg-actions');
      if (voice.available) actions.append(listenButton(line));
      const waits = burnPart(actions, burn);
      if (actions.childNodes.length || waits) {
        const row = el('div', 'msg-offer');
        if (actions.childNodes.length) row.append(actions);
        if (waits) row.append(waits);
        box.append(row);
      }
      log.scrollTop = log.scrollHeight;
      dispatchEvent(new CustomEvent('agi1:react', { detail: 'wave' }));
      return sayAnyway(line);
    }
    store.set(KEYS.limit, mark);
    const box = message('model', offer.text, { mood: 'wave', chip: 'out of messages', lang });
    const row = el('div', 'msg-offer');
    const actions = el('div', 'msg-actions');
    if (voice.available) actions.append(listenButton(offer));
    if (level === 1 && !rel.wallet) {
      const connect = el('button', 'chip-btn', 'Connect wallet');
      connect.type = 'button';
      connect.addEventListener('click', () => dispatchEvent(new CustomEvent('agi:wallet-open')));
      actions.append(connect);
    }
    const buy = el('a', 'chip-btn msg-buy', 'Buy $AGI on clank.trade ');
    buy.href = `https://clank.trade/coin/${TOKENS[0].ca}`;
    buy.target = '_blank';
    buy.rel = 'noopener noreferrer';
    buy.append(el('span', '', '↗'));
    buy.lastChild.setAttribute('aria-hidden', 'true');
    actions.append(buy);
    const waits = burnPart(actions, burn);
    const fine = el('p', 'msg-fine', finePrintIn(lines));
    fine.lang = lang;
    fine.dir = 'auto';
    row.append(actions, ...(waits ? [waits] : []), fine);
    box.append(row);
    log.scrollTop = log.scrollHeight;
    dispatchEvent(new CustomEvent('agi1:react', { detail: 'wave' }));     // (a little "see you" wave)
    return sayAnyway(offer);
  }
  // Burn $AGI for more messages (2026-09-30): the chip (it opens the burn screen), or the note when their burned messages
  // wait for tomorrow. → that note (for the caller to place), or null
  function burnPart(actions, burn) {
    if (!burnsReady()) return null;
    if (burn?.why === 'day_cap' || burn?.why === 'site_cap') {
      const left = Number.isFinite(burn.left) ? fmt(burn.left) : 'the ones';
      return el('p', 'msg-fine msg-burn-wait', burn.why === 'day_cap'
        ? `That's today's most for burned messages (${fmt(burnSettings().perDay)} a day). Your ${left} left are kept for tomorrow.`
        : `Burned messages are resting for today: the site's daily share is used up. Your ${left} left are kept for tomorrow.`);
    }
    const b = el('button', 'chip-btn msg-burn', 'Burn $AGI for more messages');
    b.type = 'button';
    b.addEventListener('click', () => openBurn());
    actions.append(b);
    return null;
  }
  // She says it out loud in her natural voice even with her voice switched off (the owner, 2026-09-25: "i just want her to
  // speak the same words with her natural voice"): the visitor just pressed Send, so browsers allow the sound. Her voice
  // setting stays as it was, and it's a fixed line kept by the CDN, so it costs nothing. If this browser won't play sound
  // right now (an iPhone where the tap didn't unlock it), her mouth "says" it and the Listen button plays it.
  async function sayAnyway(line) {
    if (!voice.available || !(await voice.unlock())) {
      pretendTalk(sayTime(line.text), 0.8);
      return 'none';
    }
    return Promise.race([voice.line(line.key, line.lang), nap(VOICE_WAIT).then(() => 'late')]);
  }
  // Replies this browser got today, so the Send that will run out of messages can unlock sound in the tap itself (iPhones
  // only allow it there), even with her voice off: then her out-of-messages line plays out loud there too. A guess (other
  // browsers count too); when it's wrong, the line's Listen button is there.
  const SENT = 'agi1_sent';
  const utcDay = () => new Date().toISOString().slice(0, 10);
  const sentToday = () => { const v = store.get(SENT); return v && v.day === utcDay() && Number.isFinite(v.n) ? v.n : 0; };
  const countReply = () => store.set(SENT, { day: utcDay(), n: sentToday() + 1 });
  const reachedCap = (level) => store.set(SENT, { day: utcDay(), n: Math.max(sentToday(), levelInfo(level).daily) });
  const nearCap = () => sentToday() >= levelInfo(rel.level).daily;
  // one message left (or none): her out-of-messages line starts downloading, so it plays the moment it's needed
  function warmCapLine() {
    if (sentToday() < levelInfo(rel.level).daily - 1) return;
    const offer = limitLineIn(rel.level, currentLines(), currentLang());
    const shown = store.get(KEYS.limit) === `${utcDay()}:${rel.level}`;
    voice.warm((offer && !shown ? offer : restLineIn('person')).key, currentLang());
  }

  // ---------- sending ----------
  async function callApi(text, extra) {
    // earlier messages only (the new one is `text`), and only the fields the server checks
    const recent = history.slice(0, -1).slice(-CONTEXT).map(({ role, text: t, sig }) => (sig ? { role, text: t, sig } : { role, text: t }));
    const session = currentSession();             // a connected wallet's session sets the level (server checks it)
    // lang: the language she speaks with you (she also follows the language you write in)
    return postJson('/api/chat', { message: text, history: recent, adult: true, lang: currentLang(), ...(session ? { session } : {}), ...extra });
  }

  // → { ok: true, said } once her reply is shown (said: how her voice went, see voice.speak), or { ok: false, error, said? }
  // (out of messages: `said` is a promise of how her voice for that line went)
  async function send(text, { spoken = false } = {}) {
    voice.prime({ force: nearCap() });           // (in the tap: phones only allow sound that starts from one)
    voice.stop();
    warmCapLine();
    const mine = epoch;
    busy = true;
    sendBtn.disabled = true;
    examples.hidden = true;
    attend('thinking');
    message('user', text, spoken ? { voice: true } : {});
    history.push({ role: 'user', text, ...(spoken ? { voice: true } : {}) });
    save();
    const typing = el('div', 'msg msg-model msg-typing');
    const dots = el('div', 'msg-text');
    dots.setAttribute('aria-label', 'AGI-1 is typing');
    dots.append(el('i'), el('i'), el('i'));
    typing.append(el('div', 'msg-meta', 'AGI-1'), dots);
    log.append(typing);
    log.scrollTop = log.scrollHeight;
    const t0 = performance.now();
    try {
      // No pass yet? The human check runs first, so the message is sent only once.
      const r = await withHuman(humanBox, 'chat', (extra) => callApi(text, extra));
      // the answer carries the latest level/session; the Relationship panel keeps them
      dispatchEvent(new CustomEvent('agi:chat-answer', { detail: r.data }));
      if (r.ok && typeof r.data.reply === 'string') {
        const meta = { mood: REACTIONS.includes(r.data.mood) || r.data.mood === 'neutral' ? r.data.mood : undefined, ms: Math.round(performance.now() - t0) };
        if (typeof r.data.remembered === 'string') meta.remembered = r.data.remembered;
        if (Number.isFinite(r.data.burned?.left)) meta.burned = r.data.burned.left;     // (paid for by burning $AGI)
        countReply();
        // Voice on: she keeps "typing" until her voice starts (at most VOICE_WAIT), so the reply appears as she speaks.
        // If her voice for it can't be made (even after one more try), it stays text: a small mark says so, and her mouth
        // "says" it silently. Never the browser's robotic voice.
        let said = 'none', failed = false, box = null;
        const silent = () => {
          if (!box || box.dataset.silent) return;
          box.dataset.silent = '1';
          // (when her voice now rests for the day, her note right after says so instead)
          if (!voice.resting()) box.querySelector('.msg-meta').append(el('span', 'msg-chip msg-novoice', 'voice: unavailable'));
          pretendTalk(sayTime(r.data.reply), 0.8);
        };
        if (voice.isOn()) {
          said = await Promise.race([
            voice.speak(r.data.reply, r.data.voice, { onFail: () => { failed = true; silent(); } }),
            nap(VOICE_WAIT).then(() => 'late'),
          ]);
          if (mine !== epoch) return { ok: false, error: 'cleared' };   // cleared (or Forget me) while waiting: dropped
        }
        typing.remove();
        attend('idle');
        box = message('model', r.data.reply, meta);
        history.push({ role: 'model', text: r.data.reply, sig: r.data.sig, ...meta });
        save();
        if (failed) silent();
        else if (said === 'none') pretendTalk(sayTime(r.data.reply), 0.8);   // no voice: her mouth "says" it silently
        // her reaction and face (src/stage/agi1.js); a neutral reply brings back her calm face
        dispatchEvent(new CustomEvent('agi1:react', { detail: REACTIONS.includes(r.data.mood) ? r.data.mood : 'neutral' }));
        return { ok: true, said };
      } else if (r.data.error === 'age') {
        store.del(KEYS.adult);
        showGate(true);
        dispatchEvent(new CustomEvent('agi:adult', { detail: false }));
        return { ok: false, error: 'age' };
      } else if (r.data.error === 'person_cap' || r.data.error === 'global_cap') {
        typing.remove();
        attend('idle');
        const level = [1, 2, 3].includes(r.data.level) ? r.data.level : rel.level;
        // (her voice for it isn't waited for here, so you can type again right away; a call waits for it: see startCall)
        return { ok: false, error: r.data.error, said: outOfMessages(level, { site: r.data.error === 'global_cap', burn: r.data.burn || null }) };
      } else {
        message('note', note(r.data.error), { lang: currentLang() });
        return { ok: false, error: r.data.error || 'error' };
      }
    } catch (err) {
      message('note', note(err.message), { lang: currentLang() });
      return { ok: false, error: err.message || 'error' };
    } finally {
      typing.remove();
      if (attention === 'thinking') attend('idle');
      busy = false;
      sendBtn.disabled = false;
      if (!touch) input.focus({ preventScroll: true });
      if (stale) reload();                       // (another tab's messages, now that her reply is in)
      if (waitingMarket) { const m = waitingMarket; waitingMarket = null; showMarket(m); }
      if (waitingSoon) { const m = waitingSoon; waitingSoon = null; showSoon(m); }
      showRestNote();
    }
  }

  function submit() {
    if (hearing) { hearing.stop(); return; }    // (the mic is on: Enter/Send means "done talking")
    const text = input.value.trim().slice(0, MAX_LEN);
    if (!text || busy) return;
    input.value = '';
    grow();
    send(text);
  }
  form.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !touch && !e.isComposing) { e.preventDefault(); submit(); }
  });
  // the box grows with the text (up to about 6 lines) and counts characters
  function grow() {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
    count.textContent = String(input.value.length);
  }
  input.addEventListener('input', () => {
    grow();
    if (busy) return;                            // she's thinking about your last message
    if (!input.value.trim()) { if (attention === 'listening') attend('idle'); return; }
    attend('listening');                         // she looks at what you're typing…
    listenTimer = setTimeout(() => attend('idle'), LISTEN_MS);   // …until you stop for a moment
  });
  for (const b of examples.querySelectorAll('button')) {
    b.addEventListener('click', () => { if (!busy) send(b.textContent.trim()); });
  }

  // ---------- voice chat (2026-09-25) ----------
  // Only where the browser can turn speech into text (not Firefox). Nothing is recorded: see src/chat/listen.js.
  const micBtn = $('[data-mic]'), callBtn = $('[data-call]'), callWord = $('[data-call-word]');
  const MIC_LABEL = micBtn?.getAttribute('aria-label') || '', CALL_LABEL = callBtn?.getAttribute('aria-label') || '';
  const PLACEHOLDER = input.placeholder;
  if (canListen() && micBtn && callBtn) micBtn.hidden = callBtn.hidden = false;

  // Talking: she answers out loud, unless the visitor switched her voice off before (then it's their choice).
  function voiceForTalk() {
    if (!voice.isOn() && voice.chosen() !== 'off') voice.setOn(true);
    voice.prime();                               // (in the tap: phones only allow sound that starts from one)
  }

  // Listen for one message. Your words appear in the box as you say them, and she looks at you (and nods now and then).
  // → { text, reason } from listenOnce(); text '' = nothing usable
  async function hear() {
    voice.stop();                                // she stops talking, so the mic doesn't hear her
    const typed = input.value;
    input.value = '';
    grow();
    input.placeholder = 'Listening…';
    micBtn.classList.add('is-on');
    micBtn.setAttribute('aria-pressed', 'true');
    micBtn.setAttribute('aria-label', 'Done talking: send it');
    attend('listening', null);
    let words = 0, nodAt = 0;
    hearing = listenOnce({
      lang: langOf(currentLang()).speech,         // (the mic listens for the language she speaks)
      onWords: (words) => {
        input.value = words;
        grow();
        const n = words ? words.split(' ').length : 0;
        if (n >= words + 3 && performance.now() - nodAt > 1500) {   // a small nod every few words
          words = n;
          nodAt = performance.now();
          dispatchEvent(new CustomEvent('agi1:react', { detail: 'nod' }));
        }
      },
    });
    const heard = await hearing.done;
    hearing = null;
    micBtn.classList.remove('is-on');
    micBtn.setAttribute('aria-pressed', 'false');
    micBtn.setAttribute('aria-label', MIC_LABEL);
    input.placeholder = PLACEHOLDER;
    input.value = heard.text ? '' : typed;       // nothing heard: whatever you had typed comes back
    grow();
    if (!heard.text && attention === 'listening') attend('idle');
    return heard;
  }

  // The mic button: say one message (tap again, Enter or Send = done talking). In a call it means "talk now": she stops.
  micBtn?.addEventListener('click', async () => {
    if (hearing) { hearing.stop(); return; }
    if (call) { voice.stop(); return; }
    if (busy || !gate.hidden) return;
    voiceForTalk();
    const { text, reason } = await hear();
    if (text) send(text, { spoken: true });
    else if (reason !== 'stopped') message('note', hearNote(reason), { lang: currentLang() });
  });

  // ---------- calls: hands-free, back and forth ----------
  let callClock = 0;
  function drawCall() {
    callBtn.classList.toggle('is-on', Boolean(call));
    callBtn.setAttribute('aria-pressed', String(Boolean(call)));
    callBtn.setAttribute('aria-label', call ? 'End the call' : CALL_LABEL);
    callWord.textContent = call ? 'End' : 'Call';
    cam?.classList.toggle('is-call', Boolean(call));
    clearInterval(callClock);
    if (call) callClock = setInterval(showState, 1000);
    showState();
  }
  // until her reply is out of the way: no reply on its way, and she has finished talking (so the mic won't hear her)
  async function herTurnOver(me, said) {
    const t0 = performance.now();
    if (said === 'late') {                       // her voice is still on its way: wait for it to start (at most 12 s)
      while (call === me && !voice.speaking() && performance.now() - t0 < 12_000) await nap(150);
    }
    while (call === me && (busy || voice.speaking()) && performance.now() - t0 < 60_000) await nap(150);
    await nap(400);                              // a breath before the mic opens
  }
  async function startCall() {
    if (call || busy || !gate.hidden) return;
    if (voice.resting()) { message('note', t('voiceRest.call'), { lang: currentLang() }); return; }   // (a call is out loud: not while her voice rests)
    const me = call = { since: Date.now(), quiet: 0, stops: 0, wasOn: voice.isOn() };
    if (!voice.isOn()) voice.setOn(true, { remember: false });   // a call is out loud (switched back afterwards)
    voice.prime();
    drawCall();
    await herTurnOver(me, await voice.hello());  // she picks up: "hi, it's me"
    while (call === me) {
      await herTurnOver(me, 'none');
      if (call !== me) break;
      const { text, reason } = await hear();
      if (call !== me) break;
      if (!text) {
        // (stopped: her voice started, or you tapped "talk now". Many in a row = this browser keeps cutting the mic off)
        if (reason === 'stopped' && ++me.stops < 6) { await nap(300); continue; }
        if (reason === 'silence' && ++me.quiet < QUIET_TRIES) continue;
        endCall(reason === 'silence' ? 'quiet' : reason === 'stopped' ? 'unavailable' : reason);
        break;
      }
      me.quiet = me.stops = 0;
      const out = await send(text, { spoken: true });
      if (call !== me) break;
      if (!out.ok) {                             // her note already says why (limits, connection…)
        await herTurnOver(me, await out.said);   // (out of messages: she says it out loud first, then hangs up)
        if (call === me) endCall();
        break;
      }
      await herTurnOver(me, out.said);
    }
  }
  // why: why it ended, for her note in the chat (hearNote), or nothing (you hung up, Clear, Forget me…)
  function endCall(why) {
    if (!call) return;
    const was = call;
    call = null;
    hearing?.cancel();
    if (!was.wasOn) voice.setOn(false, { remember: false });     // her voice goes back to how it was
    drawCall();
    if (attention === 'listening') attend('idle');
    if (why) message('note', hearNote(why), { lang: currentLang() });
  }
  callBtn?.addEventListener('click', () => (call ? endCall() : startCall()));
  // about to call: her intro starts downloading now, so she picks up without a pause (and in her own voice)
  for (const type of ['pointerenter', 'focus', 'touchstart']) callBtn?.addEventListener(type, () => { if (!call) voice.warm('hello'); }, { passive: true });
  // leaving the page (another tab, the phone locked): the call ends, so the mic is never left open
  document.addEventListener('visibilitychange', () => { if (document.hidden && call) endCall('away'); });
  addEventListener('pagehide', () => endCall());
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && hearing && !call) hearing.cancel(); });
  // her pop-out window (2026-10-02, src/chat/popout.js): she talks there now, so here a call ends, the mic closes and this
  // page's voice stays quiet until she's back (a reply still on its way here shows as text)
  let popped = false;
  addEventListener('agi:popout', (e) => {
    popped = e.detail === true;
    voice.hold?.(popped);
    if (!popped) return;
    endCall();
    hearing?.cancel();
    attend('idle');
  });

  // ---------- Relationship panel events (Phase 3) ----------
  addEventListener('agi:relationship', (e) => {
    rel = e.detail;
    regreet();
  });
  // an empty chat shows only her greeting, so it can follow the level (and her language)
  function regreet() {
    if (!history.length && log.children.length === 1 && log.firstElementChild.classList.contains('msg-model')) {
      const body = log.firstElementChild.querySelector('.msg-text');
      body.textContent = greeting(rel);
      body.lang = currentLang();
    }
  }
  // her pre-written lines aren't read aloud, so with her voice off her mouth "says" them (with it on, she stays quiet)
  const sayQuietly = (text) => { if (!voice.isOn()) pretendTalk(sayTime(text), 0.8); };
  addEventListener('agi:agi1-line', (e) => {           // e.g. the level-up moment: shown, not added to the history
    if (typeof e.detail?.text === 'string' && gate.hidden) {
      message('model', e.detail.text, { mood: 'love', lang: e.detail.lang });
      sayQuietly(e.detail.text);
    }
  });
  // ---------- the model picker (2026-09-26, the owner's request) ----------
  // "AGI-1 ▾" in the chat bar opens the models (src/chat/models.js). AGI-2 is "Coming soon": picking it makes her playfully
  // jealous, with a pre-written line (src/chat/model-lines.js, no AI cost, not saved to the history) and her pout. Only after
  // the 18+ check, not twice within a few seconds, and never in the middle of her typing a reply (it waits for the reply).
  let waitingSoon = null, lastSoon = 0;
  function showSoon(model) {
    const { text, mood, lang } = soonLine({ model, level: rel.level, name: rel.name, lines: currentLines(), lang: currentLang() });
    message('model', text, { mood, chip: `${model} · coming soon`, lang });
    dispatchEvent(new CustomEvent('agi1:react', { detail: 'jealous' }));
    sayQuietly(text);
  }
  startModelMenu($('[data-model-menu]'), {
    onSoon: (model) => {
      if (!gate.hidden || Date.now() - lastSoon < 4000) return;
      lastSoon = Date.now();
      if (busy) waitingSoon = model;
      else showSoon(model);
    },
  });
  // ---------- market moments (2026-09-25, the owner's request) ----------
  // $AGI reached a new $200K market cap step (she's happy and says the market cap) or had a -20% day (she's sad):
  // src/chat/market.js watches the live numbers, src/chat/market-lines.js has her words. In her chat (not saved to the
  // history) with her face and body ('celebrate' / 'sad'), and as a notification card at the top of the page (unless it would
  // cover her live view, where she's reacting right then). Out loud in her natural voice when her voice is on (or in a call;
  // after whatever she's saying), else a Listen button. Only after the 18+ check; if she's typing a reply, it waits until the
  // reply is there.
  let waitingMarket = null;
  // She says it once she's free: never over her own reply (or one whose voice is still on its way), a new reply on its way,
  // or you (the mic is on: in a call, only while your words are coming in). Still not free after 30 s: the Listen buttons
  // are there. Her natural voice (as always), and only if sound is already allowed on this page: no
  // surprise sound right after opening it (browsers block that anyway). Otherwise her mouth "says" it silently.
  async function sayWhenFree(line) {
    const mine = epoch;
    for (let i = 0; i < 120; i++) {
      if (mine !== epoch || !voice.isOn()) return;          // cleared, or her voice was switched off meanwhile
      if (!busy && !voice.busy() && !(hearing && (!call || input.value.trim()))) {
        if (voice.unlocked()) voice.line(line.key, line.lang);
        else pretendTalk(sayTime(line.text), 0.8);
        return;
      }
      await nap(250);
    }
  }
  function showMarket(m) {
    const up = m.kind === 'milestone';
    // (in the language she speaks: the same moment, her words for it)
    const line = marketLineByKey(m.line.key, currentLines(), currentLang()) || m.line;
    const now = (up ? `${usd(m.mcap)} now` : `${m.h24.toFixed(1)}% in 24h`) + (m.preview ? ' · preview' : '');
    const box = message('model', line.text, { mood: up ? 'happy' : 'sad', chip: `market · ${now}`, lang: line.lang });
    const offer = el('div', 'msg-offer');
    const actions = el('div', 'msg-actions');
    if (voice.available) actions.append(listenButton(line));
    const fine = el('p', 'msg-fine', t('market.finePrint'));
    fine.lang = currentLang();
    fine.dir = 'auto';
    offer.append(actions, fine);
    box.append(offer);
    log.scrollTop = log.scrollHeight;
    dispatchEvent(new CustomEvent('agi1:react', { detail: up ? 'celebrate' : 'sad' }));
    notify({
      avoid: cam,
      tone: up ? 'up' : 'down',
      title: (up ? `$AGI · market cap ${usd(m.mcap)}` : `$AGI · ${m.h24.toFixed(1)}% in 24h`) + (m.preview ? ' · preview' : ''),
      text: line.text,
      actions: [
        ...(voice.available ? [{ label: 'Listen', icon: 'play', ariaLabel: 'Listen to AGI-1 say it', warm: () => voice.warm(line.key, line.lang),
          onClick: () => { hearing?.cancel(); voice.line(line.key, line.lang); return false; } }] : []),
        { label: 'Open chat', onClick: () => dispatchEvent(new CustomEvent('agi:chat-open')) },
      ],
    });
    if (voice.isOn()) sayWhenFree(line);
    else pretendTalk(sayTime(line.text), 0.8);   // voice off: her mouth "says" it, and Listen is right there
  }
  // (while she's in her pop-out window, its page notices them: nothing is noted here, so nothing is missed: src/chat/popout.js)
  startMarketWatch({ ready: () => gate.hidden && !popped, onMoment: (m) => { if (busy) waitingMarket = m; else showMarket(m); } });
  // ?dev: preview one without waiting for the market (the stage's "market up" / "market down" buttons). Nothing is remembered.
  if (new URLSearchParams(location.search).has('dev')) {
    addEventListener('agi:market-preview', (e) => {
      if (!gate.hidden || busy) return;
      const agi = getPrices().tokens.AGI || {};
      const mcap = agi.mcap > 0 ? agi.mcap : 10 * STEP;
      const step = Math.max(STEP, milestoneOf(mcap));      // (a step our server will voice: right at today's market cap)
      showMarket(e.detail === 'down'
        ? { kind: 'dump', mcap, h24: Math.min(-20.5, agi.h24 ?? -20.5), line: dumpLine(), preview: true }
        : { kind: 'milestone', step, mcap, h24: agi.h24 ?? null, line: milestoneLine(step), preview: true });
    });
  }
  addEventListener('agi:chat-reset', () => {             // "Forget me"
    epoch += 1;
    endCall();
    hearing?.cancel();
    voice.stop();
    attend('idle');
    history = [];
    synced = 0;
    store.del(KEYS.history);
    log.replaceChildren();
    message('model', greeting({ level: 1 }), { lang: currentLang() });
    examples.hidden = false;
  });

  // ---------- her languages (2026-09-29, the owner's request) ----------
  // The menu next to "AGI-1 ▾" (src/chat/languages.js). A pick: she says so in that language (not saved to the history; her
  // mouth "says" it), and an empty chat's greeting follows. A saved choice coming back at page start: only the greeting.
  let lastLangLine = 0;
  startLanguageMenu($('[data-lang-menu]'), {
    onPick: () => {
      if (!gate.hidden || busy || Date.now() - lastLangLine < 1500) return;
      lastLangLine = Date.now();
      const text = t('langSet');
      message('model', text, { mood: 'happy', chip: `language · ${langOf(currentLang()).native}`, lang: currentLang() });
      dispatchEvent(new CustomEvent('agi1:react', { detail: 'happy' }));
      sayQuietly(text);
    },
  });
  addEventListener('agi1:lang', () => regreet());

  // ---------- the same chat in another tab (2026-10-02: full-screen talk can open in a new tab too) ----------
  // Her chat history is kept in this browser: when another tab of the site changes it, this one shows it too, so two tabs
  // never write over each other's messages. The same for the 18+ answer.
  addEventListener('storage', (e) => {
    if (e.key === KEYS.history) {
      if (busy) stale = true;                    // (after her reply: send() saves its own, then shows them all)
      else reload();
    } else if (e.key === KEYS.adult && store.get(KEYS.adult) === true && !gate.hidden) showGate(false);
  });

  renderHistory();
  showGate(store.get(KEYS.adult) !== true);
  showState();
  // the site's font can arrive a moment later and re-wrap the lines: still at the end, stay at the end
  document.fonts?.ready?.then(() => { if (log.scrollHeight - log.scrollTop - log.clientHeight < 80) log.scrollTop = log.scrollHeight; });
}
