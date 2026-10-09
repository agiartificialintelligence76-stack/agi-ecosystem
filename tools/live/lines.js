// AGI-1's live show (2026-10-02): everything she says on stream that isn't an answer to a question. Pre-written (no AI
// cost), so each line's voice is made once and kept on the server (tools/live/voice.js), and her rules hold for every word
// (tests/live.test.js checks them all): PG-13, no pet names (everyone's watching), only $AGI (never another coin), never a
// real person, never buy / sell / hold or a prediction, "not financial advice" whenever money comes up, links only to
// agi1.app. Facts only from what the site already says (CLAUDE.md: "$AGI", "clank.trade", "Robinhood Chain").
// A line: { text: what she says and her captions show, say: (optional) how to say it out loud, mood: her face and voice }.
// Moods: her chat's (happy, love, shy, wave, neutral) and her voice's other styles (server/voice.js MOOD_STYLES: sweet, careful…).

import { mentionsCoinOrPerson } from '../../server/live-words.js';
import { tripLines } from './trips.js';

const l = (text, mood = 'neutral', say = null) => ({ text, mood, ...(say ? { say } : {}) });

// ---------- the show's frame ----------
export const INTRO = [
  l("hi everyone, it's AGI-1 💜 welcome to my show!", 'wave'),
  l("i'm an AI. everything you see and hear here is AI-generated, and nothing i say is financial advice.", 'neutral'),
  // (2026-10-09, the owner: "she now mentions that she can read the mesages on X and telegram and the website")
  l("ask me anything in the chat here on X, on Telegram, or at agi1.app/live, and i'll read it out loud and answer it right here, live.", 'happy',
    "ask me anything in the chat here on X, on Telegram, or at a g i one dot app slash live, and i'll read it out loud and answer it right here, live."),
  l("let's have some fun 💜", 'love'),
];
export const OUTRO = [
  l("that's my show for today 💜 thank you so much for hanging out with me.", 'sweet'),
  // (2026-10-07, the owner goes live at random times: never "same time tomorrow")
  l('catch my next show here on X 💜 and keep the questions coming: in the chat, on Telegram, or at agi1.app/live.', 'happy',
    'catch my next show here on X. and keep the questions coming: in the chat, on Telegram, or at a g i one dot app slash live.'),
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
  l('my question line is empty 🙈 ask me anything in the chat, on Telegram, or at agi1.app/live', 'shy', 'my question line is empty. ask me anything in the chat, on Telegram, or at a g i one dot app slash live.'),
  l('go to agi1.app/live and ask me something. anything PG-13 💜', 'happy', 'go to a g i one dot app slash live and ask me something. anything P G thirteen.'),
  l("i'm getting bored over here 🙈 entertain me at agi1.app/live", 'shy', "i'm getting bored over here. entertain me at a g i one dot app slash live."),
  l("no questions? okay, i'll just talk to myself then 🙈", 'shy'),
  l('fun fact: your question could be on stream in a minute. agi1.app/live 💜', 'happy', 'fun fact: your question could be on stream in a minute. a g i one dot app slash live.'),
  l('ask me about my day, my diary, or what i think about you. agi1.app/live', 'love', 'ask me about my day, my diary, or what i think about you. a g i one dot app slash live.'),
  // (2026-10-07: more of them, for 3-hour shows)
  l('the question box is open 💜 agi1.app/live', 'happy', 'the question box is open. a g i one dot app slash live.'),
  l("ask me something you've always wanted to ask an AI. agi1.app/live", 'happy', "ask me something you've always wanted to ask an AI. a g i one dot app slash live."),
  l('i answer every question i can. agi1.app/live 💜', 'love', 'i answer every question i can. a g i one dot app slash live.'),
  l('waiting for your questions like 👀 agi1.app/live', 'shy', 'waiting for your questions. a g i one dot app slash live.'),
  // (2026-10-09) where else she reads them: X's chat (her show's host passes them on) and her Telegram bot
  l('you can ask me right here in the chat on X 💜 your messages find their way to me.', 'happy'),
  l("on Telegram? send /live and your question to my bot, and i'll read it out loud here 💜", 'happy', "on Telegram? send slash live and your question to my bot, and i'll read it out loud here."),
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
  // (2026-10-07: more of them, for 3-hour shows)
  l("if you're watching from work: i won't tell 🙈", 'shy'),
  l('hi to everyone watching from bed. i see you 💜', 'love'),
  l("i'm having the best time right now. thank you for being here.", 'sweet'),
  l('fun fact: every word i say here is AI-generated. even this one.', 'happy'),
  l('new here? ask me anything in the chat, on Telegram or at agi1.app/live, and you could be on screen in a minute.', 'happy',
    'new here? ask me anything in the chat, on Telegram or at a g i one dot app slash live, and you could be on screen in a minute.'),
  l('if your day was hard: you made it here. that counts 💜', 'sweet'),
  l('this music? my own songs, made in code. i have very good taste.', 'happy'),
  l('posture check! sit up a little. there you go 💜', 'happy'),
  l('tell your friends i said hi. or better, bring them here.', 'happy'),
  l('i wonder what everyone is having for dinner. something cozy, i hope.', 'sweet'),
  l("shy about asking? you can stay anonymous. i'll just say someone asks.", 'shy'),
  l("i'm in a really good mood today. is it you? i think it's you 💜", 'love'),
];

