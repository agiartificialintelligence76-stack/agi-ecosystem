// ACCEPT ALL COOKIES: the sketches the 30 levels were made from (./make.mjs turns each into its level data: the
// pixels on the reference solution's path at the ticks in `pixT`, the cat where the path comes down). The levels in
// src/games/cookies/levels.js are the result, kept as plain data.
export const SKETCHES = [
  {
    site: 'site 1: a recipe blog (ropes, hooks, pixels)',
    id: '1-1', name: 'Fresh out of the oven', tip: 'Swipe across the rope',
    cookie: [300, 330], pins: [[300, 110]], ropes: [[0]],
    sol: [[90, 'cut', 0]], pixT: [135, 161, 180], catAt: [300, 790],
  },
  {
    id: '1-2', name: 'Swing by', tip: 'Let it swing, then cut',
    cookie: [480, 140], pins: [[300, 110]], ropes: [[0]],
    sol: [[168, 'cut', 0]], pixT: [90, 120, 236], catAt: { y: 790 },
  },
  {
    id: '1-3', name: 'Order matters', tip: 'Which rope first?',
    cookie: [430, 250], pins: [[250, 120], [430, 130]], ropes: [[0], [1]],
    sol: [[60, 'cut', 1], [236, 'cut', 0]], pixT: [150, 205, 300], catAt: { y: 790 },
  },
  {
    id: '1-4', name: 'Hooked', tip: 'Dashed circles tie on a new rope',
    cookie: [130, 160], pins: [[290, 110]], ropes: [[0]], hooks: [[420, 340, 115]],
    sol: [[170, 'cut', 0], [290, 'cut', 1]], pixT: [70, 240, 380], catAt: { y: 790 },
  },
  {
    id: '1-5', name: 'Monkey bars',
    cookie: [120, 180], pins: [[120, 70]], ropes: [[0]], hooks: [[200, 430, 110], [400, 430, 110]],
    sol: [[40, 'cut', 0], [300, 'cut', 1], [426, 'cut', 2]], pixT: [140, 370, 470], catAt: { y: 790 },
  },
  {
    id: '1-6', name: 'Batter up', tip: 'Toss it into the circle',
    cookie: [60, 200], pins: [[200, 90]], ropes: [[0]], hooks: [[450, 470, 105]],
    sol: [[92, 'cut', 0], [278, 'cut', 1]], pixT: [60, 125, 330], catAt: { y: 790 },
  },
  {
    id: '1-7', name: 'Slack line',
    cookie: [560, 250], pins: [[330, 80], [560, 160]], ropes: [[0, 350], [1]],
    sol: [[50, 'cut', 1], [272, 'cut', 0]], pixT: [130, 172, 228], catAt: { y: 790 },
  },
  {
    id: '1-8', name: "Three's a crowd",
    cookie: [300, 300], pins: [[170, 140], [300, 100], [430, 140]], ropes: [[0], [1], [2]],
    sol: [[40, 'cut', 1], [70, 'cut', 2], [309, 'cut', 0]], pixT: [200, 270, 340], catAt: { y: 790 },
  },
  {
    id: '1-9', name: 'Swing set',
    cookie: [110, 200], pins: [[60, 90], [200, 90]], ropes: [[0], [1]], hooks: [[250, 330, 120], [420, 470, 110]],
    sol: [[70, 'cut', 0], [260, 'cut', 1], [470, 'cut', 2], [627, 'cut', 3]], pixT: [100, 305, 548], catAt: { y: 790 },
  },
  {
    id: '1-10', name: 'Layer cake',
    cookie: [140, 170], pins: [[60, 70], [140, 60], [240, 90]], ropes: [[0], [1], [2]], hooks: [[300, 290, 110], [400, 450, 110], [270, 610, 105]],
    sol: [[30, 'cut', 0], [60, 'cut', 1], [334, 'cut', 2], [648, 'cut', 3], [762, 'cut', 4], [905, 'cut', 5]], pixT: [150, 440, 840], catAt: { y: 790 },
  },
  {
    site: 'site 2: a news site (pop-ups, cookie banners, fans)',
    id: '2-1', name: 'Breaking news', tip: 'Tap ✕ to close a pop-up',
    cookie: [300, 330], pins: [[150, 150], [450, 150]], ropes: [[0], [1]], popups: [[300, 610]],
    sol: [[40, 'cut', 0], [40, 'cut', 1], [362, 'pop', 0]], pixT: [100, 300, 352], catAt: [300, 790],
  },
  {
    id: '2-2', name: 'Above the fold',
    cookie: [130, 160], pins: [[130, 60]], ropes: [[0]], banners: [[70, 360, 360, 430], [520, 560, 240, 640]],
    sol: [[40, 'cut', 0]], pixT: [200, 300, 470], catAt: { y: 790 },
  },
  {
    id: '2-3', name: 'Accept all', tip: 'Buttons are bouncy',
    cookie: [330, 120], pins: [[200, 90]], ropes: [[0]], pads: [[70, 520, 200, 565]],
    sol: [[155, 'cut', 0]], pixT: [200, 280, 300], catAt: { tick: 322 },
  },
  {
    id: '2-4', name: 'Fresh air', tip: 'Tap the fan to puff',
    cookie: [160, 160], pins: [[160, 60]], ropes: [[0]], fans: [[60, 430, 1, -0.15]],
    sol: [[40, 'cut', 0], [110, 'puff', 0]], pixT: [100, 135, 158], catAt: { y: 790 },
  },
  {
    id: '2-5', name: 'Pop and puff',
    cookie: [150, 170], pins: [[150, 70]], ropes: [[0]], popups: [[150, 600]], fans: [[50, 400, 1, 0]],
    sol: [[40, 'cut', 0], [300, 'puff', 0], [440, 'pop', 0]], pixT: [250, 345, 520], catAt: { y: 790 },
  },
  {
    id: '2-6', name: 'Paywall',
    cookie: [60, 160], pins: [[190, 110]], ropes: [[0]], banners: [[300, 520, 300, 900]],
    sol: [[117, 'cut', 0]], pixT: [80, 140, 200], catAt: { y: 790 },
  },
  {
    id: '2-7', name: 'Reply all',
    cookie: [120, 140], pins: [[260, 100]], ropes: [[0]], pads: [[560, 250, 560, 470]],
    sol: [[95, 'cut', 0]], pixT: [70, 140, 185], catAt: { tick: 210 },
  },
  {
    id: '2-8', name: 'Clickbait',
    cookie: [120, 150], pins: [[120, 60]], ropes: [[0]], popups: [[120, 470], [470, 560]], banners: [[60, 330, 380, 420]],
    sol: [[40, 'cut', 0], [300, 'pop', 0], [600, 'pop', 1]], pixT: [200, 420, 560], catAt: { y: 790 },
  },
  {
    id: '2-9', name: 'Comment section',
    cookie: [90, 160], pins: [[90, 60]], ropes: [[0]], banners: [[40, 360, 380, 450]], fans: [[540, 560, -1, 0]],
    sol: [[40, 'cut', 0], [317, 'puff', 0]], pixT: [200, 290, 340], catAt: { y: 790 },
  },
  {
    id: '2-10', name: 'Front page',
    cookie: [140, 250], pins: [[70, 90], [300, 90]], ropes: [[0], [1]], popups: [[470, 380]], fans: [[560, 200, -1, 0.1]],
    sol: [[20, 'cut', 0], [183, 'cut', 1], [330, 'puff', 0], [479, 'pop', 0]], pixT: [110, 300, 420], catAt: { y: 790 },
  },
  {
    site: 'site 3: a social feed (bugs, sliding pins, tabs)',
    id: '3-1', name: 'Bug report', tip: 'Bugs crumble cookies',
    cookie: [250, 280], pins: [[120, 110], [380, 110]], ropes: [[0], [1]], bugs: [[250, 560]],
    sol: [[40, 'cut', 0], [219, 'cut', 1]], pixT: [110, 190, 290], catAt: { y: 790 },
  },
  {
    id: '3-2', name: 'On patrol',
    cookie: [300, 230], pins: [[300, 100]], ropes: [[0]], bugs: [[110, 540, 490, 540, 2.6, 0]],
    sol: [[224, 'cut', 0]], pixT: [290, 312, 330], catAt: { y: 790 },
  },
  {
    id: '3-3', name: 'Swipe right', tip: 'Drag the yellow knob',
    cookie: [120, 300], pins: [{ track: [120, 90, 480, 90], t: 0 }], ropes: [[0]],
    sol: [[30, 'slide', 0, 0.5], [110, 'slide', 0, 1], [330, 'cut', 0]], pixT: [100, 200, 380], catAt: { y: 790 },
  },
  {
    id: '3-4', name: 'Pump it',
    cookie: [200, 280], pins: [{ track: [200, 90, 400, 90], t: 0 }], ropes: [[0]], bugs: [[400, 640], [400, 700]],
    sol: [[30, 'slide', 0, 1], [166, 'cut', 0]], pixT: [100, 150, 240], catAt: { y: 790 },
  },
  {
    id: '3-5', name: 'New tab', tip: 'In one tab, out of the other',
    cookie: [140, 200], pins: [[140, 90]], ropes: [[0]], tabs: [[[140, 560, 0, -1], [470, 260, 0, 1]]],
    sol: [[40, 'cut', 0]], pixT: [100, 150, 170], catAt: { y: 790 },
  },
  {
    id: '3-6', name: 'Tab hoarder',
    cookie: [450, 150], pins: [[300, 110]], ropes: [[0]], tabs: [[[160, 520, 0, -1], [540, 330, -1, 1.4]]], bugs: [[300, 700]],
    sol: [[155, 'cut', 0]], pixT: [80, 200, 270], catAt: { y: 790 },
  },
  {
    id: '3-7', name: 'Doomscroll',
    cookie: [120, 290], pins: [{ track: [120, 90, 470, 90], t: 0 }], ropes: [[0]], bugs: [[160, 520, 440, 520, 2.4, 0]],
    sol: [[30, 'slide', 0, 1], [532, 'cut', 0]], pixT: [110, 270, 600], catAt: { y: 790 },
  },
  {
    id: '3-8', name: 'Going viral',
    cookie: [120, 160], pins: [[120, 60]], ropes: [[0]], pads: [[60, 520, 180, 560]], tabs: [[[440, 300, -1, 0.15], [300, 470, 0, 1]]],
    sol: [[40, 'cut', 0]], pixT: [110, 160, 225], catAt: { y: 790 },
  },
  {
    id: '3-9', name: 'Notifications',
    cookie: [300, 170], pins: [[300, 70]], ropes: [[0]], popups: [[300, 640]], bugs: [[130, 460, 470, 460, 2.6, 0], [130, 230, 470, 230, 2.6, 1.3]],
    sol: [[76, 'cut', 0], [543, 'pop', 0]], pixT: [300, 420, 520], catAt: { y: 790 },
  },
  {
    id: '3-10', name: 'Feed me',
    cookie: [110, 270], pins: [{ track: [110, 80, 300, 80], t: 0 }], ropes: [[0]], hooks: [[400, 330, 115]], tabs: [[[300, 610, 0, -1], [480, 170, 0, 1]]], bugs: [[390, 610, 570, 610, 2.4, 0]],
    sol: [[30, 'slide', 0, 1], [300, 'cut', 0], [332, 'cut', 1]], pixT: [120, 360, 410], catAt: { y: 790 },
  },
];
