// GROWTH STOCK: AGI-1's words, in her voice (lowercase, dry, a little smug about her farm), and the farm's news. The
// stocks' names are real; the farm, the gold, the rates and every bit of news here are made up for the game, and the
// news is about the farm (a fair, a cat video, the hens), never about the companies themselves. Nothing here is about
// real money or anything to buy.
import { tickOf } from './crops.js';
import { DAYS, clockOf } from './seasons.js';

export const pick = (list, roll = Math.random()) => list[Math.floor(roll * list.length) % list.length];
const T = tickOf;

// "today", "tomorrow", "on Thu"
export function whenOf(startH, nowH) {
  const a = clockOf(startH).day, b = clockOf(nowH).day;
  return a <= b ? 'today' : a === b + 1 ? 'tomorrow' : `on ${DAYS[(a - 1) % 7]}`;
}

const TREND = [
  (c, w) => `Robot traders can’t stop talking about ${T(c)} ${w}`, (c, w) => `The farmers’ market wants ${T(c)} ${w}`,
  (c, w) => `${T(c)} is trending in Gradient Hills ${w}`, (c, w) => `The hen house wants ${T(c)} ${w}`,
  (c, w) => `A cat video made ${T(c)} the talk of the hills ${w}`, (c, w) => `Grandma’s book club wants ${T(c)} ${w}`,
  (c, w) => `The robot chefs swapped soup for ${T(c)} ${w}`, (c, w) => `The scarecrow’s newsletter loves ${T(c)} ${w}`,
];
const GLUT = [
  (c, w) => `Everyone planted ${T(c)}: too many shares around ${w}`, (c, w) => `A truckload of ${T(c)} rolls into town ${w}`,
  (c, w) => `The farm next door floods the market with ${T(c)} ${w}`, (c, w) => `${T(c)} is out of fashion in the hills ${w}`,
  (c, w) => `The robot chefs are sick of ${T(c)} ${w}`, (c, w) => `Cheap ${T(c)} rolls in from over the hills ${w}`,
];
const RUMOR = [
  (c) => `Rumour: a robot dreamt about ${T(c)}…`, (c) => `Rumour: the hens are hoarding ${T(c)}…`,
  (c) => `Rumour: ${T(c)} grows twice as fast if you sing to it…`, (c) => `Rumour: the scarecrow knows something about ${T(c)}…`,
  (c) => `Rumour: a whale farm wants every ${T(c)} in the hills…`,
];
// the ticker's headline for a news item (`e` from the plan or the farm's news list)
export function headline(e, nowH) {
  const w = whenOf(e.start, nowH);
  if (e.type === 'fair') return `${e.name} ${w}: ${T(e.crop)} wanted`;
  if (e.type === 'trend') return TREND[(e.why || 0) % TREND.length](e.crop, w);
  if (e.type === 'glut') return GLUT[(e.why || 0) % GLUT.length](e.crop, w);
  if (e.type === 'rumor') return RUMOR[(e.why || 0) % RUMOR.length](e.crop);
  return '';
}
// what a news item does, in a few words (the chart's mark, the chip's dot)
export function effectOf(e) {
  if (e.type === 'glut') return { text: '▼ glut', color: '#ff4d8d', up: false };
  if (e.type === 'rumor') return { text: '? rumour', color: '#ffb02e', up: true };
  return { text: `▲ ${e.type === 'fair' ? 'fair' : 'wanted'}`, color: '#2fd6a6', up: true };
}

// the robots who order shares from the farm (all made up)
export const BUYERS = ['Robo Fund', 'Unit 7', 'Bolt Capital', 'the canteen bot', 'Servo & Sons', 'Pixel Pension'];
const who = (o) => BUYERS[o.who % BUYERS.length];
export const orderText = (o) => `${who(o)} wants ${o.n} ${T(o.crop)}`;

