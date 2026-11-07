// SINGULARITY (2026-11-08): everything the game is made of, as plain data. No DOM, no clock, no dice: the rules in
// ./econ.js read it, the screens in ./ui.js show it, and tests/singularity.test.js checks it. Compute (FLOPs) is the
// only currency: no money words anywhere (the arcade's rule), so things are built, installed and unlocked, never bought.

// ---------- the twelve machines that think for you ----------
// cost: the first one, in FLOPs (each one after it needs GROWTH × more); rate: FLOPs/s each, before any bonus;
// many: the name for more than one.
// The ladder: the first hour climbs to the Orbital Array, the singularity's runs climb the rest of the way to a
// whole simulated universe (tools/games/singularity/sim.mjs plays it through and prints the timeline).
export const GENS = [
  { id: 'notebook', name: 'Spark Notebook', many: 'Spark Notebooks', cost: 15, rate: 0.1, blurb: 'Her first thoughts, scribbled in the margins.' },
  { id: 'rig', name: 'Gaming Rig', many: 'Gaming Rigs', cost: 100, rate: 1, blurb: 'The rainbow lights make it think faster. Obviously.' },
  { id: 'gpu', name: 'GPU Rack', many: 'GPU Racks', cost: 1100, rate: 8, blurb: 'A wall of graphics cards humming in harmony.' },
  { id: 'server', name: 'Server Room', many: 'Server Rooms', cost: 1.2e4, rate: 60, blurb: 'Cold air, blinking lights, big thoughts.' },
  { id: 'datacenter', name: 'Datacenter', many: 'Datacenters', cost: 1.4e5, rate: 520, blurb: 'A whole building whose only job is thinking.' },
  { id: 'campus', name: 'Hyperscale Campus', many: 'Hyperscale Campuses', cost: 1.8e6, rate: 5000, blurb: 'Datacenters as far as the eye can see.' },
  { id: 'fusion', name: 'Fusion Plant', many: 'Fusion Plants', cost: 2.6e7, rate: 3.8e4, blurb: 'Bottled starlight to keep the fans spinning.' },
  { id: 'orbital', name: 'Orbital Array', many: 'Orbital Arrays', cost: 4.5e8, rate: 4.5e5, blurb: 'Compute in orbit. The view is incredible.' },
  { id: 'lunar', name: 'Lunar Foundry', many: 'Lunar Foundries', cost: 9e9, rate: 6e6, blurb: 'Chips forged in low gravity on the Moon.' },
  { id: 'dyson', name: 'Dyson Swarm', many: 'Dyson Swarms', cost: 2.2e11, rate: 7.3e7, blurb: 'Mirrors around the sun, all doing math.' },
  { id: 'matrioshka', name: 'Matrioshka Brain', many: 'Matrioshka Brains', cost: 2e13, rate: 2.5e9, blurb: 'Shells of thought nested around a star.' },
  { id: 'universe', name: 'Universe Sim', many: 'Universe Sims', cost: 1e21, rate: 1e16, blurb: 'A whole universe, running as a side project.' },
];
export const N = GENS.length;
export const GROWTH = 1.15;
// ×2 for every one of these a machine line reaches
export const MILESTONES = [10, 25, 50, 100, 150, 200, 300, 400, 500];

