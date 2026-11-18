import '../intro.js';
import { createShell } from '../kit/shell.js';
import { mountRemaster } from '../kit/remaster.js';
import game from './game.js';

mountRemaster('mothlight', game, (options) => createShell({ game: 'mothlight', ...options }), new URL('./cover.webp', import.meta.url).href);
