// JAILBREAK: drawing the game on its canvas. The world's backdrop over the whole screen, then the field (in field
// units, scaled to fit): its frame, AGI-1 dimly behind a glass that cracks as the bricks fall, the bricks, THE WARDEN,
// the power-ups, the paddle, the balls, the bits that fly, and the field's own numbers (the level, the combo, lives,
// power-ups, the Warden's health). Everything slow to draw comes from sprites.js, made once per size and world.
import { roundRect, rgba, mix, ease, clamp, TAU } from '../kit/fx.js';
import { REDUCED } from '../kit/env.js';
import { CELL_W, CELL_H, FIELD_W } from './levels.js';
import { POWERS, homing } from './sim.js';
import { launchVelocity } from './physics.js';
import { BOMB_R } from './boss.js';
import {
  INK, PAD, CAP_W, CAP_H, POWER_LOOK, makeBricks, makeCapsules, makeGlow, makePattern, makeArt, makeGlass, crackNet,
  drawCracks, heartPath, icon, starPath,
} from './sprites.js';

export const FRAME = 10;                       // the field's frame, in field units, all the way round
const W = FIELD_W;
const DISPLAY = "'AK Display', 'Arial Black', sans-serif", MONO = "'AK Mono', ui-monospace, monospace", SERIF = "'AK Serif', Georgia, serif", SANS = "'AK Sans', sans-serif";

