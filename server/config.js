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

// Her Telegram groups (2026-10-03, the owner: "can i add agi-1 bot to our public tg group"; server/tg-groups.js):
// TELEGRAM_GROUPS, the groups she may be in, separated by commas or spaces: a public group's @username (also "username" or
// "t.me/username") or a group's id (a negative number, e.g. -1001234567890). → null (not set: group mode is off, and she
// ignores groups as before) · { ids, names } (names in lowercase; a setting with nothing usable in it lets her stay in no
// group, so a typo never makes her talk in someone else's)
export function telegramGroups(text) {
  const raw = String(text ?? '').trim();
  if (!raw) return null;
  const ids = new Set(), names = new Set();
  for (const part of raw.split(/[\s,]+/)) {
    const p = part.replace(/^https?:\/\//i, '').replace(/^(?:www\.)?(?:t|telegram)\.me\//i, '').replace(/^@/, '').replace(/\/+$/, '');
    if (/^-\d{5,20}$/.test(p)) ids.add(p);
    else if (/^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(p)) names.add(p.toLowerCase());
  }
  return { ids, names };
}
// "off" (or false, no, 0) switches a part off; anything else, or nothing, leaves it on
const isOff = (v) => /^(?:off|false|no|0)$/i.test(String(v ?? '').trim());

// A wallet's private key, as a setting: 64 hex characters, with or without "0x" → "0x…" (lowercase), or '' (not one)
export function gasKey(text) {
  const m = /^(?:0x)?([0-9a-fA-F]{64})$/.exec(String(text ?? '').trim());
  return m ? `0x${m[1].toLowerCase()}` : '';
}

// An address setting (STUDIO_PAY_TO): "0x" and 40 hex characters → lowercase, or '' (not one)
export function studioAddress(text) {
  const t = String(text ?? '').trim();
  return /^0x[0-9a-fA-F]{40}$/.test(t) && !/^0x0{40}$/.test(t) ? t.toLowerCase() : '';
}
// A whole number setting that may be 0 (STUDIO_BURNS_A_MONTH=0: no burns), else the fallback
const wholeOrZero = (text, fallback) => (/^\d{1,6}$/.test(String(text ?? '').trim()) ? Number(String(text).trim()) : fallback);
// The studio's video model on fal.ai (STUDIO_VIDEO_MODEL): "owner/name[/path…]" in lowercase, else Seedance 2.5's
// reference-to-video (server/fal.js)
export const falModel = (text) => {
  const t = String(text ?? '').trim();
  return /^[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*){1,3}$/.test(t) ? t : 'bytedance/seedance-2.5/reference-to-video';
};

export function getConfig(env = process.env) {
  const number = (name, fallback) => {
    const n = Number(env[name]);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  const models = voiceModels(env);
  const studioOnlyFor = new Set(String(env.STUDIO_ONLY_FOR || '').toLowerCase().split(/[\s,]+/).filter((a) => /^0x[0-9a-f]{40}$/.test(a)));
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
    // …and her Telegram groups (2026-10-03, server/tg-groups.js): the groups she may be in (telegramGroups() above; not
    // set = group mode off), her replies a day in each (inside Telegram's share), and whether she posts her diary and
    // $AGI's market moments there and welcomes people who join ("off" = no)
    tgGroups: telegramGroups(env.TELEGRAM_GROUPS),
    tgGroupDailyCap: Math.min(2000, Math.floor(number('TELEGRAM_GROUP_DAILY_CAP', 100)) || 100),
    tgGroupPosts: !isOff(env.TELEGRAM_GROUP_POSTS),
    tgGroupWelcome: !isOff(env.TELEGRAM_GROUP_WELCOME),
    // …and the $AGI buy bot there (2026-10-06, server/buys.js): on unless "off", and the smallest buy it posts, in
    // dollars (50 by default, the owner's: "can you make the minimum to 50$"; $100 at first)
    tgBuys: !isOff(env.TELEGRAM_BUYS),
    tgBuyMin: Math.min(1_000_000, number('TELEGRAM_BUY_MIN', 50)),
    // …and her games there (2026-10-09, server/games.js): on unless "off" (and only once supabase/games.sql has set up their
    // clock), about how many a day in each group (10, the owner's: "About 10 a day"), the prize in whole $AGI (250, the
    // owner's) and the prizes the whole site gives a day (10, the owner's), and the private key of the prize wallet that
    // sends them (secret; a wallet made only for this, holding only the $AGI for prizes and a little ETH: never the launch
    // gas wallet). Without the key, or with the gas wallet's, her games are just for fun.
    tgGames: !isOff(env.TELEGRAM_GAMES),
    gamesADay: Math.min(48, Math.max(1, Math.floor(number('GAMES_A_DAY', 10)))),
    gamePrize: Math.min(1_000_000, Math.floor(number('GAME_PRIZE', 250)) || 250),
    gameWinsADay: Math.min(1000, Math.floor(number('GAME_WINS_A_DAY', 10)) || 10),
    prizeKey: gasKey(env.PRIZE_WALLET_KEY),
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
    // AGI-1's 3D character studio (2026-10-10, server/studio.js): Meshy's API key (secret, "msy_…": without it the studio is
    // off), the owner's wallet that USDG payments go to (an address, not a secret: without it only burns and a Soulmate's free
    // one), the prices for a Stranger (5 USDG or 15,000 $AGI burned: src/studio/rules.js gives Crush 20% off and Soulmate
    // 40% off), the characters a month for the whole site (15: each costs the owner about 59 of Meshy's credits) and of them
    // paid by burning (5: a burn pays nobody), who may make one (STUDIO_OPEN=yes: everyone; else only the wallets in
    // STUDIO_ONLY_FOR), and characters the owner hides (their ids)
    meshyKey: String(env.MESHY_API_KEY || '').trim(),
    studioPayTo: studioAddress(env.STUDIO_PAY_TO),
    studioUsdCents: Math.max(50, Math.round(Math.min(10_000, number('STUDIO_PRICE_USD', 5)) * 100)),
    studioAgi: Math.max(100, Math.min(1e9, Math.floor(number('STUDIO_PRICE_AGI', 15_000)) || 15_000)),
    studioMonthCap: Math.min(100_000, Math.floor(number('STUDIO_A_MONTH', 15)) || 15),
    studioBurnCap: Math.min(100_000, wholeOrZero(env.STUDIO_BURNS_A_MONTH, 5)),
    studioOpen: /^(?:yes|on|true|1)$/i.test(String(env.STUDIO_OPEN ?? '').trim()),
    studioOnlyFor,
    studioHide: new Set(String(env.STUDIO_HIDE || '').split(/[\s,]+/).filter((a) => /^[A-Za-z0-9_-]{22}$/.test(a))),
    // …and its characters' videos (2026-10-10, server/studio-video.js): fal.ai's key (secret, "<id>:<secret>": without it, no
    // videos), the video model on fal (Seedance 2.5's reference-to-video; another one must take the same inputs), a video's
    // price in USDG for a Stranger (4: Crush 20% off, Soulmate 40% off, like a character), and the videos a month for the
    // whole site (30: each costs the owner about $2.40 at fal)
    falKey: String(env.FAL_KEY || '').trim(),
    videoModel: falModel(env.STUDIO_VIDEO_MODEL),
    videoUsdCents: Math.max(100, Math.round(Math.min(10_000, number('STUDIO_VIDEO_PRICE_USD', 4)) * 100)),
    videoMonthCap: Math.min(100_000, Math.floor(number('STUDIO_VIDEOS_A_MONTH', 30)) || 30),
    // …and AGI Studio, the AI influencer app (2026-10-10, studio.agi1.app: server/influencer.js; on once FAL_KEY is set): the
    // owner's wallet for its owner's page (trend moves, reports: STUDIO_OWNER, else the first wallet in STUDIO_ONLY_FOR), the
    // free credits the whole site gives holders a month (5,000 = $50 of AI costs at most; 0 = none), the AI jobs a day for the
    // whole site (2,000: each paid in credits, a guard against a runaway), and "Use my face" ("off" = no AI twins)
    studioOwner: studioAddress(env.STUDIO_OWNER) || [...studioOnlyFor][0] || '',
    infFreeCap: Math.min(10_000_000, wholeOrZero(env.STUDIO_FREE_CREDITS_A_MONTH, 5000)),
    infDayCap: Math.min(100_000, Math.floor(number('STUDIO_JOBS_A_DAY', 2000)) || 2000),
    infFaces: !isOff(env.STUDIO_FACES),
    // Her live show (2026-10-02, server/live.js): the secret her stream runner (on the owner's own server) and our server
    // share (32+ characters); the owner's phone link is made from it. Without it, agi1.app/live says her show is coming soon
    liveSecret: String(env.LIVE_SECRET || '').trim(),
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
