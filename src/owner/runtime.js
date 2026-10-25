// Owner-authored presentation content. This is not an access-control boundary: API permissions remain server-side.
// Existing app elements are preserved. Removing an override restores the original text/attributes in this page.
import '../styles/site-content.css';
import { normalizePath, pageForPath, protectedPath } from './catalog.js';
import { safeUrl, safeSelector } from './model.js';

const API = '/api/wallet?site-content';
const MAX_ITEMS = 1800;
const SAFE_ID = /^[A-Za-z_][A-Za-z0-9_-]*$/;
const SKIP = 'script,style,link,meta,noscript,template,svg,canvas,form,input,textarea,select,option,button,dialog,[data-owner-generated],[data-owner-page-notice],[data-lp-loader],[data-lv-owner],[data-vt-owner],[data-sa-account]';
const CONTAINER = 'main,section,header,footer,nav,article';
const CANDIDATE = `${CONTAINER},.lp-eco li,.lp-planets li,h1,h2,h3,h4,h5,h6,p,span,strong,em,small,a,img,li,dt,dd,blockquote,figcaption,summary`;
const states = new WeakMap();
const selectorCache = new WeakMap();

function currentPath(root) {
  const win = root.defaultView;
  const path = normalizePath(win?.location?.pathname || '/');
  if (/^studio\./i.test(win?.location?.hostname || '') && !path.startsWith('/studio')) return `/studio${path === '/' ? '' : path}`;
  return path;
}
function one(root, selector) { try { return root.querySelector(selector); } catch { return null; } }
function many(root, selector) { try { return [...root.querySelectorAll(selector)]; } catch { return []; } }
const flat = (text, max = 100) => String(text || '').replace(/\s+/g, ' ').trim().slice(0, max);
const tagOf = (node) => String(node?.tagName || '').toLowerCase();
const directTexts = (node) => [...(node?.childNodes || [])].filter((n) => n.nodeType === 3);
const directText = (node) => directTexts(node).map((n) => n.textContent).join('');

export function safeContentLink(value, origin = 'https://agi1.app') {
  if (!value || !safeUrl(value)) return null;
  try {
    const url = new URL(value, origin);
    if (url.protocol !== 'https:' && !(url.origin === origin && url.protocol === 'http:')) return null;
    return value.startsWith('/') || value.startsWith('#') ? value : url.href;
  } catch { return null; }
}

export function safeContentImage(value) {
  if (!value || !safeUrl(value, { image: true })) return null;
  if (value.startsWith('data:') || value.startsWith('/')) return value;
  try {
    const url = new URL(value);
    if (['agi1.app', 'www.agi1.app'].includes(url.hostname)) return `${url.pathname}${url.search}`;
    return url.protocol === 'https:' && url.hostname === 'live.agi1.app' && !url.username && !url.password && !url.port ? url.href : null;
  } catch { return null; }
}

// Custom blocks are excluded from structural indexes. Inserting a new <section> before an old one must
// never make an existing override point at a different section on this or a subsequent render.
function nativeMatches(node, part) {
  if (node.closest('[data-owner-generated]')) return false;
  const nth = /:nth-of-type\(([1-9][0-9]*)\)$/.exec(part);
  const base = nth ? part.slice(0, nth.index) : part;
  try { if (!node.matches(base)) return false; } catch { return false; }
  if (!nth) return true;
  const siblings = [...(node.parentElement?.children || [])].filter((n) => tagOf(n) === tagOf(node) && !n.hasAttribute('data-owner-generated'));
  return siblings.indexOf(node) + 1 === Number(nth[1]);
}
function nativeQueryAll(root, selector) {
  if (!safeSelector(selector)) return [];
  const parts = selector.split(/\s*>\s*/);
  const last = parts.at(-1).replace(/:nth-of-type\([1-9][0-9]*\)$/, '');
  return many(root, last).filter((node) => {
    let at = node;
    for (let i = parts.length - 1; i >= 0; i--) {
      if (!at || !nativeMatches(at, parts[i])) return false;
      at = at.parentElement;
    }
    return true;
  });
}
function targetFor(state, selector) {
  const cached = state.targets.get(selector);
  if (cached?.isConnected && selectable(cached)) return cached;
  const found = nativeQueryAll(state.root, selector);
  if (found.length !== 1) return null;
  state.targets.set(selector, found[0]);
  return found[0];
}

