// Settings for the chat server, read from environment variables
// (Vercel → Project → Settings → Environment Variables). Secrets never have defaults.

// Her speech models, in order (2026-09-26, the owner's choice): Google gives each model its own limits, so when the first
// says "wait" or "used up" the next one speaks that reply. GEMINI_TTS_MODELS = a comma-separated list; else GEMINI_TTS_MODEL
// (or Flash-Lite) first and 3.8 Flash as the backup (same Despina voice, about 1.5x the price).
const MODEL_NAME = /^[a-z0-9][a-z0-9.-]{2,60}$/;
export const BACKUP_VOICE_MODEL = 'gemini-3.8-flash-tts';
function voiceModels(env) {
  const listed = String(env.GEMINI_TTS_MODELS || '').split(',').map((m) => m.trim()).filter((m) => MODEL_NAME.test(m));
  const chosen = listed.length ? listed : [env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-lite-tts', BACKUP_VOICE_MODEL];
  const models = [...new Set(chosen.filter((m) => MODEL_NAME.test(m)))];
  return models.length ? models : ['gemini-3.8-flash-lite-tts', BACKUP_VOICE_MODEL];
}

export function getConfig(env = process.env) {
  const number = (name, fallback) => {
    const n = Number(env[name]);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  const models = voiceModels(env);
  return {
    geminiKey: env.GEMINI_API_KEY || '',
    geminiModel: env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
    supabaseUrl: (env.SUPABASE_URL || '').replace(/\/+$/, ''),
    supabaseKey: env.SUPABASE_SECRET_KEY || '',
    turnstileSecret: env.TURNSTILE_SECRET_KEY || '',
    passSecret: env.PASS_SECRET || '',
    dailyCap: number('CHAT_DAILY_CAP', 1000),      // AGI-1 replies per day for the whole site
    minGapMs: number('CHAT_MIN_GAP_MS', 3000),     // at least 3 seconds between one visitor's messages
    // AGI-1's voice (2026-09-25, api/voice.js): Gemini's speech model, her voice, and how many times a day the whole site
    // may ask it for a reply's voice (2026-09-26: in requests, like Google counts them; 4,000 a day, the owner's choice:
    // each is at most about $0.003 ($0.0045 on the backup model), so about $12 a day at most, $18 if all went to the backup.
    // Google's own limit for the project comes on top: 100 a day per model on Tier 1, more on Tier 2. VOICE_DAILY_CAP, the
    // old cap in characters, isn't used any more)
    voiceModel: models[0],
    voiceModels: models,
    voiceName: env.AGI1_VOICE || 'Despina',
    voiceDailyRequests: number('VOICE_DAILY_REQUESTS', 4000),
    voiceStream: env.VOICE_STREAM !== 'off',      // stream her replies (starts faster); "off" = one whole clip each
    // ClankChecker (2026-09-26): coins whose picture the owner doesn't want on the site (contract addresses, separated by
    // commas); their letter shows instead. Optional
    checkerHidePictures: new Set(String(env.CHECKER_HIDE_PICTURES || '').toLowerCase().split(/[\s,]+/).filter((a) => /^0x[0-9a-f]{40}$/.test(a))),
  };
}

// Names of required settings that are missing (never their values).
export function missingSettings(cfg) {
  const missing = [];
  if (!cfg.geminiKey) missing.push('GEMINI_API_KEY');
  if (!cfg.supabaseUrl) missing.push('SUPABASE_URL');
  if (!cfg.supabaseKey) missing.push('SUPABASE_SECRET_KEY');
  if (!cfg.turnstileSecret) missing.push('TURNSTILE_SECRET_KEY');
  if (cfg.passSecret.length < 32) missing.push('PASS_SECRET (32+ characters)');
  return missing;
}

// The voice needs the same settings as the chat, except Turnstile (its tickets come from a chat that already checked).
export const missingVoiceSettings = (cfg) => missingSettings(cfg).filter((name) => name !== 'TURNSTILE_SECRET_KEY');
