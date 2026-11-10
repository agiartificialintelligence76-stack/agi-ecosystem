// ACCEPT ALL COOKIES: the 30 levels, in three "sites" of ten. Each is data on a 600 × 900 page (./physics.js): the
// cookie's start, its pins and ropes (a rope's length is the distance to the cookie unless it says), the elements, the
// three tracker pixels, the cat's mouth, and a reference solution (actions at ticks of 1/120 s) that clears it with all
// three pixels in the headless simulation (tests/cookies.test.js plays every one).
//
//   pins:    [x, y] or { track: [x0, y0, x1, y1], t } (a sliding pin: drag it along its track)
//   ropes:   [pin, length?]
//   hooks:   [x, y, r]          a dashed circle: the cookie passing inside it gets a new rope of length r
//   popups:  [x, y]             a pop-up window: it wraps the cookie and floats it up until you close it
//   banners: [x0, y0, x1, y1]   a cookie banner: solid; pads: [x0, y0, x1, y1] its bouncy buttons
//   fans:    [x, y, dx, dy]     a cooling fan facing (dx, dy): tap to puff
//   bugs:    [x, y] or [x0, y0, x1, y1, period, phase]   a bug: a touch crumbles the cookie
//   tabs:    [[x, y, dx, dy], [x, y, dx, dy]]   a pair of browser tabs: in one, out of the other
//   sol:     [tick, 'cut', rope] · [tick, 'pop', popup] · [tick, 'puff', fan] · [tick, 'slide', pin, t]

export const SITES = [
  { id: 1, key: 'recipes', name: 'Recipe blog', title: 'Sugar cookies (+ my life story)', unlock: 0 },
  { id: 2, key: 'news', name: 'News site', title: 'BREAKING: cat wants cookie', unlock: 15 },
  { id: 3, key: 'feed', name: 'Social feed', title: 'your feed · 99+ new', unlock: 35 },
];

const RAW = [
  // <levels> (made by tools/games/cookies/make.mjs from its sketches)
  // ---------------------------------------------------------------- site 1: a recipe blog (ropes, hooks, pixels)
  {
    id: '1-1', name: "Fresh out of the oven", tip: "Swipe across the rope",
    cookie: [300, 330], pins: [[300, 110]], ropes: [[0]],
    pixels: [[300, 412], [300, 532], [300, 652]], cat: [300, 790],
    sol: [[90, 'cut', 0]],
  },
  {
    id: '1-2', name: "Swing by", tip: "Let it swing, then cut",
    cookie: [480, 140], pins: [[300, 110]], ropes: [[0]],
    pixels: [[284, 292], [173, 241], [126, 351]], cat: [125, 790],
    sol: [[168, 'cut', 0]],
  },
  {
    id: '1-3', name: "Order matters", tip: "Which rope first?",
    cookie: [430, 250], pins: [[250, 120], [430, 130]], ropes: [[0], [1]],
    pixels: [[245, 342], [100, 283], [86, 434]], cat: [89, 790],
    sol: [[60, 'cut', 1], [236, 'cut', 0]],
  },
  {
    id: '1-4', name: "Hooked", tip: "Dashed circles tie on a new rope",
    cookie: [130, 160], pins: [[290, 110]], ropes: [[0]], hooks: [[420, 340, 115]],
    pixels: [[246, 272], [435, 454], [504, 483]], cat: [490, 790],
    sol: [[170, 'cut', 0], [290, 'cut', 1]],
  },
  {
    id: '1-5', name: "Monkey bars",
    cookie: [120, 180], pins: [[120, 70]], ropes: [[0]], hooks: [[200, 430, 110], [400, 430, 110]],
    pixels: [[161, 533], [418, 539], [493, 567]], cat: [493, 790],
    sol: [[40, 'cut', 0], [300, 'cut', 1], [426, 'cut', 2]],
  },
  {
    id: '1-6', name: "Batter up", tip: "Toss it into the circle",
    cookie: [60, 200], pins: [[200, 90]], ropes: [[0]], hooks: [[450, 470, 105]],
    pixels: [[142, 258], [336, 287], [385, 661]], cat: [386, 790],
    sol: [[92, 'cut', 0], [278, 'cut', 1]],
  },
  {
    id: '1-7', name: "Slack line",
    cookie: [560, 250], pins: [[330, 80], [560, 160]], ropes: [[0, 350], [1]],
    pixels: [[474, 399], [303, 429], [120, 360]], cat: [76, 790],
    sol: [[50, 'cut', 1], [272, 'cut', 0]],
  },
  {
    id: '1-8', name: "Three's a crowd",
    cookie: [300, 300], pins: [[170, 140], [300, 100], [430, 140]], ropes: [[0], [1], [2]],
    pixels: [[71, 321], [74, 323], [225, 392]], cat: [393, 790],
    sol: [[40, 'cut', 1], [70, 'cut', 2], [309, 'cut', 0]],
  },
  {
    id: '1-9', name: "Swing set",
    cookie: [110, 200], pins: [[60, 90], [200, 90]], ropes: [[0], [1]], hooks: [[250, 330, 120], [420, 470, 110]],
    pixels: [[128, 213], [133, 337], [424, 580]], cat: [523, 790],
    sol: [[70, 'cut', 0], [260, 'cut', 1], [470, 'cut', 2], [627, 'cut', 3]],
  },
  {
    id: '1-10', name: "Layer cake",
    cookie: [140, 170], pins: [[60, 70], [140, 60], [240, 90]], ropes: [[0], [1], [2]], hooks: [[300, 290, 110], [400, 450, 110], [270, 610, 105]],
    pixels: [[295, 206], [333, 395], [275, 715]], cat: [165, 790],
    sol: [[30, 'cut', 0], [60, 'cut', 1], [334, 'cut', 2], [648, 'cut', 3], [762, 'cut', 4], [905, 'cut', 5]],
  },
  // </levels>
];

export const LEVELS = RAW.map((l, index) => ({ ...l, index, site: Number(l.id.split('-')[0]), n: Number(l.id.split('-')[1]) }));
export const levelById = (id) => LEVELS.find((l) => l.id === id) || null;
export const levelsOf = (site) => LEVELS.filter((l) => l.site === site);
