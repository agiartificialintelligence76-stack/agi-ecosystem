// HALLUCINATION on agi1.app (2026-11-08): She drew it from memory. Find what she made up.
// Spot the difference, endlessly: AGI-1 redraws a picture-book scene from memory and makes up five things. Tap them on
// either picture before the clock runs out; ask her for a hint (she confesses one), or blink (the redraw flickers over
// the memory and whatever changed jumps). This file wires the arcade kit's frame (../kit/shell.js), the input, the loop
// and the four ways it runs: an endless run, the daily scene (timed: lower is better), the title's two pictures
// circling themselves, and `?demo` (the arcade's preview: its own player, seeded, silent, forever).
import './style.css';
import { createShell, el } from '../kit/shell.js';
import { fitCanvas } from '../kit/canvas.js';
import { createLoop } from '../kit/loop.js';
import { pointer, keyboard } from '../kit/input.js';
import { DEMO, SEED, TOUCH, QUERY, REDUCED } from '../kit/env.js';
import { Particles, FloatText, Shake, rng, fmt, clamp, ease } from '../kit/fx.js';
import { makeScene } from './scene.js';
import { TEMPLATE_IDS } from './templates.js';
import { renderPicture } from './draw.js';
import { computeLayout, pickPicture } from './layout.js';
import { createRenderer, makeScribble, ringOf, IN_DUR, CLEAR_DUR, MISS_DUR, C } from './render.js';
import { RULES, createRun, startScene, tick, tap, clearScene, useHint, useBlink, sceneSeed, templateOrder, dateKey, dailySeed, dailyTemplate, fmtSecs } from './rules.js';
import { planDemo, PREVIEW_TIMES } from './ai.js';
import { LINES, confess, endLine, shareText, dailyShare, DAILY_DONE, DAILY_BEST } from './lines.js';
import { createSfx, createMusic } from './sound.js';

const BOOT = performance.now();
const TAGLINE = 'She drew it from memory. Find what she made up.';
const FACE = '/images/landing/agi1-face.webp';
const SVGNS = 'http://www.w3.org/2000/svg';
const root = document.getElementById('ak-root');

if (QUERY.has('qa') && /^(gallery|objects)$/.test(QUERY.get('qa'))) import('./qa.js').then((m) => m.runQa(QUERY.get('qa'), QUERY));
else start();

