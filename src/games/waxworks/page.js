import '../intro.js';
import { createShell } from '../kit/shell.js';
import { mountRemaster } from '../kit/remaster.js';
import game from './game.js';
import './style.css';
document.getElementById('ak-root').classList.add('post-floor');
mountRemaster(
  'waxworks',
  game,
  (options) => createShell({ game: 'waxworks', ...options }),
  new URL('./package.webp', import.meta.url).href
);
