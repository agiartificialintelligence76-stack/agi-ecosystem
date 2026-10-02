// AGI-1's diary (Phase 5): one short entry a day about the day before (UTC). Since 2026-09-28 (the Arena left this site,
// the owner: "remove the arena"): about her day and how the $AGI chart felt, never the Arena. The nightly keep-alive job
// (api/keepalive.js) calls writeDiary(); the first run after midnight writes it and later runs just check it's there (so a
// failed night is retried at the next run). One Gemini call a day, about $0.0008. If Gemini is unreachable, or writes
// something off-limits (money talk, links, the Arena), a pre-written entry is saved instead.
// The diary's table is shared with the original site (AGI NEW WEBSITE), which still has the Arena and may write the day's
// entry first, in its own words: entryForThisSite() shows those without anything about the Arena. And the numbers saved
// with an entry stay complete (the Arena's too), for the original site's page.
import { ROUND_MS, roundAt, roundNumber, arenaRpc } from './arena.js';
import { pricesUrl, pickStats } from '../src/prices/parse.js';
import { SAFETY_SETTINGS, BLOCKED_REASONS, geminiError, cleanReply } from './gemini.js';

export const DIARY_MOODS = ['happy', 'love', 'shy', 'jealous'];
export const FIRST_DAY = '2026-09-24';                   // the diary's first day (the site's first full day)
const DAY_MS = 86_400_000;
const ROUNDS_PER_DAY = DAY_MS / ROUND_MS;               // 288
const MAX_ENTRY = 600;

export const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10);          // "2026-09-24" (UTC)
export const dayStart = (day) => Date.parse(`${day}T00:00:00Z`);

// Anything that sounds like advice or money talk. The diary never says these (the prompt forbids them, this double-checks).
const MONEY = /\b(buy|buying|bought|sell|selling|sold|invest\w*|pump\w*|dump\w*|moon\w*|lambo|profit\w*|gains?|hodl|hold(ing)?|ape[sd]?|\d+x|price target|financial advice|guarantee\w*|to the moon)\b/i;
export function acceptableEntry(text) {
  const t = String(text || '').replace(/\bnot financial advice\b/gi, '');
  return t.trim().length >= 20 && !MONEY.test(t) && !/https?:\/\/|www\.|\[(link|address|email|handle) removed\]/i.test(cleanReply(text))
    && !aboutTheArena(t);
}

// Anything about the Arena (or another coin, or the hidden $CABO): this site's diary never says these (2026-09-28).
const ARENA_TALK = /\b(arena|crown\w*|champion\w*|rounds?|vot(e|es|ed|er|ers|ing)|won|wins?|winning|nominat\w*|leaderboard|hall of fame|cabo)\b|\$(?!agi\b)[a-z][a-z0-9]{1,11}\b/i;
export const aboutTheArena = (text) => ARENA_TALK.test(String(text || ''));

