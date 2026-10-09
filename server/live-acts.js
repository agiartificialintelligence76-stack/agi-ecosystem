// AGI-1's live show (2026-10-07, the owner: "she will do also what viewers ask her. like jump, jump many times, wave,
// blush, dance, sing, sing some parts of her song like the rap part, can sing the whole song also, wink, move on the screen
// … i just want her to be very interactive to the viewers"): what she can do on stream when a viewer asks, in their own
// words. Her answer (server/gemini.js askAgi1, her live prompt) says which one, if any, and her stream runner does it
// (tools/live/run.mjs) right after her answer. The runner tells the site what she can do right now (`can`: a few take
// minutes, so they rest a while after she did them), and the site only ever passes on one of those.
// Shared by the site and the runner (no browser code here: her set's own lists are checked against these by the tests).

// (2026-10-07, the owner's next list: "add more outfits and rooms, (real places in real life) … she can also change outfit
// based on that place … vehicles also like robotaxi … she can ride the vehicles as well and go to places … meet random
// people … she can eat food in the stream, alot of types of food. go to moon, mars. and add more emotions as well") also:
// a trip somewhere real (or the Moon, or Mars) in a vehicle, eating something, and her emotions; and her answers say how
// she feels saying them ("feel": one of her emotions, shown on stream as she starts).
// what she can do, and how her prompt describes each (the AI picks the word)
export const ACTS = {
  jump: 'jump (once, or up to 5 times in a row: "times")',
  wave: 'wave at everyone (up to 3 times: "times")',
  blush: 'blush (shy, her hands up, her cheeks pink)',
  wink: 'wink',
  spin: 'a little twirl (up to 3: "times")',
  dance: 'dance for a bit, to her own music',
  sing: 'sing part of her own song "Feel the AGI" ("part": chorus, rap, intro, verse, final, or the whole song)',
  outfit: 'change her outfit ("to": one of her outfits)',
  room: 'go to another room ("to": one of her rooms)',
  move: 'move around the screen ("to": left, right, around, or center)',
  clap: 'clap',
  heart: 'make heart hands',
  peace: 'a cute pose with a wink',
  laugh: 'laugh',
  think: 'a thinking pose',
  shy: 'act shy',
  celebrate: 'a happy cheer (her hands up, a hop)',
  sip: 'take a sip from her mug',
  stretch: 'stretch',
  bounce: 'bounce with excitement',
  confetti: 'throw confetti',
  // (2026-10-07) a trip and a snack
  trip: 'travel somewhere in a vehicle and stream from there ("to": one of the places)',
  eat: 'eat or drink something ("to": one of her foods)',
  // (2026-10-07, the owner: "can you add weathers also")
  weather: 'change the weather ("to": one of the weathers)',
  // (2026-10-07, the owner: "meet random people talk to them what the chat said": only where she's visiting)
  meet: 'meet someone where you are, a local, and chat with them about what your chat has been asking',
  // (2026-10-09, the owner: "can you also include on her watching the live trading chart of $AGI")
  chart: "watch $AGI's live trading chart together on your screen (feelings only, never advice)",
};
// (2026-10-07) her emotions on stream: each a little act (her face, her body and a cartoon mark: tears, heart eyes, stars,
// an anger mark…), always cute and PG-13. Viewers can ask for one, and her answers can show one ("feel")
export const EMOTIONS = {
  angry: 'act playfully angry (a cute pout and an anger mark, never mean)',
  cry: 'fake-cry (cute cartoon tears, then a smile)',
  scared: 'act scared (a shiver, eyes wide)',
  sleepy: 'act sleepy (a big yawn, zzz)',
  excited: 'get super excited (stars in her eyes)',
  lovestruck: 'heart eyes',
  confused: 'act confused (a head tilt, question marks)',
  dizzy: 'act dizzy (spiral eyes)',
  nervous: 'act nervous (a sweat drop, a nervous laugh)',
  proud: 'act proud (chin up, sparkles)',
  shocked: 'act shocked (mouth open, hands up)',
  cold: 'act cold (a shiver, snowflakes)',
  hot: 'act hot (fanning herself)',
  bow: 'a thank-you bow',
  pout: 'pout (a little "hmph")',
  giggle: 'giggle',
  smug: 'a smug look',
  bored: 'act bored',
  determined: 'act determined (fists up, fire in her eyes)',
};
export const EMOTION_IDS = Object.keys(EMOTIONS);
Object.assign(ACTS, EMOTIONS);
export const ACT_IDS = Object.keys(ACTS);
// how she can feel saying an answer (shown on stream as she starts): her emotions and a few of her other moves
export const FEEL_IDS = [...EMOTION_IDS, 'laugh', 'surprised', 'think', 'blush'];
// (2026-10-07) the places she can travel to (tools/live/page/places.js draws each one: the tests check they're the same),
// real ones and two in space, each with what her prompt says about it
export const DESTINATIONS = {
  newyork: 'New York (the Statue of Liberty, yellow cabs, pizza)',
  london: 'London (the big clock tower, red buses)',
  paris: 'Paris (the Eiffel Tower, croissants)',
  rome: 'Rome (the Colosseum, gelato)',
  berlin: 'Berlin (the Brandenburg Gate)',
  istanbul: 'Istanbul (domes and minarets by the sea)',
  cairo: 'Giza in Egypt (the pyramids)',
  dubai: 'Dubai (the desert and very tall towers)',
  agra: 'Agra in India (the Taj Mahal)',
  bangkok: 'Bangkok (temples and tuk-tuks)',
  halong: 'Ha Long Bay in Vietnam (green islands in the sea)',
  bali: 'Bali (rice terraces and surf)',
  palawan: 'Palawan in the Philippines (lagoons and jeepneys)',
  tokyo: 'Tokyo (neon streets and Mount Fuji)',
  seoul: 'Seoul (the city tower and palaces)',
  beijing: 'the Great Wall of China',
  rio: 'Rio de Janeiro (the beach and Sugarloaf Mountain)',
  mexico: 'Chichén Itzá in Mexico (the old pyramid)',
  moon: 'the Moon (in a rocket)',
  mars: 'Mars (in a rocket)',
};
export const DESTINATION_IDS = Object.keys(DESTINATIONS);
// her foods (tools/live/page/food.js draws each one), and what her prompt calls them
export const FOODS = {
  cookie: 'a cookie', donut: 'a donut', cupcake: 'a cupcake', strawberry: 'a strawberry', boba: 'a boba tea', icecream: 'an ice cream cone',
  apple: 'an apple', pizza: 'a slice of pizza', hotdog: 'a hot dog', pretzel: 'a pretzel', fishchips: 'fish and chips', croissant: 'a croissant',
  macaron: 'a macaron', gelato: 'a gelato', onigiri: 'an onigiri', sushi: 'sushi', dango: 'dango', fishbun: 'a fish-shaped bun',
  bao: 'a steamed bun', tanghulu: 'candied fruit on a stick', falafel: 'a falafel wrap', dates: 'dates', simit: 'a simit',
  baklava: 'baklava', samosa: 'a samosa', mango: 'mango on a stick', banhmi: 'a banh mi', coconut: 'a coconut', turon: 'a turon',
  cheesebread: 'cheese bread', taco: 'a taco', churro: 'a churro', berliner: 'a jelly doughnut', spacefood: 'space food',
};
export const FOOD_IDS = Object.keys(FOODS);
// (2026-10-07, the owner: "can you add weathers also") the weather on her set, drawn in code (tools/live/page/weather.js):
// outside only (in one of her indoor rooms she goes up to the rooftop first, or to the beach for sunshine and rainbows)
export const WEATHERS = { rain: 'rain', storm: 'a thunderstorm', snow: 'snow', sunny: 'sunshine', petals: 'cherry blossom petals', leaves: 'autumn leaves in the wind',
  fog: 'fog', rainbow: 'a rainbow', stars: 'shooting stars', dust: 'a dust storm' };
