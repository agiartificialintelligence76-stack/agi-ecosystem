// AGI Studio's meme templates and their words (2026-10-11, after round 4). The owner: "ready made meme templates already the
// popular ones … the character on that meme will be replaced by their influencer by default", then "even after the result
// they can still edit the text after, change font, change the text color, add characters to that picture, animate it".
//
// A meme is one picture the AI makes without any words (the influencer in a popular meme's situation, everyone else made up),
// put on its template's canvas (white bands, panels), and its words drawn on top by us, never by the AI: layers of text the
// editor can change at any time (words, font, color, outline, background, size, place). Our server draws them with the same
// fonts and the same layout as the page (src/studio/meme-layout.js), so the editor shows exactly what's saved.
//
// The templates restage the situation of popular meme formats in our own words, with the person's own influencer in it:
// never the original photos or drawings, never a real person, a brand or someone else's character, and descriptive names.
// Pure: the page and our server share it (tests/influencer.test.js holds every template and sample to the studio's rules).
//
// The owner's three answers (2026-10-14): "Save as a new meme" (the editor's words, fonts and colors saved as a new meme next
// to it, free, the first one kept), "Other influencers" (another of their influencers, or AGI-1, put into a meme: a role of
// its template, made by AI at a photo's price) and "5-second video" (its picture comes to life for 5 seconds, its words over
// it, at a Standard 5-second video's price). So each template also says who else can be in it (cast) and what moves (motion),
// and where the share mark goes so it never covers the words (markSpot).
import { MARK_LOOK } from './rules.js';

// ---------- the canvas and the fonts ----------
export const MEME_CANVAS = { square: { w: 1080, h: 1080, ratio: '1:1' }, tall: { w: 1080, h: 1920, ratio: '9:16' } };
// The six fonts (public/fonts/meme/, made by tools/studio/meme-fonts.py; their licenses beside them). lh: their line height
// (in em); a letter one doesn't have comes from Clean (Noto Sans: Latin, Greek, Cyrillic), an emoji from the emoji font.
export const MEME_FONTS = {
  classic: { name: 'Classic', file: 'anton-v1.woff', lh: 1.06 },
  comic: { name: 'Comic', file: 'bangers-v1.woff', lh: 1.02 },
  marker: { name: 'Marker', file: 'marker-v1.woff', lh: 1.16 },
  casual: { name: 'Casual', file: 'comicneue-v1.woff', lh: 1.14 },
  bold: { name: 'Bold', file: 'archivo-v1.woff', lh: 1.12 },
  clean: { name: 'Clean', file: 'notosans-v1.woff', lh: 1.18 },
};
export const MEME_FALLBACK = 'clean';
export const MEME_EMOJI_FILE = 'emoji-v1.woff';
export const memeFontUrl = (file) => `/fonts/meme/${file}`;
// the words' colors (any #rrggbb can be picked; these are a tap away)
export const MEME_COLORS = [
  ['#ffffff', 'White'], ['#111111', 'Black'], ['#ffd23f', 'Yellow'], ['#ff3b30', 'Red'], ['#ff4fa3', 'Pink'], ['#a259ff', 'Purple'],
  ['#2f80ff', 'Blue'], ['#2ee6a6', 'Mint'], ['#ff9500', 'Orange'],
];
export const MEME_OUTLINES = [['', 'None'], ['#111111', 'Black'], ['#ffffff', 'White']];
export const MEME_BOXES = [['', 'None'], ['#ffffff', 'White'], ['#111111', 'Black'], ['#ffd23f', 'Yellow']];

// A layer of words: its text (t: up to LAYERS.TEXT lines of words), its box (x, y: its middle; w, h: its size, all fractions of
// the canvas), its biggest font size (s: of the canvas's width: smaller when its words need it to fit the box), its font (f),
// color (c), outline (o, or none), background (b, or none), alignment (a: l, c, r) and ALL CAPS (u)
export const LAYERS = { MAX: 8, TEXT_MAX: 120, LINES_MAX: 6, S: [0.02, 0.2], W: [0.08, 1], H: [0.04, 1], CAPTION_MAX: 1000 };
export const HEX = /^#[0-9a-f]{6}$/;
const ALIGN = new Set(['l', 'c', 'r']);

