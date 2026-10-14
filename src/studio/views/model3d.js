// AGI Studio: a 3D model's page (studio.agi1.app/3d/<id>, and agi1.app/studio/<id>: the studio's characters, since
// 2026-10-10 made from an influencer's full body). While it's made: its steps (each look moves it along on our server; since
// 2026-10-13 a model's own plan: its moves described in words add steps). Done: it in 3D (src/studio/viewer.js, three.js,
// loaded only here), moving when you type a move in its chat box or press one; (2026-10-13, the owner: "i wish theres more
// tools to customize the 3d like in meshy"; "3D page tools (Recommended)") its tools, free, in this browser
// (src/studio/stage-tools.js): its background, its light, how it's drawn, a turntable spin, a zoom, its moves' speed and a
// frozen pose, a picture and a short clip; its picture and 3D model to download, and for its maker its extra downloads (other
// formats, kept DL_DAYS days); Share on X; its influencer.
import { h, icon, btn, linkBtn, say, put, add, chips, segmented, busy } from '../ui.js';
import { STEPS, MOVE_NAMES, MOVE_BY_NAME, LOOPING, DL_FORMATS, DL_DAYS, fileUrl, moveIn, moveLabel, modelStepList, stepGroup } from '../rules.js';
import { failText, share3dUrl, dayText, errorText, REACTIONS, num } from '../app-words.js';
import { progressBar } from '../progress.js';
import {
  BACKDROPS, BACKDROP_DEFAULT, CLIP_CLEAR, LIGHTS, LIGHT_DEFAULT, LOOKS, LOOK_DEFAULT, SPEEDS, speedText, ZOOM, zoomText, SPIN_TURN_S,
  PICTURE_LONG, CLIP_LONG, CLIP_SECONDS, CLIP_SECONDS_DEFAULT, CLIP_FPS, CLIP_BITS, clipType, evenFit, backdropCss, paintBackdrop, captureName,
} from '../stage-tools.js';
import { markPlace } from '../photo-edit.js';
import { markTopLeft } from '../video-edit.js';
import { withAiTag } from '../ai-tag.js';
import { range } from './layers.js';

const POLL_MS = 5000;
const DL_POLL_MS = 20_000;
// the share mark (server/media/studio-mark.png: the same picture our server puts on downloads)
const MARK_SRC = new URL('../../../server/media/studio-mark.png', import.meta.url).href;
// a move's name on its button (one described in words: its own name, capitalized)
const labelOf = (m) => (MOVE_BY_NAME.has(m) ? moveLabel(m) : `${String(m).charAt(0).toUpperCase()}${String(m).slice(1)}`);
// what it does when a message names no move (it always does something): a reaction it has, else one of its moves that plays
// once, else any of its moves, else standing (a model may have picked none of the reactions)
export function reactionFor(moves, pick = Math.random) {
  const one = (list) => list[Math.min(list.length - 1, Math.floor(pick() * list.length))];
  const has = REACTIONS.filter((m) => moves.includes(m));
  if (has.length) return one(has);
  const once = moves.filter((m) => m !== 'idle' && !LOOPING.has(m));
  if (once.length) return one(once);
  const any = moves.filter((m) => m !== 'idle');
  return any.length ? one(any) : 'idle';
}