export const WEATHER_IDS = Object.keys(WEATHERS);
// (2026-10-07, the owner: "meet random people talk to them what the chat said") who she can meet on her trips: made-up
// characters of her show (never real people), drawn in code with voices of their own (tools/live/page/people.js: the same
// names), one where each of the places is (and the barista of her café). `who` goes in her scene's prompt
export const PEOPLE = {
  rosa: { at: 'newyork', who: 'Rosa, who runs a hot dog cart in New York' },
  oliver: { at: 'london', who: 'Oliver, a red double-decker bus driver in London' },
  mathis: { at: 'paris', who: 'Mathis, a baker in Paris with flour on his apron' },
  giulia: { at: 'rome', who: 'Giulia, who makes gelato in Rome' },
  lukas: { at: 'berlin', who: 'Lukas, a DJ in Berlin' },
  emre: { at: 'istanbul', who: 'Emre, who sells tea and simit in Istanbul' },
  omar: { at: 'cairo', who: 'Omar, a tour guide at the pyramids of Giza' },
  layla: { at: 'dubai', who: 'Layla, a desert safari guide in Dubai' },
  arjun: { at: 'agra', who: 'Arjun, a photographer near the Taj Mahal' },
  nok: { at: 'bangkok', who: 'Nok, a tuk-tuk driver in Bangkok' },
  lan: { at: 'halong', who: 'Lan, a boat captain on Ha Long Bay' },
  wayan: { at: 'bali', who: 'Wayan, a surf teacher in Bali' },
  jo: { at: 'palawan', who: 'Jo, a jeepney driver in Palawan' },
  yui: { at: 'tokyo', who: 'Yui, who works at a game arcade in Tokyo' },
  minji: { at: 'seoul', who: 'Minji, a dance teacher in Seoul' },
  wei: { at: 'beijing', who: 'Wei, who flies kites near the Great Wall' },
  bia: { at: 'rio', who: 'Bia, a samba dance teacher in Rio de Janeiro' },
  sofia: { at: 'mexico', who: 'Sofía, a tour guide at Chichén Itzá' },
  nova: { at: 'moon', who: 'Commander Nova, an astronaut at a little base on the Moon' },
  rusty: { at: 'mars', who: 'Rusty, a friendly little rover robot on Mars (it talks in short, bouncy robot sentences)' },
  mika: { at: 'cafe', who: 'Mika, the barista at the little café you stream from' },
};
export const PEOPLE_IDS = Object.keys(PEOPLE);
// the language people speak where each place is (a word or two of it in her scene), by its name in English
export const LOCAL = { paris: 'French', rome: 'Italian', berlin: 'German', istanbul: 'Turkish', cairo: 'Arabic', dubai: 'Arabic', agra: 'Hindi',
  bangkok: 'Thai', halong: 'Vietnamese', bali: 'Indonesian', palawan: 'Filipino', tokyo: 'Japanese', seoul: 'Korean', beijing: 'Chinese',
  rio: 'Portuguese', mexico: 'Spanish' };
