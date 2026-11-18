import { line, oval, polygon, panel, gradient, type, mix } from '../kit/illustration.js';
import { acts, cueGlyph, lighting, playCue } from './productions.js';
import { blocking } from './blocking-map.js';
const ink = '#23182e',
  paper = '#fff2d4',
  sans = '"AK Sans",sans-serif',
  display = '"AK Display",sans-serif',
  mono = '"AK Mono",monospace';
function word(c, s, x, y, size, color = paper, align = 'center', font = sans) {
  type(c, s, x, y, size, color, align, font);
}
function performer(c, x, y, size, a, cat, time, step, bow, act) {
  c.save();
  c.translate(x, y);
  c.scale(size / 80, size / 80);
  const accent = acts[act].color,
    bob = Math.sin(time * 3) * 1.3;
  oval(c, 0, 0, cat ? 17 : 20, 4, '#28203677');
  if (cat) {
    c.translate(0, bob);
    line(
      c,
      [
        [8, -8],
        [20, -11],
        [24, -22],
        [20, -26],
      ],
      '#421f36',
      5
    );
    oval(c, -1, -12, 14, 10, '#5d3b57', ink, 2);
    oval(c, -7, -22, 12, 10, '#7f5e73', ink, 2);
    polygon(
      c,
      [
        [-18, -23],
        [-18, -36],
        [-9, -29],
      ],
      '#94768c',
      ink,
      2
    );
    polygon(
      c,
      [
        [-6, -29],
        [2, -38],
        [4, -24],
      ],
      '#94768c',
      ink,
      2
    );
    oval(c, -12, -22, 2, 2.4, '#ffe58a');
    oval(c, -4, -22, 1.8, 2.2, '#ffe58a');
    line(
      c,
      [
        [-11, -12],
        [-6, -9],
        [0, -12],
      ],
      '#ffd770',
      3
    );
    line(
      c,
      [
        [-9, -6],
        [-13, -1],
        [-16, -1],
      ],
      ink,
      3
    );
    line(
      c,
      [
        [2, -8],
        [6, a.pose === 'paw' ? -17 : -1],
        [9, a.pose === 'paw' ? -15 : -1],
      ],
      ink,
      3
    );
  } else {
    c.translate(0, bob);
    const swing = a.pose === 'step' ? Math.sin(step * Math.PI) * 7 : 0;
    line(
      c,
      [
        [-5, -19],
        [-6 - swing, -8],
        [-9 - swing, -2],
        [-14 - swing, -2],
      ],
      ink,
      4
    );
    line(
      c,
      [
        [5, -19],
        [6 + swing, -9],
        [9 + swing, -2],
        [13 + swing, -2],
      ],
      ink,
      4
    );
    c.rotate(bow * 0.48);
    // Silver twin tails, black headset and warm magenta eyes are her stage silhouette.
    polygon(
      c,
      [
        [-10, -52],
        [-19, -56],
        [-20, -42],
        [-31, -23],
        [-17, -26],
        [-10, -40],
      ],
      '#d7e9ff',
      ink,
      2
    );
    polygon(
      c,
      [
        [8, -52],
        [19, -54],
        [20, -39],
        [27, -26],
        [17, -29],
        [9, -43],
      ],
      '#d7e9ff',
      ink,
      2
    );
    polygon(
      c,
      [
        [-9, -40],
        [8, -40],
        [13, -20],
        [-14, -20],
      ],
      '#282e4d',
      ink,
      2
    );
    polygon(
      c,
      [
        [-6, -38],
        [0, -31],
        [7, -38],
        [4, -24],
        [-6, -24],
      ],
      accent,
      ink,
      1.6
    );
    line(
      c,
      [
        [-9, -35],
        [-17, -26],
        [-23, bow ? -31 : -24],
      ],
      '#f6c9ad',
      4
    );
    line(
      c,
      [
        [9, -35],
        [18, bow ? -28 : -38],
        [22, bow ? -32 : -43],
      ],
      '#f6c9ad',
      4
    );
    oval(c, 0, -48, 12, 12, '#ffe1be', ink, 2);
    polygon(
      c,
      [
        [-13, -48],
        [-11, -57],
        [-3, -63],
        [9, -61],
        [14, -54],
        [11, -47],
        [5, -54],
        [2, -48],
        [-2, -53],
        [-10, -46],
      ],
      '#e4f0ff',
      ink,
      1.8
    );
    const look = [0, 2, 0, -2][a.dir];
    for (const dx of [-5, 4]) {
      if (bow > 0.3)
        line(
          c,
          [
            [dx - 2, -47],
            [dx, -46],
            [dx + 2, -47],
          ],
          ink,
          1.4
        );
      else oval(c, dx + look, -47, 1.8, 2.5, '#952768');
    }
    line(
      c,
      [
        [-12, -51],
        [-12, -46],
      ],
      '#1f203c',
      3
    );
    line(
      c,
      [
        [6, -43],
        [11, -44],
        [13, -48],
      ],
      ink,
      1.4
    );
    polygon(
      c,
      [
        [1, -37],
        [4, -34],
        [1, -30],
        [-2, -34],
      ],
      '#ffe68e'
    );
  }
  c.restore();
}
export function theatreLayout(w, h, scene) {
  const tiny = h < 300,
    header = tiny ? 32 : Math.min(83, Math.max(44, h * 0.14));
  const score = Math.max(tiny ? 46 : 68, Math.min(h * 0.25, 125)),
    floorTop = header + Math.max(18, (h - header - score) * 0.12);
  const board = blocking(scene);
  const cols = Math.max(5, board.maxX - board.minX + 3),
    rows = Math.max(3, board.maxY - board.minY + 3);
  const floorBottom = h - score - 12,
    usable = Math.max(35, floorBottom - floorTop),
    stepX = Math.min((w * 0.87) / cols, usable / (rows * 0.63), 94),
    stepY = stepX * 0.59;
  const cx = (board.minX + board.maxX) / 2,
    cy = (board.minY + board.maxY) / 2;
  const project = (x, y) => [w / 2 + (x - cx) * stepX, floorTop + usable * 0.57 + (y - cy) * stepY];
  return { header, score, project, stepX, stepY, floorBottom, tiny, board };
}
function stageFloor(c, w, h, v, l) {
  const { scene, plot, beat, time, success } = v,
    { stepX: s, stepY: t, project, board, floorBottom } = l;
  const theme = acts[scene.act],
    curtain = theme.ink;
  gradient(c, 0, 0, w, h, ['#211634', curtain, '#1b1227']);
  const glow = c.createRadialGradient(w * 0.52, h * 0.45, 1, w * 0.52, h * 0.45, w * 0.62);
  glow.addColorStop(0, theme.color + '78');
  glow.addColorStop(1, '#10132300');
  c.fillStyle = glow;
  c.fillRect(0, 0, w, h);
  scenery(c, w, l.header, floorBottom, scene.act, theme, time);
  for (let i = 0; i < 15; i++) {
    const x = (w * (i + 0.2)) / 15,
      y = l.header + Math.cos(i * 7) * 6,
      drift = Math.sin(time * 0.5 + i) * 0.025 * w;
    if (i % 3 === 0)
      polygon(
        c,
        [
          [x, y],
          [x + w * 0.12 + drift, floorBottom],
          [x - w * 0.1 + drift, floorBottom],
        ],
        i % 2 ? '#ffe6a01a' : '#c7b9ff18'
      );
    oval(c, x, y, 3, 2, '#ffe8a5');
  }
  // Paper theatre wings, gilded rope and the prompt booth.
  for (const side of [0, 1]) {
    c.save();
    if (side) {
      c.translate(w, 0);
      c.scale(-1, 1);
    }
    const end = w * 0.12;
    polygon(
      c,
      [
        [0, l.header],
        [end, l.header],
        [end * 0.72, l.header + h * 0.11],
        [end * 0.38, h * 0.47],
        [end * 0.57, floorBottom],
        [0, floorBottom],
      ],
      curtain,
      ink,
      2
    );
    for (let j = 1; j < 5; j++)
      line(
        c,
        [
          [(end * j) / 5, l.header],
          [(end * j) / 8, h * 0.42],
          [(end * j) / 12, floorBottom],
        ],
        theme.color + '55',
        2
      );
    line(
      c,
      [
        [0, h * 0.43],
        [end * 0.4, h * 0.46],
      ],
      '#e9ba68',
      3
    );
    line(
      c,
      [
        [end * 0.33, h * 0.46],
        [end * 0.46, h * 0.5],
        [end * 0.46, h * 0.55],
      ],
      '#efc476',
      2
    );
    oval(c, end * 0.46, h * 0.55, 2.5, 4, '#f4cb79');
    c.restore();
  }
  const tiles = new Set(board.cells.map((p) => p.join()));
  for (let y = board.minY - 1; y <= board.maxY + 1; y++)
    for (let x = board.minX - 1; x <= board.maxX + 1; x++) {
      const [cx, cy] = project(x, y),
        on = tiles.has([x, y].join());
      panel(
        c,
        cx - s * 0.49,
        cy - t * 0.47,
        s * 0.98,
        t * 0.92,
        on ? '#dcb285' : '#986a6977',
        Math.max(2, s * 0.08)
      );
      line(
        c,
        [
          [cx - s * 0.35, cy + t * 0.29],
          [cx + s * 0.3, cy + t * 0.29],
        ],
        on ? '#9a6a68' : '#805e64',
        1
      );
      if (on)
        line(
          c,
          [
            [cx - s * 0.09, cy - t * 0.09],
            [cx + s * 0.09, cy + t * 0.09],
          ],
          '#f2d5a4',
          1.5
        );
    }
  const desired = board.traces[plot][Math.min(scene.beats.length, beat + 1)],
    mark = desired.actors[desired.active],
    [mx, my] = project(mark.x, mark.y);
  const sun = lighting(scene, Math.min(beat, scene.beats.length - 1), plot),
    spot = sun ? '#ffe48e' : '#abddff';
  polygon(
    c,
    [
      [mx - s * 0.73, l.header],
      [mx - s * 0.35, l.header],
      [mx + s * 0.52, my],
      [mx - s * 0.49, my],
    ],
    sun ? '#fff0a434' : '#9eccff3e'
  );
  oval(c, mx, my, s * 0.46, t * 0.44, spot + '7d', spot, 2);
  line(
    c,
    [
      [mx - 4, my],
      [mx + 4, my],
    ],
    ink,
    1.5
  );
  line(
    c,
    [
      [mx, my - 3],
      [mx, my + 3],
    ],
    ink,
    1.5
  );
  for (const [index, a] of v.cast.actors.slice(0, board.hasCat ? 2 : 1).entries()) {
    const prev = v.previous.actors[index],
      p = v.reduced ? 1 : Math.min(1, v.phase);
    const [ax, ay] = project(mix(prev.x, a.x, p), mix(prev.y, a.y, p));
    performer(
      c,
      ax,
      ay,
      Math.min(160, Math.max(37, s * 1.15)),
      a,
      index === 1,
      time,
      p,
      success || a.pose === 'bow' ? 0.7 : 0,
      scene.act
    );
    if (index === v.cast.active && board.hasCat) oval(c, ax, ay + 5, 4, 2, '#ffea92');
  }
  const edge = floorBottom + 5;
  panel(c, 0, edge, w, Math.max(2, h - edge), '#312135', 0);
  for (let i = 0; i < Math.max(12, Math.floor(w / 27)); i++) {
    const x = i * 27 + 7,
      up = success ? 2 + Math.sin(time * 6 + i) * 3 : 0;
    oval(c, x, edge + 5 - up, 6, 6, '#171326');
    oval(c, x, edge + 13 - up, 10, 8, '#171326');
    if (success && i % 3 === 0)
      line(
        c,
        [
          [x - 5, edge + 8],
          [x - 10, edge - 5 - up],
        ],
        '#171326',
        3
      );
  }
}

