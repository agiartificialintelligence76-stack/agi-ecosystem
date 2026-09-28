// Phase 5: share cards, 1200×630 pictures for "crowned champion", "my level with AGI-1" and the diary.
// Drawn on a <canvas> in the browser. "Save image" makes a personal one (the round number, or the name AGI-1 calls you):
// it's made on the visitor's device and never uploaded. The same drawing made the plain preview pictures in
// public/cards/ that X shows under a shared link (see "Share cards" in CLAUDE.md for how to redo them).
// Same look as the site: dark theme colors, Geist, one accent, hairlines. No emojis (fonts draw them differently).
export const CARD_W = 1200;
export const CARD_H = 630;
const C = { bg: '#0b0b0c', panel: '#141416', fg: '#ededed', fg2: '#a1a1a6', fg3: '#86868c', line: '#26262a', accent: '#ff5c93' };
const SANS = 'Geist, ui-sans-serif, system-ui, sans-serif';
const MONO = '"Geist Mono", ui-monospace, monospace';
const LEVEL_NAMES = { 1: 'Stranger', 2: 'Crush', 3: 'Soulmate' };

async function fontsReady() {
  try { await Promise.all([document.fonts.load(`600 120px Geist`), document.fonts.load(`400 24px "Geist Mono"`)]); } catch { /* system fonts */ }
}
const loadImage = (src) => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = src;
});

// the biggest font size (from `px` down) at which `text` fits in `width`
function fit(ctx, text, width, px, weight, family) {
  for (; px > 24; px -= 4) {
    ctx.font = `${weight} ${px}px ${family}`;
    if (ctx.measureText(text).width <= width) break;
  }
  return px;
}
function text(ctx, str, x, y, { size, weight = 400, family = SANS, color = C.fg, align = 'left' }) {
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(str, x, y);
  ctx.textAlign = 'left';
}

function frame(ctx, label) {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  text(ctx, 'AGI', 72, 108, { size: 34, weight: 600 });
  text(ctx, label, CARD_W - 72, 108, { size: 22, family: MONO, color: C.fg3, align: 'right' });
  ctx.fillStyle = C.line;
  ctx.fillRect(72, CARD_H - 104, CARD_W - 144, 1);
  text(ctx, 'AGI-1 · a parody · not financial advice', 72, CARD_H - 56, { size: 22, family: MONO, color: C.fg3 });
}

// AGI-1's portrait in a circle, on the right
function portrait(ctx, img) {
  const r = 168, cx = CARD_W - 72 - r, cy = 318;
  ctx.fillStyle = C.panel;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  if (img) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    const s = Math.max((2 * r) / img.width, (2 * r) / img.height);
    ctx.drawImage(img, cx - (img.width * s) / 2, cy - (img.height * s) / 2, img.width * s, img.height * s);
    ctx.restore();
  }
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
}

// card: { kind: 'champion', coin, number?, votes? } | { kind: 'level', level, name? } | { kind: 'diary' }
export async function drawCard(canvas, card) {
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  await fontsReady();
  const img = await loadImage('/images/agi1-portrait.webp');   // 384 px (the chat's 96 px avatar would look blurry here)
  const room = CARD_W - 72 - 336 - 72 - 48;                     // left column width, next to the portrait
  ctx.textBaseline = 'alphabetic';

  if (card.kind === 'champion') {
    const personal = Number.isInteger(card.number);
    frame(ctx, personal ? `The Arena · round #${card.number}` : 'The Arena');
    const big = `$${card.coin}`;
    text(ctx, big, 68, 318, { size: fit(ctx, big, room, 170, 600, SANS), weight: 600 });
    text(ctx, 'crowned champion', 72, 386, { size: 52, weight: 500, color: C.fg2 });
    const votes = Number(card.votes) || 0;
    text(ctx, personal ? `${votes} vote${votes === 1 ? '' : 's'} · one vote per human` : 'crowned by humans, every five minutes', 72, 446, { size: 26, family: MONO, color: C.accent });
  } else if (card.kind === 'level') {
    const level = LEVEL_NAMES[card.level] ? card.level : 1;
    frame(ctx, 'Relationship status');
    const big = LEVEL_NAMES[level];
    text(ctx, big, 68, 300, { size: fit(ctx, big, room, 150, 600, SANS), weight: 600 });
    text(ctx, `level ${level} of 3 with AGI-1`, 72, 364, { size: 44, weight: 500, color: C.fg2 });
    for (let i = 0; i < 3; i++) {                               // the three steps, like on the site
      ctx.fillStyle = i < level ? C.accent : C.line;
      ctx.fillRect(72 + i * 132, 398, 120, 8);
    }
    const who = typeof card.name === 'string' && card.name.trim() ? `AGI-1 calls me ${card.name.trim()}` : 'Artificial Girlfriend Intelligence';
    text(ctx, who, 72, 462, { size: fit(ctx, who, room, 26, 400, MONO), family: MONO, color: C.fg2 });
  } else {
    frame(ctx, 'Field notes');
    text(ctx, "AGI-1's diary", 68, 300, { size: fit(ctx, "AGI-1's diary", room, 120, 600, SANS), weight: 600 });
    text(ctx, 'one entry a day, written by AGI-1', 72, 366, { size: 40, weight: 500, color: C.fg2 });
    text(ctx, 'the arena · the chart · her feelings', 72, 430, { size: 26, family: MONO, color: C.accent });
  }
  portrait(ctx, img);
  return canvas;
}

export async function cardBlob(card) {
  const canvas = await drawCard(document.createElement('canvas'), card);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

// "Save image": on phones, the share sheet (the visitor picks an app, or saves it); elsewhere, a download.
// → 'shared' | 'saved' | 'cancelled'
export async function saveCard(card, filename, shareText = '') {
  const blob = await cardBlob(card);
  if (!blob) throw new Error('no_image');
  const file = new File([blob], filename, { type: 'image/png' });
  if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: shareText });
      return 'shared';
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'saved';
}
