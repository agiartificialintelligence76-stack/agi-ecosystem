// The market's candle array is append-only except for its currently open candle and retention
// trimming. Rebuild just the open timeframe bucket; replacement, rewind, and trimming reset it.
// Older-history corrections must supply a new array (the chart's existing contract).
export function createCandleStream() {
  const bars = [];
  let previous = null;
  return {
    update(rows, timeframe = 1) {
      const span = timeframe > 1 ? timeframe : 1;
      const length = rows.length;
      const last = rows[length - 1];
      const signature = last ? `${last.t}|${last.o}|${last.h}|${last.l}|${last.c}|${last.v}|${last.b}|${last.s}` : '';
      const incremental = previous && previous.rows === rows && previous.span === span && length >= previous.length
        && rows[0]?.t === previous.first && rows[previous.length - 1]?.t === previous.last;
      if (incremental && previous.length === length && previous.signature === signature) {
        return { bars, from: bars.length, changed: false, reset: false };
      }
      const from = incremental ? previous.bucket : 0;
      let start = incremental ? previous.start : 0;
      bars.length = from;
      let bucketStart = start;
      for (let i = start; i < length; i++) {
        const x = rows[i], time = Math.floor(x.t / span) * span, tail = bars[bars.length - 1];
        if (tail && tail.t === time) {
          tail.h = Math.max(tail.h, x.h); tail.l = Math.min(tail.l, x.l); tail.c = x.c;
          tail.v += x.v || 0; tail.b += x.b || 0; tail.s += x.s || 0;
        } else {
          bucketStart = i;
          bars.push({ t: time, o: x.o, h: x.h, l: x.l, c: x.c, v: x.v || 0, b: x.b || 0, s: x.s || 0 });
        }
      }
      previous = { rows, span, length, first: rows[0]?.t, last: last?.t, signature,
        start: bucketStart, bucket: Math.max(0, bars.length - 1) };
      return { bars, from, changed: true, reset: !incremental };
    },
  };
}
