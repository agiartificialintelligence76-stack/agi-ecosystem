// The "are you human?" check (Cloudflare Turnstile) and the 2-hour pass, for the Playground (the Arena used it too, until
// it left the site on 2026-09-28). The server hands out a pass after one successful check.
const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';   // public key, set in Vercel
const PASS_KEY = 'agi1_pass';

// Browser storage can be blocked (private mode), so every access is wrapped.
export const getPass = () => { try { return JSON.parse(localStorage.getItem(PASS_KEY)); } catch { return null; } };
const savePass = (pass) => { if (pass) { try { localStorage.setItem(PASS_KEY, JSON.stringify(pass)); } catch { /* not saved */ } } };
const dropPass = () => { try { localStorage.removeItem(PASS_KEY); } catch { /* ignore */ } };

let script = null;
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve();
  script ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = resolve;
    s.onerror = () => { script = null; reject(new Error('human_check')); };
    document.head.appendChild(s);
  });
  return script;
}

// One (usually invisible) widget per place on the page. Tokens are single-use, so each call gets a fresh one.
const widgets = new Map();
async function humanToken(container, action) {
  if (!SITE_KEY) throw new Error('not_configured');
  await loadTurnstile();
  return new Promise((resolve, reject) => {
    let w = widgets.get(container);
    const timer = setTimeout(() => { if (w) w.waiting = null; reject(new Error('human_check')); }, 60000);
    const waiting = {
      ok: (token) => { clearTimeout(timer); w.waiting = null; resolve(token); },
      fail: () => { clearTimeout(timer); w.waiting = null; reject(new Error('human_check')); },
    };
    if (!w) {
      w = { id: null, waiting };
      widgets.set(container, w);
      w.id = window.turnstile.render(container, {
        sitekey: SITE_KEY, action, size: 'flexible', appearance: 'interaction-only',
        theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
        callback: (token) => w.waiting?.ok(token),
        'error-callback': () => { w.waiting?.fail(); },
      });
    } else {
      w.waiting = waiting;
      window.turnstile.reset(w.id);
    }
  });
}

// Runs `call(extra)` with the saved pass, or with a fresh human-check token when there's no pass
// or the server refused it (expired after 2 h, or the visitor's IP changed). Saves any new pass.
// `call` must return { status, data }.
export async function withHuman(container, action, call) {
  const pass = getPass();
  let r = await call(pass ? { pass } : { turnstileToken: await humanToken(container, action) });
  if (r.status === 401 && r.data?.error === 'human_check' && pass) {
    dropPass();
    r = await call({ turnstileToken: await humanToken(container, action) });
  }
  if (r.data?.pass) savePass(r.data.pass);
  return r;
}

// POST JSON to our own API. Network failure → Error('offline'); a non-JSON answer → data = {}.
export async function postJson(url, body) {
  let res;
  try {
    res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    throw new Error('offline');
  }
  let data = {};
  try { data = await res.json(); } catch { /* not JSON */ }
  return { ok: res.ok, status: res.status, data };
}
