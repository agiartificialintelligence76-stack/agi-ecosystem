// The Arena (ClankeRRankeR) on the server: rounds, the coin list, and calls to the database functions
// in supabase/arena.sql (arena_vote, arena_state). Only the server's secret key can call them.
import { TOKENS } from '../src/prices/parse.js';

export const ROUND_MS = 5 * 60_000;                                // one round = 5 minutes
export const COINS = TOKENS.map((t) => t.symbol);                  // AGI, CABO, CLANKCAT (one list for the whole site)
export const roundAt = (ms = Date.now()) => Math.floor(ms / ROUND_MS);
// Friendly round numbers for the page: round #1 started when the Arena opened.
export const OPENED = roundAt(Date.UTC(2026, 8, 24));
export const roundNumber = (round) => round - OPENED + 1;
// The first round of this week (Monday 00:00 UTC): the Hall of Fame's "This week".
export function weekStartRound(ms = Date.now()) {
  const d = new Date(ms);
  const daysSinceMonday = (d.getUTCDay() + 6) % 7;
  return roundAt(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - daysSinceMonday));
}

const HINTS = {
  PGRST202: 'arena functions not found: run supabase/arena.sql in this Supabase project',
  401: 'Supabase rejected the key: check SUPABASE_SECRET_KEY is from the same project as SUPABASE_URL',
  403: 'no permission: SUPABASE_SECRET_KEY must be a secret key (sb_secret_…)',
  540: 'the Supabase project is paused: Supabase dashboard → the project → Resume project',
};

// Call a database function. Errors carry a `code`: 'not_ready' when arena.sql hasn't been run yet.
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
    const hint = code === 'PGRST202' && fn.startsWith('coin_')
      ? 'coin functions not found: run supabase/coins.sql in this Supabase project (after arena.sql)'
      : HINTS[code] || HINTS[res.status] || 'see the Supabase logs';
    const err = new Error(`arena: ${fn} HTTP ${res.status}${code ? ` ${code}` : ''} (${hint})`);
    err.code = code === 'PGRST202' ? 'not_ready' : 'busy';
    throw err;
  }
  return res.json();
}