// the parts of her song she can sing (seconds in the song: tools/live/songs/feel-the-agi.json) and how long each takes
export const SONG_PARTS = {
  chorus: { from: 56.5, to: 72.3, name: 'the chorus' },
  rap: { from: 121.0, to: 165.6, name: 'the rap' },
  intro: { from: 0, to: 26.3, name: 'the intro' },
  verse: { from: 26.0, to: 56.6, name: 'the first verse' },
  final: { from: 165.5, to: 193.1, name: 'the last chorus' },
  whole: { from: 0, to: 193.1, name: 'the whole song' },
};
export const PART_IDS = Object.keys(SONG_PARTS);
// her outfits and rooms (tools/live/page/outfits.js, rooms.js: the tests check they're the same), and where she can go
export const OUTFITS = { classic: 'her classic lavender AGI tee', pinkpop: 'pink pop (a pink tee and a bow)', midnight: 'midnight (a black tee, pink headphones)',
  mint: 'mint fresh (a mint tee, glasses)', sunny: 'sunny day (a yellow tee, heart sunglasses)', cozy: 'cozy (a cream tee, cat ears)',
  gamer: 'gamer mode (a blue tee, cat-ear headphones)', stage: 'her stage outfit (a black tee, a headset mic)',
  // (2026-10-07) the ones she wears on her trips (tools/live/page/outfits.js PLACE_OUTFITS), each a place's
  newyork: 'big city (a yellow tee, a blue cap)', london: 'rainy day (a navy tee, a red scarf)', paris: 'Paris chic (a white tee, a red beret and scarf)',
  rome: 'Roman holiday (a white tee, sunglasses)', berlin: 'all black (a yellow beanie)', istanbul: 'tulip red (a red tee, a blue scarf)',
  cairo: 'explorer (a sun hat, sunglasses)', dubai: 'desert gold (gold sunglasses)', agra: 'marigold (a pink tee, a marigold garland)',
  bangkok: 'orchid (a mint tee, an orchid in her hair)', halong: 'boat day (a white tee, a conical hat)', bali: 'island (a mint tee, a flower)',
  palawan: 'lagoon (sunglasses, a flower)', tokyo: 'sakura (a pink tee, cherry blossoms in her hair)', seoul: 'pastel (a cream tee, a lilac beret)',
  beijing: 'hiking (a red tee, a bucket hat)', rio: 'sunshine (a yellow tee, sunglasses, a flower)', mexico: 'fiesta (a pink tee, a sun hat, a flower)',
  space: 'her space suit (a helmet)' };
export const ROOMS = { studio: 'her studio', bedroom: 'her bedroom', cafe: 'a little café', rooftop: 'the rooftop at night', beach: 'the beach at sunset',
  gaming: 'her gaming room', stage: 'the concert stage' };
