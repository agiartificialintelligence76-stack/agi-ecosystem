// TRENCHING SIMULATOR's coins, callers and chatter (2026-10-20): everything the game's made-up market is called. Coins
// get names and tickers from themes (animals, food, space, robots…), always made up, PG-13, and never a real coin's
// ticker, a real person, a brand or $AGI's look-alike (BLOCKED_TICKERS, BANNED_WORDS: tests/trench.test.js checks a few
// thousand). The callers (KOLS) and smart wallets are made up too, with traits a player can learn over runs (who holds,
// who dumps on their followers). Socials are only flags (an X, a group, a site): never a handle or an address anyone
// could visit. Pure: read in Node too.

// ---------- themes ----------

// Each theme: its label (a "meta" when it's hot), emoji for its coins' pictures, and nouns for their names
export const THEMES = {
  cats: { label: 'Cats', emoji: ['🐱', '😺', '🐈', '😼', '🙀'], nouns: ['Cat', 'Kitty', 'Meow', 'Whiskers', 'Purr', 'Tabby', 'Mittens', 'Loaf', 'Zoomies', 'Catnip', 'Kitten'] },
  dogs: { label: 'Dogs', emoji: ['🐶', '🐕', '🦮', '🐩'], nouns: ['Pup', 'Doggo', 'Woof', 'Bork', 'Corgi', 'Pupper', 'Fetch', 'Goodboy', 'Beagle', 'Waggle'] },
  frogs: { label: 'Frogs', emoji: ['🐸'], nouns: ['Frog', 'Ribbit', 'Toad', 'Hopper', 'Croak', 'Tadpole', 'Lilypad', 'Froggo'] },
  critters: { label: 'Critters', emoji: ['🐹', '🦦', '🦝', '🦥', '🦫', '🐿️', '🦔'], nouns: ['Hamster', 'Otter', 'Raccoon', 'Sloth', 'Capy', 'Squirrel', 'Hedgehog', 'Chonk', 'Beaver', 'Axolotl'] },
  birds: { label: 'Birds', emoji: ['🦆', '🐧', '🦉', '🦜', '🐤'], nouns: ['Duck', 'Quack', 'Goose', 'Honk', 'Owl', 'Parrot', 'Chick', 'Waddle', 'Pigeon', 'Toucan'] },
  ocean: { label: 'Ocean', emoji: ['🐋', '🦈', '🦀', '🐙', '🦑', '🦞', '🐠'], nouns: ['Whale', 'Shark', 'Crab', 'Octo', 'Squid', 'Seahorse', 'Shrimp', 'Lobster', 'Jelly', 'Narwhal'] },
  food: { label: 'Food', emoji: ['🍕', '🌮', '🍜', '🍩', '🥯', '🍣', '🧇', '🥟', '🍔'], nouns: ['Pizza', 'Taco', 'Noodle', 'Mochi', 'Burrito', 'Pickle', 'Donut', 'Bagel', 'Ramen', 'Waffle', 'Nugget', 'Dumpling', 'Toast'] },
  space: { label: 'Space', emoji: ['🚀', '👽', '🛸', '☄️', '🌙', '🪐', '⭐'], nouns: ['Rocket', 'Alien', 'Comet', 'Astro', 'Nebula', 'Galaxy', 'Orbit', 'Moon', 'Saturn', 'Cosmo', 'Spaceship'] },
  ai: { label: 'AI agents', emoji: ['🤖', '🦾', '🧠', '💾', '🖥️'], nouns: ['Robot', 'Agent', 'Bot', 'Neural', 'Byte', 'Glitch', 'Circuit', 'Droid', 'Cyborg', 'Server', 'Prompt'] },
  internet: { label: 'Internet culture', emoji: ['😎', '🗿', '🫡', '💅', '🤌'], nouns: ['Vibe', 'Rizz', 'Aura', 'Sigma', 'Chad', 'Npc', 'Ratio', 'Cringe', 'Based', 'Mid', 'Bussin'] },
  gaming: { label: 'Gaming', emoji: ['🎮', '🕹️', '👾', '🏆'], nouns: ['Boss', 'Quest', 'Speedrun', 'Loot', 'Respawn', 'Combo', 'Pixel', 'Noob', 'Lobby', 'Headshot'] },
  fantasy: { label: 'Wizards', emoji: ['🧙', '🐉', '🧚', '🍄', '🔮'], nouns: ['Wizard', 'Dragon', 'Goblin', 'Potion', 'Gnome', 'Unicorn', 'Elf', 'Spell', 'Troll', 'Fairy'] },
  office: { label: 'Office', emoji: ['☕', '📎', '💼', '📊'], nouns: ['Intern', 'Monday', 'Coffee', 'Meeting', 'Deadline', 'Overtime', 'Stapler', 'Cubicle', 'Memo'] },
  weather: { label: 'Weather', emoji: ['⛈️', '🌧️', '☀️', '❄️', '🌈'], nouns: ['Storm', 'Thunder', 'Rain', 'Cloud', 'Snow', 'Rainbow', 'Breeze', 'Tornado'] },
  music: { label: 'Music', emoji: ['🎧', '🎸', '🥁', '🎤', '💿'], nouns: ['Beat', 'Bass', 'Vinyl', 'Disco', 'Karaoke', 'Drop', 'Remix', 'Banger', 'Encore'] },
  gym: { label: 'Gym', emoji: ['💪', '🏋️', '🥇'], nouns: ['Gains', 'Bench', 'Protein', 'Sprint', 'Squat', 'Flex', 'Cardio', 'Biceps'] },
  retro: { label: 'Retro', emoji: ['📼', '💾', '📟', '🕹️'], nouns: ['Floppy', 'Cassette', 'Pager', 'Arcade', 'Dialup', 'Boombox', 'Joystick'] },
  trench: { label: 'Trench life', emoji: ['💰', '🎒', '🕳️', '⛏️'], nouns: ['Bags', 'Jeet', 'Degen', 'Trench', 'Moonbag', 'Fren', 'Hodl', 'Dip', 'Candle', 'Chart'] },
  nature: { label: 'Nature', emoji: ['🍄', '🌵', '🌻', '🌲', '🍀'], nouns: ['Shroom', 'Cactus', 'Sunflower', 'Acorn', 'Clover', 'Pinecone', 'Fern', 'Bonsai'] },
  sweets: { label: 'Sweets', emoji: ['🍬', '🍭', '🧁', '🍪', '🍫'], nouns: ['Candy', 'Lollipop', 'Cupcake', 'Cookie', 'Gummy', 'Marshmallow', 'Sprinkles', 'Fudge'] },
};
export const THEME_IDS = Object.keys(THEMES);

