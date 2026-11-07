// GRADIENT DESCENT (2026-11-08): the 18 handmade holes, three courses of six. Each is a little loss landscape made of
// parts (terrain.js): the cup is always its lowest point (tests/gradient.test.js samples every hole to make sure), the
// valleys that aren't are local minima. Greens are flat floors ("basins"), so the last putt is real putting. Hazards
// arrive one course at a time: bumper posts, then sticky "weight decay" patches and ripples, then NaN pits.
//
// A hole: { id, name, pun, par, size: [w, d], start: [x, z], hole: [x, z], parts, posts: [[x, z, r]],
//           sticky: [[x, z, rx, rz]], pits: [[x, z, r]], contour (the contour lines' step) }

export const COURSES = [
  {
    id: 'warmup', n: 1, name: 'Warm-up', short: 'Warm-up', preview: 0.6, blurb: 'Convex, kind and forgiving.',
    holes: [
      {
        id: 'bowl', name: 'The Bowl', pun: 'Convex. Everything rolls home.', par: 2,
        size: [16, 16], start: [-5.2, -4.8], hole: [3.0, 0.2],
        parts: [
          { t: 'basin', c: [1.2, 1.6], r: 3.8, k: 0.12, a: 2.2 },
          { t: 'gauss', c: [-6, 5.5], a: 1.1, s: 2.6 },
          { t: 'gauss', c: [6.2, -5.4], a: 0.9, s: 2.2 },
          { t: 'green', c: [1.4, 1.2], r: 2.6, e: 1.2, depth: 0.2 },
        ],
      },
      {
        id: 'ramp', name: 'The Ramp', pun: 'One slope, one direction. Trust it.', par: 2,
        size: [12, 20], start: [0.6, 7.6], hole: [-2.2, -7.0],
        parts: [
          { t: 'step', c: [0, 1.0], rot: -90, a: 2.6, e: 1.6 },
          { t: 'basin', c: [-1.0, -6.4], r: 2.6, k: 0.3, a: 0.4 },
          { t: 'gauss', c: [-0.6, -3.6], a: 0.3, s: 0.8 },
          { t: 'gauss', c: [-3.4, 4.6], a: 0.5, s: 1.4 },
          { t: 'gauss', c: [3.6, 2.6], a: 0.45, s: 1.3 },
          { t: 'green', c: [-1.0, -6.4], r: 2.3, e: 1.0, depth: 0.15 },
        ],
      },
      {
        id: 'valley', name: 'Gentle Valley', pun: 'Follow the valley floor.', par: 2,
        size: [18, 16], start: [-7.4, 2.2], hole: [5.0, 3.0],
        parts: [
          { t: 'banana', c: [0, -2.6], k: 0.075, s: 1.8, a: 1.9 },
          { t: 'gauss', c: [-9.5, 3.0], a: 1.8, s: 4.2 },
          { t: 'basin', c: [6.2, 1.8], r: 2.6, k: 0.3, a: 0.6 },
          { t: 'gauss', c: [0.5, 5.6], a: 0.8, s: 2.4 },
          { t: 'green', c: [6.0, 2.0], r: 2.2, e: 1.0, depth: 0.2 },
        ],
      },
      {
        id: 'twovalleys', name: 'Two Valleys', pun: 'One of these is a trap.', par: 3,
        size: [18, 18], start: [-6.8, -6.4], hole: [6.0, 3.2],
        parts: [
          { t: 'gauss', c: [-7, -7], a: 1.4, s: 4.0 },
          { t: 'basin', c: [4.6, 4.4], r: 2.8, k: 0.3, a: 2.0 },
          { t: 'basin', c: [-1.6, -1.4], r: 1.6, k: 0.5, a: 1.1 },
          { t: 'gauss', c: [1.6, 1.2], a: 0.8, s: 1.2 },
          { t: 'gauss', c: [-5.5, 5.5], a: 1.0, s: 2.4 },
          { t: 'gauss', c: [6.4, -6.0], a: 0.8, s: 2.2 },
          { t: 'green', c: [4.6, 4.2], r: 2.4, e: 1.2, depth: 0.2 },
        ],
      },
      {
        id: 'bumpers', name: 'Bumper Garden', pun: 'Posts bounce. Use them.', par: 3,
        size: [16, 18], start: [0, -7.4], hole: [-0.9, 4.6],
        parts: [
          { t: 'basin', c: [0.3, 3.6], r: 2.6, k: 0.26, a: 2.0 },
          { t: 'gauss', c: [-4.5, -2.0], a: 0.9, s: 1.8 },
          { t: 'gauss', c: [4.4, -1.2], a: 0.8, s: 1.6 },
          { t: 'green', c: [0.3, 3.6], r: 2.2, e: 1.0, depth: 0.2 },
        ],
        posts: [[0, -1.6], [-1.6, 0.2], [1.8, 0.4], [-2.8, 4.8], [3.0, 4.6], [0.3, 6.8]],
      },
      {
        id: 'ridge', name: 'The Ridge', pun: 'Climb before you descend.', par: 3,
        size: [18, 18], start: [-1.5, -7.0], hole: [-0.4, 6.0],
        parts: [
          { t: 'ridge', p: [-9.5, 0.2], q: [4.4, 0.8], a: 2.0, s: 1.1 },
          { t: 'basin', c: [1.4, 5.2], r: 2.6, k: 0.3, a: 1.0 },
          { t: 'gauss', c: [-1.0, -9.5], a: 1.0, s: 3.2 },
          { t: 'gauss', c: [6.5, -5.5], a: 0.9, s: 2.0 },
          { t: 'green', c: [1.0, 5.4], r: 2.2, e: 1.0, depth: 0.2 },
        ],
        posts: [[6.9, 0.4]],
      },
    ],
  },
  {
    id: 'saddle', n: 2, name: 'Saddle Country', short: 'Saddle Country', preview: 0.4, blurb: 'Saddles, bananas and sticky weight decay.',
    holes: [
      {
        id: 'saddle', name: 'Saddle Point', pun: 'Flat isn’t the bottom.', par: 3,
        size: [18, 18], start: [-6.6, 3.2], hole: [6.4, 1.2],
        parts: [
          { t: 'saddle', c: [0, 0], rot: 90, a: 2.2, k: [0.06, 0.035] },
          { t: 'basin', c: [6.0, -0.2], r: 2.4, k: 0.4, a: 1.0 },
          { t: 'basin', c: [-6.2, 0.6], r: 1.5, k: 0.4, a: 0.45 },
          { t: 'green', c: [5.8, -0.2], r: 2.0, e: 1.0, depth: 0.25 },
        ],
        posts: [[3.4, 2.6], [3.6, -3.0]],
      },
      {
        id: 'banana', name: 'The Banana', pun: 'Long, narrow, curved. A classic.', par: 4,
        size: [22, 16], start: [-8.2, 3.4], hole: [7.2, 4.5],
        parts: [
          { t: 'banana', c: [0, -5.0], k: 0.13, s: 1.2, a: 2.4 },
          { t: 'plane', g: [-0.22, 0] },
          { t: 'basin', c: [7.8, 3.0], r: 2.0, k: 0.4, a: 0.6 },
          { t: 'green', c: [7.8, 3.4], r: 1.9, e: 0.9, depth: 0.2 },
        ],
        sticky: [[-4.2, -2.6, 1.1, 0.9]],
      },
      {
        id: 'decay', name: 'Weight Decay', pun: 'Sticky patches slow everything down.', par: 3,
        size: [18, 18], start: [-6.6, 6.6], hole: [4.4, -6.2],
        parts: [
          { t: 'plane', g: [-0.08, 0.08] },
          { t: 'basin', c: [5.4, -5.2], r: 2.4, k: 0.2, a: 0.7 },
          { t: 'gauss', c: [-1.0, -3.5], a: 1.3, s: 2.0 },
          { t: 'gauss', c: [3.5, 3.0], a: 1.1, s: 1.8 },
          { t: 'green', c: [5.4, -5.2], r: 2.2, e: 1.0, depth: 0.2 },
        ],
        sticky: [[-0.4, 1.0, 2.6, 1.2], [2.8, -2.0, 1.3, 2.4]],
        posts: [[1.4, -0.4]],
      },
      {
        id: 'double', name: 'Double Descent', pun: 'It gets worse before it gets better.', par: 4,
        size: [16, 22], start: [0, -9.0], hole: [1.4, 7.4],
        parts: [
          { t: 'plane', g: [0, -0.1] },
          { t: 'basin', c: [0, -2.8], r: 1.5, k: 0.2, a: 1.4 },
          { t: 'ridge', p: [-9, 1.6], q: [9, 1.6], a: 1.3, s: 1.0 },
          { t: 'basin', c: [0.6, 6.4], r: 1.4, k: 0.2, a: 1.5 },
          { t: 'bowl', c: [0, 0], a: 0.03, b: 0 },
          { t: 'green', c: [0.6, 6.6], r: 2.0, e: 1.0, depth: 0.2 },
        ],
        pits: [[0.8, 9.6, 0.85]],
      },
      {
        id: 'momentum', name: 'Momentum', pun: 'Keep your momentum. Literally.', par: 3,
        size: [16, 20], start: [0.5, -8.2], hole: [-1.6, 7.6],
        parts: [
          { t: 'plane', g: [0, -0.08] },
          { t: 'ripple', c: [0, -0.5], rot: 90, a: 0.4, f: [1.2, 0], s: 4.5 },
          { t: 'basin', c: [-0.4, 6.8], r: 2.6, k: 0.2, a: 1.2 },
          { t: 'bowl', c: [0, 0], a: 0.025, b: 0 },
          { t: 'green', c: [-0.4, 6.8], r: 2.2, e: 1.0, depth: 0.2 },
        ],
        sticky: [[5.4, 2.0, 1.4, 2.6]],
      },
      {
        id: 'schedule', name: 'Learning Rate Schedule', pun: 'Big steps first, small steps later.', par: 4,
        size: [18, 20], start: [-6.4, -8.0], hole: [6.0, 6.0],
        parts: [
          { t: 'step', c: [0, -3.6], rot: -90, a: -1.3, e: 0.35 },
          { t: 'step', c: [0, 1.8], rot: -90, a: -1.3, e: 0.35 },
          { t: 'plane', g: [-0.035, 0] },
          { t: 'basin', c: [5.0, 7.0], r: 2.4, k: 0.25, a: 0.5 },
          { t: 'gauss', c: [-5.5, 4.5], a: 0.8, s: 1.6 },
          { t: 'green', c: [5.0, 6.8], r: 2.2, e: 1.0, depth: 0.2 },
        ],
        posts: [[-1.0, -0.8], [2.8, -1.2], [0.6, 4.4]],
        pits: [[7.4, 1.0, 0.75]],
      },
    ],
  },
  {
    id: 'badlands', n: 3, name: 'The Overfit Badlands', short: 'Badlands', preview: 0.26, blurb: 'NaN pits, cliffs and noise. Good luck.',
    holes: [
      {
        id: 'minima', name: 'Local Minima Field', pun: 'Every dip looks like the answer.', par: 4,
        size: [18, 18], start: [-6.8, -6.8], hole: [5.6, 3.8],
        parts: [
          { t: 'ripple', c: [-1.5, -1.5], rot: 15, a: 0.36, f: [1.05, 1.05], ph: [0.6, 1.4], s: 6.5 },
          { t: 'bowl', c: [4.6, 4.4], a: 0.012, b: 0.012 },
          { t: 'basin', c: [4.8, 4.6], r: 2.2, k: 0.35, a: 1.0 },
          { t: 'green', c: [4.8, 4.6], r: 1.8, e: 0.8, depth: 0.25 },
        ],
        pits: [[-1.2, 2.6, 0.7], [2.6, -2.4, 0.7]],
      },
      {
        id: 'vanishing', name: 'Vanishing Gradient', pun: 'No slope, no help. Push it.', par: 4,
        size: [16, 24], start: [0.4, -10.0], hole: [-0.2, 9.6],
        parts: [
          { t: 'mesa', c: [0, -3.0], r: [8.6, 9.6], e: 0.09, a: 2.6 },
          { t: 'plane', g: [0, 0.015] },
          { t: 'basin', c: [-0.8, 9.2], r: 1.3, k: 0.3, a: 0.6 },
          { t: 'green', c: [-0.8, 9.0], r: 1.8, e: 0.8, depth: 0.15 },
        ],
        posts: [[-2.2, -1.0], [2.4, 1.4], [-0.4, 3.6]],
        pits: [[3.6, 9.0, 0.8], [-4.8, 9.8, 0.7]],
      },
      {
        id: 'exploding', name: 'Exploding Gradient', pun: 'Steep drop. Mind the NaNs.', par: 4,
        size: [20, 20], start: [-6.6, -6.6], hole: [6.2, 4.6],
        parts: [
          { t: 'mesa', c: [-5.0, -5.0], r: [4.4, 4.0], e: 0.035, a: 3.0, rot: 10 },
          { t: 'mesa', c: [5.6, -5.4], r: [3.2, 3.6], e: 0.05, a: 2.2 },
          { t: 'plane', g: [-0.06, -0.06] },
          { t: 'basin', c: [5.4, 5.6], r: 2.4, k: 0.3, a: 0.6 },
          { t: 'gauss', c: [-5.4, 5.6], a: 1.2, s: 2.2 },
          { t: 'green', c: [5.4, 5.6], r: 2.0, e: 1.0, depth: 0.2 },
        ],
        pits: [[-0.6, -1.0, 0.8], [1.6, 1.4, 0.7], [-2.6, 2.0, 0.7]],
      },
      {
        id: 'noisy', name: 'Noisy Labels', pun: 'The signal’s in there somewhere.', par: 4,
        size: [18, 18], start: [6.8, -6.8], hole: [-6.2, 6.4],
        parts: [
          { t: 'plane', g: [0.08, -0.08] },
          { t: 'ripple', c: [0, 0], rot: 30, a: 0.12, f: [2.2, 1.7], ph: [0.3, 1.1], s: 0 },
          { t: 'ripple', c: [0, 0], rot: -50, a: 0.08, f: [3.1, 2.6], ph: [1.7, 0.4], s: 0 },
          { t: 'basin', c: [-5.4, 5.6], r: 2.4, k: 0.2, a: 1.0 },
          { t: 'gauss', c: [0.5, 0.2], a: 1.1, s: 1.8 },
          { t: 'green', c: [-5.4, 5.6], r: 1.8, e: 1.0, depth: 0.2 },
        ],
        pits: [[-1.4, 3.6, 0.7], [3.0, -1.6, 0.7], [-4.4, 0.6, 0.65]],
        sticky: [[1.8, 3.4, 1.6, 1.1]],
      },
      {
        id: 'narrow', name: 'The Narrow Basin', pun: 'The best answer is the hardest to find.', par: 4,
        size: [18, 18], start: [-6.8, 6.6], hole: [5.6, -5.4],
        parts: [
          { t: 'bowl', c: [0, 0], a: 0.018, b: 0.018 },
          { t: 'basin', c: [-0.8, 0.4], r: 3.0, k: 0.12, a: 1.4 },
          { t: 'basin', c: [5.8, -5.6], r: 1.2, k: 0.5, a: 3.0 },
          { t: 'ridge', p: [2.6, -8.5], q: [3.2, -2.6], a: 0.9, s: 0.6 },
          { t: 'ridge', p: [3.2, -2.6], q: [8.8, -2.0], a: 0.9, s: 0.6 },
          { t: 'green', c: [5.8, -5.6], r: 0.9, e: 0.6, depth: 0.1 },
        ],
        pits: [[1.6, -0.6, 0.7], [4.6, -2.2, 0.55]],
        posts: [[6.8, -3.6]],
      },
      {
        id: 'overfit', name: 'Overfit', pun: 'Memorized the course? Prove it.', par: 5,
        size: [22, 18], start: [-9.0, 0.6], hole: [8.4, 1.6],
        parts: [
          { t: 'banana', c: [-0.6, -6.6], k: 0.1, s: 1.3, a: 2.2 },
          { t: 'gauss', c: [-11, 1], a: 2.4, s: 6.5 },
          { t: 'ripple', c: [0, 0], rot: 10, a: 0.09, f: [2.4, 2.0], ph: [0.5, 0.2], s: 0 },
          { t: 'gauss', c: [-0.6, 5.0], a: 0.9, s: 2.4 },
          { t: 'basin', c: [7.6, 0.4], r: 2.0, k: 0.4, a: 1.0 },
          { t: 'green', c: [7.8, 0.8], r: 1.6, e: 0.9, depth: 0.2 },
        ],
        pits: [[-3.0, -3.4, 0.6], [3.6, -3.4, 0.6]],
        posts: [[5.0, -2.6], [-5.6, -1.0]],
        sticky: [[-1.6, -6.4, 1.3, 0.9]],
      },
    ],
  },
];

export const HOLES = COURSES.flatMap((c) => c.holes.map((h, i) => ({ ...h, course: c.n, index: i, preview: h.preview ?? c.preview })));
export const holeDef = (course, index) => HOLES.find((h) => h.course === course && h.index === index) || null;
