// AGI Studio (round 3, 2026-10-10, the owner's "Pro tool layout (Recommended)": "controls on the left with picture tiles in
// sections and a sticky Create button with price; gallery of real videos/pictures on the right … small clean text … phones:
// gallery with controls sliding up"). The workspace of a pro creative tool, made for this app (our own look and words):
//   • a computer (960 px and wider): its panel on the left, with its own scroll and a footer that stays (what it costs, what
//     you have, the button); on the right what's made and what to get ideas from (the page's own scroll);
//   • a phone: the panel is a drawer at the bottom that slides up over the gallery. Closed, only its head shows (its title,
//     a line about it and a quick button); its body and footer can't be reached by the keyboard then (inert). A tap on its
//     head, or its arrow, opens and closes it; Escape closes it.
// A page without controls (someone else's influencer) keeps the same shell without its panel (setPanel(false)).
import { h, icon, put, nextId } from '../ui.js';
import { LEVEL_NAMES, num } from '../app-words.js';
import { DISCOUNT } from '../rules.js';

export const PHONE = '(max-width: 959px)';

// workspace(ctx, root, { title, sub, open, titleTag }) → its parts and what it can do
export function workspace(ctx, root, { title, sub = '', open = true, titleTag = 'h2' } = {}) {
  const id = nextId('ws');
  const titleEl = h(titleTag, { class: 'sa-ws-title', id: `${id}-t`, text: title, ...(titleTag === 'h1' ? { tabindex: '-1' } : {}) });
  const subEl = h('p', { class: 'sa-ws-sub', text: sub, hidden: !sub });
  const quick = h('div', { class: 'sa-ws-quick', hidden: true });
  // (round 4, phase 4) a mode switch in the head (an influencer's page: Instant): shown on a computer, and on a phone while the
  // drawer is open (closed, its quick button shows instead)
  const mode = h('div', { class: 'sa-ws-mode', hidden: true });
  const toggle = h('button', { type: 'button', class: 'sa-ws-toggle', 'aria-controls': `${id}-b`, 'aria-expanded': 'true', 'aria-label': `${title}: show the controls` }, icon('up'));
  const head = h('div', { class: 'sa-ws-head' },
    h('span', { class: 'sa-ws-grip', 'aria-hidden': 'true' }),
    h('div', { class: 'sa-ws-titles' }, titleEl, subEl), mode, quick, toggle);
  const body = h('div', { class: 'sa-ws-body', id: `${id}-b` });
  const foot = h('div', { class: 'sa-ws-foot', hidden: true });
  const panel = h('aside', { class: 'sa-ws-panel', 'aria-labelledby': `${id}-t` }, head, body, foot);
  const main = h('div', { class: 'sa-ws-main' });
  const node = h('div', { class: 'sa-ws has-panel' }, panel, main);
  root.append(node);
  root.classList.add('is-ws');

  const mq = matchMedia(PHONE);
  let isOpen = open, hasPanel = true;
  function apply() {
    const phone = mq.matches && hasPanel;
    node.classList.toggle('is-drawer', phone);
    node.classList.toggle('is-open', phone && isOpen);
    const shut = phone && !isOpen;
    toggle.setAttribute('aria-expanded', String(!shut));
    toggle.setAttribute('aria-label', `${titleEl.textContent}: ${shut ? 'show' : 'hide'} the controls`);
    body.inert = shut;
    foot.inert = shut;
    quick.hidden = !shut || !quick.childElementCount;
    mode.hidden = shut || !mode.childElementCount;
  }
  function setOpen(on) {
    isOpen = Boolean(on);
    apply();
  }
  // a phone: the head opens and closes it (its quick button does its own thing)
  head.addEventListener('click', (e) => {
    if (!node.classList.contains('is-drawer') || e.target.closest('.sa-ws-quick') || e.target.closest('.sa-ws-mode')) return;
    setOpen(!isOpen);
  });
  panel.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !node.classList.contains('is-drawer') || !isOpen) return;
    e.stopPropagation();
    setOpen(false);
    toggle.focus();
  });
  ctx.listen(mq, 'change', apply);
  apply();

  return {
    node, panel, head, body, foot, main,
    get isOpen() { return isOpen; },
    get phone() { return mq.matches; },
    open() { setOpen(true); },
    close() { setOpen(false); },
    setTitle(t, s = '') {
      titleEl.textContent = t;
      subEl.textContent = s;
      subEl.hidden = !s;
      apply();
    },
    // the footer that stays: what it costs, what you have, the button (nothing: no footer)
    setFoot(...nodes) {
      put(foot, ...nodes);
      foot.hidden = !foot.childElementCount;
    },
    // (round 4, phase 4) a mode switch in its head (Instant)
    setMode(...nodes) {
      put(mode, ...nodes);
      apply();
    },
    // a phone's quick button, shown while the drawer is closed
    setQuick(...nodes) {
      put(quick, ...nodes);
      apply();
    },
    // with controls, or a page without them (someone else's influencer, one still being made)
    setPanel(on) {
      hasPanel = Boolean(on);
      panel.hidden = !hasPanel;
      node.classList.toggle('has-panel', hasPanel);
      node.classList.toggle('no-panel', !hasPanel);
      apply();
    },
    // something in the panel the person must see (a field to fix): the drawer opens first
    reveal(el, { focus = true } = {}) {
      if (!el) return;
      setOpen(true);
      requestAnimationFrame(() => {
        el.scrollIntoView?.({ block: 'nearest' });
        if (focus) el.focus?.({ preventScroll: true });
      });
    },
  };
}

