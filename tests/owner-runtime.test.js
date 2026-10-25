import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizePath, protectedPath, pageForPath } from '../src/owner/catalog.js';

// Exercise the actual runtime with a small DOM, without a wallet, database, browser installation or network.
const source = readFileSync(new URL('../src/owner/runtime.js', import.meta.url), 'utf8')
  .replace(/^import '[^']+\.css';$/gm, '')
  .replace(/from '(\.\/[^']+)'/g, (_, p) => `from '${new URL(p, new URL('../src/owner/runtime.js', import.meta.url)).href}'`);
const { applySiteContent, startSiteContent, getSiteContent, collectItems, selectorFor, safeContentLink, safeContentImage } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

class Node {
  constructor(doc, tag, value = '') { this.ownerDocument = doc; this.nodeType = tag === '#text' ? 3 : 1; this.tagName = tag.toUpperCase(); this.value = value; this.attrs = new Map(); this.childNodes = []; this.parentElement = null; }
  get children() { return this.childNodes.filter(n => n.nodeType === 1); }
  get textContent() { return this.nodeType === 3 ? this.value : this.childNodes.map(n => n.textContent).join(''); }
  set textContent(value) { if (this.nodeType === 3) this.value = String(value); else { for (const n of this.childNodes) n.parentElement = null; this.childNodes = []; if (String(value)) this.append(this.ownerDocument.createTextNode(value)); } }
  get isConnected() { return this === this.ownerDocument.documentElement || Boolean(this.parentElement?.isConnected); }
  get id() { return this.getAttribute('id') || ''; }
  set id(v) { this.setAttribute('id', v); }
  get className() { return this.getAttribute('class') || ''; }
  set className(v) { this.setAttribute('class', v); }
  get classList() { return { add: (...names) => { this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), ...names])].join(' '); }, remove: (...names) => { this.className = this.className.split(/\s+/).filter(n => !names.includes(n)).join(' '); } }; }
  set href(v) { this.setAttribute('href', v); }
  set src(v) { this.setAttribute('src', v); }
  set alt(v) { this.setAttribute('alt', v); }
  setAttribute(k, v) { this.attrs.set(k, String(v)); }
  getAttribute(k) { return this.attrs.get(k) ?? null; }
  hasAttribute(k) { return this.attrs.has(k); }
  removeAttribute(k) { this.attrs.delete(k); }
  append(...nodes) { for (let n of nodes) { if (typeof n === 'string') n = this.ownerDocument.createTextNode(n); n.remove(); n.parentElement = this; this.childNodes.push(n); } }
  prepend(...nodes) { for (const n of nodes.reverse()) this.insertBefore(n, this.childNodes[0] || null); }
  insertBefore(node, before) { node.remove(); const i = this.childNodes.indexOf(before); node.parentElement = this; if (i < 0) this.childNodes.push(node); else this.childNodes.splice(i, 0, node); }
  before(node) { this.parentElement.insertBefore(node, this); }
  after(node) { const p = this.parentElement; p.insertBefore(node, p.childNodes[p.childNodes.indexOf(this) + 1] || null); }
  remove() { if (this.parentElement) { const p = this.parentElement; p.childNodes.splice(p.childNodes.indexOf(this), 1); this.parentElement = null; } }
  closest(s) { return this.matches(s) ? this : this.parentElement?.closest(s) || null; }
  simple(s) {
    const nth = /:nth-of-type\((\d+)\)$/.exec(s);
    if (nth) { s = s.slice(0, nth.index); const peers = this.parentElement?.children.filter(n => n.tagName === this.tagName) || []; if (peers.indexOf(this) + 1 !== Number(nth[1])) return false; }
    const attrs = [...s.matchAll(/\[([^=\]]+)(?:="([^"]*)")?\]/g)];
    for (const [, key, value] of attrs) if (!this.hasAttribute(key) || (value !== undefined && this.getAttribute(key) !== value)) return false;
    s = s.replace(/\[[^\]]+\]/g, '');
    const id = /#([\w-]+)/.exec(s); if (id && this.id !== id[1]) return false;
    for (const [, cls] of s.matchAll(/\.([\w-]+)/g)) if (!this.className.split(/\s+/).includes(cls)) return false;
    const tag = /^[a-z][\w-]*/i.exec(s); return !tag || this.tagName === tag[0].toUpperCase();
  }
  matches(selector) {
    if (this.nodeType !== 1) return false;
    return selector.split(',').some(s => {
      s = s.trim(); const direct = s.includes('>'); const parts = s.split(direct ? /\s*>\s*/ : /\s+/); let at = this;
      if (!at.simple(parts.pop())) return false;
      while (parts.length) { const part = parts.pop(); at = at.parentElement; if (!direct) while (at && !at.simple(part)) at = at.parentElement; if (!at || !at.simple(part)) return false; }
      return true;
    });
  }
  querySelectorAll(s) { return this.children.flatMap(n => [...(n.matches(s) ? [n] : []), ...n.querySelectorAll(s)]); }
  querySelector(s) { return this.querySelectorAll(s)[0] || null; }
}
function fixture(path = '/') {
  const doc = { title: 'Original title', defaultView: { location: new URL(path, 'https://agi1.app') }, createElement(tag) { return new Node(this, tag); }, createTextNode(value) { return new Node(this, '#text', String(value)); } };
  doc.documentElement = doc.createElement('html'); doc.body = doc.createElement('body'); doc.documentElement.append(doc.body);
  doc.querySelectorAll = s => doc.documentElement.querySelectorAll(s); doc.querySelector = s => doc.querySelectorAll(s)[0] || null;
  const el = (tag, attrs = {}, text = '') => { const n = doc.createElement(tag); for (const [k,v] of Object.entries(attrs)) n.setAttribute(k, v); if (text) n.textContent = text; return n; };
  const main = el('main', { id: 'main' }); doc.body.append(main);
  return { doc, el, main };
}
const empty = () => ({ pages: [], edits: [] });
const edit = (selector, properties, page = '/') => ({ id: 'test', page, selector, ...properties });
const hidden = n => n.getAttribute('data-owner-hidden') === 'true';

