// TRENCHING SIMULATOR's race rooms (2026-10-22, the owner: "add the mutiplayer too only on trenching simulator, they can
// invite players via link idk whats better (no wallet needed when they invite)"; the owner's pick: "Same-market race"):
// everyone in a room plays the same made-up market (one seed, one challenge, one SOL price) from the same moment, each
// with their own play money, and sees the room's standings as they go. A room is a 6-character code; its link is
// agi1.app/games/trenchingsimulator#room=<code> (a fragment: never in a server's log). No wallet, no sign-in, nothing
// kept: rooms live in this process's memory and end with it. The relay never plays the market (its CPU is her live
// show's too): each browser plays its own copy and says how it's doing, so the standings are for fun, never checked.
//
// What a browser may send (JSON, at most 1 KB, each with v: 1, about two a second): create {name?, set: {challenge,
// seconds}} · join {code, name?} · resume {code, token} (back within a minute of a dropped connection) · name {name} ·
// ready {on} · start (the host: a race, or a rematch) · kick {id} (the host, between races) · p {w, x, c} (its worth in
// SOL, its multiple, its run's clock) · done {w, x, c, outcome, timeUsed?} · leave.
// What it gets (each with v: 1): room (the players, the settings, its state, and its own seat) · go (the race: its seed,
// SOL's price, when it starts) · board (the standings, every 2 s while they change) · end · err {code} · bye {why}.
import { randomInt, randomBytes } from 'node:crypto';

export const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;
export const CHALLENGE = /^[a-z0-9-]{2,32}$/;
export const OUTCOMES = Object.freeze(['won', 'lost', 'busted', 'quit']);
export const ROOMS = Object.freeze({
  perRoom: 8, max: 200, maxPlayers: 1600, perIp: 8, // seats a room · rooms · sockets on /room · sockets from one address
  createPer10Min: 3, missPerMin: 10, // rooms one address makes in 10 minutes · wrong codes from one address a minute
  maxMsgBytes: 1024, msgBurst: 5, msgPerSec: 2, high: 256 * 1024, // a message · how many (a token bucket) · backlog
  lobbyMs: 15 * 60_000, emptyMs: 60_000, endedMs: 5 * 60_000, resumeMs: 60_000, // a lobby, an empty room, an ended one
  countdownMs: 5_000, graceMs: 15_000, boardMs: 2_000, minSeconds: 60, maxSeconds: 1800,
});

// ---------- a player's name in a room ----------
const INVISIBLE = /[\u0000-\u001f\u007f-\u009f؜ᅟᅠ᠎​-‏‪-‮⁠-⁤⁦-⁩ㅤ﻿ﾠ￹-￻]/g;
const POSING = /\b(?:agi(?:\s*(?:1|one|team))?|the\s*team|team|admin|administrator|moderator|mod|mods|official|support|staff)\b/i;
// (the site's own list: server/coins.js; the relay's image can't reach the site's files)
const CRUDE = /(fuck|porn|hentai|onlyfans|pawg|cunt|whore|slut|milf|nude|naked|xxx|boob|titties|pussy|penis|vagina|horny|blowjob|dildo|sexy|sexual|nigg|faggot|hitler|nazi|rapist)|\b(sex|anal|cum|tits?|cock|dick|rape|fag|retard|kkk)\b/i;
const LINKISH = /https?:|www\.|\.(?:com|net|org|io|app|xyz|gg|fun|trade|me|co|to|ly|so|sh)\b|@|\/\//i;
const NUMBERISH = /0x[0-9a-f]{4,}|\d{7,}/i;
// As its player typed it, made safe to show as text (nothing invisible or direction-changing, single spaces), at most 16
// characters; never one that passes for AGI-1, her team or a moderator, a link, an address or a crude word → the name,
// or null (the room says "Trader 3")
export function roomName(raw) {
  if (typeof raw !== 'string' || raw.length > 200) return null;
  let s = raw.normalize('NFC').replace(INVISIBLE, '').replace(/\s+/g, ' ').trim();
  if (!s) return null;
  const words = s.replace(/([a-z])([A-Z0-9])/g, '$1 $2').replace(/([0-9])([a-zA-Z])/g, '$1 $2').replace(/[_.\-]+/g, ' ');
  if (POSING.test(words) || CRUDE.test(s) || LINKISH.test(s) || NUMBERISH.test(s)) return null;
  const chars = [...s];
  if (chars.length > 16) s = `${chars.slice(0, 15).join('').trimEnd()}…`;
  return s;
}

