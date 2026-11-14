// GOING LIVE: the page around her room, made with DOM methods in the arcade kit's sticker look. Between streams: what to
// stream (a card each, with what it draws, what's trending, what chat is tired of), GO LIVE, her room's shop, the board
// and her records. Live: her stream's own overlay on the view (LIVE, viewers, the clock, the hype, the combo; raids,
// tech problems, clips, her big moment and hearts to tap) and her chat beside or under it (questions to answer, bots to
// ban). Everything to tap is a real button.
import { el, icon } from '../kit/shell.js';
import { REDUCED } from '../kit/env.js';
import { CATS, SLOTS, ROOMS, RIVALS, AWARDS, catOf } from './data.js';
import { unlocked, startViewers, trendOf, trendLeft, nextTier, tierOf, nextRoom, idleRate, rankOf, nextUnlock, bestUpgrades } from './econ.js';
import { thing } from './art.js';
import { STICKERS } from './progress.js';

const closeX = (fn) => el('button', { class: 'ak-ibtn ak-close', type: 'button', 'aria-label': 'Close', onclick: fn }, icon('close'));
export const ICON = Object.freeze({ talk: '💬', game: '🎮', sing: '🎤', art: '🎨', cook: '🍳', code: '💻', cozy: '🌙', dance: '💃' });
const NF = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
export const fmt = (n) => (Math.abs(n) < 1000 ? String(Math.round(n)) : NF.format(n));
export const full = (n) => Math.round(n).toLocaleString('en-US');
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, '0')}`;

export function createUI(stage, on) {
  // ---------- the view: her room, or her stream ----------
  const liveTag = el('span', 'gl-live', 'LIVE');
  const viewers = el('b', 'gl-viewers', '0');
  const timeEl = el('span', 'gl-time', '1:00');
  const hypeFill = el('i', 'gl-hype-fill');
  const hype = el('div', { class: 'gl-hype', role: 'meter', 'aria-label': 'Hype', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' }, el('span', 'gl-hype-label', 'HYPE'), el('span', 'gl-hype-bar', hypeFill));
  const comboEl = el('span', { class: 'gl-combo', hidden: true }, '');
  const hud = el('div', 'gl-hud', el('div', 'gl-hud-row', liveTag, el('span', { class: 'gl-eye', 'aria-hidden': 'true' }, '👁'), viewers, timeEl), el('div', 'gl-hud-row2', hype, comboEl));
  // raids, tech problems, clips and her big moment stack in one column (a new one goes under the others: nothing jumps
  // under a finger); hearts float wherever they are
  const pops = el('div', 'gl-pops');
  const targets = el('div', { class: 'gl-targets', 'aria-label': 'Things happening on her stream' }, pops);
  const sayP = el('p', null, '');
  const sayBox = el('div', { class: 'gl-say', hidden: true, role: 'status' }, el('b', null, 'AGI-1'), sayP);
  const roomName = el('span', 'gl-roomname', '');
  const rankTag = el('span', 'gl-ranktag', '');
  const roomTag = el('div', 'gl-roomtag', roomName, rankTag);
  const tipText = el('span', null, '');
  const tip = el('div', { class: 'gl-tip', hidden: true, role: 'status' }, el('b', null, 'Tip'), tipText);
  const view = el('div', 'gl-view', hud, targets, sayBox, roomTag, tip);

  // ---------- between streams ----------
  const nextEl = el('span', 'gl-next', '');
  const rankEl = el('b', 'gl-rank', '');
  const rankRow = el('button', { class: 'gl-rankrow', type: 'button', onclick: () => on.board() }, rankEl, nextEl);
  const cats = el('div', { class: 'gl-cats', role: 'radiogroup', 'aria-label': 'What to stream' });
  const goSub = el('small', null, '');
  const go = el('button', { class: 'gl-go', type: 'button', onclick: () => on.live() }, el('span', 'gl-go-dot', ''), el('span', 'gl-go-text', 'GO LIVE'), goSub);
  const shopN = el('b', { class: 'gl-badge', hidden: true }, '');
  const shopBtn = el('button', { class: 'gl-tool', type: 'button', onclick: () => on.shop() }, el('span', { 'aria-hidden': 'true' }, '🛋️'), el('span', null, 'Her room'), shopN);
  const boardBtn = el('button', { class: 'gl-tool', type: 'button', onclick: () => on.board() }, el('span', { 'aria-hidden': 'true' }, '📈'), el('span', null, 'Trending'));
  const recBtn = el('button', { class: 'gl-tool', type: 'button', onclick: () => on.records() }, el('span', { 'aria-hidden': 'true' }, '🏆'), el('span', null, 'Records'));
  const idle = el('p', 'gl-idle', '');
  const hub = el('div', 'gl-hub', rankRow, el('p', 'gl-h', 'What to stream'), cats, go, el('div', 'gl-tools', shopBtn, boardBtn, recBtn), idle);

  // ---------- her chat ----------
  const chatList = el('ol', { class: 'gl-chat-list', 'aria-label': 'Her chat' });
  const chatCount = el('span', 'gl-chat-n', '');
  const chat = el('div', { class: 'gl-chat', hidden: true }, el('div', 'gl-chat-head', el('b', null, 'Chat'), chatCount), chatList);
  const side = el('div', 'gl-side', hub, chat);
  const root = el('div', { class: 'gl-ui', 'data-mode': 'hub' }, view, side);
  stage.append(root);

  let sayTimer = 0, tipTimer = 0, sel = null, last = {}, catsKey = '', round = null;
  const byId = new Map();     // a target's elements
  const catBtn = {};

  // ---------- between streams ----------
  function hubRender(c) {
    const open = unlocked(c), key = open.map((k) => k.id).join() + (nextUnlock(c)?.id || '');
    if (key !== catsKey) {
      catsKey = key; cats.replaceChildren();
      for (const k of CATS) {
        const isOpen = open.includes(k);
        const draw = el('span', 'gl-cat-draw', ''), flag = el('span', 'gl-cat-flag', '');
        const b = el('button', { class: 'gl-cat', type: 'button', role: 'radio', 'aria-checked': 'false', 'data-cat': k.id, disabled: !isOpen, onclick: () => on.pick(k.id) },
          el('span', { class: 'gl-cat-ico', 'aria-hidden': 'true' }, isOpen ? ICON[k.id] : '🔒'), el('span', 'gl-cat-name', k.short), draw, flag);
        b.style.setProperty('--gl-c', k.color);
        catBtn[k.id] = { b, draw, flag };
        if (isOpen || k === nextUnlock(c)) cats.append(b);
      }
    }
    const tr = trendOf(c);
    for (const k of CATS) {
      const x = catBtn[k.id]; if (!x) continue;
      const isOpen = c.followers >= k.unlock;
      if (!isOpen) { x.draw.textContent = `at ${fmt(k.unlock)}`; x.flag.textContent = 'followers'; x.flag.className = 'gl-cat-flag'; continue; }
      x.draw.textContent = `👁 ${fmt(startViewers(c, k.id) * 1.6)}`;
      const tired = (c.fresh[k.id] ?? 1) < 0.7;
      x.flag.textContent = tr === k.id ? `🔥 trending (${trendLeft(c)})` : tired ? '😴 chat is tired' : '';
      x.flag.className = `gl-cat-flag${tr === k.id ? ' is-hot' : tired ? ' is-tired' : ''}`;
      x.b.setAttribute('aria-checked', String(sel === k.id));
      x.b.classList.toggle('is-on', sel === k.id);
      x.b.setAttribute('aria-label', `${k.name}: about ${fmt(startViewers(c, k.id) * 1.6)} viewers${tr === k.id ? ', trending' : ''}${tired ? ', chat is tired of it' : ''}`);
    }
    const k = catOf(sel);
    goSub.textContent = k ? `${k.name} · about ${fmt(startViewers(c, k.id) * 1.6)} viewers` : 'Pick what to stream';
    go.disabled = !k;
    const rank = rankOf(c.followers), nx = [...RIVALS].reverse().find((r) => r.f > c.followers);
    rankEl.textContent = `#${rank} trending`;
    nextEl.textContent = nx ? `Next: ${nx.name} · ${fmt(nx.f)}` : 'Nobody above you. 👑';
    roomName.textContent = ROOMS[c.room || 0].name;
    rankTag.textContent = `#${rank}`;
    const can = SLOTS.filter((s) => { const t = nextTier(c, s.id); return t && t.cost <= c.views; }).length + (nextRoom(c) && c.followers >= nextRoom(c).at && c.views >= nextRoom(c).cost ? 1 : 0);
    if (last.can !== can) { shopN.hidden = !can; shopN.textContent = String(can); last.can = can; }
    const ir = idleRate(c);
    const it = ir > 0 ? `Her old streams earn ${ir < 10 ? ir.toFixed(1) : fmt(ir)} views a second, even while you're away.` : 'Stream to start earning views.';
    if (last.idle !== it) { idle.textContent = it; last.idle = it; }
  }

  // ---------- live ----------
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
    if (last.t !== ct) { timeEl.textContent = ct; last.t = ct; timeEl.classList.toggle('is-low', dur - t <= 10); }
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
      hub.hidden = m !== 'hub'; chat.hidden = m !== 'live';
      hud.hidden = m !== 'live'; roomTag.hidden = m !== 'hub';
      if (m !== 'live') { pops.replaceChildren(); targets.replaceChildren(pops); byId.clear(); }
      root.hidden = m === 'title';
    },
    pick(id) { sel = id; },
    hub: hubRender,
    live: {
      reset(viewers0) { chatList.replaceChildren(); pops.replaceChildren(); targets.replaceChildren(pops); byId.clear(); last = { rw: last.rw }; liveHud({ viewers: viewers0, hype: 0, combo: 0, t: 0, dur: 60 }); },
      hud: liveHud, msg, add: addTarget, settle, bigTap,
      count(n) { chatCount.textContent = `${full(n)} watching`; },
    },
    say(text, ms = 3200) {
      if (!text) return;
      sayP.textContent = text; sayBox.hidden = false;
      sayBox.classList.remove('is-in'); void sayBox.offsetWidth; sayBox.classList.add('is-in');
      clearTimeout(sayTimer); sayTimer = setTimeout(() => { sayBox.hidden = true; }, ms);
    },
    tip(text, ms = 6000) {
      tipText.textContent = text; tip.hidden = false;
      tip.classList.remove('is-in'); void tip.offsetWidth; tip.classList.add('is-in');
      clearTimeout(tipTimer); tipTimer = setTimeout(() => { tip.hidden = true; }, ms);
    },
    hideTip() { tip.hidden = true; },
    rect() {
      const r = view.getBoundingClientRect(), s = stage.getBoundingClientRect();
      if (round == null || r.width !== last.rw) { round = parseFloat(getComputedStyle(view).borderTopLeftRadius) || 0; last.rw = r.width; }
      return { x: r.left - s.left, y: r.top - s.top, w: r.width, h: r.height, round };
    },
    // a target's place on the page (for the sparkles), or the chat's
    whereOf(id) { const t = byId.get(id); const n = t?.node || chatList; const r = n.getBoundingClientRect(), s = stage.getBoundingClientRect(); return { x: r.left - s.left + r.width / 2, y: r.top - s.top + r.height / 2 }; },
    go,
  };
}