// ---------- the templates ----------
// Each: name, its card's line (about), canvas, bg (its color behind the picture), pic ([x, y, w, h]: where the AI's picture
// goes), grid ([cols, rows]: the panels the AI draws in it), shows (what the AI draws: "the character" is the influencer;
// null for the classics, where the person's own scene says it: ask 'scene'), its default layers (each with its label), and
// samples ("Surprise me": one text per layer; '' leaves that layer out). motion: what moves when it's animated (else
// MOTION_DEFAULT). cast: who else can be in it (its roles: see castOf below; none said: someone beside the character; []: nobody).
const impact = (label, x, y, w, h, s, more = {}) => ({ label, x, y, w, h, s, f: 'classic', c: '#ffffff', o: '#111111', b: '', a: 'c', u: true, ...more });
const plain = (label, x, y, w, h, s, more = {}) => ({ label, x, y, w, h, s, f: 'clean', c: '#111111', o: '', b: '', a: 'c', u: false, ...more });
const tag = (label, x, y, w, h, s, more = {}) => ({ label, x, y, w, h, s, f: 'bold', c: '#111111', o: '', b: '#ffffff', a: 'c', u: false, ...more });
const topBottom = () => [impact('Top', 0.5, 0.1, 0.94, 0.18, 0.105), impact('Bottom', 0.5, 0.9, 0.94, 0.18, 0.105)];
const rows = (n, more = {}) => Array.from({ length: n }, (_, k) => plain(['First', 'Second', 'Third', 'Fourth'][k], 0.25, (k + 0.5) / n, 0.44, 0.9 / n, 0.06, more));