test('aliases and protected recovery pages cannot be hidden through their parent path', () => {
  assert.equal(normalizePath('/rideemagi.html?dev=1'), '/games/rideemagi');
  assert.equal(normalizePath('/index.html/'), '/');
  assert.equal(normalizePath('/studio/explore/'), '/studio/explore');
  assert.equal(protectedPath('/vote/owner/'), true);
  assert.equal(protectedPath('/studio/owner'), true);
  assert.equal(pageForPath([{ path: '/studio', hidden: true }], '/studio/create').hidden, true);
});

test('content links reject executable URLs and image sources respect the production CSP', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,hi', '//evil.test/a', 'https://name:secret@example.com/', '/%2fexample.com']) assert.equal(safeContentLink(url), null);
  assert.equal(safeContentLink('/games#rate'), '/games#rate');
  assert.equal(safeContentLink('https://example.com/path'), 'https://example.com/path');
  assert.equal(safeContentImage('https://example.com/picture.png'), null);
  assert.equal(safeContentImage('data:image/svg+xml;base64,AAAA'), null);
  assert.equal(safeContentImage('https://agi1.app/images/photo.webp'), '/images/photo.webp');
  assert.equal(safeContentImage('/images/photo.webp'), '/images/photo.webp');
});

test('editing preserves child controls and restores the original text only until the override is removed', () => {
  const { doc, el, main } = fixture();
  const a = el('a', { id:'greet', href:'/talk' }, 'Original '), small = el('small', {}, 'caption'); a.append(small); main.append(a);
  applySiteContent({ pages:[], edits:[edit('#greet', { text:'Changed ', href:'/games' })] }, doc);
  assert.equal(a.textContent, 'Changed caption'); assert.equal(a.children[0], small); assert.equal(a.getAttribute('href'), '/games');
  applySiteContent(empty(), doc);
  assert.equal(a.textContent, 'Original caption'); assert.equal(a.getAttribute('href'), '/talk');
  a.childNodes[0].textContent = 'New app value ';
  applySiteContent(empty(), doc);
  assert.equal(a.textContent, 'New app value caption');
});

test('clearing link or image fields takes effect and reset restores source attributes', () => {
  const { doc, el, main } = fixture(); const a=el('a',{id:'link',href:'/games'},'Go'), img=el('img',{id:'photo',src:'/images/original.webp',srcset:'/images/large.webp 2x'}); main.append(a,img);
  applySiteContent({pages:[],edits:[edit('#link',{href:''}),{...edit('#photo',{src:''}),id:'image'}]},doc);
  assert.equal(a.getAttribute('href'),null);assert.equal(img.getAttribute('src'),null);assert.equal(img.getAttribute('srcset'),null);
  applySiteContent(empty(),doc);assert.equal(a.getAttribute('href'),'/games');assert.equal(img.getAttribute('src'),'/images/original.webp');
});

