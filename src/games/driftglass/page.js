import '../intro.js';
import { createShell } from '../kit/shell.js';
import { mountRemaster } from '../kit/remaster.js';
import game from './game.js';
import './style.css';

document.getElementById('ak-root').classList.add('bandit-radio');
mountRemaster('driftglass', game, (options) => createShell({ game: 'driftglass', ...options }), new URL('./marquee.webp', import.meta.url).href);
