// TOO MANY TABS: a player made of code, for the demo (the previews on agi1.app/games), the title's attract board, the
// tests and the balance tool (tools/games/toomanytabs/balance.mjs). It looks at every free tab and scores it: one that
// finishes a three in the taskbar beats everything; one that makes a pair, when a third is free to take, comes next;
// one that frees the most tabs under it breaks ties; a taskbar filling up with nothing pairing makes it careful. It uses
// Tab out when the taskbar is nearly full and nothing closes, and Shuffle when it's stuck.
import { freeTiles, isFree, pick, settle, tabOut, shuffle, undo, revive, TRAY, update, drain } from './rules.js';
import { rng } from '../kit/fx.js';

export const PROFILES = Object.freeze({
  newbie: { look: 0.2, slip: 0.25, helpers: false, speed: 1.6 },
  steady: { look: 1, slip: 0.04, helpers: true, speed: 0.9 },
  expert: { look: 1.4, slip: 0, helpers: true, speed: 0.6 },
});
export const createBot = (profile = 'steady', seed = 1) => ({ p: PROFILES[profile] || PROFILES.steady, rnd: rng(seed ^ 0x7ab5), wait: 0.6 });

function score(S, t, p) {
  const inTray = S.tray.filter((id) => S.tiles[id - 1].kind === t.kind).length;
  const free = freeTiles(S).concat(S.tiles.filter((u) => u.where === 'shelf'));
  const freeSame = free.filter((u) => u.kind === t.kind && u.id !== t.id).length;
  let v = 0;
  if (inTray === 2) v += 100;
  else if (inTray === 1) v += freeSame >= 1 ? 45 : 8;
  else v += freeSame >= 2 ? 22 : freeSame === 1 ? 6 : 1;
  // what it uncovers
  if (t.where === 'board') {
    const under = S.tiles.filter((u) => u.where === 'board' && u.z < t.z && Math.abs(u.x - t.x) < 1 && Math.abs(u.y - t.y) < 1);
    v += under.length * 4 * p.look;
  }
  const crowd = S.tray.length;
  if (inTray === 0 && crowd >= TRAY - 2) v -= 40;
  if (inTray === 0 && freeSame === 0) v -= crowd * 3 * p.look;
  return v;
}

// one decision: a tab to take (its id), or a helper ('out' | 'shuffle' | 'undo'), or null
export function choose(bot, S) {
  const p = bot.p;
  const options = freeTiles(S).concat(S.tiles.filter((t) => t.where === 'shelf'));
  if (!options.length) return null;
  const scored = options.map((t) => ({ t, v: score(S, t, p) + bot.rnd.next() * 0.5 })).sort((a, b) => b.v - a.v);
  if (p.helpers) {
    const best = scored[0];
    if (best.v < 60 && S.tray.length >= TRAY - 2 && S.boosters.out > 0 && S.shelf.length <= 3) return 'out';
    if (best.v < 0 && S.boosters.shuffle > 0 && S.tray.length <= 2) return 'shuffle';
  }
  if (bot.rnd.chance(p.slip)) return bot.rnd.pick(options).id;
  return scored[0].t.id;
}
export function act(bot, S) {
  const c = choose(bot, S);
  if (c === 'out') return tabOut(S);
  if (c === 'shuffle') return shuffle(S);
  if (c === 'undo') return undo(S);
  return c != null && pick(S, c);
}

// a whole board played by a bot → { won, time, score, picks, helpers used }
export function playLevel(S, profile = 'steady', seed = 1) {
  const bot = createBot(profile, seed);
  let picks = 0, guard = 0;
  while (!S.over && guard++ < 2000) {
    update(S, bot.p.speed);
    if (!act(bot, S)) break;
    picks++;
    settle(S);
    if (S.over && !S.won && bot.p.helpers) revive(S);
    drain(S);
  }
  return { won: S.won, time: S.time, score: S.score, picks, revived: S.revived, left: S.boosters };
}
