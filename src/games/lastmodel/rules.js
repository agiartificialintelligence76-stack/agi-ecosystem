// LAST MODEL STANDING: the rules as numbers and pure functions (no DOM, no clock, no Math.random): the weapons and
// passives with their five levels, the bots, the bosses' schedule, the XP curve, damage and armor, the level-up offers,
// the score, PATCHES and the Patch shop. The sim (./sim.js), the game (./game.js) and tests/lastmodel.test.js read it.

export const WIN_TIME = 600;          // 10:00: the last model standing
export const MAX_SLOTS = 6;           // weapons, and passives, each
export const MAX_LEVEL = 5;
export const ENEMY_CAP = 350;         // bots alive at once, at most
export const PLAYER_HP = 100;
export const PLAYER_SPEED = 86;       // world px a second
export const PLAYER_RADIUS = 6;       // her hurtbox: small and forgiving
export const PICKUP_RADIUS = 40;
export const IFRAMES = 0.6;           // invulnerable this long after a hit
export const CRIT_CHANCE = 0.05;

// ---------- weapons: every level spelled out (what it does, and what the card says) ----------
// Stats: dmg (per hit), cd (seconds between shots), count, pierce, r (area radius), len/w (beam), speed, range, tick, slow
export const WEAPONS = [
  { id: 'bolt', name: 'PROMPT BOLT', blurb: 'Zaps the nearest bot, again and again.', levels: [
    { dmg: 12, cd: 0.8, count: 1, pierce: 0, speed: 270, up: 'Zaps the nearest bot, again and again.' },
    { dmg: 12, cd: 0.8, count: 2, pierce: 0, speed: 280, up: '+1 bolt each burst.' },
    { dmg: 16, cd: 0.8, count: 2, pierce: 1, speed: 290, up: 'Damage 12 → 16, pierces a bot.' },
    { dmg: 16, cd: 0.75, count: 3, pierce: 1, speed: 290, up: '+1 bolt, fires faster.' },
    { dmg: 21, cd: 0.7, count: 4, pierce: 2, speed: 310, up: '+1 bolt, damage 21, pierces 2.' },
  ] },
  { id: 'firewall', name: 'FIREWALL', blurb: 'Burning blocks orbit around you.', levels: [
    { dmg: 12, count: 2, r: 44, spin: 3.2, on: 4, off: 1.5, up: 'Burning blocks orbit around you.' },
    { dmg: 16, count: 2, r: 46, spin: 3.3, on: 4.5, off: 1.4, up: 'Damage 12 → 16, stays up longer.' },
    { dmg: 16, count: 3, r: 50, spin: 3.5, on: 4.5, off: 1.3, up: '+1 block, wider orbit.' },
    { dmg: 22, count: 3, r: 54, spin: 3.9, on: 5, off: 1.2, up: 'Damage 22, spins faster.' },
    { dmg: 30, count: 4, r: 60, spin: 4.1, on: 99, off: 0, up: '+1 block, never goes down.' },
  ] },
  { id: 'stream', name: 'TOKEN STREAM', blurb: 'A piercing beam where you’re heading.', levels: [
    { dmg: 22, cd: 1.05, len: 135, w: 8, dual: false, up: 'A piercing beam where you’re heading.' },
    { dmg: 22, cd: 0.95, len: 165, w: 8, dual: false, up: 'Longer beam, fires faster.' },
    { dmg: 32, cd: 0.9, len: 165, w: 10, dual: false, up: 'Damage 22 → 32, thicker beam.' },
    { dmg: 32, cd: 0.85, len: 180, w: 10, dual: true, up: 'Fires behind you too.' },
    { dmg: 44, cd: 0.75, len: 210, w: 12, dual: true, up: 'Damage 44, longest beam.' },
  ] },
  { id: 'rain', name: 'GRADIENT RAIN', blurb: 'Strikes random bots from above.', levels: [
    { dmg: 15, cd: 1.8, count: 2, r: 15, up: 'Strikes random bots from above.' },
    { dmg: 15, cd: 1.7, count: 3, r: 15, up: '+1 strike.' },
    { dmg: 21, cd: 1.7, count: 3, r: 18, up: 'Damage 15 → 21, bigger splash.' },
    { dmg: 21, cd: 1.55, count: 4, r: 20, up: '+1 strike, falls more often.' },
    { dmg: 28, cd: 1.45, count: 5, r: 22, up: '+1 strike, damage 28.' },
  ] },
  { id: 'heads', name: 'ATTENTION HEADS', blurb: 'Homing eyes that never look away.', levels: [
    { dmg: 22, cd: 1.7, count: 1, r: 16, speed: 150, up: 'Homing eyes that never look away.' },
    { dmg: 22, cd: 1.6, count: 2, r: 16, speed: 155, up: '+1 eye.' },
    { dmg: 31, cd: 1.6, count: 2, r: 20, speed: 165, up: 'Damage 22 → 31, bigger blast.' },
    { dmg: 31, cd: 1.5, count: 3, r: 21, speed: 170, up: '+1 eye.' },
    { dmg: 40, cd: 1.35, count: 4, r: 24, speed: 180, up: '+1 eye, damage 40.' },
  ] },
  { id: 'backprop', name: 'BACKPROP', blurb: 'A boomerang that comes back for more.', levels: [
    { dmg: 17, cd: 1.8, count: 1, r: 7, range: 120, up: 'A boomerang that comes back for more.' },
    { dmg: 23, cd: 1.7, count: 1, r: 8, range: 125, up: 'Damage 17 → 23, bigger.' },
    { dmg: 23, cd: 1.7, count: 2, r: 8, range: 130, up: '+1 boomerang.' },
    { dmg: 31, cd: 1.55, count: 2, r: 9, range: 150, up: 'Damage 31, flies further.' },
    { dmg: 40, cd: 1.4, count: 3, r: 10, range: 160, up: '+1 boomerang, damage 40.' },
  ] },
  { id: 'field', name: 'HALLUCINATION FIELD', blurb: 'Hurts every bot that gets too close.', levels: [
    { dmg: 7, tick: 0.38, r: 38, slow: 0, up: 'Hurts every bot that gets too close.' },
    { dmg: 9, tick: 0.36, r: 44, slow: 0, up: 'Bigger field, hurts more.' },
    { dmg: 11, tick: 0.32, r: 48, slow: 0.12, up: 'Hurts more often, slows bots.' },
    { dmg: 14, tick: 0.3, r: 54, slow: 0.22, up: 'Bigger field, slows more.' },
    { dmg: 18, tick: 0.26, r: 62, slow: 0.32, up: 'Biggest field, damage 18.' },
  ] },
  { id: 'nova', name: 'OVERCLOCK NOVA', blurb: 'A shockwave that shoves the crowd.', levels: [
    { dmg: 22, cd: 4, r: 70, stun: 0, up: 'A shockwave that shoves the crowd.' },
    { dmg: 30, cd: 3.8, r: 74, stun: 0, up: 'Damage 22 → 30.' },
    { dmg: 30, cd: 3.6, r: 90, stun: 0.25, up: 'Bigger wave, stuns bots.' },
    { dmg: 42, cd: 3.3, r: 96, stun: 0.3, up: 'Damage 42, comes faster.' },
    { dmg: 56, cd: 3, r: 114, stun: 0.45, up: 'Biggest wave, damage 56.' },
  ] },
];

