// The AGI GAMES intro first (2026-10-23, like every AGI game): its overlay's styles before the game's, and its key and
// tap listeners before the game's own, so a key or a tap that skips the intro never reaches the game.
import '../intro.js';
import './style.css';
import { createGame, stepGame, chooseUpgrade, DISTRICTS } from './engine.js';
import { createRenderer } from './render.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { readSave, writeSave, recordRun, bestRecord, dailySeed, ACHIEVEMENTS } from './save.js';
import { OPENING, CHAPTERS, CONFRONTATIONS, ENDING } from './story.js';
import { Site } from './site.js';

const root = document.getElementById('vr-root');
root.innerHTML = `
  <div class="vr-shell">
    <canvas class="vr-canvas" aria-label="VLAD RUNNER 2049 combat arena"></canvas>
    <section class="vr-title" data-screen="home" aria-labelledby="vr-title">
      <div class="vr-title-art" aria-hidden="true"></div><div class="vr-title-shade" aria-hidden="true"></div>
      <header class="vr-top"><a href="/games" class="vr-back vr-arcade-link">← ARCADE</a><button class="vr-back" data-do="home" hidden>← BACK</button><div class="vr-top-tools"><button data-do="help" aria-label="How to play">?</button><button data-do="settings" aria-label="Settings">⚙</button><button data-do="fullscreen" aria-label="Enter fullscreen">⛶</button></div></header>
      <div class="vr-home">
        <div class="vr-home-heroes" aria-hidden="true"><img src="/images/vladrunner2049/vlad-portrait.webp" alt=""><img src="/images/vladrunner2049/agi-portrait.webp" alt=""></div>
        <h1 id="vr-title" class="vr-logo"><img src="/images/vladrunner2049/title-logo.webp" alt="VLAD RUNNER 2049"><span class="vr-logo-fallback" aria-hidden="true"><b>VLAD</b><b>RUNNER</b><strong>2049</strong></span></h1>
        <p class="vr-tagline">GOOD MEMORIES. BAD COMPANY.</p>
        <button class="vr-main-play" data-do="play"><span>PLAY</span><i aria-hidden="true">▶</i></button>
        <nav class="vr-menu-links" aria-label="Game menu"><button data-do="help">HOW TO PLAY</button><button data-do="records">YOUR RECORDS</button></nav>
      </div>
      <section class="vr-setup" hidden aria-labelledby="vr-setup-title">
        <h2 id="vr-setup-title">CHOOSE YOUR FIGHT!</h2>
        <div class="vr-characters" role="group" aria-label="Choose your hero or local co-op">
          <button data-character="vlad" class="vr-hero-card vr-card-vlad is-selected" aria-pressed="true"><span class="vr-card-label"><b>VLAD</b><small>HEAVY HITTER</small></span><span class="vr-card-art"><img src="/images/vladrunner2049/vlad-portrait.webp" alt=""></span><span class="vr-card-ability">BIG HITS. BIGGER ATTITUDE.</span><span class="vr-card-check" aria-hidden="true">✓</span></button>
          <button data-character="agi" class="vr-hero-card vr-card-agi" aria-pressed="false"><span class="vr-card-label"><b>AGI-1</b><small>FAST & ELECTRIC</small></span><span class="vr-card-art"><img src="/images/vladrunner2049/agi-portrait.webp" alt=""></span><span class="vr-card-ability">QUICK HANDS. ZERO CHILL.</span><span class="vr-card-check" aria-hidden="true">✓</span></button>
          <button class="vr-hero-card vr-card-duo" data-do="coop" aria-pressed="false"><span class="vr-card-label"><b>LOCAL DUO</b><small>2 PLAYER CHAOS</small></span><span class="vr-card-art"><img src="/images/vladrunner2049/vlad-portrait.webp" alt=""><img src="/images/vladrunner2049/agi-portrait.webp" alt=""></span><span class="vr-card-ability">BRING YOUR PARTNER IN CRIME.</span><span class="vr-card-check" aria-hidden="true">✓</span></button>
        </div>
        <p class="vr-selection-note">Solo play · switch between both heroes with Q.</p>
        <div class="vr-modes" role="group" aria-label="Game mode">
          <button class="is-selected" data-mode="story" aria-pressed="true"><b>STORY</b><small>3 districts. Take the city back.</small></button>
          <button data-mode="endless" aria-pressed="false"><b>ENDLESS</b><small>How long can you last?</small></button>
          <button data-mode="daily" aria-pressed="false"><b>DAILY RUN</b><small>One city. A fresh challenge.</small></button>
        </div>
        <div class="vr-setup-bottom"><details class="vr-run-options"><summary>ASSIST & BEST SCORE</summary><label><input type="checkbox" id="vr-assist"> Story assist <small>Extra health</small></label><span id="vr-best">Personal best · —</span></details><button class="vr-start" data-do="start" disabled><span>LOADING…</span><b aria-hidden="true">➜</b></button></div>
      </section>
      <p class="vr-load-status" aria-live="polite">Preparing art and animation…</p>
    </section>
    <section class="vr-play" hidden aria-label="Game controls and status">
      <header class="vr-hud">
        <div class="vr-player-huds"><div class="vr-player-hud" data-player="0"><span class="vr-face vr-vlad"></span><div><b class="vr-player-name">VLAD</b><progress class="vr-health" aria-label="Player one health" max="150" value="150"></progress><progress class="vr-energy" aria-label="Player one energy" max="100" value="60"></progress><small class="vr-health-text">150 / 150</small></div></div><div class="vr-player-hud" data-player="1" hidden><span class="vr-face vr-agi"></span><div><b class="vr-player-name">AGI-1</b><progress class="vr-health" aria-label="Player two health" max="150" value="150"></progress><progress class="vr-energy" aria-label="Player two energy" max="100" value="60"></progress><small class="vr-health-text">150 / 150</small></div></div></div>
        <div class="vr-hud-center"><span class="vr-district">NEON DOWNPOUR</span><strong class="vr-score">000000</strong><small class="vr-objective">Move right · clear the lockdown</small><progress class="vr-route" aria-label="District progress" max="100" value="0"></progress></div>
        <div class="vr-hud-actions"><button data-do="pause" aria-label="Pause game">Ⅱ</button><button data-do="fullscreen" aria-label="Enter fullscreen">⛶</button></div>
      </header>
      <div class="vr-boss" hidden><span></span><progress aria-label="Boss health" max="100" value="100"></progress></div>
      <div class="vr-combo" hidden><b>0</b><span>HIT COMBO</span><strong>D</strong></div>
      <div class="vr-banner" hidden><small></small><b></b><p></p></div>
      <div class="vr-banter" hidden><b></b><span></span></div>
      <div class="vr-duo"><span>DUO SYNC</span><progress aria-label="Duo attack charge" max="100" value="0"></progress><b>BUILD YOUR COMBO</b></div>
      <div class="vr-controls-bar"><span><kbd>WASD</kbd> MOVE</span><span><kbd>J</kbd> COMBO</span><span><kbd>K</kbd> HEAVY</span><span><kbd>SPACE</kbd> JUMP</span><span><kbd>SHIFT</kbd> DODGE</span><span><kbd>L</kbd> SPECIAL</span><span class="vr-tag-key"><kbd>Q</kbd> SWITCH</span><span><kbd>E</kbd> DUO</span></div>
      <div class="vr-touch"><div class="vr-stick" role="group" aria-label="Movement joystick"><div class="vr-stick-knob"></div></div><div class="vr-touch-actions"><button data-action="tag" aria-label="Switch character">TAG</button><button data-action="duo" aria-label="Duo attack">DUO</button><button data-action="special" aria-label="Special attack">SPECIAL</button><button data-action="dodge" aria-label="Dodge">DODGE</button><button data-action="jump" aria-label="Jump">JUMP</button><button data-action="heavy" aria-label="Heavy attack">HEAVY</button><button data-action="attack" class="vr-touch-hit" aria-label="Attack">HIT</button></div></div>
      <p class="vr-phone-note">Landscape gives you more room to fight.</p>
      <p class="vr-sr" id="vr-live" aria-live="polite"></p>
    </section>
    <section class="vr-story" hidden role="dialog" aria-modal="true" aria-labelledby="vr-story-title" aria-describedby="vr-story-text" tabindex="-1">
      <div class="vr-story-page">
        <header class="vr-story-top"><span class="vr-story-count"></span><button class="vr-story-skip" data-do="story-skip">SKIP SCENE</button></header>
        <div class="vr-story-heading"><p class="vr-story-level"></p><h2 id="vr-story-title"></h2></div>
        <div class="vr-story-scene" aria-busy="false"><img class="vr-story-art" alt="" width="1536" height="1024" decoding="async"><p class="vr-story-loading" role="status" hidden>Loading illustration…</p></div>
        <div class="vr-story-dialogue"><span class="vr-story-speaker vr-sr"></span><p class="vr-story-text" id="vr-story-text" aria-live="polite"></p><p class="vr-story-caption"></p></div>
        <footer class="vr-story-footer"><span class="vr-story-key-hint">SPACE / ENTER TO CONTINUE</span><button class="vr-story-next" data-do="story-next">NEXT <span aria-hidden="true">→</span></button></footer>
      </div>
    </section>
    <div class="vr-modal-wrap" hidden><section class="vr-modal" role="dialog" aria-modal="true" aria-labelledby="vr-modal-title" tabindex="-1"></section></div>
    <div class="vr-toast" role="status" hidden></div>
  </div>`;

