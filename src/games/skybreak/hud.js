// Your altitude, charted like a ticker: one candle per two seconds of climbing.
const GREEN = '#16c784', RED = '#ea3943';

export class PriceChart {
  constructor(canvas, { candleSeconds = 2, keep = 36 } = {}) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.candleSeconds = candleSeconds;
    this.keep = keep;
    this.reset(0);
  }

  reset(price = 0) {
    this.candles = [];
    this.history = [];
    this.current = null;
    this.clock = 0;
    this.ath = price;
    this.open = price;
    this.last = price;
  }

  /** Feed the current altitude every frame. */
  push(price, dt) {
    this.clock += dt;
    this.last = price;
    this.ath = Math.max(this.ath, price);
    if (!this.current) this.current = { o: price, h: price, l: price, c: price };
    const c = this.current;
    c.h = Math.max(c.h, price); c.l = Math.min(c.l, price); c.c = price;
    if (this.clock >= this.candleSeconds) {
      this.clock = 0;
      this.candles.push(c);
      this.history.push(c);
      if (this.candles.length > this.keep) this.candles.shift();
      this.current = { o: price, h: price, l: price, c: price };
    }
  }

  change() {
    const first = this.candles[0]?.o ?? this.current?.o ?? 0;
    return first > 0.5 ? (this.last - first) / first * 100 : this.last > 0.5 ? 100 : 0;
  }

  draw(candles = [...this.candles, ...(this.current ? [this.current] : [])], { ath = this.ath, width, height } = {}) {
    const canvas = this.canvas, g = this.context;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const w = width || canvas.clientWidth || 240, h = height || canvas.clientHeight || 110;
    if (canvas.width !== Math.round(w * ratio) || canvas.height !== Math.round(h * ratio)) { canvas.width = Math.round(w * ratio); canvas.height = Math.round(h * ratio); }
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    g.clearRect(0, 0, w, h);
    if (!candles.length) return;
    let lo = Infinity, hi = -Infinity;
    for (const c of candles) { lo = Math.min(lo, c.l); hi = Math.max(hi, c.h); }
    hi = Math.max(hi, ath);
    const pad = Math.max(2, (hi - lo) * 0.12);
    lo -= pad; hi += pad;
    const y = (v) => h - 6 - (v - lo) / (hi - lo) * (h - 12);
    g.strokeStyle = 'rgba(223,215,199,0.08)';
    g.lineWidth = 1;
    for (let i = 1; i < 4; i++) { const gy = Math.round(h * i / 4) + 0.5; g.beginPath(); g.moveTo(0, gy); g.lineTo(w, gy); g.stroke(); }
    const step = (w - 44) / Math.max(candles.length, this.keep);
    const bodyW = Math.max(2, step * 0.62);
    candles.forEach((c, i) => {
      const x = 4 + i * step + step / 2;
      const up = c.c >= c.o;
      g.strokeStyle = g.fillStyle = up ? GREEN : RED;
      g.beginPath(); g.moveTo(Math.round(x) + 0.5, y(c.h)); g.lineTo(Math.round(x) + 0.5, y(c.l)); g.stroke();
      const top = y(Math.max(c.o, c.c)), bottom = y(Math.min(c.o, c.c));
      g.fillRect(x - bodyW / 2, top, bodyW, Math.max(1.5, bottom - top));
    });
    // All-time high and the last price.
    g.setLineDash([3, 3]);
    g.strokeStyle = 'rgba(255,214,102,0.7)';
    g.beginPath(); g.moveTo(0, Math.round(y(ath)) + 0.5); g.lineTo(w - 40, Math.round(y(ath)) + 0.5); g.stroke();
    g.setLineDash([]);
    const last = candles.at(-1).c;
    const up = last >= candles.at(-1).o;
    g.fillStyle = up ? GREEN : RED;
    g.fillRect(w - 40, y(last) - 7, 40, 14);
    g.fillStyle = '#0d0d10';
    g.font = '600 9px Mono, monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(last.toFixed(1), w - 20, y(last) + 0.5);
    g.fillStyle = 'rgba(255,214,102,0.9)';
    g.textAlign = 'left';
    g.fillText('ATH', 2, Math.max(7, y(ath) - 7));
  }

  /** The whole run, compressed into a fixed number of candles, for the finish screen. */
  summary(count = 48) {
    const all = [...this.history, ...(this.current ? [this.current] : [])];
    if (all.length <= count) return all;
    const out = [];
    const per = all.length / count;
    for (let i = 0; i < count; i++) {
      const slice = all.slice(Math.floor(i * per), Math.max(Math.floor(i * per) + 1, Math.floor((i + 1) * per)));
      out.push({ o: slice[0].o, c: slice.at(-1).c, h: Math.max(...slice.map((c) => c.h)), l: Math.min(...slice.map((c) => c.l)) });
    }
    return out;
  }
}
