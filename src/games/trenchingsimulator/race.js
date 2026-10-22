// TRENCHING SIMULATOR's race rooms in the browser (2026-10-22, the owner: "add the mutiplayer too only on trenching
// simulator, they can invite players via link idk whats better (no wallet needed when they invite)"; the owner's pick:
// "Same-market race"): one WebSocket to the relay's race door (the Live feed's host, its /room path: no new address in
// the site's CSP), open only while the player is in a room. Everyone in a room plays the same made-up market (the relay
// picks its seed and SOL's price) from the same moment, each with their own play money; this says how the player's run
// is doing about once a second, and keeps the room's standings as the relay sends them. Its invite link is
// agi1.app/games/trenchingsimulator#room=<code> (a fragment: never in a server's log). No wallet, no sign-in; the
// standings are for fun (each browser says how its own run went), never ranked. Everything it gets is checked first
// (parseRaceMessage). Until the relay has race rooms (the owner runs relay.sh update), it says rooms aren't open.
import { relayUrl } from './live-chains.js';

export const RACE = Object.freeze({ connectMs: 8000, reportMs: 1000, resumeMs: 60_000, maxBackoffMs: 15_000 });
export const ROOM_CODE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;
const STATES = new Set(['lobby', 'countdown', 'racing', 'ended']);
const OUTCOMES = new Set(['won', 'lost', 'busted', 'quit']);
const ERRORS = new Set(['bad', 'no_room', 'room_full', 'started', 'too_many', 'not_host', 'rooms_full']);
const BYES = new Set(['kicked', 'expired', 'restart']);
const ENDS = new Set(['all_done', 'time', 'restart']);

// the race rooms' address: the Live feed's relay, its /room door (on this computer, the same ?relay= as the feed's)
export const raceUrl = (loc) => relayUrl(loc).replace(/\/ws$/, '/room');
// an invite link's room ('#room=K7QX2M' → 'K7QX2M'), or null
export function roomOfHash(hash) {
  const m = /^#room=([A-Za-z0-9]{6})$/.exec(typeof hash === 'string' ? hash : '');
  const code = m ? m[1].toUpperCase() : '';
  return ROOM_CODE.test(code) ? code : null;
}
export const inviteLink = (code, origin = 'https://agi1.app') => `${origin}/games/trenchingsimulator#room=${code}`;
// a code as typed ("k7qx 2m" → "K7QX2M"), or null
export function cleanCode(raw) {
  const code = String(raw ?? '').replace(/[\s-]/g, '').toUpperCase();
  return ROOM_CODE.test(code) ? code : null;
}

// ---------- what the relay sends, checked ----------
const int = (x, lo, hi) => Number.isInteger(x) && x >= lo && x <= hi;
const num = (x, lo, hi) => typeof x === 'number' && Number.isFinite(x) && x >= lo && x <= hi;
const nameOf = (s) => (typeof s === 'string' && s.length <= 40 ? s.replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, '').trim() : '');
const setOf = (s) => (s && typeof s === 'object' && typeof s.challenge === 'string' && /^[a-z0-9-]{2,32}$/.test(s.challenge)
  && int(s.seconds, 60, 1800) ? { challenge: s.challenge, seconds: s.seconds } : null);
