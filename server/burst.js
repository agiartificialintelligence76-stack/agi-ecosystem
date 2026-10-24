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
// …in her Telegram groups (2026-10-03, server/tg-groups.js), only for messages meant for her: 4 a minute per person (one
// person can't fill the group with her answers) and 15 a minute per group (Telegram lets a bot send about 20 a minute there)
export const groupPersonBurst = makeBurstLimit({ max: 4, windowMs: 60_000 });
export const groupBurst = makeBurstLimit({ max: 15, windowMs: 60_000 });
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
// (2026-10-07) her stream's AI lines between questions (something new to say, her reactions to her own posts and videos):
// her stream asks about one a minute; 12 a minute per server copy at most, whatever happens, keeps the AI's cost bounded
export const liveLineBurst = makeBurstLimit({ max: 12, windowMs: 60_000 });
// CloakMesh's waitlist (api/cloakmesh.js, 2026-10-03): a person joins once (or fixes a typo), so 10 tries a minute per
// visitor only stops scripts before the human check and the database; leaving with a link: the same
export const waitlistBurst = makeBurstLimit({ max: 10, windowMs: 60_000 });
// AGI games (api/wallet.js, 2026-10-19): a game tells our server its runs at most once a minute (and when its page is
// closed or hidden), so 30 reports a minute per visitor only stops scripts (the database counts the rest); and its reviews,
// a few taps a minute at most (the page asks for a wallet's own review once, and saving is the human check and 10 a day
// per wallet): 20 a minute per visitor
export const arcadePlayBurst = makeBurstLimit({ max: 30, windowMs: 60_000 });
export const reviewBurst = makeBurstLimit({ max: 20, windowMs: 60_000 });
// (2026-10-22) their leaderboards: a ranked run asks for a ticket as it starts and sends its score as it ends (a
// TRENCHING SIMULATOR score is the run made again here, about a second), and the page asks for a player's places now and
// then: 12 a minute per visitor
export const scoreBurst = makeBurstLimit({ max: 12, windowMs: 60_000 });
// Community votes (api/wallet.js, 2026-10-24): each vote and each "my votes" reads the chain once, and a person taps a few
// times a minute at most: 20 a minute per visitor
export const voteBurst = makeBurstLimit({ max: 20, windowMs: 60_000 });
