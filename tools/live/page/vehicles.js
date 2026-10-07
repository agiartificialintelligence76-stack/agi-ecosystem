// AGI-1's live show (2026-10-07, the owner: "you can put vehicles also like robotaxi. i have an idea to she can ride the
// vehicles as well and go to places"): the vehicles she rides on her trips. What each is called and how it travels (its
// kind: the sounds on the way and her lines about them, tools/live/trips.js; the scene drawn on the way when its painting
// isn't there yet, places.js TRAVEL), and how a ride moves.
// (2026-10-07, her painted set; the owner after the first preview of her trips: "so bad") She rides inside each: the
// painting of its inside behind her (tools/live/art.mjs paints them, paint.js finds them), moving like a camera riding
// along (rideMotion). Until then each was drawn in code from the outside, and she hopped into its window.
// No brands or logos anywhere: her own robotaxi, a yellow cab, a red double-decker bus (nobody's company).
export const VEHICLES = {
  robotaxi: { name: 'my robotaxi', kind: 'road' },
  taxi: { name: 'a yellow cab', kind: 'road' },
  bus: { name: 'a double-decker bus', kind: 'road' },
  scooter: { name: 'a scooter', kind: 'road' },
  balloon: { name: 'a hot-air balloon', kind: 'sky' },
  train: { name: 'a fast train', kind: 'rail' },
  boat: { name: 'a little boat', kind: 'sea' },
  tuktuk: { name: 'a tuk-tuk', kind: 'road' },
  jeepney: { name: 'a jeepney', kind: 'road' },
  cablecar: { name: 'a cable car', kind: 'cable' },
  plane: { name: 'my plane', kind: 'sky' },
  rocket: { name: 'my rocket', kind: 'space' },
};
export const VEHICLE_IDS = Object.keys(VEHICLES);

// How a ride moves, t seconds into it: { x, y } in set pixels (y down) and r, a tilt in degrees. Her and the picture behind
// her move together (stage.js), small and smooth: a car's bumps, a train's rhythm and its rail joints, a plane's slow float,
// a boat's roll, a cable car's sway, a rocket's rumble.
export function rideMotion(kind, t) {
  const s = Math.sin, TAU = Math.PI * 2;
  switch (kind) {
    case 'rail': return { x: 0.6 * s(t * TAU * 0.35), y: 1.1 * s(t * TAU * 2.4) + ((t % 1.15) < 0.09 ? 1.8 : 0), r: 0 };
    case 'sky': return { x: 2 * s(t * TAU * 0.13), y: 3.5 * s(t * TAU * 0.22) + 1 * s(t * TAU * 0.9), r: 0.3 * s(t * TAU * 0.17) };
    case 'sea': return { x: 1.5 * s(t * TAU * 0.14), y: 4.5 * s(t * TAU * 0.27), r: 0.8 * s(t * TAU * 0.21) };
    case 'cable': return { x: 2.5 * s(t * TAU * 0.24), y: 1.2 * s(t * TAU * 0.5), r: 0.55 * s(t * TAU * 0.24) };
    case 'space': return { x: 0.8 * s(t * TAU * 6.1), y: 1 * s(t * TAU * 7) + 0.5 * s(t * TAU * 4.3), r: 0.08 * s(t * TAU * 3) };
    default: return { x: 0.6 * s(t * TAU * 0.3), y: 2 * Math.abs(s(t * TAU * 1.3)) + 0.7 * s(t * TAU * 3.7), r: 0.12 * s(t * TAU * 0.6) };   // road
  }
}
