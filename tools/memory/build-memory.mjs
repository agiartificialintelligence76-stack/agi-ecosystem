// Builds AGI-1's memory of the clank.trade (ex daos.fun) Telegram group: server/tg-memory-data.js.
// Not part of the site build. Run it again after a new Telegram export or after editing lore.json / forget.json:
//   node tools/memory/build-memory.mjs "telegram memories/result.json"
//
// What goes in: the hand-written cards in lore.json (eras, running jokes, big moments), plus one short card per
// active member (display name, when they were around, how much they talked, their catchphrases and favorite
// tickers). No 'topics' guessed from their words: that was noisy and could put words in people's mouths. What never goes in: Telegram user ids, phone numbers, emails, links, wallet addresses, long quotes,
// or anyone listed in forget.json. Words from the blocklist (slurs, sexual words, accusations like "scam" or "rug")
// are left out of the member cards. The raw export itself stays out of git (see .gitignore).
import { readFileSync, writeFileSync } from 'node:fs';

const EXPORT = process.argv[2] || 'telegram memories/result.json';
const here = (f) => new URL(f, import.meta.url);
const OUT = new URL('../../server/tg-memory-data.js', import.meta.url);
const MIN_MESSAGES = 40;          // members with fewer messages get no card of their own

// People with a clear role in the group (from pinned messages and their own announcements), and the nicknames the
// chat uses for them.
const ROLES = {
  baoskee: { role: 'founder of daos.fun and clank.trade', aliases: ['baoskee', 'bao'] },
  'danny boyyyyyy': { role: 'from the daos.fun team (announcements and pins)', aliases: ['danny boyyyyyy', 'danny', 'dannyboycrypt0', 'danny boy'] },
  'Leon 🦴| Tailwind.zone': { role: 'from the daos.fun dev team (moderator, wrote the complete guide)', aliases: ['leon', 'leon0406', 'tailwind'] },
};

