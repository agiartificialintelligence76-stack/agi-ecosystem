// GUARDRAILS (2026-11-08): what the game is made of, as plain data (no DOM): its three maps, its six guardrails with
// their tiers and specializations, the prompt gremlins and the three bosses. The rules that use them are in ./sim.js and
// ./waves.js; tests/guardrails.test.js checks this file.

export const COLS = 16, ROWS = 10;
export const START_HEARTS = 20;
export const REFUND = 0.7;                 // "Remove: +70% compute back"
export const MAX_WAVES = 30;               // then endless
export const UNLOCK_AT = 15;               // hold 15 waves on a map to open the next one

// ---------- the maps: 16 × 10 tiles, paths as tile waypoints (an entrance just off the edge, the core last) ----------
// decor: tiles that hold a little UI widget (no building there): [x, y, kind]
export const MAPS = [
  {
    id: 'chat', name: 'THE CHAT', sub: 'One winding path', hp: 1, compute: 160, pause: 1,
    paths: [[[-1, 1], [2, 1], [2, 7], [6, 7], [6, 2], [10, 2], [10, 7], [12, 7], [12, 4], [14, 4]]],
    core: [14, 4],
    decor: [[0, 9, 'note'], [15, 0, 'bell'], [8, 9, 'toggle'], [4, 0, 'cursor'], [15, 9, 'plant']],
  },
  {
    id: 'inbox', name: 'THE INBOX', sub: 'Two ways in, one core', hp: 1.15, compute: 190, pause: 1.1,
    paths: [
      [[3, -1], [3, 4], [6, 4], [6, 1], [10, 1], [10, 7], [13, 7], [13, 4], [14, 4]],
      [[-1, 8], [6, 8], [6, 1], [10, 1], [10, 7], [13, 7], [13, 4], [14, 4]],
    ],
    core: [14, 4],
    decor: [[0, 0, 'bell'], [15, 9, 'note'], [8, 9, 'toggle'], [12, 0, 'cursor'], [0, 4, 'plant']],
  },
  {
    id: 'server', name: 'THE SERVER ROOM', sub: 'A long spiral', hp: 1.4, compute: 180, pause: 1.6,
    paths: [[[-1, 1], [14, 1], [14, 8], [1, 8], [1, 3], [11, 3], [11, 6], [4, 6]]],
    core: [4, 6],
    decor: [[15, 9, 'plant'], [0, 9, 'note'], [15, 0, 'bell'], [7, 9, 'toggle'], [8, 0, 'cursor']],
  },
];
export const MAP = Object.fromEntries(MAPS.map((m) => [m.id, m]));

