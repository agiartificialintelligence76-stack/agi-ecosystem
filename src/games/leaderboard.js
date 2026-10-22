// AGI games' leaderboards on agi1.app/games (2026-10-22, the owner: "add a leaderboard (also add leaderboards with names ,
// optional to the game ride em agi also)"; the owner's pick: "Checked runs only"): a box for each game ([data-gm-lb]) with
// its boards (./boards.js), each read from our server (GET /api/wallet?board=<game>:<board>, the same for everyone: the
// CDN keeps it a minute), this browser's own place on the one it shows (game-score-mine, asked only by a browser that has
// played: its random id for the games, ./list.js PLAYER_KEY, never made here), and the player's optional name, both games'
// (./player-name.js). Asked once the section is near the screen. Bragging rights only, no prizes. Everything is set with
// textContent and styled by its classes (the CSP allows no style attributes). src/games/page.js starts it.
import { isGame, PLAYER, PLAYER_KEY } from './list.js';
import { pickerBoards, rowText, rowName, mineText } from './boards.js';
import { NAME_KEY, loadName, saveName } from './player-name.js';
import { CHALLENGES } from './trenchingsimulator/challenges.js';

const API = '/api/wallet';
const RETRY_MS = 20_000;        // a board that didn't come: asked once more after this
const FRESH_MS = 60_000;        // a board shown again within this is the one we have (the CDN's minute)
const $ = (sel, root) => root.querySelector(sel);
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const storage = () => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};
// this browser's random id for the games, if it has played (never made here: looking isn't playing)
const playerOf = () => {
  try {
    const id = storage()?.getItem(PLAYER_KEY);
    return PLAYER.test(id || '') ? id : null;
  } catch {
    return null;
  }
};
// the player's own day (Ride 'Em, AGI!'s daily mod is the date on its player's clock)
const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// GET a board → { ready: true, rows } | { ready: false } | null (our server didn't answer, or answered oddly)
async function readBoard(game, board) {
  try {
    const r = await fetch(`${API}?board=${game}:${board}`);
    const d = r.ok ? await r.json() : null;
    if (d && d.ready === false) return { ready: false };
    if (d && d.ready === true && Array.isArray(d.rows)) return { ready: true, rows: d.rows };
  } catch { /* our server away */ }
  return null;
}
// this browser's own row on a board → the row, null (none), or undefined (couldn't ask)
async function readMine(game, player, board) {
  try {
    const r = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'game-score-mine', game, player, boards: [board] }) });
    const d = r.ok ? await r.json() : null;
    if (!d || d.ok !== true || !Array.isArray(d.rows)) return undefined;
    return d.rows.find((x) => x && x.board === board) || null;
  } catch {
    return undefined;
  }
}

// ---------- one game's box ----------
function mountBox(box) {
  const GAME = box.dataset.gmLb;
  const ui = { pick: $('[data-gm-lb-pick]', box), state: $('[data-gm-lb-state]', box), list: $('[data-gm-lb-list]', box), me: $('[data-gm-lb-me]', box) };
  if (!ui.pick || !ui.state || !ui.list || !ui.me) return null;
  const boards = pickerBoards(GAME, { now: Date.now(), localDay: localDay(), challenges: CHALLENGES });
  for (const b of boards) {
    const o = el('option', '', b.title);
    o.value = b.board;
    ui.pick.append(o);
  }
  const kept = new Map();        // board → { at, res }
  const mine = new Map();        // board → its row (or null)
  const retried = new Set();     // boards asked once more already
  let seq = 0;
  let retry = 0;

  function paintRows(rows) {
    ui.list.replaceChildren(...rows.slice(0, 20).map((r, i) => {
      const li = el('li', 'gm-lb-row');
      li.append(el('span', 'gm-lb-rank', String(Number.isInteger(r.rank) ? r.rank : i + 1)), el('span', 'gm-lb-who', rowName(r.name)),
        el('span', 'gm-lb-num', rowText(GAME, r.detail)));
      return li;
    }));
  }
  function paint(board, res) {
    if (board !== ui.pick.value) return;
    if (!res) {
      ui.list.replaceChildren();
      ui.state.textContent = retried.has(board) ? 'The leaderboard didn\'t load. Try again later.' : 'The leaderboard didn\'t load. It tries again in a moment.';
      return;
    }
    if (!res.ready) {
      ui.list.replaceChildren();
      ui.state.textContent = 'Leaderboards open soon. You can play now.';
      return;
    }
    paintRows(res.rows);
    ui.state.textContent = res.rows.length ? '' : 'No checked runs on this board yet. Yours could be the first.';
  }
  function paintMine(board) {
    if (board !== ui.pick.value) return;
    const row = mine.get(board);
    ui.me.hidden = row === undefined;
    ui.me.textContent = row === undefined ? '' : mineText(GAME, row);
  }
  async function show() {
    const board = ui.pick.value;
    const n = ++seq;
    clearTimeout(retry);
    const have = kept.get(board);
    let res = have && Date.now() - have.at < FRESH_MS ? have.res : undefined;
    if (res === undefined) {
      ui.state.textContent = 'Loading the leaderboard…';
      res = await readBoard(GAME, board);
      if (n !== seq) return;
      if (res) kept.set(board, { at: Date.now(), res });
    }
    paint(board, res);
    if (!res && !retried.has(board)) {
      retried.add(board);
      retry = setTimeout(() => { if (n === seq) show(); }, RETRY_MS);
    }
    // your own place: only once the boards are open, and only for a browser that has played
    const player = res && res.ready ? playerOf() : null;
    if (!player) { ui.me.hidden = true; return; }
    if (!mine.has(board)) {
      const row = await readMine(GAME, player, board);
      if (n !== seq) return;
      if (row !== undefined) mine.set(board, row);
    }
    paintMine(board);
  }
  ui.pick.addEventListener('change', () => { show(); });
  return { game: GAME, show };
}

// ---------- the player's optional name (both games') ----------
function mountName(root) {
  const input = $('[data-gm-lb-name]', root);
  const save = $('[data-gm-lb-save]', root);
  const say = $('[data-gm-lb-name-say]', root);
  if (!input || !save || !say) return;
  input.value = loadName(storage()) || '';
  const keep = () => {
    const r = saveName(storage(), input.value);
    if (!r.ok) {
      say.textContent = 'That name can\'t be used: 1 to 24 letters, numbers, spaces or emoji; no links, addresses, or names that pass for AGI-1, her team or a moderator.';
      return;
    }
    input.value = r.name || '';
    if (!r.saved) say.textContent = 'This browser won\'t keep it (a private window?), so the games can\'t use it.';
    else say.textContent = r.name ? `Saved. Your next ranked runs say “${r.name}”.` : 'No name: your rows say “A player”.';
  };
  save.addEventListener('click', keep);
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    keep();
  });
  // changed in a game in another tab: this field follows
  addEventListener('storage', (e) => {
    if (e.key === null || e.key === NAME_KEY) input.value = loadName(storage()) || '';
  });
}

// the section, if the page has it: each game's box, its first board asked once the section is near the screen
export function startBoards() {
  const root = document.querySelector('[data-gm-lead]');
  if (!root) return;
  mountName(root);
  const boxes = [...root.querySelectorAll('[data-gm-lb]')].filter((box) => isGame(box.dataset.gmLb)).map(mountBox).filter(Boolean);
  if (!boxes.length) return;
  const go = () => { for (const b of boxes) b.show(); };
  if (typeof IntersectionObserver !== 'function') { go(); return; }
  const seen = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    seen.disconnect();
    go();
  }, { rootMargin: '400px 0px' });
  seen.observe(root);
}
