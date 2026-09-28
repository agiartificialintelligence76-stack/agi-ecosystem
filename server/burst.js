// Small in-memory speed bumps for one server instance (Phase 4 anti-bot check).
// They are NOT the real rules: Vercel runs several copies of a function and they don't share memory. The real rules live
// in the database (one vote per round). These only make hammering an endpoint pointless and cheap for us: a script that
// sends hundreds of requests gets "slow down" answers without calling Cloudflare or the database.

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

// Remembers "this visitor already voted in this round" after the database said so, so repeats don't reach the database.
export function makeRoundMemory({ maxKeys = 20000 } = {}) {
  let round = null;
  const seen = new Set();
  return {
    has(r, who) { return r === round && seen.has(who); },
    add(r, who) {
      if (r !== round) { round = r; seen.clear(); }           // a new round starts with a clean slate
      if (seen.size < maxKeys) seen.add(who);
    },
    reset() { round = null; seen.clear(); },
  };
}

// The Arena's vote endpoint uses these two (api/vote.js). A person votes once per round, so 12 requests a minute is plenty.
export const voteBurst = makeBurstLimit({ max: 12, windowMs: 60_000 });
export const votedThisRound = makeRoundMemory();
// Nominations and votes to add a coin (api/coins.js, Phase 6): a new coin also costs two lookups (clank.trade, DexScreener).
export const coinBurst = makeBurstLimit({ max: 10, windowMs: 60_000 });
// AGI-1's voice (api/voice.js, 2026-09-25): one request per reply, so 20 a minute is plenty.
export const voiceBurst = makeBurstLimit({ max: 20, windowMs: 60_000 });
// ClankChecker (api/checker.js, 2026-09-26): each coin's scan asks clank.trade (and DexScreener, the block explorer), so a
// visitor may start at most 30 a minute (the answers are shared by the CDN anyway). Coin pictures: a list shows 30 at a time
// and each is shared by the CDN for a week, so 240 a minute only stops scripts.
export const checkerBurst = makeBurstLimit({ max: 30, windowMs: 60_000 });
export const pictureBurst = makeBurstLimit({ max: 240, windowMs: 60_000 });
