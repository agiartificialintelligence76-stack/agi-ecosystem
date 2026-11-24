// TOO MANY TABS: her tabs' little pictures, drawn in code (no emoji, no image files: the same on every phone). Each kind
// has a color and an ink icon; a tab is a sticker tile with a browser-tab notch on top.
import { roundRect, star, mix, TAU } from '../kit/fx.js';
import { KINDS } from './rules.js';

const INK = '#170a36', PAPER = '#fffaf0';

function heart(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.8);
  ctx.bezierCurveTo(x - r * 1.3, y - r * 0.05, x - r * 0.62, y - r * 1.1, x, y - r * 0.4);
  ctx.bezierCurveTo(x + r * 0.62, y - r * 1.1, x + r * 1.3, y - r * 0.05, x, y + r * 0.8);
  ctx.closePath();
}

// one icon, centred on x, y, about 2r across, in ink with paper highlights
export function icon(ctx, kind, x, y, r) {
  const id = KINDS[kind]?.id;
  ctx.save();
  ctx.fillStyle = INK; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.4, r * 0.16); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  switch (id) {
    case 'cat':
      ctx.beginPath();
      ctx.moveTo(x - r * 0.8, y - r * 0.1); ctx.lineTo(x - r * 0.7, y - r * 0.95); ctx.lineTo(x - r * 0.25, y - r * 0.55);
      ctx.lineTo(x + r * 0.25, y - r * 0.55); ctx.lineTo(x + r * 0.7, y - r * 0.95); ctx.lineTo(x + r * 0.8, y - r * 0.1);
      ctx.quadraticCurveTo(x + r * 0.85, y + r * 0.75, x, y + r * 0.75); ctx.quadraticCurveTo(x - r * 0.85, y + r * 0.75, x - r * 0.8, y - r * 0.1);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = PAPER;
      ctx.beginPath(); ctx.arc(x - r * 0.33, y + r * 0.05, r * 0.14, 0, TAU); ctx.arc(x + r * 0.33, y + r * 0.05, r * 0.14, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ff7ab8'; ctx.beginPath(); ctx.moveTo(x - r * 0.1, y + r * 0.3); ctx.lineTo(x + r * 0.1, y + r * 0.3); ctx.lineTo(x, y + r * 0.42); ctx.closePath(); ctx.fill();
      break;
    case 'boba':
      ctx.beginPath(); ctx.moveTo(x - r * 0.62, y - r * 0.45); ctx.lineTo(x + r * 0.62, y - r * 0.45); ctx.lineTo(x + r * 0.45, y + r * 0.9); ctx.lineTo(x - r * 0.45, y + r * 0.9); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x + r * 0.1, y - r * 0.45); ctx.lineTo(x + r * 0.4, y - r * 1.05); ctx.stroke();
      ctx.fillStyle = PAPER;
      for (const [dx, dy] of [[-0.22, 0.6], [0.05, 0.68], [0.28, 0.55], [-0.05, 0.42]]) { ctx.beginPath(); ctx.arc(x + dx * r, y + dy * r, r * 0.11, 0, TAU); ctx.fill(); }
      ctx.fillRect(x - r * 0.56, y - r * 0.32, r * 1.12, r * 0.12);
      break;
    case 'music':
      ctx.beginPath(); ctx.ellipse(x - r * 0.45, y + r * 0.55, r * 0.28, r * 0.22, -0.4, 0, TAU); ctx.ellipse(x + r * 0.5, y + r * 0.35, r * 0.28, r * 0.22, -0.4, 0, TAU); ctx.fill();
      ctx.lineWidth = r * 0.16;
      ctx.beginPath(); ctx.moveTo(x - r * 0.2, y + r * 0.5); ctx.lineTo(x - r * 0.2, y - r * 0.75); ctx.lineTo(x + r * 0.75, y - r * 0.95); ctx.lineTo(x + r * 0.75, y + r * 0.3); ctx.stroke();
      ctx.lineWidth = r * 0.26; ctx.beginPath(); ctx.moveTo(x - r * 0.2, y - r * 0.62); ctx.lineTo(x + r * 0.75, y - r * 0.82); ctx.stroke();
      break;
    case 'heart': heart(ctx, x, y + r * 0.05, r * 0.95); ctx.fill(); ctx.fillStyle = PAPER; ctx.beginPath(); ctx.arc(x - r * 0.38, y - r * 0.28, r * 0.13, 0, TAU); ctx.fill(); break;
    case 'moon':
      ctx.beginPath(); ctx.arc(x, y, r * 0.85, 0.35, TAU - 0.35); ctx.arc(x + r * 0.42, y - r * 0.12, r * 0.62, TAU - 1.1, 1.1, true); ctx.closePath(); ctx.fill();
      ctx.fillStyle = PAPER; star(ctx, x + r * 0.62, y - r * 0.55, r * 0.2, r * 0.08, 4); ctx.fill();
      break;
    case 'bolt':
      ctx.beginPath(); ctx.moveTo(x + r * 0.2, y - r); ctx.lineTo(x - r * 0.6, y + r * 0.15); ctx.lineTo(x - r * 0.02, y + r * 0.15); ctx.lineTo(x - r * 0.25, y + r);
      ctx.lineTo(x + r * 0.62, y - r * 0.2); ctx.lineTo(x + r * 0.05, y - r * 0.2); ctx.closePath(); ctx.fill();
      break;
    case 'mail':
      roundRect(ctx, x - r * 0.85, y - r * 0.6, r * 1.7, r * 1.2, r * 0.16); ctx.fill();
      ctx.strokeStyle = PAPER; ctx.lineWidth = r * 0.14; ctx.beginPath(); ctx.moveTo(x - r * 0.65, y - r * 0.38); ctx.lineTo(x, y + r * 0.1); ctx.lineTo(x + r * 0.65, y - r * 0.38); ctx.stroke();
      break;
    case 'star': star(ctx, x, y + r * 0.05, r, r * 0.45, 5); ctx.fill(); break;
    case 'leaf':
      ctx.beginPath(); ctx.moveTo(x - r * 0.75, y + r * 0.75); ctx.quadraticCurveTo(x - r * 0.75, y - r * 0.8, x + r * 0.85, y - r * 0.85); ctx.quadraticCurveTo(x + r * 0.75, y + r * 0.7, x - r * 0.75, y + r * 0.75); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = PAPER; ctx.lineWidth = r * 0.12; ctx.beginPath(); ctx.moveTo(x - r * 0.55, y + r * 0.55); ctx.lineTo(x + r * 0.5, y - r * 0.5); ctx.stroke();
      break;
    case 'ghost':
      ctx.beginPath(); ctx.moveTo(x - r * 0.7, y + r * 0.85); ctx.lineTo(x - r * 0.7, y - r * 0.1); ctx.arc(x, y - r * 0.1, r * 0.7, Math.PI, 0); ctx.lineTo(x + r * 0.7, y + r * 0.85);
      for (let i = 0; i < 3; i++) { const sx = x + r * 0.7 - (i + 1) * r * 0.467; ctx.quadraticCurveTo(sx + r * 0.233, y + r * 0.55, sx, y + r * 0.85); }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = PAPER; ctx.beginPath(); ctx.ellipse(x - r * 0.25, y - r * 0.12, r * 0.12, r * 0.18, 0, 0, TAU); ctx.ellipse(x + r * 0.25, y - r * 0.12, r * 0.12, r * 0.18, 0, 0, TAU); ctx.fill();
      break;
    case 'pizza':
      ctx.beginPath(); ctx.moveTo(x, y + r * 0.95); ctx.lineTo(x - r * 0.8, y - r * 0.55); ctx.quadraticCurveTo(x, y - r * 0.95, x + r * 0.8, y - r * 0.55); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ff5a5f';
      for (const [dx, dy] of [[-0.25, -0.25], [0.2, -0.1], [0, 0.35]]) { ctx.beginPath(); ctx.arc(x + dx * r, y + dy * r, r * 0.15, 0, TAU); ctx.fill(); }
      break;
    case 'chat':
      roundRect(ctx, x - r * 0.85, y - r * 0.7, r * 1.7, r * 1.15, r * 0.4); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - r * 0.4, y + r * 0.35); ctx.lineTo(x - r * 0.55, y + r * 0.9); ctx.lineTo(x + r * 0.05, y + r * 0.4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = PAPER; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(x + i * r * 0.42, y - r * 0.12, r * 0.12, 0, TAU); ctx.fill(); }
      break;
    case 'camera':
      roundRect(ctx, x - r * 0.9, y - r * 0.5, r * 1.8, r * 1.25, r * 0.25); ctx.fill();
      roundRect(ctx, x - r * 0.35, y - r * 0.8, r * 0.7, r * 0.4, r * 0.1); ctx.fill();
      ctx.fillStyle = PAPER; ctx.beginPath(); ctx.arc(x, y + r * 0.1, r * 0.4, 0, TAU); ctx.fill();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x, y + r * 0.1, r * 0.22, 0, TAU); ctx.fill();
      break;
    case 'game':
      roundRect(ctx, x - r * 0.95, y - r * 0.5, r * 1.9, r * 1.05, r * 0.5); ctx.fill();
      ctx.fillStyle = PAPER;
      ctx.fillRect(x - r * 0.62, y - r * 0.06, r * 0.42, r * 0.13); ctx.fillRect(x - r * 0.47, y - r * 0.21, r * 0.13, r * 0.42);
      ctx.beginPath(); ctx.arc(x + r * 0.38, y - r * 0.1, r * 0.11, 0, TAU); ctx.arc(x + r * 0.6, y + r * 0.1, r * 0.11, 0, TAU); ctx.fill();
      break;
    default: break;
  }
  ctx.restore();
}

