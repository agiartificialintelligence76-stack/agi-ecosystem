// GROWTH STOCK: the page around the field, made with DOM methods and the arcade kit's sticker look: AGI-1 and the news
// at the top; under the field (beside it on a wide screen) the market: an order from a robot buyer, a chip per stock
// (its coin, ticker, rate, change, a day's sparkline, what's in the barn), the chosen stock's chart and the Sell button,
// and the farm's tools (the barn, sprinklers, more barn, compost, speed). Styles are in style.css (`gs-` classes); sizes set
// in code go through the CSSOM, never a style attribute.
import { el } from '../kit/shell.js';
import { REDUCED } from '../kit/env.js';
import { fmt } from '../kit/fx.js';
import { CROPS } from './crops.js';
import { SEASONS, MAX_STARS, WEATHER } from './seasons.js';
import { produceIcon, drawBear, drawBull, INK } from './art.js';
import { drawSpark, drawCandles, fmtRate } from './chart.js';
import { STICKERS, totalStars, seasonOpen } from './progress.js';

const FACE = '/images/agi1-portrait-2d.webp';
const pct = (x) => `${x >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(x * 100))}%`;

export function createUI(stage, on) {
  // ---------- the top: AGI-1, what she says, the news, the weather ----------
  const sayText = el('p');
  const say = el('div', { class: 'gs-say', hidden: true, 'aria-live': 'polite' }, el('span', 'ak-sr', 'AGI-1: '), sayText);
  const tickIn = el('span', 'gs-tick-in', '');
  const tickText = el('span', 'gs-tick-text', tickIn);
  const tickTag = el('span', 'gs-tick-tag', 'NEWS');
  const weather = el('span', 'gs-weather', '');
  const news = el('div', 'gs-news',
    el('div', 'gs-her', el('img', { src: FACE, alt: '', width: 48, height: 48, draggable: 'false' })),
    el('div', { class: 'gs-ticker', role: 'status' }, tickTag, tickText), weather, say);
  const tipText = el('span');
  const tip = el('div', { class: 'gs-tip', hidden: true, role: 'note' }, el('b', null, 'Tip'), tipText);
  const field = el('div', { class: 'gs-field', 'aria-hidden': 'true' }, tip);

  // ---------- the market ----------
  const orderText = el('span', 'gs-order-text', '');
  const orderMeta = el('span', 'gs-order-meta', '');
  const orderBtn = el('button', { class: 'gs-btn gs-btn-order', type: 'button', onclick: () => on.deliver() }, 'Deliver');
  const order = el('div', { class: 'gs-order', hidden: true }, el('span', { class: 'gs-order-bot', 'aria-hidden': 'true' }, '🤖'), el('div', 'gs-order-main', orderText, orderMeta), orderBtn);
  const chips = el('div', { class: 'gs-chips', role: 'radiogroup', 'aria-label': 'Stocks: pick one to plant and to see its chart' });
  const chipBy = {};
  const tName = el('b', 'gs-trade-name', '');
  const tCo = el('span', 'gs-trade-co', '');
  const tRate = el('span', 'gs-trade-rate', '');
  const tChg = el('span', 'gs-trade-chg', '');
  const tUsual = el('span', 'gs-trade-usual', '');
  const tNews = el('div', { class: 'gs-trade-news', hidden: true });
  const chart = el('canvas', { class: 'gs-chart', role: 'img', 'aria-label': 'The stock’s chart on the farm’s market: a candle a day' });
  const seedInfo = el('div', 'gs-seedinfo', '');
  const sellN = el('b', null, '0');
  const sellSub = el('small', null, '');
  const sell = el('button', { class: 'gs-btn gs-sell', type: 'button', 'aria-label': 'Hold to sell' }, el('span', null, 'Hold to sell'), sellN, sellSub);
  const trade = el('div', 'gs-trade',
    el('div', 'gs-trade-head', el('span', 'gs-trade-id', tName, tCo), tRate, tChg, tUsual), tNews, chart,
    el('div', 'gs-trade-foot', seedInfo, sell));
  const barnFill = el('i');
  const barnNum = el('span', 'gs-barn-num', '0/40');
  const barn = el('div', { class: 'gs-barn', role: 'meter', 'aria-label': 'Barn', 'aria-valuemin': 0, 'aria-valuemax': 40, 'aria-valuenow': 0 }, el('span', 'gs-barn-label', 'Barn'), el('span', 'gs-barn-bar', barnFill), barnNum);
  const buyBtn = (what, label) => {
    const cost = el('small', null, '');
    const b = el('button', { class: 'gs-btn gs-buy', type: 'button', 'data-buy': what, onclick: () => on.buy(what) }, el('span', null, label), cost);
    b._cost = cost; return b;
  };
  const buys = { sprinkler: buyBtn('sprinkler', 'Sprinklers'), barn: buyBtn('barn', 'Bigger barn'), compost: buyBtn('compost', 'Compost') };
  const fast = el('button', { class: 'gs-btn gs-fast', type: 'button', 'aria-pressed': 'false', 'aria-label': 'Double speed', onclick: () => on.fast() }, '»');
  const tools = el('div', 'gs-tools', barn, buys.sprinkler, buys.barn, buys.compost, fast);
  const panel = el('div', 'gs-panel', order, chips, trade, tools);
  const root = el('div', 'gs-ui', news, field, panel);
  stage.append(root);

  // hold to sell: one at once, then faster and faster while it's held
  let holdT = 0, holdGap = 0, holding = false;
  const stopHold = () => { holding = false; sell.classList.remove('is-held'); on.sellEnd?.(); };
  sell.addEventListener('pointerdown', (e) => { if (e.button > 0) return; e.preventDefault(); try { sell.setPointerCapture(e.pointerId); } catch { /* fine */ } holding = true; holdT = 0; holdGap = 0.28; sell.classList.add('is-held'); on.sellOne(); });
  sell.addEventListener('pointerup', stopHold);
  sell.addEventListener('pointercancel', stopHold);
  sell.addEventListener('lostpointercapture', () => { if (holding) stopHold(); });
  sell.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); holding = true; holdT = 0; holdGap = 0.28; sell.classList.add('is-held'); on.sellOne(); } });
  sell.addEventListener('keyup', (e) => { if (e.key === 'Enter' || e.key === ' ') stopHold(); });
  sell.addEventListener('contextmenu', (e) => e.preventDefault());

  let sayTimer = 0, tipTimer = 0, crops = [], sel = null, last = {}, armed = null, armT = 0, tickList = [], tickI = 0, tickT = 0, tickHold = 4.2;
  const api = {
    root, field, panel, news, sell, chips,
    // the stocks of the season: a chip each
    setCrops(list, chosen) {
      crops = list; chips.replaceChildren();
      for (const k in chipBy) delete chipBy[k];
      for (const id of list) {
        const c = CROPS[id];
        const rate = el('span', 'gs-chip-rate', '');
        const chg = el('span', 'gs-chip-chg', '');
        const spark = el('canvas', { class: 'gs-spark', 'aria-hidden': 'true' });
        const have = el('span', { class: 'gs-chip-have', hidden: true }, '0');
        const dot = el('span', { class: 'gs-chip-dot', hidden: true });
        const b = el('button', { class: 'gs-chip', type: 'button', role: 'radio', 'aria-checked': 'false', 'aria-label': `${c.tick}, ${c.name}`, title: `${c.tick} · ${c.name}. ${c.blurb}`, 'data-crop': id, onclick: () => on.pick(id) },
          el('span', 'gs-chip-ico', produceIcon(id, 26), have, dot),
          el('span', 'gs-chip-main', el('span', 'gs-chip-name', c.tick), rate, chg), spark);
        chipBy[id] = { b, rate, chg, spark, have, dot };
        chips.append(b);
      }
      root.dataset.n = String(list.length);
      api.select(chosen);
    },
    select(id) {
      sel = id;
      for (const k in chipBy) { const on1 = k === id; chipBy[k].b.setAttribute('aria-checked', String(on1)); chipBy[k].b.classList.toggle('is-on', on1); }
      last = {};
    },
    // where a stock's chip is (its shares fly there), where the Sell button and the barn are
    chipAt(id) { const b = chipBy[id]?.b; return b ? center(b, stage) : null; },
    sellAt() { return center(sell, stage); },
    barnAt() { return center(barn, stage); },
    fieldRect() { const r = field.getBoundingClientRect(), s = stage.getBoundingClientRect(); return { x: r.left - s.left, y: r.top - s.top, w: r.width, h: r.height }; },
    // AGI-1 speaks
    say(text, ms = 3200) {
      if (!text) return;
      sayText.textContent = text; say.hidden = false;
      say.classList.remove('is-in'); void say.offsetWidth; say.classList.add('is-in');
      clearTimeout(sayTimer); sayTimer = setTimeout(() => { say.hidden = true; }, ms);
    },
    hush() { clearTimeout(sayTimer); say.hidden = true; },
    tip(text, ms = 6000) {
      clearTimeout(tipTimer);
      if (!text) { tip.hidden = true; return; }
      tipText.textContent = text; tip.hidden = false;
      tip.classList.remove('is-in'); void tip.offsetWidth; tip.classList.add('is-in');
      tipTimer = setTimeout(() => { tip.hidden = true; }, ms);
    },
    // the ticker goes round its items every few seconds
    ticker(items) {
      const cur = tickList[tickI]?.text;
      tickList = items;
      if (tickI >= items.length) tickI = 0;
      if (!cur || items[tickI]?.text !== cur) { tickT = 0; showTick(); }
    },
    weather(today, tomorrow) {
      const a = WEATHER[today], b = WEATHER[tomorrow];
      weather.replaceChildren(el('span', 'gs-w-now', `${a.icon} ${a.name}`), b ? el('span', 'gs-w-next', ` · next ${b.icon}`) : '');
      weather.title = b ? `Today: ${a.name}. Tomorrow: ${b.name}.` : a.name;
    },
    order(o, text, meta, can) {
      order.hidden = !o;
      if (!o) return;
      orderText.textContent = text; orderMeta.textContent = meta;
      orderBtn.disabled = !can; order.classList.toggle('is-ready', can);
    },
    // a buy button asks twice: the first tap arms it ("Tap again"), the second buys
    arm(what) { armed = what; armT = 2.6; },
    armed: () => armed,
    // every frame: the numbers that changed
    update(v, dt, t) {
      if (holding) { holdT += dt; if (holdT >= holdGap) { holdT = 0; holdGap = Math.max(0.06, holdGap * 0.82); on.sellOne(); } }
      if (armed) { armT -= dt; if (armT <= 0) armed = null; }
      tickT += dt; if (tickT > tickHold && tickList.length > 1) { tickT = 0; tickI = (tickI + 1) % tickList.length; showTick(); }
      for (const id of crops) {
        const ch = chipBy[id], m = v.market[id];
        if (!ch || !m) continue;
        const r = fmtRate(m.r), cg = v.change(id);
        if (last[`r${id}`] !== r) { ch.rate.textContent = r; last[`r${id}`] = r; }
        const ct = pct(cg);
        if (last[`c${id}`] !== ct) { ch.chg.textContent = ct; ch.chg.classList.toggle('is-down', cg < 0); last[`c${id}`] = ct; }
        const n = v.have(id);
        if (last[`h${id}`] !== n) { ch.have.textContent = String(n); ch.have.hidden = !n; last[`h${id}`] = n; }
        const nw = v.newsFor(id);
        const dk = nw ? nw.text : '';
        if (last[`d${id}`] !== dk) { ch.dot.hidden = !nw; if (nw) { ch.dot.textContent = nw.up ? '▲' : '▼'; ch.dot.classList.toggle('is-down', !nw.up); } last[`d${id}`] = dk; }
        if (v.sparkTick !== last[`s${id}`]) drawSpark(ch.spark, m.spark, { usual: v.usual(id), up: cg >= 0 });
      }
      for (const id of crops) last[`s${id}`] = v.sparkTick;
      // the chosen stock
      const id = sel, m = v.market[id], c = CROPS[id];
      if (m && c) {
        if (last.name !== id) { tName.textContent = c.tick; tCo.textContent = c.name; last.name = id; }
        const usual = v.usual(id), cg = v.change(id), vsUsual = m.r / usual - 1;
        const rt = `${fmtRate(m.r)} gold`;
        if (last.rate !== rt) { tRate.textContent = rt; last.rate = rt; }
        const ct = `${pct(cg)} today`;
        if (last.chg !== ct) { tChg.textContent = ct; tChg.classList.toggle('is-down', cg < 0); last.chg = ct; }
        const ut = `usual ${fmtRate(usual)} · ${vsUsual >= 0 ? 'above' : 'below'} by ${Math.abs(Math.round(vsUsual * 100))}%`;
        if (last.usual !== ut) { tUsual.textContent = ut; tUsual.classList.toggle('is-down', vsUsual < 0); last.usual = ut; }
        const nw = v.newsFor(id), nt = nw ? nw.line : '';
        if (last.news !== nt) { tNews.hidden = !nw; tNews.textContent = nt; tNews.classList.toggle('is-down', nw ? !nw.up : false); last.news = nt; }
        const si = `${c.seed} gold to plant · ripe in ${Math.round(c.grow / v.speedOf(id))}h · ${c.yield}+1 share${c.yield > 1 ? 's' : ''}`;
        if (last.seed !== si) { seedInfo.textContent = si; seedInfo.title = c.blurb; last.seed = si; }
        const n = v.have(id);
        if (last.n !== n) { sellN.textContent = String(n); sell.disabled = !n; last.n = n; }
        const st = n ? `${fmtRate(m.r)} each` : 'none in the barn';
        if (last.st !== st) { sellSub.textContent = st; last.st = st; }
        drawCandles(chart, m, { usual, labels: v.dayLabel, marks: v.marks(id), t });
      }
      // the farm's tools
      const cap = v.cap, k = Math.min(1, v.barn / cap);
      const bn = `${v.barn}/${cap}`;
      if (last.bn !== bn) { barnNum.textContent = bn; barnFill.style.width = `${(k * 100).toFixed(1)}%`; barn.setAttribute('aria-valuenow', String(v.barn)); barn.setAttribute('aria-valuemax', String(cap)); barn.classList.toggle('is-full', k >= 0.9); last.bn = bn; }
      for (const [what, b] of Object.entries(buys)) {
        const cost = v.cost(what), lab = cost == null ? 'max' : armed === what ? `tap again · ${cost}` : String(cost);
        if (last[`b${what}`] !== lab) { b._cost.textContent = lab; b.disabled = cost == null; b.classList.toggle('is-armed', armed === what); last[`b${what}`] = lab; }
        const can = cost != null && v.gold >= cost;
        if (last[`a${what}`] !== can) { b.classList.toggle('is-short', !can); last[`a${what}`] = can; }
      }
      const lv = `${v.sprinkler}|${v.compost}`;
      if (last.lv !== lv) { buys.sprinkler.querySelector('span').textContent = v.sprinkler ? `Sprinklers ${v.sprinkler + 1}` : 'Sprinklers'; buys.compost.querySelector('span').textContent = v.compost ? `Compost (${v.compost})` : 'Compost'; last.lv = lv; }
    },
    setFast(on1) { fast.setAttribute('aria-pressed', String(on1)); fast.classList.toggle('is-on', on1); },
    show(on1) { root.hidden = !on1; },
    stopHold,
  };
  function showTick() {
    const it = tickList[tickI];
    if (!it) { tickIn.textContent = ''; tickTag.hidden = true; return; }
    tickTag.hidden = false; tickTag.textContent = it.tag; tickTag.className = `gs-tick-tag is-${it.tone || 'news'}`;
    tickIn.textContent = it.text;
    tickText.classList.remove('is-in', 'is-long'); void tickText.offsetWidth; tickText.classList.add('is-in');
    // too long to fit: it waits a moment, then slides to its end (and the ticker waits for it)
    const over = tickIn.scrollWidth - tickText.clientWidth;
    tickHold = 4.2;
    if (over > 6 && !REDUCED) {
      const dur = 1.2 + over / 45;
      tickText.style.setProperty('--gs-over', `${-over - 6}px`);
      tickText.style.setProperty('--gs-dur', `${(dur + 1.6).toFixed(2)}s`);
      tickText.classList.add('is-long');
      tickHold = Math.max(4.2, dur + 2.4);
    }
  }
  return api;
}
function center(node, stage) {
  const r = node.getBoundingClientRect(), s = stage.getBoundingClientRect();
  return { x: r.left - s.left + r.width / 2, y: r.top - s.top + r.height / 2 };
}

