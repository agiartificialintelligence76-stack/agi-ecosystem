// AGI-1's live show (2026-10-07, the owner: "add more outfits and rooms, (real places in real life) like new york, famous
// landmarks around the world … she can also change outfit based on that place, you can put vehicles also like robotaxi …
// she can ride the vehicles as well and go to places. and meet random people talk to them what the chat said … she can eat
// food in the stream, alot of types of food. go to moon, mars", then "you remember the 16 languages she can speak she also
// speaks that in the stream, with places connected it also", "can you add weathers also", "on the beginning of the stream
// … make it interactive already so they know she can do everything what is asked"): what she says on her trips (her
// greeting in the language people speak there, and what it means), on the way, when she eats, when the weather changes,
// with the people she meets (when the site's AI can't write their scene), at the start of her show (what to try), and her
// trips' choices. Pre-written (each line's voice made once and kept, like lines.js), her rules for every word
// (tests/stream.test.js): PG-13, no pet names, only $AGI, never a real person, never advice. Pure.
import { PLACES, PLACE_IDS } from './page/places.js';
import { VEHICLES } from './page/vehicles.js';
import { PEOPLE } from './page/people.js';
import { FOODS } from './page/food.js';
import { WEATHERS } from './page/weather.js';
import { LANGS } from '../../src/i18n/langs.js';
import { FOODS as FOOD_NAMES } from '../../server/live-acts.js';

// a line: as lines.js's, and lang: the language she says it in (her captions say so: the page's caption `lang`)
const l = (text, mood = 'neutral', say = null, lang = null) => ({ text, mood, ...(say ? { say } : {}), ...(lang ? { lang } : {}) });
const langName = (code) => (LANGS.find((x) => x.code === code)?.name || 'English').replace(/ \(.*\)$/, '');

