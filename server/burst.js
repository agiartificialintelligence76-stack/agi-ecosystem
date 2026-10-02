// Small in-memory speed bumps for one server instance (Phase 4 anti-bot check).
// They are NOT the real rules: Vercel runs several copies of a function and they don't share memory. The real rules live
// in the database (the chat's and her voice's daily limits). These only make hammering an endpoint pointless and cheap for
// us: a script that sends hundreds of requests gets "slow down" answers without calling Cloudflare, Google or the database.

// "At most `max` requests per `windowMs` for one key" (the key is a visitor code, never an IP).
export function makeBurstLimit({ max, windowMs, maxKeys = 5000 }) {
  const hits = new Map();                                  // key → { n, start }, oldest first
  const allow = (key, now = Date.now()) => {
    let h = hits.get(key);
    if (!h || now - h.start >= windowMs) {
      hits.delete(key);
      if (hits.size >= maxKeys) hits.delete(hits.keys().next().value);   // forget the oldest visitor
      h = { n: 0, start: now };
      hits.set(key, h);
    }
    h.n += 1;
    return h.n <= max;
  };
  allow.reset = () => hits.clear();
  return allow;
}

// (The Arena's votes and nominations had their own until 2026-09-28, when the Arena left the site.)
// AGI-1's voice (api/voice.js, 2026-09-25): one request per reply, so 20 a minute is plenty.
export const voiceBurst = makeBurstLimit({ max: 20, windowMs: 60_000 });
// ClankChecker (api/checker.js, 2026-09-26): each coin's scan asks clank.trade (and DexScreener, the block explorer), so a
// visitor may start at most 30 a minute (the answers are shared by the CDN anyway). Coin pictures: a list shows 30 at a time
// and each is shared by the CDN for a week, so 240 a minute only stops scripts.
export const checkerBurst = makeBurstLimit({ max: 30, windowMs: 60_000 });
export const pictureBurst = makeBurstLimit({ max: 240, windowMs: 60_000 });
// Her Telegram bot (api/telegram.js, 2026-09-29): a person types a few messages a minute at most, so 20 updates a minute per
// chat (keyed by a code of the chat) only stops floods before they reach the database or Telegram.
export const telegramBurst = makeBurstLimit({ max: 20, windowMs: 60_000 });
// "Check my burn" (api/wallet.js, 2026-09-30): each asks the block explorer and the chain, so 10 a minute per visitor
export const burnBurst = makeBurstLimit({ max: 10, windowMs: 60_000 });
// "Launch with AGI-1" (api/launch.js, 2026-10-01): getting a coin ready asks clank.trade, the chain and maybe Pinata, and
// checking a launch asks the chain (the page asks every few seconds while it waits): 40 a minute per visitor. A draft's
// picture comes through our server from Telegram: 60 a minute.
export const launchBurst = makeBurstLimit({ max: 40, windowMs: 60_000 });
export const launchPictureBurst = makeBurstLimit({ max: 60, windowMs: 60_000 });
// Her live show (api/live.js, 2026-10-02): a person sends a question a minute at most (the database's own rule), so 10 tries
// a minute per visitor only stops scripts before the human check; the page asks where its question is now and then (the
// answer is one small database read): 30 a minute; and wrong secrets for the runner's and the owner's actions: 10 a minute
export const liveBurst = makeBurstLimit({ max: 10, windowMs: 60_000 });
export const liveLookupBurst = makeBurstLimit({ max: 30, windowMs: 60_000 });
export const liveAuthBurst = makeBurstLimit({ max: 10, windowMs: 60_000 });
