// Ride 'Em, AGI!'s leaderboard (2026-10-22, the owner: "add leaderboards with names , optional to the game ride em agi
// also"): a ticket from our server as an endless run or the daily mod begins, and its numbers when it ends (and again after
// each revive, farther each time), checked on our server against what the game can do (server/scores.js). No sign-in and
// no wallet: the same random id as its plays (./site.js), and the player's optional name (../player-name.js: set in
// TRENCHING SIMULATOR or on agi1.app/games). Levels never rank. A ticket that doesn't come only means the run isn't
// ranked: the game never waits for it. A ranked run's place shows a few seconds at the top of the screen, as text.
import { playerId } from './site.js';
import { loadName } from '../player-name.js';
import { boardTitle } from '../boards.js';

const GAME = 'rideemagi';
const ENDPOINT = '/api/wallet';
let current = null;   // this run: { mode, ticket }

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

// its place, a few seconds at the top of the screen (styles through the CSS object model: the site's CSP)
let note = null;
let noteTimer = 0;
function show(text) {
  if (!note) {
    note = document.createElement('p');
    note.setAttribute('role', 'status');
    const s = note.style;
    for (const [k, v] of Object.entries({ position: 'fixed', top: 'max(12px, env(safe-area-inset-top))', left: '50%', transform: 'translateX(-50%)',
      'z-index': '50', margin: '0', padding: '8px 14px', 'border-radius': '999px', background: 'rgba(20, 14, 38, 0.92)', color: '#fff',
      font: '700 14px "M PLUS Rounded 1c", system-ui, sans-serif', 'pointer-events': 'none', 'max-width': 'calc(100vw - 32px)',
      'text-align': 'center' })) s.setProperty(k, v);
    document.body.append(note);
  }
  note.textContent = text;
  note.hidden = false;
  clearTimeout(noteTimer);
  noteTimer = setTimeout(() => { note.hidden = true; }, 6000);
}

export const Ranked = {
  // a run begins: endless runs and the daily mod ask for a ticket (levels never rank)
  start(cfg) {
    current = null;
    if (!cfg || (cfg.mode !== 'endless' && cfg.mode !== 'daily')) return;
    const run = { mode: cfg.mode, ticket: null };
    current = run;
    post({ action: 'game-ticket', game: GAME, player: playerId(), kind: cfg.mode }, 5000).then(({ status, data }) => {
      if (status === 200 && data && data.ok === true && typeof data.ticket === 'string') run.ticket = data.ticket;
    }).catch(() => { /* not ranked this time: the game goes on */ });
  },
  // a run ends (or ends again after a revive): its numbers to our server, when it has a ticket
  result(r, st) {
    const run = current;
    if (!run || !run.ticket || !r || r.mode !== run.mode) return;
    const daily = r.mode === 'daily' && r.daily ? { date: r.daily.date, mod: r.daily.mod && r.daily.mod.key } : {};
    const body = { action: 'game-score', game: GAME, player: playerId(), ticket: run.ticket, name: loadName(store()) || '',
      run: { mode: r.mode, dist: Math.floor(r.dist) || 0, score: Math.floor(r.score) || 0, bestMult: Number(r.bestMult) || 1,
        revives: (st && st.revives) | 0, ms: Math.round(((st && st.t) || 0) * 1000), ...daily } };
    post(body, 15000).then(({ status, data }) => {
      if (status !== 200 || !data || data.ranked !== true || !data.ranks) return;
      const best = Object.entries(data.ranks).sort((a, b) => a[1] - b[1])[0];
      if (best) show(`Ranked #${best[1]} · ${boardTitle(GAME, best[0])}`);
    }).catch(() => { /* not ranked this time */ });
  },
};
