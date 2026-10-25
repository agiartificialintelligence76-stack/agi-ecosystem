import '../styles/tokens.css';
import '../styles/owner.css';
import { findWallets, signInWithWallet, explainWalletError } from '../lib/wallet.js';
import { postJson } from '../lib/human.js';
import { emptyDocument, validateDocument, safeSelector } from './model.js';
import { BUILTIN_PAGES, normalizePath } from './catalog.js';
import { startMediaManager } from './media.js';

const $ = (s) => document.querySelector(s);
const ui = Object.fromEntries(['account','connect','disconnect','message','wallets','gate','workspace','pages','search','title','path','revision','dirty','discard','publish','controls','preview','pick','reload'].map(k => [k, $(`[data-owner-${k}]`)]));
const KEY = 'agi_wallet';
const clone = (v) => structuredClone(v);
const short = (s) => `${s.slice(0, 6)}…${s.slice(-4)}`;
const id = () => `c-${crypto.randomUUID()}`;
const el = (tag, cls, value) => { const n = document.createElement(tag); if (cls) n.className = cls; if (value !== undefined) n.textContent = value; return n; };
const button = (label, fn, cls = '') => { const n = el('button', cls, label); n.type = 'button'; n.addEventListener('click', fn); return n; };
const state = { me: null, authorized: false, base: emptyDocument(), draft: emptyDocument(), revision: 0, path: '/', tab: 'content', filter: 'sections', items: [], selected: null, block: null, busy: false, pick: true, epoch: 0, previewReady: false };
let mediaManager = null;
const previewWindow = $('[data-owner-preview-window]'), previewCanvas = $('[data-owner-preview-canvas]');
const previewSizeButton = $('[data-owner-preview-size]'), previewStatus = $('[data-owner-preview-status]'), previewHelp = $('[data-owner-preview-help]');
const previewView = { mode: 'desktop', fit: true, lastSize: '' };
const PREVIEW_DEVICES = { desktop: { width: 1440, height: 900, name: 'Desktop' }, phone: { width: 390, height: 844, name: 'Phone' } };

