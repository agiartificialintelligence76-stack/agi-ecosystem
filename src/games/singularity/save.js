// SINGULARITY (2026-11-08): a mind as it's kept in this browser (the kit's store, localStorage `agi_arcade:singularity`,
// under `mind`), never sent anywhere. Pure: plain objects in, plain objects out, so tests/singularity.test.js can check
// the round trip and the migrations without a browser.
//
// Every save says its version. A save from an older version is moved forward step by step (`migrate`), and whatever
// comes back is checked field by field (`fromSave`): numbers that aren't finite, counts that aren't whole, upgrades and
// perks the game doesn't know, perks the Insight can't cover. A save that can't be read at all gives a new mind.
import { N, GENS, UPGRADE_BY_ID, PERKS, PERK_BY_ID, EUREKA } from './data.js';
import { newMind } from './econ.js';

export const SAVE_VERSION = 2;
export const TABS = ['build', 'upgrades', 'insight', 'log'];
export const AMOUNTS = [1, 10, 100, 'max'];
const BIG = 1e300;

const num = (v, max = BIG) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.min(v, max) : 0);
const whole = (v, max = 1e6) => Math.floor(num(v, max));
const list = (v, max = 256) => (Array.isArray(v) ? v.slice(0, max) : []);

// the mind → what's kept
export function toSave(s, { at = 0, ui = {} } = {}) {
  return {
    v: SAVE_VERSION,
    flops: s.flops, run: s.run, all: s.all,
    owned: s.owned.slice(),
    up: [...s.up],
    insight: s.insight, spent: s.spent, perks: [...s.perks], sing: s.sing,
    frenzy: s.frenzy, frenzyMax: s.frenzyMax,
    taps: s.taps, tapsAll: s.tapsAll, eurekas: s.eurekas,
    best: s.best, time: s.time, runTime: s.runTime,
    seen: s.seen, firsts: [...s.firsts], stage: s.stage, ready: Boolean(s.ready),
    nextEureka: s.nextEureka,
    at, ui: { tab: TABS.includes(ui.tab) ? ui.tab : 'build', amount: AMOUNTS.includes(ui.amount) ? ui.amount : 1 },
  };
}

// an older save → this version's shape (or null: nothing we can read)
export function migrate(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  let d = raw;
  // version 1 (the first builds of 2026-11-08): `version`, `compute`, `lifetime`, `everMade`, `machines` by name,
  // `upgrades`, `insight`, `savedAt`
  if (d.version === 1 && d.v == null) {
    d = {
      v: 2,
      flops: d.compute, run: d.lifetime, all: d.everMade ?? d.lifetime,
      owned: GENS.map((g) => (d.machines && typeof d.machines === 'object' ? d.machines[g.id] : 0)),
      up: d.upgrades, insight: d.insight, spent: 0, perks: [], sing: d.insight > 0 ? 1 : 0,
      at: d.savedAt,
    };
  }
  if (d.v !== SAVE_VERSION) return null;
  return d;
}

// what's kept → { mind, at, ui } (null: nothing we can read)
export function fromSave(raw) {
  const d = migrate(raw);
  if (!d) return null;
  const s = newMind();
  s.flops = num(d.flops);
  s.run = num(d.run);
  s.all = Math.max(num(d.all), s.run);
  const owned = list(d.owned, N);
  for (let k = 0; k < N; k++) s.owned[k] = whole(owned[k], 1e5);
  for (const id of list(d.up)) if (typeof id === 'string' && UPGRADE_BY_ID[id]) s.up.add(id);
  s.insight = whole(d.insight, 1e15);
  // perks: known ones whose path is open, in the tree's order, as many as the Insight covers
  const want = new Set(list(d.perks).filter((id) => typeof id === 'string' && PERK_BY_ID[id]));
  for (const p of PERKS) {
    if (!want.has(p.id)) continue;
    const open = !p.after.length || p.after.some((a) => s.perks.has(a));
    if (open && s.spent + p.cost <= s.insight) { s.perks.add(p.id); s.spent += p.cost; }
  }
  s.sing = whole(d.sing, 1e6);
  if (s.insight > 0 && s.sing === 0) s.sing = 1;
  s.frenzy = Math.min(num(d.frenzy), 600);
  s.frenzyMax = s.frenzy > 0 ? Math.max(s.frenzy, Math.min(num(d.frenzyMax), 600)) : 0;
  s.taps = whole(d.taps, 1e12); s.tapsAll = Math.max(whole(d.tapsAll, 1e12), s.taps);
  s.eurekas = whole(d.eurekas, 1e9);
  s.best = num(d.best); s.time = num(d.time); s.runTime = Math.min(num(d.runTime), s.time || num(d.runTime));
  s.seen = whole(d.seen, 1000);
  for (const k of list(d.firsts, N)) if (Number.isInteger(k) && k >= 0 && k < N) s.firsts.add(k);
  s.owned.forEach((n, k) => { if (n > 0) s.firsts.add(k); });
  s.stage = whole(d.stage, 5);
  s.ready = d.ready === true;
  const ne = num(d.nextEureka, 600);
  s.nextEureka = ne > 0 ? Math.max(3, ne) : EUREKA.first;
  const ui = d.ui && typeof d.ui === 'object' ? d.ui : {};
  return {
    mind: s,
    at: num(d.at, 8.64e15),
    ui: { tab: TABS.includes(ui.tab) ? ui.tab : 'build', amount: AMOUNTS.includes(ui.amount) ? ui.amount : 1 },
  };
}
