import { readFileSync } from 'node:fs';

// Enough DOM behavior to run the terminal's real event handlers and preserve keyed nodes.
// Layout, native dialogs and the chart canvas are checked in the browser separately.
export class Element {
  constructor(tag = '#text', text = '') {
    this.tagName = tag; this._text = text; this.childNodes = []; this.parentNode = null; this.dataset = {};
    this.attrs = {}; this.events = {}; this.className = ''; this.value = ''; this.hidden = false;
    this.disabled = false; this.checked = false; this.open = false; this.style = { setProperty() {} };
    this.classList = { contains: (c) => this.className.split(' ').includes(c), toggle: (c, on) => {
      const list = new Set(this.className.split(' ').filter(Boolean));
      if (on) list.add(c); else list.delete(c);
      this.className = [...list].join(' ');
    }, remove: (c) => this.classList.toggle(c, false), add: (c) => this.classList.toggle(c, true) };
  }
  get children() { return this.childNodes.filter((n) => n.tagName !== '#text'); }
  get textContent() { return this._text + this.childNodes.map((n) => n.textContent).join(''); }
  set textContent(t) { this.replaceChildren(); this._text = String(t); }
  get firstChild() { return this.childNodes[0] || null; }
  get lastChild() { return this.childNodes.at(-1) || null; }
  get nextSibling() { return this.parentNode?.childNodes[this.parentNode.childNodes.indexOf(this) + 1] || null; }
  get isConnected() { return this === globalThis.document?.body || Boolean(this.parentNode?.isConnected); }
  get ownerDocument() { return globalThis.document; }
  append(...items) { for (const n of items) { n.remove(); n.parentNode = this; this.childNodes.push(n); } }
  remove() { if (this.parentNode) this.parentNode.childNodes.splice(this.parentNode.childNodes.indexOf(this), 1); this.parentNode = null; }
  replaceWith(n) { const p = this.parentNode; if (p) { p.insertBefore(n, this); this.remove(); } }
  replaceChildren(...items) { for (const n of this.childNodes) n.parentNode = null; this.childNodes = []; this._text = ''; this.append(...items); }
  insertBefore(n, before) {
    n.remove(); n.parentNode = this;
    const i = this.childNodes.indexOf(before);
    if (i < 0) this.childNodes.push(n); else this.childNodes.splice(i, 0, n);
  }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'value') this.value = String(v); if (k === 'class') this.className = String(v); }
  getAttribute(k) { return this.attrs[k] ?? null; }
  addEventListener(k, fn) { (this.events[k] ||= []).push(fn); }
  removeEventListener(k, fn) { this.events[k] = (this.events[k] || []).filter((f) => f !== fn); }
  fire(k, details = {}) { for (const fn of this.events[k] || []) fn({ target: this, preventDefault() {}, stopPropagation() {}, ...details }); }
  click() { if (!this.disabled) this.fire('click'); }
  focus() { globalThis.document.activeElement = this; }
  matches(selector) {
    return selector.split(',').some((s) => {
      const part = s.trim();
      if (part.startsWith('.')) return this.classList.contains(part.slice(1));
      const attr = /^\[([^=\]]+)(?:="([^"]*)")?\]$/.exec(part);
      if (attr) return attr[2] === undefined ? this.getAttribute(attr[1]) !== null : this.getAttribute(attr[1]) === attr[2];
      return this.tagName === part;
    });
  }
  querySelectorAll(selector) { return this.children.flatMap((n) => [...(n.matches(selector) ? [n] : []), ...n.querySelectorAll(selector)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  closest(selector) { return this.matches(selector) ? this : this.parentNode?.closest(selector) || null; }
  showModal() { this.open = true; }
  close() { this.open = false; }
  getContext() { return { clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {} }; }
}

export function installDom(store = new Map()) {
  globalThis.Node = Element;
  globalThis.document = { createElement: (tag) => new Element(tag), createTextNode: (v) => new Element('#text', v),
    createElementNS: (_, tag) => new Element(tag), body: new Element('body'), activeElement: null };
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  return store;
}

export const chartURL = 'data:text/javascript;base64,' + Buffer.from(`
  export function createGChart() { const state = {sets:[],views:[],indicators:[],destroyed:false};
    globalThis.__phomoChart = state; return { set(d){state.sets.push(d)},view(d){state.views.push(d)},
    indicators(d){state.indicators=d},zoom(){},fit(){},destroy(){state.destroyed=true} }; }
  export function chartCredit() { return document.createElement('p'); }
`).toString('base64');

export const phomoChartURL = 'data:text/javascript;base64,' + Buffer.from(`
  export function createPhomoChart(host, options = {}) {
    const state = {sets:[],views:[],indicators:[],destroyed:false,visible:true,scale:'normal',auto:true,style:'candles',tool:'cursor',drawings:[],selected:null,canUndo:false,canRedo:false};
    globalThis.__phomoChart = state;
    const update = (patch) => { Object.assign(state, patch); options.onChange?.(state); };
    return {state, set(d){state.sets.push(d)},view(d){state.views.push(d)},indicators(d){state.indicators=d},
      style(style){update({style})},settings(settings){update(settings)},scale(scale){update({scale})},auto(auto){update({auto})},
      range(range){update({range})},drawTool(tool){update({tool})},showDrawings(visible){update({visible})},
      zoom(){},fit(){},toNow(){},redraw(){},undo(){},redo(){},lockSelected(){},removeSelected(){},clearDrawings(){},
      screenshot(){return null},destroy(){state.destroyed=true}};
  }
`).toString('base64');

export function viewModule(file, replacements = {}) {
  const source = readFileSync(file, 'utf8').replace(/import '[^']+\.css';/g, '')
    .replace(/from '([^']+)'/g, (_, p) => `from '${replacements[p] || new URL(p, file).href}'`)
    + `\n//# sourceURL=${file.pathname.split('/').at(-1)}-under-test.mjs`;
  return 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
}

export const coinModuleURL = viewModule(new URL('../../src/games/trenchingsimulator/boards/phomo-coin.js', import.meta.url), { './gchart.js': chartURL, './phomo-chart.js': phomoChartURL });
export const socialModuleURL = viewModule(new URL('../../src/games/trenchingsimulator/boards/phomo-social.js', import.meta.url), { './gchart.js': chartURL, './phomo-chart.js': phomoChartURL });
export const nodes = (n) => [n, ...n.childNodes.flatMap((x) => nodes(x))];
export const byClass = (host, s) => nodes(host).find((n) => n.classList.contains(s));
export const byLabel = (host, s) => nodes(host).find((n) => n.getAttribute('aria-label') === s);
export const byText = (host, s) => nodes(host).find((n) => n.tagName === 'button' && n.textContent === s);
