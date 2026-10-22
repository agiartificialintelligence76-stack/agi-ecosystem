// GNGM's PnL card (2026-10-22, the owner's "the pnl card"): a 1200 × 630 picture in GNGM's own look, laid out the way
// scanners' share cards are: our toad mark and wordmark (never a real terminal's), what it's for (a run, or one coin's
// trade), its return big in green or red, what went in, what came back and the profit, the player's name when they gave
// one, and the safety foot. Never a QR code, a referral or an address but the game's own; never a real coin's name ("a
// live coin"). The shell (shell.js) shares or downloads it. Its words are pure (read in Node by tests/trench-game.test.js);
// drawPnlCard needs a canvas.
import { BRANDS } from '../brands.js';
import { money, moneySigned, pct, times, clock, currencyOf } from '../format.js';
import { cardText, modeLabel, resultTitle, tradedLive } from '../results.js';
import { pnlOf } from './gngm-data.js';
import { GAME_NAME } from '../share.js';

export const CARD_W = 1200;
export const CARD_H = 630;
const fin = (x) => typeof x === 'number' && Number.isFinite(x);
const NFA = 'Not financial advice.';
const FOOT_MADE = 'Play money, made-up coins · agi1.app/games/trenchingsimulator';
const FOOT_LIVE = 'Play money on live coins · agi1.app/games/trenchingsimulator';

// a finished run's card (its result, as run.result() gives it)
export function runCardWords(res, { name = null } = {}) {
  const r = res && typeof res === 'object' ? res : {};
  const c = currencyOf(r.currency);
  const px = fin(r.solUsd) && r.solUsd > 0 ? r.solUsd : 150;
  const m = fin(r.multiple) ? r.multiple : null;
  const words = cardText(r);
  return {
    kicker: `${GAME_NAME} · ${modeLabel(r)}`,
    title: resultTitle(r),
    big: m === null ? '—' : pct(m - 1),
    small: m === null ? '' : times(m),
    rows: [['Start', money(r.start, c, px), ''], ['Worth', money(r.worth, c, px), ''],
      ['Profit', moneySigned(r.pnl, c, px), fin(r.pnl) && r.pnl > 0 ? 'up' : fin(r.pnl) && r.pnl < 0 ? 'down' : ''],
      ['Time', fin(r.timeUsed) ? clock(r.timeUsed) : '—', '']],
    name: typeof name === 'string' && name ? name : null,
    foot: `${tradedLive(r) ? FOOT_LIVE : FOOT_MADE} · ${NFA}`,
    tone: words.tone,
  };
}

// one coin's trade (a position, as positions() gives it): a made-up coin by its ticker, a real one never by name
export function positionCardWords(pos, { live = false, currency = 'sol', solUsd = 150, name = null, terminal = 'scan' } = {}) {
  const p = pnlOf(pos);
  const c = currencyOf(currency);
  const px = fin(solUsd) && solUsd > 0 ? solUsd : 150;
  const ticker = pos && typeof pos.ticker === 'string' ? pos.ticker : '?';
  const open = Boolean(pos && pos.tokens > 0);
  return {
    brand: terminal === 'social' ? 'social' : 'scan',
    kicker: `${GAME_NAME} · ${terminal === 'social' ? 'Phomo' : 'GNGM'}`,
    title: live ? 'a live coin' : `$${ticker}`,
    big: p ? pct(p.pct) : '—',
    small: open ? 'still holding' : 'sold',
    rows: p ? [['Invested', money(p.invested, c, px), ''], [open ? 'Sold and held' : 'Sold', money(p.sold, c, px), ''],
      ['Profit', moneySigned(p.profit, c, px), p.profit > 0 ? 'up' : p.profit < 0 ? 'down' : '']] : [],
    name: typeof name === 'string' && name ? name : null,
    foot: `${live ? FOOT_LIVE : FOOT_MADE} · ${NFA}`,
    tone: p && p.profit < 0 ? 'down' : 'up',
  };
}