// themes that can be a "meta" (a hot narrative: more launches in it, and its coins run more often)
export const METAS = ['ai', 'cats', 'dogs', 'frogs', 'critters', 'space', 'food', 'gaming', 'ocean', 'fantasy', 'internet', 'retro'];

export const ADJECTIVES = ['Sleepy', 'Tiny', 'Angry', 'Happy', 'Based', 'Lazy', 'Golden', 'Cosmic', 'Spicy', 'Chunky', 'Silly', 'Grumpy',
  'Fluffy', 'Sneaky', 'Turbo', 'Mega', 'Hyper', 'Little', 'Big', 'Wild', 'Shiny', 'Cozy', 'Brave', 'Lucky', 'Rich', 'Broke', 'Smol',
  'Chill', 'Wobbly', 'Bouncy', 'Dizzy', 'Fancy', 'Royal', 'Neon', 'Pixel', 'Retro', 'Frozen', 'Electric', 'Crispy', 'Sweaty', 'Zen'];
const PREFIXES = ['Baby', 'Mini', 'Mega', 'Super', 'Lil', 'Big', 'Captain', 'Sir', 'Lord', 'Professor', 'Doctor', 'Uncle', 'Auntie'];
const SUFFIXES = ['Coin', 'Club', 'Army', 'Season', 'Mode', 'Era', 'Gang', 'World', 'Inc', 'Labs', 'Cult', 'Party', 'Squad', 'Nation', 'Arc'];
const PLACES = ['Mars', 'the Moon', 'Vacation', 'a Mission', 'Payday', 'Repeat', 'Fire', 'Ice', 'Tour', 'the Run'];
// invented words (each read by a person: nothing rude in any of them)
const MADE_UP = ['Blorbo', 'Zonk', 'Glorp', 'Snorf', 'Wiggle', 'Quokka', 'Fizzle', 'Bloop', 'Zibble', 'Plonk', 'Flumpo',
  'Yoink', 'Doodle', 'Noodlez', 'Kerfuffle', 'Bamboozle', 'Hullabaloo', 'Gizmo', 'Pimble', 'Wobble', 'Snazz', 'Blip', 'Zap', 'Boop',
  'Glimmer', 'Fluff', 'Sprocket', 'Wizzle', 'Bubble', 'Tinker'];