// Selection always identifies one real element, with a stable ID/class anchor when possible.
// No selector is derived from visible text, an account address, or form values.
export function selectorFor(node) {
  if (!node?.ownerDocument || node.nodeType !== 1) return '';
  if (selectorCache.has(node)) return selectorCache.get(node);
  const root = node.ownerDocument;
  const unique = (s, target) => { const found = nativeQueryAll(root, s); return found.length === 1 && found[0] === target; };
  const keep = (selector) => { selectorCache.set(node, selector); return selector; };
  const anchor = (el) => {
    const id = el.getAttribute('id');
    if (SAFE_ID.test(id || '') && unique(`#${id}`, el)) return `#${id}`;
    const classes = String(el.getAttribute('class') || '').split(/\s+/).filter((c) => SAFE_ID.test(c) && !/^(?:is-|has-|active$|open$|hidden$|busy$)/.test(c));
    return classes.map((c) => `.${c}`).find((s) => unique(s, el)) || '';
  };
  const parts = [];
  let el = node;
  while (el && tagOf(el) !== 'body' && tagOf(el) !== 'html' && parts.length < 18) {
    const a = anchor(el);
    if (a) {
      const s = [a, ...parts].join(' > ');
      if (s.length <= 600 && unique(s, node)) return keep(s);
    }
    const tag = tagOf(el);
    const siblings = [...(el.parentElement?.children || [])].filter((n) => tagOf(n) === tag && !n.hasAttribute('data-owner-generated'));
    parts.unshift(`${tag}:nth-of-type(${Math.max(1, siblings.indexOf(el) + 1)})`);
    el = el.parentElement;
  }
  const s = parts.join(' > ');
  return s && s.length <= 600 && unique(s, node) ? keep(s) : '';
}

function selectable(node) {
  if (!node || node.nodeType !== 1 || node.closest(SKIP)) return false;
  const tag = tagOf(node);
  if (node.matches(CONTAINER) || node.matches('.lp-eco li,.lp-planets li') || tag === 'img' || tag === 'a') return true;
  return node.matches(CANDIDATE) && Boolean(flat(directText(node)));
}

export function itemFor(node) {
  if (!selectable(node)) return null;
  const selector = selectorFor(node);
  if (!selector) return null;
  const tag = tagOf(node);
  const kind = node.matches('.lp-eco li') ? 'world' : node.matches('.lp-planets li') ? 'orbit'
    : node.matches(CONTAINER) ? 'section' : tag === 'img' ? 'image' : tag === 'a' ? 'link' : 'text';
  const heading = node.matches(CONTAINER) ? node.querySelector('h1,h2,h3,h4')?.textContent : '';
  const label = flat(heading || node.getAttribute('aria-label') || (tag === 'img' ? node.getAttribute('alt') : node.textContent), 100) || `${tag} · ${selector}`;
  const worldLink = ['world', 'orbit'].includes(kind) ? node.querySelector('a') : null;
  const worldName = worldLink?.querySelector('.lp-planet-name') || worldLink;
  const worldNote = worldLink?.querySelector('small,.lp-planet-url');
  return {
    selector, label, tag, kind,
    text: node.matches(CONTAINER) || kind === 'world' || tag === 'img' ? '' : directText(node).trim().slice(0, 10000),
    ...(tag === 'a' ? { href: node.getAttribute('href') || '' } : {}),
    ...(tag === 'img' ? { src: node.getAttribute('src') || '', alt: node.getAttribute('alt') || '' } : {}),
    ...(worldLink ? {
      linkSelector: selectorFor(worldLink), textSelector: selectorFor(worldName),
      linkText: directText(worldName).trim(), href: worldLink.getAttribute('href') || '',
      ...(worldNote ? { noteSelector: selectorFor(worldNote), noteText: directText(worldNote).trim() } : {}),
    } : {}),
    hidden: Boolean(node.closest('[data-owner-hidden="true"]')),
  };
}