export const TEMPLATES = {
  // the classics (since round 4's phase 4): the person's own scene is what the picture shows
  topbottom: {
    name: 'Top & bottom', cat: 'classic', about: 'Bold words at the top and the bottom', canvas: 'square', bg: '#111111', pic: [0, 0, 1, 1], ask: 'scene',
    layers: topBottom(),
    samples: [['When the coffee finally kicks in', 'Main character energy'], ['Said I would sleep early', 'It is now 3 AM'],
      ['Me opening the fridge', 'For the fifth time in an hour'], ['Weekend plans', 'Nap, snack, repeat']],
  },
  caption: {
    name: 'Caption', cat: 'classic', about: 'A line of words above the picture, like a post', canvas: 'square', bg: '#ffffff', pic: [0, 0.26, 1, 0.74], ask: 'scene',
    layers: [plain('Caption', 0.5, 0.13, 0.92, 0.22, 0.062, { a: 'l' })],
    samples: [["Me pretending I didn't plan this outfit for a week"], ['Plot twist: I was the main character all along'],
      ['When the playlist hits just right']],
  },
  pov: {
    name: 'POV', cat: 'classic', about: 'A tall POV picture, its words near the top', canvas: 'tall', bg: '#111111', pic: [0, 0, 1, 1], ask: 'scene',
    layers: [plain('Your line', 0.5, 0.2, 0.86, 0.22, 0.085, { c: '#ffffff', o: '#111111' })],
    samples: [["POV: you said 'one more photo' 40 minutes ago"], ['POV: the group chat goes quiet after your joke'],
      ['POV: you finally found the perfect playlist']],
  },
  reaction: {
    name: 'Reaction', cat: 'classic', about: 'A big reaction face, your words under it', canvas: 'square', bg: '#111111', pic: [0, 0, 1, 1], ask: 'optional',
    shows: 'The character close up with a big, expressive reaction: eyes wide, mouth open, both hands on the cheeks.',
    layers: [impact('Bottom', 0.5, 0.88, 0.94, 0.2, 0.1)],
    samples: [['When someone says pineapple belongs on pizza'], ['Me when the playlist hits just right'], ['When the food arrives early']],
  },
  twopanel: {
    name: 'Before / after', cat: 'classic', about: 'Two panels side by side, a label on each', canvas: 'square', bg: '#ffffff', pic: [0, 0, 1, 1], grid: [2, 1], ask: 'scene',
    shows: 'Two panels side by side, separated by a thin white line, the same character in both.',
    layers: [tag('Left', 0.25, 0.08, 0.44, 0.12, 0.06), tag('Right', 0.75, 0.08, 0.44, 0.12, 0.06)],
    samples: [['Monday morning', 'Friday night'], ['What I pictured', 'What I baked'], ['Me at 9 AM', 'Me at 3 PM']],
  },
  // popular formats, restaged
  nahyeah: {
    name: 'Nah / Yeah', cat: 'choice', about: 'Turning one thing down, pointing happily at another', canvas: 'square', bg: '#ffffff', pic: [0, 0, 0.5, 1], grid: [1, 2],
    shows: 'Two panels stacked, separated by a thin line, the same character in both, from the chest up: in the top panel the character turns their head away, '
      + 'one hand raised to block something, looking unimpressed; in the bottom panel the character smiles and points approvingly with one finger, pleased.',
    layers: [plain('Nah (top)', 0.75, 0.25, 0.44, 0.42, 0.07), plain('Yeah (bottom)', 0.75, 0.75, 0.44, 0.42, 0.07)],
    samples: [['Going out on Friday', 'Staying in with snacks'], ['Waking up at 6', 'Waking up at 6 and going back to sleep'],
      ['Small talk', 'Talking about my favorite show for an hour'], ['Doing it today', 'Doing it tomorrow']],
    motion: 'In each panel the character moves a little: a slow head turn and a small hand gesture.',
    cast: [],
  },
  distracted: {
    name: 'Distracted', cat: 'choice', about: 'Turning to look at someone new, the partner is shocked', canvas: 'square', bg: '#111111', pic: [0, 0, 1, 1],
    shows: 'On a sunny city street, the character walks hand in hand with a made-up partner but turns around to stare, impressed, at a made-up stranger '
      + 'walking past on the left; the partner, on the right, looks at the character, shocked and offended.',
    layers: [impact('On the stranger (left)', 0.2, 0.6, 0.36, 0.16, 0.07), impact('On you (middle)', 0.52, 0.48, 0.32, 0.16, 0.07),
      impact('On the partner (right)', 0.82, 0.6, 0.34, 0.16, 0.07)],
    samples: [['A new hobby', 'Me', 'The hobby I started last week'], ['A nap', 'Me', 'My to-do list'],
      ['Starting a new show', 'Me', "The show I'm halfway through"]],
    motion: 'The character slowly turns to look back; the partner frowns; people walk past.',
    cast: [
      { id: 'stranger', name: 'The stranger (left)', says: 'the stranger walking past on the left, the one the character turns around to stare at' },
      { id: 'partner', name: 'The partner (right)', says: "the partner on the right, holding the character's hand, looking at the character shocked and offended" },
    ],
  },
  buttons: {
    name: 'Two buttons', cat: 'choice', about: 'Sweating over two big buttons', canvas: 'square', bg: '#111111', pic: [0, 0, 1, 1],
    shows: 'A close-up of the character sweating nervously, wiping their forehead, one hand hovering between two big round red buttons on a control panel; '
      + 'the two buttons sit in the upper left and the upper right of the picture.',
    layers: [tag('Left button', 0.27, 0.2, 0.4, 0.14, 0.056), tag('Right button', 0.73, 0.2, 0.4, 0.14, 0.056), impact('Bottom', 0.5, 0.9, 0.9, 0.16, 0.08)],
    samples: [['Sleep early', 'One more episode', ''], ['Be productive', 'Make another meme', 'Me, every day'], ['Eat healthy', 'Order pizza', '']],
    motion: 'The character sweats and looks from one button to the other.',
    cast: [],
  },
  galaxy: {
    name: 'Bigger brain', cat: 'panels', about: 'Four panels, each one more enlightened', canvas: 'square', bg: '#ffffff', pic: [0.5, 0, 0.5, 1], grid: [1, 4],
    shows: 'Four panels stacked, separated by thin lines, the same character in each, face close up: first plain and calm in a dim room; second with a soft '
      + 'glow around the head; third with a bright glowing aura; fourth radiating cosmic light and stars, eyes shining.',
    layers: rows(4),
    samples: [['Texting back', 'Texting back fast', 'Texting back instantly', 'Texting before they text'],
      ['Taking a nap', 'Taking a long nap', 'Napping all afternoon', 'Napping professionally'],
      ['Making a plan', 'Making a list', 'Making a list of lists', 'Doing it tomorrow']],
    motion: 'The glow around the character pulses softly in each panel.',
    cast: [],
  },
  yelling: {
    name: 'Yelling at the cat', cat: 'panels', about: 'Two panels: shouting, and a cat who does not care', canvas: 'square', bg: '#ffffff', pic: [0, 0, 1, 1], grid: [2, 1],
    shows: 'Two panels side by side, separated by a thin white line: on the left the character, upset, points and shouts dramatically while a made-up friend '
      + 'holds them back; on the right a fluffy grumpy orange cat sits at a dinner table in front of a plate of salad, looking confused and unbothered.',
    layers: [impact('Left', 0.25, 0.1, 0.46, 0.18, 0.06), impact('Right', 0.75, 0.1, 0.46, 0.18, 0.06)],
    samples: [['Me explaining my weekend plans', 'My cat, who only wants dinner'], ['Me: we talked about this', 'Also me: what did we talk about'],
      ['My alarm at 7 AM', 'Me, still asleep']],
    motion: 'The character shouts and waves an arm; the cat blinks slowly.',
    cast: [{ id: 'friend', name: 'The friend holding them back', says: 'the friend in the left panel, holding the character back' }],
  },
  fine: {
    name: 'This is fine', cat: 'reaction', about: 'Calm with a coffee while everything is chaos', canvas: 'square', bg: '#111111', pic: [0, 0, 1, 1],
    shows: 'A cozy room where everything is comically on fire with bright cartoon flames (nobody hurt), and the character sits calmly at a small table with a '
      + 'cup of coffee, smiling peacefully as if nothing is wrong.',
    layers: [impact('Top', 0.5, 0.1, 0.94, 0.18, 0.09), impact('Bottom', 0.5, 0.9, 0.94, 0.16, 0.09)],
    samples: [['My inbox after a long weekend', 'This is fine'], ['Me pretending I am ready for Monday', 'This is fine'],
      ['Group project due tomorrow', 'This is fine']],
    motion: 'The cartoon flames flicker; the character sips the coffee calmly.',
  },
  changemind: {
    name: 'Change my mind', cat: 'reaction', about: 'A confident take on a sign', canvas: 'square', bg: '#111111', pic: [0, 0, 1, 1],
    shows: 'Outdoors on a sunny lawn, the character sits relaxed behind a small table with a coffee mug, smiling confidently; a big blank white sign hangs on '
      + 'the front of the table, filling the lower middle of the picture.',
    layers: [plain('On the sign', 0.5, 0.74, 0.42, 0.18, 0.06)],
    samples: [['Breakfast for dinner is the best dinner\nChange my mind'], ['Naps are a sport\nChange my mind'], ['Cats run the internet\nChange my mind']],
    motion: 'The character sips the coffee and smiles; leaves move in the breeze.',
  },
  pigeon: {
    name: 'Is this a…?', cat: 'reaction', about: 'Pointing at a butterfly, confused', canvas: 'square', bg: '#111111', pic: [0, 0, 1, 1],
    shows: 'In a sunny meadow, the character stands on the right side of the picture, pointing curiously with one hand at a bright butterfly fluttering in '
      + 'the upper left, head tilted, puzzled.',
    layers: [impact('On you', 0.72, 0.3, 0.4, 0.13, 0.07), impact('On the butterfly', 0.24, 0.16, 0.38, 0.13, 0.07), impact('Bottom', 0.5, 0.88, 0.92, 0.18, 0.07)],
    samples: [['Me', 'A new tab', 'Is this productivity?'], ['Me', 'Any snack', 'Is this a balanced meal?'], ['Me', 'A cloud', 'Is this a sign?']],
    motion: 'The butterfly flutters; the character follows it with their eyes.',
  },
  shocked: {
    name: 'Shocked face', cat: 'reaction', about: 'Words above, a totally shocked face', canvas: 'square', bg: '#ffffff', pic: [0, 0.3, 1, 0.7],
    shows: "The character's face close up in total shock: eyes wide, mouth wide open, hands on the cheeks.",
    layers: [plain('Top', 0.5, 0.15, 0.92, 0.26, 0.058, { a: 'l' })],
    samples: [['Me: eats a whole pizza at midnight\nMy stomach at 7 AM:'], ['Me: skips the instructions\nThe furniture: has extra pieces\nMe:'],
      ['Me: one more episode\nThe sun: rises\nMe:']],
    motion: 'The character gasps, eyes going even wider.',
  },
  sideeye: {
    name: 'Side eye', cat: 'reaction', about: 'A suspicious side-eye glance', canvas: 'square', bg: '#111111', pic: [0, 0, 1, 1],
    shows: 'The character close up, giving a suspicious side-eye glance to one side, lips pressed together, one eyebrow slightly raised.',
    layers: [impact('Top', 0.5, 0.1, 0.94, 0.18, 0.085)],
    samples: [["When someone says they don't like snacks"], ["When the group chat says 'quick question'"], ['When the waiter says it is a small portion']],
    motion: 'The character slowly slides their eyes to the side and back.',
  },
  panik: {
    name: 'Panic / calm', cat: 'panels', about: 'Panic, calm, then more panic', canvas: 'square', bg: '#ffffff', pic: [0.5, 0, 0.5, 1], grid: [1, 3],
    shows: 'Three panels stacked, separated by thin lines, the same character in each, face close up: first panicking, hands on the cheeks; second calm and '
      + 'relieved, eyes closed, smiling; third panicking even more, eyes huge.',
    layers: rows(3, { s: 0.065 }),
    samples: [['I lost my phone', 'It was in my hand', 'At 1% battery'], ['The meeting is today', 'It moved to tomorrow', 'Tomorrow is also a meeting'],
      ['Forgot my lunch', 'Found a snack', 'It was my lunch, from last week']],
    motion: 'Each panel moves a little: worried, then relieved, then worried again.',
    cast: [],
  },
  trade: {
    name: 'Trade offer', cat: 'choice', about: 'Arms out, making a deal', canvas: 'square', bg: '#111111', pic: [0, 0, 1, 1],
    shows: 'The character faces the camera, arms stretched out to both sides, palms up as if presenting an offer, a confident little smile, plain dark background.',
    layers: [impact('Top', 0.5, 0.1, 0.9, 0.14, 0.085), impact('Left', 0.2, 0.55, 0.34, 0.3, 0.065), impact('Right', 0.8, 0.55, 0.34, 0.3, 0.065)],
    samples: [['Trade offer', 'i receive:\nyour fries', 'you receive:\nmy best smile'], ['Trade offer', 'i receive:\nthe window seat', 'you receive:\nmy playlist'],
      ['Trade offer', 'i receive:\na nap', 'you receive:\na nicer me']],
    motion: 'The character nods slowly, palms up.',
    cast: [],
  },
  thenow: {
    name: 'Then vs now', cat: 'panels', about: 'A heroic version and a tired one', canvas: 'square', bg: '#ffffff', pic: [0, 0, 1, 1], grid: [2, 1],
    shows: 'Two panels side by side, separated by a thin white line, the same character in both: on the left an exaggerated heroic version, standing tall and '
      + 'glowing with confidence like a cartoon champion; on the right a tiny, tired, slouched version holding a mug, looking defeated.',
    layers: [impact('Left', 0.25, 0.88, 0.46, 0.18, 0.065), impact('Right', 0.75, 0.88, 0.46, 0.18, 0.065)],
    samples: [['Me at 9 AM', 'Me at 3 PM'], ['Me on vacation', 'Me on Monday'], ['Me with a plan', 'Me doing the plan']],
    motion: 'The heroic one flexes; the tired one sighs and sips.',
    cast: [],
  },
  waiting: {
    name: 'Still waiting', cat: 'reaction', about: 'Waiting so long there are cobwebs', canvas: 'square', bg: '#111111', pic: [0, 0, 1, 1],
    shows: 'The character sits on an old park bench covered in dust and cobwebs as if they had waited for years, looking tired and patient, autumn leaves '
      + 'around, soft evening light.',
    layers: topBottom(),
    samples: [['Me waiting for my food delivery', 'Day 47'], ['Me waiting for the weekend', ''], ['Waiting for my friend', "who said 'five minutes'"]],
    motion: 'Leaves drift down; the character sighs slowly.',
  },
  handshake: {
    name: 'Handshake', cat: 'choice', about: 'Two sides agreeing on one thing', canvas: 'square', bg: '#111111', pic: [0, 0, 1, 1],
    shows: 'An epic, dramatic handshake: the character on the left and a made-up friend on the right clasp hands firmly in the middle, arms flexed like a '
      + 'heroic movie poster, dramatic lighting.',
    layers: [impact('On you (left)', 0.2, 0.66, 0.34, 0.15, 0.065), impact('On the friend (right)', 0.8, 0.66, 0.34, 0.15, 0.065),
      impact('On the handshake', 0.5, 0.3, 0.42, 0.15, 0.065)],
    samples: [['Me', 'My best friend', 'Ordering the same thing'], ['Morning people', 'Night owls', 'Loving coffee'], ['Cat people', 'Dog people', 'Loving naps']],
    motion: 'The two hands grip tighter; the light flickers dramatically.',
    cast: [{ id: 'friend', name: 'The friend (right)', says: 'the friend on the right, clasping hands with the character' }],
  },
  think: {
    name: 'Think about it', cat: 'reaction', about: 'Tapping the temple, very clever', canvas: 'square', bg: '#111111', pic: [0, 0, 1, 1],
    shows: 'The character close up, smiling knowingly and tapping one finger against their temple, as if sharing a brilliant idea.',
    layers: topBottom(),
    samples: [["Can't be late for work", 'If you work from bed'], ["Can't lose your keys", 'If you never leave the house'], ["Can't miss a call", 'If your phone is on silent']],
    motion: 'The character taps their temple and grins.',
  },
  win: {
    name: 'Small win', cat: 'reaction', about: 'A proud little fist pump', canvas: 'square', bg: '#111111', pic: [0, 0, 1, 1],
    shows: 'The character at a sunny beach, clenching one fist in a proud little victory pose, a determined, satisfied smile.',
    layers: topBottom(),
    samples: [['Woke up before my alarm', 'And felt great'], ['Found my headphones', 'In my own pocket'], ['Remembered why I walked in here', 'On the first try']],
    motion: 'The character pumps their fist; waves roll in behind.',
  },
  pain: {
    name: 'Smiling through it', cat: 'reaction', about: 'A polite smile hiding the pain', canvas: 'square', bg: '#111111', pic: [0, 0, 1, 1],
    shows: 'The character at a desk with a laptop and a cup of coffee, smiling politely at the camera with a tired, slightly pained look in the eyes.',
    layers: topBottom(),
    samples: [['When the meeting could have been an email', 'But you smile anyway'], ['Me hearing my own voice on video', ''],
      ['When someone spoils the ending', 'Thanks, I love that']],
    motion: 'The character holds the polite smile and blinks slowly.',
  },
  chaos: {
    name: 'Chaos smile', cat: 'reaction', about: 'A sly smile in front of a comic disaster', canvas: 'square', bg: '#111111', pic: [0, 0, 1, 1],
    shows: 'The character looks back at the camera with a sly little smile, while behind them a kitchen is a comic disaster: flour everywhere, a toppled cake, '
      + 'frosting on the walls (nobody hurt).',
    layers: topBottom(),
    samples: [['Me after a 5 minute recipe', 'It took 3 hours'], ['When you said you would help', 'And you did your best'], ['Cooking without the recipe', 'Confidence: high']],
    motion: 'Flour drifts in the air; the character smiles slyly.',
  },
  pointing: {
    name: 'Twins pointing', cat: 'panels', about: 'Two of you, pointing at each other', canvas: 'square', bg: '#111111', pic: [0, 0, 1, 1],
    shows: 'Two identical copies of the character, in the same outfit, stand face to face in a simple room and point at each other in surprise.',
    layers: [impact('Left', 0.27, 0.12, 0.46, 0.18, 0.07), impact('Right', 0.73, 0.12, 0.46, 0.18, 0.07)],
    samples: [['Me at 2 AM', 'Me at 2 PM'], ['Me telling you to sleep', 'Me not sleeping'], ['Me on a diet', 'Me at the bakery']],
    motion: 'Both copies point and lean in, surprised.',
    cast: [{
      id: 'other', name: 'Pointing back (right)', says: 'the one on the right, pointing back at the character in surprise',
      shows: 'The character, on the left, and another character, on the right, stand face to face in a simple room and point at each other in surprise.',
    }],
  },
  clown: {
    name: 'Clown makeup', cat: 'panels', about: 'Four steps of putting on clown makeup', canvas: 'square', bg: '#ffffff', pic: [0.5, 0, 0.5, 1], grid: [1, 4],
    shows: 'Four panels stacked, separated by thin lines, the same character in each facing the camera, putting on clown makeup step by step: first a little '
      + 'white face paint, second a red nose, third bright colorful face paint, fourth a full rainbow clown wig and a proud smile.',
    layers: rows(4),
    samples: [["I'll watch one episode", 'Okay, one more', "It's only 2 AM", "I'll sleep on the weekend"],
      ['I can carry all the bags', 'In one trip', 'Without help', "I'll be fine"]],
    motion: 'Each panel moves a little as the makeup goes on.',
    cast: [],
  },
  theydontknow: {
    name: "They don't know", cat: 'reaction', about: 'Alone in the corner of a party', canvas: 'square', bg: '#111111', pic: [0, 0, 1, 1],
    shows: 'At a lively house party, the character stands alone in the corner holding a cup of soda, smiling quietly to themselves, made-up party guests '
      + 'dancing blurred in the background.',
    layers: [tag('Their thought', 0.66, 0.14, 0.58, 0.2, 0.052)],
    samples: [["They don't know I ate a whole cake today"], ["They don't know I have a 6 hour nap planned"], ["They don't know I already picked the playlist"]],
    motion: 'The party lights flicker; the character sips their soda.',
    cast: [{ id: 'guest', name: 'A party guest', says: 'one of the party guests, dancing in the background' }],
  },
  cheers: {
    name: 'Cheers', cat: 'reaction', about: 'Raising a glass with a knowing smile', canvas: 'square', bg: '#111111', pic: [0, 0, 1, 1],
    shows: 'The character in elegant clothes at a glamorous party, raising a glass of sparkling juice toward the camera with a charming, knowing smile.',
    layers: topBottom(),
    samples: [['To everyone who replies right away', ''], ["Here's to the ones who bring snacks", ''], ['To the friends who send memes', 'Instead of texting']],
    motion: 'The character raises the glass a little higher and smiles.',
  },
  mocking: {
    name: 'Mocking', cat: 'reaction', about: 'A silly, teasing face', canvas: 'square', bg: '#111111', pic: [0, 0, 1, 1],
    shows: 'The character makes a silly mocking face: head tilted, eyes squinted, lips pushed out, as if teasingly imitating someone.',
    layers: topBottom().map((l) => ({ ...l, u: false })),
    samples: [["'We should hang out more'", "'wE sHoUlD hAnG oUt MoRe'"], ["'I'm almost there'", "'i'M aLmOsT tHeRe'"]],
    motion: 'The character bobs their head teasingly.',
  },
  exit: {
    name: 'Last-second exit', cat: 'choice', about: 'Swerving to the exit at the last second', canvas: 'square', bg: '#111111', pic: [0, 0, 1, 1],
    shows: 'Seen from behind and above, a small red car swerves suddenly from the straight highway lane toward an exit ramp on the right, the character '
      + 'leaning out of the window, excited; above the road a big blank green highway sign, its left half over the straight lane and its right half over the exit.',
    layers: [plain('Straight on', 0.33, 0.17, 0.28, 0.14, 0.042, { c: '#ffffff' }), plain('The exit', 0.71, 0.17, 0.28, 0.14, 0.042, { c: '#ffffff' }),
      impact('On the car', 0.55, 0.78, 0.32, 0.12, 0.05)],
    samples: [['Going to bed early', 'One more episode', 'Me'], ['Doing my homework', 'Rearranging my room', 'Me'], ['The healthy salad', 'The pizza place', 'Me']],
    motion: 'The car swerves toward the exit; the character cheers.',
    cast: [{ id: 'passenger', name: 'The passenger', says: 'the passenger sitting next to the character in the car, cheering too' }],
  },
};
export const TEMPLATE_IDS = Object.keys(TEMPLATES);
export const TEMPLATE_CATS = { classic: 'Classics', choice: 'Choices', reaction: 'Reactions', panels: 'Panels' };
export const templateOf = (id) => (typeof id === 'string' && Object.hasOwn(TEMPLATES, id) ? TEMPLATES[id] : null);

