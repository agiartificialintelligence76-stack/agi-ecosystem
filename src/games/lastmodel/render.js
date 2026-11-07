// LAST MODEL STANDING: everything on the canvas. The world is pixel art drawn at a whole number of screen pixels per art
// pixel (S, chosen so a phone shows about 380 art pixels across its short side), never smoothed, with a camera that
// follows AGI-1 smoothly and leans a little the way she's going. Back to front: the server-room floor, chips and
// pickups, shadows, her field, the bots (lower ones in front), damage numbers, AGI-1, shots and bullets, particles; then
// the HUD in screen pixels (the XP bar, a boss's bar, her loadout, arrows to things off the screen, banners, her
// bubble, the joystick). Reads the sim and the effects; changes nothing in them.
import { discSprite, CHUNK } from './art.js';
import { SHOT, BULLET, CRATE } from './sim.js';
import { KINDS, WEAPONS, PASSIVES, ENEMIES, MAX_LEVEL } from './rules.js';
import { REDUCED } from '../kit/env.js';
import { NUM_LIFE } from './effects.js';

const TAU = Math.PI * 2;
const INK = '#170a36';
const KIND_NAMES = [...KINDS, 'crate'];
const SHADOW_OF = (r) => (r <= 4 ? 0 : r <= 7 ? 1 : r <= 12 ? 2 : 3);
const FONT = (w, px, stretch = 'expanded') => `${w} ${stretch} ${px}px 'AK Display', 'Arial Black', sans-serif`;
const SERIF = (px) => `italic ${px}px 'AK Serif', Georgia, serif`;
const MONO = (px) => `700 ${px}px 'AK Mono', ui-monospace, monospace`;
const BEAM_DIGITS = '0110100111010010';

