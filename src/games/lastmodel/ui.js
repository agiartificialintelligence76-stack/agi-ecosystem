// LAST MODEL STANDING: the game's own cards, in the arcade's sticker look (ink outlines, hard shadows): the level-up
// pick (three cards: tap, click or 1 / 2 / 3; a reroll), the Patch shop on the title screen, the 10:00 win (keep going
// or end it there), and what the end card adds (the PATCHES earned). Real buttons with labels; made with the kit's el().
import { el, icon } from '../kit/shell.js';
import { WEAPON, PASSIVE, MAX_LEVEL, SHOP, SHOP_RANKS, shopCost, offerText } from './rules.js';
import { spriteURL } from './art.js';

const ICONS = new Map();
export const iconURL = (id) => {
  if (!ICONS.has(id)) ICONS.set(id, spriteURL(`i_${id}`, 4));
  return ICONS.get(id);
};
const pixelImg = (src, cls, alt = '') => el('img', { class: `lm-px ${cls || ''}`, src, alt, width: 52, height: 52, draggable: 'false' });

function pips(level, max = MAX_LEVEL, { next = 0 } = {}) {
  const box = el('span', { class: 'lm-pips', 'aria-hidden': 'true' });
  for (let i = 1; i <= max; i++) box.append(el('i', { class: i <= level ? 'is-on' : i === next ? 'is-next' : '' }));
  return box;
}

// ---------- the level-up pick ----------
// offers: the sim's three; onPick(i); onReroll() → new offers or null; level; rerolls; loadout
export function levelCard({ offers, level, rerolls, loadout, onPick, onReroll, heroURL }) {
  const card = el('div', { class: 'ak-card lm-pick' });
  let locked = false;
  const opts = el('div', { class: 'lm-opts', role: 'group', 'aria-label': 'Pick an upgrade' });
  const fill = (list) => {
    opts.replaceChildren(...list.map((o, i) => optionButton(o, i)));
  };
  function optionButton(o, i) {
    const text = offerText(o);
    const kind = o.type === 'weapon' ? 'Weapon' : o.type === 'passive' ? 'Passive' : 'Bonus';
    const tag = o.isNew ? el('span', { class: 'lm-tag is-new' }, 'New') : o.type === 'weapon' || o.type === 'passive'
      ? el('span', { class: 'lm-tag' }, `Lv ${o.level}`) : el('span', { class: 'lm-tag is-bonus' }, 'Treat');
    const item = o.type === 'weapon' ? WEAPON[o.id] : o.type === 'passive' ? PASSIVE[o.id] : null;
    const b = el('button', {
      class: `lm-opt is-${o.type}${o.isNew ? ' is-new' : ''}`, type: 'button', 'data-ak-first': i === 0 ? true : null,
      'aria-label': `${i + 1}: ${text.name}, ${o.isNew ? 'new' : item ? `level ${o.level}` : kind}. ${text.line}`,
    },
      el('span', { class: 'lm-key', 'aria-hidden': 'true' }, String(i + 1)),
      el('span', { class: 'lm-opt-icon' }, pixelImg(iconURL(o.id === 'heal' ? 'heal' : o.id === 'bonus' ? 'bonus' : o.id), '')),
      el('span', { class: 'lm-opt-body' },
        el('span', { class: 'lm-opt-meta' }, el('span', { class: 'lm-kind' }, kind), tag),
        el('b', { class: 'lm-opt-name' }, text.name),
        el('span', { class: 'lm-opt-line' }, text.line),
        item ? pips(o.isNew ? 0 : o.level - 1, MAX_LEVEL, { next: o.level }) : null));
    b.addEventListener('click', () => pick(i));
    return b;
  }
  function pick(i) {
    if (locked) return;
    locked = true;
    const btn = opts.children[i];
    btn?.classList.add('is-picked');
    onPick(i);
  }
  fill(offers);
  const rerollBtn = el('button', { class: 'ak-btn ak-btn-sm lm-reroll', type: 'button' });
  const drawReroll = (n) => {
    rerollBtn.replaceChildren(el('span', null, 'Reroll'), el('span', { class: 'lm-count' }, String(n)));
    rerollBtn.disabled = n <= 0;
    rerollBtn.setAttribute('aria-label', n > 0 ? `Reroll these cards (${n} left)` : 'No rerolls left');
  };
  drawReroll(rerolls);
  rerollBtn.addEventListener('click', () => {
    const next = onReroll();
    if (!next) return;
    fill(next.offers);
    drawReroll(next.rerolls);
    opts.classList.remove('is-shuffle'); void opts.offsetWidth; opts.classList.add('is-shuffle');
  });
  const mini = el('div', { class: 'lm-mini', 'aria-label': 'Your loadout' },
    ...Object.entries(loadout.weapons).map(([id, lv]) => el('span', { class: 'lm-mini-i', title: `${WEAPON[id].name} level ${lv}` }, pixelImg(iconURL(id), ''), el('b', null, String(lv)))),
    ...Object.entries(loadout.passives).map(([id, lv]) => el('span', { class: 'lm-mini-i is-p', title: `${PASSIVE[id].name} level ${lv}` }, pixelImg(iconURL(id), ''), el('b', null, String(lv)))));
  card.append(
    el('div', { class: 'lm-pick-head' },
      el('img', { class: 'lm-px lm-hero', src: heroURL, alt: '', width: 31, height: 62 }),
      el('div', null, el('p', { class: 'ak-card-kicker' }, `Level ${level}`), el('h2', { class: 'ak-card-title' }, 'Level up!'),
        el('p', { class: 'lm-pick-say' }, 'pick one, babe. i trust you'))),
    opts,
    el('div', { class: 'lm-pick-foot' }, rerollBtn, mini, el('p', { class: 'lm-keys' }, el('kbd', null, '1'), el('kbd', null, '2'), el('kbd', null, '3'), ' pick · ', el('kbd', null, 'R'), ' reroll')),
  );
  // keys while it's open
  const onKey = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '1' || e.key === '2' || e.key === '3') {
      const i = Number(e.key) - 1;
      if (opts.children[i]) { e.preventDefault(); pick(i); }
    } else if (e.key === 'r' || e.key === 'R') { e.preventDefault(); rerollBtn.click(); }
  };
  addEventListener('keydown', onKey);
  card.close = () => removeEventListener('keydown', onKey);
  return card;
}