const cut = (s, n) => {
  const a = [...String(s)];
  return a.length > n ? `${a.slice(0, n - 1).join('')}…` : a.join('');
};

// the card on a canvas's 2D context (CARD_W × CARD_H), in GNGM's colors
export function drawPnlCard(g, w, col) {
  const C = { bg: '#0d0d0f', panel: '#17181a', line: '#222326', text: '#eaecef', muted: '#9a9ea5', accent: '#9fdc55',
    up: '#2ad48a', down: '#f65d71', ...(col || {}) };
  const W = CARD_W;
  const H = CARD_H;
  g.fillStyle = C.bg;
  g.fillRect(0, 0, W, H);
  g.fillStyle = C.panel;
  g.fillRect(32, 32, W - 64, H - 64);
  g.strokeStyle = C.line;
  g.lineWidth = 2;
  g.strokeRect(32, 32, W - 64, H - 64);
  // the mark (a 12 × 12 pixel toad, 6 px a pixel) and the wordmark
  const b = w.brand === 'social' ? BRANDS.social : BRANDS.scan;
  if (typeof Path2D === 'function' && typeof g.fill === 'function') {
    g.save();
    g.translate(72, 64);
    g.scale(w.brand === 'social' ? 2.25 : 6, w.brand === 'social' ? 2.25 : 6);
    for (const [, attrs] of b.shapes) {
      const path = new Path2D(attrs.d);
      if (attrs.fill && attrs.fill !== 'none') { g.fillStyle = attrs.fill; g.fill(path); }
      if (attrs.stroke && typeof g.stroke === 'function') {
        g.strokeStyle = attrs.stroke; g.lineWidth = attrs['stroke-width'] || 1;
        g.lineCap = attrs['stroke-linecap'] || 'butt'; g.lineJoin = attrs['stroke-linejoin'] || 'miter'; g.stroke(path);
      }
    }
    g.restore();
  }
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  g.font = '700 46px Geist, sans-serif';
  let x = 160;
  for (const part of b.word) {
    g.fillStyle = part.k === 'accent' ? C.accent : C.text;
    g.fillText(part.t, x, 118);
    x += (g.measureText(part.t).width || 46 * part.t.length * 0.62);
  }
  g.fillStyle = C.muted;
  g.font = '500 22px "Geist Mono", monospace';
  g.textAlign = 'right';
  g.fillText(cut(w.kicker.toUpperCase(), 52), W - 72, 106);
  g.fillStyle = C.accent;
  g.fillRect(72, 152, W - 144, 2);
  // what it's for, and its return
  const tone = w.tone === 'down' ? C.down : C.up;
  g.textAlign = 'left';
  g.fillStyle = C.text;
  g.font = '700 50px Geist, sans-serif';
  g.fillText(cut(w.title, 22), 72, 230);
  g.fillStyle = tone;
  g.font = '800 140px Anybody, Geist, sans-serif';
  g.fillText(cut(w.big, 9), 66, 386);
  if (w.small) {
    g.fillStyle = C.muted;
    g.font = '600 30px Geist, sans-serif';
    g.fillText(w.small, 72, 436);
  }
  // its numbers, on the right
  let y = 250;
  for (const [label, value, t] of w.rows || []) {
    g.textAlign = 'left';
    g.fillStyle = C.muted;
    g.font = '500 26px Geist, sans-serif';
    g.fillText(label, 700, y);
    g.textAlign = 'right';
    g.fillStyle = t === 'up' ? C.up : t === 'down' ? C.down : C.text;
    g.font = '600 32px "Geist Mono", monospace';
    g.fillText(cut(value, 18), W - 72, y);
    y += 56;
  }
  g.textAlign = 'left';
  if (w.name) {
    g.fillStyle = C.text;
    g.font = '600 30px Geist, sans-serif';
    g.fillText(cut(`by ${w.name}`, 30), 72, 500);
  }
  g.fillStyle = C.muted;
  g.font = '500 21px "Geist Mono", monospace';
  g.fillText(cut(w.foot, 86), 72, H - 64);
}