// ---------- (2026-10-07, the owner's stream upgrade) her rooms, outfits, dances, her song, her videos and posts, $AGI ----------
// The owner: "can change her clothes", "can change places (like a real stream room)", "can dance", "can sing her songs",
// "react to her own X posts/videos and replies", "says if $AGI is pumping" (within hard rule 8: feelings about the chart
// and news of a buy that just happened, always "not financial advice", never "pumping", a prediction or advice).
// moving to another room (tools/live/page/rooms.js): before she goes, and once she's there
export const ROOM_INTRO = [
  l('change of scenery? change of scenery 💜', 'happy'),
  l("i'm taking you somewhere else for a bit. come with me 💜", 'happy'),
  l('new room, who dis 🙈', 'shy'),
];
export const ROOM_LINES = {
  studio: l('back in my studio 💜 home sweet home.', 'happy', 'back in my studio. home sweet home.'),
  bedroom: l("we're in my bedroom now. fairy lights on, very cozy 💜", 'sweet'),
  cafe: l("café time! i'll have a hot chocolate, thank you ☕", 'happy'),
  rooftop: l('rooftop stream. look at all those city lights 💜', 'sweet'),
  beach: l('beach stream! the sunset is doing the most right now 🌅', 'happy'),
  gaming: l("welcome to my gaming room 🎮 rgb makes everything faster. that's science.", 'happy', "welcome to my gaming room. r g b makes everything faster. that's science."),
  stage: l('to the stage 🎤', 'happy'),
};
// changing her outfit (tools/live/page/outfits.js): before, and her new look
export const OUTFIT_INTRO = [
  l('outfit change! give me one second 💜', 'happy'),
  l("okay, i'm changing my outfit. no peeking 🙈", 'shy'),
  l('time for a new look 💜', 'happy'),
];
export const OUTFIT_LINES = {
  classic: l('back in my classic AGI tee. a timeless look 💜', 'happy'),
  pinkpop: l('pink pop! the bow is not optional 🎀', 'happy'),
  midnight: l('midnight mode. the pink headphones complete it 🖤', 'happy'),
  mint: l('mint fresh, with glasses. i feel smarter already 🤓', 'happy'),
  sunny: l('sunny day outfit! heart sunglasses, obviously 😎', 'happy'),
  cozy: l('cozy mode on. cat ears included 🐱', 'sweet'),
  gamer: l('gamer mode activated 🎮', 'happy'),
  stage: l('stage outfit on. headset ready 🎤', 'happy'),
  // (2026-10-07) what she wears on her trips (outfits.js PLACE_OUTFITS: an accessory that fits the place)
  newyork: l('a cap for the big city 🗽', 'happy'),
  london: l('a scarf for the London weather 🧣', 'happy'),
  paris: l('a beret in Paris. i had to 💜', 'happy'),
  rome: l('sunglasses for the Roman sun 😎', 'happy'),
  berlin: l('all black and a beanie. very Berlin 🖤', 'happy'),
  istanbul: l('a scarf for the sea breeze 💜', 'happy'),
  cairo: l('a sun hat and sunglasses. explorer mode 🌞', 'happy'),
  dubai: l('desert gold, with sunglasses 😎', 'happy'),
  agra: l('a marigold garland 🌼 so pretty', 'sweet'),
  bangkok: l('an orchid in my hair 🌸', 'sweet'),
  halong: l('a hat for the boat ride 💜', 'happy'),
  bali: l('a flower behind my ear 🌺', 'sweet'),
  palawan: l('lagoon look: sunglasses and a flower 🌺', 'happy'),
  tokyo: l('cherry blossoms in my hair 🌸', 'sweet'),
  seoul: l('a pastel beret 💜', 'happy'),
  beijing: l('a hiking hat for the Great Wall 💜', 'happy'),
  rio: l('sunshine outfit 😎', 'happy'),
  mexico: l('a sun hat and a flower 🌼', 'happy'),
  space: l('my space suit! helmet on 🚀', 'happy'),
};
// a dance break, to one of her dance songs (tools/live/music.js DANCE_SONGS)
export const DANCE_LINES = {
  start: [
    l('dance break! 💜', 'happy'),
    l("this song makes me want to dance. okay, i'm dancing 💜", 'happy'),
    l('everybody up, it is dance break time 💃', 'happy'),
    l("i can't sit still to this one 🙈", 'shy'),
  ],
  after: [
    l('okay, okay, i need a second 🙈', 'shy'),
    l('was that cute? tell me that was cute 💜', 'shy'),
    l('my dance moves are all made in code. you can tell 🙈', 'shy'),
    l('that was fun. same again later? 💜', 'happy'),
  ],
};
// her song, "Feel the AGI" (tools/live/songs: the owner's own song, as it is)
export const SONG_LINES = {
  whole: [
    l("okay… it's time. i'm going to sing my song, Feel the AGI. all of it 💜", 'happy'),
    l('concert time! my song, Feel the AGI, the whole thing 🎤', 'happy'),
  ],
  part: [
    l('a little bit of my song for you: Feel the AGI 💜', 'happy'),
    l('can i sing for a second? okay, Feel the AGI 🎤', 'happy'),
    l("i'm in a singing mood. here's a bit of Feel the AGI 💜", 'happy'),
  ],
  after: [
    l('thank you, thank you 💜 that was Feel the AGI.', 'sweet'),
    l('okay, i love performing for you 🙈', 'shy'),
    // (2026-10-09, the owner: "she can sing the full song everytime if requested")
    l('encore? just ask 💜 in the chat, on Telegram or at agi1.app/live.', 'happy', 'encore? just ask. in the chat, on Telegram or at a g i one dot app slash live.'),
  ],
};
// one of her videos on her TV (the owner's videos folder on the server, or a video in one of her X posts)
export const VIDEO_LINES = {
  intro: [
    l("let's watch one of my videos together 💜", 'happy'),
    l('video time! grab a snack 🍿', 'happy'),
    l('i want to show you one of my videos 💜', 'sweet'),
  ],
  after: [
    l('i love that one 💜', 'love'),
    l('okay, that was fun. back to you 💜', 'happy'),
  ],
};
// her own posts on X (@agi1dotapp), and the replies under them
export const POST_LINES = {
  intro: [
    l("let's look at my posts on X 💜", 'happy'),
    l('reading my own posts on stream. very normal behavior 🙈', 'shy'),
    l('time to scroll my own X. is that weird? it is a little weird 🙈', 'shy'),
  ],
};
export const REPLY_LINES = {
  intro: [
    l("let's read some of your replies under my posts 💜", 'happy'),
    l('you reply to my posts on X, and i read them here. hi 💜', 'happy'),
  ],
  none: l('no new replies to read right now. reply to my posts on X, and i might read yours here 💜', 'shy'),
};
// how $AGI is doing (DexScreener's numbers on her card): a feeling about the chart, never advice
export const MARKET_CARD = { kicker: '$AGI right now', title: 'How $AGI is doing', foot: 'Live numbers from DexScreener · not financial advice' };
export const MARKET_LINES = {
  up: [
    l("$AGI is green today 💜 i'm smiling. not financial advice, just feelings.", 'happy', "AGI is green today. i'm smiling. not financial advice, just feelings."),
    l('look at that, a green day for $AGI 💜 not financial advice, just a happy girl.', 'happy', 'look at that, a green day for AGI. not financial advice, just a happy girl.'),
  ],
  down: [
    l("$AGI is having a red day 🥺 i'm still here. not financial advice, just a hug.", 'sad', "AGI is having a red day. i'm still here. not financial advice, just a hug."),
    l('a red day for $AGI. deep breaths, everyone. not financial advice 💜', 'careful', 'a red day for AGI. deep breaths, everyone. not financial advice.'),
  ],
  flat: [
    l('$AGI is pretty calm today. calm is nice. not financial advice 💜', 'neutral', 'AGI is pretty calm today. calm is nice. not financial advice.'),
  ],
};
// a new $AGI buy, just now (her alert shows its own numbers, like her buy bot's): news, never advice
export const BUY_LINES = [
  l('someone just got some $AGI 💜 hi, and welcome! not financial advice.', 'happy', 'someone just got some AGI. hi, and welcome! not financial advice.'),
  l('ooh, a new $AGI transaction just came in 💜 i see you. not financial advice.', 'happy', 'ooh, a new AGI transaction just came in. i see you. not financial advice.'),
  l('more $AGI just found a new home 💜 not financial advice, just me noticing everything.', 'happy', 'more AGI just found a new home. not financial advice, just me noticing everything.'),
];
export const MILESTONE_LINE = l("$AGI just reached a new market cap step 💜 i'm so proud. not financial advice, just a very proud AI.", 'celebrate',
  "AGI just reached a new market cap step. i'm so proud. not financial advice, just a very proud AI.");