export const BLOCK = /\b(fuck\w*|shit\w*|bitch\w*|cunt\w*|dick\w*|pussy|cock\w*|retard\w*|nigg\w*|fag\w*|jews?|kike|chink\w*|spic|slut\w*|whore\w*|porn\w*|sex\w*|cum\w*|pawg\w*|goon\w*|boob\w*|tits?|titties|ass|asses|anal|nude\w*|nsfw|rape\w*|kill\w*|kys|suicide|scam\w*|rug|rugs|rugg\w*|rugpull\w*|fraud\w*|thief|thieves|steal\w*|stole\w*|hack\w*|exploit\w*|drug\w*|weed|filipino\w*|pinoy|chinese|indian\w*|african\w*|nigerian\w*|turkish|russian\w*|ukrain\w*|israel\w*|palestin\w*|muslim\w*|christian\w*|trump|biden|politic\w*|idiot\w*|stupid|dumb|loser\w*|clown\w*)\b/i;
const STOP = new Set(`the a an and or but if then so to of in on at for from by with about as is are was were be been being am do does did done
have has had having it its it's this that these those there here what which who whom whose when where why how all any both each few more most
other some such no nor not only own same than too very can will just don't should now i me my mine we us our you your yours he him his she her
they them their what's i'm you're that's there's can't won't didn't doesn't isn't aren't wasn't i'll i've let's lol lmao yeah yes okay ok also
guys bro bros man fam still really much many one two get got going gonna want need know think like good well even back make made time way
see say said look go come take give buy sell sold bought price token tokens coin coins project team dao daos fun daosfun people someone anyone
everyone something anything everything today tomorrow now soon already again first next last new old right wrong sure maybe because would could
please thanks thank hello hey hi gm gn`.split(/\s+/));
const PRIVATE = /https?:|www\.|t\.me|@|\b0x[0-9a-f]{6,}|[1-9A-HJ-NP-Za-km-z]{25,}|\+?\d[\d\s-]{7,}\d|[\w.+-]+@[\w-]+\.\w+/i;
// links, addresses, @handles, phone numbers and emails are cut out before anything is counted
const SCRUB = /https?:\/\/\S+|www\.\S+|t\.me\/\S+|@\w+|\b0x[0-9a-fA-F]{6,}\b|[1-9A-HJ-NP-Za-km-z]{25,}|\+?\d[\d\s-]{7,}\d|[\w.+-]+@[\w-]+\.\w+/g;
// the most explicit roots are checked inside words too ("gcum"), for catchphrases, tickers and display names
const EXPLICIT = /(fuck|shit|bitch|cunt|dick|pussy|cock|nigg|fag|slut|whore|porn|sex|cum|pawg|goon|boob|titt|rape|retard|jew|kike|chink|nazi|hitler)/i;
const blocked = (s) => EXPLICIT.test(String(s)) || BLOCK.test(String(s).replace(/[^\p{L}\p{N}]+/gu, ' '));
// everyday words and common first names that some display names are made of: as a single-word nickname they would
// match normal chat ("hi, i'm rick")
const COMMON = new Set(`about above after again against alpha ape apes angel angry apple army baby back bad bag bags banana bank bat bear bears beast
best big bird black blue boat bold boss boy boys brain bread brother brown bull bulls bunny butter buy call calm candy captain car cash cat cats
chad champ chef chill chip chips city clean clear cloud coffee cold cool cosmic crazy cream crypto cute daddy dark day dead dear degen devil diamond
doctor dog dogs doge dragon dream drop dude duck eagle earth easy eat echo egg empire ever evil eye face fast fat father fire fish flash fly food
fox free fresh friend frog fun funny game gamer gen genius ghost giant gift girl glad god gold golden good gorilla grand great green guy guys
hand happy hawk head heart hero high hodl holy home honey hope hot hunter ice iron jack jelly joker joy just killer king kitty knight lady lazy
legend lemon light lion little living lord love lucky mad magic mama man mars master max mega milk mind mint mister money monkey moon mother mouse
mystic nice night ninja noble nova ocean old one orange panda papa party peace penguin pepe pink pixel pizza player poor potato power prince
princess pro pump punk queen quick rabbit rain rainbow red rich rider rock rocket rose royal ruby sad sage saint salt sea secret shadow shark
shiba silver simple sir sky sleepy small smart smile snake snow solar solo soul space spark star stone storm strong sugar sun sunny super sweet
tank tech tiger time tiny titan top toy trader trust truth turbo twin uncle unicorn wave whale white wild wind winner wise wizard wolf world
young zen zero
aaron adam adrian alex alan albert alice amir amy andre andrea andrew andy anna anthony ben bill bob brian carlos charles charlie chris
daniel dave david dennis eric erik frank fred gabriel george greg harry henry ivan jack jacob jake james jason jay jeff jerry jim joe john
johnny jonathan jordan jose josh juan julia justin karl kate kevin kim kyle larry lee leo lisa luca lucas luis luke marc marco maria mario
mark martin matt max michael mike nick oliver omar oscar paul pedro peter phil rick robert roy ryan sam sara sarah scott sean simon steve
steven thomas tim tom tony victor vincent will
aether anon arnold birdman bobo burnt celsius chicken combo diverted dong doses elle elite euphoria evan fortune guardian luck midnight
pikachu private public qwerty quack reacher rice sassy skinned swedish wealth`.split(/\s+/));

const textOf = (m) => (Array.isArray(m.text) ? m.text.map((x) => (typeof x === 'string' ? x : x.text || '')).join('') : m.text || '');
export const normName = (s) => String(s || '').toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
const monthLabel = (iso) => new Date(`${iso.slice(0, 7)}-01T00:00:00Z`).toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const era = (ym) => (ym < '2024-10' ? 'the very first days' : ym <= '2024-12' ? 'the daos.fun launch months'
  : ym <= '2025-07' ? 'the quiet 2025' : ym <= '2025-10' ? 'the summer 2025 revival' : ym <= '2026-08' ? 'the long quiet' : 'the clank.trade reboot');