export function createRenderer(view) {
  const ctx = view.ctx;
  const art = new Image();
  art.decoding = 'async';
  art.src = '/images/agi1-live-2d.webp';
  const face = new Image();
  face.src = '/images/landing/agi1-face.webp';
  let artReady = false;
  art.addEventListener('load', () => { artReady = true; key.art = ''; });
  const key = { k: 0, world: 0, H: 0, art: '', crack: '' };
  const C = { bricks: null, caps: null, glowBall: null, glowFire: null, glowThr: null, glowEye: null, pattern: null, fill: null,
    artDim: null, artFull: null, glass: null, net: null, crack: document.createElement('canvas'),
    back: document.createElement('canvas'), bg: document.createElement('canvas') };
  const crackG = C.crack.getContext('2d');
  const backG = C.back.getContext('2d', { alpha: false }), bgG = C.bg.getContext('2d');
  const setFont = (g, weight, px, fam = DISPLAY) => {
    g.font = `${weight} ${px}px ${fam}`;
    if ('fontStretch' in g) g.fontStretch = fam === DISPLAY ? 'semi-expanded' : 'normal';
  };

  function ensure(world, scale, H, levelId) {
    const k = scale * view.dpr;
    if (Math.abs(k - key.k) > 0.001 || key.world !== world.n) {
      C.bricks = makeBricks(world, k);
      C.caps = makeCapsules(k);
      C.glowBall = makeGlow(world.accent, 18, k, 0.9);
      C.glowFire = makeGlow('#ff8a3d', 22, k, 1.2);
      C.glowThr = makeGlow(world.accent, 14, k, 1);
      C.glowEye = makeGlow('#ffc933', 34, k, 1.1);
      key.art = ''; key.crack = '';
    }
    if (key.world !== world.n || Math.abs(view.dpr - (key.dpr || 0)) > 0.001 || !C.pattern) {
      C.pattern = makePattern(world, view.dpr);
      C.fill = ctx.createPattern(C.pattern, 'repeat');
      key.dpr = view.dpr;
    }
    const artKey = `${k.toFixed(3)}|${world.n}|${H}|${artReady}`;
    if (key.art !== artKey) {
      C.artDim = makeArt(art, world, W, H, k, false);
      C.artFull = makeArt(art, world, W, H, k, true);
      C.glass = makeGlass(world, W, H, k);
      key.art = artKey;
    }
    if (key.netFor !== levelId) { C.net = crackNet(hashOf(String(levelId)), W, H); key.netFor = levelId; key.crack = ''; }
    key.k = k; key.world = world.n; key.H = H;
  }

  // ---------- the whole frame ----------
  function draw(F) {
    const { s, fit, world } = F;
    const H = s.H;
    ensure(world, fit.scale, H, F.levelKey);
    const g = ctx, dpr = view.dpr, k = fit.scale * dpr;
    const ox = (fit.x + FRAME * fit.scale) * dpr, oy = (fit.y + FRAME * fit.scale) * dpr;
    // the backdrop, the side labels and the frame: drawn once, kept until something about them changes
    const bk = `${view.canvas.width}x${view.canvas.height}|${world.n}|${ox.toFixed(1)},${oy.toFixed(1)},${k.toFixed(4)}|${H}|${F.fonts}|${F.sideHud}|${F.mode}`;
    if (key.back !== bk) {
      C.back.width = view.canvas.width; C.back.height = view.canvas.height;
      backG.setTransform(1, 0, 0, 1, 0, 0);
      backG.fillStyle = C.fill || world.bg;
      backG.fillRect(0, 0, C.back.width, C.back.height);
      if (!F.sideHud) sideLabels(backG, F, dpr);
      backG.setTransform(k, 0, 0, k, ox, oy);
      frame(backG, world, H);
      key.back = bk;
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.drawImage(C.back, 0, 0);
    if (F.sideHud) sideLabels(g, F, dpr);
    g.setTransform(k, 0, 0, k, ox, oy);
    g.save();
    roundRect(g, 0, 0, W, H, 6); g.clip();
    background(g, F, world, H, k);
    if (F.shake) F.shake.apply(g, W / 2, H / 2);
    interior(g, F, world, H);
    g.restore();
    if (F.shake) F.shake.apply(g, W / 2, H / 2);
    banner(g, F, H);
    bubble(g, F, H);
    if (F.dim > 0) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = rgba(world.deep, 0.62 * F.dim);
      g.fillRect(0, 0, view.canvas.width, view.canvas.height);
    }
  }

  // beside the field when there's room: on a sideways phone the score and level (the bar's numbers move here), on a
  // wide screen the world's name and number, huge and faint, standing up the sides
  function sideLabels(g, F, dpr) {
    const { fit, world } = F;
    const side = fit.x - 6;
    if (!F.fonts || side < 96) return;
    g.save();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round';
    if (F.sideHud) {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cx = side / 2 + 2, cy = view.h / 2;
      const label = (txt, y, px = 11) => { setFont(g, 900, px); g.fillStyle = rgba('#fffaf0', 0.62); g.fillText(txt, cx, y); };
      const value = (txt, y, px) => {
        setFont(g, 700, px, MONO);
        g.lineWidth = Math.max(3, px * 0.18); g.strokeStyle = INK; g.strokeText(txt, cx, y);
        g.fillStyle = '#fffaf0'; g.fillText(txt, cx, y);
      };
      if (F.sideScore != null) {
        const sc = F.sideScore.toLocaleString('en-US');
        label('SCORE', cy - 46);
        value(sc, cy - 20, Math.min(30, (side - 24) / (sc.length * 0.62)));
        label(F.mode === 'endless' ? 'LAYER' : 'LEVEL', cy + 18);
        value(F.mode === 'endless' ? String(F.layer) : F.tag, cy + 42, 22);
      }
      const rx = view.w - side / 2 - 2;
      setFont(g, 900, Math.min(15, side / 9));
      g.fillStyle = world.accent; g.fillText(`WORLD ${world.n}`, rx, cy - 12);
      setFont(g, 900, Math.min(12, side / 11));
      g.fillStyle = rgba('#fffaf0', 0.7); g.fillText(F.mode === 'endless' ? 'ENDLESS' : world.name, rx, cy + 10);
      g.restore();
      return;
    }
    if (side < 130) { g.restore(); return; }
    // fit each word to the height it has
    const room = view.h - fit.y - 40;
    for (const [txt, x, rot] of [[world.name, side / 2 + 3, -Math.PI / 2], [F.mode === 'endless' ? 'ENDLESS' : `WORLD ${world.n}`, view.w - side / 2 - 3, Math.PI / 2]]) {
      let px = Math.min(110, side * 0.46);
      setFont(g, 900, px);
      const w = g.measureText(txt).width;
      if (w > room) { px *= room / w; setFont(g, 900, px); }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.translate(x, fit.y + 20 + room / 2);
      g.rotate(rot);
      g.strokeStyle = rgba(world.accent, 0.17); g.lineWidth = 2;
      g.strokeText(txt, 0, 0);
    }
    g.restore();
  }

  function frame(g, world, H) {
    const F2 = FRAME * 2;
    g.fillStyle = INK;
    roundRect(g, -FRAME + 5, -FRAME + 6, W + F2, H + F2, 16); g.fill();          // its hard shadow
    roundRect(g, -FRAME, -FRAME, W + F2, H + F2, 16); g.fill();
    g.fillStyle = world.accent;
    roundRect(g, -FRAME + 2.6, -FRAME + 2.6, W + F2 - 5.2, H + F2 - 5.2, 13.5); g.fill();
    g.fillStyle = mix(world.accent, '#ffffff', 0.45);
    roundRect(g, -FRAME + 6, -FRAME + 3.6, W + F2 - 12, 2, 1); g.fill();
    g.fillStyle = INK;
    roundRect(g, -2.4, -2.4, W + 4.8, H + 4.8, 8.5); g.fill();
    // its bolts
    for (const [x, y] of [[-FRAME / 2, -FRAME / 2], [W + FRAME / 2, -FRAME / 2], [-FRAME / 2, H + FRAME / 2], [W + FRAME / 2, H + FRAME / 2]]) {
      g.fillStyle = INK; g.beginPath(); g.arc(x, y, 2.1, 0, TAU); g.fill();
      g.fillStyle = rgba('#ffffff', 0.75); g.beginPath(); g.arc(x - 0.6, y - 0.6, 0.75, 0, TAU); g.fill();
    }
  }

  // AGI-1 behind the glass: dim at first, a little clearer as the bricks fall, all of her once it breaks; the glass and
  // its cracks (they grow as the level goes on). One layer, made again only when the level moves on a step.
  function background(g, F, world, H, k) {
    const prog = F.progress;
    const upTo = Math.round(prog * 40) / 40;
    if (F.clear && F.clear.t >= 0.35) {
      const rev = clamp((F.clear.t - 0.3) / 0.6, 0, 1);
      g.fillStyle = world.deep; g.fillRect(0, 0, W, H);
      g.globalAlpha = (0.2 + 0.28 * prog) * (1 - rev * 0.4);
      if (C.artDim) g.drawImage(C.artDim, 0, 0, W, H);
      g.globalAlpha = ease.outCubic(rev);
      if (C.artFull) g.drawImage(C.artFull, 0, 0, W, H);
      g.globalAlpha = 1;
      return;
    }
    const bk = `${key.art}|${F.levelKey}|${upTo}|${world.n}|${H}`;
    if (key.bg !== bk) {
      C.bg.width = Math.ceil(W * k); C.bg.height = Math.ceil(H * k);
      const b = bgG;
      b.setTransform(C.bg.width / W, 0, 0, C.bg.height / H, 0, 0);
      b.globalAlpha = 1;
      b.fillStyle = world.deep; b.fillRect(0, 0, W, H);
      b.globalAlpha = 0.2 + 0.28 * upTo;
      if (C.artDim) b.drawImage(C.artDim, 0, 0, W, H);
      b.globalAlpha = 1;
      if (C.glass) b.drawImage(C.glass, 0, 0, W, H);
      if (upTo > 0 && C.net) {
        drawCracks(crackG, C.net, upTo, W, H, key.k, C.crack);
        b.globalAlpha = 0.85; b.drawImage(C.crack, 0, 0, W, H); b.globalAlpha = 1;
      }
      key.bg = bk;
    }
    g.drawImage(C.bg, 0, 0, W, H);
  }

  function interior(g, F, world, H) {
    const { s, t } = F;
    // the control deck at the bottom: where balls are lost, and the thumb rests (lives and power-ups shown there)
    const lose = s.paddle.y + s.paddle.h + 40;
    g.fillStyle = rgba(INK, 0.55);
    g.fillRect(0, lose, W, H - lose);
    g.fillStyle = rgba(world.accent, 0.05);
    for (let y = lose + 7; y < H - 3; y += 7) g.fillRect(0, y, W, 1.2);
    g.strokeStyle = rgba(world.accent, 0.35); g.lineWidth = 1.4; g.setLineDash([6, 6]);
    g.lineDashOffset = -t * 12;
    g.beginPath(); g.moveTo(0, lose); g.lineTo(W, lose); g.stroke(); g.setLineDash([]); g.lineDashOffset = 0;
    portals(g, s, t);
    bricks(g, s, t, world);
    if (s.boss) warden(g, s, s.boss, world, t);
    bombs(g, s, t);
    capsules(g, s, t);
    lasers(g, s);
    aimGuide(g, s, t, world);
    paddle(g, s, F, world, t);
    balls(g, s, F, world);
    F.bits.draw(g);
    if (F.floats) F.floats.draw(g);
    if (F.clear) shatter(g, F.clear, t);
    hud(g, F, world, H);
    if (F.flash > 0 && !REDUCED) { g.fillStyle = rgba(F.flashColor || '#ffffff', Math.min(0.5, F.flash * 0.5)); g.fillRect(0, 0, W, H + 2); }
    if (F.hurt > 0) {
      g.fillStyle = rgba('#ff4da6', 0.35 * F.hurt);
      g.fillRect(0, H - 120, W, 122);
    }
  }

  // ---------- bricks ----------
  function bricks(g, s, t, world) {
    const B = C.bricks;
    const intro = s.phase === 'intro' ? s.levelT : 99;
    const few = homing(s) || (s.required > 0 && s.required <= 3 && !s.boss);
    for (const b of s.bricks) {
      if (!b.alive) continue;
      let x = b.x, y = b.y, a = 1;
      if (intro < 2 && b.row >= 0) {
        const d = 0.022 * b.row + 0.014 * Math.abs(b.col - 6);
        const p = clamp((intro - d) / 0.34, 0, 1);
        if (p <= 0) continue;
        y -= (1 - ease.outBack(p)) * 26;
        a = Math.min(1, p * 2.4);
      }
      if (b.hitT < 0.22 && b.kind !== 'steel') x += Math.sin(b.hitT * 70) * 1.5 * (1 - b.hitT / 0.22);
      g.globalAlpha = a;
      if (b.kind === 'shield') {
        g.drawImage(B.shield, x - 2 - PAD, y - 2 - PAD, 34 + PAD * 2, 14 + PAD * 2);
        if (b.flash > 0) { g.globalAlpha = b.flash * 0.8; g.fillStyle = '#fff'; roundRect(g, x, y, b.w, b.h, 3); g.fill(); }
        g.globalAlpha = 1;
        continue;
      }
      const spr = b.kind === 'normal' ? B.normal[b.tone] : b.kind === 'tough' ? B.tough[b.maxHp] || B.tough[2] : B[b.kind] || B.normal[0];
      const dw = CELL_W + PAD * 2, dh = CELL_H + PAD * 2;
      g.drawImage(spr, x - PAD, y - PAD, dw, dh);
      if (b.kind === 'tough' && b.hp < b.maxHp) g.drawImage(B.cracks[Math.min(2, b.maxHp - b.hp)][b.id % 2], x - PAD, y - PAD, dw, dh);
      if (b.kind === 'power') {
        const p = 0.5 + 0.5 * Math.sin(t * 5 + b.id);
        g.globalAlpha = a * (0.25 + 0.35 * p);
        g.fillStyle = world.accent;
        starPath(g, x + CELL_W / 2, y + CELL_H / 2 - 0.8, 9 + p * 2, 3.6); g.fill();
        g.globalAlpha = a;
      }
      if (b.kind === 'bomb') {
        const p = 0.5 + 0.5 * Math.sin(t * 22 + b.id * 3);
        g.fillStyle = p > 0.5 ? '#ffc933' : '#fffaf0';
        g.beginPath(); g.arc(x + CELL_W / 2 + 7.2, y + CELL_H / 2 - 6.2, 1.2 + p * 1.1, 0, TAU); g.fill();
      }
      if (b.kind === 'gate') {
        g.fillStyle = '#ffc933'; roundRect(g, x + CELL_W / 2 - 3.5, y + 5, 7, 6, 1.5); g.fill();
        g.strokeStyle = '#ffc933'; g.lineWidth = 1.2; g.beginPath(); g.arc(x + CELL_W / 2, y + 5.2, 2.2, Math.PI, 0); g.stroke();
      }
      if (b.flash > 0) { g.globalAlpha = a * b.flash * 0.85; g.drawImage(B.white, x - PAD, y - PAD, dw, dh); }
      if (few && b.required) {
        const p = 0.5 + 0.5 * Math.sin(t * 6);
        g.globalAlpha = 0.35 + 0.5 * p;
        g.strokeStyle = world.accent; g.lineWidth = 2;
        roundRect(g, x - 1.5 - p * 2, y - 1.5 - p * 2, CELL_W + 3 + p * 4, CELL_H + 3 + p * 4, 6); g.stroke();
      }
      g.globalAlpha = 1;
    }
  }

  function portals(g, s, t) {
    for (const p of s.portals) {
      const col = p.pair === 0 ? '#3ff0c3' : '#ff4da6';
      g.fillStyle = INK; g.beginPath(); g.arc(p.x, p.y, p.r + 2, 0, TAU); g.fill();
      g.fillStyle = mix(col, INK, 0.75); g.beginPath(); g.arc(p.x, p.y, p.r - 1, 0, TAU); g.fill();
      g.strokeStyle = col; g.lineWidth = 2.4;
      g.setLineDash([5, 3.5]); g.lineDashOffset = -t * (p.end ? -18 : 18);
      g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.stroke();
      g.setLineDash([]);
      for (let i = 0; i < 3; i++) {
        const a = t * (p.end ? -4 : 4) + (i * TAU) / 3;
        g.strokeStyle = rgba(col, 0.75); g.lineWidth = 1.5;
        g.beginPath(); g.arc(p.x, p.y, p.r * 0.55, a, a + 1.3); g.stroke();
      }
      g.fillStyle = '#fff'; g.beginPath(); g.arc(p.x, p.y, 1.6, 0, TAU); g.fill();
    }
  }

  // ---------- THE WARDEN ----------
  function warden(g, s, B, world, t) {
    if (B.dead) return;
    const dying = B.dying > 0 ? 1 - B.dying / 1.6 : 0;
    let x = B.x, y = B.y;
    if (B.dying > 0) { x += Math.sin(t * 90) * 3; y += Math.cos(t * 70) * 2; }
    const sq = B.squash;
    g.save();
    g.translate(x, y);
    g.scale(1 + sq * 0.06, 1 - sq * 0.08);
    if (dying > 0) g.globalAlpha = 1 - dying * 0.6;
    const w = B.w, h = B.h, body = B.angry ? mix(world.tough, '#ff5a5f', 0.35) : world.tough;
    // antenna, out of the top of its cap
    g.strokeStyle = INK; g.lineWidth = 3;
    g.beginPath(); g.moveTo(26, -h / 2 - 10); g.lineTo(34, -h / 2 - 24); g.stroke();
    g.fillStyle = (Math.sin(t * 8) > 0 || B.angry) ? '#ff5a5f' : '#ffc933';
    g.beginPath(); g.arc(35, -h / 2 - 26, 3.6, 0, TAU); g.fill();
    g.strokeStyle = INK; g.lineWidth = 2; g.stroke();
    // ears
    for (const sx of [-1, 1]) {
      g.fillStyle = INK; roundRect(g, sx * (w / 2 + 2) - 7, -12, 14, 24, 5); g.fill();
      g.fillStyle = mix(body, '#ffffff', 0.2); roundRect(g, sx * (w / 2 + 2) - 4.5, -9.5, 9, 19, 3.5); g.fill();
    }
    // body: shadow, outline, fill, its light band
    g.fillStyle = INK; roundRect(g, -w / 2 + 4, -h / 2 + 5, w, h, 17); g.fill();
    roundRect(g, -w / 2, -h / 2, w, h, 17); g.fill();
    g.fillStyle = mix(body, INK, 0.25); roundRect(g, -w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 14); g.fill();
    g.fillStyle = body; roundRect(g, -w / 2 + 3, -h / 2 + 3, w - 6, h - 10, 14); g.fill();
    g.fillStyle = mix(body, '#ffffff', 0.3); roundRect(g, -w / 2 + 10, -h / 2 + 5, w - 20, 6, 3); g.fill();
    // its warden's cap: crown, band, peak, a star badge
    g.fillStyle = INK;
    g.beginPath(); g.moveTo(-38, -h / 2 + 4); g.lineTo(-30, -h / 2 - 20); g.quadraticCurveTo(0, -h / 2 - 28, 30, -h / 2 - 20); g.lineTo(38, -h / 2 + 4); g.closePath(); g.fill();
    g.fillStyle = '#2a1f55';
    g.beginPath(); g.moveTo(-34, -h / 2 + 1); g.lineTo(-27.5, -h / 2 - 17.5); g.quadraticCurveTo(0, -h / 2 - 25, 27.5, -h / 2 - 17.5); g.lineTo(34, -h / 2 + 1); g.closePath(); g.fill();
    g.fillStyle = INK; roundRect(g, -46, -h / 2 - 2, 92, 9, 4.5); g.fill();
    g.fillStyle = '#ffc933';
    starPath(g, 0, -h / 2 - 12, 6.5, 2.8); g.fill();
    g.strokeStyle = INK; g.lineWidth = 1.4; g.stroke();
    // its visor and eye
    g.fillStyle = INK; roundRect(g, -w / 2 + 14, -11, w - 28, 22, 11); g.fill();
    const open = B.eye === 'open', warn = B.eye === 'warn' && Math.sin(t * 30) > 0;
    if (open) { g.drawImage(C.glowEye, -34, -34, 68, 68); }
    g.fillStyle = open ? '#ffc933' : warn ? '#ffe28a' : '#ff4da6';
    const ew = open ? 44 : warn ? 36 : 30, eh = open ? 11 : warn ? 6 : 3.5;
    roundRect(g, -ew / 2, -eh / 2, ew, eh, eh / 2); g.fill();
    if (open) { g.fillStyle = INK; g.beginPath(); g.arc(Math.sin(t * 3) * 10, 0, 3.6, 0, TAU); g.fill(); }
    // angry brows
    if (B.angry) {
      g.strokeStyle = INK; g.lineWidth = 3.4;
      g.beginPath(); g.moveTo(-34, -21); g.lineTo(-12, -14); g.moveTo(34, -21); g.lineTo(12, -14); g.stroke();
    }
    // its grille
    g.fillStyle = INK;
    for (let i = -2; i <= 2; i++) { roundRect(g, i * 9 - 2.5, h / 2 - 14, 5, 6, 2); g.fill(); }
    // its damage
    const dmg = 1 - B.hp / B.maxHp;
    if (dmg > 0.2) {
      g.strokeStyle = rgba(INK, 0.8); g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(-w / 2 + 16, -h / 2 + 8); g.lineTo(-w / 2 + 24, -h / 2 + 16); g.lineTo(-w / 2 + 20, -h / 2 + 22); g.stroke();
      if (dmg > 0.5) { g.beginPath(); g.moveTo(w / 2 - 18, h / 2 - 6); g.lineTo(w / 2 - 26, h / 2 - 15); g.lineTo(w / 2 - 22, h / 2 - 22); g.stroke(); }
      if (dmg > 0.75) { g.beginPath(); g.moveTo(10, -h / 2 + 4); g.lineTo(16, -h / 2 + 12); g.lineTo(24, -h / 2 + 14); g.stroke(); }
    }
    if (B.flash > 0) { g.globalAlpha = B.flash * 0.75; g.fillStyle = '#fff'; roundRect(g, -w / 2, -h / 2, w, h, 17); g.fill(); }
    g.restore();
  }

  function bombs(g, s, t) {
    for (const m of s.bombs) {
      g.fillStyle = INK; g.beginPath(); g.arc(m.x, m.y, BOMB_R, 0, TAU); g.fill();
      g.fillStyle = '#4a3d6e'; g.beginPath(); g.arc(m.x - 2, m.y - 2, BOMB_R * 0.55, 0, TAU); g.fill();
      const on = Math.sin(t * 24 + m.id) > 0;
      g.fillStyle = on ? '#ff5a5f' : '#ffc933';
      g.beginPath(); g.arc(m.x, m.y - BOMB_R - 1.5, 2.4, 0, TAU); g.fill();
      g.strokeStyle = '#ff5a5f'; g.lineWidth = 1.2; g.globalAlpha = 0.5;
      g.beginPath(); g.arc(m.x, m.y, BOMB_R + 3 + (on ? 1.5 : 0), 0, TAU); g.stroke();
      g.globalAlpha = 1;
    }
  }

  function capsules(g, s, t) {
    for (const c of s.capsules) {
      const a = Math.sin(c.t * 7 + c.id) * 0.12;
      g.save(); g.translate(c.x, c.y); g.rotate(a);
      g.drawImage(C.caps[c.type], -CAP_W / 2 - PAD, -CAP_H / 2 - PAD, CAP_W + PAD * 2, CAP_H + PAD * 2 + 2);
      g.restore();
    }
  }

  function lasers(g, s) {
    for (const L of s.lasers) {
      g.fillStyle = '#ff4da6'; roundRect(g, L.x - 2.2, L.y - 14, 4.4, 15, 2.2); g.fill();
      g.fillStyle = '#fffaf0'; roundRect(g, L.x - 0.9, L.y - 12, 1.8, 10, 0.9); g.fill();
    }
  }

  // the way a ball on the paddle will go (dots, bouncing off the walls)
  function aimGuide(g, s, t, world) {
    const b = s.balls.find((q) => q.stuck);
    if (!b || s.phase === 'intro' || s.phase === 'clear') return;
    const v = launchVelocity(b.off, 1);
    let x = b.x, y = b.y, vx = v.vx, vy = v.vy;
    const step = 9, n = 22, shift = (t * 30) % step;
    for (let i = 0; i < n; i++) {
      const d = i === 0 ? 10 + shift : step;
      x += vx * d; y += vy * d;
      if (x < b.r) { x = 2 * b.r - x; vx = -vx; }
      if (x > W - b.r) { x = 2 * (W - b.r) - x; vx = -vx; }
      g.globalAlpha = (1 - i / n) * 0.85;
      g.fillStyle = world.accent;
      g.beginPath(); g.arc(x, y, 1.9, 0, TAU); g.fill();
    }
    g.globalAlpha = 1;
  }

  // ---------- the paddle: a lavender hover-board on two thrusters ----------
  function paddle(g, s, F, world, t) {
    const P = s.paddle;
    if (F.clear && F.clear.t > 0.9) return;
    const x = P.px != null ? P.px + (P.x - P.px) * F.alpha : P.x;
    const w = P.w, h = P.h, y = P.y;
    const stun = P.stun > 0;
    const sq = P.squash;
    const tilt = clamp((P.vx || 0) * 0.00006, -0.08, 0.08) + (stun ? Math.sin(t * 60) * 0.04 : 0);
    g.save();
    g.translate(x, y + h);
    g.rotate(tilt);
    g.scale(1 + sq * 0.08, 1 - sq * 0.26);
    g.translate(-x, -(y + h));
    // thrusters
    for (const sx of [-1, 1]) {
      const tx = x + sx * w * 0.3, ty = y + h + 1;
      const fl = stun ? 0.3 : 0.85 + 0.15 * Math.sin(t * 47 + sx * 2) + Math.min(0.35, Math.abs(P.vx || 0) / 2600);
      g.drawImage(C.glowThr, tx - 15 * fl, ty - 8 * fl, 30 * fl, 30 * fl);
      g.fillStyle = mix(world.accent, '#ffffff', 0.35);
      g.beginPath(); g.moveTo(tx - 3.4, ty + 2); g.lineTo(tx + 3.4, ty + 2); g.lineTo(tx, ty + 5 + 7 * fl); g.closePath(); g.fill();
      g.fillStyle = INK; roundRect(g, tx - 5.5, y + h - 3, 11, 6.5, 2.5); g.fill();
    }
    // the board
    g.fillStyle = INK; roundRect(g, x - w / 2, y, w, h + 2.4, (h + 2.4) / 2); g.fill();
    g.fillStyle = stun ? '#6d6688' : '#7b55ec'; roundRect(g, x - w / 2 + 2.2, y + 2.2, w - 4.4, h - 2, (h - 2) / 2); g.fill();
    g.fillStyle = stun ? '#a8a2bb' : '#cdb8ff'; roundRect(g, x - w / 2 + 2.2, y + 2.2, w - 4.4, h - 5.6, (h - 5.6) / 2); g.fill();
    g.fillStyle = stun ? '#d6d2e0' : '#ece4ff'; roundRect(g, x - w / 2 + 6, y + 3.3, w - 12, 2.6, 1.3); g.fill();
    const core = F.s.fx.fire > 0 ? '#ff8a3d' : world.accent;
    g.fillStyle = mix(core, '#ffffff', P.flash * 0.7);
    roundRect(g, x - 9, y + 6.4, 18, 3.6, 1.8); g.fill();
    g.fillStyle = INK; g.beginPath(); g.arc(x - w / 2 + 7, y + h / 2 + 0.5, 1.3, 0, TAU); g.arc(x + w / 2 - 7, y + h / 2 + 0.5, 1.3, 0, TAU); g.fill();
    // what it's carrying
    if (s.fx.laser > 0) {
      for (const sx of [-1, 1]) {
        const cx = x + sx * (w / 2 - 9);
        g.fillStyle = INK; roundRect(g, cx - 4, y - 7, 8, 9, 2); g.fill();
        g.fillStyle = '#ff4da6'; roundRect(g, cx - 2.4, y - 5.6, 4.8, 6, 1.4); g.fill();
      }
    }
    if (s.fx.sticky > 0) {
      g.fillStyle = '#2fd27a';
      roundRect(g, x - w / 2 + 6, y - 1.6, w - 12, 3.4, 1.7); g.fill();
      for (let i = 0; i < 3; i++) {
        const dx = x - w / 2 + 12 + i * ((w - 24) / 2), drip = 2 + Math.sin(t * 3 + i * 2) * 1.2;
        g.beginPath(); g.arc(dx, y + 1.4 + drip * 0.4, 1.8, 0, TAU); g.fill();
      }
    }
    if (stun) {
      g.strokeStyle = '#ffc933'; g.lineWidth = 1.6;
      for (let i = 0; i < 3; i++) {
        const sx = x - w / 2 + ((t * 120 + i * 37) % w);
        g.beginPath(); g.moveTo(sx, y - 4); g.lineTo(sx + 4, y + 2); g.lineTo(sx - 1, y + 4); g.lineTo(sx + 3, y + 10); g.stroke();
      }
    }
    g.restore();
  }

  function balls(g, s, F, world) {
    const fire = s.fx.fire > 0;
    const vis = !F.clear || F.clear.t < 0.15;
    if (!vis) return;
    for (const b of s.balls) {
      const bx = b.stuck ? b.x : b.px + (b.x - b.px) * F.alpha, by = b.stuck ? b.y : b.py + (b.y - b.py) * F.alpha;
      const tr = b.trail, n = tr.length >> 1;
      g.fillStyle = fire ? '#ff8a3d' : world.accent;
      for (let i = n - 1; i >= 1; i--) {
        const f = 1 - i / n;
        g.globalAlpha = f * (fire ? 0.6 : 0.42);
        g.beginPath(); g.arc(tr[i * 2], tr[i * 2 + 1], b.r * (0.3 + 0.62 * f), 0, TAU); g.fill();
      }
      g.globalAlpha = 1;
      const glow = fire ? C.glowFire : C.glowBall, gr = fire ? 22 : 18;
      g.drawImage(glow, bx - gr, by - gr, gr * 2, gr * 2);
      g.fillStyle = INK; g.beginPath(); g.arc(bx, by, b.r + 1.6, 0, TAU); g.fill();
      g.fillStyle = fire ? '#ffc933' : '#ffffff'; g.beginPath(); g.arc(bx, by, b.r, 0, TAU); g.fill();
      if (fire) { g.fillStyle = '#ff8a3d'; g.beginPath(); g.arc(bx + 1.2, by + 1.4, b.r * 0.55, 0, TAU); g.fill(); }
      g.fillStyle = rgba(world.accent, fire ? 0 : 0.35); g.beginPath(); g.arc(bx + 1.6, by + 1.8, b.r * 0.55, 0, TAU); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(bx - 2.2, by - 2.4, 1.8, 0, TAU); g.fill();
    }
  }

  // ---------- the glass breaking (a level clear) ----------
  function shatter(g, c) {
    const alpha = clamp(1 - (c.t - 0.15) / 1.3, 0, 1);
    if (alpha <= 0) return;
    g.beginPath();
    for (const p of c.shards) {
      if (c.t < p.d) continue;
      const tt = c.t - p.d;
      const x = p.cx + p.vx * tt, y = p.cy + p.vy * tt + 380 * tt * tt, a = p.spin * tt, cs = Math.cos(a), sn = Math.sin(a);
      const q = p.pts;
      g.moveTo(x + q[0] * cs - q[1] * sn, y + q[0] * sn + q[1] * cs);
      g.lineTo(x + q[2] * cs - q[3] * sn, y + q[2] * sn + q[3] * cs);
      g.lineTo(x + q[4] * cs - q[5] * sn, y + q[4] * sn + q[5] * cs);
      g.closePath();
    }
    g.globalAlpha = alpha;
    g.fillStyle = 'rgba(220,238,255,0.16)'; g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 1.1; g.stroke();
    g.globalAlpha = 1;
  }

  // ---------- the field's own numbers ----------
  function hud(g, F, world, H) {
    if (!F.fonts) return;
    const { s, t } = F;
    g.textBaseline = 'middle';
    // the level's tag (top left)
    if (F.tag) {
      setFont(g, 900, 10.5);
      g.textAlign = 'left';
      const label = F.tag, tw = g.measureText(label).width + 14;
      g.fillStyle = INK; roundRect(g, 7, 7, tw + 1, 17, 8.5); g.fill();
      g.fillStyle = world.accent; roundRect(g, 7, 6, tw, 16, 8); g.fill();
      g.fillStyle = INK; g.fillText(label, 14, 14.4);
      if (F.tagName && !s.boss) {
        setFont(g, 800, 9.5);
        g.fillStyle = rgba('#fffaf0', 0.72);
        g.fillText(F.tagName, tw + 14, 14.4);
      }
    }
    // the score, in a demo (the arcade's bar is hidden there)
    if (F.score != null) {
      setFont(g, 700, 15, MONO);
      g.textAlign = 'right';
      g.lineJoin = 'round'; g.lineWidth = 4; g.strokeStyle = INK;
      const txt = F.score.toLocaleString('en-US');
      g.strokeText(txt, W - 10, 15); g.fillStyle = '#fffaf0'; g.fillText(txt, W - 10, 15);
    }
    // THE WARDEN's health
    if (s.boss && !s.boss.dead) {
      const B = s.boss, bw = 176, bx = W / 2 - bw / 2, by = 30;
      g.fillStyle = INK; roundRect(g, bx - 2, by - 2, bw + 4, 12, 6); g.fill();
      g.fillStyle = mix(world.deep, '#ffffff', 0.08); roundRect(g, bx, by, bw, 8, 4); g.fill();
      const f = B.hp / B.maxHp;
      g.fillStyle = B.angry ? '#ff5a5f' : '#ff4da6'; roundRect(g, bx, by, Math.max(0, bw * f), 8, 4); g.fill();
      g.fillStyle = rgba('#ffffff', 0.45); roundRect(g, bx + 2, by + 1.3, Math.max(0, bw * f - 4), 2, 1); g.fill();
      setFont(g, 900, 8.5);
      g.textAlign = 'center';
      g.fillStyle = '#fffaf0';
      g.fillText(F.bossName || 'THE WARDEN', W / 2, by - 8);
    }
    // the combo (top right, under the score in a demo)
    const cv = F.combo;
    if (cv && cv.show > 0.01 && cv.n >= 2) {
      const pop = 1 + cv.pop * 0.45;
      const size = Math.min(30, 15 + cv.n * 0.8) * pop;
      g.save();
      g.globalAlpha = cv.show;
      g.translate(W - 12, F.score != null ? 30 + size * 0.75 : 18);
      setFont(g, 900, size);
      g.textAlign = 'right';
      g.lineJoin = 'round'; g.lineWidth = Math.max(3, size * 0.2); g.strokeStyle = INK;
      const txt = `×${Math.min(20, cv.n)}`;
      g.strokeText(txt, 0, 4); g.fillStyle = cv.n >= 10 ? '#ffc933' : world.accent; g.fillText(txt, 0, 4);
      setFont(g, 900, 7.5);
      g.fillStyle = rgba('#fffaf0', 0.8);
      g.fillText(cv.n > 20 ? 'MAX COMBO' : 'COMBO', 0, -size * 0.5 - 3);
      g.restore();
    }
    // lives (bottom left) and the power-ups running (bottom right), on the deck
    const lose = s.paddle.y + s.paddle.h + 40;
    const by = clamp((lose + H) / 2, lose + 13, H - 13);
    if (F.deckHint && H - lose > 60) {
      setFont(g, 900, 9.5);
      g.textAlign = 'center';
      g.fillStyle = rgba('#fffaf0', 0.5);
      g.fillText(F.deckHint, W / 2, by);
    }
    for (let i = 0; i < s.lives; i++) {
      heartPath(g, 16 + i * 17, by, 6.2);
      g.fillStyle = '#ff4da6'; g.fill();
      g.strokeStyle = INK; g.lineWidth = 1.8; g.stroke();
    }
    if (F.lostHeart) {
      const p = F.lostHeart;
      g.globalAlpha = p;
      heartPath(g, 16 + s.lives * 17, by - (1 - p) * 18, 6.2 * (1 + (1 - p) * 0.6));
      g.strokeStyle = '#ff4da6'; g.lineWidth = 1.8; g.stroke();
      g.globalAlpha = 1;
    }
    let px = W - 8;
    for (const [kind, left] of Object.entries(s.fx)) {
      if (left <= 0) continue;
      const total = { wide: 15, shrink: 10, laser: 8, sticky: 12, slow: 10, fire: 6, fast: 8 }[kind] || 10;
      const pw = 38;
      px -= pw;
      const look = POWER_LOOK[kind];
      const blink = left < 2 && Math.sin(t * 20) > 0;
      g.fillStyle = INK; roundRect(g, px, by - 8, pw, 16, 8); g.fill();
      g.fillStyle = blink ? mix(look.body, '#ffffff', 0.5) : look.body; roundRect(g, px + 1.6, by - 6.4, (pw - 3.2) * clamp(left / total, 0.08, 1), 12.8, 6.4); g.fill();
      icon(g, kind, px + 12, by, 0.85);
      px -= 5;
    }
  }

  // ---------- a level's first screen, and world banners ----------
  function banner(g, F, H) {
    const b = F.banner;
    if (!b || !F.fonts) return;
    const { t, dur } = b;
    const inn = clamp(t / 0.32, 0, 1), out = clamp((dur - t) / 0.3, 0, 1);
    const a = Math.min(inn, out);
    if (a <= 0) return;
    const lose = F.s.paddle.y + F.s.paddle.h + 40;
    const y = (b.low ? lose - 175 : H * 0.56) + (1 - ease.outBack(inn)) * 30;
    g.save();
    g.globalAlpha = a;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round';
    if (b.kicker) {
      setFont(g, 900, 11);
      const kw = g.measureText(b.kicker).width + 22;
      g.fillStyle = INK; roundRect(g, W / 2 - kw / 2 + 2, y - 52, kw, 21, 10.5); g.fill();
      g.fillStyle = F.world.accent; roundRect(g, W / 2 - kw / 2, y - 54, kw, 20, 10); g.fill();
      g.fillStyle = INK; g.fillText(b.kicker, W / 2, y - 43.5);
    }
    let size = 38;
    setFont(g, 900, size);
    while (g.measureText(b.title).width > W - 40 && size > 18) { size -= 2; setFont(g, 900, size); }
    g.lineWidth = size * 0.2; g.strokeStyle = INK;
    g.strokeText(b.title, W / 2, y + 3);
    g.strokeText(b.title, W / 2, y);
    g.fillStyle = '#fffaf0'; g.fillText(b.title, W / 2, y);
    if (b.hint) {
      setFont(g, 600, 13, SANS);
      const hw = g.measureText(b.hint).width + 24;
      g.fillStyle = rgba(INK, 0.86); roundRect(g, W / 2 - hw / 2, y + 26, hw, 26, 13); g.fill();
      g.fillStyle = '#fffaf0'; g.fillText(b.hint, W / 2, y + 39.5);
    }
    g.restore();
  }

  // ---------- AGI-1 says something ----------
  function bubble(g, F, H) {
    const b = F.bubble;
    if (!b || !F.fonts) return;
    const inn = clamp(b.t / 0.25, 0, 1), out = clamp((b.dur - b.t) / 0.3, 0, 1);
    const a = Math.min(inn, out);
    if (a <= 0) return;
    setFont(g, 400, 16, SERIF);
    if ('fontStyle' in g) g.fontStyle = 'italic';
    g.font = `italic 400 16px ${SERIF}`;
    const maxW = W - 120;
    const words = b.text.split(' '), lines = [''];
    for (const wd of words) {
      const test = lines[lines.length - 1] ? `${lines[lines.length - 1]} ${wd}` : wd;
      if (g.measureText(test).width > maxW && lines[lines.length - 1]) lines.push(wd); else lines[lines.length - 1] = test;
    }
    const lw = Math.max(...lines.map((l) => g.measureText(l).width));
    const bw = lw + 24, bh = lines.length * 19 + 14;
    const y = (b.y ?? F.s.paddle.y - 92) + (1 - ease.outBack(inn)) * 16;
    const x = W / 2 - (bw + 46) / 2 + 46;
    g.save();
    g.globalAlpha = a;
    // her face
    const fx = x - 26, fy = y + bh / 2;
    g.fillStyle = INK; g.beginPath(); g.arc(fx, fy, 21.5, 0, TAU); g.fill();
    g.save(); g.beginPath(); g.arc(fx, fy, 19.5, 0, TAU); g.clip();
    g.fillStyle = '#e4d9ff'; g.fillRect(fx - 20, fy - 20, 40, 40);
    if (face.complete && face.naturalWidth) g.drawImage(face, fx - 20, fy - 20, 40, 40);
    g.restore();
    // the bubble
    g.fillStyle = INK; roundRect(g, x + 3, y + 3, bw, bh, 14); g.fill();
    g.fillStyle = '#fffaf0'; roundRect(g, x, y, bw, bh, 14); g.fill();
    g.strokeStyle = INK; g.lineWidth = 2; g.stroke();
    g.fillStyle = INK;
    g.textAlign = 'left'; g.textBaseline = 'middle';
    lines.forEach((l, i) => g.fillText(l, x + 12, y + 16 + i * 19));
    g.restore();
  }

  // fonts arrived (or the page came back): everything drawn with words is made again
  function refresh() { key.k = 0; key.world = 0; key.art = ''; key.crack = ''; key.back = ''; key.bg = ''; C.pattern = null; }
  return { draw, refresh, faceImg: face };
}

