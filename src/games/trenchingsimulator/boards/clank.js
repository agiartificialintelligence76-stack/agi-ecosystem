// Clank's launchpad layout, observed at clank.trade on 2026-11-02. Trades and launches are simulator-only.
import { el, setText, flag, keyed, icon } from '../ui.js';
import { createClankChart } from './clank-chart.js';
import { createClankImageQueue } from './clank-images.js';
import { createClankPracticeSeries } from './clank-chart-data.js';
import { usd, usdFull, compact, pct, share, age, tokens, signed } from '../format.js';
import { START_MC } from '../curve.js';
import { pic, short, ORDER_ERRORS, parseAmount, setP, whoText } from './common.js';
import { createAddressSearch } from '../live-search.js';
import './clank.css';
import { CLANK_PAIRS, clankPair, clankFeed, validateClankLaunch } from './clank-data.js';

const PAIR_COLORS = ['#a7a7b8', '#e60031', '#ff4500', '#e8e8e8', '#d0e4ff', '#fafafa', '#eee', '#3286ff', '#dfe6d5', '#7fb900'];
const INTERVALS = Object.freeze([['1s', 1], ['5s', 5], ['15s', 15], ['1m', 60], ['5m', 300], ['15m', 900]]);
const ASSET = '/games/trenchingsimulator/clank/';
const STOCK_IMAGES = Object.freeze({AMC:'bafkreiclvhfy2e6j7pkmzk4yjwzwoewrbufd7nj3xpkhjuaajoqkc6i7cq',RDDT:'bafkreibfzd5d2t4cpc4n3zx5winbhzlpluou72jp5n2nx5wvy73m4vumzu',SPCX:'bafkreiek4ija5b7uqeydvplaus7z3zsnr5hjfmltfn24qtdlzbpikw3ujm',TTWO:'bafkreigggyplequhzjp7naenube2qzwvb2z2y27stdmswls4jfgo5oap7i',PLTR:'bafkreibbk2ytbvp43sr5ubhju44ujtlbx6tgmmnzelm2kvq6ntfkaq5f74',AAPL:'bafkreifcpnpdcpl5643xfcfqb4r5qat4dgpervjxo7rw2sbo32olxw45kq',META:'bafkreihxwhw7xsv4jnpcp64czyscexqtpw23cowfvr5bfxned7ayeklfji',HIMS:'bafkreidzoww4aqbpemcyfx5wv274pcp53ohjvinujst4dm3yplcrdlje3i',NVDA:'bafkreidjifk5htjiznengkyth7ut3yx4hh5qinnrmmjtyimjlbfhsdzgpy'});
const stockImage = (symbol) => STOCK_IMAGES[symbol] ? `${ASSET}stocks/${symbol}.webp` : '';
const cardMoney=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:1});
const accents=new Map();
// Sample artwork once, matching the reference's dominant-palette OKLCH treatment.
function artworkAccent(img,card) {
  const src=img.currentSrc||img.src;if(!src||!img.naturalWidth)return;
  if(accents.has(src)){card.style.setProperty('--token-accent',accents.get(src));return;}
  try{
    const canvas=document.createElement('canvas');canvas.width=64;canvas.height=Math.max(16,Math.round(img.naturalHeight/img.naturalWidth*64));
    const g=canvas.getContext('2d',{willReadFrequently:true});g.drawImage(img,0,0,canvas.width,canvas.height);const pixels=g.getImageData(0,0,canvas.width,canvas.height).data,bins=new Map();
    for(let i=0;i<pixels.length;i+=16){if(pixels[i+3]<200)continue;const rgb=[pixels[i],pixels[i+1],pixels[i+2]],light=(Math.max(...rgb)+Math.min(...rgb))/510;if(light<.06||light>.94)continue;const key=(rgb[0]>>3)<<10|(rgb[1]>>3)<<5|(rgb[2]>>3);bins.set(key,(bins.get(key)||0)+1);}
    const colors=[...bins].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k])=>{const [r,g,b]=[(k>>10&31)*8+4,(k>>5&31)*8+4,(k&31)*8+4].map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});const l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b),m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b),s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b),a=1.9779984951*l-2.428592205*m+.4505937099*s,bb=.0259040371*l+.7827717662*m-.808675766*s;return{L:.2104542553*l+.793617785*m-.0040720468*s,C:Math.hypot(a,bb),H:Math.atan2(bb,a)*180/Math.PI};});
    const c=colors.sort((a,b)=>b.C-a.C)[0];if(!c||c.C<.015)return;const color=`oklch(${Math.min(.82,Math.max(.6,c.L))} ${Math.min(.19,c.C)} ${c.H})`;if(accents.size>256)accents.delete(accents.keys().next().value);accents.set(src,color);card.style.setProperty('--token-accent',color);
  }catch{/* Cross-origin artwork can still render without palette extraction. */}
}

