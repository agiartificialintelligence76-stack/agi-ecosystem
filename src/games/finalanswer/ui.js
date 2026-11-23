// FINAL ANSWER: pure DOM studio interface built with DOM APIs and CSS classes (100% strict CSP safe).
// Builds the responsive show stage: AGI-1 Host Desk, Question Plaque with shot-clock bar, 2x2 hexagonal answer lozenges
// with inline live chat poll bars, Lifeline & Floor/Walk Action Dock, Illuminated 15-Rung Ladder rail + mobile peek drawer.
import { el } from '../kit/shell.js';
import { fmt } from '../kit/fx.js';
import {
  LADDER, LETTERS, LIFELINE_META, BASE_SAFE_INDEX,
  CUSTOM_FLOOR_MIN, CUSTOM_FLOOR_MAX,
  currentQuestion, currentRung, guaranteedValue, walkValue, canWalkAway, canSetCustomFloor, blitzMultiplier,
} from './rules.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const FACE = '/images/landing/agi1-face.webp';

function svgEl(tag, attrs = {}, kids = []) {
  const n = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  for (const c of kids) n.append(c);
  return n;
}

function makeIcon(kind) {
  const base = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' };
  if (kind === 'split') {
    return svgEl('svg', base, [
      svgEl('path', { d: 'M4 6h16M4 18h16' }),
      svgEl('path', { d: 'M12 3v18' }),
      svgEl('path', { d: 'M7 10l-3 2 3 2M17 10l3 2-3 2' }),
    ]);
  }
  if (kind === 'chat') {
    return svgEl('svg', base, [
      svgEl('path', { d: 'M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 3v-3H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z' }),
      svgEl('path', { d: 'M8 13v-2M12 13V9M16 13v-4' }),
    ]);
  }
  if (kind === 'agi') {
    return svgEl('svg', base, [
      svgEl('path', { d: 'M12 3l2.2 5.4L20 10.6l-5.8 2.2L12 18.2l-2.2-5.4L4 10.6l5.8-2.2z' }),
    ]);
  }
  if (kind === 'double') {
    return svgEl('svg', base, [
      svgEl('path', { d: 'M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3z' }),
      svgEl('path', { d: 'M9 12l2 2 4-4' }),
    ]);
  }
  if (kind === 'swap') {
    return svgEl('svg', base, [
      svgEl('path', { d: 'M4 8h14l-3-3M20 16H6l3 3' }),
    ]);
  }
  if (kind === 'shield') {
    return svgEl('svg', base, [
      svgEl('path', { d: 'M12 3l7 3v5c0 4.8-3 8.4-7 10-4-1.6-7-5.2-7-10V6l7-3z' }),
    ]);
  }
  if (kind === 'walk') {
    return svgEl('svg', base, [
      svgEl('path', { d: 'M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4' }),
      svgEl('path', { d: 'M14 8l4 4-4 4M18 12H9' }),
    ]);
  }
  if (kind === 'ladder') {
    return svgEl('svg', base, [
      svgEl('path', { d: 'M7 3v18M17 3v18M7 7h10M7 12h10M7 17h10' }),
    ]);
  }
  if (kind === 'lock') {
    return svgEl('svg', base, [
      svgEl('rect', { x: '5', y: '11', width: '14', height: '9', rx: '2' }),
      svgEl('path', { d: 'M8 11V8a4 4 0 0 1 8 0v3' }),
    ]);
  }
  return svgEl('svg', base, [svgEl('circle', { cx: '12', cy: '12', r: '6' })]);
}