// a tab: a sticker tile with a little browser-tab notch, its kind's color, its icon. `state`: 'free' | 'blocked' | 'hidden'
export function tab(ctx, kind, x, y, s, { state = 'free', lift = 0, glow = 0 } = {}) {
  const k = KINDS[kind];
  const r = s * 0.2;
  // its edge (the stack's depth)
  ctx.fillStyle = INK;
  roundRect(ctx, x - s / 2, y - s / 2 + lift, s, s, r); ctx.fill();
  const face = state === 'hidden' ? '#cdb8ff' : mix(k.color, PAPER, 0.5);
  ctx.fillStyle = face;
  roundRect(ctx, x - s / 2, y - s / 2, s, s, r); ctx.fill();
  ctx.lineWidth = Math.max(1.5, s * 0.045); ctx.strokeStyle = INK; ctx.stroke();
  // the tab's notch: a colored strip with a dot, like a browser tab's favicon
  if (state !== 'hidden') {
    ctx.fillStyle = k.color;
    roundRect(ctx, x - s * 0.36, y - s * 0.4, s * 0.72, s * 0.15, s * 0.07); ctx.fill();
    ctx.lineWidth = Math.max(1, s * 0.03); ctx.stroke();
    icon(ctx, kind, x, y + s * 0.1, s * 0.28);
  } else {
    ctx.fillStyle = INK;
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(x + i * s * 0.16, y, s * 0.05, 0, TAU); ctx.fill(); }
  }
  if (glow > 0) {
    ctx.globalAlpha = glow; ctx.lineWidth = 3; ctx.strokeStyle = '#fffaf0';
    roundRect(ctx, x - s / 2 - 3, y - s / 2 - 3, s + 6, s + 6, r + 3); ctx.stroke(); ctx.globalAlpha = 1;
  }
  if (state === 'blocked' || state === 'hidden') {
    ctx.fillStyle = state === 'hidden' ? 'rgba(23, 10, 54, .38)' : 'rgba(23, 10, 54, .46)';
    roundRect(ctx, x - s / 2, y - s / 2, s, s, r); ctx.fill();
  }
}
