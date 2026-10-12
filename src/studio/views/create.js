// AGI Studio: Create an influencer. Round 3 (2026-10-10, the owner's "Pro tool layout (Recommended)"): a workspace
// (views/workspace.js). Its controls in the panel on the left: how it starts, its look as picture tiles in sections, its style,
// outfit and vibe, a few words and its name, and a footer that stays with what it costs and Create; on the right, the gallery
// (Trending · Influencers · My creations: views/gallery.js). On a phone, the gallery with the controls sliding up over it.
// Round 2 (the owner: "remove the use your face"; photos of real people allowed with consent): designed from a few choices,
// each shown as an example picture ("show example of the image not just text"), or from a photo (theirs, someone's who said
// OK, or a character of theirs), with a box ticked first. Its words are checked on our server (server/inf-words.js), a photo
// by the AI check as it's uploaded (server/inf-uploads.js), and it costs credits (with the holder discounts). A photo of a real
// person makes a private influencer (never in Explore). Then its own page shows its 4 looks being made.
// (2026-10-11, the owner: "can you make the style optional and please add more styles like , ghiblifi etc. and many more", and
// "if they already have a full body they can skip the first generate so they can save credits or maybe just crop it"): its
// style is optional ("Any style": its words' style, else a photo look; from a picture, the picture's own look), 26 styles in
// four sections; and from a photo, three ways to make it (src/studio/rules.js WAYS): 4 looks to pick from, just its full body,
// or the photo as it is (no AI: only a photo of the whole person, head to feet, which the upload check says).
import { h, btn, chips, segmented, cardPick, say, busy, nextId, put, add, icon } from '../ui.js';
import {
  MODES, STYLE_GROUPS, INF_STYLES, STYLE_ANY, WAYS, WAY_FULL_WHY, OPTIONS, WORDS_MAX, NAME_MAX, CONSENT_TEXT, SWATCHES, creditsText,
  exampleKey, infExample,
} from '../rules.js';
import {
  studioText, priceOf, perksText, wordsText, errorText, uploadText, upErrorText, NAMES, num, STYLE_HINTS, WAY_LINES, wayToast, aboutWay,
  photoReadyText,
} from '../app-words.js';
import { shrinkPicture, uploadPicture } from '../media.js';
import { unlockSlot } from './shared.js';
import { workspace, costLine, goButton } from './workspace.js';
import { gallery } from './gallery.js';

const MODE_ICON = { design: 'wand', picture: 'image' };
const LOOK_KEYS = ['look', 'age'];                 // its look and age: needed, as pictures
const MORE_KEYS = ['cut', 'skin', 'hair', 'eyes'];  // folded away: its hair style (pictures) and colors (swatches)
const REQUIRED = new Set(['look', 'age']);
const EXTRA_KEYS = ['outfit', 'vibe'];
const pickOne = (list) => list[Math.floor(Math.random() * list.length)];
// what each way to start from a photo uses: its style, outfit and words are the AI's (none for the photo as it is), its vibe
// only its 4 looks' (src/studio/rules.js WAYS; server/inf-words.js looksPrompt, bodyPrompt)
const USES = {
  looks: { style: true, outfit: true, vibe: true, words: true },
  body: { style: true, outfit: true, vibe: false, words: true },
  asis: { style: false, outfit: false, vibe: false, words: false },
};

