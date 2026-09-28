// Her fixed voice lines (2026-09-25): what she says the same way for everyone ("hi, it's me", out of messages, market
// moments), so her natural voice for each one is made once by our server and then kept by Vercel's CDN (api/voice.js):
// no credits after the first time. Each address carries a version: when how she says them changes (as when her voice
// started to follow her mood), the version goes up and everyone hears the new recording at once. The page and the server
// both read this file. 3 since 2026-09-26: her out-of-messages offer names the new numbers (a Crush gets 50 a day).
export const LINE_VERSION = 3;
export const lineUrl = (key) => `/api/voice?line=${encodeURIComponent(key)}&v=${LINE_VERSION}`;
