import '../intro.js';
import { createShell } from '../kit/shell.js';
import { mountRemaster } from '../kit/remaster.js';
import game from './game.js';

mountRemaster('pocketgrove', game, (options) => createShell({ game: 'pocketgrove', ...options }), new URL('./cover.webp', import.meta.url).href);