// The line above a workspace's button: a holder's discount (said, never "buy more"), what you have, and Buy (Connect,
// without a wallet). One per page, updated as the credits change; need: what the next thing costs (Buy suggests enough).
export function costLine(ctx) {
  const off = h('span', { class: 'sa-cost-off', hidden: true });
  const have = h('span', { class: 'sa-cost-have' });
  const buy = h('button', { type: 'button', class: 'sa-cost-buy' });
  const node = h('div', { class: 'sa-cost' }, off, h('span', { class: 'sa-cost-right' }, icon('bolt'), have, buy));
  let need = 0;
  buy.addEventListener('click', async () => {
    if (ctx.session) { ctx.buyCredits({ need }); return; }
    if (await ctx.requireAdult()) ctx.connect();
  });
  function draw() {
    const lvl = ctx.session ? ctx.level : 1;
    const pct = Math.round((DISCOUNT[lvl] || 0) * 100);
    off.hidden = !(pct > 0);
    off.textContent = `${LEVEL_NAMES[lvl] || ''} · ${pct}% off`;
    if (!ctx.session) {
      have.textContent = 'Paid in credits';
      buy.textContent = 'Connect';
      buy.setAttribute('aria-label', 'Connect your wallet');
    } else {
      have.textContent = ctx.me ? `You have ${num(ctx.credits)}` : 'Checking your credits…';
      buy.textContent = 'Buy';
      buy.setAttribute('aria-label', 'Buy credits');
    }
  }
  ctx.on('me', draw);
  ctx.on('wallet', draw);
  draw();
  return { node, need(n) { need = Number(n) || 0; } };
}

// The panel's big button: its words and what it costs on it ([✦ Create   ⚡ 80]); setPrice(null) hides the cost, a string
// ("Free") says it instead of a number
export function goButton(label, iconName = 'spark') {
  const words = h('span', { class: 'sa-go-label', text: label });
  const n = h('span');
  const unit = h('span', { class: 'sa-sr', text: ' credits' });
  const cost = h('span', { class: 'sa-go-cost' }, icon('bolt'), n, unit);
  const node = h('button', { type: 'button', class: 'sa-btn sa-btn-primary sa-btn-lg sa-btn-wide sa-go' }, icon(iconName), words, cost);
  return {
    node,
    setLabel(t) { words.textContent = t; },
    setPrice(p) {
      const isNum = typeof p === 'number';
      cost.hidden = p === null || p === undefined;
      cost.classList.toggle('is-text', !isNum);
      n.textContent = isNum ? num(p) : String(p ?? '');
      unit.hidden = !isNum;
    },
  };
}
