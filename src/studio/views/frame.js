// AGI Studio (2026-10-11, the owner: "they should have an option to change the profile even after generation and on the
// launch coin an option to pick the current profile or choose from their own images"; the owner's choices: "Its looks and
// photos", "Only how it's shown", "Profile or its photos"): picking one of an influencer's own pictures and framing a square
// in it, by dragging and zooming. Nothing is asked of an AI service: our server cuts the same square (src/studio/rules.js
// FRAME, frameBox: the same numbers whatever size the picture is shown at). Its profile picture is kept that way (its page,
// Explore, My studio, its coin's picture at first); its coin's picture may be its profile picture or one of its photos.
//   framer({ src, frame, start, round }) → the stage to frame a picture in: drag the square (a mouse, a finger, or the arrow
//     keys on it), zoom (pinch, Ctrl + the wheel, the Zoom slider, or + and - on it), with previews of how it will look
//   framedPic(src, frame, { round }) → a small picture showing only that square (its previews, the coin tool's)
//   pickPicture({ title, sub, groups, current, round, save, reset }) → a sheet: its pictures, then the framer; resolves with
//     the choice ({ profile: true } or { job, n, x, y, s, src }), { reset: true }, or null (closed)
import { h, icon, btn, sheet, say, busy, put, nextId } from '../ui.js';
import { FRAME, frameBox, frameFrom, frameStart } from '../rules.js';

// ---------- a small picture showing only its square ----------
// The picture inside a box (sized by its CSS), moved and scaled in percentages, so it never waits for the box's own size: only
// the picture's (once it's loaded). card: a 3:4 box (Explore's and My studio's cards), its square's middle, as they show it.
export function framedPic(src, frame, { round = false, card = false, cls = '', alt = '' } = {}) {
  const img = h('img', { class: 'sa-fpic-img', src, alt, decoding: 'async', draggable: 'false' });
  const box = h('span', { class: `sa-fpic${round ? ' is-round' : ''}${card ? ' is-card' : ''}${cls ? ` ${cls}` : ''}` }, img);
  const a = card ? 4 / 3 : 1;                                // the box's height over its width
  let f = frame;
  const place = () => {
    const W = img.naturalWidth, H = img.naturalHeight;
    if (!W || !H) return;
    const { left, top, side } = frameBox(f, W, H);
    // its square as tall as the box (a card: as tall as the card, its sides cut), in the middle
    img.style.setProperty('width', `${(W / side) * a * 100}%`);
    img.style.setProperty('height', `${(H / side) * 100}%`);
    img.style.setProperty('left', `${((1 - a) / 2) * 100}%`);
    img.style.setProperty('transform', `translate(${(-left / W) * 100}%, ${(-top / H) * 100}%)`);
    box.classList.add('is-placed');
  };
  img.addEventListener('load', place);
  img.addEventListener('error', () => box.classList.add('is-missing'), { once: true });
  if (img.complete) place();
  return { node: box, set(next) { f = next; place(); } };
}