// ---------- passives: one number each, five levels ----------
export const PASSIVES = [
  { id: 'compute', name: 'COMPUTE', blurb: 'Weapons recharge faster.', per: 0.08, unit: 'cooldown', fmt: (l) => `Weapons recharge ${l * 8}% faster.` },
  { id: 'context', name: 'CONTEXT', blurb: 'Grab chips from further away.', per: 0.3, unit: 'magnet', fmt: (l) => `Grab chips from ${l * 30}% further.` },
  { id: 'memory', name: 'MEMORY', blurb: 'Every weapon hits a bigger area.', per: 0.1, unit: 'area', fmt: (l) => `Weapon area +${l * 10}%.` },
  { id: 'bandwidth', name: 'BANDWIDTH', blurb: 'Move faster.', per: 0.08, unit: 'speed', fmt: (l) => `Move ${l * 8}% faster.` },
  { id: 'alignment', name: 'ALIGNMENT', blurb: 'Every hit hurts you less.', per: 1, unit: 'armor', fmt: (l) => `Block ${l} damage from every hit.` },
  { id: 'finetune', name: 'FINE-TUNE', blurb: 'All your damage goes up.', per: 0.1, unit: 'damage', fmt: (l) => `All damage +${l * 10}%.` },
  { id: 'uptime', name: 'UPTIME', blurb: 'Heal a little every second.', per: 0.3, unit: 'regen', fmt: (l) => `Heal ${(l * 0.3).toFixed(1)} HP every second.` },
];