// ---------- someone else in it ("Add someone": another of their influencers, or AGI-1) ----------
// A template's roles for a second character: its id, its name on the page, and who that one is in the picture (says: the AI
// is told the other character is, or is put in as, "<says>"); shows: the whole picture told again with them in it, when the template's own
// words would leave them out (the twins). No roles said: someone beside the character. cast: [] means nobody else fits (the
// character alone in each panel). AGI-1, or another of the person's influencers, plays the role picked (none picked: its
// template's first role).
export const CAST_BESIDE = { id: 'beside', name: 'Beside them', says: 'the one right beside the character, sharing the same moment and the same mood' };
export const castOf = (tpl) => (Array.isArray(tpl?.cast) ? tpl.cast : [CAST_BESIDE]);
export const roleOf = (tpl, id) => castOf(tpl).find((r) => r.id === id) || null;

// ---------- its 5-second video ("Animate") ----------
// What moves when its picture comes to life (its words stay on top, drawn by us): its template's own, else this
export const MOTION_DEFAULT = 'The character moves a little, naturally: breathing, a blink, a small smile; the camera stays almost still.';
export const motionOf = (tpl) => (tpl && typeof tpl.motion === 'string' && tpl.motion ? tpl.motion : MOTION_DEFAULT);

// ---------- where the share mark goes ----------
// Downloads carry the share mark (server/inf-mark.js): on a meme it goes where it covers none of the words (a corner, else
// the middle of a side), worked out once when it's made (our server, with the fonts: server/meme-render.js markSpotFor) and
// kept with it (its row's mark_spot). A photo's mark is bottom right unless the words are there; a video's top left unless they are
// (TikTok's, Reels' and Shorts' own buttons sit at the bottom right).
export const MARK_RATIO = 108 / 506;   // the mark's picture (server/media/studio-mark.png): its height over its width
export const MARK_SPOTS = ['br', 'bl', 'tr', 'tl', 'mr', 'ml'];
export const MARK_PREFER = { photo: ['br', 'bl', 'tr', 'tl', 'mr', 'ml'], video: ['tl', 'tr', 'bl', 'ml', 'mr', 'br'] };
export const isMarkSpot = (s) => MARK_SPOTS.includes(s);
// The mark's box on a picture of W × H at a spot (as server/inf-mark.js markFor puts it) → { x, y, w, h } in its pixels
export function markBoxAt(W, H, spot) {
  const short = Math.max(1, Math.min(W, H));
  const w = Math.max(MARK_LOOK.MIN_W, Math.round(short * MARK_LOOK.SHARE));
  const h = Math.round(w * MARK_RATIO);
  const m = Math.round(short * MARK_LOOK.MARGIN);
  const x = spot[1] === 'l' ? m : Math.max(0, W - w - m);
  const y = spot[0] === 't' ? m : spot[0] === 'b' ? Math.max(0, H - h - m) : Math.round((H - h) / 2);
  return { x, y, w, h };
}
const overlap = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
// The first of these spots where the mark (and a little room around it) covers none of these boxes (the words: meme-layout.js
// wordBoxes), else the one where it covers the least
export function markSpot(boxes, W, H, prefer = MARK_PREFER.photo) {
  const gap = Math.round(Math.min(W, H) * 0.01);
  let best = prefer[0], least = Infinity;
  for (const spot of prefer) {
    const m = markBoxAt(W, H, spot);
    const room = { x: m.x - gap, y: m.y - gap, w: m.w + 2 * gap, h: m.h + 2 * gap };
    const cover = (boxes || []).reduce((a, b) => a + overlap(room, b), 0);
    if (cover === 0) return spot;
    if (cover < least) { least = cover; best = spot; }
  }
  return best;
}