export function createUI(stage, handlers) {
  const wrap = el('div', { class: 'fa-shell', hidden: true });

  // ---------- MOBILE LADDER STRIP (visible < 880px) ----------
  const mRung = el('span', 'fa-mstrip-rung', 'Q1 / 15');
  const mFor = el('span', 'fa-mstrip-for', 'FOR 100');
  const mFloor = el('span', 'fa-mstrip-floor', 'FLOOR 0');
  const mPeekBtn = el('button', { class: 'fa-mstrip-btn', type: 'button', 'aria-label': 'Show prize ladder' }, makeIcon('ladder'), el('span', null, 'Ladder'));
  mPeekBtn.addEventListener('click', () => toggleDrawer(true));
  const mStrip = el('div', 'fa-mstrip', mRung, mFor, mFloor, mPeekBtn);

  // ---------- HOST BANNER (AGI-1 portrait + live dialogue + mode/streak pills) ----------
  const hostImg = el('img', { class: 'fa-host-face', src: FACE, alt: '', width: 48, height: 48 });
  const hostAvatar = el('div', 'fa-host-avatar', hostImg);
  const hostText = el('p', 'fa-host-text', 'welcome to the hot seat! 💜');
  const hostBadges = el('div', 'fa-host-badges');
  const feverBadge = el('span', { class: 'fa-pill is-fever', hidden: true }, 'FEVER ×1.5');
  const doubleBadge = el('span', { class: 'fa-pill is-double', hidden: true }, '2× SHIELD');
  const potBadge = el('span', { class: 'fa-pill is-pot', hidden: true }, '+0 BONUS');
  hostBadges.append(feverBadge, doubleBadge, potBadge);
  const hostBar = el('div', 'fa-host', hostAvatar, el('div', 'fa-host-copy', hostText, hostBadges));

  // ---------- QUESTION PLAQUE ----------
  const qStep = el('span', 'fa-q-step', 'QUESTION 1 OF 15');
  const qCat = el('span', 'fa-q-cat', 'SPACE');
  const qPrize = el('span', 'fa-q-prize', 'FOR 100');
  const qClockVal = el('span', 'fa-q-clock-val', '30s');
  const qHead = el('div', 'fa-q-head', qStep, qCat, qPrize, qClockVal);
  const qBody = el('h2', 'fa-q-text', '');
  const qBarFill = el('div', 'fa-q-bar-fill');
  const qBar = el('div', { class: 'fa-q-bar', 'aria-hidden': 'true' }, qBarFill);
  const qPlaque = el('section', { class: 'fa-q', 'aria-live': 'polite' }, qHead, qBody, qBar);

  // ---------- CONTEXTUAL INSIGHT STRIP (Ask Chat stream / Ask AGI-1 clue / Post-answer Fact + Next) ----------
  const insight = el('div', { class: 'fa-insight', hidden: true });
  const insightTag = el('span', 'fa-insight-tag', '');
  const insightText = el('p', 'fa-insight-text', '');
  const insightChat = el('div', { class: 'fa-chat-feed', hidden: true });
  const insightNext = el('button', { class: 'fa-next-btn', type: 'button', hidden: true }, 'NEXT RUNG →');
  insightNext.addEventListener('click', () => handlers.onNext?.());
  const insightTop = el('div', 'fa-insight-top', insightTag, insightNext);
  insight.append(insightTop, insightText, insightChat);

  // ---------- 2x2 ANSWER LOZENGES ----------
  const grid = el('div', { class: 'fa-answers', role: 'group', 'aria-label': 'Answer choices' });
  const optNodes = LETTERS.map((letter, idx) => {
    const badge = el('span', 'fa-opt-letter', letter);
    const label = el('span', 'fa-opt-text', '');
    const tag = el('span', { class: 'fa-opt-tag', hidden: true }, '');
    const pctText = el('span', { class: 'fa-opt-pct', hidden: true }, '');
    const pollBar = el('span', { class: 'fa-opt-poll', 'aria-hidden': 'true' });
    const btn = el('button', {
      class: 'fa-opt',
      type: 'button',
      'data-opt': String(idx),
    }, pollBar, badge, label, pctText, tag);
    btn.addEventListener('click', () => handlers.onOption?.(idx));
    grid.append(btn);
    return { btn, badge, label, tag, pctText, pollBar };
  });

  // ---------- FINAL ANSWER CONFIRMATION BAR ----------
  const confirmBtn = el('button', { class: 'fa-confirm', type: 'button', hidden: true }, 'LOCK FINAL ANSWER');
  confirmBtn.addEventListener('click', () => handlers.onConfirm?.());

  // ---------- LIFELINE & TACTICAL ACTION DOCK ----------
  const dock = el('div', 'fa-dock');
  const lifelineBtns = {};
  for (const id of ['split', 'chat', 'agi', 'double', 'swap']) {
    const meta = LIFELINE_META[id];
    const ico = makeIcon(id);
    const lbl = el('span', 'fa-ll-lbl', meta.short);
    const sub = el('span', { class: 'fa-ll-sub', hidden: true }, '');
    const btn = el('button', {
      class: 'fa-ll',
      type: 'button',
      'data-ll': id,
      'aria-label': `${meta.label}: ${meta.desc}`,
      title: `${meta.label} — ${meta.desc}`,
    }, ico, lbl, sub);
    btn.addEventListener('click', () => handlers.onLifeline?.(id));
    lifelineBtns[id] = { btn, lbl, sub };
    dock.append(btn);
  }

  const floorBtn = el('button', {
    class: 'fa-act fa-act-floor',
    type: 'button',
    hidden: true,
    title: 'Plant your custom 2nd Safety Net on this rung',
  }, makeIcon('shield'), el('span', null, 'Set Floor'));
  floorBtn.addEventListener('click', () => handlers.onSetFloor?.());

  const walkBtn = el('button', {
    class: 'fa-act fa-act-walk',
    type: 'button',
    hidden: true,
    title: 'Walk away and bank your current haul',
  }, makeIcon('walk'), el('span', 'fa-walk-lbl', 'Walk'));
  walkBtn.addEventListener('click', () => handlers.onWalk?.());

  const tacticalRow = el('div', 'fa-tactics', dock, el('div', 'fa-acts', floorBtn, walkBtn));

  // ---------- MAIN STUDIO COLUMN ----------
  const mainCol = el('div', 'fa-main', mStrip, hostBar, qPlaque, insight, grid, confirmBtn, tacticalRow);

  // ---------- ILLUMINATED 15-RUNG LADDER RAIL (Desktop) + DRAWER (Mobile) ----------
  function buildLadderList(forDrawer = false) {
    const rows = [];
    const list = el('ol', 'fa-ladder-list');
    // Top rung 15 (1,000,000) down to rung 1 (100)
    for (let i = LADDER.length - 1; i >= 0; i--) {
      const r = LADDER[i];
      const num = el('span', 'fa-ld-num', String(r.rung));
      const val = el('span', 'fa-ld-val', fmt(r.value));
      const mark = el('span', 'fa-ld-mark', r.baseSafe ? '★' : '');
      const btn = el('button', {
        class: `fa-ld-row${r.baseSafe ? ' is-base' : ''}${i === LADDER.length - 1 ? ' is-top' : ''}`,
        type: 'button',
        'data-rung': String(i),
      }, num, val, mark);
      btn.addEventListener('click', () => {
        handlers.onLadderPick?.(i);
        if (forDrawer) toggleDrawer(false);
      });
      const li = el('li', null, btn);
      list.append(li);
      rows[i] = { btn, mark };
    }
    return { list, rows };
  }

  const railLadder = buildLadderList(false);
  const railTitle = el('p', 'fa-rail-head', 'PRIZE LADDER');
  const railHint = el('p', 'fa-rail-hint', 'Tap Q7–Q14 to set 2nd floor');
  const rail = el('aside', { class: 'fa-rail', 'aria-label': 'Prize ladder' }, railTitle, railLadder.list, railHint);

  // Mobile drawer overlay for peeking/planting custom floor
  const drawerLadder = buildLadderList(true);
  const drawerClose = el('button', { class: 'fa-drawer-close', type: 'button', 'aria-label': 'Close ladder' }, 'Done');
  drawerClose.addEventListener('click', () => toggleDrawer(false));
  const drawerHint = el('p', 'fa-rail-hint', 'Tap Q7–Q14 to set 2nd floor');
  const drawerCard = el('div', 'fa-drawer-card',
    el('div', 'fa-drawer-top', el('p', 'fa-rail-head', 'PRIZE LADDER'), drawerClose),
    drawerHint,
    drawerLadder.list);
  const drawer = el('div', { class: 'fa-drawer', hidden: true }, drawerCard);
  drawer.addEventListener('click', (e) => { if (e.target === drawer) toggleDrawer(false); });

  function toggleDrawer(open) {
    drawer.hidden = !open;
  }

  wrap.append(mainCol, rail, drawer);
  stage.append(wrap);

  // ---------- RENDERING STATE INTO DOM ----------
  function setHost(text, mood = 'idle') {
    hostText.textContent = text || '';
    hostAvatar.dataset.mood = mood;
  }

  function setClock(frac, sec, urgent = false, soft = true) {
    const f = Math.max(0, Math.min(1, frac));
    qBarFill.style.setProperty('--fa-clock', String(f));
    qBar.classList.toggle('is-urgent', urgent);
    qBar.classList.toggle('is-soft', soft);
    if (soft) {
      qClockVal.textContent = sec > 0 ? `+BONUS ${sec}s` : 'NO TIME LIMIT';
    } else {
      qClockVal.textContent = `${sec}s`;
    }
    qClockVal.classList.toggle('is-urgent', urgent);
  }

  function renderLadder(run, ladderObj) {
    const canPlantAny = run.cfg.customFloor && run.customFloorIndex == null && !run.over;
    for (let i = 0; i < LADDER.length; i++) {
      const row = ladderObj.rows[i];
      const cleared = i < run.cleared;
      const current = !run.over && i === run.index;
      const isBase = i === BASE_SAFE_INDEX;
      const isCustom = run.customFloorIndex === i;
      const plantable = canPlantAny && i >= CUSTOM_FLOOR_MIN && i <= CUSTOM_FLOOR_MAX && i >= run.index;

      row.btn.classList.toggle('is-cleared', cleared);
      row.btn.classList.toggle('is-current', current);
      row.btn.classList.toggle('is-custom', isCustom);
      row.btn.classList.toggle('is-locked-safe', (isBase && run.baseSafeReached) || (isCustom && run.customFloorLocked));
      row.btn.classList.toggle('is-plantable', plantable);
      row.btn.disabled = !plantable;

      if (isCustom) row.mark.textContent = run.customFloorLocked ? '🛡️' : '◇';
      else if (isBase) row.mark.textContent = run.baseSafeReached ? '★' : '☆';
      else if (cleared) row.mark.textContent = '✓';
      else if (plantable) row.mark.textContent = '+';
      else row.mark.textContent = '';
    }
  }

  function renderRun(run, phase, revealData = null) {
    const q = currentQuestion(run) || run.deck[run.index];
    const rung = currentRung(run);
    if (!q || !rung) return;

    // Mobile strip
    mRung.textContent = `Q${rung.rung} / 15`;
    mFor.textContent = `FOR ${rung.short}`;
    const floorVal = guaranteedValue(run);
    mFloor.textContent = floorVal > 0 ? `FLOOR ${fmt(floorVal)}` : 'NO FLOOR YET';
    mFloor.classList.toggle('is-safe', floorVal > 0);

    // Host status badges
    feverBadge.hidden = !run.fever;
    if (run.mode === 'blitz') {
      const mult = blitzMultiplier(run.streak);
      feverBadge.hidden = mult <= 1;
      feverBadge.textContent = `STREAK ×${mult}`;
    } else {
      feverBadge.textContent = `FEVER ×1.5`;
    }
    doubleBadge.hidden = !run.doubleActive;
    doubleBadge.textContent = run.doubleFirstMiss != null ? '2ND SHOT!' : '2× SHIELD';
    potBadge.hidden = run.speedPot <= 0;
    potBadge.textContent = `+${fmt(run.speedPot)} BONUS`;

    // Question plaque
    qStep.textContent = `QUESTION ${rung.rung} OF 15`;
    qCat.textContent = q.cat.toUpperCase();
    qPrize.textContent = `FOR ${fmt(rung.value)}`;
    qPlaque.dataset.tier = String(rung.tier);
    qBody.textContent = q.q;

    // Answer lozenges
    const poll = run.chatPoll;
    const interactive = phase === 'ask';
    for (let i = 0; i < 4; i++) {
      const o = optNodes[i];
      const elim = run.eliminated.includes(i);
      const isArmed = phase === 'ask' && run.armed === i;
      const isLocked = phase === 'lock' && run.armed === i;
      const isCorrect = phase === 'reveal' && revealData && i === revealData.correct;
      const isWrong = phase === 'reveal' && revealData && revealData.pick === i && i !== revealData.correct;

      o.label.textContent = q.options[i];
      o.btn.disabled = !interactive || elim;
      o.btn.classList.toggle('is-elim', elim);
      o.btn.classList.toggle('is-armed', isArmed);
      o.btn.classList.toggle('is-locked', isLocked);
      o.btn.classList.toggle('is-correct', Boolean(isCorrect));
      o.btn.classList.toggle('is-wrong', Boolean(isWrong));
      o.btn.classList.toggle('is-agi-pick', Boolean(run.agiAdvice && run.agiAdvice.pick === i && !elim && phase === 'ask'));

      if (isArmed) {
        o.tag.hidden = false;
        o.tag.textContent = 'TAP TO LOCK';
      } else if (isLocked) {
        o.tag.hidden = false;
        o.tag.textContent = 'FINAL ANSWER';
      } else if (isCorrect) {
        o.tag.hidden = false;
        o.tag.textContent = 'CORRECT ✓';
      } else if (isWrong) {
        o.tag.hidden = false;
        o.tag.textContent = 'MISS';
      } else if (run.agiAdvice && run.agiAdvice.pick === i && !elim && phase === 'ask') {
        o.tag.hidden = false;
        o.tag.textContent = `AGI-1 · ${run.agiAdvice.confidence}%`;
      } else {
        o.tag.hidden = true;
      }

      if (poll && !elim) {
        const p = poll.pct[i] || 0;
        o.pctText.hidden = false;
        o.pctText.textContent = `${p}%`;
        o.pollBar.style.setProperty('--fa-poll', `${p}%`);
        o.btn.classList.add('has-poll');
      } else {
        o.pctText.hidden = true;
        o.pollBar.style.setProperty('--fa-poll', '0%');
        o.btn.classList.remove('has-poll');
      }
    }

    // Confirm Final Answer button
    const showConfirm = phase === 'ask' && run.armed != null && !run.eliminated.includes(run.armed);
    confirmBtn.hidden = !showConfirm;
    if (showConfirm) {
      confirmBtn.textContent = `FINAL ANSWER — LOCK ${LETTERS[run.armed]}`;
    }

    // Insight strip (Reveal Fact > Ask AGI-1 > Ask Chat)
    if (phase === 'reveal' && revealData) {
      insight.hidden = false;
      insight.dataset.kind = revealData.result === 'correct' || revealData.result === 'million' ? 'good' : revealData.result === 'walk' ? 'walk' : 'bad';
      insightTag.textContent = revealData.result === 'million'
        ? '1,000,000 CROWN 👑'
        : revealData.result === 'correct'
          ? (revealData.speedBonus > 0 ? `CORRECT · +${fmt(revealData.speedBonus)} SPEED BONUS` : 'CORRECT!')
          : revealData.result === 'walk'
            ? `BANKED ${fmt(revealData.haul)} PTS`
            : revealData.result === 'timeout'
              ? 'TIME UP!'
              : `THE ANSWER WAS ${LETTERS[revealData.correct]}`;
      insightText.textContent = revealData.fact || q.fact;
      insightChat.hidden = true;
      insightNext.hidden = false;
      insightNext.textContent = run.over ? 'SEE RESULTS →' : `NEXT: ${LADDER[run.index + 1]?.short || 'NEXT'} →`;
    } else if (run.agiAdvice && phase === 'ask') {
      insight.hidden = false;
      insight.dataset.kind = 'agi';
      insightTag.textContent = `AGI-1 · ${run.agiAdvice.confidence}% CONFIDENT`;
      insightText.textContent = run.agiAdvice.note;
      insightChat.hidden = true;
      insightNext.hidden = true;
    } else if (run.chatPoll && phase === 'ask') {
      insight.hidden = false;
      insight.dataset.kind = 'chat';
      insightTag.textContent = 'LIVE STUDIO CHAT POLL';
      insightText.textContent = '';
      insightChat.hidden = false;
      insightChat.replaceChildren(...run.chatPoll.messages.map((m) =>
        el('span', 'fa-chat-msg', el('b', null, m.user), ' ', m.text)));
      insightNext.hidden = true;
    } else {
      insight.hidden = true;
    }

    // Lifelines
    for (const [id, item] of Object.entries(lifelineBtns)) {
      const slot = run.lifelines[id];
      const show = slot.available || slot.locked;
      item.btn.hidden = !show;
      item.btn.classList.toggle('is-used', slot.used);
      item.btn.classList.toggle('is-locked', slot.locked);
      item.btn.classList.toggle('is-active', id === 'double' && run.doubleActive);
      item.btn.disabled = !interactive || slot.used || slot.locked || !slot.available;
      if (slot.locked) {
        item.sub.hidden = false;
        item.sub.textContent = 'Q10';
      } else {
        item.sub.hidden = true;
      }
    }

    // Set Floor button (available on Q7–Q14 if custom floor not yet planted)
    const canPlantHere = interactive && canSetCustomFloor(run, run.index);
    floorBtn.hidden = !canPlantHere;
    if (canPlantHere) {
      floorBtn.lastChild.textContent = `Floor ${rung.short}`;
    }

    // Walk Away button
    const canWalk = interactive && canWalkAway(run);
    walkBtn.hidden = !canWalk;
    if (canWalk) {
      walkBtn.lastChild.textContent = `Walk (${fmt(walkValue(run))})`;
    }

    // Ladder hint + rows
    const hintStr = !run.cfg.customFloor
      ? 'High Voltage: 15s clock, no safety floor!'
      : run.customFloorLocked
        ? `Custom floor locked at ${fmt(LADDER[run.customFloorIndex].value)} 🛡️`
        : run.customFloorIndex != null
          ? `Clear Q${run.customFloorIndex + 1} to lock ${fmt(LADDER[run.customFloorIndex].value)} 🛡️`
          : 'Tap Q7–Q14 to set 2nd floor';
    railHint.textContent = hintStr;
    drawerHint.textContent = hintStr;
    renderLadder(run, railLadder);
    renderLadder(run, drawerLadder);
  }

  return {
    node: wrap,
    show(on = true) { wrap.hidden = !on; if (!on) toggleDrawer(false); },
    setHost,
    setClock,
    renderRun,
    toggleDrawer,
    isDrawerOpen: () => !drawer.hidden,
  };
}

export function titleStatsNode(stats) {
  if (!stats || stats.runs === 0) return null;
  return el('div', 'fa-title-stats',
    el('span', 'fa-ts-item', el('b', null, String(stats.runs)), ' shows'),
    el('span', 'fa-ts-item', el('b', null, `${stats.bestRung}/15`), ' top rung'),
    el('span', 'fa-ts-item', el('b', null, String(stats.wins)), ' crowns'),
  );
}
