// Lightweight Charts candlestick + volume widget for Clank Tank (agi1.app/clanktrade).
// Uses Apache-2.0 TradingView Lightweight Charts already installed in this repo; loaded only when a chart is shown.
let libPromise = null;

function loadLib() {
  if (!libPromise) libPromise = import('lightweight-charts');
  return libPromise;
}

function compactUsd(v) {
  if (!Number.isFinite(v)) return '$0';
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

export function createTankChart(host, { background = '#141418' } = {}) {
  let chart = null;
  let candleSeries = null;
  let volumeSeries = null;
  let dead = false;
  let pendingData = null;

  async function init() {
    const L = await loadLib();
    if (dead || chart) return;
    chart = L.createChart(host, {
      autoSize: true,
      layout: {
        background: { type: L.ColorType.Solid, color: background },
        textColor: '#a6a6b4',
        fontFamily: 'Clank Suisse, system-ui, sans-serif',
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.04)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      crosshair: {
        mode: L.CrosshairMode.Normal,
        vertLine: { color: '#c4b5fd66', style: 2, labelBackgroundColor: '#2a2538' },
        horzLine: { color: '#c4b5fd66', style: 2, labelBackgroundColor: '#2a2538' },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.12, bottom: 0.2 },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 6,
      },
    });

    candleSeries = chart.addSeries(L.CandlestickSeries, {
      upColor: '#00e587',
      downColor: '#ff4d6d',
      wickUpColor: '#00e587',
      wickDownColor: '#ff4d6d',
      borderVisible: false,
      priceFormat: { type: 'custom', formatter: compactUsd, minMove: 0.01 },
    });

    volumeSeries = chart.addSeries(L.HistogramSeries, {
      priceScaleId: '',
      priceFormat: { type: 'volume' },
      priceLineVisible: false,
      lastValueVisible: false,
    });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    if (pendingData) apply(pendingData);
  }

  function apply(candles) {
    if (!chart || !candleSeries || !volumeSeries) return;
    const clean = (Array.isArray(candles) ? candles : [])
      .filter((b) => Number.isFinite(b.t) && Number.isFinite(b.o) && Number.isFinite(b.h) && Number.isFinite(b.l) && Number.isFinite(b.c))
      .sort((a, b) => a.t - b.t);
    const dedup = [];
    for (const bar of clean) {
      if (dedup.length && dedup[dedup.length - 1].t === bar.t) dedup[dedup.length - 1] = bar;
      else dedup.push(bar);
    }
    candleSeries.setData(dedup.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c })));
    volumeSeries.setData(dedup.map((b) => ({
      time: b.t,
      value: Number.isFinite(b.v) ? b.v : 0,
      color: b.c >= b.o ? '#00e58740' : '#ff4d6d40',
    })));
    chart.timeScale().fitContent();
  }

  init().catch(() => {});

  return {
    setCandles(candles) {
      pendingData = candles;
      if (chart) apply(candles);
    },
    destroy() {
      dead = true;
      chart?.remove();
      chart = null;
    },
  };
}
