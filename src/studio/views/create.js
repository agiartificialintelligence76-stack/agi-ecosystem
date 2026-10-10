// AGI Studio: Create an influencer (the owner's three ways: designed from a few choices, from a picture of a character of
// theirs, or from their own face with a live selfie and their consent). Its words are checked on our server
// (server/inf-words.js), a picture or a selfie by the AI check as it's uploaded (server/inf-uploads.js), and it costs
// credits (with the holder discounts). Then its own page shows its 4 looks being made.
import { h, icon, btn, chips, say, busy, nextId, put, add } from '../ui.js';
import { MODES, INF_STYLES, OPTIONS, WORDS_MAX, NAME_MAX, creditsText } from '../rules.js';
import { studioText, priceOf, perksText, wordsText, errorText, uploadText, upErrorText, NAMES, num } from '../app-words.js';
import { shrinkPicture, openCamera, cameraText, uploadPicture } from '../media.js';

const MODE_ICON = { design: 'wand', picture: 'image', face: 'camera' };
const DESIGN_KEYS = ['look', 'age', 'skin', 'hair', 'cut', 'eyes'];
const REQUIRED = new Set(['look', 'age']);
const EXTRA_KEYS = ['outfit', 'vibe'];
const DEFAULT_STYLE = { design: 'anime', picture: 'anime', face: 'real' };
const pickOne = (list) => list[Math.floor(Math.random() * list.length)];