const rowsOf = (rows) => {
  if (!Array.isArray(rows) || rows.length > 16) return null;
  const out = [];
  for (const r of rows) {
    if (!r || typeof r !== 'object' || !int(r.id, 1, 1e6) || !num(r.x, 0, 1e6) || !num(r.c, 0, 2000)) return null;
    out.push({ id: r.id, name: nameOf(r.name) || `Trader ${r.id}`, w: num(r.w, 0, 1e7) ? r.w : null, x: r.x, c: r.c,
      o: OUTCOMES.has(r.o) ? r.o : null, t: num(r.t, 0, 2000) ? r.t : null, done: r.done === true, gone: r.gone === true });
  }
  return out;
};
// a message from the relay → { t, … } with every field checked, or null (anything odd is dropped)
export function parseRaceMessage(text) {
  if (typeof text !== 'string' || text.length > 8192) return null;
  let m;
  try {
    m = JSON.parse(text);
  } catch {
    return null;
  }
  if (!m || typeof m !== 'object' || m.v !== 1 || typeof m.t !== 'string') return null;
  if (m.t === 'room') {
    const you = m.you;
    const set = setOf(m.set);
    if (!ROOM_CODE.test(m.code || '') || !set || !STATES.has(m.state) || !int(m.race, 0, 1e6) || !you || typeof you !== 'object'
      || !int(you.id, 1, 1e6) || typeof you.token !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(you.token) || !Array.isArray(m.players)
      || m.players.length > 16) return null;
    const players = [];
    for (const p of m.players) {
      if (!p || typeof p !== 'object' || !int(p.id, 1, 1e6)) return null;
      players.push({ id: p.id, name: nameOf(p.name) || `Trader ${p.id}`, ready: p.ready === true, host: p.host === true, gone: p.gone === true });
    }
    return { t: 'room', code: m.code, you: { id: you.id, token: you.token, host: you.host === true }, players, set, state: m.state,
      race: m.race, max: int(m.max, 2, 16) ? m.max : 8 };
  }
  if (m.t === 'go') {
    const set = setOf(m.set);
    if (!set || !int(m.race, 1, 1e6) || typeof m.seed !== 'string' || !/^race-[A-Z0-9]{6}-\d{1,7}$/.test(m.seed) || !num(m.solUsd, 1, 1e5)
      || !num(m.startAt, 0, 1e14) || !num(m.now, 0, 1e14) || m.seconds !== set.seconds) return null;
    return { t: 'go', race: m.race, seed: m.seed, solUsd: m.solUsd, set, startAt: m.startAt, now: m.now, seconds: m.seconds };
  }
  if (m.t === 'board' || m.t === 'end') {
    const rows = rowsOf(m.rows);
    if (!rows) return null;
    return m.t === 'board' ? { t: 'board', rows } : { t: 'end', rows, why: ENDS.has(m.why) ? m.why : 'time' };
  }
  if (m.t === 'err') return ERRORS.has(m.code) ? { t: 'err', code: m.code } : null;
  if (m.t === 'bye') return { t: 'bye', why: BYES.has(m.why) ? m.why : 'expired' };
  return null;
}

