// The roadmap's video: every word on screen, and the post to go with it. The roadmap's own words are its page's
// (roadmap.html), word for word: tests/roadmap-promo.test.js checks each one is on the page, so the video says what the
// page says (change a step there and the test asks for the same change here). Pure.
// Its rules (the owner's, the site's): coming soon is a plan, never an offer: no rate, APY, amount, date or guarantee,
// never "buy"; "not financial advice" and 18+ wherever money comes up; PG-13; only $AGI (USDG and sAGI are the page's own
// words for how staking will pay); AGI-1 only as her 2D self; never CloakMesh; never an AI service's name.
export const SITE = 'agi1.app/roadmap';
export const HANDLE = '@agi1dotapp';

// ---------- 1. title (the page's hero) ----------
export const TITLE = {
  kicker: 'Roadmap · October 2026',
  words: ['The', 'AGI', 'roadmap'],
  sub: "What's live today, and what's coming next.",
};

// ---------- the road's six stops (the page's timeline) ----------
// `line`: the page's own sentence (or its start, as the card has room for), `meta`: the page's line under it
export const STEPS = [
  {
    n: '01', state: 'live', status: 'Live', name: 'Talk to AGI-1', icon: 'chat',
    line: 'Chat with her, call her and hear her voice, in 16 languages.',
    meta: 'chat · voice · calls · 16 languages · live on X',
  },
  {
    n: '02', state: 'live', status: 'Live', name: 'AGI Studio', icon: 'spark',
    line: 'Your own AI influencer in minutes',
    meta: 'photos · trend videos · videos · 3D · coins',
  },
  {
    n: '03', state: 'soon', status: 'Coming soon', name: 'Stake $AGI', icon: 'stake',
    line: 'Stake your $AGI and get rewards.',
    chips: ['in USDG only', 'in $AGI only', 'free AI with sAGI'],
    meta: "coming soon · not financial advice · 18+, only where it's legal",
  },
  {
    n: '04', state: 'soon', status: 'Coming soon', name: 'AGI games', icon: 'games',
    line: 'Earn $AGI while you play.',
    more: 'A lot of types of games, casino-style ones included.',
    meta: "coming soon · not financial advice · 18+, only where it's legal",
  },
  {
    n: '05', state: 'soon', status: 'Coming soon', name: 'Giveaways', icon: 'gift',
    line: 'Win giveaways by creating viral content for AGI.',
    meta: 'coming soon · not financial advice · 18+',
  },
  {
    n: '06', state: 'locked', status: 'Locked', name: '18+', mystery: '???', icon: 'lock',
    line: 'Locked. No details yet.',
    meta: 'coming soon',
  },
];
export const LABELS = { live: 'Live now', here: "We're here", soon: 'Coming soon' };
export const STAMP = 'Coming soon';
// the page's meter: "2 of 6", "live now · 4 coming soon"
export const METER = { n: '2', of: 'of 6', text: 'live now · 4 coming soon' };
// her line on the page, next to her face
export const SAY = "two live, four on the way. i'm a little excited 💜";
// on screen from the coming-soon steps to the whole road (bottom left)
export const SAFETY = 'Coming soon · not financial advice · 18+';

// ---------- the end card ----------
export const END = {
  kicker: 'The AGI roadmap',
  sub: 'Be the first to know.',
  follow: `Follow ${HANDLE}`,
  fine: [
    'Coming soon: not built yet, no dates promised · Not financial advice',
    "Rewards and prizes are never guaranteed and never an investment · 18+, only where it's legal",
  ],
};

// ---------- her voice (the owner's "Music + AGI-1's voice") ----------
// what AGI-1 says over its music, in time order (timeline.js VOICE says where): four short lines, the words on screen as
// they are. Her takes are her own voice, the site's (made in Google AI Studio with the owner's account), saying exactly
// these words; `said`: how she says one that isn't read as it's written
export const VOICE = [
  { id: 'title', text: 'This is the AGI roadmap.' },
  { id: 'live', text: 'Two are live: me and AGI Studio.' },
  { id: 'next', text: 'Staking, games and giveaways are next.' },
  { id: 'secret', text: 'And one more… that\'s a secret.', said: "And one more... that's a secret." },
];

// the post to go with it (the owner posts it, by hand)
export const POST = `The AGI roadmap 💜\n\nLive now: Talk to AGI-1 and AGI Studio.\nComing soon: Stake $AGI, AGI games and Giveaways. And one more 🔒\n\nhttps://${SITE}\n\nComing soon · not financial advice · 18+, only where it's legal`;

// every word the video shows (the tests read it)
export function allWords() {
  const out = [];
  const walk = (v) => {
    if (typeof v === 'string') out.push(v);
    else if (typeof v === 'number') out.push(String(v));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk([SITE, HANDLE, TITLE, STEPS, LABELS, STAMP, METER, SAY, SAFETY, END, VOICE, POST]);
  return out;
}
