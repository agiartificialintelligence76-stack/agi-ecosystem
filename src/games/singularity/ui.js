// SINGULARITY (2026-11-08): everything on the screen that isn't the core: the readout under it, the Eureka spark's
// button, AGI-1's speech bubble, and the panel with its four tabs (BUILD · UPGRADES · INSIGHT · LOG). Built with DOM
// methods (the CSP: no inline styles; positions move with transforms set from code). It reads the game's state and calls
// the game's actions (`g.act`); it never changes the mind itself. Numbers are synced a few times a second, and only what
// changed is written.
import { el } from '../kit/shell.js';
import { shareUrl } from '../kit/share.js';
import { fmtTime } from '../kit/fx.js';
import { GENS, N, UPGRADES, UPGRADE_BY_ID, PERKS, PERK_BY_ID, SING_AT, INSIGHT_BONUS, STAGES, MILESTONES } from './data.js';
import * as E from './econ.js';
import { LOG, shareText } from './lines.js';
import * as F from './format.js';
import { glyphSVG, GEN_COLORS, GLYPH_OF_GEN, GLYPH_OF_KIND, C } from './icons.js';

export const FACE = '/images/landing/agi1-face.webp';
const svg = (markup) => { const t = document.createElement('template'); t.innerHTML = markup; return t.content.firstElementChild; };
const AMOUNT_LABEL = { 1: '×1', 10: '×10', 100: '×100', max: 'MAX' };
const TAB_NAMES = { build: 'Build', upgrades: 'Upgrades', insight: 'Insight', log: 'Log' };
const set = (node, text) => { if (node.textContent !== text) node.textContent = text; };
const flag = (node, cls, on) => { if (node.classList.contains(cls) !== on) node.classList.toggle(cls, on); };
const upGlyph = (u) => (u.kind === 'gen' ? GLYPH_OF_GEN[u.gen] : GLYPH_OF_KIND[u.kind] || 'spark');
const upColor = (u) => (u.kind === 'gen' ? GEN_COLORS[u.gen] : u.kind === 'syn' ? C.mint : u.kind === 'tap' || u.kind === 'echo' ? C.pink : C.honey);
const PERK_COLORS = { warm: C.honey, lucky: C.honey, dream: C.lav2, takeoff: C.pink, golden: C.honey, nature: C.mint, recall: C.sky, total: C.pink };