// ---------- what the AI is asked for ----------
// The closest picture shape the picture model offers for the template's picture area (it's cut to fit: cover)
const RATIOS = [['1:1', 1], ['4:3', 4 / 3], ['3:4', 3 / 4], ['16:9', 16 / 9], ['9:16', 9 / 16], ['3:2', 3 / 2], ['2:3', 2 / 3], ['5:4', 5 / 4], ['4:5', 4 / 5]];
export function picBox(tpl) {
  const c = MEME_CANVAS[tpl.canvas];
  const [x, y, w, h] = tpl.pic;
  return { x: Math.round(x * c.w), y: Math.round(y * c.h), w: Math.round(w * c.w), h: Math.round(h * c.h) };
}
export function memeRatio(tpl) {
  const b = picBox(tpl);
  const want = b.w / b.h;
  return RATIOS.reduce((best, r) => (Math.abs(Math.log(r[1] / want)) < Math.abs(Math.log(best[1] / want)) ? r : best))[0];
}
// Its quality: Standard (1K) unless its picture area is big (a tall canvas: HD, 2K), so the picture is never blown up much
export const memeQuality = (tpl) => (Math.max(picBox(tpl).w, picBox(tpl).h) > 1200 ? 'hd' : 'std');
// its shape, as the photos' shapes say it
export const memeShape = (tpl) => (tpl.canvas === 'tall' ? 'tall' : 'square');

