import '../intro.js';
import { createShell } from '../kit/shell.js';
import { mountRemaster } from '../kit/remaster.js';
import game from './game.js';

mountRemaster('returnaddress', game, (options) => createShell({ game: 'returnaddress', ...options }), new URL('./disco.webp', import.meta.url).href);