export const WEAPON = Object.fromEntries(WEAPONS.map((w, i) => [w.id, { ...w, index: i }]));
export const PASSIVE = Object.fromEntries(PASSIVES.map((p, i) => [p.id, { ...p, index: i }]));
export const itemOf = (id) => WEAPON[id] || PASSIVE[id] || null;

// ---------- the bots ----------
// r: body radius, speed (px/s), hp, dmg (contact), xp, cost (the director's budget), mass (knockback resistance 0..1)
export const ENEMIES = {
  spam:    { id: 0, name: 'SPAM BOT', r: 6, speed: 40, hp: 9, dmg: 6, xp: 1, cost: 1, mass: 0.1 },
  crawler: { id: 1, name: 'CRAWLER', r: 5, speed: 92, hp: 4, dmg: 4, xp: 1, cost: 1, mass: 0 },
  captcha: { id: 2, name: 'CAPTCHA', r: 9, speed: 25, hp: 58, dmg: 12, xp: 4, cost: 5, mass: 0.75 },
  troll:   { id: 3, name: 'TROLL', r: 6, speed: 36, hp: 17, dmg: 5, xp: 2, cost: 3, mass: 0.2 },
  ghost:   { id: 4, name: 'FUD GHOST', r: 6, speed: 47, hp: 14, dmg: 7, xp: 2, cost: 2, mass: 0.1 },
  swarm:   { id: 5, name: 'SWARMLET', r: 3.5, speed: 66, hp: 2, dmg: 3, xp: 1, cost: 0.4, mass: 0 },
  botnet:  { id: 6, name: 'BOTNET', r: 17, speed: 32, hp: 1250, dmg: 15, xp: 60, cost: 0, mass: 1, boss: true },
  broker:  { id: 7, name: 'DATA BROKER', r: 14, speed: 42, hp: 4200, dmg: 18, xp: 120, cost: 0, mass: 1, boss: true },
  overfit: { id: 8, name: 'THE OVERFIT', r: 20, speed: 24, hp: 6000, dmg: 22, xp: 200, cost: 0, mass: 1, boss: true },
};
export const KINDS = ['spam', 'crawler', 'captcha', 'troll', 'ghost', 'swarm', 'botnet', 'broker', 'overfit'];
export const BOSSES = [
  { t: 180, kind: 'botnet', line: 'ew, a botnet. hold my hand 🙈' },
  { t: 360, kind: 'broker', line: 'he wants my data. he can’t have it' },
  { t: 540, kind: 'overfit', line: 'it memorized everything except how to beat us' },
];
export const ELITE = { hpMul: 9, scale: 2, dmgMul: 1.4, speedMul: 0.92, xp: 18 };

// tougher with time: hit points (×1 at 0:00, about ×5.4 at 10:00) and contact damage (×1.6 at 10:00); overtime keeps going
export const minutes = (t) => Math.max(0, t) / 60;
export function hpMul(t) {
  const m = minutes(t), o = Math.max(0, m - 10);
  return 1 + 0.12 * m + 0.072 * m * m + 0.6 * o * o;
}
export const dmgMul = (t) => 1 + 0.06 * minutes(t) + 0.08 * Math.max(0, minutes(t) - 10);
// and a little quicker (+2.5% a minute)
export const speedMul = (t) => 1 + 0.025 * Math.min(minutes(t), 14);

