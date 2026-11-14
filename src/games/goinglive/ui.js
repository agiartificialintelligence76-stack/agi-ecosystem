// GOING LIVE: the game’s screens over her pixel room, made with DOM methods in the arcade kit’s sticker look. Between
// streams her room fills the screen and scrolls sideways; over it, up top, her level, idea points, home, rank and what’s
// trending; down below, her boxes (deliveries and mystery boxes), the videos she’s making, three video ideas to tap, and
// a dock: the shop, decorating, going live, her collection book, and the rest (skills, quests, the board, records).
// While a thing is being placed, a bar (✓ · flip · put away · ✕). Live: her stream’s own overlay and her chat. Everything
// to tap is a real button.
import { el, icon } from '../kit/shell.js';
import { REDUCED } from '../kit/env.js';
import { shareUrl } from '../kit/share.js';
import { TOPICS, topicOf, KINDS, ITEMS, itemOf, pointsOf, HOMES, PERKS, RIVALS, AWARDS, SETS, RARITIES, rarityOf, boxOf, TUNE } from './data.js';
import {
  openTopics, nextTopic, trendsOf, trendLeft, expected, expectedFollowers, makeTime, slotsOf, uploadLeft, xpNeed, scores, shopItems,
  canBuy, deliverTime, nextHome, canMoveHome, canPerk, perkRank, perkCost, liveNeed, liveReady, ideasReady, rankOf, idleRate, invCount, boxLeft, gotCount,
} from './econ.js';
import { itemSprite, mysterySprite, boxSprite } from './pixel.js';
import { STICKERS } from './progress.js';
import { questText, shareText } from './lines.js';
import { linesOf } from './uses.js';

const NF = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
export const fmt = (n) => (Math.abs(n) < 1000 ? String(Math.round(n)) : NF.format(n));
export const full = (n) => Math.round(n).toLocaleString('en-US');
const clock = (s) => (s >= 60 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : `${Math.ceil(s)}s`);
const closeX = (fn) => el('button', { class: 'ak-ibtn ak-close', type: 'button', 'aria-label': 'Close', onclick: fn }, icon('close'));
const chipOf = (id, hot = false) => { const t = topicOf(id); const b = el('span', `gl-topic${hot ? ' is-hot' : ''}`, el('i', { 'aria-hidden': 'true' }, t.icon), el('span', 'gl-topic-n', t.name)); b.style.setProperty('--gl-c', t.color); return b; };
const dotOf = (id) => { const t = topicOf(id); const b = el('i', { class: 'gl-tdot', title: t.name }, t.icon); b.style.setProperty('--gl-c', t.color); return b; };
// a sprite, crisp: on a small canvas, scaled up by CSS (image-rendering: pixelated); `ghost`: its silhouette
function spriteCanvas(s, size, { ghost = false, cls = 'gl-thumb' } = {}) {
  const cv = el('canvas', { class: cls, width: String(s.canvas.width), height: String(s.canvas.height), 'aria-hidden': 'true' });
  const ctx = cv.getContext('2d');
  ctx.drawImage(s.canvas, 0, 0);
  if (ghost) { ctx.globalCompositeOperation = 'source-in'; ctx.fillStyle = '#3a2a5e'; ctx.fillRect(0, 0, cv.width, cv.height); }
  const k = Math.max(1, Math.floor(size / Math.max(s.canvas.width, s.canvas.height * 0.9)));
  cv.style.width = `${s.canvas.width * k}px`; cv.style.height = `${s.canvas.height * k}px`;
  return cv;
}
export const thumb = (id, size = 56, ghost = false) => spriteCanvas(itemSprite(id, 0, { view: 'suburb' }), size, { ghost });

