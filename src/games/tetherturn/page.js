import '../intro.js';
import { createShell } from '../kit/shell.js';
import { mountCartridge } from '../kit/cartridge.js';
import game from './game.js';

mountCartridge('tetherturn', game, (options) => createShell({ game: 'tetherturn', ...options }), new URL('./pilot.webp', import.meta.url).href);
