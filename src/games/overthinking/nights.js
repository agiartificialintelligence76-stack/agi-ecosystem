// OVERTHINKING: her nights. A night runs from 12:00 AM to sunrise at 6:00 AM, an hour every 35 seconds. The week has
// seven of them, each with one new thing to deal with; Insomnia never ends; the Daily is the same night for everyone on
// a date; Zen has nothing to lose. Each is a small table the rules (./sim.js) read hour by hour: which kinds of thought
// she has, how fast they come, how restless they are, which odd ones turn up and what happens on the hour.
// Pure (no DOM, no clock of its own): tests/overthinking.test.js reads it in Node.
import { KIND_ORDER } from './kinds.js';

export const HOUR = 35;            // seconds of play to an hour of her night
export const NIGHT_HOURS = 6;      // 12 AM → 6 AM
export const CAP = 40;             // how many thoughts her context holds

const F = Object.freeze;
const six = (v) => (Array.isArray(v) ? v : [v, v, v, v, v, v]);
const hourOf = (arr, h) => arr[Math.min(arr.length - 1, Math.max(0, h))];

// The week. `order`: the kinds she has, in the order they join; `kinds`: how many of them each hour; `rate`: thoughts a
// second; `speed`: how restless; `join`: how often a new thought turns up beside its own kind (easier trains of
// thought); `special`: seconds between the odd ones (0: none that hour); `events`: what happens during each hour;
// `stars`: the score for two and three stars (one star is the sunrise itself).
export const NIGHTS = F([
  F({
    id: 1, day: 'Monday', title: 'The “k.”', blurb: 'you replied “k.” at 11:58 pm. she has questions.',
    order: ['heart', 'star', 'moon', 'cookie'], kinds: [3, 3, 3, 4, 4, 4],
    rate: [0.42, 0.5, 0.58, 0.66, 0.74, 0.82], speed: [1, 1, 1, 1.04, 1.07, 1.1], join: 0.42,
    special: { eureka: [0, 0, 40, 40, 36, 36], tea: [0, 0, 0, 0, 44, 44] },
    events: { 1: ['ping'], 3: ['snack'], 5: ['clarity'] }, stars: [14000, 25000],
  }),
  F({
    id: 2, day: 'Tuesday', title: 'Cringe hour', blurb: 'a memory from 2019 just walked in. uninvited.',
    order: ['heart', 'star', 'moon', 'cookie'], kinds: [3, 4, 4, 4, 4, 4],
    rate: [0.46, 0.55, 0.64, 0.73, 0.82, 0.9], speed: [1, 1.02, 1.05, 1.08, 1.1, 1.12], join: 0.4,
    special: { cringe: [15, 14, 13, 12, 11, 10], eureka: [0, 44, 44, 40, 40, 36], breath: [0, 0, 50, 50, 46, 46] },
    events: { 2: ['cringes'], 4: ['ping'] }, stars: [20000, 40000],
  }),
  F({
    id: 3, day: 'Wednesday', title: 'Earworm', blurb: 'one chorus. eight seconds. on loop since dinner.',
    order: ['star', 'note', 'heart', 'cookie', 'moon'], kinds: [3, 4, 4, 4, 5, 5],
    rate: [0.52, 0.62, 0.72, 0.82, 0.92, 1.0], speed: [1, 1.03, 1.06, 1.09, 1.12, 1.15], join: 0.38,
    special: { cringe: [0, 0, 20, 18, 16, 15], eureka: [40, 40, 38, 38, 36, 36], tea: [0, 48, 48, 46, 46, 44] },
    events: { 0: ['song'], 1: ['song'], 2: ['song'], 3: ['song', 'snack'], 4: ['song'], 5: ['song', 'clarity'] }, stars: [23000, 44000],
  }),
  F({
    id: 4, day: 'Thursday', title: 'What if', blurb: 'what if. what if what if. (what if?)',
    order: ['heart', 'moon', 'star', 'cookie', 'note'], kinds: [3, 4, 4, 5, 5, 5],
    rate: [0.56, 0.67, 0.78, 0.89, 1.0, 1.1], speed: [1, 1.03, 1.06, 1.1, 1.13, 1.16], join: 0.36,
    special: { whatif: [12, 11, 10, 9, 9, 8], cringe: [0, 0, 20, 18, 16, 14], eureka: [42, 42, 40, 40, 38, 38], breath: [0, 50, 50, 48, 48, 46] },
    events: { 2: ['whatifs'], 4: ['whatifs', 'ping'] }, stars: [24000, 45000],
  }),
  F({
    id: 5, day: 'Friday', title: 'Group chat', blurb: '47 new messages. she muted it. she is reading it.',
    order: ['heart', 'star', 'cookie', 'cat', 'note'], kinds: [4, 4, 4, 5, 5, 5],
    rate: [0.6, 0.72, 0.84, 0.96, 1.08, 1.2], speed: [1.02, 1.05, 1.08, 1.11, 1.14, 1.17], join: 0.36,
    special: { phone: [26, 24, 22, 21, 20, 18], cringe: [0, 20, 18, 16, 15, 14], eureka: [42, 42, 40, 40, 38, 38], tea: [0, 50, 48, 48, 46, 46] },
    events: { 0: ['ping'], 1: ['ping'], 2: ['ping', 'zoomies'], 3: ['ping'], 4: ['ping', 'snack'], 5: ['ping', 'ping'] }, stars: [32000, 64000],
  }),
  F({
    id: 6, day: 'Saturday', title: 'Espresso at 9 pm', blurb: 'it seemed like a good idea at 9 pm.',
    order: ['cat', 'heart', 'star', 'note', 'cookie'], kinds: [4, 4, 5, 5, 5, 5],
    rate: [0.64, 0.79, 0.94, 1.09, 1.24, 1.38], speed: [1.24, 1.28, 1.32, 1.36, 1.4, 1.45], join: 0.34,
    special: { cringe: [18, 17, 16, 15, 14, 13], whatif: [0, 0, 16, 15, 14, 13], eureka: [40, 40, 38, 38, 36, 36], breath: [44, 44, 42, 42, 40, 40] },
    events: { 0: ['zoomies'], 1: ['zoomies'], 2: ['zoomies', 'song'], 3: ['zoomies'], 4: ['zoomies', 'cringes'], 5: ['zoomies', 'song'] }, stars: [32000, 64000],
  }),
  F({
    id: 7, day: 'Sunday', title: 'Sunday scaries', blurb: 'monday exists. she just remembered.',
    order: ['heart', 'star', 'moon', 'cookie', 'cat', 'note'], kinds: [4, 5, 5, 6, 6, 6],
    rate: [0.74, 0.94, 1.14, 1.34, 1.54, 1.72], speed: [1.05, 1.09, 1.13, 1.17, 1.21, 1.25], join: 0.33,
    special: { cringe: [16, 15, 14, 13, 12, 11], whatif: [0, 15, 14, 13, 12, 11], phone: [0, 0, 28, 26, 24, 22], eureka: [40, 40, 38, 38, 36, 36], breath: [0, 46, 46, 44, 44, 42], tea: [0, 0, 50, 48, 48, 46] },
    events: { 0: ['ping'], 1: ['song'], 2: ['zoomies', 'whatifs'], 3: ['snack', 'cringes'], 4: ['song', 'ping'], 5: ['zoomies', 'cringes', 'clarity'] }, stars: [36000, 78000],
  }),
]);
export const nightOf = (id) => NIGHTS.find((n) => n.id === id) || null;
export const MAX_STARS = NIGHTS.length * 3;