// ---------- upgrades (about forty): installed once a run, each with what it needs to show up ----------
// kind: 'tap' (taps ×x) · 'echo' (each tap also adds x of your FLOPs/s) · 'gen' (one machine line ×x) ·
// 'syn' (each `from` owned gives `to` +x) · 'global' (everything ×x) · 'luck' (Eureka sparks come x× as often) ·
// 'golden' (Frenzy lasts x× as long). need: { run } FLOPs made this run, or { own: [[gen, count], …] }.
const c = (i) => GENS[i].cost;
const GEN_UPS = [
  ['Margin Notes', 'Every doodle counts as a thought.', 'Dot Grid Paper', 'Neat thoughts are fast thoughts.'],
  ['RGB Everything', 'More colors, more speed. Everyone knows that.', 'Liquid Cooling', 'Calm, cool and computing.'],
  ['Tensor Cores', 'Tiny math engines inside the big ones.', 'Bigger Fans', 'The racks sound like a jet. A happy jet.'],
  ['Cold Aisle', 'Cold air in, warm thoughts out.', 'Blinkenlights', 'The lights blink in her favorite rhythm.'],
  ['Load Balancer', 'Every thought goes where it fits best.', 'Night Owls', 'The night shift never sleeps. Neither does she.'],
  ['Private Grid', 'Its own power lines, its own sunrise.', 'Campus Shuttles', 'Thoughts commute between buildings.'],
  ['Magnetic Bottle', 'A tiny sun, politely contained.', 'Sunrise Mode', 'Every plant runs like it is morning.'],
  ['Laser Links', 'The satellites gossip at light speed.', 'Low Orbit Lanes', 'Shorter trips, quicker thoughts.'],
  ['Moon Dust Silicon', 'Chips grown from fine gray dust.', 'Low-G Lithography', 'Circuits drawn while floating.'],
  ['Swarm Choreography', 'A billion mirrors dancing in step.', 'Star Lifting', 'Borrowing a little of the sun.'],
  ['Nested Shells', 'Every shell thinks about the one inside.', 'Thermal Cascade', 'Even the heat gets a job.'],
  ['Pocket Physics', 'Gravity, now in travel size.', 'Recursive Universes', 'Universes inside the universe. Cozy.'],
];
export const UPGRADES = [
  // taps
  { id: 'tap1', name: 'Eager Finger', kind: 'tap', x: 2, cost: 100, need: { run: 40 }, text: 'Taps are twice as strong.' },
  { id: 'tap2', name: 'Haptic Joy', kind: 'tap', x: 2, cost: 1500, need: { run: 700 }, text: 'Taps are twice as strong.' },
  { id: 'tap3', name: 'Speedrun Wrists', kind: 'tap', x: 2, cost: 5e4, need: { run: 2e4 }, text: 'Taps are twice as strong.' },
  { id: 'echo1', name: 'Neural Echo', kind: 'echo', x: 0.01, cost: 3e5, need: { run: 1e5 }, text: 'Every tap also adds 1% of your FLOPs/s.' },
  { id: 'echo2', name: 'Muscle Memory', kind: 'echo', x: 0.01, cost: 3e8, need: { run: 1e8 }, text: 'Every tap also adds 1% more of your FLOPs/s.' },
  { id: 'echo3', name: 'Resonance', kind: 'echo', x: 0.01, cost: 3e11, need: { run: 1e11 }, text: 'Every tap also adds 1% more of your FLOPs/s.' },
  { id: 'echo4', name: 'Feedback Loop', kind: 'echo', x: 0.01, cost: 3e14, need: { run: 1e14 }, text: 'Every tap also adds 1% more of your FLOPs/s.' },
  { id: 'echo5', name: 'Touch of Genius', kind: 'echo', x: 0.02, cost: 3e18, need: { run: 1e18 }, text: 'Every tap also adds 2% more of your FLOPs/s.' },
  // one line of machines at a time: ×2 from the first one, ×3 at 25
  ...GENS.flatMap((g, i) => [
    { id: `${g.id}2`, name: GEN_UPS[i][0], kind: 'gen', gen: i, x: 2, cost: c(i) * 10, need: { own: [[i, 1]] }, text: `${g.many} ×2. ${GEN_UPS[i][1]}` },
    { id: `${g.id}3`, name: GEN_UPS[i][2], kind: 'gen', gen: i, x: 3, cost: c(i) * 300, need: { own: [[i, 25]] }, text: `${g.many} ×3. ${GEN_UPS[i][3]}` },
  ]),
  // machines that help each other
  { id: 'syn-lab', name: 'Lab Notebook', kind: 'syn', from: 0, to: 3, x: 0.005, cost: c(3) * 40, need: { own: [[0, 50], [3, 10]] }, text: 'Each Spark Notebook gives Server Rooms +0.5%.' },
  { id: 'syn-lan', name: 'LAN Party', kind: 'syn', from: 1, to: 2, x: 0.01, cost: c(2) * 60, need: { own: [[1, 25], [2, 10]] }, text: 'Each Gaming Rig gives GPU Racks +1%.' },
  { id: 'syn-rack', name: 'Rack and Stack', kind: 'syn', from: 2, to: 4, x: 0.01, cost: c(4) * 40, need: { own: [[2, 25], [4, 10]] }, text: 'Each GPU Rack gives Datacenters +1%.' },
  { id: 'syn-farm', name: 'Server Farm', kind: 'syn', from: 3, to: 5, x: 0.01, cost: c(5) * 40, need: { own: [[3, 25], [5, 10]] }, text: 'Each Server Room gives Hyperscale Campuses +1%.' },
  { id: 'syn-grid', name: 'Grid Hookup', kind: 'syn', from: 4, to: 6, x: 0.01, cost: c(6) * 40, need: { own: [[4, 25], [6, 10]] }, text: 'Each Datacenter gives Fusion Plants +1%.' },
  { id: 'syn-lift', name: 'Space Elevator', kind: 'syn', from: 6, to: 7, x: 0.01, cost: c(7) * 40, need: { own: [[6, 25], [7, 10]] }, text: 'Each Fusion Plant gives Orbital Arrays +1%.' },
  { id: 'syn-drive', name: 'Mass Driver', kind: 'syn', from: 8, to: 9, x: 0.01, cost: c(9) * 40, need: { own: [[8, 25], [9, 10]] }, text: 'Each Lunar Foundry gives Dyson Swarms +1%.' },
  { id: 'syn-trust', name: 'Brain Trust', kind: 'syn', from: 9, to: 10, x: 0.01, cost: c(10) * 40, need: { own: [[9, 25], [10, 10]] }, text: 'Each Dyson Swarm gives Matrioshka Brains +1%.' },
  // everything at once
  { id: 'all1', name: 'Attention Span', kind: 'global', x: 1.5, cost: 1e5, need: { run: 3e4 }, text: 'Everything thinks 50% faster.' },
  { id: 'all2', name: 'Scaling Laws', kind: 'global', x: 2, cost: 2e8, need: { run: 5e7 }, text: 'Everything thinks twice as fast.' },
  { id: 'all3', name: 'Chain of Thought', kind: 'global', x: 2, cost: 3e11, need: { run: 6e10 }, text: 'Everything thinks twice as fast.' },
  { id: 'all4', name: 'Mixture of Experts', kind: 'global', x: 2, cost: 4e14, need: { run: 8e13 }, text: 'Everything thinks twice as fast.' },
  { id: 'all5', name: 'Long Context', kind: 'global', x: 2, cost: 5e17, need: { run: 1e17 }, text: 'Everything thinks twice as fast.' },
  { id: 'all6', name: 'World Model', kind: 'global', x: 3, cost: 1e21, need: { run: 2e20 }, text: 'Everything thinks three times as fast.' },
  // Eureka sparks
  { id: 'luck1', name: 'Serendipity', kind: 'luck', x: 1.25, cost: 5e5, need: { run: 1.5e5 }, text: 'Eureka sparks come 25% more often.' },
  { id: 'gold1', name: 'Golden Minute', kind: 'golden', x: 1.5, cost: 5e9, need: { run: 1e9 }, text: 'Frenzy lasts 50% longer.' },
];
export const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

