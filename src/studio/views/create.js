// AGI Studio: Create an influencer. Two ways (round 2, the owner: "remove the use your face"; photos of real people allowed
// with consent): designed from a few choices, each shown as an example picture (round 2: "show example of the image not just
// text"), or from a photo (theirs, someone's who said OK, or a character of theirs), with a box ticked first. Its words are
// checked on our server (server/inf-words.js), a photo by the AI check as it's uploaded (server/inf-uploads.js), and it
// costs credits (with the holder discounts). A photo of a real person makes a private influencer (never in Explore). Then its
// own page shows its 4 looks being made.
import { h, icon, btn, chips, say, busy, nextId, pic, put, add } from '../ui.js';
import { MODES, INF_STYLES, OPTIONS, WORDS_MAX, NAME_MAX, CONSENT_TEXT, SWATCHES, creditsText, exampleKey, infExample } from '../rules.js';
import { studioText, priceOf, perksText, wordsText, errorText, uploadText, upErrorText, NAMES, num } from '../app-words.js';
import { shrinkPicture, uploadPicture } from '../media.js';
import { unlockSlot } from './shared.js';

const MODE_ICON = { design: 'wand', picture: 'image' };
const MODE_EXAMPLES = { design: ['style-anime', 'style-real', 'style-toon'], picture: ['look-feminine', 'look-androgynous', 'look-masculine'] };
const LOOK_KEYS = ['look', 'age'];                 // its look and age: needed, as pictures
const MORE_KEYS = ['cut', 'skin', 'hair', 'eyes'];  // folded away: its hair style (pictures) and colors (swatches)
const REQUIRED = new Set(['look', 'age']);
const EXTRA_KEYS = ['outfit', 'vibe'];
const pickOne = (list) => list[Math.floor(Math.random() * list.length)];