// ---------- its words ----------
const STRIP = new RegExp('[\\u200d\\ufe0e\\ufe0f\\u{1f3fb}-\\u{1f3ff}\\u{e0020}-\\u{e007f}]', 'gu');
const INVISIBLE = new RegExp('[\\u0000-\\u0009\\u000b-\\u001f\\u007f-\\u009f\\u00ad\\u200b\\u200c\\u200e\\u200f\\u2028-\\u202e\\u2060-\\u206f\\ufeff]', 'g');
// A layer's words, tidied: new lines kept (at most LAYERS.LINES_MAX, no empty ones), spaces collapsed, invisible characters
// gone, emoji joiners and skin tones taken off (a single emoji is drawn)
export function tidyText(s) {
  return String(s ?? '').normalize('NFKC').replace(/\r\n?/g, '\n').replace(STRIP, '').replace(INVISIBLE, ' ')
    .split('\n').map((l) => l.replace(/[ \t 　]+/g, ' ').trim()).filter(Boolean).join('\n');
}
export const upper = (t) => String(t).toLocaleUpperCase('en-US');
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : NaN);
const round4 = (v) => Math.round(v * 1e4) / 1e4;
const within = (v, [a, b]) => Number.isFinite(v) && v >= a && v <= b;

// A meme's layers, as sent: → { ok: true, layers } (tidied, each with only its own keys) or { ok: false, n (the layer, from 0),
// why: 'many' | 'empty' | 'long' | 'lines' | 'bad' }. The words' own rules (PG-13, never about money) are our server's
// (server/inf-words.js checkLayerWords), and whether every letter can be drawn (server/meme-render.js).
export function checkLayers(raw) {
  if (!Array.isArray(raw) || raw.length < 1) return { ok: false, n: 0, why: 'empty' };
  if (raw.length > LAYERS.MAX) return { ok: false, n: LAYERS.MAX, why: 'many' };
  const out = [];
  for (let n = 0; n < raw.length; n++) {
    const l = raw[n];
    if (!l || typeof l !== 'object' || Array.isArray(l)) return { ok: false, n, why: 'bad' };
    const t = tidyText(l.t);
    if (!t) return { ok: false, n, why: 'empty' };
    if ([...t].length > LAYERS.TEXT_MAX) return { ok: false, n, why: 'long' };
    if (t.split('\n').length > LAYERS.LINES_MAX) return { ok: false, n, why: 'lines' };
    const x = num(l.x), y = num(l.y), w = num(l.w), h = num(l.h), s = num(l.s);
    const c = String(l.c ?? '').toLowerCase(), o = String(l.o ?? '').toLowerCase(), b = String(l.b ?? '').toLowerCase();
    if (!within(x, [0, 1]) || !within(y, [0, 1]) || !within(w, LAYERS.W) || !within(h, LAYERS.H) || !within(s, LAYERS.S)
      || !Object.hasOwn(MEME_FONTS, l.f) || !HEX.test(c) || (o && !HEX.test(o)) || (b && !HEX.test(b)) || !ALIGN.has(l.a)
      || (l.u !== true && l.u !== false)) return { ok: false, n, why: 'bad' };
    out.push({ t, x: round4(x), y: round4(y), w: round4(w), h: round4(h), s: round4(s), f: l.f, c, o, b, a: l.a, u: l.u });
  }
  return { ok: true, layers: out };
}