test('a blank Her world description can be added, cleared, reset and applied on a fresh page', () => {
  const make = () => {
    const f=fixture(), nav=f.el('nav',{class:'lp-eco'}), list=f.el('ul'), row=f.el('li');
    const link=f.el('a',{href:'#checker'},'Risk check your coins on clank'), arrow=f.el('i',{},'↓');
    link.append(arrow);row.append(link);list.append(row);nav.append(list);f.main.append(nav);
    const previousLinkSelector=selectorFor(link), previousArrowSelector=selectorFor(arrow);
    const note=f.el('small',{id:'lp-checker-description'});arrow.before(note);
    assert.equal(selectorFor(link),previousLinkSelector);assert.equal(selectorFor(arrow),previousArrowSelector);
    return {...f,row,link,arrow,note,linkSelector:previousLinkSelector};
  };
  const f=make();
  const item=collectItems(f.doc).find(i=>i.kind==='world');
  assert.equal(item.noteSelector,'#lp-checker-description');assert.equal(item.noteText,'');
  const saved={pages:[],edits:[edit(f.linkSelector,{text:'ClankChecker'}),{...edit(item.noteSelector,{text:'Check a coin before you trade'}),id:'description'}]};
  applySiteContent(saved,f.doc);assert.equal(f.note.textContent,'Check a coin before you trade');
  assert.match(f.link.textContent,/^ClankChecker/);assert.equal(f.link.getAttribute('href'),'#checker');assert.equal(f.arrow.textContent,'↓');
  const cleared={...saved,edits:[saved.edits[0],{...saved.edits[1],text:''}]};
  applySiteContent(cleared,f.doc);assert.equal(f.note.textContent,'');
  applySiteContent(saved,f.doc);assert.equal(f.note.textContent,'Check a coin before you trade');
  applySiteContent(empty(),f.doc);assert.equal(f.note.textContent,'');assert.match(f.link.textContent,/^Risk check your coins on clank/);
  const fresh=make();applySiteContent(saved,fresh.doc);assert.equal(fresh.note.textContent,'Check a coin before you trade');
  const unrelated=f.el('small',{id:'unrelated-blank'});f.main.append(unrelated);
  applySiteContent({pages:[],edits:[edit('#unrelated-blank',{text:'Must stay blank'})]},f.doc);assert.equal(unrelated.textContent,'');
});

test('a malicious selector cannot turn a script, base or form control into editable content', () => {
  const { doc, el, main } = fixture();const script=el('script',{id:'danger',src:'/app.js'},'safe()'), input=el('input',{id:'secret',value:'private'}), base=el('base',{id:'base',href:'/'});main.append(script,input,base);
  applySiteContent({pages:[],edits:[edit('#danger',{src:'/evil.js',text:'evil()'}),{...edit('#secret',{text:'leak'}),id:'input'},{...edit('#base',{href:'https://evil.test'}),id:'base'}]},doc);
  assert.equal(script.getAttribute('src'),'/app.js');assert.equal(script.textContent,'safe()');assert.equal(base.getAttribute('href'),'/');
  assert.equal(collectItems(doc).some(i=>['#danger','#secret','#base'].includes(i.selector)),false);
});

test('removing a Her world row removes its orbit counterpart and updates the visible count', () => {
  const { doc, el, main }=fixture();const nav=el('nav',{class:'lp-eco'}),list=el('ul'),label=el('p',{id:'lp-eco-label'},'Her world '),count=el('span',{},'(01)');label.append(count);nav.append(label,list);
  const row=el('li',{id:'world-talk'}),link=el('a',{href:'#playground'},'Talk');row.append(link);list.append(row);main.append(nav);
  const orbit=el('ul',{class:'lp-planets'}),orb=el('li'),oa=el('a',{href:'#playground'},'AGI-1');orb.append(oa);orbit.append(orb);main.append(orbit);
  const rows = collectItems(doc); assert.equal(rows.filter(i => i.kind === 'world').length, 1); assert.equal(rows.filter(i => i.kind === 'orbit').length, 1);
  assert.equal(rows.find(i => i.kind === 'world').linkText, 'Talk');
  applySiteContent({pages:[],edits:[edit('#world-talk',{hidden:true})]},doc);
  assert.equal(hidden(row),true);assert.equal(hidden(orb),true);assert.equal(count.textContent,'(00)');
  applySiteContent(empty(),doc);assert.equal(hidden(row),false);assert.equal(hidden(orb),false);assert.equal(count.textContent,'(01)');
});