// ---------- the cards ----------
function emblem(kind, px = 34) {
  if (kind !== 'bear' && kind !== 'bull' && kind !== 'coin') return produceIcon(kind, px);
  const dpr = Math.min(2, devicePixelRatio || 1);
  const cv = document.createElement('canvas'); cv.width = cv.height = Math.round(px * dpr); cv.className = 'gs-icon';
  cv.style.width = cv.style.height = `${px}px`;
  const c = cv.getContext('2d'); c.scale(dpr, dpr);
  if (kind === 'bear') drawBear(c, px * 0.45, px * 0.62, px * 0.78, { t: 0 });
  else if (kind === 'bull') drawBull(c, px * 0.42, px * 0.6, px * 0.62, 0);
  else { c.beginPath(); c.arc(px / 2, px / 2, px * 0.34, 0, Math.PI * 2); c.fillStyle = '#ffc933'; c.fill(); c.lineWidth = 2; c.strokeStyle = INK; c.stroke(); c.beginPath(); c.arc(px / 2, px / 2, px * 0.2, 0, Math.PI * 2); c.strokeStyle = '#e09a12'; c.stroke(); }
  return cv;
}
const starsRow = (n, max = 3) => el('span', { class: 'gs-stars', 'aria-label': `${n} of ${max} stars` }, Array.from({ length: max }, (_, i) => el('i', i < n ? 'is-on' : null, '★')));

