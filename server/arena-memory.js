// AGI-1's memory of the Arena (2026-09-25, the owner's request): before every chat reply she's told who the current
// champion is (the latest crowned round), and nothing older, so she can talk about it when someone asks ("who's winning?",
// "did agi win?") and knows what her own champion lines in the chat were about. No setting and no row in the Playground's
// Parameters: it just updates by itself.
//
// Kept per server copy for at most a minute and never across a round change, so a new champion is known within seconds of
// being crowned (asking arena_state also crowns rounds that just ended, as the scoreboard does). Never throws and never
// holds a reply up for long: if the database can't say, she simply doesn't mention the Arena.
import { arenaRpc, roundAt, roundNumber, ROUND_MS } from './arena.js';
import { loadCoinBoard } from './coins.js';

const KEEP_MS = 60_000;      // ask again at most once a minute per server copy (and at every new round)
const WAIT_MS = 1_500;       // a slow database never holds her reply up longer than this

let known = { at: 0, round: null, champion: null };
let asking = null;           // the lookup in progress (several replies at once share one)
export function forgetArenaMemory() { known = { at: 0, round: null, champion: null }; asking = null; }   // for tests

// → { symbol, name, number, votes, endedAt, inArena } or null (no champion yet, or the owner removed that coin)
async function lookUp(cfg, round) {
  const [state, board] = await Promise.all([
    arenaRpc(cfg, 'arena_state', { p_round: round, p_recent: 1 }),
    loadCoinBoard(cfg),
  ]);
  const last = Array.isArray(state?.recent) ? state.recent[0] : null;
  if (!last || typeof last.coin !== 'string') return null;
  const listed = board.coins.find((c) => c.symbol === last.coin);
  const coin = listed || board.retired.find((c) => c.symbol === last.coin);
  if (!coin) return null;                            // a coin the owner removed is never mentioned (as on the stage)
  return {
    symbol: coin.symbol, name: coin.name || '', number: roundNumber(last.round), votes: Number(last.votes) || 0,
    endedAt: (Number(last.round) + 1) * ROUND_MS, inArena: Boolean(listed),
  };
}

// The current champion, for her prompt (server/agi1-prompt.js → arenaPrompt).
export async function currentChampion(cfg, now = Date.now()) {
  const round = roundAt(now);
  if (known.round === round && now - known.at < KEEP_MS) return known.champion;
  if (!asking) {
    asking = lookUp(cfg, round).then(
      (champion) => { known = { at: now, round, champion }; },
      (err) => {
        console.error('[chat] arena memory unavailable (she just won\'t mention the Arena):', err.message);
        known = { at: now, round, champion: known.champion };   // try again in a minute; what she knew is likely still true
      },
    ).finally(() => { asking = null; });
  }
  let timer;
  const late = new Promise((resolve) => { timer = setTimeout(resolve, WAIT_MS); });
  await Promise.race([asking, late]);
  clearTimeout(timer);
  return known.champion;
}