const $ = sel => root.querySelector(sel), $$ = sel => [...root.querySelectorAll(sel)];
const title = $('.vr-title'), play = $('.vr-play'), canvas = $('.vr-canvas'), modalWrap = $('.vr-modal-wrap'), modal = $('.vr-modal');
const logo = $('.vr-logo img');
logo.addEventListener('load', () => $('.vr-logo').classList.add('has-art'));
if (logo.complete && logo.naturalWidth) $('.vr-logo').classList.add('has-art');
let storage; try { storage = window.localStorage; } catch { storage = null; }
const save = readSave(storage);
if (!save.runs && window.matchMedia('(prefers-reduced-motion: reduce)').matches) save.settings.reducedMotion = true;
const input = createInput(window), audio = createAudio(), assets = {};
const renderer = createRenderer(canvas, assets, save.settings);
let state = null, mode = 'story', character = 'vlad', coop = false, paused = false, dialogKind = '', assetsReady = false, assetsLoading = false;
let lastTime = 0, hudAt = 0, liveAt = 0, frameId = 0, lastEvent = 0, endRecorded = false, bannerUntil = 0, banterUntil = 0, toastTimer = 0, focusBeforeModal = null;
let destroyed = false, dialogWasPaused = false, currentSeed = '', lastResult = null, titleDay = dailySeed();
let storySequence = null, storyIndex = 0, storyComplete = null, endingShown = false;
let storyArtRequest = 0;
const storyArtCache = new Map();
const fmt = value => Math.round(value).toLocaleString('en-US');
const timeText = seconds => `${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
const el = (tag, cls, value) => { const n = document.createElement(tag); if (cls) n.className = cls; if (value !== undefined) n.textContent = value; return n; };
for(const panel of $$('[data-player]')){const cue=el('span','vr-counter','COUNTER READY');cue.hidden=true;panel.querySelector('div').append(cue);}
const button = (label, action, cls = 'vr-button') => { const n = el('button',cls,label); n.type = 'button'; n.addEventListener('click',action); return n; };
function persist() { return writeSave(storage,save); }
function toast(message) { clearTimeout(toastTimer); $('.vr-toast').textContent = message; $('.vr-toast').hidden = false; toastTimer = setTimeout(() => { $('.vr-toast').hidden = true; },3500); }
function applySettings() {
  renderer.setOptions(save.settings); audio.setOptions({music:save.settings.music,sfx:save.settings.sfx});
  root.classList.toggle('vr-force-touch',save.settings.touch);
  root.classList.toggle('vr-reduced-motion',save.settings.reducedMotion);
}
applySettings();
function updateBest() {
  const difficulty = $('#vr-assist').checked ? 'story' : 'normal';
  const r = bestRecord(save,mode,{seed:dailySeed(),coop,difficulty});
  $('#vr-best').textContent = `${mode === 'daily' ? 'Today’s' : 'Personal'} best · ${r ? fmt(r.score) : '—'}`;
}
async function loadAssets() {
  if(assetsLoading)return;
  assetsLoading=true;
  $('[data-do="start"]').disabled=true;
  $('[data-do="start"] span').textContent='LOADING…';
  $('.vr-load-status').classList.remove('is-ready');
  const names = ['vlad','agi','agiLeft','vladRun','vladCombo','agiRun','agiCombo','agiRunLeft','agiComboLeft','enforcerMotion','neon','orange','spire','enemies','bosses','menuBackdrop','titleLogo','vladPortrait','agiPortrait']; let count = 0;
  const optional = new Set(['menuBackdrop','titleLogo','vladPortrait','agiPortrait']);
  const failed = [];
  await Promise.all(names.map(name => new Promise(resolve => {
    const img = new Image(); let finished = false;
    const done = ok => { if (finished) return; finished = true; clearTimeout(timer); if(ok) assets[name] = img; else if(!optional.has(name)) failed.push(name); count++; $('.vr-load-status').textContent = `Preparing the city · ${count}/${names.length}`; resolve(); };
    const timer = setTimeout(() => done(false),20000);
    img.onload = () => done(true); img.onerror = () => done(false); img.src = `/images/vladrunner2049/${name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}.webp`;
  })));
  await renderer.prepareAssets((done,total) => { $('.vr-load-status').textContent = `Preparing animation · ${done}/${total}`; });
  assetsReady = failed.length === 0;
  assetsLoading = false;
  const start = $('[data-do="start"]'); start.disabled = !assetsReady;
  start.querySelector('span').textContent = assetsReady ? 'LET’S GO!' : 'RELOAD ART';
  if (!assetsReady) { start.disabled = false; $('.vr-load-status').textContent = 'Some art could not load. Tap Reload art to try again.'; }
  else $('.vr-load-status').textContent = 'Ready when you are.';
  $('.vr-load-status').classList.toggle('is-ready',assetsReady);
}
loadAssets(); audio.preload(); updateBest(); preloadStoryArt(OPENING[0]);

function setMode(next) {
  mode = next;
  $$('[data-mode]').forEach(b => { const on = b.dataset.mode === mode; b.classList.toggle('is-selected',on); b.setAttribute('aria-pressed',String(on)); });
  if(mode === 'daily') { coop = false; $('#vr-assist').checked = false; }
  $('[data-do="coop"]').disabled = mode === 'daily'; $('#vr-assist').disabled = mode === 'daily';
  updateTeam(); updateBest();
}
function updateTeam() {
  const n = $('[data-do="coop"]'); n.setAttribute('aria-pressed',String(coop)); n.classList.toggle('is-selected',coop);
  $$('[data-character]').forEach(n=>{const on=!coop&&n.dataset.character===character;n.classList.toggle('is-selected',on);n.setAttribute('aria-pressed',String(on));});
  $('.vr-selection-note').textContent = coop ? 'Two players. One keyboard or two gamepads. Bring a friend!' : mode === 'daily' ? `${dailySeed().slice(6)} · Same city, solo rules. Make it count.` : 'Solo play · switch between both heroes with Q.';
}
function showSetup(){
  $('.vr-home').hidden=true;$('.vr-setup').hidden=false;title.dataset.screen='setup';$('.vr-arcade-link').hidden=true;$('[data-do="home"]').hidden=false;
  updateTeam();updateBest();$('.vr-hero-card.is-selected')?.focus({preventScroll:true});
}
function showHome(){
  $('.vr-home').hidden=false;$('.vr-setup').hidden=true;title.dataset.screen='home';$('.vr-arcade-link').hidden=false;$('[data-do="home"]').hidden=true;
  title.scrollTop=0;$('[data-do="play"]').focus({preventScroll:true});
}
function banner(kicker,headline,description = '',seconds = 3) {
  const n=$('.vr-banner'); n.querySelector('small').textContent=kicker; n.querySelector('b').textContent=headline; n.querySelector('p').textContent=description; n.hidden=false; bannerUntil=(state?.elapsed||0)+seconds;
}
function banter(who,line) { const n=$('.vr-banter'); n.querySelector('b').textContent=who; n.querySelector('span').textContent=line; n.hidden=false; banterUntil=(state?.elapsed||0)+4.5; }
function preloadStoryArt(frame) {
  if(!frame?.art)return Promise.resolve(null);
  const src=`/images/vladrunner2049/${frame.art}`;
  if(storyArtCache.has(src))return storyArtCache.get(src);
  const promise=new Promise(resolve=>{
    const image=new Image();image.decoding='async';image.fetchPriority='low';
    image.onload=async()=>{try{await image.decode?.();}catch{/* A complete image remains usable if explicit decoding is unavailable. */}resolve(src);};
    image.onerror=()=>{storyArtCache.delete(src);resolve(null);};image.src=src;
  });
  storyArtCache.set(src,promise);
  // Retain only a small look-ahead; visited art stays in the browser HTTP cache.
  while(storyArtCache.size>3)storyArtCache.delete(storyArtCache.keys().next().value);
  return promise;
}
function showStoryFrame() {
  const frame = storySequence[storyIndex], panel = $('.vr-story');
  const request=++storyArtRequest,scene=$('.vr-story-scene'),image=$('.vr-story-art'),loading=$('.vr-story-loading');
  panel.dataset.scene=frame.scene;panel.classList.toggle('is-level',Boolean(frame.level));
  $('.vr-story-level').textContent=frame.level||'';
  $('.vr-story-caption').textContent=frame.caption||'';$('.vr-story-speaker').textContent=frame.speaker||'';
  $('#vr-story-title').textContent=frame.title;$('.vr-story-text').textContent=frame.text;
  $('.vr-story-count').textContent=`${storyIndex+1} / ${storySequence.length}`;
  $('[data-do="story-next"]').textContent=frame.button||(storyIndex===storySequence.length-1?'LET’S GO! →':'NEXT →');
  scene.classList.remove('is-ready');scene.setAttribute('aria-busy','true');image.alt=frame.alt||frame.title;
  loading.textContent='Loading illustration…';loading.hidden=false;
  preloadStoryArt(frame).then(src=>{
    if(destroyed||!storySequence||request!==storyArtRequest)return;
    scene.setAttribute('aria-busy','false');
    if(src){image.src=src;scene.classList.add('is-ready');loading.hidden=true;}
    else{image.removeAttribute('src');loading.textContent='Illustration unavailable';}
  });
  preloadStoryArt(storySequence[storyIndex+1]);
}
function beginStory(sequence, complete) {
  storySequence=sequence;storyIndex=0;storyComplete=complete;paused=true;input.setEnabled(false);input.clear();
  title.inert=true;play.inert=true;canvas.inert=true;$('.vr-story').hidden=false;$('.vr-story').classList.remove('is-paused');
  audio.setScene?.('story');audio.setPaused(false);audio.start();showStoryFrame();$('[data-do="story-next"]').focus({preventScroll:true});
}
function finishStory() {
  if(!storySequence)return;
  const complete=storyComplete;storySequence=null;storyComplete=null;storyArtRequest++;$('.vr-story').hidden=true;
  title.inert=false;play.inert=false;canvas.inert=false;input.clear();lastTime=0;complete?.();
}
function nextStory() {if(!storySequence)return;if(++storyIndex>=storySequence.length)finishStory();else showStoryFrame();}
function startRun(sameSeed = false, skipStory = false) {
  if (!assetsReady) { loadAssets(); return; }
  if(mode==='story'&&!sameSeed&&!skipStory){beginStory(OPENING,()=>startRun(false,true));return;}
  closeDialog(false); audio.setPaused(false); audio.start();
  audio.setScene?.('game');
  currentSeed = mode === 'daily' ? dailySeed() : sameSeed && currentSeed ? currentSeed : `${Date.now()}-${crypto.getRandomValues(new Uint32Array(1))[0]}`;
  state = createGame({mode,seed:currentSeed,character,coop,difficulty:$('#vr-assist').checked ? 'story' : 'normal'});
  Site.play(); // counts the run for agi1.app/games (players and plays, never who)
  lastEvent=0; endRecorded=false; lastResult=null; endingShown=false; paused=false; hudAt=0; lastTime=0;
  title.hidden=true; play.hidden=false; root.classList.add('vr-in-game'); root.classList.toggle('vr-coop',coop);
  $('.vr-tag-key').hidden=coop; $('[data-action="tag"]').hidden=coop;
  input.clear(); input.setEnabled(true); canvas.tabIndex=0; canvas.focus({preventScroll:true}); renderer.resize(); updateHUD();
  banner('CASE FILE 01 / 03','NEON DOWNPOUR','Break the checkpoint. Keep the key safe.',3.5);
  banter('AGI-1','Jump onto the street furniture. Smash the supply crates. Keep moving!');
}
function toTitle() {
  closeDialog(false); state=null; paused=false; input.setEnabled(false); input.clear(); title.hidden=false; play.hidden=true;
  root.classList.remove('vr-in-game'); audio.update(null); audio.setScene?.('menu'); audio.setOptions({music:save.settings.music,sfx:save.settings.sfx}); audio.setPaused(false); updateBest(); showHome();
}
function openDialog(kind,heading,kicker='VLAD RUNNER 2049') {
  if (!dialogKind) { focusBeforeModal = document.activeElement; dialogWasPaused=paused; }
  dialogKind=kind; paused=true; audio.setPaused(state?.status==='playing'); input.setEnabled(false); input.clear(); modal.replaceChildren();
  modal.append(el('p','vr-eyebrow',kicker)); const h=el('h2','',heading); h.id='vr-modal-title'; modal.append(h);
  title.inert=true; play.inert=true; canvas.inert=true; modalWrap.hidden=false; modal.focus(); return modal;
}
function closeDialog(resume=true) {
  const wasOpen=Boolean(dialogKind); dialogKind=''; modalWrap.hidden=true; title.inert=false; play.inert=false; canvas.inert=false;
  if(resume) { paused=dialogWasPaused; if(state?.status==='playing') { paused=false; input.setEnabled(true); } audio.setPaused(paused && state?.status==='playing'); }
  input.clear(); resetTouchVisuals(); lastTime=0;
  if(resume && state?.status==='playing')canvas.focus({preventScroll:true});
  else if(wasOpen && focusBeforeModal?.isConnected) focusBeforeModal.focus({preventScroll:true});
}
function dialogClose(label = state ? 'BACK TO THE CITY' : 'BACK') { modal.append(button(label,()=>closeDialog(),'vr-button vr-button-bright')); }
function help() {
  openDialog('help','MAKE SOME NOISE.','FIELD MANUAL / CONTROLS');
  const guide=el('div','vr-move-guide');
  for(const [heading,copy] of [['MOVE','WASD · Line up in the same street lane.'],['COMBO','Hold J · Three hits, one nasty finish.'],['DODGE + JUMP','Shift / Space · Get out, then hit back.']]){
    const card=el('div','vr-move-card'),drawing=el('span','vr-move-drawing');drawing.setAttribute('aria-hidden','true');card.append(el('b','',heading),drawing,el('p','',copy));guide.append(card);
  }
  modal.append(guide);
  modal.append(el('p','vr-dialog-copy','Move up and down the street to line up your hits. Jump onto tables, cargo and platforms, then attack from above. Smash supply crates for pickups. Watch floor vents: jump or leave the marked area before they fire. Hold Combo for a three-hit chain. Heavy and aerial attacks break shields and knock enemies down.'));
  const table=el('table','vr-key-table');
  table.innerHTML='<thead><tr><th>Move</th><th>Player 1</th><th>Player 2</th></tr></thead><tbody><tr><td>Walk</td><td>W A S D</td><td>Arrow keys</td></tr><tr><td>Combo / Heavy</td><td>J / K</td><td>N / M</td></tr><tr><td>Jump / Dodge</td><td>Space / Shift</td><td>. / /</td></tr><tr><td>Special / Duo</td><td>L / E</td><td>, / Enter</td></tr><tr><td>Switch hero</td><td>Q · solo only</td><td>—</td></tr><tr><td>Pause</td><td>Escape / P</td><td>Escape / P</td></tr></tbody>';
  const controls=el('details','vr-all-controls');controls.append(el('summary','','ALL CONTROLS · KEYBOARD & GAMEPAD'),table,el('p','vr-dialog-copy','Solo also supports arrow keys. On a standard gamepad: left stick moves, A jumps, X attacks, Y hits heavy, B dodges, RB uses a special, LB switches, RT unleashes the duo.'));modal.append(controls);
  const tips=el('div','vr-tips'); for(const [a,b] of [['PERFECT DODGE · COUNTER','Dodge just before an attack connects. Gain energy and charge your next attack for 3.5 seconds.'],['TAKE THE HIGH GROUND','Jump onto raised surfaces. Explore the upper route for memory shards; drop into an aerial attack.'],['SPECIAL · 35 ENERGY','A crowd-clearing strike. Energy recovers and fills when you land hits.'],['DUO · 100 SYNC','Build combos to charge a devastating attack from both heroes.'],['CO-OP · STAY TOGETHER','Share the screen. A downed partner returns when you clear the encounter.'],['DAILY · SAME CITY','One UTC seed each day, arcade difficulty and solo play. Records stay on your device.']]) { const n=el('p'); n.append(el('b','',a),el('span','',b)); tips.append(n); } modal.append(tips); dialogClose();
}
function settings() {
  openDialog('settings','YOUR KIND OF CHAOS.','OPTIONS');
  for (const [id,label] of [['music','Music'],['sfx','Sound effects']]) {
    const row=el('label','vr-setting'); row.append(el('span','',label)); const slider=el('input'); slider.type='range'; slider.min=0; slider.max=100; slider.value=save.settings[id]*100; slider.setAttribute('aria-label',label);
    const output=el('output','',`${Math.round(save.settings[id]*100)}%`); slider.addEventListener('input',()=>{save.settings[id]=Number(slider.value)/100;output.textContent=`${slider.value}%`;applySettings();audio.start();persist();}); row.append(slider,output); modal.append(row);
  }
  for(const [id,label] of [['shake','Screen shake'],['reducedMotion','Reduced motion'],['touch','Always show touch controls']]) {
    const row=el('label','vr-setting'); const box=el('input'); box.type='checkbox';box.checked=save.settings[id];box.addEventListener('change',()=>{save.settings[id]=box.checked;applySettings();persist();});row.append(el('span','',label),box);modal.append(row);
  }
  modal.append(el('p','vr-dialog-copy','An original district score, recorded impacts and movement sounds. Audio begins only after you interact. Your choices are saved on this device.')); dialogClose();
}
function records() {
  openDialog('records','LEAVE A MARK.','PERSONAL RECORDS / THIS DEVICE');
  modal.append(el('p','vr-dialog-copy',`${save.runs} completed ${save.runs===1?'run':'runs'} · ${save.achievements.length}/${ACHIEVEMENTS.length} achievements. Showing your eight most recent completed runs. Personal bests are kept separately.`));
  const grid=el('div','vr-achievements'); for(const a of ACHIEVEMENTS) { const won=save.achievements.includes(a.id),n=el('div',won?'is-earned':'');n.append(el('b','',`${won?'◆':'◇'} ${a.name}`),el('small','',a.detail));grid.append(n); } modal.append(grid);
  if(save.records.length) {
    const table=el('table','vr-key-table');table.innerHTML='<thead><tr><th>Run</th><th>Score</th><th>Best combo</th></tr></thead>';const body=el('tbody');for(const r of save.records.slice(0,8)){const tr=el('tr');tr.append(el('td','',`${r.mode.toUpperCase()} · ${r.coop?'2P':'1P'}${r.difficulty==='story'?' · assist':''}${r.won?' · CLEAR':''}`),el('td','',fmt(r.score)),el('td','',`${r.combo} hits`));body.append(tr);}table.append(body);modal.append(table);
  } else modal.append(el('p','vr-empty','Your first run is waiting.'));
  dialogClose();
}
function pauseGame() {
  if(!state || state.status!=='playing' || dialogKind) return;
  openDialog('pause','TAKE A BREATHER.','GAME PAUSED');
  modal.append(el('p','vr-dialog-copy',`${state.district.name} · ${fmt(state.score)} points · ${timeText(state.elapsed)}`));
  const actions=el('div','vr-dialog-actions');actions.append(button('RESUME',()=>closeDialog(),'vr-button vr-button-bright'),button('CONTROLS',help),button('OPTIONS',settings),button('RESTART RUN',()=>startRun(true)),button('BACK TO TITLE',toTitle));modal.append(actions);
}
function upgradeScreen() {
  openDialog('upgrade','UPGRADE. THEN HIT HARDER.',`DISTRICT ${state.stage+1} CLEARED`);
  modal.append(el('p','vr-dialog-copy','Choose one upgrade. It lasts for this run and powers up both heroes.'));
  const cards=el('div','vr-upgrades'); for(const u of state.upgradeChoices) {const n=button('',()=>{
    if(!chooseUpgrade(state,u.id))return;closeDialog();
    const resume=()=>{paused=false;input.clear();input.setEnabled(true);audio.setScene?.('game');audio.setPaused(false);lastTime=0;canvas.focus({preventScroll:true});banner(`CASE FILE 0${state.stage+1} / 03`,state.district.name.toUpperCase(),state.district.subtitle,3.5);};
    if(state.mode==='story'&&CHAPTERS[state.stage])beginStory(CHAPTERS[state.stage],resume);else resume();
  },'vr-upgrade');n.append(el('span','','✦'),el('b','',u.name),el('p','',u.description));cards.append(n);}modal.append(cards);
}
function endScreen() {
  if(endRecorded)return;endRecorded=true;
  const oldBest=bestRecord(save,state.mode,{seed:state.seed,coop:state.coop,difficulty:state.difficulty});
  lastResult=recordRun(save,state);const stored=persist();
  const won=state.status==='victory';openDialog('result',won?'MEMORIES ARE FOREVER.':'ONE MORE RUN?',won?'CITY LIBERATED / CASE CLOSED':'CONNECTION LOST / RUN COMPLETE');
  modal.append(el('p','vr-dialog-copy',won?'The lights come back. The city remembers. For once, you’re in the good part.':'The city got this round. You know its moves now.'));
  const stats=el('div','vr-result-stats'); for(const [name,value] of [['SCORE',fmt(state.score)],['BEST COMBO',`${state.maxCombo} HITS`],['ENFORCERS',fmt(state.stats.kills)],['TIME',timeText(state.elapsed)]]){const cell=el('div');cell.append(el('small','',name),el('b','',value));stats.append(cell);}modal.append(stats);
  if(!oldBest||state.score>oldBest.score)modal.append(el('p','vr-new-best','✦ NEW PERSONAL BEST'));
  if(lastResult.unlocked.length)modal.append(el('p','vr-dialog-copy',`Unlocked: ${lastResult.unlocked.map(id=>ACHIEVEMENTS.find(a=>a.id===id).name).join(' · ')}`));
  const actions=el('div','vr-dialog-actions');actions.append(button('RUN IT BACK',()=>startRun(true),'vr-button vr-button-bright'),button('SAVE SCORE CARD',downloadScoreCard),button('COPY RESULT',copyResult),button('BACK TO TITLE',toTitle));modal.append(actions,el('p','vr-save-note',stored?'Saved on this device. No global leaderboard or prizes.':'Local saving is unavailable. You can still save your score card.'));
}
function resultText() {return `VLAD RUNNER 2049 · ${fmt(state.score)} points · ${state.maxCombo}-hit combo · ${state.mode}${state.coop?' · local co-op':''}${state.difficulty==='story'?' · story assist':''}\nPlay: https://www.agi1.app/games/vladrunner2049`;}
async function copyResult() {try{await navigator.clipboard.writeText(resultText());toast('Result copied.');}catch{toast('Clipboard unavailable. Save the score card instead.');}}
function downloadScoreCard() {
  const c=document.createElement('canvas');c.width=1200;c.height=630;const g=c.getContext('2d');g.fillStyle='#07101e';g.fillRect(0,0,1200,630);
  if(assets.neon) {g.globalAlpha=.4;g.drawImage(assets.neon,0,0,1200,630);g.globalAlpha=1;}
  const shade=g.createLinearGradient(0,0,1200,0);shade.addColorStop(0,'#07101ef5');shade.addColorStop(1,'#07101e70');g.fillStyle=shade;g.fillRect(0,0,1200,630);
  g.fillStyle='#68edee';g.font='700 20px sans-serif';g.fillText('AGI GAMES / PERSONAL RUN',64,66);
  g.font='900 67px sans-serif';g.fillStyle='#fff9e9';g.fillText('VLAD RUNNER',60,160);g.fillStyle='#ff9b50';g.fillText('2049',60,230);
  g.font='900 100px sans-serif';g.fillStyle='#fff9e9';g.fillText(fmt(state.score),60,365);g.font='700 21px sans-serif';g.fillStyle='#b7c3d8';g.fillText(`${state.maxCombo}-HIT COMBO   /   ${timeText(state.elapsed)}   /   ${state.mode.toUpperCase()}${state.coop?' · 2P':''}${state.difficulty==='story'?' · ASSIST':''}`,64,415);
  for(const [i,name] of ['vlad','agi'].entries()) if(assets[name])g.drawImage(assets[name],0,0,384,512,720+i*165,180,225,300);
  g.fillStyle='#68edee';g.font='700 20px sans-serif';g.fillText('agi1.app/games/vladrunner2049',64,570);
  c.toBlob(blob=>{if(!blob){toast('Could not create the score card.');return;}const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='vlad-runner-2049-score.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);},'image/png');
}
async function fullscreen() {try{if(document.fullscreenElement)await document.exitFullscreen();else await root.requestFullscreen();}catch{toast('Fullscreen is unavailable in this browser.');}}

function onRootClick(e){
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.mode){setMode(b.dataset.mode);return;}
  if(b.dataset.character){character=b.dataset.character;coop=false;updateTeam();updateBest();return;}
  const actions={play:showSetup,home:showHome,start:()=>{applySettings();startRun();},'story-next':nextStory,'story-skip':finishStory,help,settings,records,pause:pauseGame,fullscreen,coop:()=>{coop=true;updateTeam();updateBest();}};actions[b.dataset.do]?.();
}
root.addEventListener('click',onRootClick);
$('#vr-assist').addEventListener('change',updateBest);
function onKey(e) {
  if(e.altKey||e.ctrlKey||e.metaKey)return;
  if(storySequence){
    if(e.code==='Tab'){const first=$('[data-do="story-skip"]'),last=$('[data-do="story-next"]');if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}return;}
    if(e.repeat&&['Space','Enter','ArrowRight','Escape'].includes(e.code)){e.preventDefault();return;}
    if(['Space','Enter'].includes(e.code)&&e.target.closest?.('button'))return;
    if(!e.repeat&&['Space','Enter','ArrowRight','Escape'].includes(e.code)){e.preventDefault();if(e.code==='Escape')finishStory();else nextStory();}return;
  }
  if(dialogKind && e.code==='Tab') {const nodes=[...modal.querySelectorAll('button,input,a,summary')].filter(n=>!n.disabled&&n.getClientRects().length);if(!nodes.length){e.preventDefault();return;}if(e.shiftKey&&(document.activeElement===nodes[0]||document.activeElement===modal)){e.preventDefault();nodes.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===nodes.at(-1)){e.preventDefault();nodes[0].focus();}return;}
  if(e.repeat)return;
  const editing=/INPUT|TEXTAREA|SELECT/.test(e.target.tagName);
  if(e.code==='Escape'||(!editing&&e.code==='KeyP')){if(dialogKind && !['upgrade','result'].includes(dialogKind)){e.preventDefault();closeDialog();}else if(state?.status==='playing'&&!dialogKind){e.preventDefault();pauseGame();}else if(!state&&!dialogKind&&title.dataset.screen==='setup'){e.preventDefault();showHome();}}
}
window.addEventListener('keydown',onKey);
function lostFocus() {input.clear();resetTouchVisuals();if(storySequence)$('.vr-story').classList.add('is-paused');else if(state?.status==='playing'&&!dialogKind)pauseGame();audio.setPaused(true);}
window.addEventListener('blur',lostFocus);
function audioFocus(){if(storySequence&&!document.hidden)$('.vr-story').classList.remove('is-paused');audio.setPaused(document.hidden || (!storySequence&&paused&&state?.status==='playing'));}
window.addEventListener('focus',audioFocus);
function visibility(){if(document.hidden)lostFocus();else{audioFocus();if(!state&&titleDay!==dailySeed()){titleDay=dailySeed();updateBest();updateTeam();}}}
document.addEventListener('visibilitychange',visibility);
const touchSets=[];
for(const b of $$('[data-action]')) {
  const active=new Set();touchSets.push(active);const update=()=>input.setTouch(b.dataset.action,active.size>0);
  b.addEventListener('pointerdown',e=>{e.preventDefault();active.add(e.pointerId);b.setPointerCapture(e.pointerId);b.classList.add('is-held');update();});
  const release=e=>{active.delete(e.pointerId);if(!active.size)b.classList.remove('is-held');update();};b.addEventListener('pointerup',release);b.addEventListener('pointercancel',release);b.addEventListener('lostpointercapture',release);
}
const stick=$('.vr-stick'),knob=$('.vr-stick-knob');let stickPointer=null;
function resetTouchVisuals(){touchSets.forEach(s=>s.clear());$$('[data-action]').forEach(b=>b.classList.remove('is-held'));stickPointer=null;input.setStick(0,0);knob.style.transform='translate(0px,0px)';}
function moveStick(e) {if(e.pointerId!==stickPointer)return;const r=stick.getBoundingClientRect(),dx=(e.clientX-r.left-r.width/2)/(r.width*.34),dy=(e.clientY-r.top-r.height/2)/(r.height*.34),len=Math.max(1,Math.hypot(dx,dy));input.setStick(dx/len,dy/len);knob.style.transform=`translate(${dx/len*28}px,${dy/len*28}px)`;}
stick.addEventListener('pointerdown',e=>{if(stickPointer!==null)return;e.preventDefault();stickPointer=e.pointerId;stick.setPointerCapture(e.pointerId);moveStick(e);});stick.addEventListener('pointermove',moveStick);
function stopStick(e){if(e.pointerId!==stickPointer)return;stickPointer=null;input.setStick(0,0);knob.style.transform='translate(0px,0px)';}
stick.addEventListener('pointerup',stopStick);stick.addEventListener('pointercancel',stopStick);stick.addEventListener('lostpointercapture',stopStick);