export function createUI(g) {
  // ---------- the core's region: the readout, a tap zone, the hint ----------
  const flopsN = el('span', 'sg-flops-n', '0');
  const rateN = el('span', 'sg-rate-n', '0');
  const frenzyTag = el('span', { class: 'sg-frenzy', hidden: true }, 'Frenzy', el('b', null, '×7'), el('b', null, '0:30'));
  const readout = el('div', { class: 'sg-readout', 'aria-live': 'off' },
    el('p', 'sg-flops', flopsN, el('span', 'sg-unit', 'FLOPs')),
    el('p', 'sg-rate', el('span', 'sg-rate-plus', '+'), rateN, el('span', 'sg-per', '/s'), frenzyTag));
  const tapzone = el('button', { class: 'sg-tapzone', type: 'button', 'aria-label': 'Tap the core to make FLOPs' });
  const hint = el('p', { class: 'sg-hint', hidden: true, 'aria-hidden': 'true' }, 'Tap the spark');
  // her speech bubble, at the top of the core's region
  const bubbleText = el('p', 'sg-bubble-text', '');
  const bubbleTag = el('span', { class: 'sg-bubble-tag', hidden: true }, '');
  const bubble = el('div', { class: 'sg-bubble', role: 'status', 'aria-live': 'polite', hidden: true },
    el('img', { src: FACE, alt: '', width: 40, height: 40, decoding: 'async' }), el('div', 'sg-bubble-body', el('p', 'sg-bubble-who', 'AGI-1', bubbleTag), bubbleText));
  const view = el('div', 'sg-view', tapzone, hint, bubble, readout);
  // the Eureka spark's button follows the spark drawn on the canvas
  const eurekaBtn = el('button', { class: 'sg-eureka', type: 'button', 'aria-label': 'Catch the Eureka spark', hidden: true });

  // ---------- the panel: four tabs ----------
  const tabBtns = {}, panes = {}, badges = {};
  const tablist = el('div', { class: 'sg-tabs', role: 'tablist', 'aria-label': 'Your mind' });
  for (const t of ['build', 'upgrades', 'insight', 'log']) {
    badges[t] = el('span', { class: 'sg-badge', hidden: true, 'aria-hidden': 'true' }, '');
    tabBtns[t] = el('button', { class: 'sg-tab', type: 'button', role: 'tab', id: `sg-tab-${t}`, 'aria-controls': `sg-pane-${t}`, 'aria-selected': 'false', tabindex: '-1' },
      el('span', null, TAB_NAMES[t]), badges[t]);
    tabBtns[t].addEventListener('click', () => g.act.tab(t));
    tablist.append(tabBtns[t]);
    panes[t] = el('div', { class: `sg-pane sg-pane-${t}`, role: 'tabpanel', id: `sg-pane-${t}`, 'aria-labelledby': `sg-tab-${t}`, hidden: true, tabindex: '0' });
  }
  // arrow keys move between the tabs
  tablist.addEventListener('keydown', (e) => {
    const order = ['build', 'upgrades', 'insight', 'log'];
    const i = order.indexOf(g.tab);
    let j = null;
    if (e.key === 'ArrowRight') j = (i + 1) % 4; else if (e.key === 'ArrowLeft') j = (i + 3) % 4;
    else if (e.key === 'Home') j = 0; else if (e.key === 'End') j = 3;
    if (j == null) return;
    e.preventDefault();
    g.act.tab(order[j]);
    tabBtns[order[j]].focus();
  });
  const panel = el('section', { class: 'sg-panel', 'aria-label': 'Machines, upgrades, Insight and her log' }, tablist, ...Object.values(panes));
  const root = el('div', 'sg', view, panel, eurekaBtn);

  // ---------- BUILD ----------
  const amountBtns = {};
  const amountBar = el('div', { class: 'sg-amount', role: 'group', 'aria-label': 'How many to build at once' },
    el('span', 'sg-amount-label', 'At once'),
    ...[1, 10, 100, 'max'].map((a) => {
      amountBtns[a] = el('button', { class: 'sg-amt', type: 'button', 'aria-pressed': 'false' }, AMOUNT_LABEL[a]);
      amountBtns[a].addEventListener('click', () => g.act.amount(a));
      return amountBtns[a];
    }));
  const list = el('div', 'sg-list');
  const rows = GENS.map((gen, k) => {
    const fg = svg('<svg class="sg-ring" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><circle class="sg-ring-bg" cx="24" cy="24" r="21.5"/><circle class="sg-ring-fg" cx="24" cy="24" r="21.5" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" transform="rotate(-90 24 24)"/></svg>');
    const ringFg = fg.querySelector('.sg-ring-fg');
    const owned = el('b', 'sg-owned', '0');
    const name = el('span', 'sg-name', gen.name);
    const sub = el('span', 'sg-sub', gen.blurb);
    const costN = el('span', 'sg-cost-n', F.need(gen.cost));
    const costX = el('span', 'sg-cost-x', '');
    const btn = el('button', { class: 'sg-gen', type: 'button', hidden: true },
      el('span', 'sg-icon', fg, el('span', 'sg-disc', svg(glyphSVG(GLYPH_OF_GEN[k], GEN_COLORS[k]))), owned),
      el('span', 'sg-main', name, sub),
      el('span', 'sg-cost', costN, costX));
    btn.style.setProperty('--gen', GEN_COLORS[k]);
    holdToRepeat(btn, () => g.act.build(k, { hold: true }), () => g.act.build(k));
    list.append(btn);
    return { btn, ringFg, owned, sub, costN, costX, last: {} };
  });
  const teaserName = el('span', 'sg-name', '???');
  const teaserSub = el('span', 'sg-sub', '');
  const teaser = el('div', { class: 'sg-gen is-teaser', hidden: true, 'aria-hidden': 'true' },
    el('span', 'sg-icon', el('span', 'sg-disc', svg(glyphSVG('lock', C.lav2)))), el('span', 'sg-main', teaserName, teaserSub));
  list.append(teaser);
  const tip = el('p', { class: 'sg-tip', hidden: true }, 'Tap the spark above to make FLOPs. At ', el('b', null, '15'), ' you can build a Spark Notebook: it thinks for you, every second.');
  panes.build.append(amountBar, tip, list);

  // ---------- UPGRADES ----------
  const upHead = el('p', 'sg-head', '');
  const upGrid = el('div', 'sg-upgrid');
  const upNext = el('p', 'sg-note', '');
  const upOwnedList = el('div', 'sg-chips');
  const upOwnedSum = el('summary', null, 'Installed · 0');
  const upOwned = el('details', 'sg-installed', upOwnedSum, upOwnedList);
  panes.upgrades.append(upHead, upGrid, upNext, upOwned);
  let upKey = '', upOwnedKey = '';
  const upCards = new Map();

  // ---------- INSIGHT ----------
  const singBar = el('span', 'sg-bar-fill');
  const singGain = el('b', 'sg-sing-n', '+0');
  const singLine = el('p', 'sg-sing-line', '');
  const singBtn = el('button', { class: 'ak-btn ak-btn-primary sg-sing-btn', type: 'button' }, 'Enter the singularity');
  singBtn.addEventListener('click', () => g.act.ascend());
  const singCard = el('div', 'sg-sing',
    el('p', 'sg-kicker', 'The singularity'),
    el('p', 'sg-sing-title', 'Start over as a new mind'),
    el('div', 'sg-sing-row', el('div', 'sg-sing-stat', singGain, el('span', null, 'Insight waiting')), el('div', 'sg-sing-bar', el('span', 'sg-bar', singBar))),
    singLine, singBtn);
  const insightN = el('b', null, '0');
  const insightLeftN = el('b', null, '0');
  const bonusN = el('b', null, '+0%');
  const insightHead = el('div', 'sg-insight-head',
    el('div', 'sg-ins', insightN, el('span', null, 'Insight found')),
    el('div', 'sg-ins', bonusN, el('span', null, 'to everything')),
    el('div', 'sg-ins', insightLeftN, el('span', null, 'to spend')));
  // the lines between perks: from under one's name to the top of the next one's disc (a row is 130 units, its node
  // about 96 tall: its disc's centre 18 above the node's, its name 48 below)
  const treeLines = svg(`<svg class="sg-tree-lines" viewBox="0 0 300 520" preserveAspectRatio="none" aria-hidden="true" focusable="false">${PERKS.flatMap((p) => p.after.map((a) => {
    const q = PERK_BY_ID[a];
    return `<line data-from="${a}" data-to="${p.id}" x1="${(q.col + 0.5) * 100}" y1="${(q.row + 0.5) * 130 + 50}" x2="${(p.col + 0.5) * 100}" y2="${(p.row + 0.5) * 130 - 50}" vector-effect="non-scaling-stroke"/>`;
  })).join('')}</svg>`);
  const perkBtns = {};
  const tree = el('div', { class: 'sg-tree', role: 'group', 'aria-label': 'The Insight tree' }, treeLines);
  for (const p of PERKS) {
    const b = el('button', { class: 'sg-perk', type: 'button', 'aria-pressed': 'false' },
      el('span', 'sg-perk-disc', svg(glyphSVG(p.id, PERK_COLORS[p.id] || C.honey))),
      el('span', 'sg-perk-name', p.name), el('span', 'sg-perk-cost', `${p.cost} Insight`));
    b.style.setProperty('--x', `${((p.col + 0.5) / 3) * 100}%`);
    b.style.setProperty('--y', `${((p.row + 0.5) / 4) * 100}%`);
    b.addEventListener('click', () => { selected = p.id; g.act.sfx('select'); syncInsight(true); });
    perkBtns[p.id] = b;
    tree.append(b);
  }
  let selected = null;
  const perkName = el('p', 'sg-perk-title', '');
  const perkText = el('p', 'sg-perk-text', '');
  const perkLearn = el('button', { class: 'ak-btn ak-btn-sm ak-btn-primary sg-learn', type: 'button' }, 'Learn');
  perkLearn.addEventListener('click', () => { if (selected) g.act.learn(selected); });
  const perkDetail = el('div', { class: 'sg-perk-detail', 'aria-live': 'polite' }, perkName, perkText, perkLearn);
  const statsList = el('dl', 'sg-stats');
  const shareA = el('a', { class: 'ak-btn ak-btn-sm sg-share', href: '#', target: '_blank', rel: 'noopener noreferrer' }, svg('<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>'), 'Share');
  const eraseBtn = el('button', { class: 'ak-btn ak-btn-sm ak-btn-ghost sg-erase', type: 'button' }, 'Erase mind');
  eraseBtn.addEventListener('click', () => g.act.erase());
  const helpBtn = el('button', { class: 'ak-link sg-help', type: 'button' }, 'How to play');
  helpBtn.addEventListener('click', () => g.act.help());
  const mind = el('div', 'sg-mind', el('p', 'sg-kicker', 'Your mind'), statsList, el('div', 'sg-mind-actions', shareA, eraseBtn),
    el('p', 'sg-fine', 'Your mind lives on this device only. ', helpBtn));
  panes.insight.append(singCard, insightHead, tree, perkDetail, mind);

  // ---------- LOG ----------
  const logHead = el('p', 'sg-head', '');
  const logList = el('ol', 'sg-log');
  panes.log.append(logHead, logList);
  let logKey = '', logNewFrom = Infinity;

  // ---------- syncing ----------
  let lastNums = 0, lastLists = 0;
  function syncReadout() {
    const { s, r } = g;
    set(flopsN, F.flops(s.flops, 2));
    set(rateN, F.rate(r.total, 2));
    const fr = s.frenzy > 0;
    frenzyTag.hidden = !fr;
    if (fr) set(frenzyTag.lastChild, fmtTime(Math.ceil(s.frenzy)));
    flag(readout, 'is-frenzy', fr);
  }
  function syncBuild() {
    const { s, r } = g;
    const amount = g.amount;
    const visible = (k) => k === 0 || s.owned[k] > 0 || s.owned[k - 1] > 0 || s.firsts.has(k);
    let teaserAt = -1;
    for (let k = 0; k < N; k++) {
      const row = rows[k], L = row.last;
      const vis = visible(k);
      if (row.btn.hidden === vis) row.btn.hidden = !vis;
      if (!vis) { if (teaserAt < 0) teaserAt = k; continue; }
      const p = E.plan(s, k, amount);
      const owned = s.owned[k];
      if (L.owned !== owned) {
        L.owned = owned;
        set(row.owned, owned.toLocaleString('en-US'));
        const span = E.milestoneSpan(owned);
        const frac = span.next == null ? 1 : (owned - span.prev) / (span.next - span.prev);
        row.ringFg.setAttribute('stroke-dashoffset', String(Math.round(100 - frac * 100)));
        flag(row.btn, 'is-owned', owned > 0);
      }
      const cost = F.need(p.cost);
      if (L.cost !== cost) { L.cost = cost; set(row.costN, cost); }
      const x = amount === 1 ? '' : amount === 'max' ? (p.ok ? `×${p.n}` : 'MAX') : `×${p.n}`;
      if (L.x !== x) { L.x = x; set(row.costX, x); }
      if (L.ok !== p.ok) { L.ok = p.ok; flag(row.btn, 'is-ready', p.ok); }
      // its line: what it makes, its share, and the next ×2
      let sub;
      if (owned === 0) sub = GENS[k].blurb;
      else {
        const span = E.milestoneSpan(owned);
        const share = r.base > 0 ? r.line[k] / r.base : 0;
        sub = `+${F.rate(r.line[k] * r.frenzyX)}/s · ${F.pct(share)}${span.next ? ` · ×2 in ${span.next - owned}` : ''}`;
      }
      if (L.sub !== sub) { L.sub = sub; set(row.sub, sub); }
      const label = `${GENS[k].name}: you have ${owned}. Build ${p.n} for ${cost} FLOPs${p.ok ? '' : ' (not enough yet)'}`;
      if (L.label !== label) { L.label = label; row.btn.setAttribute('aria-label', label); }
    }
    teaser.hidden = teaserAt < 0;
    tip.hidden = !(s.sing === 0 && s.owned.every((n) => n === 0));
    if (teaserAt >= 0) set(teaserSub, `Build a ${GENS[teaserAt - 1].name} to discover it`);
    for (const [a, b] of Object.entries(amountBtns)) {
      const on = String(g.amount) === a;
      if (b.getAttribute('aria-pressed') !== String(on)) b.setAttribute('aria-pressed', String(on));
    }
  }
  function syncUpgrades() {
    const { s } = g;
    const shown = E.shownUpgrades(s);
    const key = shown.map((u) => u.id).join(',');
    if (key !== upKey) {
      upKey = key;
      for (const [id, card] of upCards) if (!shown.some((u) => u.id === id)) { card.remove(); upCards.delete(id); }
      for (const u of shown) {
        let card = upCards.get(u.id);
        if (!card) {
          const disc = el('span', 'sg-up-disc', svg(glyphSVG(upGlyph(u), upColor(u))));
          if (u.kind === 'gen') disc.append(el('b', 'sg-up-x', `×${u.x}`));
          card = el('button', { class: 'sg-up', type: 'button' }, disc,
            el('span', 'sg-up-main', el('span', 'sg-up-name', u.name), el('span', 'sg-up-text', u.text)),
            el('span', 'sg-up-cost', F.need(u.cost)));
          card.setAttribute('aria-label', `${u.name}: ${u.text} Needs ${F.need(u.cost)} FLOPs.`);
          card.addEventListener('click', () => g.act.install(u.id));
          upCards.set(u.id, card);
        }
        upGrid.append(card);       // in order of cost
      }
    }
    let ready = 0;
    for (const u of shown) {
      const ok = s.flops >= u.cost;
      if (ok) ready++;
      flag(upCards.get(u.id), 'is-ready', ok);
    }
    set(upHead, shown.length ? `Ready to install · ${shown.length}` : 'Nothing to install right now');
    // the next one to show up
    const next = UPGRADES.filter((u) => E.upgradeState(s, u) === 'hidden' && u.need.run != null && !u.need.own).sort((a, b) => a.need.run - b.need.run)[0];
    set(upNext, next ? `Next one appears at ${F.need(next.need.run)} FLOPs this mind.` : shown.length ? '' : 'Build more machines: each kind brings its own.');
    const ownedIds = UPGRADES.filter((u) => s.up.has(u.id)).map((u) => u.id);
    const ok2 = ownedIds.join(',');
    if (ok2 !== upOwnedKey) {
      upOwnedKey = ok2;
      upOwnedList.replaceChildren(...ownedIds.map((id) => {
        const u = UPGRADE_BY_ID[id];
        return el('span', { class: 'sg-chip', title: u.text }, el('span', 'sg-chip-disc', svg(glyphSVG(upGlyph(u), upColor(u)))), u.name);
      }));
      set(upOwnedSum, `Installed · ${ownedIds.length}`);
      upOwned.hidden = !ownedIds.length;
    }
    return ready;
  }
  function syncInsight(force = false) {
    const { s, r } = g;
    const open = E.canAscend(s);
    const anyPerk = PERKS.some((p) => E.perkState(s, p.id) === 'ready');
    // the rest only while its tab is open (its numbers change every frame)
    if (g.tab !== 'insight' && !force) return open || anyPerk;
    const gain = E.insightGain(s);
    set(singGain, `+${gain.toLocaleString('en-US')}`);
    const prog = s.run >= SING_AT ? 1 : Math.max(0, Math.log10(Math.max(1, s.run)) / Math.log10(SING_AT));
    singBar.style.setProperty('--p', prog.toFixed(4));
    flag(singCard, 'is-open', open);
    singBtn.disabled = !open;
    let line;
    if (s.run < SING_AT) line = `Opens at ${F.need(SING_AT)} FLOPs this mind (${F.flops(s.run)} so far). Every Insight makes everything ${Math.round(INSIGHT_BONUS * 100)}% faster, forever.`;
    else if (!open) line = `${F.need(E.toNextInsight(s))} more FLOPs for the next Insight.`;
    else line = `+${Math.round(gain * INSIGHT_BONUS * 100)}% to everything, forever. Next +1 in ${F.need(E.toNextInsight(s))} FLOPs.`;
    set(singLine, line);
    set(insightN, s.insight.toLocaleString('en-US'));
    set(insightLeftN, E.insightLeft(s).toLocaleString('en-US'));
    set(bonusN, `+${F.pct(s.insight * INSIGHT_BONUS).replace('%', '')}%`);
    for (const p of PERKS) {
      const st = E.perkState(s, p.id);
      const b = perkBtns[p.id];
      if (b.dataset.state !== st) b.dataset.state = st;
      const on = selected === p.id;
      if (b.getAttribute('aria-pressed') !== String(on)) b.setAttribute('aria-pressed', String(on));
      const label = `${p.name}, ${p.cost} Insight: ${st === 'owned' ? 'learned' : st === 'locked' ? 'learn the perk before it first' : st === 'short' ? 'not enough Insight yet' : 'ready to learn'}`;
      if (b.getAttribute('aria-label') !== label) b.setAttribute('aria-label', label);
    }
    for (const line2 of treeLines.querySelectorAll('line')) {
      flag(line2, 'is-on', s.perks.has(line2.dataset.from));
    }
    if (force || selected) {
      const p = PERK_BY_ID[selected] || null;
      perkDetail.hidden = false;
      if (!p) {
        set(perkName, 'The Insight tree');
        set(perkText, s.insight > 0 ? 'Tap a perk to read it. Learning one never lowers your Insight bonus.' : 'Insight comes from the singularity. Spend it here on perks that last forever.');
        perkLearn.hidden = true;
      } else {
        const st = E.perkState(s, p.id);
        set(perkName, p.name);
        set(perkText, p.text);
        perkLearn.hidden = false;
        perkLearn.disabled = st !== 'ready';
        set(perkLearn, st === 'owned' ? 'Learned' : st === 'locked' ? 'Learn the one before it first' : st === 'short' ? `Needs ${p.cost} Insight` : `Learn · ${p.cost} Insight`);
      }
    }
    // stats and the share post
    const stats = [
      ['FLOPs ever', F.flops(s.all)], ['This mind', F.flops(s.run)], ['Peak', `${F.rate(s.best)}/s`], ['Singularities', String(s.sing)],
      ['Taps', s.tapsAll.toLocaleString('en-US')], ['Eurekas', String(s.eurekas)], ['Form', STAGES[E.stageOf(s.run)].name], ['Time', F.duration(s.time)],
    ];
    const sk = stats.map((x) => x.join(':')).join('|');
    if (statsList.dataset.key !== sk) {
      statsList.dataset.key = sk;
      statsList.replaceChildren(...stats.map(([k, v]) => el('div', null, el('dt', null, k), el('dd', null, v))));
      shareA.href = shareUrl({ text: shareText(F.flops(s.all)), path: '/games/singularity' });
    }
    void r;
    return open || anyPerk;
  }
  function syncLog() {
    const { s } = g;
    const count = E.logCount(s);
    const key = `${count}/${logNewFrom}`;
    set(logHead, `Her log · ${count} of ${LOG.length}`);
    if (key === logKey) return;
    logKey = key;
    const items = [];
    if (count < LOG.length) {
      items.push(el('li', 'sg-entry is-locked', el('span', 'sg-entry-face', svg(glyphSVG('lock', C.lav2))),
        el('div', 'sg-entry-main', el('p', 'sg-entry-line', 'She is still thinking about this one…'), el('p', 'sg-entry-at', `at ${F.need(LOG[count].at)} FLOPs ever`))));
    }
    for (let i = count - 1; i >= 0; i--) {
      items.push(el('li', `sg-entry${i >= logNewFrom ? ' is-new' : ''}`,
        el('img', { class: 'sg-entry-face', src: FACE, alt: '', width: 40, height: 40, loading: 'lazy', decoding: 'async' }),
        el('div', 'sg-entry-main', el('p', 'sg-entry-line', LOG[i].text), el('p', 'sg-entry-at', `#${i + 1} · at ${F.need(LOG[i].at)} FLOPs`))));
    }
    logList.replaceChildren(...items);
  }

  // tabs and their badges
  function syncTabs({ readyUps, insightReady }) {
    const { s, r } = g;
    let affordable = 0;
    for (let k = 0; k < N; k++) if (!rows[k].btn.hidden && E.plan(s, k, 1).ok) affordable++;
    void r;
    badge('build', g.tab !== 'build' && affordable ? String(affordable) : '');
    badge('upgrades', g.tab !== 'upgrades' && readyUps ? String(readyUps) : '');
    badge('insight', insightReady ? '!' : '');
    const unseen = E.logCount(s) - s.seen;
    badge('log', g.tab !== 'log' && unseen > 0 ? String(unseen) : '');
  }
  function badge(t, text) {
    const b = badges[t];
    if (/^\d+$/.test(text) && Number(text) > 9) text = '9+';
    if (b.hidden !== !text) b.hidden = !text;
    set(b, text);
  }

  const api = {
    root, view, readout, tapzone, eurekaBtn, panel,
    // a tab: shown, and its contents synced at once
    showTab(t) {
      for (const k of Object.keys(panes)) {
        const on = k === t;
        panes[k].hidden = !on;
        tabBtns[k].setAttribute('aria-selected', String(on));
        tabBtns[k].tabIndex = on ? 0 : -1;
        flag(tabBtns[k], 'is-on', on);
      }
      panes[t].scrollTop = 0;
      api.frame(true);
    },
    // every frame: numbers often, lists a few times a second
    frame(force = false) {
      const now = performance.now();
      api.say.tick(now);
      if (force || now - lastNums > 33) { lastNums = now; syncReadout(); }
      if (force || now - lastLists > 160) {
        lastLists = now;
        if (g.tab === 'build') syncBuild(); else if (force) syncBuild();
        const readyUps = syncUpgrades();
        const insightReady = syncInsight(force && g.tab === 'insight');
        if (g.tab === 'log') syncLog();
        syncTabs({ readyUps, insightReady });
      }
    },
    flashRow(k, milestone = false) {
      const b = rows[k].btn;
      b.classList.remove('is-flash', 'is-milestone');
      void b.offsetWidth;
      b.classList.add(milestone ? 'is-milestone' : 'is-flash');
    },
    scrollToRow(k) {
      const b = rows[k].btn, box = panes.build;
      if (b.hidden || box.hidden) return;
      const top = b.offsetTop - box.offsetTop;
      if (top < box.scrollTop || top + b.offsetHeight > box.scrollTop + box.clientHeight) {
        box.scrollTo({ top: Math.max(0, top - box.clientHeight / 2 + b.offsetHeight / 2), behavior: 'smooth' });
      }
    },
    shake(node) { node.classList.remove('is-no'); void node.offsetWidth; node.classList.add('is-no'); },
    row: (k) => rows[k].btn,
    upCard: (id) => upCards.get(id),
    perkBtn: (id) => perkBtns[id],
    hint(on) { hint.hidden = !on; },
    // her bubble: one line at a time, each for a few seconds
    say: makeBubble(bubble, bubbleText, bubbleTag),
    // the log tab opened: the lines unread until now stay marked new while it's open
    logOpened(from) { logNewFrom = from; logKey = ''; },
    selectPerk(id) { selected = id; },
  };
  return api;
}