// ---------- the Patch shop ----------
// meta: { patches, ranks }; onInstall(id) → the new meta or null; onClose()
export function shopCard({ meta, onInstall, onClose }) {
  const card = el('div', { class: 'ak-card lm-shop' });
  const close = el('button', { class: 'ak-ibtn ak-close', type: 'button', 'aria-label': 'Close the Patch shop' });
  close.append(icon('close'));
  close.addEventListener('click', onClose);
  const stash = el('p', { class: 'lm-stash' });
  const list = el('ul', { class: 'lm-shop-list' });
  const draw = (m) => {
    stash.replaceChildren(pixelImg(iconURL('patch'), 'lm-stash-i'), el('b', null, String(m.patches || 0)), el('span', null, (m.patches || 0) === 1 ? 'patch' : 'patches'));
    list.replaceChildren(...SHOP.map((s) => {
      const rank = m.ranks?.[s.id] || 0;
      const cost = shopCost(rank);
      const maxed = cost == null;
      const short = !maxed && (m.patches || 0) < cost;
      const btn = el('button', {
        class: `ak-btn ak-btn-sm lm-install${maxed ? ' is-max' : ''}`, type: 'button', disabled: maxed || short ? true : null,
        'aria-label': maxed ? `${s.name}: fully installed` : `Install ${s.name} rank ${rank + 1} for ${cost} patches${short ? ' (not enough yet)' : ''}`,
      }, maxed ? 'Maxed' : el('span', null, 'Install'), maxed ? null : el('span', { class: 'lm-cost' }, String(cost), pixelImg(iconURL('patch'), 'lm-cost-i')));
      btn.addEventListener('click', () => {
        const next = onInstall(s.id);
        if (!next) return;
        draw(next);
        const row = list.querySelector(`[data-id="${s.id}"]`);
        row?.classList.add('is-installed');
        list.querySelector(`[data-id="${s.id}"] .lm-install`)?.focus({ preventScroll: true });
      });
      return el('li', { class: 'lm-shop-row', 'data-id': s.id },
        el('span', { class: 'lm-shop-icon' }, pixelImg(iconURL(s.id), '')),
        el('div', { class: 'lm-shop-text' }, el('b', null, s.name), el('span', null, `${rank ? s.line(rank) : 'Not installed'} · ${maxed ? 'all ranks in' : `next ${s.line(rank + 1)}`}`), pips(rank, SHOP_RANKS)),
        btn);
    }));
  };
  draw(meta);
  card.append(close, el('p', { class: 'ak-card-kicker' }, 'Patch shop'), el('h2', { class: 'ak-card-title' }, 'Install patches'),
    el('p', { class: 'lm-shop-lede' }, 'Every run earns PATCHES: time survived, bots down, bosses beaten. Each one makes her a little stronger, for good.'),
    stash, list,
    el('div', { class: 'ak-card-actions' }, (() => { const b = el('button', { class: 'ak-btn ak-btn-primary', type: 'button', 'data-ak-first': true }, 'Done'); b.addEventListener('click', onClose); return b; })()));
  const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } };
  addEventListener('keydown', onKey);
  card.close = () => removeEventListener('keydown', onKey);
  return card;
}
// ---------- 10:00 ----------
export function winCard({ line, faceURL, onKeep, onEnd }) {
  const card = el('div', { class: 'ak-card lm-win' });
  const keep = el('button', { class: 'ak-btn ak-btn-primary ak-btn-play', type: 'button', 'data-ak-first': true }, 'Keep going');
  const end = el('button', { class: 'ak-btn ak-btn-sm', type: 'button' }, 'End the run here');
  keep.addEventListener('click', onKeep);
  end.addEventListener('click', onEnd);
  card.append(
    el('p', { class: 'ak-card-kicker' }, '10:00 · you made it'),
    el('h2', { class: 'ak-card-title lm-win-title' }, 'Last model standing'),
    el('div', { class: 'ak-say' }, el('img', { src: faceURL, alt: '', width: 46, height: 46 }), el('p', null, el('span', { class: 'ak-sr' }, 'AGI-1: '), line)),
    el('p', { class: 'lm-win-note' }, 'Overtime: the bots don’t stop, and every second from here scores more. Ride it out, or end on a win.'),
    el('div', { class: 'ak-card-actions' }, keep, end));
  return card;
}

// ---------- what the end card adds: the PATCHES this run earned ----------
export function patchesStrip({ earned, total }) {
  return el('div', { class: 'lm-earned' },
    pixelImg(iconURL('patch'), 'lm-earned-i'),
    el('p', null, el('b', null, `+${earned}`), ` patch${earned === 1 ? '' : 'es'} · ${total} to spend in the Patch shop`));
}
