import '../intro.js';
import { createShell } from '../kit/shell.js';
import { mountRemaster } from '../kit/remaster.js';
import game from './game.js';
import './studio.css';
mountRemaster(
  'lanternlake',
  game,
  (options) => createShell({ game: 'lanternlake', ...options }),
  new URL('./studio.webp', import.meta.url).href
);
