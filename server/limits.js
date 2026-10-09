// Message limits, counted in the Supabase database by chat_take() (see supabase/chat-limits.sql), and AGI-1's voice
// limits by voice_take() (supabase/voice.sql, 2026-09-25).
// The secret key goes in the `apikey` header only. It is not a JWT, so it must NOT go in `Authorization`.
import { levelInfo } from '../src/lib/levels.js';

const ANSWERS = ['ok', 'too_fast', 'person_cap', 'global_cap'];
const VOICE_ANSWERS = ['ok', 'used', 'person_cap', 'global_cap'];

// What a failed answer from Supabase most likely means, so the server log (never shown to visitors) says what to fix.
const HINTS = {
  401: 'Supabase rejected the key: check SUPABASE_SECRET_KEY (sb_secret_…) is from the same project as SUPABASE_URL',
  403: 'no permission: SUPABASE_SECRET_KEY must be a secret key (sb_secret_…), not a publishable one',
  540: 'the Supabase project is paused (free projects pause after about a week of low activity): Supabase dashboard → the project → Resume project',
  html: 'not a Supabase API address: SUPABASE_URL must look like https://abcd1234.supabase.co',
};
const MISSING = {
  chat_take: 'chat_take not found: run supabase/chat-limits.sql in this Supabase project',
  voice_take: 'voice_take not found: run supabase/voice.sql in this Supabase project',
  voice_line_get: 'voice_line_get not found: run supabase/voice-lines.sql in this Supabase project',
  voice_line_put: 'voice_line_put not found: run supabase/voice-lines.sql in this Supabase project',
};
// her Telegram bot and its feed (2026-09-29): supabase/telegram.sql
for (const fn of ['tg_get', 'tg_join', 'tg_set', 'tg_forget', 'tg_due', 'tg_claim', 'tg_mark', 'tg_take', 'feed_add', 'feed_recent', 'feed_state_get', 'feed_state_put']) {
  MISSING[fn] = `${fn} not found: run supabase/telegram.sql in this Supabase project`;
}
// …and her Telegram groups (2026-10-03, server/tg-groups.js): added to the same file, so it's run once more
for (const fn of ['tg_group_take', 'tg_group_welcome']) {
  MISSING[fn] = `${fn} not found: run supabase/telegram.sql again in this Supabase project (it ends with telegram_functions_found = 14)`;
}
// messages paid for by burning $AGI (2026-09-30): supabase/burns.sql
for (const fn of ['burn_claim', 'burn_take', 'burn_refund', 'burn_status', 'burn_total', 'burn_seen']) {
  MISSING[fn] = `${fn} not found: run supabase/burns.sql in this Supabase project`;
}
// "Launch with AGI-1" (2026-10-01): supabase/launch.sql
for (const fn of ['launch_draft_put', 'launch_draft_get', 'launch_prepare', 'launch_upload_back', 'launch_set_cid', 'launch_predicted',
  'launch_done', 'launch_gas_claim', 'launch_gas_sending', 'launch_gas_sent', 'launch_tidy', 'launch_unpinned']) {
  MISSING[fn] = `${fn} not found: run supabase/launch.sql in this Supabase project`;
}

// her live show (2026-10-02): supabase/live.sql
for (const fn of ['live_ask', 'live_lookup', 'live_start', 'live_beat', 'live_stop', 'live_schedule', 'live_take', 'live_done',
  'live_state_get', 'live_control', 'live_tidy']) {
  MISSING[fn] = `${fn} not found: run supabase/live.sql in this Supabase project`;
}

// the $AGI buy bot (2026-10-06): supabase/buys.sql
for (const fn of ['buy_key', 'buy_take']) {
  MISSING[fn] = `${fn} not found: run supabase/buys.sql in this Supabase project (it ends with buys_ready = 1)`;
}

// her quizzes in her Telegram groups and their prizes (2026-10-09): supabase/games.sql
for (const fn of ['game_key', 'game_due', 'game_left', 'game_recent', 'game_open', 'game_answer', 'game_settle', 'game_unsettled',
  'game_pending', 'game_address', 'game_claim', 'game_sending', 'game_sent', 'game_tidy']) {
  MISSING[fn] = `${fn} not found: run supabase/games.sql in this Supabase project (it ends with games_ready = 1)`;
}

