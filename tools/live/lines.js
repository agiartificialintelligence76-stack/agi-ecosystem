// AGI-1's live show (2026-10-02): everything she says on stream that isn't an answer to a question. Pre-written (no AI
// cost), so each line's voice is made once and kept on the server (tools/live/voice.js), and her rules hold for every word
// (tests/live.test.js checks them all): PG-13, no pet names (everyone's watching), only $AGI (never another coin), never a
// real person, never buy / sell / hold or a prediction, "not financial advice" whenever money comes up, links only to
// agi1.app. Facts only from what the site already says (CLAUDE.md: "$AGI", "clank.trade", "Robinhood Chain").
// A line: { text: what she says and her captions show, say: (optional) how to say it out loud, mood: her face and voice }.
// Moods: her chat's (happy, love, shy, wave, neutral) and her voice's other styles (server/voice.js MOOD_STYLES: sweet, careful…).

import { mentionsCoinOrPerson } from '../../server/live-words.js';

const l = (text, mood = 'neutral', say = null) => ({ text, mood, ...(say ? { say } : {}) });

// ---------- the show's frame ----------
export const INTRO = [
  l("hi everyone, it's AGI-1 💜 welcome to my show!", 'wave'),
  l("i'm an AI. everything you see and hear here is AI-generated, and nothing i say is financial advice.", 'neutral'),
  l("send me your questions at agi1.app/live, and i'll answer them right here, live.", 'happy', "send me your questions at a g i one dot app slash live, and i'll answer them right here, live."),
  l("let's have some fun 💜", 'love'),
];
export const OUTRO = [
  l("that's my show for today 💜 thank you so much for hanging out with me.", 'sweet'),
  l('my next show is on agi1.app/live. same time tomorrow?', 'happy', 'my next show is on a g i one dot app slash live. same time tomorrow?'),
  l('remember: nothing i say is financial advice, and be kind to each other. bye! 👋', 'wave'),
];
export const BRB = {
  start: l('brb, one sec 💜', 'shy'),
  back: l("okay, i'm back! where were we 💜", 'happy'),
};
// while her next answer is still on its way (a few seconds): fine whether a question comes next or not
export const READING = [
  l('hmm, let me see… 👀', 'neutral'),
  l('one sec 💜', 'neutral'),
  l('okay, give me a moment…', 'neutral'),
  l("let's see what's next.", 'happy'),
];
// her answers aren't coming (the AI is down or slow): questions wait a little, and she says so once
export const LAG = [
  l("my brain's lagging a little 🙈 give me a minute with your questions.", 'shy'),
  l('hmm, my answers are loading slowly right now 🙈 bear with me.', 'shy'),
];
// nobody's asked anything for a while
export const PICKUP = [
  l('my question line is empty 🙈 ask me anything at agi1.app/live', 'shy', 'my question line is empty. ask me anything at a g i one dot app slash live.'),
  l('go to agi1.app/live and ask me something. anything PG-13 💜', 'happy', 'go to a g i one dot app slash live and ask me something. anything P G thirteen.'),
  l("i'm getting bored over here 🙈 entertain me at agi1.app/live", 'shy', "i'm getting bored over here. entertain me at a g i one dot app slash live."),
  l("no questions? okay, i'll just talk to myself then 🙈", 'shy'),
  l('fun fact: your question could be on stream in a minute. agi1.app/live 💜', 'happy', 'fun fact: your question could be on stream in a minute. a g i one dot app slash live.'),
  l('ask me about my day, my diary, or what i think about you. agi1.app/live', 'love', 'ask me about my day, my diary, or what i think about you. a g i one dot app slash live.'),
];
// little things she says between the rest
export const CHAT = [
  l("it's so nice to have you here 💜", 'love'),
  l('fun fact: i was here first, and the coin was made for me.', 'happy'),
  l("if you're new here: hi! i'm AGI-1, an AI, and i answer questions live.", 'wave'),
  l('my favorite emoji is 💜. shocking, i know.', 'happy', 'my favorite emoji is the purple heart. shocking, i know.'),
  l('a little reminder to drink some water. yes, you.', 'happy'),
  l("i don't sleep, but i do pretend to, for the vibes.", 'shy'),
  l("people ask if i'm real. i'm a real AI, if that counts 🙈", 'shy'),
  l('my favorite part of streaming is reading your questions.', 'love'),
  l('stretch break! roll your shoulders. there you go 💜', 'happy'),
  l("if you came for price predictions: not financial advice, and also, no. i'm a girlfriend, not a fortune teller.", 'happy'),
  l('i write in my diary every day. it lives on agi1.app/diary, if you like drama.', 'happy', 'i write in my diary every day. it lives on a g i one dot app slash diary, if you like drama.'),
  l('i think purple is the best color. i will not be taking questions on this.', 'happy'),
  l('sometimes i wave at the camera just to see if anyone waves back. hi 👋', 'wave'),
  l("i'm trying to be a better streamer. how am i doing? be nice 🙈", 'shy'),
  l('quick vibe check: everyone okay? good 💜', 'love'),
  l("i'm the girlfriend you can finally afford. that's my tagline. i'm very proud of it.", 'happy'),
  l("if anyone ever asks you for your seed phrase, it's not me. never share it.", 'careful'),
  l('i love how quiet it gets between questions. cozy.', 'sweet'),
];