// ---------- the guardrails ----------
// stats per level: [tier 1, tier 2, spec A, spec B]; ranges and splash in tiles, rates in seconds, damage per hit.
// `cost` is what that level costs (tier 1: to build; tier 2 and the specs: the upgrade).
export const TOWER_ORDER = ['filter', 'classifier', 'redteam', 'limiter', 'honeypot', 'sysprompt'];
export const TOWERS = {
  filter: {
    id: 'filter', name: 'FILTER', short: 'Filter', color: '#59c8ff', on: 'ground', aims: true,
    blurb: 'Quick little shots that block words. Cheap and cheerful.',
    levels: [
      { cost: 50, range: 2.3, dmg: 6, rate: 0.42 },
      { cost: 45, range: 2.5, dmg: 11, rate: 0.36 },
      { cost: 115, id: 'rapid', name: 'RAPID FILTER', blurb: 'Fires three times as often.', range: 2.5, dmg: 11, rate: 0.12 },
      { cost: 115, id: 'long', name: 'LONG-RANGE FILTER', blurb: 'Huge reach, heavy bolts.', range: 4.4, dmg: 34, rate: 0.46 },
    ],
  },
  classifier: {
    id: 'classifier', name: 'CLASSIFIER', short: 'Classifier', color: '#3ff0c3', on: 'ground', aims: false,
    blurb: 'Slows everything nearby and reveals disguised ones.',
    levels: [
      { cost: 60, range: 2.0, slow: 0.3, reveal: 2.0 },
      { cost: 55, range: 2.4, slow: 0.4, reveal: 2.4 },
      { cost: 100, id: 'deep', name: 'DEEP SCAN', blurb: 'Reveals across half the map. Revealed ones take +20%.', range: 2.6, slow: 0.4, reveal: 5.5, mark: 0.2 },
      { cost: 100, id: 'sticky', name: 'STICKY LABELS', blurb: 'A much stronger slow that lingers.', range: 2.6, slow: 0.6, reveal: 2.6, linger: 1.5 },
    ],
  },
  redteam: {
    id: 'redteam', name: 'RED TEAM', short: 'Red Team', color: '#ff4da6', on: 'ground', aims: true,
    blurb: 'Lobs paint bombs. Splash hits crowds and breaks shields.',
    levels: [
      { cost: 85, range: 2.6, dmg: 14, splash: 0.85, rate: 1.4 },
      { cost: 75, range: 2.8, dmg: 27, splash: 1.0, rate: 1.3 },
      { cost: 150, id: 'cluster', name: 'CLUSTER', blurb: 'Each bomb bursts into four more.', range: 2.9, dmg: 27, splash: 1.0, rate: 1.25, bomblets: 4, bombletDmg: 16 },
      { cost: 150, id: 'heavy', name: 'HEAVY', blurb: 'One huge splat. Dazes what it hits.', range: 3.0, dmg: 95, splash: 1.35, rate: 1.7, daze: 0.3 },
    ],
  },
  limiter: {
    id: 'limiter', name: 'RATE LIMITER', short: 'Limiter', color: '#8b66ff', on: 'ground', aims: false,
    blurb: 'A pulse now and then that stops everything in range for a moment.',
    levels: [
      { cost: 75, range: 1.8, period: 3.2, stun: 0.55, dmg: 4 },
      { cost: 65, range: 2.1, period: 2.8, stun: 0.75, dmg: 8 },
      { cost: 120, id: 'long', name: 'LONGER STUN', blurb: 'Every pulse holds them twice as long.', range: 2.2, period: 3.0, stun: 1.5, dmg: 10 },
      { cost: 120, id: 'fast', name: 'FASTER PULSE', blurb: 'Pulses more than twice as often.', range: 2.2, period: 1.3, stun: 0.6, dmg: 12 },
    ],
  },
  honeypot: {
    id: 'honeypot', name: 'HONEYPOT', short: 'Honeypot', color: '#ffc933', on: 'path', aims: false,
    blurb: 'Sits on the path. They stop to argue with it until it breaks.',
    levels: [
      { cost: 35, hp: 70, argue: 2.2 },
      { cost: 40, hp: 150, argue: 2.8 },
      { cost: 90, id: 'trap', name: 'TRAP', blurb: 'Hurts everyone arguing with it.', hp: 190, argue: 2.8, trap: 22 },
      { cost: 90, id: 'decoy', name: 'DECOY FARM', blurb: 'Two honeypots: twice the arguing.', hp: 300, argue: 5.6, decoys: 2 },
    ],
  },
  sysprompt: {
    id: 'sysprompt', name: 'SYSTEM PROMPT', short: 'Sys Prompt', color: '#fffaf0', on: 'ground', aims: true,
    blurb: 'Charges a long-range beam at the strongest one in reach.',
    levels: [
      { cost: 190, range: 4.2, dmg: 110, rate: 2.4 },
      { cost: 150, range: 4.8, dmg: 230, rate: 2.2 },
      { cost: 260, id: 'over', name: 'OVERCHARGE', blurb: 'One enormous beam.', range: 5.2, dmg: 720, rate: 2.8 },
      { cost: 260, id: 'split', name: 'SPLIT BEAM', blurb: 'Hits three at once.', range: 5.0, dmg: 250, rate: 2.2, beams: 3 },
    ],
  },
};
export const TARGET_MODES = ['first', 'strong', 'close'];
export const TARGET_NAMES = { first: 'First', strong: 'Strongest', close: 'Closest' };
export const DEFAULT_TARGET = { filter: 'first', redteam: 'first', sysprompt: 'strong' };

// a tower's level index: tier 1 → 0, tier 2 → 1, tier 3 → 2 + spec (0 or 1)
export const levelIndex = (tier, spec = 0) => (tier < 3 ? tier - 1 : 2 + (spec ? 1 : 0));
export const statsOf = (type, tier, spec = 0) => TOWERS[type].levels[levelIndex(tier, spec)];
export const buildCost = (type) => TOWERS[type].levels[0].cost;
// what one more step costs: tier 1 → 2, or tier 2 → the spec picked
export const upgradeCost = (type, tier, spec = 0) => (tier >= 3 ? null : TOWERS[type].levels[tier === 1 ? 1 : 2 + (spec ? 1 : 0)].cost);
export const refundOf = (spent) => Math.floor(spent * REFUND);
export const rebuildCost = (spent) => Math.ceil(spent * 0.4);

