import '../intro.js';
import { createShell } from '../kit/shell.js';
import { mountRemaster } from '../kit/remaster.js';
import game from './game.js';

mountRemaster('tidepool', game, options => createShell({ game: 'tidepool', ...options }), new URL('./cover.webp', import.meta.url).href);
