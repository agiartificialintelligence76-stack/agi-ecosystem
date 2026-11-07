// AGI arcade kit: what a game keeps in this browser (never sent anywhere). One key per game, `agi_arcade:<game>`, and
// one for the arcade's settings, `agi_arcade:settings` (sound, music, vibration: the same in every game).
// Blocked storage (a private window, a sandbox) keeps things for this visit only. A demo (`?demo`) keeps nothing.
import { DEMO } from './env.js';

const NS = 'agi_arcade';
const memory = new Map();

function readKey(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw != null) return JSON.parse(raw);
  } catch { /* blocked or damaged: fall back */ }
  return memory.has(key) ? structuredClone(memory.get(key)) : null;
}
function writeKey(key, value) {
  memory.set(key, structuredClone(value));
  if (DEMO) return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* full or blocked: this visit only */ }
}

// A game's own save: `read()` → an object (empty the first time), `write(obj)`, `update(fn)` (fn gets a copy, returns
// the new one or changes it in place). `best(key)` and `recordBest(key, value, { lower })` for high scores.
export function gameStore(game) {
  const key = `${NS}:${game}`;
  const api = {
    read() { const v = readKey(key); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; },
    write(obj) { writeKey(key, obj); },
    update(fn) {
      const cur = api.read();
      const next = fn(cur) || cur;
      api.write(next);
      return next;
    },
    best(name = 'best') {
      const v = api.read()[name];
      return typeof v === 'number' && Number.isFinite(v) ? v : null;
    },
    // keeps `value` if it beats the kept one (higher, or lower with { lower: true }); → { best, isBest }
    recordBest(name, value, { lower = false } = {}) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return { best: api.best(name), isBest: false };
      const old = api.best(name);
      const isBest = old == null || (lower ? value < old : value > old);
      if (isBest) api.update((d) => { d[name] = value; });
      return { best: isBest ? value : old, isBest: isBest && !(old == null && value === 0) };
    },
    // a counter: how many runs, total score…
    bump(name, by = 1) {
      let n = 0;
      api.update((d) => { n = (Number(d[name]) || 0) + by; d[name] = n; });
      return n;
    },
  };
  return api;
}

const DEFAULTS = Object.freeze({ sound: true, music: true, haptics: true });
const listeners = new Set();
export const settings = {
  get() {
    const v = readKey(`${NS}:settings`);
    return { ...DEFAULTS, ...(v && typeof v === 'object' ? v : {}) };
  },
  set(patch) {
    const next = { ...settings.get(), ...patch };
    writeKey(`${NS}:settings`, next);
    for (const fn of listeners) fn(next);
    return next;
  },
  on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};

// another tab changed the arcade's settings: this one follows
try {
  addEventListener('storage', (e) => {
    if (e.key === `${NS}:settings`) { const s = settings.get(); for (const fn of listeners) fn(s); }
  });
} catch { /* not in a browser (tests) */ }
