// Game navigation is deliberately independent of the selected trading terminal's theme.
import { el, icon } from './ui.js';
import { markEl, wordEl } from './brands.js';

export const TERMINAL_GUIDES = Object.freeze({
  board: { label: 'Launch hunter', detail: 'Find fresh launches. Follow the bonding curve.', level: 'Easy to explore', view: 'feed' },
  clank: { label: 'Stock meets meme', detail: 'Explore stock-paired coins on Robinhood Chain.', level: 'Easy to explore', view: 'tiles' },
  social: { label: 'Social trader', detail: 'Follow the feed. Discover what traders are buying.', level: 'Social discovery', view: 'social' },
  pro: { label: 'Fast execution', detail: 'Track three stages of a launch in one workspace.', level: 'Power tools', view: 'columns' },
  scan: { label: 'Market scanner', detail: 'Scan launches, wallets and token activity.', level: 'Power tools', view: 'columns' },
  chat: { label: 'Wallet watcher', detail: 'Discover coins, track wallets and manage orders.', level: 'Power tools', view: 'rows' },
});
export const MENU_TERMINAL_ORDER = Object.freeze(['board', 'clank', 'social', 'pro', 'scan', 'chat']);

export function gameLogo({ compact = false } = {}) {
  return el('span', { class: ['tsm-logo', compact && 'is-compact'] },
    el('img', { src: '/games/trenchingsimulator/mark.svg', width: 36, height: 36, alt: '' }),
    el('span', {}, el('b', { text: 'TRENCHING' }), el('small', { text: 'SIMULATOR' })));
}

export function menuHeader({ back, onHome, onTerminals, onReplays, active = 'home' }) {
  const link = (text, on, selected) => el('button', { type: 'button', class: ['tsm-nav-link', selected && 'is-active'],
    'aria-current': selected ? 'page' : null, on: { click: on } }, text);
  return el('header', { class: 'tsm-header' },
    el('button', { type: 'button', class: 'tsm-brand-button', 'aria-label': 'Trenching Simulator home', on: { click: onHome } }, gameLogo()),
    el('nav', { class: 'tsm-nav', 'aria-label': 'Game navigation' }, link('Overview', onHome, active === 'home'),
      link('Terminals', onTerminals, active === 'terminals'), link('Replays', onReplays, false)),
    back || el('a', { class: 'tsm-all-games', href: '/games' }, icon('back'), 'All games'));
}

export function terminalPreview(id) {
  const guide = TERMINAL_GUIDES[id];
  const row = (i) => el('span', { class: 'tsm-mini-row' }, el('i', { class: `tsm-mini-token token-${i % 4}` }),
    el('span', { class: 'tsm-mini-lines' }, el('i'), el('i')), el('i', { class: 'tsm-mini-value' }));
  const columns = guide.view === 'columns' || guide.view === 'feed';
  return el('div', { class: ['tsm-preview', `is-${guide.view}`], 'aria-hidden': 'true' },
    el('div', { class: 'tsm-mini-top' }, markEl(id), el('i'), el('i'), el('span'), el('b')),
    el('div', { class: 'tsm-mini-body' }, columns
      ? [0, 1, 2].map((c) => el('div', { class: 'tsm-mini-column' }, el('b'), [0, 1, 2].map((i) => row(i + c))))
      : guide.view === 'tiles' ? [0, 1, 2, 3].map((i) => el('div', { class: `tsm-mini-tile token-${i}` }, el('i'), el('b'), el('span')))
        : [0, 1, 2, 3].map(row)));
}

export function terminalTile(t, { selected, onSelect }) {
  const guide = TERMINAL_GUIDES[t.id];
  return el('button', { type: 'button', class: ['tsm-terminal', selected && 'is-selected'], data: { terminal: t.id },
    'aria-label': `Play on ${t.name}`, on: { click: () => onSelect(t.id) } },
    terminalPreview(t.id),
    el('span', { class: 'tsm-terminal-body' },
      el('span', { class: 'tsm-terminal-heading' }, el('span', { class: 'tsm-terminal-name' }, markEl(t.id), wordEl(t.id)),
        selected ? el('span', { class: 'tsm-selected' }, icon('check'), 'Selected') : icon('back', 'ts-icon tsm-forward')),
      el('strong', { text: guide.label }), el('span', { class: 'tsm-terminal-description', text: guide.detail }),
      el('span', { class: 'tsm-terminal-tag', text: guide.level })));
}

export function marketIllustration() {
  // Static artwork: never runs a hidden market, timers or animation loops on the menu.
  const candles = [[47,17],[46,24],[52,12],[44,23],[38,28],[44,15],[48,18],[40,18],[33,25],[28,22],[35,21],[40,16],
    [32,24],[24,26],[19,20],[23,16],[27,22],[18,26],[12,25],[16,19],[11,21],[6,22],[10,17],[4,22]];
  return el('div', { class: 'tsm-market-art', 'aria-hidden': 'true' },
    el('div', { class: 'tsm-art-top' }, el('span', {}, el('i', { class: 'tsm-status-dot' }), 'PRACTICE MARKET'), el('span', { text: '01 / 06' })),
    el('div', { class: 'tsm-art-caption' }, el('span', { text: 'THE NEXT RUNNER' }), el('strong', { text: 'Find your edge.' })),
    el('div', { class: 'tsm-art-chart' }, candles.map(([top, height], i) => el('i', { class: ['tsm-candle', [2,5,6,10,11,15,16,19,22].includes(i) && 'is-red'],
      vars: { '--top': `${top}%`, '--height': `${height}%` } }))),
    el('div', { class: 'tsm-art-floor' }, el('span', { text: 'SPOT THE LAUNCH' }), el('span', { text: 'MAKE YOUR MOVE ↗' })),
    el('div', { class: 'tsm-art-badge' }, icon('bolt'), el('span', {}, el('b', { text: 'Real practice.' }), el('small', { text: 'Zero money at risk.' }))));
}

export function modeTile({ title, description, meta, icon: glyph, on, featured = false }) {
  return el('button', { type: 'button', class: ['tsm-mode', featured && 'is-featured'], on: { click: on } },
    el('span', { class: 'tsm-mode-icon' }, icon(glyph)), el('span', { class: 'tsm-mode-copy' },
      el('b', { text: title }), el('span', { text: description }), el('small', { text: meta })), icon('back', 'ts-icon tsm-forward'));
}