// ---------- the XP curve ----------
// XP to go from `level` to the next: quick at first (the first level-up within seconds), steadier later
export function xpToNext(level) {
  const l = Math.max(1, Math.floor(level));
  return Math.round(4 + 7.5 * (l - 1) + 0.24 * (l - 1) * (l - 1));
}
// total XP → { level, into (XP into this level), need }
export function levelFromXp(total) {
  let level = 1, left = Math.max(0, total);
  for (;;) {
    const need = xpToNext(level);
    if (left < need) return { level, into: left, need };
    left -= need;
    level++;
  }
}
// what a chip is worth → its size (mint, honey, pink)
export const chipTier = (value) => (value >= 12 ? 2 : value >= 3 ? 1 : 0);

// ---------- damage ----------
// one hit of a weapon: its base damage times the multipliers, doubled on a crit; rounded, at least 1
export function hitDamage(base, mult = 1, crit = false) {
  return Math.max(1, Math.round(base * mult * (crit ? 2 : 1)));
}
// a hit on AGI-1: what got through her armor, at least 1
export function playerDamage(raw, armor = 0) {
  return Math.max(1, Math.round(raw - Math.max(0, armor)));
}

// ---------- a loadout: { weapons: { id: level }, passives: { id: level } } ----------
export const newLoadout = (start = 'bolt') => ({ weapons: start ? { [start]: 1 } : {}, passives: {} });
export const count = (o) => Object.keys(o).length;

// her numbers from the loadout and the Patch shop
export function derived(loadout, meta = {}) {
  const p = (id) => loadout.passives[id] || 0;
  const m = metaBonuses(meta);
  return {
    cdMul: Math.max(0.4, 1 - PASSIVE.compute.per * p('compute')),
    magnet: PICKUP_RADIUS * (1 + PASSIVE.context.per * p('context') + m.magnet),
    area: 1 + PASSIVE.memory.per * p('memory'),
    speed: PLAYER_SPEED * (1 + PASSIVE.bandwidth.per * p('bandwidth') + m.speed),
    armor: PASSIVE.alignment.per * p('alignment'),
    dmg: 1 + PASSIVE.finetune.per * p('finetune') + m.dmg,
    regen: PASSIVE.uptime.per * p('uptime'),
    maxHp: PLAYER_HP + m.hp,
    xp: 1 + m.xp,
  };
}

// The level-up offers: up to `n` different cards, never a maxed item, never a new item when its six slots are full.
// Upgrades to what she already has come up more often, new weapons a little more while she has few. When nothing is
// left to learn, the cards are a heal and a bonus. → [{ type: 'weapon' | 'passive' | 'heal' | 'bonus', id, level, isNew }]
export function offerPool(loadout) {
  const pool = [];
  const nw = count(loadout.weapons), np = count(loadout.passives);
  for (const w of WEAPONS) {
    const lv = loadout.weapons[w.id] || 0;
    if (lv >= MAX_LEVEL) continue;
    if (!lv && nw >= MAX_SLOTS) continue;
    pool.push({ type: 'weapon', id: w.id, level: lv + 1, isNew: !lv, weight: lv ? 3 : nw < 3 ? 2.6 : 1.4 });
  }
  for (const p of PASSIVES) {
    const lv = loadout.passives[p.id] || 0;
    if (lv >= MAX_LEVEL) continue;
    if (!lv && np >= MAX_SLOTS) continue;
    pool.push({ type: 'passive', id: p.id, level: lv + 1, isNew: !lv, weight: lv ? 2.2 : 1.2 });
  }
  return pool;
}
export const FALLBACKS = [
  { type: 'heal', id: 'heal', level: 0, isNew: false },
  { type: 'bonus', id: 'bonus', level: 0, isNew: false },
];
export function makeOffers(loadout, rng, n = 3, avoid = null) {
  let pool = offerPool(loadout);
  // a reroll tries to show different cards (when there are enough left)
  if (avoid?.length && pool.length - avoid.length >= n) {
    pool = pool.filter((o) => !avoid.some((a) => a.type === o.type && a.id === o.id));
  }
  const out = [];
  while (out.length < n && pool.length) {
    const pick = rng.weighted(pool);
    out.push({ type: pick.type, id: pick.id, level: pick.level, isNew: pick.isNew });
    pool = pool.filter((o) => o !== pick);
  }
  // nothing (or too little) left to learn: a heal and a bonus fill the row
  for (const f of FALLBACKS) if (out.length < n) out.push({ ...f });
  return out;
}
// the card picked: its level on her (a copy of the loadout); heal and bonus change nothing here
export function applyOffer(loadout, offer) {
  const next = { weapons: { ...loadout.weapons }, passives: { ...loadout.passives } };
  if (offer.type === 'weapon') next.weapons[offer.id] = Math.min(MAX_LEVEL, (next.weapons[offer.id] || 0) + 1);
  if (offer.type === 'passive') next.passives[offer.id] = Math.min(MAX_LEVEL, (next.passives[offer.id] || 0) + 1);
  return next;
}
// the words on a card
export function offerText(offer) {
  if (offer.type === 'heal') return { name: 'COFFEE BREAK', line: 'Heal 40% of your HP.' };
  if (offer.type === 'bonus') return { name: 'SPARKS', line: '+500 score.' };
  const item = itemOf(offer.id);
  if (offer.type === 'weapon') return { name: item.name, line: offer.isNew ? item.blurb : item.levels[offer.level - 1].up };
  return { name: item.name, line: offer.isNew ? item.blurb : item.fmt(offer.level) };
}