// Never a ticker: real coins' and stocks' tickers (and SOL's money), $AGI and its look-alikes. Checked in tests.
export const BLOCKED_TICKERS = new Set(['BONK', 'WIF', 'PEPE', 'DOGE', 'SHIB', 'FLOKI', 'TRUMP', 'MELANIA', 'POPCAT', 'MEW', 'BOME',
  'PNUT', 'GOAT', 'MOODENG', 'FARTCOIN', 'AI16Z', 'ZEREBRO', 'CHILLGUY', 'PENGU', 'SOL', 'BTC', 'ETH', 'USDC', 'USDT', 'USDG',
  'SPCX', 'AGI', 'CABO', 'CLANKCAT', 'BRETT', 'MOG', 'TURBO', 'NEIRO', 'GIGA', 'SPX', 'MICHI', 'MOTHER', 'JUP', 'RAY', 'PYTH',
  'JTO', 'WEN', 'MYRO', 'SAMO', 'SLERF', 'PONKE', 'BILLY', 'MANEKI', 'SC', 'GME', 'AMC', 'TOSHI', 'DEGEN', 'HIGHER', 'KEYCAT',
  'PUMP', 'LIBRA', 'APE', 'WOJAK', 'NPC', 'GOATSE', 'LUNA', 'FTT', 'BNB', 'XRP', 'ADA', 'DOT', 'LINK', 'AVAX', 'TRX', 'TON',
  'SUI', 'ARB', 'OP', 'PENG', 'CAT', 'DOG', 'FROG', 'MOON', 'AI', 'BOT', 'CHAD', 'BASED', 'GM', 'FREN', 'JEET', 'WHALE',
  // words the names below can make that are a real stock's ticker (Robinhood lists them) or a known coin's
  'COIN', 'HOOD', 'META', 'SNOW', 'FLEX', 'WOOF', 'PLAY', 'NET', 'BOX', 'CAKE', 'GOLD', 'TSLA', 'AAPL', 'NVDA', 'MSFT', 'AMZN',
  'GOOG', 'GOOGL', 'NFLX', 'MSTR', 'PLTR', 'AMD', 'INTC', 'SPY', 'QQQ', 'ARC', 'CULT', 'MODE', 'AURA', 'SIGMA', 'TROLL', 'CLOUD',
  'SQUID', 'PIXEL', 'BAGS', 'LOOT', 'PROMPT', 'COOKIE', 'MEOW', 'JELLY', 'RIBBIT', 'BOOP', 'ZAP', 'SHOP', 'SPOT', 'FAST',
  'ELF', 'PURR', 'ERA', 'EPIC', 'FARM']);
// Never a word in a name (whole words, any case): other coins, people, brands, the site's own names
export const BANNED_WORDS = ['wif', 'shiba', 'inu', 'doge', 'pengu', 'wojak', 'pepe', 'bonk', 'phantom', 'agi', 'pump', 'trump',
  'elon', 'musk', 'melania', 'popcat', 'brett', 'chillguy', 'solana', 'jupiter', 'raydium', 'moodeng', 'fartcoin'];
const BANNED = new RegExp(`\\b(?:${BANNED_WORDS.join('|')})\\b`, 'i');

export const tickerOk = (t) => /^[A-Z][A-Z0-9]{1,9}$/.test(t) && !BLOCKED_TICKERS.has(t) && !t.includes('AGI') && !t.includes('PUMP');
export const nameOk = (n) => typeof n === 'string' && n.length >= 2 && n.length <= 32 && !BANNED.test(n);

const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);
const squash = (s) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

function tickerFor(rng, words) {
  const ws = words.map(squash).filter(Boolean);
  const last = ws[ws.length - 1] || 'COIN';
  const options = [];
  if (last.length >= 3 && last.length <= 8) options.push(last);
  const joined = ws.join('');
  if (joined.length >= 3 && joined.length <= 10) options.push(joined);
  if (ws.length >= 2) options.push(ws.map((w) => w[0]).join('') + (ws.length === 2 ? last.slice(1, 3) : ''));
  options.push(last.slice(0, 5) + rng.between(2, 99));
  options.push(last.slice(0, 6));
  for (const t of rng.shuffled(options)) if (tickerOk(t)) return t;
  return null;
}

