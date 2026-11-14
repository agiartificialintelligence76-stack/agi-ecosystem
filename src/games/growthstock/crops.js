// GROWTH STOCK: the crops are stocks. AGI-1's farm grows nine real tickers (the owner, 2026-11-14: "i want real stock
// names"): plant a stock and it grows as a little candle chart, rising, until its shares bloom on top as coins; harvest
// them into the barn and sell them on the farm's market. Only the names are real: the rates, the news and everything
// that happens to them are made up, in gold, for the game. The coins are our own drawings (a controller, a cup, a bolt…),
// never a company's logo.
//
// Every stock has: how fast it grows (`grow`, hours), how many shares it gives (`yield`), what planting it costs
// (`seed`), its usual rate on the farm's market (`base`, gold a share), how much that rate wanders (`vol`, per √hour, in
// log terms), how fast it comes back to usual (`rev`, a share an hour), how much one share sold pushes the rate down
// (`impact`), and whether it leaps on a rumour (`jumpy`) or grows faster in the cold and dark (`frost`). At its usual
// rate every stock earns about the same an hour per plot (about 1 gold): the market's moves and the news decide what's
// worth it. A stock never dry while it grew gives one more share (a bumper crop): for BRK.A that's two, the reward for
// two days of care. Shares keep in the barn; a ripe stock left on its plot too long wilts.
// `color` and `deep`: its coin; `glyph`: what's drawn on the coin; `dark`: the glyph in ink (on a light coin).
export const CROPS = Object.freeze({
  gme: { id: 'gme', tick: 'GME', name: 'GameStop', color: '#ff5fa8', deep: '#c22e75', glyph: 'pad', grow: 8, yield: 2, seed: 4, base: 6, vol: 0.1, rev: 0.18, impact: 0.045, blurb: 'Grows fast, cheap to plant. A small market: sell a lot at once and its rate drops.' },
  ko: { id: 'ko', tick: 'KO', name: 'Coca-Cola', color: '#ff4747', deep: '#b81f1f', glyph: 'cup', grow: 12, yield: 3, seed: 5, base: 5.5, vol: 0.04, rev: 0.1, impact: 0.012, blurb: 'Steady. Barely moves, rain or shine.' },
  aapl: { id: 'aapl', tick: 'AAPL', name: 'Apple', color: '#c9d4e3', deep: '#8794a8', glyph: 'phone', dark: true, grow: 16, yield: 2, seed: 8, base: 12, vol: 0.09, rev: 0.15, impact: 0.028, blurb: 'A good all-rounder.' },
  tsla: { id: 'tsla', tick: 'TSLA', name: 'Tesla', color: '#ffc21f', deep: '#c98a00', glyph: 'bolt', dark: true, grow: 24, yield: 3, seed: 15, base: 14, vol: 0.18, rev: 0.25, impact: 0.04, jumpy: true, blurb: 'Swings hard and leaps on rumours.' },
  amzn: { id: 'amzn', tick: 'AMZN', name: 'Amazon', color: '#ff9a3d', deep: '#c4610a', glyph: 'box', dark: true, grow: 20, yield: 3, seed: 12, base: 11, vol: 0.1, rev: 0.17, impact: 0.03, blurb: 'Three shares a plant. Hates going dry.' },
  msft: { id: 'msft', tick: 'MSFT', name: 'Microsoft', color: '#3fa9ff', deep: '#1c6fc0', glyph: 'cloud', grow: 28, yield: 2, seed: 14, base: 22, vol: 0.08, rev: 0.12, impact: 0.022, blurb: 'Slow and solid.' },
  brka: { id: 'brka', tick: 'BRK.A', name: 'Berkshire Hathaway', color: '#6b74ff', deep: '#3a40c0', glyph: 'bank', grow: 44, yield: 1, seed: 30, base: 72, vol: 0.09, rev: 0.12, impact: 0.07, big: true, blurb: 'Takes two days. One big share.' },
  nvda: { id: 'nvda', tick: 'NVDA', name: 'NVIDIA', color: '#62d84c', deep: '#2f9a24', glyph: 'chip', dark: true, grow: 32, yield: 2, seed: 34, base: 34, vol: 0.2, rev: 0.2, impact: 0.05, jumpy: true, blurb: 'Costly to plant and very jumpy.' },
  nflx: { id: 'nflx', tick: 'NFLX', name: 'Netflix', color: '#9b6bff', deep: '#5b2fd0', glyph: 'popcorn', grow: 10, yield: 2, seed: 7, base: 8.5, vol: 0.1, rev: 0.17, impact: 0.035, frost: true, blurb: 'Grows faster in the cold and the dark.' },
});
export const CROP_IDS = Object.freeze(Object.keys(CROPS));
export const cropOf = (id) => CROPS[id] || null;
// a stock's ticker, as it's written everywhere
export const tickOf = (id) => CROPS[id]?.tick || String(id).toUpperCase();
// what a plot earns an hour at the usual rate (seeds paid): the balance sheet the stocks were tuned to
export const hourly = (c) => (c.yield * c.base - c.seed) / c.grow;
