// GUARDRAILS: the page's own controls over the map, real buttons in the arcade's sticker look: the tray of six
// guardrails (tap one to place it, or drag it onto the map), the next wave's preview with Send and the 1× / 2× speed,
// the radial menu that opens on a tile, and a guardrail's card (upgrade with a preview, targeting, remove).
import { el } from '../kit/shell.js';
import { TOWERS, TOWER_ORDER, CREATURES, TARGET_MODES, TARGET_NAMES, statsOf, upgradeCost, buildCost, rebuildCost } from './data.js';
import { towerIcon, creatureIcon } from './art.js';

const NS = 'http://www.w3.org/2000/svg';
function svgIcon(kind, cls = 'gr-ico') {
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('class', cls);
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('focusable', 'false');
  const p = document.createElementNS(NS, 'path');
  const D = {
    bolt: 'M13.5 2 4.5 13.6h6.2L9.6 22l9.9-12.4h-6.3z',
    heart: 'M12 21.2s-8.6-5.2-8.6-11.3A4.9 4.9 0 0 1 12 6.6a4.9 4.9 0 0 1 8.6 3.3c0 6.1-8.6 11.3-8.6 11.3z',
    wave: 'M2 14c2.5 0 2.5-4 5-4s2.5 4 5 4 2.5-4 5-4 2.5 4 5 4',
    play: 'M8 5.2v13.6c0 .8.9 1.3 1.6.9l10.4-6.8c.6-.4.6-1.3 0-1.7L9.6 4.3C8.9 3.9 8 4.4 8 5.2z',
    ff: 'M3 6.2v11.6c0 .8.9 1.2 1.5.8l7.5-5.8c.5-.4.5-1.2 0-1.6L4.5 5.4C3.9 5 3 5.4 3 6.2zm9.5 0v11.6c0 .8.9 1.2 1.5.8l7.5-5.8c.5-.4.5-1.2 0-1.6L14 5.4c-.6-.4-1.5 0-1.5.8z',
    close: 'M6 6l12 12M18 6L6 18',
    trash: 'M5 7h14M10 4h4M7 7l1 13h8l1-13',
    up: 'M12 19V6M6 11l6-6 6 6',
    target: 'M12 3v4M12 17v4M3 12h4M17 12h4M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
    lock: 'M7 11V8a5 5 0 0 1 10 0v3M5.5 11h13v9.5h-13z',
  };
  p.setAttribute('d', D[kind]);
  if (kind === 'wave' || kind === 'close' || kind === 'trash' || kind === 'up' || kind === 'target' || kind === 'lock') {
    p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'currentColor'); p.setAttribute('stroke-width', '2.6');
    p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round');
  } else p.setAttribute('fill', 'currentColor');
  s.append(p);
  return s;
}
export { svgIcon };
const cost = (n, cls = 'gr-cost') => el('span', cls, svgIcon('bolt', 'gr-ico gr-bolt'), el('b', null, String(n)));

// the numbers a guardrail's card shows, and what the next level changes
function statRows(type, tier, spec, nextTier, nextSpec) {
  const cur = statsOf(type, tier, spec);
  const nxt = nextTier ? statsOf(type, nextTier, nextSpec) : null;
  const rows = [];
  const add = (label, key, fmt = (v) => String(v), better = 'up') => {
    if (cur[key] == null && (!nxt || nxt[key] == null)) return;
    const a = cur[key] ?? 0, b = nxt ? nxt[key] ?? 0 : null;
    const changed = b != null && Math.abs(b - a) > 1e-9;
    const gain = changed && (better === 'up' ? b > a : b < a);
    rows.push({ label, now: fmt(a), next: changed ? fmt(b) : null, gain });
  };
  const per = (v) => `${(1 / v).toFixed(v < 0.2 ? 1 : 2).replace(/0$/, '')}/s`;
  switch (type) {
    case 'filter': add('Damage', 'dmg', (v) => `${v}`); add('Speed', 'rate', per, 'down'); add('Range', 'range', (v) => v.toFixed(1)); break;
    case 'classifier': add('Slow', 'slow', (v) => `${Math.round(v * 100)}%`); add('Range', 'range', (v) => v.toFixed(1)); add('Reveal', 'reveal', (v) => v.toFixed(1)); break;
    case 'redteam': add('Damage', 'dmg', (v) => `${v}`); add('Splash', 'splash', (v) => v.toFixed(2)); add('Range', 'range', (v) => v.toFixed(1)); break;
    case 'limiter': add('Stun', 'stun', (v) => `${v}s`); add('Every', 'period', (v) => `${v}s`, 'down'); add('Range', 'range', (v) => v.toFixed(1)); break;
    case 'honeypot': add('Toughness', 'hp', (v) => `${v}`); add('Argue', 'argue', (v) => `${v}s`); add('Trap', 'trap', (v) => (v ? `${v}/s` : '–')); break;
    case 'sysprompt': add('Damage', 'dmg', (v) => `${v}`); add('Charge', 'rate', (v) => `${v}s`, 'down'); add('Range', 'range', (v) => v.toFixed(1)); break;
    default:
  }
  return rows;
}