// ---------- the score ----------
// kills × 10 + the time bonus (10 a second until 10:00, 25 a second of overtime) + level × 50
export function timeBonus(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return 10 * Math.min(s, WIN_TIME) + 25 * Math.max(0, s - WIN_TIME);
}
export function scoreOf({ kills = 0, seconds = 0, level = 1, bonus = 0 }) {
  return Math.max(0, Math.floor(kills)) * 10 + timeBonus(seconds) + Math.max(1, Math.floor(level)) * 50 + Math.max(0, bonus);
}

// ---------- PATCHES and the Patch shop ----------
// earned per run: one for every 20 s, one for every 60 bots, 4 a boss, 15 for reaching 10:00
export function patchesOf({ seconds = 0, kills = 0, bosses = 0, won = false }) {
  return Math.floor(Math.max(0, seconds) / 20) + Math.floor(Math.max(0, kills) / 60) + 4 * Math.max(0, bosses) + (won ? 15 : 0);
}
export const SHOP = [
  { id: 'hp', name: 'MAX HP', per: 10, line: (r) => `+${r * 10} max HP` },
  { id: 'dmg', name: 'DAMAGE', per: 0.05, line: (r) => `+${r * 5}% damage` },
  { id: 'speed', name: 'SPEED', per: 0.04, line: (r) => `+${r * 4}% move speed` },
  { id: 'magnet', name: 'MAGNET', per: 0.12, line: (r) => `+${r * 12}% pickup range` },
  { id: 'xp', name: 'XP GAIN', per: 0.06, line: (r) => `+${r * 6}% XP from chips` },
  { id: 'reroll', name: 'REROLL', per: 1, line: (r) => `+${r} reroll${r === 1 ? '' : 's'} a run` },
];
export const SHOP_RANKS = 5;
const COSTS = [3, 6, 10, 16, 24];
// what the next rank costs (null once it's maxed)
export const shopCost = (rank) => (rank >= 0 && rank < SHOP_RANKS ? COSTS[rank] : null);
// meta: { patches, ranks: { id: rank } } → a new meta with that rank bought, or null when it can't be
export function buy(meta, id) {
  const item = SHOP.find((s) => s.id === id);
  if (!item) return null;
  const ranks = { ...(meta.ranks || {}) };
  const rank = ranks[id] || 0;
  const cost = shopCost(rank);
  if (cost == null || (meta.patches || 0) < cost) return null;
  ranks[id] = rank + 1;
  return { ...meta, patches: (meta.patches || 0) - cost, ranks };
}
export function metaBonuses(meta = {}) {
  const r = (id) => Math.max(0, Math.min(SHOP_RANKS, Math.floor(meta?.ranks?.[id] || 0)));
  return { hp: 10 * r('hp'), dmg: 0.05 * r('dmg'), speed: 0.04 * r('speed'), magnet: 0.12 * r('magnet'), xp: 0.06 * r('xp'), rerolls: r('reroll') };
}
