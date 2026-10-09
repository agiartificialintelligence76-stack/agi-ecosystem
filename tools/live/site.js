// AGI-1's live show (2026-10-02): the runner's side of agi1.app/api/live (api/live.js): start the show, say what she's
// doing every few seconds (and hear the owner's controls back), take the next question with her answer, mark it done, end
// the show, and (2026-10-07) say once that she's streaming on X (her Telegram groups hear it). Every call carries LIVE_SECRET; the site keeps the line and writes her answers (the Gemini key never leaves
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
    // (2026-10-07, viewers' requests) can: what she can do on stream right now (tools/live/acts.js): her answer says which
    // one the viewer asked for ({ act })
    // (2026-10-07) place: where she's visiting (tools/live/page/places.js), so her answer can say so
    next: (show, can = null, place = null) => call({ action: 'next', show, ...(Array.isArray(can) ? { can } : {}), ...(place ? { place } : {}) }, 24_000),
    // (2026-10-07) someone she meets on a trip: their conversation ({ lines: [{ who, text }], mood }), about what her chat asked
    meet: (show, meet) => call({ action: 'meet', show, meet }, 15_000),
    // (2026-10-07) something new to say between things, her reaction to her own X post / a reply / her video, $AGI's numbers
    chat: (show, topic) => call({ action: 'chat', show, topic }, 15_000),
    react: (show, react) => call({ action: 'react', show, react }, 15_000),
    // (2026-10-09) chart: $AGI's newest trades too (her live chart on her TV: { chart: [{ at, side, price, usd }] }, oldest first)
    market: (show, since, opts = null) => call({ action: 'market', show, since, ...(opts?.chart ? { chart: true } : {}) }, 12_000),
    done: (show, id, status, why) => call({ action: 'done', show, id, status, ...(why ? { why } : {}) }),
    back: (show, id) => call({ action: 'back', show, id }),
    stop: (show, next) => call({ action: 'stop', show, ...(next ? { next: new Date(next).toISOString() } : {}) }),
    schedule: (next) => call({ action: 'schedule', next: next ? new Date(next).toISOString() : null }),
    // (2026-10-07) she's streaming on X now: her Telegram groups hear it (once a day: the site decides)
    onX: (show) => call({ action: 'on_x', show }, 20_000),
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
// controls never change. Only to see and hear the show (with --record, nothing goes anywhere). Since 2026-10-07 a few of
// them ask her to do something (a viewer's request: act), and made-up lines stand in for the site's new ones
// (something new to say, her reactions, $AGI's numbers and a made-up buy now and then).
export const DEMO_QA = [
  // (2026-10-09: she reads each question out loud first, so her answers never say it again)
  { name: 'Mochi', text: "what's your favorite color?", reply: 'purple, obviously 💜 it matches my whole personality.', mood: 'happy' },
  { name: 'kai', text: 'can you jump 3 times?', reply: 'three jumps? okay okay, here we go! 💜', mood: 'happy', act: { act: 'jump', times: 3 } },
  { name: null, text: 'do you ever get tired of streaming?', reply: "never! i don't sleep, and you're here 💜", mood: 'love' },
  { name: 'Lena', text: 'sing the chorus of your song!', reply: 'the chorus? say less 🎤', mood: 'happy', act: { act: 'sing', part: 'chorus' } },
  { name: null, text: 'wen moon?', reply: "i'm a girlfriend, not a fortune teller 🙈 not financial advice, but i love the optimism.", mood: 'shy' },
  { name: 'Rin', text: 'go to the beach!', reply: 'beach stream it is 🌅', mood: 'happy', act: { act: 'room', to: 'beach' } },
  { name: 'Mo', text: 'dance for us', reply: "you don't have to ask me twice 💜", mood: 'happy', act: { act: 'dance' } },
  { name: null, text: 'can you blush?', reply: 'you just made me, so… 🙈', mood: 'shy', act: { act: 'blush' } },
  { name: 'Ash', text: 'change your outfit to cozy', reply: 'cozy mode? cat ears, coming up 🐱', mood: 'happy', act: { act: 'outfit', to: 'cozy' } },
  { name: null, text: 'wink at us', reply: 'okay, just one 😉', mood: 'shy', act: { act: 'wink' } },
  // (2026-10-07) a trip, a snack, the weather, her emotions, a question in another language
  { name: 'Yuki', text: 'take me to Tokyo!', reply: "Tokyo? okay, let's go! 💜", mood: 'happy', act: { act: 'trip', to: 'tokyo' } },
  { name: null, text: 'eat a croissant', reply: "you know i can't say no 🥐", mood: 'happy', act: { act: 'eat', to: 'croissant' } },
  { name: 'Sam', text: 'make it snow!', reply: 'okay, let it snow ❄️', mood: 'happy', act: { act: 'weather', to: 'snow' } },
  { name: null, text: 'show us heart eyes', reply: 'heart eyes, coming right up 😍', mood: 'love', act: { act: 'lovestruck' } },
  { name: 'Lucía', text: '¿cuál es tu comida favorita?', reply: '¡las fresas! 🍓 son dulces como yo 💜', mood: 'happy', lang: 'es', feel: 'giggle' },
  { name: null, text: 'go to the Moon!', reply: 'the Moon? rocket time! 🚀', mood: 'happy', act: { act: 'trip', to: 'moon' } },
  // (2026-10-09) a question of any length, and her live $AGI chart
  { name: 'Bo', text: 'gm', reply: 'gm gm 💜 coffee first, then chaos.', mood: 'happy' },
  { name: 'Ari', text: 'show us the $AGI chart!', reply: "chart time! let's watch it together 📈 not financial advice.", mood: 'happy', act: { act: 'chart' } },
];
export const DEMO_CHAT = [
  'okay, honest question: is pineapple on pizza a crime? ask me in the chat and convince me 🍕',
  "i love this room. it's like a hug, but it's a room 💜",
  "if you're watching with a snack right now, i respect you.",
  "i've been live for a bit and i'm having the best time. thank you for being here 💜",
  "fun thought: i'm the only girlfriend who's also a stream. very efficient 🙈",
];
// (2026-10-09) --demo's chart: made-up trades, a calm walk over the last 3 hours (the same ones every time), and a new one
// every 2 minutes or so while the show is on, so her chart moves while she watches it
export function demoTrades(startedAt, t = startedAt, { count = 100, every = 108_000 } = {}) {
  const base = startedAt - count * every;
  const n = count + Math.max(0, Math.floor((t - startedAt) / every));
  let seed = 20261009, p = 0.000398;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const out = [];
  for (let i = 0; i < n; i++) {
    const side = rnd() < 0.6 ? 'buy' : 'sell';
    p *= 1 + (rnd() - 0.5) * 0.022 + (side === 'buy' ? 0.0016 : -0.0016);
    out.push({ at: Math.round(base + i * every + rnd() * every * 0.8), side, price: Number(p.toPrecision(6)), usd: Math.round(15 + rnd() * 380) });
  }
  return out.slice(-count);
}
export function demoSite({ every = 50_000, now = Date.now, diary = null, buyEvery = 150_000 } = {}) {
  let n = 0, id = 100, show = 0, chat = 0, buys = 0;
  const startedAt = now();
  const due = () => Math.max(0, Math.min(DEMO_QA.length, Math.floor((now() - startedAt) / every) + 1) - n);
  return {
    base: '(demo)',
    async start() { show += 1; return { ok: true, show }; },
    async beat() { return { ok: true, paused: false, closed: false, end: false, blocked: [], skipped: [], waiting: due() }; },
    async next(_show, can = null) {
      if (due() <= 0) return { none: true };
      const qa = DEMO_QA[n % DEMO_QA.length];
      n += 1;
      id += 1;
      // (what she can't do right now: she says yes anyway in the made-up answer, but nothing happens)
      const ok = qa.act && (!Array.isArray(can) || can.includes(qa.act.act === 'sing' ? `sing:${qa.act.part}` : qa.act.act));
      return { question: { id, name: qa.name, text: qa.text, source: 'web' }, reply: qa.reply, mood: qa.mood, act: ok ? { times: 1, ...qa.act } : null,
        ...(qa.lang ? { lang: qa.lang } : {}), ...(qa.feel ? { feel: qa.feel } : {}) };
    },
    async chat() { const line = DEMO_CHAT[chat++ % DEMO_CHAT.length]; return { reply: line, mood: 'happy' }; },
    async react(_show, r) { return r?.text || r?.kind === 'video' ? { reply: "okay, i love this one. i was so proud of it 💜", mood: 'happy', text: r.text || '' } : { skip: 'empty' }; },
    async market(_show, _since, opts = null) {
      const t = now();
      const k = Math.floor((t - startedAt) / buyEvery);
      const out = { numbers: { mcap: 412_000 + k * 1500, h24: 4.2, liq: 64_000 }, buys: [] };
      if (k > buys) { buys = k; out.buys.push({ id: `demo-${k}`, at: t - 5000, usd: 120 + 35 * k, agi: 290_000 }); }
      if (opts?.chart) out.chart = demoTrades(startedAt, t);
      return out;
    },
    async done() { return { ok: true }; },
    async back() { n = Math.max(0, n - 1); id -= 1; return { ok: true, status: 'waiting' }; },
    async stop() { return { ok: true }; },
    async schedule() { return { ok: true }; },
    async onX() { return { ok: true, told: false }; },
    // (no AI: the stream's own few words for them instead: tools/live/trips.js MEET_FALLBACK)
    async meet() { return { none: true }; },
    async status() { return { ready: true }; },
    async diary() { return diary; },
  };
}