// A new coin's name and ticker in a theme (several tries until both are fine)
export function makeName(rng, themeId) {
  const th = THEMES[themeId] || THEMES.cats;
  for (let tries = 0; tries < 30; tries++) {
    const noun = rng.pick(th.nouns);
    const adj = rng.pick(ADJECTIVES);
    const style = rng.weighted([['adj', 30], ['noun', 12], ['prefix', 12], ['suffix', 14], ['just', 6], ['place', 5], ['madeup', 8],
      ['compound', 6], ['the', 5], ['lower', 2]]);
    let name;
    let words;
    switch (style) {
      case 'adj': words = [adj, noun]; name = `${adj} ${noun}`; break;
      case 'noun': words = [noun]; name = noun; break;
      case 'prefix': { const p = rng.pick(PREFIXES); words = [p, noun]; name = `${p} ${noun}`; break; }
      case 'suffix': { const s = rng.pick(SUFFIXES); words = [noun, s]; name = `${noun} ${s}`; break; }
      case 'just': words = [adj, noun]; name = `just a ${adj.toLowerCase()} ${noun.toLowerCase()}`; break;
      case 'place': { const pl = rng.pick(PLACES); words = [noun]; name = `${noun} on ${pl}`; break; }
      case 'madeup': { const w = rng.pick(MADE_UP); words = [w]; name = w; break; }
      case 'compound': { const n2 = rng.pick(rng.pick(Object.values(THEMES)).nouns); words = [noun, n2]; name = `${noun}${n2}`; break; }
      case 'the': words = [adj, noun]; name = `The ${adj} ${noun}`; break;
      default: words = [noun]; name = `${noun.toLowerCase()} ${rng.pick(['szn', 'mode', 'era', 'arc', 'core', 'maxxing'])}`; break;
    }
    const ticker = tickerFor(rng, words);
    if (ticker && nameOk(name)) return { name, ticker, emoji: rng.pick(th.emoji), theme: themeId };
  }
  return { name: `${cap(rng.pick(MADE_UP))}`, ticker: `TRNCH${rng.between(10, 99)}`, emoji: '🪙', theme: themeId };
}

// A copy of another coin's name and ticker (copycats come right after a coin runs)
export function makeCopy(rng, of) {
  const style = rng.weighted([['same', 45], ['two', 18], ['real', 12], ['cto', 10], ['baby', 15]]);
  const t = of.ticker;
  const pick = (name, ticker) => (tickerOk(ticker) && nameOk(name) ? { name, ticker } : { name: of.name, ticker: t });
  let r;
  if (style === 'same') r = { name: of.name, ticker: t };
  else if (style === 'two') r = pick(`${of.name} 2.0`, `${t}2`.slice(0, 10));
  else if (style === 'real') r = pick(`Real ${of.name}`, `R${t}`.slice(0, 10));
  else if (style === 'cto') r = pick(`${of.name} CTO`, t);
  else r = pick(`Baby ${of.name}`, `B${t}`.slice(0, 10));
  return { ...r, emoji: of.emoji, theme: of.theme, copyOf: of.id };
}

// A coin's one line (pump.fun coins have one): short, PG-13, about the coin, never about money
const LINES = ['the {a} {n} on the chain', '{n}s only. no cap.', 'a community coin for {n} lovers', 'the {n} we deserve', 'just a {a} {n} vibing',
  '{n} season is here', 'built different. mostly {n}.', 'one {n} to rule them all', 'certified {a} {n} energy', 'we are all {n} now',
  'no roadmap, just {n}', 'the {n} that never sleeps', '{a} {n} protection program', 'a {n} with a dream', 'powered by {n} vibes',
  'proudly {a}', 'say gm to the {n}', 'the {n} is listening'];
export function makeLine(rng, coin) {
  const th = THEMES[coin.theme] || THEMES.cats;
  return rng.pick(LINES).replaceAll('{a}', rng.pick(ADJECTIVES).toLowerCase()).replaceAll('{n}', rng.pick(th.nouns).toLowerCase());
}

// ---------- wallets and addresses ----------

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export const isB58 = (s) => typeof s === 'string' && [...s].every((ch) => B58.includes(ch));
export function makeAddress(rng, len = 44) {
  let s = '';
  for (let i = 0; i < len; i++) s += B58[rng.int(58)];
  return s;
}
// a coin's mint address (the launchpad's vanity ones end in "pump", as on the real one: it's the launchpad's mark)
export const makeMint = (rng) => `${makeAddress(rng, 40)}pump`;
export const shortAddr = (a) => (typeof a === 'string' && a.length > 10 ? `${a.slice(0, 4)}…${a.slice(-4)}` : String(a || ''));

