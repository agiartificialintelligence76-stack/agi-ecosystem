import '../intro.js';
import { createShell } from '../kit/shell.js';
import { mountRemaster } from '../kit/remaster.js';
import game from './game.js';

mountRemaster('cloudfoil', game, (options) => createShell({ game: 'cloudfoil', ...options }), new URL('./marquee.webp', import.meta.url).href);
