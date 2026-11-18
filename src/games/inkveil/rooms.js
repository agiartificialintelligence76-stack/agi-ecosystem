import { dirs, xy, neighbor, walkable } from './geometry.js';
export const wings = [
  {
    name: 'Coat Check',
    ink: '#30314c',
    paint: '#c69268',
    light: '#fbda8c',
    label: 'Foyer brass',
    object: 'the violet ticket stub',
  },
  {
    name: 'Reading Room',
    ink: '#263c45',
    paint: '#7eaba0',
    light: '#b3e8cc',
    label: 'Quiet edition',
    object: 'the pressed fern',
  },
  {
    name: 'Security Desk',
    ink: '#323554',
    paint: '#8f9cb7',
    light: '#b6d9ff',
    label: 'Blue clearance',
    object: 'the handwritten card',
  },
  {
    name: 'Projection Booth',
    ink: '#41344b',
    paint: '#ab7892',
    light: '#ffc5d6',
    label: 'Last screening',
    object: 'the torn film frame',
  },
  {
    name: 'Conservation Lab',
    ink: '#24444b',
    paint: '#80b6b3',
    light: '#abf3e2',
    label: 'Glass master',
    object: 'the ribbon of blue glass',
  },
  {
    name: 'Night Archive',
    ink: '#3c3549',
    paint: '#b4a17b',
    light: '#ebd4a0',
    label: 'After hours',
    object: 'the diary’s last bookmark',
  },
];
// Each slash is one hand-painted floor row. A patrol script is its initial
// facing and a loop: uppercase moves; lowercase turns without leaving the tile.
// Every wing's sixth case has two separately recoverable pages.
const commissions = [
  [
    'The Coat Ticket',
    'Sa.../.#.D./...E.',
    'E:EW',
    'Throw a click into the open aisle, or follow the pillar around.',
    'a violet ticket with her name misspelled',
  ],
  [
    'Behind the Fern',
    '...a./S.#D./.m#../...E.',
    'E:we',
    'Wait behind the fern if the lantern swings toward you.',
    'a little fern drawn in green pencil',
  ],
  [
    'Her Other Hat',
    'S..#E/.#.D./a....',
    'S:EW',
    'The coat rack cuts a real shadow. Approach the diary across its back.',
    'the hat she insists was a disguise',
  ],
  [
    'The Bronze Bell',
    '...D./.#a#E/S.#../.....',
    'N:ns',
    'A click travels around a shelf through the open aisle.',
    'a brass bell sketched with seven sound rings',
  ],
  [
    'Two Invitations',
    'S..#../.#..a./..Dm#E/......',
    'W:EW',
    'A longer approach can leave the guard looking the wrong way.',
    'two invitations from the same imaginary guest',
  ],
  [
    'Cloakroom Twins',
    'S..D../.##.a./...#.E/.D....',
    'W:ew',
    'Collect both diary pages before opening the outside door.',
    'two scraps sewn into one coat lining',
  ],
  [
    'Soft Cover',
    'Scc../.#a.D/..t.E',
    'E:we',
    'Carpet absorbs your shoes and the edge of a tape’s sound.',
    'a page about the quietest blue carpet',
  ],
  [
    'A Hard Landing',
    'S.t.a/..#../ccD.E',
    'W:wwes',
    'A tile landing rings farther than an ordinary footstep.',
    'a tiny drawing of a tile that squeaks',
  ],
  [
    'Book Return',
    '..ca../S#t#D./...c.E',
    'N:ew',
    'Keep the book cart between her lamp and the return slot.',
    'her overdue apology in five kinds of ink',
  ],
  [
    'Between the Lines',
    'S..c../.t#..D/.a#c.E/......',
    'W:WE',
    'Listen for her shoes in the open aisle before crossing it.',
    'a note hidden between two identical titles',
  ],
  [
    'Blue Runner',
    'Scc.t./.##a../.D#.m./....E.',
    'E:ew',
    'The carpet can swallow a weak lure. Try dropping the keys.',
    'a pressed blue thread tied to a date',
  ],
  [
    'Reading Pair',
    'S.Dct./.#.a#./.cc#E./...D..',
    'N:ns',
    'Two readers left their notes on different sides of the carpet.',
    'a two-page argument over her favorite poem',
  ],
  [
    'The Polite Beep',
    'Sk+DE/.#a#./.....',
    'S:sw',
    'The cyan card opens the striped door for the rest of this case.',
    'a clearance badge with a doodled crown',
  ],
  [
    'Borrower Number',
    'S..+D./.#.#E./k.a...',
    'E:ew',
    'Pick up the reader card before entering the records desk.',
    'a number crossed out and replaced by her name',
  ],
  [
    'Desk Drawer',
    'S.k#../##.+D./a...#E/......',
    'E:EW',
    'The card slot opens both the walk and the sound path.',
    'her picture wearing a borrowed tie',
  ],
  [
    'Two Stamps',
    '...k../S#.#a./..+.D./.c..E.',
    'W:ew',
    'Decide which side of the counter should hear the tape.',
    'a blue stamp laid over the crooked first one',
  ],
  [
    'The Blue Folder',
    'Sk..#./.##+a./.cc.D./E.....',
    'S:ns',
    'A card is useful even when it opens a door only for sound.',
    'paper so blue that her pencil nearly disappeared',
  ],
  [
    'Accounts Closed',
    'S..k.D/.##+a./..D#../.c..E.',
    'N:we',
    'Two separate pages belong in the returned folder.',
    'the first and last letters of her secret signature',
  ],
  [
    'After the Reel',
    'SC..D/..#../.a.mE',
    'S:ew',
    'The projector’s ring shows its next turn. Wait under a dark hood.',
    'a frame of AGI-1 blinking at the wrong second',
  ],
  [
    'Blind Frame',
    'S...C./.##mD./.a...E',
    'E:we',
    'Use the black interval in the camera cycle to pass the cross aisle.',
    'the one unexposed frame on her reel',
  ],
  [
    'Projectionist',
    '..C.D./S.#.m./.a.k+E',
    'E:ew',
    'The lens can see through open doorways even when the guard turns.',
    'a caption reading please ignore my dramatic entrance',
  ],
  [
    'Splice Point',
    'S...D./.#C#../.a..mE/..t...',
    'S:EW',
    'Each splice of darkness lasts exactly one committed action.',
    'her thumbprint where the film changed color',
  ],
  [
    'Under the Hood',
    'S.m.C./.###../.a.k+D/....E.',
    'W:wn',
    'Crouch on the hood mark to disappear from a live camera.',
    'a sketch of a small tent under an enormous lens',
  ],
  [
    'Double Feature',
    'S..D.C/.c#..a/.D#m../....E.',
    'S:ws',
    'Both halves of the film program must leave the booth.',
    'two reels whose titles make a sentence',
  ],
  [
    'The Glass Sleeve',
    'S.|.D./..|.a./.....E',
    'S:we',
    'Glass lets a lantern see through. Sound must go around the opening.',
    'a pressed ribbon that looks like blue glass',
  ],
  [
    'Drying Room',
    'S..|D./.#.|../a.cc.E',
    'E:EW',
    'Place the tape on the guard’s side of the glass when possible.',
    'the corner she smudged while testing the varnish',
  ],
  [
    'The Conservator',
    'Sk+|../.#.|a./.cc.D./...E..',
    'S:ns',
    'The keycard opens a way around the soundproof cabinet.',
    'a restoration note asking them to keep the coffee ring',
  ],
  [
    'Prism Lamp',
    'S..C|./.c#.|D/.a...E',
    'E:ew',
    'Check what the camera can see through the display glass.',
    'a page of tiny color swatches with no names',
  ],
  [
    'False Echo',
    'S..|m./.##|D./.a.t../k.+.E.',
    'E:EW',
    'The louder tape travels through the far opening before it reaches the lamp.',
    'a folded map with an arrow pointing at itself',
  ],
  [
    'The Glass Diary',
    'S.D|.C/.c.|a./..m.D./....E.',
    'S:ns',
    'Walk the long side of both displays to collect the whole passage.',
    'both sides of a transparent bookmark',
  ],
  [
    'Two Night Porters',
    'Sa...D/.#.b#./..cc.E',
    'E:ew;N:ns',
    'Two attendants hear the room from different shelves.',
    'a list of everyone who stayed after the bell',
  ],
  [
    'Cross Reference',
    'S..a../.##.D./k.b+.E/......',
    'E:ew;S:ew',
    'A short click can move one listener without waking the second.',
    'two names connected by three uncertain arrows',
  ],
  [
    'Uncatalogued',
    'S.C.D./..#|b./ac..mE',
    'S:ew;W:ns',
    'The brass lamps cross the filtered camera light.',
    'her sketch of a room missing from every map',
  ],
  [
    'Third Bell',
    'S..m#./.a#.|D/.c.tk./b..+E.',
    'N:es;E:ew',
    'A nearer drop of keys can lead a searching porter off course.',
    'a bell diagram with a spiral for silence',
  ],
  [
    'Last Reader',
    'S..D.C/.a#.#./.m.bk./c..+E.',
    'S:ew;S:ns',
    'Let one porter check the noise while you watch the other one’s lamp.',
    'her promise to leave one good book on the desk',
  ],
  [
    'The Blank Page',
    'S.D|.C/.a.|D./.c.b../k..+E.',
    'W:wn;S:es',
    'Both pages. Both porters. One last clean exit.',
    'the final blank page, saved for tomorrow',
  ],
];
const patterns = [
  [1, 1, 2, -1],
  [2, 2, -1, 3],
  [3, -1, 2, 1],
  [2, -1, 1, -1],
  [3, 3, -1, 2],
  [1, -1, 2, -1],
];
export function indexRoom(raw) {
  const r = { ...raw },
    input = raw.rows;
  r.w = Math.max(...input.map((row) => row.length));
  r.h = input.length;
  r.tiles = input
    .map((row) => row.padEnd(r.w, ' '))
    .join('')
    .split('');
  const points = (c) =>
    r.tiles.reduce((a, v, i) => {
      if (v === c) a.push(i);
      return a;
    }, []);
  r.start = points('S')[0];
  r.exit = points('E')[0];
  r.items = points('D');
  r.all = (1 << r.items.length) - 1;
  r.keyAt = points('k')[0] ?? -1;
  r.exitKey = r.wing === 2;
  r.fragment = points('F')[0] ?? -1;
  const at = [...points('a'), ...points('b')],
    cams = points('C');
  r.patrols = raw.patrol.split(';').map((description, i) => {
    const [initial, body] = description.split(':'),
      start = at[i];
    let p = start;
    const route = [{ p, f: dirs.indexOf(initial) }];
    for (const c of body) {
      const f = dirs.indexOf(c.toUpperCase());
      if (f < 0) throw Error('Bad patrol direction in ' + raw.name);
      if (c === c.toUpperCase()) {
        const q = neighbor(r, p, f);
        if (!walkable(r, q, true)) throw Error('Patrol crosses a wall in ' + r.name);
        p = q;
      }
      route.push({ p, f });
    }
    if (p !== start) throw Error('Patrol does not close in ' + r.name);
    return route;
  });
  r.cameras = cams.map((p, j) => ({
    p,
    pattern: raw.pattern || patterns[(r.id + j) % patterns.length],
    offset: raw.offset || 0,
    range: raw.view || 4,
  }));
  r.period = r.cameras.length ? 4 : 1;
  r.ranges = r.patrols.map((_, i) => raw.ranges?.[i] ?? (r.wing > 2 ? 4 : 3));
  r.tapes = raw.tapes ?? (r.wing === 0 ? 1 : 2);
  r.charges = raw.charges ?? (r.wing < 2 ? 1 : 2);
  return r;
}
export const rooms = commissions.map(([name, grid, patrol, lesson, fragment], i) => {
  const rows = grid.split('/'),
    wing = Math.floor(i / 6);
  // A collectible line belongs to each exhibit. The six closing rooms also
  // contain a loose scrap on an otherwise ordinary physically reachable tile.
  if (i % 6 === 5) {
    const y = rows.length - 1,
      x = rows[y].indexOf('.');
    if (x >= 0) rows[y] = rows[y].slice(0, x) + 'F' + rows[y].slice(x + 1);
  }
  return indexRoom({ id: i + 1, name, rows, patrol, lesson, fragmentText: fragment, wing });
});
