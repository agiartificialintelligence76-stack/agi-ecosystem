// Incremental OHLC buckets for Clank's chart. The market may replace its last candle or append more;
// closed buckets are retained, so a pointer move or an unchanged quote never re-aggregates history.
const finite = Number.isFinite;
const signature = (x) => x ? `${x.t}|${x.o}|${x.h}|${x.l}|${x.c}|${x.v || 0}` : '';

// The public Clank datafeed displays confirmed quiet intervals at the previous close, with zero
// volume. Its indexer clock is the horizon; browser wall time and metadata observation time are not.
// Keep both edges of long gaps, targeting 500 carry bars with at least two per gap. This mirrors the
// observed display behavior without making up trades or allocating millions of one-second bars.
export function clankDisplayCandles(source, timeframe = 1, indexedThrough = null) {
  if (!Array.isArray(source) || !source.length) return [];
  const span = finite(timeframe) && timeframe > 0 ? timeframe : 1;
  const lastTime = source.at(-1).t;
  const horizon = finite(indexedThrough) ? Math.max(lastTime, Math.floor(indexedThrough / span) * span) : lastTime;
  const gapSize = (i) => Math.max(0, Math.floor(((source[i + 1]?.t ?? horizon + span) - source[i].t) / span) - 1);
  let gaps = 0;
  for (let i = 0; i < source.length; i++) if (gapSize(i)) gaps++;
  const perGap = Math.max(2, Math.floor(500 / Math.max(1, gaps))), result = [];
  for (let i = 0; i < source.length; i++) {
    const bar = source[i], open = i ? source[i - 1].c : bar.o;
    result.push({ ...bar, o:open, h:Math.max(open,bar.h), l:Math.min(open,bar.l) });
    const missing = gapSize(i), count = Math.min(missing,perGap), firstHalf = Math.ceil(count/2);
    for (let j = 0; j < count; j++) {
      const distance = missing <= count || j < firstHalf ? j+1 : missing-count+j+1;
      result.push({t:bar.t+distance*span,o:bar.c,h:bar.c,l:bar.c,c:bar.c,v:0,carried:true});
    }
  }
  return result;
}

// Historical source candles are context, frozen the first time each interval arrives. All prices
// and volume from the practice boundary onward come exclusively from the local market engine.
export function createClankPracticeSeries() {
  const historyCache=new Map();let active='',output=[],prefix=[],previous=null,revision=0;
  return {
    update({key,history=[],historyThrough=null,practice=[],tf=1,base=0,started=0,solUsd=1,seed=null}) {
      const epoch=Math.floor(base/1000),at=epoch+Math.floor(started),cutoff=Math.floor(at/tf)*tf;
      const id=`${key}|${tf}|${epoch}|${started}|${solUsd}`;
      let saved=historyCache.get(id),newHistory=false;
      if(!saved&&history.length){
        const complete=history.filter(b=>b.t<cutoff);
        saved=clankDisplayCandles(complete,tf,finite(historyThrough)?Math.min(historyThrough,cutoff-1):null);historyCache.set(id,saved);newHistory=true;
        if(historyCache.size>64)historyCache.delete(historyCache.keys().next().value);
      }
      const offset=clankLowerBound(practice,Math.floor(started)),count=practice.length-offset;
      const changed=id!==active||newHistory||previous&&practice[offset]?.t!==previous.first;
      if(changed){active=id;prefix=saved||[];output=[...prefix];previous=null;revision++;}
      const last=count?practice.at(-1):null,current={first:practice[offset]?.t,n:count,last:signature(last)};
      if(!previous||current.n!==previous.n||current.last!==previous.last){
        let begin=previous&&current.n>=previous.n?Math.max(0,previous.n-1):0;
        if(!previous||current.n<previous.n)output=[...prefix];else output.length=prefix.length+begin;
        for(let i=begin;i<count;i++){const b=practice[offset+i];output.push({t:epoch+b.t,o:b.o*solUsd,h:b.h*solUsd,l:b.l*solUsd,c:b.c*solUsd,v:(b.v||0)*solUsd});}
        previous=current;
      }
      // A just-imported coin can precede its first engine tick. Its seed is an explicit practice quote.
      if(!count&&finite(seed)&&seed>0&&output.length===prefix.length)output.push({t:at,o:seed*solUsd,h:seed*solUsd,l:seed*solUsd,c:seed*solUsd,v:0});
      return {candles:output,revision,practiceAt:at,history:prefix.length>0};
    },
  };
}
export const clankLowerBound = (rows, t) => {
  let a = 0, b = rows.length;
  while (a < b) { const m = (a + b) >>> 1; if (rows[m].t < t) a = m + 1; else b = m; }
  return a;
};