// made-up usernames for comments and devs: an adjective, a noun and a number
export function makeUser(rng) {
  const th = rng.pick(Object.values(THEMES));
  return `${rng.pick(ADJECTIVES).toLowerCase()}_${rng.pick(th.nouns).toLowerCase()}${rng.chance(0.6) ? rng.between(1, 999) : ''}`;
}

// ---------- callers and smart wallets ----------

// Made-up callers ("KOLs"), the same in every run, so a player learns them: how many follow them (how hard their
// followers pile in), whether they hold (honest) or sell into their followers, and how often their calls run (skill).
export const KOLS = [
  { id: 'trenchwitch', followers: 182_000, honest: 0.85, skill: 0.62 },
  { id: 'candlegoblin', followers: 96_000, honest: 0.25, skill: 0.45 },
  { id: 'slippagesam', followers: 41_000, honest: 0.6, skill: 0.4 },
  { id: 'mooncrumbs', followers: 133_000, honest: 0.35, skill: 0.55 },
  { id: 'bondingbard', followers: 58_000, honest: 0.75, skill: 0.5 },
  { id: 'curvecaptain', followers: 210_000, honest: 0.55, skill: 0.66 },
  { id: 'sniperella', followers: 74_000, honest: 0.2, skill: 0.5 },
  { id: 'jeetwhisperer', followers: 39_000, honest: 0.45, skill: 0.35 },
  { id: 'diamondpaws', followers: 121_000, honest: 0.9, skill: 0.48 },
  { id: 'degenduchess', followers: 165_000, honest: 0.5, skill: 0.6 },
  { id: 'frogfather', followers: 88_000, honest: 0.65, skill: 0.44 },
  { id: 'solsorcerer', followers: 247_000, honest: 0.3, skill: 0.58 },
  { id: 'chartwizard', followers: 52_000, honest: 0.7, skill: 0.52 },
  { id: 'gmgrandma', followers: 67_000, honest: 0.95, skill: 0.38 },
  { id: 'liquiditylarry', followers: 101_000, honest: 0.4, skill: 0.5 },
  { id: 'mintmarauder', followers: 45_000, honest: 0.15, skill: 0.42 },
];
export const kolById = (id) => KOLS.find((k) => k.id === id) || null;

// Made-up smart wallets (traders with a good record): their addresses are made from their number, so they're the same
// in every run
export const SMART_COUNT = 28;
export const smartAddress = (n) => {
  let x = (n + 1) * 2654435761;
  let s = '';
  for (let i = 0; i < 44; i++) {
    x = (Math.imul(x ^ (x >>> 15), 0x2c1b3c6d) + i) >>> 0;
    s += B58[x % 58];
  }
  return s;
};

// ---------- chatter ----------

// What people say on a coin's thread (Trench Board's comments): PG-13, about the coin, never a real person or another coin
export const COMMENTS = {
  any: ['gm', 'lfg', 'comfy', 'who is still here', 'chart looks clean', 'love the name', 'art is cute', 'early', 'not early lol',
    'just vibing', 'the vibes are immaculate', 'zoom out', 'patience', 'hold the line', 'who sold lol', 'fren', 'wagmi', 'ngmi',
    'this one is different', 'i blinked and it moved', 'back from lunch what happened', 'mods?', 'is the dev here?', 'community is strong',
    'slow and steady', 'volume looks real', 'the meta is here', 'cute coin', 'nice dip', 'just a chill coin', 'diamond hands only',
    'paper hands everywhere', 'who made this', 'i like the art', 'send it', 'ser', 'touch grass', 'gm frens'],
  hot: ['chart is cooking', 'sending', 'king of the hill!!', 'migration soon', 'this is a cult now', 'volume is crazy', 'next stop: migration',
    'it keeps going', 'wow', 'who else is in', 'buyers everywhere', 'green candles only'],
  dead: ['dev ran', 'rugged 💀', 'ofc', 'see you all next time', 'gg', 'unlucky', 'ded', 'rip', 'jeets won', 'cto?'],
  sus: ['bundled?', 'too many snipers', 'fresh wallets everywhere', 'dev holds a lot', 'top 10 is heavy', 'careful', 'sniper heavy',
    'dev sold??', 'who are these wallets'],
  kol: ['caller in', 'saw the call', 'followers are here', 'the call worked', 'here from the call'],
  migrated: ['migrated!!', 'we made it', 'bonded', 'congrats everyone', 'dex time', 'dex paid?'],
};
