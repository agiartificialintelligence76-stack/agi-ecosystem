// SKYBREAK on agi1.app (2026-10-31): the one thing the game tells our server, how many runs were started, so
// agi1.app/games can say how many people played it and how many times. No sign-in and no wallet: a random id this
// browser keeps for the games (src/games/list.js: PLAYER_KEY) counts players, never who they are. Nothing else is sent
// (times, heights, coins and checkpoints stay on the device).
//
// The first run is sent at once; after that at most once a minute, and when the page is closed or hidden (a fetch with
// `keepalive`, so it outlives the page). A run that can't be sent is simply not counted: the game never waits for it.
import { PLAYER, PLAYER_KEY, PLAYS } from '../list.js';

const GAME = 'skybreak';
const ENDPOINT = '/api/wallet';

const newId = () => {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
};

// This browser's player id (one for every game), or one for this page only when the browser keeps nothing
let pageId = null;
export function playerId() {
  try {
    const kept = localStorage.getItem(PLAYER_KEY);
    if (kept && PLAYER.test(kept)) return kept;
    const id = newId();
    localStorage.setItem(PLAYER_KEY, id);
    if (localStorage.getItem(PLAYER_KEY) === id) return id;
  } catch { /* storage blocked (a private window, a sandbox): an id for this page only */ }
  return pageId || (pageId = newId());
}

let pending = 0;
let timer = 0;
let sent = false;

function send(plays) {
  try {
    fetch(ENDPOINT, {
      method: 'POST',
      keepalive: true,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'game-play', game: GAME, player: playerId(), plays }),
    }).catch(() => { /* not counted, never retried: the game goes on */ });
  } catch { /* no fetch: not counted */ }
}

function flush() {
  if (timer) { clearTimeout(timer); timer = 0; }
  if (!pending) return;
  const plays = Math.min(pending, PLAYS.perReport);
  pending = 0;
  send(plays);
}

export const Site = {
  // one more run started (the game calls it as each run begins)
  play() {
    pending++;
    if (!sent) { sent = true; flush(); return; }
    if (!timer) timer = setTimeout(flush, PLAYS.flushMs);
  },
};

addEventListener('pagehide', flush);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