export function collectItems(root = document) {
  const items = [];
  for (const node of many(root.body || root, CANDIDATE)) {
    const item = itemFor(node);
    if (item) items.push(item);
    if (items.length >= MAX_ITEMS) break;
  }
  return items;
}

function stateFor(root) {
  let state = states.get(root);
  if (!state) {
    state = { root, records: new Map(), targets: new Map(), document: { pages: [], edits: [] }, blockKey: '', generated: [], title: root.title || '', lastTitle: null, preview: false, applying: false, observer: null, watch: false };
    states.set(root, state);
  }
  return state;
}
// Other public features can reuse the single content fetch, including a module loaded after its first response.
export function getSiteContent(root = document) { return states.get(root)?.document || null; }
function record(state, node) {
  let row = state.records.get(node);
  if (!row) { row = { attrs: new Map(), texts: new Map() }; state.records.set(node, row); }
  return row;
}
function setAttr(state, node, name, value) {
  const row = record(state, node);
  if (!row.attrs.has(name)) row.attrs.set(name, node.getAttribute(name));
  if (value == null) { if (node.hasAttribute(name)) node.removeAttribute(name); }
  else if (node.getAttribute(name) !== String(value)) node.setAttribute(name, String(value));
}
function setText(state, node, value) {
  if (!node || node.matches(CONTAINER) || node.matches('.lp-eco li,.lp-planets li')) return;
  const texts = directTexts(node);
  if (!texts.length) return;
  const row = record(state, node);
  texts.forEach((text, i) => {
    if (!row.texts.has(text)) row.texts.set(text, text.textContent);
    const next = i === 0 ? String(value).slice(0, 10000) : '';
    if (text.textContent !== next) text.textContent = next;
  });
}
function hide(state, node) { if (node) setAttr(state, node, 'data-owner-hidden', 'true'); }
function restore(state) {
  for (const [node, row] of state.records) {
    if (!node.isConnected) { state.records.delete(node); continue; }
    for (const [name, value] of row.attrs) {
      if (value == null) { if (node.hasAttribute(name)) node.removeAttribute(name); }
      else if (node.getAttribute(name) !== value) node.setAttribute(name, value);
    }
    for (const [text, value] of row.texts) if (text.isConnected && text.textContent !== value) text.textContent = value;
  }
  state.records.clear();
}
function make(root, tag, cls, text) {
  const node = root.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = String(text);
  return node;
}
function markGenerated(node) { node.setAttribute('data-owner-generated', 'true'); return node; }

function blockNode(state, block, world) {
  const { root } = state;
  const origin = root.defaultView?.location?.origin || 'https://agi1.app';
  const href = safeContentLink(block.href, origin);
  const image = safeContentImage(block.image);
  const node = markGenerated(make(root, world ? 'li' : 'section', world ? 'owner-world-item' : 'site-content-block'));
  node.setAttribute('data-owner-block', String(block.id || ''));
  if (block.hidden) node.setAttribute('data-owner-hidden', 'true');
  if (world) {
    const link = make(root, href ? 'a' : 'span', 'lp-c-lav');
    if (href) link.setAttribute('href', href);
    link.append(make(root, 'span', 'lp-dot'));
    if (image) { const img = make(root, 'img', 'owner-world-image'); img.src = image; img.alt = block.alt || ''; link.append(img); }
    link.append(root.createTextNode(block.title || block.label || 'New link'));
    if (block.text) link.append(make(root, 'small', '', block.text));
    if (href) link.append(make(root, 'i', '', href.startsWith('#') ? '↓' : '→'));
    node.append(link);
  } else {
    const inner = make(root, 'div', 'site-content-inner');
    if (block.title) inner.append(make(root, 'h2', '', block.title));
    if (block.text) inner.append(make(root, 'p', '', block.text));
    if (image) { const img = make(root, 'img'); img.src = image; img.alt = block.alt || ''; img.loading = 'lazy'; inner.append(img); }
    if (href) { const a = make(root, 'a', 'site-content-link', block.label || 'Learn more'); a.href = href; if (!href.startsWith('/') && !href.startsWith('#')) a.rel = 'noopener noreferrer'; inner.append(a); }
    node.append(inner);
  }
  return node;
}

