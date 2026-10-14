// AGI Studio (2026-10-13): the 3D tool's choices, on an influencer's own page (views/influencer.js modelTool: its price, its
// button and its burn are there). The owner: "i wish theres more tools to customize the 3d like in meshy, please fixx and make
// it better"; the owner's choices: "Pick its moves (Recommended)", "Shape and look (Recommended)", "More downloads" (and "3D
// page tools (Recommended)": its 3D page's, views/model3d.js), "Per extra, ~1.8× (Recommended)" and "30 days (Recommended)".
// Four folding sections, each with a short note in its summary saying what's picked: its moves (up to MODEL.PICKS_MAX from the
// library, in its groups, MODEL.PICKS_FREE of them in its price), moves of its own (up to MODEL.OWN_MAX, described in words: a
// name people type, what it does, how long), its shape and look (detail, shine, pose, height, its look in words) and more
// downloads (made once it's ready, kept DL_DAYS days). What's picked is kept while the page is open (modelState(): its panel is
// drawn again on many looks). Its words are counted and checked here the way our server does (src/studio/rules.js modelSpec,
// tidyWords), so a "no" is said under its own field before anything is asked; our server checks every choice again
// (server/influencer.js readChoices, and their words: server/studio-words.js checkModelWords).
import { h, btn, nextId, put, say, segmented, cardPick } from '../ui.js';
import {
  MODEL, OWN_NAME, MOVE_GROUPS, MOVE_LIBRARY, DEFAULT_PICKS, MODEL_DETAIL, MODEL_POSES, DL_FORMATS, DL_DAYS, MODEL_EXTRAS, moveWord, tidyWords,
} from '../rules.js';
import { movesNote, movesLine, ownNote, lookNote, dlNote, ownText, lookText, modelWordsText } from '../app-words.js';
import { range } from './layers.js';

