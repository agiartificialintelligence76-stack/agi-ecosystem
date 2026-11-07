// ALIGNMENT's layout (pure): where the meters, the day, the card and the two choice buttons go on any screen, from a
// 360 px phone to a 4K monitor, a phone held sideways, a foldable, and the 480 × 480 preview. CSS pixels.
//   tall: the meters in a row on top, a tarot card under them, the buttons under it (or beside it when there's room)
//   wide: a short, wide screen (a phone sideways): the meters on top, a landscape card, the buttons on either side
import { clamp } from '../kit/fx.js';

export const CARD_RATIO = 0.66;          // a tall card's width / height

export function computeLayout(W, H, { top = 64, bottom = 0, left = 0, right = 0, demo = false } = {}) {
  const sideL = 12 + left, sideR = 12 + right;
  const availW = Math.max(200, W - sideL - sideR);
  const short = H < 560;
  const wide = short && W >= H * 1.3;
  const buttons = !demo;

  // ---------- the meters and the day, one row ----------
  const ms = Math.round(clamp(Math.min(availW / 6.3, short ? H * 0.12 : H * 0.072), 34, demo ? 70 : H >= 1200 && W >= 1200 ? 92 : W >= 700 && H >= 900 ? 76 : 64));
  const dotsH = Math.round(ms * 0.34);
  const hudTop = top + (demo ? 6 : 2);
  const iconCy = hudTop + dotsH + ms / 2;
  const labelFs = Math.round(clamp(ms * 0.19, 9, 12));
  const labelY = iconCy + ms / 2 + 7 + labelFs / 2;
  const hudBottom = labelY + labelFs / 2 + 4;
  const dayR = Math.round(ms * 0.62);
  const gap = clamp((availW - 4 * ms - 2 * dayR) / 4, 6, ms * 0.85);
  const rowW = 4 * ms + 2 * dayR + 4 * gap;
  // five slots: People, Safety, the day, Compute, Heart
  let x = sideL + (availW - rowW) / 2;
  const centers = [];
  for (let i = 0; i < 5; i++) {
    const w = i === 2 ? 2 * dayR : ms;
    centers.push(x + w / 2);
    x += w + gap;
  }
  const meterX = [centers[0], centers[1], centers[3], centers[4]];
  const hud = { ms, dotsH, iconCy, labelY, labelFs, dayX: centers[2], dayR, meterX, top: hudTop, bottom: hudBottom };

  // ---------- the buttons' size ----------
  const btnH = short ? 50 : 56;                     // under the card
  const flankH = short ? 66 : H >= 1200 ? 92 : 76;    // beside it (an arrow over one or two lines of words)
  const flankW = Math.round(clamp(W * 0.15, 128, H >= 1200 ? 280 : 210));

  // ---------- the card ----------
  const regionTop = hudBottom + (short ? 8 : 14);
  let card, btns = null;
  if (wide) {
    const regionBottom = H - bottom - 10;
    const ch = Math.max(150, regionBottom - regionTop);
    const room = W - sideL - sideR - (buttons ? 2 * (flankW + 16) : 0);
    const cw = Math.round(Math.min(ch * 2.05, room, 640));
    card = { kind: 'wide', w: cw, h: Math.round(Math.min(ch, cw / 1.45)), cx: W / 2 + (left - right) / 2, cy: 0 };
    card.cy = regionTop + (regionBottom - regionTop) / 2;
    if (buttons) btns = flank(card, flankW, flankH, W, sideL, sideR);
  } else {
    // can the buttons stand beside the card (a big or wide screen), or do they go under it?
    const regionBottomFlank = H - bottom - 18;
    const chFlank = Math.min(regionBottomFlank - regionTop, clamp(H * 0.42, 400, 540) / 0.6);
    const cwFlank = Math.min(chFlank * CARD_RATIO, clamp(H * 0.42, 400, 540));
    const beside = buttons && W - sideL - sideR >= cwFlank + 2 * (flankW + 28) && W > H * 0.95;
    const regionBottom = beside || !buttons ? regionBottomFlank : H - bottom - 14 - btnH - 14;
    const regionH = Math.max(160, regionBottom - regionTop);
    // a bigger card on a bigger screen (a tablet, a 4K monitor), never wider than a tarot card should be
    const maxW = clamp(H * 0.42, 400, 540);
    let cw = Math.min(availW - 6, maxW, regionH * CARD_RATIO);
    let ch = Math.min(regionH, cw / 0.6, maxW / 0.6);
    // a narrow phone: a card as wide as the screen allows, a little shorter than tarot if it must be
    if (cw < availW - 6 && regionH * 0.74 >= availW - 6) { cw = Math.min(availW - 6, maxW); ch = Math.min(regionH, cw / 0.6); }
    card = { kind: 'tall', w: Math.round(cw), h: Math.round(ch), cx: W / 2 + (left - right) / 2, cy: regionTop + regionH / 2 };
    if (beside) btns = flank(card, flankW, flankH, W, sideL, sideR);
    else if (buttons) {
      const bw = Math.min((card.w - 12) / 2, 220);
      const y = Math.round(card.cy + card.h / 2 + 14);
      btns = {
        mode: 'below',
        left: { x: Math.round(card.cx - 6 - bw), y, w: Math.round(bw), h: btnH },
        right: { x: Math.round(card.cx + 6), y, w: Math.round(bw), h: btnH },
      };
    }
  }
  return { W, H, kind: card.kind, short, hud, card, btns, demo };
}

