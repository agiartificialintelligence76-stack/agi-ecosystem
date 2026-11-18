import '../intro.js';
import { createShell } from '../kit/shell.js';
import { mountRemaster } from '../kit/remaster.js';
import game from './game.js';

mountRemaster('rookery', game, (options) => createShell({ game: 'rookery', ...options }), new URL('./catnap-desk.webp', import.meta.url).href);
