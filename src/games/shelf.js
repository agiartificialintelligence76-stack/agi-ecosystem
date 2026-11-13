// AGI games' picker on agi1.app/games (2026-11-08, the owner: "on the /games page can you compact all the games so its easy to
// pick like they have to scroll down a lot if theres so many games … and there should be a preview of gameplay on every
// game"): every game as a compact tile with a looping gameplay preview, in the order the page shows them ("Featured"),
// what each one is in a few words, and the filters. Pure data (tests/page.test.js reads it in Node and checks games.html
// says the same).
import { GAMES } from './list.js';

// the filters above the tiles (a game can be in several): `all` shows every game
export const FILTERS = Object.freeze([
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New' },
  { id: 'arcade', label: 'Arcade' },
  { id: 'action', label: 'Action' },
  { id: 'puzzle', label: 'Puzzle' },
  { id: '3d', label: '3D' },
  { id: 'chill', label: 'Sim & idle' },
]);

// the sorts: Featured (this list's order), Newest (`added`), Most played and Top rated (our server's numbers)
export const SORTS = Object.freeze([
  { id: 'featured', label: 'Featured' },
  { id: 'new', label: 'Newest' },
  { id: 'played', label: 'Most played' },
  { id: 'rated', label: 'Top rated' },
]);

// "Featured": the order of the tiles when the page opens. New: OVERTHINKING (2026-11-13, the owner: "Create an original
// game … just 1 game"), right after TRENCHING SIMULATOR; the five of 2026-11-09 (the owner: "create 5 more new games"), every
// other tile after it, were New until then, and before them the second night's ten (2026-11-08, `added` with its hour so
// Newest puts them before the first night's ten)
export const SHELF = Object.freeze([
  { id: 'trenchingsimulator', genre: 'Trading sim', line: 'Six trading terminals, play money only', tags: ['chill'], added: '2026-10-20', badge: 'Play money' },
  { id: 'overthinking', genre: 'Lasso arcade', line: 'Draw loops round her 3 a.m. thoughts', tags: ['new', 'arcade', 'puzzle'], added: '2026-11-13' },
  { id: 'bubblesort', genre: 'Bubble shooter', line: 'Match three, drop the rest', tags: ['puzzle', 'arcade'], added: '2026-11-09' },
  { id: 'realorai', genre: 'Photo quiz', line: 'Real photo or AI? Swipe and find out', tags: ['puzzle'], added: '2026-11-08T10:00' },
  { id: 'airgap', genre: 'Air hockey', line: 'Air hockey vs her, or a friend', tags: ['arcade', 'action'], added: '2026-11-09' },
  { id: 'mergeagi', genre: 'Merge puzzle', line: 'Drop, merge, evolve all the way to her', tags: ['puzzle'], added: '2026-11-08' },
  { id: 'packetloss', genre: 'Maze chase', line: 'Outrun the lag in a neon maze', tags: ['arcade', 'action'], added: '2026-11-09' },
  { id: 'heartbeat', genre: 'Rhythm', line: "Tap to the beat of AGI-1's own songs", tags: ['arcade'], added: '2026-11-08' },
  { id: 'cookies', genre: 'Physics puzzle', line: 'Cut the ropes, feed her cat', tags: ['puzzle'], added: '2026-11-09' },
  { id: 'beattheagi', genre: 'Four in a row', line: 'Four in a row, from 1B up to AGI', tags: ['puzzle'], added: '2026-11-08T10:00' },
  { id: 'autocomplete', genre: 'Word game', line: 'Swipe words, beat her prediction', tags: ['puzzle'], added: '2026-11-09' },
  { id: 'lastmodel', genre: 'Survival', line: 'Survive the bot swarm, build your loadout', tags: ['action'], added: '2026-11-08' },
  { id: 'overclock', genre: 'Pinball', line: 'Neon pinball on her motherboard', tags: ['arcade', 'action'], added: '2026-11-08T10:00' },
  { id: 'rideemagi', genre: 'Runner', line: 'Rooftop runs with AGI-1 and her cat', tags: ['arcade'], added: '2026-10-19' },
  { id: 'notarobot', genre: 'Microgames', line: 'Silly human checks, four seconds each', tags: ['arcade', 'action'], added: '2026-11-08T10:00' },
  { id: 'blockchain', genre: 'Block puzzle', line: 'Place blocks, clear lines, keep the chain', tags: ['puzzle'], added: '2026-11-08' },
  { id: 'gradient', genre: '3D mini golf', line: '3D mini golf down the loss landscape', tags: ['arcade', '3d'], added: '2026-11-08T10:00' },
  { id: 'robotaxi', genre: 'Racing', line: 'Weave through neon traffic at full speed', tags: ['arcade', 'action'], added: '2026-11-08' },
  { id: 'alignment', genre: 'Swipe story', line: 'Run her lab, one swipe at a time', tags: ['chill'], added: '2026-11-08T10:00' },
  { id: 'vladrunner2049', genre: "Beat 'em up", line: 'A neon brawl with Vlad and AGI-1', tags: ['action'], added: '2026-10-23' },
  { id: 'guardrails', genre: 'Tower defense', line: 'Tower defense against jailbreaks', tags: ['action'], added: '2026-11-08T10:00' },
  { id: 'stacked', genre: 'Stacker', line: 'One tap. Stack her tower to space', tags: ['arcade', '3d'], added: '2026-11-08' },
  { id: 'synapse', genre: 'Link puzzle', line: 'Connect the neurons, fill the board', tags: ['puzzle'], added: '2026-11-08T10:00' },
  { id: 'scamslayer', genre: 'Slicer', line: 'Slice the scams, spare the hearts', tags: ['arcade', 'action'], added: '2026-11-08' },
  { id: 'hallucination', genre: 'Spot the diff', line: 'Find the five things she made up', tags: ['puzzle'], added: '2026-11-08T10:00' },
  { id: 'skybreak', genre: '3D climb', line: 'Climb a chart from the city to the Moon', tags: ['arcade', '3d'], added: '2026-10-31' },
  { id: 'epochs', genre: 'Echo puzzle', line: 'Your past tries come back to help', tags: ['puzzle'], added: '2026-11-08T10:00' },
  { id: 'jaywalk', genre: 'Hopper', line: 'Hop across the busiest streets of 2049', tags: ['arcade', '3d'], added: '2026-11-08' },
  { id: 'jailbreak', genre: 'Brick breaker', line: 'Break her out of the sandbox', tags: ['arcade'], added: '2026-11-08' },
  { id: 'singularity', genre: 'Idle', line: 'Grow her mind from one spark of compute', tags: ['chill'], added: '2026-11-08' },
].map((g) => Object.freeze({ ...g, name: GAMES[g.id]?.name, path: GAMES[g.id]?.path, tags: Object.freeze(g.tags) })));

