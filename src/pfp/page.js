import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/layout.css';
import '../styles/footer.css';
import '../styles/pop.css';
import '../styles/pfp.css';
import { startTheme } from '../theme.js';
import { startMenu } from '../menu.js';
import { TRAITS, randomPortrait, validatePortrait, portraitCode, renderPortrait, exportPortrait, encodePortrait, decodePortrait } from './engine.js';

startTheme();
startMenu();

const STORAGE_KEY = 'agi-pfp-studio-v1';
const MAX_SAVED = 12;
const MAX_RECENT = 8;
const keys = ['character', 'hair', 'outfit', 'backdrop'];
const labels = { character: 'Character & style', hair: 'Hair color', outfit: 'Outfit color', backdrop: 'Your scene' };
const $ = (selector) => document.querySelector(selector);
const preview = $('#pfp-preview');
const loading = $('#pfp-loading');
const loadingText = $('#pfp-loading-text');
const status = $('#pfp-status');
const randomize = $('#pfp-randomize');
const download = $('#pfp-download');
const save = $('#pfp-save');
const share = $('#pfp-share');
const controls = new Map();
const thumbnails = new Map();
let revision = 0;
let ready = false;
let exporting = false;
let storageAvailable = true;

function readState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch { return {}; }
}
function valid(value) {
  try { return Boolean(validatePortrait(value)); } catch { return false; }
}
function cleanList(value, limit) {
  return Array.isArray(value) ? value.filter(valid).slice(0, limit) : [];
}
function identity(config) { return encodePortrait(config); }
function same(a, b) { return Boolean(a && b && identity(a) === identity(b)); }
const restored = readState();
let favorites = cleanList(restored.favorites, MAX_SAVED);
let recent = cleanList(restored.recent, MAX_RECENT);
let locks = new Set(Array.isArray(restored.locks) ? restored.locks.filter((key) => keys.includes(key)) : []);
let shared = null;
try { shared = decodePortrait(new URLSearchParams(location.hash.slice(1)).get('p') || ''); } catch { /* Invalid links get a fresh portrait. */ }
let current = valid(shared) ? shared : valid(restored.current) ? restored.current : randomPortrait();

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ current, favorites, recent, locks: [...locks] })); storageAvailable = true; }
  catch { storageAvailable = false; }
}
function announce(message) { status.textContent = message; }
function syncButtons() {
  randomize.disabled = !ready || locks.size === keys.length;
  download.disabled = !ready || exporting;
  share.disabled = !ready;
  save.disabled = !ready;
  const saved = favorites.some((item) => same(item, current));
  save.classList.toggle('is-saved', saved);
  save.querySelector('span').textContent = saved ? 'Saved pick' : 'Save pick';
  save.setAttribute('aria-label', saved ? 'This portrait is saved in your picks' : 'Save this portrait to your picks');
  $('#pfp-lock-hint').textContent = locks.size === keys.length
    ? 'All traits are locked. Unlock one to randomize again.'
    : locks.size ? `${locks.size} ${locks.size === 1 ? 'trait stays' : 'traits stay'} with you on your next roll.` : 'Every look wears AGI. Every roll is a fresh mix.';
  for (const [key, { select, lock }] of controls) {
    select.disabled = !ready;
    select.value = String(current[key]);
    lock.setAttribute('aria-pressed', String(locks.has(key)));
    lock.setAttribute('aria-label', `${locks.has(key) ? 'Unlock' : 'Lock'} ${labels[key].toLowerCase()}`);
    lock.title = `${locks.has(key) ? 'Unlock' : 'Lock'} ${labels[key].toLowerCase()}`;
    lock.querySelector('.pfp-lock-shackle').setAttribute('d', locks.has(key) ? 'M7 11V7a5 5 0 0 1 10 0v4' : 'M7 11V7a5 5 0 0 1 9-3');
  }
}