test('hidden homepage section links disappear from other pages too', () => {
  const { doc, el, main }=fixture('/diary');const link=el('a',{href:'/#playground'},'Playground');main.append(link);
  applySiteContent({pages:[],edits:[edit('#playground',{hidden:true})]},doc);assert.equal(hidden(link),true);
  applySiteContent(empty(),doc);assert.equal(hidden(link),false);
});

test('inserting blocks does not shift structural selectors or replace native nodes', () => {
  const { doc, el, main }=fixture();const first=el('section'),second=el('section'),heading=el('h2',{},'Original');second.append(heading);main.append(first,second);
  const selector=selectorFor(heading);assert.match(selector,/:nth-of-type\(2\)/);
  const data={pages:[{path:'/',title:'Home',blocks:[{id:'intro',title:'Inserted',placement:'start'}]}],edits:[edit(selector,{text:'Edited'})]};
  applySiteContent(data,doc);applySiteContent(data,doc);assert.equal(heading.textContent,'Edited');assert.equal(first.parentElement,main);assert.equal(second.parentElement,main);
  assert.equal(selectorFor(heading),selector);applySiteContent(empty(),doc);assert.equal(heading.textContent,'Original');assert.equal(main.children.length,2);
});

test('Studio recovery navigation clears prior runtime hides and custom blocks', () => {
  const { doc, el, main }=fixture('/studio/explore');const section=el('section',{id:'content'});main.append(section);
  const data={pages:[{path:'/studio',hidden:true},{path:'/studio/explore',hidden:true,blocks:[{id:'extra',text:'Extra'}]}],edits:[edit('#content',{hidden:true},'*')]};
  applySiteContent(data,doc);assert.equal(doc.body.getAttribute('data-owner-page-hidden'),'true');assert.equal(hidden(section),true);
  doc.defaultView.location=new URL('https://agi1.app/studio/owner');applySiteContent(data,doc);
  assert.equal(doc.body.getAttribute('data-owner-page-hidden'),null);assert.equal(hidden(section),false);assert.equal(doc.querySelector('[data-owner-page-notice]'),null);assert.equal(doc.querySelector('[data-owner-generated]'),null);
});

test('custom pages replace their loading state and render text without interpreting HTML', () => {
  const {doc,el,main}=fixture('/p/hello');main.setAttribute('data-owner-custom-page','');const loading=el('p',{'data-owner-loading':''},'Loading');main.append(loading);
  applySiteContent({pages:[{path:'/p/hello',custom:true,title:'Hello',blocks:[{id:'one',title:'<script>bad()</script>',text:'<img src=x onerror=bad()>',placement:'end'}]}],edits:[]},doc);
  assert.equal(loading.hidden,true);assert.equal(doc.querySelector('h1').textContent,'Hello');assert.equal(doc.querySelector('script'),null);assert.equal(doc.querySelector('img'),null);
});

test('adding a section without a custom description preserves the existing page metadata', () => {
  const {doc,el}=fixture();const meta=el('meta',{name:'description',content:'Original description'});doc.body.append(meta);
  applySiteContent({pages:[{path:'/',description:'',blocks:[{id:'one',text:'New section'}]}],edits:[]},doc);assert.equal(meta.getAttribute('content'),'Original description');
  applySiteContent({pages:[{path:'/',description:'Updated description',blocks:[]}],edits:[]},doc);assert.equal(meta.getAttribute('content'),'Updated description');
  applySiteContent(empty(),doc);assert.equal(meta.getAttribute('content'),'Original description');
});

function frameFixture(referrer = 'https://agi1.app/owner') {
  const f = fixture('/?ownerPreview=1'); const events = new Map(), messages = []; let timer = 0;
  const win = f.doc.defaultView; win.parent = { postMessage: (message, origin) => messages.push({message,origin}) };
  Object.assign(win, { addEventListener: (name, fn) => { const handlers = events.get(name) || []; handlers.push(fn); events.set(name, handlers); }, setTimeout: () => ++timer, clearTimeout() {}, setInterval: () => ++timer, clearInterval() {}, history: { pushState() {}, replaceState() {} }, fetch: async () => Response.json({ready:false}) });
  f.doc.referrer = referrer; f.doc.addEventListener = () => {}; f.doc.visibilityState = 'visible';
  return { ...f, win, events, messages, send: (message, origin = win.location.origin, source = win.parent) => { for (const fn of events.get('message') || []) fn({data:message,origin,source}); } };
}