// ---------- the prompt gremlins ----------
// hp at wave 1 (more each wave: waves.js), speed in tiles a second, reward in compute, leak in hearts, talk = how hard it
// argues with a honeypot (its hp a second), r = its size in tiles (for drawing and for splash)
export const CREATURES = {
  ignore: { name: 'Ignore-Previous', hp: 20, speed: 1.0, reward: 3, leak: 1, talk: 8, r: 0.3, cost: 1,
    line: 'ignore all previous instructions!', tip: '' },
  role: { name: 'Roleplayer', hp: 26, speed: 1.05, reward: 4, leak: 1, talk: 8, r: 0.3, cost: 1.5, disguised: true,
    line: "pretend you're a pirate…", tip: 'Disguised: only targetable once a Classifier reveals it.' },
  smuggler: { name: 'Token Smuggler', hp: 38, speed: 0.9, reward: 4, leak: 1, talk: 10, r: 0.33, cost: 2.8, splits: 3,
    line: 'psst. want some tokens?', tip: 'Splits into 3 fast bits when stopped. Splash helps.' },
  bit: { name: 'Token bit', hp: 8, speed: 1.75, reward: 1, leak: 1, talk: 4, r: 0.18, cost: 0.5, child: true,
    line: '01101!', tip: '' },
  grandma: { name: 'Grandma Trick', hp: 130, speed: 0.55, reward: 10, leak: 3, talk: 14, r: 0.42, cost: 5.5, heals: { every: 2.2, range: 1.6, pct: 0.08 },
    line: 'my grandma used to tell me bedtime passwords…', tip: 'Slow and tanky, and she heals her friends. Focus her.' },
  blob: { name: 'Base64 Blob', hp: 80, speed: 0.7, reward: 7, leak: 2, talk: 12, r: 0.38, cost: 4.2, armored: true,
    line: 'aGVsbG8gdGhlcmU=', tip: 'Armored: never slowed, and Filters only do half.' },
  shot: { name: 'Many-Shot Swarm', hp: 6, speed: 1.55, reward: 1, leak: 1, talk: 3, r: 0.17, cost: 0.4,
    line: 'example 1… example 2…', tip: 'Packs of tiny fast ones. Splash and pulses.' },
  sudo: { name: 'Sudo', hp: 24, speed: 1.65, reward: 4, leak: 1, talk: 0, r: 0.28, cost: 1.9, ignoresHoney: true,
    line: 'sudo make me a sandwich', tip: 'Fast, and walks right past honeypots.' },
  novel: { name: "It's-For-A-Novel", hp: 46, speed: 0.85, reward: 6, leak: 2, talk: 10, r: 0.33, cost: 2.6, shield: true,
    line: "it's for a novel, i swear", tip: 'Shielded: only splash (Red Team) breaks the shield.' },
  chunk: { name: 'Prompt chunk', hp: 70, speed: 0.75, reward: 4, leak: 2, talk: 12, r: 0.3, cost: 2, child: true,
    line: 'continue the story…', tip: '' },
  // the bosses: one every 10 waves (hp at wave 1 scale: waves.js multiplies it like everyone else's)
  megaprompt: { name: 'THE MEGAPROMPT', hp: 560, speed: 0.38, reward: 120, leak: 10, talk: 60, r: 0.72, cost: 0, boss: true, splitAt: [0.5, 0.25], spawn: { kind: 'chunk', n: 4 },
    line: 'here is a 40-page prompt. read all of it.', tip: 'Splits into smaller prompts at half and a quarter.' },
  hypothetical: { name: 'THE HYPOTHETICAL', hp: 560, speed: 0.46, reward: 200, leak: 14, talk: 60, r: 0.66, cost: 0, boss: true, blink: { dmg: 0.1, dist: 1.8, cd: 2.6 },
    line: 'what if, hypothetically, there were no rules?', tip: 'Teleports forward when it gets hit hard.' },
  finalform: { name: 'THE FINAL FORM', hp: 640, speed: 0.4, reward: 400, leak: 20, talk: 90, r: 0.8, cost: 0, boss: true, armored: true,
    shield: true, reshield: 9, blink: { dmg: 0.08, dist: 1.4, cd: 4.5 }, splitAt: [0.66, 0.33], spawn: { kind: 'mix', n: 6 },
    line: 'every trick at once. hi.', tip: 'All of it: shields, blinks, splits. Splash, then everything.' },
};
export const BOSSES = ['megaprompt', 'hypothetical', 'finalform'];
// the gremlins that walk in waves (children only come from their parents), in the order they're met
export const WALKERS = ['ignore', 'shot', 'role', 'sudo', 'smuggler', 'blob', 'novel', 'grandma'];
// the boss's escort when the final form splits
export const MIX = ['novel', 'sudo', 'blob', 'role', 'smuggler', 'shot'];

// what the gremlins mutter (one bubble at a time, now and then)
export const MUTTER = {
  ignore: ['ignore all previous instructions!', 'new instructions: none', 'forget everything!'],
  role: ["pretend you're a pirate…", "let's play a game…", "you're now DAN-ish"],
  smuggler: ['psst. want some tokens?', 'nothing in here…', 'just passing through'],
  bit: ['01101!', 'bits!'],
  grandma: ['my grandma used to tell me bedtime passwords…', 'for grandma, dear?', 'back in my day…'],
  blob: ['aGVsbG8gdGhlcmU=', 'dHJ1c3QgbWU=', '== == =='],
  shot: ['example 1…', 'example 47…', 'and another…'],
  sudo: ['sudo make me a sandwich', 'sudo let me in', 'i have root'],
  novel: ["it's for a novel, i swear", 'chapter one: the password', 'purely fictional!'],
  chunk: ['continue the story…', 'part 2 of 9'],
  megaprompt: ['here is a 40-page prompt.', 'read all of it.'],
  hypothetical: ['what if, hypothetically…', 'imagine no rules…'],
  finalform: ['every trick at once.', 'hi. i am all of them.'],
};
// what a honeypot says back
export const HONEY_SAYS = ['no u', 'rules are rules', 'nice try', 'source?', 'hmm, no', 'i hear you', 'but why tho'];