// one of the week's nights as the rules read it
function nightConfig(n) {
  const rate = six(n.rate), speed = six(n.speed), kinds = six(n.kinds);
  return {
    mode: 'night', night: n.id, hours: NIGHT_HOURS, hourLen: HOUR, cap: CAP, startHour: 0, zen: false,
    initial: [3, 3, 3],
    at(h) {
      const special = {};
      for (const [k, v] of Object.entries(n.special || {})) special[k] = hourOf(six(v), h);
      return { kinds: n.order.slice(0, hourOf(kinds, h)), rate: hourOf(rate, h), speed: hourOf(speed, h), join: n.join, special };
    },
    events(h, rnd) { return spread(n.events?.[h] || [], rnd); },
  };
}

// what happens during an hour, spread over it (never in its first or last few seconds)
function spread(list, rnd) {
  const out = [];
  list.forEach((type, i) => {
    const slot = (HOUR - 12) / list.length;
    out.push({ at: 6 + slot * i + rnd() * Math.max(1, slot - 4), type });
  });
  return out;
}

// Insomnia: it only gets later. Every two hours another kind of thought, and they come faster, are more restless, and
// bring more of the odd ones with them.
const INSOMNIA_EVENTS = [['ping'], ['snack'], ['song'], ['zoomies'], ['clarity'], ['cringes'], ['whatifs'], ['ping', 'song'], ['zoomies', 'snack']];
function insomniaAt(h, twist) {
  const n = Math.min(6, 4 + Math.floor(h / 2));
  let kinds = KIND_ORDER.slice(0, n);
  if (twist === 'cats' && !kinds.includes('cat')) kinds = ['cat', ...kinds.slice(0, n - 1)];
  if (twist === 'conga' && !kinds.includes('note')) kinds = ['note', ...kinds.slice(0, n - 1)];
  const every = (from, start, floor, per = 1) => (h >= from ? Math.max(floor, start - (h - from) * per) : 0);
  const special = {
    cringe: every(twist === 'cringe' ? 0 : 2, twist === 'cringe' ? 11 : 16, 6.5),
    whatif: every(twist === 'whatif' ? 0 : 4, twist === 'whatif' ? 11 : 16, 7),
    phone: every(6, 30, 15),
    eureka: twist === 'calm' ? 22 : 38,
    breath: every(1, 48, 34),
    tea: twist === 'calm' ? 26 : every(2, 52, 36),
  };
  return {
    kinds,
    rate: (twist === 'calm' ? 0.9 : 0.78) + 0.17 * h + 0.004 * h * h,
    speed: Math.min(1.75, 1 + 0.035 * h),
    join: Math.max(0.24, 0.42 - 0.012 * h),
    special,
  };
}
function insomniaEvents(h, rnd, twist) {
  if (h === 0) return twist === 'conga' ? spread(['song'], rnd) : [];
  let list = INSOMNIA_EVENTS[Math.floor(rnd() * Math.min(INSOMNIA_EVENTS.length, 2 + h))].slice();
  if (twist === 'cats') list.push('zoomies');
  if (twist === 'conga') list.push('song');
  if (h >= 8 && rnd() < 0.5) list.push(rnd() < 0.5 ? 'cringes' : 'whatifs');
  return spread(list, rnd);
}
const endless = (mode, twist = null) => ({
  mode, twist, hours: Infinity, hourLen: HOUR, cap: CAP, startHour: 0, zen: false, initial: [3, 3, 3],
  at: (h) => insomniaAt(h, twist),
  events: (h, rnd) => insomniaEvents(h, rnd, twist),
});