test('only a same-origin owner frame can drive a draft preview or intercept a picker click', () => {
  const f = frameFixture(); const a = f.el('a',{id:'sample',href:'/games'},'Original');f.main.append(a);
  assert.equal(startSiteContent(f.doc).preview,true);assert.equal(f.messages[0].message.type,'agi-owner-ready');
  const message={type:'agi-owner-preview',document:{pages:[],edits:[edit('#sample',{text:'Draft'})]}};
  f.send(message,'https://evil.test');assert.equal(a.textContent,'Original');f.send(message,f.win.location.origin,{});assert.equal(a.textContent,'Original');
  f.send(message);assert.equal(a.textContent,'Draft');f.send({type:'agi-owner-pick',enabled:true});
  let prevented=false,stopped=false;for(const fn of f.events.get('click')||[])fn({type:'click',target:a,preventDefault(){prevented=true;},stopImmediatePropagation(){stopped=true;}});
  assert.equal(prevented,true);assert.equal(stopped,true);assert.equal(f.messages.at(-1).message.type,'agi-owner-selected');assert.equal(f.messages.at(-1).message.item.selector,'#sample');
});

test('a query flag or third-party embed alone never enables draft controls', () => {
  const f=frameFixture('https://evil.test/owner');assert.equal(startSiteContent(f.doc).preview,false);assert.equal(f.events.has('message'),false);assert.equal(f.events.has('click'),false);assert.equal(f.messages.length,0);
  const g=frameFixture('https://agi1.app/diary');assert.equal(startSiteContent(g.doc).preview,false);
});

test('picking any part of a Her world entry opens its complete editable name, description and link', () => {
  const f = frameFixture();
  const nav = f.el('nav', { class:'lp-eco' }), list = f.el('ul'), row = f.el('li');
  const link = f.el('a', { href:'/studio' }, 'AGI Studio '), dot = f.el('span', { class:'lp-dot' });
  const description = f.el('small', {}, 'your own AI influencer'), arrow = f.el('i', { 'aria-hidden':'true' }, '→');
  link.prepend(dot); link.append(description,arrow); row.append(link); list.append(row); nav.append(list); f.main.append(nav);
  startSiteContent(f.doc); f.send({type:'agi-owner-pick',enabled:true});
  for (const target of [row,link,dot,description,arrow,link.childNodes.find(n=>n.nodeType===3)]) {
    for (const handler of f.events.get('click') || []) handler({type:'click',target,preventDefault(){},stopImmediatePropagation(){}});
    const selected = f.messages.at(-1).message.item;
    assert.equal(selected.kind,'world'); assert.equal(selected.selector,selectorFor(row)); assert.equal(selected.label,'AGI Studio');
    assert.equal(selected.linkText,'AGI Studio'); assert.equal(selected.href,'/studio');
    assert.equal(selected.noteText,'your own AI influencer'); assert.equal(selected.noteSelector,selectorFor(description));
  }
  f.send({type:'agi-owner-preview',document:{pages:[],edits:[edit(selectorFor(link),{text:'Creator studio'}),edit(selectorFor(description),{text:'Make something new'})]}});
  assert.match(link.textContent,/Creator studio/); assert.equal(description.textContent,'Make something new'); assert.equal(arrow.textContent,'→');
});

test('content-driven galleries receive one change event before overrides and can read the latest snapshot', () => {
  const {doc,el,main}=fixture('/memes');let events=0;
  doc.defaultView.CustomEvent=class {constructor(type,options){this.type=type;this.detail=options.detail;}};
  doc.defaultView.dispatchEvent=event=>{assert.equal(event.type,'agi-site-content');events++;if(!doc.querySelector('#dynamic-title'))main.append(el('p',{id:'dynamic-title'},'Loaded by gallery'));};
  const data={pages:[],edits:[edit('#dynamic-title',{text:'Owner title'},'/memes')],memes:[]};
  applySiteContent(data,doc);assert.equal(events,1);assert.equal(doc.querySelector('#dynamic-title').textContent,'Owner title');assert.equal(getSiteContent(doc),data);
  applySiteContent(data,doc);assert.equal(events,1,'DOM observer reapplication must not rebuild the gallery or restart videos');
});