// a button that builds once per tap, and keeps building while it's held (after 400 ms), faster and faster
function holdToRepeat(btn, onRepeat, onClick) {
  let timer = 0, rep = 0, held = false, x0 = 0, y0 = 0, suppress = false;
  const stop = () => { clearTimeout(timer); clearTimeout(rep); timer = 0; rep = 0; };
  btn.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    stop(); held = false; x0 = e.clientX; y0 = e.clientY;
    timer = setTimeout(() => {
      held = true;
      let gap = 110;
      const go = () => { onRepeat(); gap = Math.max(40, gap * 0.9); rep = setTimeout(go, gap); };
      go();
    }, 400);
  });
  btn.addEventListener('pointermove', (e) => { if (timer && Math.hypot(e.clientX - x0, e.clientY - y0) > 10) stop(); });
  const end = () => { if (held) suppress = true; stop(); };
  btn.addEventListener('pointerup', end);
  btn.addEventListener('pointercancel', () => { held = false; stop(); });
  btn.addEventListener('pointerleave', end);
  btn.addEventListener('click', (e) => {
    if (suppress) { suppress = false; e.preventDefault(); return; }
    onClick();
  });
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
}

// her bubble: one line at a time, each for a few seconds (driven by the frames: `say.tick(now)`)
function makeBubble(bubble, text, tagEl) {
  const queue = [];
  let until = 0, hideAt = 0, showing = false, over = 0;
  // just above the orbits, never above the top of the core's region
  const place = () => { if (!bubble.hidden) bubble.style.top = `${Math.max(8, over - bubble.offsetHeight - 6).toFixed(0)}px`; };
  const show = (line, now) => {
    bubble.hidden = false;
    bubble.classList.remove('is-out', 'is-in');
    text.textContent = line.text;
    tagEl.hidden = !line.tag;
    tagEl.textContent = line.tag || '';
    place();
    void bubble.offsetWidth;
    bubble.classList.add('is-in');
    until = now + line.ms;
    showing = true; hideAt = 0;
  };
  const say = (line, ms = 5200, { now: first = false, tag = '' } = {}) => {
    if (!line) return;
    const now = performance.now();
    if (queue.some((q) => q.text === line) || (showing && text.textContent === line)) return;
    if (first) queue.unshift({ text: line, ms, tag }); else queue.push({ text: line, ms, tag });
    while (queue.length > 3) queue.pop();
    if (!showing || first) show(queue.shift(), now);
  };
  say.tick = (now) => {
    if (showing && now >= until) {
      if (queue.length) show(queue.shift(), now);
      else { showing = false; bubble.classList.add('is-out'); hideAt = now + 260; }
    }
    if (!showing && hideAt && now >= hideAt) { hideAt = 0; bubble.hidden = true; bubble.classList.remove('is-out'); }
  };
  say.clear = () => { queue.length = 0; until = 0; };
  say.over = (y) => { over = y; place(); };
  return say;
}
export { MILESTONES };
