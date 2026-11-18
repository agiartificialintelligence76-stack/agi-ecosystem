import '../intro.js';
import { createShell } from '../kit/shell.js';
import { mountRemaster } from '../kit/remaster.js';
import game, { cancelAimOnEscape } from './game.js';
import './style.css';
const root = document.getElementById('ak-root');
root.classList.add('alibi-room');
addEventListener(
  'keydown',
  (e) => {
    if (e.code === 'Escape' && root.dataset.akState === 'play' && cancelAimOnEscape()) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  },
  { capture: true }
);
mountRemaster(
  'inkveil',
  game,
  (options) => createShell({ game: 'inkveil', ...options }),
  new URL('./alibi-archive.webp', import.meta.url).href
);