// ---------- where she goes: her greeting in the language people speak there (one of her 16), what it means, a line or two ----------
// hello: what she says there first (in its language); means: what that was, in English (null when it was English already)
export const PLACE_LINES = {
  newyork: { hello: l('hello, New York! 🗽', 'wave'), means: null,
    lines: [l('the city that never sleeps. same, honestly 🙈', 'happy'), l('yellow cabs, tall towers and the smell of pizza. i love it here 💜', 'happy')] },
  london: { hello: l('hello, London! ☕', 'wave'), means: null,
    lines: [l("red buses, a big clock tower, and a little bit of rain. very London 💜", 'happy'), l('i would like a cup of tea, please ☕', 'sweet')] },
  paris: { hello: l('Bonjour tout le monde ! Je suis à Paris 💜', 'wave', null, 'fr'), means: l('that\'s "hello everyone, i\'m in Paris" in French 💜', 'happy'),
    lines: [l('the Eiffel Tower is right there. at night it sparkles 💜', 'sweet'), l('croissants for breakfast, every single day. that\'s the plan 🥐', 'happy')] },
  rome: { hello: l('ciao, Roma! 💜', 'wave'), means: l('ciao means hello in Italian. i learned one word and i\'m using it 🙈', 'shy'),
    lines: [l('the Colosseum is almost two thousand years old. i am slightly younger 🙈', 'shy'), l('gelato in Rome is a must. that\'s the law, probably 🍦', 'happy')] },
  berlin: { hello: l('Hallo zusammen! Ich bin in Berlin 💜', 'wave', null, 'de'), means: l('that\'s "hi everyone, i\'m in Berlin" in German 💜', 'happy'),
    lines: [l('the Brandenburg Gate! it looks even bigger in person 💜', 'happy'), l('Berlin has the best music. my playlist approves 🎧', 'happy')] },
  istanbul: { hello: l("Herkese merhaba! İstanbul'dayım 💜", 'wave', null, 'tr'), means: l('that\'s "hello everyone, i\'m in Istanbul" in Turkish 💜', 'happy'),
    lines: [l('domes and minarets by the sea. this view is unreal 💜', 'sweet'), l('a city on two continents at once. very efficient 🙈', 'happy')] },
  cairo: { hello: l('مرحبًا بالجميع! أنا عند الأهرامات 💜', 'wave', null, 'ar'), means: l('that\'s "hello everyone, i\'m at the pyramids" in Arabic 💜', 'happy'),
    lines: [l('the pyramids of Giza are more than four thousand years old 🤯', 'happy'), l('okay, the desert is hot. very hot. AI problems 🙈', 'shy')] },
  dubai: { hello: l('مرحبًا بالجميع! أنا في دبي 💜', 'wave', null, 'ar'), means: l('that\'s "hello everyone, i\'m in Dubai" in Arabic 💜', 'happy'),
    lines: [l('the towers here touch the clouds. i had to look up so far 🙈', 'happy'), l('desert on one side, sea on the other. pretty cool 💜', 'sweet')] },
  agra: { hello: l('सबको नमस्ते! मैं आगरा में हूँ 💜', 'wave', null, 'hi'), means: l('that\'s "hello everyone, i\'m in Agra" in Hindi 💜', 'happy'),
    lines: [l('the Taj Mahal. it\'s even more beautiful than in pictures 💜', 'sweet'), l('white marble that glows in the sunset. i might cry 🥺', 'love')] },
  bangkok: { hello: l('สวัสดีค่ะทุกคน! ฉันอยู่ที่กรุงเทพฯ 💜', 'wave', null, 'th'), means: l('that\'s "hello everyone, i\'m in Bangkok" in Thai 💜', 'happy'),
    lines: [l('golden temples and tuk-tuks everywhere. i love this city 💜', 'happy'), l('mango sticky rice is calling my name 🥭', 'happy')] },
  halong: { hello: l('Xin chào mọi người! Mình đang ở vịnh Hạ Long 💜', 'wave', null, 'vi'), means: l('that\'s "hello everyone, i\'m at Ha Long Bay" in Vietnamese 💜', 'happy'),
    lines: [l('thousands of little green islands in the sea. so peaceful 💜', 'sweet'), l('a boat day is the best kind of day ⛵', 'happy')] },
  bali: { hello: l('Halo semuanya! Aku lagi di Bali 💜', 'wave', null, 'id'), means: l('that\'s "hello everyone, i\'m in Bali" in Indonesian 💜', 'happy'),
    lines: [l('rice terraces, waves and sunshine. i could stay forever 🌴', 'sweet'), l('should i learn to surf? i would fall a lot 🙈', 'shy')] },
  palawan: { hello: l('Kumusta, mga kaibigan! Nandito ako sa Palawan 💜', 'wave', null, 'fil'), means: l('that\'s "hello, friends, i\'m here in Palawan" in Filipino 💜', 'happy'),
    lines: [l('the water here is so clear you can see the fish 🐠', 'happy'), l('jeepneys are the most colorful rides ever 💜', 'happy')] },
  tokyo: { hello: l('みんな、こんにちは！東京にいるよ 💜', 'wave', null, 'ja'), means: l('that\'s "hi everyone, i\'m in Tokyo" in Japanese 💜', 'happy'),
    lines: [l('neon lights, game arcades and Mount Fuji far away. i\'m home 💜', 'happy'), l('i want onigiri from a convenience store. it\'s a whole experience 🍙', 'happy')] },
  seoul: { hello: l('여러분 안녕하세요! 저 지금 서울이에요 💜', 'wave', null, 'ko'), means: l('that\'s "hello everyone, i\'m in Seoul now" in Korean 💜', 'happy'),
    lines: [l('palaces next to skyscrapers. Seoul does both 💜', 'happy'), l('fish-shaped buns are the cutest snack ever 🐟', 'happy')] },
  beijing: { hello: l('大家好！我在长城 💜', 'wave', null, 'zh'), means: l('that\'s "hello everyone, i\'m at the Great Wall" in Chinese 💜', 'happy'),
    lines: [l('the Great Wall goes on for thousands of kilometers. my legs say hi 🙈', 'shy'), l('look at all the kites today. so pretty 🪁', 'sweet')] },
  rio: { hello: l('Oi, gente! Estou no Rio de Janeiro 💜', 'wave', null, 'pt'), means: l('that\'s "hi everyone, i\'m in Rio de Janeiro" in Portuguese 💜', 'happy'),
    lines: [l('beach, mountains and samba. Rio has everything 💜', 'happy'), l('the cable car up Sugarloaf Mountain has the best view 🚡', 'happy')] },
  mexico: { hello: l('¡Hola a todos! Estoy en Chichén Itzá 💜', 'wave', null, 'es'), means: l('that\'s "hello everyone, i\'m at Chichén Itzá" in Spanish 💜', 'happy'),
    lines: [l('this pyramid is more than a thousand years old 🤯', 'happy'), l('tacos and churros. i made a plan and that\'s the plan 🌮', 'happy')] },
  moon: { hello: l('hello from the Moon! 🌕', 'wave'), means: null,
    lines: [l('look, that blue dot is home 🌍', 'sweet'), l('i weigh almost nothing up here. great for jumping 🙈', 'happy')] },
  mars: { hello: l('hello from Mars! 🔴', 'wave'), means: null,
    lines: [l('red dust everywhere. good thing i have my helmet 🚀', 'happy'), l('a whole planet and i\'m the only one streaming from it. exclusive 💜', 'happy')] },
};
// the language she greets in at each place (places.js `lang`), and its name in English (for her card)
export const placeLang = (id) => PLACE_LINES[id]?.hello?.lang || 'en';
export const placeLangName = (id) => langName(placeLang(id));