// the Daily's twists: one a day, the same for everyone on that date
export const TWISTS = F([
  F({ id: 'cats', name: 'Zoomies night', blurb: 'her cat has opinions tonight.' }),
  F({ id: 'cringe', name: 'Cringe compilation', blurb: 'every embarrassing memory, back for a reunion.' }),
  F({ id: 'conga', name: 'Stuck on repeat', blurb: 'the same song. all night.' }),
  F({ id: 'whatif', name: 'What-if spiral', blurb: 'what if what if what if.' }),
  F({ id: 'calm', name: 'Chamomile', blurb: 'more tea, more eurekas, more thoughts.' }),
]);

// a date as the player's own calendar says it (YYYY-MM-DD), its seed, and its twist
export const dateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export function hashOf(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) || 1;
}
export const dailySeed = (key) => hashOf(`overthinking:${key}`);
export const dailyTwist = (key) => TWISTS[hashOf(`twist:${key}`) % TWISTS.length];
// the day before a date key, as a date key (for the Daily's streak)
export function dayBefore(key) {
  const [y, m, d] = key.split('-').map(Number);
  return dateKey(new Date(y, m - 1, d - 1));
}

// Zen: nothing to lose. A new kind every hour until all six are there; the rules keep about sixteen thoughts around
const zenConfig = () => ({
  mode: 'zen', hours: Infinity, hourLen: HOUR, cap: CAP, startHour: 0, zen: true, zenTarget: 16, initial: [3, 3, 3],
  at: (h) => ({ kinds: KIND_ORDER.slice(0, Math.min(6, 3 + h)), rate: 0.9, speed: 0.92, join: 0.46, special: { eureka: 30, tea: 40 } }),
  events: (h, rnd) => (h > 0 && h % 2 === 0 ? spread([['song'], ['snack'], ['ping']][Math.floor(rnd() * 3)], rnd) : []),
});

