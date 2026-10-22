// AGI games' leaderboards (2026-10-22, the owner: "add a leaderboard (also add leaderboards with names , optional to the
// game ride em agi also)"; the owner's pick: "Checked runs only"): the boards each game has, the order they rank in, what
// a row says, and the rules the page, the games and our server share. Bragging rights only: no prizes. TRENCHING
// SIMULATOR ranks the daily market and its challenges, each run made again on our server from its orders before it counts
// (never free play or Live mode); Ride 'Em, AGI! ranks its endless runs and its daily mod, its numbers checked against
// what the game can do. A row shows the name its player chose (or "A player"), never who they are. Pure: read in Node too.

export const BOARD = Object.freeze({
  top: 20,               // rows a board shows
  keep: 100,             // a run must beat the 100th to be kept (and replayed)
  perDay: Object.freeze({ tickets: 60, scores: 30 }),       // per visitor, a UTC day
  site: Object.freeze({ tickets: 50000, scores: 20000, replays: 2000 }),   // the whole site, a UTC day (replays: runs our
                         // server makes again, up to about a second of its CPU each; only a run that would make a board is)
  logMax: 1000,          // orders in one TRENCHING SIMULATOR run sent for a check
  bodyMax: 48000,        // the most a score's request may be (every other request: 6,000)
  rideUses: 3,           // a Ride 'Em, AGI! run's ticket: its first end and two revives
});

const DAY = '\\d{4}-\\d{2}-\\d{2}';
// a board's id: TRENCHING SIMULATOR's "daily:<day>", "c:<challenge>:all" and "c:<challenge>:w<its week's Monday>"; Ride
// 'Em, AGI!'s "e:all", "e:w<Monday>", "e:d<day>" (endless runs) and "m:<day>" (the daily mod). Days are UTC dates.
export const BOARD_IDS = Object.freeze({
  trenchingsimulator: new RegExp(`^(?:daily:${DAY}|c:[a-z0-9-]{2,32}:(?:all|w${DAY}))$`),
  rideemagi: new RegExp(`^(?:e:(?:all|w${DAY}|d${DAY})|m:${DAY})$`),
});
export const isBoard = (game, board) => typeof board === 'string' && Object.hasOwn(BOARD_IDS, game) && BOARD_IDS[game].test(board);
// GET /api/wallet?board=<game>:<board> (exactly this shape: the CDN keeps each a minute)
export const BOARD_ASK = /^\?board=([a-z0-9]{2,24}):([a-z0-9:-]{3,48})$/;

// a UTC day's key (YYYY-MM-DD) and its week's Monday
export const dayKeyOf = (ms) => new Date(ms).toISOString().slice(0, 10);
export function mondayOf(day) {
  const d = new Date(`${day}T00:00:00Z`);
  if (!Number.isFinite(d.getTime())) return null;
  return new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86400000).toISOString().slice(0, 10);
}
// the day before or after (a daily run's day may be its player's local date: one day either side of ours)
export const dayShift = (day, n) => new Date(new Date(`${day}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);

// ---------- TRENCHING SIMULATOR ----------
// a checked run's boards (its ticket's kind, challenge and UTC day)
export function trenchBoards({ kind, challenge, day }) {
  if (kind === 'daily') return [`daily:${day}`];
  return [`c:${challenge}:all`, `c:${challenge}:w${mondayOf(day)}`];
}
// where a checked run goes on them: lower ranks higher. A win by its time (fewer seconds first), then its multiple; on the
// daily market the runs that didn't win after every win, by their multiple. A challenge's board ranks wins only, and a run
// its player ended (quit) never ranks. → { k1, k2, detail } or null (not ranked)
export function trenchKeys(kind, r) {
  if (!r || !Number.isFinite(r.multiple) || !Number.isFinite(r.timeUsed)) return null;
  const m = Math.round(r.multiple * 10000) / 10000;
  const t = Math.round(r.timeUsed * 10) / 10;
  if (r.outcome === 'won') return { k1: t, k2: -m, detail: { w: 1, t, m } };
  if (kind === 'daily' && (r.outcome === 'lost' || r.outcome === 'busted')) return { k1: 100000 - m, k2: 0, detail: { w: 0, t, m } };
  return null;
}

// ---------- Ride 'Em, AGI! ----------
// an endless run's boards (today, this week, all time) or the daily mod's (its day)
export function rideBoards({ mode, day, date }) {
  if (mode === 'daily') return [`m:${date}`];
  return ['e:all', `e:w${mondayOf(day)}`, `e:d${day}`];
}
// farther first, then the higher score
export const rideKeys = (run) => ({ k1: -run.dist, k2: -run.score, detail: { d: run.dist, s: run.score } });

// ---------- what a row says ----------
const two = (n) => String(n).padStart(2, '0');
const clockOf = (s) => `${Math.floor(s / 60)}:${two(Math.floor(s % 60))}`;
const grouped = (n) => Math.round(n).toLocaleString('en-US');
// (its zeros after the point dropped: 10.20 → "10.2x", 3.00 → "3x"; 100 stays "100x")
const multipleOf = (m) => `${m >= 100 ? Math.round(m) : m >= 10 ? m.toFixed(1) : m.toFixed(2)}x`
  .replace(/(\.\d*?)0+x$/, '$1x').replace(/\.x$/, 'x');
// a row's numbers in words: "2:41 · 10.2x" (a win), "0.85x" (the daily market, not won), "6,151 m · 119,189"
export function rowText(game, detail) {
  const d = detail && typeof detail === 'object' ? detail : {};
  if (game === 'rideemagi') return Number.isFinite(d.d) && Number.isFinite(d.s) ? `${grouped(d.d)} m · ${grouped(d.s)}` : '—';
  if (!Number.isFinite(d.m)) return '—';
  return d.w && Number.isFinite(d.t) ? `${clockOf(d.t)} · ${multipleOf(d.m)}` : multipleOf(d.m);
}
// a row's name: the one its player chose, or "A player"
export const rowName = (name) => (typeof name === 'string' && name ? name : 'A player');

// A run's line about the leaderboards, on its results: being checked, its places, or why it isn't ranked (never an
// accusation: a run that didn't check just isn't ranked). `st`: { state: 'pending' } | the server's answer | { why }
// before it started (free play, Live mode, the leaderboards not open yet, our server away)
const WHY = Object.freeze({
  free: 'Free play isn\'t ranked: the daily market and the challenges are.',
  live: 'Live coins aren\'t ranked: the daily market and the challenges are, with made-up coins.',
  race: 'Races aren\'t ranked: the room\'s standings are just for fun.',
  soon: 'Leaderboards open soon.',
  busy: 'Not ranked: our server is busy right now.',
  offline: 'Not ranked: our server didn\'t answer in time.',
  off: 'Not ranked this time.',
  day: 'Not ranked: a new day started as it began.',
  not_ranked: 'Only wins rank on a challenge\'s leaderboard (and a run you end yourself never does).',
  not_better: 'Checked: not better than your best on the leaderboard yet.',
  replay: 'This run couldn\'t be checked, so it isn\'t ranked.',
  late: 'Not ranked: it came back too late.',
  used: 'Already on the leaderboard.',
  person_cap: 'Not ranked: that\'s today\'s checked runs for you.',
  site_cap: 'Not ranked: the leaderboards are full for today.',
});
export function rankWords(st, titleOf = (b) => b) {
  if (!st) return '';
  if (st.state === 'pending') return 'Checking your run for the leaderboard…';
  if (st.ranked && st.ranks) {
    const parts = Object.entries(st.ranks).map(([b, r]) => `#${r} · ${titleOf(b)}`);
    const name = st.nameRefused ? ' (your name can\'t be shown there: it says "A player")' : '';
    return parts.length ? `Ranked ${parts.join(', ')}${name}` : 'Ranked.';
  }
  return WHY[st.why] || WHY.off;
}