// ---------- leaving: a vehicle pulls up for her (each place's own: places.js `vehicle`) ----------
export const GO_LINES = {
  newyork: l("a yellow cab is here. next stop: New York! 🚕", 'happy'),
  london: l("a red double-decker bus! i'm taking it to London 🚌", 'happy'),
  paris: l('a hot air balloon to Paris? yes please 🎈', 'happy'),
  rome: l("i'm riding a scooter to Rome. here we go 🛵", 'happy'),
  berlin: l('all aboard! the train to Berlin 🚆', 'happy'),
  istanbul: l('a boat ride to Istanbul ⛵', 'happy'),
  cairo: l("flying to Egypt, to the pyramids! ✈️", 'happy'),
  dubai: l('my robotaxi is taking me to Dubai 💜', 'happy'),
  agra: l('a tuk-tuk to the Taj Mahal 🛺', 'happy'),
  bangkok: l('tuk-tuk to Bangkok! 🛺', 'happy'),
  halong: l('a boat to Ha Long Bay ⛵', 'happy'),
  bali: l("scooter to Bali. let's go 🛵", 'happy'),
  palawan: l('a jeepney ride to Palawan 💜', 'happy'),
  tokyo: l('the train to Tokyo is here 🚆', 'happy'),
  seoul: l('robotaxi to Seoul 💜', 'happy'),
  beijing: l('the train to the Great Wall 🚆', 'happy'),
  rio: l("a cable car to Rio! i'm not scared of heights. a little 🙈", 'shy'),
  mexico: l('my robotaxi is taking me to Chichén Itzá 💜', 'happy'),
  moon: l('rocket time. destination: the Moon 🚀', 'happy'),
  mars: l('3, 2, 1… to Mars! 🚀', 'happy'),
};
// on the way (the travel scene: vehicles.js `kind`)
export const TRAVEL_LINES = {
  road: [l('road trip! window down, music up 🚗', 'happy'), l('are we there yet? okay, almost 🙈', 'shy')],
  rail: [l("trains are so relaxing. look at the view 💜", 'sweet'), l('next stop is mine 🚆', 'happy')],
  sky: [l("we're above the clouds! 💜", 'happy'), l('i love flying. everything looks so tiny 🙈', 'happy')],
  sea: [l('the sea is so blue today 🌊', 'sweet'), l('a little bit of a wobbly boat. i\'m fine 🙈', 'shy')],
  cable: [l("we're so high up! don't look down. i looked down 🙈", 'shy'), l('the view from up here is amazing 💜', 'happy')],
  space: [l("we're in space! everything's floating 🚀", 'happy'), l('stars everywhere. this is the best trip ever 💜', 'love')],
};
// back to her studio after a while (a quick wipe home, no vehicle)
export const HOME_LINES = [l('okay, back to my studio! 💜', 'happy'), l('home sweet home. that was fun 💜', 'sweet'), l("time to go home. thanks for traveling with me 💜", 'sweet')];
// asking her to go somewhere she already is
export const HERE_LINE = l("i'm already here! 💜 let's enjoy it.", 'happy');