// ---------- the framer ----------
// start: where a picture with no frame of its own starts ('head': a tall full body's head and shoulders; else frameStart: all
// of its shorter side, a tall picture's top, a wide one's middle). round: its square seen as a circle (a coin's picture).
// previews: [{ label, round?, card? }] small pictures of how it will look.
const ZOOM_MAX = Math.round(100_000 / FRAME.MIN);          // the slider in percent: 100 (all of its shorter side) to 500
export function framer({ src, frame = null, start = null, round = false, previews = [], label = 'Its picture' }) {
  const img = h('img', { class: 'sa-framer-img', src, alt: label, decoding: 'async', draggable: 'false' });
  const hintId = nextId('frh');
  const box = h('div', {
    class: `sa-framer-box${round ? ' is-round' : ''}`, tabindex: '0', role: 'group', 'aria-roledescription': 'frame',
    'aria-label': 'The square: drag it, or move it with the arrow keys; + and - zoom', 'aria-describedby': hintId,
  });
  const stage = h('div', { class: 'sa-framer-stage is-loading' }, img, box);
  const zoomId = nextId('frz');
  const zoom = h('input', { class: 'sa-range', id: zoomId, type: 'range', min: '100', max: String(ZOOM_MAX), step: '5', value: '100' });
  const pv = previews.map((p) => ({ ...p, pic: framedPic(src, frame || { x: 0, y: 0, s: 1000 }, { round: p.round, card: p.card }) }));
  const node = h('div', { class: 'sa-framer' },
    stage,
    h('div', { class: 'sa-framer-tools' },
      h('div', { class: 'sa-framer-zoom' }, h('label', { class: 'sa-label', for: zoomId, text: 'Zoom' }), zoom),
      pv.length ? h('div', { class: 'sa-framer-previews' }, ...pv.map((p) => h('figure', { class: 'sa-framer-pv' }, p.pic.node, h('figcaption', { text: p.label })))) : null),
    h('p', { class: 'sa-muted sa-small sa-framer-hint', id: hintId, text: 'Drag the square onto its face. Pinch, or use Zoom, to frame it closer.' }));

  let W = 0, H = 0, sq = null;                              // its picture's own pixels, and the square in them
  let resolveReady;
  const ready = new Promise((r) => { resolveReady = r; });
  const short = () => Math.min(W, H);
  const clamp = (b) => {
    const side = Math.min(short(), Math.max(short() * (FRAME.MIN / 1000), b.side));
    return { side, left: Math.min(Math.max(0, b.left), W - side), top: Math.min(Math.max(0, b.top), H - side) };
  };
  function layout() {
    if (!sq || !img.clientWidth) return;
    const r = img.clientWidth / W;
    for (const [k, v] of [['left', sq.left], ['top', sq.top], ['width', sq.side], ['height', sq.side]]) box.style.setProperty(k, `${v * r}px`);
  }
  function show() {
    layout();
    zoom.value = String(Math.round((short() / sq.side) * 100));
    zoom.setAttribute('aria-valuetext', `${(short() / sq.side).toFixed(1)}×`);
    const f = frameFrom(sq, W, H);
    for (const p of pv) p.pic.set(f);
  }
  const moveTo = (b) => { sq = clamp(b); show(); };
  // a new size around the same middle
  const resize = (side, cx = sq.left + sq.side / 2, cy = sq.top + sq.side / 2) => moveTo({ side, left: cx - side / 2, top: cy - side / 2 });

  img.addEventListener('load', () => {
    W = img.naturalWidth;
    H = img.naturalHeight;
    if (!W || !H) return;
    let first;
    if (frame) first = frameBox(frame, W, H);
    else if (start === 'head' && H > W * 1.2) { const side = W * 0.5; first = { side, left: (W - side) / 2, top: H * 0.035 }; }
    else first = frameBox(frameStart(W, H), W, H);
    sq = clamp(first);
    stage.classList.remove('is-loading');
    show();
    resolveReady(true);
  });
  img.addEventListener('error', () => { stage.classList.add('is-missing'); resolveReady(false); }, { once: true });
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => layout()).observe(img);

  // ---------- a mouse, a finger, two fingers ----------
  const pointers = new Map();
  let drag = null;
  const at = (e) => {
    const r = img.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / Math.max(1, r.width)) * W, y: ((e.clientY - r.top) / Math.max(1, r.height)) * H };
  };
  const startGesture = () => {
    const pts = [...pointers.values()];
    if (pts.length === 1) {
      drag = { mode: 'move', from: pts[0], sq: { ...sq } };
    } else if (pts.length >= 2) {
      const [a, b] = pts;
      drag = { mode: 'pinch', dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, sq: { ...sq }, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
    }
  };
  stage.addEventListener('pointerdown', (e) => {
    if (!sq || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    stage.setPointerCapture?.(e.pointerId);
    const p = at(e);
    pointers.set(e.pointerId, p);
    // a press outside the square brings it there first (its middle under the finger), then it follows
    if (pointers.size === 1 && (p.x < sq.left || p.x > sq.left + sq.side || p.y < sq.top || p.y > sq.top + sq.side)) {
      moveTo({ ...sq, left: p.x - sq.side / 2, top: p.y - sq.side / 2 });
    }
    startGesture();
    box.focus({ preventScroll: true });
  });
  stage.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId) || !drag) return;
    pointers.set(e.pointerId, at(e));
    const pts = [...pointers.values()];
    if (drag.mode === 'move' && pts.length === 1) {
      moveTo({ ...drag.sq, left: drag.sq.left + (pts[0].x - drag.from.x), top: drag.sq.top + (pts[0].y - drag.from.y) });
    } else if (drag.mode === 'pinch' && pts.length >= 2) {
      const [a, b] = pts;
      const k = drag.dist / (Math.hypot(a.x - b.x, a.y - b.y) || 1);
      resize(drag.sq.side * k, drag.sq.left + drag.sq.side / 2, drag.sq.top + drag.sq.side / 2);
    }
  });
  const lift = (e) => {
    if (!pointers.delete(e.pointerId)) return;
    drag = null;
    if (pointers.size) startGesture();
  };
  stage.addEventListener('pointerup', lift);
  stage.addEventListener('pointercancel', lift);
  // a trackpad's pinch (the browser sends it as Ctrl + the wheel); a plain wheel scrolls the sheet as usual
  stage.addEventListener('wheel', (e) => {
    if (!sq || !e.ctrlKey) return;
    e.preventDefault();
    resize(sq.side * Math.exp(Math.max(-0.5, Math.min(0.5, e.deltaY * 0.01))));
  }, { passive: false });
  zoom.addEventListener('input', () => { if (sq) resize(short() * (100 / Math.max(100, Number(zoom.value) || 100))); });
  // ---------- the keyboard, on the square ----------
  box.addEventListener('keydown', (e) => {
    if (!sq) return;
    const step = sq.side * (e.shiftKey ? 0.2 : 0.05);
    const keys = {
      ArrowLeft: () => moveTo({ ...sq, left: sq.left - step }), ArrowRight: () => moveTo({ ...sq, left: sq.left + step }),
      ArrowUp: () => moveTo({ ...sq, top: sq.top - step }), ArrowDown: () => moveTo({ ...sq, top: sq.top + step }),
      '+': () => resize(sq.side * 0.9), '=': () => resize(sq.side * 0.9), '-': () => resize(sq.side / 0.9), _: () => resize(sq.side / 0.9),
    };
    const fn = keys[e.key];
    if (!fn) return;
    e.preventDefault();
    fn();
  });

  return {
    node, ready, box,
    // its frame as our server takes it ({ x, y, s }), or null before its picture has loaded
    value: () => (sq ? frameFrom(sq, W, H) : null),
    get size() { return { w: W, h: H }; },
  };
}