function flank(card, w, h, W, sideL, sideR) {
  const y = Math.round(card.cy - h / 2);
  const gapX = Math.min(40, Math.max(16, (W - sideL - sideR - card.w - 2 * w) / 4));
  return {
    mode: 'flank',
    left: { x: Math.round(card.cx - card.w / 2 - gapX - w), y, w, h },
    right: { x: Math.round(card.cx + card.w / 2 + gapX), y, w, h },
  };
}

// the card's own inside: the corner glyph, the portrait window, the name plate, the words (card-local pixels)
export function faceLayout(w, h, kind) {
  const pad = Math.max(9, Math.round(w * (kind === 'wide' ? 0.03 : 0.052)));
  const r = Math.max(12, Math.round(Math.min(w, h) * 0.065));
  if (kind === 'wide') {
    const win = { x: pad, y: pad, w: Math.round(Math.min(h - pad * 2, w * 0.42)), h: h - pad * 2 };
    const tx = win.x + win.w + pad * 1.6, tw = w - tx - pad * 1.4;
    const fs = clamp(Math.min(tw * 0.064, h * 0.072), 12, 18);
    const glyphR = Math.round(clamp(h * 0.06, 9, 15));
    const nameFs = clamp(h * 0.075, 12, 19);
    return { kind, w, h, pad, r, win, glyph: { x: tx + glyphR, y: pad + glyphR + 2, r: glyphR },
      numeral: { x: w - pad * 1.4, y: pad + glyphR + 2 }, name: { x: tx, y: pad + glyphR * 2 + nameFs * 0.9 + 6, fs: nameFs, align: 'left' },
      text: { x: tx, y: pad + glyphR * 2 + nameFs * 2.4 + 10, w: tw, bottom: h - pad * 1.2, fs }, label: { fs: clamp(win.w * 0.12, 14, 26) } };
  }
  const glyphR = Math.round(clamp(w * 0.048, 9, 16));
  const fs = clamp(w * 0.05, 12.5, 18.5);
  const lh = fs * 1.3;
  const nameFs = clamp(w * 0.058, 12, 21);
  const plateH = Math.round(nameFs * 1.75);
  const roleFs = clamp(w * 0.046, 11, 16);
  const winY = pad + glyphR * 2 + Math.round(w * 0.02);
  const textH = lh * 4.6;
  const below = plateH / 2 + roleFs * 1.5 + Math.round(w * 0.025) + textH + pad;
  const winH = Math.max(Math.round(w * 0.36), h - winY - below);
  const win = { x: pad, y: winY, w: w - pad * 2, h: winH };
  const roleY = win.y + win.h + plateH / 2 + roleFs * 0.95 + 2;
  return { kind, w, h, pad, r, win, glyph: { x: pad + glyphR, y: pad + glyphR - 1, r: glyphR },
    numeral: { x: w / 2, y: pad + glyphR - 1 }, plate: { cy: win.y + win.h, h: plateH, fs: nameFs },
    role: { y: roleY, fs: roleFs },
    text: { x: pad * 1.5, y: roleY + roleFs * 0.6 + Math.round(w * 0.022), w: w - pad * 3, bottom: h - pad * 1.05, fs },
    label: { fs: clamp(w * 0.085, 15, 30) } };
}
