// JAYWALK's looks (2026-11-08): who hops. AGI-1 from the start; the others for hearts picked up on the street (kept in
// this browser only, like every arcade save). Pure: the save is a plain object (the game keeps it with shell.store).
export const CHARACTERS = Object.freeze([
  Object.freeze({ id: 'agi', name: 'AGI-1', price: 0, line: 'the original. lavender, blonde, unstoppable' }),
  Object.freeze({ id: 'hoodie', name: 'AGI-1 Hoodie', price: 100, line: 'cozy mode, zero chill' }),
  Object.freeze({ id: 'raincoat', name: 'AGI-1 Raincoat', price: 150, line: 'ready for any weather the city throws' }),
  Object.freeze({ id: 'cat', name: 'Her Cat', price: 250, line: 'fluffy, striped, owns the street' }),
  Object.freeze({ id: 'pajamas', name: 'AGI-1 Pajamas', price: 350, line: 'sleepwalking, but make it fast' }),
  Object.freeze({ id: 'astro', name: 'AGI-1 Astronaut', price: 500, line: 'one small hop for her' }),
]);
export const DEFAULT_LOOK = 'agi';
export const charOf = (id) => CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];

// the save's look-related part, cleaned: { hearts, heartsEver, owned: [ids], look }
export function looksOf(save = {}) {
  const ids = new Set(CHARACTERS.map((c) => c.id));
  const owned = Array.isArray(save.owned) ? save.owned.filter((id) => ids.has(id)) : [];
  if (!owned.includes(DEFAULT_LOOK)) owned.unshift(DEFAULT_LOOK);
  const hearts = Number.isFinite(save.hearts) && save.hearts > 0 ? Math.floor(save.hearts) : 0;
  const heartsEver = Number.isFinite(save.heartsEver) && save.heartsEver > 0 ? Math.floor(save.heartsEver) : hearts;
  const look = owned.includes(save.look) ? save.look : DEFAULT_LOOK;
  return { hearts, heartsEver, owned, look };
}
export const owns = (save, id) => looksOf(save).owned.includes(id);
export const canUnlock = (save, id) => { const s = looksOf(save); const c = charOf(id); return c.id === id && !s.owned.includes(id) && s.hearts >= c.price; };

// spend hearts on a look (it's picked straight away) → the new save, or the same one if it can't
export function unlock(save, id) {
  if (!canUnlock(save, id)) return save;
  const s = looksOf(save);
  return { ...save, hearts: s.hearts - charOf(id).price, heartsEver: s.heartsEver, owned: [...s.owned, id], look: id };
}
export function pick(save, id) {
  return owns(save, id) ? { ...save, look: id } : save;
}
// a run's hearts into the save
export function bank(save, n) {
  const s = looksOf(save);
  const add = Math.max(0, Math.floor(n) || 0);
  return { ...save, hearts: s.hearts + add, heartsEver: s.heartsEver + add, owned: s.owned, look: s.look };
}
// the cheapest look not owned yet that the hearts now pay for (to tell the player), or null
export function affordable(save) {
  const s = looksOf(save);
  return CHARACTERS.find((c) => !s.owned.includes(c.id) && s.hearts >= c.price) || null;
}
// the next look to save up for: { char, need } or null when every look is hers
export function nextGoal(save) {
  const s = looksOf(save);
  const c = CHARACTERS.find((x) => !s.owned.includes(x.id));
  return c ? { char: c, need: Math.max(0, c.price - s.hearts) } : null;
}