const round = (x, d) => Math.round(x * d) / d;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

// createRooms({ log, now, random, token, price, pingMs, tickMs, limits }) → { attach(ws, ip), stats(), players, close() }.
// `price`: SOL's price in dollars now (the hub's, from DexScreener), else 150
export function createRooms({ log, now = Date.now, random = randomInt, token = () => randomBytes(16).toString('base64url'),
  price = () => 150, pingMs = 25_000, tickMs = 1000, limits = {} } = {}) {
  const L = { ...ROOMS, ...limits };
  const rooms = new Map();
  const clients = new Set();
  const creates = new Map();
  const misses = new Map();
  const S = { created: 0, races: 0, closedSpam: 0 };

  // ---------- sending ----------
  function send(cl, t, fields = {}) {
    if (!cl || cl.ws.readyState !== 1) return false;
    if (cl.ws.bufferedAmount > L.high) {
      drop(cl, 'slow');
      return false;
    }
    try {
      cl.ws.send(JSON.stringify({ t, v: 1, ...fields }));
      return true;
    } catch {
      return false;
    }
  }
  const err = (cl, code) => send(cl, 'err', { code });
  const seated = (room) => room.seats.filter((s) => s.cl);
  const toSeats = (room, t, fields) => {
    for (const s of seated(room)) send(s.cl, t, fields);
  };
  // the room as each of its players sees it (its own seat: its id, its resume token, whether it's the host)
  function tellRoom(room) {
    const players = room.seats.map((s) => ({ id: s.id, name: s.name, ready: s.ready, host: s.id === room.hostId, gone: !s.cl }));
    for (const s of seated(room)) {
      send(s.cl, 'room', { code: room.code, you: { id: s.id, token: s.token, host: s.id === room.hostId }, players, set: room.set,
        state: room.state, race: room.race, max: L.perRoom });
    }
  }
  const goFields = (room) => ({ race: room.race, seed: room.seed, solUsd: room.solUsd, set: room.set, startAt: room.startAt, now: now(),
    seconds: room.set.seconds });
  // the standings: a challenge won first (fewer seconds, then the bigger multiple), then everyone else by their multiple,
  // busted last; a player who left keeps their last numbers (gone)
  function rowsOf(room) {
    const rowOf = (s) => {
      const r = s.done || s.rep || { w: null, x: 1, c: 0 };
      return { id: s.id, name: s.name, w: r.w, x: r.x, c: r.c, o: s.done ? s.done.outcome : null,
        t: s.done && s.done.outcome === 'won' ? s.done.timeUsed : null, done: Boolean(s.done), gone: !s.cl };
    };
    const tier = (r) => (r.o === 'won' ? 0 : r.o === 'busted' ? 2 : 1);
    return room.seats.map(rowOf).sort((a, b) => tier(a) - tier(b) || (tier(a) === 0 ? a.t - b.t : 0) || b.x - a.x || a.id - b.id);
  }

  // ---------- rooms ----------
  function makeCode() {
    for (let i = 0; i < 50; i++) {
      let c = '';
      for (let k = 0; k < 6; k++) c += CODE_CHARS[random(CODE_CHARS.length)];
      if (!rooms.has(c)) return c;
    }
    return null;
  }
  const setOf = (s) => (s && typeof s === 'object' && typeof s.challenge === 'string' && CHALLENGE.test(s.challenge)
    && Number.isInteger(s.seconds) && s.seconds >= L.minSeconds && s.seconds <= L.maxSeconds ? { challenge: s.challenge, seconds: s.seconds } : null);
  function sit(room, cl, rawName) {
    const id = room.nextId++;
    const seat = { id, name: roomName(rawName) || `Trader ${id}`, token: token(), ready: false, cl, goneAt: 0, rep: null, done: null };
    room.seats.push(seat);
    cl.room = room;
    cl.seat = seat;
    room.emptyAt = 0;
    return seat;
  }
  function unseat(room, seat) {
    room.seats = room.seats.filter((s) => s !== seat);
    if (seat.id === room.hostId) {
      const next = room.seats.find((s) => s.cl) || room.seats[0];
      room.hostId = next ? next.id : 0;
    }
  }
  const between = (room) => room.state === 'lobby' || room.state === 'ended';
  function close(room, why) {
    for (const s of seated(room)) {
      send(s.cl, 'bye', { why });
      s.cl.room = null;
      s.cl.seat = null;
    }
    rooms.delete(room.code);
  }
  function finishRace(room, why) {
    room.state = 'ended';
    room.endedAt = now();
    room.why = why;
    toSeats(room, 'end', { rows: rowsOf(room), why });
    tellRoom(room);
  }
  // a wrong code from this address: past `missPerMin` a minute, it's closed
  function miss(cl) {
    const t = now();
    const h = misses.get(cl.ip);
    if (!h || t - h.at > 60_000) {
      if (misses.size > 50_000) misses.clear();
      misses.set(cl.ip, { at: t, n: 1 });
      return false;
    }
    h.n += 1;
    if (h.n <= L.missPerMin) return false;
    drop(cl, 'too many tries');
    return true;
  }

  // ---------- what a browser asks ----------
  const ops = {
    create(cl, m) {
      if (cl.room) return err(cl, 'bad');
      const set = setOf(m.set);
      if (!set) return err(cl, 'bad');
      const t = now();
      const made = (creates.get(cl.ip) || []).filter((x) => t - x < 600_000);
      if (made.length >= L.createPer10Min) return err(cl, 'too_many');
      if (rooms.size >= L.max) return err(cl, 'rooms_full');
      const code = makeCode();
      if (!code) return err(cl, 'rooms_full');
      made.push(t);
      if (creates.size > 50_000) creates.clear();
      creates.set(cl.ip, made);
      const room = { code, set, seats: [], hostId: 0, state: 'lobby', race: 0, seed: null, solUsd: 150, startAt: 0, endAt: 0,
        born: t, emptyAt: 0, endedAt: 0, why: null, nextId: 1, dirty: false, boardAt: 0 };
      rooms.set(code, room);
      S.created += 1;
      room.hostId = sit(room, cl, m.name).id;
      return tellRoom(room);
    },
    join(cl, m) {
      if (cl.room) return err(cl, 'bad');
      const code = typeof m.code === 'string' ? m.code.trim().toUpperCase() : '';
      const room = CODE.test(code) ? rooms.get(code) : null;
      if (!room) return miss(cl) ? undefined : err(cl, 'no_room');
      if (!between(room)) return err(cl, 'started');
      if (room.seats.length >= L.perRoom) return err(cl, 'room_full');
      sit(room, cl, m.name);
      return tellRoom(room);
    },
    resume(cl, m) {
      if (cl.room) return err(cl, 'bad');
      const room = typeof m.code === 'string' && CODE.test(m.code) ? rooms.get(m.code) : null;
      const seat = room && typeof m.token === 'string' && m.token.length <= 64 ? room.seats.find((s) => s.token === m.token) : null;
      if (!seat || seat.cl || now() - seat.goneAt > L.resumeMs) return miss(cl) ? undefined : err(cl, 'no_room');
      seat.cl = cl;
      seat.goneAt = 0;
      cl.room = room;
      cl.seat = seat;
      room.emptyAt = 0;
      room.dirty = true;
      tellRoom(room);
      if (room.state === 'countdown' || room.state === 'racing') send(cl, 'go', goFields(room));
      else if (room.state === 'ended') send(cl, 'end', { rows: rowsOf(room), why: room.why });
      return undefined;
    },
    name(cl, m) {
      if (!cl.room) return err(cl, 'bad');
      if (!between(cl.room)) return err(cl, 'started');
      cl.seat.name = roomName(m.name) || `Trader ${cl.seat.id}`;
      return tellRoom(cl.room);
    },
    ready(cl, m) {
      if (!cl.room || !between(cl.room)) return err(cl, 'bad');
      cl.seat.ready = m.on === true;
      return tellRoom(cl.room);
    },
    start(cl) {
      const room = cl.room;
      if (!room) return err(cl, 'bad');
      if (cl.seat.id !== room.hostId) return err(cl, 'not_host');
      if (!between(room)) return err(cl, 'started');
      // (whoever left before it starts isn't in it)
      room.seats = seated(room);
      for (const s of room.seats) {
        s.rep = null;
        s.done = null;
        s.ready = false;
      }
      const px = Number(price());
      room.race += 1;
      room.seed = `race-${room.code}-${room.race}`;
      room.solUsd = Number.isFinite(px) && px >= 1 && px <= 100_000 ? round(px, 100) : 150;
      room.startAt = now() + L.countdownMs;
      room.endAt = room.startAt + room.set.seconds * 1000 + L.graceMs;
      room.state = 'countdown';
      room.why = null;
      room.dirty = true;
      S.races += 1;
      toSeats(room, 'go', goFields(room));
      return tellRoom(room);
    },
    kick(cl, m) {
      const room = cl.room;
      if (!room || cl.seat.id !== room.hostId) return err(cl, room ? 'not_host' : 'bad');
      if (!between(room)) return err(cl, 'started');
      const seat = room.seats.find((s) => s.id === m.id && s.id !== room.hostId);
      if (!seat) return err(cl, 'bad');
      unseat(room, seat);
      if (seat.cl) {
        send(seat.cl, 'bye', { why: 'kicked' });
        seat.cl.room = null;
        seat.cl.seat = null;
      }
      return tellRoom(room);
    },
    p(cl, m) {
      const room = cl.room;
      if (!room || cl.seat.done || (room.state !== 'racing' && room.state !== 'countdown')) return undefined;
      const r = numbersOf(m, room);
      if (!r) return err(cl, 'bad');
      cl.seat.rep = r;
      room.dirty = true;
      return undefined;
    },
    done(cl, m) {
      const room = cl.room;
      if (!room || cl.seat.done || room.state !== 'racing') return undefined;
      const r = numbersOf(m, room);
      if (!r || !OUTCOMES.includes(m.outcome)) return err(cl, 'bad');
      const t = Number(m.timeUsed);
      cl.seat.done = { ...r, outcome: m.outcome, timeUsed: Number.isFinite(t) ? round(clamp(t, 0, room.set.seconds), 10) : r.c };
      room.dirty = true;
      if (room.seats.every((s) => s.done || !s.cl)) finishRace(room, 'all_done');
      return undefined;
    },
    leave(cl) {
      const room = cl.room;
      if (!room) return undefined;
      const seat = cl.seat;
      cl.room = null;
      cl.seat = null;
      if (between(room)) unseat(room, seat);
      else {
        seat.cl = null;
        seat.goneAt = now();
        room.dirty = true;
      }
      if (!seated(room).length) room.emptyAt = now();
      else if (room.state === 'racing' && room.seats.every((s) => s.done || !s.cl)) finishRace(room, 'all_done');
      return tellRoom(room);
    },
  };
  const numbersOf = (m, room) => {
    const w = Number(m.w);
    const x = Number(m.x);
    const c = Number(m.c);
    if (![w, x, c].every(Number.isFinite)) return null;
    return { w: round(clamp(w, 0, 1e7), 1e4), x: round(clamp(x, 0, 1e6), 1e4), c: round(clamp(c, 0, room.set.seconds + 5), 10) };
  };

  // ---------- the browsers ----------
  function take(cl) {
    const t = now();
    cl.tokens = Math.min(L.msgBurst, cl.tokens + ((t - cl.refillAt) / 1000) * L.msgPerSec);
    cl.refillAt = t;
    if (cl.tokens < 1) return false;
    cl.tokens -= 1;
    return true;
  }
  function onMessage(cl, data, binary) {
    if (!clients.has(cl)) return undefined;
    if (binary || data.length > L.maxMsgBytes) {
      S.closedSpam += 1;
      return drop(cl, 'bad message');
    }
    if (!take(cl)) {
      S.closedSpam += 1;
      return drop(cl, 'too many messages');
    }
    let m;
    try {
      m = JSON.parse(String(data));
    } catch {
      return err(cl, 'bad');
    }
    if (!m || typeof m !== 'object' || m.v !== 1 || typeof m.op !== 'string' || !Object.hasOwn(ops, m.op)) return err(cl, 'bad');
    return ops[m.op](cl, m);
  }
  function attach(ws, ip = '?') {
    const cl = { ws, ip: String(ip), alive: true, tokens: L.msgBurst, refillAt: now(), room: null, seat: null };
    clients.add(cl);
    ws.on('pong', () => {
      cl.alive = true;
    });
    ws.on('message', (data, binary) => onMessage(cl, data, binary));
    ws.on('close', () => detach(cl));
    ws.on('error', () => {});
    return cl;
  }
  // a dropped connection: its seat kept a minute for it (resume), its numbers kept on the board
  function detach(cl) {
    if (!clients.delete(cl)) return;
    const room = cl.room;
    if (!room) return;
    cl.seat.cl = null;
    cl.seat.goneAt = now();
    cl.room = null;
    cl.seat = null;
    room.dirty = true;
    if (!seated(room).length) room.emptyAt = now();
    tellRoom(room);
  }
  function drop(cl, why) {
    detach(cl);
    try {
      if (why === 'slow' || why === 'no pong') cl.ws.terminate();
      else cl.ws.close(1008, why);
    } catch {
      // gone already
    }
  }

  // ---------- the clock: countdowns, standings, the end of a race, rooms that are done ----------
  function tick() {
    const t = now();
    for (const room of [...rooms.values()]) {
      let changed = false;
      if (between(room)) {
        for (const s of room.seats.filter((x) => !x.cl && t - x.goneAt > L.resumeMs)) {
          unseat(room, s);
          changed = true;
        }
      }
      if (room.state === 'countdown' && t >= room.startAt) {
        room.state = 'racing';
        changed = true;
      }
      if (room.state === 'racing' && t >= room.endAt) finishRace(room, 'time');
      else if ((room.state === 'racing' || room.state === 'countdown') && room.dirty && t - room.boardAt >= L.boardMs) {
        room.dirty = false;
        room.boardAt = t;
        toSeats(room, 'board', { at: t, rows: rowsOf(room) });
      }
      if (!seated(room).length) {
        if (!room.emptyAt) room.emptyAt = t;
        if (t - room.emptyAt >= L.emptyMs) {
          rooms.delete(room.code);
          continue;
        }
      }
      if (room.state === 'lobby' && t - room.born >= L.lobbyMs) {
        close(room, 'expired');
        continue;
      }
      if (room.state === 'ended' && t - room.endedAt >= L.endedMs) {
        close(room, 'expired');
        continue;
      }
      if (changed) tellRoom(room);
    }
  }
  const tickT = setInterval(tick, tickMs);
  const pingT = setInterval(() => {
    for (const cl of [...clients]) {
      if (!cl.alive) {
        drop(cl, 'no pong');
        continue;
      }
      cl.alive = false;
      try {
        cl.ws.ping();
      } catch {
        // the close event follows
      }
    }
  }, pingMs);
  if (log) log.info(`race rooms open: ${L.perRoom} seats a room, at most ${L.max} rooms`);

  return {
    attach,
    tick,
    get players() {
      return clients.size;
    },
    stats() {
      let racing = 0;
      for (const r of rooms.values()) if (r.state === 'racing' || r.state === 'countdown') racing += 1;
      return { rooms: rooms.size, players: clients.size, racing, created: S.created, races: S.races, droppedSpam: S.closedSpam };
    },
    room: (code) => rooms.get(code) || null, // (for the tests)
    // the relay stopping (an update): every room ends, each player's run goes on in their browser
    close() {
      clearInterval(tickT);
      clearInterval(pingT);
      for (const cl of [...clients]) {
        send(cl, 'bye', { why: 'restart' });
        try {
          cl.ws.close(1001, 'restart');
        } catch {
          // gone already
        }
      }
      clients.clear();
      rooms.clear();
    },
  };
}
