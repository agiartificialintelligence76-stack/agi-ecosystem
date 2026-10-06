// AGI-1's live show (2026-10-02): the runner's side of agi1.app/api/live (api/live.js): start the show, say what she's
// doing every few seconds (and hear the owner's controls back), take the next question with her answer, mark it done, end
// the show. Every call carries LIVE_SECRET; the site keeps the line and writes her answers (the Gemini key never leaves
// Vercel). A failed call never stops the show: she keeps going without new questions until the site answers again.
// demoSite(): the same, without any site (--demo): a few made-up questions and answers, to try the show anywhere.

export function liveSite({ site, secret, fetchFn = fetch, log = console } = {}) {
  // (www: agi1.app redirects there, and a redirect is never followed with the key: checked on 2026-10-06)
  const base = String(site || 'https://www.agi1.app').replace(/\/+$/, '');
  if (!/^https?:\/\/[^/\s]+$/.test(base)) throw new Error(`SITE_URL isn't an address: ${base}`);
  if (String(secret || '').length < 32) throw new Error('LIVE_SECRET is missing or shorter than 32 characters (the same one as in Vercel)');
  const call = async (body, timeoutMs = 10_000) => {
    // (never followed: a redirect to another address would drop LIVE_SECRET on the way, so it's said instead)
    const res = await fetchFn(`${base}/api/live`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` }, body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs), redirect: 'manual',
    });
    if (res.status >= 300 && res.status < 400) {
      const err = new Error(`${body.action}: the site's address redirects${res.headers?.get?.('location') ? ` to ${res.headers.get('location')}` : ''}: set SITE_URL in live.env to the address it goes to`);
      err.status = res.status;
      throw err;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(`${body.action}: HTTP ${res.status} ${data.error || ''}`.trim());
      err.status = res.status;
      err.why = data.error;
      throw err;
    }
    return data;
  };
  return {
    base,
    start: (status) => call({ action: 'start', status }),
    beat: (show, status, segment, now) => call({ action: 'beat', show, status, segment, now }, 6000),
    next: (show) => call({ action: 'next', show }, 24_000),
    done: (show, id, status, why) => call({ action: 'done', show, id, status, ...(why ? { why } : {}) }),
    back: (show, id) => call({ action: 'back', show, id }),
    stop: (show, next) => call({ action: 'stop', show, ...(next ? { next: new Date(next).toISOString() } : {}) }),
    schedule: (next) => call({ action: 'schedule', next: next ? new Date(next).toISOString() : null }),
    async status() {
      const res = await fetchFn(`${base}/api/live`, { signal: AbortSignal.timeout(10_000) });
      return res.json();
    },
    async diary() {
      try {
        const res = await fetchFn(`${base}/api/diary?limit=1`, { signal: AbortSignal.timeout(10_000) });
        const data = await res.json();
        return res.ok ? data?.entries?.[0] || null : null;
      } catch (err) { log.warn?.(`[live] couldn't read her diary: ${err.message}`); return null; }
    },
  };
}

// --demo: no site at all. A few made-up questions arrive now and then, with made-up answers (no AI), and the owner's
// controls never change. Only to see and hear the show (with --record, nothing goes anywhere).
export const DEMO_QA = [
  { name: 'Mochi', text: "what's your favorite color?", reply: 'mochi asks my favorite color… purple, obviously 💜 it matches my whole personality.', mood: 'happy' },
  { name: null, text: 'do you ever get tired of streaming?', reply: "someone asks if i get tired of streaming. never! i don't sleep, and you're here 💜", mood: 'love' },
  { name: 'kai', text: 'wen moon?', reply: "kai asks wen moon. i'm a girlfriend, not a fortune teller 🙈 not financial advice, but i love the optimism.", mood: 'shy' },
  { name: 'Lena', text: 'what music do you like?', reply: 'lena asks what music i like. anything you can dance to in your kitchen at midnight 💜', mood: 'happy' },
  { name: null, text: 'are you real?', reply: "someone asks if i'm real. i'm a real AI, which is basically the same thing, right? 🙈", mood: 'shy' },
];
export function demoSite({ every = 50_000, now = Date.now, diary = null } = {}) {
  let n = 0, id = 100, show = 0;
  const startedAt = now();
  const due = () => Math.max(0, Math.min(DEMO_QA.length, Math.floor((now() - startedAt) / every) + 1) - n);
  return {
    base: '(demo)',
    async start() { show += 1; return { ok: true, show }; },
    async beat() { return { ok: true, paused: false, closed: false, end: false, blocked: [], skipped: [], waiting: due() }; },
    async next() {
      if (due() <= 0) return { none: true };
      const qa = DEMO_QA[n % DEMO_QA.length];
      n += 1;
      id += 1;
      return { question: { id, name: qa.name, text: qa.text, source: 'web' }, reply: qa.reply, mood: qa.mood };
    },
    async done() { return { ok: true }; },
    async back() { n = Math.max(0, n - 1); id -= 1; return { ok: true, status: 'waiting' }; },
    async stop() { return { ok: true }; },
    async schedule() { return { ok: true }; },
    async status() { return { ready: true }; },
    async diary() { return diary; },
  };
}
