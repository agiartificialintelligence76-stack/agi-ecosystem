// TRENCHING SIMULATOR's ranked runs (2026-10-22, the leaderboards): a ticket from our server as a daily market or a
// challenge starts (its seed and SOL's price come with it, frozen for the run), and at its end what happened with its
// orders, which our server makes into the run again before it ranks it (server/scores.js). No sign-in and no wallet: the
// same random id as its plays (./site.js), and the player's optional name (../player-name.js). Free play and Live mode
// never rank. A ticket that doesn't come (our server busy or away, the leaderboards not open yet) only means the run
// isn't ranked: the game never waits for it more than a moment.
import { playerId } from './site.js';
import { packLog } from './verify.js';
import { loadName } from '../player-name.js';

const GAME = 'trenchingsimulator';
const ENDPOINT = '/api/wallet';

async function post(body, ms) {
  const r = await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    signal: AbortSignal.timeout(ms) });
  let data = null;
  try {
    data = await r.json();
  } catch {
    data = null;
  }
  return { status: r.status, data };
}
const store = () => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

// a ticket for a daily market or a challenge → { ticket, seed, solUsd, day } or { why } (the run isn't ranked)
export async function askTicket({ kind, challenge = null }, ms = 3500) {
  try {
    const { status, data } = await post({ action: 'game-ticket', game: GAME, player: playerId(), kind, challenge }, ms);
    if (status === 200 && data && data.ok === true && typeof data.ticket === 'string' && typeof data.seed === 'string' && data.solUsd > 0) {
      return { ticket: data.ticket, seed: data.seed, solUsd: data.solUsd, day: data.day };
    }
    return { why: status === 503 ? 'soon' : status === 429 ? 'busy' : 'off' };
  } catch {
    return { why: 'offline' };
  }
}

// a ranked run's score: its ticket, its result and its orders → the server's answer ({ ranked, ranks, … } or { why })
export async function sendScore(ticket, res, log, ms = 20000) {
  try {
    // ("action" first: our server lets a score be bigger than other requests only when it says so first)
    const { status, data } = await post({
      action: 'game-score', game: GAME, player: playerId(), ticket: ticket.ticket, name: loadName(store()) || '',
      claim: { outcome: res.outcome, timeUsed: res.timeUsed, worth: res.worth, multiple: res.multiple }, log: packLog(log),
    }, ms);
    if (status === 200 && data && data.ok === true) return data;
    const e = data && typeof data.error === 'string' ? data.error : null;
    return { why: e === 'not_ready' || (!e && status === 503) ? 'soon' : e || 'off' };
  } catch {
    return { why: 'offline' };
  }
}