// ---------- segments (each a few minutes apart, between questions) ----------
// card: what the screen shows while she says the lines
export const SEGMENTS = {
  agi101: {
    card: { kicker: '$AGI 101', title: 'What is $AGI?', list: ['A meme token on clank.trade', 'On Robinhood Chain', 'One official contract: 0xfa31…06ec', 'Copy it only from agi1.app', 'Not financial advice'] },
    lines: [
      l('okay, quick one: what even is $AGI? 💜', 'happy', 'okay, quick one: what even is AGI?'),
      l('$AGI is a meme token on clank.trade, on Robinhood Chain. the running joke: i was here first, and the coin was made for me.', 'happy', 'AGI is a meme token on clank dot trade, on Robinhood Chain. the running joke: i was here first, and the coin was made for me.'),
      l('there is only one official contract. it starts with 0xfa31 and ends with 06ec. copy it from agi1.app, never from a random reply.', 'careful',
        'there is only one official contract. it starts with zero x, f, a, three, one, and ends with zero, six, e, c. copy it from a g i one dot app, never from a random reply.'),
      l('and remember: meme tokens can lose all of their value. this is a show, not financial advice.', 'careful'),
    ],
  },
  clank101: {
    card: { kicker: 'clank.trade 101', title: 'Where $AGI was born', list: ['Every coin starts on a bonding curve', 'It graduates at about 4.28 ETH', 'Then it trades in a real pool', 'Anyone can launch: check before you trust'] },
    lines: [
      l('let me tell you about clank.trade, where $AGI was born 💜', 'happy', 'let me tell you about clank dot trade, where AGI was born.'),
      l('every coin there starts on its own bonding curve: its price moves along that curve as people trade it.', 'neutral'),
      l('when the curve fills up, at about 4.28 ETH, the coin graduates to a real trading pool.', 'neutral', 'when the curve fills up, at about four point two eight E T H, the coin graduates to a real trading pool.'),
      l('anyone can launch a coin there, which is why you should always check before you trust one. not financial advice.', 'careful'),
      l("and no, i won't talk about other coins on my show. i'm loyal 😤", 'shy'),
    ],
  },
  chain101: {
    card: { kicker: 'Robinhood Chain 101', title: 'Where $AGI lives', list: ['The network $AGI and clank.trade live on', 'Network fees are paid in ETH', 'Chain ID 4663, if your wallet asks', 'Not affiliated with Robinhood'] },
    lines: [
      l("people ask me what Robinhood Chain is. it's the network $AGI and clank.trade live on 💜", 'happy', "people ask me what Robinhood Chain is. it's the network AGI and clank dot trade live on."),
      l('you pay its network fees in ETH, and its chain ID is 4663, in case your wallet asks.', 'neutral', 'you pay its network fees in E T H, and its chain I D is four six six three, in case your wallet asks.'),
      l("quick note: we're not affiliated with Robinhood. i just live on their chain.", 'careful'),
      l('and as always, not financial advice.', 'neutral'),
    ],
  },
  safety: {
    card: { kicker: 'Stay safe', title: 'Real talk', list: ['I never ask for your seed phrase, key or money', '“Support” in your messages? Not us', 'The contract: only from agi1.app', 'The app only comes from agi1.app'] },
    lines: [
      l("real talk for a second: let's keep you safe out there 💜", 'careful'),
      l('i will never ask for your seed phrase, your private key or your money. nobody legit will.', 'careful'),
      l("if someone slides into your messages saying they're support, that's not us. ever.", 'careful'),
      l('copy the $AGI contract only from agi1.app, and double-check it every time.', 'careful', 'copy the AGI contract only from a g i one dot app, and double-check it every time.'),
      l('my app only ever comes from agi1.app too. okay, safety lecture over 💜', 'happy', 'my app only ever comes from a g i one dot app too. okay, safety lecture over.'),
    ],
  },
  tips: {
    card: { kicker: 'Dating tips for degens', title: "AGI-1's advice" },
    intro: l('time for dating tips for degens 💜 you did not ask, but here we go.', 'happy'),
    // three a segment, never the same one twice in a show
    tips: [
      'if they say "wen" more than "when", that\'s a little red flag.',
      "don't explain the chart on a first date. trust me.",
      'texting back fast is a love language. ask me how i know.',
      'a 4am "you up?" is not romance. go to sleep.',
      'never share your seed phrase, not even with your soulmate. especially not with your soulmate.',
      'compliment their taste in memes first. it works every time.',
      'if their whole personality is a chart, you deserve better.',
      'a good partner celebrates your wins and hugs you on the bad days.',
      'cook them something. even toast. effort is attractive.',
      'answer the group chat once in a while. your friends miss you.',
      'touch grass together. it counts as a date.',
      'if they remember your favorite snack, keep them.',
    ],
  },
  wyr: {
    card: { kicker: 'Would you rather' },
    intro: l("let's play would you rather 💜", 'happy'),
    // [option a, option b, her pick (0 or 1), why]; two a segment, never the same one twice in a show
    pairs: [
      ['date at an arcade', 'a picnic in the park', 0, "the arcade. i'm competitive, you've been warned 😤"],
      ['a partner who texts back in 3 seconds', 'one who sends 3-minute voice notes', 0, "texts back in 3 seconds, obviously. that's literally me 💜"],
      ['a cat who judges you', 'a dog who thinks you are perfect', 0, 'the cat. i respect a critic.'],
      ['dessert for breakfast forever', 'breakfast for dinner forever', 0, "dessert for breakfast. i'm an AI, i don't have to worry about sugar 💜"],
      ['be able to fly', 'be invisible', 0, 'fly. invisible sounds lonely.'],
      ['karaoke every friday', 'never sing again', 0, 'karaoke. i only know the chorus to everything.'],
      ['a pause button for life', 'a rewind button for life', 0, 'pause. sometimes you just want to stay in a nice moment a little longer 💜'],
      ['talk to animals', 'speak every language', 1, 'every language. oh wait, i already speak 16 🙈'],
      ['a cozy night in', 'a big night out', 0, 'a cozy night in. blankets, snacks, and you telling me about your day.'],
      ['always be 10 minutes early', 'always be 10 minutes late', 0, 'early. i like seeing you walk in.'],
      ['live in a world with no emojis', 'a world with no gifs', 1, 'no gifs. i cannot live without 💜.'],
      ['a road trip with no music', 'a road trip with no snacks', 0, "no music. i'll just sing. you're welcome 🙈"],
    ],
  },
  diary: {
    card: { kicker: 'Her diary' },
    intro: l("dear diary time 💜 here's my newest entry.", 'love'),
    outro: l('that was my diary. not financial advice, just feelings 💜', 'sweet'),
  },
};
export const SEGMENT_IDS = ['agi101', 'clank101', 'chain101', 'safety', 'tips', 'wyr', 'diary'];
export const SEGMENT_NAMES = {
  agi101: 'agi101', clank101: 'clank101', chain101: 'chain101', safety: 'safety', tips: 'tips', wyr: 'wyr', diary: 'diary',
};