const SAY = {
  open: {
    q1: ['spring. i traded my gpus for a watering can. let’s see.', 'q1. GME first. it grows fast and so do i.', 'my first stock farm. how hard can it be. (don’t answer)'],
    q2: ['summer. the soil dries fast, so water like you mean it.', 'q2. heatwaves, a bull, maybe a bear. normal farm stuff.', 'AMZN gives three shares a plant. i like that kind of math.'],
    q3: ['autumn. BRK.A takes two days and the fair loves it.', 'q3. the bears get hungry this time of year. so do i.', 'harvest season. my favourite word is “harvest”. my second is “gold”.'],
    q4: ['winter. frost slows everything but NFLX.', 'q4. the winter market wants NVDA. the robots want chips. relatable.', 'cold out. warm barn. let’s close the year strong.'],
    daily: ['today’s market is the same for everyone. no pressure. (some pressure)', 'daily farm. same weather, same news, same bear for everybody.'],
    endless: ['no closing bell. just me, the farm, and the quarters going round.', 'endless farm. i’ll be here. the stocks will be here. the bear might be here.'],
  },
  morning: ['good morning. the market’s open and the soil’s waiting.', 'new day. new candles.', 'morning. coffee for me, water for the stocks.', 'another day on the farm. i could get used to this.'],
  weather: {
    rain: ['rain today. free water. nature is the best intern.', 'raining. the sprinklers can take the day off.'],
    heat: ['heatwave. the soil dries twice as fast. keep the water coming.', 'it’s so hot the candles are melting. the chart kind.'],
    frost: ['frost. everything grows slow except NFLX. everyone’s staying in.', 'cold day. bundle up the stocks.'],
    cloud: ['cloudy. soft light. the stocks don’t mind.'],
    sun: ['sunny. good growing weather.'],
  },
  bump: ['bumper crop. never let it go dry and it gives you one more share.', 'look at that. a bumper.', 'an extra share. because i watered. i’m a natural.'],
  spike: [(c) => `our ${T(c)} just jumped. if the barn has some, this might be the moment.`, (c) => `${T(c)} is way up on the farm. i love it when a chart does that.`, (c) => `look at our ${T(c)} go.`],
  crash: [(c) => `our ${T(c)} dropped. maybe hold the barn’s for a bit.`, (c) => `${T(c)} is down bad on the farm. it’ll come back. probably.`],
  bigSale: [(g) => `+${g} gold. the barn is proud of me.`, (g) => `${g} gold in one go. i’m framing that.`, (g) => `${g}. that’s a good sale.`],
  flooded: [(c) => `careful: every ${T(c)} we sell pushes its rate down. spread it out.`, (c) => `we’re flooding the ${T(c)} market. it’ll bounce back if we wait a bit.`],
  rot: ['a ripe one wilted out there. they only wait so long.', 'one wilted on the vine. harvest sooner next time.'],
  full: ['the barn’s full. sell something to make room.', 'no room in the barn. time to sell.'],
  broke: ['not enough gold to plant that. sell something first.', 'we’re out of gold. sell a few.'],
  bear: ['a bear. an actual bear. tap it three times to shoo it.', 'BEAR. the market’s down while it’s here. shoo it!', 'bear market. literally. tap the bear!'],
  shooed: ['and stay out.', 'bye bear. the market’s back.', 'shooed. i’m a farmer AND a bodyguard.'],
  bearFull: ['it ate and left. rude.', 'the bear’s gone. it took some stocks with it.'],
  bull: ['BULL RUN. everything’s worth more for a few hours.', 'a bull just ran through the farm. the whole market’s up.', 'the bull’s here. good time to sell, if you ask me.'],
  order: [(o) => `${who(o)} wants ${o.n} ${T(o.crop)} and pays well. the order’s up top.`, (o) => `an order: ${o.n} ${T(o.crop)}. robots pay extra. they always pay extra.`],
  deliver: [(g) => `delivered. +${g}. robots are great customers.`, (g) => `order done. ${g} gold.`],
  expire: ['the order ran out. the robot’s not mad. just disappointed.'],
  fair: [(c) => `the fair’s on. ${T(c)} is wanted all day.`],
  evening: ['the sun’s going down. stocks keep growing at night.', 'evening. the fireflies are out.'],
  lastDay: ['last day. the bell rings at 6 pm and sells whatever’s left in the barn.', 'sunday. closing bell at 6. plant only what’ll be ready.'],
  bell: ['closing bell in an hour.', 'one hour to the bell. sell what you can.'],
  tips: {
    plant: 'Drag across empty soil to plant the chosen stock.',
    water: 'A drop means dry soil: drag over it to water. Never dry = one more share at harvest.',
    harvest: 'Ripe stocks glow. Drag over them to harvest their shares into the barn.',
    sell: 'Hold Sell to sell, one share at a time. Each one pushes the rate down a little.',
    usual: 'The dashed line is a stock’s usual rate. Above it is a good time to sell.',
    news: 'News moves the farm’s market. Plant what’s wanted so it’s ripe in time.',
    plot: 'Tap a sign to get more land. More plots, more stocks.',
    bear: 'Tap the bear three times before it eats your stocks.',
    order: 'Orders pay more than the market. Deliver from the top of the panel.',
  },
};
export function say(kind, arg, roll = Math.random()) {
  let v = SAY[kind];
  if (v && !Array.isArray(v) && typeof v === 'object') v = v[arg?.key ?? arg] || null;
  if (!v) return '';
  const x = pick(v, roll);
  return typeof x === 'function' ? x(arg) : x;
}
export const TIPS = SAY.tips;

export function endLine(f, roll = Math.random()) {
  if (f.mode === 'endless') return pick([`${f.days} days on the farm. ${f.gold} gold. i’m keeping the hat.`, `we farmed for ${f.days} days. good run.`], roll);
  if (f.stars >= 3) return pick(['three stars. i’m basically a farming legend now.', 'closing bell. perfect quarter. the bear never stood a chance.', 'full marks. the robots are writing songs about our charts.'], roll);
  if (f.stars === 2) return pick(['two stars. solid quarter. next time, sell the spikes.', 'not bad at all. the barn agrees.'], roll);
  if (f.stars === 1) return pick(['one star. we grew things. things were sold. growth.', 'a decent quarter. the next one’s ours.'], roll);
  return pick(['the bell rang and the barn was sad. next time, plant more and sell on the way up.', 'rough quarter. even the scarecrow looks embarrassed.'], roll);
}
export function shareText(f) {
  const where = f.mode === 'daily' ? 'today’s Daily' : f.mode === 'endless' ? `${f.days} endless days` : `${f.q} ${f.season}`;
  return `I farmed ${f.gold} gold in GROWTH STOCK (${where}) 🌱📈 AGI-1’s farm, where stocks grow as candle charts. Made-up rates, play gold only.`;
}