// hideTickers (forget.json → tickers, 2026-09-28: CABO): coins she never talks about, left out of every member's tickers
// and catchphrases.
export function buildMemory(exp, lore, forget = [], hideTickers = []) {
  const forgotten = new Set(forget.map(normName));
  const hidden = new Set(hideTickers.map((t) => String(t).toUpperCase()));
  const hiddenWord = hidden.size ? new RegExp(`\\b(${[...hidden].join('|')})\\b`, 'i') : null;
  const messages = (exp.messages || []).filter((m) => m.type === 'message' && m.from);
  const byWho = new Map();
  for (const m of messages) {
    const w = byWho.get(m.from) || { name: m.from, n: 0, first: m.date, last: m.date, months: new Map(), shorts: new Map(), tickers: new Map() };
    w.n++; w.last = m.date;
    const ym = m.date.slice(0, 7);
    w.months.set(ym, (w.months.get(ym) || 0) + 1);
    const raw = textOf(m);
    const short = raw.trim().toLowerCase().replace(/\s+/g, ' ');
    if (short && short.length <= 24 && !PRIVATE.test(short) && !blocked(short) && !hiddenWord?.test(short)) w.shorts.set(short, (w.shorts.get(short) || 0) + 1);
    const t = raw.replace(SCRUB, ' ');
    for (const tk of t.matchAll(/\$([A-Za-z][A-Za-z0-9]{1,9})\b/g)) {
      const s = tk[1].toUpperCase();
      if (!blocked(s) && !hidden.has(s)) w.tickers.set(s, (w.tickers.get(s) || 0) + 1);
    }
    byWho.set(m.from, w);
  }
  const ranked = [...byWho.values()].sort((a, b) => b.n - a.n);
  // single-word nicknames that are also everyday words would match too often ("king", "dude", "just")
  const everyday = (a) => !a.includes(' ') && (COMMON.has(a) || STOP.has(a) || a.length < 4 || /^\d+$/.test(a));
  const aliasOwners = new Map();
  const cards = [];
  ranked.forEach((w, i) => {
    if (w.n < MIN_MESSAGES || forgotten.has(normName(w.name))) return;
    if (!ROLES[w.name] && blocked(w.name)) return;                    // a display name AGI-1 can't say in PG-13
    const role = ROLES[w.name];
    const full = normName(w.name);
    const words = full.split(' ').filter(Boolean);
    const aliases = new Set(role ? role.aliases.map(normName) : []);
    if (full && (full.length >= 4 || full.includes(' '))) aliases.add(full);
    if (words.length > 1 && !everyday(words[0])) aliases.add(words[0]);
    for (const a of [...aliases]) {
      if (!role && everyday(a)) aliases.delete(a);
      aliasOwners.set(a, (aliasOwners.get(a) || 0) + 1);
    }
    const busiest = [...w.months.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const says = [...w.shorts.entries()].filter(([, c]) => c >= 3).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s]) => `'${s}'`);
    const tickers = [...w.tickers.entries()].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s]) => `$${s}`);
    const bits = [
      `${w.name}${role ? ` (${role.role})` : ''}: active ${monthLabel(w.first)} to ${monthLabel(w.last)}, about ${w.n.toLocaleString('en-US')} messages (#${i + 1} most talkative), busiest during ${era(busiest)}.`,
      says.length ? ` Often says ${says.join(', ')}.` : '',
      tickers.length ? ` Mentions ${tickers.join(', ')} the most.` : '',
    ];
    cards.push({ id: `member-${cards.length + 1}`, kind: 'member', name: w.name, aliases: [...aliases], keys: [], text: bits.join('') });
  });
  // a nickname two members share can't point at either of them
  for (const c of cards) c.aliases = c.aliases.filter((a) => aliasOwners.get(a) === 1 || ROLES[c.name]?.aliases.map(normName).includes(a));

  const loreCards = lore.cards.map((c) => {
    let text = c.text;
    for (const name of forget) text = text.split(name).join('a member');
    return { id: c.id, kind: 'lore', keys: c.keys.map((k) => k.toLowerCase()), text };
  });
  const dates = (exp.messages || []).map((m) => m.date).filter(Boolean).sort();
  return {
    source: { group: exp.name, from: dates[0]?.slice(0, 10), to: dates.at(-1)?.slice(0, 10), messages: messages.length, members: byWho.size },
    cards: [...loreCards, ...cards],
    forget: [...forgotten],
  };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href) {
  const exp = JSON.parse(readFileSync(EXPORT, 'utf8'));
  const lore = JSON.parse(readFileSync(here('lore.json'), 'utf8'));
  const { names: forget = [], tickers: hideTickers = [] } = JSON.parse(readFileSync(here('forget.json'), 'utf8'));
  const memory = buildMemory(exp, lore, forget, hideTickers);
  const js = `// AGI-1's memory of the ${memory.source.group} Telegram group (${memory.source.from} to ${memory.source.to}).\n`
    + '// GENERATED by tools/memory/build-memory.mjs from the Telegram export + tools/memory/lore.json. Do not edit by hand:\n'
    + '// edit lore.json or forget.json and rebuild. Server only; never imported by browser code.\n'
    + `export default ${JSON.stringify(memory, null, 1)};\n`;
  writeFileSync(OUT, js);
  const members = memory.cards.filter((c) => c.kind === 'member').length;
  console.log(`✓ ${memory.cards.length} memory cards (${memory.cards.length - members} lore, ${members} members), ${(js.length / 1024).toFixed(0)} KB → server/tg-memory-data.js`);
}