// A template's own layers with these words (one per layer; an empty one leaves its layer out), each without its label
export function defaultLayers(tpl, texts = []) {
  const out = [];
  tpl.layers.forEach(({ label, ...l }, k) => {
    const t = tidyText(texts[k] ?? '');
    if (t) out.push({ ...l, t });
  });
  return out;
}
// A meme's words in one line each (its picture's alt words, our checks, the AI check's description)
// (cut by characters, as the database counts them (char_length), never in the middle of an emoji: a lone half of one isn't text)
export const layersCaption = (layers) => [...(layers || []).map((l) => String(l.t).replace(/\n/g, ' ')).join('\n')].slice(0, LAYERS.CAPTION_MAX).join('');
// one more layer of words, in the middle (the editor's "Add words")
export const newLayer = (t = '') => ({ t, x: 0.5, y: 0.5, w: 0.8, h: 0.16, s: 0.07, f: 'classic', c: '#ffffff', o: '#111111', b: '', a: 'c', u: true });

// ---------- its card's sketch (the template picker draws it) ----------
// → { w, h, pic: {x, y, w, h}, panels: [{x, y, w, h}], boxes: [{x, y, w, h, dark}] } in the canvas's pixels
export function templateSketch(tpl) {
  const c = MEME_CANVAS[tpl.canvas];
  const p = picBox(tpl);
  const [cols, rowsN] = tpl.grid || [1, 1];
  const panels = [];
  for (let r = 0; r < rowsN; r++) for (let k = 0; k < cols; k++) panels.push({ x: p.x + (k * p.w) / cols, y: p.y + (r * p.h) / rowsN, w: p.w / cols, h: p.h / rowsN });
  const boxes = tpl.layers.map((l) => ({ x: (l.x - l.w / 2) * c.w, y: (l.y - l.h / 2) * c.h, w: l.w * c.w, h: l.h * c.h, dark: l.c === '#111111' && !l.b, tag: Boolean(l.b) }));
  return { w: c.w, h: c.h, bg: tpl.bg, pic: p, panels, boxes };
}