function scenery(c, w, top, bottom, act, theme, time) {
  const h = bottom - top,
    base = top + h * 0.69;
  c.save();
  c.beginPath();
  c.rect(0, top, w, h);
  c.clip();
  const wash = theme.color + '37',
    gold = '#ebbd744f',
    shade = '#20192e71';
  // The scenery is built in layers of die-cut flats. All five companies have
  // their own fly system and their own silhouette behind the moving dancers.
  if (act === 0) {
    for (let i = 0; i < 7; i++) {
      const x = (w * (i + 0.5)) / 7,
        ww = w * 0.1,
        lo = top + h * (0.26 + (i % 3) * 0.055);
      c.beginPath();
      c.moveTo(x - ww * 0.45, base);
      c.lineTo(x - ww * 0.45, lo + ww * 0.35);
      c.quadraticCurveTo(x, lo - ww * 0.4, x + ww * 0.45, lo + ww * 0.35);
      c.lineTo(x + ww * 0.45, base);
      c.closePath();
      c.fillStyle = shade;
      c.fill();
      line(
        c,
        [
          [x - ww * 0.28, base],
          [x - ww * 0.28, lo + ww * 0.45],
          [x, lo + ww * 0.15],
          [x + ww * 0.28, lo + ww * 0.45],
          [x + ww * 0.28, base],
        ],
        gold,
        1.6
      );
      line(
        c,
        [
          [x, lo + ww * 0.24],
          [x, base],
        ],
        gold,
        1
      );
      line(
        c,
        [
          [x - ww * 0.3, lo + ww * 0.69],
          [x + ww * 0.3, lo + ww * 0.69],
        ],
        gold,
        1
      );
    }
  } else if (act === 1) {
    const cx = w * 0.49,
      cy = top + h * 0.35,
      rad = Math.min(w * 0.22, h * 0.28);
    c.strokeStyle = gold;
    c.lineWidth = 3;
    c.beginPath();
    c.arc(cx, cy, rad, 0, Math.PI * 2);
    c.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6 + time * 0.025,
        x = cx + Math.cos(a) * rad,
        y = cy + Math.sin(a) * rad;
      line(
        c,
        [
          [cx, cy],
          [x, y],
        ],
        gold,
        1
      );
      line(
        c,
        [
          [x, y],
          [x, y + rad * 0.13],
        ],
        gold,
        1
      );
      polygon(
        c,
        [
          [x - rad * 0.08, y + rad * 0.13],
          [x + rad * 0.08, y + rad * 0.13],
          [x + rad * 0.05, y + rad * 0.21],
          [x - rad * 0.05, y + rad * 0.21],
        ],
        wash
      );
    }
    line(
      c,
      [
        [cx - rad * 0.42, base],
        [cx, cy],
        [cx + rad * 0.42, base],
      ],
      gold,
      3
    );
  } else if (act === 2) {
    oval(c, w * 0.71, top + h * 0.21, Math.min(38, h * 0.12), Math.min(38, h * 0.12), '#ffe5ae8c');
    for (let i = 0; i < 18; i++) {
      const bw = w * 0.067,
        x = i * w * 0.059,
        hh = h * (0.12 + ((i * 19) % 13) / 53);
      polygon(
        c,
        [
          [x, base],
          [x, base - hh],
          [x + bw * 0.5, base - hh - bw * 0.4],
          [x + bw, base - hh],
          [x + bw, base],
        ],
        shade
      );
      for (let j = 0; j < 3; j++)
        panel(
          c,
          x + bw * (0.15 + j * 0.23),
          base - hh * 0.75,
          Math.max(1, bw * 0.09),
          Math.max(2, hh * 0.14),
          gold,
          1
        );
    }
  } else if (act === 3) {
    for (let i = 0; i < 5; i++) {
      const x = ((i + 0.5) * w) / 5,
        cy = top + h * (0.3 + (i % 2) * 0.09),
        rr = Math.min(w * 0.065, h * 0.12);
      line(
        c,
        [
          [x, top],
          [x, cy - rr],
        ],
        gold,
        1.5
      );
      c.beginPath();
      c.arc(x, cy, rr, 0, Math.PI * 2);
      c.strokeStyle = gold;
      c.lineWidth = 2;
      c.stroke();
      for (let j = 0; j < 6; j++) {
        const a = (j / 6) * Math.PI * 2 + (i % 2 ? time * 0.1 : -time * 0.1);
        polygon(
          c,
          [
            [x, cy],
            [x + rr * Math.cos(a), cy + rr * Math.sin(a)],
            [x + rr * 0.94 * Math.cos(a + 0.59), cy + rr * 0.94 * Math.sin(a + 0.59)],
          ],
          j % 2 ? wash : shade
        );
      }
    }
  } else {
    const moonX = w * 0.66,
      moonY = top + h * 0.26,
      r = Math.min(w * 0.085, h * 0.16);
    oval(c, moonX, moonY, r, r, '#f9ebc29e');
    oval(c, moonX + r * 0.39, moonY - r * 0.19, r * 0.8, r * 0.8, theme.ink);
    for (let i = 0; i < 17; i++) {
      const x = w * (((i * 19) % 47) / 47),
        y = top + h * (0.14 + ((i * 7) % 17) / 44),
        rr = i % 4 === 0 ? 4 : 2;
      polygon(
        c,
        [
          [x, y - rr],
          [x + rr * 0.45, y - rr * 0.2],
          [x + rr, y],
          [x + rr * 0.3, y + rr * 0.3],
          [x, y + rr],
          [x - rr * 0.4, y + rr * 0.2],
          [x - rr, y],
        ],
        '#fce4b79c'
      );
    }
    for (let i = 0; i < 13; i++) {
      const x = (i * w) / 12,
        bw = w * 0.085;
      polygon(
        c,
        [
          [x - bw, base],
          [x, base - h * (0.1 + (i % 3) * 0.04)],
          [x + bw, base],
        ],
        shade
      );
    }
  }
  // The fly rail and the scalloped velvet pelmet stay above the music stand.
  line(
    c,
    [
      [0, top + 3],
      [w, top + 3],
    ],
    '#181425',
    4
  );
  for (let i = 0; i < 8; i++) {
    const left = (i * w) / 8,
      right = ((i + 1) * w) / 8,
      mid = (left + right) / 2;
    c.beginPath();
    c.moveTo(left, top);
    c.lineTo(right, top);
    c.quadraticCurveTo(mid, top + h * 0.073, left, top);
    c.fillStyle = theme.ink;
    c.fill();
    c.strokeStyle = '#eac28e';
    c.lineWidth = 1;
    c.stroke();
    oval(c, right, top + 2, 2, 3, '#e9c474');
  }
  c.restore();
}
export function draw(c, w, h, v) {
  const l = theatreLayout(w, h, v.scene),
    act = acts[v.scene.act];
  stageFloor(c, w, h, v, l);
  const titleSize = l.tiny ? 17 : Math.min(32, Math.max(19, w * 0.036));
  panel(c, 0, 0, w, l.header, '#23172c', 0);
  word(
    c,
    act.name.toUpperCase() + '  /  ' + String(v.scene.id).padStart(2, '0'),
    14,
    l.header * 0.29,
    12,
    act.color,
    'left',
    mono
  );
  word(c, v.scene.name, 14, l.header * 0.72, titleSize, paper, 'left', display);
  const lamp = v.scene.plots > 1 ? ' · ' + (lighting(v.scene, v.beat, v.plot) ? 'SUN' : 'MOON') : '';
  if (w > 420)
    word(
      c,
      'PLOT ' + (v.plot + 1) + '/' + v.scene.plots + lamp,
      w - 14,
      l.header * 0.45,
      12,
      act.color,
      'right',
      mono
    );
  const top = h - l.score + 4;
  panel(c, Math.max(3, w * 0.02), top, w - Math.max(6, w * 0.04), l.score - 8, '#f9e8c2', 9);
  const x = Math.max(13, w * 0.038),
    f = Math.max(12, Math.min(16, w * 0.027));
  word(
    c,
    v.success
      ? 'CURTAIN CALL!'
      : v.running
        ? 'ON STAGE  •  BEAT ' + (v.beat + 1)
        : 'BLOCKING  •  ' + (v.inspect + 1) + ' / ' + v.scene.beats.length,
    x,
    top + 13,
    f,
    ink,
    'left',
    mono
  );
  word(c, 'INK ' + v.ink + ' / PAR ' + v.par, w - x, top + 13, f, ink, 'right', mono);
  const n = Math.max(3, Math.floor((w - 2 * x) / Math.max(27, f * 2.1))),
    idx = v.running ? v.beat : v.inspect;
  const begin = Math.min(Math.max(0, idx - Math.floor(n / 2)), Math.max(0, v.scene.beats.length - n)),
    width = Math.min(57, (w - 2 * x) / Math.min(n, v.scene.beats.length));
  for (let j = begin; j < Math.min(v.scene.beats.length, begin + n); j++) {
    const left = x + (j - begin) * width,
      is = j === idx,
      code = v.scene.beats[j];
    panel(c, left, top + 24, width - 3, l.tiny ? 20 : 25, is ? act.ink : '#e3cb9c', 4);
    word(
      c,
      cueGlyph(code),
      left + (width - 3) / 2,
      top + (l.tiny ? 34 : 36),
      l.tiny ? 13 : 16,
      is ? paper : ink,
      'center',
      sans
    );
  }
  if (l.score > 75) {
    const cards = v.program[v.track],
      pos = v.cursor,
      from = Math.max(0, pos - 7);
    const leading = from ? '… ' : '',
      editor =
        cards.slice(from, pos).map(cueGlyph).join(' ') +
        ' ▏' +
        cards
          .slice(pos, pos + 6)
          .map(cueGlyph)
          .join(' ');
    word(
      c,
      (v.track === 'dance' ? 'DANCE A  ' : 'MAIN  ') + leading + editor,
      x,
      top + 63,
      Math.min(15, f),
      ink,
      'left',
      mono
    );
  }
}
export function drawPlaybill(c, w, h, scenes, index, book, badges) {
  const s = scenes[index],
    theme = acts[s.act],
    border = Math.max(10, Math.min(42, w * 0.06)),
    x = border + 15;
  gradient(c, 0, 0, w, h, [theme.ink, '#22192d']);
  panel(c, border, border, w - 2 * border, h - 2 * border, '#f9e8c8', 10);
  const first = border + Math.min(55, h * 0.14),
    base = first + Math.min(76, h * 0.17);
  word(c, 'THE DIRECTOR’S PLAYBILL', x, first, Math.max(15, Math.min(32, w * 0.048)), ink, 'left', display);
  word(c, 'ACT ' + (s.act + 1) + '   /   ' + theme.name.toUpperCase(), x, first + 23, 12, theme.ink, 'left', mono);
  const actScenes = scenes.filter((item) => item.act === s.act),
    spacing = Math.min(34, (h - base - border - 30) / actScenes.length);
  for (const [i, item] of actScenes.entries()) {
    const y = base + spacing * i,
      record = book.scenes[item.id],
      active = item.id === s.id;
    if (active) panel(c, x - 5, y - spacing * 0.43, w - 2 * x + 10, spacing * 0.88, theme.color, 5);
    word(
      c,
      String(item.id).padStart(2, '0') + '  ' + item.name,
      x,
      y,
      Math.max(12, Math.min(19, w * 0.033)),
      ink,
      'left'
    );
    word(
      c,
      record ? '★'.repeat(record.stars) + '☆'.repeat(3 - record.stars) : '—',
      w - x,
      y,
      13,
      theme.ink,
      'right'
    );
  }
  word(
    c,
    badges.includes(s.act) ? 'SELLOUT STICKER  ✦' : 'SELLOUTS   ' + badges.length + ' / 5',
    x,
    h - border - 13,
    12,
    theme.ink,
    'left',
    mono
  );
}
