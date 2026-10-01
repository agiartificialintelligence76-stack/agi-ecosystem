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

// "0.001" (ETH) → wei, as a BigInt; anything else (empty, negative, more than 18 decimals) → the fallback
export function ethToWei(text, fallback) {
  const m = /^(\d{1,6})(?:\.(\d{1,18}))?$/.exec(String(text ?? '').trim());
  if (!m) return fallback;
  const wei = BigInt(m[1]) * 10n ** 18n + BigInt((m[2] || '').padEnd(18, '0'));
  return wei > 0n ? wei : fallback;
}

// "Launch with AGI-1" in private (2026-10-01, the owner: "id like to be my first launch to be private"): LAUNCH_ONLY_FOR,
// Telegram usernames (with or without @) or numeric Telegram ids, separated by commas. → null (not set: launching is for
// everyone once it's set up) · { ids, names } (set: only they may launch; a setting with nothing usable in it lets nobody in,
// so a typo never opens it to everyone)
export function launchTesters(text) {
  const raw = String(text ?? '').trim();
  if (!raw) return null;
  const ids = new Set(), names = new Set();
  for (const part of raw.split(/[\s,]+/)) {
    const p = part.replace(/^@/, '');
    if (/^\d{1,20}$/.test(p)) ids.add(p);
    else if (/^[A-Za-z0-9_]{3,32}$/.test(p)) names.add(p.toLowerCase());
  }
  return { ids, names };
}

// A wallet's private key, as a setting: 64 hex characters, with or without "0x" → "0x…" (lowercase), or '' (not one)
export function gasKey(text) {
  const m = /^(?:0x)?([0-9a-fA-F]{64})$/.exec(String(text ?? '').trim());
  return m ? `0x${m[1].toLowerCase()}` : '';
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
    // may ask it for a reply's voice (2026-09-26: in requests, like Google counts them; 5,000 a day since 2026-09-30, the
    // owner's choice (4,000 before): each is at most about $0.003 ($0.0045 on the backup model), so about $15 a day at most,
    // $22.50 if all went to the backup, double from January 2027.
    // Google's own limit for the project comes on top: 100 a day per model on Tier 1, more on Tier 2. VOICE_DAILY_CAP, the
    // old cap in characters, isn't used any more)
    voiceModel: models[0],
    voiceModels: models,
    voiceName: env.AGI1_VOICE || 'Despina',
    voiceDailyRequests: number('VOICE_DAILY_REQUESTS', 5000),
    voiceStream: env.VOICE_STREAM !== 'off',      // stream her replies (starts faster); "off" = one whole clip each
    // Her Telegram bot (2026-09-29): Telegram's share of the day's AI replies (inside the site's CHAT_DAILY_CAP), so
    // Telegram alone can't use up the website's chat
    telegramDailyCap: number('TELEGRAM_DAILY_CAP', 400),
    // Messages paid for by burning $AGI (2026-09-30, server/burn.js): whole $AGI a message (10 by default: 1,000 $AGI =
    // 100 messages), and the burned messages the whole site may use a day, on top of the free ones (1,000: about $0.80 of
    // AI replies at most)
    burnPrice: Math.min(1e9, Math.floor(number('BURN_PER_MESSAGE', 10)) || 10),
    burnDailyCap: Math.floor(number('BURN_DAILY_CAP', 1000)) || 1000,
    // "Launch with AGI-1" (2026-10-01, server/launch.js): the owner's Pinata key (a JWT, secret: it puts each coin's
    // picture on IPFS), and the pictures the whole site may upload a day (Pinata's free plan holds 500 files)
    pinataJwt: String(env.PINATA_JWT || '').trim(),
    launchDailyCap: Math.floor(number('LAUNCH_DAILY_CAP', 30)) || 30,
    // while it's set, only these Telegram accounts may launch (the owner's private first launch): launchTesters() above
    launchTesters: launchTesters(env.LAUNCH_ONLY_FOR),
    // …and paying each launch's network fee back (the owner's choice): the private key of the owner's small gas wallet on
    // Robinhood Chain (secret; a wallet made only for this, holding a little ETH), the most paid back for one launch and
    // in a day for the whole site, in ETH. Without the key, no fee is paid back. (With or without its "0x": MetaMask's "Show
    // private key" leaves it out.)
    launchGasKey: gasKey(env.LAUNCH_GAS_KEY),
    launchGasMaxWei: ethToWei(env.LAUNCH_GAS_MAX, 10n ** 15n),          // 0.001 ETH
    launchGasDailyWei: ethToWei(env.LAUNCH_GAS_DAILY, 10n ** 16n),      // 0.01 ETH
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