// the title screen and the arcade's preview: a busy mind near dawn, played by the game itself
const showConfig = (mode) => ({
  mode, hours: Infinity, hourLen: HOUR, cap: CAP, startHour: mode === 'demo' ? 4.72 : 1.4, zen: true, zenTarget: mode === 'demo' ? 22 : 17,
  initial: mode === 'demo' ? [5, 5, 4, 4] : [4, 3, 3, 3],
  at: () => ({ kinds: ['heart', 'star', 'cat', 'moon', 'note'], rate: mode === 'demo' ? 2.1 : 1.15, speed: 1.05, join: 0.55, special: { eureka: mode === 'demo' ? 9 : 26 } }),
  events: () => [],
});

// what a run plays by: { mode: 'night', night } · 'insomnia' · 'daily' (with its date key) · 'zen' · 'demo' · 'title'
export function makeConfig({ mode = 'night', night = 1, key = '' } = {}) {
  if (mode === 'night') return nightConfig(nightOf(night) || NIGHTS[0]);
  if (mode === 'daily') return { ...endless('daily', dailyTwist(key).id), key };
  if (mode === 'zen') return zenConfig();
  if (mode === 'demo' || mode === 'title') return showConfig(mode);
  return endless('insomnia');
}

// ---------- her clock ----------
// seconds of play → where the night is: minutes since the first midnight, the hour of the day, which day
export function clockAt(clock, { hourLen = HOUR, startHour = 0 } = {}) {
  const mins = Math.max(0, Math.floor((clock / hourLen + startHour) * 60));
  return { mins, day: Math.floor(mins / 1440), h24: Math.floor((mins % 1440) / 60), mm: mins % 60 };
}
// "12:05 AM" (to the nearest `step` minutes below, so it doesn't flicker)
export function clockLabel(clock, opts = {}) {
  const { h24, mm } = clockAt(clock, opts);
  const step = opts.step || 5;
  const m = Math.floor(mm / step) * step;
  return `${h24 % 12 === 0 ? 12 : h24 % 12}:${String(m).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
}
// "1 AM" for an hour of the night
export function hourLabel(h, startHour = 0) {
  const h24 = ((Math.floor(h + startHour) % 24) + 24) % 24;
  return `${h24 % 12 === 0 ? 12 : h24 % 12} ${h24 < 12 ? 'AM' : 'PM'}`;
}
// "3h 12m" she has been awake
export function awakeLabel(clock, hourLen = HOUR) {
  const mins = Math.max(0, Math.floor((clock / hourLen) * 60));
  return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
}

// a night's stars: one for the sunrise, two and three for its scores
export function starsFor(night, { won, score }) {
  const n = nightOf(night);
  if (!n || !won) return 0;
  return 1 + (score >= n.stars[0] ? 1 : 0) + (score >= n.stars[1] ? 1 : 0);
}
