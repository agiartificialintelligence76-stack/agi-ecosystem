// AGI Studio: a 3D model's page (studio.agi1.app/3d/<id>, and agi1.app/studio/<id>: the studio's characters, since
// 2026-10-10 made from an influencer's full body). While it's made: its steps (each look moves it along on our server).
// Done: it in 3D (src/studio/viewer.js, three.js, loaded only here), moving when you type a move in its chat box or press
// one; its picture and 3D model to download; Share on X; its influencer.
import { h, icon, btn, linkBtn, say, put, add } from '../ui.js';
import { STEPS, MODEL_STEPS, MOVE_NAMES, fileUrl, moveIn } from '../rules.js';
import { failText, share3dUrl, dayText, errorText, REACTIONS } from '../app-words.js';

const POLL_MS = 5000;

export async function render(ctx, route, root) {
  const id = route.id;
  let c = null, viewer = null, timer = null, started = false, loading = false;
  const back = h('a', { class: 'sa-back', href: ctx.href('/explore'), dataset: { saLink: '' } }, icon('back'), h('span', { text: 'Explore' }));
  const title = h('h1', { class: 'sa-display sa-page-title', tabindex: '-1', text: 'In 3D' });
  const meta = h('p', { class: 'sa-inf-meta' });
  const status = h('p', { class: 'sa-progress-line', role: 'status' });
  const steps = h('ol', { class: 'sa-steps', hidden: true });
  const madeNote = h('p', { class: 'sa-muted sa-small', hidden: true, text: "It takes about 5 to 10 minutes. You can close this page: it keeps going, and its link shows it when it's ready." });
  const canvas = h('canvas', { class: 'sa-canvas', 'aria-label': 'The model in 3D' });
  const picture = h('img', { class: 'sa-stage-pic', alt: '' });
  const stageNote = h('p', { class: 'sa-stage-note', role: 'status', hidden: true });
  const stage = h('div', { class: 'sa-stage', dataset: { state: 'loading' } }, picture, canvas, stageNote);
  const movebar = h('div', { class: 'sa-movebar', role: 'group', 'aria-label': 'Moves' });
  const log = h('ul', { class: 'sa-log', 'aria-live': 'polite' });
  const sayInput = h('input', { class: 'sa-input', id: 'sa-say', type: 'text', maxlength: 200, autocomplete: 'off', placeholder: 'Type a move: wave, dance, jump…' });
  const hint = h('p', { class: 'sa-muted sa-small' });
  const chat = h('form', { class: 'sa-chat', onsubmit: (e) => { e.preventDefault(); typed(); } },
    h('label', { class: 'sa-sr', for: 'sa-say', text: 'A message for it' }), sayInput, btn('Send', { kind: 'primary', type: 'submit' }));
  const links = h('div', { class: 'sa-row' });
  const done = h('section', { class: 'sa-model-done', hidden: true }, stage, movebar, chat, log, hint, links);
  const infLink = h('p', { hidden: true });
  add(root, back, h('header', { class: 'sa-page-head' }, title, meta, infLink), status, steps, madeNote, done);
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
    if (isMaking) {
      const list = c.inf ? MODEL_STEPS : STEPS;
      const at = Math.max(0, list.findIndex((s) => s.step === (c.step || list[0].step)));
      put(steps, ...list.map((s, i) => h('li', { class: `sa-step-item${i < at ? ' is-done' : i === at ? ' is-now' : ''}`, ...(i === at ? { 'aria-current': 'step' } : {}) },
        h('span', { class: 'sa-step-dot', 'aria-hidden': 'true' }, i < at ? icon('check') : null), h('span', { text: s.words }),
        i === at && Number.isFinite(c.progress) && c.progress > 0 ? h('span', { class: 'sa-mono', text: ` ${Math.round(c.progress)}%` }) : null)));
      say(status, `${list[at].words}…`);
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
    put(movebar, ...moves.filter((m) => m !== 'idle').map((m) => {
      const b = h('button', { type: 'button', class: 'sa-move', dataset: { move: m }, text: m });
      b.addEventListener('click', () => play(m, null));
      return b;
    }));
    hint.textContent = `Type to ${c.name}: ${moves.filter((m) => m !== 'idle').join(', ')}… or anything, and it reacts. Nothing you type leaves this page.`;
    say(stageNote, 'Loading it in 3D…');
    try {
      const { createViewer } = await import('../viewer.js');
      if (!ctx.alive()) return;
      viewer = await createViewer(canvas, { url: fileUrl(id, 'glb'), moves, onMove: showMove });
      stage.dataset.state = 'ready';
      say(stageNote, '');
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
    const played = viewer ? viewer.play(move) : false;
    if (text !== null) {
      add(log, h('li', { class: 'sa-log-item' }, h('span', { class: 'sa-log-you', text }), h('span', { class: 'sa-mono sa-muted', text: played ? `▶ ${move}` : stage.dataset.state === 'picture' ? '(its 3D view is off)' : '' })));
      while (log.children.length > 6) log.firstElementChild.remove();
    }
  }
  function typed() {
    const text = sayInput.value.trim().slice(0, 200);
    if (!text) return;
    const moves = viewer?.moves || (Array.isArray(c?.moves) ? c.moves : MOVE_NAMES);
    const move = moveIn(text, moves) || (() => {
      const pick = REACTIONS.filter((m) => moves.includes(m));
      return pick.length ? pick[Math.floor(Math.random() * pick.length)] : 'idle';
    })();
    play(move, text);
    sayInput.value = '';
  }

  await load();
  return () => { clearTimeout(timer); viewer?.dispose?.(); };
}