// createRace({ url, WebSocket, now, random, timers }) → a room: create / join it, then ready, start (the host), report
// and finish a run, leave. Its status: idle · connecting · lobby · countdown · racing · ended · down (reconnecting, or
// couldn't reach rooms at all: `error` 'unreachable') · closed (`error`: no_room, room_full, started, too_many,
// rooms_full, kicked, expired, restart, lost)
export function createRace({ url, WebSocket: WS = globalThis.WebSocket, now = () => Date.now(), random = Math.random,
  timers = { set: (f, ms) => setTimeout(f, ms), clear: (t) => clearTimeout(t) } } = {}) {
  const S = { status: 'idle', ws: null, intent: null, room: null, me: null, go: null, board: [], end: null, offset: 0, error: null,
    tries: 0, droppedAt: 0, retryT: null, openT: null, opened: false, lastReport: 0, finished: false };
  const listeners = new Set();
  const emit = (ev) => {
    for (const fn of [...listeners]) {
      try {
        fn(ev);
      } catch {
        // one listener's trouble never stops the room
      }
    }
  };
  const setStatus = (s) => {
    if (S.status === s) return;
    S.status = s;
    emit({ type: 'status', status: s });
  };
  const send = (op, fields = {}) => {
    const ws = S.ws;
    if (!ws || ws.readyState !== 1) return false;
    try {
      ws.send(JSON.stringify({ op, v: 1, ...fields }));
      return true;
    } catch {
      return false;
    }
  };
  const letGo = () => {
    timers.clear(S.retryT);
    timers.clear(S.openT);
    S.retryT = null;
    S.openT = null;
    const ws = S.ws;
    S.ws = null;
    if (ws) {
      try {
        ws.close(1000);
      } catch {
        // gone already
      }
    }
  };
  const closeWith = (why) => {
    S.error = why;
    letGo();
    setStatus('closed');
  };

  function connect() {
    timers.clear(S.retryT);
    S.retryT = null;
    if (typeof WS !== 'function') {
      S.error = 'unreachable';
      setStatus('down');
      return;
    }
    let ws;
    try {
      ws = new WS(url);
    } catch {
      fail();
      return;
    }
    S.ws = ws;
    S.opened = false;
    if (!S.room) setStatus('connecting');
    S.openT = timers.set(() => {
      if (S.ws === ws && !S.opened) {
        S.ws = null;
        try {
          ws.close();
        } catch {
          // let go either way
        }
        fail();
      }
    }, RACE.connectMs);
    ws.onopen = () => {
      if (S.ws !== ws) return;
      S.opened = true;
      timers.clear(S.openT);
      S.openT = null;
      // back after a drop: the same seat (its token); else what the player asked for
      if (S.room && S.me) send('resume', { code: S.room.code, token: S.me.token });
      else if (S.intent) send(S.intent.op, S.intent.fields);
    };
    ws.onmessage = (e) => {
      if (S.ws === ws) handle(typeof e.data === 'string' ? e.data : '');
    };
    ws.onclose = () => {
      if (S.ws !== ws) return;
      S.ws = null;
      fail();
    };
    ws.onerror = () => {};
  }
  // a connection that didn't open, or dropped: in a room, try again for a minute (its seat waits that long); never in a
  // room, rooms aren't reachable (the relay isn't updated yet, or it's away): say so, and stop
  function fail() {
    timers.clear(S.openT);
    S.openT = null;
    if (S.status === 'closed' || S.status === 'idle') return;
    if (!S.room) {
      S.error = 'unreachable';
      setStatus('down');
      return;
    }
    if (!S.droppedAt) S.droppedAt = now();
    if (now() - S.droppedAt > RACE.resumeMs) {
      closeWith('lost');
      return;
    }
    S.tries += 1;
    setStatus('down');
    const ms = Math.min(RACE.maxBackoffMs, 1000 * 2 ** Math.min(4, S.tries)) * (0.8 + 0.4 * random());
    S.retryT = timers.set(connect, ms);
  }

  function handle(text) {
    const m = parseRaceMessage(text);
    if (!m) return;
    switch (m.t) {
      case 'room':
        S.room = m;
        S.me = m.you;
        S.tries = 0;
        S.droppedAt = 0;
        S.error = null;
        setStatus(m.state);
        emit({ type: 'room', room: m });
        break;
      case 'go':
        // a new race (or the same one again, back after a drop): its clock is the relay's
        if (!S.go || S.go.race !== m.race) {
          S.board = [];
          S.end = null;
          S.finished = false;
          S.lastReport = 0;
        }
        S.go = m;
        S.offset = m.now - now();
        if (S.status !== 'racing') setStatus('countdown');
        emit({ type: 'go', go: m });
        break;
      case 'board':
        S.board = m.rows;
        emit({ type: 'board', rows: m.rows });
        break;
      case 'end':
        S.board = m.rows;
        S.end = m;
        setStatus('ended');
        emit({ type: 'end', end: m });
        break;
      case 'err':
        emit({ type: 'err', code: m.code });
        // what was asked for can't be had (no such room, full, started…): nothing to wait for
        if (!S.room && m.code !== 'not_host') closeWith(m.code);
        break;
      case 'bye':
        emit({ type: 'bye', why: m.why });
        closeWith(m.why);
        break;
      default:
        break;
    }
  }
  const begin = (op, fields) => {
    letGo();
    Object.assign(S, { status: 'idle', room: null, me: null, go: null, board: [], end: null, error: null, tries: 0, droppedAt: 0, finished: false });
    S.intent = { op, fields };
    connect();
  };

  return {
    url,
    // a new room for a challenge (`set`: { challenge, seconds })
    create({ name = '', set } = {}) {
      begin('create', { name: name || '', set });
    },
    join(code, { name = '' } = {}) {
      const c = cleanCode(code);
      if (!c) {
        S.error = 'no_room';
        setStatus('closed');
        return;
      }
      begin('join', { code: c, name: name || '' });
    },
    setName: (name) => send('name', { name: name || '' }),
    ready: (on) => send('ready', { on: Boolean(on) }),
    start: () => send('start'),
    kick: (id) => send('kick', { id }),
    // how the run is going: sent at most once a second (the latest)
    report({ worth, multiple, clock }) {
      if (S.finished || (S.status !== 'racing' && S.status !== 'countdown')) return false;
      const t = now();
      if (t - S.lastReport < RACE.reportMs) return false;
      if (!send('p', { w: worth, x: multiple, c: clock })) return false;
      S.lastReport = t;
      return true;
    },
    // the run's end: once
    finish({ worth, multiple, clock, outcome, timeUsed }) {
      if (S.finished) return false;
      S.finished = true;
      return send('done', { w: worth, x: multiple, c: clock, outcome, timeUsed });
    },
    leave() {
      send('leave');
      letGo();
      Object.assign(S, { room: null, me: null, go: null, intent: null, error: null });
      setStatus('idle');
    },
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    get status() {
      return S.status;
    },
    get room() {
      return S.room;
    },
    get me() {
      return S.me;
    },
    get isHost() {
      return Boolean(S.room && S.me && S.room.players.some((p) => p.id === S.me.id && p.host));
    },
    get go() {
      return S.go;
    },
    get board() {
      return S.board.slice();
    },
    get end() {
      return S.end;
    },
    get error() {
      return S.error;
    },
    // the relay's clock minus this one's (a race starts at go.startAt on the relay's clock)
    get offset() {
      return S.offset;
    },
    startsIn() {
      return S.go ? S.go.startAt - (now() + S.offset) : null;
    },
  };
}

