import '../intro.js';
import { createShell } from '../kit/shell.js';
import { mountRemaster } from '../kit/remaster.js';
import game from './game.js';

mountRemaster('prismcourier', game, (options) => createShell({ game: 'prismcourier', ...options }), new URL('./mirror-studio.webp', import.meta.url).href);