function renderBlocks(state, page, path) {
  const root = state.root;
  const customHost = one(root, '[data-owner-custom-page]');
  if (customHost) for (const loading of many(customHost, '[data-owner-loading]')) loading.hidden = true;
  const host = customHost || one(root, '[data-sa-view]') || one(root, 'main') || root.body;
  const blocks = page && normalizePath(page.path) === path && Array.isArray(page.blocks) ? page.blocks : [];
  const key = JSON.stringify([path, page?.custom, page?.title, page?.description, blocks]);
  if (state.blockKey === key && state.generated.every((n) => n.isConnected)) return;
  for (const node of state.generated) node.remove();
  state.generated = []; state.blockKey = key;
  const add = (node) => { state.generated.push(node); return node; };
  if (customHost) {
    const header = add(markGenerated(make(root, 'header', 'site-content-page-head')));
    const exists = Boolean(page?.custom && normalizePath(page.path) === path);
    header.append(make(root, 'h1', '', exists ? page.title : "This page isn't available"));
    if (exists && page.description) header.append(make(root, 'p', '', page.description));
    if (!exists) {
      header.append(make(root, 'p', '', 'This page may have been removed or the link may be incorrect.'));
      const a = make(root, 'a', 'site-content-link', 'Back to AGI'); a.href = '/'; header.append(a);
    }
    customHost.prepend(header);
  }
  const initialStart = [...host.children].find((n) => !n.hasAttribute('data-owner-generated')) || null;
  const after = new Map();
  for (const block of blocks) {
    const worldHost = block.placement === 'world' && path === '/' ? one(root, '.lp-eco > ul') : null;
    const node = add(blockNode(state, block, Boolean(worldHost)));
    if (worldHost) { worldHost.append(node); continue; }
    const anchor = typeof block.anchor === 'string' ? targetFor(state, block.anchor) : null;
    if (anchor && selectable(anchor) && anchor !== root.body && ['before', 'after'].includes(block.placement)) {
      if (block.placement === 'before') anchor.before(node);
      else { (after.get(anchor) || anchor).after(node); after.set(anchor, node); }
    } else if (block.placement === 'start') host.insertBefore(node, initialStart);
    else host.append(node);
  }
}

function destination(href, state) {
  try {
    const location = state.root.defaultView?.location;
    const url = new URL(href, location?.href || 'https://agi1.app/');
    if (url.origin !== (location?.origin || 'https://agi1.app') && !['agi1.app', 'www.agi1.app', 'studio.agi1.app', 'inference.agi1.app'].includes(url.hostname)) return null;
    let path = normalizePath(url.pathname);
    if (/^studio\./i.test(url.hostname) && !path.startsWith('/studio')) path = `/studio${path === '/' ? '' : path}`;
    return { path, hash: url.hash };
  } catch { return null; }
}
function linkContainer(node) { return node.closest('.lp-eco li,.lp-planets li,.gm-game') || node; }

