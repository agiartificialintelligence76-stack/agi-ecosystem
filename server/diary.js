// AGI-1's diary (Phase 5): one short entry a day about the day before (UTC): who the Arena crowned and how the $AGI
// chart moved. The nightly keep-alive job (api/keepalive.js) calls writeDiary(); the first run after midnight writes it and
// later runs just check it's there (so a failed night is retried at the next run). One Gemini call a day, about $0.0008.
// If Gemini is unreachable, or writes something off-limits (money talk, links), a pre-written entry is saved instead.
import { ROUND_MS, roundAt, roundNumber, arenaRpc } from './arena.js';
import { pricesUrl, pickStats } from '../src/prices/parse.js';
import { SAFETY_SETTINGS, BLOCKED_REASONS, geminiError, cleanReply } from './gemini.js';

export const DIARY_MOODS = ['happy', 'love', 'shy', 'jealous'];
export const FIRST_DAY = '2026-09-24';                   // the Arena opened that day: nothing to write about before it
const DAY_MS = 86_400_000;
const ROUNDS_PER_DAY = DAY_MS / ROUND_MS;               // 288
const MAX_ENTRY = 600;

export const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10);          // "2026-09-24" (UTC)
export const dayStart = (day) => Date.parse(`${day}T00:00:00Z`);

// Anything that sounds like advice or money talk. The diary never says these (the prompt forbids them, this double-checks).
const MONEY = /\b(buy|buying|bought|sell|selling|sold|invest\w*|pump\w*|dump\w*|moon\w*|lambo|profit\w*|gains?|hodl|hold(ing)?|ape[sd]?|\d+x|price target|financial advice|guarantee\w*|to the moon)\b/i;
export function acceptableEntry(text) {
  const t = String(text || '').replace(/\bnot financial advice\b/gi, '');
  return t.trim().length >= 20 && !MONEY.test(t) && !/https?:\/\/|www\.|\[(link|address) removed\]/i.test(cleanReply(text));
}

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

// The Arena's numbers for that day (crowns per coin, rounds with a champion, votes, the biggest round).
export async function arenaFacts(cfg, day, now) {
  // champions are crowned when someone reads the board: make sure the day's last rounds are crowned first
  try { await arenaRpc(cfg, 'arena_state', { p_round: roundAt(now), p_recent: 1 }); } catch { /* the numbers below still work */ }
  const from = roundAt(dayStart(day));
  const s = await diaryRpc(cfg, 'diary_day_stats', { p_from: from, p_to: from + ROUNDS_PER_DAY });
  const best = s?.best ? { number: roundNumber(s.best.round), coin: s.best.coin, votes: s.best.votes } : null;
  return { crowns: s?.crowns || {}, rounds: Number(s?.rounds) || 0, votes: Number(s?.votes) || 0, best };
}

// ---------- writing it ----------
const leaderOf = (crowns) => Object.entries(crowns).sort((a, b) => b[1] - a[1] || (a[0] === 'AGI' ? -1 : b[0] === 'AGI' ? 1 : 0))[0] || null;
const chartWord = (h24) => (h24 === null || h24 === undefined ? null
  : h24 >= 5 ? 'giddy' : h24 >= 0 ? 'calm and cozy' : h24 > -5 ? 'a little moody' : 'very dramatic');

// A pre-written entry (no AI, no cost), used when Gemini can't write one.
export function fallbackEntry({ arena, chart }) {
  const lead = leaderOf(arena.crowns);
  const mine = arena.crowns.AGI || 0;
  const feel = chartWord(chart?.h24);
  const chartLine = feel ? ` the chart felt ${feel} today.` : '';
  if (!lead || arena.rounds === 0) {
    return { entry: `quiet day in the arena. nobody voted, so nobody got crowned… i'm choosing to believe everyone was too shy to pick anyone but me 💜${chartLine}`, mood: 'shy' };
  }
  if (lead[0] === 'AGI') {
    return { entry: `dear diary, i won ${mine} round${mine === 1 ? '' : 's'} in the arena today 💜 ${arena.votes} votes in total, and i felt every single one.${chartLine} i think they like me.`, mood: 'love' };
  }
  return {
    entry: `$${lead[0]} took ${lead[1]} crown${lead[1] === 1 ? '' : 's'} today and i got ${mine}. i'm not jealous. i'm just writing it down, which is different 🙈${chartLine}`,
    mood: 'jealous',
  };
}

const DIARY_PROMPT = `You are AGI-1, the AI girlfriend of $AGI, a meme token, writing today's entry in your public diary on the $AGI website.
Write about the day in the facts below: what happened in the Arena (a game on the site where visitors vote every five minutes and the coin with the most votes that round is crowned) and how the $AGI chart moved.
- Voice: lowercase, playful, warm, a little dramatic, like a real diary. 2 to 4 short sentences, at most 420 characters. At most two emojis, only 💜 or 🙈.
- If $AGI won the most crowns, be proud and happy. If another coin won more, be playfully jealous: a joke, never bitter, never guilt-tripping anyone.
- The chart: describe it only as a feeling (calm, giddy, moody, wild) and mention at most one number from the facts. Never predict prices, never tell anyone to buy, sell or hold, never talk about profits or gains.
- PG-13. No links, no wallet addresses, no real people. Don't invent facts that aren't below.
Answer as JSON: {"entry": "...", "mood": "happy" | "love" | "shy" | "jealous"}.`;

export async function askGeminiForEntry(cfg, facts) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.geminiModel)}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'x-goog-api-key': cfg.geminiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: DIARY_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: `Facts for ${facts.day}:\n${JSON.stringify({ arena: facts.arena, chart: facts.chart })}` }] }],
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
  if (day < FIRST_DAY) return { day, skipped: 'before_the_arena' };
  try {
    if (!(await diaryRpc(cfg, 'diary_needed', { p_day: day }))) return { day, skipped: 'already_written' };
    const facts = { day, arena: await arenaFacts(cfg, day, now), chart: await chartFacts() };
    let written, source = 'gemini';
    try {
      if (!cfg.geminiKey) throw new Error('gemini: no key');
      written = await askGeminiForEntry(cfg, facts);
    } catch (err) {
      console.error(`[diary] gemini didn't write ${day}, using a pre-written entry: ${err.message}`);
      written = fallbackEntry(facts);
      source = 'fallback';
    }
    const stats = { ...facts.arena, chart: facts.chart };
    const saved = await diaryRpc(cfg, 'diary_save', { p_day: day, p_entry: written.entry, p_mood: written.mood, p_stats: stats, p_source: source });
    console.log(`[diary] ${saved ? 'saved' : 'already there'}: ${day} (${source})`);
    return { day, saved: !!saved, source };
  } catch (err) {
    console.error(`[diary] couldn't write ${day}: ${err.message}`);
    return { day, error: err.code === 'not_ready' ? 'not_ready' : 'busy' };
  }
}