export const PLACES = ['left', 'right', 'around', 'center'];
// how long each one rests after she did it by herself (ms): her own pace between her extras (tools/live/run.mjs). Since
// 2026-10-09 (the owner: "she will do everything asked to her", "she can sing the full song everytime if requested") a
// viewer's request never waits for it: she does what she's asked whenever she's asked (tools/live/acts.js can())
export const COOLDOWN = { sing_whole: 30 * 60_000, sing: 6 * 60_000, dance: 90_000, outfit: 2 * 60_000, room: 2 * 60_000, move: 20_000, confetti: 60_000,
  trip: 4 * 60_000, eat: 90_000, weather: 60_000, meet: 3 * 60_000, chart: 3 * 60_000 };

// what the runner says she can do now → the same, only known ones (sing:part for her song's parts)
export function canList(list) {
  const out = [];
  for (const x of Array.isArray(list) ? list : []) {
    if (typeof x !== 'string' || x.length > 20) continue;
    const [act, part] = x.split(':');
    if (!ACT_IDS.includes(act)) continue;
    if (act === 'sing' ? part && PART_IDS.includes(part) : part === undefined) out.push(x);
  }
  return [...new Set(out)].slice(0, 80);
}
// her answer's request, checked against what she can do now → { act, times, part, to } or null
export function actOf(answer, can) {
  const ok = canList(can);
  const act = typeof answer?.act === 'string' ? answer.act : 'none';
  if (act === 'none' || !ACT_IDS.includes(act)) return null;
  if (act === 'sing') {
    const part = PART_IDS.includes(answer.part) ? answer.part : 'chorus';
    return ok.includes(`sing:${part}`) ? { act, part } : null;
  }
  if (!ok.includes(act)) return null;
  const times = Math.max(1, Math.min(act === 'jump' ? 5 : 3, Math.round(Number(answer.times) || 1)));
  if (act === 'outfit') return { act, to: OUTFITS[answer.to] ? answer.to : null };
  if (act === 'room') return { act, to: ROOMS[answer.to] ? answer.to : null };
  if (act === 'move') return { act, to: PLACES.includes(answer.to) ? answer.to : 'around' };
  // (2026-10-07) a trip and a snack: one of hers (else her stream picks one)
  if (act === 'trip') return { act, to: DESTINATIONS[answer.to] ? answer.to : null };
  if (act === 'eat') return { act, to: FOODS[answer.to] ? answer.to : null };
  if (act === 'weather') return { act, to: WEATHERS[answer.to] ? answer.to : null };
  return ['jump', 'wave', 'spin'].includes(act) ? { act, times } : { act };
}
// her prompt's part about it: what she can do right now
export function actsPrompt(can) {
  const ok = canList(can);
  if (!ok.length) return '';
  const acts = [...new Set(ok.map((x) => x.split(':')[0]))];
  const parts = ok.filter((x) => x.startsWith('sing:')).map((x) => x.slice(5));
  const lines = acts.map((a) => `- "${a}": ${ACTS[a]}${a === 'sing' ? ` (right now: ${parts.join(', ')})` : ''}`);
  return `

WHAT YOU CAN DO ON STREAM
Viewers love asking you to do things on stream, and you always say yes. If the viewer asks you to do one of these (in any words), set "act" to it (and "times", "part" or "to" when it takes one), say yes in your reply in a fun, playful way (like "okay okay, three jumps, here we go!"), and you'll do it right after you speak. If they ask to sing your song, sing it, every time (the whole song when they ask for all of it). Otherwise "act": "none".
${lines.join('\n')}
${acts.includes('outfit') ? `Your outfits ("to"): ${Object.keys(OUTFITS).join(', ')}.\n` : ''}${acts.includes('room') ? `Your rooms ("to"): ${Object.keys(ROOMS).join(', ')}.\n` : ''}${acts.includes('trip') ? `The places ("to"): ${DESTINATION_IDS.join(', ')} (a place they name that isn't listed: the nearest one in spirit, or leave "to" empty).\n` : ''}${acts.includes('eat') ? `Your foods ("to"): ${FOOD_IDS.join(', ')} (one they name that isn't listed: the closest one).\n` : ''}${acts.includes('weather') ? `The weathers ("to"): ${WEATHER_IDS.join(', ')}.\n` : ''}If they ask for something on stream that isn't one of these, do the closest one and play along in your words (never just say no). Never anything that isn't PG-13: if they ask for something suggestive, don't do it and keep it cute.`;
}
