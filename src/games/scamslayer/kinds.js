// SCAM SLAYER: everything that flies. Pure data (no DOM): the engine, the wave planner, the art and the tests read it.
//
// The world is measured in units where the screen's short side is 600 (a phone held either way, a tablet, a monitor:
// the stickers keep their size relative to the screen). `r` is a sticker's radius in those units: the circle the blade
// has to cross. `role` says what slicing it does: a scam scores, a power scam scores and switches a power on, a heart
// costs a shield (or time in Blitz), a rug ends a Classic run (or costs 10 seconds in Blitz).

export const UNIT = 600;

// the eight classic scams (each one a sticker of its own: art.js)
export const SCAMS = Object.freeze(['airdrop', 'seed', 'hook', 'badge', 'signals', 'hat', 'impostor', 'support']);
export const POWERS = Object.freeze(['freeze', 'frenzy', 'double']);

// colors: [main, second, accent]; `inner`: the cut face (what a sliced sticker shows inside); `splat`: its paint on the wall
export const KINDS = Object.freeze({
  airdrop: { role: 'scam', r: 54, name: 'Free airdrop', colors: ['#ff4da6', '#ffc933', '#fffaf0'], inner: '#ffe3f1', splat: '#ff4da6' },
  seed: { role: 'scam', r: 54, name: '“seed phrase?” DM', colors: ['#fffaf0', '#8b66ff', '#ff5a5f'], inner: '#f1ebff', splat: '#8b66ff' },
  hook: { role: 'scam', r: 52, name: 'Phishing hook', colors: ['#d9d4ea', '#8b66ff', '#ff4da6'], inner: '#f4f1ff', splat: '#ff4da6' },
  badge: { role: 'scam', r: 52, name: 'Fake “verified” badge', colors: ['#59c8ff', '#fffaf0', '#ffc933'], inner: '#e2f5ff', splat: '#59c8ff' },
  signals: { role: 'scam', r: 54, name: '“100x SIGNALS” megaphone', colors: ['#ffc933', '#ff5a5f', '#fffaf0'], inner: '#fff4cc', splat: '#ffc933' },
  hat: { role: 'scam', r: 54, name: '“send 1 get 2” magic hat', colors: ['#4a1fd6', '#ff4da6', '#ffc933'], inner: '#e6dcff', splat: '#8b66ff' },
  impostor: { role: 'scam', r: 54, name: 'Impostor bot', colors: ['#c6c1d9', '#ffd76a', '#ff5a5f'], inner: '#eeeaf7', splat: '#ffd76a' },
  support: { role: 'scam', r: 52, name: '“Urgent support” headset', colors: ['#6b3bff', '#3ff0c3', '#ff5a5f'], inner: '#e8deff', splat: '#3ff0c3' },
  golden: { role: 'scam', r: 56, name: 'Golden scam', golden: true, colors: ['#ffc933', '#fff1b8', '#ff4da6'], inner: '#fff6d6', splat: '#ffc933' },
  freeze: { role: 'power', r: 50, name: 'Freeze', power: 'freeze', colors: ['#59c8ff', '#fffaf0', '#170a36'], inner: '#e2f5ff', splat: '#59c8ff' },
  frenzy: { role: 'power', r: 50, name: 'Frenzy', power: 'frenzy', colors: ['#ffc933', '#fffaf0', '#170a36'], inner: '#fff4cc', splat: '#ffc933' },
  double: { role: 'power', r: 50, name: 'Double', power: 'double', colors: ['#3ff0c3', '#fffaf0', '#170a36'], inner: '#dcfff5', splat: '#3ff0c3' },
  heart: { role: 'heart', r: 46, name: 'Heart', colors: ['#8b66ff', '#ff4da6', '#fffaf0'], inner: '#efe8ff', splat: '#ff4da6' },
  rug: { role: 'rug', r: 50, name: 'RUG', colors: ['#ff5a5f', '#ffc933', '#fffaf0'], inner: '#ffe0e1', splat: '#ff5a5f' },
});

export const ALL_KINDS = Object.freeze(Object.keys(KINDS));

// how wide the blade's target is, per role: generous for what you should cut, strict for what you shouldn't
// (a blade that grazes a heart's edge doesn't cut it; one that grazes a scam's edge does)
export const HIT = Object.freeze({ scam: 1.12, power: 1.12, heart: 0.72, rug: 0.74 });

export const roleOf = (kind) => KINDS[kind]?.role || 'scam';
// what counts as a scam for "Scams slain" and Accuracy: the eight, the golden one and the three power scams
export const isScam = (kind) => { const r = roleOf(kind); return r === 'scam' || r === 'power'; };
export const hitRadius = (kind) => KINDS[kind].r * HIT[roleOf(kind)];