// What's picked, as a new model starts: its 7 usual moves, nothing of its own, Standard, no shine, A-pose, 170 cm, its own
// look, no extra downloads; its moves' section open. own: [{ key, name, prompt, seconds }] as typed so far
export function modelState() {
  return {
    moves: [...DEFAULT_PICKS], own: [], detail: 'std', shine: false, pose: 'a', height: MODEL.HEIGHT, look: '', formats: [],
    open: { moves: true, own: false, look: false, dl: false }, nextKey: 1,
  };
}
// What's sent to our server: the model's choices as picked (its words tidied there, and checked again)
export function specOf(st) {
  return {
    moves: [...st.moves],
    own: st.own.map((o) => ({ name: String(o.name ?? '').trim().toLowerCase(), prompt: tidyWords(o.prompt), seconds: o.seconds })),
    detail: st.detail, shine: st.shine === true, pose: st.pose, height: st.height, look: tidyWords(st.look) || null, formats: [...st.formats],
  };
}
// A model's choices with the same price as what's picked now, whatever is half-typed (its price follows what's picked, never
// how far its words are typed): its moves (one, while none is picked: the button says why), as many moves of its own, its
// detail. → a spec rules.js modelCost, modelExtras, burnable and modelTimes take
export function priceSpecOf(st) {
  return {
    moves: st.moves.length ? [...st.moves] : [DEFAULT_PICKS[0]],
    own: st.own.map((_, i) => ({ name: `own${i + 1}x`, prompt: 'a move', seconds: MODEL.OWN_SECONDS_DEFAULT })),
    detail: st.detail,
  };
}
// The tool's choices. st: modelState()'s (changed in place); name: the influencer's; onchange(): something picked or typed
// (its price, its button); reveal(el, { focus }): a field to fix brought into view (the workspace's: a phone's drawer opens
// first). → { node, check() (false: its "no" said under its field, which is shown), specError(field, text) and
// wordsError(answer) (our server's "no": true when said under its field) }
export function modelChoices({ st, name = 'it', onchange = () => {}, reveal = (el) => el?.focus?.() }) {
  const errLine = () => h('p', { class: 'sa-err', role: 'alert', hidden: true });
  const changed = () => { notes(); onchange(); };
  const secs = {};
  // a folding section (its summary: its title, and a note of what's picked); remembered open or not while the page is open
  const section = (key, title, ...kids) => {
    const note = h('span', { class: 'sa-more-note' });
    const node = h('details', { class: 'sa-more sa-m3-sec', open: st.open[key] === true, dataset: { sec: key } },
      h('summary', null, h('span', { class: 'sa-m3-title', text: title }), note), h('div', { class: 'sa-m3-in' }, ...kids));
    node.addEventListener('toggle', () => { st.open[key] = node.open; });
    secs[key] = { node, note };
    return node;
  };
  // a section opened (if it was folded) and one of its fields brought into view
  const show = (key, el, opts = {}) => {
    const s = secs[key];
    if (s && !s.node.open) { s.node.open = true; st.open[key] = true; }
    if (el) reveal(el, opts);
  };

  // ---------- its moves: the library's, in its groups (checkboxes that look like chips) ----------
  const movesErr = errLine();
  const movesSay = h('p', { class: 'sa-ws-hint sa-m3-count', 'aria-live': 'polite' });
  const boxes = new Map();
  const moveSet = h('fieldset', { class: 'sa-chips sa-mchips' }, h('legend', { class: 'sa-sr', text: 'Its moves' }));
  for (const [group, groupName] of Object.entries(MOVE_GROUPS)) {
    const list = MOVE_LIBRARY.filter((m) => m.group === group);
    if (!list.length) continue;
    const subId = nextId('mvg');
    const row = h('div', { class: 'sa-chip-row', role: 'group', 'aria-labelledby': subId });
    for (const m of list) {
      const cid = nextId('mv');
      const input = h('input', { type: 'checkbox', class: 'sa-chip-input', id: cid, value: m.name, checked: st.moves.includes(m.name) });
      input.addEventListener('change', () => pickMove(m.name, input));
      boxes.set(m.name, input);
      // (its words, on hover: what someone may type to play it, besides its name)
      row.append(h('span', { class: 'sa-chip' }, input,
        h('label', { for: cid, title: `Plays when someone types: ${m.words.slice(0, 5).join(', ')}` }, h('span', { class: 'sa-chip-text', text: m.label }))));
    }
    moveSet.append(h('div', { class: 'sa-chip-sec' }, h('p', { class: 'sa-chip-subhead', id: subId, text: groupName }), row));
  }
  function pickMove(moveName, input) {
    if (input.checked && !st.moves.includes(moveName)) {
      if (st.moves.length >= MODEL.PICKS_MAX) { input.checked = false; drawMoves(); return; }
      st.moves.push(moveName);
    }
    if (!input.checked) st.moves = st.moves.filter((x) => x !== moveName);
    say(movesErr, '');
    drawMoves();
    changed();
  }
  const usual = btn(`The usual ${DEFAULT_PICKS.length}`, { kind: 'quiet', size: 'sm', icon: 'refresh' });
  usual.addEventListener('click', () => {
    st.moves = [...DEFAULT_PICKS];
    say(movesErr, '');
    drawMoves();
    changed();
  });
  // at its most, the moves not picked wait (unpick one to pick another: the line under them says so)
  function drawMoves() {
    const full = st.moves.length >= MODEL.PICKS_MAX;
    for (const [moveName, input] of boxes) {
      input.checked = st.moves.includes(moveName);
      input.disabled = full && !input.checked;
    }
    movesSay.textContent = movesLine(st.moves.length);
  }
  const firstMove = () => [...boxes.values()].find((b) => !b.disabled) || null;
  const movesSec = section('moves', 'Its moves',
    h('p', { class: 'sa-ws-hint', text: `Each plays on its 3D page when someone types its name, or a word for it. It always knows how to stand.` }),
    moveSet, h('div', { class: 'sa-m3-row' }, movesSay, usual), movesErr);

  // ---------- moves of its own: described in words (the AI makes each one for it) ----------
  const ownErr = errLine();
  const ownList = h('div', { class: 'sa-own-list' });
  const addOwn = btn('Describe a move', { kind: 'ghost', size: 'sm', icon: 'plus' });
  const rows = [];
  addOwn.addEventListener('click', () => {
    if (st.own.length >= MODEL.OWN_MAX) return;
    st.own.push({ key: st.nextKey++, name: '', prompt: '', seconds: MODEL.OWN_SECONDS_DEFAULT });
    say(ownErr, '');
    drawOwn();
    changed();
    rows[rows.length - 1]?.nameIn.focus();
  });
  function drawOwn() {
    rows.length = 0;
    put(ownList, ...st.own.map((o, k) => ownRow(o, k)));
    addOwn.hidden = st.own.length >= MODEL.OWN_MAX;
  }
  const PLACE = [
    { name: 'salute', prompt: 'A crisp salute, then a proud little nod' },
    { name: 'robot', prompt: 'A stiff robot dance with sharp, jerky arm moves' },
  ];
  function ownRow(o, k) {
    const nameId = nextId('ownn'), promptId = nextId('ownp');
    const nameErr = errLine(), promptErr = errLine();
    const ph = PLACE[k] || PLACE[0];
    const nameIn = h('input', { class: 'sa-input', id: nameId, type: 'text', maxlength: '16', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false',
      enterkeyhint: 'next', placeholder: ph.name, value: o.name, 'aria-describedby': `${nameId}-h` });
    nameIn.addEventListener('input', () => { o.name = nameIn.value; say(nameErr, ''); changed(); });
    const promptIn = h('textarea', { class: 'sa-input sa-textarea', id: promptId, rows: '2', maxlength: String(MODEL.OWN_LONG), placeholder: ph.prompt, value: o.prompt });
    const count = h('span', { class: 'sa-count', 'aria-hidden': 'true', text: `${o.prompt.length}/${MODEL.OWN_LONG}` });
    promptIn.addEventListener('input', () => {
      o.prompt = promptIn.value;
      count.textContent = `${promptIn.value.length}/${MODEL.OWN_LONG}`;
      say(promptErr, '');
      changed();
    });
    const length = segmented({ legend: 'Its length', choices: MODEL.OWN_SECONDS.map((s) => [String(s), `${s} s`]), value: String(o.seconds), showLegend: true,
      cls: 'sa-seg-shape', onchange: (v) => { o.seconds = Number(v); changed(); } });
    const rm = btn('Remove', { kind: 'quiet', size: 'sm', icon: 'trash', 'aria-label': `Remove move ${k + 1}` });
    rm.addEventListener('click', () => {
      const at = st.own.indexOf(o);
      if (at >= 0) st.own.splice(at, 1);
      say(ownErr, '');
      drawOwn();
      changed();
      ((rows[at] || rows[at - 1])?.nameIn || addOwn).focus();
    });
    const node = h('div', { class: 'sa-own', role: 'group', 'aria-label': `Move ${k + 1}` },
      h('div', { class: 'sa-own-head' }, h('span', { class: 'sa-own-title', text: `Move ${k + 1}` }), rm),
      h('div', { class: 'sa-field' }, h('label', { class: 'sa-label', for: nameId, text: 'Its name' }), nameIn,
        h('p', { class: 'sa-hint sa-own-hint', id: `${nameId}-h`, text: 'What people type to play it: one word of letters and numbers.' }), nameErr),
      h('div', { class: 'sa-field' }, h('label', { class: 'sa-label', for: promptId, text: 'What it does' }), promptIn, h('div', { class: 'sa-field-foot' }, promptErr, count)),
      h('div', { class: 'sa-field' }, length.node));
    rows.push({ o, nameIn, promptIn, nameErr, promptErr });
    return node;
  }
  const ownSec = section('own', 'Moves of its own',
    h('p', { class: 'sa-ws-hint', text: `Describe a move and the AI makes it for ${name}: up to ${MODEL.OWN_MAX}, each +${MODEL_EXTRAS.own} credits and about 5 minutes more. It plays when someone types its name.` }),
    ownList, addOwn, ownErr,
    h('p', { class: 'sa-fine', text: "Keep it PG-13: never violent, and never anyone real or someone else's character." }));

  // ---------- its shape and look ----------
  const shapeErr = errLine();
  const detail = cardPick({ legend: 'Detail', cls: 'sa-cards-list', value: st.detail,
    choices: Object.entries(MODEL_DETAIL).map(([value, d]) => ({ value, name: d.name, note: d.note, price: value === 'high' ? `+${MODEL_EXTRAS.high} credits` : null })),
    onchange: (v) => { st.detail = v; say(shapeErr, ''); changed(); } });
  const shineId = nextId('shine');
  const shineIn = h('input', { type: 'checkbox', class: 'sa-check', id: shineId, checked: st.shine });
  shineIn.addEventListener('change', () => { st.shine = shineIn.checked; say(shapeErr, ''); changed(); });
  const poseNote = h('p', { class: 'sa-hint sa-m3-note' });
  const drawPose = () => { poseNote.textContent = `${MODEL_POSES[st.pose]?.note || ''}. Its moves play the same either way.`; };
  const pose = segmented({ legend: 'Its pose', choices: Object.entries(MODEL_POSES).map(([k, p]) => [k, p.name]), value: st.pose, showLegend: true, cls: 'sa-seg-shape',
    onchange: (v) => { st.pose = v; say(shapeErr, ''); drawPose(); changed(); } });
  const height = range('Its height', st.height, { key: 'height', min: MODEL.HEIGHT_MIN, max: MODEL.HEIGHT_MAX, step: 1, text: (v) => `${v} cm`,
    onInput: (v) => { st.height = v; say(shapeErr, ''); changed(); } });
  const lookId = nextId('look');
  const lookErr = errLine();
  const lookIn = h('textarea', { class: 'sa-input sa-textarea', id: lookId, rows: '3', maxlength: String(MODEL.LOOK_MAX),
    placeholder: 'For example: a silver bomber jacket with glowing purple lines', value: st.look, 'aria-describedby': `${lookId}-h` });
  const lookCount = h('span', { class: 'sa-count', 'aria-hidden': 'true', text: `${st.look.length}/${MODEL.LOOK_MAX}` });
  lookIn.addEventListener('input', () => {
    st.look = lookIn.value;
    lookCount.textContent = `${lookIn.value.length}/${MODEL.LOOK_MAX}`;
    say(lookErr, '');
    changed();
  });
  const lookSec = section('look', 'Shape and look',
    h('div', { class: 'sa-field' }, detail.node),
    h('div', { class: 'sa-consent sa-consent-sm' }, shineIn, h('label', { for: shineId, text: 'Shine: metal, roughness and bump maps (PBR), so light plays on it like on real materials. Free.' })),
    h('div', { class: 'sa-field' }, pose.node, poseNote),
    h('div', { class: 'sa-field' }, height.node, h('p', { class: 'sa-hint sa-m3-note', text: 'How tall it stands in a 3D app or a game (the scale of its bones).' })),
    h('div', { class: 'sa-field' }, h('label', { class: 'sa-label', for: lookId, text: 'Change its look with words (optional, free)' }), lookIn,
      h('p', { class: 'sa-hint sa-m3-note', id: `${lookId}-h`, text: 'What the AI paints on it. The rest stays as in its full body: its face, hair and skin.' }),
      h('div', { class: 'sa-field-foot' }, lookErr, lookCount)),
    shapeErr);

  // ---------- more downloads ----------
  const dlErr = errLine();
  const dlBoxes = new Map();
  const dlRows = Object.entries(DL_FORMATS).map(([key, f]) => {
    const cid = nextId('dl');
    const input = h('input', { type: 'checkbox', class: 'sa-check', id: cid, value: key, checked: st.formats.includes(key) });
    input.addEventListener('change', () => {
      st.formats = Object.keys(DL_FORMATS).filter((x) => (x === key ? input.checked : st.formats.includes(x)));
      say(dlErr, '');
      changed();
    });
    dlBoxes.set(key, input);
    return h('div', { class: 'sa-consent sa-consent-sm sa-dl-opt' }, input,
      h('label', { for: cid }, h('span', { class: 'sa-dl-name', text: f.name }), h('span', { class: 'sa-dl-note', text: f.note })));
  });
  const dlSec = section('dl', 'More downloads',
    h('p', { class: 'sa-ws-hint', text: `Free, and only for you: made once it's ready, on its 3D page, kept ${DL_DAYS} days (its 3D model and its picture stay for good).` }),
    h('div', { class: 'sa-dl-opts', role: 'group', 'aria-label': 'More downloads' }, ...dlRows), dlErr);

  // each section's note: what's picked now
  function notes() {
    secs.moves.note.textContent = movesNote(st.moves.length);
    secs.own.note.textContent = ownNote(st.own);
    secs.look.note.textContent = lookNote(st);
    secs.dl.note.textContent = dlNote(st.formats);
  }

  // ---------- its "no"s ----------
  // what's typed and picked, checked as our server checks it (rules.js modelSpec): the first "no" said under its field
  function check() {
    if (st.moves.length < 1) { say(movesErr, movesLine(0)); show('moves', firstMove()); return false; }
    const seen = new Set();
    for (let k = 0; k < st.own.length; k++) {
      const o = st.own[k], row = rows[k];
      if (!row) continue;
      const nm = String(o.name ?? '').trim().toLowerCase();
      const nameWhy = !nm ? 'name_empty' : !OWN_NAME.test(nm) ? 'name_bad' : moveWord(nm) ? 'name_taken' : seen.has(nm) ? 'name_twice' : null;
      if (nameWhy) { say(row.nameErr, ownText(nameWhy, nm)); show('own', row.nameIn); return false; }
      seen.add(nm);
      const p = tidyWords(o.prompt);
      const promptWhy = !p ? 'prompt_empty' : p.length < MODEL.OWN_MIN ? 'prompt_short' : p.length > MODEL.OWN_LONG ? 'prompt_long' : null;
      if (promptWhy) { say(row.promptErr, ownText(promptWhy)); show('own', row.promptIn); return false; }
    }
    const lk = tidyWords(st.look);
    if (lk && (lk.length < MODEL.LOOK_MIN || lk.length > MODEL.LOOK_MAX)) {
      say(lookErr, lookText(lk.length < MODEL.LOOK_MIN ? 'short' : 'long'));
      show('look', lookIn);
      return false;
    }
    return true;
  }
  // our server's "no" for one of its choices (400 spec, with which: field) said in its section. → false: not one of its fields
  function specError(field, text) {
    const at = {
      moves: ['moves', movesErr, () => firstMove()],
      own: ['own', ownErr, () => rows[0]?.nameIn || addOwn],
      detail: ['look', shapeErr, () => detail.node.querySelector('input:checked') || detail.node.querySelector('input')],
      shine: ['look', shapeErr, () => shineIn],
      pose: ['look', shapeErr, () => pose.node.querySelector('input:checked') || pose.node.querySelector('input')],
      height: ['look', shapeErr, () => height.input],
      look: ['look', lookErr, () => lookIn],
      formats: ['dl', dlErr, () => dlBoxes.values().next().value || null],
    }[field];
    if (!at) return false;
    say(at[1], text);
    show(at[0], at[2]());
    return true;
  }
  // …and its words' "no" (422 words: its look, or a move of its own's name or what it does, n from 1)
  function wordsError(d) {
    if (d?.field === 'look') { say(lookErr, modelWordsText('look', d.why)); show('look', lookIn); return true; }
    if (d?.field !== 'own') return false;
    const row = rows[Math.max(0, (Number(d.n) || 1) - 1)] || rows[0];
    if (!row) { say(ownErr, modelWordsText('own', d.why)); show('own', addOwn); return true; }
    const isName = d.part === 'name';
    say(isName ? row.nameErr : row.promptErr, modelWordsText('own', d.why));
    show('own', isName ? row.nameIn : row.promptIn);
    return true;
  }

  drawMoves();
  drawOwn();
  drawPose();
  notes();
  return { node: h('div', { class: 'sa-m3' }, movesSec, ownSec, lookSec, dlSec), check, specError, wordsError };
}