export function createRenderer({ view, art, demo: isDemo = false }) {
  const ctx = view.ctx;
  const F = art.frames;
  let S = 2, W = 1, H = 1, dpr = 1, ui = 1, numF = 2, camX = 0, camY = 0, leadX = 0, leadY = 0, ox = 0, oy = 0;
  let order = new Int32Array(512);

  // frame tables: [kind][walk][mirror][flash][elite] → a frame (no strings made while drawing)
  const FR = KIND_NAMES.map((k) => {
    const t = [];
    for (let w = 0; w < 2; w++) {
      t[w] = [];
      for (let m = 0; m < 2; m++) {
        t[w][m] = [];
        for (let f = 0; f < 2; f++) {
          t[w][m][f] = [];
          for (let e = 0; e < 2; e++) {
            const base = w && F[`${k}B`] ? `${k}B` : k;
            const key = `${base}${e ? `~e${m ? 'm' : ''}${f ? 'f' : ''}` : `${m && F[`${base}~m`] ? '~m' : ''}${f ? (m && F[`${base}~mf`] ? 'f' : '~f') : ''}`}`;
            t[w][m][f][e] = F[key] || F[base];
          }
        }
      }
    }
    return t;
  });
  // AGI-1: [back][step: idle, A, B][mirror][flash]
  const HER = [0, 1].map((back) => ['', 'A', 'B'].map((step) => [0, 1].map((m) => [0, 1].map((f) => {
    const base = `agi${back ? 'B' : 'F'}${step}`;
    return F[`${base}${m ? '~m' : ''}${f ? (m ? 'f' : '~f') : ''}`] || F[base];
  }))));

  // ---------- helpers ----------
  const sx = (wx) => wx * S + ox, sy = (wy) => wy * S + oy;
  const onScreen = (wx, wy, m) => { const x = sx(wx), y = sy(wy), mm = m * S; return x > -mm && x < W + mm && y > -mm && y < H + mm; };
  function spr(f, wx, wy) {
    if (!f) return;
    ctx.drawImage(f.img, f.x, f.y, f.w, f.h, Math.round(wx * S + ox - f.ax * S), Math.round(wy * S + oy - f.ay * S), f.w * S, f.h * S);
  }
  // a sprite turned by `ang` (spinning things)
  function sprRot(f, wx, wy, ang) {
    ctx.save();
    ctx.translate(Math.round(wx * S + ox), Math.round(wy * S + oy));
    ctx.rotate(ang);
    ctx.drawImage(f.img, f.x, f.y, f.w, f.h, -f.ax * S, -f.ay * S, f.w * S, f.h * S);
    ctx.restore();
  }
  function glow(g, wx, wy) {
    ctx.drawImage(g.img, 0, 0, g.w, g.h, Math.round(wx * S + ox - g.ax * S), Math.round(wy * S + oy - g.ay * S), g.w * S, g.h * S);
  }
  // one art pixel (or a block of them)
  const px = (wx, wy, w = 1, h = 1) => ctx.fillRect(Math.round(wx * S + ox), Math.round(wy * S + oy), w * S, h * S);
  // a ring of radius r, w art pixels thick, drawn row by row (two spans a row): crisp at any size, nothing cached
  function ring(wx, wy, r, w, color) {
    if (r < 1) return;
    const ro = r + w / 2, ri = Math.max(0, r - w / 2);
    const cx = Math.round(wx * S + ox), cy = Math.round(wy * S + oy);
    const n = Math.ceil(ro);
    ctx.fillStyle = color;
    for (let y = -n; y < n; y++) {
      const yy = y + 0.5;
      if (Math.abs(yy) > ro) continue;
      const xo = Math.round(Math.sqrt(ro * ro - yy * yy));
      const xi = Math.abs(yy) < ri ? Math.round(Math.sqrt(ri * ri - yy * yy)) : 0;
      const top = cy + y * S;
      if (xi <= 0) ctx.fillRect(cx - xo * S, top, xo * 2 * S, S);
      else {
        ctx.fillRect(cx - xo * S, top, (xo - xi) * S, S);
        ctx.fillRect(cx + xi * S, top, (xo - xi) * S, S);
      }
    }
  }

  // ---------- the size of things ----------
  // phones (a short side under 520 CSS px): an art pixel about 1.45 CSS px (she's ~38 px tall, the view ~260 × 560);
  // tablets and computers: about 340 art pixels across the short side; the demo's 480 × 480: about 420
  function layout() {
    dpr = view.dpr; W = view.canvas.width; H = view.canvas.height;
    const short = Math.min(W, H), cssShort = short / dpr;
    if (isDemo) S = Math.max(1, Math.round(short / 420));
    else if (cssShort < 520) S = Math.max(1, Math.round(1.45 * dpr));
    else S = Math.max(1, Math.round(short / 340));
    // the HUD a little bigger on big screens
    ui = Math.max(1, Math.min(1.4, cssShort / 760));
    // damage numbers: about 12 CSS px tall wherever they're read (never as big as a bot)
    numF = isDemo ? Math.max(1, S) : Math.max(2, Math.round(1.8 * dpr * ui));
  }

  // ---------- the world ----------
  function drawFloor() {
    const x0 = (-ox) / S, y0 = (-oy) / S, x1 = x0 + W / S, y1 = y0 + H / S;
    const c0 = Math.floor(x0 / CHUNK), c1 = Math.floor(x1 / CHUNK), r0 = Math.floor(y0 / CHUNK), r1 = Math.floor(y1 / CHUNK);
    for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) {
      ctx.drawImage(art.floor.chunk(cx, cy), Math.round(cx * CHUNK * S + ox), Math.round(cy * CHUNK * S + oy), CHUNK * S, CHUNK * S);
    }
  }

  function drawFloorItems(sim, t) {
    const G = sim.G, chips = [F.chip0, F.chip1, F.chip2];
    for (let i = 0; i < sim.gn; i++) {
      const g = G[i];
      if (!onScreen(g.x, g.y, 8)) continue;
      const bob = g.pulled ? 0 : Math.round(Math.sin(t * 4 + i * 1.7) * 0.9);
      spr(chips[g.tier], g.x, g.y + bob);
    }
    for (const k of sim.K) {
      const bob = Math.round(Math.sin(t * 3 + k.x) * 1.5) - 2;
      const f = k.kind === 'heart' ? F.heart : k.kind === 'magnet' ? F.magnet : k.kind === 'purge' ? F.purge : F.cache;
      spr(art.shadows[k.kind === 'cache' ? 2 : 1], k.x, k.y + (k.kind === 'cache' ? 7 : 5));
      if (k.kind === 'cache') {
        // a beacon: light rays turning behind it
        ctx.globalCompositeOperation = 'lighter';
        glow(art.glow.honey[3 + (Math.sin(t * 5) > 0 ? 1 : 0)], k.x, k.y - 2);
        ctx.globalCompositeOperation = 'source-over';
      }
      spr(f, k.x, k.y + bob);
    }
  }

  function drawField(sim, t) {
    const r = sim.field.r;
    if (!r) return;
    const P = sim.player;
    const cx = P.x, cy = P.y - 4;
    spr(discSprite(r, '#ff4da6', 0.07), cx, cy);
    // shimmering motes going round
    const n = Math.max(12, Math.round(r * 0.55));
    const cols = ['#ff4da6', '#3ff0c3', '#c9b6ff'];
    for (let k = 0; k < n; k++) {
      const a = t * (k % 2 ? 0.9 : -0.6) + (k / n) * TAU;
      const rr = r - 1 - (k % 3) * 2 + Math.sin(t * 3 + k) * 1.2;
      ctx.fillStyle = cols[k % 3];
      ctx.globalAlpha = 0.5 + 0.4 * Math.sin(t * 6 + k * 2.1);
      px(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.92);
    }
    ctx.globalAlpha = 1;
  }

  function drawBots(sim, t) {
    const E = sim.E, n = sim.en;
    if (order.length < n) order = new Int32Array(n * 2);
    let m = 0;
    for (let i = 0; i < n; i++) if (onScreen(E[i].x, E[i].y, 30)) order[m++] = i;
    // lower on the screen, in front (insertion sort: nearly sorted from frame to frame)
    for (let i = 1; i < m; i++) {
      const v = order[i], y = E[v].y;
      let j = i - 1;
      while (j >= 0 && E[order[j]].y > y) { order[j + 1] = order[j]; j--; }
      order[j + 1] = v;
    }
    // shadows first
    for (let k = 0; k < m; k++) {
      const e = E[order[k]];
      if (e.hidden) continue;
      const def = KIND_NAMES[e.kind];
      const f = FR[e.kind][0][0][0][0];
      const h = (f ? f.h : 12) * e.scale;
      spr(art.shadows[e.boss ? 3 : SHADOW_OF(e.r)], e.x, e.y + h / 2 - 1.5 * e.scale);
      void def;
    }
    for (let k = 0; k < m; k++) {
      const e = E[order[k]];
      const walk = e.moving ? ((e.t * (e.k === 'swarm' ? 14 : e.k === 'crawler' ? 12 : 6) + e.wob) | 0) & 1 : 0;
      const flash = e.flash > 0.04 ? 1 : 0;
      const mirror = e.face < 0 ? 1 : 0;
      const f = FR[e.kind][walk][mirror][flash][e.elite ? 1 : 0];
      let bob = 0;
      if (e.boss) bob = Math.round(Math.sin(e.t * 2.4) * 1.5);
      else if (e.k === 'ghost') bob = Math.round(Math.sin(e.t * 3 + e.wob) * 1.5);
      if (e.alpha < 1) ctx.globalAlpha = e.alpha;
      if (e.elite) {
        ctx.globalCompositeOperation = 'lighter';
        glow(art.glow.honey[2 + ((Math.sin(t * 8 + e.wob) > 0) ? 1 : 0)], e.x, e.y);
        ctx.globalCompositeOperation = 'source-over';
      }
      if (e.boss && e.state === 1 && e.k !== 'broker') {
        // a boss gathering itself before a burst
        ctx.globalCompositeOperation = 'lighter';
        glow(art.glow.red[4], e.x, e.y - 10);
        ctx.globalCompositeOperation = 'source-over';
      }
      spr(f, e.x, e.y + bob);
      if (e.alpha < 1) ctx.globalAlpha = 1;
      if (e.stun > 0 && !REDUCED) {
        // little stars going round its head
        ctx.fillStyle = '#ffc933';
        const a = t * 9, hy = e.y - (f ? f.ay : 6) - 2;
        px(e.x + Math.cos(a) * 5, hy + Math.sin(a) * 1.5);
        px(e.x + Math.cos(a + Math.PI) * 5, hy + Math.sin(a + Math.PI) * 1.5);
      }
      if (e.elite && e.hp < e.maxHp) {
        // an elite's own small bar
        const w = 18, y = e.y - (f ? f.ay : 10) - 4;
        ctx.fillStyle = INK; px(e.x - w / 2 - 1, y - 1, w + 2, 3);
        ctx.fillStyle = '#ffc933'; px(e.x - w / 2, y, Math.max(1, Math.round((w * e.hp) / e.maxHp)), 1);
      }
    }
  }

  function drawHer(sim, t, demoDead) {
    const P = sim.player;
    spr(art.shadows[1], P.x, P.y - 1);
    const back = P.moving && P.fy < -0.55 ? 1 : 0;
    const step = P.moving ? [1, 0, 2, 0][Math.floor(P.walk) & 3] : 0;
    const mirror = P.face < 0 ? 1 : 0;
    const flash = P.hurtT > 0.15 ? 1 : 0;
    if (P.dead) {
      // she spins down and lies there
      const k = Math.min(1, P.deadT / 0.45);
      const f = HER[0][0][mirror][P.deadT < 0.15 ? 1 : 0];
      ctx.save();
      ctx.globalAlpha = demoDead ? 1 : Math.max(0.35, 1 - Math.max(0, P.deadT - 1) * 0.6);
      ctx.translate(Math.round(P.x * S + ox), Math.round((P.y - Math.sin(k * Math.PI) * 10) * S + oy));
      ctx.rotate((mirror ? -1 : 1) * k * Math.PI * 0.5);
      ctx.drawImage(f.img, f.x, f.y, f.w, f.h, -f.ax * S, -f.ay * S, f.w * S, f.h * S);
      ctx.restore();
      return;
    }
    // blinking while she can't be hurt
    if (P.iframes > 0 && !flash && ((t * 18) | 0) % 2 === 0) ctx.globalAlpha = 0.35;
    const breathe = !P.moving && ((t * 1.6) | 0) % 2 === 0 ? 1 : 0;
    const lift = step ? 1 : 0;
    spr(HER[back][step][mirror][flash], P.x, P.y - lift + breathe * 0);
    ctx.globalAlpha = 1;
    // her HP, small, under her
    const w = 16, y = P.y + 3;
    const k = Math.max(0, P.hp / P.maxHp);
    ctx.fillStyle = INK; px(P.x - w / 2 - 1, y, w + 2, 3);
    ctx.fillStyle = '#3a2a66'; px(P.x - w / 2, y + 1, w, 1);
    ctx.fillStyle = k > 0.5 ? '#3ff0c3' : k > 0.25 ? '#ffc933' : '#ff5a5f';
    if (k > 0) px(P.x - w / 2, y + 1, Math.max(1, Math.round(w * k)), 1);
  }

  function drawFirewall(sim, t, front) {
    const fw = sim.fw;
    if (!fw.on) return;
    const P = sim.player;
    for (let b = 0; b < fw.n; b++) {
      const bl = fw.blocks[b];
      if (!bl || (bl.y > P.y - 6) !== front) continue;
      spr(art.shadows[0], bl.x, bl.y + 9);
      spr(((t * 10 + b) | 0) % 2 ? F.fire : F.fireB, bl.x, bl.y);
    }
  }

  function drawShots(sim, t) {
    const S_ = sim.S;
    for (let i = 0; i < sim.sn; i++) {
      const s = S_[i];
      if (s.dead || !onScreen(s.x, s.y, 20)) continue;
      if (s.kind === SHOT.BOLT) {
        // a streak: white head, mint tail
        const d = Math.hypot(s.vx, s.vy) || 1, ux = s.vx / d, uy = s.vy / d;
        for (let k = 0; k < 6; k++) {
          ctx.fillStyle = k < 2 ? '#ffffff' : k < 4 ? '#3ff0c3' : '#1fa888';
          const sz = k < 2 ? 2 : 1;
          px(s.x - ux * k * 1.6 - (sz - 1) / 2, s.y - uy * k * 1.6 - (sz - 1) / 2, sz, sz);
        }
      } else if (s.kind === SHOT.HEAD) {
        spr(F.eye, s.x, s.y);
      } else if (s.kind === SHOT.BACK) {
        sprRot(F.boomer, s.x, s.y, Math.round(s.ang / (Math.PI / 2)) * (Math.PI / 2));
      }
    }
  }

  function drawBeams(sim, t) {
    const P = sim.player;
    for (const bm of sim.beams) {
      const k = bm.t / bm.life;
      const len = bm.len * Math.min(1, bm.t / 0.06);
      const fade = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      const x0 = P.x, y0 = P.y - 8;
      const ang = Math.atan2(bm.dy, bm.dx);
      ctx.save();
      ctx.translate(Math.round(x0 * S + ox), Math.round(y0 * S + oy));
      ctx.rotate(ang);
      ctx.globalCompositeOperation = 'lighter';
      const w = bm.w;
      ctx.globalAlpha = 0.22 * fade; ctx.fillStyle = '#3ff0c3';
      ctx.fillRect(0, (-w / 2 - 2) * S, len * S, (w + 4) * S);
      ctx.globalAlpha = 0.65 * fade;
      ctx.fillRect(0, (-w / 2) * S, len * S, w * S);
      ctx.globalAlpha = fade; ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, -S, len * S, 2 * S);
      ctx.globalCompositeOperation = 'source-over';
      // the tokens racing along it
      const dig = art.digits.heal;
      ctx.globalAlpha = fade;
      for (let q = 0; q < 9; q++) {
        const along = ((q * 23 + bm.t * 420) % Math.max(20, len));
        const off = ((q * 7) % 5 - 2) * (w / 5);
        const g = dig[BEAM_DIGITS[(q + bm.id) % BEAM_DIGITS.length]];
        ctx.drawImage(g, Math.round(along * S), Math.round((off - 3) * S), 5 * S, 7 * S);
      }
      ctx.restore();
    }
  }

  function drawStrikes(sim, t) {
    for (const st of sim.strikes) {
      const k = Math.max(0, st.t) / st.fall;
      if (st.t < 0) continue;
      if (!st.done) {
        // its target on the floor, and the bar of light falling onto it
        ctx.globalAlpha = 0.7; ring(st.x, st.y, Math.max(3, st.r * (1 - k * 0.5)), 1, '#ff4da6'); ctx.globalAlpha = 1;
        const top = st.y - 150, bottom = top + (st.y - top) * Math.min(1, k);
        ctx.globalCompositeOperation = 'lighter';
        const bands = ['#4a1fd6', '#6b3bff', '#ff4da6', '#ffc933', '#fff6e0'];
        const len = Math.min(60, bottom - top);
        for (let b = 0; b < bands.length; b++) {
          ctx.fillStyle = bands[b];
          const y0 = bottom - len + (b * len) / bands.length;
          px(st.x - 2, y0, 4, len / bands.length + 1);
        }
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  }

  function drawBullets(sim, t) {
    const B = sim.B;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < sim.bn; i++) {
      const b = B[i];
      if (!onScreen(b.x, b.y, 10)) continue;
      const g = b.kind === BULLET.PACKET ? art.glow.red[1] : b.kind === BULLET.OVERFIT ? art.glow.mint[1] : b.kind === BULLET.COOKIE ? art.glow.honey[1] : null;
      if (g) glow(g, b.x, b.y);
    }
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < sim.bn; i++) {
      const b = B[i];
      if (!onScreen(b.x, b.y, 10)) continue;
      if (b.kind === BULLET.TROLL) spr(F.bubble, b.x, b.y + Math.round(Math.sin(b.t * 10)));
      else if (b.kind === BULLET.PACKET) spr(F.packet, b.x, b.y);
      else if (b.kind === BULLET.COOKIE) sprRot(F.cookie, b.x, b.y, Math.round(b.t * 6) * (Math.PI / 2));
      else spr(F.glitch, b.x + (((b.t * 30) | 0) % 3 === 0 ? 1 : 0), b.y);
    }
  }

  function drawGlows(sim, t) {
    // the shots' and chips' light, added (one pass)
    ctx.globalCompositeOperation = 'lighter';
    const S_ = sim.S;
    for (let i = 0; i < sim.sn; i++) {
      const s = S_[i];
      if (s.dead || !onScreen(s.x, s.y, 20)) continue;
      if (s.kind === SHOT.BOLT) glow(art.glow.mint[1], s.x, s.y);
      else if (s.kind === SHOT.HEAD) glow(art.glow.violet[2], s.x, s.y);
      else glow(art.glow.honey[2], s.x, s.y);
    }
    const fw = sim.fw;
    if (fw.on) for (let b = 0; b < fw.n; b++) if (fw.blocks[b]) glow(art.glow.red[2], fw.blocks[b].x, fw.blocks[b].y);
    const G = sim.G, gl = [null, art.glow.honey[0], art.glow.pink[1]];
    for (let i = 0; i < sim.gn; i++) {
      const g = G[i];
      if (g.tier && onScreen(g.x, g.y, 6)) glow(gl[g.tier], g.x, g.y);
    }
    for (const nv of sim.novas) {
      const k = nv.t / nv.dur;
      if (k > 1.3) continue;
      const P = sim.player;
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, k - 0.6) / 0.6);
      ring(P.x, P.y - 4, nv.r, 4, '#ffc933');
      ring(P.x, P.y - 4, Math.max(1, nv.r - 3), 1, '#fff6e0');
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawMarks(marks, t) {
    for (let i = 0; i < marks.n; i++) {
      const k = marks.t[i] / marks.life[i], x = marks.x[i], y = marks.y[i], r = marks.r[i];
      const fade = 1 - k;
      switch (marks.kind[i]) {
        case 2: // a blast
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = fade;
          spr(discSprite(Math.max(2, r * (0.5 + k * 0.6)), '#ff4da6', 0.35), x, y);
          ring(x, y, Math.max(2, r * (0.4 + k * 0.8)), 2, '#ffc933');
          ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
          break;
        case 1: // a strike lands
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = fade;
          ring(x, y, Math.max(2, r * (0.3 + k)), 2, '#ff4da6');
          if (k < 0.35) spr(discSprite(r * 0.8, '#ffc933', 0.45), x, y);
          ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
          break;
        case 3: // a shock ring (a purge, the win)
        case 7:
          ctx.globalAlpha = fade;
          ring(x, y, Math.max(2, r * k), marks.kind[i] === 7 ? 6 : 3, marks.kind[i] === 7 ? '#3ff0c3' : '#ffc933');
          ctx.globalAlpha = 1;
          break;
        case 4: // a summon puff
          ctx.globalAlpha = fade;
          ring(x, y, Math.max(2, r * (0.4 + k * 0.8)), 2, '#8b66ff');
          ctx.globalAlpha = 1;
          break;
        case 5: // a pick-up sparkle
          ctx.globalAlpha = fade;
          ring(x, y, Math.max(2, 4 + k * r), 1, marks.a[i] ? '#3ff0c3' : '#fff6e0');
          ctx.globalAlpha = 1;
          break;
        case 6: // her level-up ring
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = fade;
          ring(x, y, Math.max(2, 8 + k * r), 3, '#3ff0c3');
          ring(x, y, Math.max(2, 4 + k * r * 0.6), 1, '#fff6e0');
          ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
          break;
        case 8: { // DATA BROKER's dash line, blinking
          if (((t * 14) | 0) % 2) break;
          ctx.fillStyle = '#ff5a5f';
          const a = marks.a[i], len = marks.b[i];
          for (let d = 10; d < len; d += 6) px(x + Math.cos(a) * d - 1, y + Math.sin(a) * d - 1, 2, 2);
          break;
        }
        case 10: { // a CAPTCHA popped: verified ✓, rising
          const CHECK = [[6, 0], [5, 1], [0, 2], [4, 2], [1, 3], [3, 3], [2, 4]];
          const yy = y - k * 14;
          ctx.globalAlpha = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
          ctx.fillStyle = INK;
          for (const [cx, cy] of CHECK) px(x - 3 + cx, yy - 2 + cy + 1, 2, 2);
          ctx.fillStyle = '#2fd27a';
          for (const [cx, cy] of CHECK) px(x - 3 + cx, yy - 2 + cy, 1, 1);
          ctx.globalAlpha = 1;
          break;
        }
        default: break;
      }
    }
  }

  function drawPixels(p) {
    for (let i = 0; i < p.n; i++) {
      const k = p.life[i] / p.full[i];
      ctx.globalAlpha = k < 0.35 ? k / 0.35 : 1;
      ctx.fillStyle = p.col[i];
      const s = p.size[i];
      if (p.kind[i] === 2) {
        const d = Math.hypot(p.vx[i], p.vy[i]) || 1;
        const ux = p.vx[i] / d, uy = p.vy[i] / d;
        const len = Math.min(5, 1 + d * 0.02);
        for (let q = 0; q < len; q++) px(p.x[i] - ux * q, p.y[i] - uy * q);
      } else px(p.x[i] - s / 2, p.y[i] - p.z[i] - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
  }

  function drawNumbers(nums) {
    const sets = [art.digits.white, art.digits.crit, art.digits.hurt, art.digits.heal, art.digits.tick];
    for (let i = 0; i < nums.n; i++) {
      const t = nums.t[i], kind = nums.kind[i];
      const k = t / NUM_LIFE[kind];
      const pop = t < 0.08 ? 1 + (1 - t / 0.08) * 0.6 : 1;
      const big = kind === 1 ? 1.4 : kind === 2 || kind === 3 ? 1.2 : 1;
      const f = Math.max(1, Math.round(numF * big * pop));
      const str = kind === 3 ? `+${nums.v[i]}` : String(nums.v[i]);
      const w = str.length * 4 * f + f;
      const x = Math.round(sx(nums.x[i] + nums.dx[i] * k) - w / 2);
      const y = Math.round(sy(nums.y[i]) - (1 - (1 - k) ** 3) * 16 * S - 7 * f);
      ctx.globalAlpha = (k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1) * (kind === 4 ? 0.8 : 1);
      const set = sets[kind];
      for (let c = 0; c < str.length; c++) ctx.drawImage(set[str[c]], x + c * 4 * f, y, 5 * f, 7 * f);
    }
    ctx.globalAlpha = 1;
  }

  // ---------- the HUD (screen pixels) ----------
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function sticker(x, y, w, h, r, fill, edge = INK, shadow = 3) {
    const u = dpr * ui;
    ctx.fillStyle = edge;
    roundRect(x, y + shadow * u, w, h, r); ctx.fill();
    roundRect(x, y, w, h, r); ctx.fill();
    ctx.fillStyle = fill;
    roundRect(x + 2.5 * u, y + 2.5 * u, w - 5 * u, h - 5 * u, Math.max(1, r - 2.5 * u)); ctx.fill();
  }
  function xpBar(sim, hud) {
    const u = dpr * ui, P = sim.player;
    const x = (12 + hud.safeL) * u, y = hud.top * dpr, w = W - x - (12 + hud.safeR) * u, h = 14 * u;
    sticker(x, y, w, h, 7 * u, '#2a1f52', INK, 2);
    const k = Math.min(1, P.xp / P.need);
    const iw = w - 5 * u;
    if (k > 0) {
      ctx.fillStyle = '#3ff0c3';
      roundRect(x + 2.5 * u, y + 2.5 * u, Math.max(6 * u, iw * k), h - 5 * u, 4.5 * u); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(x + 5 * u, y + 4 * u, Math.max(0, iw * k - 6 * u), 2 * u);
    }
    // her level, on a tab
    const label = `LV ${P.level}`;
    ctx.font = FONT(900, 11 * u);
    const tw = ctx.measureText(label).width + 14 * u;
    sticker(x + 6 * u, y + h - 4 * u, tw, 19 * u, 8 * u, '#fffaf0', INK, 2);
    ctx.fillStyle = INK; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillText(label, x + 13 * u, y + h - 4 * u + 9.5 * u);
    return y + h + 18 * u;
  }
  function bossBar(sim, y, t) {
    const b = sim.boss;
    if (!b || b.dead) return;
    const u = dpr * ui;
    const w = Math.min(W - 40 * u, 420 * u), x = (W - w) / 2;
    ctx.font = FONT(900, 12 * u);
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const name = ENEMIES[b.k].name;
    ctx.lineWidth = 4 * u; ctx.lineJoin = 'round'; ctx.strokeStyle = INK;
    ctx.strokeText(name, W / 2, y + 12 * u);
    ctx.fillStyle = '#ff4da6';
    ctx.fillText(name, W / 2, y + 12 * u);
    const by = y + 17 * u, h = 12 * u;
    sticker(x, by, w, h, 6 * u, '#3a1430', INK, 2);
    const k = Math.max(0, b.hp / b.maxHp);
    // the damage just done: a white trail that drains down to what's left
    if (bossId !== b.id) { bossId = b.id; bossLag = k; }
    bossLag = Math.max(k, bossLag - frameDt * 0.35 * Math.max(1, (bossLag - k) * 6));
    const iw = w - 5 * u;
    if (bossLag > k) { ctx.fillStyle = '#fffaf0'; roundRect(x + 2.5 * u, by + 2.5 * u, Math.max(4 * u, iw * bossLag), h - 5 * u, 3.5 * u); ctx.fill(); }
    ctx.fillStyle = '#ff4da6';
    roundRect(x + 2.5 * u, by + 2.5 * u, Math.max(4 * u, iw * k), h - 5 * u, 3.5 * u); ctx.fill();
  }
  // her weapons and passives with their levels, bottom-left
  function loadoutRow(sim, hud) {
    const u = dpr * ui, L = sim.loadout;
    // icons at a whole multiple of their 13 pixels (crisp)
    const size = 13 * Math.max(2, Math.round(2 * u)), gap = 5 * u;
    ctx.imageSmoothingEnabled = false;
    let x0 = (12 + hud.safeL) * u, y0 = H - (12 + hud.safeB) * u - size * 2 - gap - 8 * u;
    const rows = [WEAPONS.filter((w) => L.weapons[w.id]).map((w) => [w.id, L.weapons[w.id]]), PASSIVES.filter((p) => L.passives[p.id]).map((p) => [p.id, L.passives[p.id]])];
    // the demo's small frame: her weapons only
    if (isDemo) { rows.pop(); y0 += size + gap; }
    rows.forEach((row, r) => {
      const y = y0 + r * (size + gap + 4 * u);
      row.forEach(([id, lv], c) => {
        const x = x0 + c * (size + gap);
        ctx.fillStyle = 'rgba(23,10,54,0.82)';
        roundRect(x, y, size, size, 6 * u); ctx.fill();
        const f = F[`i_${id}`];
        if (f) ctx.drawImage(f.img, f.x, f.y, f.w, f.h, Math.round(x), Math.round(y), size, size);
        // level pips
        for (let p = 0; p < MAX_LEVEL; p++) {
          ctx.fillStyle = p < lv ? (lv >= MAX_LEVEL ? '#ffc933' : '#3ff0c3') : 'rgba(255,250,240,0.25)';
          ctx.fillRect(Math.round(x + 2 * u + p * ((size - 4 * u) / MAX_LEVEL)), Math.round(y + size + 1.5 * u), Math.max(1, Math.round((size - 4 * u) / MAX_LEVEL - 1.5 * u)), Math.round(2.5 * u));
        }
      });
    });
    ctx.imageSmoothingEnabled = true;
  }
  // arrows at the screen's edge to a boss or a cache off the screen
  function arrows(sim, t, hud) {
    const u = dpr * ui;
    const targets = [];
    if (sim.boss && !sim.boss.dead) targets.push([sim.boss.x, sim.boss.y, '#ff4da6']);
    for (const k of sim.K) if (k.kind === 'cache') targets.push([k.x, k.y, '#ffc933']);
    for (const [wx, wy, col] of targets) {
      const x = sx(wx), y = sy(wy);
      const m = 26 * u;
      if (x > m && x < W - m && y > hud.top * dpr + m && y < H - m) continue;
      const cx = W / 2, cy = H / 2;
      const a = Math.atan2(y - cy, x - cx);
      const k = Math.min((W / 2 - m) / Math.abs(Math.cos(a) || 1e-6), (H / 2 - m - 20 * u) / Math.abs(Math.sin(a) || 1e-6));
      const ax = cx + Math.cos(a) * k, ay = cy + Math.sin(a) * k + 10 * u;
      const pulse = 1 + 0.12 * Math.sin(t * 8);
      ctx.save();
      ctx.translate(ax, ay); ctx.rotate(a); ctx.scale(pulse, pulse);
      ctx.beginPath(); ctx.moveTo(11 * u, 0); ctx.lineTo(-7 * u, -9 * u); ctx.lineTo(-3 * u, 0); ctx.lineTo(-7 * u, 9 * u); ctx.closePath();
      ctx.lineJoin = 'round'; ctx.lineWidth = 3 * u; ctx.strokeStyle = INK; ctx.stroke();
      ctx.fillStyle = col; ctx.fill();
      ctx.restore();
    }
  }
  function vignette(hud) {
    const u = dpr * ui;
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(8,4,24,0)');
    g.addColorStop(1, 'rgba(8,4,24,0.55)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (hud.hurt > 0 || hud.low > 0) {
      const a = Math.min(0.55, hud.hurt * 1.6 + hud.low);
      const r = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
      r.addColorStop(0, 'rgba(255,40,70,0)');
      r.addColorStop(1, `rgba(255,40,70,${a.toFixed(3)})`);
      ctx.fillStyle = r; ctx.fillRect(0, 0, W, H);
    }
    if (hud.flash > 0 && !REDUCED) {
      ctx.fillStyle = `rgba(255,250,240,${Math.min(0.5, hud.flash).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
    void u;
  }
  // a banner across the middle: big words with an ink edge, popping in
  let hudTop = 60, bossId = 0, bossLag = 1, frameDt = 1 / 60;
  function banner(b, t) {
    if (!b) return;
    const u = dpr * ui;
    const k = b.t / b.life;
    const pop = b.t < 0.18 ? 0.6 + 0.4 * (1 - (1 - b.t / 0.18) ** 3) * 1.08 : 1;
    const a = k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1;
    const y = Math.max(hudTop * dpr + 70 * u, H * 0.25);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(W / 2, y);
    ctx.scale(pop, pop);
    ctx.rotate(-0.035);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const big = Math.min(46 * u, W / Math.max(6, b.text.length) * 1.45);
    ctx.font = FONT(900, big);
    ctx.lineJoin = 'round';
    ctx.lineWidth = big * 0.2; ctx.strokeStyle = INK;
    ctx.fillStyle = INK; ctx.fillText(b.text, 0, big * 0.09);
    ctx.strokeText(b.text, 0, 0);
    ctx.fillStyle = b.color || '#fffaf0';
    ctx.fillText(b.text, 0, 0);
    if (b.sub) {
      const sub = b.sub.toUpperCase();
      const small = Math.min(15 * u, W / Math.max(10, sub.length) * 1.6);
      ctx.font = FONT(850, small, 'semi-expanded');
      const tw = ctx.measureText(sub).width + 22 * u;
      sticker(-tw / 2, big * 0.62, tw, small + 14 * u, (small + 14 * u) / 2, b.subBg || '#fffaf0', INK, 3);
      ctx.fillStyle = INK;
      ctx.fillText(sub, 0, big * 0.62 + (small + 14 * u) / 2 + u);
    }
    ctx.restore();
  }
  // AGI-1's bubble over her head
  function bubble(sim, say) {
    if (!say) return;
    const u = dpr * ui, P = sim.player;
    // it pops in (a little overshoot) and out (shrinking), fading only at the very end
    const t0 = say.t, left = say.life - say.t;
    const pop = t0 < 0.16 ? 0.55 + 0.55 * (t0 / 0.16) - 0.1 * Math.max(0, (t0 - 0.11) / 0.05) : left < 0.16 ? Math.max(0.2, left / 0.16) : 1;
    const a = left < 0.08 ? left / 0.08 : 1;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = SERIF(16 * u);
    const tw = ctx.measureText(say.text).width;
    const heartW = say.heart ? 14 * u : 0;
    const w = tw + heartW + 22 * u, h = 30 * u;
    let x = sx(P.x) - w / 2, y = sy(P.y - 30) - h - 8 * u;
    x = Math.max(8 * u, Math.min(W - w - 8 * u, x));
    y = Math.max(8 * u, y);
    // scale about the tail's tip
    const ax = sx(P.x), ay = y + h + 7 * u;
    ctx.translate(ax, ay); ctx.scale(pop, pop); ctx.translate(-ax, -ay);
    sticker(x, y, w, h, 13 * u, '#ffffff', INK, 3);
    // its tail
    const tx = Math.max(x + 14 * u, Math.min(x + w - 14 * u, sx(P.x)));
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.moveTo(tx - 7 * u, y + h - 2 * u); ctx.lineTo(tx, y + h + 7 * u); ctx.lineTo(tx + 6 * u, y + h - 2 * u); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(tx - 4 * u, y + h - 3 * u); ctx.lineTo(tx, y + h + 3 * u); ctx.lineTo(tx + 3 * u, y + h - 3 * u); ctx.fill();
    ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(say.text, x + 11 * u, y + h / 2 + u);
    if (say.heart) {
      const f = F.heart, hx = x + 11 * u + tw + 4 * u, hy = y + h / 2 - 5 * u;
      ctx.drawImage(f.img, f.x, f.y, f.w, f.h, Math.round(hx), Math.round(hy), Math.round(f.w * 1.2 * u), Math.round(f.h * 1.2 * u));
    }
    ctx.restore();
  }
  // short shouts over her head (×24, MAGNET!, +30 HP), rising and fading
  function callouts(sim, list) {
    if (!list.length) return;
    const u = dpr * ui, P = sim.player;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    list.forEach((c, i) => {
      const k = c.t / c.life;
      const pop = c.t < 0.12 ? 0.5 + (c.t / 0.12) * 0.6 : c.t < 0.2 ? 1.1 - ((c.t - 0.12) / 0.08) * 0.1 : 1;
      const size = 20 * u * pop;
      ctx.font = FONT(900, size);
      ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      const x = sx(P.x), y = sy(P.y - 44) - k * 26 * u - i * 22 * u;
      ctx.lineWidth = size * 0.24; ctx.strokeStyle = INK;
      ctx.strokeText(c.text, x, y);
      ctx.fillStyle = c.color;
      ctx.fillText(c.text, x, y);
    });
    ctx.globalAlpha = 1;
  }
  function joystick(stick) {
    if (!stick || !stick.on) return;
    const u = dpr;
    const R = stick.R * u;
    const bx = stick.x * u, by = stick.y * u;
    ctx.lineWidth = 3 * u;
    ctx.fillStyle = 'rgba(23,10,54,0.35)';
    ctx.strokeStyle = 'rgba(255,250,240,0.7)';
    ctx.beginPath(); ctx.arc(bx, by, R, 0, TAU); ctx.fill(); ctx.stroke();
    const kx = bx + stick.dx * R, ky = by + stick.dy * R;
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.arc(kx, ky + 3 * u, 22 * u, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fffaf0';
    ctx.beginPath(); ctx.arc(kx, ky, 22 * u, 0, TAU); ctx.fill();
    ctx.lineWidth = 2.5 * u; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = '#e4d9ff';
    ctx.beginPath(); ctx.arc(kx, ky, 9 * u, 0, TAU); ctx.fill();
  }
  // the demo's numbers (the kit's bar is hidden there): time and bots, on the canvas
  function demoHud(sim, hud, fmtTime) {
    const u = dpr * ui;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const label = fmtTime(sim.t);
    ctx.font = FONT(900, 20 * u);
    const tw = ctx.measureText(label).width + 26 * u;
    const y = hud.top * dpr + 22 * u;
    sticker(W / 2 - tw / 2, y, tw, 32 * u, 16 * u, sim.t >= 600 ? '#ff4da6' : '#ffc933', INK, 3);
    ctx.fillStyle = INK;
    ctx.fillText(label, W / 2, y + 16.5 * u);
    ctx.font = MONO(12 * u);
    ctx.textAlign = 'right';
    ctx.lineWidth = 3 * u; ctx.strokeStyle = INK;
    const kills = `${sim.kills.toLocaleString('en-US')} bots down`;
    ctx.strokeText(kills, W - 12 * u, y + 16 * u);
    ctx.fillStyle = '#fffaf0';
    ctx.fillText(kills, W - 12 * u, y + 16 * u);
  }

  return {
    get S() { return S; },
    // what the screen shows, in world pixels from its middle (the sim spawns just past it)
    viewHalf() { layout(); return { hw: W / S / 2, hh: H / S / 2 }; },
    // where on the screen (CSS px) a world point is
    toScreen(wx, wy) { return { x: (wx * S + ox) / dpr, y: (wy * S + oy) / dpr }; },
    snapCamera(sim) { const P = sim.player; camX = P.x; camY = P.y - 14; leadX = 0; leadY = 0; },
    frame({ sim, fx, hud, dt, t, shake, demo, fmtTime }) {
      layout();
      frameDt = dt;
      const P = sim.player;
      // the camera: on her, leaning the way she's going
      const want = P.moving && !P.dead ? 22 : 0;
      const lk = 1 - Math.exp(-3 * dt);
      leadX += (P.fx * want - leadX) * lk; leadY += (P.fy * want * 0.8 - leadY) * lk;
      const ck = 1 - Math.exp(-14 * dt);
      camX += (P.x + leadX - camX) * ck; camY += (P.y - 14 + leadY - camY) * ck;
      ox = Math.round(W / 2 - camX * S + (shake?.x || 0) * dpr);
      oy = Math.round(H / 2 - camY * S + (shake?.y || 0) * dpr);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      drawFloor();
      drawFloorItems(sim, t);
      drawField(sim, t);
      drawStrikes(sim, t);
      drawFirewall(sim, t, false);
      drawBots(sim, t);
      // the numbers under her: in a crowd she must never disappear behind them
      drawNumbers(fx.nums);
      drawHer(sim, t, demo);
      drawFirewall(sim, t, true);
      drawBeams(sim, t);
      drawShots(sim, t);
      drawGlows(sim, t);
      drawMarks(fx.marks, t);
      drawBullets(sim, t);
      drawPixels(fx.px);
      // the HUD
      ctx.imageSmoothingEnabled = true;
      vignette(hud);
      if (hud.dim) { ctx.fillStyle = `rgba(10,5,28,${hud.dim})`; ctx.fillRect(0, 0, W, H); }
      if (!hud.hideHud) {
        arrows(sim, t, hud);
        const below = xpBar(sim, hud);
        bossBar(sim, demo ? below + 30 * dpr : below, t);
        loadoutRow(sim, hud);
        bubble(sim, hud.say);
        callouts(sim, hud.callouts);
        if (demo) demoHud(sim, hud, fmtTime);
      }
      hudTop = hud.top;
      banner(hud.banner, t);
      joystick(hud.stick);
    },
  };
}
