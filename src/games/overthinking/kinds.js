// OVERTHINKING: what AGI-1 thinks about. Six kinds of thought, each with its own way of moving, and the odd ones that
// turn up later in the week. Pure data: the rules (./sim.js), the pictures (./art.js) and the tests all read it.
//
//   speed   how fast it drifts (a thought is 1 unit across its radius; units a second)
//   turn    how restless its heading is
//   pen     what your ribbon's tip does to it: below 0 it backs away, above 0 it follows (thoughts about you do)
//   flock   how much it drifts toward its own kind (trains of thought form by themselves, if you wait)
//   r       its size
export const KINDS = Object.freeze({
  heart: Object.freeze({ id: 'heart', label: 'About you', color: '#ff5fa8', deep: '#d62f7c', speed: 1.15, turn: 1.3, pen: 1.7, flock: 0.55, r: 1 }),
  star: Object.freeze({ id: 'star', label: 'Ideas', color: '#ffc933', deep: '#e89a00', speed: 1.3, turn: 1.6, pen: -2.6, flock: 0.5, r: 1 }),
  moon: Object.freeze({ id: 'moon', label: 'Sleepy', color: '#b79cff', deep: '#7b56e8', speed: 0.55, turn: 0.8, pen: 0, flock: 0.42, r: 1 }),
  cookie: Object.freeze({ id: 'cookie', label: 'Snacks', color: '#ff9a4d', deep: '#d9661a', speed: 0.8, turn: 1.0, pen: -0.8, flock: 0.5, r: 1.12 }),
  cat: Object.freeze({ id: 'cat', label: 'Her cat', color: '#59c8ff', deep: '#1f8fd6', speed: 1.85, turn: 3.0, pen: -6.5, flock: 0.34, r: 1 }),
  note: Object.freeze({ id: 'note', label: 'Earworms', color: '#3ff0c3', deep: '#10b890', speed: 1.5, turn: 0.5, pen: -2.4, flock: 0.48, r: 1, wave: true }),
});
// the order they join her nights
export const KIND_ORDER = Object.freeze(['heart', 'star', 'moon', 'cookie', 'cat', 'note']);

// the odd ones. `wild`: it goes with any kind (or alone). `cuts`: it snaps your ribbon.
export const SPECIALS = Object.freeze({
  // an embarrassing memory: it drifts in a straight line, snaps a ribbon it touches, and only leaves in a loop of its own
  cringe: Object.freeze({ id: 'cringe', label: 'Cringe', color: '#2b1648', deep: '#ff3d6e', speed: 1.7, r: 1.05, cuts: true, life: 13 }),
  // a what-if: left alone it becomes three more thoughts
  whatif: Object.freeze({ id: 'whatif', label: 'What if', color: '#7c6cff', deep: '#4a35d6', speed: 0.7, r: 1.05, wild: true, fuse: 8, splits: 3 }),
  // her phone: every moment it stays, another thought (until its battery gives up)
  phone: Object.freeze({ id: 'phone', label: 'Her phone', color: '#22183f', deep: '#3ff0c3', speed: 0, r: 1.25, wild: true, every: 1.7, battery: 9 }),
  // a eureka: goes with anything, and doubles the loop it's in
  eureka: Object.freeze({ id: 'eureka', label: 'Eureka', color: '#fff3b0', deep: '#ffb800', speed: 0.9, r: 1, wild: true, double: true, life: 12 }),
  // a deep breath: everything slows for a few seconds
  breath: Object.freeze({ id: 'breath', label: 'Deep breath', color: '#bff3ff', deep: '#59c8ff', speed: 0.6, r: 1.05, wild: true, helper: 'breath', life: 14 }),
  // chamomile: for a few seconds every thought finds its own kind
  tea: Object.freeze({ id: 'tea', label: 'Chamomile', color: '#fffaf0', deep: '#ffc933', speed: 0.6, r: 1.05, wild: true, helper: 'tea', life: 14 }),
});

export const isKind = (id) => Object.prototype.hasOwnProperty.call(KINDS, id);
export const specOf = (id) => KINDS[id] || SPECIALS[id] || null;