export function seasonsCard({ save, onPick, onClose }) {
  const list = el('ol', 'gs-seasons');
  for (const s of SEASONS) {
    const x = save.seasons[s.id], open = seasonOpen(save, s.id);
    list.append(el('li', null, el('button', { class: 'gs-season', type: 'button', disabled: !open, onclick: () => onPick(s.id) },
      el('span', 'gs-season-q', s.q),
      el('span', 'gs-season-main', el('b', null, s.name), el('small', null, open ? s.blurb : `Get a star in ${SEASONS[s.n - 2].name} first`),
        el('span', 'gs-season-crops', s.crops.map((id) => produceIcon(id, 20)))),
      el('span', 'gs-season-side', starsRow(x?.stars || 0), el('small', null, x?.best ? `best ${fmt(x.best)}` : `★ at ${fmt(s.stars[0])}`)))));
  }
  return el('div', 'ak-card gs-card',
    el('h2', 'ak-card-title', 'Seasons'),
    el('p', 'gs-card-sub', `${totalStars(save)} of ${MAX_STARS} stars · each quarter is one week on the farm`),
    list,
    el('div', 'ak-card-actions', el('button', { class: 'ak-btn', type: 'button', onclick: onClose }, 'Back')));
}

export function recordsCard({ save, onClose }) {
  const t = save.totals;
  const rows = [
    ['Shares harvested', fmt(t.harvested)], ['Shares sold', fmt(t.sold)], ['Gold earned', fmt(t.earned)],
    ['Orders delivered', fmt(t.orders)], ['Bears shooed', fmt(t.shooed)],
    ['Best sale', save.bestSale ? `${CROPS[save.bestSale.crop]?.tick || ''} at ×${save.bestSale.ratio} its usual` : '—'],
    ['Daily streak', save.daily.streak ? `${save.daily.streak} day${save.daily.streak > 1 ? 's' : ''}` : '—'],
    ['Endless best', save.endless.best ? `${fmt(save.endless.best)} gold · ${save.endless.days} days` : '—'],
  ];
  const by = Object.entries(t.byCrop).sort((a, b) => b[1] - a[1]);
  const got = new Set(save.stickers);
  const stickers = el('ul', 'gs-stickers', STICKERS.map((s) => el('li', got.has(s.id) ? 'is-got' : null, emblem(s.art, 30), el('span', null, el('b', null, s.name), el('small', null, s.how)))));
  return el('div', 'ak-card gs-card',
    el('h2', 'ak-card-title', 'The farm’s records'),
    el('dl', 'gs-records', rows.flatMap(([k, v]) => [el('dt', null, k), el('dd', null, v)])),
    by.length ? el('p', 'gs-bycrop', by.map(([id, n]) => el('span', null, produceIcon(id, 18), ` ${fmt(n)}`))) : null,
    el('h3', 'gs-card-h', `Stickers ${got.size}/${STICKERS.length}`),
    stickers,
    el('div', 'ak-card-actions', el('button', { class: 'ak-btn', type: 'button', onclick: onClose }, 'Back')));
}

export function overExtra({ stars, newStickers = [], season }) {
  const kids = [];
  if (stars != null) kids.push(el('p', 'gs-over-stars', starsRow(stars), season ? el('small', null, `★ ${fmt(season.stars[0])} · ★★ ${fmt(season.stars[1])} · ★★★ ${fmt(season.stars[2])}`) : null));
  if (newStickers.length) kids.push(el('p', 'gs-over-new', newStickers.slice(0, 4).map((s) => el('span', null, emblem(s.art, 22), s.name))));
  return kids.length ? el('div', 'gs-over-extra', kids) : null;
}
export function titleExtra({ onRecords }) {
  return el('div', 'gs-title-links', el('button', { class: 'gs-link', type: 'button', onclick: onRecords }, 'Records & stickers'));
}