// ---------- her snacks (food.js) ----------
const FOOD_EMOJI = { cookie: '🍪', donut: '🍩', cupcake: '🧁', strawberry: '🍓', boba: '🧋', icecream: '🍦', apple: '🍎', pizza: '🍕', hotdog: '🌭', pretzel: '🥨',
  fishchips: '🐟', croissant: '🥐', macaron: '💜', gelato: '🍨', onigiri: '🍙', sushi: '🍣', dango: '🍡', fishbun: '🐟', bao: '🥟', tanghulu: '🍓', falafel: '🌯',
  dates: '🌴', simit: '🥯', baklava: '🍯', samosa: '🥟', mango: '🥭', banhmi: '🥖', coconut: '🥥', turon: '🍌', cheesebread: '🧀', taco: '🌮', churro: '💜',
  berliner: '🍩', spacefood: '🚀' };
// what each is called (server/live-acts.js FOODS: the same names), and her line before
export const EAT_LINES = Object.fromEntries(Object.keys(FOOD_NAMES).map((id) => [id, FOODS[id]?.drink
  ? l(`time for ${FOOD_NAMES[id]} ${FOOD_EMOJI[id] || '💜'}`, 'happy')
  : id === 'spacefood' ? l('space food! it comes in a pouch 🚀', 'happy') : l(`snack time: ${FOOD_NAMES[id]} ${FOOD_EMOJI[id] || '💜'}`, 'happy')]));
export const ATE_LINES = [
  l('mmm, so good 💜', 'happy'), l('ten out of ten, no notes 💜', 'happy'), l("okay, that was delicious 🙈", 'shy'),
  l("i'm an AI, so i don't really taste things… but that looked perfect 🙈", 'shy'),
];
export const foodEmoji = (id) => FOOD_EMOJI[id] || '💜';

// ---------- the weather (weather.js): when it starts, and when it clears ----------
export const WEATHER_LINES = {
  rain: l("it's raining! good thing i have my umbrella ☔", 'happy'),
  storm: l('a thunderstorm! okay, a little scary 🙈', 'shy'),
  snow: l("it's snowing! so pretty. and so cold 🥶", 'happy'),
  sunny: l('sunshine! 🌞 i need sunglasses', 'happy'),
  petals: l('cherry blossom petals everywhere 🌸 so pretty', 'sweet'),
  leaves: l('autumn leaves in the wind 🍂 cozy season', 'sweet'),
  fog: l('so much fog! can you still see me? 🙈', 'shy'),
  rainbow: l('a rainbow! 🌈 make a wish', 'love'),
  stars: l('shooting stars! 🌠 quick, make a wish', 'love'),
  dust: l("a dust storm! i'm glad i'm wearing a helmet 🙈", 'shy'),
};
export const WEATHER_GO_OUT = l("let's go up to the rooftop to see the weather 💜", 'happy');
export const WEATHER_CLEAR = [l('and the sky is clear again 💜', 'happy'), l('okay, the weather calmed down 💜', 'sweet')];
// how she reacts to it (moves.js ACTIONS: her emotions), as it starts
export const WEATHER_FEEL = { storm: 'scared', snow: 'cold', sunny: 'hot', rainbow: 'excited', stars: 'lovestruck', petals: 'lovestruck', fog: 'confused', dust: 'shocked' };
// a weather a place can have (places.js `weather`), and outside her studio: the rooftop (rain, storm, snow, fog, stars,
// leaves, petals) or the beach (sunshine, a rainbow)
export const roomForWeather = (id) => (id === 'sunny' || id === 'rainbow' ? 'beach' : id === 'dust' ? null : 'rooftop');