function syncLinks(state, data, path, hiddenIds, worldBefore) {
  const root = state.root;
  const anchorSettings = new Map();
  const hiddenAnchor = (dest) => {
    if (!dest.hash) return false;
    if (!anchorSettings.has(dest.path)) {
      const applicable = (Array.isArray(data.edits) ? data.edits : [])
        .filter((e) => e.page === '*' || normalizePath(e.page) === dest.path || (e.page === '/' && dest.path === '/talk'))
        .sort((a, b) => (a.page === '*' ? 0 : a.page === dest.path ? 2 : 1) - (b.page === '*' ? 0 : b.page === dest.path ? 2 : 1));
      const settings = new Map();
      for (const e of applicable) if (typeof e.hidden === 'boolean' && /^#[A-Za-z_][A-Za-z0-9_-]*$/.test(e.selector)) settings.set(e.selector, e.hidden);
      anchorSettings.set(dest.path, settings);
    }
    return anchorSettings.get(dest.path).get(dest.hash) === true;
  };
  // Removing a Her world entry also removes its orbit counterpart. Link edits follow that same counterpart.
  for (const before of worldBefore) {
    const removed = before.node.closest('[data-owner-hidden="true"]');
    const href = before.node.getAttribute('href');
    for (const orb of many(root, '.lp-planets a[href]')) {
      if (orb.getAttribute('href') !== before.href) continue;
      if (removed) hide(state, linkContainer(orb));
      if (href !== before.href) setAttr(state, orb, 'href', href);
    }
  }
  for (const link of many(root, 'a[href]')) {
    if (link.closest('[data-owner-page-notice]')) continue;
    const dest = destination(link.getAttribute('href'), state);
    if (!dest || protectedPath(dest.path)) continue;
    const page = pageForPath(data.pages, dest.path);
    const hashId = dest.hash.slice(1);
    const globalSection = hiddenAnchor(dest);
    const hiddenSection = globalSection || (dest.path === path && hiddenIds.has(hashId));
    if (page?.hidden || hiddenSection) hide(state, linkContainer(link));
  }
  if (path === '/' && (hiddenIds.has('playground') || pageForPath(data.pages, '/talk')?.hidden)) {
    for (const button of many(root, '[data-open-chat]')) hide(state, button);
  }
  const count = one(root, '#lp-eco-label span');
  if (count) {
    const n = many(root, '.lp-eco > ul > li').filter((li) => !li.closest('[data-owner-hidden="true"]')).length;
    setText(state, count, `(${String(n).padStart(2, '0')})`);
  }
}

function pageNotice(state, page, path) {
  const root = state.root;
  let notice = one(root, '[data-owner-page-notice]');
  let previewNote = one(root, '.site-content-preview-note');
  const hidden = Boolean(page?.hidden && !protectedPath(path));
  if (hidden && state.preview) {
    if (!previewNote) { previewNote = markGenerated(make(root, 'p', 'site-content-preview-note', 'Hidden page · owner preview')); root.body.append(previewNote); }
  } else previewNote?.remove();
  root.body.removeAttribute('data-owner-page-hidden');
  if (!hidden || state.preview) { notice?.remove(); return; }
  root.body.setAttribute('data-owner-page-hidden', 'true');
  if (!notice) {
    notice = make(root, 'div', 'site-content-notice');
    notice.setAttribute('data-owner-page-notice', 'true');
    notice.append(make(root, 'h1', '', "This page isn't available"), make(root, 'p', '', 'It has been taken off the website.'));
    if (path !== '/' && !pageForPath(state.document.pages, '/')?.hidden) {
      const back = make(root, 'a', '', 'Back to AGI'); back.href = '/'; notice.append(back);
    }
    root.body.append(notice);
  }
}

export function applySiteContent(data, root = document) {
  if (!root.body) return;
  const state = stateFor(root);
  const path = currentPath(root);
  state.document = data && typeof data === 'object' ? data : { pages: [], edits: [] };
  state.applying = true;
  state.observer?.disconnect();
  try {
    restore(state);
    // Recovery/admin pages must remain reachable, including after a Studio SPA navigation.
    if (protectedPath(path)) {
      for (const node of state.generated) node.remove();
      state.generated = []; state.blockKey = ''; state.watch = false;
      root.body.removeAttribute('data-owner-page-hidden');
      one(root, '[data-owner-page-notice]')?.remove();
      one(root, '.site-content-preview-note')?.remove();
      if (state.lastTitle === root.title) root.title = state.title;
      state.lastTitle = null;
      return;
    }
    const contentKey = JSON.stringify(state.document);
    if (state.contentKey !== contentKey) {
      state.contentKey = contentKey;
      const win = root.defaultView;
      if (win?.CustomEvent) win.dispatchEvent(new win.CustomEvent('agi-site-content', { detail: { document: state.document } }));
    }
    const page = pageForPath(state.document.pages, path);
    const exactPage = page && normalizePath(page.path) === path ? page : null;
    if (root.title !== state.lastTitle) state.title = root.title;
    if (exactPage?.title) { root.title = `${exactPage.title} · AGI`; state.lastTitle = root.title; }
    else { if (root.title === state.lastTitle) root.title = state.title; state.lastTitle = null; }
    const desc = one(root, 'meta[name="description"]');
    if (desc && exactPage?.description) setAttr(state, desc, 'content', exactPage.description);
    const worldBefore = many(root, '.lp-eco li a[href]').filter((n) => !n.closest('[data-owner-generated]')).map((node) => ({ node, href: node.getAttribute('href') }));
    const allEdits = Array.isArray(state.document.edits) ? state.document.edits : [];
    const edits = allEdits.filter((e) => e.page === '*' || normalizePath(e.page) === path || (path === '/talk' && e.page === '/'))
      .sort((a, b) => (a.page === '*' ? 0 : a.page === path ? 2 : 1) - (b.page === '*' ? 0 : b.page === path ? 2 : 1));
    state.watch = Boolean(edits.length || exactPage?.blocks?.length || one(root, '[data-owner-custom-page]') || state.document.pages?.some((p) => p.hidden) || allEdits.some((e) => e.hidden));
    for (const edit of edits) {
      if (typeof edit.selector !== 'string' || edit.selector.length > 600) continue;
      const node = targetFor(state, edit.selector);
      if (!selectable(node)) continue;
      if (edit.hidden) {
        hide(state, node);
      } else if (edit.hidden === false) setAttr(state, node, 'data-owner-hidden', null);
      if (typeof edit.text === 'string') setText(state, node, edit.text);
      if (tagOf(node) === 'a' && typeof edit.href === 'string') {
        const href = safeContentLink(edit.href, root.defaultView?.location?.origin);
        if (href || edit.href === '') setAttr(state, node, 'href', href);
      }
      if (tagOf(node) === 'img') {
        if (typeof edit.src === 'string') { const src = safeContentImage(edit.src); if (src || edit.src === '') { setAttr(state, node, 'src', src); setAttr(state, node, 'srcset', null); } }
        if (typeof edit.alt === 'string') setAttr(state, node, 'alt', edit.alt.slice(0, 500));
      }
    }
    const hiddenIds = new Set(many(root, '[data-owner-hidden="true"]').flatMap((node) => [node, ...many(node, '[id]')]).map((n) => n.id).filter(Boolean));
    renderBlocks(state, exactPage, path);
    syncLinks(state, state.document, path, hiddenIds, worldBefore);
    pageNotice(state, page, path);
  } finally {
    state.applying = false;
    state.observe?.();
  }
}

function previewAllowed(root) {
  const win = root.defaultView;
  if (!win || win.parent === win || new URLSearchParams(win.location.search).get('ownerPreview') !== '1') return false;
  try { const ref = new URL(root.referrer); return ref.origin === win.location.origin && normalizePath(ref.pathname) === '/owner'; }
  catch { return false; }
}

export function startSiteContent(root = document) {
  const win = root.defaultView;
  if (!root.body || !win) return null;
  const state = stateFor(root);
  if (state.started) return state;
  state.started = true;
  state.preview = previewAllowed(root);
  let timer = 0;
  let readyTimer = 0;
  let previewReceived = false;
  let picking = false;
  let hovered = null;
  let stopped = false;
  const send = (type, payload = {}) => { if (state.preview) win.parent.postMessage({ type, ...payload }, win.location.origin); };
  const ready = () => { if (state.preview) send('agi-owner-ready', { path: currentPath(root), items: collectItems(root) }); };
  const scheduleReady = () => { if (state.preview && !readyTimer) readyTimer = win.setTimeout(() => { readyTimer = 0; ready(); }, 250); };
  const schedule = () => {
    if (state.applying || stopped || timer) return;
    timer = win.setTimeout(() => { timer = 0; applySiteContent(state.document, root); scheduleReady(); }, 120);
  };
  if (typeof win.MutationObserver === 'function') {
    state.observer = new win.MutationObserver(() => { if (state.watch || state.preview) schedule(); });
    state.observe = () => { if (state.watch || state.preview) state.observer.observe(root.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['href', 'src', 'alt', 'hidden', 'id'] }); };
    state.observe();
  }
  const picked = (target) => {
    let node = target?.nodeType === 1 ? target : target?.parentElement;
    while (node && node !== root.body) { if (selectable(node)) return node; node = node.parentElement; }
    return null;
  };
  const unhover = () => { hovered?.removeAttribute('data-owner-pick-hover'); hovered = null; };
  if (state.preview) {
    root.documentElement.setAttribute('data-owner-preview', 'true');
    // The editor opens ready for selection; its first-visit animation is only for ordinary visitors.
    root.documentElement.classList.remove('lp-loading', 'lp-intro');
    root.documentElement.classList.add('lp-go');
    win.addEventListener('message', (event) => {
      if (event.origin !== win.location.origin || event.source !== win.parent || !event.data || typeof event.data !== 'object') return;
      if (event.data.type === 'agi-owner-preview' && event.data.document && typeof event.data.document === 'object') {
        previewReceived = true;
        applySiteContent(event.data.document, root);
        scheduleReady();
      } else if (event.data.type === 'agi-owner-pick') {
        picking = event.data.enabled === true;
        root.documentElement.setAttribute('data-owner-picking', String(picking));
        unhover();
      }
    });
    win.addEventListener('pointerover', (event) => {
      if (!picking) return;
      const node = picked(event.target);
      if (node === hovered) return;
      unhover(); hovered = node; hovered?.setAttribute('data-owner-pick-hover', 'true');
    }, true);
    const select = (event) => {
      if (!picking) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.type !== 'click') return;
      const item = itemFor(picked(event.target));
      if (item) send('agi-owner-selected', { item });
    };
    for (const event of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'click', 'dblclick', 'submit']) win.addEventListener(event, select, { capture: true, passive: false });
    win.addEventListener('keydown', (event) => {
      if (!picking) return;
      if (event.key === 'Escape') { picking = false; root.documentElement.setAttribute('data-owner-picking', 'false'); unhover(); return; }
      if (event.key === 'Enter' || event.key === ' ') select(event);
    }, true);
    ready();
  }
  const refresh = async () => {
    if (stopped || root.visibilityState === 'hidden' || (state.preview && previewReceived)) return;
    const controller = new AbortController();
    const timeout = win.setTimeout(() => controller.abort(), 7000);
    const unavailable = () => {
      if (state.preview && previewReceived) return;
      const loading = one(root, '[data-owner-custom-page] [data-owner-loading]');
      if (loading) loading.textContent = "This page couldn't be loaded. Please try refreshing in a moment.";
    };
    try {
      const res = await win.fetch(API, { signal: controller.signal, credentials: 'same-origin' });
      if (!res.ok) { unavailable(); return; }
      const data = await res.json();
      if (!data?.ready || !data.document) { unavailable(); return; }
      if (state.preview && previewReceived) return;
      const key = JSON.stringify(data.document);
      if (state.fetchedKey === key) return;
      state.fetchedKey = key;
      applySiteContent(data.document, root);
      scheduleReady();
    } catch { unavailable(); /* An unavailable content service leaves the original website usable. */ }
    finally { win.clearTimeout(timeout); }
  };
  state.refresh = refresh;
  // Studio uses pushState; observing only DOM changes misses a route with identical markup.
  const history = win.history;
  for (const method of ['pushState', 'replaceState']) {
    const original = history[method];
    history[method] = function (...args) { const result = original.apply(this, args); schedule(); return result; };
  }
  win.addEventListener('popstate', schedule);
  root.addEventListener('visibilitychange', () => { if (root.visibilityState !== 'hidden') refresh(); });
  let interval = win.setInterval(refresh, 15000);
  win.addEventListener('pagehide', () => { stopped = true; state.observer?.disconnect(); win.clearInterval(interval); win.clearTimeout(timer); win.clearTimeout(readyTimer); });
  win.addEventListener('pageshow', (event) => { if (event.persisted) { stopped = false; timer = 0; readyTimer = 0; state.observe?.(); interval = win.setInterval(refresh, 15000); refresh(); scheduleReady(); } });
  refresh();
  return state;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => startSiteContent(), { once: true });
  else startSiteContent();
}
