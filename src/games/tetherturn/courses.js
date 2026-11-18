import { DT, launch, control, drift, quantAngle, quantPower, runLeg } from './flight.js';
export const systems = ['Milkglass', 'Thimble Belt', 'Twin Bells', 'Pinwheel', 'Firefly Run', 'Violet Apogee'];
export const systemInk = [['#171e43', '#87e4d9', '#fead8d'], ['#2c1c41', '#f7c477', '#e895bb'], ['#181f4c', '#89b6ff', '#e5a1e4'], ['#12383f', '#91ebad', '#edc575'], ['#2b234d', '#ef99e8', '#8bf3cf'], ['#241d4e', '#c9b0ff', '#ffba9b']];
// Each flight plan fixes the launch direction, propellant, nearest-moon offset from its line,
// periapsis distance, gate encounter time, in-flight maneuver sequence and number of service flags.
const cards=[
 ['Tea Saucer',-9,.53,180,56,2.45,'',1],['Paper Kite',-18,.54,170,-64,2.80,'R',1],['Spoon Moon',8,.57,187,54,2.70,'B',1],['Mint Post',-23,.61,157,59,3.00,'L',1],['Rim of Milk',15,.58,189,-55,3.15,'RB',1],['Porcelain Bell',-13,.59,163,61,3.00,'LB',2],
 ['Buttonhook',-18,.64,173,47,3.18,'RB',1],['Moth Needle',17,.58,181,-46,3.42,'LB',1],['Blue Bobbin',-7,.67,204,50,3.28,'RB',1],['Darning Loop',-29,.65,169,-55,3.31,'LB',1],['Red Thimble',11,.66,181,52,3.55,'RFB',1],['Needle’s Eye',-14,.70,160,-45,3.50,'LFB',2],
 ['Duet in Brass',-17,.65,185,62,3.10,'FB',1],['Borrowed Moon',18,.64,171,-49,3.44,'FR',1],['Tuning Fork',-25,.70,173,51,3.32,'FLB',1],['Amber Sisters',8,.65,180,-58,3.54,'FRB',1],['Short Eclipse',-5,.66,201,46,3.58,'FLB',1],['Two Body Waltz',13,.69,184,-54,3.63,'FRB',2],
 ['Clock Garden',-19,.61,165,47,3.26,'LB',1],['Weather Vane',12,.68,202,-54,3.42,'RB',1],['Clockmaker',-27,.71,187,54,3.46,'LB',1],['Gnomon',5,.66,156,-44,3.32,'RB',1],['Orrery Key',-8,.72,177,47,3.70,'LFB',2],['Four O’Clock',19,.70,194,-50,3.63,'RFB',2],
 ['First Firefly',-21,.63,189,56,3.29,'FRB',1],['Violet Stitch',12,.69,177,-51,3.42,'FLB',1],['Amber Ribbon',-5,.71,194,52,3.48,'FRB',1],['Night Thread',-25,.66,162,-48,3.54,'FLB',1],['Lantern Train',8,.72,188,59,3.56,'FRB',2],['Lit Fuse',-15,.69,173,-46,3.66,'FLB',2],
 ['Window Seat',13,.70,190,56,3.42,'LFB',1],['Violet Wake',-22,.67,158,-46,3.51,'RFB',1],['Drifting Seal',8,.73,187,46,3.60,'LFB',2],['Room with a View',-9,.71,200,-51,3.64,'RFB',2],['Folding Map',21,.74,169,50,3.71,'LFB',2],['Last Apogee',-17,.73,191,-44,3.75,'RFB',3]
];
const names = {
  L: 'port',
  R: 'starboard',
  B: 'brake',
  F: 'flip'
};
export const HOLES = cards.map((c, i) => ({
  id: i,
  name: c[0],
  system: Math.floor(i / 6),
  par: c[7]
}));
function makeLeg(index, part, variant) {
  const [name, deg, p, near, side, arrival, moves] = cards[index],
    sys = Math.floor(index / 6);
  const reflected = (variant & 1) !== 0,
    hand = reflected ? -1 : 1,
    angle = quantAngle((deg + (part % 2 ? 17 : part * 4)) * Math.PI / 180 * hand),
    power = quantPower(p + (part % 2 ? .025 : 0));
  const dx = Math.cos(angle),
    dy = Math.sin(angle),
    tee = {
      x: 0,
      y: 0
    },
    basis = (along, off) => ({
      x: dx * along - dy * off * hand,
      y: dy * along + dx * off * hand
    });
  const strength = sys === 0 ? 74000 : 118000 + sys * 9000,
    well = {
      ...basis(near + part * 5, side),
      mass: strength,
      soft: 26 + index % 8
    };
  const wells = [well];
  if (sys >= 2) wells.push({
    ...basis(near + 103, -side * 1.23),
    mass: strength * .69,
    soft: 32
  });
  if (sys >= 4) wells.push({
    ...basis(near + 169, side * 1.28),
    mass: strength * .46,
    soft: 27,
    drift: 7,
    rate: .57,
    phase: index * .5
  });
  const t = arrival + part * .19 + (variant >> 1) * .08,
    total = Math.round(t / DT);
  const controls = [...moves].map((code, i) => ({
    tick: Math.round(total * (moves.length === 1 ? .43 : .26 + .39 * i / Math.max(1, moves.length - 1))),
    id: names[reflected ? code === 'L' ? 'R' : code === 'R' ? 'L' : code : code]
  }));
  const input = {
      angle,
      power,
      controls
    },
    f = launch(tee, angle, power),
    rings = [];
  let beacon = null,
    gateAngle = 0,
    speed = 0;
  for (let k = 0; k < total; k++) {
    for (const burn of controls) if (burn.tick === k) {
      if ((sys === 1 || sys === 3 || sys === 5) && !beacon && burn.id !== 'flip') beacon = {
        x: f.x,
        y: f.y,
        radius: 35 - (sys === 5 ? 5 : 0),
        action: burn.id
      };
      control(f, burn.id);
    }
    if (k === Math.floor(total * .36) || sys >= 2 && k === Math.floor(total * .55) || sys >= 4 && k === Math.floor(total * .77)) rings.push({
      x: f.x,
      y: f.y,
      radius: 15 + index % 4
    });
    drift(f, wells);
  }
  gateAngle = Math.atan2(f.vy, f.vx);
  speed = Math.hypot(f.vx, f.vy);
  const phase = index * .71,
    rate = .70 + index % 4 * .08,
    mdx = sys === 5 ? 13 + part * 2 : 0,
    mdy = sys === 5 ? 16 : 0;
  const swing = sys === 3 ? .49 : sys === 5 ? .24 : 0;
  const cup = {
    x: f.x - mdx * Math.sin(t * rate + phase),
    y: f.y - mdy * Math.cos(t * rate + phase),
    dx: mdx,
    dy: mdy,
    phase,
    rate,
    gate: gateAngle - swing * Math.sin(t * rate + phase),
    swing
  };
  const all = [tee, f, ...wells, ...rings],
    xs = all.map(o => o.x),
    ys = all.map(o => o.y);
  const optional = sys > 0 ? {
    x: rings[0].x - dy * hand * (32 + part * 3),
    y: rings[0].y + dx * hand * (32 + part * 3),
    radius: 13
  } : null;
  return {
    tee,
    wells,
    cup,
    beacon,
    rings,
    optional,
    phaseRequired: sys === 2 || sys === 4 || sys === 5,
    radius: sys === 0 ? 33 : 29,
    gateWidth: sys === 0 ? 1.05 : sys === 3 ? .26 : sys === 5 ? .34 : .72,
    maxSpeed: speed * 1.28 + 15,
    settle: .54 + sys * .035,
    fuel: sys === 0 ? 2 : 3,
    timeout: Math.round((t + 4) / DT),
    bounds: [Math.min(...xs) - 115, Math.min(...ys) - 130, Math.max(...xs) + 150, Math.max(...ys) + 130],
    input
  };
}
const cache = new Map();
export function hole(index, variant = 0) {
  const key = index + '/' + variant;
  if (!cache.has(key)) {
    const h = HOLES[index],
      legs = Array.from({
        length: h.par
      }, (_, i) => makeLeg(index, i, variant));
    cache.set(key, {
      ...h,
      variant,
      legs
    });
  }
  return cache.get(key);
}
export function dailyNine(seed) {
  let n = seed >>> 0,
    used = new Set(),
    list = [];
  for (let i = 0; i < 9; i++) {
    n = Math.imul(n, 1664525) + 1013904223 >>> 0;
    let id = (Math.floor(i * 6 / 9) * 6 + (n >>> 9) % 6) % 36;
    while (used.has(id)) id = (id + 1) % 36;
    used.add(id);
    list.push({
      id,
      variant: (n >>> 17) % 4
    });
  }
  return list;
}