function start() {
  const shell = createShell({
    game: 'hallucination', name: 'HALLUCINATION', root,
    howTo: {
      intro: 'AGI-1 redrew a scene from memory, and made up five things. Find all five before the clock runs out.',
      steps: [
        ['Compare the two', 'One picture is the memory, the other is her redraw. Five little things are different.'],
        ['Tap what changed', 'On either picture. Every find is circled on both. A wrong tap costs 3 seconds.'],
        ['Be quick', 'Finds close together build a combo. Time left when a scene is done turns into points.'],
        ['Ask her, or blink', 'Ask her and she confesses one. Blink flicks the redraw over the memory: whatever changed jumps.'],
      ],
      touch: [['Tap', 'Circle a difference'], ['Ask her', 'A hint: 2 a run, one more every 3 scenes'], ['Blink', 'Flick the pictures: 2 a run']],
      keys: [['Click', 'Circle a difference'], ['Arrows', 'Move the magnifier'], ['Space', 'Check under the magnifier'], ['H', 'Ask her for a hint'], ['B', 'Blink'], ['P', 'Pause']],
    },
    onPause: () => { keys.clear(); },
    onRestart: () => (G.run?.mode === 'daily' ? startDaily() : newRun()),
    onQuit: () => toTitle(),
  });
  const audio = shell.audio;
  const sfx = createSfx(audio);
  const music = createMusic();

  const canvas = el('canvas', { class: 'hl-canvas', role: 'img', 'aria-label': 'HALLUCINATION: two versions of a picture, the memory and her redraw' });
  const safe = el('div', { class: 'hl-safe', 'aria-hidden': 'true' });
  const live = el('p', { class: 'ak-sr', 'aria-live': 'polite' });
  const countHint = el('span', 'hl-tool-count', '2');
  const countBlink = el('span', 'hl-tool-count', '2');
  const hintBtn = el('button', { class: 'hl-tool is-hint', type: 'button', 'aria-label': 'Ask her for a hint (H)' },
    el('span', 'hl-tool-icon', el('img', { src: FACE, alt: '', width: 30, height: 30 })), el('span', 'hl-tool-label', 'Ask her'), countHint);
  const blinkBtn = el('button', { class: 'hl-tool is-blink', type: 'button', 'aria-label': 'Blink: flick the pictures over each other (B)' },
    el('span', 'hl-tool-icon', eyeIcon()), el('span', 'hl-tool-label', 'Blink'), countBlink);
  shell.stage.append(canvas, safe, live, hintBtn, blinkBtn);
  hintBtn.addEventListener('click', () => askHint());
  blinkBtn.addEventListener('click', () => doBlink());

  const renderer = createRenderer();
  const scoreChip = shell.chip('Score', 0);
  const sceneChip = shell.chip('Scene', 1);
  const dailyChip = shell.chip('Daily', '');
  dailyChip.hide();
  let view = null, L = null;
  view = fitCanvas(canvas, { maxDpr: 2, onResize: () => relayout() });

  // ---------- the state on the screen ----------
  const G = {
    mode: 'boot', run: null, sc: null, picA: null, picB: null, picKey: '', picDirty: 0,
    found: [], marks: [], hint: null, say: null, blink: null, missed: null, missSc: [], sweep: 0, clearFade: 1,
    cardT: [card0(), card0()], phase: { kind: 'idle', t0: 0 }, now: 0,
    parts: new Particles(240), floats: new FloatText(), shake: new Shake({ max: 7, decay: 2.4 }),
    finger: null, reticle: { x: 200, y: 150, on: false }, blush: 0, capLeft: '', penalty: 0, lastWrong: null,
    plan: [], demoT: 0, order: [], dailyKey: '', dailyLabel: '', lowSec: 99,
  };
  const T = { title: null, picA: null, picB: null, t: 0, found: [], key: '', n: 0 };
  let runs = 0, demoRuns = 0;
  const demoRoll = rng(SEED || 7);
  const pick = (list) => list[Math.floor((DEMO ? demoRoll.next() : Math.random()) * list.length)];
  function card0() { return { dx: 0, dy: 0, rot: 0, s: 1, a: 1 }; }

  // ---------- layout ----------
  function insets() {
    if (DEMO) return { top: 0, right: 0, bottom: 0, left: 0 };
    const cs = getComputedStyle(safe);
    const px = (v) => parseFloat(v) || 0;
    const bar = shell.bar.getBoundingClientRect(), st = canvas.getBoundingClientRect();
    return { top: Math.max(bar.bottom - st.top, px(cs.paddingTop)) + 2, right: px(cs.paddingRight), bottom: px(cs.paddingBottom), left: px(cs.paddingLeft) };
  }
  function relayout() {
    if (!view) return;
    const prev = L;
    L = computeLayout(view.w, view.h, insets(), { demo: DEMO });
    if (prev && prev.pw !== L.pw) { G.picDirty = performance.now(); G.parts.clear(); G.floats.clear(); }
    placeButtons();
    T.key = '';
  }
  function placeButtons() {
    if (!L || DEMO) return;
    const s = L.strip, h = Math.max(44, s.h - 8), w = Math.max(48, L.btnW);
    for (const [b, x] of [[hintBtn, s.x], [blinkBtn, s.x + s.w - w]]) {
      b.style.left = `${Math.round(x)}px`; b.style.top = `${Math.round(s.y + (s.h - h) / 2)}px`;
      b.style.width = `${Math.round(w)}px`; b.style.height = `${Math.round(h)}px`;
      b.classList.toggle('is-compact', w < 112);
      b.classList.toggle('is-big', h >= 60);
    }
  }
  function ensurePictures(force = false) {
    if (!L || !G.sc) return;
    const key = `${G.sc.seed}:${G.sc.level}:${G.sc.tpl}:${L.pw}:${view.dpr}`;
    if (key === G.picKey) return;
    if (!force && G.picA && G.picDirty && performance.now() - G.picDirty < 140) return;
    G.picKey = key; G.picDirty = 0;
    G.picA = renderPicture(G.picA || document.createElement('canvas'), G.sc, 'a', L.pw, L.ph, view.dpr);
    G.picB = renderPicture(G.picB || document.createElement('canvas'), G.sc, 'b', L.pw, L.ph, view.dpr);
  }

  // ---------- words ----------
  const announce = (text) => { live.textContent = text; };
  function speak(text, dur = 2.6) {
    if (!text) return;
    G.say = { text, t0: G.now, dur };
    announce(`AGI-1: ${text}`);
  }
  function updateChips(pop = false) {
    if (!G.run) return;
    scoreChip.set(G.run.score, { pop });
    sceneChip.set(G.run.level);
    countHint.textContent = String(G.run.hints);
    countBlink.textContent = String(G.run.blinks);
    hintBtn.setAttribute('aria-disabled', String(G.run.hints <= 0));
    blinkBtn.setAttribute('aria-disabled', String(G.run.blinks <= 0));
  }
  const bump = (b) => { b.classList.remove('is-pop'); void b.offsetWidth; b.classList.add('is-pop'); };

  // ---------- scenes ----------
  function setScene(sc, { intro = true } = {}) {
    G.sc = sc;
    G.found = []; G.marks = []; G.hint = null; G.missed = null; G.sweep = 0; G.clearFade = 1; G.blink = null; G.lastWrong = null;
    shell.stage.classList.remove('hl-blinking');
    G.missSc = sc.diffs.map(() => makeScribble());
    G.picKey = '';
    ensurePictures(true);
    G.phase = intro ? { kind: 'in', t0: G.now } : { kind: 'play', t0: G.now };
    G.lowSec = 99;
    G.reticle.x = 200; G.reticle.y = 150;
  }
  function sceneFor(run) {
    const idx = run.level - 1;
    return makeScene(sceneSeed(run.seed, idx), run.level, { template: G.order[idx % G.order.length] });
  }
  function nextScene() {
    startScene(G.run);
    setScene(sceneFor(G.run));
    G.capLeft = `SCENE ${G.run.level}`;
    updateChips();
    if (G.mode === 'demo') G.plan = planDemo(G.sc, demoRoll, { start: G.demoT + IN_DUR + 0.35, pace: 1.12, wrongBefore: 2 });
  }

  // ---------- an endless run ----------
  function newRun() {
    stopTitle();
    const seed = SEED && runs === 0 ? SEED : ((Math.random() * 2 ** 31) >>> 0) || 1;
    runs++;
    G.run = createRun({ mode: 'endless', seed });
    G.order = templateOrder(seed, TEMPLATE_IDS);
    G.mode = 'play';
    scoreChip.hide(false); sceneChip.hide(false); dailyChip.hide();
    G.parts.clear(); G.floats.clear(); G.say = null;
    const firstEver = !Number(shell.store.read().runs);
    shell.started();
    nextScene();
    sfx.start();
    audio.music(music);
    if (runs === 1) setTimeout(() => { if (G.run && G.run.found === 0 && G.mode === 'play') speak(pick(LINES.start), 3); }, 900);
    if (firstEver) setTimeout(() => { if (G.run && G.run.found === 0 && G.mode === 'play') shell.toast(TOUCH ? 'Tap what changed, on either picture' : 'Click what changed, on either picture', '', 3200); }, 1300);
    announce(`Scene ${G.run.level}. Find the five things she made up.`);
  }
  // ---------- the daily scene ----------
  function dailyInfo() {
    const key = dateKey();
    const best = shell.store.best(`d${key}`);
    return { key, best };
  }
  function startDaily() {
    stopTitle();
    const key = dateKey();
    G.dailyKey = key;
    G.run = createRun({ mode: 'daily', seed: dailySeed(key) });
    G.run.level = RULES.dailyLevel;
    G.order = [dailyTemplate(key, TEMPLATE_IDS)];
    G.mode = 'play';
    const d = new Date();
    G.dailyLabel = `TODAY · ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()}`;
    scoreChip.hide(); sceneChip.hide(); dailyChip.hide(false);
    dailyChip.set(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    G.parts.clear(); G.floats.clear(); G.say = null;
    shell.started();
    audio.music(music);
    startScene(G.run);
    setScene(makeScene(dailySeed(key), RULES.dailyLevel, { template: G.order[0] }));
    G.capLeft = 'DAILY';
    updateChips();
    sfx.start();
    announce('Today\'s scene. Find all five as fast as you can.');
  }

  // ---------- taps ----------
  const canTap = () => G.run && !G.run.over && !G.run.cleared && (G.phase.kind === 'play' || (G.phase.kind === 'in' && G.now - G.phase.t0 > 0.35))
    && (G.mode === 'demo' || (G.mode === 'play' && shell.state === 'play'));
  function handleTap(x, y, pic, k) {
    if (!canTap()) return;
    const lw = G.lastWrong;
    if (lw && G.now - lw.t < 0.32 && Math.hypot(lw.x - x, lw.y - y) < 24) return;
    const res = tap(G.run, G.sc, x, y, RULES.tapRadiusPx / k);
    if (!res) return;
    if (res.type === 'find') onFind(res, x, y, pic);
    else if (res.type === 'wrong') onWrong(x, y, pic);
    else { sfx.again(); const f = G.found.find((q) => q.i === res.i); if (f) f.t0 = G.now - 0.36; }
  }
  function screenOf(pic, x, y) {
    if (pic === 2 && G.blink) { const V = L.blinkView, k = V.w / 400; return [V.x + x * k, V.y + y * k]; }
    const P = L.pics[Math.max(0, pic)]; return [P.x + x * L.k, P.y + y * L.k];
  }
  function onFind(res, x, y, pic) {
    const d = G.sc.diffs[res.i];
    G.found.push({ i: res.i, t0: G.now, sc: makeScribble() });
    if (G.hint && G.hint.i === res.i) G.hint = null;
    sfx.find(G.found.length - 1, res.combo);
    shell.haptic(14);
    for (let j = 0; j < 2; j++) {
      const R = ringOf(d.region, L.pics[j], L.k);
      G.parts.burst({ x: R.cx, y: R.cy - R.ry * 0.2, count: 10, speed: [60, 190], life: [0.35, 0.7], size: [3, 6], colors: [C.honey, C.pink, C.paper, C.mint], gravity: 260, drag: 2.4, shape: j ? 'star' : 'circle' });
    }
    const [sx, sy0] = screenOf(pic, x, y), sy = Math.max(sy0, L.block.y + 74);
    G.floats.add({ x: sx, y: sy - 12, text: `+${res.points}`, color: C.honey, size: 22, rise: 40, life: 0.85 });
    if (res.combo > 1) G.floats.add({ x: sx, y: sy - 62, text: `COMBO ×${res.combo}`, color: C.pink, size: 16 + res.combo * 2.5, rise: 26, life: 1.05 });
    updateChips(true);
    announce(`Found it: the ${d.noun}. ${G.run.sceneFound.filter(Boolean).length} of 5.`);
    if (res.cleared) { G.phase = { kind: 'clear', t0: G.now + 0.3, did: {} }; return; }
    if (res.combo >= 3) speak(pick(LINES.combo));
    else if (G.mode !== 'demo' && Math.random() < 0.28) speak(pick(LINES.find));
    else if (G.mode === 'demo' && G.found.length === 3) speak(pick(LINES.find));
  }
  function onWrong(x, y, pic) {
    G.marks.push({ pic: pic === 2 ? 1 : pic, x, y, t0: G.now });
    if (G.marks.length > 6) G.marks.shift();
    G.lastWrong = { t: G.now, x, y };
    G.penalty = G.now;
    sfx.wrong();
    G.shake.kick(0.32);
    shell.haptic([12, 40, 12]);
    const [sx, sy0] = screenOf(pic, x, y), sy = Math.max(sy0, L.block.y + 44);
    G.floats.add({ x: sx, y: sy - 18, text: G.run.mode === 'daily' ? `+${RULES.wrong}s` : `−${RULES.wrong}s`, color: C.pink, size: 20, rise: 30, life: 0.8 });
    if (Math.random() < 0.3 || G.mode === 'demo') speak(pick(LINES.wrong), 2);
    announce(`Not that one. ${G.run.mode === 'daily' ? 'Plus' : 'Minus'} 3 seconds.`);
  }
  // "ask her"
  function askHint() {
    if (!canTap() || G.mode !== 'play') return;
    if (G.run.hints <= 0) { audio.sfx('error'); shell.toast('No hints left', 'warn'); return; }
    if (G.hint) { speak(confess(G.sc.diffs[G.hint.i])); return; }
    const i = useHint(G.run, (open) => open[Math.floor(Math.random() * open.length)]);
    if (i < 0) return;
    G.hint = { i, t0: G.now };
    sfx.hint();
    speak(confess(G.sc.diffs[i]), 3.2);
    G.blush = G.now;
    updateChips();
    bump(hintBtn);
  }
  function doBlink() {
    if (!canTap() || G.mode !== 'play' || G.blink) return;
    if (G.run.blinks <= 0) { audio.sfx('error'); shell.toast('No blinks left', 'warn'); return; }
    if (!useBlink(G.run)) return;
    const V = L.blinkView;
    let picA = null, picB = null;
    if (V.w > L.pw * 1.12) {
      picA = renderPicture(document.createElement('canvas'), G.sc, 'a', V.w, V.h, view.dpr);
      picB = renderPicture(document.createElement('canvas'), G.sc, 'b', V.w, V.h, view.dpr);
    }
    G.blink = { t0: G.now, dur: RULES.blinkTime + 0.3, picA, picB };
    shell.stage.classList.add('hl-blinking');
    sfx.blink();
    updateChips();
    bump(blinkBtn);
    if (Math.random() < 0.5) speak(pick(LINES.blink), 1.6);
  }

  // ---------- the clock ran out, a scene was cleared, the end ----------
  function timeUp() {
    audio.stopMusic();
    G.phase = { kind: 'miss', t0: G.now };
    G.missed = { t0: G.now };
    G.hint = null; G.blink = null;
    sfx.over();
    const left = G.run.sceneFound.filter((f) => !f).length;
    speak(left === 1 ? 'you missed one. so close 🙈' : `you missed ${left} of my lies 🙈`, 2.2);
    announce(`Time's up. ${left} still hidden.`);
  }
  function endRun() {
    if (DEMO) { newDemoRun(); return; }
    const run = G.run;
    G.mode = 'over';
    if (run.mode === 'daily') { endDaily(); return; }
    const prev = shell.store.best();
    const isBest = run.score > 0 && (prev == null || run.score > prev);
    shell.store.update((d) => { d.found = (Number(d.found) || 0) + run.found; d.bestScenes = Math.max(Number(d.bestScenes) || 0, run.scenes); });
    shell.over({
      score: run.score, label: 'points',
      stats: [['Scenes', fmt(run.scenes)], ['Found', fmt(run.found)], ['Best combo', `×${Math.max(1, run.bestCombo)}`], ['Hints used', fmt(run.hintsUsed)]],
      line: endLine(run.found, isBest, pick, prev, run.score),
      share: shareText(run.found),
      onAgain: () => newRun(), onMenu: () => toTitle(),
    });
  }
  function endDaily() {
    audio.stopMusic();
    const run = G.run, done = run.sceneFound.every(Boolean);
    const key = `d${G.dailyKey}`;
    shell.store.update((d) => { for (const k of Object.keys(d).filter((k) => /^d\d{4}-/.test(k)).sort().slice(0, -30)) delete d[k]; });
    const prev = shell.store.best(key);
    const time = Math.round(run.elapsed * 10) / 10;
    shell.over({
      title: done ? 'Today\'s scene' : 'Out of time',
      score: done ? time : `${run.sceneFound.filter(Boolean).length}/5`, label: done ? 'your time' : 'found',
      lower: true, bestKey: key, format: (v) => (typeof v === 'number' ? fmtSecs(v) : String(v)),
      stats: [['Found', `${run.sceneFound.filter(Boolean).length}/5`], ['Wrong taps', fmt(run.wrongs)], ['Hints used', fmt(run.hintsUsed)], ['Blinks', fmt(run.blinksUsed)]],
      line: done ? (prev == null || time < prev ? pick(prev == null ? DAILY_DONE : DAILY_BEST) : pick(DAILY_DONE)) : 'that one was tricky. tomorrow\'s is new 💜',
      share: done ? dailyShare(fmtSecs(time)) : shareText(run.found),
      again: 'Try again', onAgain: () => startDaily(), onMenu: () => toTitle(),
    });
  }

  // ---------- the title: two little pictures circling themselves ----------
  function stopTitle() { T.title = null; }
  function newTitleScene() {
    T.n++;
    const sc = makeScene(((Math.random() * 1e9) >>> 0) || 1, 2, { template: pick(['agiroom', 'bedroom', 'cafe', 'park', 'beach', 'space', 'city', 'rooftop']) });
    T.title = sc; T.t = 0; T.found = []; T.key = '';
  }
  function toTitle() {
    audio.stopMusic();
    G.mode = 'title';
    G.run = null; G.sc = null; G.say = null; G.blink = null; G.finger = null;
    G.parts.clear(); G.floats.clear();
    if (!T.title) newTitleScene();
    const daily = dailyInfo();
    shell.title({
      logo: ['HALLUCI', { text: 'NATION', tone: 'pink' }],
      tagline: TAGLINE,
      play: 'Endless',
      modes: [{ label: 'Daily scene', sub: daily.best != null ? `Today's best ${fmtSecs(daily.best)}` : 'One scene a day, timed', onClick: () => startDaily() }],
      best: shell.store.best(),
      extra: record(),
      onPlay: () => newRun(),
    });
  }
  function record() {
    const d = shell.store.read();
    const parts = [];
    if (Number(d.found) > 0) parts.push(`${fmt(Number(d.found))} hallucinations caught`);
    if (Number(d.bestScenes) > 0) parts.push(`best run ${Number(d.bestScenes)} scenes`);
    return parts.length ? el('p', 'hl-record', parts.join(' · ')) : null;
  }
  // the title's two little pictures go where the title's words aren't: beside them on a wide screen, side by side above
  // (or below) them on a tall one
  function titleLayout() {
    const w = view.w, h = view.h;
    const body = root.querySelector('.ak-title-body')?.getBoundingClientRect();
    const st = canvas.getBoundingClientRect();
    const barB = shell.bar.getBoundingClientRect().bottom - st.top;
    const bx0 = body ? body.left - st.left : w * 0.3, bx1 = body ? body.right - st.left : w * 0.7;
    const by0 = body ? body.top - st.top : h * 0.3, by1 = body ? body.bottom - st.top : h * 0.8;
    const side = Math.min(bx0, w - bx1);
    const mk = (cw) => { const pw = Math.round(cw * 0.93), f = Math.max(3, Math.round(cw * 0.035)), fb = Math.max(12, Math.round(cw * 0.08)); return { pw, ph: Math.round(pw * 0.75), f, fb, cw: pw + 2 * f, ch: Math.round(pw * 0.75) + f + fb }; };
    if (side >= 190) {
      const S = mk(Math.min(side - 36, h * 0.55, 440));
      return { ...S, dim: 0.28, cards: [{ cx: bx0 / 2, cy: h * 0.44, rot: -0.08 }, { cx: w - (w - bx1) / 2, cy: h * 0.58, rot: 0.07 }] };
    }
    const top = by0 - barB - 14, bottom = h - by1 - 12;
    const band = top >= bottom * 0.7 ? { y0: barB + 6, h: top } : { y0: by1 + 6, h: bottom };
    let S = mk(Math.min(w * 0.56, (band.h - 10) / 0.86, 280));
    if (S.ch >= 70) {
      const cy = band.y0 + band.h / 2, dx = Math.min(S.cw * 0.47, (w - 24) / 2 - S.cw / 2);
      return { ...S, dim: 0.08, cards: [{ cx: w / 2 - dx, cy: cy + 4, rot: -0.07 }, { cx: w / 2 + dx, cy: cy - 4, rot: 0.06 }] };
    }
    S = mk(Math.min(w * 0.6, 340));
    return { ...S, dim: 0.55, cards: [{ cx: w * 0.3, cy: barB + S.ch * 0.45, rot: -0.1 }, { cx: w * 0.7, cy: h - S.ch * 0.4, rot: 0.08 }] };
  }
  function drawTitle(ctx, dt) {
    renderer.ensureBg(view.w, view.h, view.dpr);
    const sc = T.title;
    if (!sc) return;
    T.t += dt;
    const TL = titleLayout();
    const key = `${sc.seed}:${TL.pw}:${view.dpr}:${T.n}`;
    if (T.key !== key) { T.key = key; T.picA = renderPicture(T.picA || document.createElement('canvas'), sc, 'a', TL.pw, TL.ph, view.dpr); T.picB = renderPicture(T.picB || document.createElement('canvas'), sc, 'b', TL.pw, TL.ph, view.dpr); }
    // a circle every 0.9 s, then a new scene
    const due = Math.floor((T.t - 0.8) / 0.9);
    while (T.found.length < Math.min(5, due + 1) && T.t > 0.8) T.found.push({ i: T.found.length, t0: T.t, sc: makeScribble() });
    if (T.t > 0.8 + 5 * 0.9 + 1.6) { newTitleScene(); return; }
    TL.cards.forEach((cd, i) => {
      const pic = i ? T.picB : T.picA;
      const x = -TL.cw / 2, y = -TL.ch / 2;
      ctx.save();
      const bob = REDUCED ? 0 : Math.sin(T.t * 0.8 + i * 2) * 3;
      ctx.translate(cd.cx, cd.cy + bob); ctx.rotate(cd.rot);
      ctx.fillStyle = C.ink; ctx.fillRect(x + 3, y + 6, TL.cw, TL.ch);
      ctx.fillStyle = C.card; ctx.fillRect(x, y, TL.cw, TL.ch);
      ctx.lineWidth = 2.5; ctx.strokeStyle = C.ink; ctx.strokeRect(x, y, TL.cw, TL.ch);
      const P = { x: x + TL.f, y: y + TL.f, w: TL.pw, h: TL.ph };
      ctx.drawImage(pic, P.x, P.y, P.w, P.h);
      ctx.save(); ctx.beginPath(); ctx.rect(P.x, P.y, P.w, P.h); ctx.clip();
      for (const f of T.found) {
        const d = sc.diffs[f.i]; if (!d) continue;
        const R = ringOf(d.region, P, P.w / 400);
        const prog = REDUCED ? 1 : ease.outCubic(clamp((T.t - f.t0) / 0.34, 0, 1));
        strokeTitle(ctx, f.sc, R, prog);
      }
      ctx.restore();
      ctx.lineWidth = 1.4; ctx.strokeRect(P.x, P.y, P.w, P.h);
      ctx.font = `900 ${Math.max(10, TL.fb * 0.42)}px 'AK Display', sans-serif`; ctx.textBaseline = 'middle'; ctx.fillStyle = C.ink2;
      ctx.fillText(i ? 'HER REDRAW' : 'MEMORY', P.x + 2, y + TL.ch - TL.fb / 2 + 1);
      ctx.restore();
    });
    if (TL.dim) { ctx.fillStyle = `rgba(21,10,32,${TL.dim})`; ctx.fillRect(0, 0, view.w, view.h); }
  }
  function strokeTitle(ctx, s, R, prog) {
    const last = Math.max(1, Math.floor(prog * (s.n - 1)));
    ctx.beginPath();
    for (let j = 0; j <= last; j++) { const x = R.cx + s.pts[j * 2] * R.rx, y = R.cy + s.pts[j * 2 + 1] * R.ry; if (j) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.lineWidth = 5.5; ctx.strokeStyle = C.paper; ctx.stroke();
    ctx.lineWidth = 2.8; ctx.strokeStyle = C.marker; ctx.stroke();
  }

  // ---------- the demo (?demo): its own player, mid-run, forever ----------
  function newDemoRun() {
    demoRuns++;
    const first = demoRuns === 1;
    const seed = (SEED || 7) + demoRuns * 7919;
    G.run = createRun({ mode: 'endless', seed });
    G.run.level = 3; G.run.scenes = 2; G.run.found = 10; G.run.score = 2480 + (seed % 7) * 37;
    G.order = ['agiroom', ...templateOrder(seed, TEMPLATE_IDS.filter((t) => t !== 'agiroom'))];
    G.mode = 'demo';
    startScene(G.run);
    const sc = makeScene(sceneSeed(seed, 0), 3, { template: first ? 'agiroom' : G.order[(demoRuns - 1) % G.order.length] });
    setScene(sc, { intro: !first });
    G.capLeft = `SCENE ${G.run.level}`;
    if (first) {
      G.demoT = Math.max(0, (performance.now() - BOOT) / 1000) + 0.12;
      G.run.timeLeft = 33.4;
      // one already found, so the scene is done inside the recorded window
      const order = sc.diffs.slice().sort((a, b) => (a.region[0] + a.region[2]) - (b.region[0] + b.region[2]));
      const pre = order[0].i;
      G.run.sceneFound[pre] = true;
      G.found.push({ i: pre, t0: -5, sc: makeScribble(() => 0.37) });
      G.plan = planDemo(sc, demoRoll, { found: [pre], times: PREVIEW_TIMES, wrongBefore: 1 });
    } else {
      G.plan = planDemo(sc, demoRoll, { start: G.demoT + IN_DUR + 0.4, pace: 1.12, wrongBefore: 2 });
    }
    G.finger = { x: 0, y: 0, a: 1, press: 0, ring: 0, rx: 0, ry: 0, from: null, fromT: G.demoT, scale: clamp(0.55 + L.k * 0.45, 0.78, 1.1) };
  }
  function demoUpdate(dt) {
    G.demoT += dt;
    const F = G.finger;
    if (!F || !L) return;
    const next = G.plan[0];
    const B = L.block, rest = B.x + B.w + 60 < view.w ? [B.x + B.w + 34, B.y + B.h * 0.62] : [L.pics[1].x + L.pics[1].w * 0.9, L.pics[1].y + L.pics[1].h * 0.55];
    if (!F.from) F.from = rest;
    if (F.press > 0) F.press = Math.max(0, F.press - dt / 0.2);
    if (F.ring > 0) F.ring += dt / 0.4; if (F.ring >= 1) F.ring = 0;
    if (!next || !canTapDemo()) { F.x += (F.from[0] - F.x) * Math.min(1, dt * 6); F.y += (F.from[1] - F.y) * Math.min(1, dt * 6); return; }
    const tgt = screenOf(next.pic, next.x, next.y);
    const look = next.look ? screenOf(next.pic, next.look[0], next.look[1]) : null;
    const t0 = Math.max(F.fromT + 0.12, next.at - 1.05), t2 = next.at - 0.06, t1 = look ? t0 + (t2 - t0) * 0.48 : t0;
    const now = G.demoT;
    let x, y;
    if (now <= t0) [x, y] = F.from;
    else if (look && now < t1) { const u = ease.inOutCubic((now - t0) / (t1 - t0)); x = F.from[0] + (look[0] - F.from[0]) * u; y = F.from[1] + (look[1] - F.from[1]) * u; }
    else { const s = look ? look : F.from, a = look ? t1 : t0; const u = ease.inOutCubic(clamp((now - a) / Math.max(0.05, t2 - a), 0, 1)); x = s[0] + (tgt[0] - s[0]) * u; y = s[1] + (tgt[1] - s[1]) * u; }
    const wob = now < t2 ? Math.sin(now * 9.3) * 2.2 : 0;
    F.x = x + wob; F.y = y + Math.cos(now * 7.1) * 1.6 * (now < t2 ? 1 : 0);
    if (now >= next.at) {
      G.plan.shift();
      F.press = 1; F.ring = 0.01; F.rx = tgt[0]; F.ry = tgt[1];
      F.from = tgt; F.fromT = now;
      handleTap(next.x, next.y, next.pic, L.k);
    }
  }
  const canTapDemo = () => G.run && !G.run.cleared && !G.run.over && (G.phase.kind === 'play' || (G.phase.kind === 'in' && G.now - G.phase.t0 > 0.35));

  // ---------- input ----------
  pointer(canvas, {
    down(p) {
      if (G.mode !== 'play' || shell.state !== 'play' || !L) return;
      G.reticle.on = false;
      if (G.blink) {
        const V = L.blinkView, k = V.w / 400;
        if (p.x >= V.x - 8 && p.x <= V.x + V.w + 8 && p.y >= V.y - 8 && p.y <= V.y + V.h + 8) handleTap(clamp((p.x - V.x) / k, 0, 400), clamp((p.y - V.y) / k, 0, 300), 2, k);
        return;
      }
      const h = pickPicture(L, p.x, p.y, 10);
      if (h.pic >= 0) handleTap(h.x, h.y, h.pic, L.k);
    },
  });
  const keys = keyboard({ ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }, {
    down() { if (G.mode === 'play' && shell.state === 'play') G.reticle.on = true; },
    blocked: () => G.mode !== 'play' || shell.state !== 'play',
  });
  addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || G.mode !== 'play' || shell.state !== 'play') return;
    if (e.target?.closest?.('input, textarea, select')) return;
    const k = e.key;
    if (k === 'h' || k === 'H') { e.preventDefault(); if (!e.repeat) askHint(); return; }
    if (k === 'b' || k === 'B') { e.preventDefault(); if (!e.repeat) doBlink(); return; }
    if ((k === ' ' || k === 'Enter') && !e.target?.closest?.('button, a')) {
      e.preventDefault();
      if (e.repeat) return;
      if (!G.reticle.on) { G.reticle.on = true; return; }
      handleTap(G.reticle.x, G.reticle.y, 1, L.k);
    }
  }, { capture: true });

  // ---------- the loop ----------
  function phaseUpdate(dt) {
    const ph = G.phase, t = G.now - ph.t0;
    const T0 = G.cardT[0], T1 = G.cardT[1];
    const sep = L ? (L.stacked ? [0, L.cards[1].y - L.cards[0].y] : [L.cards[1].x - L.cards[0].x, 0]) : [0, 0];
    Object.assign(T0, card0()); Object.assign(T1, card0());
    G.sweep = 0;
    if (ph.kind === 'in') {
      for (const [j, Tj] of [[0, T0], [1, T1]]) {
        const u = clamp((t - j * 0.09) / (IN_DUR - 0.09), 0, 1), e = REDUCED ? ease.outCubic(u) : ease.outBack(u, 1.2);
        const off = L ? (L.stacked ? view.w * 1.1 : view.h * 0.9) : 400;
        if (L?.stacked) Tj.dx = (j ? 1 : -1) * off * (1 - e); else Tj.dy = off * (1 - e) * (j ? 1.15 : 1);
        Tj.rot = (j ? 0.14 : -0.14) * (1 - e);
        Tj.a = clamp(u * 3, 0, 1);
      }
      if (t >= IN_DUR) G.phase = { kind: 'play', t0: G.now };
    } else if (ph.kind === 'clear') {
      if (t < 0) return;
      const did = ph.did;
      if (!did.bonus && t >= 0.05) {
        did.bonus = true;
        const b = clearScene(G.run);
        sfx.clear();
        G.blush = G.now;
        G.hint = null;
        if (G.run.mode === 'endless') {
          speak(pick(LINES.clear), 2.2);
          ph.bonusPts = b.bonus;
          if (b.hint) { shell.toast('+1 hint', 'good'); bump(hintBtn); }
          updateChips(true);
          announce(`All five found. Time bonus ${b.bonus}.`);
        } else {
          speak(pick(DAILY_DONE), 2.2);
        }
        if (!REDUCED) for (const P of L.pics) G.parts.burst({ x: P.x + P.w / 2, y: P.y + P.h / 2, count: 26, speed: [120, 380], life: [0.6, 1.1], size: [4, 8], colors: [C.honey, C.pink, C.paper, C.mint, C.violet], gravity: 420, drag: 1.4, shape: 'star', spin: 6 });
      }
      // "all five!" where the two pictures meet
      if (!did.stamp && t >= 0.55) {
        did.stamp = true;
        const c = L.block, cx = c.x + c.w / 2, cy = c.y + c.h / 2, sz = Math.min(48, Math.max(26, L.pw * 0.11));
        G.floats.add({ x: cx, y: cy - sz * 0.4, text: G.run.mode === 'daily' ? 'ALL FIVE!' : 'ALL FIVE!', color: C.paper, size: sz, rise: 26, life: 1.25 });
        if (ph.bonusPts) G.floats.add({ x: cx, y: cy + sz * 0.55, text: `+${ph.bonusPts} time bonus`, color: C.honey, size: sz * 0.5, rise: 22, life: 1.25 });
      }
      // the two pictures slide together, the redraw fixes itself (a brush sweep), then both fly away
      const m = REDUCED ? (t > 0.4 ? 1 : 0) : ease.inOutCubic(clamp((t - 0.3) / 0.5, 0, 1));
      T0.dx = sep[0] * 0.5 * m; T0.dy = sep[1] * 0.5 * m;
      T1.dx = -sep[0] * 0.5 * m; T1.dy = -sep[1] * 0.5 * m;
      T1.rot = 0.03 * Math.sin(m * Math.PI);
      G.sweep = clamp((t - 0.72) / 0.55, 0, 1);
      G.clearFade = 1 - clamp((t - 0.6) / 0.35, 0, 1);
      if (!did.whoosh && t > 0.72) { did.whoosh = true; sfx.whoosh(); }
      const out = clamp((t - 1.45) / 0.45, 0, 1), e = ease.inCubic(out);
      if (out > 0) {
        const dx = L.stacked ? -view.w * 1.1 * e : 0, dy = L.stacked ? 0 : view.h * 1.0 * e;
        for (const Tj of [T0, T1]) { Tj.dx += dx; Tj.dy += dy; Tj.rot += (L.stacked ? -0.2 : 0.15) * e; Tj.a = 1 - out * 0.6; }
      }
      if (t >= CLEAR_DUR - 0.05) {
        if (G.run.mode === 'daily') { G.phase = { kind: 'done', t0: G.now }; endRun(); return; }
        nextScene();
      }
    } else if (ph.kind === 'miss') {
      if (t >= MISS_DUR) { G.phase = { kind: 'done', t0: G.now }; endRun(); }
    }
  }
  function update(dt) {
    G.now += dt;
    G.parts.update(dt);
    G.floats.update(dt);
    G.shake.update(dt);
    if (G.blink && G.now - G.blink.t0 > G.blink.dur) { G.blink = null; shell.stage.classList.remove('hl-blinking'); }
    if (!G.run || !L) return;
    if (G.mode === 'demo') demoUpdate(dt);
    phaseUpdate(dt);
    if (G.phase.kind === 'play' && !G.run.cleared && !G.run.over) {
      if (tick(G.run, dt)) { if (G.run.mode === 'daily') { G.phase = { kind: 'done', t0: G.now }; endRun(); } else timeUp(); }
      else if (G.run.mode === 'endless') {
        const s = Math.ceil(G.run.timeLeft);
        if (s <= 10 && s < G.lowSec) { G.lowSec = s; sfx.tick(s <= 5); if (s === 10) speak(pick(LINES.low), 1.8); }
      }
    }
    // the magnifier (keyboard)
    if (G.reticle.on && G.mode === 'play') {
      const sp = (keys.held('left') || keys.held('right') || keys.held('up') || keys.held('down')) ? 190 * dt : 0;
      if (sp) {
        G.reticle.x = clamp(G.reticle.x + ((keys.held('right') ? 1 : 0) - (keys.held('left') ? 1 : 0)) * sp, 0, 400);
        G.reticle.y = clamp(G.reticle.y + ((keys.held('down') ? 1 : 0) - (keys.held('up') ? 1 : 0)) * sp, 0, 300);
      }
    }
  }
  const loop = createLoop({
    update,
    render(alpha, frameDt) {
      const ctx = view.begin();
      if (!L) relayout();
      if (G.mode === 'title') { renderer.ensureBg(view.w, view.h, view.dpr); drawTitle(ctx, frameDt); return; }
      ensurePictures();
      renderer.draw(ctx, G, L, view.w, view.h, view.dpr, G.now);
    },
    paused: () => !DEMO && (shell.state !== 'play' || G.mode !== 'play'),
  });

  // QA (`?qa`): a handle for the screenshot scripts; never on a link from the site
  if (QUERY.has('qa')) {
    window.__hl = {
      get G() { return G; }, get L() { return L; },
      find(i) { const d = G.sc.diffs[i]; handleTap((d.region[0] + d.region[2]) / 2, (d.region[1] + d.region[3]) / 2, 1, L.k); },
      wrong() { handleTap(2, 2, 0, L.k); },
      hint: () => askHint(), blink: () => doBlink(),
      time(s) { G.run.timeLeft = s; },
      bench(n = 60) { const ctx = view.ctx, t0 = performance.now(); for (let i = 0; i < n; i++) { view.begin(); renderer.draw(ctx, G, L, view.w, view.h, view.dpr, G.now); } return (performance.now() - t0) / n; },
      benchPics(n = 10) { const t0 = performance.now(); for (let i = 0; i < n; i++) { G.picKey = ''; ensurePictures(true); } return (performance.now() - t0) / n; },
      level(n) { G.run.level = n; nextScene(); },
    };
  }

  // the canvas's words wait for the arcade's fonts (never longer than a moment)
  const fonts = Promise.all(["900 40px 'AK Display'", "750 16px 'AK Mono'", "italic 400 18px 'AK Serif'"].map((f) => document.fonts?.load(f).catch(() => null)));
  Promise.race([fonts, new Promise((r) => setTimeout(r, 1800))]).then(() => {
    relayout();
    if (DEMO) newDemoRun(); else toTitle();
    loop.start();
  });
}

function eyeIcon() {
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
  const mk = (tag, attrs) => { const n = document.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); svg.append(n); return n; };
  mk('path', { d: 'M2.5 12c2.4-4.2 5.6-6.3 9.5-6.3s7.1 2.1 9.5 6.3c-2.4 4.2-5.6 6.3-9.5 6.3S4.9 16.2 2.5 12z', fill: '#fffaf0', stroke: '#170a36', 'stroke-width': '2', 'stroke-linejoin': 'round' });
  mk('circle', { cx: '12', cy: '12', r: '3.6', fill: '#8b66ff', stroke: '#170a36', 'stroke-width': '1.8' });
  mk('circle', { cx: '13.2', cy: '10.8', r: '1.1', fill: '#fffaf0' });
  return svg;
}