export function createUI({ stage, touch, handlers }) {
  const H = handlers;
  let openedAt = 0;
  const root = el('div', { class: 'gr-ui' });
  // ---------- the tray ----------
  const tray = el('div', { class: 'gr-tray', role: 'toolbar', 'aria-label': 'Guardrails' });
  const trayBtns = {};
  TOWER_ORDER.forEach((type, i) => {
    const T = TOWERS[type];
    const b = el('button', { class: 'gr-tb', type: 'button', 'data-type': type, 'aria-label': `${T.short}: ${buildCost(type)} compute. ${T.blurb}` },
      el('span', 'gr-tb-key', String(i + 1)),
      el('img', { class: 'gr-tb-img', src: towerIcon(type, 0, 64), alt: '', width: 40, height: 40, draggable: 'false' }),
      el('span', 'gr-tb-name', T.short),
      cost(buildCost(type), 'gr-cost gr-tb-cost'),
      el('span', 'gr-tb-need'));
    // a tap arms it; a drag carries it onto the map
    let down = null;
    b.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      down = { id: e.pointerId, x: e.clientX, y: e.clientY, drag: false };
      try { b.setPointerCapture(e.pointerId); } catch { /* fine */ }
    });
    b.addEventListener('pointermove', (e) => {
      if (!down || e.pointerId !== down.id) return;
      if (!down.drag && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10) { down.drag = true; H.dragStart(type, e); }
      if (down.drag) H.dragMove(type, e);
    });
    const end = (e, cancel) => {
      if (!down || e.pointerId !== down.id) return;
      const was = down;
      down = null;
      if (was.drag) H.dragEnd(type, e, cancel);
    };
    b.addEventListener('pointerup', (e) => end(e, false));
    b.addEventListener('pointercancel', (e) => end(e, true));
    b.addEventListener('click', (e) => { if (e.detail === 0 || !b.dataset.dragged) H.arm(type); delete b.dataset.dragged; });
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    trayBtns[type] = b;
    tray.append(b);
  });

  // ---------- the next wave, Send, speed ----------
  const nextLabel = el('span', 'gr-next-label', 'Next');
  const nextList = el('span', 'gr-next-list');
  const next = el('div', { class: 'gr-next', 'aria-live': 'off' }, nextLabel, nextList);
  const sendText = el('span', 'gr-send-text', 'Start');
  const sendBonus = el('span', 'gr-send-bonus');
  const send = el('button', { class: 'gr-send', type: 'button' }, svgIcon('play', 'gr-ico gr-send-ico'), sendText, sendBonus);
  send.addEventListener('click', () => H.send());
  const speed = el('button', { class: 'gr-speed', type: 'button', 'aria-label': 'Speed: normal. Make it double speed' }, svgIcon('ff', 'gr-ico'), el('b', null, '1×'));
  speed.addEventListener('click', () => H.speed());
  const strip = el('div', { class: 'gr-strip' }, next, el('div', 'gr-strip-btns', send, speed));

  // ---------- the radial menu ----------
  const radial = el('div', { class: 'gr-radial', hidden: true, role: 'menu', 'aria-label': 'Build a guardrail here' });
  // ---------- a guardrail's card ----------
  const card = el('div', { class: 'gr-card', hidden: true, role: 'dialog', 'aria-label': 'Guardrail' });

  root.append(strip, tray, radial, card);
  stage.append(root);

  const api = {
    root, tray, strip, radial, card,
    layout: 'tall',
    setLayout(name) { api.layout = name; root.dataset.layout = name; },
    // the tray's buttons: what's affordable, what's armed
    setCompute(n, armed) {
      for (const type of TOWER_ORDER) {
        const b = trayBtns[type], c = buildCost(type);
        const poor = n < c;
        b.classList.toggle('is-poor', poor);
        b.classList.toggle('is-armed', armed === type);
        b.setAttribute('aria-pressed', String(armed === type));
        b.lastChild.textContent = poor ? `−${c - n}` : '';
      }
    },
    trayButton: (type) => trayBtns[type],
    markDragged(type) { trayBtns[type].dataset.dragged = '1'; },
    // the next wave: [{ kind, n, boss, isNew }], its number, can it be sent, its early bonus, the countdown 0..1
    setNext({ list, wave, canSend, bonus, first, k, inWave }) {
      nextLabel.textContent = `Wave ${wave}`;
      const key = list.map((x) => `${x.kind}${x.n}${x.isNew ? '!' : ''}`).join(',');
      if (key !== nextList.dataset.key) {
        nextList.dataset.key = key;
        nextList.replaceChildren(...list.slice(0, 4).map((x) => el('span', { class: `gr-ni${x.boss ? ' is-boss' : ''}${x.isNew ? ' is-new' : ''}`, title: CREATURES[x.kind].name },
          el('img', { src: creatureIcon(x.kind, 44), alt: '', width: 26, height: 26, draggable: 'false' }),
          el('b', null, x.boss ? 'BOSS' : `×${x.n}`),
          x.isNew ? el('i', null, 'new') : null)));
        next.setAttribute('aria-label', `Wave ${wave}: ${list.map((x) => `${x.n} ${CREATURES[x.kind].name}`).join(', ')}`);
      }
      send.disabled = !canSend;
      send.classList.toggle('is-first', first);
      send.classList.toggle('is-wait', !canSend);
      sendText.textContent = first ? `Start wave ${wave}` : canSend ? 'Send' : inWave ? 'Incoming' : 'Send';
      sendBonus.replaceChildren(...(canSend && bonus > 0 && !first ? [el('span', null, '+'), svgIcon('bolt', 'gr-ico gr-bolt'), el('b', null, String(bonus))] : []));
      send.setAttribute('aria-label', first ? `Start wave ${wave}` : canSend ? `Send wave ${wave} now${bonus ? `: +${bonus} compute` : ''}` : 'The wave is still coming in');
      send.style.setProperty('--k', String(k ?? 0));
    },
    setSpeed(n) {
      speed.lastChild.textContent = `${n}×`;
      speed.classList.toggle('is-on', n > 1);
      speed.setAttribute('aria-pressed', String(n > 1));
      speed.setAttribute('aria-label', n > 1 ? 'Speed: double. Make it normal speed' : 'Speed: normal. Make it double speed');
    },

    // ---------- the radial menu: options around a tile ----------
    openRadial({ x, y, options, compute, bounds }) {
      openedAt = performance.now();
      const R = options.length === 1 ? 0 : options.length <= 3 ? 64 : 72;
      const B = 58;
      // keep the whole ring on the screen (its centre moves in; the tile stays marked where it is)
      const cx = Math.min(Math.max(x, bounds.left + R + B / 2 + 4), bounds.right - R - B / 2 - 4);
      const cy = Math.min(Math.max(y, bounds.top + R + B / 2 + 4), bounds.bottom - R - B / 2 - 18);
      radial.style.left = `${cx}px`;
      radial.style.top = `${cy}px`;
      const n = options.length;
      radial.replaceChildren(...options.map((type, i) => {
        const a = n === 1 ? -Math.PI / 2 : -Math.PI / 2 + (i / n) * Math.PI * 2;
        const ox = n === 1 ? 0 : Math.cos(a) * R, oy = n === 1 ? -B * 0.95 : Math.sin(a) * R;
        const c = buildCost(type), poor = compute < c, T = TOWERS[type];
        const b = el('button', { class: `gr-rb${poor ? ' is-poor' : ''}`, type: 'button', role: 'menuitem', 'data-type': type,
          'aria-label': poor ? `${T.short}: ${c} compute (need ${c - compute} more)` : `Build ${T.short} for ${c} compute` },
          el('img', { src: towerIcon(type, 0, 64), alt: '', width: 38, height: 38, draggable: 'false' }),
          poor ? el('span', 'gr-cost gr-rb-need', el('b', null, `−${c - compute}`)) : cost(c, 'gr-cost gr-rb-cost'));
        b.style.setProperty('--x', `${ox}px`);
        b.style.setProperty('--y', `${oy}px`);
        b.style.setProperty('--i', String(i));
        // (the tap that opened the menu ends with a click right where the buttons start their pop: not a pick)
        b.addEventListener('click', (e) => { e.stopPropagation(); if (performance.now() - openedAt > 280 || e.detail === 0) H.radialPick(type); });
        b.addEventListener('pointerenter', () => H.radialHover(type));
        b.addEventListener('pointerleave', () => H.radialHover(null));
        b.addEventListener('focus', () => H.radialHover(type));
        b.addEventListener('blur', () => H.radialHover(null));
        return b;
      }), el('span', { class: 'gr-radial-name', 'aria-hidden': 'true' }, n === 1 ? 'Honeypot' : 'Build'));
      radial.hidden = false;
      radial.classList.remove('is-in'); void radial.offsetWidth; radial.classList.add('is-in');
    },
    radialFocus() { radial.querySelector('button')?.focus({ preventScroll: true }); },
    closeRadial() { radial.hidden = true; radial.replaceChildren(); },
    get radialOpen() { return !radial.hidden; },

    // ---------- a guardrail's card ----------
    openCard(t, { compute, place }) {
      api.renderCard(t, compute);
      card.dataset.place = place;
      card.hidden = false;
      tray.classList.add('is-under');
    },
    renderCard(t, compute) {
      const T = TOWERS[t.type];
      const lvl = t.tier < 3 ? t.tier - 1 : 2 + t.spec;
      const name = t.tier === 3 ? T.levels[2 + t.spec].name : T.name;
      const close = el('button', { class: 'gr-card-x', type: 'button', 'aria-label': 'Close' }, svgIcon('close', 'gr-ico'));
      close.addEventListener('click', () => H.closeCard());
      const pips = el('span', { class: 'gr-pips', 'aria-label': `Tier ${t.tier} of 3` }, [1, 2, 3].map((i) => el('i', { class: i <= t.tier ? 'is-on' : '' })));
      const head = el('div', 'gr-card-head',
        el('span', 'gr-card-ico', el('img', { src: towerIcon(t.type, lvl, 64), alt: '', width: 44, height: 44 })),
        el('div', 'gr-card-title', el('b', null, name), el('span', null, pips, el('small', null, t.type === 'honeypot' ? (t.broken ? 'Broken' : `${Math.ceil(t.hp)} / ${t.maxHp}`) : `${t.kills} stopped`))),
        close);
      const body = el('div', 'gr-card-body');
      // what it does now, and what an upgrade would change
      const nextTier = t.tier < 3 ? t.tier + 1 : 0;
      const rows = statRows(t.type, t.tier, t.spec, nextTier === 2 ? 2 : 0, 0);
      body.append(el('dl', 'gr-stats', rows.map((r) => el('div', `gr-stat${r.next ? ' has-next' : ''}`,
        el('dt', null, r.label), el('dd', null, r.now, r.next ? el('span', `gr-next-v${r.gain ? ' is-gain' : ''}`, `→ ${r.next}`) : null)))));
      const actions = el('div', 'gr-card-actions');
      if (t.broken) {
        const c = rebuildCost(t.spent), poor = compute < c;
        const b = el('button', { class: `gr-btn gr-btn-up${poor ? ' is-poor' : ''}`, type: 'button', 'data-key': 'U', 'aria-label': `Rebuild for ${c} compute` },
          svgIcon('up', 'gr-ico'), el('span', null, 'Rebuild'), poor ? el('span', 'gr-cost', el('b', null, `−${c - compute}`)) : cost(c));
        b.addEventListener('click', () => H.rebuild());
        actions.append(b);
      } else if (t.tier === 1) {
        const c = upgradeCost(t.type, 1), poor = compute < c;
        const b = el('button', { class: `gr-btn gr-btn-up${poor ? ' is-poor' : ''}`, type: 'button', 'data-key': 'U', 'aria-label': poor ? `Upgrade: ${c} compute, need ${c - compute} more` : `Upgrade to tier 2 for ${c} compute` },
          svgIcon('up', 'gr-ico'), el('span', null, 'Upgrade'), poor ? el('span', 'gr-cost', el('b', null, `−${c - compute}`)) : cost(c));
        b.addEventListener('click', () => H.upgrade(0));
        b.addEventListener('pointerenter', () => H.previewUp(0));
        b.addEventListener('pointerleave', () => H.previewUp(null));
        b.addEventListener('focus', () => H.previewUp(0));
        b.addEventListener('blur', () => H.previewUp(null));
        actions.append(b);
      } else if (t.tier === 2) {
        actions.append(el('p', 'gr-pick', 'Tier 3: pick one'));
        const pair = el('div', 'gr-specs');
        [0, 1].forEach((sp) => {
          const L = T.levels[2 + sp], c = L.cost, poor = compute < c;
          const b = el('button', { class: `gr-spec${poor ? ' is-poor' : ''}`, type: 'button', 'aria-label': `${L.name}: ${L.blurb} ${c} compute${poor ? `, need ${c - compute} more` : ''}` },
            el('span', 'gr-spec-key', String(sp + 1)),
            el('img', { src: towerIcon(t.type, 2 + sp, 64), alt: '', width: 36, height: 36 }),
            el('b', null, L.name), el('span', 'gr-spec-blurb', L.blurb),
            poor ? el('span', 'gr-cost', el('b', null, `−${c - compute}`)) : cost(c));
          b.addEventListener('click', () => H.upgrade(sp));
          b.addEventListener('pointerenter', () => H.previewUp(sp));
          b.addEventListener('pointerleave', () => H.previewUp(null));
          b.addEventListener('focus', () => H.previewUp(sp));
          b.addEventListener('blur', () => H.previewUp(null));
          pair.append(b);
        });
        actions.append(pair);
      } else {
        actions.append(el('p', 'gr-maxed', el('b', null, 'Maxed'), ` ${T.levels[2 + t.spec].blurb}`));
      }
      // targeting (for the ones that aim)
      let modes = null;
      if (T.aims) {
        modes = el('div', { class: 'gr-modes', role: 'radiogroup', 'aria-label': 'Targets' }, el('span', 'gr-modes-label', svgIcon('target', 'gr-ico'), 'Target'),
          TARGET_MODES.map((m) => {
            const b = el('button', { class: `gr-mode${t.mode === m ? ' is-on' : ''}`, type: 'button', role: 'radio', 'aria-checked': String(t.mode === m) }, TARGET_NAMES[m]);
            b.addEventListener('click', () => H.mode(m));
            return b;
          }));
      }
      const sell = el('button', { class: 'gr-btn gr-btn-sell', type: 'button', 'aria-label': `Remove it: +${H.sellValue()} compute back` },
        svgIcon('trash', 'gr-ico'), el('span', null, 'Remove'), el('span', 'gr-cost', '+', svgIcon('bolt', 'gr-ico gr-bolt'), el('b', null, String(H.sellValue()))));
      sell.addEventListener('click', () => H.sell(sell));
      card.replaceChildren(head, body, actions, el('div', 'gr-card-foot', modes, sell));
    },
    closeCard() { card.hidden = true; card.replaceChildren(); tray.classList.remove('is-under'); },
    get cardOpen() { return !card.hidden; },
  };
  api.setLayout('tall');
  return api;
}