// ---------- her room's shop (a card) ----------
const STAT_NAME = Object.fromEntries(CATS.map((k) => [k.id, k.short]));
function statsLine(t, from) {
  const gains = Object.entries(t.stats).map(([id, v]) => [id, v - (from?.stats?.[id] || 0)]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 3);
  return gains.map(([id, v]) => `${ICON[id]} +${v}`).join('  ');
}
export function shopCard({ career: c, sel, onBuy, onMove, onClose }) {
  const wrap = el('div', 'ak-card gl-card');
  const render = () => {
    const best = sel ? bestUpgrades(c, sel).filter((u) => u.gain > 0).slice(0, 2).map((u) => u.slot) : [];
    const rows = SLOTS.map((s) => {
      const now = tierOf(c, s.id), nx = nextTier(c, s.id);
      const cv = el('canvas', { class: 'gl-thing', width: '128', height: '128', 'aria-hidden': 'true' });
      const g = cv.getContext('2d'); thing(g, s.id, nx ? (c.owned[s.id] || 0) + 1 : c.owned[s.id] || 0, 128, 1);
      const can = nx && c.views >= nx.cost;
      const btn = nx
        ? el('button', { class: 'gl-buy', type: 'button', disabled: !can, onclick: () => { onBuy(s.id); render(); } }, el('span', null, can ? 'Get it' : 'Need'), el('b', null, `${fmt(nx.cost)} views`))
        : el('span', 'gl-buy is-max', 'Best ✓');
      return el('li', `gl-row${best.includes(s.id) ? ' is-pick' : ''}`, cv,
        el('span', 'gl-row-main', el('b', null, nx ? nx.name : now.name), el('small', null, nx ? `${s.name}: now ${now.name}` : `${s.name}: the best there is`), nx ? el('small', 'gl-row-stats', statsLine(nx, now)) : ''),
        btn);
    });
    const r = nextRoom(c);
    const move = r ? el('div', 'gl-move',
      el('span', null, el('b', null, `Move to the ${r.name}`), el('small', null, `Every stream draws ×${(r.mult / ROOMS[c.room || 0].mult).toFixed(2)} more. Needs ${full(r.at)} followers and ${fmt(r.cost)} views.`)),
      el('button', { class: 'gl-buy', type: 'button', disabled: !(c.followers >= r.at && c.views >= r.cost), onclick: () => { onMove(); render(); } }, el('span', null, c.followers >= r.at ? 'Move' : 'Soon'), el('b', null, `${fmt(r.cost)} views`))) : '';
    wrap.replaceChildren(
      closeX(onClose), el('h2', 'ak-card-title', 'Her room'),
      el('p', 'gl-card-sub', `${full(c.views)} views to spend.${sel ? ` Marked: best for ${catOf(sel).name}.` : ''}`),
      move, el('ul', 'gl-rows', ...rows),
      el('div', 'ak-card-actions', el('button', { class: 'ak-btn ak-btn-primary', type: 'button', onclick: onClose }, 'Done')),
    );
  };
  render();
  return wrap;
}
// ---------- the trending board ----------
export function boardCard({ career: c, onClose }) {
  const list = [...RIVALS.map((r) => ({ ...r, her: false })), { name: 'AGI-1 (you)', f: c.followers, color: '#9b6bff', her: true }].sort((a, b) => b.f - a.f);
  const items = list.map((r, i) => el('li', r.her ? 'is-her' : '', el('span', 'gl-pos', `#${i + 1}`), el('span', 'gl-dot', ''), el('b', null, r.name), el('span', 'gl-f', fmt(r.f))));
  items.forEach((li, i) => li.querySelector('.gl-dot').style.background = list[i].color);
  return el('div', 'ak-card gl-card', closeX(onClose), el('h2', 'ak-card-title', 'Trending'),
    el('p', 'gl-card-sub', 'Streamers by followers. All of them are made up (yes, even the potato).'),
    el('ol', 'gl-board', ...items),
    el('div', 'ak-card-actions', el('button', { class: 'ak-btn ak-btn-primary', type: 'button', onclick: onClose }, 'Back')));
}
// ---------- her records and stickers ----------
export function recordsCard({ save, onClose, onReset }) {
  const c = save.career, t = c.totals;
  const rows = [['Followers', full(c.followers)], ['Streams', full(c.streams)], ['Most viewers live', full(c.peak)], ['Views earned', fmt(t.views)],
    ['Questions answered', full(t.answered)], ['Bots banned', full(t.banned)], ['Raids welcomed', full(t.raids)], ['Clips', full(t.clips)], ['Best combo', full(c.bestCombo)]];
  let armed = false;
  const reset = el('button', { class: 'gl-reset', type: 'button', onclick: () => { if (!armed) { armed = true; reset.textContent = 'Tap again to start her career over'; return; } onReset(); } }, 'Start over');
  return el('div', 'ak-card gl-card', closeX(onClose),
    el('h2', 'ak-card-title', 'Records'),
    el('dl', 'gl-records', ...rows.flatMap(([a, b]) => [el('dt', null, a), el('dd', null, b)])),
    el('h3', 'gl-card-h', `Awards ${AWARDS.filter((a) => c.followers >= a.at).length} / ${AWARDS.length}`),
    el('ul', 'gl-awards', ...AWARDS.map((a) => { const li = el('li', c.followers >= a.at ? 'is-got' : '', el('i', null, ''), el('b', null, a.name), el('small', null, `${fmt(a.at)} followers`)); li.querySelector('i').style.background = a.color; return li; })),
    el('h3', 'gl-card-h', `Stickers ${save.stickers.length} / ${STICKERS.length}`),
    el('ul', 'gl-stickers', ...STICKERS.map((s) => el('li', save.stickers.includes(s.id) ? 'is-got' : '', el('b', null, s.name), el('small', null, s.how)))),
    el('div', 'ak-card-actions', el('button', { class: 'ak-btn ak-btn-primary', type: 'button', onclick: onClose }, 'Back'), reset));
}
export function awayCard({ gain, onClose }) {
  const h = gain.counted / 3600;
  return el('div', 'ak-card gl-card gl-away',
    el('h2', 'ak-card-title', 'While you were away'),
    el('p', 'gl-away-big', `+${full(gain.views)} views`),
    el('p', 'gl-card-sub', `Her old streams kept getting watched for ${h >= 1 ? `${h.toFixed(1)} hours` : `${Math.max(1, Math.round(gain.counted / 60))} minutes`}${gain.capped ? ' (8 hours at most)' : ''}.`),
    el('div', 'ak-card-actions', el('button', { class: 'ak-btn ak-btn-primary', type: 'button', onclick: onClose }, 'Nice')));
}
export function overExtra({ result: r, gained, newStickers }) {
  const bits = [el('p', 'gl-grade', el('b', `gl-g gl-g-${r.grade}`, r.grade), el('span', null, `+${full(r.followers)} followers · +${fmt(r.views)} views`))];
  const news = [...gained.awards.map((a) => `🏆 ${a.name}`), ...gained.opened.map((k) => `${ICON[k.id]} ${k.name} unlocked`), ...(gained.room ? [`🏠 ${gained.room.name}: ready to move`] : []), ...gained.passed.slice(-2).map((x) => `📈 Passed ${x.name}`), ...newStickers.map((s) => `✨ ${s.name}`)];
  if (news.length) bits.push(el('p', 'gl-news', ...news.map((t) => el('span', null, t))));
  return el('div', 'gl-over', ...bits);
}
export function titleExtra({ onRecords }) {
  return el('div', 'gl-title-links', el('button', { class: 'gl-link', type: 'button', onclick: onRecords }, 'Records & stickers'));
}