// The boards a game's picker on agi1.app/games offers now → [{ board, title }]. TRENCHING SIMULATOR: today's daily market
// (a UTC day), then each challenge's week and all time (`challenges`: its CHALLENGES, so this file never loads the game);
// Ride 'Em, AGI!: endless runs today, this week (UTC) and all time, and the daily mod of `localDay` (the game's own day is
// its player's date)
export function pickerBoards(game, { now = Date.now(), localDay = null, challenges = [] } = {}) {
  const day = dayKeyOf(now);
  const week = mondayOf(day);
  if (game === 'trenchingsimulator') {
    const names = new Map(challenges.map((c) => [c.id, c.name]));
    return [`daily:${day}`, ...challenges.map((c) => `c:${c.id}:w${week}`), ...challenges.map((c) => `c:${c.id}:all`)]
      .filter((b) => isBoard(game, b))
      .map((board) => ({ board, title: boardTitle(game, board, names.get(board.split(':')[1]) || null) }));
  }
  if (game === 'rideemagi') {
    const mod = typeof localDay === 'string' && new RegExp(`^${DAY}$`).test(localDay) ? localDay : day;
    return [`e:d${day}`, `e:w${week}`, 'e:all', `m:${mod}`].map((board) => ({ board, title: boardTitle(game, board) }));
  }
  return [];
}

// this browser's own place on a board (game-score-mine's row for it, or none)
export function mineText(game, row) {
  if (!row || typeof row !== 'object') return 'You\'re not on this board yet.';
  if (row.hidden) return 'Your run on this board was taken off it.';
  const at = Number.isInteger(row.rank) && row.rank > 0 ? `#${row.rank.toLocaleString('en-US')} · ` : '';
  return `Your best here: ${at}${rowText(game, row.detail)}`;
}

// what a board is called on the page
export function boardTitle(game, board, challengeName = null) {
  if (game === 'trenchingsimulator') {
    if (board.startsWith('daily:')) return `Daily market · ${board.slice(6)}`;
    const m = /^c:([a-z0-9-]+):(all|w.+)$/.exec(board);
    if (m) return `${challengeName || m[1]} · ${m[2] === 'all' ? 'All time' : 'This week'}`;
  }
  if (game === 'rideemagi') {
    if (board === 'e:all') return 'Endless · All time';
    if (board.startsWith('e:w')) return 'Endless · This week';
    if (board.startsWith('e:d')) return 'Endless · Today';
    if (board.startsWith('m:')) return `Daily mod · ${board.slice(2)}`;
  }
  return board;
}
