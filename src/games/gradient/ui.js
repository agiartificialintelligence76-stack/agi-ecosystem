// GRADIENT DESCENT's own bits of page (2026-11-08), in the arcade's sticker language: the hole's title card as it
// starts, AGI-1's bubble, the map and recentre buttons, and the scorecard between holes. Built with DOM methods and
// textContent (the site's CSP); styles in style.css (gd- classes).
import { el } from '../kit/shell.js';
import { resultOf, vsPar } from './score.js';

const FACE = '/images/landing/agi1-face.webp';
const NS = 'http://www.w3.org/2000/svg';

function svg(paths, { fill = 'none', stroke = 'currentColor', width = 2.4 } = {}) {
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('focusable', 'false');
  for (const d of paths) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    p.setAttribute('fill', fill);
    p.setAttribute('stroke', stroke);
    p.setAttribute('stroke-width', String(width));
    p.setAttribute('stroke-linecap', 'round');
    p.setAttribute('stroke-linejoin', 'round');
    s.append(p);
  }
  return s;
}
// a map: contour rings; recentre: a crosshair on the ball
export const ICONS = {
  map: () => svg(['M12 3.5c4.7 0 8.5 3.8 8.5 8.5s-3.8 8.5-8.5 8.5S3.5 16.7 3.5 12 7.3 3.5 12 3.5z', 'M12 7.4c2.5 0 4.6 2.1 4.6 4.6s-2.1 4.6-4.6 4.6S7.4 14.5 7.4 12 9.5 7.4 12 7.4z', 'M12 11.2a.8.8 0 1 1 0 1.6.8.8 0 0 1 0-1.6z']),
  center: () => svg(['M12 2.8v4M12 17.2v4M2.8 12h4M17.2 12h4', 'M12 8.3a3.7 3.7 0 1 1 0 7.4 3.7 3.7 0 0 1 0-7.4z']),
};

export function createHud(stage) {
  // the hole's title card: kicker (hole · par), its name, its pun
  const kick = el('span', 'gd-banner-kick', '');
  const name = el('b', 'gd-banner-name', '');
  const pun = el('span', 'gd-banner-pun', '');
  const banner = el('div', { class: 'gd-banner', role: 'status', 'aria-live': 'polite' }, kick, name, pun);
  // AGI-1's bubble
  const sayText = el('p', null, '');
  const say = el('div', { class: 'gd-say', role: 'status', 'aria-live': 'polite' }, el('img', { src: FACE, alt: '', width: 40, height: 40 }), el('span', 'ak-sr', 'AGI-1: '), sayText);
  // the hint at the start
  const hint = el('div', { class: 'gd-hint', 'aria-hidden': 'true' }, '');
  // map and recentre
  const mapBtn = el('button', { class: 'gd-tool', type: 'button', 'aria-label': 'Map: see the whole landscape from above', 'aria-pressed': 'false' }, ICONS.map(), el('span', 'gd-tool-label', 'Map'));
  const centerBtn = el('button', { class: 'gd-tool', type: 'button', 'aria-label': 'Recentre the camera on the ball' }, ICONS.center());
  const tools = el('div', 'gd-tools', mapBtn, centerBtn);
  // the result stamp (BIRDIE…)
  const stampWord = el('b', null, '');
  const stampSub = el('span', null, '');
  const stamp = el('div', { class: 'gd-stamp', 'aria-hidden': 'true' }, stampWord, stampSub);
  stage.append(banner, stamp, say, hint, tools);
  return {
    banner, kick, name, pun, say, sayText, hint, tools, mapBtn, centerBtn, stamp, stampWord, stampSub,
    setBanner({ kicker, title, line }) { kick.textContent = kicker; name.textContent = title; pun.textContent = line; },
    setStamp(res, sub) {
      stampWord.textContent = res.name;
      stampSub.textContent = sub;
      stamp.className = `gd-stamp is-${res.tone}`;
    },
  };
}

// the scorecard between holes (and inside the end card): the course's holes, par, strokes, the total
export function scorecard({ holes, scores, current = -1, compact = false }) {
  const head = el('tr', null, el('th', { scope: 'row' }, 'Hole'), holes.map((h, i) => el('th', { scope: 'col', class: i === current ? 'is-now' : null }, String(i + 1))), el('th', { scope: 'col', class: 'gd-sc-tot' }, 'Tot'));
  const parRow = el('tr', 'gd-sc-par', el('th', { scope: 'row' }, 'Par'), holes.map((h) => el('td', null, String(h.par))), el('td', 'gd-sc-tot', String(holes.reduce((s, h) => s + h.par, 0))));
  let tot = 0, parSum = 0;
  const cells = holes.map((h, i) => {
    const s = scores[i];
    if (s == null) return el('td', 'gd-sc-empty', '·');
    tot += s; parSum += h.par;
    const r = resultOf(s, h.par);
    return el('td', { class: `gd-sc-cell is-${r.tone}${i === current ? ' is-now' : ''}`, title: r.name }, String(s));
  });
  const played = scores.filter((s) => s != null).length;
  const youRow = el('tr', 'gd-sc-you', el('th', { scope: 'row' }, 'You'), cells, el('td', 'gd-sc-tot', played ? `${tot}` : '·'));
  const table = el('table', { class: `gd-sc${compact ? ' is-compact' : ''}` }, el('caption', 'ak-sr', 'Scorecard'), el('thead', null, head), el('tbody', null, parRow, youRow));
  const diff = played ? vsPar(tot, parSum) : 'E';
  return { node: el('div', 'gd-sc-wrap', table), total: tot, par: parSum, diff };
}

// the card after each hole: its result, her line, the scorecard so far, Next hole
export function holeCard({ courseName, holeNo, holeCount, def, strokes, line, holes, scores, onNext, onMenu, last }) {
  const res = resultOf(strokes, def.par);
  const sc = scorecard({ holes, scores, current: holeNo - 1, compact: true });
  const next = el('button', { class: 'ak-btn ak-btn-primary ak-btn-play', type: 'button', 'data-ak-first': true }, last ? 'See the card' : 'Next hole');
  next.addEventListener('click', onNext);
  const menu = el('button', { class: 'ak-btn ak-btn-sm ak-btn-ghost', type: 'button' }, 'Quit to menu');
  menu.addEventListener('click', onMenu);
  const node = el('div', 'ak-card gd-card',
    el('p', 'ak-card-kicker', `${courseName} · Hole ${holeNo} of ${holeCount}`),
    el('h2', `ak-card-title gd-card-title is-${res.tone}`, res.name),
    el('p', 'gd-card-sub', `${def.name} · ${strokes} stroke${strokes === 1 ? '' : 's'} · par ${def.par}`),
    el('div', 'ak-say gd-card-say', el('img', { src: FACE, alt: '', width: 46, height: 46 }), el('p', null, el('span', 'ak-sr', 'AGI-1: '), line)),
    sc.node,
    el('p', 'gd-card-total', 'Total ', el('b', null, String(sc.total)), ` · ${sc.diff === 'E' ? 'even par' : `${sc.diff} vs par`}`),
    el('div', 'ak-card-actions', next, menu));
  return { node, res };
}