export async function render(ctx, route, root) {
  document.title = 'Create an influencer · AGI Studio';
  const want = route.q.get('mode');
  const st = { mode: Object.hasOwn(MODES, want) ? want : null, source: null, real: false, preview: null, styleTouched: false, photosTick: null };
  const groups = {};
  // an example picture's address for a choice (the owner makes them once: ?inf-info's examples), or null
  const exampleOf = (option) => (value) => {
    const k = exampleKey(option, value);
    const job = k ? ctx.info?.examples?.[k] : null;
    return job ? infExample(job) : null;
  };

  // ---------- 1: how it starts ----------
  const modeErr = h('p', { class: 'sa-err', role: 'alert', hidden: true });
  const modeRow = h('div', { class: 'sa-mode-pick' });
  const modeName = nextId('mode');
  const fillModes = () => {
    put(modeRow, ...Object.entries(MODES).map(([id, m]) => {
      const inputId = nextId('m');
      const input = h('input', { type: 'radio', class: 'sa-mode-input', name: modeName, id: inputId, value: id, checked: st.mode === id });
      input.addEventListener('change', () => { if (input.checked) setMode(id); });
      const ex = MODE_EXAMPLES[id].map((k) => ctx.info?.examples?.[k]).filter(Boolean);
      return h('span', { class: 'sa-mode-opt' }, input, h('label', { for: inputId, class: `sa-mode sa-mode-${id}` },
        h('span', { class: 'sa-mode-art', 'aria-hidden': 'true' }, ex.length ? ex.slice(0, 3).map((job) => pic(infExample(job), { cls: 'sa-mode-pic' })) : h('span', { class: 'sa-mode-icon' }, icon(MODE_ICON[id]))),
        h('span', { class: 'sa-mode-name', text: m.name }), h('span', { class: 'sa-mode-note', text: m.note })));
    }));
  };
  const modeBox = h('fieldset', { class: 'sa-card sa-step' }, h('legend', { class: 'sa-step-title' }, h('span', { class: 'sa-step-n', text: '1' }), h('span', { text: 'How do you want to start?' })), modeRow, modeErr);

  // ---------- 2: its look (designed), or its photo ----------
  const sourceBox = h('section', { class: 'sa-card sa-step', hidden: true, 'aria-labelledby': 'sa-src-h' });
  const sourceErr = h('p', { class: 'sa-err', role: 'alert', hidden: true });
  const human = h('div', { class: 'sa-human' });

  // ---------- 3: its style, outfit, vibe, words, name ----------
  const styleErr = h('p', { class: 'sa-err', role: 'alert', hidden: true });
  const styleGroup = chips({ legend: 'Style', choices: Object.entries(INF_STYLES), media: true, onchange: () => { st.styleTouched = true; say(styleErr, ''); summary(); } });
  const extra = h('div', { class: 'sa-chip-groups' });
  for (const key of EXTRA_KEYS) {
    groups[key] = chips({ legend: OPTIONS[key].label, choices: [['', 'Any'], ...Object.entries(OPTIONS[key].choices)], value: '', media: true, onchange: summary });
    add(extra, groups[key].node);
  }
  const words = h('textarea', { class: 'sa-input sa-textarea', id: 'sa-words', rows: 3, maxlength: WORDS_MAX, placeholder: 'For example: freckles, round glasses, a little star tattoo on the wrist' });
  const wordsCount = h('span', { class: 'sa-count', 'aria-hidden': 'true', text: `0/${WORDS_MAX}` });
  const wordsErr = h('p', { class: 'sa-err', role: 'alert', hidden: true });
  words.addEventListener('input', () => { wordsCount.textContent = `${[...words.value].length}/${WORDS_MAX}`; say(wordsErr, ''); });
  const name = h('input', { class: 'sa-input', id: 'sa-name', type: 'text', maxlength: NAME_MAX, autocomplete: 'off', placeholder: 'Its name' });
  const nameErr = h('p', { class: 'sa-err', role: 'alert', hidden: true });
  name.addEventListener('input', () => { say(nameErr, ''); summary(); });
  const suggest = btn('Suggest', { kind: 'ghost', size: 'sm', icon: 'wand' });
  suggest.addEventListener('click', () => { name.value = pickOne(NAMES.filter((n) => n !== name.value)); say(nameErr, ''); summary(); });
  const detailsBox = h('section', { class: 'sa-card sa-step', hidden: true, 'aria-labelledby': 'sa-det-h' },
    h('h2', { class: 'sa-step-title', id: 'sa-det-h' }, h('span', { class: 'sa-step-n', text: '3' }), h('span', { text: 'Make it yours' })),
    styleGroup.node, styleErr, extra,
    h('div', { class: 'sa-field' }, h('label', { class: 'sa-label', for: 'sa-words', text: 'Anything else? (optional)' }), words, h('div', { class: 'sa-field-foot' }, wordsErr, wordsCount)),
    h('div', { class: 'sa-field' }, h('label', { class: 'sa-label', for: 'sa-name', text: 'Its name' }), h('div', { class: 'sa-input-row' }, name, suggest), nameErr));

  // ---------- 4: its price, and Create (beside the form on a computer; at its end, and a bar at the bottom, on a phone) ----------
  const picked = h('ul', { class: 'sa-summary' });
  const priceLine = h('p', { class: 'sa-price' });
  const haveLine = h('p', { class: 'sa-muted sa-small' });
  const perks = h('p', { class: 'sa-muted sa-small' });
  const slotNote = h('div', { class: 'sa-note', hidden: true });
  const err = h('p', { class: 'sa-err', role: 'alert', hidden: true });
  const create = btn('Create', { kind: 'primary', size: 'lg', icon: 'spark', class: 'sa-btn sa-btn-primary sa-btn-lg sa-btn-wide' });
  const buy = btn('Buy credits', { kind: 'ghost', size: 'sm', icon: 'bolt' });
  buy.addEventListener('click', () => ctx.buyCredits({ need: price() }));
  const payBox = h('section', { class: 'sa-card sa-step sa-pay-box', hidden: true, 'aria-labelledby': 'sa-pay-h' },
    h('h2', { class: 'sa-step-title', id: 'sa-pay-h' }, h('span', { class: 'sa-step-n', text: '4' }), h('span', { text: 'Create it' })),
    picked, priceLine, h('div', { class: 'sa-row sa-row-between' }, haveLine, buy), perks, slotNote, human, err, create,
    h('p', { class: 'sa-fine', text: "It's made by an AI service: 4 looks to pick from, then its full body (about a minute each). If it can't be made, its credits come back. Adults only, PG-13, never a famous person, a real person only with their OK, never someone else's character." }));
  const barPrice = h('span', { class: 'sa-create-bar-price' });
  const barGo = btn('Create', { kind: 'primary', icon: 'spark' });
  barGo.addEventListener('click', () => submit());
  const bar = h('div', { class: 'sa-create-bar', hidden: true }, barPrice, barGo);
  const price = () => priceOf('influencer', { prices: ctx.me?.prices, level: ctx.level });
  const renderPrice = () => {
    put(priceLine, h('strong', { text: creditsText(price()) }), h('span', { text: ' for its 4 looks and its full body' }));
    create.querySelector('span').textContent = `Create · ${num(price())} credits`;
    barPrice.textContent = `${num(price())} credits`;
    haveLine.textContent = ctx.session ? (ctx.me ? `You have ${creditsText(ctx.credits)}` : 'Checking your credits…') : 'Connect your wallet when you create it.';
    buy.hidden = !ctx.session;
    perks.textContent = perksText(ctx.session ? ctx.level : 1);
    // (round 2) its slots: a wallet's influencers at all (STUDIO_SLOTS, and more unlocked by burning $AGI)
    const slots = ctx.me?.slots;
    const full = slots && slots.max > 0 && slots.used >= slots.max;
    slotNote.hidden = !full;
    if (full) {
      const cost = ctx.info?.burns?.slot;
      const unlock = cost > 0 ? btn(`Unlock one more · burn ${num(cost)} $AGI`, { kind: 'ghost', size: 'sm', icon: 'flame' }) : null;
      unlock?.addEventListener('click', () => unlockSlot(ctx));
      put(slotNote, h('p', { text: `You have ${slots.used} of ${slots.max} influencers: delete one in My studio${cost > 0 ? ', or unlock one more' : ''}.` }), unlock);
    }
  };
  // what's picked so far, in a few words (a computer's side card)
  function summary() {
    const rows = [];
    if (st.mode) rows.push(['Start', MODES[st.mode].name]);
    if (st.mode === 'design') {
      for (const key of LOOK_KEYS) if (groups[key]?.value) rows.push([OPTIONS[key].label, OPTIONS[key].choices[groups[key].value]]);
    } else if (st.mode === 'picture') rows.push(['Photo', st.source ? (st.real ? 'Checked ✓ (private)' : 'Checked ✓') : 'Not added yet']);
    if (styleGroup.value) rows.push(['Style', INF_STYLES[styleGroup.value]]);
    for (const key of EXTRA_KEYS) if (groups[key]?.value) rows.push([OPTIONS[key].label, OPTIONS[key].choices[groups[key].value]]);
    if (name.value.trim()) rows.push(['Name', name.value.trim()]);
    put(picked, ...rows.map(([k, v]) => h('li', null, h('span', { class: 'sa-muted', text: k }), h('strong', { text: v }))));
    picked.hidden = !rows.length;
  }

  const status = h('p', { class: 'sa-banner', role: 'status', hidden: true });
  const showStatus = () => {
    const t = ctx.info ? studioText(ctx.info, { allowed: ctx.me?.allowed !== false }) : ctx.infoFailed ? studioText(null) : '';
    say(status, t);
  };

  add(root,
    h('header', { class: 'sa-page-head' },
      h('h1', { class: 'sa-display sa-page-title', tabindex: '-1', text: 'Create an influencer' }),
      h('p', { class: 'sa-muted', text: 'Pick how to start, make it yours, and see 4 looks in about a minute.' })),
    status,
    h('form', { class: 'sa-create', novalidate: true, onsubmit: (e) => { e.preventDefault(); submit(); } },
      h('div', { class: 'sa-create-main' }, modeBox, sourceBox, detailsBox),
      h('div', { class: 'sa-create-side' }, payBox)),
    bar,
  );
  create.type = 'submit';
  // the example pictures (and the modes' art) as soon as the studio's settings have them
  const showExamples = () => {
    styleGroup.media(exampleOf('style'));
    for (const [key, g] of Object.entries(groups)) if (g.media) g.media(exampleOf(key));
  };
  fillModes();
  renderPrice();
  showStatus();
  showExamples();
  summary();
  ctx.on('me', () => { renderPrice(); showStatus(); });
  ctx.on('wallet', renderPrice);
  ctx.on('info', () => { fillModes(); showStatus(); showExamples(); renderPrice(); if (st.photosTick?.isConnected) st.photosTick.textContent = photosText(); });
  if (st.mode) setMode(st.mode, { keep: true });

  function dropPreview() { if (st.preview) URL.revokeObjectURL(st.preview); st.preview = null; }

  function setMode(mode, { keep = false } = {}) {
    dropPreview();
    st.mode = mode;
    st.source = null;
    st.real = false;
    say(modeErr, '');
    if (!keep || !styleGroup.value) { styleGroup.set(mode === 'picture' ? 'real' : 'anime'); st.styleTouched = false; }
    sourceBox.hidden = false;
    detailsBox.hidden = false;
    payBox.hidden = false;
    bar.hidden = false;
    if (mode === 'design') drawDesign();
    else drawPicture();
    showExamples();
    summary();
    const url = new URL(location.href);
    url.searchParams.set('mode', mode);
    history.replaceState(history.state, '', url.pathname + url.search);
  }

  // ---------- designed: its look in a few taps, each choice a picture ----------
  function drawDesign() {
    const box = h('div', { class: 'sa-chip-groups' });
    const moreBox = h('div', { class: 'sa-chip-groups' });
    const more = h('details', { class: 'sa-more' }, h('summary', null, h('span', { text: 'More details' }), h('span', { class: 'sa-more-note', text: 'hair style, skin, hair color, eyes (optional)' })), moreBox);
    for (const key of [...LOOK_KEYS, ...MORE_KEYS]) {
      const o = OPTIONS[key];
      const need = REQUIRED.has(key);
      const swatch = Object.hasOwn(SWATCHES, key);
      const entries = Object.entries(o.choices).map(([v, label]) => [v, label, swatch ? { swatch: SWATCHES[key][v] } : null]);
      const choices = need ? entries : [['', 'Any', null], ...entries];
      groups[key] = chips({ legend: o.label, choices, value: need ? null : '', media: !swatch, swatches: swatch, onchange: () => { say(sourceErr, ''); summary(); } });
      add(LOOK_KEYS.includes(key) ? box : moreBox, groups[key].node);
    }
    add(box, more);
    const surprise = btn('Surprise me', { kind: 'ghost', size: 'sm', icon: 'wand' });
    surprise.addEventListener('click', () => {
      for (const key of [...LOOK_KEYS, ...MORE_KEYS, ...EXTRA_KEYS]) groups[key].set(pickOne(Object.keys(OPTIONS[key].choices)));
      styleGroup.set(pickOne(Object.keys(INF_STYLES)));
      st.styleTouched = true;
      if (!name.value.trim()) name.value = pickOne(NAMES);
      more.open = true;
      say(sourceErr, '');
      summary();
      ctx.toast('Picked for you: change anything you like', 'good');
    });
    put(sourceBox,
      h('div', { class: 'sa-step-title-row' }, h('h2', { class: 'sa-step-title', id: 'sa-src-h' }, h('span', { class: 'sa-step-n', text: '2' }), h('span', { text: 'Its look' })), surprise),
      h('p', { class: 'sa-muted sa-small', text: 'An adult, made up by the AI from your choices: never a real person.' }),
      box, sourceErr);
  }

  // ---------- from a photo: theirs, someone's who said OK, or a character of theirs (its box ticked first) ----------
  function drawPicture() {
    for (const key of [...LOOK_KEYS, ...MORE_KEYS]) delete groups[key];
    const consentId = nextId('consent');
    const consent = h('input', { type: 'checkbox', id: consentId, class: 'sa-check' });
    const input = h('input', { type: 'file', class: 'sa-file', id: 'sa-pic-file', accept: 'image/jpeg,image/png,image/webp', disabled: true });
    const preview = h('div', { class: 'sa-upload-preview', hidden: true });
    const state = h('p', { class: 'sa-up-state', role: 'status', hidden: true });
    const privNote = h('p', { class: 'sa-badge is-private', hidden: true }, icon('shield'), h('span', { text: 'A photo of a real person: its influencer stays private (never in Explore; only people with its link see it).' }));
    const label = h('label', { class: 'sa-drop is-off', for: 'sa-pic-file' }, icon('upload'), h('span', { class: 'sa-drop-title', text: 'Choose a photo' }),
      h('span', { class: 'sa-drop-note', text: 'JPEG, PNG or WebP: one person or character, clearly an adult' }));
    consent.addEventListener('change', () => {
      input.disabled = !consent.checked;
      label.classList.toggle('is-off', !consent.checked);
      say(sourceErr, '');
    });
    label.addEventListener('click', (e) => {
      if (!consent.checked) { e.preventDefault(); say(sourceErr, 'Tick the box first.'); consent.focus(); }
    });
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      input.value = '';
      if (!file || !consent.checked) return;
      st.source = null;
      st.real = false;
      privNote.hidden = true;
      say(sourceErr, '');
      summary();
      if (!(await ready())) return;
      say(state, 'Getting it ready…');
      const blob = await shrinkPicture(file);
      if (!blob) { say(state, uploadText('picture')); return; }
      dropPreview();
      st.preview = URL.createObjectURL(blob);
      put(preview, h('img', { src: st.preview, alt: 'Your photo', class: 'sa-upload-img' }));
      preview.hidden = false;
      label.querySelector('.sa-drop-title').textContent = 'Choose another photo';
      preview.dataset.state = 'checking';
      say(state, 'Checking it… (a few seconds)');
      const r = await uploadPicture(ctx.act, { blob, consent: consent.checked, human });
      if (!ctx.alive()) return;
      if (r.ok) {
        st.source = r.id;
        st.real = r.real === true;
        privNote.hidden = !st.real;
        preview.dataset.state = 'ok';
        // its style from the photo, unless one was picked already: a photo looks realistic, a drawing like anime
        if (!st.styleTouched) styleGroup.set(st.real ? 'real' : 'anime');
        say(state, "Looks good: it's checked and ready ✓");
        summary();
        return;
      }
      preview.dataset.state = 'refused';
      say(state, upErrorText(r, 'picture'));
    });
    // (what it may be: the studio's settings can arrive after this is drawn, so it's said again then: ctx.on('info') below)
    st.photosTick = h('li', { text: photosText() });
    put(sourceBox,
      h('h2', { class: 'sa-step-title', id: 'sa-src-h' }, h('span', { class: 'sa-step-n', text: '2' }), h('span', { text: 'Its photo' })),
      h('ul', { class: 'sa-ticks' },
        st.photosTick,
        h('li', { text: 'One person or character, clearly an adult. Never a famous person, never someone else\'s character.' }),
        h('li', { text: "A real person's photo makes a private influencer: never in Explore, only people with its link see it. You can delete it, and everything made from it, at any time." })),
      h('div', { class: 'sa-consent' }, consent, h('label', { for: consentId, text: CONSENT_TEXT })),
      input, label, preview, privNote, state, sourceErr);
  }

  // what a photo may be: photos of real people only while the owner allows them (STUDIO_FACES)
  function photosText() {
    return ctx.info && ctx.info.photos === false
      ? 'A drawing, a 3D render or a character of yours (photos of real people are switched off for now).'
      : 'A photo of you, of a friend who said OK, or a character you drew or rendered.';
  }

  // 18+, a wallet, the studio open to it: before an upload or creating it. → true to go on
  async function ready() {
    if (!(await ctx.requireAdult())) return false;
    if (!(await ctx.requireWallet())) return false;
    if (!ctx.me) await ctx.refreshMe();
    if (!ctx.info?.on) { fail(errorText('not_ready')); return false; }
    if (ctx.me && ctx.me.allowed === false) { say(sourceErr, errorText('closed')); fail(errorText('closed')); return false; }
    return true;
  }
  // a "no" for the whole form: under Create, and (when Create is off screen: a phone's bar) a toast too
  function fail(text) {
    say(err, text);
    const r = err.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) ctx.toast(text, 'bad');
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
      say(sourceErr, 'Add your photo first (and wait for its check).');
      sourceBox.querySelector('input')?.focus();
      return;
    }
    if (!styleGroup.value) { say(styleErr, wordsText('style', 'empty')); styleGroup.node.querySelector('input')?.focus(); return; }
    if (!name.value.trim()) { say(nameErr, wordsText('name', 'empty')); name.focus(); return; }
    if (!(await ready())) return;
    if (ctx.credits < price()) {
      await ctx.buyCredits({ need: price() });
      if (ctx.credits < price()) { fail(`It needs ${creditsText(price())}: buy some, then press Create.`); return; }
    }
    await busy(create, 'Creating…', async () => {
      barGo.disabled = true;
      const body = { name: name.value.trim(), mode: st.mode, style: styleGroup.value, settings: settings(), words: words.value.trim(), adult: true,
        ...(st.mode === 'picture' ? { source: st.source } : {}) };
      const r = await ctx.act('inf-start', body, { human });
      barGo.disabled = false;
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
      if (d.error === 'short') { fail(`It needs ${creditsText(price())}, and you have ${creditsText(d.have ?? ctx.credits)}.`); ctx.buyCredits({ need: price() }); return; }
      if (d.error === 'source') { st.source = null; summary(); say(sourceErr, errorText('source')); return; }
      if (d.error === 'no_slot') { ctx.refreshMe(); fail(errorText('no_slot')); return; }
      fail(errorText(d.error));
    });
  }

  return () => { dropPreview(); };
}
