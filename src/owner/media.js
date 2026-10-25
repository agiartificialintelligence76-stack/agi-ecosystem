import './media.css';
import { MEMES, mergeMemes, fileOf, thumbOf, clock } from '../memes/list.js';
import { MEDIA_BUCKET, MEDIA_ORIGIN, MEDIA_MIME_TYPES, safeMemeUrl, validateMemes } from './media-model.js';

const TITLES = { image: 'Image', video: 'Video', slopcore: 'Slopcore' };
const TYPES = Object.keys(MEDIA_MIME_TYPES).join(',');
const byExtension = Object.fromEntries(Object.entries(MEDIA_MIME_TYPES).map(([mime, info]) => [info.extension, mime]));
byExtension.jpeg = 'image/jpeg';

export function mediaFileInfo(file) {
  if (!file || !Number.isSafeInteger(file.size) || file.size <= 0) throw new Error('Choose a nonempty image or video file.');
  const mime = file.type || byExtension[String(file.name || '').split('.').pop().toLowerCase()];
  const info = typeof mime === 'string' && Object.hasOwn(MEDIA_MIME_TYPES, mime) ? MEDIA_MIME_TYPES[mime] : null;
  if (!info) throw new Error('Choose a PNG, JPEG, WebP or GIF image, or an MP4 or WebM video.');
  if (file.size > info.maxBytes) throw new Error(`${info.family === 'image' ? 'Images' : 'Videos'} must be ${info.maxBytes / 1_000_000} MB or smaller.`);
  return { ...info, mime };
}

function checkUploadTarget(value) {
  try {
    const url = new URL(value);
    return url.origin === MEDIA_ORIGIN && url.pathname.startsWith(`/storage/v1/object/upload/sign/${MEDIA_BUCKET}/`) && !url.username && !url.password;
  } catch { return false; }
}

// No draft entry is returned until the server has checked the uploaded bytes and signed its metadata.
// The signed URL is scoped to one new file; the browser never receives a storage key.
export async function uploadConfirmed(file, { api, onProgress = () => {}, signal, xhrFactory = () => new XMLHttpRequest() } = {}) {
  const info = mediaFileInfo(file);
  const check = () => { if (signal?.aborted) throw new Error('Upload cancelled. No gallery entry was added.'); };
  check();
  const start = await api('site-media-start', { name: String(file.name || `upload.${info.extension}`).slice(0, 240), mime: info.mime, bytes: file.size });
  check();
  if (!start?.id || !start?.ticket || !checkUploadTarget(start.uploadUrl)) throw new Error('The server could not prepare a safe upload. Please try again.');
  onProgress(0, file.size);
  await new Promise((resolve, reject) => {
    const xhr = xhrFactory();
    const cleanup = () => signal?.removeEventListener('abort', cancel);
    const fail = (message) => { cleanup(); reject(new Error(message)); };
    const cancel = () => { xhr.abort(); fail('Upload cancelled. No gallery entry was added.'); };
    xhr.open('PUT', start.uploadUrl, true);
    xhr.timeout = 600_000;
    xhr.setRequestHeader('Content-Type', info.mime);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = (event) => onProgress(Math.min(file.size, event.loaded || 0), event.lengthComputable ? event.total : file.size);
    xhr.onload = () => {
      cleanup();
      if (xhr.status >= 200 && xhr.status < 300) { onProgress(file.size, file.size); resolve(); }
      else reject(new Error(`The upload was refused (${xhr.status || 'no response'}). Your gallery has not changed. Please retry.`));
    };
    xhr.onerror = () => fail('The upload connection failed. Your gallery has not changed. Please retry.');
    xhr.ontimeout = () => fail('The upload took too long. Your gallery has not changed. Please retry on a faster connection.');
    xhr.onabort = () => fail('Upload cancelled. No gallery entry was added.');
    signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted) { cancel(); return; }
    xhr.send(file);
  });
  check();
  const result = await api('site-media-finish', { ticket: start.ticket });
  check();
  const media = result?.media;
  if (!media || media.id !== start.id || media.custom !== true || !safeMemeUrl(media.src) || !media.proof || (media.kind === 'image') !== (info.family === 'image')) throw new Error('The uploaded file could not be verified. It was not added to your gallery.');
  return validateMemes([media], MEMES)[0];
}

