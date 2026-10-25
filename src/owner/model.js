// Shared, deliberately small content format. It carries text and safe URLs, never HTML or code.
import { MEMES } from '../memes/list.js';
import { validateMemes, publicMemes, safeMemeUrl } from './media-model.js';
export const SITE_CONTENT_MAX = 300_000;
export const emptyDocument = () => ({ pages: [], edits: [] });
const own = (o, key) => Object.prototype.hasOwnProperty.call(o, key);
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const ID = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,119}$/;
const RESERVED = /^\/(?:owner|api|src|assets|public|node_modules|\.well-known)(?:\/|$)|^\/(?:vote|studio)\/owner(?:\/|$)/;
export function validPagePath(value) {
  return typeof value === 'string' && value.length <= 180 && (value === '/' || /^\/[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*$/.test(value)) && !RESERVED.test(value);
}

export function safeUrl(value, { image = false } = {}) {
  if (typeof value !== 'string') return false;
  if (value === '') return true;
  if (image && safeMemeUrl(value, { imageOnly: true })) return true;
  if (image && /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) return value.length <= 150_000;
  if (value.length > 2048 || /[\s\x00-\x1f\x7f<>"`\\]/.test(value)) return false;
  if (value.startsWith('#')) return !image && value.length > 1;
  if (value.startsWith('/')) return !value.startsWith('//') && !/%(?:2f|5c|0[0-9a-f]|1[0-9a-f]|7f)/i.test(value);
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && (!image || ['agi1.app', 'www.agi1.app', 'live.agi1.app'].includes(url.hostname));
  } catch { return false; }
}

// Only structural selectors emitted by the editor. No CSS, arbitrary attributes or executable elements.
const TOKEN = /^(?:(?:[a-z][a-z0-9-]*)|(?:[.#][a-zA-Z_][a-zA-Z0-9_-]*)|(?:\[data-owner-key=(?:"[a-zA-Z0-9_.:/-]+"|'[a-zA-Z0-9_.:/-]+')\]))(?:(?:[.#][a-zA-Z_][a-zA-Z0-9_-]*)|(?::nth-of-type\([1-9][0-9]{0,4}\)))*$/;
const FORBIDDEN_TAG = /^(?:html|body|head|script|style|meta|link|base|iframe|object|embed|input|textarea|select|option)(?:[.#:]|$)/i;
export function safeSelector(value) {
  if (typeof value !== 'string' || !value || value.length > 800 || value.trim() !== value) return false;
  const parts = value.split(/\s*>\s*|\s+/);
  return parts.length <= 24 && parts.every((p) => TOKEN.test(p) && !FORBIDDEN_TAG.test(p));
}

function text(value, max, label, fallback = '') {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || value.length > max || /\x00/.test(value)) throw new Error(`${label} is too long or isn't text.`);
  return value;
}
function flag(value, label) {
  if (value !== undefined && typeof value !== 'boolean') throw new Error(`${label} must be on or off.`);
  return value === true;
}
function url(value, label, image = false) {
  const v = value ?? '';
  if (!safeUrl(v, { image })) throw new Error(image ? `${label}: use a site image path or an uploaded PNG, JPEG or WebP.` : `${label}: use an https link, a /page path or a #section.`);
  return v;
}
export function validateDocument(input) {
  try {
    if (!object(input) || !Array.isArray(input.pages) || !Array.isArray(input.edits)) throw new Error('The site content is incomplete. Reload and try again.');
    if (input.pages.length > 150 || input.edits.length > 1500) throw new Error('This site has reached its content limit. Remove unused entries first.');
    const paths = new Set(), editIds = new Set(), targets = new Set();
    let blocksTotal = 0;
    const pages = input.pages.map((p) => {
      if (!object(p) || !validPagePath(p.path) || paths.has(p.path)) throw new Error('Each page needs a unique /page address. Owner and system pages are protected.');
      paths.add(p.path);
      const custom = flag(p.custom, 'Custom page');
      if (custom && !/^\/p\/[a-z0-9][a-z0-9-]*$/.test(p.path)) throw new Error('New pages use /p/ followed by a short page name.');
      if (p.blocks !== undefined && !Array.isArray(p.blocks)) throw new Error('The sections are incomplete.');
      const ids = new Set();
      const blocks = (p.blocks || []).map((b) => {
        if (!object(b) || !ID.test(b.id || '') || ids.has(b.id)) throw new Error('Each section needs its own ID.');
        ids.add(b.id); blocksTotal++;
        const placement = b.placement ?? 'end';
        if (!['end', 'start', 'before', 'after', 'world'].includes(placement)) throw new Error('Choose where the section belongs.');
        if (placement === 'world' && p.path !== '/') throw new Error('Her World entries belong on the home page.');
        if (['before', 'after'].includes(placement) && !safeSelector(b.anchor)) throw new Error('Choose an existing section to place this beside.');
        return { id: b.id, title: text(b.title, 240, 'Section title'), text: text(b.text, 12_000, 'Section text'), image: url(b.image, 'Section image', true), alt: text(b.alt, 500, 'Image description'), href: url(b.href, 'Section link'), label: text(b.label, 160, 'Link label'), hidden: flag(b.hidden, 'Section visibility'), placement, ...(['before', 'after'].includes(placement) ? { anchor: b.anchor } : {}) };
      });
      return { path: p.path, title: text(p.title, 240, 'Page title'), hidden: flag(p.hidden, 'Page visibility'), custom, description: text(p.description, 1200, 'Page description'), blocks };
    });
    if (blocksTotal > 500) throw new Error('This site has reached its limit of 500 added sections.');
    const edits = input.edits.map((e) => {
      if (!object(e) || !ID.test(e.id || '') || editIds.has(e.id)) throw new Error('Each change needs its own ID.');
      if (!(e.page === '*' || validPagePath(e.page)) || !safeSelector(e.selector)) throw new Error('Choose a page element in the preview. Owner and system pages are protected.');
      const target = `${e.page}\n${e.selector}`;
      if (targets.has(target)) throw new Error('An element has more than one change. Reload the editor.');
      targets.add(target); editIds.add(e.id);
      const result = { id: e.id, page: e.page, selector: e.selector };
      if (own(e, 'text')) result.text = text(e.text, 12_000, 'Element text');
      if (own(e, 'href')) result.href = url(e.href, 'Link');
      if (own(e, 'src')) result.src = url(e.src, 'Image', true);
      if (own(e, 'alt')) result.alt = text(e.alt, 500, 'Image description');
      if (own(e, 'hidden')) result.hidden = flag(e.hidden, 'Element visibility');
      if (Object.keys(result).length === 3) throw new Error('Choose something to change for this element.');
      return result;
    });
    const document = { pages, edits, ...(input.memes !== undefined ? { memes: validateMemes(input.memes, MEMES) } : {}) };
    if (new TextEncoder().encode(JSON.stringify(document)).length > SITE_CONTENT_MAX) throw new Error('The site content is too large. Use smaller images or remove unused changes.');
    return { ok: true, document };
  } catch (err) { return { ok: false, why: err.message || 'The site content could not be checked.' }; }
}

export function publicDocument(document) {
  const hidden = new Set(document.pages.filter((p) => p.hidden).map((p) => p.path));
  return {
    pages: document.pages.map((p) => p.hidden ? { path: p.path, title: '', hidden: true, custom: p.custom, description: '', blocks: [] } : { ...p, blocks: p.blocks.filter((b) => !b.hidden) }),
    edits: document.edits.filter((e) => !hidden.has(e.page)).map((e) => e.hidden ? { id: e.id, page: e.page, selector: e.selector, hidden: true } : e),
    ...(document.memes !== undefined ? { memes: publicMemes(document.memes) } : {}),
  };
}
