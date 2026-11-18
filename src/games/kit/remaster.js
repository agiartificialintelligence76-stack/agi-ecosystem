import { fitCanvas } from './canvas.js';
import { createLoop } from './loop.js';
import { rng, Particles, FloatText, Shake } from './fx.js';
import { DEMO, SEED, REDUCED } from './env.js';
import { el } from './shell.js';
import { COLLECTION } from '../collection.js';
import { createDock, makeChoices } from './remaster-controls.js';
import './cartridge.css';
import './remaster.css';

const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];
const isolatedStore = { read: () => ({}), write() {}, update: fn => fn({}) || {}, best: () => null, recordBest: () => ({ best:null, isBest:false }), bump: () => 0 };

export function mountRemaster(id, game, makeShell, cover) {
  const info = COLLECTION.find(entry => entry.id === id);
  const selected = {};
  const choices = makeChoices([{ id:'mode', label:'Mode', values:game.modes }, ...(game.options || [])], selected);
  const root = document.getElementById('ak-root');
  root.classList.add('cartridge', 'remastered');
  root.style.setProperty('--ak-accent', info.accent);
  root.style.setProperty('--ak-bg', info.ground);
  root.dataset.marquee = info.style;
  let model, runSeed, ended, dpr = Math.min(2,window.devicePixelRatio || 1), stopPreview = () => {}, effectHold = 0, slow = 0;
  let runGeneration = 0, canvasPointer = null, lastPoint = null;
  const held = new Set(), shake = new Shake({ max:5 }), words = new FloatText(), sparks = new Particles(75);
  const shell = makeShell({
    root, name:info.name, audioLatency:'interactive', howTo:{ steps:game.instructions, keys:game.keys, touch:game.touch },
    onPause() { release(); model?.pause?.(); },
    onResume() { model?.resume?.(); canvas.focus({ preventScroll:true }); },
    onQuit() { dispose(); queueMicrotask(menu); },
    onRestart:() => start(runSeed),
  });
  const canvas = el('canvas', { tabindex:'0', 'aria-label':info.name + '. ' + game.instructions[0][1] });
  const voice = el('p', { class:'rm-voice', role:'status', 'aria-live':'polite' });
  const field = el('div', 'rm-field', canvas, voice);
  const live = () => !ended && shell.state === 'play';
  const dock = createDock((id,phase,value,stamp) => {
    if (!DEMO && (live() || phase==='up')) model?.action?.(id,phase,value,stamp);
  });
  shell.stage.append(field, dock.node);
  const view = fitCanvas(canvas, { maxDpr:() => dpr });
  const metrics = [shell.chip('Score', 0, { accent:true }), shell.chip('Stage', 1)];
  const labels = metrics.map(m => m.node.querySelector('.ak-chip-label'));
  const storage = DEMO ? isolatedStore : shell.store;
  function release() {
    const stamp = performance.now();
    model?.cancelInput?.();
    for (const code of held) model?.key?.('up', code, stamp);
    held.clear();
    dock.release(stamp);
    if (canvasPointer !== null) {
      const id = canvasPointer;
      canvasPointer = null;
      model?.pointer?.('cancel',lastPoint.x,lastPoint.y,view.w,view.h,stamp);
      if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    }
  }
  function dispose() { release(); runGeneration++; model?.dispose?.(); model = null; stopPreview(); }
  function start(seed) {
    dispose();
    if (!DEMO) shell.audio.unlock();
    runSeed = seed ?? (selected.mode?.includes('daily') ? Number(new Date().toISOString().slice(0,10).replaceAll('-','')) : SEED || randomSeed());
    ended = false;
    voice.textContent = '';
    shake.trauma = effectHold = slow = 0;
    words.clear(); sparks.clear();
    dock.render(game.controls);
    shell.started();
    const { mode, ...options } = selected;
    const generation = runGeneration;
    const current = () => generation === runGeneration && !ended;
    const group = game.scoreGroup?.({mode,options,seed:runSeed}) ??
      (mode?.includes('daily') ? mode+'/'+runSeed : Object.values(selected).join('/'));
    const scoreKey = 'remaster:' + group;
    const say = line => { if (current() && !DEMO && line && voice.textContent !== line) voice.textContent = line; };
    model = game.create({
      seed:runSeed, rng:rng(runSeed).next, mode, options, demo:DEMO, audio:DEMO ? null : shell.audio,
      reducedMotion:REDUCED, store:storage, controls:list => { if (current()) dock.render(list); }, say, announce:say,
      personalBest:key => storage.best(scoreKey + ':' + key),
      rememberBest:(key,value) => { if (current()) return storage.recordBest(scoreKey + ':' + key,value); },
      sound:(...args) => { if (current() && !DEMO) shell.audio.sfx(...args); }, tone:opts => { if (current() && !DEMO) shell.audio.tone(opts); },
      haptic:ms => { if (current() && !DEMO) shell.haptic(ms); },
      effect(kind,label) {
        const big = /clear|chorus|combo|win|perfect|streak|unlock|backspin/.test(kind);
        if (!current() || REDUCED) return;
        const x = view.w * .51, y = view.h * .31;
        if (label) words.add({ x,y,text:label,size:big ? 27 : 18,life:.65,rise:35,font:"900 1em 'AK Display', system-ui" });
        if (big) sparks.burst({ x,y,count:12,life:[.22,.52],speed:[24,115],shape:'star',colors:['#ffdf67','#8dffdc','#fd83c7'] });
        if (big || /fault|miss|wreck/.test(kind)) { shake.kick(big ? .4 : .25); effectHold = .026; }
      },
      hud(a,x,b,y) {
        if (!current()) return;
        for (const [i,name,value] of [[0,a,x],[1,b,y]]) {
          if (metrics[i].node.hidden !== !name) metrics[i].hide(!name);
          if (!name) continue;
          if (labels[i].textContent !== name) labels[i].textContent = name;
          metrics[i].set(value);
        }
      },
      end(score,stats,line) {
        if (!current()) return;
        ended = true;
        model?.pause?.();
        if (DEMO) return;
        const fresh = el('button',{class:'ak-btn ak-btn-sm',type:'button'},mode?.includes('daily') ? 'Back to menu' : 'Fresh run');
        fresh.addEventListener('click',() => mode?.includes('daily') ? menu() : start());
        shell.over({score:Math.round(score),bestKey:scoreKey,stats,line,again:'Replay this run',extra:fresh,onAgain:() => start(runSeed),onMenu:menu});
      },
    });
    if (!DEMO) canvas.focus({ preventScroll:true });
  }
  function menu() {
    dispose();
    const poster = '/images/games/' + id + '.webp';
    const image = el('img', { src:cover || poster, alt:'', decoding:'async' });
    const clip = el('video', { poster, playsinline:true, preload:'none', hidden:true });
    clip.muted = clip.loop = true;
    const preview = el('button', { type:'button',class:'ak-link cartridge-preview','aria-pressed':'false' }, 'Watch gameplay');
    stopPreview = () => { clip.pause(); clip.hidden = true; image.hidden = false; preview.textContent = 'Watch gameplay'; preview.setAttribute('aria-pressed','false'); };
    preview.addEventListener('click',() => {
      if (!clip.hidden) { stopPreview(); return; }
      if (!clip.getAttribute('src')) clip.src = '/images/games/' + id + '.mp4';
      image.hidden = true; clip.hidden = false; preview.textContent = 'Show cover'; preview.setAttribute('aria-pressed','true');
      clip.play().catch(stopPreview);
    });
    const progress = game.progress?.(storage.read());
    shell.title({logo:info.wordmark.map((text,i) => ({text,tone:i ? 'accent' : ''})), tagline:game.tagline,
      art:el('div','cartridge-cover',image,clip), play:info.play, extra:el('div',null,choices,progress ? el('p','ak-fine',progress) : null,preview), onPlay:() => start()});
  }
  for (const phase of ['down','move','up','cancel']) canvas.addEventListener('pointer' + phase,e => {
    if (DEMO || !live() || !e.isPrimary || (canvasPointer!==null && canvasPointer!==e.pointerId) || (phase === 'down' && e.button !== 0)) return;
    const rect = canvas.getBoundingClientRect();
    lastPoint = {x:e.clientX-rect.left,y:e.clientY-rect.top};
    if (phase === 'down') {
      canvasPointer = e.pointerId; canvas.focus({preventScroll:true}); canvas.setPointerCapture(e.pointerId);
    } else if (phase === 'up' || phase === 'cancel') {
      if (canvasPointer!==e.pointerId) return;
      canvasPointer=null;
    }
    model?.pointer?.(phase,lastPoint.x,lastPoint.y,view.w,view.h,e.timeStamp);
  });
  canvas.addEventListener('lostpointercapture',e => {
    if (canvasPointer!==e.pointerId) return;
    canvasPointer=null;
    model?.pointer?.('cancel',lastPoint.x,lastPoint.y,view.w,view.h,e.timeStamp);
  });
  addEventListener('keydown',e => {
    if (!live() || DEMO || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.code === 'Tab' || e.target.closest?.('a,input,select,textarea') || (e.target.closest?.('button') && ['Space','Enter'].includes(e.code))) return;
    if (e.code.startsWith('Arrow') || ['Space','Enter','Backspace'].includes(e.code)) e.preventDefault();
    if (held.has(e.code) || e.repeat) return;
    held.add(e.code); model?.key?.('down',e.code,e.timeStamp);
  });
  addEventListener('keyup',e => { if (held.delete(e.code)) model?.key?.('up',e.code,e.timeStamp); });
  addEventListener('blur',release);
  const loop = createLoop({ maxFrame:.32, paused:() => shell.state !== 'play',
    update(dt) {
      if (ended) { if (DEMO) start(runSeed); return; }
      if (DEMO) model?.demo?.(dt);
      if (!ended) model?.update(dt);
      sparks.update(dt); words.update(dt); shake.update(dt);
    },
    render(_,dt) {
      if (!model || !live()) return;
      slow = Math.max(0,slow + (dt > 1/42 ? 1 : -.3));
      if (slow > 36 && dpr > .75) { dpr = Math.max(.75,dpr - .25); slow = 0; view.resize(); }
      if (effectHold > 0) { effectHold -= dt; return; }
      const ctx = view.begin(); ctx.save(); shake.apply(ctx); model.draw(ctx,view.w,view.h); ctx.restore();
      sparks.draw(ctx); words.draw(ctx);
    } });
  if (DEMO) start(SEED || 7); else menu();
  loop.start();
}
