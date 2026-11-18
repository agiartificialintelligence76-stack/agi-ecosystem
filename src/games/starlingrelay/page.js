import '../intro.js';
import { createShell } from '../kit/shell.js';
import { mountRemaster } from '../kit/remaster.js';
import game from './game.js';
import './style.css';
document.getElementById('ak-root').classList.add('call-stage');
mountRemaster(
  'starlingrelay',
  game,
  (options) => createShell({ game: 'starlingrelay', ...options }),
  new URL('./cover.webp', import.meta.url).href
);
