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
    pixels: [[170, 229], [133, 337], [424, 580]], cat: [523, 790],
    sol: [[70, 'cut', 0], [260, 'cut', 1], [470, 'cut', 2], [627, 'cut', 3]],
  },
  {
    id: '1-10', name: "Layer cake",
    cookie: [140, 170], pins: [[60, 70], [140, 60], [240, 90]], ropes: [[0], [1], [2]], hooks: [[300, 290, 110], [400, 450, 110], [270, 610, 105]],
    pixels: [[295, 206], [333, 395], [275, 715]], cat: [165, 790],
    sol: [[30, 'cut', 0], [60, 'cut', 1], [334, 'cut', 2], [648, 'cut', 3], [762, 'cut', 4], [905, 'cut', 5]],
  },
  // ---------------------------------------------------------------- site 2: a news site (pop-ups, cookie banners, fans)
  {
    id: '2-1', name: "Breaking news", tip: "Tap ✕ to close a pop-up",
    cookie: [300, 330], pins: [[150, 150], [450, 150]], ropes: [[0], [1]], popups: [[300, 610]],
    pixels: [[300, 475], [300, 244], [300, 163]], cat: [300, 790],
    sol: [[40, 'cut', 0], [40, 'cut', 1], [432, 'pop', 0]],
  },
  {
    id: '2-2', name: "Above the fold",
    cookie: [130, 160], pins: [[130, 60]], ropes: [[0]], banners: [[70, 360, 360, 430], [520, 560, 240, 640]],
    pixels: [[298, 376], [460, 532], [290, 586]], cat: [135, 790],
    sol: [[40, 'cut', 0]],
  },
  {
    id: '2-3', name: "Accept all", tip: "Buttons are bouncy",
    cookie: [330, 120], pins: [[200, 90]], ropes: [[0]], pads: [[70, 520, 200, 565]],
    pixels: [[95, 264], [303, 337], [397, 307]], cat: [499, 311],
    sol: [[155, 'cut', 0]],
  },
  {
    id: '2-4', name: "Fresh air", tip: "Tap the fan to puff",
    cookie: [160, 160], pins: [[160, 60]], ropes: [[0]], fans: [[60, 430, 1, -0.15]],
    pixels: [[160, 305], [262, 503], [354, 681]], cat: [405, 790],
    sol: [[40, 'cut', 0], [110, 'puff', 0]],
  },
  {
    id: '2-5', name: "Pop and puff",
    cookie: [150, 170], pins: [[150, 70]], ropes: [[0]], popups: [[150, 600]], fans: [[50, 400, 1, 0]],
    pixels: [[150, 514], [277, 349], [372, 369]], cat: [382, 790],
    sol: [[40, 'cut', 0], [300, 'puff', 0], [440, 'pop', 0]],
  },
  {
    id: '2-6', name: "Paywall",
    cookie: [60, 160], pins: [[190, 110]], ropes: [[0]], banners: [[300, 520, 300, 900]],
    pixels: [[215, 247], [325, 185], [389, 356]], cat: [450, 790],
    sol: [[117, 'cut', 0]],
  },
  {
    id: '2-7', name: "Reply all",
    cookie: [120, 140], pins: [[260, 100]], ropes: [[0]], pads: [[560, 250, 560, 470]],
    pixels: [[238, 244], [463, 240], [372, 410]], cat: [217, 571],
    sol: [[95, 'cut', 0]],
  },
  {
    id: '2-8', name: "Clickbait",
    cookie: [120, 150], pins: [[120, 60]], ropes: [[0]], popups: [[470, 560]], banners: [[60, 330, 380, 420]],
    pixels: [[329, 366], [518, 423], [521, 164]], cat: [521, 790],
    sol: [[40, 'cut', 0], [575, 'pop', 0]],
  },
  {
    id: '2-9', name: "Comment section",
    cookie: [90, 160], pins: [[90, 60]], ropes: [[0]], banners: [[40, 360, 380, 450]], fans: [[540, 560, -1, 0]],
    pixels: [[270, 382], [433, 450], [416, 671]], cat: [371, 790],
    sol: [[40, 'cut', 0], [317, 'puff', 0]],
  },
  {
    id: '2-10', name: "Front page",
    cookie: [140, 250], pins: [[70, 90], [300, 90]], ropes: [[0], [1]], popups: [[470, 380]], fans: [[560, 200, -1, 0.1]],
    pixels: [[307, 316], [473, 316], [296, 135]], cat: [246, 790],
    sol: [[20, 'cut', 0], [183, 'cut', 1], [330, 'puff', 0], [479, 'pop', 0]],
  },
  // ---------------------------------------------------------------- site 3: a social feed (bugs, sliding pins, tabs)
  {
    id: '3-1', name: "Bug report", tip: "Bugs crumble cookies",
    cookie: [250, 280], pins: [[120, 110], [380, 110]], ropes: [[0], [1]], bugs: [[250, 560]],
    pixels: [[344, 321], [496, 290], [466, 511]], cat: [450, 790],
    sol: [[40, 'cut', 0], [219, 'cut', 1]],
  },
  {
    id: '3-2', name: "On patrol",
    cookie: [300, 230], pins: [[300, 100]], ropes: [[0]], bugs: [[110, 540, 490, 540, 2.6, 0]],
    pixels: [[300, 405], [300, 538], [300, 675]], cat: [300, 790],
    sol: [[224, 'cut', 0]],
  },
  {
    id: '3-3', name: "Swipe right", tip: "Drag the yellow knob",
    cookie: [110, 300], pins: [{'track':[110, 90, 340, 90], 't':0}], ropes: [[0]],
    pixels: [[211, 219], [373, 256], [442, 435]], cat: [426, 790],
    sol: [[30, 'slide', 0, 0.5], [70, 'slide', 0, 1], [217, 'cut', 0]],
  },
  {
    id: '3-4', name: "Wind-up",
    cookie: [200, 280], pins: [{'track':[200, 90, 400, 90], 't':0}], ropes: [[0]], bugs: [[400, 640], [400, 700]],
    pixels: [[338, 156], [480, 242], [505, 479]], cat: [512, 790],
    sol: [[30, 'slide', 0, 1], [166, 'cut', 0]],
  },
  {
    id: '3-5', name: "New tab", tip: "In one tab, out of the other",
    cookie: [140, 200], pins: [[140, 90]], ropes: [[0]], tabs: [[[140, 560, 0, -1], [470, 260, 0, 1]]],
    pixels: [[140, 345], [470, 423], [470, 610]], cat: [470, 790],
    sol: [[40, 'cut', 0]],
  },
  {
    id: '3-6', name: "Tab hoarder",
    cookie: [450, 150], pins: [[300, 110]], ropes: [[0]], bugs: [[160, 700]], tabs: [[[160, 500, 0, -1], [480, 230, 0, 1]]],
    pixels: [[293, 265], [160, 259], [482, 529]], cat: [483, 790],
    sol: [[155, 'cut', 0]],
  },
  {
    id: '3-7', name: "Doomscroll",
    cookie: [120, 290], pins: [{'track':[120, 90, 360, 90], 't':0}], ropes: [[0]], bugs: [[150, 540, 540, 540, 2.4, 0]],
    pixels: [[236, 166], [406, 190], [469, 438]], cat: [467, 790],
    sol: [[30, 'slide', 0, 1], [176, 'cut', 0]],
  },
  {
    id: '3-8', name: "Going viral",
    cookie: [120, 160], pins: [[120, 60]], ropes: [[0]], pads: [[60, 520, 180, 560]], tabs: [[[440, 300, -1, 0.15], [300, 470, 0, 1]]],
    pixels: [[120, 356], [236, 375], [291, 608]], cat: [280, 790],
    sol: [[40, 'cut', 0]],
  },
  {
    id: '3-9', name: "Notifications",
    cookie: [140, 150], pins: [[280, 70]], ropes: [[0]], popups: [[410, 640]], bugs: [[220, 420, 560, 420, 2.4, 0]],
    pixels: [[225, 222], [408, 303], [405, 106]], cat: [405, 790],
    sol: [[152, 'cut', 0], [621, 'pop', 0]],
  },
  {
    id: '3-10', name: "Feed me",
    cookie: [110, 270], pins: [{'track':[110, 80, 300, 80], 't':0}], ropes: [[0]], hooks: [[400, 330, 115]], bugs: [[390, 610, 570, 610, 2.4, 0]], tabs: [[[300, 610, 0, -1], [480, 170, 0, 1]]],
    pixels: [[295, 165], [302, 415], [480, 355]], cat: [480, 790],
    sol: [[30, 'slide', 0, 1], [300, 'cut', 0], [332, 'cut', 1]],
  },
  // </levels>
];

export const LEVELS = RAW.map((l, index) => ({ ...l, index, site: Number(l.id.split('-')[0]), n: Number(l.id.split('-')[1]) }));
export const levelById = (id) => LEVELS.find((l) => l.id === id) || null;
export const levelsOf = (site) => LEVELS.filter((l) => l.site === site);
