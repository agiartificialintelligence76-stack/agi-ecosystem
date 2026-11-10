export const INGREDIENTS = [
  { id: 'bean', name: 'Coffee', glyph: '●', color: '#b6764a' },
  { id: 'milk', name: 'Milk', glyph: '◒', color: '#fff1cf' },
  { id: 'cocoa', name: 'Cocoa', glyph: '◆', color: '#ce8d67' },
  { id: 'tea', name: 'Tea', glyph: '❧', color: '#83dbab' },
  { id: 'berry', name: 'Berry', glyph: '♥', color: '#ff86b3' },
  { id: 'ice', name: 'Ice', glyph: '◇', color: '#8ae5ff' },
];
export const RECIPES = [
  { name: 'Midnight shot', short: 'SHOT', items: ['bean'], color: '#d5996d' },
  { name: 'Cloud latte', short: 'LATTE', items: ['bean', 'milk'], color: '#ffdfaa' },
  { name: 'Moon mocha', short: 'MOCHA', items: ['bean', 'cocoa', 'milk'], color: '#e4a0b9' },
  { name: 'Mint moon', short: 'TEA', items: ['tea', 'milk'], color: '#91edba' },
  { name: 'Berry orbit', short: 'BERRY', items: ['berry', 'milk', 'ice'], color: '#ff89bb' },
  { name: 'Iced eclipse', short: 'ICED', items: ['bean', 'milk', 'ice'], color: '#9ddcfa' },
];
export const SHIFTS = ['First light', 'Moon regulars', 'Cocoa hour', 'The garden club', 'Meteor shower', 'Afterparty', 'Sleepless city', 'One more cup'];
function rand(s) { s.rng = (Math.imul(s.rng, 1664525) + 1013904223) >>> 0; return s.rng / 4294967296; }
export function createShift(level = 0, seed = 7, endless = false) {
  level = Math.max(0, Math.min(7, Math.floor(level)));
  const s = { level, endless, rng: seed >>> 0, time: endless ? 90 : 90 + level * 5, age: 0, score: 0, served: 0, missed: 0, combo: 0, bestCombo: 0, target: 6 + level * 2, customers: [], nextId: 1, spawnIn: 1.5, selected: 0, cup: [], brew: null, drink: null, phase: 'play', events: [], upgrades: Math.floor(level / 2) };
  spawn(s); spawn(s); s.selected = s.customers[0].id; return s;
}
function spawn(s) {
  if (s.customers.length >= 3) return false;
  const maxRecipe = s.endless ? 6 : Math.min(6, 2 + s.level);
  const recipe = Math.floor(rand(s) * maxRecipe);
  const patience = 30 + s.upgrades * 3 - Math.min(s.level, 6);
  s.customers.push({ id: s.nextId++, recipe, patience, maxPatience: patience, look: Math.floor(rand(s) * 6), bob: rand(s) * 6.28 }); return true;
}
export function selectCustomer(s, id) { if (s.customers.some(c => c.id === id)) { s.selected = id; return true; } return false; }
export function addIngredient(s, id) {
  if (s.phase !== 'play' || s.brew || s.drink || s.cup.length >= 3 || !INGREDIENTS.some(i => i.id === id)) return false;
  s.cup.push(id); s.events.push({ type: 'add', id }); return true;
}
export function clearCup(s) { if (s.phase !== 'play') return; s.cup = []; s.brew = null; s.drink = null; s.events.push({ type: 'clear' }); }
export function startBrew(s) {
  if (s.phase !== 'play' || !s.cup.length || s.brew || s.drink) return false;
  s.brew = { age: 0, progress: 0 }; return true;
}
export function finishBrew(s) {
  if (!s.brew || s.phase !== 'play') return false;
  const p = s.brew.progress;
  const quality = p >= .56 && p <= .78 ? 1 : p >= .35 && p <= .9 ? .7 : .4;
  s.drink = { items: [...s.cup], quality }; s.brew = null;
  s.events.push({ type: quality === 1 ? 'perfect' : 'brewed', quality }); return true;
}
export function sameRecipe(a, b) { return [...a].sort().join('|') === [...b].sort().join('|'); }
export function serve(s, id = s.selected) {
  if (s.phase !== 'play' || !s.drink) return false;
  const customer = s.customers.find(c => c.id === id);
  if (!customer) return false;
  if (!sameRecipe(s.drink.items, RECIPES[customer.recipe].items)) {
    customer.patience = Math.max(1, customer.patience - 4); s.combo = 0; s.events.push({ type: 'wrong' }); return false;
  }
  s.combo++; s.bestCombo = Math.max(s.bestCombo, s.combo); s.served++;
  const gained = Math.round((100 + Math.min(8, s.combo) * 20 + customer.patience * 2) * s.drink.quality);
  s.score += gained; s.events.push({ type: 'serve', gained, perfect: s.drink.quality === 1, id });
  s.customers = s.customers.filter(c => c !== customer); s.cup = []; s.drink = null;
  s.selected = s.customers[0]?.id || 0;
  if (s.endless) s.time = Math.min(100, s.time + 5);
  if (!s.endless && s.served >= s.target) { s.phase = 'won'; s.score += Math.round(s.time * 4); }
  return true;
}
export function step(s, dt) {
  if (s.phase !== 'play') return;
  dt = Math.max(0, Math.min(dt, .1)); s.age += dt; s.time = Math.max(0, s.time - dt);
  if (s.brew) { s.brew.age += dt; s.brew.progress = Math.min(1, s.brew.age / 2.1); if (s.brew.progress >= 1) { finishBrew(s); s.events.push({ type: 'overdone' }); } }
  for (const c of s.customers) c.patience -= dt;
  const leaving = s.customers.filter(c => c.patience <= 0);
  if (leaving.length) { s.missed += leaving.length; s.combo = 0; s.customers = s.customers.filter(c => c.patience > 0); s.events.push({ type: 'left' }); if (!s.customers.some(c => c.id === s.selected)) s.selected = s.customers[0]?.id || 0; }
  s.spawnIn -= dt;
  if (s.spawnIn <= 0) { if (spawn(s)) { s.spawnIn = Math.max(4.5, 8.5 - s.level * .45); if (!s.selected) s.selected = s.customers[0].id; } else s.spawnIn = .5; }
  if (s.missed >= 3 || s.time <= 0) s.phase = 'over';
}
export function auto(s) {
  if (s.phase !== 'play') return;
  const c = s.customers.slice().sort((a,b) => a.patience-b.patience)[0]; if (!c) return;
  s.selected = c.id;
  if (s.drink) { if (!serve(s)) clearCup(s); return; }
  if (s.brew) { if (s.brew.progress >= .64) finishBrew(s); return; }
  const need = RECIPES[c.recipe].items;
  if (s.cup.length < need.length) addIngredient(s, need[s.cup.length]); else startBrew(s);
}

