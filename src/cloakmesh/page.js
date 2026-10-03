// CloakMesh's page (inference.agi1.app → /cloakmesh, 2026-10-03; cloakmesh.html): its own light and dark theme, the demo
// ("See what leaves your device": src/cloakmesh/demo.js, in this browser only), the five checks lighting up, the waitlist
// (/api/cloakmesh) and leaving it with a leave link (#leave=…). Everything shown is set with textContent.
import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/cloakmesh.css';
import { withHuman, postJson } from '../lib/human.js';
import { copyButton } from '../lib/copy.js';
import { checkEmail } from './email.js';
import { scrub, tokenMaker, plainTokenMaker, restore, exampleAnswer, foundInWords } from './demo.js';
import { joinWords, WORDS, demoLine } from './words.js';

const root = document.documentElement;
const $ = (sel) => document.querySelector(sel);

// ---------- light and dark (/cloakmesh-theme.js picked one before the page painted) ----------
const BAR = { dark: '#090b0d', light: '#f5f6f3' };
function setTheme(theme, remember) {
  root.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR[theme]);
  if (remember) { try { localStorage.setItem('cm-theme', theme); } catch { /* private mode: this visit only */ } }
  for (const b of document.querySelectorAll('[data-cm-theme]')) b.setAttribute('aria-label', WORDS.themeTo(theme));
}
setTheme(root.dataset.theme === 'light' ? 'light' : 'dark', false);
for (const b of document.querySelectorAll('[data-cm-theme]')) {
  b.addEventListener('click', () => setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark', true));
}

// ---------- leaving the waitlist (a leave link: /cloakmesh#leave=<code>) ----------
// The code is taken out of the address at once, so it doesn't stay in the browser's history or get shared by accident.
function leaveFlow() {
  const m = /^#leave=([^&]*)$/.exec(location.hash || '');
  if (!m) return;
  let token = '';
  try { token = decodeURIComponent(m[1]).trim().toLowerCase(); } catch { /* a broken link: said below */ }
  try { history.replaceState(null, '', location.pathname + location.search); } catch { /* the address keeps it */ }
  const box = $('[data-cm-leave]');
  if (!box) return;
  const say = $('[data-cm-leave-msg]');
  const go = $('[data-cm-leave-go]');
  const keep = $('[data-cm-leave-keep]');
  box.hidden = false;
  box.querySelector('h2')?.focus();
  if (!/^[0-9a-f]{64}$/.test(token)) {
    say.textContent = WORDS.leaveBad;
    go.hidden = true;
    return;
  }
  keep?.addEventListener('click', () => { box.hidden = true; });
  go.addEventListener('click', async () => {
    go.disabled = true;
    say.textContent = WORDS.leaving;
    let r;
    try {
      r = await postJson('/api/cloakmesh', { action: 'leave', token });
    } catch {
      r = { ok: false, data: { error: 'offline' } };
    }
    if (r.ok && r.data?.ok) {
      say.textContent = r.data.removed ? WORDS.left : WORDS.alreadyGone;
      go.hidden = true;
      if (keep) keep.hidden = true;
      return;
    }
    say.textContent = WORDS.leaveFailed(r.data?.error);
    go.disabled = false;
  });
}

// ---------- the waitlist ----------
function waitlist() {
  const form = $('[data-cm-form]');
  if (!form) return;
  const input = form.querySelector('#cm-email');
  const submit = $('[data-cm-submit]');
  const say = $('[data-cm-msg]');
  const done = $('[data-cm-done]');
  const human = $('[data-cm-human]');
  let busy = false;

  const close = () => {
    for (const el of form.querySelectorAll('input, button')) el.disabled = true;
    form.classList.add('is-closed');
    say.textContent = WORDS.closed;
  };
  // is it open? (supabase/cloakmesh.sql run and its settings there; the CDN keeps the answer a minute)
  fetch('/api/cloakmesh', { headers: { Accept: 'application/json' } })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => { if (data && data.ready === false) close(); })
    .catch(() => { /* unknown: the form stays, and joining says what's wrong */ });

  input.addEventListener('input', () => {
    input.removeAttribute('aria-invalid');
    if (say.dataset.kind === 'email') { say.textContent = ''; delete say.dataset.kind; }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    const e = checkEmail(input.value);
    if (!e.ok) {
      input.setAttribute('aria-invalid', 'true');
      say.textContent = input.value.trim() ? joinWords('email') : WORDS.emailHint;
      say.dataset.kind = 'email';
      input.focus();
      return;
    }
    const role = form.querySelector('input[name="role"]:checked')?.value || 'use';
    busy = true;
    submit.disabled = true;
    say.textContent = WORDS.sending;
    delete say.dataset.kind;
    let r;
    try {
      r = await withHuman(human, 'waitlist', (extra) => postJson('/api/cloakmesh', { action: 'join', email: e.email, role, ...extra }));
    } catch (err) {
      r = { ok: false, data: { error: ['offline', 'not_configured'].includes(err?.message) ? err.message : 'human_check' } };
    }
    busy = false;
    submit.disabled = false;
    if (r.ok && r.data?.ok && /^[0-9a-f]{64}$/.test(String(r.data.leave))) {
      const link = `${location.origin}/cloakmesh#leave=${r.data.leave}`;
      const code = done.querySelector('[data-cm-leave-url]');
      code.textContent = link;
      copyButton(done.querySelector('[data-cm-copy]'), { text: link, select: code, say: done.querySelector('[data-cm-copy-say]'), what: 'Leave link' });
      form.hidden = true;
      done.hidden = false;
      done.focus();
      return;
    }
    const error = r.data?.error || 'busy';
    if (error === 'email') input.setAttribute('aria-invalid', 'true');
    say.textContent = joinWords(error);
    if (error === 'email') say.dataset.kind = 'email';
    if (['not_ready', 'not_configured'].includes(error)) close();
  });
}