function buildControls() {
  for (const key of keys) {
    const row = document.createElement('div');
    row.className = 'pfp-trait';
    const main = document.createElement('div');
    main.className = 'pfp-trait-main';
    const label = document.createElement('label');
    label.className = 'pfp-trait-label';
    label.htmlFor = `pfp-trait-${key}`;
    label.textContent = labels[key];
    const wrap = document.createElement('div');
    wrap.className = 'pfp-select-wrap';
    const select = document.createElement('select');
    select.id = label.htmlFor;
    select.disabled = true;
    const groups = new Map();
    TRAITS[key].forEach((trait, index) => {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = trait.label;
      if (trait.group) {
        if (!groups.has(trait.group)) {
          const group = document.createElement('optgroup');
          group.label = trait.group;
          groups.set(trait.group, group);
          select.append(group);
        }
        groups.get(trait.group).append(option);
      } else select.append(option);
    });
    select.addEventListener('change', () => {
      // A deliberate trait edit keeps every other detail, including the scene's
      // seeded decorations. The recipe ID already includes all trait choices.
      choose({ ...current, [key]: Number(select.value) });
    });
    const lock = document.createElement('button');
    lock.className = 'pfp-lock';
    lock.type = 'button';
    lock.innerHTML = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path class="pfp-lock-shackle" d="M7 11V7a5 5 0 0 1 9-3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><rect x="4" y="10" width="16" height="12" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M12 15v3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
    lock.addEventListener('click', () => {
      if (locks.has(key)) locks.delete(key); else locks.add(key);
      persist();
      syncButtons();
      announce(`${labels[key]} ${locks.has(key) ? 'locked' : 'unlocked'}.`);
    });
    wrap.append(select);
    main.append(label, wrap);
    row.append(main, lock);
    $('#pfp-traits').append(row);
    controls.set(key, { select, lock });
  }
}

async function paint() {
  const ownRevision = ++revision;
  const config = { ...current };
  ready = false;
  syncButtons();
  $('#pfp-art-wrap').setAttribute('aria-busy', 'true');
  loading.hidden = false;
  loading.classList.remove('is-error');
  loadingText.textContent = 'Finding your pixel personality…';
  $('#pfp-retry').hidden = true;
  try {
    // Paint off-screen so a slower earlier request can never replace the latest pick.
    const buffer = document.createElement('canvas');
    await renderPortrait(buffer, config, { size: 1024 });
    if (ownRevision !== revision) return;
    preview.width = buffer.width;
    preview.height = buffer.height;
    preview.getContext('2d').drawImage(buffer, 0, 0);
    preview.setAttribute('aria-label', `AGI portrait: ${keys.map((key) => TRAITS[key][config[key]].label).join(', ')}`);
    preview.hidden = false;
    loading.hidden = true;
    $('#pfp-code').textContent = portraitCode(config);
    ready = true;
    syncButtons();
    markSelected();
  } catch {
    if (ownRevision !== revision) return;
    preview.hidden = true;
    loading.classList.add('is-error');
    loadingText.textContent = 'The artwork couldn’t load. Check your connection and try again.';
    $('#pfp-retry').hidden = false;
    announce('Your pick is safe. Try loading the artwork again.');
  } finally {
    if (ownRevision === revision) $('#pfp-art-wrap').setAttribute('aria-busy', 'false');
  }
}

function remember(config) {
  recent = [config, ...recent.filter((item) => !same(item, config))].slice(0, MAX_RECENT);
}
function choose(config) {
  if (!valid(config)) return;
  current = { ...config };
  remember(current);
  persist();
  announce('');
  $('#pfp-share-fallback').hidden = true;
  // The address always represents the visible pick after following a shared URL.
  if (location.hash) history.replaceState(null, '', `${location.pathname}${location.search}#p=${encodePortrait(current)}`);
  renderCollection($('#pfp-recent'), recent, false);
  void paint();
}

