// These are original, stylised station songs. Each has its own rhythm, contour, timbre and soundless tracing.
export const SPECIES = [['Humpback', 'Velvet Ladder', 'sine', 143, [1, 1.18, 1.48], [0, .38, .82], '#ffe39f', 'rising three'], ['Beluga', 'Bubble Waltz', 'triangle', 347, [1.4, 1, 1.4, 1.7], [0, .16, .47, .65], '#7eeace', 'skip and rise'], ['Orca', 'Harbor Whistle', 'sine', 302, [1, 1.52, 1.08], [0, .24, .67], '#f5a7cd', 'peak and dip'], ['Blue whale', 'Midnight Organ', 'sine', 84, [1.42, 1.16, .91], [0, .65, 1.19], '#aabaed', 'long descent'], ['Sperm whale', 'Clockwork Click', 'triangle', 226, [1.2, 1.2, 1.2, .89], [0, .13, .27, .74], '#ffb48d', 'three taps'], ['Minke', 'Ribbon Drum', 'sine', 174, [1, .85, 1.24, 1], [0, .22, .52, .84], '#9ceabb', 'down and over'], ['Pilot whale', 'Porcelain Pair', 'triangle', 263, [1.2, 1.5, .9, 1.1], [0, .13, .72, .89], '#cbc2f8', 'two pairs'], ['Narwhal', 'Ice Needle', 'sine', 413, [1, 1.3, 1.5, 1.9], [0, .25, .45, .59], '#9ddcef', 'bright staircase'], ['Fin whale', 'Fog Pulse', 'sine', 104, [1.50, .81, 1.50, .81], [0, .12, .70, .83], '#fac77f', 'two low drops'], ['Bowhead', 'Deep Lantern', 'triangle', 128, [1, 1.58, 1.1], [0, .49, 1.09], '#f2acd5', 'slow arch'], ['Right whale', 'Shell Hinge', 'sine', 193, [.76, 1.4, 1.4], [0, .53, .84], '#8addcb', 'lift and hold'], ['Gray whale', 'Pebble Rattle', 'triangle', 183, [1, .97, 1.13, .76, 1], [0, .1, .22, .56, .94], '#eee2ad', 'rattle and fall']].map(([name, title, wave, hz, notes, beats, color, shape], id) => ({
  id,
  name,
  title,
  wave,
  hz,
  notes,
  beats,
  color,
  shape
}));
export const REGIONS = [['Glasswater Pier', 'calm shelf', 0, 0, 1], ['Tin Bell Bay', 'two voices', .04, .13, 2], ['Kelp Switchback', 'moving singers', .18, .22, 2], ['Blue Stair', 'first thermocline', .12, .38, 2], ['Whisper Canyons', 'ghost returns', .21, .53, 3], ['Polar Lanterns', 'ice static', .28, .61, 3], ['Midnight Narrows', 'crossing chorus', .35, .71, 3], ['The Violet Deep', 'three-layer survey', .43, .80, 4]].map(([name, lesson, speed, bend, voices], id) => ({
  id,
  name,
  lesson,
  speed,
  bend,
  voices
}));
export const DEPTH = ['Shelf', 'Midwater', 'Deep'];
export const SHIFTS = REGIONS.flatMap(region => ['Dawn', 'Ebb', 'Crosscurrent', 'Moonrise'].map((watch, part) => ({
  id: region.id * 4 + part,
  region: region.id,
  name: region.name + ' · ' + watch,
  part,
  quota: part === 3 ? 5 : part === 2 ? 4 : 3
})));
export function hash(seed, index) {
  let n = (seed ^ Math.imul(index + 1, 2654435761)) >>> 0;
  n = Math.imul(n ^ n >>> 16, 0x7feb352d);
  n = Math.imul(n ^ n >>> 15, 0x846ca68b);
  return (n ^ n >>> 16) >>> 0;
}
export const unit = (seed, i) => hash(seed, i) / 4294967296;