// ---------- the singularity: Insight, kept forever ----------
export const SING_AT = 1e15;           // FLOPs this run before the singularity opens
export const INSIGHT_BONUS = 0.02;     // +2% to everything for every Insight ever found
// The INSIGHT tree: 8 perks bought with Insight (buying one never lowers the +2% bonus). `after`: at least one of these first.
export const PERKS = [
  { id: 'warm', name: 'Warm Boot', cost: 1, after: [], col: 0, row: 0, text: 'Every new mind starts with 10 Spark Notebooks, 5 Gaming Rigs and 2 GPU Racks.' },
  { id: 'lucky', name: 'Lucky Sparks', cost: 1, after: [], col: 2, row: 0, text: 'Eureka sparks come twice as often.' },
  { id: 'dream', name: 'Dreamtime', cost: 3, after: ['warm'], col: 0, row: 1, text: 'While you are away she thinks at 75% (not 50%) for up to 24 hours (not 8).' },
  { id: 'takeoff', name: 'Fast Takeoff', cost: 5, after: ['warm', 'lucky'], col: 1, row: 1, text: 'Every machine needs 10% fewer FLOPs.' },
  { id: 'golden', name: 'Golden Hour', cost: 3, after: ['lucky'], col: 2, row: 1, text: 'Frenzy lasts twice as long.' },
  { id: 'nature', name: 'Second Nature', cost: 25, after: ['dream', 'takeoff'], col: 0, row: 2, text: 'Taps are 10× stronger and add 2% of your FLOPs/s.' },
  { id: 'recall', name: 'Deep Recall', cost: 30, after: ['takeoff', 'golden'], col: 2, row: 2, text: 'Every line in her log makes everything 2% faster.' },
  { id: 'total', name: 'Total Recall', cost: 400, after: ['nature', 'recall'], col: 1, row: 3, text: 'Your upgrades survive the singularity.' },
];
export const PERK_BY_ID = Object.fromEntries(PERKS.map((p) => [p.id, p]));
export const WARM_START = [10, 5, 2];

// ---------- Eureka: a golden spark every 1 to 3 minutes ----------
export const EUREKA = {
  first: 35,            // seconds into a brand new mind: the first one comes early, to teach it
  min: 60, max: 180,    // seconds between sparks after that
  life: 10,             // seconds it floats before it fades
  frenzy: 7, frenzyFor: 30,   // ×7 FLOPs for 30 s
  lumpFor: 900,         // or an instant lump: 15 minutes of production
  frenzyChance: 0.8,
};

// ---------- away ----------
export const AWAY = { rate: 0.5, cap: 8 * 3600, dreamRate: 0.75, dreamCap: 24 * 3600, min: 30 };

// ---------- the core's six forms, by FLOPs made this run ----------
export const STAGES = [
  { at: 0, name: 'Spark' },
  { at: 1e3, name: 'Neural Seed' },
  { at: 1e6, name: 'Lattice' },
  { at: 1e9, name: 'Star' },
  { at: 1e12, name: 'Ringed Star' },
  { at: 1e15, name: 'Her Heart' },
];

// taps: at most this many count each second (multi-touch included)
export const TAPS_PER_SECOND = 20;