function markSelected() {
  document.querySelectorAll('.pfp-pick').forEach((button) => {
    const selected = button.dataset.portrait === identity(current);
    button.setAttribute('aria-pressed', String(selected));
    const badge = button.querySelector('.pfp-pick-badge');
    if (badge) badge.hidden = !selected;
  });
}
function thumbnail(config) {
  const key = identity(config);
  if (thumbnails.has(key)) return thumbnails.get(key);
  const canvas = document.createElement('canvas');
  const pending = renderPortrait(canvas, config, { size: 256 }).then(() => canvas).catch((error) => {
    thumbnails.delete(key);
    throw error;
  });
  thumbnails.set(key, pending);
  // Reusing the eight recent previews keeps rerolls responsive on phones.
  if (thumbnails.size > MAX_SAVED + MAX_RECENT + 8) thumbnails.delete(thumbnails.keys().next().value);
  return pending;
}
function renderCollection(container, items, saved) {
  container.replaceChildren();
  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'pfp-empty';
    empty.textContent = saved ? 'Found your favorite? Tap Save pick to keep it here.' : 'Your recent portraits will appear here.';
    container.append(empty);
  }
  items.forEach((config) => {
    const wrap = document.createElement('div');
    wrap.className = 'pfp-pick-wrap';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pfp-pick is-loading';
    button.dataset.portrait = identity(config);
    button.setAttribute('aria-label', `Restore ${TRAITS.character[config.character].label}, portrait ${portraitCode(config)}`);
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    canvas.setAttribute('aria-hidden', 'true');
    const badge = document.createElement('span');
    badge.className = 'pfp-pick-badge';
    badge.textContent = 'CURRENT';
    badge.setAttribute('aria-hidden', 'true');
    button.append(canvas, badge);
    button.addEventListener('click', () => { choose(config); announce('Welcome back to this one.'); });
    wrap.append(button);
    if (saved) {
      const remove = document.createElement('button');
      remove.className = 'pfp-pick-remove';
      remove.type = 'button';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `Remove portrait ${portraitCode(config)} from saved picks`);
      remove.addEventListener('click', () => {
        favorites = favorites.filter((item) => !same(item, config));
        persist();
        renderSaved();
        syncButtons();
        announce('Removed from your saved picks.');
      });
      wrap.append(remove);
    }
    container.append(wrap);
    void thumbnail(config).then((rendered) => {
      canvas.getContext('2d').drawImage(rendered, 0, 0, 256, 256);
      button.classList.remove('is-loading');
    }).catch(() => {
      button.classList.remove('is-loading');
      badge.hidden = false;
      badge.textContent = 'RETRY';
    });
  });
  markSelected();
}
function renderSaved() {
  renderCollection($('#pfp-saved'), favorites, true);
  $('#pfp-saved-count').textContent = `${favorites.length} / ${MAX_SAVED} SAVED`;
}

randomize.addEventListener('click', () => {
  if (!ready || locks.size === keys.length) return;
  choose(randomPortrait(current, [...locks]));
});
$('#pfp-retry').addEventListener('click', () => { void paint(); });
save.addEventListener('click', () => {
  if (!ready) return;
  if (favorites.some((item) => same(item, current))) { announce('This one is already in your keepers.'); return; }
  if (favorites.length === MAX_SAVED) { announce('Your 12 save slots are full. Remove a keeper to make room.'); return; }
  favorites = [{ ...current }, ...favorites];
  persist();
  renderSaved();
  syncButtons();
  announce(storageAvailable ? 'Saved to your keepers on this browser.' : 'Saved for this visit. Browser storage is unavailable; download your favorites to keep them.');
});
download.addEventListener('click', async () => {
  if (!ready || exporting) return;
  exporting = true;
  const config = { ...current };
  syncButtons();
  download.querySelector('span').textContent = 'Preparing PNG…';
  try {
    const blob = await exportPortrait(config);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${portraitCode(config).replace(/[^a-z0-9_-]/gi, '')}.png`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    announce('Your PNG is ready. Check your downloads.');
  } catch { announce('The download couldn’t finish. Please try again.'); }
  finally {
    exporting = false;
    download.querySelector('span').textContent = 'Download PNG';
    syncButtons();
  }
});
share.addEventListener('click', async () => {
  if (!ready) return;
  const url = new URL(location.href);
  url.hash = `p=${encodePortrait(current)}`;
  try {
    await navigator.clipboard.writeText(url.href);
    announce('Portrait link copied. It opens this exact look.');
  } catch {
    $('#pfp-share-fallback').hidden = false;
    const input = $('#pfp-share-url');
    input.value = url.href;
    input.focus();
    input.select();
    announce('Copy the selected link to share this look.');
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() !== 'r' || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
  if (event.target instanceof Element && event.target.closest('input, select, textarea, [contenteditable="true"]')) return;
  if (!randomize.disabled) { event.preventDefault(); randomize.click(); }
});
window.addEventListener('hashchange', () => {
  try {
    const config = decodePortrait(new URLSearchParams(location.hash.slice(1)).get('p') || '');
    if (valid(config)) choose(config);
  } catch { announce('That portrait link isn’t valid. You can keep creating here.'); }
});

$('#pfp-library-count').textContent = `${TRAITS.character.length} looks · ${TRAITS.backdrop.length} worlds · mix your colors`;
buildControls();
remember(current);
persist();
renderCollection($('#pfp-recent'), recent, false);
renderSaved();
void paint();