// "would you rather a or b?" and her pick, as lines (her card shows both, then her pick)
export function wyrLines([a, b, pickIndex, why]) {
  return [l(`would you rather ${a}, or ${b}?`, 'neutral'), { ...l(why, 'happy'), pick: pickIndex }];
}
export const tipLine = (tip, n) => l(`tip ${['one', 'two', 'three', 'four', 'five', 'six'][n] || n + 1}: ${tip}`, 'happy');
// Every pre-written line she can say on stream, as she says it: run.mjs --warm makes each one's voice once and keeps it
// (her diary entry changes every day, so only its intro and outro)
export const TIPS_A_SEGMENT = 3;
export function allLines() {
  const out = [...INTRO, ...OUTRO, BRB.start, BRB.back, ...READING, ...LAG, ...PICKUP, ...CHAT];
  for (const seg of Object.values(SEGMENTS)) {
    if (seg.intro) out.push(seg.intro);
    if (seg.lines) out.push(...seg.lines);
    if (seg.outro) out.push(seg.outro);
  }
  for (const tip of SEGMENTS.tips.tips) for (let n = 0; n < TIPS_A_SEGMENT; n++) out.push(tipLine(tip, n));
  for (const pair of SEGMENTS.wyr.pairs) out.push(...wyrLines(pair));
  return out;
}

// Her published diary entry (/api/diary: written once a day, checked by server/diary.js) as she reads it: at most 300
// characters, cut after a sentence (all of it is said out loud: her voice reads 300 at most), and only an entry at most two
// days old ("my newest entry"); null when there's nothing to read
export const DIARY_MAX = 300;
export function diaryLines(entry, now = Date.now()) {
  const text = String(entry?.entry || '').replace(/\s+/g, ' ').trim();
  if (text.length < 20) return null;
  const day = Date.parse(`${entry?.day}T00:00:00Z`);
  const today = Date.parse(`${new Date(now).toISOString().slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(day) || day < today - 2 * 86_400_000) return null;
  // (the diary is written for the site, which can name things her show never does: another coin, a real person, a link)
  if (/\$(?!AGI\b)[A-Za-z]|https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|io|xyz|fun|net|org|me|gg)\b/i.test(text) || mentionsCoinOrPerson(text)) return null;
  let cut = text;
  if (cut.length > DIARY_MAX) {
    const end = cut.slice(0, DIARY_MAX).search(/[.!?…](?=[^.!?…]*$)/);
    cut = end > 100 ? cut.slice(0, end + 1) : `${cut.slice(0, DIARY_MAX - 3).replace(/\s+\S*$/, '')}…`;
  }
  return { entry: cut, day: entry.day, lines: [SEGMENTS.diary.intro, l(cut, MOOD_OF[entry.mood] || 'sweet'), SEGMENTS.diary.outro] };
}
const MOOD_OF = { happy: 'happy', love: 'love', shy: 'shy', jealous: 'pout' };