// Keep the embedded page's viewport independent of the editor's narrow columns. Scaling its canvas changes only
// its display size: media queries still see a real desktop/phone, and switching modes keeps the same loaded draft.
function sizePreview() {
  const device = PREVIEW_DEVICES[previewView.mode];
  ui.preview.style.width = `${device.width}px`;
  ui.preview.style.height = `${device.height}px`;
  document.querySelectorAll('[data-owner-preview-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.ownerPreviewMode === previewView.mode)));
  previewSizeButton.setAttribute('aria-pressed', String(!previewView.fit));
  previewSizeButton.title = previewView.fit ? 'Show at 100% and scroll inside the preview' : 'Scale the page to fit the preview panel';
  previewHelp.textContent = `${device.name} preview shows the full page, ${previewView.fit ? 'scaled to fit' : 'at actual size; scroll inside to see more'}. Select a Her world row to edit its name, description and link.`;
  const available = previewWindow.clientWidth;
  if (available <= 0) { previewView.lastSize = ''; previewStatus.textContent = `${device.name} · ${device.width} × ${device.height}`; return; }
  const key = `${previewView.mode}:${previewView.fit}:${available}`;
  if (key === previewView.lastSize) return;
  previewView.lastSize = key;
  const scale = previewView.fit ? Math.min(1, available / device.width) : 1;
  const width = device.width * scale, height = device.height * scale;
  previewCanvas.style.width = `${width}px`;
  previewCanvas.style.height = `${height}px`;
  ui.preview.style.transform = `scale(${scale})`;
  previewWindow.style.height = `${Math.min(650, height) + 2}px`;
  previewWindow.dataset.actualSize = String(!previewView.fit);
  previewStatus.textContent = `${device.name} · ${device.width} × ${device.height} · ${Math.round(scale * 100)}%`;
}
let previewSizeFrame = 0;
function schedulePreviewSize() {
  if (previewSizeFrame) return;
  previewSizeFrame = requestAnimationFrame(() => { previewSizeFrame = 0; sizePreview(); });
}
if ('ResizeObserver' in window) new ResizeObserver(schedulePreviewSize).observe(previewWindow);
addEventListener('resize', schedulePreviewSize);
ui.preview.addEventListener('load', schedulePreviewSize);
document.querySelectorAll('[data-owner-preview-mode]').forEach(b => b.addEventListener('click', () => {
  previewView.mode = b.dataset.ownerPreviewMode;
  previewWindow.scrollTo(0, 0);
  sizePreview();
}));
previewSizeButton.addEventListener('click', () => { previewView.fit = !previewView.fit; previewWindow.scrollTo(0, 0); sizePreview(); });
sizePreview();
function storedWallet() { try { const v = JSON.parse(localStorage.getItem(KEY)); return v?.session && /^0x[\da-f]{40}$/i.test(v.wallet) ? v : null; } catch { return null; } }
function say(message, error = false) { ui.message.textContent = message; ui.message.dataset.error = String(error); }
function dirty() { return JSON.stringify(state.base) !== JSON.stringify(state.draft); }
function setBusy(v) { state.busy = v; ui.workspace.inert = v; ui.connect.disabled = v; ui.disconnect.disabled = v; toolbar(); }
function toolbar() {
  const changed = dirty(); ui.dirty.textContent = changed ? 'Unpublished changes' : 'Up to date'; ui.dirty.dataset.dirty = String(changed);
  ui.publish.disabled = !changed || state.busy || !state.authorized; ui.discard.disabled = !changed || state.busy;
  ui.publish.textContent = state.busy ? 'Working…' : 'Publish changes'; ui.revision.textContent = `LIVE VERSION ${state.revision}`;
  const page = pageList().find(p => p.path === state.path); ui.title.textContent = page?.title || state.path; ui.path.textContent = state.path;
  const reset = $('[data-owner-reset-selection]');
  if (reset) { const selectors = selectedSelectors(); reset.disabled = !state.draft.edits.some(e => e.page === state.path && selectors.has(e.selector)); }
}
function pageList() {
  const map = new Map(BUILTIN_PAGES.map(p => [p.path, { ...p }]));
  for (const p of state.draft.pages) map.set(p.path, { ...map.get(p.path), ...p, title: p.title || map.get(p.path)?.title || p.path });
  return [...map.values()];
}
function pageRecord() {
  let p = state.draft.pages.find(p => p.path === state.path);
  if (!p) { p = { path: state.path, title: '', description: '', hidden: false, custom: false, blocks: [] }; state.draft.pages.push(p); }
  return p;
}
function sendPreview() {
  if (!state.previewReady || !state.authorized) return;
  const checked = validateDocument(state.draft);
  if (checked.ok) ui.preview.contentWindow?.postMessage({ type: 'agi-owner-preview', document: checked.document }, location.origin);
  ui.preview.contentWindow?.postMessage({ type: 'agi-owner-pick', enabled: state.pick }, location.origin);
}
function changed({ list = false } = {}) { toolbar(); sendPreview(); if (list) renderPages(); }
function renderPages() {
  const needle = ui.search.value.trim().toLowerCase();
  ui.pages.replaceChildren(...pageList().filter(p => `${p.title} ${p.path}`.toLowerCase().includes(needle)).map(p => {
    const b = button('', () => selectPage(p.path)); b.append(el('span', '', p.title));
    if (p.hidden || p.custom) b.append(el('small', '', p.hidden ? 'Hidden' : 'Added'));
    if (p.path === state.path) b.setAttribute('aria-current', 'page'); return b;
  }));
}
function loadPreview() {
  state.previewReady = false; state.items = []; state.selected = null;
  ui.preview.src = `${state.path}?ownerPreview=1`;
  schedulePreviewSize();
}
function selectPage(path) { state.path = path; state.block = null; state.tab = 'content'; state.filter = 'sections'; loadPreview(); render(); }
function render() {
  toolbar(); renderPages();
  $('[data-owner-tab="media"]').hidden = state.path !== '/memes';
  document.querySelectorAll('[data-owner-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.ownerTab === state.tab)));
  renderControls();
}
function field(label, value, onInput, { multiline = false, placeholder = '', maxLength = 12000, type = 'text' } = {}) {
  const wrap = el('label', 'oc-field'); const n = el(multiline ? 'textarea' : 'input'); n.value = value ?? ''; n.placeholder = placeholder; n.maxLength = maxLength;
  if (!multiline) n.type = type;
  n.addEventListener('input', () => onInput(n.value)); wrap.append(el('span', '', label), n); return wrap;
}
function check(label, value, onChange) { const wrap = el('label', 'oc-check'); const n = el('input'); n.type = 'checkbox'; n.checked = value; n.addEventListener('change', () => onChange(n.checked)); wrap.append(n, document.createTextNode(label)); return wrap; }
function choose(label, value, options, onChange) { const wrap = el('label', 'oc-field'); const n = el('select'); for (const [v, name] of options) { const o = el('option', '', name); o.value = v; o.selected = v === value; n.append(o); } n.addEventListener('change', () => onChange(n.value)); wrap.append(el('span', '', label), n); return wrap; }
function help(text) { return el('p', 'oc-help', text); }
function divider() { return el('div', 'oc-divider'); }
function renderControls() {
  if (mediaManager) { mediaManager.destroy?.(); mediaManager = null; }
  ui.controls.replaceChildren();
  if (state.tab === 'media' && state.path === '/memes') { mediaManager = startMediaManager({ root:ui.controls, getDocument:()=>state.draft, onChange:()=>changed(), api, say, setBusy, getEpoch:()=>state.epoch }); return; }
  if (state.tab === 'page') return renderPageSettings();
  if (state.tab === 'added') return renderAdded();
  if (state.tab === 'history') return renderHistory();
  renderContent();
}
function matchingEdit(item = state.selected) { return item && state.draft.edits.find(e => e.page === state.path && e.selector === item.selector); }
function selectedSelectors(item = state.selected) { return new Set(item ? [item.selector, item.linkSelector, item.textSelector, item.noteSelector].filter(Boolean) : []); }
function edit(change) {
  if (!state.selected) return; editTarget(state.selected.selector, change);
}
function editTarget(selector, change) {
  let record = state.draft.edits.find(e => e.page === state.path && e.selector === selector);
  if (!record) { record = { id: id(), page: state.path, selector }; state.draft.edits.push(record); }
  Object.assign(record, change); changed();
}
function renderContent() {
  ui.controls.append(el('h3', '', 'Choose something to edit'), help('Select it in the preview, or find it below. Removing an existing item hides it from visitors; you can restore it here.'));
  const filters = el('div', 'oc-filter');
  for (const [key, label] of [['sections','Sections'],['world','Her world'],['all','All content'],['changed','Changed']]) {
    if (key === 'world' && state.path !== '/') continue;
    const b = button(label, () => { state.filter = key; renderControls(); }); b.setAttribute('aria-pressed', String(state.filter === key)); filters.append(b);
  }
  ui.controls.append(filters);
  let items = state.items;
  if (state.filter === 'world') items = items.filter(i => i.kind === 'world');
  else if (state.filter === 'sections') items = items.filter(i => ['section','container','world'].includes(i.kind) || ['section','header','footer','nav','article'].includes(i.tag));
  else if (state.filter === 'changed') {
    const edits = state.draft.edits.filter(e => e.page === state.path);
    items = edits.map(e => state.items.find(i => i.selector === e.selector) || { selector: e.selector, label: e.selector, kind: 'saved change', ...e });
  }
  const list = el('div','oc-item-list');
  for (const item of items) {
    const record = state.draft.edits.find(e => e.page === state.path && e.selector === item.selector);
    const b = button('', () => { state.selected = item; renderControls(); });
    b.dataset.selected = String(state.selected?.selector === item.selector);
    b.append(el('small','', `${item.kind || item.tag}${record?.hidden ? ' · removed' : ''}`), document.createTextNode(item.label || item.text || item.tag)); list.append(b);
  }
  if (!items.length) list.append(el('p','oc-empty', state.previewReady ? 'No items in this view. Try All content, or add a section below.' : 'Loading the page preview…'));
  ui.controls.append(list);
  const actions = el('div','oc-inline'); actions.append(button('+ Add section', () => newBlock()), ...(state.path === '/' ? [button('+ Her world entry', () => newBlock('world'))] : [])); ui.controls.append(actions);
  if (!state.selected) return;
  const item = state.selected, record = matchingEdit() || {};
  ui.controls.append(divider(), el('h3','',item.label || 'Selected item'));
  if (item.linkSelector) {
    const linkEdit=state.draft.edits.find(e=>e.page===state.path&&e.selector===item.linkSelector)||{};
    const textSelector=item.textSelector||item.linkSelector;
    const textEdit=state.draft.edits.find(e=>e.page===state.path&&e.selector===textSelector)||{};
    ui.controls.append(field('Entry name',textEdit.text??item.linkText,v=>editTarget(textSelector,{text:v}),{maxLength:240}),field('Link address',linkEdit.href??item.href,v=>editTarget(item.linkSelector,{href:v}),{maxLength:2048}));
    if(item.noteSelector){const noteEdit=state.draft.edits.find(e=>e.page===state.path&&e.selector===item.noteSelector)||{};ui.controls.append(field('Entry description',noteEdit.text??item.noteText,v=>editTarget(item.noteSelector,{text:v}),{maxLength:500}));}
  }
  if (typeof item.text === 'string' && (item.text.trim() || item.tag === 'small')) ui.controls.append(field('Text', record.text ?? item.text, v => edit({ text:v }), { multiline:true }));
  if (item.href !== undefined && !item.linkSelector) ui.controls.append(field('Link address', record.href ?? item.href, v => edit({ href:v }), { placeholder:'/p/my-page or https://…', maxLength:2048 }));
  if (item.src !== undefined) {
    ui.controls.append(field('Image address', record.src ?? item.src, v => edit({ src:v }), { placeholder:'/images/example.webp', maxLength:150000 }), field('Image description',record.alt ?? item.alt, v => edit({alt:v}), {maxLength:500}), uploadButton(v => { edit({src:v}); renderControls(); }));
  }
  ui.controls.append(check('Visible to visitors', record.hidden !== true, v => { edit({hidden:!v}); renderControls(); }));
  const row = el('div','oc-inline');
  row.append(button(record.hidden ? 'Restore item' : 'Remove item', () => { edit({hidden:!record.hidden}); renderControls(); },record.hidden ? '' : 'oc-danger'));
  const itemSelectors = selectedSelectors(item);
  const reset = button('Reset to original', () => {
    state.draft.edits = state.draft.edits.filter(e => e.page !== state.path || !itemSelectors.has(e.selector)); changed(); renderControls();
  });
  reset.dataset.ownerResetSelection = '';
  reset.disabled = !state.draft.edits.some(e => e.page === state.path && itemSelectors.has(e.selector));
  row.append(reset);
  ui.controls.append(row, help('Changes apply to this page. Existing wallet, voting, and game actions keep their original behavior.'));
}
function renderPageSettings() {
  const current = state.draft.pages.find(p => p.path === state.path), original = BUILTIN_PAGES.find(p => p.path === state.path);
  ui.controls.append(el('h3','','Page settings'), help('Hide a page to remove it from the website and its navigation links. Owner access stays available.'));
  ui.controls.append(field('Page title',current?.title ?? '', v => {pageRecord().title=v;changed({list:true});},{placeholder:original?.title || 'Page title',maxLength:240}), field('Page description',current?.description ?? '',v=>{pageRecord().description=v;changed();},{multiline:true,maxLength:1200}), check('Page visible to visitors',!current?.hidden,v=>{pageRecord().hidden=!v;changed({list:true});renderControls();}));
  ui.controls.append(help(`Page address: ${state.path}`));
  const row = el('div','oc-inline'); row.append(button(current?.hidden ? 'Restore page' : 'Remove page', async () => {
    if (!current?.hidden && !await confirmAction('Remove this page?', 'It will be hidden from visitors after you publish. You can restore it here at any time.', 'Remove page')) return;
    pageRecord().hidden=!current?.hidden; changed({list:true});renderControls();
  },'oc-danger'));
  if(current?.custom) row.append(button('Delete added page',async()=>{
    if(!await confirmAction('Delete this added page?','The page and its added sections will be removed when you publish. Saved history keeps a way back.','Delete page'))return;
    state.draft.pages=state.draft.pages.filter(p=>p.path!==state.path);state.draft.edits=state.draft.edits.filter(e=>e.page!==state.path); selectPage('/');changed();
  },'oc-danger'));
  ui.controls.append(row,divider(),el('h3','','Content managers'),help('Use the dedicated managers for votes and Studio records. This editor controls how the website is presented.'));
  for(const [label,href] of [['Manage votes ↗','/vote/owner'],['Manage Studio ↗','/studio/owner']]){const a=el('a','oc-card',label);a.href=href;a.target='_blank';a.rel='noopener';ui.controls.append(a);}
}
function newBlock(placement='end') {
  const block={id:id(),title:placement==='world'?'New world entry':'New section',text:'',image:'',alt:'',href:'',label:'',hidden:false,placement};
  if(state.selected?.kind==='section' && placement==='end') {block.placement='after';block.anchor=state.selected.selector;}
  pageRecord().blocks.push(block);state.block=block.id;state.tab='added';changed();render();
}
function renderAdded() {
  const blocks=state.draft.pages.find(p=>p.path===state.path)?.blocks||[];
  ui.controls.append(el('h3','','Added sections'),help('Create a text section, an image, a link, or a new entry in Her world. Move sections up or down to change their order.'));
  const b=blocks.find(b=>b.id===state.block);
  if(b){
    ui.controls.append(button('← All added sections',()=>{state.block=null;renderControls();},'oc-quiet'),field('Title',b.title,v=>{b.title=v;changed();},{maxLength:240}),field('Text',b.text,v=>{b.text=v;changed();},{multiline:true}),field('Image address',b.image,v=>{b.image=v;changed();},{placeholder:'/images/example.webp',maxLength:150000}),uploadButton(v=>{b.image=v;changed();renderControls();}),field('Image description',b.alt,v=>{b.alt=v;changed();},{maxLength:500}),field('Link address',b.href,v=>{b.href=v;changed();},{placeholder:'/p/my-page or https://…',maxLength:2048}),field('Link label',b.label,v=>{b.label=v;changed();},{maxLength:160}));
    const options=[['end','At the end of the page'],['start','At the start of the page']];
    if(state.path==='/')options.push(['world','In Her world']);
    if(b.anchor || state.selected?.kind==='section') options.push(['before','Before selected item'],['after','After selected item']);
    ui.controls.append(choose('Position',b.placement||'end',options,v=>{b.placement=v;if(['before','after'].includes(v))b.anchor=state.selected?.selector||b.anchor;else delete b.anchor;changed();}),check('Visible to visitors',!b.hidden,v=>{b.hidden=!v;changed();}));
    ui.controls.append(button('Delete section',()=>{pageRecord().blocks=blocks.filter(x=>x.id!==b.id);state.block=null;changed();renderControls();},'oc-danger'));
  }else{
    if(!blocks.length)ui.controls.append(el('p','oc-empty','No added sections on this page yet.'));
    blocks.forEach((b,i)=>{const card=el('div','oc-card');card.append(el('h4','',b.title||'Untitled section'),el('p','',b.hidden?'Hidden':b.placement==='world'?'Her world entry':'Page section'));const row=el('div','oc-inline');row.append(button('Edit',()=>{state.block=b.id;renderControls();}));for(const [label,delta] of [['↑',-1],['↓',1]]){const move=button(label,()=>{const j=i+delta;[blocks[i],blocks[j]]=[blocks[j],blocks[i]];changed();renderControls();});move.disabled=i+delta<0||i+delta>=blocks.length;move.setAttribute('aria-label',delta<0?'Move section up':'Move section down');row.append(move);}card.append(row);ui.controls.append(card);});
    ui.controls.append(button('+ Add section',()=>newBlock(),'oc-primary'));
    if(state.path==='/')ui.controls.append(button('+ Her world entry',()=>newBlock('world'),'oc-quiet'));
  }
}
function uploadButton(onDone) {
  const wrap=el('div');const input=el('input');input.type='file';input.accept='image/png,image/jpeg,image/webp';input.hidden=true;
  const b=button('Upload image',()=>input.click());
  input.addEventListener('change',async()=>{const file=input.files?.[0];if(!file)return;const uploadEpoch=state.epoch,uploadPath=state.path,uploadSelection=state.selected?.selector;b.disabled=true;setBusy(true);try{if(!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>12_000_000)throw new Error('Choose a PNG, JPEG or WebP smaller than 12 MB.');const bitmap=await createImageBitmap(file);const canvas=document.createElement('canvas');const scale=Math.min(1,900/Math.max(bitmap.width,bitmap.height));canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();let result='';for(const q of [.82,.65,.45,.25]){result=canvas.toDataURL('image/webp',q);if(result.length<145000)break;}if(result.length>=145000)throw new Error('This picture is too detailed. Choose a smaller picture.');if(uploadEpoch!==state.epoch||uploadPath!==state.path||uploadSelection!==state.selected?.selector||!state.authorized)throw new Error('Your selection changed. Please choose the image again.');onDone(result);say('Image added to your draft.');}catch(err){say(err.message||'The image could not be opened.',true);}finally{b.disabled=false;input.value='';setBusy(false);}});wrap.append(b,input);return wrap;
}
async function renderHistory() {
  ui.controls.append(el('h3','','Saved history'),help('Restore an earlier version of the whole website. Restoring publishes it immediately and creates a new saved version.'));
  const box=el('div');box.append(el('p','oc-empty','Loading history…'));ui.controls.append(box);
  try{const r=await api('site-history');if(state.tab!=='history')return;box.replaceChildren();for(const h of r.history||[]){const card=el('div','oc-card');card.append(el('h4','',`Version ${h.revision}`),el('p','',new Date(h.updatedAt).toLocaleString()),el('p','',h.summary||'Website content'));const b=button(h.revision===state.revision?'Current version':'Restore this version',async()=>{if(!await confirmAction(`Restore version ${h.revision}?`,'This publishes that version across the website. Any unpublished changes in this editor will be discarded.','Restore version'))return;setBusy(true);try{accept(await api('site-restore',{revision:state.revision,targetRevision:h.revision}));say('Earlier version restored and published.');loadPreview();render();}catch(err){say(err.message,true);}finally{setBusy(false);}});b.disabled=h.revision===state.revision;card.append(b);box.append(card);}if(!box.childNodes.length)box.append(el('p','oc-empty','Your first publish will appear here.'));}catch(err){box.replaceChildren(el('p','oc-empty',err.message));}
}
async function api(action,extra={}) {
  const epoch=state.epoch;const r=await postJson('/api/wallet',{action,session:state.me?.session,...extra});
  if(epoch!==state.epoch)throw new Error('The wallet changed. Connect the owner wallet again.');
  if(!r.ok){
    const errors={not_owner:'This is not the owner wallet. Connect the same owner wallet used for /vote/owner.',signed_out:'Your sign-in expired. Disconnect and connect the owner wallet again.',not_ready:'The content database is not ready yet. Your changes have not been published.',too_fast:'Please wait a moment before trying again.',busy:'The server could not save right now. Your draft is still here.',conflict:'Another tab published a newer version. Your draft is still here. Copy any changes you need, then discard the draft to load the latest version.'};
    if(r.status===401||r.data.error==='not_owner'){state.authorized=false;ui.workspace.hidden=true;ui.gate.hidden=false;}
    throw new Error(r.data.why||errors[r.data.error]||'The request could not be completed. Try again.');
  }return r.data;
}
function accept(r) {state.base=clone(r.document);state.draft=clone(r.document);state.revision=r.revision;}
async function authorize() {
  ui.account.textContent=state.me?short(state.me.wallet):'Owner access only';ui.connect.hidden=Boolean(state.me);ui.disconnect.hidden=!state.me;
  if(!state.me)return;setBusy(true);say('Checking owner access…');
  try{const r=await api('site-owner');accept(r);state.authorized=true;ui.workspace.hidden=false;ui.gate.hidden=true;say('Owner access confirmed. Edit a draft, preview it, then publish your changes.');loadPreview();render();}catch(err){say(err.message,true);}finally{setBusy(false);}
}
async function connect() {
  ui.connect.disabled=true;say('Looking for wallets…');
  try{const wallets=await findWallets();if(!wallets.length){say('Open this page inside your wallet browser, or enable your browser wallet extension.');return;}if(wallets.length===1){await signIn(wallets[0]);return;}ui.wallets.replaceChildren(...wallets.map(w=>button(w.name,()=>signIn(w))));say('Choose the owner wallet.');}catch(err){say(explainWalletError(err),true);}finally{ui.connect.disabled=false;}
}
async function signIn(wallet) {
  const epoch=++state.epoch;ui.wallets.replaceChildren();ui.connect.disabled=true;
  try{const p=await signInWithWallet(wallet.provider,()=>say('Confirm the free sign-in message in your wallet.'));if(epoch!==state.epoch)return;state.me=p;try{localStorage.setItem(KEY,JSON.stringify(p));}catch{}await authorize();}catch(err){if(epoch===state.epoch)say(explainWalletError(err),true);}finally{ui.connect.disabled=false;}
}
async function disconnect() {
  if(dirty()&&!await confirmAction('Disconnect and discard your draft?','Unpublished changes in this editor will be lost.','Disconnect'))return;
  state.epoch++;state.me=null;state.authorized=false;state.base=emptyDocument();state.draft=emptyDocument();try{localStorage.removeItem(KEY);}catch{}ui.workspace.hidden=true;ui.gate.hidden=false;ui.preview.removeAttribute('src');ui.account.textContent='Owner access only';ui.connect.hidden=false;ui.disconnect.hidden=true;say('Disconnected. Connect the owner wallet to manage the website.');
}
function confirmAction(title,text,label){return new Promise(resolve=>{const d=el('dialog','oc-dialog');const heading=el('h2','',title);heading.id=id();d.setAttribute('aria-labelledby',heading.id);const row=el('div','oc-inline');const finish=v=>{d.close();d.remove();resolve(v);};row.append(button('Cancel',()=>finish(false)),button(label,()=>finish(true),'oc-primary'));d.append(heading,el('p','',text),row);d.addEventListener('cancel',e=>{e.preventDefault();finish(false);});document.body.append(d);d.showModal();});}
function newPageDialog(){
  const d=el('dialog','oc-dialog');const heading=el('h2','','Add a page');heading.id=id();d.setAttribute('aria-labelledby',heading.id);let title='',slug='';const error=el('p');error.setAttribute('role','alert');
  const row=el('div','oc-inline');row.append(button('Cancel',()=>{d.close();d.remove();}),button('Create page',()=>{const path=`/p/${slug.trim().toLowerCase()}`;if(!title.trim()||!/^\/p\/[a-z0-9][a-z0-9-]*$/.test(path)||pageList().some(p=>p.path===path)){error.textContent='Enter a title and a unique address using letters, numbers and hyphens.';return;}state.draft.pages.push({path,title:title.trim(),description:'',hidden:false,custom:true,blocks:[]});d.close();d.remove();selectPage(path);state.tab='added';changed();render();say('Page added to your draft. Add sections, then publish. Add a Her world entry or link so visitors can find it.');},'oc-primary'));
  d.append(heading,help('Your new page will have its own address. It goes live when you publish.'),field('Page title','',v=>title=v,{maxLength:240}),field('Address after /p/','',v=>slug=v,{placeholder:'my-new-page',maxLength:100}),error,row);document.body.append(d);d.showModal();
}
ui.connect.addEventListener('click',connect);ui.disconnect.addEventListener('click',disconnect);ui.search.addEventListener('input',renderPages);$('[data-owner-new-page]').addEventListener('click',newPageDialog);
ui.reload.addEventListener('click',()=>{loadPreview();renderControls();});
ui.pick.addEventListener('click',()=>{state.pick=!state.pick;ui.pick.textContent=`Select to edit: ${state.pick?'on':'off'}`;ui.pick.setAttribute('aria-pressed',String(state.pick));sendPreview();});
document.querySelectorAll('[data-owner-tab]').forEach(b=>b.addEventListener('click',()=>{state.tab=b.dataset.ownerTab;render();}));
ui.publish.addEventListener('click',async()=>{const checked=validateDocument(state.draft);if(!checked.ok){say(checked.why,true);return;}setBusy(true);try{accept(await api('site-save',{document:checked.document,revision:state.revision}));say('Published. Visitors will see the changes on their next page load, usually within 30 seconds.');render();sendPreview();}catch(err){say(err.message,true);}finally{setBusy(false);}});
ui.discard.addEventListener('click',async()=>{if(!await confirmAction('Discard this draft?','Your unpublished changes will be discarded and the latest saved version will be loaded.','Discard draft'))return;setBusy(true);try{accept(await api('site-owner'));state.selected=null;loadPreview();render();say('Draft discarded. The latest published version is loaded.');}catch(err){say(err.message,true);}finally{setBusy(false);}});
addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==ui.preview.contentWindow||!state.authorized)return;
  const data=event.data;if(!data||typeof data!=='object')return;
  if(data.type==='agi-owner-ready'){
    // Navigating the preview may report a different managed page; never accept system/owner routes.
    const path=normalizePath(data.path||state.path);if(path!==state.path){if(!pageList().some(p=>p.path===path))return;state.path=path;state.selected=null;}
    state.items=(Array.isArray(data.items)?data.items:[]).filter(i=>i&&safeSelector(i.selector)).slice(0,3000);
    if(state.selected){const currentItem=state.items.find(i=>i.selector===state.selected.selector);if(currentItem)state.selected=currentItem;}
    const first=!state.previewReady;state.previewReady=true;if(first)sendPreview();
    const typing=ui.controls.contains(document.activeElement)&&document.activeElement.matches('input,textarea,select');
    if(state.tab==='content'&&!typing)renderControls();toolbar();renderPages();
  }else if(data.type==='agi-owner-selected'&&data.item&&safeSelector(data.item.selector)){state.selected=data.item;state.tab='content';render();}
});
addEventListener('beforeunload',event=>{if(dirty()){event.preventDefault();event.returnValue='';}});
addEventListener('storage',event=>{if(event.key!==KEY&&event.key!==null)return;const me=storedWallet();if(me?.session===state.me?.session)return;if(me&&state.me&&me.wallet.toLowerCase()===state.me.wallet.toLowerCase()){state.me=me;return;}state.epoch++;state.me=me;state.authorized=false;ui.workspace.hidden=true;ui.gate.hidden=false;if(me)authorize();else{state.base=emptyDocument();state.draft=emptyDocument();ui.connect.hidden=false;ui.disconnect.hidden=true;ui.account.textContent='Owner access only';say('Wallet disconnected in another tab.');}});
state.me=storedWallet();authorize();