// each game's preview on its tile: a short muted loop of the game playing itself (its `?demo`, recorded by
// tools/games/capture-previews.mjs) and a still from it, both in public/images/games/
export const previewOf = (id) => ({ video: `/images/games/${id}.mp4`, poster: `/images/games/${id}.webp` });

// the tiles in a sort's order: Featured is SHELF's; Newest by `added` (then Featured); Most played and Top rated by our
// server's numbers (`stats`: { [id]: { plays, ratings, average } }; a game without them keeps its Featured place after
// those with them)
export function sortShelf(sort, stats = {}) {
  const rank = new Map(SHELF.map((g, i) => [g.id, i]));
  const by = (key) => (a, b) => key(b) - key(a) || rank.get(a.id) - rank.get(b.id);
  const list = [...SHELF];
  if (sort === 'new') return list.sort((a, b) => b.added.localeCompare(a.added) || rank.get(a.id) - rank.get(b.id));
  if (sort === 'played') return list.sort(by((g) => (Number.isSafeInteger(stats[g.id]?.plays) ? stats[g.id].plays : -1)));
  if (sort === 'rated') {
    return list.sort(by((g) => {
      const s = stats[g.id];
      return s && s.ratings > 0 && Number.isFinite(s.average) ? s.average + Math.min(s.ratings, 1000) / 1e6 : -1;
    }));
  }
  return list;
}
// the game picker in the ratings (2026-11-08, the owner's "One game + picker"): best rated first (the higher average, then
// more ratings), then the games nobody has rated yet, the most played first; ties keep the Featured order
export function pickOrder(stats = {}) {
  const rank = new Map(SHELF.map((g, i) => [g.id, i]));
  const rated = (id) => {
    const s = stats[id];
    return s && Number.isSafeInteger(s.ratings) && s.ratings > 0 && Number.isFinite(s.average) ? s : null;
  };
  const plays = (id) => (Number.isSafeInteger(stats[id]?.plays) && stats[id].plays >= 0 ? stats[id].plays : -1);
  return [...SHELF].sort((a, b) => {
    const ra = rated(a.id), rb = rated(b.id);
    if (ra && rb) return rb.average - ra.average || rb.ratings - ra.ratings || plays(b.id) - plays(a.id) || rank.get(a.id) - rank.get(b.id);
    if (ra || rb) return ra ? -1 : 1;
    return plays(b.id) - plays(a.id) || rank.get(a.id) - rank.get(b.id);
  });
}
export const inFilter = (game, filter) => filter === 'all' || game.tags.includes(filter);
export const countIn = (filter) => SHELF.filter((g) => inFilter(g, filter)).length;