async function videoCover(file) {
  const video = document.createElement('video');
  const local = URL.createObjectURL(file);
  video.preload = 'auto'; video.muted = true; video.playsInline = true;
  let secs = 0;
  try {
    const poster = await new Promise((resolve) => {
      let finished = false;
      const done = (value) => { if (finished) return; finished = true; clearTimeout(timeout); resolve(value); };
      const timeout = setTimeout(() => done(null), 10_000);
      const draw = () => {
        if (!video.videoWidth || !video.videoHeight) { done(null); return; }
        try {
          const canvas = document.createElement('canvas'); const scale = Math.min(1, 960 / Math.max(video.videoWidth, video.videoHeight));
          canvas.width = Math.max(1, Math.round(video.videoWidth * scale)); canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
          const ctx = canvas.getContext('2d'); if (!ctx) { done(null); return; }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height); canvas.toBlob(done, 'image/jpeg', 0.82);
        } catch { done(null); }
      };
      video.onloadedmetadata = () => {
        secs = Number.isFinite(video.duration) ? Math.min(86400, Math.max(0, video.duration)) : 0;
        if (secs > 0.1) video.currentTime = Math.min(1, secs * 0.1);
        else if (video.readyState >= 2) draw();
      };
      video.onloadeddata = () => { if (secs <= 0.1) draw(); };
      video.onseeked = draw; video.onerror = () => done(null); video.src = local;
    });
    return { secs, poster };
  } catch { return { secs, poster: null }; }
  finally { video.pause(); video.removeAttribute('src'); video.load(); URL.revokeObjectURL(local); }
}

const el = (tag, cls, text) => { const node = document.createElement(tag); if (cls) node.className = cls; if (text !== undefined) node.textContent = text; return node; };
const button = (text, action, cls = 'oc-quiet') => { const b = el('button', cls, text); b.type = 'button'; b.addEventListener('click', action); return b; };
function field(label, value, onInput, { multiline = false, max = 160 } = {}) {
  const wrap = el('label', 'oc-field'); const input = el(multiline ? 'textarea' : 'input'); if (!multiline) input.type = 'text';
  input.maxLength = max; input.value = value || ''; if (multiline) input.rows = 3;
  input.addEventListener('input', () => onInput(input.value)); wrap.append(el('span', '', label), input); return wrap;
}