export async function render(ctx, route, root) {
  document.title = 'Create an influencer · AGI Studio';
  const want = route.q.get('mode');
  const st = { mode: Object.hasOwn(MODES, want) && (want !== 'face' || ctx.info?.faces !== false) ? want : null, source: null, camera: null, shot: null, preview: null };
  const groups = {};

  // ---------- 1: how it starts ----------
  const modeErr = h('p', { class: 'sa-err', role: 'alert', hidden: true });
  const modeRow = h('div', { class: 'sa-mode-pick' });
  const modeName = nextId('mode');
  const fillModes = () => {
    put(modeRow, ...Object.entries(MODES).filter(([id]) => id !== 'face' || ctx.info?.faces !== false).map(([id, m]) => {
      const inputId = nextId('m');
      const input = h('input', { type: 'radio', class: 'sa-mode-input', name: modeName, id: inputId, value: id, checked: st.mode === id });
      input.addEventListener('change', () => { if (input.checked) setMode(id); });
      return h('span', { class: 'sa-mode-opt' }, input, h('label', { for: inputId, class: `sa-mode sa-mode-${id}` },
        h('span', { class: 'sa-mode-icon' }, icon(MODE_ICON[id])), h('span', { class: 'sa-mode-name', text: m.name }), h('span', { class: 'sa-mode-note', text: m.note })));
    }));
  };
  const modeBox = h('fieldset', { class: 'sa-card sa-step' }, h('legend', { class: 'sa-step-title' }, h('span', { class: 'sa-step-n', text: '1' }), h('span', { text: 'How do you want to start?' })), modeRow, modeErr);

  // ---------- 2: its look (designed), its picture, or your selfie ----------
  const sourceBox = h('section', { class: 'sa-card sa-step', hidden: true, 'aria-labelledby': 'sa-src-h' });
  const sourceErr = h('p', { class: 'sa-err', role: 'alert', hidden: true });
  const human = h('div', { class: 'sa-human' });

  // ---------- 3: its style, outfit, vibe, words, name ----------
  const styleGroup = chips({ legend: 'Style', choices: INF_STYLES, onchange: () => say(styleErr, '') });
  const styleErr = h('p', { class: 'sa-err', role: 'alert', hidden: true });
  const extra = h('div', { class: 'sa-chip-groups' });
  for (const key of EXTRA_KEYS) {
    groups[key] = chips({ legend: OPTIONS[key].label, choices: [['', 'Any'], ...Object.entries(OPTIONS[key].choices)], value: '' });
    add(extra, groups[key].node);
  }
  const words = h('textarea', { class: 'sa-input sa-textarea', id: 'sa-words', rows: 3, maxlength: WORDS_MAX, placeholder: 'For example: freckles, round glasses, a little star tattoo on the wrist' });
  const wordsCount = h('span', { class: 'sa-count', 'aria-hidden': 'true', text: `0/${WORDS_MAX}` });
  const wordsErr = h('p', { class: 'sa-err', role: 'alert', hidden: true });
  words.addEventListener('input', () => { wordsCount.textContent = `${[...words.value].length}/${WORDS_MAX}`; say(wordsErr, ''); });
  const name = h('input', { class: 'sa-input', id: 'sa-name', type: 'text', maxlength: NAME_MAX, autocomplete: 'off', placeholder: 'Its name' });
  const nameErr = h('p', { class: 'sa-err', role: 'alert', hidden: true });
  name.addEventListener('input', () => say(nameErr, ''));
  const suggest = btn('Suggest', { kind: 'ghost', size: 'sm', icon: 'wand' });
  suggest.addEventListener('click', () => { name.value = pickOne(NAMES.filter((n) => n !== name.value)); say(nameErr, ''); });
  const detailsBox = h('section', { class: 'sa-card sa-step', hidden: true, 'aria-labelledby': 'sa-det-h' },
    h('h2', { class: 'sa-step-title', id: 'sa-det-h' }, h('span', { class: 'sa-step-n', text: '3' }), h('span', { text: 'Make it yours' })),
    styleGroup.node, styleErr, extra,
    h('div', { class: 'sa-field' }, h('label', { class: 'sa-label', for: 'sa-words', text: 'Anything else? (optional)' }), words, h('div', { class: 'sa-field-foot' }, wordsErr, wordsCount)),
    h('div', { class: 'sa-field' }, h('label', { class: 'sa-label', for: 'sa-name', text: 'Its name' }), h('div', { class: 'sa-input-row' }, name, suggest), nameErr));

  // ---------- 4: its price, and Create ----------
  const priceLine = h('p', { class: 'sa-price' });
  const haveLine = h('p', { class: 'sa-muted sa-small' });
  const perks = h('p', { class: 'sa-muted sa-small' });
  const err = h('p', { class: 'sa-err', role: 'alert', hidden: true });
  const create = btn('Create', { kind: 'primary', size: 'lg', icon: 'spark', class: 'sa-btn sa-btn-primary sa-btn-lg sa-btn-wide' });
  const buy = btn('Buy credits', { kind: 'ghost', size: 'sm', icon: 'bolt' });
  buy.addEventListener('click', () => ctx.buyCredits({ need: price() }));
  const payBox = h('section', { class: 'sa-card sa-step sa-pay-box', hidden: true, 'aria-labelledby': 'sa-pay-h' },
    h('h2', { class: 'sa-step-title', id: 'sa-pay-h' }, h('span', { class: 'sa-step-n', text: '4' }), h('span', { text: 'Create it' })),
    priceLine, h('div', { class: 'sa-row sa-row-between' }, haveLine, buy), perks, human, err, create,
    h('p', { class: 'sa-fine', text: "It's made by an AI service: 4 looks to pick from, then its full body (about a minute each). If it can't be made, its credits come back. Adults only, PG-13, never a real person but your own face, never someone else's character." }));
  const price = () => priceOf('influencer', { prices: ctx.me?.prices, level: ctx.level });
  const renderPrice = () => {
    put(priceLine, h('strong', { text: creditsText(price()) }), h('span', { text: ' for its 4 looks and its full body' }));
    create.querySelector('span').textContent = `Create · ${num(price())} credits`;
    haveLine.textContent = ctx.session ? (ctx.me ? `You have ${creditsText(ctx.credits)}` : 'Checking your credits…') : 'Connect your wallet when you create it.';
    buy.hidden = !ctx.session;
    perks.textContent = perksText(ctx.session ? ctx.level : 1);
  };

  const status = h('p', { class: 'sa-banner', role: 'status', hidden: true });
  const showStatus = () => {
    const t = ctx.info ? studioText(ctx.info, { allowed: ctx.me?.allowed !== false }) : ctx.infoFailed ? studioText(null) : '';
    say(status, t);
  };

  add(root,
    h('header', { class: 'sa-page-head' },
      h('h1', { class: 'sa-h1', tabindex: '-1', text: 'Create an influencer' }),
      h('p', { class: 'sa-muted', text: 'Pick how to start, make it yours, and see 4 looks in about a minute.' })),
    status,
    h('form', { class: 'sa-create', novalidate: true, onsubmit: (e) => { e.preventDefault(); submit(); } }, modeBox, sourceBox, detailsBox, payBox),
  );
  create.type = 'submit';
  fillModes();
  renderPrice();
  showStatus();
  ctx.on('me', () => { renderPrice(); showStatus(); });
  ctx.on('wallet', renderPrice);
  ctx.on('info', () => { fillModes(); showStatus(); });
  if (st.mode) setMode(st.mode, { keep: true });

  // the camera never stays on when they leave
  function stopCamera() { st.camera?.stop(); st.camera = null; }
  function dropPreview() { if (st.preview) URL.revokeObjectURL(st.preview); st.preview = null; }

  function setMode(mode, { keep = false } = {}) {
    stopCamera();
    dropPreview();
    st.mode = mode;
    st.source = null;
    st.shot = null;
    say(modeErr, '');
    if (!keep || !styleGroup.value) styleGroup.set(DEFAULT_STYLE[mode]);
    sourceBox.hidden = false;
    detailsBox.hidden = false;
    payBox.hidden = false;
    if (mode === 'design') drawDesign();
    else if (mode === 'picture') drawPicture();
    else drawFace();
    const url = new URL(location.href);
    url.searchParams.set('mode', mode);
    history.replaceState(history.state, '', url.pathname + url.search);
  }

  // ---------- designed: its look in a few taps ----------
  function drawDesign() {
    // its look and age first (needed); skin, hair and eyes folded away ("Any" until they're picked), so it stays a few taps
    const box = h('div', { class: 'sa-chip-groups' });
    const moreBox = h('div', { class: 'sa-chip-groups' });
    const more = h('details', { class: 'sa-more' }, h('summary', null, h('span', { text: 'More details' }), h('span', { class: 'sa-more-note', text: 'skin, hair, eyes (optional)' })), moreBox);
    for (const key of DESIGN_KEYS) {
      const o = OPTIONS[key];
      const need = REQUIRED.has(key);
      const choices = need ? Object.entries(o.choices) : [['', 'Any'], ...Object.entries(o.choices)];
      groups[key] = chips({ legend: o.label, choices, value: need ? null : '', onchange: () => say(sourceErr, '') });
      add(need ? box : moreBox, groups[key].node);
    }
    add(box, more);
    const surprise = btn('Surprise me', { kind: 'ghost', icon: 'wand' });
    surprise.addEventListener('click', () => {
      for (const key of [...DESIGN_KEYS, ...EXTRA_KEYS]) groups[key].set(pickOne(Object.keys(OPTIONS[key].choices)));
      styleGroup.set(pickOne(Object.keys(INF_STYLES)));
      if (!name.value.trim()) name.value = pickOne(NAMES);
      more.open = true;
      say(sourceErr, '');
      ctx.toast('Picked for you: change anything you like', 'good');
    });
    put(sourceBox,
      h('div', { class: 'sa-step-title-row' }, h('h2', { class: 'sa-step-title', id: 'sa-src-h' }, h('span', { class: 'sa-step-n', text: '2' }), h('span', { text: 'Its look' })), surprise),
      h('p', { class: 'sa-muted sa-small', text: 'An adult, made up by the AI from your choices: never a real person.' }),
      box, sourceErr);
  }

  // ---------- from a picture: a character of theirs ----------
  function drawPicture() {
    for (const key of DESIGN_KEYS) delete groups[key];
    const input = h('input', { type: 'file', class: 'sa-file', id: 'sa-pic-file', accept: 'image/jpeg,image/png,image/webp' });
    const preview = h('div', { class: 'sa-upload-preview', hidden: true });
    const state = h('p', { class: 'sa-up-state', role: 'status', hidden: true });
    const label = h('label', { class: 'sa-drop', for: 'sa-pic-file' }, icon('upload'), h('span', { class: 'sa-drop-title', text: 'Choose a picture' }),
      h('span', { class: 'sa-drop-note', text: 'JPEG, PNG or WebP: a drawing, a 3D render or a character of yours' }));
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      input.value = '';
      if (!file) return;
      st.source = null;
      say(sourceErr, '');
      if (!(await ready())) return;
      say(state, 'Getting it ready…');
      const blob = await shrinkPicture(file);
      if (!blob) { say(state, uploadText('picture')); return; }
      dropPreview();
      st.preview = URL.createObjectURL(blob);
      put(preview, h('img', { src: st.preview, alt: 'Your picture', class: 'sa-upload-img' }));
      preview.hidden = false;
      label.querySelector('.sa-drop-title').textContent = 'Choose another picture';
      preview.dataset.state = 'checking';
      say(state, 'Checking it… (a few seconds)');
      const r = await uploadPicture(ctx.act, { kind: 'picture', blob, human });
      if (!ctx.alive()) return;
      if (r.ok) {
        st.source = r.id;
        preview.dataset.state = 'ok';
        say(state, "Looks good: it's checked and ready ✓");
        return;
      }
      preview.dataset.state = 'refused';
      say(state, upErrorText(r, 'picture'));
    });
    put(sourceBox,
      h('h2', { class: 'sa-step-title', id: 'sa-src-h' }, h('span', { class: 'sa-step-n', text: '2' }), h('span', { text: 'Its picture' })),
      h('p', { class: 'sa-muted sa-small', text: "A character of yours, drawn or rendered, one character, an adult. Never a photo of a real person (that's \"Use my face\", for your own), and never someone else's character." }),
      input, label, preview, state, sourceErr);
  }

  // ---------- your face: a live selfie, with your consent ----------
  function drawFace() {
    for (const key of DESIGN_KEYS) delete groups[key];
    const consentId = nextId('consent');
    const consent = h('input', { type: 'checkbox', id: consentId, class: 'sa-check' });
    const open = btn('Open the camera', { kind: 'primary', icon: 'camera' });
    open.disabled = true;
    consent.addEventListener('change', () => { open.disabled = !consent.checked; say(sourceErr, ''); });
    const video = h('video', { class: 'sa-cam', playsinline: true, muted: true, autoplay: true, 'aria-label': 'Your camera' });
    const snap = btn('Take the selfie', { kind: 'primary', size: 'lg', icon: 'camera' });
    const cancel = btn('Cancel', { kind: 'ghost' });
    const camPanel = h('div', { class: 'sa-cam-panel', hidden: true }, h('div', { class: 'sa-cam-frame' }, video, h('span', { class: 'sa-cam-oval', 'aria-hidden': 'true' })),
      h('p', { class: 'sa-muted sa-small', text: 'Face the camera in good light, just you, no sunglasses.' }), h('div', { class: 'sa-row' }, snap, cancel));
    const shotImg = h('img', { class: 'sa-upload-img sa-selfie', alt: 'Your selfie' });
    const use = btn('Use this selfie', { kind: 'primary', icon: 'check' });
    const retake = btn('Retake', { kind: 'ghost', icon: 'refresh' });
    const shotPanel = h('div', { class: 'sa-upload-preview', hidden: true }, shotImg, h('div', { class: 'sa-row' }, use, retake));
    const state = h('p', { class: 'sa-up-state', role: 'status', hidden: true });

    open.addEventListener('click', async () => {
      if (!consent.checked) return;
      if (!(await ready())) return;
      say(state, '');
      try {
        st.camera = await openCamera(video);
      } catch (e) {
        say(state, cameraText(e.message));
        return;
      }
      if (!ctx.alive()) { stopCamera(); return; }
      camPanel.hidden = false;
      shotPanel.hidden = true;
      open.hidden = true;
      snap.focus();
    });
    cancel.addEventListener('click', () => { stopCamera(); camPanel.hidden = true; open.hidden = false; open.focus(); });
    snap.addEventListener('click', async () => {
      const blob = await st.camera?.snap();
      if (!blob) { say(state, "Couldn't take the picture: try again."); return; }
      stopCamera();
      st.shot = blob;
      dropPreview();
      st.preview = URL.createObjectURL(blob);
      shotImg.src = st.preview;
      camPanel.hidden = true;
      shotPanel.hidden = false;
      shotPanel.dataset.state = '';
      use.hidden = false;
      say(state, 'Happy with it? It goes to our AI check, then makes your AI twin.');
      use.focus();
    });
    retake.addEventListener('click', () => { st.source = null; st.shot = null; shotPanel.hidden = true; open.hidden = false; open.click(); });
    use.addEventListener('click', () => busy(use, 'Checking…', async () => {
      if (!st.shot) return;
      if (!(await ready())) return;
      shotPanel.dataset.state = 'checking';
      say(state, 'Checking it… (a few seconds)');
      const r = await uploadPicture(ctx.act, { kind: 'face', blob: st.shot, consent: true, human });
      if (!ctx.alive()) return;
      if (r.ok) {
        st.source = r.id;
        shotPanel.dataset.state = 'ok';
        use.hidden = true;
        say(state, "Looks good: it's checked and ready ✓");
        return;
      }
      shotPanel.dataset.state = 'refused';
      say(state, upErrorText(r, 'face'));
    }));
    put(sourceBox,
      h('h2', { class: 'sa-step-title', id: 'sa-src-h' }, h('span', { class: 'sa-step-n', text: '2' }), h('span', { text: 'Your selfie' })),
      h('ul', { class: 'sa-ticks' },
        h('li', { text: 'A live selfie from your camera: never an uploaded photo, and only your own face.' }),
        h('li', { text: 'Your AI twin stays private: never in Explore, only people you share its link with see it.' }),
        h('li', { text: '"Delete my face" deletes your selfie and everything made from it, at once.' })),
      h('div', { class: 'sa-consent' }, consent, h('label', { for: consentId, text: "This is my own face, I'm 18 or older, and I agree that my selfie is used to make my AI twin. I can delete it, and everything made from it, at any time." })),
      open, camPanel, shotPanel, state, sourceErr);
  }

  // 18+, a wallet, the studio open to it: before an upload or creating it. → true to go on
  async function ready() {
    if (!(await ctx.requireAdult())) return false;
    if (!(await ctx.requireWallet())) return false;
    if (!ctx.me) await ctx.refreshMe();
    if (!ctx.info?.on) { say(err, errorText('not_ready')); return false; }
    if (ctx.me && ctx.me.allowed === false) { say(sourceErr, errorText('closed')); say(err, errorText('closed')); return false; }
    return true;
  }

  function settings() {
    const out = {};
    for (const [key, g] of Object.entries(groups)) if (OPTIONS[key]?.for.includes(st.mode) && g.value) out[key] = g.value;
    return out;
  }

  async function submit() {
    say(err, '');
    if (!st.mode) { say(modeErr, wordsText('mode', 'empty')); modeRow.querySelector('input')?.focus(); return; }
    if (st.mode === 'design') {
      for (const key of REQUIRED) {
        if (!groups[key]?.value) { say(sourceErr, wordsText(key, 'empty')); groups[key]?.node.querySelector('input')?.focus(); return; }
      }
    } else if (!st.source) {
      say(sourceErr, st.mode === 'face' ? 'Take your selfie first (and wait for its check).' : 'Add your picture first (and wait for its check).');
      sourceBox.querySelector('input, button')?.focus();
      return;
    }
    if (!styleGroup.value) { say(styleErr, wordsText('style', 'empty')); return; }
    if (!name.value.trim()) { say(nameErr, wordsText('name', 'empty')); name.focus(); return; }
    if (!(await ready())) return;
    if (ctx.credits < price()) {
      await ctx.buyCredits({ need: price() });
      if (ctx.credits < price()) { say(err, `It needs ${creditsText(price())}: buy some, then press Create.`); return; }
    }
    await busy(create, 'Creating…', async () => {
      const body = { name: name.value.trim(), mode: st.mode, style: styleGroup.value, settings: settings(), words: words.value.trim(), adult: true,
        ...(st.mode !== 'design' ? { source: st.source } : {}), ...(st.mode === 'face' ? { consent: true } : {}) };
      const r = await ctx.act('inf-start', body, { human });
      if (!ctx.alive()) return;
      const d = r.data || {};
      if (r.ok && d.ok && d.id) {
        ctx.toast('Making its 4 looks: about a minute', 'good');
        ctx.refreshMe();
        ctx.nav(ctx.href(`/i/${d.id}`));
        return;
      }
      if (d.error === 'words') {
        if (d.field === 'name') { say(nameErr, wordsText('name', d.why)); name.focus(); return; }
        if (d.field === 'words') { say(wordsErr, wordsText('words', d.why)); words.focus(); return; }
        if (d.field === 'style') { say(styleErr, wordsText('style', d.why)); return; }
        say(sourceErr, wordsText(d.field, d.why));
        return;
      }
      if (d.error === 'short') { say(err, `It needs ${creditsText(price())}, and you have ${creditsText(d.have ?? ctx.credits)}.`); ctx.buyCredits({ need: price() }); return; }
      if (d.error === 'source') { st.source = null; say(sourceErr, errorText('source')); return; }
      say(err, errorText(d.error));
    });
  }

  return () => { stopCamera(); dropPreview(); };
}
