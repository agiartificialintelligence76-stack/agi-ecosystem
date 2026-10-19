// The roadmap's video: every word on screen, and the post to go with it. The roadmap's own words are its page's
// (roadmap.html), word for word: tests/roadmap-promo.test.js checks each one is on the page, so the video says what the
// page says (change a step there and the test asks for the same change here). Pure.
// Its rules (the owner's, the site's): coming soon is a plan, never an offer: no rate, APY, amount, date or guarantee,
// never "buy"; "not financial advice" wherever money comes up, and 18+ where money is at stake; buybacks and burns are
// never a promise about price; PG-13; only $AGI (USDG and sAGI are the page's own words for how staking will pay); AGI-1
// only as her 2D self; never CloakMesh; never an AI service's name. And (2026-10-19, the owner: "say the roadmap is not
// in order, we could do other things first") its steps are numbered, never ordered: "in no particular order".
export const SITE = 'agi1.app/roadmap';
export const HANDLE = '@agi1dotapp';

// ---------- 1. title (the page's hero) ----------
export const TITLE = {
  kicker: 'Roadmap · October 2026',
  words: ['The', 'AGI', 'roadmap'],
  sub: "What's live today, and what's coming next.",
};

// ---------- the road's ten stops (the page's timeline) ----------
// `state`: live, going (under way), soon or locked, as the page marks them. `line`: the page's own sentence (or its
// start, as the card has room for), `more`: its next sentence, `meta`: the page's line under it
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
    n: '04', state: 'going', status: 'Under way', name: 'AGI games', icon: 'games',
    line: "The beta is out: play Ride 'Em, AGI! free, no wallet needed.",
    more: 'Next: earn $AGI while you play.',
    meta: "beta: free, no prizes yet · earning: coming soon · not financial advice · 18+, only where it's legal",
  },
  {
    n: '05', state: 'going', status: 'Under way', name: 'Buybacks, burns, marketing & listings', icon: 'flame',
    line: '$AGI is already burned for messages with AGI-1 and for unlocks in AGI Studio',
    meta: 'burns: live now · buybacks and listings: coming soon · never a promise about price · not financial advice',
  },
  {
    n: '06', state: 'going', status: 'Under way', name: 'Attention flywheel', icon: 'cycle',
    line: 'Everything people make and play with AGI brings more people in, and they make and play too.',
    meta: 'about people, not price · not financial advice',
  },
  {
    n: '07', state: 'soon', status: 'Coming soon', name: 'Gamified governance', icon: 'governance',
    line: 'Help decide what AGI does next, starting with this roadmap.',
    meta: 'coming soon · a free signature, never a transaction · badges are for fun, never money',
  },
  {
    n: '08', state: 'soon', status: 'Coming soon', name: 'AUM', icon: 'aum',
    line: 'Assets under management: AGI-1 learns to manage a wallet, out in the open.',
    meta: "coming soon · never anyone else's money · not advice to copy · not financial advice",
  },
  {
    n: '09', state: 'soon', status: 'Coming soon', name: 'Giveaways', icon: 'gift',
    line: 'Win giveaways by creating viral content for AGI.',
    meta: 'coming soon · not financial advice · 18+',
  },
  {
    n: '10', state: 'locked', status: 'Locked', name: '18+', mystery: '???', icon: 'lock',
    line: 'Locked. No details yet.',
    meta: 'coming soon',
  },
];
export const LABELS = { live: 'Live now', here: "We're here", next: "What's next" };
// the page's note under "What's next" (the owner: "say the roadmap is not in order")
export const NOTE = 'In no particular order: any of these could come first.';
// stamped on each step after "We're here", as the page marks it
export const STAMPS = { soon: 'Coming soon', going: 'Under way' };
// the page's meter: "2 of 10", "live now · 3 under way · 5 coming soon"
export const METER = { n: '2', of: 'of 10', text: 'live now · 3 under way · 5 coming soon' };
// her line on the page, next to her face
export const SAY = "two live, eight on the way. i'm a little excited 💜";
// on screen from "What's next" to the whole road (bottom left)
export const SAFETY = 'Coming soon · not financial advice · 18+';

// ---------- the end card ----------
export const END = {
  kicker: 'The AGI roadmap',
  sub: 'Be the first to know.',
  follow: `Follow ${HANDLE}`,
  fine: [
    'Coming soon, in no particular order · no dates are promised · Not financial advice',
    "Rewards and prizes are never guaranteed and never an investment · 18+, only where it's legal",
  ],
};

// ---------- her voice (the owner's "Music + AGI-1's voice") ----------
// what AGI-1 says over its music, in time order (timeline.js VOICE says where): short lines, the words on screen as they
// are. Her takes are her own voice, the site's (made in Google AI Studio with the owner's account), saying exactly these
// words; `said`: how she says one that isn't read as it's written. (Her "Staking, games and giveaways are next." went
// with the roadmap's new steps, 2026-10-19: it named an order, and the roadmap has none.)
export const VOICE = [
  { id: 'title', text: 'This is the AGI roadmap.' },
  { id: 'live', text: 'Two are live: me and AGI Studio.' },
  { id: 'secret', text: 'And one more… that\'s a secret.', said: "And one more... that's a secret." },
];

// the post to go with it (the owner posts it, by hand): under 280 characters as X counts them
export const POST = `The AGI roadmap 💜 In no particular order:\n\nLive now: AGI-1, AGI Studio\nUnder way: AGI games, burns & buybacks, attention flywheel\nComing soon: staking, governance, AUM, giveaways + one more 🔒\n\nhttps://${SITE}\n\nnot financial advice · never a promise about price · 18+`;

// every word the video shows (the tests read it)
export function allWords() {
  const out = [];
  const walk = (v) => {
    if (typeof v === 'string') out.push(v);
    else if (typeof v === 'number') out.push(String(v));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk([SITE, HANDLE, TITLE, STEPS, LABELS, NOTE, STAMPS, METER, SAY, SAFETY, END, VOICE, POST]);
  return out;
}