export function hashOf(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// the glass's shards for a clear: a jittered grid of triangles over the field, each flying out from where it broke
export function makeShards(r, H, from) {
  const cols = 7, rows = 9, cw = W / cols, ch = (H * 0.8) / rows;
  const pts = [];
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
    const edge = i === 0 || j === 0 || i === cols || j === rows;
    pts.push([i * cw + (edge ? 0 : (r.next() - 0.5) * cw * 0.7), j * ch + (edge ? 0 : (r.next() - 0.5) * ch * 0.7)]);
  }
  const at = (i, j) => pts[j * (cols + 1) + i];
  const out = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const tri = r.next() < 0.5
      ? [[at(i, j), at(i + 1, j), at(i + 1, j + 1)], [at(i, j), at(i + 1, j + 1), at(i, j + 1)]]
      : [[at(i, j), at(i + 1, j), at(i, j + 1)], [at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)]];
    for (const t of tri) {
      const cx = (t[0][0] + t[1][0] + t[2][0]) / 3, cy = (t[0][1] + t[1][1] + t[2][1]) / 3;
      const dx = cx - from.x, dy = cy - from.y, d = Math.hypot(dx, dy) || 1;
      const sp = 120 + r.next() * 260;
      out.push({
        cx, cy, pts: t.flatMap(([x, y]) => [x - cx, y - cy]),
        vx: (dx / d) * sp + (r.next() - 0.5) * 60, vy: (dy / d) * sp - 120 - r.next() * 120,
        spin: (r.next() - 0.5) * 6, d: Math.min(0.3, d / 1400),
      });
    }
  }
  return out;
}