// ---------- words ----------
// the room's line on its screens, from its status and what went wrong
export function raceWords(status, error) {
  if (status === 'connecting') return 'Connecting to race rooms…';
  if (status === 'down') return error === 'unreachable' ? 'Race rooms aren\'t open right now. You can still play on your own.' : 'Connection lost: trying again…';
  if (status === 'closed') {
    return {
      no_room: 'There\'s no room with that code (it may have ended). Check the code, or make a new room.',
      room_full: 'That room is full.',
      started: 'That race has already started. Ask for the next one, or make a room of your own.',
      too_many: 'That\'s a lot of rooms from here just now. Try again in a few minutes.',
      rooms_full: 'Race rooms are full right now. Try again soon.',
      kicked: 'The host took you out of the room.',
      expired: 'The room closed after a while without a race.',
      restart: 'Race rooms restarted: your run goes on, but the room closed.',
      lost: 'The connection to the room was lost: your run goes on.',
      unreachable: 'Race rooms aren\'t open right now. You can still play on your own.',
    }[error] || 'The room closed.';
  }
  if (status === 'lobby') return 'In the room. The host starts the race when everyone\'s in.';
  if (status === 'countdown') return 'The race is about to start…';
  if (status === 'racing') return 'Racing.';
  if (status === 'ended') return 'The race is over.';
  return '';
}
// a row of the standings: "1. Ape Lord · 2.31x" (a win: its time; busted, gave up, time's up and left said so; `you`:
// the player's own row says "You")
export function standingText(row, i, { you = false } = {}) {
  const clockOf = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const x = `${row.x >= 100 ? Math.round(row.x) : row.x.toFixed(2)}x`;
  const what = row.o === 'won' && row.t != null ? `won in ${clockOf(row.t)}` : row.o === 'busted' ? 'busted' : row.o === 'quit' ? 'gave up'
    : row.o === 'lost' ? 'time\'s up' : null;
  return `${i + 1}. ${you ? 'You' : row.name} · ${x}${what ? ` · ${what}` : ''}${row.gone && !row.done ? ' · left' : ''}`;
}