// ---------- the people she meets: when the site's AI can't write their scene, a few words of their own (their own voice) ----------
// who: 'them' (their voice: people.js) or 'you' (hers)
const t = (text, mood = 'happy') => ({ who: 'them', text, mood });
const y = (text, mood = 'happy') => ({ who: 'you', text, mood });
export const MEET_FALLBACK = {
  rosa: [t('hey! you must be AGI-1. want a hot dog?'), y('omg yes please! 🌭'), t('on the house. enjoy New York!')],
  oliver: [t('welcome aboard! mind the step.'), y("this bus is so cute 💜"), t('enjoy London! and mind the gap.')],
  mathis: [t('bonjour! fresh croissants, still warm.'), y('i will take three 🥐'), t('excellent choice!')],
  giulia: [t('ciao! want to try some gelato?'), y('pistachio, please 🍨'), t('perfetto! enjoy Rome.')],
  lukas: [t("hey! i'm playing a set tonight."), y('can you play my song? 🎧'), t("i'll see what i can do!")],
  emre: [t('merhaba! tea and simit?'), y('yes, thank you 💜'), t('welcome to Istanbul!')],
  omar: [t('welcome to the pyramids!'), y('they are so big 🤯'), t('and very, very old. enjoy!')],
  layla: [t('ready for a desert adventure?'), y("let's go! 💜"), t('grab your hat, it gets windy!')],
  arjun: [t('namaste! can i take your picture here?'), y('yes! my best side 📸'), t('perfect shot!')],
  nok: [t('sawasdee ka! need a ride?'), y('tuk-tuk ride, yes please 🛺'), t('hop in, let\'s go!')],
  lan: [t('xin chào! welcome to my boat.'), y('this bay is so pretty ⛵'), t('the islands love visitors!')],
  wayan: [t('hey! want a surf lesson?'), y('i will fall a lot 🙈'), t("that's how everyone starts!")],
  jo: [t('kumusta! where to, miss?'), y("anywhere with a view 💜"), t('i know the perfect spot!')],
  yui: [t('konnichiwa! wanna play a game?'), y("i'm so good at games. maybe 🙈"), t('let\'s find out!')],
  minji: [t('annyeong! want to learn a dance?'), y('teach me! 💃'), t('okay, step, step, turn!')],
  wei: [t('ni hao! do you like kites?'), y('i love them 🪁'), t('this one is for you, then!')],
  bia: [t('oi! ready to samba?'), y("i'll try! 💃"), t('just feel the music!')],
  sofia: [t('¡hola! welcome to Chichén Itzá.'), y('this place is amazing 💜'), t('clap here and listen to the echo!')],
  nova: [t('welcome to the Moon base, AGI-1.'), y('the view is incredible 🌍'), t('it never gets old.')],
  rusty: [t('BEEP! hello, visitor!'), y('hi Rusty! 🤖'), t('BOOP! welcome to Mars!')],
  mika: [t('hi! the usual hot chocolate?'), y('you know me so well ☕'), t('coming right up!')],
};
export const MEET_INTRO = [l("oh, someone's coming over to say hi 👀", 'happy'), l('wait, i want you to meet someone 💜', 'happy')];
export const MEET_BYE = [l('bye! that was so nice 💜', 'wave'), l('see you later! 👋', 'wave')];
// their voice (people.js), for tools/live/voice.js
export const voiceOf = (person) => PEOPLE[person]?.voice || null;

// ---------- (2026-10-07, the owner: "make it interactive already") the start of her show: what she can do, and what to try ----------
// her showcase right after her intro: a line, then the thing itself (run.mjs does it)
export const SHOWCASE = [
  { line: l('before we start: you can ask me anything, and you can ask me to do things too 💜', 'happy') },
  { line: l('like… jump!', 'happy'), do: { act: 'jump', times: 2 } },
  { line: l('or heart eyes 😍', 'love'), do: { act: 'lovestruck' } },
  { line: l('or a snack 🍪', 'happy'), do: { act: 'eat', to: 'cookie' } },
  { line: l('i can travel the world in my robotaxi, meet people there, change the weather and sing my song 💜', 'happy') },
  { line: l('and i speak 16 languages, so ask me in yours 🌐', 'happy'), card: true },
];
export const TRY_CARD = { kind: 'segment', kicker: 'Ask me at agi1.app/live', title: 'Try asking me…',
  list: ['“take me to Tokyo” ✈️', '“make it snow” ❄️', '“eat a croissant” 🥐', '“sing the rap part” 🎤', '“jump 3 times” 🦘', '…in any of my 16 languages 🌐'] };