// ---------- picking one of its pictures, then framing it ----------
// groups: [{ label, items: [{ job, n, src (its small copy), big (its picture), label, start? ('head'), profile? (its profile
// picture as it is: picked without a frame) }], empty? (words when it has none) }]. current: what's picked now ({ profile:
// true } or { job, n, x, y, s }). save (optional): async (choice) → true, or the words to show (the sheet stays open while it
// saves); reset (optional): { label, run: async () → true or words } (its picked look again). round: a coin's circle.
export function pickPicture({ title, sub = null, groups, current = null, round = false, save = null, reset = null, saveLabel = 'Use this picture', previews = null }) {
  return new Promise((resolve) => {
    let result = null;
    const s = sheet({ title, sub, size: 'lg', onclose: () => resolve(result) });
    const msg = h('p', { class: 'sa-field-why', role: 'alert', hidden: true });
    const isCurrent = (it) => Boolean(current) && (it.profile ? current.profile === true : current.job === it.job && current.n === it.n);
    const finish = (r) => { result = r; s.close(); };

    function grid() {
      say(msg, '');
      const sections = groups.map((g) => {
        const headId = nextId('ppg');
        const tiles = g.items.map((it) => {
          const b = h('button', { type: 'button', class: `sa-pp-tile${it.start === 'head' ? ' is-tall' : ''}`, 'aria-current': isCurrent(it) ? 'true' : null },
            h('img', { class: 'sa-pp-pic', src: it.src, alt: '', loading: 'lazy', decoding: 'async' }),
            isCurrent(it) ? h('span', { class: 'sa-pp-now' }, icon('check'), h('span', { text: 'Now' })) : null,
            h('span', { class: 'sa-pp-cap', text: it.label }));
          b.addEventListener('click', () => (it.profile ? finish({ profile: true }) : frameStep(it)));
          return b;
        });
        return h('section', { class: 'sa-pp-group', 'aria-labelledby': headId },
          h('h3', { class: 'sa-label', id: headId, text: g.label }),
          tiles.length ? h('div', { class: 'sa-pp-grid' }, ...tiles) : h('p', { class: 'sa-muted sa-small', text: g.empty || 'None yet.' }));
      });
      put(s.body, ...sections, msg);
      if (reset) {
        const r = btn(reset.label, { kind: 'quiet', icon: 'refresh' });
        r.addEventListener('click', () => busy(r, 'Saving…', async () => {
          const ok = await reset.run();
          if (ok === true) finish({ reset: true }); else say(msg, ok);
        }));
        s.setFoot(r);
      } else s.setFoot();
    }

    function frameStep(it) {
      say(msg, '');
      const same = current && !current.profile && current.job === it.job && current.n === it.n;
      const f = framer({
        src: it.big, frame: same ? { x: current.x, y: current.y, s: current.s } : null, start: it.start || null, round,
        previews: previews || (round ? [{ label: 'On its coin', round: true }] : [{ label: 'Its page' }, { label: 'Its card', card: true }]),
        label: it.label,
      });
      put(s.body, f.node, msg);
      const back = btn('Back', { kind: 'ghost', icon: 'back' });
      back.addEventListener('click', grid);
      const use = btn(saveLabel, { kind: 'primary', icon: 'check' });
      use.addEventListener('click', () => busy(use, save ? 'Saving…' : saveLabel, async () => {
        await f.ready;
        const v = f.value();
        if (!v) { say(msg, "That picture didn't load: go back and pick another one."); return; }
        const choice = { job: it.job, n: it.n, ...v, src: it.src };
        if (!save) { finish(choice); return; }
        const ok = await save(choice);
        if (ok === true) finish(choice); else say(msg, ok);
      }));
      s.setFoot(back, use);
      f.ready.then(() => { if (s.dialog.open) f.box.focus({ preventScroll: true }); });
    }

    grid();
  });
}
