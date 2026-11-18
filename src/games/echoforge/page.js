import '../intro.js';
import { createShell } from '../kit/shell.js';
import { mountRemaster } from '../kit/remaster.js';
import './style.css';
import game from './game.js';

document.getElementById('ak-root').classList.add('duet-stage');
mountRemaster('echoforge', game, options => createShell({ game: 'echoforge', ...options }),
  new URL('./nightclub.webp',import.meta.url).href);