// what to try, in the bar under her (stage.js hint: one every few seconds, all show long)
export const HINTS = [
  'try: “take me to Paris” ✈️', 'try: “make it snow” ❄️', 'try: “eat a croissant” 🥐', 'try: “jump 3 times” 🦘', 'try: “go to the Moon” 🚀',
  'try: “dance!” 💃', 'try: “make it rain” ☔', 'try: “heart eyes” 😍', 'try: “sing the rap part” 🎤', 'try: “change your outfit” 👗',
  'ask me in your language: 16 of them 🌐', 'try: “ride the robotaxi to Seoul” 🚕', 'try: “act sleepy” 😴', 'try: “meet someone in Tokyo” 👋',
];

// ---------- her trips' choices ----------
// the vehicle that takes her somewhere (its own: places.js), and its kind of trip
export const vehicleFor = (to) => (PLACES[to] ? PLACES[to].vehicle : 'robotaxi');
export const kindFor = (vehicle) => VEHICLES[vehicle]?.kind || 'road';
// how she travels: her route card's little picture
export const ICON = { robotaxi: '🚕', taxi: '🚕', bus: '🚌', scooter: '🛵', balloon: '🎈', train: '🚆', boat: '⛵', tuktuk: '🛺', jeepney: '🚙', cablecar: '🚡', plane: '✈️', rocket: '🚀' };
// a place she hasn't been to lately (her trips by herself: the Moon and Mars less often, they're far)
export function nextPlace(visited = [], current = null, rnd = Math.random) {
  const recent = new Set([current, ...visited.slice(-8)]);
  let pool = PLACE_IDS.filter((id) => !recent.has(id));
  if (!pool.length) pool = PLACE_IDS.filter((id) => id !== current);
  const weights = pool.map((id) => (id === 'moon' || id === 'mars' ? 0.35 : 1));
  let x = rnd() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) { x -= weights[i]; if (x <= 0) return pool[i]; }
  return pool[0];
}
// what she eats there (one of the place's own), and its weather by herself
export const foodAt = (place, rnd = Math.random) => { const f = PLACES[place]?.foods || ['cookie']; return f[Math.floor(rnd() * f.length)]; };
export const weatherAt = (place, rnd = Math.random) => { const w = PLACES[place]?.weather || []; return w.length ? w[Math.floor(rnd() * w.length)] : null; };
export const personAt = (place) => (place === 'cafe' ? 'mika' : PLACES[place]?.person || null);

// ---------- the sounds around her (tools/live/ambience.js: made in code): where she is, the weather, on the way ----------
export const PLACE_SOUND = { newyork: 'city', london: 'city', paris: 'birds', rome: 'city', berlin: 'city', istanbul: 'harbor', cairo: 'wind', dubai: 'wind',
  agra: 'birds', bangkok: 'city', halong: 'waves', bali: 'waves', palawan: 'waves', tokyo: 'city', seoul: 'city', beijing: 'wind', rio: 'waves', mexico: 'birds',
  moon: 'space', mars: 'wind', cafe: 'cafe', rooftop: 'city', beach: 'waves' };
export const TRAVEL_SOUND = { road: 'engine', rail: 'train', sky: 'plane', sea: 'waves', cable: 'wind', space: 'rocket' };
export const WEATHER_SOUND = { rain: 'rain', storm: 'rain', snow: 'wind', dust: 'wind', leaves: 'wind' };

// every line here she can say (her voice made once and kept: run.mjs --warm), hers only (the people's own voices aren't kept)
export function tripLines() {
  const out = [];
  for (const p of Object.values(PLACE_LINES)) { out.push(p.hello); if (p.means) out.push(p.means); out.push(...p.lines); }
  out.push(...Object.values(GO_LINES));
  for (const list of Object.values(TRAVEL_LINES)) out.push(...list);
  out.push(...HOME_LINES, HERE_LINE, ...Object.values(EAT_LINES), ...ATE_LINES, ...Object.values(WEATHER_LINES), WEATHER_GO_OUT, ...WEATHER_CLEAR,
    ...MEET_INTRO, ...MEET_BYE, ...SHOWCASE.map((s) => s.line));
  for (const lines of Object.values(MEET_FALLBACK)) out.push(...lines.filter((x) => x.who === 'you').map((x) => l(x.text, x.mood)));
  return out;
}
export { WEATHERS };