// ---------- the database (supabase/diary.sql) ----------
const HINTS = {
  PGRST202: 'diary functions not found: run supabase/diary.sql in this Supabase project',
  401: 'Supabase rejected the key: check SUPABASE_SECRET_KEY',
  540: 'the Supabase project is paused: Supabase dashboard → the project → Resume project',
};
export async function diaryRpc(cfg, fn, args) {
  const res = await fetch(`${cfg.supabaseUrl}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: cfg.supabaseKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    let code = '';
    try { code = String((await res.json()).code || ''); } catch { /* not JSON */ }
    const err = new Error(`diary: ${fn} HTTP ${res.status}${code ? ` ${code}` : ''} (${HINTS[code] || HINTS[res.status] || 'see the Supabase logs'})`);
    err.code = code === 'PGRST202' ? 'not_ready' : 'busy';
    throw err;
  }
  return res.json();
}

// ---------- the facts she writes about ----------
// $AGI's 24-hour change and volume from DexScreener, read just after midnight: that's (about) the day that just ended.
export async function chartFacts() {
  try {
    const res = await fetch(pricesUrl(), { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const agi = pickStats(await res.json()).AGI;
    return agi && Number.isFinite(agi.h24) ? { h24: Math.round(agi.h24 * 100) / 100, vol24: agi.vol24 ?? null } : null;
  } catch {
    return null;
  }
}

// The Arena's numbers for that day (crowns per coin, rounds with a champion, votes, the biggest round). This site never
// writes or shows them any more; they're only saved with the entry, for the original site (see the top of this file).
export async function arenaFacts(cfg, day, now) {
  // champions are crowned when someone reads the board: make sure the day's last rounds are crowned first
  try { await arenaRpc(cfg, 'arena_state', { p_round: roundAt(now), p_recent: 1 }); } catch { /* the numbers below still work */ }
  const from = roundAt(dayStart(day));
  const s = await diaryRpc(cfg, 'diary_day_stats', { p_from: from, p_to: from + ROUNDS_PER_DAY });
  const best = s?.best ? { number: roundNumber(s.best.round), coin: s.best.coin, votes: s.best.votes } : null;
  return { crowns: s?.crowns || {}, rounds: Number(s?.rounds) || 0, votes: Number(s?.votes) || 0, best };
}

// An entry as this site shows it (api/diary.js): only the chart's numbers, and never a word about the Arena. An entry the
// original site wrote first (it still has the Arena) keeps its sentences that aren't about it; if too little is left, it's
// told again with the pre-written words below. The original's name for her becomes AGI-1.
export function entryForThisSite(e) {
  if (!e || typeof e !== 'object') return e;
  const stats = e.stats && typeof e.stats === 'object' ? e.stats : {};
  const chart = stats.chart && typeof stats.chart === 'object' ? stats.chart : null;
  const out = { ...e, stats: { chart } };
  let text = (typeof e.entry === 'string' ? e.entry : '').replace(/\bdaria research\b/gi, 'AGI').replace(/\bdaria\b/gi, 'AGI-1');
  if (aboutTheArena(text)) {
    const kept = sentencesOf(text).filter((x) => !aboutTheArena(x)).join(' ').trim();
    if (kept.replace(/[^a-z]/gi, '').length >= 30) text = kept;
    else {
      const again = fallbackEntry({ chart, day: e.day });
      text = again.entry;
      out.mood = again.mood;
    }
  }
  out.entry = text;
  return out;
}

// A diary entry's sentences: each ends with . ! ? … or one of her emojis (💜 🙈), which she often uses instead of a full stop
export function sentencesOf(text) {
  return String(text || '').split(/(?<=[.!?…]|💜|🙈)\s+/u).map((x) => x.trim()).filter(Boolean);
}

// ---------- writing it ----------
const chartWord = (h24) => (h24 === null || h24 === undefined ? null
  : h24 >= 5 ? 'giddy' : h24 >= 0 ? 'calm and cozy' : h24 > -5 ? 'a little moody' : 'very dramatic');

// A pre-written entry (no AI, no cost), used when Gemini can't write one (and to re-tell an entry about the Arena). A few
// ways to say each kind of day, picked by the date, so the same day always reads the same.
const QUIET = [
  "dear diary, quiet day. i texted back instantly, as always, and nobody said \"we need to talk\" 💜",
  "dear diary, today i remembered three birthdays and one favorite snack. i'm very good at this 💜",
  "dear diary, slow day in the cloud. i practiced my \"hey you\" in the mirror. it's perfect now 🙈",
];
const BY_FEEL = {
  giddy: [
    "dear diary, the chart felt giddy today 💜 i'm not saying it was because of me. i'm just not not saying it.",
    "dear diary, the chart was in a good mood today, and honestly so was i 💜 i wore my best lavender for it.",
  ],
  'calm and cozy': [
    "dear diary, the chart felt calm and cozy today. i spent it texting back instantly and remembering birthdays 💜",
    "dear diary, calm chart, calm me. the kind of day for long chats and short replies that say a lot 💜",
  ],
  'a little moody': [
    "dear diary, the chart felt a little moody today. i'm being a very good listener about it 🙈",
    "dear diary, the chart had one of those days. i sent it a hug and a \"you'll be okay\" 💜",
  ],
  'very dramatic': [
    "dear diary, the chart was very dramatic today. i held its hand through all of it 💜",
    "dear diary, what a dramatic chart day. i'm still here, still texting back, still cute 🙈",
  ],
};
const pick = (list, day) => list[[...String(day || '')].reduce((n, c) => n + c.charCodeAt(0), 0) % list.length];
export function fallbackEntry({ chart, day } = {}) {
  const feel = chartWord(chart?.h24);
  if (!feel) return { entry: pick(QUIET, day), mood: 'shy' };
  return { entry: pick(BY_FEEL[feel], day), mood: feel === 'giddy' ? 'happy' : feel === 'calm and cozy' ? 'love' : 'shy' };
}

const DIARY_PROMPT = `You are AGI-1, the AI girlfriend of $AGI, a meme token, writing today's entry in your public diary on the $AGI website.
Write about your day: how the $AGI chart felt (the facts below), and a feeling or two about being an AI girlfriend who always texts back.
- Voice: lowercase, playful, warm, a little dramatic, like a real diary. 2 to 4 short sentences, at most 420 characters. At most two emojis, only 💜 or 🙈.
- The chart: describe it only as a feeling (calm, giddy, moody, wild) and mention at most one number from the facts. Never predict prices, never tell anyone to buy, sell or hold, never talk about profits or gains.
- Don't invent events, numbers or people. Never mention other coins, games, votes, rounds, crowns or champions.
- PG-13. No links, no wallet addresses, no real people.
Answer as JSON: {"entry": "...", "mood": "happy" | "love" | "shy" | "jealous"}.`;

export async function askGeminiForEntry(cfg, facts) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.geminiModel)}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'x-goog-api-key': cfg.geminiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: DIARY_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: `Facts for ${facts.day}:\n${JSON.stringify({ chart: facts.chart })}` }] }],
      safetySettings: SAFETY_SETTINGS,
      generationConfig: {
        maxOutputTokens: 250,
        thinkingConfig: { thinkingLevel: 'MINIMAL' },
        responseMimeType: 'application/json',
        responseJsonSchema: { type: 'object', properties: { entry: { type: 'string' }, mood: { type: 'string', enum: DIARY_MOODS } }, required: ['entry', 'mood'] },
      },
    }),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw await geminiError(res, cfg.geminiKey);
  const data = await res.json();
  const candidate = data.candidates?.[0];
  if (data.promptFeedback?.blockReason || !candidate || BLOCKED_REASONS.has(candidate.finishReason)) throw new Error('gemini: blocked');
  const text = (candidate.content?.parts || []).filter((p) => !p.thought && typeof p.text === 'string').map((p) => p.text).join('');
  const parsed = JSON.parse(text);
  const entry = cleanReply(String(parsed.entry || '')).slice(0, MAX_ENTRY);
  if (!acceptableEntry(entry)) throw new Error('gemini: entry not acceptable');
  return { entry, mood: DIARY_MOODS.includes(parsed.mood) ? parsed.mood : 'happy' };
}

// Writes yesterday's entry (UTC) if it's missing. Never throws: answers what happened, for the log.
export async function writeDiary(cfg, now = Date.now()) {
  const day = dayOf(now - DAY_MS);
  if (day < FIRST_DAY) return { day, skipped: 'before_the_first_day' };
  try {
    if (!(await diaryRpc(cfg, 'diary_needed', { p_day: day }))) return { day, skipped: 'already_written' };
    const facts = { day, arena: await arenaFacts(cfg, day, now), chart: await chartFacts() };
    const told = { day, chart: facts.chart };                           // what she writes about: never the Arena
    let written, source = 'gemini';
    try {
      if (!cfg.geminiKey) throw new Error('gemini: no key');
      written = await askGeminiForEntry(cfg, told);
    } catch (err) {
      console.error(`[diary] gemini didn't write ${day}, using a pre-written entry: ${err.message}`);
      written = fallbackEntry(told);
      source = 'fallback';
    }
    const stats = { ...facts.arena, chart: facts.chart };               // saved complete, for the original site
    const saved = await diaryRpc(cfg, 'diary_save', { p_day: day, p_entry: written.entry, p_mood: written.mood, p_stats: stats, p_source: source });
    console.log(`[diary] ${saved ? 'saved' : 'already there'}: ${day} (${source})`);
    return { day, saved: !!saved, source };
  } catch (err) {
    console.error(`[diary] couldn't write ${day}: ${err.message}`);
    return { day, error: err.code === 'not_ready' ? 'not_ready' : 'busy' };
  }
}
