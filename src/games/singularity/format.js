// SINGULARITY (2026-11-08): numbers and times the way the game shows them. Big numbers are the arcade kit's own
// (`fmt(n, { compact: true })`: 12.3K, 4.5M … 7.8Dc, then 1.23e40); this adds what an idle game needs on top: a decimal
// for small rates (0.1/s), whole FLOPs rounded down (what you have) or up (what something needs), and no "1000K".
// Pure: read in Node by tests/singularity.test.js.
import { fmt } from '../kit/fx.js';

function compact(n, digits) {
  const e = Math.floor(Math.log10(n) / 3);
  const v = n / 10 ** (e * 3);
  // 999,960 would round to "1000K": show the next step up ("1M") instead
  if (Number(v.toFixed(v >= 100 ? 0 : digits)) >= 1000) return fmt(10 ** ((e + 1) * 3), { compact: true, digits });
  return fmt(n, { compact: true, digits });
}

// FLOPs you have (rounded down, so you never see more than you can spend)
export function flops(n, digits = 1) {
  if (!Number.isFinite(n)) return n > 0 ? '∞' : '0';
  if (!(n > 0)) return '0';
  if (n < 1e4) return Math.floor(n).toLocaleString('en-US');
  return compact(n, digits);
}
// FLOPs something needs (rounded up, so "15" really is enough)
export function need(n, digits = 1) {
  if (!Number.isFinite(n)) return '∞';
  if (!(n > 0)) return '0';
  if (n < 1e4) return Math.ceil(n - 1e-9).toLocaleString('en-US');
  return compact(n, digits);
}
// FLOPs per second: one decimal below 100 (0.1/s, 2.5/s), then like FLOPs
export function rate(n, digits = 1) {
  if (!Number.isFinite(n)) return '∞';
  if (!(n > 0)) return '0';
  if (n < 100) return (Math.floor(n * 10) / 10).toFixed(1).replace(/\.0$/, '');
  return flops(n, digits);
}
// a time span: 45s · 3m 12s · 2h 05m · 3d 4h
export function duration(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  if (h < 24) return `${h}h ${String(m % 60).padStart(2, '0')}m`;
  return `${d}d ${h % 24}h`;
}
// a percentage: 12% · 0.5%
export const pct = (x) => {
  const v = x * 100;
  return `${v >= 10 || v === Math.round(v) ? Math.round(v) : v.toFixed(1)}%`;
};