export function mountClank(host, ctx) {
  const { market } = ctx;
  const px = ctx.solUsd;
  const practice=market.clankPractice===true;
  const practiceSeries=createClankPracticeSeries();
  const M = (n) => Number.isFinite(n)?usd(n * px):'—';
  const state = { view: 'explore', sort: 'trending', query: '', pair: 'all', coin: null, side: 'buy', tf: practice?1:60,
    activity: 'trades', sidebar: 'activity', limit: 42, last: -Infinity, dead: false, chartId: null, candles: [],
    profileTab: 'holdings', owned: [], pictures: new Map(), uploadUrl: null, note: '', historyStep: false, lastOrder: null,links:new Map(),statWindow:'1d' };
  const button = (text, fn, cls = '') => el('button', { class: `tsc-btn ${cls}`, type: 'button', on: { click: fn } }, text);
  const empty = (text) => el('p', { class: 'tsc-empty' }, text);
  const clearEmpty = (node) => { for (const child of [...node.children]) if (!child.dataset.key) child.remove(); };
  const root = el('div', { class: 'tsc', 'aria-label': 'Clank.trade practice launchpad' });
  const images=createClankImageQueue();
  const logo = button([el('img',{src:ASSET+'clank-mark.svg',alt:'',class:'tsc-brand-mark'}),el('img',{src:ASSET+'clank-word.svg',alt:'clank',class:'tsc-brand-word'}), el('small', {}, 'Beta')], () => go('explore'), 'tsc-brand');
  const navIcon=(path)=>{const svg=icon('info','tsc-nav-icon');svg.setAttribute('viewBox','0 0 256 256');svg.querySelector('path').setAttribute('d',path);return svg;};
  const exploreButton = button([navIcon('M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216ZM172.42,72.84l-64,32a8.05,8.05,0,0,0-3.58,3.58l-32,64A8,8,0,0,0,80,184a8.1,8.1,0,0,0,3.58-.84l64-32a8.05,8.05,0,0,0,3.58-3.58l32-64a8,8,0,0,0-10.74-10.74ZM138,138,97.89,158.11,118,118l40.15-20.07Z'),'Explore'], () => go('explore'), 'tsc-nav-btn is-active');
  const profileButton = button([navIcon('M230.92,212c-15.23-26.33-38.7-45.21-66.09-54.16a72,72,0,1,0-73.66,0C63.78,166.78,40.31,185.66,25.08,212a8,8,0,1,0,13.85,8c18.84-32.56,52.14-52,89.07-52s70.23,19.44,89.07,52a8,8,0,1,0,13.85-8ZM72,96a56,56,0,1,1,56,56A56.06,56.06,0,0,1,72,96Z'),'Profile'], () => go('profile'), 'tsc-nav-btn');
  const balance = el('b', { class: 'tsc-balance' });
  const wallet = button([icon('bag'), el('span', {}, balance, el('small', {}, 'Practice balance'))], () => go('profile'), 'tsc-wallet');
  const searchButton = button(icon('search'), () => { go('explore');search.closest('.tsc-search').classList.toggle('is-open'); search.focus(); }, 'tsc-icon-btn');
  searchButton.setAttribute('aria-label', 'Search coins');
  const launchButton = button('Launch coin', () => go('launch'), 'tsc-primary');
  const telegram=el('a',{class:'tsc-social tsc-telegram',href:'https://t.me/clanktrade',target:'_blank',rel:'noopener noreferrer','aria-label':'Clank Trade on Telegram'},el('img',{src:ASSET+'telegram.svg',alt:''}));
  const discord=el('a',{class:'tsc-social tsc-discord',href:'https://t.co/dxtg4HhLHd',target:'_blank',rel:'noopener noreferrer','aria-label':'Clank Trade on Discord'},el('img',{src:ASSET+'discord.svg',alt:''}));
  const header = el('header', { class: 'tsc-header' }, logo,
    el('nav', { class: 'tsc-nav', 'aria-label': 'Clank navigation' }, exploreButton, profileButton),
    el('div', { class: 'tsc-header-actions' },telegram,discord, searchButton, launchButton, wallet));
  const sideContent = el('div', { class: 'tsc-side-content' });
  const activityButton = button([el('i',{class:'tsc-live-dot'}),'Live (0)',el('small',{},'Beta')], () => { state.sidebar = 'live'; renderSide(); });
  const holdingsButton = button('Holdings', () => { state.sidebar = 'holdings'; renderSide(); });
  const collapse = button('‹', () => {
    const folded = root.classList.toggle('is-sidebar-collapsed');
    collapse.setAttribute('aria-expanded', String(!folded));
    collapse.setAttribute('aria-label', folded ? 'Expand activity sidebar' : 'Collapse activity sidebar');
    setText(collapse, folded ? '›' : '‹');
  }, 'tsc-collapse');
  collapse.setAttribute('aria-label', 'Collapse activity sidebar');
  collapse.setAttribute('aria-expanded', 'true');
  const sidebar = el('aside', { class: 'tsc-sidebar', 'aria-label': 'Practice activity' },
    el('div', { class: 'tsc-side-tabs' }, activityButton, collapse), sideContent,
    button('Go live',()=>{setText(sideContent,'Livestreaming is available on Clank.trade. This is a practice terminal.');},'tsc-primary tsc-go-live'));
  const main = el('main', { class: 'tsc-main' });
  const latest = el('div', { class: 'tsc-tape', 'aria-label': practice?'Practice market trades':'Latest Clank trades' });
  root.append(header, el('div', { class: 'tsc-layout' }, sidebar, main), latest);
  host.append(root);

  const pairRail = el('div', { class: 'tsc-pairs', 'aria-label': 'Filter by paired asset' });
  const pairButtons = new Map();
  CLANK_PAIRS.filter(p=>p!=='ETH').forEach((id) => {
    const count = el('small', {}, '— MC'); const change=el('b',{},'—');const spark=el('canvas',{width:70,height:32,class:'tsc-stock-spark','aria-hidden':'true'});
    const b = button([el('img', { class: 'tsc-pair-mark',src:stockImage(id),alt:'' }), el('span', {}, el('b', {}, id), count),spark,el('span',{class:'tsc-stock-change'},change,el('small',{},'24h'))],
    () => { state.pair = state.pair===id?'all':id; state.limit = 42; renderFeed(); }, 'tsc-pair');
    b.setAttribute('aria-pressed', String(id === 'all'));
    pairButtons.set(id, { b, count,change,spark }); pairRail.append(b);
  });
  const search = el('input', { class: 'tsc-search-input', type: 'search', placeholder: 'Search coins or paste an address',
    'aria-label': 'Search coins or paste an address', autocomplete: 'off', spellcheck: false,
    on: { input: () => { state.query = search.value; state.limit = 42;state.searchError='';clearTimeout(state.searchTimer);state.searchTimer=setTimeout(async()=>{const query=state.query;try{await market.clankSearch?.(query);}catch{if(query===state.query)state.searchError='Search is temporarily unavailable. Try again.';}finally{if(!state.dead)renderFeed();}},250);renderFeed(); } } });
  const trending = button('Trending', () => { state.sort = 'trending'; state.limit = 42; renderFeed(); }, 'tsc-feed-tab');
  const newest = button('New', () => { state.sort = 'new'; state.limit = 42; renderFeed(); }, 'tsc-feed-tab');
  const grid = el('div', { class: 'tsc-grid' });
  const feedEmpty = empty('');
  const more = button('Load more', async () => { more.disabled=true;try{await market.clankLoadMore?.();state.limit += 42;state.searchError='';}catch{state.searchError='More coins could not load. Try again.';}finally{more.disabled=false;if(!state.dead)renderFeed();} }, 'tsc-load');
  const heroModel=el('div',{class:'tsc-hero-model',role:'img','aria-label':'Vlad cat, a 3D cat that follows your cursor'});
  const speech=el('div',{class:'tsc-hero-speech','aria-hidden':'true'},'Tokenize everything.');heroModel.append(speech);
  let speechIndex=0;const speechTimer=setInterval(()=>{if(!heroModel.isConnected||document.hidden)return;speechIndex++;setText(speech,speechIndex%2?'Tokenized stocks never close, neither do I.':'Tokenize everything.');},14000);
  const hero=el('section',{class:'tsc-hero'},el('div',{class:'tsc-hero-pattern','aria-hidden':'true'},'neural fields / latent space / synthetic dreams / luminous matter / '.repeat(100)),
    el('div',{class:'tsc-hero-copy'},el('h1',{},el('span',{},'Launch & trade coins'),el('span',{},'paired with Stocks'),el('span',{},'on ',el('em',{},'Robinhood chain'))),
      el('ul',{},el('li',{},el('i',{},'✓'),'Pair coins with AI Stocks like ',el('img',{src:stockImage('SPCX'),alt:''}),el('b',{},'SPCX')),
      el('li',{},el('i',{},'✓'),'Deposit and withdraw seamlessly from Solana, Ethereum')),
      button('Launch coin',()=>go('launch'),'tsc-primary')),heroModel,
      el('a',{class:'tsc-model-credit',href:'https://creativecommons.org/licenses/by-sa/4.0/',target:'_blank',rel:'noreferrer',title:'Vlad cat © Clanktrade · CC BY-SA 4.0'},'© Clanktrade'));
  let destroyModel=null;
  const heroObserver=new IntersectionObserver(([entry])=>{if(entry.isIntersecting){heroObserver.disconnect();import('./clank-model.js').then(m=>m.mountClankModel(heroModel)).then(d=>{if(state.dead)d();else destroyModel=d;}).catch(()=>{});}});
  heroObserver.observe(heroModel);
  const feedRegion=el('div',{class:'tsc-feed-region'},
    el('div',{class:'tsc-pair-heading'},el('span',{},'Pair coin with stocks like'),el('span',{},button('‹',()=>pairRail.scrollBy({left:-288,behavior:'smooth'})),button('›',()=>pairRail.scrollBy({left:288,behavior:'smooth'})))),
    pairRail,el('div', { class: 'tsc-feed-tools' }, el('div', { class: 'tsc-feed-tabs' }, trending, newest),
      el('label', { class: 'tsc-search' }, icon('search'), search)), grid, feedEmpty, more);
  const explore = el('section', { class: 'tsc-explore', 'aria-label': 'Coin feed' },
    hero,feedRegion);
  const layoutObserver=new ResizeObserver(([e])=>{const w=e.contentRect.width;const inner=w-(w>=768?48:32);root.style.setProperty('--cl-feed-width',`${w<434?inner:Math.max(192,Math.min(7,Math.floor((inner+18)/210))*210-18)}px`);});layoutObserver.observe(main);
  const addressSearch = createAddressSearch(market, () => { if (!state.dead) renderFeed(); });

  function imageFor(r, cls = '') {
    const custom = state.pictures.get(r.id);
    if(r.live&&!custom){
      const wrap=el('span',{class:`tsc-pic tsc-live-pic ${cls}`,data:{pic:r.pic||''}},el('span',{class:'tsc-image-unavailable','aria-label':'Coin artwork unavailable'},r.ticker?.slice(0,1)||''));
      if(r.pic){const img=el('img',{class:'tsc-img',alt:'',decoding:'async'});wrap.append(img);
        images.add(img,r.pic,{onLoad:()=>{wrap.classList.add('is-img');img.hidden=false;const card=wrap.closest('.tsc-card');if(card)artworkAccent(img,card);},
          onError:()=>{img.hidden=true;wrap.classList.remove('is-img');}});}
      return wrap;
    }
    return pic(custom ? { ...r, pic: custom } : r, cls, 'tsc');
  }
  function card(r) {
    const image = el('div', { class: 'tsc-card-image' }, imageFor(r));
    const holderText=el('span');const holder = el('span', { class: 'tsc-holder-chip' },icon('users'),holderText);
    const hot = el('img', { class: 'tsc-hot',src:ASSET+'hot.png',alt:'Hot' });
    const pair = el('span', { class: 'tsc-card-pair' });
    const name = el('h3', { title: r.name }, r.name); const liveDot=el('span',{class:'tsc-card-live',hidden:!r.live});
    const ticker = el('span', { class: 'tsc-muted' }, `$${r.ticker}`);
    const mint = market.info(r.id)?.mint;
    const copy=button('⧉',async(e)=>{e.stopPropagation();if(!mint)return;try{await navigator.clipboard.writeText(mint);copy.title='Copied';}catch{copy.title=mint;}},'tsc-card-copy');copy.setAttribute('aria-label',`Copy ${r.ticker} address`);copy.hidden=!mint;
    const source = el('div', { class: 'tsc-card-address' }, r.live ? `${mint?.slice(0,6)}...${mint?.slice(-4)}` : 'Simulated coin',copy);
    const cap = el('b'); const change = el('span'); const bar = el('span', { class: 'tsc-progress' }, el('i'));
    const progress = el('small', { class: 'tsc-muted' });
    const open=button('',()=>openCoin(r.id),'tsc-card-open');
    const node = el('article',{class:'tsc-card'},open,image, holder, hot, pair, el('div', { class: 'tsc-card-body' }, el('div',{},el('div',{class:'tsc-card-name'},name,liveDot), ticker, source),
      el('div',{},el('div',{class:'tsc-dashed'}),el('div', { class: 'tsc-card-values' }, el('span', {}, cap, el('small', {}, ' MC')), change), bar, progress)));
    node.$ = { image, holder,holderText,hot, pair, name, cap, change, bar, progress,open };
    const artwork=image.querySelector('img');if(artwork){artwork.addEventListener('load',()=>artworkAccent(artwork,node),{once:true});if(artwork.complete)artworkAccent(artwork,node);}
    updateCard(node, r); return node;
  }
  function updateCard(n, r) {
    const $ = n.$;
    if ($.image.firstElementChild?.dataset.pic !== (state.pictures.get(r.id) || r.pic || '')) $.image.replaceChildren(imageFor(r));
    setText($.holderText, compact(r.holders, 0));
    $.holder.title = `${compact(r.holders, 0)} holders`;
    const data=market.clankData?.(r.id);
    $.hot.hidden = r.live&&!practice ? !(state.sort==='trending'&&data?.trendingRank!=null||data?.volumeUsd>0) : !(r.vol5m>0);
    const pair=clankPair(r);$.pair.hidden=pair==='ETH'||pair==='Unknown';
    if($.pair.dataset.pair!==pair){$.pair.dataset.pair=pair;$.pair.replaceChildren(el('span',{},'↔'),...(stockImage(pair)?[el('img',{src:stockImage(pair),alt:pair})]:[pair]));}
    const change=r.live&&!practice?(data?.trendingRank!=null||data?.volumeUsd>0?data?.priceChange:null):r.ch5m;
    setText($.cap, Number.isFinite(r.mc)?cardMoney.format(r.mc*px):'—'); setText($.change, Number.isFinite(change)?`${change<0?'▼':'▲'} ${Math.abs(change*100).toFixed(1)}%`:'—');
    flag($.change, 'is-down', change < 0); flag($.change, 'is-up', change >= 0);
    if(!n.style.getPropertyValue('--token-accent')){let h=5381;for(const c of r.ticker||'')h=(h<<5)+h+c.charCodeAt(0);n.style.setProperty('--token-accent',`oklch(.6574 .2519 ${Math.abs(h)%360})`);}
    setP($.bar, r.progress); setText($.progress, `${share(r.progress, 0)}${r.phase === 'migrating' ? ' · migrating' : ''}`);
    $.open.setAttribute('aria-label', `${r.name}, ${r.ticker}, market cap ${M(r.mc)}, ${share(r.progress, 0)} bonded`);
  }
  function renderFeed() {
    if (state.dead) return;
    const rows = clankFeed(market, state);
    keyed(grid, rows, (r) => r.id, card, updateCard);
    flag(trending, 'is-active', state.sort === 'trending'); flag(newest, 'is-active', state.sort === 'new');
    trending.setAttribute('aria-pressed', String(state.sort === 'trending'));
    newest.setAttribute('aria-pressed', String(state.sort === 'new'));
    const stocks=market.clankStocks?.()||[];
    for (const [id, { b, count,change,spark }] of pairButtons) {
      b.setAttribute('aria-pressed', String(state.pair === id));
      const stock=stocks.find(s=>s.symbol===id);setText(count,stock?.marketCapUsd?`${usd(stock.marketCapUsd)} MC`:'— MC');
      setText(change,Number.isFinite(stock?.change24h)?`${stock.change24h<0?'▼':'▲'}${Math.abs(stock.change24h).toFixed(2)}%`:'—');
      if(stock?.candles?.length&&spark.dataset.version!==String(stock.candles.at(-1)?.close)){spark.dataset.version=String(stock.candles.at(-1)?.close);const g=spark.getContext('2d');const vals=stock.candles.map(c=>c.close??c.value??c);const lo=Math.min(...vals),hi=Math.max(...vals);g.clearRect(0,0,70,32);g.strokeStyle=stock.change24h<0?'#e12f70':'#c4b5fd';g.beginPath();vals.forEach((v,i)=>{const x=i/(vals.length-1)*70,y=30-(v-lo)/(hi-lo||1)*28;i?g.lineTo(x,y):g.moveTo(x,y);});g.stroke();}
    }
    const looking = state.query && !market.clankSearch ? addressSearch(state.query, rows.length > 0) : null;
    feedEmpty.hidden = rows.length > 0&&!state.searchError;
    setText(feedEmpty, state.searchError||looking || (state.query ? 'No coins match that search.' : state.pair !== 'all'
      ? market.live ? `No ${state.pair}-paired coins match this view. Select the stock again to show all coins.`
        : `No ${state.pair}-paired coins in this market yet. Choose All coins or create one in free play.` : 'Waiting for the first coins…'));
    more.hidden = market.live?market.clankHasMore?.()===false&&rows.length<state.limit:rows.length < state.limit;
  }

  const coinTitle = el('h1'); const coinAvatar = el('div', { class: 'tsc-coin-avatar' });
  const coinTicker = el('span'); const coinSource = el('span', { class: 'tsc-muted' });const coinLinks=el('span',{class:'tsc-coin-links'});
  const capWhole = el('span'), capFraction = el('span', { class: 'tsc-cap-fraction' });
  const cap = el('strong', { class: 'tsc-big-cap' }, capWhole, capFraction); const bond = el('b');
  const bondBar = el('span', { class: 'tsc-progress' }, el('i'));
  const liquidity = el('b'); const creator = el('b');
  const canvas = el('div', { class: 'tsc-chart', 'aria-label': 'Coin market cap candle chart' });
  const chart = createClankChart(canvas, { tf: state.tf });
  const intervals = el('div', { class: 'tsc-intervals', 'aria-label': 'Candle interval' });
  for (const [label, seconds] of INTERVALS) intervals.append(button(label, (e) => {
    state.tf = seconds;
    if(state.coin!==null)market.clankWatchInterval?.(state.coin,label);
    for (const b of intervals.children) { const active = b === e.currentTarget; flag(b, 'is-active', active); b.setAttribute('aria-pressed', String(active)); }
    renderCoin();
  }, `tsc-timeframe ${seconds === state.tf ? 'is-active' : ''}`));
  const tableHead = el('thead'); const tableBody = el('tbody');
  const tradesButton = button(practice?'Practice trades':'Trades (24h)', () => { state.activity = 'trades'; renderActivity(); });
  const holdersTab = button(practice?'Clank holders (top 100)':'Holders (top 100)', () => { state.activity = 'holders'; renderActivity(); });
  const activityNote = empty('');
  const activityPanel = el('section', { class: 'tsc-activity' },
    el('div', { class: 'tsc-activity-tabs' }, holdersTab, tradesButton),
    el('div', { class: 'tsc-table-scroll' }, el('table', { class: 'tsc-table' }, tableHead, tableBody)), activityNote);
  const buyButton = button('Buy', () => side('buy'), 'tsc-trade-side is-active');
  const sellButton = button('Sell', () => side('sell'), 'tsc-trade-side');
  const available = el('b'); const amountUnit = el('span', { class: 'tsc-amount-unit' }, '$');
  const amount = el('input', { type: 'text', inputmode: 'decimal', value: '10', placeholder: '0',
    'aria-label': 'Trade amount in USD', on: { input: () => quote() } });
  const quicks = el('div', { class: 'tsc-quicks' });
  const orderError = el('p', { class: 'tsc-error', role: 'status', 'aria-live': 'polite' });
  const quoteText = el('p', { class: 'tsc-quote' });
  const tradeSubmit = button('Buy', place, 'tsc-primary tsc-submit');
  const feeDetail = el('div', { class: 'tsc-fee-detail' });
  const slippage = button('Slippage', () => ctx.openSettings(), 'tsc-slippage');
  const own = el('div', { class: 'tsc-own' });
  const statTitle = el('p'); const changes = el('div', { class: 'tsc-changes' });
  const statNumbers = el('div', { class: 'tsc-stat-numbers' });
  const ownTokens=el('b'),ownValue=el('span');own.append(el('span',{},'You own'),ownTokens,ownValue);
  const changeNodes=[['5M','5m'],['1H','1h'],['4H','4h'],['1D','1d']].map(([label,key])=>{const value=el('b');const node=button([el('span',{},label),value],()=>{state.statWindow=key;renderCoin();},'tsc-stat-window');changes.append(node);return {key,value,node};});
  const buysText=el('span'),sellsText=el('span'),splitBar=el('div',{class:'tsc-split'}),volumeText=el('b'),holderText=el('b'),pairText=el('b');
  const buyVolText=el('span'),sellVolText=el('span'),buyersText=el('span'),sellersText=el('span'),volBar=el('div',{class:'tsc-split'}),tradersBar=el('div',{class:'tsc-split'});
  statNumbers.append(el('div',{},buysText,sellsText),splitBar,el('div',{},buyVolText,sellVolText),volBar,el('div',{},buyersText,sellersText),tradersBar);
  const about = el('div', { class: 'tsc-about' }, statTitle, changes, statNumbers);
  const tradeControls=el('div',{class:'tsc-trade-controls'},button('Close',()=>root.classList.remove('is-trade-open'),'tsc-trade-close'),
    el('div', { class: 'tsc-trade-tabs' }, buyButton, sellButton),
    el('div', { class: 'tsc-amount' }, el('label', {}, amountUnit, amount,el('span',{class:'tsc-available-inline',title:'Available play-money balance'},available)), quicks), tradeSubmit, orderError, quoteText,
    el('div', { class: 'tsc-fees' }, el('details', {}, el('summary', {}, 'Fee details'), feeDetail), slippage), own);
  const tradePanel = el('aside', { class: 'tsc-trade-panel', 'aria-label': 'Trade with play money' },tradeControls,about);
  const tradeBackdrop=button('',()=>root.classList.remove('is-trade-open'),'tsc-trade-backdrop');tradeBackdrop.setAttribute('aria-label','Close trade sheet');
  const mobileTrade=el('div',{class:'tsc-mobile-trade'},button('Buy',()=>{side('buy');root.classList.add('is-trade-open');amount.focus();},'tsc-primary'),button('Sell',()=>{side('sell');root.classList.add('is-trade-open');amount.focus();}));
  root.append(tradeBackdrop,mobileTrade);
  const coinView = el('section', { class: 'tsc-coin' },
    el('header', { class: 'tsc-coin-header' }, el('div', { class: 'tsc-coin-name' }, coinAvatar,
      el('div', {}, coinTitle, el('div', { class: 'tsc-coin-sub' }, coinTicker, coinSource,coinLinks))),
      el('div', { class: 'tsc-coin-meta' }, el('div', { class: 'tsc-bond' }, el('span', {}, practice?'Clank bonding':'Bonding status'), bond, bondBar),
        el('div', {}, el('span', {}, practice?'Practice liquidity':'Liquidity'), liquidity), el('div', {}, el('span', {}, 'Creator'), creator))),
    el('div', { class: 'tsc-coin-grid' }, el('div', { class: 'tsc-chart-column' },
      el('div', { class: 'tsc-cap-heading' }, cap, el('p', {}, practice?'Practice market cap':'Market cap')),
      el('div', { class: 'tsc-chart-toolbar' }, el('div',{class:'tsc-chart-modes'},button('Market cap',()=>{state.chartMode=state.chartMode==='price'?'mcap':'price';setText(capMode,state.chartMode==='price'?'Price':'Market cap');chart.view({mode:state.chartMode});},'tsc-chart-mode'),button('USD',()=>{state.chartUnit=state.chartUnit==='coin'?'usd':'coin';setText(unitMode,state.chartUnit==='coin'?'ETH':'USD');chart.view({unit:state.chartUnit});},'tsc-chart-unit')), intervals), canvas, activityPanel), tradePanel));
  const capMode=coinView.querySelector('.tsc-chart-mode'),unitMode=coinView.querySelector('.tsc-chart-unit');

  function side(next) {
    state.side = next; setText(amountUnit, next === 'buy' ? '$' : '%');
    amount.setAttribute('aria-label', next === 'buy' ? 'Trade amount in USD' : 'Percentage of holding to sell');
    amount.value = next === 'buy' ? '0' : '100';
    flag(buyButton, 'is-active', next === 'buy'); flag(sellButton, 'is-active', next === 'sell');
    buyButton.setAttribute('aria-pressed', String(next === 'buy')); sellButton.setAttribute('aria-pressed', String(next === 'sell'));
    setText(tradeSubmit, next === 'buy' ? 'Buy' : 'Sell'); flag(tradeSubmit, 'is-sell', next === 'sell');
    quicks.replaceChildren(...(next === 'buy' ? [10, 50, 100, 1000] : [25, 50, 75, 100]).map((v) =>
      button(next === 'buy' ? `$${v}` : `${v}%`, () => { amount.value = String(v); quote(); })));
    state.lastOrder = null; setText(orderError, ''); quote();
  }
  function ask() {
    const v = parseAmount(amount.value);
    if (!(v > 0) || (state.side === 'sell' && v > 100)) return null;
    return { coin: state.coin, side: state.side, ...(state.side === 'buy' ? { sol: v / px } : { frac: v / 100 }), ...ctx.settings() };
  }
  function errorText(code) {
    if (code === 'not_enough_sol' || code === 'no_sol_for_fee') return 'Not enough play money, including fees.';
    if (code === 'slippage') return 'The price moved beyond your slippage limit before the trade landed. Try a new quote or adjust Slippage.';
    if (code === 'min_buy') return `The smallest buy is ${M(0.001)}.`;
    return ORDER_ERRORS[code] || 'The trade could not be placed. Check the amount and try again.';
  }
  function quote() {
    if (state.coin === null) return;
    const a = ask();
    quoteText.hidden=!a;
    const q = a ? market.quote(a) : null;
    if (!a) setText(quoteText, state.side === 'buy' ? 'Enter an amount in dollars.' : 'Enter a percentage from 1 to 100.');
    else if (!q?.ok || q.enough === false) setText(quoteText, errorText(q?.ok ? 'not_enough_sol' : q?.error));
    else setText(quoteText, state.side === 'buy'
      ? `Receive ≈ ${tokens(q.tokens)} tokens · ${share(Math.abs(q.impact))} price impact`
      : `Receive ≈ ${M(q.got)} · ${share(Math.abs(q.impact))} price impact`);
    const stale=market.live&&!practice&&market.row(state.coin)?.tracked===false;
    tradeSubmit.disabled = !a || !q?.ok || q.enough === false || ctx.run?.over === true || stale;
    if(stale&&a)setText(quoteText,'Waiting for a fresh Clank price…');
    setText(feeDetail, q?.ok ? `Trading fee ${M((q.fees?.terminal || 0) + (q.fees?.market || 0))} · network fee ${M(q.fees?.network || 0)}. All fees use play money.`
      : 'Fees are included in your quote. All trades use play money.');
  }
  function place() {
    const a = ask(); if (!a) return;
    const result = ctx.order(a);
    state.lastOrder = result?.ok ? result.order?.id ?? null : null;
    setText(orderError, result?.ok ? 'Trade submitted. Waiting for the simulated fill…' : errorText(result?.error));
    renderCoin(); renderSide();
  }
  function renderActivity() {
    if (state.coin === null) return;
    flag(holdersTab, 'is-active', state.activity === 'holders'); flag(tradesButton, 'is-active', state.activity === 'trades');
    holdersTab.setAttribute('aria-pressed', String(state.activity === 'holders'));
    tradesButton.setAttribute('aria-pressed', String(state.activity === 'trades'));
    const s = market.stats(state.coin); if (!s) return;
    const pair=clankPair(market.row(state.coin));
    const head = state.activity === 'holders' ? ['Holder', '% held', s.ticker, 'Value'] : ['Side', practice?'Practice trader':'Trader', s.ticker, s.live&&!practice?(pair==='Unknown'?'Quote asset':pair):'USD'];
    const headKey=`${state.activity}:${s.ticker}:${pair}`;
    if(tableHead.dataset.key!==headKey){tableHead.dataset.key=headKey;tableHead.replaceChildren(el('tr', {}, head.map((h) => el('th', { scope: 'col' }, h))));tableBody.replaceChildren();}
    const row=(r)=>{const n=el('tr');n.$=head.map(()=>el('td'));n.append(...n.$);return n;};
    if (state.activity === 'holders') {
      const rows = s.live ? market.clankHolders?.(state.coin)||[] : market.holders(state.coin,100)?.list||[];
      keyed(tableBody,rows,(r)=>r.address||r.addr||r.rank,row,(n,r)=>{const values=[r.me?'You':r.kol||short(r.address||r.addr),share(r.share??r.pct),tokens(r.tokens??r.tok),s.live?'—':M((r.tok||0)*s.price)];values.forEach((v,i)=>setText(n.$[i],v));});
      activityNote.hidden = rows.length > 0&&!practice;
      setText(activityNote, practice?'Clank.trade holder snapshot. Practice trades do not change these on-chain holdings.':s.live ? 'Loading holders from Clank…' : 'No holders yet.');
    } else {
      const rows = (s.live&&!practice ? market.clankTrades?.(state.coin)||[] : market.trades(state.coin,30)||[]).slice(0,30);
      keyed(tableBody,rows,(r)=>r.id||r.tx||`${r.t}:${r.addr}:${r.side}:${r.sol}:${r.tok}`,row,(n,r)=>{const quoteAmount=s.live&&!practice?r.quote:r.sol*px;const values=[r.side==='buy'?'BUY':'SELL',r.me?'You':r.kol||short(r.address||r.addr)||whoText(r.label),tokens(r.tokens??r.tok),Number.isFinite(quoteAmount)?new Intl.NumberFormat('en-US',{maximumSignificantDigits:6}).format(quoteAmount):'—'];values.forEach((v,i)=>setText(n.$[i],v));n.$[0].className=r.side==='buy'?'is-up':'is-down';});
      activityNote.hidden = rows.length > 0&&!practice; setText(activityNote, practice?'Simulated trades, including your practice buys and sells.':'Trades will appear here when the market trades.');
    }
  }
  function renderCoin() {
    if (state.coin === null) return;
    const s = market.stats(state.coin); const info = market.info(state.coin); if (!s || !info) return;
    setText(coinTitle, s.name); setText(coinTicker, `$${s.ticker}`);
    setText(coinSource, practice?`${short(info.mint)} · simulated prices & volume`:`${s.live ? `${short(info.mint)} · ${s.src || 'Live coin'}` : 'Simulated coin'} · play money`);
    const social=state.links.get(s.id)||market.clankData?.(s.id)||{},linkKey=`${s.id}:${social.twitter||''}:${social.website||''}`;
    if(coinLinks.dataset.key!==linkKey){coinLinks.dataset.key=linkKey;coinLinks.replaceChildren();for(const [key,label] of [['twitter','X'],['website','Website']]){try{const url=new URL(social[key]);if(['https:','http:'].includes(url.protocol))coinLinks.append(el('a',{href:url.href,target:'_blank',rel:'noopener noreferrer','aria-label':`${s.name} ${label}`},label));}catch{/* Optional link omitted. */}}}
    const capText = Number.isFinite(s.mc) ? usdFull(s.mc * px) : '—';
    const decimalAt = capText.lastIndexOf('.');
    setText(capWhole, decimalAt < 0 ? capText : capText.slice(0, decimalAt));
    setText(capFraction, decimalAt < 0 ? '' : capText.slice(decimalAt));
    setText(bond, share(s.progress, 0)); setP(bondBar, s.progress);
    setText(liquidity, M(s.liq)); setText(creator, info.dev&&info.dev!=='—' ? /^0x/.test(info.dev)?short(info.dev):`@${info.dev.replace(/^@/, '')}` : '—');
    setText(available, M(market.player.sol));
    setText(slippage, `Slippage ${share(ctx.settings().slippage)}`);
    if (state.lastOrder !== null) {
      const order = market.orders(30).find((o) => o.id === state.lastOrder);
      if (order && order.status !== 'pending') {
        setText(orderError, order.status === 'filled' ? `${order.side === 'buy' ? 'Buy' : 'Sell'} filled with play money.` : errorText(order.reason));
        state.lastOrder = null;
      }
    }
    setText(ownTokens,`${tokens(s.me?.tokens||0)} ${s.ticker}`);setText(ownValue,M(s.me?.value||0));
    own.hidden=!(s.me?.tokens>0);
    setText(statTitle, practice?'Simulated activity':`About ${s.name}`);
    const data=market.clankData?.(s.id),windows=(practice?market.clankPracticeWindows?.(s.id):data?.windows)||{},windowStats=windows[state.statWindow];
    for(const {key,value,node} of changeNodes){const change=windows[key]?.change??(!practice?(key==='5m'?s.change5m:key==='1h'?s.change1h:null):null);setText(value,Number.isFinite(change)?`${change<0?'▼':'▲'}${Math.abs(change*100).toFixed(2).replace(/\.00$/,'')}%`:'—');value.className=change<0?'is-down':'is-up';flag(node,'is-active',key===state.statWindow);node.setAttribute('aria-pressed',String(key===state.statWindow));}
    const stat=windowStats||(!practice&&state.statWindow==='5m'?{buys:s.buys5m,sells:s.sells5m}:{});
    setText(buysText,`${compact(stat.buys,0)} buys`);setText(sellsText,`${compact(stat.sells,0)} sells`);
    const split=(node,a,b)=>node.style.setProperty('--buy',Number.isFinite(a)&&Number.isFinite(b)&&a+b>0?a/(a+b):.5);
    split(splitBar,stat.buys,stat.sells);split(volBar,stat.buyVolumeUsd,stat.sellVolumeUsd);split(tradersBar,stat.buyers,stat.sellers);
    setText(buyVolText,`${usd(stat.buyVolumeUsd)} vol`);setText(sellVolText,`${usd(stat.sellVolumeUsd)} vol`);setText(buyersText,`${compact(stat.buyers,0)} buyers`);setText(sellersText,`${compact(stat.sellers,0)} sellers`);
    const id = state.coin;
    if (state.chartId !== id) { state.chartId = id; state.candles = market.candles(id) || []; }
    else {
      const last = state.candles.at(-1)?.t;
      const incoming = market.candles(id, last) || [];
      if (last !== undefined && incoming[0]?.t === last) state.candles.pop();
      state.candles.push(...incoming);
      if (state.candles.length > 7200) state.candles.splice(0, state.candles.length - 7200);
    }
    const realCandles=s.live?market.clankCandles?.(id,INTERVALS.find(x=>x[1]===state.tf)?.[0]||'1s'):null;
    if(practice){
      const composed=practiceSeries.update({key:id,history:realCandles||[],historyThrough:data?.chartThrough,practice:state.candles,tf:state.tf,base:market.baseTime,
        started:market.clankPracticeStart?.(id)||0,solUsd:px,seed:market.clankPracticeSeed?.(id)});
      chart.set({key:id,label:s.ticker,live:false,practice:true,practiceAt:composed.practiceAt,sourceHistory:composed.history,
        revision:composed.revision,candles:composed.candles,solUsd:1,tf:state.tf,base:0,
        marks:market.orders(100).filter(o=>o.coin===id&&o.status==='filled').map(o=>({t:Math.floor(market.baseTime/1000)+o.doneAt,side:o.side}))});
    }else chart.set({ key:id,label:s.ticker,live:s.live,practice:false,chartThrough:s.live?data?.chartThrough:null,revision:s.live?data?.coin?.quoteUsd:undefined,candles: s.live?(realCandles||[]):state.candles, solUsd: s.live?1:px, tf: state.tf,
        marks: market.orders(100).filter((o) => o.coin === id && o.status === 'filled').map((o) => ({ t: o.doneAt+(s.live?(market.baseTime||0)/1000:0), side: o.side })),
        base: s.live?0:Date.now() - market.t * 1000 });
    const ethUsd=data?.px?.eth||(data?.quoteAsset==='ETH'?data.quoteUsd:null);
    unitMode.disabled=!(ethUsd>0);unitMode.title=ethUsd>0?'':'ETH conversion unavailable';
    chart.view({supply:data?.totalSupply||1e9,...(ethUsd>0?{per:(s.live?1:px)/ethUsd}:{})});
    quote(); renderActivity();
  }

  const profileCards = el('div', { class: 'tsc-profile-summary' });
  const profileContent = el('div', { class: 'tsc-profile-content' });
  const profileTabs = el('div', { class: 'tsc-profile-tabs' });
  [['holdings', 'Holdings'], ['created', 'Created coins'], ['history', 'Trade history']].forEach(([id, name]) => {
    const b = button(name, () => { state.profileTab = id; renderProfile(); }); b.dataset.tab = id; profileTabs.append(b);
  });
  const profileName = el('h1');
  const profile = el('section', { class: 'tsc-profile' }, el('div', { class: 'tsc-profile-identity' },
    el('div', { class: 'tsc-profile-avatar' }, '☺'), el('div', {}, profileName, el('p', {}, 'Your practice portfolio'))),
    profileCards, profileTabs, profileContent);
  function renderProfile() {
    setText(profileName, `@${ctx.playerName?.() || 'trencher'}`);
    const player = market.player;
    const positions = market.positions();
    profileCards.replaceChildren(...[['Portfolio', M(player.worth)], ['Available', M(player.sol)],
      ['Total P&L', signed((player.worth - ctx.start) * px, 'usd')], ['Positions', positions.filter((p) => p.open).length]].map(([label, value]) =>
      el('div', {}, el('span', {}, label), el('strong', {}, value))));
    for (const b of profileTabs.children) { flag(b, 'is-active', b.dataset.tab === state.profileTab); b.setAttribute('aria-pressed', String(b.dataset.tab === state.profileTab)); }
    if (state.profileTab === 'created') {
      const rows = state.owned.map((id) => market.row(id)).filter(Boolean);
      profileContent.className = 'tsc-profile-content tsc-grid';
      clearEmpty(profileContent);
      keyed(profileContent, rows, (r) => r.id, card, updateCard);
      if (!rows.length) profileContent.replaceChildren(empty('No coins launched in this run. Launch a practice coin in simulated free play.'));
    } else if (state.profileTab === 'history') {
      profileContent.className = 'tsc-profile-content';
      const orders = market.orders(100);
      clearEmpty(profileContent);
      keyed(profileContent, orders, (o) => `history-${o.id}`, (o) => {
        const value = el('span'); const status = el('span', { class: 'tsc-muted' }); const when = el('small');
        const n = button([el('span', { class: `tsc-side-pill is-${o.side}` }, o.side.toUpperCase()), el('b', {}, o.ticker),
          value, status, when], () => openCoin(o.coin), 'tsc-position tsc-history-row');
        n.$ = { value, status, when }; return n;
      }, (n, o) => {
        setText(n.$.value, o.status === 'filled' ? M(o.side === 'buy' ? o.spent : o.got) : o.sol ? M(o.sol) : share(o.frac));
        setText(n.$.status, o.status); setText(n.$.when, age(market.t - o.t));
      });
      if (!orders.length) profileContent.replaceChildren(empty('Your trades will appear here.'));
    } else {
      profileContent.className = 'tsc-profile-content';
      clearEmpty(profileContent);
      keyed(profileContent, positions.filter((p) => p.open), (p) => `holding-${p.id}`, (p) => {
        const count = el('small'); const value = el('b'); const pnl = el('span');
        const n = button([imageFor(market.row(p.id)), el('span', {}, el('b', {}, p.name), count), value, pnl], () => openCoin(p.id), 'tsc-position');
        n.$ = { count, value, pnl }; return n;
      }, (n, p) => {
        setText(n.$.count, `${tokens(p.tokens)} ${p.ticker}`); setText(n.$.value, M(p.value)); setText(n.$.pnl, pct(p.pnlPct));
        flag(n.$.pnl, 'is-down', p.total < 0); flag(n.$.pnl, 'is-up', p.total >= 0);
      });
      if (!positions.some((p) => p.open)) profileContent.replaceChildren(empty('Your portfolio is empty. Explore coins and place your first practice buy.'));
    }
  }

  const launchName = el('input', { id: 'tsc-launch-name', type: 'text', placeholder: 'Ghost', maxlength: 40, required: true });
  const launchTicker = el('input', { id: 'tsc-launch-ticker', type: 'text', placeholder: 'GHST', maxlength: 10, required: true });
  const launchPair = el('select', { id: 'tsc-launch-pair' }, CLANK_PAIRS.map((p) => el('option', { value: p }, p === 'ETH' ? 'Ethereum · ETH' : `${p} · Stock pair`)));
  const launchBuy = el('input', { id: 'tsc-launch-buy', type: 'text', inputmode: 'decimal', placeholder: '0.00' });
  const launchDescription = el('textarea', { id: 'tsc-launch-description', maxlength: 160, placeholder: 'Tell the trenches about your coin', rows: 3 });
  const launchTwitter=el('input',{id:'tsc-launch-twitter',type:'url',placeholder:'https://x.com/ghost'});
  const launchWebsite=el('input',{id:'tsc-launch-website',type:'url',placeholder:'https://'});
  const imageInput = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', 'aria-label': 'Coin image', hidden: true });
  const upload = button([icon('download'), el('span', {}, 'Upload coin image')], () => imageInput.click(), 'tsc-upload');
  const launchError = el('p', { class: 'tsc-error', role: 'status', 'aria-live': 'polite' });
  const preview = el('div', { class: 'tsc-preview' });
  const field = (label, input, suffix = '') => {
    input.setAttribute('aria-label', label);
    return el('label', { class: 'tsc-field', for: input.id },
      el('span', {}, label, suffix ? el('small', {}, suffix) : null), input);
  };
  const launchSubmit = el('button', { class: 'tsc-btn tsc-primary tsc-launch-submit', type: 'submit' }, 'Launch practice coin');
  const launchForm = el('form', { class: 'tsc-launch-form', on: { submit: launchCoin } }, el('h1', {}, 'Create a coin'), upload, imageInput,
    el('p', { class: 'tsc-muted tsc-upload-note' }, 'PNG, JPEG or WebP, up to 2 MB. Kept only for this run.'),
    field('Coin name', launchName), field('Ticker', launchTicker), field('Paired asset', launchPair),
    el('p', { class: 'tsc-muted' }, `Starting market cap: ≈ ${M(START_MC)}`), field('Initial buy (USD)', launchBuy, 'Optional'),
    el('details', { class: 'tsc-advanced' }, el('summary', {}, 'Advanced options'),field('Twitter / X link',launchTwitter,'Optional'),field('Website link',launchWebsite,'Optional'), field('Description', launchDescription, 'Optional')),
    launchError, launchSubmit, el('p', { class: 'tsc-muted' }, 'Creates a simulated coin in this free-play run. No wallet or real launch.'));
  const launchView = el('section', { class: 'tsc-launch' }, launchForm, el('aside', {}, el('h2', {}, 'Preview'), preview));
  function renderPreview() {
    const r = { id: -1, name: launchName.value.trim() || 'Coin name', ticker: launchTicker.value.trim().toUpperCase() || 'COIN',
      emoji: '👻', theme: 'fantasy', pair: launchPair.value, holders: 0, mc: START_MC, ch5m: 0, progress: 0, vol5m: 0 };
    if (state.uploadUrl) state.pictures.set(-1, state.uploadUrl); else state.pictures.delete(-1);
    const c = card(r); c.$.open.disabled = true;c.$.open.removeAttribute('aria-label');if(!state.uploadUrl){c.$.image.replaceChildren(el('span',{class:'tsc-preview-image'},icon('chart')));c.style.setProperty('--token-accent','#424242');}preview.replaceChildren(c);
    launchSubmit.disabled = !ctx.launchCoin || market.live || ctx.run?.mode !== 'free' || ctx.run?.over === true;
  }
  for (const input of [launchName, launchTicker, launchPair]) input.addEventListener('input', renderPreview);
  imageInput.addEventListener('change', () => {
    const file = imageInput.files?.[0]; if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      setText(launchError, 'Choose a PNG, JPEG or WebP image no larger than 2 MB.'); imageInput.value = ''; return;
    }
    if (state.uploadUrl) { state.pictures.delete(-1); URL.revokeObjectURL(state.uploadUrl); }
    state.uploadUrl = URL.createObjectURL(file);
    upload.replaceChildren(el('img', { src: state.uploadUrl, alt: 'Your coin image' }));
    setText(launchError, ''); renderPreview();
  });
  function launchCoin(e) {
    e.preventDefault();
    const checked = validateClankLaunch({ name: launchName.value, ticker: launchTicker.value, initialBuy: launchBuy.value, pair: launchPair.value });
    if (!checked.ok) return setText(launchError, checked.error);
    if (!ctx.launchCoin || market.live || ctx.run?.mode !== 'free') return setText(launchError, 'Practice coin launches are available in simulated free play.');
    if (checked.amount > 0 && checked.amount < 0.001 * px) return setText(launchError, `The smallest initial buy is ${M(0.001)}.`);
    if (checked.amount > market.maxBuy(ctx.settings().priority) * px) return setText(launchError, 'Not enough play money for the initial buy, including fees.');
    const result = ctx.launchCoin({ name: checked.name, ticker: checked.ticker, pair: checked.pair, emoji: '👻', line: launchDescription.value.trim() });
    if (!result?.ok) return setText(launchError, result?.error === 'free_only' || result?.error === 'mode'
      ? 'Practice coin launches are available in simulated free play.' : result?.message || errorText(result?.error));
    const id = result.id ?? result.coin?.id;
    if (!Number.isInteger(id)) return setText(launchError, 'The coin could not be created. Try again.');
    state.owned.push(id);
    state.links.set(id,{twitter:launchTwitter.value.trim(),website:launchWebsite.value.trim()});
    if (state.uploadUrl) { state.pictures.set(id, state.uploadUrl); state.uploadUrl = null; state.pictures.delete(-1); }
    launchName.value = ''; launchTicker.value = ''; launchBuy.value = ''; launchDescription.value = '';launchTwitter.value='';launchWebsite.value=''; imageInput.value = '';
    upload.replaceChildren(icon('download'), el('span', {}, 'Upload coin image'));
    let initialOrder = null;
    if (checked.amount > 0) {
      const order = ctx.order({ coin: id, side: 'buy', sol: checked.amount / px, ...ctx.settings() });
      initialOrder = order?.ok ? order.order?.id ?? null : null;
      state.note = order?.ok ? 'Your practice coin launched. Its initial buy is pending.' : `Your coin launched. Initial buy: ${errorText(order?.error)}`;
    } else state.note = 'Your practice coin launched. It is now trading in this run.';
    openCoin(id); state.lastOrder = initialOrder; setText(orderError, state.note);
  }

  function go(view, fromPop = false) {
    const leavingCoin = state.view === 'coin';
    const hadStep = state.historyStep;
    if (leavingCoin && view !== 'coin') { state.coin = null; ctx.onCoin?.(null); }
    state.view = view;
    root.classList.remove('is-trade-open');
    flag(exploreButton, 'is-active', view === 'explore'); flag(profileButton, 'is-active', view === 'profile');
    if (view !== 'explore' && !hadStep && !fromPop) { ctx.pushSub?.(); state.historyStep = true; }
    if (view === 'explore' && hadStep) { state.historyStep = false; if (!fromPop) ctx.popSub?.(); }
    main.replaceChildren(view === 'profile' ? profile : view === 'launch' ? launchView : view === 'coin' ? coinView : explore);
    window.scrollTo(0, 0);
    if (view === 'profile') renderProfile();
    if (view === 'explore') renderFeed();
    if (view === 'launch') {
      renderPreview();
      setText(launchError, !ctx.launchCoin || market.live || ctx.run?.mode !== 'free' ? 'Practice coin launches are available in simulated free play.' : '');
    }
    root.dataset.view=view;
    if (view === 'coin') { renderCoin(); }
  }
  function openCoin(id) {
    const r = market.row(id); if (!r || !Number.isInteger(id)) return;
    const changed = state.coin !== id;
    state.coin = id; state.chartId = null; state.candles = [];
    if(r.live)market.clankWatchInterval?.(id,INTERVALS.find(x=>x[1]===state.tf)?.[0]||'1s');
    coinAvatar.replaceChildren(imageFor(r));
    if (changed) { state.side = 'buy'; side('buy'); }
    go('coin'); ctx.onCoin?.(id);
  }
  function renderSide() {
    if(state.sidebar!=='holdings'){setText(sideContent,'No one is live right now.');return;}
    flag(activityButton, 'is-active', state.sidebar === 'activity'); flag(holdingsButton, 'is-active', state.sidebar === 'holdings');
    if (state.sidebar === 'holdings') {
      const rows = market.positions().filter((p) => p.open);
      clearEmpty(sideContent);
      keyed(sideContent, rows, (p) => `position-${p.id}`, (p) => {
        const value = el('span'); const pnl = el('small');
        const n = button([imageFor(market.row(p.id)), el('span', {}, el('b', {}, p.ticker), value, pnl)], () => openCoin(p.id), 'tsc-side-item');
        n.$ = { value, pnl }; return n;
      }, (n, p) => { setText(n.$.value, M(p.value)); setText(n.$.pnl, pct(p.pnlPct)); flag(n.$.pnl, 'is-down', p.total < 0); });
      if (!rows.length) sideContent.replaceChildren(empty('No open positions yet.'));
    } else {
      const rows = market.orders(20);
      clearEmpty(sideContent);
      keyed(sideContent, rows, (o) => `order-${o.id}`, (o) => {
        const status = el('span'); const when = el('small');
        const n = button([el('span', { class: `tsc-notif-icon is-${o.side}` }, o.side === 'buy' ? '↗' : '↙'),
          el('span', {}, el('b', {}, `${o.side === 'buy' ? 'Buy' : 'Sell'} ${o.ticker}`), status, when)], () => openCoin(o.coin), 'tsc-side-item');
        n.$ = { status, when }; return n;
      }, (n, o) => { setText(n.$.status, o.status === 'failed' ? errorText(o.reason) : o.status); setText(n.$.when, `${age(market.t - o.t)} ago`); });
      if (!rows.length) sideContent.replaceChildren(empty('Your trade notifications appear here.'));
    }
  }
  function renderTape() {
    if(market.live&&!practice){
      latest.hidden=state.view!=='explore';if(latest.hidden)return;
      const trades=(market.clankRecentTrades?.()||[]).slice(0,20);
      if(!trades.length){if(!latest.querySelector('.tsc-tape-status'))latest.replaceChildren(el('span',{class:'tsc-tape-status'},'Loading latest Clank trades…'));return;}
      let track=latest.querySelector('.tsc-tape-track');if(!track){track=el('div',{class:'tsc-tape-track'});latest.replaceChildren(track);}
      const rows=[...trades.map(r=>({...r,copy:0})),...trades.map(r=>({...r,copy:1}))];
      keyed(track,rows,r=>`${r.copy}:${r.id}`,(r)=>{
        const amount=el('span',{class:'tsc-tape-amount'}),picture=el('img',{class:'tsc-tape-pic',alt:''});picture.hidden=!r.pic;if(r.pic)images.add(picture,r.pic,{onLoad:()=>{picture.hidden=false;},onError:()=>{picture.hidden=true;}});
        const node=button([amount,picture,el('b',{},r.ticker)],async()=>{let id=r.coin;if(!Number.isInteger(id)){try{const found=await market.lookup?.(r.address);id=found?.id??found;}catch{return;}}if(Number.isInteger(id)&&!state.dead)openCoin(id);},'tsc-tape-item');node.$={amount};if(r.copy)node.setAttribute('aria-hidden','true');return node;
      },(n,r)=>{setText(n.$.amount,`${Number.isFinite(r.quote)?new Intl.NumberFormat('en-US',{maximumSignificantDigits:4}).format(r.quote):'—'} ${r.quoteAsset||'—'} ${r.side==='buy'?'bought':'sold'}`);n.$.amount.className=`tsc-tape-amount ${r.side==='buy'?'is-up':'is-down'}`;});
      track.style.setProperty('--cl-tape-duration',`${Math.max(20,trades.reduce((n,r)=>n+110+7*((r.ticker?.length||0)+(r.quoteAsset?.length||0)+10),0)/75)}s`);return;
    }
    latest.hidden=state.view!=='explore';if(latest.hidden)return;
    const occurrences = new Map();
    const rows = (market.tape(10) || []).map((r) => {
      const key = `${r.coin}:${r.t}:${r.side}:${r.sol}:${r.mc}`;
      const count = (occurrences.get(key) || 0) + 1; occurrences.set(key, count);
      return { ...r, key: `${key}:${count}` };
    });
    clearEmpty(latest);
    keyed(latest, rows, (r) => r.key, (r) => button([
      el('span', { class: r.side === 'buy' ? 'is-up' : 'is-down' }, `${practice?'Practice · ':''}${M(r.sol)} ${r.side === 'buy' ? 'bought' : 'sold'}`),
      el('b', {}, r.ticker)], () => openCoin(r.coin), 'tsc-tape-item'));
    if (!rows.length) latest.replaceChildren(el('span', { class: 'tsc-muted' }, 'Market trades appear here as they happen.'));
  }
  function onKey(e) {
    if (state.dead || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    if(e.key==='Escape'&&root.classList.contains('is-trade-open')){root.classList.remove('is-trade-open');return;}
    const target = e.target;
    if (target?.closest?.('input,textarea,select,[contenteditable],dialog')) return;
    if (e.key === '/') { e.preventDefault(); go('explore'); search.focus(); }
  }
  document.addEventListener('keydown', onKey);
  go('explore'); side('buy'); renderSide(); renderTape();
  setText(balance, M(market.player.sol));
  return {
    el: root,
    update(now) {
      if (state.dead || now - state.last < 500) return;
      state.last = now; setText(balance, M(market.player.sol));
      if (state.view === 'explore') renderFeed();
      if (state.view === 'coin') renderCoin();
      if (state.view === 'profile') renderProfile();
      renderSide(); renderTape();
    },
    sub: () => state.historyStep,
    closeSub: () => go('explore', true),
    openCoin,
    destroy() {
      state.dead = true; chart.destroy();images.destroy();heroObserver.disconnect();layoutObserver.disconnect();destroyModel?.();clearTimeout(state.searchTimer);clearInterval(speechTimer); document.removeEventListener('keydown', onKey);
      const urls = new Set([...state.pictures.values(), state.uploadUrl].filter(Boolean));
      for (const url of urls) URL.revokeObjectURL(url);
      root.remove();
    },
  };
}
