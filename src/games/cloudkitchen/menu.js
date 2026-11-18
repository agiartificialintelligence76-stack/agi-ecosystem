export const BASES = ['Black tea', 'Jasmine', 'Oolong', 'Berry tea'];
export const baseColor = ['#ac6046', '#b1a85b', '#a27551', '#b46580'];
export const toppings = ['Pearl', 'Star jelly'];
// base, tea marks, milk marks, pearl scoops, stars, ice, shakes. New equipment arrives with its first recipe.
const entries=[
 ['Apron Morning',0,2,1,0,0,0,0],['Brown Sugar Kiss',0,3,2,1,0,0,0],['Little Dawn',0,2.5,2,0,0,0,0],
 ['Window Rain',0,3.5,1.5,1,0,1,0],['Jasmine Umbrella',1,3,2,0,0,1,0],['Warm Cardigan',1,4,1,1,0,0,0],
 ['Playground Moon',0,3,2,3,0,1,0],['Pocket Stars',1,3.5,1,0,2,1,0],['Twin Pencil',0,2,2.5,1,1,0,0],
 ['Velvet Rehearsal',1,3,2,2,0,0,2],['Backstage Foam',0,2.5,2.5,1,1,1,5],['Soundcheck',1,4,1,1,0,1,3],
 ['Garden Oolong',2,4,1.5,1,0,0,2],['Mint Bench',1,3,2,0,2,1,3],['Amber Fern',2,3.5,1,2,1,0,5],
 ['Market Ribbon',0,3,2,2,0,1,2],['Market Lantern',0,3,1,0,2,0,5],['Pavilion Mist',2,4,1,1,1,1,3],
 ['Encore Berry',3,3.5,2,1,2,1,5],['Velvet Ticket',2,4,1.5,3,0,0,3],['Stage Door',3,3,2.5,0,1,1,2],
 ['Last Train Milk',0,4,2,2,1,0,3],['Rose Snow',3,2.5,2.5,1,1,1,5],['Counter Lights',2,3.5,1.5,2,2,1,3],
];
export const RECIPES = entries.map(([name, base, tea, milk, pearl, star, ice, shake], id) => ({
  id,
  name,
  base,
  tea,
  milk,
  pearl,
  star,
  ice,
  shake,
  day: Math.floor(id / 3)
}));
export const GUESTS = ['Mina', 'Jun', 'Pip', 'Lulu', 'Noor', 'Bo', 'Wen', 'Tess', 'Nico', 'Aya', 'Em', 'Ren'];
export const DAYS = [{
  name: 'Morning Opening',
  length: 183,
  breaks: [35, 88, 139],
  groups: [[0, 1, 2, 0], [1, 2, 1, 0], [2, 1, 0, 2], [1, 0]],
  interval: 13.3,
  patience: 47
}, {
  name: 'Umbrella Day',
  length: 188,
  breaks: [38, 90, 142],
  groups: [[3, 4, 0, 5], [4, 3, 1, 5], [5, 4, 2, 3], [4, 5, 3]],
  interval: 12.8,
  patience: 45
}, {
  name: 'Pearls After School',
  length: 194,
  breaks: [39, 91, 145],
  groups: [[6, 7, 8, 2], [7, 6, 5, 8, 7], [8, 4, 6, 7, 3], [8, 6, 7]],
  interval: 12.3,
  patience: 43
}, {
  name: 'Rehearsal Break',
  length: 202,
  breaks: [41, 95, 146],
  groups: [[9, 10, 11, 6], [10, 9, 8, 11, 10], [11, 7, 9, 10, 6], [11, 9, 10, 8]],
  interval: 12.0,
  patience: 42
}, {
  name: 'Garden Social',
  length: 211,
  breaks: [42, 94, 146],
  groups: [[12, 13, 14, 9], [13, 12, 11, 14, 13], [14, 10, 12, 13, 8], [12, 14, 13, 9, 12]],
  interval: 11.7,
  patience: 44
}, {
  name: 'Market Eve',
  length: 216,
  breaks: [42, 94, 147],
  groups: [[15, 16, 17, 12], [15, 16, 17, 15, 16, 10], [17, 12, 15, 16, 14], [16, 15, 17, 16, 15]],
  interval: 11.4,
  patience: 44,
  pairs: true
}, {
  name: 'Encore Night',
  length: 220,
  breaks: [41, 93, 145],
  groups: [[18, 19, 20, 10], [20, 18, 19, 20, 18, 16], [18, 19, 15, 16, 19, 20], [20, 18, 19, 12, 18]],
  interval: 11.1,
  patience: 43,
  pairs: true
}, {
  name: 'Closing Party',
  length: 228,
  breaks: [40, 92, 144],
  groups: [[21, 22, 23, 18], [22, 21, 23, 20, 21, 22], [23, 18, 21, 22, 19, 23], [21, 22, 23, 12, 17, 20]],
  interval: 10.8,
  patience: 45,
  pairs: true
}];
export function randomizer(seed) {
  let n = seed >>> 0;
  return () => (n = Math.imul(n, 1664525) + 1013904223 >>> 0) / 4294967296;
}
export function schedule(day, seed = 7, daily = false) {
  const d = DAYS[day],
    rng = randomizer(seed),
    opens = [0, ...d.breaks],
    ends = [...d.breaks, d.length - 11],
    items = [];
  d.groups.forEach((recipes, wave) => recipes.forEach((id, i) => {
    const len = recipes.length,
      spacing = (ends[wave] - opens[wave]) / len,
      paired = d.pairs && wave > 0 && i < 2;
    const time = opens[wave] + (paired ? i * 2.8 : i * spacing) + (i && daily ? rng() * 1.2 : 0);
    let recipe = id;
    if (daily && i > 0 && rng() < .44) recipe = Math.max(0, id - id % 3 + Math.floor(rng() * 3));
    items.push({
      time,
      recipe,
      guest: (day * 3 + wave * 4 + i + (daily ? Math.floor(rng() * 4) : 0)) % GUESTS.length,
      wave
    });
  }));
  return items.sort((a, b) => a.time - b.time);
}
export function toolsFor(day) {
  return {
    cups: day === 0 ? 1 : 2,
    bases: day >= 6 ? 4 : day >= 4 ? 3 : day >= 1 ? 2 : 1,
    ice: day >= 1,
    star: day >= 2,
    shake: day >= 3,
    steep: day >= 4,
    batch: day >= 5
  };
}
export function dailyMenu(seed) {
  const rng = randomizer(seed);
  return {
    day: 2 + Math.floor(rng() * 6),
    seed
  };
}