export async function render(ctx, route, root) {
  document.title = 'Create an influencer · AGI Studio';
  const want = route.q.get('mode');
  const st = { mode: Object.hasOwn(MODES, want) ? want : 'design', source: null, real: false, full: false, preview: null, photosTick: null, way: 'looks' };
  const groups = {};
  // an example picture's address for a choice (the owner makes them once: ?inf-info's examples), or null
  const exampleOf = (option) => (value) => {
    const k = exampleKey(option, value);
    const job = k ? ctx.info?.examples?.[k] : null;
    return job ? infExample(job) : null;
  };
  // the way it's made now: from a photo, the one picked; designed, always its 4 looks
  const wayNow = () => (st.mode === 'picture' ? st.way : 'looks');
  const uses = () => USES[wayNow()];

  const ws = workspace(ctx, root, { title: 'Create an influencer', sub: WAY_LINES.looks, titleTag: 'h1', open: true });

  // ---------- how it starts ----------
  const modeNote = h('p', { class: 'sa-ws-hint' });
  const modeSeg = segmented({ legend: 'How do you want to start?', choices: Object.entries(MODES).map(([id, m]) => [id, m.name, MODE_ICON[id]]), value: st.mode, onchange: (v) => setMode(v, { user: true }) });
  // (2026-10-11) data-guide: where its guide's arrows point (src/studio/guide-steps.js)
  const modeBox = h('section', { class: 'sa-ws-sec sa-ws-sec-mode', 'aria-label': 'How it starts', dataset: { guide: 'mode' } }, modeSeg.node, modeNote);

  // ---------- its look (designed), or its photo ----------
  const sourceBox = h('section', { class: 'sa-ws-sec', 'aria-labelledby': 'sa-src-h', dataset: { guide: 'look' } });
  const sourceErr = h('p', { class: 'sa-err', role: 'alert', hidden: true });
  const human = h('div', { class: 'sa-human' });

  // ---------- from a photo: how it's made (4 looks, just its full body, or the photo as it is) ----------
  const wayErr = h('p', { class: 'sa-err', role: 'alert', hidden: true });
  const wayChoices = () => Object.entries(WAYS).map(([value, w]) => ({
    value, name: w.name, note: w.note, price: priceOf(w.price, { prices: ctx.me?.prices, level: ctx.level }),
    off: value === 'asis' && !st.full, why: WAY_FULL_WHY,
  }));
  const wayPick = cardPick({ legend: 'How should it be made?', choices: wayChoices(), value: 'looks', cls: 'sa-cards-list', onchange: (v) => setWay(v) });
  const wayBox = h('section', { class: 'sa-ws-sec sa-ws-sec-way', 'aria-label': 'How it\'s made from your photo', hidden: true, dataset: { guide: 'way' } },
    wayPick.node, wayErr);

  // ---------- its style, outfit, vibe, words, name ----------
  const styleErr = h('p', { class: 'sa-err', role: 'alert', hidden: true });
  // (2026-10-11) its style is optional: "Any style" first, then 26 in four sections (each a tile with its example picture).
  // Every choice in Create can be unpicked again, a tap on it (chips' toggle): back to "Any style"
  const styleGroup = chips({ legend: 'Style', hint: STYLE_HINTS.design, choices: [['', STYLE_ANY]], value: '', media: true, toggle: true,
    sections: STYLE_GROUPS.map((g) => ({ id: g.id, name: g.name, choices: Object.entries(g.styles) })),
    onchange: () => say(styleErr, ''),
  });
  const styleHint = styleGroup.node.querySelector('.sa-hint');
  const styleBox = h('section', { class: 'sa-ws-sec', 'aria-label': 'Style', dataset: { guide: 'style' } }, styleGroup.node, styleErr);
  const extra = h('section', { class: 'sa-ws-sec', 'aria-label': 'Outfit and vibe' });
  for (const key of EXTRA_KEYS) {
    groups[key] = chips({ legend: OPTIONS[key].label, choices: [['', 'Any'], ...Object.entries(OPTIONS[key].choices)], value: '', media: true, toggle: true });
    add(extra, groups[key].node);
  }
  const words = h('textarea', { class: 'sa-input sa-textarea', id: 'sa-words', rows: 3, maxlength: WORDS_MAX, placeholder: 'For example: freckles, round glasses, a little star tattoo on the wrist' });
  const wordsCount = h('span', { class: 'sa-count', 'aria-hidden': 'true', text: `0/${WORDS_MAX}` });
  const wordsErr = h('p', { class: 'sa-err', role: 'alert', hidden: true });
  words.addEventListener('input', () => { wordsCount.textContent = `${[...words.value].length}/${WORDS_MAX}`; say(wordsErr, ''); });
  const name = h('input', { class: 'sa-input', id: 'sa-name', type: 'text', maxlength: NAME_MAX, autocomplete: 'off', placeholder: 'Its name' });
  const nameErr = h('p', { class: 'sa-err', role: 'alert', hidden: true });
  name.addEventListener('input', () => say(nameErr, ''));
  // Enter in its name creates it (like a form's own button)
  name.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); submit(); } });
  const suggest = btn('Suggest', { kind: 'ghost', size: 'sm', icon: 'wand' });
  suggest.addEventListener('click', () => { name.value = pickOne(NAMES.filter((n) => n !== name.value)); say(nameErr, ''); });
  const wordsField = h('div', { class: 'sa-field' }, h('label', { class: 'sa-label', for: 'sa-words', text: 'Anything else? (optional)' }), words, h('div', { class: 'sa-field-foot' }, wordsErr, wordsCount));
  const wordsBox = h('section', { class: 'sa-ws-sec', 'aria-label': 'Words and name' },
    wordsField,
    h('div', { class: 'sa-field', dataset: { guide: 'name' } }, h('label', { class: 'sa-label', for: 'sa-name', text: 'Its name' }), h('div', { class: 'sa-input-row' }, name, suggest), nameErr));
  const perks = h('p', { class: 'sa-fine' });
  const about = h('p', { class: 'sa-fine', text: aboutWay('looks') });
  const aboutBox = h('section', { class: 'sa-ws-sec sa-ws-sec-fine', 'aria-label': 'How it\'s made' }, about, perks);

  // ---------- the footer that stays: what you have, Create with its price ----------
  const status = h('p', { class: 'sa-banner', role: 'status', hidden: true });
  const cost = costLine(ctx);
  const slotNote = h('div', { class: 'sa-note sa-slot-note', hidden: true });
  const err = h('p', { class: 'sa-err', role: 'alert', hidden: true });
  const go = goButton('Create', 'spark');
  go.node.addEventListener('click', () => submit());
  const quick = goButton('Create', 'spark');
  quick.node.className = 'sa-btn sa-btn-primary sa-btn-sm sa-go';
  quick.node.addEventListener('click', () => submit());
  ws.setFoot(cost.node, slotNote, err, human, go.node);
  ws.setQuick(quick.node);
  put(ws.body, status, modeBox, sourceBox, wayBox, styleBox, extra, wordsBox, aboutBox);
  ws.main.append(gallery(ctx, { initial: route.q.get('tab') || 'trending' }).node);

  const price = () => priceOf(WAYS[wayNow()].price, { prices: ctx.me?.prices, level: ctx.level });
  const renderPrice = () => {
    go.setPrice(price());
    quick.setPrice(price());
    cost.need(price());
    ws.setTitle('Create an influencer', `${num(price())} credits · ${WAY_LINES[wayNow()]}`);
    wayPick.update(wayChoices());
    perks.textContent = perksText(ctx.session ? ctx.level : 1);
    // (round 2) its slots: a wallet's influencers at all (STUDIO_SLOTS, and more unlocked by burning $AGI)
    const slots = ctx.me?.slots;
    const full = slots && slots.max > 0 && slots.used >= slots.max;
    slotNote.hidden = !full;
    if (full) {
      const burnCost = ctx.info?.burns?.slot;
      const unlock = burnCost > 0 ? btn(`Unlock one more · burn ${num(burnCost)} $AGI`, { kind: 'ghost', size: 'sm', icon: 'flame' }) : null;
      unlock?.addEventListener('click', () => unlockSlot(ctx));
      put(slotNote, h('p', { text: `You have ${slots.used} of ${slots.max} influencers: delete one in My studio${burnCost > 0 ? ', or unlock one more' : ''}.` }), unlock);
    }
  };
  const showStatus = () => {
    // (round 4, phase 2) a banned wallet makes nothing: said before anything is chosen
    const t = ctx.session && ctx.me?.banned ? errorText('banned')
      : ctx.info ? studioText(ctx.info, { allowed: ctx.me?.allowed !== false }) : ctx.infoFailed ? studioText(null) : '';
    say(status, t);
  };
  // the example pictures as soon as the studio's settings have them
  const showExamples = () => {
    styleGroup.media(exampleOf('style'));
    for (const [key, g] of Object.entries(groups)) if (g.media) g.media(exampleOf(key));
  };
  renderPrice();
  showStatus();
  ctx.on('me', () => { renderPrice(); showStatus(); });
  ctx.on('wallet', renderPrice);
  ctx.on('info', () => { showStatus(); showExamples(); renderPrice(); if (st.photosTick?.isConnected) st.photosTick.textContent = photosText(); });
  setMode(st.mode);
  // (2026-10-11) its guide (the first time this browser opens Create, and with the bar's ? button): a phone's drawer opens for it
  ctx.guide('create', { mode: () => st.mode, way: () => wayNow(), open: () => ws.open(), close: () => ws.close() });

  function dropPreview() { if (st.preview) URL.revokeObjectURL(st.preview); st.preview = null; }

  function setMode(mode, { user = false } = {}) {
    dropPreview();
    st.mode = mode;
    st.source = null;
    st.real = false;
    st.full = false;
    modeSeg.set(mode);
    // (a photo's own section says what it may be: its note would only repeat it)
    say(modeNote, mode === 'picture' ? '' : MODES[mode].note);
    if (styleHint) styleHint.textContent = STYLE_HINTS[mode] || STYLE_HINTS.design;
    if (mode === 'design') drawDesign();
    else drawPicture();
    wayBox.hidden = mode !== 'picture';
    setWay('looks');
    showExamples();
    if (user) {
      const url = new URL(location.href);
      url.searchParams.set('mode', mode);
      history.replaceState(history.state, '', url.pathname + url.search);
    }
  }

  // the way it's made, and what it uses: the photo as it is has no style, outfit, vibe or words (no AI), just its full body no
  // vibe (that's its 4 looks')
  function setWay(way) {
    st.way = Object.hasOwn(WAYS, way) ? way : 'looks';
    if (wayPick.value !== st.way) wayPick.set(st.way);
    say(wayErr, '');
    const u = uses();
    styleBox.hidden = !u.style;
    groups.outfit.node.hidden = !u.outfit;
    groups.vibe.node.hidden = !u.vibe;
    extra.hidden = !u.outfit && !u.vibe;
    wordsField.hidden = !u.words;
    about.textContent = aboutWay(wayNow());
    renderPrice();
  }

  // ---------- designed: its look in a few taps, each choice a picture ----------
  function drawDesign() {
    const box = h('div', { class: 'sa-chip-groups' });
    const moreBox = h('div', { class: 'sa-chip-groups' });
    const more = h('details', { class: 'sa-more' }, h('summary', null, h('span', { text: 'More details' }), h('span', { class: 'sa-more-note', text: 'hair style, skin, hair color, eyes' })), moreBox);
    for (const key of [...LOOK_KEYS, ...MORE_KEYS]) {
      const o = OPTIONS[key];
      const need = REQUIRED.has(key);
      const swatch = Object.hasOwn(SWATCHES, key);
      const entries = Object.entries(o.choices).map(([v, label]) => [v, label, swatch ? { swatch: SWATCHES[key][v] } : null]);
      const choices = need ? entries : [['', 'Any', null], ...entries];
      groups[key] = chips({ legend: o.label, choices, value: need ? null : '', media: !swatch, swatches: swatch, toggle: true, onchange: () => say(sourceErr, '') });
      add(LOOK_KEYS.includes(key) ? box : moreBox, groups[key].node);
    }
    add(box, more);
    const surprise = btn('Surprise me', { kind: 'quiet', size: 'sm', icon: 'wand' });
    surprise.addEventListener('click', () => {
      for (const key of [...LOOK_KEYS, ...MORE_KEYS, ...EXTRA_KEYS]) groups[key].set(pickOne(Object.keys(OPTIONS[key].choices)));
      styleGroup.set(pickOne(Object.keys(INF_STYLES)));
      if (!name.value.trim()) name.value = pickOne(NAMES);
      more.open = true;
      say(sourceErr, '');
      ctx.toast('Picked for you: change anything you like', 'good');
    });
    put(sourceBox,
      h('div', { class: 'sa-ws-sec-head' }, h('h2', { class: 'sa-ws-sec-title', id: 'sa-src-h', text: 'Its look' }), surprise),
      h('p', { class: 'sa-ws-hint', text: 'An adult, made up by the AI from your choices: never a real person.' }),
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
      st.full = false;
      showWays();
      privNote.hidden = true;
      say(sourceErr, '');
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
        st.full = r.full === true;
        privNote.hidden = !st.real;
        preview.dataset.state = 'ok';
        showWays();
        say(state, photoReadyText(st.full));
        return;
      }
      preview.dataset.state = 'refused';
      say(state, upErrorText(r, 'picture'));
    });
    // (what it may be: the studio's settings can arrive after this is drawn, so it's said again then: ctx.on('info') above)
    st.photosTick = h('li', { text: photosText() });
    put(sourceBox,
      h('div', { class: 'sa-ws-sec-head' }, h('h2', { class: 'sa-ws-sec-title', id: 'sa-src-h', text: 'Its photo' })),
      h('ul', { class: 'sa-ticks' },
        st.photosTick,
        h('li', { text: 'One person or character, clearly an adult. Never a famous person, never someone else\'s character.' }),
        h('li', { text: "A real person's photo makes a private influencer: never in Explore, only people with its link see it. You can delete it, and everything made from it, at any time." })),
      h('div', { class: 'sa-consent' }, consent, h('label', { for: consentId, text: CONSENT_TEXT })),
      input, label, preview, privNote, state, sourceErr);
  }

  // the ways, for the photo there now: as it is only for a photo of the whole person (the way picked goes back to its 4 looks
  // when a new photo isn't one)
  function showWays() {
    if (st.way === 'asis' && !st.full) setWay('looks');
    else renderPrice();
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
    if (ctx.me?.banned) { fail(errorText('banned')); return false; }
    return true;
  }
  // a "no" for the whole form: above Create, and (when it can't be seen: a phone's closed drawer) a toast too
  function fail(text) {
    say(err, text);
    if (ws.phone && !ws.isOpen) ctx.toast(text, 'bad');
  }
  // a field to fix: the drawer opens on a phone, and the field gets the keyboard
  const fix = (node, errNode, text) => { say(errNode, text); ws.reveal(node); };
  const wayInput = () => wayPick.node.querySelector('input:checked:not(:disabled)') || wayPick.node.querySelector('input:not(:disabled)');

  // its choices, only the ones its way uses (a hidden outfit or vibe is never sent)
  function settings() {
    const u = uses();
    const out = {};
    for (const [key, g] of Object.entries(groups)) {
      if (!OPTIONS[key]?.for.includes(st.mode) || !g.value) continue;
      if ((key === 'outfit' && !u.outfit) || (key === 'vibe' && !u.vibe)) continue;
      out[key] = g.value;
    }
    return out;
  }

  async function submit() {
    say(err, '');
    if (go.node.getAttribute('aria-busy') === 'true') return;
    if (st.mode === 'design') {
      for (const key of REQUIRED) {
        if (!groups[key]?.value) { fix(groups[key]?.node.querySelector('input'), sourceErr, wordsText(key, 'empty')); return; }
      }
    } else if (!st.source) {
      fix(sourceBox.querySelector('input'), sourceErr, 'Add your photo first (and wait for its check).');
      return;
    }
    const way = wayNow();
    if (way === 'asis' && !st.full) { fix(wayInput(), wayErr, errorText('not_full')); return; }
    if (!name.value.trim()) { fix(name, nameErr, wordsText('name', 'empty')); return; }
    if (!(await ready())) return;
    if (ctx.credits < price()) {
      await ctx.buyCredits({ need: price() });
      if (ctx.credits < price()) { fail(`It needs ${creditsText(price())}: buy some, then press Create.`); return; }
    }
    await busy(go.node, 'Creating…', async () => {
      quick.node.disabled = true;
      const u = uses();
      const body = { name: name.value.trim(), mode: st.mode, style: u.style ? styleGroup.value || '' : '', settings: settings(),
        words: u.words ? words.value.trim() : '', adult: true, ...(st.mode === 'picture' ? { source: st.source, way } : {}) };
      const r = await ctx.act('inf-start', body, { human });
      quick.node.disabled = false;
      if (!ctx.alive()) return;
      const d = r.data || {};
      if (r.ok && d.ok && d.id) {
        ctx.toast(wayToast(way), 'good');
        ctx.refreshMe();
        ctx.nav(ctx.href(`/i/${d.id}`));
        return;
      }
      if (d.error === 'words') {
        if (d.field === 'name') { fix(name, nameErr, wordsText('name', d.why)); return; }
        if (d.field === 'words') { fix(words, wordsErr, wordsText('words', d.why)); return; }
        if (d.field === 'style') { fix(styleGroup.node.querySelector('input'), styleErr, wordsText('style', d.why)); return; }
        if (d.field === 'way') { fix(wayInput(), wayErr, wordsText('way', d.why)); return; }
        fix(sourceBox.querySelector('input'), sourceErr, wordsText(d.field, d.why));
        return;
      }
      if (d.error === 'short') { fail(`It needs ${creditsText(price())}, and you have ${creditsText(d.have ?? ctx.credits)}.`); ctx.buyCredits({ need: price() }); return; }
      if (d.error === 'source') { st.source = null; st.full = false; showWays(); fix(sourceBox.querySelector('input'), sourceErr, errorText('source')); return; }
      if (d.error === 'not_full') { st.full = false; setWay('looks'); fix(wayInput(), wayErr, errorText('not_full')); return; }
      if (d.error === 'no_slot') { ctx.refreshMe(); fail(errorText('no_slot')); return; }
      fail(errorText(d.error));
    });
  }

  return () => { dropPreview(); };
}
