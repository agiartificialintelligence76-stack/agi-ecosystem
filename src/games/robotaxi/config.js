// ROBOTAXI RUSH: the numbers the whole game shares. Pure (no DOM): tests/robotaxi.test.js reads it in Node.
//
// The world is a classic pseudo-3D road: a long list of segments SEG units deep, each with a curve and a height. The road
// is 4 lanes of LANE_W units; x = 0 is its middle (cars and the player keep their x relative to the road's middle, so a
// curve bends the road, never a lane). z grows down the road. The camera sits CAM_BACK behind the robotaxi, CAM_H above
// the road under it.

export const SEG = 200;                         // a segment's depth (world units)
export const ROAD_HALF = 2000;                  // half the road's width
export const LANES = 4;
export const LANE_W = (2 * ROAD_HALF) / LANES;  // 1000
export const LANE_X = Object.freeze([-1500, -500, 500, 1500]);
export const RUMBLE = 0.12;                     // the rumble strips' width, in road half-widths
export const EDGE = ROAD_HALF * (1 + RUMBLE);   // the outer edge of the rumble strips
export const BARRIER = EDGE + 120;              // the robotaxi's middle can't go further out than this
export const DRAW = 200;                        // segments drawn ahead of the camera
export const CAM_H = 1000;                      // the camera's height above the road under the robotaxi
export const CAM_BACK = 1400;                   // the camera's distance behind the robotaxi
export const NEAR = 40;                         // nothing nearer the camera than this is drawn

// what the speedometer and the distance say: 1 unit is 1/144 m, so 8,000 units a second reads 200 km/h
export const MPU = 1 / 144;
export const KMH = MPU * 3.6;
export const ZONE_M = 2000;                     // a checkpoint every 2 km
export const ZONE_SEGS = Math.round(ZONE_M / MPU / SEG);   // 1,440 segments
export const ZONE_Z = ZONE_SEGS * SEG;

// the robotaxi: how wide it looks (halfW), how wide it hits (hitHalfW: forgiving), how deep it is, how tall it looks
export const PLAYER = Object.freeze({ halfW: 300, hitHalfW: 214, len: 440, h: 430 });

export const SPEED = Object.freeze({
  start: 8000,         // cruise at the start (200 km/h)
  max: 12000,          // cruise far down the road (300 km/h)
  rampM: 5200,         // how quickly cruise rises with distance (m)
  boost: 1.42,         // boost multiplies cruise
  accel: 3600,         // units/s² towards cruise
  decel: 4200,         // units/s² down (after boost)
  launch: 0.58,        // a run starts at this much of cruise
  lat: 4400,           // the fastest sideways speed (units/s)
  latRate: 16,         // how quickly the sideways speed follows the stick (1/s)
  centrifugal: 380,    // a curve's pull: units/s per curve unit at max speed
  scrape: 0.55,        // speed lost per second on the rumble strips
});

export const BOOST = Object.freeze({ time: 4, perNear: 0.17, perClose: 0.27, perFare: 0.14, perRam: 0 });
export const NEAR_MISS = Object.freeze({ gap: 250, close: 70, points: 250, closePoints: 500, chain: 2, maxMult: 10, minSpeed: 5200 });
export const SHIELDS = 3;
export const GRACE = 2.2;                       // seconds of ghosting after a hit
export const SPIN = 0.9;                        // seconds of spin-out after a hit
export const FARE_POINTS = 500;
export const CHECKPOINT_POINTS = 1000;
export const RAM_POINTS = 150;

// the four zones, in order (a checkpoint moves on to the next one, then they go round again)
export const ZONES = Object.freeze(['dusk', 'night', 'rain', 'coast']);
export const ZONE_NAMES = Object.freeze({ dusk: 'Dusk', night: 'Night City', rain: 'Rain', coast: 'Sunrise Coast' });

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
// cruise speed at a distance (m): 200 km/h at the start, rising towards 300
export const cruiseAt = (m) => SPEED.start + (SPEED.max - SPEED.start) * (1 - Math.exp(-Math.max(0, m) / SPEED.rampM));
// how hard the road is at a distance (m): 0 at the start, 0.36 at 2 km, 0.59 at 4 km, towards 1
export const difficultyAt = (m) => 1 - Math.exp(-Math.max(0, m) / 4600);
export const zoneOfIndex = (i) => ZONES[((Math.floor(i / ZONE_SEGS) % ZONES.length) + ZONES.length) % ZONES.length];
export const segOf = (z) => Math.floor(z / SEG);
