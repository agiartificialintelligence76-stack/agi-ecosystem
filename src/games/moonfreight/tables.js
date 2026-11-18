import { ball, pockets, W, H, R } from './physics.js';
export const chapters = ['Cut Glass', 'Afterimage', 'Brass Rails', 'Family Trees', 'Gravity Salon', 'Called Moons'];
export const rivals = ['Host', 'Chalk Artist', 'Rail Reader', 'Planetkeeper', 'Eclipse Captain', 'House Champion'];
// Each card fixes the pocket, incoming bearing from that mouth, object depth, approach,
// cue-to-object distance and a positional or mechanical feat. Distances are felt units.
const specs=[
 ['First Light',1,90,112,0,83,'soft'],['Fine Crescent',0,31,155,-24,85,'cut'],['Apricot Slice',2,145,165,28,92,'cut'],['Low Lantern',3,-34,184,19,102,'soft'],['Paper Edge',5,-147,225,-26,87,'cut'],['Open Fan',4,-76,139,34,112,'cut'],
 ['Redshift',1,99,113,-6,85,'follow'],['Cold Chalk',4,-88,145,9,112,'draw'],['After the Kiss',0,32,191,14,88,'follow'],['Reverse Bloom',5,-149,167,-10,104,'draw'],['Velvet Foot',2,145,198,20,92,'follow'],['Long Goodbye',3,-37,205,-17,102,'draw'],
 ['Copper Mirror',1,0,0,0,86,'bank','bottom',205,181],['Six O’Clock',4,0,0,0,84,'bank','top',603,220],['Cathedral',0,0,0,0,70,'bank','bottom',362,194],['Silver Fork',5,0,0,0,62,'bank','top',454,224],['Long Cushion',3,0,0,0,76,'bank','top',253,221],['House Rail',2,0,0,0,89,'bank','bottom',523,190],
 ['Quiet Gossip',1,84,103,0,62,'combo'],['Cherry Relay',4,-101,117,5,67,'combo'],['Little Sisters',0,34,120,8,74,'combo'],['Double Echo',5,-150,147,-4,71,'combo'],['Gold Thread',2,144,157,7,76,'combo'],['Grand Cascade',3,-32,182,-8,81,'combo'],
 ['Milk Orbit',1,100,134,3,85,'well'],['Warm Current',0,30,160,-12,89,'well'],['Blue Eddy',5,-143,137,11,92,'well'],['Double Star',2,140,202,18,93,'well'],['Pendulum',4,-84,157,-14,105,'well'],['Tidal Knot',3,-33,176,21,111,'well'],
 ['Call the Dawn',0,32,135,-10,76,'called'],['South Window',4,-96,153,13,84,'called'],['Ivory Corner',5,-144,162,-14,83,'called'],['Second Signature',1,93,164,8,92,'called'],['Violet Address',3,-32,195,15,95,'called'],['Midnight Seal',2,144,205,-18,106,'called']
];
const rad = n => n * Math.PI / 180;
export function atlas(i) {
  const [name, pocket, deg, depth, offset, reach, feat, side, ox, oy] = specs[i],
    mouth = pockets[pocket];
  let direction = rad(deg + 180),
    x = mouth[0] + Math.cos(rad(deg)) * depth,
    y = mouth[1] + Math.sin(rad(deg)) * depth;
  if (side) {
    x = ox;
    y = oy;
    const yy = side === 'top' ? 28 - mouth[1] : 2 * (H - 14) - mouth[1];
    direction = Math.atan2(yy - y, mouth[0] - x);
  }
  const dx = Math.cos(direction),
    dy = Math.sin(direction),
    comb = feat === 'combo',
    first = comb ? {
      x: x - dx * 43,
      y: y - dy * 43
    } : {
      x,
      y
    };
  const aim = direction + rad(offset),
    gx = first.x - 2 * R * dx,
    gy = first.y - 2 * R * dy;
  const balls = [ball(0, gx - Math.cos(aim) * reach, gy - Math.sin(aim) * reach, 'cue'), ball(1, first.x, first.y, feat === 'called' ? 'moon' : 'sun')];
  if (comb) balls.push(ball(2, x, y, 'stripe'));
  const wells = feat === 'well' ? [{
    x: x + 45 * (i % 2 ? 1 : -1),
    y: y + 33,
    mass: 102000 + (i - 24) * 32000,
    dx: i >= 27 ? 14 : 0,
    dy: i >= 27 ? 10 : 0,
    phase: i
  }] : [];
  if (i === 27 || i === 29) wells.push({
    x: x - 83,
    y: y - 45,
    mass: 49000,
    dx: -11,
    dy: 8,
    phase: .8
  });
  const addOns = {
    4: [[491, 149]],
    6: [[574, 277]],
    7: [[243, 176]],
    8: [[520, 286]],
    9: [[254, 104]],
    10: [[325, 276]],
    11: [[589, 206], [280, 128]],
    15: [[265, 162]],
    16: [[624, 194]],
    17: [[269, 177]],
    21: [[279, 223]],
    23: [[559, 204]],
    27: [[259, 141]],
    29: [[489, 139]],
    32: [[405, 144]],
    33: [[198, 255]],
    34: [[619, 145]],
    35: [[285, 211], [486, 268]]
  };
  const extras = addOns[i] || [];
  extras.forEach(([cx, cy], j) => balls.push(ball(3 + j, cx, cy, 'sun')));
  return {
    id: i,
    name,
    pocket,
    feat,
    side,
    balls,
    wells,
    chapter: Math.floor(i / 6),
    aim,
    target: comb ? 2 : 1,
    extra: extras.map((_, j) => 3 + j),
    par: 1 + extras.length,
    spin: feat === 'draw' ? -.7 : feat === 'follow' ? .7 : 0
  };
}
export const ATLAS = specs.map((_, i) => atlas(i));
export function rack(level, condition = 0, seed = 0) {
  const root = level * 3 + condition,
    drift = seed % 17 - 8;
  const openings = [[[191, 198], [377, 105], [531, 252], [620, 104], [222, 305], [449, 195], [690, 318], [320, 221]], [[213, 221], [388, 292], [536, 132], [172, 84], [644, 300], [462, 204], [674, 72], [299, 157]], [[179, 179], [329, 90], [475, 247], [666, 118], [265, 294], [530, 197], [611, 306], [362, 218]]];
  const points = openings[condition % 3],
    n = level >= 3 ? 7 : 5;
  const balls = Array.from({
    length: n + 1
  }, (_, i) => {
    let [x, y] = points[i];
    if (level % 2) y = H - y;
    x += i === 0 ? 0 : drift * Math.sin(root + i);
    y += i === 0 ? 0 : (root * 7 + i * 3) % 23 - 11;
    return ball(i, x, y, i === 0 ? 'cue' : i === n ? 'moon' : i % 2 ? 'sun' : 'stripe');
  });
  const wells = level ? Array.from({
    length: level >= 3 ? 2 : 1
  }, (_, i) => ({
    x: 330 + i * 180,
    y: 144 + i * 109,
    mass: 39000 + level * 8000,
    dx: level >= 4 ? 18 : 0,
    dy: level >= 4 ? 12 : 0,
    phase: condition + i
  })) : [];
  return {
    name: rivals[level],
    level,
    condition,
    balls,
    wells,
    root
  };
}
export function dailySet(seed) {
  let n = seed >>> 0;
  const result = [];
  for (let i = 0; i < 3; i++) {
    n = Math.imul(n, 1664525) + 1013904223 >>> 0;
    result.push({
      level: i * 2 + n % 2,
      condition: (n >>> 7) % 3,
      seed: (n >>> 12) % 141
    });
  }
  return result;
}