export function startMediaManager({ root, getDocument, onChange, api, say, setBusy, getEpoch = () => 0 }) {
  let selected = null, filter = 'all', query = '', disposed = false, uploading = false, controller = null;
  const previews = new Set();
  const entries = () => mergeMemes(getDocument().memes, { includeHidden: true });
  const stopPreviews = () => { for (const video of previews) { video.pause(); video.removeAttribute('src'); video.load(); } previews.clear(); };
  const changed = () => onChange();
  const record = (item) => {
    const doc = getDocument(); doc.memes ||= [];
    let row = doc.memes.find((m) => m.id === item.id);
    if (!row) {
      row = { id: item.id, custom: false, kind: item.kind, title: item.title, note: item.note || '', src: fileOf(item), thumb: thumbOf(item), secs: item.secs || 0, hidden: Boolean(item.hidden) };
      doc.memes.push(row);
    }
    return row;
  };
  const mutate = (item, update) => { Object.assign(record(item), update); changed(); };
  const removeCustom = (item) => { const doc = getDocument(); doc.memes = (doc.memes || []).filter((m) => m.id !== item.id); selected = null; changed(); render(); say('Removed from your draft. Publish changes to update the gallery.'); };

  async function upload(file, title, note, category, progress, status) {
    if (uploading) return;
    const epoch = getEpoch();
    const current = () => { if (disposed || epoch !== getEpoch()) throw new Error('Your wallet or page changed. The upload was not added to this draft.'); };
    let info;
    try { info = mediaFileInfo(file); } catch (err) { say(err.message, true); return; }
    uploading = true; controller = new AbortController(); setBusy(true); progress.hidden = false; status.hidden = false;
    try {
      status.textContent = info.family === 'video' ? 'Preparing the video cover…' : 'Preparing upload…';
      const cover = info.family === 'video' ? await videoCover(file) : null; current();
      status.textContent = 'Uploading file…';
      const media = await uploadConfirmed(file, { api, signal: controller.signal, onProgress: (sent, total) => {
        progress.max = Math.max(1, total); progress.value = sent; status.textContent = sent >= total ? 'Checking the uploaded file…' : `Uploading file · ${Math.round(sent / total * 100)}%`;
      } });
      current();
      let coverFailed = false;
      if (cover?.poster) {
        try {
          status.textContent = 'Uploading video cover…';
          const poster = await uploadConfirmed(new File([cover.poster], 'video-cover.jpg', { type: 'image/jpeg' }), { api, signal: controller.signal });
          current(); media.thumb = poster.src; media.thumbProof = poster.proof;
        } catch (err) { current(); coverFailed = true; }
      } else if (info.family === 'video') coverFailed = true;
      current();
      Object.assign(media, { title: title.trim() || String(file.name).replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 160) || 'New meme', note, kind: info.family === 'image' ? 'image' : category === 'slopcore' ? 'slopcore' : 'video', secs: cover?.secs || 0 });
      const doc = getDocument(); doc.memes ||= []; doc.memes.unshift(media); selected = media.id; filter = 'all'; query = ''; changed();
      say(coverFailed ? 'Video added to your draft without a cover. Publish changes when ready.' : 'Upload verified and added to your draft. Publish changes to show it in Memes.');
    } catch (err) { if (!disposed) say(err.message || 'The upload failed. No item was added to the gallery.', true); }
    finally { uploading = false; controller = null; if (epoch === getEpoch()) setBusy(false); if (!disposed && epoch === getEpoch()) render(); }
  }

  function renderUpload() {
    const box = el('section', 'om-upload');
    box.append(el('h4', '', 'Add an image or video'), el('p', 'om-hint', 'PNG, JPEG, WebP or GIF · up to 20 MB. MP4 or WebM · up to 50 MB.'));
    const file = el('input', 'om-file'); file.type = 'file'; file.accept = TYPES; file.setAttribute('aria-label', 'Image or video to upload');
    let title = '', note = '', category = 'video';
    const categoryLabel = el('label', 'oc-field'); const select = el('select'); select.setAttribute('aria-label', 'Video category');
    for (const [value, text] of [['video', 'Videos'], ['slopcore', 'Slopcore']]) { const option = el('option', '', text); option.value = value; select.append(option); }
    select.addEventListener('change', () => { category = select.value; }); categoryLabel.append(el('span', '', 'Video category'), select);
    const titleField = field('Title', '', value => { title = value; });
    file.addEventListener('change', () => { const chosen = file.files?.[0]; if (!chosen) return; try { const info = mediaFileInfo(chosen); categoryLabel.hidden = info.family === 'image'; if (!title) { title = chosen.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 160); titleField.querySelector('input').value = title; } } catch (err) { say(err.message, true); } });
    const progress = el('progress', 'om-progress'); progress.max = 1; progress.value = 0; progress.hidden = true; progress.setAttribute('aria-label', 'Upload progress');
    const status = el('p', 'om-status'); status.setAttribute('role', 'status'); status.hidden = true;
    box.append(file, titleField, field('Caption', '', value => { note = value; }, { multiline: true, max: 1000 }), categoryLabel,
      button('Upload to draft', () => { if (!file.files?.[0]) { say('Choose an image or video first.', true); return; } upload(file.files[0], title, note, category, progress, status); }, 'oc-primary'), progress, status);
    box.append(el('p', 'om-hint', 'Uploads appear in the gallery after you publish this draft.'));
    return box;
  }

  function editor(item) {
    const box = el('div', 'om-editor');
    const src = fileOf(item), thumb = thumbOf(item);
    if (item.kind !== 'image') { const video = el('video', 'om-preview'); video.controls = true; video.preload = 'metadata'; video.src = src; if (thumb) video.poster = thumb; box.append(video); previews.add(video); }
    box.append(field('Title', item.title, value => mutate(item, { title: value })), field('Caption', item.note, value => mutate(item, { note: value }), { multiline: true, max: 1000 }));
    if (item.kind !== 'image') {
      const label = el('label', 'oc-field'); const select = el('select'); select.setAttribute('aria-label', 'Category');
      for (const [value, text] of [['video', 'Videos'], ['slopcore', 'Slopcore']]) { const option = el('option', '', text); option.value = value; option.selected = item.kind === value; select.append(option); }
      select.addEventListener('change', () => { mutate(item, { kind: select.value }); render(); }); label.append(el('span', '', 'Category'), select); box.append(label);
    }
    const actions = el('div', 'om-actions');
    actions.append(button(item.hidden ? 'Restore to gallery' : 'Hide from gallery', () => { mutate(item, { hidden: !item.hidden }); render(); }));
    if (item.custom) actions.append(button('Remove item', () => removeCustom(item), 'oc-danger'));
    else if ((getDocument().memes || []).some((m) => m.id === item.id)) actions.append(button('Reset to original', () => { const doc = getDocument(); doc.memes = doc.memes.filter((m) => m.id !== item.id); changed(); render(); }));
    box.append(actions, el('p', 'om-hint', item.hidden ? 'Hidden in this draft. Publish changes to update the public gallery.' : 'Edits are saved in your draft until you publish.'));
    return box;
  }

  function renderList(list) {
    stopPreviews();
    const all = entries();
    const visible = all.filter((m) => (filter === 'all' || (filter === 'hidden' ? m.hidden : m.kind === filter)) && `${m.title} ${m.note}`.toLowerCase().includes(query.toLowerCase()));
    list.replaceChildren();
    if (!visible.length) { list.append(el('p', 'oc-empty', 'No matching items.')); return; }
    for (const item of visible) {
      const card = el('article', 'om-card'); card.dataset.hidden = String(item.hidden);
      const head = button('', () => { selected = selected === item.id ? null : item.id; renderList(list); }, 'om-item'); head.setAttribute('aria-expanded', String(selected === item.id));
      const thumb = thumbOf(item); if (thumb) { const image = el('img', 'om-thumb'); image.src = thumb; image.alt = ''; image.loading = 'lazy'; head.append(image); } else head.append(el('span', 'om-thumb om-video-fallback', '▶'));
      const copy = el('span', 'om-copy'); copy.append(el('strong', '', item.title || 'Untitled'), el('small', '', `${TITLES[item.kind]}${item.secs ? ` · ${clock(item.secs)}` : ''}${item.hidden ? ' · Hidden' : ''}${item.custom ? ' · Uploaded' : ''}`));
      head.append(copy); card.append(head); if (selected === item.id) card.append(editor(item)); list.append(card);
    }
  }

  function render() {
    stopPreviews(); root.replaceChildren(el('h3', '', 'Meme library'), el('p', 'om-hint', 'Manage the actual Images, Videos and Slopcore gallery.'));
    root.append(renderUpload());
    const search = el('input', 'oc-search om-search'); search.type = 'search'; search.placeholder = 'Search the library'; search.value = query; search.setAttribute('aria-label', 'Search the meme library');
    const filters = el('div', 'oc-filter'); const list = el('div', 'om-list');
    const filterButtons = [];
    for (const [key, text] of [['all', 'All'], ['image', 'Images'], ['video', 'Videos'], ['slopcore', 'Slopcore'], ['hidden', 'Hidden']]) {
      const b = button(text, () => { filter = key; for (const entry of filterButtons) entry.node.setAttribute('aria-pressed', String(entry.key === key)); renderList(list); });
      b.setAttribute('aria-pressed', String(filter === key)); filterButtons.push({key,node:b}); filters.append(b);
    }
    search.addEventListener('input', () => { query = search.value; renderList(list); }); root.append(search, filters, list); renderList(list);
  }
  render();
  return { destroy() { disposed = true; controller?.abort(); stopPreviews(); } };
}