// AGI-1's 3D character studio (2026-10-10): supabase/studio.sql
for (const fn of ['studio_key', 'studio_quote', 'studio_choose', 'studio_pay', 'studio_seen', 'studio_get', 'studio_lease', 'studio_step',
  'studio_wait', 'studio_done', 'studio_fail', 'studio_redo', 'studio_due', 'studio_month', 'studio_free_used', 'studio_list', 'studio_mine',
  'studio_tidy']) {
  MISSING[fn] = `${fn} not found: run supabase/studio.sql in this Supabase project (it ends with studio_ready = 1)`;
}
// …and its characters' videos (2026-10-10): the same file, run again if it was run before them
for (const fn of ['studio_video_quote', 'studio_video_pay', 'studio_video_get', 'studio_video_lease', 'studio_video_step', 'studio_video_wait',
  'studio_video_done', 'studio_video_fail', 'studio_video_redo', 'studio_video_due', 'studio_video_list', 'studio_video_hide']) {
  MISSING[fn] = `${fn} not found: run supabase/studio.sql again in this Supabase project (its characters' videos; it ends with studio_ready = 1)`;
}

// CloakMesh's waitlist (inference.agi1.app, 2026-10-03): supabase/cloakmesh.sql
for (const fn of ['cloakmesh_ready', 'cloakmesh_join', 'cloakmesh_leave']) {
  MISSING[fn] = `${fn} not found: run supabase/cloakmesh.sql in this Supabase project`;
}

// One database function call (also used by server/voice-store.js for her recorded lines).
export async function rpc(cfg, fn, args, label) {
  const res = await fetch(`${cfg.supabaseUrl}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: cfg.supabaseKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) {
    // Supabase explains errors as JSON {code, message}. Some status codes explain themselves (540 = project paused).
    // Anything else that isn't JSON (e.g. a web page) means a wrong address.
    let code = '', hint = HINTS[res.status] || '';
    try {
      const err = await res.json();
      code = String(err.code || '').slice(0, 20);
      hint = (code === 'PGRST202' && MISSING[fn]) || hint || String(err.message || '').slice(0, 120);
    } catch {
      hint ||= HINTS.html;
    }
    const error = new Error(`${label}: HTTP ${res.status}${code ? ` ${code}` : ''} (${hint})`);
    error.code = code;                                  // PGRST202 = the function isn't there (its SQL file wasn't run)
    throw error;
  }
  return res.json();
}

// daily = this visitor's messages per day (it depends on their relationship level, src/lib/levels.js)
export async function takeChatSlot(cfg, who, daily) {
  const answer = await rpc(cfg, 'chat_take',
    { p_who: who, p_person_daily: daily, p_global_daily: cfg.dailyCap, p_min_gap_ms: cfg.minGapMs }, 'limits');
  if (!ANSWERS.includes(answer)) throw new Error('limits: unexpected answer');
  return answer;
}

// AGI-1's voice (2026-09-26: counted in requests, like Google counts them). Each time the page asks for a reply's voice is
// one request to Google's speech model. The whole site may ask cfg.voiceDailyRequests times a day (VOICE_DAILY_REQUESTS,
// default 5,000 since 2026-09-30, the owner's choice; 4,000 before): the money limit, since each request is at most 20
// seconds of her voice, about $0.003 ($0.0045 on the backup model), so at most about $15 a day ($22.50 if all on the backup;
// double from January 2027). Google's own limit for the
// project (Google AI Studio → Rate limit: 100 a day per model on Tier 1) comes on top; when it's used up, api/voice.js
// backs off. A visitor's own daily share follows their messages a day (2026-09-25,
// the owner's question "is it better if the voice matches the number of their messages?": yes): each reply's ticket may be
// used twice (one retry), so 2 requests per message a day: every reply she may write, she may also say. One atomic step
// in the database (voice_take(), supabase/voice.sql; its "units" are requests now: 1 each).
export const VOICE_TICKET_USES = 2;
export const voicePerDay = (level) => VOICE_TICKET_USES * levelInfo(level).daily;
export async function takeVoiceSlot(cfg, who, ticket, personDaily = voicePerDay(1)) {
  const answer = await rpc(cfg, 'voice_take', {
    p_who: who, p_ticket: ticket, p_units: 1,
    p_person_daily: personDaily, p_global_daily: cfg.voiceDailyRequests, p_ticket_max: VOICE_TICKET_USES,
  }, 'voice limits');
  if (!VOICE_ANSWERS.includes(answer)) throw new Error('voice limits: unexpected answer');
  return answer;
}