function updateHUD() {
  if(!state)return;
  $$('[data-player]').forEach((n,i)=>{const p=state.players[i],cue=n.querySelector('.vr-counter');cue.hidden=!p?.counterReady;if(p?.counterReady)cue.textContent=`COUNTER · ${Math.ceil(p.counterTime)}s`;});
  $$('[data-player]').forEach((n,i)=>{const p=state.players[i];n.hidden=!p;if(!p)return;n.querySelector('.vr-player-name').textContent=p.dead?'DOWN · CLEAR TO REVIVE':p.kind==='agi'?'AGI-1':'VLAD';n.querySelector('.vr-face').className=`vr-face vr-${p.kind}`;const hp=n.querySelector('.vr-health'),en=n.querySelector('.vr-energy');hp.max=p.maxHp;hp.value=p.hp;en.max=p.maxEnergy;en.value=p.energy;n.querySelector('.vr-health-text').textContent=`${Math.ceil(p.hp)} / ${p.maxHp}`;});
  $('.vr-district').textContent=state.district.name;$('.vr-score').textContent=String(Math.floor(state.score)).padStart(6,'0');$('.vr-objective').textContent=state.objective;
  $('.vr-route').value=['upgrade','victory'].includes(state.status)?100:Math.min(100,Math.max(...state.players.map(p=>p.x))/(state.district.encounters.at(-1)+160)*100);
  const combo=$('.vr-combo');combo.hidden=state.combo<2;combo.querySelector('b').textContent=state.combo;combo.querySelector('strong').textContent=state.style;
  const duo=$('.vr-duo');duo.querySelector('progress').value=state.duo;duo.classList.toggle('is-ready',state.duo>=100);duo.querySelector('b').textContent=state.duo>=100?'E · UNLEASH DUO':`${Math.floor(state.duo)}% · BUILD YOUR COMBO`;
  const boss=$('.vr-boss');boss.hidden=!state.boss||state.boss.dead;if(!boss.hidden){boss.querySelector('span').textContent=state.boss.name;boss.querySelector('progress').max=state.boss.maxHp;boss.querySelector('progress').value=state.boss.hp;}
  $('[data-action="special"]').classList.toggle('is-ready',state.players[0].energy>=35);$('[data-action="duo"]').classList.toggle('is-ready',state.duo>=100);
}
function readEvents() {
  for(const e of state.events) if(e.id>lastEvent){lastEvent=e.id;
    if(e.type==='boss'){
      const reveal=()=>{paused=false;input.clear();input.setEnabled(true);audio.setScene?.('game');audio.setPaused(false);lastTime=0;canvas.focus({preventScroll:true});banner('PRIORITY TARGET',e.text.toUpperCase(),'Watch the warning. Dodge. Hit back.',2.5);};
      if(state.mode==='story'&&CONFRONTATIONS[state.stage])beginStory(CONFRONTATIONS[state.stage],reveal);else reveal();
    }
    if(e.type==='waveClear')banner(e.noHit?'FLAWLESS ENCOUNTER':'ENCOUNTER COMPLETE','SECTOR CLEAR',`+${fmt(e.amount)} · Move right →`,1.7);
    if(e.type==='duo'){banner('VLAD × AGI-1','DOUBLE EXPOSURE','Some memories hit harder together.',1.6);banter('AGI-1','That one’s going in the highlight reel.');}
    if(e.type==='tag')banter(e.kind==='agi'?'AGI-1':'VLAD',e.kind==='agi'?'My turn. Try to keep up.':'I’ve got a very strong counterargument.');
    if(e.type==='kill'&&state.stats.kills===1)banter('VLAD','Customer support is getting aggressive.');
  }
}
function frame(now) {
  if(destroyed)return;
  const dt=lastTime?Math.min(.1,(now-lastTime)/1000):0;lastTime=now;
  if(state){
    if(!paused&&state.status==='playing'){stepGame(state,input.sample(state.coop),dt);audio.update(state);readEvents();}
    renderer.draw(state,paused?0:dt);
    if(now-hudAt>90){hudAt=now;updateHUD();}
    if(now-liveAt>3000&&!paused){liveAt=now;$('#vr-live').textContent=`${state.district.name}. ${state.objective}. ${Math.ceil(state.players[0].hp)} health. Score ${state.score}.`;}
    if(state.elapsed>=bannerUntil)$('.vr-banner').hidden=true;if(state.elapsed>=banterUntil)$('.vr-banter').hidden=true;
    if(!storySequence&&state.status==='upgrade'&&dialogKind!=='upgrade')upgradeScreen();
    if(!storySequence&&['victory','gameover'].includes(state.status)&&!endRecorded){
      if(state.status==='victory'&&state.mode==='story'&&!endingShown){endingShown=true;beginStory(ENDING,endScreen);}else endScreen();
    }
  }else if(now-liveAt>3000){liveAt=now;if(titleDay!==dailySeed()){titleDay=dailySeed();updateBest();updateTeam();}}
  frameId=requestAnimationFrame(frame);
}
frameId=requestAnimationFrame(frame);
function fullscreenState(){const label=document.fullscreenElement?'Exit fullscreen':'Enter fullscreen';$$('[data-do="fullscreen"]').forEach(n=>n.setAttribute('aria-label',label));renderer.resize();}
document.addEventListener('fullscreenchange',fullscreenState);
function onPageHide(e){if(e.persisted){lostFocus();return;}dispose();}
function dispose(){if(destroyed)return;destroyed=true;cancelAnimationFrame(frameId);clearTimeout(toastTimer);input.destroy();renderer.destroy();audio.destroy();root.removeEventListener('click',onRootClick);window.removeEventListener('keydown',onKey);window.removeEventListener('blur',lostFocus);window.removeEventListener('focus',audioFocus);window.removeEventListener('pagehide',onPageHide);document.removeEventListener('visibilitychange',visibility);document.removeEventListener('fullscreenchange',fullscreenState);}
window.addEventListener('pagehide',onPageHide);
if(import.meta.hot)import.meta.hot.dispose(dispose);