// ---------- the demo: what leaves your device (in this browser only) ----------
async function demo() {
  const box = $('[data-cm-demo]');
  if (!box) return;
  const input = box.querySelector('[data-cm-demo-in]');
  const out = box.querySelector('[data-cm-demo-out]');
  const ai = box.querySelector('[data-cm-demo-ai]');
  const you = box.querySelector('[data-cm-demo-you]');
  const status = box.querySelector('[data-cm-demo-status]');
  let make;
  try {
    make = globalThis.crypto?.subtle ? await tokenMaker() : plainTokenMaker();
  } catch {
    make = plainTokenMaker();
  }
  // text with its tokens marked (only text nodes: what anyone types stays text)
  const paint = (el, parts) => {
    el.replaceChildren(...parts.map((p) => {
      if (!p.token) return document.createTextNode(p.text);
      const span = document.createElement('span');
      span.className = 'cm-tok';
      span.textContent = p.text;
      return span;
    }));
  };
  const tokensIn = (text) => {
    const parts = [];
    let at = 0;
    for (const m of text.matchAll(/\[[A-Z_]{2,20}_[A-Z2-7]{8}\]/g)) {
      if (m.index > at) parts.push({ text: text.slice(at, m.index) });
      parts.push({ text: m[0], token: true });
      at = m.index + m[0].length;
    }
    if (at < text.length) parts.push({ text: text.slice(at) });
    return parts;
  };
  let run = 0, timer = null, lastLine = '';
  const update = async () => {
    const mine = ++run;
    const result = await scrub(input.value, make);
    if (mine !== run) return;                         // a newer keystroke already started its own
    paint(out, result.parts);
    const answer = exampleAnswer(result);
    paint(ai, tokensIn(answer));
    you.textContent = restore(answer, result.map);
    const line = demoLine(foundInWords(result.found));
    if (line !== lastLine) { status.textContent = line; lastLine = line; }
  };
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(update, 140);
  });
  await update();
}

// ---------- the five checks light up as they come into view ----------
function proof() {
  const list = $('[data-cm-proof]');
  if (!list) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) { list.classList.add('is-in'); return; }
  root.classList.add('cm-anim');
  const seen = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      list.classList.add('is-in');
      seen.disconnect();
    }
  }, { threshold: 0.25 });
  seen.observe(list);
}

leaveFlow();
waitlist();
proof();
demo().catch(() => { /* the demo stays as written: the page works without it */ });
