const ink = '#261c3b',
  cream = '#ffedc3';
function shape(g, pts, color, stroke = ink, w = 3) {
  g.beginPath();
  for (const [i, a] of pts.entries()) {
    if (a.length === 2) {
      if (!i) g.moveTo(...a);
      else g.lineTo(...a);
    } else if (a.length === 4) g.quadraticCurveTo(...a);
    else g.bezierCurveTo(...a);
  }
  g.closePath();
  g.fillStyle = color;
  g.fill();
  if (stroke) {
    g.lineWidth = w;
    g.strokeStyle = stroke;
    g.stroke();
  }
}
function line(g, a, b, x, y, c = ink, w = 2) {
  g.beginPath();
  g.moveTo(a, b);
  g.lineTo(x, y);
  g.lineWidth = w;
  g.strokeStyle = c;
  g.stroke();
}
function box(g, x, y, w, h, c, r = 0, outline = null) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  g.fillStyle = c;
  g.fill();
  if (outline) {
    g.strokeStyle = outline;
    g.lineWidth = 2.5;
    g.stroke();
  }
}
function oval(g, x, y, rx, ry, c, s = null, sw = 2) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  g.fillStyle = c;
  g.fill();
  if (s) {
    g.lineWidth = sw;
    g.strokeStyle = s;
    g.stroke();
  }
}
function type(g, str, x, y, size, color = cream, weight = 800, face = 'AK Mono') {
  g.fillStyle = color;
  g.font = weight + ' ' + size + 'px "' + face + '",sans-serif';
  g.fillText(str, x, y);
}
function bg(g, x, y, w, h, top, bottom) {
  const z = g.createLinearGradient(0, y, 0, y + h);
  z.addColorStop(0, top);
  z.addColorStop(1, bottom);
  g.fillStyle = z;
  g.fillRect(x, y, w, h);
}
const skies = [
  ['#3c3673', '#df8379'],
  ['#373268', '#cc846c'],
  ['#233a64', '#749fa1'],
  ['#512b60', '#e18074'],
  ['#2b355c', '#bd6f87'],
  ['#45335d', '#db9366'],
  ['#242e5b', '#bb908b'],
];
function city(g, night, t) {
  const sky = skies[night];
  bg(g, 10, 8, 620, 344, ...sky);
  oval(g, 446, 59, 25, 25, '#f4c384');
  oval(g, 455, 51, 23, 23, sky[0]);
  for (let i = 0; i < 43; i++) {
    const x = (i * 227 + 31) % 600,
      y = (i * 43 + 5) % 119;
    oval(g, x, y, i % 5 === 0 ? 1.5 : 0.8, i % 5 === 0 ? 1.5 : 0.8, '#ffe3ad');
  }
  for (let i = 0; i < 26; i++) {
    const x = i * 25 - 8,
      y = 126 + ((i * 67) % 85);
    box(g, x, y, 26, 180, '#5b4b68');
    if (i % 3 === 1) line(g, x + 8, y, x + 9, y - 11, '#57445e', 2);
  }
  for (let i = 0; i < 18; i++) {
    const x = i * 37 - 8,
      y = 173 + ((i * 93 + night * 5) % 72);
    box(g, x, y, 39, 170, i % 2 ? '#3e3852' : '#443b51');
    for (let j = 0; j < 15; j++) {
      if ((j * 11 + i * 4) % 6 < 3)
        box(
          g,
          x + 3 + (j % 3) * 11,
          y + 9 + Math.floor(j / 3) * 15,
          5,
          7,
          (i + j) % 4 === 0 ? '#f2b675' : '#b78278'
        );
    }
  }
  for (const x of [26, 191, 425, 609]) box(g, x, 0, 8, 341, '#322540');
  box(g, 16, 113, 610, 7, '#372b49');
  box(g, 0, 303, 640, 22, '#432f43');
  box(g, 0, 302, 640, 5, '#956c70');
  // A passing train lights the same windows at a different time each evening.
  const tx = ((t * 12 + night * 53) % 820) - 102;
  box(g, tx, 276, 99, 7, '#463449');
  for (let i = 0; i < 9; i++) box(g, tx + 4 + 10 * i, 277, 5, 3, '#dfa46c');
}
function hair(g, t, mood) {
  g.save();
  const bob = Math.sin(t * 1.7) * 1.4;
  g.translate(0, bob);
  const h = '#dda14f',
    lit = '#ffce74',
    pale = '#ffe5a1',
    shade = '#c08753';
  // Back locks, a small hood, and the silhouette of her broad broadcast headphones.
  shape(
    g,
    [
      [210, 186],
      [207, 99, 274, 82],
      [367, 62, 403, 158],
      [424, 205, 392, 260],
      [404, 289, 432, 302],
      [385, 327, 348, 313],
      [281, 331, 239, 309],
      [210, 318, 196, 315],
      [215, 293, 208, 274],
      [184, 255, 197, 230],
    ],
    shade
  );
  shape(
    g,
    [
      [248, 281],
      [272, 267, 288, 276],
      [317, 286],
      [344, 268, 359, 273],
      [393, 287, 413, 331],
      [441, 377],
      [196, 382],
      [201, 327, 228, 298],
    ],
    '#655785'
  );
  shape(
    g,
    [
      [246, 283],
      [265, 264],
      [305, 289],
      [338, 272],
      [361, 280],
      [330, 321],
      [307, 339],
      [278, 312],
    ],
    '#a293ad'
  );
  shape(
    g,
    [
      [273, 267],
      [278, 247],
      [324, 246],
      [330, 274],
      [312, 302],
      [298, 310],
      [285, 290],
    ],
    '#dc947b'
  );
  shape(
    g,
    [
      [287, 275],
      [277, 266],
      [278, 250],
      [321, 247],
      [327, 268],
      [307, 283],
    ],
    '#f0ac89',
    null
  );
  shape(
    g,
    [
      [228, 173],
      [230, 121, 286, 111],
      [345, 93, 378, 153],
      [378, 211, 349, 246],
      [327, 272, 306, 275],
      [283, 272, 261, 253],
      [226, 231, 228, 173],
    ],
    '#ffcfaa'
  );
  shape(
    g,
    [
      [232, 181],
      [246, 179, 250, 198],
      [254, 231, 275, 249],
      [259, 245, 247, 236],
      [230, 220],
    ],
    '#eca992',
    null
  );
  shape(
    g,
    [
      [328, 117],
      [374, 118, 381, 171],
      [374, 196, 367, 209],
      [355, 180, 346, 162],
      [351, 178, 347, 183],
      [328, 160, 324, 147],
      [320, 168, 305, 174],
      [310, 151, 303, 144],
      [288, 172, 265, 186],
      [267, 169, 267, 161],
      [249, 187, 238, 205],
      [230, 219, 227, 239],
      [213, 225, 218, 190],
      [200, 131, 250, 108],
      [280, 79, 321, 95],
      [345, 83, 366, 104],
    ],
    lit
  );
  shape(
    g,
    [
      [233, 194],
      [223, 225, 238, 248],
      [225, 270, 239, 292],
      [216, 281, 212, 259],
      [197, 274, 200, 289],
      [186, 260, 202, 237],
      [208, 212],
    ],
    lit
  );
  shape(
    g,
    [
      [359, 174],
      [392, 180, 382, 223],
      [391, 242, 382, 260],
      [378, 285, 398, 292],
      [378, 304, 359, 286],
      [349, 273, 356, 247],
      [367, 230, 362, 215],
    ],
    lit
  );
  for (const [x, y, x2, y2] of [
    [218, 170, 244, 129],
    [245, 147, 270, 118],
    [274, 135, 299, 108],
    [335, 112, 358, 132],
    [219, 246, 224, 265],
    [372, 230, 369, 252],
  ])
    line(g, x, y, x2, y2, pale, 3);
  // Amber irises, two lash levels and uneven brows keep each reaction readable at small scale.
  const blink = t % 4.7 > 4.54;
  for (const [x, y, dir] of [
    [271, 199, -1],
    [331, 192, 1],
  ]) {
    const d = mood === 'miss' ? 4 : 0;
    if (blink) line(g, x - 10, y + 2, x + 11, y, ink, 3);
    else {
      shape(
        g,
        [
          [x - 12, y + 1],
          [x - 5, y - 10, x + 8, y - 7],
          [x + 14, y - 3],
          [x + 9, y + 7, x - 3, y + 7],
        ],
        '#fff1d0',
        ink,
        2
      );
      oval(g, x + 2, y - 0.2, 6.4, 7.1, '#b16b2c');
      oval(g, x + 3, y - 1, 3.1, 5.4, '#583d3d');
      oval(g, x + 4.8, y - 4, 2.3, 2, '#fff7d8');
      line(g, x - 11, y, x + 11, y - 5, ink, 1.7);
    }
    line(g, x - 9, y - 15 + d * dir, x + 10, y - 17 - d * dir, '#8f5c43', 2.8);
  }
  line(g, 306, 202, 302, 215, '#c4806d', 2);
  line(g, 302, 215, 308, 215, '#c4806d', 2);
  oval(g, 260, 216, 8, 2.4, '#efa68b');
  oval(g, 344, 210, 7, 2.1, '#efa68b');
  if (mood === 'proof' || mood === 'sealed')
    shape(
      g,
      [
        [292, 231],
        [304, 235, 318, 225],
        [311, 244, 300, 239],
      ],
      '#a55d5f',
      ink,
      1.5
    );
  else {
    g.beginPath();
    g.moveTo(295, 232);
    g.quadraticCurveTo(305, 234 + Math.sin(t * 3) * 1.8, 315, 226);
    g.lineWidth = 2.5;
    g.strokeStyle = '#985f5b';
    g.stroke();
  }
  // Cushioned monitoring headset, mounting screws and cable.
  g.beginPath();
  g.moveTo(215, 204);
  g.bezierCurveTo(192, 66, 366, 42, 386, 189);
  g.lineWidth = 14;
  g.strokeStyle = ink;
  g.stroke();
  g.lineWidth = 8;
  g.strokeStyle = '#9f8bb0';
  g.stroke();
  for (const [x, y] of [
    [216, 196],
    [378, 187],
  ]) {
    oval(g, x, y, 15, 29, ink);
    oval(g, x - 2, y - 2, 11, 23, '#655682');
    oval(g, x - 3, y - 3, 7, 16, '#aa91b4');
    line(g, x - 7, y - 8, x + 2, y - 10, '#e0bbbc', 2);
    oval(g, x + 2, y + 10, 2, 2, '#e3ba81');
  }
  g.beginPath();
  g.moveTo(378, 210);
  g.bezierCurveTo(383, 268, 411, 286, 399, 352);
  g.strokeStyle = ink;
  g.lineWidth = 4;
  g.stroke();
  // AGI-1’s pass on the lapel.
  shape(
    g,
    [
      [339, 302],
      [369, 296],
      [372, 314],
      [342, 320],
    ],
    '#f5d8aa',
    ink,
    1.2
  );
  type(g, 'AGI-1', 344, 311, 7, ink);
  g.restore();
}
function desk(g, t, lights, proof) {
  shape(
    g,
    [
      [-20, 342],
      [160, 325],
      [385, 349],
      [475, 327],
      [660, 321],
      [660, 488],
      [-20, 488],
    ],
    '#704757'
  );
  shape(
    g,
    [
      [37, 351],
      [184, 338],
      [354, 358],
      [305, 414],
      [5, 411],
    ],
    '#3e3046'
  );
  shape(
    g,
    [
      [50, 354],
      [170, 346],
      [173, 373],
      [34, 380],
    ],
    '#be9c81'
  );
  for (let i = 0; i < 2; i++) {
    const x = 80 + i * 56;
    oval(g, x, 361, 20, 6, '#493944');
    oval(g, x, 361, 11, 3, '#cfb292');
    for (let j = 0; j < 3; j++) {
      const a = t * 1.65 + j * 2.095;
      oval(g, x + 11 * Math.cos(a), 361 + 3 * Math.sin(a), 2.8, 1, '#483845');
    }
  }
  for (let i = 0; i < 6; i++) {
    const x = 195 + i * 21;
    line(g, x, 355, x - 12, 385, '#252032', 3);
    box(g, x - 10, 362 + (i % 3) * 4, 13, 5, i % 2 ? '#e4b283' : '#bd8f8c', 1);
  }
  for (let i = 0; i < 4; i++) {
    const x = 43 + i * 20;
    oval(g, x, 395, 7, 4, i < lights ? '#efc777' : '#5c4650');
    if (i < lights) oval(g, x - 1, 394, 3, 1.7, '#fff1be');
  }
  box(g, 381, 353, 106, 51, '#382b40', 5, ink);
  box(g, 388, 358, 92, 31, '#d6ac7a', 3);
  for (let i = 0; i < 10; i++) line(g, 396 + 8 * i, 365, 395 + 8 * i, 369, '#734d53', 1);
  line(g, 430, 386, 437 + 14 * Math.sin(t * 3.1), 365, '#9e494d', 2);
  oval(g, 430, 386, 3, 3, ink);
  type(g, 'VU / AIR', 403, 399, 7, '#dbc398');
  shape(
    g,
    [
      [497, 360],
      [577, 347],
      [623, 361],
      [547, 378],
    ],
    proof ? '#f7e4b6' : '#d3ae8b'
  );
  for (let j = 0; j < 3; j++) line(g, 518 + j * 4, 360 + j * 3, 557 + j * 9, 354 + j * 3, '#966e69', 1.4);
  bg(g, 0, 416, 640, 86, '#382b3d', '#231c30');
  box(g, 0, 418, 640, 3, '#ac7c73');
}
function hands(g, t, onAir) {
  const d = Math.sin(t * 2) * 1.4;
  g.save();
  g.translate(0, d);
  shape(
    g,
    [
      [218, 314],
      [200, 325, 188, 346],
      [213, 349],
      [236, 333],
    ],
    '#837199'
  );
  shape(
    g,
    [
      [194, 341],
      [211, 342],
      [217, 350, 232, 350],
      [248, 349, 250, 352],
      [251, 355, 239, 356],
      [246, 357, 242, 360],
      [233, 363, 213, 358],
      [198, 356, 190, 350],
    ],
    '#f8c5a0',
    ink,
    2
  );
  line(g, 233, 357, 242, 356, '#c18b78', 1);
  g.restore();
  if (onAir) {
    g.save();
    g.translate(0, -d);
    shape(
      g,
      [
        [373, 298],
        [391, 290, 399, 301],
        [411, 314],
        [401, 326],
        [379, 314],
      ],
      '#857198'
    );
    shape(
      g,
      [
        [398, 304],
        [404, 295],
        [405, 286, 408, 286],
        [413, 287, 410, 302],
        [422, 294, 425, 298],
        [421, 307, 416, 312],
        [410, 318, 404, 315],
      ],
      '#fdc7a1',
      ink,
      2
    );
    g.restore();
  }
}
function microphone(g, t) {
  // Suspended condenser and jointed scissor arm pass in front of the host.
  for (const [x, y, a, b] of [
    [17, 74, 113, 111],
    [113, 111, 164, 191],
    [17, 85, 109, 122],
    [109, 122, 155, 198],
  ])
    line(g, x, y, a, b, ink, 5);
  for (const [x, y] of [
    [18, 79],
    [112, 116],
    [158, 196],
  ]) {
    oval(g, x, y, 8, 7, '#735b75', ink, 2);
    oval(g, x, y, 2, 2, '#ddba96');
  }
  g.save();
  g.translate(162, 213);
  g.rotate(-0.2);
  box(g, -12, -27, 24, 61, '#664f66', 11, ink);
  box(g, -11, -24, 22, 36, '#ccb7a7', 9, ink);
  for (let i = 0; i < 9; i++) line(g, -8, -19 + i * 3, 8, -19 + i * 3, '#736172', 1.2);
  for (let i = 0; i < 4; i++) line(g, -6 + i * 4, -23, -6 + i * 4, 7, '#8e7a81', 0.8);
  box(g, -5, 32, 10, 12, '#463848', 2);
  g.restore();
  oval(g, 183, 225, 10, 22, '#392f48', ink);
  line(g, 182, 247, 161, 265, ink, 3);
}
function exhibitInset(g, item, reverse, t, proof) {
  g.save();
  g.translate(440, 154);
  g.rotate(-0.045);
  box(g, 0, 0, 112, 100, '#292636', 5, '#dcad8b');
  box(g, 5, 5, 102, 70, reverse ? '#e6ce9b' : '#e5bea5', 1);
  const dark = '#514259',
    gold = '#c98c4e',
    blue = '#6a8590',
    blush = '#c47b78';
  if (item.kind === 'bell') {
    shape(
      g,
      [
        [25, 50],
        [35, 46, 37, 30],
        [45, 14, 53, 27],
        [56, 44, 62, 46],
        [58, 52],
      ],
      gold,
      dark
    );
    box(g, 70, 19, 5, 31, dark, 2);
    oval(g, 73, 52, 6, 7, gold, dark);
  } else if (item.kind === 'cat') {
    box(g, 12, 12, 39, 53, '#d79d54', 2);
    box(g, 57, 12, 40, 53, '#8bafc2', 2);
    for (const x of reverse ? [21, 35] : [21, 73]) {
      oval(g, x + 5, 41, 5, 4, dark);
      for (let k = 0; k < 3; k++) oval(g, x + k * 4, 35 - Math.sin(k * 1.57) * 2, 2, 2, dark);
    }
  } else if (item.kind === 'fader' || item.kind === 'roster') {
    for (let i = 0; i < 5; i++) {
      const x = 19 + i * 16;
      line(g, x, 18, x, 59, dark, 2);
      box(g, x - 5, 23 + ((i * 7) % 26), 10, 7, i % 2 ? dark : blush, 2);
    }
  } else if (item.kind === 'boat' || item.kind === 'fold') {
    shape(
      g,
      [
        [15, 42],
        [35, 45],
        [52, 22],
        [73, 43],
        [95, 36],
        [78, 55],
        [30, 58],
      ],
      '#f3e8c5',
      dark
    );
    line(g, 35, 45, 70, 44, dark);
    line(g, 50, 25, 55, 43, dark);
  } else if (item.kind === 'tape') {
    box(g, 14, 18, 83, 43, dark, 5);
    box(g, 22, 24, 66, 21, '#cb9a80', 4);
    for (const x of [37, 72]) {
      oval(g, x, 34, 10, 10, '#463447');
      oval(g, x, 34, 5, 5, '#e8cf9a');
      const a = t * 2;
      line(g, x, 34, x + 4 * Math.cos(a), 34 + 4 * Math.sin(a), '#6c4a57', 1);
    }
    shape(
      g,
      [
        [32, 56],
        [36, 48],
        [77, 48],
        [81, 56],
      ],
      '#aa7970',
      null
    );
  } else if (item.kind === 'cup') {
    shape(
      g,
      [
        [33, 25],
        [76, 24],
        [70, 60],
        [40, 61],
      ],
      '#f5e4bd',
      dark
    );
    box(g, 29, 20, 51, 8, blush, 3, dark);
    box(g, 37, 37, 34, 12, gold, 1);
  } else if (item.kind === 'key') {
    oval(g, 40, 32, 12, 12, gold, dark);
    oval(g, 39, 30, 4, 4, '#e6caad');
    line(g, 49, 40, 75, 57, dark, 6);
    line(g, 67, 50, 73, 43, dark, 4);
  } else if (item.kind === 'clock') {
    oval(g, 55, 39, 24, 24, '#efdcaf', dark, 3);
    line(g, 55, 39, 48, 25, dark, 3);
    line(g, 55, 39, 69, 44, dark, 3);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      oval(g, 55 + 19 * Math.cos(a), 39 + 19 * Math.sin(a), 1.3, 1.3, dark);
    }
  } else if (item.kind === 'glass' || item.kind === 'photo') {
    box(g, 22, 14, 69, 48, '#fbdfb9', 2, dark);
    box(g, 27, 19, 59, 34, blue);
    shape(
      g,
      [
        [29, 49],
        [46, 33],
        [61, 40],
        [73, 25],
        [85, 52],
      ],
      '#465b68',
      null
    );
    line(g, 40, 23, 29, 41, '#e5d4af', 2);
  } else if (item.kind === 'flower') {
    for (const x of [32, 54, 75]) {
      line(g, x, 35, x - 4, 59, '#4e775f', 3);
      for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 0.4;
        oval(g, x + 5 * Math.cos(a), 32 + 5 * Math.sin(a), 4.5, 4.5, blush);
      }
      oval(g, x, 32, 3, 3, gold);
    }
  } else if (item.kind === 'mic') {
    box(g, 44, 15, 22, 35, blue, 9, dark);
    for (let i = 0; i < 6; i++) line(g, 47, 22 + i * 4, 63, 22 + i * 4, dark, 1);
    line(g, 55, 50, 55, 62, dark, 3);
    line(g, 43, 62, 68, 62, dark, 3);
  } else {
    shape(
      g,
      [
        [20, 25],
        [82, 15],
        [94, 52],
        [29, 63],
      ],
      '#f4ddb3',
      dark
    );
    for (let i = 0; i < 4; i++) line(g, 30 + i, 33 + i * 5, 74 + i, 25 + i * 5, '#956f67', 1.5);
  }
  type(g, proof ? 'MATCH FILED' : reverse ? 'REVERSE / B' : 'EXHIBIT / A', 9, 91, 11, '#ffe6ad');
  g.restore();
}
export function paintBooth(g, w, h, c, s, t, reduced, demo) {
  const narrow = w < 610 || w / h < 0.96;
  const area = narrow ? { x: 0, y: 0, w, h: h * (demo ? 0.39 : 0.32) } : { x: 0, y: 0, w: w * 0.45, h };
  bg(g, 0, 0, w, h, '#3e303f', '#31283a');
  g.save();
  g.beginPath();
  g.rect(0, 0, area.w, area.h);
  g.clip();
  const v = narrow ? { x: 54, y: 81, w: 514, h: 295 } : { x: 8, y: 0, w: 622, h: 466 };
  const scale = Math.min(area.w / v.w, area.h / v.h);
  const dx = (area.w - v.w * scale) / 2 - v.x * scale,
    dy = (area.h - v.h * scale) / 2 - v.y * scale;
  bg(g, 0, 0, area.w, area.h, skies[c.night][0], '#281e32');
  g.translate(dx, dy);
  g.scale(scale, scale);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const tick = reduced ? 0 : t;
  city(g, c.night, tick);
  hair(g, tick, s.event);
  microphone(g, tick);
  desk(g, tick, s.lights, s.phase === 'amended');
  hands(g, tick, s.phase === 'amended' || s.event === 'press');
  const item = c.evidence.find((e) => e.id === s.item);
  if (item) exhibitInset(g, item, s.flipped.includes(item.id), tick, s.phase === 'amended');
  box(g, 30, 45, 119, 30, '#281e32', 6, '#c8a792');
  box(g, 35, 50, 109, 20, '#ad515c', 3);
  type(g, '• ON AIR', 44, 65, 15, '#ffe8af');
  if (narrow) {
    box(g, 62, 88, 78, 18, '#3a283d', 3);
    type(g, '● 87.9 FM', 68, 101, 11, '#ffe0a3');
  } else {
    type(g, 'FREQUENCY  87.9 FM', 29, 450, 12, '#f3c996');
    type(g, 'LANTERN DISTRICT', 382, 450, 12, '#d4b5be');
  }
  g.restore();
  if (!narrow && area.h > area.w * 0.95) {
    const pad = Math.max(15, area.w * 0.065),
      z = Math.max(13, Math.min(22, area.w * 0.032));
    type(g, 'LANTERN COMMUNITY RADIO', pad, area.h * 0.1, z, '#ead0af');
    line(g, pad, area.h * 0.115, Math.min(area.w - pad, pad + 210), area.h * 0.115, '#b4817a', 1);
  }
}