export function createClankBuckets() {
  let bars = [], previous = null;
  return {
    update(source = [], timeframe = 1, reset = false) {
      const xs = Array.isArray(source) ? source : [];
      const tf = finite(timeframe) && timeframe > 0 ? timeframe : 1;
      const next = { tf, first: xs[0]?.t, n: xs.length, tail: signature(xs.at(-1)) };
      const full = reset || !previous || tf !== previous.tf || next.first !== previous.first || next.n < previous.n;
      if (!full && next.n === previous.n && next.tail === previous.tail) return { bars, from: bars.length, full: false, visited: 0 };
      let from = 0, start = 0;
      if (full) bars = [];
      else if (bars.length) {
        from = bars.length - 1;
        start = clankLowerBound(xs, bars[from].t);
        bars.length = from;
      }
      let visited = 0;
      for (let i = start; i < xs.length; i++) {
        const x = xs[i]; visited++;
        if (![x.t, x.o, x.h, x.l, x.c].every(finite) || x.h < x.l || x.c < 0) continue;
        const t = Math.floor(x.t / tf) * tf, last = bars.at(-1);
        if (last && t < last.t) continue;
        if (last && t === last.t) { last.h = Math.max(last.h, x.h); last.l = Math.min(last.l, x.l); last.c = x.c; last.v += finite(x.v) ? x.v : 0; }
        else bars.push({ t, o: x.o, h: x.h, l: x.l, c: x.c, v: finite(x.v) ? x.v : 0 });
      }
      previous = next;
      return { bars, from, full, visited };
    },
  };
}

// Indicator state is retained per bucket. Replacing the active candle recomputes only that bucket;
// a newly closed candle seeds the next one. Values remain null until their normal warm-up completes.
export function updateClankStudies(bars, rows, from = 0) {
  rows.length = Math.min(rows.length, from);
  for (let i = from; i < bars.length; i++) {
    const c = bars[i].c, p = rows[i - 1];
    const x = { total: (p?.total || 0) + c, sum20: (p?.sum20 || 0) + c - (i >= 20 ? bars[i - 20].c : 0) };
    const exp = (n, key) => i + 1 < n ? null : i + 1 === n ? x.total / n : p[key] + 2 / (n + 1) * (c - p[key]);
    x.ma = i >= 19 ? x.sum20 / 20 : null;
    x.ema = exp(9, 'ema'); x.e12 = exp(12, 'e12'); x.e26 = exp(26, 'e26');
    x.macd = x.e12 === null || x.e26 === null ? null : x.e12 - x.e26;
    x.macdSum = (p?.macdSum || 0) + (x.macd || 0);
    x.signal = i < 33 ? null : i === 33 ? x.macdSum / 9 : p.signal + .2 * (x.macd - p.signal);
    x.hist = x.signal === null ? null : x.macd - x.signal;
    const change = i ? c - bars[i - 1].c : 0;
    x.up = i <= 14 ? (p?.up || 0) + Math.max(0, change) / 14 : (p.up * 13 + Math.max(0, change)) / 14;
    x.down = i <= 14 ? (p?.down || 0) + Math.max(0, -change) / 14 : (p.down * 13 + Math.max(0, -change)) / 14;
    x.rsi = i < 14 ? null : x.down === 0 ? x.up === 0 ? 50 : 100 : 100 - 100 / (1 + x.up / x.down);
    rows.push(x);
  }
  return rows;
}