export async function render(ctx, route, root) {
  const id = route.id;
  let c = null, viewer = null, timer = null, dlTimer = null, started = false, loading = false;
  const back = h('a', { class: 'sa-back', href: ctx.href('/explore'), dataset: { saLink: '' } }, icon('back'), h('span', { text: 'Explore' }));
  const title = h('h1', { class: 'sa-display sa-page-title', tabindex: '-1', text: 'In 3D' });
  const meta = h('p', { class: 'sa-inf-meta' });
  const status = h('p', { class: 'sa-progress-line', role: 'status' });
  // (round 4, the owner: "a percentage when they are creating the 3d model just like in meshy"): how far along, and about how
  // long is left
  const barBox = h('div', { class: 'sa-model-prog', hidden: true });
  const steps = h('ol', { class: 'sa-steps', hidden: true });
  const madeNote = h('p', { class: 'sa-muted sa-small', hidden: true, text: "It takes about 5 to 10 minutes. You can close this page: it keeps going, and its link shows it when it's ready." });
  const canvas = h('canvas', { class: 'sa-canvas', 'aria-label': 'The model in 3D' });
  const picture = h('img', { class: 'sa-stage-pic', alt: '' });
  const stageNote = h('p', { class: 'sa-stage-note', role: 'status', hidden: true });
  const recPill = h('span', { class: 'sa-rec', 'aria-hidden': 'true', hidden: true });
  const stage = h('div', { class: 'sa-stage', dataset: { state: 'loading' } }, picture, canvas, recPill, stageNote);
  const movebar = h('div', { class: 'sa-movebar', role: 'group', 'aria-label': 'Moves' });
  const log = h('ul', { class: 'sa-log', 'aria-live': 'polite' });
  const sayInput = h('input', { class: 'sa-input', id: 'sa-say', type: 'text', maxlength: 200, autocomplete: 'off', placeholder: 'Type a move: wave, dance, jump…' });
  const hint = h('p', { class: 'sa-muted sa-small' });
  const chat = h('form', { class: 'sa-chat', onsubmit: (e) => { e.preventDefault(); typed(); } },
    h('label', { class: 'sa-sr', for: 'sa-say', text: 'A message for it' }), sayInput, btn('Send', { kind: 'primary', type: 'submit' }));
  const links = h('div', { class: 'sa-row' });
  const tools = h('section', { class: 'sa-stage-tools', hidden: true, 'aria-labelledby': 'sa-tools-h' });
  const moreDl = h('section', { class: 'sa-dl3d', hidden: true, 'aria-labelledby': 'sa-dl3d-h' });
  const side = h('div', { class: 'sa-model-side' },
    h('section', { class: 'sa-model-moves', 'aria-labelledby': 'sa-moves-h' }, h('h2', { class: 'sa-h2', id: 'sa-moves-h' }, icon('play'), h('span', { text: 'Its moves' })),
      movebar, chat, log, hint),
    tools,
    h('section', { class: 'sa-model-files', 'aria-labelledby': 'sa-files-h' }, h('h2', { class: 'sa-h2', id: 'sa-files-h' }, icon('download'), h('span', { text: 'Download and share' })),
      links, moreDl));
  const done = h('section', { class: 'sa-model-done', hidden: true }, stage, side);
  const infLink = h('p', { hidden: true });
  add(root, back, h('header', { class: 'sa-page-head' }, title, meta, infLink), status, barBox, steps, madeNote, done);
  chat.querySelector('button').type = 'submit';

  async function load() {
    if (loading) return;
    loading = true;
    const r = await ctx.getJson(`studio=${encodeURIComponent(id)}`);
    loading = false;
    if (!ctx.alive()) return;
    if (r.status === 404 || r.status === 400) { c = null; draw(); return; }
    if (r.ok) { c = r.data.character; draw(); }
    else if (!c) { say(status, errorText(r.data?.error)); timer = setTimeout(() => ctx.alive() && load(), 15_000); return; }
    clearTimeout(timer);
    if (c && (c.status === 'paid' || c.status === 'making')) timer = setTimeout(() => { if (ctx.alive() && document.visibilityState === 'visible') load(); }, POLL_MS);
  }
  ctx.listen(document, 'visibilitychange', () => { if (document.visibilityState === 'visible' && c && (c.status === 'paid' || c.status === 'making')) load(); });

  function draw() {
    document.title = c ? `${c.name} in 3D · AGI Studio` : 'Not here · AGI Studio';
    title.textContent = c ? `${c.name} in 3D` : "This 3D model isn't here";
    meta.textContent = c ? ['3D model', 'AI-generated', c.done ? `made ${dayText(c.done)}` : null].filter(Boolean).join(' · ') : '';
    if (c?.inf) {
      put(infLink, linkBtn(`Made from ${c.name} in AGI Studio`, ctx.href(`/i/${c.inf}`), { kind: 'quiet', size: 'sm', icon: 'next', dataset: { saLink: '' } }));
      infLink.hidden = false;
      back.href = ctx.href(`/i/${c.inf}`);
      back.lastChild.textContent = c.name;
    }
    const isMaking = c && (c.status === 'paid' || c.status === 'making');
    steps.hidden = !isMaking;
    madeNote.hidden = !isMaking;
    barBox.hidden = !isMaking;
    if (isMaking) {
      // (2026-10-13) a 3D model's own plan, from our server: its steps (its moves described in words add some), and how long
      // each usually takes, for its bar; a character from words: its steps as they always were
      const list = c.inf ? modelStepList(c.plan) : STEPS;
      const step = c.step || (c.inf && Array.isArray(c.plan?.[0]) ? c.plan[0][0] : list[0].step);
      const at = Math.max(0, list.findIndex((s) => s.step === stepGroup(step)));
      put(barBox, progressBar({ key: id, kind: c.inf ? 'model' : 'character', plan: c.inf && Array.isArray(c.plan) ? c.plan : null, step, stepPct: Number.isFinite(c.progress) ? c.progress : null, since: c.started ?? null }));
      put(steps, ...list.map((s, i) => h('li', { class: `sa-step-item${i < at ? ' is-done' : i === at ? ' is-now' : ''}`, ...(i === at ? { 'aria-current': 'step' } : {}) },
        h('span', { class: 'sa-step-dot', 'aria-hidden': 'true' }, i < at ? icon('check') : null), h('span', { text: s.words }),
        i === at && Number.isFinite(c.progress) && c.progress > 0 ? h('span', { class: 'sa-mono', text: ` ${Math.round(c.progress)}%` }) : null)));
      say(status, `${list[at].words}…`);
      madeNote.textContent = c.inf && list.some((s) => s.step === 'motion')
        ? "It takes about 10 to 15 minutes (its own moves add a few). You can close this page: it keeps going, and its link shows it when it's ready."
        : "It takes about 5 to 10 minutes. You can close this page: it keeps going, and its link shows it when it's ready.";
    } else if (!c) {
      say(status, 'It was deleted or taken down, or the link is mistyped.');
    } else if (c.status === 'failed') {
      say(status, `${failText(c.error)}${c.inf ? ' Its credits came back.' : ''}`);
    } else if (c.status === 'quote' || c.status === 'expired') {
      say(status, c.status === 'quote' ? "This one hasn't been paid for yet." : 'This one expired before it was paid for.');
    } else say(status, '');
    done.hidden = c?.status !== 'done';
    if (c?.status === 'done') start();
  }

  // ---------- done: in 3D, its moves, its chat ----------
  async function start() {
    if (started) return;
    started = true;
    const moves = Array.isArray(c.moves) && c.moves.length ? c.moves : MOVE_NAMES;
    picture.src = fileUrl(id, 'webp');
    picture.alt = `${c.name}, as made in 3D`;
    const safe = c.name.replace(/[^\p{L}\p{N}_-]+/gu, '-') || 'model';
    put(links,
      h('a', { class: 'sa-btn sa-btn-ghost', href: fileUrl(id, 'png'), download: `${safe}.png` }, icon('download'), h('span', { text: 'Its picture (PNG)' })),
      h('a', { class: 'sa-btn sa-btn-ghost', href: fileUrl(id, 'glb'), download: `${safe}.glb` }, icon('cube'), h('span', { text: 'Its 3D model (GLB)' })),
      linkBtn('Share on X ↗', share3dUrl(c.name, `${location.origin}${ctx.href(`/3d/${id}`)}`), { kind: 'ghost', icon: 'share', target: '_blank', rel: 'noopener noreferrer' }));
    const playable = moves.filter((m) => m !== 'idle');
    put(movebar, ...playable.map((m) => {
      const b = h('button', { type: 'button', class: 'sa-move', dataset: { move: m }, text: labelOf(m) });
      b.addEventListener('click', () => play(m, null));
      return b;
    }));
    hint.textContent = `Type to ${c.name}: ${playable.slice(0, 6).join(', ')}${playable.length > 6 ? '…' : ''} or anything, and it reacts. Nothing you type leaves this page.`;
    loadDl();
    say(stageNote, 'Loading it in 3D…');
    try {
      const { createViewer } = await import('../viewer.js');
      if (!ctx.alive()) return;
      viewer = await createViewer(canvas, { url: fileUrl(id, 'glb'), moves, onMove: showMove });
      if (!ctx.alive()) { viewer.dispose(); viewer = null; return; }
      stage.dataset.state = 'ready';
      say(stageNote, '');
      buildTools();
    } catch {
      stage.dataset.state = 'picture';
      say(stageNote, "It can't be shown in 3D in this browser: here's its picture.");
    }
  }
  function showMove(move) {
    stage.dataset.move = move;
    for (const b of movebar.children) b.classList.toggle('is-on', b.dataset.move === move);
  }
  function play(move, text) {
    if (st.frozen) setFrozen(false);           // a move asked for: it moves again
    const played = viewer ? viewer.play(move) : false;
    if (text !== null) {
      add(log, h('li', { class: 'sa-log-item' }, h('span', { class: 'sa-log-you', text }), h('span', { class: 'sa-mono sa-muted', text: played ? `▶ ${labelOf(move)}` : stage.dataset.state === 'picture' ? '(its 3D view is off)' : '' })));
      while (log.children.length > 6) log.firstElementChild.remove();
    }
  }
  function typed() {
    const text = sayInput.value.trim().slice(0, 200);
    if (!text) return;
    const moves = viewer?.moves || (Array.isArray(c?.moves) ? c.moves : MOVE_NAMES);
    play(moveIn(text, moves) || reactionFor(moves), text);
    sayInput.value = '';
  }

  // ---------- (2026-10-13) its tools: free, in this browser ----------
  const st = { bg: BACKDROP_DEFAULT, light: LIGHT_DEFAULT, look: LOOK_DEFAULT, spin: false, frozen: false, speed: 1, seconds: CLIP_SECONDS_DEFAULT, clean: false, busy: false };
  let spinB = null, freezeB = null, zoomR = null, capNote = null, capMsg = null, pictureB = null, clipB = null, cancelRec = null;
  const toggle = (label, ic, fn) => {
    const b = btn(label, { kind: 'ghost', size: 'sm', icon: ic, class: 'sa-btn sa-btn-ghost sa-btn-sm sa-toggle' });
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => fn(b.getAttribute('aria-pressed') !== 'true'));
    return b;
  };
  function setSpin(on) {
    st.spin = on;
    spinB?.setAttribute('aria-pressed', String(on));
    viewer?.setSpin(on);
  }
  function setFrozen(on) {
    st.frozen = on;
    freezeB?.setAttribute('aria-pressed', String(on));
    viewer?.setFrozen(on);
  }
  function setBackdrop(key) {
    if (!Object.hasOwn(BACKDROPS, key)) return;
    st.bg = key;
    stage.dataset.bg = key;
    stage.style.setProperty('--sa-stage-bg', backdropCss(key));
  }
  function buildTools() {
    const bg = chips({ legend: 'Background', value: st.bg, swatches: true, cls: 'sa-tool-bg',
      choices: Object.entries(BACKDROPS).map(([k, b]) => [k, b.name, { swatch: backdropCss(k, { checker: 6 }) }]),
      onchange: (k) => setBackdrop(k) });
    const light = chips({ legend: 'Light', value: st.light, choices: Object.entries(LIGHTS), cls: 'sa-tool-light',
      onchange: (k) => { st.light = k; viewer?.setLight(k); } });
    const look = segmented({ legend: 'How it looks', value: st.look, showLegend: true, cls: 'sa-tool-look',
      choices: Object.entries(LOOKS), onchange: (k) => { st.look = k; viewer?.setLook(k); } });
    spinB = toggle('Spin', 'refresh', (on) => setSpin(on));
    freezeB = toggle('Freeze pose', 'pause', (on) => setFrozen(on));
    const speed = segmented({ legend: 'Its moves’ speed', value: String(st.speed), showLegend: true, cls: 'sa-tool-speed',
      choices: SPEEDS.map((s) => [String(s), speedText(s)]), onchange: (v) => { st.speed = Number(v); viewer?.setSpeed(Number(v)); } });
    zoomR = range('Zoom', ZOOM.MIN, { key: 'zoom', min: ZOOM.MIN, max: ZOOM.MAX, step: ZOOM.STEP, text: zoomText, onInput: (v) => viewer?.setZoom(v) });
    const reset = btn('Front view', { kind: 'ghost', size: 'sm', icon: 'refresh' });
    reset.addEventListener('click', () => { viewer?.resetView(); zoomR.set(ZOOM.MIN); });
    const clipLen = segmented({ legend: 'Clip length', value: String(st.seconds), cls: 'sa-tool-clip',
      choices: CLIP_SECONDS.map((s) => [String(s), `${s} s`]), onchange: (v) => { st.seconds = Number(v); } });
    pictureB = btn('Take a picture', { kind: 'primary', size: 'sm', icon: 'camera' });
    clipB = btn('Record a clip', { kind: 'ghost', size: 'sm', icon: 'film' });
    pictureB.addEventListener('click', () => { if (!st.busy) busy(pictureB, 'Getting it ready…', takePicture); });
    clipB.addEventListener('click', () => { if (!st.busy) busy(clipB, 'Recording…', recordClip); });
    capNote = h('p', { class: 'sa-fine' });
    capMsg = h('p', { class: 'sa-fine sa-cap-msg', role: 'status', hidden: true });
    put(tools,
      h('div', { class: 'sa-tools-head' }, h('h2', { class: 'sa-h2', id: 'sa-tools-h' }, icon('sliders'), h('span', { text: 'Studio tools' })),
        h('p', { class: 'sa-fine', text: 'Free, in your browser: nothing you change here is sent anywhere.' })),
      bg.node, light.node, look.node,
      h('div', { class: 'sa-tool-group', role: 'group', 'aria-labelledby': 'sa-motion-l' },
        h('p', { class: 'sa-label', id: 'sa-motion-l', text: 'Motion' }),
        h('div', { class: 'sa-row' }, spinB, freezeB),
        h('p', { class: 'sa-fine', text: `Spin turns it like a turntable: one whole turn every ${SPIN_TURN_S} seconds. Freeze holds its pose for a picture.` })),
      speed.node,
      h('div', { class: 'sa-tool-group' }, zoomR.node, h('div', { class: 'sa-row' }, reset)),
      h('div', { class: 'sa-tool-group sa-tool-capture', role: 'group', 'aria-labelledby': 'sa-cap-l' },
        h('p', { class: 'sa-label', id: 'sa-cap-l', text: 'A picture or a clip of it' }),
        h('div', { class: 'sa-row' }, pictureB),
        h('div', { class: 'sa-cap-clip' }, clipLen.node, clipB),
        capNote, capMsg));
    drawCapNote();
    tools.hidden = false;
  }
  const withMark = () => !st.clean;
  function drawCapNote() {
    if (!capNote) return;
    const need = Number(ctx.info?.cleanAgi) || 0;
    capNote.textContent = st.clean
      ? `Yours come without our watermark: a thank-you for holding ${num(need)}+ $AGI, not an investment. With Clear, a picture keeps a see-through background.`
      : 'Made in your browser, free, with our "Made with AGI Studio · AI-generated" watermark. With Clear, a picture keeps a see-through background; a clip gets Studio’s. Spin on and 10 seconds make one whole turn.';
  }
  let markP = null;
  const markImage = () => (markP ||= new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = MARK_SRC;
  }));
  function save(blob, name) {
    const a = h('a', { href: URL.createObjectURL(blob), download: name, hidden: true });
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 5000);
  }
  const tagged = async (blob, type) => {
    const t = withAiTag(new Uint8Array(await blob.arrayBuffer()));
    return t ? new Blob([t], { type }) : blob;
  };
  // a picture: drawn again at about PICTURE_LONG px on its longest side, its background under it (none with Clear), our mark
  // bottom right as on photos (src/studio/photo-edit.js), a PNG that says inside that it's AI-made
  async function takePicture() {
    say(capMsg, '');
    const mark = withMark() ? await markImage() : null;
    if (!viewer || !ctx.alive()) return;
    let out = null;
    viewer.capture(PICTURE_LONG, (src) => {
      out = document.createElement('canvas');
      out.width = src.width; out.height = src.height;
      const g = out.getContext('2d');
      paintBackdrop(g, st.bg, out.width, out.height);
      g.drawImage(src, 0, 0);
      if (mark) { const at = markPlace(out.width, out.height, mark.naturalWidth, mark.naturalHeight); g.drawImage(mark, at.x, at.y, at.w, at.h); }
    });
    const made = out ? await new Promise((resolve) => out.toBlob(resolve, 'image/png')) : null;
    if (!made) { say(capMsg, "The picture couldn't be made in this browser."); return; }
    save(await tagged(made, 'image/png'), captureName(c.name, 'picture', 'png'));
    ctx.toast(mark ? 'Picture saved, with our "Made with AGI Studio · AI-generated" watermark' : 'Picture saved', 'good');
  }
  // a clip: what the stage shows for st.seconds seconds (its moves, its spin), its background under it (Studio's for Clear),
  // our mark top left as on videos (src/studio/video-edit.js), recorded by the browser (an MP4 that says inside it's AI-made
  // where the browser records MP4s, else a WebM)
  async function recordClip() {
    say(capMsg, '');
    const kind = clipType((t) => globalThis.MediaRecorder?.isTypeSupported?.(t) === true);
    const probe = document.createElement('canvas');
    if (!kind || typeof probe.captureStream !== 'function') { say(capMsg, "This browser can't record a clip of it: Chrome, Edge, Safari or Firefox can."); return; }
    const mark = withMark() ? await markImage() : null;
    if (!viewer || !ctx.alive()) return;
    st.busy = true;
    pictureB.disabled = true;
    const undo = viewer.hires(CLIP_LONG);
    const size = evenFit(canvas.width, canvas.height, CLIP_LONG);
    const out = document.createElement('canvas');
    out.width = size.w; out.height = size.h;
    const g = out.getContext('2d');
    const bg = BACKDROPS[st.bg]?.clear ? CLIP_CLEAR : st.bg;
    const at = mark ? markTopLeft(size.w, size.h, mark.naturalWidth, mark.naturalHeight) : null;
    const frame = (src) => {
      g.clearRect(0, 0, size.w, size.h);
      paintBackdrop(g, bg, size.w, size.h);
      g.drawImage(src, 0, 0, size.w, size.h);
      if (mark) g.drawImage(mark, at.x, at.y, at.w, at.h);
    };
    viewer.capture(CLIP_LONG, frame);
    const off = viewer.onFrame(frame);
    const stream = out.captureStream(CLIP_FPS);
    const parts = [];
    let recorder = null, cancelled = false, tick = null;
    const finish = () => {
      clearTimeout(tick);
      off(); undo();
      for (const t of stream.getTracks()) t.stop();
      st.busy = false;
      pictureB.disabled = false;
      delete stage.dataset.rec;
      recPill.hidden = true;
      cancelRec = null;
    };
    try {
      recorder = new MediaRecorder(stream, { mimeType: kind.mime, videoBitsPerSecond: CLIP_BITS });
    } catch {
      finish();
      say(capMsg, "This browser can't record a clip of it: Chrome, Edge, Safari or Firefox can.");
      return;
    }
    recorder.ondataavailable = (e) => { if (e.data && e.data.size) parts.push(e.data); };
    const stopped = new Promise((resolve) => { recorder.onstop = resolve; recorder.onerror = resolve; });
    stage.dataset.rec = 'on';
    recPill.hidden = false;
    stage.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    say(capMsg, `Recording ${st.seconds} seconds of it…`);
    const t0 = performance.now();
    recorder.start(1000);
    await new Promise((resolve) => {
      cancelRec = () => { cancelled = true; resolve(); };
      const step = () => {
        if (!ctx.alive() || document.visibilityState !== 'visible') { cancelled = true; resolve(); return; }
        const left = st.seconds - (performance.now() - t0) / 1000;
        recPill.textContent = `REC ${Math.max(0, Math.ceil(left))} s`;
        if (left <= 0) { resolve(); return; }
        tick = setTimeout(step, 200);
      };
      step();
    });
    if (recorder.state !== 'inactive') recorder.stop();
    await stopped;
    finish();
    if (!ctx.alive()) return;
    if (cancelled || !parts.length) { say(capMsg, 'The clip stopped: the page was hidden while it recorded. Try again.'); return; }
    let blob = new Blob(parts, { type: kind.mime.split(';')[0] });
    if (kind.ext === 'mp4') blob = await tagged(blob, 'video/mp4');
    save(blob, captureName(c.name, 'clip', kind.ext));
    say(capMsg, '');
    ctx.toast(mark ? `Clip saved (${st.seconds} s), with our "Made with AGI Studio · AI-generated" watermark` : `Clip saved (${st.seconds} s)`, 'good');
  }

  // ---------- (2026-10-13) its maker's extra downloads (the 3D tool's "More downloads"): made a few minutes after it's ready,
  // kept DL_DAYS days; only its maker sees them (our server says so: inf-3d-dl). The same answer says whether its pictures and
  // clips here come without our watermark for it (a holder's, as its photos do).
  const dlMsg = h('p', { class: 'sa-err', role: 'status', hidden: true });
  // Our server is only asked for its maker: its influencer in this wallet's own list (My studio's answer, ctx.me). Anyone
  // else's wallet never asks (it would only hear "not yours"). dlKey: the wallet and level last decided for, so the 'me'
  // event (it comes again whenever credits change) asks once per wallet and level.
  let dlKey = null;
  const keyNow = () => (ctx.session ? `${ctx.session.wallet}|${ctx.session.level}` : null);
  function hideDl() { moreDl.hidden = true; st.clean = false; drawCapNote(); }
  async function loadDl() {
    clearTimeout(dlTimer);
    if (!c?.inf || c.status !== 'done' || !ctx.session) { dlKey = null; hideDl(); return; }
    const list = ctx.me?.influencers;
    // its answer is on its way (a wallet just signed in): the 'me' event asks again
    if (!Array.isArray(list) && !ctx.meError) { dlKey = null; hideDl(); return; }
    dlKey = keyNow();
    // another wallet's (a list of 30 may be cut short: then our server says)
    if (Array.isArray(list) && list.length < 30 && !list.some((i) => i?.id === c.inf)) { hideDl(); return; }
    const r = await ctx.act('inf-3d-dl', { order: id });
    if (!ctx.alive()) return;
    const d = r.data || {};
    if (!r.ok || d.ok !== true) { moreDl.hidden = true; st.clean = false; drawCapNote(); return; }
    st.clean = d.clean === true;
    drawCapNote();
    drawDl(d);
    if ((d.todo || []).length && (d.until === null || d.until > Date.now())) {
      dlTimer = setTimeout(() => { if (ctx.alive() && document.visibilityState === 'visible') loadDl(); }, DL_POLL_MS);
    }
  }
  function drawDl(d) {
    const formats = (d.formats || []).filter((f) => Object.hasOwn(DL_FORMATS, f));
    if (!formats.length) { moreDl.hidden = true; return; }
    const gone = Number.isFinite(d.until) && d.until <= Date.now();
    const rows = formats.map((f) => {
      const F = DL_FORMATS[f];
      let state;
      if (gone) state = null;
      else if ((d.failed || []).includes(f)) state = h('span', { class: 'sa-dl3d-state is-failed', text: "Couldn't be made" });
      else if ((d.done || []).includes(f)) {
        const b = btn('Download', { kind: 'ghost', size: 'sm', icon: 'download' });
        b.setAttribute('aria-label', `Download its ${F.name}`);
        b.addEventListener('click', () => busy(b, 'Getting it…', async () => {
          say(dlMsg, '');
          const r = await ctx.act('inf-3d-dl', { order: id, format: f });
          if (!ctx.alive()) return;
          if (r.ok && r.data?.ok && typeof r.data.url === 'string') { location.assign(r.data.url); return; }
          say(dlMsg, errorText(r.data?.error));
          if (['dl_expired', 'dl_failed', 'dl_wait', 'dl_missing'].includes(r.data?.error)) loadDl();
        }));
        state = b;
      } else state = h('span', { class: 'sa-dl3d-state' }, h('span', { class: 'sa-spin', 'aria-hidden': 'true' }), h('span', { text: 'Being made…' }));
      return h('li', { class: 'sa-dl3d-row' }, h('span', { class: 'sa-dl3d-what' }, h('span', { class: 'sa-dl3d-name', text: F.name }), h('span', { class: 'sa-dl3d-note', text: F.note })), state);
    });
    put(moreDl, h('h3', { class: 'sa-h3', id: 'sa-dl3d-h', text: 'More downloads' }),
      h('p', { class: 'sa-fine', text: gone ? errorText('dl_expired')
        : `Only you see these. ${Number.isFinite(d.until) ? `Kept until ${dayText(d.until)} (${DL_DAYS} days)` : `Kept ${DL_DAYS} days`}: its 3D model and its picture above stay for good.` }),
      gone ? null : h('ul', { class: 'sa-dl3d-list' }, ...rows), dlMsg);
    moreDl.hidden = false;
  }
  // signed out, or another wallet: hidden until its own list says (the 'me' event that follows a new wallet)
  ctx.on('wallet', () => { if (started && keyNow()?.split('|')[0] !== dlKey?.split('|')[0]) { dlKey = null; hideDl(); clearTimeout(dlTimer); } });
  ctx.on('me', () => { if (started && ctx.session && keyNow() !== dlKey) loadDl(); });
  ctx.listen(document, 'visibilitychange', () => { if (document.visibilityState === 'visible' && started && !moreDl.hidden && moreDl.querySelector('.sa-spin')) loadDl(); });

  await load();
  return () => { clearTimeout(timer); clearTimeout(dlTimer); cancelRec?.(); viewer?.dispose?.(); };
}
