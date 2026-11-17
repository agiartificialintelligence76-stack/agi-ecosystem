const EDGE = 180;
export function reflected(value, edge = EDGE) {
  const period = edge * 4;
  const step = ((value + edge) % period + period) % period;
  return (step <= edge * 2 ? step : period - step) - edge;
}
// A bank shot aims at the mirror image of its destination beyond the side wall.
export function laneAt(origin, target, bank, z) {
  const beyond = bank ? (target.x > 0 ? EDGE * 2 : -EDGE * 2) - target.x : target.x;
  return {x:reflected(origin.x + (beyond-origin.x)*z), y:origin.y+(target.y-origin.y)*z};
}
export function shotPower(seconds) {
  const tick = (seconds * .92) % 2;
  return tick <= 1 ? tick : 2 - tick;
}
export function stampPoints(express, bank, streak, special) {
  return (express?105:55) + (bank?28:0) + (special?24:0) + Math.min(streak,10)*8;
}
