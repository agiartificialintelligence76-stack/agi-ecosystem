// What's left of the Arena on this site's server. The Arena itself (voting, the leaderboard, nominations, the champion) left
// agi1.app on 2026-09-28 (the owner: "remove the arena"). The database is shared with the original site (AGI NEW WEBSITE),
// which still runs it, so two small things stay here:
//   · the rounds and one database call, for the diary: the numbers saved with each day's entry stay complete for the
//     original site's page (server/diary.js), although this site never shows or writes about them;
//   · the coins this site never shows ($CABO), for ClankChecker (api/checker.js).

export const ROUND_MS = 5 * 60_000;                                // one round = 5 minutes
export const roundAt = (ms = Date.now()) => Math.floor(ms / ROUND_MS);
// Friendly round numbers: round #1 started when the Arena opened.
export const OPENED = roundAt(Date.UTC(2026, 8, 24));
export const roundNumber = (round) => round - OPENED + 1;

// Coins this site never shows (2026-09-28, the owner: "remove everything about cabo"). The shared database still lists
// $CABO for the original site, so it stays there untouched: this site leaves it out instead.
export const HIDDEN_COINS = new Set(['CABO']);
export const HIDDEN_ADDRESSES = new Set(['0xcf5b720f33febdc1c9d4880b8317203b63fdf368']);
export const isHiddenCoin = (symbol, address = '') =>
  HIDDEN_COINS.has(String(symbol ?? '').toUpperCase()) || HIDDEN_ADDRESSES.has(String(address ?? '').toLowerCase());

const HINTS = {
  PGRST202: 'arena functions not found: run supabase/arena.sql in this Supabase project',
  401: 'Supabase rejected the key: check SUPABASE_SECRET_KEY is from the same project as SUPABASE_URL',
  403: 'no permission: SUPABASE_SECRET_KEY must be a secret key (sb_secret_…)',
  540: 'the Supabase project is paused: Supabase dashboard → the project → Resume project',
};

// Call a database function (supabase/arena.sql). Errors carry a `code`: 'not_ready' when arena.sql hasn't been run.
export async function arenaRpc(cfg, fn, args) {
  const res = await fetch(`${cfg.supabaseUrl}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: cfg.supabaseKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) {
    let code = '';
    try { code = String((await res.json()).code || ''); } catch { /* not JSON */ }
    const err = new Error(`arena: ${fn} HTTP ${res.status}${code ? ` ${code}` : ''} (${HINTS[code] || HINTS[res.status] || 'see the Supabase logs'})`);
    err.code = code === 'PGRST202' ? 'not_ready' : 'busy';
    throw err;
  }
  return res.json();
}