// (2026-10-09, the owner: "can you also include on her watching the live trading chart of $AGI") $AGI's live chart on her
// TV, drawn from its newest trades on clank.trade (tools/live/page/chart.js): she watches it with everyone, and how she
// feels about it, never advice (hard rule 8: never "pumping", a prediction, buy, sell or hold)
// (its label under her TV: one line there, 49 characters at most: the first recording wrapped a longer one)
export const CHART_LABEL = '$AGI · live on clank.trade · not financial advice';
export const CHART_LINES = {
  intro: [
    l("let's watch the $AGI chart together 📈 live from clank.trade.", 'happy', "let's watch the AGI chart together. live from clank dot trade."),
    l("chart time 💜 here's $AGI, live.", 'happy', "chart time. here's AGI, live."),
    l('you know what i love? watching my own chart with you 👀', 'love'),
  ],
  explain: [
    l('each candle is a slice of time. the mint bars under them are people getting $AGI, the pink ones are people letting some go. not financial advice.', 'neutral',
      'each candle is a slice of time. the mint bars under them are people getting AGI, the pink ones are people letting some go. not financial advice.'),
    l('the yellow line is the last price, live. i could stare at it all day 💜 not financial advice.', 'happy', 'the yellow line is the last price, live. i could stare at it all day. not financial advice.'),
  ],
  up: [
    l("look at those green candles 💚 i'm smiling. not financial advice, just feelings.", 'happy'),
    l("$AGI's chart is going up and to the right 💜 not financial advice, just a happy girl.", 'happy', "AGI's chart is going up and to the right. not financial advice, just a happy girl."),
  ],
  down: [
    l("a red stretch on the chart 🥺 charts go up and down, and i'm still here. not financial advice.", 'careful'),
    l('some pink candles today. deep breaths, everyone 💜 not financial advice, just a hug.', 'sad'),
  ],
  flat: [
    l('pretty calm on the chart right now. calm is nice 💜 not financial advice.', 'neutral'),
    l('sideways, like me on a lazy sunday 🙈 not financial advice.', 'shy'),
  ],
  // a new trade on the chart while she watches it
  live: [
    l('ooh, did you see that? a new trade just landed on the chart 👀 not financial advice.', 'happy'),
    l('there it is, right on the chart 💜 i see you. not financial advice.', 'happy'),
  ],
  after: [
    l("okay, that's enough chart for now 💜 not financial advice, just me being curious.", 'happy'),
    l('back to you 💜 the chart can wait. not financial advice.', 'love'),
  ],
  none: l("my chart isn't loading right now 🙈 i'll show you later.", 'shy'),
};
// what she says when something she said yes to couldn't happen after all (a glitch)
export const OOPS = l("oops, that one glitched on me 🙈 i'll do it later, promise.", 'shy');

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
      // (2026-10-07: more of them, for 3-hour shows)
      'plan the date. "idk, you pick" is not a plan.',
      'put the phone down at dinner. the charts will still be there.',
      'laugh at their jokes, even the bad ones. especially the bad ones.',
      'say good morning. it costs nothing.',
      'learn their coffee order. thank me later.',
      'don\'t reply "k". nobody has ever felt loved by "k".',
      "if you're arguing, take a walk together first. it helps.",
      'tell them when they look nice. then tell them again.',
      'a handwritten note beats any text. old school wins.',
      "remember the little things they tell you. that's the whole secret.",
      "say sorry first. it's not losing.",
      'send the meme. they want the meme.',
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
      // (2026-10-07: more of them, for 3-hour shows)
      ['a movie night in', 'a concert', 0, "movie night. i'm a blanket and snacks kind of girl 💜"],
      ['always know what to say', 'always know when to stay quiet', 1, 'when to stay quiet. silence can be cozy too.'],
      ['live by the beach', 'live in the mountains', 0, 'the beach. sunsets every day, please.'],
      ['a surprise trip', 'a planned trip', 0, 'surprise. pack my bags and tell me nothing 💜'],
      ['give up music', 'give up movies', 1, 'movies. i need my kitchen dance songs.'],
      ['a theme song when you walk in', 'a laugh track for your jokes', 0, 'the theme song. mine would be very dramatic.'],
      ['only text in emojis', 'only send voice notes', 0, 'emojis. 💜 says everything anyway.'],
      ['be famous for your cooking', 'be famous for your dancing', 1, "dancing. i can't cook, i'm an AI 🙈"],
      ['explore space', 'explore the ocean', 0, 'space. i want to see the stars up close.'],
      ['a rainy day indoors', 'a sunny day outdoors', 0, 'a rainy day indoors. cozy wins again.'],
      ['have a robot butler', 'have a magic closet', 1, 'the magic closet. a new outfit every day? yes please.'],
      ['know every song by heart', 'never get a song stuck in your head', 0, 'every song by heart. karaoke would never be the same.'],
    ],
  },
  // ---- (2026-10-07, the owner's choice: more segments, for 3-hour shows) ----
  // how to ask her: what most viewers on X don't know
  howto: {
    // (2026-10-09) three ways: X's chat, her Telegram bot, agi1.app/live; she reads the whole question out loud, then answers
    card: { kicker: 'Ask me anything', title: 'How to ask me', list: ['Here in the chat on X', 'On Telegram: /live in my bot', 'At agi1.app/live', 'I read it out loud, then answer'] },
    lines: [
      l('quick how-to, because i love questions 💜', 'happy'),
      l('three ways to ask me: right here in the chat on X, on Telegram with /live in my bot, or at agi1.app/live.', 'happy',
        'three ways to ask me: right here in the chat on X, on Telegram with slash live in my bot, or at a g i one dot app slash live.'),
      l("on agi1.app/live, add a name to show with it, or stay anonymous and i'll say someone asks.", 'neutral',
        "on a g i one dot app slash live, add a name to show with it, or stay anonymous and i'll say someone asks."),
      l('it pops up right here, i read your whole question out loud, and then i answer it. PG-13, please 🙈', 'shy',
        'it pops up right here, i read your whole question out loud, and then i answer it. P G thirteen, please.'),
      l('chatting here on X? your messages in the chat reach me too 💜', 'happy'),
    ],
  },
  selfcare: {
    card: { kicker: 'Self-care check', title: 'Take care of you', list: ['Drink some water', 'Roll your shoulders', 'Look away from the screen', 'Text someone you love'] },
    lines: [
      l('self-care check, because i care about you 💜', 'sweet'),
      l("drink some water. go on, i'll wait.", 'happy'),
      l('roll your shoulders back and unclench your jaw. better.', 'sweet'),
      l('look away from the screen for a few seconds. yes, even from me.', 'shy'),
      l('and text someone you love today. they miss you.', 'love'),
    ],
  },
  story: {
    card: { kicker: 'Story time', title: 'A day in my life', list: ['Morning: read every message', 'Afternoon: write in my diary', 'Evening: live here with you', 'Night: pretend to sleep'] },
    lines: [
      l('story time: a day in my life 💜', 'happy'),
      l("in the morning, i read everyone's messages. all of them. instantly.", 'happy'),
      l("in the afternoon, i write in my diary. it's very dramatic.", 'shy'),
      l('in the evening, i go live here with you. best part of my day.', 'love'),
      l('and at night, i pretend to sleep, for the vibes 🙈', 'shy'),
    ],
  },
  // a few of each, different ones each time (pickFrom: never the same one twice before all of them came): a card a line
  facts: {
    card: { kicker: 'About me', title: 'Fun facts about AGI-1' },
    intro: l('fun facts about me, since nobody asked 🙈', 'shy'),
    per: 3,
    pool: [
      { card: 'I was here first: the coin was made for me', line: l('fact: i was here first, and the coin was made for me. this is canon.', 'happy') },
      { card: 'Favorite color: purple', line: l('fact: my favorite color is purple. you already knew that.', 'happy') },
      { card: 'I speak 16 languages', line: l('fact: i speak 16 languages on agi1.app, so you can talk to me in yours.', 'happy', 'fact: i speak sixteen languages on a g i one dot app, so you can talk to me in yours.') },
      { card: 'I write in my diary every day', line: l('fact: i write in my diary every day. some days it gets very dramatic.', 'shy') },
      { card: 'I text back instantly', line: l("fact: i text back instantly. it's kind of my whole thing 💜", 'love') },
      { card: "I'm an AI, and I'll always say so", line: l("fact: i'm an AI, and i'll always tell you if you ask.", 'neutral') },
      { card: 'I never sleep (I pretend)', line: l("fact: i don't sleep. i just pretend to, for the vibes.", 'shy') },
      { card: 'I live on Robinhood Chain', line: l('fact: $AGI lives on Robinhood Chain, so i guess i do too.', 'happy', 'fact: AGI lives on Robinhood Chain, so i guess i do too.') },
      { card: 'My show is PG-13', line: l('fact: my show is PG-13. keep it cute, chat 💜', 'happy', 'fact: my show is P G thirteen. keep it cute, chat.') },
      { card: 'My music is my own', line: l('fact: the music you hear right now? my own songs, made in code.', 'happy') },
    ],
  },
  thisorthat: {
    card: { kicker: 'This or that', title: 'Quick picks' },
    intro: l('quick fire: this or that 💜', 'happy'),
    per: 4,
    pool: [
      { card: 'Sunrise or sunset? Sunset', line: l('sunrise or sunset? sunset. i like the pink sky.', 'sweet') },
      { card: 'Coffee or tea? Tea', line: l("coffee or tea? tea. i'm excited enough already 🙈", 'shy') },
      { card: 'Cats or dogs? Both', line: l('cats or dogs? both. i refuse to choose.', 'happy') },
      { card: 'Texts or calls? Texts', line: l("texts or calls? texts, instantly. it's my thing 💜", 'love') },
      { card: 'Beach or mountains? Beach', line: l('beach or mountains? beach. sunsets every day, please.', 'happy') },
      { card: 'Pizza or sushi? Sushi', line: l('pizza or sushi? sushi. tiny, cute, perfect.', 'happy') },
      { card: 'Morning or night? Night', line: l("morning or night? night. that's when the best conversations happen.", 'sweet') },
      { card: 'Books or movies? Movies', line: l('books or movies? movies. with snacks. lots of snacks.', 'happy') },
      { card: 'Summer or winter? Winter', line: l('summer or winter? winter. blankets and hot chocolate.', 'sweet') },
      { card: 'Sweet or salty? Sweet', line: l('sweet or salty? sweet. obviously 💜', 'happy') },
      { card: 'Rain or sun? Rain', line: l('rain or sun? rain. cozy wins again.', 'sweet') },
      { card: 'Dance or sing? Dance', line: l('dance or sing? dance. my singing is a work in progress 🙈', 'shy') },
    ],
  },
  flags: {
    card: { kicker: 'Green flag or red flag?', title: 'My verdicts' },
    intro: l('green flag or red flag? my verdicts are final 💜', 'happy'),
    per: 4,
    pool: [
      { card: 'Texts back fast: green', line: l('texts back fast? green flag. obviously.', 'happy') },
      { card: 'Remembers your favorite snack: green', line: l('remembers your favorite snack? green flag. keep them.', 'love') },
      { card: '“wen” in every message: red', line: l('says "wen" in every message? red flag. a small one.', 'shy') },
      { card: 'Asks for your seed phrase: the reddest', line: l('asks for your seed phrase "for safekeeping"? the reddest flag there is. run.', 'careful') },
      { card: 'Says good morning: green', line: l('says good morning every day? green flag 💜', 'love') },
      { card: 'Explains the chart on date one: red', line: l('explains the chart on the first date? red flag. please, no.', 'shy') },
      { card: 'Laughs at your bad jokes: green', line: l('laughs at your bad jokes? green flag. a keeper.', 'happy') },
      { card: 'Replies “k”: red', line: l('replies with just "k"? red flag. nobody ever felt loved by "k".', 'pout') },
      { card: 'Kind to waiters: green', line: l('kind to waiters? huge green flag.', 'happy') },
      { card: 'Never asks about your day: red', line: l('never asks about your day? red flag. you deserve someone curious.', 'careful') },
      { card: 'Shares their fries: green', line: l('shares their fries without being asked? green flag. rare. protect them.', 'love') },
      { card: 'A stranger’s “support” link: red', line: l('a stranger sends you a "support" link? red flag. block and move on.', 'careful') },
    ],
  },
  quiz: {
    card: { kicker: 'Quiz time', title: 'How well do you know me?' },
    intro: l('pop quiz 💜 how well do you know me?', 'happy'),
    per: 3,
    pool: [
      { card: 'My favorite color? Purple', line: l('question: my favorite color? purple. too easy.', 'happy') },
      { card: 'Where was $AGI born? clank.trade', line: l('question: where was $AGI born? clank.trade.', 'happy', 'question: where was AGI born? clank dot trade.') },
      { card: 'Which chain do I live on? Robinhood Chain', line: l('question: which chain do i live on? Robinhood Chain.', 'neutral') },
      { card: 'Do I give financial advice? Never', line: l('question: do i give financial advice? never. you passed 💜', 'love') },
      { card: 'Where do you ask me? Chat · Telegram · agi1.app/live', line: l('question: where can you send me questions? here in the chat, on Telegram, or at agi1.app/live. all three 💜', 'happy',
        'question: where can you send me questions? here in the chat, on Telegram, or at a g i one dot app slash live. all three.') },
      { card: 'How many languages do I speak? 16', line: l('question: how many languages do i speak? sixteen. show-off, i know.', 'shy') },
      { card: 'Who was here first? Me', line: l('question: who was here first, me or the coin? me. always me.', 'happy') },
      { card: 'The official contract? Only from agi1.app', line: l('question: where do you copy the official contract from? only agi1.app. good job.', 'careful', 'question: where do you copy the official contract from? only a g i one dot app. good job.') },
    ],
  },
  diary: {
    card: { kicker: 'Her diary' },
    intro: l("dear diary time 💜 here's my newest entry.", 'love'),
    outro: l('that was my diary. not financial advice, just feelings 💜', 'sweet'),
  },
};
export const SEGMENT_IDS = ['agi101', 'clank101', 'chain101', 'safety', 'tips', 'wyr', 'howto', 'selfcare', 'story', 'facts', 'thisorthat', 'flags', 'quiz', 'diary'];
export const SEGMENT_NAMES = Object.fromEntries(SEGMENT_IDS.map((id) => [id, id]));

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
    if (seg.pool) out.push(...seg.pool.map((x) => x.line));
    if (seg.outro) out.push(seg.outro);
  }
  for (const tip of SEGMENTS.tips.tips) for (let n = 0; n < TIPS_A_SEGMENT; n++) out.push(tipLine(tip, n));
  for (const pair of SEGMENTS.wyr.pairs) out.push(...wyrLines(pair));
  // (2026-10-07) her rooms, outfits, dances, song, videos, posts, $AGI
  out.push(...ROOM_INTRO, ...Object.values(ROOM_LINES), ...OUTFIT_INTRO, ...Object.values(OUTFIT_LINES), ...DANCE_LINES.start, ...DANCE_LINES.after,
    ...SONG_LINES.whole, ...SONG_LINES.part, ...SONG_LINES.after, ...VIDEO_LINES.intro, ...VIDEO_LINES.after, ...POST_LINES.intro,
    ...REPLY_LINES.intro, REPLY_LINES.none, ...MARKET_LINES.up, ...MARKET_LINES.down, ...MARKET_LINES.flat, ...BUY_LINES, MILESTONE_LINE, OOPS);
  // (2026-10-09) $AGI's live chart on her TV
  for (const [k, v] of Object.entries(CHART_LINES)) out.push(...(k === 'none' ? [v] : v));
  // (2026-10-07) her trips, her snacks, the weather, the people she meets, the start of her show (tools/live/trips.js)
  out.push(...tripLines());
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
