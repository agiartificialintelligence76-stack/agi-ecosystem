// A dot is a rail berth, a space is open scenery. Rows are north to south.
// @ engine, A–F ingredient wagons, 1/2 kitchen windows, + points, % bridge, ! engine-only refuge.
export const directions = [[0,-1],[1,0],[0,1],[-1,0]];
export const names = ['Broth','Egg','Greens','Corn','Chili','Fish'];
export const lines = ['Steam Counter','Siding Street','One-way Line','Roundhouse','Twin Kitchens','Last Orders'];
export const palettes = [
  ['#ffd9ad','#feb271','#ff6d58','#19534e'], ['#d1f0bc','#a7d7a0','#ff9372','#174d53'],
  ['#fbe4a0','#ffc87c','#e96962','#3a5260'], ['#d7cdf4','#c0aedf','#ff8a76','#444472'],
  ['#c1e9eb','#81cfca','#f28b73','#24567a'], ['#b7c8ee','#9daddc','#ff8d80','#36456f'],
];
const yard = (name, rows, tickets, tip, spec={}) => ({ name, rows:rows.split('/'), tickets:tickets.split('/'), tip, ...spec });
export const plans = [
  yard('Broth Local','@.A1','A','Roll east beside the broth. Couple it, then push east into the kitchen.'),
  yard('Egg Second',' .. /BA@.1/ ...','AB','Egg arrived first. Move around to the broth side.'),
  yard('Trailing Stop','1... / A.B@/ ... ','AB','Pull a wagon out of the throat before serving.'),
  yard('One Berth Short',' .  ./BA@.1/ ... ','AB','Work the short pocket or hook a second wagon.'),
  yard('Wrong End',' . . /1.BA@/ ... ','AB','The link at the far end of your train opens first.'),
  yard('Service Window',' ... /@CAB1/  .. ','ABC','Three courses, one window. Keep the loop open.'),
  yard('Side Dish',' ..  /1.AB@/ ... ','BA','Make a lap around the waiting wagon.'),
  yard('Short Spoon',' .  ./@A.B1/ ... ','AB','One wagon fits on the little north stub.'),
  yard('Parallel Lunch','  .../1B.A@/ ... ','AB','An empty loop is worth more than an empty line.'),
  yard('Takeout','1..  / .A.B/  .@./  ...','BA','Reach the back of the egg using the outer loop.'),
  yard('Inside Track',' . . /C.AB1/ ...@','ABC','Leave yourself a way out before touching the greens.'),
  yard('Garlic Special',' .  ./1CBA@/ ....','ABC','The sidings are different lengths. Stage accordingly.'),
  yard('Follow the Arrow','  .  /@.+A1','A','The stamped arrow is one-way. Throw point 1 before a wheel covers the points.',{points:['WNE'],arrows:[[0,1,1]]}),
  yard('Wrong Approach',' ... /1A+B@/ ... ','BA','The upper bypass runs west. Read the chevrons.',{points:['WNE'],arrows:[[2,0,3]]}),
  yard('Long Spoon',' ..  /B.A+@1/ ....','AB','Back in through the sprung branch, then push along its stem.',{points:['WSE'],arrows:[[2,2,1]]}),
  yard('Platform Swap',' .... /B@+.A1/ ...+.','BA','Both levers can be worked from the signal box.',{points:['WNE','WNE']}),
  yard('Lost Ticket',' ..  /1C+B@/ .A. ','ABC','Stage the middle ingredient where the others can pass.',{points:['WNE'],arrows:[[1,2,1]]}),
  yard('Midnight Loop',' ..... /1.B+A@./  ...+.','AB','Trace both sprung loops before committing a long consist.',{points:['WNE','WNE'],arrows:[[2,0,1],[4,2,3]]}),
  yard('Quarter Turn','  1  /  A  /@.%. /  .  ','A','Roll onto the bridge, then press 1 to turn toward the broth.',{axis:[1]}),
  yard('Single Serving','  1  /  .  /@A%.B/ ... ','AB','A bridge turns under one loose vehicle. Open the link first.',{axis:[1]}),
  yard('Tail First','  .  /1.@%B/ ..A.','AB','Turn the bridge before approaching the car from its other end.',{axis:[0]}),
  yard('Four Doors','  1  /  A. /B.%.@/  ...','BA','A bridge joins exactly two opposite spokes at a time.',{axis:[1]}),
  yard('Back of House',' ..  /1C%BA/ ...@','ABC','Leave a loose wagon on the bridge to rotate underneath it.',{axis:[1]}),
  yard('Round Dinner',' .1  /AB%@./ ... ','BA','The outer lead is one-way. Preserve a return route.',{axis:[0],arrows:[[1,2,1]]}),
  yard('Two Bowls','1A@B2','A/B','Each tray bears its kitchen letter. The two orders can run in parallel.'),
  yard('Second Seating','  .../1AB@2/ ....','B/A','The blue window and red window have separate tickets.'),
  yard('Mix Up',' .  ./1BA@2/ .C..','AC/B','A car for the other kitchen can wait in a bay.'),
  yard('Night Window',' ... /1CAB2/ .@..','BA/C','Use the central bypass between the serving windows.'),
  yard('Orange Bowl','  .../1BAC2/ .@.D','AD/BC','Read each badge. Corn and egg travel to different kitchens.'),
  yard('Dish Pass','  ... /1CA@B2/ .D.. ','BD/AC','Stage one order on the approach to the other.'),
  yard('Staff Only',' .!  /1B.A@/ ... ','AB','The striped refuge admits the engine. Wagons must stay off it.'),
  yard('Night Crew',' ..! /1CBA@/ ....','ABC','Use the protected berth to pass the greens.'),
  yard('Transfer Table',' ..! /1A%B@/ .C..','BAC','A car may turn on the bridge. It cannot enter the refuge.',{axis:[1]}),
  yard('Six Toppings','1ABC@DEF2/   .!.   ','ABC/FED','Two full tickets share a single throat. Work from the center outward.',{flavors:[0,1,0,2,3,2]}),
  yard('Closing Time',' .!.. /1BC@A2/ ..D. ','AD/BC','Keep the striped lead clear for your last departure.'),
  yard('House Special',' ...! /1BD%A2/ ..@C.','AC/DB','Two kitchens, a protected berth and a short bridge. Leave room to turn.',{axis:[1]}),
];
const symbols = 'NESW';
export function makeYard(index, mirror = 0, menuShift = 0) {
  const raw = plans[index],
    width = Math.max(...raw.rows.map(row => row.length)),
    height = raw.rows.length;
  const points = [],
    devices = [],
    windows = [],
    cars = [],
    positions = [],
    byXY = new Map();
  let engine;
  const orient = d => d < 0 ? d : mirror & 1 && d % 2 ? (4 - d) % 4 : mirror & 2 && !(d % 2) ? (d + 2) % 4 : d;
  const transform = (x, y) => [mirror & 1 ? width - 1 - x : x, mirror & 2 ? height - 1 - y : y];
  for (let y = 0; y < height; y++) for (let x = 0; x < raw.rows[y].length; x++) {
    const ch = raw.rows[y][x];
    if (ch === ' ') continue;
    const [cx, cy] = transform(x, y),
      id = points.length;
    points.push({
      x: cx,
      y: cy,
      ch,
      links: [],
      dev: -1
    });
    byXY.set(cx + ',' + cy, id);
    if (ch === '@') engine = id;
    if (/[A-F]/.test(ch)) {
      const car = ch.charCodeAt(0) - 65;
      cars[car] = car;
      positions[car] = id;
    }
    if (/[12]/.test(ch)) windows[Number(ch) - 1] = id;
    if (ch === '+' || ch === '%') {
      points[id].dev = devices.length;
      const n = devices.filter(d => d.type === ch).length;
      devices.push({
        node: id,
        type: ch,
        axis: raw.axis?.[n] ?? 1,
        dirs: ch === '+' ? [...(raw.points?.[n] ?? 'WNE')].map(c => orient(symbols.indexOf(c))) : null
      });
    }
  }
  for (const point of points) point.links = directions.map(([dx, dy]) => byXY.get(point.x + dx + ',' + (point.y + dy)) ?? -1);
  // Facing points have a stem and two genuine arms. Omit a fourth geometrically adjacent spur.
  for (const device of devices) if (device.type === '+') for (let d = 0; d < 4; d++) {
    const n = points[device.node].links[d];
    if (n >= 0 && !device.dirs.includes(d)) {
      points[device.node].links[d] = -1;
      points[n].links[(d + 2) % 4] = -1;
    }
  }
  const oneWay = new Set();
  for (const [x, y, d] of raw.arrows || []) {
    const [cx, cy] = transform(x, y),
      a = byXY.get(cx + ',' + cy),
      b = points[a].links[orient(d)];
    if (b >= 0) oneWay.add(b + ',' + a);
  }
  const tickets = raw.tickets.map(t => Array.from(t, ch => ch.charCodeAt(0) - 65));
  const dish = cars.map(n => ((raw.flavors?.[n] ?? n) + menuShift) % 6);
  const kitchen = cars.map(n => tickets.findIndex(t => t.includes(n)));
  return {
    id: index,
    mirror,
    width,
    height,
    points,
    devices,
    windows,
    tickets,
    kitchen,
    dish,
    oneWay,
    name: raw.name,
    tip: raw.tip,
    line: Math.floor(index / 6),
    start: {
      e: engine,
      h: orient(1),
      cars: positions,
      chain: [],
      bits: 0
    }
  };
}
export function dailyDish(seed) {
  let x = seed >>> 0;
  x = Math.imul(x ^ x >>> 16, 0x45d9f3b);
  x = Math.imul(x ^ x >>> 16, 0x45d9f3b);
  x = (x ^ x >>> 16) >>> 0;
  return makeYard(1 + x % 35, 1 + (x >>> 9) % 3, (x >>> 16) % 6);
}