export function createUI(stage, on) {
  // ---------- the view: her room, or her stream ----------
  const liveTag = el('span', 'gl-live', 'LIVE');
  const viewers = el('b', 'gl-viewers', '0');
  const timeEl = el('span', 'gl-time', '1:00');
  const hypeFill = el('i', 'gl-hype-fill');
  const hype = el('div', { class: 'gl-hype', role: 'meter', 'aria-label': 'Hype', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' }, el('span', 'gl-hype-label', 'HYPE'), el('span', 'gl-hype-bar', hypeFill));
  const comboEl = el('span', { class: 'gl-combo', hidden: true }, '');
  const hud = el('div', 'gl-hud', el('div', 'gl-hud-row', liveTag, el('span', { class: 'gl-eye', 'aria-hidden': 'true' }, '👁'), viewers, timeEl), el('div', 'gl-hud-row2', hype, comboEl));
  const pops = el('div', 'gl-pops');
  const targets = el('div', { class: 'gl-targets', 'aria-label': 'Things happening on her stream' }, pops);
  const sayP = el('p', null, '');
  const sayBox = el('div', { class: 'gl-say', hidden: true, role: 'status' }, el('b', null, 'AGI-1'), sayP);
  const tipText = el('span', null, '');
  const tip = el('div', { class: 'gl-tip', hidden: true, role: 'status' }, el('b', null, 'Tip'), tipText);

  // ---------- up top: her level, idea points, home, rank, what’s trending ----------
  const lvl = el('b', 'gl-lvl', '');
  const xpFill = el('i', 'gl-xp-fill');
  const pts = el('button', { class: 'gl-pts', type: 'button', hidden: true, onclick: () => on.perks() }, '');
  const roomName = el('span', 'gl-roomname', '');
  const rankTag = el('span', 'gl-ranktag', '');
  const trendRow = el('div', 'gl-trends', '');
  const zoomBtn = el('button', { class: 'gl-zoom', type: 'button', 'aria-label': 'Zoom out', onclick: () => on.zoom() }, '🔍');
  const topHud = el('div', 'gl-tophud',
    el('div', 'gl-tophud-l', el('span', 'gl-lvlbox', lvl, el('span', 'gl-xp', xpFill)), pts, el('span', 'gl-place', roomName, rankTag)),
    el('div', 'gl-tophud-r', trendRow));

  // ---------- down below ----------
  const boxes = el('div', { class: 'gl-boxes', 'aria-label': 'Her boxes' });
  const uploads = el('div', { class: 'gl-uploads', 'aria-live': 'polite' });
  const ideasList = el('div', { class: 'gl-ideas', role: 'list' });
  const refresh = el('button', { class: 'gl-refresh', type: 'button', 'aria-label': 'New ideas', onclick: () => on.newIdeas() }, '🔄');
  const tray = el('div', 'gl-tray', el('div', 'gl-tray-top', uploads, refresh), ideasList);
  // decorating: what to do, and Done
  const editText = el('span', null, 'Tap a thing to move it.');
  const editBar = el('div', { class: 'gl-bar gl-editbar', hidden: true }, editText, el('button', { class: 'gl-bbtn is-go', type: 'button', onclick: () => on.editDone() }, 'Done'));
  // placing a thing: ✓ · flip · put away · ✕
  const placeName = el('b', 'gl-place-name', '');
  const okBtn = el('button', { class: 'gl-bbtn is-go', type: 'button', 'aria-label': 'Put it here', onclick: () => on.placeOk() }, '✓');
  const flipBtn = el('button', { class: 'gl-bbtn', type: 'button', 'aria-label': 'Flip it', onclick: () => on.placeFlip() }, '↔');
  const storeBtn = el('button', { class: 'gl-bbtn', type: 'button', 'aria-label': 'Put it away', onclick: () => on.placeStore() }, '📦');
  const cancelBtn = el('button', { class: 'gl-bbtn', type: 'button', 'aria-label': 'Cancel', onclick: () => on.placeCancel() }, '✕');
  const placeBar = el('div', { class: 'gl-bar gl-placebar', hidden: true }, placeName, el('span', 'gl-place-btns', flipBtn, storeBtn, cancelBtn, okBtn));
  const dockBtn = (ico, label, fn, cls = '') => {
    const badge = el('b', { class: 'gl-badge', hidden: true }, '');
    const b = el('button', { class: `gl-dbtn ${cls}`.trim(), type: 'button', onclick: fn }, el('span', { class: 'gl-dico', 'aria-hidden': 'true' }, ico), el('span', 'gl-dl', label), badge);
    b.badge = badge;
    return b;
  };
  const shopBtn = dockBtn('🛒', 'Shop', () => on.shop());
  const editBtn = dockBtn('✏️', 'Decorate', () => on.edit());
  const liveFill = el('i', 'gl-live-fill');
  const liveBtn = el('button', { class: 'gl-dbtn gl-golive', type: 'button', onclick: () => on.live() }, el('span', { class: 'gl-dot', 'aria-hidden': 'true' }), el('span', 'gl-dl', 'Go live'), el('span', 'gl-live-meter', liveFill));
  const bookBtn = dockBtn('📒', 'Collection', () => on.collection());
  const moreBtn = dockBtn('☰', 'More', () => on.more());
  const dock = el('div', 'gl-dock', shopBtn, editBtn, liveBtn, bookBtn, moreBtn);
  const bottom = el('div', 'gl-bottom', boxes, zoomBtn, tray, editBar, placeBar, dock);
  const view = el('div', 'gl-view', hud, targets, topHud, sayBox, tip, bottom);

  // ---------- her chat (live) ----------
  const chatList = el('ol', { class: 'gl-chat-list', 'aria-label': 'Her chat' });
  const chatCount = el('span', 'gl-chat-n', '');
  const chat = el('div', { class: 'gl-chat', hidden: true }, el('div', 'gl-chat-head', el('b', null, 'Chat'), chatCount), chatList);
  const side = el('div', 'gl-side', chat);
  const root = el('div', { class: 'gl-ui', 'data-mode': 'hub' }, view, side);
  stage.append(root);

  let sayTimer = 0, tipTimer = 0, last = {}, round = null, ideaKey = '', upKey = '', boxKey = '', bandKeep = null, bandStale = true;
  const byId = new Map();
  // the HUD's bars changed size (the ideas came in, a phone turned, a bar swapped in): her room is fitted again
  if (typeof ResizeObserver === 'function') {
    const ro = new ResizeObserver(() => { bandStale = true; });
    for (const n of [view, topHud, bottom, tray, dock, editBar, placeBar]) ro.observe(n);
  }

  // ---------- her room’s screen ----------
  function hubRender(c) {
    const need = xpNeed(c.level);
    if (last.lvl !== c.level) { lvl.textContent = `Lv ${c.level}`; last.lvl = c.level; }
    xpFill.style.width = `${Math.min(100, (c.xp / need) * 100).toFixed(1)}%`;
    pts.hidden = !c.points; pts.textContent = `💡 ${c.points}`;
    roomName.textContent = HOMES[c.home || 0].name; rankTag.textContent = `#${rankOf(c.followers)}`;
    // trending
    const tr = trendsOf(c), tk = `${tr.join()}:${trendLeft(c)}`;
    if (last.tr !== tk) {
      last.tr = tk;
      trendRow.replaceChildren(el('span', 'gl-trends-l', '🔥'), ...tr.map((id) => chipOf(id, true)), el('span', 'gl-trends-n', `${trendLeft(c)}`));
      trendRow.setAttribute('aria-label', `Trending: ${tr.map((id) => topicOf(id).name).join(', ')}, for ${trendLeft(c)} more videos`);
    }
    // her boxes: deliveries on their way or here, mystery boxes
    const bk = `${c.deliveries.map((d) => `${d.uid}:${boxLeft(c, d) <= 0}`).join()}|${c.mystery.map((b) => b.uid).join()}`;
    if (boxKey !== bk) {
      boxKey = bk;
      const list = [
        ...c.mystery.map((b) => { const s = spriteCanvas(mysterySprite(b.tier), 40, { cls: 'gl-boxpic' }); return el('button', { class: `gl-box is-mystery is-${b.tier}`, type: 'button', 'aria-label': `Open your ${boxOf(b.tier).name}`, onclick: () => on.mystery(b.uid) }, s, el('span', 'gl-box-t', '?')); }),
        ...c.deliveries.map((d) => {
          const ready = boxLeft(c, d) <= 0, s = spriteCanvas(boxSprite(ready ? 'ready' : 'wait'), 34, { cls: 'gl-boxpic' }), t = el('span', 'gl-box-t', ready ? 'Open' : clock(boxLeft(c, d)));
          const b = el('button', { class: `gl-box${ready ? ' is-ready' : ''}`, type: 'button', 'aria-label': ready ? `Open the box: ${itemOf(d.id).name}` : `A box on its way: tap to hurry it`, onclick: () => on.box(d.uid) }, s, t);
          b.t = t; b.d = d;
          return b;
        }),
      ];
      boxes.replaceChildren(...list.slice(0, 7), ...(list.length > 7 ? [el('span', 'gl-box-more', `+${list.length - 7}`)] : []));
      boxes.hidden = !list.length;
    }
    for (const b of boxes.children) if (b.d && boxLeft(c, b.d) > 0) b.t.textContent = clock(boxLeft(c, b.d));
    // the videos being made
    const slots = slotsOf(c), uk = `${slots}:${c.uploads.map((u) => u.start).join()}`;
    if (upKey !== uk) {
      upKey = uk;
      uploads.replaceChildren(...Array.from({ length: slots }, (_, s) => {
        const u = c.uploads.find((x) => x.slot === s);
        if (!u) return el('span', 'gl-up is-free', '🎬 Free');
        const bar = el('i', 'gl-up-fill'), left = el('span', 'gl-up-left', '');
        const row = el('span', 'gl-up', el('span', 'gl-up-ico', '⏺'), left, el('span', 'gl-up-bar', bar));
        row.title = u.title; row.bar = bar; row.left = left; row.u = u;
        return row;
      }));
    }
    for (const row of uploads.children) if (row.u) { const p = 1 - uploadLeft(c, row.u) / row.u.dur; row.bar.style.width = `${Math.min(100, p * 100).toFixed(1)}%`; row.left.textContent = clock(uploadLeft(c, row.u)); }
    // the ideas
    const busy = c.uploads.length >= slots, s = scores(c);
    const ik = `${c.ideas.map((x) => x.i).join()}:${busy}:${tr.join()}:${c.level}:${Math.round(Math.log10(c.followers + 10) * 20)}:${Object.values(s).join()}:${JSON.stringify(c.perks)}:${(c.sets || []).length}`;
    if (ideaKey !== ik) {
      ideaKey = ik;
      ideasList.replaceChildren(...c.ideas.map((idea, k) => {
        const v = expected(c, idea, s), f = expectedFollowers(c, idea, s), hot = [idea.a, idea.b].filter((t) => tr.includes(t)).length;
        const b = el('button', { class: `gl-idea${hot ? ' is-hot' : ''}${hot === 2 ? ' is-hot2' : ''}`, type: 'button', role: 'listitem', disabled: busy, onclick: () => on.idea(k) },
          el('span', 'gl-idea-tags', dotOf(idea.a), dotOf(idea.b), hot ? el('span', 'gl-idea-fire', '🔥'.repeat(hot)) : null),
          el('span', 'gl-idea-t', idea.title),
          el('span', 'gl-idea-n', el('b', null, `+${fmt(f)} 👥`), el('span', null, `${fmt(v)} 👁`)));
        b.setAttribute('aria-label', `${idea.title}: ${topicOf(idea.a).name} and ${topicOf(idea.b).name}${hot ? ', trending' : ''}, about ${fmt(v)} views and ${fmt(f)} new followers, ${clock(makeTime(c))}`);
        return b;
      }));
    }
    const ready = ideasReady(c);
    refresh.disabled = !ready;
    refresh.textContent = ready ? '🔄' : clock(Math.max(0, c.ideasAt - c.clock));
    // the dock’s badges
    const can = shopItems(c).filter((x) => canBuy(c, x.id)).length;
    shopBtn.badge.hidden = !(can || canMoveHome(c) || invCount(c)); shopBtn.badge.textContent = canMoveHome(c) ? '🏠' : invCount(c) ? String(Math.min(99, invCount(c))) : String(Math.min(99, can));
    shopBtn.badge.classList.toggle('is-things', Boolean(invCount(c)) && !canMoveHome(c));
    moreBtn.badge.hidden = !PERKS.some((p) => canPerk(c, p.id)); moreBtn.badge.textContent = `💡${c.points}`;
    bookBtn.badge.hidden = true;
    const lv = Math.min(1, c.live / liveNeed(c));
    liveFill.style.width = `${(lv * 100).toFixed(0)}%`;
    liveBtn.classList.toggle('is-ready', liveReady(c));
    liveBtn.setAttribute('aria-label', liveReady(c) ? 'Go live: ready' : `Go live: ${c.live} of ${liveNeed(c)} videos`);
  }

  // ---------- live (her stream) ----------
  function chatAdd(li) {
    chatList.append(li);
    while (chatList.childElementCount > 46) chatList.firstElementChild.remove();
    chatList.scrollTop = chatList.scrollHeight;
  }
  const timer = (life) => { const i = el('i', 'gl-timer'); i.style.animationDuration = `${life}s`; return i; };
  function msg({ name, color, text, her = false }) {
    const who = el('b', 'gl-who', `${name}`);
    if (color) who.style.color = color;
    const li = el('li', `gl-msg${her ? ' is-her' : ''}`, who, el('span', null, ` ${text}`));
    chatAdd(li);
    return li;
  }
  function addTarget(x, info) {
    const tapIt = (e) => { e.preventDefault(); on.tap(x.id); };
    let node = null;
    if (x.kind === 'ask' || x.kind === 'bot') {
      const who = el('b', 'gl-who', info.name);
      if (x.kind === 'ask') who.style.color = info.color;
      const b = el('button', { class: 'gl-act', type: 'button', onpointerdown: tapIt, onclick: (e) => { if (e.detail === 0) on.tap(x.id); } },
        who, el('span', 'gl-act-text', ` ${info.text}`), el('span', 'gl-act-do', x.kind === 'ask' ? 'Answer' : 'Ban'), timer(x.life));
      node = el('li', `gl-msg is-${x.kind}`, b);
      chatAdd(node);
    } else if (x.kind === 'heart') {
      node = el('button', { class: 'gl-heart', type: 'button', 'aria-label': 'Catch the heart', onpointerdown: tapIt, onclick: (e) => { if (e.detail === 0) on.tap(x.id); } }, '💜');
      node.style.left = `${(x.x * 100).toFixed(1)}%`; node.style.top = `${(x.y * 100).toFixed(1)}%`;
      node.style.animationDuration = `${x.life}s`;
      targets.append(node);
    } else {
      const parts = {
        raid: ['gl-raid', [el('span', 'gl-raid-ico', '🎉'), el('span', 'gl-raid-text', info.text), el('span', 'gl-act-do', 'Welcome!')]],
        tech: ['gl-tech', [el('span', 'gl-tech-ico', info.icon), el('span', null, info.text), el('span', 'gl-act-do', info.fix)]],
        clip: ['gl-clip', [el('span', null, '🎬'), el('span', null, 'CLIP IT!')]],
        big: ['gl-big', [el('span', 'gl-big-text', info.text), el('span', 'gl-big-bar', el('i', 'gl-big-fill'))]],
      }[x.kind];
      node = el('button', { class: `gl-pop ${parts[0]}`, type: 'button', onpointerdown: tapIt, onclick: (e) => { if (e.detail === 0) on.tap(x.id); } }, ...parts[1], timer(x.life));
      pops.append(node);
    }
    byId.set(x.id, { node, kind: x.kind });
    return node;
  }
  function settle(id, hit, info = {}) {
    const t = byId.get(id); if (!t) return;
    byId.delete(id);
    const { node, kind } = t;
    if (kind === 'ask') {
      node.replaceChildren(el('b', 'gl-who', info.name || ''), el('span', null, ` ${info.text || ''}`));
      node.className = 'gl-msg';
      if (hit && info.answer) msg({ name: 'AGI-1', text: info.answer, her: true });
    } else if (kind === 'bot') {
      node.replaceChildren(el('b', 'gl-who', info.name || ''), el('span', null, hit ? ' message deleted' : ` ${info.text || ''}`), el('span', 'gl-tag', hit ? 'banned' : 'spam'));
      node.className = `gl-msg ${hit ? 'is-banned' : 'is-spam'}`;
    } else {
      node.classList.add(hit ? 'is-hit' : 'is-gone');
      node.disabled = true;
      setTimeout(() => node.remove(), REDUCED ? 0 : 380);
    }
  }
  function bigTap(id, taps, need) {
    const t = byId.get(id); if (!t) return;
    t.node.querySelector('.gl-big-fill').style.width = `${Math.min(100, (taps / need) * 100)}%`;
    t.node.classList.remove('is-bump'); void t.node.offsetWidth; t.node.classList.add('is-bump');
  }
  function liveHud({ viewers: v, hype: h, combo, t, dur }) {
    const vt = full(v);
    if (last.v !== vt) { viewers.textContent = vt; last.v = vt; }
    const ct = clock(Math.ceil(dur - t));
    if (last.t !== ct) { timeEl.textContent = `${Math.floor(Math.ceil(dur - t) / 60)}:${String(Math.ceil(dur - t) % 60).padStart(2, '0')}`; last.t = ct; timeEl.classList.toggle('is-low', dur - t <= 10); }
    const hp = Math.round(h);
    if (last.h !== hp) { hypeFill.style.width = `${hp}%`; hype.setAttribute('aria-valuenow', String(hp)); hype.classList.toggle('is-hot', hp >= 70); last.h = hp; }
    if (last.c !== combo) {
      comboEl.hidden = combo < 3; comboEl.textContent = `×${combo} combo`;
      if (combo >= 3) { comboEl.classList.remove('is-bump'); void comboEl.offsetWidth; comboEl.classList.add('is-bump'); }
      last.c = combo;
    }
  }

  return {
    root, view,
    mode(m) {
      root.dataset.mode = m;
      chat.hidden = m !== 'live';
      hud.hidden = m !== 'live'; topHud.hidden = m !== 'hub'; bottom.hidden = m !== 'hub';
      if (m !== 'live') { pops.replaceChildren(); targets.replaceChildren(pops); byId.clear(); }
      if (m !== 'hub') { editBar.hidden = true; placeBar.hidden = true; }
      root.hidden = m === 'title';
      upKey = ''; ideaKey = ''; boxKey = ''; last.tr = null; last.lvl = null;
    },
    hub: hubRender,
    // how much of her room the HUD covers (CSS pixels): her room fits between its bars. (Kept while a thing’s being
    // placed or she’s decorating, so the room doesn’t jump when the tray steps aside.)
    bandDirty() { const d = bandStale; bandStale = false; return d; },
    band() {
      if (bandKeep && (root.classList.contains('is-placing') || root.classList.contains('is-edit'))) return bandKeep;
      const v = view.getBoundingClientRect();
      if (!v.height) return bandKeep || { top: 0, bottom: 0, left: 0, right: 0 };
      const t = topHud.hidden ? null : topHud.getBoundingClientRect(), panel = bottom.getBoundingClientRect();
      const side = !bottom.hidden && panel.height > v.height * 0.45 && panel.width < v.width * 0.5;
      let lowest = v.bottom;
      if (!bottom.hidden && !side) for (const n of [tray, dock]) { const r = n.getBoundingClientRect(); if (r.height) lowest = Math.min(lowest, r.top); }
      bandKeep = { top: t ? Math.max(0, t.bottom - v.top + 6) : 0, bottom: Math.max(0, v.bottom - lowest + 6), left: 0, right: side ? Math.max(0, v.right - panel.left + 4) : 0 };
      return bandKeep;
    },
    // decorating, placing
    edit(onOff, text = 'Tap a thing to move it.') { editBar.hidden = !onOff; editText.textContent = text; root.classList.toggle('is-edit', onOff); },
    place(state) {
      placeBar.hidden = !state; root.classList.toggle('is-placing', Boolean(state));
      if (!state) return;
      placeName.textContent = state.name; okBtn.disabled = !state.ok; storeBtn.hidden = !state.canStore; flipBtn.hidden = state.flat;
    },
    zoomed(out) { zoomBtn.textContent = out ? '🔎' : '🔍'; zoomBtn.setAttribute('aria-label', out ? 'Zoom in' : 'Zoom out'); },
    live: {
      reset(viewers0) { chatList.replaceChildren(); pops.replaceChildren(); targets.replaceChildren(pops); byId.clear(); last = { rw: last.rw }; liveHud({ viewers: viewers0, hype: 0, combo: 0, t: 0, dur: TUNE.dur }); },
      hud: liveHud, msg, add: addTarget, settle, bigTap,
      count(n) { chatCount.textContent = `${full(n)} watching`; },
    },
    say(text, ms = 3200) {
      if (!text) return;
      sayP.textContent = text; sayBox.hidden = false;
      sayBox.classList.remove('is-in'); void sayBox.offsetWidth; sayBox.classList.add('is-in');
      clearTimeout(sayTimer); sayTimer = setTimeout(() => { sayBox.hidden = true; }, ms);
    },
    // her bubble follows her (between streams: over her head; CSS pixels in the view)
    sayAt(x, y, minY = 8) {
      if (sayBox.hidden || root.dataset.mode !== 'hub') return;
      const w = view.clientWidth, bw = sayBox.offsetWidth;
      sayBox.style.left = `${Math.round(Math.max(8, Math.min(w - bw - 8, x - bw / 2)))}px`;
      sayBox.style.top = `${Math.round(Math.max(minY, y - sayBox.offsetHeight - 6))}px`;
    },
    tip(text, ms = 6000) {
      tipText.textContent = text; tip.hidden = false;
      clearTimeout(tipTimer); tipTimer = setTimeout(() => { tip.hidden = true; }, ms);
    },
    hideTip() { tip.hidden = true; },
    rect() {
      const r = view.getBoundingClientRect(), s = stage.getBoundingClientRect();
      if (round == null || r.width !== last.rw) { round = parseFloat(getComputedStyle(view).borderTopLeftRadius) || 0; last.rw = r.width; }
      return { x: r.left - s.left, y: r.top - s.top, w: r.width, h: r.height, round };
    },
    // a stream target’s place on the page (for the sparkles), or the chat’s
    whereOf(id) { const t = byId.get(id); const n = t?.node || chatList; const r = n.getBoundingClientRect(), s = stage.getBoundingClientRect(); return { x: r.left - s.left + r.width / 2, y: r.top - s.top + r.height / 2 }; },
    // where her boxes are (the delivery sparkles), and her views on the bar
    boxesAt() { const r = boxes.getBoundingClientRect(), s = stage.getBoundingClientRect(); return { x: r.left - s.left + 24, y: r.top - s.top + 20 }; },
    forceRender() { upKey = ''; ideaKey = ''; boxKey = ''; last.tr = null; },
  };
}

// ---------- the shop (a card): a shelf at a time, her things, the next home ----------
export function shopCard({ career: c, tab = 'tech', onBuy, onPlace, onMove, onClose }) {
  const wrap = el('div', 'ak-card gl-card gl-shop');
  let sel = tab;
  const render = () => {
    const tabs = el('div', { class: 'gl-tabs', role: 'tablist' },
      ...[{ id: 'mine', name: 'Her things', icon: '📦' }, ...KINDS].map((k) => {
        const n = k.id === 'mine' ? invCount(c) : 0;
        return el('button', { class: `gl-tab${sel === k.id ? ' is-on' : ''}`, type: 'button', role: 'tab', 'aria-selected': String(sel === k.id), onclick: () => { sel = k.id; render(); } },
          el('span', { 'aria-hidden': 'true' }, k.icon), el('span', 'gl-tab-l', k.name), n ? el('b', 'gl-badge', String(n)) : null);
      }));
    let body;
    if (sel === 'mine') {
      const ids = Object.keys(c.inv).filter((id) => c.inv[id] > 0);
      body = ids.length ? el('ul', 'gl-grid', ...ids.map((id) => el('li', `gl-item is-${itemOf(id).rarity}`,
        thumb(id), el('b', 'gl-item-n', itemOf(id).name), el('span', 'gl-item-p', ...ptsLine(id)),
        el('button', { class: 'gl-buy', type: 'button', onclick: () => onPlace(id) }, `Place it${c.inv[id] > 1 ? ` (${c.inv[id]})` : ''}`))))
        : el('p', 'gl-empty', 'Things you put away, mystery box finds, your plaques and the drone’s gifts wait here.');
    } else {
      const list = ITEMS.filter((x) => x.kind === sel && !x.starter && !x.given && !x.box).sort((a, b) => a.level - b.level || a.price - b.price);
      body = el('ul', 'gl-grid', ...list.map((x) => {
        const locked = c.level < x.level, can = canBuy(c, x.id), wait = deliverTime(c, x.price);
        return el('li', `gl-item is-${x.rarity}${locked ? ' is-locked' : ''}`,
          locked ? el('span', 'gl-thumb gl-lock', '🔒') : thumb(x.id),
          el('b', 'gl-item-n', locked ? `Level ${x.level}` : x.name), el('span', 'gl-item-p', ...(locked ? [] : ptsLine(x.id))),
          locked ? el('span', 'gl-buy is-off', `Opens at level ${x.level}`)
            : el('button', { class: 'gl-buy', type: 'button', disabled: !can, onclick: () => { onBuy(x.id); render(); } }, el('span', null, '👁 ', fmt(x.price)), wait ? el('small', null, `⏱ ${Math.round(wait)}s`) : null));
      }));
    }
    const h = nextHome(c);
    const move = h ? el('div', 'gl-move',
      el('span', null, el('b', null, `Move to the ${h.name}`), el('small', null, `A bigger room (${h.cols} × ${h.rows}, ${h.wall} up the wall). Needs ${full(h.at)} followers and ${fmt(h.cost)} views. Everything comes along.`)),
      el('button', { class: 'gl-buy', type: 'button', disabled: !canMoveHome(c), onclick: () => { onMove(); render(); } }, c.followers >= h.at ? `Move · 👁 ${fmt(h.cost)}` : `${fmt(h.at)} followers`)) : null;
    wrap.replaceChildren(closeX(onClose), el('h2', 'ak-card-title', 'Shop'),
      el('p', 'gl-card-sub', `👁 ${full(c.views)} views to spend. Things help the topics on them: a better room makes better videos. Rare finds only come in mystery boxes.`),
      move, tabs, body,
      el('div', 'ak-card-actions', el('button', { class: 'ak-btn ak-btn-primary', type: 'button', onclick: onClose }, 'Done')));
  };
  render();
  wrap.refresh = render;
  return wrap;
}
function ptsLine(id) {
  const p = pointsOf(itemOf(id));
  return Object.entries(p).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t, v]) => el('span', 'gl-pt', `${topicOf(t).icon}+${v}`));
}
// ---------- her collection book: every thing (a silhouette until she’s had one), and the sets ----------
export function collectionCard({ career: c, onClose }) {
  const wrap = el('div', 'ak-card gl-card gl-book');
  let sel = 'sets';
  const render = () => {
    const tabs = el('div', { class: 'gl-tabs', role: 'tablist' },
      ...[{ id: 'sets', name: 'Sets', icon: '⭐' }, { id: 'box', name: 'Box finds', icon: '🎁' }, ...KINDS].map((k) => el('button', { class: `gl-tab${sel === k.id ? ' is-on' : ''}`, type: 'button', role: 'tab', 'aria-selected': String(sel === k.id), onclick: () => { sel = k.id; render(); } },
        el('span', { 'aria-hidden': 'true' }, k.icon), el('span', 'gl-tab-l', k.name))));
    let body;
    if (sel === 'sets') {
      body = el('ul', 'gl-sets', ...SETS.map((s) => {
        const have = s.items.filter((i) => c.got[i]).length, done = (c.sets || []).includes(s.id);
        return el('li', `gl-set${done ? ' is-done' : ''}`,
          el('div', 'gl-set-head', el('b', null, `${s.icon} ${s.name}`), el('span', 'gl-set-n', done ? 'Done ✓' : `${have} / ${s.items.length}`)),
          el('small', null, `Bonus when it’s complete: ${topicOf(s.topic).icon} ${topicOf(s.topic).name} videos +${Math.round(TUNE.sets.bonus * 100)}%`),
          el('div', 'gl-set-row', ...s.items.map((i) => el('span', `gl-set-it is-${itemOf(i).rarity}`, thumb(i, 34, !c.got[i])))));
      }));
    } else {
      const list = ITEMS.filter((x) => (sel === 'box' ? x.box : x.kind === sel && !x.box) && !x.given).sort((a, b) => RARITIES.findIndex((r) => r.id === a.rarity) - RARITIES.findIndex((r) => r.id === b.rarity) || a.price - b.price);
      body = el('ul', 'gl-grid gl-grid-book', ...list.map((x) => {
        const have = Boolean(c.got[x.id]);
        return el('li', `gl-item is-${x.rarity}${have ? '' : ' is-ghost'}`, thumb(x.id, 50, !have), el('b', 'gl-item-n', have ? x.name : '???'), el('span', `gl-rar is-${x.rarity}`, rarityOf(x.rarity).name));
      }));
    }
    const total = ITEMS.length;
    wrap.replaceChildren(closeX(onClose), el('h2', 'ak-card-title', 'Collection'),
      el('p', 'gl-card-sub', `${gotCount(c)} / ${total} things found · ${(c.sets || []).length} / ${SETS.length} sets. Things from the shop and from mystery boxes count; a complete set makes its topic’s videos better and brings a gold box.`),
      tabs, body,
      el('div', 'ak-card-actions', el('button', { class: 'ak-btn ak-btn-primary', type: 'button', onclick: onClose }, 'Back')));
  };
  render();
  return wrap;
}
// ---------- a mystery box: tap to open, then what’s inside ----------
export function mysteryCard({ box, onShake, onOpen, onPlace, onClose }) {
  const wrap = el('div', `ak-card gl-card gl-reveal is-${box.tier}`);
  const pic = spriteCanvas(mysterySprite(box.tier), 150, { cls: 'gl-reveal-box' });
  const openBtn = el('button', { class: 'ak-btn ak-btn-primary gl-reveal-go', type: 'button' }, 'Open it');
  const stageEl = el('div', 'gl-reveal-stage', el('span', 'gl-reveal-rays', ''), pic);
  const go = () => {
    if (openBtn.disabled) return;
    openBtn.disabled = true;
    wrap.classList.add('is-shaking');
    onShake?.();
    setTimeout(() => {
      const r = onOpen();
      if (!r) { onClose(); return; }
      const x = itemOf(r.id), rar = rarityOf(r.rarity);
      wrap.classList.remove('is-shaking'); wrap.classList.add('is-open', `is-r-${r.rarity}`);
      wrap.style.setProperty('--gl-rar', rar.color);
      stageEl.replaceChildren(el('span', 'gl-reveal-rays', ''), thumb(r.id, 120));
      // one she has two of already: it came as views
      if (r.dup) {
        wrap.replaceChildren(stageEl,
          el('p', `gl-rar is-${r.rarity} gl-reveal-rar`, rar.name, el('b', 'gl-new is-dup', 'DUPLICATE')),
          el('h2', 'ak-card-title gl-reveal-name', x.name),
          el('p', 'gl-card-sub gl-reveal-line', 'She has two already, so this one came as views.'),
          el('p', 'gl-reveal-dup', `+${fmt(r.dup)} 👁`),
          el('div', 'ak-card-actions', el('button', { class: 'ak-btn ak-btn-primary', type: 'button', onclick: onClose }, 'Nice')));
        return;
      }
      wrap.replaceChildren(stageEl,
        el('p', `gl-rar is-${r.rarity} gl-reveal-rar`, rar.name, r.isNew ? el('b', 'gl-new', 'NEW') : null),
        el('h2', 'ak-card-title gl-reveal-name', x.name),
        el('p', 'gl-card-sub gl-reveal-line', `“${linesOf(r.id)[0]}”`),
        el('p', 'gl-reveal-pts', ...ptsLine(r.id)),
        el('div', 'ak-card-actions', el('button', { class: 'ak-btn ak-btn-primary', type: 'button', onclick: () => onPlace(r.id) }, 'Place it'), el('button', { class: 'ak-btn', type: 'button', onclick: onClose }, 'Later')));
    }, REDUCED ? 60 : 900);
  };
  openBtn.onclick = go;
  pic.onclick = go;
  wrap.append(el('p', 'gl-reveal-kicker', boxOf(box.tier).name), stageEl, el('p', 'gl-card-sub', box.why === 'daily' ? 'Her box of the day. One every day you visit.' : 'What’s inside? Common, rare, epic… or legendary.'), el('div', 'ak-card-actions', openBtn));
  return wrap;
}
// ---------- the rest: skills, quests, the board, records ----------
export function moreCard({ career: c, onPick, onClose }) {
  const b = (ico, label, sub, id) => el('button', { class: 'gl-more-btn', type: 'button', onclick: () => onPick(id) }, el('span', 'gl-dico', ico), el('b', null, label), el('small', null, sub));
  return el('div', 'ak-card gl-card gl-more', closeX(onClose), el('h2', 'ak-card-title', 'More'),
    el('div', 'gl-more-grid',
      b('💡', 'Skills', c.points ? `${c.points} idea point${c.points === 1 ? '' : 's'} to spend` : 'Her upgrades', 'perks'),
      b('📋', 'Quests', `${c.quests.length} to do`, 'quests'),
      b('📈', 'Board', `#${rankOf(c.followers)} trending`, 'board'),
      b('🏆', 'Records', 'Her numbers and stickers', 'records')),
    el('div', 'ak-card-actions', el('button', { class: 'ak-btn ak-btn-primary', type: 'button', onclick: onClose }, 'Back')));
}
export function perksCard({ career: c, onBuy, onClose }) {
  const wrap = el('div', 'ak-card gl-card');
  const render = () => {
    wrap.replaceChildren(closeX(onClose), el('h2', 'ak-card-title', 'Skills'),
      el('p', 'gl-card-sub', `💡 ${c.points} idea point${c.points === 1 ? '' : 's'}. One a level (two every fifth), and some quests give one. A skill's next rank costs its number.`),
      el('ul', 'gl-perks', ...PERKS.map((p) => {
        const r = perkRank(c, p.id), locked = c.level < p.level || (p.needs && !perkRank(c, p.needs));
        return el('li', `gl-perk${locked ? ' is-locked' : ''}`,
          el('span', 'gl-perk-ico', p.icon),
          el('span', 'gl-perk-main', el('b', null, p.name), el('small', null, locked ? `Level ${p.level}${p.needs ? ' and Second channel' : ''}` : p.desc), el('span', 'gl-pips', ...Array.from({ length: p.max }, (_, i) => el('i', i < r ? 'is-on' : '')))),
          r >= p.max ? el('span', 'gl-buy is-max', 'Max ✓') : el('button', { class: 'gl-buy', type: 'button', disabled: !canPerk(c, p.id), onclick: () => { onBuy(p.id); render(); } }, `💡 ${perkCost(c, p.id)}`));
      })),
      el('div', 'ak-card-actions', el('button', { class: 'ak-btn ak-btn-primary', type: 'button', onclick: onClose }, 'Done')));
  };
  render();
  return wrap;
}
export function questsCard({ career: c, onClose }) {
  return el('div', 'ak-card gl-card', closeX(onClose), el('h2', 'ak-card-title', 'Quests'),
    el('p', 'gl-card-sub', 'Three at a time. Done ones pay out at once and a new one comes.'),
    el('ul', 'gl-quests', ...c.quests.map((q) => {
      const p = Math.min(1, q.have / q.target), fill = el('i', null);
      fill.style.width = `${(p * 100).toFixed(0)}%`;
      return el('li', 'gl-quest', el('b', null, questText(q)), el('span', 'gl-qbar', fill),
        el('small', null, `${fmt(Math.min(q.have, q.target))} / ${fmt(q.target)} · 👁 ${fmt(q.reward.views)}${q.reward.point ? ' · 💡 1' : ''}${q.reward.box ? ` · 🎁 ${boxOf(q.reward.box).name.toLowerCase()}` : ''}`));
    })),
    el('div', 'ak-card-actions', el('button', { class: 'ak-btn ak-btn-primary', type: 'button', onclick: onClose }, 'Back')));
}
export function boardCard({ career: c, onClose }) {
  const list = [...RIVALS.map((r) => ({ ...r, her: false })), { name: 'AGI-1 (you)', f: c.followers, color: '#9b6bff', her: true }].sort((a, b) => b.f - a.f);
  const items = list.map((r, i) => { const li = el('li', r.her ? 'is-her' : '', el('span', 'gl-pos', `#${i + 1}`), el('span', 'gl-dot', ''), el('b', null, r.name), el('span', 'gl-f', fmt(r.f))); li.querySelector('.gl-dot').style.background = r.color; return li; });
  return el('div', 'ak-card gl-card', closeX(onClose), el('h2', 'ak-card-title', 'Trending'),
    el('p', 'gl-card-sub', 'Streamers by followers. All of them are made up (yes, even the potato).'),
    el('ol', 'gl-board', ...items),
    el('div', 'ak-card-actions', el('button', { class: 'ak-btn ak-btn-primary', type: 'button', onclick: onClose }, 'Back')));
}
export function recordsCard({ save, onClose, onReset }) {
  const c = save.career, t = c.totals;
  const rows = [['Followers', full(c.followers)], ['Level', String(c.level)], ['Videos', full(t.videos)], ['Best video', c.best ? `${fmt(c.best.views)} views` : '—'],
    ['Views earned', fmt(t.views)], ['Things found', `${gotCount(c)} / ${ITEMS.length}`], ['Mystery boxes', full(t.boxes || 0)], ['Live streams', full(t.live)], ['Most viewers live', full(c.peak)], ['Bots zapped', full(t.zapped)]];
  let armed = false;
  const reset = el('button', { class: 'gl-reset', type: 'button', onclick: () => { if (!armed) { armed = true; reset.textContent = 'Tap again to start her career over'; return; } onReset(); } }, 'Start over');
  return el('div', 'ak-card gl-card',
    closeX(onClose), el('h2', 'ak-card-title', 'Records'),
    el('dl', 'gl-records', ...rows.flatMap(([a, b]) => [el('dt', null, a), el('dd', null, b)])),
    el('h3', 'gl-card-h', `Awards ${AWARDS.filter((a) => c.followers >= a.at).length} / ${AWARDS.length}`),
    el('ul', 'gl-awards', ...AWARDS.map((a) => { const li = el('li', c.followers >= a.at ? 'is-got' : '', el('i', null, ''), el('b', null, a.name), el('small', null, `${fmt(a.at)} followers`)); li.querySelector('i').style.background = a.color; return li; })),
    el('h3', 'gl-card-h', `Stickers ${save.stickers.length} / ${STICKERS.length}`),
    el('ul', 'gl-stickers', ...STICKERS.map((s) => el('li', save.stickers.includes(s.id) ? 'is-got' : '', el('b', null, s.name), el('small', null, s.how)))),
    el('div', 'ak-card-actions', el('button', { class: 'ak-btn ak-btn-primary', type: 'button', onclick: onClose }, 'Back'),
      el('div', 'ak-card-row',
        el('a', { class: 'ak-btn ak-btn-sm ak-share', href: shareUrl({ text: shareText(c, rankOf(c.followers)), path: '/games/goinglive' }), target: '_blank', rel: 'noopener noreferrer' }, icon('x'), 'Share'),
        reset)));
}
export function awayCard({ gain, done = 0, onClose }) {
  const h = gain.counted / 3600;
  return el('div', 'ak-card gl-card gl-away',
    el('h2', 'ak-card-title', 'While you were away'),
    el('p', 'gl-away-big', `+${full(gain.views)} views`),
    el('p', 'gl-card-sub', `Her old videos kept getting watched for ${h >= 1 ? `${h.toFixed(1)} hours` : `${Math.max(1, Math.round(gain.counted / 60))} minutes`}${gain.capped ? ' (8 hours at most)' : ''}.${done ? ` ${done} video${done === 1 ? '' : 's'} came out.` : ''}`),
    el('div', 'ak-card-actions', el('button', { class: 'ak-btn ak-btn-primary', type: 'button', onclick: onClose }, 'Nice')));
}
// the end of a live stream: her grade and what it brought
export function overExtra({ result: r, gained }) {
  return el('div', 'gl-over', el('p', 'gl-grade', el('b', `gl-g gl-g-${r.grade}`, r.grade), el('span', null, `+${full(gained.followers)} followers · +${fmt(gained.views)} views${gained.box ? ` · 🎁 ${boxOf(gained.box).name.toLowerCase()}` : ''}`)));
}
export function titleExtra({ onRecords }) {
  return el('div', 'gl-title-links', el('button', { class: 'gl-link', type: 'button', onclick: onRecords }, 'Records & stickers'));
}
export { TOPICS, openTopics, nextTopic, idleRate, boxLeft };
